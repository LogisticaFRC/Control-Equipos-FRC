// =====================================================================
// CHOFER · PDF del Check list / Report Camión Pluma (2026-11-17)
// Dibuja con jsPDF la misma hoja del formato FRC-RE-OPE-018 (logo, datos, check list, report,
// observaciones y firmas) en una página carta, la GUARDA en Supabase
// (storage choferes/pdf/… y datos.pdf_url vía RPC frc_chofer_pdf) y la ABRE para verla
// (no se descarga). Se regenera si cambió algo (ej. firma del supervisor).
// =====================================================================
import { ITEMS_CHECK, N_ACTIVIDADES_CHOFER, formatoDe } from './chofer.service.js';
import { formatDateForDisplay } from '../../core/utils.js';
import { supabaseClient, subirArchivoStorage, errMsg } from '../../core/supabase.js';

const fF = (d) => (d ? formatDateForDisplay(d) : '');
const url = (p) => new URL(p, window.location.href).href;

// ---------- PDF real (se guarda en Supabase y se abre para ver) ----------
const LIBS = { jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js' };
const cargas = {};
const cargarScript = (src) => (cargas[src] = cargas[src] || new Promise((ok, mal) => {
  const s = document.createElement('script'); s.src = src; s.onload = ok;
  s.onerror = () => { delete cargas[src]; mal(new Error('No se pudo cargar el generador de PDF (revisa la conexión).')); };
  document.head.appendChild(s);
}));
const cargarLibs = async () => { if (!window.jspdf) await cargarScript(LIBS.jspdf); };

/** Firma de lo que está en el PDF: si cambia (ej. firma del supervisor) se vuelve a generar. */
export const versionPdf = (r) => [r.id, r.sup_firma ? 'S1' : 'S0', String(r.sup_nombre || ''), String(r.firma || '').length].join('|');

/** Imagen del sistema → dataURL (para ponerla en el PDF). */
const imgCache = {};
const imagenDataUrl = (ruta) => (imgCache[ruta] = imgCache[ruta] || fetch(url(ruta)).then(r => (r.ok ? r.blob() : null))
  .then(b => (b ? new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); }) : null)).catch(() => null));

