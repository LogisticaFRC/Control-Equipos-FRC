// =====================================================================
// CHOFER · Formulario Check list / Report Camión Pluma (app del celular) · 2026-11-17
// 4 pasos: Camión · Check list · Report (traslados) · Enviar. Ver chofer.service.js.
// =====================================================================
import * as C from './chofer.service.js';
import { dbEquipos } from '../../core/store.js';
import { formatDateForDisplay } from '../../core/utils.js';

const { watch } = Vue;

export const ChoferChecklist = {
  name: 'ChoferChecklist',
  template: /* html */ `
<div v-if="f" class="pb-28">
  <div class="px-4 pt-3">
    <div class="flex gap-1.5">
      <button v-for="(p, i) in C.PASOS_CHECK" :key="i" @click="C.pasoCheck.value = i + 1" :class="['flex-1 h-2 rounded-full', i + 1 <= C.pasoCheck.value ? 'bg-sky-600' : 'bg-slate-300']" :aria-label="p"></button>
    </div>
    <p class="text-xs font-bold text-slate-500 mt-1">Paso {{ C.pasoCheck.value }} de 4 · {{ C.PASOS_CHECK[C.pasoCheck.value - 1] }}</p>
  </div>

  <!-- 1 · CAMIÓN -->
  <section v-show="C.pasoCheck.value === 1" class="p-4 space-y-3">
    <div class="bg-white rounded-2xl shadow-sm p-4 space-y-3">
      <label class="block"><span class="lbl">Patente del camión</span>
        <input v-model="f.patente" list="dl-chofer-camiones" @change="C.alElegirCamion(f)" class="inp font-mono font-black uppercase text-lg" placeholder="Ej: LYXV-16" data-chofer="patente"></label>
      <datalist id="dl-chofer-camiones"><option v-for="c in C.camiones.value" :key="c.id" :value="c.afi">{{ c.tipo }} {{ c.marca }} {{ c.modelo }}</option></datalist>
      <div class="grid grid-cols-2 gap-2">
        <label class="block"><span class="lbl">Marca</span><input v-model="f.marca" class="inp"></label>
        <label class="block"><span class="lbl">Modelo</span><input v-model="f.modelo" class="inp"></label>
      </div>
      <label class="block"><span class="lbl">Fecha</span><input type="date" v-model="f.fecha" class="inp"></label>
      <div class="grid grid-cols-2 gap-2">
        <label class="block"><span class="lbl">Venc. revisión técnica</span><input type="date" v-model="f.venc_revision" class="inp px-2"></label>
        <label class="block"><span class="lbl">Venc. permiso circulación</span><input type="date" v-model="f.venc_permiso" class="inp px-2"></label>
      </div>
    </div>
    <div class="bg-white rounded-2xl shadow-sm p-4 space-y-2">
      <div class="lbl"><i class="fa-solid fa-truck mr-1"></i>Camión</div>
      <div class="grid grid-cols-3 gap-2 text-center">
        <span class="text-[10px] font-bold text-slate-400 col-span-3 grid grid-cols-3"><span>Inicio</span><span>Término</span><span>Próx. mant.</span></span>
        <input v-model="f.km_ini" inputmode="numeric" class="inp px-2 font-mono" placeholder="Km" data-chofer="km_ini">
        <input v-model="f.km_fin" inputmode="numeric" class="inp px-2 font-mono" placeholder="Km" data-chofer="km_fin">
        <input v-model="f.km_prox" inputmode="numeric" class="inp px-2 font-mono" placeholder="Km">
        <input v-model="f.cam_hrs_ini" inputmode="decimal" class="inp px-2 font-mono" placeholder="Hrs">
        <input v-model="f.cam_hrs_fin" inputmode="decimal" class="inp px-2 font-mono" placeholder="Hrs">
        <input v-model="f.cam_hrs_prox" inputmode="decimal" class="inp px-2 font-mono" placeholder="Hrs">
      </div>
      <div class="lbl pt-2"><i class="fa-solid fa-trowel mr-1"></i>Pluma (horas)</div>
      <div class="grid grid-cols-3 gap-2">
        <input v-model="f.pluma_hrs_ini" inputmode="decimal" class="inp px-2 font-mono" placeholder="Inicio">
        <input v-model="f.pluma_hrs_fin" inputmode="decimal" class="inp px-2 font-mono" placeholder="Término">
        <input v-model="f.pluma_hrs_prox" inputmode="decimal" class="inp px-2 font-mono" placeholder="Próx. mant.">
      </div>
    </div>
  </section>

  <!-- 2 · CHECK LIST -->
  <section v-show="C.pasoCheck.value === 2" class="p-4 space-y-3">
    <p v-if="C.faltantesCheck.value.length" class="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-2.5">Faltan <b>{{ C.faltantesCheck.value.length }}</b> ítem(s) por marcar.</p>
    <div v-for="g in C.GRUPOS_CHECK" :key="g" class="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div class="px-4 py-2.5 bg-sky-700 text-white font-black flex items-center justify-between">
        <span>{{ g }}</span>
        <button @click="C.marcarTodoBueno(g)" class="text-[11px] font-bold bg-white/20 rounded-lg px-2 py-1">Todo bueno</button>
      </div>
      <div v-for="it in C.ITEMS_CHECK.filter(x => x.grupo === g)" :key="it.k" class="px-3 py-2 border-b last:border-0 flex items-center gap-2">
        <span class="flex-1 text-sm font-semibold text-slate-700 leading-tight">{{ it.texto }}</span>
        <button v-for="o in C.OPCIONES_CHECK" :key="o.v" @click="f.checklist[it.k] = f.checklist[it.k] === o.v ? '' : o.v" :data-check="it.k + '-' + o.v"
          :class="['w-12 py-2 rounded-lg border-2 text-[11px] font-black', f.checklist[it.k] === o.v ? o.c : 'bg-white text-slate-400 border-slate-200']">{{ o.l }}</button>
      </div>
    </div>
  </section>

  <!-- 3 · REPORT (traslados) -->
  <section v-show="C.pasoCheck.value === 3" class="p-4 space-y-3">
    <p class="text-xs bg-sky-50 border border-sky-200 text-sky-900 rounded-xl p-2.5"><i class="fa-solid fa-circle-info mr-1"></i>Cada actividad con <b>AFI</b> queda registrada como <b>movimiento</b> (desde → hasta) con tu camión.</p>
    <div v-for="(a, k) in f.actividades" :key="k" class="bg-white rounded-2xl shadow-sm p-4 space-y-2">
      <div class="flex items-center justify-between"><b class="text-sky-800">Actividad {{ k + 1 }}</b>
        <select v-model="a.traslado" class="text-xs font-bold border rounded-lg px-2 py-1.5"><option value="">Traslado…</option><option v-for="t in C.TIPOS_TRASLADO" :key="t">{{ t }}</option></select></div>
      <div class="grid grid-cols-3 gap-2">
        <input v-model="a.afi" @change="C.alCambiarAfiAct(a)" list="dl-chofer-afi" class="inp px-2 font-mono font-black uppercase" placeholder="AFI" :data-chofer="'afi' + k">
        <input v-model="a.equipo" class="inp px-2 col-span-2" placeholder="Equipo (ej. Generador)">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <input v-model="a.desde" class="inp px-2" placeholder="Desde" :data-chofer="'desde' + k">
        <input v-model="a.hasta" class="inp px-2" placeholder="Hasta" :data-chofer="'hasta' + k">
      </div>
      <div class="grid grid-cols-3 gap-2">
        <label class="block"><span class="text-[10px] font-bold text-slate-400">Hora inicio</span><input type="time" v-model="a.h_ini" class="inp px-1"></label>
        <label class="block"><span class="text-[10px] font-bold text-slate-400">Hora término</span><input type="time" v-model="a.h_fin" class="inp px-1"></label>
        <label class="block"><span class="text-[10px] font-bold text-slate-400">C/U</span><input v-model="a.cu" class="inp px-2"></label>
      </div>
    </div>
    <datalist id="dl-chofer-afi"><option v-for="e in dbEquipos" :key="e.id" :value="e.afi">{{ e.tipo }} {{ e.marca }} {{ e.modelo }}</option></datalist>
  </section>

  <!-- 4 · ENVIAR -->
  <section v-show="C.pasoCheck.value === 4" class="p-4 space-y-3">
    <label class="block bg-white rounded-2xl shadow-sm p-4"><span class="lbl">Observaciones</span><textarea v-model="f.observaciones" rows="4" class="inp" placeholder="Fallas, novedades del camión o del traslado…"></textarea></label>
    <div class="bg-white rounded-2xl shadow-sm p-4 text-sm space-y-1">
      <p><b>Camión:</b> {{ f.patente || '—' }} {{ f.marca }} {{ f.modelo }} · {{ formatDateForDisplay(f.fecha) }}</p>
      <p><b>Km:</b> {{ f.km_ini || '—' }} → {{ f.km_fin || '—' }}</p>
      <p><b>Check list:</b> {{ C.ITEMS_CHECK.length - C.faltantesCheck.value.length }}/{{ C.ITEMS_CHECK.length }} marcados<span v-if="C.malosCheck.value.length" class="text-rose-700 font-bold"> · {{ C.malosCheck.value.length }} MALO: {{ C.malosCheck.value.map(i => i.texto).join(', ') }}</span></p>
      <p><b>Traslados:</b> {{ C.actividadesLlenas(f).length }}</p>
    </div>
  </section>

  <!-- Navegación -->
  <div class="fixed bottom-0 inset-x-0 max-w-xl mx-auto p-3 bg-white/95 border-t flex gap-2 z-30">
    <button v-if="C.pasoCheck.value > 1" @click="C.pasoCheck.value--" class="flex-1 py-3.5 rounded-2xl border-2 bg-white font-extrabold text-slate-600">Atrás</button>
    <button v-if="C.pasoCheck.value < 4" @click="C.pasoCheck.value++" class="flex-[2] py-3.5 rounded-2xl bg-sky-600 text-white font-extrabold text-lg" data-chofer="siguiente">Siguiente</button>
    <button v-else @click="C.enviarChecklist" :disabled="C.enviandoCheck.value" class="flex-[2] py-3.5 rounded-2xl bg-emerald-600 text-white font-extrabold text-lg disabled:opacity-60" data-chofer="enviar">
      <i :class="['fa-solid mr-1', C.enviandoCheck.value ? 'fa-spinner fa-spin' : 'fa-paper-plane']"></i>Enviar</button>
  </div>
</div>`,
  setup() {
    const f = C.formCheck;
    watch(() => C.formCheck.value, () => C.guardarBorradorCheck(), { deep: true });
    return { C, f, dbEquipos, formatDateForDisplay };
  }
};

