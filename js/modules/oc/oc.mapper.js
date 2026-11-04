// =====================================================================
// OC · Conversión fila Supabase (bd_oc) -> objeto de la app + helpers de N° OC
// (archivo "hoja": no importa nada del store para evitar dependencias circulares)
// =====================================================================
import { TABLAS } from '../../core/tablas.js';
import { formatExcelDate } from '../../core/utils.js';

export const TABLA_OC = TABLAS.OC;

/** Clave para comparar N° de OC: sin "OC", "N°", "#", espacios ni guiones al inicio; en mayúsculas. "OC-1234" = "1234" = "oc 1234". */
export const claveOC = (v) => String(v ?? '').toUpperCase()
  .replace(/^\s*(O\.?\s*C\.?|ORDEN\s+DE\s+COMPRA)\s*/, '')
  .replace(/^\s*(N\s*[°º]|NO\.|#)\s*/, '')
  .replace(/^[\s\-:]+/, '')
  .replace(/\s+/g, '');

/** Texto guardado en BD_HISTORIAL.numero_oc ("123, 456 / 789") → lista de N° de OC (sin repetir). */
export const ocsDeTexto = (txt) => {
  const vistos = new Set(), out = [];
  String(txt ?? '').split(/[,;/|\n]+/).map(s => s.trim()).filter(Boolean).forEach(s => {
    const k = claveOC(s);
    if (k && !vistos.has(k)) { vistos.add(k); out.push(s.replace(/^\s*(O\.?\s*C\.?)\s*[-:#]?\s*/i, '').trim() || s); }
  });
  return out;
};

/** Lista de N° de OC → texto que se guarda en BD_HISTORIAL.numero_oc. */
export const textoDeOcs = (lista) => (lista || []).map(s => String(s).trim()).filter(Boolean).join(', ');

export const mapOC = (r) => ({
  id: r.id,
  numero: String(r.numero_oc ?? '').trim(),
  clave: claveOC(r.numero_oc),
  fecha: formatExcelDate(r.fecha || r.created_at),
  afi: String(r.afi ?? '').trim(),
  proveedor: String(r.proveedor ?? '').trim(),
  descripcion: String(r.descripcion ?? '').trim(),
  precio: Number(r.precio || 0),
  link: String(r.link ?? '').trim(),
  archivoNombre: String(r.archivo_nombre ?? '').trim(),
  creadoPor: String(r.creado_por ?? '').trim()
});
