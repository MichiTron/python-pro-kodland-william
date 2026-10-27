// Dinámica longitudinal de un automóvil: resistencia aerodinámica, rodadura, pendiente,
// embrague con deslizamiento, caja de cambios (manual o automática), diferencial y frenos.

const TAU = Math.PI * 2;
const G = 9.81;
const RHO_AIR = 1.2;

export const VEHICLE_PRESETS = {
  compacto: { mass: 1350, cd: 0.30, area: 2.2, crr: 0.011, wheelR: 0.316, gears: [3.62, 2.13, 1.39, 1.03, 0.82, 0.68], finalDrive: 3.94, eta: 0.92 },
  deportivo: { mass: 1250, cd: 0.33, area: 1.95, crr: 0.012, wheelR: 0.33, gears: [3.40, 2.19, 1.63, 1.29, 1.03, 0.84], finalDrive: 4.10, eta: 0.92 },
  furgoneta: { mass: 2200, cd: 0.36, area: 3.4, crr: 0.012, wheelR: 0.34, gears: [4.17, 2.34, 1.52, 1.14, 0.87, 0.69], finalDrive: 4.06, eta: 0.9 },
  electrico: { mass: 1850, cd: 0.23, area: 2.22, crr: 0.009, wheelR: 0.334, gears: [9.0], finalDrive: 1.0, eta: 0.97 },
};

export class Vehicle {
  constructor(powertrain, params = {}) {
    this.pt = powertrain;           // CombustionEngine o ElectricMotor
    this.electric = !!powertrain.solveCurrents;
    this.p = { ...(this.electric ? VEHICLE_PRESETS.electrico : VEHICLE_PRESETS.compacto), grade: 0, wind: 0, autoShift: true, ...params };
    this.v = 0;
    this.x = 0;
    this.gear = this.electric ? 1 : 0;
    this.clutch = 0;
    this.shiftTimer = 0;
    this.throttle = 0;
    this.brake = 0;
    this.acc = 0;
    this.time = 0;
    this.timer0100 = null; this.t0100 = null;
    this.t400 = null; this.runStart = null;
    this.forces = { drive: 0, aero: 0, roll: 0, grade: 0, brake: 0 };
    this.fuelStartKg = 0; this.distStart = 0;
    this.wheelAngle = 0;
  }

  get kmh() { return this.v * 3.6; }
  ratio(g = this.gear) { return g > 0 ? this.p.gears[g - 1] * this.p.finalDrive : 0; }

  shift(dir) {
    if (this.electric) return;
    const ng = Math.max(0, Math.min(this.p.gears.length, this.gear + dir));
    if (ng !== this.gear) { this.gear = ng; this.shiftTimer = 0.35; }
  }

  resetRun() {
    this.t0100 = null; this.t400 = null; this.runStart = null; this.x = 0;
    this.fuelStartKg = this.electric ? this.pt.energyUsed : this.pt.fuelUsed;
    this.distStart = 0;
  }

  autoShiftLogic() {
    if (this.electric || !this.p.autoShift || this.shiftTimer > 0) return;
    const e = this.pt;
    if (!e.ignition) return;
    if (this.gear === 0 && (this.throttle > 0.05) && !e.seized) { this.gear = 1; this.shiftTimer = 0.2; return; }
    if (this.gear === 0) return;
    const rpm = e.rpm;
    const red = e.p.redline;
    const up = Math.min(red * 0.96, (e.isDiesel ? 1900 : 2300) + (red * 0.9 - 2300) * Math.pow(this.throttle, 1.4));
    const wheelRpm = this.v / this.p.wheelR * 60 / TAU;
    if (rpm > up && this.gear < this.p.gears.length && this.clutch > 0.95) { this.shift(1); return; }
    const down = (e.isDiesel ? 1200 : 1350) + 1500 * this.throttle;
    if (this.gear > 1) {
      const rpmLower = wheelRpm * this.ratio(this.gear - 1);
      if (rpm < down && rpmLower < up * 0.92) this.shift(-1);
    }
  }

