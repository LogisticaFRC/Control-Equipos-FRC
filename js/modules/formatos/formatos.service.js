// =====================================================================
// FORMATOS & FICHAS TÉCNICAS · Lógica compartida de documentos
// Todo se guarda en la tabla `bd_formatos` (id, carpeta, nombre, link).
// La columna `carpeta` indica a qué pertenece el documento:
//   - Ficha técnica de un equipo  → "EQUIPO:<id del equipo>"
//   - Formatos                   → "<AREA> / <NORMA>"  (ej. "RRHH / ISO SEGURIDAD 45001")
//   - Subcarpeta                 → carpeta + " / <nombre>"  (ej. "RRHH / ISO SEGURIDAD 45001 / Contratos")
// Solo el ADMIN sube, agrega enlaces, modifica, mueve, crea subcarpetas y elimina. Subadmin y Lectura solo ven y abren.
// =====================================================================
import { supabaseClient, sb, errMsg, subirArchivoStorage, BUCKET_ARCHIVOS } from '../../core/supabase.js';
import { dbFormatos, cargarDatosDesdeSupabase, soloAdmin } from '../../core/store.js';
import { TABLAS } from '../../core/tablas.js';

const { ref } = Vue;

export { dbFormatos };

// ---------- Estructura del módulo Formatos ----------
export const AREAS = [
  { key: 'OPERACIONES', icon: 'fa-gears', color: 'amber' },
  { key: 'RRHH', icon: 'fa-users', color: 'sky' },
  { key: 'FINANZAS', icon: 'fa-sack-dollar', color: 'emerald' },
  { key: 'ADMINISTRACION', icon: 'fa-building', color: 'violet' }
];
export const NORMAS = [
  { key: 'ISO CALIDAD 9001', icon: 'fa-award' },
  { key: 'ISO MEDIO AMBIENTE 14001', icon: 'fa-leaf' },
  { key: 'ISO SEGURIDAD 45001', icon: 'fa-helmet-safety' }
];

export const areaActiva = ref('OPERACIONES');
/** Texto del buscador general de Formatos (busca en todas las áreas, normas y subcarpetas). */
export const busquedaFormatos = ref('');
export const normaActiva = ref('ISO CALIDAD 9001');

export const carpetaFormato = (area, norma) => `${area} / ${norma}`;
export const carpetaEquipo = (equipoId) => `EQUIPO:${equipoId}`;

// ---------- Subcarpetas ----------
// Una subcarpeta es la carpeta base + " / " + nombre. Ej: "RRHH / ISO CALIDAD 9001 / Contratos".
// Para que una subcarpeta vacía no desaparezca se guarda una fila "marcador" (no se muestra como documento).
export const MARCADOR_CARPETA = '__CARPETA__';
const SEP = ' / ';
export const esMarcador = (d) => d && d.nombre === MARCADOR_CARPETA;
const docsReales = () => dbFormatos.value.filter(d => !esMarcador(d));

/** Carpeta base de un documento: "AREA / NORMA" en Formatos, "EQUIPO:<id>" en Ficha Técnica. */
export const baseDe = (carpeta) => {
  const partes = String(carpeta || '').split(SEP);
  return partes[0].startsWith('EQUIPO:') ? partes[0] : partes.slice(0, 2).join(SEP);
};
/** Nombre de la subcarpeta ('' = carpeta principal). */
export const subDe = (carpeta) => {
  const base = baseDe(carpeta);
  const c = String(carpeta || '');
  return c.length > base.length ? c.slice(base.length + SEP.length) : '';
};
export const rutaSub = (base, sub) => sub ? `${base}${SEP}${sub}` : base;

/** Lista de subcarpetas de una carpeta base, con su cantidad de documentos. */
export const subcarpetasDe = (base) => {
  const nombres = new Set();
  dbFormatos.value.forEach(d => {
    const c = String(d.carpeta || '');
    if (c.startsWith(base + SEP) && baseDe(c) === base) nombres.add(subDe(c));
  });
  return [...nombres].sort((a, b) => a.localeCompare(b, 'es'))
    .map(n => ({ nombre: n, total: docsReales().filter(d => d.carpeta === rutaSub(base, n)).length }));
};

