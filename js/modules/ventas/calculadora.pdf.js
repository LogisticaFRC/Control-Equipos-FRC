// =====================================================================
// CALCULADORA DE ARRIENDO · Informe PDF con formato FRC (2026-11-25)
// Dibuja con jsPDF (vectorial, carta vertical): encabezado FRC, datos de la cotización,
// resumen de precio, croquis de la ruta con sus peajes, detalle de costos, peajes y
// "Supuestos y fuentes". Se DESCARGA el archivo. Solo Admin general.
// =====================================================================
import { form, params, resultado, supuestos, tipoSel, pasadasDe, fmtN, MODALIDADES, num } from './calculadora.service.js';
import { soloAdminGeneral } from '../../core/store.js';
import { hoyISO } from '../../core/utils.js';

const JSPDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
let carga = null;
const cargarJsPDF = () => (window.jspdf ? Promise.resolve() : (carga = carga || new Promise((ok, mal) => {
  const s = document.createElement('script'); s.src = JSPDF; s.onload = ok;
  s.onerror = () => { carga = null; mal(new Error('No se pudo cargar el generador de PDF (revisa la conexión).')); };
  document.head.appendChild(s);
})));
const logoDataUrl = () => fetch(new URL('plantillas/img/logo-frc-formato.png', window.location.href).href)
  .then(r => (r.ok ? r.blob() : null))
  .then(b => (b ? new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); }) : null)).catch(() => null);

const VERDE = [20, 154, 62], OSCURO = [14, 26, 20], GRIS = [100, 116, 139], CLARO = [232, 245, 236], AMBAR = [245, 158, 11];
const $ = (v) => '$' + fmtN(Math.round(num(v)));
// jsPDF (Helvetica) solo trae caracteres latinos: se reemplazan los que no imprime
const limpio = (s) => String(s ?? '').replace(/[−–—]/g, '-').replace(/→/g, '->').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, '...').replace(/[^\x00-\xFF]/g, '');
const fechaCL = (iso) => { const [y, m, d] = String(iso || hoyISO()).slice(0, 10).split('-'); return `${d}-${m}-${y}`; };

