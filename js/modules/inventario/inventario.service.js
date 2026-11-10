// =====================================================================
// INVENTARIO AFI · Lógica (filtros, alta de equipos, fotos, importación)
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { dbEquipos, cargarDatosDesdeSupabase, soloEditor, soloAdmin } from '../../core/store.js';
import { normalizarClave, parseNum, parseStr, compararAfi, exportarCSV, getVal, tieneColumna, parseFileAnyFormat, resetInputFile, formatDateForDisplay } from '../../core/utils.js';
import { esEquipoCritico, VEH_FRECUENCIA_KM } from '../../core/horometros.js';
import { TABLA_INVENTARIO, empresaDe, esVehiculo, esPatente } from './inventario.mapper.js';
import { currentTab } from '../../core/store.js';
import { listaEmpresas } from '../../core/store.js';
export { empresaDe, listaEmpresas };

const { ref, computed } = Vue;

// ---------- Estados ----------
export const ESTADOS = ['Operativo', 'Disponible', 'En Traslado', 'En Mantencion', 'Fuera de Servicio', 'Venta'];

export const countEstado = (st) => dbEquipos.value.filter(e => normalizarClave(e.disponibilidad) === normalizarClave(st)).length;

export const getEstadoText = (est) => {
  const norm = normalizarClave(est);
  if (norm === 'Operativo') return 'Trabajando / Operativo';
  if (norm === 'Disponible') return 'Disponible';
  if (norm === 'En Traslado') return 'En Traslado';
  if (norm === 'En Mantencion') return 'En Mantención';
  return est || '-';
};

export const getBadgeClass = (est) => {
  const norm = normalizarClave(est);
  if (norm === 'Operativo') return 'bg-emerald-100 text-emerald-800 border';
  if (norm === 'Disponible') return 'bg-sky-100 text-sky-800 border';
  if (norm === 'En Traslado') return 'bg-amber-100 text-amber-800 border';
  if (norm === 'En Mantencion') return 'bg-rose-100 text-rose-800 border';
  return 'bg-slate-100 text-slate-700 border';
};

// ---------- Filtros ----------
const FILTRO_INV_DEFAULT = () => ({ search: "", ubicacion: "", empresa: "ALL", estado: "ALL", gps: "ALL", mostrarCriticos: false });
export const filterInv = ref(FILTRO_INV_DEFAULT());
export const sortInventarioOrder = ref("asc");

export const toggleFiltroCriticos = () => { filterInv.value.mostrarCriticos = !filterInv.value.mostrarCriticos; };
export const resetFiltrosInventario = () => { filterInv.value = FILTRO_INV_DEFAULT(); };

export const filteredEquipos = computed(() => {
  const f = filterInv.value;
  // Los vehículos (AFI = patente XXXX-XX) se ven en el módulo Vehículos, no aquí
  const arr = dbEquipos.value.filter(e => !esVehiculo(e)).filter(e => {
    const matchSearch = !f.search || [e.afi, e.tipo, e.marca, e.modelo, e.ubicacion, empresaDe(e)].join(" ").toLowerCase().includes(f.search.toLowerCase());
    const matchUbi = !f.ubicacion || String(e.ubicacion).toLowerCase().includes(f.ubicacion.toLowerCase());
    const emp = empresaDe(e);
    const matchEmp = f.empresa === "ALL" || (f.empresa === "SIN" ? !emp : emp === f.empresa);
    const matchEst = f.estado === "ALL" || normalizarClave(e.disponibilidad) === normalizarClave(f.estado);
    const matchGps = f.gps === "ALL" || (f.gps === 'Instalado' ? Boolean(e.gps && e.gps !== 'Sin GPS') : (!e.gps || e.gps === 'Sin GPS'));
    const matchCritico = !f.mostrarCriticos || esEquipoCritico(e);
    return matchSearch && matchUbi && matchEmp && matchEst && matchGps && matchCritico;
  });
  return arr.sort((a, b) => compararAfi(a.afi, b.afi, sortInventarioOrder.value));
});

/** Exporta el inventario filtrado (sin la foto en base64 ni objetos anidados). */
export const exportarInventarioCSV = () => {
  exportarCSV(filteredEquipos.value.map(e => ({
    AFI: e.afi, Tipo: e.tipo, Marca: e.marca, Modelo: e.modelo, Ubicacion: e.ubicacion, Empresa_Arriendo: empresaDe(e),
    Disponibilidad: e.disponibilidad, GPS: e.gps, IMEI_GPS: e.imei_gps,
    Frecuencia_Mantencion: e.frecuenciaMantencion,
    Horometro_Tomado: e.horometros?.hTomado ?? '', Fecha_Horometro: formatDateForDisplay(e.horometros?.fechaUltimoHorometro),
    Horometro_Aprox: e.horometros?.hAprox ?? '', Meta_Proxima_Mant: e.horometros?.hTarget ?? '',
    Horas_Faltantes: e.horometros?.horasFaltantes ?? '', Estado_Horometro: e.horometros?.estadoTexto ?? '',
    Uso_Hrs_Dia: e.horometros?.rateHrsDia ? e.horometros.rateHrsDia.toFixed(2) : '',
    Fecha_Aprox_Mantencion: formatDateForDisplay(e.horometros?.fechaEstimada),
    Fecha_Ultima_Mantencion: formatDateForDisplay(e.horometros?.fechaBaseAnual),
    Vence_Mant_Anual: formatDateForDisplay(e.horometros?.fechaVencAnual),
    Dias_Para_Anual: e.horometros?.diasParaAnual ?? '',
    Estado_Anual: e.horometros?.estadoAnual ?? ''
  })), 'Inventario_AFI_Filtrado');
};

