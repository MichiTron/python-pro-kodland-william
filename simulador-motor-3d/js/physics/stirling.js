// Motor Stirling tipo alfa con análisis isotermo de Schmidt resuelto numéricamente,
// más pérdidas por regeneración imperfecta, rozamiento del gas y fricción mecánica.

const TAU = Math.PI * 2;

export const GASES = {
  aire: { nombre: 'Aire', R: 287, cv: 718, friccion: 1.0 },
  helio: { nombre: 'Helio', R: 2077, cv: 3116, friccion: 0.38 },
  hidrogeno: { nombre: 'Hidrógeno', R: 4124, cv: 10183, friccion: 0.27 },
};

export const STIRLING_PRESET = {
  tHot: 850, tCold: 320, pMean: 10, phase: 90, swept: 120, gas: 'helio', regen: 0.92, load: 4, flywheel: 0.08, heating: true,
};

export class StirlingEngine {
  constructor(params = {}) {
    this.p = { ...STIRLING_PRESET, ...params };
    this.theta = 0; this.omega = 0; this.time = 0;
    this.tHotActual = 300;
    this.rebuild();
  }
  setParam(k, v) { this.p[k] = v; this.rebuild(); }
  rebuild() {
    const p = this.p;
    this.Vsw = p.swept * 1e-6;
    this.Vdead = 0.35 * this.Vsw;
    this.J = p.flywheel;
    this.dirty = true;
  }
  get rpm() { return this.omega * 60 / TAU; }

  // Fricción mecánica + pérdidas por rozamiento del gas en regenerador e intercambiadores (∝ ρ·ω²)
  lossTorque(omega) {
    const p = this.p;
    const gas = GASES[p.gas];
    const w = omega / 100;
    return 0.15 * Math.tanh(omega / 0.5) + 0.004 * omega + 5.3 * gas.friccion * (p.pMean / 10) * (p.swept / 120) * w * w;
  }

  // Fracción del trabajo de Schmidt que se obtiene en la realidad (volúmenes muertos, saltos de temperatura en los intercambiadores, fugas)
  get realFactor() { return 0.62; }

  volumes(th) {
    const a = this.p.phase * Math.PI / 180;
    const Ve = this.Vsw / 2 * (1 - Math.cos(th)) + this.Vdead * 0.3;
    const Vc = this.Vsw / 2 * (1 - Math.cos(th - a)) + this.Vdead * 0.3;
    const Vr = this.Vdead * 0.4;
    return { Ve, Vc, Vr };
  }

  // Masa de gas tal que la presión media del ciclo sea pMean
  gasMass(Th) {
    const p = this.p;
    const gas = GASES[p.gas];
    const Tc = p.tCold;
    const Tr = (Th - Tc) / Math.log(Th / Tc);
    let s = 0;
    const N = 72;
    for (let i = 0; i < N; i++) {
      const v = this.volumes(i * TAU / N);
      s += 1 / (v.Ve / Th + v.Vr / Tr + v.Vc / Tc);
    }
    return p.pMean * 1e5 / (gas.R * s / N);
  }

  pressureAt(th, m, Th) {
    const gas = GASES[this.p.gas];
    const Tc = this.p.tCold;
    const Tr = (Th - Tc) / Math.log(Math.max(Th / Tc, 1.0001));
    const v = this.volumes(th);
    return m * gas.R / (v.Ve / Th + v.Vr / Tr + v.Vc / Tc);
  }

  analyze() {
    const Th = Math.max(this.tHotActual, this.p.tCold + 1);
    const m = this.gasMass(Th);
    const N = 180;
    let W = 0, Qe = 0;
    const Ve = [], Vt = [], P = [];
    for (let i = 0; i < N; i++) {
      const t0 = i * TAU / N, t1 = (i + 1) * TAU / N;
      const v0 = this.volumes(t0), v1 = this.volumes(t1);
      const p0 = this.pressureAt(t0, m, Th), p1 = this.pressureAt(t1, m, Th);
      const pm = (p0 + p1) / 2;
      W += pm * ((v1.Ve + v1.Vc) - (v0.Ve + v0.Vc));
      Qe += pm * (v1.Ve - v0.Ve);
      Ve.push(v0.Ve); Vt.push(v0.Ve + v0.Vc + v0.Vr); P.push(p0);
    }
    const gas = GASES[this.p.gas];
    const Qreg = (1 - this.p.regen) * m * gas.cv * (Th - this.p.tCold);
    this.m = m;
    return { W, Qe, Qreg, eta: W > 0 ? W / (Qe + Qreg) : 0, carnot: 1 - this.p.tCold / Th, Vt, P, m, Th };
  }

  advance(dt) {
    const p = this.p;
    this.time += dt;
    const target = p.heating ? p.tHot : p.tCold;
    this.tHotActual += (target - this.tHotActual) * Math.min(1, dt / 4);
    const Th = Math.max(this.tHotActual, p.tCold + 1);
    if (this.dirty || Math.abs((this.lastTh || 0) - Th) > 2) { this.m = this.gasMass(Th); this.lastTh = Th; this.dirty = false; this.res = this.analyze(); }
    const gas = GASES[p.gas];
    const n = Math.max(4, Math.ceil(dt / 0.001));
    const h = dt / n;
    const pBuf = p.pMean * 1e5;
    for (let i = 0; i < n; i++) {
      const th = this.theta;
      const d = 1e-3;
      const v0 = this.volumes(th - d), v1 = this.volumes(th + d);
      const dV = ((v1.Ve + v1.Vc) - (v0.Ve + v0.Vc)) / (2 * d);
      const pr = this.pressureAt(th, this.m, Th);
      const Tg = (pr - pBuf) * dV;
      const Tl = p.load * 0.1 * Math.tanh(this.omega / 1) * (this.omega / 60);
      this.omega += (Tg * this.realFactor - this.lossTorque(this.omega) - Tl) / this.J * h;
      if (this.omega < 0) this.omega = 0;
      this.theta += this.omega * h;
    }
    this.instTorque = 0;
  }

  telemetry() {
    const r = this.res || this.analyze();
    const f = this.omega / TAU;
    const gas = GASES[this.p.gas];
    const Pind = r.W * this.realFactor * f;
    const Pbrake = Pind - this.lossTorque(this.omega) * this.omega;
    const Qin = (r.Qe + r.Qreg) * f;
    return { Pind, Pbrake, eta: Qin > 0 ? Math.max(0, Pbrake) / Qin : 0, etaInd: r.eta * this.realFactor, carnot: r.carnot, W: r.W * this.realFactor, Th: r.Th };
  }
}
