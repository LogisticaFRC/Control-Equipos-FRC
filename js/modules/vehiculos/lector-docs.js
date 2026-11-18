// =====================================================================
// VEHÍCULOS · LECTURA AUTOMÁTICA DE DOCUMENTOS (2026-11-18)
//   Al elegir el archivo de un Permiso de Circulación, Revisión Técnica, SOAP u otro certificado,
//   se lee el texto del PDF digital (pdf.js, sin internet extra ni costo) y se completa SOLO lo que
//   pide el formulario: fecha de emisión, fecha de vencimiento y N° / folio. También revisa que la
//   patente del documento sea la del vehículo y reconoce el tipo de documento.
//   PDF escaneado o foto: se intenta con lectura de imagen (Tesseract), más lenta y menos precisa.
// =====================================================================
const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const TESS_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

const cargas = {};
const cargarScript = (url, global) => {
  if (window[global]) return Promise.resolve(window[global]);
  if (!cargas[url]) cargas[url] = new Promise((ok, mal) => {
    const s = document.createElement('script'); s.src = url;
    s.onload = () => ok(window[global]);
    s.onerror = () => { delete cargas[url]; mal(new Error('No se pudo cargar el lector (revisa la conexión).')); };
    document.head.appendChild(s);
  });
  return cargas[url];
};
const sinTildes = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ---------- 1. Texto del archivo ----------
const textoPDF = async (file) => {
  const pdfjs = await cargarScript(PDFJS_URL, 'pdfjsLib');
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let txt = '';
  for (let p = 1; p <= Math.min(pdf.numPages, 4); p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    // une los trozos respetando los saltos de línea del PDF
    let ultY = null;
    tc.items.forEach(it => { const y = it.transform ? Math.round(it.transform[5]) : null; if (ultY !== null && y !== null && Math.abs(y - ultY) > 2) txt += '\n'; else if (txt && !txt.endsWith(' ')) txt += ' '; txt += it.str; ultY = y; });
    txt += '\n';
  }
  return { texto: txt, pdf };
};
const ocr = async (fuente) => {
  const T = await cargarScript(TESS_URL, 'Tesseract');
  const w = await T.createWorker('spa');
  try { const { data } = await w.recognize(fuente); return data.text || ''; } finally { w.terminate(); }
};
const textoDe = async (file, onPaso = () => {}) => {
  const esPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
  if (esPdf) {
    onPaso('Leyendo el PDF…');
    const { texto, pdf } = await textoPDF(file);
    if (texto.replace(/\s/g, '').length > 40) return { texto, modo: 'digital' };
    // PDF escaneado: se dibuja la 1ª página y se lee como imagen
    onPaso('El PDF es una imagen: leyendo con reconocimiento de texto…');
    const page = await pdf.getPage(1), vp = page.getViewport({ scale: 2 });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    return { texto: await ocr(c), modo: 'imagen' };
  }
  if (/^image\//.test(file.type)) { onPaso('Leyendo la imagen…'); return { texto: await ocr(file), modo: 'imagen' }; }
  return { texto: '', modo: 'ninguno' };
};

// ---------- 2. Fechas ----------
const MESES = { ENE: 1, ENERO: 1, FEB: 2, FEBRERO: 2, MAR: 3, MARZO: 3, ABR: 4, ABRIL: 4, MAY: 5, MAYO: 5, JUN: 6, JUNIO: 6, JUL: 7, JULIO: 7, AGO: 8, AGOSTO: 8, SEP: 9, SEPT: 9, SEPTIEMBRE: 9, SETIEMBRE: 9, OCT: 10, OCTUBRE: 10, NOV: 11, NOVIEMBRE: 11, DIC: 12, DICIEMBRE: 12 };
const iso = (d, m, y) => { y = Number(y); if (y < 100) y += 2000; d = Number(d); m = Number(m); if (!(y >= 2000 && y <= 2040 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null; return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; };
/** Todas las fechas del texto con su posición. */
const fechasDe = (T) => {
  const out = [];
  const add = (i, v) => { if (v) out.push({ i, v }); };
  for (const m of T.matchAll(/\b(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4}|\d{2})\b/g)) add(m.index, iso(m[1], m[2], m[3]));
  for (const m of T.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) add(m.index, iso(m[3], m[2], m[1]));
  for (const m of T.matchAll(/\b(\d{1,2})\s*(?:DE\s+|[-\/ ])?([A-Z]{3,10})\.?\s*(?:DE(?:L)?\s+|[-\/ ])?(\d{4})\b/g)) { const mm = MESES[m[2]]; if (mm) add(m.index, iso(m[1], mm, m[3])); }
  return out.sort((a, b) => a.i - b.i);
};
/** Fecha más cercana DESPUÉS de alguna de las palabras clave (dentro de `rango` caracteres). */
const fechaTras = (T, fechas, re, rango = 90) => {
  let mejor = null;
  for (const m of T.matchAll(re)) {
    const f = fechas.find(x => x.i >= m.index && x.i - m.index <= rango + m[0].length);
    if (f && (!mejor || f.i - m.index < mejor.d)) mejor = { v: f.v, d: f.i - m.index };
  }
  return mejor ? mejor.v : null;
};

// ---------- 3. Lectura ----------
const RE_VENC = /(FECHA\s+DE\s+VENCIMIENTO|VENCIMIENTO|VENCE(?:\s+EL)?|VALIDO\s+HASTA|VALIDA\s+HASTA|VIGENTE\s+HASTA|VIGENCIA\s+HASTA|HASTA\s+EL|FECHA\s+(?:DE\s+)?TERMINO|TERMINO\s+(?:DE\s+)?VIGENCIA|PROXIMA\s+REVISION|FIN\s+DE\s+VIGENCIA|HASTA)/g;
const RE_EMIS = /(FECHA\s+DE\s+EMISION|EMISION|EMITIDO|FECHA\s+(?:DE\s+)?PAGO|FECHA\s+(?:DE\s+)?REVISION|FECHA\s+(?:DE\s+)?INSPECCION|INICIO\s+(?:DE\s+)?VIGENCIA|VIGENCIA\s+DESDE|VIGENTE\s+DESDE|DESDE\s+EL|DESDE|FECHA\s+(?:DE\s+)?OTORGAMIENTO)/g;
const RE_NUM = /(?:FOLIO|N[°º.O]\s*(?:DE\s+)?(?:FOLIO|CERTIFICADO|PERMISO|POLIZA|PROPUESTA)?|CERTIFICADO\s+N[°º.O]?|POLIZA\s+N[°º.O]?|NUMERO(?:\s+DE\s+(?:CERTIFICADO|PERMISO|POLIZA|FOLIO))?)\s*[:#]?\s*([A-Z]{0,3}[-\s]?\d[\d.\-]{3,18})/;
const TIPOS = [
  { key: 'PERMISO_CIRCULACION', re: /PERMISO\s+DE\s+CIRCULACION/ },
  { key: 'REVISION_TECNICA', re: /REVISION\s+TECNICA|CERTIFICADO\s+DE\s+REVISION|PLANTA\s+DE\s+REVISION/ },
  { key: 'SOAP', re: /SEGURO\s+OBLIGATORIO|S\.?\s*O\.?\s*A\.?\s*P\.?\b|ACCIDENTES\s+PERSONALES/ },
  { key: 'GASES', re: /ANALISIS\s+DE\s+GASES|REVISION\s+DE\s+GASES|EMISION(?:ES)?\s+CONTAMINANTES|HOMOLOGACION/ }
];
const patentes = (T) => {
  const out = new Set();
  for (const m of T.matchAll(/\b([BCDFGHJKLPRSTVWXYZ]{4})\s*[-·.]?\s*(\d{2})\b/g)) out.add(`${m[1]}-${m[2]}`);
  for (const m of T.matchAll(/\b([A-Z]{2})\s*[-·.]?\s*(\d{4})\b/g)) if (!/^(19|20)\d\d$/.test(m[2])) out.add(`${m[1]}-${m[2]}`);   // formato antiguo (AB-1234), sin confundir "DE 2026"
  return [...out];
};

/**
 * Lee el documento y devuelve lo que encontró:
 * { modo, tipo, emision, vencimiento, numero, patentes, patenteOk, texto }
 */
export const leerDocVehiculo = async (file, patenteVehiculo = '', onPaso = () => {}) => {
  const { texto, modo } = await textoDe(file, onPaso);
  const T = sinTildes(texto).replace(/[ \t]+/g, ' ');
  const fechas = fechasDe(T);
  let vencimiento = fechaTras(T, fechas, RE_VENC);
  let emision = fechaTras(T, fechas, RE_EMIS);
  // sin palabras clave: la fecha más lejana es el vencimiento y la más antigua anterior a ella, la emisión
  const valores = [...new Set(fechas.map(f => f.v))].sort();
  if (!vencimiento && valores.length) vencimiento = valores[valores.length - 1];
  if (emision && vencimiento && emision >= vencimiento) emision = valores.filter(v => v < vencimiento).pop() || null;
  if (!emision && valores.length > 1) emision = valores.filter(v => v < vencimiento)[0] || null;
  const num = T.match(RE_NUM);
  const tipo = (TIPOS.find(t => t.re.test(T)) || {}).key || null;
  const pats = patentes(T);
  const objetivo = String(patenteVehiculo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return {
    modo, tipo, emision, vencimiento,
    numero: num ? num[1].replace(/\s+/g, '').replace(/\.$/, '') : null,
    patentes: pats,
    patenteOk: !objetivo || !pats.length ? null : pats.some(p => p.replace(/[^A-Z0-9]/g, '') === objetivo),
    texto
  };
};
