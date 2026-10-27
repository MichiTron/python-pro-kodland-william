// Automóvil completo: planta motriz real (térmica o eléctrica) + transmisión + dinámica.
import * as THREE from 'three';
import { CombustionEngine, ENGINE_PRESETS } from '../physics/engine.js';
import { ElectricMotor, EV_PRESET } from '../physics/electric.js';
import { Vehicle, VEHICLE_PRESETS } from '../physics/vehicle.js';
import { buildPistonEngine } from './engineModel.js';
import { buildWankel } from './wankel.js';
import { buildElectricMotor } from './electric.js';
import { engineParamDefs, engineTelemetry, pvChart, wotChart, traceChart, enginePhase } from './pistonEngine.js';
import { mats, mesh, part, cylX, cylZ, disposeTree, fmt, gearGeometry } from '../core/kit.js';
import { lineChart, COLORS, Trace } from '../core/charts.js';

const TAU = Math.PI * 2;

const POWERTRAINS = {
  gasolina: { label: 'Gasolina 2.0 atmosférico', kind: 'otto', engine: {}, body: 'compacto' },
  turbo: { label: 'Gasolina 2.0 turbo (deportivo)', kind: 'otto', engine: { turbo: true, boostTarget: 1.0, cr: 9.5, fuel: 'gasolina98' }, body: 'deportivo' },
  diesel: { label: 'Diésel 2.0 turbo', kind: 'diesel', engine: {}, body: 'compacto' },
  wankel: { label: 'Rotativo Wankel 1.3 (2 rotores)', kind: 'wankel', engine: {}, body: 'deportivo' },
  electrico: { label: 'Eléctrico 300 kW (imanes permanentes)', kind: 'ev', engine: {}, body: 'electrico' },
};

function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#3a3d42'; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${200 + Math.random() * 55},${200 + Math.random() * 55},${200 + Math.random() * 55},${Math.random() * 0.08})`; g.fillRect(Math.random() * 256, Math.random() * 512, 2, 2); }
  g.fillStyle = '#e8e8e8'; g.fillRect(8, 0, 6, 512); g.fillRect(242, 0, 6, 512);
  g.fillStyle = '#f2d24a'; g.fillRect(125, 0, 6, 280);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function grassTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#3d5a34'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(${40 + Math.random() * 40},${80 + Math.random() * 60},${30 + Math.random() * 30},0.5)`; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function buildWorld() {
  const world = new THREE.Group();
  const roadTex = roadTexture();
  roadTex.repeat.set(1, 40);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(400, 7.5), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.92 }));
  roadTex.rotation = Math.PI / 2;
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  part(road, 'Carretera', 'El asfalto se desplaza bajo el coche según su velocidad real.');
  world.add(road);
  const gTex = grassTexture();
  gTex.repeat.set(100, 10);
  for (const s of [-1, 1]) {
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(400, 80), new THREE.MeshStandardMaterial({ map: gTex, roughness: 1 }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, -0.01, s * 43.75);
    grass.receiveShadow = true;
    world.add(grass);
  }
  // árboles y postes instanciados
  const nT = 70;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x5a3e28 }), nT);
  const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(1.1, 3, 8), new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.9 }), nT);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 1, 0.1), new THREE.MeshStandardMaterial({ color: 0xeeeeee }), 40);
  trunk.castShadow = crown.castShadow = true;
  const trees = [];
  for (let i = 0; i < nT; i++) trees.push({ x: Math.random() * 400 - 200, z: (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 30), s: 0.7 + Math.random() * 0.8 });
  world.add(trunk, crown, posts);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  let offset = 0;
  function update(dx) {
    offset += dx;
    roadTex.offset.y = -(offset / 10) % 1;
    trees.forEach((t, i) => {
      let x = ((t.x - offset) % 400 + 600) % 400 - 200;
      sc.setScalar(t.s);
      m4.compose(pv.set(x, 0.8 * t.s, t.z), q, sc); trunk.setMatrixAt(i, m4);
      m4.compose(pv.set(x, 2.9 * t.s, t.z), q, sc); crown.setMatrixAt(i, m4);
    });
    for (let i = 0; i < 40; i++) {
      const x = ((i * 20 - offset) % 400 + 600) % 400 - 200;
      m4.compose(pv.set(x, 0.5, (i % 2 ? 1 : -1) * 4.3), q, sc.setScalar(1)); posts.setMatrixAt(i, m4);
    }
    trunk.instanceMatrix.needsUpdate = crown.instanceMatrix.needsUpdate = posts.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { group: world, update };
}

