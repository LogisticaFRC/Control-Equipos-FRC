// =====================================================================
// MINUTAS · Lógica (minutas semanales de mejora continua)
// ---------------------------------------------------------------------
// · Cada minuta (bd_minutas) tiene sus tareas (bd_minutas_items).
// · Al crear una minuta nueva se COPIAN las tareas de la última minuta
//   (la de fecha más reciente), así el seguimiento continúa semana a semana
//   y cada minuta anterior queda guardada tal como estaba (histórico).
// · Al marcar "Realizado" se guarda el día en que se realizó (fecha_realizado).
// · Carpetas: Año → Mes, calculadas desde la fecha de la minuta.
// =====================================================================
import { supabaseClient, sb, errMsg, fetchAllRows } from '../../core/supabase.js';
import { TABLAS } from '../../core/tablas.js';
import { usuarioActivo, isAdmin, puedeEditar, soloAdmin, soloEditor } from '../../core/store.js';
import { hoyISO, normalizarFecha, formatDateForDisplay, resetInputFile } from '../../core/utils.js';

const { ref, computed } = Vue;

export const TABLA_MINUTAS = TABLAS.MINUTAS;
export const TABLA_MINUTAS_ITEMS = TABLAS.MINUTAS_ITEMS;

export const ESTADOS_MINUTA = ['Pendiente', 'Proceso', 'Realizado', 'No Realizado'];
export const ESTADO_ESTILO = {
  'Pendiente':    { badge: 'bg-amber-100 text-amber-800 border-amber-300', color: '#f59e0b', icon: 'fa-hourglass-half' },
  'Proceso':      { badge: 'bg-sky-100 text-sky-800 border-sky-300', color: '#0284c7', icon: 'fa-spinner' },
  'Realizado':    { badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', color: '#10b981', icon: 'fa-circle-check' },
  'No Realizado': { badge: 'bg-rose-100 text-rose-800 border-rose-300', color: '#e11d48', icon: 'fa-circle-xmark' }
};
export const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

const SQL_MINUTAS = 'Ejecuta en Supabase → SQL Editor el archivo sql/minutas.sql (crea bd_minutas y bd_minutas_items).';

// ---------- Estado ----------
export const dbMinutas = ref([]);
export const dbMinutasItems = ref([]);
export const cargandoMinutas = ref(false);
export const minutaSelId = ref(null);
export const vistaMinuta = ref('tabla');       // 'tabla' | 'dashboard'
export const filtroEstadoMinuta = ref('');      // filtro de la tabla
export const busquedaMinuta = ref('');
export const openAnios = ref({});
export const openMeses = ref({});

/** Normaliza el texto de estado (importaciones, valores antiguos). */
export const normalizarEstado = (v) => {
  const s = String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (!s) return 'Pendiente';
  if (/^(1|1\.0|si|x|ok|v|cumple|cumplido|listo|hecho)$/.test(s)) return 'Realizado';   // columna "Cumple": 1 = Realizado
  if (/^(0|0\.0|no cumple)$/.test(s)) return 'No Realizado';
  if (/^(p|en proceso|1\/2|0[.,]5)$/.test(s)) return 'Proceso';
  if (s.includes('no real') || s.includes('no cumpl') || s === 'no') return 'No Realizado';
  if (s.includes('proce') || s.includes('curso')) return 'Proceso';
  if (s.includes('realiz') || s.includes('cumpl') || s.includes('ok') || s.includes('termin')) return 'Realizado';
  return 'Pendiente';
};

const mapMinuta = (r) => ({ id: r.id, nombre: String(r.nombre || ''), fecha: normalizarFecha(r.fecha) || '', origen_id: r.origen_id || null, creado_por: r.creado_por || '', created_at: r.created_at || '' });
const mapItem = (r) => ({
  id: r.id, minuta_id: r.minuta_id, n_item: r.n_item ?? '', personal: r.personal || '',
  fecha_compromiso: normalizarFecha(r.fecha_compromiso) || '', fecha_estimada: normalizarFecha(r.fecha_estimada) || '',
  tarea: r.tarea || '', estado: normalizarEstado(r.estado), fecha_realizado: normalizarFecha(r.fecha_realizado) || '',
  seccion: r.seccion || '', area: r.area || '', fecha_texto: r.fecha_texto || ''
});

const avisoError = (err) => {
  const m = errMsg(err);
  if (/bd_minutas|schema cache|does not exist|relation/i.test(m)) alert('Faltan las tablas de MINUTAS en Supabase.\n\n' + SQL_MINUTAS + '\n\nDetalle: ' + m);
  else alert('Error: ' + m);
};

/** Orden cronológico: fecha y luego id. */
const cmpMinuta = (a, b) => String(a.fecha).localeCompare(String(b.fecha)) || (Number(a.id) - Number(b.id));

export const cargarMinutas = async () => {
  cargandoMinutas.value = true;
  try {
    const [m, it] = await Promise.all([fetchAllRows(TABLA_MINUTAS), fetchAllRows(TABLA_MINUTAS_ITEMS)]);
    dbMinutas.value = m.map(mapMinuta).sort(cmpMinuta);
    dbMinutasItems.value = it.map(mapItem);
    // Al entrar, abre la última minuta
    if (!minutaSelId.value || !dbMinutas.value.some(x => x.id === minutaSelId.value)) {
      const ult = ultimaMinuta.value;
      if (ult) seleccionarMinuta(ult);
    }
  } finally { cargandoMinutas.value = false; }
};

// ---------- Carpetas Año → Mes ----------
const anioDe = (m) => String(m.fecha || '').slice(0, 4) || 'SIN FECHA';
const mesDe = (m) => { const n = Number(String(m.fecha || '').slice(5, 7)); return n >= 1 && n <= 12 ? n : 0; };
export const nombreMes = (n) => MESES[n - 1] || 'SIN MES';

export const arbolMinutas = computed(() => {
  const anios = {};
  dbMinutas.value.forEach(m => {
    const a = anioDe(m), mes = mesDe(m);
    anios[a] = anios[a] || {};
    (anios[a][mes] = anios[a][mes] || []).push(m);
  });
  return Object.keys(anios).sort().reverse().map(a => ({
    anio: a,
    total: Object.values(anios[a]).reduce((s, l) => s + l.length, 0),
    meses: Object.keys(anios[a]).map(Number).sort((x, y) => y - x).map(mes => ({
      mes, label: nombreMes(mes), minutas: [...anios[a][mes]].sort(cmpMinuta).reverse()
    }))
  }));
});
const claveMes = (anio, mes) => `${anio}-${mes}`;
export const anioAbierto = (anio) => openAnios.value[anio] !== undefined ? openAnios.value[anio] : anio === String(new Date().getFullYear()) || anio === (arbolMinutas.value[0] && arbolMinutas.value[0].anio);
export const toggleAnio = (anio) => { openAnios.value[anio] = !anioAbierto(anio); };
export const mesAbierto = (anio, mes) => {
  const k = claveMes(anio, mes);
  if (openMeses.value[k] !== undefined) return openMeses.value[k];
  const sel = minutaSel.value;
  return Boolean(sel && anioDe(sel) === anio && mesDe(sel) === mes);
};
export const toggleMes = (anio, mes) => { openMeses.value[claveMes(anio, mes)] = !mesAbierto(anio, mes); };

// ---------- Selección ----------
export const ultimaMinuta = computed(() => dbMinutas.value.length ? dbMinutas.value[dbMinutas.value.length - 1] : null);
export const minutaSel = computed(() => dbMinutas.value.find(m => m.id === minutaSelId.value) || null);
export const esUltimaMinuta = computed(() => Boolean(minutaSel.value && ultimaMinuta.value && minutaSel.value.id === ultimaMinuta.value.id));
export const seleccionarMinuta = (m) => {
  minutaSelId.value = m ? m.id : null;
  if (m) { openAnios.value[anioDe(m)] = true; openMeses.value[claveMes(anioDe(m), mesDe(m))] = true; }
};

/** ¿Puede modificar las tareas de la minuta seleccionada? Admin: cualquiera. Subadmin: solo la última (las anteriores son histórico). */
export const puedeEditarMinuta = computed(() => {
  if (!minutaSel.value) return false;
  if (isAdmin.value) return true;
  return puedeEditar.value && esUltimaMinuta.value;
});

export const itemsDeMinuta = (id) => dbMinutasItems.value.filter(i => i.minuta_id === id)
  .sort((a, b) => (Number(a.n_item) || 0) - (Number(b.n_item) || 0) || a.id - b.id);

export const itemsSel = computed(() => minutaSel.value ? itemsDeMinuta(minutaSel.value.id) : []);

/** Tarea vencida: pasó la fecha estimada y no está cerrada. */
export const esVencida = (it) => Boolean(it.fecha_estimada && it.fecha_estimada < hoyISO() && (it.estado === 'Pendiente' || it.estado === 'Proceso'));

export const itemsFiltrados = computed(() => {
  const q = busquedaMinuta.value.trim().toLowerCase();
  return itemsSel.value.filter(it => {
    if (filtroEstadoMinuta.value === 'VENCIDAS') { if (!esVencida(it)) return false; }
    else if (filtroEstadoMinuta.value && it.estado !== filtroEstadoMinuta.value) return false;
    if (!q) return true;
    return [it.n_item, it.personal, it.tarea, it.area, it.seccion].some(v => String(v).toLowerCase().includes(q));
  });
});

/** Lista de personal ya usado (para autocompletar). */
export const listaPersonal = computed(() => Array.from(new Set(dbMinutasItems.value.map(i => String(i.personal || '').trim().toUpperCase()).filter(Boolean))).sort());

// ---------- Indicadores ----------
export const resumenItems = (items) => {
  const r = { total: items.length, Pendiente: 0, Proceso: 0, Realizado: 0, 'No Realizado': 0, vencidas: 0, aTiempo: 0, atrasadas: 0 };
  items.forEach(it => {
    r[it.estado] = (r[it.estado] || 0) + 1;
    if (esVencida(it)) r.vencidas++;
    if (it.estado === 'Realizado' && it.fecha_realizado && it.fecha_estimada) {
      if (it.fecha_realizado <= it.fecha_estimada) r.aTiempo++; else r.atrasadas++;
    }
  });
  r.cumplimiento = r.total ? Math.round(r.Realizado / r.total * 100) : 0;
  const conFecha = r.aTiempo + r.atrasadas;
  r.pctATiempo = conFecha ? Math.round(r.aTiempo / conFecha * 100) : 0;
  return r;
};
export const resumenSel = computed(() => resumenItems(itemsSel.value));
export const cumplimientoMinuta = (id) => resumenItems(itemsDeMinuta(id)).cumplimiento;

/** Resumen por personal encargado (minuta seleccionada). */
export const resumenPorPersonal = computed(() => {
  const map = {};
  itemsSel.value.forEach(it => {
    const p = String(it.personal || '').trim().toUpperCase() || 'SIN ASIGNAR';
    map[p] = map[p] || [];
    map[p].push(it);
  });
  return Object.entries(map).map(([personal, list]) => ({ personal, ...resumenItems(list) }))
    .sort((a, b) => b.total - a.total);
});

/** Resumen por sección (minuta seleccionada). */
export const resumenPorSeccion = computed(() => {
  const map = {};
  itemsSel.value.forEach(it => { const k = String(it.seccion || '').trim().toUpperCase() || 'SIN SECCIÓN'; (map[k] = map[k] || []).push(it); });
  return Object.entries(map).map(([seccion, list]) => ({ personal: seccion, ...resumenItems(list) }));
});

/** ¿Empieza una sección nueva en esta fila de la tabla? (para dibujar la fila de título como en el Word) */
export const inicioSeccion = (lista, idx) => {
  const s = String(lista[idx].seccion || '').trim();
  return Boolean(s) && (idx === 0 || String(lista[idx - 1].seccion || '').trim() !== s);
};

/** Evolución de cumplimiento por minuta (últimas 20). */
export const evolucionMinutas = computed(() => dbMinutas.value.slice(-20).map(m => ({ minuta: m, ...resumenItems(itemsDeMinuta(m.id)) })));

/** Tareas realizadas recientemente (de la minuta seleccionada), más reciente primero. */
export const realizadasRecientes = computed(() => itemsSel.value.filter(i => i.estado === 'Realizado' && i.fecha_realizado)
  .sort((a, b) => b.fecha_realizado.localeCompare(a.fecha_realizado)).slice(0, 10));

// ---------- Crear minuta (copia la última) ----------
export const showModalMinuta = ref(false);
export const formMinuta = ref({ nombre: '', fecha: '', copiar: true, incluirCerradas: true });
const nombreSugerido = (fecha) => `MINUTA SEMANA ${formatDateForDisplay(fecha)}`;
export const abrirModalNuevaMinuta = () => {
  if (!soloEditor()) return;
  const f = hoyISO();
  formMinuta.value = { nombre: nombreSugerido(f), fecha: f, copiar: Boolean(ultimaMinuta.value), incluirCerradas: true };
  showModalMinuta.value = true;
};
export const actualizarNombreSugerido = () => {
  const n = formMinuta.value.nombre;
  if (!n || /^MINUTA SEMANA \d{2}-\d{2}-\d{4}$/.test(n)) formMinuta.value.nombre = nombreSugerido(formMinuta.value.fecha);
};
export const itemsACopiar = computed(() => {
  if (!ultimaMinuta.value || !formMinuta.value.copiar) return [];
  return itemsDeMinuta(ultimaMinuta.value.id).filter(it => formMinuta.value.incluirCerradas || it.estado === 'Pendiente' || it.estado === 'Proceso');
});

export const guardandoMinuta = ref(false);
export const guardarNuevaMinuta = async () => {
  if (!soloEditor()) return;
  const nombre = String(formMinuta.value.nombre || '').trim().toUpperCase();
  const fecha = formMinuta.value.fecha;
  if (!nombre || !fecha) return alert('Indica nombre y fecha de la minuta.');
  guardandoMinuta.value = true;
  try {
    const origen = formMinuta.value.copiar ? ultimaMinuta.value : null;
    const [nueva] = await sb(supabaseClient.from(TABLA_MINUTAS)
      .insert([{ nombre, fecha, origen_id: origen ? origen.id : null, creado_por: usuarioActivo.value?.nombre || '' }]).select());
    const copiar = itemsACopiar.value.map(({ n_item, personal, fecha_compromiso, fecha_estimada, tarea, estado, fecha_realizado, seccion, area, fecha_texto }) => ({
      minuta_id: nueva.id, n_item: n_item === '' ? null : Number(n_item) || null, personal, tarea, estado,
      seccion: seccion || null, area: area || null, fecha_texto: fecha_texto || null,
      fecha_compromiso: fecha_compromiso || null, fecha_estimada: fecha_estimada || null, fecha_realizado: fecha_realizado || null
    }));
    if (copiar.length) {
      const filas = await sb(supabaseClient.from(TABLA_MINUTAS_ITEMS).insert(copiar).select());
      dbMinutasItems.value.push(...filas.map(mapItem));
    }
    dbMinutas.value = [...dbMinutas.value, mapMinuta(nueva)].sort(cmpMinuta);
    seleccionarMinuta(dbMinutas.value.find(m => m.id === nueva.id));
    vistaMinuta.value = 'tabla';
    showModalMinuta.value = false;
  } catch (err) { avisoError(err); }
  finally { guardandoMinuta.value = false; }
};

export const renombrarMinuta = async (m) => {
  if (!soloAdmin()) return;
  const nombre = String(prompt('Nombre de la minuta:', m.nombre) || '').trim().toUpperCase();
  if (!nombre) return;
  const fecha = normalizarFecha(prompt('Fecha de la minuta (DD-MM-AAAA):', formatDateForDisplay(m.fecha)) || '');
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return alert('Fecha no válida.');
  try {
    await sb(supabaseClient.from(TABLA_MINUTAS).update({ nombre, fecha }).eq('id', m.id));
    m.nombre = nombre; m.fecha = fecha;
    dbMinutas.value = [...dbMinutas.value].sort(cmpMinuta);
  } catch (err) { avisoError(err); }
};

export const eliminarMinuta = async (m) => {
  if (!soloAdmin()) return;
  const n = itemsDeMinuta(m.id).length;
  if (!confirm(`¿Eliminar la minuta "${m.nombre}" y sus ${n} tarea(s)?\nLas demás minutas no se modifican.`)) return;
  try {
    await sb(supabaseClient.from(TABLA_MINUTAS_ITEMS).delete().eq('minuta_id', m.id));
    await sb(supabaseClient.from(TABLA_MINUTAS).delete().eq('id', m.id));
    dbMinutasItems.value = dbMinutasItems.value.filter(i => i.minuta_id !== m.id);
    dbMinutas.value = dbMinutas.value.filter(x => x.id !== m.id);
    if (minutaSelId.value === m.id) seleccionarMinuta(ultimaMinuta.value);
  } catch (err) { avisoError(err); }
};

// ---------- Tareas ----------
const payloadItem = (it) => ({
  n_item: it.n_item === '' || it.n_item === null ? null : (parseInt(it.n_item) || null),
  personal: String(it.personal || '').trim().toUpperCase(),
  fecha_compromiso: it.fecha_compromiso || null,
  fecha_estimada: it.fecha_estimada || null,
  tarea: String(it.tarea || '').trim(),
  estado: normalizarEstado(it.estado),
  fecha_realizado: it.estado === 'Realizado' ? (it.fecha_realizado || hoyISO()) : null,
  seccion: String(it.seccion || '').trim() || null,
  area: String(it.area || '').trim().toUpperCase() || null,
  fecha_texto: String(it.fecha_texto || '').trim() || null
});

export const agregarTarea = async () => {
  if (!minutaSel.value) return alert('Selecciona una minuta.');
  if (!soloEditor()) return;
  if (!puedeEditarMinuta.value) return alert('Las minutas anteriores son histórico: solo el Admin las modifica. Agrega la tarea en la última minuta.');
  const sig = Math.max(0, ...itemsSel.value.map(i => Number(i.n_item) || 0)) + 1;
  const ultimaT = itemsSel.value[itemsSel.value.length - 1];
  const nuevo = { minuta_id: minutaSel.value.id, n_item: sig, seccion: ultimaT ? ultimaT.seccion || null : null, area: null, personal: '', fecha_compromiso: minutaSel.value.fecha || hoyISO(), fecha_estimada: null, tarea: '', estado: 'Pendiente', fecha_realizado: null };
  try {
    const [fila] = await sb(supabaseClient.from(TABLA_MINUTAS_ITEMS).insert([nuevo]).select());
    dbMinutasItems.value.push(mapItem(fila));
    filtroEstadoMinuta.value = ''; busquedaMinuta.value = '';
  } catch (err) { avisoError(err); }
};

/** Guarda una tarea editada en la tabla (se llama al cambiar un campo). */
export const guardarTarea = async (it) => {
  if (!puedeEditarMinuta.value) return;
  if (it.estado === 'Realizado' && !it.fecha_realizado) it.fecha_realizado = hoyISO();
  if (it.estado !== 'Realizado') it.fecha_realizado = '';
  it.personal = String(it.personal || '').trim().toUpperCase();
  it._guardando = true;
  try {
    await sb(supabaseClient.from(TABLA_MINUTAS_ITEMS).update(payloadItem(it)).eq('id', it.id));
    it._ok = true; setTimeout(() => { it._ok = false; }, 1200);
  } catch (err) { avisoError(err); }
  finally { it._guardando = false; }
};

export const eliminarTarea = async (it) => {
  if (!puedeEditarMinuta.value || !soloAdmin()) return;
  if (!confirm(`¿Eliminar la tarea N° ${it.n_item} de esta minuta?\n(No se borra de las minutas anteriores)`)) return;
  try {
    await sb(supabaseClient.from(TABLA_MINUTAS_ITEMS).delete().eq('id', it.id));
    dbMinutasItems.value = dbMinutasItems.value.filter(x => x.id !== it.id);
  } catch (err) { avisoError(err); }
};

/** Historial de una tarea en todas las minutas (mismo N° y mismo texto de tarea). */
export const tareaHistorial = ref(null);
export const verHistorialTarea = (it) => {
  const clave = String(it.tarea || '').trim().toLowerCase();
  const filas = dbMinutas.value.map(m => {
    const x = dbMinutasItems.value.find(i => i.minuta_id === m.id && String(i.tarea || '').trim().toLowerCase() === clave && String(i.n_item) === String(it.n_item));
    return x ? { minuta: m, item: x } : null;
  }).filter(Boolean);
  tareaHistorial.value = { tarea: it.tarea, n_item: it.n_item, filas };
};

// ---------- Exportar / Importar ----------
const COLS = ['N° Item', 'Sección', 'Área', 'Personal Encargado', 'Fecha Compromiso', 'Fecha Estimada', 'Tareas', 'Estado', 'Fecha Realizado'];
const filaExcel = (it) => ({
  'N° Item': it.n_item === '' ? '' : Number(it.n_item),
  'Sección': it.seccion || '', 'Área': it.area || '',
  'Personal Encargado': it.personal,
  'Fecha Compromiso': formatDateForDisplay(it.fecha_compromiso).replace(/^-$/, ''),
  'Fecha Estimada': formatDateForDisplay(it.fecha_estimada).replace(/^-$/, ''),
  'Tareas': it.tarea,
  'Estado': it.estado,
  'Fecha Realizado': formatDateForDisplay(it.fecha_realizado).replace(/^-$/, '')
});
const anchos = (ws, extra = []) => { ws['!cols'] = [...extra, { wch: 8 }, { wch: 16 }, { wch: 12 }, { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 60 }, { wch: 14 }, { wch: 16 }]; };
const nombreArchivo = (s) => String(s).replace(/[\\/:*?"<>|]/g, '-');

// Exportaciones con formato (logo, resumen, dashboard): ver minutas.export.js

export const descargarPlantillaMinuta = () => {
  const ws = XLSX.utils.json_to_sheet([{ 'N° Item': 1, 'Sección': 'Seguridad', 'Área': 'SSO', 'Personal Encargado': 'JUAN PEREZ', 'Fecha Compromiso': formatDateForDisplay(hoyISO()), 'Fecha Estimada': '', 'Tareas': 'Descripción de la tarea', 'Estado': 'Pendiente', 'Fecha Realizado': '' }], { header: COLS });
  anchos(ws);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Minuta');
  XLSX.writeFile(wb, 'PLANTILLA_MINUTA.xlsx');
};

// =====================================================================
// IMPORTAR (Excel o Word .docx) — una o varias minutas a la vez
// ---------------------------------------------------------------------
// 1) Se leen los archivos y se buscan las tablas que tengan una columna de tareas.
// 2) Se detecta la fecha de la minuta (texto "Fecha: ..." del documento, primera fecha
//    del encabezado o nombre del archivo). Se puede cambiar antes de guardar.
// 3) Cada archivo se guarda como minuta nueva (o se agrega / reemplaza en la seleccionada).
//    La minuta con la FECHA MÁS RECIENTE es siempre la ACTUAL.
// =====================================================================
const MAMMOTH_URL = 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';
const normK = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const MESES_TXT = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
const pad = (n) => String(n).padStart(2, '0');
const isoValida = (y, m, d) => {
  if (y < 100) y += 2000;
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100)) return null;
  const dt = new Date(y, m - 1, d);
  return dt.getMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null;
};

/** Lee una fecha escrita de cualquier forma: 03-11-2026, 3/11/26, 2026-11-03, 3 de noviembre de 2026, nov 3 2026, serial Excel. */
export const parseFechaTexto = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return normalizarFecha(v);
  const s = String(v).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!s || s === '-') return null;
  let m;
  if ((m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return isoValida(+m[1], +m[2], +m[3]);
  if ((m = s.match(/(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{2,4})/))) return isoValida(+m[3], +m[2], +m[1]);
  if ((m = s.match(/(\d{1,2})\s*(?:de\s+)?([a-z]{3,})\.?\s*(?:de(?:l)?\s+|,\s*|\s+|-|\/)?(\d{2,4})/)) && MESES_TXT[m[2].slice(0, 3)]) return isoValida(+m[3], MESES_TXT[m[2].slice(0, 3)], +m[1]);
  if ((m = s.match(/([a-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/)) && MESES_TXT[m[1].slice(0, 3)]) return isoValida(+m[3], MESES_TXT[m[1].slice(0, 3)], +m[2]);
  if (/^\d{5}(\.\d+)?$/.test(s)) return normalizarFecha(Number(s));
  return null;
};

/** ¿Qué dato es cada columna? (según el texto del encabezado) */
const clasificarColumna = (h) => {
  const k = normK(h);
  if (!k) return null;
  if (k.includes('fecha') || k.includes('plazo')) {
    if (/realiz|cumplid|cierre|ejecuc|termino real/.test(k)) return 'fecha_realizado';
    if (/estimad|plazo|limite|entrega|termino|compromet|programad/.test(k)) return 'fecha_estimada';
    if (/compromiso|inicio|ingreso|acuerdo|solicitud|asignac|creacion/.test(k)) return 'fecha_compromiso';
    return 'fecha_estimada';
  }
  if (/^(n|no|nro|num|numero|item|nitem|noitem|nroitem|numeroitem|id)$/.test(k)) return 'n_item';
  if (/^(area|areas|depto|departamento|gerencia|unidad)$/.test(k)) return 'area';
  if (/^(seccion|categoria|grupo)$/.test(k)) return 'seccion';
  if (/encargad|responsab|personal|quien|asignad|lider/.test(k)) return 'personal';
  if (/estado|status|situacion|avance|cumple|cumplio|^ok$/.test(k)) return 'estado';
  if (/tarea|actividad|compromiso|descripcion|accion|tema|acuerdo|detalle/.test(k)) return 'tarea';
  if (/observ|comentario/.test(k)) return 'observacion';
  return null;
};

/** Convierte una tabla (matriz de textos) en tareas.
 *  · Busca la fila de encabezados (la que tiene la columna de tareas).
 *  · Una columna sin título con valores "1.", "2."… se toma como N° Item.
 *  · Una fila con un solo texto (ej. "Seguridad") es un título de SECCIÓN para las tareas que siguen.
 *  · Si una fecha no es fecha (ej. "Siempre") se guarda como texto en fecha_texto. */
const tareasDeMatriz = (matriz) => {
  const salida = [];
  let mapa = null, seccion = '';
  for (const fila of matriz) {
    const celdas = fila.map(c => (c instanceof Date ? c : String(c ?? '').trim()));
    const tipos = celdas.map(c => (c instanceof Date || String(c).length > 45 ? null : clasificarColumna(c)));
    const mismaCabecera = mapa && tipos.join('|') === mapa.join('|');
    const pareceCabecera = !mapa && tipos.includes('tarea') && (tipos.filter(Boolean).length >= 2 || celdas.filter(c => String(c) !== '').length === 1)
      && !celdas.some(c => parseFechaTexto(c));
    if (mismaCabecera || pareceCabecera) { mapa = tipos; continue; }   // encabezado (o repetido en otra página)
    if (!mapa) continue;
    // Fila de sección: un solo texto en toda la fila
    const llenas = [...new Set(celdas.filter(c => String(c) !== ''))];
    if (llenas.length === 1 && String(llenas[0]).length <= 60 && !/^\d+\.?$/.test(llenas[0])) {
      const iTarea = mapa.indexOf('tarea');
      const soloEnTarea = celdas.filter(c => c !== '').length === 1 && celdas[iTarea] === llenas[0];
      if (!soloEnTarea || celdas.length <= 2) { seccion = String(llenas[0]).replace(/\s+/g, ' '); continue; }
    }
    const v = {};
    mapa.forEach((t, i) => { if (t && v[t] === undefined && celdas[i] !== '' && celdas[i] !== undefined) v[t] = celdas[i]; });
    if (v.n_item === undefined) {   // columna N° sin título
      const i = mapa.findIndex((t, j) => !t && /^\d{1,3}\s*[.)-]?$/.test(String(celdas[j] || '')));
      if (i >= 0) v.n_item = celdas[i];
    }
    if (!String(v.tarea || '').trim()) continue;
    const tarea = String(v.tarea).trim() + (v.observacion ? `\n(Obs: ${String(v.observacion).trim()})` : '');
    const fr = parseFechaTexto(v.fecha_realizado);
    const estado = v.estado !== undefined ? normalizarEstado(v.estado) : (fr ? 'Realizado' : 'Pendiente');
    const fc = parseFechaTexto(v.fecha_compromiso), fe = parseFechaTexto(v.fecha_estimada);
    const textoNoFecha = [v.fecha_compromiso && !fc ? v.fecha_compromiso : '', v.fecha_estimada && !fe ? v.fecha_estimada : ''].filter(Boolean).join(' / ');
    salida.push({
      n_item: parseInt(String(v.n_item || '').replace(/[^\d]/g, '')) || null,
      seccion: String(v.seccion || seccion || '').trim(),
      area: String(v.area || '').replace(/\s*\n\s*/g, ' / ').trim().toUpperCase(),
      personal: String(v.personal || '').replace(/\s*\n\s*/g, ' / ').trim().toUpperCase(),
      fecha_compromiso: fc, fecha_estimada: fe, fecha_texto: String(textoNoFecha).replace(/\s+/g, ' ').trim(),
      tarea, estado,
      fecha_realizado: estado === 'Realizado' ? fr : null
    });
  }
  return salida;
};

/** Busca la fecha de la minuta en un texto ("Fecha: 03-11-2026", "Reunión del 3 de noviembre de 2026", ...). */
const fechaEnTexto = (texto, soloConEtiqueta = false) => {
  const t = String(texto || '');
  // 1° una fecha justo después de "Fecha", "Reunión", "Semana"… (puede estar en la línea siguiente, ej. celda FECHA | 03-11-2026)
  for (const m of t.matchAll(/(fecha|reuni[oó]n|semana|d[ií]a)[^\d\n]{0,25}\n?\s*([^\n]{4,40})/gi)) {
    const f = parseFechaTexto(m[2]); if (f) return f;
  }
  if (soloConEtiqueta) return null;
  // 2° la primera fecha que aparezca al comienzo del documento
  for (const linea of t.split(/\n+/).slice(0, 60)) { const f = parseFechaTexto(linea); if (f) return f; }
  return null;
};

let cargaMammoth = null;
const cargarMammoth = () => {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  if (!cargaMammoth) cargaMammoth = new Promise((ok, mal) => {
    const s = document.createElement('script');
    s.src = MAMMOTH_URL; s.onload = () => ok(window.mammoth);
    s.onerror = () => { cargaMammoth = null; mal(new Error('No se pudo cargar el lector de Word (revisa la conexión a internet).')); };
    document.head.appendChild(s);
  });
  return cargaMammoth;
};
const leerBuffer = (file) => new Promise((ok, mal) => {
  const r = new FileReader();
  r.onload = (e) => ok(e.target.result); r.onerror = () => mal(new Error('No se pudo leer el archivo.'));
  r.readAsArrayBuffer(file);
});

/** Texto de las primeras tablas (celdas separadas por salto de línea), para buscar "Fecha | 03-11-2026". */
const textoTablasEncabezado = (doc) => [...doc.querySelectorAll('table')].slice(0, 3)
  .map(t => [...t.querySelectorAll('td, th')].map(c => c.textContent.trim()).join('\n')).join('\n');

/** Texto del encabezado de página del .docx (word/header*.xml). Usa JSZip. */
const JSZIP_URL = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
let cargaJSZip = null;
const textoEncabezadoWord = async (buffer) => {
  try {
    if (!window.JSZip) {
      cargaJSZip = cargaJSZip || new Promise((ok, mal) => { const s = document.createElement('script'); s.src = JSZIP_URL; s.onload = ok; s.onerror = mal; document.head.appendChild(s); });
      await cargaJSZip;
    }
    const zip = await window.JSZip.loadAsync(buffer);
    const nombres = Object.keys(zip.files).filter(n => /^word\/header\d*\.xml$/.test(n)).sort();
    let texto = '';
    for (const n of nombres) {
      const xml = new DOMParser().parseFromString(await zip.file(n).async('string'), 'application/xml');
      // cada celda / párrafo en su propia línea
      [...xml.getElementsByTagName('w:p')].forEach(p => { texto += [...p.getElementsByTagName('w:t')].map(t => t.textContent).join('') + '\n'; });
    }
    return texto;
  } catch (e) { console.warn('[Minutas] No se pudo leer el encabezado del Word', e); return ''; }
};

/** Word (.docx): todas las tablas → tareas; el texto fuera de las tablas sirve para encontrar la fecha. */
const leerWord = async (file) => {
  const mammoth = await cargarMammoth();
  const buffer = await leerBuffer(file);
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer });
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Texto de la celda respetando párrafos y viñetas ("- Resguardos…")
  const textoCelda = (td) => {
    td.querySelectorAll('br').forEach(br => br.replaceWith('\n'));   // saltos de línea dentro de la celda (ej. 2 responsables)
    const partes = [...td.querySelectorAll('p, li')].filter(e => !(e.tagName === 'P' && e.closest('li')))
      .flatMap(e => e.textContent.split('\n').map((l, k) => (e.tagName === 'LI' && k === 0 ? '- ' : '') + l.trim()))
      .filter(t => t && t !== '-');
    return partes.length ? partes.join('\n') : td.textContent.trim();
  };
  const tablas = [...doc.querySelectorAll('table')].filter(t => !t.parentElement.closest('table'));
  let tareas = [];
  tablas.forEach(t => {
    const filas = [...t.querySelectorAll(':scope > tbody > tr, :scope > thead > tr, :scope > tr')];
    const matriz = filas.map(tr => {
      const out = [];
      [...tr.children].forEach(td => { const txt = textoCelda(td); const span = Number(td.getAttribute('colspan')) || 1; out.push(txt); for (let i = 1; i < span; i++) out.push(''); });
      return out;
    });
    tareas = tareas.concat(tareasDeMatriz(matriz));
  });
  // Texto fuera de tablas (encabezado del documento) para detectar la fecha
  tablas.forEach(t => t.remove());
  const textoLibre = [...doc.body.querySelectorAll('p, h1, h2, h3, h4, li')].map(e => e.textContent.trim()).filter(Boolean).join('\n');
  let fecha = fechaEnTexto(textoLibre);
  // Si no está fuera de las tablas, puede estar en una tabla de encabezado ("Fecha | 03-11-2026")
  // El encabezado de página del Word (logo / FECHA / PÁGINA) no viene en el cuerpo: se lee aparte
  if (!fecha) fecha = fechaEnTexto(await textoEncabezadoWord(buffer));
  // Tablas de encabezado del cuerpo ("Fecha | 03-11-2026"); solo si dice "Fecha", para no tomar fechas de las tareas
  if (!fecha) fecha = fechaEnTexto(textoTablasEncabezado(new DOMParser().parseFromString(html, 'text/html')), true);
  const titulo = (textoLibre.split('\n').find(l => /minuta|acta|reuni/i.test(l)) || '').slice(0, 80);
  return { tareas, fecha, titulo, sinTabla: !tablas.length };
};

