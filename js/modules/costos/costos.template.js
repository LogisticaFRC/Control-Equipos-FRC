// Plantilla del módulo "Costos de Mantención"
export default /* html */ `
<div class="space-y-4 text-xs">
  <!-- ENCABEZADO -->
  <div class="bg-gradient-to-r from-slate-900 to-indigo-900 text-white rounded-2xl p-4 shadow">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-extrabold flex items-center gap-2"><i class="fa-solid fa-sack-dollar text-amber-400"></i> Costos de Mantención</h2>
        <p class="text-slate-300 text-[11px] mt-0.5">Valor estimado de cada mantención (250 / 500 / 1000 hrs) según los filtros de cada modelo y cuánto costarán las próximas mantenciones.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button v-if="isAdmin" @click="verConfig = !verConfig" class="bg-white/10 hover:bg-white/20 border border-white/20 font-bold px-3 py-1.5 rounded-lg"><i class="fa-solid fa-sliders"></i> Qué incluye cada mantención</button>
        <button @click="exportarCostosExcel()" :disabled="exportandoCostos" class="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold px-3 py-1.5 rounded-lg shadow disabled:opacity-50"><i :class="['fa-solid', exportandoCostos ? 'fa-spinner fa-spin' : 'fa-file-excel']"></i> Exportar Excel</button>
      </div>
    </div>
    <div class="mt-3 flex flex-wrap items-end gap-3">
      <div>
        <label class="block text-[10px] uppercase font-bold text-slate-300 mb-1">Horas de uso a proyectar</label>
        <div class="flex items-center gap-1">
          <input type="number" min="0" step="50" v-model.number="horasProyeccion" class="w-24 p-1.5 rounded-lg text-slate-900 font-mono font-extrabold text-center">
          <button v-for="h in [250, 500, 1000, 2000, 5000]" :key="h" @click="horasProyeccion = h" :class="['px-2 py-1 rounded-lg font-bold border', horasProyeccion === h ? 'bg-amber-400 text-slate-950 border-amber-400' : 'border-white/30 hover:bg-white/10']">{{ h.toLocaleString('es-CL') }}</button>
        </div>
      </div>
      <div><label class="block text-[10px] uppercase font-bold text-slate-300 mb-1">Tipo de equipo</label>
        <select v-model="filtroCostos.tipo" class="p-1.5 rounded-lg text-slate-900 font-bold"><option value="">Todos</option><option v-for="t in tiposEquipoCostos" :key="t" :value="t">{{ t }}</option></select></div>
      <div><label class="block text-[10px] uppercase font-bold text-slate-300 mb-1">Buscar</label>
        <input v-model="filtroCostos.texto" placeholder="AFI, marca, modelo…" class="p-1.5 rounded-lg text-slate-900 w-48"></div>
      <label class="flex items-center gap-1.5 font-semibold pb-1.5"><input type="checkbox" v-model="filtroCostos.soloConFiltros"> Solo modelos con filtros cargados</label>
    </div>
  </div>

  <!-- CONFIGURACIÓN -->
  <div v-if="verConfig && isAdmin" class="bg-white border border-indigo-200 rounded-2xl p-4 shadow-sm space-y-3">
    <div class="flex flex-wrap justify-between items-center gap-2">
      <h3 class="font-extrabold text-indigo-900 uppercase"><i class="fa-solid fa-sliders"></i> Qué filtros van en cada mantención</h3>
      <div class="flex gap-2">
        <button @click="restaurarConfigCostos" class="border px-3 py-1.5 rounded-lg font-bold">Por defecto</button>
        <button @click="guardarConfigCostos" :disabled="guardandoConfig" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg disabled:opacity-50"><i class="fa-solid fa-floppy-disk"></i> Guardar para todos</button>
      </div>
    </div>
    <p v-if="faltaTablaConfig" class="bg-amber-50 border border-amber-300 text-amber-800 rounded-lg p-2 font-semibold"><i class="fa-solid fa-triangle-exclamation"></i> Falta ejecutar <b>sql/costos_mantencion.sql</b> en Supabase para guardar esta configuración. Mientras tanto se usan los valores por defecto.</p>
    <div class="overflow-x-auto">
      <table class="text-left border rounded-lg overflow-hidden">
        <thead class="bg-slate-800 text-white text-[10px] uppercase"><tr><th class="p-2">Grupo de filtro</th><th v-for="mt in TIPOS_MANT" :key="mt" class="p-2 text-center w-24">{{ ETIQ_MANT[mt] }}</th></tr></thead>
        <tbody class="divide-y">
          <tr v-for="g in GRUPOS" :key="g.k" class="hover:bg-slate-50">
            <td class="p-2 font-bold">{{ g.l }}</td>
            <td v-for="mt in TIPOS_MANT" :key="mt" class="p-2 text-center"><input type="checkbox" v-model="configCostos.grupos[g.k][mt]" class="w-4 h-4 accent-indigo-600"></td>
          </tr>
          <tr class="bg-amber-50">
            <td class="p-2 font-bold">+ Costo adicional por mantención <span class="font-normal text-slate-500 block text-[10px]">aceite, mano de obra, otros ($)</span></td>
            <td v-for="mt in TIPOS_MANT" :key="mt" class="p-2"><input type="number" min="0" step="1000" v-model.number="configCostos.extra[mt]" class="w-24 p-1 border rounded font-mono text-right"></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="text-slate-500">El tipo de cada mantención proyectada sale del horómetro: múltiplos de 1.000 → 1000 hrs · de 500 → 500 hrs · el resto → 250 hrs. Las horas a proyectar que tengas puestas también se guardan como valor por defecto.</p>
  </div>

  <!-- KPI -->
  <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
    <div class="bg-indigo-600 text-white rounded-2xl p-3 shadow col-span-2">
      <span class="text-[10px] uppercase font-bold opacity-80">Costo proyectado · {{ flotaCostos.horas.toLocaleString('es-CL') }} h de uso</span>
      <span class="block text-2xl font-extrabold font-mono">{{ fmtPrecio(flotaCostos.total) }}</span>
      <span class="text-[10px] opacity-80">{{ flotaCostos.equipos.length }} equipos · promedio {{ fmtPrecio(flotaCostos.equipos.length ? flotaCostos.total / flotaCostos.equipos.length : 0) }} por equipo</span>
    </div>
    <div class="bg-white border rounded-2xl p-3 shadow-sm col-span-2">
      <span class="text-[10px] uppercase font-bold text-slate-500">Mantenciones proyectadas</span>
      <span class="block text-2xl font-extrabold text-slate-800">{{ flotaCostos.nMant }}</span>
      <div class="flex h-2 rounded-full overflow-hidden bg-slate-100 mt-1">
        <div v-for="mt in TIPOS_MANT" :key="mt" :class="barra[mt]" :style="{ width: (flotaCostos.nMant ? flotaCostos.cuenta[mt] / flotaCostos.nMant * 100 : 0) + '%' }"></div>
      </div>
      <div class="flex gap-3 mt-1 text-[10px] font-bold">
        <span v-for="mt in TIPOS_MANT" :key="mt" :class="texto[mt]"><i class="fa-solid fa-circle text-[7px]"></i> {{ ETIQ_MANT[mt] }}: {{ flotaCostos.cuenta[mt] }}</span>
      </div>
    </div>
    <div class="bg-white border rounded-2xl p-3 shadow-sm">
      <span class="text-[10px] uppercase font-bold text-slate-500">Vencidas hoy</span>
      <span :class="['block text-2xl font-extrabold', flotaCostos.vencidas ? 'text-rose-600' : 'text-emerald-600']">{{ flotaCostos.vencidas }}</span>
      <span class="text-[10px] text-slate-500">equipos con mantención pasada</span>
    </div>
    <div class="bg-white border rounded-2xl p-3 shadow-sm">
      <span class="text-[10px] uppercase font-bold text-slate-500">Modelos sin filtros</span>
      <span :class="['block text-2xl font-extrabold', flotaCostos.sinFiltros.length ? 'text-amber-600' : 'text-emerald-600']">{{ flotaCostos.sinFiltros.length }}</span>
      <span class="text-[10px] text-slate-500">de {{ flotaCostos.modelos.length }} modelos (costo $0)</span>
    </div>
  </div>

  <!-- PESTAÑAS -->
  <div class="flex gap-1 border-b">
    <button v-for="v in [{k:'modelos',l:'Por modelo',n:flotaCostos.modelos.length},{k:'equipos',l:'Por equipo',n:flotaCostos.equipos.length},{k:'faltan',l:'Faltan datos',n:flotaCostos.sinFiltros.length + flotaCostos.conFaltantes.length}]" :key="v.k"
      @click="vista = v.k" :class="['px-4 py-2 font-bold rounded-t-lg border-b-2 -mb-px', vista === v.k ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800']">
      {{ v.l }} <span class="ml-1 bg-slate-100 text-slate-600 rounded-full px-1.5">{{ v.n }}</span>
    </button>
  </div>

  <!-- POR MODELO -->
  <div v-if="vista === 'modelos'" class="space-y-2">
    <div v-for="m in flotaCostos.modelos" :key="m.key" class="bg-white border rounded-xl shadow-sm overflow-hidden">
      <div @click="toggle(m.key)" class="p-3 flex flex-wrap items-center gap-3 cursor-pointer hover:bg-slate-50">
        <div class="min-w-[190px] flex-1">
          <span class="text-[10px] font-bold uppercase text-slate-500">{{ m.tipoTxt || 'Sin tipo' }}</span>
          <span class="block font-extrabold text-slate-900 text-sm">{{ m.marca || 'SIN MARCA' }} · {{ m.modelo || 'SIN MODELO' }}</span>
          <div class="flex flex-wrap gap-1 mt-1">
            <button v-for="x in m.equipos" :key="x.afi" @click.stop="verDetallePorAfiString(x.afi)" class="font-mono font-bold text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 rounded hover:bg-amber-100">{{ x.afi }}</button>
          </div>
        </div>
        <template v-if="m.costo.tieneFiltros">
          <div v-for="mt in TIPOS_MANT" :key="mt" :class="['rounded-xl px-3 py-1.5 text-center min-w-[96px] border', caja[mt]]">
            <span class="block text-[9px] uppercase font-bold">{{ ETIQ_MANT[mt] }}</span>
            <span class="block font-mono font-extrabold text-sm">{{ fmtPrecio(m.costo.por[mt].total) }}</span>
            <span class="block text-[9px] opacity-75">{{ m.costo.por[mt].items.length }} filtro(s){{ m.costo.por[mt].sinPrecio.length ? ' · ⚠' : '' }}</span>
          </div>
        </template>
        <div v-else class="bg-amber-50 border border-amber-300 text-amber-800 rounded-xl px-3 py-2 font-bold"><i class="fa-solid fa-triangle-exclamation"></i> Sin filtros cargados</div>
        <div class="text-right min-w-[130px]">
          <span class="block text-[9px] uppercase font-bold text-slate-500">{{ m.cuenta[250] + m.cuenta[500] + m.cuenta[1000] }} mantenciones · {{ m.equipos.length }} eq.</span>
          <span class="block font-mono font-extrabold text-indigo-700 text-base">{{ fmtPrecio(m.total) }}</span>
          <span class="text-[9px] text-slate-400">{{ m.cuenta[250] }}×250 · {{ m.cuenta[500] }}×500 · {{ m.cuenta[1000] }}×1000</span>
        </div>
        <i :class="['fa-solid fa-chevron-down text-slate-400 transition-transform', abierto === m.key ? 'rotate-180' : '']"></i>
      </div>
      <div v-if="abierto === m.key && m.costo.tieneFiltros" class="border-t bg-slate-50 p-3 overflow-x-auto">
        <table class="w-full text-left bg-white border rounded-lg overflow-hidden">
          <thead class="bg-slate-800 text-white text-[9px] uppercase"><tr>
            <th class="p-2">Tipo de filtro</th><th class="p-2">Mejor opción</th><th class="p-2 text-right">Precio</th><th class="p-2 text-center">Cant.</th><th class="p-2 text-right">Costo</th>
            <th v-for="mt in TIPOS_MANT" :key="mt" class="p-2 text-center">{{ mt }}</th><th class="p-2">Equivalentes</th></tr></thead>
          <tbody class="divide-y">
            <tr v-for="t in m.costo.tipos" :key="t.tipo" class="align-top">
              <td class="p-2 font-bold">{{ t.tipo }}<span class="block text-[9px] font-normal text-slate-400">{{ grupoLabel(t.grupo) }}</span></td>
              <td class="p-2"><span v-if="t.mejor" class="font-mono font-bold text-emerald-700">{{ t.mejor.codigo }}</span><span v-else class="text-rose-600 font-bold">Sin precio</span><span v-if="t.mejor" class="block text-[9px] text-slate-500">{{ t.mejor.marca }} · {{ t.mejor.proveedor || '-' }}</span></td>
              <td class="p-2 text-right font-mono">{{ t.mejor ? fmtPrecio(t.mejor.precio) : '-' }}</td>
              <td class="p-2 text-center font-bold">{{ t.cantidad }}</td>
              <td class="p-2 text-right font-mono font-bold">{{ fmtPrecio(t.costo) }}</td>
              <td v-for="mt in TIPOS_MANT" :key="mt" class="p-2 text-center"><i v-if="incluye(t.tipo, mt)" :class="['fa-solid fa-circle-check', texto[mt]]"></i><span v-else class="text-slate-300">—</span></td>
              <td class="p-2 text-[10px] text-slate-500 font-mono">{{ t.filas.map(r => r.codigo).join(' · ') }}</td>
            </tr>
          </tbody>
          <tfoot class="bg-slate-100 font-bold">
            <tr><td class="p-2" colspan="5">Filtros + adicional</td>
              <td v-for="mt in TIPOS_MANT" :key="mt" :class="['p-2 text-center font-mono', texto[mt]]">{{ fmtPrecio(m.costo.por[mt].total) }}</td><td></td></tr>
          </tfoot>
        </table>
      </div>
    </div>
    <p v-if="!flotaCostos.modelos.length" class="text-center text-slate-400 py-8">No hay equipos con esos filtros.</p>
  </div>

  <!-- POR EQUIPO -->
  <div v-if="vista === 'equipos'" class="bg-white border rounded-xl shadow-sm overflow-hidden">
    <table class="w-full text-left table-fixed">
      <thead class="bg-slate-800 text-white text-[9px] uppercase"><tr>
        <th class="p-2 w-20">AFI</th><th class="p-2">Equipo</th><th class="p-2 w-24 text-right hidden md:table-cell">Horómetro aprox.</th><th class="p-2 w-36">Próxima</th>
        <th class="p-2 w-12 text-center">250</th><th class="p-2 w-12 text-center">500</th><th class="p-2 w-12 text-center">1000</th><th class="p-2 w-28 text-right">Costo</th><th class="p-2 w-8"></th></tr></thead>
      <tbody class="divide-y">
        <template v-for="x in flotaCostos.equipos.slice(0, limiteEq)" :key="x.afi">
          <tr @click="toggle('E' + x.afi)" class="cursor-pointer hover:bg-slate-50">
            <td class="p-2"><button @click.stop="verDetallePorAfiString(x.afi)" class="font-mono font-bold text-amber-700 hover:underline">{{ x.afi }}</button></td>
            <td class="p-2 truncate"><b>{{ x.tipo }}</b> <span class="text-slate-500">{{ x.marca }} {{ x.modelo }}</span><span v-if="!x.costo.tieneFiltros" class="ml-1 text-amber-700 font-bold">⚠ sin filtros</span></td>
            <td class="p-2 text-right font-mono hidden md:table-cell">{{ Math.round(x.proy.desde).toLocaleString('es-CL') }} h<span class="block text-[9px] text-slate-400">{{ x.proy.rate ? x.proy.rate.toFixed(1) + ' h/día' : '' }}</span></td>
            <td class="p-2"><template v-if="x.proy.servicios[0]">
              <span :class="['font-mono font-bold', x.proy.servicios[0].vencida ? 'text-rose-600' : 'text-slate-800']">{{ x.proy.servicios[0].h.toLocaleString('es-CL') }} h</span>
              <span :class="['ml-1 px-1.5 rounded text-[9px] font-bold', chip[x.proy.servicios[0].tipo]]">{{ x.proy.servicios[0].tipo }}</span>
              <span class="block text-[9px]" :class="x.proy.servicios[0].vencida ? 'text-rose-600 font-bold' : 'text-slate-500'">{{ x.proy.servicios[0].vencida ? 'VENCIDA' : formatDateForDisplay(x.proy.servicios[0].fecha) }}</span>
            </template><span v-else class="text-slate-300">—</span></td>
            <td v-for="mt in TIPOS_MANT" :key="mt" :class="['p-2 text-center font-bold', x.proy.cuenta[mt] ? texto[mt] : 'text-slate-300']">{{ x.proy.cuenta[mt] }}</td>
            <td class="p-2 text-right font-mono font-extrabold text-indigo-700">{{ fmtPrecio(x.proy.total) }}</td>
            <td class="p-2 text-center"><i :class="['fa-solid fa-chevron-down text-slate-400 transition-transform', abierto === 'E' + x.afi ? 'rotate-180' : '']"></i></td>
          </tr>
          <tr v-if="abierto === 'E' + x.afi" class="bg-slate-50"><td colspan="9" class="p-3">
            <div class="flex flex-wrap gap-1.5">
              <div v-for="s in x.proy.servicios" :key="s.n" :class="['border rounded-lg px-2 py-1 bg-white', s.vencida ? 'border-rose-400' : '']">
                <span class="font-mono font-bold">{{ s.h.toLocaleString('es-CL') }} h</span>
                <span :class="['ml-1 px-1.5 rounded text-[9px] font-bold', chip[s.tipo]]">{{ s.tipo }}</span>
                <span class="block text-[9px] text-slate-500">{{ s.vencida ? 'VENCIDA' : formatDateForDisplay(s.fecha) }} · <b class="text-slate-700">{{ fmtPrecio(s.costo) }}</b></span>
              </div>
              <span v-if="!x.proy.servicios.length" class="text-slate-400">No hay mantenciones en las próximas {{ flotaCostos.horas }} h.</span>
            </div>
          </td></tr>
        </template>
      </tbody>
      <tfoot class="bg-slate-800 text-white font-bold"><tr>
        <td class="p-2" colspan="2">TOTAL · {{ flotaCostos.equipos.length }} equipos</td><td class="hidden md:table-cell"></td><td></td>
        <td v-for="mt in TIPOS_MANT" :key="mt" class="p-2 text-center">{{ flotaCostos.cuenta[mt] }}</td>
        <td class="p-2 text-right font-mono">{{ fmtPrecio(flotaCostos.total) }}</td><td></td></tr></tfoot>
    </table>
    <div v-if="flotaCostos.equipos.length > limiteEq" class="p-2 text-center border-t"><button @click="limiteEq += 100" class="text-indigo-700 font-bold underline">Ver más ({{ flotaCostos.equipos.length - limiteEq }})</button></div>
  </div>

  <!-- FALTAN DATOS -->
  <div v-if="vista === 'faltan'" class="grid md:grid-cols-2 gap-3">
    <div class="bg-white border border-amber-300 rounded-xl p-3 shadow-sm">
      <h4 class="font-extrabold text-amber-800 uppercase mb-2"><i class="fa-solid fa-filter-circle-xmark"></i> Modelos sin filtros cargados ({{ flotaCostos.sinFiltros.length }})</h4>
      <p class="text-slate-500 mb-2">Súbelos en <b>Filtros → Importar</b> con la columna "SIRVE PARA" (el modelo tal como está en el inventario) o agrégalos a mano.</p>
      <div v-for="m in flotaCostos.sinFiltros" :key="m.key" class="border-t py-1.5">
        <b>{{ m.tipoTxt || 'Sin tipo' }}</b> · {{ m.marca || 'SIN MARCA' }} · <span class="font-mono font-bold">{{ m.modelo || 'SIN MODELO' }}</span>
        <span class="block text-[10px] text-slate-500">AFI: {{ m.equipos.map(x => x.afi).join(', ') }}</span>
      </div>
      <p v-if="!flotaCostos.sinFiltros.length" class="text-emerald-700 font-bold">Todos los modelos tienen filtros.</p>
    </div>
    <div class="bg-white border border-rose-200 rounded-xl p-3 shadow-sm">
      <h4 class="font-extrabold text-rose-800 uppercase mb-2"><i class="fa-solid fa-tag"></i> Filtros sin precio ({{ flotaCostos.conFaltantes.length }} modelos)</h4>
      <div v-for="m in flotaCostos.conFaltantes" :key="m.key" class="border-t py-1.5">
        <b>{{ m.marca }} {{ m.modelo }}</b>: <span class="text-rose-700">{{ [...new Set(TIPOS_MANT.flatMap(mt => m.costo.por[mt].sinPrecio))].join(', ') }}</span>
      </div>
      <p v-if="!flotaCostos.conFaltantes.length" class="text-emerald-700 font-bold">Todos los filtros tienen precio.</p>
    </div>
  </div>
</div>
`;
