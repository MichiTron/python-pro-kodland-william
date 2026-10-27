// Máquina de vapor horizontal de doble efecto con distribución por corredera,
// expansión hiperbólica (pV = cte), regulador centrífugo de Watt y volante de inercia.

const TAU = Math.PI * 2;

export const STEAM_PRESET = {
  boiler: 8, cutoff: 35, bore: 200, stroke: 300, rod: 750, flywheel: 120, load: 300,
  governor: true, targetRpm: 120, condenser: false, firing: true,
};

// Temperatura de saturación (K) aproximada para presión absoluta en bar
export function tSat(pBar) { return 273.15 + 100 * Math.pow(Math.max(pBar, 0.05), 0.25); }

export class SteamEngine {
  constructor(params = {}) {
    this.p = { ...STEAM_PRESET, ...params };
    this.theta = 0; this.omega = 0; this.time = 0;
    this.regulator = 1;     // apertura de la válvula de admisión
    this.ballLift = 0;      // altura de las bolas del regulador (0..1)
    this.steamUsed = 0;
    this.running = false;
    this.rebuild();
  }
  setParam(k, v) { this.p[k] = v; this.rebuild(); }
  rebuild() {
    const p = this.p;
    this.A = Math.PI * Math.pow(p.bore / 1000, 2) / 4;
    this.Arod = Math.PI * Math.pow(p.bore / 1000 * 0.18, 2) / 4;
    this.a = p.stroke / 2000;
    this.L = p.rod / 1000;
    this.J = p.flywheel;
    this.clr = 0.08;
  }
  get rpm() { return this.omega * 60 / TAU; }

  // presión (Pa abs) en una cara del pistón según la fracción de carrera x y el sentido
  sidePressure(x, outward) {
    const p = this.p;
    const pb = this.running ? (p.boiler + 1.013) * 1e5 : 1.013e5;
    const pBack = p.condenser ? 0.2e5 : 1.15e5;
    const pAdm = Math.max(pBack, pb * (0.25 + 0.75 * this.regulator) * (1 - 0.04 * this.omega / 15));
    const c = p.cutoff / 100, clr = this.clr;
    if (outward) {
      if (x <= c) return pAdm;
      const pe = pAdm * (c + clr) / (x + clr);
      if (x < 0.93) return Math.max(pe, pBack * 0.5);
      const pr = pAdm * (c + clr) / (0.93 + clr);
      const f = (x - 0.93) / 0.07;
      return pr + (pBack - pr) * f;
    }
    // carrera de retorno: escape y compresión al final (amortiguamiento)
    const comp = 0.12;
    if (x > comp) return pBack;
    return pBack * (comp + clr) / (x + clr);
  }

  // fracción de carrera de la cara delantera (0 = punto muerto interior)
  pistonFraction(th) {
    const s = Math.sin(th);
    const xpin = this.a * Math.cos(th) + Math.sqrt(this.L * this.L - this.a * this.a * s * s);
    return (this.L + this.a - xpin) / (2 * this.a);
  }

  pressures(th) {
    const t = ((th % TAU) + TAU) % TAU;
    const x = this.pistonFraction(t);
    const firstHalf = t < Math.PI; // la cara de la tapa empuja mientras el pistón se aleja de ella
    return { pHead: this.sidePressure(x, firstHalf), pCrank: this.sidePressure(1 - x, !firstHalf), x };
  }

  torqueAt(th) {
    const t = ((th % TAU) + TAU) % TAU;
    const { pHead, pCrank } = this.pressures(t);
    const F = pHead * this.A - pCrank * (this.A - this.Arod);
    const s = Math.sin(t), c = Math.cos(t);
    const root = Math.sqrt(this.L * this.L - this.a * this.a * s * s);
    const lever = this.a * s * (1 + this.a * c / root);
    return F * lever;
  }

  steamPerRev() {
    const p = this.p;
    const pb = (p.boiler + 1.013);
    const pAdm = pb * (0.25 + 0.75 * this.regulator);
    const rho = pAdm * 1e5 / (461.5 * tSat(pAdm)) * 1.03;
    const Vstroke = this.A * 2 * this.a;
    const vol = Vstroke * (p.cutoff / 100 + this.clr) * 2 - Vstroke * this.clr * 2 * 0.5;
    return vol * rho;
  }

  advance(dt) {
    const p = this.p;
    this.time += dt;
    // regulador de Watt: las bolas suben con la velocidad y cierran la admisión
    const wRel = this.omega / (p.targetRpm * TAU / 60);
    const lift = Math.max(0, Math.min(1, (wRel * wRel - 0.6) / 0.8));
    this.ballLift += (lift - this.ballLift) * Math.min(1, dt / 0.4);
    this.regulator = p.governor ? Math.max(0.03, Math.min(1, 1 - (this.ballLift - 0.5) * 3.2)) : 1;
    const n = Math.max(4, Math.ceil(dt / 0.002));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const Tg = this.torqueAt(this.theta);
      const Tl = p.load * Math.tanh(this.omega / 0.5) + 15 * Math.tanh(this.omega / 0.3) + 2.5 * this.omega;
      this.omega += (Tg - Tl) / this.J * h;
      if (this.omega < 0) this.omega = 0;
      this.theta += this.omega * h;
    }
    this.steamRate = this.running ? this.steamPerRev() * this.omega / TAU : 0;
    this.steamUsed += this.steamRate * dt;
  }

  // diagrama indicado de la cara delantera: x frente a presión
  indicator() {
    const xs = [], ps = [];
    for (let d = 0; d <= 360; d += 3) {
      const t = d * Math.PI / 180;
      const pr = this.pressures(t);
      xs.push(pr.x); ps.push(pr.pHead);
    }
    return { xs, ps };
  }

  telemetry() {
    // trabajo indicado por vuelta (ambas caras)
    let W = 0;
    const N = 360;
    for (let i = 0; i < N; i++) W += this.torqueAt(i * TAU / N) * TAU / N;
    const P = W * this.omega / TAU;
    const heatIn = this.steamRate * 2.62e6 / 0.7; // calor del combustible (caldera al 70 %)
    return { W, P, eta: heatIn > 0 ? Math.max(0, P) / heatIn : 0, steamKgH: this.steamRate * 3600 };
  }
}
