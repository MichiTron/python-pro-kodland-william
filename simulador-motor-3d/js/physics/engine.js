// Simulación en tiempo real de un motor de combustión interna completo.
// Une el ciclo termodinámico (cycle.js) con la dinámica del cigüeñal, el colector de
// admisión, el turbocompresor, la ECU (avance, mezcla y ralentí) y la fricción.

import { computeCycle, fmepChenFlynn, orificeFlow, P_ATM, T_ATM, R_AIR, FUELS } from './cycle.js';

const TAU = Math.PI * 2;

export const ENGINE_PRESETS = {
  otto: {
    kind: 'otto', cylinders: 4, bore: 86, stroke: 86, rod: 143, cr: 10.5, fuel: 'gasolina95',
    camDuration: 248, turbo: false, boostTarget: 0.8, intercooler: true, flywheel: 0.12,
    redline: 6800, idleRpm: 850, ecu: true, lambda: 1.0, timing: 20, pistonMass: 0.42,
  },
  diesel: {
    kind: 'diesel', cylinders: 4, bore: 81, stroke: 95.5, rod: 145, cr: 16.5, fuel: 'diesel',
    camDuration: 236, turbo: true, boostTarget: 1.3, intercooler: true, flywheel: 0.22,
    redline: 4600, idleRpm: 800, ecu: true, lambda: 1.6, timing: 8, pistonMass: 0.62,
  },
  '2t': {
    kind: '2t', cylinders: 1, bore: 54, stroke: 54.5, rod: 110, cr: 7.2, fuel: 'gasolina95',
    camDuration: 250, turbo: false, boostTarget: 0, intercooler: false, flywheel: 0.012,
    redline: 11500, idleRpm: 1600, ecu: true, lambda: 0.9, timing: 18, pistonMass: 0.15,
    portOpen: 86, portClose: 86, tunedRpm: 8500,
  },
  wankel: {
    kind: 'wankel', rotors: 2, faceDisplacement: 654, cr: 9.7, fuel: 'gasolina98',
    camDuration: 260, turbo: false, boostTarget: 0.7, intercooler: true, flywheel: 0.10,
    redline: 9000, idleRpm: 900, ecu: true, lambda: 1.0, timing: 15, eccentricity: 15, rotorRadius: 105, rotorWidth: 80,
  },
};

const FIRING = {
  1: [0], 2: [0, 1], 3: [0, 2, 1], 4: [0, 2, 3, 1], 5: [0, 1, 3, 4, 2], 6: [0, 4, 2, 5, 1, 3], 8: [0, 7, 3, 2, 5, 4, 6, 1],
};

export function firingIndex(n) {
  // devuelve, para cada cilindro i, su posición en el orden de encendido
  const order = FIRING[n] || Array.from({ length: n }, (_, i) => i);
  const idx = new Array(n);
  order.forEach((cyl, k) => { idx[cyl] = k; });
  return idx;
}

export function firingOrderText(n) {
  const order = FIRING[n] || Array.from({ length: n }, (_, i) => i);
  return order.map((c) => c + 1).join('-');
}

function smooth01(x) { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); }

export class CombustionEngine {
  constructor(params = {}) {
    const kind = params.kind || 'otto';
    this.p = { ...ENGINE_PRESETS[kind], ...params };
    this.theta = 0;          // ángulo del eje (rad, acumulado)
    this.omega = 0;          // rad/s
    this.ignition = false;
    this.starter = 0;        // segundos restantes de motor de arranque
    this.throttle = 0;
    this.pMan = P_ATM;
    this.boost = 0;          // sobrepresión real del turbo (Pa)
    this.turboRpm = 0;
    this.idleBypass = 0.02;
    this.idleI = 0;
    this.fuelCut = false;
    this.fuelUsed = 0;
    this.time = 0;
    this.health = 1;
    this.seized = false;
    this.lastEgt = 900;
    this.loadTorque = 0;
    this.instTorque = 0;
    this.torqueTrace = [];
    this.mbtCache = new Map();
    this.version = 0;
    this.rebuild();
    this.cycle = this.evalCycle(this.opAt(800, P_ATM, 1.0, 10, false));
  }

