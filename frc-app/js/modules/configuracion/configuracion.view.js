// =====================================================================
// CONFIG & USUARIOS · Componente (usuarios, personalización, importadores, exportar todo)
// =====================================================================
import template from './configuracion.template.js';
import { comunes } from '../../core/comunes.js';
import { config, dbUsuarios } from '../../core/store.js';
import * as S from './configuracion.service.js';
import { importarInventarioFile } from '../inventario/inventario.service.js';
import { importarMovimientosFile } from '../movimientos/movimientos.service.js';
import { importarIntervencionesFile } from '../historial/historial.service.js';

export default {
  name: 'ConfiguracionView',
  template,
  setup() {
    return {
      ...comunes(), ...S, config, dbUsuarios,
      importarInventarioFile, importarMovimientosFile, importarIntervencionesFile
    };
  }
};
