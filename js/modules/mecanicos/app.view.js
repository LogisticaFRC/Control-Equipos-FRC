// =====================================================================
// MECÁNICOS · App móvil  (2026-11-13: pestaña TALLER → cartas del programa de reparación, hallazgos y OT asignada) (lo que ve el mecánico al entrar desde el celular)
//   Equipos (buscador) → ficha del equipo (horómetro editable, última mantención)
//   → Intervención MECÁNICA / ELÉCTRICA paso a paso (+ registro de bloqueo) → firmas → enviar
//   Mis registros: estado de lo enviado (pendiente de firma, en Historial, rechazada para corregir)
// =====================================================================
import * as S from './mecanicos.service.js';
import { CAUSAS_ELECTRICA, CAUSAS_FALLA_MEC, ENERGIAS, DOCUMENTOS_BLOQUEO, REGLAS_ORO, TIPOS_EQUIPO_BLOQUEO } from './hojas.js';
import { usuarioActivo, config } from '../../core/store.js';
import { listaCausas } from '../historial/historial.service.js';
import { ACEITES } from '../historial/historial.mapper.js';
import { formatDateForDisplay, hoyISO } from '../../core/utils.js';
import { logoSrc, onLogoError } from '../configuracion/configuracion.service.js';
import TallerMecanico from '../taller/taller-mecanico.view.js';
import ActividadesEquipo from './actividades-equipo.view.js';
import EstandarBoton from '../estandarizacion/estandar-form.view.js';   // Inspección general estandarización (2026-11-18)
import * as F from './fallas-equipo.js';
import LevantamientosEquipo from './levantamientos.view.js';   // carpetas de levantamientos (2026-11-18)   // fallas abiertas del equipo (2026-11-18)
import * as CH from './chofer.service.js';   // CHOFER: check list / report camión pluma (2026-11-17)
import { ChoferChecklist, ChecklistLista } from './chofer-checklist.view.js';
import { CrtgPrograma, CrtgPedido, CrtgUbicacion } from './crtg.view.js';   // TERRENO CRTG (2026-11-17)
import { LOGO_CRTG } from './crtg.service.js';
import * as K from './crtg.service.js';   // TALLER: intervenciones + bloqueo + ART + mantención de un equipo en nave
import { naveDeAfi, colorNave, recargarTaller, navesLibres, cuposNave, CAPACIDAD_NAVE, ingresarANave, equiposEnNaves, problemasPendientes } from '../taller/taller.service.js';   // pestaña TALLER: cartas del programa de reparación + OT asignada + hallazgos

const { ref, computed, onMounted, watch } = Vue;

const CAUSAS_MEC_RAPIDAS = ['No parte', 'Fuga de aceite', 'Fuga de agua', 'Recalentamiento', 'Falla eléctrica', 'Ruido anormal', 'Cambio de repuesto', 'Revisión general'];
const LUGARES = ['TALLER FRC', 'TERRENO', 'FAENA CLIENTE'];

