// =====================================================================
// TERRENO CRTG · pantallas de la app (2026-11-17) · ver crtg.service.js
// =====================================================================
import * as K from './crtg.service.js';
import * as S from './mecanicos.service.js';
import * as CH from './chofer.service.js';
import { LugarSelect } from './chofer-checklist.view.js';
import { buscarEquipoPorAfi } from '../../core/store.js';
import { formatDateForDisplay } from '../../core/utils.js';

const { ref, computed, onMounted, watch } = Vue;

/** Programa de mantención CRTG (resumido): el técnico marca Realizado / No realizado. */
export const CrtgPrograma = {
  name: 'CrtgPrograma',
  template: /* html */ `
<section class="p-4 space-y-3">
  <div v-if="!K.programasCrtg.value.length" class="bg-white rounded-2xl shadow-sm p-5 text-center text-slate-500 text-sm">
    <img :src="K.LOGO_CRTG" class="h-10 mx-auto mb-2 opacity-70">No hay un programa de mantención de CRTG cargado.<br><span class="text-xs">(Operaciones lo crea en Programas Mantención con "CRTG" en el nombre.)</span>
  </div>
  <template v-else>
    <div class="bg-white rounded-2xl shadow-sm p-4 space-y-2">
      <div class="flex items-center gap-3">
        <img :src="K.LOGO_CRTG" class="h-9 w-9 object-contain">
        <div class="flex-1 min-w-0">
          <p class="font-black text-slate-800 leading-tight">Programa de mantención CRTG</p>
          <select v-if="K.programasCrtg.value.length > 1" :value="K.programaCrtg.value.id" @change="K.progCrtgSel.value = Number($event.target.value)" class="text-xs font-bold border rounded-lg px-2 py-1 mt-0.5">
            <option v-for="p in K.programasCrtg.value" :key="p.id" :value="p.id">{{ p.nombre_programa || p.mes }}{{ p.vigente ? ' · vigente' : '' }}</option>
          </select>
          <p v-else class="text-xs text-slate-500">{{ K.programaCrtg.value.nombre_programa || K.programaCrtg.value.mes }} · {{ formatDateForDisplay(K.programaCrtg.value.fecha_inicio_programa) }} al {{ formatDateForDisplay(K.programaCrtg.value.fecha_termino_programa) }}</p>
        </div>
        <span class="text-2xl font-black text-sky-700">{{ K.resumenCrtg.value.pct }}%</span>
      </div>
      <div class="h-2 bg-slate-200 rounded-full overflow-hidden"><div class="h-2 bg-emerald-500" :style="{ width: K.resumenCrtg.value.pct + '%' }"></div></div>
      <div class="grid grid-cols-3 gap-2 text-center text-xs">
        <div class="bg-emerald-50 rounded-lg py-1.5"><b class="block text-lg text-emerald-700">{{ K.resumenCrtg.value.ok }}</b>Realizados</div>
        <div class="bg-amber-50 rounded-lg py-1.5"><b class="block text-lg text-amber-700">{{ K.resumenCrtg.value.pend }}</b>Pendientes</div>
        <div class="bg-rose-50 rounded-lg py-1.5"><b class="block text-lg text-rose-700">{{ K.resumenCrtg.value.no }}</b>No realizados</div>
      </div>
    </div>
    <div v-for="i in K.itemsCrtg.value" :key="i.id" class="bg-white rounded-2xl shadow-sm p-4 space-y-2" :data-item="i.afi">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="font-black text-slate-800"><span class="font-mono text-sky-800">AFI {{ i.afi }}</span> <span class="text-sm font-bold text-slate-600">{{ eq(i.afi).tipo }}</span></p>
          <p class="text-xs text-slate-500">{{ i.tipo }} · {{ formatDateForDisplay(i.fecha_programada) }}</p>
        </div>
        <span v-if="i.realizado" class="text-[10px] font-black bg-emerald-600 text-white rounded-full px-2 py-0.5 whitespace-nowrap">REALIZADO ✔</span>
        <span v-else-if="i.crtg_estado === 'REALIZADO'" class="text-[10px] font-black bg-emerald-100 text-emerald-800 rounded-full px-2 py-0.5 whitespace-nowrap">Reportado realizado</span>
        <span v-else-if="i.crtg_estado === 'NO_REALIZADO'" class="text-[10px] font-black bg-rose-100 text-rose-800 rounded-full px-2 py-0.5 whitespace-nowrap">No realizado</span>
        <span v-else class="text-[10px] font-black bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">Pendiente</span>
      </div>
      <p v-if="i.crtg_obs" class="text-xs bg-slate-50 rounded-lg px-2 py-1">{{ i.crtg_obs }}</p>
      <div v-if="!i.realizado" class="grid grid-cols-2 gap-2">
        <button @click="marcar(i, 'REALIZADO')" :class="['py-2.5 rounded-xl border-2 font-black text-sm', i.crtg_estado === 'REALIZADO' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-200']" data-crtg="ok"><i class="fa-solid fa-check mr-1"></i>Realizado</button>
        <button @click="marcar(i, 'NO_REALIZADO')" :class="['py-2.5 rounded-xl border-2 font-black text-sm', i.crtg_estado === 'NO_REALIZADO' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-700 border-rose-200']"><i class="fa-solid fa-xmark mr-1"></i>No realizado</button>
      </div>
      <p v-else class="text-[11px] text-emerald-700 font-bold">Confirmado por Operaciones.</p>
    </div>
  </template>
</section>`,
  setup() {
    const eq = (afi) => buscarEquipoPorAfi(afi) || {};
    const marcar = async (i, estado) => {
      if (i.crtg_estado === estado) { if (confirm('¿Quitar lo marcado?')) await K.reportarItemCrtg(i, null); return; }
      const obs = estado === 'NO_REALIZADO' ? (prompt('¿Por qué no se realizó? (opcional)') || '') : '';
      await K.reportarItemCrtg(i, estado, obs);
    };
    return { K, eq, marcar, formatDateForDisplay };
  }
};

