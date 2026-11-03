// =====================================================================
// GENERAL · Pantalla "En construcción" para áreas sin módulos todavía
// (Ventas, Seguridad, RRHH). Se reemplaza cuando el área tenga sus módulos.
// =====================================================================
import { currentTab } from '../../core/store.js';
import { areaDeTab } from '../../core/menu.js';

const { computed } = Vue;

export default {
  template: /* html */ `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center max-w-2xl mx-auto mt-6">
      <div class="w-20 h-20 mx-auto rounded-full bg-slate-900 flex items-center justify-center mb-5 shadow">
        <i :class="['fa-solid text-3xl', area.icon, area.color]"></i>
      </div>
      <h2 class="text-2xl font-extrabold text-slate-800">{{ area.label }}</h2>
      <p class="text-slate-500 mt-2 text-sm">Esta área está en construcción. Aquí aparecerán sus módulos cuando estén listos.</p>
      <div class="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
        <i class="fa-solid fa-person-digging"></i> Próximamente
      </div>
    </div>
  `,
  setup() {
    const area = computed(() => areaDeTab(currentTab.value));
    return { area };
  }
};
