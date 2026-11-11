// =====================================================================
// MIS TAREAS · Componentes globales
//   <tarea-item>              fila de una tarea (check, hora, categoría, acciones)
//   <recordatorios-campana>   campana del encabezado con contador y lista rápida
//   <recordatorios-avisos>    avisos en pantalla, ventana resumen al iniciar sesión
//                             y ventana Nueva / Editar tarea
// =====================================================================
import * as S from './recordatorios.service.js';
import { usuarioActivo } from '../../core/store.js';
import { hoyISO, sumarDiasISO } from '../../core/utils.js';

const { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } = Vue;

// ---------------------------------------------------------------------
// <tarea-item :o="ocurrencia" [compacto] [mostrar-fecha]>
// ---------------------------------------------------------------------
export const TareaItem = {
  name: 'TareaItem',
  props: { o: { type: Object, required: true }, compacto: Boolean, mostrarFecha: Boolean, vencida: Boolean },
  template: /* html */ `
    <div :class="['group relative flex items-start gap-3 bg-white border border-slate-200 border-l-4 rounded-xl transition hover:shadow-md',
                  compacto ? 'px-2.5 py-2' : 'px-3 py-2.5', prio.borde, o.hecha ? 'opacity-60' : '', vencida && !o.hecha ? 'bg-rose-50/60' : '']">
      <button @click.stop="S.alternarHecha(o)" :title="o.hecha ? 'Marcar como pendiente' : 'Marcar como hecha'"
        :class="['mt-0.5 w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center transition',
                 o.hecha ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 text-transparent hover:text-emerald-500']">
        <i class="fa-solid fa-check text-[11px]"></i>
      </button>
      <div class="flex-1 min-w-0 cursor-pointer" @click="S.abrirEditarTarea(o.t)">
        <div :class="['font-semibold leading-snug break-words', compacto ? 'text-[13px]' : 'text-sm', o.hecha ? 'line-through text-slate-500' : 'text-slate-800']">
          <span v-if="o.t.prioridad === 'ALTA' && !o.hecha" class="text-rose-500 mr-1" title="Prioridad alta"><i class="fa-solid fa-circle-exclamation"></i></span>{{ o.t.titulo }}
        </div>
        <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
          <span v-if="mostrarFecha || vencida" :class="['font-bold', vencida ? 'text-rose-600' : 'text-slate-600']"><i class="fa-regular fa-calendar mr-0.5"></i>{{ S.fechaRelativa(o.fecha) }} · {{ S.fechaCorta(o.fecha) }}</span>
          <span v-if="o.t.hora" class="font-bold text-slate-700"><i class="fa-regular fa-clock mr-0.5"></i>{{ o.t.hora }}</span>
          <span v-else class="text-slate-400"><i class="fa-regular fa-sun mr-0.5"></i>Todo el día</span>
          <span :class="['px-1.5 py-0.5 rounded font-bold text-[10px] uppercase tracking-wide', cat.chip]">{{ o.t.categoria }}</span>
          <span v-if="S.esRepetitiva(o.t)" class="text-indigo-600" :title="S.textoRepeticion(o.t)"><i class="fa-solid fa-rotate mr-0.5"></i>{{ compacto ? '' : S.textoRepeticion(o.t) }}</span>
          <span v-if="o.t.aviso_min !== null && o.t.hora" class="text-amber-600" :title="'Aviso ' + textoAviso"><i class="fa-solid fa-bell"></i></span>
          <span v-if="rachaN >= 2" class="text-orange-600 font-bold" title="Días seguidos cumplida"><i class="fa-solid fa-fire mr-0.5"></i>{{ rachaN }}</span>
          <span v-if="o.t.checklist.length" :class="['font-bold', checkOk === o.t.checklist.length ? 'text-emerald-600' : 'text-slate-600']"><i class="fa-solid fa-list-check mr-0.5"></i>{{ checkOk }}/{{ o.t.checklist.length }}</span>
        </div>
        <p v-if="o.t.detalle && !compacto" class="mt-1 text-xs text-slate-500 whitespace-pre-line line-clamp-2">{{ o.t.detalle }}</p>
        <div v-if="o.t.checklist.length && !compacto" class="mt-1.5 space-y-0.5" @click.stop>
          <label v-for="(c, i) in o.t.checklist" :key="i" class="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input type="checkbox" :checked="c.ok" @change="S.alternarChecklist(o.t, i)" class="accent-emerald-600">
            <span :class="c.ok ? 'line-through text-slate-400' : 'text-slate-700'">{{ c.t }}</span>
          </label>
        </div>
      </div>
      <!-- Acciones -->
      <div class="relative shrink-0" @click.stop>
        <button @click="menu = !menu" class="w-7 h-7 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Opciones"><i class="fa-solid fa-ellipsis-vertical"></i></button>
        <div v-if="menu" class="fixed inset-0 z-[55]" @click="menu = false"></div>
        <div v-if="menu" class="absolute right-0 top-8 z-[56] w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1 text-sm text-slate-700">
          <button @click="accion(() => S.abrirEditarTarea(o.t))" class="w-full text-left px-3 py-2 hover:bg-slate-50"><i class="fa-solid fa-pen w-5 text-slate-400"></i>Editar</button>
          <button v-if="!o.hecha" @click="accion(() => S.marcar(o.t, o.fecha, 'HECHA'))" class="w-full text-left px-3 py-2 hover:bg-slate-50"><i class="fa-solid fa-check w-5 text-emerald-500"></i>Marcar hecha</button>
          <template v-if="!o.hecha && o.fecha === hoy">
            <div class="px-3 pt-2 pb-1 text-[10px] font-bold uppercase text-slate-400">Recordarme en</div>
            <div class="flex gap-1 px-3 pb-2">
              <button v-for="m in [10, 30, 60, 120]" :key="m" @click="accion(() => { S.posponer(o, m); })" class="flex-1 text-[11px] font-bold rounded-md bg-slate-100 hover:bg-amber-100 py-1">{{ m < 60 ? m + 'm' : (m / 60) + 'h' }}</button>
            </div>
          </template>
          <button v-if="!o.hecha && !S.esRepetitiva(o.t)" @click="accion(() => S.moverTarea(o.t, manana))" class="w-full text-left px-3 py-2 hover:bg-slate-50"><i class="fa-solid fa-forward w-5 text-sky-500"></i>Pasar a mañana</button>
          <button v-if="!o.hecha && !S.esRepetitiva(o.t)" @click="accion(() => S.moverTarea(o.t, lunesProx))" class="w-full text-left px-3 py-2 hover:bg-slate-50"><i class="fa-solid fa-forward-fast w-5 text-sky-500"></i>Pasar al próximo lunes</button>
          <button v-if="S.esRepetitiva(o.t) && !o.hecha" @click="accion(() => S.marcar(o.t, o.fecha, 'OMITIDA'))" class="w-full text-left px-3 py-2 hover:bg-slate-50"><i class="fa-solid fa-ban w-5 text-slate-400"></i>Omitir solo este día</button>
          <button v-if="o.estado" @click="accion(() => S.marcar(o.t, o.fecha, null))" class="w-full text-left px-3 py-2 hover:bg-slate-50"><i class="fa-solid fa-rotate-left w-5 text-slate-400"></i>Dejar pendiente</button>
          <button @click="accion(() => S.eliminarTarea(o.t))" class="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-600 border-t border-slate-100"><i class="fa-solid fa-trash w-5"></i>{{ S.esRepetitiva(o.t) ? 'Eliminar toda la serie' : 'Eliminar' }}</button>
        </div>
      </div>
    </div>
  `,
  setup(props) {
    const menu = ref(false);
    const hoy = computed(() => S.hoyRef.value);
    const manana = computed(() => sumarDiasISO(S.hoyRef.value, 1));
    const lunesProx = computed(() => sumarDiasISO(S.lunesDe(S.hoyRef.value), 7));
    const prio = computed(() => S.estiloPrioridad(props.o.t.prioridad));
    const cat = computed(() => S.estiloCategoria(props.o.t.categoria));
    const checkOk = computed(() => props.o.t.checklist.filter(c => c.ok).length);
    const rachaN = computed(() => (S.esRutinaDiaria(props.o.t) ? S.racha(props.o.t) : 0));
    const textoAviso = computed(() => (S.AVISOS_MIN.find(a => a.v === props.o.t.aviso_min) || {}).l || '');
    const accion = (fn) => { menu.value = false; fn(); };
    return { S, menu, hoy, manana, lunesProx, prio, cat, checkOk, rachaN, textoAviso, accion };
  }
};

