// =====================================================================
// MOVIMIENTOS · Componente (tabla de traslados + filtros)
// =====================================================================
import template from './movimientos.template.js';
import { comunes } from '../../core/comunes.js';
import * as S from './movimientos.service.js';

export default {
  name: 'MovimientosView',
  template,
  setup() {
    return { ...comunes(), ...S };
  }
};
