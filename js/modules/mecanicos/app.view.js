// =====================================================================
// MECÁNICOS · App móvil (lo que ve el mecánico al entrar desde el celular)
//   Equipos (buscador) → ficha del equipo (horómetro editable, última mantención)
//   → Intervención MECÁNICA / ELÉCTRICA paso a paso (+ registro de bloqueo) → firmas → enviar
//   Mis registros: estado de lo enviado (pendiente de firma, en Historial, rechazada para corregir)
// =====================================================================
import * as S from './mecanicos.service.js';
import { CAUSAS_ELECTRICA, CAUSAS_FALLA_MEC, ENERGIAS, DOCUMENTOS_BLOQUEO, REGLAS_ORO, TIPOS_EQUIPO_BLOQUEO } from './hojas.js';
import { usuarioActivo, config } from '../../core/store.js';
import { listaCausas } from '../historial/historial.service.js';
import { ACEITES } from '../historial/historial.mapper.js';
import { formatDateForDisplay } from '../../core/utils.js';
import { logoSrc, onLogoError } from '../configuracion/configuracion.service.js';

const { ref, computed, onMounted, watch } = Vue;

const CAUSAS_MEC_RAPIDAS = ['No parte', 'Fuga de aceite', 'Fuga de agua', 'Recalentamiento', 'Falla eléctrica', 'Ruido anormal', 'Cambio de repuesto', 'Revisión general'];
const LUGARES = ['TALLER FRC', 'TERRENO', 'FAENA CLIENTE'];

