// =====================================================================
// CALCULADORA DE ARRIENDO · Pantalla (2026-11-24) — PRUEBA, solo Admin general.
// Camiones primero; equipos después. Lógica en calculadora.service.js.
// =====================================================================
import { comunes } from '../../core/comunes.js';
import * as C from './calculadora.service.js';

const { ref, onMounted } = Vue;

// Campo con ticket AUTO: marcado = valor automático (web / parámetros / regla); desmarcado = MANUAL (se puede escribir).
const CampoAuto = {
  props: { label: String, valor: [Number, String], auto: Boolean, fuente: String, link: String, unidad: String, step: { type: [Number, String], default: 'any' } },
  emits: ['modo', 'escribir'],
  template: `
  <div :class="['rounded-lg border-2 p-2 transition', auto ? 'border-emerald-400 bg-emerald-50' : 'border-amber-400 bg-amber-50']">
    <div class="flex items-center justify-between gap-2 mb-1">
      <span class="text-[10px] font-bold uppercase text-slate-600">{{ label }}</span>
      <label :class="['flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded cursor-pointer select-none', auto ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white']" :title="auto ? 'Automático. Desmarca para escribirlo a mano' : 'Manual. Marca para volver al valor automático'">
        <input type="checkbox" :checked="auto" @change="$emit('modo', $event.target.checked)" class="w-3 h-3"> {{ auto ? 'AUTO' : 'MANUAL' }}
      </label>
    </div>
    <div class="flex items-center gap-1">
      <input type="number" :step="step" :value="valor" :readonly="auto" @input="$emit('escribir', Number($event.target.value))"
        :class="['w-full p-1.5 border rounded text-sm font-bold', auto ? 'bg-white/60 text-emerald-900 cursor-not-allowed' : 'bg-white']">
      <span v-if="unidad" class="text-[11px] font-bold text-slate-500 whitespace-nowrap">{{ unidad }}</span>
    </div>
    <p class="text-[10px] mt-1 leading-tight" :class="auto ? 'text-emerald-800' : 'text-amber-800'">
      <i :class="['fa-solid mr-0.5', auto ? 'fa-robot' : 'fa-hand']"></i>{{ auto ? fuente : 'Valor escrito a mano' }}
      <a v-if="auto && link" :href="link" target="_blank" rel="noopener" class="underline font-bold ml-1">ver fuente</a>
    </p>
  </div>`
};

const inp = 'w-full p-2 border rounded-lg bg-white text-sm font-semibold';
const req = 'w-full p-2 border-2 border-yellow-400 rounded-lg bg-yellow-50 text-sm font-semibold';   // obligatorio
const lab = 'block text-[10px] font-bold uppercase text-slate-500 mb-0.5';
const card = 'bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3';
const h = 'text-xs font-extrabold uppercase text-slate-700 flex items-center gap-2';

