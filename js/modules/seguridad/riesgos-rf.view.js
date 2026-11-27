// =====================================================================
// SEGURIDAD · 31 RIESGOS DE FATALIDAD CODELCO · 2026-11-18
// "Controles Críticos que Salvan Vidas" (SIGO-G-012 v002): por cada RF, los controles críticos
// preventivos (CCP) y mitigadores (CCM) con la pregunta de verificación del Trabajador/a y del Supervisor/a.
// Se ve en:
//   · Web: Seguridad → Riesgos de fatalidad (31)
//   · App técnicos (todos los perfiles): tarjeta "Riesgos de fatalidad"
// Solo INFORMATIVO (2026-11-19, decisión usuario): se muestran las preguntas de verificación, sin responder Sí / No.
// Es material de difusión: manda siempre el documento oficial vigente de Codelco.
// =====================================================================
import { RF } from './riesgos-rf.data.js';
import { exportarPdfRF } from './riesgos-pdf.js';   // 2026-11-27: PDF resumido para imprimir
const { ref, computed } = Vue;

const NARANJO = '#E8622A';
export const iconoRF = (n) => `img/rf/rf${String(n).padStart(2, '0')}.webp`;
const pad = (n) => String(n).padStart(2, '0');
// "Operador: ¿…?" → rol en negrita + pregunta
const partirPregunta = (p) => {
  const m = String(p || '').match(/^([A-ZÁÉÍÓÚÑ][^:¿?]{2,110}):\s*(.*)$/);
  return m ? { rol: m[1], texto: m[2] } : { rol: '', texto: p };
};

