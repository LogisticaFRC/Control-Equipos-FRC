// =====================================================================
// MINUTAS · Gráficos (pantalla y Excel) + exportación con formato
// ---------------------------------------------------------------------
// Usa ExcelJS (se carga solo al exportar) porque permite logo, colores,
// bordes y gráficos como imagen. Formato:
//   · Minuta individual → hoja "Minuta" (logo, resumen con %, tabla) + hoja "Dashboard"
//   · Exportar todo     → "Resumen General" + "Dashboard" + "Histórico" + una hoja por minuta
// =====================================================================
import { config, LOGO_DEFAULT } from '../../core/store.js';
import { hoyISO, formatDateForDisplay } from '../../core/utils.js';
import {
  ESTADOS_MINUTA, ESTADO_ESTILO, dbMinutas, minutaSel, itemsDeMinuta, resumenItems, esVencida
} from './minutas.service.js';

const EXCELJS_URL = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
const EMPRESA = 'FAST RENTAL CHILE';

// ---------------------------------------------------------------------
// Gráficos (mismas configuraciones para la pantalla y para el Excel)
// ---------------------------------------------------------------------
export const resumenPorPersonalDe = (items) => {
  const map = {};
  items.forEach(it => { const p = String(it.personal || '').trim().toUpperCase() || 'SIN ASIGNAR'; (map[p] = map[p] || []).push(it); });
  return Object.entries(map).map(([personal, list]) => ({ personal, ...resumenItems(list) })).sort((a, b) => b.total - a.total);
};
export const evolucionDe = (minutas) => minutas.map(m => ({ minuta: m, ...resumenItems(itemsDeMinuta(m.id)) }));

export const cfgEstados = (r) => ({
  type: 'doughnut',
  data: { labels: ESTADOS_MINUTA.map(e => `${e} (${r[e]})`), datasets: [{ data: ESTADOS_MINUTA.map(e => r[e]), backgroundColor: ESTADOS_MINUTA.map(e => ESTADO_ESTILO[e].color), borderWidth: 2, borderColor: '#fff' }] },
  options: { plugins: { legend: { position: 'right' }, title: { display: true, text: `Cumplimiento ${r.cumplimiento}%` } } }
});
export const cfgPersonal = (porPersonal) => ({
  type: 'bar',
  data: {
    labels: porPersonal.map(p => p.personal),
    datasets: ESTADOS_MINUTA.map(e => ({ label: e, data: porPersonal.map(p => p[e]), backgroundColor: ESTADO_ESTILO[e].color }))
  },
  options: { indexAxis: 'y', scales: { x: { stacked: true, ticks: { precision: 0 } }, y: { stacked: true } }, plugins: { legend: { position: 'bottom' } } }
});
export const cfgEvolucion = (evo) => ({
  type: 'bar',
  data: {
    labels: evo.map(e => formatDateForDisplay(e.minuta.fecha)),
    datasets: [
      { type: 'line', label: '% Cumplimiento', data: evo.map(e => e.cumplimiento), borderColor: '#10b981', backgroundColor: '#10b981', yAxisID: 'pct', tension: 0.25, pointRadius: 4 },
      { label: 'Abiertas (Pendiente + Proceso)', data: evo.map(e => e.Pendiente + e.Proceso), backgroundColor: '#f59e0b', yAxisID: 'n' },
      { label: 'Vencidas', data: evo.map(e => e.vencidas), backgroundColor: '#e11d48', yAxisID: 'n' }
    ]
  },
  options: {
    scales: { pct: { position: 'right', min: 0, max: 100, ticks: { callback: v => v + '%' } }, n: { position: 'left', beginAtZero: true, ticks: { precision: 0 } } },
    plugins: { legend: { position: 'bottom' } }
  }
});

export const cfgRealizadasMes = (datos) => ({
  type: 'bar',
  data: { labels: datos.map(d => { const [y, m] = d.mes.split('-'); return `${MESES_CORTO[Number(m) - 1]} ${y}`; }), datasets: [{ label: 'Tareas realizadas', data: datos.map(d => d.n), backgroundColor: '#10b981' }] },
  options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } }
});
const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Dibuja un gráfico fuera de pantalla y devuelve el PNG en base64. */
const graficoPNG = (cfg, w = 900, h = 420) => {
  const cont = document.createElement('div');
  cont.style.cssText = `position:fixed;left:-10000px;top:0;width:${w}px;height:${h}px;background:#fff`;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  cont.appendChild(canvas); document.body.appendChild(cont);
  const fondo = { id: 'fondo', beforeDraw: (c) => { const x = c.ctx; x.save(); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.restore(); } };
  const chart = new Chart(canvas, { ...cfg, options: { ...cfg.options, responsive: false, animation: false, devicePixelRatio: 2 }, plugins: [fondo] });
  const url = chart.toBase64Image('image/png');
  chart.destroy(); cont.remove();
  return url;
};