/** Pedir repuestos (equipo, fecha, descripción, hasta 5 fotos) + mis pedidos. */
export const CrtgPedido = {
  name: 'CrtgPedido',
  template: /* html */ `
<section class="p-4 space-y-3">
  <div class="bg-white rounded-2xl shadow-sm p-4 space-y-3">
    <p class="lbl"><i class="fa-solid fa-cart-plus mr-1"></i>Nuevo pedido de repuestos</p>
    <label class="block"><span class="text-[10px] font-bold text-slate-400">EQUIPO</span>
      <select v-model="f.afi" class="inp font-bold" data-crtg="afi">
        <option value="" disabled>Elige el equipo…</option>
        <option v-for="e in S.equiposApp.value" :key="e.id" :value="e.afi">AFI {{ e.afi }} · {{ e.tipo }} {{ e.marca }} {{ e.modelo }}</option>
      </select></label>
    <div v-if="selEq" class="flex items-center gap-3 bg-slate-50 rounded-xl p-2" data-crtg="eqsel">
      <span class="w-14 h-14 rounded-lg bg-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center"><img v-if="selEq.foto" :src="selEq.foto" alt="" class="w-full h-full object-cover"><i v-else class="fa-solid fa-truck-monster text-slate-400"></i></span>
      <div class="min-w-0 text-sm"><b class="text-[#1f4d3a]">AFI {{ selEq.afi }}</b> {{ selEq.tipo }}<div class="text-xs text-slate-500 truncate">{{ selEq.marca }} {{ selEq.modelo }} · {{ selEq.ubicacion || '—' }}</div></div>
    </div>
    <label class="block"><span class="text-[10px] font-bold text-slate-400">FECHA</span><input type="date" v-model="f.fecha" class="inp"></label>
    <label class="block"><span class="text-[10px] font-bold text-slate-400">¿QUÉ REPUESTO NECESITAS?</span>
      <textarea v-model="f.descripcion" rows="3" class="inp" placeholder="Ej: filtro de aire, 2 correas del alternador…" data-crtg="desc"></textarea></label>
    <div>
      <span class="text-[10px] font-bold text-slate-400">FOTOS ({{ f.fotos.length }}/{{ K.MAX_FOTOS_PEDIDO }})</span>
      <div class="flex flex-wrap gap-2 mt-1">
        <img v-for="(p, i) in f.fotos" :key="i" :src="p.url" @click="f.fotos.splice(i, 1)" title="Toca para quitar" class="w-20 h-20 object-cover rounded-xl border">
        <label v-if="f.fotos.length < K.MAX_FOTOS_PEDIDO" class="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 flex flex-col items-center justify-center text-[11px] font-bold">
          <i class="fa-solid fa-camera text-xl"></i>Agregar
          <input type="file" accept="image/*" capture="environment" multiple class="hidden" @change="agregarFotos" data-crtg="fotos">
        </label>
      </div>
    </div>
    <button @click="enviar" :disabled="K.enviandoPedido.value" class="w-full py-3.5 rounded-2xl bg-sky-600 text-white font-extrabold text-lg disabled:opacity-60" data-crtg="enviar">
      <i :class="['fa-solid mr-1', K.enviandoPedido.value ? 'fa-spinner fa-spin' : 'fa-paper-plane']"></i>{{ K.enviandoPedido.value ? 'Enviando…' : 'Enviar pedido' }}</button>
  </div>
  <p class="lbl pt-1">Mis pedidos</p>
  <div v-for="p in K.misPedidos.value" :key="p.id" class="bg-white rounded-2xl shadow-sm p-3 space-y-1">
    <div class="flex items-start justify-between gap-2">
      <p class="font-black text-slate-800"><span class="font-mono text-sky-800">AFI {{ p.afi }}</span> <span class="text-xs text-slate-500">{{ formatDateForDisplay(p.fecha) }}</span></p>
      <span :class="['text-[10px] font-black rounded-full px-2 py-0.5 border', (K.ESTADOS_PEDIDO[p.estado] || K.ESTADOS_PEDIDO.PENDIENTE).c]">{{ (K.ESTADOS_PEDIDO[p.estado] || K.ESTADOS_PEDIDO.PENDIENTE).l }}</span>
    </div>
    <p class="text-sm text-slate-700 whitespace-pre-line">{{ p.descripcion }}</p>
    <div v-if="(p.fotos || []).length" class="flex gap-1"><a v-for="(u, i) in p.fotos" :key="i" :href="u" target="_blank" rel="noopener"><img :src="u" class="w-12 h-12 object-cover rounded-lg border"></a></div>
    <p v-if="p.fecha_aprox" class="text-xs font-bold text-sky-800"><i class="fa-regular fa-calendar mr-1"></i>Llega aprox.: {{ formatDateForDisplay(p.fecha_aprox) }}</p>
    <p v-if="p.nota" class="text-xs bg-slate-50 rounded-lg px-2 py-1"><b>Nota:</b> {{ p.nota }}</p>
  </div>
  <p v-if="!K.misPedidos.value.length" class="text-center text-slate-400 py-6 text-sm">Aún no pides repuestos.</p>
</section>`,
  setup() {
    const f = ref(K.pedidoVacio(K.afiPedido.value || S.equipoSel.value?.afi || '')); K.afiPedido.value = '';
    watch(K.afiPedido, (a) => { if (a) { f.value.afi = a; K.afiPedido.value = ''; } });
    const selEq = computed(() => f.value.afi ? buscarEquipoPorAfi(f.value.afi) : null);
    const agregarFotos = (e) => {
      const files = [...(e.target.files || [])]; e.target.value = '';
      files.slice(0, K.MAX_FOTOS_PEDIDO - f.value.fotos.length).forEach(file => f.value.fotos.push({ file, url: URL.createObjectURL(file) }));
      if (files.length > K.MAX_FOTOS_PEDIDO) alert(`Máximo ${K.MAX_FOTOS_PEDIDO} fotos.`);
    };
    const enviar = async () => { if (await K.enviarPedido(f.value)) { S.avisoApp('Pedido enviado ✔'); f.value = K.pedidoVacio(); } };
    onMounted(K.cargarMisPedidos);
    return { K, S, f, selEq, agregarFotos, enviar, formatDateForDisplay };
  }
};

