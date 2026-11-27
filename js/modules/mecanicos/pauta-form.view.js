// =====================================================================
// APP TÉCNICOS · Pasos 1-3 de la PAUTA DE MANTENCIÓN (2026-11-26)
//   1 Datos (horómetros, horas, tipo y frecuencia, ART / bloqueo) · 2 Pauta (Revisión / Reemplazo / N/A por ítem)
//   3 Repuestos y lubricantes (+ mediciones del generador) y observaciones · el paso 4 (firmas) es el de siempre.
// =====================================================================
import { ESTADOS_PAUTA, FRECUENCIAS, MEDICIONES_GEN, avancePauta, pautaPorClave } from './pautas.js';
import { ACEITES } from '../historial/historial.mapper.js';
import { subirFotoDoc, subiendoFoto } from './mecanicos.service.js';
import { dbEquipos, dbLocaciones, dbFiltros, listaEmpresas, cargarDatosDesdeSupabase } from '../../core/store.js';
import { empresaDe, EMPRESA_TALLER } from '../inventario/inventario.mapper.js';
import { buscarEnCatalogo, listaTiposFiltro } from '../filtros/filtros.service.js';
import { claveModelo } from '../filtros/filtros.mapper.js';
import { mismoAfi } from '../../core/utils.js';

const { computed, ref, watch, onMounted } = Vue;
const OTRA = '__OTRA__';
const up = (v) => String(v || '').trim().toUpperCase();

