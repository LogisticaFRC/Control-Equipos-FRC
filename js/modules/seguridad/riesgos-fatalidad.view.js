// =====================================================================
// SEGURIDAD · ESTÁNDARES DE CONTROL DE FATALIDAD CODELCO (ECF) · 2026-11-18
// Resumen de los Estándares de Control de Fatalidades (ECF) de Codelco, con dibujo,
// riesgo, controles críticos y lo que está prohibido. Se ve en:
//   · Web: Seguridad → Estándares de control de fatalidad (ECF)  (en la app de técnicos irán los 31 Riesgos de Fatalidad)
// Fuente: Codelco · Estándares de Control de Fatalidades (ECF 1 al 12 y ECF 21).
// Es material de difusión: el documento oficial vigente manda (SIGO-ECF de Codelco).
// =====================================================================
const { ref, computed } = Vue;

// ---------- Dibujos (SVG propios, trazo simple) ----------
const S = 'fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
const DIBUJOS = {
  bloqueo: `<svg viewBox="0 0 64 64"><rect x="8" y="10" width="22" height="34" rx="3" ${S}/><path d="M14 18h10M14 24h10" ${S}/><circle cx="19" cy="34" r="4" ${S}/><path d="M30 30h8" ${S}/><path d="M42 30v-6a6 6 0 0 1 12 0v6" ${S}/><rect x="38" y="30" width="20" height="16" rx="3" ${S}/><circle cx="48" cy="37" r="2" fill="currentColor"/><path d="M48 39v3" ${S}/><path d="M44 46l-4 10h12l-4-10" ${S}/><path d="M43 52h10" stroke="currentColor" stroke-width="2"/></svg>`,
  altura: `<svg viewBox="0 0 64 64"><path d="M6 8h52" ${S}/><circle cx="34" cy="8" r="2.5" fill="currentColor"/><path d="M34 10l-2 12" ${S} stroke-dasharray="3 3"/><circle cx="30" cy="20" r="4" ${S}/><path d="M30 24v13M23 29h14M30 37l-5 10M30 37l5 10" ${S}/><path d="M26 27l8 6M34 27l-8 6" stroke="currentColor" stroke-width="2"/><path d="M4 48h40M44 48v12" ${S}/><path d="M50 52l4 6M56 50l3 4" stroke="currentColor" stroke-width="2"/></svg>`,
  maquinaria: `<svg viewBox="0 0 64 64"><rect x="6" y="40" width="34" height="10" rx="5" ${S}/><circle cx="12" cy="45" r="2" fill="currentColor"/><circle cx="34" cy="45" r="2" fill="currentColor"/><path d="M10 40V28h18v12" ${S}/><path d="M16 28v-8h10l2 8" ${S}/><path d="M28 30l14-14 10 6" ${S}/><path d="M52 22l4 12-10 2z" ${S}/></svg>`,
  liviano: `<svg viewBox="0 0 64 64"><path d="M4 42V32l8-12h20l8 12h16a4 4 0 0 1 4 4v6" ${S}/><path d="M4 42h56" ${S}/><circle cx="16" cy="44" r="6" ${S}/><circle cx="48" cy="44" r="6" ${S}/><path d="M14 22l-5 10h27l-6-10z" ${S}/><path d="M22 22v10" ${S}/></svg>`,
  herramientas: `<svg viewBox="0 0 64 64"><rect x="6" y="20" width="30" height="14" rx="4" ${S}/><path d="M36 24h8M36 30h8" ${S}/><circle cx="50" cy="27" r="9" ${S}/><path d="M50 18v18M41 27h18" stroke="currentColor" stroke-width="2"/><path d="M14 34l-4 18h10l2-18" ${S}/><path d="M56 12l3-4M58 18l5-1M44 12l-2-4" ${S}/></svg>`,
  fundidos: `<svg viewBox="0 0 64 64"><path d="M10 14h28l-4 22H14z" ${S}/><path d="M38 18l8-4" ${S}/><path d="M24 36c0 6 6 8 6 14" ${S}/><path d="M18 58h28c0-6-6-8-14-8s-14 2-14 8z" ${S}/><path d="M50 30c2 3 2 6 0 9M56 26c3 5 3 10 0 15" ${S}/></svg>`,
  izaje: `<svg viewBox="0 0 64 64"><path d="M6 8h40" ${S}/><path d="M26 8v14" ${S}/><path d="M26 22a4 4 0 1 0 4 4" ${S}/><path d="M30 26l-10 8M30 26l10 8" ${S}/><rect x="16" y="34" width="28" height="10" rx="1" ${S}/><circle cx="50" cy="52" r="10" ${S}/><path d="M43 45l14 14" ${S}/><circle cx="50" cy="47" r="2" fill="currentColor"/></svg>`,
  guardas: `<svg viewBox="0 0 64 64"><circle cx="26" cy="32" r="12" ${S}/><circle cx="26" cy="32" r="4" ${S}/><path d="M26 16v-4M26 52v-4M10 32H6M46 32h-4M15 21l-3-3M37 43l3 3M37 21l3-3M15 43l-3 3" ${S}/><path d="M48 10v44M48 10h10v44H48" ${S}/><path d="M48 18h10M48 26h10M48 34h10M48 42h10" stroke="currentColor" stroke-width="2"/></svg>`,
  sustancias: `<svg viewBox="0 0 64 64"><rect x="8" y="14" width="22" height="40" rx="4" ${S}/><path d="M8 24h22M8 44h22" ${S}/><path d="M46 14l14 14-14 14-14-14z" ${S}/><path d="M46 22v8" ${S}/><circle cx="46" cy="34" r="1.6" fill="currentColor"/><path d="M40 52c2-3 4-3 6 0s4 3 6 0" ${S}/></svg>`,
  explosivos: `<svg viewBox="0 0 64 64"><rect x="10" y="30" width="10" height="24" rx="2" ${S}/><rect x="22" y="30" width="10" height="24" rx="2" ${S}/><path d="M26 30c0-8 6-10 10-14" ${S}/><path d="M42 12l2-6 2 6 6-2-4 5 6 3-6 1 2 6-5-4-4 5v-6l-6-1 5-3z" ${S}/></svg>`,
  terreno: `<svg viewBox="0 0 64 64"><path d="M4 58L28 14l10 14 8-6 14 36z" ${S}/><path d="M28 14l-4 14 8 6" stroke="currentColor" stroke-width="2"/><circle cx="46" cy="36" r="3.5" ${S}/><circle cx="52" cy="46" r="3" ${S}/><path d="M42 30l4 2M50 40l2 3" stroke="currentColor" stroke-width="2"/></svg>`,
  incendio: `<svg viewBox="0 0 64 64"><path d="M22 56c-9 0-14-7-14-14 0-10 10-14 10-24 6 4 8 10 8 14 3-2 4-6 4-9 6 5 8 11 8 19 0 8-6 14-16 14z" ${S}/><path d="M22 56c-4 0-6-3-6-6 0-4 4-6 6-10 2 4 6 6 6 10s-2 6-6 6z" ${S}/><rect x="46" y="24" width="12" height="32" rx="5" ${S}/><path d="M50 24v-6h4M54 18l6-3" ${S}/></svg>`,
  transporte: `<svg viewBox="0 0 64 64"><rect x="4" y="14" width="40" height="30" rx="4" ${S}/><path d="M10 22h10v8H10zM24 22h10v8H24z" ${S}/><path d="M44 24h8l8 10v10H44" ${S}/><circle cx="14" cy="48" r="5" ${S}/><circle cx="50" cy="48" r="5" ${S}/><path d="M19 48h26" ${S}/></svg>`
};

