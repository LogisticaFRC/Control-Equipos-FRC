// =====================================================================
// SEGURIDAD · PDF RESUMIDO PARA IMPRIMIR (2026-11-27)
//   exportarPdfRF()  → 31 Riesgos de Fatalidad: ícono + controles críticos (CCP / CCM), sin las preguntas.
//   exportarPdfECF() → Estándares de control de fatalidad: riesgo, controles críticos y prohibido.
// A4 vertical, 2 columnas, texto real (liviano y nítido al imprimir).
// =====================================================================
import { RF } from './riesgos-rf.data.js';

const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
let carga = null;
const cargarJsPDF = () => (window.jspdf ? Promise.resolve() : (carga = carga || new Promise((ok, mal) => {
  const s = document.createElement('script'); s.src = JSPDF; s.onload = ok;
  s.onerror = () => { carga = null; mal(new Error('No se pudo cargar el generador de PDF (revisa la conexión).')); };
  document.head.appendChild(s);
})));
const limpio = (s) => String(s ?? '').replace(/[−–—]/g, '-').replace(/→/g, '->').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, '...').replace(/[^\x00-\xFF]/g, '');
const pad = (n) => String(n).padStart(2, '0');
const hex = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hoy = () => { const d = new Date(); return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`; };

// Imagen (webp / svg) → PNG para jsPDF
const aPng = (src, px = 160, fondo = null) => new Promise((ok) => {
  const i = new Image(); const t = setTimeout(() => ok(null), 8000);
  i.onload = () => { clearTimeout(t); try { const c = document.createElement('canvas'); c.width = c.height = px; const x = c.getContext('2d'); if (fondo) { x.fillStyle = fondo; x.fillRect(0, 0, px, px); } x.drawImage(i, 0, 0, px, px); ok(c.toDataURL('image/png')); } catch (_) { ok(null); } };
  i.onerror = () => { clearTimeout(t); ok(null); };
  i.src = src;
});
const logoNeon = () => aPngRect('plantillas/img/logo-frc-neon.png');
const aPngRect = (src) => new Promise((ok) => {
  const i = new Image(); i.onload = () => { try { const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; c.getContext('2d').drawImage(i, 0, 0); ok({ url: c.toDataURL('image/png'), ratio: i.naturalWidth / i.naturalHeight }); } catch (_) { ok(null); } };
  i.onerror = () => ok(null); i.src = src;
});

// ---------- Base común: encabezado, pie y columnas tipo "mosaico" ----------
const W = 210, H = 297, M = 10, GAP = 5, COL = (W - 2 * M - GAP) / 2, TOP = 12, BOT = H - 12;
const nuevoDoc = async (titulo, subtitulo, colorBanda) => {
  await cargarJsPDF();
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const logo = await logoNeon();
  doc.setFillColor(...colorBanda); doc.rect(0, 0, W, 26, 'F');
  if (logo) doc.addImage(logo.url, 'PNG', M, 6, 14 * logo.ratio > 48 ? 48 : 14 * logo.ratio, (14 * logo.ratio > 48 ? 48 / logo.ratio : 14));
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text(limpio(titulo), W - M, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text(limpio(subtitulo), W - M, 18, { align: 'right' });
  doc.text('Fast Rental Chile · ' + hoy(), W - M, 22.5, { align: 'right' });
  return doc;
};
const aviso = (doc, y, texto) => {
  doc.setFillColor(254, 242, 242); doc.setDrawColor(220, 38, 38); doc.setLineWidth(0.4);
  const lineas = doc.setFont('helvetica', 'bold').setFontSize(8.5).splitTextToSize(limpio(texto), W - 2 * M - 8);
  const h = lineas.length * 3.8 + 4;
  doc.roundedRect(M, y, W - 2 * M, h, 2, 2, 'FD'); doc.setTextColor(153, 27, 27); doc.text(lineas, M + 4, y + 5.2);
  return y + h + 4;
};
const pies = (doc, fuente) => {
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(120, 120, 120);
    doc.text(doc.splitTextToSize(limpio(fuente), W - 2 * M - 20), M, H - 7);
    doc.text(`${p} / ${n}`, W - M, H - 7, { align: 'right' });
  }
};
/** Coloca tarjetas de alto variable en 2 columnas (se llena la izquierda y luego la derecha, en orden), pasando de hoja cuando no caben. */
const mosaico = (doc, yInicio, tarjetas) => {
  let c = 0, y = yInicio, yTope = yInicio;
  for (const t of tarjetas) {
    const h = t.alto();
    if (y + h > BOT) {
      if (c === 0) { c = 1; y = yTope; }
      if (y + h > BOT) { doc.addPage(); c = 0; y = yTope = TOP; }
    }
    t.dibujar(M + c * (COL + GAP), y);
    y += h + 4;
  }
};

// ---------- 31 RIESGOS DE FATALIDAD ----------
export const exportarPdfRF = async () => {
  const NAR = [232, 98, 42], VERDE = [5, 150, 105], AZUL = [2, 132, 199];
  const doc = await nuevoDoc('31 Riesgos de Fatalidad', 'Controles críticos que salvan vidas · resumen', [124, 45, 18]);
  const iconos = await Promise.all(RF.map(r => aPng(`img/rf/rf${pad(r.n)}.webp`, 140)));
  let y = aviso(doc, 31, 'Antes de empezar revisa el riesgo de tu tarea y sus controles críticos. Si algún control crítico no está implementado, DETÉN la actividad y avisa a tu supervisor.');
  // leyenda
  doc.setFont('helvetica', 'bold').setFontSize(7);
  doc.setFillColor(...VERDE); doc.roundedRect(M, y - 2.6, 9, 3.6, 1, 1, 'F'); doc.setTextColor(255, 255, 255); doc.text('CCP', M + 4.5, y, { align: 'center' });
  doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'normal'); doc.text('Preventivo: evita que ocurra', M + 11, y);
  doc.setFillColor(...AZUL); doc.roundedRect(M + 55, y - 2.6, 9, 3.6, 1, 1, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.text('CCM', M + 59.5, y, { align: 'center' });
  doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'normal'); doc.text('Mitigador: reduce las consecuencias', M + 66, y);
  y += 5;
  const ANCHO_TXT = COL - 14, FS = 7.4, LH = 3.1, CAB = 15;
  const tarjetas = RF.map((r, k) => {
    const filas = r.trabajador.map(c => ({ c: c.c, l: doc.setFont('helvetica', 'normal').setFontSize(FS).splitTextToSize(limpio(c.nombre), ANCHO_TXT) }));
    const alto = () => CAB + filas.reduce((s, f) => s + f.l.length * LH + 1.2, 0) + 2;
    return {
      alto,
      dibujar: (x, y0) => {
        const h = alto();
        doc.setDrawColor(253, 186, 116); doc.setLineWidth(0.35); doc.setFillColor(255, 255, 255); doc.roundedRect(x, y0, COL, h, 2.5, 2.5, 'FD');
        doc.setFillColor(255, 237, 213); doc.roundedRect(x, y0, COL, CAB - 1, 2.5, 2.5, 'F'); doc.rect(x, y0 + CAB - 4, COL, 3, 'F');
        if (iconos[k]) doc.addImage(iconos[k], 'PNG', x + 2, y0 + 1.2, 11.5, 11.5);
        doc.setFillColor(...NAR); doc.roundedRect(x + 15, y0 + 2.2, 11, 4, 1.2, 1.2, 'F');
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold').setFontSize(7); doc.text('RF ' + pad(r.n), x + 20.5, y0 + 5.1, { align: 'center' });
        doc.setTextColor(30, 30, 30); doc.setFontSize(9.5);
        const nom = doc.splitTextToSize(limpio(r.nombre), COL - 18);
        doc.text(nom.slice(0, 2), x + 15, y0 + (nom.length > 1 ? 9.6 : 10.8));
        let yy = y0 + CAB + 1.5;
        for (const f of filas) {
          const prev = f.c.startsWith('CCP');
          doc.setFillColor(...(prev ? VERDE : AZUL)); doc.roundedRect(x + 2, yy - 2.5, 9.5, 3.3, 0.8, 0.8, 'F');
          doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold').setFontSize(6); doc.text(f.c, x + 6.75, yy - 0.15, { align: 'center' });
          doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'normal').setFontSize(FS); doc.text(f.l, x + 13, yy);
          yy += f.l.length * LH + 1.2;
        }
      }
    };
  });
  mosaico(doc, y, tarjetas);
  pies(doc, 'Resumen para difusión. Fuente: Codelco SIGO-G-012 "Controles Críticos que Salvan Vidas" v002. Manda siempre el documento oficial vigente.');
  doc.save(`Riesgos de fatalidad (31) - resumen ${hoy()}.pdf`);
};

// ---------- ESTÁNDARES DE CONTROL DE FATALIDAD ----------
export const exportarPdfECF = async (ECF, dibujo) => {
  const doc = await nuevoDoc('Estándares de control de fatalidad', 'ECF Codelco · resumen para terreno', [127, 29, 29]);
  const iconos = await Promise.all(ECF.map(e => aPng('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(String(dibujo(e.dib)).replace(/currentColor/g, e.color).replace(/^<svg width="100%" height="100%" /, '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" ')), 140, '#ffffff')));
  const y = aviso(doc, 31, 'Ninguna tarea es tan urgente que no se pueda hacer de forma segura. Si no se cumple algún control, DETÉN el trabajo y avisa a tu supervisor.');
  const AT = COL - 6, FS = 7.4, LH = 3.1, CAB = 14;
  const tarjetas = ECF.map((e, k) => {
    const col = hex(e.color);
    doc.setFont('helvetica', 'normal').setFontSize(FS);
    const riesgo = doc.splitTextToSize(limpio(e.riesgo), AT);
    const ctr = e.controles.map(c => doc.splitTextToSize(limpio(c), AT - 5));
    const pro = e.prohibido.map(p => doc.splitTextToSize(limpio(p), AT - 5));
    const alto = () => CAB + 4 + riesgo.length * LH + 5 + ctr.reduce((s, l) => s + l.length * LH + 0.8, 0) + 3 + 4 + pro.reduce((s, l) => s + l.length * LH + 0.8, 0) + 3;
    return {
      alto,
      dibujar: (x, y0) => {
        const h = alto();
        doc.setDrawColor(...col); doc.setLineWidth(0.4); doc.setFillColor(255, 255, 255); doc.roundedRect(x, y0, COL, h, 2.5, 2.5, 'FD');
        doc.setFillColor(...col); doc.roundedRect(x, y0, COL, CAB, 2.5, 2.5, 'F'); doc.rect(x, y0 + CAB - 3, COL, 3, 'F');
        doc.setFillColor(255, 255, 255); doc.roundedRect(x + 2, y0 + 1.5, 11, 11, 1.5, 1.5, 'F');
        if (iconos[k]) doc.addImage(iconos[k], 'PNG', x + 2.5, y0 + 2, 10, 10);
        doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold').setFontSize(7); doc.text('ECF ' + e.n, x + 15.5, y0 + 5);
        doc.setFontSize(9.5); const nom = doc.splitTextToSize(limpio(e.nombre), COL - 18); doc.text(nom.slice(0, 2), x + 15.5, y0 + 9.2);
        let yy = y0 + CAB + 3.5;
        doc.setTextColor(185, 28, 28); doc.setFont('helvetica', 'bold').setFontSize(6.8); doc.text('RIESGO', x + 3, yy); yy += 3.2;
        doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'normal').setFontSize(FS); doc.text(riesgo, x + 3, yy); yy += riesgo.length * LH + 1.8;
        doc.setTextColor(4, 120, 87); doc.setFont('helvetica', 'bold').setFontSize(6.8); doc.text('CONTROLES CRÍTICOS · SIEMPRE', x + 3, yy); yy += 3.2;
        ctr.forEach((l, i) => {
          doc.setFillColor(5, 150, 105); doc.circle(x + 4.6, yy - 1, 1.6, 'F');
          doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold').setFontSize(5.8); doc.text(String(i + 1), x + 4.6, yy - 0.05, { align: 'center' });
          doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'normal').setFontSize(FS); doc.text(l, x + 8, yy); yy += l.length * LH + 0.8;
        });
        yy += 1.2;
        const hp = 4 + pro.reduce((s, l) => s + l.length * LH + 0.8, 0) + 1;
        doc.setFillColor(15, 23, 42); doc.roundedRect(x + 2, yy - 2.6, COL - 4, hp, 1.5, 1.5, 'F');
        doc.setTextColor(253, 164, 175); doc.setFont('helvetica', 'bold').setFontSize(6.8); doc.text('PROHIBIDO', x + 4, yy + 0.4); yy += 3.6;
        pro.forEach(l => { doc.setTextColor(251, 113, 133); doc.setFont('helvetica', 'bold').setFontSize(7); doc.text('X', x + 4.2, yy); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'normal').setFontSize(FS); doc.text(l, x + 8, yy); yy += l.length * LH + 0.8; });
      }
    };
  });
  mosaico(doc, y, tarjetas);
  pies(doc, 'Resumen para difusión basado en los Estándares de Control de Fatalidades de Codelco (ECF 1 al 12 y ECF 21). Manda siempre el estándar oficial vigente (SIGO-ECF).');
  doc.save(`Estandares de control de fatalidad - resumen ${hoy()}.pdf`);
};
