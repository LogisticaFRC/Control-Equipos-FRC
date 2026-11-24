// =====================================================================
// CALCULADORA DE ARRIENDO · Pantalla (2026-11-24) — PRUEBA, solo Admin general.
// Camiones primero; equipos después. Lógica en calculadora.service.js.
// =====================================================================
import { comunes } from '../../core/comunes.js';
import * as C from './calculadora.service.js';

const { ref, onMounted } = Vue;

const inp = 'w-full p-2 border rounded-lg bg-white text-sm font-semibold';
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
  <p v-if="C.faltaTabla.value" class="text-xs bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-2"><i class="fa-solid fa-triangle-exclamation"></i> Para guardar cotizaciones falta ejecutar <b>sql/cotizaciones_arriendo.sql</b> en Supabase. Mientras tanto puedes calcular y exportar.</p>

  <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
    <!-- ================= ENTRADAS ================= -->
    <div class="xl:col-span-2 space-y-4">
      <div class="${card}">
        <h3 class="${h}"><i class="fa-solid fa-file-lines text-slate-400"></i> Cotización</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label class="col-span-2"><span class="${lab}">Nombre *</span><input v-model="C.form.nombre" placeholder="Ej. Traslado generador a Colón Alto" class="${inp}"></label>
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
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label><span class="${lab}">Origen</span><input v-model="C.form.origen" placeholder="Ej. Taller FRC" class="${inp}"></label>
          <label><span class="${lab}">Destino</span><input v-model="C.form.destino" placeholder="Ej. Colón Alto" class="${inp}"></label>
          <label><span class="${lab}">Km ida (por viaje)</span><input type="number" min="0" v-model.number="C.form.kmIda" class="${inp}"></label>
          <label><span class="${lab}">N° de viajes</span><input type="number" min="0" v-model.number="C.form.viajes" class="${inp}"></label>
          <label class="flex items-center gap-2 text-sm font-semibold col-span-2"><input type="checkbox" v-model="C.form.idaVuelta" class="w-4 h-4"> Ida y vuelta (el camión vuelve)</label>
          <label v-if="C.form.modalidad !== 'mes'"><span class="${lab}">Días de servicio</span><input type="number" min="0" v-model.number="C.form.dias" class="${inp}"></label>
          <label v-else><span class="${lab}">Meses</span><input type="number" min="0" step="0.5" v-model.number="C.form.meses" class="${inp}"></label>
          <label><span class="${lab}">Km por día en faena</span><input type="number" min="0" v-model.number="C.form.kmFaenaDia" class="${inp}"></label>
          <label v-if="C.tipoSel.value.pluma"><span class="${lab}">Horas de pluma por día</span><input type="number" min="0" step="0.5" v-model.number="C.form.horasPlumaDia" class="${inp}"></label>
        </div>
        <p class="text-[11px] text-slate-500"><i class="fa-solid fa-circle-info"></i> Recorrido total: <b>{{ C.fmtN(C.resultado.value.km) }} km</b> · {{ C.fmtN(C.resultado.value.dias) }} día(s) · {{ C.fmtN(C.resultado.value.litros) }} L de diésel. Usa Google Maps para los km de la ruta.</p>
      </div>

      <div class="${card}">
        <h3 class="${h}"><i class="fa-solid fa-road-barrier text-slate-400"></i> Peajes <span class="normal-case font-semibold text-slate-400">(tarifa {{ C.tipoSel.value.ejes === '2' ? 'camión 2 ejes' : 'camión de más de 2 ejes' }})</span></h3>
        <div class="overflow-x-auto"><table class="w-full text-xs">
          <thead class="bg-slate-50 text-slate-500 uppercase text-[10px]"><tr><th class="p-2 text-left">Usar</th><th class="p-2 text-left">Peaje</th><th class="p-2 text-right">Tarifa</th><th class="p-2 text-center">Pasadas</th><th class="p-2 text-right">Subtotal</th></tr></thead>
          <tbody class="divide-y">
            <tr v-for="p in C.params.peajes" :key="p.id">
              <td class="p-2"><input type="checkbox" :checked="C.pasadasDe(p.id) > 0" @change="C.marcarPeaje(p.id, $event.target.checked)" class="w-4 h-4"></td>
              <td class="p-2"><b>{{ p.nombre }}</b> <span v-if="p.estimado" class="ml-1 px-1.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold" :title="p.nota">ESTIMADO</span><div class="text-[10px] text-slate-400">{{ p.ruta }}</div></td>
              <td class="p-2 text-right font-mono">{{ C.fmt$(C.tipoSel.value.ejes === '2' ? p.c2 : p.c3) }}</td>
              <td class="p-2 text-center"><input type="number" min="0" v-model.number="C.form.peajes[p.id]" class="w-16 p-1 border rounded text-center"></td>
              <td class="p-2 text-right font-mono font-bold">{{ C.fmt$(C.pasadasDe(p.id) * (C.tipoSel.value.ejes === '2' ? p.c2 : p.c3)) }}</td>
            </tr>
          </tbody></table></div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label><span class="${lab}">TAG autopistas urbanas ($)</span><input type="number" min="0" v-model.number="C.form.tagUrbano" class="${inp}"></label>
        </div>
        <p class="text-[10px] text-slate-400">Al marcar un peaje se proponen {{ C.pasadasSugeridas.value }} pasada(s) (viajes × ida/vuelta). Las tarifas se editan en Parámetros.</p>
      </div>

      <div v-if="C.form.conChofer" class="${card}">
        <h3 class="${h}"><i class="fa-solid fa-user-tie text-slate-400"></i> Chofer</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label><span class="${lab}">Horas extra (total)</span><input type="number" min="0" v-model.number="C.form.horasExtra" class="${inp}"></label>
          <label><span class="${lab}">Días con viático</span><input type="number" min="0" v-model.number="C.form.diasViatico" class="${inp}"></label>
          <label><span class="${lab}">Noches de alojamiento</span><input type="number" min="0" v-model.number="C.form.noches" class="${inp}"></label>
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

    <h4 class="text-[11px] font-extrabold uppercase text-slate-600 pt-2">Peajes (tarifa por pasada, un sentido)</h4>
    <div class="overflow-x-auto"><table class="w-full text-[11px]">
      <thead class="bg-slate-50 text-slate-500 uppercase text-[9px]"><tr><th class="p-1 text-left">Peaje</th><th class="p-1 text-left">Ruta</th><th class="p-1">Auto $</th><th class="p-1">Camión 2 ejes $</th><th class="p-1">Camión +2 ejes $</th><th class="p-1">Estimado</th><th class="p-1 text-left">Nota / fuente</th><th></th></tr></thead>
      <tbody class="divide-y">
        <tr v-for="(p, i) in C.params.peajes" :key="p.id">
          <td class="p-1"><input v-model="p.nombre" class="w-48 p-1 border rounded font-bold"></td>
          <td class="p-1"><input v-model="p.ruta" class="w-44 p-1 border rounded"></td>
          <td class="p-1"><input type="number" v-model.number="p.auto" class="w-20 p-1 border rounded"></td>
          <td class="p-1"><input type="number" v-model.number="p.c2" class="w-20 p-1 border rounded"></td>
          <td class="p-1"><input type="number" v-model.number="p.c3" class="w-20 p-1 border rounded"></td>
          <td class="p-1 text-center"><input type="checkbox" v-model="p.estimado"></td>
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
  template,
  setup() {
    onMounted(() => { C.cargarParams(); C.cargarCotizaciones(); });
    const elegirCamion = () => {
      const e = C.camionesFlota.value.find(x => x.afi === C.form.afi);
      const t = e && C.tipoSugerido(e.tipo);
      if (t) C.form.tipo = t.tipo;
    };
    const imprimir = () => window.print();
    return { ...comunes(), C, elegirCamion, imprimir };
  }
};