/** Ficha del equipo (CRTG): cambiar la ubicación. */
export const CrtgUbicacion = {
  name: 'CrtgUbicacion',
  components: { LugarSelect },
  props: { eq: { type: Object, required: true } },
  template: /* html */ `
<div class="bg-white rounded-2xl shadow-sm p-4 space-y-2">
  <div class="lbl"><i class="fa-solid fa-location-dot mr-1"></i>Cambiar ubicación</div>
  <p class="text-xs text-slate-500">Actual: <b>{{ eq.ubicacion || '—' }}</b></p>
  <lugar-select v-model="lugar" etiqueta="NUEVA UBICACIÓN" campo="crtg-ubic"></lugar-select>
  <button @click="guardar" :disabled="ocupado || !lugar" class="w-full py-3 rounded-xl bg-[#1f4d3a] text-white font-extrabold disabled:opacity-40" data-crtg="guardar-ubic">
    <i :class="['fa-solid mr-1', ocupado ? 'fa-spinner fa-spin' : 'fa-floppy-disk']"></i>Guardar ubicación</button>
</div>`,
  setup(props) {
    const lugar = ref(''); const ocupado = ref(false);
    const guardar = async () => {
      ocupado.value = true;
      try {
        if (await K.cambiarUbicacionCrtg(props.eq, lugar.value, CH.locDeTexto(lugar.value))) {
          S.avisoApp('Ubicación actualizada ✔'); lugar.value = '';
          S.equipoSel.value = buscarEquipoPorAfi(props.eq.afi) || S.equipoSel.value;
        }
      } finally { ocupado.value = false; }
    };
    return { lugar, ocupado, guardar };
  }
};