// ---------------------------------------------------------------------
// <recordatorios-campana> (encabezado)
// ---------------------------------------------------------------------
export const RecordatoriosCampana = {
  name: 'RecordatoriosCampana',
  template: /* html */ `
    <div class="relative">
      <button @click="abierto = !abierto" title="Mis tareas y recordatorios" aria-label="Mis tareas"
        :class="['relative bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-lg text-xs transition border border-white/10', S.vencidas.value.length ? 'ring-2 ring-rose-400/70' : '']">
        <i :class="['fa-solid fa-bell', S.contadorCampana.value ? 'frc-campana' : '']"></i>
        <span v-if="S.contadorCampana.value" :class="['absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center shadow', S.vencidas.value.length ? 'bg-rose-500 text-white' : 'bg-amber-400 text-slate-950']">{{ S.contadorCampana.value > 99 ? '99+' : S.contadorCampana.value }}</span>
      </button>
      <div v-if="abierto" class="fixed inset-0 z-[45]" @click="abierto = false"></div>
      <div v-if="abierto" class="absolute right-0 top-11 z-[46] w-[min(380px,92vw)] bg-slate-50 text-slate-800 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <div>
            <div class="font-extrabold text-sm"><i class="fa-solid fa-bell text-amber-500 mr-1.5"></i>Mis tareas</div>
            <div class="text-[11px] text-slate-500">{{ S.fechaLarga(S.hoyRef.value) }} · {{ S.hechasHoy.value.length }}/{{ S.ocurrenciasHoy.value.length }} hechas</div>
          </div>
          <button @click="nueva" class="bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg"><i class="fa-solid fa-plus mr-1"></i>Nueva</button>
        </div>
        <div v-if="S.faltaSQLTareas.value" class="p-4 text-xs text-amber-800 bg-amber-50">Falta ejecutar <b>sql/recordatorios.sql</b> en Supabase.</div>
        <div v-else class="max-h-[60vh] overflow-y-auto p-3 space-y-3">
          <div v-if="S.ocurrenciasHoy.value.length" class="h-1.5 rounded-full bg-slate-200 overflow-hidden"><div class="h-full bg-emerald-500 transition-all" :style="{ width: S.progresoHoy.value + '%' }"></div></div>
          <div v-if="S.vencidas.value.length">
            <div class="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 mb-1.5"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Vencidas ({{ S.vencidas.value.length }})</div>
            <div class="space-y-1.5"><tarea-item v-for="o in S.vencidas.value.slice(0, 5)" :key="o.key" :o="o" compacto vencida></tarea-item></div>
          </div>
          <div>
            <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5"><i class="fa-solid fa-sun mr-1"></i>Hoy ({{ S.pendientesHoy.value.length }} pendientes)</div>
            <div v-if="!S.ocurrenciasHoy.value.length" class="text-xs text-slate-400 italic px-1">No tienes tareas para hoy.</div>
            <div class="space-y-1.5"><tarea-item v-for="o in S.ocurrenciasHoy.value" :key="o.key" :o="o" compacto></tarea-item></div>
          </div>
          <div v-if="S.avisosAnticipados.value.length">
            <div class="text-[10px] font-extrabold uppercase tracking-wider text-sky-600 mb-1.5"><i class="fa-solid fa-calendar-days mr-1"></i>Se acercan</div>
            <div class="space-y-1.5"><tarea-item v-for="o in S.avisosAnticipados.value" :key="o.key" :o="o" compacto mostrar-fecha></tarea-item></div>
          </div>
        </div>
        <div class="flex items-center justify-between gap-2 px-4 py-2.5 bg-white border-t border-slate-200">
          <button v-if="S.permisoNotif.value !== 'granted' && S.permisoNotif.value !== 'unsupported'" @click="S.pedirPermisoNotif()" class="text-[11px] font-bold text-amber-700 hover:underline"><i class="fa-solid fa-bell-slash mr-1"></i>Activar avisos de Windows</button>
          <span v-else class="text-[11px] text-emerald-600"><i class="fa-solid fa-circle-check mr-1"></i>Avisos activos</span>
          <button @click="abrirModulo" class="text-xs font-bold text-slate-700 hover:text-slate-950">Ver calendario <i class="fa-solid fa-arrow-right ml-1"></i></button>
        </div>
      </div>
    </div>
  `,
  setup() {
    const abierto = ref(false);
    const nueva = () => { abierto.value = false; S.abrirNuevaTarea(); };
    const abrirModulo = () => { abierto.value = false; S.irAMisTareas(); };
    return { S, abierto, nueva, abrirModulo };
  }
};

