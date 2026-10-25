import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from 'decimal.js';

const { db, verifyIdToken, getTokenInfo } = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(), $queryRaw: vi.fn(), $queryRawUnsafe: vi.fn(),
    orders: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    order_items: { findMany: vi.fn() },
    commission_ledger: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    affiliate_profiles: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
  },
  verifyIdToken: vi.fn(), getTokenInfo: vi.fn(),
}));
vi.mock('../src/lib/prisma', () => ({ prisma: db }));
vi.mock('../src/config/env', () => ({ config: { googleClientId: 'our-client', jwtSecret: 'test-only-secret' } }));
vi.mock('google-auth-library', () => ({ OAuth2Client: class { verifyIdToken = verifyIdToken; getTokenInfo = getTokenInfo; } }));

import { googleLogin, verifyGoogleIdToken, fetchGoogleUserInfo } from '../src/services/auth.service';
import { googleLoginSchema } from '../src/validation/auth.validation';
import { processOrderCommission, processOrderRefundCommission, resolveGenealogyPayoutChain, calculateCommissionableBaseUSD, calculateMonthlyQualifyingRetailSales } from '../src/services/commission.service';
import { updateAdminCommissionLedgerStatus } from '../src/services/analytics.service';

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((fn: any) => fn(db));
  db.$queryRaw.mockResolvedValue([{ id: 'order' }]);
});

describe('Google identity verification', () => {
  it('rejects email-only sign-in in both validation and the service', async () => {
    expect(googleLoginSchema.safeParse({ body: { email: 'admin@example.com' } }).success).toBe(false);
    await expect(googleLogin({ email: 'admin@example.com' })).rejects.toMatchObject({ statusCode: 400 });
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
  it('does not bypass failed audience/signature verification through tokeninfo', async () => {
    verifyIdToken.mockRejectedValue(new Error('Wrong audience'));
    await expect(verifyGoogleIdToken('wrong-client-token')).rejects.toMatchObject({ statusCode: 400 });
    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: 'wrong-client-token', audience: 'our-client' });
  });
  it('rejects access tokens issued to a different client', async () => {
    getTokenInfo.mockResolvedValue({ aud: 'other-client', expiry_date: Date.now() + 60000 });
    await expect(fetchGoogleUserInfo('token')).rejects.toMatchObject({ statusCode: 400 });
  });
  it('rejects an unverified Google email before looking up the account', async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => ({ email: 'admin@example.com', email_verified: false }) });
    await expect(googleLogin({ idToken: 'token' })).rejects.toMatchObject({ statusCode: 400 });
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});

describe('Commission eligibility and genealogy', () => {
  it('prorates discounts over the whole order before calculating eligible earnings', () => {
    expect(calculateCommissionableBaseUSD({ subtotal: 100, discountAmount: 20, fxRateToUsd: 1.25 }, [
      { lineTotal: 60, isCommissionEligible: true }, { lineTotal: 40, isCommissionEligible: false },
    ]).toNumber()).toBe(60);
  });
  it('excludes other reps and refunded revenue from monthly qualification', async () => {
    db.affiliate_profiles.findUnique.mockResolvedValue({ userId: 'seller' });
    const retail = { subtotal: 100, discountAmount: 0, fxRateToUsd: 1, totalAmount: 100,
      order_items: [{ lineTotal: 100, isCommissionEligible: true }],
      refund_records: [{ status: 'COMPLETED', amount: 25 }], users: {} };
    db.orders.findMany.mockResolvedValue([retail, { ...retail, users: { affiliate_profiles: { isActive: true } } }]);
    expect((await calculateMonthlyQualifyingRetailSales('rep', new Date())).toNumber()).toBe(75);
    expect(db.orders.findMany.mock.calls[0][0].where.paymentStatus.in).not.toContain('PROCESSING');
  });
  it.each(['PENDING', 'PROCESSING', 'FAILED', 'REFUNDED'])('does not award commissions for payment status %s', async (paymentStatus) => {
    db.$queryRawUnsafe.mockResolvedValue([{ id: 'order', status: 'CONFIRMED', paymentStatus, attributedAffiliateId: 'rep' }]);
    expect((await processOrderCommission('order')).status).toBe('order_not_eligible');
    expect(db.commission_ledger.create).not.toHaveBeenCalled();
  });
  it('excludes an active rep buying through a different rep link', async () => {
    db.$queryRawUnsafe.mockResolvedValue([{ id: 'order', status: 'CONFIRMED', paymentStatus: 'PAID', attributedAffiliateId: 'seller', userId: 'buyer' }]);
    db.commission_ledger.count.mockResolvedValue(0);
    db.order_items.findMany.mockResolvedValue([]);
    db.affiliate_profiles.findUnique.mockImplementation(({ where }: any) => Promise.resolve(where.userId ? { isActive: true } : { userId: 'seller-user' }));
    expect((await processOrderCommission('order')).status).toBe('personal_purchase_no_commission');
    expect(db.commission_ledger.create).not.toHaveBeenCalled();
  });
  it('keeps all six fixed rates and stops cycles without redistribution', async () => {
    db.affiliate_profiles.findUnique.mockImplementation(({ where }: any) => {
      const level = Number(where.id);
      return Promise.resolve({ id: where.id, userId: `user-${level}`, isActive: true, sponsorId: String((level + 1) % 6) });
    });
    const chain = await resolveGenealogyPayoutChain('0', 'customer');
    expect(chain.map(row => row.rate.toNumber())).toEqual([0.2, 0.05, 0.04, 0.03, 0.02, 0.01]);
    expect(chain.reduce((sum, row) => sum.plus(row.rate.times(100)), new Decimal(0)).toNumber()).toBe(35);
  });
});

