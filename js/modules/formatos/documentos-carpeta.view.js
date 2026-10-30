// =====================================================================
// FORMATOS · Componente reutilizable "carpeta de documentos"
// Uso: <documentos-carpeta :carpeta="'RRHH / ISO CALIDAD 9001'"></documentos-carpeta>
//      <documentos-carpeta :resultados="lista"></documentos-carpeta>   ← modo resultados de búsqueda
// - TODOS: buscador, subcarpetas, abrir/descargar.
// - Las subcarpetas aparecen en la misma lista, arriba de los documentos.
// - ADMIN: ARRASTRAR documentos sobre una carpeta para moverlos; subir archivo / agregar enlace; crear / renombrar / eliminar subcarpetas;
//          MODIFICAR documentos (nombre, reemplazar archivo o enlace, mover a otra subcarpeta) y eliminar.
// =====================================================================
import { isAdmin } from '../../core/store.js';
import {
  documentosDe, documentosConSub, subcarpetasDe, baseDe, subDe, rutaSub, filtrarPorTexto,
  subirDocumento, agregarEnlace, editarDocumento, eliminarDocumento, esArchivoSubido,
  crearSubcarpeta, renombrarSubcarpeta, eliminarSubcarpeta
} from './formatos.service.js';

const { ref, computed, watch } = Vue;

