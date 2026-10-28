// =====================================================================
// INVENTARIO AFI · Perfil de Equipo (ficha, horómetro manual, dashboard individual)
// Se abre desde cualquier módulo al hacer clic en un AFI.
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { dbIntervenciones, cargarDatosDesdeSupabase, buscarEquipoPorAfi } from '../../core/store.js';
import { normalizarFecha, formatExcelDate, formatIsoDateForSupabase, parseIsoDate, parseNum, mismoAfi, hoyISO } from '../../core/utils.js';
import { TABLA_INVENTARIO } from './inventario.mapper.js';
import { insertarItemPrograma } from '../programas/programas.service.js';

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
  const p = perfilEquipo.value;
  const payload = {
    afi: String(p.afi || '').trim(),
    tipo: p.tipo, marca: p.marca, modelo: p.modelo, ubicacion: p.ubicacion,
    disponibilidad: p.disponibilidad, gps: p.gps, imei_gps: p.imei_gps,
    horometroactual: parseNum(p.horometroActual),
    fecha_horometro_manual: formatIsoDateForSupabase(p.fechaHorometroManual),
    frecuencia_mantencion: Math.round(parseNum(p.frecuenciaMantencion)) || 250
  };
  if (!payload.afi) return alert("El AFI no puede quedar vacío.");
  try {
    await sb(supabaseClient.from(TABLA_INVENTARIO).update(payload).eq('id', p.id));
  } catch (err) {
    return alert("Error al guardar el perfil: " + errMsg(err));
  }
  await cargarDatosDesdeSupabase();
  showPerfilEquipoModal.value = false;
  alert("¡Perfil guardado correctamente!");
};

// ---------- Asignación a programa desde el perfil ----------
export const perfilAsignacionProgId = ref('');
export const perfilAsignacionTipo = ref('Reparación');
export const perfilAsignacionNave = ref('NAVE 1');
export const perfilAsignacionCondicion = ref('Arriendo');
export const perfilAsignacionFechaInicio = ref('');
export const perfilAsignacionFechaFin = ref('');

export const guardarAsignacionDesdePerfil = async () => {
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
