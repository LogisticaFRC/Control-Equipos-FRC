// =====================================================================
// TÓTEM DEL TALLER · contraseña (2026-11-16) · ver sql/totem.sql
// La clave se guarda cifrada en Supabase: el Admin general la cambia en
// Configuración → Usuarios; el tótem solo puede verificarla.
// =====================================================================
import { supabaseClient } from '../../core/supabase.js';

const { ref } = Vue;

const SQL_TOTEM = 'Falta ejecutar sql/totem.sql en Supabase (SQL Editor → Run).';
const faltaSql = (e) => /frc_totem|does not exist|schema cache|function/i.test((e && e.message) || '');

/** { definida, updated_at, updated_by } · null mientras carga · faltaSql = true si no está el SQL. */
export const infoClaveTotem = ref(null);
export const faltaSqlTotem = ref(false);

export const cargarInfoTotem = async () => {
  const { data, error } = await supabaseClient.rpc('frc_totem_info');
  if (error) { faltaSqlTotem.value = faltaSql(error); infoClaveTotem.value = { definida: false }; return; }
  faltaSqlTotem.value = false;
  infoClaveTotem.value = data || { definida: false };
};

/** Admin general: define / cambia la contraseña. */
export const guardarClaveTotem = async (clave, repetir) => {
  const c = String(clave || '');
  if (c.trim().length < 4) { alert('La contraseña del tótem debe tener al menos 4 caracteres.'); return false; }
  if (c !== String(repetir || '')) { alert('Las contraseñas no coinciden.'); return false; }
  const { error } = await supabaseClient.rpc('frc_totem_set_clave', { p_clave: c });
  if (error) { alert(faltaSql(error) ? SQL_TOTEM : 'No se pudo guardar: ' + error.message); return false; }
  await cargarInfoTotem();
  alert('Contraseña del tótem guardada.');
  return true;
};

/** Tótem: ¿la contraseña es correcta? → true | false | 'sin-sql' */
export const verificarClaveTotem = async (clave) => {
  const { data, error } = await supabaseClient.rpc('frc_totem_verificar', { p_clave: String(clave || '') });
  if (error) return faltaSql(error) ? 'sin-sql' : false;
  return data === true;
};