export default {
  name: 'PautaMantencion',
  props: { f: { type: Object, required: true }, paso: { type: Number, default: 1 } },
  template: /* html */ `
<div v-if="pa">
  <!-- Paso 1: datos -->
  <section v-show="paso === 1" class="p-4 space-y-3" data-pauta="datos">
    <div class="bg-white rounded-2xl p-4 shadow-sm">
      <p class="text-[11px] font-black uppercase tracking-wide text-emerald-700">{{ pa.codigo }}</p>
      <h3 class="font-extrabold text-lg leading-tight">{{ pa.titulo }}</h3>
      <p class="text-xs text-slate-500">AFI {{ f.afi }} · {{ pa.marca_modelo || f.equipo }}</p>
      <p v-if="f.falla_id" class="text-xs font-bold text-amber-700 mt-1"><i class="fa-solid fa-link mr-1"></i>De la OT{{ f.ot_fallas_folio ? ' N° ' + f.ot_fallas_folio : '' }}: {{ f.falla_texto }} · al enviar queda reparada</p>
    </div>
    <div class="bg-white rounded-2xl p-4 shadow-sm space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <label class="block"><span class="lbl">Fecha</span><input type="date" v-model="f.fecha" class="inp"></label>
        <label class="block"><span class="lbl">Horómetro actual</span><input v-model="f.horometro" inputmode="decimal" class="inp font-mono" placeholder="Ej: 10875"></label>
        <label class="block"><span class="lbl">Hora inicio</span><input type="time" v-model="f.hora_inicio" class="inp px-2"><button @click="f.hora_inicio = ahora()" class="text-[11px] font-bold text-emerald-700 mt-1">Ahora</button></label>
        <label class="block"><span class="lbl">Hora término</span><input type="time" v-model="f.hora_termino" class="inp px-2"><button @click="f.hora_termino = ahora()" class="text-[11px] font-bold text-emerald-700 mt-1">Ahora</button></label>
        <label class="block col-span-2"><span class="lbl">Horómetro próxima mantención</span><input v-model="pa.horometro_prox" inputmode="decimal" class="inp font-mono" placeholder="Se calcula al poner el horómetro actual" data-pauta="prox">
          <span class="block text-[11px] text-slate-500 mt-1">Se suma solo: horómetro actual + frecuencia del equipo · <b>frecuencia {{ frecEquipo }} h</b></span></label>
      </div>
      <label class="block"><span class="lbl">Empresa</span>
        <select v-model="empresaSel" class="inp uppercase" data-pauta="empresa">
          <option value="">— Elegir empresa —</option>
          <optgroup v-if="empresasArriendo.length" label="Con equipos en arriendo"><option v-for="e in empresasArriendo" :key="'a' + e" :value="e">{{ e }}</option></optgroup>
          <optgroup v-if="empresasOtras.length" label="Otras registradas"><option v-for="e in empresasOtras" :key="'o' + e" :value="e">{{ e }}</option></optgroup>
          <option :value="OTRA">➕ Otra (escribirla)…</option>
        </select>
        <input v-if="otraEmpresa" v-model="f.usuario_arriendo" class="inp uppercase mt-2" placeholder="Nombre de la empresa" data-pauta="empresa-otra">
        <span v-if="otraEmpresa && f.usuario_arriendo" class="block text-[11px] text-emerald-700 mt-1">Se registra en la lista de empresas al enviar la pauta.</span></label>
      <label class="block"><span class="lbl">Ubicación</span>
        <select v-model="lugarSel" class="inp uppercase" data-pauta="lugar">
          <option value="">— Elegir ubicación —</option>
          <option v-for="l in ubicaciones" :key="l" :value="l">{{ l }}</option>
          <option :value="OTRA">➕ Otra (escribirla)…</option>
        </select>
        <input v-if="otroLugar" v-model="f.lugar" class="inp uppercase mt-2" placeholder="Ubicación"></label>
    </div>
    <div class="bg-white rounded-2xl p-4 shadow-sm space-y-3">
      <div><span class="lbl">Tipo de mantención</span>
        <div class="grid grid-cols-3 gap-2 mt-1"><button v-for="t in tipos" :key="t" @click="pa.tipo_mant = t" :class="['chip-lg text-sm', pa.tipo_mant === t ? 'on' : '']">{{ t }}</button></div></div>
      <div><span class="lbl">Frecuencia (horas)</span>
        <div class="grid grid-cols-5 gap-2 mt-1">
          <button v-for="h in FRECUENCIAS" :key="h" @click="pa.frecuencia = h" :class="['chip-lg text-sm', pa.frecuencia === h ? 'on' : '']">{{ h }}</button>
          <button @click="pa.frecuencia = ''" :class="['chip-lg text-sm', !pa.frecuencia ? 'on' : '']">—</button></div></div>
      <div class="grid grid-cols-2 gap-2">
        <button @click="f.uso_art = !f.uso_art" :class="['chip-lg', f.uso_art ? 'on' : '']"><i :class="['fa-solid mr-1', f.uso_art ? 'fa-square-check' : 'fa-square']"></i>Uso de A.R.T.</button>
        <button @click="f.bloqueo = !f.bloqueo" :class="['chip-lg', f.bloqueo ? 'on' : '']"><i :class="['fa-solid mr-1', f.bloqueo ? 'fa-square-check' : 'fa-square']"></i>Bloqueo de equipo</button>
      </div>
      <!-- Fotos de los papeles (igual que en las intervenciones) -->
      <div v-for="h in hojasFoto" :key="h.k" class="border-2 border-dashed rounded-xl p-2 flex items-center gap-3" :data-pauta="'foto-' + h.k">
        <img v-if="h.url" :src="h.url" class="w-16 h-20 object-cover rounded-lg border" alt="">
        <span v-else class="w-16 h-20 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-2xl"><i class="fa-solid fa-file-image"></i></span>
        <div class="flex-1"><b class="text-sm block">{{ h.titulo }}</b>
          <label class="inline-block mt-1 px-3 py-2 rounded-lg bg-[#1f4d3a] text-white text-xs font-bold cursor-pointer"><i :class="['fa-solid mr-1', subiendoFoto === h.cual + h.i ? 'fa-spinner fa-spin' : 'fa-camera']"></i>{{ h.url ? 'Cambiar foto' : 'Tomar / subir foto' }}
            <input type="file" accept="image/*" capture="environment" class="hidden" @change="e => subirFotoDoc(f, h.cual, h.i, e.target.files[0])"></label></div>
        <i v-if="h.url" class="fa-solid fa-circle-check text-emerald-600 text-xl"></i>
      </div>
      <p v-if="hojasFoto.length" class="text-[11px] text-slate-500"><i class="fa-solid fa-circle-info mr-1"></i>Los papeles se llenan a mano: saca una foto clara de cada hoja. Quedan en el PDF de la pauta.</p>
    </div>
  </section>

  <!-- Paso 2: pauta -->
  <section v-show="paso === 2" class="p-4 space-y-3" data-pauta="items">
    <div class="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
      <div class="flex-1"><div class="h-2 bg-slate-200 rounded-full overflow-hidden"><div class="h-full bg-emerald-500" :style="{ width: (av.total ? av.hechos / av.total * 100 : 0) + '%' }"></div></div>
        <p class="text-xs text-slate-500 mt-1"><b>{{ av.hechos }}/{{ av.total }}</b> ítems marcados · {{ av.reemp }} reemplazo(s)</p></div>
      <button @click="marcarFaltantes('REV')" class="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5" data-pauta="todo-rev">Lo que falta: Revisión</button>
    </div>
    <div v-for="s in secciones" :key="s.s" class="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button @click="abierta = abierta === s.s ? '' : s.s" class="w-full flex items-center justify-between px-4 py-3 bg-[#1f4d3a] text-white">
        <b class="text-sm tracking-wide">{{ s.s }}</b>
        <span class="text-xs font-bold">{{ s.items.filter(i => i.e).length }}/{{ s.items.length }} <i :class="['fa-solid ml-1', abierta === s.s || secciones.length === 1 ? 'fa-chevron-up' : 'fa-chevron-down']"></i></span>
      </button>
      <div v-show="abierta === s.s || secciones.length === 1" class="divide-y">
        <div v-for="it in s.items" :key="it.t" :class="['px-3 py-2.5', !it.e ? 'bg-amber-50/50' : '']">
          <p class="text-sm font-semibold text-slate-800 leading-snug mb-1.5">{{ it.t }}</p>
          <div class="grid grid-cols-3 gap-1.5">
            <button v-for="(lbl, k) in ESTADOS_PAUTA" :key="k" @click="it.e = it.e === k ? '' : k"
              :class="['py-2 rounded-lg border-2 text-xs font-extrabold', it.e === k ? (k === 'REEMP' ? 'bg-amber-500 border-amber-600 text-white' : k === 'NA' ? 'bg-slate-500 border-slate-600 text-white' : 'bg-emerald-600 border-emerald-700 text-white') : 'bg-white border-slate-200 text-slate-500']">{{ lbl }}</button>
          </div>
        </div>
        <button @click="s.items.forEach(i => { if (!i.e) i.e = 'REV'; })" class="w-full py-2 text-xs font-bold text-emerald-700">Marcar lo que falta de {{ s.s }} como Revisión</button>
      </div>
    </div>
  </section>

  <!-- Paso 3: repuestos, lubricantes, mediciones, observaciones -->
  <section v-show="paso === 3" class="p-4 space-y-3" data-pauta="repuestos">
    <div class="bg-white rounded-2xl p-4 shadow-sm space-y-2">
      <span class="lbl">Repuestos · filtros</span>
      <p class="text-[11px] text-slate-500 -mt-1">Escribe primero el código: si está en la base se completan el tipo y la marca (puedes cambiarlos). 366/492 = 366-492 = 366492.</p>
      <datalist id="pauta-tipos-filtro"><option v-for="t in listaTiposFiltro" :key="t" :value="t"></option></datalist>
      <div v-for="(x, i) in pa.filtros" :key="'f' + i" class="border rounded-xl p-2 space-y-1.5" data-pauta="filtro">
        <div class="flex gap-2"><input v-model="x.ref" @change="buscarCodigo(x)" class="inp flex-1 font-mono font-bold uppercase" placeholder="Código (ej. P550388)" data-pauta="filtro-cod"><button @click="pa.filtros.splice(i, 1)" class="w-9 text-rose-500"><i class="fa-solid fa-trash"></i></button></div>
        <p v-if="x.en_base === true" class="text-[11px] font-bold text-emerald-700"><i class="fa-solid fa-circle-check mr-1"></i>Código en la base: se completó tipo y marca</p>
        <p v-else-if="x.en_base === false" class="text-[11px] font-bold text-amber-700"><i class="fa-solid fa-circle-info mr-1"></i>Código nuevo: completa tipo y marca</p>
        <div class="grid grid-cols-5 gap-2"><input v-model="x.filtro" list="pauta-tipos-filtro" class="inp col-span-2 uppercase" placeholder="Tipo de filtro"><input v-model="x.marca" class="inp col-span-2 uppercase" placeholder="Marca"><input v-model="x.cant" inputmode="numeric" class="inp" placeholder="Cant."></div>
      </div>
      <button @click="pa.filtros.push({ filtro: '', marca: '', ref: '', cant: '' })" class="text-sm font-bold text-emerald-700"><i class="fa-solid fa-plus mr-1"></i>Agregar filtro</button>
    </div>
    <div class="bg-white rounded-2xl p-4 shadow-sm space-y-2">
      <span class="lbl">Lubricantes</span>
      <div v-for="(l, i) in pa.lubricantes" :key="'l' + i" class="border rounded-xl p-2 space-y-1.5">
        <div class="flex gap-2">
          <select v-model="l.key" @change="l.tipo = (ACEITES.find(a => a.key === l.key) || {}).label || l.tipo" class="inp flex-1 font-bold"><option value="">— Lubricante (lista) —</option><option v-for="a in ACEITES" :key="a.key" :value="a.key">{{ a.label }}</option></select>
          <button @click="pa.lubricantes.splice(i, 1)" class="w-9 text-rose-500"><i class="fa-solid fa-trash"></i></button></div>
        <input v-if="!l.key" v-model="l.tipo" class="inp" placeholder="Tipo (si no está en la lista)">
        <div class="grid grid-cols-4 gap-2"><input v-model="l.sae" class="inp" placeholder="SAE"><input v-model="l.api" class="inp" placeholder="API"><input v-model="l.marca" class="inp" placeholder="Marca"><input v-model="l.litros" inputmode="decimal" class="inp" placeholder="Litros"></div>
      </div>
      <button @click="pa.lubricantes.push({ key: '', tipo: '', sae: '', api: '', marca: '', litros: '' })" class="text-sm font-bold text-emerald-700"><i class="fa-solid fa-plus mr-1"></i>Agregar lubricante</button>
    </div>
    <div v-if="pa.mediciones" class="bg-white rounded-2xl p-4 shadow-sm">
      <span class="lbl">Mediciones del generador</span>
      <div class="grid grid-cols-2 gap-2 mt-1">
        <label v-for="m in MEDICIONES_GEN" :key="m[0]" class="block"><span class="text-[11px] font-bold text-slate-500">{{ m[1] }}</span><input v-model="pa.mediciones[m[0]]" :inputmode="m[0] === 'temp_ok' ? 'text' : 'decimal'" class="inp"></label>
      </div>
    </div>
    <div class="bg-white rounded-2xl p-4 shadow-sm">
      <span class="lbl">Observaciones</span>
      <textarea v-model="pa.observaciones" rows="4" class="inp" placeholder="Observaciones de la mantención"></textarea>
    </div>
  </section>
</div>`,
  setup(props) {
    const pa = computed(() => props.f.pauta);
    const secciones = computed(() => { const out = []; (pa.value?.items || []).forEach(i => { let s = out.find(x => x.s === i.s); if (!s) out.push(s = { s: i.s, items: [] }); s.items.push(i); }); return out; });
    const av = computed(() => avancePauta(pa.value));
    const abierta = ref('');
    const tipos = computed(() => (pautaPorClave(pa.value?.clave) || {}).tipos || ['PREVENTIVA', 'CORRECTIVA', 'PREDICTIVA']);
    // ---- Horómetro próxima mantención = actual + frecuencia del equipo (inventario, por defecto 250)
    const equipo = computed(() => dbEquipos.value.find(e => mismoAfi(e.afi, props.f.afi)) || null);
    const frecEquipo = computed(() => Number(pa.value?.frec_equipo) || Number(equipo.value?.frecuenciaMantencion) || 250);
    const sugerida = computed(() => { const h = Number(String(props.f.horometro || '').replace(/\./g, '').replace(',', '.')); return h > 0 ? Math.round(h + frecEquipo.value) : null; });
    watch(sugerida, (v) => { if (pa.value && v) pa.value.horometro_prox = String(v); });
    if (pa.value && sugerida.value && !pa.value.horometro_prox) pa.value.horometro_prox = String(sugerida.value);
    // ---- Empresa y ubicación: listas desplegables + "Otra"
    const empresasArriendo = computed(() => [...new Set(dbEquipos.value.map(e => up(empresaDe(e))).filter(e => e && e !== EMPRESA_TALLER))].sort());
    const empresasOtras = computed(() => listaEmpresas.value.map(up).filter(e => e && !empresasArriendo.value.includes(e)));
    const enListaEmp = (v) => empresasArriendo.value.includes(up(v)) || empresasOtras.value.includes(up(v));
    const otraEmpresa = ref(Boolean(props.f.usuario_arriendo) && !enListaEmp(props.f.usuario_arriendo));
    const empresaSel = computed({
      get: () => otraEmpresa.value ? OTRA : (enListaEmp(props.f.usuario_arriendo) ? up(props.f.usuario_arriendo) : ''),
      set: (v) => { if (v === OTRA) { otraEmpresa.value = true; props.f.usuario_arriendo = ''; } else { otraEmpresa.value = false; props.f.usuario_arriendo = v; } }
    });
    const ubicaciones = computed(() => {
      const emp = up(props.f.usuario_arriendo);
      const nodoEmp = emp ? dbLocaciones.value.find(n => n.tipo === 'EMPRESA' && up(n.nombre) === emp) : null;
      const deLoc = [];
      if (nodoEmp) { let cola = [nodoEmp.id]; while (cola.length) { const hijos = dbLocaciones.value.filter(n => cola.some(id => String(n.padreId ?? '') === String(id))); hijos.forEach(n => deLoc.push(up(n.nombre))); cola = hijos.map(n => n.id); } }
      const deEq = dbEquipos.value.filter(e => !emp || up(empresaDe(e)) === emp).map(e => up(e.ubicacion));
      return [...new Set(['TALLER FRC', ...deLoc, ...deEq].filter(Boolean))].sort((a, b) => (a === 'TALLER FRC' ? -1 : b === 'TALLER FRC' ? 1 : a.localeCompare(b)));
    });
    const otroLugar = ref(Boolean(props.f.lugar) && !ubicaciones.value.includes(up(props.f.lugar)));
    const lugarSel = computed({
      get: () => otroLugar.value ? OTRA : (ubicaciones.value.includes(up(props.f.lugar)) ? up(props.f.lugar) : ''),
      set: (v) => { if (v === OTRA) { otroLugar.value = true; props.f.lugar = ''; } else { otroLugar.value = false; props.f.lugar = v; } }
    });
    // ---- Fotos ART (2 hojas) y bloqueo
    const hojasFoto = computed(() => [
      ...(props.f.uso_art ? [0, 1].map(i => ({ k: 'art-' + i, cual: 'ART', i, titulo: `ART · hoja ${i + 1}`, url: (props.f.art_fotos || [])[i] || '' })) : []),
      ...(props.f.bloqueo ? [{ k: 'bloqueo', cual: 'BLOQUEO', i: 0, titulo: 'Registro de bloqueo (FRC-RE-OP-015)', url: props.f.bloqueo_foto || '' }] : [])
    ]);
    // ---- Filtros: código primero → completa tipo y marca desde la base (366/492 = 366492)
    const buscarCodigo = (x) => {
      if (!String(x.ref || '').trim()) { x.en_base = null; return; }
      const c = buscarEnCatalogo(x.ref);
      if (!c) { x.ref = up(x.ref); x.en_base = false; return; }
      const eq = equipo.value;
      const app = eq ? c.aplicaciones.find(a => claveModelo(a.equipoMarca, a.equipoModelo) === claveModelo(eq.marca, eq.modelo)) : null;
      x.ref = c.codigo; x.marca = c.marca || x.marca; x.filtro = (app ? app.tipo : c.tipo) || x.filtro; x.en_base = true;
    };
    onMounted(() => { const faltan = [!dbLocaciones.value.length && 'locaciones', !dbFiltros.value.length && 'filtros'].filter(Boolean); if (faltan.length) cargarDatosDesdeSupabase(faltan).catch(() => {}); });
    const marcarFaltantes = (e) => (pa.value?.items || []).forEach(i => { if (!i.e) i.e = e; });
    const ahora = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
    return { pa, secciones, av, abierta, tipos, sugerida, frecEquipo, marcarFaltantes, ahora, ESTADOS_PAUTA, FRECUENCIAS, MEDICIONES_GEN, ACEITES,
      OTRA, empresasArriendo, empresasOtras, otraEmpresa, empresaSel, ubicaciones, otroLugar, lugarSel, hojasFoto, subirFotoDoc, subiendoFoto, buscarCodigo, listaTiposFiltro };
  }
};
