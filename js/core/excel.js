// =====================================================================
// CORE · Exportación a Excel CON FORMATO (logo, títulos, celdas centradas)
// ---------------------------------------------------------------------
// Usa ExcelJS (se carga solo al exportar). Lo usan Programas y OC.
//   const { wb, logo } = await nuevoLibro();
//   hojaTabla(wb, logo, { nombre, titulo, subtitulo, columnas, filas, totales });
//   await descargarLibro(wb, 'Archivo.xlsx');
// =====================================================================
import { config, LOGO_DEFAULT } from './store.js';
import { hoyISO, formatDateForDisplay } from './utils.js';

const EXCELJS_URL = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
export const EMPRESA = 'FAST RENTAL CHILE';

let cargaExcelJS = null;
export const cargarExcelJS = () => {
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
export const logoDataURL = async () => {
  const src = (config.value && config.value.logo) || LOGO_DEFAULT;
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = mal; i.src = src; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return { url: c.toDataURL('image/png'), ratio: img.naturalWidth / img.naturalHeight || 1 };
  } catch (e) { console.warn('[Excel] Logo no disponible', e); return null; }
};

export const COLOR = {
  oscuro: 'FF0F172A', indigo: 'FF312E81', indigoClaro: 'FFE0E7FF', gris: 'FFF1F5F9', borde: 'FF94A3B8',
  blanco: 'FFFFFFFF', verde: 'FFD1FAE5', verdeTxt: 'FF065F46', ambar: 'FFFEF3C7', ambarTxt: 'FF92400E', rojo: 'FFFFE4E6', rojoTxt: 'FF9F1239'
};
export const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const linea = { style: 'thin', color: { argb: COLOR.borde } };
export const borde = { top: linea, left: linea, bottom: linea, right: linea };
const CENTRO = { horizontal: 'center', vertical: 'middle', wrapText: true };

export const nuevoLibro = async () => {
  const ExcelJS = await cargarExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = EMPRESA; wb.created = new Date();
  return { wb, logo: await logoDataURL() };
};