function carBody(xray, color) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  const pts = [[-2.15, 0.32], [-2.2, 0.55], [-2.1, 0.95], [-1.75, 1.0], [-1.25, 1.42], [0.15, 1.45], [0.85, 1.05], [2.0, 0.88], [2.2, 0.7], [2.2, 0.38], [1.75, 0.3], [1.65, 0.48], [1.35, 0.6], [1.05, 0.48], [0.95, 0.3], [-0.95, 0.3], [-1.05, 0.48], [-1.35, 0.6], [-1.65, 0.48], [-1.75, 0.3]];
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  const geo = new THREE.ExtrudeGeometry(s, { depth: 1.66, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3 });
  geo.translate(0, 0, -0.83);
  const mat = new THREE.MeshPhysicalMaterial({ color, metalness: 0.5, roughness: 0.25, clearcoat: 1, transparent: true, opacity: xray ? 0.2 : 0.97, depthWrite: !xray, side: THREE.DoubleSide });
  const body = mesh(geo, mat, 'Carrocería', 'Su forma y su área frontal determinan la resistencia aerodinámica: F = ½·ρ·Cx·A·v².');
  body.castShadow = !xray;
  g.add(body);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: xray ? 0xdde8f5 : 0x222222, transparent: true, opacity: xray ? 0.55 : 0.4 }));
  g.add(edges);
  const win = new THREE.Shape();
  [[-1.68, 1.02], [-1.22, 1.38], [0.12, 1.41], [0.78, 1.06]].forEach(([x, y], i) => (i ? win.lineTo(x, y) : win.moveTo(x, y)));
  const wgeo = new THREE.ExtrudeGeometry(win, { depth: 1.7, bevelEnabled: false });
  wgeo.translate(0, 0, -0.85);
  const wmat = new THREE.MeshPhysicalMaterial({ color: 0x1a2a3a, metalness: 0, roughness: 0.05, transparent: true, opacity: xray ? 0.12 : 0.6, depthWrite: false, side: THREE.DoubleSide });
  g.add(mesh(wgeo, wmat, 'Cristales', ''));
  for (const z of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.32), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 1.2 }));
    hl.position.set(2.24, 0.72, z);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.3), new THREE.MeshStandardMaterial({ color: 0x600000, emissive: 0x300000 }));
    tl.position.set(-2.22, 0.85, z);
    tl.userData.tail = true;
    g.add(tl);
  }
  // interior
  for (const z of [-0.4, 0.4]) {
    const seat = mesh(new THREE.BoxGeometry(0.5, 0.12, 0.45), mats.black, 'Asiento', '');
    seat.position.set(-0.35, 0.55, z);
    g.add(seat);
    const back = mesh(new THREE.BoxGeometry(0.1, 0.6, 0.45), mats.black, 'Asiento', '');
    back.position.set(-0.62, 0.85, z);
    back.rotation.z = 0.2;
    g.add(back);
  }
  const wheel = mesh(new THREE.TorusGeometry(0.18, 0.02, 8, 24), mats.black, 'Volante de dirección', '');
  wheel.position.set(0.25, 1.0, -0.4);
  wheel.rotation.y = Math.PI / 2;
  wheel.rotation.x = 0.4;
  g.add(wheel);
  return { group: g, mat, wmat };
}

function makeWheel(r) {
  const g = new THREE.Group();
  const tire = mesh(new THREE.TorusGeometry(r - 0.07, 0.085, 16, 40), mats.rubber, 'Neumático', 'La fuerza de tracción se transmite al suelo por la huella del neumático. Resistencia a la rodadura: F = Crr·m·g.');
  g.add(tire);
  const rim = cylZ(r - 0.1, 0.16, mats.alu);
  part(rim, 'Llanta', '');
  g.add(rim);
  for (let k = 0; k < 5; k++) {
    const sp = mesh(new THREE.BoxGeometry(0.05, (r - 0.1) * 1.9, 0.04), mats.darkSteel);
    sp.rotation.z = k * TAU / 5;
    sp.position.z = 0.07;
    g.add(sp);
  }
  const disc = cylZ(r * 0.62, 0.025, mats.darkSteel);
  part(disc, 'Disco de freno', 'La pinza aprieta el disco y convierte energía cinética en calor.');
  g.add(disc);
  return g;
}

