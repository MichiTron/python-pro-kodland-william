// Modelo 3D de un motor alternativo (4T gasolina, diésel o 2T) animado por CombustionEngine.
// Todas las medidas están en metros y se derivan de los parámetros reales del motor.
import * as THREE from 'three';
import { mats, mesh, part, cylX, springGeometry, glowSprite, flameColor, placeBetween } from '../core/kit.js';
import { firingOrderText } from '../physics/engine.js';

const DEG = Math.PI / 180;

function camProfileGeometry(rb, lift, halfWidthRad, width) {
  const shape = new THREE.Shape();
  const n = 96;
  for (let i = 0; i <= n; i++) {
    const phi = i / n * Math.PI * 2;
    const d = Math.abs(((phi - Math.PI + Math.PI) % (Math.PI * 2)) - Math.PI);
    const bump = d < halfWidthRad ? Math.pow(Math.cos(Math.PI / 2 * d / halfWidthRad), 2) : 0;
    const r = rb + lift * bump;
    const x = r * Math.sin(phi), y = r * Math.cos(phi);
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  g.translate(0, 0, -width / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

function webGeometry(a, rBoss, rCw, t) {
  const s = new THREE.Shape();
  s.moveTo(-rBoss, a);
  s.absarc(0, a, rBoss, Math.PI, 0, true);
  const a0 = -10 * DEG, a1 = -170 * DEG;
  s.lineTo(rCw * Math.cos(a0), rCw * Math.sin(a0));
  s.absarc(0, 0, rCw, a0, a1, true);
  s.lineTo(-rBoss, a);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: t * 0.08, bevelSize: t * 0.08, bevelSegments: 2 });
  g.translate(0, 0, -t / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

function liftAt(c, open, dur, cycle) {
  const d = (((c - open) % cycle) + cycle) % cycle;
  if (d >= dur) return 0;
  return Math.pow(Math.sin(Math.PI * d / dur), 1.5);
}

export function buildPistonEngine(engine, opts = {}) {
  const p = engine.p;
  const two = p.kind === '2t';
  const diesel = p.kind === 'diesel';
  const B = p.bore / 1000, S = p.stroke / 1000, a = S / 2, L = p.rod / 1000, n = p.cylinders;
  const pitch = B * (two ? 1.5 : 1.28);
  const hc = 0.36 * B;
  const VcH = S / (p.cr - 1);
  const yDeck = L + a + hc + VcH;
  const pistonLen = 0.78 * B;
  const yLinerBot = L - a + hc - pistonLen - 0.02 * B;
  const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * pitch);
  const xMin = xs[0] - pitch / 2, xMax = xs[n - 1] + pitch / 2;
  const root = new THREE.Group();
  root.name = 'motor';

  // ---------- Bloque y culata ----------
  const blockH = yDeck - yLinerBot;
  const blockW = xMax - xMin + 0.12 * B, blockD = B * 1.55;
  const block = mesh(new THREE.BoxGeometry(blockW, blockH, blockD), diesel ? mats.ghost : mats.glassBlock, 'Bloque motor',
    'Pieza de fundición (hierro o aluminio) que contiene los cilindros y los conductos de refrigeración. Aquí se muestra transparente.');
  block.position.set((xMin + xMax) / 2, yLinerBot + blockH / 2, 0);
  block.castShadow = false;
  root.add(block);
  const cc = mesh(new THREE.BoxGeometry(blockW, yLinerBot + a + 0.45 * B, blockD * (two ? 1.05 : 1.2)), mats.ghost, 'Cárter',
    'Caja que aloja el cigüeñal. En el 4T contiene aceite; en el 2T sirve además de bomba de barrido que precomprime la mezcla.');
  cc.position.set((xMin + xMax) / 2, (yLinerBot - a - 0.45 * B) / 2, 0);
  cc.castShadow = false;
  root.add(cc);
  if (!two) {
    const pan = mesh(new THREE.BoxGeometry(blockW * 0.96, 0.3 * B, blockD * 1.1), new THREE.MeshStandardMaterial({ color: 0x3a4250, transparent: true, opacity: 0.35, depthWrite: false }), 'Cárter de aceite',
      'Depósito de aceite lubricante bajo el cigüeñal. La bomba lo envía a los cojinetes, levas y paredes del cilindro.');
    pan.position.set((xMin + xMax) / 2, -a - 0.62 * B, 0);
    root.add(pan);
    const oil = mesh(new THREE.BoxGeometry(blockW * 0.9, 0.12 * B, blockD), new THREE.MeshStandardMaterial({ color: 0x8a5a12, metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.7 }), 'Aceite', 'Aceite de motor: reduce la fricción y evacua calor.');
    oil.position.set((xMin + xMax) / 2, -a - 0.7 * B, 0);
    root.add(oil);
  }

  const headH = two ? 0.42 * B : 1.25 * B;
  const head = mesh(new THREE.BoxGeometry(blockW, headH, blockD * (two ? 1 : 1.1)), mats.glassBlock, 'Culata',
    two ? 'Culata con aletas de refrigeración por aire. Forma la cámara de combustión y aloja la bujía.' : 'Culata: cierra el cilindro por arriba y aloja la cámara de combustión, las válvulas, los árboles de levas y la bujía o el inyector.');
  head.position.set((xMin + xMax) / 2, yDeck + headH / 2, 0);
  head.castShadow = false;
  root.add(head);

  // ---------- Cilindros, pistones, bielas, gas ----------
  const units = [];
  const linerGeo = new THREE.CylinderGeometry(B / 2 * 1.02, B / 2 * 1.02, yDeck - yLinerBot, 40, 1, true);
  const pistonGeo = new THREE.CylinderGeometry(B / 2 * 0.985, B / 2 * 0.985, pistonLen, 40);
  pistonGeo.translate(0, -pistonLen / 2, 0);
  const ringGeo = new THREE.TorusGeometry(B / 2 * 0.99, B * 0.012, 6, 40);
  ringGeo.rotateX(Math.PI / 2);
  const gasGeo = new THREE.CylinderGeometry(B / 2 * 0.975, B / 2 * 0.975, 1, 36);
  gasGeo.translate(0, 0.5, 0);
  const rodW = 0.2 * B;
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const liner = mesh(linerGeo, mats.glass, `Cilindro ${i + 1}`, 'Camisa del cilindro, por la que se desliza el pistón. Su diámetro es el calibre (D).');
    liner.position.set(x, (yDeck + yLinerBot) / 2, 0);
    liner.castShadow = false;
    root.add(liner);

    const piston = new THREE.Group();
    const pm = mesh(pistonGeo, mats.alu, `Pistón ${i + 1}`, 'Pistón de aluminio. Recibe la fuerza de los gases (F = p·A) y la transmite a la biela.');
    piston.add(pm);
    for (let r = 0; r < 3; r++) {
      const ring = mesh(ringGeo, mats.darkSteel, 'Segmentos', 'Aros elásticos que sellan la cámara (compresión) y rascan el aceite de la pared.');
      ring.position.y = -0.06 * B - r * 0.055 * B;
      piston.add(ring);
    }
    const pin = cylX(B * 0.11, B * 0.9, mats.steel);
    part(pin, 'Bulón', 'Pasador que une el pistón con el pie de biela.');
    pin.position.y = -hc;
    piston.add(pin);
    root.add(piston);

    const rod = new THREE.Group();
    const shank = mesh(new THREE.BoxGeometry(rodW * 0.75, L, 0.22 * B), mats.forged, `Biela ${i + 1}`, 'La biela convierte el movimiento lineal del pistón en giro del cigüeñal (mecanismo biela-manivela).');
    rod.add(shank);
    const small = cylX(0.17 * B, rodW, mats.forged); small.position.y = L / 2; part(small, 'Pie de biela', 'Extremo pequeño de la biela, unido al bulón.'); rod.add(small);
    const big = cylX(0.33 * B, rodW, mats.forged); big.position.y = -L / 2; part(big, 'Cabeza de biela', 'Extremo grande, abraza la muñequilla del cigüeñal con un cojinete.'); rod.add(big);
    rod.position.x = x;
    root.add(rod);

    const gasMat = new THREE.MeshStandardMaterial({ color: 0x5ab4ff, emissive: 0x000000, transparent: true, opacity: 0.55, depthWrite: false, roughness: 1, metalness: 0 });
    const gas = mesh(gasGeo, gasMat, 'Gases en el cilindro', 'Color según el estado: azul mezcla fresca, violeta comprimida, naranja-amarillo combustión (más claro = más caliente), gris gases de escape.');
    gas.castShadow = false;
    gas.position.x = x;
    root.add(gas);

    const glow = glowSprite(0xffaa55, B * 1.4);
    glow.position.set(x, yDeck - VcH * 0.5, 0);
    glow.visible = false;
    root.add(glow);

    units.push({ x, piston, rod, gas, gasMat, glow, valves: [] });
  }

  // ---------- Cigüeñal y volante ----------
  const crank = new THREE.Group();
  const journalR = 0.29 * B, pinR = 0.25 * B, webT = 0.14 * B;
  const rBoss = 0.34 * B, rCw = Math.max(a * 1.05, 0.5 * B);
  const webGeo = webGeometry(a, rBoss, rCw, webT);
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const psi = engine.unitOffsets[i] * DEG;
    for (const sgn of [-1, 1]) {
      const w = mesh(webGeo, mats.forged, 'Brazo y contrapeso del cigüeñal', 'Los contrapesos equilibran las fuerzas de inercia del pistón y la biela.');
      w.position.x = x + sgn * (rodW / 2 + webT / 2 + 0.01 * B);
      w.rotation.x = psi;
      crank.add(w);
    }
    const cp = cylX(pinR, rodW + 0.04 * B, mats.steel);
    part(cp, 'Muñequilla', `Codo del cigüeñal del cilindro ${i + 1}. Su distancia al eje es el radio de manivela r = carrera/2.`);
    cp.position.set(x, a * Math.cos(psi), a * Math.sin(psi));
    crank.add(cp);
  }
  const journals = [xMin - 0.05 * B, ...xs.slice(1).map((x, i) => (x + xs[i]) / 2), xMax + 0.05 * B];
  journals.forEach((jx, k) => {
    const len = k === 0 || k === journals.length - 1 ? 0.35 * B : pitch - rodW - 2 * webT - 0.04 * B;
    const j = cylX(journalR, Math.max(len, 0.08 * B), mats.steel);
    part(j, 'Apoyo de bancada', 'Muñón principal: el cigüeñal gira apoyado en estos cojinetes.');
    j.position.x = jx;
    crank.add(j);
  });
  const snout = cylX(journalR * 0.8, 0.9 * B, mats.steel); snout.position.x = xMin - 0.5 * B; crank.add(snout);
  root.add(crank);

  const flyR = Math.max(1.6 * a + 0.4 * B, 0.09) * Math.pow(p.flywheel / 0.12, 0.2) * (two ? 0.7 : 1);
  const fly = new THREE.Group();
  const flyDisc = mesh(new THREE.CylinderGeometry(flyR, flyR, 0.22 * B, 48), mats.castIron, 'Volante de inercia',
    `Disco pesado (inercia J = ${p.flywheel.toFixed(3)} kg·m²) que almacena energía y suaviza los tirones entre explosiones.`);
  flyDisc.geometry.rotateZ(Math.PI / 2);
  fly.add(flyDisc);
  const ringTeeth = new THREE.Mesh(new THREE.TorusGeometry(flyR, 0.05 * B, 6, 64), mats.darkSteel);
  ringTeeth.rotation.y = Math.PI / 2;
  fly.add(ringTeeth);
  const mark = mesh(new THREE.BoxGeometry(0.24 * B, 0.08 * B, 0.08 * B), mats.red, 'Marca de PMS', 'Marca de referencia: apunta arriba cuando el pistón 1 está en el punto muerto superior.');
  mark.position.set(0, flyR * 0.85, 0);
  fly.add(mark);
  fly.position.x = xMax + 0.35 * B;
  root.add(fly);
  const pulley = cylX(0.55 * B, 0.18 * B, mats.black);
  part(pulley, 'Polea del cigüeñal', 'Mueve la correa de distribución y los accesorios (alternador, bomba de agua).');
  pulley.position.x = xMin - 0.75 * B;
  root.add(pulley);

  // ---------- Distribución (4T) ----------
  const camGroups = [];
  let lift = 0, rb = 0, stemLen = 0;
  const cycle = two ? 360 : 720;
  const D = p.camDuration;
  const ivc = engine.cfg.ivc, evo = engine.cfg.evo;
  const ivo = D - 180 - ivc, evc = D - 180 - evo;
  const intakeOpen = -360 - ivo, exhaustOpen = 180 - evo;
  const tilt = 17 * DEG;
  const valveLift = 0.11 * B;
  if (!two) {
    stemLen = 1.0 * B;
    rb = 0.18 * B;
    const valveHeadR = 0.21 * B;
    for (const side of ['int', 'exh']) {
      const sgn = side === 'int' ? -1 : 1;
      const u = new THREE.Vector3(0, Math.cos(tilt), sgn * Math.sin(tilt));
      const camDist = stemLen + 0.08 * B + rb;
      const camCenter = new THREE.Vector3(0, yDeck + 0.002, sgn * 0.22 * B).addScaledVector(u, camDist);
      const shaft = cylX(rb * 0.75, xMax - xMin + 0.6 * B, mats.steel);
      part(shaft, side === 'int' ? 'Árbol de levas de admisión' : 'Árbol de levas de escape', 'Gira a la mitad de velocidad que el cigüeñal: cada válvula se abre una vez cada dos vueltas.');
      shaft.position.set((xMin + xMax) / 2 - 0.15 * B, camCenter.y, camCenter.z);
      root.add(shaft);
      const gearC = cylX(rb * 2.6, 0.12 * B, mats.darkSteel);
      part(gearC, 'Piñón de distribución', 'Tiene el doble de dientes que el del cigüeñal: relación 2:1.');
      gearC.position.set(xMin - 0.55 * B, camCenter.y, camCenter.z);
      root.add(gearC);
      camGroups.push(gearC);
      const camGeo = camProfileGeometry(rb, valveLift, (D / 4) * DEG * 1.1, 0.16 * B);
      for (let i = 0; i < n; i++) {
        const asm = new THREE.Group();
        asm.position.set(xs[i], yDeck + 0.002, sgn * 0.22 * B);
        asm.rotation.x = sgn * tilt;
        const valve = new THREE.Group();
        const vh = mesh(new THREE.CylinderGeometry(valveHeadR, valveHeadR * 0.55, 0.06 * B, 28), mats.steel, side === 'int' ? 'Válvula de admisión' : 'Válvula de escape',
          side === 'int' ? 'Se abre para dejar entrar la mezcla (o el aire en diésel). Es más grande que la de escape.' : 'Se abre al final de la expansión para expulsar los gases quemados. Trabaja muy caliente.');
        vh.position.y = 0.03 * B;
        valve.add(vh);
        const stem = mesh(new THREE.CylinderGeometry(0.035 * B, 0.035 * B, stemLen, 10), mats.steel);
        stem.position.y = stemLen / 2;
        valve.add(stem);
        const bucket = mesh(new THREE.CylinderGeometry(0.17 * B, 0.17 * B, 0.1 * B, 20), mats.darkSteel, 'Taqué', 'Empujador entre la leva y la válvula.');
        bucket.position.y = stemLen + 0.03 * B;
        valve.add(bucket);
        asm.add(valve);
        const spring = mesh(springGeometry(0.13 * B, 0.018 * B, 6), mats.steel, 'Muelle de válvula', 'Cierra la válvula cuando la leva deja de empujarla.');
        spring.position.y = stemLen * 0.45;
        asm.add(spring);
        const lobe = mesh(camGeo, mats.steel, 'Leva', `Su perfil fija cuándo y cuánto se abre la válvula. Duración ${D}° de cigüeñal.`);
        lobe.position.y = camDist;
        asm.add(lobe);
        root.add(asm);
        units[i].valves.push({ side, valve, spring, lobe, open: side === 'int' ? intakeOpen : exhaustOpen });
      }
    }
    lift = valveLift;
    const cover = mesh(new THREE.BoxGeometry(blockW, 0.35 * B, blockD * 1.05), mats.ghost, 'Tapa de balancines', 'Tapa que cierra la culata por arriba.');
    cover.position.set((xMin + xMax) / 2, yDeck + headH + 0.17 * B, 0);
    cover.castShadow = false;
    root.add(cover);
  }

  // ---------- Bujías o inyectores ----------
  units.forEach((uu) => {
    const g = new THREE.Group();
    if (diesel) {
      const body = mesh(new THREE.CylinderGeometry(0.07 * B, 0.05 * B, 0.95 * B, 16), mats.darkSteel, 'Inyector', 'Pulveriza gasóleo a más de 1500 bar dentro del aire caliente comprimido. No hay bujía: se autoinflama.');
      body.position.y = 0.47 * B;
      g.add(body);
      const sprayMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.5, depthWrite: false });
      const spray = new THREE.Group();
      for (let k = 0; k < 6; k++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.035 * B, 0.42 * B, 8, 1, true), sprayMat);
        cone.geometry.translate(0, -0.21 * B, 0);
        const pivot = new THREE.Group();
        pivot.rotation.y = k * Math.PI / 3;
        const holder = new THREE.Group();
        holder.rotation.z = 70 * DEG;
        holder.add(cone);
        pivot.add(holder);
        spray.add(pivot);
      }
      spray.position.y = -0.01;
      spray.visible = false;
      g.add(spray);
      part(spray, 'Chorro de gasóleo', 'Seis chorros finísimos que se evaporan y arden en contacto con el aire a más de 700 °C.');
      uu.spray = spray;
      const glowPlug = mesh(new THREE.CylinderGeometry(0.03 * B, 0.03 * B, 0.7 * B, 8), mats.brass, 'Bujía de precalentamiento', 'Calienta la cámara para arrancar en frío.');
      glowPlug.position.set(0.25 * B, 0.35 * B, 0.12 * B);
      g.add(glowPlug);
    } else {
      const ins = mesh(new THREE.CylinderGeometry(0.06 * B, 0.07 * B, 0.55 * B, 14), mats.ceramic, 'Bujía', 'Hace saltar una chispa de ~20 000 V entre sus electrodos para iniciar la combustión de la mezcla.');
      ins.position.y = (two ? 0.55 : 0.75) * B;
      g.add(ins);
      const hex = mesh(new THREE.CylinderGeometry(0.1 * B, 0.1 * B, 0.12 * B, 6), mats.steel);
      hex.position.y = (two ? 0.25 : 0.42) * B;
      g.add(hex);
      const thread = mesh(new THREE.CylinderGeometry(0.06 * B, 0.06 * B, (two ? 0.2 : 0.36) * B, 10), mats.steel);
      thread.position.y = (two ? 0.1 : 0.18) * B;
      g.add(thread);
      const spark = glowSprite(0x9fd8ff, B * 0.7);
      spark.position.y = -0.01 * B;
      spark.visible = false;
      g.add(spark);
      uu.spark = spark;
    }
    g.position.set(uu.x, yDeck, 0);
    root.add(g);
  });

  // ---------- Admisión y escape ----------
  const intakeMat = new THREE.MeshStandardMaterial({ color: 0x3f6fa8, metalness: 0.4, roughness: 0.5, transparent: true, opacity: 0.45, depthWrite: false });
  const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x6b5446, metalness: 0.6, roughness: 0.5, emissive: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
  const intakePaths = [], exhaustPaths = [];
  let throttleDisc = null, turbo = null;
  if (!two) {
    const plenumY = yDeck + 0.95 * B, plenumZ = -1.55 * B;
    const plenum = mesh(cylX(0.32 * B, xMax - xMin + 0.4 * B, intakeMat).geometry, intakeMat, 'Colector de admisión', 'Reparte el aire entre los cilindros. Con la mariposa casi cerrada aquí hay vacío (presión menor que la atmosférica).');
    plenum.position.set((xMin + xMax) / 2, plenumY, plenumZ);
    root.add(plenum);
    const tb = mesh(cylX(0.2 * B, 0.35 * B, mats.alu).geometry, mats.alu, 'Cuerpo de mariposa', 'La mariposa, unida al acelerador, regula el aire que entra y con ello la potencia (en gasolina).');
    tb.position.set(xMax + 0.38 * B, plenumY, plenumZ);
    root.add(tb);
    throttleDisc = mesh(new THREE.CylinderGeometry(0.19 * B, 0.19 * B, 0.015 * B, 24), mats.brass, 'Mariposa de gases', 'Gira con el pedal del acelerador.');
    throttleDisc.rotation.z = Math.PI / 2;
    const tdPivot = new THREE.Group();
    tdPivot.position.copy(tb.position);
    tdPivot.add(throttleDisc);
    root.add(tdPivot);
    throttleDisc = tdPivot;
    const filter = mesh(new THREE.BoxGeometry(0.5 * B, 0.6 * B, 0.8 * B), mats.black, 'Filtro de aire', 'Retiene polvo antes de que el aire entre al motor.');
    filter.position.set(xMax + 0.85 * B, plenumY, plenumZ);
    root.add(filter);
    for (let i = 0; i < n; i++) {
      const x = xs[i];
      const ports = [
        new THREE.Vector3(x, plenumY, plenumZ + 0.2 * B),
        new THREE.Vector3(x, plenumY + 0.05 * B, -1.05 * B),
        new THREE.Vector3(x, yDeck + 0.42 * B, -0.62 * B),
        new THREE.Vector3(x, yDeck + 0.12 * B, -0.3 * B),
      ];
      const curve = new THREE.CatmullRomCurve3(ports);
      const runner = mesh(new THREE.TubeGeometry(curve, 20, 0.12 * B, 10, false), intakeMat, 'Conducto de admisión', 'Lleva el aire (y en gasolina indirecta, la mezcla) hasta la válvula de admisión.');
      runner.castShadow = false;
      root.add(runner);
      intakePaths.push(new THREE.CatmullRomCurve3([
        new THREE.Vector3(xMax + 0.85 * B, plenumY, plenumZ), new THREE.Vector3(xMax + 0.3 * B, plenumY, plenumZ), new THREE.Vector3(x, plenumY, plenumZ), ...ports.slice(1),
        new THREE.Vector3(x, yDeck - 0.08 * B, -0.15 * B), new THREE.Vector3(x, yDeck - 0.5 * B, 0),
      ]));
      const eports = [
        new THREE.Vector3(x, yDeck - 0.3 * B, 0),
        new THREE.Vector3(x, yDeck + 0.12 * B, 0.3 * B),
        new THREE.Vector3(x, yDeck + 0.3 * B, 0.75 * B),
        new THREE.Vector3(x, yDeck + 0.05 * B, 1.45 * B),
        new THREE.Vector3(x, yLinerBot + 0.1 * B, 1.75 * B),
      ];
      const er = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(eports.slice(1)), 20, 0.11 * B, 10, false), exhaustMat, 'Colector de escape', 'Recoge los gases calientes (600 a 950 °C). Se pone al rojo con carga alta.');
      er.castShadow = false;
      root.add(er);
      exhaustPaths.push(new THREE.CatmullRomCurve3([...eports, new THREE.Vector3((x + xMin) / 2, yLinerBot - 0.1 * B, 1.75 * B), new THREE.Vector3(xMin - 0.6 * B, yLinerBot - 0.1 * B, 1.75 * B)]));
    }
    const coll = mesh(cylX(0.15 * B, xMax - xMin + 0.8 * B, exhaustMat).geometry, exhaustMat, 'Colector de escape', 'Une los conductos de escape hacia el catalizador y el silenciador.');
    coll.position.set((xMin + xMax) / 2 - 0.2 * B, yLinerBot - 0.05 * B, 1.75 * B);
    root.add(coll);

    if (p.turbo) {
      turbo = new THREE.Group();
      const tx = xMin - 0.9 * B;
      const turbH = mesh(new THREE.TorusGeometry(0.32 * B, 0.17 * B, 12, 28), new THREE.MeshStandardMaterial({ color: 0x6b5446, metalness: 0.7, roughness: 0.4, emissive: 0x000000 }), 'Turbina del turbo',
        'Los gases de escape hacen girar esta turbina a más de 150 000 rpm.');
      turbH.position.set(tx, yDeck - 0.7 * B, 1.2 * B);
      turbH.rotation.y = Math.PI / 2;
      turbo.add(turbH);
      const compH = mesh(new THREE.TorusGeometry(0.32 * B, 0.17 * B, 12, 28), mats.alu, 'Compresor del turbo', 'Unido a la turbina por un eje, comprime el aire de admisión: más aire = más combustible = más potencia.');
      compH.position.set(tx, yDeck - 0.7 * B, -0.2 * B);
      compH.rotation.y = Math.PI / 2;
      turbo.add(compH);
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * B, 0.05 * B, 1.4 * B, 8), mats.steel);
      sh.rotation.x = Math.PI / 2;
      sh.position.set(tx, yDeck - 0.7 * B, 0.5 * B);
      turbo.add(sh);
      const wheels = [];
      for (const z of [-0.2 * B, 1.2 * B]) {
        const wg = new THREE.Group();
        for (let k = 0; k < 8; k++) {
          const bl = new THREE.Mesh(new THREE.BoxGeometry(0.02 * B, 0.26 * B, 0.12 * B), mats.steel);
          bl.position.y = 0.13 * B;
          const holder = new THREE.Group();
          holder.rotation.z = k * Math.PI / 4;
          bl.rotation.y = 0.5;
          holder.add(bl);
          wg.add(holder);
        }
        wg.position.set(tx, yDeck - 0.7 * B, z);
        wg.rotation.x = 0;
        turbo.add(wg);
        wheels.push(wg);
      }
      const pipe = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(tx, yDeck - 0.7 * B, -0.4 * B), new THREE.Vector3(tx, yDeck, -1.2 * B), new THREE.Vector3(tx + 0.2 * B, plenumY, plenumZ), new THREE.Vector3(xMin - 0.1 * B, plenumY, plenumZ),
      ]), 16, 0.14 * B, 8, false), intakeMat, p.intercooler ? 'Tubo del intercooler' : 'Tubo de sobrealimentación', p.intercooler ? 'El intercooler enfría el aire comprimido: más denso y menos riesgo de detonación.' : 'Lleva el aire comprimido al colector.');
      turbo.add(pipe);
      turbo.userData = { wheels, turbH };
      root.add(turbo);
    }
  } else {
    // ---------- Específico de 2 tiempos ----------
    const x = xs[0];
    const pinYAt = (deg) => { const th = deg * DEG; return a * Math.cos(th) + Math.sqrt(L * L - a * a * Math.sin(th) ** 2); };
    const exhTop = pinYAt(180 - p.portOpen) + hc;
    const trTop = pinYAt(180 - p.portOpen + 14) + hc;
    const bdcCrown = L - a + hc;
    const portMatE = new THREE.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0x401800, transparent: true, opacity: 0.75 });
    const portMatT = new THREE.MeshStandardMaterial({ color: 0x4fb3ff, emissive: 0x062040, transparent: true, opacity: 0.75 });
    const ep = mesh(new THREE.BoxGeometry(0.55 * B, exhTop - bdcCrown + 0.02 * B, 0.06 * B), portMatE, 'Lumbrera de escape', 'Ventana en la pared del cilindro: el propio pistón la descubre al bajar y salen los gases quemados.');
    ep.position.set(x, (exhTop + bdcCrown) / 2, B / 2 + 0.02 * B);
    root.add(ep);
    for (const sx of [-1, 1]) {
      const tp = mesh(new THREE.BoxGeometry(0.06 * B, trTop - bdcCrown + 0.02 * B, 0.4 * B), portMatT, 'Lumbrera de transferencia', 'Por aquí sube la mezcla fresca precomprimida en el cárter y empuja los gases quemados (barrido).');
      tp.position.set(x + sx * (B / 2 + 0.02 * B), (trTop + bdcCrown) / 2, -0.05 * B);
      root.add(tp);
      const duct = mesh(new THREE.BoxGeometry(0.1 * B, trTop - yLinerBot + 0.3 * B, 0.3 * B), portMatT, 'Canal de transferencia', 'Comunica el cárter con el cilindro.');
      duct.position.set(x + sx * (B / 2 + 0.12 * B), (trTop + yLinerBot - 0.3 * B) / 2, -0.05 * B);
      duct.material = duct.material.clone(); duct.material.opacity = 0.3;
      root.add(duct);
    }
    // fins
    for (let k = 0; k < 6; k++) {
      const fin = mesh(new THREE.BoxGeometry(B * 1.6, 0.025 * B, B * 1.6), mats.alu, 'Aletas de refrigeración', 'Aumentan la superficie para disipar calor al aire.');
      fin.position.set(x, yDeck - 0.15 * B - k * 0.16 * B + 0.5 * B, 0);
      fin.castShadow = false;
      fin.material = mats.ghost;
      root.add(fin);
    }
    // reed valve intake
    const reed = new THREE.Group();
    const reedBody = mesh(new THREE.BoxGeometry(0.4 * B, 0.3 * B, 0.3 * B), mats.black, 'Válvula de láminas', 'Láminas flexibles que dejan entrar mezcla al cárter cuando el pistón sube (depresión) y se cierran al bajar.');
    reed.add(reedBody);
    const petal = mesh(new THREE.BoxGeometry(0.35 * B, 0.28 * B, 0.01 * B), mats.darkSteel, 'Lámina', 'Se abre por depresión del cárter.');
    petal.geometry.translate(0, -0.14 * B, 0);
    petal.position.set(0, 0.14 * B, 0.16 * B);
    reed.add(petal);
    reed.userData.petal = petal;
    reed.position.set(x, yLinerBot - 0.25 * B, -0.85 * B);
    root.add(reed);
    const carb = mesh(new THREE.CylinderGeometry(0.16 * B, 0.16 * B, 0.6 * B, 16), mats.alu, 'Carburador', 'Mezcla gasolina con aceite y aire. La corredera regula el paso de mezcla (acelerador).');
    carb.rotation.x = Math.PI / 2;
    carb.position.set(x, yLinerBot - 0.25 * B, -1.35 * B);
    root.add(carb);
    // expansion chamber
    const prof = [];
    const lenE = 6 * B;
    for (let k = 0; k <= 30; k++) {
      const t = k / 30;
      let r = 0.18 * B;
      if (t > 0.15 && t < 0.5) r = 0.18 * B + (t - 0.15) / 0.35 * 0.5 * B;
      else if (t >= 0.5 && t < 0.7) r = 0.68 * B;
      else if (t >= 0.7 && t < 0.92) r = 0.68 * B - (t - 0.7) / 0.22 * 0.56 * B;
      else if (t >= 0.92) r = 0.12 * B;
      prof.push(new THREE.Vector2(r, t * lenE));
    }
    const pipe = mesh(new THREE.LatheGeometry(prof, 24), exhaustMat, 'Escape de expansión', 'Tubo resonante: la onda de presión reflejada devuelve al cilindro la mezcla que se escapaba. Da el típico "pico" de potencia del 2T.');
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, (exhTop + bdcCrown) / 2, B * 0.55);
    root.add(pipe);
    intakePaths.push(new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, yLinerBot - 0.25 * B, -1.6 * B), new THREE.Vector3(x, yLinerBot - 0.25 * B, -0.7 * B), new THREE.Vector3(x, -0.1 * B, -0.4 * B),
      new THREE.Vector3(x - B * 0.62, yLinerBot, -0.05 * B), new THREE.Vector3(x - B * 0.62, trTop - 0.05 * B, -0.05 * B), new THREE.Vector3(x, trTop + 0.2 * B, 0),
    ]));
    exhaustPaths.push(new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, exhTop - 0.05 * B, 0), new THREE.Vector3(x, (exhTop + bdcCrown) / 2, B * 0.6), new THREE.Vector3(x, (exhTop + bdcCrown) / 2, B * 3.5), new THREE.Vector3(x, (exhTop + bdcCrown) / 2, B * 6.5),
    ]));
    units[0].reed = reed;
    units[0].ports = { exhTop, trTop };
    const ccGasMat = new THREE.MeshStandardMaterial({ color: 0x5ab4ff, transparent: true, opacity: 0.18, depthWrite: false });
    const ccGas = mesh(new THREE.BoxGeometry(blockW * 0.95, yLinerBot + a + 0.4 * B, blockD), ccGasMat, 'Mezcla en el cárter', 'Al bajar el pistón comprime la mezcla del cárter; al subir la aspira a través de la válvula de láminas.');
    ccGas.position.copy(cc.position);
    ccGas.castShadow = false;
    root.add(ccGas);
    units[0].ccGasMat = ccGasMat;
  }

  // ---------- Partículas de flujo ----------
  const perPath = 22;
  const nPart = (intakePaths.length + exhaustPaths.length) * perPath;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(nPart * 3);
  const pCol = new Float32Array(nPart * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pMat = new THREE.PointsMaterial({ size: Math.max(0.006, B * 0.09), vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  root.add(points);
  const particles = [];
  intakePaths.forEach((c, i) => { for (let k = 0; k < perPath; k++) particles.push({ curve: c, unit: i, type: 'in', t: k / perPath + Math.random() * 0.02 }); });
  exhaustPaths.forEach((c, i) => { for (let k = 0; k < perPath; k++) particles.push({ curve: c, unit: i, type: 'ex', t: k / perPath + Math.random() * 0.02 }); });
  const tmpV = new THREE.Vector3();

  // ---------- Animación ----------
  const cFresh = new THREE.Color(diesel ? 0xcfe8ff : 0x4fb3ff);
  const cComp = new THREE.Color(0x9a6bff);
  const cExh = new THREE.Color(0x8a7f74);
  const cTmp = new THREE.Color();

  function update(eng, dtSim) {
    const th = eng.theta;
    crank.rotation.x = th;
    fly.rotation.x = th;
    pulley.rotation.x = th;
    camGroups.forEach((g) => { g.rotation.x = th / 2; });
    const cyc = eng.cycle;
    const half = eng.half;
    const ign = eng.ignition && !eng.fuelCut && !eng.seized;
    units.forEach((uu, i) => {
      const c = eng.unitCycleDeg(i);
      const cr = c * DEG;
      const sn = Math.sin(cr), cs = Math.cos(cr);
      const pinY = a * cs + Math.sqrt(L * L - a * a * sn * sn);
      uu.piston.position.set(uu.x, pinY + hc, 0);
      const cy = a * cs, cz = a * sn;
      uu.rod.position.set(uu.x, (pinY + cy) / 2, cz / 2);
      uu.rod.rotation.x = Math.atan2(-cz, pinY - cy);
      // gas
      const crown = pinY + hc;
      uu.gas.position.y = crown;
      uu.gas.scale.y = Math.max(0.001, yDeck - crown + (two ? 0 : 0.02 * B));
      const T = eng.sampleTable(cyc.T, c);
      const xb = eng.sampleTable(cyc.XB, c);
      const m = uu.gasMat;
      let emiss = 0;
      const burning = cyc.burnStart !== null && c >= cyc.burnStart && c <= cyc.evoDeg && cyc.Qtotal > 0 && !cyc.misfire;
      if (!two) {
        if (c < -180) { m.color.copy(c < -360 + 25 ? cExh : cFresh); if (c < -360 + 25) m.color.lerp(cFresh, (c + 360) / 25); }
        else if (c < (cyc.burnStart ?? 999) || !burning && c < cyc.evoDeg) {
          const pr = eng.sampleTable(cyc.P, c) / Math.max(cyc.Pivc, 1);
          m.color.copy(cFresh).lerp(cComp, Math.min(1, (pr - 1) / 15));
          if (diesel && c > (cyc.injDeg ?? 999)) m.color.lerp(new THREE.Color(0xd8c070), 0.4);
        } else if (c <= cyc.evoDeg) {
          flameColor(T, m.color);
          if (xb < 0.999) m.color.lerp(cComp, (1 - xb) * 0.35);
          emiss = Math.min(1.6, Math.max(0, (T - 1100) / 900));
        } else {
          m.color.copy(cExh); emiss = Math.max(0, (T - 900) / 1500) * 0.3;
        }
      } else {
        const closed = c > -180 + p.portClose && c < 180 - p.portOpen;
        if (closed) {
          if (!burning) { const pr = eng.sampleTable(cyc.P, c) / Math.max(cyc.Pivc, 1); m.color.copy(cFresh).lerp(cComp, Math.min(1, (pr - 1) / 10)); }
          else { flameColor(T, m.color); emiss = Math.min(1.6, Math.max(0, (T - 1100) / 900)); }
        } else {
          const f = c > 0 ? (c - (180 - p.portOpen)) / p.portOpen : 1 - (-(c) - (180 - p.portClose)) / p.portClose;
          m.color.copy(cExh).lerp(cFresh, Math.max(0, Math.min(1, c > 0 ? f * 0.7 : 0.6 + 0.4 * (1 - Math.abs(f)))));
        }
      }
      m.emissive.copy(m.color).multiplyScalar(emiss);
      // brillo de la llama
      const dxb = Math.max(0, eng.sampleTable(cyc.XB, c + 1) - xb);
      uu.glow.visible = burning && dxb > 0.002;
      if (uu.glow.visible) { uu.glow.material.color.copy(m.color); uu.glow.material.opacity = Math.min(1, dxb * 25); uu.glow.scale.setScalar(B * (0.8 + dxb * 20)); }
      if (uu.spark) {
        const sp = -eng.currentTiming;
        uu.spark.visible = ign && !cyc.misfire && c >= sp - 0.5 && c < sp + 7;
      }
      if (uu.spray) {
        const inj = cyc.injDeg;
        const dur = 8 + 30 * (1 / Math.max(cyc.lambda, 1));
        uu.spray.visible = ign && inj !== null && c >= inj && c < inj + dur;
      }
      // válvulas y levas
      uu.valves.forEach((v) => {
        const l = liftAt(c, v.open, D, cycle);
        v.valve.position.y = -l * lift;
        v.spring.scale.y = (stemLen * 0.53 - l * lift) / 1;
        const tmax = v.open + D / 2;
        v.lobe.rotation.x = -(c - tmax) * DEG / 2;
      });
      if (uu.reed) {
        const opening = Math.max(0, Math.sin(cr - Math.PI * 0.1)) * (eng.omega > 1 ? 1 : 0);
        uu.reed.userData.petal.rotation.x = -opening * 0.5;
        const ccp = Math.max(0, Math.cos(cr));
        uu.ccGasMat.opacity = 0.12 + 0.25 * (1 - ccp);
      }
    });
    if (throttleDisc) throttleDisc.rotation.x = -(Math.PI / 2) * (0.08 + 0.92 * Math.max(eng.throttle, eng.idleBypass || 0));
    // escape al rojo
    const heat = Math.max(0, Math.min(1, (eng.lastEgt - 750) / 450));
    exhaustMat.emissive.setRGB(heat * 0.9, heat * 0.18, 0);
    if (turbo) {
      const w = eng.turboRpm * 2 * Math.PI / 60 * dtSim;
      turbo.userData.wheels.forEach((wg) => { wg.rotation.z += Math.min(w, 1.2); });
      turbo.userData.turbH.material.emissive.setRGB(heat * 0.8, heat * 0.15, 0);
    }
    // partículas
    const pistonSpeed = Math.abs(eng.omega) * a;
    particles.forEach((pt, k) => {
      const c = eng.unitCycleDeg(pt.unit);
      let flow = 0;
      if (!two) {
        const vs = units[pt.unit].valves;
        const v = vs.find((vv) => vv.side === (pt.type === 'in' ? 'int' : 'exh'));
        flow = v ? liftAt(c, v.open, D, cycle) : 0;
      } else {
        if (pt.type === 'in') flow = Math.max(0.15, Math.sin(c * DEG));
        else flow = (c > 180 - p.portOpen || c < -180 + p.portClose) ? 1 : 0.05;
      }
      pt.t += flow * dtSim * (0.6 + pistonSpeed * 0.35) * (pt.type === 'ex' ? 1.4 : 1);
      if (pt.t > 1) pt.t -= 1;
      pt.curve.getPointAt(pt.t, tmpV);
      pPos[k * 3] = tmpV.x; pPos[k * 3 + 1] = tmpV.y; pPos[k * 3 + 2] = tmpV.z;
      if (pt.type === 'in') { pCol[k * 3] = 0.35; pCol[k * 3 + 1] = 0.75; pCol[k * 3 + 2] = 1; }
      else { const h = Math.max(0, 1 - pt.t * 1.4) * heat; pCol[k * 3] = 0.55 + 0.45 * h; pCol[k * 3 + 1] = 0.5 + 0.1 * h; pCol[k * 3 + 2] = 0.48 - 0.3 * h; }
    });
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  }

  const size = new THREE.Vector3(xMax - xMin + 2 * B, yDeck + headH + a + B, 3.2 * B);
  root.userData.info = { firing: firingOrderText(n), B, S, yDeck };
  return { group: root, update, size, center: new THREE.Vector3((xMin + xMax) / 2, (yDeck - a) / 2, 0) };
}
