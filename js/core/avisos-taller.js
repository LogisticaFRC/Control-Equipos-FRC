// =====================================================================
// CORE · Aviso de INSPECCIONES / HALLAZGOS del taller pendientes de OT (2026-11-16)
// Módulo sin dependencias: lo lee el menú (core/menu.js) y lo actualiza taller.service.js.
// =====================================================================
const { ref } = Vue;
/** Cantidad de hallazgos de mecánicos que esperan OT (todo el taller). */
export const hallazgosSinOT = ref(0);