/** Genera el PDF (Blob) dibujando el formato FRC-RE-OPE-018 con jsPDF (vectorial, carta vertical, 1 página). */
export const generarPdfBlob = async (r) => {
  await cargarLibs();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  const VERDE = [0, 166, 81], ROJO = [200, 0, 0];
  const fm = formatoDe(r);
  const [logo, camion] = await Promise.all([imagenDataUrl('plantillas/img/logo-frc-formato.png'), imagenDataUrl('plantillas/img/camion-pluma.jpg')]);
  doc.setLineWidth(0.25); doc.setDrawColor(0);
  /** Texto que se achica para caber en el ancho. al: 'left' | 'center' | 'right' */
  const txt = (t, x, y, w, { size = 8, bold = false, al = 'left', color = [0, 0, 0], min = 4.5 } = {}) => {
    t = String(t ?? ''); if (!t) return;
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(...color);
    let s = size; doc.setFontSize(s);
    while (s > min && doc.getTextWidth(t) > w - 1) { s -= 0.25; doc.setFontSize(s); }
    while (doc.getTextWidth(t) > w - 1 && t.length > 1) t = t.slice(0, -1);
    const xx = al === 'center' ? x + w / 2 : al === 'right' ? x + w - 0.5 : x + 0.5;
    doc.text(t, xx, y, { align: al, baseline: 'middle' });
  };
  const caja = (x, y, w, h, fill = null, lw = 0.25) => { doc.setLineWidth(lw); if (fill) { doc.setFillColor(...fill); doc.rect(x, y, w, h, 'FD'); } else doc.rect(x, y, w, h); };
  const celda = (x, y, w, h, t, o = {}) => { caja(x, y, w, h, o.fill || null); txt(t, x, y + h / 2, w, o); };

  // --- Encabezado ---
  if (logo) doc.addImage(logo, 'PNG', 8, 8, 40, 12.9);
  caja(52, 8, 118, 14, VERDE, 0.6); txt('Check list/Report ' + (fm.titulo === 'Camión pluma' ? 'Camion Pluma' : fm.titulo), 52, 15, 118, { size: 17, bold: true, al: 'center', color: [255, 255, 255] });
  [fm.codigo, '1/7/2026', 'REV: 0'].forEach((t, k) => celda(172, 8 + k * 4.67, 36, 4.67, t, { fill: VERDE, size: 7, bold: true, al: 'center', color: [255, 255, 255] }));

  // --- Datos ---
  const dato = (lbl, val, x, w) => { txt(lbl, x, 28, 16, { size: 8, bold: true }); txt(val, x + 15, 27.5, w - 16, { size: 9 }); doc.setLineWidth(0.2); doc.line(x + 15, 29.5, x + w - 2, 29.5); };
  dato('Patente:', r.patente, 8, 50); dato('Marca:', r.marca, 58, 50); dato('Modelo:', r.modelo, 108, 50); dato('Fecha:', fF(r.fecha), 158, 50);

  // --- Vencimientos / Camión / Pluma / imagen ---
  const y0 = 34;
  txt('Fecha Vencimiento', 8, y0 + 1.5, 36, { size: 7, bold: true }); txt('Revisión Técnica:', 8, y0 + 5, 36, { size: 7, bold: true });
  // En el documento va solo la fecha (el aviso de vencido se ve en el sistema)
  txt(fF(r.venc_revision), 8, y0 + 10, 36, { size: 8.5, al: 'center' });
  doc.line(9, y0 + 12.5, 43, y0 + 12.5);
  txt('Permiso circulación:', 8, y0 + 16, 36, { size: 7, bold: true });
  txt(fF(r.venc_permiso), 8, y0 + 21, 36, { size: 8.5, al: 'center' });
  doc.line(9, y0 + 23.5, 43, y0 + 23.5);
  caja(46, y0, 82, 25, null, 0.6); celda(46, y0, 82, 4.5, 'Camión', { fill: VERDE, size: 7.5, bold: true, al: 'center', color: [255, 255, 255] });
  [['Hrs. Inicio:', r.cam_hrs_ini, 'Km. Inicio:', r.km_ini], ['Hrs. Término:', r.cam_hrs_fin, 'Km Término:', r.km_fin], ['Hrs. Prox. Mant:', r.cam_hrs_prox, 'Km. Prox. Mant:', r.km_prox]]
    .forEach(([a, b, c, d], k) => { const yy = y0 + 8.5 + k * 6.3; txt(a, 46, yy, 21, { size: 6.8, bold: true, al: 'right' }); txt(b, 67, yy, 18, { size: 8.5 }); txt(c, 86, yy, 22, { size: 6.8, bold: true, al: 'right' }); txt(d, 108, yy, 20, { size: 8.5 }); });
  doc.setLineWidth(0.6); doc.line(86, y0 + 4.5, 86, y0 + 25);
  caja(131, y0, 42, 25, null, 0.6); celda(131, y0, 42, 4.5, 'Pluma', { fill: VERDE, size: 7.5, bold: true, al: 'center', color: [255, 255, 255] });
  [['Hrs. Inicio:', r.pluma_hrs_ini], ['Hrs. Término:', r.pluma_hrs_fin], ['Prox. Mant:', r.pluma_prox_fecha ? fF(r.pluma_prox_fecha) : (r.pluma_hrs_prox || '')]]
    .forEach(([a, b], k) => { const yy = y0 + 8.5 + k * 6.3; txt(a, 131, yy, 18, { size: 6.8, bold: true, al: 'right' }); txt(b, 149, yy, 24, { size: 8.5 }); });
  if (camion) doc.addImage(camion, 'JPEG', 176, y0 - 1, 30, 30);

  // --- Check list (2 tablas) ---
  const yC = 63, hF = 4.05;
  const tabla = (x, lado) => {
    const W = [7, 59, 11, 11, 11]; const wT = 99;
    celda(x, yC, wT, 5, 'Check List', { fill: VERDE, size: 10, bold: true, al: 'center', color: [255, 255, 255] });
    let xx = x; ['SISTEMA', 'BUENO', 'MALO', 'N/A'].forEach((t, k) => { const w = k === 0 ? W[0] + W[1] : W[k + 1]; celda(xx, yC + 5, w, 3.8, t, { fill: VERDE, size: 6, bold: true, al: 'center', color: [255, 255, 255] }); xx += w; });
    let y = yC + 8.8;
    const items = ITEMS_CHECK.filter(i => i.lado === lado);
    [...new Set(items.map(i => i.grupo))].forEach(g => {
      const its = items.filter(i => i.grupo === g);
      caja(x, y, W[0], its.length * hF, VERDE);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.setFontSize(its.length > 3 ? 6.5 : 5);
      const wG = doc.getTextWidth(g);
      doc.text(g, x + W[0] / 2 + 0.9, y + its.length * hF / 2 + wG / 2, { angle: 90 });
      its.forEach(it => {
        const v = (r.checklist || {})[it.k];
        celda(x + W[0], y, W[1], hF, it.texto, { size: 6.5, bold: true, al: 'center' });
        celda(x + W[0] + W[1], y, W[2], hF, v === 'B' ? 'X' : '', { size: 8, bold: true, al: 'center' });
        celda(x + W[0] + W[1] + W[2], y, W[3], hF, v === 'M' ? 'X' : '', { size: 8, bold: true, al: 'center', color: ROJO });
        celda(x + W[0] + W[1] + W[2] + W[3], y, W[4], hF, v === 'NA' ? 'X' : '', { size: 8, bold: true, al: 'center' });
        y += hF;
      });
    });
    return y;
  };
  const fin = Math.max(tabla(8, 'I'), tabla(109, 'D'));

  // --- Report ---
  const yR = fin + 3;
  celda(8, yR, 200, 5, 'REPORT', { fill: VERDE, size: 9, bold: true, al: 'center', color: [255, 255, 255] });
  const RC = [['N°', 8], ['', 16], ['Traslado', 20], ['Equipo', 34], ['Afi', 14], ['C/u', 9], ['Desde', 33], ['Hasta', 33], ['Hora Inicio', 16.5], ['Hora Término', 16.5]];
  let xx = 8; RC.forEach(([t, w]) => { celda(xx, yR + 5, w, 4.2, t, { fill: VERDE, size: 6.5, bold: true, al: 'center', color: [255, 255, 255] }); xx += w; });
  const corto = (t) => String(t || '').split(' / ').pop().trim();
  for (let k = 0; k < N_ACTIVIDADES_CHOFER; k++) {
    const a = (r.actividades || [])[k] || null; const y = yR + 9.2 + k * 5.6;
    const vals = [String(k + 1), 'Actividad', a?.traslado, a ? (a.equipo || a.tipo_equipo || '') + (a.subarrendado ? ' (SUBARR.)' : '') : '', a?.afi, a?.cu, a ? corto(a.desde) : '', a ? corto(a.hasta) : '', a?.h_ini, a?.h_fin];
    xx = 8; RC.forEach(([, w], c) => { celda(xx, y, w, 5.6, vals[c], { size: 7, bold: c <= 1, al: [0, 4, 5, 8, 9].includes(c) ? 'center' : 'left' }); xx += w; });
  }

  // --- Observaciones ---
  const yO = yR + 9.2 + N_ACTIVIDADES_CHOFER * 5.6 + 4;
  txt('Observaciones:', 8, yO, 40, { size: 8.5, bold: true });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(0);
  const lineas = doc.splitTextToSize(String(r.observaciones || ''), 196).slice(0, 3);
  for (let k = 0; k < 3; k++) { const y = yO + 4.5 + k * 4.4; if (lineas[k]) doc.text(lineas[k], 9, y); doc.setLineWidth(0.15); doc.line(8, y + 1, 208, y + 1); }

  // --- Firmas ---
  const yF = yO + 20;
  const firma = (img, titulo, nombre, x) => {
    if (img && String(img).startsWith('data:image')) doc.addImage(img, 'PNG', x + 21, yF, 48, 16);
    doc.setLineWidth(0.3); doc.line(x, yF + 17, x + 90, yF + 17);
    txt(titulo, x, yF + 19.5, 90, { size: 7.5, al: 'center' });
    txt(nombre, x, yF + 23, 90, { size: 8, bold: true, al: 'center' });
  };
  firma(r.firma, 'Firma chofer', String(r.chofer || r.usuario || '').toUpperCase(), 10);
  firma(r.sup_firma, 'Firma supervisor', r.sup_firma ? String(r.sup_nombre || '').toUpperCase() : '(pendiente)', 116);
  return doc.output('blob');
};

