// =====================================================================
// CHOFER · Formulario Check list / Report Camión Pluma (app del celular) · 2026-11-17
// 4 pasos: Camión · Check list · Traslados (hoja para añadir cada uno) · Firma y enviar. Ver chofer.service.js.
// =====================================================================
import * as C from './chofer.service.js';
import { dbEquipos, usuarioActivo, buscarEquipoPorAfi } from '../../core/store.js';
import { formatDateForDisplay, mismoAfi } from '../../core/utils.js';
import { esVehiculo } from '../inventario/inventario.mapper.js';

const { watch, ref, computed } = Vue;

export const ChoferChecklist = {
  name: 'ChoferChecklist',
  template: /* html */ `
<div v-if="f" class="pb-28">
  <!-- Pasos -->
  <div class="px-4 pt-3 sticky top-[64px] z-20 bg-slate-100 pb-2">
    <div class="grid grid-cols-4 gap-1.5">
      <button v-for="(p, i) in C.PASOS_CHECK" :key="i" @click="C.pasoCheck.value = i + 1" class="text-left">
        <span :class="['block h-1.5 rounded-full', i + 1 <= C.pasoCheck.value ? 'bg-sky-600' : 'bg-slate-300']"></span>
        <span :class="['block text-[10px] font-bold mt-1 leading-tight', i + 1 === C.pasoCheck.value ? 'text-sky-700' : 'text-slate-400']">{{ i + 1 }}. {{ p }}</span>
      </button>
    </div>
  </div>

  <!-- ===== 1 · CAMIÓN ===== -->
  <section v-show="C.pasoCheck.value === 1" class="p-4 space-y-3">
    <!-- Camión elegido -->
    <div v-if="camionSel" class="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
      <span class="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center text-xl"><i class="fa-solid fa-truck"></i></span>
      <div class="flex-1 min-w-0"><p class="text-xl font-black text-slate-800 font-mono">{{ f.patente }}</p><p class="text-xs text-slate-500 truncate">{{ f.marca }} {{ f.modelo }}</p></div>
      <button @click="cambiarCamion" class="px-3 py-2 rounded-xl border font-bold text-xs text-slate-600">Cambiar</button>
    </div>
    <!-- Elegir camión -->
    <div v-else class="bg-white rounded-2xl shadow-sm p-4 space-y-2">
      <p class="lbl">¿Qué camión usas hoy?</p>
      <input v-model="buscaCamion" placeholder="Buscar patente…" class="inp uppercase font-mono" data-chofer="buscar-camion">
      <button v-for="c in camionesFiltrados" :key="c.id" @click="elegirCamion(c)" :data-camion="c.afi"
        class="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-slate-100 active:bg-sky-50 text-left">
        <i class="fa-solid fa-truck text-sky-600"></i>
        <span class="flex-1"><b class="font-mono">{{ c.afi }}</b> <span class="text-xs text-slate-500">{{ c.tipo }} {{ c.marca }} {{ c.modelo }}</span></span>
        <i class="fa-solid fa-chevron-right text-slate-300"></i>
      </button>
      <p v-if="!camionesFiltrados.length" class="text-xs text-slate-400 italic">No hay camiones con esa patente en el inventario.</p>
    </div>

    <label class="block bg-white rounded-2xl shadow-sm p-4"><span class="lbl">Fecha</span><input type="date" v-model="f.fecha" class="inp"></label>

    <!-- Documentos del camión: solo si hay información en Vehículos -->
    <div v-if="f.venc_revision || f.venc_permiso" class="bg-white rounded-2xl shadow-sm p-4 space-y-2">
      <p class="lbl"><i class="fa-solid fa-file-shield mr-1"></i>Documentos del camión</p>
      <div v-for="d in docs" :key="d.k" class="flex items-center justify-between gap-2">
        <span class="text-sm font-semibold text-slate-700">{{ d.l }}<span class="block text-xs text-slate-400 font-mono">vence {{ formatDateForDisplay(d.v) }}</span></span>
        <span :class="['text-[11px] font-black rounded-full px-2.5 py-1', C.estadoVenc(d.v, f.fecha).clase]" :data-chofer="'estado_' + d.k">{{ C.estadoVenc(d.v, f.fecha).texto }}</span>
      </div>
    </div>

    <!-- Kilometraje y horas -->
    <div class="bg-white rounded-2xl shadow-sm p-4 space-y-3">
      <p class="lbl"><i class="fa-solid fa-gauge-high mr-1"></i>Camión</p>
      <div class="grid grid-cols-[4.5rem_1fr_1fr] gap-2 items-center text-center">
        <span></span><span class="text-[10px] font-bold text-slate-400">INICIO</span><span class="text-[10px] font-bold text-slate-400">TÉRMINO</span>
        <span class="text-xs font-black text-slate-600 text-left">Km</span>
        <input v-model="f.km_ini" inputmode="numeric" class="inp px-2 font-mono text-center" data-chofer="km_ini">
        <input v-model="f.km_fin" inputmode="numeric" class="inp px-2 font-mono text-center" data-chofer="km_fin">
        <span class="text-xs font-black text-slate-600 text-left">Horas</span>
        <input v-model="f.cam_hrs_ini" inputmode="decimal" class="inp px-2 font-mono text-center">
        <input v-model="f.cam_hrs_fin" inputmode="decimal" class="inp px-2 font-mono text-center">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <label class="block"><span class="text-[10px] font-bold text-slate-400">PRÓX. MANT. (KM)</span><input v-model="f.km_prox" inputmode="numeric" class="inp px-2 font-mono"></label>
        <label class="block"><span class="text-[10px] font-bold text-slate-400">PRÓX. MANT. (HRS)</span><input v-model="f.cam_hrs_prox" inputmode="decimal" class="inp px-2 font-mono"></label>
      </div>
      <p class="lbl pt-1"><i class="fa-solid fa-trowel mr-1"></i>Pluma</p>
      <div class="grid grid-cols-2 gap-2">
        <label class="block"><span class="text-[10px] font-bold text-slate-400">HRS INICIO</span><input v-model="f.pluma_hrs_ini" inputmode="decimal" class="inp px-2 font-mono"></label>
        <label class="block"><span class="text-[10px] font-bold text-slate-400">HRS TÉRMINO</span><input v-model="f.pluma_hrs_fin" inputmode="decimal" class="inp px-2 font-mono"></label>
      </div>
      <label class="block"><span class="text-[10px] font-bold text-slate-400">FECHA PRÓX. MANTENCIÓN PLUMA</span><input type="date" v-model="f.pluma_prox_fecha" class="inp" data-chofer="pluma_prox"></label>
    </div>
  </section>

  <!-- ===== 2 · CHECK LIST ===== -->
  <section v-show="C.pasoCheck.value === 2" class="p-4 space-y-3">
    <div class="bg-white rounded-2xl shadow-sm p-3 flex items-center justify-between gap-2">
      <span class="text-sm font-bold text-slate-700">{{ C.ITEMS_CHECK.length - C.faltantesCheck.value.length }} / {{ C.ITEMS_CHECK.length }} revisados</span>
      <span v-if="C.malosCheck.value.length" class="text-xs font-black text-rose-600">{{ C.malosCheck.value.length }} malo(s)</span>
    </div>
    <div v-for="g in C.GRUPOS_CHECK" :key="g" class="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button @click="grupoAbierto = grupoAbierto === g ? '' : g" class="w-full px-4 py-3 bg-sky-700 text-white font-black flex items-center justify-between">
        <span>{{ g }} <span class="text-xs font-bold text-sky-200">{{ hechosGrupo(g) }}/{{ itemsGrupo(g).length }}</span></span>
        <span class="flex items-center gap-2">
          <span @click.stop="C.marcarTodoBueno(g)" class="text-[11px] font-bold bg-white/20 rounded-lg px-2 py-1">Todo bueno</span>
          <i :class="['fa-solid', grupoAbierto === g ? 'fa-chevron-up' : 'fa-chevron-down']"></i>
        </span>
      </button>
      <div v-show="grupoAbierto === g || hechosGrupo(g) < itemsGrupo(g).length">
        <div v-for="it in itemsGrupo(g)" :key="it.k" class="px-3 py-2 border-b last:border-0 flex items-center gap-2">
          <span class="flex-1 text-sm font-semibold text-slate-700 leading-tight">{{ it.texto }}</span>
          <button v-for="o in C.OPCIONES_CHECK" :key="o.v" @click="f.checklist[it.k] = f.checklist[it.k] === o.v ? '' : o.v" :data-check="it.k + '-' + o.v"
            :class="['w-12 py-2.5 rounded-lg border-2 text-[11px] font-black', f.checklist[it.k] === o.v ? o.c : 'bg-white text-slate-400 border-slate-200']">{{ o.l }}</button>
        </div>
      </div>
    </div>
  </section>

  <!-- ===== 3 · TRASLADOS ===== -->
  <section v-show="C.pasoCheck.value === 3" class="p-4 space-y-3">
    <div v-for="a in f.actividades" :key="a.uid" @click="editar(a)" class="bg-white rounded-2xl shadow-sm p-4 active:bg-sky-50" :data-traslado="a.afi">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="font-black text-slate-800"><span class="font-mono text-sky-800">{{ a.afi || '—' }}</span> <span class="text-sm font-bold text-slate-600">{{ a.equipo }}</span></p>
          <p class="text-xs text-slate-500">{{ a.desde || '—' }} <i class="fa-solid fa-arrow-right mx-1"></i> <b class="text-emerald-700">{{ a.hasta || '—' }}</b></p>
          <p class="text-[11px] text-slate-400 mt-0.5">{{ a.traslado }}<span v-if="a.h_ini"> · {{ a.h_ini }}–{{ a.h_fin || '…' }}</span><span v-if="nFotos(a)"> · <i class="fa-solid fa-camera"></i> {{ nFotos(a) }}</span></p>
        </div>
        <span v-if="a.subarrendado" class="text-[10px] font-black bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 whitespace-nowrap">SUBARRENDADO</span>
      </div>
    </div>
    <button v-if="f.actividades.length < C.N_ACTIVIDADES_CHOFER" @click="nuevaAct" data-chofer="nuevo-traslado"
      class="w-full py-5 rounded-2xl border-2 border-dashed border-sky-400 text-sky-700 font-black text-lg bg-white/60 active:bg-sky-50">
      <i class="fa-solid fa-plus mr-1"></i> Añadir traslado
    </button>
    <p v-else class="text-xs text-center text-slate-500">Máximo {{ C.N_ACTIVIDADES_CHOFER }} traslados por check list (filas del formato).</p>
    <p v-if="!f.actividades.length" class="text-xs text-center text-slate-400">Si hoy no trasladaste equipos, sigue al paso 4.</p>
  </section>

  <!-- ===== 4 · FIRMA Y ENVIAR ===== -->
  <section v-show="C.pasoCheck.value === 4" class="p-4 space-y-3">
    <label class="block bg-white rounded-2xl shadow-sm p-4"><span class="lbl">Observaciones</span><textarea v-model="f.observaciones" rows="3" class="inp" placeholder="Fallas, novedades del camión o de los traslados…"></textarea></label>
    <div class="bg-white rounded-2xl shadow-sm p-4 text-sm space-y-1.5">
      <p><b>Camión:</b> {{ f.patente || '—' }} · {{ formatDateForDisplay(f.fecha) }}</p>
      <p><b>Km:</b> {{ f.km_ini || '—' }} → {{ f.km_fin || '—' }}</p>
      <p><b>Check list:</b> {{ C.ITEMS_CHECK.length - C.faltantesCheck.value.length }}/{{ C.ITEMS_CHECK.length }}<span v-if="C.malosCheck.value.length" class="text-rose-700 font-bold"> · MALO: {{ C.malosCheck.value.map(i => i.texto).join(', ') }}</span></p>
      <p><b>Traslados:</b> {{ f.actividades.length }}</p>
      <p v-if="C.vencidosDe(f).length" class="text-rose-700 font-black"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Documento vencido: {{ C.vencidosDe(f).join(' y ') }}</p>
    </div>
    <div class="bg-white rounded-2xl shadow-sm p-4 space-y-2">
      <p class="lbl"><i class="fa-solid fa-signature mr-1"></i>Firma del chofer · {{ nombre }}</p>
      <firma-pad :firma="f.firma" :titulo="'Firma chofer · ' + nombre" @guardar="v => f.firma = v"></firma-pad>
    </div>
  </section>

  <!-- Navegación -->
  <div class="fixed bottom-0 inset-x-0 max-w-xl mx-auto p-3 bg-white border-t flex gap-2 z-30">
    <button v-if="C.pasoCheck.value > 1" @click="C.pasoCheck.value--; arriba()" class="flex-1 py-3.5 rounded-2xl border-2 bg-white font-extrabold text-slate-600">Atrás</button>
    <button v-if="C.pasoCheck.value < 4" @click="siguiente" class="flex-[2] py-3.5 rounded-2xl bg-sky-600 text-white font-extrabold text-lg" data-chofer="siguiente">Siguiente</button>
    <button v-else @click="C.enviarChecklist" :disabled="C.enviandoCheck.value" class="flex-[2] py-3.5 rounded-2xl bg-emerald-600 text-white font-extrabold text-lg disabled:opacity-60" data-chofer="enviar">
      <i :class="['fa-solid mr-1', C.enviandoCheck.value ? 'fa-spinner fa-spin' : 'fa-paper-plane']"></i>{{ C.enviandoCheck.value ? 'Enviando…' : 'Enviar' }}</button>
  </div>

  <!-- ===== HOJA: AÑADIR / EDITAR TRASLADO ===== -->
  <teleport to="body">
    <div v-if="act" class="fixed inset-0 z-[80] bg-slate-950/60 flex items-end justify-center" @click.self="act = null">
      <div class="bg-slate-100 w-full max-w-xl rounded-t-3xl max-h-[94vh] overflow-y-auto pb-24">
        <div class="sticky top-0 bg-sky-700 text-white px-4 py-3 flex items-center justify-between rounded-t-3xl z-10">
          <b class="text-lg">{{ editando ? 'Editar traslado' : 'Nuevo traslado' }}</b>
          <button @click="act = null" class="w-9 h-9 rounded-xl bg-white/15"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="p-4 space-y-3">
          <!-- Equipo -->
          <div class="bg-white rounded-2xl shadow-sm p-4 space-y-2">
            <p class="lbl">1. Equipo</p>
            <div class="grid grid-cols-2 gap-2">
              <button @click="act.subarrendado = false" :class="['py-2.5 rounded-xl border-2 font-black text-sm', !act.subarrendado ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-500']">Equipo FRC</button>
              <button @click="act.subarrendado = true; act.afi = ''; act.equipo = ''" data-chofer="subarrendado" :class="['py-2.5 rounded-xl border-2 font-black text-sm', act.subarrendado ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-500']">Subarrendado</button>
            </div>
            <template v-if="!act.subarrendado">
              <div v-if="act.afi && equipoAct" class="flex items-center gap-3 p-3 rounded-xl bg-sky-50 border-2 border-sky-200">
                <div class="flex-1 min-w-0"><p class="font-black font-mono text-sky-800">AFI {{ act.afi }}</p><p class="text-xs text-slate-600 truncate">{{ equipoAct.tipo }} {{ equipoAct.marca }} {{ equipoAct.modelo }} · {{ equipoAct.ubicacion || 'sin ubicación' }}</p></div>
                <button @click="act.afi = ''; act.equipo = ''" class="px-3 py-1.5 rounded-lg border bg-white text-xs font-bold">Cambiar</button>
              </div>
              <template v-else>
                <input v-model="buscaEq" placeholder="Buscar AFI, tipo, marca…" class="inp" data-chofer="buscar-afi">
                <div class="max-h-64 overflow-y-auto space-y-1.5">
                  <button v-for="e in equiposFiltrados" :key="e.id" @click="elegirEquipo(e)" :data-afi="e.afi" class="w-full text-left p-2.5 rounded-xl border active:bg-sky-50 flex items-center gap-2">
                    <b class="font-mono text-sky-800 w-14 shrink-0">{{ e.afi }}</b>
                    <span class="min-w-0"><span class="block text-sm font-semibold text-slate-700 truncate">{{ e.tipo }} {{ e.marca }} {{ e.modelo }}</span><span class="block text-[11px] text-slate-400 truncate">{{ e.ubicacion || '—' }}</span></span>
                  </button>
                  <p v-if="!equiposFiltrados.length" class="text-xs text-slate-400 italic">Sin resultados. Si no es de FRC, marca "Subarrendado".</p>
                </div>
              </template>
            </template>
            <div v-else class="grid grid-cols-3 gap-2">
              <input v-model="act.afi" class="inp px-2 font-mono uppercase" placeholder="AFI / ID" data-chofer="afi-sub">
              <input v-model="act.equipo" class="inp px-2 col-span-2" placeholder="Equipo (ej. Generador 100 kVA)">
              <p class="col-span-3 text-[11px] text-amber-700">Queda en Movimientos como información; no se agrega al inventario.</p>
            </div>
          </div>
          <!-- Tipo -->
          <div class="bg-white rounded-2xl shadow-sm p-4 space-y-2">
            <p class="lbl">2. Tipo</p>
            <div class="grid grid-cols-4 gap-1.5">
              <button v-for="t in C.TIPOS_TRASLADO" :key="t" @click="act.traslado = t" :class="['py-2.5 rounded-xl border-2 text-[11px] font-black', act.traslado === t ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-500']">{{ t }}</button>
            </div>
          </div>
          <!-- Desde / Hasta -->
          <div class="bg-white rounded-2xl shadow-sm p-4 space-y-2">
            <p class="lbl">3. Desde → Hasta</p>
            <input v-model="act.desde" class="inp" placeholder="Desde" data-chofer="desde">
            <!-- HASTA: escribir filtra; al tocar el campo aparece la lista completa en orden (por empresa · área) -->
            <div class="relative">
              <span class="text-[10px] font-bold text-slate-400">HASTA</span>
              <div class="relative">
                <input v-model="act.hasta" @focus="listaHasta = true" @input="listaHasta = true" class="inp pr-10 uppercase" placeholder="Toca o escribe para buscar" data-chofer="hasta" autocomplete="off">
                <button v-if="act.hasta" @click="act.hasta = ''; listaHasta = true" class="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark"></i></button>
              </div>
              <div v-if="listaHasta" class="mt-1 border-2 border-sky-200 rounded-xl bg-white max-h-72 overflow-y-auto">
                <template v-for="g in gruposFiltrados" :key="g.label">
                  <p class="sticky top-0 bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500 uppercase">{{ g.label }}</p>
                  <button v-for="o in g.opciones" :key="o.value" @click="act.hasta = o.value; listaHasta = false" :data-lugar="o.value"
                    :class="['w-full text-left px-3 py-2.5 border-b last:border-0 text-sm', act.hasta === o.value ? 'bg-emerald-50 font-black text-emerald-800' : 'active:bg-sky-50']">
                    <i class="fa-solid fa-location-dot text-emerald-600 mr-1"></i>{{ o.label }}</button>
                </template>
                <p v-if="!gruposFiltrados.length" class="px-3 py-2 text-xs text-slate-400 italic">No está en la lista.</p>
                <button v-if="act.hasta && !locAct" @click="listaHasta = false" class="w-full text-left px-3 py-2.5 text-sm font-bold text-amber-700 bg-amber-50" data-chofer="usar-otro"><i class="fa-solid fa-pen mr-1"></i>Usar "{{ act.hasta.toUpperCase() }}" como otro lugar</button>
              </div>
            </div>
            <p v-if="act.hasta && !locAct && !listaHasta" class="text-[11px] text-amber-700"><i class="fa-solid fa-bell mr-1"></i>Lugar nuevo: le llegará un aviso a Operaciones para agregarlo a las locaciones.</p>
            <p v-if="locAct" class="text-[11px] font-bold text-emerald-700"><i class="fa-solid fa-circle-check mr-1"></i>{{ locAct.texto }}{{ locAct.empresa ? ' · ' + locAct.empresa : '' }}</p>
          </div>
          <!-- Horas -->
          <div class="bg-white rounded-2xl shadow-sm p-4 space-y-2">
            <p class="lbl">4. Horario (opcional)</p>
            <div class="grid grid-cols-2 gap-2">
              <div><span class="text-[10px] font-bold text-slate-400">INICIO</span><div class="flex gap-1"><input type="time" v-model="act.h_ini" class="inp px-1 flex-1"><button @click="act.h_ini = ahora()" class="px-2 rounded-lg bg-slate-100 text-[10px] font-black">AHORA</button></div></div>
              <div><span class="text-[10px] font-bold text-slate-400">TÉRMINO</span><div class="flex gap-1"><input type="time" v-model="act.h_fin" class="inp px-1 flex-1"><button @click="act.h_fin = ahora()" class="px-2 rounded-lg bg-slate-100 text-[10px] font-black">AHORA</button></div></div>
            </div>
            <label class="block"><span class="text-[10px] font-bold text-slate-400">C/U</span><input v-model="act.cu" class="inp px-2"></label>
          </div>
          <!-- Fotos -->
          <div class="bg-white rounded-2xl shadow-sm p-4 space-y-2">
            <p class="lbl">5. Fotos del equipo (opcional)</p>
            <div class="flex flex-wrap gap-2">
              <img v-for="(u, i) in act.fotos" :key="'s' + i" :src="u" @click="act.fotos.splice(i, 1)" title="Toca para quitar" class="w-20 h-20 object-cover rounded-xl border">
              <img v-for="(p, i) in (C.fotosPend.value[act.uid] || [])" :key="'p' + i" :src="p.url" @click="C.quitarFotoPend(act.uid, i)" title="Toca para quitar" class="w-20 h-20 object-cover rounded-xl border-2 border-dashed border-sky-400">
              <label class="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 flex flex-col items-center justify-center text-[11px] font-bold">
                <i class="fa-solid fa-camera text-xl"></i>Agregar
                <input type="file" accept="image/*" capture="environment" multiple class="hidden" @change="e => C.agregarFotos(act.uid, e)" data-chofer="fotos">
              </label>
            </div>
          </div>
        </div>
        <div class="fixed bottom-0 inset-x-0 max-w-xl mx-auto p-3 bg-white border-t flex gap-2 z-[81]">
          <button v-if="editando" @click="eliminarAct" class="px-4 py-3.5 rounded-2xl border-2 border-rose-200 text-rose-600 font-black"><i class="fa-solid fa-trash"></i></button>
          <button @click="act = null" class="flex-1 py-3.5 rounded-2xl border-2 bg-white font-extrabold text-slate-600">Cancelar</button>
          <button @click="guardarAct" class="flex-[2] py-3.5 rounded-2xl bg-sky-600 text-white font-extrabold text-lg" data-chofer="guardar-traslado">Guardar traslado</button>
        </div>
      </div>
    </div>
  </teleport>
</div>`,
  setup() {
    const f = C.formCheck;
    watch(() => C.formCheck.value, () => C.guardarBorradorCheck(), { deep: true });
    const nombre = computed(() => String(usuarioActivo.value?.nombre || usuarioActivo.value?.usuario || ''));
    const arriba = () => window.scrollTo(0, 0);
    // Paso 1 · camión
    const buscaCamion = ref('');
    const camionSel = computed(() => Boolean(f.value?.patente && C.camiones.value.some(c => mismoAfi(c.afi, f.value.patente))));
    const camionesFiltrados = computed(() => {
      const q = buscaCamion.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      return C.camiones.value.filter(c => !q || String(c.afi).toUpperCase().replace(/[^A-Z0-9]/g, '').includes(q)).slice(0, 30);
    });
    const elegirCamion = (c) => { f.value.patente = c.afi; f.value.km_ini = ''; C.alElegirCamion(f.value); };
    const cambiarCamion = () => { f.value.patente = ''; f.value.venc_revision = ''; f.value.venc_permiso = ''; buscaCamion.value = ''; };
    const docs = computed(() => [
      { k: 'rt', l: 'Revisión técnica', v: f.value.venc_revision },
      { k: 'pc', l: 'Permiso de circulación', v: f.value.venc_permiso }
    ].filter(d => d.v));
    // Paso 2 · check list
    const grupoAbierto = ref('');
    const itemsGrupo = (g) => C.ITEMS_CHECK.filter(i => i.grupo === g);
    const hechosGrupo = (g) => itemsGrupo(g).filter(i => f.value.checklist[i.k]).length;
    const siguiente = () => {
      if (C.pasoCheck.value === 1 && !f.value.patente) return alert('Elige el camión.');
      C.pasoCheck.value++; arriba();
    };
    // Paso 3 · traslados (hoja)
    const act = ref(null);
    const editando = ref(false);
    const buscaEq = ref('');
    const nFotos = (a) => (a.fotos || []).length + (C.fotosPend.value[a.uid] || []).length;
    const nuevaAct = () => { act.value = C.actVacia(); editando.value = false; buscaEq.value = ''; };
    const editar = (a) => { act.value = JSON.parse(JSON.stringify(a)); editando.value = true; buscaEq.value = ''; };
    const equipoAct = computed(() => (act.value && !act.value.subarrendado ? buscarEquipoPorAfi(act.value.afi) : null));
    const equiposFiltrados = computed(() => {
      const q = buscaEq.value.trim().toUpperCase();
      return dbEquipos.value.filter(e => !esVehiculo(e))
        .filter(e => !q || [e.afi, e.tipo, e.marca, e.modelo, e.ubicacion].join(' ').toUpperCase().includes(q))
        .sort((a, b) => String(a.afi).localeCompare(String(b.afi), undefined, { numeric: true })).slice(0, 40);
    });
    const elegirEquipo = (e) => {
      act.value.afi = String(e.afi); act.value.equipo = [e.tipo, e.marca].filter(Boolean).join(' ');
      if (!act.value.desde && e.ubicacion) act.value.desde = e.ubicacion;
    };
    const locAct = computed(() => (act.value ? C.locDeTexto(act.value.hasta) : null));
    // "Hasta": lista en orden (empresa · área); al escribir se filtra por cualquier parte del nombre
    const listaHasta = ref(false);
    const sinTilde = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const gruposFiltrados = computed(() => {
      const q = sinTilde(act.value?.hasta).trim();
      if (!q || C.locDeTexto(act.value?.hasta)) return C.gruposDestino.value;
      return C.gruposDestino.value
        .map(g => ({ label: g.label, opciones: g.opciones.filter(o => sinTilde(g.label + ' ' + o.label).includes(q)) }))
        .filter(g => g.opciones.length);
    });
    watch(act, () => { listaHasta.value = false; });
    const ahora = () => new Date().toTimeString().slice(0, 5);
    const guardarAct = () => {
      const a = act.value;
      if (!String(a.afi || '').trim()) return alert(a.subarrendado ? 'Escribe el AFI / ID del equipo subarrendado.' : 'Elige el equipo de la lista.');
      if (!String(a.hasta || '').trim()) return alert('Indica hacia dónde lo llevaste (Hasta).');
      a.afi = String(a.afi).trim().toUpperCase();
      C.guardarActividad(a); act.value = null;
    };
    const eliminarAct = () => { if (confirm('¿Quitar este traslado?')) { C.quitarActividad(act.value); act.value = null; } };
    return { C, f, nombre, arriba, buscaCamion, camionSel, camionesFiltrados, elegirCamion, cambiarCamion, docs,
      grupoAbierto, itemsGrupo, hechosGrupo, siguiente,
      act, editando, buscaEq, nFotos, nuevaAct, editar, equipoAct, equiposFiltrados, elegirEquipo, locAct, listaHasta, gruposFiltrados, ahora, guardarAct, eliminarAct,
      formatDateForDisplay };
  }
};

