// =====================================================================
// APP TÉCNICOS · ACTIVIDADES DE UN EQUIPO EN NAVE (modo TALLER) · 2026-11-16
// Lo mismo que en terreno (intervención mecánica / eléctrica, para rellenar y firmar),
// más los registros que se hacen durante la reparación: Bloqueo de equipo, ART y Mantención.
//   · Bloqueo: abre la intervención mecánica con el Registro de bloqueo (FRC-RE-OP-015) activado.
//   · ART y Mantención: el formato aún no está cargado → quedan como "pendiente" hasta subirlo.
// =====================================================================
import * as M from './mecanicos.service.js';
import { FallasAbiertas } from './fallas-equipo.js';   // fallas abiertas del equipo (2026-11-18)
import EstandarBoton from '../estandarizacion/estandar-form.view.js';   // Inspección general estandarización (2026-11-18)

export default {
  name: 'ActividadesEquipo',
  props: { eq: { type: Object, required: true } },
  components: { EstandarBoton, FallasAbiertas },
  template: /* html */ `
<div class="grid grid-cols-1 gap-3">
  <fallas-abiertas :eq="eq" @reparar="x => M.abrirIntervencion(x.tipo, eq, x.falla)"></fallas-abiertas>
  <estandar-boton :eq="eq"></estandar-boton>
  <button @click="M.abrirIntervencion('MECANICA', eq)" class="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 text-left active:scale-[.99]"><span class="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl"><i class="fa-solid fa-wrench"></i></span><span class="flex-1"><b class="block text-lg">Intervención mecánica</b><span class="text-xs text-slate-500">FRC-RE-OPE-017</span></span><i class="fa-solid fa-chevron-right text-slate-300"></i></button>
  <button @click="M.abrirIntervencion('ELECTRICA', eq)" class="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 text-left active:scale-[.99]"><span class="w-14 h-14 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center text-2xl"><i class="fa-solid fa-bolt"></i></span><span class="flex-1"><b class="block text-lg">Intervención eléctrica</b><span class="text-xs text-slate-500">IE-FRC</span></span><i class="fa-solid fa-chevron-right text-slate-300"></i></button>
  <button @click="bloqueo" class="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 text-left active:scale-[.99]"><span class="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center text-2xl"><i class="fa-solid fa-lock"></i></span><span class="flex-1"><b class="block text-lg">Agregar bloqueo de equipo</b><span class="text-xs text-slate-500">Registro de bloqueo FRC-RE-OP-015</span></span><i class="fa-solid fa-chevron-right text-slate-300"></i></button>
  <div class="bg-white/60 rounded-2xl p-4 flex items-center gap-4 opacity-60"><span class="w-14 h-14 rounded-2xl bg-slate-200 text-slate-500 flex items-center justify-center text-2xl"><i class="fa-solid fa-helmet-safety"></i></span><span class="flex-1"><b class="block text-lg">Agregar ART</b><span class="text-xs">Formato pendiente de cargar</span></span></div>
  <div class="bg-white/60 rounded-2xl p-4 flex items-center gap-4 opacity-60"><span class="w-14 h-14 rounded-2xl bg-slate-200 text-slate-500 flex items-center justify-center text-2xl"><i class="fa-solid fa-oil-can"></i></span><span class="flex-1"><b class="block text-lg">Agregar mantención</b><span class="text-xs">Formato pendiente de cargar</span></span></div>
</div>`,
  setup(props) {
    const bloqueo = () => {
      M.abrirIntervencion('MECANICA', props.eq);
      const f = M.formInt.value;
      if (!f) return;
      f.bloqueo = true;
      M.activarBloqueo(f);
      M.pasoInt.value = 3;   // paso "Seguridad": ahí está el registro de bloqueo
    };
    return { M, bloqueo };
  }
};
