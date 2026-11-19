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
import { esSupervisorMec, filtroPanel, cargarMec } from './mecanicos.service.js';
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
      <div class="rounded-xl border p-3 flex flex-wrap items-center justify-between gap-2" data-porfirmar="intervenciones">
        <p><b class="text-lg">{{ nInt }}</b> intervención(es) enviadas con firma del mecánico, esperando tu firma.</p>
        <button v-if="nInt" @click="irIntervenciones" class="px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold"><i class="fa-solid fa-pen-nib mr-1"></i>Ir a firmar</button>
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
</div>`,
  setup() {
    const abierto = ref(false), nInt = ref(0), ots = ref([]), nombres = ref({}), error = ref('');
    const visible = computed(() => Boolean(usuarioActivo.value && esSupervisorMec.value && !modoTecnicoDe(usuarioActivo.value)));
    const total = computed(() => nInt.value + ots.value.length);
    let timer = null;
    const cargar = async () => {
      if (!visible.value || document.hidden) return;
      try {
        const r = await supabaseClient.from(TABLAS.MEC_INTERVENCIONES).select('id', { count: 'exact', head: true }).eq('estado', 'PENDIENTE_FIRMA');
        if (!r.error) nInt.value = r.count || 0;
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
    onMounted(() => { cargar(); timer = setInterval(cargar, 120000); document.addEventListener('visibilitychange', alVolver); });
    onUnmounted(() => { clearInterval(timer); document.removeEventListener('visibilitychange', alVolver); });
    watch([visible, abierto, currentTab], () => cargar());
    return { abierto, nInt, ots, nombres, error, visible, total, irIntervenciones, firmarOT };
  }
};
