// =====================================================================
// TALLER · EJECUTANTES DE UN ÍTEM DE LA OT (2026-11-20)
// Varias personas por ítem: se guardan en el mismo campo "ejecutante" separadas por coma
// (así sale igual en la OT impresa). Uso: <ejecutantes-input v-model="a.ejecutante" @change="guardar" :disabled="…">
// =====================================================================
const { ref, computed } = Vue;

export default {
  name: 'EjecutantesInput',
  props: { modelValue: { type: String, default: '' }, disabled: { type: Boolean, default: false } },
  emits: ['update:modelValue', 'change'],
  template: /* html */ `
<div class="mt-0.5 w-full min-w-0 p-1.5 border-2 rounded-lg bg-white flex flex-wrap items-center gap-1" data-ejecutantes>
  <span v-for="(n, k) in lista" :key="n + k" class="inline-flex items-center gap-1 bg-sky-100 text-sky-900 rounded-md px-2 py-1 text-xs font-bold normal-case">
    {{ n }}<button v-if="!disabled" type="button" @click="quitar(k)" class="text-sky-700 hover:text-rose-600" title="Quitar"><i class="fa-solid fa-xmark"></i></button>
  </span>
  <template v-if="!disabled">
    <input v-model="nuevo" @keydown.enter.prevent="agregar" @keydown.,.prevent="agregar" @blur="agregar"
      class="flex-1 min-w-[90px] px-1.5 py-1 text-sm font-bold uppercase outline-none" :placeholder="lista.length ? '+ Agregar otro' : 'Nombre'">
    <button type="button" @click="agregar" class="px-2 py-1 rounded-md bg-sky-600 text-white text-xs font-bold" title="Agregar persona"><i class="fa-solid fa-user-plus"></i></button>
  </template>
  <span v-else-if="!lista.length" class="text-slate-400 text-sm px-1">—</span>
</div>`,
  setup(props, { emit }) {
    const nuevo = ref('');
    const lista = computed(() => String(props.modelValue || '').split(',').map(s => s.trim()).filter(Boolean));
    const fijar = (l) => { emit('update:modelValue', l.join(', ')); emit('change'); };
    const agregar = () => {
      const n = nuevo.value.trim().toUpperCase().replace(/,/g, ' ');
      nuevo.value = '';
      if (!n || lista.value.includes(n)) return;
      fijar([...lista.value, n]);
    };
    const quitar = (k) => { const l = [...lista.value]; l.splice(k, 1); fijar(l); };
    return { nuevo, lista, agregar, quitar };
  }
};
