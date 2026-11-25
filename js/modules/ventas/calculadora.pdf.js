// =====================================================================
// CALCULADORA DE ARRIENDO · Cotización PDF PARA EL CLIENTE, formato FRC (2026-11-25)
// jsPDF (carta vertical). Página 1: datos del servicio, precio, mapa de la ruta y peajes.
// Página 2: detalle del servicio (por ítem, SIN mostrar costos internos, imprevistos,
// gastos generales ni margen: se reparten en los ítems; los peajes van a su tarifa real).
// Página 3: condiciones comerciales (Parámetros) y firmas. Solo Admin general.
// Los supuestos y fuentes internas quedan en el Excel.
// =====================================================================
import { form, params, resultado, tipoSel, pasadasDe, fmtN, MODALIDADES, num } from './calculadora.service.js';
import { soloAdminGeneral } from '../../core/store.js';
import { hoyISO } from '../../core/utils.js';

const JSPDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
let carga = null;
const cargarJsPDF = () => (window.jspdf ? Promise.resolve() : (carga = carga || new Promise((ok, mal) => {
  const s = document.createElement('script'); s.src = JSPDF; s.onload = ok;
  s.onerror = () => { carga = null; mal(new Error('No se pudo cargar el generador de PDF (revisa la conexión).')); };
  document.head.appendChild(s);
})));
// Logo oficial FRC (imagotipo horizontal verde neón, plantillas/img/logo-frc-neon.png); respaldo: el logo configurado en la web.
const archivoDataUrl = (ruta) => fetch(new URL(ruta, window.location.href).href).then(r => (r.ok ? r.blob() : null))
  .then(b => (b ? new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); }) : null)).catch(() => null);
const logoWeb = async () => {
  const url = await archivoDataUrl('plantillas/img/logo-frc-neon.png');
  if (url) return { url, ratio: 900 / 270 };
  try { const { logoDataURL } = await import('../../core/excel.js'); const l = await logoDataURL(); if (l && l.url) return l; } catch (e) { /* sin logo */ }
  return null;
};