const template = /* html */ `
<div class="space-y-3 text-xs">

  <template v-if="!modoResultados">
    <!-- Ruta + buscador -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-1.5 font-bold text-slate-600">
        <button @click="sub = ''" :class="['hover:underline', sub ? 'text-blue-700' : 'text-slate-800']"><i class="fa-solid fa-folder-open text-amber-500"></i> Carpeta principal</button>
        <template v-if="sub"><i class="fa-solid fa-chevron-right text-[9px]"></i><span class="text-slate-800"><i class="fa-solid fa-folder text-amber-400"></i> {{ sub }}</span></template>
      </div>
      <div class="relative w-full sm:w-72">
        <span class="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400"><i class="fa-solid fa-magnifying-glass"></i></span>
        <input v-model="busqueda" type="search" placeholder="Buscar en esta carpeta y sus subcarpetas…" class="w-full pl-8 pr-2 py-2 border rounded-lg bg-white">
      </div>
    </div>

    <div v-if="isAdmin && !busqueda" class="flex flex-wrap gap-2 items-center">
      <button v-if="!sub" @click="nuevaSub" class="px-3 py-1.5 rounded-lg border border-dashed border-amber-400 text-amber-700 font-bold hover:bg-amber-50"><i class="fa-solid fa-folder-plus"></i> Nueva subcarpeta</button>
      <span class="text-[11px] text-slate-400"><i class="fa-solid fa-hand-pointer"></i> Arrastra un documento sobre una carpeta para moverlo.</span>
    </div>
    <div v-if="sub && isAdmin" class="flex gap-2">
      <button @click="renombrarSub" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"><i class="fa-solid fa-pen"></i> Renombrar subcarpeta</button>
      <button @click="borrarSub" class="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 font-bold text-rose-700"><i class="fa-solid fa-folder-minus"></i> Eliminar subcarpeta</button>
    </div>

    <!-- Panel de carga: SOLO ADMIN (sube a la carpeta/subcarpeta abierta) -->
    <div v-if="isAdmin && !busqueda" class="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-[10px] font-bold uppercase bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full"><i class="fa-solid fa-user-shield"></i> Solo Admin</span>
        <div class="flex bg-white border rounded-lg overflow-hidden">
          <button @click="modo = 'archivo'" :class="['px-3 py-1.5 font-bold', modo === 'archivo' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100']"><i class="fa-solid fa-upload"></i> Subir archivo</button>
          <button @click="modo = 'enlace'" :class="['px-3 py-1.5 font-bold', modo === 'enlace' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100']"><i class="fa-solid fa-link"></i> Agregar enlace</button>
        </div>
        <span class="text-slate-500">Se guardará en: <b>{{ sub || 'Carpeta principal' }}</b></span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
        <div>
          <label class="block font-bold text-slate-700 mb-1">Nombre (opcional)</label>
          <input v-model="nombre" type="text" :placeholder="modo === 'archivo' ? 'Se usa el nombre del archivo' : 'Ej: Ficha técnica fabricante'" class="w-full p-2 border rounded-lg bg-white">
        </div>
        <div v-if="modo === 'archivo'">
          <label class="block font-bold text-slate-700 mb-1">Archivo (PDF, Word, Excel, imagen…)</label>
          <input ref="inputArchivo" type="file" @change="archivo = $event.target.files[0] || null" class="w-full p-1.5 border rounded-lg bg-white">
        </div>
        <div v-else>
          <label class="block font-bold text-slate-700 mb-1">Enlace (URL)</label>
          <input v-model="enlace" type="url" placeholder="https://..." class="w-full p-2 border rounded-lg bg-white font-mono">
        </div>
        <button @click="guardar" :disabled="guardando" class="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg shadow">
          <i :class="['fa-solid', guardando ? 'fa-spinner fa-spin' : 'fa-floppy-disk']"></i> {{ guardando ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>
    </div>
  </template>

  <!-- Lista: carpetas arriba y documentos abajo (como un explorador de archivos) -->
  <div v-if="docs.length === 0 && filasCarpeta.length === 0" class="text-center text-slate-400 py-6 border rounded-xl bg-white">
    <i :class="['text-2xl mb-1 block', busqueda || modoResultados ? 'fa-solid fa-magnifying-glass' : 'fa-regular fa-folder-open']"></i>
    {{ busqueda || modoResultados ? 'No se encontraron documentos con ese texto.' : (sub ? 'Esta subcarpeta está vacía.' : (vacio || 'Aún no hay documentos en esta carpeta.')) }}
  </div>
  <ul v-else class="divide-y border rounded-xl bg-white overflow-hidden">
    <!-- Carpetas (destino para soltar documentos) -->
    <li v-for="f in filasCarpeta" :key="'f:' + f.destino"
      @click="sub = f.abrir" @dragover.prevent="sobreCarpeta = f.destino" @dragenter.prevent="sobreCarpeta = f.destino" @dragleave="sobreCarpeta === f.destino && (sobreCarpeta = null)" @drop.prevent="soltarEn(f.destino)"
      :class="['flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer transition', sobreCarpeta === f.destino ? 'bg-amber-100 ring-2 ring-amber-400 ring-inset' : 'hover:bg-amber-50']">
      <span class="flex items-center gap-2 font-bold text-slate-700">
        <i :class="['fa-solid text-base', f.volver ? 'fa-arrow-turn-up text-slate-400' : (sobreCarpeta === f.destino ? 'fa-folder-open text-amber-500' : 'fa-folder text-amber-400')]"></i>
        {{ f.texto }}
        <span v-if="!f.volver" class="px-1.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">{{ f.total }}</span>
      </span>
      <span v-if="arrastrando" class="text-[10px] font-bold text-amber-700 uppercase">Soltar aquí</span>
      <i v-else-if="!f.volver" class="fa-solid fa-chevron-right text-slate-300"></i>
    </li>

    <li v-for="d in docs" :key="d.id" :draggable="isAdmin && editandoId !== d.id && !modoResultados"
      @dragstart="empezarArrastre(d, $event)" @dragend="terminarArrastre"
      :class="['px-3 py-2.5 hover:bg-slate-50', isAdmin && !modoResultados ? 'cursor-grab' : '', arrastrando && arrastrando.id === d.id ? 'opacity-40' : '']">
      <!-- Vista normal -->
      <div v-if="editandoId !== d.id" class="flex items-center justify-between gap-3">
        <div class="min-w-0 flex items-start gap-2">
          <i v-if="isAdmin && !modoResultados" class="fa-solid fa-grip-vertical text-slate-300 mt-0.5" title="Arrastrar a una carpeta"></i>
          <div class="min-w-0">
          <a :href="d.link" target="_blank" rel="noopener" class="flex items-center gap-2 min-w-0 font-semibold text-blue-700 hover:underline">
            <i :class="['fa-solid', esArchivoSubido(d.link) ? 'fa-file-lines text-rose-500' : 'fa-link text-sky-500']"></i>
            <span class="truncate">{{ d.nombre }}</span>
          </a>
          <p v-if="mostrarRuta(d)" class="text-[10px] text-slate-400 font-semibold mt-0.5 pl-5 truncate"><i class="fa-solid fa-folder text-amber-400"></i> {{ etiquetaRuta(d) }}</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-[10px] text-slate-400 uppercase font-bold">{{ esArchivoSubido(d.link) ? 'Archivo' : 'Enlace' }}</span>
          <a :href="d.link" target="_blank" rel="noopener" class="bg-blue-50 hover:bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold"><i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir</a>
          <button v-if="isAdmin" @click="empezarEdicion(d)" class="bg-amber-100 hover:bg-amber-200 text-amber-800 px-2 py-1 rounded font-bold" title="Modificar / mover"><i class="fa-solid fa-pen"></i></button>
          <button v-if="isAdmin" @click="eliminarDocumento(d)" class="bg-rose-100 hover:bg-rose-200 text-rose-800 px-2 py-1 rounded font-bold" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>

      <!-- Edición (solo admin) -->
      <div v-else class="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
        <p class="font-bold text-amber-800"><i class="fa-solid fa-pen"></i> Modificar documento</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Nombre</label>
            <input v-model="ed.nombre" type="text" class="w-full p-2 border rounded-lg bg-white">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Mover a</label>
            <select v-model="ed.carpeta" class="w-full p-2 border rounded-lg bg-white">
              <option v-for="op in destinosDe(d)" :key="op.valor" :value="op.valor">{{ op.texto }}</option>
            </select>
          </div>
          <div v-if="esArchivoSubido(d.link)">
            <label class="block font-bold text-slate-700 mb-1">Reemplazar archivo (opcional)</label>
            <input type="file" @change="ed.archivo = $event.target.files[0] || null" class="w-full p-1.5 border rounded-lg bg-white">
          </div>
          <div v-else>
            <label class="block font-bold text-slate-700 mb-1">Enlace (URL)</label>
            <input v-model="ed.link" type="url" class="w-full p-2 border rounded-lg bg-white font-mono">
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button @click="editandoId = null" class="px-3 py-1.5 rounded-lg bg-white border font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
          <button @click="guardarEdicion(d)" :disabled="guardando" class="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 font-bold text-slate-950">
            <i :class="['fa-solid', guardando ? 'fa-spinner fa-spin' : 'fa-floppy-disk']"></i> {{ guardando ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </div>
    </li>
  </ul>
</div>
`;