const limpiarNombreSub = (n) => String(n || '').replace(/\//g, '-').replace(/\s+/g, ' ').trim();

// ---------- Consultas ----------
const ordenarPorNombre = (arr) => arr.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));

export const documentosDe = (carpeta) => ordenarPorNombre(docsReales().filter(d => String(d.carpeta || '') === carpeta));

/** Documentos de una carpeta base incluyendo todas sus subcarpetas. */
export const documentosConSub = (base) => docsReales().filter(d => baseDe(d.carpeta) === base);

export const contarDocumentos = (prefijo) =>
  docsReales().filter(d => String(d.carpeta || '').startsWith(prefijo)).length;

// ---------- Buscador ----------
const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Filtra documentos: todas las palabras escritas deben aparecer en el nombre o en la carpeta. */
export const filtrarPorTexto = (docs, texto) => {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  if (!palabras.length) return docs;
  return docs.filter(d => {
    const hay = normalizar(`${d.nombre} ${d.carpeta}`);
    return palabras.every(p => hay.includes(p));
  });
};
/** Búsqueda en TODO el módulo Formatos (no incluye fichas técnicas de equipos). */
export const buscarEnFormatos = (texto) =>
  ordenarPorNombre(filtrarPorTexto(docsReales().filter(d => !String(d.carpeta || '').startsWith('EQUIPO:')), texto));

/** true si el link apunta a un archivo subido a nuestro Storage (y no a un enlace externo). */
export const esArchivoSubido = (link) => String(link || '').includes('/storage/v1/object/');

// ---------- Acciones (solo admin) ----------
const limpiarNombreArchivo = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_');

const rutaStorage = (carpeta, file) => `formatos/${limpiarNombreArchivo(carpeta)}/${Date.now()}_${limpiarNombreArchivo(file.name)}`;

/** Borra del Storage el archivo de un link (si es nuestro). No interrumpe si falla. */
const borrarArchivoStorage = async (link) => {
  if (!esArchivoSubido(link)) return;
  const marca = `/object/public/${BUCKET_ARCHIVOS}/`;
  const i = String(link).indexOf(marca);
  if (i < 0) return;
  const ruta = decodeURIComponent(String(link).slice(i + marca.length).split('?')[0]);
  try { await supabaseClient.storage.from(BUCKET_ARCHIVOS).remove([ruta]); } catch (e) { console.warn('No se pudo borrar el archivo anterior', e); }
};

/** Sube un archivo al Storage y lo registra en la carpeta indicada. */
export const subirDocumento = async (carpeta, file, nombre) => {
  if (!soloAdmin()) return false;
  if (!file) { alert("Selecciona un archivo."); return false; }
  try {
    const url = await subirArchivoStorage(rutaStorage(carpeta, file), file);
    await sb(supabaseClient.from(TABLAS.FORMATOS).insert([{ carpeta, nombre: (nombre || '').trim() || file.name, link: url }]));
  } catch (err) {
    alert("Error al subir el archivo: " + errMsg(err));
    return false;
  }
  await cargarDatosDesdeSupabase();
  return true;
};

/** Registra un enlace externo (Drive, OneDrive, web del fabricante, etc.) en la carpeta indicada. */
export const agregarEnlace = async (carpeta, link, nombre) => {
  if (!soloAdmin()) return false;
  let url = String(link || '').trim();
  if (!url) { alert("Pega el enlace."); return false; }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try {
    await sb(supabaseClient.from(TABLAS.FORMATOS).insert([{ carpeta, nombre: (nombre || '').trim() || url, link: url }]));
  } catch (err) {
    alert("Error al guardar el enlace: " + errMsg(err));
    return false;
  }
  await cargarDatosDesdeSupabase();
  return true;
};

/**
 * Modifica un documento ya subido (solo admin):
 *  - nombre: nuevo nombre visible
 *  - carpeta: nueva carpeta/subcarpeta (para MOVER el documento)
 *  - file: archivo nuevo que REEMPLAZA al anterior (el anterior se borra del Storage)
 *  - link: nuevo enlace (solo para documentos tipo enlace)
 */
