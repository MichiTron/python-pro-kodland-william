// Motor rotativo Wankel: carcasa epitrocoidal, rotor triangular, eje excéntrico 3:1.
import * as THREE from 'three';
import { CombustionEngine, ENGINE_PRESETS } from '../physics/engine.js';
import { mats, mesh, part, gearGeometry, ringGearGeometry, glowSprite, flameColor, disposeTree, fmt } from '../core/kit.js';
import { engineParamDefs, engineTelemetry, pvChart, pressureAngleChart, torqueAngleChart, wotChart, traceChart } from './pistonEngine.js';
import { COLORS, Trace } from '../core/charts.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export function buildWankel(eng) {
  const p = eng.p;
  const R = p.rotorRadius / 1000, e = p.eccentricity / 1000;
  const b = (p.faceDisplacement * 1e-6) / (3 * Math.sqrt(3) * R * e);
  const root = new THREE.Group();
  const nR = p.rotors;
  const gap = 0.025;
  const zOf = (r) => (r - (nR - 1) / 2) * (b + gap);
  const housingPts = (offset = 0) => {
    const pts = [];
    for (let i = 0; i < 180; i++) {
      const a = i / 180 * TAU;
      const x = e * Math.cos(3 * a) + (R + offset) * Math.cos(a);
      const y = e * Math.sin(3 * a) + (R + offset) * Math.sin(a);
      pts.push(new THREE.Vector2(x, y));
    }
    return pts;
  };
  const housingShape = new THREE.Shape();
  housingShape.absarc(0, 0, R + e + 0.035, 0, TAU, false);
  housingShape.holes.push(new THREE.Path(housingPts(0.0015).reverse()));
  const housingGeo = new THREE.ExtrudeGeometry(housingShape, { depth: b, bevelEnabled: false, curveSegments: 64 });
  housingGeo.translate(0, 0, -b / 2);

  // rotor: tres flancos en arco
  const sag = (R / 2 - 2 * e - 0.003) * 0.82;
  const flank = (k, nPts) => {
    const a0 = k * TAU / 3, a1 = (k + 1) * TAU / 3;
    const P0 = new THREE.Vector2(R * Math.cos(a0), R * Math.sin(a0));
    const P1 = new THREE.Vector2(R * Math.cos(a1), R * Math.sin(a1));
    const mid = new THREE.Vector2().addVectors(P0, P1).multiplyScalar(0.5);
    const nrm = mid.clone().normalize();
    const pts = [];
    for (let i = 0; i <= nPts; i++) {
      const t = i / nPts;
      const q = new THREE.Vector2().lerpVectors(P0, P1, t).addScaledVector(nrm, sag * 4 * t * (1 - t));
      pts.push(q);
    }
    return pts;
  };
  const rotorShape = new THREE.Shape();
  for (let k = 0; k < 3; k++) flank(k, 24).forEach((q, i) => (k === 0 && i === 0 ? rotorShape.moveTo(q.x, q.y) : rotorShape.lineTo(q.x, q.y)));
  const hole = new THREE.Path(); hole.absarc(0, 0, 3 * e * 1.15, 0, TAU, true); rotorShape.holes.push(hole);
  const rotorGeo = new THREE.ExtrudeGeometry(rotorShape, { depth: b * 0.96, bevelEnabled: false });
  rotorGeo.translate(0, 0, -b * 0.48);
  // rebaje de la cámara de combustión en cada flanco (visual)
  const flankLocal = [0, 1, 2].map((k) => flank(k, 24));

  const zs = 34, module = (4 * e) / zs;
  const statGeo = gearGeometry(zs, module, b * 0.35, { bore: e * 0.9 });
  const ringGeo = ringGearGeometry(Math.round(zs * 1.5), module, b * 0.35, 3 * e * 1.15);

  const rotors = [];
  for (let r = 0; r < nR; r++) {
    const z = zOf(r);
    const housing = mesh(housingGeo, mats.glassBlock, 'Carcasa epitrocoidal', 'La pared interior tiene forma de epitrocoide (como un "8" achatado). Los vértices del rotor la recorren siempre en contacto.');
    housing.position.z = z;
    housing.castShadow = false;
    root.add(housing);
    const rotorG = new THREE.Group();
    rotorG.position.z = z;
    const rotor = mesh(rotorGeo, mats.forged, `Rotor ${r + 1}`, 'Rotor triangular (triángulo de Reuleaux). Cada una de sus 3 caras forma una cámara que completa un ciclo de 4 tiempos por cada vuelta del rotor.');
    rotorG.add(rotor);
    const ring = mesh(ringGeo, mats.darkSteel, 'Engranaje interior del rotor', `Dentado interior (${Math.round(zs * 1.5)} dientes) que engrana con el piñón fijo (${zs} dientes): relación 3:2 que obliga al rotor a girar a 1/3 de la velocidad del eje.`);
    ring.position.z = b * 0.3;
    rotorG.add(ring);
    for (let k = 0; k < 3; k++) {
      const a = k * TAU / 3;
      const seal = mesh(new THREE.BoxGeometry(0.004, 0.006, b * 0.98), mats.brass, 'Segmento de vértice', 'Sella el contacto entre el rotor y la carcasa. Su desgaste era el punto débil de los Wankel.');
      seal.position.set(R * Math.cos(a), R * Math.sin(a), 0);
      seal.rotation.z = a;
      rotorG.add(seal);
    }
    root.add(rotorG);
    const stat = mesh(statGeo, mats.steel, 'Piñón fijo', 'Engranaje fijo a la carcasa alrededor del eje.');
    stat.position.z = z + b * 0.3;
    root.add(stat);
    const ecc = mesh(new THREE.CylinderGeometry(2.3 * e, 2.3 * e, b * 0.9, 32), mats.steel, 'Excéntrica del eje', `Lóbulo desplazado e = ${fmt(e * 1000, 0)} mm del eje. El rotor gira sobre él.`);
    ecc.geometry.rotateX(Math.PI / 2);
    root.add(ecc);
    // cámaras de gas
    const chambers = [];
    const nS = 24;
    for (let k = 0; k < 3; k++) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array((nS + 1) * 2 * 3 * 2);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const idx = [];
      for (const side of [0, 1]) {
        const base = side * (nS + 1) * 2;
        for (let i = 0; i < nS; i++) {
          const a0 = base + i * 2, a1 = a0 + 1, b0 = a0 + 2, b1 = a0 + 3;
          idx.push(a0, b0, a1, a1, b0, b1);
        }
      }
      geo.setIndex(idx);
      const mat = new THREE.MeshBasicMaterial({ color: 0x4fb3ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
      const m = mesh(geo, mat, 'Cámara de trabajo', 'Espacio entre una cara del rotor y la carcasa. Su volumen crece y decrece dos veces por vuelta del rotor (admisión-compresión y expansión-escape).');
      m.castShadow = false;
      m.frustumCulled = false;
      root.add(m);
      chambers.push({ geo, pos, mat, mesh: m });
    }
    // bujías (abajo) y lumbreras (arriba)
    const plugs = [];
    for (const off of [-11, 11]) {
      const a = (270 + off) * DEG;
      const hx = e * Math.cos(3 * a) + R * Math.cos(a), hy = e * Math.sin(3 * a) + R * Math.sin(a);
      const plug = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 10), mats.ceramic, off < 0 ? 'Bujía adelantada' : 'Bujía retrasada', 'Los Wankel usan dos bujías por rotor porque la cámara es alargada y la llama tarda en recorrerla.');
      plug.position.set(hx * 1.12, hy * 1.12 - 0.012, z);
      root.add(plug);
      const spark = glowSprite(0x9fd8ff, 0.03);
      spark.position.set(hx * 1.01, hy * 1.01, z);
      spark.visible = false;
      root.add(spark);
      plugs.push(spark);
    }
    const inPort = mesh(new THREE.BoxGeometry(0.03, 0.02, 0.012), new THREE.MeshStandardMaterial({ color: 0x4fb3ff, emissive: 0x0a2a50 }), 'Lumbrera de admisión lateral', 'Abertura en la placa lateral por la que entra la mezcla. No hay válvulas: el rotor la descubre al pasar.');
    inPort.position.set(-0.035, R - e - 0.012, z + b / 2 + 0.006);
    root.add(inPort);
    const exPort = mesh(new THREE.BoxGeometry(0.025, 0.02, b * 0.7), new THREE.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0x401800 }), 'Lumbrera de escape periférica', 'Salida de gases en la pared de la carcasa.');
    exPort.position.set(0.05, R - e + 0.008, z);
    root.add(exPort);
    rotors.push({ rotorG, ecc, chambers, plugs, z });
  }
  const shaftLen = nR * (b + gap) + 0.2;
  const shaft = mesh(new THREE.CylinderGeometry(e * 1.4, e * 1.4, shaftLen, 24), mats.steel, 'Eje excéntrico', 'Equivale al cigüeñal: da 3 vueltas por cada vuelta del rotor, y en cada vuelta hay una explosión por rotor.');
  shaft.geometry.rotateX(Math.PI / 2);
  root.add(shaft);
  const fly = mesh(new THREE.CylinderGeometry(R * 1.1, R * 1.1, 0.03, 48), mats.castIron, 'Volante de inercia', 'Suaviza el giro.');
  fly.geometry.rotateX(Math.PI / 2);
  fly.position.z = -shaftLen / 2 + 0.03;
  const mark = mesh(new THREE.BoxGeometry(0.02, 0.02, 0.035), mats.red, 'Marca', 'Referencia de giro del eje.');
  mark.position.set(0, R, 0);
  const flyG = new THREE.Group(); flyG.add(fly); mark.position.z = fly.position.z; flyG.add(mark);
  root.add(flyG);

  const hp = housingPts(0.0015);
  const cFresh = new THREE.Color(0x4fb3ff), cComp = new THREE.Color(0x9a6bff), cExh = new THREE.Color(0x8a7f74);
  const tmpA = new THREE.Vector2();

  function update(eng2) {
    const th = eng2.theta;
    shaft.rotation.z = th;
    flyG.rotation.z = th;
    rotors.forEach((ro, r) => {
      const phi = th + (630 - 180 * r) * DEG;
      const cx = e * Math.cos(phi), cy = e * Math.sin(phi);
      const rot = phi / 3;
      ro.rotorG.position.set(cx, cy, ro.z);
      ro.rotorG.rotation.z = rot;
      ro.ecc.position.set(cx, cy, ro.z);
      ro.ecc.rotation.z = phi;
      const cs = Math.cos(rot), sn = Math.sin(rot);
      let fired = false;
      for (let k = 0; k < 3; k++) {
        // puntos del flanco en coordenadas de la carcasa
        const fl = flankLocal[k];
        const ak = rot + k * TAU / 3;
        const ch = ro.chambers[k];
        const nS = fl.length - 1;
        for (let i = 0; i <= nS; i++) {
          const q = fl[i];
          const fx = cx + q.x * cs - q.y * sn, fy = cy + q.x * sn + q.y * cs;
          const a = ak + (TAU / 3) * i / nS;
          const hx = e * Math.cos(3 * a) + (R + 0.0015) * Math.cos(a), hy = e * Math.sin(3 * a) + (R + 0.0015) * Math.sin(a);
          for (const side of [0, 1]) {
            const zz = ro.z + (side ? -1 : 1) * b * 0.47;
            const o = (side * (nS + 1) * 2 + i * 2) * 3;
            ch.pos[o] = fx; ch.pos[o + 1] = fy; ch.pos[o + 2] = zz;
            ch.pos[o + 3] = hx; ch.pos[o + 4] = hy; ch.pos[o + 5] = zz;
          }
        }
        ch.geo.attributes.position.needsUpdate = true;
        ch.geo.computeBoundingSphere();
        // color según el ciclo de la cara (unidad física f = (3-k)%3)
        const f = (3 - k) % 3;
        const u = r * 3 + f;
        const c = eng2.unitCycleDeg(u);
        const cyc = eng2.cycle;
        const T = eng2.sampleTable(cyc.T, c);
        const m = ch.mat;
        let em = 0;
        const burning = cyc.Qtotal > 0 && !cyc.misfire && c >= (cyc.burnStart ?? 999) && c <= cyc.evoDeg;
        if (c < -180) m.color.copy(cFresh);
        else if (!burning && c < cyc.evoDeg) { const pr = eng2.sampleTable(cyc.P, c) / Math.max(cyc.Pivc, 1); m.color.copy(cFresh).lerp(cComp, Math.min(1, (pr - 1) / 12)); }
        else if (c <= cyc.evoDeg) { flameColor(T, m.color); em = Math.min(1.5, Math.max(0, (T - 1100) / 900)); }
        else m.color.copy(cExh);
        if (em > 0) m.color.multiplyScalar(1 + em * 0.3);
        const sp = -eng2.currentTiming;
        if (eng2.ignition && !eng2.fuelCut && c >= sp && c < sp + 6) fired = true;
      }
      ro.plugs.forEach((s) => { s.visible = fired; });
    });
  }
  const size = new THREE.Vector3(2 * (R + e + 0.04), 2 * (R + e + 0.04), shaftLen).multiplyScalar(1.45);
  return { group: root, update, size, center: new THREE.Vector3(0, 0, 0), info: { R, e, b } };
}

