// Plantilla HTML del componente 'aceites' (extraída del index original)
export default /* html */ `
<section class="space-y-6">
  <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
    <div class="flex flex-wrap justify-between items-center gap-3 border-b pb-3">
      <div>
        <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-oil-can text-amber-600"></i> Control y Filtros de Aceites e Insumos</h2>
        <p class="text-xs text-slate-500">Visualiza el consumo general de aceites y aplica filtros por fechas y equipos.</p>
      </div>
      <div class="flex items-center gap-2">
        <label class="text-xs font-bold text-slate-700">Orden:</label>
        <select v-model="sortAceitesOrder" class="p-1.5 border rounded text-xs font-bold bg-slate-50">
          <option value="desc">Más Recientes</option>
          <option value="asc">Más Antiguos</option>
        </select>
        <button @click="exportarCSV(filteredAceitesRecords, 'Reporte_Consumo_Aceites')" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition shadow flex items-center gap-1.5"><i class="fa-solid fa-file-excel"></i> Exportar Excel</button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-xl border">
      <div><label class="block font-bold text-slate-700 mb-1">Fecha Desde</label><input type="date" v-model="filterOil.dateStart" class="w-full p-2 border rounded-lg bg-white"></div>
      <div><label class="block font-bold text-slate-700 mb-1">Fecha Hasta</label><input type="date" v-model="filterOil.dateEnd" class="w-full p-2 border rounded-lg bg-white"></div>
      <div>
        <label class="block font-bold text-slate-700 mb-1">Equipo AFI</label>
        <select v-model="filterOil.afi" class="w-full p-2 border rounded-lg bg-white font-semibold">
          <option value="ALL">-- Todos --</option>
          <option v-for="e in dbEquipos" :key="e.id" :value="e.afi">AFI {{ e.afi }} - {{ e.tipo }}</option>
        </select>
      </div>
      <div>
        <label class="block font-bold text-slate-700 mb-1">Tipo de Aceite / Insumo</label>
        <select v-model="filterOil.tipoAceite" class="w-full p-2 border rounded-lg bg-white font-semibold text-amber-800">
          <option value="ALL">-- Todos --</option>
          <option v-for="t in listaTiposAceitesDisponibles" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between">
        <div><p class="text-[11px] font-bold uppercase text-amber-800">Registros con Consumo</p><h3 class="text-2xl font-bold text-amber-900 mt-1">{{ filteredAceitesRecords.length }}</h3></div>
        <div class="w-10 h-10 rounded-full bg-amber-200/60 text-amber-700 flex items-center justify-center text-lg"><i class="fa-solid fa-clipboard-list"></i></div>
      </div>
      <div class="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between">
        <div><p class="text-[11px] font-bold uppercase text-blue-800">Suma Total Cantidad</p><h3 class="text-xl font-bold text-blue-900 mt-1 font-mono">{{ sumaTotalLitrosAceites.toLocaleString('es-CL', { maximumFractionDigits: 2 }) }} L</h3></div>
        <div class="w-10 h-10 rounded-full bg-blue-200/60 text-blue-700 flex items-center justify-center text-lg"><i class="fa-solid fa-calculator"></i></div>
      </div>
      <div class="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between">
        <div><p class="text-[11px] font-bold uppercase text-emerald-800">Costo Total</p><h3 class="text-xl font-bold text-emerald-900 mt-1">\${{ costoTotalAceitesFiltrados.toLocaleString('es-CL') }}</h3></div>
        <div class="w-10 h-10 rounded-full bg-emerald-200/60 text-emerald-700 flex items-center justify-center text-lg"><i class="fa-solid fa-dollar-sign"></i></div>
      </div>
    </div>
  </div>

  <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
    <h3 class="text-xs font-bold uppercase text-slate-700 flex items-center gap-2"><i class="fa-solid fa-list-check text-blue-600"></i> Detalle de Consumos</h3>
    <div class="overflow-x-auto border rounded-lg max-h-[500px]">
      <table class="w-full text-left text-xs border-collapse">
        <thead class="bg-slate-800 text-white sticky top-0 uppercase text-[10px]">
          <tr>
            <th class="p-2.5">FECHA</th>
            <th class="p-2.5">AFI</th>
            <th class="p-2.5">EQUIPO</th>
            <th class="p-2.5">LUGAR</th>
            <th class="p-2.5">CAUSA / TIPO</th>
            <th class="p-2.5 text-amber-300">DETALLE DE ACEITES E INSUMOS</th>
            <th class="p-2.5 text-right">COSTO</th>
          </tr>
        </thead>
        <tbody class="divide-y bg-white">
          <tr v-for="item in filteredAceitesRecords" :key="item.id" class="hover:bg-slate-50">
            <td class="p-2.5 font-mono text-slate-700 font-bold bg-amber-50/40">{{ formatDateForDisplay(item.fecha) }}</td>
            <td class="p-2.5 font-bold text-amber-700"><button @click="verDetallePorAfiString(item.afi)" class="bg-amber-50 px-2 py-0.5 rounded border border-amber-200 hover:underline">{{ item.afi }}</button></td>
            <td class="p-2.5 font-semibold">{{ item.equipo || '-' }}</td>
            <td class="p-2.5 text-slate-600">{{ item.lugar || '-' }}</td>
            <td class="p-2.5"><span class="font-bold block text-slate-800">{{ item.causa }}</span><span class="text-[10px] text-blue-600">{{ item.tipoMant }}</span></td>
            <td class="p-2.5 font-bold text-amber-900 bg-amber-50/50">{{ item.aceites }}</td>
            <td class="p-2.5 font-bold text-emerald-700 text-right">\${{ Number(item.costo || 0).toLocaleString('es-CL') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>
`;
