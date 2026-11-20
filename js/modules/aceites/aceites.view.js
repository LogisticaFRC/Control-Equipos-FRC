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
    Vue.onMounted(() => S.cargarAceitesOT());   // 2026-11-20: suma también los aceites de las OT de taller
    return { ...comunes(), ...S };
  }
};
