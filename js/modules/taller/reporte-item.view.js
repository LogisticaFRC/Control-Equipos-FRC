// =====================================================================
// TALLER · REPORT POR ÍTEM DE LA OT (2026-11-20)
// Mismo report que terreno, por cada ítem de la OT de taller: personal, fecha/hora de inicio y término,
// horómetro, uso ART (fotos de las 2 hojas) y bloqueo de equipo (foto), descripción y "ítem terminado".
// Firmas: todavía NO (se agregan cuando se decida). Se usa en la app (Taller) y en la vista de taller / tótem.
// =====================================================================
import * as S from './taller.service.js';
import { formatDateForDisplay } from '../../core/utils.js';

const { ref, computed } = Vue;

export default {
  name: 'ReporteItem',
  props: { ot: { type: Object, required: true }, idx: { type: Number, required: true }, puede: { type: Boolean, default: true } },
  template: /* html */ `
<div class="mt-1" data-reporte-item>
  <!-- Resumen -->
  <div v-if="!abierto && (r || a.detalle_mec || a.ejecutante || a.f_inicio || a.f_term)" class="text-xs bg-sky-50 border border-sky-200 rounded-xl px-3 py-2 text-slate-700 space-y-1">
    <template v-if="r">
      <div class="flex flex-wrap gap-x-3 gap-y-0.5">
        <span><i class="fa-solid fa-users mr-1 text-sky-700"></i>{{ (r.personal || []).join(', ') || '—' }}</span>
        <span><i class="fa-solid fa-clock mr-1 text-sky-700"></i>{{ formatDateForDisplay(r.fecha_inicio) }} {{ r.hora_inicio }} → {{ formatDateForDisplay(r.fecha_termino) }} {{ r.hora_termino }}</span>
        <span v-if="r.horometro"><i class="fa-solid fa-gauge mr-1 text-sky-700"></i>{{ r.horometro }} h</span>
        <span v-if="r.uso_art" class="font-bold text-amber-700">ART ✔</span>
        <span v-if="r.bloqueo" class="font-bold text-rose-700">Bloqueo ✔</span>
      </div>
      <p class="whitespace-pre-line">{{ r.descripcion }}</p>
      <div v-if="fotos.length" class="flex gap-1.5 flex-wrap"><a v-for="u in fotos" :key="u" :href="u" target="_blank" rel="noopener"><img :src="u" class="h-12 w-12 object-cover rounded border"></a></div>
    </template>
    <template v-else>
      <div class="flex flex-wrap gap-x-3 gap-y-0.5">
        <span v-if="a.ejecutante"><i class="fa-solid fa-users mr-1 text-sky-700"></i>{{ a.ejecutante }}</span>
        <span v-if="a.f_inicio || a.f_term"><i class="fa-solid fa-clock mr-1 text-sky-700"></i>{{ formatDateForDisplay(a.f_inicio) }} {{ a.h_inicio }} → {{ formatDateForDisplay(a.f_term) }} {{ a.h_term }}</span>
      </div>
      <p v-if="a.detalle_mec" class="whitespace-pre-line"><b class="text-sky-800">Trabajo realizado:</b> {{ a.detalle_mec }}</p>
    </template>
    <button v-if="puede" @click="abrir" class="text-[11px] font-bold text-sky-700 underline">Editar report</button>
  </div>
  <button v-else-if="!abierto && puede" @click="abrir" class="w-full py-2.5 rounded-xl border-2 border-dashed border-sky-400 text-sky-800 font-bold text-sm bg-white" data-reporte="abrir"><i class="fa-solid fa-file-pen mr-1"></i>Llenar report de este ítem</button>

  <!-- Formulario -->
  <div v-if="abierto" class="bg-white border-2 border-sky-300 rounded-2xl p-3 space-y-3 text-sm" data-reporte="form">
    <div>
      <p class="text-[11px] font-black uppercase text-slate-500 mb-1">Personal</p>
      <div v-for="(p, k) in f.personal" :key="k" class="flex gap-2 mb-1.5">
        <input v-model="f.personal[k]" class="flex-1 border-2 rounded-lg px-3 py-2 uppercase" :placeholder="k === 0 ? 'Responsable' : 'Nombre'">
        <button v-if="f.personal.length > 1" @click="f.personal.splice(k, 1)" class="px-3 rounded-lg border text-rose-600"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <button v-if="f.personal.length < 6" @click="f.personal.push('')" class="text-xs font-bold text-sky-700"><i class="fa-solid fa-user-plus mr-1"></i>Agregar persona</button>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <label class="block"><span class="text-[11px] font-black uppercase text-slate-500">Fecha inicio</span><input type="date" v-model="f.fecha_inicio" class="w-full border-2 rounded-lg px-2 py-2"></label>
      <label class="block"><span class="text-[11px] font-black uppercase text-slate-500">Hora inicio</span><input type="time" v-model="f.hora_inicio" class="w-full border-2 rounded-lg px-2 py-2"></label>
      <label class="block"><span class="text-[11px] font-black uppercase text-slate-500">Fecha término</span><input type="date" v-model="f.fecha_termino" class="w-full border-2 rounded-lg px-2 py-2"></label>
      <label class="block"><span class="text-[11px] font-black uppercase text-slate-500">Hora término</span><input type="time" v-model="f.hora_termino" class="w-full border-2 rounded-lg px-2 py-2"></label>
    </div>
    <label class="block"><span class="text-[11px] font-black uppercase text-slate-500">Horómetro</span><input v-model="f.horometro" inputmode="decimal" class="w-full border-2 rounded-lg px-3 py-2 font-mono" placeholder="Ej: 2366"></label>

    <div class="rounded-xl border p-2.5 space-y-2">
      <div class="flex items-center justify-between"><span class="font-bold">Uso de ART</span>
        <div class="flex gap-1"><button v-for="v in [true, false]" :key="String(v)" @click="f.uso_art = v" :class="['px-3 py-1.5 rounded-lg border-2 font-bold text-xs', f.uso_art === v ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white']">{{ v ? 'SÍ' : 'NO' }}</button></div></div>
      <div v-if="f.uso_art" class="grid grid-cols-2 gap-2">
        <label v-for="k in [0, 1]" :key="k" class="relative h-24 rounded-lg border-2 border-dashed flex items-center justify-center text-xs text-slate-500 overflow-hidden cursor-pointer">
          <img v-if="f.art_fotos[k]" :src="f.art_fotos[k]" class="absolute inset-0 w-full h-full object-cover">
          <span v-else-if="subiendo === 'ART' + k"><i class="fa-solid fa-spinner fa-spin"></i></span>
          <span v-else><i class="fa-solid fa-camera mr-1"></i>Hoja {{ k + 1 }} del ART</span>
          <input type="file" accept="image/*" capture="environment" class="hidden" @change="e => foto(e, 'ART', k)">
        </label>
      </div>
    </div>
    <div class="rounded-xl border p-2.5 space-y-2">
      <div class="flex items-center justify-between"><span class="font-bold">Bloqueo de equipo</span>
        <div class="flex gap-1"><button v-for="v in [true, false]" :key="String(v)" @click="f.bloqueo = v" :class="['px-3 py-1.5 rounded-lg border-2 font-bold text-xs', f.bloqueo === v ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white']">{{ v ? 'SÍ' : 'NO' }}</button></div></div>
      <label v-if="f.bloqueo" class="relative h-24 rounded-lg border-2 border-dashed flex items-center justify-center text-xs text-slate-500 overflow-hidden cursor-pointer">
        <img v-if="f.bloqueo_foto" :src="f.bloqueo_foto" class="absolute inset-0 w-full h-full object-cover">
        <span v-else-if="subiendo === 'BLOQ0'"><i class="fa-solid fa-spinner fa-spin"></i></span>
        <span v-else><i class="fa-solid fa-camera mr-1"></i>Foto del registro de bloqueo</span>
        <input type="file" accept="image/*" capture="environment" class="hidden" @change="e => foto(e, 'BLOQ', 0)">
      </label>
    </div>
    <label class="block"><span class="text-[11px] font-black uppercase text-slate-500">Descripción del trabajo</span>
      <textarea v-model="f.descripcion" rows="3" class="w-full border-2 rounded-lg px-3 py-2" placeholder="Qué hiciste, qué cambiaste, observaciones…"></textarea></label>

    <label :class="['flex items-center gap-3 rounded-xl p-3 border-2 cursor-pointer', f.terminada ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50 border-slate-300']">
      <input type="checkbox" v-model="f.terminada" class="w-6 h-6 accent-emerald-600"><b>Ítem terminado</b>
    </label>
    <div v-if="f.terminada && faltan.length" class="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2">Falta: {{ faltan.join(' · ') }}</div>
    <p class="text-[11px] text-slate-500"><i class="fa-solid fa-circle-info mr-1"></i>Las firmas se agregarán más adelante.</p>
    <div class="flex gap-2">
      <button @click="abierto = false" class="flex-1 py-2.5 rounded-xl border font-bold text-slate-600">Cancelar</button>
      <button @click="guardar" :disabled="ocupado || Boolean(subiendo)" class="flex-[2] py-2.5 rounded-xl bg-sky-600 text-white font-black disabled:opacity-50" data-reporte="guardar"><i class="fa-solid fa-floppy-disk mr-1"></i>{{ ocupado ? 'Guardando…' : 'Guardar report' }}</button>
    </div>
  </div>
</div>`,
  setup(props) {
    const a = computed(() => props.ot.actividades[props.idx] || {});
    const r = computed(() => a.value.reporte || null);
    const fotos = computed(() => r.value ? [...(r.value.art_fotos || []), r.value.bloqueo_foto].filter(Boolean) : []);
    const abierto = ref(false), ocupado = ref(false), subiendo = ref(''), f = ref(null);
    const faltan = computed(() => f.value ? S.faltaReporteItem(f.value) : []);
    const abrir = () => { f.value = S.reporteItemVacio(props.ot, a.value); abierto.value = true; };
    const foto = async (e, cual, k) => {
      const file = e.target.files?.[0]; e.target.value = '';
      if (!file) return;
      subiendo.value = cual + k;
      try {
        const url = await S.subirFotoItem(props.ot, file, cual + (k + 1));
        if (cual === 'ART') { const l = [...f.value.art_fotos]; l[k] = url; f.value.art_fotos = l; } else f.value.bloqueo_foto = url;
      } catch (err) { alert('No se pudo subir la foto: ' + (err?.message || err)); }
      finally { subiendo.value = ''; }
    };
    const guardar = async () => {
      ocupado.value = true;
      try { if (await S.guardarReporteItem(props.ot, props.idx, f.value)) abierto.value = false; } finally { ocupado.value = false; }
    };
    /** Para abrir el formulario desde afuera (tocar el ítem). */
    return { a, r, fotos, abierto, ocupado, subiendo, f, faltan, abrir, foto, guardar, formatDateForDisplay };
  }
};
