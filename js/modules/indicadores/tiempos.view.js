// =====================================================================
// INDICADORES · TIEMPO PROMEDIO POR ACTIVIDAD (2026-11-18)
// Compara cuánto se demoran las actividades (inspeccionar, cambiar correa, reparar fuga…)
// en general, por TIPO de equipo y por EQUIPO. Usa el Historial con horas de inicio / término
// (incluye los reports de reparación de las OT Terreno, que entran al Historial al enviarlos).
// Respeta el periodo, tipo de equipo y empresa de los filtros de arriba.
// =====================================================================
import * as K from './indicadores.service.js';
import { dbEquipos, dbIntervenciones } from '../../core/store.js';
import { minutosTrabajo, fmtMin, detectarPiezas, detectarMotivo, piezaMotivoTexto } from '../../core/analisis-fallas.js';
import { claseMantencion } from '../../core/horometros.js';

const { ref, computed, watch } = Vue;
const up = (s) => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const cap = (s) => { const t = String(s || '').trim().toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };

/** Nombre de la actividad de un registro del Historial. modo: AUTO (pieza + motivo) | TEXTO (causa detallada tal cual). */
export const actividadDe = (r, modo = 'AUTO') => {
  if (modo === 'TEXTO') return cap(r.causaDetallada || r.causa || 'Sin detalle').replace(/\s+/g, ' ').slice(0, 80);
  const c = claseMantencion(r);
  if (c || /MANTENCION/.test(up(r.causa))) return 'Mantención' + (c === 'INTERMEDIA' ? ' intermedia' : r.tipoHorasMant ? ' ' + String(r.tipoHorasMant).toUpperCase() : '');
  if (/INSPECCION/.test(up(r.causa))) return 'Inspección';
  if (/LEVANTAMIENTO|OT DE FALLAS|OT TERRENO/.test(up(r.causaDetallada))) return 'OT Terreno (levantamiento)';
  if (detectarPiezas(r).length) {
    const t = piezaMotivoTexto(r);
    return detectarMotivo(r) === 'SIN_MOTIVO' ? t.split(' · ')[0] + ' · trabajo' : t;
  }
  return cap(r.causa || 'Otro') + ' · sin detalle';
};

