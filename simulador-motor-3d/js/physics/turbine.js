// Turbofán de dos ejes con ciclo Brayton real (rendimientos de componentes),
// atmósfera estándar ISA, mezcla de flujos separada y postcombustión opcional.

export const TURBOFAN_PRESET = {
  bypass: 5, fanPR: 1.6, opr: 30, tit: 1600, eta_c: 0.86, eta_t: 0.9, altitude: 0, mach: 0,
  afterburner: false, diameter: 1.8, throttle: 0.0, running: false,
};

const cp = 1005, gam = 1.4, cph = 1150, gh = 1.33, LHV = 43e6, Rg = 287;

export function isa(hm) {
  const h = Math.min(hm, 20000);
  if (h <= 11000) {
    const T = 288.15 - 0.0065 * h;
    return { T, P: 101325 * Math.pow(T / 288.15, 5.2559) };
  }
  const T = 216.65;
  return { T, P: 22632 * Math.exp(-9.81 * (h - 11000) / (Rg * T)) };
}

export class Turbofan {
  constructor(params = {}) {
    this.p = { ...TURBOFAN_PRESET, ...params };
    this.n2 = 0;      // velocidad relativa del eje de alta (0..1.05)
    this.n1 = 0;
    this.theta1 = 0; this.theta2 = 0;
    this.throttle = 0;
    this.running = false;
    this.starter = 0;
    this.fuelUsed = 0;
    this.time = 0;
    this.state = this.cycle(0.0);
  }
  setParam(k, v) { this.p[k] = v; }
  start() { this.running = true; this.starter = 6; }
  stop() { this.running = false; }

  // Calcula el ciclo para una velocidad relativa de eje n
  cycle(n) {
    const p = this.p;
    const amb = isa(p.altitude);
    const V0 = p.mach * Math.sqrt(gam * Rg * amb.T);
    const T02 = amb.T * (1 + 0.2 * p.mach * p.mach);
    const P02 = amb.P * Math.pow(1 + 0.97 * 0.2 * p.mach * p.mach, 3.5);
    const nn = Math.max(0, n);
    const opr = 1 + (p.opr - 1) * Math.pow(nn, 2.2);
    const fpr = 1 + (p.fanPR - 1) * Math.pow(nn, 2.0);
    const lit = this.running ? 1 : 0;
    const T04 = lit ? Math.max(T02 * Math.pow(opr, 0.2857) + 200, 700 + (p.tit - 700) * Math.pow(nn, 1.6)) : 0;
    // gasto másico de aire por el fan (proporcional a densidad y velocidad del eje)
    const A = Math.PI * Math.pow(p.diameter / 2, 2) * 0.85;
    const rho2 = P02 / (Rg * T02);
    const Vax = 165 * nn;
    const mTot = rho2 * A * Vax;
    const mCore = mTot / (1 + p.bypass);
    const mBy = mTot - mCore;
    // fan
    const T13 = T02 * (1 + (Math.pow(fpr, 0.2857) - 1) / p.eta_c);
    const P13 = P02 * fpr;
    // compresor (núcleo)
    const T03 = T02 * (1 + (Math.pow(opr, 0.2857) - 1) / p.eta_c);
    const P03 = P02 * opr;
    let f = 0, T05 = T03, P05 = P03, T045 = T03, V9 = 0, V19 = 0, T09 = T03;
    if (lit && T04 > T03) {
      f = (cph * T04 - cp * T03) / (0.99 * LHV - cph * T04);
      const P04 = P03 * 0.96;
      // la turbina de alta mueve el compresor y la de baja mueve el fan
      const wHP = cp * (T03 - T13);
      const wLP = (1 + p.bypass) * cp * (T13 - T02);
      T045 = T04 - wHP / (cph * (1 + f));
      T05 = T045 - wLP / (cph * (1 + f));
      const t5s = T04 - (T04 - T05) / p.eta_t;
      P05 = P04 * Math.pow(Math.max(0.01, t5s / T04), gh / (gh - 1));
      if (T05 < 300 || P05 < amb.P) { T05 = Math.max(T05, 300); P05 = Math.max(P05, amb.P * 1.01); }
    }
    let fAB = 0;
    T09 = T05;
    if (lit && p.afterburner && nn > 0.75) {
      const Tab = 2000;
      fAB = (cph * (Tab - T05)) / (0.92 * LHV) * (1 + f);
      T09 = Tab; P05 *= 0.95;
    }
    const nozzle = (Tt, Pt, g, c) => {
      const pr = Math.min(1, amb.P / Pt);
      return Math.sqrt(Math.max(0, 2 * c * Tt * 0.98 * (1 - Math.pow(pr, (g - 1) / g))));
    };
    V9 = lit ? nozzle(T09, P05, gh, cph) : nozzle(T03, P03, gam, cp) * 0.3;
    V19 = nozzle(T13, P13, gam, cp);
    const mf = mCore * (f + fAB);
    const Fcore = mCore * (1 + f + fAB) * V9 - mCore * V0;
    const Fby = mBy * V19 - mBy * V0;
    const thrust = Math.max(0, Fcore + Fby);
    const Pjet = 0.5 * (mCore * (1 + f + fAB) * (V9 * V9) + mBy * V19 * V19 - mTot * V0 * V0);
    const etaTh = mf > 0 ? Pjet / (mf * LHV) : 0;
    const etaP = Pjet > 0 && V0 > 1 ? thrust * V0 / Pjet : 0;
    return {
      amb, V0, T02, P02, T13, P13, T03, P03, T04, T045, T05, P05, T09, V9, V19, f, fAB, mTot, mCore, mBy, mf,
      thrust, tsfc: thrust > 1 ? mf / thrust * 1e6 : 0, etaTh, etaP, opr, fpr, lit,
    };
  }

  advance(dt) {
    this.time += dt;
    let target;
    if (this.running) {
      if (this.starter > 0) { this.starter -= dt; target = Math.max(0.22, this.n2); }
      target = 0.6 + 0.42 * this.throttle;
      if (this.starter > 0) target = Math.min(target, 0.25 + (6 - this.starter) * 0.08);
    } else target = 0;
    // la aceleración del eje es lenta (inercia) y frenada por el control para evitar bombeo
    const rate = target > this.n2 ? 0.16 : 0.22;
    this.n2 += Math.max(-rate * dt, Math.min(rate * dt, target - this.n2));
    this.n1 += (this.n2 * 0.97 - this.n1) * Math.min(1, dt / 0.8);
    this.state = this.cycle(this.n1);
    this.fuelUsed += this.state.mf * dt;
    this.theta1 += this.n1 * 5000 * 2 * Math.PI / 60 * dt;
    this.theta2 += this.n2 * 15000 * 2 * Math.PI / 60 * dt;
  }
}
