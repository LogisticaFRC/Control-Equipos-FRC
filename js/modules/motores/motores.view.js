// =====================================================================
// PROGRAMA REPARACIÓN MOTORES · vista (Operaciones → Gestión operacional)
// =====================================================================
import template from './motores.template.js';
import { comunes } from '../../core/comunes.js';
import * as S from './motores.service.js';

const { ref, onMounted } = Vue;

export default {
  name: 'MotoresView',
  template,
  setup() {
    const verEtapas = ref(null);
    onMounted(() => S.cargarMotores());
    return { ...comunes(), ...S, verEtapas };
  }
};
