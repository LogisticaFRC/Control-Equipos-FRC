// =====================================================================
// HISTORIAL DE HORÓMETRO · SOLO ADMIN GENERAL (2026-11-27)
// Cada vez que cambia el horómetro de un equipo queda un registro (lo hace la base de datos con un
// trigger, sql/horometro_historial.sql): en el Inventario (horómetro manual: app de técnicos, perfil,
// vehículos, carga Excel) y en el Historial (horómetro de cada mantención / intervención, incluso si se borra).
//   · Perfil del equipo → Resumen → "Historial de horómetro" (ese AFI)
//   · Inventario → botón "Historial horómetros" (todos los equipos, filtro de cambios sospechosos)
// Marca en rojo: bajó o se borró · en ámbar: subió más de 2.000 h de una vez. "Restaurar" vuelve al valor anterior.
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { dbEquipos, dbIntervenciones, recalcularHorometros } from '../../core/store.js';
import { mismoAfi, formatDateForDisplay } from '../../core/utils.js';
import { TABLAS } from '../../core/tablas.js';

const { ref, computed, watch, onMounted } = Vue;
export const TABLA_HORO_LOG = 'bd_horometro_log';
export const SQL_HORO_LOG = 'Falta ejecutar sql/horometro_historial.sql en Supabase (SQL Editor → Run).';
export const verLogGlobal = ref(false);   // modal desde Inventario

