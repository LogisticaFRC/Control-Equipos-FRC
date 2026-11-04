// =====================================================================
// ÁREAS · Componente <selector-locacion :sel="..."> (Empresa → Área → Locación)
// ---------------------------------------------------------------------
// Se usa en Perfil de Equipo, Registrar Movimiento y el módulo Áreas.
// `sel` es un objeto reactivo creado con selDesdeLocacion() y se modifica aquí.
// Cada lista tiene "➕ Crear nueva…": se escribe el nombre y se crea al guardar
// (con resolverSeleccion). Si la empresa es nueva, el área y la locación también.
// =====================================================================
import { empresas, hijos, nodo, NUEVA, nombresSel, selCompleta, selCreaAlgo } from './areas.service.js';

const template = /* html */ `
<div class="space-y-2">
  <div :class="['grid gap-2', compacto ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 md:grid-cols-3']">
    <!-- 1 · EMPRESA -->
    <div>
      <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]"><span class="inline-flex w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] items-center justify-center mr-1">1</span><i class="fa-solid fa-building text-blue-500"></i> Empresa</label>
      <select v-model="sel.empresaId" @change="cambioEmpresa" :disabled="disabled" class="w-full p-2 border rounded-lg bg-white font-bold text-blue-800">
        <option value="">-- Seleccionar --</option>
        <option v-for="e in empresas" :key="e.id" :value="e.id">{{ e.nombre }}</option>
        <option v-if="puedeCrear" :value="NUEVA">➕ Crear nueva empresa…</option>
      </select>
      <input v-if="sel.empresaId === NUEVA" v-model="sel.nuevaEmpresa" :disabled="disabled" placeholder="Nombre de la empresa nueva" class="mt-1 w-full p-2 border-2 border-blue-300 rounded-lg uppercase font-bold bg-blue-50">
    </div>
    <!-- 2 · ÁREA -->
    <div>
      <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]"><span class="inline-flex w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] items-center justify-center mr-1">2</span><i class="fa-solid fa-folder text-amber-500"></i> Área</label>
      <select v-model="sel.areaId" @change="cambioArea" :disabled="disabled || !sel.empresaId || sel.empresaId === NUEVA" class="w-full p-2 border rounded-lg bg-white font-bold text-amber-800 disabled:bg-slate-100">
        <option value="">{{ sel.empresaId ? '-- Seleccionar --' : '(elige empresa)' }}</option>
        <option v-for="a in areasDe" :key="a.id" :value="a.id">{{ a.nombre }}</option>
        <option v-if="puedeCrear" :value="NUEVA">➕ Crear nueva área…</option>
      </select>
      <input v-if="sel.areaId === NUEVA" v-model="sel.nuevaArea" :disabled="disabled" placeholder="Nombre del área nueva" class="mt-1 w-full p-2 border-2 border-amber-300 rounded-lg uppercase font-bold bg-amber-50">
    </div>
    <!-- 3 · LOCACIÓN -->
    <div>
      <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]"><span class="inline-flex w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] items-center justify-center mr-1">3</span><i class="fa-solid fa-location-dot text-emerald-600"></i> Locación</label>
      <select v-model="sel.locacionId" :disabled="disabled || !sel.areaId || sel.areaId === NUEVA" class="w-full p-2 border rounded-lg bg-white font-bold text-emerald-800 disabled:bg-slate-100">
        <option value="">{{ sel.areaId ? '-- Seleccionar --' : '(elige área)' }}</option>
        <option v-for="l in locacionesDe" :key="l.id" :value="l.id">{{ l.nombre }}</option>
        <option v-if="puedeCrear" :value="NUEVA">➕ Crear nueva locación…</option>
      </select>
      <input v-if="sel.locacionId === NUEVA" v-model="sel.nuevaLocacion" :disabled="disabled" placeholder="Nombre de la locación nueva" class="mt-1 w-full p-2 border-2 border-emerald-300 rounded-lg uppercase font-bold bg-emerald-50">
    </div>
  </div>
  <p v-if="selCompleta(sel)" class="text-[11px] text-slate-600">
    <i class="fa-solid fa-map-pin text-rose-500 mr-1"></i>Quedará en:
    <b class="text-slate-800">{{ n.empresa }} › {{ n.area }} › {{ n.locacion }}</b>
    <span v-if="selCreaAlgo(sel)" class="ml-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">se creará lo nuevo al guardar</span>
  </p>
</div>`;

export default {
  name: 'SelectorLocacion',
  props: {
    sel: { type: Object, required: true },
    disabled: { type: Boolean, default: false },
    puedeCrear: { type: Boolean, default: true },
    compacto: { type: Boolean, default: false }
  },
  template,
  setup(props) {
    const { computed } = Vue;
    // Siempre se lee props.sel (el formulario puede reemplazar el objeto)
    const areasDe = computed(() => { const s = props.sel; return s.empresaId && s.empresaId !== NUEVA ? hijos(s.empresaId) : []; });
    const locacionesDe = computed(() => { const s = props.sel; return s.areaId && s.areaId !== NUEVA ? hijos(s.areaId) : []; });
    const n = computed(() => nombresSel(props.sel));
    // Si se elige "crear nueva" en un nivel, los de abajo también son nuevos
    const cambioEmpresa = () => {
      const s = props.sel;
      s.areaId = s.empresaId === NUEVA ? NUEVA : '';
      s.locacionId = s.empresaId === NUEVA ? NUEVA : '';
      if (s.empresaId && s.empresaId !== NUEVA) {
        const as = hijos(s.empresaId);
        if (as.length === 1) { s.areaId = as[0].id; cambioArea(); }   // una sola área → se elige sola
      }
    };
    const cambioArea = () => {
      const s = props.sel;
      s.locacionId = s.areaId === NUEVA ? NUEVA : '';
      if (s.areaId && s.areaId !== NUEVA) {
        const ls = hijos(s.areaId);
        if (ls.length === 1) s.locacionId = ls[0].id;
      }
    };
    return { empresas, areasDe, locacionesDe, n, NUEVA, cambioEmpresa, cambioArea, selCompleta, selCreaAlgo, nodo };
  }
};
