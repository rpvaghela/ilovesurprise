import { beforeEach, describe, expect, it, vi } from 'vitest';
const { db, stripeRefund, commission, reversal } = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(), $queryRaw: vi.fn(),
    orders: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    payment_transactions: { updateMany: vi.fn(), findFirst: vi.fn() },
    refund_records: { create: vi.fn(), findUnique: vi.fn() },
    products: { update: vi.fn() }, inventory_logs: { create: vi.fn() },
  }, stripeRefund: vi.fn(), commission: vi.fn(), reversal: vi.fn(),
}));
vi.mock('../src/lib/prisma', () => ({ prisma: db }));
vi.mock('../src/config/env', () => ({ config: { stripeSecretKey: 'sk_test_not_real' } }));
vi.mock('../src/services/commission.service', () => ({ processOrderCommission: commission, processOrderRefundCommission: reversal }));
vi.mock('../src/services/cart.service', () => ({ clearCart: vi.fn() }));
vi.mock('stripe', () => ({ default: class { refunds = { create: stripeRefund }; } }));
import { markOrderPaid, recordStripeRefund } from '../src/services/payment.service';
import { processOrderRefund } from '../src/services/order.service';

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((fn: any) => fn(db));
  db.$queryRaw.mockResolvedValue([{ id: 'order' }]);
});

describe('Payment retries and refund safety', () => {
  it('retries commissions for an already recorded payment without deducting stock twice', async () => {
    db.orders.findUnique.mockResolvedValue({ id: 'order', orderNumber: 'ORD', totalAmount: 100, paymentStatus: 'PAID', order_items: [] });
    db.orders.updateMany.mockResolvedValue({ count: 0 });
    await markOrderPaid({ metadata: { orderId: 'order' }, payment_status: 'paid', amount_total: 10000, currency: 'usd' } as any);
    expect(commission).toHaveBeenCalledWith('order');
    expect(db.products.update).not.toHaveBeenCalled();
    expect(db.orders.updateMany.mock.calls[0][0].where).toMatchObject({ paymentStatus: { in: ['PENDING', 'PROCESSING'] }, status: { not: 'CANCELLED' } });
  });
  it('propagates commission failures so the webhook can retry', async () => {
    db.orders.findUnique.mockResolvedValue({ id: 'order', totalAmount: 100, order_items: [] });
    db.orders.updateMany.mockResolvedValue({ count: 0 });
    commission.mockRejectedValue(new Error('Temporary database failure'));
    await expect(markOrderPaid({ metadata: { orderId: 'order' }, payment_status: 'paid', amount_total: 10000, currency: 'usd' } as any)).rejects.toThrow('Temporary database failure');
  });
  it('ignores a mismatched Stripe payment amount', async () => {
    db.orders.findUnique.mockResolvedValue({ id: 'order', totalAmount: 100, order_items: [] });
    await markOrderPaid({ metadata: { orderId: 'order' }, payment_status: 'paid', amount_total: 1, currency: 'usd' } as any);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  const refundInput = { amount: 20, reason: 'Customer request', restockInventory: false };
  const paidOrder = () => ({ id: 'order', orderNumber: 'ORD', totalAmount: 100, paymentStatus: 'PAID', paymentMethod: 'STRIPE', currency: 'USD', refund_records: [], order_items: [], payment_transactions: [{ stripePaymentIntentId: 'pi_test' }] });
  it('rejects refunds on uncollected orders', async () => {
    db.orders.findFirst.mockResolvedValue({ ...paidOrder(), paymentStatus: 'PENDING' });
    await expect(processOrderRefund('order', refundInput)).rejects.toMatchObject({ statusCode: 409 });
    expect(stripeRefund).not.toHaveBeenCalled();
    expect(db.refund_records.create).not.toHaveBeenCalled();
  });
  it('does not report a completed refund when Stripe rejects it', async () => {
    db.orders.findFirst.mockResolvedValue(paidOrder());
    stripeRefund.mockRejectedValue(new Error('Gateway unavailable'));
    await expect(processOrderRefund('order', refundInput)).rejects.toThrow('Gateway unavailable');
    expect(db.refund_records.create).not.toHaveBeenCalled();
    expect(stripeRefund).toHaveBeenCalledWith({ payment_intent: 'pi_test', amount: 2000 }, { idempotencyKey: 'refund-order-0-2000' });
  });
  it('does not report a pending gateway refund as completed', async () => {
    db.orders.findFirst.mockResolvedValue(paidOrder());
    stripeRefund.mockResolvedValue({ id: 're_test', status: 'pending' });
    await expect(processOrderRefund('order', refundInput)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.refund_records.create).not.toHaveBeenCalled();
  });
  it('checks the remaining balance before contacting Stripe', async () => {
    db.orders.findFirst.mockResolvedValue({ ...paidOrder(), refund_records: [{ amount: 90 }] });
    await expect(processOrderRefund('order', refundInput)).rejects.toMatchObject({ statusCode: 400 });
    expect(stripeRefund).not.toHaveBeenCalled();
  });
  it('ignores duplicate refund webhook deliveries', async () => {
    db.payment_transactions.findFirst.mockResolvedValue({ id: 'payment', orderId: 'order' });
    db.refund_records.findUnique.mockResolvedValue({ id: 'refund' });
    await recordStripeRefund({ id: 're_test', payment_intent: 'pi_test', status: 'succeeded', amount: 2000, currency: 'usd' } as any);
    expect(db.refund_records.create).not.toHaveBeenCalled();
    expect(reversal).not.toHaveBeenCalled();
  });
  it('reconciles a completed external Stripe refund with proportional commission reversal', async () => {
    db.payment_transactions.findFirst.mockResolvedValue({ id: 'payment', orderId: 'order' });
    db.refund_records.findUnique.mockResolvedValue(null);
    db.orders.findUnique.mockResolvedValue({ ...paidOrder(), commissionableBaseUsd: 80, fxRateToUsd: 1 });
    await recordStripeRefund({ id: 're_test', payment_intent: 'pi_test', status: 'succeeded', amount: 2500, currency: 'usd' } as any);
    expect(reversal).toHaveBeenCalledWith('order', 20, false, 'Stripe refund re_test', db);
    expect(db.orders.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paymentStatus: 'PARTIALLY_REFUNDED' }) }));
  });
});