function buildCar(pt, pkey, values, veh) {
  const root = new THREE.Group();
  const r = veh.p.wheelR;
  const L2 = 1.35, track = 0.78;
  const body = carBody(values.xray, pkey === 'electrico' ? 0x2a7fd4 : pkey === 'turbo' || pkey === 'wankel' ? 0xc8312f : 0xd8dde4);
  root.add(body.group);
  const wheels = [];
  for (const x of [L2, -L2]) for (const z of [-track, track]) {
    const w = makeWheel(r);
    w.position.set(x, r, z);
    if (z < 0) w.rotation.y = Math.PI;
    root.add(w);
    wheels.push({ w, x, z });
  }
  const chassis = mesh(new THREE.BoxGeometry(3.6, 0.06, 1.3), mats.ghost, 'Bastidor', '');
  chassis.position.y = r * 0.75;
  root.add(chassis);
  let engineModel = null;
  const rotators = [];
  const gearPairs = [];
  if (pt.kind !== 'ev') {
    const eg = new THREE.Group();
    engineModel = pt.kind === 'wankel' ? buildWankel(veh.pt) : buildPistonEngine(veh.pt);
    if (pt.kind === 'wankel') { engineModel.group.rotation.y = -Math.PI / 2; eg.position.set(1.05, r + 0.15, 0); }
    else { engineModel.group.rotation.y = Math.PI; eg.position.set(1.15, r + 0.02, 0); }
    eg.add(engineModel.group);
    root.add(eg);
    // embrague + caja
    const gbX = pt.kind === 'wankel' ? 0.62 : 0.68;
    const gbLen = 0.55;
    const gbox = mesh(new THREE.BoxGeometry(gbLen, 0.26, 0.26), mats.glassBlock, 'Caja de cambios', 'Cada marcha es una pareja de engranajes con distinta relación. Marchas cortas multiplican el par para arrancar; largas permiten velocidad con pocas rpm.');
    gbox.position.set(gbX - gbLen / 2, r + 0.02, 0);
    gbox.castShadow = false;
    root.add(gbox);
    const clutch = cylX(0.12, 0.04, mats.brass);
    part(clutch, 'Embrague', 'Une o separa el motor de la caja. Al arrancar patina para que el motor no se cale.');
    clutch.position.set(gbX + 0.03, r + 0.02, 0);
    root.add(clutch);
    const inShaft = cylX(0.015, gbLen, mats.steel); inShaft.position.set(gbX - gbLen / 2, r + 0.07, 0); root.add(inShaft);
    const outShaft = cylX(0.015, gbLen, mats.steel); outShaft.position.set(gbX - gbLen / 2, r - 0.03, 0); root.add(outShaft);
    rotators.push({ obj: clutch, kind: 'engine' }, { obj: inShaft, kind: 'engine' }, { obj: outShaft, kind: 'prop' });
    const gears = veh.p.gears;
    gears.forEach((ratio, i) => {
      const x = gbX - 0.06 - i * (gbLen - 0.1) / gears.length;
      const c = 0.1; const rIn = c / (1 + ratio), rOut = c - rIn;
      const m = 0.006;
      const zi = Math.max(8, Math.round(2 * rIn / m)), zo = Math.max(8, Math.round(2 * rOut / m));
      const gi = mesh(gearGeometry(zi, m, 0.03), mats.steel, `Piñón de ${i + 1}ª`, `Relación ${ratio.toFixed(2)}:1`);
      gi.rotation.y = Math.PI / 2; const gI = new THREE.Group(); gI.add(gi); gI.position.set(x, r + 0.07, 0); root.add(gI);
      const go = mesh(gearGeometry(zo, m, 0.03), mats.steel, `Rueda de ${i + 1}ª`, `Relación ${ratio.toFixed(2)}:1`);
      go.rotation.y = Math.PI / 2; const gO = new THREE.Group(); gO.add(go); gO.position.set(x, r - 0.03, 0); root.add(gO);
      // separar ejes según tamaño real
      gO.position.y = r + 0.07 - (zi + zo) * m / 2;
      const mat = new THREE.MeshStandardMaterial({ color: 0xb8bec7, metalness: 0.9, roughness: 0.3, emissive: 0x000000 });
      gi.material = mat; go.material = mat;
      gearPairs.push({ gI, gO, mat, ratio });
    });
    const prop = cylX(0.025, gbX - gbLen + L2 - 0.15, mats.steel);
    part(prop, 'Árbol de transmisión', 'Lleva el par de la caja al diferencial trasero (propulsión trasera).');
    prop.position.set((gbX - gbLen - L2 + 0.15) / 2, r - 0.03, 0);
    root.add(prop);
    rotators.push({ obj: prop, kind: 'prop' });
  } else {
    const em = buildElectricMotor(veh.pt, { withPower: false });
    em.group.position.set(-L2 + 0.32, r + 0.02, 0);
    root.add(em.group);
    engineModel = em;
    const pack = mesh(new THREE.BoxGeometry(2.0, 0.12, 1.3), new THREE.MeshStandardMaterial({ color: 0x24324a, metalness: 0.4, roughness: 0.5, transparent: true, opacity: 0.7 }), 'Batería de tracción', `${veh.pt.p.capacity} kWh a ${veh.pt.p.vBat} V bajo el suelo: centro de gravedad muy bajo.`);
    pack.position.set(0.05, r * 0.55, 0);
    root.add(pack);
    const soc = mesh(new THREE.BoxGeometry(1.96, 0.08, 1.26), new THREE.MeshStandardMaterial({ color: 0x46d17a, emissive: 0x0a3018 }), 'Carga de la batería', 'Estado de carga (SOC).');
    soc.geometry.translate(0.98, 0, 0);
    soc.position.set(0.05 - 0.98, r * 0.55, 0);
    root.add(soc);
    root.userData.soc = soc;
    const inv = mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), mats.alu, 'Inversor', 'Convierte la corriente continua en trifásica para el motor.');
    inv.position.set(-L2 + 0.75, r + 0.12, 0);
    root.add(inv);
    const red = mesh(new THREE.BoxGeometry(0.22, 0.24, 0.2), mats.glassBlock, 'Reductora de una marcha', `Relación ${veh.p.gears[0]}:1. El motor eléctrico no necesita caja de cambios.`);
    red.position.set(-L2 + 0.08, r, 0);
    root.add(red);
  }
  // diferencial y palieres traseros
  const diff = mesh(new THREE.SphereGeometry(0.13, 20, 14), mats.glassBlock, 'Diferencial', 'Reparte el par entre las ruedas traseras y deja que giren a distinta velocidad en curva.');
  diff.position.set(-L2, r, 0);
  diff.castShadow = false;
  root.add(diff);
  const ring = mesh(gearGeometry(36, 0.006, 0.025), mats.brass, 'Corona del grupo final', `Relación ${veh.p.finalDrive.toFixed(2)}:1`);
  ring.rotation.y = Math.PI / 2;
  const ringG = new THREE.Group(); ringG.add(ring); ringG.position.set(-L2 + 0.03, r, 0); root.add(ringG);
  rotators.push({ obj: ringG, kind: 'wheel', axis: 'z' });
  for (const z of [-1, 1]) {
    const hs = cylZ(0.02, track - 0.15, mats.steel);
    part(hs, 'Palier', 'Semieje del diferencial a la rueda.');
    hs.position.set(-L2, r, z * (track / 2 + 0.05));
    root.add(hs);
    rotators.push({ obj: hs, kind: 'wheel', axis: 'z' });
  }
  return { group: root, body, wheels, engineModel, rotators, gearPairs, tails: body.group.children.filter((c) => c.userData.tail) };
}