// ---------------------------------------------------------------------
// Utilidades ExcelJS
// ---------------------------------------------------------------------
let cargaExcelJS = null;
const cargarExcelJS = () => {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (!cargaExcelJS) cargaExcelJS = new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = EXCELJS_URL; s.onload = () => ok(window.ExcelJS);
    s.onerror = () => { cargaExcelJS = null; mal(new Error('No se pudo cargar ExcelJS (revisa la conexión a internet).')); };
    document.head.appendChild(s);
  });
  return cargaExcelJS;
};

/** Logo de la empresa como dataURL PNG (si no se puede descargar, el Excel sale sin logo). */
const logoDataURL = async () => {
  const src = (config.value && config.value.logo) || LOGO_DEFAULT;
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = mal; i.src = src; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return { url: c.toDataURL('image/png'), ratio: img.naturalWidth / img.naturalHeight || 1 };
  } catch (e) { console.warn('[Minutas] Logo no disponible para el Excel', e); return null; }
};

const C = { oscuro: 'FF0F172A', teal: 'FF0F766E', tealClaro: 'FFCCFBF1', gris: 'FFF1F5F9', borde: 'FFCBD5E1', blanco: 'FFFFFFFF', rojoClaro: 'FFFFE4E6' };
const FILL_ESTADO = { 'Pendiente': 'FFFEF3C7', 'Proceso': 'FFE0F2FE', 'Realizado': 'FFD1FAE5', 'No Realizado': 'FFFFE4E6' };
const FONT_ESTADO = { 'Pendiente': 'FF92400E', 'Proceso': 'FF075985', 'Realizado': 'FF065F46', 'No Realizado': 'FF9F1239' };
const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const bordeFino = { top: { style: 'thin', color: { argb: C.borde } }, left: { style: 'thin', color: { argb: C.borde } }, bottom: { style: 'thin', color: { argb: C.borde } }, right: { style: 'thin', color: { argb: C.borde } } };
const pct = (n, t) => t ? n / t : 0;

const nombresUsados = new Set();
const nombreHoja = (s) => {
  let base = String(s).replace(/[\\/?*[\]:]/g, '-').slice(0, 28).trim() || 'Hoja';
  let n = base, i = 2;
  while (nombresUsados.has(n.toUpperCase())) n = `${base.slice(0, 26)} ${i++}`;
  nombresUsados.add(n.toUpperCase());
  return n;
};

/** Encabezado con logo y títulos (filas 1-4). Devuelve la siguiente fila libre. */
const encabezado = (wb, ws, logo, titulo, subtitulo, ultimaCol) => {
  ws.getRow(1).height = 26; ws.getRow(2).height = 20; ws.getRow(3).height = 18; ws.getRow(4).height = 6;
  if (logo) {
    const id = wb.addImage({ base64: logo.url, extension: 'png' });
    // El logo cabe en las columnas A-B (no tapa el título, que parte en C)
    const anchoMax = ((ws.getColumn(1).width || 9) + (ws.getColumn(2).width || 9)) * 7 - 8;
    const alto = Math.min(62, anchoMax / (logo.ratio || 1));
    ws.addImage(id, { tl: { col: 0.1, row: 0.15 }, ext: { width: Math.round(alto * (logo.ratio || 1)), height: Math.round(alto) }, editAs: 'oneCell' });
  }
  const fila = (r, texto, font) => {
    ws.mergeCells(r, 3, r, ultimaCol);
    const c = ws.getCell(r, 3); c.value = texto; c.font = font; c.alignment = { vertical: 'middle', horizontal: 'left' };
  };
  fila(1, `${EMPRESA} · ${titulo}`, { bold: true, size: 15, color: { argb: C.oscuro } });
  fila(2, subtitulo, { bold: true, size: 11, color: { argb: C.teal } });
  fila(3, `Generado el ${formatDateForDisplay(hoyISO())} ${new Date().toTimeString().slice(0, 5)}`, { italic: true, size: 9, color: { argb: 'FF64748B' } });
  for (let col = 1; col <= ultimaCol; col++) ws.getCell(4, col).border = { bottom: { style: 'medium', color: { argb: C.teal } } };
  return 6;
};

const tituloSeccion = (ws, fila, texto, ultimaCol) => {
  ws.mergeCells(fila, 1, fila, ultimaCol);
  const c = ws.getCell(fila, 1);
  c.value = texto; c.font = { bold: true, size: 11, color: { argb: C.blanco } }; c.fill = fill(C.teal);
  c.alignment = { vertical: 'middle', indent: 1 }; ws.getRow(fila).height = 20;
  return fila + 1;
};

