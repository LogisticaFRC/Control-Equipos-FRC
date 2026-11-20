// =====================================================================
// TALLER · Vista del MECÁNICO (app móvil → pestaña "Taller")  · 2026-11-13
// ---------------------------------------------------------------------
// Solo las CARTAS de los equipos del programa de reparación + la OT asignada a cada equipo.
// (Sin Gantt, sin listas de administración, sin OT de otros equipos.)
//   1) El mecánico ve los equipos del programa y los INGRESA a una nave.
//   2) Reporta HALLAZGOS por ítem: sistema, descripción, foto, ¿necesita repuesto? (cuál y cuántos).
//   3) El Admin crea la OT con esos hallazgos → aparece aquí; el mecánico marca las actividades terminadas.
//   4) La nota del Admin y la fecha aprox. del repuesto se ven en cada hallazgo.
// Funciones en taller.service.js · permisos en sql/taller_hallazgos.sql
// =====================================================================
import * as S from './taller.service.js';
import InspeccionEquipo from './inspeccion-equipo.view.js';
import HallazgoEditar from './hallazgo-editar.view.js';
import ReporteItem from './reporte-item.view.js';   // report por ítem de la OT (2026-11-20)
import ActividadesEquipo from '../mecanicos/actividades-equipo.view.js';
import { formatDateForDisplay, hoyISO } from '../../core/utils.js';

const { ref, computed, onMounted, onBeforeUnmount } = Vue;
const REFRESCO_MS = 45 * 1000;
/** Carta abierta (fuera del componente: se mantiene al volver de una intervención). */
const selKey = ref(null);

