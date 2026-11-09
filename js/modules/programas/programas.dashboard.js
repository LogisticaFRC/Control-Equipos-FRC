// =====================================================================
// PROGRAMAS · Hoja "Inicio" (dashboard) del Excel exportado
// ---------------------------------------------------------------------
// Funciones puras: reciben los datos ya calculados por programas.service.js
// y arman la hoja con hojaDashboard (KPI + gráficos + tablas resumen).
// =====================================================================
import { hojaDashboard } from '../../core/excel.js';
import { normalizarFecha, formatDateForDisplay, hoyISO, diasEntre } from '../../core/utils.js';

const C = { verde: '#10b981', ambar: '#f59e0b', rojo: '#e11d48', indigo: '#4f46e5', sky: '#0284c7', gris: '#94a3b8', naranjo: '#f97316' };
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const f = (v) => normalizarFecha(v) || '';
const ejesApilados = { x: { stacked: true, ticks: { font: { size: 11 } } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } };
const etiquetaCorta = (s, n = 18) => { s = String(s || '-'); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

/** Agrupa items por una clave → [{ k, items }] ordenado por cantidad. */
const agrupar = (items, clave) => {
  const m = new Map();
  items.forEach(it => { const k = String(clave(it) || '-').trim().toUpperCase() || '-'; if (!m.has(k)) m.set(k, []); m.get(k).push(it); });
  return [...m.entries()].map(([k, v]) => ({ k, items: v })).sort((a, b) => b.items.length - a.items.length || a.k.localeCompare(b.k));
};

/** % del tiempo de vigencia ya transcurrido. */
const avanceTiempo = (prog) => {
  const ini = f(prog.fecha_inicio_programa), fin = f(prog.fecha_termino_programa), hoy = hoyISO();
  if (!ini || !fin) return null;
  const total = diasEntre(fin, ini) + 1;
  if (hoy < ini) return 0;
  if (hoy > fin) return 100;
  return pct(diasEntre(hoy, ini) + 1, total);
};

// ---------------------------------------------------------------------
// REPARACIÓN (dividido en naves)
// ---------------------------------------------------------------------
export const hojaInicioReparacion = async (wb, logo, { prog, nombre, vigencia, items, naves, det, ubicacion, dias, fueraRango }) => {
  const hoy = hoyISO();
  const atrasado = (it) => !it.realizado && f(it.fecha_fin) && f(it.fecha_fin) < hoy;
  const total = items.length;
  const reparados = items.filter(i => i.realizado).length;
  const atrasados = items.filter(atrasado);
  const pendientes = total - reparados;
  const tiempo = avanceTiempo(prog);
  const naveDe = (i) => String(i.nave || 'NAVE 1').toUpperCase();
  const navesUsadas = naves.filter(n => items.some(i => naveDe(i) === n));

  const kpis = [
    { t: 'Equipos en programa', v: total, sub: `${navesUsadas.length} nave(s) con equipos`, color: 'indigo' },
    { t: 'Reparados', v: reparados, sub: 'estado ON', color: 'verde' },
    { t: 'Pendientes', v: pendientes, sub: 'estado OFF', color: 'ambar' },
    { t: 'Atrasados', v: atrasados.length, sub: 'fin programado ya pasó', color: atrasados.length ? 'rojo' : 'gris' },
    { t: '% Avance', v: `${pct(reparados, total)}%`, sub: 'reparados / total', color: 'verde' },
    { t: '% Tiempo transcurrido', v: tiempo === null ? '-' : `${tiempo}%`, sub: 'de la vigencia', color: 'gris' }
  ];
  if (fueraRango.length) kpis.push({ t: 'Fuera de vigencia', v: fueraRango.length, sub: 'fechas fuera del programa', color: 'ambar' });

  // Gráficos
  const graficos = [];
  graficos.push({ titulo: 'Estado general del programa', cfg: {
    type: 'doughnut',
    data: { labels: ['Reparados', 'Pendientes en plazo', 'Atrasados'], datasets: [{ data: [reparados, pendientes - atrasados.length, atrasados.length], backgroundColor: [C.verde, C.ambar, C.rojo] }] },
    options: { plugins: { title: { display: true, text: `${pct(reparados, total)}% reparado` } } }
  } });
  graficos.push({ titulo: 'Avance por nave', cfg: {
    type: 'bar',
    data: { labels: navesUsadas, datasets: [
      { label: 'Reparados', data: navesUsadas.map(n => items.filter(i => naveDe(i) === n && i.realizado).length), backgroundColor: C.verde },
      { label: 'Pendientes', data: navesUsadas.map(n => items.filter(i => naveDe(i) === n && !i.realizado && !atrasado(i)).length), backgroundColor: C.ambar },
      { label: 'Atrasados', data: navesUsadas.map(n => items.filter(i => naveDe(i) === n && atrasado(i)).length), backgroundColor: C.rojo }
    ] },
    options: { scales: ejesApilados }
  } });
  const porTipo = agrupar(items, i => det(i.afi, 'tipo')).slice(0, 10);
  graficos.push({ titulo: 'Equipos por tipo', cfg: {
    type: 'bar',
    data: { labels: porTipo.map(g => etiquetaCorta(g.k)), datasets: [
      { label: 'Reparados', data: porTipo.map(g => g.items.filter(i => i.realizado).length), backgroundColor: C.verde },
      { label: 'Pendientes', data: porTipo.map(g => g.items.filter(i => !i.realizado).length), backgroundColor: C.ambar }
    ] },
    options: { indexAxis: 'y', scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }, y: { stacked: true } } }
  } });
  if (dias.length) {
    const enTaller = dias.map(d => items.filter(i => { const a = f(i.fecha_inicio), b = f(i.fecha_fin) || a; return a && d.fechaStr >= a && d.fechaStr <= b; }).length);
    const terminoAcum = dias.map(d => items.filter(i => f(i.fecha_fin) && f(i.fecha_fin) <= d.fechaStr).length);
    graficos.push({ titulo: 'Carga del taller por día', cfg: {
      type: 'bar',
      data: { labels: dias.map(d => `${String(d.numDia).padStart(2, '0')}`), datasets: [
        { type: 'bar', label: 'Equipos programados en taller', data: enTaller, backgroundColor: C.indigo, yAxisID: 'y' },
        { type: 'line', label: 'Términos programados (acumulado)', data: terminoAcum, borderColor: C.verde, backgroundColor: C.verde, pointRadius: 0, tension: 0.2, yAxisID: 'y1' }
      ] },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 }, position: 'left' }, y1: { beginAtZero: true, ticks: { precision: 0 }, position: 'right', grid: { drawOnChartArea: false } } } }
    } });
  }

  // Tablas
  const filaResumen = (k, its) => {
    const r = its.filter(i => i.realizado).length, a = its.filter(atrasado).length;
    return [k, its.length, r, its.length - r, a, `${pct(r, its.length)}%`];
  };
  const colsResumen = (t) => [{ t }, { t: 'EQUIPOS' }, { t: 'REPARADOS' }, { t: 'PENDIENTES' }, { t: 'ATRASADOS' }, { t: '% AVANCE' }];
  const tablas = [
    { titulo: 'RESUMEN POR NAVE', columnas: colsResumen('NAVE'), filas: navesUsadas.map(n => filaResumen(n, items.filter(i => naveDe(i) === n))), total: filaResumen('TOTAL', items) },
    { titulo: 'RESUMEN POR CONDICIÓN', columnas: colsResumen('CONDICIÓN'), filas: agrupar(items, i => i.condicion || 'Arriendo').map(g => filaResumen(g.k, g.items)) },
    { titulo: 'EQUIPOS ATRASADOS', columnas: [{ t: 'AFI' }, { t: 'TIPO EQUIPO' }, { t: 'NAVE' }, { t: 'UBICACIÓN' }, { t: 'FIN PROGRAMADO' }, { t: 'DÍAS DE ATRASO' }],
      filas: atrasados.sort((a, b) => f(a.fecha_fin).localeCompare(f(b.fecha_fin))).map(i => [`AFI ${i.afi}`, det(i.afi, 'tipo'), naveDe(i), ubicacion(i.afi), formatDateForDisplay(i.fecha_fin), diasEntre(hoy, f(i.fecha_fin))]) }
  ];

  return hojaDashboard(wb, logo, {
    nombre: 'Inicio', titulo: `PROGRAMA DE REPARACIÓN · ${nombre}`,
    subtitulo: `${vigencia} · Dashboard general`, kpis, graficos, tablas
  });
};

