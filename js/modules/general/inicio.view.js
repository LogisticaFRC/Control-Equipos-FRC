// =====================================================================
// GENERAL · Pantalla de Inicio (bienvenida). Es la primera que se ve al iniciar sesión.
// =====================================================================
import { usuarioActivo } from '../../core/store.js';
import { menuAbierto } from '../../core/menu.js';
import { logoSrc, onLogoError } from '../configuracion/configuracion.service.js';

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
    </div>
  `,
  setup() {
    return { usuarioActivo, menuAbierto, logoSrc, onLogoError };
  }
};
