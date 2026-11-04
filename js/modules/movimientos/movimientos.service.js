// =====================================================================
// MOVIMIENTOS · Lógica (filtros, registro de traslados, importación)
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { dbEquipos, dbMovimientos, cargarDatosDesdeSupabase, buscarEquipoPorAfi, soloAdmin } from '../../core/store.js';
import { normalizarClave, parseStr, formatExcelDate, formatIsoDateForSupabase, parseIsoDate, limpiarAfi, mismoAfi, hoyISO, getVal, parseFileAnyFormat, resetInputFile } from '../../core/utils.js';
import { TABLA_MOVIMIENTOS } from './movimientos.mapper.js';
import { TABLA_INVENTARIO } from '../inventario/inventario.mapper.js';
import { selDesdeLocacion, selCompleta, selVacia, resolverSeleccion, rutaDe, rutaTexto, textoUbicacion, nodo } from '../areas/areas.service.js';

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
// Destino = Empresa → Área → Sector → Locación del módulo ÁREAS (formMov.sel). Origen = dónde está hoy el equipo.
const MOV_DEFAULT = () => ({ afi: "", fecha: hoyISO(), tipo: "Traslado", origen: "", destino: "", empresa_arriendo: "", estado: "Operativo", camion: "", conductor: "", sel: selDesdeLocacion(null) });
export const showModalMovimiento = ref(false);
export const formMov = ref(MOV_DEFAULT());

/** Texto de origen: locación actual del equipo (o su ubicación en texto si aún no tiene locación). */
const origenDeEquipo = (eq) => {
  if (!eq) return '';
  return nodo(eq.locacionId) ? textoUbicacion(eq.locacionId) : (eq.ubicacion || '');
};
export const alCambiarAfiMov = () => {
  const eq = buscarEquipoPorAfi(formMov.value.afi);
  formMov.value.origen = origenDeEquipo(eq);
};
/** Ruta completa del origen (Empresa › Área › Sector › Locación), para mostrar bajo el campo. */
export const origenRuta = computed(() => {
  const eq = buscarEquipoPorAfi(formMov.value.afi);
  return eq && nodo(eq.locacionId) ? rutaTexto(eq.locacionId) : '';
});

export const abrirModalCrearMovimiento = (afi = '') => {
  formMov.value = MOV_DEFAULT();
  if (typeof afi === 'string' && afi) { formMov.value.afi = afi; alCambiarAfiMov(); }   // (desde un botón llega el evento, se ignora)
  showModalMovimiento.value = true;
};

export const guardarNuevoMovimiento = async () => {
  if (!soloAdmin()) return;
  const f = formMov.value;
  const sel = f.sel;
  if (!selVacia(sel) && !selCompleta(sel)) return alert("Completa el destino: Empresa → Área → Sector → Locación (o elige \"➕ Crear nueva…\" y escribe el nombre).");
  if (selVacia(sel) && !confirm("No elegiste destino (Empresa → Área → Sector → Locación).\n¿Guardar el movimiento sin destino? La ubicación del equipo no cambiará.")) return;

  // 1) Crea la empresa / área / locación nueva si corresponde
  let locId = null;
  if (selCompleta(sel)) {
    try { locId = await resolverSeleccion(sel); }
    catch (err) { return alert("No se pudo crear la locación de destino: " + errMsg(err)); }
  }
  const ruta = rutaDe(locId);

  const payload = {
    afi: limpiarAfi(f.afi),
    fecha: formatIsoDateForSupabase(f.fecha),
    tipo: parseStr(f.tipo),
    ubicacion_anterior: parseStr(f.origen),
    ubicacion_actual: locId ? textoUbicacion(locId) : '',
    empresa_arriendo: ruta.empresa ? ruta.empresa.nombre : '',
    estado: parseStr(f.estado),
    camion_encargado: parseStr(f.camion),
    conductor_encargado: parseStr(f.conductor),
    locacion_id: locId
  };
  try {
    await sb(supabaseClient.from(TABLA_MOVIMIENTOS).insert([payload]));
  } catch (err) {
    // Si aún no se ejecutó sql/areas.sql (sin columna locacion_id), se guarda igual sin ella
    if (!/locacion_id/i.test(errMsg(err))) return alert("Error al registrar el movimiento: " + errMsg(err));
    delete payload.locacion_id;
    try { await sb(supabaseClient.from(TABLA_MOVIMIENTOS).insert([payload])); }
    catch (err2) { return alert("Error al registrar el movimiento: " + errMsg(err2)); }
  }

  // Actualiza ubicación y estado del equipo en el inventario
  let avisoEquipo = "";
  const eqRef = buscarEquipoPorAfi(payload.afi);
  if (eqRef) {
    const updateObj = {};
    if (payload.ubicacion_actual) updateObj.ubicacion = payload.ubicacion_actual;
    if (locId) updateObj.locacion_id = locId;
    if (payload.estado) updateObj.disponibilidad = normalizarClave(payload.estado);
    // Empresa arrendada: Fuera de Servicio = TALLER FRC; si el movimiento trae empresa, pasa a ser la del equipo
    if (updateObj.disponibilidad === 'Fuera de Servicio') updateObj.empresa_arriendo = 'TALLER FRC';
    else if (payload.empresa_arriendo) updateObj.empresa_arriendo = String(payload.empresa_arriendo).trim().toUpperCase();
    if (Object.keys(updateObj).length > 0) {
      try {
        try { await sb(supabaseClient.from(TABLA_INVENTARIO).update(updateObj).eq('id', eqRef.id)); }
        catch (err) {
          // Si aún no existe la columna empresa_arriendo, se actualiza igual ubicación y estado
          if (/locacion_id/i.test(errMsg(err)) && 'locacion_id' in updateObj) {
            delete updateObj.locacion_id;
            avisoEquipo = "\n(Atención: falta ejecutar sql/areas.sql en Supabase; el equipo no quedó enlazado a la locación)";
          } else if (('empresa_arriendo' in updateObj) && /empresa_arriendo/i.test(errMsg(err))) {
            delete updateObj.empresa_arriendo;
            avisoEquipo = "\n(Atención: falta la columna empresa_arriendo en BD_INVENTARIO, ver sql/empresa_arriendo.sql)";
          } else throw err;
          if (Object.keys(updateObj).length) await sb(supabaseClient.from(TABLA_INVENTARIO).update(updateObj).eq('id', eqRef.id));
        }
      }
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