export default {
  name: 'MecanicoApp',
  components: { TallerMecanico, ActividadesEquipo, EstandarBoton, LevantamientosEquipo, ChoferChecklist, ChecklistLista, CrtgPrograma, CrtgPedido, CrtgUbicacion },
  props: { salir: { type: Function, default: null }, preview: Boolean },
  template: /* html */ `
<div class="min-h-screen bg-slate-100 flex flex-col text-slate-800 max-w-xl mx-auto w-full shadow-xl relative">
  <!-- Barra superior -->
  <header class="sticky top-0 z-30 bg-[#1f4d3a] text-white px-4 py-3 flex items-center gap-3 shadow">
    <button v-if="CH.formCheck.value" @click="CH.cerrarChecklist()" class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center" aria-label="Volver"><i class="fa-solid fa-arrow-left text-lg"></i></button>
    <button v-else-if="S.formInt.value" @click="S.cerrarIntervencion()" class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center" aria-label="Volver"><i class="fa-solid fa-arrow-left text-lg"></i></button>
    <button v-else-if="S.equipoSel.value" @click="S.cerrarEquipo()" class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center" aria-label="Volver"><i class="fa-solid fa-arrow-left text-lg"></i></button>
    <button v-else-if="tab !== 'inicio'" @click="tab = 'inicio'" class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center" aria-label="Menú"><i class="fa-solid fa-arrow-left text-lg"></i></button>
    <div v-else class="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center"><img :src="logoSrc" @error="onLogoError" class="max-h-full max-w-full object-contain" referrerpolicy="no-referrer"></div>
    <div class="flex-1 min-w-0">
      <div class="font-extrabold leading-tight truncate">{{ CH.formCheck.value ? 'Check list camión · ' + (CH.formCheck.value.patente || 'nuevo') : S.formInt.value ? (S.formInt.value.modo === 'INSPECCION' ? 'Levantamiento de fallas' : S.formInt.value.tipo === 'ELECTRICA' ? 'Intervención eléctrica' : 'Intervención mecánica') + ' · AFI ' + S.formInt.value.afi : S.equipoSel.value ? 'AFI ' + S.equipoSel.value.afi : (TITULOS[tab] || 'Hola, ' + nombreCorto) }}</div>
      <div class="text-[11px] text-emerald-200 truncate">{{ S.formInt.value ? 'Paso ' + S.pasoInt.value + ' de ' + pasos.length + ' · ' + pasos[S.pasoInt.value - 1] : 'App Técnicos FRC' + (S.cargoActual.value ? ' · ' + S.cargoActual.value : '') + ' · ' + (S.esChofer.value ? 'Chofer' : S.esCrtg.value ? 'Terreno CRTG' : S.esTaller.value ? 'Taller' : 'Terreno') }}</div>
    </div>
    <img v-if="S.esCrtg.value" :src="LOGO_CRTG" alt="CRTG" title="CRTG" class="h-8 w-8 object-contain bg-white rounded-lg p-0.5 shrink-0">
 <select v-if="preview && !S.formInt.value" v-model="S.modoPreview.value" class="text-slate-900 text-xs font-bold rounded-lg px-1.5 py-1.5" title="Ver como"><option value="taller">Taller</option><option value="terreno">Terreno</option><option value="chofer">Chofer</option><option value="crtg">CRTG</option></select>
    <button v-if="salir && !S.formInt.value && !CH.formCheck.value" @click="salir" class="px-3 py-2 rounded-xl bg-rose-600 text-xs font-bold"><i class="fa-solid fa-right-from-bracket mr-1"></i>{{ preview ? 'Cerrar' : 'Salir' }}</button>
  </header>

  <div v-if="S.faltaSQLMec.value" class="m-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-3 text-sm">Falta ejecutar <b>sql/mecanicos.sql</b> en Supabase.</div>

  <main class="flex-1 pb-24">
    <!-- ========== FORMULARIO DE INTERVENCIÓN ========== -->
    <template v-if="S.formInt.value">
      <div class="px-4 pt-3">
        <div class="flex gap-1">
          <button v-for="(p, i) in pasos" :key="i" @click="S.pasoInt.value = i + 1" :class="['flex-1 h-2 rounded-full', i + 1 <= S.pasoInt.value ? 'bg-emerald-600' : 'bg-slate-300']" :aria-label="p"></button>
        </div>
      </div>
      <div v-if="f.motivo_rechazo && f.estado === 'RECHAZADA'" class="mx-4 mt-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-sm"><b>Corregir:</b> {{ f.motivo_rechazo }}</div>

      <!-- Paso 1: datos -->
      <section v-show="S.pasoInt.value === 1" class="p-4 space-y-3">
        <div class="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <label class="block"><span class="lbl">{{ f.modo != null ? 'Fecha inicio' : 'Fecha' }}</span><input type="date" v-model="f.fecha" class="inp"></label>
            <label class="block"><span class="lbl">Horómetro</span><input v-model="f.horometro" inputmode="decimal" class="inp font-mono" placeholder="Ej: 10875"></label>
          </div>
          <div><span class="lbl">Turno</span>
            <div class="grid grid-cols-2 gap-2 mt-1"><button v-for="t in ['DÍA', 'NOCHE']" :key="t" @click="f.turno = t" :class="['chip-lg', f.turno === t ? 'on' : '']"><i :class="['fa-solid mr-1', t === 'DÍA' ? 'fa-sun' : 'fa-moon']"></i>{{ t }}</button></div>
          </div>
          <label class="block"><span class="lbl">Lugar de la intervención</span><input v-model="f.lugar" list="mec-lugares" class="inp uppercase" placeholder="Ej: TALLER FRC">
            <datalist id="mec-lugares"><option v-for="l in LUGARES" :key="l" :value="l"></option></datalist></label>
          <div v-if="f.modo == null" class="grid grid-cols-3 gap-2">
            <label v-for="h in [['hora_falla','Hora falla'],['hora_inicio','Hora inicio'],['hora_termino','Hora término']]" :key="h[0]" class="block">
              <span class="lbl">{{ h[1] }}</span><input type="time" v-model="f[h[0]]" class="inp px-2">
              <button @click="f[h[0]] = S.horaAhora()" class="text-[11px] font-bold text-emerald-700 mt-1">Ahora</button>
            </label>
          </div>
        </div>
      </section>

      <!-- Paso 2: qué se hizo -->
      <section v-show="S.pasoInt.value === 2" class="p-4 space-y-3">
        <!-- 2026-11-18: INSPECCIÓN (observación + fallas enumeradas) o REPARACIÓN de una falla · cada envío = un report -->
        <div v-if="f.modo != null && !f.modoFijo" class="bg-white rounded-2xl p-4 shadow-sm space-y-2">
          <span class="lbl">¿Qué vas a registrar?</span>
          <button @click="S.elegirModo(f, 'INSPECCION')" :class="['chip-lg text-left w-full', f.modo === 'INSPECCION' ? 'on' : '']" data-int="modo-insp"><i class="fa-solid fa-list-ol mr-2"></i>Levantamiento de fallas<span class="block text-[11px] font-normal opacity-80">Sin intervenir el equipo: anota la observación y enumera las fallas</span></button>
          <button @click="S.elegirModo(f, 'REPARACION')" :class="['chip-lg text-left w-full', f.modo === 'REPARACION' ? 'on' : '']" data-int="modo-rep"><i class="fa-solid fa-screwdriver-wrench mr-2"></i>Reparar una falla<span class="block text-[11px] font-normal opacity-80">Elige una falla abierta del equipo y registra lo que hiciste</span></button>
        </div>
        <div v-if="f.modo === 'INSPECCION'" class="bg-white rounded-2xl p-4 shadow-sm space-y-3" data-int="inspeccion">
          <label class="block"><span class="lbl flex items-center justify-between">Observación del equipo
            <button v-if="hayVoz" type="button" @click="dictar('descripcion')" :class="['text-xs font-bold px-2 py-1 rounded-lg', dictando === 'descripcion' ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-50 text-emerald-700']"><i class="fa-solid fa-microphone mr-1"></i>{{ dictando === 'descripcion' ? 'Escuchando…' : 'Dictar' }}</button></span>
            <textarea v-model="f.descripcion" rows="4" class="inp" placeholder="Cómo encontraste el equipo, en qué estado está…"></textarea></label>
          <label class="block" data-int="hora-falla"><span class="lbl">Hora de la falla del equipo</span>
            <div class="flex items-center gap-2"><input type="time" v-model="f.hora_falla" class="inp px-2 w-40"><button @click="f.hora_falla = S.horaAhora()" class="text-[11px] font-bold text-emerald-700">Ahora</button></div>
            <span class="text-[11px] text-slate-500">Cuándo falló o se detuvo el equipo (si aplica). Queda también en las reparaciones de estas fallas.</span></label>
          <div><span class="lbl">Fallas encontradas</span>
            <div v-for="(it, i) in f.fallas" :key="i" class="flex gap-2 items-start mt-3 pb-3 border-b last:border-0" :data-int="'item-' + i">
              <span class="w-8 h-8 mt-1.5 rounded-full bg-amber-500 text-white font-black flex items-center justify-center shrink-0">{{ i + 1 }}</span>
              <div class="flex-1 space-y-1.5 min-w-0">
                <input v-model="it.descripcion" class="inp" :placeholder="i === 0 ? 'Ej: Fuga de aceite en tapa de válvulas' : 'Otra falla'" :disabled="Boolean(it.id)">
                <select v-model="it.sistema" class="inp text-sm py-2" :disabled="Boolean(it.id)"><option value="">Sistema (opcional)</option><option v-for="x in F.SISTEMAS_HALLAZGO" :key="x" :value="x">{{ x }}</option></select>
                <input v-model="it.serie_motor" class="inp text-sm py-2 font-mono" placeholder="Código / serie del motor (si aplica)" :disabled="Boolean(it.id)">
                <label class="flex items-center gap-2 text-sm font-bold text-slate-700 py-1"><input type="checkbox" v-model="it.necesita_repuesto" class="w-5 h-5 accent-amber-500" :disabled="Boolean(it.id)" :data-int="'rep-' + i"><i class="fa-solid fa-gear text-amber-600"></i>Necesita repuesto</label>
                <div v-if="it.necesita_repuesto" class="bg-amber-50 border border-amber-200 rounded-xl p-2 space-y-1.5">
                  <div class="grid gap-2" style="grid-template-columns:minmax(0,1fr) 4.5rem"><input v-model="it.repuesto" class="inp text-sm py-2" placeholder="¿Qué repuesto?" :disabled="Boolean(it.id)"><input v-model="it.cantidad" class="inp text-sm py-2 text-center" placeholder="Cant." inputmode="numeric" :disabled="Boolean(it.id)"></div>
                  <input v-model="it.codigo_repuesto" class="inp text-sm py-2 font-mono" placeholder="Código del repuesto (si tiene)" :disabled="Boolean(it.id)">
                  <p class="text-[10px] text-amber-800"><i class="fa-solid fa-cart-shopping mr-1"></i>Llega a <b>Repuestos pedidos</b> al enviar.</p>
                </div>
                <div class="flex gap-2 items-center">
                  <template v-for="k in [0, 1]" :key="k">
                    <label :class="['w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden cursor-pointer shrink-0', (it.fotos || [])[k] ? 'border-emerald-500' : 'border-slate-300 bg-slate-50']">
                      <img v-if="(it.fotos || [])[k]" :src="it.fotos[k]" class="w-full h-full object-cover" alt="">
                      <i v-else :class="['fa-solid text-slate-400', S.subiendoFoto.value === 'FALLA' + i + k ? 'fa-spinner fa-spin' : 'fa-camera']"></i>
                      <input type="file" accept="image/*" capture="environment" class="hidden" :disabled="Boolean(it.id)" @change="e => S.subirFotoDoc(f, 'FALLA' + i, k, e.target.files[0])"></label>
                  </template>
                  <span class="text-[11px] text-slate-500">Fotos de la falla (hasta 2)</span>
                </div>
              </div>
              <button v-if="f.fallas.length > 1 && !it.id" @click="f.fallas.splice(i, 1)" class="w-9 pt-3 text-rose-500"><i class="fa-solid fa-trash"></i></button>
            </div>
            <button @click="f.fallas.push(S.itemFallaVacio())" class="mt-2 text-sm font-bold text-emerald-700" data-int="agregar-falla"><i class="fa-solid fa-plus mr-1"></i>Agregar falla</button>
            <p class="text-[11px] text-slate-500 mt-1"><i class="fa-solid fa-circle-info mr-1"></i>Al enviar, cada falla queda <b>abierta en el equipo</b> para repararla después, una por una. Si no encontraste fallas, deja la lista vacía.</p>
          </div>
        </div>
        <div v-if="f.modo === 'REPARACION'" class="bg-white rounded-2xl p-4 shadow-sm space-y-2" data-int="elegir-falla">
          <span class="lbl">Falla a reparar</span>
          <button v-for="(h, i) in fallasEq" :key="h.id" @click="S.elegirFalla(f, h)" :class="['chip-lg text-left w-full', String(f.falla_id) === String(h.id) ? 'on' : '']"><i :class="['fa-solid mr-2', String(f.falla_id) === String(h.id) ? 'fa-circle-check' : 'fa-circle']"></i><b>{{ i + 1 }}.</b> {{ h.descripcion }}<span v-if="h.sistema" class="block text-[11px] font-normal opacity-80 pl-6">{{ h.sistema }}</span></button>
          <p v-if="!fallasEq.length" class="text-sm text-slate-400 italic">El equipo no tiene fallas abiertas.</p>
          <button @click="S.elegirFalla(f, null)" :class="['chip text-left', !f.falla_id ? 'on' : '']"><i class="fa-solid fa-plus mr-1"></i>Otra falla (no estaba en la lista)</button>
        </div>
        <div v-if="f.modo == null || f.modo === 'REPARACION'" class="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div v-if="f.tipo === 'ELECTRICA'"><span class="lbl">Causa de la intervención</span>
            <div class="grid grid-cols-1 gap-2 mt-1"><button v-for="c in CAUSAS_ELECTRICA" :key="c" @click="f.causa_intervencion = c" :class="['chip-lg text-left', f.causa_intervencion === c ? 'on' : '']"><i :class="['fa-solid mr-2', f.causa_intervencion === c ? 'fa-circle-check' : 'fa-circle']"></i>{{ c }}</button></div>
            <label class="block mt-3"><span class="lbl">Causa detallada (título)</span><input v-model="f.causa_falla" class="inp" placeholder="Título corto, ej: Contactor quemado"></label>
          </div>
          <template v-else>
            <label class="block"><span class="lbl">Causa de la intervención</span>
              <select v-model="f.causa_falla" class="inp font-bold"><option value="">— Elegir —</option><option v-for="c in listaCausas" :key="c" :value="c">{{ c }}</option></select>
              <span class="text-[11px] text-slate-500">Para ubicar qué tipo de trabajo es (igual que en el Historial).</span></label>
            <label class="block"><span class="lbl">Causa detallada (título)</span>
              <input v-model="f.causa_intervencion" class="inp" placeholder="Título corto: ej. Correa de alternador cortada">
              <div class="flex flex-wrap gap-1.5 mt-2"><button v-for="c in CAUSAS_MEC_RAPIDAS" :key="c" @click="f.causa_intervencion = c" class="chip">{{ c }}</button></div>
            </label>
            <label v-if="f.causa_falla === 'FALLA OPERACIONAL'" class="block"><span class="lbl">Nombre del operador</span><input v-model="f.operador" class="inp"></label>
          </template>
          <label class="block"><span class="lbl flex items-center justify-between">Descripción de lo realizado
            <button v-if="hayVoz" type="button" @click="dictar('descripcion')" :class="['text-xs font-bold px-2 py-1 rounded-lg', dictando === 'descripcion' ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-50 text-emerald-700']"><i class="fa-solid fa-microphone mr-1"></i>{{ dictando === 'descripcion' ? 'Escuchando…' : 'Dictar' }}</button></span>
            <textarea v-model="f.descripcion" rows="7" class="inp" placeholder="Qué se revisó, qué se cambió, cómo quedó el equipo…"></textarea></label>
          <label class="block"><span class="lbl">Interferencia (opcional)</span><textarea v-model="f.interferencia" rows="2" class="inp" placeholder="Algo que impidió o atrasó el trabajo"></textarea></label>
        </div>
        <!-- Tiempo de trabajo (inicio / término y cuánto demoró) -->
        <div v-if="f.modo === 'REPARACION'" class="bg-white rounded-2xl p-4 shadow-sm space-y-2" data-int="tiempo">
          <span class="lbl"><i class="fa-solid fa-stopwatch mr-1"></i>Tiempo de trabajo</span>
          <div class="grid grid-cols-2 gap-2">
            <label class="block"><span class="lbl">Fecha inicio</span><input type="date" v-model="f.fecha" class="inp px-2"></label>
            <label class="block"><span class="lbl">Hora inicio</span><input type="time" v-model="f.hora_inicio" class="inp px-2"><button @click="f.hora_inicio = S.horaAhora()" class="text-[11px] font-bold text-emerald-700 mt-1">Ahora</button></label>
            <label class="block"><span class="lbl">Fecha término</span><input type="date" v-model="f.fecha_termino" class="inp px-2"></label>
            <label class="block"><span class="lbl">Hora término</span><input type="time" v-model="f.hora_termino" class="inp px-2"><button @click="f.hora_termino = S.horaAhora(); f.fecha_termino = hoyISO()" class="text-[11px] font-bold text-emerald-700 mt-1">Ahora</button></label>
          </div>
          <label class="block"><span class="lbl">Hora de la falla</span><input type="time" v-model="f.hora_falla" class="inp px-2 w-40">
            <span v-if="f.levantamiento_id" class="block text-[11px] text-slate-500"><i class="fa-solid fa-link mr-1 text-emerald-700"></i>Viene del levantamiento de fallas N° {{ f.levantamiento_id }}{{ f.hora_falla ? ' (se copió su hora de falla)' : '' }}</span></label>
          <p :class="['text-center font-black text-lg rounded-xl py-2', S.duracionMin(f) == null ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-800']" data-int="duracion"><i class="fa-regular fa-clock mr-1"></i>Duración: {{ S.textoDuracion(S.duracionMin(f)) }}</p>
        </div>
        <div v-if="f.tipo === 'MECANICA' && f.modo !== 'INSPECCION'" class="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div><span class="lbl">Lubricante utilizado</span>
            <div v-for="(l, i) in f.lubricantes" :key="i" class="flex gap-2 mt-1.5">
              <select v-model="l.key" @change="l.tipo = (ACEITES.find(a => a.key === l.key) || {}).label || ''" class="inp flex-1 font-bold"><option value="">— Lubricante —</option><option v-for="a in ACEITES" :key="a.key" :value="a.key">{{ a.label }}</option></select>
              <input v-model="l.cantidad" inputmode="decimal" class="inp w-24" placeholder="Litros">
              <button @click="f.lubricantes.splice(i, 1)" class="w-10 text-rose-500"><i class="fa-solid fa-trash"></i></button>
            </div>
            <button @click="f.lubricantes.push({ key: '', tipo: '', cantidad: '' })" class="mt-2 text-sm font-bold text-emerald-700"><i class="fa-solid fa-plus mr-1"></i>Agregar lubricante</button>
          </div>
          <label class="block"><span class="lbl">Usuario del arriendo (cliente)</span><input v-model="f.usuario_arriendo" class="inp uppercase"></label>
          <label class="block"><span class="lbl">N° vale de consumo (repuestos de bodega)</span><input v-model="f.vale_consumo" inputmode="numeric" class="inp"></label>
        </div>
      </section>

      <!-- Paso 3: seguridad -->
      <section v-show="S.pasoInt.value === 3" class="p-4 space-y-3">
        <!-- 2026-11-18: ART y BLOQUEO se llenan en papel → solo FOTO de las hojas -->
        <div v-if="f.modo != null" class="bg-white rounded-2xl p-4 shadow-sm space-y-4" data-int="seguridad">
          <div><span class="lbl">¿Se usó ART?</span>
            <div class="grid grid-cols-2 gap-2 mt-1"><button @click="f.uso_art = true" :class="['chip-lg', f.uso_art ? 'on' : '']">SÍ</button><button @click="f.uso_art = false" :class="['chip-lg', !f.uso_art ? 'on' : '']">NO</button></div>
            <div v-if="f.uso_art" class="space-y-2 mt-2">
            <div class="border-2 border-dashed rounded-xl p-2 flex items-center gap-3" data-int="foto-art-0">
              <img v-if="(f.art_fotos || [])[0]" :src="(f.art_fotos || [])[0]" class="w-16 h-20 object-cover rounded-lg border" alt="">
              <span v-else class="w-16 h-20 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-2xl"><i class="fa-solid fa-file-image"></i></span>
              <div class="flex-1"><b class="text-sm block">ART · hoja 1</b>
                <label class="inline-block mt-1 px-3 py-2 rounded-lg bg-[#1f4d3a] text-white text-xs font-bold cursor-pointer"><i :class="['fa-solid mr-1', S.subiendoFoto.value === 'ART0' ? 'fa-spinner fa-spin' : 'fa-camera']"></i>{{ (f.art_fotos || [])[0] ? 'Cambiar foto' : 'Tomar / subir foto' }}
                  <input type="file" accept="image/*" capture="environment" class="hidden" @change="e => S.subirFotoDoc(f, 'ART', 0, e.target.files[0])"></label></div>
              <i v-if="(f.art_fotos || [])[0]" class="fa-solid fa-circle-check text-emerald-600 text-xl"></i>
            </div>
            <div class="border-2 border-dashed rounded-xl p-2 flex items-center gap-3" data-int="foto-art-1">
              <img v-if="(f.art_fotos || [])[1]" :src="(f.art_fotos || [])[1]" class="w-16 h-20 object-cover rounded-lg border" alt="">
              <span v-else class="w-16 h-20 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-2xl"><i class="fa-solid fa-file-image"></i></span>
              <div class="flex-1"><b class="text-sm block">ART · hoja 2</b>
                <label class="inline-block mt-1 px-3 py-2 rounded-lg bg-[#1f4d3a] text-white text-xs font-bold cursor-pointer"><i :class="['fa-solid mr-1', S.subiendoFoto.value === 'ART1' ? 'fa-spinner fa-spin' : 'fa-camera']"></i>{{ (f.art_fotos || [])[1] ? 'Cambiar foto' : 'Tomar / subir foto' }}
                  <input type="file" accept="image/*" capture="environment" class="hidden" @change="e => S.subirFotoDoc(f, 'ART', 1, e.target.files[0])"></label></div>
              <i v-if="(f.art_fotos || [])[1]" class="fa-solid fa-circle-check text-emerald-600 text-xl"></i>
            </div>
            </div>
          </div>
          <div><span class="lbl">¿Hubo bloqueo de equipo?</span>
            <div class="grid grid-cols-2 gap-2 mt-1"><button @click="f.bloqueo = true" :class="['chip-lg', f.bloqueo ? 'on' : '']">SÍ</button><button @click="f.bloqueo = false" :class="['chip-lg', !f.bloqueo ? 'on' : '']">NO</button></div>
            <div v-if="f.bloqueo" class="mt-2">
            <div class="border-2 border-dashed rounded-xl p-2 flex items-center gap-3" data-int="foto-bloqueo">
              <img v-if="f.bloqueo_foto" :src="f.bloqueo_foto" class="w-16 h-20 object-cover rounded-lg border" alt="">
              <span v-else class="w-16 h-20 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-2xl"><i class="fa-solid fa-file-image"></i></span>
              <div class="flex-1"><b class="text-sm block">Registro de bloqueo (FRC-RE-OP-015)</b>
                <label class="inline-block mt-1 px-3 py-2 rounded-lg bg-[#1f4d3a] text-white text-xs font-bold cursor-pointer"><i :class="['fa-solid mr-1', S.subiendoFoto.value === 'BLOQUEO0' ? 'fa-spinner fa-spin' : 'fa-camera']"></i>{{ f.bloqueo_foto ? 'Cambiar foto' : 'Tomar / subir foto' }}
                  <input type="file" accept="image/*" capture="environment" class="hidden" @change="e => S.subirFotoDoc(f, 'BLOQUEO', 0, e.target.files[0])"></label></div>
              <i v-if="f.bloqueo_foto" class="fa-solid fa-circle-check text-emerald-600 text-xl"></i>
            </div>
            </div>
          </div>
          <p class="text-[11px] text-slate-500"><i class="fa-solid fa-circle-info mr-1"></i>Los papeles se llenan a mano: saca una foto clara de cada hoja. Quedan en el PDF del report.</p>
        </div>
        <div v-if="f.modo == null" class="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <div><span class="lbl">¿Se usó ART?</span>
            <div class="grid grid-cols-2 gap-2 mt-1"><button @click="f.uso_art = true" :class="['chip-lg', f.uso_art ? 'on' : '']">SÍ</button><button @click="f.uso_art = false" :class="['chip-lg', !f.uso_art ? 'on' : '']">NO</button></div>
            <p v-if="f.uso_art" class="text-[11px] text-slate-500 mt-1"><i class="fa-solid fa-circle-info mr-1"></i>El formulario ART se agregará más adelante.</p>
          </div>
          <div><span class="lbl">¿Hubo bloqueo de equipo?</span>
            <div class="grid grid-cols-2 gap-2 mt-1"><button @click="f.bloqueo = true; S.activarBloqueo(f)" :class="['chip-lg', f.bloqueo ? 'on' : '']">SÍ</button><button @click="f.bloqueo = false" :class="['chip-lg', !f.bloqueo ? 'on' : '']">NO</button></div>
          </div>
        </div>
        <!-- Registro de bloqueo -->
        <template v-if="f.modo == null && f.bloqueo && f.registro_bloqueo">
          <div class="bg-[#1f4d3a] text-white rounded-2xl px-4 py-3 font-extrabold"><i class="fa-solid fa-lock mr-2"></i>Registro de bloqueo <span class="text-[11px] font-normal text-emerald-200 block">FRC-RE-OP-015</span></div>
          <div class="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <h4 class="sec">1 · Identificación del trabajo</h4>
            <label class="block"><span class="lbl">Solicitante del bloqueo</span><input v-model="b.solicitante" class="inp"></label>
            <label class="block"><span class="lbl">Encargado / responsable</span><input v-model="b.encargado" class="inp"></label>
            <label class="block"><span class="lbl">Área / faena</span><input v-model="b.area" class="inp"></label>
            <div class="grid grid-cols-2 gap-2"><label class="block"><span class="lbl">Fecha</span><input type="date" v-model="b.fecha" class="inp"></label><label class="block"><span class="lbl">Hora inicio</span><input type="time" v-model="b.hora_inicio" class="inp"></label></div>
            <label class="block"><span class="lbl">Equipo / código / patente</span><input v-model="b.equipo" class="inp"></label>
            <label class="block"><span class="lbl">Actividad / motivo del bloqueo</span><input v-model="b.actividad" class="inp"></label>
            <div><span class="lbl">Tipo de equipo</span>
              <div class="flex flex-wrap gap-1.5 mt-1"><button v-for="t in [...TIPOS_EQUIPO_BLOQUEO, 'Otro']" :key="t" @click="b.tipo_equipo = t" :class="['chip', b.tipo_equipo === t ? 'on' : '']">{{ t }}</button></div>
              <input v-if="b.tipo_equipo === 'Otro'" v-model="b.otro" class="inp mt-2" placeholder="¿Cuál?">
            </div>
          </div>
          <div class="bg-white rounded-2xl p-4 shadow-sm">
            <h4 class="sec">2 · Energías a controlar</h4>
            <div v-for="(e, i) in ENERGIAS" :key="e" class="flex items-center justify-between py-2 border-b last:border-0">
              <span class="text-sm font-semibold">{{ e }}</span>
              <div class="flex gap-1.5"><button @click="b.energias[i] = b.energias[i] === 'P' ? '' : 'P'" :class="['mini', b.energias[i] === 'P' ? 'bg-amber-500 text-white border-amber-500' : '']">Presente</button><button @click="b.energias[i] = b.energias[i] === 'NA' ? '' : 'NA'" :class="['mini', b.energias[i] === 'NA' ? 'bg-slate-600 text-white border-slate-600' : '']">No aplica</button></div>
            </div>
          </div>
          <div class="bg-white rounded-2xl p-4 shadow-sm">
            <h4 class="sec">3 · Documentación y planificación</h4>
            <div v-for="(d, i) in DOCUMENTOS_BLOQUEO" :key="d" class="py-2 border-b last:border-0">
              <div class="flex items-center justify-between gap-2"><span class="text-sm font-semibold">{{ d }}</span>
                <div class="flex gap-1"><button v-for="o in ['SI','NO','NA']" :key="o" @click="b.documentos[i].r = o" :class="['mini', b.documentos[i].r === o ? 'bg-emerald-600 text-white border-emerald-600' : '']">{{ o === 'NA' ? 'N/A' : o === 'SI' ? 'Sí' : 'No' }}</button></div></div>
              <input v-model="b.documentos[i].codigo" class="inp mt-1.5 text-sm" placeholder="Código del procedimiento / instructivo (opcional)">
            </div>
          </div>
          <div class="bg-white rounded-2xl p-4 shadow-sm">
            <h4 class="sec">4 · Las 6 reglas de oro</h4>
            <div v-for="(g, i) in REGLAS_ORO" :key="g" class="py-2 border-b last:border-0">
              <div class="flex items-center justify-between gap-2"><span class="text-sm font-semibold">{{ i + 1 }}. {{ g }}</span>
                <div class="flex gap-1"><button v-for="o in ['SI','NO','NA']" :key="o" @click="b.reglas[i].r = o" :class="['mini', b.reglas[i].r === o ? 'bg-emerald-600 text-white border-emerald-600' : '']">{{ o === 'NA' ? 'N/A' : o === 'SI' ? 'Sí' : 'No' }}</button></div></div>
              <input v-if="b.reglas[i].r === 'NO'" v-model="b.reglas[i].obs" class="inp mt-1.5 text-sm" placeholder="Observación">
            </div>
            <button @click="b.reglas.forEach(x => x.r = 'SI')" class="mt-2 text-sm font-bold text-emerald-700"><i class="fa-solid fa-check-double mr-1"></i>Marcar todas Sí</button>
          </div>
          <div class="bg-white rounded-2xl p-4 shadow-sm space-y-2">
            <h4 class="sec">5 · Verificación de energía cero</h4>
            <input v-model="b.verificacion.nombre" class="inp" placeholder="Nombre completo del responsable">
            <div class="grid grid-cols-3 gap-2"><input v-model="b.verificacion.rut" class="inp" placeholder="RUT"><input v-model="b.verificacion.candado" class="inp" placeholder="N° candado"><input type="time" v-model="b.verificacion.hora" class="inp px-2"></div>
            <firma-pad :firma="b.verificacion.firma" titulo="Firma verificación energía cero" @guardar="v => b.verificacion.firma = v"></firma-pad>
          </div>
          <div class="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <h4 class="sec">6 · Bloqueo personal</h4>
            <div v-for="(p, i) in b.personal" :key="i" class="border rounded-xl p-3 space-y-2">
              <div class="flex items-center justify-between"><b class="text-sm">Persona {{ i + 1 }}</b><button v-if="b.personal.length > 1" @click="b.personal.splice(i, 1)" class="text-rose-500 text-sm"><i class="fa-solid fa-trash"></i></button></div>
              <input v-model="p.nombre" class="inp" placeholder="Nombre completo">
              <div class="grid grid-cols-2 gap-2"><input v-model="p.rut" class="inp" placeholder="RUT"><input v-model="p.candado" class="inp" placeholder="N° candado / llave"></div>
              <div class="grid grid-cols-2 gap-2"><label><span class="lbl">H. inicio</span><input type="time" v-model="p.h_inicio" class="inp px-2"></label><label><span class="lbl">H. retiro</span><input type="time" v-model="p.h_retiro" class="inp px-2"></label></div>
              <firma-pad :firma="p.firma" :titulo="'Firma bloqueo · ' + (p.nombre || 'persona ' + (i + 1))" @guardar="v => p.firma = v"></firma-pad>
            </div>
            <button v-if="b.personal.length < 5" @click="b.personal.push({ nombre: '', rut: '', candado: '', h_inicio: f.hora_inicio, h_retiro: '', firma: '' })" class="text-sm font-bold text-emerald-700"><i class="fa-solid fa-user-plus mr-1"></i>Agregar persona</button>
          </div>
        </template>
      </section>

      <!-- Paso 4: firmas -->
      <section v-show="S.pasoInt.value === 4" class="p-4 space-y-3">
        <div class="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h4 class="sec">{{ f.tipo === 'ELECTRICA' ? 'Electricista(s)' : 'Mecánico(s) responsable(s)' }}</h4>
          <div v-for="(m, i) in f.mecanicos" :key="i" class="border rounded-xl p-3 space-y-2">
            <div class="flex items-center gap-2">
              <select v-model="m.usuario" @change="m.nombre = S.nombreDeCuenta(m.usuario) || m.nombre" :disabled="i === 0 && m.usuario === (usuarioActivo && usuarioActivo.usuario)" class="inp flex-1 font-bold">
                <option value="">— Sin cuenta (escribir nombre) —</option>
                <option v-for="c in S.cuentasUsuarios.value" :key="c.usuario" :value="c.usuario">{{ c.nombre }}{{ c.mec ? ' · mecánico' : '' }}</option>
              </select>
              <button v-if="i > 0" @click="f.mecanicos.splice(i, 1)" class="w-10 text-rose-500"><i class="fa-solid fa-trash"></i></button></div>
            <input v-model="m.nombre" class="inp" :placeholder="i === 0 ? 'Nombre (responsable)' : 'Nombre'">
            <p v-if="i > 0 && m.usuario" class="text-[11px] text-emerald-700"><i class="fa-solid fa-share-nodes mr-1"></i>Le aparecerá en su carpeta (puede ver el PDF y firmar su parte).</p>
            <firma-pad :firma="m.firma" :titulo="'Firma · ' + (m.nombre || 'mecánico')" @guardar="v => m.firma = v"></firma-pad>
          </div>
          <button v-if="f.mecanicos.length < 4" @click="f.mecanicos.push({ nombre: '', usuario: '', firma: '' })" class="text-sm font-bold text-emerald-700"><i class="fa-solid fa-user-plus mr-1"></i>Agregar otro</button>
        </div>
        <div class="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h4 class="sec">Firma del supervisor</h4>
          <div class="grid grid-cols-1 gap-2">
            <button @click="f.supervisor.modo = 'DESPUES'" :class="['chip-lg text-left', f.supervisor.modo === 'DESPUES' ? 'on' : '']"><i class="fa-solid fa-building mr-2"></i>En taller: firma después el supervisor FRC</button>
            <button @click="f.supervisor.modo = 'AHORA'" :class="['chip-lg text-left', f.supervisor.modo === 'AHORA' ? 'on' : '']"><i class="fa-solid fa-signature mr-2"></i>Firma ahora (supervisor del cliente en terreno)</button>
          </div>
          <template v-if="f.supervisor.modo === 'AHORA'">
            <div class="grid grid-cols-2 gap-2"><button v-for="t in [['CLIENTE','Cliente'],['FRC','FRC']]" :key="t[0]" @click="f.supervisor.tipo = t[0]; if (t[0] === 'FRC') f.supervisor.empresa = 'FAST RENTAL CHILE'" :class="['chip', f.supervisor.tipo === t[0] ? 'on' : '']">Supervisor {{ t[1] }}</button></div>
            <input v-model="f.supervisor.nombre" class="inp" placeholder="Nombre del supervisor">
            <input v-model="f.supervisor.empresa" class="inp uppercase" placeholder="Empresa">
            <firma-pad :firma="f.supervisor.firma" titulo="Firma del supervisor" @guardar="v => f.supervisor.firma = v"></firma-pad>
            <p class="text-[11px] text-emerald-700"><i class="fa-solid fa-circle-check mr-1"></i>Con esta firma la intervención pasa sola al Historial del equipo.</p>
          </template>
        </div>
        <label v-if="f.modo === 'REPARACION'" :class="['flex items-start gap-3 rounded-2xl p-4 border-2 cursor-pointer', f.terminado ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-300']" data-int="terminado">
          <input type="checkbox" v-model="f.terminado" class="w-7 h-7 mt-0.5 accent-emerald-600 shrink-0">
          <span><b class="block text-base">✓ {{ f.modo === 'INSPECCION' ? 'Levantamiento de fallas terminado' : 'Reparación terminada' }}</b>
            <span class="text-xs text-slate-600">{{ f.modo === 'INSPECCION' ? ((f.fallas || []).filter(x => String(x.descripcion || '').trim()).length + ' falla(s) quedarán abiertas en el equipo.') : (f.falla_id ? 'La falla queda REPARADA en el equipo al enviar.' : 'Queda registrada como reparación (falla nueva).') }}</span></span>
        </label>
        <div v-if="S.faltantes(f).length" class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-sm text-amber-900">
          <b><i class="fa-solid fa-triangle-exclamation mr-1"></i>Falta:</b> {{ S.faltantes(f).join(' · ') }}
        </div>
      </section>

      <!-- Botones de pasos -->
      <div class="fixed bottom-0 left-0 right-0 z-30 max-w-xl mx-auto bg-white border-t p-3 flex gap-2">
        <button v-if="S.pasoInt.value > 1" @click="S.pasoInt.value--" class="flex-1 py-3.5 rounded-2xl border-2 font-extrabold text-slate-600"><i class="fa-solid fa-chevron-left mr-1"></i>Atrás</button>
        <button v-if="S.pasoInt.value < pasos.length" @click="S.pasoInt.value++" class="flex-[2] py-3.5 rounded-2xl bg-emerald-600 text-white font-extrabold text-lg">Siguiente<i class="fa-solid fa-chevron-right ml-2"></i></button>
        <button v-else @click="S.enviarIntervencion()" :disabled="S.enviando.value" class="flex-[2] py-3.5 rounded-2xl bg-emerald-600 text-white font-extrabold text-lg disabled:opacity-60"><i :class="['fa-solid mr-2', S.enviando.value ? 'fa-spinner fa-spin' : 'fa-paper-plane']"></i>{{ S.enviando.value ? 'Enviando…' : f.modo === 'INSPECCION' ? 'Crear levantamiento' : 'Enviar' }}</button>
      </div>
    </template>

    <!-- ========== CHOFER: CHECK LIST / REPORT (2026-11-17) ========== -->
    <template v-else-if="CH.formCheck.value"><chofer-checklist></chofer-checklist></template>

    <!-- ========== FICHA DEL EQUIPO ========== -->
    <template v-else-if="S.equipoSel.value">
      <section class="p-4 space-y-3">
        <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div class="p-4">
            <div class="flex items-start justify-between gap-2">
              <img v-if="eq.foto" :src="eq.foto" alt="" class="w-20 h-20 rounded-xl object-cover flex-shrink-0 border" data-foto-ficha>
              <div class="flex-1 min-w-0"><div class="text-2xl font-black text-[#1f4d3a]">AFI {{ eq.afi }}</div><div class="font-bold text-slate-700">{{ eq.tipo }}</div><div class="text-sm text-slate-500">{{ eq.marca }} {{ eq.modelo }}</div></div>
              <span :class="['text-[11px] font-bold px-2 py-1 rounded-full', S.enTaller(eq) ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800']">{{ eq.disponibilidad }}</span>
            </div>
            <div class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-location-dot mr-1"></i>{{ eq.ubicacion || '—' }}</div>
          </div>
          <div class="grid grid-cols-2 border-t">
            <div class="p-4 border-r"><div class="lbl">Último horómetro</div><div class="text-2xl font-black font-mono text-slate-800">{{ fmtH(eq.horometros?.hTomado) }}</div><div class="text-xs text-slate-500">{{ formatDateForDisplay(eq.horometros?.fechaUltimoHorometro) }}</div></div>
            <div class="p-4"><div class="lbl">Última mantención</div><div class="text-2xl font-black font-mono text-slate-800">{{ fmtH(eq.horometros?.hUltimaMant) }}</div><div class="text-xs text-slate-500">{{ formatDateForDisplay(eq.horometros?.ultimaMantFecha) }}</div></div>
          </div>
        </div>
        <!-- CHOFER: solo consulta (sin horómetro ni intervenciones) -->
        <div v-if="S.esChofer.value" class="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-sm text-sky-900"><i class="fa-solid fa-eye mr-1"></i>Perfil <b>Chofer</b>: solo consulta. Los traslados de este equipo se registran en el <b>Check list / Report</b> del camión.</div>
        <template v-else>
        <!-- Actualizar horómetro (TALLER: solo equipos que están en una nave) -->
        <div v-if="S.esTaller.value && !naveDeAfi(eq.afi)" class="bg-slate-50 border rounded-2xl p-4 text-sm text-slate-500"><i class="fa-solid fa-lock mr-1"></i>En taller el horómetro solo se actualiza en equipos que están dentro de una <b>nave</b>.</div>
        <div v-else class="bg-white rounded-2xl shadow-sm p-4">
          <div class="lbl mb-1"><i class="fa-solid fa-gauge-high mr-1"></i>Actualizar horómetro</div>
          <div class="flex gap-2"><input v-model="S.horoForm.value.valor" inputmode="decimal" class="inp flex-1 font-mono text-lg" placeholder="Nuevo horómetro"><input type="date" v-model="S.horoForm.value.fecha" class="inp w-36 px-2"></div>
          <button @click="S.guardarHorometro(eq)" :disabled="S.guardandoHoro.value || !S.horoForm.value.valor" class="mt-2 w-full py-3 rounded-xl bg-[#1f4d3a] text-white font-extrabold disabled:opacity-40"><i :class="['fa-solid mr-1', S.guardandoHoro.value ? 'fa-spinner fa-spin' : 'fa-floppy-disk']"></i>Guardar horómetro</button>
        </div>
        <!-- CRTG: cambiar la ubicación del equipo (queda como movimiento) -->
        <crtg-ubicacion v-if="S.esCrtg.value" :eq="eq"></crtg-ubicacion>
        <button v-if="S.esCrtg.value" @click="K.afiPedido.value = eq.afi; tab = 'repuestos'; S.cerrarEquipo()" class="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 text-left"><span class="w-14 h-14 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center text-2xl"><i class="fa-solid fa-cart-plus"></i></span><span class="flex-1"><b class="block text-lg">Pedir repuestos</b><span class="text-xs text-slate-500">Para este u otro equipo, con fotos</span></span></button>
        <!-- TALLER: solo equipos en nave tienen actividades; los demás solo se pueden agregar a una nave (no programado) -->
        <actividades-equipo v-if="S.esTaller.value && naveDeAfi(eq.afi)" :eq="eq"></actividades-equipo>
        <div v-else-if="S.esTaller.value" class="bg-white rounded-2xl shadow-sm p-4 space-y-2">
          <div class="lbl"><i class="fa-solid fa-warehouse mr-1"></i>Agregar a una nave (equipo no programado)</div>
          <p class="text-xs text-slate-500">En taller solo se trabaja con equipos que están en una nave. Si este equipo llegó sin estar en el programa, ingrésalo a una nave:</p>
          <div v-if="navesLibres.length" class="grid grid-cols-2 gap-2">
            <button v-for="n in navesLibres" :key="n" @click="agregarANave(n)" :disabled="ocupado" :class="['py-3 rounded-xl font-black border-2 bg-white disabled:opacity-50', colorNave(n).borde, colorNave(n).txt]">{{ n }}<span class="block text-[10px] font-bold opacity-80">quedan {{ cuposNave(n) }} de {{ CAPACIDAD_NAVE }}</span></button>
          </div>
          <p v-else class="text-sm text-slate-500">Todas las naves están llenas.</p>
        </div>
        <!-- TERRENO: opciones de siempre -->
        <div v-else class="grid grid-cols-1 gap-3">
          <levantamientos-equipo :eq="eq" @reparar="x => S.abrirIntervencion(x.tipo, eq, x.falla)"></levantamientos-equipo>
          <button @click="S.abrirLevantamiento(eq)" class="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 text-left active:scale-[.99]" data-menu="levantamiento"><span class="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl"><i class="fa-solid fa-list-ol"></i></span><span class="flex-1"><b class="block text-lg">Levantamiento de fallas</b><span class="text-xs text-slate-500">Observación del equipo y fallas enumeradas</span></span><i class="fa-solid fa-chevron-right text-slate-300"></i></button>
          <estandar-boton :eq="eq"></estandar-boton>
          <button @click="S.abrirIntervencion('ELECTRICA', eq)" class="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 text-left active:scale-[.99]"><span class="w-14 h-14 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center text-2xl"><i class="fa-solid fa-bolt"></i></span><span class="flex-1"><b class="block text-lg">Intervención eléctrica</b><span class="text-xs text-slate-500">IE-FRC</span></span><i class="fa-solid fa-chevron-right text-slate-300"></i></button>
          <div class="bg-white/60 rounded-2xl p-4 flex items-center gap-4 opacity-60"><span class="w-14 h-14 rounded-2xl bg-slate-200 text-slate-500 flex items-center justify-center text-2xl"><i class="fa-solid fa-oil-can"></i></span><span class="flex-1"><b class="block text-lg">Mantenciones</b><span class="text-xs">Próximamente</span></span></div>
        </div>
        </template>
        <!-- Últimos registros -->
        <div class="bg-white rounded-2xl shadow-sm p-4">
          <div class="lbl mb-2">Últimos registros del equipo</div>
          <div v-for="r in S.ultimosRegistros(eq.afi)" :key="r.id" class="py-2 border-b last:border-0 text-sm">
            <div class="flex justify-between"><b>{{ r.causa || r.tipoMant }}</b><span class="text-xs text-slate-500 font-mono">{{ formatDateForDisplay(r.fecha) }}</span></div>
            <div class="text-xs text-slate-500 line-clamp-2">{{ r.causaDetallada || r.descripcion }}</div>
          </div>
          <div v-if="!S.ultimosRegistros(eq.afi).length" class="text-sm text-slate-400 italic">Sin registros.</div>
        </div>
      </section>
    </template>

    <!-- ========== MENÚ EN TARJETAS (2026-11-16) / EQUIPOS / TALLER / DOCUMENTOS / TAREAS ========== -->
    <template v-else>
      <section v-if="tab === 'inicio'" class="p-4 space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <button v-for="c in tarjetas" :key="c.tab" @click="irA(c.tab)" :class="['relative bg-white rounded-3xl shadow-sm p-4 text-left active:scale-[.98] transition flex flex-col gap-3 min-h-[150px]', c.ancha ? 'col-span-2' : '']">
            <span :class="['w-14 h-14 rounded-2xl flex items-center justify-center text-2xl', c.color]"><i :class="['fa-solid', c.icon]"></i></span>
            <span><b class="block text-lg leading-tight text-slate-800">{{ c.titulo }}</b><span class="text-xs text-slate-500">{{ c.sub }}</span></span>
            <span v-if="c.badge" class="absolute top-3 right-3 bg-rose-500 text-white text-xs font-black rounded-full px-2 py-0.5">{{ c.badge }}</span>
          </button>
        </div>
        <instalar-app v-if="!preview"></instalar-app>
      </section>

      <section v-show="tab === 'equipos'" class="p-4 space-y-3">
        <p v-if="S.esTaller.value" class="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-2.5"><i class="fa-solid fa-circle-info mr-1"></i>Las actividades se hacen en los equipos <b>en nave</b> (primero en la lista). Los demás aparecen solo para <b>agregar a una nave</b> un equipo no programado.</p>
        <div class="sticky top-[64px] z-20 -mx-4 px-4 pb-2 bg-slate-100">
          <div class="relative"><i class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input v-model="S.busquedaEq.value" inputmode="search" placeholder="Buscar AFI, tipo, marca…" class="w-full pl-11 pr-4 py-3.5 rounded-2xl border-0 shadow-sm text-base"></div>
        </div>
        <button v-for="e in listaEquipos.slice(0, limite)" :key="e.id" @click="S.abrirEquipo(e)" class="w-full bg-white rounded-2xl shadow-sm p-4 text-left active:scale-[.99] transition">
          <div class="flex items-start justify-between gap-2">
            <span class="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center" data-foto-eq><img v-if="e.foto" :src="e.foto" loading="lazy" alt="" class="w-full h-full object-cover"><i v-else class="fa-solid fa-truck-monster text-slate-300 text-xl"></i></span>
            <div class="min-w-0 flex-1"><div class="text-lg font-black text-[#1f4d3a] leading-tight">AFI {{ e.afi }} <span class="text-sm font-bold text-slate-700">{{ e.tipo }}</span></div><div class="text-xs text-slate-500 truncate">{{ e.marca }} {{ e.modelo }} · {{ e.ubicacion || '—' }}</div></div>
            <span class="flex flex-col items-end gap-1">
            <span v-if="S.esTaller.value && naveDeAfi(e.afi)" :class="['text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap', colorNave(naveDeAfi(e.afi)).chip]">{{ naveDeAfi(e.afi) }}</span>
            <span v-else-if="S.enTaller(e)" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">En taller</span>
            <span v-if="F.fallasAbiertasDe(e.afi).length" class="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white whitespace-nowrap" data-eq-fallas><i class="fa-solid fa-triangle-exclamation mr-0.5"></i>{{ F.fallasAbiertasDe(e.afi).length }} falla{{ F.fallasAbiertasDe(e.afi).length === 1 ? '' : 's' }} abierta{{ F.fallasAbiertasDe(e.afi).length === 1 ? '' : 's' }}</span>
            </span>
          </div>
          <div class="grid grid-cols-2 gap-2 mt-3">
            <div class="bg-slate-50 rounded-xl px-3 py-2"><div class="text-[10px] font-bold uppercase text-slate-500">Último horómetro</div><div class="font-mono font-black">{{ fmtH(e.horometros?.hTomado) }}</div><div class="text-[10px] text-slate-500">{{ formatDateForDisplay(e.horometros?.fechaUltimoHorometro) }}</div></div>
            <div class="bg-slate-50 rounded-xl px-3 py-2"><div class="text-[10px] font-bold uppercase text-slate-500">Última mantención</div><div class="font-mono font-black">{{ fmtH(e.horometros?.hUltimaMant) }}</div><div class="text-[10px] text-slate-500">{{ formatDateForDisplay(e.horometros?.ultimaMantFecha) }}</div></div>
          </div>
        </button>
        <button v-if="listaEquipos.length > limite" @click="limite += 40" class="w-full py-3 rounded-2xl bg-white font-bold text-emerald-700 shadow-sm">Ver más ({{ listaEquipos.length - limite }})</button>
        <div v-if="!S.equiposApp.value.length" class="text-center text-slate-400 py-10">No hay equipos con esa búsqueda.</div>
      </section>

      <section v-show="tab === 'registros'" class="p-4 space-y-3">
        <!-- Mi carpeta: sin firma / realizados y entregados -->
        <div class="grid grid-cols-2 gap-2 bg-white rounded-2xl p-1.5 shadow-sm">
          <button @click="S.carpetaApp.value = 'SIN_FIRMA'" :class="['py-3 rounded-xl font-extrabold text-sm', S.carpetaApp.value === 'SIN_FIRMA' ? 'bg-amber-500 text-white' : 'text-slate-500']"><i class="fa-solid fa-folder-open mr-1"></i>Sin firma ({{ S.misSinFirma.value.length }})</button>
          <button @click="S.carpetaApp.value = 'REALIZADOS'" :class="['py-3 rounded-xl font-extrabold text-sm', S.carpetaApp.value === 'REALIZADOS' ? 'bg-emerald-600 text-white' : 'text-slate-500']"><i class="fa-solid fa-folder-closed mr-1"></i>Realizados ({{ S.misRealizados.value.length }})</button>
        </div>
        <div v-for="r in (S.carpetaApp.value === 'SIN_FIRMA' ? S.misSinFirma.value : S.misRealizados.value)" :key="r.id" class="bg-white rounded-2xl shadow-sm p-4">
          <div class="flex items-start justify-between gap-2">
            <div><b class="text-[#1f4d3a]">AFI {{ r.afi }}</b> · <span class="text-sm">{{ r.modo === 'INSPECCION' ? 'Levantamiento de fallas · ' : r.modo === 'REPARACION' ? 'Reparación · ' : '' }}{{ r.tipo === 'ELECTRICA' ? 'Eléctrica' : 'Mecánica' }}</span><div class="text-xs text-slate-500 font-mono">{{ formatDateForDisplay(r.fecha) }} · N° {{ r.id }}</div></div>
            <span :class="['text-[10px] font-bold px-2 py-1 rounded-full border whitespace-nowrap', S.ESTADOS_MEC[r.estado]?.c]"><i :class="['fa-solid mr-1', S.ESTADOS_MEC[r.estado]?.i]"></i>{{ S.ESTADOS_MEC[r.estado]?.t }}</span>
          </div>
          <div class="text-sm text-slate-600 mt-1 line-clamp-2"><b v-if="r.tipo === 'MECANICA' && r.causa_falla">{{ r.causa_falla }} · </b>{{ r.causa_intervencion }} — {{ r.descripcion }}</div>
          <div class="text-[11px] text-slate-500 mt-1"><i class="fa-solid fa-users mr-1"></i>{{ (r.mecanicos || []).map(m => m.nombre + (m.firma ? ' ✔' : ' (sin firma)')).join(' · ') }}
            <span v-if="String(r.creado_por || '').toLowerCase() !== String(usuarioActivo && usuarioActivo.usuario || '').toLowerCase()" class="ml-1 font-bold text-indigo-600"><i class="fa-solid fa-share-nodes mr-0.5"></i>compartido por {{ S.nombreDeCuenta(r.creado_por) || r.creado_por }}</span></div>
          <div v-if="r.estado === 'RECHAZADA'" class="mt-2 text-sm bg-rose-50 text-rose-800 rounded-lg p-2"><b>Corregir:</b> {{ r.motivo_rechazo }}</div>
          <div class="flex gap-2 mt-3">
            <button v-if="['PENDIENTE_FIRMA','RECHAZADA'].includes(r.estado)" @click="S.editarRegistro(r)" class="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-sm"><i class="fa-solid fa-pen mr-1"></i>{{ r.estado === 'RECHAZADA' ? 'Corregir y reenviar' : 'Editar / firma supervisor' }}</button>
            <button @click="S.descargarPDF(r)" class="flex-1 py-2.5 rounded-xl border font-bold text-sm text-slate-700"><i class="fa-solid fa-file-pdf mr-1 text-rose-600"></i>Ver hoja</button>
          </div>
        </div>
        <div v-if="!(S.carpetaApp.value === 'SIN_FIRMA' ? S.misSinFirma.value : S.misRealizados.value).length" class="text-center text-slate-400 py-10">{{ S.carpetaApp.value === 'SIN_FIRMA' ? 'No tienes documentos esperando firma.' : 'Aún no hay documentos realizados.' }}</div>
      </section>

      <section v-if="tab === 'taller' && S.esTaller.value"><taller-mecanico></taller-mecanico></section>

      <section v-if="tab === 'tareas'" class="p-3"><recordatorios-view></recordatorios-view></section>

      <!-- TERRENO CRTG (2026-11-17) -->
      <crtg-programa v-if="tab === 'progcrtg' && S.esCrtg.value"></crtg-programa>
      <crtg-pedido v-if="tab === 'repuestos' && S.esCrtg.value"></crtg-pedido>

      <!-- CHOFER (2026-11-17) -->
      <section v-if="tab === 'checklist' && S.esChofer.value" class="p-4 space-y-3">
        <div class="lbl">¿Qué vehículo manejas?</div>
        <button v-for="fm in CH.FORMATOS_CHOFER" :key="fm.key" @click="fm.activo && CH.nuevoChecklist(fm.key)" :disabled="!fm.activo" :data-chofer="fm.activo ? 'nuevo' : null"
          :class="['w-full rounded-3xl shadow p-5 text-left flex items-center gap-4', fm.activo ? 'bg-sky-600 text-white active:scale-[.99]' : 'bg-white/70 text-slate-400']">
          <span :class="['w-14 h-14 rounded-2xl flex items-center justify-center text-2xl', fm.activo ? 'bg-white/20' : 'bg-slate-200']"><i :class="['fa-solid', fm.icon]"></i></span>
          <span><b class="block text-lg">{{ fm.titulo }}</b><span :class="['text-xs', fm.activo ? 'text-sky-100' : '']">{{ fm.activo ? 'Check list / report · ' + fm.codigo : 'Formato pendiente de cargar' }}</span></span>
        </button>
      </section>
      <section v-if="tab === 'docschofer' && S.esChofer.value" class="p-4 space-y-3">
        <checklist-lista></checklist-lista>
      </section>

    </template>
  </main>

  <div v-if="S.toastApp.value" class="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl font-bold text-sm max-w-[90%] text-center">{{ S.toastApp.value }}</div>
</div>`,
  setup() {
    const tab = S.tabApp;
    const limite = ref(40);
    // 2026-11-18: el LEVANTAMIENTO termina en el paso 2 (Crear); la REPARACIÓN de cada falla lleva tiempos, ART, bloqueo y firmas
    const pasos = computed(() => (S.formInt.value?.modo === 'INSPECCION' ? ['Datos', 'Fallas encontradas'] : ['Datos', 'Trabajo realizado', 'Seguridad', 'Firmas']));
    const f = computed(() => S.formInt.value || {});
    const fallasEq = computed(() => (S.formInt.value ? F.fallasAbiertasDe(S.formInt.value.afi) : []));
    const b = computed(() => (S.formInt.value && S.formInt.value.registro_bloqueo) || {});
    const eq = computed(() => S.equipoSel.value || {});
    const nombreCorto = computed(() => String(usuarioActivo.value?.nombre || usuarioActivo.value?.usuario || '').split(' ')[0]);
    const fmtH = (h) => (Number(h) > 0 ? Number(h).toLocaleString('es-CL') + ' h' : '—');
    const pendientesMios = computed(() => S.misRegistros.value.filter(r => r.estado === 'RECHAZADA').length);
    // borrador automático mientras escribe
    watch(() => S.formInt.value, () => S.guardarBorrador(), { deep: true });
    // dictado por voz (Chrome / Edge / Android)
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const hayVoz = Boolean(Rec);
    const dictando = ref('');
    let rec = null;
    const dictar = (campo) => {
      if (dictando.value) { rec && rec.stop(); dictando.value = ''; return; }
      rec = new Rec(); rec.lang = 'es-CL'; rec.continuous = true; rec.interimResults = false;
      rec.onresult = (ev) => { const t = [...ev.results].slice(ev.resultIndex).map(x => x[0].transcript).join(' '); const fm = S.formInt.value; fm[campo] = (fm[campo] ? fm[campo] + ' ' : '') + t.trim(); };
      rec.onend = () => { dictando.value = ''; };
      dictando.value = campo; rec.start();
    };
    onMounted(() => { S.cargarMec(); F.asegurarFallas(); if (S.esTaller.value) recargarTaller(); });
    // TERRENO no tiene Taller: si quedó en esa pantalla, vuelve al menú
    watch(() => S.esTaller.value, (t) => { if (!t && tab.value === 'taller') tab.value = 'inicio'; if (t) recargarTaller(); }, { immediate: true });
    // Menú en tarjetas
    const TITULOS = { equipos: 'Equipos', taller: 'Taller · Naves', registros: 'Mis documentos', tareas: 'Mis tareas', checklist: 'Check list / Report', progcrtg: 'Programa CRTG', repuestos: 'Pedir repuestos', docschofer: 'Mis documentos' };
    const irA = (t) => { tab.value = t; if (t === 'registros') S.cargarMec(); if (t === 'taller') recargarTaller(); window.scrollTo(0, 0); };
    const tarjetas = computed(() => S.esCrtg.value ? [
      { tab: 'equipos', titulo: 'Equipos CRTG', sub: S.equiposApp.value.length + ' equipos · horómetro, ubicación e intervenciones', icon: 'fa-truck-monster', color: 'bg-blue-100 text-blue-700', ancha: true },
      { tab: 'progcrtg', titulo: 'Programa mantención', sub: 'CRTG · marcar realizado / no realizado', icon: 'fa-calendar-check', color: 'bg-emerald-100 text-emerald-700' },
      { tab: 'repuestos', titulo: 'Pedir repuestos', sub: 'Equipo, descripción y fotos', icon: 'fa-cart-plus', color: 'bg-orange-100 text-orange-700' },
      { tab: 'registros', titulo: 'Mis documentos', sub: 'Sin firma y realizados', icon: 'fa-folder-open', color: 'bg-sky-100 text-sky-700', badge: pendientesMios.value },
      { tab: 'tareas', titulo: 'Mis tareas', sub: 'Recordatorios', icon: 'fa-list-check', color: 'bg-violet-100 text-violet-700' }
    ] : S.esChofer.value ? [
      { tab: 'checklist', titulo: 'Check list / Report', sub: 'Datos del camión, check list, traslados y firma', icon: 'fa-clipboard-check', color: 'bg-sky-100 text-sky-700', ancha: true },
      { tab: 'docschofer', titulo: 'Mis documentos', sub: 'Check list enviados (Excel)', icon: 'fa-folder-open', color: 'bg-amber-100 text-amber-700' },
      { tab: 'equipos', titulo: 'Equipos', sub: 'Consulta', icon: 'fa-truck-monster', color: 'bg-emerald-100 text-emerald-700' },
      { tab: 'tareas', titulo: 'Mis tareas', sub: 'Recordatorios', icon: 'fa-calendar-check', color: 'bg-violet-100 text-violet-700', ancha: true }
    ] : S.esTaller.value ? [
      { tab: 'taller', titulo: 'Taller · Naves', sub: equiposEnNaves.value + ' equipo(s) en naves · inspección, OT, intervenciones', icon: 'fa-warehouse', color: 'bg-amber-100 text-amber-700', ancha: true },
      { tab: 'equipos', titulo: 'Equipos', sub: 'Agregar a nave un equipo no programado', icon: 'fa-truck-monster', color: 'bg-emerald-100 text-emerald-700' },
      { tab: 'registros', titulo: 'Mis documentos', sub: 'Sin firma y realizados', icon: 'fa-folder-open', color: 'bg-sky-100 text-sky-700', badge: pendientesMios.value },
      { tab: 'tareas', titulo: 'Mis tareas', sub: 'Recordatorios', icon: 'fa-calendar-check', color: 'bg-violet-100 text-violet-700', ancha: true }
    ] : [
      { tab: 'equipos', titulo: 'Equipos', sub: 'Horómetro e intervenciones', icon: 'fa-truck-monster', color: 'bg-emerald-100 text-emerald-700', ancha: true },
      { tab: 'registros', titulo: 'Mis documentos', sub: 'Sin firma y realizados', icon: 'fa-folder-open', color: 'bg-sky-100 text-sky-700', badge: pendientesMios.value },
      { tab: 'tareas', titulo: 'Mis tareas', sub: 'Recordatorios', icon: 'fa-calendar-check', color: 'bg-violet-100 text-violet-700' }
    ]);
    // TALLER: equipos en nave primero
    const listaEquipos = computed(() => S.esTaller.value
      ? [...S.equiposApp.value].sort((a, b) => (Boolean(naveDeAfi(b.afi)) - Boolean(naveDeAfi(a.afi))))
      : S.equiposApp.value);
    const ocupado = ref(false);
    const agregarANave = async (nave) => {
      const e = S.equipoSel.value; if (!e) return;
      if (!confirm(`¿Ingresar el AFI ${e.afi} a la ${nave} como equipo NO programado?`)) return;
      ocupado.value = true;
      try { if (await ingresarANave(nave, { afi: e.afi })) S.avisoApp(`AFI ${e.afi} ingresado a la ${nave} ✔`); }
      finally { ocupado.value = false; }
    };
    return { F, fallasEq, hoyISO, S, CH, K, LOGO_CRTG, naveDeAfi, colorNave, navesLibres, cuposNave, CAPACIDAD_NAVE, TITULOS, irA, tarjetas, listaEquipos, ocupado, agregarANave, usuarioActivo, tab, limite, pasos, f, b, eq, nombreCorto, fmtH, pendientesMios, hayVoz, dictando, dictar, formatDateForDisplay, logoSrc, onLogoError, config,
      CAUSAS_ELECTRICA, CAUSAS_FALLA_MEC, CAUSAS_MEC_RAPIDAS, listaCausas, ACEITES, LUGARES, ENERGIAS, DOCUMENTOS_BLOQUEO, REGLAS_ORO, TIPOS_EQUIPO_BLOQUEO };
  }
};
