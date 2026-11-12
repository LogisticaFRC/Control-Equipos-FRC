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
            <div v-if="problemasPendientesRep(repEnNave(nave)).length" class="text-xs bg-violet-100 border border-violet-300 text-violet-900 rounded-lg p-2 font-bold"><i class="fa-solid fa-bell mr-1"></i>{{ problemasPendientesRep(repEnNave(nave)).length }} problema(s) nuevo(s) enviado(s) por el mecánico{{ isAdmin ? ' · revisar en REPARAR' : ' · esperando al Admin' }}</div>
            <div v-if="repEnNave(nave).faltante" class="text-xs bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-2 whitespace-pre-line"><b><i class="fa-solid fa-triangle-exclamation mr-1"></i>Le faltaba:</b> {{ repEnNave(nave).faltante }}</div>
            <div class="flex gap-3 pt-1 mt-auto">
              <button @click="abrirReparar(repEnNave(nave))" class="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-lg font-black py-3.5 rounded-2xl shadow"><i class="fa-solid fa-screwdriver-wrench mr-2"></i>REPARAR</button>
              <button v-if="puedeEditar" @click="abrirSalida(repEnNave(nave))" class="bg-slate-800 hover:bg-slate-900 text-white text-base font-bold px-5 py-3.5 rounded-2xl shadow"><i class="fa-solid fa-right-from-bracket mr-2"></i>Sacar</button>
            </div>
            <!-- El mecánico avisa que el equipo quedó listo: sale de la nave y queda REPARADO en el programa -->
            <button v-if="puedeEditar" @click="abrirSalida(repEnNave(nave), true)" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-black py-3.5 rounded-2xl shadow"><i class="fa-solid fa-circle-check mr-2"></i>EQUIPO LISTO / REPARADO</button>
            <button v-if="isAdmin" @click="sacarError(repEnNave(nave))" class="w-full text-xs font-bold text-slate-500 hover:text-slate-800 border border-dashed border-slate-300 hover:border-slate-500 rounded-xl py-2"><i class="fa-solid fa-rotate-left mr-1"></i>Sacar por error / prueba (Admin)</button>
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
      <!-- Problemas nuevos enviados por los mecánicos (los procesa el Admin) -->
      <div v-if="problemasPendientes.length" class="bg-white rounded-2xl shadow-sm border-2 border-violet-300 overflow-hidden">
        <div class="bg-violet-700 text-white px-4 py-3 font-extrabold text-sm flex items-center justify-between">
          <span><i class="fa-solid fa-bell mr-1.5"></i> Problemas nuevos para OT</span>
          <span class="bg-white/20 rounded-full px-2 text-xs">{{ problemasPendientes.length }}</span>
        </div>
        <div class="divide-y max-h-[320px] overflow-y-auto">
          <div v-for="p in problemasPendientes" :key="p.id" class="p-3 space-y-1">
            <p class="text-xs font-black text-slate-800">AFI {{ p.afi }}<span v-if="p.nave" class="ml-1 text-amber-700">· {{ p.nave }}</span></p>
            <p class="text-sm text-slate-700">{{ p.descripcion }}</p>
            <p class="text-[11px] text-slate-500">{{ p.reportado_por }} · {{ fechaHora(p.created_at) }}</p>
            <button v-if="isAdmin && repPorId(p.reparacion_id)" @click="abrirReparar(repPorId(p.reparacion_id))" class="text-xs font-bold text-violet-700 hover:underline"><i class="fa-solid fa-arrow-right mr-1"></i>Revisar y agregar a la OT</button>
          </div>
        </div>
      </div>

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
                <button @click="abrirReparar(r)" class="bg-amber-100 text-amber-900 rounded-lg px-2.5 text-xs font-bold" title="Ver / unir OT"><i class="fa-solid fa-file-signature"></i></button>
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
      <h3 class="text-lg font-black text-slate-800"><i class="fa-solid fa-file-signature text-rose-600 mr-2"></i>OT de reparación <span class="text-amber-600">· {{ programaTaller ? nombreProg(programaTaller) : 'sin programa' }}</span></h3>
      <span class="text-xs font-bold text-slate-500">{{ otsTallerPrograma.length }} OT enlazadas a este programa</span>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-800 text-white text-[11px] uppercase"><tr><th class="p-3">Folio</th><th class="p-3">AFI</th><th class="p-3">Equipo</th><th class="p-3">Dónde está</th><th class="p-3">Programa</th><th class="p-3 w-48">Avance OT</th><th class="p-3">Estado OT</th><th class="p-3"></th></tr></thead>
        <tbody class="divide-y">
          <tr v-for="o in otsTallerPrograma" :key="o.id" class="hover:bg-slate-50">
            <td class="p-3 font-mono font-black text-rose-700">{{ o.folio }}</td>
            <td class="p-3 font-bold text-amber-800">{{ o.afi }}</td>
            <td class="p-3 text-slate-600">{{ o.equipo }} <span class="text-slate-400">{{ o.marca }} {{ o.modelo }}</span></td>
            <td class="p-3"><span v-if="repPorId(o.reparacion_id)" :class="['text-xs font-bold px-2 py-0.5 rounded-full border', ESTILO_ESTADO[repPorId(o.reparacion_id).estado]]">{{ ubicacionRep(repPorId(o.reparacion_id)) }}</span></td>
            <td class="p-3 text-xs font-semibold">{{ repPorId(o.reparacion_id) && repPorId(o.reparacion_id).programa_id != null ? nombreProgId(repPorId(o.reparacion_id).programa_id) : 'Sin programa' }}</td>
            <td class="p-3"><div class="flex items-center gap-2"><div class="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden"><div :class="['h-2.5 rounded-full', colorAvance(progresoOT(o).pct)]" :style="{ width: progresoOT(o).pct + '%' }"></div></div><span class="text-xs font-black w-10 text-right">{{ progresoOT(o).pct }}%</span></div></td>
            <td class="p-3"><span :class="['px-2 py-0.5 rounded-full border text-[10px] font-bold', ESTILO_ESTADO_OT[estadoOT(o)]]">{{ ETIQUETA_ESTADO_OT[estadoOT(o)] }}</span></td>
            <td class="p-3 text-right whitespace-nowrap">
              <button v-if="repPorId(o.reparacion_id)" @click="abrirReparar(repPorId(o.reparacion_id))" class="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold"><i class="fa-solid fa-screwdriver-wrench mr-1"></i>Actividades</button>
              <button @click="abrirFormatoOT(o)" class="ml-1 px-2.5 py-1 rounded-lg border text-xs font-bold text-slate-600 hover:bg-slate-50"><i class="fa-solid fa-file-lines mr-1"></i>Formato</button>
              <button v-if="puedeEditar" @click="desenlazarOT(o)" title="Quitar del taller (la OT no se borra)" class="ml-1 px-2.5 py-1 rounded-lg border border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-50"><i class="fa-solid fa-link-slash mr-1"></i>Quitar</button>
            </td>
          </tr>
          <tr v-if="!otsTallerPrograma.length"><td colspan="8" class="p-6 text-center text-slate-400 italic">Este programa aún no tiene OT enlazadas. Se crean con el botón REPARAR de cada nave o se enlazan desde Órdenes de Trabajo.</td></tr>
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

  <!-- ===================== MODAL: REPARAR (OT que completa el mecánico) ===================== -->
  <div v-if="repTrabajo" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center p-3 overflow-y-auto">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-7xl overflow-hidden my-2">
      <div class="bg-amber-500 text-slate-950 px-6 py-4 flex items-center justify-between gap-3">
        <h3 class="text-xl md:text-2xl font-black"><i class="fa-solid fa-screwdriver-wrench mr-2"></i>REPARAR · AFI {{ repTrabajo.afi }}<span v-if="repTrabajo.estado === 'EN_NAVE'" class="ml-2 text-base bg-slate-900 text-amber-300 px-3 py-0.5 rounded-full align-middle">{{ repTrabajo.nave }}</span></h3>
        <div class="flex items-center gap-3">
          <span v-if="otSel && guardadoOT.id === otSel.id && guardadoOT.hora" class="text-xs font-bold bg-white/60 rounded-full px-3 py-1"><i class="fa-solid fa-check mr-1 text-emerald-700"></i>Guardado {{ guardadoOT.hora }}</span>
          <button @click="cerrarReparar" class="text-slate-900/70 hover:text-slate-950 text-3xl leading-none"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-4">
        <!-- Equipo -->
        <div class="bg-slate-50 border-r p-5 space-y-3">
          <img :src="fotoDe(repTrabajo.afi)" class="w-full h-44 object-cover rounded-2xl bg-slate-800" alt="">
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
            <button v-if="isAdmin && repTrabajo.estado === 'EN_NAVE'" @click="sacarError(repTrabajo)" class="w-full border-2 border-dashed border-slate-400 text-slate-600 hover:bg-white font-bold py-2.5 rounded-xl text-sm"><i class="fa-solid fa-rotate-left mr-2"></i>Sacar por error / prueba</button>
            <button @click="verDetallePorAfiString(repTrabajo.afi)" class="w-full border font-bold py-2.5 rounded-xl text-slate-600 hover:bg-white"><i class="fa-solid fa-id-card mr-2"></i>Perfil del equipo</button>
          </div>
        </div>

        <!-- OT -->
        <div class="lg:col-span-3 p-5 space-y-5 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <button v-for="o in otsDeRep(repTrabajo)" :key="o.id" @click="otSel = o"
              :class="['px-4 py-2 rounded-xl font-black text-sm border-2', otSel && otSel.id === o.id ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-700 border-rose-200 hover:border-rose-400']">OT {{ o.folio }} · {{ progresoOT(o).pct }}%</button>
            <button v-if="otSel && puedeEditar" @click="otSel = null" class="px-3 py-2 rounded-xl text-xs font-bold border-2 border-dashed border-slate-300 text-slate-500 hover:border-slate-400"><i class="fa-solid fa-link mr-1"></i>Unir otra OT</button>
            <button v-if="otSel && puedeEditar" @click="quitarOTSel" class="px-3 py-2 rounded-xl text-xs font-bold border-2 border-rose-200 text-rose-600 hover:bg-rose-50"><i class="fa-solid fa-link-slash mr-1"></i>Quitar OT {{ otSel.folio }} del taller</button>
          </div>

          <!-- ===== Sin OT: unir una OT ya creada ===== -->
          <div v-if="!otSel" class="space-y-4">
            <div class="rounded-2xl border-2 border-rose-200 bg-rose-50/50 p-5 space-y-3">
              <p class="text-lg font-black text-rose-900"><i class="fa-solid fa-link mr-2"></i>Unir con la OT del AFI {{ repTrabajo.afi }}</p>
              <div v-if="otsLibresDeRep(repTrabajo).length" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div v-for="o in otsLibresDeRep(repTrabajo)" :key="o.id" class="bg-white rounded-2xl border-2 border-rose-200 p-4 space-y-2">
                  <p class="text-xl font-black text-rose-700">OT N° {{ o.folio }}</p>
                  <p class="text-xs text-slate-500 font-semibold">{{ formatDateForDisplay(o.fecha) }} · {{ o.tipo_mantencion || 'Sin tipo' }} · {{ o.actividades.filter(a => a.descripcion).length }} actividades</p>
                  <p class="text-xs text-slate-600 line-clamp-2">{{ o.actividades.filter(a => a.descripcion).map(a => a.descripcion).join(' · ') || '—' }}</p>
                  <button v-if="puedeEditar" @click="enlazarOT(o)" class="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-3 rounded-xl"><i class="fa-solid fa-link mr-1"></i>Unir esta OT</button>
                </div>
              </div>
              <div v-else class="text-sm text-rose-900 bg-white rounded-xl border border-rose-200 p-3">
                <i class="fa-solid fa-circle-info mr-1"></i>Todavía no hay una OT pendiente para el AFI {{ repTrabajo.afi }} desde el {{ formatDateForDisplay(fechaDesdeOTRep(repTrabajo)) }}. Operaciones la crea en <b>Órdenes de Trabajo</b> y la une a este equipo; apenas lo haga, aparece aquí. <span class="text-rose-700/70">(No se muestran OT antiguas ni ya registradas en el Historial.)</span>
              </div>
            </div>
            <!-- Solo Admin: crear OT desde el taller -->
            <details v-if="isAdmin" class="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-4">
              <summary class="font-black text-amber-900 cursor-pointer"><i class="fa-solid fa-file-circle-plus mr-2"></i>Crear la OT aquí (Admin)</summary>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <label class="text-xs font-bold text-slate-600">N° FOLIO<input v-model="formOT.folio" inputmode="numeric" class="mt-1 w-full p-3 border-2 rounded-xl text-xl font-black text-rose-700 text-center"></label>
                <label class="text-xs font-bold text-slate-600">Tipo<select v-model="formOT.tipo" class="mt-1 w-full p-3 border-2 rounded-xl text-base font-bold"><option>CORRECTIVA</option><option>PREVENTIVA</option><option>PREDICTIVA</option></select></label>
                <label class="text-xs font-bold text-slate-600">Mecánico a cargo<input v-model="formOT.mecanico" class="mt-1 w-full p-3 border-2 rounded-xl text-base font-bold"></label>
              </div>
              <button @click="crearOT" :disabled="ocupado || !formOT.folio" class="mt-3 w-full bg-amber-500 hover:bg-amber-600 text-slate-950 text-lg font-black py-3 rounded-2xl disabled:opacity-50"><i class="fa-solid fa-plus mr-2"></i>Crear OT y unirla</button>
            </details>
          </div>

          <!-- ===== OT unida: lo que completa el mecánico ===== -->
          <template v-else>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-xl font-black text-slate-800">OT N° <span class="text-rose-700 font-mono">{{ otSel.folio }}</span> <span class="text-sm font-bold text-slate-500">· {{ otSel.tipo_mantencion || 'Sin tipo' }} · {{ formatDateForDisplay(otSel.fecha) }}</span></p>
                <p class="text-xs text-slate-500 font-semibold">Todo se guarda solo al escribir. Toca el cuadro grande para marcar una actividad terminada.</p>
              </div>
              <div class="flex gap-2">
                <button @click="imprimirOT(otSel)" class="px-3 py-2 rounded-xl border font-bold text-sm text-slate-600 hover:bg-slate-50"><i class="fa-solid fa-print mr-1"></i>Imprimir</button>
                <button v-if="isAdmin" @click="abrirFormatoOT(otSel)" class="px-3 py-2 rounded-xl border font-bold text-sm text-slate-600 hover:bg-slate-50"><i class="fa-solid fa-file-lines mr-1"></i>Formato OT</button>
              </div>
            </div>

            <!-- 1. ACTIVIDADES -->
            <section class="space-y-2">
              <h4 class="text-sm font-black uppercase text-slate-700 bg-slate-100 rounded-lg px-3 py-2"><i class="fa-solid fa-list-check mr-1"></i>Actividades a realizar · {{ progresoOT(otSel).done }}/{{ progresoOT(otSel).total }}</h4>
              <template v-for="(a, i) in otSel.actividades" :key="'a' + i">
                <div v-if="a.descripcion && a.descripcion.trim()" :class="['rounded-2xl border-2 p-3 transition', actividadHecha(a) ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200']">
                  <div class="flex items-center gap-3">
                    <button @click="alternarActividad(otSel, i)" :disabled="!puedeEditar"
                      :class="['w-14 h-14 shrink-0 rounded-xl border-4 flex items-center justify-center text-3xl transition', actividadHecha(a) ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white border-slate-300 text-transparent hover:border-emerald-400']">
                      <i class="fa-solid fa-check"></i>
                    </button>
                    <input v-if="isAdmin" v-model="a.descripcion" @change="guardarOTTaller(otSel, 'actividades')" class="flex-1 min-w-0 p-2 border-2 border-transparent hover:border-slate-200 rounded-xl text-lg font-bold" :class="actividadHecha(a) ? 'text-emerald-800' : 'text-slate-800'">
                    <p v-else :class="['flex-1 min-w-0 text-lg font-bold leading-snug', actividadHecha(a) ? 'text-emerald-800' : 'text-slate-800']">{{ i + 1 }}. {{ a.descripcion }}</p>
                    <button v-if="isAdmin" @click="quitarActividad(otSel, i)" class="text-slate-300 hover:text-rose-600 text-lg px-1" title="Quitar actividad (Admin)"><i class="fa-solid fa-trash"></i></button>
                  </div>
                  <div class="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2 md:pl-[68px]">
                    <label class="text-[10px] font-bold uppercase text-slate-500 col-span-2 md:col-span-1">Ejecutante<input v-model="a.ejecutante" @change="guardarOTTaller(otSel, 'actividades')" :disabled="!puedeEditar" class="mt-0.5 w-full min-w-0 p-2 border-2 rounded-lg text-sm font-bold normal-case"></label>
                    <label class="text-[10px] font-bold uppercase text-slate-500">F. inicio<input type="date" v-model="a.f_inicio" @change="guardarOTTaller(otSel, 'actividades')" :disabled="!puedeEditar" class="mt-0.5 w-full min-w-0 p-2 border-2 rounded-lg text-sm font-bold"></label>
                    <label class="text-[10px] font-bold uppercase text-slate-500">F. término<input type="date" v-model="a.f_term" @change="guardarOTTaller(otSel, 'actividades')" :disabled="!puedeEditar" class="mt-0.5 w-full min-w-0 p-2 border-2 rounded-lg text-sm font-bold"></label>
                    <label class="text-[10px] font-bold uppercase text-slate-500">H. inicio<input type="time" v-model="a.h_inicio" @change="guardarOTTaller(otSel, 'actividades')" :disabled="!puedeEditar" class="mt-0.5 w-full min-w-0 p-2 border-2 rounded-lg text-sm font-bold"></label>
                    <label class="text-[10px] font-bold uppercase text-slate-500">H. término<input type="time" v-model="a.h_term" @change="guardarOTTaller(otSel, 'actividades')" :disabled="!puedeEditar" class="mt-0.5 w-full min-w-0 p-2 border-2 rounded-lg text-sm font-bold"></label>
                  </div>
                </div>
              </template>
              <p v-if="!progresoOT(otSel).total" class="text-sm text-slate-400 italic p-2">La OT no tiene actividades todavía.</p>
              <div v-if="isAdmin" class="rounded-2xl bg-slate-100 p-3 flex flex-wrap gap-2">
                <input v-model="nuevaAct.descripcion" @keyup.enter="agregarAct" placeholder="Nueva actividad (Admin)" class="flex-1 min-w-[220px] p-3 border-2 rounded-xl text-base font-semibold">
                <button @click="agregarAct" :disabled="!nuevaAct.descripcion.trim()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 rounded-xl text-base disabled:opacity-50"><i class="fa-solid fa-plus mr-1"></i>Agregar</button>
              </div>
            </section>

            <!-- 2. NUEVO PROBLEMA -->
            <section class="rounded-2xl border-2 border-violet-200 bg-violet-50 p-4 space-y-3">
              <h4 class="text-sm font-black uppercase text-violet-900"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Enviar nuevo problema para OT</h4>
              <p v-if="faltaTablaProblemas" class="text-xs text-rose-700 font-semibold">Falta ejecutar sql/taller_firmas_problemas.sql en Supabase.</p>
              <div v-if="puedeEditar" class="flex flex-wrap gap-2">
                <textarea v-model="nuevoProblema" rows="2" placeholder="Ej: Fuga de aceite en cilindro de levante, falta cambiar sello" class="flex-1 min-w-[240px] p-3 border-2 border-violet-200 rounded-xl text-base"></textarea>
                <button @click="enviarProb" :disabled="!nuevoProblema.trim() || ocupado" class="bg-violet-600 hover:bg-violet-700 text-white font-black px-6 rounded-xl text-base disabled:opacity-50"><i class="fa-solid fa-paper-plane mr-1"></i>Enviar</button>
              </div>
              <p class="text-[11px] text-violet-800">El Admin lo revisa y, si corresponde, lo agrega como actividad de la OT.</p>
              <div v-for="p in problemasDeRep(repTrabajo)" :key="p.id" class="bg-white rounded-xl border p-3 space-y-2">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="text-sm font-bold text-slate-800">{{ p.descripcion }}</span>
                  <span :class="['text-[10px] font-bold px-2 py-0.5 rounded-full border', p.estado === 'PENDIENTE' ? 'bg-amber-100 text-amber-800 border-amber-300' : p.estado === 'AGREGADO' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300']">{{ p.estado === 'PENDIENTE' ? 'Esperando al Admin' : p.estado === 'AGREGADO' ? 'Agregado a la OT' : 'Rechazado' }}</span>
                </div>
                <p class="text-[11px] text-slate-500">{{ p.reportado_por }} · {{ fechaHora(p.created_at) }}<template v-if="p.respuesta"> · <b>{{ p.respuesta }}</b></template></p>
                <div v-if="isAdmin && p.estado === 'PENDIENTE'" class="flex flex-wrap gap-2">
                  <input v-model="textoProblema[p.id]" :placeholder="p.descripcion" class="flex-1 min-w-[200px] p-2 border-2 rounded-lg text-sm" title="Texto de la actividad (puedes corregirlo)">
                  <button @click="agregarProblemaAOT(p, otSel, textoProblema[p.id] || p.descripcion)" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-lg text-sm"><i class="fa-solid fa-plus mr-1"></i>Agregar a OT {{ otSel.folio }}</button>
                  <button @click="rechazarProblema(p)" class="border font-bold px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Rechazar</button>
                </div>
              </div>
            </section>

            <!-- 3. ACEITES (filas 1-4 del formato) -->
            <section class="space-y-2">
              <h4 class="text-sm font-black uppercase text-slate-700 bg-slate-100 rounded-lg px-3 py-2"><i class="fa-solid fa-oil-can mr-1"></i>Aceites utilizados</h4>
              <div class="hidden md:grid grid-cols-[2rem_minmax(0,2fr)_9.5rem_minmax(0,1fr)] gap-2 px-1 text-[10px] font-bold uppercase text-slate-500"><span>#</span><span>Aceite / Lts</span><span>Fecha</span><span>Retira</span></div>
              <div v-for="(x, i) in filasAceites(otSel)" :key="'ac' + i" class="grid grid-cols-2 md:grid-cols-[2rem_minmax(0,2fr)_9.5rem_minmax(0,1fr)] gap-2 items-center">
                <span class="hidden md:block text-sm font-bold text-slate-400 text-center">{{ i + 1 }}</span>
                <input v-model="x.aceites" @change="guardarOTTaller(otSel, 'insumos')" :disabled="!puedeEditar" placeholder="Ej: 15W40 · 12 lts" class="col-span-2 md:col-span-1 w-full min-w-0 p-2 border-2 rounded-lg text-sm font-semibold">
                <input type="date" v-model="x.fecha" @change="guardarOTTaller(otSel, 'insumos')" :disabled="!puedeEditar" class="w-full min-w-0 p-2 border-2 rounded-lg text-sm font-semibold">
                <input v-model="x.retira" @change="guardarOTTaller(otSel, 'insumos')" :disabled="!puedeEditar" placeholder="Retira" class="w-full min-w-0 p-2 border-2 rounded-lg text-sm font-semibold">
                <p v-if="x.repuestos" class="col-span-2 md:col-start-2 md:col-span-3 text-[11px] text-slate-500 -mt-1">Repuesto en esta fila (OT antigua): {{ x.repuestos }}</p>
              </div>
            </section>

            <!-- 3b. REPUESTOS (filas 5 en adelante; se pueden agregar más) -->
            <section class="space-y-2">
              <h4 class="text-sm font-black uppercase text-slate-700 bg-slate-100 rounded-lg px-3 py-2 flex justify-between"><span><i class="fa-solid fa-gears mr-1"></i>Repuestos utilizados</span><span class="font-bold normal-case text-slate-500">{{ filasRepuestos(otSel).length }}</span></h4>
              <div v-for="r in filasRepuestos(otSel)" :key="'rp' + r.i" class="grid grid-cols-2 md:grid-cols-[minmax(0,2fr)_9.5rem_minmax(0,1fr)_2.5rem] gap-2 items-center">
                <input v-model="r.x.repuestos" @change="guardarOTTaller(otSel, 'insumos')" :disabled="!puedeEditar" class="col-span-2 md:col-span-1 w-full min-w-0 p-2 border-2 rounded-lg text-sm font-semibold">
                <input type="date" v-model="r.x.fecha" @change="guardarOTTaller(otSel, 'insumos')" :disabled="!puedeEditar" class="w-full min-w-0 p-2 border-2 rounded-lg text-sm font-semibold">
                <input v-model="r.x.retira" @change="guardarOTTaller(otSel, 'insumos')" :disabled="!puedeEditar" placeholder="Retira" class="w-full min-w-0 p-2 border-2 rounded-lg text-sm font-semibold">
                <button v-if="puedeEditar" @click="quitarRepuesto(otSel, r.i)" class="text-slate-300 hover:text-rose-600 text-lg" title="Quitar repuesto"><i class="fa-solid fa-trash"></i></button>
              </div>
              <p v-if="!filasRepuestos(otSel).length" class="text-sm text-slate-400 italic px-1">Sin repuestos todavía.</p>
              <div v-if="puedeEditar" class="rounded-2xl bg-slate-100 p-3 grid grid-cols-2 md:grid-cols-[minmax(0,2fr)_9.5rem_minmax(0,1fr)_auto] gap-2 items-center">
                <input v-model="nuevoRepuesto.repuesto" @keyup.enter="agregarRep" placeholder="Repuesto (ej. Sello cilindro 2 un.)" class="col-span-2 md:col-span-1 w-full min-w-0 p-2.5 border-2 rounded-xl text-sm font-semibold">
                <input type="date" v-model="nuevoRepuesto.fecha" title="Vacío = hoy" class="w-full min-w-0 p-2.5 border-2 rounded-xl text-sm font-semibold">
                <input v-model="nuevoRepuesto.retira" @keyup.enter="agregarRep" placeholder="Retira" class="w-full min-w-0 p-2.5 border-2 rounded-xl text-sm font-semibold">
                <button @click="agregarRep" :disabled="!nuevoRepuesto.repuesto.trim()" class="col-span-2 md:col-span-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2.5 rounded-xl disabled:opacity-50"><i class="fa-solid fa-plus mr-1"></i>Agregar repuesto</button>
              </div>
              <p class="text-[11px] text-slate-400">En la hoja de la OT caben 6 repuestos (filas 5 a 10); los demás salen en una hoja anexa al imprimir.</p>
            </section>

            <!-- 4. PERSONAL ASIGNADO -->
            <section class="space-y-2">
              <h4 class="text-sm font-black uppercase text-slate-700 bg-slate-100 rounded-lg px-3 py-2"><i class="fa-solid fa-users mr-1"></i>Personal asignado</h4>
              <div v-for="(p, i) in otSel.personal" :key="'p' + i" class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-center">
                <input v-model="p.nombre" @change="guardarOTTaller(otSel, 'personal')" :disabled="!puedeEditar" :placeholder="'Nombre ' + (i + 1)" class="w-full min-w-0 p-2 border-2 rounded-lg text-sm font-semibold">
                <input v-model="p.cargo" @change="guardarOTTaller(otSel, 'personal')" :disabled="!puedeEditar" placeholder="Cargo" class="w-full min-w-0 p-2 border-2 rounded-lg text-sm font-semibold">
                <firma-pad compacto :firma="p.firma || ''" :titulo="'Firma de ' + (p.nombre || 'personal ' + (i + 1))" :disabled="!puedeEditar || !p.nombre" @guardar="u => fijarFirma(otSel, 'per.' + i, u)"></firma-pad>
              </div>
              <p class="text-[11px] text-slate-400">Escribe el nombre para poder firmar.</p>
            </section>

            <!-- PAUTA -->
            <section class="space-y-2">
              <h4 class="text-sm font-black uppercase text-slate-700 bg-slate-100 rounded-lg px-3 py-2"><i class="fa-solid fa-gauge mr-1"></i>Pauta de mantención</h4>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button v-for="pa in ['250', '500', '1000', '5000']" :key="pa" @click="alternarPautaOT(otSel, pa)" :disabled="!puedeEditar"
                  :class="['py-3 rounded-xl border-2 font-black', otSel.pauta === pa ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400']">{{ pa }} horas</button>
              </div>
            </section>

            <!-- 5. RESPONSABLES Y FIRMAS -->
            <section class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="rounded-2xl border-2 p-4 space-y-2">
                <h4 class="text-sm font-black uppercase text-slate-700">Mecánico responsable</h4>
                <input v-model="otSel.mecanico" @change="guardarOTTaller(otSel, 'mecanico')" :disabled="!puedeEditar" placeholder="Nombre" class="w-full p-2.5 border-2 rounded-lg text-base font-bold">
                <firma-pad :firma="firmaDe(otSel, 'mecanico')" :titulo="'Firma mecánico responsable · OT ' + otSel.folio" :disabled="!puedeEditar" @guardar="u => fijarFirma(otSel, 'mecanico', u)"></firma-pad>
              </div>
              <div class="rounded-2xl border-2 p-4 space-y-2">
                <h4 class="text-sm font-black uppercase text-slate-700">Supervisor responsable</h4>
                <input v-model="otSel.supervisor" @change="guardarOTTaller(otSel, 'supervisor')" :disabled="!puedeEditar" placeholder="Nombre" class="w-full p-2.5 border-2 rounded-lg text-base font-bold">
                <firma-pad :firma="firmaDe(otSel, 'supervisor')" :titulo="'Firma supervisor responsable · OT ' + otSel.folio" :disabled="!puedeEditar" @guardar="u => fijarFirma(otSel, 'supervisor', u)"></firma-pad>
              </div>
            </section>
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
