import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { prisma } from '../src/lib/prisma';

it('applies the additive payout patch to a database without payout history tables and can run it again', async () => {
  const container = process.env.ILS_TEST_CONTAINER || '';
  const database = new URL(process.env.DATABASE_URL!);
  if (!/^ils-test-[a-f0-9]{12}$/.test(container) || database.hostname !== '127.0.0.1' || database.pathname !== '/ils_test') {
    throw new Error('Schema tests require the disposable test container');
  }
  await prisma.$executeRawUnsafe('DROP TABLE "payout_allocations", "payout_events"');
  const sql = readFileSync('prisma/patches/20261022_payout_history.sql', 'utf8');
  for (let attempt = 0; attempt < 2; attempt++) {
    execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'ils_test', '-v', 'ON_ERROR_STOP=1'],
      { input: sql, stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000 });
  }
  expect(await prisma.payout_allocations.count()).toBe(0);
  expect(await prisma.payout_events.count()).toBe(0);
  const constraints = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) AS count FROM pg_constraint
    WHERE conrelid IN ('payout_allocations'::regclass, 'payout_events'::regclass) AND contype = 'f'`;
  expect(Number(constraints[0].count)).toBe(3);
});
