// =====================================================================
// ESTANDARIZACIÓN · botón + formulario para la app de técnicos (taller, terreno, CRTG, tótem) · 2026-11-18
//   <estandar-boton :eq="eq">: tarjeta "Inspección general estandarización" con la última revisión;
//   al tocarla abre el check list a pantalla completa (Bueno / Malo / N/A, cantidad, comentario, firma).
// =====================================================================
import * as E from './estandarizacion.service.js';
import { formatDateForDisplay } from '../../core/utils.js';
import { iconoUrl } from './iconos-vehiculo.js';

const { computed, onMounted } = Vue;

export default {
  name: 'EstandarBoton',
  props: { eq: { type: Object, required: true } },
  template: /* html */ `
<div>
  <button @click="abrir" class="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 text-left active:scale-[.99]" data-est="abrir">
    <span class="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl"><i :class="['fa-solid', esVeh ? 'fa-truck-pickup' : 'fa-shield-halved']"></i></span>
    <span class="flex-1 min-w-0"><b class="block text-lg leading-tight">{{ esVeh ? 'Check list de vehículo' : 'Inspección general estandarización' }}</b>
      <span v-if="ult" class="text-xs text-slate-500">Última: {{ formatDateForDisplay(ult.fecha) }} · <b :class="E.colorPct(ult.cumplimiento)">{{ ult.cumplimiento }}%</b></span>
      <span v-else class="text-xs text-slate-500">{{ E.plantillaDe(eq).codigo }} · sin registros aún</span></span>
    <i class="fa-solid fa-chevron-right text-slate-300"></i>
  </button>

  <teleport to="body">
  <div v-if="f && E.mismoAfi(f.afi, eq.afi)" class="fixed inset-0 z-[80] bg-slate-100 overflow-y-auto" data-est="form">
    <div class="sticky top-0 z-10 bg-[#1f4d3a] text-white px-4 py-3 flex items-center gap-3 shadow">
      <button @click="E.cerrarEstandarizacion()" class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center" aria-label="Cerrar"><i class="fa-solid fa-xmark text-lg"></i></button>
      <div class="min-w-0 flex-1"><div class="font-extrabold leading-tight truncate">{{ esVeh ? 'Check list vehículo · ' : 'Estandarización · AFI ' }}{{ f.afi }}</div><div class="text-[11px] text-emerald-200 truncate">{{ E.plantillaDe(eq).codigo }} · {{ E.plantillaDe(eq).titulo }}</div></div>
      <div class="text-right"><div :class="['text-xl font-black leading-none', pct >= 90 ? 'text-emerald-300' : pct >= 70 ? 'text-amber-300' : 'text-rose-300']">{{ pct }}%</div><div class="text-[10px] text-emerald-200">{{ marcados }}/{{ f.items.length }}</div></div>
    </div>
    <div class="max-w-xl mx-auto p-4 pb-32 space-y-3">
      <p v-if="!E.tieneEstandarPropio(eq)" class="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-2.5"><i class="fa-solid fa-circle-info mr-1"></i>Este tipo de equipo usa por ahora el estándar de generadores y torres. Marca <b>N/A</b> lo que no aplique.</p>
      <div class="bg-white rounded-2xl shadow-sm p-4 grid grid-cols-2 gap-3">
        <label class="block"><span class="lbl">Fecha</span><input type="date" v-model="f.fecha" class="inp"></label>
        <label class="block"><span class="lbl">{{ esVeh ? 'Kilometraje' : 'Horómetro' }} (opcional)</span><input v-model="f.horometro" inputmode="decimal" class="inp" :placeholder="esVeh ? 'km' : 'hrs'"></label>
        <div v-if="f.vehiculo" class="col-span-2"><span class="lbl">Tipo de inspección <b class="text-rose-600">*</b></span>
          <div class="grid grid-cols-2 gap-2 mt-1">
            <button v-for="(t, k) in E.TIPOS_INSPECCION" :key="k" @click="f.tipoInspeccion = k" :class="['py-3 rounded-xl border-2 font-extrabold text-sm', f.tipoInspeccion === k ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-600 border-amber-300']" :data-tipo="k">
              <i :class="['fa-solid mr-1', k === 'PROGRAMADA' ? 'fa-calendar-check' : 'fa-triangle-exclamation']"></i>{{ t }}</button>
          </div></div>
        <p class="col-span-2 text-xs text-slate-500">{{ f.equipo }}<template v-if="f.anterior"> · anterior: {{ formatDateForDisplay(f.anterior) }}</template></p>
      </div>
      <div class="flex items-center justify-between px-1">
        <span class="lbl">Check list ({{ f.items.length }} ítems)</span>
        <button @click="E.marcarTodoBueno(f)" class="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5" data-est="todo-bueno">Lo que falta: Bueno</button>
      </div>
      <div v-for="(it, i) in f.items" :key="it.k" :class="['bg-white rounded-2xl shadow-sm p-3 space-y-2 border-2', it.estado === 'MALO' ? 'border-rose-300' : it.estado ? 'border-transparent' : 'border-amber-200']" :data-item="it.k">
        <div class="flex items-start gap-2">
          <span class="text-slate-400 font-mono text-sm w-6 shrink-0">{{ i + 1 }}.</span>
          <img v-if="f.vehiculo && icono(it.k)" :src="icono(it.k)" class="w-11 h-11 shrink-0 -mt-1" alt="">
          <span class="flex-1 font-bold text-slate-800 leading-snug">{{ it.t }}<span v-if="it.ley" class="ml-1 align-middle px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[9px] font-black" title="Obligatorio por la Ley de Tránsito (art. 75)">LEY</span></span>
          <label class="shrink-0 text-center"><span class="block text-[9px] font-bold text-slate-400">CANT. {{ it.cant }}</span><input v-model="it.encontrada" inputmode="numeric" class="w-14 p-1.5 border-2 rounded-lg text-center font-black text-sm" :class="Number(it.encontrada) < it.cant ? 'border-rose-300 text-rose-700' : ''"></label>
        </div>
        <div class="grid grid-cols-3 gap-2 pl-8">
          <button v-for="(v, est) in E.ESTADOS" :key="est" @click="marcar(it, est)" :class="['py-2.5 rounded-xl border-2 font-extrabold text-sm', it.estado === est ? v.c : 'bg-white text-slate-500 border-slate-200']" :data-e="est">{{ v.t }}</button>
        </div>
        <input v-if="it.estado === 'MALO' || it.obs" v-model="it.obs" class="ml-8 w-[calc(100%-2rem)] p-2 border-2 border-rose-200 rounded-lg text-sm" placeholder="¿Qué falta o qué está malo?">
      </div>
      <!-- 2026-11-27: hasta 5 fotos generales del equipo -->
      <div class="bg-white rounded-2xl shadow-sm p-4 space-y-2" data-est="fotos">
        <div class="flex items-center justify-between"><span class="lbl">Fotos generales del equipo</span><span class="text-xs font-bold text-slate-500">{{ (f.fotos || []).length }}/{{ E.MAX_FOTOS_EST }}</span></div>
        <div class="grid grid-cols-3 gap-2">
          <div v-for="(u, i) in f.fotos || []" :key="u" class="relative aspect-square rounded-xl overflow-hidden border-2 border-slate-200">
            <img :src="u" class="w-full h-full object-cover" alt="">
            <button @click="E.quitarFotoEst(f, i)" class="absolute top-1 right-1 w-7 h-7 rounded-full bg-rose-600 text-white text-xs shadow" aria-label="Quitar foto"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <label v-if="(f.fotos || []).length < E.MAX_FOTOS_EST" class="aspect-square rounded-xl border-2 border-dashed border-emerald-400 bg-emerald-50 text-emerald-700 flex flex-col items-center justify-center gap-1 cursor-pointer font-bold text-xs" data-est="foto-agregar">
            <i :class="['fa-solid text-2xl', E.subiendoFotoEst.value ? 'fa-spinner fa-spin' : 'fa-camera']"></i>{{ E.subiendoFotoEst.value ? 'Subiendo…' : 'Agregar foto' }}
            <input type="file" accept="image/*" multiple class="hidden" @change="e => { E.agregarFotosEst(f, e.target.files); e.target.value = ''; }"></label>
        </div>
      </div>
      <div class="bg-white rounded-2xl shadow-sm p-4 space-y-2">
        <span class="lbl">Observaciones</span>
        <textarea v-model="f.observaciones" rows="3" class="inp" placeholder="Observaciones generales del equipo"></textarea>
      </div>
      <div class="bg-white rounded-2xl shadow-sm p-4 space-y-3">
        <span class="lbl">Trabajador(es) responsable(s)</span>
        <div v-for="(r, i) in f.responsables" :key="i" class="space-y-2 border-b last:border-0 pb-3">
          <div class="flex gap-2"><input v-model="r.nombre" class="inp flex-1" placeholder="Nombre"><button v-if="i > 0" @click="f.responsables.splice(i, 1)" class="px-3 rounded-xl border text-slate-400"><i class="fa-solid fa-trash"></i></button></div>
          <firma-pad :firma="r.firma" :titulo="'Firma · ' + (r.nombre || 'responsable')" @guardar="v => r.firma = v"></firma-pad>
        </div>
        <button v-if="f.responsables.length < 3" @click="f.responsables.push({ nombre: '', firma: '' })" class="text-sm font-bold text-emerald-700"><i class="fa-solid fa-user-plus mr-1"></i>Agregar otro responsable</button>
      </div>
    </div>
    <div class="fixed bottom-0 left-0 right-0 z-10 max-w-xl mx-auto bg-white border-t p-3">
      <button @click="enviar" :disabled="E.guardandoEst.value" class="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-extrabold text-lg disabled:opacity-60" data-est="enviar"><i :class="['fa-solid mr-2', E.guardandoEst.value ? 'fa-spinner fa-spin' : 'fa-paper-plane']"></i>{{ E.guardandoEst.value ? 'Guardando…' : 'Guardar estandarización' }}</button>
    </div>
  </div>
  </teleport>
</div>`,
  setup(props) {
    const afiEq = computed(() => String(props.eq.afi || '').trim().toUpperCase());
    const ult = computed(() => E.ultimaDe(props.eq.afi));
    const f = computed(() => E.formEst.value);
    const marcados = computed(() => (f.value ? f.value.items.filter(i => i.estado).length : 0));
    const pct = computed(() => (f.value ? E.cumplimiento(f.value.items) : 0));
    const esVeh = computed(() => E.esVehiculoEst(props.eq));
    const icono = (k) => iconoUrl(k);
    const marcar = (it, est) => { it.estado = it.estado === est ? '' : est; };
    const abrir = () => { E.abrirEstandarizacion(props.eq); window.scrollTo(0, 0); };
    const enviar = async () => { if (await E.guardarEstandarizacion()) alert((esVeh.value ? 'Check list guardado' : 'Estandarización guardada') + ' ✔ Queda en el perfil del equipo.'); };
    onMounted(() => E.cargarEstandarizaciones(props.eq.afi));
    return { E, f, ult, afiEq, marcados, pct, marcar, abrir, enviar, formatDateForDisplay, esVeh, icono };
  }
};
