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

  <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
    <div class="overflow-x-auto border rounded-lg max-h-[600px]">
      <table class="w-full text-left text-[11px] whitespace-nowrap border-collapse">
        <thead class="bg-slate-800 text-white sticky top-0 uppercase">
          <tr>
            <th v-if="puedeEditar" class="p-2 text-center">ACCIONES</th>
            <th class="p-2">AFI</th>
            <th class="p-2">FECHA MANT.</th>
            <th class="p-2 text-indigo-300">PROGRAMA CORRESPONDIENTE</th>
            <th class="p-2">EQUIPO</th>
            <th class="p-2">LUGAR</th>
            <th class="p-2">CAUSA</th>
            <th class="p-2">TIPO MANT.</th>
            <th class="p-2 text-amber-300">TIPO EN HORAS (H)</th>
            <th class="p-2 bg-amber-900 text-amber-200 font-bold">ÚLTIMO HORÓMETRO TOMADO</th>
            <th class="p-2 bg-amber-900 text-amber-200 font-bold">FECHA HORÓMETRO</th>
            <th class="p-2">MECÁNICOS</th>
            <th class="p-2 text-sky-300">INICIO HORA</th>
            <th class="p-2 text-sky-300">TÉRMINO HORA</th>
            <th class="p-2 text-amber-300">TOTAL HORAS</th>
            <th class="p-2 text-emerald-300">FILTROS UTILIZADOS</th>
            <th class="p-2">CAUSA DETALLADA</th>
            <th class="p-2">DESCRIPCIÓN</th>
            <th class="p-2">INTERFERENCIA</th>
            <th class="p-2">EMPRESA</th>
            <th class="p-2">COSTO</th>
            <th class="p-2">N° OC</th>
            <th class="p-2">N° OT</th>
            <th class="p-2 text-amber-300">CONSUMO ACEITES</th>
            <th class="p-2 text-center">LINK</th>
          </tr>
        </thead>
        <tbody class="divide-y bg-white">
          <tr v-for="i in filteredIntervenciones" :key="i.id" class="hover:bg-slate-50">
            <td v-if="puedeEditar" class="p-2 text-center space-x-1">
              <button @click="editarMantencion(i)" class="bg-amber-100 hover:bg-amber-200 text-amber-800 p-1 rounded font-bold" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
              <button v-if="isAdmin" @click="eliminarMantencion(i.id)" class="bg-rose-100 hover:bg-rose-200 text-rose-800 p-1 rounded font-bold" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
            </td>
            <td class="p-2 font-bold text-amber-700"><button @click="verDetallePorAfiString(i.afi)" class="hover:underline bg-amber-50 px-2 rounded">{{ i.afi }}</button></td>
            <td class="p-2 font-mono font-bold text-slate-800 bg-amber-50/50">{{ formatDateForDisplay(i.fecha) }}</td>
            <td class="p-2 font-bold text-indigo-700 bg-indigo-50/40">{{ i.programaCorrespondiente || '-' }}</td>
            <td class="p-2 font-semibold">{{ i.equipo || '-' }}</td>
            <td class="p-2">{{ i.lugar || '-' }}</td>
            <td class="p-2 font-bold">{{ i.causa || '-' }}</td>
            <td class="p-2 font-semibold text-blue-600">{{ i.tipoMant || '-' }}</td>
            <td class="p-2 font-bold text-amber-900 bg-amber-50">{{ i.tipoHorasMant || '-' }}</td>
            <td class="p-2 font-mono font-bold text-amber-900 bg-amber-100/60">{{ i.horometro ? i.horometro + ' hrs' : '-' }}</td>
            <td class="p-2 font-mono font-bold text-amber-900 bg-amber-100/60">{{ formatDateForDisplay(i.fecha) }}</td>
            <td class="p-2">{{ getMecanicosText(i) }}</td>
            <td class="p-2 font-mono text-sky-700 font-semibold bg-sky-50/50">{{ i.horaInicio || '-' }}</td>
            <td class="p-2 font-mono text-sky-700 font-semibold bg-sky-50/50">{{ i.horaTermino || '-' }}</td>
            <td class="p-2 font-mono font-bold text-amber-900 bg-amber-50">{{ i.horaTotal || '-' }}</td>
            <td class="p-2 text-emerald-800 font-bold bg-emerald-50/50">{{ i.filtrosTexto || 'Sin filtros' }}</td>
            <td class="p-2 max-w-xs truncate">{{ i.causaDetallada || '-' }}</td>
            <td class="p-2 max-w-xs truncate">{{ i.descripcion || '-' }}</td>
            <td class="p-2">{{ i.interferencia || '-' }}</td>
            <td class="p-2">{{ i.empresaArriendo || '-' }}</td>
            <td class="p-2 font-bold text-emerald-700">\${{ Number(i.costo || 0).toLocaleString('es-CL') }}</td>
            <td class="p-2 font-mono">{{ i.numeroOC || '-' }}</td>
            <td class="p-2 font-mono">{{ i.numeroOT || '-' }}</td>
            <td class="p-2 text-amber-800 font-bold bg-amber-50">{{ i.aceites }}</td>
            <td class="p-2 text-center">
              <a v-if="i.linkDrive" :href="i.linkDrive" target="_blank" class="bg-blue-100 text-blue-800 hover:bg-blue-200 px-2 py-1 rounded font-bold text-[10px] inline-flex items-center gap-1"><i class="fa-solid fa-link"></i> Drive</a>
              <span v-else class="text-slate-400 italic">-</span>
            </td>
          </tr>
          <tr v-if="filteredIntervenciones.length === 0"><td colspan="25" class="p-8 text-center text-slate-500 font-bold">No se encontraron registros.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</section>
`;
