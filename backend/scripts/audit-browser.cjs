const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(path.join(process.env.TEMP, 'ils-audit-tools/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const out = path.resolve(__dirname, '../../tmp/scope-audit');
  fs.mkdirSync(out, { recursive: true });
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      // Visual smoke test only: no production database or payment calls.
      await page.route('**/api/**', route => route.fulfill({
        status: route.request().url().includes('/auth/me') ? 401 : 200,
        contentType: 'application/json', body: JSON.stringify({ status: 'success', data: {} }),
      }));
      await page.goto('http://localhost:5173/admin/login', { waitUntil: 'networkidle' });
      await page.locator('input[type="password"]').waitFor();
      const quickFillCount = await page.getByText('Quick Fill', { exact: true }).count();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      await page.screenshot({ path: path.join(out, `admin-login-${viewport.width}.png`), fullPage: true });
      console.log(JSON.stringify({ viewport, quickFillCount, overflow, errors }));
      if (quickFillCount || overflow || errors.length) process.exitCode = 1;
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
