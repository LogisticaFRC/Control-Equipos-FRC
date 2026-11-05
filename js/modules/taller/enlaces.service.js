// =====================================================================
// TALLER · Bitácora de enlaces OT ↔ taller (tabla bd_ot_enlaces, sql/ot_enlaces.sql)
// ---------------------------------------------------------------------
// Archivo "hoja": no importa taller.service ni ot.service (ambos lo usan → sin dependencias circulares).
// Registrar NUNCA bloquea la acción: si la tabla no existe o falla, solo avisa en consola.
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { TABLAS } from '../../core/tablas.js';
import { usuarioActivo } from '../../core/store.js';

const { ref } = Vue;

export const TABLA_OT_ENLACES = TABLAS.OT_ENLACES;
export const ACCIONES_ENLACE = {
  CREADA: { label: 'OT creada enlazada', estilo: 'bg-indigo-100 text-indigo-800 border-indigo-300', icon: 'fa-file-circle-plus' },
  ENLAZADA: { label: 'Enlazada', estilo: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: 'fa-link' },
  QUITADA: { label: 'Quitada', estilo: 'bg-rose-100 text-rose-800 border-rose-300', icon: 'fa-link-slash' }
};

export const dbEnlacesOT = ref([]);
export const faltaTablaEnlaces = ref(false);
export const cargandoEnlaces = ref(false);

/** Carga la bitácora (solo la puede leer el Admin de Operaciones, por RLS). */
export const cargarEnlacesOT = async () => {
  cargandoEnlaces.value = true;
  try {
    const data = await sb(supabaseClient.from(TABLA_OT_ENLACES).select('*').order('created_at', { ascending: false }).limit(2000));
    dbEnlacesOT.value = data || [];
    faltaTablaEnlaces.value = false;
  } catch (err) {
    const m = errMsg(err);
    if (/bd_ot_enlaces|schema cache|does not exist/i.test(m)) faltaTablaEnlaces.value = true;
    else console.warn('[Taller] No se pudo leer la bitácora de enlaces:', m);
  } finally { cargandoEnlaces.value = false; }
};

/**
 * Registra un enlace / desenlace.
 *   ot: { id, folio, afi } · rep: reparación (o null) · extra: { programa, detalle }
 */
export const registrarEnlaceOT = async (accion, ot, rep = null, extra = {}) => {
  if (!ot) return;
  const u = usuarioActivo.value;
  const fila = {
    ot_id: ot.id ?? null,
    folio: String(ot.folio ?? ''),
    afi: String(ot.afi ?? rep?.afi ?? ''),
    reparacion_id: rep ? rep.id : (ot.reparacion_id ?? null),
    programa_id: rep && rep.programa_id != null ? rep.programa_id : null,
    programa: extra.programa || (rep ? (rep.programa_id != null ? '' : 'Sin programa') : ''),
    nave: rep?.nave || null,
    accion,
    detalle: extra.detalle || '',
    quien: (u && (u.nombre || u.usuario)) || ''
  };
  try {
    // Sin .select(): la bitácora solo la lee el Admin (RLS); un Subadmin puede registrar pero no leer.
    await sb(supabaseClient.from(TABLA_OT_ENLACES).insert([fila]));
    dbEnlacesOT.value.unshift({ ...fila, id: 'local-' + Date.now(), created_at: new Date().toISOString() });
  } catch (err) {
    console.warn('[Taller] No se registró el enlace en la bitácora (¿falta sql/ot_enlaces.sql?):', errMsg(err));
  }
};
