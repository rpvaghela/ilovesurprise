const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const root = path.resolve(__dirname, '..');
const name = `ils-test-${randomBytes(6).toString('hex')}`;
const password = randomBytes(24).toString('hex');
const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ils-test-uploads-'));
const env = {
  ...process.env,
  NODE_ENV: 'test',
  ILS_ISOLATED_TEST: '1',
  ILS_TEST_CONTAINER: name,
  PAYOUTS_ENABLED: 'true',
  POSTGRES_PASSWORD: password,
  JWT_SECRET: randomBytes(32).toString('hex'),
  GOOGLE_CLIENT_ID: 'isolated-test.apps.googleusercontent.com',
  STRIPE_SECRET_KEY: 'sk_test_isolated_mock_only',
  STRIPE_WEBHOOK_SECRET: 'whsec_isolated_mock_only',
  FRONTEND_URL: 'http://localhost:5173',
  UPLOADS_DIR: uploadsDir,
  CHECKPOINT_DISABLE: '1',
};

function command(exe, args, inherit = false) {
  const result = spawnSync(exe, args, {
    cwd: root, env, encoding: 'utf8',
    stdio: inherit ? 'inherit' : 'pipe', timeout: 900000,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${path.basename(exe)} failed: ${result.error?.message || result.stderr || result.status}`);
  }
  return result.stdout?.trim();
}

async function main() {
  try {
    command('docker', ['info', '--format', '{{.ServerVersion}}']);
    command('docker', ['run', '--detach', '--rm', '--name', name,
      '--publish', '127.0.0.1::5432', '--env', 'POSTGRES_PASSWORD',
      '--env', 'POSTGRES_DB=ils_test', '--tmpfs', '/var/lib/postgresql/data', 'postgres:16-alpine']);
    const port = command('docker', ['port', name, '5432/tcp']).split(':').pop();
    if (!/^\d+$/.test(port)) throw new Error('Cannot determine isolated database port');
    env.DATABASE_URL = `postgresql://postgres:${password}@127.0.0.1:${port}/ils_test?schema=public`;
    env.DIRECT_URL = env.DATABASE_URL;
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      const result = spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres', '-d', 'ils_test'], { encoding: 'utf8', timeout: 10000 });
      if (result.status === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!ready) throw new Error('Isolated PostgreSQL did not become ready');
    console.log(`Isolated PostgreSQL ready on localhost:${port}; database/provider configuration overrides .env. Stripe is mocked.`);
    command(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate'], true);
    command(process.execPath, [path.join(root, 'node_modules/vitest/vitest.mjs'), 'run', ...process.argv.slice(2)], true);
  } finally {
    const result = spawnSync('docker', ['rm', '--force', name], { encoding: 'utf8', timeout: 30000 });
    if (result.status === 0) console.log('Disposable test database removed.');
    else if (!result.stderr?.includes('No such container')) console.error(`Check cleanup of container ${name}.`);
    const target = path.resolve(uploadsDir);
    const parent = path.resolve(os.tmpdir());
    if (path.dirname(target) === parent && path.basename(target).startsWith('ils-test-uploads-')) {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
