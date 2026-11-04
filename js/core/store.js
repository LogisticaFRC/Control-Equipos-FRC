// =====================================================================
// CORE · Estado global compartido entre módulos + carga de datos
// =====================================================================
import { fetchAllRows } from './supabase.js';
import { TABLAS } from './tablas.js';
import { compararAfi, mismoAfi } from './utils.js';
import { actualizarHorometrosDesdeHistorial } from './horometros.js';
import { mapEquipo, TABLA_INVENTARIO, empresaDe, EMPRESA_TALLER } from '../modules/inventario/inventario.mapper.js';
import { mapMovimiento, TABLA_MOVIMIENTOS } from '../modules/movimientos/movimientos.mapper.js';
import { mapIntervencion, TABLA_HISTORIAL } from '../modules/historial/historial.mapper.js';
import { mapAplicacion, mapPrecio, TABLA_FILTROS, TABLA_FILTROS_PRECIOS } from '../modules/filtros/filtros.mapper.js';
import { mapStock, mapKit, mapKitItem, mapMovBodega } from '../modules/bodega/bodega.mapper.js';
import { mapOC, TABLA_OC } from '../modules/oc/oc.mapper.js';
import { mapLocacion, TABLA_LOCACIONES } from '../modules/areas/areas.mapper.js';
import { areaDeTab } from './menu.js';

const { ref, computed } = Vue;

// ---------- Sesión y navegación ----------
export const usuarioActivo = ref(null);
export const currentTab = ref('inicio');   // pantalla de Bienvenida (ver core/menu.js)

// ---------- Permisos por ÁREA ----------
// usuarios.rol = 'admin'  → ADMIN GENERAL: todo en todas las áreas + gestiona usuarios y configuración.
// Cualquier otro usuario  → su nivel depende del área, guardado en usuarios.permisos (jsonb), ej.:
//     { "operaciones": "admin", "finanzas": "subadmin" }   (área que no aparece = solo lectura)
// Niveles por área:
//   admin    → Admin del área: agregar, modificar y eliminar todo dentro de esa área.
//   subadmin → editar horómetros, mantenciones y equipos, estado "Realizado" en Programas (sin eliminar).
//   lectura  → solo ver.
export const NIVELES = [
  { key: 'lectura', label: 'Solo lectura' },
  { key: 'subadmin', label: 'Subadmin' },
  { key: 'admin', label: 'Admin del área' }
];

/** Permisos de un usuario por área. Usuarios antiguos sin permisos: 'subadmin' = Subadmin en Operaciones. */
export const permisosDe = (u) => {
  if (!u) return {};
  let p = u.permisos;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = null; } }
  if (p && typeof p === 'object' && Object.keys(p).length) return p;
  return u.rol === 'subadmin' ? { operaciones: 'subadmin' } : {};
};
/** Nivel ('admin' | 'subadmin' | 'lectura') de un usuario en un área. */
export const nivelEnArea = (areaKey, u = usuarioActivo.value) => {
  if (!u) return 'lectura';
  if (u.rol === 'admin') return 'admin';
  return permisosDe(u)[areaKey] || 'lectura';
};

/** Admin general (dueño del sistema). */
export const esAdminGeneral = computed(() => Boolean(usuarioActivo.value && usuarioActivo.value.rol === 'admin'));
/** Área de la pantalla actual y nivel del usuario en ella. */
export const areaActualKey = computed(() => areaDeTab(currentTab.value).key);
export const nivelActual = computed(() => nivelEnArea(areaActualKey.value));

/** Admin en el área actual (el Admin general siempre lo es). Todos los módulos usan esto. */
export const isAdmin = computed(() => nivelActual.value === 'admin');
/** Subadmin en el área actual. */
export const isSubadmin = computed(() => nivelActual.value === 'subadmin');
/** Admin o Subadmin en el área actual. */
export const puedeEditar = computed(() => isAdmin.value || isSubadmin.value);