/** Fecha ISO → Date de Excel (o '' si no hay). */
export const fechaExcel = (iso) => {
  const s = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

const nombresUsados = new WeakMap();
const nombreHoja = (wb, s) => {
  const usados = nombresUsados.get(wb) || new Set(); nombresUsados.set(wb, usados);
  const base = String(s).replace(/[\\/?*[\]:]/g, '-').slice(0, 28).trim() || 'Hoja';
  let n = base, i = 2;
  while (usados.has(n.toUpperCase())) n = `${base.slice(0, 26)} ${i++}`;
  usados.add(n.toUpperCase());
  return n;
};

/**
 * Hoja con encabezado (logo + títulos centrados) y una tabla con TODO centrado y bordes.
 * columnas: [{ t: 'TÍTULO', w: 14, fmt?: 'dd-mm-yyyy' | '"$"#,##0', al?: 'left' }]
 * filas:    arrays de valores (mismo orden que columnas)
 * estiloFila(fila, i) → { fill?, font? } opcional (ej. color por estado)
 * totales:  array de valores para una fila final en negrita (opcional)
 */
export const hojaTabla = (wb, logo, { nombre, titulo, subtitulo = '', columnas, filas, estiloFila = null, totales = null, apaisado = true }) => {
  const ws = wb.addWorksheet(nombreHoja(wb, nombre), {
    views: [{ state: 'frozen', ySplit: 6, showGridLines: false }],
    pageSetup: { orientation: apaisado ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } }
  });
  const n = Math.max(columnas.length, 3);
  columnas.forEach((c, i) => { ws.getColumn(i + 1).width = c.w || 14; });

  // --- Encabezado: logo a la izquierda (fila 1-4) y títulos centrados sobre toda la tabla ---
  ws.getRow(1).height = 28; ws.getRow(2).height = 20; ws.getRow(3).height = 16; ws.getRow(4).height = 8; ws.getRow(5).height = 6;
  if (logo) {
    const id = wb.addImage({ base64: logo.url, extension: 'png' });
    const alto = 60;
    ws.addImage(id, { tl: { col: 0.15, row: 0.15 }, ext: { width: Math.round(Math.min(alto * (logo.ratio || 1), 150)), height: alto }, editAs: 'oneCell' });
  }
  const filaTitulo = (r, texto, font) => {
    ws.mergeCells(r, 1, r, n);
    const c = ws.getCell(r, 1); c.value = texto; c.font = font; c.alignment = { horizontal: 'center', vertical: 'middle' };
  };
  filaTitulo(1, `${EMPRESA} · ${titulo}`, { bold: true, size: 15, color: { argb: COLOR.oscuro } });
  filaTitulo(2, subtitulo, { bold: true, size: 11, color: { argb: COLOR.indigo } });
  filaTitulo(3, `Generado el ${formatDateForDisplay(hoyISO())} ${new Date().toTimeString().slice(0, 5)}`, { italic: true, size: 9, color: { argb: 'FF64748B' } });
  for (let col = 1; col <= n; col++) ws.getCell(4, col).border = { bottom: { style: 'medium', color: { argb: COLOR.indigo } } };

  // --- Encabezados de la tabla ---
  const fH = 6;
  columnas.forEach((c, i) => {
    const cell = ws.getCell(fH, i + 1);
    cell.value = c.t; cell.font = { bold: true, size: 9, color: { argb: COLOR.blanco } };
    cell.fill = fill(COLOR.indigo); cell.alignment = CENTRO; cell.border = borde;
  });
  ws.getRow(fH).height = 30;

  // --- Filas ---
  filas.forEach((vals, i) => {
    const r = fH + 1 + i;
    const extra = estiloFila ? (estiloFila(vals, i) || {}) : {};
    columnas.forEach((c, j) => {
      const cell = ws.getCell(r, j + 1);
      const v = vals[j];
      cell.value = (v === null || v === undefined) ? '' : v;
      if (c.fmt) cell.numFmt = c.fmt;
      cell.alignment = { ...CENTRO, horizontal: c.al || 'center' };
      cell.border = borde;
      cell.font = { size: 9, ...(extra.font || {}), ...(c.bold ? { bold: true } : {}) };
      if (extra.fill) cell.fill = fill(extra.fill);
      else if (i % 2 === 1) cell.fill = fill(COLOR.gris);
    });
    ws.getRow(r).height = 18;
  });

  // --- Totales ---
  if (totales) {
    const r = fH + 1 + filas.length;
    columnas.forEach((c, j) => {
      const cell = ws.getCell(r, j + 1);
      cell.value = totales[j] ?? '';
      if (c.fmt) cell.numFmt = c.fmt;
      cell.alignment = CENTRO; cell.border = borde;
      cell.font = { bold: true, size: 10, color: { argb: COLOR.blanco } }; cell.fill = fill(COLOR.oscuro);
    });
    ws.getRow(r).height = 20;
  }
  if (filas.length) ws.autoFilter = { from: { row: fH, column: 1 }, to: { row: fH + filas.length, column: columnas.length } };
  return ws;
};

/**
 * Bloque de FIRMAS al pie de una hoja hecha con hojaTabla (alineado y simétrico).
 * firmas: [{ nombre: 'IGNACIO NEIRA', cargo: 'JEFE DE OPERACIONES' }, ...]  (1 a 3 firmas)
 * Cada firma ocupa el mismo ancho, centrada en su parte de la hoja:
 *   (espacio para firmar) ─────────── línea · FIRMA · NOMBRE · CARGO
 */
