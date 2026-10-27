// Sistemas de motor alternativo: gasolina 4T, diésel 4T y gasolina 2T en banco de pruebas.
import * as THREE from 'three';
import { CombustionEngine, ENGINE_PRESETS, firingOrderText } from '../physics/engine.js';
import { FUELS, P_ATM } from '../physics/cycle.js';
import { buildPistonEngine } from './engineModel.js';
import { lineChart, COLORS, Trace } from '../core/charts.js';
import { disposeTree, fmt } from '../core/kit.js';

const TAU = Math.PI * 2;

// ---------- Utilidades compartidas con el automóvil ----------

export function engineParamDefs(kind, group = '') {
  const g = (s) => (group ? `${group} · ${s}` : s);
  const two = kind === '2t', diesel = kind === 'diesel', wankel = kind === 'wankel';
  const fuels = Object.entries(FUELS).filter(([, f]) => (diesel ? f.encendido === 'compresion' : f.encendido === 'chispa')).map(([k, f]) => ({ value: k, label: f.nombre }));
  const defs = [];
  if (!wankel) {
    defs.push(
      { id: 'cylinders', label: 'Número de cilindros', type: 'select', group: g('Geometría'), rebuild: true, options: (two ? [1, 2, 3] : [1, 2, 3, 4, 5, 6]).map((n) => ({ value: n, label: `${n} (${n > 1 ? 'en línea, orden ' + firingOrderText(n) : 'monocilíndrico'})` })), help: 'Más cilindros reparten las explosiones en el tiempo: el par es más uniforme y el motor más suave.' },
      { id: 'bore', label: 'Diámetro (calibre)', type: 'range', min: 45, max: 110, step: 1, unit: 'mm', group: g('Geometría'), rebuild: true, live: false, help: 'Diámetro del cilindro. Área del pistón A = π·D²/4. Más diámetro = válvulas más grandes y más potencia a alto régimen.' },
      { id: 'stroke', label: 'Carrera', type: 'range', min: 45, max: 110, step: 0.5, unit: 'mm', group: g('Geometría'), rebuild: true, live: false, help: 'Recorrido del pistón entre PMS y PMI (= 2 × radio de manivela). Carrera larga favorece el par; corta, las revoluciones.' },
      { id: 'rod', label: 'Longitud de biela', type: 'range', min: 90, max: 190, step: 1, unit: 'mm', group: g('Geometría'), rebuild: true, live: false, help: 'Relación biela/manivela típica 3 a 4. Bielas cortas aumentan las fuerzas laterales y las vibraciones de 2º orden.' },
    );
  } else {
    defs.push(
      { id: 'rotors', label: 'Número de rotores', type: 'select', group: g('Geometría'), rebuild: true, options: [{ value: 1, label: '1 rotor' }, { value: 2, label: '2 rotores (13B, Renesis)' }, { value: 3, label: '3 rotores (20B)' }] },
      { id: 'faceDisplacement', label: 'Cilindrada por cara', type: 'range', min: 300, max: 800, step: 2, unit: 'cm³', group: g('Geometría'), rebuild: true, live: false, help: 'Volumen barrido por cada una de las 3 caras del rotor: V = 3√3·R·e·b.' },
    );
  }
  defs.push({ id: 'cr', label: 'Relación de compresión', type: 'range', min: diesel ? 12 : 5.5, max: diesel ? 23 : 15, step: 0.1, group: g('Geometría'), live: false, format: (v) => `${fmt(v, 1)} : 1`, help: 'ε = (Vd + Vc)/Vc. Más compresión mejora el rendimiento (η Otto = 1 − 1/ε^(γ−1)) pero en gasolina aumenta el riesgo de detonación.' });
  if (!two && !wankel) defs.push({ id: 'camDuration', label: 'Duración de levas', type: 'range', min: 220, max: 300, step: 2, unit: '°', group: g('Distribución y admisión'), live: false, help: 'Grados de cigüeñal que la válvula permanece abierta. Levas "largas" llenan mejor a alto régimen pero el motor pierde par abajo y el ralentí se vuelve irregular.' });
  if (two) {
    defs.push(
      { id: 'tunedRpm', label: 'Régimen de resonancia del escape', type: 'range', min: 5000, max: 12000, step: 100, unit: 'rpm', group: g('Distribución y admisión'), live: false, help: 'El escape de expansión devuelve la mezcla al cilindro solo cerca de este régimen.' },
      { id: 'portOpen', label: 'Apertura de lumbrera de escape (antes del PMI)', type: 'range', min: 70, max: 100, step: 1, unit: '°', group: g('Distribución y admisión'), rebuild: true, live: false },
    );
  }
  if (!two) {
    defs.push(
      { id: 'turbo', label: 'Turbocompresor', type: 'toggle', group: g('Distribución y admisión'), rebuild: true, help: 'Usa la energía de los gases de escape para comprimir el aire de admisión.' },
      { id: 'boostTarget', label: 'Presión de turbo objetivo', type: 'range', min: 0.2, max: 2.2, step: 0.05, unit: 'bar', group: g('Distribución y admisión'), live: false, visible: (v) => v.turbo },
      { id: 'intercooler', label: 'Intercooler', type: 'toggle', group: g('Distribución y admisión'), rebuild: true, visible: (v) => v.turbo },
    );
  }
  defs.push(
    { id: 'fuel', label: 'Combustible', type: 'select', group: g('Combustible y ECU'), options: fuels, help: 'Cambia el poder calorífico, la relación estequiométrica y el octanaje (resistencia a la detonación) o el cetano.' },
    { id: 'ecu', label: 'Gestión electrónica (ECU) automática', type: 'toggle', group: g('Combustible y ECU'), uiRefresh: true, help: 'La ECU busca el avance de máximo par (MBT) sin detonar, ajusta la mezcla y controla el ralentí. Desactívala para controlar tú el encendido y la mezcla.' },
  );
  if (diesel) {
    defs.push({ id: 'timing', label: 'Avance de inyección', type: 'range', min: -6, max: 30, step: 0.5, unit: '° APMS', group: g('Combustible y ECU'), visible: (v) => !v.ecu });
  } else {
    defs.push(
      { id: 'lambda', label: 'Mezcla λ (dosado relativo)', type: 'range', min: 0.5, max: 1.8, step: 0.01, group: g('Combustible y ECU'), visible: (v) => !v.ecu, format: (v) => `λ ${fmt(v, 2)}`, help: 'λ = aire real / aire estequiométrico. λ<1 rica (más potencia, más CO), λ>1 pobre (más eficiente hasta que la llama se vuelve lenta y falla).' },
      { id: 'timing', label: 'Avance del encendido', type: 'range', min: -10, max: 50, step: 0.5, unit: '° APMS', group: g('Combustible y ECU'), visible: (v) => !v.ecu, help: 'La chispa salta antes del PMS porque la combustión tarda. Poco avance: pierde par y calienta el escape. Mucho: detonación.' },
    );
  }
  defs.push(
    { id: 'flywheel', label: 'Inercia del volante', type: 'range', min: 0.005, max: 0.6, step: 0.005, unit: 'kg·m²', group: g('Mecánica'), live: false, help: 'Más inercia: giro más regular pero el motor sube y baja de vueltas más despacio.' },
    { id: 'redline', label: 'Corte de inyección (limitador)', type: 'range', min: 3000, max: 13000, step: 100, unit: 'rpm', group: g('Mecánica'), live: false },
    { id: 'idleRpm', label: 'Ralentí objetivo', type: 'range', min: 500, max: 2000, step: 10, unit: 'rpm', group: g('Mecánica'), live: false },
  );
  return defs;
}

