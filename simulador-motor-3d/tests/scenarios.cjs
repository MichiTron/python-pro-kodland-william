// Escenarios funcionales: ejecuta situaciones concretas y comprueba resultados físicos.
const { chromium } = require('playwright');
const path = require('path');
const base = 'http://127.0.0.1:8765/index.html';
const shot = (p, n) => p.screenshot({ path: path.join(__dirname, 'screens', n + '.png') });
const results = [];
function check(name, cond, info) { results.push(`${cond ? 'OK  ' : 'FALLO'} ${name} ${info || ''}`); }
async function open(browser, hash) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', (e) => results.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') results.push('CONSOLE ' + m.text()); });
  await page.goto(`${base}#${hash}`);
  await page.waitForFunction(() => window.app && window.app.main, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  return page;
}
(async () => {
  const only = process.argv[2] ? process.argv[2].split(',') : null;
  const want = (k) => !only || only.includes(k);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  if (want('car')) {
    const p = await open(browser, 's=car');
    const r = await p.evaluate(() => { const a = app; a.fastForward(1.5); a.main.values.throttle = 1; a.main.setParam('throttle', 1); a.fastForward(14); const v = a.main.vehicle; return { kmh: v.kmh, gear: v.gear, t0100: v.t0100, rpm: v.pt.rpm }; });
    check('Coche gasolina acelera', r.kmh > 110 && r.t0100 > 7 && r.t0100 < 13, JSON.stringify(r));
    await p.waitForTimeout(600); await shot(p, 'sc-car-speed');
    const r2 = await p.evaluate(() => { const a = app; a.main.values.throttle = 0; a.main.setParam('throttle', 0); a.main.values.brake = 1; a.main.setParam('brake', 1); a.fastForward(8); return { kmh: a.main.vehicle.kmh, rpm: a.main.vehicle.pt.rpm, ign: a.main.vehicle.pt.ignition }; });
    check('Coche frena sin calarse', r2.kmh < 1 && r2.rpm > 500 && r2.ign, JSON.stringify(r2));
    const r3 = await p.evaluate(() => { const a = app; a.main.values.brake = 0; a.main.setParam('brake', 0); a.main.setParam('powertrain', 'electrico'); a.fastForward(0.5); a.main.values.throttle = 1; a.main.setParam('throttle', 1); a.fastForward(10); const v = a.main.vehicle; return { kmh: v.kmh, t0100: v.t0100, soc: v.pt.soc }; });
    check('Coche eléctrico 0-100 en 4-8 s', r3.t0100 > 4 && r3.t0100 < 8, JSON.stringify(r3));
    const r4 = await p.evaluate(() => { const a = app; a.main.values.throttle = 0; a.main.setParam('throttle', 0); a.main.values.brake = 0.5; a.main.setParam('brake', 0.5); a.fastForward(1); return { Pelec: a.main.vehicle.pt.Pelec }; });
    check('Frenada regenerativa recarga', r4.Pelec < -1000, JSON.stringify(r4));
    await p.evaluate(() => app.refreshPanel());
    await p.waitForTimeout(500); await shot(p, 'sc-car-ev');
    for (const pt of ['diesel', 'wankel', 'turbo']) {
      const r5 = await p.evaluate((pt) => { const a = app; a.main.values.brake = 0; a.main.setParam('brake', 0); a.main.setParam('powertrain', pt); a.fastForward(2); a.main.values.throttle = 1; a.main.setParam('throttle', 1); a.fastForward(14); const v = a.main.vehicle; return { kmh: v.kmh, t0100: v.t0100, gear: v.gear }; }, pt);
      check(`Coche ${pt} acelera`, r5.t0100 && r5.t0100 < 14, JSON.stringify(r5));
    }
    await p.close();
  }
  if (want('knock')) {
    const p = await open(browser, 's=otto&t=charts');
    const r = await p.evaluate(() => { const a = app; a.fastForward(2); a.applyExperiment(a.main.experiments[0]); a.fastForward(3); const e = a.main.eng; return { knock: e.cycle.knock, frac: e.cycle.knockFraction, rpm: e.rpm, health: e.health, Pmax: e.cycle.Pmax / 1e5 }; });
    check('Experimento detonación detona', r.knock && r.health < 1, JSON.stringify(r));
    await p.waitForTimeout(1500); await shot(p, 'sc-knock');
    const r2 = await p.evaluate(() => { const a = app; a.main.eng.repair(); a.applyExperiment(a.main.experiments[1]); const out = []; for (const t of [0, 10, 20, 30, 40]) { a.main.setParam('timing', t); a.main.values.timing = t; a.fastForward(1.5); out.push([t, Math.round(a.main.eng.brakeTorque)]); } return out; });
    const tq = r2.map((x) => x[1]); const iMax = tq.indexOf(Math.max(...tq));
    check('Barrido de avance tiene máximo interior (MBT)', iMax > 0 && iMax < 4, JSON.stringify(r2));
    const r3 = await p.evaluate(() => { const a = app; a.main.setParam('ecu', true); a.main.values.ecu = true; a.main.values.throttle = 1; a.main.setParam('throttle', 1); a.main.values.loadMode = 'rpm'; a.main.values.loadValue = 4000; a.fastForward(3); const e = a.main.eng; return { rpm: e.rpm, tq: e.brakeTorque, kw: e.brakeTorque * e.omega / 1000, bsfc: e.telemetry().bsfc }; });
    check('Banco 4000 rpm plena carga', r3.tq > 150 && r3.tq < 230 && Math.abs(r3.rpm - 4000) < 150, JSON.stringify(r3));
    await p.close();
  }
  if (want('compare')) {
    const p = await open(browser, 's=otto&c=electric');
    await p.evaluate(() => { app.fastForward(1); });
    await p.waitForTimeout(1500); await shot(p, 'sc-compare');
    await p.close();
    const p2 = await open(browser, 's=car&c=otto');
    await p2.waitForTimeout(1500); await shot(p2, 'sc-compare-car');
    await p2.close();
  }
  if (want('slow')) {
    const p = await open(browser, 's=otto');
    await p.evaluate(() => { const a = app; a.fastForward(2); a.timeScale = 0.01; a.tsSelect.value = '0.01'; a.camera.position.set(0.25, 0.42, 0.42); a.controls.target.set(0, 0.16, 0); });
    await p.waitForTimeout(2500); await shot(p, 'sc-slow');
    await p.close();
  }
  if (want('views')) {
    for (const s of ['wankel', 'planetary', 'stirling', 'car', 'diesel', 'steam']) {
      const p = await open(browser, 's=' + s);
      await p.evaluate((s) => { const a = app; if (s === 'stirling') { a.fastForward(8); a.main.actions()[0].onClick(); } if (s === 'diesel') { a.main.values.throttle = 0.7; a.main.setParam('throttle', 0.7); } a.fastForward(s === 'steam' ? 20 : 4); }, s);
      await p.waitForTimeout(1500); await shot(p, 'v-' + s);
      if (s === 'stirling') { const r = await p.evaluate(() => ({ rpm: app.main.root && app.active.telemetry()[0].items[0].value })); check('Stirling gira a velocidad realista', r.rpm > 300 && r.rpm < 2500, JSON.stringify(r)); }
      if (s === 'steam') { const r = await p.evaluate(() => app.active.telemetry()[0].items[0].value); check('Vapor regulado cerca de 120 rpm', r > 100 && r < 140, String(r)); }
      await p.close();
    }
  }
  console.log(results.join('\n'));
  await browser.close();
})();
