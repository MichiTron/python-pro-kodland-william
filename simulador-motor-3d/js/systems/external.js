// Motores de combustión externa: máquina de vapor con regulador de Watt y motor Stirling.
import * as THREE from 'three';
import { SteamEngine, STEAM_PRESET, tSat } from '../physics/steam.js';
import { StirlingEngine, STIRLING_PRESET, GASES } from '../physics/stirling.js';
import { mats, mesh, part, disposeTree, fmt, glowSprite, cylZ, springGeometry } from '../core/kit.js';
import { lineChart, COLORS, Trace } from '../core/charts.js';
import { traceChart } from './pistonEngine.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// ======================= MÁQUINA DE VAPOR =======================

function buildSteam(se) {
  const p = se.p;
  const a = p.stroke / 2000, L = p.rod / 1000, B = p.bore / 1000;
  const root = new THREE.Group();
  const pistonT = 0.06;
  const xHeadEnd = L + a + pistonT / 2 + 0.25 * a + 0.05;      // tapa del cilindro
  const xCrankEnd = L - a - pistonT / 2 - 0.05 + 0.25;
  const cylStart = L - a + 0.17, cylEnd = L + a + 0.2 + pistonT + 0.03;
  const cylLen = cylEnd - cylStart;
  const cy = 0;
  // bancada
  const bed = mesh(new THREE.BoxGeometry(cylEnd + 0.7, 0.08, 0.5), mats.wood, 'Bancada', 'Base de madera y fundición sobre la que se monta la máquina.');
  bed.position.set((cylEnd - 0.7) / 2, -0.85, 0);
  root.add(bed);
  // cilindro
  const cyl = mesh(new THREE.CylinderGeometry(B / 2 + 0.02, B / 2 + 0.02, cylLen, 40, 1, true), mats.glass, 'Cilindro de doble efecto', 'El vapor empuja el pistón alternativamente por ambas caras: dos carreras motrices por vuelta.');
  cyl.rotation.z = Math.PI / 2;
  cyl.position.set((cylStart + cylEnd) / 2, cy, 0);
  cyl.castShadow = false;
  root.add(cyl);
  for (const x of [cylStart, cylEnd]) {
    const cap = mesh(new THREE.CylinderGeometry(B / 2 + 0.04, B / 2 + 0.04, 0.03, 40), mats.castIron, x === cylEnd ? 'Tapa trasera' : 'Tapa delantera con prensaestopas', 'Cierra el cilindro. El vástago la atraviesa por un prensaestopas estanco.');
    cap.rotation.z = Math.PI / 2;
    cap.position.set(x, cy, 0);
    root.add(cap);
  }
  // vapor en cada cara
  const steamGeo = new THREE.CylinderGeometry(B / 2, B / 2, 1, 32);
  steamGeo.rotateZ(Math.PI / 2);
  steamGeo.translate(0.5, 0, 0);
  const headSteamMat = new THREE.MeshStandardMaterial({ color: 0xf0f4ff, transparent: true, opacity: 0.4, depthWrite: false, emissive: 0x000000 });
  const crankSteamMat = headSteamMat.clone();
  const headSteam = mesh(steamGeo, headSteamMat, 'Vapor (cara trasera)', 'Más blanco y opaco = más presión.');
  const crankSteam = mesh(steamGeo, crankSteamMat, 'Vapor (cara delantera)', 'Más blanco y opaco = más presión.');
  headSteam.castShadow = crankSteam.castShadow = false;
  root.add(headSteam, crankSteam);
  const piston = mesh(new THREE.CylinderGeometry(B / 2 * 0.99, B / 2 * 0.99, pistonT, 32), mats.brass, 'Pistón', 'Disco con segmentos que separa las dos cámaras de vapor.');
  piston.rotation.z = Math.PI / 2;
  root.add(piston);
  const prodLen = 0.2 + 2 * a + 0.1;
  const prod = mesh(new THREE.CylinderGeometry(B * 0.09, B * 0.09, 1, 12), mats.steel, 'Vástago', 'Une el pistón con la cruceta.');
  prod.rotation.z = Math.PI / 2;
  root.add(prod);
  const cross = mesh(new THREE.BoxGeometry(0.1, 0.09, 0.12), mats.steel, 'Cruceta', 'Se desliza entre guías y absorbe la fuerza lateral de la biela para que el pistón no la sufra.');
  root.add(cross);
  for (const y of [0.06, -0.06]) {
    const guide = mesh(new THREE.BoxGeometry(2 * a + 0.2, 0.02, 0.16), mats.castIron, 'Guías de la cruceta', 'Mantienen recta la trayectoria.');
    guide.position.set(L, y, 0);
    root.add(guide);
  }
  const rod = new THREE.Group();
  const rodM = mesh(new THREE.BoxGeometry(L, 0.04, 0.03), mats.steel, 'Biela', 'Convierte el vaivén de la cruceta en giro.');
  rodM.position.x = L / 2;
  rod.add(rodM);
  root.add(rod);
  // cigüeñal y volante (eje Z)
  const crank = new THREE.Group();
  const web = mesh(new THREE.BoxGeometry(a * 2.4, 0.06, 0.04), mats.castIron, 'Manivela', `Radio r = ${fmt(a * 1000, 0)} mm (media carrera).`);
  web.position.set(a / 2 * 0.8, 0, 0.09);
  crank.add(web);
  const cpin = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 16), mats.steel, 'Muñequilla', 'Punto de unión de la biela con la manivela.');
  cpin.rotation.x = Math.PI / 2;
  cpin.position.set(a, 0, 0.03);
  crank.add(cpin);
  root.add(crank);
  const shaft = cylZ(0.035, 0.9, mats.steel);
  part(shaft, 'Eje principal', 'Gira apoyado en cojinetes y lleva el volante.');
  root.add(shaft);
  const flyR = 0.25 * Math.pow(p.flywheel / 20, 0.2) + 0.35;
  const fly = new THREE.Group();
  const rim = mesh(new THREE.TorusGeometry(flyR, 0.05, 12, 64), mats.castIron, 'Volante de inercia', `Inercia J = ${p.flywheel} kg·m². Almacena energía entre carreras y mantiene el giro uniforme.`);
  fly.add(rim);
  for (let k = 0; k < 6; k++) {
    const sp = mesh(new THREE.BoxGeometry(flyR * 2, 0.035, 0.025), mats.castIron);
    sp.rotation.z = k * Math.PI / 6;
    fly.add(sp);
  }
  fly.position.z = -0.32;
  root.add(fly);
  // distribución por corredera
  const chestY = B / 2 + 0.09;
  const chest = mesh(new THREE.BoxGeometry(cylLen * 0.8, 0.12, 0.16), mats.glass, 'Caja de distribución', 'Contiene la corredera que reparte el vapor a cada lado del pistón.');
  chest.position.set((cylStart + cylEnd) / 2, chestY, 0);
  chest.castShadow = false;
  root.add(chest);
  const slide = mesh(new THREE.BoxGeometry(cylLen * 0.3, 0.06, 0.12), mats.brass, 'Corredera en D', 'Movida por una excéntrica, abre la lumbrera de admisión de un lado mientras conecta el otro al escape. El corte (cut-off) fija cuánto vapor entra.');
  slide.position.set((cylStart + cylEnd) / 2, chestY - 0.02, 0);
  root.add(slide);
  const eccRod = mesh(new THREE.BoxGeometry(1, 0.015, 0.015), mats.steel, 'Barra de excéntrica', 'Mueve la corredera desfasada ~90° respecto a la manivela.');
  root.add(eccRod);
  // caldera
  const boiler = new THREE.Group();
  const shell = mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.3, 32), new THREE.MeshStandardMaterial({ color: 0x2a3a2e, metalness: 0.5, roughness: 0.5 }), 'Caldera', `Calienta agua a ${p.boiler} bar de presión: el vapor saturado está a ${fmt(tSat(p.boiler + 1) - 273.15, 0)} °C.`);
  shell.rotation.z = Math.PI / 2;
  boiler.add(shell);
  const fire = mesh(new THREE.BoxGeometry(0.4, 0.4, 0.5), mats.castIron, 'Hogar', 'Aquí arde el carbón o la leña: la "combustión externa".');
  fire.position.set(-0.75, -0.15, 0);
  boiler.add(fire);
  const fireGlow = glowSprite(0xff7a2a, 0.6);
  fireGlow.position.set(-0.75, -0.15, 0.26);
  boiler.add(fireGlow);
  const chim = mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.9, 16), mats.castIron, 'Chimenea', 'Evacúa los humos y crea tiro para avivar el fuego.');
  chim.position.set(-0.7, 0.6, 0);
  boiler.add(chim);
  const gauge = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 20), mats.brass, 'Manómetro', 'Indica la presión de la caldera.');
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(0.3, 0.3, 0.2);
  boiler.add(gauge);
  boiler.position.set((cylStart + cylEnd) / 2 + 0.1, 0.25, -0.85);
  root.add(boiler);
  const pipe = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3((cylStart + cylEnd) / 2 + 0.1, 0.57, -0.85), new THREE.Vector3((cylStart + cylEnd) / 2 + 0.1, 0.6, -0.3), new THREE.Vector3((cylStart + cylEnd) / 2, chestY + 0.15, 0), new THREE.Vector3((cylStart + cylEnd) / 2, chestY + 0.06, 0),
  ]), 20, 0.025, 8, false), mats.copper, 'Tubería de vapor', 'Lleva el vapor desde la caldera, pasando por la válvula del regulador.');
  root.add(pipe);
  // regulador de Watt
  const gov = new THREE.Group();
  const spindle = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 10), mats.steel, 'Regulador centrífugo de Watt', 'Al girar más rápido, las bolas se separan por la fuerza centrífuga y cierran la válvula de vapor: control automático por realimentación (1788).');
  spindle.position.y = 0.25;
  gov.add(spindle);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    const bar = mesh(new THREE.BoxGeometry(0.01, 0.22, 0.01), mats.steel);
    bar.position.y = -0.11;
    arm.add(bar);
    const ball = mesh(new THREE.SphereGeometry(0.035, 16, 12), mats.brass, 'Bola del regulador', 'Su altura depende de la velocidad: F centrífuga = m·ω²·r.');
    ball.position.y = -0.22;
    arm.add(ball);
    arm.position.y = 0.48;
    arm.userData.s = s;
    gov.add(arm);
    arms.push(arm);
  }
  const collar = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 12), mats.brass, 'Manguito', 'Sube con las bolas y mueve la palanca de la válvula.');
  gov.add(collar);
  gov.position.set((cylStart + cylEnd) / 2 + 0.2, chestY + 0.12, -0.25);
  root.add(gov);

  function update(s) {
    const th = s.theta;
    crank.rotation.z = th;
    fly.rotation.z = th;
    const sn = Math.sin(th), cs = Math.cos(th);
    const xpin = a * cs + Math.sqrt(L * L - a * a * sn * sn);
    cross.position.set(xpin, 0, 0);
    const xPiston = xpin + 0.2;
    piston.position.set(xPiston + pistonT / 2, cy, 0);
    prod.scale.y = xPiston - xpin;
    prod.position.set((xPiston + xpin) / 2, cy, 0);
    rod.position.set(a * cs, a * sn, 0);
    rod.rotation.z = Math.atan2(-a * sn, xpin - a * cs);
    // vapor: cara delantera (lado manivela) entre cylStart y el pistón; trasera entre pistón y cylEnd
    crankSteam.position.x = cylStart; crankSteam.scale.x = Math.max(0.001, xPiston - cylStart);
    headSteam.position.x = xPiston + pistonT; headSteam.scale.x = Math.max(0.001, cylEnd - xPiston - pistonT);
    const pr = s.pressures(th);
    const ph = (pr.pHead - 1e5) / ((s.p.boiler + 0.01) * 1e5), pc = (pr.pCrank - 1e5) / ((s.p.boiler + 0.01) * 1e5);
    headSteamMat.opacity = 0.12 + 0.6 * Math.max(0, Math.min(1, ph));
    crankSteamMat.opacity = 0.12 + 0.6 * Math.max(0, Math.min(1, pc));
    const ve = 0.06 * Math.cos(th + Math.PI / 2 + 0.25);
    slide.position.x = (cylStart + cylEnd) / 2 + ve;
    const ex = new THREE.Vector3(a * 0.35 * Math.cos(th + Math.PI / 2 + 0.25), a * 0.35 * Math.sin(th + Math.PI / 2 + 0.25), 0.12);
    const sx = new THREE.Vector3(slide.position.x - cylLen * 0.15, chestY - 0.02, 0.12);
    eccRod.position.copy(ex).add(sx).multiplyScalar(0.5);
    eccRod.scale.x = ex.distanceTo(sx);
    eccRod.rotation.z = Math.atan2(sx.y - ex.y, sx.x - ex.x);
    gov.rotation.y = th * 1.5;
    const ang = (12 + 55 * s.ballLift) * DEG;
    arms.forEach((arm) => { arm.rotation.z = arm.userData.s * ang; });
    collar.position.y = 0.28 + 0.12 * s.ballLift;
    fireGlow.visible = s.running;
  }
  return { group: root, update, size: new THREE.Vector3(cylEnd + 0.9, 1.5, 1.6), center: new THREE.Vector3((cylEnd - 0.3) / 2, 0.05, -0.25) };
}

