import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/utils/jwt';
import { processOrderRefundCommission } from '../src/services/commission.service';

const app = createApp();
const prefix = crypto.randomUUID();
let admin: string, staff: string, rep: string, other: string;
let profileId: string, orderId: string, commissionId: string, firstId: string;
const input = (amount: number, requestId = crypto.randomUUID()) => ({ requestId, amount, method: 'paypal', destination: 'test-payee@example.test' });
const submit = (body: object) => request(app).post('/api/affiliates/me/payouts').set('Authorization', `Bearer ${rep}`).send(body);
const update = (id: string, body: object, token = admin) => request(app).patch(`/api/admin/payouts/${id}`).set('Authorization', `Bearer ${token}`).send(body);

beforeAll(async () => {
  const user = async (role: 'ADMIN' | 'STAFF' | 'AFFILIATE' | 'CUSTOMER', name: string) => {
    const row = await prisma.user.create({ data: { email: `${name}-${prefix}@example.test`, passwordHash: 'unused', role } });
    return { row, token: signToken({ id: row.id, role: row.role, email: row.email }) };
  };
  admin = (await user('ADMIN', 'admin')).token;
  staff = (await user('STAFF', 'staff')).token;
  other = (await user('AFFILIATE', 'other')).token;
  const representative = await user('AFFILIATE', 'rep');
  rep = representative.token;
  const buyer = await user('CUSTOMER', 'customer');
  const profile = await prisma.affiliate_profiles.create({ data: {
    id: crypto.randomUUID(), userId: representative.row.id, username: `payout-${prefix}`,
    referralCode: `payout-${prefix}`, currentBalance: 100, updatedAt: new Date(),
  } });
  profileId = profile.id;
  const order = await prisma.orders.create({ data: {
    id: crypto.randomUUID(), orderNumber: `PAYOUT-${prefix}`, userId: buyer.row.id, attributedAffiliateId: profile.id,
    status: 'CONFIRMED', paymentStatus: 'PAID', paymentMethod: 'STRIPE', subtotal: 500, totalAmount: 500,
    commissionableBaseUsd: 500, fxRateToUsd: 1, shippingAddressSnapshot: {}, updatedAt: new Date(),
  } });
  orderId = order.id;
  const commission = await prisma.commission_ledger.create({ data: {
    orderId, beneficiaryId: profile.id, level: 0, rate: 0.2, commissionableBaseUsd: 500,
    amountUsd: 100, status: 'approved', availableAt: new Date(),
  } });
  commissionId = commission.id;
});