export const bloqueFirmas = (ws, firmas, { separacion = 3 } = {}) => {
  if (!ws || !firmas || !firmas.length) return;
  const n = Math.max(ws.columnCount, firmas.length * 3);
  const ultima = ws.lastRow ? ws.lastRow.number : 6;
  const r0 = ultima + separacion;          // fila del espacio para firmar
  // Las columnas tienen anchos distintos: se eligen por su ANCHO REAL para que cada firma
  // mida lo mismo y quede centrada en su mitad (o tercio) de la hoja.
  const anchos = Array.from({ length: n }, (_, i) => ws.getColumn(i + 1).width || 9);
  const total = anchos.reduce((a, b) => a + b, 0);
  const inicio = []; anchos.reduce((acc, w, i) => { inicio[i] = acc; return acc + w; }, 0);
  const rango = (centro, mitad) => {
    let c1 = null, c2 = null;
    anchos.forEach((w, i) => { const m = inicio[i] + w / 2; if (m >= centro - mitad && m <= centro + mitad) { if (c1 === null) c1 = i + 1; c2 = i + 1; } });
    if (c1 === null) { const i = anchos.findIndex((w, j) => inicio[j] + w >= centro); c1 = c2 = i + 1; }
    return [c1, c2];
  };

  ws.getRow(r0).height = 50;               // espacio para la firma
  ws.getRow(r0 + 1).height = 14;
  ws.getRow(r0 + 2).height = 18;
  ws.getRow(r0 + 3).height = 15;

  firmas.forEach((f, i) => {
    const centro = total * (2 * i + 1) / (2 * firmas.length);
    const [c1, c2] = rango(centro, total / firmas.length * 0.3);   // cada firma ≈ 60% de su parte
    const fila = (r, valor, font, extra = {}) => {
      ws.mergeCells(r, c1, r, c2);
      const cell = ws.getCell(r, c1);
      cell.value = valor;
      cell.font = font;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      Object.assign(cell, extra);
    };
    // línea de firma (borde superior de toda la franja) + rótulo FIRMA
    fila(r0 + 1, 'FIRMA', { bold: true, size: 8, color: { argb: 'FF64748B' } });
    for (let c = c1; c <= c2; c++) ws.getCell(r0 + 1, c).border = { top: { style: 'medium', color: { argb: COLOR.oscuro } } };
    fila(r0 + 2, String(f.nombre || '').toUpperCase(), { bold: true, size: 11, color: { argb: COLOR.oscuro } });
    fila(r0 + 3, String(f.cargo || '').toUpperCase(), { bold: true, size: 9, color: { argb: COLOR.indigo } });
  });
};

/** Firmas que van en los programas de mantención exportados. */
export const FIRMAS_PROGRAMA = [
  { nombre: 'IGNACIO NEIRA', cargo: 'JEFE DE OPERACIONES' },
  { nombre: 'BRANDON PÉREZ', cargo: 'JEFE SERVICIO TÉCNICO' }
];

