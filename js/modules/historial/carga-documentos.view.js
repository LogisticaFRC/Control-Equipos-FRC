// =====================================================================
// HISTORIAL · Modal "Cargar documentos" (carga masiva de PDF y enlace a cada mantención / intervención)
// =====================================================================
import * as S from './carga-documentos.service.js';
import { formatDateForDisplay } from '../../core/utils.js';

const template = /* html */ `
<div v-if="showCargaDocs" class="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-3 text-xs">
  <div class="bg-white rounded-2xl shadow-2xl border w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
    <div class="px-4 py-2.5 bg-slate-800 text-white flex items-center justify-between">
      <h3 class="font-extrabold uppercase tracking-wide"><i class="fa-solid fa-folder-arrow-up mr-2 text-amber-400"></i> Cargar documentos al Historial</h3>
      <button @click="showCargaDocs = false" :disabled="subiendoCarga || releyendo" class="w-8 h-8 rounded-full bg-slate-700 hover:bg-rose-500 flex items-center justify-center"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <div class="p-3 space-y-2.5 overflow-y-auto flex-grow bg-slate-50">
      <div class="bg-white border rounded-xl p-2.5 flex flex-wrap items-center gap-2">
        <label class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-3 py-1.5 rounded-lg shadow cursor-pointer">
          <i class="fa-solid fa-folder-open mr-1"></i> Elegir carpeta
          <input type="file" webkitdirectory directory multiple @change="elegirArchivosCarga" class="hidden">
        </label>
        <label class="bg-slate-100 hover:bg-slate-200 border font-bold px-3 py-1.5 rounded-lg cursor-pointer">
          <i class="fa-solid fa-file-pdf mr-1 text-rose-600"></i> Elegir archivos
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" @change="elegirArchivosCarga" class="hidden">
        </label>
        <p class="text-slate-500 flex-1 min-w-[220px] text-[10px] leading-tight">Lee <b>AFI</b> y <b>fecha</b> del nombre (o de la carpeta). "MANTENCION" → mantención de ese día; si no, otra intervención. Puedes sumar varias carpetas.</p>
        <div class="w-full flex flex-wrap items-center gap-2 border-t pt-2">
          <label class="flex items-center gap-1.5 font-semibold text-indigo-800" title="Lee lo impreso: tipo de hoja, N° de folio, si trae ART y N° de OC impresa. Solo completa campos vacíos."><input type="checkbox" v-model="leerContenidoCarga"> <i class="fa-solid fa-wand-magic-sparkles"></i> Leer el contenido al subir (folio, ART, OC)</label>
          <span class="flex-1"></span>
          <template v-if="!releyendo">
            <span class="text-slate-500 text-[10px]">{{ pendientesRelectura.length }} ya subidos sin leer</span>
            <select v-model="loteRelectura" class="p-1 border rounded text-[11px]"><option :value="10">10</option><option :value="25">25</option><option :value="50">50</option><option :value="100">100</option></select>
            <button @click="releerSubidos" :disabled="subiendoCarga || !pendientesRelectura.length" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg disabled:opacity-40"><i class="fa-solid fa-book-open-reader mr-1"></i> Leer documentos ya subidos</button>
          </template>
          <template v-else>
            <span class="text-indigo-700 font-bold"><i class="fa-solid fa-spinner fa-spin"></i> Leyendo {{ progresoCarga.hechos }} / {{ progresoCarga.total }}</span>
            <button @click="detenerRelectura" class="border border-rose-300 text-rose-700 font-bold px-2 py-1 rounded-lg">Detener</button>
          </template>
        </div>
      </div>

      <div v-if="lecturasLog.length" class="bg-white border border-indigo-200 rounded-xl overflow-hidden">
        <div class="px-2.5 py-1.5 bg-indigo-50 flex items-center justify-between gap-2">
          <b class="text-indigo-900"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i> Lecturas ({{ lecturasLog.length }}) · solo se completaron campos vacíos</b>
          <button @click="deshacerLecturas" class="text-rose-700 font-bold hover:underline"><i class="fa-solid fa-rotate-left"></i> Deshacer lo completado</button>
        </div>
        <div class="max-h-40 overflow-y-auto divide-y">
          <div v-for="(e, k) in lecturasLog" :key="k" :class="['px-2.5 py-1 flex flex-wrap gap-x-2', e.deshecho ? 'opacity-40 line-through' : '']">
            <span class="font-mono font-bold text-amber-700">{{ e.afi }}</span><span class="text-slate-500">{{ formatDateForDisplay(e.fecha) }}</span>
            <span class="text-slate-700">{{ e.resumen }}</span>
            <span v-if="e.cambios.length" class="text-emerald-700 font-semibold">→ {{ e.cambios.join(' · ') }}</span><span v-else class="text-slate-400">→ sin cambios</span>
            <span v-if="e.aviso" class="text-amber-700 font-bold"><i class="fa-solid fa-triangle-exclamation"></i> {{ e.aviso }}</span>
          </div>
        </div>
      </div>

      <template v-if="filasCarga.length">
        <div class="flex flex-wrap gap-1.5">
          <button v-for="b in [{k:'TODOS',l:'Todos',n:resumenCarga.total,c:'bg-white'},{k:'OK',l:'Listos',n:resumenCarga.OK,c:'bg-emerald-50 border-emerald-300 text-emerald-800'},{k:'REVISAR',l:'Revisar',n:resumenCarga.REVISAR,c:'bg-amber-50 border-amber-300 text-amber-800'},{k:'YA_TIENE',l:'Ya tienen documento',n:resumenCarga.YA_TIENE,c:'bg-sky-50 border-sky-300 text-sky-800'},{k:'SIN_REG',l:'Sin registro',n:resumenCarga.SIN_REG,c:'bg-rose-50 border-rose-300 text-rose-800'},{k:'SIN_AFI',l:'Sin AFI',n:resumenCarga.SIN_AFI,c:'bg-slate-100 border-slate-300'}]" :key="b.k"
            @click="filtroCarga = b.k" :class="['rounded-full border px-2.5 py-1 font-bold', b.c, filtroCarga === b.k ? 'ring-2 ring-slate-800' : '']">
            {{ b.l }} <span class="font-extrabold">{{ b.n }}</span>
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-4">
          <label class="flex items-center gap-2 font-semibold"><input type="checkbox" v-model="reemplazarExistentes"> Reemplazar el documento de los registros que ya tienen uno</label>
          <span v-if="ignoradosCarga.length" class="text-slate-500" :title="ignoradosCarga.join('\\n')">{{ ignoradosCarga.length }} archivo(s) ignorados (no son PDF/imagen)</span>
        </div>

        <div class="bg-white border rounded-xl overflow-auto max-h-[46vh]">
          <table class="w-full text-left text-[11px]">
            <thead class="bg-slate-100 text-slate-600 sticky top-0 z-10"><tr>
              <th class="p-1.5 w-6"></th><th class="p-1.5">Archivo</th><th class="p-1.5 w-16">AFI</th><th class="p-1.5">Fecha</th><th class="p-1.5">Tipo</th><th class="p-1.5">Registro</th><th class="p-1.5">Estado</th><th class="p-1.5"></th>
            </tr></thead>
            <tbody>
              <tr v-for="f in filasVisibles" :key="f.uid" :class="['border-t align-top', f.error ? 'bg-rose-50' : '']">
                <td class="p-1.5"><input type="checkbox" v-model="f.incluir" :disabled="!f.regId"></td>
                <td class="p-1.5 max-w-[200px]" :title="f.ruta + ' · ' + fmtMB(f.tamano)"><span class="font-semibold block truncate">{{ f.nombre }}</span><span v-if="f.error" class="block text-[10px] text-rose-600">{{ f.error }}</span></td>
                <td class="p-1.5"><input v-model="f.afiTexto" @change="cambiarAfiFila(f)" :class="['w-14 p-0.5 border rounded font-mono font-bold', f.afi ? '' : 'border-rose-400 bg-rose-50']"></td>
                <td class="p-1.5"><input v-model="f.fecha" @change="cambiarFechaFila(f)" type="date" class="p-0.5 border rounded w-[118px]"></td>
                <td class="p-1.5"><span @click="f.esMant = !f.esMant; cambiarAfiFila(f)" title="Clic para cambiar" :class="['px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer', f.esMant ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700']">{{ f.esMant ? 'MANT.' : 'OTRA' }}</span></td>
                <td class="p-1.5 min-w-[190px]">
                  <select v-model="f.regId" @change="f.incluir = Boolean(f.regId); f.nivel = 'MANUAL'" :disabled="!f.afi" class="w-full p-0.5 border rounded">
                    <option value="">— No enlazar —</option>
                    <option v-for="r in f.opciones" :key="r.id" :value="r.id">{{ textoRegistro(r) }}</option>
                  </select>
                </td>
                <td class="p-1.5"><span :class="['px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap', estadoFila(f).cls]">{{ estadoFila(f).label }}</span></td>
                <td class="p-1.5 text-right"><button @click="quitarFila(f)" class="text-slate-400 hover:text-rose-600" title="Quitar de la lista"><i class="fa-solid fa-xmark"></i></button></td>
              </tr>
              <tr v-if="!filasVisibles.length"><td colspan="8" class="p-6 text-center text-slate-400">Nada en este filtro.</td></tr>
            </tbody>
          </table>
        </div>
        <div v-if="progresoCarga.errores.length" class="bg-rose-50 border border-rose-300 rounded-xl p-3 text-rose-800">
          <b>Errores:</b><div v-for="(e, i) in progresoCarga.errores" :key="i">{{ e }}</div>
        </div>
      </template>
      <div v-if="!filasCarga.length && progresoCarga.errores.length" class="bg-rose-50 border border-rose-300 rounded-xl p-3 text-rose-800">
        <b>Errores:</b><div v-for="(e, i) in progresoCarga.errores" :key="i">{{ e }}</div>
      </div>
      <p v-if="!filasCarga.length" class="text-center text-slate-400 py-6">Elige una carpeta (por ejemplo <b>2026 → ABRIL</b>) para ver qué archivo va con qué registro antes de subir.</p>
    </div>

    <div class="px-4 py-2 border-t bg-white flex flex-wrap items-center justify-between gap-2">
      <span class="text-slate-600"><b>{{ resumenCarga.aSubir }}</b> archivo(s) → <b>{{ resumenCarga.registros || 0 }}</b> registro(s) · {{ fmtMB(resumenCarga.mb) }}
        <span v-if="subiendoCarga" class="ml-2 text-blue-700 font-bold"><i class="fa-solid fa-spinner fa-spin"></i> Subiendo {{ progresoCarga.hechos }} / {{ progresoCarga.total }}</span>
      </span>
      <div class="flex gap-2">
        <button @click="showCargaDocs = false" :disabled="subiendoCarga" class="px-4 py-2 rounded-lg border font-bold">Cerrar</button>
        <button @click="subirCargaDocs" :disabled="subiendoCarga || !resumenCarga.aSubir" class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow disabled:opacity-50"><i class="fa-solid fa-cloud-arrow-up mr-1"></i> Subir y enlazar</button>
      </div>
    </div>
  </div>
</div>
`;

export default {
  name: 'CargaDocumentos',
  template,
  setup() { return { ...S, formatDateForDisplay }; }
};
