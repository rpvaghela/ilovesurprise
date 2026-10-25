import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { db } = vi.hoisted(() => ({ db: {
  $transaction: vi.fn(), $queryRaw: vi.fn(),
  membership_plans: { count: vi.fn(), findFirst: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  user_memberships: { findUnique: vi.fn(), create: vi.fn() },
} }));
vi.mock('../src/lib/prisma', () => ({ prisma: db }));
import { assignMembership, getMyMembership } from '../src/services/membership.service';

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(fn => fn(db));
  db.$queryRaw.mockResolvedValue([]);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-31T12:00:00Z'));
  db.membership_plans.count.mockResolvedValue(1);
  db.user.findUnique.mockResolvedValue({ id: 'user', role: 'AFFILIATE', affiliate_profiles: { isActive: true, status: 'ACTIVE' } });
  db.user_memberships.findUnique.mockResolvedValue(null);
});
afterEach(() => vi.useRealTimers());

it.each([
  ['MONTHLY', '2026-02-28T12:00:00.000Z'],
  ['6_MONTH', '2026-07-31T12:00:00.000Z'],
  ['ANNUAL', '2027-01-31T12:00:00.000Z'],
])('grants the correct calendar duration for %s', async (interval, end) => {
  db.membership_plans.findFirst.mockResolvedValue({ id: 'plan', interval, isActive: true });
  await assignMembership('user', 'plan');
  expect(db.user_memberships.create.mock.calls[0][0].data.endDate.toISOString()).toBe(end);
});

it('does not grant representative access for an invalid plan', async () => {
  db.membership_plans.findFirst.mockResolvedValue(null);
  await expect(assignMembership('user', 'missing')).rejects.toMatchObject({ statusCode: 404 });
  expect(db.user.findUnique).not.toHaveBeenCalled();
});

it('does not report an expired membership as active', async () => {
  db.user_memberships.findUnique.mockResolvedValue({ status: 'ACTIVE', endDate: new Date('2025-12-31') });
  expect(await getMyMembership('user')).toEqual({ hasActiveMembership: false });
});