  setParam(key, value) {
    this.p[key] = value;
    this.rebuild();
  }

  rebuild() {
    const p = this.p;
    this.version++;
    this.mbtCache.clear();
    this.curveCache = null;
    const wankel = p.kind === 'wankel';
    const two = p.kind === '2t';
    if (wankel) {
      this.nUnits = p.rotors * 3;
      const e = p.eccentricity / 1000;
      this.cfg = {
        volumeLaw: 'sine', faceDisplacement: p.faceDisplacement * 1e-6, cr: p.cr, equivBore: 0.09,
        areaMult: 2.1, htMult: 1.0, strokes: 4, shaftPerCycle: 1.5, ivc: 55, evo: 75,
        combustion: 'otto', meanPistonSpeedFactor: 0.00145 * (e / 0.015), wallTemp: 450, burnMult: 1.25,
      };
      this.revsPerCycle = 3;
      this.unitOffsets = [];
      for (let r = 0; r < p.rotors; r++) for (let f = 0; f < 3; f++) this.unitOffsets.push(-(f * 360 + r * 180) / 1.5);
    } else {
      const n = p.cylinders;
      const bore = p.bore / 1000, stroke = p.stroke / 1000;
      const ivc = Math.round((p.camDuration - 180) * 0.62 + 6);
      const evo = Math.round((p.camDuration - 180) * 0.62 + 12);
      this.cfg = {
        bore, stroke, rod: p.rod / 1000, cr: p.cr, strokes: two ? 2 : 4, ivc, evo,
        portOpen: p.portOpen || 86, portClose: p.portClose || 86,
        combustion: p.kind === 'diesel' ? 'diesel' : 'otto', wallTemp: p.kind === 'diesel' ? 470 : 430,
        htMult: two ? 1.15 : 1, burnMult: two ? 1.1 : 1,
      };
      this.revsPerCycle = two ? 1 : 2;
      const fi = firingIndex(n);
      const span = two ? 360 : 720;
      this.unitOffsets = fi.map((k) => -k * span / n);
      this.nUnits = n;
    }
    this.cycleSpan = two ? 360 : 720;
    this.half = this.cycleSpan / 2;
    const g = this.unitDisplacement();
    this.Vd = g * this.nUnits;
    // diámetro de la mariposa proporcional a la cilindrada
    const dispL = (wankel ? this.Vd * 2 : this.Vd) * 1000;
    this.throttleArea = Math.PI * Math.pow(0.034 * Math.sqrt(dispL / 2) + 0.012, 2) / 4 * (two ? 1.4 : 1);
    this.J = p.flywheel + 0.03 * this.nUnits / 4;
  }

  unitDisplacement() {
    if (this.p.kind === 'wankel') return this.p.faceDisplacement * 1e-6;
    return Math.PI * Math.pow(this.p.bore / 1000, 2) / 4 * this.p.stroke / 1000;
  }

  get rpm() { return this.omega * 60 / TAU; }
  get fuel() { return FUELS[this.p.fuel] || FUELS.gasolina95; }
  get isDiesel() { return this.p.kind === 'diesel'; }

  meanPistonSpeed(rpm) {
    if (this.p.kind === 'wankel') return this.cfg.meanPistonSpeedFactor * rpm;
    return 2 * this.p.stroke / 1000 * rpm / 60;
  }

