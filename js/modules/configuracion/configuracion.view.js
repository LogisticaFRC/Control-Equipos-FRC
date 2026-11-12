// =====================================================================
// CONFIG & USUARIOS · Componente (usuarios, personalización, importadores, exportar todo)
// =====================================================================
import template from './configuracion.template.js';
import { comunes } from '../../core/comunes.js';
import { config, dbUsuarios, esAdminGeneral } from '../../core/store.js';
import * as S from './configuracion.service.js';
import { importarInventarioFile } from '../inventario/inventario.service.js';
import { importarMovimientosFile } from '../movimientos/movimientos.service.js';
import { importarIntervencionesFile } from '../historial/historial.service.js';

export default {
  name: 'ConfiguracionView',
  template,
  setup() {
    Vue.onMounted(() => { if (esAdminGeneral.value) S.cargarPerfilesAcceso(); });
    return {
      ...comunes(), ...S, config, dbUsuarios, esAdminGeneral,
      importarInventarioFile, importarMovimientosFile, importarIntervencionesFile
    };
  }
};