describe('Payout reservations, review, payment records and audit history', () => {
  it('rejects anonymous, below-minimum, fractional-cent and excessive requests', async () => {
    expect((await request(app).post('/api/affiliates/me/payouts').send(input(25))).status).toBe(401);
    expect((await submit(input(24))).status).toBe(400);
    expect((await submit(input(25.001))).status).toBe(400);
    expect((await submit(input(101))).status).toBe(409);
  });

  it('serializes competing requests without reserving more than the available balance', async () => {
    const bodies = [input(70), input(70)];
    const responses = await Promise.all(bodies.map(submit));
    expect(responses.map(row => row.status).sort()).toEqual([201, 409]);
    const winner = responses.findIndex(row => row.status === 201);
    firstId = bodies[winner].requestId;
    expect((await submit(bodies[winner])).status).toBe(201);
    expect(await prisma.payout_requests.count({ where: { affiliateId: profileId } })).toBe(1);
    expect((await submit({ ...bodies[winner], amount: 60 })).status).toBe(409);
    const dashboard = await request(app).get('/api/affiliates/me').set('Authorization', `Bearer ${rep}`);
    expect(dashboard.body.data.metrics.availableBalance).toBe(30);
  });

  it('does not allow customer/staff review or another representative to see or cancel a request', async () => {
    expect((await update(firstId, { status: 'APPROVED' }, staff)).status).toBe(403);
    expect((await update(firstId, { status: 'APPROVED' }, rep)).status).toBe(403);
    const list = await request(app).get('/api/affiliates/me/payouts').set('Authorization', `Bearer ${other}`);
    expect(list.body.data.payouts).toEqual([]);
    expect((await request(app).post(`/api/affiliates/me/payouts/${firstId}/cancel`).set('Authorization', `Bearer ${other}`)).status).toBe(404);
  });

  it('prevents the legacy commission payment action from spending reserved funds', async () => {
    const response = await request(app).patch(`/api/admin/commission/ledger/${commissionId}/status`)
      .set('Authorization', `Bearer ${admin}`).send({ status: 'paid' });
    expect(response.status).toBe(409);
  });

  it('requires hold reasons, preserves the reservation, then permits approval', async () => {
    expect((await update(firstId, { status: 'HELD' })).status).toBe(400);
    expect((await update(firstId, { status: 'HELD', note: 'Verify payout destination' })).status).toBe(200);
    expect((await submit(input(31))).status).toBe(409);
    expect((await update(firstId, { status: 'APPROVED', note: 'Destination verified' })).status).toBe(200);
    expect((await request(app).post(`/api/affiliates/me/payouts/${firstId}/cancel`).set('Authorization', `Bearer ${rep}`)).status).toBe(409);
  });

  it('requires a payment reference and records completion exactly once on retries', async () => {
    expect((await update(firstId, { status: 'PAID' })).status).toBe(400);
    const responses = await Promise.all([0, 1].map(() => update(firstId, { status: 'PAID', referenceId: `manual-${prefix}` })));
    expect(responses.map(row => row.status)).toEqual([200, 200]);
    const profile = await prisma.affiliate_profiles.findUniqueOrThrow({ where: { id: profileId } });
    expect(Number(profile.currentBalance)).toBe(30);
    expect(Number(profile.lifetimeEarnings)).toBe(70);
    expect(await prisma.payout_allocations.count({ where: { payoutId: firstId } })).toBe(1);
    expect((await prisma.commission_ledger.findUniqueOrThrow({ where: { id: commissionId } })).status).toBe('approved');
    expect((await update(firstId, { status: 'PAID', referenceId: 'different-reference' })).status).toBe(409);
  });

  it('releases rejected requests and preserves their audit trail', async () => {
    const created = await submit(input(30));
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect((await update(id, { status: 'REJECTED', note: 'Incorrect destination' })).status).toBe(200);
    expect((await update(id, { status: 'APPROVED' })).status).toBe(409);
    const dashboard = await request(app).get('/api/affiliates/me').set('Authorization', `Bearer ${rep}`);
    expect(dashboard.body.data.metrics.availableBalance).toBe(30);
    await expect(prisma.payout_requests.delete({ where: { id } })).rejects.toMatchObject({ code: 'P2003' });
  });

  it('settles the remainder of the same commission without paying its earlier allocation again', async () => {
    const created = await submit(input(30));
    const id = created.body.data.id;
    expect((await update(id, { status: 'APPROVED' })).status).toBe(200);
    expect((await update(id, { status: 'PAID', referenceId: `remainder-${prefix}` })).status).toBe(200);
    expect((await prisma.commission_ledger.findUniqueOrThrow({ where: { id: commissionId } })).status).toBe('paid');
    const profile = await prisma.affiliate_profiles.findUniqueOrThrow({ where: { id: profileId } });
    expect(Number(profile.currentBalance)).toBe(0);
    expect(Number(profile.lifetimeEarnings)).toBe(100);
    const allocations = await prisma.payout_allocations.aggregate({ where: { commissionId }, _sum: { amountUsd: true } });
    expect(Number(allocations._sum.amountUsd)).toBe(100);
  });

  it('claws back refunded paid commissions without changing payout history', async () => {
    await processOrderRefundCommission(orderId, 250, false, 'Refund after payout');
    expect(Number((await prisma.affiliate_profiles.findUniqueOrThrow({ where: { id: profileId } })).currentBalance)).toBe(-50);
    expect((await submit(input(25))).status).toBe(409);
    const history = await request(app).get('/api/affiliates/me/payouts').set('Authorization', `Bearer ${rep}`);
    const paid = history.body.data.payouts.filter((row: any) => row.status === 'PAID');
    expect(paid.reduce((sum: number, row: any) => sum + row.amount, 0)).toBe(100);
    expect(paid.find((row: any) => row.id === firstId).events.map((row: any) => row.toStatus)).toEqual(['PENDING', 'HELD', 'APPROVED', 'PAID']);
  });
});
