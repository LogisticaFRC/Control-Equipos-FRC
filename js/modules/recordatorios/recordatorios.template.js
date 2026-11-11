// =====================================================================
// MIS TAREAS · Plantilla de la pantalla (Hoy | Semana | Mes | Todas | Avisos)
// =====================================================================
export default /* html */ `
<div class="space-y-4">
  <!-- Encabezado -->
  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-xl"><i class="fa-solid fa-calendar-check"></i></div>
        <div>
          <h2 class="text-xl font-extrabold text-slate-800 leading-tight">Mis Tareas</h2>
          <p class="text-xs text-slate-500"><i class="fa-solid fa-lock mr-1"></i>Recordatorio personal de {{ usuarioActivo?.nombre }} · solo tú ves estas tareas</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button v-if="permisoNotif !== 'granted' && permisoNotif !== 'unsupported'" @click="pedirPermisoNotif()" class="text-xs font-bold px-3 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"><i class="fa-solid fa-bell-slash mr-1"></i>Activar avisos de Windows</button>
        <button @click="cargarTareas()" title="Actualizar" class="w-9 h-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><i :class="['fa-solid fa-rotate', cargandoTareas ? 'fa-spin' : '']"></i></button>
        <button @click="abrirNuevaTarea(diaSel)" class="bg-slate-900 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-sm shadow"><i class="fa-solid fa-plus mr-1.5"></i>Nueva tarea</button>
      </div>
    </div>

    <!-- KPI -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
      <div class="rounded-xl border border-slate-200 p-3">
        <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Hoy</div>
        <div class="flex items-end gap-2 mt-1"><span class="text-2xl font-extrabold text-slate-800">{{ hechasHoy.length }}/{{ ocurrenciasHoy.length }}</span><span class="text-xs text-slate-500 mb-1">hechas</span></div>
        <div class="h-1.5 rounded-full bg-slate-100 mt-2 overflow-hidden"><div class="h-full bg-emerald-500 transition-all" :style="{ width: progresoHoy + '%' }"></div></div>
      </div>
      <div :class="['rounded-xl border p-3', vencidas.length ? 'border-rose-200 bg-rose-50' : 'border-slate-200']">
        <div class="text-[10px] font-extrabold uppercase tracking-wider" :class="vencidas.length ? 'text-rose-600' : 'text-slate-500'">Vencidas</div>
        <div :class="['text-2xl font-extrabold mt-1', vencidas.length ? 'text-rose-600' : 'text-slate-300']">{{ vencidas.length }}</div>
        <div class="text-[11px] text-slate-500">tareas de días anteriores sin marcar</div>
      </div>
      <div class="rounded-xl border border-slate-200 p-3">
        <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Próximos 7 días</div>
        <div class="text-2xl font-extrabold mt-1 text-sky-600">{{ proximas7.length }}</div>
        <div class="text-[11px] text-slate-500">tareas programadas</div>
      </div>
      <div class="rounded-xl border border-slate-200 p-3">
        <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Cumplimiento 7 días</div>
        <div class="text-2xl font-extrabold mt-1" :class="cumplimientoSemana.pct >= 80 ? 'text-emerald-600' : cumplimientoSemana.pct >= 50 ? 'text-amber-600' : 'text-rose-600'">{{ cumplimientoSemana.pct }}%</div>
        <div class="text-[11px] text-slate-500">{{ cumplimientoSemana.ok }} de {{ cumplimientoSemana.tot }}</div>
      </div>
    </div>

    <!-- Pestañas -->
    <div class="flex gap-1 mt-4 overflow-x-auto border-b border-slate-200 -mb-1">
      <button v-for="p in pestanas" :key="p.k" @click="vista = p.k"
        :class="['px-3.5 py-2 text-sm font-bold whitespace-nowrap border-b-2 -mb-px transition', vista === p.k ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800']">
        <i :class="['fa-solid mr-1.5', p.icon]"></i>{{ p.l }}
        <span v-if="p.k === 'hoy' && pendientesHoy.length" class="ml-1 text-[10px] bg-amber-400 text-slate-900 rounded-full px-1.5">{{ pendientesHoy.length }}</span>
      </button>
    </div>
  </div>

  <div v-if="faltaSQLTareas" class="bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl p-4 text-sm">
    <i class="fa-solid fa-database mr-1"></i> Falta crear las tablas: ejecuta <b>sql/recordatorios.sql</b> en Supabase → SQL Editor → Run y luego actualiza.
  </div>

  <!-- ===================== HOY ===================== -->
  <div v-show="vista === 'hoy'" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <div class="lg:col-span-2 space-y-4">
      <!-- Agregar rápido -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-3">
        <div class="flex flex-wrap items-center gap-2">
          <i class="fa-solid fa-plus text-slate-400 ml-1"></i>
          <input v-model="rapido.titulo" @keydown.enter="agregarRapidoClick" placeholder="Agregar tarea para hoy y presionar Enter…" class="flex-1 min-w-[180px] text-sm px-2 py-2 outline-none">
          <input type="time" v-model="rapido.hora" title="Hora (opcional)" class="border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
          <label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer" title="Se repite todos los días">
            <input type="checkbox" v-model="rapido.diaria" class="accent-indigo-600"> Diaria
          </label>
          <button @click="agregarRapidoClick" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-3 py-2 rounded-lg">Agregar</button>
        </div>
      </div>

      <div class="text-sm font-bold text-slate-600 px-1">{{ fechaLarga(hoyRef) }}</div>

      <!-- Vencidas -->
      <div v-if="vencidas.length" class="bg-rose-50/70 border border-rose-200 rounded-2xl p-3">
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs font-extrabold uppercase tracking-wider text-rose-600"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Vencidas ({{ vencidas.length }})</div>
          <button @click="pasarVencidasHoy" class="text-[11px] font-bold text-rose-700 hover:underline">Pasar todas a hoy</button>
        </div>
        <div class="space-y-1.5"><tarea-item v-for="o in vencidas" :key="o.key" :o="o" vencida></tarea-item></div>
      </div>

      <!-- Rutina diaria -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-3">
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs font-extrabold uppercase tracking-wider text-indigo-600"><i class="fa-solid fa-rotate mr-1"></i>Tareas diarias ({{ rutinaHoy.filter(o => o.hecha).length }}/{{ rutinaHoy.length }})</div>
          <button @click="abrirNuevaTarea(hoyRef, { repeticion: 'LABORAL' })" class="text-[11px] font-bold text-indigo-600 hover:underline"><i class="fa-solid fa-plus mr-0.5"></i>Tarea diaria</button>
        </div>
        <div v-if="!rutinaHoy.length" class="text-xs text-slate-400 italic px-1 py-2">Sin tareas diarias. Crea las que haces todos los días (revisar correos, check list, reporte…).</div>
        <div class="space-y-1.5"><tarea-item v-for="o in rutinaHoy" :key="o.key" :o="o"></tarea-item></div>
      </div>

      <!-- Programadas para hoy -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-3">
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs font-extrabold uppercase tracking-wider text-amber-600"><i class="fa-solid fa-calendar-day mr-1"></i>Programadas para hoy ({{ programadasHoy.filter(o => o.hecha).length }}/{{ programadasHoy.length }})</div>
          <button @click="abrirNuevaTarea(hoyRef)" class="text-[11px] font-bold text-amber-700 hover:underline"><i class="fa-solid fa-plus mr-0.5"></i>Tarea</button>
        </div>
        <div v-if="!programadasHoy.length" class="text-xs text-slate-400 italic px-1 py-2">Nada programado para hoy.</div>
        <div class="space-y-1.5"><tarea-item v-for="o in programadasHoy" :key="o.key" :o="o"></tarea-item></div>
      </div>
    </div>

    <!-- Columna derecha: mini calendario + próximas -->
    <div class="space-y-4">
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-3">
        <div class="flex items-center justify-between mb-2">
          <button @click="mesRef = sumarMeses(mesRef, -1)" class="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-500"><i class="fa-solid fa-chevron-left text-xs"></i></button>
          <div class="text-sm font-extrabold text-slate-700">{{ tituloMes }}</div>
          <button @click="mesRef = sumarMeses(mesRef, 1)" class="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-500"><i class="fa-solid fa-chevron-right text-xs"></i></button>
        </div>
        <div class="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 mb-1"><div v-for="d in SEMANA_LUN" :key="d">{{ DIAS_CORTOS[d].charAt(0) }}</div></div>
        <div class="grid grid-cols-7 gap-0.5">
          <button v-for="c in celdasMes" :key="c.fecha" @click="irADia(c.fecha)"
            :class="['relative h-9 rounded-lg text-xs font-semibold transition', c.delMes ? 'text-slate-700' : 'text-slate-300',
                     c.fecha === hoyRef ? 'bg-amber-400 text-slate-950 font-extrabold' : 'hover:bg-slate-100']">
            {{ Number(c.fecha.slice(8)) }}
            <span v-if="c.items.length" class="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
              <span v-for="(o, i) in c.items.slice(0, 3)" :key="i" :class="['w-1 h-1 rounded-full', o.hecha ? 'bg-emerald-400' : estiloCategoria(o.t.categoria).cal]"></span>
            </span>
          </button>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-3">
        <div class="text-xs font-extrabold uppercase tracking-wider text-sky-600 mb-2"><i class="fa-solid fa-calendar-days mr-1"></i>Próximos 7 días</div>
        <div v-if="!proximas7.length" class="text-xs text-slate-400 italic px-1 py-2">Sin tareas programadas.</div>
        <div class="space-y-1.5"><tarea-item v-for="o in proximas7" :key="o.key" :o="o" compacto mostrar-fecha></tarea-item></div>
      </div>
    </div>
  </div>

  <!-- ===================== SEMANA ===================== -->
  <div v-show="vista === 'semana'" class="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 sm:p-4">
    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
      <div class="flex items-center gap-1">
        <button @click="semanaRef = sumarDiasISO(semanaRef, -7)" class="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500"><i class="fa-solid fa-chevron-left text-xs"></i></button>
        <button @click="semanaRef = lunesDe(hoyRef)" class="px-3 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600">Esta semana</button>
        <button @click="semanaRef = sumarDiasISO(semanaRef, 7)" class="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500"><i class="fa-solid fa-chevron-right text-xs"></i></button>
      </div>
      <div class="text-sm font-extrabold text-slate-700">{{ fechaCorta(semanaRef) }} al {{ fechaCorta(sumarDiasISO(semanaRef, 6)) }}</div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
      <div v-for="d in diasSemana" :key="d.fecha" :class="['rounded-xl border p-2 min-h-[140px] flex flex-col', d.fecha === hoyRef ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 bg-slate-50/50']">
        <div class="flex items-center justify-between mb-1.5">
          <div>
            <div class="text-[10px] font-extrabold uppercase text-slate-500">{{ DIAS_LARGOS[diaSemana(d.fecha)] }}</div>
            <div :class="['text-lg font-extrabold leading-none', d.fecha === hoyRef ? 'text-amber-600' : 'text-slate-700']">{{ Number(d.fecha.slice(8)) }}</div>
          </div>
          <button @click="abrirNuevaTarea(d.fecha)" class="w-7 h-7 rounded-lg hover:bg-white text-slate-400 hover:text-slate-700" title="Agregar"><i class="fa-solid fa-plus text-xs"></i></button>
        </div>
        <div class="space-y-1 flex-1">
          <button v-for="o in d.items" :key="o.key" @click="abrirEditarTarea(o.t)"
            :class="['w-full text-left rounded-lg px-2 py-1 text-[11px] leading-snug border-l-[3px] bg-white shadow-sm hover:shadow', estiloPrioridad(o.t.prioridad).borde, o.hecha ? 'opacity-50 line-through' : '']">
            <span v-if="o.t.hora" class="font-bold text-slate-600 mr-1">{{ o.t.hora }}</span><span class="text-slate-800">{{ o.t.titulo }}</span>
            <i v-if="esRepetitiva(o.t)" class="fa-solid fa-rotate text-[9px] text-indigo-400 ml-1"></i>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- ===================== MES ===================== -->
  <div v-show="vista === 'mes'" class="grid grid-cols-1 xl:grid-cols-4 gap-4">
    <div class="xl:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 p-3 sm:p-4">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div class="flex items-center gap-1">
          <button @click="mesRef = sumarMeses(mesRef, -1)" class="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500"><i class="fa-solid fa-chevron-left text-xs"></i></button>
          <button @click="mesRef = primeroMes(hoyRef); diaSel = hoyRef" class="px-3 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600">Hoy</button>
          <button @click="mesRef = sumarMeses(mesRef, 1)" class="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500"><i class="fa-solid fa-chevron-right text-xs"></i></button>
        </div>
        <div class="text-lg font-extrabold text-slate-800">{{ tituloMes }}</div>
        <label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer"><input type="checkbox" v-model="verRutina" class="accent-indigo-600"> Mostrar tareas diarias</label>
      </div>
      <div class="grid grid-cols-7 text-center text-[10px] sm:text-xs font-extrabold uppercase text-slate-400 mb-1">
        <div v-for="d in SEMANA_LUN" :key="d" class="py-1">{{ DIAS_CORTOS[d] }}</div>
      </div>
      <div class="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden">
        <div v-for="c in celdasMes" :key="c.fecha" @click="diaSel = c.fecha" @dblclick="abrirNuevaTarea(c.fecha)"
          :class="['min-h-[64px] sm:min-h-[104px] p-1 sm:p-1.5 cursor-pointer transition', c.delMes ? 'bg-white' : 'bg-slate-50',
                   diaSel === c.fecha ? 'ring-2 ring-inset ring-amber-400' : 'hover:bg-amber-50/40']">
          <div class="flex items-center justify-between">
            <span :class="['text-[11px] sm:text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center', c.fecha === hoyRef ? 'bg-amber-400 text-slate-950' : c.delMes ? 'text-slate-700' : 'text-slate-300']">{{ Number(c.fecha.slice(8)) }}</span>
            <span v-if="c.items.length" class="sm:hidden text-[9px] font-bold text-slate-500">{{ c.items.length }}</span>
          </div>
          <div class="hidden sm:block space-y-0.5 mt-0.5">
            <div v-for="o in c.items.slice(0, 3)" :key="o.key" :class="['truncate rounded px-1 py-0.5 text-[10px] font-semibold text-white', o.hecha ? 'bg-emerald-400/80 line-through' : estiloCategoria(o.t.categoria).cal]" :title="(o.t.hora ? o.t.hora + ' ' : '') + o.t.titulo">
              <span v-if="o.t.hora">{{ o.t.hora }} </span>{{ o.t.titulo }}
            </div>
            <div v-if="c.items.length > 3" class="text-[10px] font-bold text-slate-500 px-1">+{{ c.items.length - 3 }} más</div>
          </div>
          <div class="sm:hidden flex flex-wrap gap-0.5 mt-1">
            <span v-for="(o, i) in c.items.slice(0, 4)" :key="i" :class="['w-1.5 h-1.5 rounded-full', o.hecha ? 'bg-emerald-400' : estiloCategoria(o.t.categoria).cal]"></span>
          </div>
        </div>
      </div>
      <p class="text-[11px] text-slate-400 mt-2"><i class="fa-solid fa-circle-info mr-1"></i>Clic en un día para ver sus tareas · doble clic para agregar una tarea en ese día.</p>
    </div>
    <!-- Detalle del día elegido -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 h-fit xl:sticky xl:top-24">
      <div class="flex items-start justify-between mb-2">
        <div>
          <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{{ fechaRelativa(diaSel) }}</div>
          <div class="font-extrabold text-slate-800">{{ fechaLarga(diaSel) }}</div>
        </div>
        <button @click="abrirNuevaTarea(diaSel)" class="bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg"><i class="fa-solid fa-plus mr-1"></i>Agregar</button>
      </div>
      <div v-if="!tareasDiaSel.length" class="text-xs text-slate-400 italic py-4 text-center">Sin tareas este día.</div>
      <div class="space-y-1.5"><tarea-item v-for="o in tareasDiaSel" :key="o.key" :o="o" compacto></tarea-item></div>
    </div>
  </div>

  <!-- ===================== TODAS ===================== -->
  <div v-show="vista === 'lista'" class="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 sm:p-4">
    <div class="flex flex-wrap items-center gap-2 mb-3">
      <div class="relative flex-1 min-w-[200px]">
        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
        <input v-model="filtro.texto" placeholder="Buscar tarea…" class="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm">
      </div>
      <select v-model="filtro.tipo" class="border border-slate-200 rounded-xl px-3 py-2 text-sm">
        <option value="">Todas</option><option value="unicas">Programadas (una vez)</option><option value="repetitivas">Que se repiten</option>
      </select>
      <select v-model="filtro.categoria" class="border border-slate-200 rounded-xl px-3 py-2 text-sm">
        <option value="">Todas las categorías</option><option v-for="c in categoriasUsadas" :key="c" :value="c">{{ c }}</option>
      </select>
      <select v-model="filtro.estado" class="border border-slate-200 rounded-xl px-3 py-2 text-sm">
        <option value="activas">Pendientes / activas</option><option value="terminadas">Terminadas</option><option value="pausadas">Pausadas</option><option value="todas">Todas</option>
      </select>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
          <th class="py-2 pr-2">Tarea</th><th class="py-2 px-2">Cuándo</th><th class="py-2 px-2">Próxima</th><th class="py-2 px-2">Aviso</th><th class="py-2 px-2">Categoría</th><th class="py-2 pl-2 text-right">Acciones</th>
        </tr></thead>
        <tbody>
          <tr v-for="t in listaFiltrada" :key="t.id" class="border-b border-slate-100 hover:bg-slate-50">
            <td class="py-2 pr-2">
              <div class="flex items-center gap-2">
                <span :class="['w-2 h-2 rounded-full shrink-0', estiloPrioridad(t.prioridad).dot]"></span>
                <button @click="abrirEditarTarea(t)" :class="['font-semibold text-left hover:underline', !t.activa ? 'text-slate-400' : 'text-slate-800']">{{ t.titulo }}</button>
                <span v-if="!t.activa" class="text-[10px] font-bold bg-slate-200 text-slate-600 rounded px-1.5">PAUSADA</span>
                <span v-if="terminada(t)" class="text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded px-1.5">HECHA</span>
              </div>
              <div v-if="t.detalle" class="text-[11px] text-slate-500 truncate max-w-[340px] ml-4">{{ t.detalle }}</div>
            </td>
            <td class="py-2 px-2 text-xs text-slate-600 whitespace-nowrap">
              <span v-if="esRepetitiva(t)" class="text-indigo-600"><i class="fa-solid fa-rotate mr-1"></i>{{ textoRepeticion(t) }}</span>
              <span v-else>{{ fechaCorta(t.fecha) }}</span>
              <span v-if="t.hora" class="ml-1 font-bold">{{ t.hora }}</span>
            </td>
            <td class="py-2 px-2 text-xs whitespace-nowrap">
              <template v-if="t.activa && proximaFecha(t)"><span :class="proximaFecha(t) === hoyRef ? 'font-bold text-amber-600' : 'text-slate-600'">{{ fechaRelativa(proximaFecha(t)) }}</span></template>
              <span v-else class="text-slate-300">—</span>
            </td>
            <td class="py-2 px-2 text-xs text-slate-500 whitespace-nowrap">
              <span v-if="t.hora && t.aviso_min !== null"><i class="fa-solid fa-bell text-amber-500 mr-1"></i>{{ (AVISOS_MIN.find(a => a.v === t.aviso_min) || {}).l }}</span>
              <span v-if="t.aviso_dias" class="ml-1"><i class="fa-solid fa-calendar-days text-sky-500 mr-1"></i>{{ t.aviso_dias }} d antes</span>
              <span v-if="!(t.hora && t.aviso_min !== null) && !t.aviso_dias" class="text-slate-300">—</span>
            </td>
            <td class="py-2 px-2"><span :class="['px-1.5 py-0.5 rounded font-bold text-[10px] uppercase', estiloCategoria(t.categoria).chip]">{{ t.categoria }}</span></td>
            <td class="py-2 pl-2 text-right whitespace-nowrap">
              <button @click="abrirEditarTarea(t)" class="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-500" title="Editar"><i class="fa-solid fa-pen text-xs"></i></button>
              <button @click="abrirNuevaTarea(hoyRef, duplicar(t))" class="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-500" title="Duplicar"><i class="fa-regular fa-copy text-xs"></i></button>
              <button v-if="esRepetitiva(t)" @click="pausarTarea(t)" class="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-500" :title="t.activa ? 'Pausar' : 'Reanudar'"><i :class="['fa-solid text-xs', t.activa ? 'fa-pause' : 'fa-play']"></i></button>
              <button @click="eliminarTarea(t)" class="w-8 h-8 rounded-lg hover:bg-rose-100 text-rose-500" title="Eliminar"><i class="fa-solid fa-trash text-xs"></i></button>
            </td>
          </tr>
          <tr v-if="!listaFiltrada.length"><td colspan="6" class="py-8 text-center text-slate-400 text-sm italic">No hay tareas con este filtro.</td></tr>
        </tbody>
      </table>
    </div>
    <div class="text-[11px] text-slate-400 mt-2">{{ listaFiltrada.length }} tarea(s) · {{ dbTareas.length }} en total</div>
  </div>

  <!-- ===================== AVISOS ===================== -->
  <div v-show="vista === 'avisos'" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4">
      <h3 class="font-extrabold text-slate-800"><i class="fa-solid fa-sliders text-amber-500 mr-2"></i>Cómo te aviso</h3>
      <div class="flex items-center justify-between gap-3 p-3 rounded-xl border" :class="permisoNotif === 'granted' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'">
        <div class="text-sm">
          <div class="font-bold" :class="permisoNotif === 'granted' ? 'text-emerald-700' : 'text-amber-800'">
            <i :class="['fa-solid mr-1', permisoNotif === 'granted' ? 'fa-circle-check' : 'fa-bell-slash']"></i>
            Notificaciones de Windows: {{ { granted: 'activadas', denied: 'bloqueadas', default: 'sin activar', unsupported: 'no disponibles' }[permisoNotif] }}
          </div>
          <div v-if="permisoNotif === 'denied'" class="text-xs text-slate-600 mt-0.5">Clic en el candado de la barra de direcciones → Notificaciones → Permitir, y actualiza la página.</div>
        </div>
        <button v-if="permisoNotif === 'default'" @click="pedirPermisoNotif()" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-3 py-2 rounded-lg whitespace-nowrap">Activar</button>
      </div>
      <label class="flex items-start gap-3 cursor-pointer"><input type="checkbox" v-model="prefAvisos.windows" class="mt-1 accent-amber-500">
        <span><span class="font-semibold text-sm text-slate-800">Notificación de Windows</span><br><span class="text-xs text-slate-500">Aparece aunque estés en otra ventana o programa.</span></span></label>
      <label class="flex items-start gap-3 cursor-pointer"><input type="checkbox" v-model="prefAvisos.sonido" class="mt-1 accent-amber-500">
        <span class="flex-1"><span class="font-semibold text-sm text-slate-800">Sonido</span>
          <span class="flex items-center gap-2 mt-1"><i class="fa-solid fa-volume-low text-slate-400 text-xs"></i><input type="range" min="0.1" max="1" step="0.1" v-model.number="prefAvisos.volumen" class="flex-1 accent-amber-500"><button type="button" @click.prevent="sonar(prefAvisos.volumen)" class="text-xs font-bold text-slate-600 hover:text-slate-900">Escuchar</button></span></span></label>
      <label class="flex items-start gap-3 cursor-pointer"><input type="checkbox" v-model="prefAvisos.resumenLogin" class="mt-1 accent-amber-500">
        <span><span class="font-semibold text-sm text-slate-800">Ventana resumen al iniciar sesión</span><br><span class="text-xs text-slate-500">Vencidas, tareas de hoy y las que se acercan.</span></span></label>
      <label class="flex items-start gap-3 cursor-pointer"><input type="checkbox" v-model="prefAvisos.resumenManana" class="mt-1 accent-amber-500">
        <span class="flex-1"><span class="font-semibold text-sm text-slate-800">Resumen del día a las</span>
          <input type="time" v-model="prefAvisos.horaResumen" class="ml-2 border border-slate-200 rounded-lg px-2 py-1 text-sm"><br>
          <span class="text-xs text-slate-500">Avisa cuántas tareas tienes hoy (incluye las de "todo el día") y las programadas con aviso anticipado.</span></span></label>
      <label class="flex items-start gap-3 cursor-pointer"><input type="checkbox" v-model="prefAvisos.seguirTrasCierre" class="mt-1 accent-amber-500">
        <span><span class="font-semibold text-sm text-slate-800">Seguir avisando si la sesión se cierra por inactividad</span><br><span class="text-xs text-slate-500">Avisa las tareas con hora de las próximas 24 h mientras la página siga abierta. Se borra al apretar "Salir".</span></span></label>
      <div class="flex gap-2 pt-2 border-t border-slate-100">
        <button @click="probarAviso" class="bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold px-4 py-2 rounded-xl"><i class="fa-solid fa-bell mr-1"></i>Probar aviso</button>
      </div>
    </div>
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 text-sm text-slate-600 space-y-3">
      <h3 class="font-extrabold text-slate-800"><i class="fa-solid fa-circle-info text-sky-500 mr-2"></i>Cómo funciona</h3>
      <ul class="space-y-2 list-disc pl-5">
        <li><b>Tareas diarias</b>: se repiten (todos los días, lunes a viernes, cada N días). Se marcan cada día por separado y llevan la racha <i class="fa-solid fa-fire text-orange-500"></i> de días cumplidos.</li>
        <li><b>Tareas programadas</b>: una sola vez en una fecha, o semanal / mensual / anual. Si un día pasa sin marcarla, queda <b class="text-rose-600">vencida</b> hasta que la marques o la cambies de fecha.</li>
        <li><b>Aviso con hora</b>: X minutos antes y a la hora. En el aviso puedes marcarla hecha o posponer 5/10/30 min.</li>
        <li><b>Aviso con anticipación</b>: para fechas importantes (vencimientos, entregas) te avisa desde N días antes.</li>
        <li>La <b>campana</b> del encabezado muestra cuántas tienes pendientes hoy + vencidas (rojo si hay vencidas).</li>
        <li>Los avisos funcionan mientras el sistema esté <b>abierto en el navegador</b> (puede estar minimizado o en otra pestaña). Si el navegador está cerrado, al entrar verás el resumen.</li>
        <li>Tus tareas son <b>privadas</b>: nadie más las ve, tampoco el administrador. Las ves en cualquier computador o celular donde entres con tu usuario.</li>
      </ul>
    </div>
  </div>
</div>
`;
