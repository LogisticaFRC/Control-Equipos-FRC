// =====================================================================
// TALLER · EDITAR UN HALLAZGO (2026-11-17)
//   Mecánicos y Admin corrigen sistema / descripción / repuesto mientras el hallazgo espera OT.
//   Se usa en REPARAR (PC / tótem) y en la app del mecánico. Guarda con frc_hallazgo_editar (sql/taller_editar.sql).
// =====================================================================
import * as S from './taller.service.js';

const { ref } = Vue;

export default {
  name: 'HallazgoEditar',
  props: { h: { type: Object, required: true } },
  emits: ['cerrar'],
  template: /* html */ `
<div class="rounded-xl border-2 border-sky-300 bg-sky-50 p-3 space-y-2" data-hallazgo-editar>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
    <label class="text-[10px] font-bold uppercase text-slate-500">Sistema
      <select v-model="f.sistema" class="mt-0.5 w-full p-2 border-2 rounded-lg text-sm font-bold bg-white">
        <option value="">—</option>
        <option v-for="s in sistemas" :key="s" :value="s">{{ s }}</option>
      </select></label>
    <label class="sm:col-span-2 text-[10px] font-bold uppercase text-slate-500">Descripción
      <textarea v-model="f.descripcion" rows="2" class="mt-0.5 w-full p-2 border-2 rounded-lg text-sm font-semibold normal-case" data-he="desc"></textarea></label>
  </div>
  <label class="flex items-center gap-2 text-sm font-bold text-amber-800"><input type="checkbox" v-model="f.necesita_repuesto" class="w-5 h-5 accent-amber-600">Necesita repuesto</label>
  <div v-if="f.necesita_repuesto" class="grid grid-cols-4 gap-2">
    <label class="text-[10px] font-bold uppercase text-slate-500">Cant.<input v-model="f.cantidad" inputmode="numeric" class="mt-0.5 w-full p-2 border-2 rounded-lg text-sm font-bold"></label>
    <label class="col-span-3 text-[10px] font-bold uppercase text-slate-500">Repuesto<input v-model="f.repuesto" class="mt-0.5 w-full p-2 border-2 rounded-lg text-sm font-semibold normal-case"></label>
  </div>
  <div class="flex gap-2 justify-end">
    <button @click="$emit('cerrar')" class="px-3 py-2 rounded-lg border bg-white font-bold text-sm text-slate-600">Cancelar</button>
    <button @click="guardar" :disabled="ocupado" class="px-4 py-2 rounded-lg bg-sky-600 text-white font-bold text-sm disabled:opacity-50" data-he="guardar"><i class="fa-solid fa-floppy-disk mr-1"></i>Guardar cambios</button>
  </div>
</div>`,
  setup(props, { emit }) {
    const h = props.h;
    const sistemas = [...new Set([...S.SISTEMAS_HALLAZGO, ...(h.sistema ? [h.sistema] : [])])];
    const f = ref({ sistema: h.sistema || '', descripcion: h.descripcion || '', necesita_repuesto: Boolean(h.necesita_repuesto), repuesto: h.repuesto || '', cantidad: h.cantidad || '' });
    const ocupado = ref(false);
    const guardar = async () => {
      ocupado.value = true;
      try { if (await S.editarHallazgo(h, f.value)) emit('cerrar'); } finally { ocupado.value = false; }
    };
    return { f, sistemas, guardar, ocupado };
  }
};

// =====================================================================
// DETALLE DEL TRABAJO de una actividad de la OT (2026-11-17)
//   El mecánico describe lo que hizo. Queda solo en el sistema (no sale en la OT impresa).
// =====================================================================
export const DetalleActividad = {
  name: 'DetalleActividad',
  props: { ot: { type: Object, required: true }, idx: { type: Number, required: true }, puede: { type: Boolean, default: true } },
  template: /* html */ `
<div class="mt-1" data-detalle-act>
  <div v-if="!abierto && a.detalle_mec" class="text-xs bg-sky-50 border border-sky-200 rounded-lg px-2 py-1.5 text-slate-700">
    <b class="text-sky-800"><i class="fa-solid fa-pen-to-square mr-1"></i>Trabajo realizado:</b> <span class="whitespace-pre-line">{{ a.detalle_mec }}</span>
    <span class="block text-[10px] text-slate-400">{{ a.detalle_por }}{{ a.detalle_at ? ' · ' + String(a.detalle_at).replace('T', ' ') : '' }}</span>
    <button v-if="puede" @click="abrir" class="text-[11px] font-bold text-sky-700 underline">Editar</button>
  </div>
  <button v-else-if="!abierto && puede" @click="abrir" class="text-xs font-bold text-sky-700"><i class="fa-solid fa-pen-to-square mr-1"></i>Describir el trabajo</button>
  <div v-if="abierto" class="space-y-1.5">
    <textarea v-model="txt" rows="3" class="w-full p-2 border-2 border-sky-300 rounded-lg text-sm" placeholder="Qué hiciste, qué cambiaste, observaciones…" data-detalle="txt"></textarea>
    <div class="flex gap-2 justify-end">
      <button @click="abierto = false" class="px-3 py-1.5 rounded-lg border font-bold text-xs text-slate-600 bg-white">Cancelar</button>
      <button @click="guardar" :disabled="ocupado" class="px-3 py-1.5 rounded-lg bg-sky-600 text-white font-bold text-xs disabled:opacity-50" data-detalle="guardar"><i class="fa-solid fa-floppy-disk mr-1"></i>Guardar</button>
    </div>
  </div>
</div>`,
  setup(props) {
    const { computed } = Vue;
    const a = computed(() => props.ot.actividades[props.idx] || {});
    const abierto = ref(false), txt = ref(''), ocupado = ref(false);
    const abrir = () => { txt.value = a.value.detalle_mec || ''; abierto.value = true; };
    const guardar = async () => {
      ocupado.value = true;
      try { if (await S.guardarDetalleActividad(props.ot, props.idx, txt.value)) abierto.value = false; } finally { ocupado.value = false; }
    };
    return { a, abierto, txt, ocupado, abrir, guardar };
  }
};
