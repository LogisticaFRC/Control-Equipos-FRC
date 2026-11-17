// =====================================================================
// PERFIL DEL EQUIPO · Pestaña "OT asignadas" (2026-11-17)
// Todas las OT del equipo (módulo OT), las abiertas primero: folio, fecha, tipo, estado,
// avance de actividades, si está en el taller (nave) y botones Abrir / Imprimir.
// =====================================================================
import { dbOT, cargarOT, cargandoOT, estadoOT, otAbierta, ETIQUETA_ESTADO_OT, ESTILO_ESTADO_OT, irAOT, imprimirOT } from '../ot/ot.service.js';
import { etiquetaTallerOT, actividadHecha } from '../taller/taller.service.js';
import { showPerfilEquipoModal } from './perfil.service.js';
import { mismoAfi, formatDateForDisplay } from '../../core/utils.js';

const { computed, onMounted } = Vue;

/** OT del equipo: abiertas primero, luego por folio (más nuevo arriba). */
export const otsDelEquipo = (afi) => dbOT.value
  .filter(o => mismoAfi(o.afi, afi))
  .sort((a, b) => (otAbierta(b) - otAbierta(a)) || (Number(b.folio) - Number(a.folio)));
export const otsAbiertasDelEquipo = (afi) => otsDelEquipo(afi).filter(otAbierta).length;

export default {
  name: 'OtsEquipo',
  props: { afi: { type: [String, Number], required: true } },
  template: /* html */ `
<div class="space-y-4">
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
    <div class="bg-white rounded-xl border p-3"><p class="text-[10px] font-bold uppercase text-slate-500">Total OT</p><p class="text-2xl font-black text-slate-800">{{ lista.length }}</p></div>
    <div class="bg-white rounded-xl border border-amber-200 p-3"><p class="text-[10px] font-bold uppercase text-amber-700">Abiertas</p><p class="text-2xl font-black text-amber-700">{{ abiertas }}</p></div>
    <div class="bg-white rounded-xl border border-emerald-200 p-3"><p class="text-[10px] font-bold uppercase text-emerald-700">Realizadas / cerradas</p><p class="text-2xl font-black text-emerald-700">{{ lista.length - abiertas - anuladas }}</p></div>
    <div class="bg-white rounded-xl border p-3"><p class="text-[10px] font-bold uppercase text-slate-500">Anuladas</p><p class="text-2xl font-black text-slate-400">{{ anuladas }}</p></div>
  </div>

  <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
    <div class="px-4 py-2.5 border-b flex items-center justify-between gap-2">
      <h4 class="font-bold text-slate-800 uppercase"><i class="fa-solid fa-file-signature text-rose-600 mr-1"></i> Órdenes de trabajo del equipo</h4>
      <button @click="cargarOT" :disabled="cargandoOT" class="text-[11px] font-bold text-slate-500 hover:text-slate-800"><i :class="['fa-solid mr-1', cargandoOT ? 'fa-spinner fa-spin' : 'fa-rotate']"></i>Actualizar</button>
    </div>
    <div v-if="!lista.length" class="p-6 text-center text-slate-400 italic">{{ cargandoOT ? 'Cargando OT…' : 'Este equipo no tiene OT asignadas.' }}</div>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-left text-[11px]">
        <thead class="bg-slate-100 text-slate-600 uppercase text-[9px]">
          <tr><th class="p-2">Folio</th><th class="p-2">Fecha</th><th class="p-2">Tipo</th><th class="p-2">Actividades</th><th class="p-2">Avance</th><th class="p-2">Estado</th><th class="p-2">Taller</th><th class="p-2 text-right">Acciones</th></tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="o in lista" :key="o.id" :class="otAbierta(o) ? '' : 'bg-slate-50/60'">
            <td class="p-2 font-mono font-black text-rose-700">{{ o.folio }}</td>
            <td class="p-2 whitespace-nowrap">{{ formatDateForDisplay(o.fecha) }}</td>
            <td class="p-2 font-bold whitespace-nowrap">{{ tipo(o) }}</td>
            <td class="p-2 max-w-[280px]"><span class="line-clamp-2" :title="acts(o).map(a => a.descripcion).join(' · ')">{{ acts(o).map(a => a.descripcion).join(' · ') || '—' }}</span></td>
            <td class="p-2 whitespace-nowrap">
              <template v-if="acts(o).length">
                <div class="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden"><div class="h-1.5 bg-emerald-500" :style="{ width: avance(o).pct + '%' }"></div></div>
                <span class="text-[10px] text-slate-500">{{ avance(o).done }}/{{ avance(o).total }}</span>
              </template>
              <span v-else class="text-slate-300">—</span>
            </td>
            <td class="p-2"><span :class="['px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap', ESTILO_ESTADO_OT[estadoOT(o)]]">{{ ETIQUETA_ESTADO_OT[estadoOT(o)] }}</span></td>
            <td class="p-2 whitespace-nowrap"><span v-if="etiquetaTallerOT(o)" class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold"><i class="fa-solid fa-warehouse mr-1"></i>{{ etiquetaTallerOT(o) }}</span><span v-else class="text-slate-300">—</span></td>
            <td class="p-2 text-right whitespace-nowrap">
              <button @click="abrir(o)" class="px-2 py-1 rounded-lg border font-bold text-slate-700 hover:bg-slate-50" title="Abrir en el módulo OT"><i class="fa-solid fa-up-right-from-square mr-1"></i>Abrir</button>
              <button @click="imprimirOT(o, 'respondida')" class="ml-1 px-2 py-1 rounded-lg border font-bold text-slate-700 hover:bg-slate-50" title="Imprimir OT"><i class="fa-solid fa-print"></i></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>`,
  setup(props) {
    onMounted(() => { if (!dbOT.value.length) cargarOT().catch(() => {}); });
    const lista = computed(() => otsDelEquipo(props.afi));
    const abiertas = computed(() => lista.value.filter(otAbierta).length);
    const anuladas = computed(() => lista.value.filter(o => estadoOT(o) === 'ANULADA').length);
    const acts = (o) => (o.actividades || []).filter(a => String(a.descripcion || '').trim());
    const avance = (o) => { const a = acts(o); const done = a.filter(actividadHecha).length; return { done, total: a.length, pct: a.length ? Math.round(done / a.length * 100) : 0 }; };
    const tipo = (o) => (o.tipo_mantencion ? o.tipo_mantencion + (o.pauta ? ' · ' + o.pauta : '') : '—');
    const abrir = (o) => { showPerfilEquipoModal.value = false; irAOT(o.folio); };
    return { lista, abiertas, anuladas, acts, avance, tipo, abrir, cargarOT, cargandoOT, estadoOT, otAbierta, ETIQUETA_ESTADO_OT, ESTILO_ESTADO_OT, etiquetaTallerOT, imprimirOT, formatDateForDisplay };
  }
};
