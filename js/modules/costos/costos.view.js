// =====================================================================
// COSTOS DE MANTENCIÓN · vista general (Operaciones → Mantenimiento)
// =====================================================================
import template from './costos.template.js';
import { comunes } from '../../core/comunes.js';
import * as S from './costos.service.js';

const { ref, onMounted } = Vue;

export default {
  name: 'CostosView',
  template,
  setup() {
    const vista = ref('modelos');
    const abierto = ref(null);
    const limiteEq = ref(100);
    const verConfig = ref(false);
    const toggle = (k) => { abierto.value = abierto.value === k ? null : k; };
    const grupoLabel = (k) => S.GRUPOS.find(g => g.k === k)?.l || k;
    onMounted(() => S.cargarConfigCostos());
    return { ...comunes(), ...S, ...S.ESTILO_MANT, vista, abierto, limiteEq, verConfig, toggle, grupoLabel };
  }
};
