const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('console', (m) => console.log('console', m.type(), m.text()));
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  page.on('requestfailed', (r) => console.log('reqfail', r.url()));
  page.on('response', (r) => { if (r.status() >= 400) console.log('http', r.status(), r.url()); });
  await page.goto('http://127.0.0.1:8765/index.html#s=' + (process.argv[2] || 'car'));
  await page.waitForTimeout(4000);
  console.log('app?', await page.evaluate(() => !!window.app));
  await browser.close();
})();
