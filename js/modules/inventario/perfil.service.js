// =====================================================================
// INVENTARIO AFI · Perfil de Equipo (ficha, horómetro manual, dashboard individual)
// Se abre desde cualquier módulo al hacer clic en un AFI.
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { empresaDe, esFueraDeServicio, EMPRESA_TALLER } from './inventario.mapper.js';
import { listaEmpresas } from '../../core/store.js';
import { dbIntervenciones, dbEquipos, cargarDatosDesdeSupabase, buscarEquipoPorAfi, soloEditor } from '../../core/store.js';
import { normalizarFecha, formatExcelDate, formatIsoDateForSupabase, parseIsoDate, parseNum, mismoAfi, hoyISO } from '../../core/utils.js';
import { TABLA_INVENTARIO } from './inventario.mapper.js';
import { insertarItemPrograma } from '../programas/programas.service.js';
import { selDesdeLocacion, selCompleta, selVacia, resolverSeleccion, rutaDe, textoUbicacion, rutaTexto, nombresSel, abrirNodo, googleMapsUrl, AVISO_SQL } from '../areas/areas.service.js';
import { currentTab } from '../../core/store.js';

const { ref, computed } = Vue;

export const showPerfilEquipoModal = ref(false);
export const perfilEquipo = ref({});

// ---------- Filtros del dashboard individual ----------
export const perfilFiltroFechaInicio = ref("");
export const perfilFiltroFechaFin = ref("");
export const perfilFiltroCausa = ref("ALL");

export const resetFiltrosPerfil = () => {
  perfilFiltroFechaInicio.value = "";
  perfilFiltroFechaFin.value = "";
  perfilFiltroCausa.value = "ALL";
};

/** Causas registradas para el equipo abierto (antes listaba las de toda la flota). */
export const listaCausasEquipo = computed(() => {
  const setC = new Set();
  dbIntervenciones.value.forEach(i => {
    if (mismoAfi(i.afi, perfilEquipo.value.afi) && i.causa && i.causa !== '-') setC.add(String(i.causa).trim().toUpperCase());
  });
  return Array.from(setC).sort();
});

export const getHistorialIntervencionesFiltradoAFI = (afi) => {
  let arr = dbIntervenciones.value.filter(i => mismoAfi(i.afi, afi));
  if (perfilFiltroCausa.value !== "ALL") arr = arr.filter(i => String(i.causa || '').trim().toUpperCase() === perfilFiltroCausa.value.toUpperCase());
  if (perfilFiltroFechaInicio.value) arr = arr.filter(i => formatExcelDate(i.fecha) >= perfilFiltroFechaInicio.value);
  if (perfilFiltroFechaFin.value) arr = arr.filter(i => formatExcelDate(i.fecha) <= perfilFiltroFechaFin.value);
  return arr.sort((a, b) => parseIsoDate(b.fecha) - parseIsoDate(a.fecha));
};

export const costoTotalIntervencionesFiltradasAFI = (afi) =>
  getHistorialIntervencionesFiltradoAFI(afi).reduce((acc, curr) => acc + Number(curr.costo || 0), 0);

export const causaMasFrecuenteEquipo = (afi) => {
  const arr = getHistorialIntervencionesFiltradoAFI(afi);
  if (arr.length === 0) return 'Sin datos';
  const counts = {};
  arr.forEach(i => { const c = String(i.causa || 'S/C').trim().toUpperCase(); counts[c] = (counts[c] || 0) + 1; });
  let maxC = '', maxN = -1;
  for (const [c, n] of Object.entries(counts)) if (n > maxN) { maxN = n; maxC = c; }
  return `${maxC} (${maxN})`;
};

// ---------- Abrir / guardar ----------
export const abrirPerfilEquipo = (equipo) => {
  perfilEquipo.value = JSON.parse(JSON.stringify(equipo));
  perfilEquipo.value.fechaHorometroManual = normalizarFecha(equipo.fechaHorometroManual) || hoyISO();
  perfilEquipo.value.empresaArriendo = empresaDe(equipo);
  perfilEquipo.value.sel = selDesdeLocacion(equipo.locacionId);   // Empresa → Área → Sector → Locación (módulo Áreas)
  resetFiltrosPerfil();
  perfilAsignacionFechaInicio.value = ''; perfilAsignacionFechaFin.value = '';
  showPerfilEquipoModal.value = true;
};

export const verDetallePorAfiString = (afiStr) => {
  const eq = buscarEquipoPorAfi(afiStr);
  if (eq) abrirPerfilEquipo(eq);
  else alert(`El AFI ${afiStr} no existe en el inventario.`);
};

