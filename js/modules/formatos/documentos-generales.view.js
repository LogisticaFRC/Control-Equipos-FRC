// =====================================================================
// DOCUMENTOS GENERALES (2026-11-24) · Área General
// Inducciones, capacitaciones, procedimientos y otros documentos que NO son de un equipo.
// Usa la tabla bd_formatos con carpeta "GENERAL / <CATEGORÍA>" y el componente <documentos-carpeta>
// (subcarpetas, buscador, subir archivo/enlace, mover, editar). Solo el Admin sube y modifica.
// Se cuentan aparte: no aparecen en Formatos ni en los equipos.
// =====================================================================
import { comunes } from '../../core/comunes.js';
import { CATEGORIAS_GENERALES, carpetaGeneral, documentosConSub, totalDocGenerales, buscarEnGenerales } from './formatos.service.js';

const { ref } = Vue;

const template = /* html */ `
<section class="space-y-5">
  <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
    <div class="border-b pb-3 mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-folder-open text-emerald-600"></i> Documentos generales</h2>
        <p class="text-xs text-slate-500">Inducciones y documentos que no son de un equipo en particular.<template v-if="isAdmin"> Como Admin puedes subir archivos, agregar enlaces y crear subcarpetas.</template><template v-else> Puedes abrir y descargar los documentos.</template></p>
      </div>
      <span class="text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg"><i class="fa-solid fa-file-lines mr-1"></i>{{ totalDocGenerales() }} documento(s)</span>
    </div>

    <div class="relative mb-4">
      <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400"><i class="fa-solid fa-magnifying-glass"></i></span>
      <input v-model="busqueda" type="search" placeholder="Buscar en todos los documentos generales… (ej: inducción, Codelco, reglamento)"
        class="w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-semibold">
    </div>

    <div v-if="busqueda.trim()" class="space-y-2">
      <p class="text-xs font-bold text-slate-600"><i class="fa-solid fa-list"></i> {{ buscarEnGenerales(busqueda).length }} resultado(s) para "{{ busqueda }}"
        <button @click="busqueda = ''" class="ml-2 text-blue-700 hover:underline">Limpiar búsqueda</button></p>
      <documentos-carpeta :resultados="buscarEnGenerales(busqueda)"></documentos-carpeta>
    </div>

    <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-3">
      <button v-for="c in CATEGORIAS_GENERALES" :key="c.key" @click="cat = c.key"
        :class="['p-4 rounded-xl border-2 text-left transition flex items-center gap-3', cat === c.key ? 'border-emerald-500 bg-emerald-50 shadow' : 'border-slate-200 hover:border-slate-300 bg-white']">
        <i :class="['fa-solid text-2xl w-8 text-center', c.icon, cat === c.key ? 'text-emerald-600' : 'text-slate-400']"></i>
        <div class="min-w-0">
          <p class="font-extrabold text-xs text-slate-800">{{ c.key }}</p>
          <p class="text-[10px] text-slate-500 truncate">{{ c.desc }}</p>
          <p class="text-[10px] font-bold text-emerald-700 mt-0.5">{{ documentosConSub(carpetaGeneral(c.key)).length }} documento(s)</p>
        </div>
      </button>
    </div>
  </div>

  <div v-if="!busqueda.trim()" class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
    <div class="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
      <i class="fa-solid fa-folder-open text-emerald-600"></i> GENERAL <i class="fa-solid fa-chevron-right text-[9px]"></i> <span class="text-slate-800">{{ cat }}</span>
    </div>
    <documentos-carpeta :key="carpetaGeneral(cat)" :carpeta="carpetaGeneral(cat)"></documentos-carpeta>
  </div>
</section>
`;

export default {
  name: 'DocumentosGeneralesView',
  template,
  setup() {
    const busqueda = ref('');
    const cat = ref(CATEGORIAS_GENERALES[0].key);
    return { ...comunes(), CATEGORIAS_GENERALES, carpetaGeneral, documentosConSub, totalDocGenerales, buscarEnGenerales, busqueda, cat };
  }
};
