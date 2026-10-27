const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errs = [];
  for (const sys of (process.argv[2] || 'otto').split(',')) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    page.on('pageerror', (e) => errs.push(sys + ' ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(sys + ' ' + m.text()); });
    await page.goto('http://127.0.0.1:8765/index.html#s=' + sys);
    await page.waitForFunction(() => window.app && window.app.main);
    await page.evaluate(() => app.fastForward(2));
    await page.click('#lessonBtn');
    const n = await page.evaluate(() => app.lesson.steps.length);
    for (let i = 1; i < n; i++) {
      await page.click('.lnext');
      await page.waitForTimeout(1300);
      if (i === 1 || i === 3) await page.screenshot({ path: path.join(__dirname, 'screens', `lesson-${sys}-${i}.png`) });
    }
    await page.click('.lnext');
    await page.click('[data-tab="learn"]');
    const q = await page.$$('.quiz');
    if (q.length) { const b = await q[0].$$('button'); await b[0].click(); }
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(__dirname, 'screens', `learn-${sys}.png`) });
    console.log(sys, 'pasos', n, 'preguntas', q.length);
    await page.close();
  }
  console.log(errs.join('\n') || 'sin errores');
  await browser.close();
})();