export const guardarPerfilEquipo = async () => {
  if (!soloEditor()) return;
  const p = perfilEquipo.value;
  const sel = p.sel;
  if (sel && !selVacia(sel) && !selCompleta(sel)) return alert("Completa la ubicación: Empresa → Área → Sector → Locación (o elige \"➕ Crear nueva…\" y escribe el nombre).");
  // Crea la empresa / área / locación nueva si corresponde
  let locId = null;
  if (sel && selCompleta(sel)) {
    try { locId = await resolverSeleccion(sel); }
    catch (err) { return alert("No se pudo crear la locación: " + errMsg(err)); }
  }
  const ruta = rutaDe(locId);
  const empresaTxt = ruta.empresa ? ruta.empresa.nombre : String(p.empresaArriendo || '').trim().toUpperCase();
  const payload = {
    afi: String(p.afi || '').trim(),
    tipo: p.tipo, marca: p.marca, modelo: p.modelo,
    ubicacion: locId ? textoUbicacion(locId) : p.ubicacion,
    disponibilidad: p.disponibilidad, gps: p.gps, imei_gps: p.imei_gps,
    empresa_arriendo: esFueraDeServicio(p) ? EMPRESA_TALLER : (empresaTxt || null),
    horometroactual: parseNum(p.horometroActual),
    fecha_horometro_manual: formatIsoDateForSupabase(p.fechaHorometroManual),
    frecuencia_mantencion: Math.round(parseNum(p.frecuenciaMantencion)) || 250
  };
  // Solo se envía locacion_id si se eligió una o si se quitó la que tenía (así funciona aunque falte sql/areas.sql)
  if (locId || p.locacionId != null) payload.locacion_id = locId;
  if (!payload.afi) return alert("El AFI no puede quedar vacío.");
  try {
    await sb(supabaseClient.from(TABLA_INVENTARIO).update(payload).eq('id', p.id));
  } catch (err) {
    if (/locacion_id/i.test(errMsg(err))) return alert(AVISO_SQL);
    if (/empresa_arriendo/i.test(errMsg(err))) return alert("Falta la columna 'empresa_arriendo' en BD_INVENTARIO. Ejecuta en Supabase → SQL Editor el archivo sql/empresa_arriendo.sql:\n\nALTER TABLE public.\"BD_INVENTARIO\" ADD COLUMN IF NOT EXISTS empresa_arriendo text;\nNOTIFY pgrst, 'reload schema';");
    return alert("Error al guardar el perfil: " + errMsg(err));
  }
  await cargarDatosDesdeSupabase();
  showPerfilEquipoModal.value = false;
  alert("¡Perfil guardado correctamente!");
};

// ---------- Ubicación (módulo Áreas) ----------
export { rutaTexto, googleMapsUrl };
/** Empresa que sale de la selección Empresa → Área → Sector → Locación del perfil ('' si no hay). */
export const empresaDeSelPerfil = computed(() => {
  const sel = perfilEquipo.value?.sel;
  return sel ? nombresSel(sel).empresa : '';
});
/** Abre el módulo Áreas en la locación del equipo. */
export const verLocacionEnAreas = (locId) => {
  showPerfilEquipoModal.value = false;
  currentTab.value = 'areas';
  abrirNodo(locId);
};

// ---------- Actualizar solo horómetro / fecha / frecuencia (sin cerrar el perfil) ----------
export const actualizandoHorometro = ref(false);
export const actualizarHorometroPerfil = async () => {
  if (!soloEditor()) return;
  const p = perfilEquipo.value;
  const h = parseNum(p.horometroActual);
  if (!(h > 0)) return alert("Ingresa el horómetro tomado (mayor a 0).");
  if (!p.fechaHorometroManual) return alert("Ingresa la fecha del horómetro.");
  const hMant = Number(p.horometros?.hUltimaMant) || 0;
  if (hMant > 0 && h < hMant && !confirm(`El horómetro ingresado (${h}h) es MENOR que la última mantención (${hMant}h). ¿Guardar de todas formas?`)) return;
  actualizandoHorometro.value = true;
  try {
    await sb(supabaseClient.from(TABLA_INVENTARIO).update({
      horometroactual: h,
      fecha_horometro_manual: formatIsoDateForSupabase(p.fechaHorometroManual),
      frecuencia_mantencion: Math.round(parseNum(p.frecuenciaMantencion)) || 250
    }).eq('id', p.id));
    await cargarDatosDesdeSupabase();
    // Refresca los cálculos del perfil abierto sin perder lo que se está editando
    const eq = dbEquipos.value.find(e => e.id === p.id);
    if (eq) p.horometros = JSON.parse(JSON.stringify(eq.horometros || {}));
  } catch (err) {
    alert("Error al actualizar horómetro: " + errMsg(err));
  } finally {
    actualizandoHorometro.value = false;
  }
};

// ---------- Asignación a programa desde el perfil ----------
export const perfilAsignacionProgId = ref('');
export const perfilAsignacionTipo = ref('Reparación');
export const perfilAsignacionNave = ref('NAVE 1');
export const perfilAsignacionCondicion = ref('Arriendo');
export const perfilAsignacionFechaInicio = ref('');
export const perfilAsignacionFechaFin = ref('');

export const guardarAsignacionDesdePerfil = async () => {
  if (!soloEditor()) return;
  if (!perfilAsignacionProgId.value || !perfilAsignacionFechaInicio.value) return alert("Selecciona programa y fecha de inicio.");
  try {
    await insertarItemPrograma({
      programa_id: perfilAsignacionProgId.value,
      afi: perfilEquipo.value.afi,
      tipo: perfilAsignacionTipo.value,
      nave: perfilAsignacionNave.value,
      condicion: perfilAsignacionCondicion.value,
      fechaInicio: perfilAsignacionFechaInicio.value,
      fechaFin: perfilAsignacionFechaFin.value
    });
    alert("¡Equipo asignado al programa con éxito!");
    perfilAsignacionFechaInicio.value = ''; perfilAsignacionFechaFin.value = '';
  } catch (err) {
    alert("Error al asignar equipo: " + errMsg(err));
  }
};

// ---------- Empresa arrendada ----------
export { listaEmpresas, EMPRESA_TALLER, esFueraDeServicio };
/** Al cambiar la disponibilidad: Fuera de Servicio → TALLER FRC; al salir de Fuera de Servicio se limpia para escribir la nueva. */
export const alCambiarDisponibilidadPerfil = () => {
  const p = perfilEquipo.value;
  if (esFueraDeServicio(p)) p.empresaArriendo = EMPRESA_TALLER;
  else if (p.empresaArriendo === EMPRESA_TALLER) p.empresaArriendo = '';
};
