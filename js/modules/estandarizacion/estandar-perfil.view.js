// =====================================================================
// PERFIL DEL EQUIPO · pestaña ESTANDARIZACIÓN (2026-11-18)
//   Figura 3D del equipo (verde, sin marca, logo FRC) con los elementos del estándar marcados según la
//   ÚLTIMA estandarización, la lista de esa revisión al lado y el historial completo debajo.
// =====================================================================
import * as E from './estandarizacion.service.js';
import { montarEquipo3D, figuraDe } from './equipo3d.js';
import { formatDateForDisplay } from '../../core/utils.js';
import { isAdmin } from '../../core/store.js';

const { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } = Vue;
const peor = (a, b) => (a === 'MALO' || b === 'MALO' ? 'MALO' : a || b);

export default {
  name: 'EstandarEquipo',
  props: { eq: { type: Object, required: true } },
  template: /* html */ `
<div class="space-y-5" data-est="perfil">
  <p v-if="E.faltaTabla.value" class="text-xs text-rose-700 font-semibold bg-rose-50 border border-rose-200 rounded-lg p-2">{{ E.SQL_EST }}</p>
  <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
    <!-- Figura 3D -->
    <div class="lg:col-span-3 rounded-2xl border overflow-hidden bg-gradient-to-b from-slate-50 to-emerald-50 relative">
      <div class="absolute top-3 left-4 z-10">
        <p class="text-[10px] font-black uppercase tracking-wider text-emerald-800">{{ esVeh ? 'Figura del vehículo' : 'Figura del equipo' }}</p>
        <p class="text-lg font-black text-slate-800 leading-tight">AFI {{ eq.afi }} <span class="text-sm font-bold text-slate-500">{{ eq.tipo }}</span></p>
      </div>
      <div class="absolute top-3 right-3 z-10 flex gap-1">
        <button @click="alternarNombres" :class="['px-2 py-1 rounded-lg border text-[11px] font-bold', conNombres ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white/90 text-slate-600']" title="Mostrar u ocultar los nombres" data-est="nombres"><i class="fa-solid fa-tags mr-1"></i>Nombres</button>
        <button v-for="v in VISTAS" :key="v.k" @click="vista(v.k)" class="px-2 py-1 rounded-lg bg-white/90 border text-[11px] font-bold text-slate-600 hover:bg-white" :title="v.t"><i :class="['fa-solid', v.i]"></i></button>
      </div>
      <div ref="host3d" class="w-full h-[380px] sm:h-[440px]" data-est="3d"></div>
      <p v-if="error3d" class="absolute inset-0 flex items-center justify-center text-sm text-slate-500 p-6 text-center">{{ error3d }}</p>
      <div class="absolute bottom-3 left-4 right-4 z-10 flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-600">
        <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-emerald-600"></span>Bueno</span>
        <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-rose-600 animate-pulse"></span>Malo / falta</span>
        <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-slate-300"></span>N/A</span>
        <span class="ml-auto text-slate-400 font-semibold">Arrastra para girar · rueda para acercar · toca un nombre</span>
      </div>
    </div>
    <!-- Última estandarización -->
    <div class="lg:col-span-2 rounded-2xl border bg-white flex flex-col max-h-[440px]">
      <div class="p-4 border-b">
        <div class="flex items-start justify-between gap-2">
          <div><p class="text-[10px] font-black uppercase tracking-wider text-slate-500">{{ esVeh ? 'Último check list' : 'Última estandarización' }}<span v-if="ult && E.tipoInspeccionDe(ult)" class="ml-1 normal-case tracking-normal px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">{{ E.tipoInspeccionDe(ult) }}</span></p>
            <p v-if="ult" class="font-bold text-slate-800">{{ formatDateForDisplay(ult.fecha) }} <span class="text-xs text-slate-500 font-semibold">· {{ responsables(ult) }}</span></p>
            <p v-else class="text-sm text-slate-500">Este equipo aún no tiene estandarización. La hace el mecánico desde la app.</p></div>
          <div v-if="ult" class="text-right"><div :class="['text-3xl font-black leading-none', E.colorPct(ult.cumplimiento)]">{{ ult.cumplimiento }}%</div><div class="text-[10px] text-slate-500">{{ nBuenos }} bueno · {{ nMalos }} malo</div></div>
        </div>
        <div v-if="ult" class="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden"><div class="h-full bg-emerald-500" :style="{ width: ult.cumplimiento + '%' }"></div></div>
      </div>
      <div v-if="ult" class="flex-1 overflow-y-auto divide-y">
        <button v-for="it in ult.items" :key="it.k" @click="elegir(it.k)" @mouseenter="hover(it.k)" @mouseleave="hover(null)"
          :class="['w-full flex items-start gap-2 px-4 py-2 text-left text-sm transition', sel === it.k ? 'bg-amber-50' : 'hover:bg-slate-50']" :data-k="it.k">
          <i :class="['fa-solid mt-0.5 w-4', it.estado === 'BUENO' ? 'fa-circle-check text-emerald-600' : it.estado === 'MALO' ? 'fa-circle-xmark text-rose-600' : 'fa-circle-minus text-slate-300']"></i>
          <span class="flex-1 min-w-0"><span :class="['block leading-snug', it.estado === 'MALO' ? 'font-bold text-rose-700' : 'text-slate-700']">{{ it.t }}</span>
            <span v-if="it.obs" class="block text-[11px] text-rose-600">{{ it.obs }}</span></span>
          <span :class="['text-[11px] font-mono font-bold shrink-0', it.encontrada != null && it.encontrada < it.cant ? 'text-rose-600' : 'text-slate-400']">{{ it.encontrada ?? '–' }}/{{ it.cant }}</span>
        </button>
      </div>
      <p v-if="ult && ult.observaciones" class="p-3 border-t text-xs text-slate-600"><b>Obs.:</b> {{ ult.observaciones }}</p>
    </div>
  </div>

  <!-- Historial -->
  <div class="rounded-2xl border bg-white">
    <div class="px-4 py-3 border-b flex items-center justify-between"><h4 class="text-sm font-black uppercase text-slate-700"><i class="fa-solid fa-shield-halved mr-1 text-emerald-700"></i>Historial de estandarización · {{ lista.length }}</h4>
      <button @click="E.cargarEstandarizaciones(eq.afi)" class="text-xs font-bold text-slate-500 hover:text-slate-800"><i class="fa-solid fa-rotate mr-1"></i>Actualizar</button></div>
    <table v-if="lista.length" class="w-full text-sm">
      <thead class="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th class="text-left px-4 py-2">Fecha</th><th class="text-left px-2">Cumplimiento</th><th class="text-left px-2">Malos</th><th class="text-left px-2 hidden sm:table-cell">Responsable</th><th class="text-left px-2 hidden md:table-cell">Horómetro</th><th></th></tr></thead>
      <tbody>
        <template v-for="r in lista" :key="r.id || r.created_at">
        <tr class="border-t hover:bg-slate-50 cursor-pointer" @click="abierto = abierto === r ? null : r">
          <td class="px-4 py-2 font-mono">{{ formatDateForDisplay(r.fecha) }}<span v-if="E.tipoInspeccionDe(r)" class="block font-sans text-[10px] text-slate-500">{{ E.tipoInspeccionDe(r) }}</span></td>
          <td class="px-2"><b :class="E.colorPct(r.cumplimiento)">{{ r.cumplimiento }}%</b></td>
          <td class="px-2"><span v-if="malos(r).length" class="text-rose-700 font-bold">{{ malos(r).length }}</span><span v-else class="text-emerald-700">0</span></td>
          <td class="px-2 hidden sm:table-cell text-xs">{{ responsables(r) }}</td>
          <td class="px-2 hidden md:table-cell font-mono text-xs">{{ r.horometro ?? '–' }}</td>
          <td class="px-3 text-right whitespace-nowrap"><i :class="['fa-solid text-slate-400', abierto === r ? 'fa-chevron-up' : 'fa-chevron-down']"></i>
            <button v-if="isAdmin" @click.stop="E.eliminarEstandarizacion(r)" class="ml-3 text-slate-300 hover:text-rose-600" title="Eliminar (Admin)"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
        <tr v-if="abierto === r" class="bg-slate-50"><td colspan="6" class="px-4 py-3">
          <div class="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <div v-for="it in r.items" :key="it.k" class="flex gap-2"><i :class="['fa-solid mt-0.5', it.estado === 'BUENO' ? 'fa-check text-emerald-600' : it.estado === 'MALO' ? 'fa-xmark text-rose-600' : 'fa-minus text-slate-300']"></i><span :class="it.estado === 'MALO' ? 'text-rose-700 font-bold' : ''">{{ it.t }}<template v-if="it.obs"> · {{ it.obs }}</template></span></div>
          </div>
          <p v-if="r.observaciones" class="mt-2 text-xs"><b>Observaciones:</b> {{ r.observaciones }}</p>
          <div class="mt-2 flex flex-wrap gap-3"><div v-for="p in r.responsables || []" :key="p.nombre" class="text-[11px] text-slate-500 text-center"><img v-if="p.firma_url" :src="p.firma_url" class="h-12 bg-white border rounded" alt="firma"><span class="block">{{ p.nombre }}</span></div></div>
        </td></tr>
        </template>
      </tbody>
    </table>
    <p v-else class="px-4 py-6 text-sm text-slate-400 italic">Sin estandarizaciones registradas.</p>
  </div>
</div>`,
  setup(props) {
    const VISTAS = [{ k: 'girar', i: 'fa-rotate', t: 'Girar solo' }, { k: 'frente', i: 'fa-arrow-right', t: 'Lado derecho' }, { k: 'lado', i: 'fa-arrow-down', t: 'Frente' }, { k: 'atras', i: 'fa-arrow-left', t: 'Lado izquierdo' }];
    const host3d = ref(null), error3d = ref(''), sel = ref(null), abierto = ref(null), conNombres = ref(true);
    const alternarNombres = () => { conNombres.value = !conNombres.value; vis && vis.nombres(conNombres.value); };
    let vis = null;
    const esVeh = computed(() => E.esVehiculoEst(props.eq));
    const lista = computed(() => E.registrosDe(props.eq.afi));
    const ult = computed(() => lista.value[0] || null);
    const nBuenos = computed(() => (ult.value?.items || []).filter(i => i.estado === 'BUENO').length);
    const nMalos = computed(() => (ult.value?.items || []).filter(i => i.estado === 'MALO').length);
    const malos = (r) => (r.items || []).filter(i => i.estado === 'MALO');
    const responsables = (r) => (r.responsables || []).map(p => p.nombre).join(', ') || r.usuario || '';
    const estados3d = () => { const m = {}; (ult.value?.items || []).forEach(i => { m[i.k] = i.estado; }); m.gps = peor(m.gps, m.gps_func); return m; };
    const montar = async () => {
      if (vis) { vis.destruir(); vis = null; }
      await nextTick();
      if (!host3d.value) return;
      try { vis = await montarEquipo3D(host3d.value, { tipo: props.eq.tipo, afi: props.eq.afi, vehiculo: E.esVehiculoEst(props.eq), estados: estados3d(), nombres: conNombres.value, onPick: (k) => { sel.value = k; vis && vis.resaltar(k); if (k) { const b = document.querySelector(`[data-est=perfil] [data-k="${k}"]`); b && b.scrollIntoView({ block: 'nearest' }); } } }); error3d.value = ''; }
      catch (e) { error3d.value = 'No se pudo cargar la figura 3D (revisa la conexión a internet).'; console.warn(e); }
    };
    const elegir = (k) => { sel.value = sel.value === k ? null : k; vis && vis.resaltar(sel.value); };
    const hover = (k) => { vis && vis.resaltar(k || sel.value); };
    const vista = (v) => { if (!vis) return; if (v === 'girar') vis.girar(true); else vis.vista(v); };
    onMounted(async () => { await E.cargarEstandarizaciones(props.eq.afi); montar(); });
    watch(() => props.eq.afi, async () => { await E.cargarEstandarizaciones(props.eq.afi); montar(); });
    watch(ult, () => { vis && vis.actualizar(estados3d()); });
    onBeforeUnmount(() => { vis && vis.destruir(); });
    return { E, esVeh, conNombres, alternarNombres, VISTAS, host3d, error3d, sel, abierto, lista, ult, nBuenos, nMalos, malos, responsables, elegir, hover, vista, isAdmin, formatDateForDisplay, figuraDe };
  }
};
