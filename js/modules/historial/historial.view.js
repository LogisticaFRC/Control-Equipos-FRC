// =====================================================================
// HISTORIAL · Componente (tabla completa de mantenciones + filtros)
// =====================================================================
import template from './historial.template.js';
import { comunes } from '../../core/comunes.js';
import * as S from './historial.service.js';
import { irAOT } from '../ot/ot.service.js';
import { irAOC, detalleOCsMantencion, totalOCMantencion, fmtCLP } from '../oc/oc.service.js';

export default {
  name: 'HistorialView',
  template,
  setup() {
    return { ...comunes(), ...S, irAOT, irAOC, detalleOCsMantencion, totalOCMantencion, fmtCLP };
  }
};
