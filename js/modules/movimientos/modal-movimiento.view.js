// =====================================================================
// MOVIMIENTOS · Modal "Registrar Nuevo Movimiento"
// =====================================================================
import template from './modal-movimiento.template.js';
import { comunes } from '../../core/comunes.js';
import { showModalMovimiento, formMov, guardarNuevoMovimiento } from './movimientos.service.js';

export default {
  name: 'ModalMovimiento',
  template,
  setup() {
    return { ...comunes(), showModalMovimiento, formMov, guardarNuevoMovimiento };
  }
};
