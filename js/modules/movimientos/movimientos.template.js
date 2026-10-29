// Plantilla HTML del componente 'movimientos' (extraída del index original)
export default /* html */ `
<section class="space-y-4">
  <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
    <div class="flex flex-wrap justify-between items-center gap-3">
      <div class="flex items-center gap-3">
        <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-filter text-amber-500"></i> Búsqueda & Filtros de Movimientos</h2>
        <div class="flex items-center gap-2">
          <label class="text-xs font-bold text-slate-700">Orden:</label>
          <select v-model="sortMovimientosOrder" class="p-1.5 border rounded text-xs font-bold bg-slate-50">
            <option value="desc">Más Recientes</option>
            <option value="asc">Más Antiguos</option>
          </select>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button v-if="isAdmin" @click="abrirModalCrearMovimiento" class="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold px-3 py-2 rounded-lg transition shadow flex items-center gap-1.5"><i class="fa-solid fa-plus-circle"></i> Registrar Movimiento</button>
        <button @click="limpiarFiltrosMovimientos" class="text-xs text-slate-500 hover:text-slate-800 underline mx-1">Limpiar Filtros</button>
        <button @click="exportarCSV(filteredMovimientos, 'Movimientos_Filtrados')" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow"><i class="fa-solid fa-file-excel"></i> Exportar Excel</button>
      </div>
    </div>
    
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 text-xs pt-1">
      <div class="md:col-span-2"><label class="block font-bold mb-1 text-slate-700">Buscar por Texto</label><input type="text" v-model="filterMov.queryText" placeholder="Escribe para buscar..." class="w-full p-2 border rounded-lg bg-slate-50 font-bold"></div>
      <div><label class="block font-bold mb-1">Fecha Desde</label><input type="date" v-model="filterMov.dateStart" class="w-full p-2 border rounded-lg"></div>
      <div><label class="block font-bold mb-1">Fecha Hasta</label><input type="date" v-model="filterMov.dateEnd" class="w-full p-2 border rounded-lg"></div>
      <div>
        <label class="block font-bold mb-1">AFI Equipo</label>
        <select v-model="filterMov.afi" class="w-full p-2 border rounded-lg font-bold">
          <option value="ALL">-- Todos los AFI --</option>
          <option v-for="e in dbEquipos" :key="e.id" :value="e.afi">{{ e.afi }} - {{ e.tipo }}</option>
        </select>
      </div>
      <div class="flex items-end"><button class="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold p-2 rounded-lg shadow flex items-center justify-center gap-1.5"><i class="fa-solid fa-magnifying-glass"></i> Buscar</button></div>
    </div>
  </div>

  <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
    <div class="overflow-x-auto border rounded-lg max-h-[600px]">
      <table class="w-full text-left text-xs border-collapse">
        <thead class="bg-slate-800 text-white sticky top-0 uppercase text-[10px]">
          <tr>
            <th class="p-2.5">FECHA</th>
            <th class="p-2.5">AFI</th>
            <th class="p-2.5">TIPO</th>
            <th class="p-2.5">ORIGEN</th>
            <th class="p-2.5">DESTINO</th>
            <th class="p-2.5">EMPRESA ARRIENDO</th>
            <th class="p-2.5">ESTADO</th>
            <th class="p-2.5">CAMIÓN ENCARGADO</th>
            <th class="p-2.5">CONDUCTOR</th>
          </tr>
        </thead>
        <tbody class="divide-y bg-white">
          <tr v-for="m in filteredMovimientos" :key="m.id" class="hover:bg-slate-50">
            <td class="p-2.5 font-mono font-bold text-slate-800 bg-amber-50/30">{{ formatDateForDisplay(m.fecha) }}</td>
            <td class="p-2.5 font-bold text-amber-700 cursor-pointer hover:underline" @click="verDetallePorAfiString(m.afi)">{{ m.afi }}</td>
            <td class="p-2.5 font-semibold">{{ m.tipo }}</td>
            <td class="p-2.5 text-slate-600">{{ m.origen || '-' }}</td>
            <td class="p-2.5 font-bold text-emerald-700 bg-emerald-50/50">{{ m.destino || '-' }}</td>
            <td class="p-2.5 font-semibold text-blue-700">{{ m.empresa_arriendo || '-' }}</td>
            <td class="p-2.5">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                {{ m.estado || '-' }}
              </span>
            </td>
            <td class="p-2.5">{{ m.camion || '-' }}</td>
            <td class="p-2.5 font-semibold">{{ m.conductor || '-' }}</td>
          </tr>
          <tr v-if="filteredMovimientos.length === 0"><td colspan="9" class="p-8 text-center text-slate-500 font-bold">No se encontraron movimientos.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</section>
`;
