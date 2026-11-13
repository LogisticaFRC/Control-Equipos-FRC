// =====================================================================
// MECÁNICOS · Panel del supervisor / Admin (área MECÁNICOS del menú)
//   Intervenciones enviadas desde la app → ver la hoja con el formato oficial → corregir → firmar
//   → pasa sola al Historial (PDF igual al formato). También: rechazar para que el mecánico corrija.
// =====================================================================
import * as S from './mecanicos.service.js';
import { logoSrc } from '../configuracion/configuracion.service.js';
import { formatDateForDisplay } from '../../core/utils.js';
import { dbUsuarios, permisosDe } from '../../core/store.js';
import { CAUSAS_ELECTRICA, CAUSAS_FALLA_MEC } from './hojas.js';
import { listaCausas } from '../historial/historial.service.js';

const { ref, computed, onMounted } = Vue;

export default {
  name: 'MecanicosPanelView',
  template: /* html */ `
<div class="space-y-4 text-xs">
  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl"><i class="fa-solid fa-user-gear"></i></div>
        <div><h2 class="text-lg font-extrabold text-slate-800">MECÁNICOS · Intervenciones de la app</h2>
          <p class="text-slate-500">Lo que llenan los mecánicos en el celular. Revisa, firma como supervisor y pasa sola al Historial con la hoja oficial.</p></div>
      </div>
      <div class="flex gap-2">
        <button @click="S.cargarMec()" class="w-9 h-9 rounded-xl border text-slate-500 hover:bg-slate-50" title="Actualizar"><i :class="['fa-solid fa-rotate', S.cargandoMec.value ? 'fa-spin' : '']"></i></button>
        <button @click="S.vistaAppForzada.value = true" class="bg-[#1f4d3a] hover:bg-emerald-900 text-white font-bold px-4 py-2 rounded-xl shadow"><i class="fa-solid fa-mobile-screen mr-1"></i>Ver la app como mecánico</button>
      </div>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
      <button v-for="k in kpis" :key="k.e" @click="S.filtroPanel.value = k.e" :class="['rounded-xl border p-3 text-left', k.c, S.filtroPanel.value === k.e ? 'ring-2 ring-emerald-500' : '']">
        <p class="text-[10px] font-extrabold uppercase opacity-80">{{ k.t }}</p><p class="text-2xl font-extrabold">{{ k.n }}</p></button>
    </div>
    <div class="mt-3 text-[11px] text-slate-500"><i class="fa-solid fa-users mr-1"></i>Mecánicos: <b>{{ mecanicos.join(', ') || 'ninguno aún' }}</b> · Supervisores: <b>{{ supervisores.join(', ') || '—' }}</b>
      <span class="ml-1">(se asignan en Config & Usuarios → tipo "Mecánico", o área Mecánicos = Admin para supervisor)</span></div>
  </div>

  <div v-if="S.faltaSQLMec.value" class="bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl p-4 text-sm"><i class="fa-solid fa-database mr-1"></i>Falta ejecutar <b>sql/mecanicos.sql</b> en Supabase.</div>

  <div class="grid grid-cols-1 xl:grid-cols-5 gap-4">
    <!-- Lista -->
    <div class="xl:col-span-2 space-y-3">
    <!-- Carpetas por cuenta -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-3">
      <div class="text-[10px] font-extrabold uppercase text-slate-500 mb-2"><i class="fa-solid fa-folder-tree mr-1"></i>Carpetas por mecánico</div>
      <div class="flex flex-wrap gap-1.5">
        <button @click="S.carpetaPanel.value = ''" :class="['px-2.5 py-1.5 rounded-lg border font-bold', !S.carpetaPanel.value ? 'bg-slate-800 text-white border-slate-800' : 'bg-white']"><i class="fa-solid fa-folder mr-1"></i>Todas</button>
        <button v-for="c in S.carpetasPanel.value" :key="c.usuario" @click="S.carpetaPanel.value = c.usuario" :class="['px-2.5 py-1.5 rounded-lg border font-bold', S.carpetaPanel.value === c.usuario ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-slate-700']">
          <i class="fa-solid fa-folder mr-1 text-amber-500"></i>{{ c.nombre }} <span class="ml-1 text-[10px] px-1.5 rounded bg-amber-100 text-amber-800">{{ c.sinFirma }} sin firma</span> <span class="text-[10px] px-1.5 rounded bg-emerald-100 text-emerald-800">{{ c.realizados }}</span></button>
      </div>
    </div>
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-fit">
      <div v-for="r in S.listaPanel.value" :key="r.id" @click="S.abrirRegPanel(r)" :class="['p-3 border-b cursor-pointer hover:bg-slate-50', S.regPanel.value && S.regPanel.value.id === r.id ? 'bg-emerald-50' : '']">
        <div class="flex items-start justify-between gap-2">
          <div><b class="text-amber-700">AFI {{ r.afi }}</b> <span class="font-bold text-slate-700">· {{ r.tipo === 'ELECTRICA' ? 'Eléctrica' : 'Mecánica' }}</span>
            <div class="text-slate-500 font-mono">{{ formatDateForDisplay(r.fecha) }} · N° {{ r.id }} · {{ (r.mecanicos || []).map(m => m.nombre).join(', ') }}</div></div>
          <span :class="['text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap', S.ESTADOS_MEC[r.estado]?.c]">{{ S.ESTADOS_MEC[r.estado]?.t }}</span>
        </div>
        <div class="text-slate-600 mt-1 line-clamp-2"><b v-if="r.tipo === 'MECANICA' && r.causa_falla">{{ r.causa_falla }} · </b>{{ r.causa_intervencion }} — {{ r.descripcion }}</div>
        <div v-if="r.bloqueo" class="text-[10px] font-bold text-violet-700 mt-0.5"><i class="fa-solid fa-lock mr-0.5"></i>Con registro de bloqueo</div>
      </div>
      <div v-if="!S.listaPanel.value.length" class="p-10 text-center text-slate-400 font-bold">No hay intervenciones en este estado.</div>
    </div>
    </div>

    <!-- Detalle -->
    <div class="xl:col-span-3">
      <div v-if="!r" class="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-400 font-bold">Elige una intervención de la lista.</div>
      <div v-else class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b bg-slate-50">
          <div class="font-extrabold text-slate-800">N° {{ r.id }} · AFI {{ r.afi }} · {{ r.tipo === 'ELECTRICA' ? 'Intervención eléctrica' : 'Intervención mecánica' }}</div>
          <div class="flex gap-2">
            <button @click="S.descargarPDF(r)" class="px-3 py-1.5 rounded-lg border font-bold"><i class="fa-solid fa-file-pdf text-rose-600 mr-1"></i>PDF</button>
            <a v-if="r.documento_url" :href="r.documento_url" target="_blank" class="px-3 py-1.5 rounded-lg border font-bold text-emerald-700"><i class="fa-solid fa-link mr-1"></i>Doc. Historial</a>
            <button @click="editando = !editando" v-if="r.estado !== 'EN_HISTORIAL'" :class="['px-3 py-1.5 rounded-lg border font-bold', editando ? 'bg-amber-100 border-amber-300' : '']"><i class="fa-solid fa-pen mr-1"></i>{{ editando ? 'Ver hoja' : 'Corregir' }}</button>
            <button @click="S.eliminarReg(r)" class="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 font-bold"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <!-- Corregir datos -->
        <div v-if="editando" class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="block"><span class="font-bold">Fecha</span><input type="date" v-model="r.fecha" class="mt-1 w-full p-2 border rounded-lg"></label>
          <label class="block"><span class="font-bold">Horómetro</span><input v-model="r.horometro" class="mt-1 w-full p-2 border rounded-lg font-mono"></label>
          <label class="block"><span class="font-bold">Lugar</span><input v-model="r.lugar" class="mt-1 w-full p-2 border rounded-lg"></label>
          <div class="grid grid-cols-3 gap-2"><label v-for="h in [['hora_falla','H. falla'],['hora_inicio','H. inicio'],['hora_termino','H. término']]" :key="h[0]"><span class="font-bold">{{ h[1] }}</span><input type="time" v-model="r[h[0]]" class="mt-1 w-full p-2 border rounded-lg"></label></div>
          <label v-if="r.tipo === 'ELECTRICA'" class="block sm:col-span-2"><span class="font-bold">Causa</span><select v-model="r.causa_intervencion" class="mt-1 w-full p-2 border rounded-lg"><option v-for="c in CAUSAS_ELECTRICA" :key="c">{{ c }}</option></select></label>
          <template v-else>
            <label class="block"><span class="font-bold">Causa de la intervención</span><select v-model="r.causa_falla" class="mt-1 w-full p-2 border rounded-lg"><option value="">—</option><option v-for="c in listaCausas" :key="c">{{ c }}</option></select></label>
            <label class="block"><span class="font-bold">Razón de la causa</span><input v-model="r.causa_intervencion" class="mt-1 w-full p-2 border rounded-lg"></label>
          </template>
          <label class="block sm:col-span-2"><span class="font-bold">Descripción de lo realizado</span><textarea v-model="r.descripcion" rows="5" class="mt-1 w-full p-2 border rounded-lg"></textarea></label>
          <label class="block sm:col-span-2"><span class="font-bold">Interferencia</span><input v-model="r.interferencia" class="mt-1 w-full p-2 border rounded-lg"></label>
          <label v-if="r.tipo === 'MECANICA'" class="block"><span class="font-bold">Usuario arriendo</span><input v-model="r.usuario_arriendo" class="mt-1 w-full p-2 border rounded-lg"></label>
          <p class="sm:col-span-2 text-[11px] text-slate-500">Los cambios se guardan al firmar.</p>
        </div>
        <!-- Hoja con el formato -->
        <div v-else class="bg-slate-100 p-3 overflow-x-auto">
          <div class="origin-top-left mx-auto" :style="{ width: 794 * escala + 'px', height: altoHoja * escala + 'px' }">
            <div ref="hojaEl" :style="{ transform: 'scale(' + escala + ')', transformOrigin: 'top left', width: '794px' }" v-html="S.htmlHoja(r, logoSrc)"></div>
          </div>
          <div v-if="r.bloqueo && r.registro_bloqueo" class="mt-3 overflow-x-auto"><div class="text-[11px] font-bold text-violet-700 mb-1"><i class="fa-solid fa-lock mr-1"></i>Registro de bloqueo (página 2 del PDF)</div>
            <div :style="{ width: 1123 * escala * 0.85 + 'px' }"><div :style="{ transform: 'scale(' + (escala * 0.85) + ')', transformOrigin: 'top left', width: '1123px' }" v-html="S.htmlBloqueo(r, logoSrc)"></div></div></div>
        </div>
        <!-- Firma del supervisor -->
        <div v-if="['PENDIENTE_FIRMA','RECHAZADA'].includes(r.estado)" class="p-4 border-t bg-emerald-50/50 space-y-3">
          <h4 class="font-extrabold text-emerald-900"><i class="fa-solid fa-signature mr-1"></i>Firma del supervisor</h4>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label class="block"><span class="font-bold">Nombre</span><input v-model="S.firmaPanel.value.nombre" class="mt-1 w-full p-2 border rounded-lg bg-white"></label>
            <label class="block"><span class="font-bold">Empresa</span><input v-model="S.firmaPanel.value.empresa" class="mt-1 w-full p-2 border rounded-lg bg-white uppercase"></label>
            <label class="block"><span class="font-bold">Supervisor de</span><select v-model="S.firmaPanel.value.tipo" class="mt-1 w-full p-2 border rounded-lg bg-white"><option value="FRC">FRC (taller)</option><option value="CLIENTE">Cliente</option></select></label>
          </div>
          <firma-pad :firma="S.firmaPanel.value.firma" titulo="Firma del supervisor" @guardar="v => S.firmaPanel.value.firma = v"></firma-pad>
          <div class="flex flex-wrap gap-2 justify-end">
            <button @click="S.rechazarReg(r)" class="px-4 py-2 rounded-xl border border-rose-300 text-rose-700 font-bold bg-white"><i class="fa-solid fa-rotate-left mr-1"></i>Rechazar (corregir)</button>
            <button @click="S.firmarYPasar()" :disabled="S.procesando.value" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold disabled:opacity-60"><i :class="['fa-solid mr-1', S.procesando.value ? 'fa-spinner fa-spin' : 'fa-file-signature']"></i>Firmar y pasar al Historial</button>
          </div>
        </div>
        <div v-else-if="r.estado === 'FIRMADA'" class="p-4 border-t bg-sky-50 flex items-center justify-between gap-2">
          <span class="text-sky-900 font-semibold">Firmada por {{ r.supervisor?.nombre }} ({{ r.supervisor?.empresa }}), pero no alcanzó a pasar al Historial.</span>
          <button @click="S.reintentarHistorial(r)" :disabled="S.procesando.value" class="px-4 py-2 rounded-xl bg-sky-600 text-white font-bold"><i :class="['fa-solid mr-1', S.procesando.value ? 'fa-spinner fa-spin' : 'fa-arrow-right']"></i>Pasar al Historial</button>
        </div>
        <div v-else-if="r.estado === 'EN_HISTORIAL'" class="p-4 border-t bg-emerald-50 text-emerald-900 font-semibold"><i class="fa-solid fa-circle-check mr-1"></i>En el Historial del AFI {{ r.afi }} · firmó {{ r.supervisor?.nombre }} ({{ r.supervisor?.empresa }}).</div>
      </div>
    </div>
  </div>
</div>`,
  setup() {
    const editando = ref(false);
    const r = computed(() => S.regPanel.value);
    const escala = ref(Math.min(1, (window.innerWidth > 1280 ? 760 : window.innerWidth - 60) / 794));
    const altoHoja = 1123;
    const kpis = computed(() => [
      { e: 'PENDIENTE_FIRMA', t: 'Por firmar', n: S.conteoPanel.value.PENDIENTE_FIRMA, c: 'bg-amber-50 text-amber-800 border-amber-200' },
      { e: 'RECHAZADA', t: 'Rechazadas', n: S.conteoPanel.value.RECHAZADA, c: 'bg-rose-50 text-rose-800 border-rose-200' },
      { e: 'FIRMADA', t: 'Firmadas sin pasar', n: S.conteoPanel.value.FIRMADA, c: 'bg-sky-50 text-sky-800 border-sky-200' },
      { e: 'EN_HISTORIAL', t: 'En Historial', n: S.conteoPanel.value.EN_HISTORIAL, c: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
      { e: '', t: 'Todas', n: S.dbMec.value.length, c: 'bg-white text-slate-700 border-slate-200' }
    ]);
    const mecanicos = computed(() => dbUsuarios.value.filter(u => u.rol !== 'admin' && permisosDe(u).mecanicos === 'subadmin').map(u => u.usuario));
    const supervisores = computed(() => dbUsuarios.value.filter(u => u.rol !== 'admin' && permisosDe(u).mecanicos === 'admin').map(u => u.usuario));
    onMounted(() => S.cargarMec());
    return { S, r, editando, escala, altoHoja, kpis, mecanicos, supervisores, logoSrc, formatDateForDisplay, CAUSAS_ELECTRICA, CAUSAS_FALLA_MEC, listaCausas };
  }
};
