// =====================================================================
// INVENTARIO AFI · Conversión fila Supabase (BD_INVENTARIO) -> objeto de la app
// =====================================================================
import { normalizarClave } from '../../core/utils.js';

import { TABLAS } from '../../core/tablas.js';
export const TABLA_INVENTARIO = TABLAS.INVENTARIO;

export const mapEquipo = (item) => ({
  id: item.id,
  afi: String(item.afi || ''),
  tipo: String(item.tipo || ''),
  marca: String(item.marca || ''),
  modelo: String(item.modelo || ''),
  ubicacion: String(item.ubicacion || ''),
  disponibilidad: normalizarClave(item.disponibilidad),
  anio: item.anio || 2023,
  horometroActual: Number(item.horometroactual || 0),
  fechaHorometroManual: item.fecha_horometro_manual || '',
  frecuenciaMantencion: Number(item.frecuencia_mantencion) || 250,
  gps: item.gps || 'Sin GPS',
  imei_gps: item.imei_gps || '',
  foto: item.foto || '',
  horometros: null
});