export const exportarCotizacionPDF = async () => {
  if (!soloAdminGeneral()) return;
  await cargarJsPDF();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  const W = 215.9, H = 279.4, M = 12, AN = W - 2 * M;
  const logo = await logoDataUrl();
  const r = resultado.value, t = tipoSel.value || {}, ejes2 = t.ejes === '2';
  const mod = (MODALIDADES.find(m => m.k === form.modalidad) || {}).l || form.modalidad;

  const txt = (s, x, y, w, { size = 8, bold = false, al = 'left', color = [0, 0, 0], min = 5 } = {}) => {
    s = limpio(s); if (!s) return;
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(...color);
    let z = size; doc.setFontSize(z);
    while (z > min && doc.getTextWidth(s) > w - 1) { z -= 0.25; doc.setFontSize(z); }
    while (doc.getTextWidth(s) > w - 1 && s.length > 1) s = s.slice(0, -1);
    doc.text(s, al === 'center' ? x + w / 2 : al === 'right' ? x + w - 0.8 : x + 0.8, y, { align: al, baseline: 'middle' });
  };
  /** Texto en varias líneas (devuelve el alto usado). */
  const parrafo = (s, x, y, w, size = 7, color = [0, 0, 0], bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
    const ls = doc.splitTextToSize(limpio(s), w - 1.6); doc.text(ls, x + 0.8, y, { baseline: 'top' }); return ls.length * size * 0.42;
  };
  const rect = (x, y, w, h, fill, stroke = true) => { if (fill) doc.setFillColor(...fill); doc.setDrawColor(200, 205, 210); doc.setLineWidth(0.2); doc.rect(x, y, w, h, fill ? (stroke ? 'FD' : 'F') : 'S'); };

  // ---------- Encabezado y pie (en cada página) ----------
  const encabezado = (titulo) => {
    if (logo) doc.addImage(logo, 'PNG', M, 8, 40, 12.9);
    rect(M + 43, 8, AN - 43 - 40, 13, VERDE, false);
    txt(titulo, M + 43, 14.5, AN - 43 - 40, { size: 13, bold: true, al: 'center', color: [255, 255, 255] });
    rect(W - M - 38, 8, 38, 13, OSCURO, false);
    txt('Fecha: ' + fechaCL(form.fecha), W - M - 38, 11.5, 38, { size: 7, bold: true, al: 'center', color: [255, 255, 255] });
    txt(form.id ? 'Cotización N° ' + form.id : 'Cotización (no guardada)', W - M - 38, 17.5, 38, { size: 6.5, al: 'center', color: [255, 255, 255] });
    return 25;
  };
  const pie = () => {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setDrawColor(...VERDE); doc.setLineWidth(0.5); doc.line(M, H - 12, W - M, H - 12);
      txt('FAST RENTAL CHILE · Calculadora de arriendo (SISTEMA FRC) · Valores referenciales, sujetos a confirmación', M, H - 8.5, AN - 25, { size: 6.5, color: GRIS });
      txt(`Pág. ${i} de ${n}`, W - M - 25, H - 8.5, 25, { size: 6.5, al: 'right', color: GRIS });
    }
  };
  const titulo = (s, y) => { rect(M, y, AN, 5.5, OSCURO, false); txt(s, M + 1, y + 2.8, AN - 2, { size: 8, bold: true, color: [255, 255, 255] }); return y + 7; };

  // ---------- Tabla con salto de página ----------
  let y = encabezado('COTIZACIÓN DE ARRIENDO · CAMIÓN');
  const tabla = (cols, filas, { estilo = null, cab = true, titulo: tt = '' } = {}) => {
    const hCab = 5.5;
    const dibujaCab = () => { let x = M; cols.forEach(c => { rect(x, y, c.w, hCab, VERDE); txt(c.t, x, y + hCab / 2, c.w, { size: 7, bold: true, al: c.al || 'left', color: [255, 255, 255] }); x += c.w; }); y += hCab; };
    if (cab) dibujaCab();
    filas.forEach((f, i) => {
      const e = (estilo && estilo(f, i)) || {};
      // alto según el texto más largo (columnas con wrap)
      doc.setFontSize(7); const lineas = cols.map((c, k) => (c.wrap ? doc.splitTextToSize(String(f[k] ?? ''), c.w - 1.6).length : 1));
      const h = Math.max(5, Math.max(...lineas) * 3 + 2);
      if (y + h > H - 16) { doc.addPage(); y = encabezado(tt || 'COTIZACIÓN DE ARRIENDO · CAMIÓN'); if (cab) dibujaCab(); }
      let x = M;
      cols.forEach((c, k) => {
        rect(x, y, c.w, h, e.fill || (i % 2 ? [248, 250, 252] : [255, 255, 255]));
        if (c.wrap) parrafo(f[k], x, y + 1.2, c.w, 7, e.color || [0, 0, 0], !!e.bold);
        else txt(f[k], x, y + h / 2, c.w, { size: 7.3, bold: !!e.bold || c.bold, al: c.al || 'left', color: e.color || [0, 0, 0] });
        x += c.w;
      });
      y += h;
    });
    y += 3;
  };
  const asegurar = (h) => { if (y + h > H - 16) { doc.addPage(); y = encabezado('COTIZACIÓN DE ARRIENDO · CAMIÓN'); } };

  // ---------- Datos de la cotización ----------
  y = titulo('DATOS DE LA COTIZACIÓN', y);
  const ruta = form.ruta;
  const datos = [
    ['Cotización', form.nombre || '—', 'Cliente', form.cliente || '—'],
    ['Tipo de camión', `${form.tipo || '—'}${form.afi ? ' · AFI ' + form.afi : ''} (${ejes2 ? '2 ejes' : 'más de 2 ejes'})`, 'Modalidad', mod],
    ['Origen', form.origen || '—', 'Destino', form.destino || '—'],
    ['Distancia', `${fmtN(r.km)} km totales${ruta ? ' · ' + fmtN(ruta.km, 1) + ' km de ida' : ''}`, 'Servicio', `${fmtN(r.dias)} día(s) · ${fmtN(num(form.viajes))} viaje(s)${form.idaVuelta ? ' ida y vuelta' : ' solo ida'}`],
    ['Personal', [form.conChofer ? 'Con chofer' : 'Sin chofer', form.conRigger ? 'con rigger' : ''].filter(Boolean).join(', '), 'Diésel', `${fmtN(r.litros)} L estimados`]
  ];
  const cw = [26, AN / 2 - 26, 22, AN / 2 - 22];
  datos.forEach(f => { let x = M; f.forEach((v, k) => { rect(x, y, cw[k], 5.5, k % 2 ? null : CLARO); txt(v, x, y + 2.8, cw[k], { size: 7.5, bold: k % 2 === 0 }); x += cw[k]; }); y += 5.5; });
  y += 3;

  // ---------- Resumen de precio ----------
  const cajas = [['PRECIO NETO', $(r.neto), VERDE], [`IVA (${r.pcts.iva}%)`, $(r.iva), GRIS], ['TOTAL CON IVA', $(r.total), OSCURO]];
  const extra = [r.porDia ? `Por día: ${$(r.porDia)} neto` : '', r.porKm ? `Por km: ${$(r.porKm)} neto` : '', r.porViaje ? `Por viaje: ${$(r.porViaje)} neto` : ''].filter(Boolean).join('   ·   ');
  const wc = (AN - 6) / 3;
  cajas.forEach(([a, b, c], i) => { const x = M + i * (wc + 3); rect(x, y, wc, 14, c, false); txt(a, x, y + 4, wc, { size: 7, bold: true, al: 'center', color: [255, 255, 255] }); txt(b, x, y + 9.5, wc, { size: 13, bold: true, al: 'center', color: [255, 255, 255] }); });
  y += 16; if (extra) { txt(extra, M, y + 1.5, AN, { size: 7.5, al: 'center', color: GRIS }); y += 5; }
  y += 1;

  // ---------- Ruta (croquis) + peajes ----------
  const peajes = params.peajes.filter(p => pasadasDe(p.id)).map(p => { const tar = num(ejes2 ? p.c2 : p.c3), pas = pasadasDe(p.id); return { p, tar, pas, sub: tar * pas }; });
  const linea = (ruta && ruta.linea) || [];
  if (linea.length > 1 || peajes.length) {
    asegurar(70);
    y = titulo('RUTA Y PEAJES', y);
    const y0 = y, wm = 70, hm = 62;
    rect(M, y0, wm, hm, [246, 248, 247]);
    if (linea.length > 1) {
      const pts = [...linea, ...peajes.filter(x => x.p.lat != null).map(x => [x.p.lng, x.p.lat])];
      const lat0 = linea.reduce((s, c) => s + c[1], 0) / linea.length, k = Math.cos(lat0 * Math.PI / 180);
      let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
      pts.forEach(c => { const X = c[0] * k, Y = c[1]; x1 = Math.min(x1, X); x2 = Math.max(x2, X); y1 = Math.min(y1, Y); y2 = Math.max(y2, Y); });
      const esc = Math.min((wm - 10) / Math.max(x2 - x1, 1e-6), (hm - 10) / Math.max(y2 - y1, 1e-6));
      const ox = M + (wm - (x2 - x1) * esc) / 2, oy = y0 + (hm - (y2 - y1) * esc) / 2;
      const P = (c) => [ox + (c[0] * k - x1) * esc, oy + (y2 - c[1]) * esc];
      doc.setDrawColor(...VERDE); doc.setLineWidth(1.1);
      for (let i = 1; i < linea.length; i++) { const a = P(linea[i - 1]), b = P(linea[i]); doc.line(a[0], a[1], b[0], b[1]); }
      peajes.forEach((x, i) => { if (x.p.lat == null) return; const c = P([x.p.lng, x.p.lat]); doc.setFillColor(...AMBAR); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.3); doc.circle(c[0], c[1], 1.9, 'FD'); txt(String(i + 1), c[0] - 2, c[1] + 0.1, 4, { size: 5.5, bold: true, al: 'center' }); });
      const pin = (c, s, col) => { const q = P(c); doc.setFillColor(...col); doc.circle(q[0], q[1], 2.4, 'F'); txt(s, q[0] - 2.4, q[1] + 0.1, 4.8, { size: 6.5, bold: true, al: 'center', color: [255, 255, 255] }); };
      pin(linea[0], 'A', OSCURO); pin(linea[linea.length - 1], 'B', VERDE);
      txt('Croquis de la ruta (OpenStreetMap / OSRM)', M, y0 + hm - 2.5, wm, { size: 5.5, color: GRIS, al: 'center' });
    } else txt('Ruta no calculada', M, y0 + hm / 2, wm, { size: 8, color: GRIS, al: 'center' });
    // tabla de peajes a la derecha
    const xT = M + wm + 3, wT = AN - wm - 3, cP = [6, wT - 6 - 18 - 12 - 20, 18, 12, 20];
    let yy = y0; let x = xT;
    ['#', 'Plaza de peaje', 'Tarifa', 'Pas.', 'Subtotal'].forEach((s, i) => { rect(x, yy, cP[i], 5.5, VERDE); txt(s, x, yy + 2.8, cP[i], { size: 7, bold: true, color: [255, 255, 255], al: i >= 2 ? 'right' : 'left' }); x += cP[i]; });
    yy += 5.5;
    const filasP = peajes.length ? peajes.map((x, i) => [String(i + 1), x.p.nombre + (x.p.estimado ? ' (est.)' : ''), $(x.tar), String(x.pas), $(x.sub)]) : [['', 'Sin peajes en la ruta', '', '', '']];
    if (num(form.tagUrbano)) filasP.push(['', 'TAG autopistas urbanas (estimado)', '', '', $(form.tagUrbano)]);
    filasP.forEach((f, i) => { let x2 = xT; f.forEach((v, k) => { rect(x2, yy, cP[k], 5, i % 2 ? [248, 250, 252] : null); txt(v, x2, yy + 2.5, cP[k], { size: 7, al: k >= 2 ? 'right' : 'left' }); x2 += cP[k]; }); yy += 5; });
    const totP = peajes.reduce((s, x) => s + x.sub, 0) + num(form.tagUrbano);
    rect(xT, yy, wT, 5.5, CLARO); txt('TOTAL PEAJES', xT, yy + 2.8, wT - 20, { size: 7.5, bold: true }); txt($(totP), xT + wT - 20, yy + 2.8, 20, { size: 7.5, bold: true, al: 'right' }); yy += 7;
    yy += parrafo(`Tarifa ${ejes2 ? 'camión 2 ejes' : 'camión de más de 2 ejes'}, horario normal, 2026. Las plazas se detectan solas cuando la ruta pasa por ellas (catálogo de peajes FRC). Laterales y pórticos urbanos se agregan a mano.`, xT, yy, wT, 6.3, GRIS);
    y = Math.max(y0 + hm, yy) + 4;
  }

  // ---------- Detalle de costos ----------
  asegurar(30);
  y = titulo('DETALLE DE COSTOS', y);
  const cols = [{ t: 'Ítem', w: 32 }, { t: 'Concepto', w: 46 }, { t: 'Detalle del cálculo', w: AN - 32 - 46 - 28, wrap: true }, { t: 'Monto', w: 28, al: 'right' }];
  const filas = r.lineas.map(l => [l.grupo, l.concepto, l.detalle, $(l.monto)]);
  const T = (a, b, tipo) => ['', a, '', $(b), tipo];
  filas.push(T('COSTO DIRECTO', r.directo, 'sub'), T(`Imprevistos (${r.pcts.imprevistos}%)`, r.imprevistos), T(`Gastos generales (${r.pcts.gg}%)`, r.gg), T(`Margen (${r.pcts.margen}%)`, r.margen),
    T('PRECIO NETO', r.neto, 'sub'), T(`IVA (${r.pcts.iva}%)`, r.iva), T('TOTAL CON IVA', r.total, 'total'));
  tabla(cols, filas, { estilo: (f) => (f[4] === 'total' ? { fill: OSCURO, color: [255, 255, 255], bold: true } : f[4] === 'sub' ? { fill: CLARO, bold: true } : f[0] === '' ? { bold: false, fill: [250, 250, 250] } : null) });

  // ---------- Supuestos y fuentes ----------
  doc.addPage(); y = encabezado('SUPUESTOS Y FUENTES DEL CÁLCULO');
  y += parrafo('Cada valor indica si lo calculó la app (AUTOMÁTICO: ruta web, parámetros o regla) o si se escribió a mano (MANUAL), y de dónde sale, para poder revisarlo.', M, y, AN, 7.5, GRIS) + 2;
  tabla([{ t: 'Variable', w: 44, wrap: true }, { t: 'Valor', w: 30, wrap: true }, { t: 'Origen', w: 22, al: 'center' }, { t: 'Fuente / regla', w: AN - 96, wrap: true }],
    supuestos.value.map(s => [s.variable, s.valor, s.origen, s.fuente + (s.link ? ' · ' + s.link : '')]),
    { titulo: 'SUPUESTOS Y FUENTES DEL CÁLCULO', estilo: (f) => (f[2] === 'MANUAL' ? { color: [146, 64, 14] } : null) });
  asegurar(40);
  y += 6;
  ['Preparado por', 'Revisado / aprobado por'].forEach((s, i) => { const x = M + 10 + i * (AN / 2); doc.setDrawColor(0); doc.setLineWidth(0.3); doc.line(x, y + 14, x + AN / 2 - 30, y + 14); txt(s, x, y + 17.5, AN / 2 - 30, { size: 7.5, bold: true, al: 'center' }); });

  pie();
  const fecha = (form.fecha || hoyISO()).replace(/-/g, '');
  doc.save(`Cotizacion_Camion_${(form.nombre || 'FRC').replace(/[^A-Za-z0-9]+/g, '_')}_${fecha}.pdf`);
};
