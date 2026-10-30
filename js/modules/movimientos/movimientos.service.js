// =====================================================================
// MOVIMIENTOS · Lógica (filtros, registro de traslados, importación)
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { dbEquipos, dbMovimientos, cargarDatosDesdeSupabase, buscarEquipoPorAfi, soloAdmin } from '../../core/store.js';
import { normalizarClave, parseStr, formatExcelDate, formatIsoDateForSupabase, parseIsoDate, limpiarAfi, mismoAfi, hoyISO, getVal, parseFileAnyFormat, resetInputFile } from '../../core/utils.js';
import { TABLA_MOVIMIENTOS } from './movimientos.mapper.js';
import { TABLA_INVENTARIO } from '../inventario/inventario.mapper.js';

const { ref, computed } = Vue;

// ---------- Filtros ----------
const FILTRO_MOV_DEFAULT = () => ({ dateStart: "", dateEnd: "", afi: "ALL", queryText: "", estado: "ALL" });
export const filterMov = ref(FILTRO_MOV_DEFAULT());
export const sortMovimientosOrder = ref("desc");
export const limpiarFiltrosMovimientos = () => { filterMov.value = FILTRO_MOV_DEFAULT(); };

export const filteredMovimientos = computed(() => {
  const f = filterMov.value;
  const q = f.queryText.toLowerCase();
  const arr = dbMovimientos.value.filter(m => {
    if (f.afi !== "ALL" && !mismoAfi(m.afi, f.afi)) return false;
    const fStr = formatExcelDate(m.fecha);
    if (f.dateStart && fStr < f.dateStart) return false;
    if (f.dateEnd && fStr > f.dateEnd) return false;
    if (q && ![m.afi, m.tipo, m.origen, m.destino, m.empresa_arriendo, m.estado, m.camion, m.conductor].join(" ").toLowerCase().includes(q)) return false;
    return true;
  });
  return arr.sort((a, b) => sortMovimientosOrder.value === 'desc' ? parseIsoDate(b.fecha) - parseIsoDate(a.fecha) : parseIsoDate(a.fecha) - parseIsoDate(b.fecha));
});

/** Traslados de un equipo (más recientes primero). Usado en el Perfil de Equipo. */
export const getHistorialMovimientosAFI = (afi) => dbMovimientos.value
  .filter(m => mismoAfi(m.afi, afi))
  .sort((a, b) => parseIsoDate(b.fecha) - parseIsoDate(a.fecha));

// ---------- Registrar movimiento ----------
const MOV_DEFAULT = () => ({ afi: dbEquipos.value[0]?.afi || "", fecha: hoyISO(), tipo: "Traslado", origen: "", destino: "", empresa_arriendo: "", estado: "Operativo", camion: "", conductor: "" });
export const showModalMovimiento = ref(false);
export const formMov = ref(MOV_DEFAULT());

export const abrirModalCrearMovimiento = () => {
  formMov.value = MOV_DEFAULT();
  showModalMovimiento.value = true;
};

export const guardarNuevoMovimiento = async () => {
  if (!soloAdmin()) return;
  const f = formMov.value;
  const payload = {
    afi: limpiarAfi(f.afi),
    fecha: formatIsoDateForSupabase(f.fecha),
    tipo: parseStr(f.tipo),
    ubicacion_anterior: parseStr(f.origen),
    ubicacion_actual: parseStr(f.destino),
    empresa_arriendo: parseStr(f.empresa_arriendo),
    estado: parseStr(f.estado),
    camion_encargado: parseStr(f.camion),
    conductor_encargado: parseStr(f.conductor)
  };
  try {
    await sb(supabaseClient.from(TABLA_MOVIMIENTOS).insert([payload]));
  } catch (err) {
    return alert("Error al registrar el movimiento: " + errMsg(err));
  }

  // Actualiza ubicación y estado del equipo en el inventario
  let avisoEquipo = "";
  const eqRef = buscarEquipoPorAfi(payload.afi);
  if (eqRef) {
    const updateObj = {};
    if (payload.ubicacion_actual) updateObj.ubicacion = payload.ubicacion_actual;
    if (payload.estado) updateObj.disponibilidad = normalizarClave(payload.estado);
    if (Object.keys(updateObj).length > 0) {
      try { await sb(supabaseClient.from(TABLA_INVENTARIO).update(updateObj).eq('id', eqRef.id)); }
      catch (err) { avisoEquipo = "\n(Atención: no se pudo actualizar la ubicación/estado del equipo: " + errMsg(err) + ")"; }
    }
  }

  await cargarDatosDesdeSupabase();
  showModalMovimiento.value = false;
  alert("¡Movimiento registrado y equipo actualizado con éxito!" + avisoEquipo);
};

// ---------- Importación desde Excel ----------
export const importarMovimientosFile = async (e) => {
  if (!soloAdmin()) return;
  const file = e.target.files[0]; if (!file) return;
  try {
    const rows = await parseFileAnyFormat(file);
    const payloads = rows.map(item => ({
      afi: limpiarAfi(getVal(item, "afi")),
      fecha: formatIsoDateForSupabase(getVal(item, "fecha")),
      tipo: parseStr(getVal(item, "tipo")),
      ubicacion_anterior: parseStr(getVal(item, "origen")),
      ubicacion_actual: parseStr(getVal(item, "destino")),
      empresa_arriendo: parseStr(getVal(item, "empresa_arriendo", "empresa arriendo")),
      estado: parseStr(getVal(item, "estado")),
      camion_encargado: parseStr(getVal(item, "camion", "camion encargado")),
      conductor_encargado: parseStr(getVal(item, "conductor"))
    })).filter(i => i.afi);
    if (!payloads.length) return alert("El archivo no tiene filas con AFI.");
    await sb(supabaseClient.from(TABLA_MOVIMIENTOS).insert(payloads));
    await cargarDatosDesdeSupabase();
    alert(`¡Importados ${payloads.length} movimientos!`);
  } catch (err) {
    alert("Error al importar movimientos: " + errMsg(err));
  } finally { resetInputFile(e); }
};
