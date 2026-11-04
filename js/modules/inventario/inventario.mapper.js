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
  locacionId: item.locacion_id ?? null,          // módulo ÁREAS (Empresa → Área → Locación)
  empresaArriendo: String(item.empresa_arriendo || '').trim().toUpperCase(),
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

// ---------- Empresa arrendada ----------
/** Un equipo FUERA DE SERVICIO siempre está en "TALLER FRC". */
export const EMPRESA_TALLER = 'TALLER FRC';
export const esFueraDeServicio = (e) => normalizarClave(e?.disponibilidad) === 'Fuera de Servicio';
/** Empresa a mostrar: Taller si está fuera de servicio; si no, la del inventario o, si está vacía, la del último movimiento. */
export const empresaDe = (e) => {
  if (!e) return '';
  if (esFueraDeServicio(e)) return EMPRESA_TALLER;
  return e.empresaArriendo || e.empresaUltimoMov || '';
};