export const CAR = {
  id: 'car', name: 'Automóvil completo en carretera', short: 'Automóvil', category: 'Automóvil',
  desc: 'Motor real + embrague + caja + diferencial + dinámica longitudinal.',
  params(values) {
    const pt = POWERTRAINS[values.powertrain];
    const defs = [
      { id: 'throttle', label: 'Acelerador', type: 'range', min: 0, max: 1, step: 0.01, scale: 100, unit: '%', group: 'Conducción', help: 'Tecla W o flecha arriba (al soltar vuelve a 0).' },
      { id: 'brake', label: 'Freno', type: 'range', min: 0, max: 1, step: 0.01, scale: 100, unit: '%', group: 'Conducción', help: 'Tecla S o flecha abajo.' },
      { id: 'autoShift', label: 'Cambio automático', type: 'toggle', group: 'Conducción', visible: () => pt.kind !== 'ev', help: 'Desactívalo y cambia con E (subir) y Q (bajar).' },
      { id: 'grade', label: 'Pendiente de la carretera', type: 'range', min: -12, max: 20, step: 0.5, unit: '%', group: 'Conducción', help: 'F = m·g·sen(α). Un 10 % equivale a subir 10 m cada 100 m.' },
      { id: 'wind', label: 'Viento en contra', type: 'range', min: -60, max: 60, step: 1, unit: 'km/h', group: 'Conducción' },
      { id: 'powertrain', label: 'Planta motriz', type: 'select', group: 'Vehículo', rebuild: true, uiRefresh: true, options: Object.entries(POWERTRAINS).map(([k, p]) => ({ value: k, label: p.label })) },
      { id: 'xray', label: 'Carrocería transparente (rayos X)', type: 'toggle', group: 'Vehículo', rebuild: true },
      { id: 'mass', label: 'Masa', type: 'range', min: 700, max: 3000, step: 10, unit: 'kg', group: 'Vehículo', help: 'Más masa: peor aceleración (F = m·a), más resistencia a la rodadura y en pendiente.' },
      { id: 'cd', label: 'Coeficiente aerodinámico Cx', type: 'range', min: 0.18, max: 0.6, step: 0.01, group: 'Vehículo' },
      { id: 'area', label: 'Área frontal', type: 'range', min: 1.5, max: 4, step: 0.05, unit: 'm²', group: 'Vehículo' },
      { id: 'crr', label: 'Coef. de rodadura Crr', type: 'range', min: 0.006, max: 0.03, step: 0.001, group: 'Vehículo' },
      { id: 'finalDrive', label: 'Relación del grupo final', type: 'range', min: 2.5, max: 5.5, step: 0.01, group: 'Vehículo', visible: () => pt.kind !== 'ev', help: 'Grupo corto (número alto): más aceleración, menos velocidad punta.' },
    ];
    if (pt.kind === 'ev') {
      defs.push(
        { id: 'regen', label: 'Frenada regenerativa', type: 'toggle', group: 'Motor eléctrico', help: 'Al frenar, el motor actúa como generador y recarga la batería.' },
        { id: 'iMax', label: 'Corriente máxima', type: 'range', min: 200, max: 1200, step: 10, unit: 'A', group: 'Motor eléctrico' },
        { id: 'vBat', label: 'Tensión de batería', type: 'range', min: 200, max: 900, step: 10, unit: 'V', group: 'Motor eléctrico' },
        { id: 'evRatio', label: 'Relación de la reductora', type: 'range', min: 6, max: 14, step: 0.1, group: 'Motor eléctrico' },
      );
    } else {
      defs.push(...engineParamDefs(pt.kind, 'Motor').filter((d) => !['idleRpm', 'flywheel'].includes(d.id)));
    }
    return defs;
  },
  create(app) {
    const values = { powertrain: 'gasolina', throttle: 0, brake: 0, autoShift: true, grade: 0, wind: 0, xray: true, regen: true, evRatio: 9 };
    const root = new THREE.Group();
    const world = buildWorld();
    root.add(world.group);
    let pt, veh, car, pkey;
    const carHolder = new THREE.Group();
    root.add(carHolder);
    const trV = new Trace(500), trR = new Trace(500);
    let t = 0, keyThrottle = false, keyBrake = false;

    function setup(key) {
      pkey = key;
      pt = POWERTRAINS[key];
      const body = VEHICLE_PRESETS[pt.body];
      let unit;
      if (pt.kind === 'ev') {
        unit = new ElectricMotor({ ...EV_PRESET, regen: values.regen });
        Object.assign(values, { iMax: EV_PRESET.iMax, vBat: EV_PRESET.vBat });
      } else {
        const base = { ...ENGINE_PRESETS[pt.kind], ...pt.engine };
        unit = new CombustionEngine(base);
        unit.startCrank();
        Object.assign(values, base);
      }
      const vp = { ...body };
      if (pt.kind === 'ev') vp.gears = [values.evRatio];
      veh = new Vehicle(unit, { ...vp, grade: values.grade, wind: values.wind, autoShift: values.autoShift });
      for (const k of ['mass', 'cd', 'area', 'crr', 'finalDrive']) values[k] = veh.p[k];
      rebuildCar();
    }
    function rebuildCar() {
      if (car) { carHolder.remove(car.group); disposeTree(car.group); }
      car = buildCar(pt, pkey, values, veh);
      carHolder.add(car.group);
    }
    setup('gasolina');

    const inst = {
      values, root, ownsGround: true,
      get vehicle() { return veh; },
      get view() { return { center: new THREE.Vector3(0.45, 0.75, 0), size: new THREE.Vector3(4.2, 1.7, 2.0), dir: new THREE.Vector3(0.7, 0.5, 1).normalize() }; },
      setParam(id, v) {
        values[id] = v;
        if (id === 'powertrain') { setup(v); return; }
        if (id === 'xray') { rebuildCar(); return; }
        if (['throttle', 'brake'].includes(id)) return;
        if (['grade', 'wind', 'autoShift', 'mass', 'cd', 'area', 'crr', 'finalDrive'].includes(id)) { veh.p[id] = v; return; }
        if (pt.kind === 'ev') {
          if (id === 'evRatio') { veh.p.gears = [v]; return; }
          veh.pt.setParam(id, v);
          return;
        }
        veh.pt.setParam(id, v);
        if (id === 'ecu' && !v) { values.timing = Math.round((veh.pt.currentTiming ?? 15) * 2) / 2; veh.pt.p.timing = values.timing; if (!veh.pt.isDiesel) { values.lambda = Math.round(veh.pt.currentMix * 100) / 100; veh.pt.p.lambda = values.lambda; } }
        const def = this.def.params(values).find((d) => d.id === id);
        if (def && def.rebuild) rebuildCar();
      },
      keyControl(keys, dt) {
        const up = keys.has('KeyW') || keys.has('ArrowUp');
        const dn = keys.has('KeyS') || keys.has('ArrowDown');
        let changed = false;
        if (up) { values.throttle = Math.min(1, values.throttle + dt * 1.6); keyThrottle = true; changed = true; }
        else if (keyThrottle) { values.throttle = Math.max(0, values.throttle - dt * 3); changed = true; if (values.throttle === 0) keyThrottle = false; }
        if (dn) { values.brake = Math.min(1, values.brake + dt * 2); keyBrake = true; changed = true; }
        else if (keyBrake) { values.brake = Math.max(0, values.brake - dt * 4); changed = true; if (values.brake === 0) keyBrake = false; }
        return changed ? ['throttle', 'brake'] : null;
      },
      onKeyDown(code) {
        if (pt.kind === 'ev') return null;
        if (code === 'KeyE') { veh.shift(1); values.autoShift = false; veh.p.autoShift = false; return ['autoShift']; }
        if (code === 'KeyQ') { veh.shift(-1); values.autoShift = false; veh.p.autoShift = false; return ['autoShift']; }
        return null;
      },
      update(dt) {
        veh.throttle = values.throttle;
        veh.brake = values.brake;
        const x0 = veh.x;
        veh.step(dt);
        world.update(veh.x - x0 + (veh.x < x0 ? 0 : 0));
        // visual
        const wa = veh.wheelAngle;
        car.wheels.forEach((w) => { w.w.rotation.z = (w.z < 0 ? 1 : -1) * -wa; });
        const R = veh.ratio();
        car.rotators.forEach((ro) => {
          if (ro.kind === 'engine') ro.obj.rotation.x = pt.kind === 'ev' ? 0 : veh.pt.theta;
          else if (ro.kind === 'prop') ro.obj.rotation.x = wa * veh.p.finalDrive;
          else ro.obj.rotation.z = -wa;
        });
        car.gearPairs.forEach((gp, i) => {
          const active = veh.gear === i + 1;
          gp.mat.emissive.setHex(active ? 0x2a6a20 : 0x000000);
          gp.gI.rotation.x = pt.kind === 'ev' ? 0 : veh.pt.theta * (veh.clutch > 0.5 ? 1 : 0.3);
          gp.gO.rotation.x = -wa * veh.p.finalDrive;
        });
        if (car.engineModel) car.engineModel.update(veh.pt, dt);
        if (car.group.userData.soc) car.group.userData.soc.scale.x = Math.max(0.02, veh.pt.soc);
        car.tails.forEach((tl) => tl.material.emissive.setHex(values.brake > 0.05 ? 0xff1010 : 0x300000));
        // inclinación visual por aceleración (cabeceo)
        car.body.group.rotation.z = Math.max(-0.03, Math.min(0.03, -veh.acc * 0.004));
        root.rotation.z = Math.atan(values.grade / 100) * 0.5;
        t += dt; trV.push(t, veh.kmh); trR.push(t, pt.kind === 'ev' ? veh.pt.rpm : veh.pt.rpm);
      },
      telemetry() {
        const F = veh.forces;
        const cons = veh.consumption();
        const ev = pt.kind === 'ev';
        const used = ev ? veh.pt.energyUsed / 3.6e6 : veh.pt.fuelUsed / veh.pt.fuel.densidad * 1000;
        const dist = veh.x / 1000;
        const groups = [
          { title: 'Vehículo', items: [
            { label: 'Velocidad', value: veh.kmh, unit: 'km/h', d: 0 },
            { label: 'Aceleración', value: veh.acc / 9.81, unit: 'g', d: 2 },
            { label: 'Marcha', value: ev ? 'Directa (reductora única)' : veh.gear === 0 ? 'Punto muerto' : `${veh.gear}ª (${veh.p.gears[veh.gear - 1].toFixed(2)}:1)${veh.p.autoShift ? ' · auto' : ''}` },
            ...(ev ? [] : [{ label: 'Embrague acoplado', value: veh.clutch * 100, unit: '%', d: 0 }]),
            { label: 'Régimen del motor', value: veh.pt.rpm, unit: 'rpm' },
            { label: 'Potencia en las ruedas', value: F.drive * veh.v / 1000, unit: 'kW', d: 1 },
            { label: '0 a 100 km/h', value: veh.t0100 ? fmt(veh.t0100, 2) + ' s' : veh.runStart !== null ? 'cronometrando…' : 'acelera a fondo desde parado' },
            { label: '400 m salida parada', value: veh.t400 ? fmt(veh.t400, 2) + ' s' : '·' },
          ] },
          { title: 'Fuerzas sobre el coche', items: [
            { label: 'Tracción en las ruedas', value: F.drive, unit: 'N', d: 0 },
            { label: 'Resistencia aerodinámica', value: F.aero, unit: 'N', d: 0, help: '½·ρ·Cx·A·v²: crece con el cuadrado de la velocidad.' },
            { label: 'Resistencia a la rodadura', value: F.roll, unit: 'N', d: 0 },
            { label: 'Componente de la pendiente', value: F.grade, unit: 'N', d: 0 },
            { label: 'Frenos', value: F.brake, unit: 'N', d: 0 },
          ] },
          { title: 'Consumo', items: [
            { label: 'Instantáneo', value: cons ?? '·', unit: cons !== null ? (ev ? 'kWh/100 km' : 'L/100 km') : '', d: 1 },
            { label: 'Distancia recorrida', value: dist, unit: 'km', d: 2 },
            { label: ev ? 'Energía consumida neta' : 'Combustible gastado', value: used, unit: ev ? 'kWh' : 'L', d: 3 },
            { label: 'Medio', value: dist > 0.05 ? used / dist * 100 : '·', unit: dist > 0.05 ? (ev ? 'kWh/100 km' : 'L/100 km') : '', d: 1 },
            ...(ev ? [{ label: 'Batería', value: veh.pt.soc * 100, unit: '%', d: 1 }, { label: 'Autonomía estimada', value: cons && cons > 1 ? veh.pt.soc * veh.pt.p.capacity / cons * 100 : '·', unit: cons && cons > 1 ? 'km' : '', d: 0 }] : []),
          ] },
        ];
        if (!ev) {
          const eg = engineTelemetry(veh.pt);
          groups.push({ title: 'Motor', items: [eg[0].items[0], eg[0].items[2], eg[0].items[3], eg[1].items[0], eg[1].items[1], eg[3].items[1], eg[4].items[0]].filter(Boolean) });
        } else {
          const m = veh.pt;
          groups.push({ title: 'Motor eléctrico', items: [
            { label: 'Par', value: m.torque, unit: 'N·m', d: 0 },
            { label: 'Potencia eléctrica', value: m.Pelec / 1000, unit: 'kW', d: 1 },
            { label: 'Rendimiento', value: Math.abs(m.torque * m.omega) > 500 ? Math.abs(m.efficiency) * 100 : '·', unit: '%', d: 1 },
            { label: 'Regeneración', value: m.Pelec < -500 ? `recuperando ${fmt(-m.Pelec / 1000, 1)} kW` : 'no' },
          ] });
        }
        return groups;
      },
      charts() {
        const charts = [{
          title: 'Diagrama de tracción', note: 'fuerza en las ruedas por marcha frente a la resistencia al avance', height: 230,
          draw(ctx, w, h) {
            const series = [];
            const p = veh.p;
            const palette = [COLORS.a, COLORS.c, COLORS.f, COLORS.b, COLORS.e, COLORS.d];
            let vmax = 60;
            if (pt.kind === 'ev') {
              const c = veh.pt.curve();
              const R = p.gears[0];
              const xs = c.rpms.map((r) => r * TAU / 60 * p.wheelR / R * 3.6), ys = c.torque.map((T) => T * R * p.eta / p.wheelR);
              series.push({ xs, ys, color: COLORS.a, label: 'motor' });
              vmax = Math.max(...xs);
            } else {
              const cv = veh.pt.wotCurve(6);
              if (!cv.done) { ctx.fillStyle = '#aab6c8'; ctx.font = '12px Inter, system-ui, sans-serif'; ctx.fillText('Calculando curvas del motor…', 20, 30); return; }
              p.gears.forEach((g, i) => {
                const R = g * p.finalDrive;
                const xs = cv.rpms.map((r) => r * TAU / 60 * p.wheelR / R * 3.6), ys = cv.torque.map((T) => T * R * p.eta / p.wheelR);
                series.push({ xs, ys, color: palette[i % palette.length], label: `${i + 1}ª` });
                vmax = Math.max(vmax, ...xs);
              });
            }
            const rx = [], ry = [];
            const ga = Math.atan(p.grade / 100);
            for (let v = 0; v <= vmax; v += vmax / 40) { const ms = v / 3.6 + p.wind / 3.6; rx.push(v); ry.push(0.5 * 1.2 * p.cd * p.area * ms * Math.abs(ms) + p.crr * p.mass * 9.81 * Math.cos(ga) + p.mass * 9.81 * Math.sin(ga)); }
            series.push({ xs: rx, ys: ry, color: '#ffffff', dash: [5, 4], label: 'resistencia' });
            lineChart(ctx, w, h, { series, xLabel: 'km/h', yLabel: 'Fuerza (N)', xMin: 0, xMax: vmax, yMin: 0, markers: [{ x: veh.kmh, y: Math.max(0, veh.forces.drive), color: '#fff', label: 'ahora' }] });
          },
        }, traceChart([{ trace: trV, color: COLORS.a, label: 'km/h' }, { trace: trR, color: COLORS.b, label: 'rpm', axis: 'right' }], 'Velocidad y régimen', 'km/h')];
        if (pt.kind !== 'ev') charts.push(wotChart(veh.pt), pvChart(veh.pt));
        return charts;
      },
      phase() {
        if (pt.kind === 'ev') return { title: 'Coche eléctrico', text: values.brake > 0.05 && veh.pt.Pelec < 0 ? 'Frenada regenerativa: el motor funciona como generador y devuelve energía a la batería.' : 'El motor eléctrico entrega su par máximo desde parado; una única reductora basta para todo el rango de velocidades.' };
        const e = veh.pt;
        if (!e.ignition) return { title: 'Motor apagado', text: 'Pulsa Arrancar motor.' };
        if (veh.gear === 0) return { title: 'Punto muerto', text: 'Pisa el acelerador (W): el cambio automático meterá 1ª y el embrague patinará hasta que el coche se mueva.' };
        if (veh.clutch < 0.95 && veh.throttle > 0.02) return { title: 'Embrague patinando', text: 'El disco de embrague desliza para que el motor no se cale mientras el coche gana velocidad. La energía perdida se convierte en calor.' };
        if (veh.shiftTimer > 0) return { title: 'Cambiando de marcha', text: 'Se abre el embrague, se corta el gas y se engrana la siguiente relación. Al acoplar, las rpm caen.' };
        const ph = e.p.kind === 'wankel' ? null : enginePhase(e);
        return { title: `${veh.gear}ª marcha · ${fmt(e.rpm, 0)} rpm`, text: `El motor da ${fmt(e.brakeTorque, 0)} N·m; la caja y el grupo los multiplican por ${fmt(veh.ratio(), 2)} y llegan ${fmt(veh.forces.drive, 0)} N a las ruedas.` + (ph ? ` Cilindro 1: ${ph.title.split('· ').pop()}.` : '') };
      },
      hud() {
        const g = [{ label: 'km/h', value: veh.kmh, max: pt.kind === 'ev' ? 240 : 260, unit: 'km/h', scale: 1 }];
        if (pt.kind !== 'ev') g.push({ label: 'rpm', value: veh.pt.rpm, max: Math.ceil((veh.pt.p.redline + 1000) / 1000) * 1000, red: veh.pt.p.redline, scale: 1000, unit: '×1000 rpm', sub: veh.gear === 0 ? 'N' : String(veh.gear) });
        else g.push({ label: 'kW', value: Math.max(-100, veh.pt.Pelec / 1000), max: 350, unit: 'kW', min: -100 });
        g.bars = [{ label: 'Gas', value: values.throttle, color: '#46d17a' }, { label: 'Freno', value: values.brake, color: '#ff5a5a' }];
        return g;
      },
      actions() {
        const a = [];
        if (pt.kind !== 'ev') {
          const e = veh.pt;
          a.push({ id: 'start', label: e.ignition ? 'Apagar motor' : 'Arrancar motor', primary: !e.ignition, onClick: () => (e.ignition ? e.stop() : e.startCrank()) });
          a.push({ id: 'down', label: '− Marcha (Q)', onClick: () => { veh.shift(-1); values.autoShift = false; veh.p.autoShift = false; app.refreshPanel(); } });
          a.push({ id: 'up', label: '+ Marcha (E)', onClick: () => { veh.shift(1); values.autoShift = false; veh.p.autoShift = false; app.refreshPanel(); } });
          if (e.health < 0.97) a.push({ id: 'repair', label: 'Reparar motor', onClick: () => e.repair() });
        } else a.push({ id: 'charge', label: 'Recargar batería', onClick: () => { veh.pt.soc = 1; } });
        a.push({ id: 'reset', label: 'Reiniciar cronómetro', onClick: () => veh.resetRun() });
        return a;
      },
      experiments: [
        { title: 'Prueba de 0 a 100', text: 'Para el coche, pulsa W y mantén: el cronómetro mide la aceleración. Compara la gasolina con el eléctrico.', set: { throttle: 0, brake: 0, grade: 0 } },
        { title: 'Velocidad punta', text: 'Acelerador a fondo en llano: la velocidad se estabiliza donde la curva de tracción corta a la de resistencia.', set: { throttle: 1, brake: 0, grade: 0 } },
        { title: 'Puerto de montaña', text: 'Pendiente del 12 % a fondo: la componente del peso (m·g·sen α) limita la velocidad; observa cómo el cambio reduce.', set: { grade: 12, throttle: 1 } },
        { title: 'Consumo a 120 frente a 90', text: 'Mantén 90 km/h y luego 120 km/h con el acelerador: el consumo crece mucho por la resistencia aerodinámica (∝ v²).', set: { grade: 0, throttle: 0.3 } },
        { title: 'Eléctrico con regeneración', text: 'Cambia a eléctrico, acelera hasta 100 y frena con S: la batería recupera energía.', set: { powertrain: 'electrico' } },
      ],
      learn: `
<h3>Del motor a la carretera</h3>
<p>El motor solo da par en un rango de rpm. La <b>transmisión</b> adapta ese par y esa velocidad a lo que necesitan las ruedas:</p>
<ol><li><b>Embrague</b>: acopla el motor (patina al arrancar).</li><li><b>Caja de cambios</b>: multiplica el par (marchas cortas) o la velocidad (largas).</li><li><b>Árbol de transmisión y grupo final</b>: otra reducción fija.</li><li><b>Diferencial</b>: reparte el par entre las ruedas motrices.</li></ol>
<h3>Ecuaciones del modelo</h3>
<ul><li>Fuerza de tracción: F = M<sub>motor</sub> · i<sub>marcha</sub> · i<sub>grupo</sub> · η / r<sub>rueda</sub></li>
<li>Resistencia al avance: F<sub>res</sub> = ½·ρ·Cx·A·v² + Crr·m·g·cos α + m·g·sen α</li>
<li>2ª ley de Newton: (m + J<sub>ruedas</sub>/r²)·a = F − F<sub>res</sub> − F<sub>frenos</sub></li>
<li>Embrague con fricción: M<sub>emb</sub> = M<sub>máx</sub>·tanh(Δω/ω₀)</li></ul>
<p>El motor del coche es el mismo simulador termodinámico del banco de pruebas: cada explosión de cada cilindro se calcula en tiempo real.</p>`,
      dispose() { disposeTree(root); },
    };
    return inst;
  },
};
