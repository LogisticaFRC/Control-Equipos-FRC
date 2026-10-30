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
  PROGRAMAS_ITEMS: 'bd_programas_items',      // antes 'BD_PROGRAMAS_ITEMS' (no existe)
  MODELOS_FICHA: 'bd_modelos_ficha',
  FORMATOS: 'bd_formatos',
  FILTROS: 'bd_filtros',                      // módulo FILTROS: qué filtros usa cada marca/modelo (referencia cruzada)
  FILTROS_PRECIOS: 'bd_filtros_precios'       // módulo FILTROS: lista de precios por proveedor (comparativo)
};
