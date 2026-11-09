// =====================================================================
// Componente global <causas-probables :pieza="'CORREA'" :motivo="'ROTURA'" compacto>
// Muestra, para una pieza (y su motivo si se conoce), las causas probables, qué revisar y cómo prevenir
// según core/conocimiento-fallas.js (mismo contenido que el doc "Causas de falla por componente FRC").
// =====================================================================
import { causasProbables } from '../../core/conocimiento-fallas.js';
import { piezaPorKey, motivoPorKey } from '../../core/analisis-fallas.js';

const { ref, computed } = Vue;

const template = /* html */ `
<div v-if="lista.length" class="bg-sky-50 border border-sky-200 rounded-lg p-2.5 text-[11px] text-slate-700">
  <div class="flex items-center justify-between gap-2 mb-1">
    <span class="font-extrabold text-sky-900"><i class="fa-solid fa-lightbulb text-amber-500 mr-1"></i>{{ titulo || ('¿Por qué falla ' + (pz ? pz.label.toLowerCase() : 'esta pieza') + '?') }}</span>
    <span v-if="motivoTxt" class="text-[10px] bg-rose-50 text-rose-700 px-1.5 rounded font-semibold">{{ motivoTxt }}</span>
  </div>
  <div v-for="(e, k) in visibles" :key="k" :class="k ? 'mt-2 pt-2 border-t border-sky-200' : ''">
    <b class="text-slate-800">{{ e.f }}</b>
    <div class="grid md:grid-cols-3 gap-2 mt-1">
      <div><span class="block text-[9px] uppercase font-bold text-sky-800">Causas probables</span>
        <ol class="list-decimal ml-4"><li v-for="c in (compacto ? e.c.slice(0, 3) : e.c)" :key="c">{{ c }}</li></ol></div>
      <div><span class="block text-[9px] uppercase font-bold text-sky-800">Qué revisar</span>
        <ul class="list-disc ml-4"><li v-for="r in e.r" :key="r">{{ r }}</li></ul></div>
      <div><span class="block text-[9px] uppercase font-bold text-emerald-800">Cómo prevenir</span>{{ e.p }}</div>
    </div>
  </div>
  <button v-if="lista.length > max" @click.stop="todos = !todos" class="mt-1.5 text-sky-700 font-bold underline">{{ todos ? 'Ver menos' : 'Ver otras ' + (lista.length - max) + ' falla(s) de esta pieza' }}</button>
</div>
`;

export default {
  name: 'CausasProbables',
  props: {
    pieza: { type: String, default: '' },
    motivo: { type: String, default: '' },
    compacto: { type: Boolean, default: false },
    max: { type: Number, default: 1 },
    titulo: { type: String, default: '' }
  },
  template,
  setup(props) {
    const todos = ref(false);
    const lista = computed(() => causasProbables(props.pieza, props.motivo || null));
    const visibles = computed(() => todos.value ? lista.value : lista.value.slice(0, props.max));
    const pz = computed(() => piezaPorKey(props.pieza));
    const motivoTxt = computed(() => props.motivo && props.motivo !== 'SIN_MOTIVO' ? motivoPorKey(props.motivo).label : '');
    return { todos, lista, visibles, pz, motivoTxt };
  }
};
