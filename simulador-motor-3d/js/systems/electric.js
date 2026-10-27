// Motor eléctrico síncrono de imanes permanentes con inversor y batería.
import * as THREE from 'three';
import { ElectricMotor, EV_PRESET } from '../physics/electric.js';
import { mats, mesh, part, disposeTree, fmt } from '../core/kit.js';
import { lineChart, heatmap, COLORS, Trace } from '../core/charts.js';
import { traceChart } from './pistonEngine.js';

const TAU = Math.PI * 2;
const PHASE_COLORS = [new THREE.Color(0xff5a5a), new THREE.Color(0x5aff7a), new THREE.Color(0x5a8cff)];

export function buildElectricMotor(motor, opts = {}) {
  const root = new THREE.Group();
  const slots = 12, poles = motor.p.poles;
  const Ro = 0.11, Ry = 0.088, Rt = 0.062, len = 0.12;
  // estátor con dientes
  const shape = new THREE.Shape();
  shape.absarc(0, 0, Ro, 0, TAU, false);
  const hole = new THREE.Path();
  const step = TAU / slots;
  for (let i = 0; i < slots; i++) {
    const a = i * step;
    const tw = step * 0.22, sw = step * 0.5;
    const pts = [[Ry, a - sw], [Ry, a - tw], [Rt, a - tw * 1.6], [Rt, a + tw * 1.6], [Ry, a + tw], [Ry, a + sw]];
    pts.forEach(([r, ang], k) => { const x = r * Math.cos(ang), y = r * Math.sin(ang); if (i === 0 && k === 0) hole.moveTo(x, y); else hole.lineTo(x, y); });
  }
  shape.holes.push(hole);
  const statorGeo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments: 48 });
  statorGeo.translate(0, 0, -len / 2);
  const stator = mesh(statorGeo, new THREE.MeshStandardMaterial({ color: 0x59606b, metalness: 0.7, roughness: 0.5, transparent: true, opacity: 0.75 }), 'Estátor',
    `Paquete de chapas de acero al silicio con ${slots} ranuras. Las bobinas, alimentadas con corriente trifásica, crean un campo magnético giratorio.`);
  root.add(stator);
  const coils = [];
  for (let i = 0; i < slots; i++) {
    const a = i * step;
    const ph = i % 3;
    const mat = new THREE.MeshStandardMaterial({ color: 0xc8733b, metalness: 0.8, roughness: 0.35, emissive: 0x000000 });
    const end = mesh(new THREE.TorusGeometry(0.014, 0.005, 8, 14), mat);
    end.position.set(Math.cos(a) * (Ry + Rt) / 2, Math.sin(a) * (Ry + Rt) / 2, len / 2 + 0.006);
    end.rotation.z = a;
    root.add(end);
    const end2 = end.clone(); end2.position.z = -len / 2 - 0.006; root.add(end2);
    const bar = mesh(new THREE.BoxGeometry(0.012, 0.022, len + 0.012), mat);
    bar.position.set(Math.cos(a) * (Ry + Rt) / 2, Math.sin(a) * (Ry + Rt) / 2, 0);
    bar.rotation.z = a;
    part(bar, `Bobina fase ${'ABC'[ph]}`, `Bobina de cobre de la fase ${'ABC'[ph]} arrollada sobre el diente. Brilla según su corriente.`);
    root.add(bar);
    coils.push({ mat, ph });
  }
  // rotor
  const rotor = new THREE.Group();
  const core = mesh(new THREE.CylinderGeometry(0.052, 0.052, len, 48), mats.darkSteel, 'Rotor', 'Núcleo de chapas con imanes permanentes de neodimio. Sigue al campo giratorio del estátor de forma síncrona.');
  core.geometry.rotateX(Math.PI / 2);
  rotor.add(core);
  for (let k = 0; k < poles; k++) {
    const a = k * TAU / poles;
    const mag = mesh(new THREE.CylinderGeometry(0.058, 0.058, len * 0.98, 12, 1, false, a - TAU / poles * 0.42, TAU / poles * 0.84),
      k % 2 ? mats.blue : mats.red, k % 2 ? 'Imán polo Sur' : 'Imán polo Norte', 'Imán permanente (NdFeB). Los polos alternan N-S alrededor del rotor.');
    mag.geometry.rotateX(Math.PI / 2);
    rotor.add(mag);
  }
  const shaft = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.36, 20), mats.steel, 'Eje', 'Entrega el par mecánico.');
  shaft.geometry.rotateX(Math.PI / 2);
  rotor.add(shaft);
  const key = mesh(new THREE.BoxGeometry(0.006, 0.006, 0.05), mats.red, 'Chaveta', 'Marca visible del giro del eje.');
  key.position.set(0, 0.016, 0.15);
  rotor.add(key);
  root.add(rotor);
  // flecha del campo
  const arrow = new THREE.Group();
  const shaftA = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.08, 0.004), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
  shaftA.position.y = 0.04;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.02, 12), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
  tip.position.y = 0.09;
  arrow.add(shaftA, tip);
  arrow.position.z = len / 2 + 0.03;
  part(shaftA, 'Campo magnético del estátor', 'Dirección del campo creado por las tres fases. Gira a la velocidad de sincronismo y "arrastra" a los imanes del rotor.');
  root.add(arrow);
  // carcasa con aletas
  const housing = mesh(new THREE.CylinderGeometry(Ro + 0.012, Ro + 0.012, len + 0.06, 48, 1, true), mats.glass, 'Carcasa', 'Carcasa con camisa de refrigeración líquida.');
  housing.geometry.rotateX(Math.PI / 2);
  housing.castShadow = false;
  root.add(housing);
  // inversor y batería
  let inverter = null, battery = null, socBar = null;
  if (opts.withPower !== false) {
    inverter = mesh(new THREE.BoxGeometry(0.12, 0.05, 0.1), new THREE.MeshStandardMaterial({ color: 0x8c96a3, metalness: 0.6, roughness: 0.4, transparent: true, opacity: 0.55 }), 'Inversor', 'Convierte la corriente continua de la batería en trifásica de frecuencia variable mediante transistores IGBT/SiC conmutando a ~10 kHz.');
    inverter.position.set(0, Ro + 0.07, -0.08);
    root.add(inverter);
    battery = mesh(new THREE.BoxGeometry(0.42, 0.06, 0.26), new THREE.MeshStandardMaterial({ color: 0x24324a, metalness: 0.4, roughness: 0.5, transparent: true, opacity: 0.6 }), 'Batería de iones de litio', `Pack de ${motor.p.vBat} V y ${motor.p.capacity} kWh. Su tensión baja con la carga y al descargarse.`);
    battery.position.set(0, -Ro - 0.12, 0);
    root.add(battery);
    socBar = mesh(new THREE.BoxGeometry(0.4, 0.04, 0.24), new THREE.MeshStandardMaterial({ color: 0x46d17a, emissive: 0x0a3018 }), 'Carga de la batería', 'Estado de carga (SOC).');
    socBar.geometry.translate(0.2, 0, 0);
    socBar.position.set(-0.2, -Ro - 0.12, 0);
    root.add(socBar);
    for (const [y0, y1, col] of [[Ro + 0.05, Ro + 0.012, 0xff5a5a], [-Ro - 0.09, -Ro - 0.012, 0xff9a3c]]) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, Math.abs(y0 - y1), 8), new THREE.MeshStandardMaterial({ color: col }));
      cable.position.set(0.05, (y0 + y1) / 2, -0.06);
      root.add(cable);
    }
  }
  const tmp = new THREE.Color();
  function update(m) {
    rotor.rotation.z = m.theta;
    const I = m.phaseCurrents();
    const Imax = m.p.iMax;
    coils.forEach((c) => {
      const v = I[c.ph] / Imax;
      tmp.copy(PHASE_COLORS[c.ph]).multiplyScalar(Math.abs(v) * 1.4);
      c.mat.emissive.copy(tmp);
    });
    const Imag = Math.hypot(m.id, m.iq);
    arrow.visible = Imag > 1;
    // campo del estátor: adelantado al eje d del rotor por el ángulo de par
    const delta = Math.atan2(-m.id, m.iq);
    arrow.rotation.z = m.theta + (Math.PI / 2 + delta) / (poles / 2) * Math.sign(m.iq || 1) - Math.PI / 2 + Math.PI / poles;
    arrow.scale.setScalar(0.5 + Math.min(1, Imag / Imax));
    if (socBar) { socBar.scale.x = Math.max(0.02, m.soc); socBar.material.color.setHSL(0.33 * m.soc, 0.7, 0.5); }
  }
  return { group: root, update, size: new THREE.Vector3(0.5, 0.5, 0.45), center: new THREE.Vector3(0, -0.02, 0) };
}