  // Rendimiento volumétrico según régimen y perfil de levas (o escape resonante en 2T)
  volumetricEfficiency(rpm) {
    const p = this.p;
    if (p.kind === '2t') {
      const rt = p.tunedRpm || 8000;
      const x = (rpm - rt) / rt;
      return Math.max(0.25, 0.86 * (1 - (x < 0 ? 1.3 : 2.2) * x * x));
    }
    if (p.kind === 'wankel') {
      const x = (rpm - 6200) / 6200;
      return Math.max(0.45, 0.9 * (1 - 0.3 * x * x));
    }
    const cam = p.camDuration;
    const rt = 1500 + (cam - 200) * 48;
    const kLow = 0.08 + Math.max(0, cam - 220) * 0.0045;
    const kHigh = Math.max(0.12, 0.34 - (cam - 220) * 0.003);
    const x = (rpm - rt) / rt;
    const vmax = p.kind === 'diesel' ? 0.92 : 0.94;
    return Math.max(0.42, vmax * (1 - (x < 0 ? kLow : kHigh) * x * x));
  }

  // Temperatura y presión antes del colector (compresor + intercooler)
  upstream(boostPa) {
    const PR = (P_ATM + boostPa) / P_ATM;
    const etaC = 0.72;
    const Tc = T_ATM * (1 + (Math.pow(PR, 0.2857) - 1) / etaC);
    const eff = this.p.intercooler ? 0.75 : 0;
    return { P: P_ATM + boostPa, T: Tc - (Tc - T_ATM) * eff };
  }

  airDemand(pMan, Tman, rpm) {
    return this.volumetricEfficiency(rpm) * pMan / (R_AIR * Tman) * this.Vd * (rpm / 60) / this.revsPerCycle;
  }

  solveManifold(throttleEff, rpm, up) {
    if (this.isDiesel) return up.P * (1 - 0.02 * (rpm / 4000) * (rpm / 4000));
    const A = this.throttleArea * (0.004 + (1 - Math.cos(Math.min(1, throttleEff) * Math.PI / 2)));
    let lo = 0.08 * up.P, hi = up.P;
    for (let i = 0; i < 40; i++) {
      const mid = 0.5 * (lo + hi);
      const flow = orificeFlow(0.82, A, up.P, up.T, mid);
      const demand = this.airDemand(mid, up.T, Math.max(rpm, 60));
      if (flow > demand) lo = mid; else hi = mid;
    }
    return 0.5 * (lo + hi);
  }

  ecuLambda(load, boostBar) {
    const p = this.p;
    if (!p.ecu) return p.lambda;
    if (p.kind === '2t') return 0.88;
    let l = 1.0;
    if (load > 0.85) l = 0.9;
    if (boostBar > 0.3) l = 0.82;
    if (p.fuel === 'e85') l -= 0.02;
    return l;
  }

  opAt(rpm, pMan, lambdaOrPhi, timing, ignition, Tman = T_ATM + 12, extra = {}) {
    const ve = this.volumetricEfficiency(rpm);
    const mAir = ve * pMan * this.unitDisplacement() / (R_AIR * Tman);
    const Pexh = P_ATM * (1.02 + 0.1 * Math.pow(rpm / (this.p.redline || 6000), 2) * (pMan / P_ATM)) + 0.7 * this.boost;
    const Vc = this.unitDisplacement() / (this.p.cr - 1);
    const Tres = Math.max(700, Math.min(1300, this.lastEgt));
    let mRes = Pexh * Vc / (R_AIR * Tres);
    if (this.p.kind === '2t') mRes += 0.12 * mAir;
    const Tivc = ((Tman + 15) * mAir + Tres * 0.85 * mRes) / (mAir + mRes);
    const op = {
      rpm, mAir, mRes, Tivc, Pman: pMan, Pexh, timing, ignition, fuel: this.p.fuel, fuelCut: extra.fuelCut || false,
    };
    if (this.isDiesel) op.phi = lambdaOrPhi; else op.lambda = lambdaOrPhi;
    return op;
  }

  evalCycle(op) { return computeCycle(this.cfg, op); }

