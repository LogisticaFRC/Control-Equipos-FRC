// =====================================================================
// FORMATOS · Componente reutilizable "carpeta de documentos"
// Uso: <documentos-carpeta :carpeta="'RRHH / ISO CALIDAD 9001'" titulo="..."></documentos-carpeta>
// - ADMIN: ve el panel para "Subir archivo" o "Agregar enlace" y puede eliminar.
// - SUBADMIN / LECTURA: solo ven la lista y abren/descargan.
// =====================================================================
import { isAdmin } from '../../core/store.js';
import { documentosDe, subirDocumento, agregarEnlace, eliminarDocumento, esArchivoSubido } from './formatos.service.js';

const { ref, computed } = Vue;

const template = /* html */ `
<div class="space-y-3 text-xs">
  <!-- Panel de carga: SOLO ADMIN -->
  <div v-if="isAdmin" class="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 space-y-3">
    <div class="flex items-center gap-2">
      <span class="text-[10px] font-bold uppercase bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full"><i class="fa-solid fa-user-shield"></i> Solo Admin</span>
      <div class="flex bg-white border rounded-lg overflow-hidden">
        <button @click="modo = 'archivo'" :class="['px-3 py-1.5 font-bold', modo === 'archivo' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100']"><i class="fa-solid fa-upload"></i> Subir archivo</button>
        <button @click="modo = 'enlace'" :class="['px-3 py-1.5 font-bold', modo === 'enlace' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100']"><i class="fa-solid fa-link"></i> Agregar enlace</button>
      </div>
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

  <!-- Lista visible para todos -->
  <div v-if="docs.length === 0" class="text-center text-slate-400 py-6 border rounded-xl bg-white">
    <i class="fa-regular fa-folder-open text-2xl mb-1 block"></i> {{ vacio || 'Aún no hay documentos en esta carpeta.' }}
  </div>
  <ul v-else class="divide-y border rounded-xl bg-white overflow-hidden">
    <li v-for="d in docs" :key="d.id" class="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-50">
      <a :href="d.link" target="_blank" rel="noopener" class="flex items-center gap-2 min-w-0 font-semibold text-blue-700 hover:underline">
        <i :class="['fa-solid', esArchivoSubido(d.link) ? 'fa-file-lines text-rose-500' : 'fa-link text-sky-500']"></i>
        <span class="truncate">{{ d.nombre }}</span>
      </a>
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-[10px] text-slate-400 uppercase font-bold">{{ esArchivoSubido(d.link) ? 'Archivo' : 'Enlace' }}</span>
        <a :href="d.link" target="_blank" rel="noopener" class="bg-blue-50 hover:bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold"><i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir</a>
        <button v-if="isAdmin" @click="eliminarDocumento(d)" class="bg-rose-100 hover:bg-rose-200 text-rose-800 px-2 py-1 rounded font-bold" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
      </div>
    </li>
  </ul>
</div>
`;

export default {
  name: 'DocumentosCarpeta',
  props: { carpeta: { type: String, required: true }, vacio: { type: String, default: '' } },
  template,
  setup(props) {
    const modo = ref('archivo');
    const nombre = ref('');
    const enlace = ref('');
    const archivo = ref(null);
    const inputArchivo = ref(null);
    const guardando = ref(false);

    const docs = computed(() => documentosDe(props.carpeta));

    const guardar = async () => {
      guardando.value = true;
      const ok = modo.value === 'archivo'
        ? await subirDocumento(props.carpeta, archivo.value, nombre.value)
        : await agregarEnlace(props.carpeta, enlace.value, nombre.value);
      guardando.value = false;
      if (ok) {
        nombre.value = ''; enlace.value = ''; archivo.value = null;
        if (inputArchivo.value) inputArchivo.value.value = '';
      }
    };

    return { isAdmin, modo, nombre, enlace, archivo, inputArchivo, guardando, docs, guardar, eliminarDocumento, esArchivoSubido };
  }
};