export function engineTelemetry(eng) {
  const t = eng.telemetry();
  const c = eng.cycle;
  const diesel = eng.isDiesel;
  const kw = t.power / 1000;
  const status = eng.seized ? 'GRIPADO: pulsa Reparar' : !eng.ignition ? (eng.rpm > 30 ? 'Apagándose' : 'Apagado') : eng.starter > 0 ? 'Arrancando (motor de arranque)' : eng.fuelCut ? 'Limitador: corte de inyección' : 'En marcha';
  const groups = [
    {
      title: 'Funcionamiento', items: [
        { label: 'Estado', value: status, warn: eng.seized || eng.fuelCut },
        { label: 'Régimen', value: t.rpm, unit: 'rpm' },
        { label: 'Par al freno (medio)', value: t.torque, unit: 'N·m', d: 1, help: 'Par útil en el volante: par indicado menos fricción y accesorios.' },
        { label: 'Potencia efectiva', value: kw, unit: `kW (${fmt(kw * 1.3596, 0)} CV)`, d: 1 },
        { label: 'Velocidad media del pistón', value: t.Sp, unit: 'm/s', d: 1, warn: t.Sp > 22, help: 'Sp = 2·carrera·n. Por encima de ~22 m/s aumentan mucho el desgaste y las fuerzas de inercia.' },
      ],
    },
    {
      title: 'Admisión y mezcla', items: [
        { label: diesel ? 'Presión de admisión' : 'Presión en el colector', value: t.pMan / 1000, unit: 'kPa abs', d: 0, help: 'Con la mariposa cerrada hay vacío (≈30 kPa). A plena carga ≈100 kPa. Con turbo, por encima de la atmosférica.' },
        { label: 'Sobrepresión del turbo', value: t.boost / 1e5, unit: 'bar', d: 2 },
        { label: 'Rendimiento volumétrico', value: t.ve * 100, unit: '%', d: 0 },
        { label: diesel ? 'Exceso de aire λ' : 'Mezcla λ', value: c.lambda > 50 ? '·' : fmt(c.lambda, 2), warn: !diesel && (c.lambda < 0.75 || c.lambda > 1.4) },
        { label: diesel ? 'Avance de inyección' : 'Avance de encendido', value: `${fmt(eng.currentTiming, 1)}° APMS${eng.mbtInfo ? (eng.mbtInfo.knockLimited ? ' (limitado por detonación)' : ' (MBT)') : ''}` },
        ...(diesel ? [{ label: 'Retardo de autoencendido', value: c.ignitionDelayDeg ? `${fmt(c.ignitionDelayDeg, 1)}° (${fmt(c.ignitionDelayDeg / (6 * Math.max(t.rpm, 1)) * 1000, 2)} ms)` : '·' }] : []),
      ],
    },
    {
      title: 'Ciclo termodinámico (cilindro 1)', items: [
        { label: 'PMI (pres. media indicada)', value: t.imep / 1e5, unit: 'bar', d: 2 },
        { label: 'PME (pres. media efectiva)', value: t.bmep / 1e5, unit: 'bar', d: 2 },
        { label: 'Pérdidas por fricción (FMEP)', value: t.fmep / 1e5, unit: 'bar', d: 2 },
        { label: 'Pérdidas de bombeo (PMEP)', value: t.pmep / 1e5, unit: 'bar', d: 2, help: 'Trabajo gastado en aspirar y expulsar gases. Grande a carga parcial en gasolina por el vacío del colector.' },
        { label: 'Presión máxima', value: `${fmt(t.Pmax / 1e5, 1)} bar a ${fmt(c.thPmax, 0)}° DPMS`, warn: t.Pmax > 1.6e7 && !diesel },
        { label: 'Temperatura máxima del gas', value: t.Tmax - 273.15, unit: '°C', d: 0 },
        { label: 'Temperatura de escape', value: t.egt - 273.15, unit: '°C', d: 0, warn: t.egt > 1250 },
      ],
    },
    {
      title: 'Rendimiento y consumo', items: [
        { label: 'Rendimiento indicado', value: t.etaInd * 100, unit: '%', d: 1 },
        { label: 'Rendimiento efectivo', value: t.etaBrake * 100, unit: '%', d: 1, help: 'Fracción de la energía del combustible que sale como trabajo útil.' },
        { label: 'Consumo específico', value: t.bsfc ?? '·', unit: t.bsfc ? 'g/kWh' : '', d: 0 },
        { label: 'Consumo horario', value: t.fuelLh, unit: 'L/h', d: 2 },
      ],
    },
    {
      title: 'Combustión y emisiones (estimadas)', items: [
        { label: 'Detonación (picado)', value: c.knock ? `SÍ: ${fmt(c.knockFraction * 100, 0)} % de mezcla autoinflamada` : diesel ? 'No aplica' : `No (integral ${fmt(c.knockIntegral, 2)} de 1)`, warn: c.knock },
        { label: 'Fallo de combustión', value: c.misfire ? c.misfireReason : 'No', warn: c.misfire },
        { label: 'NOx', value: t.nox, unit: 'ppm', d: 0 },
        { label: 'CO', value: t.co, unit: '%', d: 2 },
        { label: 'HC sin quemar', value: t.hc, unit: 'ppm', d: 0 },
        ...(diesel ? [{ label: 'Índice de humos (hollín)', value: t.soot, d: 2, warn: t.soot > 0.6 }] : []),
        { label: 'Salud del motor', value: t.health * 100, unit: '%', d: 0, warn: t.health < 0.7 },
      ],
    },
  ];
  return groups;
}

