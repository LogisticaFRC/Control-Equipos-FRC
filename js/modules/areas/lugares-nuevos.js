// =====================================================================
// ÁREAS · LUGARES NUEVOS escritos por los choferes (2026-11-17)
// Cuando un chofer pone "Otro lugar" en un traslado (no está en la lista de locaciones),
// queda en bd_lugares_nuevos (sql/chofer.sql) y aparece una alerta en Áreas y Locaciones.
// Operaciones crea la locación (si corresponde) y la ASIGNA: el movimiento y el equipo
// pasan a esa locación. O lo descarta.
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { TABLAS } from '../../core/tablas.js';
import { cargarDatosDesdeSupabase, soloEditor, usuarioActivo } from '../../core/store.js';
import { textoUbicacion, rutaDe } from './areas.service.js';

import { lugaresNuevos } from '../../core/avisos-taller.js';   // el menú lee esta lista para la alerta

const { ref } = Vue;
const TABLA = 'bd_lugares_nuevos';

export { lugaresNuevos };
export const faltaSqlLugares = ref(false);

export const cargarLugaresNuevos = async () => {
  try {
    const data = await sb(supabaseClient.from(TABLA).select('*').eq('estado', 'PENDIENTE').order('id', { ascending: false }));
    lugaresNuevos.value = data || []; faltaSqlLugares.value = false;
  } catch (err) { lugaresNuevos.value = []; faltaSqlLugares.value = /bd_lugares_nuevos|does not exist|schema cache/i.test(errMsg(err)); }
};

const marcar = (l, estado, extra = {}) => sb(supabaseClient.from(TABLA)
  .update({ estado, revisado_por: usuarioActivo.value?.usuario || '', revisado_at: new Date().toISOString(), ...extra }).eq('id', l.id));

/** Asigna el lugar escrito a una locación existente: corrige el movimiento y deja el equipo ahí. */
export const asignarLugar = async (l, locId) => {
  if (!soloEditor() || !locId) return;
  const texto = textoUbicacion(locId), empresa = rutaDe(locId).empresa?.nombre || '';
  try {
    // Movimientos de ese traslado (mismo AFI, fecha y lugar escrito)
    const mov = { ubicacion_actual: texto, locacion_id: locId, ...(empresa ? { empresa_arriendo: empresa.toUpperCase() } : {}) };
    try { await sb(supabaseClient.from(TABLAS.MOVIMIENTOS).update(mov).eq('afi', l.afi).eq('fecha', l.fecha).eq('ubicacion_actual', l.lugar)); }
    catch (err) { if (!/locacion_id|empresa_arriendo/i.test(errMsg(err))) throw err; await sb(supabaseClient.from(TABLAS.MOVIMIENTOS).update({ ubicacion_actual: texto }).eq('afi', l.afi).eq('fecha', l.fecha).eq('ubicacion_actual', l.lugar)); }
    // Equipo: solo si sigue en ese lugar (no se pisa un movimiento posterior)
    if (!l.subarrendado) {
      const inv = { ubicacion: texto, locacion_id: locId, ...(empresa ? { empresa_arriendo: empresa.toUpperCase() } : {}) };
      try { await sb(supabaseClient.from(TABLAS.INVENTARIO).update(inv).eq('afi', l.afi).eq('ubicacion', l.lugar)); }
      catch (err) { if (!/locacion_id|empresa_arriendo/i.test(errMsg(err))) throw err; await sb(supabaseClient.from(TABLAS.INVENTARIO).update({ ubicacion: texto }).eq('afi', l.afi).eq('ubicacion', l.lugar)); }
    }
    await marcar(l, 'ASIGNADO', { locacion_id: locId });
    await Promise.all([cargarLugaresNuevos(), cargarDatosDesdeSupabase(['movimientos', 'inventario'])]);
  } catch (err) { alert('No se pudo asignar: ' + errMsg(err)); }
};
export const descartarLugar = async (l) => {
  if (!soloEditor()) return;
  if (!confirm(`¿Descartar "${l.lugar}"? El movimiento queda con ese texto.`)) return;
  try { await marcar(l, 'DESCARTADO'); await cargarLugaresNuevos(); } catch (err) { alert('No se pudo descartar: ' + errMsg(err)); }
};
