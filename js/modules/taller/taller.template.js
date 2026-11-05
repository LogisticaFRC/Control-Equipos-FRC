// Plantilla HTML del TALLER (Programas Reparación → Taller): pensada para el PC del taller, letra y botones grandes.
export default /* html */ `
<section class="space-y-5">

  <div v-if="faltaTablaTaller" class="bg-rose-50 border-2 border-rose-300 text-rose-800 rounded-2xl p-4 text-sm font-semibold">
    <i class="fa-solid fa-triangle-exclamation mr-1"></i> Falta ejecutar <b>sql/taller.sql</b> en Supabase (SQL Editor → Run). Mientras tanto no se pueden ingresar equipos a las naves.
  </div>

  <!-- ===================== CABECERA ===================== -->
  <div class="bg-slate-900 text-white rounded-2xl shadow-lg p-5 flex flex-wrap items-center justify-between gap-4">
    <div class="min-w-0">
      <h2 class="text-2xl font-black tracking-tight flex items-center gap-3"><i class="fa-solid fa-warehouse text-amber-400"></i> TALLER · NAVES DE REPARACIÓN</h2>
      <div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span class="text-slate-400 font-semibold">Programa:</span>
        <select v-model="programaTallerId" class="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 font-bold text-amber-300">
          <option value="">{{ programaTaller ? 'Vigente: ' + nombreProg(programaTaller) : 'Sin programas de reparación' }}</option>
          <option v-for="p in programasReparacion" :key="p.id" :value="p.id">{{ nombreProg(p) }} ({{ formatDateForDisplay(p.fecha_inicio_programa) }} al {{ formatDateForDisplay(p.fecha_termino_programa) }}){{ programaVigente(p) ? ' · vigente' : '' }}</option>
        </select>
        <span v-if="programaTaller" class="font-mono text-slate-300">{{ formatDateForDisplay(programaTaller.fecha_inicio_programa) }} → {{ formatDateForDisplay(programaTaller.fecha_termino_programa) }}</span>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <div class="text-center px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-400/40"><p class="text-[10px] font-bold uppercase text-amber-300">En naves</p><p class="text-2xl font-black">{{ NAVES.length - navesLibres.length }}/{{ NAVES.length }}</p></div>
      <div class="text-center px-4 py-2 rounded-xl bg-slate-700/60 border border-slate-600"><p class="text-[10px] font-bold uppercase text-slate-300">Por ingresar</p><p class="text-2xl font-black">{{ resumenPrograma.PENDIENTE.length }}</p></div>
      <div class="text-center px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-400/40"><p class="text-[10px] font-bold uppercase text-rose-300">Con faltantes</p><p class="text-2xl font-black">{{ repsConFaltantes.length }}</p></div>
      <div class="text-center px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/40"><p class="text-[10px] font-bold uppercase text-emerald-300">Listos programa</p><p class="text-2xl font-black">{{ resumenPrograma.LISTO.length }}<span class="text-sm font-bold text-emerald-300"> / {{ totalPrograma }}</span></p></div>
      <div class="flex flex-col gap-1.5 ml-1">
        <button @click="actualizarTodo" :disabled="cargandoTaller" class="bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-60"><i :class="['fa-solid mr-1', cargandoTaller ? 'fa-spinner fa-spin' : 'fa-arrows-rotate']"></i> Actualizar<span v-if="horaActualizacion" class="font-normal text-slate-400"> · {{ horaActualizacion }}</span></button>
        <button @click="alternarPantallaCompleta" class="bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-3 py-1.5 text-xs font-bold"><i :class="['fa-solid mr-1', pantallaCompleta ? 'fa-compress' : 'fa-expand']"></i> {{ pantallaCompleta ? 'Salir pantalla completa' : 'Pantalla completa' }}</button>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 xl:grid-cols-4 gap-5">

    <!-- ===================== NAVES (tarjetas grandes) ===================== -->
    <div class="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-5">
      <template v-for="nave in NAVES" :key="nave">

        <!-- Nave OCUPADA -->
        <div v-if="repEnNave(nave)" class="bg-white rounded-3xl shadow-lg border-2 border-amber-400 overflow-hidden flex flex-col">
          <div class="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
            <span class="text-2xl font-black tracking-wide"><i class="fa-solid fa-warehouse text-amber-400 mr-2"></i>{{ nave }}</span>
            <span class="text-xs font-bold bg-amber-500 text-slate-950 px-3 py-1 rounded-full uppercase">En reparación</span>
          </div>
          <div class="relative cursor-pointer" @click="abrirReparar(repEnNave(nave))" title="Abrir la OT para reparar">
            <img :src="fotoDe(repEnNave(nave).afi)" :alt="'AFI ' + repEnNave(nave).afi" class="w-full h-56 object-cover bg-slate-800">
            <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent px-5 pt-10 pb-3">
              <p class="text-white text-3xl font-black drop-shadow">AFI {{ repEnNave(nave).afi }}</p>
              <p class="text-slate-200 text-sm font-semibold truncate">{{ descEquipo(repEnNave(nave).afi) }}</p>
            </div>
          </div>
          <div class="p-5 space-y-3 flex-grow flex flex-col">
            <div class="flex flex-wrap gap-2 text-xs font-bold">
              <span v-if="repEnNave(nave).programa_id != null" class="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800"><i class="fa-solid fa-calendar-check mr-1"></i>{{ nombreProgId(repEnNave(nave).programa_id) }}</span>
              <span v-else class="px-2.5 py-1 rounded-lg bg-violet-100 text-violet-800"><i class="fa-solid fa-circle-plus mr-1"></i>Sin programa</span>
              <span v-for="o in otsDeRep(repEnNave(nave))" :key="o.id" class="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-mono">OT {{ o.folio }}</span>
              <span v-if="!otsDeRep(repEnNave(nave)).length" class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500">Sin OT</span>
              <span class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600"><i class="fa-regular fa-clock mr-1"></i>{{ tiempoEnNave(repEnNave(nave)) }}</span>
            </div>
            <!-- Avance -->
            <div>
              <div class="flex items-end justify-between">
                <span class="text-xs font-bold uppercase text-slate-500">Avance</span>
                <span :class="['text-4xl font-black leading-none', textoAvance(progresoRep(repEnNave(nave)).pct)]">{{ progresoRep(repEnNave(nave)).pct }}%</span>
              </div>
              <div class="w-full h-5 bg-slate-200 rounded-full overflow-hidden mt-1.5 shadow-inner">
                <div :class="['h-5 rounded-full transition-all duration-700', colorAvance(progresoRep(repEnNave(nave)).pct)]" :style="{ width: progresoRep(repEnNave(nave)).pct + '%' }"></div>
              </div>
              <p class="text-xs text-slate-500 font-semibold mt-1">{{ progresoRep(repEnNave(nave)).sinOT ? 'Presiona REPARAR para crear la OT' : progresoRep(repEnNave(nave)).done + ' de ' + progresoRep(repEnNave(nave)).total + ' actividades terminadas' }}</p>
            </div>
            <div v-if="repEnNave(nave).faltante" class="text-xs bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-2 whitespace-pre-line"><b><i class="fa-solid fa-triangle-exclamation mr-1"></i>Le faltaba:</b> {{ repEnNave(nave).faltante }}</div>
            <div class="flex gap-3 pt-1 mt-auto">
              <button @click="abrirReparar(repEnNave(nave))" class="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-lg font-black py-3.5 rounded-2xl shadow"><i class="fa-solid fa-screwdriver-wrench mr-2"></i>REPARAR</button>
              <button v-if="puedeEditar" @click="abrirSalida(repEnNave(nave))" class="bg-slate-800 hover:bg-slate-900 text-white text-base font-bold px-5 py-3.5 rounded-2xl shadow"><i class="fa-solid fa-right-from-bracket mr-2"></i>Sacar</button>
            </div>
          </div>
        </div>

        <!-- Nave VACÍA -->
        <div v-else class="rounded-3xl border-4 border-dashed border-slate-300 bg-white/70 min-h-[420px] flex flex-col items-center justify-center p-6 text-center gap-3">
          <span class="text-3xl font-black text-slate-400"><i class="fa-solid fa-warehouse mr-2"></i>{{ nave }}</span>
          <span class="text-sm font-bold uppercase text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">Disponible</span>
          <div v-if="recomendadoParaNave(nave)" class="mt-2 bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-3 text-left max-w-sm">
            <img :src="fotoDe(recomendadoParaNave(nave).item.afi)" class="w-20 h-14 rounded-lg object-cover bg-slate-200" alt="">
            <div class="min-w-0">
              <p class="text-[10px] font-extrabold uppercase text-amber-700"><i class="fa-solid fa-star mr-1"></i>Recomendado del programa</p>
              <p class="font-black text-slate-800">AFI {{ recomendadoParaNave(nave).item.afi }}</p>
              <p class="text-xs text-slate-500 truncate">{{ descEquipo(recomendadoParaNave(nave).item.afi) }}</p>
            </div>
          </div>
          <button v-if="puedeEditar && !faltaTablaTaller" @click="abrirIngreso(nave)" class="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-black px-8 py-4 rounded-2xl shadow-lg"><i class="fa-solid fa-plus mr-2"></i>Ingresar equipo</button>
        </div>
      </template>
    </div>

    <!-- ===================== COLUMNA DERECHA ===================== -->
    <div class="space-y-5">
      <!-- Equipos reparación sin programa -->
      <div class="bg-white rounded-2xl shadow-sm border-2 border-violet-200 overflow-hidden">
        <div class="bg-violet-600 text-white px-4 py-3 font-extrabold text-sm flex items-center justify-between">
          <span><i class="fa-solid fa-circle-plus mr-1.5"></i> Equipos reparación sin programa</span>
          <span class="bg-white/20 rounded-full px-2 text-xs">{{ repsSinPrograma.length }}</span>
        </div>
        <div v-if="puedeEditar && !faltaTablaTaller" class="p-3 border-b bg-violet-50 flex gap-2">
          <input v-model="afiSinProg" list="dl-taller-afi" @keyup.enter="agregarSinProg" placeholder="AFI del equipo..." class="flex-1 min-w-0 p-2 border rounded-lg text-sm font-bold uppercase">
          <button @click="agregarSinProg" :disabled="!afiSinProg" class="bg-violet-600 hover:bg-violet-700 text-white font-bold px-3 rounded-lg text-sm disabled:opacity-50"><i class="fa-solid fa-plus"></i> Agregar</button>
        </div>
        <div class="divide-y max-h-[420px] overflow-y-auto">
          <div v-for="r in repsSinPrograma" :key="r.id" class="p-3 flex gap-3">
            <img :src="fotoDe(r.afi)" class="w-16 h-12 rounded-lg object-cover bg-slate-200 shrink-0" alt="">
            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex items-center justify-between gap-1">
                <span class="font-black text-slate-800 cursor-pointer hover:underline" @click="verDetallePorAfiString(r.afi)">AFI {{ r.afi }}</span>
                <span :class="['text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap', ESTILO_ESTADO[r.estado]]">{{ r.estado === 'EN_NAVE' ? r.nave : ETIQUETA_ESTADO[r.estado] }}</span>
              </div>
              <p class="text-[11px] text-slate-500 truncate">{{ descEquipo(r.afi) }}</p>
              <p class="text-[11px] font-mono text-rose-700"><span v-for="o in otsDeRep(r)" :key="o.id" class="mr-1.5">OT {{ o.folio }}</span><span v-if="!otsDeRep(r).length" class="text-slate-400 font-sans">Sin OT</span></p>
              <div v-if="r.estado !== 'EN_NAVE' && puedeEditar" class="flex gap-1.5 pt-0.5">
                <select v-model="naveDestino[r.id]" class="flex-1 p-1.5 border rounded-lg text-xs font-bold"><option value="">Ingresar a nave...</option><option v-for="n in navesLibres" :key="n" :value="n">{{ n }}</option></select>
                <button @click="ingresarDesdeLista(r)" :disabled="!naveDestino[r.id] || ocupado" class="bg-emerald-600 text-white rounded-lg px-2.5 text-xs font-bold disabled:opacity-40"><i class="fa-solid fa-arrow-right-to-bracket"></i></button>
                <button @click="abrirReparar(r)" class="bg-amber-100 text-amber-900 rounded-lg px-2.5 text-xs font-bold" title="Ver / crear OT"><i class="fa-solid fa-file-signature"></i></button>
                <button v-if="isAdmin" @click="quitarReparacion(r)" class="text-rose-500 hover:text-rose-700 px-1.5" title="Quitar de la lista"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          </div>
          <p v-if="!repsSinPrograma.length" class="p-4 text-xs text-slate-400 italic">Sin equipos. Se agregan aquí al ingresar un “equipo nuevo” a una nave, desde una OT o con el cuadro de arriba.</p>
        </div>
      </div>

      <!-- Con faltantes -->
      <div class="bg-white rounded-2xl shadow-sm border-2 border-rose-200 overflow-hidden">
        <div class="bg-rose-600 text-white px-4 py-3 font-extrabold text-sm flex items-center justify-between">
          <span><i class="fa-solid fa-triangle-exclamation mr-1.5"></i> Salieron con faltantes</span>
          <span class="bg-white/20 rounded-full px-2 text-xs">{{ repsConFaltantes.length }}</span>
        </div>
        <div class="divide-y max-h-[420px] overflow-y-auto">
          <div v-for="r in repsConFaltantes" :key="r.id" class="p-3 space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <span class="font-black text-slate-800">AFI {{ r.afi }}</span>
              <span class="text-[10px] font-bold text-slate-500">{{ r.programa_id != null ? nombreProgId(r.programa_id) : 'Sin programa' }}</span>
            </div>
            <p class="text-xs text-rose-800 bg-rose-50 rounded-lg p-2 whitespace-pre-line">{{ r.faltante }}</p>
            <p v-for="o in otsDeRep(r)" :key="o.id" class="text-[11px] font-semibold text-slate-600"><span class="font-mono text-rose-700">OT {{ o.folio }}</span> · {{ progresoOT(o).done }}/{{ progresoOT(o).total }} actividades · {{ progresoOT(o).total - progresoOT(o).done }} pendientes</p>
            <div v-if="puedeEditar" class="flex gap-1.5">
              <select v-model="naveDestino[r.id]" class="flex-1 p-1.5 border rounded-lg text-xs font-bold"><option value="">Reingresar a nave...</option><option v-for="n in navesLibres" :key="n" :value="n">{{ n }}</option></select>
              <button @click="ingresarDesdeLista(r)" :disabled="!naveDestino[r.id] || ocupado" class="bg-emerald-600 text-white rounded-lg px-2.5 text-xs font-bold disabled:opacity-40"><i class="fa-solid fa-arrow-right-to-bracket"></i></button>
              <button @click="abrirReparar(r)" class="bg-amber-100 text-amber-900 rounded-lg px-2.5 text-xs font-bold" title="Ver OT"><i class="fa-solid fa-file-signature"></i></button>
            </div>
          </div>
          <p v-if="!repsConFaltantes.length" class="p-4 text-xs text-slate-400 italic">Ningún equipo salió sin terminar.</p>
        </div>
      </div>
    </div>
  </div>

  <!-- ===================== RESUMEN DEL PROGRAMA ===================== -->
  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="text-lg font-black text-slate-800"><i class="fa-solid fa-list-check text-amber-600 mr-2"></i>Resumen de reparación · {{ programaTaller ? nombreProg(programaTaller) : 'sin programa seleccionado' }}</h3>
      <div v-if="totalPrograma" class="flex items-center gap-3 min-w-[260px]">
        <div class="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden"><div class="h-3 bg-emerald-500 rounded-full transition-all" :style="{ width: pctPrograma + '%' }"></div></div>
        <span class="text-xl font-black text-emerald-600">{{ pctPrograma }}%</span>
      </div>
    </div>
    <div v-if="!programaTaller" class="text-sm text-slate-400 italic">No hay programas de reparación. Créalos en la pestaña “Programas y Gantt”.</div>
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <div v-for="col in [
          { k: 'PENDIENTE', t: 'Por ingresar', c: 'border-slate-300 bg-slate-50', h: 'text-slate-700', i: 'fa-hourglass-half' },
          { k: 'EN_NAVE', t: 'En nave', c: 'border-amber-300 bg-amber-50', h: 'text-amber-800', i: 'fa-warehouse' },
          { k: 'FALTANTES', t: 'Con faltantes', c: 'border-rose-300 bg-rose-50', h: 'text-rose-800', i: 'fa-triangle-exclamation' },
          { k: 'LISTO', t: 'Listos / reparados', c: 'border-emerald-300 bg-emerald-50', h: 'text-emerald-800', i: 'fa-circle-check' }]" :key="col.k"
          :class="['rounded-2xl border-2 p-3 space-y-2', col.c]">
        <p :class="['font-extrabold text-sm flex justify-between', col.h]"><span><i :class="['fa-solid mr-1.5', col.i]"></i>{{ col.t }}</span><span>{{ resumenPrograma[col.k].length }}</span></p>
        <div class="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          <div v-for="item in resumenPrograma[col.k]" :key="item.id" class="bg-white rounded-xl border p-2.5 flex gap-2.5 items-center">
            <img :src="fotoDe(item.afi)" class="w-14 h-10 rounded-md object-cover bg-slate-200 shrink-0" alt="">
            <div class="min-w-0 flex-1">
              <p class="font-black text-sm text-slate-800 flex items-center gap-1.5">AFI {{ item.afi }}
                <span v-if="col.k === 'PENDIENTE' && leToca(item)" class="text-[9px] font-extrabold uppercase bg-amber-400 text-slate-950 px-1.5 rounded" title="Su fecha de inicio ya llegó"><i class="fa-solid fa-star"></i> Recomendado</span>
              </p>
              <p class="text-[11px] text-slate-500 truncate">{{ obtenerDetalleEquipoPorAfi(item.afi, 'tipo') }}</p>
              <p class="text-[10px] font-mono text-slate-500">
                <template v-if="col.k === 'EN_NAVE'"><b class="text-amber-700">{{ repDeItem(item).nave }}</b> · {{ progresoRep(repDeItem(item)).pct }}%</template>
                <template v-else>{{ naveProgramada(item) }} plan. · {{ formatDateForDisplay(item.fecha_inicio) }}</template>
              </p>
            </div>
          </div>
          <p v-if="!resumenPrograma[col.k].length" class="text-xs text-slate-400 italic p-1">—</p>
        </div>
      </div>
    </div>
  </div>

  <!-- ===================== OT DEL TALLER ===================== -->
  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <div class="px-5 py-3 border-b flex items-center justify-between">
      <h3 class="text-lg font-black text-slate-800"><i class="fa-solid fa-file-signature text-rose-600 mr-2"></i>OT de reparación</h3>
      <span class="text-xs font-bold text-slate-500">{{ otsTaller.length }} OT enlazadas al taller</span>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-800 text-white text-[11px] uppercase"><tr><th class="p-3">Folio</th><th class="p-3">AFI</th><th class="p-3">Equipo</th><th class="p-3">Dónde está</th><th class="p-3">Programa</th><th class="p-3 w-48">Avance OT</th><th class="p-3">Estado OT</th><th class="p-3"></th></tr></thead>
        <tbody class="divide-y">
          <tr v-for="o in otsTaller" :key="o.id" class="hover:bg-slate-50">
            <td class="p-3 font-mono font-black text-rose-700">{{ o.folio }}</td>
            <td class="p-3 font-bold text-amber-800">{{ o.afi }}</td>
            <td class="p-3 text-slate-600">{{ o.equipo }} <span class="text-slate-400">{{ o.marca }} {{ o.modelo }}</span></td>
            <td class="p-3"><span v-if="repPorId(o.reparacion_id)" :class="['text-xs font-bold px-2 py-0.5 rounded-full border', ESTILO_ESTADO[repPorId(o.reparacion_id).estado]]">{{ ubicacionRep(repPorId(o.reparacion_id)) }}</span></td>
            <td class="p-3 text-xs font-semibold">{{ repPorId(o.reparacion_id) && repPorId(o.reparacion_id).programa_id != null ? nombreProgId(repPorId(o.reparacion_id).programa_id) : 'Sin programa' }}</td>
            <td class="p-3"><div class="flex items-center gap-2"><div class="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden"><div :class="['h-2.5 rounded-full', colorAvance(progresoOT(o).pct)]" :style="{ width: progresoOT(o).pct + '%' }"></div></div><span class="text-xs font-black w-10 text-right">{{ progresoOT(o).pct }}%</span></div></td>
            <td class="p-3"><span :class="['px-2 py-0.5 rounded-full border text-[10px] font-bold', ESTILO_ESTADO_OT[estadoOT(o)]]">{{ estadoOT(o) }}</span></td>
            <td class="p-3 text-right whitespace-nowrap">
              <button v-if="repPorId(o.reparacion_id)" @click="abrirReparar(repPorId(o.reparacion_id))" class="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold"><i class="fa-solid fa-screwdriver-wrench mr-1"></i>Actividades</button>
              <button @click="abrirFormatoOT(o)" class="ml-1 px-2.5 py-1 rounded-lg border text-xs font-bold text-slate-600 hover:bg-slate-50"><i class="fa-solid fa-file-lines mr-1"></i>Formato</button>
            </td>
          </tr>
          <tr v-if="!otsTaller.length"><td colspan="8" class="p-6 text-center text-slate-400 italic">Aún no hay OT enlazadas. Se crean con el botón REPARAR de cada nave o se enlazan desde Órdenes de Trabajo.</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <datalist id="dl-taller-afi"><option v-for="e in dbEquipos" :key="e.id" :value="e.afi">{{ e.tipo }} {{ e.marca }} {{ e.modelo }}</option></datalist>

  <!-- ===================== MODAL: INGRESAR A NAVE ===================== -->
  <div v-if="naveIngreso" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start md:items-center justify-center p-3 overflow-y-auto">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden">
      <div class="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between">
        <h3 class="text-xl font-black"><i class="fa-solid fa-arrow-right-to-bracket mr-2"></i>Ingresar equipo a {{ naveIngreso }}</h3>
        <button @click="naveIngreso = null" class="text-white/80 hover:text-white text-2xl"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
        <!-- Del programa -->
        <div>
          <p class="text-sm font-extrabold text-slate-700 mb-2"><i class="fa-solid fa-calendar-check text-indigo-600 mr-1"></i>Equipos del programa de reparación <span class="text-indigo-700">{{ programaTaller ? nombreProg(programaTaller) : '' }}</span></p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button v-for="c in candidatosPrograma(naveIngreso)" :key="c.item.id" @click="ingresar({ item: c.item })" :disabled="ocupado"
              :class="['text-left rounded-2xl border-2 p-3 flex gap-3 items-center hover:shadow-md transition disabled:opacity-50', c.recomendado ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white hover:border-emerald-400']">
              <img :src="fotoDe(c.item.afi)" class="w-24 h-16 rounded-xl object-cover bg-slate-200 shrink-0" alt="">
              <div class="min-w-0">
                <p v-if="c.recomendado" class="text-[10px] font-extrabold uppercase text-amber-700"><i class="fa-solid fa-star mr-1"></i>Recomendado para {{ naveIngreso }}</p>
                <p class="text-lg font-black text-slate-800 leading-tight">AFI {{ c.item.afi }}</p>
                <p class="text-xs text-slate-500 truncate">{{ descEquipo(c.item.afi) }}</p>
                <p class="text-[11px] font-mono text-slate-500">{{ naveProgramada(c.item) }} plan. · {{ formatDateForDisplay(c.item.fecha_inicio) }} al {{ formatDateForDisplay(c.item.fecha_fin) }}
                  <span v-if="c.estado === 'FALTANTES'" class="font-sans font-bold text-rose-700"> · con faltantes</span></p>
              </div>
            </button>
          </div>
          <p v-if="!candidatosPrograma(naveIngreso).length" class="text-sm text-slate-400 italic">No quedan equipos del programa por ingresar.</p>
        </div>

        <!-- En espera (sin programa / otros programas) -->
        <div v-if="repsEnEsperaFueraDelPrograma.length">
          <p class="text-sm font-extrabold text-slate-700 mb-2"><i class="fa-solid fa-hourglass-half text-sky-600 mr-1"></i>En espera (sin programa / otros programas)</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button v-for="r in repsEnEsperaFueraDelPrograma" :key="r.id" @click="ingresar({ rep: r })" :disabled="ocupado" class="text-left rounded-2xl border-2 border-slate-200 hover:border-emerald-400 p-3 flex gap-3 items-center bg-white hover:shadow-md disabled:opacity-50">
              <img :src="fotoDe(r.afi)" class="w-24 h-16 rounded-xl object-cover bg-slate-200 shrink-0" alt="">
              <div class="min-w-0">
                <p class="text-lg font-black text-slate-800 leading-tight">AFI {{ r.afi }}</p>
                <p class="text-xs text-slate-500 truncate">{{ descEquipo(r.afi) }}</p>
                <p class="text-[11px] font-bold"><span :class="['px-1.5 rounded border', ESTILO_ESTADO[r.estado]]">{{ ETIQUETA_ESTADO[r.estado] }}</span> <span class="text-slate-500">{{ r.programa_id != null ? nombreProgId(r.programa_id) : 'Sin programa' }}</span></p>
              </div>
            </button>
          </div>
        </div>

        <!-- Equipo nuevo -->
        <div class="rounded-2xl border-2 border-violet-300 bg-violet-50 p-4">
          <p class="text-sm font-extrabold text-violet-900 mb-1"><i class="fa-solid fa-circle-plus mr-1"></i>Equipo nuevo · agregar a nave</p>
          <p class="text-xs text-violet-800 mb-3">Para un equipo que no está en el programa. Además de entrar a la {{ naveIngreso }}, queda en la lista “Equipos reparación sin programa”.</p>
          <div class="flex flex-wrap gap-2">
            <input v-model="afiNuevo" list="dl-taller-afi" @keyup.enter="afiNuevo && ingresar({ afi: afiNuevo })" placeholder="Escribe o elige el AFI..." class="flex-1 min-w-[200px] p-3 border-2 border-violet-300 rounded-xl text-lg font-black uppercase">
            <button @click="ingresar({ afi: afiNuevo })" :disabled="!afiNuevo || ocupado" class="bg-violet-600 hover:bg-violet-700 text-white font-black px-6 py-3 rounded-xl text-base disabled:opacity-50"><i class="fa-solid fa-plus mr-1"></i>Agregar a {{ naveIngreso }}</button>
          </div>
          <p v-if="afiNuevo && equipoDe(afiNuevo)" class="text-xs font-semibold text-violet-900 mt-2"><i class="fa-solid fa-truck mr-1"></i>{{ descEquipo(afiNuevo) }}</p>
        </div>
      </div>
    </div>
  </div>

  <!-- ===================== MODAL: REPARAR (OT + ACTIVIDADES) ===================== -->
  <div v-if="repTrabajo" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center p-3 overflow-y-auto">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden my-2">
      <div class="bg-amber-500 text-slate-950 px-6 py-4 flex items-center justify-between">
        <h3 class="text-xl md:text-2xl font-black"><i class="fa-solid fa-screwdriver-wrench mr-2"></i>REPARAR · AFI {{ repTrabajo.afi }}<span v-if="repTrabajo.estado === 'EN_NAVE'" class="ml-2 text-base bg-slate-900 text-amber-300 px-3 py-0.5 rounded-full align-middle">{{ repTrabajo.nave }}</span></h3>
        <button @click="cerrarReparar" class="text-slate-900/70 hover:text-slate-950 text-3xl leading-none"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3">
        <!-- Equipo -->
        <div class="bg-slate-50 border-r p-5 space-y-3">
          <img :src="fotoDe(repTrabajo.afi)" class="w-full h-48 object-cover rounded-2xl bg-slate-800" alt="">
          <p class="text-2xl font-black text-slate-800">AFI {{ repTrabajo.afi }}</p>
          <p class="text-sm text-slate-600 font-semibold">{{ descEquipo(repTrabajo.afi) }}</p>
          <p class="text-xs font-bold"><span :class="['px-2 py-0.5 rounded-full border', ESTILO_ESTADO[repTrabajo.estado]]">{{ ubicacionRep(repTrabajo) }}</span>
            <span class="ml-1 text-slate-500">{{ repTrabajo.programa_id != null ? 'Programa ' + nombreProgId(repTrabajo.programa_id) : 'Sin programa' }}</span></p>
          <div>
            <div class="flex items-end justify-between"><span class="text-xs font-bold uppercase text-slate-500">Avance total</span><span :class="['text-5xl font-black leading-none', textoAvance(progresoRep(repTrabajo).pct)]">{{ progresoRep(repTrabajo).pct }}%</span></div>
            <div class="w-full h-6 bg-slate-200 rounded-full overflow-hidden mt-2 shadow-inner"><div :class="['h-6 rounded-full transition-all duration-700', colorAvance(progresoRep(repTrabajo).pct)]" :style="{ width: progresoRep(repTrabajo).pct + '%' }"></div></div>
            <p class="text-xs text-slate-500 font-semibold mt-1">{{ progresoRep(repTrabajo).done }} de {{ progresoRep(repTrabajo).total }} actividades terminadas</p>
          </div>
          <div v-if="repTrabajo.faltante" class="text-xs bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-2.5 whitespace-pre-line"><b><i class="fa-solid fa-triangle-exclamation mr-1"></i>Le faltaba:</b> {{ repTrabajo.faltante }}</div>
          <div class="flex flex-col gap-2 pt-2">
            <button v-if="puedeEditar && repTrabajo.estado === 'EN_NAVE'" @click="abrirSalida(repTrabajo)" class="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl"><i class="fa-solid fa-right-from-bracket mr-2"></i>Sacar de la nave</button>
            <button @click="verDetallePorAfiString(repTrabajo.afi)" class="w-full border font-bold py-2.5 rounded-xl text-slate-600 hover:bg-white"><i class="fa-solid fa-id-card mr-2"></i>Perfil del equipo</button>
          </div>
        </div>

        <!-- OT / actividades -->
        <div class="lg:col-span-2 p-5 space-y-4">
          <!-- Pestañas de OT -->
          <div class="flex flex-wrap items-center gap-2">
            <button v-for="o in otsDeRep(repTrabajo)" :key="o.id" @click="otSel = o"
              :class="['px-4 py-2 rounded-xl font-black text-sm border-2', otSel && otSel.id === o.id ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-700 border-rose-200 hover:border-rose-400']">OT {{ o.folio }} · {{ progresoOT(o).pct }}%</button>
            <button v-if="otSel && puedeEditar" @click="otSel = null" class="px-3 py-2 rounded-xl text-xs font-bold border-2 border-dashed border-slate-300 text-slate-500 hover:border-slate-400"><i class="fa-solid fa-plus mr-1"></i>Otra OT</button>
          </div>

          <!-- Crear / enlazar OT -->
          <div v-if="!otSel" class="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-5 space-y-4">
            <p class="text-lg font-black text-amber-900"><i class="fa-solid fa-file-circle-plus mr-2"></i>Crear OT para reparar el AFI {{ repTrabajo.afi }}</p>
            <div v-if="puedeEditar" class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label class="text-xs font-bold text-slate-600">N° FOLIO
                <input v-model="formOT.folio" inputmode="numeric" class="mt-1 w-full p-3 border-2 rounded-xl text-xl font-black text-rose-700 text-center">
              </label>
              <label class="text-xs font-bold text-slate-600">Tipo
                <select v-model="formOT.tipo" class="mt-1 w-full p-3 border-2 rounded-xl text-base font-bold"><option>CORRECTIVA</option><option>PREVENTIVA</option><option>PREDICTIVA</option></select>
              </label>
              <label class="text-xs font-bold text-slate-600">Mecánico a cargo
                <input v-model="formOT.mecanico" class="mt-1 w-full p-3 border-2 rounded-xl text-base font-bold">
              </label>
            </div>
            <p v-if="repTrabajo.faltante" class="text-xs text-amber-900">Lo que le faltaba entra como actividades de la OT.</p>
            <button v-if="puedeEditar" @click="crearOT" :disabled="ocupado || !formOT.folio" class="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 text-lg font-black py-3.5 rounded-2xl disabled:opacity-50"><i class="fa-solid fa-play mr-2"></i>Crear OT y empezar</button>
            <div v-if="puedeEditar && otsLibresDelAfi(repTrabajo.afi).length" class="pt-2 border-t border-amber-200">
              <p class="text-xs font-bold text-slate-600 mb-2">O enlazar una OT que ya existe del AFI {{ repTrabajo.afi }}:</p>
              <div class="flex flex-wrap gap-2">
                <button v-for="o in otsLibresDelAfi(repTrabajo.afi)" :key="o.id" @click="enlazarOT(o)" class="px-3 py-2 rounded-xl bg-white border-2 border-rose-200 hover:border-rose-400 text-sm font-bold text-rose-700"><i class="fa-solid fa-link mr-1"></i>OT {{ o.folio }} · {{ formatDateForDisplay(o.fecha) }}</button>
              </div>
            </div>
            <p v-if="!puedeEditar" class="text-sm text-slate-500">Esta reparación aún no tiene OT.</p>
          </div>

          <!-- Actividades de la OT seleccionada -->
          <template v-else>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-lg font-black text-slate-800">OT N° <span class="text-rose-700 font-mono">{{ otSel.folio }}</span> <span class="text-sm font-bold text-slate-500">· {{ otSel.tipo_mantencion || 'Sin tipo' }} · {{ formatDateForDisplay(otSel.fecha) }}</span></p>
                <p class="text-xs text-slate-500 font-semibold">{{ progresoOT(otSel).done }} de {{ progresoOT(otSel).total }} terminadas · toca el cuadro para marcar / desmarcar</p>
              </div>
              <div class="flex gap-2">
                <button @click="imprimirOT(otSel)" class="px-3 py-2 rounded-xl border font-bold text-sm text-slate-600 hover:bg-slate-50"><i class="fa-solid fa-print mr-1"></i>Imprimir</button>
                <button @click="abrirFormatoOT(otSel)" class="px-3 py-2 rounded-xl border font-bold text-sm text-slate-600 hover:bg-slate-50"><i class="fa-solid fa-file-lines mr-1"></i>Formato OT</button>
              </div>
            </div>

            <div class="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
              <template v-for="(a, i) in otSel.actividades" :key="i">
                <div v-if="a.descripcion && a.descripcion.trim()" :class="['flex items-center gap-3 rounded-2xl border-2 p-3 transition', actividadHecha(a) ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200']">
                  <button @click="alternarActividad(otSel, i)" :disabled="!puedeEditar"
                    :class="['w-14 h-14 shrink-0 rounded-xl border-4 flex items-center justify-center text-3xl transition', actividadHecha(a) ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white border-slate-300 text-transparent hover:border-emerald-400']">
                    <i class="fa-solid fa-check"></i>
                  </button>
                  <div class="flex-1 min-w-0">
                    <p :class="['text-lg font-bold leading-snug', actividadHecha(a) ? 'text-emerald-800 line-through decoration-2' : 'text-slate-800']">{{ a.descripcion }}</p>
                    <p class="text-xs text-slate-500 font-semibold">
                      <span v-if="a.f_inicio">Inicio {{ formatDateForDisplay(a.f_inicio) }} {{ a.h_inicio }}</span>
                      <span v-if="actividadHecha(a)" class="text-emerald-700"> · Terminada {{ formatDateForDisplay(a.f_term) }} {{ a.h_term }}</span>
                    </p>
                  </div>
                  <input v-model="a.ejecutante" @change="guardarEjecutante(otSel)" :disabled="!puedeEditar" placeholder="Ejecutante" class="w-36 md:w-44 p-2.5 border-2 rounded-xl text-sm font-bold">
                  <button v-if="puedeEditar" @click="quitarActividad(otSel, i)" class="text-slate-300 hover:text-rose-600 text-lg px-1" title="Quitar actividad"><i class="fa-solid fa-trash"></i></button>
                </div>
              </template>
              <p v-if="!progresoOT(otSel).total" class="text-sm text-slate-400 italic p-2">La OT no tiene actividades. Agrega la primera abajo.</p>
            </div>

            <div v-if="puedeEditar" class="rounded-2xl bg-slate-100 p-3 flex flex-wrap gap-2">
              <input v-model="nuevaAct.descripcion" @keyup.enter="agregarAct" placeholder="Nueva actividad (ej. Cambiar bomba hidráulica)" class="flex-1 min-w-[220px] p-3 border-2 rounded-xl text-base font-semibold">
              <input v-model="nuevaAct.ejecutante" @keyup.enter="agregarAct" placeholder="Ejecutante" class="w-44 p-3 border-2 rounded-xl text-base font-semibold">
              <button @click="agregarAct" :disabled="!nuevaAct.descripcion.trim()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 rounded-xl text-base disabled:opacity-50"><i class="fa-solid fa-plus mr-1"></i>Agregar</button>
              <p class="w-full text-[11px] text-slate-500">Máximo {{ N_ACTIVIDADES }} actividades por OT (igual que el formato en papel).</p>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- ===================== MODAL: SACAR DE NAVE ===================== -->
  <div v-if="repSalida" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-3">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
      <div class="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <h3 class="text-xl font-black"><i class="fa-solid fa-right-from-bracket mr-2 text-amber-400"></i>Sacar AFI {{ repSalida.afi }} de la {{ repSalida.nave }}</h3>
        <button @click="repSalida = null" class="text-white/70 hover:text-white text-2xl"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="p-6 space-y-5">
        <p class="text-xl font-black text-slate-800 text-center">¿El equipo quedó reparado?</p>
        <p class="text-center text-sm text-slate-500 -mt-3">Avance: <b>{{ progresoRep(repSalida).pct }}%</b> · {{ progresoRep(repSalida).total - progresoRep(repSalida).done }} actividad(es) sin terminar</p>
        <div class="grid grid-cols-2 gap-4">
          <button @click="formSalida.reparado = true" :class="['py-5 rounded-2xl text-xl font-black border-4 transition', formSalida.reparado === true ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:border-emerald-400']"><i class="fa-solid fa-circle-check mr-2"></i>SÍ, reparado</button>
          <button @click="formSalida.reparado = false" :class="['py-5 rounded-2xl text-xl font-black border-4 transition', formSalida.reparado === false ? 'bg-rose-600 text-white border-rose-700' : 'bg-rose-50 text-rose-800 border-rose-200 hover:border-rose-400']"><i class="fa-solid fa-circle-xmark mr-2"></i>NO, le falta</button>
        </div>

        <div v-if="formSalida.reparado === true" class="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900 space-y-1">
          <p><i class="fa-solid fa-check mr-1"></i>Queda <b>DISPONIBLE</b> en el Inventario.</p>
          <p v-if="repSalida.programa_item_id != null"><i class="fa-solid fa-check mr-1"></i>Se marca <b>REPARADO</b> en el programa {{ nombreProgId(repSalida.programa_id) }}.</p>
          <p><i class="fa-solid fa-check mr-1"></i>La {{ repSalida.nave }} queda libre.</p>
          <p v-if="progresoRep(repSalida).total > progresoRep(repSalida).done" class="text-amber-800 font-bold"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Ojo: la OT tiene actividades sin marcar.</p>
        </div>

        <div v-if="formSalida.reparado === false" class="space-y-3">
          <label class="block text-sm font-extrabold text-slate-700">¿Qué le falta? <span class="font-normal text-slate-500">(una cosa por línea)</span>
            <textarea v-model="formSalida.faltante" rows="5" class="mt-1 w-full p-3 border-2 border-rose-200 rounded-xl text-base" placeholder="- Repuesto bomba (esperando OC)&#10;- Prueba de carga"></textarea>
          </label>
          <label v-if="otPrincipal(repSalida)" class="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" v-model="formSalida.agregarAOT" class="w-5 h-5"> Agregar lo que falta como actividades pendientes en la OT {{ otPrincipal(repSalida).folio }}
          </label>
          <p class="text-xs text-slate-500">Queda en la lista “Salieron con faltantes” para volver a ingresarlo a una nave.</p>
        </div>

        <div class="flex justify-end gap-2 pt-2 border-t">
          <button @click="repSalida = null" class="px-5 py-3 rounded-xl font-bold bg-slate-200 text-slate-800">Cancelar</button>
          <button @click="confirmarSalida" :disabled="formSalida.reparado === null || ocupado || (formSalida.reparado === false && !formSalida.faltante.trim())"
            class="px-6 py-3 rounded-xl font-black text-white bg-slate-900 hover:bg-black disabled:opacity-40"><i :class="['fa-solid mr-2', ocupado ? 'fa-spinner fa-spin' : 'fa-right-from-bracket']"></i>Sacar de la nave</button>
        </div>
      </div>
    </div>
  </div>
</section>
`;
