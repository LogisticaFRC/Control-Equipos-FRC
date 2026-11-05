// =====================================================================
// PROGRAMAS REPARACIÓN · Contenedor con pestañas: Taller (naves) | Programas y Gantt | OT enlazadas (solo Admin)
// =====================================================================
import { vistaReparacion } from './taller.service.js';
import { isAdmin } from '../../core/store.js';
import OtEnlacesView from './enlaces.view.js';

export default {
  name: 'ReparacionView',
  components: { OtEnlacesView },
  template: /* html */ `
  <section class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <button @click="vistaReparacion = 'taller'" :class="['px-5 py-3 rounded-2xl text-sm font-black transition shadow-sm flex items-center gap-2', vistaReparacion === 'taller' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border hover:bg-slate-50']">
        <i class="fa-solid fa-warehouse text-amber-400"></i> Taller · Naves
      </button>
      <button @click="vistaReparacion = 'programas'" :class="['px-5 py-3 rounded-2xl text-sm font-black transition shadow-sm flex items-center gap-2', vistaReparacion === 'programas' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border hover:bg-slate-50']">
        <i class="fa-solid fa-calendar-week text-amber-500"></i> Programas y Gantt
      </button>
      <button v-if="isAdmin" @click="vistaReparacion = 'enlaces'" :class="['px-5 py-3 rounded-2xl text-sm font-black transition shadow-sm flex items-center gap-2', vistaReparacion === 'enlaces' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border hover:bg-slate-50']">
        <i class="fa-solid fa-link text-rose-500"></i> OT enlazadas · Historial <span class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950">Admin</span>
      </button>
    </div>
    <taller-view v-if="vistaReparacion === 'taller'"></taller-view>
    <ot-enlaces-view v-else-if="vistaReparacion === 'enlaces' && isAdmin"></ot-enlaces-view>
    <programas-view v-else-if="vistaReparacion === 'programas'" tipo="REPARACION"></programas-view>
    <taller-view v-else></taller-view>
  </section>`,
  setup() {
    return { vistaReparacion, isAdmin };
  }
};
