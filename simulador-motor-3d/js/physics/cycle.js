// Modelo termodinámico de una zona para motores de combustión interna.
// Integra la primera ley de la termodinámica ángulo a ángulo durante la fase cerrada
// (compresión, combustión, expansión) con liberación de calor de Wiebe, pérdidas de
// calor de Woschni, detonación por integral de Livengood-Wu (correlación Douaud-Eyzat)
// y retardo de autoencendido diésel de Hardenburg-Hase.
// Convención de ángulo de ciclo: 0 = PMS de combustión. 4T: -360..360, 2T: -180..180.

export const P_ATM = 101325;
export const T_ATM = 298;
export const R_AIR = 287;
export const DEG = Math.PI / 180;

export const FUELS = {
  gasolina87: { nombre: 'Gasolina 87 RON', LHV: 43.4e6, AFRst: 14.7, octanaje: 87, densidad: 745, encendido: 'chispa' },
  gasolina95: { nombre: 'Gasolina 95 RON', LHV: 43.4e6, AFRst: 14.7, octanaje: 95, densidad: 745, encendido: 'chispa' },
  gasolina98: { nombre: 'Gasolina 98 RON', LHV: 43.2e6, AFRst: 14.6, octanaje: 98, densidad: 750, encendido: 'chispa' },
  e85: { nombre: 'Etanol E85', LHV: 29.2e6, AFRst: 9.8, octanaje: 105, densidad: 781, encendido: 'chispa' },
  diesel: { nombre: 'Gasóleo (diésel)', LHV: 42.8e6, AFRst: 14.5, cetano: 50, densidad: 835, encendido: 'compresion' },
  biodiesel: { nombre: 'Biodiésel B100', LHV: 37.5e6, AFRst: 12.5, cetano: 56, densidad: 880, encendido: 'compresion' },
};

export function gammaOf(T) {
  return Math.min(1.4, Math.max(1.22, 1.392 - 8.13e-5 * T));
}

// Geometría de la cámara. kind: 'piston' (biela-manivela) o 'sine' (Wankel: volumen senoidal).
export function makeGeometry(cfg) {
  if (cfg.volumeLaw === 'sine') {
    const Vd = cfg.faceDisplacement;
    const Vc = Vd / (cfg.cr - 1);
    return { sine: true, Vd, Vc, A: 0, a: 0, L: 0, B: cfg.equivBore, areaMult: cfg.areaMult || 1.8 };
  }
  const A = Math.PI * cfg.bore * cfg.bore / 4;
  const Vd = A * cfg.stroke;
  const Vc = Vd / (cfg.cr - 1);
  return { sine: false, Vd, Vc, A, a: cfg.stroke / 2, L: cfg.rod, B: cfg.bore, areaMult: cfg.areaMult || 1 };
}

// Volumen y derivada dV/dθ (θ en radianes de ciclo).
export function volumeAt(g, th, out) {
  const s = Math.sin(th), c = Math.cos(th);
  if (g.sine) {
    out.V = g.Vc + g.Vd * 0.5 * (1 - c);
    out.dV = g.Vd * 0.5 * s;
    return out;
  }
  const root = Math.sqrt(g.L * g.L - g.a * g.a * s * s);
  const x = g.a * c + root;
  out.V = g.Vc + g.A * (g.L + g.a - x);
  out.dV = g.A * g.a * s * (1 + g.a * c / root);
  return out;
}

// Posición del pasador del pistón medida desde el eje del cigüeñal.
export function pistonPinHeight(a, L, th) {
  const s = Math.sin(th);
  return a * Math.cos(th) + Math.sqrt(L * L - a * a * s * s);
}

function wiebe(th, th0, dur, a, m) {
  if (th <= th0) return { x: 0, dx: 0 };
  const r = (th - th0) / dur;
  const e = Math.exp(-a * Math.pow(r, m + 1));
  return { x: 1 - e, dx: a * (m + 1) * Math.pow(r, m) * e / dur };
}

// Velocidad laminar relativa de llama según dosado relativo φ = 1/λ (máximo cerca de φ = 1.1).
export function flameSpeedRel(phi) {
  return Math.max(0.2, 1 - 2.1 * (phi - 1.1) * (phi - 1.1)) / 0.979;
}

