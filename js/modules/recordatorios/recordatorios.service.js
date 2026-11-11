// =====================================================================
// MIS TAREAS · Recordatorio de tareas PERSONAL de cada usuario
// ---------------------------------------------------------------------
// · Cada usuario tiene su propio calendario: solo ve y maneja SUS tareas
//   (RLS por auth_id en sql/recordatorios.sql; ni el Admin las ve).
// · Tareas únicas (programadas para un día) y tareas que se repiten
//   (diaria, lunes a viernes, semanal, mensual, anual, cada N…).
// · Estado por día en bd_recordatorios_estado (HECHA / OMITIDA): una tarea diaria
//   se marca cada día por separado.
// · AVISOS (motor que corre mientras la app está abierta):
//     - campana del encabezado con contador (vencidas + pendientes de hoy)
//     - ventana resumen al iniciar sesión
//     - notificación de Windows (Notification API) + sonido
//     - aviso N minutos antes de la hora, a la hora, N días antes y resumen de la mañana
//     - "Posponer" 5/10/30/60 min
//     - si la sesión se cierra por inactividad, sigue avisando lo de las próximas 24 h
//       (se borra al apretar "Salir").
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { usuarioActivo, currentTab } from '../../core/store.js';
import { TABLAS } from '../../core/tablas.js';
import { hoyISO, sumarDiasISO } from '../../core/utils.js';

const { ref, computed, watch } = Vue;

export const TABLA_REC = TABLAS.RECORDATORIOS;
export const TABLA_REC_ESTADO = TABLAS.RECORDATORIOS_ESTADO;
export const TAB_TAREAS = 'misTareas';

// ---------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------
export const REPETICIONES = [
  { k: 'NINGUNA', l: 'Una sola vez', icon: 'fa-calendar-day' },
  { k: 'DIARIA', l: 'Todos los días', icon: 'fa-rotate' },
  { k: 'LABORAL', l: 'Lunes a viernes', icon: 'fa-briefcase' },
  { k: 'SEMANAL', l: 'Semanal', icon: 'fa-calendar-week' },
  { k: 'MENSUAL', l: 'Mensual', icon: 'fa-calendar' },
  { k: 'ANUAL', l: 'Anual', icon: 'fa-calendar-check' }
];
export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
/** Orden de la semana en el calendario: lunes primero. */
export const SEMANA_LUN = [1, 2, 3, 4, 5, 6, 0];

export const AVISOS_MIN = [
  { v: null, l: 'Sin aviso' },
  { v: 0, l: 'A la hora' },
  { v: 5, l: '5 min antes' },
  { v: 10, l: '10 min antes' },
  { v: 15, l: '15 min antes' },
  { v: 30, l: '30 min antes' },
  { v: 60, l: '1 hora antes' },
  { v: 120, l: '2 horas antes' },
  { v: 1440, l: '1 día antes' }
];
export const AVISOS_DIAS = [
  { v: 0, l: 'Solo el mismo día' },
  { v: 1, l: '1 día antes' },
  { v: 2, l: '2 días antes' },
  { v: 3, l: '3 días antes' },
  { v: 7, l: '1 semana antes' },
  { v: 15, l: '15 días antes' },
  { v: 30, l: '1 mes antes' }
];
export const PRIORIDADES = [
  { k: 'ALTA', l: 'Alta', dot: 'bg-rose-500', txt: 'text-rose-600', borde: 'border-l-rose-500' },
  { k: 'MEDIA', l: 'Media', dot: 'bg-amber-400', txt: 'text-amber-600', borde: 'border-l-amber-400' },
  { k: 'BAJA', l: 'Baja', dot: 'bg-slate-300', txt: 'text-slate-500', borde: 'border-l-slate-300' }
];
export const CATEGORIAS = [
  { k: 'GENERAL', chip: 'bg-slate-100 text-slate-700', cal: 'bg-slate-500' },
  { k: 'OPERACIONES', chip: 'bg-amber-100 text-amber-800', cal: 'bg-amber-500' },
  { k: 'MANTENCIÓN', chip: 'bg-orange-100 text-orange-800', cal: 'bg-orange-500' },
  { k: 'COMPRAS', chip: 'bg-emerald-100 text-emerald-800', cal: 'bg-emerald-600' },
  { k: 'REUNIÓN', chip: 'bg-violet-100 text-violet-800', cal: 'bg-violet-500' },
  { k: 'LLAMADA', chip: 'bg-sky-100 text-sky-800', cal: 'bg-sky-500' },
  { k: 'DOCUMENTOS', chip: 'bg-indigo-100 text-indigo-800', cal: 'bg-indigo-500' },
  { k: 'SEGURIDAD', chip: 'bg-red-100 text-red-800', cal: 'bg-red-500' },
  { k: 'PERSONAL', chip: 'bg-pink-100 text-pink-800', cal: 'bg-pink-500' }
];
const CAT_EXTRA = [
  { chip: 'bg-teal-100 text-teal-800', cal: 'bg-teal-500' },
  { chip: 'bg-lime-100 text-lime-800', cal: 'bg-lime-600' },
  { chip: 'bg-fuchsia-100 text-fuchsia-800', cal: 'bg-fuchsia-500' },
  { chip: 'bg-cyan-100 text-cyan-800', cal: 'bg-cyan-600' }
];
export const estiloCategoria = (c) => {
  const k = String(c || 'GENERAL').toUpperCase();
  const f = CATEGORIAS.find(x => x.k === k);
  if (f) return f;
  let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CAT_EXTRA[h % CAT_EXTRA.length];
};
export const estiloPrioridad = (p) => PRIORIDADES.find(x => x.k === p) || PRIORIDADES[1];

