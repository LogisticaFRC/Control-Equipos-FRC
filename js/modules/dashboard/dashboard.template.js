// Plantilla HTML del componente 'dashboard' (extraída del index original)
export default /* html */ `
<section class="space-y-6">
  <!-- WIDGET DE ALERTAS DE MANTENCIÓN (EQUIPOS PASADOS Y PRÓXIMOS) -->
  <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
      <h3 class="text-xs font-bold uppercase text-slate-800 flex items-center gap-2">
        <i class="fa-solid fa-triangle-exclamation text-rose-600"></i> Alertas de Mantenimiento (Por Horas y Anual)
      </h3>
      <span class="text-[10px] font-mono bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full font-bold border border-rose-200">
        {{ equiposCriticosDashboard.length }} equipos requiriendo atención
      </span>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
      <div v-for="eq in equiposCriticosDashboard" :key="eq.id" :class="['p-3.5 rounded-xl border flex items-center justify-between gap-3 shadow-sm', esAlertaRoja(eq.horometros) ? 'bg-rose-50 border-rose-300' : 'bg-amber-50 border-amber-300']">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border shadow-sm text-amber-800">AFI {{ eq.afi }}</span>
            <span v-if="eq.horometros?.estadoTexto !== 'AL DÍA'" :class="['text-[9px] font-extrabold uppercase px-2 py-0.5 rounded', eq.horometros?.horasFaltantes <= 0 ? 'bg-rose-600 text-white animate-pulse' : 'bg-amber-500 text-white']">
              {{ eq.horometros?.estadoTexto || 'PRÓXIMO' }}
            </span>
            <span v-if="tieneAlertaAnual(eq.horometros)" :class="['text-[9px] font-extrabold uppercase px-2 py-0.5 rounded', getAnualStatusBadge(eq.horometros)]">
              <i class="fa-solid fa-calendar-xmark"></i> {{ eq.horometros?.estadoAnual }}
            </span>
          </div>
          <h4 class="font-bold text-xs text-slate-800">{{ eq.tipo }} - {{ eq.marca }}</h4>
          <p class="text-[10px] text-slate-600">Ubicación: <strong class="text-emerald-700">{{ eq.ubicacion }}</strong></p>
          <p class="text-[10px] font-mono text-slate-700">Horómetro Aprox: <strong>{{ eq.horometros?.hAprox }}h</strong> | Meta: <strong>{{ eq.horometros?.hTarget }}h</strong></p>
          <p v-if="tieneAlertaAnual(eq.horometros)" class="text-[10px] font-mono text-slate-700">Últ. mant: <strong>{{ formatDateForDisplay(eq.horometros?.fechaBaseAnual) }}</strong> | Anual: <strong>{{ formatDateForDisplay(eq.horometros?.fechaVencAnual) }}</strong> ({{ getAnualTextoDias(eq.horometros) }})</p>
        </div>
        <button @click="abrirPerfilEquipo(eq)" class="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg text-xs font-bold shadow transition flex items-center justify-center shrink-0" title="Ver Perfil">
          <i class="fa-solid fa-id-card"></i>
        </button>
      </div>
      <div v-if="equiposCriticosDashboard.length === 0" class="col-span-full text-center py-6 text-slate-400 text-xs font-bold">
        ¡Excelente! No hay equipos pasados ni próximos a mantención en este momento. Todos están al día.
      </div>
    </div>
  </div>
  
  <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-3">
    <div>
      <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-chart-pie text-emerald-600"></i> Dashboard de Control de Equipos y Estado Operativo</h2>
      <p class="text-xs text-slate-500">Haz clic en cualquiera de los bloques para filtrar los equipos en el inventario.</p>
    </div>
    <div class="flex items-center gap-2">
      <button @click="renderCharts" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition flex items-center gap-1.5 shadow"><i class="fa-solid fa-rotate-right"></i> Recargar Gráficos</button>
      <button @click="exportarCSV(resumenKPIs, 'Resumen_KPIs_AFI')" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition flex items-center gap-1.5 shadow"><i class="fa-solid fa-file-excel"></i> Exportar KPIs (CSV)</button>
    </div>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
    <div @click="filtrarYIrAInventario('ALL')" class="bg-white p-3.5 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between cursor-pointer hover:border-slate-400 transition">
      <div><p class="text-[10px] text-slate-500 font-bold uppercase">Total Flota</p><h3 class="text-xl font-bold text-slate-800">{{ dbEquipos.length }}</h3></div>
      <div class="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm"><i class="fa-solid fa-truck-monster"></i></div>
    </div>
    <div @click="filtrarYIrAInventario('Operativo')" class="bg-white p-3.5 rounded-xl shadow-sm border border-emerald-200 flex items-center justify-between cursor-pointer hover:border-emerald-500 transition">
      <div><p class="text-[10px] text-slate-500 font-bold uppercase">Trabajando</p><h3 class="text-xl font-bold text-emerald-600">{{ countEstado('Operativo') }}</h3></div>
      <div class="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm"><i class="fa-solid fa-circle-check"></i></div>
    </div>
    <div @click="filtrarYIrAInventario('Disponible')" class="bg-white p-3.5 rounded-xl shadow-sm border border-sky-200 flex items-center justify-between cursor-pointer hover:border-sky-500 transition">
      <div><p class="text-[10px] text-slate-500 font-bold uppercase">Disponible</p><h3 class="text-xl font-bold text-sky-600">{{ countEstado('Disponible') }}</h3></div>
      <div class="w-8 h-8 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center text-sm"><i class="fa-solid fa-warehouse"></i></div>
    </div>
    <div @click="filtrarYIrAInventario('En Traslado')" class="bg-white p-3.5 rounded-xl shadow-sm border border-amber-200 flex items-center justify-between cursor-pointer hover:border-amber-500 transition">
      <div><p class="text-[10px] text-slate-500 font-bold uppercase">En Traslado</p><h3 class="text-xl font-bold text-amber-600">{{ countEstado('En Traslado') }}</h3></div>
      <div class="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-sm"><i class="fa-solid fa-truck-moving"></i></div>
    </div>
    <div @click="filtrarYIrAInventario('En Mantencion')" class="bg-white p-3.5 rounded-xl shadow-sm border border-rose-200 flex items-center justify-between cursor-pointer hover:border-rose-500 transition">
      <div><p class="text-[10px] text-slate-500 font-bold uppercase">En Mantención</p><h3 class="text-xl font-bold text-rose-600">{{ countEstado('En Mantencion') }}</h3></div>
      <div class="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-sm"><i class="fa-solid fa-wrench"></i></div>
    </div>
    <div @click="filtrarYIrAInventario('Fuera de Servicio')" class="bg-white p-3.5 rounded-xl shadow-sm border border-slate-300 flex items-center justify-between cursor-pointer hover:border-slate-600 transition">
      <div><p class="text-[10px] text-slate-500 font-bold uppercase">Fuera Servicio</p><h3 class="text-xl font-bold text-slate-700">{{ countEstado('Fuera de Servicio') }}</h3></div>
      <div class="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm"><i class="fa-solid fa-ban"></i></div>
    </div>
    <div @click="filtrarYIrAInventario('Venta')" class="bg-white p-3.5 rounded-xl shadow-sm border border-purple-200 flex items-center justify-between cursor-pointer hover:border-purple-500 transition">
      <div><p class="text-[10px] text-slate-500 font-bold uppercase">En Venta</p><h3 class="text-xl font-bold text-purple-600">{{ countEstado('Venta') }}</h3></div>
      <div class="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-sm"><i class="fa-solid fa-hand-holding-dollar"></i></div>
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
      <h3 class="text-xs font-bold uppercase text-slate-700 flex items-center gap-2"><i class="fa-solid fa-chart-pie text-emerald-600"></i> Estado Operativo</h3>
      <div class="h-60 relative w-full"><canvas id="chartEstado"></canvas></div>
    </div>
    <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
      <h3 class="text-xs font-bold uppercase text-slate-700 flex items-center gap-2"><i class="fa-solid fa-chart-column text-blue-600"></i> Mantenciones por Tipo</h3>
      <div class="h-60 relative w-full"><canvas id="chartTiposMant"></canvas></div>
    </div>
    <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3 md:col-span-2 lg:col-span-1">
      <h3 class="text-xs font-bold uppercase text-slate-700 flex items-center gap-2"><i class="fa-solid fa-chart-bar text-amber-600"></i> Causas de Intervención</h3>
      <div class="h-60 relative w-full"><canvas id="chartCausas"></canvas></div>
    </div>
  </div>
</section>
`;
