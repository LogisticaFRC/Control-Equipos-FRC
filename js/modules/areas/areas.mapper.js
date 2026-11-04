// =====================================================================
// ÁREAS · Conversión fila Supabase (bd_locaciones) -> objeto de la app
// tipo: EMPRESA (sin padre) → AREA (padre = empresa) → SECTOR (padre = área) → LOCACION (padre = sector)
// =====================================================================
import { TABLAS } from '../../core/tablas.js';
export const TABLA_LOCACIONES = TABLAS.LOCACIONES;

export const TIPOS = { EMPRESA: 'EMPRESA', AREA: 'AREA', SECTOR: 'SECTOR', LOCACION: 'LOCACION' };

/** Nombre normalizado: MAYÚSCULAS y sin espacios repetidos. */
export const normNombre = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

export const mapLocacion = (r) => ({
  id: r.id,
  tipo: String(r.tipo || '').toUpperCase(),
  nombre: normNombre(r.nombre),
  padreId: r.padre_id ?? null,
  descripcion: String(r.descripcion || ''),
  lat: r.lat == null || r.lat === '' ? null : Number(r.lat),   // georreferencia (sql/areas_georef.sql)
  lng: r.lng == null || r.lng === '' ? null : Number(r.lng),
  mapsUrl: String(r.maps_url || ''),
  creadoPor: String(r.creado_por || '')
});
