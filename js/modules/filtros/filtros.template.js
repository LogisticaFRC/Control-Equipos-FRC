// Plantilla HTML del módulo FILTROS (comparativo de precios por proveedor + referencia cruzada por equipo)
export default /* html */ `
<section class="space-y-5 text-xs">
  <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
    <div class="flex flex-wrap justify-between items-center gap-3 border-b pb-3">
      <div>
        <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-filter text-emerald-600"></i> Filtros · Comparativo de Precios y Referencias Cruzadas</h2>
        <p class="text-xs text-slate-500">La lista de precios se importa desde Excel o se edita aquí. Los equipos se enlazan solos al registrar filtros en una mantención (o a mano al editar un código).</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button @click="exportarComparativo(exportarCSV)" class="bg-slate-700 hover:bg-slate-800 text-white font-bold px-3 py-2 rounded-lg shadow flex items-center gap-1.5"><i class="fa-solid fa-file-excel"></i> Exportar</button>
        <label v-if="isAdmin" :class="['font-bold px-3 py-2 rounded-lg shadow flex items-center gap-1.5 cursor-pointer text-white', importandoPrecios ? 'bg-slate-400' : 'bg-sky-600 hover:bg-sky-700']">
          <i :class="['fa-solid', importandoPrecios ? 'fa-spinner fa-spin' : 'fa-file-import']"></i> {{ importandoPrecios ? 'Importando...' : 'Importar lista de precios (Excel)' }}
          <input type="file" accept=".xlsx,.xls,.csv" class="hidden" :disabled="importandoPrecios" @change="importarPreciosExcel">
        </label>
        <button v-if="puedeEditar" @click="nuevoCodigo()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-lg shadow flex items-center gap-1.5"><i class="fa-solid fa-plus"></i> Agregar Filtro</button>
      </div>
    </div>

    <!-- Filtros de búsqueda -->
    <div class="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-3 bg-slate-50 p-4 rounded-xl border">
      <div class="md:col-span-2"><label class="block font-bold text-slate-700 mb-1">Buscar</label><input type="text" v-model="filtroVista.texto" placeholder="Código, marca, tipo, proveedor, modelo..." class="w-full p-2 border rounded-lg bg-white"></div>
      <div>
        <label class="block font-bold text-slate-700 mb-1">Marca Equipo</label>
        <select v-model="filtroVista.equipoMarca" @change="filtroVista.equipoModelo = 'ALL'" class="w-full p-2 border rounded-lg bg-white font-semibold"><option value="ALL">-- Todas --</option><option v-for="m in listaMarcasEquipoFiltros" :key="m" :value="m">{{ m }}</option></select>
      </div>
      <div>
        <label class="block font-bold text-slate-700 mb-1">Modelo Equipo</label>
        <select v-model="filtroVista.equipoModelo" class="w-full p-2 border rounded-lg bg-white font-semibold"><option value="ALL">-- Todos --</option><option v-for="m in listaModelosEquipoFiltros" :key="m" :value="m">{{ m }}</option></select>
      </div>
      <div>
        <label class="block font-bold text-slate-700 mb-1">Tipo de Filtro</label>
        <select v-model="filtroVista.tipo" class="w-full p-2 border rounded-lg bg-white font-semibold"><option value="ALL">-- Todos --</option><option v-for="t in listaTiposFiltro" :key="t" :value="t">{{ t }}</option></select>
      </div>
      <div>
        <label class="block font-bold text-slate-700 mb-1">Proveedor</label>
        <div class="flex gap-1">
          <select v-model="filtroVista.proveedor" class="w-full p-2 border rounded-lg bg-white font-semibold"><option value="ALL">-- Todos --</option><option v-for="p in listaProveedoresFiltro" :key="p" :value="p">{{ p }}</option></select>
          <button @click="limpiarFiltroVista" title="Limpiar" class="px-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700"><i class="fa-solid fa-eraser"></i></button>
        </div>
      </div>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="bg-emerald-50 border border-emerald-200 p-3 rounded-xl"><p class="text-[10px] font-bold text-emerald-800 uppercase">Códigos de filtro</p><p class="text-xl font-extrabold text-emerald-900">{{ kpisFiltros.codigos }}</p></div>
      <div class="bg-amber-50 border border-amber-200 p-3 rounded-xl"><p class="text-[10px] font-bold text-amber-800 uppercase">Proveedores</p><p class="text-xl font-extrabold text-amber-900">{{ kpisFiltros.proveedores }}</p></div>
      <div class="bg-sky-50 border border-sky-200 p-3 rounded-xl"><p class="text-[10px] font-bold text-sky-800 uppercase">Modelos de equipo enlazados</p><p class="text-xl font-extrabold text-sky-900">{{ kpisFiltros.modelos }}</p></div>
      <div class="bg-violet-50 border border-violet-200 p-3 rounded-xl"><p class="text-[10px] font-bold text-violet-800 uppercase">Tipos con ref. cruzada</p><p class="text-xl font-extrabold text-violet-900">{{ kpisFiltros.cruzadas }}</p></div>
    </div>

    <!-- Selector de vista -->
    <div class="flex flex-wrap gap-2 border-b pb-2">
      <button @click="vistaFiltros = 'precios'" :class="['px-3 py-2 rounded-lg font-bold border transition', vistaFiltros === 'precios' ? 'bg-slate-800 text-white border-slate-800 shadow' : 'bg-white text-slate-700 hover:bg-slate-100']"><i class="fa-solid fa-scale-balanced mr-1"></i> Comparativo de precios por proveedor ({{ filasComparativo.length }})</button>
      <button @click="vistaFiltros = 'cruzada'" :class="['px-3 py-2 rounded-lg font-bold border transition', vistaFiltros === 'cruzada' ? 'bg-slate-800 text-white border-slate-800 shadow' : 'bg-white text-slate-700 hover:bg-slate-100']"><i class="fa-solid fa-code-compare mr-1"></i> Referencia cruzada por equipo ({{ gruposPorModelo.length }})</button>
    </div>

    <!-- VISTA 1 · COMPARATIVO DE PRECIOS (igual a la planilla) -->
    <template v-if="vistaFiltros === 'precios'">
      <div v-if="filasComparativo.length === 0" class="text-center p-10 text-slate-400 font-bold">
        <i class="fa-solid fa-filter-circle-xmark text-3xl mb-2 block"></i>
        {{ catalogo.size ? 'Ningún filtro coincide con la búsqueda.' : 'Aún no hay lista de precios. Usa "Importar lista de precios (Excel)" o "Agregar Filtro".' }}
      </div>
      <div v-else class="overflow-auto border rounded-xl max-h-[70vh]">
        <table class="w-full text-left whitespace-nowrap border-collapse">
          <thead class="uppercase text-[9px] sticky top-0 z-10">
            <tr class="bg-slate-900 text-white">
              <th colspan="3" class="p-1.5"></th>
              <th :colspan="proveedoresColumnas.length" class="p-1.5 text-center text-amber-300 tracking-widest border-x border-slate-700">Proveedores filtros</th>
              <th colspan="4" class="p-1.5"></th>
            </tr>
            <tr class="bg-slate-800 text-white">
              <th class="p-2">Código</th><th class="p-2">Marca</th><th class="p-2">Tipo</th>
              <th v-for="p in proveedoresColumnas" :key="p" :class="['p-2 text-right', filtroVista.proveedor === p ? 'text-amber-200 bg-slate-700' : 'text-amber-300']">{{ p }}</th>
              <th class="p-2 text-emerald-300">Mejor</th><th class="p-2 text-right text-rose-300">Ahorro</th><th class="p-2 text-sky-300">Equipos (marca / modelo)</th>
              <th v-if="puedeEditar" class="p-2 text-center">Editar</th>
            </tr>
          </thead>
          <tbody class="divide-y bg-white">
            <tr v-for="c in filasComparativo" :key="c.codigo" class="hover:bg-amber-50/40">
              <td class="p-2 font-mono font-extrabold">{{ c.codigo }}</td>
              <td class="p-2">{{ c.marca || '-' }}</td>
              <td class="p-2 font-bold text-slate-700">{{ c.tipo || '-' }}</td>
              <td v-for="p in proveedoresColumnas" :key="p" :class="['p-2 text-right font-mono', c.precios[p] && c.precios[p].precio === c.min && c.nPrecios > 1 ? 'bg-emerald-100 text-emerald-800 font-extrabold' : (c.precios[p] ? 'text-slate-800' : 'text-slate-300')]" :title="c.precios[p] ? 'Precio al ' + fmtFecha(c.precios[p].fechaPrecio) : ''">{{ c.precios[p] ? fmtPrecio(c.precios[p].precio) : '·' }}</td>
              <td class="p-2 font-bold text-emerald-700">{{ c.mejorProveedor ? c.mejorProveedor + ' ' + fmtPrecio(c.min) : '-' }}</td>
              <td class="p-2 text-right font-mono font-bold" :class="c.ahorro > 0 ? 'text-rose-600' : 'text-slate-300'">{{ c.ahorro > 0 ? fmtPrecio(c.ahorro) : '-' }}</td>
              <td class="p-2">
                <div class="flex flex-wrap gap-1 max-w-[260px]">
                  <span v-for="m in c.modelos" :key="m" class="text-[9px] font-bold bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">{{ m }}</span>
                  <span v-if="!c.modelos.length" class="text-[10px] text-slate-400 italic">Sin enlazar</span>
                </div>
              </td>
              <td v-if="puedeEditar" class="p-2 text-center">
                <button @click="editarCodigo(c)" class="bg-amber-100 hover:bg-amber-200 text-amber-800 p-1 px-1.5 rounded font-bold" title="Editar precios y equipos"><i class="fa-solid fa-pen-to-square"></i></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-[10px] text-slate-500"><span class="inline-block w-3 h-3 align-middle rounded bg-emerald-100 border border-emerald-300"></span> Precio más bajo del código. Pasa el mouse sobre un precio para ver su fecha.</p>
    </template>

    <!-- VISTA 2 · REFERENCIA CRUZADA POR MODELO DE EQUIPO -->
    <div v-if="vistaFiltros === 'cruzada'" class="space-y-4">
      <div v-if="gruposPorModelo.length === 0" class="text-center p-10 text-slate-400 font-bold">
        <i class="fa-solid fa-link-slash text-3xl mb-2 block"></i>
        Aún no hay filtros enlazados a equipos{{ filtroVista.equipoMarca !== 'ALL' || filtroVista.equipoModelo !== 'ALL' ? ' para este modelo' : '' }}.
        <span class="block font-normal mt-1">Se enlazan al registrar los filtros en una mantención, o con <i class="fa-solid fa-pen-to-square"></i> Editar → "Equipos que lo usan".</span>
      </div>
      <div v-for="g in gruposPorModelo" :key="g.key" class="border rounded-xl overflow-hidden">
        <div class="bg-slate-800 text-white px-4 py-2.5 flex flex-wrap justify-between items-center gap-2">
          <p class="font-extrabold text-sm"><i class="fa-solid fa-truck-monster text-amber-400 mr-1.5"></i>{{ g.marca || 'SIN MARCA' }} · {{ g.modelo || 'SIN MODELO' }}</p>
          <div class="flex flex-wrap gap-1 items-center">
            <span class="text-[10px] text-slate-300 mr-1">{{ g.equipos.length }} equipo(s):</span>
            <button v-for="e in g.equipos" :key="e.id" @click="abrirPerfilEquipo(e)" class="text-[10px] font-mono font-bold bg-amber-500 hover:bg-amber-400 text-slate-900 px-1.5 py-0.5 rounded">{{ e.afi }}</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left whitespace-nowrap border-collapse">
            <thead class="bg-slate-100 text-slate-600 uppercase text-[9px]">
              <tr>
                <th class="p-2">Tipo</th><th class="p-2">Código</th><th class="p-2">Marca Filtro</th><th class="p-2">Mejor proveedor</th>
                <th class="p-2 text-right">Mejor precio</th><th class="p-2 text-right">Dif. vs más barato</th><th class="p-2 text-center">N° prov.</th><th class="p-2">Último uso</th>
                <th v-if="puedeEditar" class="p-2 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="t in g.tipos" :key="t.tipo">
                <tr v-for="(r, idx) in t.filas" :key="r.id" :class="['border-t', r.esMejor ? 'bg-emerald-50' : 'bg-white hover:bg-slate-50']">
                  <td v-if="idx === 0" :rowspan="t.filas.length" class="p-2 align-top font-extrabold text-slate-800 bg-slate-50 border-r">
                    {{ t.tipo }}
                    <span v-if="t.codigos > 1" class="block mt-1 text-[9px] font-bold text-violet-700 bg-violet-100 rounded px-1.5 py-0.5 w-max"><i class="fa-solid fa-code-compare"></i> {{ t.codigos }} códigos equivalentes</span>
                  </td>
                  <td class="p-2 font-mono font-extrabold text-slate-900">{{ r.codigo }}</td>
                  <td class="p-2">{{ r.marca || '-' }}</td>
                  <td class="p-2 font-semibold">{{ r.proveedor || '-' }}</td>
                  <td class="p-2 text-right font-mono font-bold" :class="r.esMejor ? 'text-emerald-700' : 'text-slate-800'">{{ fmtPrecio(r.precio) }} <i v-if="r.esMejor && t.codigos > 1" class="fa-solid fa-trophy text-emerald-600 ml-1" title="El más barato de este tipo"></i></td>
                  <td class="p-2 text-right font-mono" :class="r.difMejor > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'">{{ r.difMejor > 0 ? '+' + fmtPrecio(r.difMejor) : '-' }}</td>
                  <td class="p-2 text-center">{{ r.nPrecios || '-' }}</td>
                  <td class="p-2 font-mono text-slate-500">{{ fmtFecha(r.ultimoUso) }}<span v-if="r.ultimoAfi" class="ml-1 text-amber-700">(AFI {{ r.ultimoAfi }})</span></td>
                  <td v-if="puedeEditar" class="p-2 text-center space-x-1">
                    <button @click="editarCodigo(r.codigo)" class="bg-amber-100 hover:bg-amber-200 text-amber-800 p-1 rounded font-bold" title="Editar precios y equipos"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button v-if="isAdmin" @click="quitarAplicacion(r, g.marca + ' ' + g.modelo)" class="bg-rose-100 hover:bg-rose-200 text-rose-800 p-1 rounded font-bold" title="Quitar de este modelo"><i class="fa-solid fa-link-slash"></i></button>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL EDITAR / AGREGAR CÓDIGO -->
  <div v-if="showModalCodigo && formCodigo" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl border w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
      <div class="px-6 py-4 border-b flex items-center justify-between bg-slate-800 text-white">
        <h3 class="text-sm font-bold flex items-center gap-2"><i class="fa-solid fa-filter text-emerald-400"></i> {{ formCodigo.original ? 'Editar Filtro ' + formCodigo.original : 'Agregar Filtro' }}</h3>
        <button @click="showModalCodigo = false" class="text-slate-300 hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="p-6 space-y-5 overflow-y-auto">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label class="block font-bold mb-1">Código *</label><input type="text" v-model="formCodigo.codigo" placeholder="P550388" class="w-full p-2 border rounded-lg font-mono font-bold uppercase"></div>
          <div><label class="block font-bold mb-1">Marca Filtro</label><input type="text" list="dl-fil-marcas" v-model="formCodigo.marca" placeholder="DONALDSON" class="w-full p-2 border rounded-lg uppercase"></div>
          <div><label class="block font-bold mb-1">Tipo *</label><input type="text" list="dl-fil-tipos" v-model="formCodigo.tipo" placeholder="ACEITE MOTOR" class="w-full p-2 border rounded-lg uppercase"></div>
        </div>

        <!-- Precios por proveedor -->
        <div class="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-3">
          <div class="flex flex-wrap justify-between items-center gap-2">
            <h4 class="font-bold text-amber-900 uppercase"><i class="fa-solid fa-tags"></i> Precio por proveedor <span class="normal-case font-normal text-amber-800">(dejar vacío = no lo vende)</span></h4>
            <div class="flex gap-1">
              <input type="text" list="dl-fil-prov" v-model="formCodigo.nuevoProveedor" @keyup.enter="agregarProveedorForm" placeholder="Nuevo proveedor..." class="p-1.5 border rounded-lg uppercase w-40">
              <button @click="agregarProveedorForm" type="button" class="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-2.5 rounded-lg"><i class="fa-solid fa-plus"></i></button>
            </div>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            <div v-for="(v, p) in formCodigo.precios" :key="p">
              <label class="block text-[10px] font-bold text-slate-600 truncate" :title="p">{{ p }}</label>
              <input type="number" min="0" v-model="formCodigo.precios[p]" placeholder="—" :class="['w-full p-1.5 border rounded font-mono font-bold text-right', Number(v) > 0 ? 'bg-white' : 'bg-slate-50']">
            </div>
          </div>
        </div>

        <!-- Equipos que lo usan -->
        <div class="bg-sky-50/60 border border-sky-200 rounded-xl p-4 space-y-3">
          <div class="flex flex-wrap justify-between items-center gap-2">
            <h4 class="font-bold text-sky-900 uppercase"><i class="fa-solid fa-truck-monster"></i> Equipos que lo usan (marca / modelo)</h4>
            <button @click="agregarAplicacionForm" type="button" class="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-1 rounded-lg"><i class="fa-solid fa-plus"></i> Enlazar equipo</button>
          </div>
          <p v-if="!formCodigo.aplicaciones.length" class="text-slate-500 italic">Sin equipos enlazados. Se enlazan solos al registrar este filtro en una mantención.</p>
          <div v-for="(a, i) in formCodigo.aplicaciones" :key="i" class="grid grid-cols-2 md:grid-cols-9 gap-2 items-end bg-white p-2 rounded-lg border">
            <div class="md:col-span-2"><label class="block text-[10px] font-bold text-slate-600">Marca equipo</label><input type="text" list="dl-fil-eqmarca" v-model="a.equipoMarca" class="w-full p-1.5 border rounded uppercase"></div>
            <div class="md:col-span-2"><label class="block text-[10px] font-bold text-slate-600">Modelo equipo</label><input type="text" list="dl-fil-eqmodelo" v-model="a.equipoModelo" class="w-full p-1.5 border rounded uppercase"></div>
            <div class="md:col-span-3"><label class="block text-[10px] font-bold text-slate-600">Tipo en ese equipo</label><input type="text" list="dl-fil-tipos" v-model="a.tipo" class="w-full p-1.5 border rounded uppercase"></div>
            <div><label class="block text-[10px] font-bold text-violet-700">Cantidad</label><input type="number" min="1" v-model="a.cantidad" class="w-full p-1.5 border border-violet-300 bg-violet-50 rounded font-mono font-bold"></div>
            <div class="flex justify-end"><button @click="quitarAplicacionForm(i)" type="button" class="bg-rose-100 hover:bg-rose-200 text-rose-700 px-2.5 py-1.5 rounded font-bold"><i class="fa-solid fa-trash"></i></button></div>
          </div>
          <p class="text-[10px] text-slate-500"><i class="fa-solid fa-circle-info text-sky-600"></i> La <b>cantidad</b> es la que ve el Perfil de Equipo y vale para todos los códigos de ese tipo en ese modelo.</p>
        </div>
      </div>
      <div class="px-6 py-3 border-t bg-slate-100 flex justify-between gap-2">
        <button v-if="isAdmin && formCodigo.original" @click="eliminarCodigo(buscarEnCatalogo(formCodigo.original))" class="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-lg"><i class="fa-solid fa-trash"></i> Eliminar filtro</button>
        <span v-else></span>
        <div class="flex gap-2">
          <button @click="showModalCodigo = false" class="bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold px-4 py-2 rounded-lg">Cancelar</button>
          <button @click="guardarCodigo" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-lg shadow"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
        </div>
      </div>
    </div>
    <datalist id="dl-fil-eqmarca"><option v-for="m in listaMarcasEquipoFiltros" :key="m" :value="m"></option></datalist>
    <datalist id="dl-fil-eqmodelo"><option v-for="m in listaTodosModelosEquipo" :key="m" :value="m"></option></datalist>
    <datalist id="dl-fil-tipos"><option v-for="t in listaTiposFiltro" :key="t" :value="t"></option></datalist>
    <datalist id="dl-fil-marcas"><option v-for="m in listaMarcasFiltro" :key="m" :value="m"></option></datalist>
    <datalist id="dl-fil-prov"><option v-for="p in listaProveedoresFiltro" :key="p" :value="p"></option></datalist>
  </div>
</section>
`;
