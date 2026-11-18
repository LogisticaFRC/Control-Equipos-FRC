// =====================================================================
// OT · OT DE FALLAS (2026-11-18)
// Las OT se dividen en dos:
//   · OT de Reparación: la OT de siempre (formato FRC-RE-OPE-006).
//   · OT de Fallas: la que crea el técnico en la app (antes "levantamiento de fallas"):
//     observación + fallas enumeradas. Cada falla se repara con su propio report de
//     intervención (tiempos, ART, bloqueo y firmas) y queda enlazado a la OT de Fallas.
// Datos: bd_mec_intervenciones (modo INSPECCION) + bd_taller_problemas (sus fallas).
// =====================================================================
import * as M from '../mecanicos/mecanicos.service.js';
import { asegurarFallas } from '../mecanicos/fallas-equipo.js';
import { currentTab, buscarEquipoPorAfi, isAdmin } from '../../core/store.js';
import { formatDateForDisplay } from '../../core/utils.js';

const { ref, computed, onMounted } = Vue;

export default {
  name: 'OtFallas',
  template: /* html */ `
<div class="space-y-4 text-xs" data-ot="fallas">
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
    <div v-for="k in kpis" :key="k.e" @click="filtro.estado = k.e" :class="['rounded-xl border p-3 cursor-pointer hover:shadow', k.c, filtro.estado === k.e ? 'ring-2 ring-amber-500' : '']">
      <p class="text-[10px] font-bold uppercase opacity-80">{{ k.t }}</p><p class="text-2xl font-extrabold">{{ k.n }}</p></div>
  </div>

  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <div class="p-3 border-b flex flex-wrap gap-2 items-center">
      <input v-model="filtro.texto" type="text" placeholder="Buscar N°, AFI, equipo, falla, técnico..." class="p-2 border rounded-lg w-72">
      <button @click="recargar" class="w-9 h-9 rounded-lg border text-slate-500 hover:bg-slate-50" title="Actualizar"><i :class="['fa-solid fa-rotate', M.cargandoMec.value ? 'fa-spin' : '']"></i></button>
      <span class="text-slate-500">Las crea el técnico en la app (equipo → <b>OT de Fallas</b>). Cada falla se cierra con su report de reparación.</span>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-left">
        <thead class="bg-slate-800 text-white uppercase text-[10px]">
          <tr><th class="p-2.5">N°</th><th class="p-2.5">Fecha</th><th class="p-2.5">Falla del equipo</th><th class="p-2.5">AFI</th><th class="p-2.5">Equipo</th><th class="p-2.5">Técnico</th><th class="p-2.5">Fallas</th><th class="p-2.5">Avance</th><th class="p-2.5">Estado</th><th class="p-2.5"></th></tr>
        </thead>
        <tbody>
          <template v-for="o in lista" :key="o.r.id">
            <tr :class="['border-t cursor-pointer hover:bg-amber-50/50', abierta === o.r.id ? 'bg-amber-50' : '']" @click="abierta = abierta === o.r.id ? null : o.r.id" :data-ot="'fila-' + o.r.id">
              <td class="p-2.5 font-black text-amber-700">OF-{{ o.r.id }}</td>
              <td class="p-2.5 font-mono">{{ formatDateForDisplay(o.r.fecha) }}</td>
              <td class="p-2.5 font-mono">{{ o.r.hora_falla || o.r.fecha_falla ? [formatDateForDisplay(o.r.fecha_falla || o.r.fecha), o.r.hora_falla].filter(Boolean).join(' ') : '—' }}</td>
              <td class="p-2.5 font-bold">{{ o.r.afi }}</td>
              <td class="p-2.5">{{ o.equipo }}</td>
              <td class="p-2.5">{{ (o.r.mecanicos || [])[0]?.nombre || o.r.creado_por }}</td>
              <td class="p-2.5 font-bold">{{ o.av.total }}</td>
              <td class="p-2.5 w-36"><div class="flex items-center gap-2"><div class="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden"><div class="h-full bg-emerald-500" :style="{ width: (o.av.total ? 100 * o.av.listas / o.av.total : 0) + '%' }"></div></div><b>{{ o.av.listas }}/{{ o.av.total }}</b></div></td>
              <td class="p-2.5"><span :class="['px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap', o.completa ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300']">{{ o.completa ? 'Completa' : 'Abierta' }}</span>
                <span v-if="!o.completa && o.r.disp_anterior" class="block text-[10px] text-rose-700 font-bold mt-0.5"><i class="fa-solid fa-ban mr-0.5"></i>Equipo fuera de servicio</span></td>
              <td class="p-2.5 whitespace-nowrap text-right" @click.stop>
                <button @click="M.descargarPDF(o.r)" class="px-2 py-1 rounded-lg border font-bold" title="Hoja PDF"><i class="fa-solid fa-file-pdf text-rose-600"></i></button>
                <button v-if="isAdmin && !o.items.some(i => ['REPARADO', 'AGREGADO'].includes(i.estado))" @click="M.borrarLevantamiento(o.r)" class="px-2 py-1 rounded-lg border border-rose-200 text-rose-600 font-bold ml-1" title="Borrar OT de Fallas (Admin)"><i class="fa-solid fa-trash"></i></button>
              </td>
            </tr>
            <tr v-if="abierta === o.r.id" class="bg-amber-50/40">
              <td colspan="10" class="p-3">
                <p v-if="o.r.descripcion" class="mb-2 text-slate-700"><i class="fa-solid fa-eye mr-1 text-slate-400"></i><b>Observación:</b> {{ o.r.descripcion }}</p>
                <div class="bg-white rounded-xl border divide-y">
                  <div v-for="i in o.items" :key="i.n" class="flex flex-wrap items-center gap-3 px-3 py-2">
                    <span :class="['w-6 h-6 rounded-full text-white text-[11px] font-black flex items-center justify-center shrink-0', i.estado === 'REPARADO' ? 'bg-emerald-600' : 'bg-amber-500']">{{ i.n }}</span>
                    <span class="flex-1 min-w-[220px]"><b :class="i.estado === 'REPARADO' ? 'text-slate-500' : 'text-slate-800'">{{ i.descripcion }}</b><span v-if="i.sistema" class="text-slate-400"> · {{ i.sistema }}</span>
                      <span v-if="i.necesita_repuesto" class="block text-[11px] text-amber-800"><i class="fa-solid fa-gear mr-1"></i>{{ i.cantidad ? i.cantidad + ' x ' : '' }}{{ i.repuesto }}{{ i.codigo_repuesto ? ' · cód. ' + i.codigo_repuesto : '' }}</span>
                      <span v-if="i.serie_motor" class="block text-[11px] text-slate-500 font-mono">Serie motor: {{ i.serie_motor }}</span></span>
                    <a v-for="u in (i.fotos || [])" :key="u" :href="u" target="_blank" rel="noopener"><img :src="u" class="w-9 h-9 rounded object-cover border" alt=""></a>
                    <span :class="['text-[10px] font-bold px-2 py-0.5 rounded-full border', i.estado === 'REPARADO' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : i.estado === 'AGREGADO' ? 'bg-sky-50 text-sky-800 border-sky-300' : i.estado === 'RECHAZADO' ? 'bg-slate-100 text-slate-500 border-slate-300' : 'bg-amber-50 text-amber-800 border-amber-300']">{{ i.estado === 'REPARADO' ? 'Reparada' : i.estado === 'AGREGADO' ? 'En OT de Reparación' : i.estado === 'RECHAZADO' ? 'Descartada' : 'Abierta' }}</span>
                    <button v-for="x in i.reparaciones" :key="x.id" @click="verReport(x)" class="text-[11px] font-bold text-emerald-700 border border-emerald-300 bg-white hover:bg-emerald-50 rounded-lg px-2 py-0.5"><i class="fa-solid fa-wrench mr-1"></i>Report N° {{ x.id }} · {{ formatDateForDisplay(x.fecha) }} · {{ M.textoDuracion(x.duracion_min) }}</button>
                  </div>
                </div>
              </td>
            </tr>
          </template>
          <tr v-if="!lista.length"><td colspan="10" class="p-10 text-center text-slate-400 font-bold">No hay OT de Fallas{{ filtro.estado || filtro.texto ? ' con ese filtro' : '' }}.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>`,
  setup() {
    const recargar = () => { M.cargarMec(); asegurarFallas(true); };
    onMounted(recargar);
    const filtro = ref({ estado: 'ABIERTA', texto: '' });
    const abierta = ref(null);
    const todas = computed(() => M.dbMec.value.filter(r => r.modo === 'INSPECCION').sort((a, b) => b.id - a.id).map(r => {
      const items = M.fallasDeLevantamiento(r), av = M.avanceLevantamiento(r);
      const e = buscarEquipoPorAfi(r.afi);
      return { r, items, av, completa: !items.some(i => ['PENDIENTE', 'AGREGADO'].includes(i.estado)), equipo: e ? [e.tipo, e.marca, e.modelo].filter(Boolean).join(' ') : (r.equipo || '') };
    }));
    const lista = computed(() => {
      const q = String(filtro.value.texto || '').trim().toUpperCase();
      return todas.value.filter(o => (!filtro.value.estado || (['ABIERTA', 'FALLAS'].includes(filtro.value.estado) ? !o.completa : o.completa))
        && (!q || ['OF-' + o.r.id, o.r.afi, o.equipo, o.r.descripcion, (o.r.mecanicos || []).map(m => m.nombre).join(' '), o.items.map(i => i.descripcion).join(' ')].join(' ').toUpperCase().includes(q)));
    });
    const kpis = computed(() => [
      { e: '', t: 'Total OT de Fallas', n: todas.value.length, c: 'bg-white text-slate-800' },
      { e: 'ABIERTA', t: 'Abiertas', n: todas.value.filter(o => !o.completa).length, c: 'bg-amber-100 text-amber-800 border-amber-300' },
      { e: 'COMPLETA', t: 'Completas', n: todas.value.filter(o => o.completa).length, c: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      { e: 'FALLAS', t: 'Fallas abiertas', n: todas.value.reduce((s, o) => s + o.items.filter(i => ['PENDIENTE', 'AGREGADO'].includes(i.estado)).length, 0), c: 'bg-rose-50 text-rose-800 border-rose-200' }
    ]);
    // Abre el report de reparación en el panel MECÁNICOS
    const verReport = (x) => { M.filtroPanel.value = ''; M.abrirRegPanel(x); currentTab.value = 'mecPanel'; };
    return { M, filtro, abierta, lista, kpis, verReport, formatDateForDisplay, isAdmin };
  }
};
