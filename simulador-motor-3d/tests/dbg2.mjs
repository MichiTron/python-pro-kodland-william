import { CombustionEngine } from '../js/physics/engine.js';
const e = new CombustionEngine({kind:'otto'});
for (const [rpm, pm, t] of [[850, 20000, 0],[850,20000,15],[2000,50000,30],[3000,101325,24],[6000,101325,30]]) {
  const c = e.evalCycle(e.opAt(rpm, pm, 1.0, t, true));
  console.log(rpm, pm, 't', t, 'Tevo', c.Tevo.toFixed(0), 'Pevo', (c.Pevo/1e5).toFixed(2), 'egt', c.egt.toFixed(0), 'Tmax', c.Tmax.toFixed(0), 'burnDur', c.burnDur.toFixed(0), 'qLoss/Q', (c.qLoss/c.Qtotal).toFixed(2), 'eta', c.etaInd.toFixed(3), 'Tivc', c.Tivc.toFixed(0));
}
