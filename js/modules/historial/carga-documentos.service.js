// =====================================================================
// HISTORIAL · Carga masiva de documentos (PDF / JPG) → se enlazan a su mantención / intervención
// ---------------------------------------------------------------------
// Se elige una CARPETA (ej. "2026/ABRIL") o varios archivos. Del nombre (y de la carpeta) se lee:
//   · AFI(s): números de 2 a 4 dígitos o patentes XXXX-XX que existan en el inventario
//             ("127_147 07-04-2026.pdf" o "759, 760, 761" → el mismo archivo para cada AFI)
//   · Fecha:  dd-mm-aaaa del nombre; si no tiene, la de la carpeta (ej. ABRIL/07-04-2026)
//   · Tipo:   si el nombre dice "MANTENCION" → registro de MANTENCIÓN; si no → cualquier otra intervención
// Con eso busca el registro de BD_HISTORIAL (mismo AFI + fecha + tipo). Se puede corregir fila por fila.
// Al confirmar: sube el archivo a Storage (archivos_frc/historial/<AFI>/...) y lo guarda en BD_HISTORIAL.link.
// Si a un mismo registro le corresponden varios archivos, se UNEN en un solo PDF (pdf-lib).
// =====================================================================
import { supabaseClient, sb, errMsg, subirArchivoStorage } from '../../core/supabase.js';
import { dbEquipos, dbIntervenciones, soloEditor, cargarDatosDesdeSupabase } from '../../core/store.js';
import { normalizarFecha, sumarDiasISO, diasEntre, formatDateForDisplay } from '../../core/utils.js';
import { TABLA_HISTORIAL } from './historial.mapper.js';
import { leerDocumento, resumenLectura, avisoVariasHojas } from '../../core/ocr-documentos.js';
import { ocsDeTexto } from '../oc/oc.mapper.js';

const { ref, shallowRef, computed } = Vue;

const PDFLIB_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
const EXT_OK = ['pdf', 'jpg', 'jpeg', 'png'];
const DIAS_TOLERANCIA = 3;     // si no hay registro el mismo día, busca ± 3 días
const DIAS_LISTA = 20;         // registros que se ofrecen en la lista para elegir a mano (± 20 días)

const pad2 = (n) => String(n).padStart(2, '0');
const sinTildes = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const esMantencionReg = (i) => { const c = sinTildes(i.causa), t = sinTildes(i.tipoMant); return c.includes('MANTENCION') || c.includes('MANTENIMIENTO') || t.includes('MANTENCION'); };
const extDe = (n) => String(n).split('.').pop().toLowerCase();
export const fmtMB = (b) => `${(b / 1048576).toFixed(1)} MB`;

// ---------------------------------------------------------------------
// Lectura del nombre
// ---------------------------------------------------------------------
const fechaISO = (d, m, y) => {
  let yy = Number(y); if (yy < 100) yy += 2000;
  const dd = Number(d), mm = Number(m);
  if (!(dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 2015 && yy <= 2100)) return '';
  return `${yy}-${pad2(mm)}-${pad2(dd)}`;
};
const RE_FECHA = /(\d{1,2})[-_./](\d{1,2})[-_./](\d{4}|\d{2})(?!\d)/;
const RE_FECHA_CORTA = /(?<!\d)(\d{1,2})-(\d{1,2})(?![-\d])/;   // "14-01" (sin año)

/** Índice de AFIs del inventario: clave normalizada → AFI tal como está guardado. */
const indiceAfis = () => {
  const m = new Map();
  dbEquipos.value.forEach(e => {
    const a = String(e.afi || '').trim().toUpperCase();
    if (!a) return;
    m.set(a, e.afi);
    if (/^\d+$/.test(a)) m.set(String(Number(a)), e.afi);           // "080" = "80"
    m.set(a.replace(/[\s-]/g, ''), e.afi);                            // "LFPX51" = "LFPX-51"
  });
  return m;
};