export function pvChart(eng, unitLabel = 'cilindro 1') {
  return {
    title: `Diagrama p-V del ${unitLabel}`, note: 'escala logarítmica: el área encerrada es el trabajo', height: 210,
    draw(ctx, w, h) {
      const c = eng.cycle;
      const V = Array.from(c.V, (v) => v * 1e6), P = Array.from(c.P, (p) => Math.max(p, 2e4) / 1e5);
      const deg = eng.unitCycleDeg(0);
      const idx = Math.round(deg + eng.half) % c.N;
      lineChart(ctx, w, h, {
        series: [{ xs: V, ys: P, color: COLORS.b, width: 1.8 }],
        xLabel: 'Volumen (cm³)', yLabel: 'Presión (bar)', xLog: true, yLog: true,
        xMin: Math.max(1, c.Vc * 1e6 * 0.9), xMax: (c.Vc + c.Vd) * 1e6 * 1.08, yMin: 0.2, yMax: Math.max(10, c.Pmax / 1e5 * 1.3),
        markers: [{ x: V[idx], y: P[idx], color: '#fff' }],
      });
    },
  };
}

export function pressureAngleChart(eng) {
  return {
    title: 'Presión y fracción quemada frente al ángulo', height: 200,
    draw(ctx, w, h) {
      const c = eng.cycle;
      const xs = Array.from({ length: c.N }, (_, i) => i - c.half);
      const lo = c.twoStroke ? -180 : -200, hi = c.twoStroke ? 180 : 200;
      const P = Array.from(c.P, (p) => p / 1e5);
      const XB = Array.from(c.XB, (x, i) => (xs[i] < c.ivcDeg || xs[i] > c.evoDeg ? NaN : x));
      const deg = eng.unitCycleDeg(0);
      const marks = [];
      const vl = [];
      if (c.burnStart !== null && c.Qtotal > 0) vl.push({ x: eng.isDiesel ? c.injDeg : -eng.currentTiming, color: '#9fd8ff', label: eng.isDiesel ? 'inyección' : 'chispa' });
      if (c.knock) vl.push({ x: c.knockDeg, color: '#ff6b8b', label: 'detonación' });
      lineChart(ctx, w, h, {
        series: [{ xs, ys: P, color: COLORS.b, label: 'presión' }, { xs, ys: XB, color: COLORS.c, axis: 'right', label: 'fracción quemada', dash: [5, 3] }],
        xLabel: 'Ángulo de cigüeñal (° respecto al PMS de combustión)', yLabel: 'bar', y2Label: 'fracción quemada', y2Min: 0, y2Max: 1.05,
        xMin: lo, xMax: hi, yMin: 0, vlines: vl,
        markers: deg > lo && deg < hi ? [{ x: deg, y: eng.sampleTable(c.P, deg) / 1e5, color: '#fff' }] : marks,
      });
    },
  };
}

