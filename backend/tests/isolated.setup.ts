import { afterAll, beforeAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

const database = new URL(process.env.DATABASE_URL || 'http://invalid');
if (process.env.ILS_ISOLATED_TEST !== '1' || database.hostname !== '127.0.0.1' || database.pathname !== '/ils_test') {
  throw new Error('Refusing database reset outside the disposable test database');
}
const fixtureDatabase = new PrismaClient();
beforeAll(async () => {
  const [identity] = await fixtureDatabase.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  if (identity.name !== 'ils_test') throw new Error('Unexpected database identity');
  // File execution is serial. Clear only the verified disposable database before each file.
  await fixtureDatabase.$executeRawUnsafe(`DO $$
    DECLARE tables text;
    BEGIN
      SELECT string_agg(format('%I.%I', schemaname, tablename), ', ') INTO tables
      FROM pg_tables WHERE schemaname = 'public';
      IF tables IS NOT NULL THEN EXECUTE 'TRUNCATE TABLE ' || tables || ' RESTART IDENTITY CASCADE'; END IF;
    END $$`);
});
afterAll(() => fixtureDatabase.$disconnect());

// Unconfigured provider calls fail closed; each provider test supplies its own mock.
vi.mock('stripe', () => ({
  default: class {
    constructor() { throw new Error('Stripe must be mocked explicitly in isolated tests'); }
  },
}));
