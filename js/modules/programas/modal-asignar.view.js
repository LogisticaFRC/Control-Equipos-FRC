// =====================================================================
// PROGRAMAS · Modal "Asignar Equipo al Programa"
// =====================================================================
import template from './modal-asignar.template.js';
import { comunes } from '../../core/comunes.js';
import { showModalAsignarEquipo, formAsignar, guardarAsignacionEquipo, actualizarTipoSegunProgramaSeleccionado, programasParaAsignar, NAVES, TIPOS_MANT_PROG } from './programas.service.js';

export default {
  name: 'ModalAsignarEquipo',
  template,
  setup() {
    return { ...comunes(), showModalAsignarEquipo, formAsignar, guardarAsignacionEquipo, actualizarTipoSegunProgramaSeleccionado, programasParaAsignar, NAVES, TIPOS_MANT_PROG };
  }
};