// ---------------------------------------------------------------------
// <recordatorios-avisos> (avisos en pantalla + resumen + formulario)
// ---------------------------------------------------------------------
export const RecordatoriosAvisos = {
  name: 'RecordatoriosAvisos',
  template: /* html */ `
    <!-- Avisos en pantalla -->
    <div class="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))] pointer-events-none">
      <transition-group enter-active-class="transition duration-300" enter-from-class="opacity-0 translate-y-4" leave-active-class="transition duration-200" leave-to-class="opacity-0 translate-x-6">
        <div v-for="t in S.toasts.value" :key="t.id" class="pointer-events-auto bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
          <div class="flex items-start gap-3 p-3.5">
            <div :class="['w-9 h-9 rounded-xl flex items-center justify-center shrink-0', t.tipo === 'resumen' ? 'bg-sky-500' : t.tipo === 'anticipado' ? 'bg-indigo-500' : 'bg-amber-500 text-slate-950']">
              <i :class="['fa-solid', t.tipo === 'resumen' ? 'fa-list-check' : t.tipo === 'anticipado' ? 'fa-calendar-days' : 'fa-bell']"></i>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-bold text-sm leading-snug break-words">{{ t.titulo }}</div>
              <div class="text-xs text-slate-300 mt-0.5 break-words">{{ t.cuerpo }}</div>
            </div>
            <button @click="S.cerrarToast(t.id)" class="text-slate-400 hover:text-white" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="flex flex-wrap gap-1.5 px-3.5 pb-3">
            <button v-if="t.o && !t.o.hecha" @click="hecha(t)" class="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold px-2.5 py-1 rounded-lg"><i class="fa-solid fa-check mr-1"></i>Hecha</button>
            <template v-if="t.o && t.o.fecha === S.hoyRef.value">
              <button v-for="m in [5, 10, 30]" :key="m" @click="S.posponer(t.o, m, t.id)" class="bg-white/10 hover:bg-white/20 text-xs font-bold px-2 py-1 rounded-lg">+{{ m }} min</button>
            </template>
            <button @click="ver(t)" class="ml-auto bg-white/10 hover:bg-white/20 text-xs font-bold px-2.5 py-1 rounded-lg">Ver</button>
          </div>
        </div>
      </transition-group>
    </div>

    <!-- Resumen al iniciar sesión -->
    <div v-if="S.mostrarResumenLogin.value" class="fixed inset-0 z-[65] bg-slate-950/60 flex items-center justify-center p-4" @click.self="S.mostrarResumenLogin.value = false">
      <div class="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden">
        <div class="bg-slate-900 text-white px-6 py-5">
          <div class="text-xs text-slate-400 uppercase tracking-wider font-bold">{{ S.fechaLarga(S.hoyRef.value) }}</div>
          <h3 class="text-xl font-extrabold mt-1"><i class="fa-solid fa-sun text-amber-400 mr-2"></i>{{ saludo }}</h3>
          <div class="mt-3 grid grid-cols-3 gap-2 text-center">
            <div class="bg-white/10 rounded-xl py-2"><div class="text-2xl font-extrabold text-amber-300">{{ S.pendientesHoy.value.length }}</div><div class="text-[10px] uppercase text-slate-300 font-bold">Para hoy</div></div>
            <div class="bg-white/10 rounded-xl py-2"><div :class="['text-2xl font-extrabold', S.vencidas.value.length ? 'text-rose-400' : 'text-slate-400']">{{ S.vencidas.value.length }}</div><div class="text-[10px] uppercase text-slate-300 font-bold">Vencidas</div></div>
            <div class="bg-white/10 rounded-xl py-2"><div class="text-2xl font-extrabold text-sky-300">{{ S.avisosAnticipados.value.length }}</div><div class="text-[10px] uppercase text-slate-300 font-bold">Se acercan</div></div>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <div v-if="S.vencidas.value.length">
            <div class="text-[11px] font-extrabold uppercase tracking-wider text-rose-600 mb-1.5"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Quedaron pendientes</div>
            <div class="space-y-1.5"><tarea-item v-for="o in S.vencidas.value" :key="o.key" :o="o" compacto vencida></tarea-item></div>
          </div>
          <div v-if="S.ocurrenciasHoy.value.length">
            <div class="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5"><i class="fa-solid fa-sun mr-1"></i>Hoy</div>
            <div class="space-y-1.5"><tarea-item v-for="o in S.ocurrenciasHoy.value" :key="o.key" :o="o" compacto></tarea-item></div>
          </div>
          <div v-if="S.avisosAnticipados.value.length">
            <div class="text-[11px] font-extrabold uppercase tracking-wider text-sky-600 mb-1.5"><i class="fa-solid fa-calendar-days mr-1"></i>Se acercan</div>
            <div class="space-y-1.5"><tarea-item v-for="o in S.avisosAnticipados.value" :key="o.key" :o="o" compacto mostrar-fecha></tarea-item></div>
          </div>
          <div v-if="S.permisoNotif.value === 'default'" class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-center gap-3">
            <i class="fa-solid fa-bell text-lg text-amber-500"></i>
            <span class="flex-1">Activa las notificaciones de Windows para que te avise a la hora de cada tarea.</span>
            <button @click="S.pedirPermisoNotif()" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg">Activar</button>
          </div>
        </div>
        <div class="flex gap-2 justify-end px-4 py-3 bg-white border-t border-slate-200">
          <button @click="S.mostrarResumenLogin.value = false; S.irAMisTareas()" class="px-4 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100">Ver calendario</button>
          <button @click="S.mostrarResumenLogin.value = false" class="px-5 py-2 rounded-xl text-sm font-bold bg-slate-900 hover:bg-slate-700 text-white">Entendido</button>
        </div>
      </div>
    </div>

    <!-- Nueva / Editar tarea -->
    <div v-if="f" class="fixed inset-0 z-[66] bg-slate-950/60 flex items-center justify-center p-3 sm:p-4" @click.self="cerrar">
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[94vh] flex flex-col overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 class="font-extrabold text-slate-800 text-lg"><i :class="['fa-solid mr-2', f.id ? 'fa-pen text-sky-500' : 'fa-plus text-emerald-500']"></i>{{ f.id ? 'Editar tarea' : 'Nueva tarea' }}</h3>
          <button @click="cerrar" class="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Cerrar"><i class="fa-solid fa-xmark text-lg"></i></button>
        </div>
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <input ref="inpTitulo" v-model="f.titulo" @keydown.enter="guardar" maxlength="200" placeholder="¿Qué tienes que hacer?"
              class="w-full text-lg font-semibold border-0 border-b-2 border-slate-200 focus:border-amber-500 focus:ring-0 outline-none px-1 py-2 placeholder:text-slate-300">
            <textarea v-model="f.detalle" rows="2" placeholder="Notas o detalle (opcional)" class="mt-2 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-amber-400 outline-none resize-y"></textarea>
          </div>

          <!-- Tipo de tarea -->
          <div>
            <div class="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">¿Cuándo?</div>
            <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              <button v-for="r in S.REPETICIONES" :key="r.k" type="button" @click="f.repeticion = r.k"
                :class="['flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-bold transition', f.repeticion === r.k ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50']">
                <i :class="['fa-solid text-sm', r.icon]"></i>{{ r.l }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="block">
              <span class="text-xs font-bold text-slate-600">{{ f.repeticion === 'NINGUNA' ? 'Fecha' : 'Desde' }}</span>
              <input type="date" v-model="f.fecha" class="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 outline-none">
              <div class="flex gap-1 mt-1.5">
                <button v-for="a in atajos" :key="a.l" type="button" @click="f.fecha = a.f" :class="['text-[11px] font-bold px-2 py-0.5 rounded-md', f.fecha === a.f ? 'bg-amber-400 text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200']">{{ a.l }}</button>
              </div>
            </label>
            <div>
              <span class="text-xs font-bold text-slate-600">Hora</span>
              <div class="mt-1 flex items-center gap-2">
                <input type="time" v-model="f.hora" @input="f.todoElDia = !f.hora" :class="['flex-1 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 outline-none', f.todoElDia ? 'bg-slate-50 text-slate-400' : '']">
                <label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 whitespace-nowrap cursor-pointer">
                  <input type="checkbox" v-model="f.todoElDia" @change="f.todoElDia && (f.hora = '')" class="accent-amber-500"> Todo el día
                </label>
              </div>
              <div class="flex gap-1 mt-1.5 flex-wrap">
                <button v-for="h in ['08:00', '09:00', '12:00', '15:00', '17:00']" :key="h" type="button" @click="f.hora = h; f.todoElDia = false" :class="['text-[11px] font-bold px-2 py-0.5 rounded-md', f.hora === h ? 'bg-amber-400 text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200']">{{ h }}</button>
              </div>
            </div>
          </div>

          <!-- Repetición -->
          <div v-if="f.repeticion !== 'NINGUNA'" class="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-3 space-y-3">
            <div v-if="f.repeticion === 'SEMANAL'">
              <span class="text-xs font-bold text-slate-600">Días de la semana</span>
              <div class="mt-1 flex flex-wrap gap-1.5">
                <button v-for="d in S.SEMANA_LUN" :key="d" type="button" @click="alternarDia(d)"
                  :class="['w-11 h-9 rounded-lg text-xs font-bold border transition', f.dias_semana.includes(d) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50']">{{ S.DIAS_CORTOS[d] }}</button>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label v-if="f.repeticion !== 'LABORAL'" class="block">
                <span class="text-xs font-bold text-slate-600">Repetir cada</span>
                <div class="mt-1 flex items-center gap-2">
                  <input type="number" min="1" max="99" v-model.number="f.cada" class="w-20 border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white">
                  <span class="text-sm text-slate-600">{{ unidadCada }}</span>
                </div>
              </label>
              <label class="block">
                <span class="text-xs font-bold text-slate-600">Hasta (opcional)</span>
                <input type="date" v-model="f.fecha_fin" :min="f.fecha" class="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white">
              </label>
            </div>
            <div class="text-xs text-indigo-700 font-semibold"><i class="fa-solid fa-rotate mr-1"></i>{{ S.textoRepeticion(vista) }}</div>
          </div>

          <!-- Avisos -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="block">
              <span class="text-xs font-bold text-slate-600"><i class="fa-solid fa-bell text-amber-500 mr-1"></i>Aviso con hora</span>
              <select v-model="f.aviso_min" :disabled="f.todoElDia" class="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-400">
                <option v-for="a in S.AVISOS_MIN" :key="String(a.v)" :value="a.v">{{ a.l }}</option>
              </select>
              <span v-if="f.todoElDia" class="text-[11px] text-slate-400">Sin hora: aparece en el resumen de la mañana y en la campana.</span>
            </label>
            <label v-if="f.repeticion === 'NINGUNA'" class="block">
              <span class="text-xs font-bold text-slate-600"><i class="fa-solid fa-calendar-days text-sky-500 mr-1"></i>Avisar con anticipación</span>
              <select v-model.number="f.aviso_dias" class="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white">
                <option v-for="a in S.AVISOS_DIAS" :key="a.v" :value="a.v">{{ a.l }}</option>
              </select>
            </label>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span class="text-xs font-bold text-slate-600">Prioridad</span>
              <div class="mt-1 flex gap-1.5">
                <button v-for="p in S.PRIORIDADES" :key="p.k" type="button" @click="f.prioridad = p.k"
                  :class="['flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold', f.prioridad === p.k ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50']">
                  <span :class="['w-2.5 h-2.5 rounded-full', p.dot]"></span>{{ p.l }}
                </button>
              </div>
            </div>
            <label class="block">
              <span class="text-xs font-bold text-slate-600">Categoría</span>
              <input v-model="f.categoria" list="frc-rec-categorias" @focus="$event.target.select()" class="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm uppercase">
              <datalist id="frc-rec-categorias"><option v-for="c in categorias" :key="c" :value="c"></option></datalist>
            </label>
          </div>

          <!-- Checklist -->
          <div>
            <span class="text-xs font-bold text-slate-600"><i class="fa-solid fa-list-check mr-1"></i>Pasos / checklist (opcional)</span>
            <div class="mt-1 space-y-1.5">
              <div v-for="(c, i) in f.checklist" :key="i" class="flex items-center gap-2">
                <input type="checkbox" v-model="c.ok" class="accent-emerald-600">
                <input v-model="c.t" @keydown.enter.prevent="agregarPaso" class="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm" placeholder="Paso">
                <button type="button" @click="f.checklist.splice(i, 1)" class="text-slate-400 hover:text-rose-500 w-7"><i class="fa-solid fa-xmark"></i></button>
              </div>
              <button type="button" @click="agregarPaso" class="text-xs font-bold text-slate-600 hover:text-slate-900"><i class="fa-solid fa-plus mr-1"></i>Agregar paso</button>
            </div>
          </div>

          <label v-if="f.id" class="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" :checked="!f.activa" @change="f.activa = !$event.target.checked" class="accent-slate-700"> Pausar esta tarea (no aparece ni avisa)
          </label>
        </div>
        <div class="flex items-center gap-2 px-5 py-3.5 border-t border-slate-200 bg-slate-50">
          <button v-if="f.id" @click="eliminar" class="px-3 py-2 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50"><i class="fa-solid fa-trash mr-1"></i>Eliminar</button>
          <div class="flex-1"></div>
          <button @click="cerrar" class="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200">Cancelar</button>
          <button @click="guardar" :disabled="S.guardandoTarea.value" class="px-5 py-2 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 disabled:opacity-60">
            <i :class="['fa-solid mr-1', S.guardandoTarea.value ? 'fa-spinner fa-spin' : 'fa-check']"></i>Guardar
          </button>
        </div>
      </div>
    </div>
  `,
  setup() {
    const f = S.formTarea;
    const inpTitulo = ref(null);
    watch(() => f.value && f.value.id + '|' + (f.value ? 1 : 0), async () => {
      if (f.value && !f.value.id) { await nextTick(); inpTitulo.value?.focus(); }
    });
    const hoy = hoyISO();
    const atajos = computed(() => {
      const h = S.hoyRef.value;
      return [
        { l: 'Hoy', f: h },
        { l: 'Mañana', f: sumarDiasISO(h, 1) },
        { l: 'Lunes', f: sumarDiasISO(S.lunesDe(h), 7) },
        { l: '+1 mes', f: S.mismoDiaEnMeses(h, 1) }
      ];
    });
    const unidadCada = computed(() => ({ DIARIA: 'día(s)', SEMANAL: 'semana(s)', MENSUAL: 'mes(es)', ANUAL: 'año(s)' }[f.value?.repeticion] || ''));
    const vista = computed(() => ({ ...f.value, cada: Number(f.value?.cada) || 1, dias_semana: f.value?.dias_semana || [] }));
    const categorias = computed(() => Array.from(new Set([...S.CATEGORIAS.map(c => c.k), ...S.dbTareas.value.map(t => t.categoria)])).sort());
    const alternarDia = (d) => {
      const a = f.value.dias_semana;
      const i = a.indexOf(d);
      if (i >= 0) { if (a.length > 1) a.splice(i, 1); } else a.push(d);
    };
    const agregarPaso = () => { f.value.checklist.push({ t: '', ok: false }); };
    const cerrar = () => S.cerrarFormTarea();
    const guardar = async () => { if (await S.guardarTarea(f.value)) S.cerrarFormTarea(); };
    const eliminar = async () => {
      const t = S.dbTareas.value.find(x => x.id === f.value.id);
      if (t && await S.eliminarTarea(t)) S.cerrarFormTarea();
    };
    const hecha = (t) => { S.marcar(t.o.t, t.o.fecha, 'HECHA'); S.cerrarToast(t.id); };
    const ver = (t) => { S.cerrarToast(t.id); S.irAMisTareas(); };
    const saludo = computed(() => {
      const h = new Date().getHours();
      const n = String(usuarioActivo.value?.nombre || '').split(' ')[0];
      return (h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches') + (n ? ', ' + n : '');
    });
    const onKey = (e) => { if (e.key === 'Escape' && f.value) cerrar(); };
    onMounted(() => window.addEventListener('keydown', onKey));
    onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
    return { S, f, inpTitulo, hoy, atajos, unidadCada, vista, categorias, alternarDia, agregarPaso, cerrar, guardar, eliminar, hecha, ver, saludo };
  }
};