/** Bloque de resumen: etiquetas, cantidades y porcentajes (7 columnas). */
const bloqueResumen = (ws, fila, r) => {
  const cols = [
    ['TOTAL TAREAS', r.total, 1], ['PENDIENTE', r.Pendiente, pct(r.Pendiente, r.total)], ['PROCESO', r.Proceso, pct(r.Proceso, r.total)],
    ['REALIZADO', r.Realizado, pct(r.Realizado, r.total)], ['NO REALIZADO', r['No Realizado'], pct(r['No Realizado'], r.total)],
    ['VENCIDAS', r.vencidas, pct(r.vencidas, r.total)], ['REALIZADAS A TIEMPO', r.aTiempo, r.pctATiempo / 100]
  ];
  const colorEtq = [C.oscuro, 'FFB45309', 'FF0369A1', 'FF047857', 'FFBE123C', 'FFE11D48', C.teal];
  cols.forEach(([etq, n, p], i) => {
    const a = ws.getCell(fila, i + 1), b = ws.getCell(fila + 1, i + 1), c = ws.getCell(fila + 2, i + 1);
    a.value = etq; a.font = { bold: true, size: 8, color: { argb: C.blanco } }; a.fill = fill(colorEtq[i]);
    b.value = n; b.font = { bold: true, size: 16, color: { argb: colorEtq[i] } };
    c.value = p; c.numFmt = '0%'; c.font = { bold: true, size: 10, color: { argb: 'FF475569' } };
    [a, b, c].forEach(x => { x.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; x.border = bordeFino; });
    b.fill = fill(C.gris); c.fill = fill(C.gris);
  });
  ws.getRow(fila).height = 24; ws.getRow(fila + 1).height = 26;
  // Barra de cumplimiento
  const f = fila + 3;
  ws.mergeCells(f, 1, f, 2); ws.getCell(f, 1).value = '% CUMPLIMIENTO';
  ws.getCell(f, 1).font = { bold: true, color: { argb: C.oscuro } }; ws.getCell(f, 1).alignment = { vertical: 'middle' };
  ws.getCell(f, 3).value = r.cumplimiento / 100; ws.getCell(f, 3).numFmt = '0%';
  ws.getCell(f, 3).font = { bold: true, size: 14, color: { argb: r.cumplimiento >= 80 ? 'FF047857' : r.cumplimiento >= 50 ? 'FFB45309' : 'FFBE123C' } };
  ws.getCell(f, 3).alignment = { horizontal: 'center' };
  ws.mergeCells(f, 4, f, 7);
  const barra = Math.round(r.cumplimiento / 5);
  ws.getCell(f, 4).value = '█'.repeat(barra) + '░'.repeat(20 - barra);
  ws.getCell(f, 4).font = { color: { argb: 'FF10B981' }, size: 12 };
  ws.getRow(f).height = 22;
  return f + 2;
};

// Columnas de la tabla de tareas (orden del Excel)
const COLS_TABLA = [
  { t: 'N° ITEM', w: 8, v: it => (it.n_item === '' || it.n_item === null ? '' : Number(it.n_item)), al: 'center' },
  { t: 'ÁREA', w: 12, v: it => it.area || '', al: 'center' },
  { t: 'RESPONSABLE', w: 22, v: it => String(it.personal || '').split(' / ').join('\n'), al: 'left' },
  { t: 'FECHA COMPROMISO', w: 14, v: it => fechaExcel(it.fecha_compromiso), al: 'center' },
  { t: 'FECHA ESTIMADA', w: 14, v: it => fechaExcel(it.fecha_estimada) || it.fecha_texto || '', al: 'center', clave: 'estimada' },
  { t: 'TAREAS', w: 60, v: it => it.tarea || '', al: 'left' },
  { t: 'ESTADO', w: 14, v: it => it.estado, al: 'center', clave: 'estado' },
  { t: 'FECHA REALIZADO', w: 14, v: it => (it.estado === 'Realizado' ? fechaExcel(it.fecha_realizado) : ''), al: 'center', clave: 'realizado' }
];
const fechaExcel = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };

/** Tabla de tareas con colores por estado.
 *  agrupar = true → filas de título por SECCIÓN (como en el Word). extra = columnas a la izquierda (Histórico). */