/** Lista "Mis check list" (chofer) o todos (Operaciones: prop todos). */
export const ChecklistLista = {
  name: 'ChecklistLista',
  props: { todos: Boolean, puedeEliminar: Boolean, filtro: { type: String, default: '' } },
  template: /* html */ `
<div class="space-y-2">
  <div v-if="todos && C.faltaSqlChofer.value" class="bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3 text-xs">Falta ejecutar <b>sql/chofer.sql</b> en Supabase.</div>
  <div v-for="r in lista" :key="r.id" class="bg-white rounded-2xl shadow-sm border p-3 flex items-center gap-3">
    <span class="w-11 h-11 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center text-lg shrink-0"><i class="fa-solid fa-truck"></i></span>
    <div class="flex-1 min-w-0">
      <p class="font-black text-slate-800">{{ r.patente }} <span class="text-xs font-bold text-slate-500">{{ formatDateForDisplay(r.fecha) }}</span></p>
      <p class="text-xs text-slate-500 truncate"><span v-if="todos" class="font-bold text-slate-700">{{ r.chofer || r.usuario }} · </span>Km {{ r.km_ini || '—' }} → {{ r.km_fin || '—' }} · {{ (r.actividades || []).length }} traslado(s)<span v-if="fotos(r).length"> · {{ fotos(r).length }} foto(s)</span><span v-if="malos(r)" class="text-rose-600 font-bold"> · {{ malos(r) }} malo(s)</span><span v-if="C.vencidosDe(r).length" class="text-rose-600 font-bold"> · Vencido: {{ C.vencidosDe(r).join(', ') }}</span></p>
    </div>
    <div v-if="fotos(r).length" class="hidden sm:flex gap-1">
      <a v-for="(u, i) in fotos(r).slice(0, 4)" :key="i" :href="u" target="_blank" rel="noopener"><img :src="u" class="w-10 h-10 object-cover rounded-lg border"></a>
      <span v-if="fotos(r).length > 4" class="text-[10px] font-bold text-slate-500 self-center">+{{ fotos(r).length - 4 }}</span>
    </div>
    <button @click="C.descargarChecklistExcel(r)" class="px-3 py-2 rounded-xl border font-bold text-xs text-emerald-700" title="Descargar documento"><i class="fa-solid fa-file-excel mr-1"></i>Excel</button>
    <button v-if="todos && puedeEliminar" @click="C.eliminarChecklist(r)" class="px-2 py-2 rounded-xl text-slate-300 hover:text-rose-600" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
  </div>
  <p v-if="!lista.length" class="text-center text-slate-400 py-8 text-sm">{{ todos ? 'Aún no hay check list de choferes.' : 'Aún no envías check list.' }}</p>
</div>`,
  setup(props) {
    const lista = Vue.computed(() => {
      const l = props.todos ? C.todosChecklist.value : C.misChecklist.value;
      const q = String(props.filtro || '').trim().toUpperCase();
      return q ? l.filter(r => [r.patente, r.chofer, r.usuario, ...(r.actividades || []).map(a => a.afi + ' ' + a.hasta)].join(' ').toUpperCase().includes(q)) : l;
    });
    const malos = (r) => Object.values(r.checklist || {}).filter(v => v === 'M').length;
    const fotos = (r) => (r.actividades || []).flatMap(a => a.fotos || []);
    Vue.onMounted(() => (props.todos ? C.cargarTodosChecklist() : C.cargarMisChecklist()));
    return { C, lista, malos, fotos, formatDateForDisplay };
  }
};

