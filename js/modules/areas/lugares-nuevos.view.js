// ÁREAS · Alerta "Lugares nuevos escritos por choferes" (2026-11-17) · ver lugares-nuevos.js
import * as L from './lugares-nuevos.js';
import { dbLocaciones, puedeEditar } from '../../core/store.js';
import { textoUbicacion, rutaDe } from './areas.service.js';
import { formatDateForDisplay } from '../../core/utils.js';

export default {
  name: 'LugaresNuevos',
  template: /* html */ `
<div v-if="L.lugaresNuevos.value.length" class="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-3 text-xs">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <h3 class="font-black text-amber-900 text-sm"><i class="fa-solid fa-bell mr-1"></i> {{ L.lugaresNuevos.value.length }} lugar(es) nuevo(s) escrito(s) por choferes</h3>
    <span class="text-amber-800">Créalo como locación (botón + en la Empresa / Área / Sector) y luego asígnalo, o descártalo.</span>
  </div>
  <div v-for="l in L.lugaresNuevos.value" :key="l.id" class="bg-white rounded-lg border border-amber-200 p-3 flex flex-wrap items-center gap-3">
    <div class="flex-1 min-w-[220px]">
      <p class="font-black text-slate-800 text-sm">"{{ l.lugar }}"</p>
      <p class="text-slate-500">AFI <b>{{ l.afi }}</b><span v-if="l.subarrendado"> (subarrendado)</span> · {{ formatDateForDisplay(l.fecha) }} · {{ l.chofer }} · camión {{ l.patente }}</p>
    </div>
    <template v-if="puedeEditar">
      <select :value="sel[l.id] || ''" @change="sel[l.id] = $event.target.value" class="p-2 border rounded-lg max-w-[320px] bg-white">
        <option value="">Asignar a locación…</option>
        <optgroup v-for="g in grupos" :key="g.label" :label="g.label"><option v-for="o in g.opciones" :key="o.id" :value="o.id">{{ o.texto }}</option></optgroup>
      </select>
      <button @click="L.asignarLugar(l, sel[l.id])" :disabled="!sel[l.id]" class="px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-40"><i class="fa-solid fa-check mr-1"></i>Asignar</button>
      <button @click="L.descartarLugar(l)" class="px-3 py-2 rounded-lg border font-bold text-slate-600">Descartar</button>
    </template>
  </div>
</div>
<div v-else-if="L.faltaSqlLugares.value && puedeEditar" class="bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3 text-xs">Para ver los lugares nuevos escritos por choferes ejecuta <b>sql/chofer.sql</b> en Supabase.</div>`,
  setup() {
    const sel = Vue.ref({});
    const grupos = Vue.computed(() => {
      const m = new Map();
      dbLocaciones.value.filter(n => n.tipo === 'LOCACION').forEach(n => {
        const r = rutaDe(n.id); const g = [r.empresa?.nombre, r.area?.nombre].filter(Boolean).join(' · ') || 'SIN ÁREA';
        if (!m.has(g)) m.set(g, []);
        m.get(g).push({ id: n.id, texto: textoUbicacion(n.id) });
      });
      return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, opciones]) => ({ label, opciones: opciones.sort((a, b) => a.texto.localeCompare(b.texto)) }));
    });
    Vue.onMounted(L.cargarLugaresNuevos);
    return { L, sel, grupos, puedeEditar, formatDateForDisplay };
  }
};