export const editarDocumento = async (doc, { nombre, carpeta, file, link } = {}) => {
  if (!soloAdmin()) return false;
  const cambios = {};
  const n = String(nombre || '').trim();
  if (!n) { alert("El nombre no puede quedar vacío."); return false; }
  if (n !== doc.nombre) cambios.nombre = n;
  if (carpeta && carpeta !== doc.carpeta) cambios.carpeta = carpeta;
  let linkAnterior = null;
  try {
    if (file) {
      cambios.link = await subirArchivoStorage(rutaStorage(carpeta || doc.carpeta, file), file);
      linkAnterior = doc.link;
    } else if (link !== undefined && !esArchivoSubido(doc.link)) {
      let url = String(link || '').trim();
      if (!url) { alert("El enlace no puede quedar vacío."); return false; }
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      if (url !== doc.link) cambios.link = url;
    }
    if (!Object.keys(cambios).length) return true;
    await sb(supabaseClient.from(TABLAS.FORMATOS).update(cambios).eq('id', doc.id));
  } catch (err) {
    alert("Error al modificar el documento: " + errMsg(err));
    return false;
  }
  if (linkAnterior) await borrarArchivoStorage(linkAnterior);
  await cargarDatosDesdeSupabase();
  return true;
};

export const eliminarDocumento = async (doc) => {
  if (!soloAdmin()) return;
  if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return;
  try {
    await sb(supabaseClient.from(TABLAS.FORMATOS).delete().eq('id', doc.id));
  } catch (err) {
    return alert("Error al eliminar: " + errMsg(err));
  }
  await cargarDatosDesdeSupabase();
};

// ---------- Subcarpetas (solo admin) ----------
export const crearSubcarpeta = async (base, nombre) => {
  if (!soloAdmin()) return null;
  const n = limpiarNombreSub(nombre);
  if (!n) return null;
  if (subcarpetasDe(base).some(s => s.nombre.toLowerCase() === n.toLowerCase())) { alert(`Ya existe la subcarpeta "${n}".`); return null; }
  try {
    await sb(supabaseClient.from(TABLAS.FORMATOS).insert([{ carpeta: rutaSub(base, n), nombre: MARCADOR_CARPETA, link: 'carpeta' }]));
  } catch (err) {
    alert("Error al crear la subcarpeta: " + errMsg(err));
    return null;
  }
  await cargarDatosDesdeSupabase();
  return n;
};

export const renombrarSubcarpeta = async (base, actual, nuevo) => {
  if (!soloAdmin()) return null;
  const n = limpiarNombreSub(nuevo);
  if (!n || n === actual) return null;
  if (subcarpetasDe(base).some(s => s.nombre.toLowerCase() === n.toLowerCase() && s.nombre !== actual)) { alert(`Ya existe la subcarpeta "${n}".`); return null; }
  try {
    await sb(supabaseClient.from(TABLAS.FORMATOS).update({ carpeta: rutaSub(base, n) }).eq('carpeta', rutaSub(base, actual)));
  } catch (err) {
    alert("Error al renombrar la subcarpeta: " + errMsg(err));
    return null;
  }
  await cargarDatosDesdeSupabase();
  return n;
};

/** Elimina la subcarpeta. Sus documentos NO se borran: pasan a la carpeta principal. */
export const eliminarSubcarpeta = async (base, sub) => {
  if (!soloAdmin()) return false;
  const ruta = rutaSub(base, sub);
  const total = documentosDe(ruta).length;
  const msg = total
    ? `¿Eliminar la subcarpeta "${sub}"?\nSus ${total} documento(s) NO se borran: se moverán a la carpeta principal.`
    : `¿Eliminar la subcarpeta vacía "${sub}"?`;
  if (!confirm(msg)) return false;
  try {
    await sb(supabaseClient.from(TABLAS.FORMATOS).delete().eq('carpeta', ruta).eq('nombre', MARCADOR_CARPETA));
    if (total) await sb(supabaseClient.from(TABLAS.FORMATOS).update({ carpeta: base }).eq('carpeta', ruta));
  } catch (err) {
    alert("Error al eliminar la subcarpeta: " + errMsg(err));
    return false;
  }
  await cargarDatosDesdeSupabase();
  return true;
};
