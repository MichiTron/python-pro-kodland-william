// Mecanismos de transmisión: tren epicicloidal y diferencial.
import * as THREE from 'three';
import { PLANETARY_PRESET, PLANETARY_MODES, planetarySpeeds, planetaryZp, DIFF_PRESET, differentialState } from '../physics/mechanisms.js';
import { mats, mesh, part, gearGeometry, ringGearGeometry, disposeTree, fmt, cylX } from '../core/kit.js';
import { lineChart, COLORS } from '../core/charts.js';

const TAU = Math.PI * 2;

// ======================= TREN EPICICLOIDAL =======================

function normalizeTeeth(zs, zr) {
  let zp = Math.max(8, Math.round((zr - zs) / 2));
  while ((zs + zp) % 3 !== 0) zp++;
  return { zs, zp, zr: zs + 2 * zp };
}

function buildPlanetary(v) {
  const { zs, zp, zr } = normalizeTeeth(v.zs, v.zr);
  const m = 0.004, w = 0.04;
  const root = new THREE.Group();
  const mode = PLANETARY_MODES[v.mode];
  const role = (k) => (mode.fixed === k ? 'fijo' : mode.input === k ? 'entrada' : mode.output === k ? 'salida' : 'libre');
  const roleText = (k) => ({ fijo: ' · FRENADO (fijo)', entrada: ' · ENTRADA', salida: ' · SALIDA', libre: '' })[role(k)];
  const sunMat = new THREE.MeshStandardMaterial({ color: 0xe0b040, metalness: 0.85, roughness: 0.3 });
  const plMat = new THREE.MeshStandardMaterial({ color: 0xb8bec7, metalness: 0.9, roughness: 0.3 });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x4f7cc8, metalness: 0.8, roughness: 0.35 });
  const carMat = new THREE.MeshStandardMaterial({ color: 0xc8463c, metalness: 0.6, roughness: 0.4 });
  const sun = mesh(gearGeometry(zs, m, w, { bore: 0.01 }), sunMat, 'Sol (planetario)' + roleText('s'), `Engranaje central de ${zs} dientes.`);
  root.add(sun);
  const sunShaft = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 16), sunMat, 'Eje del sol', 'Conecta el sol con el exterior.');
  sunShaft.geometry.rotateX(Math.PI / 2);
  sunShaft.position.z = 0.17;
  sun.add(sunShaft);
  const rr = zr * m / 2;
  const ring = mesh(ringGearGeometry(zr, m, w, rr + 0.025), ringMat, 'Corona' + roleText('r'), `Engranaje de dentado interior con ${zr} dientes.`);
  root.add(ring);
  const ringDrum = mesh(new THREE.CylinderGeometry(rr + 0.025, rr + 0.025, 0.02, 64), ringMat, 'Tambor de la corona', 'Disco que une la corona con su eje.');
  ringDrum.geometry.rotateX(Math.PI / 2);
  ringDrum.position.z = -w / 2 - 0.035;
  ring.add(ringDrum);
  const ringShaft = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 16), ringMat, 'Eje de la corona', '');
  ringShaft.geometry.rotateX(Math.PI / 2);
  ringShaft.position.z = -w / 2 - 0.14;
  ring.add(ringShaft);
  const carrier = new THREE.Group();
  const rc = (zs + zp) * m / 2;
  const carDesc = 'Soporta los ejes de los satélites. Su giro es el promedio ponderado de sol y corona.';
  const hub = mesh(new THREE.TorusGeometry(0.03, 0.009, 10, 32), carMat, 'Portasatélites' + roleText('c'), carDesc);
  hub.position.z = w / 2 + 0.014;
  carrier.add(hub);
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3;
    const arm = mesh(new THREE.BoxGeometry(rc - 0.02, 0.016, 0.01), carMat, 'Portasatélites' + roleText('c'), carDesc);
    arm.position.set(Math.cos(a) * (rc / 2 + 0.012), Math.sin(a) * (rc / 2 + 0.012), w / 2 + 0.014);
    arm.rotation.z = a;
    carrier.add(arm);
    const boss = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 16), carMat, 'Portasatélites' + roleText('c'), carDesc);
    boss.geometry.rotateX(Math.PI / 2);
    boss.position.set(Math.cos(a) * rc, Math.sin(a) * rc, w / 2 + 0.014);
    carrier.add(boss);
  }
  const cShaft = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 16, 1, true), carMat, 'Eje del portasatélites', '');
  cShaft.geometry.rotateX(Math.PI / 2);
  cShaft.position.z = w / 2 + 0.045;
  carrier.add(cShaft);
  root.add(carrier);
  const planets = [];
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3;
    const pl = mesh(gearGeometry(zp, m, w * 0.95, { bore: 0.008 }), plMat, 'Satélite', `Engranaje de ${zp} dientes que engrana a la vez con el sol y la corona.`);
    root.add(pl);
    const pin = mesh(new THREE.CylinderGeometry(0.007, 0.007, w + 0.03, 10), mats.steel, 'Eje del satélite', '');
    pin.geometry.rotateX(Math.PI / 2);
    pin.position.set(rc * Math.cos(a), rc * Math.sin(a), 0.012);
    carrier.add(pin);
    planets.push({ mesh: pl, a0: a, phase0: a + Math.PI - Math.PI / zp + (zs / zp) * a });
  }
  // indicadores de freno
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0x501010, transparent: true, opacity: 0.8 });
  const brake = new THREE.Group();
  if (mode.fixed) {
    const r = mode.fixed === 's' ? 0.016 : mode.fixed === 'r' ? rr + 0.03 : 0.034;
    const z = mode.fixed === 's' ? 0.22 : mode.fixed === 'r' ? 0 : w / 2 + 0.06;
    const band = mesh(new THREE.TorusGeometry(r, 0.006, 8, 48, Math.PI * 1.4), brakeMat, 'Freno / embrague de bloqueo', 'Mantiene inmóvil este elemento. En una caja automática, unos embragues y frenos deciden qué elemento se bloquea en cada marcha.');
    band.position.z = z;
    band.rotation.z = Math.PI * 0.8;
    brake.add(band);
  }
  root.add(brake);
  const ringPhase0 = (zp % 2 === 0) ? -Math.PI / zr : 0;
  const ang = { s: 0, r: 0, c: 0 };
  function update(st, dt) {
    ang.s += st.ws * TAU / 60 * dt;
    ang.r += st.wr * TAU / 60 * dt;
    ang.c += st.wc * TAU / 60 * dt;
    sun.rotation.z = ang.s;
    ring.rotation.z = ang.r + ringPhase0;
    carrier.rotation.z = ang.c;
    planets.forEach((pl) => {
      const a = pl.a0 + ang.c;
      pl.mesh.position.set(rc * Math.cos(a), rc * Math.sin(a), 0);
      pl.mesh.rotation.z = pl.phase0 + ang.c - (zs / zp) * (ang.s - ang.c);
    });
  }
  return { group: root, update, teeth: { zs, zp, zr }, size: new THREE.Vector3(0.45, 0.45, 0.35), center: new THREE.Vector3(0, 0, 0) };
}