// ---------- Contenido (resumen de los ECF de Codelco) ----------
export const ECF = [
  { n: 1, nombre: 'Aislación, bloqueo y permiso de trabajo', dib: 'bloqueo', color: '#dc2626',
    riesgo: 'Liberación inesperada de energía (eléctrica, mecánica, hidráulica, neumática, térmica o química) mientras se interviene un equipo.',
    controles: ['Identificar TODAS las energías del equipo antes de intervenir.', 'Aislar y bloquear cada fuente con candado y tarjeta personal.', 'Verificar energía cero antes de tocar el equipo.', 'Trabajar con permiso de trabajo y procedimiento aprobado.', 'Cada persona que interviene pone su propio candado.', 'Solo quien puso el candado lo retira, al terminar.'],
    prohibido: ['Intervenir un equipo energizado o sin bloqueo.', 'Usar el candado o la tarjeta de otra persona.'] },
  { n: 2, nombre: 'Trabajo en altura física', dib: 'altura', color: '#ea580c',
    riesgo: 'Caída de personas desde altura (sobre 1,8 m) o caída de objetos sobre otras personas.',
    controles: ['Usar arnés de cuerpo completo con doble cabo, siempre conectado.', 'Anclarse a un punto de anclaje o línea de vida certificada.', 'Usar andamios y plataformas inspeccionados y con tarjeta de habilitación.', 'Tener examen de salud vigente para trabajo en altura.', 'Delimitar y señalizar el área bajo el trabajo.', 'Asegurar las herramientas para que no caigan.'],
    prohibido: ['Trabajar en altura sin estar conectado.', 'Usar andamios incompletos o sin tarjeta.'] },
  { n: 3, nombre: 'Maquinaria industrial', dib: 'maquinaria', color: '#ca8a04',
    riesgo: 'Atropello, choque, volcamiento o atrapamiento con maquinaria industrial (cargadores, excavadoras, manipuladores, grúas horquilla, etc.).',
    controles: ['Licencia clase D y autorización interna para esa máquina (marca y modelo).', 'Certificado de salud vigente para operar.', 'Hacer la inspección pre-operacional (check list) antes de cada turno.', 'Usar siempre el cinturón de seguridad.', 'Subir y bajar con tres puntos de apoyo.', 'Al bajarse: desenergizar y bloquear la máquina.', 'Entrar al radio de otra máquina solo con autorización radial del operador y con la máquina detenida.'],
    prohibido: ['Usar celular o audífonos, comer o fumar mientras opera.', 'Operar sin autorización o con la máquina en mal estado.'] },
  { n: 4, nombre: 'Vehículos livianos', dib: 'liviano', color: '#2563eb',
    riesgo: 'Choque, volcamiento o atropello conduciendo camionetas y vehículos livianos.',
    controles: ['Licencia municipal y autorización interna de conducción vigentes.', 'Todos con cinturón de seguridad antes de partir.', 'Check list pre-uso antes del turno; si hay condición subestándar, informar.', 'Estacionar aculatado, con motor apagado, freno de mano y cuñas.', 'Neumáticos con dibujo sobre el mínimo (4 mm).', 'Al detenerse en la vía: chaleco reflectante de alta visibilidad.'],
    prohibido: ['Conducir sin cinturón o con pasajeros sin cinturón.', 'Usar el celular mientras conduce.'] },
  { n: 5, nombre: 'Equipos y herramientas portátiles y manuales', dib: 'herramientas', color: '#0891b2',
    riesgo: 'Cortes, golpes, proyección de partículas, electrocución o amputación con herramientas (esmeriles, taladros, llaves de impacto, etc.).',
    controles: ['Ser capacitado y autorizado para usar la herramienta.', 'Inspeccionar la herramienta antes de usarla; retirar las dañadas.', 'Usar solo herramientas certificadas por el fabricante.', 'Usar cada herramienta solo para lo que fue diseñada.', 'Herramientas eléctricas con protector diferencial y, si aplica, interruptor de "hombre muerto".', 'En zonas húmedas o con gases: herramientas aisladas.'],
    prohibido: ['Usar herramientas hechizas o modificadas.', 'Sacar las protecciones de un esmeril u otra herramienta.'] },
  { n: 6, nombre: 'Materiales fundidos', dib: 'fundidos', color: '#b45309',
    riesgo: 'Quemaduras graves o explosiones por contacto con metal o escoria fundida.',
    controles: ['Solo personal autorizado y capacitado.', 'Respetar zonas seguras, diques y barreras ante derrames.', 'Mantener el agua lejos del material fundido (explosión).', 'Cabinas de control resistentes al calor.', 'Alarmas de gases (SO2/SO3) operativas.'],
    prohibido: ['Ingresar a zonas de fundidos sin autorización.', 'Acercar agua o materiales húmedos al metal fundido.'] },
  { n: 7, nombre: 'Cargas suspendidas e izaje', dib: 'izaje', color: '#7c3aed',
    riesgo: 'Caída o golpe de una carga suspendida, o volcamiento del equipo de izaje.',
    controles: ['Operador de grúa y rigger capacitados y autorizados.', 'Plan de izaje para cada maniobra (crítica o no).', 'Inspeccionar estrobos, eslingas, grilletes y ganchos (con código de color vigente).', 'Delimitar y aislar el área de izaje.', 'Usar vientos (cuerdas guía) para controlar la carga.', 'Suspender la maniobra con viento fuerte o mala visibilidad.'],
    prohibido: ['Pasar o quedarse bajo una carga suspendida.', 'Izar sobre la capacidad del equipo o con elementos dañados.'] },
  { n: 8, nombre: 'Guardas y protecciones de equipos', dib: 'guardas', color: '#16a34a',
    riesgo: 'Atrapamiento o amputación por partes en movimiento (correas, poleas, ejes, engranajes).',
    controles: ['Las guardas deben impedir el acceso a las partes en movimiento.', 'Revisar guardas y paradas de emergencia al inicio de cada turno.', 'Si falta o está dañada una guarda: detener el equipo e informar.', 'Paradas de emergencia operativas en todos los equipos.', 'Reponer las guardas antes de volver a operar.'],
    prohibido: ['Retirar o puentear guardas con el equipo energizado.', 'Usar conos o cinta como si fueran una guarda física.'] },
  { n: 9, nombre: 'Manejo de sustancias peligrosas', dib: 'sustancias', color: '#db2777',
    riesgo: 'Intoxicación, quemaduras químicas, incendio o explosión por sustancias peligrosas (combustibles, ácidos, gases, solventes).',
    controles: ['Solo personal capacitado y autorizado.', 'Conocer y seguir la hoja de datos de seguridad (HDS).', 'Bodegas autorizadas, ventiladas y con contención de derrames.', 'Envases y cañerías rotulados.', 'Transporte solo en vehículos autorizados.', 'Usar el EPP indicado en la HDS.'],
    prohibido: ['Comer, beber o fumar en zonas con sustancias peligrosas.', 'Trasvasijar a envases sin rotular.'] },
  { n: 10, nombre: 'Explosivos y tronaduras', dib: 'explosivos', color: '#e11d48',
    riesgo: 'Lesiones fatales por detonación de explosivos, proyecciones o gases de la tronadura.',
    controles: ['Solo personal con licencia y autorización para explosivos.', 'Plan y reglamento de tronadura aprobados.', 'Áreas aisladas y con acceso controlado.', 'Radio de evacuación en superficie de al menos 500 m.', 'Antes de reingresar: verificar gases y estabilidad.', 'Suspender ante tormentas eléctricas.'],
    prohibido: ['Ingresar al área de tronadura sin autorización.', 'Manipular explosivos sin licencia.'] },
  { n: 11, nombre: 'Control del terreno', dib: 'terreno', color: '#78716c',
    riesgo: 'Caída de rocas, derrumbes o deslizamientos (minas a rajo abierto y subterráneas).',
    controles: ['Personal capacitado en riesgos del macizo rocoso.', 'Aislar el área antes de acuñar o sanear roca suelta.', 'Autorización para entrar a zonas de alto riesgo.', 'Monitoreo del terreno y alertas tempranas.', 'Evaluar la estabilidad antes de retomar áreas detenidas.'],
    prohibido: ['Trabajar en niveles alineados verticalmente sin análisis.', 'Ingresar a zonas aisladas por inestabilidad.'] },
  { n: 12, nombre: 'Incendio', dib: 'incendio', color: '#f97316',
    riesgo: 'Quemaduras, asfixia o atrapamiento por incendio en instalaciones o equipos.',
    controles: ['Permiso para trabajos en caliente (soldar, cortar, esmerilar).', 'Extintores y sistemas contra incendio mantenidos y vigentes.', 'Equipos autopropulsados con sistema de extinción.', 'Vías de evacuación señalizadas y despejadas.', 'Brigadas de emergencia capacitadas.', 'En subterránea: capacitación en autorrescatador.'],
    prohibido: ['Hacer trabajos en caliente sin permiso ni vigía.', 'Bloquear extintores o vías de evacuación.'] },
  { n: 21, nombre: 'Vehículos de transporte de personas y carga', dib: 'transporte', color: '#0f766e',
    riesgo: 'Choque o volcamiento de buses y camiones que transportan personas o carga.',
    controles: ['Licencia A3, A4 o A5 según corresponda y autorización interna.', 'Al menos 4 años de experiencia y curso de conducción segura del modelo.', 'Respetar los tiempos de conducción, espera y descanso.', 'Bitácora de viaje (origen-destino) al día.', 'Check list antes del turno y teléfono de emergencia en la cabina.', 'Todos los pasajeros con cinturón antes de partir.', 'En detención de emergencia: 4 conos a las distancias indicadas.'],
    prohibido: ['Conducir con fatiga o sobre el tiempo permitido.', 'Transportar sustancias peligrosas sin procedimiento de emergencia.'] }
];
export const dibujoECF = (k) => (DIBUJOS[k] || '').replace('<svg ', '<svg width="100%" height="100%" ');

