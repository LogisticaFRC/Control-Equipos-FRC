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
    // El logo usa como máximo ~24 de ancho a la izquierda (el título va centrado, no lo tapa)
    let anchoCols = 0;
    for (let k = 1; k <= ultimaCol && anchoCols < 24; k++) anchoCols += ws.getColumn(k).width || 9;
    const anchoMax = Math.min(anchoCols, 26) * 7 - 8;
    const alto = Math.min(62, anchoMax / (logo.ratio || 1));
    ws.addImage(id, { tl: { col: 0.1, row: 0.15 }, ext: { width: Math.round(alto * (logo.ratio || 1)), height: Math.round(alto) }, editAs: 'oneCell' });
  }
  // Títulos centrados sobre todo el ancho de la hoja (el logo queda a la izquierda, encima)
  const fila = (r, texto, font) => {
    ws.mergeCells(r, 1, r, ultimaCol);
    const c = ws.getCell(r, 1); c.value = texto; c.font = font; c.alignment = { vertical: 'middle', horizontal: 'center' };
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
  items.forEach(it => { const k = String(it.seccion || '').trim().replace(/\s+/g, ' ').toUpperCase(); if (k) (map[k] = map[k] || []).push(it); });
  return Object.entries(map).map(([personal, list]) => ({ personal, ...resumenItems(list) }));
};

const setTimeout0 = [];   // fórmulas de tablaPersonal (se aplican después de escribir los valores)
/** Tabla de cumplimiento por encargado. */
const tablaPersonal = (ws, fila, porPersonal, col0 = 1, titulo = 'ENCARGADO', vinculo = null) => {
  const cab = [titulo, 'TOTAL', 'REALIZADO', 'ABIERTAS', 'VENCIDAS', 'NO REALIZADO', '% CUMPL.'];
  // vinculo = { hoja, a, b, col } → las cifras se calculan con fórmulas desde la hoja Minuta (se actualizan solas)
  if (vinculo) {
    const H = `'${String(vinculo.hoja).replace(/'/g, "''")}'!`;
    const R = (c) => `${H}$${c}$${vinculo.a}:$${c}$${vinculo.b}`;
    porPersonal.forEach((p, k) => {
      const r = fila + 1 + k, key = `$${ws.getColumn(col0).letter}$${r}`, k2 = `${R(vinculo.col)},${key}`;
      const L = (i) => ws.getColumn(col0 + i).letter + r;
      setTimeout0.push(() => {
        ws.getCell(L(1)).value = { formula: `COUNTIF(${k2})`, result: p.total };
        ws.getCell(L(2)).value = { formula: `COUNTIFS(${k2},${R('AC')},"REALIZADO")`, result: p.Realizado };
        ws.getCell(L(3)).value = { formula: `COUNTIFS(${k2},${R('AC')},"PENDIENTE")+COUNTIFS(${k2},${R('AC')},"PROCESO")`, result: p.Pendiente + p.Proceso };
        ws.getCell(L(4)).value = { formula: `SUMIFS(${R('AP')},${k2})`, result: p.vencidas };
        ws.getCell(L(5)).value = { formula: `COUNTIFS(${k2},${R('AC')},"NO REALIZADO")`, result: p['No Realizado'] };
        ws.getCell(L(6)).value = { formula: `IFERROR(${L(2)}/${L(1)},0)`, result: p.cumplimiento / 100 };
        cfCumplimiento(ws, L(6), L(6));
      });
    });
  }
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
  setTimeout0.splice(0).forEach(fn => fn());
  return fila + porPersonal.length + 2;
};

const insertarImagen = (wb, ws, dataUrl, fila, col, w, h) => {
  const id = wb.addImage({ base64: dataUrl, extension: 'png' });
  if (col === 0) col = colCentrada(ws, w);   // centrado en el ancho de la hoja
  ws.addImage(id, { tl: { col, row: fila - 1 }, ext: { width: w, height: h } });
  return fila + Math.ceil(h / 20) + 1;
};