/** Lee AFI(s), fecha(s) y tipo de un archivo. */
export const leerNombre = (file, idx) => {
  const ruta = file.webkitRelativePath || file.name;
  const partes = ruta.split('/');
  const nombre = partes.pop();
  const base = nombre.replace(/\.[^.]+$/, '');
  const up = sinTildes(base).replace(/_/g, ' ');
  const anioRuta = (ruta.match(/(?:^|\/)(20\d{2})(?:\/|$)/) || [])[1] || '';

  // Fechas candidatas: la del nombre y la de la carpeta
  const fechas = [];
  const mN = up.match(RE_FECHA);
  if (mN) fechas.push(fechaISO(mN[1], mN[2], mN[3]));
  else {
    const mC = up.match(RE_FECHA_CORTA);
    const anioCarp = (partes.join('/').match(RE_FECHA) || [])[3] || anioRuta;
    if (mC && anioCarp) fechas.push(fechaISO(mC[1], mC[2], anioCarp));
  }
  for (let k = partes.length - 1; k >= 0; k--) {
    const mF = sinTildes(partes[k]).match(RE_FECHA);
    if (mF) { fechas.push(fechaISO(mF[1], mF[2], mF[3])); break; }
  }
  const fechasOk = [...new Set(fechas.filter(Boolean))];

  // AFIs: se quita la fecha y se buscan patentes y números de 2 a 4 dígitos que existan en el inventario
  // Se quitan la fecha y los sufijos de copia/página: "_001", "_page-0002", "(1)"
  const sinFecha = up.replace(new RegExp(RE_FECHA.source, 'g'), ' ').replace(new RegExp(RE_FECHA_CORTA.source, 'g'), ' ')
    .replace(/PAGE\s*-?\s*\d+/g, ' ').replace(/\(\d+\)/g, ' ');
  const idx2 = idx || indiceAfis();
  const afis = [];
  (sinFecha.match(/\b[A-Z]{4}\s?-?\s?\d{2}\b|\b\d{2,4}\b/g) || []).forEach(t => {
    if (/^0\d/.test(t)) return;   // "001", "02" = n° de página o copia, no AFI
    const k = t.replace(/[\s-]/g, '');
    const afi = idx2.get(k) || idx2.get(/^\d+$/.test(k) ? String(Number(k)) : k);
    if (afi && !afis.includes(afi)) afis.push(afi);
  });

  return { ruta, nombre, ext: extDe(nombre), esMant: /MANTENCION|MANTENIMIENTO/.test(up), fechas: fechasOk, afis };
};

// ---------------------------------------------------------------------
// Búsqueda del registro del Historial
// ---------------------------------------------------------------------
const histPorAfi = () => {
  const m = new Map();
  dbIntervenciones.value.forEach(i => {
    const k = String(i.afi || '').trim().toUpperCase();
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(i);
  });
  return m;
};

/** Registros del AFI cerca de la fecha (para elegir a mano), más cercanos primero. */
const cercanos = (regs, fecha, dias) => regs
  .map(r => ({ r, d: fecha ? Math.abs(diasEntre(normalizarFecha(r.fecha), fecha) ?? 9999) : 9999 }))
  .filter(x => !fecha || x.d <= dias)
  .sort((a, b) => a.d - b.d || String(b.r.fecha).localeCompare(String(a.r.fecha)))
  .map(x => x.r);

/** Mejor registro para (AFI, fechas, tipo). Devuelve { reg, nivel: 'EXACTO'|'APROX'|'OTRO_TIPO'|'' , opciones } */
const buscarRegistro = (regs, fechas, esMant) => {
  const mismoTipo = (r) => esMantencionReg(r) === esMant;
  const fechaRef = fechas[0] || '';
  const opciones = cercanos(regs, fechaRef, DIAS_LISTA);
  const elegir = (lista) => lista.find(r => !r.linkDrive) || lista[0] || null;
  for (const f of fechas) {
    const exactos = regs.filter(r => normalizarFecha(r.fecha) === f && mismoTipo(r));
    if (exactos.length) return { reg: elegir(exactos), nivel: 'EXACTO', varios: exactos.length > 1, opciones };
  }
  for (const f of fechas) {
    const aprox = cercanos(regs, f, DIAS_TOLERANCIA).filter(mismoTipo);
    if (aprox.length) return { reg: elegir(aprox), nivel: 'APROX', opciones };
  }
  for (const f of fechas) {
    const otro = regs.filter(r => normalizarFecha(r.fecha) === f);
    if (otro.length) return { reg: elegir(otro), nivel: 'OTRO_TIPO', opciones };
  }
  return { reg: null, nivel: '', opciones };
};

