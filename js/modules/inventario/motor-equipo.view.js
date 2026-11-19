// =====================================================================
// PERFIL DEL EQUIPO · Pestaña "Motor y fabricante" · 2026-11-19
// Motor del equipo, manual del fabricante, aceite recomendado y pauta de mantención del fabricante
// (intervalos principales) con la próxima vez que toca según el horómetro aproximado.
// Datos en js/core/motores-fabricante.js
// =====================================================================
import { motorDeEquipo, FAMILIAS, equiposConMismoMotor, proximaPorHoras } from '../../core/motores-fabricante.js';

const { computed, ref } = Vue;
const COLOR_CONF = { Alta: 'bg-emerald-100 text-emerald-800 border-emerald-300', Media: 'bg-amber-100 text-amber-800 border-amber-300', Baja: 'bg-rose-100 text-rose-800 border-rose-300' };
const ICONO_TIPO = { cambiar: 'fa-rotate', revisar: 'fa-magnifying-glass', limpiar: 'fa-broom' };
const VERBO = { cambiar: 'Cambiar', revisar: 'Revisar', limpiar: 'Limpiar' };
const COLOR_TIPO = { cambiar: 'text-emerald-600', revisar: 'text-blue-500', limpiar: 'text-amber-600' };

export default {
  name: 'MotorEquipo',
  props: { eq: { type: Object, required: true } },
  template: /* html */ `
<div class="space-y-4" data-motor="pestana">
  <div v-if="!m" class="bg-white rounded-xl border p-6 text-center text-slate-500">
    <i class="fa-solid fa-gears text-3xl text-slate-300 mb-2"></i>
    <p class="font-bold">Este equipo aún no tiene el motor identificado.</p>
    <p class="text-[11px]">Revisar la placa del motor y avisar a Operaciones para cargarlo (archivo js/core/motores-fabricante.js).</p>
  </div>
  <template v-else>
    <!-- Motor -->
    <div class="bg-white rounded-xl border shadow-sm p-4 flex flex-wrap items-start gap-4">
      <span class="w-14 h-14 rounded-2xl bg-slate-800 text-amber-400 flex items-center justify-center text-2xl shrink-0"><i class="fa-solid fa-gears"></i></span>
      <div class="flex-1 min-w-[220px]">
        <p class="text-[10px] font-bold uppercase text-slate-500">Motor</p>
        <p class="text-lg font-extrabold text-slate-800 leading-tight" data-motor="modelo">{{ m.marca }} · {{ m.modelo }}</p>
        <p class="text-[11px] text-slate-500 mt-0.5">{{ fam.nombre }}</p>
        <p v-if="m.nota" class="text-[11px] text-slate-600 mt-1"><i class="fa-solid fa-circle-info mr-1 text-slate-400"></i>{{ m.nota }}</p>
        <p v-if="m.origen === 'modelo'" class="text-[11px] text-amber-700 font-bold mt-1"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Tomado de otro equipo de la misma marca y modelo: confirmar con la placa.</p>
      </div>
      <div class="text-right space-y-1">
        <span :class="['inline-block text-[10px] font-black px-2 py-1 rounded-lg border', colorConf]" title="Qué tan seguro es el dato">Confianza {{ m.confianza }}</span>
        <p v-if="fam.aceite" class="text-[11px] text-slate-600"><i class="fa-solid fa-oil-can mr-1 text-amber-600"></i>{{ fam.aceite }}</p>
      </div>
    </div>

    <!-- Manuales -->
    <div v-if="fam.manuales.length" class="bg-white rounded-xl border shadow-sm p-4">
      <p class="text-[10px] font-bold uppercase text-slate-500 mb-2"><i class="fa-solid fa-book mr-1"></i>Manual del fabricante</p>
      <div class="flex flex-wrap gap-2">
        <template v-for="x in fam.manuales" :key="x.t">
          <a v-if="x.u" :href="x.u" target="_blank" rel="noopener" class="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 font-bold hover:bg-blue-100" data-motor="manual"><i class="fa-solid fa-arrow-up-right-from-square mr-1"></i>{{ x.t }}</a>
          <span v-else class="px-3 py-2 rounded-lg bg-slate-50 border text-slate-600">{{ x.t }}</span>
        </template>
      </div>
    </div>

    <!-- Pauta del fabricante -->
    <div v-if="fam.pauta.length" class="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div class="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 bg-slate-50">
        <p class="font-extrabold text-slate-800"><i class="fa-solid fa-list-check mr-1 text-emerald-700"></i>Pauta de mantención del fabricante · {{ fam.fabricante }}</p>
        <p class="text-[11px] text-slate-600">Horómetro aprox.: <b class="font-mono text-blue-700">{{ horas ? horas.toLocaleString('es-CL') + ' h' : 'sin dato' }}</b></p>
      </div>
      <div v-if="proxima" class="px-4 py-3 border-b bg-blue-50 text-[12px]" data-motor="proxima">
        <b class="text-blue-800"><i class="fa-solid fa-calendar-check mr-1"></i>Próxima mantención: {{ proxima.h.toLocaleString('es-CL') }} h</b>
        <span class="text-slate-600"> (faltan {{ proxima.faltan.toLocaleString('es-CL') }} h) · incluye las tareas de: </span>
        <span v-for="i in proxima.incluye" :key="i" class="inline-block ml-1 px-1.5 py-0.5 rounded bg-white border border-blue-200 font-mono text-[11px] text-blue-800">{{ i.toLocaleString('es-CL') }} h</span>
      </div>
      <div class="divide-y">
        <div v-for="g in grupos" :key="g.k" data-motor="grupo">
          <div :class="['px-4 py-2 flex flex-wrap items-center justify-between gap-2', g.cerca ? 'bg-amber-100' : 'bg-slate-100']">
            <p class="font-extrabold text-slate-800 text-[13px]"><i :class="['fa-solid mr-1.5', g.icono]"></i>{{ g.titulo }} <span class="text-[10px] font-bold text-slate-500">({{ g.tareas.length }})</span></p>
            <p v-if="g.prox" class="text-[11px]"><span class="text-slate-500">próxima a las</span> <b class="font-mono">{{ g.prox.prox.toLocaleString('es-CL') }} h</b> <span :class="['font-bold', g.cerca ? 'text-amber-700' : 'text-slate-500']">(faltan {{ g.prox.faltan.toLocaleString('es-CL') }} h)</span></p>
          </div>
          <ul class="px-4 py-1.5">
            <li v-for="t in g.tareas" :key="t.tarea" class="py-1 flex flex-wrap items-baseline gap-x-2 text-[12px]" data-motor="tarea">
              <i :class="['fa-solid w-4 text-center', icono(t.tipo), colorTipo(t.tipo)]"></i>
              <span :class="['text-[9px] font-black uppercase w-14', colorTipo(t.tipo)]">{{ verbo(t.tipo) }}</span><span class="font-bold text-slate-700">{{ t.tarea }}</span>
              <span v-if="t.extra && t.extra !== 'Diario'" class="text-[11px] text-slate-500">· {{ t.extra }}</span>
            </li>
          </ul>
        </div>
      </div>
      <p class="px-4 py-2 text-[10px] text-slate-500 border-t bg-slate-50">Intervalos principales <b>referenciales</b> del fabricante (uso normal). Manda el manual de la versión exacta del motor; en polvo, calor o uso severo, acortar. Cada mantención incluye también las de intervalos menores (ej. la de 1.000 h incluye las de 250 y 500 h). "Próxima" se calcula con el horómetro aproximado, no con el historial.</p>
    </div>
    <div v-else-if="m.familia === 'vehiculo'" class="bg-white rounded-xl border p-4 text-slate-600"><i class="fa-solid fa-truck mr-1"></i>Vehículo: la pauta es por kilometraje según el concesionario de la marca (módulo Vehículos).</div>

    <!-- Otros equipos con el mismo motor -->
    <div v-if="mismos.length > 1" class="bg-white rounded-xl border shadow-sm p-4">
      <p class="text-[10px] font-bold uppercase text-slate-500 mb-2"><i class="fa-solid fa-layer-group mr-1"></i>Otros equipos con este mismo motor ({{ mismos.length - 1 }}) · sirven los mismos filtros y el mismo manual</p>
      <div class="flex flex-wrap gap-1">
        <span v-for="a in mismos.filter(x => x.toUpperCase() !== String(eq.afi).toUpperCase()).slice(0, verTodos ? 999 : 40)" :key="a" class="px-2 py-0.5 rounded bg-slate-100 border font-mono text-[11px]">{{ a }}</span>
        <button v-if="mismos.length > 41" @click="verTodos = !verTodos" class="text-[11px] font-bold text-blue-700">{{ verTodos ? 'ver menos' : 'ver todos' }}</button>
      </div>
    </div>
  </template>
</div>`,
  setup(props) {
    const verTodos = ref(false);
    const m = computed(() => motorDeEquipo(props.eq));
    const fam = computed(() => (m.value && FAMILIAS[m.value.familia]) || FAMILIAS.otro);
    const horas = computed(() => Number(props.eq?.horometros?.hAprox || props.eq?.horometros?.hTomado || props.eq?.horometroActual) || 0);
    const grupos = computed(() => {
      const mapa = new Map();
      fam.value.pauta.forEach(t => {
        const k = t.horas > 0 ? t.horas : (t.extra === 'Diario' ? -1 : 1e9);
        if (!mapa.has(k)) mapa.set(k, []);
        mapa.get(k).push(t);
      });
      return [...mapa.entries()].sort((a, b) => a[0] - b[0]).map(([k, tareas]) => {
        const prox = k > 0 && k < 1e9 ? proximaPorHoras(horas.value, k) : null;
        return {
          k, tareas, prox, cerca: Boolean(prox && prox.faltan <= Math.max(10, k * 0.1)),
          titulo: k === -1 ? 'Diario (antes de arrancar)' : k === 1e9 ? 'Por tiempo o según condición' : (k === 50 ? 'Cada 50 h (o semanal)' : 'Cada ' + k.toLocaleString('es-CL') + ' h'),
          icono: k === -1 ? 'fa-sun text-amber-500' : k === 1e9 ? 'fa-clock text-slate-500' : 'fa-gauge-high text-emerald-700'
        };
      });
    });
    const proxima = computed(() => {
      const ints = [...new Set(fam.value.pauta.map(t => t.horas).filter(h => h >= 100 && h < 1e9))];
      const ps = ints.map(i => proximaPorHoras(horas.value, i)).filter(Boolean);
      if (!ps.length) return null;
      const h = Math.min(...ps.map(p => p.prox));
      return { h, faltan: Math.round(h - horas.value), incluye: ints.filter(i => h % i === 0).sort((a, b) => a - b) };
    });
    const mismos = computed(() => (m.value ? equiposConMismoMotor(m.value.marca, m.value.modelo) : []));
    const colorConf = computed(() => COLOR_CONF[m.value?.confianza] || COLOR_CONF.Baja);
    const icono = (t) => ICONO_TIPO[t] || 'fa-wrench';
    const verbo = (t) => VERBO[t] || '';
    const colorTipo = (t) => COLOR_TIPO[t] || 'text-slate-400';
    return { m, fam, horas, grupos, proxima, verbo, colorTipo, mismos, colorConf, icono, verTodos };
  }
};
