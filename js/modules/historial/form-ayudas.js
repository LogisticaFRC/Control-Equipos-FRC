// =====================================================================
// HISTORIAL · Ayudas del formulario (todo dentro del sistema, nada se envía a terceros)
// ---------------------------------------------------------------------
//  · Hoja (PDF / imagen) al lado del formulario: se lee y se escribe en la misma pantalla
//  · Sugerencias: mecánicos, lugares, causas detalladas y usuarios de arriendo ya usados
//  · Dictado por voz (Chrome / Edge) para causa detallada, descripción e interferencia
//  · Control del horómetro / km contra los registros anteriores y posteriores del AFI
//  · "Completar pendientes": recorre uno a uno los registros con documento pero incompletos
// =====================================================================
import { dbIntervenciones } from '../../core/store.js';
import { normalizarFecha, diasEntre, mismoAfi } from '../../core/utils.js';
import { formMant, showFormMantencionModal, editarMantencion, docUrlLocal, docTipoLocal, colaIds, colaPos } from './historial.service.js';

const { ref, computed } = Vue;

// ---------------------------------------------------------------------
// Hoja al lado
// ---------------------------------------------------------------------
export const docVisible = ref(true);
export const zoomImg = ref(1);
export const rotImg = ref(0);

/** Links antiguos de Google Drive: /view no se puede mostrar dentro de la página, /preview sí. */
const aVistaPrevia = (url) => {
  const m = String(url).match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([\w-]{10,})/);
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : url;
};
export const urlDoc = computed(() => {
  const u = docUrlLocal.value || formMant.value.linkDrive || '';
  return u ? aVistaPrevia(u) : '';
});
export const docEsImagen = computed(() => docUrlLocal.value ? /^image\//.test(docTipoLocal.value) : /\.(jpe?g|png|webp|gif)(\?|$)/i.test(urlDoc.value));
/** src del iframe: los PDF se abren ajustados al ancho. */
export const srcDoc = computed(() => {
  const u = urlDoc.value;
  if (!u || docEsImagen.value || /drive\.google\.com/.test(u)) return u;
  return u.includes('#') ? u : u + '#view=FitH';
});
export const hayDoc = computed(() => Boolean(urlDoc.value) && docVisible.value);
export const girarImg = () => { rotImg.value = (rotImg.value + 90) % 360; };

// ---------------------------------------------------------------------
// Sugerencias (lo más usado primero)
// ---------------------------------------------------------------------
const frecuentes = (valores, max = 400) => {
  const m = new Map();
  valores.forEach(v => {
    const t = String(v || '').trim();
    if (!t || t === '-' || t.length < 2) return;
    const k = t.toUpperCase();
    const x = m.get(k) || { t, n: 0 }; x.n++; m.set(k, x);
  });
  return [...m.values()].sort((a, b) => b.n - a.n).slice(0, max).map(x => x.t);
};
export const sugMecanicos = computed(() => frecuentes(dbIntervenciones.value.flatMap(i => [i.mec1, i.mec2, i.mec3, i.mec4])));
export const sugLugares = computed(() => frecuentes(dbIntervenciones.value.map(i => i.lugar)));
export const sugCausasDet = computed(() => frecuentes(dbIntervenciones.value.map(i => i.causaDetallada), 300));
export const sugEmpresas = computed(() => frecuentes(dbIntervenciones.value.map(i => i.empresaArriendo)));

// ---------------------------------------------------------------------
// Dictado por voz (API del navegador; en Chrome el audio lo procesa el servicio de voz de Google)
// ---------------------------------------------------------------------
const Reconocedor = window.SpeechRecognition || window.webkitSpeechRecognition;
export const soportaDictado = Boolean(Reconocedor);
export const dictando = ref('');
let rec = null;
export const dictar = (campo) => {
  if (!Reconocedor) return alert('Este navegador no permite dictado. Usa Chrome o Edge (o en Windows: tecla Windows + H).');
  if (rec) { try { rec.stop(); } catch (_) {} }
  if (dictando.value === campo) { dictando.value = ''; rec = null; return; }
  rec = new Reconocedor();
  rec.lang = 'es-CL'; rec.continuous = true; rec.interimResults = false;
  rec.onresult = (e) => {
    let t = '';
    for (let k = e.resultIndex; k < e.results.length; k++) if (e.results[k].isFinal) t += e.results[k][0].transcript;
    t = t.trim();
    if (!t) return;
    const actual = String(formMant.value[campo] || '').trim();
    const frase = t.charAt(0).toUpperCase() + t.slice(1);
    formMant.value[campo] = actual ? `${actual}${/[.,;:]$/.test(actual) ? '' : '.'} ${frase}` : frase;
  };
  rec.onerror = (e) => { if (e.error === 'not-allowed') alert('Permite el uso del micrófono para dictar.'); dictando.value = ''; };
  rec.onend = () => { if (dictando.value === campo) dictando.value = ''; };
  dictando.value = campo;
  rec.start();
};
export const pararDictado = () => { if (rec) { try { rec.stop(); } catch (_) {} } rec = null; dictando.value = ''; };

// ---------------------------------------------------------------------
// Control del horómetro / km
// ---------------------------------------------------------------------
/** { nivel: ''|'ok'|'alerta'|'error', texto } comparando con el registro anterior y el siguiente del mismo AFI. */
export const chequeoHorometro = computed(() => {
  const f = formMant.value;
  const h = Number(f.horometro);
  const fecha = normalizarFecha(f.fecha);
  if (!f.afi || !h || !fecha) return { nivel: '', texto: '' };
  const esKm = /^[A-Z]{4}-?\d{2}$/i.test(String(f.afi).trim());
  const u = esKm ? 'km' : 'h';
  let ant = null, sig = null;
  dbIntervenciones.value.forEach(i => {
    if (i.id === f.id || !mismoAfi(i.afi, f.afi) || !(Number(i.horometro) > 0)) return;
    const fi = normalizarFecha(i.fecha);
    if (!fi) return;
    if (fi <= fecha && (!ant || fi > ant.f || (fi === ant.f && Number(i.horometro) > ant.h))) ant = { f: fi, h: Number(i.horometro) };
    if (fi > fecha && (!sig || fi < sig.f)) sig = { f: fi, h: Number(i.horometro) };
  });
  const fmt = (x) => `${x.h.toLocaleString('es-CL')} ${u} (${x.f.split('-').reverse().join('-')})`;
  if (ant && h < ant.h) return { nivel: 'error', texto: `Es MENOR que el anterior: ${fmt(ant)}. ¿Está bien leído?` };
  if (sig && h > sig.h) return { nivel: 'error', texto: `Es MAYOR que el siguiente: ${fmt(sig)}. ¿Está bien leído?` };
  if (ant) {
    const dias = Math.max(1, diasEntre(fecha, ant.f) || 1);   // diasEntre(a, b) = a − b
    const max = esKm ? dias * 1500 : dias * 24;   // no puede subir más que las horas (o km razonables) que pasaron
    if (h - ant.h > max) return { nivel: 'alerta', texto: `Subió ${(h - ant.h).toLocaleString('es-CL')} ${u} en ${dias} día(s) desde ${fmt(ant)}. Revisa.` };
    return { nivel: 'ok', texto: `Anterior: ${fmt(ant)} → +${(h - ant.h).toLocaleString('es-CL')} ${u}` };
  }
  return { nivel: '', texto: 'Primer registro con horómetro de este AFI.' };
});

// ---------------------------------------------------------------------
// Completar registros pendientes (uno por uno)
// ---------------------------------------------------------------------
/** Registro con documento pero sin lo básico (descripción / causa detallada, mecánico u horómetro). */
export const faltaEnRegistro = (i) => {
  const f = [];
  if (!String(i.descripcion || '').trim() && !String(i.causaDetallada || '').trim()) f.push('descripción');
  if (!String(i.mec1 || '').trim()) f.push('mecánicos');
  if (!(Number(i.horometro) > 0)) f.push('horómetro');
  return f;
};
export const pendientesCompletar = computed(() => dbIntervenciones.value
  .filter(i => i.linkDrive && faltaEnRegistro(i).length)
  .sort((a, b) => String(normalizarFecha(b.fecha)).localeCompare(String(normalizarFecha(a.fecha)))));

export const enCola = computed(() => colaIds.value.length > 0);
const abrirPos = () => {
  const id = colaIds.value[colaPos.value];
  const reg = dbIntervenciones.value.find(i => String(i.id) === String(id));
  if (!reg) return siguienteCola();
  docVisible.value = true; zoomImg.value = 1; rotImg.value = 0;
  editarMantencion(reg);
};
export const abrirCola = () => {
  const ids = pendientesCompletar.value.map(i => i.id);
  if (!ids.length) return alert('No hay registros con documento pendientes de completar.');
  colaIds.value = ids; colaPos.value = 0;
  abrirPos();
};
export const siguienteCola = () => {
  pararDictado();
  if (colaPos.value + 1 >= colaIds.value.length) { salirCola(); return alert('¡Listo! Revisaste todos los pendientes.'); }
  colaPos.value++;
  abrirPos();
};
export const anteriorCola = () => { if (colaPos.value > 0) { pararDictado(); colaPos.value--; abrirPos(); } };
export const salirCola = () => { pararDictado(); colaIds.value = []; colaPos.value = 0; showFormMantencionModal.value = false; };
