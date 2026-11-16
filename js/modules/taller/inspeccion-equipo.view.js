// =====================================================================
// TALLER · INSPECCIÓN DE EQUIPO (2026-11-16)
// Ventana que abre el botón "INSPECCIÓN EQUIPO" (REPARAR en el PC y carta del equipo en la app del mecánico).
// El mecánico enumera todas las fallas encontradas y los repuestos que faltan → se envía a
// Operaciones / Administración, que arman la OT con esa información (hallazgos-admin.view.js).
// =====================================================================
import * as S from './taller.service.js';

const { ref } = Vue;

export default {
  name: 'InspeccionEquipo',
  props: { rep: { type: Object, required: true } },
  emits: ['cerrar', 'enviada'],
  template: /* html */ `
<div class="fixed inset-0 z-[80] bg-slate-950/80 flex items-start justify-center p-2 sm:p-4 overflow-y-auto">
  <div class="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden my-2">
    <div class="bg-[#1f4d3a] text-white px-5 py-4 flex items-center justify-between gap-3">
      <div>
        <h3 class="text-xl font-black"><i class="fa-solid fa-clipboard-list mr-2 text-amber-300"></i>INSPECCIÓN EQUIPO · AFI {{ rep.afi }}</h3>
        <p class="text-xs text-emerald-100">{{ S.descEquipo(rep.afi) }}<span v-if="rep.nave"> · {{ rep.nave }}</span> — enumera todas las fallas y repuestos que faltan.</p>
      </div>
      <button @click="$emit('cerrar')" class="text-3xl leading-none text-white/80 hover:text-white" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <div class="p-4 sm:p-5 space-y-3 bg-slate-50">
      <div v-for="(it, k) in items" :key="k" class="bg-white rounded-2xl border-2 border-slate-200 p-3 sm:p-4 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-lg font-black text-[#1f4d3a]">Ítem {{ k + 1 }}</span>
          <button v-if="items.length > 1" @click="items.splice(k, 1)" class="text-sm font-bold text-rose-600"><i class="fa-solid fa-trash mr-1"></i>Quitar</button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select v-model="it.sistema" class="p-3 border-2 rounded-xl font-bold bg-white"><option value="">Sistema / parte…</option><option v-for="s in S.SISTEMAS_HALLAZGO" :key="s">{{ s }}</option></select>
          <textarea v-model="it.descripcion" rows="2" class="sm:col-span-2 p-3 border-2 rounded-xl" placeholder="Falla encontrada. Ej: fuga de aceite por sello trasero del cigüeñal"></textarea>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <label class="flex items-center gap-2 font-bold text-sm mr-2"><input type="checkbox" v-model="it.necesita_repuesto" class="w-5 h-5"> Falta repuesto</label>
          <template v-if="it.necesita_repuesto">
            <input v-model="it.repuesto" class="flex-1 min-w-[160px] p-2.5 border-2 border-amber-300 rounded-xl" placeholder="Repuesto (nombre / N° parte)">
            <input v-model="it.cantidad" inputmode="decimal" class="w-24 p-2.5 border-2 border-amber-300 rounded-xl" placeholder="Cant.">
          </template>
        </div>
        <label class="block text-xs font-bold text-slate-500">Foto (opcional)
          <input type="file" accept="image/*" capture="environment" @change="e => it.foto = e.target.files[0] || null" class="block w-full text-sm mt-1"></label>
      </div>

      <button @click="items.push(S.itemInspeccionVacio())" class="w-full py-3 rounded-2xl border-2 border-dashed border-emerald-400 text-emerald-700 font-black bg-white"><i class="fa-solid fa-plus mr-1"></i>Agregar otra falla</button>

      <label class="block bg-white rounded-2xl border-2 border-slate-200 p-3">
        <span class="text-xs font-bold uppercase text-slate-500">Observación general (opcional)</span>
        <textarea v-model="observacion" rows="2" class="mt-1 w-full p-3 border-2 rounded-xl" placeholder="Estado general del equipo, pruebas realizadas, etc."></textarea>
      </label>
    </div>

    <div class="px-4 sm:px-5 py-4 bg-white border-t flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
      <p class="text-xs text-slate-500">{{ nItems }} falla(s) · {{ nRepuestos }} repuesto(s) · llega a Operaciones y Administración para armar la OT.</p>
      <div class="flex gap-2">
        <button @click="$emit('cerrar')" class="px-4 py-3 rounded-xl border font-bold text-slate-600">Cancelar</button>
        <button @click="enviar" :disabled="ocupado || (!nItems && !observacion.trim())" class="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-[#1f4d3a] text-white font-black disabled:opacity-40"><i :class="['fa-solid mr-1', ocupado ? 'fa-spinner fa-spin' : 'fa-paper-plane']"></i>Enviar inspección</button>
      </div>
    </div>
  </div>
</div>`,
  setup(props, { emit }) {
    const items = ref([S.itemInspeccionVacio()]);
    const observacion = ref('');
    const ocupado = ref(false);
    const nItems = Vue.computed(() => items.value.filter(i => String(i.descripcion || '').trim()).length);
    const nRepuestos = Vue.computed(() => items.value.filter(i => i.necesita_repuesto && String(i.repuesto || '').trim()).length);
    const enviar = async () => {
      ocupado.value = true;
      try {
        if (await S.enviarInspeccion(props.rep, items.value, observacion.value)) {
          alert('Inspección enviada ✔ Operaciones la revisa para armar la OT.');
          emit('enviada'); emit('cerrar');
        }
      } finally { ocupado.value = false; }
    };
    return { S, items, observacion, ocupado, nItems, nRepuestos, enviar };
  }
};