function wankelPhase(eng) {
  const c = eng.unitCycleDeg(0);
  const cyc = eng.cycle;
  const burn = -eng.currentTiming;
  const segs = [
    { from: -360, to: -180, color: '#4fb3ff', label: 'Admisión' },
    { from: -180, to: burn, color: '#9a6bff', label: 'Compresión' },
    { from: burn, to: 180, color: '#ff9a3c', label: 'Explosión' },
    { from: 180, to: 360, color: '#8a7f74', label: 'Escape' },
  ];
  let title, text;
  if (c < -180) { title = 'Admisión'; text = 'La cara pasa junto a la lumbrera de admisión y la cámara crece: entra mezcla fresca.'; }
  else if (c < burn) { title = 'Compresión'; text = 'La cámara se estrecha al acercarse a la zona de las bujías.'; }
  else if (c < 180) { title = c < 30 ? 'Combustión' : 'Expansión'; text = 'Las dos bujías encienden la mezcla. La presión empuja la cara del rotor y, a través de la excéntrica, hace girar el eje.'; }
  else { title = 'Escape'; text = 'La cara descubre la lumbrera de escape y la cámara se reduce expulsando los gases.'; }
  return { title: `Cara 1 del rotor 1 · ${title}`, text, wheel: { segs, angle: c, from: -360, span: 720 }, note: 'Ciclo de la cara = 3 vueltas del eje' };
}

