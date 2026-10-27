import { CombustionEngine } from '../js/physics/engine.js';
for (const kind of ['otto','diesel','2t','wankel']) {
  const e = new CombustionEngine({kind});
  const t0=performance.now();
  const c = e.wotCurve();
  const t1=performance.now();
  console.log(kind, 'curve ms', (t1-t0).toFixed(0));
  console.log(c.rpms.map((r,i)=>`${r}:${c.torque[i].toFixed(0)}Nm/${c.power[i].toFixed(0)}kW/${c.bsfc[i].toFixed(0)}`).join(' '));
}
const e = new CombustionEngine({kind:'otto'});
const c = e.evalCycle(e.opAt(3000, 101325, 1.0, 25, true));
console.log('3000 WOT', 'imep', (c.imep/1e5).toFixed(2), 'pmax', (c.Pmax/1e5).toFixed(1), '@', c.thPmax, 'Tmax', c.Tmax.toFixed(0), 'eta', c.etaInd.toFixed(3), 'egt', c.egt.toFixed(0), 'knock', c.knock, c.knockIntegral.toFixed(2), 'pmep', (c.pmep/1e5).toFixed(2));
const c2 = e.evalCycle(e.opAt(2000, 40000, 1.0, 30, true));
console.log('2000 part', 'imep', (c2.imep/1e5).toFixed(2), 'pmep', (c2.pmep/1e5).toFixed(2), 'eta', c2.etaInd.toFixed(3));
// arranque y ralentí
e.startCrank();
let t=0;
const t0=performance.now();
for (let i=0;i<60*6;i++){ e.prepare(1/60, 0); e.advance(1/60, null); t+=1/60; if(i%30==0) console.log(t.toFixed(1),'s rpm',e.rpm.toFixed(0),'pman',(e.pMan/1000).toFixed(0),'tq',e.brakeTorque.toFixed(1),'adv',e.currentTiming?.toFixed(1)); }
for (let i=0;i<60*3;i++){ e.prepare(1/60, 1); e.advance(1/60, null); if(i%20==0) console.log('WOT rpm',e.rpm.toFixed(0)); }
console.log('sim ms per sim-second', ((performance.now()-t0)/9).toFixed(1));