export const STEAM = {
  id: 'steam', name: 'Máquina de vapor de doble efecto', short: 'Vapor', category: 'Combustión externa',
  desc: 'Ciclo Rankine con corredera, expansión y regulador centrífugo de Watt.',
  params() {
    return [
      { id: 'running', label: 'Caldera encendida (válvula abierta)', type: 'toggle', group: 'Mando' },
      { id: 'load', label: 'Carga en el eje (maquinaria)', type: 'range', min: 0, max: 1500, step: 10, unit: 'N·m', group: 'Mando', help: 'Par que consume la fábrica o el molino conectado.' },
      { id: 'governor', label: 'Regulador de Watt activo', type: 'toggle', group: 'Regulación' },
      { id: 'targetRpm', label: 'Velocidad de ajuste del regulador', type: 'range', min: 40, max: 250, step: 1, unit: 'rpm', group: 'Regulación' },
      { id: 'boiler', label: 'Presión de caldera', type: 'range', min: 1, max: 16, step: 0.1, unit: 'bar', group: 'Vapor', help: 'Más presión: más trabajo por carrera y más temperatura de saturación.' },
      { id: 'cutoff', label: 'Corte de admisión', type: 'range', min: 10, max: 85, step: 1, unit: '% de carrera', group: 'Vapor', help: 'Fracción de la carrera con la válvula abierta. Corte temprano: el vapor se expande y se aprovecha mejor (más rendimiento, menos potencia).' },
      { id: 'condenser', label: 'Condensador (vacío en el escape)', type: 'toggle', group: 'Vapor', help: 'Idea de Watt: condensar el escape crea vacío y añade trabajo.' },
      { id: 'bore', label: 'Diámetro del cilindro', type: 'range', min: 100, max: 400, step: 5, unit: 'mm', group: 'Geometría', rebuild: true, live: false },
      { id: 'stroke', label: 'Carrera', type: 'range', min: 150, max: 600, step: 10, unit: 'mm', group: 'Geometría', rebuild: true, live: false },
      { id: 'flywheel', label: 'Inercia del volante', type: 'range', min: 10, max: 600, step: 5, unit: 'kg·m²', group: 'Geometría', rebuild: true, live: false },
    ];
  },
  create() {
    const values = { ...STEAM_PRESET, running: true };
    const se = new SteamEngine({ ...STEAM_PRESET });
    se.running = true;
    const root = new THREE.Group();
    let model = buildSteam(se);
    root.add(model.group);
    let t = 0;
    const trR = new Trace(400), trReg = new Trace(400);
    return {
      values, root,
      get view() { return { center: model.center.clone(), size: model.size.clone() }; },
      setParam(id, v) {
        values[id] = v;
        if (id === 'running') { se.running = v; return; }
        se.setParam(id, v);
        if (['bore', 'stroke', 'flywheel'].includes(id)) { root.remove(model.group); disposeTree(model.group); model = buildSteam(se); root.add(model.group); }
      },
      update(dt) {
        if (se.running && se.omega < 0.3) se.omega += 0.6 * dt; // un empujón para salir de un punto muerto
        se.advance(dt);
        model.update(se);
        t += dt; trR.push(t, se.rpm); trReg.push(t, se.regulator * 100);
      },
      telemetry() {
        const tl = se.telemetry();
        return [
          { title: 'Funcionamiento', items: [
            { label: 'Velocidad', value: se.rpm, unit: 'rpm', d: 1 },
            { label: 'Potencia indicada', value: tl.P / 1000, unit: `kW (${fmt(tl.P / 735.5, 1)} CV)`, d: 2 },
            { label: 'Trabajo por vuelta', value: tl.W / 1000, unit: 'kJ', d: 2 },
            { label: 'Apertura del regulador', value: se.regulator * 100, unit: '%', d: 0 },
          ] },
          { title: 'Vapor', items: [
            { label: 'Temperatura de saturación', value: tSat(se.p.boiler + 1.013) - 273.15, unit: '°C', d: 0 },
            { label: 'Consumo de vapor', value: tl.steamKgH, unit: 'kg/h', d: 0 },
            { label: 'Consumo específico', value: tl.P > 100 ? tl.steamKgH / (tl.P / 1000) : '·', unit: tl.P > 100 ? 'kg/kWh' : '', d: 1 },
            { label: 'Rendimiento global (caldera 70 %)', value: tl.eta * 100, unit: '%', d: 1, help: 'Las máquinas de vapor reales rondaban el 5 al 15 %.' },
          ] },
        ];
      },
      charts() {
        return [
          { title: 'Diagrama indicado (cara trasera)', note: 'presión frente a carrera, como el indicador de Watt', height: 210, draw(ctx, w, h) {
            const ind = se.indicator();
            const pr = se.pressures(se.theta);
            lineChart(ctx, w, h, { series: [{ xs: ind.xs.map((x) => x * 100), ys: ind.ps.map((p) => p / 1e5), color: COLORS.b, width: 2 }], xLabel: 'Carrera (%)', yLabel: 'bar abs', xMin: 0, xMax: 100, yMin: 0, markers: [{ x: pr.x * 100, y: pr.pHead / 1e5, color: '#fff' }] });
          } },
          { title: 'Par en el eje durante una vuelta', height: 180, draw(ctx, w, h) {
            const xs = [], ys = [];
            for (let d = 0; d <= 360; d += 3) { xs.push(d); ys.push(se.torqueAt(d * DEG)); }
            const cur = ((se.theta / DEG) % 360 + 360) % 360;
            lineChart(ctx, w, h, { series: [{ xs, ys, color: COLORS.a }, { xs: [0, 360], ys: [se.p.load, se.p.load], color: COLORS.d, dash: [4, 3], label: 'carga' }], xLabel: 'ángulo (°)', yLabel: 'N·m', xMin: 0, xMax: 360, markers: [{ x: cur, y: se.torqueAt(se.theta), color: '#fff' }] });
          } },
          traceChart([{ trace: trR, color: COLORS.a, label: 'rpm' }, { trace: trReg, color: COLORS.c, label: 'regulador (%)', axis: 'right' }], 'Respuesta del regulador', 'rpm'),
        ];
      },
      phase() {
        const pr = se.pressures(se.theta);
        const head = se.theta % TAU < Math.PI;
        const x = pr.x * 100;
        const cut = se.p.cutoff;
        let t2;
        if (head) t2 = x < cut ? `Admisión por la cara trasera: entra vapor a presión de caldera (hasta el ${cut} % de la carrera).` : 'Expansión: la corredera cerró el paso y el vapor se expande empujando (pV = cte).';
        else t2 = (100 - x) < cut ? `Admisión por la cara delantera (hasta el ${cut} % de la carrera de vuelta).` : 'Expansión en la cara delantera; la trasera descarga al escape.';
        return { title: head ? 'Carrera de ida' : 'Carrera de vuelta', text: t2 + ' El regulador ajusta la válvula según la velocidad.' };
      },
      hud() { return [{ label: 'rpm', value: se.rpm, max: 300, red: 260, unit: 'rpm' }, { label: 'Regulador', value: se.regulator * 100, max: 100, unit: '%' }]; },
      actions() { return []; },
      experiments: [
        { title: 'El regulador en acción', text: 'Con el regulador activo, cambia la carga de 200 a 900 N·m: la velocidad baja un poco y el regulador abre la válvula para compensar.', set: { governor: true, load: 900 } },
        { title: 'Sin regulador', text: 'Desactiva el regulador y quita la carga: la máquina se embala.', set: { governor: false, load: 100 } },
        { title: 'Expansión y rendimiento', text: 'Compara el consumo específico con corte al 70 % y al 20 %: el corte temprano aprovecha la expansión del vapor.', set: { cutoff: 20 } },
        { title: 'El condensador de Watt', text: 'Activa el condensador: el escape queda a 0,2 bar y el diagrama gana área por abajo.', set: { condenser: true } },
      ],
      learn: `
<h3>¿Qué es?</h3>
<p>La máquina de vapor fue el motor de la Revolución Industrial. Es de <b>combustión externa</b>: el fuego calienta agua en una caldera y el vapor a presión empuja un pistón. En el <b>doble efecto</b> el vapor actúa por ambas caras del pistón.</p>
<h3>Elementos clave</h3>
<ul><li><b>Corredera</b>: válvula deslizante movida por una excéntrica que reparte el vapor.</li>
<li><b>Corte de admisión</b>: cerrar pronto la entrada y dejar que el vapor se expanda (pV ≈ cte) ahorra vapor.</li>
<li><b>Cruceta</b> y guías: el pistón no sufre fuerzas laterales.</li>
<li><b>Regulador de Watt</b>: el primer sistema de control automático por realimentación.</li></ul>
<h3>Física</h3>
<ul><li>Trabajo por carrera: W = ∮p·dV = p₁V₁(1 + ln(V₂/V₁)) − p<sub>esc</sub>·V₂ (idealizado).</li>
<li>Rendimiento bajo (5 a 15 %) porque el vapor sale aún caliente y la caldera pierde calor.</li></ul>`,
      dispose() { disposeTree(root); },
    };
  },
};

