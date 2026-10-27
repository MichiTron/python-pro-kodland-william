import { CombustionEngine } from '../js/physics/engine.js';
const e = new CombustionEngine({kind:'otto'});
for (const [rpm,pm] of [[200,101325],[800,68000],[800,35000],[1500,101325],[2000,101325],[4000,101325]]) {
  for (const t of [0,10,20,30]) {
    const c = e.evalCycle(e.opAt(rpm, pm, 1.0, t, true));
    process.stdout.write(`${rpm}/${pm/1000|0}kPa t${t}: K${c.knockIntegral.toFixed(2)} imep${(c.imep/1e5).toFixed(2)} | `);
  }
  console.log();
}
e.startCrank();
for (let i=0;i<240;i++){ e.prepare(1/60,0); e.advance(1/60); }
const t=e.telemetry(); console.log('rpm',t.rpm.toFixed(0),'tq',t.torque.toFixed(1),'etaInd',t.etaInd.toFixed(3),'etaB',t.etaBrake.toFixed(3),'fuelRate',e.fuelRate, 'mf', e.cycle.mFuel, 'Wnet', e.cycle.Wnet, 'timing', e.currentTiming, 'pman', e.pMan);