export function torqueAngleChart(eng) {
  return {
    title: 'Par instantáneo en el cigüeñal (todos los cilindros)', note: 'gas + inercia; la línea discontinua es el par medio', height: 190,
    draw(ctx, w, h) {
      const span = eng.p.kind === 'wankel' ? 360 : eng.cycleSpan * (eng.p.kind === '2t' ? 1 : 1);
      const xs = [], ys = [];
      for (let d = 0; d < span; d += 2) {
        const th = d * Math.PI / 180;
        xs.push(d); ys.push(eng.gasTorqueAt(th) + eng.inertiaTorqueAt(th, eng.omega));
      }
      const mean = eng.indicatedTorque;
      const cur = ((eng.theta * 180 / Math.PI) % span + span) % span;
      lineChart(ctx, w, h, {
        series: [{ xs, ys, color: COLORS.a, width: 1.4 }, { xs: [0, span], ys: [mean, mean], color: COLORS.f, dash: [5, 4] }],
        xLabel: 'Ángulo del eje (°)', yLabel: 'N·m', xMin: 0, xMax: span,
        markers: [{ x: cur, y: eng.gasTorqueAt(eng.theta) + eng.inertiaTorqueAt(eng.theta, eng.omega), color: '#fff' }],
      });
    },
  };
}

export function wotChart(eng) {
  return {
    title: 'Curvas a plena carga (banco de potencia virtual)', note: 'se recalculan al cambiar parámetros', height: 210,
    draw(ctx, w, h) {
      const cv = eng.wotCurve(6);
      if (!cv.done) { ctx.fillStyle = '#aab6c8'; ctx.font = '12px Inter, system-ui, sans-serif'; ctx.fillText(`Midiendo en el banco… ${cv.rpms.length} puntos`, 20, 30); return; }
      const t = eng.telemetry();
      lineChart(ctx, w, h, {
        series: [{ xs: cv.rpms, ys: cv.torque, color: COLORS.a, label: 'par (N·m)' }, { xs: cv.rpms, ys: cv.power, color: COLORS.d, axis: 'right', label: 'potencia (kW)' }],
        xLabel: 'rpm', yLabel: 'Par (N·m)', y2Label: 'Potencia (kW)', yMin: 0, y2Min: 0,
        xMin: cv.rpms[0], xMax: eng.p.redline,
        markers: [{ x: t.rpm, y: t.torque, color: '#fff', label: 'ahora' }],
      });
    },
  };
}

