// =====================================================================
// FILTROS · Componente (referencia cruzada, comparativo de precios, alta/edición)
// =====================================================================
import template from './filtros.template.js';
import { comunes } from '../../core/comunes.js';
import { dbFiltros } from '../../core/store.js';
import * as S from './filtros.service.js';

export default {
  name: 'FiltrosView',
  template,
  setup() {
    return { ...comunes(), ...S, dbFiltros };
  }
};