/** Excel / CSV: hoja "Minuta" (o la primera); también lee los Excel exportados por el sistema. */
const leerExcel = async (file) => {
  const wb = XLSX.read(new Uint8Array(await leerBuffer(file)), { type: 'array', cellDates: true });
  const hoja = wb.Sheets[wb.SheetNames.find(n => /minuta/i.test(n)) || wb.SheetNames[0]];
  const matriz = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '', raw: false, dateNF: 'dd-mm-yyyy' });
  const iCab = matriz.findIndex(f => f.some(c => clasificarColumna(c) === 'tarea'));
  const textoArriba = matriz.slice(0, Math.max(iCab, 0)).map(f => f.filter(Boolean).join(' ')).join('\n');
  return { tareas: tareasDeMatriz(matriz), fecha: fechaEnTexto(textoArriba), titulo: '' };
};

// ---------- Estado del asistente de importación ----------
export const showModalImportar = ref(false);
export const importacion = ref({ archivos: [], destino: 'nueva', leyendo: false, guardando: false });

/** Paso 1: el usuario elige uno o varios archivos. */
export const elegirArchivosImportar = async (e) => {
  const files = [...(e.target.files || [])];
  resetInputFile(e);
  if (!files.length || !soloEditor()) return;
  importacion.value = { archivos: [], destino: 'nueva', leyendo: true, guardando: false };
  showModalImportar.value = true;
  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase();
    const reg = { archivo: file.name, tareas: [], fecha: '', origenFecha: '', nombre: '', error: '', verDetalle: false };
    try {
      if (ext === 'doc') throw new Error('Formato .doc antiguo: ábrelo en Word y guárdalo como .docx.');
      const r = ext === 'docx' ? await leerWord(file) : await leerExcel(file);
      reg.tareas = r.tareas;
      const deNombre = parseFechaTexto(file.name.replace(/\.[a-z]+$/i, '').replace(/[_]/g, ' '));
      reg.fecha = r.fecha || deNombre || hoyISO();
      reg.origenFecha = r.fecha ? 'documento' : deNombre ? 'nombre del archivo' : 'no encontrada (se usa hoy, revísala)';
      reg.nombre = nombreSugerido(reg.fecha);
      if (!reg.tareas.length) reg.error = r.sinTabla
        ? 'El documento no tiene tablas. Las tareas deben estar en una tabla con una columna "Tareas".'
        : 'No se encontró una tabla con columna "Tareas" (o "Tarea", "Actividad", "Compromiso", "Descripción").';
    } catch (err) { reg.error = err.message || String(err); }
    importacion.value.archivos.push(reg);
  }
  importacion.value.archivos.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  importacion.value.leyendo = false;
};

