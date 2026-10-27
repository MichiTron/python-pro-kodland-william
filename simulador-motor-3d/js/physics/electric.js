// Motor síncrono de imanes permanentes (PMSM) con inversor y batería.
// Modelo en ejes dq: par = Kt·iq, límite de tensión del inversor y debilitamiento de campo.

const TAU = Math.PI * 2;

export const EV_PRESET = {
  vBat: 400, iMax: 700, kt: 0.6, poles: 8, resistance: 0.012, inductance: 0.12, maxRpm: 16000,
  rotorJ: 0.045, capacity: 60, soc: 0.9, regen: true, loadMode: 'libre', load: 0,
};

export class ElectricMotor {
  constructor(params = {}) {
    this.p = { ...EV_PRESET, ...params };
    this.omega = 0;
    this.theta = 0;
    this.soc = this.p.soc;
    this.torque = 0;
    this.id = 0; this.iq = 0;
    this.energyUsed = 0; // J (positivo = consumido)
    this.time = 0;
    this.throttle = 0;
    this.brake = 0;
    this.enabled = true;
    this.rebuild();
  }

  setParam(k, v) { this.p[k] = v; if (k === 'soc') this.soc = v; this.rebuild(); }

  rebuild() {
    const p = this.p;
    this.pp = p.poles / 2;                  // pares de polos
    this.psi = p.kt / (1.5 * this.pp);      // flujo de imanes por fase (Wb)
    this.L = p.inductance * 1e-3;
    this.J = p.rotorJ;
    this.curveCache = null;
  }

  get rpm() { return this.omega * 60 / TAU; }

  batteryVoltage(current) {
    const p = this.p;
    const voc = p.vBat * (0.88 + 0.2 * this.soc);
    const rint = 0.08 * p.vBat / 400;
    return Math.max(p.vBat * 0.6, voc - current * rint);
  }

  // Corrientes dq para un par pedido a una velocidad dada, respetando límites de tensión y corriente
  solveCurrents(Treq, omega, vbat) {
    const p = this.p;
    const we = Math.abs(omega) * this.pp;
    const Vmax = 0.95 * vbat / Math.sqrt(3);
    const fit = (iq) => {
      let id = 0;
      if (we > 1) {
        const r = Math.pow(Vmax / we, 2) - Math.pow(this.L * iq, 2);
        if (r <= 0) return null;
        const need = (Math.sqrt(r) - this.psi) / this.L;
        id = Math.min(0, need);
      }
      if (id * id + iq * iq > p.iMax * p.iMax) return null;
      return id;
    };
    let iq = Treq / p.kt;
    let id = fit(Math.abs(iq));
    if (id === null) {
      let lo = 0, hi = Math.abs(iq);
      for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (fit(m) === null) hi = m; else lo = m; }
      iq = Math.sign(iq) * lo;
      id = fit(lo) ?? 0;
    }
    return { id, iq, torque: p.kt * iq };
  }

  maxTorqueAt(omega, vbat = this.batteryVoltage(0)) {
    if (Math.abs(omega) * 60 / TAU >= this.p.maxRpm) return 0;
    return this.solveCurrents(this.p.kt * this.p.iMax, omega, vbat).torque;
  }

  losses(id, iq, omega) {
    const p = this.p;
    const we = Math.abs(omega) * this.pp;
    const cu = 1.5 * p.resistance * (id * id + iq * iq);
    const fluxFrac = Math.max(0.2, Math.min(1, (this.psi + this.L * id) / this.psi));
    const fe = (0.9 * we + 0.0011 * we * we) * fluxFrac * fluxFrac * (p.kt / 0.6);
    const mech = 0.004 * Math.abs(omega) + 1.2e-6 * omega * omega * Math.abs(omega) / 10;
    const inv = 0.012 * Math.sqrt(id * id + iq * iq) * p.vBat / 100 + 40;
    return { cu, fe, mech, inv, total: cu + fe + mech + inv };
  }

  // Par en el eje para el mando actual (acelerador positivo, freno regenerativo negativo)
  computeTorque(throttle, brakeRegen) {
    const vb = this.batteryVoltage(this.lastCurrent || 0);
    const Tmax = this.maxTorqueAt(this.omega, vb);
    let Treq = throttle * Tmax;
    if (brakeRegen > 0 && this.p.regen && this.omega > 5) Treq -= brakeRegen * Math.min(Tmax, this.p.kt * this.p.iMax * 0.6);
    if (!this.enabled || this.soc <= 0.001) Treq = Math.min(0, Treq);
    const s = this.solveCurrents(Treq, this.omega, vb);
    this.id = s.id; this.iq = s.iq;
    this.torque = s.torque;
    const L = this.losses(s.id, s.iq, this.omega);
    this.lossBreakdown = L;
    const Pmech = this.torque * this.omega;
    this.Pelec = Pmech + L.total;
    this.lastCurrent = this.Pelec / vb;
    this.vbat = vb;
    this.efficiency = Pmech > 0 ? Pmech / this.Pelec : (this.Pelec < 0 ? this.Pelec / Pmech : 0);
    return this.torque;
  }

  integrateEnergy(dt) {
    this.energyUsed += this.Pelec * dt;
    const capJ = this.p.capacity * 3.6e6;
    this.soc = Math.max(0, Math.min(1, this.soc - this.Pelec * dt / capJ));
  }

  // modo banco de pruebas
  advance(dt, loadFn) {
    this.time += dt;
    const n = Math.max(1, Math.ceil(dt / 0.002));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.computeTorque(this.throttle, this.brake);
      const Tl = loadFn ? loadFn(this.omega) : 0;
      const drag = 0.02 * this.omega;
      this.omega += (this.torque - Tl - drag) / this.J * h;
      if (this.omega < 0) this.omega = 0;
      if (this.rpm > this.p.maxRpm) this.omega = this.p.maxRpm * TAU / 60;
      this.theta += this.omega * h;
      this.integrateEnergy(h);
    }
  }

  phaseCurrents() {
    const I = Math.sqrt(this.id * this.id + this.iq * this.iq);
    const delta = Math.atan2(-this.id, this.iq);
    const te = this.theta * this.pp + Math.PI / 2 + delta;
    return [I * Math.sin(te), I * Math.sin(te - TAU / 3), I * Math.sin(te + TAU / 3)];
  }

  curve() {
    if (this.curveCache) return this.curveCache;
    const rpms = [], torque = [], power = [];
    const vb = this.batteryVoltage(0);
    for (let r = 0; r <= this.p.maxRpm; r += this.p.maxRpm / 40) {
      const w = r * TAU / 60;
      const T = this.maxTorqueAt(w, vb);
      rpms.push(r); torque.push(T); power.push(T * w / 1000);
    }
    // mapa de rendimiento
    const nx = 48, ny = 32;
    const Tpk = this.p.kt * this.p.iMax;
    const map = [];
    for (let j = 0; j < ny; j++) {
      const row = [];
      for (let i = 0; i < nx; i++) {
        const w = (i + 0.5) / nx * this.p.maxRpm * TAU / 60;
        const T = (j + 0.5) / ny * Tpk;
        const tmax = this.maxTorqueAt(w, vb);
        if (T > tmax) { row.push(null); continue; }
        const s = this.solveCurrents(T, w, vb);
        const L = this.losses(s.id, s.iq, w);
        const Pm = T * w;
        row.push(Pm / (Pm + L.total));
      }
      map.push(row);
    }
    this.curveCache = { rpms, torque, power, map, Tpk };
    return this.curveCache;
  }
}
