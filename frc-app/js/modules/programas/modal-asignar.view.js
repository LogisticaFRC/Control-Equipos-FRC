// =====================================================================
// PROGRAMAS · Modal "Asignar Equipo al Programa"
// =====================================================================
import template from './modal-asignar.template.js';
import { comunes } from '../../core/comunes.js';
import { showModalAsignarEquipo, formAsignar, guardarAsignacionEquipo, actualizarTipoSegunProgramaSeleccionado } from './programas.service.js';

export default {
  name: 'ModalAsignarEquipo',
  template,
  setup() {
    return { ...comunes(), showModalAsignarEquipo, formAsignar, guardarAsignacionEquipo, actualizarTipoSegunProgramaSeleccionado };
  }
};