const fmtN = (n) => (n == null || n === '' ? '—' : Number(n).toLocaleString('es-CL', { maximumFractionDigits: 1 }));
const fmtHora = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${formatDateForDisplay(iso.slice(0, 10))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
/** Qué tan raro es el cambio: 'rojo' (bajó / borrado), 'ambar' (salto grande), '' normal. */
export const alertaCambio = (r) => {
  const a = Number(r.anterior), n = Number(r.nuevo);
  if (r.accion === 'BORRADO') return 'rojo';
  if (r.accion === 'CAMBIO' && a > 0 && n < a) return 'rojo';
  if (r.accion === 'CAMBIO' && a > 0 && n - a > 2000) return 'ambar';
  return '';
};

const HorometroLog = {
  name: 'HorometroLog',
  props: { afi: { type: String, default: '' } },   // vacío = todos los equipos
  template: /* html */ `
<div class="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden" data-horo-log>
  <button v-if="afi" @click="abierto = !abierto" class="w-full flex items-center justify-between px-4 py-3 bg-slate-800 text-white text-left">
    <span class="font-bold text-sm uppercase"><i class="fa-solid fa-clock-rotate-left mr-2 text-amber-300"></i>Historial de horómetro <span class="text-[10px] font-bold bg-amber-400 text-slate-900 rounded px-1.5 py-0.5 ml-1">SOLO ADMIN</span></span>
    <span class="text-xs">{{ filas.length }} cambio(s)<b v-if="nSosp" class="ml-2 bg-rose-500 rounded px-1.5 py-0.5">{{ nSosp }} a revisar</b><i :class="['fa-solid ml-2', abierto ? 'fa-chevron-up' : 'fa-chevron-down']"></i></span>
  </button>
  <div v-show="abierto || !afi" class="p-4 space-y-3">
    <div class="flex flex-wrap gap-2 items-center">
      <input v-if="!afi" v-model="buscar" placeholder="Buscar AFI o usuario" class="p-2 border-2 rounded-lg text-sm w-48">
      <select v-model="origen" class="p-2 border-2 rounded-lg text-sm"><option value="">Todo</option><option value="INVENTARIO">Horómetro manual (Inventario)</option><option value="HISTORIAL">Historial (mantenciones)</option></select>
      <label class="flex items-center gap-1.5 text-sm font-bold text-rose-700"><input type="checkbox" v-model="soloSosp" class="w-4 h-4 accent-rose-600">Solo a revisar</label>
      <button @click="cargar" class="ml-auto text-xs font-bold px-3 py-2 rounded-lg border bg-slate-50 hover:bg-slate-100"><i :class="['fa-solid mr-1', cargando ? 'fa-spinner fa-spin' : 'fa-rotate']"></i>Actualizar</button>
    </div>
    <p v-if="falta" class="text-sm bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3">{{ SQL_HORO_LOG }}</p>
    <p v-else-if="!cargando && !lista.length" class="text-sm text-slate-500 italic">Sin cambios registrados{{ soloSosp ? ' a revisar' : '' }}. Los cambios se registran desde que se ejecutó el SQL.</p>
    <div v-else class="overflow-x-auto max-h-[60vh] overflow-y-auto border rounded-lg">
      <table class="w-full text-xs">
        <thead class="bg-slate-100 sticky top-0 text-slate-600 uppercase text-[10px]"><tr>
          <th class="p-2 text-left">Cuándo</th><th v-if="!afi" class="p-2 text-left">AFI</th><th class="p-2 text-left">Dónde</th>
          <th class="p-2 text-right">Antes</th><th class="p-2 text-right">Después</th><th class="p-2 text-right">Dif.</th><th class="p-2 text-left">Quién</th><th class="p-2"></th></tr></thead>
        <tbody>
          <tr v-for="r in lista" :key="r.id" :class="['border-t', alertaCambio(r) === 'rojo' ? 'bg-rose-50' : alertaCambio(r) === 'ambar' ? 'bg-amber-50' : '']" :data-log="r.id">
            <td class="p-2 whitespace-nowrap">{{ fmtHora(r.created_at) }}</td>
            <td v-if="!afi" class="p-2 font-bold">{{ r.afi }}</td>
            <td class="p-2"><b :class="r.origen === 'HISTORIAL' ? 'text-sky-700' : 'text-emerald-700'">{{ r.origen === 'HISTORIAL' ? 'Historial' : 'Manual' }}</b>
              <span :class="['ml-1 px-1.5 py-0.5 rounded text-[10px] font-black', r.accion === 'BORRADO' ? 'bg-rose-600 text-white' : r.accion === 'NUEVO' ? 'bg-sky-100 text-sky-800' : r.accion === 'RESTAURADO' ? 'bg-violet-100 text-violet-800' : 'bg-slate-100 text-slate-700']">{{ r.accion }}</span>
              <span v-if="r.detalle" class="block text-[10px] text-slate-500 max-w-[220px] truncate" :title="r.detalle">{{ r.detalle }}</span>
              <span v-if="r.fecha_nueva || r.fecha_anterior" class="block text-[10px] text-slate-400">fecha lectura: {{ formatDateForDisplay(r.fecha_anterior) || '—' }} → {{ formatDateForDisplay(r.fecha_nueva) || '—' }}</span></td>
            <td class="p-2 text-right font-mono">{{ fmtN(r.anterior) }}</td>
            <td class="p-2 text-right font-mono font-bold">{{ fmtN(r.nuevo) }}</td>
            <td :class="['p-2 text-right font-mono font-bold', alertaCambio(r) === 'rojo' ? 'text-rose-700' : alertaCambio(r) === 'ambar' ? 'text-amber-700' : 'text-slate-500']">{{ dif(r) }}
              <i v-if="alertaCambio(r)" class="fa-solid fa-triangle-exclamation ml-1"></i></td>
            <td class="p-2">{{ r.usuario || '—' }}</td>
            <td class="p-2 text-right whitespace-nowrap">
              <button v-if="puedeRestaurar(r)" @click="restaurar(r)" :disabled="restaurando === r.id" class="px-2 py-1 rounded-md bg-violet-600 text-white font-bold text-[11px] disabled:opacity-50" title="Volver al valor anterior"><i class="fa-solid fa-rotate-left mr-1"></i>Restaurar {{ fmtN(r.anterior) }}</button></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="text-[10px] text-slate-400"><span class="inline-block w-2.5 h-2.5 bg-rose-200 rounded mr-1"></span>Bajó o se borró · <span class="inline-block w-2.5 h-2.5 bg-amber-200 rounded mr-1"></span>Subió más de 2.000 h de una vez · "Restaurar" deja el valor anterior y queda registrado.</p>
  </div>
</div>`,
  setup(props) {
    const filas = ref([]), cargando = ref(false), falta = ref(false), abierto = ref(false);
    const buscar = ref(''), origen = ref(''), soloSosp = ref(false), restaurando = ref(null);
    const cargar = async () => {
      cargando.value = true; falta.value = false;
      try {
        let q = supabaseClient.from(TABLA_HORO_LOG).select('*').order('created_at', { ascending: false }).limit(props.afi ? 300 : 1500);
        if (props.afi) q = q.ilike('afi', String(props.afi).trim());
        filas.value = await sb(q);
      } catch (err) { if (/bd_horometro_log|does not exist|schema cache/i.test(errMsg(err))) falta.value = true; else alert('No se pudo cargar el historial de horómetro: ' + errMsg(err)); }
      finally { cargando.value = false; }
    };
    const lista = computed(() => {
      const q = String(buscar.value || '').trim().toUpperCase();
      return filas.value.filter(r => (!origen.value || r.origen === origen.value) && (!soloSosp.value || alertaCambio(r))
        && (!q || String(r.afi || '').toUpperCase().includes(q) || String(r.usuario || '').toUpperCase().includes(q)));
    });
    const nSosp = computed(() => filas.value.filter(r => alertaCambio(r)).length);
    const dif = (r) => { if (r.anterior == null || r.nuevo == null) return '—'; const d = Number(r.nuevo) - Number(r.anterior); return (d > 0 ? '+' : '') + fmtN(d); };
    // Restaurar: horómetro manual → inventario · Historial (cambiado, no borrado) → ese registro
    const puedeRestaurar = (r) => r.anterior != null && Number(r.anterior) > 0 && ['CAMBIO', 'BORRADO'].includes(r.accion) && (r.origen === 'INVENTARIO' || (r.origen === 'HISTORIAL' && r.registro_id && !String(r.detalle || '').startsWith('REGISTRO ELIMINADO')));
    const restaurar = async (r) => {
      if (!confirm(`¿Volver el horómetro de AFI ${r.afi} a ${fmtN(r.anterior)}${r.origen === 'HISTORIAL' ? ' en ese registro del Historial' : ''}?`)) return;
      restaurando.value = r.id;
      try {
        if (r.origen === 'INVENTARIO') {
          const eq = dbEquipos.value.find(e => mismoAfi(e.afi, r.afi));
          const pay = { horometroactual: Number(r.anterior), ...(r.fecha_anterior ? { fecha_horometro_manual: String(r.fecha_anterior).slice(0, 10) } : {}) };
          await sb(eq && eq.id != null ? supabaseClient.from(TABLAS.INVENTARIO).update(pay).eq('id', eq.id) : supabaseClient.from(TABLAS.INVENTARIO).update(pay).ilike('afi', r.afi));
          if (eq) { eq.horometroActual = Number(r.anterior); if (pay.fecha_horometro_manual) eq.fechaHorometroManual = pay.fecha_horometro_manual; recalcularHorometros(); }
        } else {
          await sb(supabaseClient.from(TABLAS.HISTORIAL).update({ horometro: Number(r.anterior) }).eq('id', r.registro_id));
          const h = dbIntervenciones.value.find(x => String(x.id) === String(r.registro_id)); if (h) { h.horometro = Number(r.anterior); recalcularHorometros(); }
        }
        await cargar();
      } catch (err) { alert('No se pudo restaurar: ' + errMsg(err)); }
      finally { restaurando.value = null; }
    };
    onMounted(() => { if (!props.afi) cargar(); });
    watch(abierto, (v) => { if (v && !filas.value.length) cargar(); });
    watch(() => props.afi, () => { filas.value = []; if (abierto.value) cargar(); });
    if (props.afi) cargar();   // para mostrar el conteo en el encabezado
    return { filas, lista, cargando, falta, abierto, buscar, origen, soloSosp, restaurando, nSosp, cargar, dif, puedeRestaurar, restaurar, alertaCambio, fmtN, fmtHora, formatDateForDisplay, SQL_HORO_LOG };
  }
};

export default HorometroLog;

/** Modal global (Inventario → "Historial horómetros"). */
export const HorometroLogModal = {
  name: 'HorometroLogModal',
  components: { HorometroLog },
  template: /* html */ `
<teleport to="body">
  <div v-if="verLogGlobal" class="fixed inset-0 z-[90] bg-slate-950/60 flex items-start justify-center p-3 overflow-y-auto" @click.self="verLogGlobal = false">
    <div class="bg-slate-100 rounded-2xl shadow-2xl w-full max-w-5xl mt-6">
      <div class="flex items-center justify-between px-5 py-3 bg-slate-800 text-white rounded-t-2xl">
        <b class="uppercase text-sm"><i class="fa-solid fa-clock-rotate-left mr-2 text-amber-300"></i>Historial de horómetros · todos los equipos <span class="text-[10px] bg-amber-400 text-slate-900 rounded px-1.5 py-0.5 ml-1">SOLO ADMIN</span></b>
        <button @click="verLogGlobal = false" class="w-8 h-8 rounded-lg bg-white/10"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="p-3"><horometro-log></horometro-log></div>
    </div>
  </div>
</teleport>`,
  setup() { return { verLogGlobal }; }
};
