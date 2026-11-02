// =====================================================================
// INVENTARIO AFI · Eliminar equipo con MOTIVO + registro de eliminaciones
//  - Solo Admin. El motivo y el detalle son obligatorios.
//  - Antes de borrar se guarda una copia completa del equipo en bd_equipos_eliminados
//    (quién, cuándo, por qué). Desde ese registro se puede RESTAURAR el equipo.
//  - El historial de mantenciones y movimientos del AFI NO se borra.
// =====================================================================
import { supabaseClient, sb, errMsg, fetchAllRows } from '../../core/supabase.js';
import { TABLAS } from '../../core/tablas.js';
import { usuarioActivo, cargarDatosDesdeSupabase, soloAdmin, dbEquipos } from '../../core/store.js';
import { TABLA_INVENTARIO, empresaDe } from './inventario.mapper.js';
import { showPerfilEquipoModal } from './perfil.service.js';
import { mismoAfi } from '../../core/utils.js';

const { ref, computed } = Vue;
export const TABLA_ELIMINADOS = TABLAS.EQUIPOS_ELIMINADOS;

export const MOTIVOS_BAJA = [
  'VENTA DEL EQUIPO',
  'SINIESTRO / PÉRDIDA TOTAL',
  'ROBO',
  'DESGUACE / CHATARRA',
  'DEVOLUCIÓN A PROPIETARIO / FIN DE LEASING',
  'ERROR DE REGISTRO / DUPLICADO',
  'OTRO'
];

const SQL_ELIMINADOS = `CREATE TABLE IF NOT EXISTS public.bd_equipos_eliminados (id bigserial PRIMARY KEY, fecha timestamptz DEFAULT now(), afi text, tipo text, marca text, modelo text, motivo text NOT NULL, detalle text NOT NULL, usuario text, datos jsonb, restaurado_at timestamptz, restaurado_por text);
ALTER TABLE public.bd_equipos_eliminados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bd_equipos_eliminados_anon_all ON public.bd_equipos_eliminados;
CREATE POLICY bd_equipos_eliminados_anon_all ON public.bd_equipos_eliminados FOR ALL TO anon USING (true) WITH CHECK (true);
NOTIFY pgrst, 'reload schema';`;
const avisoSql = (err) => {
  if (/bd_equipos_eliminados|schema cache/i.test(errMsg(err))) {
    alert("Falta la tabla del registro de eliminaciones. Ejecuta en Supabase → SQL Editor (está en sql/equipos_eliminados.sql):\n\n" + SQL_ELIMINADOS);
  } else alert("Error: " + errMsg(err));
};
const usuarioTxt = () => String(usuarioActivo.value?.nombre || usuarioActivo.value?.usuario || '');

// ---------- Modal "Eliminar equipo" ----------
export const showModalBaja = ref(false);
export const formBaja = ref(null);
export const eliminandoEquipo = ref(false);

export const abrirBajaEquipo = (equipo) => {
  if (!soloAdmin()) return;
  formBaja.value = { equipo, motivo: '', detalle: '', confirmaAfi: '' };
  showModalBaja.value = true;
};

export const puedeConfirmarBaja = computed(() => {
  const f = formBaja.value;
  return !!f && !!f.motivo && f.detalle.trim().length >= 5 && mismoAfi(f.confirmaAfi, f.equipo.afi);
});

export const confirmarBajaEquipo = async () => {
  if (!soloAdmin() || !puedeConfirmarBaja.value) return;
  const { equipo, motivo, detalle } = formBaja.value;
  eliminandoEquipo.value = true;
  try {
    // 1) Copia exacta de la fila (para poder restaurar)
    const filas = await sb(supabaseClient.from(TABLA_INVENTARIO).select('*').eq('id', equipo.id));
    const datos = (filas && filas[0]) || null;
    if (!datos) throw new Error('El equipo ya no existe en el inventario.');
    // 2) Registro de la eliminación (si falla, NO se borra el equipo)
    await sb(supabaseClient.from(TABLA_ELIMINADOS).insert([{
      afi: String(equipo.afi), tipo: equipo.tipo, marca: equipo.marca, modelo: equipo.modelo,
      motivo, detalle: detalle.trim(), usuario: usuarioTxt(),
      datos: { ...datos, foto: datos.foto && String(datos.foto).startsWith('data:') ? '(foto omitida)' : datos.foto, _empresa: empresaDe(equipo) }
    }]));
    // 3) Borrar del inventario
    await sb(supabaseClient.from(TABLA_INVENTARIO).delete().eq('id', equipo.id));
  } catch (err) {
    eliminandoEquipo.value = false;
    return avisoSql(err);
  }
  eliminandoEquipo.value = false;
  showModalBaja.value = false;
  showPerfilEquipoModal.value = false;
  await cargarDatosDesdeSupabase();
  await cargarEliminados();
  alert(`Equipo AFI ${equipo.afi} eliminado. Quedó registrado en "Equipos eliminados" (motivo: ${motivo}).`);
};

// ---------- Registro de eliminaciones ----------
export const showModalEliminados = ref(false);
export const dbEliminados = ref([]);
export const buscarEliminados = ref('');

export const cargarEliminados = async () => {
  const rows = await fetchAllRows(TABLA_ELIMINADOS);
  dbEliminados.value = rows.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
};
export const abrirRegistroEliminados = async () => {
  buscarEliminados.value = '';
  await cargarEliminados();
  showModalEliminados.value = true;
};
export const eliminadosFiltrados = computed(() => {
  const q = buscarEliminados.value.trim().toLowerCase();
  return dbEliminados.value.filter(r => !q || [r.afi, r.tipo, r.marca, r.modelo, r.motivo, r.detalle, r.usuario].join(' ').toLowerCase().includes(q));
});
export const fmtFechaHoraBaja = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso); if (isNaN(d)) return String(iso);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Vuelve a crear el equipo con sus datos guardados (si su AFI no fue reutilizado). */
export const restaurarEquipo = async (reg) => {
  if (!soloAdmin()) return;
  if (reg.restaurado_at) return alert('Este equipo ya fue restaurado.');
  if (!reg.datos) return alert('Este registro no tiene los datos del equipo.');
  if (dbEquipos.value.some(e => mismoAfi(e.afi, reg.afi))) return alert(`Ya existe un equipo con AFI ${reg.afi} en el inventario.`);
  if (!confirm(`¿Restaurar el equipo AFI ${reg.afi} al inventario?`)) return;
  const { id, _empresa, ...fila } = reg.datos;
  if (fila.foto === '(foto omitida)') fila.foto = null;
  try {
    await sb(supabaseClient.from(TABLA_INVENTARIO).insert([fila]));
    await sb(supabaseClient.from(TABLA_ELIMINADOS).update({ restaurado_at: new Date().toISOString(), restaurado_por: usuarioTxt() }).eq('id', reg.id));
  } catch (err) { return alert('No se pudo restaurar: ' + errMsg(err)); }
  await cargarDatosDesdeSupabase();
  await cargarEliminados();
  alert(`Equipo AFI ${reg.afi} restaurado.`);
};

export const exportarEliminados = (exportarCSV) => exportarCSV(eliminadosFiltrados.value.map(r => ({
  FECHA: fmtFechaHoraBaja(r.fecha), AFI: r.afi, TIPO: r.tipo, MARCA: r.marca, MODELO: r.modelo,
  MOTIVO: r.motivo, DETALLE: r.detalle, USUARIO: r.usuario,
  RESTAURADO: r.restaurado_at ? `${fmtFechaHoraBaja(r.restaurado_at)} por ${r.restaurado_por || ''}` : ''
})), 'Equipos_Eliminados');