export const descargarLibro = async (wb, archivo) => {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = archivo.replace(/[\\/:*?"<>|]/g, '-');
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
};

// =====================================================================
// HOJA "INICIO" CON DASHBOARD (KPI + gráficos como imagen + tablas resumen)
// ---------------------------------------------------------------------
// Los gráficos se dibujan con Chart.js en un canvas oculto y se insertan como imagen PNG.
//   (llamarla ANTES de crear las otras hojas para que quede primera)
//   hojaDashboard(wb, logo, { nombre: 'Inicio', titulo, subtitulo,
//     kpis:     [{ t: 'EQUIPOS', v: 12, sub: 'asignados', color: 'indigo'|'verde'|'ambar'|'rojo'|'gris' }],
//     graficos: [{ titulo: 'Avance', cfg: { type, data, options } }],   // 2 por fila
//     tablas:   [{ titulo, columnas: [{ t, w? }], filas: [[...]] }] })
// =====================================================================
const COLS_DASH = 12;

/** Dibuja un gráfico de Chart.js fuera de pantalla y devuelve su PNG (dataURL) o null. */
export const graficoPNG = async (cfg, ancho = 720, alto = 400) => {
  if (!window.Chart) return null;
  const cont = document.createElement('div');
  cont.style.cssText = `position:fixed;left:-10000px;top:0;width:${ancho}px;height:${alto}px;`;
  const canvas = document.createElement('canvas');
  canvas.width = ancho; canvas.height = alto;
  cont.appendChild(canvas); document.body.appendChild(cont);
  const fondo = { id: 'fondoBlanco', beforeDraw: (ch) => { const c = ch.ctx; c.save(); c.fillStyle = '#ffffff'; c.fillRect(0, 0, ch.width, ch.height); c.restore(); } };
  let chart = null;
  try {
    const o = cfg.options || {};
    chart = new window.Chart(canvas, {
      ...cfg,
      options: { ...o, responsive: false, animation: false, devicePixelRatio: 2,
        plugins: { ...(o.plugins || {}), legend: { position: 'bottom', ...((o.plugins || {}).legend || {}) } } },
      plugins: [...(cfg.plugins || []), fondo]
    });
    return chart.toBase64Image('image/png', 1);
  } catch (e) { console.warn('[Excel] No se pudo dibujar el gráfico', e); return null; }
  finally { if (chart) chart.destroy(); cont.remove(); }
};

const TONO = {
  indigo: { f: COLOR.indigoClaro, t: COLOR.indigo }, verde: { f: COLOR.verde, t: COLOR.verdeTxt },
  ambar: { f: COLOR.ambar, t: COLOR.ambarTxt }, rojo: { f: COLOR.rojo, t: COLOR.rojoTxt }, gris: { f: COLOR.gris, t: COLOR.oscuro }
};

export const hojaDashboard = async (wb, logo, { nombre = 'Inicio', titulo, subtitulo = '', kpis = [], graficos = [], tablas = [] }) => {
  const ws = wb.addWorksheet(nombreHoja(wb, nombre), {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } }
  });
  for (let c = 1; c <= COLS_DASH; c++) ws.getColumn(c).width = 11;
  const PX_COL = 82, PX_FILA = 20;   // ancho aprox. de una columna (11) y alto de una fila de 15 pt

  // Encabezado (igual que hojaTabla)
  ws.getRow(1).height = 28; ws.getRow(2).height = 20; ws.getRow(3).height = 16; ws.getRow(4).height = 8;
  if (logo) {
    const id = wb.addImage({ base64: logo.url, extension: 'png' });
    ws.addImage(id, { tl: { col: 0.15, row: 0.15 }, ext: { width: Math.round(Math.min(60 * (logo.ratio || 1), 150)), height: 60 }, editAs: 'oneCell' });
  }
  const filaTitulo = (r, texto, font) => {
    ws.mergeCells(r, 1, r, COLS_DASH);
    const c = ws.getCell(r, 1); c.value = texto; c.font = font; c.alignment = { horizontal: 'center', vertical: 'middle' };
  };
  filaTitulo(1, `${EMPRESA} · ${titulo}`, { bold: true, size: 15, color: { argb: COLOR.oscuro } });
  filaTitulo(2, subtitulo, { bold: true, size: 11, color: { argb: COLOR.indigo } });
  filaTitulo(3, `Generado el ${formatDateForDisplay(hoyISO())} ${new Date().toTimeString().slice(0, 5)}`, { italic: true, size: 9, color: { argb: 'FF64748B' } });
  for (let c = 1; c <= COLS_DASH; c++) ws.getCell(4, c).border = { bottom: { style: 'medium', color: { argb: COLOR.indigo } } };

  let r = 6;
  const tituloSeccion = (texto) => {
    ws.mergeCells(r, 1, r, COLS_DASH);
    const c = ws.getCell(r, 1);
    c.value = texto; c.font = { bold: true, size: 11, color: { argb: COLOR.blanco } }; c.fill = fill(COLOR.oscuro);
    c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    ws.getRow(r).height = 20; r += 1;
  };

  // --- KPI: 6 tarjetas por fila, cada una de 2 columnas × 3 filas ---
  if (kpis.length) {
    tituloSeccion('INDICADORES (KPI)');
    r += 1;
    for (let i = 0; i < kpis.length; i += 6) {
      kpis.slice(i, i + 6).forEach((k, j) => {
        const c1 = j * 2 + 1, c2 = c1 + 1, tn = TONO[k.color] || TONO.indigo;
        const celda = (fila, valor, font, h) => {
          ws.mergeCells(fila, c1, fila, c2);
          const c = ws.getCell(fila, c1);
          c.value = valor; c.font = font; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          for (let cc = c1; cc <= c2; cc++) ws.getCell(fila, cc).fill = fill(tn.f);
          if (h) ws.getRow(fila).height = h;
        };
        celda(r, String(k.t || '').toUpperCase(), { bold: true, size: 8, color: { argb: tn.t } }, 18);
        celda(r + 1, k.v ?? '-', { bold: true, size: 20, color: { argb: tn.t } }, 32);
        celda(r + 2, k.sub || '', { size: 8, italic: true, color: { argb: 'FF475569' } }, 16);
        if (k.fmt) ws.getCell(r + 1, c1).numFmt = k.fmt;
        const ln = { style: 'thin', color: { argb: tn.t } };
        for (let fr = r; fr <= r + 2; fr++) {
          ws.getCell(fr, c1).border = { ...(ws.getCell(fr, c1).border || {}), left: ln, ...(fr === r ? { top: ln } : {}), ...(fr === r + 2 ? { bottom: ln } : {}) };
          ws.getCell(fr, c2).border = { ...(ws.getCell(fr, c2).border || {}), right: ln, ...(fr === r ? { top: ln } : {}), ...(fr === r + 2 ? { bottom: ln } : {}) };
        }
      });
      r += 4;
    }
  }

  // --- Gráficos: 2 por fila (6 columnas cada uno) ---
  const imgs = [];
  for (const g of graficos) imgs.push({ ...g, png: await graficoPNG(g.cfg, g.ancho || 720, g.alto || 400) });
  const validos = imgs.filter(g => g.png);
  if (validos.length) {
    tituloSeccion('GRÁFICOS');
    r += 1;
    const FILAS_G = 14;
    for (let i = 0; i < validos.length; i += 2) {
      validos.slice(i, i + 2).forEach((g, j) => {
        const c1 = j * 6 + 1;
        ws.mergeCells(r, c1, r, c1 + 5);
        const t = ws.getCell(r, c1);
        t.value = g.titulo || ''; t.font = { bold: true, size: 10, color: { argb: COLOR.indigo } }; t.alignment = { horizontal: 'center', vertical: 'middle' };
        const id = wb.addImage({ base64: g.png, extension: 'png' });
        const ancho = PX_COL * 6 - 16;
        ws.addImage(id, { tl: { col: c1 - 1 + 0.1, row: r }, ext: { width: ancho, height: Math.round(ancho * (g.alto || 400) / (g.ancho || 720)) }, editAs: 'oneCell' });
      });
      for (let k = r + 1; k <= r + FILAS_G; k++) ws.getRow(k).height = 15;
      r += FILAS_G + 1;
    }
  }

  // --- Tablas resumen ---
  tablas.forEach(tb => {
    if (!tb.filas || !tb.filas.length) return;
    tituloSeccion(tb.titulo);
    const n = tb.columnas.length;
    // reparte las 12 columnas entre las de la tabla (la primera se lleva el sobrante)
    const base = Math.floor(COLS_DASH / n), extra = COLS_DASH - base * n;
    const span = tb.columnas.map((_, i) => base + (i === 0 ? extra : 0));
    const ini = []; span.reduce((a, s, i) => { ini[i] = a; return a + s; }, 1);
    const fila = (valores, estilo) => {
      valores.forEach((v, i) => {
        if (span[i] > 1) ws.mergeCells(r, ini[i], r, ini[i] + span[i] - 1);
        const c = ws.getCell(r, ini[i]);
        c.value = v ?? ''; c.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle', wrapText: true, indent: i === 0 ? 1 : 0 };
        if (tb.columnas[i].fmt) c.numFmt = tb.columnas[i].fmt;
        for (let cc = ini[i]; cc < ini[i] + span[i]; cc++) { const x = ws.getCell(r, cc); x.border = borde; if (estilo.fill) x.fill = fill(estilo.fill); }
        c.font = estilo.font;
      });
      ws.getRow(r).height = 18; r += 1;
    };
    fila(tb.columnas.map(c => c.t), { fill: COLOR.indigo, font: { bold: true, size: 9, color: { argb: COLOR.blanco } } });
    tb.filas.forEach((f, i) => fila(f, { fill: i % 2 ? COLOR.gris : null, font: { size: 9 } }));
    if (tb.total) fila(tb.total, { fill: COLOR.oscuro, font: { bold: true, size: 9, color: { argb: COLOR.blanco } } });
    r += 1;
  });

  return ws;
};
