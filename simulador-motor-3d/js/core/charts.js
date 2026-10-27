// Gráficas 2D ligeras sobre canvas (diagramas p-V, curvas de par, series temporales, mapas).

export const COLORS = {
  grid: 'rgba(160,180,210,0.12)', axis: 'rgba(190,205,230,0.55)', text: '#aab6c8',
  a: '#4cc3ff', b: '#ffb347', c: '#7ee787', d: '#ff6b8b', e: '#c39bff', f: '#ffe066',
};

function niceStep(range, target = 5) {
  const raw = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const s = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return s * mag;
}

function fmtTick(v, step) {
  const d = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step)));
  return v.toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: d });
}

export function prepCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

// opts: { series:[{xs, ys, color, width, dash, label, axis:'right'}], xLabel, yLabel, y2Label,
//         xMin, xMax, yMin, yMax, y2Min, y2Max, xLog, yLog, markers:[{x, y, color, label, axis}], vlines:[{x, color, label}], bands:[{x0,x1,color,label}] }
export function lineChart(ctx, w, h, o) {
  const padL = 46, padR = o.y2Label ? 46 : 12, padT = 10, padB = 30;
  const pw = w - padL - padR, ph = h - padT - padB;
  const all = (key, axis) => o.series.filter((s) => (s.axis === 'right') === (axis === 'right')).flatMap((s) => Array.from(s[key]).filter((v) => isFinite(v)));
  const xsAll = o.series.flatMap((s) => Array.from(s.xs));
  let xMin = o.xMin ?? Math.min(...xsAll), xMax = o.xMax ?? Math.max(...xsAll);
  let yMin = o.yMin ?? Math.min(...all('ys', 'left'), 0), yMax = o.yMax ?? Math.max(...all('ys', 'left'));
  if (!isFinite(yMin) || !isFinite(yMax)) { yMin = 0; yMax = 1; }
  if (yMax - yMin < 1e-9) yMax = yMin + 1;
  if (!o.yMax && !o.yLog) yMax += (yMax - yMin) * 0.06;
  if (xMax - xMin < 1e-9) xMax = xMin + 1;
  let y2Min = o.y2Min ?? 0, y2Max = o.y2Max ?? (o.y2Label ? Math.max(...all('ys', 'right'), 1e-6) * 1.06 : 1);
  const tx = (x) => o.xLog ? padL + (Math.log10(x) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin)) * pw : padL + (x - xMin) / (xMax - xMin) * pw;
  const ty = (y) => o.yLog ? padT + ph - (Math.log10(Math.max(y, 1e-9)) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin)) * ph : padT + ph - (y - yMin) / (yMax - yMin) * ph;
  const ty2 = (y) => padT + ph - (y - y2Min) / (y2Max - y2Min) * ph;

  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.lineWidth = 1;
  // bandas
  (o.bands || []).forEach((b) => {
    ctx.fillStyle = b.color;
    const x0 = Math.max(padL, tx(b.x0)), x1 = Math.min(padL + pw, tx(b.x1));
    if (x1 > x0) ctx.fillRect(x0, padT, x1 - x0, ph);
    if (b.label && x1 - x0 > 24) { ctx.fillStyle = 'rgba(220,230,245,0.65)'; ctx.textAlign = 'center'; ctx.fillText(b.label, (x0 + x1) / 2, padT + 10); }
  });
  // rejilla y ejes
  ctx.strokeStyle = COLORS.grid;
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'center';
  if (o.xLog) {
    for (let e = Math.floor(Math.log10(xMin)); e <= Math.ceil(Math.log10(xMax)); e++) {
      for (const m of [1, 2, 5]) {
        const v = m * Math.pow(10, e);
        if (v < xMin || v > xMax) continue;
        const X = tx(v);
        ctx.beginPath(); ctx.moveTo(X, padT); ctx.lineTo(X, padT + ph); ctx.stroke();
        ctx.fillText(fmtTick(v * (o.xTickScale || 1), v * (o.xTickScale || 1) < 1 ? 0.1 : 1), X, padT + ph + 13);
      }
    }
  } else {
    const xs = niceStep(xMax - xMin, Math.max(3, Math.floor(pw / 70)));
    for (let v = Math.ceil(xMin / xs) * xs; v <= xMax + 1e-9; v += xs) {
      const X = tx(v);
      ctx.beginPath(); ctx.moveTo(X, padT); ctx.lineTo(X, padT + ph); ctx.stroke();
      ctx.fillText(fmtTick(v * (o.xTickScale || 1), xs * (o.xTickScale || 1)), X, padT + ph + 13);
    }
  }
  ctx.textAlign = 'right';
  if (o.yLog) {
    for (let e = Math.floor(Math.log10(yMin)); e <= Math.ceil(Math.log10(yMax)); e++) {
      for (const m of [1, 2, 5]) {
        const v = m * Math.pow(10, e);
        if (v < yMin || v > yMax) continue;
        const Y = ty(v);
        ctx.beginPath(); ctx.moveTo(padL, Y); ctx.lineTo(padL + pw, Y); ctx.stroke();
        ctx.fillText(fmtTick(v * (o.yTickScale || 1), v * (o.yTickScale || 1) < 1 ? 0.1 : 1), padL - 4, Y + 3);
      }
    }
  } else {
    const ys = niceStep(yMax - yMin, Math.max(3, Math.floor(ph / 34)));
    for (let v = Math.ceil(yMin / ys) * ys; v <= yMax + 1e-9; v += ys) {
      const Y = ty(v);
      ctx.beginPath(); ctx.moveTo(padL, Y); ctx.lineTo(padL + pw, Y); ctx.stroke();
      ctx.fillText(fmtTick(v * (o.yTickScale || 1), ys * (o.yTickScale || 1)), padL - 4, Y + 3);
    }
  }
  if (o.y2Label) {
    ctx.textAlign = 'left';
    const ys2 = niceStep(y2Max - y2Min, Math.max(3, Math.floor(ph / 34)));
    for (let v = Math.ceil(y2Min / ys2) * ys2; v <= y2Max + 1e-9; v += ys2) ctx.fillText(fmtTick(v, ys2), padL + pw + 4, ty2(v) + 3);
  }
  ctx.strokeStyle = COLORS.axis;
  ctx.strokeRect(padL, padT, pw, ph);
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'center';
  if (o.xLabel) ctx.fillText(o.xLabel, padL + pw / 2, h - 4);
  if (o.yLabel) { ctx.save(); ctx.translate(11, padT + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(o.yLabel, 0, 0); ctx.restore(); }
  if (o.y2Label) { ctx.save(); ctx.translate(w - 8, padT + ph / 2); ctx.rotate(Math.PI / 2); ctx.fillText(o.y2Label, 0, 0); ctx.restore(); }

  // series
  ctx.save();
  ctx.beginPath(); ctx.rect(padL, padT, pw, ph); ctx.clip();
  for (const s of o.series) {
    const Y = s.axis === 'right' ? ty2 : ty;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width || 1.6;
    ctx.setLineDash(s.dash || []);
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < s.xs.length; i++) {
      const x = s.xs[i], y = s.ys[i];
      if (!isFinite(x) || !isFinite(y) || (o.xLog && x <= 0)) { started = false; continue; }
      const X = tx(x), YY = Y(y);
      if (!started) { ctx.moveTo(X, YY); started = true; } else ctx.lineTo(X, YY);
    }
    ctx.stroke();
    if (s.fill) {
      ctx.lineTo(tx(s.xs[s.xs.length - 1]), Y(Math.max(yMin, 0)));
      ctx.lineTo(tx(s.xs[0]), Y(Math.max(yMin, 0)));
      ctx.fillStyle = s.fill; ctx.fill();
    }
  }
  ctx.setLineDash([]);
  (o.vlines || []).forEach((v) => {
    ctx.strokeStyle = v.color || 'rgba(255,255,255,0.4)';
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(tx(v.x), padT); ctx.lineTo(tx(v.x), padT + ph); ctx.stroke();
    ctx.setLineDash([]);
    if (v.label) { ctx.fillStyle = v.color || '#fff'; ctx.textAlign = 'left'; ctx.fillText(v.label, tx(v.x) + 3, padT + 20); }
  });
  (o.markers || []).forEach((m) => {
    if (!isFinite(m.x) || !isFinite(m.y)) return;
    const Y = m.axis === 'right' ? ty2 : ty;
    ctx.fillStyle = m.color || '#fff';
    ctx.beginPath(); ctx.arc(tx(m.x), Y(m.y), m.r || 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0b1220'; ctx.lineWidth = 1.5; ctx.stroke();
    if (m.label) { ctx.fillStyle = m.color || '#fff'; ctx.textAlign = 'left'; ctx.fillText(m.label, tx(m.x) + 7, Y(m.y) - 6); }
  });
  ctx.restore();
  // leyenda
  const labeled = o.series.filter((s) => s.label);
  if (labeled.length) {
    ctx.textAlign = 'left';
    const widths = labeled.map((s) => ctx.measureText(s.label).width + 24);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = Math.max(padL + 6, padL + pw - total - 4);
    const y = padT + 13;
    ctx.fillStyle = 'rgba(12,20,33,0.75)'; ctx.fillRect(x - 4, y - 10, total + 4, 14);
    labeled.forEach((s, i) => {
      ctx.fillStyle = s.color; ctx.fillRect(x, y - 5, 10, 3);
      ctx.fillStyle = '#d5deeb'; ctx.fillText(s.label, x + 14, y);
      x += widths[i];
    });
  }
  return { tx, ty, padL, padT, pw, ph };
}

// Mapa de calor (rendimiento del motor eléctrico)
export function heatmap(ctx, w, h, o) {
  const padL = 46, padR = 12, padT = 10, padB = 30;
  const pw = w - padL - padR, ph = h - padT - padB;
  const ny = o.map.length, nx = o.map[0].length;
  const cw = pw / nx, chh = ph / ny;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v = o.map[j][i];
    if (v === null) continue;
    const t = Math.max(0, Math.min(1, (v - o.vMin) / (o.vMax - o.vMin)));
    ctx.fillStyle = `hsl(${240 - 240 * t}, 75%, ${30 + 22 * t}%)`;
    ctx.fillRect(padL + i * cw, padT + ph - (j + 1) * chh, cw + 0.6, chh + 0.6);
  }
  return lineChart(ctx, w, h, { ...o, series: o.series || [], xMin: o.xMin, xMax: o.xMax, yMin: o.yMin, yMax: o.yMax });
}

// Buffer circular para series temporales
export class Trace {
  constructor(n = 300) { this.n = n; this.t = []; this.v = []; }
  push(t, v) { this.t.push(t); this.v.push(v); if (this.t.length > this.n) { this.t.shift(); this.v.shift(); } }
  clear() { this.t.length = 0; this.v.length = 0; }
}
