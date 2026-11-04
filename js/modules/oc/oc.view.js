// =====================================================================
// OC · Componente (registro histórico de Órdenes de Compra)
// =====================================================================
import template from './oc.template.js';
import { comunes } from '../../core/comunes.js';
import { buscarEquipoPorAfi } from '../../core/store.js';
import * as S from './oc.service.js';

export default {
  name: 'OcView',
  template,
  setup() {
    return { ...comunes(), ...S, buscarEquipoPorAfi };
  }
};
