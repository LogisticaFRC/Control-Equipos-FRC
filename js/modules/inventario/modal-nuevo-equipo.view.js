// =====================================================================
// INVENTARIO AFI · Modal "Agregar Nuevo Equipo"
// =====================================================================
import template from './modal-nuevo-equipo.template.js';
import { showModalNuevoEquipo, formNuevoEquipo, guardarNuevoEquipo } from './inventario.service.js';

export default {
  name: 'ModalNuevoEquipo',
  template,
  setup() {
    return { showModalNuevoEquipo, formNuevoEquipo, guardarNuevoEquipo };
  }
};
