const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(path.join(process.env.TEMP, 'ils-audit-tools/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-features=LocalNetworkAccessChecks'] });
  const out = path.resolve(__dirname, '../../tmp/scope-audit');
  fs.mkdirSync(out, { recursive: true });
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
      page.on('console', message => { if (message.type() === 'error') console.error(message.text()); });
      page.on('response', response => { if (response.status() >= 400) console.error(`${response.status()} ${response.url()}`); });
      const row = { id: 'payout-test', affiliateId: 'rep-test', representative: 'representative_with_long_username',
        amount: 50, currency: 'USD', status: 'PENDING', method: 'paypal',
        destinationAccount: 'long-but-valid-representative-account@example.test', requestedAt: '2026-10-22T10:00:00Z',
        referenceId: '', events: [{ id: 'event-1', actorId: 'rep-test', toStatus: 'PENDING', createdAt: '2026-10-22T10:00:00Z' }] };
      const changes = [];
      await page.route('**/api/**', async route => {
        const request = route.request();
        let data = {};
        if (request.url().includes('/payouts')) {
          if (request.method() === 'PATCH') {
            const change = request.postDataJSON(); changes.push(change);
            row.events.push({ id: `event-${changes.length + 1}`, actorId: 'admin-test', fromStatus: row.status,
              toStatus: change.status, createdAt: '2026-10-22T11:00:00Z', note: change.note, referenceId: change.referenceId });
            Object.assign(row, change); data = row;
          } else data = { payouts: [row], total: 1, page: 1, totalPages: 1 };
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success', data }) });
      });
      await page.route('**/__payout_audit', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root" style="max-width:1200px;margin:24px auto;padding:16px"></div><script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        localStorage.setItem('ilovesurprises_jwt_token','mock-token');
        await import('/src/index.css');
        const reactModule = await import('/node_modules/.vite/deps/react.js');
        const React = reactModule.default || reactModule;
        const clientModule = await import('/node_modules/.vite/deps/react-dom_client.js');
        const { createRoot } = clientModule.default || clientModule;
        const { AdminPayouts } = await import('/src/components/admin/AdminPayouts.tsx');
        createRoot(document.getElementById('root')).render(React.createElement(AdminPayouts));
      </script></body></html>` }));
      await page.goto('http://127.0.0.1:5173/__payout_audit', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Review', exact: true }).click({ timeout: 10000 }).catch(async error => {
        throw new Error(`${error.message}; ${JSON.stringify({ errors, body: await page.locator('body').innerText() })}`);
      });
      await page.getByLabel('Decision').selectOption('HELD');
      await page.getByLabel('Reason', { exact: true }).fill('Verify destination');
      await page.getByRole('button', { name: 'Save decision' }).click();
      await page.getByRole('button', { name: 'Review', exact: true }).click();
      await page.getByLabel('Decision').selectOption('APPROVED');
      await page.getByRole('button', { name: 'Save decision' }).click();
      await page.getByRole('button', { name: 'Review', exact: true }).click();
      await page.getByLabel('Payment reference', { exact: true }).fill('PAYPAL-TEST-123');
      await page.getByRole('button', { name: 'Save decision' }).click();
      if (changes.length !== 2) throw new Error('Recorded payment without confirmation');
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Save decision' }).click();
      await page.getByRole('button', { name: 'Review', exact: true }).click();
      await page.getByText('PAYPAL-TEST-123', { exact: true }).waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      await page.screenshot({ path: path.join(out, `payout-review-${viewport.width}.png`), fullPage: true });
      console.log(JSON.stringify({ viewport, overflow, errors, transitions: changes.map(row => row.status) }));
      if (overflow || errors.length || changes.map(row => row.status).join(',') !== 'HELD,APPROVED,PAID') process.exitCode = 1;
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