export function traceChart(traces, title, yLabel) {
  return {
    title, height: 160,
    draw(ctx, w, h) {
      const s = traces.filter((t) => t.trace.t.length > 1);
      if (!s.length) return;
      const tEnd = s[0].trace.t[s[0].trace.t.length - 1];
      lineChart(ctx, w, h, {
        series: s.map((t) => ({ xs: t.trace.t.map((x) => x - tEnd), ys: t.trace.v, color: t.color, label: t.label, axis: t.axis })),
        xLabel: 'tiempo simulado (s)', yLabel, y2Label: s.find((t) => t.axis === 'right')?.label, xMax: 0, yMin: 0, y2Min: 0,
      });
    },
  };
}

// Fase actual del cilindro 1 para el panel superpuesto
export function enginePhase(eng) {
  const c = eng.unitCycleDeg(0);
  const cyc = eng.cycle;
  const p = eng.p;
  const diesel = eng.isDiesel;
  if (p.kind === '2t') {
    const segs = [
      { from: -180, to: -180 + p.portClose, color: '#4fb3ff', label: 'Barrido' },
      { from: -180 + p.portClose, to: -eng.currentTiming, color: '#9a6bff', label: 'Compresión' },
      { from: -eng.currentTiming, to: 180 - p.portOpen, color: '#ff9a3c', label: 'Explosión' },
      { from: 180 - p.portOpen, to: 180, color: '#8a7f74', label: 'Escape' },
    ];
    let title, text;
    if (c < -180 + p.portClose) { title = 'Barrido y carga'; text = 'El pistón sube pero las lumbreras siguen abiertas: la mezcla fresca del cárter termina de expulsar los gases quemados.'; }
    else if (c < -eng.currentTiming) { title = 'Compresión (y admisión al cárter)'; text = 'Con las lumbreras tapadas, el pistón comprime la mezcla arriba mientras por debajo aspira mezcla nueva hacia el cárter.'; }
    else if (c < 180 - p.portOpen) { title = 'Combustión y expansión'; text = 'La chispa enciende la mezcla. Los gases empujan el pistón hacia abajo y a la vez comprimen la mezcla del cárter.'; }
    else { title = 'Escape y transferencia'; text = 'El pistón descubre primero la lumbrera de escape (salen los gases) y luego las de transferencia (entra mezcla fresca). Un ciclo por vuelta.'; }
    return { title: `Cilindro 1 · ${title}`, text, wheel: { segs, angle: c, from: -180, span: 360 } };
  }
  const burn = diesel ? (cyc.injDeg ?? -10) : -eng.currentTiming;
  const segs = [
    { from: -360, to: -180, color: '#4fb3ff', label: 'Admisión' },
    { from: -180, to: burn, color: '#9a6bff', label: 'Compresión' },
    { from: burn, to: 180, color: '#ff9a3c', label: 'Explosión' },
    { from: 180, to: 360, color: '#8a7f74', label: 'Escape' },
  ];
  let title, text;
  if (c < -180) { title = '1º tiempo · Admisión'; text = diesel ? 'El pistón baja con la válvula de admisión abierta y aspira solo aire (sin combustible ni mariposa).' : 'El pistón baja con la válvula de admisión abierta y aspira mezcla de aire y gasolina. La mariposa decide cuánta.'; }
  else if (c < burn) { title = '2º tiempo · Compresión'; text = diesel ? `Válvulas cerradas. El aire se comprime ${fmt(p.cr, 1)} veces y se calienta por encima de 600 °C.` : `Válvulas cerradas. La mezcla se comprime ${fmt(p.cr, 1)} veces: sube la presión y la temperatura.`; }
  else if (c < 40) { title = '3º tiempo · Combustión'; text = diesel ? 'Se inyecta gasóleo, que se autoinflama tras un breve retardo. La presión sube bruscamente.' : 'Salta la chispa antes del PMS; el frente de llama recorre la cámara en pocos milisegundos y la presión se dispara.'; }
  else if (c < 180) { title = '3º tiempo · Expansión (trabajo)'; text = 'Los gases calientes empujan el pistón hacia abajo: es el único tiempo que produce trabajo. La biela hace girar el cigüeñal.'; }
  else { title = '4º tiempo · Escape'; text = 'La válvula de escape se abre antes del PMI y el pistón, al subir, expulsa los gases quemados.'; }
  return { title: `Cilindro 1 · ${title}`, text, wheel: { segs, angle: c, from: -360, span: 720 } };
}

// ---------- Contenido didáctico ----------

