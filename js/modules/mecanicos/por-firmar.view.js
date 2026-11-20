// =====================================================================
// SUPERVISOR FRC · "Por firmar" (2026-11-19)
// Botón flotante para los usuarios supervisores (permisos.mecanicos = 'admin') y el Admin general:
//   · Intervenciones enviadas con la firma del mecánico que esperan la firma del supervisor FRC → panel MECÁNICOS.
//   · OT de taller con firma del mecánico y sin firma del supervisor → se firman aquí mismo.
// Todos los supervisores ven lo mismo (pueden ser 2 o más); el primero que firma la saca de la lista.
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { TABLAS } from '../../core/tablas.js';
import { usuarioActivo, currentTab, modoTecnicoDe } from '../../core/store.js';
import * as M from './mecanicos.service.js';
import { esSupervisorMec, filtroPanel, cargarMec } from './mecanicos.service.js';
import { hojaIntervencion, ANCHO_VERTICAL } from './hojas.js';
import { logoDataURL } from '../../core/excel.js';
import FirmaPad from '../../core/firma-pad.js';
import { guardarResponsablesOT } from '../taller/taller.service.js';

const { ref, computed, onMounted, onUnmounted, watch } = Vue;

export default {
  name: 'PorFirmar',
  components: { FirmaPad },
  template: /* html */ `
<div v-if="visible && total > 0" class="fixed bottom-4 left-4 z-[60]" data-porfirmar="boton">
  <button @click="abierto = !abierto" class="flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold shadow-xl">
    <i class="fa-solid fa-file-signature"></i> Por firmar <span class="bg-white text-amber-700 rounded-full px-2 text-sm">{{ total }}</span>
  </button>
</div>
<div v-if="visible && abierto" class="fixed inset-0 z-[70] bg-slate-900/50 flex items-end sm:items-center justify-center p-2" @click.self="abierto = false">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
    <div class="px-4 py-3 border-b flex items-center justify-between sticky top-0 bg-white">
      <p class="font-extrabold text-slate-800"><i class="fa-solid fa-file-signature text-amber-600 mr-1"></i>Por firmar · Supervisor FRC</p>
      <button @click="abierto = false" class="text-slate-500 text-xl px-2">&times;</button>
    </div>
    <div class="p-4 space-y-4">
      <div class="space-y-2" data-porfirmar="intervenciones">
        <p class="text-[11px] font-bold uppercase text-slate-500">Reports para firmar · Supervisor FRC ({{ intsFRC.length }})</p>
        <p v-if="!intsFRC.length" class="text-sm text-slate-500">No hay reports pendientes.</p>
        <button v-for="r in intsFRC" :key="r.id" @click="abrir(r)" class="w-full text-left border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 rounded-xl p-3 flex items-center gap-3" data-porfirmar="int">
          <i class="fa-solid fa-file-signature text-2xl text-amber-600"></i>
          <span class="flex-1 min-w-0"><b class="font-mono">AFI {{ r.afi }}</b> · {{ r.tipo === 'ELECTRICA' ? 'Eléctrica' : 'Mecánica' }} · {{ fecha(r.fecha) }}
            <span class="block text-[11px] text-slate-600 truncate">{{ (r.mecanicos || []).map(m => m.nombre).join(', ') }} — {{ r.causa_intervencion || r.falla_texto || r.descripcion }}</span></span>
          <span class="px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm">Ver y firmar</span>
        </button>
        <div v-if="intsCliente.length" class="rounded-xl border p-3 text-sm text-slate-600">
          <i class="fa-solid fa-envelope mr-1 text-sky-600"></i><b>{{ intsCliente.length }}</b> esperando firma del cliente por correo:
          <span v-for="r in intsCliente" :key="r.id" class="inline-block ml-1 px-1.5 rounded bg-slate-100 font-mono text-[11px]">AFI {{ r.afi }} · {{ r.supervisor?.correo }}</span>
        </div>
      </div>
      <div class="space-y-3" data-porfirmar="ots">
        <p class="text-[11px] font-bold uppercase text-slate-500">OT de taller con firma del mecánico ({{ ots.length }})</p>
        <p v-if="!ots.length" class="text-sm text-slate-500">No hay OT de taller pendientes.</p>
        <div v-for="o in ots" :key="o.id" class="border rounded-xl p-3 space-y-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="font-bold">OT N° {{ o.folio || o.id }} · <span class="font-mono">{{ o.afi }}</span> <span class="text-slate-500 font-normal">{{ o.equipo || '' }}</span></p>
            <span class="text-[11px] text-slate-500">Mecánico: {{ o.mecanico || '—' }}</span>
          </div>
          <img v-if="o.firmas?.mecanico" :src="o.firmas.mecanico" alt="Firma mecánico" class="h-12 border rounded bg-white">
          <input v-model="nombres[o.id]" class="w-full border rounded-lg px-3 py-2" placeholder="Nombre del supervisor FRC">
          <firma-pad :firma="''" :titulo="'Firma supervisor · OT ' + (o.folio || o.id)" @guardar="u => firmarOT(o, u)"></firma-pad>
        </div>
      </div>
      <p v-if="error" class="text-sm text-rose-700">{{ error }}</p>
    </div>
  </div>
</div>
<div v-if="sel" class="fixed inset-0 z-[80] bg-slate-100 flex flex-col" data-porfirmar="firmar">
  <div class="bg-slate-900 text-white px-4 py-3 flex items-center gap-3">
    <button @click="sel = null" class="text-xl px-1"><i class="fa-solid fa-arrow-left"></i></button>
    <p class="flex-1 min-w-0 font-extrabold truncate">Firmar report · AFI {{ sel.afi }} <span class="font-normal text-slate-300">{{ fecha(sel.fecha) }}</span></p>
  </div>
  <div class="flex-1 overflow-auto lg:overflow-hidden flex flex-col lg:flex-row gap-3 p-3">
    <div ref="cajaHoja" class="lg:flex-1 lg:overflow-auto bg-slate-300 rounded-xl p-2">
      <div class="bg-white shadow mx-auto" :style="{ width: ANCHO + 'px', zoom: escala }" v-html="html"></div>
    </div>
    <div class="lg:w-[380px] shrink-0 bg-white rounded-xl shadow p-4 space-y-3 h-fit">
      <p class="font-extrabold text-slate-800"><i class="fa-solid fa-signature text-emerald-700 mr-1"></i>Firma del supervisor FRC</p>
      <input v-model="nombreFirma" class="w-full border-2 rounded-lg px-3 py-2.5 font-bold" placeholder="Tu nombre">
      <firma-pad :firma="firmaNueva" titulo="Firma del supervisor FRC" @guardar="u => firmaNueva = u"></firma-pad>
      <button @click="firmar" :disabled="firmando || !firmaNueva || !nombreFirma.trim()" class="w-full py-3.5 rounded-xl bg-emerald-600 disabled:opacity-40 text-white text-lg font-black"><i class="fa-solid fa-check mr-1"></i>{{ firmando ? 'Firmando…' : 'Firmar y guardar' }}</button>
      <p class="text-[11px] text-slate-500">Al firmar, el PDF del Historial se cambia por el firmado y se quita la marca FALTA FIRMA.</p>
    </div>
  </div>
</div>`,
  setup() {
    const abierto = ref(false), ints = ref([]), ots = ref([]), nombres = ref({}), error = ref('');
    const intsFRC = computed(() => ints.value.filter(r => r.supervisor?.tipo !== 'CLIENTE'));
    const intsCliente = computed(() => ints.value.filter(r => r.supervisor?.tipo === 'CLIENTE'));
    const nInt = computed(() => intsFRC.value.length);
    const sel = ref(null), html = ref(''), nombreFirma = ref(''), firmaNueva = ref(''), firmando = ref(false), cajaHoja = ref(null), ancho = ref(window.innerWidth);
    const ANCHO = ANCHO_VERTICAL;
    const escala = computed(() => Math.min(1, ((ancho.value >= 1024 ? ancho.value - 420 : ancho.value) - 40) / ANCHO));
    const alRedim = () => { ancho.value = window.innerWidth; };
    const fecha = (f) => (f ? String(f).slice(0, 10).split('-').reverse().join('-') : '');
    const abrir = async (r) => {
      sel.value = r; firmaNueva.value = ''; nombreFirma.value = usuarioActivo.value?.nombre || ''; html.value = '<p style="padding:20px">Cargando…</p>';
      try { const logo = (await logoDataURL())?.url || ''; html.value = hojaIntervencion(r, logo); } catch (e) { html.value = '<p style="padding:20px">No se pudo mostrar la hoja.</p>'; }
    };
    const firmar = async () => {
      if (!sel.value) return;
      firmando.value = true;
      try {
        M.abrirRegPanel(sel.value);
        M.firmaPanel.value = { nombre: nombreFirma.value.trim(), empresa: 'FAST RENTAL CHILE', tipo: 'FRC', firma: firmaNueva.value };
        await M.firmarYPasar();
        if (!M.regPanel.value) { ints.value = ints.value.filter(x => x.id !== sel.value.id); sel.value = null; }
      } finally { firmando.value = false; }
    };
    const visible = computed(() => Boolean(usuarioActivo.value && esSupervisorMec.value && !modoTecnicoDe(usuarioActivo.value)));
    const total = computed(() => nInt.value + ots.value.length);
    let timer = null;
    const cargar = async () => {
      if (!visible.value || document.hidden) return;
      try {
        const r = await supabaseClient.from(TABLAS.MEC_INTERVENCIONES).select('*').eq('estado', 'PENDIENTE_FIRMA').order('id', { ascending: false }).limit(150);
        if (!r.error) ints.value = r.data || [];
        const o = await supabaseClient.from(TABLAS.OT).select('id, folio, afi, equipo, mecanico, supervisor, firmas, estado').not('firmas', 'is', null).order('id', { ascending: false }).limit(300);
        if (!o.error) ots.value = (o.data || []).filter(x => x.firmas && x.firmas.mecanico && !x.firmas.supervisor);
        error.value = '';
      } catch (e) { error.value = errMsg(e); }
    };
    const irIntervenciones = () => { filtroPanel.value = 'PENDIENTE_FIRMA'; currentTab.value = 'mecPanel'; abierto.value = false; cargarMec?.(); };
    const firmarOT = async (o, url) => {
      if (!url) return;
      const nombre = String(nombres.value[o.id] || usuarioActivo.value?.nombre || '').trim();
      if (!nombre) { alert('Escribe el nombre del supervisor.'); return; }
      try {
        const firmas = { ...(o.firmas || {}), supervisor: url, supervisor_nombre: nombre, supervisor_fecha: new Date().toISOString(), supervisor_usuario: usuarioActivo.value?.usuario || '' };
        const cambios = { firmas };
        if (!String(o.supervisor || '').trim()) cambios.supervisor = nombre;
        await guardarResponsablesOT(o.id, cambios);   // RPC frc_ot_responsables (sql/ot_firmas.sql)
        ots.value = ots.value.filter(x => x.id !== o.id);
        alert(`OT N° ${o.folio || o.id} firmada ✔`);
      } catch (e) { alert('No se pudo firmar la OT: ' + errMsg(e)); }
    };
    const alVolver = () => { if (!document.hidden) cargar(); };
    onMounted(() => { cargar(); timer = setInterval(cargar, 120000); document.addEventListener('visibilitychange', alVolver); window.addEventListener('resize', alRedim); });
    onUnmounted(() => { clearInterval(timer); document.removeEventListener('visibilitychange', alVolver); window.removeEventListener('resize', alRedim); });
    watch([visible, abierto, currentTab], () => cargar());
    return { abierto, nInt, ots, nombres, error, visible, total, irIntervenciones, firmarOT, intsFRC, intsCliente, sel, html, nombreFirma, firmaNueva, firmando, cajaHoja, ANCHO, escala, fecha, abrir, firmar };
  }
};