const VERDE = [20, 154, 62], OSCURO = [14, 26, 20], GRIS = [100, 116, 139], CLARO = [232, 245, 236], AMBAR = [245, 158, 11];
const $ = (v) => '$' + fmtN(Math.round(num(v)));
// jsPDF (Helvetica) solo trae caracteres latinos: se reemplazan los que no imprime
const limpio = (s) => String(s ?? '').replace(/[−–—]/g, '-').replace(/→/g, '->').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, '...').replace(/[^\x00-\xFF]/g, '');
const fechaCL = (iso) => { const [y, m, d] = String(iso || hoyISO()).slice(0, 10).split('-'); return `${d}-${m}-${y}`; };
const sumarDias = (iso, n) => { const d = new Date(String(iso || hoyISO()).slice(0, 10) + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// ---------- Mapa con teselas de OpenStreetMap (imagen) ----------
const cargarImg = (src) => new Promise((ok) => { const i = new Image(); i.crossOrigin = 'anonymous'; const t = setTimeout(() => ok(null), 8000); i.onload = () => { clearTimeout(t); ok(i); }; i.onerror = () => { clearTimeout(t); ok(null); }; i.src = src; });
export const mapaImagen = async (linea, puntosPeaje, wPx, hPx) => {
  const X = (lng, z) => (lng + 180) / 360 * 256 * 2 ** z;
  const Y = (lat, z) => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * 2 ** z; };
  const todos = [...linea, ...puntosPeaje.map(p => [p.lng, p.lat])];
  let z = 13;
  const caja = (zz) => { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; todos.forEach(q => { const x = X(q[0], zz), y = Y(q[1], zz); a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); d = Math.max(d, y); }); return { x1: a, x2: b, y1: c, y2: d }; };
  while (z > 3) { const k = caja(z); if (k.x2 - k.x1 < wPx - 90 && k.y2 - k.y1 < hPx - 90) break; z--; }
  const k = caja(z), cx = (k.x1 + k.x2) / 2, cy = (k.y1 + k.y2) / 2, ox = cx - wPx / 2, oy = cy - hPx / 2;
  const cv = document.createElement('canvas'); cv.width = wPx; cv.height = hPx; const g = cv.getContext('2d');
  g.fillStyle = '#eef2ef'; g.fillRect(0, 0, wPx, hPx);
  const tiles = [];
  for (let tx = Math.floor(ox / 256); tx <= Math.floor((ox + wPx) / 256); tx++) for (let ty = Math.floor(oy / 256); ty <= Math.floor((oy + hPx) / 256); ty++) tiles.push({ tx, ty });
  const imgs = await Promise.all(tiles.map(t => cargarImg(`https://tile.openstreetmap.org/${z}/${t.tx}/${t.ty}.png`)));
  const okTiles = imgs.filter(Boolean).length;
  tiles.forEach((t, i) => { if (imgs[i]) g.drawImage(imgs[i], t.tx * 256 - ox, t.ty * 256 - oy); });
  const P = (lng, lat) => [X(lng, z) - ox, Y(lat, z) - oy];
  const trazo = (color, ancho) => { g.beginPath(); linea.forEach((q, i) => { const [x, y] = P(q[0], q[1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.strokeStyle = color; g.lineWidth = ancho; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); };
  if (linea.length > 1) { trazo('#ffffff', 14); trazo('#149A3E', 8); }
  g.font = 'bold 22px Helvetica, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  puntosPeaje.forEach((p, i) => { const [x, y] = P(p.lng, p.lat); g.beginPath(); g.arc(x, y, 19, 0, 7); g.fillStyle = '#f59e0b'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = '#111'; g.fillText(String(i + 1), x, y + 1); });
  const pin = (q, t, color) => { const [x, y] = P(q[0], q[1]); g.beginPath(); g.arc(x, y, 24, 0, 7); g.fillStyle = color; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 26px Helvetica, Arial'; g.fillText(t, x, y + 1); };
  if (linea.length) { pin(linea[0], 'A', '#0E1A14'); pin(linea[linea.length - 1], 'B', '#149A3E'); }
  g.font = '12px Helvetica, Arial'; g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(wPx - 160, hPx - 20, 160, 20); g.fillStyle = '#333'; g.fillText('© OpenStreetMap', wPx - 8, hPx - 10);
  return { url: cv.toDataURL('image/jpeg', 0.88), conFondo: okTiles > 0 };
};


// Ítems para el cliente: los peajes a su tarifa real; imprevistos, gastos generales y margen repartidos en el resto.
const NOMBRE = { 'Combustible': 'Combustible', 'Peajes': 'Peajes', 'Chofer y personal': 'Personal de operación', 'Uso del camión': 'Arriendo y operación del camión', 'Faena y acreditación': 'Acreditación y requisitos de faena', 'Otros': 'Otros servicios' };
export const peajesRuta = () => { const ejes2 = (tipoSel.value || {}).ejes === '2'; return params.peajes.filter(p => pasadasDe(p.id)).map(p => { const tar = num(ejes2 ? p.c2 : p.c3), pas = pasadasDe(p.id); return { p, tar, pas, sub: tar * pas }; }); };
export const detalleCliente = (peajes = peajesRuta()) => {
  const r = resultado.value;
  const grupos = [];
  r.lineas.forEach(l => { let g = grupos.find(z => z.g === l.grupo); if (!g) grupos.push(g = { g: l.grupo, costo: 0, conceptos: [] }); g.costo += l.monto; if (!g.conceptos.includes(l.concepto)) g.conceptos.push(l.concepto); });
  const costoPeajes = (grupos.find(g => g.g === 'Peajes') || {}).costo || 0;
  const resto = r.directo - costoPeajes, f = resto > 0 ? (r.neto - costoPeajes) / resto : 1;
  grupos.forEach(g => { g.precio = g.g === 'Peajes' ? g.costo : Math.round(g.costo * f); });
  const dif = r.neto - grupos.reduce((s, g) => s + g.precio, 0); const ajuste = grupos.filter(g => g.g !== 'Peajes').sort((a, b) => b.precio - a.precio)[0]; if (ajuste) ajuste.precio += dif;
  grupos.forEach(g => {
    g.nombre = NOMBRE[g.g] || g.g;
    g.desc = g.g === 'Combustible' ? `Diésel para ${fmtN(r.km)} km de recorrido (aprox. ${fmtN(r.litros)} L)` + (g.conceptos.length > 1 ? ' y operación de la pluma' : '')
      : g.g === 'Peajes' ? `${peajes.length} plaza(s) de peaje según la ruta (detalle en la ruta)` + (num(form.tagUrbano) ? ' y TAG urbano' : '')
      : g.g === 'Chofer y personal' ? g.conceptos.map((c, i) => (i ? c.charAt(0).toLowerCase() + c.slice(1) : c)).join(', ') + ` · ${fmtN(r.dias)} día(s)`
      : g.g === 'Uso del camión' ? `${form.tipo || 'Camión'} · ${fmtN(r.dias)} día(s), ${fmtN(r.km)} km (incluye neumáticos, mantención, seguros y permisos)`
      : g.conceptos.join(', ');
  });
  return grupos;
};
/** Datos del servicio (filas etiqueta / valor) que van en la página 1 del PDF y en la hoja 1 del Excel. */
export const datosServicio = () => {
  const r = resultado.value, t = tipoSel.value || {}, ruta = form.ruta, v = num(params.validezDias || 15);
  const mod = (MODALIDADES.find(m => m.k === form.modalidad) || {}).l || form.modalidad;
  return [
    ['Cliente', form.cliente || '—'], ['Servicio', form.nombre || '—'],
    ['Camión', `${form.tipo || '—'} (${t.ejes === '2' ? '2 ejes' : 'más de 2 ejes'})`], ['Modalidad', mod],
    ['Origen', (ruta && ruta.origen && ruta.origen.nombre) || form.origen || '—'], ['Destino', (ruta && ruta.destino && ruta.destino.nombre) || form.destino || '—'],
    ['Distancia', `${ruta ? fmtN(ruta.km, 1) + ' km de ida · ' : ''}${fmtN(r.km)} km en total`], ['Duración', `${fmtN(r.dias)} día(s) · ${fmtN(num(form.viajes))} viaje(s) ${form.idaVuelta ? 'ida y vuelta' : 'solo ida'}`],
    ['Incluye', [form.conChofer ? 'chofer' : '', 'combustible', 'peajes', form.conRigger ? 'rigger' : ''].filter(Boolean).join(', ')], ['Validez', `${v} días (hasta ${fechaCL(sumarDias(form.fecha, v))})`]
  ];
};
export const condicionesCliente = () => {
  const v = num(params.validezDias || 15);
  return [`Cotización válida por ${v} días desde su emisión (hasta el ${fechaCL(sumarDias(form.fecha, v))}).`, ...String(params.condicionesCliente || '').split('\n').map(x => x.trim()).filter(Boolean)];
};

export const exportarCotizacionPDF = async () => {
  if (!soloAdminGeneral()) return;
  await cargarJsPDF();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  const W = 215.9, H = 279.4, M = 12, AN = W - 2 * M;
  const logo = await logoWeb();
  const r = resultado.value, t = tipoSel.value || {}, ejes2 = t.ejes === '2';
  const mod = (MODALIDADES.find(m => m.k === form.modalidad) || {}).l || form.modalidad;
  const ruta = form.ruta;

  const txt = (s, x, y, w, { size = 8, bold = false, al = 'left', color = [0, 0, 0], min = 5 } = {}) => {
    s = limpio(s); if (!s) return;
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setTextColor(...color);
    let z = size; doc.setFontSize(z);
    while (z > min && doc.getTextWidth(s) > w - 1.6) { z -= 0.25; doc.setFontSize(z); }
    while (doc.getTextWidth(s) > w - 1.6 && s.length > 1) s = s.slice(0, -1);
    doc.text(s, al === 'center' ? x + w / 2 : al === 'right' ? x + w - 1.5 : x + 1.5, y, { align: al, baseline: 'middle' });
  };
  const parrafo = (s, x, y, w, size = 8, color = [0, 0, 0], bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
    const ls = doc.splitTextToSize(limpio(s), w - 3); doc.text(ls, x + 1.5, y, { baseline: 'top', lineHeightFactor: 1.35 }); return ls.length * size * 0.3528 * 1.35;
  };
  const rect = (x, y, w, h, fill, stroke = true) => { if (fill) doc.setFillColor(...fill); doc.setDrawColor(205, 210, 214); doc.setLineWidth(0.2); doc.rect(x, y, w, h, fill ? (stroke ? 'FD' : 'F') : 'S'); };
  const encabezado = (titulo) => {
    if (logo) { let h = 14, w = h * (logo.ratio || 3); if (w > 46) { w = 46; h = w / (logo.ratio || 3); } doc.addImage(logo.url, 'PNG', M, 9 + (14 - h) / 2, w, h); }
    rect(M + 50, 9, AN - 50 - 42, 14, VERDE, false);
    txt(titulo, M + 50, 16, AN - 50 - 42, { size: 13, bold: true, al: 'center', color: [255, 255, 255] });
    rect(W - M - 39, 9, 39, 14, OSCURO, false);
    txt('Fecha: ' + fechaCL(form.fecha), W - M - 39, 13, 39, { size: 7.5, bold: true, al: 'center', color: [255, 255, 255] });
    txt(form.id ? 'Cotización N° ' + form.id : 'Válida por ' + num(params.validezDias || 15) + ' días', W - M - 39, 19, 39, { size: 7, al: 'center', color: [255, 255, 255] });
    return 30;
  };
  const seccion = (s, y) => { rect(M, y, AN, 6.5, OSCURO, false); txt(s, M + 1, y + 3.3, AN - 2, { size: 9, bold: true, color: [255, 255, 255] }); return y + 9; };

  // =============== PÁGINA 1: datos, precio, ruta y peajes ===============
  let y = encabezado('COTIZACIÓN DE SERVICIO · CAMIÓN');
  y = seccion('DATOS DEL SERVICIO', y);
  const ds = datosServicio(); const datos = [0, 2, 4, 6, 8].map(i => [ds[i][0], ds[i][1], ds[i + 1][0], ds[i + 1][1]]);
  const cw = [24, AN / 2 - 24, 22, AN / 2 - 22], hD = 7;
  datos.forEach(f => { let x = M; f.forEach((v, k) => { rect(x, y, cw[k], hD, k % 2 ? null : CLARO); txt(v, x, y + hD / 2, cw[k], { size: 8.5, bold: k % 2 === 0, min: 6 }); x += cw[k]; }); y += hD; });
  y += 5;

  const cajas = [['PRECIO NETO', $(r.neto), VERDE], [`IVA (${r.pcts.iva}%)`, $(r.iva), GRIS], ['TOTAL CON IVA', $(r.total), OSCURO]];
  const wc = (AN - 8) / 3;
  cajas.forEach(([a, b, c], i) => { const x = M + i * (wc + 4); rect(x, y, wc, 17, c, false); txt(a, x, y + 4.8, wc, { size: 8, bold: true, al: 'center', color: [255, 255, 255] }); txt(b, x, y + 11.5, wc, { size: 15, bold: true, al: 'center', color: [255, 255, 255] }); });
  y += 20;
  const extra = [form.modalidad !== 'flete' && r.porDia ? `Valor neto por día: ${$(r.porDia)}` : '', r.porViaje && num(form.viajes) > 1 ? `Valor neto por viaje: ${$(r.porViaje)}` : ''].filter(Boolean).join('   ·   ');
  if (extra) { txt(extra, M, y + 1, AN, { size: 8, al: 'center', color: GRIS }); y += 5; }
  y += 3;

  // Ruta y peajes
  const peajes = peajesRuta();
  const conUbic = peajes.filter(x => x.p.lat != null);
  const linea = (ruta && ruta.linea) || [];
  y = seccion('RUTA', y);
  const filasPeaje = peajes.length + (num(form.tagUrbano) ? 1 : 0) + 2;
  const hMapa = Math.max(70, Math.min(112, H - 16 - y - 12 - filasPeaje * 6 - 8));
  if (linea.length > 1) {
    try {
      const m = await mapaImagen(linea, conUbic.map(x => ({ lat: x.p.lat, lng: x.p.lng })), 1600, Math.round(1600 * hMapa / AN));
      doc.addImage(m.url, 'JPEG', M, y, AN, hMapa); rect(M, y, AN, hMapa, null);
    } catch (e) { rect(M, y, AN, hMapa, [246, 248, 247]); txt('No se pudo dibujar el mapa', M, y + hMapa / 2, AN, { size: 9, color: GRIS, al: 'center' }); }
  } else { rect(M, y, AN, 20, [246, 248, 247]); txt('Ruta no calculada', M, y + 10, AN, { size: 9, color: GRIS, al: 'center' }); }
  y += (linea.length > 1 ? hMapa : 20) + 2;
  txt(`A: ${(form.origen || '').split(',')[0]}   ·   B: ${(form.destino || '').split(',')[0]}   ·   ${conUbic.length ? 'Círculos naranjos: plazas de peaje (N° de la tabla)' : ''}`, M, y + 1.5, AN, { size: 7.5, color: GRIS });
  y += 6;

  // tabla de peajes
  const cP = [10, AN - 10 - 30 - 18 - 30, 30, 18, 30];
  let x = M;
  ['N°', `Plaza de peaje (tarifa camión ${ejes2 ? '2 ejes' : 'más de 2 ejes'})`, 'Tarifa', 'Pasadas', 'Subtotal'].forEach((s, i) => { rect(x, y, cP[i], 6, VERDE); txt(s, x, y + 3, cP[i], { size: 7.5, bold: true, color: [255, 255, 255], al: i >= 2 ? 'right' : 'left' }); x += cP[i]; });
  y += 6;
  const filasP = peajes.length ? peajes.map((p, i) => [String(i + 1), p.p.nombre, $(p.tar), String(p.pas), $(p.sub)]) : [['', 'La ruta no pasa por plazas de peaje', '', '', '']];
  if (num(form.tagUrbano)) filasP.push(['', 'TAG autopistas urbanas', '', '', $(form.tagUrbano)]);
  filasP.forEach((f, i) => { x = M; f.forEach((v, k) => { rect(x, y, cP[k], 5.8, i % 2 ? [248, 250, 252] : null); txt(v, x, y + 2.9, cP[k], { size: 8, al: k >= 2 ? 'right' : 'left' }); x += cP[k]; }); y += 5.8; });
  const totPeajes = peajes.reduce((s, p) => s + p.sub, 0) + num(form.tagUrbano);
  rect(M, y, AN, 6.2, CLARO); txt('TOTAL PEAJES', M, y + 3.1, AN - 30, { size: 8.5, bold: true }); txt($(totPeajes), M + AN - 30, y + 3.1, 30, { size: 8.5, bold: true, al: 'right' });

  // =============== PÁGINA 2: detalle del servicio ===============
  doc.addPage(); y = encabezado('DETALLE DEL SERVICIO');
  y = seccion('DETALLE DE LA COTIZACIÓN', y);
  // Ítems por grupo. Los peajes van a su tarifa real; el resto lleva repartidos imprevistos, gastos generales y margen.
  const grupos = detalleCliente(peajes);
  const describir = (g) => g.desc;
  const cD = [62, AN - 62 - 34, 34];
  x = M; ['Ítem', 'Descripción', 'Valor neto'].forEach((s, i) => { rect(x, y, cD[i], 7, VERDE); txt(s, x, y + 3.5, cD[i], { size: 8.5, bold: true, color: [255, 255, 255], al: i === 2 ? 'right' : 'left' }); x += cD[i]; });
  y += 7;
  grupos.forEach((g, i) => {
    doc.setFontSize(8.5); const ls = doc.splitTextToSize(limpio(describir(g)), cD[1] - 3); const h = Math.max(9, ls.length * 4.2 + 4);
    x = M; [NOMBRE[g.g] || g.g, '', $(g.precio)].forEach((v, k) => { rect(x, y, cD[k], h, i % 2 ? [248, 250, 252] : null); if (k === 1) parrafo(describir(g), x, y + 2.2, cD[k], 8.5); else txt(v, x, y + h / 2, cD[k], { size: 9, bold: k === 0, al: k === 2 ? 'right' : 'left' }); x += cD[k]; });
    y += h;
  });
  y += 4;
  const xT = M + AN - 96;
  [['PRECIO NETO', r.neto, CLARO, [0, 0, 0]], [`IVA (${r.pcts.iva}%)`, r.iva, null, [0, 0, 0]], ['TOTAL CON IVA', r.total, OSCURO, [255, 255, 255]]].forEach(([a, b, fill, col]) => {
    rect(xT, y, 62, 8, fill); rect(xT + 62, y, 34, 8, fill);
    txt(a, xT, y + 4, 62, { size: 9.5, bold: true, color: col }); txt($(b), xT + 62, y + 4, 34, { size: 9.5, bold: true, al: 'right', color: col }); y += 8;
  });
  y += 6;
  if (form.modalidad !== 'flete' && r.porDia) { txt(`Valor neto por día: ${$(r.porDia)}`, M, y, AN, { size: 8.5, color: GRIS }); y += 5; }
  parrafo('Valores en pesos chilenos. El precio neto incluye todos los ítems indicados; el IVA se suma al total.', M, y, AN, 8, GRIS);

  // =============== PÁGINA 3: condiciones y firmas ===============
  doc.addPage(); y = encabezado('CONDICIONES DE LA COTIZACIÓN');
  y = seccion('CONDICIONES COMERCIALES', y);
  const cond = condicionesCliente();
  cond.forEach((c, i) => { txt(String(i + 1) + '.', M, y + 1.6, 8, { size: 9, bold: true, color: VERDE }); y += parrafo(c, M + 7, y, AN - 7, 9) + 2.5; });
  y = Math.max(y + 30, 200);
  ['FAST RENTAL CHILE', 'Aceptación del cliente'].forEach((s, i) => { const xx = M + 8 + i * (AN / 2); doc.setDrawColor(0); doc.setLineWidth(0.3); doc.line(xx, y, xx + AN / 2 - 16, y); txt(s, xx, y + 4, AN / 2 - 16, { size: 9, bold: true, al: 'center' }); txt('Nombre, firma y fecha', xx, y + 8.5, AN / 2 - 16, { size: 7.5, al: 'center', color: GRIS }); });

  // Pie en todas las páginas
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setDrawColor(...VERDE); doc.setLineWidth(0.5); doc.line(M, H - 12, W - M, H - 12);
    txt('FAST RENTAL CHILE', M, H - 8.5, AN - 25, { size: 7, bold: true, color: GRIS });
    txt(`Pág. ${i} de ${n}`, W - M - 25, H - 8.5, 25, { size: 7, al: 'right', color: GRIS });
  }
  const fecha = (form.fecha || hoyISO()).replace(/-/g, '');
  doc.save(`Cotizacion_${(form.cliente || form.nombre || 'FRC').replace(/[^A-Za-z0-9]+/g, '_')}_${fecha}.pdf`);
};

// =============== EXCEL PARA EL CLIENTE (mismo contenido que el PDF) ===============
// Hoja 1 "Datos y ruta" (datos, precio, peajes y mapa) · Hoja 2 "Detalle" · Hoja 3 "Condiciones".
export const exportarCotizacionExcelCliente = async () => {
  if (!soloAdminGeneral()) return;
  const { nuevoLibro, hojaTabla, descargarLibro } = await import('../../core/excel.js');
  const { wb } = await nuevoLibro();
  // El encabezado del Excel dibuja el logo a 60 px de alto y máx. 150 px de ancho: se deja en proporción 2,5 (con margen) para no deformarlo.
  let logo = await logoWeb();
  if (logo) { try { const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = logo.url; }); const c = document.createElement('canvas'); c.width = 1000; c.height = 400; const h = 1000 / (img.naturalWidth / img.naturalHeight); c.getContext('2d').drawImage(img, 0, (400 - h) / 2, 1000, h); logo = { url: c.toDataURL('image/png'), ratio: 2.5 }; } catch (e) { /* tal cual */ } }
  const r = resultado.value, t = tipoSel.value || {}, ejes2 = t.ejes === '2';
  const sub = [form.cliente, form.nombre, form.origen && form.destino ? `${form.origen} -> ${form.destino}` : ''].filter(Boolean).join(' · ');
  const peajes = peajesRuta();
  const SEP = 'FFDCEFE3', NEG = { font: { bold: true } };
  // Hoja 1
  const f1 = datosServicio().map(([a, b]) => [a, b, '']);
  f1.push(['', `PEAJES EN LA RUTA (tarifa camión ${ejes2 ? '2 ejes' : 'más de 2 ejes'})`, '', 'sep']);
  peajes.forEach((p, i) => f1.push([`Peaje ${i + 1}`, `${p.p.nombre} · ${p.pas} pasada(s) × $${fmtN(p.tar)}`, p.sub]));
  if (!peajes.length) f1.push(['', 'La ruta no pasa por plazas de peaje', '']);
  if (num(form.tagUrbano)) f1.push(['TAG', 'Autopistas urbanas', num(form.tagUrbano)]);
  f1.push(['', 'Total peajes', peajes.reduce((s, p) => s + p.sub, 0) + num(form.tagUrbano), 'neg']);
  f1.push(['', 'PRECIO', '', 'sep'], ['', 'Precio neto', r.neto, 'neg'], ['', `IVA (${r.pcts.iva}%)`, r.iva]);
  const ws1 = hojaTabla(wb, logo, {
    nombre: 'Datos y ruta', titulo: 'COTIZACIÓN DE SERVICIO · CAMIÓN', subtitulo: sub, apaisado: false,
    columnas: [{ t: 'Dato', w: 22, al: 'left', bold: true }, { t: 'Detalle', w: 78, al: 'left' }, { t: 'Valor ($)', w: 20, fmt: '#,##0', al: 'right' }],
    filas: f1.map(x => x.slice(0, 3)), totales: ['', 'TOTAL CON IVA', r.total],
    estiloFila: (v, i) => (f1[i][3] === 'sep' ? { fill: SEP, font: { bold: true } } : f1[i][3] === 'neg' ? NEG : null)
  });
  ws1.autoFilter = undefined;
  const linea = (form.ruta && form.ruta.linea) || [];
  if (linea.length > 1) {
    try {
      const m = await mapaImagen(linea, peajes.filter(p => p.p.lat != null).map(p => ({ lat: p.p.lat, lng: p.p.lng })), 1300, 760);
      const fila = 6 + f1.length + 2;
      ws1.getCell(fila, 1).value = 'Mapa de la ruta (A: origen · B: destino · círculos naranjos: peajes en el orden de la tabla)'; ws1.getCell(fila, 1).font = { bold: true, size: 9 };
      ws1.addImage(wb.addImage({ base64: m.url, extension: 'jpeg' }), { tl: { col: 0, row: fila }, ext: { width: 760, height: 444 }, editAs: 'oneCell' });
    } catch (e) { /* sin mapa */ }
  }
  // Hoja 2
  const g = detalleCliente(peajes);
  const ws2 = hojaTabla(wb, logo, {
    nombre: 'Detalle', titulo: 'DETALLE DEL SERVICIO', subtitulo: sub, apaisado: false,
    columnas: [{ t: 'Ítem', w: 32, al: 'left', bold: true }, { t: 'Descripción', w: 70, al: 'left' }, { t: 'Valor neto ($)', w: 18, fmt: '#,##0', al: 'right' }],
    filas: [...g.map(x => [x.nombre, x.desc, x.precio]), ['', 'PRECIO NETO', r.neto], ['', `IVA (${r.pcts.iva}%)`, r.iva]],
    totales: ['', 'TOTAL CON IVA', r.total], estiloFila: (v) => (v[0] === '' ? NEG : null)
  });
  ws2.autoFilter = undefined;
  ws2.eachRow(row => { if (row.number > 6) row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }; });
  g.forEach((x, i) => { ws2.getRow(7 + i).height = x.desc.length > 70 ? 30 : 18; });
  // Hoja 3
  const ws3 = hojaTabla(wb, logo, {
    nombre: 'Condiciones', titulo: 'CONDICIONES DE LA COTIZACIÓN', subtitulo: sub, apaisado: false,
    columnas: [{ t: 'N°', w: 8 }, { t: 'Condición', w: 112, al: 'left' }],
    filas: condicionesCliente().map((c, i) => [i + 1, c])
  });
  ws3.autoFilter = undefined;
  ws3.eachRow(row => { if (row.number > 6) { row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }; row.height = String(row.getCell(2).value || '').length > 105 ? 30 : 18; } });
  const fecha = (form.fecha || hoyISO()).replace(/-/g, '');
  await descargarLibro(wb, `Cotizacion_${(form.cliente || form.nombre || 'FRC').replace(/[^A-Za-z0-9]+/g, '_')}_${fecha}.xlsx`);
};