// ---------------------------------------------------------------------
// Fechas (siempre hora local)
// ---------------------------------------------------------------------
const pad2 = (n) => String(n).padStart(2, '0');
const partes = (iso) => String(iso).slice(0, 10).split('-').map(Number);
export const isoDe = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const fechaDe = (iso) => { const [y, m, d] = partes(iso); return new Date(y, m - 1, d); };
const diaNum = (iso) => { const [y, m, d] = partes(iso); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
export const diasEntreISO = (a, b) => diaNum(b) - diaNum(a);
export const diaSemana = (iso) => fechaDe(iso).getDay();
const ultimoDiaMes = (y, m) => new Date(y, m, 0).getDate();   // m = 1..12
export const lunesDe = (iso) => sumarDiasISO(iso, -((diaSemana(iso) + 6) % 7));
export const primeroMes = (iso) => { const [y, m] = partes(iso); return `${y}-${pad2(m)}-01`; };
export const sumarMeses = (iso, n) => {
  const [y, m] = partes(iso);
  const d = new Date(y, m - 1 + n, 1);
  return isoDe(d);
};
/** Mismo día N meses después (si no existe, el último día de ese mes). */
export const mismoDiaEnMeses = (iso, n) => {
  const [y, m, d] = partes(iso);
  const base = new Date(y, m - 1 + n, 1);
  const dd = Math.min(d, ultimoDiaMes(base.getFullYear(), base.getMonth() + 1));
  return `${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(dd)}`;
};
export const horaCorta = (h) => (h ? String(h).slice(0, 5) : '');
/** Momento (Date) de una fecha ISO + hora "HH:MM". */
export const momento = (iso, hora) => {
  const [y, m, d] = partes(iso);
  const [hh, mm] = String(hora || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
};
export const fechaLarga = (iso) => {
  if (!iso) return '';
  const d = fechaDe(iso);
  return `${DIAS_LARGOS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}`;
};
export const fechaCorta = (iso) => {
  if (!iso) return '';
  const [y, m, d] = partes(iso);
  return `${pad2(d)}-${pad2(m)}-${y}`;
};
/** "Hoy", "Mañana", "Ayer", "En 3 días", "Hace 2 días". */
export const fechaRelativa = (iso) => {
  const n = diasEntreISO(hoyISO(), iso);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n === -1) return 'Ayer';
  return n > 0 ? `En ${n} días` : `Hace ${-n} días`;
};

// ---------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------
export const dbTareas = ref([]);
export const dbEstados = ref([]);
export const cargandoTareas = ref(false);
export const tareasCargadas = ref(false);
export const faltaSQLTareas = ref(false);

const mapTarea = (r) => ({
  id: r.id,
  titulo: r.titulo || '',
  detalle: r.detalle || '',
  fecha: r.fecha ? String(r.fecha).slice(0, 10) : hoyISO(),
  hora: horaCorta(r.hora),
  repeticion: r.repeticion || 'NINGUNA',
  cada: Math.max(1, Number(r.cada) || 1),
  dias_semana: Array.isArray(r.dias_semana) ? r.dias_semana.map(Number) : [],
  fecha_fin: r.fecha_fin ? String(r.fecha_fin).slice(0, 10) : '',
  aviso_min: r.aviso_min === null || r.aviso_min === undefined ? null : Number(r.aviso_min),
  aviso_dias: Number(r.aviso_dias) || 0,
  prioridad: r.prioridad || 'MEDIA',
  categoria: (r.categoria || 'GENERAL').toUpperCase(),
  checklist: Array.isArray(r.checklist) ? r.checklist : [],
  activa: r.activa !== false,
  created_at: r.created_at
});

const leerTodo = async (tabla) => {
  let filas = [], pag = 0;
  while (true) {
    const data = await sb(supabaseClient.from(tabla).select('*').order('id').range(pag * 1000, pag * 1000 + 999));
    filas = filas.concat(data || []);
    if (!data || data.length < 1000) break;
    pag++;
  }
  return filas;
};

export const cargarTareas = async (silencioso = false) => {
  if (!usuarioActivo.value) return;
  if (!silencioso) cargandoTareas.value = true;
  try {
    const [t, e] = await Promise.all([leerTodo(TABLA_REC), leerTodo(TABLA_REC_ESTADO)]);
    dbTareas.value = t.map(mapTarea);
    dbEstados.value = e.map(r => ({ id: r.id, rid: r.recordatorio_id, fecha: String(r.fecha).slice(0, 10), estado: r.estado || 'HECHA', hecha_at: r.hecha_at }));
    faltaSQLTareas.value = false;
    tareasCargadas.value = true;
    guardarCache();
  } catch (err) {
    const m = errMsg(err);
    if (/does not exist|relation|schema cache|not find/i.test(m)) faltaSQLTareas.value = true;
    else if (!silencioso) console.error('[Mis Tareas] Error cargando', err);
  } finally { cargandoTareas.value = false; }
};

/** "id|fecha" → estado */
export const mapaEstados = computed(() => {
  const m = new Map();
  dbEstados.value.forEach(e => m.set(`${e.rid}|${e.fecha}`, e));
  return m;
});
export const estadoDe = (t, fecha) => mapaEstados.value.get(`${t.id}|${fecha}`)?.estado || null;

// ---------------------------------------------------------------------
// Repetición: ¿la tarea ocurre en esta fecha?
// ---------------------------------------------------------------------
export const ocurreEn = (t, iso) => {
  if (!t.activa) return false;
  if (iso < t.fecha) return false;
  if (t.fecha_fin && iso > t.fecha_fin) return false;
  const cada = Math.max(1, t.cada || 1);
  switch (t.repeticion) {
    case 'NINGUNA': return iso === t.fecha;
    case 'DIARIA': return diasEntreISO(t.fecha, iso) % cada === 0;
    case 'LABORAL': { const w = diaSemana(iso); return w >= 1 && w <= 5; }
    case 'SEMANAL': {
      const dias = t.dias_semana && t.dias_semana.length ? t.dias_semana : [diaSemana(t.fecha)];
      if (!dias.includes(diaSemana(iso))) return false;
      const semanas = Math.floor(diasEntreISO(lunesDe(t.fecha), lunesDe(iso)) / 7);
      return semanas % cada === 0;
    }
    case 'MENSUAL': {
      const [y0, m0, d0] = partes(t.fecha);
      const [y, m, d] = partes(iso);
      const meses = (y - y0) * 12 + (m - m0);
      if (meses < 0 || meses % cada !== 0) return false;
      return d === Math.min(d0, ultimoDiaMes(y, m));
    }
    case 'ANUAL': {
      const [y0, m0, d0] = partes(t.fecha);
      const [y, m, d] = partes(iso);
      if (m !== m0 || (y - y0) % cada !== 0) return false;
      return d === Math.min(d0, ultimoDiaMes(y, m));
    }
    default: return iso === t.fecha;
  }
};

export const esRepetitiva = (t) => t.repeticion !== 'NINGUNA';
export const esRutinaDiaria = (t) => t.repeticion === 'DIARIA' || t.repeticion === 'LABORAL';

/** Texto de la repetición: "Todos los días", "Cada 2 semanas: Lun, Mié"... */
export const textoRepeticion = (t) => {
  const c = t.cada || 1;
  let s;
  switch (t.repeticion) {
    case 'NINGUNA': return 'Una sola vez';
    case 'DIARIA': s = c > 1 ? `Cada ${c} días` : 'Todos los días'; break;
    case 'LABORAL': s = 'Lunes a viernes'; break;
    case 'SEMANAL': {
      const dias = (t.dias_semana && t.dias_semana.length ? t.dias_semana : [diaSemana(t.fecha)]);
      const txt = SEMANA_LUN.filter(d => dias.includes(d)).map(d => DIAS_CORTOS[d]).join(', ');
      s = (c > 1 ? `Cada ${c} semanas` : 'Semanal') + ': ' + txt; break;
    }
    case 'MENSUAL': s = (c > 1 ? `Cada ${c} meses` : 'Mensual') + `, día ${partes(t.fecha)[2]}`; break;
    case 'ANUAL': { const [, m, d] = partes(t.fecha); s = (c > 1 ? `Cada ${c} años` : 'Anual') + `, ${d} de ${MESES[m - 1].toLowerCase()}`; break; }
    default: s = '';
  }
  if (t.fecha_fin) s += ` (hasta ${fechaCorta(t.fecha_fin)})`;
  return s;
};

const ordenOcurrencia = (a, b) => {
  const ha = a.t.hora || '', hb = b.t.hora || '';
  if (!ha && hb) return -1;
  if (ha && !hb) return 1;
  if (ha !== hb) return ha.localeCompare(hb);
  const pr = { ALTA: 0, MEDIA: 1, BAJA: 2 };
  return (pr[a.t.prioridad] ?? 1) - (pr[b.t.prioridad] ?? 1) || a.t.titulo.localeCompare(b.t.titulo);
};

const ocurrencia = (t, fecha) => {
  const estado = estadoDe(t, fecha);
  return { key: `${t.id}|${fecha}`, t, fecha, estado, hecha: estado === 'HECHA', omitida: estado === 'OMITIDA' };
};

/** Tareas de un día (con su estado), ordenadas: todo el día primero, luego por hora. */
export const tareasDelDia = (iso, incluirOmitidas = false) =>
  dbTareas.value.filter(t => ocurreEn(t, iso)).map(t => ocurrencia(t, iso))
    .filter(o => incluirOmitidas || !o.omitida).sort(ordenOcurrencia);

/** Mapa fecha → ocurrencias entre dos fechas (inclusive). */
export const tareasEntre = (desde, hasta) => {
  const out = {};
  const n = diasEntreISO(desde, hasta);
  for (let i = 0; i <= n; i++) { const f = sumarDiasISO(desde, i); out[f] = tareasDelDia(f); }
  return out;
};

// ---------- Listas para Hoy / campana ----------
export const hoyRef = ref(hoyISO());   // cambia sola a medianoche (ver motor)

export const ocurrenciasHoy = computed(() => { mapaEstados.value; return tareasDelDia(hoyRef.value); });
export const pendientesHoy = computed(() => ocurrenciasHoy.value.filter(o => !o.hecha));
export const hechasHoy = computed(() => ocurrenciasHoy.value.filter(o => o.hecha));
export const rutinaHoy = computed(() => ocurrenciasHoy.value.filter(o => esRutinaDiaria(o.t)));
export const programadasHoy = computed(() => ocurrenciasHoy.value.filter(o => !esRutinaDiaria(o.t)));

/** Tareas únicas de días anteriores que no se marcaron hechas (último año). */
export const vencidas = computed(() => {
  const hoy = hoyRef.value;
  const limite = sumarDiasISO(hoy, -365);
  return dbTareas.value
    .filter(t => t.activa && t.repeticion === 'NINGUNA' && t.fecha < hoy && t.fecha >= limite && !estadoDe(t, t.fecha))
    .map(t => ocurrencia(t, t.fecha))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || ordenOcurrencia(a, b));
});

