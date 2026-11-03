// =====================================================================
// OT · Componente (lista de Órdenes de Trabajo + editor con el formato del Excel)
// =====================================================================
import template from './ot.template.js';
import { comunes } from '../../core/comunes.js';
import * as S from './ot.service.js';
import { FORMATO_OT } from './ot.formato.js';

const { onMounted } = Vue;

/** Escala del editor en pantalla (la impresión usa el tamaño real). */
const E = 1.8;

// Celdas agrupadas por fila (para dibujar la tabla)
const filasFormato = FORMATO_OT.rows.map((_, i) => FORMATO_OT.celdas.filter(c => c.r === i + 1));
const anchoHoja = FORMATO_OT.cols.reduce((a, b) => a + b, 0);

export default {
  name: 'OtView',
  template,
  setup() {
    onMounted(() => { S.cargarOT(); });
    const guardarYAvisar = async () => {
      const nueva = !S.otActual.value.id;
      if (await S.guardarOT()) alert(nueva ? `OT guardada con el folio N° ${S.otActual.value.folio}.` : 'OT guardada.');
    };
    return { ...comunes(), ...S, F: FORMATO_OT, E, filasFormato, anchoHoja, guardarYAvisar };
  }
};
