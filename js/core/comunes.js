// =====================================================================
// CORE · Elementos que usan casi todas las plantillas
// (se agregan al `setup()` de cada componente)
// =====================================================================
import { isAdmin, isSubadmin, puedeEditar, dbEquipos, dbMovimientos, dbIntervenciones, dbProgramasCalendarios, obtenerDetalleEquipoPorAfi } from './store.js';
import { formatDateForDisplay, getMecanicosText, calcularRestaHoras, exportarCSV, placeholderImg } from './utils.js';
import { getHorometroCardBgClass, getPrediccionStatusBadge, getAnualStatusBadge, getAnualTextoDias, esAnualVencida, esAnualProxima, tieneAlertaAnual, esAlertaRoja } from './horometros.js';
import { abrirPerfilEquipo, verDetallePorAfiString } from '../modules/inventario/perfil.service.js';
import { abrirFormularioNuevaMantencion, listaCausas } from '../modules/historial/historial.service.js';

export const comunes = () => ({
  isAdmin, isSubadmin, puedeEditar, dbEquipos, dbMovimientos, dbIntervenciones, dbProgramasCalendarios,
  obtenerDetalleEquipoPorAfi, formatDateForDisplay, getMecanicosText, calcularRestaHoras, exportarCSV, placeholderImg,
  getHorometroCardBgClass, getPrediccionStatusBadge,
  getAnualStatusBadge, getAnualTextoDias, esAnualVencida, esAnualProxima, tieneAlertaAnual, esAlertaRoja,
  abrirPerfilEquipo, verDetallePorAfiString, abrirFormularioNuevaMantencion, listaCausas
});
