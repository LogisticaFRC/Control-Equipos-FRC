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
  OT: 'bd_ot',                                // módulo OT: órdenes de trabajo (formato FRC-RE-OPE-006)
  OC: 'bd_oc',                                // módulo OC: órdenes de compra (N° OC, precio, AFI, documento) ↔ BD_HISTORIAL.numero_oc
  LOCACIONES: 'bd_locaciones',                // módulo ÁREAS: árbol Empresa → Área → Locación (equipos en BD_INVENTARIO.locacion_id)
  TALLER_PROBLEMAS: 'bd_taller_problemas',    // TALLER: "nuevo problema para OT" que envía el mecánico y procesa el Admin
  TALLER: 'bd_taller_reparaciones',          // PROGRAMAS REPARACIÓN → Taller: equipos en naves / sin programa / con faltantes (bd_ot.reparacion_id)
  TRABAJADORES: 'bd_trabajadores',            // SEGURIDAD → Control Entrega EPP: ficha de cada trabajador (tallas, EPP requerido). Base futura de RRHH
  EPP_ENTREGAS: 'bd_epp_entregas',            // SEGURIDAD → Control Entrega EPP: historial de entregas (una fila por elemento)
  VEHICULOS: 'bd_vehiculos',                  // VEHÍCULOS: datos propios de cada patente (N° AFI interno, frecuencia km, aviso)
  VEHICULOS_KM: 'bd_vehiculos_km',            // VEHÍCULOS: lecturas de kilometraje (LECTURA / MANTENCION)
  VEHICULOS_DOCS: 'bd_vehiculos_documentos',  // VEHÍCULOS: Revisión Técnica, Permiso de Circulación, SOAP y secundarios (con vencimiento)
  RECORDATORIOS: 'bd_recordatorios',          // MIS TAREAS: recordatorio PERSONAL de cada usuario (RLS: solo el dueño)
  RECORDATORIOS_ESTADO: 'bd_recordatorios_estado',  // MIS TAREAS: Hecha / Omitida por día de cada tarea
  MOTORES_EXTERNOS: 'bd_motores_externos',    // PROGRAMA REPARACIÓN MOTORES: motores enviados a proveedores externos / taller
  MEC_INTERVENCIONES: 'bd_mec_intervenciones' // MECÁNICOS: intervenciones llenadas en la app móvil (con firmas)
};