export default {
  name: 'TiemposActividad',
  template: /* html */ `
<div class="bg-white rounded-2xl shadow-sm border p-5 space-y-4 xl:col-span-2" data-kpi="tiempos">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <h3 class="text-sm font-black uppercase text-slate-700 flex items-center gap-2"><i class="fa-solid fa-stopwatch text-emerald-700"></i>Tiempo promedio por actividad</h3>
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <select v-model="afi" class="p-2 border rounded-lg font-bold" data-kpi="t-afi"><option value="">Todos los equipos</option><option v-for="e in equipos" :key="e.afi" :value="e.afi">AFI {{ e.afi }} · {{ e.tipo }}</option></select>
      <select v-model="modo" class="p-2 border rounded-lg font-bold"><option value="AUTO">Agrupar: pieza + trabajo</option><option value="TEXTO">Agrupar: causa detallada exacta</option></select>
      <input v-model="buscar" placeholder="Buscar actividad (correa, fuga…)" class="p-2 border rounded-lg w-56">
      <label class="flex items-center gap-1 text-slate-600"><input type="checkbox" v-model="todoHist" class="accent-emerald-600" data-kpi="t-todo">Todo el Historial (sin periodo)</label>
      <label class="flex items-center gap-1 text-slate-600"><input type="checkbox" v-model="soloRepetidas" class="accent-emerald-600">Solo con 2+ registros</label>
    </div>
  </div>
  <p class="text-[11px] text-slate-500">Registros del Historial con hora de inicio y término {{ todoHist ? '(todo el Historial, sin importar fechas)' : 'dentro del periodo de arriba' }}, filtrados por tipo de equipo y empresa{{ K.filtro.value.tipo ? ' (tipo ' + K.filtro.value.tipo + ')' : '' }}. {{ base.length }} registros con tiempo · {{ grupos.length }} actividades. Haz clic en una actividad para compararla por equipo.</p>

  <div class="grid lg:grid-cols-5 gap-5">
    <div class="lg:col-span-3 overflow-x-auto max-h-[28rem] overflow-y-auto border rounded-xl">
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-800 text-white uppercase text-[10px] sticky top-0"><tr><th class="p-2">Actividad</th><th class="p-2 text-center">Veces</th><th class="p-2">Promedio</th><th class="p-2 text-center">Mín</th><th class="p-2 text-center">Máx</th><th class="p-2 text-center">Equipos</th></tr></thead>
        <tbody>
          <tr v-for="g in gruposVis" :key="g.nombre" @click="sel = sel === g.nombre ? '' : g.nombre" :class="['border-t cursor-pointer', sel === g.nombre ? 'bg-emerald-50' : 'hover:bg-slate-50']" :data-kpi="'t-act'">
            <td class="p-2 font-bold text-slate-800">{{ g.nombre }}</td>
            <td class="p-2 text-center">{{ g.n }}</td>
            <td class="p-2 w-44"><div class="flex items-center gap-2"><div class="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div class="h-full bg-emerald-500" :style="{ width: (100 * g.prom / maxProm) + '%' }"></div></div><b class="whitespace-nowrap font-mono">{{ fmtMin(g.prom) }}</b></div></td>
            <td class="p-2 text-center font-mono text-slate-500 whitespace-nowrap">{{ fmtMin(g.min) }}</td>
            <td class="p-2 text-center font-mono text-slate-500 whitespace-nowrap">{{ fmtMin(g.max) }}</td>
            <td class="p-2 text-center">{{ g.equipos }}</td>
          </tr>
          <tr v-if="!gruposVis.length"><td colspan="6" class="p-6 text-center text-slate-400">Sin registros con tiempo para estos filtros.</td></tr>
        </tbody>
      </table>
    </div>

    <div class="lg:col-span-2 space-y-2">
      <template v-if="detalle">
        <p class="text-[11px] font-bold uppercase text-slate-500">{{ detalle.nombre }} · por equipo</p>
        <p class="text-xs text-slate-600">Promedio general <b>{{ fmtMin(detalle.prom) }}</b> en {{ detalle.n }} registro(s).</p>
        <div v-for="e in detalle.porEquipo" :key="e.afi" class="text-xs">
          <div class="flex justify-between"><span><b>AFI {{ e.afi }}</b> <span class="text-slate-400">{{ e.tipo }}</span></span><span class="font-mono"><b>{{ fmtMin(e.prom) }}</b> · {{ e.n }} {{ e.n === 1 ? 'vez' : 'veces' }}</span></div>
          <div class="h-2 rounded-full bg-slate-100 overflow-hidden mt-0.5"><div :class="['h-full', e.prom > detalle.prom * 1.25 ? 'bg-rose-500' : e.prom < detalle.prom * 0.8 ? 'bg-emerald-500' : 'bg-amber-400']" :style="{ width: (100 * e.prom / detalle.maxEq) + '%' }"></div></div>
        </div>
        <p class="text-[11px] font-bold uppercase text-slate-500 pt-2">Por tipo de equipo</p>
        <div v-for="t in detalle.porTipo" :key="t.tipo" class="flex justify-between text-xs border-b py-1"><span>{{ t.tipo }}</span><span class="font-mono"><b>{{ fmtMin(t.prom) }}</b> · {{ t.n }}</span></div>
        <p class="text-[10px] text-slate-400 pt-1"><span class="text-emerald-600 font-bold">Verde</span>: 20% más rápido que el promedio · <span class="text-rose-600 font-bold">rojo</span>: 25% más lento.</p>
      </template>
      <div v-else class="h-full min-h-40 rounded-xl border-2 border-dashed flex items-center justify-center text-center text-slate-400 text-sm p-6">Elige una actividad de la tabla para ver cuánto se demora cada equipo y cada tipo de equipo.</div>
    </div>
  </div>
</div>`,
  setup() {
    const afi = ref(''), modo = ref('AUTO'), buscar = ref(''), sel = ref(''), soloRepetidas = ref(false), todoHist = ref(true);
    const eqDe = (a) => dbEquipos.value.find(e => up(e.afi) === up(a)) || null;
    const equipos = computed(() => K.equiposF.value.slice().sort((a, b) => String(a.afi).localeCompare(String(b.afi), undefined, { numeric: true })));
    /** Registros del Historial filtrados (periodo, tipo, empresa, AFI) con minutos de trabajo válidos. */
    const base = computed(() => {
      const afis = new Set(K.equiposF.value.map(e => up(e.afi)));
      return (todoHist.value ? dbIntervenciones.value : K.intervF.value)
        .filter(r => afis.has(up(r.afi)) && (!afi.value || up(r.afi) === up(afi.value)))
        .map(r => ({ r, min: minutosTrabajo(r), act: actividadDe(r, modo.value) }))
        .filter(x => x.min > 0);
    });
    const grupos = computed(() => {
      const m = new Map();
      base.value.forEach(x => { if (!m.has(x.act)) m.set(x.act, []); m.get(x.act).push(x); });
      return [...m.entries()].map(([nombre, l]) => {
        const mins = l.map(x => x.min);
        return { nombre, n: l.length, prom: Math.round(mins.reduce((s, v) => s + v, 0) / l.length), min: Math.min(...mins), max: Math.max(...mins), equipos: new Set(l.map(x => up(x.r.afi))).size, lista: l };
      }).sort((a, b) => b.n - a.n || b.prom - a.prom);
    });
    const gruposVis = computed(() => {
      const q = up(buscar.value);
      return grupos.value.filter(g => (!q || up(g.nombre).includes(q)) && (!soloRepetidas.value || g.n >= 2));
    });
    const maxProm = computed(() => Math.max(1, ...gruposVis.value.map(g => g.prom)));
    const detalle = computed(() => {
      const g = grupos.value.find(x => x.nombre === sel.value);
      if (!g) return null;
      const agrupar = (clave) => {
        const m = new Map();
        g.lista.forEach(x => { const k = clave(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x.min); });
        return [...m.entries()].map(([k, v]) => ({ k, n: v.length, prom: Math.round(v.reduce((s, y) => s + y, 0) / v.length) })).sort((a, b) => b.prom - a.prom);
      };
      const porEquipo = agrupar(x => up(x.r.afi)).map(e => ({ ...e, afi: e.k, tipo: (eqDe(e.k) || {}).tipo || '' }));
      const porTipo = agrupar(x => up((eqDe(x.r.afi) || {}).tipo || 'SIN TIPO')).map(t => ({ ...t, tipo: t.k }));
      return { nombre: g.nombre, n: g.n, prom: g.prom, porEquipo, porTipo, maxEq: Math.max(1, ...porEquipo.map(e => e.prom)) };
    });
    watch([modo, afi], () => { sel.value = ''; });
    return { K, todoHist, afi, modo, buscar, sel, soloRepetidas, equipos, base, grupos, gruposVis, maxProm, detalle, fmtMin };
  }
};