// ---------------------------------------------------------------------
// MANTENCIÓN
// ---------------------------------------------------------------------
export const hojaInicioMantencion = async (wb, logo, { prog, nombre, vigencia, items, det, ubicacion, dias, kitsBodega, corte }) => {
  const hoy = hoyISO();
  const progDe = (i) => f(i.fecha_programada || i.fecha_inicio);
  const realDe = (i) => f(i.fecha_fin);
  const total = items.length;
  const hechos = items.filter(i => i.realizado);
  const aTiempo = hechos.filter(i => !realDe(i) || !progDe(i) || realDe(i) <= progDe(i));
  const fueraFecha = hechos.filter(i => !aTiempo.includes(i));
  const pendientes = items.filter(i => !i.realizado);
  const atrasados = pendientes.filter(i => progDe(i) && progDe(i) < hoy);
  const enPlazo = pendientes.length - atrasados.length;
  const sinKit = pendientes.filter(i => !kitsBodega(i.afi));
  const en7 = new Date(); en7.setDate(en7.getDate() + 7);
  const lim7 = `${en7.getFullYear()}-${String(en7.getMonth() + 1).padStart(2, '0')}-${String(en7.getDate()).padStart(2, '0')}`;
  const proximos = pendientes.filter(i => progDe(i) >= hoy && progDe(i) <= lim7);
  const tiempo = avanceTiempo(prog);

  const kpis = [
    { t: 'Equipos programados', v: total, sub: corte ? 'programa CERRADO' : 'programa vigente', color: 'indigo' },
    { t: 'Realizadas', v: hechos.length, sub: `${aTiempo.length} a tiempo · ${fueraFecha.length} fuera de fecha`, color: 'verde' },
    { t: '% Cumplimiento', v: `${pct(hechos.length, total)}%`, sub: 'realizadas / programadas', color: 'verde' },
    { t: 'Pendientes', v: pendientes.length, sub: `${enPlazo} en plazo`, color: 'ambar' },
    { t: 'Atrasadas', v: atrasados.length, sub: 'fecha programada ya pasó', color: atrasados.length ? 'rojo' : 'gris' },
    { t: '% Tiempo transcurrido', v: tiempo === null ? '-' : `${tiempo}%`, sub: 'de la vigencia', color: 'gris' },
    { t: '% A tiempo', v: `${pct(aTiempo.length, hechos.length)}%`, sub: 'de las realizadas', color: 'indigo' },
    { t: 'Próximos 7 días', v: proximos.length, sub: 'mantenciones por hacer', color: 'indigo' },
    { t: 'Pendientes sin kit', v: sinKit.length, sub: 'sin kit en bodega', color: sinKit.length ? 'rojo' : 'gris' }
  ];

  const graficos = [];
  graficos.push({ titulo: 'Estado de las mantenciones', cfg: {
    type: 'doughnut',
    data: { labels: ['Realizada a tiempo', 'Realizada fuera de fecha', 'Pendiente en plazo', 'Atrasada'], datasets: [{ data: [aTiempo.length, fueraFecha.length, enPlazo, atrasados.length], backgroundColor: [C.verde, C.sky, C.ambar, C.rojo] }] },
    options: { plugins: { title: { display: true, text: `${pct(hechos.length, total)}% cumplimiento` } } }
  } });
  if (dias.length) {
    const programadoAcum = dias.map(d => items.filter(i => progDe(i) && progDe(i) <= d.fechaStr).length);
    const realAcum = dias.map(d => (d.fechaStr > hoy ? null : hechos.filter(i => (realDe(i) || progDe(i)) <= d.fechaStr).length));
    graficos.push({ titulo: 'Programado vs realizado (acumulado)', cfg: {
      type: 'line',
      data: { labels: dias.map(d => String(d.numDia).padStart(2, '0')), datasets: [
        { label: 'Programado', data: programadoAcum, borderColor: C.indigo, backgroundColor: C.indigo, pointRadius: 0, tension: 0.2 },
        { label: 'Realizado', data: realAcum, borderColor: C.verde, backgroundColor: C.verde, pointRadius: 0, tension: 0.2, spanGaps: false }
      ] },
      options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    } });
  }
  const porTipo = agrupar(items, i => det(i.afi, 'tipo')).slice(0, 10);
  graficos.push({ titulo: 'Cumplimiento por tipo de equipo', cfg: {
    type: 'bar',
    data: { labels: porTipo.map(g => etiquetaCorta(g.k)), datasets: [
      { label: 'Realizadas', data: porTipo.map(g => g.items.filter(i => i.realizado).length), backgroundColor: C.verde },
      { label: 'Pendientes', data: porTipo.map(g => g.items.filter(i => !i.realizado && !atrasados.includes(i)).length), backgroundColor: C.ambar },
      { label: 'Atrasadas', data: porTipo.map(g => g.items.filter(i => atrasados.includes(i)).length), backgroundColor: C.rojo }
    ] },
    options: { indexAxis: 'y', scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }, y: { stacked: true } } }
  } });
  const porUbic = agrupar(items, i => ubicacion(i.afi)).slice(0, 10);
  graficos.push({ titulo: 'Equipos por ubicación (top 10)', cfg: {
    type: 'bar',
    data: { labels: porUbic.map(g => etiquetaCorta(g.k)), datasets: [
      { label: 'Realizadas', data: porUbic.map(g => g.items.filter(i => i.realizado).length), backgroundColor: C.verde },
      { label: 'Pendientes', data: porUbic.map(g => g.items.filter(i => !i.realizado).length), backgroundColor: C.ambar }
    ] },
    options: { scales: ejesApilados }
  } });

  const filaResumen = (k, its) => {
    const r = its.filter(i => i.realizado).length, a = its.filter(i => atrasados.includes(i)).length;
    return [k, its.length, r, its.length - r, a, `${pct(r, its.length)}%`];
  };
  const tablas = [
    { titulo: 'RESUMEN POR TIPO DE EQUIPO', columnas: [{ t: 'TIPO EQUIPO' }, { t: 'EQUIPOS' }, { t: 'REALIZADAS' }, { t: 'PENDIENTES' }, { t: 'ATRASADAS' }, { t: '% CUMPLIMIENTO' }],
      filas: agrupar(items, i => det(i.afi, 'tipo')).map(g => filaResumen(g.k, g.items)), total: filaResumen('TOTAL', items) },
    { titulo: 'MANTENCIONES ATRASADAS', columnas: [{ t: 'AFI' }, { t: 'TIPO EQUIPO' }, { t: 'UBICACIÓN' }, { t: 'FECHA PROGRAMADA' }, { t: 'DÍAS DE ATRASO' }, { t: 'KITS EN BODEGA' }],
      filas: atrasados.sort((a, b) => progDe(a).localeCompare(progDe(b))).map(i => [`AFI ${i.afi}`, det(i.afi, 'tipo'), ubicacion(i.afi), formatDateForDisplay(progDe(i)), diasEntre(hoy, progDe(i)), kitsBodega(i.afi)]) },
    { titulo: 'PRÓXIMOS 7 DÍAS', columnas: [{ t: 'AFI' }, { t: 'TIPO EQUIPO' }, { t: 'UBICACIÓN' }, { t: 'FECHA PROGRAMADA' }, { t: 'KITS EN BODEGA' }],
      filas: proximos.sort((a, b) => progDe(a).localeCompare(progDe(b))).map(i => [`AFI ${i.afi}`, det(i.afi, 'tipo'), ubicacion(i.afi), formatDateForDisplay(progDe(i)), kitsBodega(i.afi)]) }
  ];

  return hojaDashboard(wb, logo, {
    nombre: 'Inicio', titulo: `PROGRAMA DE MANTENCIÓN · ${nombre}`,
    subtitulo: `${vigencia}${corte ? ' (CERRADO)' : ''} · Dashboard general`, kpis, graficos, tablas
  });
};
