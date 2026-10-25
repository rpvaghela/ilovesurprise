import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const RESERVED_PAYOUT_STATUSES = ['PENDING', 'APPROVED', 'HELD'];
const terminal = ['PAID', 'REJECTED', 'CANCELLED'];
function fail(message: string, statusCode = 409): never { throw Object.assign(new Error(message), { statusCode }); }
const money = (value: Prisma.Decimal | number) => new Prisma.Decimal(value);

export async function reservedPayoutAmount(affiliateId: string, db: Prisma.TransactionClient = prisma) {
  const result = await db.payout_requests.aggregate({
    where: { affiliateId, status: { in: RESERVED_PAYOUT_STATUSES } }, _sum: { amount: true },
  });
  return result._sum.amount || money(0);
}

function formatPayout(row: any) {
  return {
    id: row.id, affiliateId: row.affiliateId,
    representative: row.affiliate_profiles?.username || row.affiliate_profiles?.referralCode,
    amount: Number(row.amount), currency: row.currency, status: row.status,
    method: row.payoutMethod, destinationAccount: row.accountDetails?.destination || '',
    requestedAt: row.createdAt, completedAt: row.processedAt, referenceId: row.referenceId || '',
    notes: row.notes, events: row.events || [],
  };
}

export async function listPayouts(userId: string | null, page = 1, status?: string) {
  let affiliateId: string | undefined;
  if (userId) {
    const profile = await prisma.affiliate_profiles.findUnique({ where: { userId } });
    if (!profile) return { payouts: [], total: 0, page, totalPages: 0 };
    affiliateId = profile.id;
  }
  const where: Prisma.payout_requestsWhereInput = {
    ...(affiliateId ? { affiliateId } : {}), ...(status ? { status } : {}),
  };
  const [total, records] = await Promise.all([
    prisma.payout_requests.count({ where }),
    prisma.payout_requests.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 50, skip: (page - 1) * 50,
      include: { affiliate_profiles: true, events: { orderBy: { createdAt: 'asc' } } },
    }),
  ]);
  return { payouts: records.map(formatPayout), total, page, totalPages: Math.ceil(total / 50) };
}