// ---------------------------------------------------------------------
// <tiempos-equipo :afi>: en el PERFIL DEL EQUIPO (todo su Historial, sin periodo).
// Cada actividad del equipo comparada con el promedio de su TIPO de equipo y con el GENERAL.
// ---------------------------------------------------------------------
export const TiemposEquipo = {
  name: 'TiemposEquipo',
  props: { afi: { type: [String, Number], required: true } },
  template: /* html */ `
<div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-2" data-perfil="tiempos">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <h4 class="font-bold text-slate-800 uppercase flex items-center gap-2"><i class="fa-solid fa-stopwatch text-emerald-600"></i> Tiempo promedio por actividad <span class="font-normal normal-case text-slate-400 text-xs">· todo el Historial, comparado con su tipo ({{ tipo || '—' }}) y con toda la flota</span></h4>
    <div class="flex items-center gap-2 text-xs">
      <select v-model="modo" class="p-1.5 border rounded-lg font-bold"><option value="AUTO">Pieza + trabajo</option><option value="TEXTO">Causa detallada exacta</option></select>
      <input v-model="buscar" placeholder="Buscar actividad…" class="p-1.5 border rounded-lg w-44">
    </div>
  </div>
  <div class="overflow-x-auto max-h-80 overflow-y-auto border rounded-lg">
    <table class="w-full text-left text-xs">
      <thead class="bg-slate-800 text-white uppercase text-[10px] sticky top-0"><tr><th class="p-2">Actividad</th><th class="p-2 text-center">Veces</th><th class="p-2">Este equipo</th><th class="p-2">Prom. {{ tipo ? tipo.toLowerCase() : 'tipo' }}</th><th class="p-2">Prom. general</th><th class="p-2 text-center">Comparado con su tipo</th></tr></thead>
      <tbody>
        <tr v-for="a in filas" :key="a.nombre" class="border-t">
          <td class="p-2 font-bold text-slate-800">{{ a.nombre }}</td>
          <td class="p-2 text-center">{{ a.n }}</td>
          <td class="p-2 font-mono font-black whitespace-nowrap">{{ fmtMin(a.prom) }}<span class="block text-[10px] font-normal text-slate-400">mín {{ fmtMin(a.min) }} · máx {{ fmtMin(a.max) }}</span></td>
          <td class="p-2 font-mono whitespace-nowrap">{{ a.tipo ? fmtMin(a.tipo.prom) : '—' }}<span v-if="a.tipo" class="block text-[10px] text-slate-400">{{ a.tipo.n }} reg. · {{ a.tipo.eq }} {{ a.tipo.eq === 1 ? 'equipo' : 'equipos' }}</span></td>
          <td class="p-2 font-mono whitespace-nowrap">{{ a.gen ? fmtMin(a.gen.prom) : '—' }}<span v-if="a.gen" class="block text-[10px] text-slate-400">{{ a.gen.n }} reg.</span></td>
          <td class="p-2 text-center"><span v-if="a.dif != null" :class="['px-2 py-0.5 rounded-full text-[10px] font-black whitespace-nowrap', a.dif > 25 ? 'bg-rose-100 text-rose-700' : a.dif < -20 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600']">{{ a.dif > 0 ? '+' : '' }}{{ a.dif }}% {{ a.dif > 25 ? 'más lento' : a.dif < -20 ? 'más rápido' : 'normal' }}</span><span v-else class="text-slate-300">—</span></td>
        </tr>
        <tr v-if="!filas.length"><td colspan="6" class="p-5 text-center text-slate-400">Este equipo no tiene registros con hora de inicio y término.</td></tr>
      </tbody>
    </table>
  </div>
  <p class="text-[10px] text-slate-400">Se cuentan los registros del Historial con horas de trabajo (hasta 16 h). El tiempo del equipo se compara con el promedio de los equipos del mismo tipo.</p>
</div>`,
  setup(props) {
    const modo = ref('AUTO'), buscar = ref('');
    const tipoDe = (a) => up((dbEquipos.value.find(e => up(e.afi) === up(a)) || {}).tipo || '');
    const tipo = computed(() => tipoDe(props.afi));
    /** Todo el Historial con minutos válidos, agrupado por actividad. */
    const todos = computed(() => dbIntervenciones.value.map(r => ({ r, min: minutosTrabajo(r) })).filter(x => x.min > 0).map(x => ({ ...x, act: actividadDe(x.r, modo.value), afi: up(x.r.afi) })));
    const resumen = (l) => (l.length ? { n: l.length, prom: Math.round(l.reduce((s, x) => s + x.min, 0) / l.length), eq: new Set(l.map(x => x.afi)).size } : null);
    const filas = computed(() => {
      const yo = up(props.afi), q = up(buscar.value);
      const porAct = new Map();
      todos.value.forEach(x => { if (!porAct.has(x.act)) porAct.set(x.act, []); porAct.get(x.act).push(x); });
      return [...porAct.entries()].map(([nombre, l]) => {
        const mios = l.filter(x => x.afi === yo);
        if (!mios.length) return null;
        const mins = mios.map(x => x.min);
        const t = resumen(l.filter(x => x.afi !== yo && tipoDe(x.afi) === tipo.value));
        const g = resumen(l);
        const prom = Math.round(mins.reduce((s, v) => s + v, 0) / mins.length);
        return { nombre, n: mios.length, prom, min: Math.min(...mins), max: Math.max(...mins), tipo: t, gen: g, dif: t ? Math.round((prom - t.prom) / t.prom * 100) : null };
      }).filter(Boolean).filter(a => !q || up(a.nombre).includes(q)).sort((a, b) => b.n - a.n || b.prom - a.prom);
    });
    return { modo, buscar, tipo, filas, fmtMin };
  }
};
