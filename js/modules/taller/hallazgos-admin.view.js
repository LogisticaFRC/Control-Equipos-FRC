// =====================================================================
// TALLER · HALLAZGOS de un equipo (dentro de REPARAR, PC del taller / Operaciones) · 2026-11-13
//   · Admin: marca uno o varios hallazgos → "Crear OT con los marcados" (o agregarlos a la OT abierta),
//            escribe NOTA y FECHA APROX. del repuesto (el mecánico lo ve en su celular), o descarta.
//   · Botón INSPECCIÓN EQUIPO (2026-11-16): el mecánico enumera todas las fallas y repuestos → llega aquí agrupado por inspección.
//   · Revisan / arman la OT: Admin o Subadmin de Operaciones y Admin / Subadmin del área Administración (puedeGestionarHallazgos).
// =====================================================================
import * as S from './taller.service.js';
import { folioSugerido } from '../ot/ot.service.js';
import { puedeEditar, isAdmin } from '../../core/store.js';
import InspeccionEquipo from './inspeccion-equipo.view.js';
import { formatDateForDisplay } from '../../core/utils.js';

const { ref, computed, watch } = Vue;

export default {
  name: 'HallazgosAdmin',
  props: { rep: { type: Object, required: true }, ot: { type: Object, default: null } },
  components: { InspeccionEquipo },
  emits: ['ot-creada'],
  template: /* html */ `
<section class="rounded-2xl border-2 border-violet-200 bg-violet-50 p-4 space-y-3">
  <button v-if="puedeInspeccionar" @click="abiertaInsp = true" class="w-full bg-[#1f4d3a] hover:bg-[#173a2c] text-white text-lg font-black py-4 rounded-2xl shadow flex items-center justify-center gap-2">
    <i class="fa-solid fa-clipboard-list text-amber-300"></i>{{ S.tieneInspeccion(rep) ? 'NUEVA INSPECCIÓN / AGREGAR FALLAS' : 'INSPECCIÓN EQUIPO' }}
  </button>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <h4 class="text-sm font-black uppercase text-violet-900"><i class="fa-solid fa-magnifying-glass-plus mr-1"></i>Inspección y fallas del equipo · {{ lista.length }}<span v-if="pendientes.length" class="ml-2 bg-amber-400 text-slate-900 rounded-full px-2 py-0.5 text-[11px]">{{ pendientes.length }} esperando OT</span></h4>
    <span class="text-[11px] text-violet-800">El mecánico hace la inspección al entrar a la nave. Con esa información se arma la OT.</span>
  </div>
  <p v-if="S.faltaTablaProblemas.value" class="text-xs text-rose-700 font-semibold">Falta ejecutar sql/taller_firmas_problemas.sql y sql/taller_hallazgos.sql en Supabase.</p>

  <template v-for="g in S.inspeccionesDeRep(rep)" :key="g.id">
  <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
    <span class="text-xs font-black uppercase text-[#1f4d3a]"><i :class="['fa-solid mr-1', g.esInspeccion ? 'fa-clipboard-list' : 'fa-comment-dots']"></i>{{ g.esInspeccion ? 'Inspección' : 'Reporte' }} · {{ fechaHora(g.fecha) }} · {{ g.por }} · {{ g.items.length }} ítem(s)</span>
    <span class="flex items-center gap-3">
      <button v-if="gestor && g.items.some(h => h.estado === 'PENDIENTE')" @click="marcarGrupo(g)" class="text-xs font-bold text-violet-700 underline">Marcar esta inspección</button>
      <button v-if="isAdmin" @click="S.eliminarHallazgos(g.items, (g.esInspeccion ? 'la inspección completa' : 'este reporte') + ' (' + g.items.length + ' ítem(s))')" class="text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg px-2.5 py-1"><i class="fa-solid fa-trash mr-1"></i>Eliminar {{ g.esInspeccion ? 'inspección' : 'reporte' }}</button>
    </span>
  </div>
  <div v-for="h in g.items" :key="h.id" :class="['bg-white rounded-xl border-2 p-3 space-y-2', marcados[h.id] ? 'border-violet-500' : 'border-transparent']">
    <div class="flex items-start gap-3">
      <input v-if="gestor && h.estado === 'PENDIENTE'" type="checkbox" v-model="marcados[h.id]" class="w-6 h-6 mt-0.5 shrink-0 accent-violet-600" title="Marcar para la OT">
      <div class="flex-1 min-w-0">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-base font-bold text-slate-800"><span v-if="h.item_n" class="text-slate-400 mr-1">{{ h.item_n }}.</span><b v-if="h.sistema" class="text-violet-800">{{ h.sistema }} · </b>{{ h.descripcion }}</span>
          <span :class="['text-[10px] font-bold px-2 py-0.5 rounded-full border', (S.ESTADO_HALLAZGO[h.estado] || {}).c]">{{ (S.ESTADO_HALLAZGO[h.estado] || {}).t || h.estado }}{{ S.otDeHallazgo(h) ? ' N° ' + S.otDeHallazgo(h).folio : '' }}</span>
        </div>
        <div v-if="h.necesita_repuesto" class="text-sm text-amber-800 font-semibold"><i class="fa-solid fa-gear mr-1"></i>Pide repuesto: {{ h.cantidad ? h.cantidad + ' x ' : '' }}{{ h.repuesto }}</div>
        <p class="text-[11px] text-slate-500">{{ h.reportado_por }} · {{ fechaHora(h.created_at) }}<template v-if="h.estado === 'RECHAZADO' && h.respuesta"> · <b>{{ h.respuesta }}</b></template></p>
      </div>
      <button v-if="isAdmin" @click="S.eliminarHallazgos([h])" title="Eliminar esta falla (Admin)" class="shrink-0 text-slate-300 hover:text-rose-600 text-lg px-1"><i class="fa-solid fa-trash"></i></button>
      <a v-if="h.foto_url" :href="h.foto_url" target="_blank" rel="noopener" class="shrink-0"><img :src="h.foto_url" class="w-20 h-16 object-cover rounded-lg border" alt="foto"></a>
    </div>
    <!-- Nota y fecha aprox. del repuesto (la ve el mecánico) -->
    <div v-if="gestor && h.estado !== 'RECHAZADO'" class="flex flex-wrap items-end gap-2 md:pl-9">
      <label class="flex-1 min-w-[200px] text-[10px] font-bold uppercase text-slate-500">Nota para el mecánico<input v-model="notas[h.id].nota" class="mt-0.5 w-full p-2 border-2 rounded-lg text-sm normal-case font-semibold" placeholder="Ej: repuesto pedido a proveedor"></label>
      <label class="text-[10px] font-bold uppercase text-slate-500">Fecha aprox. repuesto<input type="date" v-model="notas[h.id].fecha" class="mt-0.5 block p-2 border-2 rounded-lg text-sm font-bold"></label>
      <button @click="guardarNota(h)" :disabled="!cambioNota(h)" class="px-3 py-2 rounded-lg bg-sky-600 text-white font-bold text-sm disabled:opacity-40"><i class="fa-solid fa-floppy-disk mr-1"></i>Guardar nota</button>
      <button v-if="h.estado === 'PENDIENTE'" @click="S.rechazarProblema(h)" class="px-3 py-2 rounded-lg border font-bold text-sm text-slate-600 hover:bg-slate-50">Descartar</button>
    </div>
    <div v-else-if="h.nota_admin || h.fecha_aprox_repuesto" class="text-xs bg-slate-50 rounded-lg px-2 py-1 md:pl-9"><b v-if="h.nota_admin">Nota:</b> {{ h.nota_admin }} <b v-if="h.fecha_aprox_repuesto" class="text-sky-800"> · Repuesto aprox. {{ formatDateForDisplay(h.fecha_aprox_repuesto) }}</b></div>
  </div>
  </template>
  <p v-if="!lista.length" class="text-sm text-violet-800/70 italic">Todavía no se hace la inspección de este equipo.</p>

  <!-- Admin: armar la OT con los marcados -->
  <div v-if="gestor && pendientes.length" class="rounded-xl bg-white border-2 border-dashed border-violet-300 p-3 space-y-3">
    <div class="flex flex-wrap items-center gap-2 text-sm font-bold text-violet-900">
      <span>{{ nMarcados }} marcado(s)</span>
      <button @click="marcarTodos(true)" class="text-xs underline">Marcar todos</button>
      <button @click="marcarTodos(false)" class="text-xs underline">Ninguno</button>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
      <label class="text-xs font-bold text-slate-600">N° FOLIO OT nueva<input v-model="formOT.folio" inputmode="numeric" class="mt-1 w-full p-2.5 border-2 rounded-xl text-lg font-black text-rose-700 text-center"></label>
      <label class="text-xs font-bold text-slate-600">Tipo<select v-model="formOT.tipo" class="mt-1 w-full p-2.5 border-2 rounded-xl font-bold"><option>CORRECTIVA</option><option>PREVENTIVA</option><option>PREDICTIVA</option></select></label>
      <label class="text-xs font-bold text-slate-600">Mecánico a cargo<input v-model="formOT.mecanico" class="mt-1 w-full p-2.5 border-2 rounded-xl font-bold"></label>
      <button @click="crearOT" :disabled="ocupado || !nMarcados || !formOT.folio" class="py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black disabled:opacity-40"><i class="fa-solid fa-file-circle-plus mr-1"></i>Crear OT con los marcados</button>
    </div>
    <button v-if="ot" @click="agregarAOT" :disabled="ocupado || !nMarcados" class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black disabled:opacity-40"><i class="fa-solid fa-plus mr-1"></i>Agregar los marcados a la OT N° {{ ot.folio }}</button>
    <p class="text-[11px] text-slate-500">Cada hallazgo queda como actividad de la OT y los repuestos pedidos pasan a la sección Repuestos. La OT queda enlazada al AFI {{ rep.afi }}.</p>
  </div>

  <inspeccion-equipo v-if="abiertaInsp" :rep="rep" @cerrar="abiertaInsp = false"></inspeccion-equipo>
</section>`,
  setup(props, { emit }) {
    const marcados = ref({});
    const notas = ref({});
    const ocupado = ref(false);
    const abiertaInsp = ref(false);
    const gestor = computed(() => S.puedeGestionarHallazgos());
    const puedeInspeccionar = computed(() => puedeEditar.value || S.esMecanicoTaller() || gestor.value);
    const marcarGrupo = (g) => g.items.filter(h => h.estado === 'PENDIENTE' && h.sistema !== 'OBSERVACIÓN GENERAL').forEach(h => { marcados.value[h.id] = true; });
    const formOT = ref({ folio: String(folioSugerido.value || ''), tipo: 'CORRECTIVA', mecanico: '' });

    const lista = computed(() => S.problemasDeRep(props.rep));
    const pendientes = computed(() => lista.value.filter(h => h.estado === 'PENDIENTE'));
    const nMarcados = computed(() => pendientes.value.filter(h => marcados.value[h.id]).length);
    // copia editable de nota / fecha por hallazgo
    watch(lista, (l) => l.forEach(h => { if (!notas.value[h.id]) notas.value[h.id] = { nota: h.nota_admin || '', fecha: h.fecha_aprox_repuesto || '' }; }), { immediate: true });
    const cambioNota = (h) => { const n = notas.value[h.id] || {}; return (n.nota || '') !== (h.nota_admin || '') || (n.fecha || '') !== (h.fecha_aprox_repuesto || ''); };
    const guardarNota = (h) => S.guardarNotaHallazgo(h, notas.value[h.id].nota, notas.value[h.id].fecha);
    const marcarTodos = (v) => { pendientes.value.forEach(h => { marcados.value[h.id] = v; }); };
    const elegidos = () => pendientes.value.filter(h => marcados.value[h.id]);

    const crearOT = async () => {
      ocupado.value = true;
      try {
        const ot = await S.crearOTDesdeHallazgos(props.rep, elegidos(), formOT.value);
        if (ot) { marcados.value = {}; formOT.value = { folio: String(folioSugerido.value || ''), tipo: 'CORRECTIVA', mecanico: '' }; emit('ot-creada', ot); }
      } finally { ocupado.value = false; }
    };
    const agregarAOT = async () => {
      ocupado.value = true;
      try { if (await S.agregarHallazgosAOT(props.ot, elegidos())) marcados.value = {}; }
      finally { ocupado.value = false; }
    };
    const fechaHora = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };

    return { S, isAdmin, gestor, puedeInspeccionar, abiertaInsp, marcarGrupo, puedeEditar, lista, pendientes, marcados, nMarcados, notas, cambioNota, guardarNota, marcarTodos, formOT, crearOT, agregarAOT, ocupado, fechaHora, formatDateForDisplay };
  }
};
