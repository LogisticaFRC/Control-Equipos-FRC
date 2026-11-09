// Plantilla HTML del componente 'historial' (extraída del index original)
export default /* html */ `
<section class="space-y-4">
  <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
    <div class="flex flex-wrap justify-between items-center gap-3 border-b pb-2">
      <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-filter text-blue-600"></i> Historial Completo (Cargados: {{ dbIntervenciones.length }} registros)</h2>
      <div class="flex items-center gap-2">
        <label class="text-xs font-bold text-slate-700">Orden:</label>
        <select v-model="sortHistorialOrder" class="p-1.5 border rounded text-xs font-bold bg-slate-50">
          <option value="desc">Más Recientes primero</option>
          <option value="asc">Más Antiguos primero</option>
        </select>
        <button @click="limpiarFiltrosHistorial" class="text-xs text-slate-500 hover:text-slate-800 underline mx-2">Limpiar Filtros</button>
        <button v-if="puedeEditar" @click="abrirFormularioNuevaMantencion()" class="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold px-3 py-1.5 rounded-lg transition shadow flex items-center gap-1.5"><i class="fa-solid fa-plus-circle"></i> + Registrar Mantención</button>
        <button v-if="puedeEditar" @click="abrirCargaDocs" class="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow flex items-center gap-1.5" title="Subir muchos PDF de una vez y enlazarlos a su mantención / intervención"><i class="fa-solid fa-folder-open text-amber-400"></i> Cargar documentos</button>
        <button v-if="puedeEditar && pendientesCompletar.length" @click="abrirCola" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow flex items-center gap-1.5" title="Recorre uno por uno los registros que tienen documento pero les falta descripción, mecánicos u horómetro (con la hoja al lado)"><i class="fa-solid fa-list-check"></i> Completar pendientes <span class="bg-white/25 px-1.5 rounded-full">{{ pendientesCompletar.length }}</span></button>
        <button @click="exportarCSV(filteredIntervenciones, 'HojaVida_Filtrada')" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow"><i class="fa-solid fa-file-excel"></i> Exportar Excel</button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 text-xs pt-1">
      <div class="lg:col-span-2">
        <label class="block font-bold mb-1 text-slate-700">Búsqueda General</label>
        <div class="relative">
          <input type="text" v-model="filterInt.searchQuery" placeholder="Escribe cualquier palabra..." class="w-full p-2 pl-8 border rounded-lg bg-amber-50/50 focus:bg-white font-bold text-slate-800">
          <i class="fa-solid fa-magnifying-glass absolute left-2.5 top-2.5 text-slate-400"></i>
        </div>
      </div>
      <div><label class="block font-bold mb-1">Fecha Desde</label><input type="date" v-model="filterInt.dateStart" class="w-full p-2 border rounded-lg"></div>
      <div><label class="block font-bold mb-1">Fecha Hasta</label><input type="date" v-model="filterInt.dateEnd" class="w-full p-2 border rounded-lg"></div>
      <div>
        <label class="block font-bold mb-1">Filtrar por AFI</label>
        <select v-model="filterInt.afi" class="w-full p-2 border border-amber-300 bg-amber-50 font-bold rounded-lg">
          <option value="ALL">-- Todos los AFI --</option>
          <option v-for="e in dbEquipos" :key="e.id" :value="e.afi">AFI {{ e.afi }} - {{ e.tipo }}</option>
        </select>
      </div>
      <div>
        <label class="block font-bold mb-1">Programa</label>
        <select v-model="filterInt.programa" class="w-full p-2 border rounded-lg font-bold text-indigo-700 bg-indigo-50">
          <option value="ALL">-- Todos --</option>
          <option v-for="p in dbProgramasCalendarios" :key="p.id" :value="p.nombre_programa || p.mes">[{{ p.carpeta || p.tipo }}] {{ p.nombre_programa || p.mes }}</option>
        </select>
      </div>
      <div>
        <label class="block font-bold mb-1">Tipo Mantención</label>
        <select v-model="filterInt.tipoMant" class="w-full p-2 border rounded-lg font-semibold">
          <option value="ALL">-- Todos --</option>
          <option value="PREVENTIVA">PREVENTIVA</option>
          <option value="PREDICTIVA">PREDICTIVA</option>
          <option value="CORRECTIVA">CORRECTIVA</option>
        </select>
      </div>
      <div>
        <label class="block font-bold mb-1">Causa</label>
        <select v-model="filterInt.causa" class="w-full p-2 border rounded-lg">
          <option value="ALL">-- Todas --</option>
          <option v-for="c in listaCausas" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
    </div>
  </div>

  <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-2">
    <p class="text-[11px] text-slate-500"><i class="fa-solid fa-hand-pointer mr-1"></i>{{ filteredIntervenciones.length }} registros · haz clic en una fila para ver todos sus datos (mecánicos, filtros, OC, OT, aceites…).</p>
    <tabla-historial :registros="filteredIntervenciones" mostrar-afi :abrir-ot="irAOT"></tabla-historial>
  </div>
  <carga-documentos></carga-documentos>
</section>
`;
