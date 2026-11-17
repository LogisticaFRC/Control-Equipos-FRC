// =====================================================================
// MOVIMIENTOS · Componente (tabla de traslados + filtros)
// =====================================================================
import template from './movimientos.template.js';
import { comunes } from '../../core/comunes.js';
import * as S from './movimientos.service.js';
import { ChecklistLista } from '../mecanicos/chofer-checklist.view.js';   // check list de choferes (2026-11-17)
import { cargarTodosChecklist } from '../mecanicos/chofer.service.js';

export default {
  name: 'MovimientosView',
  components: { ChecklistLista },
  template,
  setup() {
    return { ...comunes(), ...S, cargarTodosChecklist };
  }
};