/** Columna (fraccionaria) donde debe partir una imagen de w px para quedar centrada. */
const PX_POR_ANCHO = 7.2;
const colCentrada = (ws, wPx) => {
  const anchos = (ws.columns || []).map(c => c.width || 9);
  const total = anchos.reduce((a, b) => a + b, 0) * PX_POR_ANCHO;
  let falta = Math.max(0, (total - wPx) / 2), col = 0;
  for (const a of anchos) { const px = a * PX_POR_ANCHO; if (falta < px) return col + falta / px; falta -= px; col++; }
  return 0;
};

// ---------------------------------------------------------------------
// Hojas
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// HOJA MINUTA (formato para ENVIAR): todo centrado sobre una grilla de 40 columnas
// angostas, así los bloques (datos, indicadores, responsables y tareas) quedan
// simétricos y alineados. Las celdas con texto largo ajustan su alto solas.
// ---------------------------------------------------------------------
const GRILLA = 40, ANCHO_GRILLA = 4;
const diasEntreISO = (a, b) => { const f = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((f(a) - f(b)) / 86400000); };
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

/** Texto de la situación de una tarea (columna SITUACIÓN). Devuelve { texto, color }. */
export const situacionTarea = (it) => {
  const hoy = hoyISO();
  if (it.estado === 'Realizado') {
    if (it.fecha_realizado && it.fecha_estimada) {
      const d = diasEntreISO(it.fecha_realizado, it.fecha_estimada);
      return d <= 0 ? { texto: '✔ Realizada a tiempo', color: 'FF047857' } : { texto: `Realizada con ${plural(d, 'día', 'días')} de atraso`, color: 'FFB45309' };
    }
    return { texto: '✔ Realizada', color: 'FF047857' };
  }
  if (it.estado === 'No Realizado') return { texto: '✖ No realizada', color: 'FFBE123C' };
  if (it.fecha_estimada) {
    const d = diasEntreISO(it.fecha_estimada, hoy);
    if (d < 0) return esVencida(it) ? { texto: `⚠ VENCIDA hace ${plural(-d, 'día', 'días')}`, color: 'FFBE123C' } : { texto: `Plazo pasado hace ${plural(-d, 'día', 'días')}`, color: 'FFB45309' };
    if (d === 0) return { texto: '⚠ Vence HOY', color: 'FFB45309' };
    return { texto: `Vence en ${plural(d, 'día', 'días')}`, color: d <= 3 ? 'FFB45309' : 'FF475569' };
  }
  if (it.fecha_texto) return { texto: String(it.fecha_texto), color: 'FF475569' };
  return { texto: 'Sin fecha estimada', color: 'FF94A3B8' };
};

/** Columnas de la tabla de tareas en la grilla: span = n° de columnas de la grilla (suman 40). */
const COLS_MINUTA = [
  { t: 'N°', span: 2, al: 'center', v: it => (it.n_item === '' || it.n_item === null || it.n_item === undefined ? '' : Number(it.n_item)) },
  { t: 'ÁREA', span: 3, al: 'center', v: it => it.area || '' },
  { t: 'RESPONSABLE', span: 5, al: 'center', v: it => String(it.personal || '').split(' / ').join('\n') },
  { t: 'TAREA / COMPROMISO', span: 12, al: 'left', v: it => it.tarea || '' },
  { t: 'FECHA COMPROMISO', span: 3, al: 'center', v: it => fechaExcel(it.fecha_compromiso) },
  { t: 'FECHA ESTIMADA', span: 3, al: 'center', v: it => fechaExcel(it.fecha_estimada) || it.fecha_texto || '', clave: 'estimada' },
  { t: 'ESTADO', span: 3, al: 'center', v: it => String(it.estado || '').toUpperCase(), clave: 'estado' },
  { t: 'FECHA REALIZADO', span: 3, al: 'center', v: it => (it.estado === 'Realizado' ? fechaExcel(it.fecha_realizado) : ''), clave: 'realizado' },
  { t: 'SITUACIÓN', span: 6, al: 'center', v: it => situacionTarea(it).texto, clave: 'situacion' }
];