  // Avance óptimo (MBT) limitado por detonación, memorizado por zona de funcionamiento
  optimalTiming(rpm, pMan, mix, Tman) {
    const key = `${Math.round(rpm / 200)}|${Math.round(pMan / 4000)}|${mix.toFixed(2)}|${Math.round(Tman / 10)}`;
    const hit = this.mbtCache.get(key);
    if (hit !== undefined) return hit;
    const r = Math.round(rpm / 200) * 200 || 200;
    const pm = Math.round(pMan / 4000) * 4000;
    const f = (t) => this.evalCycle(this.opAt(r, pm, mix, t, true, Tman));
    const lo0 = this.isDiesel ? -4 : 0, hi0 = this.isDiesel ? 30 : 50;
    let best = lo0, bestW = -Infinity;
    for (let t = lo0; t <= hi0; t += 8) { const c = f(t); if (c.imep > bestW) { bestW = c.imep; best = t; } }
    let a = Math.max(lo0, best - 8), b = Math.min(hi0, best + 8);
    let m1 = a + (b - a) * 0.382, m2 = a + (b - a) * 0.618;
    let f1 = f(m1).imep, f2 = f(m2).imep;
    for (let i = 0; i < 5; i++) {
      if (f1 > f2) { b = m2; m2 = m1; f2 = f1; m1 = a + (b - a) * 0.382; f1 = f(m1).imep; }
      else { a = m1; m1 = m2; f1 = f2; m2 = a + (b - a) * 0.618; f2 = f(m2).imep; }
    }
    let t = (a + b) / 2;
    const mbt = t;
    let knockLimited = false;
    if (!this.isDiesel) {
      while (t > -10 && f(t).knock) { t -= 2; knockLimited = true; }
    }
    const res = { timing: t, mbt, knockLimited };
    if (this.mbtCache.size > 4000) this.mbtCache.clear();
    this.mbtCache.set(key, res);
    return res;
  }

  dieselPhi(throttle) {
    return 0.06 + 0.72 * Math.pow(Math.max(0, Math.min(1, throttle)), 1.15);
  }

  startCrank() { if (!this.seized) { this.ignition = true; this.starter = 2.0; } }
  stop() { this.ignition = false; this.starter = 0; }
  repair() { this.health = 1; this.seized = false; }

