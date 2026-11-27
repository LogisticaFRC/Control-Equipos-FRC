// =====================================================================
// INVENTARIO AFI · Componente (tarjetas de equipos + filtros)
// =====================================================================
import template from './inventario.template.js';
import { comunes } from '../../core/comunes.js';
import * as S from './inventario.service.js';
import { abrirRegistroEliminados } from './baja.service.js';
import { HorometroLogModal, verLogGlobal } from './horometro-log.view.js';   // 2026-11-27: historial de horómetros (Admin)

export default {
  name: 'InventarioView',
  components: { HorometroLogModal },
  template,
  setup() {
    return { ...comunes(), ...S, abrirRegistroEliminados, verLogGlobal };
  }
};
