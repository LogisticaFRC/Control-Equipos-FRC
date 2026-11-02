// =====================================================================
// PROGRAMAS · Componente (carpetas Reparación/Mantención, tablas por nave, Gantt)
// =====================================================================
import template from './programas.template.js';
import { comunes } from '../../core/comunes.js';
import * as S from './programas.service.js';
import { filtrosRequeridosAfi, kitsEnBodegaAfi, sePuedeArmarAfi, kitConsumidoItem, resumenKitsPrograma, abrirArmarKitParaAfi } from '../bodega/bodega.service.js';

export default {
  name: 'ProgramasView',
  template,
  setup() {
    return { ...comunes(), ...S, filtrosRequeridosAfi, kitsEnBodegaAfi, sePuedeArmarAfi, kitConsumidoItem, resumenKitsPrograma, abrirArmarKitParaAfi };
  }
};
