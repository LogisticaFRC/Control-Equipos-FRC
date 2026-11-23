// =====================================================================
// PROGRAMAS REPARACIÓN · Pestaña "Interferencias" (2026-11-23)
// Registro diario de razones / problemas que demoraron las reparaciones del programa.
// Salen en el Excel del programa (hoja "Interferencias").
// =====================================================================
import * as I from './interferencias.service.js';
import { obtenerItemsPrograma } from './programas.service.js';
import { puedeEditar, isAdmin, obtenerDetalleEquipoPorAfi } from '../../core/store.js';
import { formatDateForDisplay, hoyISO } from '../../core/utils.js';

const { ref, computed, watch } = Vue;

export default {
  name: 'InterferenciasPrograma',
  props: { prog: { type: Object, required: true } },
  template: /* html */ `
  <div class="flex-grow overflow-y-auto space-y-4">
    <div v-if="faltaTablaInterferencias" class="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-xs font-bold">
      <i class="fa-solid fa-triangle-exclamation mr-1"></i> Falta crear la tabla en Supabase: ejecuta <span class="font-mono">sql/programa_interferencias.sql</span> en el SQL Editor.
    </div>

    <!-- Formulario -->
    <div v-if="puedeEditar" class="border rounded-xl p-3 bg-amber-50/60 border-amber-200 space-y-2">
      <p class="text-xs font-extrabold text-amber-900 uppercase"><i class="fa-solid fa-triangle-exclamation mr-1"></i> {{ form.id ? 'Editar interferencia' : 'Registrar interferencia del día' }}</p>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
        <label class="text-[10px] font-bold text-slate-600 uppercase">Fecha
          <input type="date" v-model="form.fecha" :max="hoy" class="mt-0.5 w-full p-2 border rounded-lg text-xs font-mono bg-white">
        </label>
        <label class="text-[10px] font-bold text-slate-600 uppercase">Equipo
          <select v-model="form.afi" class="mt-0.5 w-full p-2 border rounded-lg text-xs bg-white">
            <option value="">GENERAL (todo el programa)</option>
            <option v-for="e in equipos" :key="e.afi" :value="e.afi">AFI {{ e.afi }} · {{ e.tipo }} · {{ e.nave }}</option>
          </select>
        </label>
        <label class="text-[10px] font-bold text-slate-600 uppercase">Tipo de interferencia
          <select v-model="form.categoria" class="mt-0.5 w-full p-2 border rounded-lg text-xs bg-white">
            <option value="" disabled>Elegir…</option>
            <option v-for="c in CATEGORIAS_INTERFERENCIA" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
        <label class="text-[10px] font-bold text-slate-600 uppercase">Horas perdidas (opcional)
          <input type="number" min="0" step="0.5" v-model="form.horas_perdidas" placeholder="Ej: 4" class="mt-0.5 w-full p-2 border rounded-lg text-xs bg-white">
        </label>
      </div>
      <textarea v-model="form.descripcion" rows="2" placeholder="¿Qué pasó? Ej: No llegó el kit de empaquetaduras del motor; se espera para el jueves." class="w-full p-2 border rounded-lg text-xs bg-white"></textarea>
      <div class="flex items-center gap-2 justify-end">
        <span v-if="error" class="text-[11px] font-bold text-rose-600 mr-auto whitespace-pre-line">{{ error }}</span>
        <button v-if="form.id" @click="limpiar" class="bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg">Cancelar</button>
        <button @click="guardar" :disabled="guardando" class="bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow flex items-center gap-1.5">
          <i :class="['fa-solid', guardando ? 'fa-spinner fa-spin' : 'fa-floppy-disk']"></i> {{ form.id ? 'Guardar cambios' : 'Registrar' }}
        </button>
      </div>
    </div>

    <!-- Resumen por tipo -->
    <div v-if="lista.length" class="flex flex-wrap items-center gap-1.5">
      <span class="text-[10px] font-bold text-slate-500 uppercase mr-1">{{ lista.length }} interferencias · {{ diasConInterferencia }} día(s){{ totalHoras ? ' · ' + totalHoras + ' h perdidas' : '' }}:</span>
      <button v-for="r in resumen" :key="r.categoria" @click="filtroCat = filtroCat === r.categoria ? '' : r.categoria"
        :class="['text-[10px] font-bold px-2 py-0.5 rounded-full border', colorCategoria(r.categoria), filtroCat === r.categoria ? 'ring-2 ring-offset-1 ring-slate-500' : '']">
        {{ r.categoria }} ({{ r.n }}{{ r.horas ? ' · ' + r.horas + ' h' : '' }})
      </button>
      <select v-model="filtroAfi" class="ml-auto p-1 border rounded text-[11px]">
        <option value="">Todos los equipos</option>
        <option value="__GENERAL__">Solo generales</option>
        <option v-for="e in equipos" :key="e.afi" :value="e.afi">AFI {{ e.afi }}</option>
      </select>
    </div>

    <div v-if="cargandoInterferencias && !lista.length" class="text-center p-6 text-slate-400 text-xs"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Cargando…</div>
    <div v-else-if="!lista.length" class="text-center p-10 text-slate-400 font-bold text-sm">Sin interferencias registradas en este programa.</div>

    <!-- Lista por día -->
    <div v-for="g in porDia" :key="g.fecha" class="border rounded-xl overflow-hidden">
      <div class="bg-slate-800 text-white px-3 py-1.5 text-xs font-extrabold flex justify-between">
        <span><i class="fa-solid fa-calendar-day mr-1.5 text-amber-400"></i>{{ fechaLarga(g.fecha) }}</span>
        <span class="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded">{{ g.items.length }}</span>
      </div>
      <div class="divide-y">
        <div v-for="i in g.items" :key="i.id" class="p-2.5 flex items-start gap-3 text-xs bg-white">
          <div class="w-28 shrink-0">
            <span v-if="i.afi" class="font-bold text-amber-700">AFI {{ i.afi }}</span>
            <span v-else class="font-bold text-slate-500">GENERAL</span>
            <span v-if="i.nave" class="block text-[9px] text-slate-500">{{ i.nave }}</span>
          </div>
          <div class="flex-grow">
            <span :class="['inline-block text-[9px] font-bold px-2 py-0.5 rounded-full border mb-1', colorCategoria(i.categoria)]">{{ i.categoria }}</span>
            <p class="text-slate-800 whitespace-pre-line">{{ i.descripcion }}</p>
            <p class="text-[9px] text-slate-400 mt-0.5">{{ i.usuario || '' }}<span v-if="i.horas_perdidas != null"> · {{ i.horas_perdidas }} h perdidas</span></p>
          </div>
          <div v-if="puedeEditar" class="shrink-0 whitespace-nowrap">
            <button @click="editar(i)" class="text-blue-600 hover:text-blue-800 p-1" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
            <button @click="borrar(i)" class="text-rose-500 hover:text-rose-700 p-1" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>
    </div>
  </div>`,
  setup(props) {
    const hoy = hoyISO();
    const form = ref(I.nuevaInterferencia());
    const guardando = ref(false);
    const error = ref('');
    const filtroCat = ref('');
    const filtroAfi = ref('');

    const cargar = () => { if (props.prog && props.prog.id) I.cargarInterferencias(props.prog.id); };
    watch(() => props.prog && props.prog.id, cargar, { immediate: true });

    const equipos = computed(() => {
      const vistos = new Set();
      return obtenerItemsPrograma(props.prog.id).filter(it => { const k = String(it.afi); if (vistos.has(k)) return false; vistos.add(k); return true; })
        .map(it => ({ afi: it.afi, nave: it.nave || 'NAVE 1', tipo: obtenerDetalleEquipoPorAfi(it.afi, 'tipo') || '' }));
    });
    const todas = computed(() => I.interferenciasDe(props.prog.id));
    const lista = computed(() => todas.value.filter(i =>
      (!filtroCat.value || i.categoria === filtroCat.value) &&
      (!filtroAfi.value || (filtroAfi.value === '__GENERAL__' ? !i.afi : String(i.afi) === String(filtroAfi.value)))));
    const resumen = computed(() => I.resumenInterferencias(todas.value));
    const totalHoras = computed(() => lista.value.reduce((s, i) => s + (Number(i.horas_perdidas) || 0), 0));
    const diasConInterferencia = computed(() => new Set(lista.value.map(i => i.fecha)).size);
    const porDia = computed(() => {
      const m = new Map();
      lista.value.forEach(i => { if (!m.has(i.fecha)) m.set(i.fecha, []); m.get(i.fecha).push(i); });
      return Array.from(m, ([fecha, items]) => ({ fecha, items }));
    });
    const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const fechaLarga = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return y ? `${DIAS[new Date(y, m - 1, d).getDay()]} ${formatDateForDisplay(iso)}` : iso; };

    const limpiar = () => { form.value = I.nuevaInterferencia(); error.value = ''; };
    const guardar = async () => {
      error.value = '';
      guardando.value = true;
      try {
        const eq = equipos.value.find(e => String(e.afi) === String(form.value.afi));
        await I.guardarInterferencia(props.prog.id, { ...form.value, nave: eq ? eq.nave : null });
        limpiar();
      } catch (err) { error.value = (err && err.message) || String(err); }
      finally { guardando.value = false; }
    };
    const editar = (i) => {
      form.value = { id: i.id, fecha: i.fecha, afi: i.afi || '', categoria: i.categoria, descripcion: i.descripcion, horas_perdidas: i.horas_perdidas ?? '' };
      error.value = '';
    };
    const borrar = async (i) => {
      if (!confirm(`¿Eliminar esta interferencia del ${formatDateForDisplay(i.fecha)}?`)) return;
      try { await I.eliminarInterferencia(props.prog.id, i.id); } catch (err) { alert('No se pudo eliminar: ' + ((err && err.message) || err)); }
    };

    return {
      hoy, form, guardando, error, filtroCat, filtroAfi, equipos, lista, resumen, totalHoras, diasConInterferencia, porDia, fechaLarga,
      limpiar, guardar, editar, borrar, puedeEditar, isAdmin,
      CATEGORIAS_INTERFERENCIA: I.CATEGORIAS_INTERFERENCIA, colorCategoria: I.colorCategoria,
      cargandoInterferencias: I.cargandoInterferencias, faltaTablaInterferencias: I.faltaTablaInterferencias
    };
  }
};