const LEARN = {
  otto: `
<h3>¿Qué es?</h3>
<p>El motor de gasolina de cuatro tiempos (ciclo Otto) transforma la energía química del combustible en trabajo mecánico. Cada cilindro repite cuatro carreras del pistón (dos vueltas de cigüeñal): <b>admisión, compresión, explosión-expansión y escape</b>.</p>
<h3>Cómo lo simula este programa</h3>
<ul>
<li><b>Termodinámica real ángulo a ángulo.</b> Se integra la primera ley: dp/dθ = [(γ−1)(dQ<sub>comb</sub> − dQ<sub>pared</sub>) − γ·p·dV] / V.</li>
<li><b>Combustión</b> con la ley de Wiebe: x<sub>b</sub> = 1 − e<sup>−5((θ−θ₀)/Δθ)³</sup>. La duración depende de las rpm, de λ (velocidad de llama) y de los gases residuales.</li>
<li><b>Pérdidas de calor</b> por la pared con la correlación de Woschni.</li>
<li><b>Detonación</b>: se integra el tiempo de autoencendido del gas sin quemar (Livengood-Wu con Douaud-Eyzat). Si la integral llega a 1 antes de que la llama lo queme todo, el resto explota de golpe: aparecen las oscilaciones de presión del "picado".</li>
<li><b>Colector y mariposa</b> con flujo compresible, rendimiento volumétrico según las levas, turbo con retraso, fricción de Chen-Flynn y dinámica del cigüeñal con la inercia del volante.</li>
</ul>
<h3>Fórmulas clave</h3>
<ul>
<li>Cilindrada: V<sub>d</sub> = π·D²/4 · S · z</li>
<li>Par medio: M = PME · V<sub>d</sub> / (4π)</li>
<li>Potencia: P = M · ω = M · 2π·n/60</li>
<li>Rendimiento ideal Otto: η = 1 − 1/ε<sup>γ−1</sup></li>
</ul>
<h3>Partes</h3>
<p>Pasa el ratón sobre cualquier pieza del modelo 3D para ver su nombre y su función.</p>`,
  diesel: `
<h3>¿Qué es?</h3>
<p>El motor diésel también es de cuatro tiempos, pero <b>no tiene bujía ni mariposa</b>. Aspira solo aire, lo comprime mucho (ε = 15 a 22) hasta superar los 600 °C y entonces se inyecta el gasóleo, que <b>se autoinflama</b>. La potencia se regula con la cantidad de combustible inyectado.</p>
<h3>Diferencias que verás en el simulador</h3>
<ul>
<li><b>Retardo de autoencendido</b> calculado con Hardenburg-Hase: depende de la temperatura y presión del aire y del número de cetano.</li>
<li><b>Combustión en dos fases</b>: premezclada (rápida, la del "clac-clac" típico) y por difusión (controlada por la inyección).</li>
<li><b>Sin pérdidas de bombeo</b> a carga parcial: por eso consume menos que un gasolina en ciudad.</li>
<li><b>Límite de humos</b>: con poco aire (turbo aún sin soplar) la ECU limita el gasóleo para no echar humo negro.</li>
</ul>
<h3>Fórmulas</h3>
<ul><li>Retardo: τ = (0,36 + 0,22·S<sub>p</sub>)·exp[E<sub>A</sub>(1/RT − 1/17190) + (21,2/(p−12,4))<sup>0,63</sup>] grados</li>
<li>E<sub>A</sub> = 618 840/(NC + 25)</li></ul>`,
  '2t': `
<h3>¿Qué es?</h3>
<p>El motor de dos tiempos completa el ciclo en <b>una sola vuelta</b>: hay una explosión por vuelta y por cilindro. No tiene válvulas: el propio pistón abre y cierra unas ventanas (<b>lumbreras</b>) en la pared del cilindro. El cárter, cerrado, actúa como bomba que precomprime la mezcla.</p>
<h3>Ventajas e inconvenientes</h3>
<ul>
<li>Muy ligero, sencillo y con mucha potencia por cilindrada (motos, motosierras, karts).</li>
<li>Parte de la mezcla fresca se escapa sin quemar durante el barrido: más consumo y emisiones de HC.</li>
<li>El aceite va mezclado con la gasolina para lubricar el cárter: humo azul.</li>
<li>El <b>escape de expansión</b> crea ondas de presión que mejoran el llenado solo en una banda estrecha de rpm: el famoso "pico" de potencia.</li>
</ul>`,
};