/** Próximos N días (sin hoy). */
export const proximas = (dias = 7) => {
  const out = [];
  for (let i = 1; i <= dias; i++) {
    const f = sumarDiasISO(hoyRef.value, i);
    tareasDelDia(f).filter(o => !o.hecha && !esRutinaDiaria(o.t)).forEach(o => out.push(o));
  }
  return out;
};
export const proximas7 = computed(() => { mapaEstados.value; dbTareas.value; return proximas(7); });

/** Tareas programadas con aviso "N días antes" que caen dentro de ese plazo (sin hoy). */
export const avisosAnticipados = computed(() => {
  const hoy = hoyRef.value;
  const maxDias = Math.max(0, ...dbTareas.value.map(t => t.aviso_dias || 0));
  const out = [];
  for (let i = 1; i <= maxDias; i++) {
    const f = sumarDiasISO(hoy, i);
    tareasDelDia(f).filter(o => !o.hecha && (o.t.aviso_dias || 0) >= i).forEach(o => out.push(o));
  }
  return out;
});

/** Número de la campana: vencidas + pendientes de hoy. */
export const contadorCampana = computed(() => vencidas.value.length + pendientesHoy.value.length);

export const progresoHoy = computed(() => {
  const tot = ocurrenciasHoy.value.length;
  return tot ? Math.round(hechasHoy.value.length / tot * 100) : 0;
});

