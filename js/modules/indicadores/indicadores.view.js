// =====================================================================
// INDICADORES (KPI) · Pantalla (2026-11-18)
//   Operaciones → Gestión operacional → Indicadores (KPI). Filtros por período, empresa y tipo de equipo;
//   gráficos (Chart.js) y exportación a Excel. Lógica en indicadores.service.js.
// =====================================================================
import * as K from './indicadores.service.js';
import TiemposActividad from './tiempos.view.js';   // tiempo promedio por actividad (2026-11-18)
import { formatDateForDisplay, hoyISO } from '../../core/utils.js';

const { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } = Vue;
const VERDE = '#2f8a4c', VERDE_C = '#9fd0ad', VERDE_O = '#1f4d3a', AMBAR = '#e3a21a', ROJO = '#c0392b', GRIS = '#cbd5e1', AZUL = '#3b82f6';
const fmt = (v, suf = '') => (v == null || Number.isNaN(v) ? '—' : `${Number(v).toLocaleString('es-CL')}${suf}`);
const fmtCLP = (v) => (v ? '$' + Math.round(v).toLocaleString('es-CL') : '—');

export default {
  name: 'IndicadoresView',
  components: { TiemposActividad },
  template: /* html */ `
<section class="space-y-5" data-kpi="vista">
  <!-- Encabezado y filtros -->
  <div class="bg-white rounded-2xl shadow-sm border p-4 flex flex-wrap items-end gap-3">
    <div class="mr-auto">
      <h2 class="text-xl font-black text-slate-800 flex items-center gap-2"><span class="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center"><i class="fa-solid fa-chart-pie"></i></span>Indicadores (KPI)</h2>
      <p class="text-xs text-slate-500 mt-1">{{ K.equiposF.value.length }} equipos · período {{ fecha(K.filtro.value.desde) }} al {{ fecha(K.filtro.value.hasta) }}</p>
    </div>
    <div class="flex gap-1">
      <button v-for="p in PERIODOS" :key="p.m" @click="periodo(p.m)" :class="['px-2.5 py-2 rounded-lg text-xs font-bold border', periodoSel === p.m ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 hover:bg-slate-50']">{{ p.t }}</button>
    </div>
    <label class="text-[10px] font-bold uppercase text-slate-500">Desde<input type="date" v-model="K.filtro.value.desde" @change="periodoSel = null" class="block mt-0.5 p-2 border rounded-lg text-sm"></label>
    <label class="text-[10px] font-bold uppercase text-slate-500">Hasta<input type="date" v-model="K.filtro.value.hasta" @change="periodoSel = null" class="block mt-0.5 p-2 border rounded-lg text-sm"></label>
    <label class="text-[10px] font-bold uppercase text-slate-500">Empresa<select v-model="K.filtro.value.empresa" class="block mt-0.5 p-2 border rounded-lg text-sm max-w-[180px]"><option value="">Todas</option><option v-for="e in K.empresas.value" :key="e">{{ e }}</option></select></label>
    <label class="text-[10px] font-bold uppercase text-slate-500">Tipo de equipo<select v-model="K.filtro.value.tipo" class="block mt-0.5 p-2 border rounded-lg text-sm max-w-[180px]"><option value="">Todos</option><option v-for="t in K.tiposEquipo.value" :key="t">{{ t }}</option></select></label>
    <button @click="K.cargarDatosKPI(true)" :disabled="K.cargandoKPI.value" class="px-3 py-2 rounded-lg border text-sm font-bold text-slate-600 hover:bg-slate-50" title="Volver a bajar taller, pedidos, check list y estandarizaciones"><i :class="['fa-solid fa-rotate', K.cargandoKPI.value ? 'fa-spin' : '']"></i></button>
    <button @click="K.exportarKPIExcel()" class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold" data-kpi="excel"><i class="fa-solid fa-file-excel mr-1"></i>Exportar Excel</button>
  </div>

  <!-- Tarjetas principales -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
    <div v-for="t in tarjetas" :key="t.k" class="bg-white rounded-2xl shadow-sm border p-4" :data-tile="t.k">
      <div class="flex items-center gap-2 text-[11px] font-bold uppercase text-slate-500"><span :class="['w-7 h-7 rounded-lg flex items-center justify-center', t.c]"><i :class="['fa-solid', t.i]"></i></span>{{ t.l }}</div>
      <div class="mt-2 text-3xl font-black text-slate-800 leading-none">{{ t.v }}<span class="text-base font-bold text-slate-400 ml-0.5">{{ t.u }}</span></div>
      <div class="mt-1 text-[11px] text-slate-500">{{ t.n }}</div>
    </div>
  </div>

  <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
    <!-- 1. Flota -->
    <div class="bg-white rounded-2xl shadow-sm border p-5 space-y-4">
      <h3 class="text-sm font-black uppercase text-slate-700 flex items-center gap-2"><i class="fa-solid fa-truck text-emerald-700"></i>Flota y disponibilidad</h3>
      <div class="grid sm:grid-cols-2 gap-4 items-center">
        <div class="h-56"><canvas ref="cFlota"></canvas></div>
        <table class="w-full text-xs"><thead class="text-[10px] uppercase text-slate-400"><tr><th class="text-left py-1">Tipo</th><th class="text-right">Eq.</th><th class="text-right">Disp. %</th><th class="text-right">Util. %</th></tr></thead>
          <tbody><tr v-for="t in K.flota.value.porTipo.slice(0, 8)" :key="t.tipo" class="border-t"><td class="py-1 font-semibold">{{ t.tipo }}</td><td class="text-right">{{ t.total }}</td><td class="text-right font-bold">{{ fmt(t.disp) }}</td><td class="text-right">{{ fmt(t.util) }}</td></tr></tbody></table>
      </div>
      <div>
        <p class="text-[11px] font-bold uppercase text-slate-500 mb-1">Disponibilidad histórica por mes</p>
        <div v-if="hayHist" class="h-48"><canvas ref="cDispHist"></canvas></div>
        <p v-else class="text-xs text-slate-500 bg-slate-50 rounded-lg p-3"><i class="fa-solid fa-circle-info mr-1"></i>{{ K.faltaHist.value ? 'Falta ejecutar sql/estado_historico.sql en Supabase.' : 'Se empieza a medir desde que se ejecutó el SQL del historial de estados (' + fecha(K.dispHistorica.value.desde) + '). Con el paso de los días aparecerá la curva.' }}</p>
      </div>
    </div>

    <!-- 2. Mantención -->
    <div class="bg-white rounded-2xl shadow-sm border p-5 space-y-4">
      <h3 class="text-sm font-black uppercase text-slate-700 flex items-center gap-2"><i class="fa-solid fa-oil-can text-emerald-700"></i>Mantención</h3>
      <div class="h-56"><canvas ref="cMant"></canvas></div>
      <div>
        <p class="text-[11px] font-bold uppercase text-slate-500 mb-1">Horas-hombre por mecánico · {{ fmt(K.mantencion.value.totalHH) }} h en el período</p>
        <div class="h-44"><canvas ref="cHH"></canvas></div>
      </div>
    </div>

    <!-- 3. Confiabilidad -->
    <div class="bg-white rounded-2xl shadow-sm border p-5 space-y-4">
      <h3 class="text-sm font-black uppercase text-slate-700 flex items-center gap-2"><i class="fa-solid fa-triangle-exclamation text-emerald-700"></i>Fallas y confiabilidad</h3>
      <div class="grid grid-cols-3 gap-3 text-center">
        <div class="bg-slate-50 rounded-xl p-3"><div class="text-2xl font-black">{{ fmt(K.confiabilidad.value.mtbf) }}<span class="text-sm text-slate-400"> h</span></div><div class="text-[11px] text-slate-500">MTBF · horas entre fallas</div></div>
        <div class="bg-slate-50 rounded-xl p-3"><div class="text-2xl font-black">{{ fmt(K.confiabilidad.value.mttrHoras) }}<span class="text-sm text-slate-400"> h</span></div><div class="text-[11px] text-slate-500">MTTR · horas por correctiva</div></div>
        <div class="bg-slate-50 rounded-xl p-3"><div class="text-2xl font-black">{{ fmt(K.confiabilidad.value.fallasPeriodo) }}</div><div class="text-[11px] text-slate-500">fallas en el período</div></div>
      </div>
      <div>
        <p class="text-[11px] font-bold uppercase text-slate-500 mb-1">Equipos que fallan más seguido (menor MTBF)</p>
        <div class="h-56"><canvas ref="cMtbf"></canvas></div>
      </div>
    </div>

    <!-- 3b. Tiempo promedio por actividad (por equipo y tipo de equipo) -->
    <tiempos-actividad></tiempos-actividad>

    <!-- 4. Taller y OT -->
    <div class="bg-white rounded-2xl shadow-sm border p-5 space-y-4">
      <h3 class="text-sm font-black uppercase text-slate-700 flex items-center gap-2"><i class="fa-solid fa-warehouse text-emerald-700"></i>Taller y OT</h3>
      <div class="grid grid-cols-3 gap-3 text-center">
        <div class="bg-slate-50 rounded-xl p-3"><div class="text-2xl font-black">{{ fmt(K.taller.value.diasProm) }}<span class="text-sm text-slate-400"> días</span></div><div class="text-[11px] text-slate-500">promedio en taller</div></div>
        <div class="bg-slate-50 rounded-xl p-3"><div class="text-2xl font-black">{{ fmt(K.taller.value.nSalidas) }}</div><div class="text-[11px] text-slate-500">salidas de nave</div></div>
        <div class="bg-slate-50 rounded-xl p-3"><div :class="['text-2xl font-black', (K.taller.value.pctFaltantes || 0) > 20 ? 'text-rose-600' : '']">{{ fmt(K.taller.value.pctFaltantes, '%') }}</div><div class="text-[11px] text-slate-500">salen con faltantes</div></div>
      </div>
      <div><p class="text-[11px] font-bold uppercase text-slate-500 mb-1">OT por mes y estado</p><div class="h-56"><canvas ref="cOT"></canvas></div></div>
    </div>

    <!-- 5. Repuestos y costos -->
    <div class="bg-white rounded-2xl shadow-sm border p-5 space-y-4">
      <h3 class="text-sm font-black uppercase text-slate-700 flex items-center gap-2"><i class="fa-solid fa-coins text-emerald-700"></i>Repuestos y costos</h3>
      <div class="grid sm:grid-cols-2 gap-4">
        <div><p class="text-[11px] font-bold uppercase text-slate-500 mb-1">Repuestos abiertos por antigüedad ({{ K.repuestos.value.abiertos }})</p><div class="h-44"><canvas ref="cRep"></canvas></div>
          <p class="text-xs text-slate-500 mt-1">Espera promedio pedido → recibido: <b>{{ fmt(K.repuestos.value.esperaProm) }} días</b> ({{ K.repuestos.value.nRecibidos }} recibidos)</p></div>
        <div><p class="text-[11px] font-bold uppercase text-slate-500 mb-1">Gasto OC y costo por hora · {{ fmtCLP(K.repuestos.value.costoTotal) }}</p>
          <table class="w-full text-xs"><thead class="text-[10px] uppercase text-slate-400"><tr><th class="text-left py-1">AFI</th><th class="text-right">Gasto OC</th><th class="text-right">Horas</th><th class="text-right">$/hora</th></tr></thead>
            <tbody><tr v-for="c in K.repuestos.value.costos.slice(0, 8)" :key="c.afi" class="border-t"><td class="py-1 font-semibold">{{ c.afi }} <span class="text-slate-400 font-normal">{{ c.tipo }}</span></td><td class="text-right">{{ fmtCLP(c.oc) }}</td><td class="text-right">{{ fmt(c.horas) }}</td><td class="text-right font-bold">{{ fmtCLP(c.porHora) }}</td></tr>
              <tr v-if="!K.repuestos.value.costos.length"><td colspan="4" class="text-slate-400 italic py-2">Sin OC en el período.</td></tr></tbody></table></div>
      </div>
    </div>

    <!-- 6. Logística -->
    <div class="bg-white rounded-2xl shadow-sm border p-5 space-y-4">
      <h3 class="text-sm font-black uppercase text-slate-700 flex items-center gap-2"><i class="fa-solid fa-route text-emerald-700"></i>Logística y choferes</h3>
      <div><p class="text-[11px] font-bold uppercase text-slate-500 mb-1">Movimientos por mes · {{ K.logistica.value.movimientos }} en el período</p><div class="h-48"><canvas ref="cMov"></canvas></div></div>
      <div class="grid sm:grid-cols-2 gap-4 text-xs">
        <div><p class="text-[11px] font-bold uppercase text-slate-500 mb-1">Camiones · {{ fmt(K.logistica.value.kmTotal) }} km</p>
          <table class="w-full"><tbody><tr v-for="c in K.logistica.value.camiones" :key="c.patente" class="border-t"><td class="py-1 font-bold">{{ c.patente }}</td><td class="text-right">{{ c.traslados }} trasl.</td><td class="text-right font-bold">{{ fmt(c.km) }} km</td></tr>
            <tr v-if="!K.logistica.value.camiones.length"><td class="text-slate-400 italic py-2">Sin check list en el período.</td></tr></tbody></table></div>
        <div><p class="text-[11px] font-bold uppercase text-slate-500 mb-1">Choferes · check list con Malo: {{ fmt(K.logistica.value.pctConMalo, '%') }}</p>
          <table class="w-full"><tbody><tr v-for="c in K.logistica.value.choferes" :key="c.nombre" class="border-t"><td class="py-1 font-bold">{{ c.nombre }}</td><td class="text-right">{{ c.checklists }} check list</td><td class="text-right font-bold">{{ c.traslados }} trasl.</td></tr></tbody></table></div>
      </div>
      <div v-if="K.logistica.value.porCliente.length"><p class="text-[11px] font-bold uppercase text-slate-500 mb-1">Movimientos por cliente</p><div class="h-44"><canvas ref="cClientes"></canvas></div></div>
    </div>

    <!-- 7. Estandarización -->
    <div class="bg-white rounded-2xl shadow-sm border p-5 space-y-4 xl:col-span-2">
      <h3 class="text-sm font-black uppercase text-slate-700 flex items-center gap-2"><i class="fa-solid fa-shield-halved text-emerald-700"></i>Seguridad y estándar</h3>
      <div class="grid md:grid-cols-3 gap-5">
        <div class="flex flex-col items-center justify-center">
          <div class="relative w-40 h-40"><canvas ref="cEst"></canvas><div class="absolute inset-0 flex flex-col items-center justify-center"><span class="text-3xl font-black">{{ fmt(K.estandar.value.promedio, '%') }}</span><span class="text-[10px] text-slate-500">flota estandarizada</span></div></div>
          <p class="text-xs text-slate-500 mt-2 text-center">{{ K.estandar.value.con }} con revisión · {{ K.estandar.value.sin }} sin revisión · {{ K.estandar.value.viejas }} con más de {{ K.DIAS_ESTANDAR }} días</p>
        </div>
        <div><p class="text-[11px] font-bold uppercase text-slate-500 mb-1">Ítems del estándar que más fallan</p><div class="h-52"><canvas ref="cEstItems"></canvas></div></div>
        <div><p class="text-[11px] font-bold uppercase text-slate-500 mb-1">Por estandarizar</p>
          <div class="max-h-52 overflow-y-auto divide-y text-xs"><div v-for="p in K.estandar.value.pendientes" :key="p.afi" class="flex justify-between py-1.5"><span><b>AFI {{ p.afi }}</b> <span class="text-slate-400">{{ p.tipo }}</span></span><span :class="p.ultima ? 'text-amber-700' : 'text-rose-600 font-bold'">{{ p.ultima ? fecha(p.ultima) : 'Nunca' }}</span></div>
            <p v-if="!K.estandar.value.pendientes.length" class="text-slate-400 italic py-2">Todo al día.</p></div></div>
      </div>
    </div>
  </div>
</section>`,
  setup() {
    const PERIODOS = [{ m: 0, t: 'Este mes' }, { m: 2, t: '3 meses' }, { m: 5, t: '6 meses' }, { m: 11, t: '12 meses' }];
    const periodoSel = ref(5);
    const periodo = (m) => { const d = new Date(hoyISO() + 'T12:00:00'); d.setMonth(d.getMonth() - m, 1); K.filtro.value.desde = d.toISOString().slice(0, 10); K.filtro.value.hasta = hoyISO(); periodoSel.value = m; };
    const fecha = (x) => (x ? formatDateForDisplay(x) : '—');
    const refs = { cFlota: ref(null), cDispHist: ref(null), cMant: ref(null), cHH: ref(null), cMtbf: ref(null), cOT: ref(null), cRep: ref(null), cMov: ref(null), cClientes: ref(null), cEst: ref(null), cEstItems: ref(null) };
    const hayHist = computed(() => K.dispHistorica.value.meses.some(m => m.disp != null && m.dias >= 1));

    const tarjetas = computed(() => [
      { k: 'disp', l: 'Disponibilidad', i: 'fa-circle-check', c: 'bg-emerald-100 text-emerald-700', v: fmt(K.flota.value.disponibilidad), u: '%', n: 'Operativos + disponibles hoy' },
      { k: 'util', l: 'Utilización', i: 'fa-person-digging', c: 'bg-sky-100 text-sky-700', v: fmt(K.flota.value.utilizacion), u: '%', n: `${K.flota.value.cuenta.Operativo || 0} de ${K.flota.value.total} trabajando` },
      { k: 'prev', l: 'Preventivo', i: 'fa-calendar-check', c: 'bg-emerald-100 text-emerald-700', v: fmt(K.mantencion.value.pctPrev), u: '%', n: `${K.mantencion.value.preventivas} de ${K.mantencion.value.total} intervenciones` },
      { k: 'mtbf', l: 'MTBF', i: 'fa-heart-pulse', c: 'bg-violet-100 text-violet-700', v: fmt(K.confiabilidad.value.mtbf), u: ' h', n: 'Horas promedio entre fallas' },
      { k: 'taller', l: 'Días en taller', i: 'fa-warehouse', c: 'bg-amber-100 text-amber-700', v: fmt(K.taller.value.diasProm), u: '', n: `${K.taller.value.nSalidas} salidas de nave` },
      { k: 'rep', l: 'Espera repuestos', i: 'fa-cart-flatbed', c: 'bg-orange-100 text-orange-700', v: fmt(K.repuestos.value.esperaProm), u: ' días', n: `${K.repuestos.value.abiertos} pedidos abiertos` },
      { k: 'mov', l: 'Movimientos', i: 'fa-truck-ramp-box', c: 'bg-sky-100 text-sky-700', v: fmt(K.logistica.value.movimientos), u: '', n: `${fmt(K.logistica.value.kmTotal)} km en camiones` },
      { k: 'est', l: 'Estandarización', i: 'fa-shield-halved', c: 'bg-emerald-100 text-emerald-700', v: fmt(K.estandar.value.promedio), u: '%', n: `${K.estandar.value.sin} equipos sin revisión` }
    ]);

    // ---------- gráficos ----------
    const charts = {};
    const base = (extra = {}) => ({ responsive: true, maintainAspectRatio: false, animation: { duration: 300 }, ...extra, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } }, ...(extra.plugins || {}) } });
    const ejes = (apilado = false, horizontal = false) => ({ scales: { x: { stacked: apilado, grid: { display: horizontal }, ticks: { font: { size: 11 }, precision: 0 }, beginAtZero: true }, y: { stacked: apilado, grid: { color: '#eef2f0', display: !horizontal }, ticks: { font: { size: 11 }, precision: 0 }, beginAtZero: true } } });
    const pintar = (k, config) => {
      const el = refs[k].value; if (!el || typeof Chart === 'undefined') return;
      if (charts[k]) { charts[k].data = config.data; charts[k].options = config.options; charts[k].update(); return; }
      charts[k] = new Chart(el, config);
    };
    const meses = () => K.mesesPeriodo.value.map(K.etiquetaMes);
    const dibujar = async () => {
      await nextTick();
      const f = K.flota.value, m = K.mantencion.value, c = K.confiabilidad.value, t = K.taller.value, r = K.repuestos.value, l = K.logistica.value, e = K.estandar.value;
      pintar('cFlota', { type: 'doughnut', data: { labels: K.ESTADOS_FLOTA, datasets: [{ data: K.ESTADOS_FLOTA.map(s => f.cuenta[s] || 0), backgroundColor: [VERDE, VERDE_C, AZUL, AMBAR, ROJO, GRIS], borderWidth: 2 }] }, options: base({ cutout: '62%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } } } }) });
      if (hayHist.value) pintar('cDispHist', { type: 'line', data: { labels: K.dispHistorica.value.meses.map(x => K.etiquetaMes(x.mes)), datasets: [{ label: 'Disponibilidad %', data: K.dispHistorica.value.meses.map(x => x.disp), borderColor: VERDE, backgroundColor: VERDE, tension: 0.3, spanGaps: true }, { label: 'Utilización %', data: K.dispHistorica.value.meses.map(x => x.util), borderColor: AZUL, backgroundColor: AZUL, tension: 0.3, spanGaps: true }] }, options: base({ scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } } }) });
      pintar('cMant', { type: 'bar', data: { labels: meses(), datasets: [
        { label: '250 HRS', data: m.porMes.map(x => x['250 HRS']), backgroundColor: VERDE_C }, { label: '500 HRS', data: m.porMes.map(x => x['500 HRS']), backgroundColor: VERDE },
        { label: '1000 HRS', data: m.porMes.map(x => x['1000 HRS']), backgroundColor: VERDE_O }, { label: 'Intermedia', data: m.porMes.map(x => x.INTERMEDIA), backgroundColor: '#c7e3cf' },
        { label: 'Correctivas', data: m.porMes.map(x => x.correctivas), backgroundColor: AMBAR }] }, options: base(ejes(true)) });
      const hh = m.hh.slice(0, 8);
      pintar('cHH', { type: 'bar', data: { labels: hh.map(x => x.mecanico), datasets: [{ label: 'Horas', data: hh.map(x => x.horas), backgroundColor: VERDE }] }, options: base({ indexAxis: 'y', ...ejes(false, true), plugins: { legend: { display: false } } }) });
      const pe = c.peores.slice(0, 8);
      pintar('cMtbf', { type: 'bar', data: { labels: pe.map(x => `AFI ${x.afi}`), datasets: [{ label: 'Horas entre fallas', data: pe.map(x => x.mtbf), backgroundColor: pe.map((x, i) => (i < 3 ? ROJO : GRIS)) }] }, options: base({ indexAxis: 'y', ...ejes(false, true), plugins: { legend: { display: false } } }) });
      pintar('cOT', { type: 'bar', data: { labels: meses(), datasets: [{ label: 'Abiertas', data: t.porMes.map(x => x.ABIERTA), backgroundColor: AMBAR }, { label: 'Cerradas', data: t.porMes.map(x => x.CERRADA), backgroundColor: VERDE }, { label: 'Anuladas', data: t.porMes.map(x => x.ANULADA), backgroundColor: GRIS }] }, options: base(ejes(true)) });
      pintar('cRep', { type: 'bar', data: { labels: r.tramos.map(x => x.t), datasets: [{ label: 'Pedidos', data: r.tramos.map(x => x.n), backgroundColor: [VERDE_C, AMBAR, '#e67e22', ROJO] }] }, options: base({ ...ejes(), plugins: { legend: { display: false } } }) });
      pintar('cMov', { type: 'bar', data: { labels: meses(), datasets: [{ label: 'Entregas', data: l.porMes.map(x => x.ENTREGA), backgroundColor: VERDE }, { label: 'Retiros', data: l.porMes.map(x => x.RETIRO), backgroundColor: AMBAR }, { label: 'Traslados', data: l.porMes.map(x => x.TRASLADO), backgroundColor: AZUL }] }, options: base(ejes(true)) });
      if (l.porCliente.length) pintar('cClientes', { type: 'bar', data: { labels: l.porCliente.map(x => x.cliente), datasets: [{ label: 'Movimientos', data: l.porCliente.map(x => x.n), backgroundColor: VERDE }] }, options: base({ indexAxis: 'y', ...ejes(false, true), plugins: { legend: { display: false } } }) });
      pintar('cEst', { type: 'doughnut', data: { labels: ['Cumple', 'Falta'], datasets: [{ data: [e.promedio || 0, 100 - (e.promedio || 0)], backgroundColor: [VERDE, '#e5ece7'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '78%', plugins: { legend: { display: false }, tooltip: { enabled: false } } } });
      pintar('cEstItems', { type: 'bar', data: { labels: e.itemsMalos.map(x => x.item.length > 34 ? x.item.slice(0, 33) + '…' : x.item), datasets: [{ label: 'Equipos', data: e.itemsMalos.map(x => x.n), backgroundColor: ROJO }] }, options: base({ indexAxis: 'y', ...ejes(false, true), plugins: { legend: { display: false } } }) });
    };
    watch([K.flota, K.mantencion, K.confiabilidad, K.taller, K.repuestos, K.logistica, K.estandar, K.dispHistorica], dibujar);
    onMounted(async () => { dibujar(); await K.cargarDatosKPI(); dibujar(); });
    onBeforeUnmount(() => Object.values(charts).forEach(ch => ch.destroy()));
    return { K, PERIODOS, periodoSel, periodo, fecha, tarjetas, hayHist, fmt, fmtCLP, ...refs };
  }
};