// ---------------------------------------------------------------------
// Estado del panel
// ---------------------------------------------------------------------
export const showCargaDocs = ref(false);
export const filasCarga = ref([]);          // una fila por (archivo, AFI)
export const archivosCarga = shallowRef([]); // File[] (no reactivo)
export const ignoradosCarga = ref([]);       // archivos que no son PDF/imagen
export const reemplazarExistentes = ref(false);
export const subiendoCarga = ref(false);
export const progresoCarga = ref({ hechos: 0, total: 0, errores: [] });
export const filtroCarga = ref('TODOS');
export const leerContenidoCarga = ref(true);   // leer folio / ART / OC de cada documento al subir
export const lecturasLog = ref([]);            // lo que se completó (para revisar o deshacer)

export const abrirCargaDocs = () => {
  if (!soloEditor()) return;
  filasCarga.value = []; archivosCarga.value = []; ignoradosCarga.value = [];
  progresoCarga.value = { hechos: 0, total: 0, errores: [] };
  filtroCarga.value = 'TODOS';
  lecturasLog.value = [];
  showCargaDocs.value = true;
};

let seq = 0;
/** Al elegir carpeta o archivos: arma la tabla de vista previa. */
export const elegirArchivosCarga = (e) => {
  const todos = Array.from(e.target.files || []);
  try { e.target.value = ''; } catch (_) {}
  if (!todos.length) return;
  const files = todos.filter(f => EXT_OK.includes(extDe(f.name)));
  ignoradosCarga.value = todos.filter(f => !EXT_OK.includes(extDe(f.name))).map(f => f.webkitRelativePath || f.name);
  const idx = indiceAfis(), hist = histPorAfi();
  const filas = [];
  const inicio = archivosCarga.value.length;
  archivosCarga.value = [...archivosCarga.value, ...files];
  files.forEach((file, k) => {
    const info = leerNombre(file, idx);
    const afis = info.afis.length ? info.afis : [''];
    afis.forEach(afi => {
      const regs = afi ? hist.get(String(afi).toUpperCase()) || [] : [];
      const b = afi ? buscarRegistro(regs, info.fechas, info.esMant) : { reg: null, nivel: '', opciones: [] };
      filas.push({
        uid: ++seq, fileIdx: inicio + k, ruta: info.ruta, nombre: info.nombre, tamano: file.size,
        afi, afiTexto: afi, fecha: info.fechas[0] || '', esMant: info.esMant,
        regId: b.reg ? b.reg.id : '', nivel: b.nivel, varios: Boolean(b.varios), opciones: b.opciones,
        incluir: Boolean(b.reg)
      });
    });
  });
  filasCarga.value = [...filasCarga.value, ...filas]
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.afi).localeCompare(String(b.afi), undefined, { numeric: true }));
};

/** Al corregir a mano el AFI de una fila: vuelve a buscar el registro. */
export const cambiarAfiFila = (f) => {
  const idx = indiceAfis();
  const k = String(f.afiTexto || '').trim().toUpperCase().replace(/[\s-]/g, '');
  const afi = idx.get(k) || idx.get(/^\d+$/.test(k) ? String(Number(k)) : k) || '';
  f.afi = afi;
  const regs = afi ? histPorAfi().get(String(afi).toUpperCase()) || [] : [];
  const b = afi ? buscarRegistro(regs, f.fecha ? [f.fecha] : [], f.esMant) : { reg: null, nivel: '', opciones: [] };
  f.regId = b.reg ? b.reg.id : ''; f.nivel = b.nivel; f.varios = Boolean(b.varios); f.opciones = b.opciones; f.incluir = Boolean(b.reg);
};
export const cambiarFechaFila = (f) => { cambiarAfiFila(f); };

const regPorId = computed(() => new Map(dbIntervenciones.value.map(i => [String(i.id), i])));
export const registroDe = (f) => f.regId ? regPorId.value.get(String(f.regId)) || null : null;
export const textoRegistro = (r) => r ? `${formatDateForDisplay(r.fecha)} · ${r.causa || '-'}${r.tipoMant ? ' · ' + r.tipoMant : ''}${r.linkDrive ? ' 📎' : ''}` : '';

