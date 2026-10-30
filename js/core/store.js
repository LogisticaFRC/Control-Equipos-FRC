// =====================================================================
// CORE · Estado global compartido entre módulos + carga de datos
// =====================================================================
import { fetchAllRows } from './supabase.js';
import { TABLAS } from './tablas.js';
import { compararAfi, mismoAfi } from './utils.js';
import { actualizarHorometrosDesdeHistorial } from './horometros.js';
import { mapEquipo, TABLA_INVENTARIO } from '../modules/inventario/inventario.mapper.js';
import { mapMovimiento, TABLA_MOVIMIENTOS } from '../modules/movimientos/movimientos.mapper.js';
import { mapIntervencion, TABLA_HISTORIAL } from '../modules/historial/historial.mapper.js';
import { mapAplicacion, mapPrecio, TABLA_FILTROS, TABLA_FILTROS_PRECIOS } from '../modules/filtros/filtros.mapper.js';

const { ref, computed } = Vue;

// ---------- Sesión y navegación ----------
export const usuarioActivo = ref(null);
export const isAdmin = computed(() => Boolean(usuarioActivo.value && usuarioActivo.value.rol === 'admin'));
/** SUBADMIN: lectura + editar horómetros, registrar/editar mantenciones y equipos, y cambiar el estado
 *  "Realizado" en Programas. NO puede eliminar nada, ni crear/borrar programas, ni modificar fechas. */
export const isSubadmin = computed(() => Boolean(usuarioActivo.value && usuarioActivo.value.rol === 'subadmin'));
/** Admin o Subadmin: puede editar equipos, horómetros y mantenciones. */
export const puedeEditar = computed(() => isAdmin.value || isSubadmin.value);
export const currentTab = ref('dashboard');

/** Guardas de permisos (se usan en los services para bloquear acciones aunque se fuerce el botón). */
export const soloAdmin = () => {
  if (isAdmin.value) return true;
  alert("Acción no permitida: requiere perfil Administrador.");
  return false;
};
export const soloEditor = () => {
  if (isAdmin.value || isSubadmin.value) return true;
  alert("Acción no permitida: tu perfil es de solo lectura.");
  return false;
};

// ---------- Personalización ----------
/** Logo oficial (imagen directa de imgur). Subir LOGO_VERSION obliga a reemplazar el logo guardado en los navegadores. */
export const LOGO_DEFAULT = "https://i.imgur.com/J9QQiUc.png";
export const LOGO_VERSION = 2;
export const CONFIG_DEFAULT = {
  title: "Control AFI & Programación",
  subtitle: "Maquinarias, Traslados y Mantenciones - FRC",
  logo: LOGO_DEFAULT,
  logoVersion: LOGO_VERSION,
  customHeaderBg: "#0f172a", customBodyBg: "#f1f5f9", customPrimaryBg: "#f59e0b", customPrimaryText: "#0f172a"
};
export const config = ref({ ...CONFIG_DEFAULT });

// ---------- Tablas ----------
export const dbUsuarios = ref([]);
export const dbEquipos = ref([]);
export const dbMovimientos = ref([]);
export const dbIntervenciones = ref([]);
export const dbProgramasCalendarios = ref([]);
export const dbProgramasItems = ref([]);
export const dbModelosFichas = ref([]);   // módulo Formatos (en construcción)
export const dbFormatos = ref([]);        // módulo Formatos (en construcción)
export const dbFiltros = ref([]);         // módulo Filtros: aplicaciones por marca/modelo (bd_filtros)
export const dbFiltrosPrecios = ref([]);  // módulo Filtros: lista de precios por proveedor (bd_filtros_precios)

/** Se incrementa cada vez que cambian los datos (los gráficos lo observan para redibujarse). */
export const datosVersion = ref(0);

export const buscarEquipoPorAfi = (afi) => dbEquipos.value.find(e => mismoAfi(e.afi, afi));

export const obtenerDetalleEquipoPorAfi = (afi, campo) => {
  const eq = buscarEquipoPorAfi(afi);
  return eq ? (eq[campo] || '-') : '-';
};

/** Recalcula horómetros de toda la flota y avisa a los gráficos. */
export const recalcularHorometros = () => {
  actualizarHorometrosDesdeHistorial(dbEquipos.value, dbIntervenciones.value);
  datosVersion.value++;
};

export const cargandoDatos = ref(false);

/** Carga todas las tablas desde Supabase. */
export const cargarDatosDesdeSupabase = async () => {
  cargandoDatos.value = true;
  try {
    const [eqData, movData, intData, calData, itemData, modData, fmtData, filData, preData] = await Promise.all([
      fetchAllRows(TABLA_INVENTARIO),
      fetchAllRows(TABLA_MOVIMIENTOS),
      fetchAllRows(TABLA_HISTORIAL),
      fetchAllRows(TABLAS.PROGRAMAS),
      fetchAllRows(TABLAS.PROGRAMAS_ITEMS),
      fetchAllRows(TABLAS.MODELOS_FICHA),
      fetchAllRows(TABLAS.FORMATOS),
      fetchAllRows(TABLA_FILTROS),
      fetchAllRows(TABLA_FILTROS_PRECIOS)
    ]);

    dbEquipos.value = eqData.map(mapEquipo).sort((a, b) => compararAfi(a.afi, b.afi));
    dbMovimientos.value = movData.map(mapMovimiento);
    dbIntervenciones.value = intData.map(mapIntervencion);
    dbProgramasCalendarios.value = calData;
    dbProgramasItems.value = itemData;
    dbModelosFichas.value = modData;
    dbFormatos.value = fmtData;
    dbFiltros.value = filData.map(mapAplicacion);
    dbFiltrosPrecios.value = preData.map(mapPrecio);

    recalcularHorometros();
  } catch (err) {
    console.error("Error cargando datos:", err);
  } finally {
    cargandoDatos.value = false;
  }
};
