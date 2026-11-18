// =====================================================================
// APP TÉCNICOS · ACTIVIDADES DE UN EQUIPO EN NAVE (modo TALLER) · 2026-11-16
// Lo mismo que en terreno (intervención mecánica / eléctrica, para rellenar y firmar),
// 2026-11-18: menú = Levantamientos (carpetas con fallas y botón Reparar) · Levantamiento de fallas ·
// Estandarización · Intervención eléctrica. ART y bloqueo van como FOTO dentro de cada reparación.
// =====================================================================
import * as M from './mecanicos.service.js';
import LevantamientosEquipo from './levantamientos.view.js';   // carpetas de levantamientos de fallas (2026-11-18)
import EstandarBoton from '../estandarizacion/estandar-form.view.js';   // Inspección general estandarización (2026-11-18)

export default {
  name: 'ActividadesEquipo',
  props: { eq: { type: Object, required: true } },
  components: { EstandarBoton, LevantamientosEquipo },
  template: /* html */ `
<div class="grid grid-cols-1 gap-3">
  <levantamientos-equipo :eq="eq" @reparar="x => M.abrirIntervencion(x.tipo, eq, x.falla)"></levantamientos-equipo>
  <button @click="M.abrirLevantamiento(eq)" class="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 text-left active:scale-[.99]" data-menu="levantamiento"><span class="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl"><i class="fa-solid fa-list-ol"></i></span><span class="flex-1"><b class="block text-lg">Levantamiento de fallas</b><span class="text-xs text-slate-500">Observación del equipo y fallas enumeradas</span></span><i class="fa-solid fa-chevron-right text-slate-300"></i></button>
  <estandar-boton :eq="eq"></estandar-boton>
  <button @click="M.abrirIntervencion('ELECTRICA', eq)" class="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 text-left active:scale-[.99]"><span class="w-14 h-14 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center text-2xl"><i class="fa-solid fa-bolt"></i></span><span class="flex-1"><b class="block text-lg">Intervención eléctrica</b><span class="text-xs text-slate-500">IE-FRC</span></span><i class="fa-solid fa-chevron-right text-slate-300"></i></button>
  <div class="bg-white/60 rounded-2xl p-4 flex items-center gap-4 opacity-60"><span class="w-14 h-14 rounded-2xl bg-slate-200 text-slate-500 flex items-center justify-center text-2xl"><i class="fa-solid fa-oil-can"></i></span><span class="flex-1"><b class="block text-lg">Agregar mantención</b><span class="text-xs">Formato pendiente de cargar</span></span></div>
  <p class="text-[11px] text-slate-500 px-1"><i class="fa-solid fa-circle-info mr-1"></i>ART y bloqueo de equipo: se suben como foto dentro de cada reparación (paso Seguridad).</p>
</div>`,
  setup(props) {
    return { M };
  }
};