/** Estado de una fila para mostrar color / filtro. */
export const estadoFila = (f) => {
  const r = registroDe(f);
  if (!f.afi) return { key: 'SIN_AFI', label: 'Sin AFI', cls: 'bg-slate-200 text-slate-700' };
  if (!r) return { key: 'SIN_REG', label: 'Sin registro', cls: 'bg-rose-100 text-rose-700' };
  if (r.linkDrive && !reemplazarExistentes.value) return { key: 'YA_TIENE', label: 'Ya tiene documento', cls: 'bg-sky-100 text-sky-800' };
  if (f.nivel === 'EXACTO' && !f.varios) return { key: 'OK', label: 'Listo', cls: 'bg-emerald-100 text-emerald-800' };
  if (f.nivel === 'EXACTO') return { key: 'REVISAR', label: 'Varios ese día', cls: 'bg-amber-100 text-amber-800' };
  if (f.nivel === 'APROX') return { key: 'REVISAR', label: 'Fecha cercana', cls: 'bg-amber-100 text-amber-800' };
  if (f.nivel === 'OTRO_TIPO') return { key: 'REVISAR', label: f.esMant ? 'No es mantención' : 'Es mantención', cls: 'bg-amber-100 text-amber-800' };
  return { key: 'REVISAR', label: 'Elegido a mano', cls: 'bg-amber-100 text-amber-800' };
};

export const resumenCarga = computed(() => {
  const r = { total: filasCarga.value.length, OK: 0, REVISAR: 0, SIN_REG: 0, SIN_AFI: 0, YA_TIENE: 0, aSubir: 0, mb: 0 };
  const archivos = new Set();
  filasCarga.value.forEach(f => {
    const e = estadoFila(f); r[e.key]++;
    if (filaSeSube(f)) { r.aSubir++; if (!archivos.has(f.fileIdx)) { archivos.add(f.fileIdx); r.mb += f.tamano; } }
  });
  r.registros = new Set(filasCarga.value.filter(filaSeSube).map(f => String(f.regId))).size;
  return r;
});
export const filaSeSube = (f) => {
  if (!f.incluir || !f.regId) return false;
  const r = registroDe(f);
  return Boolean(r) && (!r.linkDrive || reemplazarExistentes.value);
};
export const filasVisibles = computed(() => filtroCarga.value === 'TODOS'
  ? filasCarga.value : filasCarga.value.filter(f => estadoFila(f).key === filtroCarga.value));

export const quitarFila = (f) => { filasCarga.value = filasCarga.value.filter(x => x.uid !== f.uid); };

// ---------------------------------------------------------------------
// Unir varios archivos en un PDF (pdf-lib se carga solo si hace falta)
// ---------------------------------------------------------------------
let cargaPdfLib = null;
const cargarPdfLib = () => {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  if (!cargaPdfLib) cargaPdfLib = new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = PDFLIB_URL; s.onload = () => ok(window.PDFLib);
    s.onerror = () => { cargaPdfLib = null; mal(new Error('No se pudo cargar pdf-lib (revisa la conexión).')); };
    document.head.appendChild(s);
  });
  return cargaPdfLib;
};
const unirEnPdf = async (files) => {
  const { PDFDocument } = await cargarPdfLib();
  const out = await PDFDocument.create();
  for (const f of files) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const ext = extDe(f.name);
    if (ext === 'pdf') {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      (await out.copyPages(src, src.getPageIndices())).forEach(p => out.addPage(p));
    } else {
      const img = ext === 'png' ? await out.embedPng(bytes) : await out.embedJpg(bytes);
      const page = out.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }
  }
  return new File([await out.save()], 'documentos.pdf', { type: 'application/pdf' });
};

const limpiar = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_');