export const PLANETARY = {
  id: 'planetary', name: 'Tren epicicloidal (engranaje planetario)', short: 'Planetario', category: 'Mecanismos',
  desc: 'Sol, satélites, corona y portasatélites: cajas automáticas e híbridos.',
  params(values) {
    return [
      { id: 'mode', label: 'Configuración', type: 'select', group: 'Mando', rebuild: true, options: Object.entries(PLANETARY_MODES).map(([k, m]) => ({ value: k, label: m.nombre })) },
      { id: 'inputRpm', label: 'Velocidad de entrada', type: 'range', min: -3000, max: 3000, step: 10, unit: 'rpm', group: 'Mando' },
      { id: 'inputTorque', label: 'Par de entrada', type: 'range', min: 0, max: 500, step: 5, unit: 'N·m', group: 'Mando' },
      { id: 'ringRpm', label: 'Velocidad de la corona (ruedas)', type: 'range', min: -2000, max: 4000, step: 10, unit: 'rpm', group: 'Mando', visible: (v) => v.mode === 'divisor', help: 'En el Toyota Prius la corona va unida a las ruedas; el motor térmico mueve el portasatélites y el generador el sol.' },
      { id: 'zs', label: 'Dientes del sol', type: 'range', min: 12, max: 60, step: 1, group: 'Engranajes', rebuild: true, live: false },
      { id: 'zr', label: 'Dientes de la corona (se ajusta)', type: 'range', min: 40, max: 120, step: 1, group: 'Engranajes', rebuild: true, live: false, help: 'Para montar 3 satélites iguales: Zc = Zs + 2·Zp y (Zs + Zc) divisible por 3. El programa corrige el valor.' },
    ];
  },
  create(app) {
    const values = { ...PLANETARY_PRESET, ringRpm: 800 };
    const root = new THREE.Group();
    let model = buildPlanetary(values);
    root.add(model.group);
    let st = planetarySpeeds(values.zs, values.zr, values.mode, values.inputRpm, { ringRpm: values.ringRpm });
    const inst = {
      values, root,
      get view() { return { center: model.center.clone(), size: model.size.clone(), front: true }; },
      setParam(id, v) {
        values[id] = v;
        if (['zs', 'zr', 'mode'].includes(id)) {
          const n = normalizeTeeth(values.zs, values.zr);
          values.zr = n.zr;
          root.remove(model.group); disposeTree(model.group); model = buildPlanetary(values); root.add(model.group);
          if (app && app.panel) app.panel.setValue('zr', values.zr);
        }
      },
      update(dt) {
        st = planetarySpeeds(values.zs, values.zr, values.mode, values.inputRpm, { ringRpm: values.ringRpm });
        model.update(st, dt);
      },
      speeds() { return st; },
      telemetry() {
        const m = PLANETARY_MODES[values.mode];
        const name = { s: 'Sol', r: 'Corona', c: 'Portasatélites' };
        const win = { s: st.ws, r: st.wr, c: st.wc }[m.input];
        const wout = { s: st.ws, r: st.wr, c: st.wc }[m.output];
        const ratio = Math.abs(wout) > 1e-6 ? win / wout : Infinity;
        const tOut = isFinite(ratio) ? values.inputTorque * ratio * 0.97 : 0;
        const t = model.teeth;
        return [
          { title: 'Configuración', items: [
            { label: 'Dientes sol / satélite / corona', value: `${t.zs} / ${t.zp} / ${t.zr}` },
            { label: 'Elemento de entrada', value: name[m.input] },
            { label: 'Elemento bloqueado', value: m.fixed ? name[m.fixed] : 'Ninguno' },
            { label: 'Elemento de salida', value: name[m.output] },
          ] },
          { title: 'Velocidades', items: [
            { label: 'Sol', value: st.ws, unit: 'rpm', d: 0 },
            { label: 'Portasatélites', value: st.wc, unit: 'rpm', d: 0 },
            { label: 'Corona', value: st.wr, unit: 'rpm', d: 0 },
            { label: 'Satélite (respecto al portasatélites)', value: st.wpRel, unit: 'rpm', d: 0 },
          ] },
          { title: 'Relación y par', items: [
            { label: 'Relación de transmisión i = ωent/ωsal', value: isFinite(ratio) ? fmt(ratio, 3) : '∞' },
            { label: 'Tipo', value: !isFinite(ratio) ? '·' : ratio < 0 ? 'Inversión de giro (marcha atrás)' : Math.abs(ratio) > 1.001 ? 'Reductora (más par, menos velocidad)' : Math.abs(ratio) < 0.999 ? 'Multiplicadora (superdirecta)' : 'Directa 1:1' },
            { label: 'Par de salida (rend. 97 %)', value: tOut, unit: 'N·m', d: 0 },
          ] },
        ];
      },
      charts() {
        return [{ title: 'Diagrama de velocidades (palanca de Willis)', note: 'los tres elementos siempre quedan alineados', height: 220, draw(ctx, w, h) {
          const k = values.zr / values.zs;
          // posiciones en el eje x proporcionales a 1 : k (sol, portasatélites, corona)
          const xs = [0, k / (1 + k), 1];
          const ys = [st.ws, st.wc, st.wr];
          const lim = Math.max(100, ...ys.map(Math.abs)) * 1.15;
          lineChart(ctx, w, h, { series: [{ xs, ys, color: COLORS.f, width: 2 }, { xs: [0, 1], ys: [0, 0], color: 'rgba(255,255,255,0.3)', dash: [3, 3] }], xLabel: 'Sol ←————— Portasatélites —————→ Corona', yLabel: 'rpm', xMin: -0.05, xMax: 1.05, yMin: -lim, yMax: lim,
            markers: [{ x: 0, y: st.ws, color: '#e0b040', label: 'sol' }, { x: xs[1], y: st.wc, color: '#c8463c', label: 'portasat.' }, { x: 1, y: st.wr, color: '#4f7cc8', label: 'corona' }] });
        } }];
      },
      phase() {
        const m = PLANETARY_MODES[values.mode];
        return { title: m.nombre, text: 'Ecuación de Willis: ωsol + k·ωcorona = (1 + k)·ωportasatélites, con k = Zcorona/Zsol. Fijando un elemento y moviendo otro, el tercero queda determinado.' };
      },
      hud() { return []; },
      actions() { return []; },
      experiments: [
        { title: 'Primera marcha de una caja automática', text: 'Corona frenada, entrada por el sol: gran reducción (1 + k).', set: { mode: 'reductora' } },
        { title: 'Marcha atrás', text: 'Portasatélites fijo: la corona gira al revés que el sol.', set: { mode: 'inversa' } },
        { title: 'Divisor de potencia del Prius', text: 'Mueve la velocidad de la corona (coche) con el motor a velocidad fija: el generador (sol) cambia de velocidad. Es una "caja de cambios continua" sin correas.', set: { mode: 'divisor', inputRpm: 1500, ringRpm: 600 } },
      ],
      learn: `
<h3>¿Qué es?</h3>
<p>Un tren epicicloidal tiene un <b>sol</b> central, varios <b>satélites</b> que giran a su alrededor montados en un <b>portasatélites</b>, y una <b>corona</b> con dentado interior. Es compacto, reparte la carga entre varios dientes y permite obtener distintas relaciones bloqueando un elemento u otro.</p>
<h3>Ecuación de Willis</h3>
<p>(ω<sub>s</sub> − ω<sub>c</sub>)/(ω<sub>r</sub> − ω<sub>c</sub>) = −Z<sub>r</sub>/Z<sub>s</sub></p>
<h3>Dónde se usa</h3>
<ul><li>Cajas de cambios automáticas (varios trenes en serie).</li><li>Divisor de potencia de los híbridos Toyota (e-CVT).</li><li>Reductoras de turbofanes con engranajes, molinos eólicos, bicicletas con cambio interno.</li></ul>`,
      dispose() { disposeTree(root); },
    };
    return inst;
  },
};

