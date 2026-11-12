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
import { dbOC, isAdmin } from '../../core/store.js';
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
    return {
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