  step(dt) {
    const p = this.p;
    this.time += dt;
    this._sum = { drive: 0, aero: 0, roll: 0, grade: 0, brake: 0, acc: 0, n: 0 };
    this.shiftTimer = Math.max(0, this.shiftTimer - dt);
    const grade = Math.atan(p.grade / 100);
    const brakeForceMax = p.mass * G * 0.95;
    const wheelJ = 4 * 1.1; // inercia de las cuatro ruedas (kg·m²)

    if (this.electric) {
      const m = this.pt;
      const n = Math.max(1, Math.ceil(dt / 0.002));
      const h = dt / n;
      const R = this.ratio(1);
      const mEff = p.mass + wheelJ / (p.wheelR ** 2) + m.J * (R / p.wheelR) ** 2;
      for (let i = 0; i < n; i++) {
        m.omega = this.v / p.wheelR * R;
        const T = m.computeTorque(this.throttle, this.brake);
        const Fd = T * R * (T >= 0 ? p.eta : 1 / p.eta) / p.wheelR;
        const regenF = Math.min(0, Fd);
        const Fb = Math.max(0, this.brake * brakeForceMax + regenF);
        this.integrate(h, Fd, Fb, grade, mEff);
        m.omega = this.v / p.wheelR * R;
        m.theta += m.omega * h;
        m.integrateEnergy(h);
      }
      m.time += dt;
    } else {
      const e = this.pt;
      e.prepare(dt, this.shiftTimer > 0 ? 0 : this.throttle);
      this.autoShiftLogic();
      const R = this.ratio();
      const maxStep = 2.5 * Math.PI / 180;
      const n = Math.min(600, Math.max(4, Math.ceil(Math.max(e.omega * dt / maxStep, dt / 0.001))));
      const h = dt / n;
      const capacity = 520;
      const mEff = p.mass + wheelJ / (p.wheelR ** 2) + (this.gear > 0 ? 0.02 * (R / p.wheelR) ** 2 : 0);
      for (let i = 0; i < n; i++) {
        const wIn = this.v / p.wheelR * R;
        const rpmIn = wIn * 60 / TAU;
        // embrague automático: patina al arrancar y se abre al cambiar o si el motor se ahogaría
        let target = 0;
        if (this.gear > 0 && this.shiftTimer <= 0 && e.ignition) {
          if (rpmIn > e.p.idleRpm * 1.05) target = 1;
          else if (this.throttle > 0.02) target = Math.max(0, Math.min(1, (e.rpm - e.p.idleRpm * 1.15) / 1100));
        }
        this.clutch += (target - this.clutch) * Math.min(1, h / (target > this.clutch ? 0.25 : 0.06));
        const Tc = this.gear > 0 ? this.clutch * capacity * Math.tanh((e.omega - wIn) / 1.5) : 0;
        e.substep(h, Tc);
        const Fd = Tc * R * p.eta / p.wheelR;
        this.integrate(h, Fd, this.brake * brakeForceMax, grade, mEff);
      }
    }
    // valores medios del fotograma (los instantáneos oscilan con cada explosión)
    const s = this._sum;
    if (s.n) {
      this.forces = { drive: s.drive / s.n, aero: s.aero / s.n, roll: s.roll / s.n, grade: s.grade / s.n, brake: s.brake / s.n };
      this.acc = s.acc / s.n;
    }
    this.wheelAngle += this.v / p.wheelR * dt;
    // cronometraje 0-100 y 400 m
    if (this.v < 0.3 && this.throttle < 0.05) { this.runStart = null; }
    if (this.runStart === null && this.throttle > 0.3 && this.v < 0.5) { this.runStart = this.time; this.x = 0; this.t0100 = null; this.t400 = null; }
    if (this.runStart !== null) {
      if (this.t0100 === null && this.kmh >= 100) this.t0100 = this.time - this.runStart;
      if (this.t400 === null && this.x >= 400) this.t400 = this.time - this.runStart;
    }
  }

  integrate(h, Fdrive, FbrakeMag, grade, mEff) {
    const p = this.p;
    const vRel = this.v + p.wind / 3.6;
    const Faero = 0.5 * RHO_AIR * p.cd * p.area * vRel * Math.abs(vRel);
    const Froll = p.crr * p.mass * G * Math.cos(grade) * Math.tanh(this.v / 0.3);
    const Fgrade = p.mass * G * Math.sin(grade);
    let Fbrake = FbrakeMag * Math.tanh(this.v / 0.2);
    let F = Fdrive - Faero - Froll - Fgrade - Fbrake;
    // freno sujetando el coche parado
    if (this.v <= 0.01 && F < 0 && FbrakeMag > Math.abs(Fdrive - Fgrade)) F = 0;
    this.acc = F / mEff;
    this.v += this.acc * h;
    if (this.v < 0) { this.v = 0; if (this.acc < 0) this.acc = 0; }
    this.x += this.v * h;
    const s = this._sum;
    if (s) { s.drive += Fdrive; s.aero += Faero; s.roll += Froll; s.grade += Fgrade; s.brake += Fbrake; s.acc += this.acc; s.n++; }
  }

  consumption() {
    // instantáneo (L/100 km o kWh/100 km)
    if (this.electric) {
      const P = this.pt.Pelec;
      return this.v > 1 ? (P / 1000) / (this.v * 3.6) * 100 : null;
    }
    const e = this.pt;
    const lph = e.fuelRate / e.fuel.densidad * 3600 * 1000;
    return this.v > 1 ? lph / (this.v * 3.6) * 100 : null;
  }
}