/** Próxima fecha (desde hoy) en que ocurre la tarea, dentro de 400 días. */
export const proximaFecha = (t) => {
  const hoy = hoyRef.value;
  const desde = t.fecha > hoy ? t.fecha : hoy;
  for (let i = 0; i <= 400; i++) {
    const f = sumarDiasISO(desde, i);
    if (t.fecha_fin && f > t.fecha_fin) return '';
    if (ocurreEn(t, f) && !estadoDe(t, f)) return f;
  }
  return '';
};

/** Racha: días seguidos (hasta ayer, o hoy si ya está hecha) en que se cumplió una rutina. */
export const racha = (t) => {
  if (!esRepetitiva(t)) return 0;
  let n = 0;
  let f = hoyRef.value;
  if (!(ocurreEn(t, f) && estadoDe(t, f) === 'HECHA')) f = sumarDiasISO(f, -1);
  for (let i = 0; i < 366 && f >= t.fecha; i++) {
    if (ocurreEn(t, f)) {
      if (estadoDe(t, f) === 'HECHA') n++;
      else if (estadoDe(t, f) !== 'OMITIDA') break;
    }
    f = sumarDiasISO(f, -1);
  }
  return n;
};

/** Resumen de los últimos 7 días: hechas / total. */
export const cumplimientoSemana = computed(() => {
  mapaEstados.value;
  let tot = 0, ok = 0;
  for (let i = 0; i < 7; i++) {
    const f = sumarDiasISO(hoyRef.value, -i);
    tareasDelDia(f).forEach(o => { tot++; if (o.hecha) ok++; });
  }
  return { tot, ok, pct: tot ? Math.round(ok / tot * 100) : 0 };
});

