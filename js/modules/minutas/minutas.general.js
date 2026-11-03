// =====================================================================
// MINUTAS · Dashboard GENERAL (todas las minutas)
// ---------------------------------------------------------------------
// Cada minuta copia las tareas de la anterior, así que una misma tarea aparece
// en muchas minutas. Aquí cada tarea se cuenta UNA sola vez ("tarea única"):
//   · se identifica por su texto (primera línea, sin tildes/mayúsculas/signos)
//   · toma el ÚLTIMO estado conocido (la minuta más reciente donde aparece)
//   · guarda cuándo apareció por primera vez, cuándo se realizó y cuántas semanas estuvo abierta
// =====================================================================
import { hoyISO, formatDateForDisplay } from '../../core/utils.js';
import { dbMinutas, dbMinutasItems, ESTADOS_MINUTA, resumenItems, esVencida, claveSeccion } from './minutas.service.js';

const { ref, computed } = Vue;

const normK = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
export const claveTareaGeneral = (t) => normK(String(t || '').split('\n')[0]).slice(0, 80);
const diasEntre = (a, b) => (a && b ? Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000) : null);

// ---------- Filtros ----------
export const PERIODOS = [
  { k: 'todo', l: 'Todo' }, { k: '30', l: 'Últimos 30 días' }, { k: '90', l: 'Últimos 3 meses' },
  { k: '180', l: 'Últimos 6 meses' }, { k: 'anio', l: 'Este año' }
];
export const filtroGeneral = ref({ periodo: 'todo', seccion: '', personal: '', lista: 'abiertas', busqueda: '' });

