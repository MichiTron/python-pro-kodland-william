// Motor de reacción turbofán de doble eje.
import * as THREE from 'three';
import { Turbofan, TURBOFAN_PRESET } from '../physics/turbine.js';
import { mats, mesh, part, disposeTree, fmt, glowSprite } from '../core/kit.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lineChart, COLORS, Trace } from '../core/charts.js';
import { traceChart } from './pistonEngine.js';

function bladeRow(n, rIn, rOut, chord, twist, mat, name, desc) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(chord * 0.12, rOut - rIn, chord, 1, 6, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y + (rOut - rIn) / 2) / (rOut - rIn);
    const ang = twist * (0.3 + 0.7 * t);
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setX(i, x * Math.cos(ang) - z * Math.sin(ang));
    pos.setZ(i, x * Math.sin(ang) + z * Math.cos(ang));
  }
  geo.computeVertexNormals();
  geo.translate(0, (rIn + rOut) / 2, 0);
  geo.rotateY(Math.PI / 2);
  const parts = [];
  for (let k = 0; k < n; k++) parts.push(geo.clone().rotateX(k / n * Math.PI * 2));
  g.add(mesh(mergeGeometries(parts), mat, name, desc));
  const hub = mesh(new THREE.CylinderGeometry(rIn, rIn, chord * 0.9, 32), mat, name, desc);
  hub.geometry.rotateZ(Math.PI / 2);
  g.add(hub);
  return g;
}

