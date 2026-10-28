// =====================================================================
// MOVIMIENTOS · Conversión fila Supabase (BD_MOVIMIENTOS) -> objeto de la app
// =====================================================================
import { formatExcelDate } from '../../core/utils.js';

import { TABLAS } from '../../core/tablas.js';
export const TABLA_MOVIMIENTOS = TABLAS.MOVIMIENTOS;

export const mapMovimiento = (item) => ({
  id: item.id,
  fecha: formatExcelDate(item.fecha),
  afi: String(item.afi || ''),
  tipo: String(item.tipo || ''),
  origen: String(item.ubicacion_anterior || ''),
  destino: String(item.ubicacion_actual || ''),
  empresa_arriendo: String(item.empresa_arriendo || ''),
  estado: String(item.estado || ''),
  camion: String(item.camion_encargado || ''),
  conductor: String(item.conductor_encargado || '')
});