export async function requestPayout(userId: string, input: {
  requestId: string; amount: number; method: string; destination: string;
}) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "affiliate_profiles" WHERE "userId" = ${userId} FOR UPDATE`;
    const profile = await tx.affiliate_profiles.findUnique({ where: { userId }, include: { users: true } });
    if (!profile) fail('Representative profile not found', 404);
    const existing = await tx.payout_requests.findUnique({ where: { id: input.requestId }, include: { events: true } });
    if (existing) {
      const destination = (existing.accountDetails as { destination?: string } | null)?.destination;
      if (existing.affiliateId !== profile.id || !existing.amount.equals(input.amount) ||
          existing.payoutMethod !== input.method || destination !== input.destination) fail('Request ID already used with different payout details');
      return formatPayout(existing);
    }
    if (!profile.isActive || !profile.users.isActive || profile.payoutStatus === 'suspended') fail('This representative is not eligible to request a payout', 403);
    const reserved = await reservedPayoutAmount(profile.id, tx);
    if (money(profile.currentBalance).minus(reserved).lessThan(input.amount)) fail('Requested amount exceeds your unreserved available balance');
    const payout = await tx.payout_requests.create({ data: {
      id: input.requestId, affiliateId: profile.id, amount: input.amount, currency: 'USD',
      status: 'PENDING', payoutMethod: input.method, accountDetails: { destination: input.destination },
      updatedAt: new Date(), events: { create: { actorId: userId, toStatus: 'PENDING', note: 'Payout requested' } },
    }, include: { events: true } });
    return formatPayout(payout);
  });
}

export async function updatePayout(id: string, actorId: string, input: {
  status: string; note?: string; referenceId?: string;
}, ownerUserId?: string) {
  return prisma.$transaction(async tx => {
    const initial = await tx.payout_requests.findUnique({ where: { id }, include: { affiliate_profiles: true } });
    if (!initial || (ownerUserId && initial.affiliate_profiles.userId !== ownerUserId)) fail('Payout request not found', 404);
    await tx.$queryRaw`SELECT "id" FROM "affiliate_profiles" WHERE "id" = ${initial.affiliateId} FOR UPDATE`;
    const payout = await tx.payout_requests.findUniqueOrThrow({ where: { id }, include: { affiliate_profiles: { include: { users: true } }, events: true } });
    if (ownerUserId && input.status !== 'CANCELLED') fail('Only cancellation is allowed', 403);
    if (payout.status === input.status) {
      if (input.status === 'PAID' && payout.referenceId !== input.referenceId) fail('This payout already has a different payment reference');
      return formatPayout(payout);
    }
    if (terminal.includes(payout.status)) fail('Completed payout history cannot be changed');
    const transitions: Record<string, string[]> = {
      PENDING: ['APPROVED', 'HELD', 'REJECTED', 'CANCELLED'],
      HELD: ['APPROVED', 'REJECTED', 'CANCELLED'],
      APPROVED: ['HELD', 'PAID', 'REJECTED'],
    };
    if (!transitions[payout.status]?.includes(input.status)) fail('This payout status transition is not allowed');
    if (['HELD', 'REJECTED'].includes(input.status) && !input.note) fail('A reason is required for a hold or rejection', 400);
    if (['APPROVED', 'PAID'].includes(input.status)) {
      const profile = payout.affiliate_profiles;
      if (!profile.isActive || !profile.users.isActive || profile.payoutStatus === 'suspended') fail('Representative payouts are suspended');
      if (money(profile.currentBalance).lessThan(await reservedPayoutAmount(profile.id, tx))) {
        fail('Available earnings fell below reserved payouts. Review refunds and release or reject affected requests first.');
      }
    }
    if (input.status === 'PAID') {
      if (!input.referenceId) fail('A payment reference is required to record a completed payout', 400);
      // Allocate the recorded payment to net approved earnings, including partial commissions.
      const entries = await tx.commission_ledger.findMany({
        where: { beneficiaryId: payout.affiliateId, status: { in: ['approved', 'available'] }, amountUsd: { gt: 0 } },
        include: { reversals: true, payout_allocations: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      let remaining = money(payout.amount);
      for (const entry of entries) {
        const reversed = entry.reversals.reduce((sum, row) => sum.plus(row.amountUsd.abs()), money(0));
        const paid = entry.payout_allocations.reduce((sum, row) => sum.plus(row.amountUsd), money(0));
        const available = Prisma.Decimal.max(0, entry.amountUsd.minus(reversed).minus(paid));
        const allocated = Prisma.Decimal.min(available, remaining);
        if (allocated.lte(0)) continue;
        await tx.payout_allocations.create({ data: { payoutId: id, commissionId: entry.id, amountUsd: allocated } });
        if (allocated.equals(available)) await tx.commission_ledger.update({ where: { id: entry.id }, data: { status: 'paid' } });
        remaining = remaining.minus(allocated);
        if (remaining.equals(0)) break;
      }
      if (remaining.gt(0)) fail('Commission ledger does not cover this payout. Reconcile the balance before recording payment.');
      await tx.affiliate_profiles.update({ where: { id: payout.affiliateId }, data: {
        currentBalance: { decrement: payout.amount }, lifetimeEarnings: { increment: payout.amount },
      } });
    }
    const updated = await tx.payout_requests.update({ where: { id }, data: {
      status: input.status, notes: input.note || payout.notes, updatedAt: new Date(),
      ...(input.status === 'PAID' ? { referenceId: input.referenceId, processedAt: new Date() } : {}),
      events: { create: { actorId, fromStatus: payout.status, toStatus: input.status, note: input.note, referenceId: input.referenceId } },
    }, include: { affiliate_profiles: true, events: { orderBy: { createdAt: 'asc' } } } });
    return formatPayout(updated);
  }, { timeout: 15000 });
}
