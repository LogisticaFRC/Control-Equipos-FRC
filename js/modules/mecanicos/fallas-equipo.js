// =====================================================================
// MECÁNICOS · FALLAS ABIERTAS DEL EQUIPO (2026-11-18)
// Nuevo flujo de la intervención mecánica / eléctrica:
//   1) INSPECCIÓN: el técnico escribe la observación del equipo y ENUMERA las fallas.
//      Al enviar, cada falla queda ABIERTA en el equipo (tabla bd_taller_problemas, la misma de
//      los hallazgos del taller: el Admin las ve y las puede pasar a OT).
//   2) REPARACIÓN: el técnico elige UNA falla abierta, describe lo que hizo, pone fecha / hora de
//      inicio y término, marca ✓ terminado y envía → la falla queda REPARADA en el equipo.
//   Cada envío es un report (una hoja) aparte.
// Requiere sql/intervencion_fallas.sql.
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { usuarioActivo } from '../../core/store.js';
import { mismoAfi, limpiarAfi } from '../../core/utils.js';
import { dbProblemas, cargarProblemas, TABLA_PROBLEMAS, repActivaAfi, SISTEMAS_HALLAZGO } from '../taller/taller.service.js';

const { ref, computed, onMounted } = Vue;
export { SISTEMAS_HALLAZGO };
export const dbProblemasRef = () => dbProblemas;
export const SQL_FALLAS = 'Falta ejecutar sql/intervencion_fallas.sql en Supabase (SQL Editor → Run).';
const ABIERTAS = ['PENDIENTE', 'AGREGADO'];
const quien = () => { const u = usuarioActivo.value; return (u && (u.nombre || u.usuario)) || ''; };

/** Carga las fallas (una vez cada 2 min como máximo, para no gastar datos). */
let ultimaCarga = 0;
export const asegurarFallas = async (forzar = false) => {
  if (!forzar && Date.now() - ultimaCarga < 120000 && dbProblemas.value.length) return;
  ultimaCarga = Date.now();
  await cargarProblemas();
};

/** Fallas abiertas de un equipo (taller y terreno), en orden de N°. */
export const fallasAbiertasDe = (afi) => dbProblemas.value
  .filter(h => mismoAfi(h.afi, afi) && ABIERTAS.includes(h.estado) && h.sistema !== 'OBSERVACIÓN GENERAL')
  .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || (a.item_n || 0) - (b.item_n || 0));
export const fallaPorId = (id) => dbProblemas.value.find(h => String(h.id) === String(id)) || null;
/** Fallas reparadas de un equipo (las más nuevas primero). */
export const fallasReparadasDe = (afi) => dbProblemas.value
  .filter(h => mismoAfi(h.afi, afi) && h.estado === 'REPARADO')
  .sort((a, b) => String(b.reparado_at || '').localeCompare(String(a.reparado_at || '')));
export const textoFalla = (h) => [h.sistema ? String(h.sistema).toUpperCase() + ':' : '', String(h.descripcion || '').trim()].filter(Boolean).join(' ');

/** INSPECCIÓN enviada → crea las fallas abiertas en el equipo. Devuelve la lista con su id. */
export const crearFallasDeInspeccion = async (reg, items) => {
  const lista = (items || []).filter(i => String(i.descripcion || '').trim());
  if (!lista.length) return [];
  const nuevas = lista.filter(i => !i.id);
  if (!nuevas.length) return lista;
  const rep = repActivaAfi(reg.afi);   // en taller queda unida a la reparación (la ve el Admin para la OT)
  const filas = nuevas.map(i => ({
    reparacion_id: rep ? rep.id : null, ot_id: null, afi: limpiarAfi(reg.afi), nave: rep ? rep.nave || null : null,
    inspeccion_id: `INT-${reg.id}`, item_n: lista.indexOf(i) + 1, intervencion_id: reg.id, tipo_intervencion: reg.tipo,
    descripcion: String(i.descripcion).trim(), sistema: i.sistema || null,
    necesita_repuesto: Boolean(i.necesita_repuesto), repuesto: i.necesita_repuesto ? i.repuesto || null : null, cantidad: i.necesita_repuesto ? i.cantidad || null : null,
    codigo_repuesto: i.codigo_repuesto || null, serie_motor: i.serie_motor || null,
    foto_url: (i.fotos || [])[0] || null, fotos: (i.fotos || []).filter(Boolean),
    reportado_por: quien(), estado: 'PENDIENTE'
  }));
  const creadas = await sb(supabaseClient.from(TABLA_PROBLEMAS).insert(filas).select());
  dbProblemas.value.push(...creadas);
  nuevas.forEach((i, k) => { i.id = creadas[k]?.id || null; });
  return lista;
};