// ---------------------------------------------------------------------
// Guardar / marcar / eliminar
// ---------------------------------------------------------------------
const filaDesdeForm = (f) => ({
  titulo: String(f.titulo || '').trim(),
  detalle: String(f.detalle || '').trim() || null,
  fecha: f.fecha || hoyISO(),
  hora: f.todoElDia || !f.hora ? null : f.hora,
  repeticion: f.repeticion || 'NINGUNA',
  cada: Math.max(1, Number(f.cada) || 1),
  dias_semana: f.repeticion === 'SEMANAL' ? (f.dias_semana && f.dias_semana.length ? f.dias_semana : [diaSemana(f.fecha || hoyISO())]) : null,
  fecha_fin: f.repeticion !== 'NINGUNA' && f.fecha_fin ? f.fecha_fin : null,
  aviso_min: f.todoElDia || !f.hora ? null : (f.aviso_min === '' || f.aviso_min === undefined ? null : f.aviso_min),
  aviso_dias: f.repeticion === 'NINGUNA' ? (Number(f.aviso_dias) || 0) : 0,
  prioridad: f.prioridad || 'MEDIA',
  categoria: String(f.categoria || 'GENERAL').trim().toUpperCase() || 'GENERAL',
  checklist: (f.checklist || []).filter(c => String(c.t || '').trim()).map(c => ({ t: String(c.t).trim(), ok: Boolean(c.ok) })),
  activa: f.activa !== false,
  updated_at: new Date().toISOString()
});

export const guardandoTarea = ref(false);

export const guardarTarea = async (f) => {
  const fila = filaDesdeForm(f);
  if (!fila.titulo) { alert('Escribe el título de la tarea.'); return false; }
  if (fila.fecha_fin && fila.fecha_fin < fila.fecha) { alert('La fecha "hasta" no puede ser anterior a la fecha de inicio.'); return false; }
  guardandoTarea.value = true;
  try {
    if (f.id) {
      await sb(supabaseClient.from(TABLA_REC).update(fila).eq('id', f.id));
    } else {
      fila.usuario = usuarioActivo.value?.usuario || null;
      await sb(supabaseClient.from(TABLA_REC).insert(fila));
    }
    await cargarTareas(true);
    return true;
  } catch (err) {
    alert('No se pudo guardar la tarea: ' + errMsg(err));
    return false;
  } finally { guardandoTarea.value = false; }
};

/** Agregar rápido (solo título; opcional hora y "todos los días"). */
export const agregarRapido = async (titulo, fecha = hoyISO(), hora = '', diaria = false) => {
  if (!String(titulo || '').trim()) return false;
  return guardarTarea({
    titulo, fecha, hora, todoElDia: !hora, repeticion: diaria ? 'DIARIA' : 'NINGUNA',
    aviso_min: hora ? 15 : null, prioridad: 'MEDIA', categoria: 'GENERAL', checklist: []
  });
};

/** Marca un día de una tarea como HECHA / OMITIDA, o lo deja pendiente (estado = null). */
export const marcar = async (t, fecha, estado = 'HECHA') => {
  const previo = [...dbEstados.value];
  // Cambio inmediato en pantalla (si falla, se revierte)
  dbEstados.value = dbEstados.value.filter(e => !(e.rid === t.id && e.fecha === fecha));
  if (estado) dbEstados.value.push({ id: null, rid: t.id, fecha, estado, hecha_at: new Date().toISOString() });
  try {
    if (estado) {
      await sb(supabaseClient.from(TABLA_REC_ESTADO).upsert(
        { recordatorio_id: t.id, fecha, estado, hecha_at: new Date().toISOString() },
        { onConflict: 'recordatorio_id,fecha' }));
    } else {
      await sb(supabaseClient.from(TABLA_REC_ESTADO).delete().eq('recordatorio_id', t.id).eq('fecha', fecha));
    }
    guardarCache();
  } catch (err) {
    dbEstados.value = previo;
    alert('No se pudo actualizar la tarea: ' + errMsg(err));
  }
};
export const alternarHecha = (o) => marcar(o.t, o.fecha, o.hecha ? null : 'HECHA');

/** Tarea única: cambiarla a otra fecha (ej. "pasar a mañana"). */
export const moverTarea = async (t, nuevaFecha) => {
  try {
    await sb(supabaseClient.from(TABLA_REC).update({ fecha: nuevaFecha, updated_at: new Date().toISOString() }).eq('id', t.id));
    await cargarTareas(true);
  } catch (err) { alert('No se pudo mover la tarea: ' + errMsg(err)); }
};

export const eliminarTarea = async (t, preguntar = true) => {
  if (preguntar && !confirm(esRepetitiva(t)
    ? `¿Eliminar "${t.titulo}" y TODAS sus repeticiones?\n(Para quitar solo un día usa "Omitir este día")`
    : `¿Eliminar la tarea "${t.titulo}"?`)) return false;
  try {
    await sb(supabaseClient.from(TABLA_REC).delete().eq('id', t.id));
    await cargarTareas(true);
    return true;
  } catch (err) { alert('No se pudo eliminar: ' + errMsg(err)); return false; }
};

export const pausarTarea = async (t) => {
  try {
    await sb(supabaseClient.from(TABLA_REC).update({ activa: !t.activa, updated_at: new Date().toISOString() }).eq('id', t.id));
    await cargarTareas(true);
  } catch (err) { alert('No se pudo cambiar: ' + errMsg(err)); }
};

export const alternarChecklist = async (t, i) => {
  const lista = t.checklist.map((c, j) => (j === i ? { ...c, ok: !c.ok } : c));
  const antes = t.checklist;
  t.checklist = lista;
  try {
    await sb(supabaseClient.from(TABLA_REC).update({ checklist: lista }).eq('id', t.id));
  } catch (err) { t.checklist = antes; alert('No se pudo guardar: ' + errMsg(err)); }
};

