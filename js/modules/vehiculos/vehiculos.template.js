// Plantilla HTML del módulo VEHÍCULOS (Operaciones → Equipos → Vehículos)
export default /* html */ `
<section class="space-y-5 text-xs">

  <!-- Encabezado -->
  <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
    <div>
      <h2 class="text-lg font-extrabold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-car-side text-amber-500"></i> Vehículos</h2>
      <p class="text-slate-500 mt-0.5">Equipos cuyo AFI es una <b>patente XXXX-XX</b>. Kilometraje y horómetro con mantención estimada, y documentos con <b>aviso de vencimiento</b>.</p>
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <button @click="recargarTodo" :disabled="cargandoVeh" title="Recargar" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2.5 rounded-xl border"><i :class="['fa-solid fa-rotate', cargandoVeh ? 'fa-spin' : '']"></i></button>
      <button @click="exportarVehiculosExcel" :disabled="exportandoVeh || !vehiculos.length" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow flex items-center gap-2 disabled:opacity-60"><i :class="['fa-solid', exportandoVeh ? 'fa-spinner fa-spin' : 'fa-file-excel']"></i> Exportar Excel</button>
      <button v-if="puedeEditar" @click="abrirNuevoVehiculo" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl shadow flex items-center gap-2"><i class="fa-solid fa-plus-circle"></i> Agregar vehículo</button>
    </div>
  </div>

  <div v-if="faltaSQLVeh" class="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-4 font-semibold">
    <i class="fa-solid fa-triangle-exclamation mr-1"></i> Las tablas del módulo aún no existen. Ejecuta <b>sql/vehiculos.sql</b> en Supabase → SQL Editor y luego presiona recargar. (Los vehículos se ven igual, pero sin kilometraje ni documentos.)
  </div>

  <!-- Resumen -->
  <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
    <div @click="limpiarFiltroVeh" class="rounded-xl border p-3 bg-white cursor-pointer hover:shadow"><p class="text-[10px] font-bold text-slate-500 uppercase">Vehículos</p><p class="text-2xl font-extrabold text-slate-800">{{ resumenVeh.total }} <span v-if="resumenVeh.vehAlerta" class="text-xs font-bold text-rose-500">· {{ resumenVeh.vehAlerta }} con aviso</span></p></div>
    <div @click="filtroVeh.alerta = 'VENCIDOS'" class="rounded-xl border p-3 bg-rose-50 border-rose-300 text-rose-800 cursor-pointer hover:shadow"><p class="text-[10px] font-bold uppercase">Documentos vencidos</p><p class="text-2xl font-extrabold">{{ resumenVeh.vencidos }}</p></div>
    <div @click="filtroVeh.alerta = 'POR_VENCER'" class="rounded-xl border p-3 bg-amber-50 border-amber-300 text-amber-800 cursor-pointer hover:shadow"><p class="text-[10px] font-bold uppercase">Documentos por vencer</p><p class="text-2xl font-extrabold">{{ resumenVeh.porVencer }}</p></div>
    <div @click="filtroVeh.alerta = 'FALTAN'" class="rounded-xl border p-3 bg-slate-50 border-slate-300 text-slate-700 cursor-pointer hover:shadow"><p class="text-[10px] font-bold uppercase">Doc. principales sin cargar</p><p class="text-2xl font-extrabold">{{ resumenVeh.faltan }}</p></div>
    <div @click="filtroVeh.alerta = 'KM'" class="rounded-xl border p-3 bg-blue-50 border-blue-300 text-blue-800 cursor-pointer hover:shadow"><p class="text-[10px] font-bold uppercase">Mant. por km (próx./pasada)</p><p class="text-2xl font-extrabold">{{ resumenVeh.km }}</p></div>
    <div @click="filtroVeh.alerta = 'HORO'" class="rounded-xl border p-3 bg-violet-50 border-violet-300 text-violet-800 cursor-pointer hover:shadow"><p class="text-[10px] font-bold uppercase">Mant. por horómetro</p><p class="text-2xl font-extrabold">{{ resumenVeh.horo }}</p></div>
  </div>

  <!-- Avisos -->
  <div v-if="avisosVeh.length" class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <button @click="verAvisos = !verAvisos" class="w-full px-4 py-3 flex items-center justify-between bg-slate-800 text-white font-bold">
      <span><i class="fa-solid fa-bell text-amber-400 mr-2"></i>Avisos ({{ avisosVeh.length }}) <span class="font-normal text-slate-300 ml-1">· documentos y mantenciones que requieren atención</span></span>
      <i :class="['fa-solid fa-chevron-down transition-transform', verAvisos ? 'rotate-180' : '']"></i>
    </button>
    <div v-show="verAvisos" class="divide-y max-h-72 overflow-y-auto">
      <div v-for="(a, i) in avisosVeh" :key="i" @click="abrirPerfilVehiculo(a.v, a.tab)" class="px-4 py-2 flex items-center gap-3 hover:bg-slate-50 cursor-pointer">
        <span :class="['w-2.5 h-2.5 rounded-full shrink-0', a.rojo ? 'bg-rose-600 animate-pulse' : 'bg-amber-500']"></span>
        <span class="font-mono font-extrabold bg-white border-2 border-slate-800 rounded px-1.5 py-0.5 tracking-wider">{{ a.v.patente }}</span>
        <i :class="['fa-solid w-4 text-center', a.tipo === 'DOC' ? 'fa-file-lines text-slate-500' : a.tipo === 'KM' ? 'fa-road text-blue-600' : 'fa-gauge-high text-violet-600']"></i>
        <span class="font-bold text-slate-800">{{ a.titulo }}</span>
        <span :class="['ml-auto font-semibold text-right', a.rojo ? 'text-rose-700' : 'text-amber-700']">{{ a.detalle }}</span>
      </div>
    </div>
  </div>

  <!-- Filtros -->
  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 flex flex-wrap gap-2 items-end">
    <div><label class="block text-[10px] font-bold text-slate-500">Buscar</label><input v-model="filtroVeh.texto" type="text" placeholder="Patente, N° AFI, tipo, marca..." class="p-2 border rounded-lg w-64"></div>
    <div><label class="block text-[10px] font-bold text-slate-500">Avisos</label>
      <select v-model="filtroVeh.alerta" class="p-2 border rounded-lg font-bold">
        <option value="TODOS">Todos</option><option value="ALERTAS">Con algún aviso</option><option value="VENCIDOS">Documentos vencidos</option>
        <option value="POR_VENCER">Documentos por vencer</option><option value="FALTAN">Doc. principales sin cargar</option>
        <option value="KM">Mantención por km</option><option value="HORO">Mantención por horómetro</option>
      </select></div>
    <div><label class="block text-[10px] font-bold text-slate-500">Estado</label>
      <select v-model="filtroVeh.estado" class="p-2 border rounded-lg font-bold">
        <option value="ALL">Todos</option><option value="Operativo">Trabajando / Operativo</option><option value="Disponible">Disponible</option>
        <option value="En Traslado">En Traslado</option><option value="En Mantencion">En Mantención</option><option value="Fuera de Servicio">Fuera de Servicio</option><option value="Venta">En Venta</option>
      </select></div>
    <div><label class="block text-[10px] font-bold text-slate-500">Orden</label>
      <select v-model="filtroVeh.orden" class="p-2 border rounded-lg font-bold"><option value="asc">Patente A→Z</option><option value="desc">Patente Z→A</option><option value="alerta">Más urgentes primero</option></select></div>
    <button @click="limpiarFiltroVeh" class="text-slate-500 hover:text-slate-800 underline pb-2">Limpiar</button>
    <span class="ml-auto pb-2 text-slate-400 font-semibold">{{ listaVehiculos.length }} de {{ vehiculos.length }} vehículos</span>
  </div>

  <!-- Tarjetas -->
  <div v-if="!vehiculos.length" class="bg-white rounded-2xl border p-10 text-center text-slate-400">
    No hay vehículos. Un equipo aparece aquí cuando su AFI es una patente con formato <b>XXXX-XX</b>.
  </div>
  <div v-else-if="!listaVehiculos.length" class="bg-white rounded-2xl border p-10 text-center text-slate-400">No hay vehículos con este filtro.</div>
  <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    <div v-for="v in listaVehiculos" :key="v.patente" :class="['bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col justify-between', nivelBorde(v.nivel)]">
      <div>
        <div class="relative h-36 bg-slate-900">
          <img :src="v.eq.foto || placeholderImg(v.patente)" class="w-full h-full object-cover opacity-90">
          <span :class="['absolute top-2 right-2 px-2.5 py-1 rounded-md text-[10px] font-bold shadow-md', getBadgeClass(v.eq.disponibilidad)]">{{ getEstadoText(v.eq.disponibilidad) }}</span>
          <!-- Patente estilo placa -->
          <div class="absolute bottom-2 left-2 bg-white border-[3px] border-slate-900 rounded-md px-2.5 pt-0.5 pb-1 shadow-lg text-center leading-none">
            <span class="block text-[7px] font-bold tracking-[0.3em] text-slate-500">CHILE</span>
            <span class="font-mono font-extrabold text-lg tracking-widest text-slate-900">{{ v.patente }}</span>
          </div>
          <label v-if="puedeEditar" class="absolute bottom-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white p-1.5 rounded-lg text-xs cursor-pointer shadow flex items-center gap-1">
            <i class="fa-solid fa-camera"></i><input type="file" @change="uploadFotoEquipo($event, v.eq)" accept="image/*" class="hidden">
          </label>
        </div>
        <div class="p-4 space-y-3">
          <div class="flex items-start justify-between gap-2">
            <div>
              <h3 class="font-bold text-sm text-slate-800">{{ v.eq.tipo || 'Vehículo' }}</h3>
              <p class="text-slate-500">{{ v.eq.marca }} {{ v.eq.modelo }}</p>
            </div>
            <span :class="['text-[10px] font-mono font-bold px-2 py-0.5 rounded border whitespace-nowrap', v.conf.numeroAfi ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-400 bg-slate-50 border-slate-200 italic']" title="N° AFI interno del vehículo">AFI: {{ v.conf.numeroAfi || 'sin N°' }}</span>
          </div>
          <div class="text-slate-600 space-y-0.5">
            <p><i class="fa-solid fa-location-dot w-4 text-rose-500"></i> {{ v.eq.ubicacion || 'Sin ubicación' }}</p>
            <p v-if="empresaDe(v.eq)"><i class="fa-solid fa-building w-4 text-blue-500"></i> {{ empresaDe(v.eq) }}</p>
          </div>

          <!-- Kilometraje -->
          <div :class="['rounded-xl p-3 space-y-2 border', kmCard(v.km)]">
            <div class="flex justify-between items-center font-bold">
              <span><i class="fa-solid fa-road text-blue-600"></i> Kilometraje <span class="text-[10px] text-slate-500 font-semibold">· cada {{ fmtKm(v.km.frecuencia) }}</span></span>
              <span :class="['px-2 py-0.5 rounded text-[10px] font-bold uppercase', kmBadge(v.km)]">{{ v.km.estado }}</span>
            </div>
            <div class="grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <div class="bg-white/80 p-1.5 rounded border"><span class="text-slate-500 font-bold block">KM TOMADO</span><strong class="font-mono text-slate-800">{{ fmtNum(v.km.kmTomado) }}</strong></div>
              <div class="bg-white/80 p-1.5 rounded border"><span class="text-slate-500 font-bold block">APROX HOY</span><strong class="font-mono text-blue-700">{{ fmtNum(v.km.kmAprox) }}</strong></div>
              <div class="bg-white/80 p-1.5 rounded border"><span class="text-slate-500 font-bold block">META</span><strong class="font-mono text-emerald-700">{{ fmtNum(v.km.kmMeta) }}</strong></div>
            </div>
            <div class="text-[11px] text-center bg-white/60 p-1 rounded">
              <template v-if="v.km.kmMeta !== null">{{ v.km.faltan < 0 ? 'Pasado por' : v.km.faltan === 0 ? 'Meta alcanzada' : 'Faltan' }} <b>{{ fmtKm(Math.abs(v.km.faltan)) }}</b> · aprox. <b>{{ formatDateForDisplay(v.km.fechaEstimada) }}</b> · {{ fmtNum(v.km.rate) }} km/día</template>
              <span v-else class="text-slate-500 italic">{{ v.km.nLecturas ? 'Registra la última mantención (km) para calcular la meta' : 'Sin lecturas de kilometraje' }}</span>
            </div>
          </div>

          <!-- Horómetro -->
          <div :class="['rounded-xl p-3 space-y-2 border', getHorometroCardBgClass(v.eq.horometros)]">
            <div class="flex justify-between items-center font-bold">
              <span><i class="fa-solid fa-gauge-high text-amber-600"></i> Horómetro <span class="text-[10px] text-slate-500 font-semibold">· cada {{ v.eq.frecuenciaMantencion }}h</span></span>
              <span :class="['px-2 py-0.5 rounded text-[10px] font-bold uppercase', getPrediccionStatusBadge(v.eq.horometros)]">{{ v.eq.horometros?.estadoTexto || 'OK' }}</span>
            </div>
            <div class="grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <div class="bg-white/80 p-1.5 rounded border"><span class="text-slate-500 font-bold block">H. TOMADO</span><strong class="font-mono">{{ v.eq.horometros?.hTomado || 0 }}h</strong></div>
              <div class="bg-white/80 p-1.5 rounded border"><span class="text-slate-500 font-bold block">APROX HOY</span><strong class="font-mono text-blue-700">{{ v.eq.horometros?.hAprox || 0 }}h</strong></div>
              <div class="bg-white/80 p-1.5 rounded border"><span class="text-slate-500 font-bold block">META</span><strong class="font-mono text-emerald-700">{{ v.eq.horometros?.hTarget || 0 }}h</strong></div>
            </div>
          </div>

          <!-- Documentos principales -->
          <div class="grid grid-cols-3 gap-1.5">
            <div v-for="p in v.principales" :key="p.def.key" @click="abrirPerfilVehiculo(v, 'documentos')" :class="['rounded-lg border p-1.5 text-center cursor-pointer hover:shadow', p.est.card]" :title="p.def.label + ': ' + p.est.texto">
              <span class="block text-[10px] font-extrabold text-slate-700"><i :class="['fa-solid mr-0.5', p.def.icon]"></i> {{ p.def.corto }}</span>
              <span :class="['inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold', p.est.badge]">{{ p.est.label }}</span>
              <span class="block text-[10px] font-mono mt-0.5 text-slate-600">{{ p.doc ? formatDateForDisplay(p.doc.fechaVencimiento) : '—' }}</span>
            </div>
          </div>
          <p v-if="v.secundarios.length" class="text-[10px] text-slate-500">
            <i class="fa-solid fa-folder-open mr-1"></i>{{ v.secundarios.length }} doc. secundario{{ v.secundarios.length === 1 ? '' : 's' }}
            <span v-if="v.secundarios.some(s => s.est.key === 'VENCIDO')" class="text-rose-600 font-bold"> · hay vencidos</span>
            <span v-else-if="v.secundarios.some(s => s.est.key === 'POR_VENCER')" class="text-amber-600 font-bold"> · hay por vencer</span>
          </p>
        </div>
      </div>
      <div class="p-3 bg-slate-50 border-t flex items-center gap-2">
        <button @click="abrirPerfilVehiculo(v)" class="text-xs bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-sm transition flex-1 justify-center"><i class="fa-solid fa-car text-amber-400"></i> Perfil Vehículo</button>
        <button @click="abrirPerfilEquipoDeVeh(v)" class="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-sm transition" title="Historial de mantenciones, ubicación, programas"><i class="fa-solid fa-id-card"></i> Equipo</button>
      </div>
    </div>
  </div>

  <!-- ===================== PERFIL DEL VEHÍCULO ===================== -->
  <div v-if="vehPerfil" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl border w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden">
      <div class="px-6 py-4 border-b flex flex-wrap items-center justify-between gap-3 bg-slate-800 text-white">
        <div class="flex items-center gap-3">
          <div class="bg-white border-[3px] border-amber-400 rounded-md px-2.5 pt-0.5 pb-1 text-center leading-none">
            <span class="block text-[7px] font-bold tracking-[0.3em] text-slate-500">CHILE</span>
            <span class="font-mono font-extrabold text-xl tracking-widest text-slate-900">{{ vehPerfil.patente }}</span>
          </div>
          <div>
            <h3 class="text-base font-extrabold uppercase tracking-wide">{{ vehPerfil.eq.tipo || 'Vehículo' }} <span class="font-semibold text-slate-300 normal-case">{{ vehPerfil.eq.marca }} {{ vehPerfil.eq.modelo }}</span></h3>
            <p class="text-[11px] text-slate-300"><span class="font-mono font-bold bg-amber-500 text-slate-900 px-2 py-0.5 rounded mr-1">AFI: {{ vehPerfil.conf.numeroAfi || 'sin N°' }}</span> {{ getEstadoText(vehPerfil.eq.disponibilidad) }} · {{ vehPerfil.eq.ubicacion || 'Sin ubicación' }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button v-if="puedeEditar" @click="abrirFormularioNuevaMantencion(vehPerfil.patente)" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow"><i class="fa-solid fa-plus-circle"></i> Agregar Mantención</button>
          <button @click="abrirPerfilEquipoDeVeh(vehPerfil)" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow" title="Historial, ubicación, programas, OC"><i class="fa-solid fa-id-card"></i> Perfil Equipo</button>
          <button @click="cerrarPerfilVehiculo" class="w-8 h-8 rounded-full bg-slate-700 hover:bg-rose-500 text-white flex items-center justify-center transition shadow"><i class="fa-solid fa-xmark text-base"></i></button>
        </div>
      </div>

      <div class="flex gap-1 px-6 pt-3 border-b border-slate-300 bg-slate-100">
        <button v-for="p in [{k:'resumen',l:'Resumen',i:'fa-car'},{k:'km',l:'Kilometraje y Horómetro',i:'fa-road'},{k:'documentos',l:'Documentos',i:'fa-folder-open'}]" :key="p.k" @click="tabPerfilVeh = p.k"
          :class="['px-4 py-2.5 font-bold rounded-t-lg border border-b-0 -mb-px transition', tabPerfilVeh === p.k ? 'bg-white text-amber-600 border-slate-300' : 'bg-slate-100 text-slate-500 border-transparent hover:text-slate-800']">
          <i :class="['fa-solid mr-1.5', p.i]"></i>{{ p.l }}
          <span v-if="p.k === 'documentos' && (vehPerfil.nVencidos + vehPerfil.nPorVencer)" :class="['ml-1 px-1.5 rounded-full text-[10px] text-white', vehPerfil.nVencidos ? 'bg-rose-600' : 'bg-amber-500']">{{ vehPerfil.nVencidos + vehPerfil.nPorVencer }}</span>
        </button>
      </div>

      <div class="p-6 overflow-y-auto space-y-5 flex-grow bg-slate-50 text-xs">

        <!-- ---------- RESUMEN ---------- -->
        <template v-if="tabPerfilVeh === 'resumen'">
          <div class="grid md:grid-cols-3 gap-4">
            <div :class="['rounded-xl border p-4 space-y-1', kmCard(vehPerfil.km)]">
              <p class="font-bold flex justify-between"><span><i class="fa-solid fa-road text-blue-600 mr-1"></i> Kilometraje</span><span :class="['px-2 py-0.5 rounded text-[10px] font-bold', kmBadge(vehPerfil.km)]">{{ vehPerfil.km.estado }}</span></p>
              <p class="text-2xl font-extrabold font-mono text-blue-700">{{ fmtKm(vehPerfil.km.kmAprox) }} <span class="text-[10px] text-slate-500 font-sans">aprox. hoy</span></p>
              <p>Meta: <b>{{ fmtKm(vehPerfil.km.kmMeta) }}</b> · {{ vehPerfil.km.kmMeta !== null ? (vehPerfil.km.faltan < 0 ? 'pasado por ' : 'faltan ') + fmtKm(Math.abs(vehPerfil.km.faltan)) : 'sin mantención registrada' }}</p>
              <p>Fecha aprox.: <b>{{ formatDateForDisplay(vehPerfil.km.fechaEstimada) }}</b></p>
            </div>
            <div :class="['rounded-xl border p-4 space-y-1', getHorometroCardBgClass(vehPerfil.eq.horometros)]">
              <p class="font-bold flex justify-between"><span><i class="fa-solid fa-gauge-high text-amber-600 mr-1"></i> Horómetro</span><span :class="['px-2 py-0.5 rounded text-[10px] font-bold', getPrediccionStatusBadge(vehPerfil.eq.horometros)]">{{ vehPerfil.eq.horometros?.estadoTexto || 'OK' }}</span></p>
              <p class="text-2xl font-extrabold font-mono text-blue-700">{{ vehPerfil.eq.horometros?.hAprox || 0 }} h <span class="text-[10px] text-slate-500 font-sans">aprox. hoy</span></p>
              <p>Meta: <b>{{ vehPerfil.eq.horometros?.hTarget || 0 }} h</b> · faltan {{ vehPerfil.eq.horometros?.horasFaltantes ?? '-' }} h</p>
              <p>Fecha aprox.: <b>{{ formatDateForDisplay(vehPerfil.eq.horometros?.fechaEstimada) }}</b></p>
            </div>
            <div class="rounded-xl border p-4 bg-white space-y-2">
              <p class="font-bold"><i class="fa-solid fa-folder-open text-slate-500 mr-1"></i> Documentos principales</p>
              <div v-for="p in vehPerfil.principales" :key="p.def.key" class="flex items-center justify-between gap-2">
                <span class="font-semibold"><i :class="['fa-solid w-4 text-slate-400', p.def.icon]"></i> {{ p.def.label }}</span>
                <span :class="['px-1.5 py-0.5 rounded text-[10px] font-bold', p.est.badge]" :title="p.est.texto">{{ p.est.label }}</span>
              </div>
              <button @click="tabPerfilVeh = 'documentos'" class="text-blue-600 underline font-bold">Ver documentos →</button>
            </div>
          </div>

          <div class="bg-white p-5 rounded-xl border shadow-sm">
            <h4 class="font-bold text-slate-800 uppercase border-b pb-2 mb-4"><i class="fa-solid fa-sliders text-amber-500 mr-1"></i> Datos del vehículo</h4>
            <div class="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div><label class="block font-bold text-slate-700 mb-1">Patente (AFI en el sistema)</label><input :value="vehPerfil.patente" disabled class="w-full p-2 border rounded-lg bg-slate-100 font-mono font-extrabold tracking-widest"></div>
              <div><label class="block font-bold text-slate-700 mb-1">N° AFI del vehículo</label><input v-model="formConf.numeroAfi" :disabled="!puedeEditar" type="text" placeholder="Ej: 615" class="w-full p-2 border rounded-lg font-bold text-amber-800"></div>
              <div><label class="block font-bold text-slate-700 mb-1">Mantención cada (km)</label><input v-model="formConf.frecuenciaKm" :disabled="!puedeEditar" type="number" min="1" class="w-full p-2 border rounded-lg font-mono"></div>
              <div><label class="block font-bold text-slate-700 mb-1">Aviso de documentos (días antes)</label><input v-model="formConf.diasAviso" :disabled="!puedeEditar" type="number" min="1" class="w-full p-2 border rounded-lg font-mono"><p class="text-[10px] text-slate-400 mt-0.5">Valor por defecto para documentos nuevos</p></div>
              <div class="sm:col-span-2 md:col-span-4"><label class="block font-bold text-slate-700 mb-1">Observación</label><input v-model="formConf.observacion" :disabled="!puedeEditar" type="text" class="w-full p-2 border rounded-lg"></div>
            </div>
            <p class="text-[11px] text-slate-500 mt-3"><i class="fa-solid fa-circle-info mr-1"></i>Tipo, marca, modelo, estado, ubicación y frecuencia del horómetro se editan en <button @click="abrirPerfilEquipoDeVeh(vehPerfil)" class="text-blue-600 underline font-bold">Perfil Equipo</button>.</p>
            <div v-if="puedeEditar" class="flex justify-end mt-3"><button @click="guardarConfVehiculo" :disabled="guardandoVeh" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg shadow disabled:opacity-60"><i class="fa-solid fa-floppy-disk mr-1"></i> Guardar datos</button></div>
          </div>
        </template>

        <!-- ---------- KILOMETRAJE Y HORÓMETRO ---------- -->
        <template v-if="tabPerfilVeh === 'km'">
          <div class="grid lg:grid-cols-2 gap-4">
            <div :class="['rounded-xl border p-4 space-y-3', kmCard(vehPerfil.km)]">
              <h4 class="font-bold uppercase flex justify-between"><span><i class="fa-solid fa-road text-blue-600 mr-1"></i> Kilometraje</span><span :class="['px-2 py-0.5 rounded text-[10px] font-bold', kmBadge(vehPerfil.km)]">{{ vehPerfil.km.estado }}</span></h4>
              <div class="grid grid-cols-3 gap-2 text-center">
                <div class="bg-white p-2 rounded border"><span class="text-[10px] text-slate-500 font-bold block">KM TOMADO</span><b class="font-mono">{{ fmtKm(vehPerfil.km.kmTomado) }}</b><span class="block text-[10px] text-slate-400">{{ formatDateForDisplay(vehPerfil.km.fTomado) }}</span></div>
                <div class="bg-white p-2 rounded border"><span class="text-[10px] text-slate-500 font-bold block">ÚLT. MANTENCIÓN</span><b class="font-mono">{{ vehPerfil.km.kmUlt ? fmtKm(vehPerfil.km.kmUlt) : '-' }}</b><span class="block text-[10px] text-slate-400">{{ formatDateForDisplay(vehPerfil.km.fUlt) }}</span></div>
                <div class="bg-white p-2 rounded border"><span class="text-[10px] text-slate-500 font-bold block">USO</span><b class="font-mono">{{ fmtNum(vehPerfil.km.rate) }} km/día</b><span class="block text-[10px] text-slate-400">{{ vehPerfil.km.metodo }}</span></div>
                <div class="bg-white p-2 rounded border"><span class="text-[10px] text-slate-500 font-bold block">APROX HOY</span><b class="font-mono text-blue-700">{{ fmtKm(vehPerfil.km.kmAprox) }}</b></div>
                <div class="bg-white p-2 rounded border"><span class="text-[10px] text-slate-500 font-bold block">META (+{{ fmtNum(vehPerfil.km.frecuencia) }})</span><b class="font-mono text-emerald-700">{{ fmtKm(vehPerfil.km.kmMeta) }}</b></div>
                <div class="bg-white p-2 rounded border"><span class="text-[10px] text-slate-500 font-bold block">{{ vehPerfil.km.faltan !== null && vehPerfil.km.faltan < 0 ? 'PASADO POR' : 'FALTAN' }}</span><b class="font-mono">{{ vehPerfil.km.faltan !== null ? fmtKm(Math.abs(vehPerfil.km.faltan)) : '-' }}</b><span class="block text-[10px] text-slate-400">aprox. {{ formatDateForDisplay(vehPerfil.km.fechaEstimada) }}</span></div>
              </div>
              <p v-if="vehPerfil.km.calc" class="text-[10px] text-slate-500 bg-white/70 rounded p-2">Cálculo: ({{ fmtNum(vehPerfil.km.calc.hasta) }} − {{ fmtNum(vehPerfil.km.calc.desde) }}) km / {{ vehPerfil.km.calc.dias }} días ({{ formatDateForDisplay(vehPerfil.km.calc.fDesde) }} → {{ formatDateForDisplay(vehPerfil.km.calc.fHasta) }}) = {{ fmtNum(vehPerfil.km.rate) }} km/día</p>
              <p v-else class="text-[10px] text-slate-500 bg-white/70 rounded p-2">Sin datos suficientes: se usa un uso por defecto de {{ fmtNum(vehPerfil.km.rate) }} km/día.</p>

              <div v-if="puedeEditar" class="bg-white rounded-lg border p-3 space-y-2">
                <p class="font-bold text-slate-700"><i class="fa-solid fa-plus-circle text-blue-600 mr-1"></i> Registrar kilometraje</p>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                  <div><label class="block text-[10px] font-bold text-slate-500">Fecha</label><input v-model="formKm.fecha" type="date" :max="hoy" class="w-full p-2 border rounded-lg"></div>
                  <div><label class="block text-[10px] font-bold text-slate-500">Kilometraje</label><input v-model="formKm.km" type="number" min="0" placeholder="Ej: 125400" class="w-full p-2 border rounded-lg font-mono font-bold"></div>
                  <div><label class="block text-[10px] font-bold text-slate-500">Tipo</label>
                    <select v-model="formKm.tipo" class="w-full p-2 border rounded-lg font-bold"><option value="LECTURA">Lectura</option><option value="MANTENCION">Mantención realizada</option></select></div>
                  <button @click="registrarKm" :disabled="guardandoVeh" class="bg-blue-600 hover:bg-blue-700 text-white font-bold p-2 rounded-lg shadow disabled:opacity-60"><i class="fa-solid fa-floppy-disk mr-1"></i> Guardar</button>
                </div>
                <input v-model="formKm.observacion" type="text" placeholder="Observación (opcional)" class="w-full p-2 border rounded-lg">
                <p class="text-[10px] text-slate-400">"Mantención realizada" fija el punto de partida de la siguiente meta (km de la mantención + {{ fmtNum(vehPerfil.km.frecuencia) }} km).</p>
              </div>
            </div>

            <div :class="['rounded-xl border p-4 space-y-3', getHorometroCardBgClass(vehPerfil.eq.horometros)]">
              <h4 class="font-bold uppercase flex justify-between"><span><i class="fa-solid fa-gauge-high text-amber-600 mr-1"></i> Horómetro</span><span :class="['px-2 py-0.5 rounded text-[10px] font-bold', getPrediccionStatusBadge(vehPerfil.eq.horometros)]">{{ vehPerfil.eq.horometros?.estadoTexto || 'OK' }}</span></h4>
              <div class="grid grid-cols-3 gap-2 text-center">
                <div class="bg-white p-2 rounded border"><span class="text-[10px] text-slate-500 font-bold block">H. TOMADO</span><b class="font-mono">{{ vehPerfil.eq.horometros?.hTomado || 0 }} h</b><span class="block text-[10px] text-slate-400">{{ formatDateForDisplay(vehPerfil.eq.horometros?.fechaUltimoHorometro) }}</span></div>
                <div class="bg-white p-2 rounded border"><span class="text-[10px] text-slate-500 font-bold block">ÚLT. MANTENCIÓN</span><b class="font-mono">{{ vehPerfil.eq.horometros?.hUltimaMant || 0 }} h</b><span class="block text-[10px] text-slate-400">{{ formatDateForDisplay(vehPerfil.eq.horometros?.ultimaMantFecha) }}</span></div>
                <div class="bg-white p-2 rounded border"><span class="text-[10px] text-slate-500 font-bold block">USO</span><b class="font-mono">{{ vehPerfil.eq.horometros?.rateHrsDia ? vehPerfil.eq.horometros.rateHrsDia.toFixed(2) : '-' }} h/día</b><span class="block text-[10px] text-slate-400">{{ vehPerfil.eq.horometros?.metodoCalculo }}</span></div>
                <div class="bg-white p-2 rounded border"><span class="text-[10px] text-slate-500 font-bold block">APROX HOY</span><b class="font-mono text-blue-700">{{ vehPerfil.eq.horometros?.hAprox || 0 }} h</b></div>
                <div class="bg-white p-2 rounded border"><span class="text-[10px] text-slate-500 font-bold block">META (+{{ vehPerfil.eq.frecuenciaMantencion }})</span><b class="font-mono text-emerald-700">{{ vehPerfil.eq.horometros?.hTarget || 0 }} h</b></div>
                <div class="bg-white p-2 rounded border"><span class="text-[10px] text-slate-500 font-bold block">FALTAN</span><b class="font-mono">{{ vehPerfil.eq.horometros?.horasFaltantes ?? '-' }} h</b><span class="block text-[10px] text-slate-400">aprox. {{ formatDateForDisplay(vehPerfil.eq.horometros?.fechaEstimada) }}</span></div>
              </div>
              <p class="text-[10px] text-slate-500 bg-white/70 rounded p-2">La mantención por horómetro se cuenta desde el Historial (botón "Agregar Mantención"), igual que en los equipos.</p>
              <div v-if="puedeEditar" class="bg-white rounded-lg border p-3 space-y-2">
                <p class="font-bold text-slate-700"><i class="fa-solid fa-pen text-amber-600 mr-1"></i> Actualizar horómetro tomado</p>
                <div class="grid grid-cols-3 gap-2 items-end">
                  <div><label class="block text-[10px] font-bold text-slate-500">Horómetro (h)</label><input v-model="formHoro.h" type="number" min="0" step="0.1" class="w-full p-2 border rounded-lg font-mono font-bold"></div>
                  <div><label class="block text-[10px] font-bold text-slate-500">Fecha</label><input v-model="formHoro.fecha" type="date" :max="hoy" class="w-full p-2 border rounded-lg"></div>
                  <button @click="actualizarHorometroVeh" :disabled="guardandoVeh" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold p-2 rounded-lg shadow disabled:opacity-60">Actualizar</button>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl border shadow-sm overflow-hidden">
            <h4 class="font-bold uppercase px-4 py-3 border-b"><i class="fa-solid fa-list text-slate-500 mr-1"></i> Historial de kilometraje ({{ vehPerfil.lecturas.length }})</h4>
            <div class="overflow-x-auto max-h-80">
              <table class="w-full text-left">
                <thead class="bg-slate-100 text-slate-600 sticky top-0"><tr><th class="p-2">Fecha</th><th class="p-2 text-right">Kilometraje</th><th class="p-2 text-right">Recorrido desde anterior</th><th class="p-2">Tipo</th><th class="p-2">Observación</th><th class="p-2">Registró</th><th v-if="isAdmin" class="p-2"></th></tr></thead>
                <tbody>
                  <tr v-for="(l, i) in lecturasOrdenadas" :key="l.id" :class="['border-t', l.tipo === 'MANTENCION' ? 'bg-emerald-50' : '']">
                    <td class="p-2 font-mono">{{ formatDateForDisplay(l.fecha) }}</td>
                    <td class="p-2 text-right font-mono font-bold">{{ fmtKm(l.km) }}</td>
                    <td class="p-2 text-right font-mono text-slate-500">{{ lecturasOrdenadas[i + 1] ? fmtKm(l.km - lecturasOrdenadas[i + 1].km) : '-' }}</td>
                    <td class="p-2"><span :class="['px-2 py-0.5 rounded text-[10px] font-bold', l.tipo === 'MANTENCION' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700']">{{ l.tipo === 'MANTENCION' ? 'MANTENCIÓN' : 'LECTURA' }}</span></td>
                    <td class="p-2">{{ l.observacion }}</td>
                    <td class="p-2 text-slate-500">{{ l.creadoPor }}</td>
                    <td v-if="isAdmin" class="p-2 text-right"><button @click="eliminarLecturaKm(l)" class="text-rose-500 hover:text-rose-700" title="Eliminar"><i class="fa-solid fa-trash"></i></button></td>
                  </tr>
                  <tr v-if="!vehPerfil.lecturas.length"><td colspan="7" class="p-6 text-center text-slate-400">Sin lecturas de kilometraje.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>

        <!-- ---------- DOCUMENTOS ---------- -->
        <template v-if="tabPerfilVeh === 'documentos'">
          <div>
            <h4 class="font-extrabold text-slate-800 uppercase mb-3"><i class="fa-solid fa-star text-amber-500 mr-1"></i> Documentos principales</h4>
            <div class="grid md:grid-cols-3 gap-4">
              <div v-for="p in vehPerfil.principales" :key="p.def.key" :class="['rounded-xl border-2 p-4 space-y-2 flex flex-col', p.est.card]">
                <div class="flex items-center justify-between">
                  <span class="font-extrabold text-sm text-slate-800"><i :class="['fa-solid mr-1', p.def.icon]"></i> {{ p.def.label }}</span>
                  <span :class="['px-2 py-0.5 rounded text-[10px] font-bold', p.est.badge]">{{ p.est.label }}</span>
                </div>
                <template v-if="p.doc">
                  <p :class="['text-lg font-extrabold', p.est.key === 'VENCIDO' ? 'text-rose-700' : p.est.key === 'POR_VENCER' ? 'text-amber-700' : 'text-emerald-700']">{{ p.est.texto }}</p>
                  <div class="grid grid-cols-2 gap-1 text-[11px]">
                    <span class="text-slate-500">Emisión</span><b class="font-mono">{{ formatDateForDisplay(p.doc.fechaEmision) }}</b>
                    <span class="text-slate-500">Duración</span><b>{{ textoDuracion(p.doc) }}</b>
                    <span class="text-slate-500">Vence</span><b class="font-mono">{{ formatDateForDisplay(p.doc.fechaVencimiento) }}</b>
                    <span class="text-slate-500">Avisa</span><b>{{ p.doc.diasAviso }} días antes</b>
                    <template v-if="p.doc.numero"><span class="text-slate-500">N° / Folio</span><b>{{ p.doc.numero }}</b></template>
                  </div>
                  <p v-if="p.doc.observacion" class="text-[11px] text-slate-600 italic">{{ p.doc.observacion }}</p>
                </template>
                <p v-else class="text-slate-500 italic flex-1">No hay documento cargado. Duración habitual: {{ p.def.duracionMeses }} meses.</p>
                <div class="flex flex-wrap gap-1.5 pt-2 mt-auto border-t border-black/5">
                  <a v-if="p.doc?.link" :href="p.doc.link" target="_blank" rel="noopener" class="bg-slate-800 hover:bg-slate-900 text-white font-bold px-2.5 py-1.5 rounded-lg"><i class="fa-solid fa-eye mr-1"></i> Ver</a>
                  <button v-if="puedeEditar" @click="abrirNuevoDoc(vehPerfil, 'PRINCIPAL', p.def.key)" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-2.5 py-1.5 rounded-lg"><i :class="['fa-solid mr-1', p.doc ? 'fa-rotate' : 'fa-upload']"></i> {{ p.doc ? 'Renovar' : 'Subir' }}</button>
                  <button v-if="puedeEditar && p.doc" @click="abrirEditarDoc(p.doc)" class="bg-white border hover:bg-slate-100 font-bold px-2.5 py-1.5 rounded-lg" title="Corregir datos"><i class="fa-solid fa-pen"></i></button>
                  <button v-if="p.hist.length > 1" @click="docsHistAbierto = docsHistAbierto === p.def.key ? '' : p.def.key" class="ml-auto text-blue-600 underline font-bold">Historial ({{ p.hist.length - 1 }})</button>
                </div>
                <div v-if="docsHistAbierto === p.def.key" class="bg-white/80 rounded-lg border divide-y">
                  <div v-for="h in p.hist.slice(1)" :key="h.id" class="px-2 py-1.5 flex items-center gap-2 text-[11px]">
                    <span class="font-mono">{{ formatDateForDisplay(h.fechaEmision) }} → {{ formatDateForDisplay(h.fechaVencimiento) }}</span>
                    <a v-if="h.link" :href="h.link" target="_blank" rel="noopener" class="text-blue-600 underline">ver</a>
                    <button v-if="isAdmin" @click="eliminarDoc(h)" class="ml-auto text-rose-500 hover:text-rose-700" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div class="px-4 py-3 border-b flex items-center justify-between">
              <h4 class="font-extrabold text-slate-800 uppercase"><i class="fa-solid fa-folder text-slate-500 mr-1"></i> Documentos secundarios ({{ vehPerfil.secundarios.length }})</h4>
              <button v-if="puedeEditar" @click="abrirNuevoDoc(vehPerfil, 'SECUNDARIO')" class="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg"><i class="fa-solid fa-plus mr-1"></i> Agregar documento</button>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead class="bg-slate-100 text-slate-600"><tr><th class="p-2">Documento</th><th class="p-2">N° / Folio</th><th class="p-2">Emisión</th><th class="p-2">Duración</th><th class="p-2">Vence</th><th class="p-2">Tiempo restante</th><th class="p-2">Estado</th><th class="p-2"></th></tr></thead>
                <tbody>
                  <template v-for="s in vehPerfil.secundarios" :key="s.nombre">
                    <tr :class="['border-t', s.est.key === 'VENCIDO' ? 'bg-rose-50' : s.est.key === 'POR_VENCER' ? 'bg-amber-50' : '']">
                      <td class="p-2 font-bold">{{ s.nombre }}</td>
                      <td class="p-2">{{ s.doc.numero || '-' }}</td>
                      <td class="p-2 font-mono">{{ formatDateForDisplay(s.doc.fechaEmision) }}</td>
                      <td class="p-2">{{ textoDuracion(s.doc) }}</td>
                      <td class="p-2 font-mono">{{ formatDateForDisplay(s.doc.fechaVencimiento) }}</td>
                      <td :class="['p-2 font-semibold', s.est.key === 'VENCIDO' ? 'text-rose-700' : s.est.key === 'POR_VENCER' ? 'text-amber-700' : '']">{{ s.est.texto }}</td>
                      <td class="p-2"><span :class="['px-2 py-0.5 rounded text-[10px] font-bold', s.est.badge]">{{ s.est.label }}</span></td>
                      <td class="p-2 text-right whitespace-nowrap space-x-2">
                        <a v-if="s.doc.link" :href="s.doc.link" target="_blank" rel="noopener" class="text-slate-700 hover:text-slate-900" title="Ver archivo"><i class="fa-solid fa-eye"></i></a>
                        <button v-if="puedeEditar" @click="abrirNuevoDoc(vehPerfil, 'SECUNDARIO', '', s.nombre)" class="text-amber-600 hover:text-amber-800" title="Renovar"><i class="fa-solid fa-rotate"></i></button>
                        <button v-if="puedeEditar" @click="abrirEditarDoc(s.doc)" class="text-blue-600 hover:text-blue-800" title="Corregir"><i class="fa-solid fa-pen"></i></button>
                        <button v-if="s.hist.length > 1" @click="docsHistAbierto = docsHistAbierto === s.nombre ? '' : s.nombre" class="text-slate-500 underline" title="Versiones anteriores">{{ s.hist.length - 1 }} ant.</button>
                        <button v-if="isAdmin" @click="eliminarDoc(s.doc)" class="text-rose-500 hover:text-rose-700" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                      </td>
                    </tr>
                    <template v-if="docsHistAbierto === s.nombre">
                    <tr v-for="h in s.hist.slice(1)" :key="'h' + h.id" class="bg-slate-50 text-slate-500">
                      <td class="p-2 pl-6 italic" colspan="2">versión anterior</td>
                      <td class="p-2 font-mono">{{ formatDateForDisplay(h.fechaEmision) }}</td>
                      <td class="p-2">{{ textoDuracion(h) }}</td>
                      <td class="p-2 font-mono">{{ formatDateForDisplay(h.fechaVencimiento) }}</td>
                      <td class="p-2" colspan="2"><a v-if="h.link" :href="h.link" target="_blank" rel="noopener" class="text-blue-600 underline">ver archivo</a></td>
                      <td class="p-2 text-right"><button v-if="isAdmin" @click="eliminarDoc(h)" class="text-rose-500 hover:text-rose-700"><i class="fa-solid fa-trash"></i></button></td>
                    </tr>
                    </template>
                  </template>
                  <tr v-if="!vehPerfil.secundarios.length"><td colspan="8" class="p-6 text-center text-slate-400">Sin documentos secundarios.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>

  <!-- ===================== FORMULARIO DOCUMENTO ===================== -->
  <div v-if="showDocForm" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl border w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh]">
      <div class="bg-amber-500 px-6 py-4 flex justify-between items-center text-slate-950">
        <h3 class="font-extrabold uppercase tracking-wide"><i class="fa-solid fa-file-circle-plus mr-1"></i> {{ formDoc.id ? 'Corregir' : 'Cargar' }} documento · {{ formDoc.patente }}</h3>
        <button @click="showDocForm = false"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="p-6 space-y-3 bg-slate-50 overflow-y-auto">
        <div>
          <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Documento {{ formDoc.categoria === 'PRINCIPAL' ? '(principal)' : '(secundario)' }}</label>
          <input v-if="formDoc.categoria === 'PRINCIPAL'" :value="formDoc.nombre" disabled class="w-full p-2.5 border rounded-lg bg-slate-100 font-bold">
          <template v-else>
            <input v-model="formDoc.nombre" list="veh-docs-sugeridos" type="text" placeholder="Ej: Revisión de gases" class="w-full p-2.5 border rounded-lg bg-white font-bold">
            <datalist id="veh-docs-sugeridos"><option v-for="n in DOCS_SECUNDARIOS_SUGERIDOS" :key="n" :value="n"></option></datalist>
          </template>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Fecha de emisión</label><input v-model="formDoc.fechaEmision" @change="recalcularVencDoc" type="date" class="w-full p-2.5 border rounded-lg bg-white"></div>
          <div><label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">N° / Folio (opcional)</label><input v-model="formDoc.numero" type="text" class="w-full p-2.5 border rounded-lg bg-white"></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Duración</label>
            <div class="flex gap-1">
              <input v-model="formDoc.duracion" @input="recalcularVencDoc" type="number" min="0" class="w-20 p-2.5 border rounded-lg bg-white font-bold">
              <select v-model="formDoc.unidad" @change="recalcularVencDoc" class="flex-1 p-2.5 border rounded-lg bg-white font-bold"><option v-for="u in UNIDADES_DURACION" :key="u.key" :value="u.key">{{ u.label }}</option></select>
            </div>
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Vencimiento</label>
            <input v-model="formDoc.fechaVencimiento" @input="vencimientoManual" type="date" :class="['w-full p-2.5 border rounded-lg font-bold', formDoc.vencManual ? 'bg-amber-50 border-amber-300' : 'bg-white']">
            <p class="text-[10px] mt-0.5" v-if="formDoc.vencManual">Escrito a mano · <button @click="usarVencimientoCalculado" class="text-blue-600 underline">usar emisión + duración</button></p>
            <p class="text-[10px] mt-0.5 text-slate-400" v-else>= emisión + duración</p>
          </div>
        </div>
        <div><label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Avisar cuántos días antes</label><input v-model="formDoc.diasAviso" type="number" min="1" class="w-32 p-2.5 border rounded-lg bg-white font-bold"></div>
        <div>
          <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Archivo {{ formDoc.link ? '(reemplazar, opcional)' : '' }}</label>
          <input type="file" @change="elegirArchivoDoc" accept=".pdf,image/*" class="w-full p-1.5 border rounded-lg bg-white">
          <p v-if="formDoc.link && !archivoDoc" class="text-[10px] mt-0.5">Actual: <a :href="formDoc.link" target="_blank" rel="noopener" class="text-blue-600 underline">{{ formDoc.nombreArchivo || 'ver archivo' }}</a></p>
        </div>
        <div><label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Observación</label><input v-model="formDoc.observacion" type="text" class="w-full p-2.5 border rounded-lg bg-white"></div>
        <p v-if="formDoc.fechaVencimiento" class="bg-white border rounded-lg p-2 text-center font-semibold">{{ textoRestante(diasHasta(formDoc.fechaVencimiento)) }}</p>
        <p v-if="!formDoc.id && formDoc.categoria === 'PRINCIPAL'" class="text-[10px] text-slate-500"><i class="fa-solid fa-circle-info mr-1"></i>Al renovar, el documento anterior queda en el historial.</p>
      </div>
      <div class="px-6 py-3 border-t flex justify-end gap-2 bg-white">
        <button @click="showDocForm = false" class="px-4 py-2 rounded-lg border font-bold">Cancelar</button>
        <button @click="guardarDoc" :disabled="guardandoVeh" class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow disabled:opacity-60"><i :class="['fa-solid mr-1', guardandoVeh ? 'fa-spinner fa-spin' : 'fa-floppy-disk']"></i> Guardar</button>
      </div>
    </div>
  </div>

  <!-- ===================== NUEVO VEHÍCULO ===================== -->
  <div v-if="showNuevoVeh" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl border w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh]">
      <div class="bg-amber-500 px-6 py-4 flex justify-between items-center text-slate-950">
        <h3 class="font-extrabold uppercase tracking-wide"><i class="fa-solid fa-car-side mr-1"></i> Agregar vehículo</h3>
        <button @click="showNuevoVeh = false"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="p-6 space-y-3 bg-slate-50 overflow-y-auto">
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Patente * (XXXX-XX)</label><input v-model="formNuevoVeh.patente" @blur="formatearPatenteNueva" type="text" placeholder="RTZK-45" maxlength="8" class="w-full p-2.5 border-2 border-slate-800 rounded-lg bg-white font-mono font-extrabold tracking-widest uppercase"></div>
          <div><label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">N° AFI del vehículo</label><input v-model="formNuevoVeh.numeroAfi" type="text" placeholder="Ej: 615" class="w-full p-2.5 border rounded-lg bg-white font-bold text-amber-800"></div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div><label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Tipo *</label><input v-model="formNuevoVeh.tipo" list="veh-tipos" type="text" class="w-full p-2.5 border rounded-lg bg-white"><datalist id="veh-tipos"><option>CAMIONETA</option><option>CAMIÓN</option><option>CAMIÓN PLUMA</option><option>FURGÓN</option><option>AUTOMÓVIL</option><option>RAMPLA</option></datalist></div>
          <div><label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Marca</label><input v-model="formNuevoVeh.marca" type="text" class="w-full p-2.5 border rounded-lg bg-white"></div>
          <div><label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Modelo</label><input v-model="formNuevoVeh.modelo" type="text" class="w-full p-2.5 border rounded-lg bg-white"></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Ubicación</label><input v-model="formNuevoVeh.ubicacion" type="text" class="w-full p-2.5 border rounded-lg bg-white"></div>
          <div><label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Estado</label>
            <select v-model="formNuevoVeh.disponibilidad" class="w-full p-2.5 border rounded-lg bg-white font-bold"><option>Operativo</option><option>Disponible</option><option>En Traslado</option><option>En Mantencion</option><option>Fuera de Servicio</option></select></div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div><label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Kilometraje actual</label><input v-model="formNuevoVeh.km" type="number" min="0" class="w-full p-2.5 border rounded-lg bg-white font-mono"></div>
          <div><label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Horómetro actual</label><input v-model="formNuevoVeh.horometro" type="number" min="0" class="w-full p-2.5 border rounded-lg bg-white font-mono"></div>
          <div><label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Fecha lectura</label><input v-model="formNuevoVeh.fechaKm" type="date" :max="hoy" class="w-full p-2.5 border rounded-lg bg-white"></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Mantención cada (km)</label><input v-model="formNuevoVeh.frecuenciaKm" type="number" min="1" class="w-full p-2.5 border rounded-lg bg-white font-mono"></div>
          <div><label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Mantención cada (horas)</label><input v-model="formNuevoVeh.frecuenciaHoras" type="number" min="1" class="w-full p-2.5 border rounded-lg bg-white font-mono"></div>
        </div>
        <p class="text-[10px] text-slate-500"><i class="fa-solid fa-circle-info mr-1"></i>Se crea en el inventario con la patente como AFI (así aparece en Movimientos, Historial, Programas y OT). Los documentos se cargan después en su perfil.</p>
      </div>
      <div class="px-6 py-3 border-t flex justify-end gap-2 bg-white">
        <button @click="showNuevoVeh = false" class="px-4 py-2 rounded-lg border font-bold">Cancelar</button>
        <button @click="guardarNuevoVehiculo" :disabled="guardandoVeh" class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow disabled:opacity-60"><i :class="['fa-solid mr-1', guardandoVeh ? 'fa-spinner fa-spin' : 'fa-floppy-disk']"></i> Crear vehículo</button>
      </div>
    </div>
  </div>
</section>
`;
