// =====================================================================
// CONTROL DE ACEITES · Componente (consumos, totales y filtros)
// =====================================================================
import template from './aceites.template.js';
import { comunes } from '../../core/comunes.js';
import * as S from './aceites.service.js';

export default {
  name: 'AceitesView',
  template,
  setup() {
    return { ...comunes(), ...S };
  }
};
