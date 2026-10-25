const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(path.join(process.env.TEMP, 'ils-audit-tools/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--disable-features=LocalNetworkAccessChecks'] });
  const output = path.resolve(__dirname, '../../tmp/product-performance');
  fs.mkdirSync(output, { recursive: true });
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
      await context.route('**/api/**', route => {
        const request = route.request();
        const readOnlyBatch = request.method() === 'POST' && new URL(request.url()).pathname === '/api/products/batch';
        return ['GET', 'HEAD', 'OPTIONS'].includes(request.method()) || readOnlyBatch
          ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(60000);
      const errors = [];
      const failed = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('requestfailed', r => failed.push({ url: r.url(), error: r.failure()?.errorText }));
      const started = Date.now();
      await page.goto('https://ilovesurprises.com/', { waitUntil: 'commit', timeout: 60000 });
      const card = page.locator('[aria-label^="View product details for"]').first();
      await card.waitFor();
      const homeReadyMs = Date.now() - started;
      const label = await card.getAttribute('aria-label');
      const productName = label.replace('View product details for ', '');
      const clicked = Date.now();
      await card.click();
      await page.locator('h1').filter({ hasText: productName }).waitFor();
      const clickToTitleMs = Date.now() - clicked;
      const hero = page.locator('img[loading="eager"]').filter({ visible: true }).first();
      await hero.waitFor();
      await hero.evaluate(img => img.complete ? Promise.resolve() : new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 15000);
      }));
      const imageLoaded = await hero.evaluate(img => img.complete && img.naturalWidth > 0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(output, `live-product-${viewport.width}.png`) });
      console.log(JSON.stringify({ viewport, productName, homeReadyMs, clickToTitleMs,
        url: page.url(), imageLoaded, overflow, errors, failed }));
      if (errors.length || !imageLoaded) process.exitCode = 1;
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
