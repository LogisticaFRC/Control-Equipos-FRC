// Plantilla HTML del módulo FILTROS (referencia cruzada por equipo + comparativo de precios por proveedor)
export default /* html */ `
<section class="space-y-5 text-xs">
  <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
    <div class="flex flex-wrap justify-between items-center gap-3 border-b pb-3">
      <div>
        <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-filter text-emerald-600"></i> Filtros · Referencias Cruzadas y Comparativo de Precios</h2>
        <p class="text-xs text-slate-500">Se alimenta solo con los filtros que registras en cada mantención. Mismo modelo de equipo + mismo tipo + distinto código = <b>referencia cruzada</b>.</p>
      </div>
      <div class="flex items-center gap-2">
        <button @click="exportarCSV(filtrosFiltrados, 'Filtros')" class="bg-slate-700 hover:bg-slate-800 text-white font-bold px-3 py-2 rounded-lg shadow flex items-center gap-1.5"><i class="fa-solid fa-file-excel"></i> Exportar</button>
        <button v-if="puedeEditar" @click="nuevoFiltro()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-lg shadow flex items-center gap-1.5"><i class="fa-solid fa-plus"></i> Agregar Filtro</button>
      </div>
    </div>

    <!-- Filtros de búsqueda -->
    <div class="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-3 bg-slate-50 p-4 rounded-xl border">
      <div class="md:col-span-2"><label class="block font-bold text-slate-700 mb-1">Buscar</label><input type="text" v-model="filtroVista.texto" placeholder="Código, marca, proveedor, modelo..." class="w-full p-2 border rounded-lg bg-white"></div>
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
      <div class="bg-sky-50 border border-sky-200 p-3 rounded-xl"><p class="text-[10px] font-bold text-sky-800 uppercase">Modelos de equipo</p><p class="text-xl font-extrabold text-sky-900">{{ kpisFiltros.modelos }}</p></div>
      <div class="bg-amber-50 border border-amber-200 p-3 rounded-xl"><p class="text-[10px] font-bold text-amber-800 uppercase">Proveedores</p><p class="text-xl font-extrabold text-amber-900">{{ kpisFiltros.proveedores }}</p></div>
      <div class="bg-violet-50 border border-violet-200 p-3 rounded-xl"><p class="text-[10px] font-bold text-violet-800 uppercase">Tipos con ref. cruzada</p><p class="text-xl font-extrabold text-violet-900">{{ kpisFiltros.cruzadas }}</p></div>
    </div>

    <!-- Selector de vista -->
    <div class="flex gap-2 border-b pb-2">
      <button @click="vistaFiltros = 'cruzada'" :class="['px-3 py-2 rounded-lg font-bold border transition', vistaFiltros === 'cruzada' ? 'bg-slate-800 text-white border-slate-800 shadow' : 'bg-white text-slate-700 hover:bg-slate-100']"><i class="fa-solid fa-code-compare mr-1"></i> Referencia cruzada por equipo</button>
      <button @click="vistaFiltros = 'precios'" :class="['px-3 py-2 rounded-lg font-bold border transition', vistaFiltros === 'precios' ? 'bg-slate-800 text-white border-slate-800 shadow' : 'bg-white text-slate-700 hover:bg-slate-100']"><i class="fa-solid fa-scale-balanced mr-1"></i> Comparativo de precios por proveedor</button>
    </div>

    <div v-if="filtrosFiltrados.length === 0" class="text-center p-10 text-slate-400 font-bold">
      <i class="fa-solid fa-filter-circle-xmark text-3xl mb-2 block"></i>
      No hay filtros registrados{{ dbFiltros.length ? ' con esta búsqueda' : '' }}. Se agregan al guardar una mantención con filtros, o con "Agregar Filtro".
    </div>

    <!-- VISTA 1 · REFERENCIA CRUZADA POR MODELO DE EQUIPO -->
    <div v-if="vistaFiltros === 'cruzada'" class="space-y-4">
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
                <th class="p-2">Tipo</th><th class="p-2">Código</th><th class="p-2">Marca Filtro</th><th class="p-2">Proveedor</th>
                <th class="p-2 text-right">Precio</th><th class="p-2 text-right">Dif. vs mejor</th><th class="p-2">Fecha precio</th><th class="p-2">Último uso</th>
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
                  <td class="p-2 text-right font-mono font-bold" :class="r.esMejor ? 'text-emerald-700' : 'text-slate-800'">
                    {{ fmtPrecio(r.precio) }} <i v-if="r.esMejor" class="fa-solid fa-trophy text-emerald-600 ml-1" title="Mejor precio para este tipo"></i>
                  </td>
                  <td class="p-2 text-right font-mono" :class="r.difMejor > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'">{{ r.difMejor > 0 ? '+' + fmtPrecio(r.difMejor) : (r.difMejor === 0 ? '—' : '-') }}</td>
                  <td class="p-2 font-mono text-slate-500">{{ fmtFecha(r.fechaPrecio) }}</td>
                  <td class="p-2 font-mono text-slate-500">{{ fmtFecha(r.ultimoUso) }}<span v-if="r.ultimoAfi" class="ml-1 text-amber-700">(AFI {{ r.ultimoAfi }})</span></td>
                  <td v-if="puedeEditar" class="p-2 text-center space-x-1">
                    <button @click="editarFiltro(r)" class="bg-amber-100 hover:bg-amber-200 text-amber-800 p-1 rounded font-bold" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button v-if="isAdmin" @click="eliminarFiltro(r)" class="bg-rose-100 hover:bg-rose-200 text-rose-800 p-1 rounded font-bold" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- VISTA 2 · COMPARATIVO DE PRECIOS (CÓDIGO x PROVEEDOR) -->
    <div v-if="vistaFiltros === 'precios' && filtrosFiltrados.length" class="overflow-x-auto border rounded-xl">
      <table class="w-full text-left whitespace-nowrap border-collapse">
        <thead class="bg-slate-800 text-white uppercase text-[9px] sticky top-0">
          <tr>
            <th class="p-2">Tipo</th><th class="p-2">Código</th><th class="p-2">Marca</th><th class="p-2">Aplica a</th>
            <th v-for="p in comparativoPrecios.proveedores" :key="p" class="p-2 text-right text-amber-300">{{ p }}</th>
            <th class="p-2 text-emerald-300">Mejor proveedor</th><th class="p-2 text-right text-rose-300">Ahorro</th>
          </tr>
        </thead>
        <tbody class="divide-y bg-white">
          <tr v-for="c in comparativoPrecios.filas" :key="c.codigo" class="hover:bg-slate-50">
            <td class="p-2 font-bold text-slate-700">{{ c.tipo }}</td>
            <td class="p-2 font-mono font-extrabold">{{ c.codigo }}</td>
            <td class="p-2">{{ c.marca }}</td>
            <td class="p-2 text-[10px] text-slate-500 max-w-[220px] truncate" :title="c.modelos.join(', ')">{{ c.modelos.join(', ') }}</td>
            <td v-for="p in comparativoPrecios.proveedores" :key="p" :class="['p-2 text-right font-mono', c.precios[p] && c.precios[p] === c.min ? 'bg-emerald-100 text-emerald-800 font-extrabold' : (c.precios[p] ? 'text-slate-800' : 'text-slate-300')]">{{ c.precios[p] ? fmtPrecio(c.precios[p]) : '—' }}</td>
            <td class="p-2 font-bold text-emerald-700">{{ c.mejorProveedor || '-' }}</td>
            <td class="p-2 text-right font-mono font-bold" :class="c.ahorro > 0 ? 'text-rose-600' : 'text-slate-400'">{{ c.ahorro > 0 ? fmtPrecio(c.ahorro) : '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- MODAL AGREGAR / EDITAR FILTRO -->
  <div v-if="showModalFiltro" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl border w-full max-w-2xl overflow-hidden">
      <div class="px-6 py-4 border-b flex items-center justify-between bg-slate-800 text-white">
        <h3 class="text-sm font-bold flex items-center gap-2"><i class="fa-solid fa-filter text-emerald-400"></i> {{ formFiltro.id ? 'Editar Filtro' : 'Agregar Filtro' }}</h3>
        <button @click="showModalFiltro = false" class="text-slate-300 hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="p-6 space-y-4">
        <div class="bg-sky-50 border border-sky-200 p-3 rounded-xl grid grid-cols-2 gap-3">
          <p class="col-span-2 font-bold text-sky-900 uppercase text-[10px]">Equipo al que aplica</p>
          <div><label class="block font-bold mb-1">Marca Equipo *</label><input type="text" list="dl-fil-eqmarca" v-model="formFiltro.equipoMarca" class="w-full p-2 border rounded-lg bg-white uppercase"></div>
          <div><label class="block font-bold mb-1">Modelo Equipo *</label><input type="text" list="dl-fil-eqmodelo" v-model="formFiltro.equipoModelo" class="w-full p-2 border rounded-lg bg-white uppercase"></div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div><label class="block font-bold mb-1">Tipo de Filtro *</label><input type="text" list="dl-fil-tipos" v-model="formFiltro.tipo" placeholder="ACEITE MOTOR" class="w-full p-2 border rounded-lg uppercase"></div>
          <div><label class="block font-bold mb-1">Marca Filtro</label><input type="text" list="dl-fil-marcas" v-model="formFiltro.marca" placeholder="DONALDSON" class="w-full p-2 border rounded-lg uppercase"></div>
          <div><label class="block font-bold mb-1">Código *</label><input type="text" v-model="formFiltro.codigo" placeholder="P550388" class="w-full p-2 border rounded-lg font-mono font-bold uppercase"></div>
          <div><label class="block font-bold mb-1">Proveedor</label><input type="text" list="dl-fil-prov" v-model="formFiltro.proveedor" class="w-full p-2 border rounded-lg uppercase"></div>
          <div><label class="block font-bold mb-1">Precio unitario ($)</label><input type="number" min="0" v-model="formFiltro.precio" class="w-full p-2 border rounded-lg font-mono font-bold"></div>
          <div><label class="block font-bold mb-1 text-violet-800">Cantidad que usa el modelo</label><input type="number" min="1" v-model="formFiltro.cantidad" class="w-full p-2 border border-violet-300 rounded-lg font-mono font-bold bg-violet-50"></div>
        </div>
        <p class="text-[10px] text-slate-500 leading-relaxed">
          <i class="fa-solid fa-circle-info text-sky-600"></i> Al guardar: el <b>precio</b> se aplica a ese código con ese proveedor en todos los modelos;
          la <b>cantidad</b> se aplica a todos los códigos de ese tipo para este modelo (es la que se ve en el Perfil de Equipo).
        </p>
      </div>
      <div class="px-6 py-3 border-t bg-slate-100 flex justify-end gap-2">
        <button @click="showModalFiltro = false" class="bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold px-4 py-2 rounded-lg">Cancelar</button>
        <button @click="guardarFiltro" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-lg shadow"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
      </div>
    </div>
    <datalist id="dl-fil-eqmarca"><option v-for="m in listaMarcasEquipoFiltros" :key="m" :value="m"></option></datalist>
    <datalist id="dl-fil-eqmodelo"><option v-for="m in listaModelosEquipoFiltros" :key="m" :value="m"></option></datalist>
    <datalist id="dl-fil-tipos"><option v-for="t in listaTiposFiltro" :key="t" :value="t"></option></datalist>
    <datalist id="dl-fil-marcas"><option v-for="m in listaMarcasFiltro" :key="m" :value="m"></option></datalist>
    <datalist id="dl-fil-prov"><option v-for="p in listaProveedoresFiltro" :key="p" :value="p"></option></datalist>
  </div>
</section>
`;
