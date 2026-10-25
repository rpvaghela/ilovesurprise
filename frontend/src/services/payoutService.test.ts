import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { payoutService, mapPayout, type PayoutEntry } from './payoutService';
import { setStoredAuthToken } from './apiClient';

const entry: PayoutEntry = { id: 'payout-1', affiliateId: 'rep-1', amount: 50, currency: 'USD',
  status: 'PENDING', method: 'paypal', destinationAccount: 'payee@example.test',
  requestedAt: '2026-10-22T10:00:00Z', referenceId: '', events: [] };
const fetchMock = vi.fn();
beforeEach(() => {
  localStorage.clear(); setStoredAuthToken('isolated-token'); vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ status: 'success', data: entry }), { status: 200, headers: { 'content-type': 'application/json' } }));
});
afterEach(() => { vi.unstubAllGlobals(); setStoredAuthToken(null); });

describe('payout API contracts', () => {
  it.each([
    ['PENDING', 'pending'], ['HELD', 'held'], ['APPROVED', 'processing'],
    ['PAID', 'completed'], ['REJECTED', 'rejected'], ['CANCELLED', 'cancelled'],
  ] as const)('maps %s without claiming payment was sent', (status, expected) => {
    expect(mapPayout({ ...entry, status }).status).toBe(expected);
  });
  it('passes the stable request ID and real payout details to the server', async () => {
    const input = { requestId: 'retry-safe-id', amount: 50, method: 'paypal' as const, destination: 'payee@example.test' };
    const result = await payoutService.request(input);
    expect(result.status).toBe('pending');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(input);
  });
  it('sends payment references only through the admin endpoint', async () => {
    await payoutService.update('payout-1', { status: 'PAID', referenceId: 'BANK-123' });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/admin/payouts/payout-1');
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).referenceId).toBe('BANK-123');
  });
  it('does not replace failed payout history requests with invented empty history', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ status: 'error', message: 'Access denied' }), { status: 403, headers: { 'content-type': 'application/json' } }));
    await expect(payoutService.list(true)).rejects.toMatchObject({ statusCode: 403 });
  });
});
