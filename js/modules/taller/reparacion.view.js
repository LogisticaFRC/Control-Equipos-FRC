// =====================================================================
// PROGRAMAS REPARACIÓN · Contenedor con pestañas: Taller (naves) | Programas y Gantt
// =====================================================================
import { vistaReparacion } from './taller.service.js';

export default {
  name: 'ReparacionView',
  template: /* html */ `
  <section class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <button @click="vistaReparacion = 'taller'" :class="['px-5 py-3 rounded-2xl text-sm font-black transition shadow-sm flex items-center gap-2', vistaReparacion === 'taller' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border hover:bg-slate-50']">
        <i class="fa-solid fa-warehouse text-amber-400"></i> Taller · Naves
      </button>
      <button @click="vistaReparacion = 'programas'" :class="['px-5 py-3 rounded-2xl text-sm font-black transition shadow-sm flex items-center gap-2', vistaReparacion === 'programas' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border hover:bg-slate-50']">
        <i class="fa-solid fa-calendar-week text-amber-500"></i> Programas y Gantt
      </button>
    </div>
    <taller-view v-if="vistaReparacion === 'taller'"></taller-view>
    <programas-view v-else tipo="REPARACION"></programas-view>
  </section>`,
  setup() {
    return { vistaReparacion };
  }
};