  // Se llama una vez por fotograma: actualiza colector, turbo, ECU y recalcula el ciclo.
  prepare(dt, throttle) {
    const p = this.p;
    this.throttle = throttle;
    this.time += dt;
    const rpm = Math.max(this.rpm, 0);
    if (this.starter > 0) this.starter = rpm > Math.max(450, p.idleRpm * 0.6) && this.ignition && this.time > 0.3 ? 0 : this.starter - dt;

    // Limitador de revoluciones
    if (rpm > p.redline + 60) this.fuelCut = true;
    else if (rpm < p.redline - 120) this.fuelCut = false;

    // Turbo: el gasto de escape determina la sobrepresión disponible (con retraso)
    let boostAvail = 0;
    if (p.turbo) {
      const exhFlow = this.airDemand(this.pMan, T_ATM, Math.max(rpm, 1)) * (this.lastEgt / 900);
      const full = this.airDemand(P_ATM * 1.6, T_ATM, p.redline * 0.55);
      const minF = full * 0.22;
      const load = this.isDiesel ? Math.min(1, 0.25 + throttle) : throttle;
      boostAvail = p.boostTarget * 1e5 * smooth01((exhFlow - minF) / (full - minF)) * smooth01(load * 1.3);
      if (!this.ignition) boostAvail = 0;
    }
    const tauT = boostAvail > this.boost ? 0.9 : 0.35;
    this.boost += (boostAvail - this.boost) * Math.min(1, dt / tauT);
    this.turboRpm = p.turbo ? 190000 * Math.sqrt(Math.max(0, this.boost / 1e5) / Math.max(0.3, p.boostTarget)) * Math.min(1, 0.3 + rpm / 5000) : 0;
    const up = this.upstream(this.boost);

    // Control de ralentí (ECU)
    let thrEff = throttle;
    if (!this.isDiesel) {
      if (p.ecu && this.ignition) {
        const err = (p.idleRpm - rpm) / p.idleRpm;
        this.idleI = Math.max(-0.05, Math.min(0.12, this.idleI + err * dt * 0.25));
        this.idleBypass = Math.max(0, Math.min(0.16, 0.035 + err * 0.12 + this.idleI));
        if (rpm < 300) this.idleBypass = 0.08;
      } else this.idleBypass = p.kind === '2t' ? 0.05 : 0.03;
      thrEff = Math.max(throttle, this.idleBypass);
    }
    const pSteady = this.solveManifold(thrEff, Math.max(rpm, 80), up);
    this.pMan += (pSteady - this.pMan) * Math.min(1, dt / 0.06);
    this.Tman = up.T;

    // Mezcla y avance
    const load = this.pMan / P_ATM;
    let mix;
    if (this.isDiesel) {
      let thr = throttle;
      if (p.ecu && this.ignition) {
        const err = (p.idleRpm - rpm) / p.idleRpm;
        this.idleI = Math.max(-0.03, Math.min(0.1, this.idleI + err * dt * 0.3));
        thr = Math.max(throttle, Math.min(0.25, 0.03 + err * 0.25 + this.idleI));
      }
      mix = this.dieselPhi(thr);
      if (p.ecu) mix = Math.min(mix, 0.8 * Math.min(1, 0.55 + 0.45 * load)); // límite de humos
      if (!p.ecu) mix = this.dieselPhi(throttle) * (p.lambda > 0 ? 1.6 / p.lambda : 1);
    } else {
      mix = this.ecuLambda(throttle > 0.9 ? 1 : load, this.boost / 1e5);
    }
    let timing = p.timing;
    this.mbtInfo = null;
    if (p.ecu && this.ignition) {
      this.mbtInfo = this.optimalTiming(Math.max(rpm, 200), this.pMan, mix, up.T);
      timing = this.mbtInfo.timing;
      // en ralentí la ECU retrasa el encendido para tener reserva de par
      if (throttle < 0.02 && rpm < p.idleRpm + 500 && !this.isDiesel) timing -= 6;
    }
    this.currentTiming = timing;
    this.currentMix = mix;
    const op = this.opAt(Math.max(rpm, 30), this.pMan, mix, timing, this.ignition && !this.seized, up.T, { fuelCut: this.fuelCut });
    this.cycle = this.evalCycle(op);
    if (this.cycle.Qtotal > 0 && !this.cycle.misfire) this.lastEgt += (this.cycle.egt - this.lastEgt) * Math.min(1, dt / 0.5);
    else this.lastEgt += (650 - this.lastEgt) * Math.min(1, dt / 3);

    // Fricción y consumo
    this.prepOmega = this.omega;
    const Sp = this.meanPistonSpeed(rpm);
    this.fmep = fmepChenFlynn(this.cycle.Pmax, Sp, p.kind === 'wankel' ? 1.25 : p.kind === '2t' ? 0.8 : 1);
    // fricción interna + accesorios (alternador, bomba de agua y de aceite)
    this.accessoryTorque = p.kind === '2t' ? 0.3 : 4 + 2.5 * this.Vd * 1000;
    this.frictionTorque = this.fmep * this.Vd / (TAU * this.revsPerCycle) + this.accessoryTorque;
    this.indicatedTorque = this.nUnits * this.cycle.Wnet / (TAU * this.revsPerCycle);
    this.brakeTorque = this.indicatedTorque - this.frictionTorque;
    const cyclesPerSec = rpm / 60 / this.revsPerCycle;
    const fuelLost = p.kind === '2t' ? 1.3 : 1; // en 2T parte de la mezcla escapa sin quemar
    this.fuelRate = this.ignition && !this.fuelCut && !this.seized ? this.cycle.mFuel * this.nUnits * cyclesPerSec * fuelLost : 0;
    this.fuelUsed += this.fuelRate * dt;

    // Desgaste: detonación fuerte, sobrerrégimen o escape demasiado caliente
    let dmg = 0;
    if (this.cycle.knock) dmg += this.cycle.knockFraction * 0.06 * Math.min(1, load);
    if (rpm > p.redline * 1.12) dmg += 0.03;
    if (Sp > 25) dmg += 0.02;
    if (this.cycle.Pmax > 2.2e7) dmg += 0.05;
    this.health = Math.max(0, this.health - dmg * dt);
    if (this.health <= 0 && !this.seized) { this.seized = true; this.ignition = false; }
  }

