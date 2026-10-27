// Prueba de humo: abre cada sistema, deja correr la simulación, recoge errores y captura pantallas.
const { chromium } = require('playwright');
const path = require('path');
const base = process.argv[2] || 'http://localhost:8765/index.html';
const only = process.argv[3] ? process.argv[3].split(',') : null;
const systems = ['otto', 'diesel', '2t', 'wankel', 'car', 'electric', 'turbofan', 'steam', 'stirling', 'planetary', 'differential'];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  for (const s of (only || systems)) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${s}][${m.type()}] ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`[${s}][pageerror] ` + e.message));
    const before = errors.length;
    await page.goto(`${base}#s=${s}${process.env.EXTRA || ''}`);
    await page.waitForFunction(() => window.app && window.app.main, null, { timeout: 30000 });
    await page.waitForTimeout(4000);
    if (s === 'car') { await page.keyboard.down('KeyW'); await page.waitForTimeout(3500); await page.keyboard.up('KeyW'); }
    await page.screenshot({ path: path.join(__dirname, 'screens', `${s}.png`) });
    await page.click('[data-tab="charts"]');
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(__dirname, 'screens', `${s}-charts.png`) });
    await page.click('[data-tab="data"]');
    const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); function f() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n); } requestAnimationFrame(f); }));
    console.log(s, 'fps', fps, 'errores nuevos', errors.length - before);
    await page.close();
  }
  console.log(errors.slice(0, 40).join('\n'));
  await browser.close();
})();
