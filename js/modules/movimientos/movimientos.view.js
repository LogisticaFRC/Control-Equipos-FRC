// =====================================================================
// MOVIMIENTOS · Componente (tabla de traslados + filtros)
// =====================================================================
import template from './movimientos.template.js';
import { comunes } from '../../core/comunes.js';
import * as S from './movimientos.service.js';
import { ChecklistLista } from '../mecanicos/chofer-checklist.view.js';   // check list de choferes (2026-11-17)
import { cargarTodosChecklist, checklistDeMovimiento, esMovDeChofer } from '../mecanicos/chofer.service.js';
import { abrirPdfChecklist } from '../mecanicos/chofer.pdf.js';

export default {
  name: 'MovimientosView',
  components: { ChecklistLista },
  template,
  setup() {
    // PDF del check list del chofer: la ventana se abre al tiro (si no, el navegador la bloquea) y se llena al llegar los datos
    const pdfDeMov = async (m) => {
      const w = window.open('', '_blank');
      const r = await checklistDeMovimiento(m);
      if (!r) { if (w) w.close(); return alert('No se encontró el check list del chofer de este movimiento.'); }
      abrirPdfChecklist(r, w);
    };
    return { ...comunes(), ...S, cargarTodosChecklist, esMovDeChofer, pdfDeMov };
  }
};
