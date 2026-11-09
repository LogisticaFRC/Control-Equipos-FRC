// Plantilla HTML del componente 'perfil-equipo' — organizado en PESTAÑAS (Resumen · Historial · Fallas · Datos · Filtros y ficha · OC y traslados)
export default /* html */ `
<div v-if="showPerfilEquipoModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
  <div class="bg-white rounded-2xl shadow-2xl border w-full max-w-7xl max-h-[96vh] flex flex-col overflow-hidden">
    <!-- Encabezado -->
    <div class="px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 bg-slate-800 text-white">
      <div class="flex items-center gap-3 min-w-0">
        <span class="text-sm font-mono font-extrabold bg-amber-500 text-slate-900 px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap">{{ esVehPerfil ? '' : 'AFI ' }}{{ perfilEquipo.afi }}</span>
        <div class="min-w-0">
          <h3 class="text-base font-extrabold tracking-wide uppercase truncate">{{ perfilEquipo.tipo || 'Equipo' }} <span class="font-semibold text-slate-300 normal-case">{{ perfilEquipo.marca }} {{ perfilEquipo.modelo }}</span></h3>
          <p class="text-[11px] text-slate-300 truncate">
            <span :class="['px-1.5 py-0.5 rounded font-bold mr-1', getBadgeEstadoPerfil(perfilEquipo.disponibilidad)]">{{ perfilEquipo.disponibilidad }}</span>
            <i class="fa-solid fa-location-dot mr-0.5"></i>{{ rutaTexto(perfilEquipo.locacionId) || perfilEquipo.ubicacion || 'Sin ubicación' }}
            <template v-if="perfilEquipo.empresaArriendo"> · <i class="fa-solid fa-building mr-0.5"></i>{{ perfilEquipo.empresaArriendo }}</template>
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button v-if="puedeEditar" @click="abrirFormularioNuevaMantencion(perfilEquipo.afi)" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 shadow"><i class="fa-solid fa-plus-circle"></i> Agregar Mantención</button>
        <button @click="showPerfilEquipoModal = false" class="w-8 h-8 rounded-full bg-slate-700 hover:bg-rose-500 text-white flex items-center justify-center transition shadow"><i class="fa-solid fa-xmark text-base"></i></button>
      </div>
    </div>

    <!-- Indicadores rápidos -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-slate-200 border-b text-xs">
      <div class="bg-white px-3 py-2"><span class="block text-[9px] font-bold uppercase text-slate-500">{{ esVehPerfil ? 'Km aprox. hoy' : 'Horómetro aprox.' }}</span><b class="font-mono text-sm text-blue-700">{{ (perfilEquipo.horometros?.hAprox || 0).toLocaleString('es-CL') }} {{ uH }}</b></div>
      <div :class="['px-3 py-2', esAlertaRoja(perfilEquipo.horometros) ? 'bg-rose-50' : 'bg-white']"><span class="block text-[9px] font-bold uppercase text-slate-500">Próxima mantención</span><b class="font-mono text-sm">{{ (perfilEquipo.horometros?.hTarget || 0).toLocaleString('es-CL') }} {{ uH }}</b> <span :class="['text-[9px] font-bold px-1 rounded', getPrediccionStatusBadge(perfilEquipo.horometros)]">{{ perfilEquipo.horometros?.estadoTexto }}</span></div>
      <div class="bg-white px-3 py-2"><span class="block text-[9px] font-bold uppercase text-slate-500">Fecha aprox. mantención</span><b class="font-mono text-sm">{{ formatDateForDisplay(perfilEquipo.horometros?.fechaEstimada) }}</b></div>
      <div class="bg-white px-3 py-2"><span class="block text-[9px] font-bold uppercase text-slate-500">Registros en historial</span><b class="text-sm">{{ totalRegistrosEquipo }}</b> <span class="text-[10px] text-slate-400">· {{ fallasEquipo.res?.n || 0 }} fallas</span></div>
      <div class="bg-white px-3 py-2"><span class="block text-[9px] font-bold uppercase text-slate-500">Lo que más falla</span><b class="text-sm truncate block" :title="fallasEquipo.res?.catTop?.label">{{ fallasEquipo.res?.catTop ? fallasEquipo.res.catTop.label + ' (' + fallasEquipo.res.catTop.pct + '%)' : '—' }}</b></div>
      <div class="bg-white px-3 py-2"><span class="block text-[9px] font-bold uppercase text-slate-500">Gastado en OC</span><b class="text-sm text-teal-800">{{ fmtCLP(totalOCEquipo(perfilEquipo.afi)) }}</b></div>
    </div>

    <!-- Pestañas -->
    <div class="flex gap-1 px-4 pt-2 border-b border-slate-300 bg-slate-100 overflow-x-auto">
      <button v-for="t in TABS_PERFIL" :key="t.k" @click="perfilTab = t.k"
        :class="['px-3 py-2 text-xs font-bold rounded-t-lg border border-b-0 -mb-px whitespace-nowrap transition', perfilTab === t.k ? 'bg-white text-blue-700 border-slate-300' : 'text-slate-500 border-transparent hover:text-slate-800']">
        <i :class="['fa-solid mr-1', t.i]"></i>{{ t.l }}
        <span v-if="t.k === 'fallas' && fallasEquipo.res?.repetidas" class="ml-1 px-1.5 rounded-full bg-rose-500 text-white text-[9px]">{{ fallasEquipo.res.repetidas }}</span>
      </button>
    </div>

    <div class="p-4 sm:p-5 overflow-y-auto space-y-5 flex-grow bg-slate-100 text-xs">

      <!-- ===== RESUMEN ===== -->
      <div v-show="perfilTab === 'resumen'" class="space-y-5">
      <!-- SECCIÓN HORÓMETROS CON FECHA MANUAL -->
      <div :class="['p-5 rounded-xl shadow-sm border flex flex-col lg:flex-row gap-6 items-center', esAlertaRoja(perfilEquipo.horometros) ? 'bg-pasado-blink' : 'bg-normal-horometro']">
        <div class="w-full lg:w-1/3 space-y-3">
          <div class="flex items-center justify-between border-b border-white/20 pb-2">
            <h4 class="font-bold text-sm flex items-center gap-2 uppercase"><i class="fa-solid fa-stopwatch"></i> {{ esVehPerfil ? 'Kilometraje y Frecuencia' : 'Horómetros y Frecuencia' }}</h4>
            <div class="flex gap-1">
              <span v-if="perfilEquipo.horometros?.horasFaltantes <= 0" class="bg-white text-rose-600 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase animate-pulse">¡PASADO!</span>
              <span v-if="tieneAlertaAnual(perfilEquipo.horometros)" :class="['px-2 py-0.5 rounded text-[10px] font-extrabold uppercase', esAnualVencida(perfilEquipo.horometros) ? 'bg-white text-rose-600 animate-pulse' : 'bg-amber-400 text-slate-900']">{{ perfilEquipo.horometros?.estadoAnual }}</span>
            </div>
          </div>
          <div>
            <label class="block font-bold text-[10px] mb-1 opacity-80 uppercase">{{ esVehPerfil ? 'Último Kilometraje Tomado (Manual)' : 'Último Horómetro Tomado (Manual)' }}</label>
            <input type="number" step="any" v-model="perfilEquipo.horometroActual" :disabled="!puedeEditar" class="w-full p-2.5 border-none rounded-lg bg-white/20 focus:bg-white/30 font-mono font-bold text-white text-sm outline-none transition">
          </div>
          <div>
            <label class="block font-bold text-[10px] mb-1 opacity-80 uppercase">{{ esVehPerfil ? 'Fecha de este Kilometraje' : 'Fecha de este Horómetro' }}</label>
            <input type="date" v-model="perfilEquipo.fechaHorometroManual" :disabled="!puedeEditar" class="w-full p-2.5 border-none rounded-lg bg-white/20 focus:bg-white/30 font-mono font-bold text-white text-sm outline-none transition">
          </div>
          <div>
            <label class="block font-bold text-[10px] mb-1 opacity-80 uppercase">Frecuencia de Mantención ({{ esVehPerfil ? 'km' : 'horas' }})</label>
            <input type="number" step="any" v-model="perfilEquipo.frecuenciaMantencion" :disabled="!puedeEditar" class="w-full p-2.5 border-none rounded-lg bg-white/10 font-mono font-bold text-sm outline-none">
          </div>
          <button v-if="puedeEditar" @click="actualizarHorometroPerfil" :disabled="actualizandoHorometro" class="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-extrabold py-2.5 rounded-lg shadow text-xs uppercase transition">
            <i :class="['fa-solid', actualizandoHorometro ? 'fa-spinner fa-spin' : 'fa-rotate']"></i> {{ actualizandoHorometro ? 'Actualizando...' : (esVehPerfil ? 'Actualizar Kilometraje' : 'Actualizar Horómetro') }}
          </button>
        </div>

        <div class="w-full lg:w-2/3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
          <div class="bg-white/10 p-3 rounded-xl border border-white/20">
            <span class="block text-[10px] uppercase font-bold opacity-70 mb-1">{{ esVehPerfil ? 'Último Kilometraje Tomado' : 'Último Horómetro Tomado' }}</span>
            <strong class="font-mono text-base text-amber-300 block">{{ perfilEquipo.horometros?.hTomado || 0 }} {{ uH }}</strong>
            <span class="text-[9px] opacity-70 block mt-0.5"><i class="fa-solid fa-calendar mr-1"></i> {{ formatDateForDisplay(perfilEquipo.horometros?.fechaUltimoHorometro) }}</span>
          </div>
          <div class="bg-white/10 p-3 rounded-xl border border-white/20">
            <span class="block text-[10px] uppercase font-bold opacity-70 mb-1">Última Mantención</span>
            <strong class="font-mono text-base text-blue-300 block">{{ perfilEquipo.horometros?.hUltimaMant || 0 }} {{ uH }}</strong>
            <span class="text-[9px] opacity-70 block mt-0.5"><i class="fa-solid fa-calendar mr-1"></i> {{ formatDateForDisplay(perfilEquipo.horometros?.ultimaMantFecha) }}</span>
            <span class="text-[9px] opacity-60 block mt-0.5">Penúltima: {{ perfilEquipo.horometros?.hPenultimaMant ? perfilEquipo.horometros.hPenultimaMant + ' ' + uH + ' · ' + formatDateForDisplay(perfilEquipo.horometros.penultimaMantFecha) : 'sin registro' }}</span>
          </div>
          <div class="bg-white/10 p-3 rounded-xl border border-white/20">
            <span class="block text-[10px] uppercase font-bold opacity-70 mb-1">{{ esVehPerfil ? 'Kilometraje Actual Aprox.' : 'Horómetro Actual Aprox.' }}</span>
            <strong class="font-mono text-base text-sky-300 block">{{ perfilEquipo.horometros?.hAprox || 0 }} {{ uH }}</strong>
            <span class="text-[9px] opacity-60 block mt-0.5">{{ perfilEquipo.horometros?.rateHrsDia > 0 ? perfilEquipo.horometros.rateHrsDia.toFixed(2) + ' ' + uH + '/día' : 'Sin uso diario' }}</span>
            <span v-if="perfilEquipo.horometros?.calc" class="text-[9px] opacity-70 block mt-0.5 leading-tight" :title="perfilEquipo.horometros.metodoCalculo">
              ({{ perfilEquipo.horometros.calc.hHasta }} − {{ perfilEquipo.horometros.calc.hDesde }}) / {{ perfilEquipo.horometros.calc.dias }} días<br>
              {{ formatDateForDisplay(perfilEquipo.horometros.calc.fDesde) }} → {{ formatDateForDisplay(perfilEquipo.horometros.calc.fHasta) }}
            </span>
            <span v-else class="text-[9px] opacity-70 block mt-0.5">Uso por defecto (sin datos)</span>
          </div>
          <div class="bg-white/10 p-3 rounded-xl border border-white/20">
            <span class="block text-[10px] uppercase font-bold opacity-70 mb-1">Próxima Mantención (Meta)</span>
            <strong class="font-mono text-base text-emerald-300 block">{{ perfilEquipo.horometros?.hTarget || 0 }} {{ uH }}</strong>
          </div>
          <div class="bg-white/10 p-3 rounded-xl border border-white/20">
            <span class="block text-[10px] uppercase font-bold opacity-70 mb-1">Fecha Próxima Mantención (Aprox.)</span>
            <strong class="font-mono text-sm text-amber-300 block mt-1"><i class="fa-solid fa-calendar-days mr-1"></i> {{ formatDateForDisplay(perfilEquipo.horometros?.fechaEstimada) }}</strong>
          </div>
          <div :class="['p-3 rounded-xl border', esAnualVencida(perfilEquipo.horometros) ? 'bg-rose-600/40 border-rose-300' : esAnualProxima(perfilEquipo.horometros) ? 'bg-amber-500/30 border-amber-300' : 'bg-white/10 border-white/20']">
            <span class="block text-[10px] uppercase font-bold opacity-70 mb-1">Mantención Anual (1 año)</span>
            <strong class="font-mono text-sm text-white block mt-1"><i class="fa-solid fa-calendar-check mr-1"></i> {{ formatDateForDisplay(perfilEquipo.horometros?.fechaVencAnual) }}</strong>
            <span class="text-[9px] font-bold block mt-0.5">{{ perfilEquipo.horometros?.estadoAnual }} · {{ getAnualTextoDias(perfilEquipo.horometros) }}</span>
          </div>
        </div>
      </div>
        <div class="bg-white p-4 rounded-xl border shadow-sm space-y-2">
          <div class="flex items-center justify-between"><h4 class="font-bold text-slate-800 uppercase"><i class="fa-solid fa-wand-magic-sparkles text-violet-500 mr-1"></i> Hallazgos de fallas</h4><button @click="perfilTab = 'fallas'" class="text-blue-700 underline font-bold">Ver análisis →</button></div>
          <div class="grid md:grid-cols-2 gap-2">
            <div v-for="(h, k) in fallasEquipo.hallazgos.slice(0, 4)" :key="k" :class="['rounded-lg border p-2.5 flex gap-2 items-start', claseNivel(h.nivel)]"><i :class="['fa-solid mt-0.5', h.icon || 'fa-circle-info']"></i><span v-html="htmlHallazgo(h.texto)"></span></div>
          </div>
        </div>
      </div>

      <!-- ===== HISTORIAL ===== -->
      <div v-show="perfilTab === 'historial'" class="space-y-4">
      <!-- DASHBOARD INDIVIDUAL DEL EQUIPO CON FILTROS -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div>
            <h4 class="font-bold text-slate-800 uppercase flex items-center gap-2 text-xs"><i class="fa-solid fa-chart-pie text-blue-600"></i> Estadísticas del equipo</h4>
            <p class="text-[11px] text-slate-500">Los filtros también aplican a la tabla de abajo.</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <div>
              <label class="block text-[10px] font-bold text-slate-600">Desde</label>
              <input type="date" v-model="perfilFiltroFechaInicio" class="p-1.5 border rounded text-xs bg-slate-50">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-600">Hasta</label>
              <input type="date" v-model="perfilFiltroFechaFin" class="p-1.5 border rounded text-xs bg-slate-50">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-600">Causa / Tipo</label>
              <select v-model="perfilFiltroCausa" class="p-1.5 border rounded text-xs font-bold bg-slate-50">
                <option value="ALL">-- Todas las Causas --</option>
                <option v-for="c in listaCausasEquipo" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
            <button @click="resetFiltrosPerfil" class="text-xs text-slate-500 hover:text-slate-800 underline mt-4">Limpiar</button>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <div class="bg-slate-50 p-3 rounded-xl border">
            <span class="text-[10px] text-slate-500 font-bold uppercase block">Total Intervenciones</span>
            <strong class="text-lg font-bold text-slate-800">{{ getHistorialIntervencionesFiltradoAFI(perfilEquipo.afi).length }}</strong>
          </div>
          <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <span class="text-[10px] text-emerald-700 font-bold uppercase block">Costo Total Acumulado</span>
            <strong class="text-lg font-bold text-emerald-800">\${{ costoTotalIntervencionesFiltradasAFI(perfilEquipo.afi).toLocaleString('es-CL') }}</strong>
          </div>
          <div class="bg-teal-50 p-3 rounded-xl border-2 border-teal-400" title="Suma de todas las OC del equipo (módulo OC), sin filtros de fecha">
            <span class="text-[10px] text-teal-800 font-bold uppercase block"><i class="fa-solid fa-file-invoice-dollar mr-1"></i>Total gastado en OC</span>
            <strong class="text-lg font-extrabold text-teal-900">{{ fmtCLP(totalOCEquipo(perfilEquipo.afi)) }}</strong>
            <span class="block text-[10px] text-teal-700">{{ ocsDelEquipo(perfilEquipo.afi).length }} OC</span>
          </div>
          <div class="bg-amber-50 p-3 rounded-xl border border-amber-200">
            <span class="text-[10px] text-amber-800 font-bold uppercase block">Causa Más Frecuente</span>
            <strong class="text-sm font-bold text-amber-900 truncate block mt-1">{{ causaMasFrecuenteEquipo(perfilEquipo.afi) }}</strong>
          </div>
          <div class="bg-blue-50 p-3 rounded-xl border border-blue-200">
            <span class="text-[10px] text-blue-800 font-bold uppercase block">Traslados Realizados</span>
            <strong class="text-lg font-bold text-blue-900">{{ getHistorialMovimientosAFI(perfilEquipo.afi).length }}</strong>
          </div>
        </div>

        <!-- Mini Gráfico de Causas Individual -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div class="bg-slate-50 p-4 rounded-xl border h-56 relative flex flex-col items-center justify-center">
            <h5 class="text-[11px] font-bold uppercase text-slate-700 absolute top-3 left-4"><i class="fa-solid fa-chart-bar text-amber-600 mr-1"></i> Distribución de Causas</h5>
            <div class="w-full h-44 relative mt-4"><canvas id="chartPerfilCausas"></canvas></div>
          </div>
          <div class="bg-slate-50 p-4 rounded-xl border h-56 relative flex flex-col items-center justify-center">
            <h5 class="text-[11px] font-bold uppercase text-slate-700 absolute top-3 left-4"><i class="fa-solid fa-chart-column text-blue-600 mr-1"></i> Tipos de Mantención</h5>
            <div class="w-full h-44 relative mt-4"><canvas id="chartPerfilTipos"></canvas></div>
          </div>
        </div>
      </div>
        <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-2">
          <h4 class="font-bold text-slate-800 uppercase flex items-center gap-2"><i class="fa-solid fa-wrench text-blue-600"></i> Historial de mantenciones e intervenciones <span class="font-normal normal-case text-slate-400">· clic en una fila para ver todo</span></h4>
          <tabla-historial :registros="getHistorialIntervencionesFiltradoAFI(perfilEquipo.afi)" :por-pagina="50"></tabla-historial>
        </div>
      </div>

      <!-- ===== FALLAS (análisis automático del equipo) ===== -->
      <div v-show="perfilTab === 'fallas'" class="space-y-4">
        <div class="bg-white p-4 rounded-xl border shadow-sm space-y-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h4 class="font-bold text-slate-800 uppercase"><i class="fa-solid fa-wand-magic-sparkles text-violet-500 mr-1"></i> Qué le pasa a este equipo</h4>
            <label class="flex items-center gap-1.5 font-semibold text-slate-600"><input type="checkbox" v-model="fallasIncluirMant"> Incluir mantenciones</label>
          </div>
          <div class="grid md:grid-cols-2 gap-2">
            <div v-for="(h, k) in fallasEquipo.hallazgos" :key="k" :class="['rounded-lg border p-2.5 flex gap-2 items-start', claseNivel(h.nivel)]"><i :class="['fa-solid mt-0.5', h.icon || 'fa-circle-info']"></i><span v-html="htmlHallazgo(h.texto)"></span></div>
          </div>
        </div>
        <div v-if="fallasEquipo.res" class="grid lg:grid-cols-2 gap-4">
          <div class="bg-white p-4 rounded-xl border shadow-sm">
            <h5 class="font-bold uppercase text-slate-700 mb-3"><i class="fa-solid fa-chart-bar text-rose-500 mr-1"></i> Por sistema</h5>
            <div v-for="c in fallasEquipo.res.cats" :key="c.key" class="mb-2">
              <div class="flex justify-between font-semibold"><span><i :class="['fa-solid mr-1', c.icon]" :style="{ color: c.color }"></i>{{ c.label }}</span><span>{{ c.n }} · {{ c.pct }}%</span></div>
              <div class="h-2.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full rounded-full" :style="{ width: c.pct + '%', background: c.color }"></div></div>
            </div>
          </div>
          <div class="bg-white p-4 rounded-xl border shadow-sm">
            <h5 class="font-bold uppercase text-slate-700 mb-3"><i class="fa-solid fa-repeat text-amber-500 mr-1"></i> Problemas más repetidos</h5>
            <div v-for="p in fallasEquipo.res.probs" :key="p.problema" class="flex justify-between gap-2 py-1 border-b last:border-0">
              <span class="capitalize">{{ p.problema.toLowerCase() }}</span><span class="font-extrabold px-2 rounded-full bg-amber-100 text-amber-800">{{ p.n }}</span>
            </div>
            <p v-if="!fallasEquipo.res.probs.length" class="text-slate-400">Sin datos.</p>
          </div>
        </div>
        <div v-if="fallasEquipo.lista.length" class="bg-white p-4 rounded-xl border shadow-sm">
          <h5 class="font-bold uppercase text-slate-700 mb-2"><i class="fa-solid fa-list text-slate-500 mr-1"></i> Registros clasificados ({{ fallasEquipo.lista.length }})</h5>
          <div class="space-y-1 max-h-72 overflow-y-auto">
            <div v-for="x in fallasEquipo.lista" :key="x.r.id" class="border rounded-lg px-2 py-1.5 flex flex-wrap gap-x-3 gap-y-0.5 hover:bg-slate-50">
              <span class="font-mono font-bold">{{ formatDateForDisplay(x.fecha) }}</span>
              <span class="font-bold" :style="{ color: x.cat.color === '#facc15' || x.cat.color === '#eab308' ? '#a16207' : x.cat.color }"><i :class="['fa-solid mr-0.5', x.cat.icon]"></i>{{ x.cat.label }}</span>
              <span class="text-slate-500">{{ x.r.causa }}</span>
              <span class="flex-1 min-w-[200px]">{{ x.r.causaDetallada }}<span v-if="x.r.descripcion" class="text-slate-400"> — {{ x.r.descripcion }}</span></span>
              <span v-if="x.min" class="text-sky-700 font-semibold">{{ fmtMin(x.min) }}</span>
            </div>
          </div>
        </div>
        <p class="text-[10px] text-slate-400">Clasificación automática por palabras clave de causa, causa detallada y descripción. Ver todos los equipos en <b>Operaciones → Análisis de Fallas</b>.</p>
      </div>

      <!-- ===== DATOS Y UBICACIÓN ===== -->
      <div v-show="perfilTab === 'datos'" class="space-y-5">
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h4 class="font-bold text-slate-800 uppercase flex items-center gap-2 border-b pb-2 mb-4"><i class="fa-solid fa-truck-monster text-emerald-600"></i> Datos Principales del Equipo</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div><label class="block font-bold text-slate-700 mb-1">AFI</label><input type="text" v-model="perfilEquipo.afi" :disabled="!puedeEditar" class="w-full p-2 border rounded-lg bg-slate-50 font-bold text-amber-800"></div>
          <div><label class="block font-bold text-slate-700 mb-1">Tipo de Equipo</label><input type="text" v-model="perfilEquipo.tipo" :disabled="!puedeEditar" class="w-full p-2 border rounded-lg bg-slate-50 font-bold text-slate-800"></div>
          <div><label class="block font-bold text-slate-700 mb-1">Marca</label><input type="text" v-model="perfilEquipo.marca" :disabled="!puedeEditar" class="w-full p-2 border rounded-lg bg-slate-50"></div>
          <div><label class="block font-bold text-slate-700 mb-1">Modelo</label><input type="text" v-model="perfilEquipo.modelo" :disabled="!puedeEditar" class="w-full p-2 border rounded-lg bg-slate-50"></div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Disponibilidad</label>
            <select v-model="perfilEquipo.disponibilidad" @change="alCambiarDisponibilidadPerfil" :disabled="!puedeEditar" class="w-full p-2 border rounded-lg bg-slate-50 font-bold">
              <option value="Operativo">Trabajando / Operativo</option><option value="Disponible">Disponible</option><option value="En Traslado">En Traslado</option>
              <option value="En Mantencion">En Mantención</option><option value="Fuera de Servicio">Fuera de Servicio</option><option value="Venta">En Venta</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1"><i class="fa-solid fa-building text-blue-500"></i> Empresa Arrendada</label>
            <!-- Con locación elegida, la empresa sale de ella (módulo Áreas) -->
            <input v-if="empresaDeSelPerfil && !esFueraDeServicio(perfilEquipo)" type="text" :value="empresaDeSelPerfil" disabled class="w-full p-2 border rounded-lg uppercase font-bold bg-blue-50 text-blue-800">
            <input v-else type="text" list="dl-perfil-empresas" v-model="perfilEquipo.empresaArriendo" :disabled="!puedeEditar || esFueraDeServicio(perfilEquipo)" placeholder="Ej: CODELCO..."
              :class="['w-full p-2 border rounded-lg uppercase font-bold', esFueraDeServicio(perfilEquipo) ? 'bg-slate-200 text-slate-700' : 'bg-slate-50 text-blue-800']">
            <p v-if="esFueraDeServicio(perfilEquipo)" class="text-[10px] text-slate-500 mt-0.5"><i class="fa-solid fa-lock"></i> Fuera de Servicio → siempre TALLER FRC</p>
            <p v-else-if="empresaDeSelPerfil" class="text-[10px] text-slate-500 mt-0.5"><i class="fa-solid fa-sitemap"></i> Según la locación elegida abajo</p>
            <datalist id="dl-perfil-empresas"><option v-for="emp in listaEmpresas" :key="emp" :value="emp"></option></datalist>
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">GPS</label>
            <select v-model="perfilEquipo.gps" :disabled="!puedeEditar" class="w-full p-2 border rounded-lg bg-slate-50 font-bold text-blue-700">
              <option value="Instalado">Instalado</option><option value="Sin GPS">Sin GPS</option>
            </select>
          </div>
          <div><label class="block font-bold text-slate-700 mb-1">IMEI del GPS</label><input type="text" v-model="perfilEquipo.imei_gps" :disabled="!puedeEditar" class="w-full p-2 border rounded-lg bg-slate-50 font-mono"></div>
        </div>

        <!-- UBICACIÓN: Empresa → Área → Sector → Locación (módulo Áreas). Se actualiza a mano o con un Movimiento. -->
        <div class="mt-4 p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/40 space-y-2">
          <div class="flex flex-wrap justify-between items-center gap-2">
            <h5 class="font-extrabold text-emerald-800 uppercase flex items-center gap-2"><i class="fa-solid fa-map-location-dot"></i> Ubicación actual del equipo</h5>
            <div class="flex flex-wrap gap-3">
              <a v-if="perfilEquipo.locacionId && googleMapsUrl(perfilEquipo.locacionId)" :href="googleMapsUrl(perfilEquipo.locacionId)" target="_blank" rel="noopener" class="text-[11px] font-bold text-blue-700 underline"><i class="fa-brands fa-google"></i> Ver en Google Maps</a>
              <button v-if="perfilEquipo.locacionId && rutaTexto(perfilEquipo.locacionId)" @click="verLocacionEnAreas(perfilEquipo.locacionId)" class="text-[11px] font-bold text-emerald-700 underline"><i class="fa-solid fa-sitemap"></i> Ver en Áreas y Locaciones</button>
            </div>
          </div>
          <p class="text-[11px] text-slate-600">Hoy: <b class="text-slate-800">{{ rutaTexto(perfilEquipo.locacionId) || 'Sin locación asignada' }}</b>
            <span v-if="!rutaTexto(perfilEquipo.locacionId) && perfilEquipo.ubicacion" class="text-slate-500"> · texto anterior: "{{ perfilEquipo.ubicacion }}"</span></p>
          <selector-locacion v-if="perfilEquipo.sel" :sel="perfilEquipo.sel" :disabled="!puedeEditar" :puede-crear="puedeEditar"></selector-locacion>
          <p class="text-[10px] text-slate-500">Cambia la ubicación a mano (viendo el lugar y el AFI) y presiona <b>Guardar Cambios</b>. Los <b>Movimientos</b> también la actualizan. Si el lugar no existe, elige <b>➕ Crear nueva…</b></p>
        </div>
      </div>
      <!-- ASIGNACIÓN A PROGRAMA -->
      <div v-if="puedeEditar" class="bg-rose-50 border border-rose-200 p-4 rounded-xl shadow-sm">
        <h4 class="font-bold text-rose-800 uppercase flex items-center gap-2 border-b border-rose-200 pb-2 mb-3"><i class="fa-solid fa-calendar-plus"></i> Asignar equipo al programa</h4>
        <div class="flex flex-wrap items-end gap-3">
          <div class="flex-grow">
            <label class="block font-bold text-slate-700 mb-1 text-[10px] uppercase">Programa</label>
            <select v-model="perfilAsignacionProgId" class="w-full p-2 border border-rose-300 rounded-lg bg-white font-bold">
              <option value="">-- Elige Programa --</option>
              <option v-for="p in dbProgramasCalendarios" :key="p.id" :value="p.id">[{{ p.carpeta || p.tipo }}] {{ p.nombre_programa || p.mes }} ({{ formatDateForDisplay(p.fecha_inicio_programa) }} al {{ formatDateForDisplay(p.fecha_termino_programa) }})</option>
            </select>
          </div>
          <div><label class="block font-bold text-slate-700 mb-1 text-[10px] uppercase">Tipo</label><select v-model="perfilAsignacionTipo" class="p-2 border rounded-lg bg-white font-semibold"><option value="Mantención">Mantención</option><option value="Reparación">Reparación</option></select></div>
          <div v-if="perfilAsignacionTipo === 'Reparación'"><label class="block font-bold text-slate-700 mb-1 text-[10px] uppercase">Nave</label><select v-model="perfilAsignacionNave" class="p-2 border rounded-lg bg-white font-bold text-amber-900"><option value="NAVE 1">Nave 1</option><option value="NAVE 2">Nave 2</option><option value="NAVE 3">Nave 3</option><option value="NAVE 4">Nave 4</option></select></div>
          <div><label class="block font-bold text-slate-700 mb-1 text-[10px] uppercase">Condición</label><select v-model="perfilAsignacionCondicion" class="p-2 border rounded-lg bg-white font-semibold"><option value="Arriendo">Arriendo</option><option value="Venta">Venta</option></select></div>
          <div><label class="block font-bold text-slate-700 mb-1 text-[10px] uppercase">Fecha Programada (Fija)</label><input type="date" v-model="perfilAsignacionFechaInicio" class="p-2 border rounded-lg bg-white font-mono"></div>
          <div><label class="block font-bold text-slate-700 mb-1 text-[10px] uppercase">Fecha Rango / Fin (Opcional)</label><input type="date" v-model="perfilAsignacionFechaFin" class="p-2 border rounded-lg bg-white font-mono"></div>
          <button @click="guardarAsignacionDesdePerfil" :disabled="!perfilAsignacionProgId || !perfilAsignacionFechaInicio" class="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg transition shadow-md h-[36px] flex items-center gap-1.5"><i class="fa-solid fa-plus"></i> Añadir</button>
        </div>
      </div>
      </div>

      <!-- ===== FILTROS Y FICHA ===== -->
      <div v-show="perfilTab === 'ficha'" class="space-y-5">
      <!-- FILTROS QUE USA EL EQUIPO (vienen del módulo FILTROS, por marca + modelo) -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-emerald-200">
        <div class="flex flex-wrap justify-between items-center gap-2 border-b pb-2 mb-4">
          <h4 class="font-bold text-slate-800 uppercase flex items-center gap-2"><i class="fa-solid fa-filter text-emerald-600"></i> Filtros que usa el equipo <span class="normal-case font-semibold text-slate-500">({{ perfilEquipo.marca || 'sin marca' }} · {{ perfilEquipo.modelo || 'sin modelo' }})</span></h4>
          <button @click="verFiltrosDelPerfil" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg shadow flex items-center gap-1.5"><i class="fa-solid fa-pen-to-square"></i> Ver / corregir en módulo Filtros</button>
        </div>
        <div v-if="filtrosRequeridosPerfil.length === 0" class="text-center text-slate-400 py-3">
          Aún no hay filtros registrados para esta marca y modelo. Se cargan solos al registrar una mantención con filtros.
        </div>
        <div v-else class="overflow-x-auto border rounded-lg">
          <table class="w-full text-left whitespace-nowrap border-collapse">
            <thead class="bg-slate-800 text-white uppercase text-[9px]">
              <tr><th class="p-2">Tipo</th><th class="p-2 text-center">Cantidad</th><th class="p-2">Códigos que sirven (ref. cruzada)</th><th class="p-2">Mejor opción</th><th class="p-2 text-right">Costo estimado</th></tr>
            </thead>
            <tbody class="divide-y bg-white">
              <tr v-for="t in filtrosRequeridosPerfil" :key="t.tipo" class="hover:bg-slate-50 align-top">
                <td class="p-2 font-extrabold text-slate-800">{{ t.tipo }}</td>
                <td class="p-2 text-center"><span class="inline-block min-w-[28px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 font-extrabold">{{ t.cantidad }}</span></td>
                <td class="p-2">
                  <div class="flex flex-wrap gap-1">
                    <span v-for="r in t.filas" :key="r.id" :class="['px-1.5 py-0.5 rounded border font-mono text-[10px]', r.esMejor ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold' : 'bg-slate-50 text-slate-700']">{{ r.codigo }}<span class="font-sans text-slate-500 ml-1">{{ r.marca }}<template v-if="r.proveedor"> · {{ r.proveedor }}</template> · {{ fmtPrecio(r.precio) }}</span></span>
                  </div>
                </td>
                <td class="p-2 font-bold text-emerald-700">{{ t.mejor ? t.mejor.codigo + ' · ' + (t.mejor.proveedor || '-') : '-' }}</td>
                <td class="p-2 text-right font-mono font-bold">{{ fmtPrecio(t.costo) }}</td>
              </tr>
            </tbody>
            <tfoot class="bg-emerald-50 font-extrabold text-emerald-900">
              <tr><td class="p-2" colspan="4">Costo estimado del kit de filtros</td><td class="p-2 text-right font-mono">{{ fmtPrecio(filtrosRequeridosPerfil.reduce((s, t) => s + t.costo, 0)) }}</td></tr>
            </tfoot>
          </table>
        </div>
      </div>
      <!-- FICHA TÉCNICA DEL EQUIPO (Admin sube archivo o enlace; los demás solo ven) -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h4 class="font-bold text-slate-800 uppercase flex items-center gap-2 border-b pb-2 mb-4"><i class="fa-solid fa-file-pdf text-rose-600"></i> Ficha Técnica del Equipo</h4>
        <documentos-carpeta v-if="perfilEquipo.id" :carpeta="'EQUIPO:' + perfilEquipo.id" vacio="Este equipo aún no tiene ficha técnica cargada."></documentos-carpeta>
      </div>
      </div>

      <!-- ===== OC Y TRASLADOS ===== -->
      <div v-show="perfilTab === 'oc'" class="space-y-5">
      <!-- ÓRDENES DE COMPRA DEL EQUIPO (módulo OC) -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
        <h4 class="font-bold text-slate-800 uppercase flex items-center justify-between gap-2 border-b pb-2">
          <span><i class="fa-solid fa-file-invoice-dollar text-teal-600 mr-1"></i> Órdenes de Compra del Equipo</span>
          <span class="text-teal-900 bg-teal-100 px-3 py-1 rounded-lg text-xs font-extrabold">TOTAL: {{ fmtCLP(totalOCEquipo(perfilEquipo.afi)) }}</span>
        </h4>
        <div class="overflow-x-auto border rounded-lg bg-slate-50 max-h-60">
          <table class="w-full text-left whitespace-nowrap text-[11px]">
            <thead class="bg-slate-100 text-slate-700 sticky top-0 uppercase text-[9px] border-b">
              <tr><th class="p-2">N° OC</th><th class="p-2">Fecha</th><th class="p-2">Proveedor</th><th class="p-2">Descripción</th><th class="p-2">Mantención</th><th class="p-2 text-right">Precio</th><th class="p-2 text-center">Doc.</th></tr>
            </thead>
            <tbody class="divide-y bg-white">
              <tr v-for="o in ocsDelEquipo(perfilEquipo.afi)" :key="o.id">
                <td class="p-2 font-mono font-extrabold"><button @click="irAOC(o.numero)" class="text-emerald-700 underline">{{ o.numero }}</button></td>
                <td class="p-2 font-mono">{{ formatDateForDisplay(o.fecha) }}</td>
                <td class="p-2">{{ o.proveedor || '-' }}</td>
                <td class="p-2 max-w-xs truncate" :title="o.descripcion">{{ o.descripcion || '-' }}</td>
                <td class="p-2">
                  <span v-if="mantencionesDeOC(o).length" class="text-blue-700 font-bold"><i class="fa-solid fa-link mr-1"></i>{{ mantencionesDeOC(o).map(m => formatDateForDisplay(m.fecha) + ' ' + (m.tipoMant || '')).join(' / ') }}</span>
                  <span v-else class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">SIN VINCULAR</span>
                </td>
                <td class="p-2 text-right font-mono font-bold text-emerald-800">{{ fmtCLP(o.precio) }}</td>
                <td class="p-2 text-center"><a v-if="o.link" :href="o.link" target="_blank" rel="noopener" class="text-blue-700"><i class="fa-solid fa-paperclip"></i></a><span v-else class="text-slate-300">—</span></td>
              </tr>
              <tr v-if="!ocsDelEquipo(perfilEquipo.afi).length"><td colspan="7" class="p-4 text-center text-slate-400">Este equipo no tiene OC registradas.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <!-- Historial Movimientos en perfil -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
        <h4 class="font-bold text-slate-800 uppercase flex items-center gap-2 border-b pb-2"><i class="fa-solid fa-truck-moving text-amber-500"></i> Historial de Traslados</h4>
        <div class="overflow-x-auto border rounded-lg bg-slate-50 max-h-48">
          <table class="w-full text-left whitespace-nowrap text-[11px]">
            <thead class="bg-slate-100 text-slate-700 sticky top-0 uppercase text-[9px] border-b">
              <tr><th class="p-2">Fecha</th><th class="p-2">Tipo</th><th class="p-2">Origen</th><th class="p-2">Destino</th><th class="p-2">Empresa</th><th class="p-2">Camión / Conductor</th></tr>
            </thead>
            <tbody class="divide-y bg-white">
              <tr v-for="m in getHistorialMovimientosAFI(perfilEquipo.afi)" :key="m.id">
                <td class="p-2 font-mono font-bold">{{ formatDateForDisplay(m.fecha) }}</td>
                <td class="p-2">{{ m.tipo }}</td>
                <td class="p-2">{{ m.origen }}</td>
                <td class="p-2 font-bold text-emerald-700">{{ m.destino }}</td>
                <td class="p-2">{{ m.empresa_arriendo }}</td>
                <td class="p-2">{{ m.camion }} ({{ m.conductor }})</td>
              </tr>
              <tr v-if="getHistorialMovimientosAFI(perfilEquipo.afi).length === 0"><td colspan="6" class="p-4 text-center text-slate-400">Sin traslados registrados.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      </div>

    </div>

    <div class="px-6 py-4 border-t bg-white flex justify-between items-center">
      <div class="flex items-center gap-3">
        <span class="text-[10px] text-slate-400 font-bold uppercase"><i class="fa-solid fa-cloud"></i> Sincronizado</span>
        <button v-if="isAdmin" @click="abrirBajaEquipo(buscarEquipoPorId(perfilEquipo.id) || perfilEquipo)" class="bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold px-3 py-2 rounded-lg text-xs border border-rose-200"><i class="fa-solid fa-trash"></i> Eliminar equipo</button>
      </div>
      <div class="flex items-center gap-2">
        <button @click="showPerfilEquipoModal = false" class="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-4 py-2 rounded-lg text-xs">Cerrar</button>
        <button v-if="puedeEditar" @click="guardarPerfilEquipo" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-lg shadow text-xs"><i class="fa-solid fa-floppy-disk"></i> Guardar Cambios</button>
      </div>
    </div>
  </div>
</div>
`;