/** REPARACIÓN enviada → la falla queda REPARADA (función frc_falla_reparada). */
export const marcarFallaReparada = async (fallaId, reg) => {
  const f = fallaPorId(fallaId);
  const args = { p_id: Number(fallaId), p_intervencion_id: reg.id, p_quien: quien(), p_trabajo: String(reg.descripcion || '').trim() || null };
  const fila = await sb(supabaseClient.rpc('frc_falla_reparada', args));
  if (f) Object.assign(f, fila && typeof fila === 'object' ? fila : { estado: 'REPARADO', reparado_por: args.p_quien, reparado_at: new Date().toISOString(), reparado_int_id: reg.id });
  return fila && typeof fila === 'object' ? fila.disp_equipo || null : null;   // disponibilidad devuelta si se completó el levantamiento
};

// ---------------------------------------------------------------------
// <fallas-abiertas :eq="eq">: carta en la ficha del equipo (app técnicos)
// ---------------------------------------------------------------------
export const FallasAbiertas = {
  name: 'FallasAbiertas',
  props: { eq: { type: Object, required: true }, soloVer: { type: Boolean, default: false } },
  emits: ['reparar'],
  template: /* html */ `
<div class="bg-white rounded-2xl shadow-sm p-4" data-fallas="abiertas">
  <div class="flex items-center justify-between mb-2">
    <div class="lbl"><i class="fa-solid fa-triangle-exclamation text-amber-500 mr-1"></i>Fallas abiertas del equipo</div>
    <span :class="['text-xs font-black px-2 py-0.5 rounded-full', abiertas.length ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800']">{{ abiertas.length }}</span>
  </div>
  <p v-if="!abiertas.length" class="text-sm text-slate-400 italic">Sin fallas abiertas. Si encuentras alguna, haz una intervención → <b>OT Terreno</b> y enuméralas.</p>
  <div v-for="(h, i) in abiertas" :key="h.id" class="py-2.5 border-b last:border-0 flex items-start gap-3">
    <span class="w-7 h-7 rounded-full bg-amber-500 text-white font-black text-sm flex items-center justify-center shrink-0">{{ i + 1 }}</span>
    <div class="flex-1 min-w-0">
      <p class="font-bold text-sm leading-snug">{{ h.descripcion }}</p>
      <p class="text-[11px] text-slate-500">{{ h.sistema ? h.sistema + ' · ' : '' }}{{ h.reportado_por }} · {{ fecha(h.created_at) }}<template v-if="h.estado === 'AGREGADO'"> · <b class="text-emerald-700">en OT</b></template></p>
    </div>
    <div v-if="!soloVer" class="flex flex-col gap-1 shrink-0">
      <button @click="reparar(h, 'MECANICA')" class="px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-extrabold" :data-fallas="'reparar-' + h.id"><i class="fa-solid fa-wrench mr-1"></i>Reparar</button>
      <button @click="reparar(h, 'ELECTRICA')" class="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-800 text-[11px] font-bold"><i class="fa-solid fa-bolt mr-1"></i>Eléctrica</button>
    </div>
  </div>
  <details v-if="reparadas.length" class="mt-2">
    <summary class="text-xs font-bold text-emerald-700 cursor-pointer"><i class="fa-solid fa-circle-check mr-1"></i>Reparadas ({{ reparadas.length }})</summary>
    <div v-for="h in reparadas.slice(0, 15)" :key="h.id" class="py-1.5 border-b last:border-0 text-xs">
      <b class="line-through decoration-emerald-600/60">{{ h.descripcion }}</b>
      <span class="block text-slate-500">Reparada por {{ h.reparado_por || '—' }} · {{ fecha(h.reparado_at) }}</span>
    </div>
  </details>
</div>`,
  setup(props, { emit }) {
    onMounted(() => { asegurarFallas(); });
    const abiertas = computed(() => fallasAbiertasDe(props.eq.afi));
    const reparadas = computed(() => fallasReparadasDe(props.eq.afi));
    const fecha = (t) => { const m = String(t || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
    const reparar = (h, tipo) => emit('reparar', { falla: h, tipo });
    return { abiertas, reparadas, fecha, reparar };
  }
};
