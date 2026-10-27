// Aplicación principal: escena 3D, bucle de simulación e interfaz.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SYSTEMS, byId } from './systems/registry.js';
import { ParamPanel, DataPanel, ChartPanel, el } from './core/ui.js';
import { prepCanvas } from './core/charts.js';
import { fmt } from './core/kit.js';
import { LESSONS, QUIZ } from './content/lessons.js';

const TIME_SCALES = [
  { v: 1, label: 'Tiempo real' }, { v: 0.5, label: 'Cámara lenta ×1/2' }, { v: 0.25, label: '×1/4' }, { v: 0.1, label: '×1/10' },
  { v: 0.04, label: '×1/25' }, { v: 0.02, label: '×1/50' }, { v: 0.01, label: '×1/100' }, { v: 0.004, label: '×1/250' },
];

class App {
  constructor() {
    this.viewport = document.getElementById('viewport');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.viewport.prepend(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1522);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 2000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x2a2420, 0.6);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun, this.sun.target);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a2332, roughness: 0.95, metalness: 0 });
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(1, 64), floorMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
    this.grid = new THREE.GridHelper(2, 20, 0x3a4a66, 0x253247);
    this.scene.add(this.grid);

    this.main = null; this.cmp = null; this.focus = 'main';
    this.timeScale = 1; this.paused = false; this.stepReq = 0;
    this.keys = new Set();
    this.clock = new THREE.Clock();
    this.lastUi = 0; this.lastCharts = 0; this.lastPhase = 0;
    this.raycaster = new THREE.Raycaster();
    this.pointer = null;

    this.panel = new ParamPanel(document.getElementById('params'), (d, v, live) => this.onParam(d, v, live));
    this.data = new DataPanel(document.getElementById('tab-data'));
    this.chartsPanel = new ChartPanel(document.getElementById('tab-charts'));
    this.hud = document.getElementById('hud');
    this.phaseBox = document.getElementById('phase');
    this.tooltip = document.getElementById('tooltip');
    this.buildHeader();
    this.bindEvents();
    this.resize();
    const hash = new URLSearchParams(location.hash.slice(1));
    this.load(byId[hash.get('s')] ? hash.get('s') : 'otto');
    if (hash.get('c') && byId[hash.get('c')]) { this.cmpSelect.value = hash.get('c'); this.setCompare(hash.get('c')); }
    if (hash.get('t')) this.showTab(hash.get('t'));
    this.loop();
  }

  // Avanza la simulación sin dibujar (útil para pruebas automáticas)
  fastForward(seconds, dt = 1 / 120) {
    for (let t = 0; t < seconds; t += dt) { this.main.update(dt); if (this.cmp) this.cmp.update(dt); }
  }

  get active() { return this.focus === 'cmp' && this.cmp ? this.cmp : this.main; }

  buildHeader() {
    const tabs = document.getElementById('systems');
    let lastCat = '';
    SYSTEMS.forEach((s) => {
      if (s.category !== lastCat) { tabs.append(el('span', { class: 'cat' }, s.category)); lastCat = s.category; }
      tabs.append(el('button', { class: 'sys', 'data-id': s.id, title: s.desc, onclick: () => this.load(s.id) }, s.short));
    });
    const cmp = document.getElementById('compare');
    cmp.append(el('option', { value: '' }, 'Nada'));
    SYSTEMS.forEach((s) => cmp.append(el('option', { value: s.id }, s.short)));
    cmp.addEventListener('change', () => this.setCompare(cmp.value));
    this.cmpSelect = cmp;
    const ts = document.getElementById('timescale');
    TIME_SCALES.forEach((t) => ts.append(el('option', { value: t.v }, t.label)));
    ts.addEventListener('change', () => { this.timeScale = parseFloat(ts.value); });
    this.tsSelect = ts;
    document.getElementById('pause').addEventListener('click', () => this.togglePause());
    document.getElementById('step').addEventListener('click', () => { this.paused = true; this.stepReq = 1; this.updatePauseBtn(); });
    document.getElementById('frame').addEventListener('click', () => this.frameView());
    document.getElementById('helpBtn').addEventListener('click', () => document.getElementById('help').showModal());
    document.getElementById('lessonBtn').addEventListener('click', () => this.startLesson());
    const L = document.getElementById('lesson');
    L.querySelector('.lclose').addEventListener('click', () => this.endLesson());
    L.querySelector('.lprev').addEventListener('click', () => this.showStep(this.lesson.i - 1));
    L.querySelector('.lnext').addEventListener('click', () => (this.lesson.i + 1 < this.lesson.steps.length ? this.showStep(this.lesson.i + 1) : this.endLesson()));
    document.querySelectorAll('[data-focus]').forEach((b) => b.addEventListener('click', () => { this.focus = b.dataset.focus; this.refreshSide(); }));
    document.querySelectorAll('.tabs [data-tab]').forEach((b) => b.addEventListener('click', () => this.showTab(b.dataset.tab)));
  }

  showTab(id) {
    document.querySelectorAll('.tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    document.querySelectorAll('.tabpanel').forEach((p) => { p.hidden = p.id !== 'tab-' + id; });
    this.tab = id;
    this.lastCharts = 0;
  }

  startLesson() {
    const steps = LESSONS[this.main.def.id];
    if (!steps) return;
    this.focus = 'main';
    this.lesson = { steps, i: 0 };
    document.getElementById('lesson').hidden = false;
    this.showStep(0);
  }

  endLesson() {
    this.lesson = null;
    document.getElementById('lesson').hidden = true;
    this.setTimeScale(1);
  }

  setTimeScale(v) {
    this.timeScale = v;
    const opt = [...this.tsSelect.options].find((o) => Math.abs(parseFloat(o.value) - v) < 1e-9);
    if (opt) this.tsSelect.value = opt.value;
  }

  showStep(i) {
    const L = this.lesson;
    if (!L || i < 0 || i >= L.steps.length) return;
    L.i = i;
    const st = L.steps[i];
    const box = document.getElementById('lesson');
    box.querySelector('.lstep').textContent = `Lección · paso ${i + 1} de ${L.steps.length}`;
    box.querySelector('.ltitle').textContent = st.title;
    box.querySelector('.ltext').textContent = st.text;
    box.querySelector('.lprev').disabled = i === 0;
    box.querySelector('.lnext').textContent = i + 1 < L.steps.length ? 'Siguiente ▶' : 'Terminar ✓';
    if (st.set) { this.applyExperiment({ title: '', set: st.set }, true); }
    if (st.time !== undefined) this.setTimeScale(st.time);
    if (st.tab) this.showTab(st.tab);
    if (st.cam) this.tweenCamera(new THREE.Vector3(...st.cam.p), new THREE.Vector3(...st.cam.t));
    this.paused = false; this.updatePauseBtn();
  }

  tweenCamera(pos, target) {
    this.camTween = { p0: this.camera.position.clone(), t0: this.controls.target.clone(), p1: pos, t1: target, start: performance.now(), dur: 900 };
  }

  togglePause() { this.paused = !this.paused; this.updatePauseBtn(); }
  updatePauseBtn() { document.getElementById('pause').textContent = this.paused ? '▶ Reanudar' : '❚❚ Pausa'; }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    new ResizeObserver(() => this.resize()).observe(this.viewport);
    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, select, textarea')) { if (e.target.type !== 'range') return; }
      if (e.code === 'Space') { e.preventDefault(); this.togglePause(); return; }
      if (['ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.code === 'KeyR') { const a = this.main.actions().find((x) => x.id === 'start' || x.id === 'run'); if (a) a.onClick(); }
      if (e.code === 'KeyF') this.frameView();
      const changed = this.main.onKeyDown ? this.main.onKeyDown(e.code) : null;
      if (changed) changed.forEach((id) => this.panel.setValue(id, this.main.values[id]));
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    const cv = this.renderer.domElement;
    cv.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); this.pointer = { x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1, cx: e.clientX - r.left, cy: e.clientY - r.top }; });
    cv.addEventListener('pointerleave', () => { this.pointer = null; this.tooltip.hidden = true; });
  }

  resize() {
    const w = this.viewport.clientWidth, h = this.viewport.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  createInstance(id) {
    const def = byId[id];
    const inst = def.create(this);
    inst.def = def;
    return inst;
  }

  load(id) {
    if (this.main) { this.scene.remove(this.main.root); this.main.dispose(); }
    this.main = this.createInstance(id);
    this.scene.add(this.main.root);
    if (this.lesson) this.endLesson();
    document.getElementById('lessonBtn').disabled = !LESSONS[id];
    this.focus = 'main';
    document.querySelectorAll('.sys').forEach((b) => b.setAttribute('aria-current', String(b.dataset.id === id)));
    document.getElementById('sysTitle').textContent = this.main.def.name;
    if (this.cmp) this.placeCompare();
    this.refreshSide();
    this.frameView();
    history.replaceState(null, '', '#s=' + id + (this.cmp ? '&c=' + this.cmp.def.id : ''));
  }

  setCompare(id) {
    if (this.cmp) { this.scene.remove(this.cmp.root); this.cmp.dispose(); this.cmp = null; }
    if (id) { this.cmp = this.createInstance(id); this.scene.add(this.cmp.root); this.placeCompare(); }
    this.focus = 'main';
    document.getElementById('focusBar').hidden = !this.cmp;
    this.refreshSide();
    this.frameView();
    history.replaceState(null, '', '#s=' + this.main.def.id + (this.cmp ? '&c=' + id : ''));
  }

  placeCompare() {
    const mv = this.main.view, cv = this.cmp.view;
    const ownsGround = this.main.ownsGround;
    const sep = ownsGround ? mv.size.z / 2 + cv.size.x / 2 + 1.2 : mv.size.x / 2 + cv.size.x / 2 + Math.max(mv.size.x, cv.size.x) * 0.15;
    // la escala del sistema comparado se ajusta para que ambos se vean (indicada en la etiqueta)
    const s = this.compareScale();
    this.cmp.root.scale.setScalar(s);
    if (ownsGround) this.cmp.root.position.set(mv.center.x, -(cv.center.y - cv.size.y / 2) * s + 0.02, -(cv.size.z * s / 2 + 5.2));
    else this.cmp.root.position.set(mv.center.x + mv.size.x / 2 + cv.size.x * s / 2 + Math.max(mv.size.x, cv.size.x * s) * 0.18 - cv.center.x * s, mv.center.y - cv.center.y * s, mv.center.z - cv.center.z * s);
    void sep;
  }

  // Etiquetas flotantes con el nombre de cada sistema en modo comparación
  updateLabels() {
    const box = document.getElementById('labels');
    if (!this.cmp) { box.hidden = true; return; }
    box.hidden = false;
    const items = [[this.main, 1, 'Principal'], [this.cmp, this.cmp.root.scale.x, 'Comparado']];
    const w = this.viewport.clientWidth, h = this.viewport.clientHeight;
    items.forEach(([inst, s, role], i) => {
      let lab = box.children[i];
      if (!lab) { lab = el('div', { class: 'slabel' }); box.append(lab); }
      const v = inst.view;
      const p = v.center.clone().multiplyScalar(s).add(inst.root.position);
      p.y += v.size.y * s * 0.55;
      p.project(this.camera);
      const txt = `${role}: ${inst.def.short}${Math.abs(s - 1) > 0.01 ? ` (escala ×${fmt(s, 2)})` : ''}`;
      if (lab.textContent !== txt) lab.textContent = txt;
      lab.hidden = p.z > 1;
      lab.style.transform = `translate(${(p.x * 0.5 + 0.5) * w}px, ${(-p.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
    });
  }

  compareScale() {
    if (!this.cmp) return 1;
    const a = this.main.view.size.length(), b = this.cmp.view.size.length();
    const r = a / b;
    if (r > 0.33 && r < 3) return 1;
    return Math.min(4, Math.max(0.25, r * 0.8));
  }

  frameView() {
    const v = this.main.view;
    let center = v.center.clone(), size = v.size.clone();
    if (this.cmp) {
      const box = new THREE.Box3().setFromCenterAndSize(v.center, v.size);
      const s = this.cmp.root.scale.x;
      const cv = this.cmp.view;
      box.union(new THREE.Box3().setFromCenterAndSize(cv.center.clone().multiplyScalar(s).add(this.cmp.root.position), cv.size.clone().multiplyScalar(s)));
      box.getCenter(center); box.getSize(size);
    }
    const dir = (v.dir || (v.front ? new THREE.Vector3(0.35, 0.3, 1) : new THREE.Vector3(0.8, 0.5, 1))).clone().normalize();
    const radius = size.length() / 2;
    const fov = this.camera.fov * Math.PI / 180;
    const dist = radius / Math.sin(fov / 2) * (this.camera.aspect < 1 ? 1.25 : 0.82);
    this.camera.position.copy(center).addScaledVector(dir, dist);
    this.camera.near = Math.max(0.005, dist / 200); this.camera.far = dist * 60 + 500;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(center);
    this.controls.update();
    // suelo
    const own = this.main.ownsGround;
    this.floor.visible = this.grid.visible = !own;
    const R = Math.max(size.x, size.z) * 1.6;
    const bottom = center.y - size.y / 2 - 0.002;
    this.floor.scale.setScalar(R); this.floor.position.set(center.x, bottom, center.z);
    this.grid.scale.setScalar(R); this.grid.position.set(center.x, bottom + 0.001, center.z);
    this.scene.background.setHex(own ? 0x9cc4e8 : 0x0e1522);
    this.scene.fog = own ? new THREE.Fog(0x9cc4e8, 60, 220) : null;
    const L = Math.max(radius * 3, 2);
    this.sun.position.copy(center).add(new THREE.Vector3(L * 0.6, L * 1.2, L * 0.8));
    this.sun.target.position.copy(center);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -radius * 1.6; sc.right = sc.top = radius * 1.6; sc.near = 0.01; sc.far = L * 4;
    sc.updateProjectionMatrix();
  }

  refreshSide() {
    const inst = this.active;
    document.querySelectorAll('[data-focus]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.focus === this.focus)));
    if (this.cmp) {
      document.querySelector('[data-focus="main"]').textContent = '◀ ' + this.main.def.short;
      document.querySelector('[data-focus="cmp"]').textContent = this.cmp.def.short + ' ▶';
    }
    this.refreshPanel();
    this.renderLearn();
    this.chartsPanel.sig = '';
    this.data.sig = '';
    this.lastUi = 0; this.lastCharts = 0;
  }

  refreshPanel() {
    const inst = this.active;
    this.panel.render(inst.def.params(inst.values), inst.values);
    this.renderActions();
  }

  renderActions() {
    const box = document.getElementById('actions');
    const acts = this.active.actions();
    const sig = acts.map((a) => a.label).join('|');
    if (sig === this.actSig) return;
    this.actSig = sig;
    box.innerHTML = '';
    acts.forEach((a) => box.append(el('button', { class: 'btn' + (a.primary ? ' primary' : ''), onclick: () => { a.onClick(); this.actSig = ''; this.renderActions(); } }, a.label)));
  }

  renderLearn() {
    const inst = this.active;
    const box = document.getElementById('tab-learn');
    box.innerHTML = '';
    box.append(el('h2', {}, inst.def.name));
    box.append(el('div', { class: 'learn', html: inst.learn || '' }));
    if (inst.experiments && inst.experiments.length) {
      box.append(el('h3', {}, 'Experimentos guiados'));
      inst.experiments.forEach((x) => {
        box.append(el('div', { class: 'exp' }, el('h4', {}, x.title), el('p', {}, x.text), el('button', { class: 'btn small primary', onclick: () => this.applyExperiment(x) }, 'Probar')));
      });
    }
    const quiz = QUIZ[inst.def.id];
    if (quiz) {
      box.append(el('h3', {}, 'Comprueba lo aprendido'));
      quiz.forEach((q) => {
        const why = el('div', { class: 'why', hidden: true }, q.why);
        const card = el('div', { class: 'quiz' }, el('p', {}, q.q));
        q.a.forEach((ans, k) => card.append(el('button', { class: 'btn small', onclick: (ev) => {
          card.querySelectorAll('button').forEach((b, j) => { b.disabled = true; if (j === q.ok) b.classList.add('right'); });
          if (k !== q.ok) ev.currentTarget.classList.add('wrong');
          why.hidden = false;
          why.textContent = (k === q.ok ? '¡Correcto! ' : 'No exactamente. ') + q.why;
        } }, ans)));
        card.append(why);
        box.append(card);
      });
    }
  }

  applyExperiment(x, silent = false) {
    const inst = this.active;
    const entries = Object.entries(x.set);
    entries.sort((a, b) => (a[0] === 'powertrain' ? -1 : b[0] === 'powertrain' ? 1 : 0));
    for (const [k, v] of entries) { inst.values[k] = v; inst.setParam(k, v); }
    this.refreshPanel();
    if (!silent) this.toast(`Experimento: ${x.title}`);
  }

  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }

  onParam(d, v, live) {
    const inst = this.active;
    inst.setParam(d.id, v);
    if (d.uiRefresh && !live) this.refreshPanel();
    if (d.rebuild && !live && inst === this.main && d.id !== 'xray') { if (this.cmp) this.placeCompare(); }
  }

  // Si el equipo no llega a ~25 fps, se reduce la resolución y se quitan las sombras
  adaptQuality(dt) {
    if (this.qualityReduced || document.hidden) return;
    this.frameAvg = this.frameAvg === undefined ? dt : this.frameAvg * 0.97 + dt * 0.03;
    this.frameCount = (this.frameCount || 0) + 1;
    if (this.frameCount > 180 && this.frameAvg > 0.04) {
      this.qualityReduced = true;
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
      this.resize();
      this.toast('Calidad gráfica reducida para mantener la fluidez');
    }
  }

  updateKeys(dt) {
    const inst = this.main;
    if (inst.keyControl) {
      const ch = inst.keyControl(this.keys, dt);
      if (ch && this.focus === 'main') ch.forEach((id) => this.panel.setValue(id, inst.values[id]));
      return;
    }
    if (inst.values.throttle === undefined) return;
    let d = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) d += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) d -= 1;
    if (d) {
      const v = Math.max(0, Math.min(1, inst.values.throttle + d * dt * 0.9));
      inst.values.throttle = v; inst.setParam('throttle', v);
      if (this.focus === 'main') this.panel.setValue('throttle', v);
    }
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    const rawDt = this.clock.getDelta();
    const dtReal = Math.min(0.05, rawDt);
    this.adaptQuality(rawDt);
    this.updateKeys(dtReal);
    let simDt = 0;
    if (!this.paused) simDt = dtReal * this.timeScale;
    else if (this.stepReq) { simDt = 1 / 60 * Math.min(this.timeScale, 0.02); this.stepReq = 0; }
    if (simDt > 0) {
      try { this.main.update(simDt); if (this.cmp) this.cmp.update(simDt); } catch (e) { if (!this.errShown) { console.error(e); this.errShown = true; } }
    }
    if (this.camTween) {
      const c = this.camTween;
      const k = Math.min(1, (performance.now() - c.start) / c.dur);
      const e = k * k * (3 - 2 * k);
      this.camera.position.lerpVectors(c.p0, c.p1, e);
      this.controls.target.lerpVectors(c.t0, c.t1, e);
      if (k >= 1) this.camTween = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    const now = performance.now();
    this.drawHud();
    this.updateTooltip();
    this.updateLabels();
    if (now - this.lastPhase > 100) { this.lastPhase = now; this.drawPhase(); this.renderActions(); }
    if (now - this.lastUi > 180) { this.lastUi = now; try { this.data.update(this.active.telemetry()); } catch (e) { console.error(e); } }
    if (this.tab === 'charts' && now - this.lastCharts > 110) { this.lastCharts = now; this.chartsPanel.setCharts(this.active.charts()); this.chartsPanel.draw(); }
  }

  updateTooltip() {
    if (!this.pointer) return;
    if ((this.ttFrame = (this.ttFrame || 0) + 1) % 4) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const roots = [this.main.root]; if (this.cmp) roots.push(this.cmp.root);
    const hits = this.raycaster.intersectObjects(roots, true);
    let info = null;
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.part) o = o.parent;
      if (o && o.visible !== false && o.userData.part.name) { info = o.userData.part; break; }
    }
    if (!info) { this.tooltip.hidden = true; return; }
    this.tooltip.hidden = false;
    this.tooltip.innerHTML = `<b>${info.name}</b>${info.desc ? `<span>${info.desc}</span>` : ''}`;
    const vw = this.viewport.clientWidth;
    const x = Math.min(this.pointer.cx + 16, vw - 300);
    this.tooltip.style.transform = `translate(${x}px, ${this.pointer.cy + 14}px)`;
  }

  drawPhase() {
    const inst = this.main;
    const ph = inst.phase ? inst.phase() : null;
    const box = this.phaseBox;
    if (!ph) { box.hidden = true; return; }
    box.hidden = false;
    const sig = ph.title + '|' + ph.text;
    if (sig !== this.phaseSig) {
      this.phaseSig = sig;
      box.querySelector('.ptitle').textContent = ph.title;
      box.querySelector('.ptext').textContent = ph.text;
      box.querySelector('.pnote').textContent = ph.note || '';
    }
    const cv = box.querySelector('canvas');
    cv.hidden = !ph.wheel;
    if (ph.wheel) this.drawWheel(cv, ph.wheel);
  }

  drawWheel(cv, w) {
    const { ctx, w: W, h: H } = prepCanvas(cv);
    const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 6;
    const toA = (deg) => -Math.PI / 2 + (deg - w.from) / w.span * Math.PI * 2;
    w.segs.forEach((s) => {
      ctx.beginPath(); ctx.strokeStyle = s.color; ctx.lineWidth = 9;
      ctx.arc(cx, cy, r - 5, toA(s.from), toA(Math.max(s.from + 0.5, s.to))); ctx.stroke();
    });
    const a = toA(w.angle);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1)); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.font = '600 9px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#cfd8e6';
    ctx.fillText(`${fmt(w.angle, 0)}°`, cx, cy + 16);
  }

  drawHud() {
    const g = this.main.hud ? this.main.hud() : [];
    const cv = this.hud;
    if (!g.length) { cv.hidden = true; return; }
    cv.hidden = false;
    const { ctx, w, h } = prepCanvas(cv);
    const n = g.length;
    const size = Math.min(h - (g.bars ? 18 : 4), (w - 8) / n);
    g.forEach((gg, i) => this.gauge(ctx, 4 + size * i + size / 2, size / 2 + 2, size / 2 - 4, gg));
    if (g.bars) g.bars.forEach((b, i) => {
      const bw = (w - 16) / g.bars.length - 8, x = 8 + i * (bw + 8), y = h - 12;
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, y, bw, 7);
      ctx.fillStyle = b.color; ctx.fillRect(x, y, bw * b.value, 7);
      ctx.fillStyle = '#cfd8e6'; ctx.font = '9px Inter, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(b.label, x, y - 2);
    });
  }

  gauge(ctx, cx, cy, r, g) {
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    const min = g.min || 0;
    const toA = (v) => a0 + (Math.max(min, Math.min(g.max, v)) - min) / (g.max - min) * (a1 - a0);
    ctx.fillStyle = 'rgba(8,13,22,0.78)'; ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(200,215,240,0.25)'; ctx.beginPath(); ctx.arc(cx, cy, r - 4, a0, a1); ctx.stroke();
    if (g.red) { ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, r - 4, toA(g.red), a1); ctx.stroke(); }
    const scale = g.scale || 1;
    const span = (g.max - min) / scale;
    const step = span > 12 ? (span > 40 ? 20 : 2) : 1;
    ctx.fillStyle = '#cfd8e6'; ctx.font = `${Math.max(8, r * 0.16)}px Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const nTicks = Math.floor(span / step);
    const stride = Math.max(1, Math.ceil(nTicks / 10));
    for (let k = 0, v = min / scale; v <= g.max / scale + 1e-6; v += step, k++) {
      const a = toA(v * scale);
      ctx.strokeStyle = 'rgba(220,230,245,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8)); ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2)); ctx.stroke();
      if (k % stride === 0) ctx.fillText(String(Math.round(v)), cx + Math.cos(a) * (r - 18), cy + Math.sin(a) * (r - 18));
    }
    const a = toA(g.value);
    ctx.strokeStyle = '#ff9a3c'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6)); ctx.stroke();
    ctx.fillStyle = '#ff9a3c'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `600 ${Math.max(10, r * 0.24)}px Inter, system-ui, sans-serif`;
    ctx.fillText(fmt(g.value, g.value < 10 && g.max <= 20 ? 1 : 0), cx, cy + r * 0.42);
    ctx.fillStyle = '#9fb0c8'; ctx.font = `${Math.max(8, r * 0.13)}px Inter, system-ui, sans-serif`;
    ctx.fillText(g.unit || g.label, cx, cy + r * 0.66);
    if (g.sub) { ctx.fillStyle = '#7ee787'; ctx.font = `700 ${Math.max(12, r * 0.3)}px Inter, system-ui, sans-serif`; ctx.fillText(g.sub, cx, cy - r * 0.35); }
    ctx.textBaseline = 'alphabetic';
  }
}

window.app = new App();