const tablaTareas = (ws, fila, items, { extra = [], agrupar = true } = {}) => {
  const cols = [...extra, ...COLS_TABLA];
  cols.forEach((c, i) => {
    const cell = ws.getCell(fila, i + 1);
    cell.value = c.t; cell.font = { bold: true, size: 9, color: { argb: C.blanco } }; cell.fill = fill(C.oscuro);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = bordeFino;
  });
  ws.getRow(fila).height = 28;
  const filaCab = fila;
  let r = fila + 1, seccionAnt = null, par = 0;
  items.forEach((it) => {
    const sec = String(it.seccion || '').trim().replace(/\s+/g, ' ').toUpperCase();
    if (agrupar && sec && sec !== seccionAnt) {
      ws.mergeCells(r, 1, r, cols.length);
      const c = ws.getCell(r, 1);
      c.value = sec; c.font = { bold: true, size: 11, color: { argb: C.oscuro } }; c.fill = fill('FFFDE68A');
      c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = bordeFino;
      ws.getRow(r).height = 20; r++;
    }
    seccionAnt = sec;
    const vencida = esVencida(it);
    cols.forEach((col, i) => {
      const c = ws.getCell(r, i + 1);
      const v = col.v(it);
      c.value = v; c.border = bordeFino; c.font = { size: 9 };
      c.alignment = { vertical: 'top', horizontal: col.al, wrapText: true };
      if (v instanceof Date) c.numFmt = 'dd-mm-yyyy';
      if (par % 2) c.fill = fill('FFF8FAFC');
      if (vencida) c.fill = fill(C.rojoClaro);
      if (col.clave === 'estado') { c.fill = fill(FILL_ESTADO[it.estado]); c.font = { bold: true, size: 9, color: { argb: FONT_ESTADO[it.estado] } }; }
      if (col.clave === 'estimada' && vencida) { c.font = { bold: true, size: 9, color: { argb: 'FFBE123C' } }; c.note = 'Vencida'; }
      if (col.clave === 'realizado' && it.estado === 'Realizado') c.font = { bold: true, size: 9, color: { argb: 'FF047857' } };
    });
    r++; par++;
  });
  if (!agrupar) ws.autoFilter = { from: { row: filaCab, column: 1 }, to: { row: Math.max(r - 1, filaCab + 1), column: cols.length } };
  ws.views = [{ state: 'frozen', ySplit: filaCab }];
  return r + 1;
};

const anchosTabla = (ws, extra = []) => { ws.columns = [...extra.map(e => e.w), ...COLS_TABLA.map(c => c.w)].map(w => ({ width: w })); };
const resumenPorSeccionDe = (items) => {
  const map = {};
  items.forEach(it => { const k = String(it.seccion || '').trim().toUpperCase(); if (k) (map[k] = map[k] || []).push(it); });
  return Object.entries(map).map(([personal, list]) => ({ personal, ...resumenItems(list) }));
};

/** Tabla de cumplimiento por encargado. */
const tablaPersonal = (ws, fila, porPersonal, col0 = 1, titulo = 'ENCARGADO') => {
  const cab = [titulo, 'TOTAL', 'REALIZADO', 'ABIERTAS', 'VENCIDAS', 'NO REALIZADO', '% CUMPL.'];
  cab.forEach((t, i) => { const c = ws.getCell(fila, col0 + i); c.value = t; c.font = { bold: true, size: 9, color: { argb: C.blanco } }; c.fill = fill(C.oscuro); c.alignment = { horizontal: 'center' }; c.border = bordeFino; });
  porPersonal.forEach((p, k) => {
    const vals = [p.personal, p.total, p.Realizado, p.Pendiente + p.Proceso, p.vencidas, p['No Realizado'], p.cumplimiento / 100];
    vals.forEach((v, i) => {
      const c = ws.getCell(fila + 1 + k, col0 + i); c.value = v; c.border = bordeFino; c.font = { size: 9, bold: i === 0 || i === 6 };
      c.alignment = { horizontal: i ? 'center' : 'left' };
      if (i === 6) { c.numFmt = '0%'; c.font = { size: 9, bold: true, color: { argb: p.cumplimiento >= 80 ? 'FF047857' : p.cumplimiento >= 50 ? 'FFB45309' : 'FFBE123C' } }; }
      if (i === 4 && v) c.font = { size: 9, bold: true, color: { argb: 'FFBE123C' } };
    });
  });
  return fila + porPersonal.length + 2;
};

const insertarImagen = (wb, ws, dataUrl, fila, col, w, h) => {
  const id = wb.addImage({ base64: dataUrl, extension: 'png' });
  ws.addImage(id, { tl: { col, row: fila - 1 }, ext: { width: w, height: h } });
  return fila + Math.ceil(h / 20) + 1;
};

// ---------------------------------------------------------------------
// Hojas
// ---------------------------------------------------------------------
const hojaMinuta = (wb, logo, m, nombre = 'Minuta') => {
  const items = itemsDeMinuta(m.id);
  const r = resumenItems(items);
  const ws = wb.addWorksheet(nombreHoja(nombre), { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { tabColor: { argb: C.teal } } });
  anchosTabla(ws);
  let f = encabezado(wb, ws, logo, 'MINUTA DE MEJORA CONTINUA', `${m.nombre}  ·  Fecha: ${formatDateForDisplay(m.fecha)}`, 8);
  f = tituloSeccion(ws, f, 'RESUMEN', 8);
  f = bloqueResumen(ws, f, r);
  f = tituloSeccion(ws, f, `DETALLE DE TAREAS (${items.length})`, 8);
  tablaTareas(ws, f, items);
  return ws;
};