/** Escribe un valor en un rango de la grilla (une las celdas y aplica estilo). */
const celdaGrilla = (ws, r, c1, span, valor, estilo = {}) => {
  const c2 = c1 + span - 1;
  if (span > 1) ws.mergeCells(r, c1, r, c2);
  const c = ws.getCell(r, c1);
  c.value = valor === undefined || valor === null ? '' : valor;
  c.font = estilo.font || { size: 9 };
  c.alignment = { horizontal: estilo.al || 'center', vertical: 'middle', wrapText: true, ...(estilo.indent ? { indent: estilo.indent } : {}) };
  if (estilo.numFmt) c.numFmt = estilo.numFmt;
  for (let k = c1; k <= c2; k++) {
    const x = ws.getCell(r, k);
    if (estilo.fill) x.fill = fill(estilo.fill);
    if (estilo.border !== false) x.border = estilo.border || bordeFino;
  }
  return c;
};

/** Alto de fila según el texto más largo (Excel no ajusta solo las celdas unidas). */
const altoPorTexto = (textos, base = 18, tam = 9) => {
  let lineas = 1;
  textos.forEach(([txt, span]) => {
    const porLinea = Math.max(4, Math.floor(span * ANCHO_GRILLA * (10 / tam) * 1.05));
    const n = String(txt ?? '').split('\n').reduce((s, p) => s + Math.max(1, Math.ceil(p.length / porLinea)), 0);
    lineas = Math.max(lineas, n);
  });
  return Math.max(base, lineas * (tam + 4) + 6);
};

const bandaTitulo = (ws, r, texto, color = C.teal) => {
  celdaGrilla(ws, r, 1, GRILLA, texto, { font: { bold: true, size: 11, color: { argb: C.blanco } }, fill: color, border: false });
  ws.getRow(r).height = 22;
  return r + 1;
};

// ---------------------------------------------------------------------
// FÓRMULAS: el resumen de arriba se calcula desde la tabla de tareas, así al cambiar el ESTADO
// (lista desplegable) o la FECHA REALIZADO en Excel, se actualizan los indicadores, los % y la situación.
// Columnas ocultas de apoyo (a la derecha de la grilla): AO = responsable, AP = vencida (1/0),
// AQ = realizada a tiempo (1) / atrasada (-1), AR = sección.
// ---------------------------------------------------------------------
const COL = { estimada: 'Z', compromiso: 'W', estado: 'AC', realizado: 'AF', situacion: 'AI', resp: 'AO', venc: 'AP', tiempo: 'AQ', sec: 'AR' };
const ESTADOS_XL = ['PENDIENTE', 'PROCESO', 'REALIZADO', 'NO REALIZADO'];
const fx = (formula, result) => ({ formula, result });
const cfColor = (argb) => ({ font: { color: { argb }, bold: true } });
const cfFill = (argb) => ({ fill: { type: 'pattern', pattern: 'solid', bgColor: { argb } } });
/** Reglas de color por % de cumplimiento (verde ≥ 80 %, ámbar ≥ 50 %, rojo). */
const cfCumplimiento = (ws, ref, celda) => ws.addConditionalFormatting({ ref, rules: [
  { type: 'expression', priority: 1, formulae: [`${celda}>=0.8`], style: cfColor('FF047857') },
  { type: 'expression', priority: 2, formulae: [`AND(${celda}>=0.5,${celda}<0.8)`], style: cfColor('FFB45309') },
  { type: 'expression', priority: 3, formulae: [`${celda}<0.5`], style: cfColor('FFBE123C') }
] });
const fSituacion = (r) => {
  const E = `${COL.estado}${r}`, Z0 = `${COL.estimada}${r}`, F0 = `${COL.realizado}${r}`, V = `${COL.venc}${r}`;
  const Z = `INT(${Z0})`, F = `INT(${F0})`;   // INT: si la fecha trae hora, cuenta días enteros
  const dias = (x) => `${x}&IF(${x}=1," día"," días")`;
  return `IF(${E}="REALIZADO",IF(AND(ISNUMBER(${F0}),ISNUMBER(${Z0})),IF(${F}<=${Z},"✔ Realizada a tiempo","Realizada con "&${dias(`(${F}-${Z})`)}&" de atraso"),"✔ Realizada"),` +
    `IF(${E}="NO REALIZADO","✖ No realizada",IF(ISNUMBER(${Z0}),IF(${Z}<TODAY(),IF(${V}=1,"⚠ VENCIDA hace ","Plazo pasado hace ")&${dias(`(TODAY()-${Z})`)},` +
    `IF(${Z}=TODAY(),"⚠ Vence HOY","Vence en "&${dias(`(${Z}-TODAY())`)})),IF(${Z0}<>"",${Z0},"Sin fecha estimada"))))`;
};

