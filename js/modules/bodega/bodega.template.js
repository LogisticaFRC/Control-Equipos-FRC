// Plantilla HTML del módulo BODEGA DE FILTROS (inventario general + ARMAR KIT + movimientos)
export default /* html */ `
<section class="space-y-5 text-xs">
  <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
    <div class="flex flex-wrap justify-between items-center gap-3 border-b pb-3">
      <div>
        <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-warehouse text-teal-600"></i> Bodega de Filtros · Inventario y KITS</h2>
        <p class="text-xs text-slate-500">Inventario general de filtros sueltos. <b>Armar KIT</b> saca filtros del inventario y los junta bajo un código de KIT para un modelo de equipo. Al marcar "Realizado" en Programas → Mantención se descuenta 1 KIT.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button v-if="vistaBodega === 'stock'" @click="exportarStock(exportarCSV)" class="bg-slate-700 hover:bg-slate-800 text-white font-bold px-3 py-2 rounded-lg shadow flex items-center gap-1.5"><i class="fa-solid fa-file-excel"></i> Exportar</button>
        <button v-if="vistaBodega === 'kits'" @click="exportarKits(exportarCSV)" class="bg-slate-700 hover:bg-slate-800 text-white font-bold px-3 py-2 rounded-lg shadow flex items-center gap-1.5"><i class="fa-solid fa-file-excel"></i> Exportar</button>
        <label v-if="isAdmin && vistaBodega === 'stock'" :class="['font-bold px-3 py-2 rounded-lg shadow flex items-center gap-1.5 cursor-pointer text-white', importandoStock ? 'bg-slate-400' : 'bg-sky-600 hover:bg-sky-700']" title="Columnas: CODIGO | TIPO | MARCA | CANTIDAD (se suma a lo que hay)">
          <i :class="['fa-solid', importandoStock ? 'fa-spinner fa-spin' : 'fa-file-import']"></i> {{ importandoStock ? 'Importando...' : 'Importar stock (Excel)' }}
          <input type="file" accept=".xlsx,.xls,.csv" class="hidden" :disabled="importandoStock" @change="importarStockExcel">
        </label>
        <button v-if="puedeEditar" @click="abrirMovStock('INGRESO')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-lg shadow flex items-center gap-1.5"><i class="fa-solid fa-plus"></i> Ingresar filtros</button>
        <button v-if="puedeEditar" @click="abrirKit('nuevo')" class="bg-violet-600 hover:bg-violet-700 text-white font-extrabold px-3 py-2 rounded-lg shadow flex items-center gap-1.5"><i class="fa-solid fa-box-open"></i> ARMAR KIT</button>
      </div>
    </div>

    <!-- Búsqueda -->
    <div class="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-3 bg-slate-50 p-4 rounded-xl border">
      <div class="md:col-span-2"><label class="block font-bold text-slate-700 mb-1">Buscar</label><input type="text" v-model="filtroBodega.texto" placeholder="Código, tipo, marca, kit, modelo..." class="w-full p-2 border rounded-lg bg-white"></div>
      <div>
        <label class="block font-bold text-slate-700 mb-1">Marca Equipo</label>
        <select v-model="filtroBodega.equipoMarca" @change="filtroBodega.equipoModelo = 'ALL'" class="w-full p-2 border rounded-lg bg-white font-semibold"><option value="ALL">-- Todas --</option><option v-for="m in listaMarcasEquipoBodega" :key="m" :value="m">{{ m }}</option></select>
      </div>
      <div>
        <label class="block font-bold text-slate-700 mb-1">Modelo Equipo</label>
        <select v-model="filtroBodega.equipoModelo" class="w-full p-2 border rounded-lg bg-white font-semibold"><option value="ALL">-- Todos --</option><option v-for="m in listaModelosEquipoBodega(filtroBodega.equipoMarca)" :key="m" :value="m">{{ m }}</option></select>
      </div>
      <div>
        <label class="block font-bold text-slate-700 mb-1">Tipo de Filtro</label>
        <select v-model="filtroBodega.tipo" class="w-full p-2 border rounded-lg bg-white font-semibold"><option value="ALL">-- Todos --</option><option v-for="t in listaTiposFiltro" :key="t" :value="t">{{ t }}</option></select>
      </div>
      <div class="flex items-end gap-2">
        <label class="flex items-center gap-1.5 font-bold text-slate-700 p-2 bg-white border rounded-lg flex-grow cursor-pointer"><input type="checkbox" v-model="filtroBodega.soloConStock"> Solo con stock</label>
        <button @click="limpiarFiltroBodega" title="Limpiar" class="px-2 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700"><i class="fa-solid fa-eraser"></i></button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="bg-teal-50 border border-teal-200 p-3 rounded-xl"><p class="text-[10px] font-bold text-teal-800 uppercase">Códigos con stock</p><p class="text-xl font-extrabold text-teal-900">{{ kpisBodega.codigos }}</p></div>
      <div class="bg-emerald-50 border border-emerald-200 p-3 rounded-xl"><p class="text-[10px] font-bold text-emerald-800 uppercase">Filtros sueltos (unidades)</p><p class="text-xl font-extrabold text-emerald-900">{{ fmtCant(kpisBodega.unidades) }}</p></div>
      <div class="bg-violet-50 border border-violet-200 p-3 rounded-xl"><p class="text-[10px] font-bold text-violet-800 uppercase">KITS armados en bodega</p><p class="text-xl font-extrabold text-violet-900">{{ fmtCant(kpisBodega.kits) }}</p></div>
      <div class="bg-sky-50 border border-sky-200 p-3 rounded-xl"><p class="text-[10px] font-bold text-sky-800 uppercase">Códigos de KIT</p><p class="text-xl font-extrabold text-sky-900">{{ kpisBodega.tiposKit }}</p></div>
    </div>

    <!-- Selector de vista -->
    <div class="flex flex-wrap gap-2 border-b pb-2">
      <button @click="vistaBodega = 'stock'" :class="['px-3 py-2 rounded-lg font-bold border transition', vistaBodega === 'stock' ? 'bg-slate-800 text-white border-slate-800 shadow' : 'bg-white text-slate-700 hover:bg-slate-100']"><i class="fa-solid fa-boxes-stacked mr-1"></i> Inventario general ({{ filasStock.length }})</button>
      <button @click="vistaBodega = 'kits'" :class="['px-3 py-2 rounded-lg font-bold border transition', vistaBodega === 'kits' ? 'bg-violet-700 text-white border-violet-700 shadow' : 'bg-white text-slate-700 hover:bg-slate-100']"><i class="fa-solid fa-box-open mr-1"></i> KITS ({{ filasKits.length }})</button>
      <button @click="vistaBodega = 'movimientos'" :class="['px-3 py-2 rounded-lg font-bold border transition', vistaBodega === 'movimientos' ? 'bg-slate-800 text-white border-slate-800 shadow' : 'bg-white text-slate-700 hover:bg-slate-100']"><i class="fa-solid fa-right-left mr-1"></i> Movimientos</button>
    </div>

    <!-- VISTA 1 · INVENTARIO GENERAL -->
    <template v-if="vistaBodega === 'stock'">
      <div v-if="filasStock.length === 0" class="text-center p-10 text-slate-400 font-bold">
        <i class="fa-solid fa-box text-3xl mb-2 block"></i>
        {{ dbBodegaStockVacio ? 'La bodega está vacía. Usa "Ingresar filtros" o "Importar stock (Excel)".' : 'Ningún filtro coincide con la búsqueda.' }}
      </div>
      <div v-else class="overflow-auto border rounded-xl max-h-[70vh]">
        <table class="w-full text-left whitespace-nowrap border-collapse">
          <thead class="uppercase text-[9px] sticky top-0 z-10 bg-slate-800 text-white">
            <tr>
              <th class="p-2">Código</th><th class="p-2">Tipo</th><th class="p-2">Marca</th><th class="p-2 text-right">Cantidad</th>
              <th class="p-2 text-sky-300">Sirve para (módulo Filtros)</th><th class="p-2 text-violet-300">En kits</th>
              <th v-if="puedeEditar" class="p-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y bg-white">
            <tr v-for="s in filasStock" :key="s.id" :class="s.cantidad <= 0 ? 'bg-rose-50/40' : 'hover:bg-teal-50/40'">
              <td class="p-2 font-mono font-extrabold">{{ s.codigo }}</td>
              <td class="p-2 font-bold text-slate-700">{{ s.tipo || '-' }}</td>
              <td class="p-2">{{ s.marca || '-' }}</td>
              <td class="p-2 text-right"><span :class="['font-mono font-extrabold px-2 py-0.5 rounded', s.cantidad > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700']">{{ fmtCant(s.cantidad) }}</span></td>
              <td class="p-2">
                <div class="flex flex-wrap gap-1 max-w-[300px]">
                  <span v-for="m in s.modelos" :key="m" class="text-[9px] font-bold bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">{{ m }}</span>
                  <span v-if="!s.modelos.length" class="text-[10px] text-slate-400 italic">Sin enlazar en Filtros</span>
                </div>
              </td>
              <td class="p-2"><span v-for="k in s.enKits" :key="k" class="text-[9px] font-bold bg-violet-100 text-violet-800 px-1.5 py-0.5 rounded mr-1">{{ k }}</span><span v-if="!s.enKits.length" class="text-slate-300">-</span></td>
              <td v-if="puedeEditar" class="p-2 text-center space-x-1">
                <button @click="abrirMovStock('INGRESO', s)" class="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 p-1 px-1.5 rounded font-bold" title="Ingreso"><i class="fa-solid fa-plus"></i></button>
                <button @click="abrirMovStock('SALIDA', s)" :disabled="s.cantidad <= 0" class="bg-amber-100 hover:bg-amber-200 text-amber-800 p-1 px-1.5 rounded font-bold disabled:opacity-40" title="Salida"><i class="fa-solid fa-minus"></i></button>
                <button v-if="isAdmin" @click="abrirMovStock('AJUSTE', s)" class="bg-sky-100 hover:bg-sky-200 text-sky-800 p-1 px-1.5 rounded font-bold" title="Ajustar / editar"><i class="fa-solid fa-pen-to-square"></i></button>
                <button v-if="isAdmin" @click="eliminarStock(s)" class="bg-rose-100 hover:bg-rose-200 text-rose-800 p-1 px-1.5 rounded font-bold" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- VISTA 2 · KITS -->
    <div v-if="vistaBodega === 'kits'" class="space-y-4">
      <div v-if="filasKits.length === 0" class="text-center p-10 text-slate-400 font-bold">
        <i class="fa-solid fa-box-open text-3xl mb-2 block"></i>
        No hay kits{{ filtroBodega.equipoMarca !== 'ALL' || filtroBodega.equipoModelo !== 'ALL' ? ' para este modelo' : '' }}. Usa <b>ARMAR KIT</b>.
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div v-for="k in filasKits" :key="k.id" class="border rounded-xl overflow-hidden shadow-sm">
          <div class="bg-violet-800 text-white px-4 py-2.5 flex flex-wrap justify-between items-center gap-2">
            <div>
              <p class="font-extrabold text-sm font-mono"><i class="fa-solid fa-box-open text-violet-300 mr-1.5"></i>{{ k.codigo }}</p>
              <p class="text-[10px] text-violet-200"><i class="fa-solid fa-truck-monster mr-1"></i>{{ k.equipoMarca || 'SIN MARCA' }} · {{ k.equipoModelo || 'SIN MODELO' }}<span v-if="k.descripcion"> — {{ k.descripcion }}</span></p>
            </div>
            <div class="text-right">
              <span :class="['inline-block font-extrabold text-base px-3 py-0.5 rounded-lg', k.cantidad > 0 ? 'bg-emerald-400 text-slate-900' : 'bg-rose-500 text-white']">{{ k.cantidad }}</span>
              <p class="text-[9px] text-violet-200 mt-0.5">en bodega</p>
            </div>
          </div>
          <div v-if="k.equipos.length" class="px-4 py-1.5 bg-violet-50 border-b flex flex-wrap gap-1 items-center">
            <span class="text-[10px] text-slate-500 mr-1">Equipos:</span>
            <button v-for="e in k.equipos" :key="e.id" @click="abrirPerfilEquipo(e)" class="text-[10px] font-mono font-bold bg-amber-500 hover:bg-amber-400 text-slate-900 px-1.5 py-0.5 rounded">{{ e.afi }}</button>
          </div>
          <table class="w-full text-left whitespace-nowrap">
            <thead class="bg-slate-100 text-slate-600 uppercase text-[9px]"><tr><th class="p-2">Filtro</th><th class="p-2">Tipo</th><th class="p-2">Marca</th><th class="p-2 text-center">Por kit</th><th class="p-2 text-right">Suelto en bodega</th></tr></thead>
            <tbody class="divide-y">
              <tr v-for="i in k.items" :key="i.id">
                <td class="p-2 font-mono font-bold">{{ i.codigo }}</td><td class="p-2">{{ i.tipo || '-' }}</td><td class="p-2">{{ i.marca || '-' }}</td>
                <td class="p-2 text-center font-extrabold text-violet-800">{{ i.cantidad }}</td>
                <td class="p-2 text-right font-mono" :class="i.disponible >= i.cantidad ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'">{{ i.disponible }}</td>
              </tr>
            </tbody>
          </table>
          <div class="px-4 py-2 bg-slate-50 border-t flex flex-wrap justify-between items-center gap-2">
            <span class="text-[10px] text-slate-500">{{ k.totalFiltros }} filtros por kit · con lo suelto se pueden armar <b :class="k.armables > 0 ? 'text-emerald-700' : 'text-rose-600'">{{ k.armables }}</b> más</span>
            <div v-if="puedeEditar" class="flex gap-1">
              <button @click="abrirKit('armar', k)" :disabled="k.armables <= 0" class="bg-violet-600 hover:bg-violet-700 text-white font-bold px-2.5 py-1 rounded disabled:opacity-40"><i class="fa-solid fa-plus"></i> Armar más</button>
              <button v-if="isAdmin" @click="desarmarKit(k)" :disabled="k.cantidad <= 0" class="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold px-2.5 py-1 rounded disabled:opacity-40" title="Devolver filtros al inventario general"><i class="fa-solid fa-box"></i> Desarmar</button>
              <button v-if="isAdmin" @click="abrirKit('editar', k)" class="bg-sky-100 hover:bg-sky-200 text-sky-800 font-bold px-2 py-1 rounded" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
              <button v-if="isAdmin" @click="eliminarKit(k)" class="bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold px-2 py-1 rounded" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- VISTA 3 · MOVIMIENTOS -->
    <div v-if="vistaBodega === 'movimientos'" class="overflow-auto border rounded-xl max-h-[70vh]">
      <table class="w-full text-left whitespace-nowrap">
        <thead class="uppercase text-[9px] sticky top-0 bg-slate-800 text-white"><tr><th class="p-2">Fecha</th><th class="p-2">Movimiento</th><th class="p-2">Código</th><th class="p-2 text-right">Cantidad</th><th class="p-2">Detalle</th><th class="p-2">Usuario</th></tr></thead>
        <tbody class="divide-y bg-white">
          <tr v-for="m in filasMovBodega" :key="m.id" class="hover:bg-slate-50">
            <td class="p-2 font-mono text-slate-600">{{ fmtFechaHora(m.fecha) }}</td>
            <td class="p-2"><span :class="['text-[10px] font-bold px-2 py-0.5 rounded', m.esKit ? 'bg-violet-100 text-violet-800' : 'bg-slate-100 text-slate-700']">{{ m.tipoMov }}</span></td>
            <td class="p-2 font-mono font-bold">{{ m.codigo }}<span v-if="m.esKit" class="ml-1 text-[9px] text-violet-600">(KIT)</span></td>
            <td class="p-2 text-right font-mono font-extrabold" :class="m.cantidad >= 0 ? 'text-emerald-700' : 'text-rose-600'">{{ m.cantidad > 0 ? '+' : '' }}{{ m.cantidad }}</td>
            <td class="p-2 text-slate-600">{{ m.detalle || '-' }}</td>
            <td class="p-2 text-slate-500">{{ m.usuario || '-' }}</td>
          </tr>
          <tr v-if="!filasMovBodega.length"><td colspan="6" class="p-8 text-center text-slate-400 font-bold">Sin movimientos.</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- MODAL INGRESO / SALIDA / AJUSTE -->
  <div v-if="showModalStock && formStock" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl border w-full max-w-lg overflow-hidden">
      <div :class="['px-6 py-4 border-b flex items-center justify-between text-white', formStock.modo === 'INGRESO' ? 'bg-emerald-700' : formStock.modo === 'SALIDA' ? 'bg-amber-600' : 'bg-sky-700']">
        <h3 class="text-sm font-bold"><i class="fa-solid fa-warehouse mr-1.5"></i> {{ formStock.modo === 'INGRESO' ? 'Ingreso a bodega' : formStock.modo === 'SALIDA' ? 'Salida de bodega' : 'Ajuste / editar filtro' }}</h3>
        <button @click="showModalStock = false" class="text-white/80 hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="p-6 space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2"><label class="block font-bold mb-1">Código *</label><input type="text" list="dl-bod-codigos" v-model="formStock.codigo" :disabled="formStock.bloqueado" @change="autocompletarStock" placeholder="P550388" class="w-full p-2 border rounded-lg font-mono font-bold uppercase disabled:bg-slate-100"></div>
          <div><label class="block font-bold mb-1">Tipo {{ formStock.modo === 'INGRESO' ? '*' : '' }}</label><input type="text" list="dl-bod-tipos" v-model="formStock.tipo" :disabled="formStock.modo === 'SALIDA'" class="w-full p-2 border rounded-lg uppercase disabled:bg-slate-100"></div>
          <div><label class="block font-bold mb-1">Marca</label><input type="text" v-model="formStock.marca" :disabled="formStock.modo === 'SALIDA'" class="w-full p-2 border rounded-lg uppercase disabled:bg-slate-100"></div>
          <div>
            <label class="block font-bold mb-1">{{ formStock.modo === 'AJUSTE' ? 'Cantidad real (conteo)' : 'Cantidad *' }}</label>
            <input type="number" min="0" step="1" v-model="formStock.cantidad" class="w-full p-2 border-2 border-slate-300 rounded-lg font-mono font-extrabold text-right text-base">
          </div>
          <div class="flex items-end"><p class="text-[11px] text-slate-500">En bodega: <b class="font-mono text-slate-800">{{ disponibleDe(formStock.codigo) }}</b></p></div>
          <div class="col-span-2"><label class="block font-bold mb-1">Detalle / documento</label><input type="text" v-model="formStock.detalle" placeholder="Ej: Factura 1234 SIKAR, uso en terreno AFI 105..." class="w-full p-2 border rounded-lg"></div>
        </div>
        <p v-if="sirveParaCodigo(formStock.codigo).length" class="text-[10px] text-sky-800 bg-sky-50 border border-sky-200 rounded p-2"><i class="fa-solid fa-truck-monster"></i> Sirve para: {{ sirveParaCodigo(formStock.codigo).join(' · ') }}</p>
      </div>
      <div class="px-6 py-3 border-t bg-slate-100 flex justify-end gap-2">
        <button @click="showModalStock = false" class="bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold px-4 py-2 rounded-lg">Cancelar</button>
        <button @click="guardarMovStock" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-lg shadow"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
      </div>
    </div>
  </div>

  <!-- MODAL ARMAR / EDITAR KIT -->
  <div v-if="showModalKit && formKit" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl border w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
      <div class="px-6 py-4 border-b flex items-center justify-between bg-violet-800 text-white">
        <h3 class="text-sm font-bold flex items-center gap-2"><i class="fa-solid fa-box-open text-violet-300"></i>
          {{ formKit.modo === 'nuevo' ? 'ARMAR KIT nuevo' : formKit.modo === 'armar' ? 'Armar más kits ' + formKit.original : 'Editar kit ' + formKit.original }}
        </h3>
        <button @click="showModalKit = false" class="text-violet-200 hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="p-6 space-y-5 overflow-y-auto">
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div><label class="block font-bold mb-1">Marca equipo *</label><input type="text" list="dl-bod-eqmarca" v-model="formKit.equipoMarca" :disabled="formKit.modo === 'armar'" class="w-full p-2 border rounded-lg uppercase disabled:bg-slate-100"></div>
          <div><label class="block font-bold mb-1">Modelo equipo *</label><input type="text" list="dl-bod-eqmodelo" v-model="formKit.equipoModelo" :disabled="formKit.modo === 'armar'" class="w-full p-2 border rounded-lg uppercase disabled:bg-slate-100"></div>
          <div>
            <label class="block font-bold mb-1">Código del KIT *</label>
            <div class="flex gap-1">
              <input type="text" v-model="formKit.codigo" :disabled="formKit.modo === 'armar'" placeholder="KIT-320D-01" class="w-full p-2 border rounded-lg font-mono font-bold uppercase disabled:bg-slate-100">
              <button v-if="formKit.modo !== 'armar'" @click="formKit.codigo = sugerirCodigoKit(formKit.equipoMarca, formKit.equipoModelo)" type="button" title="Sugerir código" class="px-2 rounded-lg bg-slate-200 hover:bg-slate-300"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
            </div>
          </div>
          <div v-if="formKit.modo !== 'editar'">
            <label class="block font-bold mb-1 text-violet-800">N° de kits a armar *</label>
            <input type="number" min="1" step="1" v-model="formKit.nKits" class="w-full p-2 border-2 border-violet-400 bg-violet-50 rounded-lg font-mono font-extrabold text-right text-base">
          </div>
          <div :class="formKit.modo === 'editar' ? 'sm:col-span-1' : 'sm:col-span-4'"><label class="block font-bold mb-1">Descripción</label><input type="text" v-model="formKit.descripcion" :disabled="formKit.modo === 'armar'" placeholder="Ej: Kit mantención 500 hrs" class="w-full p-2 border rounded-lg disabled:bg-slate-100"></div>
        </div>

        <div class="bg-violet-50/60 border border-violet-200 rounded-xl p-4 space-y-3">
          <div class="flex flex-wrap justify-between items-center gap-2">
            <h4 class="font-bold text-violet-900 uppercase"><i class="fa-solid fa-filter"></i> Filtros que lleva 1 kit</h4>
            <div v-if="composicionEditable" class="flex gap-2">
              <button @click="cargarFiltrosDelModeloEnKit" type="button" class="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-1 rounded-lg" title="Trae los tipos, cantidades y códigos del módulo Filtros para esa marca / modelo"><i class="fa-solid fa-wand-magic-sparkles"></i> Cargar filtros del modelo</button>
              <button @click="agregarItemKit" type="button" class="bg-violet-600 hover:bg-violet-700 text-white font-bold px-3 py-1 rounded-lg"><i class="fa-solid fa-plus"></i> Agregar filtro</button>
            </div>
          </div>
          <p v-if="!composicionEditable" class="text-[10px] text-violet-800"><i class="fa-solid fa-lock"></i> {{ formKit.modo === 'armar' ? 'Se usa la composición guardada del kit.' : 'La composición solo se puede cambiar cuando no hay kits armados (desármalos primero).' }}</p>
          <div v-for="(it, i) in formKit.items" :key="i" class="grid grid-cols-2 md:grid-cols-12 gap-2 items-end bg-white p-2 rounded-lg border">
            <div class="md:col-span-3">
              <label class="block text-[10px] font-bold text-slate-600">Código filtro</label>
              <input type="text" :list="'dl-bod-alt-' + i" v-model="it.codigo" :disabled="!composicionEditable" @change="autocompletarItemKit(it)" class="w-full p-1.5 border rounded font-mono font-bold uppercase disabled:bg-slate-100">
              <datalist :id="'dl-bod-alt-' + i"><option v-for="c in (it.alternativas || listaCodigosEnStock)" :key="c" :value="c">{{ c }} · bodega {{ disponibleDe(c) }}</option></datalist>
            </div>
            <div class="md:col-span-3"><label class="block text-[10px] font-bold text-slate-600">Tipo</label><input type="text" list="dl-bod-tipos" v-model="it.tipo" :disabled="!composicionEditable" class="w-full p-1.5 border rounded uppercase disabled:bg-slate-100"></div>
            <div class="md:col-span-2"><label class="block text-[10px] font-bold text-slate-600">Marca</label><input type="text" v-model="it.marca" :disabled="!composicionEditable" class="w-full p-1.5 border rounded uppercase disabled:bg-slate-100"></div>
            <div class="md:col-span-1"><label class="block text-[10px] font-bold text-violet-700">Por kit</label><input type="number" min="1" v-model="it.cantidad" :disabled="!composicionEditable" class="w-full p-1.5 border border-violet-300 bg-violet-50 rounded font-mono font-bold disabled:bg-slate-100"></div>
            <div class="md:col-span-2 text-right">
              <p class="text-[10px] text-slate-500">En bodega</p>
              <p :class="['font-mono font-extrabold', disponibleDe(it.codigo) >= (Number(it.cantidad) || 0) * (formKit.modo === 'editar' ? 0 : (Number(formKit.nKits) || 0)) ? 'text-emerald-700' : 'text-rose-600']">{{ disponibleDe(it.codigo) }}<span v-if="formKit.modo !== 'editar'" class="text-slate-400 font-normal"> / usa {{ (Number(it.cantidad) || 0) * (Number(formKit.nKits) || 0) }}</span></p>
            </div>
            <div class="md:col-span-1 flex justify-end"><button v-if="composicionEditable" @click="quitarItemKit(i)" type="button" class="bg-rose-100 hover:bg-rose-200 text-rose-700 px-2.5 py-1.5 rounded font-bold"><i class="fa-solid fa-trash"></i></button></div>
          </div>
          <p v-if="!formKit.items.length" class="text-slate-500 italic">Sin filtros. Usa "Cargar filtros del modelo" o "Agregar filtro".</p>
          <label v-if="composicionEditable" class="flex items-center gap-1.5 text-[11px] text-slate-700"><input type="checkbox" v-model="formKit.enlazarFiltros"> Enlazar estos códigos a la marca / modelo en el módulo <b>Filtros</b> (si aún no lo están)</label>
        </div>

        <div v-if="faltantesKit.length" class="bg-rose-50 border border-rose-300 text-rose-800 rounded-xl p-3">
          <p class="font-bold mb-1"><i class="fa-solid fa-triangle-exclamation"></i> Stock insuficiente en el inventario general:</p>
          <p v-for="x in faltantesKit" :key="x.codigo" class="font-mono">{{ x.codigo }}: se necesitan {{ x.necesita }}, hay {{ x.hay }}</p>
        </div>
        <p v-else-if="formKit.modo !== 'editar'" class="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3"><i class="fa-solid fa-circle-check"></i> Al guardar se descuentan los filtros del inventario general y quedan <b>{{ Number(formKit.nKits) || 0 }}</b> kit(s) más de <b class="font-mono">{{ formKit.codigo || '(sin código)' }}</b> en bodega.</p>
      </div>
      <div class="px-6 py-3 border-t bg-slate-100 flex justify-between gap-2">
        <button v-if="isAdmin && formKit.modo === 'editar'" @click="eliminarKit(dbKitPorId(formKit.kitId))" class="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-lg"><i class="fa-solid fa-trash"></i> Eliminar kit</button>
        <span v-else></span>
        <div class="flex gap-2">
          <button @click="showModalKit = false" class="bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold px-4 py-2 rounded-lg">Cancelar</button>
          <button @click="guardarKit" :disabled="guardandoKit || faltantesKit.length > 0" class="bg-violet-600 hover:bg-violet-700 text-white font-bold px-5 py-2 rounded-lg shadow disabled:opacity-50">
            <i :class="['fa-solid', guardandoKit ? 'fa-spinner fa-spin' : (formKit.modo === 'editar' ? 'fa-floppy-disk' : 'fa-box-open')]"></i> {{ formKit.modo === 'editar' ? 'Guardar' : 'Armar KIT' }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <datalist id="dl-bod-codigos"><option v-for="c in listaCodigosConocidos" :key="c" :value="c"></option></datalist>
  <datalist id="dl-bod-tipos"><option v-for="t in listaTiposFiltro" :key="t" :value="t"></option></datalist>
  <datalist id="dl-bod-eqmarca"><option v-for="m in listaMarcasEquipoBodega" :key="m" :value="m"></option></datalist>
  <datalist id="dl-bod-eqmodelo"><option v-for="m in listaModelosEquipoBodega(formKit ? formKit.equipoMarca : 'ALL')" :key="m" :value="m"></option></datalist>
</section>
`;