const hojaDashboardMinuta = (wb, logo, m, evo) => {
  const items = itemsDeMinuta(m.id);
  const r = resumenItems(items);
  const porPersonal = resumenPorPersonalDe(items);
  const ws = wb.addWorksheet(nombreHoja('Dashboard'), { pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { tabColor: { argb: 'FF10B981' } } });
  ws.columns = [24, 10, 12, 12, 12, 14, 12, 4, 12, 12, 12, 12].map(w => ({ width: w }));
  let f = encabezado(wb, ws, logo, 'DASHBOARD MINUTA', `${m.nombre}  ·  Cumplimiento ${r.cumplimiento}%`, 12);
  f = tituloSeccion(ws, f, 'ESTADO DE LAS TAREAS', 12);
  insertarImagen(wb, ws, graficoPNG(cfgEstados(r), 700, 340), f, 0, 520, 252);
  f += 14;
  const porSeccion = resumenPorSeccionDe(items);
  if (porSeccion.length) { f = tituloSeccion(ws, f, 'CUMPLIMIENTO POR SECCIÓN', 12); f = tablaPersonal(ws, f, porSeccion, 1, 'SECCIÓN'); }
  f = tituloSeccion(ws, f, 'CUMPLIMIENTO POR ENCARGADO', 12);
  f = tablaPersonal(ws, f, porPersonal);
  if (porPersonal.length) { insertarImagen(wb, ws, graficoPNG(cfgPersonal(porPersonal), 900, Math.max(260, porPersonal.length * 42 + 90)), f, 0, 760, Math.max(220, porPersonal.length * 35 + 76)); f += Math.ceil(Math.max(220, porPersonal.length * 35 + 76) / 20) + 2; }
  if (evo.length > 1) {
    f = tituloSeccion(ws, f, 'EVOLUCIÓN SEMANA A SEMANA', 12);
    insertarImagen(wb, ws, graficoPNG(cfgEvolucion(evo), 1000, 420), f, 0, 860, 360);
  }
  return ws;
};

const hojaResumenGeneral = (wb, logo, minutas, evo) => {
  const ws = wb.addWorksheet(nombreHoja('Resumen General'), { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { tabColor: { argb: C.oscuro } } });
  ws.columns = [34, 13, 10, 11, 11, 12, 13, 11, 13].map(w => ({ width: w }));
  const ult = minutas[minutas.length - 1];
  let f = encabezado(wb, ws, logo, 'RESUMEN GENERAL DE MINUTAS', `${minutas.length} minuta(s) · del ${formatDateForDisplay(minutas[0].fecha)} al ${formatDateForDisplay(ult.fecha)}`, 9);
  f = tituloSeccion(ws, f, `SITUACIÓN ACTUAL (última minuta: ${ult.nombre})`, 9);
  f = bloqueResumen(ws, f, resumenItems(itemsDeMinuta(ult.id)));
  f = tituloSeccion(ws, f, 'EVOLUCIÓN POR MINUTA', 9);
  const cab = ['MINUTA', 'FECHA', 'TOTAL', 'PENDIENTE', 'PROCESO', 'REALIZADO', 'NO REALIZADO', 'VENCIDAS', '% CUMPL.'];
  cab.forEach((t, i) => { const c = ws.getCell(f, i + 1); c.value = t; c.font = { bold: true, size: 9, color: { argb: C.blanco } }; c.fill = fill(C.oscuro); c.alignment = { horizontal: 'center' }; c.border = bordeFino; });
  evo.forEach((e, k) => {
    const vals = [e.minuta.nombre, fechaExcel(e.minuta.fecha), e.total, e.Pendiente, e.Proceso, e.Realizado, e['No Realizado'], e.vencidas, e.cumplimiento / 100];
    vals.forEach((v, i) => {
      const c = ws.getCell(f + 1 + k, i + 1); c.value = v; c.border = bordeFino; c.font = { size: 9 };
      c.alignment = { horizontal: i ? 'center' : 'left' };
      if (k % 2) c.fill = fill('FFF8FAFC');
      if (v instanceof Date) c.numFmt = 'dd-mm-yyyy';
      if (i >= 3 && i <= 6) c.fill = fill(FILL_ESTADO[cab[i] === 'NO REALIZADO' ? 'No Realizado' : cab[i][0] + cab[i].slice(1).toLowerCase()]);
      if (i === 8) { c.numFmt = '0%'; c.font = { size: 9, bold: true, color: { argb: e.cumplimiento >= 80 ? 'FF047857' : e.cumplimiento >= 50 ? 'FFB45309' : 'FFBE123C' } }; }
    });
  });
  f += evo.length + 2;
  // Promedio
  const prom = evo.length ? Math.round(evo.reduce((s, e) => s + e.cumplimiento, 0) / evo.length) : 0;
  ws.getCell(f, 1).value = 'PROMEDIO DE CUMPLIMIENTO'; ws.getCell(f, 1).font = { bold: true };
  ws.getCell(f, 9).value = prom / 100; ws.getCell(f, 9).numFmt = '0%'; ws.getCell(f, 9).font = { bold: true, size: 12 }; ws.getCell(f, 9).alignment = { horizontal: 'center' };
  return ws;
};

