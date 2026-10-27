import { CombustionEngine } from '../js/physics/engine.js';
for (const mult of [2, 2.5, 3]) {
  for (const [cr, fuel] of [[10.5,'gasolina95'],[13,'gasolina87'],[12,'gasolina98']]) {
    const e = new CombustionEngine({kind:'otto', cr, fuel});
    e.cfg.knockMult = mult;
    let line = `mult ${mult} cr${cr} ${fuel}: `;
    for (const rpm of [1000, 2000, 3000, 4500, 6000]) {
      let lim = null;
      for (let t = 40; t >= -10; t -= 2) { const c = e.evalCycle(e.opAt(rpm, 101325, 0.9, t, true)); if (!c.knock) { lim = t; break; } }
      // mbt
      let best=-1e9, bt=0; for (let t=0;t<=45;t+=3){ const c=e.evalCycle(e.opAt(rpm,101325,0.9,t,true)); if(c.imep>best){best=c.imep;bt=t;} }
      line += `${rpm}: lim ${lim} mbt ${bt} | `;
    }
    console.log(line);
  }
}
