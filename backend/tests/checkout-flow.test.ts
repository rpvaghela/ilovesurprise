import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';

const gateway = vi.hoisted(() => ({
  checkout: vi.fn(), retrieve: vi.fn(), refund: vi.fn(), coupon: vi.fn(),
}));
vi.mock('stripe', async importOriginal => {
  const { default: Stripe } = await importOriginal<typeof import('stripe')>();
  const realWebhookVerifier = new Stripe('sk_test_isolated_mock_only').webhooks;
  return { default: class {
    checkout = { sessions: { create: gateway.checkout, retrieve: gateway.retrieve } };
    refunds = { create: gateway.refund };
    coupons = { create: gateway.coupon };
    webhooks = realWebhookVerifier;
  } };
});

import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/utils/jwt';
import { config } from '../src/config/env';

const app = createApp();
const prefix = crypto.randomUUID();
let admin: string, customer: string, staff: string, repToken: string;
let productId: string, affiliateId: string, repEmail: string;
let orderId: string, ledgerId: string;
let paidSession: any;
const address = {
  fullName: 'Test Customer', email: `${prefix}@example.test`, phone: '555-0100',
  addressLine1: '1 Test Street', city: 'Test City', state: 'CA', zipCode: '90210', country: 'US',
};

function webhook(type: string, object: any) {
  const body = JSON.stringify({ id: `evt_${crypto.randomUUID()}`, object: 'event', type, data: { object } });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac('sha256', config.stripeWebhookSecret).update(`${timestamp}.${body}`).digest('hex');
  return request(app).post('/api/payments/webhook').set('Content-Type', 'application/json')
    .set('stripe-signature', `t=${timestamp},v1=${signature}`).send(body);
}

beforeAll(async () => {
  const createUser = async (name: string, role: 'ADMIN' | 'STAFF' | 'AFFILIATE' | 'CUSTOMER') => {
    const user = await prisma.user.create({ data: { email: `${name}-${prefix}@example.test`, passwordHash: 'unused', role } });
    return { user, token: signToken({ id: user.id, email: user.email, role: user.role }) };
  };
  admin = (await createUser('admin', 'ADMIN')).token;
  customer = (await createUser('customer', 'CUSTOMER')).token;
  staff = (await createUser('staff', 'STAFF')).token;
  const representative = await createUser('representative', 'AFFILIATE');
  repToken = representative.token;
  repEmail = representative.user.email;
  const profile = await prisma.affiliate_profiles.create({ data: {
    id: crypto.randomUUID(), userId: representative.user.id, username: `rep-${prefix}`,
    referralCode: `rep-${prefix}`, updatedAt: new Date(),
  } });
  affiliateId = profile.id;
  const product = await prisma.products.create({ data: {
    id: crypto.randomUUID(), name: 'Isolated cash candle', slug: prefix, price: 100,
    stock: 20, status: 'ACTIVE', isCommissionEligible: true, updatedAt: new Date(),
  } });
  productId = product.id;
  gateway.checkout.mockImplementation(async (data: any) => ({
    id: `cs_test_${data.metadata.orderId}`, url: 'https://checkout.stripe.com/c/pay/mock-only',
  }));
  gateway.coupon.mockResolvedValue({ id: 'coupon_test' });
  gateway.refund.mockImplementation(async (_data: any, options: any) => ({
    id: `re_${options.idempotencyKey}`, status: 'succeeded',
  }));
});