export const ELECTRIC = {
  id: 'electric', name: 'Motor eléctrico síncrono (PMSM)', short: 'Eléctrico', category: 'Eléctrico',
  desc: 'Imanes permanentes, inversor trifásico, debilitamiento de campo y batería.',
  params(values) {
    return [
      { id: 'throttle', label: 'Acelerador (par pedido)', type: 'range', min: 0, max: 1, step: 0.01, scale: 100, unit: '%', group: 'Mando' },
      { id: 'loadMode', label: 'Freno dinamométrico', type: 'select', group: 'Mando', uiRefresh: true, options: [{ value: 'libre', label: 'Sin carga' }, { value: 'par', label: 'Par resistente fijo' }, { value: 'rpm', label: 'Mantener rpm constantes' }] },
      { id: 'loadValue', label: values.loadMode === 'rpm' ? 'Régimen objetivo' : 'Par de frenado', type: 'range', min: 0, max: values.loadMode === 'rpm' ? 16000 : 500, step: values.loadMode === 'rpm' ? 100 : 1, unit: values.loadMode === 'rpm' ? 'rpm' : 'N·m', group: 'Mando', visible: (v) => v.loadMode !== 'libre' },
      { id: 'vBat', label: 'Tensión de batería', type: 'range', min: 200, max: 900, step: 10, unit: 'V', group: 'Batería e inversor', live: false, help: 'Más tensión permite mantener el par a más velocidad (la fuerza contraelectromotriz crece con las rpm).' },
      { id: 'iMax', label: 'Corriente máxima del inversor', type: 'range', min: 100, max: 1200, step: 10, unit: 'A', group: 'Batería e inversor', live: false, help: 'Limita el par máximo: T = Kt · I.' },
      { id: 'capacity', label: 'Capacidad de la batería', type: 'range', min: 10, max: 120, step: 1, unit: 'kWh', group: 'Batería e inversor', live: false },
      { id: 'kt', label: 'Constante de par Kt', type: 'range', min: 0.2, max: 1.2, step: 0.01, unit: 'N·m/A', group: 'Motor', live: false, help: 'Más Kt (imanes más fuertes o más espiras): más par por amperio, pero menos velocidad base.' },
      { id: 'poles', label: 'Número de polos', type: 'select', group: 'Motor', rebuild: true, options: [4, 6, 8, 10, 12].map((n) => ({ value: n, label: `${n} polos` })) },
      { id: 'resistance', label: 'Resistencia de fase', type: 'range', min: 0.003, max: 0.06, step: 0.001, unit: 'Ω', group: 'Motor', live: false, help: 'Pérdidas en el cobre: P = 3/2 · R · I².' },
      { id: 'inductance', label: 'Inductancia de fase', type: 'range', min: 0.04, max: 0.4, step: 0.01, unit: 'mH', group: 'Motor', live: false, help: 'Afecta al debilitamiento de campo: corriente característica ψ/L.' },
      { id: 'maxRpm', label: 'Velocidad máxima mecánica', type: 'range', min: 6000, max: 22000, step: 500, unit: 'rpm', group: 'Motor', live: false },
    ];
  },
  create() {
    const values = { ...EV_PRESET, throttle: 0, loadMode: 'par', loadValue: 60 };
    const m = new ElectricMotor({ ...EV_PRESET });
    const root = new THREE.Group();
    let model = buildElectricMotor(m);
    root.add(model.group);
    let dynoI = 0, t = 0;
    const trRpm = new Trace(400), trP = new Trace(400);
    return {
      values, root, motor: m,
      get view() { return { center: model.center.clone(), size: model.size.clone(), front: true }; },
      setParam(id, v) {
        values[id] = v;
        if (['throttle', 'loadMode', 'loadValue'].includes(id)) return;
        m.setParam(id, v);
        if (id === 'poles' || id === 'capacity' || id === 'vBat') { root.remove(model.group); disposeTree(model.group); model = buildElectricMotor(m); root.add(model.group); }
      },
      update(dt) {
        m.throttle = values.throttle;
        let loadFn = null;
        if (values.loadMode === 'par') loadFn = (w) => values.loadValue * Math.tanh(w / 3);
        else if (values.loadMode === 'rpm') {
          const err = m.omega - values.loadValue * TAU / 60;
          dynoI = Math.max(0, Math.min(1000, dynoI + err * dt * 40));
          const T = Math.max(0, err * 3 + dynoI);
          loadFn = () => T;
        }
        m.advance(dt, loadFn);
        model.update(m);
        t += dt; trRpm.push(t, m.rpm); trP.push(t, Math.max(0, m.torque * m.omega / 1000));
      },
      telemetry() {
        const P = m.torque * m.omega;
        const L = m.lossBreakdown || { cu: 0, fe: 0, mech: 0, inv: 0, total: 0 };
        const wBase = (0.95 * m.batteryVoltage(0) / Math.sqrt(3)) / (m.pp * m.psi) * 60 / TAU / m.pp;
        return [
          { title: 'Funcionamiento', items: [
            { label: 'Régimen', value: m.rpm, unit: 'rpm' },
            { label: 'Par', value: m.torque, unit: 'N·m', d: 1 },
            { label: 'Potencia mecánica', value: P / 1000, unit: `kW (${fmt(P / 1000 * 1.3596, 0)} CV)`, d: 1 },
            { label: 'Par máximo disponible ahora', value: m.maxTorqueAt(m.omega), unit: 'N·m', d: 0 },
            { label: 'Velocidad base (fin de par constante)', value: wBase * m.pp, unit: 'rpm', d: 0, help: 'Por encima la tensión no alcanza y hay que debilitar el campo: el par baja y la potencia se mantiene.' },
            { label: 'Frecuencia eléctrica', value: m.rpm / 60 * m.pp, unit: 'Hz', d: 0 },
          ] },
          { title: 'Corrientes (ejes dq)', items: [
            { label: 'Corriente de par iq', value: m.iq, unit: 'A', d: 0 },
            { label: 'Corriente de debilitamiento id', value: m.id, unit: 'A', d: 0, help: 'Negativa por encima de la velocidad base: contrarresta el flujo de los imanes.' },
            { label: 'Corriente de fase (pico)', value: Math.hypot(m.id, m.iq), unit: 'A', d: 0, warn: Math.hypot(m.id, m.iq) > m.p.iMax * 0.98 },
            { label: 'Tensión de batería', value: m.vbat, unit: 'V', d: 0 },
            { label: 'Corriente de batería', value: m.lastCurrent, unit: 'A', d: 0 },
          ] },
          { title: 'Pérdidas y rendimiento', items: [
            { label: 'Cobre (I²R)', value: L.cu / 1000, unit: 'kW', d: 2 },
            { label: 'Hierro (histéresis y Foucault)', value: L.fe / 1000, unit: 'kW', d: 2 },
            { label: 'Mecánicas', value: L.mech / 1000, unit: 'kW', d: 2 },
            { label: 'Inversor', value: L.inv / 1000, unit: 'kW', d: 2 },
            { label: 'Rendimiento', value: P > 100 ? m.efficiency * 100 : '·', unit: P > 100 ? '%' : '', d: 1, good: m.efficiency > 0.9 },
            { label: 'Potencia eléctrica', value: m.Pelec / 1000, unit: 'kW', d: 1 },
            { label: 'Estado de carga', value: m.soc * 100, unit: '%', d: 1 },
          ] },
        ];
      },
      charts() {
        return [
          { title: 'Curva par-velocidad (envolvente máxima)', height: 200, draw(ctx, w, h) {
            const c = m.curve();
            lineChart(ctx, w, h, { series: [{ xs: c.rpms, ys: c.torque, color: COLORS.a, label: 'par máx. (N·m)' }, { xs: c.rpms, ys: c.power, color: COLORS.d, axis: 'right', label: 'potencia (kW)' }],
              xLabel: 'rpm', yLabel: 'N·m', y2Label: 'kW', yMin: 0, y2Min: 0, xMin: 0, xMax: m.p.maxRpm,
              markers: [{ x: m.rpm, y: Math.max(0, m.torque), color: '#fff', label: 'ahora' }] });
          } },
          { title: 'Mapa de rendimiento', note: 'azul 70 % · rojo 97 %', height: 200, draw(ctx, w, h) {
            const c = m.curve();
            heatmap(ctx, w, h, { map: c.map, vMin: 0.7, vMax: 0.97, xMin: 0, xMax: m.p.maxRpm, yMin: 0, yMax: c.Tpk, xLabel: 'rpm', yLabel: 'N·m',
              series: [{ xs: c.rpms, ys: c.torque, color: '#fff', width: 1.2 }], markers: [{ x: m.rpm, y: Math.max(0, m.torque), color: '#fff' }] });
          } },
          { title: 'Corrientes trifásicas', note: 'una vuelta eléctrica', height: 170, draw(ctx, w, h) {
            const I = Math.hypot(m.id, m.iq) || 1;
            const xs = [], a = [], b = [], c = [];
            for (let d = 0; d <= 360; d += 4) { const r = d * Math.PI / 180; xs.push(d); a.push(I * Math.sin(r)); b.push(I * Math.sin(r - TAU / 3)); c.push(I * Math.sin(r + TAU / 3)); }
            const cur = ((m.theta * m.pp * 180 / Math.PI) % 360 + 360) % 360;
            lineChart(ctx, w, h, { series: [{ xs, ys: a, color: '#ff5a5a', label: 'A' }, { xs, ys: b, color: '#5aff7a', label: 'B' }, { xs, ys: c, color: '#5a8cff', label: 'C' }],
              xLabel: 'ángulo eléctrico (°)', yLabel: 'A', xMin: 0, xMax: 360, yMin: -I * 1.1, yMax: I * 1.1, vlines: [{ x: cur, color: '#fff' }] });
          } },
          traceChart([{ trace: trRpm, color: COLORS.a, label: 'rpm' }, { trace: trP, color: COLORS.d, label: 'kW', axis: 'right' }], 'Historial', 'rpm'),
        ];
      },
      phase() {
        const r = m.rpm;
        const wBase = (0.95 * m.batteryVoltage(0) / Math.sqrt(3)) / (m.pp * m.psi) * 60 / TAU;
        if (r < 5 && values.throttle < 0.01) return { title: 'Parado', text: 'Sube el acelerador: el inversor alimentará las bobinas y el campo giratorio arrastrará al rotor.' };
        if (m.id < -5) return { title: 'Zona de potencia constante (debilitamiento de campo)', text: 'La fuerza contraelectromotriz casi iguala a la tensión de la batería. El inversor inyecta corriente id negativa para debilitar el flujo y poder seguir acelerando: el par cae como 1/ω.' };
        return { title: 'Zona de par constante', text: `Por debajo de ~${fmt(wBase, 0)} rpm el par solo está limitado por la corriente máxima. Por eso los coches eléctricos aceleran con fuerza desde parado.` };
      },
      hud() { return [{ label: 'rpm', value: m.rpm, max: m.p.maxRpm, red: m.p.maxRpm * 0.95, scale: 1000, unit: '×1000 rpm' }, { label: 'kW', value: Math.max(0, m.torque * m.omega / 1000), max: Math.ceil(Math.max(...m.curve().power) / 50) * 50, unit: 'kW' }]; },
      actions() { return [{ id: 'charge', label: 'Recargar batería', onClick: () => { m.soc = 1; } }]; },
      experiments: [
        { title: 'Par desde cero rpm', text: 'Freno de par fijo de 300 N·m y acelerador a fondo: el motor arranca con todo su par, algo imposible para un motor térmico.', set: { loadMode: 'par', loadValue: 300, throttle: 1 } },
        { title: 'Debilitamiento de campo', text: 'Sin carga y a fondo: al pasar la velocidad base aparece corriente id negativa y la curva entra en potencia constante.', set: { loadMode: 'libre', throttle: 1 } },
        { title: 'Más tensión', text: 'Sube la batería a 800 V (como Porsche Taycan) y observa cómo la zona de par constante se alarga.', set: { vBat: 800 } },
        { title: 'Mejor rendimiento', text: 'Fija 6000 rpm con el freno y prueba acelerador al 20 % y al 100 %: compara el rendimiento en el mapa.', set: { loadMode: 'rpm', loadValue: 6000, throttle: 0.2 } },
      ],
      learn: `
<h3>¿Qué es?</h3>
<p>Un motor síncrono de imanes permanentes (PMSM) es el tipo que usan casi todos los coches eléctricos. Tiene <b>bobinas fijas en el estátor</b> y <b>imanes en el rotor</b>. El inversor alimenta las tres fases con corrientes senoidales desfasadas 120°, que crean un <b>campo magnético giratorio</b>; los imanes lo siguen y el rotor gira a la misma velocidad (síncrono).</p>
<h3>Ecuaciones del modelo</h3>
<ul>
<li>Par: T = Kt · i<sub>q</sub> = (3/2)·p·ψ·i<sub>q</sub></li>
<li>Límite de tensión: (ω<sub>e</sub>L·i<sub>q</sub>)² + (ω<sub>e</sub>(ψ + L·i<sub>d</sub>))² ≤ V<sub>max</sub>²</li>
<li>Límite de corriente: i<sub>d</sub>² + i<sub>q</sub>² ≤ I<sub>max</sub>²</li>
<li>Pérdidas: cobre (3/2·R·I²), hierro (∝ ω y ω²), mecánicas e inversor</li>
</ul>
<h3>Comparado con un motor de combustión</h3>
<ul><li>Rendimiento del 90 al 97 % frente a 25 a 40 %.</li><li>Par máximo desde 0 rpm: no necesita embrague ni caja de cambios de varias marchas.</li><li>Puede funcionar como generador y recuperar energía al frenar (frenada regenerativa).</li></ul>`,
      dispose() { disposeTree(root); },
    };
  },
};
