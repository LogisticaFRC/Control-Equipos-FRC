// =====================================================================
// TALLER · Pestaña "OT enlazadas" (solo Admin): todas las OT enlazadas al taller
// de cualquier programa + bitácora de todo lo que se enlazó / quitó (bd_ot_enlaces).
// =====================================================================
import { isAdmin, puedeEditar } from '../../core/store.js';
import { formatDateForDisplay } from '../../core/utils.js';
import * as S from './taller.service.js';
import { dbEnlacesOT, cargarEnlacesOT, faltaTablaEnlaces, cargandoEnlaces, ACCIONES_ENLACE } from './enlaces.service.js';
import { irAOT, ESTILO_ESTADO_OT, estadoOT } from '../ot/ot.service.js';

const { ref, computed, onMounted } = Vue;

export default {
  name: 'OtEnlacesView',
  template: /* html */ `
  <section class="space-y-5">
    <div class="bg-slate-900 text-white rounded-2xl shadow-lg p-5 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-black tracking-tight flex items-center gap-3"><i class="fa-solid fa-link text-amber-400"></i> OT ENLAZADAS AL TALLER</h2>
        <p class="text-slate-400 text-sm mt-1">Todas las OT enlazadas (de todos los programas) y el historial de enlaces. Solo visible para el Admin.</p>
      </div>
      <button @click="recargar" :disabled="cargandoEnlaces" class="bg-white/10 hover:bg-white/20 border border-white/20 font-bold px-4 py-2 rounded-xl text-sm"><i :class="['fa-solid fa-rotate mr-1', cargandoEnlaces ? 'fa-spin' : '']"></i>Actualizar</button>
    </div>

    <!-- Todas las OT enlazadas -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-lg font-black text-slate-800"><i class="fa-solid fa-file-signature text-rose-600 mr-2"></i>Todas las OT enlazadas</h3>
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <select v-model="filtroProg" class="p-2 border rounded-lg font-bold">
            <option value="">Todos los programas</option>
            <option value="SIN">Sin programa</option>
            <option v-for="p in programasConOT" :key="p.id" :value="String(p.id)">{{ nombreProg(p) }}</option>
          </select>
          <input v-model="texto" type="text" placeholder="Folio o AFI..." class="p-2 border rounded-lg w-40">
          <span class="text-xs font-bold text-slate-500">{{ otsFiltradas.length }} OT</span>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-800 text-white text-[11px] uppercase"><tr><th class="p-3">Folio</th><th class="p-3">AFI</th><th class="p-3">Equipo</th><th class="p-3">Programa</th><th class="p-3">Dónde está</th><th class="p-3">Estado OT</th><th class="p-3">Enlazada</th><th class="p-3"></th></tr></thead>
          <tbody class="divide-y">
            <tr v-for="o in otsFiltradas" :key="o.id" class="hover:bg-slate-50">
              <td class="p-3 font-mono font-black text-rose-700">{{ o.folio }}</td>
              <td class="p-3 font-bold text-amber-800">{{ o.afi }}</td>
              <td class="p-3 text-slate-600">{{ o.equipo }} <span class="text-slate-400">{{ o.marca }} {{ o.modelo }}</span></td>
              <td class="p-3 text-xs font-semibold">{{ programaDeOT(o) }}</td>
              <td class="p-3"><span v-if="repPorId(o.reparacion_id)" :class="['text-xs font-bold px-2 py-0.5 rounded-full border', ESTILO_ESTADO[repPorId(o.reparacion_id).estado]]">{{ ubicacionRep(repPorId(o.reparacion_id)) }}</span></td>
              <td class="p-3"><span :class="['px-2 py-0.5 rounded-full border text-[10px] font-bold', ESTILO_ESTADO_OT[estadoOT(o)]]">{{ estadoOT(o) }}</span></td>
              <td class="p-3 text-xs text-slate-500 whitespace-nowrap">{{ ultimoEnlace(o) ? fechaHora(ultimoEnlace(o).created_at) + ' · ' + (ultimoEnlace(o).quien || '') : '—' }}</td>
              <td class="p-3 text-right whitespace-nowrap">
                <button @click="irAOT(o.folio)" class="px-2.5 py-1 rounded-lg border text-xs font-bold text-slate-600 hover:bg-slate-50"><i class="fa-solid fa-file-lines mr-1"></i>Formato</button>
                <button v-if="puedeEditar" @click="desenlazarOT(o)" title="Quitar del taller (la OT no se borra)" class="ml-1 px-2.5 py-1 rounded-lg border border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-50"><i class="fa-solid fa-link-slash mr-1"></i>Quitar</button>
              </td>
            </tr>
            <tr v-if="!otsFiltradas.length"><td colspan="8" class="p-6 text-center text-slate-400 italic">No hay OT enlazadas con este filtro.</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Historial de enlaces -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-lg font-black text-slate-800"><i class="fa-solid fa-clock-rotate-left text-indigo-600 mr-2"></i>Historial de enlaces</h3>
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <select v-model="filtroAccion" class="p-2 border rounded-lg font-bold">
            <option value="">Todas las acciones</option>
            <option v-for="(a, k) in ACCIONES_ENLACE" :key="k" :value="k">{{ a.label }}</option>
          </select>
          <input v-model="textoHist" type="text" placeholder="Folio, AFI, programa, usuario..." class="p-2 border rounded-lg w-56">
          <span class="text-xs font-bold text-slate-500">{{ historialFiltrado.length }} registros</span>
        </div>
      </div>
      <div v-if="faltaTablaEnlaces" class="m-4 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-3 text-sm font-semibold">
        <i class="fa-solid fa-triangle-exclamation mr-1"></i> Falta ejecutar <b>sql/ot_enlaces.sql</b> en Supabase (SQL Editor → Run). Desde ese momento cada enlace o quitada queda registrado aquí.
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-800 text-white text-[11px] uppercase"><tr><th class="p-3">Fecha y hora</th><th class="p-3">Acción</th><th class="p-3">Folio</th><th class="p-3">AFI</th><th class="p-3">Programa</th><th class="p-3">Nave</th><th class="p-3">Detalle</th><th class="p-3">Usuario</th></tr></thead>
          <tbody class="divide-y">
            <tr v-for="h in historialFiltrado" :key="h.id" class="hover:bg-slate-50">
              <td class="p-3 whitespace-nowrap font-semibold">{{ fechaHora(h.created_at) }}</td>
              <td class="p-3"><span :class="['px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap', (ACCIONES_ENLACE[h.accion] || {}).estilo]"><i :class="['fa-solid mr-1', (ACCIONES_ENLACE[h.accion] || {}).icon]"></i>{{ (ACCIONES_ENLACE[h.accion] || {}).label || h.accion }}</span></td>
              <td class="p-3 font-mono font-black text-rose-700">{{ h.folio }}</td>
              <td class="p-3 font-bold text-amber-800">{{ h.afi }}</td>
              <td class="p-3 text-xs font-semibold">{{ programaDeEnlace(h) }}</td>
              <td class="p-3 text-xs">{{ h.nave || '-' }}</td>
              <td class="p-3 text-xs text-slate-500">{{ h.detalle || '-' }}</td>
              <td class="p-3 text-xs text-slate-600 whitespace-nowrap">{{ h.quien || '-' }}</td>
            </tr>
            <tr v-if="!historialFiltrado.length && !faltaTablaEnlaces"><td colspan="8" class="p-6 text-center text-slate-400 italic">Sin movimientos registrados todavía (se registran desde que se ejecutó sql/ot_enlaces.sql).</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>`,
  setup() {
    const filtroProg = ref('');
    const texto = ref('');
    const filtroAccion = ref('');
    const textoHist = ref('');

    const recargar = async () => { await Promise.all([S.recargarTaller(), cargarEnlacesOT()]); };
    onMounted(recargar);

    const programaDeOT = (o) => {
      const r = S.repPorId(o.reparacion_id);
      if (!r) return 'Sin programa';
      return r.programa_id != null ? S.nombreProgId(r.programa_id) : 'Sin programa';
    };
    const programasConOT = computed(() => {
      const ids = new Set(S.otsTaller.value.map(o => S.repPorId(o.reparacion_id)?.programa_id).filter(v => v != null).map(String));
      return S.programasReparacion.value.filter(p => ids.has(String(p.id)));
    });
    const otsFiltradas = computed(() => {
      const q = texto.value.trim().toLowerCase();
      return S.otsTaller.value.filter(o => {
        const r = S.repPorId(o.reparacion_id);
        if (filtroProg.value === 'SIN' && r && r.programa_id != null) return false;
        if (filtroProg.value && filtroProg.value !== 'SIN' && String(r?.programa_id ?? '') !== filtroProg.value) return false;
        if (q && !`${o.folio} ${o.afi}`.toLowerCase().includes(q)) return false;
        return true;
      }).sort((a, b) => Number(b.folio) - Number(a.folio));
    });

    const programaDeEnlace = (h) => h.programa || (h.programa_id != null ? S.nombreProgId(h.programa_id) : (h.reparacion_id != null && S.repPorId(h.reparacion_id)?.programa_id != null ? S.nombreProgId(S.repPorId(h.reparacion_id).programa_id) : 'Sin programa'));
    const historialFiltrado = computed(() => {
      const q = textoHist.value.trim().toLowerCase();
      return dbEnlacesOT.value.filter(h => {
        if (filtroAccion.value && h.accion !== filtroAccion.value) return false;
        if (q && ![h.folio, h.afi, programaDeEnlace(h), h.quien, h.detalle, h.nave].join(' ').toLowerCase().includes(q)) return false;
        return true;
      });
    });
    const ultimoEnlace = (o) => dbEnlacesOT.value.find(h => String(h.ot_id) === String(o.id) && h.accion !== 'QUITADA') || null;
    const fechaHora = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };

    return {
      isAdmin, puedeEditar, formatDateForDisplay, irAOT, ESTILO_ESTADO_OT, estadoOT,
      repPorId: S.repPorId, ubicacionRep: S.ubicacionRep, ESTILO_ESTADO: S.ESTILO_ESTADO, nombreProg: S.nombreProg, desenlazarOT: S.desenlazarOT,
      dbEnlacesOT, faltaTablaEnlaces, cargandoEnlaces, ACCIONES_ENLACE,
      filtroProg, texto, filtroAccion, textoHist, recargar, programaDeOT, programasConOT, otsFiltradas,
      programaDeEnlace, historialFiltrado, ultimoEnlace, fechaHora
    };
  }
};
