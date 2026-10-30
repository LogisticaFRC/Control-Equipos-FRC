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

export default {
  name: 'FormMantencion',
  template,
  setup() {
    return {
      ...comunes(), showFormMantencionModal, isEditingMantencion, formMant, guardarMantencionForm,
      agregarFilaFiltro, eliminarFilaFiltro, subirArchivoHistorial,
      equipoFormMant, filtrosRequeridosFormMant, cargarFiltrosDelModelo, autocompletarFilaFiltro,
      listaTiposFiltro, listaProveedoresFiltro, listaMarcasFiltro, fmtPrecio
    };
  }
};
