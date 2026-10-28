// =====================================================================
// CORE · Elementos que usan casi todas las plantillas
// (se agregan al `setup()` de cada componente)
// =====================================================================
import { isAdmin, dbEquipos, dbMovimientos, dbIntervenciones, dbProgramasCalendarios, obtenerDetalleEquipoPorAfi } from './store.js';
import { formatDateForDisplay, getMecanicosText, calcularRestaHoras, exportarCSV, placeholderImg } from './utils.js';
import { getHorometroCardBgClass, getPrediccionStatusBadge } from './horometros.js';
import { abrirPerfilEquipo, verDetallePorAfiString } from '../modules/inventario/perfil.service.js';
import { abrirFormularioNuevaMantencion, listaCausas } from '../modules/historial/historial.service.js';

export const comunes = () => ({
  isAdmin, dbEquipos, dbMovimientos, dbIntervenciones, dbProgramasCalendarios,
  obtenerDetalleEquipoPorAfi, formatDateForDisplay, getMecanicosText, calcularRestaHoras, exportarCSV, placeholderImg,
  getHorometroCardBgClass, getPrediccionStatusBadge,
  abrirPerfilEquipo, verDetallePorAfiString, abrirFormularioNuevaMantencion, listaCausas
});