// ======================= DIFERENCIAL =======================

function bevelGear(teeth, rBig, rSmall, h, mat, name, desc) {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(rSmall, rBig, h, 32), mat, name, desc);
  g.add(body);
  const slant = Math.atan2(rBig - rSmall, h);
  for (let i = 0; i < teeth; i++) {
    const a = i / teeth * TAU;
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(rBig * 0.12, Math.hypot(h, rBig - rSmall) * 0.95, rBig * 0.14), mat);
    const r = (rBig + rSmall) / 2 + rBig * 0.05;
    tooth.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    tooth.rotation.y = -a;
    tooth.rotateZ(slant);
    g.add(tooth);
  }
  return g;
}

function buildDiff(v) {
  const root = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a63a, metalness: 0.85, roughness: 0.3 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x5b84c8, metalness: 0.8, roughness: 0.35 });
  const green = new THREE.MeshStandardMaterial({ color: 0x59b07a, metalness: 0.75, roughness: 0.35 });
  // portadiferencial (gira con la corona)
  const carrier = new THREE.Group();
  const ring = mesh(gearGeometry(41, 0.0055, 0.03, { bore: 0.06 }), gold, 'Corona del diferencial', 'Recibe el par del piñón de ataque. Relación del grupo final = dientes de la corona / dientes del piñón (41/11 = 3,73).');
  ring.rotation.y = Math.PI / 2;
  ring.position.x = 0.09;
  carrier.add(ring);
  const housing = mesh(new THREE.SphereGeometry(0.085, 32, 20), mats.glass, 'Caja de satélites', 'Gira solidaria con la corona y arrastra el eje de los satélites.');
  housing.castShadow = false;
  carrier.add(housing);
  const cross = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 10), mats.steel, 'Eje de satélites', 'Atraviesa la caja; los satélites giran libres sobre él.');
  carrier.add(cross);
  const spiders = [];
  for (const s of [-1, 1]) {
    const sp = bevelGear(10, 0.032, 0.018, 0.026, green, 'Satélite del diferencial', 'Gira sobre su eje solo cuando las ruedas van a distinta velocidad (en curva o si una patina). En recta no gira: todo se mueve en bloque.');
    sp.position.y = s * 0.05;
    if (s > 0) sp.rotation.z = Math.PI;
    const holder = new THREE.Group(); holder.add(sp);
    carrier.add(holder);
    spiders.push({ g: sp, s });
  }
  root.add(carrier);
  const sides = [];
  for (const s of [-1, 1]) {
    const sg = bevelGear(16, 0.042, 0.024, 0.03, blue, s < 0 ? 'Planetario izquierdo' : 'Planetario derecho', 'Engranaje unido al palier de cada rueda.');
    sg.rotation.z = s < 0 ? -Math.PI / 2 : Math.PI / 2;
    sg.position.x = s * 0.05;
    const holder = new THREE.Group(); holder.add(sg);
    const axle = cylX(0.012, 0.62, mats.steel);
    part(axle, s < 0 ? 'Palier izquierdo' : 'Palier derecho', 'Semieje que lleva el par a la rueda.');
    axle.position.x = s * 0.38;
    holder.add(axle);
    const wheel = new THREE.Group();
    const tire = mesh(new THREE.TorusGeometry(0.2, 0.07, 16, 40), mats.rubber, 'Neumático', 'La adherencia con el suelo limita el par que puede transmitir la rueda.');
    tire.rotation.y = Math.PI / 2;
    wheel.add(tire);
    const rim = cylX(0.17, 0.12, mats.alu);
    part(rim, 'Llanta', '');
    wheel.add(rim);
    for (let k = 0; k < 5; k++) {
      const spoke = mesh(new THREE.BoxGeometry(0.02, 0.3, 0.035), mats.darkSteel);
      spoke.rotation.x = k * TAU / 5;
      spoke.position.x = s * 0.065;
      wheel.add(spoke);
    }
    wheel.position.x = s * 0.72;
    holder.add(wheel);
    root.add(holder);
    const patch = mesh(new THREE.BoxGeometry(0.4, 0.01, 0.9), new THREE.MeshStandardMaterial({ color: 0x3c4048, roughness: 0.9 }), 'Firme', '');
    patch.position.set(s * 0.72, -0.275, 0);
    patch.castShadow = false;
    root.add(patch);
    sides.push({ holder, s, patch });
  }
  const pinion = mesh(gearGeometry(11, 0.0055, 0.03, { bore: 0.008 }), mats.steel, 'Piñón de ataque', 'Viene del árbol de transmisión (motor y caja). Engrana con la corona a 90°.');
  const pinG = new THREE.Group();
  pinG.add(pinion);
  const pshaft = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.45, 12), mats.steel, 'Árbol de transmisión', 'Trae el par desde la caja de cambios.');
  pshaft.geometry.rotateX(Math.PI / 2);
  pshaft.position.z = 0.24;
  pinG.add(pshaft);
  pinG.position.set(0.09 - 0.022, 0, 0.11 + 0.012);
  root.add(pinG);
  const ang = { c: 0, L: 0, R: 0, sp: 0 };
  function update(st, dt) {
    ang.L += st.wL * dt; ang.R += st.wR * dt; ang.c += st.wC * dt;
    const sp = (st.wL - st.wR) / 2 * (16 / 10);
    ang.sp += sp * dt;
    carrier.rotation.x = ang.c;
    sides[0].holder.rotation.x = ang.L;
    sides[1].holder.rotation.x = ang.R;
    spiders.forEach((s) => { s.g.rotation.y = s.s * ang.sp; });
    pinion.rotation.z = -ang.c * 41 / 11;
    sides[0].patch.material.color.setHex(v.muLeft < 0.3 ? 0xcfe8ff : 0x3c4048);
    sides[1].patch.material.color.setHex(v.muRight < 0.3 ? 0xcfe8ff : 0x3c4048);
  }
  return { group: root, update, size: new THREE.Vector3(1.9, 0.6, 1.0), center: new THREE.Vector3(0, 0, 0.05) };
}

