// =====================================================================
// APP TÉCNICOS · LEVANTAMIENTOS DE FALLAS DEL EQUIPO (carpetas) · 2026-11-18
// Cada levantamiento es una "carpeta" con sus fallas enumeradas. Al abrirla se ven las
// fallas (actividades) con su estado y el botón REPARAR, que inicia el report de reparación
// (con firmas, ART y bloqueo en fotos). Las reparaciones quedan enlazadas al levantamiento.
// =====================================================================
import * as S from './mecanicos.service.js';
import { fallasAbiertasDe, asegurarFallas } from './fallas-equipo.js';
import { mismoAfi, formatDateForDisplay } from '../../core/utils.js';

const { ref, computed, onMounted, watch } = Vue;

export default {
  name: 'LevantamientosEquipo',
  props: { eq: { type: Object, required: true } },
  emits: ['reparar'],
  template: /* html */ `
<div class="bg-white rounded-2xl shadow-sm p-4 space-y-2" data-lev="carpetas">
  <div class="flex items-center justify-between">
    <div class="lbl"><i class="fa-solid fa-folder-tree text-amber-500 mr-1"></i>OT de Fallas</div>
    <span :class="['text-xs font-black px-2 py-0.5 rounded-full', nAbiertas ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800']">{{ nAbiertas ? nAbiertas + ' abierta' + (nAbiertas === 1 ? '' : 's') : 'sin fallas abiertas' }}</span>
  </div>
  <p v-if="!activos.length && !sueltas.length && !completos.length" class="text-sm text-slate-400 italic">Aún no hay OT de Fallas. Usa <b>OT de Fallas</b> para enumerar lo que encuentres.</p>

  <!-- Carpetas con fallas pendientes -->
  <div v-for="l in activos" :key="l.r.id" class="border-2 border-amber-200 rounded-xl overflow-hidden" :data-lev="'carpeta-' + l.r.id">
    <button @click="abrir[l.r.id] = !abrir[l.r.id]" class="w-full flex items-center gap-3 px-3 py-2.5 bg-amber-50 text-left">
      <i :class="['fa-solid text-amber-500 text-xl', abrir[l.r.id] ? 'fa-folder-open' : 'fa-folder']"></i>
      <span class="flex-1 min-w-0"><b class="block text-sm">OT de Fallas N° {{ S.folioOF(l.r) }} · {{ formatDateForDisplay(l.r.fecha) }}</b>
        <span class="text-[11px] text-slate-600">{{ l.r.hora_falla || l.r.fecha_falla ? 'Falla ' + [formatDateForDisplay(l.r.fecha_falla || l.r.fecha), l.r.hora_falla].filter(Boolean).join(' ') + ' · ' : '' }}{{ (l.r.mecanicos || [])[0]?.nombre || l.r.creado_por }}</span>
        <span v-if="l.r.disp_anterior" class="block text-[10px] font-bold text-rose-700"><i class="fa-solid fa-ban mr-0.5"></i>Equipo fuera de servicio hasta reparar todo</span></span>
      <span class="text-xs font-black text-amber-800 whitespace-nowrap">{{ l.av.listas }}/{{ l.av.total }}</span>
      <i :class="['fa-solid fa-chevron-down text-slate-400 transition', abrir[l.r.id] ? 'rotate-180' : '']"></i>
    </button>
    <div v-if="abrir[l.r.id]" class="divide-y">
      <div v-if="S.esSupervisorMec.value && !l.items.some(i => ['REPARADO', 'AGREGADO'].includes(i.estado))" class="px-3 py-1.5 bg-white text-right">
        <button @click="S.borrarLevantamiento(l.r)" class="text-xs font-bold text-rose-600 hover:text-rose-800" :data-lev="'borrar-' + l.r.id"><i class="fa-solid fa-trash mr-1"></i>Borrar OT de Fallas (Admin)</button>
      </div>
      <p v-if="l.r.descripcion" class="px-3 py-2 text-xs text-slate-600 italic bg-white"><i class="fa-solid fa-eye mr-1"></i>{{ l.r.descripcion }}</p>
      <div v-for="i in l.items" :key="i.n" class="px-3 py-2.5 flex items-start gap-3 bg-white">
        <span :class="['w-7 h-7 rounded-full text-white font-black text-sm flex items-center justify-center shrink-0', i.estado === 'REPARADO' ? 'bg-emerald-600' : 'bg-amber-500']">{{ i.n }}</span>
        <div class="flex-1 min-w-0">
          <p :class="['font-bold text-sm leading-snug', i.estado === 'REPARADO' ? 'text-slate-400 line-through' : '']">{{ i.descripcion }}</p>
          <p v-if="i.necesita_repuesto" class="text-[11px] text-amber-800 font-semibold"><i class="fa-solid fa-gear mr-1"></i>{{ i.cantidad ? i.cantidad + ' x ' : '' }}{{ i.repuesto }}<span v-if="i.codigo_repuesto" class="font-mono"> · cód. {{ i.codigo_repuesto }}</span></p>
          <p v-if="i.serie_motor" class="text-[11px] text-slate-500 font-mono">Serie motor: {{ i.serie_motor }}</p>
          <div v-if="(i.fotos || []).length" class="flex gap-1 my-1"><a v-for="u in i.fotos" :key="u" :href="u" target="_blank" rel="noopener"><img :src="u" class="w-10 h-10 rounded object-cover border" alt=""></a></div>
          <p class="text-[11px] text-slate-500">{{ i.sistema }}<template v-if="i.estado === 'AGREGADO'"> · <b class="text-sky-700">en OT</b></template>
            <template v-if="i.estado === 'REPARADO'"><b class="text-emerald-700">Reparada</b>{{ i.reparado_por ? ' por ' + i.reparado_por : '' }}<template v-for="x in i.reparaciones" :key="x.id"> · report N° {{ x.id }}</template></template></p>
        </div>
        <div v-if="i.id && ['PENDIENTE', 'AGREGADO'].includes(i.estado)" class="flex flex-col gap-1 shrink-0">
          <button @click="reparar(i, 'MECANICA', l)" class="px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-extrabold" :data-lev="'reparar-' + i.id"><i class="fa-solid fa-wrench mr-1"></i>Reparar</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Fallas abiertas sin levantamiento (hallazgos del taller u otros) -->
  <div v-if="sueltas.length" class="border-2 border-slate-200 rounded-xl overflow-hidden">
    <div class="px-3 py-2 bg-slate-50 text-sm font-bold"><i class="fa-solid fa-triangle-exclamation text-amber-500 mr-1"></i>Otras fallas abiertas ({{ sueltas.length }})</div>
    <div v-for="(h, k) in sueltas" :key="h.id" class="px-3 py-2.5 flex items-start gap-3 border-t">
      <span class="w-7 h-7 rounded-full bg-slate-400 text-white font-black text-sm flex items-center justify-center shrink-0">{{ k + 1 }}</span>
      <div class="flex-1 min-w-0"><p class="font-bold text-sm leading-snug">{{ h.descripcion }}</p><p class="text-[11px] text-slate-500">{{ h.sistema ? h.sistema + ' · ' : '' }}{{ h.reportado_por }}</p></div>
      <div class="flex flex-col gap-1 shrink-0">
        <button @click="$emit('reparar', { falla: h, tipo: 'MECANICA' })" class="px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-extrabold"><i class="fa-solid fa-wrench mr-1"></i>Reparar</button>
      </div>
    </div>
  </div>

  <!-- Carpetas completas -->
  <details v-if="completos.length">
    <summary class="text-xs font-bold text-emerald-700 cursor-pointer py-1"><i class="fa-solid fa-folder-closed mr-1"></i>OT de Fallas completas ({{ completos.length }})</summary>
    <div v-for="l in completos" :key="l.r.id" class="py-1.5 border-b last:border-0 text-xs flex items-center gap-2">
      <i class="fa-solid fa-circle-check text-emerald-600"></i>
      <span class="flex-1">N° {{ S.folioOF(l.r) }} · {{ formatDateForDisplay(l.r.fecha) }} · {{ l.av.total }} falla{{ l.av.total === 1 ? '' : 's' }} reparada{{ l.av.total === 1 ? '' : 's' }}</span>
    </div>
  </details>
</div>`,
  setup(props, { emit }) {
    onMounted(() => { asegurarFallas(); });
    const abrir = ref({});
    const levs = computed(() => S.dbMec.value
      .filter(r => r.modo === 'INSPECCION' && mismoAfi(r.afi, props.eq.afi) && (r.fallas || []).length)
      .sort((a, b) => b.id - a.id)
      .map(r => ({ r, items: S.fallasDeLevantamiento(r), av: S.avanceLevantamiento(r) })));
    const activos = computed(() => levs.value.filter(l => l.items.some(i => ['PENDIENTE', 'AGREGADO'].includes(i.estado))));
    const completos = computed(() => levs.value.filter(l => !activos.value.includes(l)));
    // Abiertas que no están en ningún levantamiento cargado
    const sueltas = computed(() => {
      const ids = new Set(levs.value.flatMap(l => l.items.map(i => String(i.id))));
      return fallasAbiertasDe(props.eq.afi).filter(h => !ids.has(String(h.id)));
    });
    const nAbiertas = computed(() => fallasAbiertasDe(props.eq.afi).length);
    // La carpeta más nueva con pendientes queda abierta
    watch(() => activos.value[0]?.r.id, (id) => { if (id && abrir.value[id] === undefined) abrir.value[id] = true; }, { immediate: true });
    const reparar = (i, tipo, l) => {
      const h = { id: i.id, descripcion: i.descripcion, sistema: i.sistema, intervencion_id: l ? l.r.id : null, estado: i.estado };
      const real = (fallasAbiertasDe(props.eq.afi).find(x => String(x.id) === String(i.id))) || h;
      emit('reparar', { falla: real, tipo });
    };
    return { S, abrir, activos, completos, sueltas, nAbiertas, reparar, formatDateForDisplay };
  }
};