// ---------------------------------------------------------------------
// Subir y enlazar
// ---------------------------------------------------------------------
export const subirCargaDocs = async () => {
  if (!soloEditor()) return;
  // Agrupa por registro (un registro puede recibir varios archivos → se unen)
  const grupos = new Map();
  filasCarga.value.filter(filaSeSube).forEach(f => {
    const k = String(f.regId);
    if (!grupos.has(k)) grupos.set(k, { regId: f.regId, afi: f.afi, fecha: f.fecha, filas: [] });
    if (!grupos.get(k).filas.some(x => x.fileIdx === f.fileIdx)) grupos.get(k).filas.push(f);
  });
  if (!grupos.size) return alert('No hay archivos listos para subir.');
  if (!confirm(`Se subirán ${resumenCarga.value.mb ? fmtMB(resumenCarga.value.mb) : ''} y se enlazarán ${grupos.size} registros del Historial. ¿Continuar?`)) return;

  subiendoCarga.value = true;
  progresoCarga.value = { hechos: 0, total: grupos.size, errores: [] };
  const lista = Array.from(grupos.values());
  const trabajar = async (g) => {
    try {
      const files = g.filas.map(f => archivosCarga.value[f.fileIdx]);
      const reg = regPorId.value.get(String(g.regId));
      const fecha = normalizarFecha(reg?.fecha) || g.fecha || 'sin-fecha';
      let file = files[0], nombre = files[0].name;
      if (files.length > 1) {
        try { file = await unirEnPdf(files); nombre = `${g.afi}_${fecha}_unidos.pdf`; }
        catch (err) { console.warn('[Carga docs] No se pudieron unir, se sube el primero', err); }
      }
      const url = await subirArchivoStorage(`historial/${limpiar(g.afi)}/${fecha}_${g.regId}_${Date.now()}_${limpiar(nombre)}`, file);
      let extra = {};
      if (leerContenidoCarga.value && reg) {
        try { extra = await leerYProponer(reg, files); } catch (err) { console.warn('[Lectura]', err); }
      }
      await actualizarRegistro(g.regId, { link: url, ...extra.campos });
      if (extra.entrada) lecturasLog.value.unshift(extra.entrada);
      g.filas.forEach(f => { f.subido = true; });
    } catch (err) {
      progresoCarga.value.errores.push(`${g.afi} ${formatDateForDisplay(g.fecha)}: ${errMsg(err)}`);
      g.filas.forEach(f => { f.error = errMsg(err); });
    } finally { progresoCarga.value.hechos++; }
  };
  // 3 subidas a la vez
  let i = 0;
  const hilo = async () => { while (i < lista.length) { const g = lista[i++]; await trabajar(g); } };
  await Promise.all([hilo(), hilo(), hilo()]);
  await cargarDatosDesdeSupabase();
  subiendoCarga.value = false;
  const e = progresoCarga.value.errores.length;
  alert(`Listo: ${progresoCarga.value.total - e} registros enlazados${e ? ` · ${e} con error (ver lista)` : ''}.`);
  // Quita de la tabla lo que ya se subió
  filasCarga.value = filasCarga.value.filter(f => !f.subido);
};

// ---------------------------------------------------------------------
// Lectura del contenido (OCR gratis): SOLO rellena campos vacíos, nunca borra ni reemplaza
// ---------------------------------------------------------------------
let faltanColumnas = false;   // si no se ejecutó sql/historial_documentos.sql
const COLS_NUEVAS = ['art', 'numero_folio'];

/** Lee los archivos y arma qué columnas vacías del registro se pueden completar. */
const leerYProponer = async (reg, files) => {
  const lecturas = [];
  for (const f of files) lecturas.push(await leerDocumento(f));
  const r = { tipo: '', folio: '', art: false, ocs: [], resumen: lecturas.map(resumenLectura).join(' | ') };
  lecturas.forEach(l => {
    if (!r.tipo && l.tipo) r.tipo = l.tipo;
    if (!r.folio && l.folio) r.folio = l.folio;
    if (l.art) r.art = true;
    (l.ocs || []).forEach(o => { if (o.numero && !r.ocs.includes(o.numero)) r.ocs.push(o.numero); });
  });
  const campos = {}, previo = {}, cambios = [];
  if (!faltanColumnas && r.folio && !reg.numeroFolio) { campos.numero_folio = r.folio; previo.numero_folio = null; cambios.push('folio ' + r.folio); }
  if (!faltanColumnas && r.art && !reg.usoArt) { campos.art = 'SI'; previo.art = null; cambios.push('ART = SI'); }
  const ocsYa = ocsDeTexto(reg.numeroOC);
  const ocsNuevas = r.ocs.filter(n => !ocsYa.includes(n));
  if (ocsNuevas.length) { campos.numero_oc = [reg.numeroOC, ...ocsNuevas].filter(Boolean).join(', '); previo.numero_oc = reg.numeroOC || null; cambios.push('OC ' + ocsNuevas.join(', ')); }
  const avisos = [];
  if (r.tipo === 'INTERVENCION' && esMantencionReg(reg)) avisos.push('La hoja es INTERVENCIÓN pero el registro es MANTENCIÓN');
  lecturas.forEach(l => { const v = avisoVariasHojas(l); if (v) avisos.push(v); });
  const aviso = avisos.join(' · ');
  return { campos, entrada: { id: reg.id, afi: reg.afi, fecha: reg.fecha, resumen: r.resumen, cambios, previo, aviso, deshecho: false } };
};