describe('Checkout to ledger to refund against isolated PostgreSQL', () => {
  it('creates a pending order using database prices and a verified referral cookie', async () => {
    const referral = signToken({ id: affiliateId, purpose: 'referral' });
    const response = await request(app).post('/api/payments/checkout')
      .set('Authorization', `Bearer ${customer}`).set('Cookie', `ils_affiliate_id=${referral}`)
      .send({ paymentMethod: 'card', items: [{ productId, quantity: 1, price: 0.01 }],
        shippingAddress: address, deliveryMethodId: 'standard', totalAmount: 0.01 });
    expect(response.status).toBe(201);
    orderId = response.body.data.orderId;
    const order = await prisma.orders.findUniqueOrThrow({ where: { id: orderId } });
    expect(Number(order.totalAmount)).toBe(100);
    expect(order.paymentStatus).toBe('PENDING');
    expect(order.attributedAffiliateId).toBe(affiliateId);
    expect(await prisma.commission_ledger.count({ where: { orderId } })).toBe(0);
    paidSession = { id: response.body.data.sessionId, metadata: { orderId },
      payment_status: 'paid', amount_total: 10000, currency: 'usd', payment_intent: `pi_${prefix}` };
  });

  it('rejects a bad signature and ignores an amount mismatch', async () => {
    expect((await request(app).post('/api/payments/webhook').set('stripe-signature', 'invalid').send({})).status).toBe(400);
    expect((await webhook('checkout.session.completed', { ...paidSession, amount_total: 1 })).status).toBe(200);
    expect((await prisma.orders.findUniqueOrThrow({ where: { id: orderId } })).paymentStatus).toBe('PENDING');
  });

  it('processes concurrent signed payment callbacks only once', async () => {
    const responses = await Promise.all([
      webhook('checkout.session.completed', paidSession), webhook('checkout.session.completed', paidSession),
    ]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    expect((await prisma.products.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(19);
    const entries = await prisma.commission_ledger.findMany({ where: { orderId } });
    expect(entries).toHaveLength(1);
    expect(Number(entries[0].amountUsd)).toBe(20);
    ledgerId = entries[0].id;
    expect(Number((await prisma.affiliate_profiles.findUniqueOrThrow({ where: { id: affiliateId } })).pendingBalance)).toBe(20);
  });

  it('rejects staff financial changes and approves the commission exactly once', async () => {
    const url = `/api/admin/commission/ledger/${ledgerId}/status`;
    expect((await request(app).patch(url).set('Authorization', `Bearer ${staff}`).send({ status: 'approved' })).status).toBe(403);
    const responses = await Promise.all([0, 1].map(() => request(app).patch(url)
      .set('Authorization', `Bearer ${admin}`).send({ status: 'approved' })));
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    const profile = await prisma.affiliate_profiles.findUniqueOrThrow({ where: { id: affiliateId } });
    expect(Number(profile.pendingBalance)).toBe(0);
    expect(Number(profile.currentBalance)).toBe(20);
  });

  it('rolls back the refund when the simulated gateway rejects it', async () => {
    gateway.refund.mockRejectedValueOnce(new Error('Simulated gateway failure'));
    const response = await request(app).post(`/api/admin/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${admin}`).send({ amount: 25, reason: 'Test failure' });
    expect(response.status).toBe(500);
    expect(await prisma.refund_records.count({ where: { orderId } })).toBe(0);
    expect(Number((await prisma.affiliate_profiles.findUniqueOrThrow({ where: { id: affiliateId } })).currentBalance)).toBe(20);
  });

  it('reverses a partial refund and deduplicates its later webhook', async () => {
    const response = await request(app).post(`/api/admin/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${admin}`).send({ amount: 25, reason: 'Partial return' });
    expect(response.status).toBe(200);
    const record = await prisma.refund_records.findFirstOrThrow({ where: { orderId } });
    expect((await webhook('refund.created', { id: record.stripeRefundId, payment_intent: `pi_${prefix}`,
      status: 'succeeded', amount: 2500, currency: 'usd' })).status).toBe(200);
    expect(await prisma.refund_records.count({ where: { orderId } })).toBe(1);
    expect(Number((await prisma.affiliate_profiles.findUniqueOrThrow({ where: { id: affiliateId } })).currentBalance)).toBe(15);
  });

  it('refunds the remainder, restores stock once, and cannot resurrect a refunded order', async () => {
    const response = await request(app).post(`/api/admin/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${admin}`).send({ amount: 75, reason: 'Final return', restockInventory: true });
    expect(response.status).toBe(200);
    expect((await webhook('checkout.session.completed', paidSession)).status).toBe(200);
    expect((await prisma.orders.findUniqueOrThrow({ where: { id: orderId } })).paymentStatus).toBe('REFUNDED');
    expect((await prisma.products.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(20);
    expect(Number((await prisma.affiliate_profiles.findUniqueOrThrow({ where: { id: affiliateId } })).currentBalance)).toBe(0);
    const entries = await prisma.commission_ledger.findMany({ where: { orderId } });
    expect(entries.reduce((sum, row) => sum + Number(row.amountUsd), 0)).toBe(0);
  });

  it('gives authenticated representatives 20% off and no commission through another rep', async () => {
    const response = await request(app).post('/api/payments/checkout').set('Authorization', `Bearer ${repToken}`)
      .send({ paymentMethod: 'card', items: [{ productId, quantity: 1 }], shippingAddress: address, deliveryMethodId: 'standard' });
    expect(response.status).toBe(201);
    const personalOrderId = response.body.data.orderId;
    const order = await prisma.orders.findUniqueOrThrow({ where: { id: personalOrderId } });
    expect(Number(order.totalAmount)).toBe(80);
    expect((await webhook('checkout.session.completed', { ...paidSession, id: response.body.data.sessionId,
      metadata: { orderId: personalOrderId }, amount_total: 8000, payment_intent: `pi_personal_${prefix}` })).status).toBe(200);
    expect(await prisma.commission_ledger.count({ where: { orderId: personalOrderId } })).toBe(0);
  });

  it('does not give a guest representative discounts merely for supplying their email', async () => {
    const response = await request(app).post('/api/payments/checkout').send({ paymentMethod: 'card',
      items: [{ productId, quantity: 1 }], shippingAddress: { ...address, email: repEmail }, deliveryMethodId: 'standard' });
    expect(response.status).toBe(201);
    const order = await prisma.orders.findUniqueOrThrow({ where: { id: response.body.data.orderId } });
    expect(Number(order.discountAmount)).toBe(0);
  });
});
