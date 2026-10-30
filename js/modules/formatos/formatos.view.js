// =====================================================================
// FORMATOS · Pantalla principal (Área → Norma ISO → documentos)
// =====================================================================
import template from './formatos.template.js';
import { comunes } from '../../core/comunes.js';
import * as S from './formatos.service.js';
import DocumentosCarpeta from './documentos-carpeta.view.js';

export default {
  name: 'FormatosView',
  components: { DocumentosCarpeta },
  template,
  setup() {
    return { ...comunes(), ...S };
  }
};
