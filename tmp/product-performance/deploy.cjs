const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = '/var/backups/ilovesurprises/product-performance-20261024-001';
const app = '/var/www/ilovesurprises-backend';
const nginx = '/etc/nginx/sites-available/ilovesurprises';
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const install = (from, to) => {
  fs.copyFileSync(from, to + '.performance-release');
  fs.renameSync(to + '.performance-release', to);
};
const command = (exe, args) => execFileSync(exe, args, { timeout: 60000, stdio: 'pipe' });

(async () => {
  if (process.platform !== 'linux' || !fs.existsSync(root + '/before/product.service.js')) {
    throw new Error('This release must run on the prepared VPS');
  }
  for (const [original, backup] of [
    [app + '/src/services/product.service.ts', root + '/before/product.service.ts'],
    [app + '/dist/services/product.service.js', root + '/before/product.service.js'],
    [nginx, root + '/before/nginx.conf'],
  ]) {
    if (sha(original) !== sha(backup)) throw new Error('Live files changed since backup; release aborted');
  }
  let changed = false;
  try {
    changed = true;
    for (const name of ['product-detail.query', 'product.service']) {
      install(`${root}/source/${name}.ts`, `${app}/src/services/${name}.ts`);
      install(`${root}/candidate/services/${name}.js`, `${app}/dist/services/${name}.js`);
    }
    install(root + '/nginx.conf', nginx);
    command('nginx', ['-t']);
    command('systemctl', ['reload', 'nginx']);
    command('pm2', ['reload', 'ilovesurprises-api']);
    let healthy = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        const r = await fetch('http://127.0.0.1:3000/api/health', { signal: AbortSignal.timeout(10000) });
        const body = await r.json();
        if (r.ok && body.services?.database?.status === 'connected') { healthy = true; break; }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!healthy) throw new Error('Post-release database health check failed');
    const response = await fetch('http://127.0.0.1:3000/api/products/bahama-mama-cash-money-candle', { signal: AbortSignal.timeout(25000) });
    const body = await response.json();
    if (!response.ok || body.data?.product?.slug !== 'bahama-mama-cash-money-candle') throw new Error('Post-release product check failed');
    console.log(JSON.stringify({ deployed: true, database: 'connected', product: 'ok', backup: root + '/before' }));
  } catch (error) {
    if (changed) {
      install(root + '/before/product.service.ts', app + '/src/services/product.service.ts');
      install(root + '/before/product.service.js', app + '/dist/services/product.service.js');
      install(root + '/before/nginx.conf', nginx);
      command('nginx', ['-t']);
      command('systemctl', ['reload', 'nginx']);
      command('pm2', ['reload', 'ilovesurprises-api']);
      console.error('Release failed; previous service and Nginx configuration restored.');
    }
    throw error;
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