// ---------------------------------------------------------------------
// Formulario (ventana global: la usan la campana y la pantalla Mis Tareas)
// ---------------------------------------------------------------------
export const formTarea = ref(null);

export const abrirNuevaTarea = (fecha = hoyISO(), extra = {}) => {
  formTarea.value = {
    id: null, titulo: '', detalle: '', fecha, hora: '', todoElDia: true,
    repeticion: 'NINGUNA', cada: 1, dias_semana: [diaSemana(fecha)], fecha_fin: '',
    aviso_min: 15, aviso_dias: 0, prioridad: 'MEDIA', categoria: 'GENERAL', checklist: [], activa: true,
    ...extra
  };
};
export const abrirEditarTarea = (t) => {
  formTarea.value = {
    ...t, todoElDia: !t.hora,
    dias_semana: t.dias_semana && t.dias_semana.length ? [...t.dias_semana] : [diaSemana(t.fecha)],
    checklist: t.checklist.map(c => ({ ...c })),
    aviso_min: t.aviso_min === null ? null : t.aviso_min
  };
};
export const cerrarFormTarea = () => { formTarea.value = null; };

export const irAMisTareas = () => { currentTab.value = TAB_TAREAS; };

// ---------------------------------------------------------------------
// Preferencias de avisos (por usuario, en este navegador)
// ---------------------------------------------------------------------
const PREF_DEFAULT = { windows: true, sonido: true, resumenLogin: true, resumenManana: true, horaResumen: '08:00', seguirTrasCierre: true, volumen: 0.6 };
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* bloqueado */ } };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* bloqueado */ } };
const ssGet = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* bloqueado */ } };

const claveUsuario = () => String(usuarioActivo.value?.usuario || '').toLowerCase();
export const prefAvisos = ref({ ...PREF_DEFAULT });
const cargarPref = () => {
  let p = null;
  try { p = JSON.parse(lsGet('frc_rec_pref_' + claveUsuario()) || 'null'); } catch (e) { p = null; }
  prefAvisos.value = { ...PREF_DEFAULT, ...(p || {}) };
};
watch(prefAvisos, (p) => { if (usuarioActivo.value) lsSet('frc_rec_pref_' + claveUsuario(), JSON.stringify(p)); }, { deep: true });

// ---------------------------------------------------------------------
// Notificaciones de Windows + sonido
// ---------------------------------------------------------------------
export const permisoNotif = ref(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
export const pedirPermisoNotif = async () => {
  if (typeof Notification === 'undefined') { alert('Este navegador no permite notificaciones. Usa Chrome o Edge.'); return; }
  try {
    const r = await Notification.requestPermission();
    permisoNotif.value = r;
    if (r === 'denied') alert('Las notificaciones están BLOQUEADAS para esta página.\nPara activarlas: clic en el candado de la barra de direcciones → Notificaciones → Permitir, y recarga la página.');
    if (r === 'granted') mostrarNotifWindows('Notificaciones activadas', 'Así te avisaré de tus tareas.', 'frc-test');
  } catch (e) { console.warn(e); }
};

let audioCtx = null;
/** Tono corto de 3 notas (no necesita archivo). */
export const sonar = (vol = null) => {
  const v = vol ?? (prefAvisos.value.volumen ?? 0.6);
  // el navegador no deja sonar antes de que la persona haga clic o tecla en la página (después de F5 la notificación de Windows igual suena)
  if (!audioCtx && navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    [[880, 0], [1175, 0.16], [1568, 0.32]].forEach(([f, d]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.35 * v), t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.35);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + d); o.stop(t0 + d + 0.4);
    });
  } catch (e) { /* sin audio */ }
};

const mostrarNotifWindows = (titulo, cuerpo, tag) => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(titulo, { body: cuerpo, tag, icon: 'https://i.imgur.com/J9QQiUc.png', requireInteraction: true });
    n.onclick = () => { try { window.focus(); } catch (e) { /* */ } if (usuarioActivo.value) irAMisTareas(); n.close(); };
  } catch (e) { console.warn('[Mis Tareas] Notificación', e); }
};

// ---------------------------------------------------------------------
// Avisos dentro de la app (tarjetas abajo a la derecha)
// ---------------------------------------------------------------------
export const toasts = ref([]);
let toastSeq = 0;
export const cerrarToast = (id) => { toasts.value = toasts.value.filter(x => x.id !== id); };

/** Dispara un aviso: tarjeta en la app + Windows + sonido. */
export const avisar = ({ titulo, cuerpo, tipo = 'tarea', o = null, tag = null }) => {
  const p = prefAvisos.value;
  if (usuarioActivo.value) {
    const id = ++toastSeq;
    toasts.value = [...toasts.value.filter(x => !(tag && x.tag === tag)), { id, titulo, cuerpo, tipo, o, tag }].slice(-5);
    // resumen / prueba / aviso anticipado se cierran solos; los de hora quedan hasta que los atiendas
    if (tipo !== 'tarea') setTimeout(() => cerrarToast(id), 25000);
  }
  if (p.windows) mostrarNotifWindows(titulo, cuerpo, tag || ('frc-' + toastSeq));
  if (p.sonido) sonar();
};

