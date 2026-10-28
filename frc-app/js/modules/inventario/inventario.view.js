// =====================================================================
// INVENTARIO AFI · Componente (tarjetas de equipos + filtros)
// =====================================================================
import template from './inventario.template.js';
import { comunes } from '../../core/comunes.js';
import * as S from './inventario.service.js';

export default {
  name: 'InventarioView',
  template,
  setup() {
    return { ...comunes(), ...S };
  }
};