const EXPERIMENTS = {
  otto: [
    { title: 'Provocar detonación', text: 'Compresión 13:1, gasolina 87, ECU apagada y avance de 34°, a plena carga. Mira la gráfica de presión: oscila. La salud del motor baja.', set: { cr: 13, fuel: 'gasolina87', ecu: false, timing: 34, lambda: 1.0, throttle: 1, loadMode: 'rpm', loadValue: 2500 } },
    { title: 'Buscar el avance óptimo', text: 'ECU apagada a 3000 rpm constantes y plena carga. Mueve el avance de 0° a 40° y observa el par: sube hasta el MBT y luego baja.', set: { ecu: false, timing: 5, lambda: 1.0, throttle: 1, loadMode: 'rpm', loadValue: 3000, cr: 10.5, fuel: 'gasolina95' } },
    { title: 'Mezcla rica frente a pobre', text: 'Barre λ de 0,7 a 1,5 con ECU apagada. Potencia máxima hacia λ 0,9; mínimo consumo hacia λ 1,1; a partir de 1,6 la llama no se propaga.', set: { ecu: false, timing: 25, lambda: 0.8, throttle: 1, loadMode: 'rpm', loadValue: 3000 } },
    { title: 'Pérdidas de bombeo', text: 'Acelerador al 15 % a 2000 rpm: el colector está en vacío y el lazo inferior del diagrama p-V es grande. Sube el acelerador y desaparece.', set: { ecu: true, throttle: 0.15, loadMode: 'rpm', loadValue: 2000 } },
    { title: 'Monocilíndrico frente a seis cilindros', text: 'Compara la gráfica de par instantáneo con 1 y con 6 cilindros. Con 1 hay grandes pulsos y tramos negativos (compresión).', set: { cylinders: 1, throttle: 0.3, loadMode: 'libre' } },
    { title: 'Turbo y retraso', text: 'Activa el turbo con 1,2 bar y da gas a fondo desde ralentí sin carga: la presión de turbo tarda en subir (turbo lag).', set: { turbo: true, boostTarget: 1.2, throttle: 0, loadMode: 'libre' } },
  ],
  diesel: [
    { title: 'Sin autoencendido', text: 'Baja la compresión a 12:1: el aire no se calienta lo suficiente y el gasóleo no arde (no arranca).', set: { cr: 12, ecu: true } },
    { title: 'Retardo y cetano', text: 'Cambia a biodiésel (más cetano) y observa el retardo de autoencendido y la presión máxima en la gráfica.', set: { fuel: 'biodiesel', throttle: 0.6, loadMode: 'rpm', loadValue: 2000 } },
    { title: 'Límite de humos y turbo', text: 'Da gas a fondo desde ralentí: al principio el índice de humos sube porque falta aire hasta que el turbo sopla.', set: { throttle: 0, loadMode: 'libre', turbo: true } },
    { title: 'Avance de inyección', text: 'ECU apagada, 2000 rpm: avance mucha inyección (25°) y mira la presión máxima y los NOx; retrásala (0°) y sube la temperatura de escape.', set: { ecu: false, timing: 25, throttle: 0.7, loadMode: 'rpm', loadValue: 2000 } },
  ],
  '2t': [
    { title: 'Buscar el pico de potencia', text: 'Mantén el acelerador al máximo y sube las rpm con el freno dinamométrico: la potencia se dispara cerca del régimen de resonancia.', set: { throttle: 1, loadMode: 'rpm', loadValue: 6000 } },
    { title: 'Cambiar el escape', text: 'Mueve el régimen de resonancia a 6000 rpm: la curva se desplaza. Así se adapta un 2T a motocross (abajo) o a velocidad (arriba).', set: { tunedRpm: 6000 } },
  ],
};

// ---------- Fábrica de sistemas ----------

