// Plantilla HTML del componente 'inventario' (extraída del index original)
export default /* html */ `
<section class="space-y-4">
  <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-filter text-amber-500"></i> Filtros de Inventario General</h2>
        <button v-if="isAdmin" @click="abrirModalCrearEquipo" class="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold px-3 py-1.5 rounded-lg transition shadow flex items-center gap-1.5 ml-3">
          <i class="fa-solid fa-plus-circle"></i> + Agregar Equipo
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button @click="toggleFiltroCriticos" :class="['text-xs font-extrabold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 shadow', filterInv.mostrarCriticos ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-100 text-rose-600 border border-rose-200 hover:bg-rose-50']">
          <i class="fa-solid fa-triangle-exclamation"></i> {{ filterInv.mostrarCriticos ? 'Viendo Críticos' : 'Ver Equipos Críticos / Pasados' }}
        </button>
        <label class="text-xs font-bold text-slate-700 ml-2">Orden:</label>
        <select v-model="sortInventarioOrder" class="p-1.5 border rounded text-xs font-bold bg-slate-50">
          <option value="desc">Descendente</option>
          <option value="asc">Ascendente</option>
        </select>
        <button @click="resetFiltrosInventario" class="text-xs text-slate-500 hover:text-slate-800 underline mx-2">Limpiar</button>
        <button @click="exportarInventarioCSV" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow"><i class="fa-solid fa-file-excel"></i> Exportar Excel</button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
      <div><label class="block font-bold text-slate-700 mb-1">Buscar (AFI / Tipo / Marca)</label><input type="text" v-model="filterInv.search" placeholder="Ej: Generador..." class="w-full p-2 border border-slate-300 rounded-lg"></div>
      <div><label class="block font-bold text-slate-700 mb-1">Ubicación</label><input type="text" v-model="filterInv.ubicacion" placeholder="Ej: Tierras Blancas" class="w-full p-2 border border-slate-300 rounded-lg"></div>
      <div>
        <label class="block font-bold text-slate-700 mb-1">Estado</label>
        <select v-model="filterInv.estado" class="w-full p-2 border border-slate-300 rounded-lg font-semibold">
          <option value="ALL">-- Todos --</option>
          <option value="Operativo">Trabajando / Operativo</option>
          <option value="Disponible">Disponible</option>
          <option value="En Traslado">En Traslado</option>
          <option value="En Mantencion">En Mantención</option>
          <option value="Fuera de Servicio">Fuera de Servicio</option>
          <option value="Venta">En Venta</option>
        </select>
      </div>
      <div>
        <label class="block font-bold text-slate-700 mb-1">GPS</label>
        <select v-model="filterInv.gps" class="w-full p-2 border border-slate-300 rounded-lg">
          <option value="ALL">-- Todos --</option>
          <option value="Instalado">Instalado</option>
          <option value="Sin GPS">Sin GPS</option>
        </select>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <div v-for="e in filteredEquipos" :key="e.id" class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
      <div>
        <div class="relative h-44 bg-slate-900 group">
          <img :src="e.foto || placeholderImg(e.afi)" class="w-full h-full object-cover">
          <span :class="['absolute top-2 right-2 px-2.5 py-1 rounded-md text-[10px] font-bold shadow-md', getBadgeClass(e.disponibilidad)]">{{ getEstadoText(e.disponibilidad) }}</span>
          <label v-if="isAdmin" class="absolute bottom-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white p-1.5 rounded-lg text-xs cursor-pointer shadow flex items-center gap-1">
            <i class="fa-solid fa-camera"></i> <span>Subir Foto</span>
            <input type="file" @change="uploadFotoEquipo($event, e)" accept="image/*" class="hidden">
          </label>
        </div>
        <div class="p-4 space-y-3">
          <div>
            <span class="text-xs font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">AFI: {{ e.afi }}</span>
            <h3 class="font-bold text-sm text-slate-800 mt-1">{{ e.tipo }}</h3>
          </div>
          <div class="text-xs space-y-1 text-slate-600">
            <p><i class="fa-solid fa-industry w-4 text-slate-400"></i> <strong>Marca/Modelo:</strong> {{ e.marca }} {{ e.modelo }}</p>
            <p><i class="fa-solid fa-location-dot w-4 text-rose-500"></i> <strong>Ubicación:</strong> <span class="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{{ e.ubicacion }}</span></p>
          </div>

          <div :class="['rounded-xl p-3 space-y-2 text-xs border', getHorometroCardBgClass(e.horometros)]">
            <div class="flex justify-between items-center text-[10px] text-slate-500 font-bold border-b pb-1">
              <span class="text-amber-700"><i class="fa-solid fa-stopwatch"></i> FRECUENCIA: {{ e.frecuenciaMantencion }}h</span>
              <span class="text-blue-700"><i class="fa-solid fa-chart-line"></i> USO: {{ e.horometros?.rateHrsDia > 0 ? e.horometros.rateHrsDia.toFixed(2) + ' hrs/día' : 'Sin datos' }}</span>
            </div>
            <div class="flex justify-between items-center font-bold">
              <span><i class="fa-solid fa-gauge-high text-amber-600"></i> Estado Horómetro:</span>
              <span :class="['px-2 py-0.5 rounded text-[10px] font-bold uppercase', getPrediccionStatusBadge(e.horometros)]">{{ e.horometros?.estadoTexto || 'OK' }}</span>
            </div>
            <div class="grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <div class="bg-white/80 p-1.5 rounded border">
                <span class="text-slate-500 font-bold block" title="Último horómetro tomado">H. TOMADO</span>
                <strong class="font-mono text-slate-800">{{ e.horometros?.hTomado || 0 }}h</strong>
              </div>
              <div class="bg-white/80 p-1.5 rounded border">
                <span class="text-slate-500 font-bold block" title="Horómetro actual aproximado">APROX HOY</span>
                <strong class="font-mono text-blue-700">{{ e.horometros?.hAprox || 0 }}h</strong>
              </div>
              <div class="bg-white/80 p-1.5 rounded border">
                <span class="text-slate-500 font-bold block" title="Meta o próxima mantención">META / TGT</span>
                <strong class="font-mono text-emerald-700">{{ e.horometros?.hTarget || 0 }}h</strong>
              </div>
            </div>
            <div class="text-[11px] font-medium text-slate-700 pt-1 text-center bg-white/60 p-1 rounded">
              <i class="fa-solid fa-calendar-days text-amber-600 mr-1"></i> F. aprox. mantención: <strong>{{ formatDateForDisplay(e.horometros?.fechaEstimada) }}</strong>
            </div>
          </div>
        </div>
      </div>
      <div class="p-3 bg-slate-50 border-t flex items-center justify-between gap-2">
        <button @click="abrirPerfilEquipo(e)" class="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-sm transition w-full justify-center">
          <i class="fa-solid fa-id-card text-blue-300"></i> Perfil Equipo
        </button>
      </div>
    </div>
    <div v-if="filteredEquipos.length === 0" class="col-span-3 text-center p-10 text-slate-500 font-bold">No se encontraron equipos con los filtros actuales.</div>
  </div>
</section>
`;
