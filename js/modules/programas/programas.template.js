// Plantilla HTML del componente 'programas' (extraída del index original)
export default /* html */ `
<section class="space-y-4">
  <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
    <div>
      <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-calendar-check text-rose-500"></i> PROGRAMAS - Planificación y Carta Gantt</h2>
      <p class="text-xs text-slate-500 mt-1">Crea programas de Reparación o Mantención con sus rangos de fechas generales y asigna equipos.</p>
    </div>
    <div class="flex flex-wrap items-center gap-2.5">
      <button v-if="progSelect.id" @click="exportarProgramaGanttExcel(progSelect)" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition shadow flex items-center gap-2">
        <i class="fa-solid fa-file-excel text-sm"></i> Exportar Programa (Excel)
      </button>
      <template v-if="isAdmin">
        <div class="flex items-center gap-1.5">
          <button @click="abrirModalCrearPrograma('REPARACION')" class="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold px-3 py-2.5 rounded-xl transition shadow flex items-center gap-1.5">
            <i class="fa-solid fa-wrench text-sm"></i> + Programa Reparación
          </button>
          <button @click="abrirModalCrearPrograma('MANTENCION')" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-3 py-2.5 rounded-xl transition shadow flex items-center gap-1.5">
            <i class="fa-solid fa-oil-can text-sm"></i> + Programa Mantención
          </button>
        </div>
        <button @click="abrirModalAsignarEquipo" class="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition shadow flex items-center gap-2">
          <i class="fa-solid fa-truck-monster text-sm"></i> Asignar Equipo
        </button>
      </template>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
    <!-- Sidebar: Listado por Carpetas (Reparación / Mantención) -->
    <div class="lg:col-span-1 bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-[680px] overflow-y-auto space-y-4">
      <h3 class="text-xs font-bold text-slate-800 uppercase border-b pb-2 flex items-center justify-between">
        <span><i class="fa-solid fa-folder-tree text-amber-500"></i> Programas por Tipo</span>
        <span class="text-[10px] text-slate-400 font-mono">Global: {{ cumplimientoGlobalTotal }}%</span>
      </h3>

      <!-- Carpeta REPARACIÓN -->
      <div class="space-y-1">
        <div @click="toggleFolder('REPARACION')" class="font-bold text-xs text-slate-800 bg-amber-50 border border-amber-200 p-2.5 rounded cursor-pointer hover:bg-amber-100 flex justify-between items-center shadow-sm">
          <span><i class="fa-solid fa-wrench text-amber-600 mr-1.5"></i> REPARACIÓN ({{ obtenerProgramasDeCarpeta('REPARACION').length }})</span>
          <i :class="['fa-solid text-slate-500 text-[10px]', openFolders['REPARACION'] ? 'fa-chevron-down' : 'fa-chevron-right']"></i>
        </div>
        <div v-show="openFolders['REPARACION']" class="pl-3 pr-1 space-y-1.5 border-l-2 border-amber-200 ml-2 pt-1 pb-2">
          <div v-for="prog in obtenerProgramasDeCarpeta('REPARACION')" :key="prog.id" :class="['p-2.5 rounded border transition text-[11px] space-y-1', (progSelect.id === prog.id) ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-sm font-bold' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100']">
            <div @click="seleccionarProgramaObj(prog)" class="cursor-pointer flex items-center justify-between">
              <span class="truncate"><i class="fa-solid fa-calendar-days opacity-70 mr-1 text-amber-600"></i> {{ prog.nombre_programa || prog.mes }}</span>
              <div class="flex items-center gap-1">
                <span class="bg-white border px-1.5 py-0.5 rounded text-[9px]">{{ obtenerItemsPrograma(prog.id).length }}</span>
                <button v-if="isAdmin" @click.stop="eliminarProgramaCompleto(prog.id)" class="text-rose-500 hover:text-rose-700 p-1" title="Eliminar programa"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
            <div class="text-[9px] font-mono text-slate-500 flex justify-between">
              <span>Del {{ formatDateForDisplay(prog.fecha_inicio_programa) }}</span>
              <span>Al {{ formatDateForDisplay(prog.fecha_termino_programa) }}</span>
            </div>
          </div>
          <div v-if="obtenerProgramasDeCarpeta('REPARACION').length === 0" class="text-[10px] text-slate-400 italic p-1">No hay programas de reparación.</div>
        </div>
      </div>

      <!-- Carpeta MANTENCIÓN -->
      <div class="space-y-1">
        <div @click="toggleFolder('MANTENCION')" class="font-bold text-xs text-slate-800 bg-indigo-50 border border-indigo-200 p-2.5 rounded cursor-pointer hover:bg-indigo-100 flex justify-between items-center shadow-sm">
          <span><i class="fa-solid fa-oil-can text-indigo-600 mr-1.5"></i> MANTENCIÓN ({{ obtenerProgramasDeCarpeta('MANTENCION').length }})</span>
          <i :class="['fa-solid text-slate-500 text-[10px]', openFolders['MANTENCION'] ? 'fa-chevron-down' : 'fa-chevron-right']"></i>
        </div>
        <div v-show="openFolders['MANTENCION']" class="pl-3 pr-1 space-y-1.5 border-l-2 border-indigo-200 ml-2 pt-1 pb-2">
          <div v-for="prog in obtenerProgramasDeCarpeta('MANTENCION')" :key="prog.id" :class="['p-2.5 rounded border transition text-[11px] space-y-1', (progSelect.id === prog.id) ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-sm font-bold' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100']">
            <div @click="seleccionarProgramaObj(prog)" class="cursor-pointer flex items-center justify-between">
              <span class="truncate"><i class="fa-solid fa-calendar-days opacity-70 mr-1 text-indigo-600"></i> {{ prog.nombre_programa || prog.mes }}</span>
              <div class="flex items-center gap-1">
                <span class="bg-white border px-1.5 py-0.5 rounded text-[9px]">{{ obtenerItemsPrograma(prog.id).length }}</span>
                <button v-if="isAdmin" @click.stop="eliminarProgramaCompleto(prog.id)" class="text-rose-500 hover:text-rose-700 p-1" title="Eliminar programa"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
            <div class="text-[9px] font-mono text-slate-500 flex justify-between">
              <span>Del {{ formatDateForDisplay(prog.fecha_inicio_programa) }}</span>
              <span>Al {{ formatDateForDisplay(prog.fecha_termino_programa) }}</span>
            </div>
          </div>
          <div v-if="obtenerProgramasDeCarpeta('MANTENCION').length === 0" class="text-[10px] text-slate-400 italic p-1">No hay programas de mantención.</div>
        </div>
      </div>

    </div>

    <!-- Main Panel: Detalles y Vista Calendario / Gantt o Tabla de Mantención -->
    <div class="lg:col-span-3 bg-white p-5 rounded-xl shadow-sm border border-slate-200 h-[680px] flex flex-col">
      <template v-if="progSelect.id">
        <div class="border-b pb-4 mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span :class="['text-[10px] font-extrabold uppercase px-2.5 py-1 rounded', progSelect.carpeta === 'REPARACION' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800']">
              <i :class="['fa-solid mr-1', progSelect.carpeta === 'REPARACION' ? 'fa-wrench' : 'fa-oil-can']"></i> {{ progSelect.carpeta }}
            </span>
            <h3 class="text-lg font-extrabold text-slate-800 flex items-center gap-2 mt-1"><i class="fa-solid fa-calendar-days text-rose-500"></i> Programa: {{ progSelect.nombre_programa || progSelect.mes }}</h3>
            <p class="text-xs font-mono font-bold text-slate-600 mt-0.5"><i class="fa-solid fa-clock mr-1"></i> Vigencia Programa: {{ formatDateForDisplay(progSelect.fecha_inicio_programa) }} al {{ formatDateForDisplay(progSelect.fecha_termino_programa) }}</p>
          </div>
          <div class="flex-grow max-w-xs space-y-1 text-right">
            <div class="flex justify-between text-[10px] font-bold text-slate-600 uppercase"><span>Cumplimiento:</span> <span>{{ getProgreso(progSelect.id).pct }}%</span></div>
            <div class="w-full bg-slate-200 rounded-full h-2.5 shadow-inner overflow-hidden">
              <div class="bg-emerald-500 h-2.5 rounded-full transition-all duration-500" :style="{ width: getProgreso(progSelect.id).pct + '%' }"></div>
            </div>
            <div class="text-[9px] text-slate-500 font-semibold">{{ getProgreso(progSelect.id).done }} de {{ getProgreso(progSelect.id).total }} equipos realizados</div>
          </div>
        </div>

        <!-- Pestañas de Vista: Solo se muestra si es Reparación -->
        <div v-if="progSelect.carpeta === 'REPARACION'" class="flex items-center gap-2 mb-3 border-b pb-2">
          <button @click="vistaProgramaMode = 'tabla'" :class="['px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5', vistaProgramaMode === 'tabla' ? 'bg-slate-800 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200']">
            <i class="fa-solid fa-list"></i> Vista de Tabla por Naves (ON/OFF)
          </button>
          <button @click="vistaProgramaMode = 'calendario'" :class="['px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5', vistaProgramaMode === 'calendario' ? 'bg-slate-800 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200']">
            <i class="fa-solid fa-calendar-week"></i> Vista Calendario / Gantt por Naves
          </button>
        </div>

        <!-- CONTENIDO PARA PROGRAMA DE MANTENCIÓN (SIN NAVE: TABLA DIRECTA) -->
        <div v-if="progSelect.carpeta === 'MANTENCION'" class="flex-grow overflow-y-auto space-y-4">
          <div class="bg-indigo-900 text-white px-3 py-2 rounded-lg text-xs font-extrabold uppercase flex justify-between items-center shadow-sm">
            <span><i class="fa-solid fa-oil-can mr-1.5 text-indigo-300"></i> Listado de Equipos - Programa de Mantención</span>
            <span class="text-[10px] font-mono bg-white/20 px-2.5 py-0.5 rounded">{{ obtenerItemsPrograma(progSelect.id).length }} equipos</span>
          </div>
          
          <table class="w-full text-left text-xs whitespace-nowrap bg-white rounded-lg overflow-hidden border shadow-sm">
            <thead class="bg-indigo-50 text-indigo-950 uppercase text-[10px]">
              <tr>
                <th class="p-2.5">EQUIPO AFI</th>
                <th class="p-2.5">TIPO EQUIPO</th>
                <th class="p-2.5">MARCA / MODELO</th>
                <th class="p-2.5 text-indigo-800 font-bold">FECHA PROGRAMADA (FIJA)</th>
                <th class="p-2.5 text-emerald-800 font-bold">FECHA REALIZADA</th>
                <th class="p-2.5 text-amber-800 font-bold">HORÓMETRO REALIZADO</th>
                <th class="p-2.5 text-center">ESTADO</th>
                <th v-if="isAdmin" class="p-2.5 text-center">ACCIONES</th>
              </tr>
            </thead>
            <tbody class="divide-y text-[11px]">
              <tr v-for="item in obtenerItemsPrograma(progSelect.id)" :key="item.id" :class="item.realizado ? 'bg-emerald-50/50' : 'hover:bg-slate-50'">
                <td class="p-2.5 font-bold text-amber-700 cursor-pointer hover:underline" @click="verDetallePorAfiString(item.afi)">AFI {{ item.afi }}</td>
                <td class="p-2.5 font-semibold text-slate-800">{{ obtenerDetalleEquipoPorAfi(item.afi, 'tipo') }}</td>
                <td class="p-2.5 text-slate-600">{{ obtenerDetalleEquipoPorAfi(item.afi, 'marca') }} {{ obtenerDetalleEquipoPorAfi(item.afi, 'modelo') }}</td>
                
                <!-- Fecha Programada Fija -->
                <td class="p-2.5 font-mono font-bold text-indigo-900 bg-indigo-50/50">
                  <input type="date" v-model="item.fecha_programada" :disabled="!isAdmin" @change="actualizarItemMantencionProgramado(item)" class="p-1 border rounded text-xs bg-white font-mono font-bold">
                </td>

                <!-- Fecha Realizada -->
                <td class="p-2.5 font-mono font-bold text-emerald-800 bg-emerald-50/50">
                  <input type="date" v-model="item.fecha_fin" :disabled="!isAdmin" @change="actualizarItemMantencionProgramado(item)" class="p-1 border rounded text-xs bg-white font-mono font-bold">
                </td>

                <!-- Horómetro -->
                <td class="p-2.5 font-mono font-bold text-amber-900 bg-amber-50/50">
                  <input type="number" step="any" v-model="item.horometro" :disabled="!isAdmin" @change="actualizarItemMantencionProgramado(item)" placeholder="Ej: 3450" class="w-24 p-1 border rounded text-xs bg-white font-mono font-bold text-center"> hrs
                </td>

                <td class="p-2.5 text-center">
                  <div class="flex items-center justify-center gap-2">
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" v-model="item.realizado" :disabled="!isAdmin" @change="cambiarEstadoRealizadoItem(item)" class="sr-only peer">
                      <div class="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                    <span :class="['text-[10px] font-bold px-2 py-0.5 rounded', item.realizado ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800']">
                      {{ item.realizado ? 'REALIZADO' : 'PENDIENTE' }}
                    </span>
                  </div>
                </td>
                <td v-if="isAdmin" class="p-2.5 text-center">
                  <button @click="eliminarItemPrograma(item.id)" class="text-rose-500 hover:text-rose-700 p-1" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="obtenerItemsPrograma(progSelect.id).length === 0" class="text-center p-10 text-slate-400 font-bold">No hay equipos asignados a este programa de mantención.</div>
        </div>

        <!-- CONTENIDO VISTA TABLA SEPARADA POR NAVES (REPARACIÓN) -->
        <div v-else-if="vistaProgramaMode === 'tabla'" class="flex-grow overflow-y-auto space-y-6">
          <template v-for="n_nave in ['NAVE 1', 'NAVE 2', 'NAVE 3', 'NAVE 4']" :key="n_nave">
            <div v-if="obtenerItemsProgramaEnRangoPorNave(progSelect.id, n_nave).length > 0" class="space-y-2 border rounded-xl p-3 bg-slate-50/50 shadow-sm">
              <div class="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase flex justify-between items-center">
                <span><i class="fa-solid fa-warehouse mr-1.5 text-amber-400"></i> {{ n_nave }}</span>
                <span class="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded">{{ obtenerItemsProgramaEnRangoPorNave(progSelect.id, n_nave).length }} equipos</span>
              </div>
              <table class="w-full text-left text-xs whitespace-nowrap bg-white rounded-lg overflow-hidden border">
                <thead class="bg-slate-100 text-slate-700 uppercase text-[10px]">
                  <tr>
                    <th class="p-2.5">EQUIPO AFI</th>
                    <th class="p-2.5">TIPO EQUIPO</th>
                    <th class="p-2.5">MARCA</th>
                    <th class="p-2.5">MODELO</th>
                    <th class="p-2.5">TIPO TRABAJO</th>
                    <th class="p-2.5">CONDICIÓN</th>
                    <th class="p-2.5">FECHA INICIO</th>
                    <th class="p-2.5">FECHA FIN</th>
                    <th class="p-2.5">ESTADO (ON/OFF)</th>
                    <th v-if="isAdmin" class="p-2.5 text-center">ACCIONES</th>
                  </tr>
                </thead>
                <tbody class="divide-y text-[11px]">
                  <tr v-for="item in obtenerItemsProgramaEnRangoPorNave(progSelect.id, n_nave)" :key="item.id" :class="item.realizado ? 'bg-emerald-50/50' : 'hover:bg-slate-50'">
                    <td class="p-2.5 font-bold text-amber-700 cursor-pointer hover:underline" @click="verDetallePorAfiString(item.afi)">AFI {{ item.afi }}</td>
                    <td class="p-2.5 font-semibold text-slate-800">{{ obtenerDetalleEquipoPorAfi(item.afi, 'tipo') }}</td>
                    <td class="p-2.5 text-slate-600">{{ obtenerDetalleEquipoPorAfi(item.afi, 'marca') }}</td>
                    <td class="p-2.5 text-slate-600">{{ obtenerDetalleEquipoPorAfi(item.afi, 'modelo') }}</td>
                    <td class="p-2.5 font-semibold text-slate-700">{{ item.tipo }}</td>
                    <td class="p-2.5"><span class="px-2 py-0.5 rounded font-bold text-[10px] bg-blue-100 text-blue-800">{{ item.condicion || 'Arriendo' }}</span></td>
                    <td class="p-2.5 font-mono font-bold text-slate-700">{{ formatDateForDisplay(item.fecha_inicio) }}</td>
                    <td class="p-2.5 font-mono font-bold text-slate-700">{{ formatDateForDisplay(item.fecha_fin) }}</td>
                    <td class="p-2.5">
                      <div class="flex items-center gap-3">
                        <label class="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" v-model="item.realizado" :disabled="!isAdmin" @change="cambiarEstadoRealizadoItem(item)" class="sr-only peer">
                          <div class="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                        <span :class="['text-[10px] font-bold px-2 py-0.5 rounded', item.realizado ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600']">
                          {{ item.realizado ? 'REPARADO (ON)' : 'PENDIENTE (OFF)' }}
                        </span>
                      </div>
                    </td>
                    <td v-if="isAdmin" class="p-2.5 text-center">
                      <button @click="eliminarItemPrograma(item.id)" class="text-rose-500 hover:text-rose-700 p-1"><i class="fa-solid fa-trash"></i></button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>

        <!-- CONTENIDO VISTA CALENDARIO / GANTT (REPARACIÓN) -->
        <div v-else-if="progSelect.carpeta === 'REPARACION' && vistaProgramaMode === 'calendario'" class="flex-grow overflow-auto p-3 bg-slate-50 border rounded-xl space-y-6">
          <template v-for="n_nave in ['NAVE 1', 'NAVE 2', 'NAVE 3', 'NAVE 4']" :key="n_nave">
            <div v-if="obtenerItemsProgramaEnRangoPorNave(progSelect.id, n_nave).length > 0" class="space-y-2">
              <div class="text-xs font-extrabold text-slate-800 bg-blue-100 border border-blue-300 px-3 py-1.5 rounded-md uppercase flex items-center justify-between">
                <span><i class="fa-solid fa-warehouse mr-1.5 text-blue-700"></i> {{ n_nave }}</span>
                <span class="text-[10px] font-mono text-blue-900">{{ obtenerItemsProgramaEnRangoPorNave(progSelect.id, n_nave).length }} equipos asignados</span>
              </div>

              <div class="overflow-x-auto border rounded-lg bg-white shadow-sm">
                <table class="w-full text-[10px] border-collapse">
                  <thead>
                    <tr class="bg-slate-800 text-white text-center">
                      <th class="p-2 border border-slate-700 w-24">TIPO EQUIPO</th>
                      <th class="p-2 border border-slate-700 w-16">AFI</th>
                      <th class="p-2 border border-slate-700 w-20">CONDICIÓN</th>
                      <th class="p-2 border border-slate-700 w-20">INICIO</th>
                      <th class="p-2 border border-slate-700 w-20">FIN</th>
                      <th v-for="diaObj in generarDiasDelPrograma(progSelect)" :key="diaObj.fechaStr" class="border border-slate-700 px-0.5 py-1 w-7 text-[9px] font-mono" :title="diaObj.fechaStr">
                        <span class="block opacity-70">{{ diaObj.letraDia }}</span>
                        <span class="block font-bold text-amber-300">{{ diaObj.numDia }}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    <tr v-for="item in obtenerItemsProgramaEnRangoPorNave(progSelect.id, n_nave)" :key="item.id" class="hover:bg-slate-50">
                      <td class="p-2 border font-semibold text-slate-800 bg-slate-50 truncate max-w-[100px]">{{ obtenerDetalleEquipoPorAfi(item.afi, 'tipo') }}</td>
                      <td class="p-2 border font-bold text-amber-700 bg-amber-50/50">AFI {{ item.afi }}</td>
                      <td class="p-2 border text-slate-700">{{ item.condicion || 'Arriendo' }}</td>
                      <td class="p-2 border font-mono font-bold text-slate-700">{{ formatDateForDisplay(item.fecha_inicio) }}</td>
                      <td class="p-2 border font-mono font-bold text-slate-700">{{ formatDateForDisplay(item.fecha_fin) }}</td>
                      <td v-for="diaObj in generarDiasDelPrograma(progSelect)" :key="diaObj.fechaStr" 
                          :class="['border border-slate-200 text-center transition-colors', esFechaEnRangoEquipo(diaObj.fechaStr, item.fecha_inicio, item.fecha_fin) ? (item.realizado ? 'bg-emerald-500' : 'bg-purple-500 shadow-inner') : 'bg-white hover:bg-slate-100']"
                          :title="'AFI ' + item.afi + ' - ' + diaObj.fechaStr">
                        <span v-if="esFechaEnRangoEquipo(diaObj.fechaStr, item.fecha_inicio, item.fecha_fin)" class="text-white text-[8px] font-bold">●</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
        </div>

        <!-- TABLA AISLADA: EQUIPOS FUERA DEL RANGO / NO PROGRAMADOS (SOLO REPARACIÓN) -->
        <div v-if="progSelect.carpeta === 'REPARACION' && obtenerItemsFueraDeRangoPrograma(progSelect.id).length > 0" class="mt-6 border-2 border-dashed border-amber-300 rounded-xl p-4 bg-amber-50/40 space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="font-extrabold text-amber-900 text-xs flex items-center gap-2">
              <i class="fa-solid fa-triangle-exclamation text-amber-600"></i> Tabla Aislada: Equipos fuera de vigencia del programa / No programados
            </h4>
            <span class="text-[10px] font-mono bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">{{ obtenerItemsFueraDeRangoPrograma(progSelect.id).length }} equipos</span>
          </div>
          <table class="w-full text-left text-xs bg-white rounded-lg overflow-hidden border">
            <thead class="bg-amber-100 text-amber-900 uppercase text-[10px]">
              <tr>
                <th class="p-2">EQUIPO AFI</th>
                <th class="p-2">TIPO EQUIPO</th>
                <th class="p-2">NAVE</th>
                <th class="p-2">FECHA INICIO</th>
                <th class="p-2">FECHA FIN</th>
                <th class="p-2">ESTADO</th>
                <th v-if="isAdmin" class="p-2 text-center">ACCIONES</th>
              </tr>
            </thead>
            <tbody class="divide-y text-[11px]">
              <tr v-for="item in obtenerItemsFueraDeRangoPrograma(progSelect.id)" :key="item.id" class="bg-amber-50/30">
                <td class="p-2 font-bold text-amber-800">AFI {{ item.afi }}</td>
                <td class="p-2">{{ obtenerDetalleEquipoPorAfi(item.afi, 'tipo') }}</td>
                <td class="p-2 font-bold">{{ item.nave || 'NAVE 1' }}</td>
                <td class="p-2 font-mono">{{ formatDateForDisplay(item.fecha_inicio) }}</td>
                <td class="p-2 font-mono">{{ formatDateForDisplay(item.fecha_fin) }}</td>
                <td class="p-2"><span class="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-200 text-amber-900">Fuera de rango programa</span></td>
                <td v-if="isAdmin" class="p-2 text-center">
                  <button @click="eliminarItemPrograma(item.id)" class="text-rose-500 hover:text-rose-700 p-1"><i class="fa-solid fa-trash"></i></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </template>
      <div v-else class="flex-grow flex flex-col items-center justify-center text-slate-400 space-y-4">
        <i class="fa-solid fa-calendar-days text-6xl opacity-20"></i>
        <p class="font-bold">Selecciona un Programa desde el menú lateral para ver su detalle.</p>
      </div>
    </div>
  </div>
</section>
`;
