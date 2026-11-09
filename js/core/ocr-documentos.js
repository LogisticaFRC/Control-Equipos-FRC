// =====================================================================
// LECTURA GRATIS DE DOCUMENTOS ESCANEADOS (OCR en el navegador, sin costo ni claves)
// ---------------------------------------------------------------------
// Usa pdf.js (para ver las páginas del PDF) + Tesseract.js (lee el texto IMPRESO).
// La letra a mano NO se lee bien con este método, así que solo se sacan datos impresos:
//   · Qué es cada página: INTERVENCIÓN MECÁNICA, PAUTA DE MANTENCIÓN, ART u ORDEN DE COMPRA
//   · N° de folio de la hoja (impreso en color, ej. Nº 000214)
//   · Si el PDF trae ART → "Uso de ART = SI"
//   · Si trae una OC impresa → N° de OC
//   · El tipo de equipo de la pauta ("PAUTA MANTENCION COMPRESOR" → COMPRESOR)
// Las librerías se cargan solo la primera vez que se usa (no hacen más lenta la página).
// Regla: una hoja de INTERVENCIÓN siempre es intervención; una PAUTA es mantención
// (la intervención a veces se escribe en una pauta, eso lo corrige el usuario).
// =====================================================================
const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const TESS_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const MAX_PAGINAS = 15;      // páginas que se revisan por documento (se dibujan de a una)
const ESCALA = 2;            // resolución con que se dibuja cada página (2 ≈ 150 dpi)

const sinTildes = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const cargas = {};
const cargarScript = (url, global) => {
  if (window[global]) return Promise.resolve(window[global]);
  if (!cargas[url]) cargas[url] = new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = url; s.onload = () => ok(window[global]);
    s.onerror = () => { delete cargas[url]; mal(new Error('No se pudo cargar el lector de documentos (revisa la conexión).')); };
    document.head.appendChild(s);
  });
  return cargas[url];
};

let workerP = null;
const getWorker = async () => {
  if (!workerP) workerP = (async () => {
    const T = await cargarScript(TESS_URL, 'Tesseract');
    return T.createWorker('spa');
  })().catch(e => { workerP = null; throw e; });
  return workerP;
};
/** Libera la memoria del lector (al cerrar el panel). */
export const cerrarLector = async () => { if (workerP) { try { (await workerP).terminate(); } catch (_) {} workerP = null; } };

const extDe = (n) => String(n || '').split('.').pop().toLowerCase();

/** Prepara el archivo (PDF o imagen). Las páginas se dibujan de a UNA cuando se piden
 *  (así un PDF de 15 páginas no llena la memoria). Devuelve { total, n, pagina(k) → canvas }. */
const abrirArchivo = async (file) => {
  const ext = extDe(file.name);
  if (ext === 'pdf' || file.type === 'application/pdf') {
    const pdfjs = await cargarScript(PDFJS_URL, 'pdfjsLib');
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    return {
      total: pdf.numPages, n: Math.min(pdf.numPages, MAX_PAGINAS),
      pagina: async (k) => {
        const page = await pdf.getPage(k + 1);
        const vp = page.getViewport({ scale: ESCALA });
        const c = document.createElement('canvas');
        c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        page.cleanup();
        return c;
      },
      cerrar: () => { try { pdf.destroy(); } catch (_) {} }
    };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    return { total: 1, n: 1, pagina: async () => c, cerrar: () => {} };
  } finally { URL.revokeObjectURL(url); }
};

/** Copia de una zona del canvas usando solo el canal ROJO y en blanco/negro:
 *  así la tinta de color del folio (verde/azul/rojo oscuro) se ve negra y el fondo blanco. */