// ======================= MOTOR STIRLING =======================

function buildStirling(st) {
  const p = st.p;
  const alpha = p.phase * DEG;
  const Vsw = p.swept * 1e-6;
  const B = Math.cbrt(Vsw / (Math.PI / 4) / 1.0); // carrera = diámetro
  const a = B / 2, L = B * 2.2;
  const root = new THREE.Group();
  const angH = Math.PI / 2 + alpha / 2, angC = Math.PI / 2 - alpha / 2;
  const dirH = new THREE.Vector3(Math.cos(angH), Math.sin(angH), 0), dirC = new THREE.Vector3(Math.cos(angC), Math.sin(angC), 0);
  const cylLen = 2 * a + B * 1.0;
  const cyls = [];
  const gasMats = [];
  for (const [dir, hot] of [[dirH, true], [dirC, false]]) {
    const g = new THREE.Group();
    const base = L - a - B * 0.1;
    const c = mesh(new THREE.CylinderGeometry(B / 2 * 1.04, B / 2 * 1.04, cylLen, 32, 1, true), mats.glass, hot ? 'Cilindro caliente (expansión)' : 'Cilindro frío (compresión)', hot ? 'Su culata se calienta con una fuente externa (llama, sol, calor residual).' : 'Se refrigera con aletas o agua. Aquí el gas se comprime frío, lo que cuesta poco trabajo.');
    c.position.y = base + cylLen / 2;
    c.castShadow = false;
    g.add(c);
    const headMat = hot ? new THREE.MeshStandardMaterial({ color: 0x8a3a2a, metalness: 0.6, roughness: 0.4, emissive: 0x000000 }) : new THREE.MeshStandardMaterial({ color: 0x3a5a8a, metalness: 0.6, roughness: 0.4 });
    const head = mesh(new THREE.CylinderGeometry(B / 2 * 1.2, B / 2 * 1.2, B * 0.25, 32), headMat, hot ? 'Calentador' : 'Enfriador', hot ? 'Intercambiador de calor caliente.' : 'Intercambiador de calor frío.');
    head.position.y = base + cylLen + B * 0.12;
    g.add(head);
    for (let k = 0; k < 6; k++) {
      const fin = mesh(new THREE.CylinderGeometry(B * 0.85, B * 0.85, B * 0.03, 32), headMat, hot ? 'Aletas del calentador' : 'Aletas de refrigeración', hot ? 'Captan calor de la fuente.' : 'Disipan calor al ambiente.');
      fin.position.y = base + cylLen - k * B * 0.14 - (hot ? -B * 0.1 : B * 0.05);
      if (!hot || k < 2) g.add(fin);
    }
    const gm = new THREE.MeshStandardMaterial({ color: hot ? 0xff7a4a : 0x4aa8ff, transparent: true, opacity: 0.45, depthWrite: false, emissive: 0x000000 });
    const gas = mesh(new THREE.CylinderGeometry(B / 2, B / 2, 1, 24), gm, hot ? 'Gas caliente' : 'Gas frío', 'El mismo gas va y viene entre los dos cilindros a través del regenerador.');
    gas.geometry.translate(0, 0.5, 0);
    gas.castShadow = false;
    g.add(gas);
    const piston = mesh(new THREE.CylinderGeometry(B / 2 * 0.98, B / 2 * 0.98, B * 0.5, 24), mats.alu, hot ? 'Pistón caliente' : 'Pistón frío', 'Los dos pistones van desfasados (normalmente 90°): así el gas se calienta cuando está expandido y se enfría cuando está comprimido.');
    piston.geometry.translate(0, -B * 0.25, 0);
    g.add(piston);
    const rod = mesh(new THREE.BoxGeometry(B * 0.12, L, B * 0.1), mats.forged, 'Biela', 'Ambas bielas comparten la misma muñequilla.');
    root.add(rod);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    root.add(g);
    cyls.push({ g, gas, piston, rod, dir, base, hot, headMat });
    gasMats.push(gm);
  }
  // regenerador y tubo
  const topH = cyls[0].dir.clone().multiplyScalar(cyls[0].base + cylLen + B * 0.2);
  const topC = cyls[1].dir.clone().multiplyScalar(cyls[1].base + cylLen + B * 0.2);
  const mid = topH.clone().add(topC).multiplyScalar(0.5).add(new THREE.Vector3(0, B * 0.6, 0));
  const tube = mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(topH, mid, topC), 24, B * 0.12, 10, false), mats.copper, 'Conducto de transferencia', 'Une las dos cámaras.');
  root.add(tube);
  const regen = mesh(new THREE.CylinderGeometry(B * 0.22, B * 0.22, B * 0.7, 16), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.7, roughness: 0.8, wireframe: true }), 'Regenerador', 'Malla metálica que guarda el calor del gas cuando va hacia el lado frío y se lo devuelve cuando vuelve. Es la clave del alto rendimiento del Stirling.');
  const regenPos = new THREE.QuadraticBezierCurve3(topH, mid, topC).getPoint(0.5);
  regen.position.copy(regenPos);
  regen.rotation.z = Math.PI / 2;
  root.add(regen);
  const flame = glowSprite(0xff7a2a, B * 3);
  flame.position.copy(cyls[0].dir.clone().multiplyScalar(cyls[0].base + cylLen + B * 0.7));
  root.add(flame);
  // cigüeñal y volante
  const crank = new THREE.Group();
  const pin = mesh(new THREE.CylinderGeometry(B * 0.1, B * 0.1, B * 0.4, 12), mats.steel, 'Muñequilla común', 'Una sola muñequilla mueve los dos pistones: el ángulo entre cilindros fija el desfase.');
  pin.rotation.x = Math.PI / 2;
  pin.position.x = a;
  crank.add(pin);
  const web = mesh(new THREE.BoxGeometry(a * 2.2, B * 0.3, B * 0.08), mats.castIron, 'Manivela', 'Radio = media carrera.');
  web.position.set(a / 2, 0, -B * 0.22);
  crank.add(web);
  root.add(crank);
  const flyR = B * 2.4;
  const fly = mesh(new THREE.CylinderGeometry(flyR, flyR, B * 0.25, 48), mats.castIron, 'Volante de inercia', 'Un Stirling necesita volante: devuelve energía en la fase de compresión.');
  fly.geometry.rotateX(Math.PI / 2);
  fly.position.z = -B * 0.6;
  const mark = mesh(new THREE.BoxGeometry(B * 0.3, B * 0.3, B * 0.1), mats.red, 'Marca', 'Referencia de giro.');
  mark.position.set(0, flyR * 0.8, -B * 0.45);
  const flyG = new THREE.Group(); flyG.add(fly, mark);
  root.add(flyG);
  const base = mesh(new THREE.BoxGeometry(B * 6, B * 0.3, B * 2.5), mats.wood, 'Base', 'Soporte.');
  base.position.y = -flyR - B * 0.3;
  root.add(base);

  function update(s) {
    const th = s.theta;
    const tmp = new THREE.Vector3();
    // ángulo físico de la muñequilla: el pistón caliente está en PMS cuando apunta a su eje
    const pinAng = angH - th;
    const pinPos = new THREE.Vector3(a * Math.cos(pinAng), a * Math.sin(pinAng), 0);
    crank.rotation.z = pinAng;
    flyG.rotation.z = pinAng;
    const Th = s.tHotActual;
    cyls.forEach((c, i) => {
      const proj = pinPos.dot(c.dir);
      const perp = pinPos.clone().addScaledVector(c.dir, -proj).length();
      const sPin = proj + Math.sqrt(L * L - perp * perp);
      const crown = sPin + B * 0.25;
      c.piston.position.y = crown - 0;
      c.piston.position.y = sPin + B * 0.25;
      const top = c.base + cylLen;
      c.gas.position.y = crown;
      c.gas.scale.y = Math.max(0.001, top - crown);
      const pinW = c.dir.clone().multiplyScalar(sPin);
      const d = pinW.clone().sub(pinPos);
      c.rod.position.copy(pinPos).add(pinW).multiplyScalar(0.5);
      c.rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      if (c.hot) { const h = Math.max(0, Math.min(1, (Th - 400) / 600)); c.headMat.emissive.setRGB(h * 0.9, h * 0.25, 0); gasMats[i].emissive.setRGB(h * 0.4, h * 0.1, 0); }
    });
    flame.visible = s.p.heating;
  }
  return { group: root, update, size: new THREE.Vector3(B * 8, B * 9, B * 4), center: new THREE.Vector3(0, B * 1.2, 0) };
}

