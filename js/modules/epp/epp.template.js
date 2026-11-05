// Plantilla HTML del módulo CONTROL ENTREGA EPP (área Seguridad)
export default /* html */ `
<section class="space-y-5 text-xs">

  <!-- Encabezado -->
  <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
    <div>
      <h2 class="text-lg font-extrabold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-helmet-safety text-orange-500"></i> Control Entrega EPP</h2>
      <p class="text-slate-500 mt-0.5">Perfil de cada trabajador con sus tallas y los EPP que requiere. Desde el perfil se registra cada <b>entrega</b> con su fecha y queda en el <b>historial</b>.</p>
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <button @click="cargarEPP" :disabled="cargandoEPP" title="Recargar" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2.5 rounded-xl border"><i :class="['fa-solid fa-rotate', cargandoEPP ? 'fa-spin' : '']"></i></button>
      <button @click="exportarEPPExcel" :disabled="exportandoEPP || !dbTrabajadores.length" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow flex items-center gap-2 disabled:opacity-60"><i :class="['fa-solid', exportandoEPP ? 'fa-spinner fa-spin' : 'fa-file-excel']"></i> Exportar Excel</button>
      <button v-if="puedeEditar" @click="nuevoTrabajador" class="bg-orange-500 hover:bg-orange-600 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl shadow flex items-center gap-2"><i class="fa-solid fa-user-plus"></i> Nuevo trabajador</button>
    </div>
  </div>

  <div v-if="faltaSQLEPP" class="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-4 font-semibold">
    <i class="fa-solid fa-triangle-exclamation mr-1"></i> Las tablas del módulo aún no existen. Ejecuta <b>sql/epp.sql</b> en Supabase → SQL Editor (crea las tablas y carga los trabajadores y entregas de la planilla Excel) y luego presiona recargar.
  </div>

  <!-- Resumen -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
    <div @click="tabEPP = 'trabajadores'; filtroTrab.estado = 'ACTIVOS'" class="rounded-xl border p-3 bg-white cursor-pointer hover:shadow"><p class="text-[10px] font-bold text-slate-500 uppercase">Trabajadores activos</p><p class="text-2xl font-extrabold text-slate-800">{{ resumenEPP.activos }} <span v-if="resumenEPP.inactivos" class="text-xs font-bold text-slate-400">· {{ resumenEPP.inactivos }} inactivos</span></p></div>
    <div @click="tabEPP = 'historial'" class="rounded-xl border p-3 bg-emerald-50 border-emerald-300 text-emerald-800 cursor-pointer hover:shadow"><p class="text-[10px] font-bold uppercase">Entregado este mes</p><p class="text-2xl font-extrabold">{{ resumenEPP.entregasMes }} <span class="text-xs font-bold">elementos · {{ resumenEPP.trabajadoresMes }} trab.</span></p></div>
    <div @click="tabEPP = 'trabajadores'; filtroTrab.estado = 'PENDIENTES'" class="rounded-xl border p-3 bg-amber-50 border-amber-300 text-amber-800 cursor-pointer hover:shadow"><p class="text-[10px] font-bold uppercase">Con EPP sin entregar nunca</p><p class="text-2xl font-extrabold">{{ resumenEPP.conPendientes }}</p></div>
    <div class="rounded-xl border p-3 bg-slate-50 border-slate-300 text-slate-700"><p class="text-[10px] font-bold uppercase">Perfiles incompletos</p><p class="text-2xl font-extrabold">{{ resumenEPP.incompletos }} <span class="text-xs font-bold text-slate-400">· {{ resumenEPP.totalEntregas }} entregas totales</span></p></div>
  </div>

  <!-- Pestañas -->
  <div class="flex gap-1 border-b border-slate-300">
    <button v-for="p in [{k:'trabajadores',l:'Trabajadores',i:'fa-id-card'},{k:'planilla',l:'Planilla EPP',i:'fa-table'},{k:'historial',l:'Historial de entregas',i:'fa-clock-rotate-left'}]" :key="p.k" @click="tabEPP = p.k"
      :class="['px-4 py-2.5 font-bold rounded-t-lg border border-b-0 -mb-px transition', tabEPP === p.k ? 'bg-white text-orange-600 border-slate-300' : 'bg-slate-100 text-slate-500 border-transparent hover:text-slate-800']">
      <i :class="['fa-solid mr-1.5', p.i]"></i>{{ p.l }}
    </button>
  </div>

  <!-- Filtros de trabajadores (Trabajadores y Planilla) -->
  <div v-if="tabEPP !== 'historial'" class="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 flex flex-wrap gap-2 items-end">
    <div><label class="block text-[10px] font-bold text-slate-500">Buscar</label><input v-model="filtroTrab.texto" type="text" placeholder="Nombre, RUT o cargo..." class="p-2 border rounded-lg w-64"></div>
    <div><label class="block text-[10px] font-bold text-slate-500">Cargo</label>
      <select v-model="filtroTrab.cargo" class="p-2 border rounded-lg font-bold"><option value="">Todos</option><option v-for="c in cargosLista" :key="c" :value="c">{{ c }}</option></select></div>
    <div><label class="block text-[10px] font-bold text-slate-500">Estado</label>
      <select v-model="filtroTrab.estado" class="p-2 border rounded-lg font-bold">
        <option value="ACTIVOS">Activos</option><option value="PENDIENTES">Con EPP sin entregar</option><option value="INACTIVOS">Inactivos</option><option value="TODOS">Todos</option>
      </select></div>
    <button @click="limpiarFiltroTrab" class="text-slate-500 hover:text-slate-800 underline pb-2">Limpiar</button>
    <span class="ml-auto pb-2 text-slate-400 font-semibold">{{ listaTrabajadores.length }} trabajadores</span>
  </div>

  <!-- ===================== TRABAJADORES (tarjetas) ===================== -->
  <div v-if="tabEPP === 'trabajadores'">
    <div v-if="cargandoEPP && !dbTrabajadores.length" class="text-center text-slate-400 py-10"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Cargando...</div>
    <div v-else-if="!listaTrabajadores.length" class="bg-white rounded-2xl border p-10 text-center text-slate-400">No hay trabajadores con este filtro.</div>
    <div v-else class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <div v-for="t in listaTrabajadores" :key="t.id" @click="abrirPerfil(t)"
        :class="['bg-white rounded-2xl border shadow-sm p-4 cursor-pointer hover:shadow-md hover:border-orange-300 transition flex flex-col gap-3', !t.activo ? 'opacity-60' : '']">
        <div class="flex items-start gap-3">
          <div class="w-11 h-11 rounded-full bg-slate-900 text-orange-400 font-extrabold flex items-center justify-center shrink-0 text-sm">{{ iniciales(t.nombre) }}</div>
          <div class="min-w-0 flex-1">
            <p class="font-extrabold text-slate-800 text-sm leading-tight truncate" :title="t.nombre">{{ t.nombre }}</p>
            <p class="text-slate-500 font-semibold truncate">{{ t.cargo || 'Sin cargo' }}<span v-if="t.rut" class="text-slate-400"> · {{ t.rut }}</span></p>
            <p class="text-slate-400 mt-0.5 truncate"><i class="fa-solid fa-ruler-combined mr-1"></i>{{ etiquetaTallas(t) }}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-1">
          <span v-if="!t.activo" class="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-bold text-[10px]">INACTIVO</span>
          <span v-if="pendientes(t).length" class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]" :title="pendientes(t).map(e => e.label).join(', ')"><i class="fa-solid fa-hourglass-half mr-1"></i>{{ pendientes(t).length }} sin entregar</span>
          <span v-if="perfilIncompleto(t)" class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]"><i class="fa-solid fa-circle-exclamation mr-1"></i>Perfil incompleto</span>
          <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px]">{{ requeridos(t).length }} EPP requeridos</span>
        </div>
        <div class="flex items-center justify-between gap-2 mt-auto pt-2 border-t">
          <p class="text-slate-500 min-w-0 truncate">
            <template v-if="ultimaEntregaGeneral(t)"><i class="fa-solid fa-clock-rotate-left mr-1"></i>Última: <b>{{ formatDateForDisplay(ultimaEntregaGeneral(t).fecha) }}</b> <span class="text-slate-400">({{ textoDias(ultimaEntregaGeneral(t).fecha) }})</span></template>
            <span v-else class="text-slate-400 italic">Sin entregas registradas</span>
          </p>
          <button v-if="puedeEditar && t.activo" @click.stop="abrirEntrega(t)" class="shrink-0 bg-orange-500 hover:bg-orange-600 text-slate-950 font-extrabold px-2.5 py-1.5 rounded-lg"><i class="fa-solid fa-hand-holding-medical mr-1"></i>Entregar</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ===================== PLANILLA EPP (matriz) ===================== -->
  <div v-if="tabEPP === 'planilla'" class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <p class="px-4 py-2.5 text-slate-500 border-b bg-slate-50">Cada celda muestra la <b>talla</b> (o SI si lo requiere) y abajo la <b>última fecha de entrega</b>. <span class="text-slate-400">N/A = no lo requiere.</span> <span v-if="puedeEditar">Clic en una celda para registrar la entrega de ese elemento.</span></p>
    <div class="overflow-x-auto">
      <table class="w-full text-center whitespace-nowrap">
        <thead class="bg-slate-800 text-white uppercase text-[10px]">
          <tr>
            <th class="p-2 sticky left-0 bg-slate-800 text-left z-10">Nombre</th><th class="p-2 text-left">Cargo</th>
            <th v-for="e in ELEMENTOS_EPP" :key="e.key" class="p-2 leading-tight"><i :class="['fa-solid block mb-1 text-orange-300', e.icon]"></i>{{ e.corto }}</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="t in listaTrabajadores" :key="t.id" :class="['hover:bg-orange-50/40', !t.activo ? 'opacity-60' : '']">
            <td class="p-2 text-left font-bold text-slate-800 sticky left-0 bg-white z-10"><button @click="abrirPerfil(t)" class="hover:underline hover:text-orange-600">{{ t.nombre }}</button></td>
            <td class="p-2 text-left text-slate-500">{{ t.cargo }}</td>
            <td v-for="e in ELEMENTOS_EPP" :key="e.key" @click="puedeEditar && t.activo ? abrirEntrega(t, e.key) : abrirPerfil(t)"
              :class="['p-1.5 border-l cursor-pointer', t.requiere[e.key] ? (ultimaEntrega(t, e.key) ? 'hover:bg-emerald-50' : 'bg-amber-50/60 hover:bg-amber-100') : 'text-slate-300 hover:bg-slate-50']">
              <template v-if="t.requiere[e.key]">
                <p class="font-extrabold text-slate-800">{{ e.talla ? (t.tallas[e.key] || 'S/T') : 'SI' }}</p>
                <p v-if="ultimaEntrega(t, e.key)" class="text-[10px] text-emerald-700 font-semibold">{{ formatDateForDisplay(ultimaEntrega(t, e.key).fecha) }}</p>
                <p v-else class="text-[10px] text-amber-600 font-semibold">sin entrega</p>
              </template>
              <template v-else>
                <p class="font-bold">N/A</p>
                <p v-if="ultimaEntrega(t, e.key)" class="text-[10px] text-slate-500">{{ formatDateForDisplay(ultimaEntrega(t, e.key).fecha) }}</p>
              </template>
            </td>
          </tr>
          <tr v-if="!listaTrabajadores.length"><td :colspan="ELEMENTOS_EPP.length + 2" class="p-8 text-slate-400">No hay trabajadores con este filtro.</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- ===================== HISTORIAL GENERAL ===================== -->
  <div v-if="tabEPP === 'historial'" class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <div class="p-3 border-b flex flex-wrap gap-2 items-end">
      <div><label class="block text-[10px] font-bold text-slate-500">Buscar</label><input v-model="filtroHist.texto" type="text" placeholder="Trabajador, cargo, observación..." class="p-2 border rounded-lg w-60"></div>
      <div><label class="block text-[10px] font-bold text-slate-500">Elemento</label>
        <select v-model="filtroHist.elemento" class="p-2 border rounded-lg font-bold"><option value="">Todos</option><option v-for="e in ELEMENTOS_EPP" :key="e.key" :value="e.key">{{ e.label }}</option></select></div>
      <div><label class="block text-[10px] font-bold text-slate-500">Motivo</label>
        <select v-model="filtroHist.motivo" class="p-2 border rounded-lg font-bold"><option value="">Todos</option><option v-for="m in MOTIVOS_ENTREGA" :key="m.key" :value="m.key">{{ m.label }}</option></select></div>
      <div><label class="block text-[10px] font-bold text-slate-500">Desde</label><input v-model="filtroHist.desde" type="date" class="p-2 border rounded-lg"></div>
      <div><label class="block text-[10px] font-bold text-slate-500">Hasta</label><input v-model="filtroHist.hasta" type="date" class="p-2 border rounded-lg"></div>
      <button @click="limpiarFiltroHist" class="text-slate-500 hover:text-slate-800 underline pb-2">Limpiar</button>
      <span class="ml-auto pb-2 text-slate-400 font-semibold">{{ listaHistorial.length }} registros</span>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-left">
        <thead class="bg-slate-800 text-white uppercase text-[10px]">
          <tr><th class="p-2.5">Fecha</th><th class="p-2.5">Trabajador</th><th class="p-2.5">Cargo</th><th class="p-2.5">Elemento</th><th class="p-2.5 text-center">Talla</th><th class="p-2.5 text-center">Cant.</th><th class="p-2.5">Motivo</th><th class="p-2.5">Observaciones</th><th class="p-2.5">Entregado por</th><th v-if="isAdmin" class="p-2.5"></th></tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="e in listaHistorial" :key="e.id" class="hover:bg-slate-50">
            <td class="p-2.5 whitespace-nowrap font-bold">{{ formatDateForDisplay(e.fecha) }}</td>
            <td class="p-2.5 font-bold text-slate-800"><button v-if="trabajadorDe(e.trabajadorId)" @click="abrirPerfil(trabajadorDe(e.trabajadorId))" class="hover:underline hover:text-orange-600 text-left">{{ trabajadorDe(e.trabajadorId).nombre }}</button></td>
            <td class="p-2.5 text-slate-500">{{ trabajadorDe(e.trabajadorId)?.cargo }}</td>
            <td class="p-2.5 whitespace-nowrap"><i :class="['fa-solid mr-1.5 text-orange-500', elementoEPP(e.elemento).icon]"></i>{{ elementoEPP(e.elemento).label }}</td>
            <td class="p-2.5 text-center font-bold">{{ e.talla || '-' }}</td>
            <td class="p-2.5 text-center">{{ e.cantidad }}</td>
            <td class="p-2.5 whitespace-nowrap">{{ motivoLabel(e.motivo) }}</td>
            <td class="p-2.5 max-w-[240px] truncate" :title="e.observaciones">{{ e.observaciones || '-' }}</td>
            <td class="p-2.5 text-slate-500 whitespace-nowrap">{{ e.entregadoPor || '-' }}</td>
            <td v-if="isAdmin" class="p-2.5 text-center"><button @click="eliminarEntrega(e)" title="Eliminar registro" class="text-rose-500 hover:text-rose-700"><i class="fa-solid fa-trash"></i></button></td>
          </tr>
          <tr v-if="!listaHistorial.length"><td colspan="10" class="p-8 text-center text-slate-400">Sin entregas registradas con este filtro.</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Listas de sugerencias -->
  <datalist id="dl-epp-ropa"><option v-for="t in TALLAS_ROPA" :key="t" :value="t"></option></datalist>
  <datalist id="dl-epp-calzado"><option v-for="t in TALLAS_CALZADO" :key="t" :value="t"></option></datalist>
  <datalist id="dl-epp-cargos"><option v-for="c in cargosLista" :key="c" :value="c"></option></datalist>

  <!-- ===================== MODAL PERFIL DEL TRABAJADOR ===================== -->
  <div v-if="perfilTrabajador && !trabajadorForm" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" @click.self="cerrarPerfil">
    <div class="bg-white rounded-2xl shadow-2xl border w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
      <div class="px-6 py-4 bg-slate-800 text-white flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-12 h-12 rounded-full bg-orange-500 text-slate-950 font-extrabold flex items-center justify-center shrink-0 text-base">{{ iniciales(perfilTrabajador.nombre) }}</div>
          <div class="min-w-0">
            <h3 class="text-base font-extrabold truncate">{{ perfilTrabajador.nombre }} <span v-if="!perfilTrabajador.activo" class="ml-1 px-2 py-0.5 rounded-full bg-slate-600 text-[10px] align-middle">INACTIVO</span></h3>
            <p class="text-slate-300 text-xs">{{ perfilTrabajador.cargo || 'Sin cargo' }}<span v-if="perfilTrabajador.rut"> · RUT {{ perfilTrabajador.rut }}</span></p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button v-if="puedeEditar && perfilTrabajador.activo" @click="abrirEntrega(perfilTrabajador)" class="bg-orange-500 hover:bg-orange-600 text-slate-950 font-extrabold px-3 py-2 rounded-lg text-xs"><i class="fa-solid fa-hand-holding-medical mr-1"></i>Entregar EPP</button>
          <button v-if="puedeEditar" @click="editarTrabajador(perfilTrabajador)" class="bg-white/10 hover:bg-white/20 font-bold px-3 py-2 rounded-lg text-xs border border-white/20"><i class="fa-solid fa-pen mr-1"></i>Editar</button>
          <button @click="exportarFichaTrabajador(perfilTrabajador)" :disabled="exportandoEPP" title="Ficha Excel con columna de firma" class="bg-emerald-600 hover:bg-emerald-700 font-bold px-3 py-2 rounded-lg text-xs"><i class="fa-solid fa-file-excel mr-1"></i>Ficha</button>
          <button v-if="isAdmin" @click="eliminarTrabajador(perfilTrabajador)" title="Eliminar trabajador" class="bg-rose-600 hover:bg-rose-700 px-3 py-2 rounded-lg text-xs"><i class="fa-solid fa-trash"></i></button>
          <button @click="cerrarPerfil" aria-label="Cerrar" class="w-8 h-8 rounded-md hover:bg-white/10"><i class="fa-solid fa-xmark text-lg"></i></button>
        </div>
      </div>

      <div class="overflow-y-auto p-5 space-y-5 text-xs">
        <div v-if="perfilIncompleto(perfilTrabajador)" class="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 font-semibold">
          <i class="fa-solid fa-circle-exclamation mr-1"></i> Perfil incompleto: revisa cargo, tallas y EPP requeridos (botón <b>Editar</b>).
        </div>
        <p v-if="perfilTrabajador.observaciones" class="bg-slate-50 border rounded-xl p-3 text-slate-600"><i class="fa-solid fa-note-sticky mr-1 text-slate-400"></i>{{ perfilTrabajador.observaciones }}</p>

        <!-- EPP: talla + última entrega -->
        <div>
          <h4 class="font-extrabold text-slate-700 uppercase text-[11px] mb-2"><i class="fa-solid fa-helmet-safety mr-1 text-orange-500"></i>Elementos de protección personal</h4>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <div v-for="e in ELEMENTOS_EPP" :key="e.key"
              :class="['rounded-xl border p-3 flex items-center gap-3', perfilTrabajador.requiere[e.key] ? (ultimaEntrega(perfilTrabajador, e.key) ? 'bg-white' : 'bg-amber-50 border-amber-200') : 'bg-slate-50 text-slate-400']">
              <div :class="['w-9 h-9 rounded-lg flex items-center justify-center shrink-0', perfilTrabajador.requiere[e.key] ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-400']"><i :class="['fa-solid', e.icon]"></i></div>
              <div class="min-w-0 flex-1">
                <p class="font-bold text-slate-800 truncate" :class="{ 'text-slate-400': !perfilTrabajador.requiere[e.key] }">{{ e.label }}
                  <span v-if="e.talla && perfilTrabajador.requiere[e.key]" class="ml-1 px-1.5 py-0.5 rounded bg-slate-800 text-white text-[10px]">{{ perfilTrabajador.tallas[e.key] || 'S/T' }}</span>
                  <span v-if="!perfilTrabajador.requiere[e.key]" class="ml-1 text-[10px] font-bold">N/A</span>
                </p>
                <p v-if="ultimaEntrega(perfilTrabajador, e.key)" class="text-emerald-700 font-semibold">Última: {{ formatDateForDisplay(ultimaEntrega(perfilTrabajador, e.key).fecha) }} <span class="text-slate-400 font-normal">· {{ textoDias(ultimaEntrega(perfilTrabajador, e.key).fecha) }}</span></p>
                <p v-else-if="perfilTrabajador.requiere[e.key]" class="text-amber-700 font-semibold">Sin entregas</p>
              </div>
              <button v-if="puedeEditar && perfilTrabajador.activo" @click="abrirEntrega(perfilTrabajador, e.key)" title="Entregar este elemento" class="shrink-0 w-8 h-8 rounded-lg bg-slate-100 hover:bg-orange-500 hover:text-slate-950 text-slate-500"><i class="fa-solid fa-plus"></i></button>
            </div>
          </div>
        </div>

        <!-- Historial del trabajador -->
        <div>
          <h4 class="font-extrabold text-slate-700 uppercase text-[11px] mb-2"><i class="fa-solid fa-clock-rotate-left mr-1 text-orange-500"></i>Historial de entregas ({{ entregasDe(perfilTrabajador).length }})</h4>
          <div class="border rounded-xl overflow-hidden overflow-x-auto">
            <table class="w-full text-left">
              <thead class="bg-slate-100 text-slate-600 uppercase text-[10px]">
                <tr><th class="p-2">Fecha</th><th class="p-2">Elemento</th><th class="p-2 text-center">Talla</th><th class="p-2 text-center">Cant.</th><th class="p-2">Motivo</th><th class="p-2">Observaciones</th><th class="p-2">Entregado por</th><th v-if="isAdmin" class="p-2"></th></tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="e in entregasDe(perfilTrabajador)" :key="e.id" class="hover:bg-slate-50">
                  <td class="p-2 font-bold whitespace-nowrap">{{ formatDateForDisplay(e.fecha) }}</td>
                  <td class="p-2 whitespace-nowrap"><i :class="['fa-solid mr-1.5 text-orange-500', elementoEPP(e.elemento).icon]"></i>{{ elementoEPP(e.elemento).label }}</td>
                  <td class="p-2 text-center font-bold">{{ e.talla || '-' }}</td>
                  <td class="p-2 text-center">{{ e.cantidad }}</td>
                  <td class="p-2 whitespace-nowrap">{{ motivoLabel(e.motivo) }}</td>
                  <td class="p-2">{{ e.observaciones || '-' }}</td>
                  <td class="p-2 text-slate-500 whitespace-nowrap">{{ e.entregadoPor || '-' }}</td>
                  <td v-if="isAdmin" class="p-2 text-center"><button @click="eliminarEntrega(e)" title="Eliminar registro" class="text-rose-500 hover:text-rose-700"><i class="fa-solid fa-trash"></i></button></td>
                </tr>
                <tr v-if="!entregasDe(perfilTrabajador).length"><td colspan="8" class="p-6 text-center text-slate-400">Aún no hay entregas registradas.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ===================== MODAL NUEVO / EDITAR TRABAJADOR ===================== -->
  <div v-if="trabajadorForm" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" @click.self="cancelarTrabajador">
    <div class="bg-white rounded-2xl shadow-2xl border w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden">
      <div class="px-6 py-4 border-b flex items-center justify-between bg-slate-800 text-white">
        <h3 class="text-sm font-bold"><i class="fa-solid fa-user-pen text-orange-400 mr-2"></i>{{ trabajadorForm.id ? 'Editar trabajador' : 'Nuevo trabajador' }}</h3>
        <button @click="cancelarTrabajador" aria-label="Cerrar" class="w-8 h-8 rounded-md hover:bg-white/10"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="overflow-y-auto p-5 space-y-5 text-xs">
        <div class="grid sm:grid-cols-6 gap-3">
          <div class="sm:col-span-3"><label class="block text-[10px] font-bold text-slate-500 mb-1">NOMBRE COMPLETO *</label><input v-model="trabajadorForm.nombre" type="text" class="w-full p-2 border rounded-lg uppercase font-bold"></div>
          <div class="sm:col-span-1"><label class="block text-[10px] font-bold text-slate-500 mb-1">RUT</label><input v-model="trabajadorForm.rut" type="text" placeholder="12.345.678-9" class="w-full p-2 border rounded-lg uppercase"></div>
          <div class="sm:col-span-2"><label class="block text-[10px] font-bold text-slate-500 mb-1">CARGO</label><input v-model="trabajadorForm.cargo" list="dl-epp-cargos" type="text" class="w-full p-2 border rounded-lg uppercase"></div>
          <div class="sm:col-span-5"><label class="block text-[10px] font-bold text-slate-500 mb-1">OBSERVACIONES</label><input v-model="trabajadorForm.observaciones" type="text" placeholder="Ej. alergia al látex, usa lentes ópticos..." class="w-full p-2 border rounded-lg"></div>
          <div class="sm:col-span-1 flex items-end"><label class="flex items-center gap-2 p-2 border rounded-lg w-full font-bold cursor-pointer" :class="trabajadorForm.activo ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-500'"><input v-model="trabajadorForm.activo" type="checkbox"> {{ trabajadorForm.activo ? 'Activo' : 'Inactivo' }}</label></div>
        </div>

        <div>
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h4 class="font-extrabold text-slate-700 uppercase text-[11px]"><i class="fa-solid fa-helmet-safety mr-1 text-orange-500"></i>EPP que requiere y tallas</h4>
            <div class="flex gap-3 text-[11px] font-bold">
              <button @click="copiarTallaRopa" class="text-sky-700 hover:underline" title="Copia la talla de polera (o buzo) a las prendas vacías">Misma talla en toda la ropa</button>
              <button @click="marcarTodosReq(true)" class="text-slate-500 hover:underline">Marcar todos</button>
              <button @click="marcarTodosReq(false)" class="text-slate-500 hover:underline">Ninguno</button>
            </div>
          </div>
          <div class="grid sm:grid-cols-2 gap-2">
            <div v-for="e in ELEMENTOS_EPP" :key="e.key" :class="['flex items-center gap-3 p-2.5 rounded-xl border', trabajadorForm.requiere[e.key] ? 'bg-orange-50/60 border-orange-200' : 'bg-slate-50']">
              <label class="flex items-center gap-2 flex-1 cursor-pointer font-bold text-slate-700">
                <input v-model="trabajadorForm.requiere[e.key]" type="checkbox" class="w-4 h-4 accent-orange-500">
                <i :class="['fa-solid w-4 text-center text-orange-500', e.icon]"></i>{{ e.label }}
              </label>
              <input v-if="e.talla" v-model="trabajadorForm.tallas[e.key]" :disabled="!trabajadorForm.requiere[e.key]" :list="e.tipo === 'num' ? 'dl-epp-calzado' : 'dl-epp-ropa'" type="text"
                :placeholder="e.tipo === 'num' ? 'N°' : 'Talla'" class="w-20 p-1.5 border rounded-lg text-center uppercase font-bold disabled:bg-slate-100 disabled:text-slate-300">
            </div>
          </div>
        </div>
      </div>
      <div class="px-6 py-3 border-t bg-slate-50 flex justify-end gap-2">
        <button @click="cancelarTrabajador" class="px-4 py-2 rounded-lg border font-bold text-slate-600 hover:bg-white">Cancelar</button>
        <button @click="guardarTrabajador" :disabled="guardandoTrab" class="px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-slate-950 font-extrabold disabled:opacity-60"><i :class="['fa-solid mr-1', guardandoTrab ? 'fa-spinner fa-spin' : 'fa-floppy-disk']"></i>Guardar</button>
      </div>
    </div>
  </div>

  <!-- ===================== MODAL ENTREGAR EPP ===================== -->
  <div v-if="entregaForm && trabajadorEntrega" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4" @click.self="cerrarEntrega">
    <div class="bg-white rounded-2xl shadow-2xl border w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden">
      <div class="px-6 py-4 border-b flex items-center justify-between bg-orange-500 text-slate-950">
        <div>
          <h3 class="text-sm font-extrabold"><i class="fa-solid fa-hand-holding-medical mr-2"></i>Entregar EPP</h3>
          <p class="text-xs font-semibold opacity-80">{{ trabajadorEntrega.nombre }} · {{ trabajadorEntrega.cargo || 'Sin cargo' }}</p>
        </div>
        <button @click="cerrarEntrega" aria-label="Cerrar" class="w-8 h-8 rounded-md hover:bg-black/10"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="overflow-y-auto p-5 space-y-4 text-xs">
        <div class="grid sm:grid-cols-4 gap-3">
          <div><label class="block text-[10px] font-bold text-slate-500 mb-1">FECHA DE ENTREGA *</label><input v-model="entregaForm.fecha" type="date" class="w-full p-2 border rounded-lg font-bold"></div>
          <div><label class="block text-[10px] font-bold text-slate-500 mb-1">MOTIVO</label>
            <select v-model="entregaForm.motivo" class="w-full p-2 border rounded-lg font-bold"><option v-for="m in MOTIVOS_ENTREGA.filter(x => x.key !== 'HISTORICO')" :key="m.key" :value="m.key">{{ m.label }}</option></select></div>
          <div class="sm:col-span-2"><label class="block text-[10px] font-bold text-slate-500 mb-1">OBSERVACIONES</label><input v-model="entregaForm.observaciones" type="text" placeholder="Opcional" class="w-full p-2 border rounded-lg"></div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2">
          <h4 class="font-extrabold text-slate-700 uppercase text-[11px]">Elementos entregados ({{ seleccionadosEntrega.length }})</h4>
          <div class="flex gap-3 text-[11px] font-bold">
            <button @click="marcarTodosEntrega(true)" class="text-slate-500 hover:underline">Marcar todos</button>
            <button @click="marcarTodosEntrega(false)" class="text-slate-500 hover:underline">Ninguno</button>
            <label class="flex items-center gap-1 text-sky-700 cursor-pointer"><input v-model="entregaForm.verTodos" type="checkbox"> Mostrar también los que no requiere</label>
          </div>
        </div>
        <div class="border rounded-xl divide-y">
          <div v-for="i in itemsEntregaVisibles" :key="i.key" :class="['flex flex-wrap items-center gap-3 px-3 py-2', i.sel ? 'bg-orange-50' : '']">
            <label class="flex items-center gap-2 flex-1 min-w-[200px] cursor-pointer">
              <input v-model="i.sel" type="checkbox" class="w-4 h-4 accent-orange-500">
              <i :class="['fa-solid w-4 text-center text-orange-500', elementoEPP(i.key).icon]"></i>
              <span class="font-bold text-slate-800">{{ elementoEPP(i.key).label }}</span>
              <span v-if="!trabajadorEntrega.requiere[i.key]" class="text-[10px] font-bold text-slate-400">(no requerido)</span>
            </label>
            <span class="text-[11px] text-slate-500 w-36">
              <template v-if="ultimaEntrega(trabajadorEntrega, i.key)">Última: {{ formatDateForDisplay(ultimaEntrega(trabajadorEntrega, i.key).fecha) }}</template>
              <span v-else class="text-amber-600">Nunca entregado</span>
            </span>
            <input v-if="elementoEPP(i.key).talla" v-model="i.talla" :list="elementoEPP(i.key).tipo === 'num' ? 'dl-epp-calzado' : 'dl-epp-ropa'" type="text" placeholder="Talla" class="w-16 p-1.5 border rounded-lg text-center uppercase font-bold">
            <span v-else class="w-16"></span>
            <div class="flex items-center gap-1"><span class="text-[10px] text-slate-400 font-bold">CANT.</span><input v-model.number="i.cantidad" type="number" min="1" class="w-14 p-1.5 border rounded-lg text-center font-bold"></div>
          </div>
          <p v-if="!itemsEntregaVisibles.length" class="p-4 text-center text-slate-400">Este trabajador no tiene EPP requeridos. Marca "Mostrar también los que no requiere".</p>
        </div>
        <label class="flex items-center gap-2 text-slate-600 cursor-pointer"><input v-model="entregaForm.actualizarTallas" type="checkbox"> Si entrego otra talla (o un elemento no requerido), actualizar el perfil del trabajador</label>
      </div>
      <div class="px-6 py-3 border-t bg-slate-50 flex items-center justify-between gap-2">
        <span class="text-slate-500">Registrado por: <b>{{ usuarioActivo?.nombre }}</b></span>
        <div class="flex gap-2">
          <button @click="cerrarEntrega" class="px-4 py-2 rounded-lg border font-bold text-slate-600 hover:bg-white">Cancelar</button>
          <button @click="guardarEntrega" :disabled="guardandoEntrega || !seleccionadosEntrega.length" class="px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-slate-950 font-extrabold disabled:opacity-60"><i :class="['fa-solid mr-1', guardandoEntrega ? 'fa-spinner fa-spin' : 'fa-check']"></i>Registrar entrega</button>
        </div>
      </div>
    </div>
  </div>
</section>
`;
