// Materiales compartidos y utilidades de geometría para las piezas mecánicas.
import * as THREE from 'three';

export const mats = {
  steel: new THREE.MeshStandardMaterial({ color: 0xb8bec7, metalness: 0.9, roughness: 0.32 }),
  darkSteel: new THREE.MeshStandardMaterial({ color: 0x5d636b, metalness: 0.85, roughness: 0.4 }),
  forged: new THREE.MeshStandardMaterial({ color: 0x8d949c, metalness: 0.9, roughness: 0.45 }),
  alu: new THREE.MeshStandardMaterial({ color: 0xd4d8dd, metalness: 0.75, roughness: 0.35 }),
  castIron: new THREE.MeshStandardMaterial({ color: 0x4a4e55, metalness: 0.6, roughness: 0.7 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9a54a, metalness: 0.9, roughness: 0.3 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xc8733b, metalness: 0.85, roughness: 0.35 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: 0.0, roughness: 0.9 }),
  black: new THREE.MeshStandardMaterial({ color: 0x23262b, metalness: 0.4, roughness: 0.6 }),
  ceramic: new THREE.MeshStandardMaterial({ color: 0xf2efe6, metalness: 0.0, roughness: 0.4 }),
  red: new THREE.MeshStandardMaterial({ color: 0xc8312f, metalness: 0.3, roughness: 0.45 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x2f64c8, metalness: 0.3, roughness: 0.45 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x7a5232, metalness: 0.0, roughness: 0.8 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x9fc4e8, metalness: 0, roughness: 0.08, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
  glassBlock: new THREE.MeshPhysicalMaterial({ color: 0x7f8fa3, metalness: 0.2, roughness: 0.3, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }),
  ghost: new THREE.MeshStandardMaterial({ color: 0x9aa7b8, metalness: 0.3, roughness: 0.5, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
};

// Asocia nombre y descripción a una pieza para el inspector al pasar el ratón
export function part(obj, name, desc) {
  obj.userData.part = { name, desc };
  return obj;
}

export function mesh(geo, mat, name, desc) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  if (name) part(m, name, desc);
  return m;
}

// Cilindro cuyo eje va a lo largo de X
export function cylX(r, len, mat, seg = 32) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateZ(Math.PI / 2);
  return new THREE.Mesh(g, mat);
}

export function cylZ(r, len, mat, seg = 32) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateX(Math.PI / 2);
  return new THREE.Mesh(g, mat);
}

// Orienta un objeto de eje Y para que vaya de a hasta b
const _up = new THREE.Vector3(0, 1, 0);
export function placeBetween(obj, a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  obj.position.copy(a).addScaledVector(d, 0.5);
  obj.quaternion.setFromUnitVectors(_up, d.normalize());
  return len;
}

// Rueda dentada recta exterior (perfil trapecial aproximando la evolvente)
export function gearShape(teeth, module, opts = {}) {
  const rp = teeth * module / 2;
  const ra = rp + module;
  const rf = Math.max(rp - 1.25 * module, module);
  const shape = new THREE.Shape();
  const step = Math.PI * 2 / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const pts = [
      [rf, a0 - step * 0.30],
      [ra, a0 - step * 0.15],
      [ra, a0 + step * 0.15],
      [rf, a0 + step * 0.30],
    ];
    pts.forEach(([r, a], k) => {
      const x = r * Math.cos(a), y = r * Math.sin(a);
      if (i === 0 && k === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    });
    // arco de fondo
    const aEnd = a0 + step * 0.7;
    for (let s = 1; s <= 3; s++) {
      const a = a0 + step * 0.30 + (aEnd - a0 - step * 0.30) * s / 3;
      shape.lineTo(rf * Math.cos(a), rf * Math.sin(a));
    }
  }
  if (opts.bore) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, opts.bore, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  return shape;
}

export function gearGeometry(teeth, module, width, opts = {}) {
  const g = new THREE.ExtrudeGeometry(gearShape(teeth, module, opts), { depth: width, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -width / 2);
  return g;
}

// Corona de dentado interior
export function ringGearGeometry(teeth, module, width, outerR) {
  const rp = teeth * module / 2;
  const ra = rp - module;       // los dientes apuntan hacia dentro
  const rf = rp + 1.25 * module;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  const step = Math.PI * 2 / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step + step / 2;
    const pts = [[rf, a0 - step * 0.30], [ra, a0 - step * 0.15], [ra, a0 + step * 0.15], [rf, a0 + step * 0.30]];
    pts.forEach(([r, a], k) => {
      const x = r * Math.cos(a), y = r * Math.sin(a);
      if (i === 0 && k === 0) hole.moveTo(x, y); else hole.lineTo(x, y);
    });
    const aEnd = a0 + step * 0.7;
    for (let s = 1; s <= 3; s++) {
      const a = a0 + step * 0.30 + (aEnd - a0 - step * 0.30) * s / 3;
      hole.lineTo(rf * Math.cos(a), rf * Math.sin(a));
    }
  }
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 48 });
  g.translate(0, 0, -width / 2);
  return g;
}

// Muelle helicoidal de altura 1 (se escala en Y)
export function springGeometry(radius, wire, turns) {
  const pts = [];
  const n = turns * 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, t, Math.sin(a) * radius));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, n, wire, 6, false);
}

// Brillo aditivo (chispa, llama)
let _glowTex = null;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,240,200,0.9)');
  grd.addColorStop(0.5, 'rgba(255,170,60,0.35)');
  grd.addColorStop(1, 'rgba(255,120,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}

export function glowSprite(color = 0xffffff, size = 0.05) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}

// Color de un gas según su temperatura (K)
const _c = new THREE.Color();
export function flameColor(T, out = new THREE.Color()) {
  if (T < 900) return out.setRGB(0.55, 0.25, 0.2);
  const t = Math.min(1, (T - 900) / 1800);
  if (t < 0.4) return out.setRGB(0.6 + t, 0.15 + t * 0.6, 0.05);
  if (t < 0.75) return out.setRGB(1, 0.39 + (t - 0.4) * 1.3, 0.05 + (t - 0.4) * 0.4);
  return out.setRGB(1, 0.85 + (t - 0.75) * 0.6, 0.2 + (t - 0.75) * 2.6);
}

export function lerpColor(a, b, t, out = _c) {
  return out.copy(a).lerp(b, Math.max(0, Math.min(1, t)));
}

export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => { if (!Object.values(mats).includes(m)) m.dispose(); });
    }
  });
}

export function fmt(v, d = 0) {
  if (v === null || v === undefined || !isFinite(v)) return '·';
  return v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
}
