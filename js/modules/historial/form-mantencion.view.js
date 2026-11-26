// =====================================================================
// HISTORIAL · Modal "Registrar / Editar Mantención"
// =====================================================================
import template from './form-mantencion.template.js';
import { comunes } from '../../core/comunes.js';
import {
  showFormMantencionModal, isEditingMantencion, formMant, guardarMantencionForm,
  agregarFilaFiltro, eliminarFilaFiltro, subirArchivoHistorial, leerAlAdjuntar, lecturaForm, CAUSAS_FALLA_HOJA,
  equipoFormMant, filtrosRequeridosFormMant, cargarFiltrosDelModelo, autocompletarFilaFiltro
} from './historial.service.js';
import { listaTiposFiltro, listaProveedoresFiltro, listaMarcasFiltro, fmtPrecio } from '../filtros/filtros.service.js';
import { programasDelAfi, programaEsReparacion } from '../programas/programas.service.js';
import { dbOC, isAdmin, dbProgramasCalendarios } from '../../core/store.js';
import { dbOT, cargarOT, otsAbiertasDeAfi, textoOT, estadoOT, otPorFolio, otAbierta, mantencionesDeOT, ETIQUETA_ESTADO_OT } from '../ot/ot.service.js';
import * as A from './form-ayudas.js';
import { colaIds, colaPos } from './historial.service.js';
import { fmtCLP, ocNuevaFormMant, ocsFormMant, totalOcsFormMant, agregarOCFormMant, quitarOCFormMant, ocsSugeridasFormMant } from '../oc/oc.service.js';

export default {
  name: 'FormMantencion',
  template,
  setup() {
    // OT del sistema: se cargan una vez para sugerir las ABIERTAS del AFI en el N° OT
    const dbOTCargadas = Vue.ref(dbOT.value.length > 0);
    Vue.onMounted(async () => { if (!dbOT.value.length) { try { await cargarOT(); } catch (e) { /* sin OT */ } } dbOTCargadas.value = true; });
    /** Texto si el N° OT escrito es de una OT cerrada / realizada (y el registro no era de esa OT). */
    const otCerradaForm = Vue.computed(() => {
      const f = formMant.value; const ot = otPorFolio(f && f.numeroOT);
      if (!ot || otAbierta(ot) || estadoOT(ot) === 'ANULADA') return '';
      if (f.id && mantencionesDeOT(ot.folio).some(m => m.id === f.id)) return '';
      return `${ot.folio} está ${ETIQUETA_ESTADO_OT[estadoOT(ot)]}`;
    });
    // 2026-11-26: equipo en el TALLER sin programa (no programado) → opción arriba en "Programa"
    // que enlaza el reporte al programa de reparación "… SIN PROGRAMA" (los no programados).
    const T = Vue.shallowRef(null);
    Vue.onMounted(async () => { try { const m = await import('../taller/taller.service.js'); if (!m.dbReparaciones.value.length) await m.cargarReparaciones(); T.value = m; } catch (e) { /* sin taller */ } });
    const progSinPrograma = Vue.computed(() => dbProgramasCalendarios.value.find(p => /SIN\s*PROGRAMA/i.test(p.nombre_programa || p.mes || '') && programaEsReparacion(p.nombre_programa || p.mes)) || null);
    const tallerSinPrograma = (afi) => {
      const m = T.value; if (!afi || !m) return null;
      const rep = m.dbReparaciones.value.find(r => m.mismoAfi ? m.mismoAfi(r.afi, afi) : String(r.afi).toUpperCase() === String(afi).toUpperCase());
      const activa = m.repActivaAfi(afi);
      if (!activa || activa.programa_id != null) return null;
      const p = progSinPrograma.value;
      return { ubicacion: m.ubicacionRep(activa), valor: p ? (p.nombre_programa || p.mes) : '', nombre: p ? (p.nombre_programa || p.mes) : '', rep: rep || activa };
    };
    return {
      tallerSinPrograma,
      otsAbiertasDeAfi, textoOT, estadoOT, dbOTCargadas, otCerradaForm,
      ...comunes(), ...A, colaIds, colaPos,
      guardarYSiguiente: async () => { agregarOCFormMant(); if (await guardarMantencionForm()) A.siguienteCola(); },
      showFormMantencionModal, isEditingMantencion, formMant,
      // si quedó un N° OC escrito sin presionar "Agregar", se agrega antes de guardar
      guardarMantencionForm: () => { agregarOCFormMant(); return guardarMantencionForm(); },
      agregarFilaFiltro, eliminarFilaFiltro, subirArchivoHistorial, leerAlAdjuntar, lecturaForm, CAUSAS_FALLA_HOJA,
      equipoFormMant, filtrosRequeridosFormMant, cargarFiltrosDelModelo, autocompletarFilaFiltro,
      listaTiposFiltro, listaProveedoresFiltro, listaMarcasFiltro, fmtPrecio, programasDelAfi, programaEsReparacion,
      dbOC, fmtCLP, ocNuevaFormMant, ocsFormMant, totalOcsFormMant, agregarOCFormMant, quitarOCFormMant, ocsSugeridasFormMant
    };
  }
};
