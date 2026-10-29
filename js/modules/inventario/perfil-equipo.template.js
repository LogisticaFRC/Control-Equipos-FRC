// Plantilla HTML del componente 'perfil-equipo' (extraída del index original)
export default /* html */ `
<div v-if="showPerfilEquipoModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl border w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
    <div class="px-6 py-4 border-b flex items-center justify-between bg-slate-800 text-white">
      <div class="flex items-center gap-3">
        <span class="text-xs font-mono font-bold bg-amber-500 text-slate-900 px-3 py-1.5 rounded-lg shadow-sm">AFI: {{ perfilEquipo.afi }}</span>
        <h3 class="text-base font-extrabold tracking-wide uppercase"><i class="fa-solid fa-id-card mr-2"></i> Perfil de Equipo y Dashboard Individual</h3>
      </div>
      <button @click="showPerfilEquipoModal = false" class="w-8 h-8 rounded-full bg-slate-700 hover:bg-rose-500 text-white flex items-center justify-center transition shadow"><i class="fa-solid fa-xmark text-base"></i></button>
    </div>

    <div class="p-6 overflow-y-auto space-y-6 flex-grow bg-slate-100 text-xs">
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <h4 class="font-bold text-slate-800 uppercase flex items-center gap-2 border-b pb-2 mb-4"><i class="fa-solid fa-truck-monster text-emerald-600"></i> Datos Principales del Equipo</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div><label class="block font-bold text-slate-700 mb-1">AFI</label><input type="text" v-model="perfilEquipo.afi" :disabled="!isAdmin" class="w-full p-2 border rounded-lg bg-slate-50 font-bold text-amber-800"></div>
          <div><label class="block font-bold text-slate-700 mb-1">Tipo de Equipo</label><input type="text" v-model="perfilEquipo.tipo" :disabled="!isAdmin" class="w-full p-2 border rounded-lg bg-slate-50 font-bold text-slate-800"></div>
          <div><label class="block font-bold text-slate-700 mb-1">Marca</label><input type="text" v-model="perfilEquipo.marca" :disabled="!isAdmin" class="w-full p-2 border rounded-lg bg-slate-50"></div>
          <div><label class="block font-bold text-slate-700 mb-1">Modelo</label><input type="text" v-model="perfilEquipo.modelo" :disabled="!isAdmin" class="w-full p-2 border rounded-lg bg-slate-50"></div>
          <div><label class="block font-bold text-slate-700 mb-1">Ubicación Actual</label><input type="text" v-model="perfilEquipo.ubicacion" :disabled="!isAdmin" class="w-full p-2 border rounded-lg bg-slate-50"></div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Disponibilidad</label>
            <select v-model="perfilEquipo.disponibilidad" :disabled="!isAdmin" class="w-full p-2 border rounded-lg bg-slate-50 font-bold">
              <option value="Operativo">Trabajando / Operativo</option><option value="Disponible">Disponible</option><option value="En Traslado">En Traslado</option>
              <option value="En Mantencion">En Mantención</option><option value="Fuera de Servicio">Fuera de Servicio</option><option value="Venta">En Venta</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">GPS</label>
            <select v-model="perfilEquipo.gps" :disabled="!isAdmin" class="w-full p-2 border rounded-lg bg-slate-50 font-bold text-blue-700">
              <option value="Instalado">Instalado</option><option value="Sin GPS">Sin GPS</option>
            </select>
          </div>
          <div class="md:col-span-2"><label class="block font-bold text-slate-700 mb-1">IMEI del GPS</label><input type="text" v-model="perfilEquipo.imei_gps" :disabled="!isAdmin" class="w-full p-2 border rounded-lg bg-slate-50 font-mono"></div>
        </div>
      </div>

      <!-- SECCIÓN HORÓMETROS CON FECHA MANUAL -->
      <div :class="['p-5 rounded-xl shadow-sm border flex flex-col lg:flex-row gap-6 items-center', perfilEquipo.horometros?.horasFaltantes <= 0 ? 'bg-pasado-blink' : 'bg-normal-horometro']">
        <div class="w-full lg:w-1/3 space-y-3">
          <div class="flex items-center justify-between border-b border-white/20 pb-2">
            <h4 class="font-bold text-sm flex items-center gap-2 uppercase"><i class="fa-solid fa-stopwatch"></i> Horómetros y Frecuencia</h4>
            <span v-if="perfilEquipo.horometros?.horasFaltantes <= 0" class="bg-white text-rose-600 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase animate-pulse">¡PASADO!</span>
          </div>
          <div>
            <label class="block font-bold text-[10px] mb-1 opacity-80 uppercase">Último Horómetro Tomado (Manual)</label>
            <input type="number" step="any" v-model="perfilEquipo.horometroActual" :disabled="!isAdmin" class="w-full p-2.5 border-none rounded-lg bg-white/20 focus:bg-white/30 font-mono font-bold text-white text-sm outline-none transition">
          </div>
          <div>
            <label class="block font-bold text-[10px] mb-1 opacity-80 uppercase">Fecha de este Horómetro</label>
            <input type="date" v-model="perfilEquipo.fechaHorometroManual" :disabled="!isAdmin" class="w-full p-2.5 border-none rounded-lg bg-white/20 focus:bg-white/30 font-mono font-bold text-white text-sm outline-none transition">
          </div>
          <div>
            <label class="block font-bold text-[10px] mb-1 opacity-80 uppercase">Frecuencia de Mantención</label>
            <input type="number" step="any" v-model="perfilEquipo.frecuenciaMantencion" :disabled="!isAdmin" class="w-full p-2.5 border-none rounded-lg bg-white/10 font-mono font-bold text-sm outline-none">
          </div>
        </div>

        <div class="w-full lg:w-2/3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
          <div class="bg-white/10 p-3 rounded-xl border border-white/20">
            <span class="block text-[10px] uppercase font-bold opacity-70 mb-1">Último Horómetro Tomado</span>
            <strong class="font-mono text-base text-amber-300 block">{{ perfilEquipo.horometros?.hTomado || 0 }}h</strong>
            <span class="text-[9px] opacity-70 block mt-0.5"><i class="fa-solid fa-calendar mr-1"></i> {{ formatDateForDisplay(perfilEquipo.horometros?.fechaUltimoHorometro) }}</span>
          </div>
          <div class="bg-white/10 p-3 rounded-xl border border-white/20">
            <span class="block text-[10px] uppercase font-bold opacity-70 mb-1">Última Mantención</span>
            <strong class="font-mono text-base text-blue-300 block">{{ perfilEquipo.horometros?.hUltimaMant || 0 }}h</strong>
            <span class="text-[9px] opacity-70 block mt-0.5"><i class="fa-solid fa-calendar mr-1"></i> {{ formatDateForDisplay(perfilEquipo.horometros?.ultimaMantFecha) }}</span>
          </div>
          <div class="bg-white/10 p-3 rounded-xl border border-white/20">
            <span class="block text-[10px] uppercase font-bold opacity-70 mb-1">Horómetro Actual Aprox.</span>
            <strong class="font-mono text-base text-sky-300 block">{{ perfilEquipo.horometros?.hAprox || 0 }}h</strong>
            <span class="text-[9px] opacity-60 block mt-0.5">{{ perfilEquipo.horometros?.rateHrsDia > 0 ? perfilEquipo.horometros.rateHrsDia.toFixed(2) + ' hrs/día' : 'Sin uso diario' }}</span>
          </div>
          <div class="bg-white/10 p-3 rounded-xl border border-white/20">
            <span class="block text-[10px] uppercase font-bold opacity-70 mb-1">Próxima Mantención (Meta)</span>
            <strong class="font-mono text-base text-emerald-300 block">{{ perfilEquipo.horometros?.hTarget || 0 }}h</strong>
          </div>
          <div class="bg-white/10 p-3 rounded-xl border border-white/20 col-span-2 sm:col-span-2">
            <span class="block text-[10px] uppercase font-bold opacity-70 mb-1">Fecha Próxima Mantención (Aprox.)</span>
            <strong class="font-mono text-sm text-amber-300 block mt-1"><i class="fa-solid fa-calendar-days mr-1"></i> {{ formatDateForDisplay(perfilEquipo.horometros?.fechaEstimada) }}</strong>
          </div>
        </div>
      </div>

      <!-- DASHBOARD INDIVIDUAL DEL EQUIPO CON FILTROS -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div>
            <h4 class="font-bold text-slate-800 uppercase flex items-center gap-2 text-xs"><i class="fa-solid fa-chart-pie text-blue-600"></i> Dashboard Individual y Estadísticas de Causas</h4>
            <p class="text-[11px] text-slate-500">Filtra el rendimiento y los eventos históricos de este equipo en tiempo real.</p>
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

        <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center">
          <div class="bg-slate-50 p-3 rounded-xl border">
            <span class="text-[10px] text-slate-500 font-bold uppercase block">Total Intervenciones</span>
            <strong class="text-lg font-bold text-slate-800">{{ getHistorialIntervencionesFiltradoAFI(perfilEquipo.afi).length }}</strong>
          </div>
          <div class="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <span class="text-[10px] text-emerald-700 font-bold uppercase block">Costo Total Acumulado</span>
            <strong class="text-lg font-bold text-emerald-800">\${{ costoTotalIntervencionesFiltradasAFI(perfilEquipo.afi).toLocaleString('es-CL') }}</strong>
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

      <!-- ASIGNACIÓN A PROGRAMA -->
      <div v-if="isAdmin" class="bg-rose-50 border border-rose-200 p-4 rounded-xl shadow-sm">
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

      <!-- HISTORIAL COMPLETO DE MANTENCIONES EN PERFIL CON MÁS DATOS -->
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
        <h4 class="font-bold text-slate-800 uppercase flex items-center gap-2 border-b pb-2"><i class="fa-solid fa-wrench text-blue-600"></i> Historial Completo de Mantenciones del Equipo (Todos los Datos)</h4>
        <div class="overflow-x-auto border rounded-lg bg-slate-50 max-h-80">
          <table class="w-full text-left whitespace-nowrap text-[11px] border-collapse">
            <thead class="bg-slate-800 text-white sticky top-0 uppercase text-[9px]">
              <tr>
                <th v-if="isAdmin" class="p-2 text-center">Acciones</th>
                <th class="p-2">Fecha Mant.</th>
                <th class="p-2 text-indigo-300">Programa</th>
                <th class="p-2">Lugar</th>
                <th class="p-2">Causa</th>
                <th class="p-2">Tipo Mant.</th>
                <th class="p-2 text-amber-300">Horómetro</th>
                <th class="p-2">Mecánicos</th>
                <th class="p-2 text-sky-300">Hora Inicio</th>
                <th class="p-2 text-sky-300">Hora Término</th>
                <th class="p-2 text-amber-300">Total Horas</th>
                <th class="p-2 text-emerald-300">Filtros</th>
                <th class="p-2">Causa Detallada</th>
                <th class="p-2">Descripción</th>
                <th class="p-2">Costo</th>
                <th class="p-2">OC / OT</th>
                <th class="p-2 text-amber-300">Aceites</th>
              </tr>
            </thead>
            <tbody class="divide-y bg-white">
              <tr v-for="i in getHistorialIntervencionesFiltradoAFI(perfilEquipo.afi)" :key="i.id" class="hover:bg-slate-50">
                <td v-if="isAdmin" class="p-2 text-center space-x-1">
                  <button @click="editarMantencion(i)" class="bg-amber-100 hover:bg-amber-200 text-amber-800 p-1 rounded font-bold" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
                  <button @click="eliminarMantencion(i.id)" class="bg-rose-100 hover:bg-rose-200 text-rose-800 p-1 rounded font-bold" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                </td>
                <td class="p-2 font-mono font-bold bg-amber-50/50">{{ formatDateForDisplay(i.fecha) }}</td>
                <td class="p-2 font-bold text-indigo-700 bg-indigo-50/40">{{ i.programaCorrespondiente || '-' }}</td>
                <td class="p-2">{{ i.lugar || '-' }}</td>
                <td class="p-2 font-bold">{{ i.causa || '-' }}</td>
                <td class="p-2 text-blue-600 font-semibold">{{ i.tipoMant || '-' }}</td>
                <td class="p-2 font-mono font-bold text-amber-900 bg-amber-50">{{ i.horometro ? i.horometro + ' hrs' : '-' }}</td>
                <td class="p-2">{{ getMecanicosText(i) }}</td>
                <td class="p-2 font-mono text-sky-700 bg-sky-50/50">{{ i.horaInicio || '-' }}</td>
                <td class="p-2 font-mono text-sky-700 bg-sky-50/50">{{ i.horaTermino || '-' }}</td>
                <td class="p-2 font-mono font-bold text-amber-900 bg-amber-50">{{ i.horaTotal || '-' }}</td>
                <td class="p-2 text-emerald-800 font-bold bg-emerald-50/50">{{ i.filtrosTexto || '-' }}</td>
                <td class="p-2 max-w-xs truncate">{{ i.causaDetallada || '-' }}</td>
                <td class="p-2 max-w-xs truncate">{{ i.descripcion || '-' }}</td>
                <td class="p-2 font-bold text-emerald-700">\${{ Number(i.costo || 0).toLocaleString('es-CL') }}</td>
                <td class="p-2 font-mono">OC: {{ i.numeroOC || '-' }} / OT: {{ i.numeroOT || '-' }}</td>
                <td class="p-2 text-amber-800 font-bold bg-amber-50">{{ i.aceites }}</td>
              </tr>
              <tr v-if="getHistorialIntervencionesFiltradoAFI(perfilEquipo.afi).length === 0"><td colspan="17" class="p-4 text-center text-slate-400">Sin registros de mantención para este filtro.</td></tr>
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

    <div class="px-6 py-4 border-t bg-white flex justify-between items-center">
      <span class="text-[10px] text-slate-400 font-bold uppercase"><i class="fa-solid fa-cloud"></i> Sincronizado</span>
      <div class="flex items-center gap-2">
        <button @click="showPerfilEquipoModal = false" class="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-4 py-2 rounded-lg text-xs">Cerrar</button>
        <button v-if="isAdmin" @click="guardarPerfilEquipo" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-lg shadow text-xs"><i class="fa-solid fa-floppy-disk"></i> Guardar Cambios</button>
      </div>
    </div>
  </div>
</div>
`;