const recorteRojo = (src, x, y, w, h) => {
  x = Math.max(0, Math.floor(x)); y = Math.max(0, Math.floor(y));
  w = Math.min(src.width - x, Math.floor(w)); h = Math.min(src.height - y, Math.floor(h));
  if (w < 10 || h < 10) return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(src, x, y, w, h, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h);
  for (let k = 0; k < d.data.length; k += 4) {
    const v = d.data[k] < 140 ? 0 : 255;
    d.data[k] = d.data[k + 1] = d.data[k + 2] = v;
  }
  ctx.putImageData(d, 0, 0);
  return c;
};

// ---------------------------------------------------------------------
// Qué es cada página (por sus textos impresos; tolera errores del OCR)
// ---------------------------------------------------------------------
// Se compara SIN espacios (el OCR a veces junta o separa palabras). Título = 3 puntos, resto = 1.
const CLAVES = {
  INTERVENCION: { titulo: ['INTERVENCIONMECANICA', 'CAUSADELAINTERVENCION', 'DESCRIPCIONDELOREALIZADO'],
    otras: ['LUGARINTERVENCION', 'USUARIOARRIENDO', 'VALEDECONSUMO', 'CAUSADELAFALLA', 'FALLAOPERACIONAL', 'HORAFALLA', 'MECANICORESPONSABLE', 'LUBRICANTEUTILIZADO', 'SERVICIOTECNICO'] },
  PAUTA: { titulo: ['PAUTAMANTENCION', 'PAUTADEMANTENCION', 'MECANICOSINVOLUCRADOS'],
    otras: ['REEMPLAZO', 'REFERENCIAFILTRO', 'LUBRICANTES', 'REPUESTOS', 'PROXMANT', 'FILTRODECOMBUSTIBLE', 'COMBUSTIBLEPRIMARIO', 'COMBUSTIBLESECUNDARIO', 'UNIDADCOMPRESORA', 'NIVELDEACEITE', 'NIVELDEREFRIGERANTE', 'LIQUIDOREFRIGERANTE', 'TIPOMANTENCION'] },
  ART: { titulo: ['CONTROLESCRITICOS', 'TARJETAVERDE', 'PREGUNTASTRANSVERSALES', 'VALIDACIONART'],
    otras: ['CONTROLCRITICO', 'TRABAJOSENSIMULTANEO', 'RIESGOSCRITICOS', 'OTROSRIESGOS', 'SUPERVISORQUE', 'ASIGNAELTRABAJO', 'EPPDEFINIDOS', 'SEGREGACION', 'FRECUENCIARADIAL', 'MEDIDADECONTROL', 'EQUIPOEJECUTOR', 'TRABAJADOR1', 'PLANIFICACIONDELTRABAJO', 'PROTOCOLODEEMERGENCIA'] },
  OC: { titulo: ['ORDENDECOMPRA'],
    otras: ['PROVEEDOR', 'CONDICIONDEPAGO', 'FORMADEPAGO', 'PRECIOUNITARIO', 'VALORNETO', 'SUBTOTAL', 'FACTURARA', 'DESPACHARA', 'FECHAENTREGA'] }
};
export const ETIQUETA_PAGINA = { INTERVENCION: 'Intervención mecánica', PAUTA: 'Pauta de mantención', ART: 'ART', OC: 'Orden de compra', OTRO: 'Otro' };

const clasificar = (txt) => {
  const t = sinTildes(txt).replace(/[^A-Z0-9]/g, '');
  let mejor = 'OTRO', pts = 0;
  Object.entries(CLAVES).forEach(([k, c]) => {
    const p = c.titulo.reduce((s, w) => s + (t.includes(w) ? 3 : 0), 0) + c.otras.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
    if (p > pts) { pts = p; mejor = k; }
  });
  return pts >= 2 ? mejor : 'OTRO';
};

const palabrasDe = (data) => {
  if (data.words && data.words.length) return data.words;
  const out = [];
  (data.blocks || []).forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => (l.words || []).forEach(w => out.push(w)))));
  return out;
};