export default {
  name: 'RiesgosRf',
  props: { compacto: { type: Boolean, default: false } },   // compacto = app del celular
  template: /* html */ `
<section :class="compacto ? 'space-y-3' : 'space-y-5'" data-rf="vista">
  <!-- Encabezado -->
  <div :class="['rounded-3xl text-white shadow-lg overflow-hidden relative', compacto ? 'p-4' : 'p-6']" style="background:linear-gradient(135deg,#1f2937 0%,#7c2d12 45%,#E8622A 100%)">
    <div class="absolute -right-10 -top-10 w-48 h-48 rounded-full" style="background:rgba(255,255,255,.07)"></div>
    <div class="absolute right-16 -bottom-16 w-40 h-40 rounded-full" style="background:rgba(255,255,255,.05)"></div>
    <div class="relative flex items-center gap-3">
      <span class="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0" style="background:rgba(255,255,255,.16)"><i class="fa-solid fa-heart-pulse"></i></span>
      <div class="min-w-0">
        <p class="text-[11px] font-black tracking-widest uppercase" style="color:#fed7aa">Codelco · Controles críticos que salvan vidas</p>
        <h2 :class="['font-black leading-tight', compacto ? 'text-xl' : 'text-3xl']">31 Riesgos de Fatalidad</h2>
        <p class="text-xs" style="color:rgba(255,255,255,.85)">Antes de empezar, revisa el riesgo de tu tarea y sus controles críticos. <b>Si algún control no está, detén la actividad.</b></p>
      </div>
    </div>
    <div class="relative mt-4 flex flex-wrap gap-2 items-center">
      <div class="flex-1 min-w-[190px] relative">
        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
        <input v-model="buscar" data-rf="buscar" placeholder="Buscar (altura, energía, izaje, vehículos…)" class="w-full pl-9 pr-3 py-2.5 rounded-xl text-slate-900 text-sm shadow-inner">
      </div>
      <div class="flex rounded-xl p-1" style="background:rgba(0,0,0,.25)">
        <button v-for="r in ROLES" :key="r.k" @click="rol = r.k" :class="['px-3 py-1.5 rounded-lg text-xs font-black transition', rol === r.k ? 'bg-white text-slate-900 shadow' : 'text-white']"><i :class="['fa-solid mr-1', r.icon]"></i>{{ r.label }}</button>
      </div>
      <button @click="pdf" :disabled="generando" class="px-3 py-2 rounded-xl bg-white text-slate-900 text-xs font-black shadow disabled:opacity-60" data-rf="pdf"><i :class="['fa-solid mr-1', generando ? 'fa-spinner fa-spin' : 'fa-file-pdf text-red-600']"></i>{{ generando ? 'Generando…' : 'PDF para imprimir' }}</button>
    </div>
  </div>

  <!-- Grilla de los 31 -->
  <div :class="['grid gap-3', compacto ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6']">
    <button v-for="r in lista" :key="r.n" @click="abrir(r)" :data-rf="'card-' + r.n"
      class="group bg-white rounded-3xl shadow-sm border border-orange-100 text-left overflow-hidden hover:shadow-xl hover:-translate-y-0.5 active:scale-[.98] transition flex flex-col">
      <div class="relative w-full flex items-center justify-center pt-4 pb-3" style="background:radial-gradient(circle at 50% 40%,#fff7ed 0%,#ffedd5 70%,#fed7aa 100%)">
        <span class="absolute top-2 left-2 text-[10px] font-black px-2 py-0.5 rounded-full text-white shadow" :style="{ background: NARANJO }">RF {{ pad(r.n) }}</span>
        <img :src="iconoRF(r.n)" :alt="r.nombre" loading="lazy" :class="['drop-shadow-md transition group-hover:scale-105', compacto ? 'w-24 h-24' : 'w-28 h-28']" style="border-radius:9999px">
      </div>
      <div class="p-3 flex-1 flex flex-col">
        <p class="font-extrabold text-slate-800 text-sm leading-snug">{{ r.nombre }}</p>
        <p class="mt-auto pt-2 text-[11px] text-slate-500 flex gap-2">
          <span><i class="fa-solid fa-shield-halved text-emerald-600 mr-0.5"></i>{{ cuenta(r, 'CCP') }} prev.</span>
          <span><i class="fa-solid fa-kit-medical text-sky-600 mr-0.5"></i>{{ cuenta(r, 'CCM') }} mitig.</span>
        </p>
      </div>
    </button>
  </div>
  <p v-if="!lista.length" class="text-center text-slate-500 text-sm py-6">No hay riesgos que coincidan con "{{ buscar }}".</p>
  <p class="text-[10px] text-slate-400 px-1">Fuente: Codelco SIGO-G-012 "Controles Críticos que Salvan Vidas" v002. <b>CCP</b> = control crítico preventivo (evita que ocurra) · <b>CCM</b> = control crítico mitigador (reduce las consecuencias). Manda siempre el documento oficial vigente y las indicaciones de prevención de riesgos.</p>

  <!-- Detalle -->
  <teleport to="body">
    <div v-if="abierto" class="fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-0 sm:p-4" style="background:rgba(2,6,23,.72)" @click.self="cerrar" data-rf="detalle">
      <div class="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[94vh] overflow-y-auto shadow-2xl" data-rf="panel">
        <!-- Cabecera -->
        <div class="relative text-white px-5 pt-5 pb-4" style="background:linear-gradient(135deg,#7c2d12,#E8622A)">
          <button @click="cerrar" class="absolute top-3 right-3 w-9 h-9 rounded-full" style="background:rgba(255,255,255,.2)"><i class="fa-solid fa-xmark"></i></button>
          <div class="flex items-center gap-4 pr-10">
            <img :src="iconoRF(abierto.n)" :alt="abierto.nombre" class="shrink-0 bg-white shadow-xl" style="width:6.5rem;height:6.5rem;border-radius:9999px;border:4px solid rgba(255,255,255,.9)">
            <div class="min-w-0">
              <p class="text-xs font-black tracking-widest" style="color:#fed7aa">RIESGO DE FATALIDAD · RF {{ pad(abierto.n) }}</p>
              <h3 class="text-2xl font-black leading-tight">{{ abierto.nombre }}</h3>
            </div>
          </div>
          <div class="mt-4 flex rounded-xl p-1" style="background:rgba(0,0,0,.22)">
            <button v-for="r in ROLES" :key="r.k" @click="rol = r.k" :data-rf="'rol-' + r.k" :class="['flex-1 px-3 py-2 rounded-lg text-sm font-black transition', rol === r.k ? 'bg-white text-orange-800 shadow' : 'text-white']"><i :class="['fa-solid mr-1.5', r.icon]"></i>{{ r.label }}</button>
          </div>
        </div>

        <div class="p-4 sm:p-5 space-y-4 text-sm">
          <div v-for="g in grupos" :key="g.k">
            <p :class="['text-[11px] font-black uppercase mb-2 flex items-center gap-1.5', g.k === 'CCP' ? 'text-emerald-700' : 'text-sky-700']">
              <i :class="['fa-solid', g.k === 'CCP' ? 'fa-shield-halved' : 'fa-kit-medical']"></i>{{ g.titulo }}
            </p>
            <div class="space-y-2.5">
              <div v-for="c in g.items" :key="c.c" class="rounded-2xl border-2 border-slate-100 overflow-hidden" :data-rf="'ctrl-' + c.c">
                <div :class="['px-3 py-2 flex items-center gap-2', g.k === 'CCP' ? 'bg-emerald-50' : 'bg-sky-50']">
                  <span :class="['text-[11px] font-black px-2 py-0.5 rounded-lg text-white shrink-0', g.k === 'CCP' ? 'bg-emerald-600' : 'bg-sky-600']">{{ c.c }}</span>
                  <span class="font-extrabold text-slate-800 leading-snug">{{ c.nombre }}</span>
                </div>
                <div class="px-3 py-2.5">
                  <p class="text-slate-700 leading-relaxed"><b v-if="partir(c.p).rol" class="text-orange-800">{{ partir(c.p).rol }}: </b>{{ partir(c.p).texto }}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-2xl p-3 text-xs border" style="background:#fff7ed;border-color:#fdba74;color:#7c2d12">
            <p><b class="text-red-700">Si algún control crítico no está implementado, detenga la actividad.</b></p>
            <p v-if="rol === 'T'">Luego, aplique <b class="text-emerald-700">tarjeta verde</b> y notifique al supervisor para asegurar la implementación del control crítico en terreno.</p>
            <p v-else>Luego, gestione y asegure la implementación del control crítico en terreno.</p>
          </div>

          <div class="flex gap-2 sticky bottom-0 bg-white pt-2 pb-1">
            <button @click="mover(-1)" data-rf="anterior" class="flex-1 py-3 rounded-xl border-2 font-bold text-slate-700"><i class="fa-solid fa-chevron-left mr-1"></i>RF {{ pad(vecino(-1).n) }}</button>
            <button @click="mover(1)" data-rf="siguiente" class="flex-1 py-3 rounded-xl font-black text-white shadow" :style="{ background: NARANJO }">RF {{ pad(vecino(1).n) }}<i class="fa-solid fa-chevron-right ml-1"></i></button>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</section>`,
  setup() {
    const ROLES = [{ k: 'T', label: 'Trabajador/a', icon: 'fa-helmet-safety' }, { k: 'S', label: 'Supervisor/a', icon: 'fa-user-tie' }];
    const buscar = ref(''), abierto = ref(null), rol = ref('T');
    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const textoRF = (r) => norm([r.n, 'rf' + r.n, 'rf' + pad(r.n), r.nombre, ...r.trabajador.map(c => c.nombre + ' ' + c.p), ...r.supervisor.map(c => c.p)].join(' '));
    const lista = computed(() => { const q = norm(buscar.value).trim(); return RF.filter(r => !q || textoRF(r).includes(q)); });
    const cuenta = (r, k) => r.trabajador.filter(c => c.c.startsWith(k)).length;
    const controles = computed(() => !abierto.value ? [] : (rol.value === 'T' ? abierto.value.trabajador : abierto.value.supervisor));
    const grupos = computed(() => [
      { k: 'CCP', titulo: 'Controles críticos preventivos · evitan que ocurra', items: controles.value.filter(c => c.c.startsWith('CCP')) },
      { k: 'CCM', titulo: 'Controles críticos mitigadores · reducen las consecuencias', items: controles.value.filter(c => c.c.startsWith('CCM')) }
    ].filter(g => g.items.length));
    const arriba = () => Vue.nextTick(() => { const el = document.querySelector('[data-rf=panel]'); if (el) el.scrollTop = 0; });
    const abrir = (r) => { abierto.value = r; arriba(); };
    const cerrar = () => { abierto.value = null; };
    const idx = () => { const i = RF.findIndex(r => r.n === abierto.value?.n); return i < 0 ? 0 : i; };
    const vecino = (d) => RF[(idx() + d + RF.length) % RF.length];
    const mover = (d) => abrir(vecino(d));
    const generando = ref(false);
    const pdf = async () => { generando.value = true; try { await exportarPdfRF(); } catch (err) { alert('No se pudo generar el PDF: ' + (err?.message || err)); } finally { generando.value = false; } };
    return { generando, pdf, ROLES, NARANJO, buscar, abierto, rol, lista, cuenta, grupos, abrir, cerrar, mover, vecino, iconoRF, pad, partir: partirPregunta };
  }
};