/** Update tolerante: si faltan las columnas nuevas, guarda lo demás y avisa. */
const actualizarRegistro = async (id, campos) => {
  if (!Object.keys(campos).length) return;
  try { await sb(supabaseClient.from(TABLA_HISTORIAL).update(campos).eq('id', id)); }
  catch (err) {
    if (!/'(art|numero_folio)' column|column \S*(art|numero_folio)\b/i.test(errMsg(err))) throw err;
    faltanColumnas = true;
    const c = { ...campos }; COLS_NUEVAS.forEach(k => delete c[k]);
    if (Object.keys(c).length) await sb(supabaseClient.from(TABLA_HISTORIAL).update(c).eq('id', id));
    progresoCarga.value.errores.push('Falta ejecutar sql/historial_documentos.sql en Supabase: no se guardó el folio ni el ART.');
  }
};

/** Vuelve a dejar como estaban los campos que completó la lectura. */
export const deshacerLecturas = async () => {
  const lista = lecturasLog.value.filter(e => !e.deshecho && Object.keys(e.previo).length);
  if (!lista.length) return alert('No hay cambios de lectura para deshacer.');
  if (!confirm(`Se dejarán como estaban ${lista.length} registro(s) (solo los campos que completó la lectura). ¿Continuar?`)) return;
  for (const e of lista) {
    try { await sb(supabaseClient.from(TABLA_HISTORIAL).update(e.previo).eq('id', e.id)); e.deshecho = true; }
    catch (err) { alert(`AFI ${e.afi}: ${errMsg(err)}`); }
  }
  await cargarDatosDesdeSupabase();
};

// ---------- Leer documentos que YA están subidos (sin volver a subirlos) ----------
const CLAVE_LEIDOS = 'frc_ocr_leidos';
const leidos = () => { try { return new Set(JSON.parse(localStorage.getItem(CLAVE_LEIDOS) || '[]')); } catch (_) { return new Set(); } };
const marcarLeido = (id) => { try { const s = leidos(); s.add(String(id)); localStorage.setItem(CLAVE_LEIDOS, JSON.stringify([...s])); } catch (_) {} };
const esDeStorage = (url) => /\/storage\/v1\/object\//.test(String(url || ''));

export const pendientesRelectura = computed(() => {
  const ya = leidos();
  return dbIntervenciones.value.filter(i => i.linkDrive && esDeStorage(i.linkDrive) && !i.numeroFolio && !ya.has(String(i.id)));
});
export const releyendo = ref(false);
export const loteRelectura = ref(25);
let detener = false;
export const detenerRelectura = () => { detener = true; };

export const releerSubidos = async () => {
  if (!soloEditor()) return;
  const lista = pendientesRelectura.value.slice(0, Number(loteRelectura.value) || 25);
  if (!lista.length) return alert('No hay documentos subidos pendientes de leer.');
  if (!confirm(`Se leerán ${lista.length} documento(s) ya subidos.\nSolo se completan campos VACÍOS (folio, ART, OC); no se borra ni reemplaza nada.\nTarda unos segundos por página. ¿Continuar?`)) return;
  releyendo.value = true; detener = false;
  const antes = lecturasLog.value.length;
  progresoCarga.value = { hechos: 0, total: lista.length, errores: [] };
  for (const reg of lista) {
    if (detener) break;
    try {
      const resp = await fetch(reg.linkDrive);
      if (!resp.ok) throw new Error('No se pudo descargar (' + resp.status + ')');
      const blob = await resp.blob();
      const nombre = decodeURIComponent(String(reg.linkDrive).split('/').pop().split('?')[0]) || 'documento.pdf';
      const file = new File([blob], nombre, { type: blob.type || (nombre.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg') });
      const { campos, entrada } = await leerYProponer(reg, [file]);
      await actualizarRegistro(reg.id, campos);
      lecturasLog.value.unshift(entrada);
      marcarLeido(reg.id);
    } catch (err) {
      progresoCarga.value.errores.push(`AFI ${reg.afi} ${formatDateForDisplay(reg.fecha)}: ${errMsg(err)}`);
    } finally { progresoCarga.value.hechos++; }
  }
  releyendo.value = false;
  await cargarDatosDesdeSupabase();
  const n = lecturasLog.value.slice(0, lecturasLog.value.length - antes).filter(e => e.cambios.length).length;
  alert(`Lectura terminada: ${progresoCarga.value.hechos} documento(s) leídos · ${n} con datos completados.`);
};
