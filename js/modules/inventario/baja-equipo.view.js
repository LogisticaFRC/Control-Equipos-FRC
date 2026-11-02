// =====================================================================
// INVENTARIO AFI · Modales de eliminación de equipos (motivo + registro)
// =====================================================================
import template from './baja-equipo.template.js';
import { isAdmin } from '../../core/store.js';
import { exportarCSV } from '../../core/utils.js';
import * as B from './baja.service.js';

export default {
  name: 'BajaEquipo',
  template,
  setup() {
    return { ...B, isAdmin, exportarCSV };
  }
};
