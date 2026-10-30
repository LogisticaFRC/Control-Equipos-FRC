// =====================================================================
// FORMATOS & FICHAS TÉCNICAS · Lógica compartida de documentos
// Todo se guarda en la tabla `bd_formatos` (id, carpeta, nombre, link).
// La columna `carpeta` indica a qué pertenece el documento:
//   - Ficha técnica de un equipo  → "EQUIPO:<id del equipo>"
//   - Formatos                   → "<AREA> / <NORMA>"  (ej. "RRHH / ISO SEGURIDAD 45001")
// Solo el ADMIN sube, agrega enlaces y elimina. Subadmin y Lectura solo ven y abren.
// =====================================================================
import { supabaseClient, sb, errMsg, subirArchivoStorage } from '../../core/supabase.js';
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
export const normaActiva = ref('ISO CALIDAD 9001');

export const carpetaFormato = (area, norma) => `${area} / ${norma}`;
export const carpetaEquipo = (equipoId) => `EQUIPO:${equipoId}`;

// ---------- Consultas ----------
export const documentosDe = (carpeta) =>
  dbFormatos.value
    .filter(d => String(d.carpeta || '') === carpeta)
    .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));

export const contarDocumentos = (prefijo) =>
  dbFormatos.value.filter(d => String(d.carpeta || '').startsWith(prefijo)).length;

/** true si el link apunta a un archivo subido a nuestro Storage (y no a un enlace externo). */
export const esArchivoSubido = (link) => String(link || '').includes('/storage/v1/object/');

// ---------- Acciones (solo admin) ----------
const limpiarNombreArchivo = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_');

/** Sube un archivo al Storage y lo registra en la carpeta indicada. */
export const subirDocumento = async (carpeta, file, nombre) => {
  if (!soloAdmin()) return false;
  if (!file) { alert("Selecciona un archivo."); return false; }
  try {
    const ruta = `formatos/${limpiarNombreArchivo(carpeta)}/${Date.now()}_${limpiarNombreArchivo(file.name)}`;
    const url = await subirArchivoStorage(ruta, file);
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