/** Atajo desde el Dashboard: filtra por estado y abre Inventario. */
export const filtrarPorEstado = (estado) => { filterInv.value.estado = estado; };

// ---------- Foto del equipo ----------
export const uploadFotoEquipo = (e, item) => {
  if (!soloEditor()) return;
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    const fotoBase64 = evt.target.result;
    try {
      await sb(supabaseClient.from(TABLA_INVENTARIO).update({ foto: fotoBase64 }).eq('id', item.id));
      item.foto = fotoBase64;
      alert("¡Foto guardada con éxito!");
    } catch (err) {
      alert("Error al guardar la foto: " + errMsg(err));
    } finally { resetInputFile(e); }
  };
  reader.readAsDataURL(file);
};

// ---------- Alta de equipo ----------
const NUEVO_EQUIPO_DEFAULT = () => ({ afi: "", tipo: "", marca: "", modelo: "", ubicacion: "", disponibilidad: "Operativo", horometroActual: 0, frecuenciaMantencion: 250, gps: "Sin GPS" });
export const showModalNuevoEquipo = ref(false);
export const formNuevoEquipo = ref(NUEVO_EQUIPO_DEFAULT());

export const abrirModalCrearEquipo = () => {
  formNuevoEquipo.value = NUEVO_EQUIPO_DEFAULT();
  showModalNuevoEquipo.value = true;
};

export const guardarNuevoEquipo = async () => {
  if (!soloEditor()) return;
  const f = formNuevoEquipo.value;
  const afiClean = String(f.afi || '').trim();
  if (!afiClean || !f.tipo) return alert("Ingresa al menos el AFI y el Tipo de Equipo.");
  if (dbEquipos.value.some(e => String(e.afi).trim().toUpperCase() === afiClean.toUpperCase())) {
    return alert(`El AFI ${afiClean} ya existe en el inventario.`);
  }
  const payload = {
    afi: afiClean,
    tipo: parseStr(f.tipo), marca: parseStr(f.marca), modelo: parseStr(f.modelo), ubicacion: parseStr(f.ubicacion),
    disponibilidad: normalizarClave(f.disponibilidad),
    horometroactual: parseNum(f.horometroActual),
    // Vehículo (AFI = patente XXXX-XX): mantención cada 10.000 km
    frecuencia_mantencion: esPatente(afiClean) && Number(f.frecuenciaMantencion) === 250 ? VEH_FRECUENCIA_KM : (Math.round(parseNum(f.frecuenciaMantencion)) || 250),
    gps: parseStr(f.gps)
  };
  try {
    await sb(supabaseClient.from(TABLA_INVENTARIO).insert([payload]));
    await cargarDatosDesdeSupabase(['inventario']);
    showModalNuevoEquipo.value = false;
    alert("¡Equipo agregado con éxito!");
  } catch (err) {
    alert("Error al agregar equipo en Supabase: " + errMsg(err));
  }
};

// ---------- Importación desde Excel ----------
export const importarInventarioFile = async (e) => {
  if (!soloAdmin()) return;
  const file = e.target.files[0]; if (!file) return;
  try {
    const rows = await parseFileAnyFormat(file);
    // Solo se envían las columnas que vienen en el Excel, para no sobrescribir datos existentes
    const traeHorometro = tieneColumna(rows, "horometro", "horometroactual");
    const traeFrecuencia = tieneColumna(rows, "frecuencia", "frecuencia mantencion", "frecuencia_mantencion");
    const payloads = rows.map(item => {
      const rawAfi = getVal(item, "afi", "codigo afi");
      if (!rawAfi) return null;
      const p = {
        afi: String(rawAfi).trim(), tipo: parseStr(getVal(item, "tipo")), marca: parseStr(getVal(item, "marca")), modelo: parseStr(getVal(item, "modelo")),
        ubicacion: parseStr(getVal(item, "ubicacion")), disponibilidad: normalizarClave(getVal(item, "disponibilidad") || "Operativo")
      };
      if (traeHorometro) p.horometroactual = parseNum(getVal(item, "horometro", "horometroactual"));
      if (traeFrecuencia) p.frecuencia_mantencion = Math.round(parseNum(getVal(item, "frecuencia", "frecuencia mantencion", "frecuencia_mantencion"))) || (esPatente(p.afi) ? VEH_FRECUENCIA_KM : 250);
      return p;
    }).filter(Boolean);
    if (!payloads.length) return alert("El archivo no tiene filas con AFI.");
    await sb(supabaseClient.from(TABLA_INVENTARIO).upsert(payloads, { onConflict: 'afi' }));
    await cargarDatosDesdeSupabase(['inventario']);
    alert(`¡Importados ${payloads.length} equipos!`);
  } catch (err) {
    alert("Error al importar inventario: " + errMsg(err));
  } finally { resetInputFile(e); }
};

/** Vehículos (van en su propio módulo) y atajo para ir a verlos. */
export const nVehiculosInv = computed(() => dbEquipos.value.filter(esVehiculo).length);
export const irAVehiculos = () => { currentTab.value = 'vehiculos'; };

/** Cantidad de equipos por empresa (para el filtro). Sin vehículos. */
export const conteoPorEmpresa = computed(() => {
  const m = {};
  dbEquipos.value.filter(e => !esVehiculo(e)).forEach(e => { const k = empresaDe(e) || 'SIN'; m[k] = (m[k] || 0) + 1; });
  return m;
});