// op = { rpm, mAir, mRes, Tivc, Pman, Pexh, lambda o phi, timing (grados APMS), ignition, fuelCut, fuel }
export function computeCycle(cfg, op) {
  const g = makeGeometry(cfg);
  const twoStroke = cfg.strokes === 2;
  const diesel = cfg.combustion === 'diesel';
  const fuel = FUELS[op.fuel] || FUELS.gasolina95;
  const half = twoStroke ? 180 : 360;
  const N = 2 * half;
  const shaftPerCycle = cfg.shaftPerCycle || 1; // Wankel: 1.5 grados de eje por grado de ciclo
  const rpm = Math.max(op.rpm, 30);
  const omegaCycle = rpm * 2 * Math.PI / 60 / shaftPerCycle; // rad de ciclo por segundo
  const Sp = cfg.meanPistonSpeedFactor ? cfg.meanPistonSpeedFactor * rpm : 2 * (cfg.stroke || 0.08) * rpm / 60;

  const ivcDeg = twoStroke ? -180 + cfg.portClose : -180 + cfg.ivc;
  const evoDeg = twoStroke ? 180 - cfg.portOpen : 180 - cfg.evo;

  // Mezcla atrapada
  const mAir = op.mAir;
  const mRes = op.mRes || 0;
  let mFuel, lambda;
  if (diesel) {
    const phi = op.phi;
    mFuel = mAir * phi / fuel.AFRst;
    lambda = phi > 1e-4 ? 1 / phi : 99;
  } else {
    lambda = op.lambda;
    mFuel = mAir / (fuel.AFRst * lambda);
  }
  const burning = op.ignition && !op.fuelCut && mFuel > 0;
  let misfire = false;
  let misfireReason = '';
  if (burning && !diesel && (lambda < 0.55 || lambda > 1.65)) {
    misfire = true;
    misfireReason = lambda < 0.55 ? 'Mezcla demasiado rica: fuera del límite de inflamabilidad' : 'Mezcla demasiado pobre: la llama no se propaga';
  }
  const etaComb = lambda >= 1 ? 0.98 : 0.98 * Math.max(0.3, lambda);
  const Qtotal = burning ? mFuel * fuel.LHV * etaComb : 0;
  const mCharge = mAir + mRes + (diesel ? 0 : mFuel);
  const xRes = mRes / (mAir + mRes);

  const tmp = { V: 0, dV: 0 };
  volumeAt(g, ivcDeg * DEG, tmp);
  const Vivc = tmp.V;
  const Tivc = op.Tivc;
  const Pivc = mCharge * R_AIR * Tivc / Vivc;

  // Parámetros de combustión
  let otto = null;
  if (!diesel) {
    const phi = 1 / lambda;
    const dilution = 1 + 1.2 * xRes;
    const dur = 48 * Math.pow(rpm / 2500, 0.25) * dilution / Math.sqrt(flameSpeedRel(phi)) * (cfg.burnMult || 1);
    const th0 = -op.timing + 4; // retardo de desarrollo del núcleo de llama
    otto = { th0, dur };
  }

  // Integración de la fase cerrada
  const P = new Float64Array(N);
  const V = new Float64Array(N);
  const dVt = new Float64Array(N);
  const T = new Float64Array(N);
  const XB = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    volumeAt(g, (i - half) * DEG, tmp);
    V[i] = tmp.V;
    dVt[i] = tmp.dV;
  }

  const B = g.B;
  const Tw = cfg.wallTemp || 430;
  const htMult = cfg.htMult || 1;
  const knockOctane = fuel.octanaje || 95;
  const stepDeg = 1.0;
  const h = stepDeg * DEG;
  let th = ivcDeg * DEG;
  let Pc = Pivc;
  let xb = 0;
  let knockI = 0;
  let knockDeg = null;
  let knockFraction = 0;
  let qLoss = 0;
  let socDeg = null;
  let ignitionDelayDeg = null;
  let premix = 0;
  let dieselDiffDur = 0;
  let injected = false;
  const injDeg = diesel ? -op.timing : null;
  const evo = evoDeg * DEG;
  const gammaU = 1.32;

  const heatRelease = (thr) => {
    // devuelve {x, dx} con dx por radián
    if (!burning || misfire) return { x: 0, dx: 0 };
    const tdeg = thr / DEG;
    if (!diesel) {
      const w = wiebe(tdeg, otto.th0, otto.dur, 5, 2);
      let x = w.x, dx = w.dx;
      if (knockDeg !== null && tdeg > knockDeg) {
        // la mezcla que quedaba sin quemar se autoinflama casi de golpe
        const k = wiebe(tdeg, knockDeg, 4, 6.9, 1);
        x = w.x + (1 - w.x) * k.x;
        dx = w.dx * (1 - k.x) + (1 - w.x) * k.dx;
      }
      return { x, dx: dx / DEG };
    }
    if (socDeg === null) return { x: 0, dx: 0 };
    const wp = wiebe(tdeg, socDeg, 7, 6.9, 2);
    const wd = wiebe(tdeg, socDeg + 1, dieselDiffDur, 6.9, 0.9);
    return { x: premix * wp.x + (1 - premix) * wd.x, dx: (premix * wp.dx + (1 - premix) * wd.dx) / DEG };
  };

  const deriv = (thr, p) => {
    volumeAt(g, thr, tmp);
    const Vv = tmp.V, dV = tmp.dV;
    const Tg = p * Vv / (mCharge * R_AIR);
    const gam = gammaOf(Tg);
    const hr = heatRelease(thr);
    const dQ = Qtotal * hr.dx;
    // Woschni
    const Pmot = Pivc * Math.pow(Vivc / Vv, 1.35);
    const comb = hr.x > 0.001 ? 1 : 0;
    const w = 2.28 * Sp + comb * 3.24e-3 * (g.Vd * Tivc / (Pivc * Vivc)) * Math.max(0, p - Pmot);
    const hc = 3.26 * Math.pow(B, -0.2) * Math.pow(p / 1000, 0.8) * Math.pow(Tg, -0.55) * Math.pow(Math.max(w, 0.1), 0.8) * htMult;
    const Aw = (Math.PI * B * B / 2 + 4 * Vv / B) * g.areaMult;
    const dQw = hc * Aw * (Tg - Tw) / omegaCycle;
    const dP = ((gam - 1) * (dQ - dQw) - gam * p * dV) / Vv;
    return { dP, dQw, Tg, x: hr.x };
  };

  // índice de inicio de la fase cerrada
  const iStart = Math.floor(ivcDeg) + 1 + half;
  // rellenar desde ivc hasta el primer grado entero
  let lastRecorded = -1;
  while (th < evo) {
    const tdeg = th / DEG;
    // eventos diésel: inyección y cálculo del retardo
    if (diesel && burning && !injected && tdeg >= injDeg) {
      injected = true;
      volumeAt(g, th, tmp);
      const Tinj = Pc * tmp.V / (mCharge * R_AIR);
      const Pbar = Pc / 1e5;
      const EA = 618840 / ((fuel.cetano || 50) + 25);
      if (Pbar > 13) {
        const idDeg = (0.36 + 0.22 * Sp) * Math.exp(EA * (1 / (8.314 * Tinj) - 1 / 17190) + Math.pow(21.2 / (Pbar - 12.4), 0.63));
        if (idDeg < 45 && Tinj > 650) {
          ignitionDelayDeg = idDeg;
          socDeg = injDeg + idDeg;
          const idMs = idDeg / (6 * rpm) * 1000;
          const phi = 1 / lambda;
          premix = Math.min(0.85, Math.max(0.03, 1 - 0.926 * Math.pow(phi, 0.37) / Math.pow(Math.max(idMs, 0.05), 0.26)));
          dieselDiffDur = (30 + 55 * phi) * Math.pow(rpm / 2000, 0.25);
        } else {
          misfire = true;
          misfireReason = 'Sin autoencendido: el aire comprimido no está lo bastante caliente';
        }
      } else {
        misfire = true;
        misfireReason = 'Sin autoencendido: presión de compresión demasiado baja';
      }
    }
    // RK2 (punto medio)
    const k1 = deriv(th, Pc);
    const k2 = deriv(th + h / 2, Pc + k1.dP * h / 2);
    // detonación: integral de Livengood-Wu sobre el gas sin quemar
    if (!diesel && burning && !misfire && knockDeg === null && k1.x < 0.97) {
      const Tu = Tivc * Math.pow(Pc / Pivc, (gammaU - 1) / gammaU);
      const tau = 17.68e-3 * Math.pow(knockOctane / 100, 3.402) * Math.pow(Pc / P_ATM, -1.7) * Math.exp(3800 / Tu) * (cfg.knockMult || 2.2);
      knockI += (h / omegaCycle) / tau;
      if (knockI >= 1 && k1.x > 0.02) {
        knockDeg = tdeg;
        knockFraction = 1 - k1.x;
      }
    }
    qLoss += k2.dQw * h;
    const P0 = Pc, x0 = xb, d0 = th / DEG;
    Pc += k2.dP * h;
    xb = k2.x;
    th += h;
    const d1 = th / DEG;
    for (let k = Math.floor(d0) + 1; k <= Math.floor(d1 + 1e-9); k++) {
      const idx = k + half;
      if (idx < 0 || idx >= N || idx === lastRecorded) continue;
      const f = (k - d0) / (d1 - d0);
      P[idx] = P0 + (Pc - P0) * f;
      XB[idx] = x0 + (xb - x0) * f;
      lastRecorded = idx;
    }
  }
  const iEvo = Math.floor(evoDeg) + half;
  const Pevo = Pc;
  volumeAt(g, evo, tmp);
  const Tevo = Pc * tmp.V / (mCharge * R_AIR);

  // Intercambio de gases (modelo de llenado y vaciado simplificado)
  const Pexh = op.Pexh;
  const Pman = op.Pman;
  const Pin = Pman * (1 - 0.04 * (rpm / 6000) * (rpm / 6000));
  const tauB = 10 + 12 * rpm / 6000;
  for (let i = 0; i < N; i++) {
    const d = i - half;
    if (i >= iStart && i <= iEvo) continue;
    let p;
    if (!twoStroke) {
      if (d > evoDeg) {
        p = Pexh + (Pevo - Pexh) * Math.exp(-(d - evoDeg) / tauB);
      } else if (d < -180) {
        p = Pin + (Pexh - Pin) * Math.exp(-(d + 360) / 18);
      } else {
        const f = (d + 180) / Math.max(1, ivcDeg + 180);
        p = Pin + (Pivc - Pin) * f * f;
      }
    } else {
      const Pscav = Pman;
      const dd = d > 0 ? d - evoDeg : d + 360 - evoDeg;
      const blow = Pscav + (Pevo - Pscav) * Math.exp(-dd / (tauB * 0.6));
      if (d < 0) {
        const f = (d + 180) / Math.max(1, ivcDeg + 180);
        p = blow + (Pivc - blow) * f * f;
      } else p = blow;
    }
    P[i] = p;
    XB[i] = d > evoDeg || d < -180 ? 1 : 0;
  }
  for (let i = iStart; i <= iEvo && i < N; i++) if (P[i] === 0) P[i] = P[Math.max(0, i - 1)];

  // Temperatura y oscilaciones de detonación (solo visuales en la curva registrada)
  const Pplot = new Float64Array(N);
  let Pmax = 0, thPmax = 0, Tmax = 0;
  for (let i = 0; i < N; i++) {
    T[i] = P[i] * V[i] / (mCharge * R_AIR);
    Pplot[i] = P[i];
    if (P[i] > Pmax) { Pmax = P[i]; thPmax = i - half; }
    if (i >= iStart && i <= iEvo && T[i] > Tmax) Tmax = T[i];
  }
  if (knockDeg !== null) {
    const f = 1.84 * Math.sqrt(1.3 * R_AIR * Math.max(Tmax, 1500)) / (Math.PI * B);
    const degPerPeriod = rpm * 6 * shaftPerCycle / f / shaftPerCycle;
    for (let i = Math.ceil(knockDeg) + half; i < N && i <= iEvo; i++) {
      const d = i - half - knockDeg;
      Pplot[i] += P[i] * 0.55 * knockFraction * Math.exp(-d / 25) * Math.sin(2 * Math.PI * d / Math.max(degPerPeriod, 1.6));
    }
  }

  // Trabajo, presiones medias y par por grado
  let Wnet = 0, Wgross = 0;
  const torque = new Float64Array(N); // N·m en el eje por cilindro
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const dV = V[j] - V[i];
    const w = 0.5 * (P[i] + P[j]) * dV;
    Wnet += w;
    const d = i - half;
    if (!twoStroke ? (d >= -180 && d < 180) : true) Wgross += w;
    torque[i] = (P[i] - P_ATM) * dVt[i] / shaftPerCycle;
  }
  if (twoStroke) Wgross = Wnet;
  const imep = Wnet / g.Vd;
  const imepGross = Wgross / g.Vd;
  const pmep = imepGross - imep;
  const etaInd = Qtotal > 0 ? Wnet / (mFuel * fuel.LHV) : 0;

  // Gases de escape: expansión isentrópica aproximada en la descarga
  const gE = gammaOf(Tevo);
  const Tbd = Tevo * Math.pow(Math.min(1, Pexh / Pevo), (gE - 1) / gE);
  // pérdida de calor en la lumbrera y el colector: mayor con poco caudal (baja carga)
  const loadF = Math.min(1.5, Pman / P_ATM);
  const egt = Tbd - (Tbd - 450) * Math.max(0.1, 0.18 + 0.45 * (1 - loadF));

  // Emisiones estimadas (orden de magnitud, con fines didácticos)
  let nox = 0, co = 0, hc = 0, soot = 0;
  if (Qtotal > 0 && !misfire) {
    const o2 = lambda < 1 ? Math.max(0, (lambda - 0.75) / 0.25) : Math.max(0.15, 1 - (lambda - 1.05) * 0.6);
    nox = 3800 * Math.exp(-38000 * (1 / Math.max(Tmax, 1200) - 1 / 2750)) * o2 * (diesel ? 0.55 : 1);
    co = diesel ? 0.03 + 0.4 * Math.max(0, 1 / lambda - 0.75) : (lambda < 1 ? 0.2 + 30 * (1 - lambda) : 0.15 + 0.1 * Math.max(0, lambda - 1.3));
    hc = diesel ? 150 : 1200 + 3000 * Math.max(0, lambda - 1.3) + 1500 * Math.max(0, 0.9 - lambda);
    soot = diesel ? Math.max(0, (1 / lambda - 0.55) * 4) : 0;
  } else if (op.ignition && !op.fuelCut && mFuel > 0) {
    hc = 20000; // combustible sin quemar
  }

  return {
    N, half, twoStroke, V, P: Pplot, Pclean: P, T, XB, torque, imep, imepGross, pmep, Pmax, thPmax, Tmax,
    Pivc, Tivc, Vivc, Pevo, Tevo, egt, mAir, mFuel, mCharge, Qtotal, Wnet, etaInd, lambda, qLoss,
    knock: knockDeg !== null, knockDeg, knockIntegral: knockI, knockFraction,
    socDeg, ignitionDelayDeg, injDeg, premix, misfire, misfireReason,
    burnStart: diesel ? socDeg : (otto ? otto.th0 : null), burnDur: diesel ? dieselDiffDur : (otto ? otto.dur : null),
    ivcDeg, evoDeg, nox, co, hc, soot, Vd: g.Vd, Vc: g.Vc,
  };
}

// Fricción mecánica según Chen-Flynn (en Pa)
export function fmepChenFlynn(PmaxPa, Sp, mult = 1) {
  const pmaxBar = PmaxPa / 1e5;
  return (0.38 + 0.005 * pmaxBar + 0.06 * Sp + 0.0009 * Sp * Sp) * 1e5 * mult;
}

// Caudal másico por una restricción (mariposa) con flujo compresible
export function orificeFlow(Cd, A, Pup, Tup, Pdown) {
  const gam = 1.4;
  const pr = Math.max(0, Math.min(1, Pdown / Pup));
  let psi;
  if (pr <= 0.528) psi = 0.6847;
  else psi = Math.sqrt(Math.max(0, (2 * gam / (gam - 1)) * (Math.pow(pr, 2 / gam) - Math.pow(pr, (gam + 1) / gam))));
  return Cd * A * Pup / Math.sqrt(R_AIR * Tup) * psi;
}
