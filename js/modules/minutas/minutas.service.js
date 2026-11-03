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
import { hoyISO, normalizarFecha, formatDateForDisplay, getVal, resetInputFile } from '../../core/utils.js';

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
  if (s.includes('no real') || s.includes('no cumpl') || s === 'no') return 'No Realizado';
  if (s.includes('proce') || s.includes('curso')) return 'Proceso';
  if (s.includes('realiz') || s.includes('cumpl') || s.includes('ok') || s.includes('termin')) return 'Realizado';
  return 'Pendiente';
};

const mapMinuta = (r) => ({ id: r.id, nombre: String(r.nombre || ''), fecha: normalizarFecha(r.fecha) || '', origen_id: r.origen_id || null, creado_por: r.creado_por || '', created_at: r.created_at || '' });
const mapItem = (r) => ({
  id: r.id, minuta_id: r.minuta_id, n_item: r.n_item ?? '', personal: r.personal || '',
  fecha_compromiso: normalizarFecha(r.fecha_compromiso) || '', fecha_estimada: normalizarFecha(r.fecha_estimada) || '',
  tarea: r.tarea || '', estado: normalizarEstado(r.estado), fecha_realizado: normalizarFecha(r.fecha_realizado) || ''
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
    return [it.n_item, it.personal, it.tarea].some(v => String(v).toLowerCase().includes(q));
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
    const copiar = itemsACopiar.value.map(({ n_item, personal, fecha_compromiso, fecha_estimada, tarea, estado, fecha_realizado }) => ({
      minuta_id: nueva.id, n_item: n_item === '' ? null : Number(n_item) || null, personal, tarea, estado,
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
  fecha_realizado: it.estado === 'Realizado' ? (it.fecha_realizado || hoyISO()) : null
});

export const agregarTarea = async () => {
  if (!minutaSel.value) return alert('Selecciona una minuta.');
  if (!soloEditor()) return;
  if (!puedeEditarMinuta.value) return alert('Las minutas anteriores son histórico: solo el Admin las modifica. Agrega la tarea en la última minuta.');
  const sig = Math.max(0, ...itemsSel.value.map(i => Number(i.n_item) || 0)) + 1;
  const nuevo = { minuta_id: minutaSel.value.id, n_item: sig, personal: '', fecha_compromiso: minutaSel.value.fecha || hoyISO(), fecha_estimada: null, tarea: '', estado: 'Pendiente', fecha_realizado: null };
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
const COLS = ['N° Item', 'Personal Encargado', 'Fecha Compromiso', 'Fecha Estimada', 'Tareas', 'Estado', 'Fecha Realizado'];
const filaExcel = (it) => ({
  'N° Item': it.n_item === '' ? '' : Number(it.n_item),
  'Personal Encargado': it.personal,
  'Fecha Compromiso': formatDateForDisplay(it.fecha_compromiso).replace(/^-$/, ''),
  'Fecha Estimada': formatDateForDisplay(it.fecha_estimada).replace(/^-$/, ''),
  'Tareas': it.tarea,
  'Estado': it.estado,
  'Fecha Realizado': formatDateForDisplay(it.fecha_realizado).replace(/^-$/, '')
});
const anchos = (ws, extra = []) => { ws['!cols'] = [...extra, { wch: 8 }, { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 60 }, { wch: 14 }, { wch: 16 }]; };
const nombreArchivo = (s) => String(s).replace(/[\\/:*?"<>|]/g, '-');

// Exportaciones con formato (logo, resumen, dashboard): ver minutas.export.js

export const descargarPlantillaMinuta = () => {
  const ws = XLSX.utils.json_to_sheet([{ 'N° Item': 1, 'Personal Encargado': 'JUAN PEREZ', 'Fecha Compromiso': formatDateForDisplay(hoyISO()), 'Fecha Estimada': '', 'Tareas': 'Descripción de la tarea', 'Estado': 'Pendiente', 'Fecha Realizado': '' }], { header: COLS });
  anchos(ws);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Minuta');
  XLSX.writeFile(wb, 'PLANTILLA_MINUTA.xlsx');
};

/** Lee el Excel buscando la fila de encabezados (la que tiene "Tareas"), así también se pueden
 *  importar los archivos exportados por el sistema (que traen logo y resumen arriba de la tabla). */
const normK = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const leerExcelMinuta = (file) => new Promise((ok, mal) => {
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array', cellDates: true });
      const hoja = wb.Sheets[wb.SheetNames.find(n => /minuta/i.test(n)) || wb.SheetNames[0]];
      const matriz = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '', raw: false, dateNF: 'dd-mm-yyyy' });
      const iCab = matriz.findIndex(f => f.some(c => ['tareas', 'tarea'].includes(normK(c))));
      if (iCab < 0) return ok([]);
      const cab = matriz[iCab].map(c => String(c || '').trim());
      ok(matriz.slice(iCab + 1).filter(f => f.some(c => String(c).trim() !== ''))
        .map(f => Object.fromEntries(cab.map((h, i) => [h || `col${i}`, f[i] ?? '']))));
    } catch (e) { mal(new Error('No se pudo leer el archivo Excel.')); }
  };
  reader.onerror = () => mal(new Error('No se pudo leer el archivo.'));
  reader.readAsArrayBuffer(file);
});

/** Importa un Excel a la minuta seleccionada (reemplazar o agregar). */
export const importarMinutaExcel = async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    if (!minutaSel.value) return alert('Primero crea o selecciona la minuta donde se importarán las tareas.');
    if (!puedeEditarMinuta.value) return alert('No tienes permiso para modificar esta minuta.');
    const rows = await leerExcelMinuta(file);
    const nuevos = rows.map(r => {
      const estado = normalizarEstado(getVal(r, 'Estado'));
      const fr = normalizarFecha(getVal(r, 'Fecha Realizado', 'Fecha Realizada', 'Fecha Cumplimiento'));
      return {
        minuta_id: minutaSel.value.id,
        n_item: parseInt(getVal(r, 'N° Item', 'N Item', 'Nº Item', 'Item', 'N°', 'Numero')) || null,
        personal: String(getVal(r, 'Personal Encargado', 'Encargado', 'Responsable', 'Personal')).trim().toUpperCase(),
        fecha_compromiso: normalizarFecha(getVal(r, 'Fecha Compromiso', 'Fecha de Compromiso', 'Fecha Inicio')) || null,
        fecha_estimada: normalizarFecha(getVal(r, 'Fecha Estimada', 'Fecha Estimada de Cumplimiento', 'Plazo', 'Fecha Plazo')) || null,
        tarea: String(getVal(r, 'Tareas', 'Tarea', 'Descripcion', 'Compromiso')).trim(),
        estado,
        fecha_realizado: estado === 'Realizado' ? (fr || hoyISO()) : null
      };
    }).filter(x => x.tarea);
    const malos = (f) => f && !/^\d{4}-\d{2}-\d{2}$/.test(f);
    if (nuevos.some(n => malos(n.fecha_compromiso) || malos(n.fecha_estimada) || malos(n.fecha_realizado))) {
      return alert('Hay fechas que no se reconocen. Usa el formato DD-MM-AAAA (o fecha de Excel).');
    }
    if (!nuevos.length) return alert('No se encontraron tareas. Revisa que el Excel tenga la columna "Tareas".');
    const actuales = itemsSel.value.length;
    let reemplazar = false;
    if (actuales) {
      reemplazar = confirm(`Se leyeron ${nuevos.length} tarea(s).\n\nACEPTAR = REEMPLAZAR las ${actuales} tareas de "${minutaSel.value.nombre}".\nCANCELAR = AGREGARLAS a las existentes.`);
    }
    let sig = reemplazar ? 0 : Math.max(0, ...itemsSel.value.map(i => Number(i.n_item) || 0));
    nuevos.forEach(n => { if (!n.n_item) n.n_item = ++sig; else sig = Math.max(sig, n.n_item); });
    if (reemplazar) {
      await sb(supabaseClient.from(TABLA_MINUTAS_ITEMS).delete().eq('minuta_id', minutaSel.value.id));
      dbMinutasItems.value = dbMinutasItems.value.filter(i => i.minuta_id !== minutaSel.value.id);
    }
    const filas = await sb(supabaseClient.from(TABLA_MINUTAS_ITEMS).insert(nuevos).select());
    dbMinutasItems.value.push(...filas.map(mapItem));
    alert(`Importación lista: ${filas.length} tarea(s) ${reemplazar ? 'reemplazadas' : 'agregadas'}.`);
  } catch (err) { avisoError(err); }
  finally { resetInputFile(e); }
};

/** Importa un Excel creando una MINUTA NUEVA (usa la fecha de hoy). */
export const importarComoNuevaMinuta = async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!soloEditor()) return resetInputFile(e);
  const nombre = String(prompt('Nombre de la nueva minuta:', nombreSugerido(hoyISO())) || '').trim().toUpperCase();
  if (!nombre) return resetInputFile(e);
  try {
    const [nueva] = await sb(supabaseClient.from(TABLA_MINUTAS).insert([{ nombre, fecha: hoyISO(), creado_por: usuarioActivo.value?.nombre || '' }]).select());
    dbMinutas.value = [...dbMinutas.value, mapMinuta(nueva)].sort(cmpMinuta);
    seleccionarMinuta(dbMinutas.value.find(m => m.id === nueva.id));
    await importarMinutaExcel(e);
  } catch (err) { avisoError(err); resetInputFile(e); }
};

export { formatDateForDisplay, hoyISO };
