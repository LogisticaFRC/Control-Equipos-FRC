// =====================================================================
// VEHÍCULOS · Componente (Operaciones → Equipos → Vehículos)
// Los datos propios (km, documentos) se cargan al abrir la pantalla.
// =====================================================================
import template from './vehiculos.template.js';
import { comunes } from '../../core/comunes.js';
import { hoyISO, diasEntre } from '../../core/utils.js';
import { getBadgeClass, getEstadoText, uploadFotoEquipo, empresaDe } from '../inventario/inventario.service.js';
import * as S from './vehiculos.service.js';

const { onMounted, ref, computed } = Vue;

export default {
  name: 'VehiculosView',
  template,
  setup() {
    onMounted(() => { S.cargarVehiculos(); });
    const verAvisos = ref(true);
    const hoy = computed(() => hoyISO());
    const diasHasta = (iso) => diasEntre(iso, hoyISO());
    /** Lecturas del perfil abierto, más nueva primero. */
    const lecturasOrdenadas = computed(() => [...(S.vehPerfil.value?.lecturas || [])]
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.km - a.km));
    return {
      ...comunes(), ...S, verAvisos, hoy, diasHasta, lecturasOrdenadas,
      getBadgeClass, getEstadoText, uploadFotoEquipo, empresaDe
    };
  }
};