  // Ángulo de ciclo (grados) de una unidad para un ángulo de eje dado
  unitCycleDeg(u, theta = this.theta) {
    const sp = this.p.kind === 'wankel' ? 1.5 : 1;
    let d = (theta * 180 / Math.PI) / sp + this.unitOffsets[u];
    d = ((d + this.half) % this.cycleSpan + this.cycleSpan) % this.cycleSpan - this.half;
    return d;
  }

  sampleTable(arr, deg) {
    const x = deg + this.half;
    const i0 = Math.floor(x);
    const f = x - i0;
    const N = arr.length;
    const a = arr[((i0 % N) + N) % N], b = arr[(((i0 + 1) % N) + N) % N];
    return a + (b - a) * f;
  }

  gasTorqueAt(theta) {
    let T = 0;
    for (let u = 0; u < this.nUnits; u++) T += this.sampleTable(this.cycle.torque, this.unitCycleDeg(u, theta));
    return T;
  }

  inertiaTorqueAt(theta, omega) {
    if (this.p.kind === 'wankel') return 0;
    const a = this.p.stroke / 2000, L = this.p.rod / 1000;
    const m = this.p.pistonMass + 0.2;
    let s = 0;
    for (let u = 0; u < this.nUnits; u++) {
      const th = this.unitCycleDeg(u, theta) * Math.PI / 180;
      s += (a / (4 * L)) * Math.sin(th) - 0.5 * Math.sin(2 * th) - (3 * a / (4 * L)) * Math.sin(3 * th);
    }
    return m * a * a * omega * omega * s;
  }

  // Integra la dinámica del cigüeñal durante h segundos con un par resistente externo
  substep(h, Tload) {
    if (this.seized) { this.omega = Math.max(0, this.omega - 400 * h); this.theta += this.omega * h; this.instTorque = 0; return; }
    const Tgas = this.gasTorqueAt(this.theta);
    const Tin = this.inertiaTorqueAt(this.theta, this.omega);
    const rpm = this.rpm;
    const Tst = this.starter > 0 ? 110 * Math.max(0, 1 - rpm / 420) : 0;
    const Tf = this.frictionTorque * Math.tanh(this.omega / 4);
    this.instTorque = Tgas + Tin;
    this.loadTorque = Tload;
    this.omega += (Tgas + Tin + Tst - Tf - Tload) / this.J * h;
    if (this.omega < 0) this.omega = 0;
    this.theta += this.omega * h;
  }

  // Integra un fotograma completo con subpasos limitados por ángulo
  advance(dt, loadFn) {
    const maxStepAngle = 2.5 * Math.PI / 180;
    const n = Math.min(600, Math.max(2, Math.ceil(Math.max(this.omega * dt / maxStepAngle, dt / 0.0015))));
    const h = dt / n;
    for (let i = 0; i < n; i++) this.substep(h, loadFn ? loadFn(this.omega) : 0);
  }

