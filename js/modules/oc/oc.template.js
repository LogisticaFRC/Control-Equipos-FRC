// Plantilla HTML del módulo OC (registro histórico de Órdenes de Compra)
export default /* html */ `
<section class="space-y-5 text-xs">

  <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
    <div>
      <h2 class="text-lg font-extrabold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-file-invoice-dollar text-emerald-600"></i> OC · Órdenes de Compra</h2>
      <p class="text-slate-500 mt-0.5">Registro histórico de OC. Cada OC queda <b>vinculada</b> a la mantención que tenga su N° en la columna <b>OC</b> del Historial (una mantención puede tener varias OC).</p>
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <button @click="exportarOCExcel" :disabled="exportandoOC" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl shadow flex items-center gap-2 disabled:opacity-60"><i :class="['fa-solid', exportandoOC ? 'fa-spinner fa-spin' : 'fa-file-excel']"></i> Exportar Excel</button>
      <button v-if="puedeEditar" @click="nuevaOC()" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl shadow flex items-center gap-2"><i class="fa-solid fa-plus-circle"></i> Nueva OC</button>
    </div>
  </div>

  <!-- Resumen -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
    <div @click="filtroOC.vinculo = ''" class="rounded-xl border p-3 bg-white cursor-pointer hover:shadow"><p class="text-[10px] font-bold text-slate-500 uppercase">OC (filtro actual)</p><p class="text-2xl font-extrabold text-slate-800">{{ resumenOC.total }}</p></div>
    <div class="rounded-xl border p-3 bg-emerald-50 border-emerald-300 text-emerald-800"><p class="text-[10px] font-bold uppercase">Monto total</p><p class="text-2xl font-extrabold">{{ fmtCLP(resumenOC.monto) }}</p></div>
    <div @click="filtroOC.vinculo = 'SI'" class="rounded-xl border p-3 bg-blue-50 border-blue-300 text-blue-800 cursor-pointer hover:shadow"><p class="text-[10px] font-bold uppercase">Vinculadas a mantención</p><p class="text-2xl font-extrabold">{{ resumenOC.vinculadas }} <span class="text-xs font-bold">· {{ fmtCLP(resumenOC.montoVinculadas) }}</span></p></div>
    <div @click="filtroOC.vinculo = 'NO'" class="rounded-xl border p-3 bg-amber-50 border-amber-300 text-amber-800 cursor-pointer hover:shadow"><p class="text-[10px] font-bold uppercase">Sin vincular</p><p class="text-2xl font-extrabold">{{ resumenOC.sinVincular }}</p></div>
  </div>

  <!-- Lista -->
  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <div class="p-3 border-b flex flex-wrap gap-2 items-end">
      <div><label class="block text-[10px] font-bold text-slate-500">Buscar</label><input v-model="filtroOC.texto" type="text" placeholder="N° OC, proveedor, descripción..." class="p-2 border rounded-lg w-64"></div>
      <div><label class="block text-[10px] font-bold text-slate-500">AFI</label><input v-model="filtroOC.afi" list="dl-oc-afi" type="text" placeholder="Todos" class="p-2 border rounded-lg w-28 uppercase"></div>
      <div><label class="block text-[10px] font-bold text-slate-500">Desde</label><input v-model="filtroOC.desde" type="date" class="p-2 border rounded-lg"></div>
      <div><label class="block text-[10px] font-bold text-slate-500">Hasta</label><input v-model="filtroOC.hasta" type="date" class="p-2 border rounded-lg"></div>
      <div><label class="block text-[10px] font-bold text-slate-500">Vínculo</label>
        <select v-model="filtroOC.vinculo" class="p-2 border rounded-lg font-bold"><option value="">Todas</option><option value="SI">Vinculadas</option><option value="NO">Sin vincular</option></select></div>
      <button @click="limpiarFiltroOC" class="text-slate-500 hover:text-slate-800 underline pb-2">Limpiar</button>
    </div>
    <datalist id="dl-oc-afi"><option v-for="e in dbEquipos" :key="e.id" :value="e.afi">{{ e.tipo }} {{ e.marca }} {{ e.modelo }}</option></datalist>
    <div class="overflow-x-auto">
      <table class="w-full text-left">
        <thead class="bg-slate-800 text-white uppercase text-[10px]">
          <tr><th class="p-2.5">N° OC</th><th class="p-2.5">Fecha</th><th class="p-2.5">AFI</th><th class="p-2.5">Equipo</th><th class="p-2.5">Proveedor</th><th class="p-2.5">Descripción</th><th class="p-2.5 text-right">Precio</th><th class="p-2.5">Mantención vinculada</th><th class="p-2.5 text-center">Documento</th><th class="p-2.5 text-center">Acciones</th></tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="o in listaOC" :key="o.id" class="hover:bg-slate-50 cursor-pointer" @click="editarOC(o)">
            <td class="p-2.5 font-mono font-extrabold text-emerald-700">{{ o.numero }}</td>
            <td class="p-2.5 whitespace-nowrap">{{ formatDateForDisplay(o.fecha) }}</td>
            <td class="p-2.5 font-bold text-amber-800" @click.stop><button v-if="afiDeOC(o)" @click="verDetallePorAfiString(afiDeOC(o))" class="hover:underline">{{ afiDeOC(o) }}</button><span v-else class="text-slate-300">—</span></td>
            <td class="p-2.5">{{ buscarEquipoPorAfi(afiDeOC(o))?.tipo || '-' }} <span class="text-slate-400">{{ buscarEquipoPorAfi(afiDeOC(o))?.marca }} {{ buscarEquipoPorAfi(afiDeOC(o))?.modelo }}</span></td>
            <td class="p-2.5 font-semibold">{{ o.proveedor || '-' }}</td>
            <td class="p-2.5 max-w-[280px] truncate" :title="o.descripcion">{{ o.descripcion || '-' }}</td>
            <td class="p-2.5 text-right font-mono font-extrabold text-emerald-800 whitespace-nowrap">{{ fmtCLP(o.precio) }}</td>
            <td class="p-2.5" @click.stop>
              <template v-if="mantencionesDeOC(o).length">
                <button v-for="m in mantencionesDeOC(o)" :key="m.id" @click="puedeEditar ? abrirMantencion(m) : null" class="block text-left text-blue-700 font-bold hover:underline whitespace-nowrap" :title="m.descripcion">
                  <i class="fa-solid fa-link mr-1"></i>{{ formatDateForDisplay(m.fecha) }} · {{ m.tipoMant || m.causa || 'Mantención' }}<span v-if="m.numeroOT" class="text-slate-500"> · OT {{ m.numeroOT }}</span>
                </button>
              </template>
              <span v-else class="px-2 py-0.5 rounded-full border text-[10px] font-bold bg-amber-100 text-amber-800 border-amber-300">SIN VINCULAR</span>
            </td>
            <td class="p-2.5 text-center" @click.stop>
              <a v-if="o.link" :href="o.link" target="_blank" rel="noopener" class="bg-blue-100 text-blue-800 hover:bg-blue-200 px-2 py-1 rounded font-bold text-[10px] inline-flex items-center gap-1"><i class="fa-solid fa-paperclip"></i> Ver</a>
              <span v-else class="text-slate-300">—</span>
            </td>
            <td class="p-2.5 text-center whitespace-nowrap" @click.stop>
              <button v-if="puedeEditar && !mantencionesDeOC(o).length" @click="nuevaMantencionConOC(o)" title="Registrar mantención con esta OC" class="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-800"><i class="fa-solid fa-wrench"></i></button>
              <button @click="editarOC(o)" title="Ver / editar" class="ml-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"><i class="fa-solid fa-pen"></i></button>
              <button v-if="isAdmin" @click="eliminarOC(o)" title="Eliminar" class="ml-1 px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-700"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
          <tr v-if="!listaOC.length"><td colspan="10" class="p-8 text-center text-slate-400 italic">No hay OC{{ filtroOC.texto || filtroOC.afi || filtroOC.vinculo || filtroOC.desde || filtroOC.hasta ? ' con estos filtros' : ' registradas todavía' }}.</td></tr>
        </tbody>
        <tfoot v-if="listaOC.length" class="bg-slate-100 font-extrabold">
          <tr><td colspan="6" class="p-2.5 text-right uppercase text-[10px] text-slate-600">Total {{ listaOC.length }} OC</td><td class="p-2.5 text-right font-mono text-emerald-800">{{ fmtCLP(resumenOC.monto) }}</td><td colspan="3"></td></tr>
        </tfoot>
      </table>
    </div>
  </div>

  <!-- N° de OC escritos en mantenciones pero no registrados aquí -->
  <div v-if="ocsSinRegistrar.length" class="bg-amber-50 rounded-2xl border border-amber-300 overflow-hidden">
    <div class="px-4 py-2.5 border-b border-amber-200 font-bold text-amber-900 flex items-center gap-2"><i class="fa-solid fa-triangle-exclamation"></i> OC escritas en mantenciones que no están registradas ({{ ocsSinRegistrar.length }}) <span class="text-[10px] font-semibold text-amber-700">— regístralas para que sumen su precio</span></div>
    <div class="p-3 flex flex-wrap gap-2">
      <div v-for="x in ocsSinRegistrar" :key="x.numero" class="bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
        <span class="font-mono font-extrabold text-amber-900">OC {{ x.numero }}</span>
        <span class="text-slate-500">AFI {{ x.mantenciones[0].afi }} · {{ formatDateForDisplay(x.mantenciones[0].fecha) }}</span>
        <button v-if="puedeEditar" @click="nuevaOC({ numero: x.numero, afi: x.mantenciones[0].afi, fecha: x.mantenciones[0].fecha !== '-' ? x.mantenciones[0].fecha : '', mantencionId: String(x.mantenciones[0].id) })" class="text-[10px] font-bold text-emerald-700 hover:underline"><i class="fa-solid fa-plus"></i> Registrar</button>
      </div>
    </div>
  </div>

  <!-- ===================== FORMULARIO OC ===================== -->
  <div v-if="ocForm" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" @click.self="cerrarOC">
    <div class="bg-white rounded-2xl shadow-2xl border w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden">
      <div class="px-6 py-4 border-b flex items-center justify-between bg-slate-800 text-white">
        <h3 class="text-sm font-bold flex items-center gap-2"><i class="fa-solid fa-file-invoice-dollar text-emerald-400"></i> {{ ocForm.id ? 'OC N° ' + ocForm.numero : 'Registrar nueva OC' }}</h3>
        <button @click="cerrarOC" class="text-slate-300 hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <fieldset :disabled="!puedeEditar" class="p-6 overflow-y-auto space-y-4 flex-grow">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label class="block font-bold mb-1">N° OC *</label><input v-model="ocForm.numero" type="text" placeholder="Ej: 4521" class="w-full p-2 border rounded-lg font-mono font-extrabold text-emerald-700 text-sm"></div>
          <div><label class="block font-bold mb-1">Fecha</label><input v-model="ocForm.fecha" type="date" class="w-full p-2 border rounded-lg"></div>
          <div><label class="block font-bold mb-1">Precio ($) *</label><input v-model="ocForm.precio" type="number" min="0" step="1" placeholder="0" class="w-full p-2 border rounded-lg font-mono font-bold text-sm"><p class="text-[10px] text-slate-500 mt-0.5">{{ fmtCLP(ocForm.precio) }}</p></div>
          <div><label class="block font-bold mb-1">AFI</label><input v-model="ocForm.afi" list="dl-oc-afi" type="text" placeholder="AFI del equipo" class="w-full p-2 border rounded-lg font-bold uppercase">
            <p v-if="equipoOCForm" class="text-[10px] text-slate-600 mt-0.5">{{ equipoOCForm.tipo }} {{ equipoOCForm.marca }} {{ equipoOCForm.modelo }} · <i class="fa-solid fa-location-dot"></i> {{ equipoOCForm.ubicacion || '-' }}</p>
            <p v-else-if="ocForm.afi" class="text-[10px] text-rose-600 font-bold mt-0.5">AFI no está en el inventario.</p></div>
          <div class="sm:col-span-2"><label class="block font-bold mb-1">Proveedor</label><input v-model="ocForm.proveedor" type="text" placeholder="Proveedor" class="w-full p-2 border rounded-lg uppercase"></div>
        </div>
        <div><label class="block font-bold mb-1">Descripción</label><textarea v-model="ocForm.descripcion" rows="2" placeholder="Qué se compró / servicio..." class="w-full p-2 border rounded-lg"></textarea></div>

        <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1.5">
          <label class="block font-bold text-blue-900"><i class="fa-solid fa-link mr-1"></i> Mantención vinculada</label>
          <select v-model="ocForm.mantencionId" class="w-full p-2 border border-blue-300 rounded-lg bg-white font-semibold">
            <option value="">— Sin vincular (se vincula cuando se realice la mantención) —</option>
            <option v-for="m in mantencionesParaVincular" :key="m.id" :value="String(m.id)">{{ etiquetaMantencion(m) }}</option>
          </select>
          <p class="text-[10px] text-blue-800">Al guardar, el N° de esta OC se agrega a la columna <b>OC</b> de la mantención elegida (que puede tener varias OC). También se vincula sola si escribes el N° en la mantención.<span v-if="!ocForm.afi" class="font-bold"> Escribe el AFI para ver sus mantenciones.</span></p>
        </div>

        <div class="bg-slate-50 border rounded-xl p-3 space-y-2">
          <label class="block font-bold text-slate-700"><i class="fa-solid fa-paperclip mr-1"></i> Documento de la OC (PDF / imagen)</label>
          <input type="file" @change="subirDocumentoOC" accept=".pdf,image/*,.xlsx,.xls,.doc,.docx" :disabled="subiendoOC" class="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100">
          <p v-if="subiendoOC" class="text-slate-500"><i class="fa-solid fa-spinner fa-spin"></i> Subiendo...</p>
          <p v-else-if="ocForm.link" class="flex items-center gap-2 text-emerald-700 font-bold">
            <i class="fa-solid fa-check"></i>
            <a :href="ocForm.link" target="_blank" rel="noopener" class="underline">{{ ocForm.archivoNombre || 'Ver documento' }}</a>
            <button v-if="puedeEditar" type="button" @click="quitarDocumentoOC" class="text-rose-600 text-[10px] hover:underline">Quitar</button>
          </p>
        </div>
      </fieldset>
      <div class="px-6 py-3 border-t bg-slate-50 flex items-center justify-between gap-2">
        <button v-if="isAdmin && ocForm.id" @click="eliminarOC(ocForm)" class="px-3 py-2 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold"><i class="fa-solid fa-trash mr-1"></i> Eliminar</button>
        <span v-else></span>
        <div class="flex gap-2">
          <button @click="cerrarOC" class="px-4 py-2 rounded-lg border font-bold text-slate-600 hover:bg-white">Cerrar</button>
          <button v-if="puedeEditar" @click="guardarOC" :disabled="guardandoOC || subiendoOC" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg shadow disabled:opacity-60"><i :class="['fa-solid mr-1', guardandoOC ? 'fa-spinner fa-spin' : 'fa-floppy-disk']"></i> Guardar OC</button>
        </div>
      </div>
    </div>
  </div>
</section>
`;
