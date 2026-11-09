// Plantilla del módulo ANÁLISIS DE FALLAS (Operaciones → Mantenimiento)
export default /* html */ `
<section class="space-y-4 text-xs">

  <!-- Encabezado + filtros -->
  <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-extrabold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-magnifying-glass-chart text-rose-500"></i> Análisis de Fallas</h2>
        <p class="text-slate-500">Lee <b>causa</b>, <b>causa detallada</b>, <b>descripción</b> y <b>horas</b> del Historial y agrupa por sistema: qué falla más, qué se repite y en qué equipos.</p>
      </div>
      <button @click="exportarFallasExcel" :disabled="exportandoFallas || !a.total" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl shadow flex items-center gap-2 disabled:opacity-60"><i :class="['fa-solid', exportandoFallas ? 'fa-spinner fa-spin' : 'fa-file-excel']"></i> Exportar Excel</button>
    </div>
    <div class="flex flex-wrap items-end gap-2">
      <div><label class="block text-[10px] font-bold text-slate-500">Período</label>
        <select v-model="filtroFallas.periodo" class="p-2 border rounded-lg font-bold">
          <option value="90">Últimos 3 meses</option><option value="180">Últimos 6 meses</option><option value="365">Último año</option><option value="ALL">Todo</option><option value="CUSTOM">Rango…</option>
        </select></div>
      <template v-if="filtroFallas.periodo === 'CUSTOM'">
        <div><label class="block text-[10px] font-bold text-slate-500">Desde</label><input v-model="filtroFallas.desde" type="date" class="p-2 border rounded-lg"></div>
        <div><label class="block text-[10px] font-bold text-slate-500">Hasta</label><input v-model="filtroFallas.hasta" type="date" class="p-2 border rounded-lg"></div>
      </template>
      <div><label class="block text-[10px] font-bold text-slate-500">Tipo de equipo</label>
        <select v-model="filtroFallas.tipo" class="p-2 border rounded-lg font-bold"><option value="ALL">Todos</option><option v-for="t in tiposEquipo" :key="t" :value="t">{{ t }}</option></select></div>
      <div><label class="block text-[10px] font-bold text-slate-500">Sistema</label>
        <select v-model="filtroFallas.categoria" class="p-2 border rounded-lg font-bold"><option value="ALL">Todos</option><option v-for="c in CATEGORIAS" :key="c.key" :value="c.key">{{ c.label }}</option></select></div>
      <div><label class="block text-[10px] font-bold text-slate-500">Pieza</label>
        <select v-model="filtroFallas.pieza" class="p-2 border rounded-lg font-bold"><option value="ALL">Todas</option><option v-for="p in PIEZAS_LISTA" :key="p.key" :value="p.key">{{ p.label }}</option></select></div>
      <div><label class="block text-[10px] font-bold text-slate-500">Motivo</label>
        <select v-model="filtroFallas.motivo" class="p-2 border rounded-lg font-bold"><option value="ALL">Todos</option><option v-for="m in MOTIVOS_LISTA" :key="m.key" :value="m.key">{{ m.label }}</option></select></div>
      <div><label class="block text-[10px] font-bold text-slate-500">AFI</label><input v-model="filtroFallas.afi" type="text" placeholder="Ej: 510" class="p-2 border rounded-lg w-24 font-mono font-bold"></div>
      <label class="flex items-center gap-1.5 pb-2 font-semibold"><input type="checkbox" v-model="filtroFallas.incluirMant"> Incluir mantenciones</label>
      <button @click="limpiarFiltroFallas" class="text-slate-500 hover:text-slate-800 underline pb-2">Limpiar</button>
    </div>
  </div>

  <!-- KPI -->
  <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
    <div class="rounded-xl border p-3 bg-white"><p class="text-[10px] font-bold text-slate-500 uppercase">Intervenciones</p><p class="text-2xl font-extrabold text-slate-800">{{ a.total }}</p><p class="text-[10px] text-slate-400">{{ filtroFallas.incluirMant ? 'incluye mantenciones' : 'sin mantenciones' }}</p></div>
    <div class="rounded-xl border p-3 bg-white"><p class="text-[10px] font-bold text-slate-500 uppercase">Equipos afectados</p><p class="text-2xl font-extrabold text-slate-800">{{ a.equiposAfectados }}</p></div>
    <div class="rounded-xl border p-3 bg-rose-50 border-rose-200 text-rose-900"><p class="text-[10px] font-bold uppercase">Sistema que más falla</p><p class="text-base font-extrabold truncate">{{ sistemaTop ? sistemaTop.label : '-' }}</p><p class="text-[10px]">{{ sistemaTop ? sistemaTop.pct + '% · ' + sistemaTop.n + ' veces' : '' }}</p></div>
    <div class="rounded-xl border p-3 bg-amber-50 border-amber-200 text-amber-900"><p class="text-[10px] font-bold uppercase">Repetidas &lt; 30 días</p><p class="text-2xl font-extrabold">{{ a.repetidas }}</p></div>
    <div class="rounded-xl border p-3 bg-sky-50 border-sky-200 text-sky-900"><p class="text-[10px] font-bold uppercase">Horas de trabajo</p><p class="text-xl font-extrabold">{{ fmtMin(a.minTotal) }}</p><p class="text-[10px]">promedio {{ fmtMin(a.minPromedio) }} · {{ a.conHoras }} con horas</p></div>
    <div class="rounded-xl border p-3 bg-emerald-50 border-emerald-200 text-emerald-900"><p class="text-[10px] font-bold uppercase">Costo registrado</p><p class="text-xl font-extrabold">\${{ Math.round(a.costoTotal).toLocaleString('es-CL') }}</p></div>
  </div>

  <!-- Hallazgos -->
  <div class="bg-white rounded-2xl border shadow-sm p-4 space-y-2">
    <h3 class="font-extrabold text-slate-800 uppercase"><i class="fa-solid fa-wand-magic-sparkles text-violet-500 mr-1"></i> Hallazgos</h3>
    <div class="grid md:grid-cols-2 gap-2">
      <div v-for="(h, i) in a.hallazgos" :key="i" :class="['rounded-lg border p-2.5 flex gap-2 items-start', claseNivel(h.nivel)]">
        <i :class="['fa-solid mt-0.5', h.icon || 'fa-circle-info']"></i><span v-html="htmlHallazgo(h.texto)"></span>
      </div>
    </div>
  </div>

  <!-- Gráficos -->
  <div class="grid lg:grid-cols-2 gap-4">
    <div class="bg-white rounded-2xl border shadow-sm p-4">
      <h3 class="font-extrabold text-slate-800 uppercase mb-2"><i class="fa-solid fa-chart-bar text-rose-500 mr-1"></i> Fallas por sistema</h3>
      <div class="h-72 relative"><canvas ref="cvCategorias"></canvas></div>
    </div>
    <div class="bg-white rounded-2xl border shadow-sm p-4">
      <h3 class="font-extrabold text-slate-800 uppercase mb-2"><i class="fa-solid fa-chart-line text-blue-500 mr-1"></i> Evolución mensual (5 sistemas principales)</h3>
      <div class="h-72 relative"><canvas ref="cvMeses"></canvas></div>
    </div>
  </div>

  <!-- Piezas y motivos -->
  <div class="grid lg:grid-cols-3 gap-4">
    <div class="bg-white rounded-2xl border shadow-sm overflow-hidden lg:col-span-2">
      <h3 class="font-extrabold text-slate-800 uppercase px-4 py-3 border-b"><i class="fa-solid fa-gear text-slate-600 mr-1"></i> Piezas que más fallan y por qué <span class="font-normal normal-case text-slate-400">· {{ a.conPieza }} de {{ a.total }} registros indican la pieza · clic para filtrar</span></h3>
      <div class="max-h-96 overflow-y-auto">
        <table class="w-full text-left">
          <thead class="bg-slate-50 text-slate-500 sticky top-0"><tr><th class="p-2">Pieza</th><th class="p-2 text-center">Veces</th><th class="p-2">Por qué falló</th><th class="p-2">Equipos</th></tr></thead>
          <tbody>
            <tr v-for="p in a.piezas" :key="p.key" @click="filtroFallas.pieza = p.key" class="border-t hover:bg-slate-50 cursor-pointer align-top">
              <td class="p-2"><b>{{ p.label }}</b><span class="block text-[10px]" :style="{ color: p.cat.color === '#facc15' || p.cat.color === '#eab308' ? '#a16207' : p.cat.color }">{{ p.cat.label }}</span></td>
              <td class="p-2 text-center"><span class="font-extrabold px-2 py-0.5 rounded-full bg-slate-200">{{ p.n }}</span></td>
              <td class="p-2"><span v-for="m in p.motivos" :key="m.key" :class="['inline-block mr-1 mb-0.5 text-[10px] px-1.5 rounded', m.key === 'SIN_MOTIVO' ? 'bg-slate-100 text-slate-400' : 'bg-rose-50 text-rose-700 font-semibold']">{{ m.label }} · {{ m.n }}</span></td>
              <td class="p-2"><button v-for="x in p.equipos.slice(0, 6)" :key="x" @click.stop="verDetallePorAfiString(x)" class="mr-1 font-mono font-bold text-amber-700 hover:underline">{{ x }}</button><span v-if="p.equipos.length > 6" class="text-slate-400">+{{ p.equipos.length - 6 }}</span></td>
            </tr>
            <tr v-if="!a.piezas.length"><td colspan="4" class="p-6 text-center text-slate-400">No se detectan piezas en la causa detallada / descripción.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="bg-white rounded-2xl border shadow-sm p-4">
      <h3 class="font-extrabold text-slate-800 uppercase mb-3"><i class="fa-solid fa-circle-question text-rose-500 mr-1"></i> Motivos de falla</h3>
      <div v-for="m in a.motivos" :key="m.key" @click="filtroFallas.motivo = m.key" class="mb-2 cursor-pointer" title="Filtrar por este motivo">
        <div class="flex justify-between font-semibold"><span :class="m.key === 'SIN_MOTIVO' ? 'text-slate-400' : ''">{{ m.label }}</span><span>{{ m.n }} · {{ m.pct }}%</span></div>
        <div class="h-2 bg-slate-100 rounded-full overflow-hidden"><div :class="['h-full rounded-full', m.key === 'SIN_MOTIVO' ? 'bg-slate-300' : 'bg-rose-500']" :style="{ width: m.pct + '%' }"></div></div>
      </div>
    </div>
  </div>

  <div class="grid lg:grid-cols-3 gap-4">
    <!-- Problemas repetidos -->
    <div class="bg-white rounded-2xl border shadow-sm overflow-hidden lg:col-span-2">
      <h3 class="font-extrabold text-slate-800 uppercase px-4 py-3 border-b"><i class="fa-solid fa-repeat text-amber-500 mr-1"></i> Problemas que más se repiten</h3>
      <div class="max-h-80 overflow-y-auto">
        <table class="w-full text-left">
          <thead class="bg-slate-50 text-slate-500 sticky top-0"><tr><th class="p-2">Problema (causa detallada)</th><th class="p-2 text-center">Veces</th><th class="p-2">Equipos</th></tr></thead>
          <tbody>
            <tr v-for="p in a.problemas" :key="p.problema" class="border-t">
              <td class="p-2 font-semibold capitalize">{{ p.problema.toLowerCase() }}</td>
              <td class="p-2 text-center"><span class="font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{{ p.n }}</span></td>
              <td class="p-2"><button v-for="x in p.equipos.slice(0, 8)" :key="x" @click="verDetallePorAfiString(x)" class="mr-1 mb-0.5 font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 hover:underline">{{ x }}</button><span v-if="p.equipos.length > 8" class="text-slate-400">+{{ p.equipos.length - 8 }}</span></td>
            </tr>
            <tr v-if="!a.problemas.length"><td colspan="3" class="p-6 text-center text-slate-400">No hay problemas repetidos con este filtro.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <!-- Palabras más usadas -->
    <div class="bg-white rounded-2xl border shadow-sm p-4">
      <h3 class="font-extrabold text-slate-800 uppercase mb-1"><i class="fa-solid fa-triangle-exclamation text-rose-500 mr-1"></i> Señales de alerta</h3>
      <p class="text-[10px] text-slate-400 mb-2">Palabras de peligro encontradas en las fallas (no cuenta inspecciones ni revisiones).</p>
      <div class="flex flex-wrap gap-1.5">
        <span v-for="([w, n], i) in a.palabras" :key="w" :style="{ fontSize: (10 + Math.round(8 * n / (a.palabras[0]?.[1] || 1))) + 'px' }" class="px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-800 font-semibold" :title="n + ' veces'">{{ w }} <b>{{ n }}</b></span>
        <span v-if="!a.palabras.length" class="text-slate-400">Sin datos.</span>
      </div>
    </div>
  </div>

  <!-- Por tipo de equipo -->
  <div class="bg-white rounded-2xl border shadow-sm overflow-hidden">
    <h3 class="font-extrabold text-slate-800 uppercase px-4 py-3 border-b"><i class="fa-solid fa-layer-group text-indigo-500 mr-1"></i> Por tipo de equipo</h3>
    <div class="overflow-x-auto">
      <table class="w-full text-left">
        <thead class="bg-slate-50 text-slate-500"><tr><th class="p-2">Tipo</th><th class="p-2 text-center">Intervenciones</th><th class="p-2 text-center">Equipos</th><th class="p-2 text-center">Por equipo</th><th class="p-2">Lo que más falla</th></tr></thead>
        <tbody>
          <tr v-for="t in a.tipos" :key="t.tipo" class="border-t hover:bg-slate-50 cursor-pointer" @click="filtroFallas.tipo = t.tipo" title="Filtrar por este tipo">
            <td class="p-2 font-bold">{{ t.tipo }}</td><td class="p-2 text-center">{{ t.n }}</td><td class="p-2 text-center">{{ t.equipos }}</td>
            <td class="p-2 text-center font-extrabold">{{ t.porEquipo }}</td>
            <td class="p-2"><span class="inline-block w-2.5 h-2.5 rounded-full mr-1" :style="{ background: t.catTop.color }"></span>{{ t.catTop.label }} <span class="text-slate-400">({{ t.catTopPct }}%)</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Ranking de equipos -->
  <div class="bg-white rounded-2xl border shadow-sm overflow-hidden">
    <h3 class="font-extrabold text-slate-800 uppercase px-4 py-3 border-b"><i class="fa-solid fa-ranking-star text-rose-500 mr-1"></i> Equipos con más fallas <span class="font-normal normal-case text-slate-400">· clic en la fila para ver sus registros</span></h3>
    <div class="max-h-[520px] overflow-y-auto">
      <table class="w-full text-left">
        <thead class="bg-slate-50 text-slate-500 sticky top-0 z-10"><tr>
          <th class="p-2">#</th><th class="p-2">AFI</th><th class="p-2">Equipo</th><th class="p-2 text-center">Fallas</th><th class="p-2">Lo que más falla</th><th class="p-2">Problema más repetido</th>
          <th class="p-2 text-center" title="Mismo sistema en menos de 30 días">Repetidas</th><th class="p-2 text-center" title="Días promedio entre fallas">Cada</th><th class="p-2 text-center">Horas</th><th class="p-2">Última</th>
        </tr></thead>
        <tbody>
          <template v-for="(e, k) in a.equiposRank.slice(0, limiteRank)" :key="e.afi">
            <tr @click="verRegistrosDe(e.afi)" :class="['border-t cursor-pointer', afiDetalle === e.afi ? 'bg-amber-50' : 'hover:bg-slate-50']">
              <td class="p-2 text-slate-400">{{ k + 1 }}</td>
              <td class="p-2"><button @click.stop="verDetallePorAfiString(e.afi)" class="font-mono font-extrabold text-amber-700 hover:underline">{{ e.afi }}</button></td>
              <td class="p-2"><span class="font-semibold">{{ e.tipo }}</span> <span class="text-slate-400">{{ e.marca }} {{ e.modelo }}</span></td>
              <td class="p-2 text-center"><span class="font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">{{ e.n }}</span></td>
              <td class="p-2"><template v-if="e.catTop"><span class="inline-block w-2.5 h-2.5 rounded-full mr-1" :style="{ background: e.catTop.color }"></span>{{ e.catTop.label }} <span class="text-slate-400">{{ e.catTop.pct }}%</span></template></td>
              <td class="p-2 max-w-[260px] truncate capitalize" :title="e.probTop?.problema">{{ e.probTop ? e.probTop.problema.toLowerCase() + (e.probTop.n > 1 ? ' (' + e.probTop.n + ')' : '') : '-' }}</td>
              <td class="p-2 text-center"><span v-if="e.repetidas" class="font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">{{ e.repetidas }}</span><span v-else class="text-slate-300">0</span></td>
              <td class="p-2 text-center">{{ e.mtbf !== null ? e.mtbf + ' d' : '-' }}</td>
              <td class="p-2 text-center">{{ e.min ? fmtMin(e.min) : '-' }}</td>
              <td class="p-2 font-mono">{{ formatDateForDisplay(e.ultima) }}</td>
            </tr>
            <tr v-if="afiDetalle === e.afi">
              <td colspan="10" class="bg-amber-50/60 p-3">
                <div class="flex flex-wrap gap-2 mb-2">
                  <span v-for="c in e.cats" :key="c.key" class="px-2 py-0.5 rounded-full bg-white border font-semibold"><span class="inline-block w-2 h-2 rounded-full mr-1" :style="{ background: c.color }"></span>{{ c.label }} · {{ c.n }}</span>
                  <button @click="irAlHistorial(e.afi)" class="ml-auto text-blue-700 underline font-bold">Ver en Historial →</button>
                </div>
                <div class="space-y-1 max-h-60 overflow-y-auto">
                  <div v-for="x in registrosDeAfi(e.afi)" :key="x.r.id" class="bg-white border rounded-lg px-2 py-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span class="font-mono font-bold">{{ formatDateForDisplay(x.fecha) }}</span>
                    <span class="font-bold" :style="{ color: x.cat.color === '#facc15' || x.cat.color === '#eab308' ? '#a16207' : x.cat.color }">{{ x.cat.label }}</span>
                    <span class="text-slate-500">{{ x.r.causa }}</span>
                    <span class="flex-1 min-w-[200px]">{{ x.r.causaDetallada }}<span v-if="x.r.descripcion" class="text-slate-400"> — {{ x.r.descripcion }}</span>
                      <span v-if="x.piezas.length || x.motivo !== 'SIN_MOTIVO'" class="block text-[10px] mt-0.5"><span v-for="k in x.piezas" :key="k" class="mr-1 px-1.5 rounded bg-slate-200 text-slate-700 font-bold">{{ piezaPorKey(k)?.label }}</span><span v-if="x.motivo !== 'SIN_MOTIVO'" class="px-1.5 rounded bg-rose-50 text-rose-700 font-semibold">{{ motivoPorKey(x.motivo).label }}</span></span></span>
                    <span v-if="x.min" class="text-sky-700 font-semibold">{{ fmtMin(x.min) }}</span>
                  </div>
                </div>
              </td>
            </tr>
          </template>
          <tr v-if="!a.equiposRank.length"><td colspan="10" class="p-6 text-center text-slate-400">Sin datos.</td></tr>
        </tbody>
      </table>
      <div v-if="a.equiposRank.length > limiteRank" class="p-2 text-center border-t"><button @click="limiteRank += 30" class="text-blue-700 font-bold underline">Ver más ({{ a.equiposRank.length - limiteRank }})</button></div>
    </div>
  </div>
  <p class="text-[10px] text-slate-400 text-center">La clasificación es automática por palabras clave. Mientras más clara sea la <b>causa detallada</b> (sistema + pieza), mejor el análisis.</p>
</section>
`;
