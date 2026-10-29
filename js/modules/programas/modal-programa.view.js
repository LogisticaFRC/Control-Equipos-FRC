// =====================================================================
// PROGRAMAS · Modal "Crear Programa"
// =====================================================================
import template from './modal-programa.template.js';
import { showModalPrograma, formProgMes, guardarNuevoProgramaMes } from './programas.service.js';

export default {
  name: 'ModalPrograma',
  template,
  setup() {
    return { showModalPrograma, formProgMes, guardarNuevoProgramaMes };
  }
};