/** PERSONAL TÉCNICO → Choferes (sistema, supervisores / Admin): todos los check list / report de choferes. */
export const ChoferesPanelView = {
  name: 'ChoferesPanelView',
  components: { ChecklistLista },
  props: { puedeEliminar: Boolean },
  template: /* html */ `
<section class="space-y-4">
  <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-truck text-sky-600"></i> CHOFERES · Check list / Report Camión Pluma (FRC-RE-OPE-018)</h2>
      <p class="text-xs text-slate-500 mt-1">Lo que envían los choferes desde el celular. Sus traslados quedan también en <b>Movimientos</b> (camión + chofer). Descarga cada documento en Excel igual al formato.</p>
    </div>
    <div class="flex items-center gap-2">
      <input v-model="busca" placeholder="Buscar patente, chofer, AFI…" class="p-2 border rounded-lg text-xs w-56">
      <button @click="C.cargarTodosChecklist" class="px-3 py-2 rounded-lg border text-xs font-bold text-slate-600 hover:bg-slate-50"><i class="fa-solid fa-rotate mr-1"></i>Actualizar</button>
    </div>
  </div>
  <div class="text-xs"><checklist-lista todos :puede-eliminar="puedeEliminar" :filtro="busca"></checklist-lista></div>
</section>`,
  setup() {
    const busca = Vue.ref('');
    return { C, busca };
  }
};
