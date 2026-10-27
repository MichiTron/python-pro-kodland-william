// Cinemática y estática de mecanismos de transmisión.

const TAU = Math.PI * 2;

// Tren epicicloidal (ecuación de Willis): (ωs - ωc)/(ωr - ωc) = -Zr/Zs
export const PLANETARY_PRESET = { zs: 30, zr: 78, inputRpm: 1200, inputTorque: 100, mode: 'reductora' };

export const PLANETARY_MODES = {
  reductora: { nombre: 'Corona fija, entra el sol, sale el portasatélites', input: 's', fixed: 'r', output: 'c' },
  superdirecta: { nombre: 'Sol fijo, entra el portasatélites, sale la corona', input: 'c', fixed: 's', output: 'r' },
  reduccion2: { nombre: 'Sol fijo, entra la corona, sale el portasatélites', input: 'r', fixed: 's', output: 'c' },
  inversa: { nombre: 'Portasatélites fijo, entra el sol, sale la corona (marcha atrás)', input: 's', fixed: 'c', output: 'r' },
  directa: { nombre: 'Dos elementos unidos: todo gira en bloque (relación 1:1)', input: 's', fixed: null, output: 'c' },
  divisor: { nombre: 'Divisor de potencia híbrido: el portasatélites (motor) reparte entre sol (generador) y corona (ruedas)', input: 'c', fixed: null, output: 'r' },
};

export function planetaryZp(zs, zr) { return Math.max(8, Math.round((zr - zs) / 2)); }

export function planetarySpeeds(zs, zr, mode, inputRpm, extra = {}) {
  const k = zr / zs;
  const m = PLANETARY_MODES[mode];
  let ws = 0, wr = 0, wc = 0;
  const w = inputRpm;
  if (mode === 'directa') { ws = wr = wc = w; }
  else if (mode === 'divisor') {
    // la corona va con las ruedas (velocidad dada) y el sol se adapta
    wc = w;
    wr = extra.ringRpm ?? w * 0.8;
    ws = wc * (1 + k) - k * wr;
  } else {
    const set = { s: null, r: null, c: null };
    set[m.fixed] = 0;
    set[m.input] = w;
    // ωs + k·ωr = (1 + k)·ωc
    if (set.s === null) set.s = (1 + k) * set.c - k * set.r;
    else if (set.r === null) set.r = ((1 + k) * set.c - set.s) / k;
    else set.c = (set.s + k * set.r) / (1 + k);
    ws = set.s; wr = set.r; wc = set.c;
  }
  const zp = planetaryZp(zs, zr);
  // giro del satélite respecto al portasatélites
  const wpRel = -(ws - wc) * zs / zp;
  return { ws, wr, wc, wpRel, zp, k };
}

// Diferencial abierto, bloqueado o autoblocante (Torsen/LSD) en una curva o con una rueda sin adherencia
export const DIFF_PRESET = { speed: 40, radius: 30, track: 1.55, mode: 'abierto', muLeft: 0.9, muRight: 0.9, torque: 600, bias: 3 };

export function differentialState(p) {
  const v = p.speed / 3.6;
  const rW = 0.31;
  const wheelLoad = 1500 * 9.81 / 4;
  const capL = p.muLeft * wheelLoad * rW;
  const capR = p.muRight * wheelLoad * rW;
  const tIn = p.torque; // par en la corona
  let wL, wR, tL, tR, slipL = false, slipR = false, note = '';
  const curve = p.radius > 0 && p.radius < 999;
  const baseL = curve ? v * (1 - p.track / (2 * p.radius)) / rW : v / rW;
  const baseR = curve ? v * (1 + p.track / (2 * p.radius)) / rW : v / rW;
  if (p.mode === 'abierto') {
    tL = tR = tIn / 2;
    const lim = Math.min(capL, capR);
    if (tIn / 2 > lim) {
      // la rueda con menos agarre patina: el par en ambas queda limitado por ella
      tL = tR = lim;
      if (capL < capR) { slipL = true; note = 'La rueda izquierda patina: un diferencial abierto reparte el mismo par y la otra rueda recibe tan poco como la que patina.'; }
      else { slipR = true; note = 'La rueda derecha patina: un diferencial abierto reparte el mismo par y la otra rueda recibe tan poco como la que patina.'; }
    }
    wL = baseL; wR = baseR;
    if (slipL) { wL = baseL + 25; wR = baseR - 0; }
    if (slipR) { wR = baseR + 25; }
    // en el abierto siempre se cumple ωL + ωR = 2·ωcorona
  } else if (p.mode === 'bloqueado') {
    const wAvg = (baseL + baseR) / 2;
    wL = wR = wAvg;
    tL = Math.min(capL, tIn - Math.min(capR, tIn / 2));
    tR = Math.min(capR, tIn - tL);
    if (curve) note = 'Con el diferencial bloqueado ambas ruedas giran igual: en curva una de ellas se arrastra y el neumático sufre.';
    else note = 'Bloqueado: si una rueda pierde agarre, la otra recibe el par que pueda transmitir.';
  } else {
    // autoblocante con relación de reparto (TBR)
    const bias = p.bias;
    const low = Math.min(capL, capR);
    const maxHigh = low * bias;
    let lowT = Math.min(low, tIn / 2), highT = Math.min(Math.max(capL, capR), Math.min(maxHigh, tIn - lowT));
    if (tIn / 2 <= low) { lowT = tIn / 2; highT = tIn / 2; }
    if (capL <= capR) { tL = lowT; tR = highT; } else { tR = lowT; tL = highT; }
    wL = baseL; wR = baseR;
    const spin = tL + tR < tIn - 1;
    if (spin) { if (capL < capR) wL += 12; else wR += 12; }
    note = `Autoblocante: la rueda con agarre puede recibir hasta ${bias} veces el par de la que patina.`;
  }
  const wC = (wL + wR) / 2;
  return { wL, wR, wC, tL, tR, slipL, slipR, note, baseL, baseR };
}

export function rpmToRad(r) { return r * TAU / 60; }
