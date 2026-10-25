import { defineConfig } from 'vitest/config';

const database = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
if (process.env.ILS_ISOLATED_TEST !== '1' || !database ||
    database.hostname !== '127.0.0.1' || database.pathname !== '/ils_test' ||
    process.env.DIRECT_URL !== process.env.DATABASE_URL || process.env.NODE_ENV !== 'test') {
  throw new Error('Tests require a disposable local database. Run npm run test:isolated instead.');
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
    setupFiles: ['./tests/isolated.setup.ts'],
  },
});