export default {
  name: 'DocumentosCarpeta',
  props: {
    carpeta: { type: String, default: '' },            // carpeta base (Área / Norma, o EQUIPO:<id>)
    vacio: { type: String, default: '' },
    resultados: { type: Array, default: null }         // si viene, solo muestra estos documentos (búsqueda global)
  },
  template,
  setup(props) {
    const modo = ref('archivo');
    const nombre = ref('');
    const enlace = ref('');
    const archivo = ref(null);
    const inputArchivo = ref(null);
    const guardando = ref(false);
    const sub = ref('');           // subcarpeta abierta ('' = principal)
    const busqueda = ref('');

    const modoResultados = computed(() => Array.isArray(props.resultados));
    const carpetaActual = computed(() => rutaSub(props.carpeta, sub.value));
    const subcarpetas = computed(() => subcarpetasDe(props.carpeta));

    const docs = computed(() => {
      if (modoResultados.value) return props.resultados;
      if (busqueda.value.trim()) return filtrarPorTexto(documentosConSub(props.carpeta), busqueda.value)
        .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
      return documentosDe(carpetaActual.value);
    });

    // Si se cambia de carpeta base, volver a la principal
    watch(() => props.carpeta, () => { sub.value = ''; busqueda.value = ''; });

    const mostrarRuta = (d) => modoResultados.value || (busqueda.value.trim() && d.carpeta !== carpetaActual.value);
    const etiquetaRuta = (d) => modoResultados.value ? d.carpeta : (subDe(d.carpeta) || 'Carpeta principal');

    const guardar = async () => {
      guardando.value = true;
      const ok = modo.value === 'archivo'
        ? await subirDocumento(carpetaActual.value, archivo.value, nombre.value)
        : await agregarEnlace(carpetaActual.value, enlace.value, nombre.value);
      guardando.value = false;
      if (ok) {
        nombre.value = ''; enlace.value = ''; archivo.value = null;
        if (inputArchivo.value) inputArchivo.value.value = '';
      }
    };

    // ---------- Filas de carpeta dentro de la lista ----------
    const filasCarpeta = computed(() => {
      if (modoResultados.value || busqueda.value.trim()) return [];
      if (sub.value) return [{ texto: 'Volver a Carpeta principal', destino: props.carpeta, abrir: '', volver: true }];
      return subcarpetas.value.map(s => ({ texto: s.nombre, destino: rutaSub(props.carpeta, s.nombre), abrir: s.nombre, total: s.total }));
    });

    // ---------- Arrastrar y soltar (solo admin) ----------
    const arrastrando = ref(null);
    const sobreCarpeta = ref(null);
    const empezarArrastre = (d, ev) => {
      if (!isAdmin.value) return;
      arrastrando.value = d;
      try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', String(d.id)); } catch (e) { /* navegador antiguo */ }
    };
    const terminarArrastre = () => { arrastrando.value = null; sobreCarpeta.value = null; };
    const soltarEn = async (destino) => {
      const d = arrastrando.value;
      terminarArrastre();
      if (!d || !isAdmin.value || d.carpeta === destino) return;
      await editarDocumento(d, { nombre: d.nombre, carpeta: destino });
    };

    // ---------- Subcarpetas ----------
    const nuevaSub = async () => {
      const n = prompt('Nombre de la nueva subcarpeta:');
      if (!n) return;
      const creada = await crearSubcarpeta(props.carpeta, n);
      if (creada) sub.value = creada;
    };
    const renombrarSub = async () => {
      const n = prompt('Nuevo nombre de la subcarpeta:', sub.value);
      if (!n) return;
      const ok = await renombrarSubcarpeta(props.carpeta, sub.value, n);
      if (ok) sub.value = ok;
    };
    const borrarSub = async () => {
      if (await eliminarSubcarpeta(props.carpeta, sub.value)) sub.value = '';
    };

    // ---------- Edición de documentos ----------
    const editandoId = ref(null);
    const ed = ref({ nombre: '', carpeta: '', archivo: null, link: '' });
    const empezarEdicion = (d) => {
      editandoId.value = d.id;
      ed.value = { nombre: d.nombre, carpeta: d.carpeta, archivo: null, link: d.link };
    };
    /** Destinos posibles para mover: la carpeta principal y las subcarpetas de la misma carpeta base. */
    const destinosDe = (d) => {
      const base = baseDe(d.carpeta);
      return [{ valor: base, texto: 'Carpeta principal' }, ...subcarpetasDe(base).map(s => ({ valor: rutaSub(base, s.nombre), texto: '📁 ' + s.nombre }))];
    };
    const guardarEdicion = async (d) => {
      guardando.value = true;
      const ok = await editarDocumento(d, {
        nombre: ed.value.nombre, carpeta: ed.value.carpeta, file: ed.value.archivo,
        link: esArchivoSubido(d.link) ? undefined : ed.value.link
      });
      guardando.value = false;
      if (ok) editandoId.value = null;
    };

    return {
      isAdmin, modo, nombre, enlace, archivo, inputArchivo, guardando, docs, guardar, eliminarDocumento, esArchivoSubido,
      sub, busqueda, subcarpetas, modoResultados, mostrarRuta, etiquetaRuta, nuevaSub, renombrarSub, borrarSub,
      editandoId, ed, empezarEdicion, destinosDe, guardarEdicion,
      filasCarpeta, arrastrando, sobreCarpeta, empezarArrastre, terminarArrastre, soltarEn
    };
  }
};
