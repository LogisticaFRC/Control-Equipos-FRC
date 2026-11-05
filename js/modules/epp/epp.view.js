// =====================================================================
// EPP · Componente "Control Entrega EPP" (área Seguridad)
// Los datos del módulo se cargan al abrir la pantalla (no en la carga general).
// =====================================================================
import template from './epp.template.js';
import { isAdmin, isSubadmin, puedeEditar, usuarioActivo } from '../../core/store.js';
import { formatDateForDisplay } from '../../core/utils.js';
import * as S from './epp.service.js';

const { onMounted } = Vue;

export default {
  name: 'EppView',
  template,
  setup() {
    onMounted(() => { S.cargarEPP(); });
    return { ...S, isAdmin, isSubadmin, puedeEditar, usuarioActivo, formatDateForDisplay };
  }
};
