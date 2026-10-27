import { ElectricMotor } from '../js/physics/electric.js';
import { Vehicle } from '../js/physics/vehicle.js';
import { CombustionEngine } from '../js/physics/engine.js';
import { Turbofan } from '../js/physics/turbine.js';
import { SteamEngine } from '../js/physics/steam.js';
import { StirlingEngine } from '../js/physics/stirling.js';
import { planetarySpeeds, differentialState } from '../js/physics/mechanisms.js';
const m = new ElectricMotor();
const c = m.curve();
console.log('EV', c.rpms.filter((_,i)=>i%5==0).map((r,i)=>`${r.toFixed(0)}:${c.torque[i*5].toFixed(0)}/${c.power[i*5].toFixed(0)}kW`).join(' '));
const ev = new Vehicle(new ElectricMotor());
ev.throttle=1; let t=0; while(ev.kmh<100 && t<20){ev.step(1/60); t+=1/60;} console.log('EV 0-100', t.toFixed(2), 'eff', ev.pt.efficiency.toFixed(3));
for (const kind of ['otto','diesel']) {
const e = new CombustionEngine({kind}); e.startCrank();
for(let i=0;i<120;i++){e.prepare(1/60,0); e.advance(1/60);}
const car = new Vehicle(e); car.throttle=1; t=0; let log=[];
while(car.kmh<100 && t<30){car.step(1/60); t+=1/60; if(Math.round(t*60)%30==0) log.push(`${t.toFixed(1)}s g${car.gear} ${e.rpm.toFixed(0)}rpm ${car.kmh.toFixed(0)}kmh c${car.clutch.toFixed(2)}`);}
console.log(kind,'0-100', t.toFixed(2)); console.log(log.join(' | '));
car.throttle=0.25; for(let i=0;i<60*30;i++) car.step(1/60);
console.log('cruise', car.kmh.toFixed(0),'kmh gear', car.gear, 'rpm', e.rpm.toFixed(0), 'L/100', car.consumption()?.toFixed(1));
}
const tf = new Turbofan(); tf.start(); tf.throttle=1; for(let i=0;i<60*20;i++) tf.advance(1/60);
const s=tf.state; console.log('TF thrust kN', (s.thrust/1000).toFixed(1), 'tsfc g/kNs', (s.tsfc).toFixed(1), 'm', s.mTot.toFixed(0), 'T04',s.T04.toFixed(0),'T05', s.T05.toFixed(0), 'V9', s.V9.toFixed(0), 'V19', s.V19.toFixed(0), 'etaTh', s.etaTh.toFixed(2));
tf.setParam('altitude', 11000); tf.setParam('mach', 0.8); for(let i=0;i<60*5;i++) tf.advance(1/60);
const s2=tf.state; console.log('cruise thrust kN', (s2.thrust/1000).toFixed(1), 'tsfc', s2.tsfc.toFixed(1), 'etaP', s2.etaP.toFixed(2),'etaTh', s2.etaTh.toFixed(2));
const st = new SteamEngine(); st.running=true; st.omega=1; for(let i=0;i<60*40;i++) st.advance(1/60);
console.log('steam rpm', st.rpm.toFixed(1), 'reg', st.regulator.toFixed(2), JSON.stringify(st.telemetry()));
const sl = new StirlingEngine(); sl.omega=5; for(let i=0;i<60*30;i++) sl.advance(1/60);
console.log('stirling rpm', sl.rpm.toFixed(0), JSON.stringify(sl.telemetry()));
console.log(planetarySpeeds(30,78,'reductora',1000), differentialState({speed:40,radius:20,track:1.55,mode:'abierto',muLeft:0.1,muRight:0.9,torque:1200,bias:3}));