// ---------- Posponer ----------
const SNOOZE_KEY = () => 'frc_rec_snooze_' + claveUsuario();
const leerSnooze = () => { try { return JSON.parse(lsGet(SNOOZE_KEY()) || '{}'); } catch (e) { return {}; } };
export const posponer = (o, minutos, toastId = null) => {
  const s = leerSnooze();
  s[o.key] = Date.now() + minutos * 60000;
  lsSet(SNOOZE_KEY(), JSON.stringify(s));
  if (toastId) cerrarToast(toastId);
};

// ---------------------------------------------------------------------
// Motor de avisos
// ---------------------------------------------------------------------
const AVISADOS_KEY = (u) => 'frc_rec_avisados_' + u;
const CACHE_KEY = 'frc_rec_cache';
const leerAvisados = (u) => { try { return JSON.parse(lsGet(AVISADOS_KEY(u)) || '{}'); } catch (e) { return {}; } };
const guardarAvisados = (u, m) => {
  // se guardan solo los de los últimos 3 días
  const lim = Date.now() - 3 * 86400000;
  Object.keys(m).forEach(k => { if (m[k] < lim) delete m[k]; });
  lsSet(AVISADOS_KEY(u), JSON.stringify(m));
};

/** Lista de avisos con hora de las próximas 24 h (y los de las últimas 2 h todavía no avisados). */
const avisosProgramados = () => {
  const ahora = Date.now();
  const out = [];
  const dias = [sumarDiasISO(hoyRef.value, -1), hoyRef.value, sumarDiasISO(hoyRef.value, 1), sumarDiasISO(hoyRef.value, 2)];
  dias.forEach(f => tareasDelDia(f).forEach(o => {
    if (o.hecha || !o.t.hora || o.t.aviso_min === null || o.t.aviso_min === undefined) return;
    const enHora = momento(f, o.t.hora).getTime();
    const ant = enHora - o.t.aviso_min * 60000;
    const cuando = o.t.hora;
    if (o.t.aviso_min > 0) out.push({ k: o.key + '|antes', ms: ant, fin: enHora, titulo: `⏰ ${o.t.titulo}`, cuerpo: `${f === hoyRef.value ? 'Hoy' : fechaLarga(f)} a las ${cuando} (en ${textoMinutos(o.t.aviso_min)})`, o });
    out.push({ k: o.key + '|hora', ms: enHora, fin: enHora + 2 * 3600000, titulo: `🔔 ${o.t.titulo}`, cuerpo: `Ahora · ${cuando}${o.t.detalle ? ' · ' + o.t.detalle.slice(0, 80) : ''}`, o });
  }));
  return out.filter(a => a.ms <= ahora + 24 * 3600000 && a.ms >= ahora - 2 * 3600000);
};
export const textoMinutos = (m) => (m >= 1440 ? `${Math.round(m / 1440)} día(s)` : m >= 60 ? `${Math.round(m / 60 * 10) / 10} h` : `${m} min`);

/** Copia de los avisos de las próximas 24 h para seguir avisando si la sesión se cierra por inactividad. */
const guardarCache = () => {
  if (!usuarioActivo.value) return;
  if (!prefAvisos.value.seguirTrasCierre) { lsDel(CACHE_KEY); return; }
  const items = avisosProgramados().map(a => ({ k: a.k, ms: a.ms, fin: a.fin, titulo: a.titulo, cuerpo: a.cuerpo }));
  lsSet(CACHE_KEY, JSON.stringify({ u: claveUsuario(), guardado: Date.now(), items }));
};
/** Al apretar "Salir" se borra la copia (no se avisa más en este navegador hasta volver a entrar). */
export const borrarCacheAvisos = () => lsDel(CACHE_KEY);

