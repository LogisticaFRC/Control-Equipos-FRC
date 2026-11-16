// =====================================================================
// CONFIG & USUARIOS · Componente (usuarios, personalización, importadores, exportar todo)
// =====================================================================
import template from './configuracion.template.js';
import { comunes } from '../../core/comunes.js';
import { config, dbUsuarios, esAdminGeneral } from '../../core/store.js';
import * as S from './configuracion.service.js';
import { cargarInfoTotem, guardarClaveTotem, infoClaveTotem, faltaSqlTotem } from '../taller/totem.service.js';
import { importarInventarioFile } from '../inventario/inventario.service.js';
import { importarMovimientosFile } from '../movimientos/movimientos.service.js';
import { importarIntervencionesFile } from '../historial/historial.service.js';

export default {
  name: 'ConfiguracionView',
  template,
  setup() {
    Vue.onMounted(() => { if (esAdminGeneral.value) { S.cargarPerfilesAcceso(); cargarInfoTotem(); } });
    // Tótem del taller: contraseña (2026-11-16)
    const claveTotem = Vue.ref({ nueva: '', repetir: '' });
    const guardarClaveTotemUI = async () => {
      if (await guardarClaveTotem(claveTotem.value.nueva, claveTotem.value.repetir)) claveTotem.value = { nueva: '', repetir: '' };
    };
    return {
      claveTotem, guardarClaveTotemUI, infoClaveTotem, faltaSqlTotem,
      ...comunes(), ...S, config, dbUsuarios, esAdminGeneral,
      importarInventarioFile, importarMovimientosFile, importarIntervencionesFile
    };
  }
};