export const cambiarFechaImport = (reg) => {
  reg.origenFecha = 'elegida por ti';
  if (!reg.nombre || /^MINUTA SEMANA \d{2}-\d{2}-\d{4}$/.test(reg.nombre)) reg.nombre = nombreSugerido(reg.fecha);
};
export const archivosValidos = computed(() => importacion.value.archivos.filter(a => !a.error && a.tareas.length));
/** Fecha más reciente que quedará como ACTUAL después de importar. */
export const actualTrasImportar = computed(() => {
  const fechas = [...dbMinutas.value.map(m => m.fecha), ...(importacion.value.destino === 'nueva' ? archivosValidos.value.map(a => a.fecha) : [])].filter(Boolean).sort();
  return fechas[fechas.length - 1] || '';
});
export const fechaYaExiste = (f) => dbMinutas.value.some(m => m.fecha === f);

/** Paso 2: guardar. */
export const confirmarImportacion = async () => {
  if (!soloEditor()) return;
  const imp = importacion.value;
  const validos = archivosValidos.value;
  if (!validos.length) return alert('No hay tareas para importar.');
  if (validos.some(a => !/^\d{4}-\d{2}-\d{2}$/.test(a.fecha || ''))) return alert('Revisa las fechas: todas las minutas deben tener fecha.');
  imp.guardando = true;
  try {
    // Realizado sin fecha en el documento (ej. Cumple = 1) → se toma la fecha de la minuta
    const prepararItems = (tareas, minutaId, desde = 0, fechaMinuta = null) => {
      let sig = desde;
      return tareas.map(t => {
        const n = t.n_item || ++sig; sig = Math.max(sig, n);
        return { minuta_id: minutaId, n_item: n, seccion: t.seccion || null, area: t.area || null, fecha_texto: t.fecha_texto || null, personal: t.personal, fecha_compromiso: t.fecha_compromiso || null, fecha_estimada: t.fecha_estimada || null, tarea: t.tarea, estado: t.estado, fecha_realizado: t.estado === 'Realizado' ? (t.fecha_realizado || fechaMinuta || null) : null };
      });
    };
    let ultimaCreada = null;
    if (imp.destino === 'nueva') {
      for (const a of validos) {
        const [nueva] = await sb(supabaseClient.from(TABLA_MINUTAS).insert([{ nombre: String(a.nombre || nombreSugerido(a.fecha)).trim().toUpperCase(), fecha: a.fecha, creado_por: usuarioActivo.value?.nombre || '' }]).select());
        dbMinutas.value = [...dbMinutas.value, mapMinuta(nueva)].sort(cmpMinuta);
        const filas = await sb(supabaseClient.from(TABLA_MINUTAS_ITEMS).insert(prepararItems(a.tareas, nueva.id, 0, a.fecha)).select());
        dbMinutasItems.value.push(...filas.map(mapItem));
        ultimaCreada = nueva.id;
      }
    } else {
      if (!minutaSel.value || !puedeEditarMinuta.value) throw new Error('No puedes modificar la minuta seleccionada.');
      const id = minutaSel.value.id;
      const tareas = validos.flatMap(a => a.tareas);
      if (imp.destino === 'reemplazar') {
        await sb(supabaseClient.from(TABLA_MINUTAS_ITEMS).delete().eq('minuta_id', id));
        dbMinutasItems.value = dbMinutasItems.value.filter(i => i.minuta_id !== id);
      }
      const desde = imp.destino === 'agregar' ? Math.max(0, ...itemsSel.value.map(i => Number(i.n_item) || 0)) : 0;
      const filas = await sb(supabaseClient.from(TABLA_MINUTAS_ITEMS).insert(prepararItems(tareas, id, desde, minutaSel.value.fecha)).select());
      dbMinutasItems.value.push(...filas.map(mapItem));
      ultimaCreada = id;
    }
    // Queda seleccionada la minuta ACTUAL (fecha más reciente) si se importaron varias; si fue una, esa.
    const sel = validos.length > 1 ? ultimaMinuta.value : dbMinutas.value.find(m => m.id === ultimaCreada);
    seleccionarMinuta(sel);
    vistaMinuta.value = 'tabla'; filtroEstadoMinuta.value = ''; busquedaMinuta.value = '';
    showModalImportar.value = false;
    const total = validos.reduce((s, a) => s + a.tareas.length, 0);
    const aviso = imp.destino === 'nueva' && sel && ultimaMinuta.value && sel.id !== ultimaMinuta.value.id
      ? `\n\nOjo: la minuta importada es más antigua que "${ultimaMinuta.value.nombre}", así que quedó como histórico. La ACTUAL es siempre la de fecha más reciente.` : '';
    alert(`Importación lista: ${total} tarea(s) en ${imp.destino === 'nueva' ? validos.length + ' minuta(s) nueva(s)' : 'la minuta seleccionada'}.${aviso}`);
  } catch (err) { avisoError(err); }
  finally { imp.guardando = false; }
};

export { formatDateForDisplay, hoyISO };
