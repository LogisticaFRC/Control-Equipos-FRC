// =====================================================================
// HISTORIAL · Componente (tabla completa de mantenciones + filtros)
// =====================================================================
import template from './historial.template.js';
import { comunes } from '../../core/comunes.js';
import * as S from './historial.service.js';
import { irAOT } from '../ot/ot.service.js';
import CargaDocumentos from './carga-documentos.view.js';
import { abrirCargaDocs } from './carga-documentos.service.js';
import { abrirCola, pendientesCompletar } from './form-ayudas.js';
import { irAOC, detalleOCsMantencion, totalOCMantencion, fmtCLP } from '../oc/oc.service.js';
import { exportarHistorialGeneralExcel, exportandoHistorial } from './historial.export.js';
import { formatDateForDisplay } from '../../core/utils.js';

export default {
  name: 'HistorialView',
  template,
  components: { CargaDocumentos },   // carga masiva de PDF → enlace a cada registro
  setup() {
    // Texto de los filtros aplicados (va en el subtítulo del Excel)
    const textoFiltros = () => {
      const f = S.filterInt.value, t = [];
      if (f.afi !== 'ALL') t.push('AFI ' + f.afi);
      if (f.causa !== 'ALL') t.push('Causa: ' + f.causa);
      if (f.tipoMant !== 'ALL') t.push('Tipo: ' + f.tipoMant);
      if (f.programa !== 'ALL') t.push('Programa: ' + f.programa);
      if (f.dateStart || f.dateEnd) t.push(`Fechas: ${f.dateStart ? formatDateForDisplay(f.dateStart) : '…'} a ${f.dateEnd ? formatDateForDisplay(f.dateEnd) : '…'}`);
      if (f.searchQuery) t.push(`Búsqueda: "${f.searchQuery}"`);
      return t.join(' · ');
    };
    const exportarGeneral = () => exportarHistorialGeneralExcel(S.filteredIntervenciones.value, textoFiltros());
    return { ...comunes(), ...S, exportarGeneral, exportandoHistorial, irAOT, irAOC, detalleOCsMantencion, totalOCMantencion, fmtCLP, abrirCargaDocs, abrirCola, pendientesCompletar };
  }
};