/** Lista "Mis check list" (chofer) o todos (Operaciones: prop todos). */
export const ChecklistLista = {
  name: 'ChecklistLista',
  props: { todos: Boolean, puedeEliminar: Boolean },
  template: /* html */ `
<div class="space-y-2">
  <div v-if="todos && C.faltaSqlChofer.value" class="bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3 text-xs">Falta ejecutar <b>sql/chofer.sql</b> en Supabase.</div>
  <div v-for="r in lista" :key="r.id" class="bg-white rounded-2xl shadow-sm border p-3 flex items-center gap-3">
    <span class="w-11 h-11 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center text-lg shrink-0"><i class="fa-solid fa-truck"></i></span>
    <div class="flex-1 min-w-0">
      <p class="font-black text-slate-800">{{ r.patente }} <span class="text-xs font-bold text-slate-500">{{ formatDateForDisplay(r.fecha) }}</span></p>
      <p class="text-xs text-slate-500 truncate"><span v-if="todos" class="font-bold text-slate-700">{{ r.chofer || r.usuario }} · </span>Km {{ r.km_ini || '—' }} → {{ r.km_fin || '—' }} · {{ (r.actividades || []).length }} traslado(s)<span v-if="malos(r)" class="text-rose-600 font-bold"> · {{ malos(r) }} malo(s)</span></p>
    </div>
    <button @click="C.descargarChecklistExcel(r)" class="px-3 py-2 rounded-xl border font-bold text-xs text-emerald-700" title="Descargar documento"><i class="fa-solid fa-file-excel mr-1"></i>Excel</button>
    <button v-if="todos && puedeEliminar" @click="C.eliminarChecklist(r)" class="px-2 py-2 rounded-xl text-slate-300 hover:text-rose-600" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
  </div>
  <p v-if="!lista.length" class="text-center text-slate-400 py-8 text-sm">{{ todos ? 'Aún no hay check list de choferes.' : 'Aún no envías check list.' }}</p>
</div>`,
  setup(props) {
    const lista = Vue.computed(() => (props.todos ? C.todosChecklist.value : C.misChecklist.value));
    const malos = (r) => Object.values(r.checklist || {}).filter(v => v === 'M').length;
    Vue.onMounted(() => (props.todos ? C.cargarTodosChecklist() : C.cargarMisChecklist()));
    return { C, lista, malos, formatDateForDisplay };
  }
};