function makeSystem(kind, meta) {
  return {
    ...meta,
    params(values) {
      return [
        { id: 'throttle', label: kind === 'diesel' ? 'Acelerador (cantidad de gasóleo)' : 'Acelerador (mariposa)', type: 'range', min: 0, max: 1, step: 0.01, scale: 100, unit: '%', group: 'Mando', help: 'Teclas W / S o flechas arriba / abajo.' },
        { id: 'loadMode', label: 'Freno dinamométrico', type: 'select', group: 'Mando', uiRefresh: true, options: [{ value: 'libre', label: 'Sin carga (motor en vacío)' }, { value: 'par', label: 'Par resistente fijo' }, { value: 'rpm', label: 'Mantener rpm constantes' }], help: 'El banco de pruebas frena el motor. En "mantener rpm" mide el par que da a ese régimen.' },
        { id: 'loadValue', label: values.loadMode === 'rpm' ? 'Régimen objetivo' : 'Par de frenado', type: 'range', min: values.loadMode === 'rpm' ? 800 : 0, max: values.loadMode === 'rpm' ? (values.redline || 7000) : 500, step: values.loadMode === 'rpm' ? 50 : 1, unit: values.loadMode === 'rpm' ? 'rpm' : 'N·m', group: 'Mando', visible: (v) => v.loadMode !== 'libre' },
        ...engineParamDefs(kind),
      ];
    },
    create(app) {
      const values = { ...ENGINE_PRESETS[kind], throttle: 0, loadMode: 'libre', loadValue: kind === '2t' ? 6000 : 2500 };
      const eng = new CombustionEngine({ ...ENGINE_PRESETS[kind] });
      const root = new THREE.Group();
      let model = buildPistonEngine(eng);
      root.add(model.group);
      const trRpm = new Trace(400), trTq = new Trace(400);
      let dynoI = 0, traceT = 0;
      eng.startCrank();
      const inst = {
        values, root, eng,
        get view() { return { center: model.center.clone(), size: model.size.clone() }; },
        setParam(id, v) {
          values[id] = v;
          if (id === 'throttle' || id === 'loadMode' || id === 'loadValue') return;
          eng.setParam(id, v);
          if (id === 'ecu' && !v) { eng.p.timing = eng.currentTiming ?? eng.p.timing; values.timing = Math.round(eng.p.timing * 2) / 2; if (!eng.isDiesel) { eng.p.lambda = eng.currentMix; values.lambda = Math.round(eng.currentMix * 100) / 100; } }
          const def = this.def.params(values).find((d) => d.id === id);
          if (def && def.rebuild) {
            root.remove(model.group); disposeTree(model.group);
            model = buildPistonEngine(eng); root.add(model.group);
          }
        },
        update(dt) {
          eng.prepare(dt, values.throttle);
          let loadFn = null;
          if (values.loadMode === 'par') loadFn = (w) => values.loadValue * Math.tanh(w / 5);
          else if (values.loadMode === 'rpm') {
            const wt = values.loadValue * TAU / 60;
            const err = eng.omega - wt;
            dynoI = Math.max(0, Math.min(800, dynoI + err * dt * 60));
            const T = Math.max(0, err * 8 + dynoI);
            loadFn = () => T;
          } else dynoI = 0;
          eng.advance(dt, loadFn);
          model.update(eng, dt);
          traceT += dt;
          trRpm.push(traceT, eng.rpm); trTq.push(traceT, Math.max(0, eng.brakeTorque));
        },
        telemetry() {
          const g = engineTelemetry(eng);
          if (values.loadMode !== 'libre') g[0].items.splice(2, 0, { label: 'Par absorbido por el freno', value: eng.loadTorque, unit: 'N·m', d: 1 });
          return g;
        },
        charts() {
          return [pvChart(eng), pressureAngleChart(eng), torqueAngleChart(eng), wotChart(eng), traceChart([{ trace: trRpm, color: COLORS.a, label: 'rpm' }, { trace: trTq, color: COLORS.b, label: 'par (N·m)', axis: 'right' }], 'Historial: régimen y par', 'rpm')];
        },
        phase() { return enginePhase(eng); },
        hud() {
          return [{ label: 'rpm', value: eng.rpm, max: Math.ceil((eng.p.redline + 1000) / 1000) * 1000, red: eng.p.redline, scale: 1000, unit: '×1000 rpm' },
            { label: 'Par', value: Math.max(0, eng.brakeTorque), max: Math.max(50, Math.ceil(eng.wotCurve().torque.reduce((m, x) => Math.max(m, x), 10) * 1.2 / 50) * 50), unit: 'N·m' }];
        },
        actions() {
          return [
            { id: 'start', label: eng.ignition ? 'Apagar motor' : 'Arrancar motor', primary: !eng.ignition, onClick: () => (eng.ignition ? eng.stop() : eng.startCrank()) },
            ...(eng.health < 0.97 ? [{ id: 'repair', label: 'Reparar motor', onClick: () => eng.repair() }] : []),
          ];
        },
        experiments: EXPERIMENTS[kind],
        learn: LEARN[kind],
        dispose() { disposeTree(root); },
      };
      return inst;
    },
  };
}

export const OTTO = makeSystem('otto', { id: 'otto', name: 'Motor de gasolina 4 tiempos', short: 'Gasolina 4T', category: 'Combustión interna', desc: 'Ciclo Otto con encendido por chispa, ECU, turbo opcional y detonación.' });
export const DIESEL = makeSystem('diesel', { id: 'diesel', name: 'Motor diésel turbo', short: 'Diésel 4T', category: 'Combustión interna', desc: 'Encendido por compresión con inyección directa y turbocompresor.' });
export const TWO_STROKE = makeSystem('2t', { id: '2t', name: 'Motor de 2 tiempos', short: '2 tiempos', category: 'Combustión interna', desc: 'Lumbreras, barrido por cárter y escape de expansión resonante.' });
