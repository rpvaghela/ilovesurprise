import { apiClient, unwrap, type ApiResponse } from './apiClient';
import type { PayoutMethod, PayoutRecord } from '../types';

export type PayoutState = 'PENDING' | 'APPROVED' | 'HELD' | 'PAID' | 'REJECTED' | 'CANCELLED';
export interface PayoutEntry {
  id: string; affiliateId: string; representative?: string; amount: number; currency: string;
  status: PayoutState; method: PayoutMethod; destinationAccount: string;
  requestedAt: string; completedAt?: string; referenceId: string; notes?: string;
  events: { id: string; actorId: string; fromStatus?: string; toStatus: PayoutState; note?: string; referenceId?: string; createdAt: string }[];
}
interface PayoutPage { payouts: PayoutEntry[]; total: number; page: number; totalPages: number }

export function mapPayout(row: PayoutEntry): PayoutRecord {
  const statuses = { PENDING: 'pending', APPROVED: 'processing', HELD: 'held', PAID: 'completed', REJECTED: 'rejected', CANCELLED: 'cancelled' } as const;
  if (!row?.id || !(row.status in statuses) || !Number.isFinite(Number(row.amount))) {
    throw new Error('The server returned an invalid payout record.');
  }
  return { id: row.id, amount: Number(row.amount), fee: 0, netAmount: Number(row.amount),
    method: row.method, destinationAccount: row.destinationAccount, requestedAt: row.requestedAt,
    completedAt: row.completedAt || undefined, status: statuses[row.status], referenceId: row.referenceId };
}

export const payoutService = {
  async list(admin = false, page = 1, status?: PayoutState): Promise<PayoutPage> {
    const endpoint = admin ? '/api/admin/payouts' : '/api/affiliates/me/payouts';
    return unwrap(await apiClient.get<ApiResponse<PayoutPage>>(`${endpoint}?page=${page}${status ? `&status=${status}` : ''}`), endpoint);
  },
  async request(input: { requestId: string; amount: number; method: PayoutMethod; destination: string }): Promise<PayoutRecord> {
    const endpoint = '/api/affiliates/me/payouts';
    const result = unwrap(await apiClient.post<ApiResponse<PayoutEntry>>(endpoint, input), endpoint);
    return mapPayout(result);
  },
  async update(id: string, input: { status: 'APPROVED' | 'HELD' | 'PAID' | 'REJECTED'; note?: string; referenceId?: string }): Promise<PayoutEntry> {
    const endpoint = `/api/admin/payouts/${encodeURIComponent(id)}`;
    return unwrap(await apiClient.patch<ApiResponse<PayoutEntry>>(endpoint, input), endpoint);
  },
  async cancel(id: string): Promise<PayoutRecord> {
    const endpoint = `/api/affiliates/me/payouts/${encodeURIComponent(id)}/cancel`;
    return mapPayout(unwrap(await apiClient.post<ApiResponse<PayoutEntry>>(endpoint, {}), endpoint));
  },
};