  // Curva de par y potencia a plena carga (banco de pruebas virtual)
  // Calcula la curva poco a poco (presupuesto en ms por llamada) para no bloquear la interfaz.
  wotCurve(budgetMs = Infinity) {
    if (this.curveCache && this.curveCache.done) return this.curveCache;
    const p = this.p;
    if (!this.curveCache) {
      const start = p.kind === '2t' ? 3000 : 1000;
      const step = Math.max(250, Math.round((p.redline - start) / 20 / 50) * 50);
      const list = [];
      for (let r = start; r <= p.redline + 1; r += step) list.push(r);
      this.curveCache = { rpms: [], torque: [], power: [], bsfc: [], pending: list, done: false };
    }
    const cc = this.curveCache;
    const { rpms, torque, power, bsfc } = cc;
    const savedBoost = this.boost, savedEgt = this.lastEgt;
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    while (cc.pending.length) {
      if ((typeof performance !== 'undefined' ? performance : Date).now() - t0 > budgetMs) break;
      const r = cc.pending.shift();
      this.lastEgt = 1000;
      let boost = 0;
      if (p.turbo) {
        const full = this.airDemand(P_ATM * 1.6, T_ATM, p.redline * 0.55);
        const exh = this.airDemand(P_ATM * (1 + p.boostTarget * 0.6), T_ATM, r) * 1.1;
        boost = p.boostTarget * 1e5 * smooth01((exh - full * 0.22) / (full * 0.78));
      }
      this.boost = boost;
      const up = this.upstream(boost);
      const pm = this.solveManifold(1, r, up);
      const mix = this.isDiesel ? Math.min(this.dieselPhi(1), 0.8 * Math.min(1, 0.55 + 0.45 * pm / P_ATM)) : this.ecuLambda(1, boost / 1e5);
      const t = p.ecu ? this.optimalTiming(r, pm, mix, up.T).timing : p.timing;
      const c = this.evalCycle(this.opAt(r, pm, mix, t, true, up.T));
      const fm = fmepChenFlynn(c.Pmax, this.meanPistonSpeed(r), p.kind === 'wankel' ? 1.25 : p.kind === '2t' ? 0.8 : 1);
      const acc = p.kind === '2t' ? 0.3 : 4 + 2.5 * this.Vd * 1000;
      const Tb = (this.nUnits * c.Wnet - fm * this.Vd) / (TAU * this.revsPerCycle) - acc;
      rpms.push(r);
      torque.push(Tb);
      const Pw = Tb * r * TAU / 60;
      power.push(Pw / 1000);
      const mf = c.mFuel * this.nUnits * r / 60 / this.revsPerCycle;
      bsfc.push(Pw > 0 ? mf / Pw * 3.6e9 : 0);
    }
    this.boost = savedBoost; this.lastEgt = savedEgt;
    cc.done = cc.pending.length === 0;
    return cc;
  }

  telemetry() {
    const rpm = this.rpm;
    const c = this.cycle;
    const Pw = this.brakeTorque * (this.prepOmega ?? this.omega);
    const fuelEnergyRate = this.fuelRate * this.fuel.LHV;
    return {
      rpm, torque: this.brakeTorque, power: Pw, pMan: this.pMan, boost: this.boost, lambda: c.lambda,
      timing: this.currentTiming, imep: c.imep, bmep: this.brakeTorque * TAU * this.revsPerCycle / this.Vd,
      fmep: this.fmep, pmep: c.pmep, Pmax: c.Pmax, Tmax: c.Tmax, egt: this.lastEgt,
      ve: this.volumetricEfficiency(rpm), etaInd: c.etaInd, etaBrake: fuelEnergyRate > 0 ? Math.max(0, Pw) / fuelEnergyRate : 0,
      bsfc: Pw > 500 ? this.fuelRate / Pw * 3.6e9 : null, fuelLh: this.fuelRate / this.fuel.densidad * 3600 * 1000,
      Sp: this.meanPistonSpeed(rpm), knock: c.knock, misfire: c.misfire, misfireReason: c.misfireReason,
      nox: c.nox, co: c.co, hc: c.hc, soot: c.soot, turboRpm: this.turboRpm, health: this.health,
    };
  }
}
