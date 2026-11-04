// Plantilla HTML del módulo ÁREAS (Empresa → Área → Sector → Locación → Equipos)
export default /* html */ `
<section class="space-y-4">
  <!-- Encabezado + resumen -->
  <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
    <div class="flex flex-wrap justify-between items-center gap-3">
      <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-sitemap text-amber-500"></i> Áreas y Locaciones de Equipos
        <span class="text-[11px] font-semibold text-slate-500">Empresa › Área › Sector › Locación › AFI</span></h2>
      <div class="flex flex-wrap items-center gap-2">
        <button v-if="puedeEditar" @click="abrirCrearNodo('EMPRESA', null)" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow flex items-center gap-1.5"><i class="fa-solid fa-building"></i> Nueva Empresa</button>
        <button @click="vistaMapa = !vistaMapa" :class="['text-xs font-bold px-3 py-2 rounded-lg shadow flex items-center gap-1.5', vistaMapa ? 'bg-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-50']">
          <i :class="['fa-solid', vistaMapa ? 'fa-folder-tree' : 'fa-map-location-dot']"></i> {{ vistaMapa ? 'Ver carpetas' : 'Ver mapa de equipos' }}</button>
        <button @click="exportarAreasExcel" :disabled="exportandoAreas" class="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold px-3 py-2 rounded-lg shadow flex items-center gap-1.5">
          <i :class="['fa-solid', exportandoAreas ? 'fa-spinner fa-spin' : 'fa-file-excel']"></i> Exportar Excel</button>
      </div>
    </div>
    <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
      <div class="bg-blue-50 border border-blue-100 rounded-lg p-2"><p class="text-lg font-extrabold text-blue-800">{{ resumenAreas.empresas }}</p><p class="font-bold text-blue-700 uppercase text-[10px]">Empresas</p></div>
      <div class="bg-amber-50 border border-amber-100 rounded-lg p-2"><p class="text-lg font-extrabold text-amber-800">{{ resumenAreas.areas }}</p><p class="font-bold text-amber-700 uppercase text-[10px]">Áreas</p></div>
      <div class="bg-violet-50 border border-violet-100 rounded-lg p-2"><p class="text-lg font-extrabold text-violet-800">{{ resumenAreas.sectores }}</p><p class="font-bold text-violet-700 uppercase text-[10px]">Sectores</p></div>
      <div class="bg-emerald-50 border border-emerald-100 rounded-lg p-2"><p class="text-lg font-extrabold text-emerald-800">{{ resumenAreas.locaciones }}</p><p class="font-bold text-emerald-700 uppercase text-[10px]">Locaciones</p></div>
      <div class="bg-slate-50 border rounded-lg p-2"><p class="text-lg font-extrabold text-slate-800">{{ resumenAreas.conLocacion }}</p><p class="font-bold text-slate-600 uppercase text-[10px]">Equipos ubicados</p></div>
      <button @click="abrirNodo('SIN')" :class="['rounded-lg p-2 border', resumenAreas.sinLocacion ? 'bg-rose-50 border-rose-200 hover:bg-rose-100' : 'bg-slate-50']">
        <p :class="['text-lg font-extrabold', resumenAreas.sinLocacion ? 'text-rose-700' : 'text-slate-500']">{{ resumenAreas.sinLocacion }}</p><p class="font-bold text-rose-700 uppercase text-[10px]">Sin locación</p></button>
    </div>
    <div class="relative">
      <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
      <input v-model="busquedaAreas" placeholder="Buscar AFI, equipo, empresa, área, sector o locación…" class="w-full pl-8 p-2 border rounded-lg bg-slate-50 text-xs font-semibold">
    </div>
  </div>

  <!-- Resultados de búsqueda -->
  <div v-if="resultadosBusqueda" class="bg-white p-5 rounded-xl shadow-sm border border-amber-200 space-y-3 text-xs">
    <div class="flex justify-between items-center"><h3 class="font-bold text-slate-800 uppercase"><i class="fa-solid fa-magnifying-glass text-amber-500 mr-1"></i> Resultados</h3>
      <button @click="busquedaAreas = ''" class="text-slate-500 underline">Limpiar</button></div>
    <div v-if="resultadosBusqueda.nodos.length" class="flex flex-wrap gap-2">
      <button v-for="n in resultadosBusqueda.nodos" :key="'n'+n.id" @click="abrirNodo(n.id); busquedaAreas = ''" class="px-2.5 py-1.5 rounded-lg border bg-slate-50 hover:bg-amber-50 font-semibold">
        <i :class="['fa-solid mr-1', ICONO[n.tipo], colorTipo(n.tipo)]"></i>{{ rutaNodo(n) }}</button>
    </div>
    <table v-if="resultadosBusqueda.equipos.length" class="w-full text-left">
      <thead class="bg-slate-100 uppercase text-[10px] text-slate-600"><tr><th class="p-2">AFI</th><th class="p-2">Equipo</th><th class="p-2">Locación</th><th class="p-2"></th></tr></thead>
      <tbody class="divide-y">
        <tr v-for="e in resultadosBusqueda.equipos" :key="'e'+e.id" class="hover:bg-slate-50">
          <td class="p-2 font-bold text-amber-700 cursor-pointer hover:underline" @click="abrirPerfilEquipo(e)">{{ e.afi }}</td>
          <td class="p-2">{{ e.tipo }} <span class="text-slate-500">{{ e.marca }} {{ e.modelo }}</span></td>
          <td class="p-2">
            <button v-if="rutaTexto(e.locacionId)" @click="abrirNodo(e.locacionId); busquedaAreas = ''" class="font-bold text-emerald-700 hover:underline">{{ rutaTexto(e.locacionId) }}</button>
            <span v-else class="text-rose-600 font-semibold">Sin locación <span class="text-slate-400 font-normal">{{ e.ubicacion ? '(' + e.ubicacion + ')' : '' }}</span></span>
          </td>
          <td class="p-2 text-right"><button v-if="puedeEditar" @click="abrirAsignacionRapida(e)" class="px-2 py-1 rounded bg-amber-100 text-amber-800 font-bold"><i class="fa-solid fa-location-arrow"></i> Cambiar</button></td>
        </tr>
      </tbody>
    </table>
    <p v-if="!resultadosBusqueda.nodos.length && !resultadosBusqueda.equipos.length" class="text-slate-400 text-center p-3">Sin resultados.</p>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
    <!-- Árbol lateral -->
    <aside class="bg-white p-3 rounded-xl shadow-sm border border-slate-200 text-xs lg:max-h-[75vh] overflow-y-auto">
      <button @click="abrirNodo(null)" :class="['w-full text-left px-2 py-1.5 rounded font-extrabold uppercase text-[11px]', nodoAbierto === null ? 'bg-slate-800 text-white' : 'hover:bg-slate-100 text-slate-700']">
        <i class="fa-solid fa-city mr-1"></i> Todas las empresas</button>
      <div v-for="emp in empresas" :key="emp.id" class="mt-1">
        <div :class="['flex items-center rounded', esAbierto(emp) ? 'bg-blue-600 text-white' : 'hover:bg-blue-50']">
          <button @click="expandidos[emp.id] = !expandidos[emp.id]" class="w-6 h-6 shrink-0"><i :class="['fa-solid text-[9px]', expandidos[emp.id] ? 'fa-chevron-down' : 'fa-chevron-right']"></i></button>
          <button @click="abrirNodo(emp.id)" class="flex-1 text-left py-1 font-bold truncate"><i class="fa-solid fa-building mr-1 opacity-70"></i>{{ emp.nombre }}</button>
          <span class="text-[10px] px-1.5 opacity-70">{{ conteoEquipos(emp.id) }}</span>
        </div>
        <div v-show="expandidos[emp.id]" class="ml-4 border-l pl-1">
          <div v-for="ar in hijos(emp.id)" :key="ar.id">
            <div :class="['flex items-center rounded', esAbierto(ar) ? 'bg-amber-500 text-slate-950' : 'hover:bg-amber-50']">
              <button @click="expandidos[ar.id] = !expandidos[ar.id]" class="w-6 h-6 shrink-0"><i :class="['fa-solid text-[9px]', expandidos[ar.id] ? 'fa-chevron-down' : 'fa-chevron-right']"></i></button>
              <button @click="abrirNodo(ar.id)" class="flex-1 text-left py-1 font-semibold truncate"><i :class="['fa-solid mr-1 text-amber-500', expandidos[ar.id] ? 'fa-folder-open' : 'fa-folder']"></i>{{ ar.nombre }}</button>
              <span class="text-[10px] px-1.5 opacity-70">{{ conteoEquipos(ar.id) }}</span>
            </div>
            <div v-show="expandidos[ar.id]" class="ml-5 border-l pl-1">
              <div v-for="se in hijos(ar.id)" :key="se.id">
                <div :class="['flex items-center rounded', esAbierto(se) ? 'bg-violet-600 text-white' : 'hover:bg-violet-50']">
                  <button @click="expandidos[se.id] = !expandidos[se.id]" class="w-5 h-6 shrink-0"><i :class="['fa-solid text-[9px]', expandidos[se.id] ? 'fa-chevron-down' : 'fa-chevron-right']"></i></button>
                  <button @click="abrirNodo(se.id)" class="flex-1 text-left py-1 truncate"><i class="fa-solid fa-layer-group mr-1 text-violet-500"></i>{{ se.nombre }}</button>
                  <span class="text-[10px] px-1.5 opacity-70">{{ conteoEquipos(se.id) }}</span>
                </div>
                <div v-show="expandidos[se.id]" class="ml-4 border-l pl-1">
                  <button v-for="lo in hijos(se.id)" :key="lo.id" @click="abrirNodo(lo.id)"
                    :class="['w-full flex items-center text-left px-1.5 py-1 rounded', esAbierto(lo) ? 'bg-emerald-600 text-white font-bold' : 'hover:bg-emerald-50']">
                    <i class="fa-solid fa-location-dot mr-1.5 text-[10px]"></i><span class="flex-1 truncate">{{ lo.nombre }}</span><span class="text-[10px] opacity-70">{{ equiposDeLocacion(lo.id).length }}</span></button>
                  <p v-if="!hijos(se.id).length" class="text-[10px] text-slate-400 italic px-1.5 py-0.5">Sin locaciones</p>
                </div>
              </div>
              <p v-if="!hijos(ar.id).length" class="text-[10px] text-slate-400 italic px-1.5 py-0.5">Sin sectores</p>
            </div>
          </div>
          <p v-if="!hijos(emp.id).length" class="text-[10px] text-slate-400 italic px-1.5 py-0.5">Sin áreas</p>
        </div>
      </div>
      <button @click="abrirNodo('SIN')" :class="['w-full text-left px-2 py-1.5 mt-2 rounded font-bold border-t pt-2', nodoAbierto === 'SIN' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-50']">
        <i class="fa-solid fa-circle-question mr-1"></i> Sin locación ({{ resumenAreas.sinLocacion }})</button>
      <p v-if="!empresas.length" class="text-slate-400 text-center p-4">Aún no hay empresas.<br><span v-if="puedeEditar">Crea la primera con <b>Nueva Empresa</b>.</span></p>
    </aside>

    <!-- Panel de la carpeta abierta -->
    <div class="lg:col-span-3 space-y-4">
      <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 text-xs space-y-4">
        <!-- Migas -->
        <div class="flex flex-wrap items-center gap-1 text-[11px] font-semibold">
          <button @click="abrirNodo(null)" class="text-slate-500 hover:text-slate-800 hover:underline"><i class="fa-solid fa-city mr-1"></i>Empresas</button>
          <template v-for="m in migas" :key="m.id"><i class="fa-solid fa-chevron-right text-[8px] text-slate-400"></i>
            <button @click="abrirNodo(m.id)" :class="['hover:underline', colorTipo(m.tipo)]"><i :class="['fa-solid mr-1', ICONO[m.tipo]]"></i>{{ m.nombre }}</button></template>
          <template v-if="nodoAbierto === 'SIN'"><i class="fa-solid fa-chevron-right text-[8px] text-slate-400"></i><span class="text-rose-700">Sin locación</span></template>
        </div>

        <!-- Título del nodo abierto + acciones -->
        <div class="flex flex-wrap justify-between items-start gap-2 border-b pb-3">
          <div>
            <h3 class="text-base font-extrabold text-slate-800 uppercase flex items-center gap-2">
              <template v-if="nodoActual"><i :class="['fa-solid', ICONO[nodoActual.tipo], colorTipo(nodoActual.tipo)]"></i>{{ nodoActual.nombre }}
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 normal-case">{{ ETIQUETA[nodoActual.tipo] }}</span></template>
              <template v-else-if="nodoAbierto === 'SIN'"><i class="fa-solid fa-circle-question text-rose-600"></i> Equipos sin locación</template>
              <template v-else><i class="fa-solid fa-city text-slate-500"></i> Empresas</template>
            </h3>
            <p v-if="nodoActual && nodoActual.descripcion" class="text-slate-500 mt-0.5">{{ nodoActual.descripcion }}</p>
            <p v-if="nodoActual" class="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
              <template v-if="coordsDe(nodoActual.id)">
                <span class="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-mono font-bold"><i class="fa-solid fa-location-crosshairs mr-1"></i>{{ fmtCoord(coordsDe(nodoActual.id)) }}</span>
                <span v-if="coordsDe(nodoActual.id).heredado" class="text-amber-700">(aprox., tomada de {{ coordsDe(nodoActual.id).de.nombre }})</span>
              </template>
              <a v-if="googleMapsUrl(nodoActual.id)" :href="googleMapsUrl(nodoActual.id)" target="_blank" rel="noopener" class="font-bold text-blue-700 underline"><i class="fa-brands fa-google mr-0.5"></i> Abrir en Google Maps</a>
              <span v-if="!tieneGeo(nodoActual)" class="text-slate-400"><i class="fa-solid fa-map-pin mr-1"></i>Sin georreferencia propia
                <button v-if="puedeEditar" @click="abrirEditarNodo(nodoActual)" class="ml-1 font-bold text-blue-700 underline">Agregar</button></span>
            </p>
            <p v-if="nodoAbierto === 'SIN'" class="text-slate-500 mt-0.5">Equipos que aún no tienen Empresa › Área › Sector › Locación. Se muestra la ubicación en texto que tenían antes.</p>
          </div>
          <div v-if="nodoActual" class="flex flex-wrap gap-1.5">
            <button v-if="puedeEditar && HIJO_DE[nodoActual.tipo]" @click="abrirCrearNodo(HIJO_DE[nodoActual.tipo], nodoActual.id)"
              :class="['font-bold px-3 py-1.5 rounded-lg shadow text-white', ({ AREA: 'bg-amber-500 hover:bg-amber-600', SECTOR: 'bg-violet-600 hover:bg-violet-700' }[HIJO_DE[nodoActual.tipo]] || 'bg-emerald-600 hover:bg-emerald-700')]">
              <i class="fa-solid fa-plus"></i> {{ NUEVO[HIJO_DE[nodoActual.tipo]] }} {{ ETIQUETA[HIJO_DE[nodoActual.tipo]] }}</button>
            <button v-if="puedeEditar && nodoActual.tipo === 'LOCACION'" @click="abrirAsignar(nodoActual.id)" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-3 py-1.5 rounded-lg shadow"><i class="fa-solid fa-truck-monster"></i> Agregar equipos (AFI)</button>
            <button v-if="puedeEditar" @click="abrirEditarNodo(nodoActual)" class="bg-slate-100 hover:bg-slate-200 font-bold px-3 py-1.5 rounded-lg border" title="Renombrar"><i class="fa-solid fa-pen"></i></button>
            <button v-if="puedeEditar && nodoActual.tipo !== 'EMPRESA'" @click="abrirMoverNodo(nodoActual)" class="bg-slate-100 hover:bg-slate-200 font-bold px-3 py-1.5 rounded-lg border" title="Mover a otra carpeta"><i class="fa-solid fa-right-left"></i></button>
            <button v-if="isAdmin" @click="eliminarNodo(nodoActual)" class="bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold px-3 py-1.5 rounded-lg border border-rose-200" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>

        <!-- MAPA de todos los equipos (de la carpeta abierta o de todo) -->
        <div v-if="vistaMapa" class="space-y-2">
          <div class="flex flex-wrap justify-between items-center gap-2">
            <p class="font-semibold text-slate-700"><i class="fa-solid fa-map-location-dot text-rose-600 mr-1"></i>
              {{ puntosMapa.nEquipos }} equipo(s) en {{ puntosMapa.con.length }} locación(es) con georreferencia
              <span v-if="puntosMapa.nSin" class="text-amber-700"> · {{ puntosMapa.nSin }} equipo(s) en locaciones sin georreferencia</span></p>
            <div class="flex flex-wrap gap-2">
              <span v-for="e in empresasEnMapa" :key="e.id" class="flex items-center gap-1 text-[10px] font-bold"><span class="w-3 h-3 rounded-full" :style="{ background: colorEmpresa(e.id) }"></span>{{ e.nombre }}</span>
            </div>
          </div>
          <div class="relative">
            <div id="mapaAreas" class="w-full h-[60vh] min-h-[380px] rounded-xl border z-0"></div>
            <div v-if="errorMapa" class="absolute inset-0 flex items-center justify-center bg-white/90 text-rose-700 font-bold rounded-xl">{{ errorMapa }}</div>
            <div v-else-if="!puntosMapa.con.length" class="absolute inset-0 flex items-center justify-center bg-white/80 text-slate-500 font-semibold rounded-xl pointer-events-none text-center p-6">
              Ninguna locación tiene georreferencia todavía.<br>Abre una locación (o área / empresa) → ✏️ → pega el link o las coordenadas de Google Maps.</div>
          </div>
          <p class="text-[10px] text-slate-500">Clic en un punto = equipos de esa locación (clic en el AFI abre su perfil). Los puntos marcados "aprox." usan la georreferencia del área o la empresa porque la locación no tiene una propia. Arriba a la derecha del mapa se cambia a vista satelital.</p>
          <div v-if="puntosMapa.sin.length" class="border border-amber-200 bg-amber-50 rounded-lg p-3">
            <p class="font-bold text-amber-800 mb-1"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Locaciones sin georreferencia ({{ puntosMapa.sin.length }}) — no aparecen en el mapa</p>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="p in puntosMapa.sin" :key="p.loc.id" @click="puedeEditar ? abrirEditarNodo(p.loc) : abrirNodo(p.loc.id)" class="px-2 py-1 rounded bg-white border border-amber-200 hover:bg-amber-100 font-semibold">
                {{ p.ruta.empresa?.nombre }} › {{ p.ruta.area?.nombre }} › {{ p.ruta.sector?.nombre }} › <b>{{ p.loc.nombre }}</b> ({{ p.equipos.length }}) <i v-if="puedeEditar" class="fa-solid fa-pen text-[9px] ml-0.5"></i></button>
            </div>
          </div>
        </div>

        <template v-if="!vistaMapa">
        <!-- Mapa de Google de la locación abierta -->
        <div v-if="nodoActual && nodoActual.tipo === 'LOCACION' && coordsDe(nodoActual.id)" class="rounded-xl overflow-hidden border">
          <iframe :src="googleEmbedUrl(nodoActual.id, coordsDe(nodoActual.id).heredado ? 13 : 16)" class="w-full h-64" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Google Maps"></iframe>
        </div>

        <!-- Carpetas (empresas / áreas / locaciones) -->
        <div v-if="carpetasVisibles.length" class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          <button v-for="c in carpetasVisibles" :key="c.id" @click="abrirNodo(c.id)"
            :class="['text-left p-3 rounded-xl border-2 transition hover:shadow-md', fondoTipo(c.tipo)]">
            <i :class="['fa-solid text-2xl', c.tipo === 'AREA' ? 'fa-folder' : ICONO[c.tipo], colorTipo(c.tipo)]"></i>
            <p class="font-extrabold text-slate-800 mt-1 uppercase leading-tight break-words">{{ c.nombre }}
              <i v-if="tieneGeo(c)" class="fa-solid fa-location-dot text-rose-500 text-[10px] ml-0.5" title="Tiene georreferencia"></i></p>
            <p class="text-[10px] text-slate-500 mt-0.5">
              <span v-if="c.tipo !== 'LOCACION'">{{ hijos(c.id).length }} {{ { EMPRESA: 'área(s)', AREA: 'sector(es)', SECTOR: 'locación(es)' }[c.tipo] }} · </span>{{ conteoEquipos(c.id) }} equipo(s)</p>
          </button>
        </div>
        <div v-else-if="nodoActual && nodoActual.tipo !== 'LOCACION'" class="text-center text-slate-400 p-6 border-2 border-dashed rounded-xl">
          <i :class="['fa-solid text-3xl mb-2', ICONO[HIJO_DE[nodoActual.tipo]]]"></i>
          <p>{{ { EMPRESA: 'Esta empresa aún no tiene áreas.', AREA: 'Esta área aún no tiene sectores.', SECTOR: 'Este sector aún no tiene locaciones.' }[nodoActual.tipo] }}</p>
          <button v-if="puedeEditar" @click="abrirCrearNodo(HIJO_DE[nodoActual.tipo], nodoActual.id)" class="mt-2 font-bold text-blue-700 underline">Crear {{ ETIQUETA[HIJO_DE[nodoActual.tipo]].toLowerCase() }}</button>
        </div>
        <p v-else-if="!nodoActual && nodoAbierto !== 'SIN' && !empresas.length" class="text-center text-slate-400 p-6">Aún no hay empresas creadas. (Si aparece un error al crear, falta ejecutar <b>sql/areas.sql</b> en Supabase.)</p>

        <!-- Equipos de la carpeta abierta -->
        <div v-if="equiposVisibles.length || (nodoActual && nodoActual.tipo === 'LOCACION')" class="space-y-2">
          <h4 class="font-bold text-slate-800 uppercase flex items-center gap-2"><i class="fa-solid fa-truck-monster text-amber-500"></i> Equipos {{ nodoActual && nodoActual.tipo !== 'LOCACION' ? 'en todas sus locaciones' : '' }} ({{ equiposVisibles.length }})</h4>
          <div class="overflow-x-auto border rounded-lg max-h-[55vh]">
            <table class="w-full text-left whitespace-nowrap">
              <thead class="bg-slate-800 text-white uppercase text-[10px] sticky top-0">
                <tr><th class="p-2">AFI</th><th class="p-2">Tipo</th><th class="p-2">Marca / Modelo</th>
                  <th v-if="!nodoActual || nodoActual.tipo !== 'LOCACION'" class="p-2">{{ nodoAbierto === 'SIN' ? 'Ubicación (texto)' : 'Locación' }}</th>
                  <th class="p-2">Estado</th><th class="p-2 text-right">Horómetro</th><th class="p-2"></th></tr>
              </thead>
              <tbody class="divide-y bg-white">
                <tr v-for="e in equiposVisibles" :key="e.id" class="hover:bg-slate-50">
                  <td class="p-2 font-bold text-amber-700 cursor-pointer hover:underline" @click="abrirPerfilEquipo(e)">{{ e.afi }}</td>
                  <td class="p-2 font-semibold">{{ e.tipo }}</td>
                  <td class="p-2 text-slate-600">{{ e.marca }} {{ e.modelo }}</td>
                  <td v-if="!nodoActual || nodoActual.tipo !== 'LOCACION'" class="p-2">
                    <span v-if="nodoAbierto === 'SIN'" class="text-slate-500 italic">{{ e.ubicacion || '—' }} <span v-if="e.empresaArriendo" class="not-italic text-blue-700 font-semibold">· {{ e.empresaArriendo }}</span></span>
                    <button v-else @click="abrirNodo(e.locacionId)" class="font-bold text-emerald-700 hover:underline">{{ textoUbicacion(e.locacionId) }}</button>
                  </td>
                  <td class="p-2"><span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">{{ e.disponibilidad }}</span></td>
                  <td class="p-2 text-right font-mono">{{ Math.round(e.horometroActual || 0).toLocaleString('es-CL') }}</td>
                  <td class="p-2 text-right space-x-1">
                    <button v-if="puedeEditar" @click="abrirAsignacionRapida(e)" class="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold" title="Cambiar locación">
                      <i class="fa-solid fa-location-arrow"></i> {{ nodoAbierto === 'SIN' ? 'Asignar' : 'Cambiar' }}</button>
                    <button v-if="puedeEditar && nodoAbierto !== 'SIN'" @click="quitarDeLocacion(e)" class="px-2 py-1 rounded bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700" title="Quitar de la locación"><i class="fa-solid fa-xmark"></i></button>
                  </td>
                </tr>
                <tr v-if="!equiposVisibles.length"><td colspan="7" class="p-6 text-center text-slate-400">
                  Esta locación no tiene equipos. <button v-if="puedeEditar" @click="abrirAsignar(nodoActual.id)" class="font-bold text-amber-700 underline">Agregar equipos</button></td></tr>
              </tbody>
            </table>
          </div>
        </div>
        </template>
      </div>
    </div>
  </div>

  <!-- Modal: crear / renombrar carpeta -->
  <div v-if="formNodo" class="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4" @click.self="formNodo = null">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden text-xs">
      <div class="bg-slate-800 text-white px-5 py-3 font-extrabold uppercase flex items-center gap-2">
        <i :class="['fa-solid', ICONO[formNodo.tipo]]"></i> {{ formNodo.modo === 'crear' ? NUEVO[formNodo.tipo] : 'Modificar' }} {{ ETIQUETA[formNodo.tipo] }}</div>
      <div class="p-5 space-y-3">
        <p v-if="formNodo.padreId" class="text-slate-500">Dentro de: <b class="text-slate-800">{{ rutaNodo(nodo(formNodo.padreId)) }}</b></p>
        <div><label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Nombre</label>
          <input v-model="formNodo.nombre" @keyup.enter="guardarNodo" :placeholder="{ EMPRESA: 'Ej: CODELCO', AREA: 'Ej: MINA SUR', SECTOR: 'Ej: SECTOR NORTE', LOCACION: 'Ej: TALLER CAMIONES' }[formNodo.tipo]" class="w-full p-2.5 border rounded-lg uppercase font-bold" autofocus></div>
        <div><label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Descripción / referencia (opcional)</label>
          <input v-model="formNodo.descripcion" placeholder="Dirección, faena, contacto…" class="w-full p-2.5 border rounded-lg"></div>
        <div class="p-3 rounded-lg border border-rose-200 bg-rose-50/50 space-y-1.5">
          <label class="block font-bold text-slate-700 uppercase text-[11px]"><i class="fa-solid fa-location-crosshairs text-rose-600"></i> Georreferencia Google Maps (opcional)</label>
          <input v-model="formNodo.geo" placeholder="Pega el link de Google Maps o las coordenadas: -33.4489, -70.6693" class="w-full p-2.5 border rounded-lg font-mono text-[11px] bg-white">
          <p v-if="geoFormNodo" class="text-emerald-700 font-bold"><i class="fa-solid fa-circle-check"></i> Coordenadas: {{ fmtCoord(geoFormNodo) }}
            <a :href="'https://www.google.com/maps/search/?api=1&query=' + geoFormNodo.lat + ',' + geoFormNodo.lng" target="_blank" rel="noopener" class="ml-1 text-blue-700 underline font-semibold">comprobar</a></p>
          <p v-else-if="formNodo.geo && formNodo.geo.trim()" class="text-amber-700 font-semibold"><i class="fa-solid fa-triangle-exclamation"></i> No se leen coordenadas (un link corto maps.app.goo.gl no las trae). Mejor pega las coordenadas.</p>
          <p class="text-[10px] text-slate-500">Cómo obtenerlas: en Google Maps haz <b>clic derecho sobre el lugar</b> → clic en las coordenadas (se copian) → pégalas aquí.
            <a :href="buscarEnGoogleMaps([formNodo.nombre, formNodo.descripcion].filter(Boolean).join(' '))" target="_blank" rel="noopener" class="text-blue-700 underline font-semibold">Buscar "{{ formNodo.nombre || 'lugar' }}" en Google Maps</a></p>
          <p v-if="formNodo.tipo !== 'LOCACION'" class="text-[10px] text-slate-500">Lo que está adentro sin georreferencia propia usa esta (aparecen como "aprox." en el mapa).</p>
        </div>
      </div>
      <div class="px-5 py-3 border-t flex justify-end gap-2">
        <button @click="formNodo = null" class="px-4 py-2 rounded-lg font-bold bg-slate-200">Cancelar</button>
        <button @click="guardarNodo" :disabled="guardandoNodo" class="px-5 py-2 rounded-lg font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-950">Guardar</button>
      </div>
    </div>
  </div>

  <!-- Modal: mover área / locación -->
  <div v-if="formMover" class="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4" @click.self="formMover = null">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden text-xs">
      <div class="bg-slate-800 text-white px-5 py-3 font-extrabold uppercase"><i class="fa-solid fa-right-left mr-1"></i> Mover {{ ETIQUETA[formMover.nodo.tipo] }} "{{ formMover.nodo.nombre }}"</div>
      <div class="p-5 space-y-2">
        <label class="block font-bold text-slate-700 uppercase text-[11px]">Mover a {{ { AREA: 'la empresa', SECTOR: 'el área', LOCACION: 'el sector' }[formMover.nodo.tipo] }}</label>
        <select v-model="formMover.destinoId" class="w-full p-2.5 border rounded-lg font-bold">
          <option v-for="d in destinosMover" :key="d.id" :value="d.id">{{ d.texto }}</option>
        </select>
        <p class="text-slate-500">Los equipos que están dentro se mueven junto con la carpeta (se actualiza su ubicación y empresa).</p>
      </div>
      <div class="px-5 py-3 border-t flex justify-end gap-2">
        <button @click="formMover = null" class="px-4 py-2 rounded-lg font-bold bg-slate-200">Cancelar</button>
        <button @click="guardarMover" class="px-5 py-2 rounded-lg font-bold bg-amber-500 hover:bg-amber-600 text-slate-950">Mover</button>
      </div>
    </div>
  </div>

  <!-- Modal: agregar equipos a la locación -->
  <div v-if="formAsignar" class="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4" @click.self="formAsignar = null">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-xs">
      <div class="bg-amber-500 text-slate-950 px-5 py-3 font-extrabold uppercase flex justify-between items-center">
        <span><i class="fa-solid fa-truck-monster mr-1"></i> Agregar equipos a: {{ rutaTexto(formAsignar.locacionId) }}</span>
        <button @click="formAsignar = null"><i class="fa-solid fa-xmark text-lg"></i></button></div>
      <div class="p-4 space-y-2 border-b">
        <div class="flex flex-wrap gap-2 items-center">
          <input v-model="formAsignar.buscar" placeholder="Buscar AFI, tipo, marca, ubicación…" class="flex-1 min-w-[200px] p-2 border rounded-lg font-semibold">
          <label class="flex items-center gap-1 font-semibold"><input type="checkbox" v-model="formAsignar.soloSin"> Solo sin locación</label>
          <button @click="marcarTodosAsignar(true)" class="px-2 py-1 rounded bg-slate-100 font-bold">Marcar todos</button>
          <button @click="marcarTodosAsignar(false)" class="px-2 py-1 rounded bg-slate-100 font-bold">Ninguno</button>
        </div>
      </div>
      <div class="overflow-y-auto flex-1">
        <table class="w-full text-left">
          <thead class="bg-slate-100 uppercase text-[10px] text-slate-600 sticky top-0"><tr><th class="p-2 w-8"></th><th class="p-2">AFI</th><th class="p-2">Equipo</th><th class="p-2">Hoy está en</th></tr></thead>
          <tbody class="divide-y">
            <tr v-for="e in candidatosAsignar" :key="e.id" @click="formAsignar.ids[e.id] = !formAsignar.ids[e.id]" :class="['cursor-pointer', formAsignar.ids[e.id] ? 'bg-amber-50' : 'hover:bg-slate-50']">
              <td class="p-2"><input type="checkbox" :checked="formAsignar.ids[e.id]" @click.stop="formAsignar.ids[e.id] = $event.target.checked"></td>
              <td class="p-2 font-bold text-amber-700">{{ e.afi }}</td>
              <td class="p-2">{{ e.tipo }} <span class="text-slate-500">{{ e.marca }} {{ e.modelo }}</span></td>
              <td class="p-2"><span v-if="rutaTexto(e.locacionId)" class="font-semibold text-emerald-700">{{ rutaTexto(e.locacionId) }}</span>
                <span v-else class="text-rose-600">Sin locación <span class="text-slate-400">{{ e.ubicacion ? '(' + e.ubicacion + ')' : '' }}</span></span></td>
            </tr>
            <tr v-if="!candidatosAsignar.length"><td colspan="4" class="p-6 text-center text-slate-400">No hay equipos con ese filtro.</td></tr>
          </tbody>
        </table>
      </div>
      <div class="p-4 border-t bg-slate-50 space-y-2">
        <div v-if="isAdmin" class="flex flex-wrap items-center gap-2">
          <label class="flex items-center gap-1 font-bold"><input type="checkbox" v-model="formAsignar.registrarMov"> Registrar también en Movimientos</label>
          <template v-if="formAsignar.registrarMov">
            <input type="date" v-model="formAsignar.fecha" class="p-1.5 border rounded font-mono">
            <input v-model="formAsignar.tipo" class="p-1.5 border rounded" placeholder="Tipo de movimiento">
          </template>
        </div>
        <p v-else class="text-slate-500">Se actualiza solo la ubicación del equipo (sin registrar movimiento).</p>
        <div class="flex justify-between items-center">
          <span class="font-bold">{{ nSeleccionados }} seleccionado(s)</span>
          <div class="flex gap-2">
            <button @click="formAsignar = null" class="px-4 py-2 rounded-lg font-bold bg-slate-200">Cancelar</button>
            <button @click="confirmarAsignar" :disabled="!nSeleccionados || asignando" class="px-5 py-2 rounded-lg font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950">
              <i v-if="asignando" class="fa-solid fa-spinner fa-spin"></i> Asignar a la locación</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal: cambiar locación de un equipo -->
  <div v-if="formRapido" class="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4" @click.self="formRapido = null">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden text-xs">
      <div class="bg-slate-800 text-white px-5 py-3 font-extrabold uppercase"><i class="fa-solid fa-location-arrow mr-1"></i> Locación del AFI {{ formRapido.equipo.afi }}
        <span class="normal-case font-semibold text-slate-300">· {{ formRapido.equipo.tipo }}</span></div>
      <div class="p-5 space-y-3">
        <p class="text-slate-500">Hoy: <b class="text-slate-800">{{ rutaTexto(formRapido.equipo.locacionId) || (formRapido.equipo.ubicacion ? formRapido.equipo.ubicacion + ' (texto, sin locación)' : 'Sin locación') }}</b></p>
        <selector-locacion :sel="formRapido.sel"></selector-locacion>
      </div>
      <div class="px-5 py-3 border-t flex justify-end gap-2">
        <button @click="formRapido = null" class="px-4 py-2 rounded-lg font-bold bg-slate-200">Cancelar</button>
        <button @click="guardarAsignacionRapida" :disabled="asignando" class="px-5 py-2 rounded-lg font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-950">Guardar</button>
      </div>
    </div>
  </div>
</section>
`;