export default {
  name: 'TallerMecanico',
  components: { InspeccionEquipo, ActividadesEquipo, HallazgoEditar, ReporteItem },
  template: /* html */ `
<div class="p-4 space-y-3">
  <div v-if="S.faltaTablaTaller.value" class="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-3 text-sm">Falta ejecutar <b>sql/taller.sql</b> en Supabase.</div>

  <!-- ===================== DETALLE DE UN EQUIPO ===================== -->
  <template v-if="sel">
    <button @click="cerrar" class="text-sm font-bold text-emerald-700"><i class="fa-solid fa-arrow-left mr-1"></i>Volver a las cartas</button>
    <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
      <img :src="S.fotoDe(sel.afi)" class="w-full h-40 object-cover bg-slate-800" alt="">
      <div class="p-4">
        <div class="flex items-start justify-between gap-2">
          <div><div class="text-2xl font-black text-[#1f4d3a]">AFI {{ sel.afi }}</div><div class="text-xs text-slate-500">{{ S.descEquipo(sel.afi) }}</div></div>
          <span :class="['text-[10px] font-bold px-2 py-1 rounded-full border whitespace-nowrap', S.ESTILO_ESTADO[estadoCarta(sel)]]">{{ etiquetaCarta(sel) }}</span>
        </div>
        <div v-if="sel.item" class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-calendar-check mr-1"></i>Programa {{ S.nombreProg(S.programaTaller.value) }} · plan {{ formatDateForDisplay(sel.item.fecha_inicio) }} al {{ formatDateForDisplay(sel.item.fecha_fin) }} · {{ S.naveProgramada(sel.item) }}</div>
        <div v-if="sel.rep && sel.rep.faltante" class="mt-2 text-xs bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-2 whitespace-pre-line"><b>Le faltaba:</b> {{ sel.rep.faltante }}</div>
      </div>
    </div>

    <!-- Ingresar a nave -->
    <div v-if="!enNave(sel)" class="bg-white rounded-2xl shadow-sm p-4 space-y-2">
      <div class="lbl">Ingresar a la nave</div>
      <div v-if="S.navesLibres.value.length" class="grid grid-cols-2 gap-2">
        <button v-for="n in S.navesLibres.value" :key="n" @click="ingresar(n)" :disabled="ocupado"
          :class="['py-3 rounded-xl font-black border-2 disabled:opacity-50', sel.item && S.naveProgramada(sel.item) === n ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-300']">
          <i class="fa-solid fa-warehouse mr-1"></i>{{ n }}<span class="block text-[10px] font-bold opacity-80">quedan {{ S.cuposNave(n) }} de {{ S.CAPACIDAD_NAVE }}</span><span v-if="sel.item && S.naveProgramada(sel.item) === n" class="block text-[10px] font-bold">programada</span></button>
      </div>
      <p v-else class="text-sm text-slate-500">Todas las naves están llenas ({{ S.CAPACIDAD_NAVE }} equipos cada una).</p>
    </div>

    <template v-if="sel.rep">
      <!-- OT asignada -->
      <div v-for="ot in S.otsDeRep(sel.rep)" :key="ot.id" class="bg-white rounded-2xl shadow-sm p-4 space-y-2">
        <div class="flex items-center justify-between">
          <div class="font-black text-rose-700 text-lg">OT N° {{ ot.folio }}</div>
          <div class="text-right"><div :class="['text-2xl font-black leading-none', S.textoAvance(prog(ot).pct)]">{{ prog(ot).pct }}%</div><div class="text-[10px] text-slate-500">{{ prog(ot).done }}/{{ prog(ot).total }} listas</div></div>
        </div>
        <p class="text-[11px] text-slate-500">Por cada ítem llena su report (personal, horas, horómetro, ART y bloqueo) y márcalo terminado ahí.</p>
        <template v-for="(a, i) in ot.actividades" :key="i">
          <div v-if="a.descripcion && a.descripcion.trim()"
            :class="['w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left', S.actividadHecha(a) ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200']">
            <span :class="['w-10 h-10 shrink-0 rounded-lg border-4 flex items-center justify-center text-xl', S.actividadHecha(a) ? 'bg-emerald-500 border-emerald-600 text-white' : 'border-slate-300 text-transparent']"><i class="fa-solid fa-check"></i></span>
            <span class="flex-1 min-w-0"><span :class="['block font-bold leading-snug', S.actividadHecha(a) ? 'text-emerald-800' : 'text-slate-800']">{{ a.descripcion }}</span>
              <span v-if="S.actividadHecha(a)" class="text-[10px] text-emerald-700">Terminada {{ formatDateForDisplay(a.f_term) }} {{ a.h_term }}{{ a.ejecutante ? ' · ' + a.ejecutante : '' }}</span>
              <span v-else class="text-[10px] text-slate-500">{{ a.reporte ? 'Report guardado · pendiente' : 'Sin report' }}</span></span>
          </div>
          <reporte-item v-if="a.descripcion && a.descripcion.trim()" :ot="ot" :idx="i" :puede="abierta(ot)" class="pl-2"></reporte-item>
        </template>
        <p v-if="!prog(ot).total" class="text-sm text-slate-400 italic">La OT todavía no tiene actividades.</p>
        <div v-if="S.filasRepuestos(ot).length" class="text-xs bg-slate-50 rounded-lg p-2"><b>Repuestos:</b> {{ S.filasRepuestos(ot).map(r => r.x.repuestos).join(' · ') }}</div>
      </div>
      <div v-if="!S.otsDeRep(sel.rep).length" class="bg-sky-50 border border-sky-200 text-sky-900 rounded-2xl p-3 text-sm">
        <i class="fa-solid fa-circle-info mr-1"></i>Aún no hay OT. Haz la <b>INSPECCIÓN EQUIPO</b>: con esa información Operaciones arma la OT.
      </div>

      <!-- Actividades del equipo en nave: intervenciones (como terreno) + bloqueo + ART + mantención -->
      <div v-if="enNave(sel) && S.equipoDe(sel.afi)" class="space-y-2">
        <div class="lbl">Actividades del equipo</div>
        <actividades-equipo :eq="S.equipoDe(sel.afi)"></actividades-equipo>
      </div>
      <!-- INSPECCIÓN EQUIPO (2026-11-16): todas las fallas y repuestos de una vez -->
      <button @click="inspAbierta = true" class="w-full bg-[#1f4d3a] text-white rounded-2xl shadow p-4 flex items-center gap-4 text-left active:scale-[.99]">
        <span class="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl text-amber-300"><i class="fa-solid fa-clipboard-list"></i></span>
        <span class="flex-1"><b class="block text-lg">{{ S.tieneInspeccion(sel.rep) ? 'Agregar fallas (nueva inspección)' : 'INSPECCIÓN EQUIPO' }}</b><span class="text-xs text-emerald-100">Enumera todas las fallas y repuestos que faltan</span></span>
        <i class="fa-solid fa-chevron-right text-white/50"></i>
      </button>
      <inspeccion-equipo v-if="inspAbierta" :rep="sel.rep" @cerrar="inspAbierta = false"></inspeccion-equipo>

      <!-- Hallazgos enviados -->
      <div class="bg-white rounded-2xl shadow-sm p-4 space-y-2">
        <div class="lbl">Inspección y fallas de este equipo ({{ S.problemasDeRep(sel.rep).length }})</div>
        <template v-for="g in S.inspeccionesDeRep(sel.rep)" :key="g.id">
        <div class="text-[11px] font-black uppercase text-[#1f4d3a] pt-1">{{ g.esInspeccion ? 'Inspección' : 'Reporte' }} · {{ fechaHora(g.fecha) }} · {{ g.items.length }} ítem(s)</div>
        <div v-for="h in g.items" :key="h.id" class="border rounded-xl p-3 space-y-1">
          <div class="flex items-start justify-between gap-2">
            <div class="text-sm"><span v-if="h.item_n" class="text-slate-400 mr-1">{{ h.item_n }}.</span><b v-if="h.sistema" class="text-violet-800">{{ h.sistema }} · </b>{{ h.descripcion }}</div>
            <span :class="['text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap', (S.ESTADO_HALLAZGO[h.estado] || {}).c]">{{ (S.ESTADO_HALLAZGO[h.estado] || {}).t || h.estado }}{{ S.otDeHallazgo(h) ? ' N° ' + S.otDeHallazgo(h).folio : '' }}</span>
          </div>
          <button v-if="S.puedeEditarHallazgo(h) && editandoH !== h.id" @click="editandoH = h.id" class="text-xs font-bold text-sky-700" data-editar-h><i class="fa-solid fa-pen mr-1"></i>Editar</button>
          <hallazgo-editar v-if="editandoH === h.id" :h="h" @cerrar="editandoH = null"></hallazgo-editar>
          <div v-if="h.necesita_repuesto" class="text-xs text-amber-800"><i class="fa-solid fa-gear mr-1"></i>Repuesto: <b>{{ h.cantidad ? h.cantidad + ' x ' : '' }}{{ h.repuesto }}</b></div>
          <div v-if="h.fecha_aprox_repuesto" class="text-xs font-bold text-sky-800 bg-sky-50 rounded-lg px-2 py-1"><i class="fa-regular fa-calendar mr-1"></i>Repuesto llega aprox.: {{ formatDateForDisplay(h.fecha_aprox_repuesto) }}</div>
          <div v-if="h.nota_admin" class="text-xs bg-slate-100 rounded-lg px-2 py-1"><b>Nota de Operaciones:</b> {{ h.nota_admin }}</div>
          <div v-else-if="h.estado === 'RECHAZADO' && h.respuesta" class="text-xs bg-slate-100 rounded-lg px-2 py-1"><b>Motivo:</b> {{ h.respuesta }}</div>
          <a v-if="h.foto_url" :href="h.foto_url" target="_blank" rel="noopener"><img :src="h.foto_url" class="mt-1 h-20 rounded-lg object-cover" alt="foto"></a>
          <div class="text-[10px] text-slate-400">{{ h.reportado_por }} · {{ fechaHora(h.created_at) }}</div>
        </div>
        </template>
        <p v-if="!S.problemasDeRep(sel.rep).length" class="text-sm text-slate-400 italic">Todavía no haces la inspección de este equipo.</p>
      </div>
    </template>
  </template>

  <!-- ===================== CARTAS ===================== -->
  <template v-else>
    <div class="flex items-center justify-between gap-2">
      <div class="min-w-0"><div class="font-black text-[#1f4d3a] truncate"><i class="fa-solid fa-warehouse mr-1 text-amber-500"></i>Taller · {{ S.programaTaller.value ? S.nombreProg(S.programaTaller.value) : 'sin programa' }}</div>
        <div class="text-[11px] text-slate-500">{{ S.equiposEnNaves.value }} equipos en {{ S.NAVES.length }} naves (máx. {{ S.CAPACIDAD_NAVE }} por nave)</div></div>
      <button @click="S.recargarTaller()" class="px-3 py-2 rounded-xl bg-white shadow-sm text-xs font-bold text-slate-600"><i :class="['fa-solid', S.cargandoTaller.value ? 'fa-spinner fa-spin' : 'fa-arrows-rotate']"></i></button>
    </div>

    <template v-for="g in grupos" :key="g.key">
      <div v-if="g.cartas.length" class="lbl pt-2">{{ g.titulo }} ({{ g.cartas.length }})</div>
      <button v-for="c in g.cartas" :key="c.key" @click="abrir(c)" :class="['w-full bg-white rounded-2xl shadow-sm overflow-hidden text-left active:scale-[.99] transition flex', enNave(c) ? 'border-l-8 ' + S.colorNave(c.rep.nave).borde : '']">
        <img :src="S.fotoDe(c.afi)" class="w-24 object-cover bg-slate-200 shrink-0" alt="">
        <div class="p-3 flex-1 min-w-0 space-y-1">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0"><div class="font-black text-[#1f4d3a] leading-tight">AFI {{ c.afi }}</div><div class="text-[11px] text-slate-500 truncate">{{ S.descEquipo(c.afi) }}</div></div>
            <span :class="['text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap', enNave(c) ? S.colorNave(c.rep.nave).chip : S.ESTILO_ESTADO[estadoCarta(c)]]">{{ etiquetaCarta(c) }}</span>
          </div>
          <div class="flex flex-wrap gap-1 text-[10px] font-bold">
            <span v-for="o in (c.rep ? S.otsDeRep(c.rep) : [])" :key="o.id" class="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">OT {{ o.folio }} · {{ S.progresoRep(c.rep).pct }}%</span>
            <span v-if="c.rep && pendientes(c.rep)" class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{{ pendientes(c.rep) }} falla(s) esperando OT</span>
            <span v-else-if="enNave(c) && !S.tieneInspeccion(c.rep) && !S.otsDeRep(c.rep).length" class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Falta inspección</span>
            <span v-if="c.rep && conFecha(c.rep)" class="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800"><i class="fa-regular fa-calendar mr-0.5"></i>repuesto {{ formatDateForDisplay(conFecha(c.rep)) }}</span>
            <span v-if="c.item && !c.rep" class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{{ S.naveProgramada(c.item) }} · {{ formatDateForDisplay(c.item.fecha_inicio) }}</span>
          </div>
        </div>
      </button>
    </template>
    <div v-if="!grupos.some(g => g.cartas.length)" class="text-center text-slate-400 py-10">No hay equipos en el programa de reparación.</div>
  </template>
</div>`,
  setup() {
    const form = ref(S.hallazgoVacio());
    const editandoH = ref(null);   // hallazgo en edición (2026-11-17)
    const ocupado = ref(false);
    const inspAbierta = ref(false);

    /** Cartas: equipos en nave · por ingresar del programa · con faltantes / sin programa en espera. */
    const cartas = computed(() => {
      const out = [];
      const vistos = new Set();
      const add = (c) => { if (vistos.has(c.key)) return; vistos.add(c.key); out.push(c); };
      S.NAVES.forEach(n => S.repsEnNave(n).forEach(r => add({ key: 'r' + r.id, afi: r.afi, rep: r, item: S.itemDeRep(r), grupo: 'NAVE' })));
      S.candidatosPrograma().forEach(c => { const r = S.repDeItem(c.item); add({ key: r ? 'r' + r.id : 'i' + c.item.id, afi: c.item.afi, rep: r, item: c.item, grupo: 'PROGRAMA' }); });
      S.dbReparaciones.value.filter(r => [S.ESTADO_REP.ESPERA, S.ESTADO_REP.FALTANTES].includes(r.estado))
        .forEach(r => add({ key: 'r' + r.id, afi: r.afi, rep: r, item: S.itemDeRep(r), grupo: 'OTROS' }));
      return out;
    });
    const grupos = computed(() => [
      { key: 'NAVE', titulo: 'En las naves', cartas: cartas.value.filter(c => c.grupo === 'NAVE') },
      { key: 'PROGRAMA', titulo: 'Programa · por ingresar', cartas: cartas.value.filter(c => c.grupo === 'PROGRAMA') },
      { key: 'OTROS', titulo: 'En espera / con faltantes', cartas: cartas.value.filter(c => c.grupo === 'OTROS') }
    ]);
    /** La carta abierta, siempre con los datos recién cargados (refresco automático). */
    const sel = computed(() => {
      if (!selKey.value) return null;
      const c = cartas.value.find(x => x.key === selKey.value.key);
      if (c) return c;
      const r = selKey.value.repId != null ? S.repPorId(selKey.value.repId) : null;
      return r ? { key: 'r' + r.id, afi: r.afi, rep: r, item: S.itemDeRep(r) } : null;
    });
    const abrir = (c) => { inspAbierta.value = false; selKey.value = { key: c.key, repId: c.rep ? c.rep.id : null }; form.value = S.hallazgoVacio(); window.scrollTo(0, 0); };
    const cerrar = () => { selKey.value = null; };

    const enNave = (c) => Boolean(c.rep && c.rep.estado === S.ESTADO_REP.EN_NAVE);
    const estadoCarta = (c) => (c.rep ? c.rep.estado : 'PENDIENTE');
    const etiquetaCarta = (c) => (enNave(c) ? c.rep.nave : S.ETIQUETA_ESTADO[estadoCarta(c)] || estadoCarta(c));
    const pendientes = (rep) => S.problemasPendientesRep(rep).length;
    const conFecha = (rep) => S.problemasDeRep(rep).filter(h => h.fecha_aprox_repuesto && h.estado !== 'RECHAZADO').map(h => h.fecha_aprox_repuesto).sort().pop() || '';
    const prog = (ot) => {
      const acts = (ot.actividades || []).filter(a => String(a.descripcion || '').trim());
      const done = acts.filter(S.actividadHecha).length;
      return { done, total: acts.length, pct: acts.length ? Math.round(done / acts.length * 100) : 0 };
    };
    const abierta = (ot) => !['CERRADA', 'ANULADA'].includes(ot.estado);

    const ingresar = async (nave) => {
      const c = sel.value; if (!c || ocupado.value) return;
      if (!confirm(`¿Ingresar el AFI ${c.afi} a la ${nave}?`)) return;
      ocupado.value = true;
      try {
        const ok = await S.ingresarANave(nave, c.rep ? { rep: c.rep } : { item: c.item });
        if (ok) { const r = S.repsEnNave(nave).find(x => String(x.afi) === String(c.afi)); if (r) { selKey.value = { key: 'r' + r.id, repId: r.id }; if (!S.tieneInspeccion(r)) inspAbierta.value = true; } }
      } finally { ocupado.value = false; }
    };
    const enviar = async () => {
      const c = sel.value; if (!c || !c.rep) return;
      ocupado.value = true;
      try { if (await S.reportarHallazgo(c.rep, form.value)) { form.value = S.hallazgoVacio(); alert('Hallazgo enviado ✔ Operaciones lo revisa para la OT.'); } }
      finally { ocupado.value = false; }
    };
    const marcar = (ot, i) => S.alternarActividad(ot, i);
    const fechaHora = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };

    let timer = null;
    onMounted(() => {
      S.recargarTaller();
      timer = setInterval(() => { if (!document.hidden && !ocupado.value) S.refrescarTallerSiCambio(); }, REFRESCO_MS);   // solo recarga si algo cambió
    });
    onBeforeUnmount(() => clearInterval(timer));

    return { S, editandoH, inspAbierta, sel, grupos, abrir, cerrar, form, ocupado, enNave, estadoCarta, etiquetaCarta, pendientes, conFecha, prog, abierta, ingresar, enviar, marcar, fechaHora, formatDateForDisplay, hoyISO };
  }
};
