// =====================================================================
// CORE · <firma-pad> Firma dibujada con el mouse o con el dedo (pantalla touch)
// ---------------------------------------------------------------------
// <firma-pad :firma="dataUrl" titulo="Mecánico responsable" :disabled="!puedeEditar" @guardar="url => ..."></firma-pad>
//  - Muestra la firma guardada (imagen) o "Sin firma".
//  - "Firmar" abre un recuadro grande para firmar; "Guardar firma" emite @guardar con la imagen (PNG en base64).
//  - "Borrar" emite @guardar con '' (pide confirmación).
// =====================================================================
const { ref, nextTick } = Vue;

/** Tamaño con que se guarda la firma (liviano para la base de datos). */
const ANCHO = 600, ALTO = 200;

export default {
  name: 'FirmaPad',
  props: {
    firma: { type: String, default: '' },
    titulo: { type: String, default: 'Firma' },
    disabled: { type: Boolean, default: false },
    compacto: { type: Boolean, default: false }
  },
  emits: ['guardar'],
  template: /* html */ `
  <div :class="['flex items-center gap-2', compacto ? '' : 'flex-col items-stretch']">
    <div :class="['border-2 border-dashed rounded-xl bg-white flex items-center justify-center overflow-hidden', compacto ? 'w-32 h-12' : 'h-20']">
      <img v-if="firma" :src="firma" alt="Firma" class="max-h-full max-w-full object-contain">
      <span v-else class="text-[11px] text-slate-400 italic">Sin firma</span>
    </div>
    <div v-if="!disabled" class="flex gap-1.5">
      <button type="button" @click="abrir" class="flex-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold whitespace-nowrap"><i class="fa-solid fa-signature mr-1"></i>{{ firma ? 'Volver a firmar' : 'Firmar' }}</button>
      <button v-if="firma" type="button" @click="borrar" class="px-2.5 py-2 rounded-lg border text-rose-600 hover:bg-rose-50 text-xs" title="Borrar firma"><i class="fa-solid fa-eraser"></i></button>
    </div>

    <teleport to="body">
      <div v-if="abierto" class="fixed inset-0 bg-slate-950/85 z-[90] flex items-center justify-center p-3">
        <div class="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden">
          <div class="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
            <span class="text-lg font-black"><i class="fa-solid fa-signature mr-2 text-amber-400"></i>{{ titulo }}</span>
            <button type="button" @click="abierto = false" class="text-white/70 hover:text-white text-2xl"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="p-4 space-y-3">
            <p class="text-sm text-slate-500 font-semibold">Firma dentro del recuadro con el mouse o con el dedo.</p>
            <canvas ref="lienzo" class="w-full h-[300px] border-4 border-slate-300 rounded-2xl bg-white cursor-crosshair"
              style="touch-action: none"
              @pointerdown="empezar" @pointermove="mover" @pointerup="terminar" @pointerleave="terminar" @pointercancel="terminar"></canvas>
            <div class="flex flex-wrap justify-between gap-2">
              <button type="button" @click="limpiar" class="px-5 py-3 rounded-xl border-2 font-bold text-slate-700 hover:bg-slate-50"><i class="fa-solid fa-eraser mr-1"></i>Limpiar</button>
              <div class="flex gap-2">
                <button type="button" @click="abierto = false" class="px-5 py-3 rounded-xl font-bold bg-slate-200 text-slate-800">Cancelar</button>
                <button type="button" @click="guardar" :disabled="!hayTrazo" class="px-6 py-3 rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40"><i class="fa-solid fa-check mr-1"></i>Guardar firma</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </teleport>
  </div>`,
  setup(props, { emit }) {
    const abierto = ref(false);
    const lienzo = ref(null);
    const hayTrazo = ref(false);
    let ctx = null, dibujando = false;

    const preparar = () => {
      const c = lienzo.value;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
      ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';
      hayTrazo.value = false;
    };
    const abrir = async () => { abierto.value = true; await nextTick(); preparar(); };
    const punto = (e) => { const r = lienzo.value.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const empezar = (e) => {
      if (!ctx) return;
      e.preventDefault();
      try { lienzo.value.setPointerCapture(e.pointerId); } catch (_) { /* sin soporte */ }
      dibujando = true;
      const [x, y] = punto(e);
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke();   // un toque deja un punto
      hayTrazo.value = true;
    };
    const mover = (e) => {
      if (!dibujando || !ctx) return;
      e.preventDefault();
      const [x, y] = punto(e);
      ctx.lineTo(x, y); ctx.stroke();
    };
    const terminar = () => { dibujando = false; };
    const limpiar = () => { const c = lienzo.value; if (ctx && c) { ctx.clearRect(0, 0, c.width, c.height); hayTrazo.value = false; } };

    const guardar = () => {
      const c = lienzo.value;
      if (!c || !hayTrazo.value) return;
      // Se reduce a 600x200 (manteniendo proporción) para que pese poco
      const out = document.createElement('canvas');
      out.width = ANCHO; out.height = ALTO;
      const k = Math.min(ANCHO / c.width, ALTO / c.height);
      const w = c.width * k, h = c.height * k;
      out.getContext('2d').drawImage(c, (ANCHO - w) / 2, (ALTO - h) / 2, w, h);
      emit('guardar', out.toDataURL('image/png'));
      abierto.value = false;
    };
    const borrar = () => { if (confirm(`¿Borrar la firma (${props.titulo})?`)) emit('guardar', ''); };

    return { abierto, lienzo, hayTrazo, abrir, empezar, mover, terminar, limpiar, guardar, borrar };
  }
};