const tick = () => {
  const hoy = hoyISO();
  if (hoy !== hoyRef.value) hoyRef.value = hoy;
  const ahora = Date.now();

  // ---- Sin sesión: avisos guardados (sesión cerrada por inactividad) ----
  if (!usuarioActivo.value) {
    let c = null;
    try { c = JSON.parse(lsGet(CACHE_KEY) || 'null'); } catch (e) { c = null; }
    if (!c || !c.items || ahora - c.guardado > 26 * 3600000) return;
    const av = leerAvisados(c.u);
    let cambio = false;
    c.items.forEach(a => {
      if (a.ms <= ahora && ahora < (a.fin || a.ms + 2 * 3600000) && !av[a.k]) {
        av[a.k] = ahora; cambio = true;
        let pref = PREF_DEFAULT;
        try { pref = { ...PREF_DEFAULT, ...(JSON.parse(lsGet('frc_rec_pref_' + c.u) || 'null') || {}) }; } catch (e) { /* */ }
        if (pref.windows) mostrarNotifWindows(a.titulo, a.cuerpo + ' (inicia sesión para marcarla)', a.k);
        if (pref.sonido) sonar(pref.volumen);
      }
    });
    if (cambio) guardarAvisados(c.u, av);
    return;
  }
  if (!tareasCargadas.value) return;

  const u = claveUsuario();
  const av = leerAvisados(u);
  let cambio = false;
  const marcarAvisado = (k) => { av[k] = ahora; cambio = true; };

  // 1) Avisos con hora (antes / a la hora)
  avisosProgramados().forEach(a => {
    if (a.ms <= ahora && !av[a.k] && !a.o.hecha) {
      marcarAvisado(a.k);
      if (ahora >= a.fin) return;                                                   // el "antes" ya pasó (llegó la hora)
      if (a.o.t.created_at && new Date(a.o.t.created_at).getTime() > a.ms) return;  // tarea creada después de la hora del aviso
      avisar({ titulo: a.titulo, cuerpo: a.cuerpo, o: a.o, tag: a.o.key });
    }
  });

  // 2) Pospuestos
  const s = leerSnooze();
  let cambioS = false;
  Object.keys(s).forEach(k => {
    if (s[k] <= ahora) {
      const [id, fecha] = k.split('|');
      const t = dbTareas.value.find(x => String(x.id) === id);
      delete s[k]; cambioS = true;
      if (t && estadoDe(t, fecha) !== 'HECHA') {
        const o = ocurrencia(t, fecha);
        avisar({ titulo: `🔁 ${t.titulo}`, cuerpo: `Recordatorio pospuesto${t.hora ? ' · ' + t.hora : ''}`, o, tag: o.key });
      }
    }
  });
  if (cambioS) lsSet(SNOOZE_KEY(), JSON.stringify(s));

  // 3) Resumen de la mañana (una vez al día, a la hora elegida)
  const p = prefAvisos.value;
  const kRes = `resumen|${hoy}`;
  if (p.resumenManana && !av[kRes] && ahora >= momento(hoy, p.horaResumen || '08:00').getTime()) {
    marcarAvisado(kRes);
    const n = pendientesHoy.value.length, v = vencidas.value.length;
    if (n || v) {
      avisar({
        titulo: '📋 Tus tareas de hoy',
        cuerpo: `${n} pendiente(s) hoy${v ? ` · ${v} vencida(s)` : ''}. ` + pendientesHoy.value.slice(0, 3).map(o => (o.t.hora ? o.t.hora + ' ' : '') + o.t.titulo).join(' · '),
        tipo: 'resumen', tag: 'frc-resumen'
      });
    }
  }

  // 4) Avisos "N días antes" (una vez al día por tarea, desde la hora del resumen)
  if (ahora >= momento(hoy, p.horaResumen || '08:00').getTime()) {
    avisosAnticipados.value.forEach(o => {
      const k = `${o.key}|dias|${hoy}`;
      if (av[k]) return;
      marcarAvisado(k);
      avisar({ titulo: `📅 ${fechaRelativa(o.fecha)}: ${o.t.titulo}`, cuerpo: `${fechaLarga(o.fecha)}${o.t.hora ? ' a las ' + o.t.hora : ''}`, o, tipo: 'anticipado', tag: `${o.key}|dias` });
    });
  }

  if (cambio) guardarAvisados(u, av);
};

// ---------- Ventana resumen al iniciar sesión ----------
export const mostrarResumenLogin = ref(false);
const RESUMEN_FLAG = 'frc_rec_resumen_visto';
const revisarResumenLogin = () => {
  if (!usuarioActivo.value || !tareasCargadas.value || !prefAvisos.value.resumenLogin) return;
  if (ssGet(RESUMEN_FLAG) === claveUsuario()) return;
  ssSet(RESUMEN_FLAG, claveUsuario());
  if (vencidas.value.length || pendientesHoy.value.length || avisosAnticipados.value.length) {
    mostrarResumenLogin.value = true;
    if (prefAvisos.value.sonido) sonar();
  }
};

let motorIniciado = false;
let ultimaRecarga = 0;
/** Se llama una vez desde main.js. */
export const iniciarMotorAvisos = () => {
  if (motorIniciado) return;
  motorIniciado = true;
  watch(usuarioActivo, async (u, antes) => {
    if (u && (!antes || antes.usuario !== u.usuario)) {
      cargarPref();
      tareasCargadas.value = false;
      dbTareas.value = []; dbEstados.value = [];
      await cargarTareas(true);
      ultimaRecarga = Date.now();
      revisarResumenLogin();
      tick();
    }
    if (!u) { toasts.value = []; formTarea.value = null; }
  }, { immediate: true });
  // Al cambiar los avisos se renueva la copia para "después de cerrar sesión"
  watch([dbTareas, dbEstados, () => prefAvisos.value.seguirTrasCierre], () => guardarCache());
  setInterval(() => {
    tick();
    // sincroniza cada 5 min (por si se agregaron tareas desde otro computador / celular)
    if (usuarioActivo.value && Date.now() - ultimaRecarga > 5 * 60000) { ultimaRecarga = Date.now(); cargarTareas(true); }
  }, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
};

/** Botón "Probar aviso". */
export const probarAviso = () => avisar({ titulo: '🔔 Prueba de aviso', cuerpo: 'Así se verán tus recordatorios.', tipo: 'prueba', tag: 'frc-prueba' });
