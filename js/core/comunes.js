// =====================================================================
// CORE · Elementos que usan casi todas las plantillas
// (se agregan al `setup()` de cada componente)
// =====================================================================
import { isAdmin, isSubadmin, puedeEditar, dbEquipos, dbMovimientos, dbIntervenciones, dbProgramasCalendarios, obtenerDetalleEquipoPorAfi } from './store.js';
import { formatDateForDisplay, getMecanicosText, calcularRestaHoras, exportarCSV, placeholderImg } from './utils.js';
import { getHorometroCardBgClass, getPrediccionStatusBadge, getAnualStatusBadge, getAnualTextoDias, esAnualVencida, esAnualProxima, tieneAlertaAnual, esAlertaRoja } from './horometros.js';
import { abrirPerfilEquipo, verDetallePorAfiString } from '../modules/inventario/perfil.service.js';
import { abrirFormularioNuevaMantencion, listaCausas } from '../modules/historial/historial.service.js';
import { esPatente } from '../modules/inventario/inventario.mapper.js';   // vehículos: AFI = patente → horómetro en km

/** 2026-11-23: texto visible del estado ("En Mantencion" se muestra como "En Reparación"; el valor guardado no cambia). */
export const textoEstado = (est) => (String(est || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'en mantencion' ? 'En Reparación' : (est || '-'));

export const comunes = () => ({
  isAdmin, isSubadmin, puedeEditar, dbEquipos, dbMovimientos, dbIntervenciones, dbProgramasCalendarios,
  obtenerDetalleEquipoPorAfi, formatDateForDisplay, getMecanicosText, calcularRestaHoras, exportarCSV, placeholderImg,
  getHorometroCardBgClass, getPrediccionStatusBadge,
  getAnualStatusBadge, getAnualTextoDias, esAnualVencida, esAnualProxima, tieneAlertaAnual, esAlertaRoja,
  abrirPerfilEquipo, verDetallePorAfiString, abrirFormularioNuevaMantencion, listaCausas, esPatente, textoEstado
});
