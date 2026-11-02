// =====================================================================
// BODEGA DE FILTROS · Componente (inventario general, kits, movimientos)
// =====================================================================
import template from './bodega.template.js';
import { comunes } from '../../core/comunes.js';
import * as S from './bodega.service.js';

export default {
  name: 'BodegaView',
  template,
  setup() {
    return { ...comunes(), ...S };
  }
};
