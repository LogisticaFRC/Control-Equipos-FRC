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

// ---------- Acceso por MÓDULO (perfiles) ----------
// Opcional: permisos._modulos = { inventario: 'lectura', bodega: 'admin', hojaVida: 'oculto', ... }
//   oculto   → no lo ve en el menú ni puede abrirlo
//   lectura  → solo ver
//   subadmin → ver, agregar / subir y modificar (sin eliminar)
//   admin    → todo, incluido eliminar
// Si el usuario tiene _modulos, un módulo que no aparece en la lista queda OCULTO.
// Sin _modulos → como antes: ve todo y manda el nivel del área.
// Inicio y Mis Tareas los ven SIEMPRE todos los usuarios (Mis Tareas es personal).
export const MODULOS_SIEMPRE = ['inicio', 'misTareas'];
export const NIVELES_MODULO = [
  { key: 'oculto', label: 'No ve', corto: 'No ve' },
  { key: 'lectura', label: 'Solo ver', corto: 'Ver' },
  { key: 'subadmin', label: 'Ver, subir y modificar', corto: 'Modificar' },
  { key: 'admin', label: 'Todo (incluye eliminar)', corto: 'Todo' }
];
/** Mapa módulo → nivel del usuario, o null si usa solo niveles por área. */
export const modulosDe = (u) => {
  const p = permisosDe(u);
  const m = p && p._modulos;
  return m && typeof m === 'object' && !Array.isArray(m) ? m : null;
};
/** Nivel del usuario en un módulo (pantalla): 'oculto' | 'lectura' | 'subadmin' | 'admin'. */
export const nivelEnModulo = (tab, u = usuarioActivo.value) => {
  if (!u) return 'lectura';
  if (u.rol === 'admin') return 'admin';
  if (MODULOS_SIEMPRE.includes(tab)) return 'admin';
  const m = modulosDe(u);
  if (m) return m[tab] || 'oculto';
  return nivelEnArea(areaDeTab(tab).key, u);
};
export const puedeVerModulo = (tab, u = usuarioActivo.value) => nivelEnModulo(tab, u) !== 'oculto';

/** Admin general (dueño del sistema). */
export const esAdminGeneral = computed(() => Boolean(usuarioActivo.value && usuarioActivo.value.rol === 'admin'));
/** Área de la pantalla actual y nivel del usuario en ella. */
export const areaActualKey = computed(() => areaDeTab(currentTab.value).key);
/** Nivel en la pantalla actual: el del módulo si el usuario tiene perfil por módulo; si no, el del área. */
export const nivelActual = computed(() => { const n = nivelEnModulo(currentTab.value); return n === 'oculto' ? 'lectura' : n; });

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
// ---------------------------------------------------------------------
// Carga de datos. Antes, CADA guardado volvía a descargar las 15 tablas (lento).
// Ahora cada parte se puede recargar sola: cargarDatosDesdeSupabase(['historial']) solo baja el Historial.
// Sin parámetro = todo (inicio de la app y casos generales).
// ---------------------------------------------------------------------
const empresaPorUltimoMov = () => {
  const ultimaEmpresa = new Map();
  [...dbMovimientos.value].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
    .forEach(m => { if (m.empresa_arriendo.trim()) ultimaEmpresa.set(String(m.afi).trim().toUpperCase(), m.empresa_arriendo.trim().toUpperCase()); });
  dbEquipos.value.forEach(e => { e.empresaUltimoMov = ultimaEmpresa.get(String(e.afi).trim().toUpperCase()) || ''; });
};
const PARTES = {
  inventario: { tablas: [TABLA_INVENTARIO], set: ([eq]) => { dbEquipos.value = eq.map(mapEquipo).sort((a, b) => compararAfi(a.afi, b.afi)); } },
  movimientos: { tablas: [TABLA_MOVIMIENTOS], set: ([mov]) => { dbMovimientos.value = mov.map(mapMovimiento); } },
  historial: { tablas: [TABLA_HISTORIAL], set: ([h]) => { dbIntervenciones.value = h.map(mapIntervencion); } },
  programas: { tablas: [TABLAS.PROGRAMAS, TABLAS.PROGRAMAS_ITEMS], set: ([cal, it]) => { dbProgramasCalendarios.value = cal; dbProgramasItems.value = it; } },
  modelos: { tablas: [TABLAS.MODELOS_FICHA], set: ([m]) => { dbModelosFichas.value = m; } },
  formatos: { tablas: [TABLAS.FORMATOS], set: ([f]) => { dbFormatos.value = f; } },
  filtros: { tablas: [TABLA_FILTROS, TABLA_FILTROS_PRECIOS], set: ([f, p]) => { dbFiltros.value = f.map(mapAplicacion); dbFiltrosPrecios.value = p.map(mapPrecio); } },
  bodega: { tablas: [TABLAS.BODEGA_STOCK, TABLAS.BODEGA_KITS, TABLAS.BODEGA_KITS_ITEMS, TABLAS.BODEGA_MOV], set: ([stk, kit, kitIt, bmov]) => {
    dbBodegaStock.value = stk.map(mapStock);
    const itemsKit = kitIt.map(mapKitItem);
    dbKits.value = kit.map(r => ({ ...mapKit(r), items: itemsKit.filter(i => String(i.kitId) === String(r.id)) }));
    dbBodegaMov.value = bmov.map(mapMovBodega).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  } },
  oc: { tablas: [TABLA_OC], set: ([oc]) => { dbOC.value = oc.map(mapOC).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))); } },
  locaciones: { tablas: [TABLA_LOCACIONES], set: ([l]) => { dbLocaciones.value = l.map(mapLocacion); } }
};
export const cargarDatosDesdeSupabase = async (partes = null) => {
  const claves = (Array.isArray(partes) && partes.length ? partes : Object.keys(PARTES)).filter(k => PARTES[k]);
  cargandoDatos.value = true;
  try {
    const datos = await Promise.all(claves.map(k => Promise.all(PARTES[k].tablas.map(fetchAllRows))));
    claves.forEach((k, i) => PARTES[k].set(datos[i]));
    if (claves.includes('inventario') || claves.includes('movimientos')) empresaPorUltimoMov();
    // Los horómetros dependen del inventario y del historial
    if (claves.includes('inventario') || claves.includes('historial')) recalcularHorometros();
  } catch (err) {
    console.error("Error cargando datos:", err);
  } finally {
    cargandoDatos.value = false;
  }
};
