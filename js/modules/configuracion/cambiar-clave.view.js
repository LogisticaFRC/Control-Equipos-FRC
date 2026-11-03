// =====================================================================
// CONFIG & USUARIOS · Cuadro "Cambiar contraseña"
// - Obligatorio (no se puede cerrar) cuando el usuario entra con una clave inicial/temporal.
// - Opcional desde el botón de la llave en el encabezado.
// =====================================================================
import { usuarioActivo } from '../../core/store.js';
import { debeCambiarClave } from '../../core/sesion.js';
import { mostrarCambioClave, formClave, errorClave, guardandoClave, guardarNuevaClave, cerrarCambioClave, MIN_CLAVE, logout } from './configuracion.service.js';

const template = /* html */ `
<div v-if="mostrarCambioClave || debeCambiarClave" class="fixed inset-0 bg-slate-950/70 z-[60] flex items-center justify-center p-4">
  <form @submit.prevent="guardarNuevaClave" class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 text-xs">
    <div>
      <h3 class="text-base font-extrabold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-key text-amber-600"></i> Cambiar contraseña</h3>
      <p v-if="debeCambiarClave" class="text-slate-600 mt-1">Estás usando una contraseña inicial o temporal. Para continuar, crea una nueva contraseña personal.</p>
      <p class="text-slate-500 mt-1">Mínimo {{ MIN_CLAVE }} caracteres, con letras y números. No la compartas con nadie.</p>
    </div>
    <input type="text" :value="usuarioActivo && usuarioActivo.usuario" autocomplete="username" class="hidden" readonly>
    <div>
      <label class="font-bold text-slate-700 block mb-1">Nueva contraseña</label>
      <input type="password" v-model="formClave.nueva" autocomplete="new-password" required class="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none">
    </div>
    <div>
      <label class="font-bold text-slate-700 block mb-1">Repetir nueva contraseña</label>
      <input type="password" v-model="formClave.repetir" autocomplete="new-password" required class="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none">
    </div>
    <p v-if="errorClave" class="text-rose-600 font-bold bg-rose-50 p-2.5 rounded-lg border border-rose-200">{{ errorClave }}</p>
    <div class="flex justify-end gap-2">
      <button v-if="debeCambiarClave" type="button" @click="logout" class="px-3 py-2 rounded-lg border font-bold text-slate-600 hover:bg-slate-50">Salir</button>
      <button v-else type="button" @click="cerrarCambioClave" class="px-3 py-2 rounded-lg border font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
      <button type="submit" :disabled="guardandoClave" class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow disabled:opacity-60">
        <i :class="['fa-solid mr-1', guardandoClave ? 'fa-spinner fa-spin' : 'fa-floppy-disk']"></i> Guardar
      </button>
    </div>
  </form>
</div>
`;

export default {
  name: 'CambiarClave',
  template,
  setup() {
    return { usuarioActivo, debeCambiarClave, mostrarCambioClave, formClave, errorClave, guardandoClave, guardarNuevaClave, cerrarCambioClave, MIN_CLAVE, logout };
  }
};