const hojaDashboardGeneral = (wb, logo, minutas, evo) => {
  const ult = minutas[minutas.length - 1];
  const itemsUlt = itemsDeMinuta(ult.id);
  const r = resumenItems(itemsUlt);
  const porPersonal = resumenPorPersonalDe(itemsUlt);
  const ws = wb.addWorksheet(nombreHoja('Dashboard'), { pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { tabColor: { argb: 'FF10B981' } } });
  ws.columns = [24, 10, 12, 12, 12, 14, 12, 4, 12, 12, 12, 12].map(w => ({ width: w }));
  let f = encabezado(wb, ws, logo, 'DASHBOARD GENERAL', `Evolución de ${minutas.length} minuta(s) · Actual: ${ult.nombre}`, 12);
  f = tituloSeccion(ws, f, 'EVOLUCIÓN SEMANA A SEMANA', 12);
  insertarImagen(wb, ws, graficoPNG(cfgEvolucion(evo), 1000, 420), f, 0, 860, 360);
  f += 20;
  f = tituloSeccion(ws, f, `ESTADO ACTUAL (${ult.nombre})`, 12);
  insertarImagen(wb, ws, graficoPNG(cfgEstados(r), 700, 340), f, 0, 520, 252);
  f += 14;
  const porSeccion = resumenPorSeccionDe(itemsUlt);
  if (porSeccion.length) { f = tituloSeccion(ws, f, 'CUMPLIMIENTO POR SECCIÓN (minuta actual)', 12); f = tablaPersonal(ws, f, porSeccion, 1, 'SECCIÓN'); }
  f = tituloSeccion(ws, f, 'CUMPLIMIENTO POR ENCARGADO (minuta actual)', 12);
  f = tablaPersonal(ws, f, porPersonal);
  if (porPersonal.length) insertarImagen(wb, ws, graficoPNG(cfgPersonal(porPersonal), 900, Math.max(260, porPersonal.length * 42 + 90)), f, 0, 760, Math.max(220, porPersonal.length * 35 + 76));
  return ws;
};

const hojaHistorico = (wb, logo, minutas) => {
  const ws = wb.addWorksheet(nombreHoja('Histórico'), { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } });
  const extra = [
    { t: 'MINUTA', w: 28, v: it => it._m.nombre, al: 'left' },
    { t: 'FECHA MINUTA', w: 13, v: it => fechaExcel(it._m.fecha), al: 'center' },
    { t: 'SECCIÓN', w: 16, v: it => it.seccion || '', al: 'left' }
  ];
  anchosTabla(ws, extra);
  let f = encabezado(wb, ws, logo, 'HISTÓRICO CONSOLIDADO', 'Todas las tareas de todas las minutas, en orden cronológico', 11);
  const filas = [];
  minutas.forEach(m => itemsDeMinuta(m.id).forEach(it => filas.push({ ...it, _m: m })));
  f = tituloSeccion(ws, f, `TAREAS (${filas.length})`, 11);
  tablaTareas(ws, f, filas, { extra, agrupar: false });
  return ws;
};

// ---------------------------------------------------------------------
// Exportaciones públicas
// ---------------------------------------------------------------------
export const exportando = Vue.ref(false);

