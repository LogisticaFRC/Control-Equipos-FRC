// =====================================================================
// APP TÉCNICOS · MANTENCIÓN (modo TALLER) · 2026-11-16
// ---------------------------------------------------------------------
// El técnico de taller elige un equipo que está en una NAVE y el tipo de mantención, y le aparecen:
//   1) Formato / pauta de mantención   2) Registro de bloqueo   3) ART
// Los documentos se toman del módulo FORMATOS (Operaciones): cuando el Admin los sube ahí, aparecen solos.
// El registro de bloqueo también se puede bajar en blanco (formato del sistema FRC-RE-OP-015).
// Horómetro: solo se actualiza en equipos que están dentro de una nave.
// =====================================================================
import * as M from './mecanicos.service.js';
import * as T from '../taller/taller.service.js';
import { dbFormatos, dbEquipos, cargarDatosDesdeSupabase } from '../../core/store.js';
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { hoyISO, mismoAfi, formatDateForDisplay } from '../../core/utils.js';

const { ref, computed, onMounted, watch } = Vue;

const TIPOS = ['250 HRS', '500 HRS', '1000 HRS', 'INTERMEDIA', 'OTRA'];
const docs = () => dbFormatos.value.filter(d => d && d.nombre !== '__CARPETA__' && d.link);
const up = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default {
  name: 'MantencionTaller',
  template: /* html */ `
<div class="p-4 space-y-3">
  <!-- Equipo -->
  <div class="bg-white rounded-2xl shadow-sm p-4 space-y-2">
    <div class="lbl"><i class="fa-solid fa-oil-can mr-1"></i>Ingresar mantención</div>
    <select v-model="M.mantAfi.value" class="inp font-bold">
      <option value="">— Elige el equipo (en nave) —</option>
      <option v-for="r in enNaves" :key="r.id" :value="r.afi">{{ r.nave }} · AFI {{ r.afi }} · {{ T.descEquipo(r.afi) }}</option>
    </select>
    <p v-if="!enNaves.length" class="text-sm text-slate-500">No hay equipos dentro de las naves. Ingrésalos desde la pestaña <b>Taller</b>.</p>
    <div v-if="eq" class="flex flex-wrap gap-1.5">
      <button v-for="t in TIPOS" :key="t" @click="tipo = t" :class="['px-3 py-2 rounded-xl text-sm font-black border-2', tipo === t ? 'bg-[#1f4d3a] text-white border-[#1f4d3a]' : 'bg-white text-slate-600 border-slate-200']">{{ t }}</button>
    </div>
  </div>

  <template v-if="eq">
    <!-- Horómetro (solo equipos en nave) -->
    <div class="bg-white rounded-2xl shadow-sm p-4">
      <div class="flex items-end justify-between"><div class="lbl"><i class="fa-solid fa-gauge-high mr-1"></i>Horómetro · AFI {{ eq.afi }}</div><div class="text-xs text-slate-500">Último: <b class="font-mono">{{ fmtH(eq.horometros?.hTomado) }}</b></div></div>
      <div class="flex gap-2 mt-1"><input v-model="horo.valor" inputmode="decimal" class="inp flex-1 font-mono text-lg" placeholder="Horómetro actual"><input type="date" v-model="horo.fecha" class="inp w-36 px-2"></div>
      <button @click="guardarHoro" :disabled="guardando || !horo.valor" class="mt-2 w-full py-3 rounded-xl bg-[#1f4d3a] text-white font-extrabold disabled:opacity-40"><i :class="['fa-solid mr-1', guardando ? 'fa-spinner fa-spin' : 'fa-floppy-disk']"></i>Guardar horómetro</button>
    </div>

    <!-- Documentos de la mantención -->
    <div v-for="b in bloques" :key="b.key" class="bg-white rounded-2xl shadow-sm p-4 space-y-2">
      <div class="flex items-center gap-3">
        <span :class="['w-11 h-11 rounded-xl flex items-center justify-center text-xl', b.color]"><i :class="['fa-solid', b.icon]"></i></span>
        <div class="flex-1"><b class="block">{{ b.titulo }}</b><span class="text-xs text-slate-500">{{ b.sub }}</span></div>
      </div>
      <a v-for="d in b.docs" :key="d.id" :href="d.link" target="_blank" rel="noopener" class="flex items-center gap-2 p-3 rounded-xl border-2 border-slate-200 hover:border-emerald-400 font-bold text-sm text-slate-700">
        <i class="fa-solid fa-file-arrow-down text-rose-600"></i><span class="flex-1 truncate">{{ d.nombre }}</span><i class="fa-solid fa-arrow-up-right-from-square text-slate-400 text-xs"></i>
      </a>
      <button v-if="b.key === 'BLOQUEO'" @click="M.descargarFormatoVacio('BLOQUEO')" class="w-full p-3 rounded-xl border-2 border-dashed border-amber-300 text-amber-800 font-bold text-sm"><i class="fa-solid fa-lock mr-1"></i>Registro de bloqueo FRC-RE-OP-015 (en blanco, PDF)</button>
      <p v-if="!b.docs.length && b.key !== 'BLOQUEO'" class="text-sm bg-slate-50 rounded-xl p-3 text-slate-500"><i class="fa-solid fa-hourglass-half mr-1"></i>Aún no está subido. Cuando Operaciones lo suba en <b>Formatos</b>, aparece aquí.</p>
    </div>
  </template>
</div>`,
  setup() {
    const tipo = ref('250 HRS');
    const horo = ref({ valor: '', fecha: hoyISO() });
    const guardando = ref(false);
    const enNaves = computed(() => T.NAVES.flatMap(n => T.repsEnNave(n)));
    const eq = computed(() => (M.mantAfi.value ? dbEquipos.value.find(e => mismoAfi(e.afi, M.mantAfi.value)) || null : null));
    watch(() => M.mantAfi.value, () => { horo.value = { valor: '', fecha: hoyISO() }; });
    const fmtH = (h) => (Number(h) > 0 ? Number(h).toLocaleString('es-CL') + ' h' : '—');

    const bloques = computed(() => {
      const t = up(tipo.value).replace(' HRS', '');
      const pautas = docs().filter(d => /PAUTA|MANTENC/.test(up(d.nombre)))
        .sort((a, b) => (up(b.nombre).includes(t) - up(a.nombre).includes(t)));
      return [
        { key: 'PAUTA', titulo: 'Formato de mantención · ' + tipo.value, sub: 'Pauta / check list de la mantención', icon: 'fa-clipboard-check', color: 'bg-emerald-100 text-emerald-700', docs: pautas },
        { key: 'BLOQUEO', titulo: 'Libro / registro de bloqueo', sub: 'Antes de intervenir el equipo', icon: 'fa-lock', color: 'bg-amber-100 text-amber-700', docs: docs().filter(d => /BLOQUEO|OP-015/.test(up(d.nombre))) },
        { key: 'ART', titulo: 'ART · Análisis de riesgo del trabajo', sub: 'Antes de comenzar', icon: 'fa-helmet-safety', color: 'bg-sky-100 text-sky-700', docs: docs().filter(d => /\bA\.?R\.?T\b|ANALISIS (SEGURO|DE RIESGO)/.test(up(d.nombre))) }
      ];
    });

    const guardarHoro = async () => {
      const e = eq.value; if (!e) return;
      if (!T.naveDeAfi(e.afi)) return alert('Solo se actualiza el horómetro de equipos que están en una nave.');
      const v = Number(String(horo.value.valor).replace(/\./g, '').replace(',', '.'));
      if (!(v > 0)) return alert('Escribe el horómetro (solo números).');
      const actual = Number(e.horometros?.hTomado) || 0;
      if (actual && v < actual && !confirm(`El horómetro ${v.toLocaleString('es-CL')} es MENOR que el último (${actual.toLocaleString('es-CL')}). ¿Guardar igual?`)) return;
      guardando.value = true;
      try {
        await sb(supabaseClient.rpc('frc_mec_horometro', { p_afi: String(e.afi), p_horometro: v, p_fecha: horo.value.fecha || hoyISO() }));
        await cargarDatosDesdeSupabase(['inventario']);
        horo.value = { valor: '', fecha: hoyISO() };
        M.avisoApp('Horómetro actualizado ✔');
      } catch (err) { alert('No se pudo guardar: ' + errMsg(err)); }
      finally { guardando.value = false; }
    };

    onMounted(() => { T.recargarTaller(); if (!dbFormatos.value.length) cargarDatosDesdeSupabase(['formatos']).catch(() => {}); });
    return { M, T, TIPOS, tipo, horo, guardando, enNaves, eq, fmtH, bloques, guardarHoro, formatDateForDisplay };
  }
};