function buildTurbofan(tf) {
  const p = tf.p;
  const D = p.diameter, R = D / 2;
  const root = new THREE.Group();
  const coreR = R * Math.max(0.28, 0.55 - p.bypass * 0.045);
  const L = D * 2.2;
  const x0 = -L / 2;
  // góndola
  const prof = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const r = R * (1.08 - 0.05 * Math.sin(Math.PI * t)) - (t > 0.75 ? (t - 0.75) * R * 0.25 : 0);
    prof.push(new THREE.Vector2(r, t * L * 0.62));
  }
  const nac = mesh(new THREE.LatheGeometry(prof, 48), mats.glass, 'Góndola (carenado)', 'Envuelve el fan y forma el conducto del flujo secundario (bypass).');
  nac.rotation.z = -Math.PI / 2;
  nac.position.x = x0;
  nac.castShadow = false;
  root.add(nac);
  const coreProf = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    coreProf.push(new THREE.Vector2(coreR * (1 + 0.12 * Math.sin(Math.PI * t)) - (t > 0.8 ? (t - 0.8) * coreR * 0.9 : 0), t * L * 0.78));
  }
  const coreCase = mesh(new THREE.LatheGeometry(coreProf, 40), mats.glassBlock, 'Carcasa del núcleo', 'Separa el flujo primario (núcleo caliente) del secundario (frío).');
  coreCase.rotation.z = -Math.PI / 2;
  coreCase.position.x = x0 + L * 0.18;
  coreCase.castShadow = false;
  root.add(coreCase);

  const lp = new THREE.Group(), hp = new THREE.Group();
  const spinner = mesh(new THREE.ConeGeometry(R * 0.3, R * 0.55, 32), mats.steel, 'Cono de entrada', 'Guía el aire hacia el fan.');
  spinner.rotation.z = Math.PI / 2;
  spinner.position.x = x0 + L * 0.06;
  lp.add(spinner);
  const fan = bladeRow(22, R * 0.28, R * 0.98, R * 0.32, 0.9, mats.alu, 'Fan', `Gran hélice carenada de 22 álabes. Mueve la mayor parte del aire (relación de derivación ${p.bypass}:1) y produce ~80 % del empuje.`);
  fan.position.x = x0 + L * 0.13;
  lp.add(fan);
  const lpc = [];
  for (let s = 0; s < 3; s++) {
    const r = bladeRow(30, coreR * 0.55, coreR * 0.95, R * 0.08, 0.6, mats.steel, 'Compresor de baja', 'Primeras etapas de compresión, en el mismo eje que el fan.');
    r.position.x = x0 + L * (0.22 + s * 0.035);
    lp.add(r); lpc.push(r);
  }
  const hpcN = 9;
  for (let s = 0; s < hpcN; s++) {
    const t = s / (hpcN - 1);
    const r = bladeRow(36, coreR * (0.5 + 0.12 * t), coreR * (0.9 - 0.18 * t), R * 0.05, 0.5, mats.steel, 'Compresor de alta', `Nueve etapas que elevan la presión hasta ${p.opr}:1. Cada etapa aumenta la presión ~1,3 veces.`);
    r.position.x = x0 + L * (0.34 + s * 0.022);
    hp.add(r);
  }
  const comb = mesh(new THREE.TorusGeometry(coreR * 0.7, coreR * 0.14, 12, 40), new THREE.MeshStandardMaterial({ color: 0x9a8a7a, emissive: 0x000000, metalness: 0.6, roughness: 0.4, transparent: true, opacity: 0.85 }), 'Cámara de combustión anular', 'Se inyecta queroseno y arde de forma continua a presión casi constante (ciclo Brayton). La temperatura supera los 1500 °C.');
  comb.rotation.y = Math.PI / 2;
  comb.scale.z = 2.2;
  comb.position.x = x0 + L * 0.58;
  root.add(comb);
  const flame = glowSprite(0xff8a3d, coreR * 2.2);
  flame.position.copy(comb.position);
  root.add(flame);
  for (let s = 0; s < 2; s++) {
    const r = bladeRow(40, coreR * 0.5, coreR * 0.75, R * 0.05, -0.7, new THREE.MeshStandardMaterial({ color: 0xc9b38a, metalness: 0.8, roughness: 0.35 }), 'Turbina de alta', 'Extrae energía de los gases para mover el compresor de alta. Álabes de superaleación monocristal refrigerados.');
    r.position.x = x0 + L * (0.66 + s * 0.03);
    hp.add(r);
  }
  for (let s = 0; s < 4; s++) {
    const r = bladeRow(50, coreR * 0.5, coreR * (0.85 + s * 0.04), R * 0.05, -0.7, mats.steel, 'Turbina de baja', 'Mueve el fan y el compresor de baja a través del eje interior.');
    r.position.x = x0 + L * (0.74 + s * 0.03);
    lp.add(r);
  }
  const shaftLP = mesh(new THREE.CylinderGeometry(coreR * 0.12, coreR * 0.12, L * 0.75, 12), mats.darkSteel, 'Eje de baja (N1)', 'Une el fan con la turbina de baja. Gira más despacio.');
  shaftLP.rotation.z = Math.PI / 2;
  shaftLP.position.x = x0 + L * 0.5;
  lp.add(shaftLP);
  const plug = mesh(new THREE.ConeGeometry(coreR * 0.45, L * 0.18, 24), mats.darkSteel, 'Cono de escape', 'Forma la tobera del flujo primario.');
  plug.rotation.z = -Math.PI / 2;
  plug.position.x = x0 + L * 0.95;
  root.add(plug);
  root.add(lp, hp);
  // chorros
  const plumeMat = new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const plume = new THREE.Mesh(new THREE.ConeGeometry(coreR * 0.75, 1, 32, 1, true), plumeMat);
  plume.geometry.translate(0, -0.5, 0);
  plume.rotation.z = Math.PI / 2;
  plume.position.x = x0 + L * 0.97;
  part(plume, 'Chorro primario', 'Gases calientes que salen a gran velocidad por la tobera.');
  root.add(plume);
  const byMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const byPlume = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.7, R * 0.98, 1, 40, 1, true), byMat);
  byPlume.geometry.translate(0, -0.5, 0);
  byPlume.rotation.z = Math.PI / 2;
  byPlume.position.x = x0 + L * 0.62;
  part(byPlume, 'Chorro secundario (bypass)', 'Aire frío acelerado por el fan. Mover mucho aire despacio es más eficiente que poco aire muy rápido.');
  root.add(byPlume);
  const diamonds = [];
  for (let k = 0; k < 5; k++) {
    const d = glowSprite(0xffd2a0, coreR * 0.8);
    d.visible = false;
    root.add(d); diamonds.push(d);
  }
  // pilón
  const pylon = mesh(new THREE.BoxGeometry(L * 0.7, R * 0.6, R * 0.15), mats.ghost, 'Pilón', 'Une el motor al ala.');
  pylon.position.set(x0 + L * 0.45, R * 1.35, 0);
  root.add(pylon);

  function update(t, dt) {
    lp.rotation.x = -t.theta1;
    hp.rotation.x = -t.theta2;
    const s = t.state;
    const heat = s.lit ? Math.min(1, Math.max(0, (s.T04 - 800) / 1100)) : 0;
    comb.material.emissive.setRGB(heat, heat * 0.4, heat * 0.05);
    flame.visible = s.lit > 0;
    flame.material.opacity = heat;
    const len = Math.max(0.01, s.V9 / 600 * L * (s.fAB > 0 ? 1.6 : 0.7));
    plume.scale.y = len;
    plume.visible = s.V9 > 30;
    plumeMat.color.setHex(s.fAB > 0 ? 0x7fb0ff : 0xff9a3c);
    plumeMat.opacity = s.fAB > 0 ? 0.6 : 0.12 + 0.25 * heat;
    byPlume.scale.y = Math.max(0.01, s.V19 / 300 * L * 0.9);
    byPlume.visible = s.V19 > 20 && p.bypass > 0.2;
    diamonds.forEach((d, k) => { d.visible = s.fAB > 0; d.position.set(x0 + L * 0.97 + (k + 0.7) * len / 6, 0, 0); });
  }
  return { group: root, update, size: new THREE.Vector3(L * 1.6, D * 1.4, D * 1.2), center: new THREE.Vector3(L * 0.15, 0, 0) };
}

