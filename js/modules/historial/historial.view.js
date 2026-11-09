// =====================================================================
// HISTORIAL · Componente (tabla completa de mantenciones + filtros)
// =====================================================================
import template from './historial.template.js';
import { comunes } from '../../core/comunes.js';
import * as S from './historial.service.js';
import { irAOT } from '../ot/ot.service.js';
import CargaDocumentos from './carga-documentos.view.js';
import { abrirCargaDocs } from './carga-documentos.service.js';
import { irAOC, detalleOCsMantencion, totalOCMantencion, fmtCLP } from '../oc/oc.service.js';

export default {
  name: 'HistorialView',
  template,
  components: { CargaDocumentos },   // carga masiva de PDF → enlace a cada registro
  setup() {
    return { ...comunes(), ...S, irAOT, irAOC, detalleOCsMantencion, totalOCMantencion, fmtCLP, abrirCargaDocs };
  }
};