/** Busca en el texto (solo dígitos) un folio de 6 cifras que empiece con 0 (ej. 000214, 005119).
 *  Si el "Nº" se leyó como un dígito ("2005119") se toman las últimas 6. */
const folioDeTexto = (texto) => {
  for (const linea of String(texto || '').split('\n')) {
    for (const tok of linea.replace(/(\d)\s(?=\d)/g, '$1').match(/\d+/g) || []) {
      if (tok.length === 6 && tok[0] === '0') return tok;
      if (tok.length === 7 && tok[1] === '0' && tok[2] === '0') return tok.slice(1);
    }
  }
  return '';
};

/** N° de folio: se busca a la derecha del título (pauta) o bajo el título (intervención). */
const leerFolio = async (worker, canvas, palabras, tipo, textoPagina) => {
  const W = canvas.width, H = canvas.height;
  const ancla = palabras.find(w => w.bbox && w.bbox.y0 < H * 0.25 && (tipo === 'PAUTA' ? /PAUTA/.test(sinTildes(w.text)) : /INTERVEN/.test(sinTildes(w.text))));
  const zonas = [];
  if (ancla) {
    const h = ancla.bbox.y1 - ancla.bbox.y0;
    if (tipo === 'PAUTA') zonas.push([ancla.bbox.x0 + W * 0.25, ancla.bbox.y0 - h, W * 0.38, h * 3.2]);
    else zonas.push([ancla.bbox.x0, ancla.bbox.y1, W * 0.5, h * 3.5]);
  }
  zonas.push([W * 0.45, H * 0.02, W * 0.4, H * 0.1]);   // respaldo: arriba a la derecha
  await worker.setParameters({ tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: '6' });
  try {
    for (const [x, y, w, h] of zonas) {
      const c = recorteRojo(canvas, x, y, w, h);
      if (!c) continue;
      const { data } = await worker.recognize(c);
      const f = folioDeTexto(data.text);
      if (f) return f;
    }
  } finally {
    await worker.setParameters({ tessedit_char_whitelist: '', tessedit_pageseg_mode: '3' });
  }
  const m = sinTildes(textoPagina).match(/N\s*[°º2O]?\s*[-:]?\s*(0\d{5})/);
  return m ? m[1] : '';
};