export const DIFFERENTIAL = {
  id: 'differential', name: 'Diferencial del eje motriz', short: 'Diferencial', category: 'Mecanismos',
  desc: 'Permite que las ruedas giren a distinta velocidad en curva.',
  params() {
    return [
      { id: 'speed', label: 'Velocidad del coche', type: 'range', min: 0, max: 120, step: 1, unit: 'km/h', group: 'Situación' },
      { id: 'radius', label: 'Radio de la curva', type: 'range', min: 5, max: 1000, step: 1, unit: 'm', group: 'Situación', format: (v) => (v >= 999 ? 'recta' : `${v} m`), help: 'Desliza a la derecha del todo para ir en recta.' },
      { id: 'muLeft', label: 'Adherencia rueda izquierda μ', type: 'range', min: 0.05, max: 1.1, step: 0.01, group: 'Situación', help: '0,9 asfalto seco · 0,5 mojado · 0,1 hielo' },
      { id: 'muRight', label: 'Adherencia rueda derecha μ', type: 'range', min: 0.05, max: 1.1, step: 0.01, group: 'Situación' },
      { id: 'torque', label: 'Par en la corona', type: 'range', min: 0, max: 3000, step: 10, unit: 'N·m', group: 'Situación' },
      { id: 'mode', label: 'Tipo de diferencial', type: 'select', group: 'Diferencial', options: [{ value: 'abierto', label: 'Abierto (convencional)' }, { value: 'bloqueado', label: 'Bloqueado (todoterreno)' }, { value: 'lsd', label: 'Autoblocante (Torsen / LSD)' }] },
      { id: 'bias', label: 'Relación de reparto del autoblocante', type: 'range', min: 1.5, max: 6, step: 0.1, group: 'Diferencial', visible: (v) => v.mode === 'lsd' },
    ];
  },
  create() {
    const values = { ...DIFF_PRESET };
    const root = new THREE.Group();
    let model = buildDiff(values);
    root.add(model.group);
    let st = differentialState(values);
    return {
      values, root,
      get view() { return { center: model.center.clone(), size: model.size.clone() }; },
      setParam(id, v) { values[id] = v; },
      update(dt) { st = differentialState(values); model.update(st, dt); },
      telemetry() {
        const rpm = (w) => w * 60 / TAU;
        return [
          { title: 'Velocidades de giro', items: [
            { label: 'Rueda izquierda', value: rpm(st.wL), unit: 'rpm', d: 0, warn: st.slipL },
            { label: 'Rueda derecha', value: rpm(st.wR), unit: 'rpm', d: 0, warn: st.slipR },
            { label: 'Corona (media)', value: rpm(st.wC), unit: 'rpm', d: 0 },
            { label: 'Satélites (respecto a la caja)', value: rpm((st.wL - st.wR) / 2 * 1.6), unit: 'rpm', d: 0 },
            { label: 'Diferencia de recorrido en la curva', value: values.radius < 999 ? fmt((values.track / values.radius) * 100, 1) + ' %' : '0 %' },
          ] },
          { title: 'Reparto de par', items: [
            { label: 'Par a la rueda izquierda', value: st.tL, unit: 'N·m', d: 0 },
            { label: 'Par a la rueda derecha', value: st.tR, unit: 'N·m', d: 0 },
            { label: 'Par aprovechado', value: (st.tL + st.tR) / Math.max(1, values.torque) * 100, unit: '%', d: 0, warn: st.tL + st.tR < values.torque * 0.8 },
          ] },
          { title: 'Explicación', items: [{ label: 'Qué pasa', value: st.note || 'Las ruedas giran como pide la trayectoria; el par se reparte a partes iguales.' }] },
        ];
      },
      charts() {
        return [{ title: 'Reparto de velocidad y par', height: 190, draw(ctx, w, h) {
          const rpm = (x) => x * 60 / TAU;
          lineChart(ctx, w, h, { series: [{ xs: [0, 1], ys: [rpm(st.wL), rpm(st.wR)], color: COLORS.a, label: 'rpm' }, { xs: [0, 1], ys: [st.tL, st.tR], color: COLORS.b, axis: 'right', label: 'par (N·m)' }],
            xLabel: 'izquierda ←→ derecha', yLabel: 'rpm', y2Label: 'N·m', xMin: -0.1, xMax: 1.1, yMin: 0, y2Min: 0, markers: [{ x: 0, y: rpm(st.wL), color: COLORS.a }, { x: 1, y: rpm(st.wR), color: COLORS.a }, { x: 0, y: st.tL, color: COLORS.b, axis: 'right' }, { x: 1, y: st.tR, color: COLORS.b, axis: 'right' }] });
        } }];
      },
      phase() {
        const curve = values.radius < 999;
        return { title: curve ? 'En curva' : 'En recta', text: curve ? 'La rueda exterior recorre más camino que la interior. Los satélites giran sobre su eje y permiten la diferencia: ωizq + ωder = 2·ωcorona.' : 'Ambas ruedas giran igual: los satélites no giran sobre su eje y todo el conjunto se mueve en bloque.' };
      },
      hud() { return []; },
      actions() { return []; },
      experiments: [
        { title: 'Curva cerrada', text: 'Radio de 8 m: los satélites giran rápido y la rueda exterior va mucho más deprisa.', set: { radius: 8, speed: 25, muLeft: 0.9, muRight: 0.9 } },
        { title: 'Una rueda sobre hielo', text: 'μ izquierda 0,1 con 2000 N·m: el diferencial abierto manda el mismo (poco) par a ambas ruedas y el coche no avanza.', set: { muLeft: 0.1, muRight: 0.9, torque: 2000, mode: 'abierto', radius: 1000, speed: 5 } },
        { title: 'Solución: autoblocante', text: 'Misma situación con un Torsen: la rueda con agarre recibe varias veces más par.', set: { muLeft: 0.1, muRight: 0.9, torque: 2000, mode: 'lsd', radius: 1000, speed: 5 } },
      ],
      learn: `
<h3>¿Por qué hace falta?</h3>
<p>En una curva, la rueda exterior recorre un arco más largo que la interior. Si estuvieran unidas por un eje rígido, una de ellas tendría que deslizar. El <b>diferencial</b> deja que giren a distinta velocidad mientras reparte el par.</p>
<h3>Cómo funciona</h3>
<ul><li>El piñón de ataque mueve la <b>corona</b>, que arrastra la caja con los <b>satélites</b>.</li><li>Los satélites engranan con los dos <b>planetarios</b>, unidos a las ruedas.</li><li>En recta los satélites no giran sobre sí mismos; en curva sí, y compensan la diferencia.</li></ul>
<h3>Ecuaciones</h3>
<ul><li>Cinemática: ω<sub>izq</sub> + ω<sub>der</sub> = 2·ω<sub>corona</sub></li><li>Par (abierto): T<sub>izq</sub> = T<sub>der</sub> = T<sub>corona</sub>/2, limitado por la rueda con menos agarre.</li></ul>`,
      dispose() { disposeTree(root); },
    };
  },
};