/** Sube el PDF a Supabase y guarda su URL en el check list (RPC frc_chofer_pdf). Devuelve la URL. */
export const guardarPdf = async (r, blob) => {
  const nombre = `choferes/pdf/CHECKLIST_${String(r.patente || '').replace(/[^A-Z0-9-]/gi, '')}_${r.fecha || ''}_${r.id}_${Date.now()}.pdf`;
  const url = await subirArchivoStorage(nombre, new File([blob], nombre.split('/').pop(), { type: 'application/pdf' }));
  const { error } = await supabaseClient.rpc('frc_chofer_pdf', { p_id: r.id, p_url: url, p_version: versionPdf(r) });
  if (error) console.warn('[Chofer] PDF subido pero no se guardó la URL:', errMsg(error));
  r.pdf_url = url; r.pdf_version = versionPdf(r);
  return url;
};

/** Abre el PDF del check list (sin descargarlo). Si no existe o está desactualizado, lo genera y lo guarda.
 *  ventana: pestaña abierta antes (al tocar el botón) para que el navegador no la bloquee. */
export const abrirPdfChecklist = async (r, ventana = null) => {
  const w = ventana || window.open('', '_blank');
  const mostrar = (url) => { if (w && !w.closed) w.location.href = url; else window.open(url, '_blank'); };
  if (w && !w.closed) { try { w.document.write('<p style="font:16px sans-serif;padding:24px">Generando el PDF del check list…</p>'); } catch (_) { /* */ } }
  try {
    if (r.pdf_url && r.pdf_version === versionPdf(r)) return mostrar(r.pdf_url);
    const blob = await generarPdfBlob(r);
    let url = '';
    try { url = await guardarPdf(r, blob); } catch (err) { console.warn('[Chofer] No se pudo guardar el PDF en Supabase:', errMsg(err)); }
    mostrar(url || URL.createObjectURL(blob));
  } catch (err) {
    if (w && !w.closed) w.close();
    alert('No se pudo generar el PDF: ' + (err.message || err));
  }
};