const template = /* html */ `
<section class="space-y-4">
  <div class="bg-slate-900 text-white rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 class="font-extrabold text-lg flex items-center gap-2"><i class="fa-solid fa-calculator text-emerald-400"></i> Calculadora de arriendo · Camiones</h2>
      <p class="text-xs text-slate-300">Módulo de prueba (solo Admin general). Valores por defecto <b>referenciales</b>: ajústalos en "Parámetros" con los datos reales de FRC.</p>
    </div>
    <div class="flex gap-2 flex-wrap">
      <button @click="C.nuevaCotizacion()" class="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-bold"><i class="fa-solid fa-file-circle-plus"></i> Nueva</button>
      <button @click="C.guardarCotizacion()" class="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold"><i class="fa-solid fa-floppy-disk"></i> {{ C.form.id ? 'Guardar cambios' : 'Guardar cotización' }}</button>
      <button v-if="$adminGeneral" @click="C.exportarCotizacionExcel()" :disabled="C.exportando.value" class="px-3 py-2 rounded-lg bg-white text-emerald-800 text-xs font-bold disabled:opacity-60"><i :class="['fa-solid', C.exportando.value ? 'fa-spinner fa-spin' : 'fa-file-excel']"></i> Excel</button>
      <button @click="imprimir" class="px-3 py-2 rounded-lg bg-white text-slate-800 text-xs font-bold"><i class="fa-solid fa-print"></i> Imprimir / PDF</button>
    </div>
  </div>
  <div class="flex flex-wrap gap-3 text-[11px] font-semibold bg-white border rounded-xl p-2.5">
    <span class="flex items-center gap-1.5"><span class="w-4 h-4 rounded border-2 border-yellow-400 bg-yellow-50"></span> Obligatorio: debes rellenarlo <b class="text-rose-600">*</b></span>
    <span class="flex items-center gap-1.5"><span class="w-4 h-4 rounded border-2 border-emerald-400 bg-emerald-50"></span> <b class="bg-emerald-600 text-white px-1 rounded text-[9px]">AUTO</b> lo calcula la app (web, parámetros o regla). Desmárcalo para escribirlo</span>
    <span class="flex items-center gap-1.5"><span class="w-4 h-4 rounded border-2 border-amber-400 bg-amber-50"></span> <b class="bg-amber-500 text-white px-1 rounded text-[9px]">MANUAL</b> escrito a mano</span>
    <span class="flex items-center gap-1.5"><span class="w-4 h-4 rounded border bg-white"></span> Opcional (solo si aplica)</span>
    <span class="flex items-center gap-1.5"><i class="fa-solid fa-sliders text-slate-400"></i> Variables fijas (sueldos, %, tarifas): en "Parámetros" al final</span>
  </div>
  <p v-if="C.faltaTabla.value" class="text-xs bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-2"><i class="fa-solid fa-triangle-exclamation"></i> Para guardar cotizaciones falta ejecutar <b>sql/cotizaciones_arriendo.sql</b> en Supabase. Mientras tanto puedes calcular y exportar.</p>

  <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
    <!-- ================= ENTRADAS ================= -->
    <div class="xl:col-span-2 space-y-4">
      <div class="${card}">
        <h3 class="${h}"><i class="fa-solid fa-file-lines text-slate-400"></i> Cotización</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label class="col-span-2"><span class="${lab}">Nombre <b class="text-rose-600">*</b></span><input v-model="C.form.nombre" placeholder="Ej. Traslado generador a Colón Alto" class="${req}"></label>
          <label><span class="${lab}">Cliente</span><input v-model="C.form.cliente" class="${inp}"></label>
          <label><span class="${lab}">Fecha</span><input type="date" v-model="C.form.fecha" class="${inp}"></label>
        </div>
      </div>

      <div class="${card}">
        <h3 class="${h}"><i class="fa-solid fa-truck text-slate-400"></i> Camión y modalidad</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label class="col-span-2"><span class="${lab}">Camión de la flota (opcional)</span>
            <select v-model="C.form.afi" @change="elegirCamion" class="${inp}"><option value="">— Sin camión específico —</option>
              <option v-for="e in C.camionesFlota.value" :key="e.id" :value="e.afi">{{ e.afi }} · {{ e.tipo }} {{ e.marca }} {{ e.modelo }}</option></select></label>
          <label class="col-span-2"><span class="${lab}">Tipo para el cálculo</span>
            <select v-model="C.form.tipo" class="${inp}"><option v-for="t in C.params.tipos" :key="t.tipo" :value="t.tipo">{{ t.tipo }} · {{ t.rend }} km/L · {{ t.ejes === '2' ? '2 ejes' : '+2 ejes' }}</option></select></label>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <campo-auto label="Rendimiento" unidad="km/L" step="0.1" :valor="C.efectivo.value.rend" :auto="!C.form.man.rend" :fuente="C.auto.value.fRend" :link="C.auto.value.linkRend"
            @modo="v => C.ponerAuto('rend', v)" @escribir="v => C.form.rend = v"></campo-auto>
          <div class="rounded-lg border p-2 text-[11px] space-y-1">
            <p class="font-bold uppercase text-[10px] text-slate-600"><i class="fa-solid fa-file-pdf text-rose-600"></i> Ficha técnica y fuente del rendimiento</p>
            <template v-if="C.camionSel.value">
              <p class="text-slate-600">{{ C.camionSel.value.marca || 'Sin marca' }} {{ C.camionSel.value.modelo || 'sin modelo' }}</p>
              <a v-for="d in C.fichasCamion.value" :key="d.id" :href="d.link" target="_blank" rel="noopener" class="block text-blue-700 underline font-semibold truncate"><i class="fa-solid fa-paperclip"></i> {{ d.nombre }}</a>
              <p v-if="!C.fichasCamion.value.length" class="text-slate-400 italic">Este camión no tiene ficha técnica cargada (Vehículos → perfil → Filtros y ficha).</p>
              <p v-if="C.modeloSel.value" class="text-emerald-700 font-semibold">Rendimiento registrado para el modelo: {{ C.modeloSel.value.rend }} km/L · {{ C.modeloSel.value.tipoFuente }} <a v-if="C.modeloSel.value.fuente" :href="C.modeloSel.value.fuente" target="_blank" rel="noopener" class="underline">ver fuente</a></p>
              <button v-else @click="registrarModelo" class="text-blue-700 font-bold underline"><i class="fa-solid fa-plus"></i> Registrar el rendimiento de este modelo (con su fuente)</button>
            </template>
            <p v-else class="text-slate-400 italic">Elige un camión de la flota para ver su ficha técnica. Sin camión se usa el rendimiento referencial del tipo.</p>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button v-for="m in C.MODALIDADES" :key="m.k" @click="C.form.modalidad = m.k" :class="['p-2.5 rounded-lg border-2 text-left', C.form.modalidad === m.k ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300']">
            <b class="text-xs block">{{ m.l }}</b><span class="text-[10px] text-slate-500">{{ m.d }}</span></button>
        </div>
        <div class="flex flex-wrap gap-4 text-sm font-semibold">
          <label class="flex items-center gap-2"><input type="checkbox" v-model="C.form.conChofer" class="w-4 h-4"> Con chofer FRC</label>
          <label class="flex items-center gap-2"><input type="checkbox" v-model="C.form.conRigger" class="w-4 h-4"> Con rigger</label>
        </div>
      </div>

      <div class="${card}">
        <h3 class="${h}"><i class="fa-solid fa-route text-slate-400"></i> Ruta y tiempo</h3>
        <datalist id="calc-ciudades"><option v-for="c in C.CIUDADES" :key="c" :value="c"></option></datalist>
        <div class="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <label><span class="${lab}">Origen <b class="text-rose-600">*</b></span><input v-model="C.form.origen" list="calc-ciudades" autocomplete="off" name="calc-origen-ciudad" placeholder="Elige una ciudad (o pega un link de Google Maps)" class="${req}"></label>
          <label><span class="${lab}">Destino <b class="text-rose-600">*</b></span><input v-model="C.form.destino" list="calc-ciudades" autocomplete="off" name="calc-destino-ciudad" placeholder="Elige una ciudad (o pega un link de Google Maps)" class="${req}"></label>
          <button @click="C.calcularRuta()" :disabled="C.rutaEstado.value === 'calculando'" class="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold disabled:opacity-60 whitespace-nowrap"><i :class="['fa-solid', C.rutaEstado.value === 'calculando' ? 'fa-spinner fa-spin' : 'fa-map-location-dot']"></i> Calcular distancia</button>
        </div>
        <p v-if="C.rutaEstado.value === 'error'" class="text-[11px] text-rose-700 font-semibold"><i class="fa-solid fa-triangle-exclamation"></i> {{ C.rutaError.value }} Puedes desmarcar AUTO y escribir los km a mano.</p>
        <p v-if="C.form.ruta" class="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
          <i class="fa-solid fa-circle-check"></i> <b>{{ C.fmtN(C.form.ruta.km, 1) }} km</b> · {{ C.fmtN(C.form.ruta.horas, 1) }} h (tiempo de auto) · {{ C.form.ruta.origen?.nombre?.split(',')[0] }} → {{ C.form.ruta.destino?.nombre?.split(',')[0] }}
          <span v-if="C.form.ruta.peajes?.length"> · peajes detectados: {{ C.form.ruta.peajes.length }}</span>
          <a :href="C.linkGoogleMaps.value" target="_blank" rel="noopener" class="underline font-bold ml-1">Revisar en Google Maps</a>
        </p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <campo-auto label="Km de ida (por viaje)" unidad="km" :valor="C.efectivo.value.kmIda" :auto="!C.form.man.kmIda" :fuente="C.auto.value.fKmIda" :link="C.form.ruta ? C.linkGoogleMaps.value : ''"
            @modo="v => C.ponerAuto('kmIda', v)" @escribir="v => C.form.kmIda = v"></campo-auto>
          <label><span class="${lab}">N° de viajes <b class="text-rose-600">*</b></span><input type="number" min="0" v-model.number="C.form.viajes" class="${req}"></label>
          <campo-auto v-if="C.form.modalidad === 'flete'" label="Días de servicio" unidad="días" step="1" :valor="C.efectivo.value.dias" :auto="!C.form.man.dias" :fuente="C.auto.value.fDias"
            @modo="v => C.ponerAuto('dias', v)" @escribir="v => C.form.dias = v"></campo-auto>
          <label v-else-if="C.form.modalidad === 'dias'"><span class="${lab}">Días de servicio <b class="text-rose-600">*</b></span><input type="number" min="0" v-model.number="C.form.dias" class="${req}"></label>
          <label v-else><span class="${lab}">Meses <b class="text-rose-600">*</b></span><input type="number" min="0" step="0.5" v-model.number="C.form.meses" class="${req}"></label>
          <label class="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" v-model="C.form.idaVuelta" class="w-4 h-4"> Ida y vuelta</label>
          <label><span class="${lab}">Km por día en faena</span><input type="number" min="0" v-model.number="C.form.kmFaenaDia" class="${inp}"></label>
          <label v-if="C.tipoSel.value.pluma"><span class="${lab}">Horas de pluma por día</span><input type="number" min="0" step="0.5" v-model.number="C.form.horasPlumaDia" class="${inp}"></label>
          <campo-auto label="Precio diésel" unidad="$/L" :valor="C.efectivo.value.diesel" :auto="!C.form.man.diesel" :fuente="C.auto.value.fDiesel"
            @modo="v => C.ponerAuto('diesel', v)" @escribir="v => C.form.precioDiesel = v"></campo-auto>
        </div>
        <p class="text-[11px] text-slate-500"><i class="fa-solid fa-circle-info"></i> Recorrido total: <b>{{ C.fmtN(C.resultado.value.km) }} km</b> · {{ C.fmtN(C.resultado.value.dias) }} día(s) · {{ C.fmtN(C.resultado.value.litros) }} L de diésel. Distancias: OpenStreetMap (puede diferir unos km de Google Maps).</p>
      </div>

      <div class="${card}">
        <h3 class="${h}"><i class="fa-solid fa-road-barrier text-slate-400"></i> Peajes <span class="normal-case font-semibold text-slate-400">(tarifa {{ C.tipoSel.value.ejes === '2' ? 'camión 2 ejes' : 'camión de más de 2 ejes' }})</span></h3>
        <div class="overflow-x-auto"><table class="w-full text-xs">
          <thead class="bg-slate-50 text-slate-500 uppercase text-[10px]"><tr><th class="p-2 text-left">Peaje</th><th class="p-2 text-right">Tarifa</th><th class="p-2 text-center">Pasadas</th><th class="p-2 text-right">Subtotal</th></tr></thead>
          <tbody class="divide-y">
            <tr v-for="p in C.params.peajes" :key="p.id">
              <td class="p-2"><b>{{ p.nombre }}</b> <span v-if="p.estimado" class="ml-1 px-1.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold" :title="p.nota">ESTIMADO</span><div class="text-[10px] text-slate-400">{{ p.ruta }}</div></td>
              <td class="p-2 text-right font-mono">{{ C.fmt$(C.tipoSel.value.ejes === '2' ? p.c2 : p.c3) }}</td>
              <td class="p-2 text-center whitespace-nowrap">
                <label :class="['inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded cursor-pointer mr-1', C.form.peajeMan[p.id] ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white']" :title="p.lat == null ? 'Sin ubicación: no se detecta solo. Ubícalo en Parámetros o pásalo a manual' : 'AUTO = se cobra si la ruta pasa por el peaje'">
                  <input type="checkbox" :checked="!C.form.peajeMan[p.id]" @change="C.ponerPeajeAuto(p.id, $event.target.checked)" class="w-3 h-3"> {{ C.form.peajeMan[p.id] ? 'MANUAL' : 'AUTO' }}</label>
                <input v-if="C.form.peajeMan[p.id]" type="number" min="0" v-model.number="C.form.peajes[p.id]" class="w-14 p-1 border-2 border-amber-400 rounded text-center">
                <b v-else class="inline-block w-14 text-center">{{ C.pasadasDe(p.id) }}</b>
                <div v-if="!C.form.peajeMan[p.id] && p.lat == null" class="text-[9px] text-slate-400">sin ubicación</div></td>
              <td class="p-2 text-right font-mono font-bold">{{ C.fmt$(C.pasadasDe(p.id) * (C.tipoSel.value.ejes === '2' ? p.c2 : p.c3)) }}</td>
            </tr>
          </tbody></table></div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label><span class="${lab}">TAG autopistas urbanas ($)</span><input type="number" min="0" v-model.number="C.form.tagUrbano" class="${inp}"></label>
        </div>
        <p class="text-[10px] text-slate-400">AUTO: si la ruta calculada pasa por el peaje se cobran {{ C.pasadasSugeridas.value }} pasada(s) (viajes × ida/vuelta). Para que un peaje se detecte solo debe tener su ubicación (Parámetros → Ubicar). Las tarifas se editan en Parámetros.</p>
      </div>

      <div v-if="C.form.conChofer" class="${card}">
        <h3 class="${h}"><i class="fa-solid fa-user-tie text-slate-400"></i> Chofer</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label><span class="${lab}">Horas extra (total)</span><input type="number" min="0" v-model.number="C.form.horasExtra" class="${inp}"></label>
          <campo-auto label="Días con viático" unidad="días" step="1" :valor="C.efectivo.value.diasViatico" :auto="!C.form.man.diasViatico" fuente="Regla: uno por día de servicio"
            @modo="v => C.ponerAuto('diasViatico', v)" @escribir="v => C.form.diasViatico = v"></campo-auto>
          <campo-auto label="Noches de alojamiento" unidad="noches" step="1" :valor="C.efectivo.value.noches" :auto="!C.form.man.noches" fuente="Regla: ida > 200 km → días − 1"
            @modo="v => C.ponerAuto('noches', v)" @escribir="v => C.form.noches = v"></campo-auto>
        </div>
        <p class="text-[10px] text-slate-400">Costo día chofer {{ C.fmt$(C.params.costoDiaChofer) }} · viático {{ C.fmt$(C.params.viaticoDia) }} · alojamiento {{ C.fmt$(C.params.alojamientoNoche) }} (editar en Parámetros).</p>
      </div>

      <div class="${card}">
        <h3 class="${h}"><i class="fa-solid fa-helmet-safety text-slate-400"></i> Faena y otros costos ($)</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label><span class="${lab}">Acreditación</span><input type="number" min="0" v-model.number="C.form.acreditacion" class="${inp}"></label>
          <label><span class="${lab}">Exámenes ocupacionales</span><input type="number" min="0" v-model.number="C.form.examenes" class="${inp}"></label>
          <label><span class="${lab}">Inducción</span><input type="number" min="0" v-model.number="C.form.induccion" class="${inp}"></label>
          <label><span class="${lab}">EPP</span><input type="number" min="0" v-model.number="C.form.epp" class="${inp}"></label>
          <label><span class="${lab}">Otros de faena</span><input type="number" min="0" v-model.number="C.form.otrosFaena" class="${inp}"></label>
          <label><span class="${lab}">Permisos especiales</span><input type="number" min="0" v-model.number="C.form.permisosEspeciales" class="${inp}"></label>
          <label><span class="${lab}">Escolta / señalero</span><input type="number" min="0" v-model.number="C.form.escolta" class="${inp}"></label>
          <label><span class="${lab}">Lavado</span><input type="number" min="0" v-model.number="C.form.lavado" class="${inp}"></label>
          <label><span class="${lab}">Estacionamiento</span><input type="number" min="0" v-model.number="C.form.estacionamiento" class="${inp}"></label>
          <label><span class="${lab}">Otros (monto)</span><input type="number" min="0" v-model.number="C.form.otros" class="${inp}"></label>
          <label class="col-span-2"><span class="${lab}">Detalle de "otros"</span><input v-model="C.form.notaOtros" class="${inp}"></label>
        </div>
        <label class="block"><span class="${lab}">Observaciones</span><textarea v-model="C.form.observaciones" rows="2" class="${inp}"></textarea></label>
      </div>
    </div>

    <!-- ================= RESULTADO ================= -->
    <div class="space-y-4" id="calc-resultado">
      <div class="${card} xl:sticky xl:top-4">
        <h3 class="${h}"><i class="fa-solid fa-sack-dollar text-emerald-600"></i> Resultado</h3>
        <div class="bg-slate-900 text-white rounded-xl p-4 text-center">
          <p class="text-[10px] uppercase font-bold text-slate-400">Precio sugerido neto</p>
          <p class="text-3xl font-extrabold text-emerald-400">{{ C.fmt$(C.resultado.value.neto) }}</p>
          <p class="text-xs text-slate-300">+ IVA {{ C.fmt$(C.resultado.value.iva) }} = <b class="text-white">{{ C.fmt$(C.resultado.value.total) }}</b></p>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="bg-slate-50 rounded-lg p-2"><p class="text-[9px] font-bold uppercase text-slate-500">Por día</p><p class="text-sm font-extrabold">{{ C.fmt$(C.resultado.value.porDia) }}</p></div>
          <div class="bg-slate-50 rounded-lg p-2"><p class="text-[9px] font-bold uppercase text-slate-500">Por km</p><p class="text-sm font-extrabold">{{ C.fmt$(C.resultado.value.porKm) }}</p></div>
          <div class="bg-slate-50 rounded-lg p-2"><p class="text-[9px] font-bold uppercase text-slate-500">Por viaje</p><p class="text-sm font-extrabold">{{ C.fmt$(C.resultado.value.porViaje) }}</p></div>
        </div>
        <div class="space-y-1.5">
          <div v-for="g in C.resultado.value.grupos" :key="g.g" class="text-xs">
            <div class="flex justify-between font-semibold"><span>{{ g.g }}</span><span class="font-mono">{{ C.fmt$(g.m) }} <span class="text-slate-400">({{ C.fmtN(g.pct) }}%)</span></span></div>
            <div class="h-1.5 bg-slate-100 rounded"><div class="h-1.5 bg-emerald-500 rounded" :style="{ width: g.pct + '%' }"></div></div>
          </div>
        </div>
        <table class="w-full text-xs"><tbody>
          <tr class="border-t"><td class="py-1 font-bold">Costo directo</td><td class="py-1 text-right font-mono font-bold">{{ C.fmt$(C.resultado.value.directo) }}</td></tr>
          <tr><td class="py-1">Imprevistos ({{ C.resultado.value.pcts.imprevistos }}%)</td><td class="py-1 text-right font-mono">{{ C.fmt$(C.resultado.value.imprevistos) }}</td></tr>
          <tr><td class="py-1">Gastos generales ({{ C.resultado.value.pcts.gg }}%)</td><td class="py-1 text-right font-mono">{{ C.fmt$(C.resultado.value.gg) }}</td></tr>
          <tr><td class="py-1">Margen ({{ C.resultado.value.pcts.margen }}%)</td><td class="py-1 text-right font-mono text-emerald-700 font-bold">{{ C.fmt$(C.resultado.value.margen) }}</td></tr>
          <tr class="border-t"><td class="py-1 font-extrabold">Neto</td><td class="py-1 text-right font-mono font-extrabold">{{ C.fmt$(C.resultado.value.neto) }}</td></tr>
        </tbody></table>
        <div class="border-t pt-2 space-y-2">
          <label class="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" v-model="C.form.usarPctParams" class="w-4 h-4"> Usar % de Parámetros</label>
          <div v-if="!C.form.usarPctParams" class="grid grid-cols-3 gap-2">
            <label><span class="${lab}">Imprev. %</span><input type="number" v-model.number="C.form.imprevistosPct" class="${inp}"></label>
            <label><span class="${lab}">G. gen. %</span><input type="number" v-model.number="C.form.gastosGeneralesPct" class="${inp}"></label>
            <label><span class="${lab}">Margen %</span><input type="number" v-model.number="C.form.margenPct" class="${inp}"></label>
          </div>
        </div>
        <details class="text-xs"><summary class="cursor-pointer font-bold text-slate-600">Supuestos y fuentes (de dónde sale cada dato)</summary>
          <table class="w-full mt-2"><tbody><tr v-for="(x, i) in C.supuestos.value" :key="i" class="border-t align-top">
            <td class="py-1 pr-2"><b>{{ x.variable }}</b>: {{ x.valor }}<div class="text-[10px] text-slate-400">{{ x.fuente }} <a v-if="x.link" :href="x.link" target="_blank" rel="noopener" class="underline text-blue-700">link</a></div></td>
            <td class="py-1 text-right"><span :class="['text-[9px] font-extrabold px-1 rounded text-white', x.origen === 'AUTOMÁTICO' ? 'bg-emerald-600' : 'bg-amber-500']">{{ x.origen === 'AUTOMÁTICO' ? 'AUTO' : 'MANUAL' }}</span></td></tr></tbody></table>
        </details>
        <details class="text-xs"><summary class="cursor-pointer font-bold text-slate-600">Ver detalle línea por línea</summary>
          <table class="w-full mt-2"><tbody><tr v-for="(l, i) in C.resultado.value.lineas" :key="i" class="border-t align-top">
            <td class="py-1 pr-2"><b>{{ l.concepto }}</b><div class="text-[10px] text-slate-400">{{ l.detalle }}</div></td><td class="py-1 text-right font-mono whitespace-nowrap">{{ C.fmt$(l.monto) }}</td></tr></tbody></table>
        </details>
      </div>
    </div>
  </div>

  <!-- ================= PARÁMETROS ================= -->
  <details class="${card}">
    <summary class="cursor-pointer ${h}"><i class="fa-solid fa-sliders text-slate-400"></i> Parámetros (precio diésel, tipos de camión, peajes, chofer, %) <span v-if="C.params.actualizado" class="normal-case font-semibold text-slate-400">· guardados el {{ C.params.actualizado }}</span></summary>
    <div class="grid grid-cols-2 md:grid-cols-6 gap-3 pt-3">
      <label><span class="${lab}">Diésel $/L</span><input type="number" v-model.number="C.params.precioDiesel" class="${inp}"></label>
      <label><span class="${lab}">Días operativos/año</span><input type="number" v-model.number="C.params.diasOperativosAnio" class="${inp}"></label>
      <label><span class="${lab}">Costo día chofer</span><input type="number" v-model.number="C.params.costoDiaChofer" class="${inp}"></label>
      <label><span class="${lab}">Valor hora extra</span><input type="number" v-model.number="C.params.valorHoraExtra" class="${inp}"></label>
      <label><span class="${lab}">Viático día</span><input type="number" v-model.number="C.params.viaticoDia" class="${inp}"></label>
      <label><span class="${lab}">Alojamiento noche</span><input type="number" v-model.number="C.params.alojamientoNoche" class="${inp}"></label>
      <label><span class="${lab}">Bono faena día</span><input type="number" v-model.number="C.params.bonoFaenaDia" class="${inp}"></label>
      <label><span class="${lab}">Costo día rigger</span><input type="number" v-model.number="C.params.costoDiaRigger" class="${inp}"></label>
      <label><span class="${lab}">Imprevistos %</span><input type="number" v-model.number="C.params.imprevistosPct" class="${inp}"></label>
      <label><span class="${lab}">Gastos generales %</span><input type="number" v-model.number="C.params.gastosGeneralesPct" class="${inp}"></label>
      <label><span class="${lab}">Margen %</span><input type="number" v-model.number="C.params.margenPct" class="${inp}"></label>
      <label><span class="${lab}">IVA %</span><input type="number" v-model.number="C.params.ivaPct" class="${inp}"></label>
    </div>
    <p class="text-[10px] text-slate-400">Precio del diésel: revisar el promedio de la región en bencinaenlinea.cl (CNE) antes de cotizar; cambia cada semana.</p>

    <h4 class="text-[11px] font-extrabold uppercase text-slate-600 pt-2">Tipos de camión</h4>
    <div class="overflow-x-auto"><table class="w-full text-[11px]">
      <thead class="bg-slate-50 text-slate-500 uppercase text-[9px]"><tr>
        <th class="p-1 text-left">Tipo</th><th class="p-1">Ejes</th><th class="p-1">km/L</th><th class="p-1">Valor camión $</th><th class="p-1">Residual %</th><th class="p-1">Vida años</th>
        <th class="p-1">N° neum.</th><th class="p-1">$ neumático</th><th class="p-1">Vida neum. km</th><th class="p-1">Mant. $/km</th><th class="p-1">Seguro anual</th><th class="p-1">Permisos+RT anual</th><th class="p-1">GPS mes</th><th class="p-1">Pluma</th><th class="p-1">Pluma L/h</th><th></th></tr></thead>
      <tbody class="divide-y">
        <tr v-for="(t, i) in C.params.tipos" :key="i">
          <td class="p-1"><input v-model="t.tipo" class="w-40 p-1 border rounded font-bold"></td>
          <td class="p-1"><select v-model="t.ejes" class="p-1 border rounded"><option value="2">2</option><option value="3">+2</option></select></td>
          <td class="p-1"><input type="number" step="0.1" v-model.number="t.rend" class="w-16 p-1 border rounded"></td>
          <td class="p-1"><input type="number" v-model.number="t.valor" class="w-28 p-1 border rounded"></td>
          <td class="p-1"><input type="number" v-model.number="t.residual" class="w-14 p-1 border rounded"></td>
          <td class="p-1"><input type="number" v-model.number="t.vidaAnios" class="w-14 p-1 border rounded"></td>
          <td class="p-1"><input type="number" v-model.number="t.neumaticos" class="w-14 p-1 border rounded"></td>
          <td class="p-1"><input type="number" v-model.number="t.precioNeumatico" class="w-24 p-1 border rounded"></td>
          <td class="p-1"><input type="number" v-model.number="t.vidaNeumaticoKm" class="w-20 p-1 border rounded"></td>
          <td class="p-1"><input type="number" v-model.number="t.mantKm" class="w-16 p-1 border rounded"></td>
          <td class="p-1"><input type="number" v-model.number="t.seguroAnual" class="w-24 p-1 border rounded"></td>
          <td class="p-1"><input type="number" v-model.number="t.permisosAnual" class="w-24 p-1 border rounded"></td>
          <td class="p-1"><input type="number" v-model.number="t.gpsMes" class="w-20 p-1 border rounded"></td>
          <td class="p-1 text-center"><input type="checkbox" v-model="t.pluma"></td>
          <td class="p-1"><input type="number" step="0.5" v-model.number="t.consumoPlumaLh" class="w-14 p-1 border rounded"></td>
          <td class="p-1"><button @click="C.quitarTipo(i)" class="text-rose-600"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
      </tbody></table></div>
    <button @click="C.agregarTipo()" class="text-xs font-bold text-blue-700"><i class="fa-solid fa-plus"></i> Agregar tipo</button>

    <h4 class="text-[11px] font-extrabold uppercase text-slate-600 pt-2" id="calc-modelos">Rendimiento por modelo de camión (con fuente)</h4>
    <p class="text-[10px] text-slate-500">Si el modelo del camión elegido calza con una fila, se usa este rendimiento (AUTO) en vez del del tipo. Lo más confiable es el <b>medido por FRC</b>: km recorridos ÷ litros cargados en varios viajes. Las fichas de fabricante rara vez traen km/L.</p>
    <div class="overflow-x-auto"><table class="w-full text-[11px]">
      <thead class="bg-slate-50 text-slate-500 uppercase text-[9px]"><tr><th class="p-1 text-left">Marca</th><th class="p-1 text-left">Modelo</th><th class="p-1">km/L</th><th class="p-1 text-left">Tipo de fuente</th><th class="p-1 text-left">Link fuente (PDF / web)</th><th class="p-1 text-left">Nota</th><th class="p-1">Fecha</th><th></th></tr></thead>
      <tbody class="divide-y">
        <tr v-for="(m, i) in C.params.modelos" :key="i">
          <td class="p-1"><input v-model="m.marca" class="w-24 p-1 border rounded font-bold"></td>
          <td class="p-1"><input v-model="m.modelo" class="w-32 p-1 border rounded font-bold"></td>
          <td class="p-1"><input type="number" step="0.1" v-model.number="m.rend" class="w-16 p-1 border rounded"></td>
          <td class="p-1"><select v-model="m.tipoFuente" class="p-1 border rounded"><option v-for="t in C.TIPOS_FUENTE" :key="t">{{ t }}</option></select></td>
          <td class="p-1"><input v-model="m.fuente" placeholder="https://… (ficha PDF o página)" class="w-56 p-1 border rounded"> <a v-if="m.fuente" :href="m.fuente" target="_blank" rel="noopener" class="text-blue-700"><i class="fa-solid fa-up-right-from-square"></i></a></td>
          <td class="p-1"><input v-model="m.nota" class="w-48 p-1 border rounded"></td>
          <td class="p-1"><input type="date" v-model="m.fecha" class="p-1 border rounded"></td>
          <td class="p-1"><button @click="C.quitarModelo(i)" class="text-rose-600"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
      </tbody></table></div>
    <button @click="C.agregarModelo()" class="text-xs font-bold text-blue-700"><i class="fa-solid fa-plus"></i> Agregar modelo</button>

    <h4 class="text-[11px] font-extrabold uppercase text-slate-600 pt-2">Peajes (tarifa por pasada, un sentido)</h4>
    <div class="overflow-x-auto"><table class="w-full text-[11px]">
      <thead class="bg-slate-50 text-slate-500 uppercase text-[9px]"><tr><th class="p-1 text-left">Peaje</th><th class="p-1 text-left">Ruta</th><th class="p-1">Auto $</th><th class="p-1">Camión 2 ejes $</th><th class="p-1">Camión +2 ejes $</th><th class="p-1">Estimado</th><th class="p-1">Ubicación (lat, lng)</th><th class="p-1 text-left">Nota / fuente</th><th></th></tr></thead>
      <tbody class="divide-y">
        <tr v-for="(p, i) in C.params.peajes" :key="p.id">
          <td class="p-1"><input v-model="p.nombre" class="w-48 p-1 border rounded font-bold"></td>
          <td class="p-1"><input v-model="p.ruta" class="w-44 p-1 border rounded"></td>
          <td class="p-1"><input type="number" v-model.number="p.auto" class="w-20 p-1 border rounded"></td>
          <td class="p-1"><input type="number" v-model.number="p.c2" class="w-20 p-1 border rounded"></td>
          <td class="p-1"><input type="number" v-model.number="p.c3" class="w-20 p-1 border rounded"></td>
          <td class="p-1 text-center"><input type="checkbox" v-model="p.estimado"></td>
          <td class="p-1 whitespace-nowrap"><input type="number" step="any" v-model.number="p.lat" placeholder="lat" class="w-20 p-1 border rounded"> <input type="number" step="any" v-model.number="p.lng" placeholder="lng" class="w-20 p-1 border rounded">
            <button @click="C.ubicarPeaje(p)" class="ml-1 px-1.5 py-0.5 rounded bg-slate-100 font-bold" title="Buscar en el mapa por nombre"><i class="fa-solid fa-location-crosshairs"></i></button>
            <a v-if="p.lat != null" :href="'https://www.google.com/maps?q=' + p.lat + ',' + p.lng" target="_blank" rel="noopener" class="ml-1 text-blue-700" title="Ver en Google Maps"><i class="fa-solid fa-map"></i></a></td>
          <td class="p-1"><input v-model="p.nota" class="w-64 p-1 border rounded"></td>
          <td class="p-1"><button @click="C.quitarPeaje(i)" class="text-rose-600"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
      </tbody></table></div>
    <button @click="C.agregarPeaje()" class="text-xs font-bold text-blue-700"><i class="fa-solid fa-plus"></i> Agregar peaje</button>
    <p class="text-[10px] text-slate-400">Las tarifas de camión marcadas "estimado" se calcularon desde la tarifa de auto: confírmalas en la web de la concesionaria (ej. Ruta del Maipo) o en las tablas tarifarias del MOP y desmarca "estimado".</p>
    <div class="flex gap-2 pt-1">
      <button @click="C.guardarParams()" :disabled="C.guardandoParams.value" class="px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold disabled:opacity-60"><i class="fa-solid fa-floppy-disk"></i> Guardar parámetros</button>
      <button @click="C.restaurarParams()" class="px-3 py-2 rounded-lg border text-xs font-bold text-slate-600"><i class="fa-solid fa-rotate-left"></i> Valores por defecto</button>
    </div>
  </details>

  <!-- ================= GUARDADAS ================= -->
  <div class="${card}">
    <h3 class="${h}"><i class="fa-solid fa-folder-open text-slate-400"></i> Cotizaciones guardadas <span class="normal-case font-semibold text-slate-400">({{ C.cotizaciones.value.length }})</span></h3>
    <p v-if="!C.cotizaciones.value.length" class="text-xs text-slate-400 italic">Aún no hay cotizaciones guardadas.</p>
    <div v-else class="overflow-x-auto"><table class="w-full text-xs">
      <thead class="bg-slate-50 text-slate-500 uppercase text-[10px]"><tr><th class="p-2 text-left">Fecha</th><th class="p-2 text-left">Nombre</th><th class="p-2 text-left">Cliente</th><th class="p-2 text-left">Tipo</th><th class="p-2 text-right">Neto</th><th class="p-2 text-right">Total c/IVA</th><th class="p-2"></th></tr></thead>
      <tbody class="divide-y">
        <tr v-for="c in C.cotizaciones.value" :key="c.id" :class="C.form.id === c.id ? 'bg-emerald-50' : ''">
          <td class="p-2">{{ formatDateForDisplay(c.fecha) }}</td><td class="p-2 font-bold">{{ c.nombre }}</td><td class="p-2">{{ c.cliente || '—' }}</td><td class="p-2">{{ c.tipo_vehiculo }}</td>
          <td class="p-2 text-right font-mono">{{ C.fmt$(c.neto) }}</td><td class="p-2 text-right font-mono font-bold">{{ C.fmt$(c.total) }}</td>
          <td class="p-2 whitespace-nowrap text-right">
            <button @click="C.abrirCotizacion(c)" class="px-2 py-1 rounded bg-blue-50 text-blue-800 font-bold">Abrir</button>
            <button @click="C.duplicarCotizacion(c)" class="px-2 py-1 rounded bg-slate-100 text-slate-700 font-bold ml-1" title="Duplicar"><i class="fa-solid fa-copy"></i></button>
            <button @click="C.eliminarCotizacion(c)" class="px-2 py-1 rounded bg-rose-50 text-rose-700 font-bold ml-1" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      </tbody></table></div>
  </div>
</section>
`;

export default {
  name: 'CalculadoraArriendoView',
  components: { CampoAuto },
  template,
  setup() {
    onMounted(() => { C.cargarParams(); C.cargarCotizaciones(); });
    const elegirCamion = () => {
      const e = C.camionesFlota.value.find(x => x.afi === C.form.afi);
      const t = e && C.tipoSugerido(e.tipo);
      if (t) C.form.tipo = t.tipo;
    };
    const imprimir = () => window.print();
    const registrarModelo = () => {
      const e = C.camionSel.value; if (!e) return;
      C.agregarModelo({ marca: e.marca || '', modelo: e.modelo || '', rend: C.efectivo.value.rend });
      const det = document.querySelector('#calc-modelos')?.closest('details'); if (det) det.open = true;
      setTimeout(() => document.querySelector('#calc-modelos')?.scrollIntoView({ behavior: 'smooth' }), 50);
    };
    return { ...comunes(), C, elegirCamion, imprimir, registrarModelo };
  }
};
