// Plantilla HTML del módulo FORMATOS (Área → Norma ISO → documentos)
export default /* html */ `
<section class="space-y-5">
  <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
    <div class="border-b pb-3 mb-4">
      <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-folder-tree text-amber-600"></i> Formatos y Documentos ISO</h2>
      <p class="text-xs text-slate-500">Selecciona un área y luego la norma.<template v-if="!isAdmin"> Puedes abrir y descargar los documentos.</template><template v-else> Como Admin puedes subir archivos o agregar enlaces.</template></p>
    </div>

    <!-- 1) ÁREAS -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <button v-for="a in AREAS" :key="a.key" @click="areaActiva = a.key"
        :class="['p-4 rounded-xl border-2 text-left transition flex items-center gap-3', areaActiva === a.key ? 'border-amber-500 bg-amber-50 shadow' : 'border-slate-200 hover:border-slate-300 bg-white']">
        <i :class="['fa-solid text-2xl', areaActiva === a.key ? 'fa-folder-open text-amber-500' : 'fa-folder text-slate-400']"></i>
        <div>
          <p class="font-extrabold text-xs text-slate-800"><i :class="['fa-solid mr-1', a.icon]"></i>{{ a.key }}</p>
          <p class="text-[10px] text-slate-500">{{ contarDocumentos(a.key + ' / ') }} documento(s)</p>
        </div>
      </button>
    </div>
  </div>

  <!-- 2) NORMAS dentro del área -->
  <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
    <div class="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
      <i class="fa-solid fa-folder-open text-amber-500"></i> {{ areaActiva }} <i class="fa-solid fa-chevron-right text-[9px]"></i> <span class="text-slate-800">{{ normaActiva }}</span>
    </div>
    <div class="flex flex-wrap gap-2">
      <button v-for="n in NORMAS" :key="n.key" @click="normaActiva = n.key"
        :class="['px-3 py-2 rounded-lg text-xs font-bold border transition flex items-center gap-1.5', normaActiva === n.key ? 'bg-slate-800 text-white border-slate-800 shadow' : 'bg-white text-slate-700 hover:bg-slate-100']">
        <i :class="['fa-solid', n.icon]"></i> {{ n.key }}
        <span :class="['ml-1 px-1.5 rounded-full text-[10px]', normaActiva === n.key ? 'bg-white/20' : 'bg-slate-100']">{{ documentosDe(carpetaFormato(areaActiva, n.key)).length }}</span>
      </button>
    </div>

    <!-- 3) Documentos de la carpeta seleccionada -->
    <documentos-carpeta :key="carpetaFormato(areaActiva, normaActiva)" :carpeta="carpetaFormato(areaActiva, normaActiva)"></documentos-carpeta>
  </div>
</section>
`;