export const WANKEL = {
  id: 'wankel', name: 'Motor rotativo Wankel', short: 'Wankel', category: 'Combustión interna',
  desc: 'Rotor triangular en carcasa epitrocoidal: sin pistones ni válvulas.',
  params(values) {
    return [
      { id: 'throttle', label: 'Acelerador', type: 'range', min: 0, max: 1, step: 0.01, scale: 100, unit: '%', group: 'Mando' },
      { id: 'loadMode', label: 'Freno dinamométrico', type: 'select', group: 'Mando', uiRefresh: true, options: [{ value: 'libre', label: 'Sin carga' }, { value: 'par', label: 'Par resistente fijo' }, { value: 'rpm', label: 'Mantener rpm constantes' }] },
      { id: 'loadValue', label: values.loadMode === 'rpm' ? 'Régimen objetivo' : 'Par de frenado', type: 'range', min: values.loadMode === 'rpm' ? 900 : 0, max: values.loadMode === 'rpm' ? 9500 : 400, step: values.loadMode === 'rpm' ? 50 : 1, unit: values.loadMode === 'rpm' ? 'rpm' : 'N·m', group: 'Mando', visible: (v) => v.loadMode !== 'libre' },
      ...engineParamDefs('wankel'),
    ];
  },
  create() {
    const values = { ...ENGINE_PRESETS.wankel, throttle: 0, loadMode: 'libre', loadValue: 5000 };
    const eng = new CombustionEngine({ ...ENGINE_PRESETS.wankel });
    const root = new THREE.Group();
    let model = buildWankel(eng);
    root.add(model.group);
    let dynoI = 0, traceT = 0;
    const trRpm = new Trace(400), trTq = new Trace(400);
    eng.startCrank();
    return {
      values, root, eng,
      get view() { return { center: model.center.clone(), size: model.size.clone(), front: true }; },
      setParam(id, v) {
        values[id] = v;
        if (['throttle', 'loadMode', 'loadValue'].includes(id)) return;
        eng.setParam(id, v);
        if (id === 'ecu' && !v) { values.timing = Math.round((eng.currentTiming ?? 15) * 2) / 2; eng.p.timing = values.timing; values.lambda = Math.round(eng.currentMix * 100) / 100; eng.p.lambda = values.lambda; }
        if (id === 'rotors' || id === 'faceDisplacement') { root.remove(model.group); disposeTree(model.group); model = buildWankel(eng); root.add(model.group); }
      },
      update(dt) {
        eng.prepare(dt, values.throttle);
        let loadFn = null;
        if (values.loadMode === 'par') loadFn = (w) => values.loadValue * Math.tanh(w / 5);
        else if (values.loadMode === 'rpm') {
          const err = eng.omega - values.loadValue * TAU / 60;
          dynoI = Math.max(0, Math.min(800, dynoI + err * dt * 60));
          const T = Math.max(0, err * 8 + dynoI);
          loadFn = () => T;
        }
        eng.advance(dt, loadFn);
        model.update(eng);
        traceT += dt; trRpm.push(traceT, eng.rpm); trTq.push(traceT, Math.max(0, eng.brakeTorque));
      },
      telemetry() {
        const g = engineTelemetry(eng);
        g[2].title = 'Ciclo termodinámico (cara 1)';
        g.splice(1, 0, { title: 'Geometría del rotativo', items: [
          { label: 'Radio generador R', value: model.info.R * 1000, unit: 'mm', d: 0 },
          { label: 'Excentricidad e', value: model.info.e * 1000, unit: 'mm', d: 0 },
          { label: 'Anchura del rotor b', value: model.info.b * 1000, unit: 'mm', d: 0 },
          { label: 'Velocidad del rotor', value: eng.rpm / 3, unit: 'rpm (1/3 del eje)' },
          { label: 'Explosiones por vuelta del eje', value: `${eng.p.rotors} (una por rotor)` },
        ] });
        return g;
      },
      charts() {
        return [pvChart(eng, 'cámara 1'), pressureAngleChart(eng), torqueAngleChart(eng), wotChart(eng), traceChart([{ trace: trRpm, color: COLORS.a, label: 'rpm' }, { trace: trTq, color: COLORS.b, label: 'par (N·m)', axis: 'right' }], 'Historial', 'rpm')];
      },
      phase() { return wankelPhase(eng); },
      hud() { return [{ label: 'rpm', value: eng.rpm, max: 10000, red: eng.p.redline, scale: 1000, unit: '×1000 rpm' }, { label: 'Par', value: Math.max(0, eng.brakeTorque), max: 300, unit: 'N·m' }]; },
      actions() {
        return [{ id: 'start', label: eng.ignition ? 'Apagar motor' : 'Arrancar motor', primary: !eng.ignition, onClick: () => (eng.ignition ? eng.stop() : eng.startCrank()) },
          ...(eng.health < 0.97 ? [{ id: 'repair', label: 'Reparar motor', onClick: () => eng.repair() }] : [])];
      },
      experiments: [
        { title: 'Sube de vueltas', text: 'Sin carga y acelerador a fondo: el Wankel gira muy suave y alto porque no tiene masas alternativas (sin vibraciones de inercia).', set: { throttle: 1, loadMode: 'libre' } },
        { title: 'Consumo frente a un pistón', text: 'Fija 4000 rpm con el freno y compara el consumo específico (g/kWh) con el del gasolina 4T: la cámara alargada pierde más calor.', set: { throttle: 1, loadMode: 'rpm', loadValue: 4000 } },
        { title: 'Tres rotores', text: 'Cambia a 3 rotores (como el 20B del Mazda Cosmo) y observa el par instantáneo, más uniforme.', set: { rotors: 3 } },
      ],
      learn: `
<h3>¿Qué es?</h3>
<p>El motor Wankel (1957) sustituye los pistones por un <b>rotor triangular</b> que gira excéntricamente dentro de una carcasa con forma de <b>epitrocoide</b>. Entre cada cara del rotor y la carcasa queda una cámara que crece y decrece: así se realizan los cuatro tiempos sin válvulas.</p>
<h3>Relaciones clave</h3>
<ul>
<li>El rotor gira a <b>1/3</b> de la velocidad del eje gracias al engranaje interior (3:2).</li>
<li>Cada cara completa un ciclo por vuelta del rotor (3 vueltas del eje) y hay 3 caras: <b>una explosión por vuelta del eje</b> y por rotor (como un 2T, pero con 4 tiempos).</li>
<li>Volumen de cada cara: V(ψ) = V<sub>c</sub> + V<sub>d</sub>/2·(1 − cos ψ), con V<sub>d</sub> = 3√3·R·e·b.</li>
<li>Par: M = Σ p<sub>i</sub>·dV<sub>i</sub>/dφ (principio de trabajos virtuales).</li>
</ul>
<h3>Pros y contras</h3>
<ul><li>Compacto, ligero, muy suave y capaz de muchas rpm.</li><li>Cámara alargada con mucha superficie: pierde calor, combustión lenta, consume más y emite más HC.</li><li>Los segmentos de vértice se desgastan.</li></ul>`,
      dispose() { disposeTree(root); },
    };
  },
};