export const TURBOFAN = {
  id: 'turbofan', name: 'Motor a reacción turbofán', short: 'Turbofán', category: 'Turbomáquinas',
  desc: 'Ciclo Brayton de doble eje con flujo derivado y postcombustión.',
  params() {
    return [
      { id: 'throttle', label: 'Palanca de potencia', type: 'range', min: 0, max: 1, step: 0.01, scale: 100, unit: '%', group: 'Mando' },
      { id: 'afterburner', label: 'Postcombustión', type: 'toggle', group: 'Mando', help: 'Quema combustible extra detrás de la turbina: mucho más empuje, consumo enorme. Solo en aviones militares.' },
      { id: 'altitude', label: 'Altitud', type: 'range', min: 0, max: 15000, step: 100, unit: 'm', group: 'Condiciones de vuelo', help: 'Atmósfera estándar ISA: el aire es menos denso y más frío con la altura.' },
      { id: 'mach', label: 'Número de Mach', type: 'range', min: 0, max: 0.95, step: 0.01, group: 'Condiciones de vuelo' },
      { id: 'bypass', label: 'Relación de derivación (BPR)', type: 'range', min: 0, max: 12, step: 0.1, group: 'Diseño', rebuild: true, live: false, help: '0 = turborreactor puro. Los aviones comerciales modernos usan 9 a 12.' },
      { id: 'fanPR', label: 'Relación de compresión del fan', type: 'range', min: 1.2, max: 3, step: 0.05, group: 'Diseño' },
      { id: 'opr', label: 'Relación de compresión global', type: 'range', min: 5, max: 50, step: 1, group: 'Diseño', help: 'Más compresión, más rendimiento térmico (como la relación de compresión en un motor de pistón).' },
      { id: 'tit', label: 'Temperatura de entrada a turbina', type: 'range', min: 1100, max: 2000, step: 10, unit: 'K', group: 'Diseño', help: 'Limitada por los materiales de los álabes.' },
      { id: 'eta_c', label: 'Rendimiento del compresor', type: 'range', min: 0.7, max: 0.94, step: 0.01, group: 'Diseño' },
      { id: 'eta_t', label: 'Rendimiento de la turbina', type: 'range', min: 0.75, max: 0.95, step: 0.01, group: 'Diseño' },
      { id: 'diameter', label: 'Diámetro del fan', type: 'range', min: 0.6, max: 3.4, step: 0.05, unit: 'm', group: 'Diseño', rebuild: true, live: false },
    ];
  },
  create() {
    const values = { ...TURBOFAN_PRESET, throttle: 0.2 };
    const tf = new Turbofan({ ...TURBOFAN_PRESET });
    const root = new THREE.Group();
    let model = buildTurbofan(tf);
    root.add(model.group);
    tf.start();
    let t = 0;
    const trF = new Trace(400), trN = new Trace(400);
    return {
      values, root,
      get view() { return { center: model.center.clone(), size: model.size.clone() }; },
      setParam(id, v) {
        values[id] = v;
        if (id === 'throttle') return;
        tf.setParam(id, v);
        if (id === 'bypass' || id === 'diameter') { root.remove(model.group); disposeTree(model.group); model = buildTurbofan(tf); root.add(model.group); }
      },
      update(dt) {
        tf.throttle = values.throttle;
        tf.advance(dt);
        model.update(tf, dt);
        t += dt; trF.push(t, tf.state.thrust / 1000); trN.push(t, tf.n1 * 100);
      },
      telemetry() {
        const s = tf.state;
        const K = (T) => fmt(T - 273.15, 0) + ' °C';
        return [
          { title: 'Actuaciones', items: [
            { label: 'Estado', value: tf.running ? (tf.starter > 0 ? 'Arrancando' : 'En marcha') : 'Apagado' },
            { label: 'Empuje', value: s.thrust / 1000, unit: `kN (${fmt(s.thrust / 9.81, 0)} kgf)`, d: 1 },
            { label: 'Consumo específico TSFC', value: s.tsfc, unit: 'g/(kN·s)', d: 1 },
            { label: 'Consumo de combustible', value: s.mf * 3600, unit: 'kg/h', d: 0 },
            { label: 'Velocidad N1 (fan)', value: tf.n1 * 100, unit: '%', d: 1 },
            { label: 'Velocidad N2 (núcleo)', value: tf.n2 * 100, unit: '%', d: 1 },
            { label: 'Gasto de aire total', value: s.mTot, unit: 'kg/s', d: 0 },
            { label: 'Velocidad de vuelo', value: s.V0 * 3.6, unit: 'km/h', d: 0 },
          ] },
          { title: 'Estaciones del ciclo Brayton', items: [
            { label: '0 · Ambiente', value: `${K(s.amb.T)} · ${fmt(s.amb.P / 1000, 1)} kPa` },
            { label: '2 · Entrada al fan', value: `${K(s.T02)} · ${fmt(s.P02 / 1000, 1)} kPa` },
            { label: '13 · Salida del fan', value: `${K(s.T13)} · ${fmt(s.P13 / 1000, 0)} kPa` },
            { label: '3 · Salida del compresor', value: `${K(s.T03)} · ${fmt(s.P03 / 1000, 0)} kPa` },
            { label: '4 · Entrada a turbina', value: s.lit ? K(s.T04) : '·', warn: s.T04 > 1900 },
            { label: '5 · Salida de turbina', value: s.lit ? `${K(s.T05)} · ${fmt(s.P05 / 1000, 0)} kPa` : '·' },
            { label: 'Velocidad chorro primario', value: s.V9, unit: 'm/s', d: 0 },
            { label: 'Velocidad chorro secundario', value: s.V19, unit: 'm/s', d: 0 },
          ] },
          { title: 'Rendimientos', items: [
            { label: 'Térmico', value: s.etaTh * 100, unit: '%', d: 1 },
            { label: 'Propulsivo', value: s.V0 > 1 ? s.etaP * 100 : '· (avión parado)', unit: s.V0 > 1 ? '%' : '', d: 1, help: 'ηp = 2/(1 + Vchorro/Vvuelo). Por eso conviene mucho aire lento (BPR alto).' },
            { label: 'Global', value: s.V0 > 1 ? s.etaTh * s.etaP * 100 : '·', unit: s.V0 > 1 ? '%' : '', d: 1 },
          ] },
        ];
      },
      charts() {
        return [
          { title: 'Diagrama T-s del flujo primario', note: 'ciclo Brayton real', height: 210, draw(ctx, w, h) {
            const s = tf.state;
            const cp = 1005, R = 287;
            const ent = (T, P) => cp * Math.log(T / s.amb.T) - R * Math.log(P / s.amb.P);
            const pts = [[s.amb.T, s.amb.P], [s.T02, s.P02], [s.T03, s.P03]];
            if (s.lit) { pts.push([s.T04, s.P03 * 0.96], [s.T045, Math.sqrt(s.P03 * s.P05)], [s.T05, s.P05]); if (s.fAB > 0) pts.push([s.T09, s.P05]); pts.push([s.T09 * Math.pow(s.amb.P / s.P05, 0.248), s.amb.P]); }
            const xs = pts.map(([T, P]) => ent(T, P)), ys = pts.map(([T]) => T);
            const labels = s.lit ? ['0', '2', '3', '4', '4.5', '5', ...(s.fAB > 0 ? ['PC'] : []), '9'] : ['0', '2', '3'];
            const xr = Math.max(...xs) - Math.min(...xs) || 100;
            lineChart(ctx, w, h, { series: [{ xs, ys, color: COLORS.b, width: 2 }], xLabel: 'Entropía relativa s (J/kg·K)', yLabel: 'T (K)', yMin: 200, xMin: Math.min(...xs) - xr * 0.05, xMax: Math.max(...xs) + xr * 0.1,
              markers: pts.map(([T], i) => ({ x: xs[i], y: T, color: labels[i] === '4' ? COLORS.d : '#fff', label: labels[i] })) });
          } },
          { title: 'Empuje frente a velocidad de vuelo (a la altitud actual)', height: 190, draw(ctx, w, h) {
            const saved = tf.p.mach;
            const xs = [], ys = [], ts = [];
            for (let M = 0; M <= 0.95; M += 0.05) { tf.p.mach = M; const c = tf.cycle(tf.n1); xs.push(M); ys.push(c.thrust / 1000); ts.push(c.tsfc); }
            tf.p.mach = saved;
            lineChart(ctx, w, h, { series: [{ xs, ys, color: COLORS.a, label: 'empuje (kN)' }, { xs, ys: ts, color: COLORS.f, axis: 'right', label: 'TSFC' }], xLabel: 'Mach', yLabel: 'kN', y2Label: 'g/(kN·s)', yMin: 0, markers: [{ x: tf.p.mach, y: tf.state.thrust / 1000, color: '#fff' }] });
          } },
          traceChart([{ trace: trF, color: COLORS.a, label: 'empuje (kN)' }, { trace: trN, color: COLORS.c, label: 'N1 (%)', axis: 'right' }], 'Historial: empuje y N1', 'kN'),
        ];
      },
      phase() {
        if (!tf.running) return { title: 'Motor apagado', text: 'Pulsa Arrancar: un motor de arranque acelera el núcleo y luego se enciende la cámara de combustión.' };
        if (tf.starter > 0) return { title: 'Secuencia de arranque', text: 'El arrancador neumático hace girar N2. Al llegar al 20 % se abre el combustible y los encendedores lo inflaman.' };
        return { title: 'Admisión → compresión → combustión → expansión → escape', text: 'Igual que un motor de pistón, pero cada fase ocurre en un lugar distinto y de forma continua: el fan y el compresor comprimen, la cámara quema, la turbina extrae trabajo y la tobera acelera el chorro (3ª ley de Newton).' };
      },
      hud() { return [{ label: 'N1', value: tf.n1 * 100, max: 110, red: 104, unit: '%' }, { label: 'Empuje', value: tf.state.thrust / 1000, max: Math.max(50, Math.ceil(tf.cycle(1.02).thrust / 1000 / 50) * 50), unit: 'kN' }]; },
      actions() { return [{ id: 'run', label: tf.running ? 'Cortar combustible' : 'Arrancar', primary: !tf.running, onClick: () => (tf.running ? tf.stop() : tf.start()) }]; },
      experiments: [
        { title: 'Despegue', text: 'Nivel del mar, Mach 0 y palanca al 100 %: máximo empuje, como en la carrera de despegue.', set: { altitude: 0, mach: 0, throttle: 1 } },
        { title: 'Crucero', text: '11 000 m y Mach 0,8: el empuje cae a la cuarta parte pero el rendimiento global es máximo.', set: { altitude: 11000, mach: 0.8, throttle: 0.85 } },
        { title: 'Turborreactor de los años 50', text: 'BPR 0, compresión 12:1 y 1200 K. Compara el TSFC con el turbofán moderno.', set: { bypass: 0, opr: 12, tit: 1200, fanPR: 1.2 } },
        { title: 'Postcombustión', text: 'BPR 0,4 (caza) a fondo y postcombustión: empuje enorme y diamantes de choque en el chorro.', set: { bypass: 0.4, opr: 25, afterburner: true, throttle: 1 } },
      ],
      learn: `
<h3>¿Qué es?</h3>
<p>Un turbofán es una turbina de gas que mueve un gran <b>fan</b> carenado. Una pequeña parte del aire entra en el <b>núcleo</b>, donde se comprime, se quema con queroseno y se expande en las turbinas; la mayor parte rodea el núcleo (<b>bypass</b>) y produce casi todo el empuje.</p>
<h3>Ciclo Brayton</h3>
<ul><li>Compresión adiabática (2→3), combustión a presión constante (3→4), expansión en turbina (4→5) y en tobera (5→9).</li>
<li>La turbina de alta mueve el compresor de alta (eje N2) y la de baja mueve el fan (eje N1).</li>
<li>Empuje: F = ṁ·(V<sub>chorro</sub> − V<sub>vuelo</sub>).</li>
<li>Rendimiento propulsivo: η<sub>p</sub> = 2/(1 + V<sub>chorro</sub>/V<sub>vuelo</sub>).</li></ul>
<h3>Comparación</h3>
<p>Es otro "motor de combustión interna", pero continuo y de flujo. Su gran ventaja es la potencia por kilogramo: un motor de 1,8 m de fan da el equivalente a decenas de miles de caballos.</p>`,
      dispose() { disposeTree(root); },
    };
  },
};
