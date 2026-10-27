const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => console.log('ERR', e.message));
  for (const s of (process.argv[2] || 'otto').split(',')) {
    await page.goto(`http://127.0.0.1:8765/index.html#s=${s}`);
    await page.evaluate(() => location.reload());
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => {
      const a = window.app; const out = {};
      let t0 = performance.now(); for (let i = 0; i < 20; i++) a.main.update(1 / 60); out.update = (performance.now() - t0) / 20;
      t0 = performance.now(); for (let i = 0; i < 5; i++) a.renderer.render(a.scene, a.camera); out.render = (performance.now() - t0) / 5;
      t0 = performance.now(); for (let i = 0; i < 5; i++) a.data.update(a.main.telemetry()); out.tele = (performance.now() - t0) / 5;
      t0 = performance.now(); a.chartsPanel.setCharts(a.main.charts()); a.showTab('charts'); a.chartsPanel.setCharts(a.main.charts()); a.chartsPanel.draw(); out.charts = performance.now() - t0;
      t0 = performance.now(); a.drawHud(); a.drawPhase(); out.hud = performance.now() - t0;
      out.calls = a.renderer.info.render.calls; out.tris = a.renderer.info.render.triangles;
      return out;
    });
    console.log(s, JSON.stringify(r, (k, v) => typeof v === 'number' ? Math.round(v * 10) / 10 : v));
  }
  await browser.close();
})();
