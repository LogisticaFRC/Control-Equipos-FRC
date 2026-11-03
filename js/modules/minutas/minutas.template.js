// Plantilla HTML del módulo MINUTAS (carpetas Año → Mes, tabla de tareas, dashboard)
export default /* html */ `
<section class="space-y-4">
  <!-- Encabezado -->
  <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
    <div>
      <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-clipboard-list text-teal-600"></i> MINUTAS - Mejora continua semanal</h2>
      <p class="text-xs text-slate-500 mt-1">Cada minuta nueva continúa desde la última: se copian sus tareas y las anteriores quedan guardadas como histórico.</p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <button v-if="puedeEditar" @click="abrirModalNuevaMinuta" class="bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold px-3.5 py-2.5 rounded-xl transition shadow flex items-center gap-2">
        <i class="fa-solid fa-plus text-sm"></i> Nueva Minuta
      </button>
      <label v-if="puedeEditar" class="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition shadow flex items-center gap-2 cursor-pointer" title="Importa una o varias minutas desde Word (.docx) o Excel. Antes de guardar puedes revisar la fecha de cada una.">
        <i class="fa-solid fa-file-import text-sm"></i> Importar (Word / Excel)
        <input type="file" multiple accept=".docx,.doc,.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document" class="hidden" @change="elegirArchivosImportar">
      </label>
      <button v-if="minutaSel" @click="exportarMinutaExcel()" :disabled="exportando" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition shadow flex items-center gap-2 disabled:opacity-60" title="Minuta seleccionada: logo, resumen con %, tabla y dashboard">
        <i :class="['fa-solid text-sm', exportando ? 'fa-spinner fa-spin' : 'fa-file-excel']"></i> Exportar Minuta
      </button>
      <button @click="exportarTodasExcel" :disabled="exportando || !dbMinutas.length" class="bg-white hover:bg-slate-50 text-emerald-700 border border-emerald-300 text-xs font-bold px-3 py-2.5 rounded-xl transition flex items-center gap-2 disabled:opacity-60" title="Todas las minutas en un solo Excel: resumen general, dashboard, histórico y una hoja por minuta">
        <i :class="['fa-solid text-sm', exportando ? 'fa-spinner fa-spin' : 'fa-file-zipper']"></i> Exportar Todas (un archivo)
      </button>
      <button @click="descargarPlantillaMinuta" class="text-slate-500 hover:text-slate-800 text-[11px] font-bold px-2 py-2 underline" title="Excel con las columnas para importar">Plantilla</button>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
    <!-- Sidebar: Año → Mes → Minutas -->
    <div class="lg:col-span-1 bg-white p-4 rounded-xl shadow-sm border border-slate-200 lg:h-[720px] overflow-y-auto space-y-3">
      <h3 class="text-xs font-bold text-slate-800 uppercase border-b pb-2 flex items-center justify-between">
        <span><i class="fa-solid fa-folder-tree text-teal-600"></i> Minutas por Mes</span>
        <span class="text-[10px] text-slate-400 font-mono">{{ dbMinutas.length }}</span>
      </h3>

      <div v-if="cargandoMinutas" class="text-xs text-slate-400 p-2"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Cargando...</div>
      <div v-else-if="!dbMinutas.length" class="text-[11px] text-slate-400 italic p-2">Aún no hay minutas.{{ puedeEditar ? ' Crea la primera con "Nueva Minuta" o impórtala desde Excel.' : '' }}</div>

      <div v-for="a in arbolMinutas" :key="a.anio" class="space-y-1">
        <div @click="toggleAnio(a.anio)" class="font-bold text-xs text-slate-800 border p-2.5 rounded cursor-pointer flex justify-between items-center shadow-sm bg-teal-50 border-teal-200 hover:bg-teal-100">
          <span><i class="fa-solid fa-calendar mr-1.5 text-teal-600"></i> {{ a.anio }} ({{ a.total }})</span>
          <i :class="['fa-solid text-slate-500 text-[10px]', anioAbierto(a.anio) ? 'fa-chevron-down' : 'fa-chevron-right']"></i>
        </div>
        <div v-show="anioAbierto(a.anio)" class="pl-3 pr-1 space-y-1.5 border-l-2 border-teal-200 ml-2 pt-1 pb-2">
          <div v-for="mm in a.meses" :key="mm.mes" class="space-y-1">
            <div @click="toggleMes(a.anio, mm.mes)" class="flex items-center justify-between px-2 py-1.5 rounded border text-[11px] font-bold cursor-pointer bg-teal-50/60 border-teal-200 text-teal-900">
              <span class="truncate"><i :class="['fa-solid mr-1', mesAbierto(a.anio, mm.mes) ? 'fa-folder-open' : 'fa-folder']"></i> {{ mm.label }} <span class="font-normal opacity-70">({{ mm.minutas.length }})</span></span>
              <i :class="['fa-solid text-[9px] opacity-60', mesAbierto(a.anio, mm.mes) ? 'fa-chevron-down' : 'fa-chevron-right']"></i>
            </div>
            <div v-show="mesAbierto(a.anio, mm.mes)" class="pl-2 ml-1 border-l border-dashed border-slate-300 space-y-1.5">
              <div v-for="m in mm.minutas" :key="m.id" @click="seleccionarMinuta(m)"
                   :class="['p-2.5 rounded border transition text-[11px] space-y-1 cursor-pointer', minutaSelId === m.id ? 'bg-teal-50 border-teal-400 text-teal-900 shadow-sm font-bold' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100']">
                <div class="flex items-center justify-between gap-1">
                  <span class="truncate"><i class="fa-solid fa-file-lines opacity-70 mr-1 text-teal-600"></i> {{ m.nombre }}</span>
                  <div class="flex items-center gap-0.5 shrink-0">
                    <span v-if="ultimaMinuta && ultimaMinuta.id === m.id" class="bg-teal-600 text-white px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase">Actual</span>
                    <button v-if="isAdmin" @click.stop="renombrarMinuta(m)" class="text-slate-400 hover:text-slate-700 p-1" title="Renombrar / cambiar fecha"><i class="fa-solid fa-pen"></i></button>
                    <button v-if="isAdmin" @click.stop="eliminarMinuta(m)" class="text-rose-500 hover:text-rose-700 p-1" title="Eliminar minuta"><i class="fa-solid fa-trash"></i></button>
                  </div>
                </div>
                <div class="flex items-center justify-between text-[9px] font-mono text-slate-500">
                  <span>{{ formatDateForDisplay(m.fecha) }} · {{ itemsDeMinuta(m.id).length }} tareas</span>
                  <span :class="cumplimientoMinuta(m.id) >= 80 ? 'text-emerald-600' : cumplimientoMinuta(m.id) >= 50 ? 'text-amber-600' : 'text-rose-600'">{{ cumplimientoMinuta(m.id) }}%</span>
                </div>
                <div class="w-full bg-slate-200 rounded-full h-1 overflow-hidden"><div class="h-1 bg-emerald-500" :style="{ width: cumplimientoMinuta(m.id) + '%' }"></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Panel principal -->
    <div class="lg:col-span-3 bg-white p-5 rounded-xl shadow-sm border border-slate-200 lg:h-[720px] flex flex-col min-w-0">
      <template v-if="minutaSel">
        <div class="border-b pb-3 mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span :class="['text-[10px] font-extrabold uppercase px-2.5 py-1 rounded', esUltimaMinuta ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-700']">
              <i :class="['fa-solid mr-1', esUltimaMinuta ? 'fa-pen-to-square' : 'fa-box-archive']"></i> {{ esUltimaMinuta ? 'Minuta actual' : 'Histórico' }}
            </span>
            <h3 class="text-lg font-extrabold text-slate-800 flex items-center gap-2 mt-1"><i class="fa-solid fa-clipboard-list text-teal-600"></i> {{ minutaSel.nombre }}</h3>
            <p class="text-xs font-mono font-bold text-slate-600 mt-0.5"><i class="fa-solid fa-calendar-day mr-1"></i> {{ formatDateForDisplay(minutaSel.fecha) }}
              <span v-if="minutaSel.creado_por" class="font-normal text-slate-400"> · creada por {{ minutaSel.creado_por }}</span></p>
          </div>
          <div class="flex items-center gap-3">
            <div class="w-44 space-y-1">
              <div class="flex justify-between text-[10px] font-bold text-slate-600 uppercase"><span>Cumplimiento</span><span>{{ resumenSel.cumplimiento }}%</span></div>
              <div class="w-full bg-slate-200 rounded-full h-2.5 shadow-inner overflow-hidden"><div class="bg-emerald-500 h-2.5 transition-all" :style="{ width: resumenSel.cumplimiento + '%' }"></div></div>
            </div>
            <div class="flex bg-slate-100 rounded-lg p-1 text-xs font-bold">
              <button @click="vistaMinuta = 'tabla'" :class="['px-3 py-1.5 rounded-md', vistaMinuta === 'tabla' ? 'bg-white shadow text-slate-900' : 'text-slate-500']"><i class="fa-solid fa-table mr-1"></i> Tabla</button>
              <button @click="vistaMinuta = 'dashboard'" :class="['px-3 py-1.5 rounded-md', vistaMinuta === 'dashboard' ? 'bg-white shadow text-slate-900' : 'text-slate-500']"><i class="fa-solid fa-chart-pie mr-1"></i> Dashboard</button>
            </div>
          </div>
        </div>

        <p v-if="!esUltimaMinuta" class="mb-3 text-[11px] bg-slate-100 border border-slate-200 text-slate-600 rounded-lg px-3 py-2">
          <i class="fa-solid fa-circle-info mr-1"></i> Minuta anterior guardada como histórico.{{ isAdmin ? ' Como Admin puedes corregirla.' : ' Solo lectura.' }}
          <button v-if="ultimaMinuta" @click="seleccionarMinuta(ultimaMinuta)" class="ml-1 font-bold text-teal-700 underline">Ir a la minuta actual</button>
        </p>

        <!-- ===================== TABLA ===================== -->
        <template v-if="vistaMinuta === 'tabla'">
          <div class="flex flex-wrap items-center gap-2 mb-3">
            <button v-for="e in [{k:'',l:'Todas',n:resumenSel.total}, ...ESTADOS_MINUTA.map(x => ({k:x,l:x,n:resumenSel[x]})), {k:'VENCIDAS',l:'Vencidas',n:resumenSel.vencidas}]" :key="e.k"
              @click="filtroEstadoMinuta = e.k"
              :class="['text-[11px] font-bold px-2.5 py-1 rounded-full border transition', filtroEstadoMinuta === e.k ? 'bg-slate-800 text-white border-slate-800' : (e.k === 'VENCIDAS' ? 'bg-rose-50 text-rose-700 border-rose-200' : e.k ? ESTADO_ESTILO[e.k].badge : 'bg-white text-slate-600 border-slate-300')]">
              {{ e.l }} <span class="opacity-70">({{ e.n }})</span>
            </button>
            <div class="flex-grow"></div>
            <input v-model="busquedaMinuta" type="text" placeholder="Buscar tarea o encargado..." class="p-1.5 border rounded-lg text-xs w-52">
            <button v-if="puedeEditarMinuta" @click="agregarTarea" class="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow flex items-center gap-1.5"><i class="fa-solid fa-plus"></i> Agregar tarea</button>
          </div>

          <datalist id="minutas-personal"><option v-for="p in listaPersonal" :key="p" :value="p"></option></datalist>

          <div class="flex-grow overflow-auto border rounded-lg">
            <table class="w-full min-w-[1150px] text-xs">
              <thead class="bg-slate-800 text-white sticky top-0 z-10">
                <tr>
                  <th class="p-2 text-center w-14">N° Item</th>
                  <th class="p-2 text-left w-28">Área</th>
                  <th class="p-2 text-left w-40">Personal Encargado</th>
                  <th class="p-2 text-center w-32">Fecha Compromiso</th>
                  <th class="p-2 text-center w-32">Fecha Estimada</th>
                  <th class="p-2 text-left min-w-[260px]">Tareas</th>
                  <th class="p-2 text-center w-36">Estado</th>
                  <th class="p-2 text-center w-32">Fecha Realizado</th>
                  <th class="p-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(it, idx) in itemsFiltrados" :key="it.id">
                <!-- Título de sección (como en el Word: "Seguridad") -->
                <tr v-if="inicioSeccion(itemsFiltrados, idx)" class="bg-amber-50 border-b">
                  <td colspan="9" class="p-1.5 text-center font-extrabold text-slate-800 text-sm"><span class="bg-yellow-300 px-2 rounded">{{ it.seccion }}</span></td>
                </tr>
                <tr :class="['border-b align-top', esVencida(it) ? 'bg-rose-50' : it.estado === 'Realizado' ? 'bg-emerald-50/40' : 'hover:bg-slate-50']">
                  <template v-if="puedeEditarMinuta">
                    <td class="p-1"><input v-model="it.n_item" @change="guardarTarea(it)" type="number" min="1" class="w-full p-1 border rounded text-center font-bold"></td>
                    <td class="p-1 space-y-1">
                      <input v-model="it.area" @change="guardarTarea(it)" type="text" placeholder="Área" class="w-full p-1 border rounded uppercase">
                      <input v-model="it.seccion" @change="guardarTarea(it)" type="text" placeholder="Sección" title="Sección (título que agrupa las tareas)" class="w-full p-1 border border-dashed rounded text-[10px] text-slate-500">
                    </td>
                    <td class="p-1"><textarea v-model="it.personal" @change="guardarTarea(it)" rows="2" class="w-full p-1 border rounded uppercase resize-y" title="Varios encargados: sepáralos con /"></textarea></td>
                    <td class="p-1"><input v-model="it.fecha_compromiso" @change="guardarTarea(it)" type="date" class="w-full p-1 border rounded font-mono" title="Día en que se adquirió el compromiso"></td>
                    <td class="p-1 space-y-1">
                      <input v-model="it.fecha_estimada" @change="guardarTarea(it)" type="date" :class="['w-full p-1 border rounded font-mono', esVencida(it) ? 'border-rose-400 text-rose-700 font-bold' : '']">
                      <input v-model="it.fecha_texto" @change="guardarTarea(it)" type="text" placeholder="o texto (ej. Siempre)" class="w-full p-1 border border-dashed rounded text-[10px] text-indigo-700 font-bold">
                    </td>
                    <td class="p-1"><textarea v-model="it.tarea" @change="guardarTarea(it)" :rows="Math.min(8, Math.max(2, String(it.tarea || '').split('\\n').length))" class="w-full p-1 border rounded resize-y"></textarea></td>
                    <td class="p-1">
                      <select v-model="it.estado" @change="guardarTarea(it)" :class="['w-full p-1 border rounded font-bold', ESTADO_ESTILO[it.estado].badge]">
                        <option v-for="e in ESTADOS_MINUTA" :key="e" :value="e">{{ e }}</option>
                      </select>
                      <p v-if="esVencida(it)" class="text-[9px] text-rose-600 font-bold mt-0.5 text-center"><i class="fa-solid fa-triangle-exclamation"></i> Vencida</p>
                    </td>
                    <td class="p-1">
                      <input v-if="it.estado === 'Realizado'" v-model="it.fecha_realizado" @change="guardarTarea(it)" type="date" class="w-full p-1 border border-emerald-300 rounded font-mono text-emerald-800 font-bold">
                      <span v-else class="block text-center text-slate-300 pt-1">-</span>
                    </td>
                    <td class="p-1 text-center whitespace-nowrap">
                      <i v-if="it._guardando" class="fa-solid fa-spinner fa-spin text-slate-400"></i>
                      <i v-else-if="it._ok" class="fa-solid fa-check text-emerald-500"></i>
                      <button @click="verHistorialTarea(it)" class="text-slate-400 hover:text-teal-700 p-1" title="Historial de la tarea"><i class="fa-solid fa-clock-rotate-left"></i></button>
                      <button v-if="isAdmin" @click="eliminarTarea(it)" class="text-rose-500 hover:text-rose-700 p-1" title="Eliminar tarea"><i class="fa-solid fa-trash"></i></button>
                    </td>
                  </template>
                  <template v-else>
                    <td class="p-2 text-center font-bold">{{ it.n_item }}</td>
                    <td class="p-2 font-semibold">{{ it.area || '-' }}</td>
                    <td class="p-2 font-semibold whitespace-pre-line">{{ (it.personal || '-').split(' / ').join('\\n') }}</td>
                    <td class="p-2 text-center font-mono">{{ formatDateForDisplay(it.fecha_compromiso) }}</td>
                    <td :class="['p-2 text-center font-mono', esVencida(it) ? 'text-rose-700 font-bold' : '']">{{ it.fecha_estimada || !it.fecha_texto ? formatDateForDisplay(it.fecha_estimada) : '' }}<span v-if="it.fecha_texto" class="block font-sans font-bold text-indigo-700">{{ it.fecha_texto }}</span></td>
                    <td class="p-2 whitespace-pre-line">{{ it.tarea }}</td>
                    <td class="p-2 text-center">
                      <span :class="['inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold', ESTADO_ESTILO[it.estado].badge]"><i :class="['fa-solid mr-1', ESTADO_ESTILO[it.estado].icon]"></i>{{ it.estado }}</span>
                      <p v-if="esVencida(it)" class="text-[9px] text-rose-600 font-bold mt-0.5">Vencida</p>
                    </td>
                    <td class="p-2 text-center font-mono text-emerald-700 font-bold">{{ it.estado === 'Realizado' ? formatDateForDisplay(it.fecha_realizado) : '-' }}</td>
                    <td class="p-2 text-center"><button @click="verHistorialTarea(it)" class="text-slate-400 hover:text-teal-700 p-1" title="Historial de la tarea"><i class="fa-solid fa-clock-rotate-left"></i></button></td>
                  </template>
                </tr>
                </template>
                <tr v-if="!itemsFiltrados.length">
                  <td colspan="9" class="p-6 text-center text-slate-400 italic">{{ itemsSel.length ? 'Ninguna tarea coincide con el filtro.' : 'Esta minuta no tiene tareas. Agrégalas o importa un Excel.' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- ===================== DASHBOARD ===================== -->
        <div v-else class="flex-grow overflow-y-auto space-y-4 pr-1">
          <div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
            <div class="rounded-xl border p-3 bg-slate-50"><p class="text-[10px] font-bold text-slate-500 uppercase">Total</p><p class="text-2xl font-extrabold text-slate-800">{{ resumenSel.total }}</p></div>
            <div v-for="e in ESTADOS_MINUTA" :key="e" @click="filtroEstadoMinuta = e; vistaMinuta = 'tabla'" :class="['rounded-xl border p-3 cursor-pointer hover:shadow', ESTADO_ESTILO[e].badge]">
              <p class="text-[10px] font-bold uppercase"><i :class="['fa-solid mr-1', ESTADO_ESTILO[e].icon]"></i>{{ e }}</p><p class="text-2xl font-extrabold">{{ resumenSel[e] }}</p>
            </div>
            <div @click="filtroEstadoMinuta = 'VENCIDAS'; vistaMinuta = 'tabla'" class="rounded-xl border p-3 bg-rose-600 text-white cursor-pointer hover:shadow"><p class="text-[10px] font-bold uppercase"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Vencidas</p><p class="text-2xl font-extrabold">{{ resumenSel.vencidas }}</p></div>
            <div class="rounded-xl border p-3 bg-emerald-600 text-white"><p class="text-[10px] font-bold uppercase">A tiempo</p><p class="text-2xl font-extrabold">{{ resumenSel.pctATiempo }}%</p><p class="text-[9px] opacity-80">{{ resumenSel.aTiempo }} de {{ resumenSel.aTiempo + resumenSel.atrasadas }} realizadas</p></div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div class="border rounded-xl p-3"><p class="text-xs font-bold text-slate-700 mb-2">Estado de las tareas</p><div class="h-56"><canvas id="chartMinutaEstados"></canvas></div></div>
            <div class="border rounded-xl p-3 xl:col-span-2"><p class="text-xs font-bold text-slate-700 mb-2">Tareas por personal encargado</p><div class="h-56"><canvas id="chartMinutaPersonal"></canvas></div></div>
          </div>
          <div class="border rounded-xl p-3"><p class="text-xs font-bold text-slate-700 mb-2">Evolución semana a semana (% cumplimiento y tareas abiertas)</p><div class="h-60"><canvas id="chartMinutaEvolucion"></canvas></div></div>
          <div v-if="resumenPorSeccion.length > 1 || (resumenPorSeccion[0] && resumenPorSeccion[0].personal !== 'SIN SECCIÓN')" class="border rounded-xl overflow-hidden">
            <p class="text-xs font-bold text-slate-700 p-3 bg-slate-50 border-b">Cumplimiento por sección</p>
            <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 p-3">
              <div v-for="sc in resumenPorSeccion" :key="sc.personal" class="border rounded-lg p-2.5">
                <div class="flex justify-between text-[11px] font-bold text-slate-700"><span class="truncate">{{ sc.personal }}</span><span :class="sc.cumplimiento >= 80 ? 'text-emerald-600' : sc.cumplimiento >= 50 ? 'text-amber-600' : 'text-rose-600'">{{ sc.cumplimiento }}%</span></div>
                <div class="w-full bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden"><div class="h-1.5 bg-emerald-500" :style="{ width: sc.cumplimiento + '%' }"></div></div>
                <p class="text-[10px] text-slate-500 mt-1">{{ sc.Realizado }} de {{ sc.total }} realizadas<span v-if="sc.vencidas" class="text-rose-600 font-bold"> · {{ sc.vencidas }} vencidas</span></p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="border rounded-xl overflow-hidden">
              <p class="text-xs font-bold text-slate-700 p-3 bg-slate-50 border-b">Cumplimiento por encargado</p>
              <table class="w-full text-xs">
                <thead class="bg-slate-100 text-slate-600"><tr><th class="p-2 text-left">Encargado</th><th class="p-2">Total</th><th class="p-2">Realiz.</th><th class="p-2">Abiertas</th><th class="p-2">Vencidas</th><th class="p-2">%</th></tr></thead>
                <tbody>
                  <tr v-for="p in resumenPorPersonal" :key="p.personal" class="border-t">
                    <td class="p-2 font-semibold">{{ p.personal }}</td><td class="p-2 text-center">{{ p.total }}</td><td class="p-2 text-center text-emerald-700 font-bold">{{ p.Realizado }}</td>
                    <td class="p-2 text-center">{{ p.Pendiente + p.Proceso }}</td><td :class="['p-2 text-center', p.vencidas ? 'text-rose-600 font-bold' : '']">{{ p.vencidas }}</td>
                    <td class="p-2 text-center font-bold">{{ p.cumplimiento }}%</td>
                  </tr>
                  <tr v-if="!resumenPorPersonal.length"><td colspan="6" class="p-3 text-center text-slate-400 italic">Sin datos</td></tr>
                </tbody>
              </table>
            </div>
            <div class="border rounded-xl overflow-hidden">
              <p class="text-xs font-bold text-slate-700 p-3 bg-slate-50 border-b">Últimas tareas realizadas</p>
              <ul class="divide-y text-xs">
                <li v-for="it in realizadasRecientes" :key="it.id" class="p-2 flex gap-2">
                  <span class="font-mono font-bold text-emerald-700 shrink-0">{{ formatDateForDisplay(it.fecha_realizado) }}</span>
                  <span class="flex-1 truncate" :title="it.tarea">#{{ it.n_item }} {{ it.tarea }}</span>
                  <span class="text-slate-500 shrink-0">{{ it.personal }}</span>
                </li>
                <li v-if="!realizadasRecientes.length" class="p-3 text-center text-slate-400 italic">Aún no hay tareas realizadas</li>
              </ul>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="flex-grow flex flex-col items-center justify-center text-center text-slate-400 gap-3">
        <i class="fa-solid fa-clipboard-list text-5xl text-slate-300"></i>
        <p class="text-sm">Selecciona una minuta del panel izquierdo{{ puedeEditar ? ' o crea una nueva' : '' }}.</p>
      </div>
    </div>
  </div>

  <!-- ===================== MODAL NUEVA MINUTA ===================== -->
  <div v-if="showModalMinuta" class="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4" @click.self="showModalMinuta = false">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
      <div class="bg-teal-700 text-white px-5 py-3 flex items-center justify-between">
        <h3 class="font-bold text-sm"><i class="fa-solid fa-plus mr-2"></i> Nueva Minuta</h3>
        <button @click="showModalMinuta = false" class="hover:bg-white/10 w-8 h-8 rounded"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="p-5 space-y-4 text-xs">
        <div class="grid grid-cols-3 gap-3">
          <label class="col-span-1 space-y-1"><span class="font-bold text-slate-600">Fecha</span>
            <input v-model="formMinuta.fecha" @change="actualizarNombreSugerido" type="date" class="w-full p-2 border rounded-lg font-mono"></label>
          <label class="col-span-2 space-y-1"><span class="font-bold text-slate-600">Nombre</span>
            <input v-model="formMinuta.nombre" type="text" class="w-full p-2 border rounded-lg uppercase font-bold"></label>
        </div>
        <div v-if="ultimaMinuta" class="rounded-xl border border-teal-200 bg-teal-50 p-3 space-y-2">
          <label class="flex items-center gap-2 font-bold text-teal-900 cursor-pointer">
            <input v-model="formMinuta.copiar" type="checkbox" class="w-4 h-4 accent-teal-600">
            Continuar desde la última minuta: <span class="underline">{{ ultimaMinuta.nombre }}</span>
          </label>
          <label v-if="formMinuta.copiar" class="flex items-center gap-2 text-teal-800 cursor-pointer pl-6">
            <input v-model="formMinuta.incluirCerradas" type="checkbox" class="w-4 h-4 accent-teal-600">
            Incluir también las tareas cerradas (Realizado / No Realizado)
          </label>
          <p v-if="formMinuta.copiar" class="pl-6 text-teal-700">Se copiarán <b>{{ itemsACopiar.length }}</b> tarea(s) con su estado y fechas. La minuta anterior queda guardada sin cambios.</p>
        </div>
        <p v-else class="text-slate-500">Es la primera minuta: se crea vacía (luego agrega tareas o importa un Excel).</p>
      </div>
      <div class="px-5 py-3 bg-slate-50 border-t flex justify-end gap-2">
        <button @click="showModalMinuta = false" class="px-4 py-2 rounded-lg border text-xs font-bold text-slate-600 hover:bg-white">Cancelar</button>
        <button @click="guardarNuevaMinuta" :disabled="guardandoMinuta" class="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold disabled:opacity-50">
          <i :class="['fa-solid mr-1', guardandoMinuta ? 'fa-spinner fa-spin' : 'fa-check']"></i> Crear Minuta
        </button>
      </div>
    </div>
  </div>

  <!-- ===================== MODAL HISTORIAL DE TAREA ===================== -->
  <div v-if="tareaHistorial" class="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4" @click.self="tareaHistorial = null">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
      <div class="bg-slate-800 text-white px-5 py-3 flex items-center justify-between">
        <h3 class="font-bold text-sm truncate"><i class="fa-solid fa-clock-rotate-left mr-2"></i> Historial tarea N° {{ tareaHistorial.n_item }}</h3>
        <button @click="tareaHistorial = null" class="hover:bg-white/10 w-8 h-8 rounded"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="p-5 space-y-3 text-xs max-h-[70vh] overflow-y-auto">
        <p class="bg-slate-50 border rounded-lg p-3 whitespace-pre-line">{{ tareaHistorial.tarea }}</p>
        <table class="w-full">
          <thead class="bg-slate-100 text-slate-600"><tr><th class="p-2 text-left">Minuta</th><th class="p-2">Encargado</th><th class="p-2">F. Estimada</th><th class="p-2">Estado</th><th class="p-2">F. Realizado</th></tr></thead>
          <tbody>
            <tr v-for="f in tareaHistorial.filas" :key="f.minuta.id" class="border-t">
              <td class="p-2"><span class="font-semibold">{{ f.minuta.nombre }}</span><br><span class="font-mono text-slate-400">{{ formatDateForDisplay(f.minuta.fecha) }}</span></td>
              <td class="p-2 text-center">{{ f.item.personal || '-' }}</td>
              <td class="p-2 text-center font-mono">{{ formatDateForDisplay(f.item.fecha_estimada) }}</td>
              <td class="p-2 text-center"><span :class="['inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold', ESTADO_ESTILO[f.item.estado].badge]">{{ f.item.estado }}</span></td>
              <td class="p-2 text-center font-mono text-emerald-700 font-bold">{{ f.item.estado === 'Realizado' ? formatDateForDisplay(f.item.fecha_realizado) : '-' }}</td>
            </tr>
          </tbody>
        </table>
        <p class="text-[10px] text-slate-400">Se busca la misma tarea (mismo N° y mismo texto) en todas las minutas.</p>
      </div>
    </div>
  </div>
  <!-- ===================== MODAL IMPORTAR (Word / Excel) ===================== -->
  <div v-if="showModalImportar" class="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4" @click.self="!importacion.guardando && (showModalImportar = false)">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
      <div class="bg-sky-700 text-white px-5 py-3 flex items-center justify-between">
        <h3 class="font-bold text-sm"><i class="fa-solid fa-file-import mr-2"></i> Importar minutas (Word / Excel)</h3>
        <button @click="showModalImportar = false" :disabled="importacion.guardando" class="hover:bg-white/10 w-8 h-8 rounded"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div class="p-5 space-y-4 text-xs overflow-y-auto">
        <div v-if="importacion.leyendo" class="text-slate-500 py-6 text-center"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Leyendo archivos...</div>

        <template v-else>
          <!-- Un bloque por archivo -->
          <div v-for="(a, idx) in importacion.archivos" :key="idx" :class="['rounded-xl border p-3 space-y-2', a.error ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50']">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="font-bold text-slate-800 truncate"><i :class="['fa-solid mr-1', a.archivo.toLowerCase().includes('.doc') ? 'fa-file-word text-sky-700' : 'fa-file-excel text-emerald-700']"></i> {{ a.archivo }}</p>
              <span v-if="!a.error" class="font-bold text-teal-700">{{ a.tareas.length }} tarea(s) encontradas</span>
            </div>
            <p v-if="a.error" class="text-rose-700 font-semibold"><i class="fa-solid fa-triangle-exclamation mr-1"></i> {{ a.error }}</p>
            <template v-else>
              <div v-if="importacion.destino === 'nueva'" class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <label class="space-y-1"><span class="font-bold text-slate-600">Fecha de la minuta</span>
                  <input v-model="a.fecha" @change="cambiarFechaImport(a)" type="date" class="w-full p-2 border rounded-lg font-mono font-bold">
                  <span :class="['block text-[10px]', /no encontrada/.test(a.origenFecha) ? 'text-amber-700 font-bold' : 'text-slate-500']">Fecha {{ /elegida/.test(a.origenFecha) ? a.origenFecha : 'tomada de: ' + a.origenFecha }}</span>
                </label>
                <label class="space-y-1 md:col-span-2"><span class="font-bold text-slate-600">Nombre</span>
                  <input v-model="a.nombre" type="text" class="w-full p-2 border rounded-lg uppercase font-bold">
                  <span v-if="fechaYaExiste(a.fecha)" class="block text-[10px] text-amber-700 font-bold"><i class="fa-solid fa-circle-info"></i> Ya hay una minuta con esta fecha; se creará otra igual.</span>
                </label>
              </div>
              <button @click="a.verDetalle = !a.verDetalle" class="text-sky-700 font-bold underline">{{ a.verDetalle ? 'Ocultar' : 'Ver' }} tareas leídas</button>
              <div v-if="a.verDetalle" class="max-h-56 overflow-auto border rounded-lg bg-white">
                <table class="w-full text-[11px]">
                  <thead class="bg-slate-100 text-slate-600 sticky top-0"><tr><th class="p-1.5">N°</th><th class="p-1.5 text-left">Sección / Área</th><th class="p-1.5 text-left">Encargado</th><th class="p-1.5">F. Compromiso</th><th class="p-1.5">F. Estimada</th><th class="p-1.5 text-left">Tarea</th><th class="p-1.5">Estado</th><th class="p-1.5">F. Realizado</th></tr></thead>
                  <tbody>
                    <tr v-for="(t, k) in a.tareas" :key="k" class="border-t align-top">
                      <td class="p-1.5 text-center">{{ t.n_item || '-' }}</td>
                      <td class="p-1.5"><span class="font-bold">{{ t.seccion || '-' }}</span><span class="block text-slate-500">{{ t.area }}</span></td>
                      <td class="p-1.5">{{ t.personal || '-' }}</td>
                      <td class="p-1.5 text-center font-mono">{{ t.fecha_compromiso ? formatDateForDisplay(t.fecha_compromiso) : 'Fecha minuta' }}</td>
                      <td class="p-1.5 text-center font-mono">{{ t.fecha_estimada || !t.fecha_texto ? formatDateForDisplay(t.fecha_estimada) : '' }}<span v-if="t.fecha_texto" class="block font-sans font-bold text-indigo-700">{{ t.fecha_texto }}</span></td>
                      <td class="p-1.5 whitespace-pre-line">{{ t.tarea }}</td>
                      <td class="p-1.5 text-center"><span :class="['px-1.5 py-0.5 rounded-full border font-bold', ESTADO_ESTILO[t.estado].badge]">{{ t.estado }}</span></td>
                      <td class="p-1.5 text-center font-mono">{{ formatDateForDisplay(t.fecha_realizado) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
          </div>

          <!-- Dónde guardar -->
          <div v-if="archivosValidos.length" class="rounded-xl border border-teal-200 bg-teal-50 p-3 space-y-2">
            <p class="font-bold text-teal-900">¿Dónde guardar?</p>
            <label class="flex items-center gap-2 cursor-pointer"><input v-model="importacion.destino" type="radio" value="nueva" class="accent-teal-600">
              Crear {{ archivosValidos.length > 1 ? archivosValidos.length + ' minutas nuevas (una por archivo)' : 'una minuta nueva' }} con la fecha indicada</label>
            <template v-if="minutaSel && puedeEditarMinuta">
              <label class="flex items-center gap-2 cursor-pointer"><input v-model="importacion.destino" type="radio" value="agregar" class="accent-teal-600"> Agregar las tareas a la minuta seleccionada ({{ minutaSel.nombre }})</label>
              <label class="flex items-center gap-2 cursor-pointer"><input v-model="importacion.destino" type="radio" value="reemplazar" class="accent-teal-600"> Reemplazar las tareas de la minuta seleccionada ({{ minutaSel.nombre }})</label>
            </template>
            <p v-if="importacion.destino === 'nueva' && actualTrasImportar" class="text-teal-800"><i class="fa-solid fa-star mr-1"></i> Quedará como <b>ACTUAL</b> la minuta con la fecha más reciente: <b>{{ formatDateForDisplay(actualTrasImportar) }}</b>.</p>
          </div>
        </template>
      </div>

      <div class="px-5 py-3 bg-slate-50 border-t flex flex-wrap items-center justify-between gap-2">
        <p class="text-[10px] text-slate-500">Word: "Fecha de Compromiso" del Word → Fecha Estimada (plazo). Fecha Compromiso = fecha de la minuta donde apareció la tarea por primera vez. "Cumple": 1 = Realizado, 0 = No Realizado, vacío = Pendiente.</p>
        <div class="flex gap-2">
          <button @click="showModalImportar = false" :disabled="importacion.guardando" class="px-4 py-2 rounded-lg border text-xs font-bold text-slate-600 hover:bg-white">Cancelar</button>
          <button @click="confirmarImportacion" :disabled="importacion.leyendo || importacion.guardando || !archivosValidos.length" class="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold disabled:opacity-50">
            <i :class="['fa-solid mr-1', importacion.guardando ? 'fa-spinner fa-spin' : 'fa-check']"></i> Importar {{ archivosValidos.reduce((s, a) => s + a.tareas.length, 0) }} tarea(s)
          </button>
        </div>
      </div>
    </div>
  </div>
</section>
`;