const descargar = async (wb, nombre) => {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = String(nombre).replace(/[\\/:*?"<>|]/g, '-');
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

const nuevoLibro = async () => {
  const ExcelJS = await cargarExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema FRC'; wb.created = new Date();
  nombresUsados.clear();
  return wb;
};

/** Minuta individual: hoja Minuta (logo, resumen con %, tabla) + hoja Dashboard. */
export const exportarMinutaExcel = async (m = minutaSel.value) => {
  if (!m) return alert('Selecciona una minuta.');
  exportando.value = true;
  try {
    const [wb, logo] = await Promise.all([nuevoLibro(), logoDataURL()]);
    const hasta = dbMinutas.value.filter(x => String(x.fecha) < String(m.fecha) || (x.fecha === m.fecha && x.id <= m.id));
    hojaMinuta(wb, logo, m);
    hojaDashboardMinuta(wb, logo, m, evolucionDe(hasta.slice(-20)));
    await descargar(wb, `${m.nombre}.xlsx`);
  } catch (err) { alert('No se pudo exportar: ' + (err.message || err)); }
  finally { exportando.value = false; }
};

/** Todas las minutas en UN solo archivo. */
export const exportarTodasExcel = async () => {
  const minutas = dbMinutas.value;
  if (!minutas.length) return alert('No hay minutas.');
  exportando.value = true;
  try {
    const [wb, logo] = await Promise.all([nuevoLibro(), logoDataURL()]);
    const evo = evolucionDe(minutas);
    hojaResumenGeneral(wb, logo, minutas, evo);
    hojaDashboardGeneral(wb, logo, minutas, evolucionDe(minutas.slice(-20)));
    hojaHistorico(wb, logo, minutas);
    minutas.forEach(m => hojaMinuta(wb, logo, m, m.nombre));   // orden cronológico
    await descargar(wb, `MINUTAS_COMPLETO_${formatDateForDisplay(hoyISO())}.xlsx`);
  } catch (err) { alert('No se pudo exportar: ' + (err.message || err)); }
  finally { exportando.value = false; }
};

// ---------------------------------------------------------------------
// Dashboard GENERAL → Excel
// ---------------------------------------------------------------------
import { kpiGeneral, tareasUnicas, generalPorSeccion, generalPorPersonal, realizadasPorMes, filtrarLista, filtroGeneral, PERIODOS } from './minutas.general.js';

const COLS_GENERAL = [
  { t: 'SECCIÓN', w: 16, v: t => t.seccion || '', al: 'left' },
  { t: 'ÁREA', w: 12, v: t => t.area || '', al: 'center' },
  { t: 'RESPONSABLE', w: 22, v: t => String(t.personal || '').split(' / ').join('\n'), al: 'left' },
  { t: 'TAREA', w: 60, v: t => t.tarea || '', al: 'left' },
  { t: 'ESTADO', w: 14, v: t => t.estado, al: 'center', clave: 'estado' },
  { t: 'FECHA COMPROMISO', w: 14, v: t => fechaExcel(t.fecha_compromiso), al: 'center' },
  { t: 'FECHA ESTIMADA', w: 14, v: t => fechaExcel(t.fecha_estimada) || t.fecha_texto || '', al: 'center', clave: 'estimada' },
  { t: 'FECHA REALIZADO', w: 14, v: t => (t.estado === 'Realizado' ? fechaExcel(t.fecha_realizado) : ''), al: 'center', clave: 'realizado' },
  { t: 'DÍAS', w: 8, v: t => (t.dias ?? ''), al: 'center' },
  { t: 'N° MINUTAS', w: 10, v: t => t.semanas, al: 'center' },
  { t: 'PRIMERA MINUTA', w: 14, v: t => fechaExcel(t.primeraFecha), al: 'center' },
  { t: 'ÚLTIMA MINUTA', w: 14, v: t => fechaExcel(t.ultimaMinuta.fecha), al: 'center' }
];

const hojaListaGeneral = (wb, logo, titulo, subtitulo, lista, color) => {
  const ws = wb.addWorksheet(nombreHoja(titulo), { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { tabColor: { argb: color } } });
  ws.columns = COLS_GENERAL.map(c => ({ width: c.w }));
  let f = encabezado(wb, ws, logo, titulo.toUpperCase(), subtitulo, COLS_GENERAL.length);
  f = tituloSeccion(ws, f, `${titulo.toUpperCase()} (${lista.length})`, COLS_GENERAL.length);
  COLS_GENERAL.forEach((c, i) => { const cell = ws.getCell(f, i + 1); cell.value = c.t; cell.font = { bold: true, size: 9, color: { argb: C.blanco } }; cell.fill = fill(C.oscuro); cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = bordeFino; });
  ws.getRow(f).height = 28;
  const filaCab = f;
  lista.forEach((t, k) => {
    const r = f + 1 + k;
    COLS_GENERAL.forEach((c, i) => {
      const cell = ws.getCell(r, i + 1); const v = c.v(t);
      cell.value = v; cell.border = bordeFino; cell.font = { size: 9 };
      cell.alignment = { vertical: 'top', horizontal: c.al, wrapText: true };
      if (v instanceof Date) cell.numFmt = 'dd-mm-yyyy';
      if (k % 2) cell.fill = fill('FFF8FAFC');
      if (t.vencida) cell.fill = fill(C.rojoClaro);
      if (c.clave === 'estado') { cell.fill = fill(FILL_ESTADO[t.estado]); cell.font = { bold: true, size: 9, color: { argb: FONT_ESTADO[t.estado] } }; }
      if (c.clave === 'estimada' && t.vencida) cell.font = { bold: true, size: 9, color: { argb: 'FFBE123C' } };
      if (c.clave === 'realizado' && t.estado === 'Realizado') cell.font = { bold: true, size: 9, color: { argb: 'FF047857' } };
    });
  });
  ws.autoFilter = { from: { row: filaCab, column: 1 }, to: { row: filaCab + Math.max(lista.length, 1), column: COLS_GENERAL.length } };
  ws.views = [{ state: 'frozen', ySplit: filaCab }];
  return ws;
};

/** Excel del Dashboard General: Resumen + gráficos, y una hoja por lista (Abiertas, Vencidas, Realizadas, No realizadas, Todas). */
export const exportarGeneralExcel = async () => {
  const ts = tareasUnicas.value;
  if (!ts.length) return alert('No hay tareas para exportar.');
  exportando.value = true;
  try {
    const [wb, logo] = await Promise.all([nuevoLibro(), logoDataURL()]);
    const k = kpiGeneral.value;
    const f0 = filtroGeneral.value;
    const filtros = [PERIODOS.find(p => p.k === f0.periodo)?.l || 'Todo', f0.seccion && `Sección: ${f0.seccion}`, f0.personal && `Encargado: ${f0.personal}`].filter(Boolean).join(' · ');

    // Hoja 1: Resumen general con KPIs, tablas y gráficos
    const ws = wb.addWorksheet(nombreHoja('Dashboard General'), { pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }, properties: { tabColor: { argb: C.oscuro } } });
    ws.columns = [24, 10, 12, 12, 12, 14, 12, 4, 12, 12, 12, 12].map(w => ({ width: w }));
    let f = encabezado(wb, ws, logo, 'DASHBOARD GENERAL DE MINUTAS', `${k.minutas} minuta(s) · ${k.total} tareas únicas · ${filtros}`, 12);
    f = tituloSeccion(ws, f, 'RESUMEN (cada tarea contada una vez, con su último estado)', 12);
    f = bloqueResumen(ws, f, k);
    const extras = [['Tareas abiertas (Pendiente + Proceso)', k.abiertas], ['Días promedio en cerrar una tarea', k.promDiasCierre ?? '-'], ['Minutas promedio que lleva abierta una tarea', k.promSemanasAbiertas ?? '-'], ['Abiertas que ya no aparecen en la minuta actual', k.sinActual]];
    extras.forEach(([a, b], i) => {
      ws.mergeCells(f + i, 1, f + i, 5); ws.getCell(f + i, 1).value = a; ws.getCell(f + i, 1).font = { bold: true, size: 9 };
      ws.getCell(f + i, 6).value = b; ws.getCell(f + i, 6).font = { bold: true, size: 11, color: { argb: C.teal } }; ws.getCell(f + i, 6).alignment = { horizontal: 'center' };
      [1, 6].forEach(c => { ws.getCell(f + i, c).border = bordeFino; });
    });
    f += extras.length + 1;
    f = tituloSeccion(ws, f, 'ESTADO DE TODAS LAS TAREAS', 12);
    insertarImagen(wb, ws, graficoPNG(cfgEstados(k), 700, 340), f, 0, 520, 252); f += 14;
    f = tituloSeccion(ws, f, 'EVOLUCIÓN SEMANA A SEMANA', 12);
    insertarImagen(wb, ws, graficoPNG(cfgEvolucion(evolucionDe(dbMinutas.value.slice(-20))), 1000, 420), f, 0, 860, 360); f += 20;
    const meses = realizadasPorMes.value;
    if (meses.length) { f = tituloSeccion(ws, f, 'TAREAS REALIZADAS POR MES', 12); insertarImagen(wb, ws, graficoPNG(cfgRealizadasMes(meses), 1000, 320), f, 0, 860, 275); f += 16; }
    f = tituloSeccion(ws, f, 'CUMPLIMIENTO POR SECCIÓN', 12);
    f = tablaPersonal(ws, f, generalPorSeccion.value, 1, 'SECCIÓN');
    f = tituloSeccion(ws, f, 'CUMPLIMIENTO POR ENCARGADO', 12);
    f = tablaPersonal(ws, f, generalPorPersonal.value);
    const pp = generalPorPersonal.value;
    if (pp.length) insertarImagen(wb, ws, graficoPNG(cfgPersonal(pp), 900, Math.max(260, pp.length * 42 + 90)), f, 0, 760, Math.max(220, pp.length * 35 + 76));

    // Hojas con las listas
    hojaListaGeneral(wb, logo, 'Abiertas', 'Tareas en Pendiente o Proceso (las vencidas en rojo)', filtrarLista(ts, 'abiertas'), 'FFF59E0B');
    hojaListaGeneral(wb, logo, 'Vencidas', 'Con Fecha Compromiso y plazo (Fecha Estimada) ya pasado', filtrarLista(ts, 'vencidas'), 'FFE11D48');
    hojaListaGeneral(wb, logo, 'Realizadas', 'Tareas cumplidas, con su fecha de realización', filtrarLista(ts, 'Realizado'), 'FF10B981');
    hojaListaGeneral(wb, logo, 'No Realizadas', 'Tareas marcadas como No Realizado', filtrarLista(ts, 'No Realizado'), 'FFBE123C');
    hojaListaGeneral(wb, logo, 'Todas las tareas', 'Listado completo de tareas únicas', filtrarLista(ts, 'todas'), 'FF64748B');

    await descargar(wb, `MINUTAS_DASHBOARD_GENERAL_${formatDateForDisplay(hoyISO())}.xlsx`);
  } catch (err) { alert('No se pudo exportar: ' + (err.message || err)); }
  finally { exportando.value = false; }
};