const leerOC = (txt) => {
  const t = sinTildes(txt);
  const num = (t.match(/ORDEN\s+DE\s+COMPRA[^0-9\n]{0,25}(\d{3,10})/) || t.match(/\bO\.?\s?C\.?\s*N?\s*[°º:#]?\s*(\d{3,10})/) || [])[1] || '';
  const tot = (t.match(/TOTAL[^0-9\n]{0,20}([\d.,]{4,})/) || [])[1] || '';
  return num ? { numero: num, total: tot ? Number(tot.replace(/[.,](\d{3})/g, '$1').replace(/[.,]\d{1,2}$/, '').replace(/\D/g, '')) || 0 : 0 } : null;
};

/**
 * Lee un documento. onProgreso(texto) se llama con el avance.
 * Devuelve { paginas:[{n,tipo}], total, tipo:'INTERVENCION'|'PAUTA'|'', esIntervencion, folio, art, oc, equipoPauta }
 */
let cola = Promise.resolve();
/** Uno a la vez (el lector es uno solo): las lecturas se ponen en fila. */
export const leerDocumento = (file, onProgreso = () => {}) => {
  const p = cola.then(() => leerUno(file, onProgreso));
  cola = p.catch(() => {});
  return p;
};
const equipoDeTexto = (txt) => {
  const m = sinTildes(txt).match(/PAUTA\s*(?:DE\s*)?MANTENCI\S*\s+([A-Z]{4,}(?:\s+DE\s+[A-Z]{4,})?)/);
  if (!m) return '';
  const e = m[1];
  return /^COMPRES/.test(e) ? 'COMPRESOR' : /^GENERAD/.test(e) ? 'GENERADOR' : /^TORRE/.test(e) ? 'TORRE DE ILUMINACION'
    : /^MANIPUL/.test(e) ? 'MANIPULADOR' : /^MINICARG/.test(e) ? 'MINICARGADOR' : /^CAMIONET/.test(e) ? 'CAMIONETA' : e;
};

const leerUno = async (file, onProgreso) => {
  onProgreso('Preparando lector…');
  const worker = await getWorker();
  const arch = await abrirArchivo(file);
  // principales = hojas de intervención / pauta. Una pauta de 2 hojas (generador, manipulador…) es UNA sola:
  // la página siguiente del mismo tipo sin folio (o con el mismo folio) se considera continuación.
  const res = { paginas: [], total: arch.total, principales: [], tipo: '', esIntervencion: false, folio: '', art: false, oc: null, ocs: [], equipoPauta: '' };
  try {
    for (let k = 0; k < arch.n; k++) {
      onProgreso(`Leyendo página ${k + 1} de ${arch.n}…`);
      let c = await arch.pagina(k);
      const { data } = await worker.recognize(c, {}, { text: true, blocks: true });
      const txt = data.text || '';
      const tipo = clasificar(txt);
      res.paginas.push({ n: k + 1, tipo });
      if (tipo === 'ART') res.art = true;
      if (tipo === 'OC') { const oc = leerOC(txt); if (oc && !res.ocs.some(o => o.numero === oc.numero)) res.ocs.push(oc); }
      if (tipo === 'INTERVENCION' || tipo === 'PAUTA') {
        let folio = '';
        try { folio = await leerFolio(worker, c, palabrasDe(data), tipo, txt); } catch (e) { console.warn('[OCR] folio', e); }
        const ult = res.principales[res.principales.length - 1];
        const continua = ult && ult.tipo === tipo && ult.paginas[ult.paginas.length - 1] >= k - 1 && (!folio || !ult.folio || folio === ult.folio);
        if (continua) { ult.paginas.push(k + 1); if (!ult.folio) ult.folio = folio; if (!ult.equipo) ult.equipo = equipoDeTexto(txt); }
        else res.principales.push({ tipo, folio, equipo: tipo === 'PAUTA' ? equipoDeTexto(txt) : '', paginas: [k + 1] });
      }
      c = null;   // libera memoria
    }
  } finally { arch.cerrar(); }
  const p1 = res.principales[0];
  if (p1) { res.tipo = p1.tipo; res.esIntervencion = p1.tipo === 'INTERVENCION'; res.folio = p1.folio; res.equipoPauta = p1.equipo; }
  res.oc = res.ocs[0] || null;
  onProgreso('');
  return res;
};

/** Si el PDF trae más de una hoja principal: texto de aviso (o ''). */
export const avisoVariasHojas = (r) => !r || (r.principales || []).length < 2 ? ''
  : `Este PDF trae ${r.principales.length} hojas: ` + r.principales.map(h => `${h.tipo === 'PAUTA' ? 'pauta' : 'intervención'}${h.folio ? ' ' + h.folio : ''} (pág. ${h.paginas.join('-')})`).join(' + ')
    + '. Solo se usó la primera; registra la otra aparte.';

/** Texto corto para mostrar el resultado. */
export const resumenLectura = (r) => {
  if (!r) return '';
  const partes = [];
  if (r.tipo) partes.push(ETIQUETA_PAGINA[r.tipo] + (r.equipoPauta ? ' ' + r.equipoPauta.toLowerCase() : ''));
  if (r.folio) partes.push('folio ' + r.folio);
  if (r.art) partes.push('trae ART');
  if ((r.ocs || []).length) partes.push('OC ' + r.ocs.map(o => o.numero).join(', '));
  if ((r.principales || []).length > 1) partes.push(r.principales.length + ' hojas principales');
  partes.push(`${r.paginas.length}${r.total > r.paginas.length ? '/' + r.total : ''} pág.`);
  return partes.join(' · ');
};