/** Guardas de permisos (se usan en los services para bloquear acciones aunque se fuerce el botón). */
export const soloAdmin = () => {
  if (isAdmin.value) return true;
  alert("Acción no permitida: requiere perfil Administrador de esta área.");
  return false;
};
export const soloEditor = () => {
  if (isAdmin.value || isSubadmin.value) return true;
  alert("Acción no permitida: en esta área tu perfil es de solo lectura.");
  return false;
};
export const soloAdminGeneral = () => {
  if (esAdminGeneral.value) return true;
  alert("Acción no permitida: requiere perfil Administrador general.");
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
export const dbBodegaStock = ref([]);     // módulo Bodega: filtros sueltos (bd_filtros_stock)
export const dbKits = ref([]);            // módulo Bodega: kits (bd_filtros_kits) con su composición en .items
export const dbBodegaMov = ref([]);       // módulo Bodega: movimientos (bd_filtros_movimientos)
export const dbOC = ref([]);              // módulo OC: órdenes de compra (bd_oc)
export const dbLocaciones = ref([]);      // módulo ÁREAS: empresas, áreas y locaciones (bd_locaciones)

/** Se incrementa cada vez que cambian los datos (los gráficos lo observan para redibujarse). */
export const datosVersion = ref(0);

/** Empresas conocidas (módulo Áreas + inventario + movimientos), siempre incluye TALLER FRC. */
export const listaEmpresas = computed(() => Array.from(new Set([
  EMPRESA_TALLER,
  ...dbLocaciones.value.filter(n => n.tipo === 'EMPRESA').map(n => n.nombre),
  ...dbEquipos.value.map(e => empresaDe(e)),
  ...dbMovimientos.value.map(m => String(m.empresa_arriendo || '').trim().toUpperCase())
].filter(Boolean))).sort());

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
    const [eqData, movData, intData, calData, itemData, modData, fmtData, filData, preData, stkData, kitData, kitItData, bmovData, ocData, locData] = await Promise.all([
      fetchAllRows(TABLA_INVENTARIO),
      fetchAllRows(TABLA_MOVIMIENTOS),
      fetchAllRows(TABLA_HISTORIAL),
      fetchAllRows(TABLAS.PROGRAMAS),
      fetchAllRows(TABLAS.PROGRAMAS_ITEMS),
      fetchAllRows(TABLAS.MODELOS_FICHA),
      fetchAllRows(TABLAS.FORMATOS),
      fetchAllRows(TABLA_FILTROS),
      fetchAllRows(TABLA_FILTROS_PRECIOS),
      fetchAllRows(TABLAS.BODEGA_STOCK),
      fetchAllRows(TABLAS.BODEGA_KITS),
      fetchAllRows(TABLAS.BODEGA_KITS_ITEMS),
      fetchAllRows(TABLAS.BODEGA_MOV),
      fetchAllRows(TABLA_OC),
      fetchAllRows(TABLA_LOCACIONES)
    ]);

    dbEquipos.value = eqData.map(mapEquipo).sort((a, b) => compararAfi(a.afi, b.afi));
    dbMovimientos.value = movData.map(mapMovimiento);
    // Empresa del último movimiento de cada AFI (se usa si el equipo no tiene empresa guardada)
    const ultimaEmpresa = new Map();
    [...dbMovimientos.value].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
      .forEach(m => { if (m.empresa_arriendo.trim()) ultimaEmpresa.set(String(m.afi).trim().toUpperCase(), m.empresa_arriendo.trim().toUpperCase()); });
    dbEquipos.value.forEach(e => { e.empresaUltimoMov = ultimaEmpresa.get(String(e.afi).trim().toUpperCase()) || ''; });
    dbIntervenciones.value = intData.map(mapIntervencion);
    dbProgramasCalendarios.value = calData;
    dbProgramasItems.value = itemData;
    dbModelosFichas.value = modData;
    dbFormatos.value = fmtData;
    dbFiltros.value = filData.map(mapAplicacion);
    dbFiltrosPrecios.value = preData.map(mapPrecio);
    dbBodegaStock.value = stkData.map(mapStock);
    const itemsKit = kitItData.map(mapKitItem);
    dbKits.value = kitData.map(r => ({ ...mapKit(r), items: itemsKit.filter(i => String(i.kitId) === String(r.id)) }));
    dbBodegaMov.value = bmovData.map(mapMovBodega).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    dbLocaciones.value = locData.map(mapLocacion);
    dbOC.value = ocData.map(mapOC).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

    recalcularHorometros();
  } catch (err) {
    console.error("Error cargando datos:", err);
  } finally {
    cargandoDatos.value = false;
  }
};
