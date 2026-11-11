// =====================================================================
// GENERAL · Pantalla de Inicio (bienvenida). Es la primera que se ve al iniciar sesión.
// =====================================================================
import { usuarioActivo } from '../../core/store.js';
import { menuAbierto } from '../../core/menu.js';
import { logoSrc, onLogoError } from '../configuracion/configuracion.service.js';
import { irAMisTareas, ocurrenciasHoy, hechasHoy, pendientesHoy, vencidas } from '../recordatorios/recordatorios.service.js';

export default {
  template: /* html */ `
    <div class="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div class="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-8 w-56 h-56 sm:w-72 sm:h-72 flex items-center justify-center">
        <img :src="logoSrc" @error="onLogoError" referrerpolicy="no-referrer" alt="Logo FRC" class="max-h-full max-w-full object-contain">
      </div>
      <h2 class="mt-8 text-3xl sm:text-4xl font-extrabold text-slate-800 tracking-tight">Bienvenido al Sistema de Gestión FRC</h2>
      <p v-if="usuarioActivo" class="mt-3 text-slate-500">Hola, <span class="font-semibold text-slate-700">{{ usuarioActivo.nombre }}</span></p>
      <button @click="menuAbierto = true"
        class="mt-8 inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl shadow transition text-sm">
        <i class="fa-solid fa-bars"></i> Abrir menú de módulos
      </button>
      <!-- Mis Tareas: resumen del día -->
      <button @click="irAMisTareas" class="mt-4 inline-flex items-center gap-3 bg-white hover:bg-amber-50 border border-slate-200 rounded-2xl px-4 py-3 shadow-sm transition text-left">
        <span class="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center"><i class="fa-solid fa-calendar-check"></i></span>
        <span>
          <span class="block text-sm font-bold text-slate-800">Mis tareas de hoy: {{ hechasHoy.length }}/{{ ocurrenciasHoy.length }} hechas</span>
          <span class="block text-xs" :class="vencidas.length ? 'text-rose-600 font-semibold' : 'text-slate-500'">{{ vencidas.length ? vencidas.length + ' vencida(s) · ' : '' }}{{ pendientesHoy.length }} pendiente(s) · ver calendario</span>
        </span>
      </button>
    </div>
  `,
  setup() {
    return { usuarioActivo, menuAbierto, logoSrc, onLogoError, irAMisTareas, ocurrenciasHoy, hechasHoy, pendientesHoy, vencidas };
  }
};
