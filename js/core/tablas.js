// =====================================================================
// CORE · Nombres de tablas en Supabase (según esquema BD entregado)
// ⚠️ PostgREST distingue mayúsculas/minúsculas: deben coincidir EXACTO con la BD.
// =====================================================================
export const TABLAS = {
  INVENTARIO: 'BD_INVENTARIO',
  MOVIMIENTOS: 'BD_MOVIMIENTOS',
  HISTORIAL: 'BD_HISTORIAL',
  USUARIOS: 'usuarios',
  PROGRAMAS: 'bd_programas_calendarios',      // antes 'BD_PROGRAMAS_CALENDARIOS' (no existe)
  PROGRAMAS_ITEMS: 'bd_programas_items',
  EQUIPOS_ELIMINADOS: 'bd_equipos_eliminados',  // registro de equipos eliminados (motivo, quién, cuándo)
  PROGRAMAS_CARPETAS: 'bd_programas_carpetas',   // subcarpetas de programas (ej. NOVIEMBRE) dentro de Reparación / Mantención      // antes 'BD_PROGRAMAS_ITEMS' (no existe)
  MODELOS_FICHA: 'bd_modelos_ficha',
  FORMATOS: 'bd_formatos',
  FILTROS: 'bd_filtros',                      // módulo FILTROS: qué filtros usa cada marca/modelo (referencia cruzada)
  FILTROS_PRECIOS: 'bd_filtros_precios',      // módulo FILTROS: lista de precios por proveedor (comparativo)
  BODEGA_STOCK: 'bd_filtros_stock',           // módulo BODEGA: inventario general de filtros sueltos
  BODEGA_KITS: 'bd_filtros_kits',             // módulo BODEGA: kits armados (por marca/modelo de equipo)
  BODEGA_KITS_ITEMS: 'bd_filtros_kits_items', // módulo BODEGA: composición de cada kit
  BODEGA_MOV: 'bd_filtros_movimientos',       // módulo BODEGA: registro de entradas / salidas
  MINUTAS: 'bd_minutas',                      // módulo MINUTAS: cabecera de cada minuta semanal
  MINUTAS_ITEMS: 'bd_minutas_items',          // módulo MINUTAS: tareas / compromisos de cada minuta
  OT: 'bd_ot'                                 // módulo OT: órdenes de trabajo (formato FRC-RE-OPE-006)
};