export default {
  name: 'RiesgosFatalidad',
  props: { compacto: { type: Boolean, default: false } },   // compacto = app del celular
  template: /* html */ `
<section :class="compacto ? 'space-y-3' : 'space-y-5'" data-ecf="vista">
  <div :class="['rounded-2xl text-white shadow-sm overflow-hidden', compacto ? 'p-4' : 'p-6']" style="background:linear-gradient(135deg,#7f1d1d,#b91c1c 55%,#ea580c)">
    <div class="flex items-center gap-3">
      <span class="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center text-2xl shrink-0"><i class="fa-solid fa-skull-crossbones"></i></span>
      <div><h2 :class="['font-black leading-tight', compacto ? 'text-lg' : 'text-2xl']">Estándares de control de fatalidad · Codelco</h2>
        <p class="text-white/85 text-xs">Estándares de Control de Fatalidades (ECF). Conócelos y cúmplelos: <b>ninguna tarea es tan urgente que no se pueda hacer de forma segura.</b></p></div>
    </div>
    <div class="mt-3 flex flex-wrap gap-2">
      <input v-model="buscar" placeholder="Buscar riesgo (altura, bloqueo, izaje…)" class="flex-1 min-w-[180px] px-3 py-2 rounded-xl text-slate-900 text-sm">
    </div>
  </div>

  <div :class="['grid gap-3', compacto ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5']">
    <button v-for="e in lista" :key="e.n" @click="abierto = e" class="bg-white rounded-2xl shadow-sm border-2 text-left overflow-hidden hover:shadow-md active:scale-[.99] transition flex flex-col" :style="{ borderColor: e.color + '55' }" :data-ecf="'card-' + e.n">
      <div class="w-full flex items-center justify-center py-3" :style="{ background: e.color + '14', color: e.color }"><span class="w-16 h-16 block" v-html="dibujoECF(e.dib)"></span></div>
      <div class="p-3">
        <span class="text-[10px] font-black px-2 py-0.5 rounded-full text-white" :style="{ background: e.color }">ECF {{ e.n }}</span>
        <p class="font-extrabold text-slate-800 text-sm leading-snug mt-1.5">{{ e.nombre }}</p>
      </div>
    </button>
  </div>
  <p class="text-[10px] text-slate-400 px-1">Resumen para difusión basado en los Estándares de Control de Fatalidades de Codelco (ECF 1 al 12 y ECF 21). Manda siempre el estándar oficial vigente de la faena (SIGO-ECF) y las indicaciones de prevención de riesgos.</p>

  <!-- Detalle -->
  <teleport to="body">
    <div v-if="abierto" class="fixed inset-0 z-[400] bg-slate-950/70 flex items-end sm:items-center justify-center p-0 sm:p-4" @click.self="abierto = null" data-ecf="detalle">
      <div class="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div class="p-5 text-white relative" :style="{ background: abierto.color }">
          <button @click="abierto = null" class="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/20"><i class="fa-solid fa-xmark"></i></button>
          <div class="flex items-center gap-4">
            <span class="block rounded-2xl p-2 shrink-0" :style="{ color: abierto.color, width: '5rem', height: '5rem', background: 'rgba(255,255,255,.95)' }" v-html="dibujoECF(abierto.dib)"></span>
            <div><p class="text-xs font-black opacity-90">ECF {{ abierto.n }}</p><h3 class="text-xl font-black leading-tight">{{ abierto.nombre }}</h3></div>
          </div>
        </div>
        <div class="p-5 space-y-4 text-sm">
          <div class="rounded-2xl bg-rose-50 border border-rose-200 p-3"><p class="text-[11px] font-black uppercase text-rose-700 mb-1"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Riesgo</p><p class="text-slate-800">{{ abierto.riesgo }}</p></div>
          <div><p class="text-[11px] font-black uppercase text-emerald-700 mb-2"><i class="fa-solid fa-shield-halved mr-1"></i>Controles críticos · lo que SIEMPRE debes hacer</p>
            <div v-for="(c, i) in abierto.controles" :key="i" class="flex gap-3 py-1.5"><span class="w-6 h-6 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">{{ i + 1 }}</span><span class="text-slate-700">{{ c }}</span></div></div>
          <div class="rounded-2xl bg-slate-900 text-white p-3"><p class="text-[11px] font-black uppercase text-rose-300 mb-1.5"><i class="fa-solid fa-ban mr-1"></i>Prohibido</p>
            <p v-for="(p, i) in abierto.prohibido" :key="i" class="flex gap-2 py-0.5"><i class="fa-solid fa-xmark text-rose-400 mt-1"></i><span>{{ p }}</span></p></div>
          <div class="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900"><i class="fa-solid fa-hand mr-1"></i><b>Si no se cumple algún control, detén el trabajo</b> y avisa a tu supervisor. Tienes el derecho y el deber de no trabajar en condiciones inseguras.</div>
          <div class="flex gap-2"><button @click="mover(-1)" class="flex-1 py-2.5 rounded-xl border font-bold"><i class="fa-solid fa-chevron-left mr-1"></i>Anterior</button><button @click="mover(1)" class="flex-1 py-2.5 rounded-xl border font-bold">Siguiente<i class="fa-solid fa-chevron-right ml-1"></i></button></div>
        </div>
      </div>
    </div>
  </teleport>
</section>`,
  setup() {
    const buscar = ref(''), abierto = ref(null);
    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const lista = computed(() => { const q = norm(buscar.value); return ECF.filter(e => !q || norm([e.n, e.nombre, e.riesgo, ...e.controles].join(' ')).includes(q)); });
    // (2026-11-18) se busca por N° (abierto.value es un proxy de Vue: indexOf no lo encontraba y quedaba pegado)
    const mover = (d) => {
      const i = ECF.findIndex(e => e.n === abierto.value?.n);
      abierto.value = ECF[((i < 0 ? 0 : i) + d + ECF.length) % ECF.length];
      Vue.nextTick(() => { const el = document.querySelector('[data-ecf=detalle] > div'); if (el) el.scrollTop = 0; });
    };
    return { buscar, abierto, lista, mover, dibujoECF };
  }
};