export default {
  name: 'MecanicoApp',
  props: { salir: { type: Function, default: null }, preview: Boolean },
  template: /* html */ `
<div class="min-h-screen bg-slate-100 flex flex-col text-slate-800 max-w-xl mx-auto w-full shadow-xl relative">
  <!-- Barra superior -->
  <header class="sticky top-0 z-30 bg-[#1f4d3a] text-white px-4 py-3 flex items-center gap-3 shadow">
    <button v-if="S.formInt.value" @click="S.cerrarIntervencion()" class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center" aria-label="Volver"><i class="fa-solid fa-arrow-left text-lg"></i></button>
    <button v-else-if="S.equipoSel.value" @click="S.cerrarEquipo()" class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center" aria-label="Volver"><i class="fa-solid fa-arrow-left text-lg"></i></button>
    <div v-else class="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center"><img :src="logoSrc" @error="onLogoError" class="max-h-full max-w-full object-contain" referrerpolicy="no-referrer"></div>
    <div class="flex-1 min-w-0">
      <div class="font-extrabold leading-tight truncate">{{ S.formInt.value ? (S.formInt.value.tipo === 'ELECTRICA' ? 'Intervención eléctrica' : 'Intervención mecánica') + ' · AFI ' + S.formInt.value.afi : S.equipoSel.value ? 'AFI ' + S.equipoSel.value.afi : 'Hola, ' + nombreCorto }}</div>
      <div class="text-[11px] text-emerald-200 truncate">{{ S.formInt.value ? 'Paso ' + S.pasoInt.value + ' de ' + pasos.length + ' · ' + pasos[S.pasoInt.value - 1] : 'App Mecánicos FRC' }}</div>
    </div>
    <button v-if="salir && !S.formInt.value" @click="salir" class="px-3 py-2 rounded-xl bg-rose-600 text-xs font-bold"><i class="fa-solid fa-right-from-bracket mr-1"></i>{{ preview ? 'Cerrar' : 'Salir' }}</button>
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
            <label class="block"><span class="lbl">Fecha</span><input type="date" v-model="f.fecha" class="inp"></label>
            <label class="block"><span class="lbl">Horómetro</span><input v-model="f.horometro" inputmode="decimal" class="inp font-mono" placeholder="Ej: 10875"></label>
          </div>
          <div><span class="lbl">Turno</span>
            <div class="grid grid-cols-2 gap-2 mt-1"><button v-for="t in ['DÍA', 'NOCHE']" :key="t" @click="f.turno = t" :class="['chip-lg', f.turno === t ? 'on' : '']"><i :class="['fa-solid mr-1', t === 'DÍA' ? 'fa-sun' : 'fa-moon']"></i>{{ t }}</button></div>
          </div>
          <label class="block"><span class="lbl">Lugar de la intervención</span><input v-model="f.lugar" list="mec-lugares" class="inp uppercase" placeholder="Ej: TALLER FRC">
            <datalist id="mec-lugares"><option v-for="l in LUGARES" :key="l" :value="l"></option></datalist></label>
          <div class="grid grid-cols-3 gap-2">
            <label v-for="h in [['hora_falla','Hora falla'],['hora_inicio','Hora inicio'],['hora_termino','Hora término']]" :key="h[0]" class="block">
              <span class="lbl">{{ h[1] }}</span><input type="time" v-model="f[h[0]]" class="inp px-2">
              <button @click="f[h[0]] = S.horaAhora()" class="text-[11px] font-bold text-emerald-700 mt-1">Ahora</button>
            </label>
          </div>
        </div>
      </section>

      <!-- Paso 2: qué se hizo -->
      <section v-show="S.pasoInt.value === 2" class="p-4 space-y-3">
        <div class="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div v-if="f.tipo === 'ELECTRICA'"><span class="lbl">Causa de la intervención</span>
            <div class="grid grid-cols-1 gap-2 mt-1"><button v-for="c in CAUSAS_ELECTRICA" :key="c" @click="f.causa_intervencion = c" :class="['chip-lg text-left', f.causa_intervencion === c ? 'on' : '']"><i :class="['fa-solid mr-2', f.causa_intervencion === c ? 'fa-circle-check' : 'fa-circle']"></i>{{ c }}</button></div>
          </div>
          <template v-else>
            <label class="block"><span class="lbl">Causa de la intervención</span>
              <select v-model="f.causa_falla" class="inp font-bold"><option value="">— Elegir —</option><option v-for="c in listaCausas" :key="c" :value="c">{{ c }}</option></select>
              <span class="text-[11px] text-slate-500">Para ubicar qué tipo de trabajo es (igual que en el Historial).</span></label>
            <label class="block"><span class="lbl">Razón de la causa</span>
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
        <div v-if="f.tipo === 'MECANICA'" class="bg-white rounded-2xl p-4 shadow-sm space-y-3">
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
        <div class="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <div><span class="lbl">¿Se usó ART?</span>
            <div class="grid grid-cols-2 gap-2 mt-1"><button @click="f.uso_art = true" :class="['chip-lg', f.uso_art ? 'on' : '']">SÍ</button><button @click="f.uso_art = false" :class="['chip-lg', !f.uso_art ? 'on' : '']">NO</button></div>
            <p v-if="f.uso_art" class="text-[11px] text-slate-500 mt-1"><i class="fa-solid fa-circle-info mr-1"></i>El formulario ART se agregará más adelante.</p>
          </div>
          <div><span class="lbl">¿Hubo bloqueo de equipo?</span>
            <div class="grid grid-cols-2 gap-2 mt-1"><button @click="f.bloqueo = true; S.activarBloqueo(f)" :class="['chip-lg', f.bloqueo ? 'on' : '']">SÍ</button><button @click="f.bloqueo = false" :class="['chip-lg', !f.bloqueo ? 'on' : '']">NO</button></div>
          </div>
        </div>
        <!-- Registro de bloqueo -->
        <template v-if="f.bloqueo && f.registro_bloqueo">
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
        <div v-if="S.faltantes(f).length" class="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-sm text-amber-900">
          <b><i class="fa-solid fa-triangle-exclamation mr-1"></i>Falta:</b> {{ S.faltantes(f).join(' · ') }}
        </div>
      </section>

      <!-- Botones de pasos -->
      <div class="fixed bottom-0 left-0 right-0 z-30 max-w-xl mx-auto bg-white border-t p-3 flex gap-2">
        <button v-if="S.pasoInt.value > 1" @click="S.pasoInt.value--" class="flex-1 py-3.5 rounded-2xl border-2 font-extrabold text-slate-600"><i class="fa-solid fa-chevron-left mr-1"></i>Atrás</button>
        <button v-if="S.pasoInt.value < pasos.length" @click="S.pasoInt.value++" class="flex-[2] py-3.5 rounded-2xl bg-emerald-600 text-white font-extrabold text-lg">Siguiente<i class="fa-solid fa-chevron-right ml-2"></i></button>
        <button v-else @click="S.enviarIntervencion()" :disabled="S.enviando.value" class="flex-[2] py-3.5 rounded-2xl bg-emerald-600 text-white font-extrabold text-lg disabled:opacity-60"><i :class="['fa-solid mr-2', S.enviando.value ? 'fa-spinner fa-spin' : 'fa-paper-plane']"></i>{{ S.enviando.value ? 'Enviando…' : 'Enviar' }}</button>
      </div>
    </template>

    <!-- ========== FICHA DEL EQUIPO ========== -->
    <template v-else-if="S.equipoSel.value">
      <section class="p-4 space-y-3">
        <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div class="p-4">
            <div class="flex items-start justify-between gap-2">
              <div><div class="text-2xl font-black text-[#1f4d3a]">AFI {{ eq.afi }}</div><div class="font-bold text-slate-700">{{ eq.tipo }}</div><div class="text-sm text-slate-500">{{ eq.marca }} {{ eq.modelo }}</div></div>
              <span :class="['text-[11px] font-bold px-2 py-1 rounded-full', S.enTaller(eq) ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800']">{{ eq.disponibilidad }}</span>
            </div>
            <div class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-location-dot mr-1"></i>{{ eq.ubicacion || '—' }}</div>
          </div>
          <div class="grid grid-cols-2 border-t">
            <div class="p-4 border-r"><div class="lbl">Último horómetro</div><div class="text-2xl font-black font-mono text-slate-800">{{ fmtH(eq.horometros?.hTomado) }}</div><div class="text-xs text-slate-500">{{ formatDateForDisplay(eq.horometros?.fechaUltimoHorometro) }}</div></div>
            <div class="p-4"><div class="lbl">Última mantención</div><div class="text-2xl font-black font-mono text-slate-800">{{ fmtH(eq.horometros?.hUltimaMant) }}</div><div class="text-xs text-slate-500">{{ formatDateForDisplay(eq.horometros?.ultimaMantFecha) }}</div></div>
          </div>
        </div>
        <!-- Actualizar horómetro -->
        <div class="bg-white rounded-2xl shadow-sm p-4">
          <div class="lbl mb-1"><i class="fa-solid fa-gauge-high mr-1"></i>Actualizar horómetro</div>
          <div class="flex gap-2"><input v-model="S.horoForm.value.valor" inputmode="decimal" class="inp flex-1 font-mono text-lg" placeholder="Nuevo horómetro"><input type="date" v-model="S.horoForm.value.fecha" class="inp w-36 px-2"></div>
          <button @click="S.guardarHorometro(eq)" :disabled="S.guardandoHoro.value || !S.horoForm.value.valor" class="mt-2 w-full py-3 rounded-xl bg-[#1f4d3a] text-white font-extrabold disabled:opacity-40"><i :class="['fa-solid mr-1', S.guardandoHoro.value ? 'fa-spinner fa-spin' : 'fa-floppy-disk']"></i>Guardar horómetro</button>
        </div>
        <!-- Opciones -->
        <div class="grid grid-cols-1 gap-3">
          <button @click="S.abrirIntervencion('MECANICA', eq)" class="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 text-left active:scale-[.99]"><span class="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl"><i class="fa-solid fa-wrench"></i></span><span class="flex-1"><b class="block text-lg">Intervención mecánica</b><span class="text-xs text-slate-500">FRC-RE-OPE-017</span></span><i class="fa-solid fa-chevron-right text-slate-300"></i></button>
          <button @click="S.abrirIntervencion('ELECTRICA', eq)" class="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4 text-left active:scale-[.99]"><span class="w-14 h-14 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center text-2xl"><i class="fa-solid fa-bolt"></i></span><span class="flex-1"><b class="block text-lg">Intervención eléctrica</b><span class="text-xs text-slate-500">IE-FRC</span></span><i class="fa-solid fa-chevron-right text-slate-300"></i></button>
          <div class="bg-white/60 rounded-2xl p-4 flex items-center gap-4 opacity-60"><span class="w-14 h-14 rounded-2xl bg-slate-200 text-slate-500 flex items-center justify-center text-2xl"><i class="fa-solid fa-oil-can"></i></span><span class="flex-1"><b class="block text-lg">Mantenciones</b><span class="text-xs">Próximamente</span></span></div>
        </div>
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

    <!-- ========== INICIO: EQUIPOS / MIS REGISTROS ========== -->
    <template v-else>
      <section v-show="tab === 'equipos'" class="p-4 space-y-3">
        <div class="sticky top-[64px] z-20 -mx-4 px-4 pb-2 bg-slate-100">
          <div class="relative"><i class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input v-model="S.busquedaEq.value" inputmode="search" placeholder="Buscar AFI, tipo, marca…" class="w-full pl-11 pr-4 py-3.5 rounded-2xl border-0 shadow-sm text-base"></div>
        </div>
        <button v-for="e in S.equiposApp.value.slice(0, limite)" :key="e.id" @click="S.abrirEquipo(e)" class="w-full bg-white rounded-2xl shadow-sm p-4 text-left active:scale-[.99] transition">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0"><div class="text-lg font-black text-[#1f4d3a] leading-tight">AFI {{ e.afi }} <span class="text-sm font-bold text-slate-700">{{ e.tipo }}</span></div><div class="text-xs text-slate-500 truncate">{{ e.marca }} {{ e.modelo }} · {{ e.ubicacion || '—' }}</div></div>
            <span v-if="S.enTaller(e)" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">En taller</span>
          </div>
          <div class="grid grid-cols-2 gap-2 mt-3">
            <div class="bg-slate-50 rounded-xl px-3 py-2"><div class="text-[10px] font-bold uppercase text-slate-500">Último horómetro</div><div class="font-mono font-black">{{ fmtH(e.horometros?.hTomado) }}</div><div class="text-[10px] text-slate-500">{{ formatDateForDisplay(e.horometros?.fechaUltimoHorometro) }}</div></div>
            <div class="bg-slate-50 rounded-xl px-3 py-2"><div class="text-[10px] font-bold uppercase text-slate-500">Última mantención</div><div class="font-mono font-black">{{ fmtH(e.horometros?.hUltimaMant) }}</div><div class="text-[10px] text-slate-500">{{ formatDateForDisplay(e.horometros?.ultimaMantFecha) }}</div></div>
          </div>
        </button>
        <button v-if="S.equiposApp.value.length > limite" @click="limite += 40" class="w-full py-3 rounded-2xl bg-white font-bold text-emerald-700 shadow-sm">Ver más ({{ S.equiposApp.value.length - limite }})</button>
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
            <div><b class="text-[#1f4d3a]">AFI {{ r.afi }}</b> · <span class="text-sm">{{ r.tipo === 'ELECTRICA' ? 'Eléctrica' : 'Mecánica' }}</span><div class="text-xs text-slate-500 font-mono">{{ formatDateForDisplay(r.fecha) }} · N° {{ r.id }}</div></div>
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

      <section v-if="tab === 'tareas'" class="p-3"><recordatorios-view></recordatorios-view></section>

      <!-- Barra inferior -->
      <nav class="fixed bottom-0 left-0 right-0 z-30 max-w-xl mx-auto bg-white border-t grid grid-cols-3">
        <button @click="tab = 'equipos'" :class="['py-3 font-bold text-sm', tab === 'equipos' ? 'text-emerald-700' : 'text-slate-400']"><i class="fa-solid fa-truck-monster block text-xl mb-0.5"></i>Equipos</button>
        <button @click="tab = 'registros'; S.cargarMec()" :class="['py-3 font-bold text-sm relative', tab === 'registros' ? 'text-emerald-700' : 'text-slate-400']"><i class="fa-solid fa-folder block text-xl mb-0.5"></i>Mis documentos
          <span v-if="pendientesMios" class="absolute top-2 right-1/4 bg-rose-500 text-white text-[10px] rounded-full px-1.5">{{ pendientesMios }}</span></button>
        <button @click="tab = 'tareas'" :class="['py-3 font-bold text-sm', tab === 'tareas' ? 'text-emerald-700' : 'text-slate-400']"><i class="fa-solid fa-calendar-check block text-xl mb-0.5"></i>Mis tareas</button>
      </nav>
    </template>
  </main>

  <div v-if="S.toastApp.value" class="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl font-bold text-sm max-w-[90%] text-center">{{ S.toastApp.value }}</div>
</div>`,
  setup() {
    const tab = S.tabApp;
    const limite = ref(40);
    const pasos = ['Datos', 'Trabajo realizado', 'Seguridad', 'Firmas'];
    const f = computed(() => S.formInt.value || {});
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
    onMounted(() => S.cargarMec());
    return { S, usuarioActivo, tab, limite, pasos, f, b, eq, nombreCorto, fmtH, pendientesMios, hayVoz, dictando, dictar, formatDateForDisplay, logoSrc, onLogoError, config,
      CAUSAS_ELECTRICA, CAUSAS_FALLA_MEC, CAUSAS_MEC_RAPIDAS, listaCausas, ACEITES, LUGARES, ENERGIAS, DOCUMENTOS_BLOQUEO, REGLAS_ORO, TIPOS_EQUIPO_BLOQUEO };
  }
};
