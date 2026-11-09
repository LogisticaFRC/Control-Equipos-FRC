// =====================================================================
// CORE · Menú lateral: áreas y módulos
// ---------------------------------------------------------------------
// Para agregar un módulo nuevo: sumarlo en `modulos` del área que corresponda
// y registrar su vista en main.js. Las pestañas válidas de la URL (#clave)
// salen automáticamente de aquí.
//   placeholder: true → muestra la pantalla "En construcción" del área.
// =====================================================================
import { dbEquipos, dbMovimientos, dbIntervenciones, dbOC, dbLocaciones } from './store.js';
import { esVehiculo } from '../modules/inventario/inventario.mapper.js';

const { ref } = Vue;

/** Menú lateral abierto/cerrado (compartido: lo abre el header y también la pantalla de Inicio). */
export const menuAbierto = ref(false);

/** Pantalla que se muestra al iniciar sesión. */
export const TAB_INICIO = 'inicio';

export const AREAS = [
  // directo: true → se muestra como un solo botón (sin grupo desplegable)
  {
    key: 'inicio', label: 'Inicio', icon: 'fa-house', color: 'text-white', directo: true,
    modulos: [{ key: 'inicio', label: 'Bienvenida', icon: 'fa-house' }]
  },
  {
    key: 'operaciones', label: 'Operaciones', icon: 'fa-gears', color: 'text-amber-400',
    // grupo → subtítulo dentro del área (ver GRUPOS)
    modulos: [
      { key: 'dashboard', grupo: 'gestion', label: 'Dashboard', icon: 'fa-chart-line' },
      { key: 'progMantencion', grupo: 'gestion', label: 'Programas Mantención', icon: 'fa-oil-can' },
      { key: 'progReparacion', grupo: 'gestion', label: 'Programas Reparación', icon: 'fa-warehouse' },   // Taller (naves) + programas/Gantt
      { key: 'minutas', grupo: 'gestion', label: 'Minutas', icon: 'fa-clipboard-list' },

      { key: 'inventario', grupo: 'equipos', label: 'Inventario AFI', icon: 'fa-boxes-stacked', count: () => dbEquipos.value.filter(e => !esVehiculo(e)).length },
      { key: 'vehiculos', grupo: 'equipos', label: 'Vehículos', icon: 'fa-car-side', count: () => dbEquipos.value.filter(esVehiculo).length },   // AFI = patente XXXX-XX
      { key: 'areas', grupo: 'equipos', label: 'Áreas y Locaciones', icon: 'fa-sitemap', count: () => dbLocaciones.value.filter(n => n.tipo === 'LOCACION').length },
      { key: 'movimientos', grupo: 'equipos', label: 'Movimientos', icon: 'fa-truck-ramp-box', count: () => dbMovimientos.value.length },

      { key: 'ot', grupo: 'mantenimiento', label: 'Órdenes de Trabajo', icon: 'fa-file-signature' },
      { key: 'hojaVida', grupo: 'mantenimiento', label: 'Historial', icon: 'fa-file-medical', count: () => dbIntervenciones.value.length },
      { key: 'fallas', grupo: 'mantenimiento', label: 'Análisis de Fallas', icon: 'fa-magnifying-glass-chart' },   // qué falla más (core/analisis-fallas.js)
      { key: 'costosMant', grupo: 'mantenimiento', label: 'Costos de Mantención', icon: 'fa-sack-dollar' },   // valor 250/500/1000 por modelo + proyección (modules/costos)
      { key: 'aceites', grupo: 'mantenimiento', label: 'Control Aceites', icon: 'fa-oil-can' },

      { key: 'oc', grupo: 'abastecimiento', label: 'OC', icon: 'fa-file-invoice-dollar', count: () => dbOC.value.length },
      { key: 'filtros', grupo: 'abastecimiento', label: 'Filtros', icon: 'fa-filter' },
      { key: 'bodega', grupo: 'abastecimiento', label: 'Bodega Filtros', icon: 'fa-warehouse' }
    ]
  },
  {
    key: 'ventas', label: 'Ventas', icon: 'fa-hand-holding-dollar', color: 'text-emerald-400',
    modulos: [{ key: 'ventas', label: 'Inicio Ventas', icon: 'fa-house', placeholder: true }]
  },
  {
    key: 'seguridad', label: 'Seguridad', icon: 'fa-helmet-safety', color: 'text-orange-400',
    modulos: [{ key: 'epp', label: 'Control Entrega EPP', icon: 'fa-vest' }]
  },
  {
    key: 'rrhh', label: 'RRHH', icon: 'fa-users', color: 'text-sky-400',
    modulos: [{ key: 'rrhh', label: 'Inicio RRHH', icon: 'fa-house', placeholder: true }]
  },
  {
    key: 'finanzas', label: 'Finanzas', icon: 'fa-coins', color: 'text-yellow-300',
    modulos: [{ key: 'finanzas', label: 'Inicio Finanzas', icon: 'fa-house', placeholder: true }]
  },
  {
    key: 'administracion', label: 'Administración', icon: 'fa-briefcase', color: 'text-violet-400',
    modulos: [{ key: 'administracion', label: 'Inicio Administración', icon: 'fa-house', placeholder: true }]
  },
  {
    key: 'general', label: 'General', icon: 'fa-layer-group', color: 'text-slate-300',
    modulos: [
      { key: 'formatos', label: 'Formatos', icon: 'fa-folder-tree' },
      { key: 'configuracion', label: 'Config & Usuarios', icon: 'fa-gear' }
    ]
  }
];

/** Subtítulos dentro de un área (en el orden en que se muestran). */
export const GRUPOS = {
  gestion: { label: 'Gestión operacional', icon: 'fa-table-cells-large' },
  equipos: { label: 'Equipos', icon: 'fa-truck' },
  mantenimiento: { label: 'Mantenimiento', icon: 'fa-screwdriver-wrench' },
  abastecimiento: { label: 'Abastecimiento y bodega', icon: 'fa-box' }
};

/** Módulos de un área agrupados por subtítulo: [{ key, label, icon, modulos }] (sin subtítulo → key null). */
export const gruposDeArea = (area) => {
  const out = [];
  area.modulos.forEach(m => {
    const k = m.grupo || null;
    let g = out.find(x => x.key === k);
    if (!g) { g = { key: k, ...(GRUPOS[k] || {}), modulos: [] }; out.push(g); }
    g.modulos.push(m);
  });
  return out;
};

/** Áreas a las que se les asignan permisos (todas menos Inicio). */
export const AREAS_PERMISOS = AREAS.filter(a => !a.directo);

/** Todas las claves de pantalla válidas (para la URL #clave). */
export const TABS_VALIDAS = AREAS.flatMap(a => a.modulos.map(m => m.key));

/** Área a la que pertenece una pantalla. */
export const areaDeTab = (tab) => AREAS.find(a => a.modulos.some(m => m.key === tab)) || AREAS[0];

/** Módulo (objeto del menú) de una pantalla. */
export const moduloDeTab = (tab) => AREAS.flatMap(a => a.modulos).find(m => m.key === tab) || AREAS[0].modulos[0];
