// =====================================================================
// PROGRAMA REPARACIÓN MOTORES · plantilla
// =====================================================================
export default /* html */ `
<div class="space-y-4 text-xs">
  <!-- Encabezado -->
  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center text-xl"><i class="fa-solid fa-gear"></i></div>
        <div>
          <h2 class="text-lg font-extrabold text-slate-800 leading-tight">PROGRAMA REPARACIÓN MOTORES</h2>
          <p class="text-slate-500">Motores de compresores enviados a proveedores externos o taller · status, etapa y fechas</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button @click="cargarMotores" title="Actualizar" class="w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><i :class="['fa-solid fa-rotate', cargandoMotores ? 'fa-spin' : '']"></i></button>
        <button @click="exportarMotoresExcel" :disabled="exportandoMotores || !dbMotores.length" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl shadow disabled:opacity-50"><i :class="['fa-solid mr-1', exportandoMotores ? 'fa-spinner fa-spin' : 'fa-file-excel']"></i> Exportar Excel</button>
        <button v-if="puedeEditar" @click="abrirNuevoMotor" class="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl shadow"><i class="fa-solid fa-truck-arrow-right mr-1"></i> Enviar equipo</button>
      </div>
    </div>
    <!-- KPI (clic = filtrar) -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
      <button v-for="k in [{ e: '', t: 'Total', n: resumenMotores.total, c: 'bg-white text-slate-800 border-slate-200' },
                           { e: 'PROCESO', t: 'Proceso', n: resumenMotores.PROCESO, c: 'bg-sky-50 text-sky-800 border-sky-200' },
                           { e: 'PENDIENTE', t: 'Pendiente', n: resumenMotores.PENDIENTE, c: 'bg-amber-50 text-amber-800 border-amber-200' },
                           { e: 'TERMINADO', t: 'Terminado', n: resumenMotores.TERMINADO, c: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                           { e: 'ATRASADO', t: 'Atrasados', n: resumenMotores.ATRASADO, c: resumenMotores.ATRASADO ? 'bg-rose-50 text-rose-700 border-rose-300' : 'bg-white text-slate-400 border-slate-200' }]" :key="k.e"
        @click="filtroMotores.estado = k.e" :class="['rounded-xl border p-3 text-left transition hover:shadow', k.c, filtroMotores.estado === k.e ? 'ring-2 ring-orange-400' : '']">
        <p class="text-[10px] font-extrabold uppercase opacity-80">{{ k.t }}</p><p class="text-2xl font-extrabold">{{ k.n }}</p>
      </button>
    </div>
  </div>

  <div v-if="faltaSQLMotores" class="bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl p-4 text-sm">
    <i class="fa-solid fa-database mr-1"></i> Falta crear la tabla: ejecuta <b>sql/motores_externos.sql</b> en Supabase → SQL Editor → Run (incluye la carga del programa escrito a mano) y luego actualiza.
  </div>

  <!-- Filtros -->
  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <div class="p-3 border-b flex flex-wrap items-center gap-2">
      <div class="relative flex-1 min-w-[200px]">
        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <input v-model="filtroMotores.texto" placeholder="Buscar AFI, proveedor, trabajo..." class="w-full border rounded-lg pl-8 pr-3 py-2">
      </div>
      <select v-model="filtroMotores.proveedor" class="border rounded-lg px-3 py-2 font-semibold">
        <option value="">Todos los proveedores</option><option v-for="p in proveedoresUsados" :key="p" :value="p">{{ p }}</option>
      </select>
      <select v-model="filtroMotores.estado" class="border rounded-lg px-3 py-2 font-semibold">
        <option value="">Todos los status</option><option v-for="e in ESTADOS" :key="e" :value="e">{{ e }}</option><option value="ATRASADO">ATRASADOS</option>
      </select>
    </div>

    <!-- Tabla -->
    <div class="overflow-x-auto">
      <table class="w-full text-left whitespace-nowrap">
        <thead class="bg-slate-800 text-white uppercase text-[10px]">
          <tr><th class="p-2.5">Status</th><th class="p-2.5">AFI / Equipo</th><th class="p-2.5">Proveedor / taller</th><th class="p-2.5">Inicio proceso</th><th class="p-2.5">Etapa actual (desde → hasta)</th><th class="p-2.5">Historial del equipo</th><th class="p-2.5">Observación</th><th class="p-2.5 text-center">Acciones</th></tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="m in listaMotores" :key="m.id" :class="['align-top hover:bg-slate-50', atrasado(m) ? 'bg-rose-50/60' : m.estado === 'TERMINADO' ? 'bg-emerald-50/40' : '']">
            <td class="p-2.5">
              <select v-if="puedeEditar" :value="m.estado" @change="cambiarEstadoMotor(m, $event.target.value)" :class="['px-2 py-1 rounded-full border text-[10px] font-extrabold', ESTILO_ESTADO[m.estado]]">
                <option v-for="e in ESTADOS" :key="e" :value="e">({{ e }})</option>
              </select>
              <span v-else :class="['px-2 py-1 rounded-full border text-[10px] font-extrabold', ESTILO_ESTADO[m.estado]]">({{ m.estado }})</span>
            </td>
            <td class="p-2.5">
              <button @click="verDetallePorAfiString(m.afi)" class="font-extrabold text-amber-700 hover:underline">AFI {{ m.afi }}</button>
              <span class="block text-[10px] text-slate-500">{{ descEquipo(m.afi) }}</span>
            </td>
            <td class="p-2.5 font-bold text-slate-700"><i class="fa-solid fa-warehouse text-slate-400 mr-1"></i>{{ m.proveedor || '—' }}</td>
            <td class="p-2.5 font-mono">
              <span v-if="inicioProceso(m)">{{ formatDateForDisplay(inicioProceso(m)) }}</span><span v-else class="text-slate-400 font-sans italic">sin fecha</span>
              <span v-if="diasFuera(m) !== null" class="block text-[10px] font-sans text-slate-500">{{ diasFuera(m) }} día(s) en proceso</span>
            </td>
            <td class="p-2.5 whitespace-normal min-w-[190px]">
              <span class="font-bold text-slate-800">{{ m.trabajo || '—' }}</span>
              <span class="block font-mono text-[11px] text-slate-600">{{ m.fecha_envio ? formatDateForDisplay(m.fecha_envio) : '¿?' }} → {{ m.fecha_termino ? formatDateForDisplay(m.fecha_termino) : '¿?' }}</span>
              <span v-if="textoTermino(m)" :class="['block text-[10px] font-bold', atrasado(m) ? 'text-rose-600' : 'text-slate-500']">{{ textoTermino(m) }}</span>
            </td>
            <td class="p-2.5 whitespace-normal min-w-[220px]">
              <!-- línea de tiempo de todo lo que ha pasado con el equipo -->
              <ol class="relative border-l-2 border-slate-200 ml-1.5 space-y-1.5">
                <li v-for="(e, k) in (verEtapas === m.id ? historialMotor(m) : historialMotor(m).slice(-3))" :key="k" class="pl-3 relative">
                  <span :class="['absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 border-white', e.actual ? (e.estado === 'TERMINADO' ? 'bg-emerald-500' : 'bg-orange-500') : 'bg-slate-400']"></span>
                  <span class="font-mono text-[10px] text-slate-500">{{ e.desde ? formatDateForDisplay(e.desde) : '¿?' }} → {{ e.fecha ? formatDateForDisplay(e.fecha) : '¿?' }}</span>
                  <span :class="['block text-[11px] leading-tight', e.actual ? 'font-extrabold text-slate-800' : 'font-semibold text-slate-600']">{{ e.trabajo || '—' }} <span class="font-normal text-slate-400">· {{ e.proveedor }}</span></span>
                  <span v-if="e.nota" class="block text-[10px] text-slate-500 italic">{{ e.nota }}</span>
                </li>
              </ol>
              <button v-if="historialMotor(m).length > 3" @click="verEtapas = verEtapas === m.id ? null : m.id" class="mt-1 text-[10px] font-bold text-indigo-600 hover:underline">{{ verEtapas === m.id ? 'Ver menos' : 'Ver todo (' + historialMotor(m).length + ' etapas)' }}</button>
            </td>
            <td class="p-2.5 whitespace-normal min-w-[160px] text-slate-600">{{ m.observacion }}</td>
            <td class="p-2.5 text-center">
              <div class="flex justify-center gap-1">
                <button v-if="puedeEditar && m.estado !== 'TERMINADO'" @click="abrirNuevaEtapa(m)" title="Anotar lo que sigue: la etapa actual queda guardada en el historial" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg font-bold"><i class="fa-solid fa-plus mr-0.5"></i>Nueva etapa</button>
                <button v-if="puedeEditar" @click="abrirEditarMotor(m)" title="Editar" class="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg"><i class="fa-solid fa-pen-to-square"></i></button>
                <button v-if="isAdmin" @click="eliminarMotor(m)" title="Eliminar" class="text-rose-500 hover:bg-rose-50 px-2 py-1 rounded-lg"><i class="fa-solid fa-trash"></i></button>
              </div>
            </td>
          </tr>
          <tr v-if="!listaMotores.length"><td colspan="8" class="p-10 text-center text-slate-400 font-bold">{{ dbMotores.length ? 'No hay equipos con este filtro.' : 'Aún no hay equipos en el programa. Presiona "Enviar equipo".' }}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Ventana enviar / editar / nueva etapa -->
  <div v-if="formMotor" class="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-3" @click.self="cerrarFormMotor">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[94vh] overflow-y-auto">
      <div class="flex items-center justify-between px-5 py-4 border-b bg-slate-50 rounded-t-2xl">
        <h3 class="font-extrabold text-slate-800 text-base">
          <i :class="['fa-solid mr-2', formMotor.modo === 'etapa' ? 'fa-forward-step text-indigo-600' : formMotor.modo === 'nuevo' ? 'fa-truck-arrow-right text-orange-500' : 'fa-pen text-blue-600']"></i>
          {{ formMotor.modo === 'nuevo' ? 'Enviar equipo a reparar motor' : formMotor.modo === 'etapa' ? 'Nueva etapa · AFI ' + formMotor.afi : 'Editar · AFI ' + formMotor.afi }}
        </h3>
        <button @click="cerrarFormMotor" class="w-9 h-9 rounded-lg hover:bg-slate-200 text-slate-500"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="p-5 space-y-4">
        <div v-if="formMotor.modo === 'etapa'" class="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-indigo-900">
          <b>Etapa actual:</b> {{ formMotor._anterior.trabajo || '—' }} · {{ formMotor._anterior.proveedor }} · {{ formatDateForDisplay(formMotor._anterior.fecha_envio) }} → {{ formatDateForDisplay(formMotor._anterior.fecha_termino) || 'sin fecha' }}.
          Al guardar queda en el historial del equipo y se anota la etapa nueva.
          <label class="flex items-center gap-2 mt-2 font-bold">La etapa actual terminó el
            <input type="date" v-model="formMotor._cierreAnterior" class="p-1.5 border rounded-lg font-mono bg-white text-slate-800"></label>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label class="block"><span class="font-bold text-slate-700">Equipo (AFI) *</span>
            <select v-model="formMotor.afi" :disabled="formMotor.modo !== 'nuevo'" class="mt-1 w-full p-2.5 border rounded-lg bg-white font-bold disabled:bg-slate-100">
              <option value="">-- Elegir compresor --</option>
              <option v-for="e in equiposElegibles" :key="e.afi" :value="e.afi">AFI {{ e.afi }} · {{ e.marca }} {{ e.modelo }}</option>
              <option v-if="formMotor.afi && !equiposElegibles.some(e => e.afi === formMotor.afi)" :value="formMotor.afi">AFI {{ formMotor.afi }}</option>
            </select>
            <span class="text-[10px] text-slate-400">Por ahora solo compresores ({{ equiposElegibles.length }} en el inventario).</span>
          </label>
          <label class="block"><span class="font-bold text-slate-700">Proveedor / taller *</span>
            <input v-model="formMotor.proveedor" list="dl-motores-prov" placeholder="Ej: DIEGO TORRES" class="mt-1 w-full p-2.5 border rounded-lg uppercase font-bold">
            <datalist id="dl-motores-prov"><option v-for="p in proveedoresUsados" :key="p" :value="p"></option></datalist>
          </label>
          <label class="block"><span class="font-bold text-slate-700">{{ formMotor.modo === 'etapa' ? 'Desde (inicio de la etapa nueva)' : 'Fecha en que se lleva / se llevó' }}</span>
            <input type="date" v-model="formMotor.fecha_envio" class="mt-1 w-full p-2.5 border rounded-lg font-mono"></label>
          <label class="block"><span class="font-bold text-slate-700">Fecha término de esta etapa</span>
            <input type="date" v-model="formMotor.fecha_termino" :min="formMotor.fecha_envio || undefined" class="mt-1 w-full p-2.5 border rounded-lg font-mono">
            <span class="text-[10px] text-slate-400">Estimada o real. Vacía si aún no se sabe.</span></label>
        </div>
        <label class="block"><span class="font-bold text-slate-700">Trabajo / etapa</span>
          <input v-model="formMotor.trabajo" list="dl-motores-trab" placeholder="Ej: Evaluación, Reparación inyectores, Montaje motor ajustado y pruebas..." class="mt-1 w-full p-2.5 border rounded-lg font-bold">
          <datalist id="dl-motores-trab"><option v-for="t in trabajosUsados" :key="t" :value="t"></option></datalist>
          <div class="flex flex-wrap gap-1 mt-1.5">
            <button v-for="t in TRABAJOS_BASE.slice(0, 7)" :key="t" type="button" @click="formMotor.trabajo = t" :class="['text-[10px] font-bold px-2 py-0.5 rounded-md border', formMotor.trabajo === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 hover:bg-slate-100']">{{ t }}</button>
          </div>
        </label>
        <div><span class="font-bold text-slate-700">Status</span>
          <div class="mt-1 grid grid-cols-3 gap-2">
            <button v-for="e in ESTADOS" :key="e" type="button" @click="formMotor.estado = e" :class="['py-2 rounded-xl border-2 font-extrabold', formMotor.estado === e ? ESTILO_ESTADO[e] + ' ring-2 ring-offset-1 ring-slate-400' : 'bg-white text-slate-500 border-slate-200']">({{ e }})</button>
          </div>
        </div>
        <label class="block"><span class="font-bold text-slate-700">Observación</span>
          <textarea v-model="formMotor.observacion" rows="3" placeholder="Ej: motor ajustado presenta problemas, desmontar y enviar a D. Torres..." class="mt-1 w-full p-2.5 border rounded-lg"></textarea></label>
      </div>
      <div class="flex justify-end gap-2 px-5 py-3 border-t bg-slate-50 rounded-b-2xl">
        <button @click="cerrarFormMotor" class="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200">Cancelar</button>
        <button @click="guardarMotor" :disabled="guardandoMotor" class="px-5 py-2 rounded-lg font-bold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-60"><i :class="['fa-solid mr-1', guardandoMotor ? 'fa-spinner fa-spin' : 'fa-floppy-disk']"></i>Guardar</button>
      </div>
    </div>
  </div>
</div>
`;
