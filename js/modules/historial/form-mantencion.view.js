// =====================================================================
// HISTORIAL · Modal "Registrar / Editar Mantención"
// =====================================================================
import template from './form-mantencion.template.js';
import { comunes } from '../../core/comunes.js';
import {
  showFormMantencionModal, isEditingMantencion, formMant, guardarMantencionForm,
  agregarFilaFiltro, eliminarFilaFiltro, subirArchivoHistorial,
  equipoFormMant, filtrosRequeridosFormMant, cargarFiltrosDelModelo, autocompletarFilaFiltro
} from './historial.service.js';
import { listaTiposFiltro, listaProveedoresFiltro, listaMarcasFiltro, fmtPrecio } from '../filtros/filtros.service.js';
import { programasDelAfi } from '../programas/programas.service.js';
import { dbOC } from '../../core/store.js';
import { fmtCLP, ocNuevaFormMant, ocsFormMant, totalOcsFormMant, agregarOCFormMant, quitarOCFormMant, ocsSugeridasFormMant } from '../oc/oc.service.js';

export default {
  name: 'FormMantencion',
  template,
  setup() {
    return {
      ...comunes(), showFormMantencionModal, isEditingMantencion, formMant,
      // si quedó un N° OC escrito sin presionar "Agregar", se agrega antes de guardar
      guardarMantencionForm: () => { agregarOCFormMant(); return guardarMantencionForm(); },
      agregarFilaFiltro, eliminarFilaFiltro, subirArchivoHistorial,
      equipoFormMant, filtrosRequeridosFormMant, cargarFiltrosDelModelo, autocompletarFilaFiltro,
      listaTiposFiltro, listaProveedoresFiltro, listaMarcasFiltro, fmtPrecio, programasDelAfi,
      dbOC, fmtCLP, ocNuevaFormMant, ocsFormMant, totalOcsFormMant, agregarOCFormMant, quitarOCFormMant, ocsSugeridasFormMant
    };
  }
};
