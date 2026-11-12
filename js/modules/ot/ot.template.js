// Plantilla HTML del módulo OT (lista + editor con el formato FRC-RE-OPE-006)
export default /* html */ `
<section class="space-y-5 text-xs">

  <!-- ===================== LISTA ===================== -->
  <template v-if="!otActual">
    <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 class="text-lg font-extrabold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-file-signature text-amber-600"></i> Órdenes de Trabajo</h2>
        <p class="text-slate-500 mt-0.5">Formato FRC-RE-OPE-006 · el N° de folio se escribe a mano en la hoja (no se puede repetir). Una OT queda <b>Realizada</b> cuando se registra en el Historial con su N° de OT.</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <label v-if="isAdmin" :class="['font-bold px-4 py-2.5 rounded-xl shadow flex items-center gap-2 cursor-pointer border', importandoOT ? 'bg-slate-200 text-slate-500' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300']" title="Uno o varios Excel con el formato de OT (FRC-RE-OPE-006)">
          <i :class="['fa-solid', importandoOT ? 'fa-spinner fa-spin' : 'fa-file-import']"></i> {{ importandoOT ? 'Importando...' : 'Importar OT (Excel)' }}
          <input type="file" multiple accept=".xlsx,.xls,.xlsm" @change="importarOTExcel" :disabled="importandoOT" class="hidden">
        </label>
        <button v-if="puedeEditar" @click="nuevaOT()" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl shadow flex items-center gap-2"><i class="fa-solid fa-plus-circle"></i> Nueva OT</button>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <div @click="filtroOT.estado = ''" class="rounded-xl border p-3 bg-white cursor-pointer hover:shadow"><p class="text-[10px] font-bold text-slate-500 uppercase">Total OT</p><p class="text-2xl font-extrabold text-slate-800">{{ resumenOT.total }}</p></div>
      <div @click="filtroOT.estado = 'PENDIENTE'" class="rounded-xl border p-3 bg-amber-100 text-amber-800 border-amber-300 cursor-pointer hover:shadow"><p class="text-[10px] font-bold uppercase">Pendientes</p><p class="text-2xl font-extrabold">{{ resumenOT.PENDIENTE }}</p></div>
      <div @click="filtroOT.estado = 'EN_PROCESO'" class="rounded-xl border p-3 bg-sky-100 text-sky-800 border-sky-300 cursor-pointer hover:shadow"><p class="text-[10px] font-bold uppercase">En proceso</p><p class="text-2xl font-extrabold">{{ resumenOT.EN_PROCESO }}</p></div>
      <div @click="filtroOT.estado = 'REALIZADA'" class="rounded-xl border p-3 bg-emerald-100 text-emerald-800 border-emerald-300 cursor-pointer hover:shadow"><p class="text-[10px] font-bold uppercase">Realizadas</p><p class="text-2xl font-extrabold">{{ resumenOT.REALIZADA }}</p></div>
      <div @click="filtroOT.estado = 'CERRADA'" class="rounded-xl border p-3 bg-slate-700 text-white border-slate-700 cursor-pointer hover:shadow"><p class="text-[10px] font-bold uppercase">Cerradas</p><p class="text-2xl font-extrabold">{{ resumenOT.CERRADA }}</p></div>
      <div @click="filtroOT.estado = 'ANULADA'" class="rounded-xl border p-3 bg-slate-100 text-slate-600 cursor-pointer hover:shadow"><p class="text-[10px] font-bold uppercase">Anuladas</p><p class="text-2xl font-extrabold">{{ resumenOT.ANULADA }}</p></div>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="p-3 border-b flex flex-wrap gap-2 items-center">
        <input v-model="filtroOT.texto" type="text" placeholder="Buscar folio, AFI, equipo, actividad..." class="p-2 border rounded-lg w-72">
        <select v-model="filtroOT.estado" class="p-2 border rounded-lg font-bold"><option value="">Todos los estados</option><option value="PENDIENTE">Pendiente</option><option value="REALIZADA">Realizada</option><option value="ANULADA">Anulada</option></select>
        <span v-if="cargandoOT" class="text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-slate-800 text-white uppercase text-[10px]">
            <tr><th class="p-2.5">Folio</th><th class="p-2.5">Fecha</th><th class="p-2.5">AFI</th><th class="p-2.5">Equipo</th><th class="p-2.5">Tipo</th><th class="p-2.5">Actividades</th><th class="p-2.5">Estado</th><th class="p-2.5">Taller</th><th class="p-2.5 text-center">Vinculados</th><th class="p-2.5 text-center">Acciones</th></tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="o in listaOT" :key="o.id" class="hover:bg-slate-50 cursor-pointer" @click="abrirOT(o)">
              <td class="p-2.5 font-mono font-extrabold text-rose-700">{{ o.folio }}</td>
              <td class="p-2.5 whitespace-nowrap">{{ formatDateForDisplay(o.fecha) }}</td>
              <td class="p-2.5 font-bold text-amber-800">{{ o.afi }}</td>
              <td class="p-2.5">{{ o.equipo }} <span class="text-slate-400">{{ o.marca }} {{ o.modelo }}</span></td>
              <td class="p-2.5 font-semibold">{{ o.tipo_mantencion || '-' }}<span v-if="o.pauta" class="text-slate-500"> · {{ o.pauta }} h</span></td>
              <td class="p-2.5 max-w-[320px] truncate">{{ o.actividades.filter(a => a.descripcion).map(a => a.descripcion).join(' · ') || '-' }}</td>
              <td class="p-2.5"><span :class="['px-2 py-0.5 rounded-full border text-[10px] font-bold', ESTILO_ESTADO_OT[estadoOT(o)]]">{{ ETIQUETA_ESTADO_OT[estadoOT(o)] }}</span></td>
              <td class="p-2.5 whitespace-nowrap"><span v-if="etiquetaTallerOT(o)" class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold" :title="'Enlazada al taller de reparación'"><i class="fa-solid fa-warehouse mr-1"></i>{{ etiquetaTallerOT(o) }}</span><span v-else class="text-slate-300">—</span></td>
              <td class="p-2.5 text-center whitespace-nowrap">
                <span v-if="documentosDeOT(o.folio).length" class="font-bold text-emerald-700" :title="'Registros en Historial con N° OT ' + o.folio"><i class="fa-solid fa-clipboard-check mr-0.5"></i>{{ documentosDeOT(o.folio).length }}</span>
                <span v-if="documentosDeOT(o.folio).some(d => d.link)" class="ml-2 font-bold text-blue-700" title="Tiene documento adjunto"><i class="fa-solid fa-paperclip"></i></span>
                <span v-if="!documentosDeOT(o.folio).length" class="text-slate-300">—</span>
              </td>
              <td class="p-2.5 text-center whitespace-nowrap" @click.stop>
                <button @click="imprimirOT(o)" title="Imprimir" class="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"><i class="fa-solid fa-print"></i></button>
                <button @click="exportarOTExcel(o)" title="Exportar Excel" class="ml-1 px-2 py-1 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800"><i class="fa-solid fa-file-excel"></i></button>
                <button v-if="isAdmin" @click="eliminarOT(o)" title="Eliminar" class="ml-1 px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-700"><i class="fa-solid fa-trash"></i></button>
              </td>
            </tr>
            <tr v-if="!listaOT.length && !cargandoOT"><td colspan="10" class="p-8 text-center text-slate-400 italic">No hay OT{{ filtroOT.texto || filtroOT.estado ? ' con estos filtros' : ' todavía' }}.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </template>

  <!-- ===================== EDITOR (mismo formato del Excel) ===================== -->
  <template v-else>
    <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3 sticky top-[72px] z-30">
      <div class="flex items-center gap-3 flex-wrap">
        <button @click="cerrarOT" class="px-3 py-2 rounded-lg border font-bold text-slate-600 hover:bg-slate-50"><i class="fa-solid fa-arrow-left mr-1"></i> Volver</button>
        <span class="text-base font-extrabold text-slate-800">OT N° <span class="text-rose-700 font-mono">{{ otActual.folio || 'nueva — escribe el folio en la hoja' }}</span></span>
        <span :class="['px-2 py-0.5 rounded-full border text-[10px] font-bold', ESTILO_ESTADO_OT[estadoOT(otActual)]]">{{ ETIQUETA_ESTADO_OT[estadoOT(otActual)] }}</span>
        <label class="flex items-center gap-1 font-bold text-slate-600">Fecha OT <input type="date" v-model="otActual.fecha" :disabled="!puedeEditar" class="p-1.5 border rounded-lg"></label>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <button v-if="puedeEditar" @click="guardarYAvisar" :disabled="guardandoOT" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-lg shadow disabled:opacity-60"><i :class="['fa-solid mr-1', guardandoOT ? 'fa-spinner fa-spin' : 'fa-floppy-disk']"></i> Guardar</button>
        <button @click="imprimirOT(otActual)" class="bg-slate-700 hover:bg-slate-800 text-white font-bold px-3 py-2 rounded-lg shadow"><i class="fa-solid fa-print mr-1"></i> Imprimir</button>
        <button @click="exportarOTExcel(otActual)" :disabled="exportandoOT" class="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold px-3 py-2 rounded-lg border border-emerald-300 disabled:opacity-60"><i :class="['fa-solid mr-1', exportandoOT ? 'fa-spinner fa-spin' : 'fa-file-excel']"></i> Excel</button>
        <button v-if="puedeEditar && estadoOT(otActual) === 'PENDIENTE'" @click="registrarEnHistorial(otActual)" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-3 py-2 rounded-lg shadow"><i class="fa-solid fa-clipboard-check mr-1"></i> Registrar en Historial</button>
        <button v-if="otActual.id && otActual.estado !== 'ANULADA' && (otActual.estado === 'CERRADA' ? isAdmin : puedeEditar)" @click="alternarCierreOT(otActual)" :class="['px-3 py-2 rounded-lg font-bold border', otActual.estado === 'CERRADA' ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100' : 'bg-slate-700 text-white border-slate-700 hover:bg-slate-800']"><i :class="['fa-solid mr-1', otActual.estado === 'CERRADA' ? 'fa-lock-open' : 'fa-lock']"></i>{{ otActual.estado === 'CERRADA' ? 'Reabrir OT' : 'Cerrar OT' }}</button>
        <button v-if="isAdmin && otActual.id" @click="anularOT(otActual)" class="px-3 py-2 rounded-lg border font-bold text-slate-600 hover:bg-slate-50">{{ otActual.estado === 'ANULADA' ? 'Reactivar' : 'Anular' }}</button>
      </div>
    </div>

    <!-- Enlace con el Taller / Programa de reparación -->
    <div class="bg-amber-50 rounded-2xl shadow-sm border-2 border-amber-200 p-4 flex flex-wrap items-center gap-3">
      <span class="font-extrabold text-amber-900 flex items-center gap-2"><i class="fa-solid fa-warehouse"></i> Programa de reparación / Taller</span>
      <template v-if="faltaTablaTaller"><span class="text-rose-700 font-semibold">Falta ejecutar sql/taller.sql en Supabase para enlazar OT al taller.</span></template>
      <template v-else-if="!otActual.afi"><span class="text-slate-500">Escribe primero el AFI de la OT.</span></template>
      <template v-else>
        <select :value="valorEnlaceOT(otActual)" @change="enlazarOT(otActual, $event.target.value)" :disabled="!puedeEditar" class="p-2 border-2 border-amber-300 rounded-lg font-bold bg-white min-w-[280px] max-w-full">
          <option value="">Sin enlace (OT normal)</option>
          <option v-for="op in opcionesEnlaceOT(otActual.afi)" :key="op.valor" :value="op.valor">{{ op.etiqueta }}</option>
        </select>
        <template v-if="otActual.reparacion_id != null && repPorId(otActual.reparacion_id)">
          <span class="px-2 py-1 rounded-lg bg-white border border-amber-300 font-bold text-amber-900">{{ ubicacionRep(repPorId(otActual.reparacion_id)) }} · avance {{ progresoRep(repPorId(otActual.reparacion_id)).pct }}%</span>
          <button @click="irAlTaller" class="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold"><i class="fa-solid fa-arrow-right mr-1"></i>Ver en el taller</button>
        </template>
        <span class="w-full text-[11px] text-amber-900/80">Elige el equipo del programa de reparación, o si no está en el programa usa <b>“+ Agregar a Equipos reparación sin programa”</b>. Las actividades terminadas de esta OT suman al % de avance de la nave.</span>
      </template>
    </div>

    <div v-if="otActual.folio" class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="px-4 py-2.5 border-b bg-slate-50 font-bold text-slate-700 flex items-center gap-2">
        <i class="fa-solid fa-link text-blue-600"></i> Registros y documentos vinculados a la OT N° {{ otActual.folio }}
        <span class="text-[10px] font-semibold text-slate-500">(mantenciones del Historial con N° OT = {{ otActual.folio }})</span>
      </div>
      <table v-if="documentosDeOT(otActual.folio).length" class="w-full text-left">
        <thead class="text-[10px] uppercase text-slate-500"><tr><th class="px-4 py-2">Fecha</th><th class="px-2 py-2">AFI</th><th class="px-2 py-2">Tipo</th><th class="px-2 py-2">Causa</th><th class="px-2 py-2">Descripción</th><th class="px-2 py-2 text-center">Documento</th><th class="px-2 py-2"></th></tr></thead>
        <tbody class="divide-y">
          <tr v-for="d in documentosDeOT(otActual.folio)" :key="d.id">
            <td class="px-4 py-2 whitespace-nowrap">{{ formatDateForDisplay(d.fecha) }}</td>
            <td class="px-2 py-2 font-bold text-amber-800">{{ d.afi }}</td>
            <td class="px-2 py-2 font-semibold text-blue-700">{{ d.tipo || '-' }}</td>
            <td class="px-2 py-2">{{ d.causa || '-' }}</td>
            <td class="px-2 py-2 max-w-[360px] truncate" :title="d.descripcion">{{ d.descripcion || '-' }}</td>
            <td class="px-2 py-2 text-center"><a v-if="d.link" :href="d.link" target="_blank" rel="noopener" class="bg-blue-100 text-blue-800 hover:bg-blue-200 px-2 py-1 rounded font-bold text-[10px] inline-flex items-center gap-1"><i class="fa-solid fa-paperclip"></i> Ver documento</a><span v-else class="text-slate-400">Sin adjunto</span></td>
            <td class="px-2 py-2 text-right"><button v-if="puedeEditar" @click="editarMantencion(d.mantencion)" class="px-2 py-1 rounded border font-bold text-slate-600 hover:bg-slate-50"><i class="fa-solid fa-pen mr-1"></i> Abrir mantención</button></td>
          </tr>
        </tbody>
      </table>
      <p v-else class="px-4 py-3 text-slate-500">Aún no hay mantenciones en el Historial con N° OT {{ otActual.folio }}. Usa <b>Registrar en Historial</b> cuando el trabajo esté hecho (ahí puedes adjuntar el documento).</p>
    </div>
    <p class="text-slate-500"><i class="fa-solid fa-circle-info mr-1"></i> Escribe el <b>ID EQUIPO (AFI)</b> y se completan Equipo, Marca, Modelo y Hrs actual. Las celdas amarillas se rellenan; en <b>Tipo de mantención</b> y <b>Pauta</b> haz clic en el cuadro para marcar la X.
      <span v-if="otActual.afi && !equipoDeOT" class="text-rose-600 font-bold ml-1">El AFI {{ otActual.afi }} no está en el inventario.</span></p>

    <datalist id="dl-ot-afi"><option v-for="e in dbEquipos" :key="e.id" :value="e.afi">{{ e.tipo }} {{ e.marca }} {{ e.modelo }}</option></datalist>

    <div class="overflow-x-auto bg-slate-300/60 p-4 rounded-2xl">
      <div class="bg-white mx-auto shadow-xl" :style="{ position: 'relative', width: anchoHoja * E + 'px' }">
        <img :src="F.logo.src" alt="" class="pointer-events-none" :style="{ position: 'absolute', left: F.logo.left * E + 'px', top: F.logo.top * E + 'px', width: F.logo.width * E + 'px', height: F.logo.height * E + 'px' }">
        <img v-for="fz in firmasEnHoja(otActual)" :key="fz.k" :src="fz.src" alt="Firma" class="pointer-events-none" :style="{ position: 'absolute', zIndex: 5, objectFit: 'contain', left: fz.left * E + 'px', top: fz.top * E + 'px', width: fz.width * E + 'px', height: fz.height * E + 'px' }">
        <table class="ot-hoja" :style="{ width: anchoHoja * E + 'px' }">
          <colgroup><col v-for="(w, i) in F.cols" :key="i" :style="{ width: w * E + 'px' }"></colgroup>
          <tbody>
            <tr v-for="(fila, i) in filasFormato" :key="i" :style="{ height: F.rows[i] * E + 'px' }">
              <td v-for="c in fila" :key="c.c" :rowspan="c.rs || 1" :colspan="c.cs || 1" :style="estiloCelda(c, E)" :class="c.k ? 'ot-campo' : ''">
                <template v-if="!c.k">{{ c.t }}</template>
                <button v-else-if="c.k.startsWith('tipo:')" type="button" :disabled="!puedeEditar" @click="alternarTipo(c.k.slice(5))" class="ot-marca">{{ textoCelda(otActual, c.k) }}</button>
                <button v-else-if="c.k.startsWith('pauta:')" type="button" :disabled="!puedeEditar" @click="alternarPauta(c.k.slice(6))" class="ot-marca">{{ textoCelda(otActual, c.k) }}</button>
                <input v-else-if="c.k === 'folio'" type="text" inputmode="numeric" v-model="otActual.folio" :placeholder="'ej. ' + folioSugerido" :disabled="!puedeEditar" class="ot-in font-extrabold text-rose-700 text-center">
                <input v-else-if="c.k === 'afi'" list="dl-ot-afi" v-model="otActual.afi" @change="autocompletarDesdeAfi" :disabled="!puedeEditar" class="ot-in font-bold uppercase">
                <input v-else :type="tipoCampo(c.k)" :value="valorCampo(otActual, c.k)" @input="fijarCampo(otActual, c.k, $event.target.value)" :disabled="!puedeEditar"
                  :class="['ot-in', tipoCampo(c.k) !== 'text' ? 'ot-in-sm' : '']" :style="{ textAlign: c.al === 'c' ? 'center' : 'left' }">
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Firmas dibujadas (mouse / touch) -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
      <p class="font-extrabold text-slate-700"><i class="fa-solid fa-signature mr-1 text-slate-500"></i> Firmas <span class="font-normal text-slate-500">(se ven en la hoja y al imprimir; se guardan con <b>Guardar</b>)</span></p>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div><p class="text-[11px] font-bold text-slate-600 mb-1">Mecánico responsable: {{ otActual.mecanico || '—' }}</p>
          <firma-pad :firma="(otActual.firmas || {}).mecanico || ''" :titulo="'Firma mecánico responsable · OT ' + (otActual.folio || '')" :disabled="!puedeEditar" @guardar="u => fijarFirmaEditor(otActual, 'mecanico', u)"></firma-pad></div>
        <div><p class="text-[11px] font-bold text-slate-600 mb-1">Supervisor responsable: {{ otActual.supervisor || '—' }}</p>
          <firma-pad :firma="(otActual.firmas || {}).supervisor || ''" :titulo="'Firma supervisor responsable · OT ' + (otActual.folio || '')" :disabled="!puedeEditar" @guardar="u => fijarFirmaEditor(otActual, 'supervisor', u)"></firma-pad></div>
        <template v-for="(p, i) in otActual.personal" :key="'f' + i">
          <div v-if="p.nombre"><p class="text-[11px] font-bold text-slate-600 mb-1">Personal: {{ p.nombre }}</p>
            <firma-pad :firma="p.firma || ''" :titulo="'Firma de ' + p.nombre" :disabled="!puedeEditar" @guardar="u => fijarFirmaEditor(otActual, 'per.' + i, u)"></firma-pad></div>
        </template>
      </div>
      <p class="text-[11px] text-slate-400">La exportación a Excel no incluye las firmas (usa Imprimir → Guardar como PDF).</p>
    </div>
  </template>
</section>
`;
