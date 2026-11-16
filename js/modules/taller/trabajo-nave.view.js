// =====================================================================
// TALLER · TRABAJO DEL EQUIPO EN NAVE (dentro de REPARAR) · 2026-11-16
// Lo mismo que la app TALLER del celular, para el tótem / PC del taller:
//   · Horómetro actual del equipo (RPC frc_mec_horometro).
//   · Intervención mecánica / eléctrica, Agregar bloqueo, ART y Mantención
//     (componente ActividadesEquipo de la app técnicos).
// El formulario de intervención se abre encima, a pantalla completa
// (es el mismo de la app del celular: <mecanico-app>).
// =====================================================================
import * as M from '../mecanicos/mecanicos.service.js';
import ActividadesEquipo from '../mecanicos/actividades-equipo.view.js';
import { buscarEquipoPorAfi } from '../../core/store.js';
import { formatDateForDisplay } from '../../core/utils.js';

const { computed, onBeforeUnmount } = Vue;

export default {
  name: 'TrabajoNave',
  components: { ActividadesEquipo },
  props: { afi: { type: [String, Number], required: true } },
  template: /* html */ `
<div class="space-y-3 pt-2 border-t">
  <template v-if="eq">
    <!-- Horómetro -->
    <div class="bg-white rounded-2xl border p-3 space-y-2" data-trabajo="horometro">
      <div class="flex items-end justify-between gap-2">
        <span class="text-xs font-bold uppercase text-slate-500"><i class="fa-solid fa-gauge-high mr-1"></i>Horómetro</span>
        <span class="text-right leading-tight"><span class="block text-xl font-black font-mono text-slate-800">{{ fmtH(eq.horometros && eq.horometros.hTomado) }}</span><span class="text-[10px] text-slate-500">{{ formatDateForDisplay(eq.horometros && eq.horometros.fechaUltimoHorometro) || 'sin registro' }}</span></span>
      </div>
      <input v-model="M.horoForm.value.valor" inputmode="decimal" class="w-full p-2.5 border-2 rounded-xl font-mono text-lg" placeholder="Horómetro actual">
      <input type="date" v-model="M.horoForm.value.fecha" class="w-full p-2 border-2 rounded-xl text-sm">
      <button @click="guardarHoro" :disabled="M.guardandoHoro.value || !M.horoForm.value.valor" class="w-full py-2.5 rounded-xl bg-[#1f4d3a] hover:bg-[#173b2c] text-white font-extrabold disabled:opacity-40">
        <i :class="['fa-solid mr-1', M.guardandoHoro.value ? 'fa-spinner fa-spin' : 'fa-floppy-disk']"></i>Guardar horómetro
      </button>
    </div>
    <!-- Intervenciones / bloqueo / ART / mantención -->
    <p class="text-xs font-bold uppercase text-slate-500 pt-1"><i class="fa-solid fa-screwdriver-wrench mr-1"></i>Actividades del equipo</p>
    <actividades-equipo :eq="eq"></actividades-equipo>
  </template>
  <p v-else class="text-xs text-slate-500">El AFI {{ afi }} no está en el inventario: no se puede registrar horómetro ni intervenciones.</p>

  <!-- Formulario de intervención (el mismo de la app del celular), encima de todo -->
  <teleport to="body">
    <div v-if="M.formInt.value" class="fixed inset-0 z-[350] bg-slate-900/80 overflow-y-auto" data-trabajo="form-intervencion">
      <mecanico-app></mecanico-app>
    </div>
    <div v-if="M.toastApp.value && !M.formInt.value" class="fixed top-6 left-1/2 -translate-x-1/2 z-[360] bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl font-bold text-sm">{{ M.toastApp.value }}</div>
  </teleport>
</div>`,
  setup(props) {
    const eq = computed(() => buscarEquipoPorAfi(props.afi) || null);
    const fmtH = (h) => (Number(h) > 0 ? Number(h).toLocaleString('es-CL') + ' h' : '—');
    const guardarHoro = async () => { if (eq.value) await M.guardarHorometro(eq.value); M.equipoSel.value = null; };
    // Si cierran REPARAR con el formulario abierto, queda como borrador
    onBeforeUnmount(() => { if (M.formInt.value) M.cerrarIntervencion(); });
    return { M, eq, fmtH, guardarHoro, formatDateForDisplay };
  }
};