const hojaMinuta = (wb, logo, m, nombre = 'Minuta') => {
  const items = itemsDeMinuta(m.id);
  const r = resumenItems(items);
  const ws = wb.addWorksheet(nombreHoja(nombre), {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.5, header: 0.2, footer: 0.25 } },
    headerFooter: { oddFooter: `&L&8${EMPRESA} · ${String(m.nombre).replace(/&/g, '&&')}&R&8Página &P de &N` },
    properties: { tabColor: { argb: C.teal } }
  });
  ws.columns = Array.from({ length: GRILLA }, () => ({ width: ANCHO_GRILLA }));

  let f = encabezado(wb, ws, logo, 'MINUTA DE MEJORA CONTINUA', `${m.nombre}`, GRILLA);

  // --- Datos de la minuta (4 bloques iguales) ---
  const responsables = new Set(items.map(it => String(it.personal || '').trim().toUpperCase()).filter(Boolean)).size;
  const secciones = new Set(items.map(it => String(it.seccion || '').trim().toUpperCase()).filter(Boolean)).size;
  const datos = [['FECHA DE REUNIÓN', formatDateForDisplay(m.fecha)], ['TOTAL DE TAREAS', r.total], ['RESPONSABLES', responsables], ['SECCIONES', secciones || '-']];
  const pend = [];   // fórmulas que se escriben cuando ya se conoce el rango de la tabla
  datos.forEach(([etq, val], i) => {
    const c1 = i * 10 + 1;
    celdaGrilla(ws, f, c1 + 1, 8, etq, { font: { bold: true, size: 8, color: { argb: 'FF64748B' } }, fill: C.gris });
    const cel = celdaGrilla(ws, f + 1, c1 + 1, 8, val, { font: { bold: true, size: 13, color: { argb: C.oscuro } } });
    if (etq === 'TOTAL DE TAREAS') pend.push((R) => { cel.value = fx(`COUNTA(${R(COL.estado)})`, r.total); });
  });
  ws.getRow(f).height = 16; ws.getRow(f + 1).height = 24;
  f += 3;

  // --- Indicadores (8 tarjetas iguales) ---
  f = bandaTitulo(ws, f, 'RESUMEN DE CUMPLIMIENTO');
  f++;
  const colorCumpl = r.cumplimiento >= 80 ? 'FF047857' : r.cumplimiento >= 50 ? 'FFB45309' : 'FFBE123C';
  const tarjetas = [
    ['TOTAL', r.total, 1, C.oscuro], ['REALIZADO', r.Realizado, pct(r.Realizado, r.total), 'FF047857'],
    ['EN PROCESO', r.Proceso, pct(r.Proceso, r.total), 'FF0369A1'], ['PENDIENTE', r.Pendiente, pct(r.Pendiente, r.total), 'FFB45309'],
    ['NO REALIZADO', r['No Realizado'], pct(r['No Realizado'], r.total), 'FFBE123C'], ['VENCIDAS', r.vencidas, pct(r.vencidas, r.total), 'FFE11D48'],
    ['A TIEMPO', r.aTiempo, r.pctATiempo / 100, C.teal], ['CUMPLIMIENTO', r.cumplimiento / 100, null, colorCumpl]
  ];
  const celdas = {};
  tarjetas.forEach(([etq, n, p, color], i) => {
    const c1 = i * 5 + 1;
    if (etq === 'CUMPLIMIENTO') color = C.oscuro;   // su color lo da la regla según el %
    const marco = { top: { style: 'thin', color: { argb: color } }, bottom: { style: 'thin', color: { argb: color } }, left: { style: 'thin', color: { argb: color } }, right: { style: 'thin', color: { argb: color } } };
    celdaGrilla(ws, f, c1, 5, etq, { font: { bold: true, size: 8, color: { argb: C.blanco } }, fill: color, border: marco });
    const cn = celdaGrilla(ws, f + 1, c1, 5, n, { font: { bold: true, size: 18, color: { argb: color } }, fill: C.blanco, border: marco, numFmt: etq === 'CUMPLIMIENTO' ? '0%' : undefined });
    const cp = celdaGrilla(ws, f + 2, c1, 5, p === null ? 'tareas realizadas' : p, { font: { size: 9, bold: true, color: { argb: 'FF64748B' } }, fill: C.gris, border: marco, numFmt: p === null ? undefined : '0%' });
    celdas[etq] = { n: cn, p: cp };
  });
  const A = (c) => c.address.replace(/([A-Z]+)(\d+)/, '$$$1$$$2');   // referencia absoluta
  pend.push((R) => {
    const T = A(celdas.TOTAL.n);
    const tiempo = `COUNTIF(${R(COL.tiempo)},1)`, atraso = `COUNTIF(${R(COL.tiempo)},-1)`;
    celdas.TOTAL.n.value = fx(`COUNTA(${R(COL.estado)})`, r.total);
    const cnt = { REALIZADO: ['REALIZADO', r.Realizado], 'EN PROCESO': ['PROCESO', r.Proceso], PENDIENTE: ['PENDIENTE', r.Pendiente], 'NO REALIZADO': ['NO REALIZADO', r['No Realizado']] };
    Object.entries(cnt).forEach(([etq, [est, val]]) => {
      celdas[etq].n.value = fx(`COUNTIF(${R(COL.estado)},"${est}")`, val);
      celdas[etq].p.value = fx(`IFERROR(${A(celdas[etq].n)}/${T},0)`, pct(val, r.total));
    });
    celdas.VENCIDAS.n.value = fx(`SUM(${R(COL.venc)})`, r.vencidas);
    celdas.VENCIDAS.p.value = fx(`IFERROR(${A(celdas.VENCIDAS.n)}/${T},0)`, pct(r.vencidas, r.total));
    celdas['A TIEMPO'].n.value = fx(tiempo, r.aTiempo);
    celdas['A TIEMPO'].p.value = fx(`IFERROR(${tiempo}/(${tiempo}+${atraso}),0)`, r.pctATiempo / 100);
    celdas.CUMPLIMIENTO.n.value = fx(`IFERROR(${A(celdas.REALIZADO.n)}/${T},0)`, r.cumplimiento / 100);
    cfCumplimiento(ws, celdas.CUMPLIMIENTO.n.address, A(celdas.CUMPLIMIENTO.n));
  });
  ws.getRow(f).height = 18; ws.getRow(f + 1).height = 32; ws.getRow(f + 2).height = 16;
  f += 4;
  // Barra de avance centrada
  const barra = Math.round(r.cumplimiento / 2.5);
  const cBarra = celdaGrilla(ws, f, 6, 30, `${'█'.repeat(barra)}${'░'.repeat(40 - barra)}   ${r.cumplimiento}% cumplido`, { font: { size: 11, color: { argb: colorCumpl }, bold: true }, border: false });
  pend.push(() => {
    const X = A(celdas.CUMPLIMIENTO.n);
    cBarra.value = fx(`REPT("█",ROUND(${X}*40,0))&REPT("░",40-ROUND(${X}*40,0))&"   "&TEXT(${X},"0%")&" cumplido"`, cBarra.value);
    cfCumplimiento(ws, cBarra.address, X);
  });
  ws.getRow(f).height = 20;
  f += 2;

  // --- Resumen por responsable (tabla centrada) ---
  const porPersonal = resumenPorPersonalDe(items);
  if (porPersonal.length) {
    f = bandaTitulo(ws, f, 'RESUMEN POR RESPONSABLE');
    f++;
    const cab = [['RESPONSABLE', 10], ['TOTAL', 4], ['REALIZADO', 4], ['EN PROCESO', 4], ['PENDIENTE', 4], ['NO REALIZADO', 4], ['VENCIDAS', 4], ['% CUMPLIMIENTO', 6]];
    let c = 1;
    cab.forEach(([t, span]) => { celdaGrilla(ws, f, c, span, t, { font: { bold: true, size: 8, color: { argb: C.blanco } }, fill: C.oscuro }); c += span; });
    ws.getRow(f).height = 22;
    porPersonal.forEach((p, k) => {
      const rr = f + 1 + k;
      const vals = [p.personal, p.total, p.Realizado, p.Proceso, p.Pendiente, p['No Realizado'], p.vencidas, p.cumplimiento / 100];
      let cc = 1;
      const fila = [];
      vals.forEach((v, i) => {
        const [, span] = cab[i];
        fila.push(celdaGrilla(ws, rr, cc, span, v, {
          font: { size: 9, bold: i === 0 || i === 7, color: { argb: i === 6 ? 'FFBE123C' : C.oscuro } },
          fill: k % 2 ? 'FFF8FAFC' : C.blanco, al: i === 0 ? 'left' : 'center', indent: i === 0 ? 1 : 0, numFmt: i === 7 ? '0%' : (i > 0 ? '0;-0;"-"' : undefined)
        }));
        cc += span;
      });
      pend.push((R) => {
        const key = A(fila[0]), cR = `${R(COL.resp)},${key}`;
        fila[1].value = fx(`COUNTIF(${R(COL.resp)},${key})`, p.total);
        ESTADOS_XL.forEach((est, j) => {
          const idx = { PENDIENTE: 4, PROCESO: 3, REALIZADO: 2, 'NO REALIZADO': 5 }[est];
          fila[idx].value = fx(`COUNTIFS(${cR},${R(COL.estado)},"${est}")`, fila[idx].value);
        });
        fila[6].value = fx(`SUMIFS(${R(COL.venc)},${cR})`, p.vencidas);
        fila[7].value = fx(`IFERROR(${A(fila[2])}/${A(fila[1])},0)`, p.cumplimiento / 100);
        cfCumplimiento(ws, fila[7].address, A(fila[7]));
      });
      ws.getRow(rr).height = altoPorTexto([[p.personal, 10]], 18);
    });
    f += porPersonal.length + 2;
  }

  // --- Detalle de tareas, agrupado por sección ---
  f = bandaTitulo(ws, f, `DETALLE DE TAREAS (${items.length})`);
  f++;
  let c = 1;
  COLS_MINUTA.forEach(col => { celdaGrilla(ws, f, c, col.span, col.t, { font: { bold: true, size: 9, color: { argb: C.blanco } }, fill: C.oscuro }); c += col.span; });
  ws.getRow(f).height = 30;
  const filaCab = f;
  let rr = f + 1, seccionAnt = null, par = 0, primeraFila = null, ultimaFila = null;
  items.forEach((it) => {
    const sec = String(it.seccion || '').trim().replace(/\s+/g, ' ').toUpperCase();
    if (sec && sec !== seccionAnt) {
      const n = items.filter(x => String(x.seccion || '').trim().replace(/\s+/g, ' ').toUpperCase() === sec);
      const rs = resumenItems(n);
      const cs = celdaGrilla(ws, rr, 1, GRILLA, `${sec}   ·   ${plural(n.length, 'tarea', 'tareas')}   ·   ${rs.cumplimiento}% cumplido`, { font: { bold: true, size: 10, color: { argb: C.oscuro } }, fill: 'FFFDE68A' });
      const txtSec = sec.replace(/"/g, '""');
      pend.push((R) => {
        const nT = `COUNTIF(${R(COL.sec)},"${txtSec}")`;
        cs.value = fx(`"${txtSec}   ·   "&${nT}&IF(${nT}=1," tarea"," tareas")&"   ·   "&TEXT(IFERROR(COUNTIFS(${R(COL.sec)},"${txtSec}",${R(COL.estado)},"REALIZADO")/${nT},0),"0%")&" cumplido"`, cs.value);
      });
      ws.getRow(rr).height = 20; rr++; par = 0;
    }
    seccionAnt = sec;
    const vencida = esVencida(it);
    const fondo = par % 2 ? 'FFF8FAFC' : C.blanco;   // el rojo de vencida lo pone una regla (cambia sola)
    if (primeraFila === null) primeraFila = rr;
    let cc = 1;
    const textos = [];
    COLS_MINUTA.forEach(col => {
      const v = col.v(it);
      const estilo = { font: { size: 9, color: { argb: C.oscuro } }, fill: fondo, al: col.al, indent: col.al === 'left' ? 1 : 0, numFmt: v instanceof Date ? 'dd-mm-yyyy' : undefined };
      if (col.clave === 'estado') { estilo.fill = FILL_ESTADO[it.estado] || fondo; estilo.font = { bold: true, size: 9, color: { argb: FONT_ESTADO[it.estado] || C.oscuro } }; }
      if (col.clave === 'realizado') estilo.font = { bold: true, size: 9, color: { argb: 'FF047857' } };
      if (col.clave === 'situacion') estilo.font = { bold: true, size: 9, color: { argb: 'FF475569' } };
      if (col.t === 'N°') estilo.font = { bold: true, size: 9, color: { argb: 'FF64748B' } };
      if (col.clave === 'realizado') estilo.numFmt = 'dd-mm-yyyy';
      const cel = celdaGrilla(ws, rr, cc, col.span, v, estilo);
      if (col.clave === 'estado') cel.dataValidation = { type: 'list', allowBlank: false, showErrorMessage: true, errorTitle: 'Estado', error: 'Elige: PENDIENTE, PROCESO, REALIZADO o NO REALIZADO', formulae: [`"${ESTADOS_XL.join(',')}"`] };
      if (col.clave === 'situacion') cel.value = fx(fSituacion(rr), v);
      if (!(v instanceof Date)) textos.push([v, col.span]);
      cc += col.span;
    });
    ws.getRow(rr).height = altoPorTexto(textos, 20);
    // Columnas de apoyo (ocultas)
    const E = `${COL.estado}${rr}`, Z = `${COL.estimada}${rr}`, W = `${COL.compromiso}${rr}`, F = `${COL.realizado}${rr}`;
    ws.getCell(`${COL.resp}${rr}`).value = String(it.personal || '').trim().toUpperCase() || 'SIN ASIGNAR';
    ws.getCell(`${COL.sec}${rr}`).value = sec;
    ws.getCell(`${COL.venc}${rr}`).value = fx(`IF(AND(OR(${E}="PENDIENTE",${E}="PROCESO"),ISNUMBER(${W}),ISNUMBER(${Z}),${Z}<TODAY()),1,0)`, vencida ? 1 : 0);
    const tA = it.estado === 'Realizado' && it.fecha_realizado && it.fecha_estimada ? (it.fecha_realizado <= it.fecha_estimada ? 1 : -1) : 0;
    ws.getCell(`${COL.tiempo}${rr}`).value = fx(`IF(AND(${E}="REALIZADO",ISNUMBER(${F}),ISNUMBER(${Z})),IF(INT(${F})<=INT(${Z}),1,-1),0)`, tA);
    ultimaFila = rr;
    rr++; par++;
  });
  if (!items.length) { celdaGrilla(ws, rr, 1, GRILLA, 'Esta minuta no tiene tareas.', { font: { italic: true, size: 9, color: { argb: 'FF94A3B8' } } }); rr++; }

  // Fórmulas del resumen (ya se conoce el rango de la tabla) + colores que cambian solos
  const a = primeraFila || filaCab + 1, b = ultimaFila || a;
  const R = (col) => `$${col}$${a}:$${col}$${b}`;
  pend.forEach(fn => fn(R));
  if (primeraFila) {
    const E = `$${COL.estado}${a}`;
    ws.addConditionalFormatting({ ref: `${COL.estado}${a}:${COL.estado}${b}`, rules: ESTADOS_XL.map((est, k) => {
      const clave = ['Pendiente', 'Proceso', 'Realizado', 'No Realizado'][k];
      return { type: 'expression', priority: k + 1, formulae: [`${E}="${est}"`], style: { ...cfFill(FILL_ESTADO[clave]), font: { bold: true, color: { argb: FONT_ESTADO[clave] } } } };
    }) });
    const S = `$${COL.situacion}${a}`;
    ws.addConditionalFormatting({ ref: `${COL.situacion}${a}:${COL.situacion}${b}`, rules: [
      { type: 'expression', priority: 5, formulae: [`OR(ISNUMBER(SEARCH("VENCIDA",${S})),ISNUMBER(SEARCH("No realizada",${S})))`], style: cfColor('FFBE123C') },
      { type: 'expression', priority: 6, formulae: [`LEFT(${S},1)="✔"`], style: cfColor('FF047857') },
      { type: 'expression', priority: 7, formulae: [`OR(ISNUMBER(SEARCH("atraso",${S})),ISNUMBER(SEARCH("HOY",${S})),ISNUMBER(SEARCH("Plazo pasado",${S})))`], style: cfColor('FFB45309') }
    ] });
    ws.addConditionalFormatting({ ref: `${COL.estimada}${a}:${COL.estimada}${b}`, rules: [{ type: 'expression', priority: 8, formulae: [`$${COL.venc}${a}=1`], style: cfColor('FFBE123C') }] });
    ws.addConditionalFormatting({ ref: `A${a}:AN${b}`, rules: [{ type: 'expression', priority: 20, formulae: [`$${COL.venc}${a}=1`], style: cfFill(C.rojoClaro) }] });
  }
  ['AO', 'AP', 'AQ', 'AR'].forEach(c => { ws.getColumn(c).hidden = true; });
  ws.pageSetup.printArea = `A1:AN${rr + 3}`;
  wb.calcProperties = { ...(wb.calcProperties || {}), fullCalcOnLoad: true };

  // Leyenda
  rr++;
  celdaGrilla(ws, rr, 1, GRILLA, 'Cambia el ESTADO (lista desplegable) y la FECHA REALIZADO: el resumen, los %, la situación y los colores se actualizan solos.   ·   Filas en rojo = VENCIDAS (Pendiente o En proceso con la fecha estimada pasada).   ·   Cumplimiento = Realizadas / total.', { font: { italic: true, size: 8, color: { argb: 'FF64748B' } }, border: false });

  // Al imprimir, el encabezado de la tabla se repite en cada página
  ws.pageSetup.printTitlesRow = `${filaCab}:${filaCab}`;
  ws.__rango = primeraFila ? { hoja: ws.name, a, b } : null;   // para que el Dashboard calcule desde esta hoja
  return ws;
};

const hojaDashboardMinuta = (wb, logo, m, evo, wsMinuta = null) => {
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
  const rg = wsMinuta && wsMinuta.__rango;
  if (porSeccion.length) { f = tituloSeccion(ws, f, 'CUMPLIMIENTO POR SECCIÓN', 12); f = tablaPersonal(ws, f, porSeccion, 1, 'SECCIÓN', rg && { ...rg, col: 'AR' }); }
  f = tituloSeccion(ws, f, 'CUMPLIMIENTO POR ENCARGADO', 12);
  f = tablaPersonal(ws, f, porPersonal, 1, 'ENCARGADO', rg && { ...rg, col: 'AO' });
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
    const wsM = hojaMinuta(wb, logo, m);
    hojaDashboardMinuta(wb, logo, m, evolucionDe(hasta.slice(-20)), wsM);
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