describe('Refund balances and approval lifecycle', () => {
  function ledger(status = 'pending') {
    return { id: 'ledger', orderId: 'order', beneficiaryId: 'rep', amountUsd: new Decimal(20),
      commissionableBaseUsd: new Decimal(100), rate: 0.2, level: 0, status,
      availableAt: new Date(), ruleVersion: 'v5.0', reversals: [{ amountUsd: new Decimal(-10) }] };
  }
  it.each(['pending', 'available', 'approved', 'paid'])('reverses only the remaining amount after a partial refund (%s)', async (status) => {
    db.commission_ledger.findMany.mockResolvedValue([ledger(status)]);
    db.orders.findUnique.mockResolvedValue({ fxRateToUsd: 1 });
    const result = await processOrderRefundCommission('order', undefined, true);
    expect(result.totalReversalUsd).toBe(10);
    expect(db.commission_ledger.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amountUsd: -10, parentLedgerId: 'ledger' }) }));
    expect(db.affiliate_profiles.update).toHaveBeenCalledWith({ where: { id: 'rep' }, data: {
      [status === 'pending' ? 'pendingBalance' : 'currentBalance']: { decrement: 10 },
    } });
  });
  it('does not deduct again for an already fully reversed entry', async () => {
    const entry = ledger(); entry.reversals = [{ amountUsd: new Decimal(-20) }];
    db.commission_ledger.findMany.mockResolvedValue([entry]);
    db.orders.findUnique.mockResolvedValue({ fxRateToUsd: 1 });
    expect((await processOrderRefundCommission('order', undefined, true)).reversalCount).toBe(0);
    expect(db.affiliate_profiles.update).not.toHaveBeenCalled();
  });
  it('requires an explicit refund amount for partial reversals', async () => {
    await expect(processOrderRefundCommission('order')).rejects.toMatchObject({ statusCode: 400 });
  });
  it('moves only net earnings on approval after a partial refund', async () => {
    db.commission_ledger.findUnique.mockResolvedValue(ledger());
    await updateAdminCommissionLedgerStatus('ledger', 'approved');
    expect(db.affiliate_profiles.update).toHaveBeenCalledWith({ where: { id: 'rep' }, data: {
      pendingBalance: { decrement: 10 }, currentBalance: { increment: 10 },
    } });
  });
  it('does not resurrect a reversed ledger record', async () => {
    db.commission_ledger.findUnique.mockResolvedValue(ledger('reversed'));
    await expect(updateAdminCommissionLedgerStatus('ledger', 'pending')).rejects.toMatchObject({ statusCode: 409 });
    expect(db.affiliate_profiles.update).not.toHaveBeenCalled();
  });
  it('treats repeated approval as idempotent', async () => {
    db.commission_ledger.findUnique.mockResolvedValue(ledger('available'));
    await updateAdminCommissionLedgerStatus('ledger', 'approved');
    expect(db.affiliate_profiles.update).not.toHaveBeenCalled();
  });
});