const minutasEnPeriodo = computed(() => {
  const p = filtroGeneral.value.periodo;
  if (p === 'todo') return dbMinutas.value;
  const hoy = hoyISO();
  let desde;
  if (p === 'anio') desde = `${hoy.slice(0, 4)}-01-01`;
  else { const d = new Date(); d.setDate(d.getDate() - Number(p)); desde = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  return dbMinutas.value.filter(m => m.fecha >= desde);
});

// ---------- Tareas únicas ----------
/** Todas las tareas únicas del período (sin filtros de sección/encargado). */
export const tareasUnicasTodas = computed(() => {
  const minutas = minutasEnPeriodo.value;            // ya vienen en orden cronológico
  const idsMinuta = new Map(minutas.map((m, i) => [m.id, i]));
  const actual = dbMinutas.value[dbMinutas.value.length - 1];
  const items = dbMinutasItems.value.filter(i => idsMinuta.has(i.minuta_id))
    .sort((a, b) => idsMinuta.get(a.minuta_id) - idsMinuta.get(b.minuta_id) || a.id - b.id);
  const mapa = new Map();
  items.forEach(it => {
    const k = claveTareaGeneral(it.tarea);
    if (!k) return;
    const m = minutas[idsMinuta.get(it.minuta_id)];
    let t = mapa.get(k);
    if (!t) {
      t = { clave: k, primeraFecha: m.fecha, primeraMinuta: m, historial: [], fecha_compromiso: '' };
      mapa.set(k, t);
    }
    // El último registro manda (estado, texto, encargado, plazo…)
    Object.assign(t, {
      tarea: it.tarea, seccion: it.seccion, area: it.area, personal: it.personal, estado: it.estado,
      fecha_estimada: it.fecha_estimada, fecha_texto: it.fecha_texto, n_item: it.n_item,
      ultimaMinuta: m, item: it
    });
    if (it.fecha_compromiso && (!t.fecha_compromiso || it.fecha_compromiso < t.fecha_compromiso)) t.fecha_compromiso = it.fecha_compromiso;
    if (it.estado === 'Realizado' && it.fecha_realizado) t.fecha_realizado = it.fecha_realizado;
    if (!t.historial.length || t.historial[t.historial.length - 1].minuta.id !== m.id) t.historial.push({ minuta: m, estado: it.estado, item: it });
  });
  return [...mapa.values()].map(t => {
    if (t.estado !== 'Realizado') t.fecha_realizado = '';
    const inicio = t.fecha_compromiso || t.primeraFecha;
    const cierre = t.estado === 'Realizado' ? (t.fecha_realizado || t.ultimaMinuta.fecha) : hoyISO();
    const d = diasEntre(inicio, cierre);
    t.dias = d === null ? null : Math.max(0, d);
    t.semanas = t.historial.length;                                   // minutas en que apareció
    t.enActual = Boolean(actual && t.ultimaMinuta.id === actual.id);  // sigue en la minuta actual
    t.vencida = esVencida(t);
    t.aTiempo = t.estado === 'Realizado' && t.fecha_realizado && t.fecha_estimada ? t.fecha_realizado <= t.fecha_estimada : null;
    return t;
  });
});

/** Tareas únicas con los filtros de sección / encargado aplicados. */
export const tareasUnicas = computed(() => {
  const f = filtroGeneral.value;
  return tareasUnicasTodas.value.filter(t =>
    (!f.seccion || claveSeccion(t) === f.seccion) &&
    (!f.personal || String(t.personal || '').toUpperCase().split(' / ').includes(f.personal)));
});

export const seccionesGeneral = computed(() => [...new Set(tareasUnicasTodas.value.map(t => claveSeccion(t)).filter(Boolean))].sort());
export const personasGeneral = computed(() => [...new Set(tareasUnicasTodas.value.flatMap(t => String(t.personal || '').toUpperCase().split(' / ').map(x => x.trim())).filter(Boolean))].sort());

// ---------- Indicadores ----------
export const kpiGeneral = computed(() => {
  const ts = tareasUnicas.value;
  const r = resumenItems(ts);                          // cuenta por estado, vencidas, a tiempo, % cumplimiento
  const cerradas = ts.filter(t => t.estado === 'Realizado' && t.dias !== null);
  r.minutas = minutasEnPeriodo.value.length;
  r.abiertas = r.Pendiente + r.Proceso;
  r.promDiasCierre = cerradas.length ? Math.round(cerradas.reduce((s, t) => s + t.dias, 0) / cerradas.length) : null;
  const abiertas = ts.filter(t => t.estado === 'Pendiente' || t.estado === 'Proceso');
  r.promSemanasAbiertas = abiertas.length ? Math.round(abiertas.reduce((s, t) => s + t.semanas, 0) / abiertas.length * 10) / 10 : null;
  r.sinActual = ts.filter(t => !t.enActual && t.estado !== 'Realizado' && t.estado !== 'No Realizado').length;
  return r;
});

const agrupar = (lista, claveFn) => {
  const map = {};
  lista.forEach(t => claveFn(t).forEach(k => { (map[k] = map[k] || []).push(t); }));
  return Object.entries(map).map(([personal, l]) => ({ personal, ...resumenItems(l) })).sort((a, b) => b.total - a.total);
};
export const generalPorSeccion = computed(() => agrupar(tareasUnicas.value, t => [claveSeccion(t) || 'SIN SECCIÓN']));
export const generalPorPersonal = computed(() => agrupar(tareasUnicas.value, t => String(t.personal || '').toUpperCase().split(' / ').map(x => x.trim()).filter(Boolean).concat(t.personal ? [] : ['SIN ASIGNAR'])));

/** Tareas realizadas por mes (según fecha de realización). */
export const realizadasPorMes = computed(() => {
  const map = {};
  tareasUnicas.value.filter(t => t.estado === 'Realizado' && t.fecha_realizado).forEach(t => { const k = t.fecha_realizado.slice(0, 7); map[k] = (map[k] || 0) + 1; });
  return Object.keys(map).sort().map(k => ({ mes: k, n: map[k] }));
});

// ---------- Listas ----------
export const LISTAS_GENERAL = [
  { k: 'abiertas', l: 'Abiertas', icon: 'fa-hourglass-half', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  { k: 'vencidas', l: 'Vencidas', icon: 'fa-triangle-exclamation', cls: 'bg-rose-600 text-white border-rose-600' },
  { k: 'Realizado', l: 'Realizadas', icon: 'fa-circle-check', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { k: 'No Realizado', l: 'No realizadas', icon: 'fa-circle-xmark', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
  { k: 'antiguas', l: 'Más tiempo abiertas', icon: 'fa-clock', cls: 'bg-slate-200 text-slate-700 border-slate-300' },
  { k: 'todas', l: 'Todas', icon: 'fa-list', cls: 'bg-white text-slate-700 border-slate-300' }
];
export const filtrarLista = (ts, lista) => {
  const abiertas = ts.filter(t => t.estado === 'Pendiente' || t.estado === 'Proceso');
  switch (lista) {
    case 'abiertas': return abiertas.sort((a, b) => (b.vencida - a.vencida) || String(a.fecha_estimada || '9').localeCompare(String(b.fecha_estimada || '9')));
    case 'vencidas': return ts.filter(t => t.vencida).sort((a, b) => String(a.fecha_estimada).localeCompare(String(b.fecha_estimada)));
    case 'Realizado': return ts.filter(t => t.estado === 'Realizado').sort((a, b) => String(b.fecha_realizado || b.ultimaMinuta.fecha).localeCompare(String(a.fecha_realizado || a.ultimaMinuta.fecha)));
    case 'No Realizado': return ts.filter(t => t.estado === 'No Realizado').sort((a, b) => String(b.ultimaMinuta.fecha).localeCompare(String(a.ultimaMinuta.fecha)));
    case 'antiguas': return abiertas.sort((a, b) => (b.dias || 0) - (a.dias || 0)).slice(0, 30);
    default: return [...ts].sort((a, b) => String(claveSeccion(a)).localeCompare(String(claveSeccion(b))) || (Number(a.n_item) || 0) - (Number(b.n_item) || 0));
  }
};
export const cuentaLista = (k) => filtrarLista(tareasUnicas.value, k).length;
export const listaGeneral = computed(() => {
  const q = filtroGeneral.value.busqueda.trim().toLowerCase();
  return filtrarLista(tareasUnicas.value, filtroGeneral.value.lista)
    .filter(t => !q || [t.tarea, t.personal, t.seccion, t.area].some(v => String(v || '').toLowerCase().includes(q)));
});

/** Historial de una tarea única (modal). */
export const tareaGeneralSel = ref(null);
export const verTareaGeneral = (t) => { tareaGeneralSel.value = t; };

export const textoPlazo = (t) => (t.fecha_estimada ? formatDateForDisplay(t.fecha_estimada) : (t.fecha_texto || '-'));
export { ESTADOS_MINUTA };
