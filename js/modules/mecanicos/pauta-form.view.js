// =====================================================================
// APP TÉCNICOS · Pasos 1-3 de la PAUTA DE MANTENCIÓN (2026-11-26)
//   1 Datos (horómetros, horas, tipo y frecuencia, ART / bloqueo) · 2 Pauta (Revisión / Reemplazo / N/A por ítem)
//   3 Repuestos y lubricantes (+ mediciones del generador) y observaciones · el paso 4 (firmas) es el de siempre.
// =====================================================================
import { ESTADOS_PAUTA, FRECUENCIAS, MEDICIONES_GEN, avancePauta, pautaPorClave } from './pautas.js';
import { ACEITES } from '../historial/historial.mapper.js';

const { computed, ref } = Vue;

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
    </div>
    <div class="bg-white rounded-2xl p-4 shadow-sm space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <label class="block"><span class="lbl">Fecha</span><input type="date" v-model="f.fecha" class="inp"></label>
        <label class="block"><span class="lbl">Horómetro actual</span><input v-model="f.horometro" inputmode="decimal" class="inp font-mono" placeholder="Ej: 10875"></label>
        <label class="block"><span class="lbl">Hora inicio</span><input type="time" v-model="f.hora_inicio" class="inp px-2"><button @click="f.hora_inicio = ahora()" class="text-[11px] font-bold text-emerald-700 mt-1">Ahora</button></label>
        <label class="block"><span class="lbl">Hora término</span><input type="time" v-model="f.hora_termino" class="inp px-2"><button @click="f.hora_termino = ahora()" class="text-[11px] font-bold text-emerald-700 mt-1">Ahora</button></label>
        <label class="block col-span-2"><span class="lbl">Horómetro próxima mantención</span><input v-model="pa.horometro_prox" inputmode="decimal" class="inp font-mono" :placeholder="sugerida ? 'Sugerido: ' + sugerida : 'Ej: 11125'">
          <button v-if="sugerida && !pa.horometro_prox" @click="pa.horometro_prox = String(sugerida)" class="text-[11px] font-bold text-emerald-700 mt-1">Usar {{ sugerida }}</button></label>
      </div>
      <label class="block"><span class="lbl">Empresa</span><input v-model="f.usuario_arriendo" class="inp uppercase"></label>
      <label class="block"><span class="lbl">Ubicación</span><input v-model="f.lugar" class="inp uppercase"></label>
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
      <div v-for="(x, i) in pa.filtros" :key="'f' + i" class="border rounded-xl p-2 space-y-1.5">
        <div class="flex gap-2"><input v-model="x.filtro" class="inp flex-1" placeholder="Filtro (ej. ACEITE MOTOR)"><button @click="pa.filtros.splice(i, 1)" class="w-9 text-rose-500"><i class="fa-solid fa-trash"></i></button></div>
        <div class="grid grid-cols-3 gap-2"><input v-model="x.marca" class="inp" placeholder="Marca"><input v-model="x.ref" class="inp font-mono" placeholder="Referencia"><input v-model="x.cant" inputmode="numeric" class="inp" placeholder="Cant."></div>
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
    const sugerida = computed(() => { const h = Number(String(props.f.horometro || '').replace(/\./g, '').replace(',', '.')); const fr = Number(pa.value?.frecuencia); return h > 0 && fr > 0 ? Math.round(h + fr) : null; });
    const marcarFaltantes = (e) => (pa.value?.items || []).forEach(i => { if (!i.e) i.e = e; });
    const ahora = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
    return { pa, secciones, av, abierta, tipos, sugerida, marcarFaltantes, ahora, ESTADOS_PAUTA, FRECUENCIAS, MEDICIONES_GEN, ACEITES };
  }
};
