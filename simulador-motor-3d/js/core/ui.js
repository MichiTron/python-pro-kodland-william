// Construcción de la interfaz: controles a partir de definiciones de parámetros,
// panel de datos, gráficas y contenido didáctico.
import { prepCanvas } from './charts.js';
import { fmt } from './kit.js';

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}

function formatValue(def, v) {
  if (def.format) return def.format(v);
  const d = def.decimals ?? (def.step && def.step < 1 ? Math.min(3, Math.ceil(-Math.log10(def.step))) : 0);
  return `${fmt(v * (def.scale || 1), d)}${def.unit ? ' ' + def.unit : ''}`;
}

// Panel de parámetros. defs: [{id, label, type, group, min, max, step, unit, help, options, visible(values)}]
export class ParamPanel {
  constructor(container, onChange) {
    this.container = container;
    this.onChange = onChange;
    this.inputs = new Map();
    this.collapsed = new Set();
  }

  render(defs, values) {
    this.defs = defs;
    this.values = values;
    this.container.innerHTML = '';
    this.inputs.clear();
    const groups = new Map();
    defs.forEach((d) => {
      if (d.visible && !d.visible(values)) return;
      const g = d.group || 'Parámetros';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(d);
    });
    for (const [name, list] of groups) {
      const body = el('div', { class: 'pgroup-body' });
      const head = el('button', { class: 'pgroup-head', type: 'button', 'aria-expanded': String(!this.collapsed.has(name)) }, name);
      const box = el('section', { class: 'pgroup' + (this.collapsed.has(name) ? ' collapsed' : '') }, head, body);
      head.addEventListener('click', () => {
        box.classList.toggle('collapsed');
        if (box.classList.contains('collapsed')) this.collapsed.add(name); else this.collapsed.delete(name);
        head.setAttribute('aria-expanded', String(!box.classList.contains('collapsed')));
      });
      list.forEach((d) => body.append(this.control(d, values[d.id])));
      this.container.append(box);
    }
  }

  control(d, value) {
    const id = 'p_' + d.id;
    const help = d.help ? el('span', { class: 'help', tabindex: '0', 'data-tip': d.help }, '?') : null;
    if (d.type === 'select') {
      const sel = el('select', { id });
      d.options.forEach((o) => sel.append(el('option', { value: String(o.value), selected: String(o.value) === String(value) }, o.label)));
      sel.addEventListener('change', () => {
        const opt = d.options.find((o) => String(o.value) === sel.value);
        this.emit(d, opt ? opt.value : sel.value);
      });
      this.inputs.set(d.id, { d, input: sel });
      return el('div', { class: 'prow' }, el('label', { for: id }, d.label, help), sel);
    }
    if (d.type === 'toggle') {
      const cb = el('input', { type: 'checkbox', id, checked: !!value });
      cb.addEventListener('change', () => this.emit(d, cb.checked));
      this.inputs.set(d.id, { d, input: cb });
      return el('div', { class: 'prow toggle' }, el('label', { for: id }, cb, el('span', { class: 'switch' }), d.label, help));
    }
    const out = el('output', { for: id }, formatValue(d, value));
    const rng = el('input', { type: 'range', id, min: d.min, max: d.max, step: d.step || 1, value });
    rng.addEventListener('input', () => {
      const v = parseFloat(rng.value);
      out.textContent = formatValue(d, v);
      this.emit(d, v, true);
    });
    rng.addEventListener('change', () => this.emit(d, parseFloat(rng.value), false));
    this.inputs.set(d.id, { d, input: rng, out });
    return el('div', { class: 'prow' }, el('div', { class: 'plabel' }, el('label', { for: id }, d.label, help), out), rng);
  }

  emit(d, v, live = false) {
    if (live && d.live === false) return;
    this.values[d.id] = v;
    this.onChange(d, v, live);
  }

  // actualiza el valor mostrado sin disparar eventos (p. ej. desde el teclado)
  setValue(id, v) {
    const it = this.inputs.get(id);
    if (!it) return;
    if (it.d.type === 'toggle') it.input.checked = !!v;
    else if (it.d.type === 'select') it.input.value = String(v);
    else { it.input.value = v; it.out.textContent = formatValue(it.d, v); }
  }
}

// Tabla de telemetría agrupada; se reconstruye solo cuando cambia la estructura
export class DataPanel {
  constructor(container) { this.container = container; this.sig = ''; this.cells = []; }
  update(groups) {
    const sig = groups.map((g) => g.title + ':' + g.items.map((i) => i.label).join(',')).join('|');
    if (sig !== this.sig) {
      this.sig = sig;
      this.container.innerHTML = '';
      this.cells = [];
      groups.forEach((g) => {
        const tbody = el('tbody');
        g.items.forEach((it) => {
          const val = el('td', { class: 'val' });
          const row = el('tr', {}, el('th', { scope: 'row', title: it.help || '' }, it.label), val);
          tbody.append(row);
          this.cells.push({ val, row });
        });
        this.container.append(el('h3', { class: 'dgroup' }, g.title), el('table', { class: 'data' }, tbody));
      });
    }
    let k = 0;
    groups.forEach((g) => g.items.forEach((it) => {
      const c = this.cells[k++];
      const txt = typeof it.value === 'string' ? it.value : fmt(it.value, it.d ?? 0) + (it.unit ? ' ' + it.unit : '');
      if (c.val.textContent !== txt) c.val.textContent = txt;
      c.row.className = it.warn ? 'warn' : it.good ? 'good' : '';
    }));
  }
}

export class ChartPanel {
  constructor(container) { this.container = container; this.items = []; this.sig = ''; }
  setCharts(charts) {
    const sig = charts.map((c) => c.title).join('|');
    if (sig === this.sig) { this.items.forEach((it, i) => { it.chart = charts[i]; }); return; }
    this.sig = sig;
    this.container.innerHTML = '';
    this.items = charts.map((c) => {
      const canvas = el('canvas', { class: 'chart', style: `height:${c.height || 190}px`, role: 'img', 'aria-label': c.title });
      const fig = el('figure', { class: 'chartbox' }, el('figcaption', {}, c.title, c.note ? el('span', { class: 'note' }, c.note) : null), canvas);
      this.container.append(fig);
      return { chart: c, canvas, fig };
    });
  }
  draw() {
    this.items.forEach((it) => {
      if (!it.canvas.clientWidth) return;
      const { ctx, w, h } = prepCanvas(it.canvas);
      try { it.chart.draw(ctx, w, h); } catch (e) { console.error(e); }
    });
  }
}