export const STIRLING = {
  id: 'stirling', name: 'Motor Stirling tipo alfa', short: 'Stirling', category: 'Combustión externa',
  desc: 'Ciclo regenerativo de gas cerrado, análisis de Schmidt.',
  params() {
    return [
      { id: 'heating', label: 'Fuente de calor encendida', type: 'toggle', group: 'Mando' },
      { id: 'load', label: 'Carga en el eje', type: 'range', min: 0, max: 40, step: 0.5, unit: '', group: 'Mando', help: 'Generador o máquina conectada (par proporcional a la velocidad).' },
      { id: 'tHot', label: 'Temperatura del foco caliente', type: 'range', min: 400, max: 1100, step: 10, unit: 'K', group: 'Temperaturas', format: (v) => `${v} K (${Math.round(v - 273)} °C)` },
      { id: 'tCold', label: 'Temperatura del foco frío', type: 'range', min: 260, max: 380, step: 5, unit: 'K', group: 'Temperaturas', format: (v) => `${v} K (${Math.round(v - 273)} °C)` },
      { id: 'pMean', label: 'Presión media del gas', type: 'range', min: 1, max: 30, step: 0.5, unit: 'bar', group: 'Gas de trabajo', help: 'La potencia es proporcional a la presión media: los Stirling reales van presurizados.' },
      { id: 'gas', label: 'Gas de trabajo', type: 'select', group: 'Gas de trabajo', options: Object.entries(GASES).map(([k, g]) => ({ value: k, label: g.nombre })), help: 'Helio e hidrógeno fluyen con menos pérdidas por su baja viscosidad y densidad: permiten girar más rápido.' },
      { id: 'regen', label: 'Eficacia del regenerador', type: 'range', min: 0, max: 0.99, step: 0.01, scale: 100, unit: '%', group: 'Gas de trabajo' },
      { id: 'phase', label: 'Desfase entre pistones', type: 'range', min: 50, max: 130, step: 1, unit: '°', group: 'Geometría', rebuild: true, live: false },
      { id: 'swept', label: 'Volumen barrido por pistón', type: 'range', min: 20, max: 500, step: 5, unit: 'cm³', group: 'Geometría', rebuild: true, live: false },
    ];
  },
  create() {
    const values = { ...STIRLING_PRESET };
    const st = new StirlingEngine({ ...STIRLING_PRESET });
    const root = new THREE.Group();
    let model = buildStirling(st);
    root.add(model.group);
    let t = 0;
    const trR = new Trace(400), trT = new Trace(400);
    return {
      values, root,
      get view() { return { center: model.center.clone(), size: model.size.clone(), front: true }; },
      setParam(id, v) {
        values[id] = v;
        st.setParam(id, v);
        if (id === 'phase' || id === 'swept') { root.remove(model.group); disposeTree(model.group); model = buildStirling(st); root.add(model.group); }
      },
      update(dt) {
        st.advance(dt);
        model.update(st);
        t += dt; trR.push(t, st.rpm); trT.push(t, st.tHotActual - 273.15);
      },
      telemetry() {
        const tl = st.telemetry();
        return [
          { title: 'Funcionamiento', items: [
            { label: 'Velocidad', value: st.rpm, unit: 'rpm' },
            { label: 'Temperatura del calentador', value: st.tHotActual - 273.15, unit: '°C', d: 0 },
            { label: 'Trabajo por ciclo (Schmidt)', value: tl.W, unit: 'J', d: 2 },
            { label: 'Potencia indicada', value: tl.Pind, unit: 'W', d: 0 },
            { label: 'Potencia útil', value: tl.Pbrake, unit: 'W', d: 0 },
            { label: 'Masa de gas', value: (st.m || 0) * 1000, unit: 'g', d: 3 },
          ] },
          { title: 'Rendimiento', items: [
            { label: 'Límite de Carnot', value: tl.carnot * 100, unit: '%', d: 1, help: 'η = 1 − Tfrío/Tcaliente. Ningún motor térmico puede superarlo.' },
            { label: 'Ciclo con regenerador real', value: tl.etaInd * 100, unit: '%', d: 1 },
            { label: 'Rendimiento útil', value: tl.eta * 100, unit: '%', d: 1 },
          ] },
        ];
      },
      charts() {
        return [
          { title: 'Diagrama p-V del gas', note: 'volumen total frente a presión', height: 210, draw(ctx, w, h) {
            const r = st.res || st.analyze();
            const xs = [...r.Vt.map((v) => v * 1e6), r.Vt[0] * 1e6], ys = [...r.P.map((p) => p / 1e5), r.P[0] / 1e5];
            const th = ((st.theta % TAU) + TAU) % TAU;
            const v = st.volumes(th);
            lineChart(ctx, w, h, { series: [{ xs, ys, color: COLORS.b, width: 2 }], xLabel: 'Volumen (cm³)', yLabel: 'bar', markers: [{ x: (v.Ve + v.Vc + v.Vr) * 1e6, y: st.pressureAt(th, st.m, r.Th) / 1e5, color: '#fff' }] });
          } },
          { title: 'Volúmenes caliente y frío durante una vuelta', height: 180, draw(ctx, w, h) {
            const xs = [], e = [], c = [];
            for (let d = 0; d <= 360; d += 4) { const v = st.volumes(d * DEG); xs.push(d); e.push(v.Ve * 1e6); c.push(v.Vc * 1e6); }
            const cur = ((st.theta / DEG) % 360 + 360) % 360;
            lineChart(ctx, w, h, { series: [{ xs, ys: e, color: '#ff7a4a', label: 'caliente' }, { xs, ys: c, color: '#4aa8ff', label: 'frío' }], xLabel: 'ángulo (°)', yLabel: 'cm³', xMin: 0, xMax: 360, yMin: 0, vlines: [{ x: cur, color: '#fff' }] });
          } },
          traceChart([{ trace: trR, color: COLORS.a, label: 'rpm' }, { trace: trT, color: COLORS.d, label: 'T caliente (°C)', axis: 'right' }], 'Arranque y velocidad', 'rpm'),
        ];
      },
      phase() {
        const th = ((st.theta / DEG) % 360 + 360) % 360;
        const ph = st.p.phase;
        let title, text;
        if (th < ph * 0.5 || th > 360 - ph * 0.5) { title = 'Calentamiento'; text = 'El gas pasa del lado frío al caliente atravesando el regenerador, que le devuelve calor.'; }
        else if (th < 180) { title = 'Expansión caliente (trabajo)'; text = 'La mayor parte del gas está en el cilindro caliente: absorbe calor, su presión es alta y empuja los pistones.'; }
        else if (th < 180 + ph) { title = 'Enfriamiento'; text = 'El gas se desplaza al lado frío cediendo calor al regenerador.'; }
        else { title = 'Compresión fría'; text = 'Con el gas frío la presión es baja: comprimirlo cuesta menos trabajo del que dio al expandirse. La diferencia es el trabajo neto.'; }
        if (st.rpm < 5) { title = st.tHotActual < st.p.tCold + 150 ? 'Calentando…' : 'Listo: dale un impulso'; text = 'Un Stirling alfa no arranca solo: cuando el calentador esté caliente, pulsa "Dar impulso" para girar el volante.'; }
        return { title, text };
      },
      hud() { return [{ label: 'rpm', value: st.rpm, max: 2000, red: 1800, unit: 'rpm' }, { label: 'T caliente', value: st.tHotActual - 273, max: 900, unit: '°C' }]; },
      actions() { return [{ id: 'kick', label: 'Dar impulso al volante', primary: st.rpm < 5, onClick: () => { st.omega = Math.max(st.omega, 25); } }]; },
      experiments: [
        { title: 'Más diferencia de temperatura', text: 'Sube el foco caliente a 1000 K: el límite de Carnot y la potencia suben.', set: { tHot: 1000 } },
        { title: 'Sin regenerador', text: 'Pon el regenerador al 0 %: el gas tira el calor en cada ciclo y el rendimiento se desploma.', set: { regen: 0 } },
        { title: 'Presurizar con helio', text: 'Helio a 25 bar: mucha más potencia y velocidad, como en los Stirling reales (submarinos, generadores solares).', set: { gas: 'helio', pMean: 25 } },
        { title: 'Desfase óptimo', text: 'Prueba desfases de 60°, 90° y 120° y mira el trabajo por ciclo.', set: { phase: 120 } },
      ],
      learn: `
<h3>¿Qué es?</h3>
<p>El motor Stirling (1816) trabaja con una <b>masa de gas encerrada</b> que se calienta y enfría alternativamente. No hay explosiones ni válvulas: el calor llega desde fuera (llama, sol, calor residual), por eso es silencioso y admite cualquier fuente.</p>
<h3>Ciclo ideal</h3>
<ul><li>1→2 Compresión isoterma a T fría.</li><li>2→3 Calentamiento a volumen constante (el regenerador devuelve calor).</li><li>3→4 Expansión isoterma a T caliente (trabajo).</li><li>4→1 Enfriamiento a volumen constante (el regenerador almacena calor).</li></ul>
<p>Con regenerador perfecto, el rendimiento ideal es el de <b>Carnot</b>: η = 1 − T<sub>f</sub>/T<sub>c</sub>.</p>
<h3>Modelo</h3>
<p>Análisis isotermo de Schmidt: p(θ) = m·R / (V<sub>e</sub>/T<sub>c</sub> + V<sub>r</sub>/T<sub>r</sub> + V<sub>k</sub>/T<sub>f</sub>), integrado numéricamente, más pérdidas por regeneración imperfecta y rozamiento del gas.</p>`,
      dispose() { disposeTree(root); },
    };
  },
};
