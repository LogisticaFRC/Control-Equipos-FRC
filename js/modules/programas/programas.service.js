// =====================================================================
// PROGRAMAS · Lógica (programas de Reparación / Mantención, Gantt, asignaciones)
// =====================================================================
import { supabaseClient, sb, errMsg, fetchAllRows } from '../../core/supabase.js';
import { dbProgramasCalendarios, dbProgramasItems, dbIntervenciones, cargarDatosDesdeSupabase, obtenerDetalleEquipoPorAfi, soloAdmin, soloEditor } from '../../core/store.js';
import { normalizarFecha, formatDateForDisplay, parseNum, limpiarAfi, esFechaEnRango, hoyISO, mismoAfi, parseIsoDate, diasEntre } from '../../core/utils.js';
import { buscarEquipoPorAfi } from '../../core/store.js';
import { empresaDe } from '../inventario/inventario.mapper.js';
import { claseMantencion } from '../../core/horometros.js';
import { nuevoLibro, hojaTabla, descargarLibro, fechaExcel, fill, COLOR, bloqueFirmas, FIRMAS_PROGRAMA } from '../../core/excel.js';
import { isAdmin } from '../../core/store.js';
import { hojaInicioReparacion, hojaInicioMantencion } from './programas.dashboard.js';
import { kitsEnBodegaAfi, kitConsumidoItem, consumirKitParaItem, devolverKitDeItem, filtrosRequeridosAfi } from '../bodega/bodega.service.js';

const { ref, computed } = Vue;

import { TABLAS } from '../../core/tablas.js';
export const TABLA_PROGRAMAS = TABLAS.PROGRAMAS;
export const TABLA_PROGRAMAS_ITEMS = TABLAS.PROGRAMAS_ITEMS;
export const NAVES = ['NAVE 1', 'NAVE 2', 'NAVE 3', 'NAVE 4'];

export const carpetaDe = (prog) => String(prog?.tipo || prog?.carpeta || '').toUpperCase();
export const esProgramaMantencion = (prog) => carpetaDe(prog) === 'MANTENCION';

// ---------- Estado de la vista ----------
export const vistaProgramaMode = ref('tabla');
export const openFolders = ref({ REPARACION: true, MANTENCION: true });
const PROG_VACIO = () => ({ id: null, carpeta: '', nombre_programa: '', mes: '', fecha_inicio_programa: '', fecha_termino_programa: '' });
export const progSelect = ref(PROG_VACIO());

export const toggleFolder = (k) => { openFolders.value[k] = !openFolders.value[k]; };

// =====================================================================
// SUBCARPETAS dentro de REPARACIÓN / MANTENCIÓN (ej. "NOVIEMBRE")
//  · tabla bd_programas_carpetas (tipo, nombre) → guarda también las subcarpetas vacías
//  · columna bd_programas_calendarios.subcarpeta → en qué subcarpeta está cada programa (vacío = raíz)
// =====================================================================
export const TABLA_PROGRAMAS_CARPETAS = TABLAS.PROGRAMAS_CARPETAS;
export const dbProgramasCarpetas = ref([]);
export const openSubfolders = ref({});
export const programaMoviendo = ref(null);   // id del programa con el selector "Mover a" abierto
export const programaArrastrado = ref(null); // id del programa que se está arrastrando

const SQL_SUBCARPETAS = `CREATE TABLE IF NOT EXISTS public.bd_programas_carpetas (id bigserial PRIMARY KEY, tipo text NOT NULL, nombre text NOT NULL, created_at timestamptz DEFAULT now(), CONSTRAINT bd_programas_carpetas_unica UNIQUE (tipo, nombre));
ALTER TABLE public.bd_programas_carpetas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bd_programas_carpetas_anon_all ON public.bd_programas_carpetas;
CREATE POLICY bd_programas_carpetas_anon_all ON public.bd_programas_carpetas FOR ALL TO anon USING (true) WITH CHECK (true);
ALTER TABLE public.bd_programas_calendarios ADD COLUMN IF NOT EXISTS subcarpeta text;
NOTIFY pgrst, 'reload schema';`;
const avisoFaltaSql = (err) => {
  const m = errMsg(err);
  if (/bd_programas_carpetas|subcarpeta|schema cache/i.test(m)) {
    alert("Faltan las subcarpetas en Supabase. Ejecuta en el SQL Editor (está en sql/programas_subcarpetas.sql):\n\n" + SQL_SUBCARPETAS);
  } else alert("Error: " + m);
};

export const cargarCarpetasProgramas = async () => {
  const rows = await fetchAllRows(TABLA_PROGRAMAS_CARPETAS);
  dbProgramasCarpetas.value = rows.map(r => ({ id: r.id, tipo: String(r.tipo || '').toUpperCase(), nombre: String(r.nombre || '').toUpperCase() }));
};

const subDe = (prog) => String(prog?.subcarpeta || '').trim().toUpperCase();
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
/** Orden: año (si el nombre lo trae) → mes (si es un mes) → alfabético. */
const claveOrdenSub = (n) => {
  const anio = (n.match(/(20\d{2})/) || [])[1] || '0000';
  const mes = MESES.findIndex(m => n.includes(m));
  return `${anio}-${String(mes < 0 ? 99 : mes).padStart(2, '0')}-${n}`;
};

/** Subcarpetas de un tipo (las creadas + las que usan los programas). */
export const subcarpetasDe = (tipo) => {
  const t = String(tipo).toUpperCase();
  const set = new Set(dbProgramasCarpetas.value.filter(c => c.tipo === t).map(c => c.nombre));
  dbProgramasCalendarios.value.filter(p => carpetaDe(p) === t && subDe(p)).forEach(p => set.add(subDe(p)));
  return Array.from(set).sort((a, b) => claveOrdenSub(a).localeCompare(claveOrdenSub(b)));
};
export const programasDeSubcarpeta = (tipo, sub) => obtenerProgramasDeCarpeta(tipo).filter(p => subDe(p) === String(sub || '').toUpperCase());
export const claveSub = (tipo, sub) => `${tipo}/${sub}`;
export const subAbierta = (tipo, sub) => openSubfolders.value[claveSub(tipo, sub)] !== false;
export const toggleSubfolder = (tipo, sub) => { openSubfolders.value[claveSub(tipo, sub)] = !subAbierta(tipo, sub); };

export const crearSubcarpeta = async (tipo) => {
  if (!soloAdmin()) return;
  const nombre = String(prompt(`Nombre de la nueva subcarpeta en ${tipo} (ej: NOVIEMBRE 2026):`) || '').trim().toUpperCase();
  if (!nombre) return;
  if (subcarpetasDe(tipo).includes(nombre)) return alert('Ya existe una subcarpeta con ese nombre.');
  try {
    await sb(supabaseClient.from(TABLA_PROGRAMAS_CARPETAS).insert([{ tipo: String(tipo).toUpperCase(), nombre }]));
    await cargarCarpetasProgramas();
    openFolders.value[tipo] = true;
  } catch (err) { avisoFaltaSql(err); }
};

export const renombrarSubcarpeta = async (tipo, sub) => {
  if (!soloAdmin()) return;
  const nuevo = String(prompt('Nuevo nombre de la subcarpeta:', sub) || '').trim().toUpperCase();
  if (!nuevo || nuevo === sub) return;
  if (subcarpetasDe(tipo).includes(nuevo)) return alert('Ya existe una subcarpeta con ese nombre.');
  try {
    const fila = dbProgramasCarpetas.value.find(c => c.tipo === tipo && c.nombre === sub);
    if (fila) await sb(supabaseClient.from(TABLA_PROGRAMAS_CARPETAS).update({ nombre: nuevo }).eq('id', fila.id));
    else await sb(supabaseClient.from(TABLA_PROGRAMAS_CARPETAS).insert([{ tipo, nombre: nuevo }]));
    const progs = programasDeSubcarpeta(tipo, sub);
    for (const p of progs) await sb(supabaseClient.from(TABLA_PROGRAMAS).update({ subcarpeta: nuevo }).eq('id', p.id));
    progs.forEach(p => { p.subcarpeta = nuevo; });
    await cargarCarpetasProgramas();
  } catch (err) { avisoFaltaSql(err); }
};

export const eliminarSubcarpeta = async (tipo, sub) => {
  if (!soloAdmin()) return;
  const progs = programasDeSubcarpeta(tipo, sub);
  if (!confirm(`¿Eliminar la subcarpeta "${sub}"?${progs.length ? `\nSus ${progs.length} programa(s) NO se borran: pasan a la carpeta ${tipo}.` : ''}`)) return;
  try {
    for (const p of progs) await sb(supabaseClient.from(TABLA_PROGRAMAS).update({ subcarpeta: null }).eq('id', p.id));
    progs.forEach(p => { p.subcarpeta = null; });
    await sb(supabaseClient.from(TABLA_PROGRAMAS_CARPETAS).delete().eq('tipo', tipo).eq('nombre', sub));
    await cargarCarpetasProgramas();
  } catch (err) { avisoFaltaSql(err); }
};

/** Mueve un programa a una subcarpeta ('' = carpeta principal). */
export const moverProgramaASubcarpeta = async (prog, sub) => {
  if (!soloAdmin()) return;
  const destino = String(sub || '').trim().toUpperCase() || null;
  programaMoviendo.value = null;
  if ((subDe(prog) || null) === destino) return;
  const anterior = prog.subcarpeta;
  prog.subcarpeta = destino;
  try {
    await sb(supabaseClient.from(TABLA_PROGRAMAS).update({ subcarpeta: destino }).eq('id', prog.id));
    if (destino) openSubfolders.value[claveSub(carpetaDe(prog), destino)] = true;
  } catch (err) { prog.subcarpeta = anterior; avisoFaltaSql(err); }
};

// Arrastrar y soltar (solo Admin, dentro del mismo tipo)
export const iniciarArrastre = (prog, e) => {
  if (!isAdmin.value) return;
  programaArrastrado.value = prog.id;
  try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(prog.id)); } catch (_) {}
};
export const terminarArrastre = () => { programaArrastrado.value = null; };
export const soltarEnSubcarpeta = (tipo, sub) => {
  const prog = obtenerProgObj(programaArrastrado.value);
  programaArrastrado.value = null;
  if (!prog || carpetaDe(prog) !== String(tipo).toUpperCase()) return;
  moverProgramaASubcarpeta(prog, sub);
};

export const seleccionarProgramaObj = (prog) => {
  progSelect.value = {
    id: prog.id,
    carpeta: prog.tipo || prog.carpeta || 'REPARACION',
    nombre_programa: prog.nombre_programa || prog.mes,
    fecha_inicio_programa: prog.fecha_inicio_programa,
    fecha_termino_programa: prog.fecha_termino_programa
  };
};

// ---------- Consultas ----------
const ordenarPorFecha = (a, b) => new Date(a.fecha_programada || a.fecha_inicio || 0).getTime() - new Date(b.fecha_programada || b.fecha_inicio || 0).getTime();

export const obtenerProgObj = (programaId) => dbProgramasCalendarios.value.find(p => String(p.id) === String(programaId));

export const obtenerProgramasDeCarpeta = (carpeta) => dbProgramasCalendarios.value
  .filter(p => carpetaDe(p) === String(carpeta).toUpperCase())
  .sort((a, b) => (a.nombre_programa || a.mes || '').localeCompare(b.nombre_programa || b.mes || ''));

export const obtenerItemsPrograma = (programaId) => dbProgramasItems.value
  .filter(i => String(i.programa_id) === String(programaId))
  .sort(ordenarPorFecha);

export const obtenerItemsProgramaPorNave = (programaId, nave) => dbProgramasItems.value
  .filter(i => String(i.programa_id) === String(programaId) && String(i.nave || 'NAVE 1').toUpperCase() === String(nave).toUpperCase())
  .sort(ordenarPorFecha);

const itemFueraDeRango = (item, prog) => {
  const pIni = normalizarFecha(prog.fecha_inicio_programa), pFin = normalizarFecha(prog.fecha_termino_programa);
  const iIni = normalizarFecha(item.fecha_inicio || item.fecha_programada);
  const iFin = normalizarFecha(item.fecha_fin || item.fecha_inicio || item.fecha_programada);
  return iFin < pIni || iIni > pFin;
};

export const obtenerItemsProgramaEnRangoPorNave = (programaId, nave) => {
  const prog = obtenerProgObj(programaId);
  const items = obtenerItemsProgramaPorNave(programaId, nave);
  return prog ? items.filter(it => !itemFueraDeRango(it, prog)) : items;
};

export const obtenerItemsFueraDeRangoPrograma = (programaId) => {
  const prog = obtenerProgObj(programaId);
  return prog ? obtenerItemsPrograma(programaId).filter(it => itemFueraDeRango(it, prog)) : [];
};

export const getProgreso = (programaId) => {
  const items = obtenerItemsPrograma(programaId);
  if (items.length === 0) return { total: 0, done: 0, pct: 0 };
  const done = items.filter(i => i.realizado).length;
  return { total: items.length, done, pct: Math.round((done / items.length) * 100) };
};

export const cumplimientoGlobalTotal = computed(() => {
  const total = dbProgramasItems.value.length;
  if (total === 0) return 0;
  return Math.round((dbProgramasItems.value.filter(i => i.realizado).length / total) * 100);
});

export const generarDiasDelPrograma = (prog) => {
  if (!prog || !prog.fecha_inicio_programa || !prog.fecha_termino_programa) return [];
  const diasArr = [];
  const curr = new Date(normalizarFecha(prog.fecha_inicio_programa) + 'T00:00:00');
  const fin = new Date(normalizarFecha(prog.fecha_termino_programa) + 'T00:00:00');
  if (isNaN(curr) || isNaN(fin)) return [];
  const letras = ['d', 'l', 'm', 'mi', 'j', 'v', 's'];
  while (curr <= fin) {
    const fechaStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
    diasArr.push({ fechaStr, numDia: curr.getDate(), letraDia: letras[curr.getDay()] });
    curr.setDate(curr.getDate() + 1);
  }
  return diasArr;
};

export const esFechaEnRangoEquipo = esFechaEnRango;

/** Gantt de MANTENCIÓN: qué mostrar en cada día para un equipo.
 *  'prog' = día programado pendiente · 'atrasado' = programado, ya pasó y sigue pendiente
 *  'hecho' = realizado ese día · 'reprog' = estaba programado ese día pero se realizó otro día */
export const celdaGanttMant = (item, fechaStr) => {
  const prog = normalizarFecha(item.fecha_programada || item.fecha_inicio);
  const real = normalizarFecha(item.fecha_fin);
  if (item.realizado) {
    if (real && fechaStr === real) return 'hecho';
    if (fechaStr === prog) return real && real !== prog ? 'reprog' : 'hecho';
    return '';
  }
  if (fechaStr === prog) return prog < hoyISO() ? 'atrasado' : 'prog';
  return '';
};
export const hoyStr = () => hoyISO();
/** Equipos del programa de mantención cuya fecha programada queda fuera de la vigencia (no se ven en el Gantt). */
export const itemsMantFueraDeGantt = (programaId) => {
  const prog = obtenerProgObj(programaId);
  if (!prog) return [];
  const ini = normalizarFecha(prog.fecha_inicio_programa), fin = normalizarFecha(prog.fecha_termino_programa);
  return obtenerItemsPrograma(programaId).filter(i => { const f = normalizarFecha(i.fecha_programada || i.fecha_inicio); return !f || f < ini || f > fin; });
};

// ---------- Switch "Descontar kits de bodega" (por programa de mantención) ----------
/** ON por defecto. Se apaga para rellenar programas antiguos sin mover la bodega. */
export const descuentaBodega = (programaId) => obtenerProgObj(programaId)?.descontar_bodega !== false;

export const cambiarDescuentoBodega = async (programaId, valor) => {
  if (!soloEditor()) return;
  const prog = obtenerProgObj(programaId);
  if (!prog) return;
  const anterior = prog.descontar_bodega;
  prog.descontar_bodega = valor;   // se ve el cambio de inmediato
  try {
    await sb(supabaseClient.from(TABLA_PROGRAMAS).update({ descontar_bodega: valor }).eq('id', programaId));
  } catch (err) {
    prog.descontar_bodega = anterior;
    if (/descontar_bodega/i.test(errMsg(err))) {
      alert("Falta la columna 'descontar_bodega' en Supabase. Ejecuta en el SQL Editor:\n\nALTER TABLE public.bd_programas_calendarios ADD COLUMN IF NOT EXISTS descontar_bodega boolean DEFAULT true;\nNOTIFY pgrst, 'reload schema';");
    } else {
      alert("No se pudo cambiar el descuento de bodega: " + errMsg(err));
    }
  }
};

// ---------- Crear / eliminar programa ----------
export const showModalPrograma = ref(false);
export const formProgMes = ref({ carpeta: 'REPARACION', subcarpeta: '', nombre_programa: '', fecha_inicio_programa: '', fecha_termino_programa: '' });

export const abrirModalCrearPrograma = (tipoCarpeta) => {
  const actual = obtenerProgObj(progSelect.value.id);
  const subActual = actual && carpetaDe(actual) === tipoCarpeta ? subDe(actual) : '';
  formProgMes.value = { carpeta: tipoCarpeta, subcarpeta: subActual, nombre_programa: '', fecha_inicio_programa: '2026-08-01', fecha_termino_programa: '2026-09-30' };
  showModalPrograma.value = true;
};

export const guardarNuevoProgramaMes = async () => {
  if (!soloAdmin()) return;
  const { carpeta: cp, fecha_inicio_programa: f_ini, fecha_termino_programa: f_fin } = formProgMes.value;
  const nom = formProgMes.value.nombre_programa.trim().toUpperCase();
  if (!nom || !f_ini || !f_fin) return;
  if (f_fin < f_ini) return alert("La fecha de término no puede ser anterior a la de inicio.");
  const payload = { tipo: cp, carpeta: cp, nombre_programa: nom, mes: nom, fecha_inicio_programa: f_ini, fecha_termino_programa: f_fin };
  const sub = String(formProgMes.value.subcarpeta || '').trim().toUpperCase();
  if (sub) payload.subcarpeta = sub;
  try {
    const data = await sb(supabaseClient.from(TABLA_PROGRAMAS).insert([payload]).select());
    await cargarDatosDesdeSupabase(['programas']);
    showModalPrograma.value = false;
    if (data && data[0]) seleccionarProgramaObj(data[0]);
    if (sub) openSubfolders.value[claveSub(cp, sub)] = true;
    alert(`¡Programa "${nom}" guardado permanentemente en ${cp}!`);
  } catch (err) {
    if (/subcarpeta/i.test(errMsg(err))) avisoFaltaSql(err);
    else alert("Error de Supabase al guardar programa: " + errMsg(err));
  }
};

export const eliminarProgramaCompleto = async (progId) => {
  if (!soloAdmin()) return;
  if (!confirm("¿Estás seguro de eliminar este programa completo junto con sus equipos asignados?")) return;
  try {
    await sb(supabaseClient.from(TABLA_PROGRAMAS_ITEMS).delete().eq('programa_id', progId));
    await sb(supabaseClient.from(TABLA_PROGRAMAS).delete().eq('id', progId));
    dbProgramasCalendarios.value = dbProgramasCalendarios.value.filter(p => p.id !== progId);
    dbProgramasItems.value = dbProgramasItems.value.filter(i => i.programa_id !== progId);
    if (progSelect.value.id === progId) progSelect.value = PROG_VACIO();
    alert("¡Programa eliminado con éxito!");
  } catch (err) {
    alert("Error al eliminar el programa: " + errMsg(err));
  }
};

// ---------- Asignar equipos ----------
/**
 * Arma el registro de BD_PROGRAMAS_ITEMS y lo inserta.
 * Se usa desde el modal "Asignar Equipo" y desde el Perfil de Equipo.
 * (Antes, si Supabase fallaba, se agregaba igual un registro falso en pantalla que desaparecía al recargar.)
 */
export const insertarItemPrograma = async ({ programa_id, afi, tipo, tipoMant = '', nave, condicion, fechaInicio, fechaFin }) => {
  const prog = obtenerProgObj(programa_id);
  const esMant = esProgramaMantencion(prog);
  const payload = {
    programa_id,
    afi: limpiarAfi(afi),
    tipo: esMant ? (tipoMant || 'Mantención') : tipo,   // mantención: '250 HRS' | '500 HRS' | '1000 HRS' | 'INTERMEDIA'
    nave: esMant ? null : (nave || 'NAVE 1'),
    condicion: esMant ? 'Arriendo' : condicion,
    fecha_programada: fechaInicio,
    fecha_inicio: fechaInicio,
    fecha_fin: esMant ? fechaInicio : (fechaFin || fechaInicio),
    realizado: false
    // (no se envía `horometro`: la columna no existe en bd_programas_items — ver LEEME)
  };
  const data = await sb(supabaseClient.from(TABLA_PROGRAMAS_ITEMS).insert([payload]).select());
  if (data && data[0]) dbProgramasItems.value.push(data[0]);
  return prog;
};

export const showModalAsignarEquipo = ref(false);
export const formAsignar = ref({ programa_id: '', afi: '', tipo: 'Reparación', tipoMant: '250 HRS', nave: 'NAVE 1', condicion: 'Arriendo', fecha_programada: '', fecha_fin: '', tipoFiltro: '', editandoId: null });

/** Programas que se muestran en el modal "Asignar Equipo" (solo los del submódulo desde donde se abrió). */
export const programasParaAsignar = computed(() => dbProgramasCalendarios.value
  .filter(p => !formAsignar.value.tipoFiltro || carpetaDe(p) === formAsignar.value.tipoFiltro));

/** tipoCarpeta: 'REPARACION' | 'MANTENCION' (submódulo actual) → el modal solo ofrece programas de ese tipo. */
export const abrirModalAsignarEquipo = (tipoCarpeta = '') => {
  const tf = String(tipoCarpeta || '').toUpperCase();
  const actual = obtenerProgObj(progSelect.value.id);
  const selProg = (actual && (!tf || carpetaDe(actual) === tf)) ? actual
    : (dbProgramasCalendarios.value.find(p => !tf || carpetaDe(p) === tf) || null);
  formAsignar.value = {
    tipoFiltro: tf,
    programa_id: selProg ? selProg.id : '',
    afi: '',
    tipo: esProgramaMantencion(selProg) ? 'Mantención' : 'Reparación',
    tipoMant: '250 HRS',
    nave: 'NAVE 1',
    condicion: 'Arriendo',
    fecha_programada: selProg ? selProg.fecha_inicio_programa : hoyISO(),
    fecha_fin: selProg ? selProg.fecha_termino_programa : hoyISO(),
    editandoId: null
  };
  showModalAsignarEquipo.value = true;
};

/** Abre el mismo modal con los datos de un equipo ya asignado (programas de REPARACIÓN) para editarlo. */
export const abrirEditarItemPrograma = (item) => {
  if (!soloEditor()) return;
  const prog = obtenerProgObj(item.programa_id);
  formAsignar.value = {
    tipoFiltro: carpetaDe(prog),
    programa_id: item.programa_id,
    afi: buscarEquipoPorAfi(item.afi)?.afi ?? item.afi,   // mismo valor que la lista de equipos del modal
    tipo: item.tipo || 'Reparación',
    nave: item.nave || 'NAVE 1',
    condicion: item.condicion || 'Arriendo',
    fecha_programada: normalizarFecha(item.fecha_inicio || item.fecha_programada) || '',
    fecha_fin: normalizarFecha(item.fecha_fin) || '',
    editandoId: item.id
  };
  showModalAsignarEquipo.value = true;
};

/** Guarda los cambios de un equipo ya asignado. */
const actualizarItemPrograma = async (f) => {
  const fechaFin = f.fecha_fin || f.fecha_programada;
  if (fechaFin < f.fecha_programada) throw new Error('La fecha fin no puede ser anterior a la fecha inicio.');
  const cambios = {
    programa_id: f.programa_id,
    afi: limpiarAfi(f.afi),
    tipo: (f.tipo || 'Reparación').trim() || 'Reparación',
    nave: f.nave || 'NAVE 1',
    condicion: f.condicion || 'Arriendo',
    fecha_programada: f.fecha_programada,
    fecha_inicio: f.fecha_programada,
    fecha_fin: fechaFin
  };
  const data = await sb(supabaseClient.from(TABLA_PROGRAMAS_ITEMS).update(cambios).eq('id', f.editandoId).select());
  const nuevo = (data && data[0]) || { ...cambios, id: f.editandoId };
  dbProgramasItems.value = dbProgramasItems.value.map(i => (i.id === f.editandoId ? { ...i, ...nuevo } : i));
};

export const actualizarTipoSegunProgramaSeleccionado = () => {
  const prog = obtenerProgObj(formAsignar.value.programa_id);
  if (!prog) return;
  formAsignar.value.fecha_programada = prog.fecha_inicio_programa || hoyISO();
  if (esProgramaMantencion(prog)) {
    formAsignar.value.tipo = 'Mantención';
  } else {
    formAsignar.value.tipo = 'Reparación';
    formAsignar.value.fecha_fin = prog.fecha_termino_programa || hoyISO();
  }
};

export const guardarAsignacionEquipo = async () => {
  if (!soloEditor()) return;
  const f = formAsignar.value;
  if (f.editandoId) {
    try {
      await actualizarItemPrograma(f);
      showModalAsignarEquipo.value = false;
      const prog = obtenerProgObj(f.programa_id);
      if (prog) seleccionarProgramaObj(prog);
      alert("¡Cambios guardados!");
    } catch (err) {
      alert("Error al guardar los cambios: " + errMsg(err));
    }
    return;
  }
  try {
    const prog = await insertarItemPrograma({
      programa_id: f.programa_id, afi: f.afi, tipo: f.tipo, tipoMant: f.tipoMant, nave: f.nave, condicion: f.condicion,
      fechaInicio: f.fecha_programada, fechaFin: f.fecha_fin
    });
    showModalAsignarEquipo.value = false;
    if (prog) seleccionarProgramaObj(prog);
    alert("¡Equipo asignado con éxito!");
  } catch (err) {
    alert("Error al asignar equipo: " + errMsg(err));
  }
};

// ---------- Actualizar / eliminar ítems ----------
/**
 * Cambia Realizado / Pendiente.
 * En programas de MANTENCIÓN además mueve la Bodega de Filtros:
 *  - Realizado  → descuenta 1 KIT del modelo del equipo (si no hay, pregunta si marcar igual).
 *  - Pendiente  → devuelve a bodega el KIT que se había descontado para ese ítem.
 */
export const cambiarEstadoRealizadoItem = async (item) => {
  if (!soloEditor()) { item.realizado = !item.realizado; return; }
  const esMant = esProgramaMantencion(obtenerProgObj(item.programa_id));

  const descuenta = esMant && descuentaBodega(item.programa_id) && !esItemIntermedia(item);   // intermedia = solo filtro de aire → no descuenta KIT
  if (descuenta && item.realizado && !kitConsumidoItem(item)) {
    const { principal } = kitsEnBodegaAfi(item.afi);
    if (!principal && !confirm(`No hay KIT en bodega para el modelo del AFI ${item.afi}.\n¿Marcar como REALIZADO igual (sin descontar kit)?`)) {
      item.realizado = false;
      return;
    }
  }

  try {
    await sb(supabaseClient.from(TABLA_PROGRAMAS_ITEMS).update({ realizado: item.realizado }).eq('id', item.id));
  } catch (err) {
    item.realizado = !item.realizado; // revierte el switch
    return alert("No se pudo actualizar el estado: " + errMsg(err));
  }

  if (!esMant) return;
  try {
    if (item.realizado) { if (descuenta) await consumirKitParaItem(item); }
    else await devolverKitDeItem(item);   // si se había descontado un kit, se devuelve aunque el switch esté en OFF
  } catch (err) {
    alert(`El estado se guardó, pero no se pudo ${item.realizado ? 'descontar' : 'devolver'} el KIT en bodega: ` + errMsg(err));
  }
};

let avisoHorometroMostrado = false;
/** REPARACIÓN: guarda la fecha de inicio y de fin editadas directo en la tabla del programa. */
export const actualizarFechasItemReparacion = async (item) => {
  if (!soloEditor()) return;
  const ini = normalizarFecha(item.fecha_inicio) || null, fin = normalizarFecha(item.fecha_fin) || null;
  if (ini && fin && fin < ini) { alert('La FECHA FIN no puede ser anterior a la FECHA INICIO.'); item.fecha_fin = ini; return actualizarFechasItemReparacion(item); }
  try {
    await sb(supabaseClient.from(TABLA_PROGRAMAS_ITEMS).update({ fecha_inicio: ini, fecha_programada: ini, fecha_fin: fin || ini }).eq('id', item.id));
    item.fecha_programada = ini;
    if (!fin) item.fecha_fin = ini;
  } catch (err) {
    alert('No se pudo guardar la fecha: ' + errMsg(err));
  }
};

export const actualizarItemMantencionProgramado = async (item) => {
  if (!soloAdmin()) return;
  const base = {
    fecha_programada: item.fecha_programada || null,
    fecha_inicio: item.fecha_programada || null,
    fecha_fin: item.fecha_fin || null,
    realizado: item.realizado
  };
  try {
    try {
      await sb(supabaseClient.from(TABLA_PROGRAMAS_ITEMS).update({ ...base, horometro: parseNum(item.horometro) }).eq('id', item.id));
    } catch (err) {
      // Si la columna `horometro` aún no existe en bd_programas_items, se guardan igual las fechas
      if (!/horometro/i.test(errMsg(err))) throw err;
      await sb(supabaseClient.from(TABLA_PROGRAMAS_ITEMS).update(base).eq('id', item.id));
      if (!avisoHorometroMostrado) {
        avisoHorometroMostrado = true;
        alert("Fechas guardadas, pero el HORÓMETRO no se pudo guardar: falta la columna 'horometro' en la tabla bd_programas_items (ver LEEME).");
      }
    }
    item.fecha_inicio = item.fecha_programada;
  } catch (err) {
    alert("No se pudo guardar el cambio: " + errMsg(err));
  }
};

// ---------- Fechas en BORRADOR (igual que el N° Item de la Minuta) ----------
// Mantención (fecha programada / fecha realizada) y Reparación (fecha inicio / fecha fin):
// al escribir, la fecha queda en un borrador (item._borrador) → NO se guarda ni se mueve la fila.
// Se puede escribir cualquier fecha; al presionar "Guardar fechas" se valida y recién ahí se guarda
// y la tabla se reordena. Si alguna fecha no es válida se muestra el error y NO se guarda nada.
const vFecha = (v) => normalizarFecha(v) || '';
export const fechaVisible = (item, campo) =>
  (item._borrador && campo in item._borrador) ? item._borrador[campo].v : vFecha(item[campo]);
export const cambiarFechaBorrador = (item, campo, ev) => {
  const el = ev && ev.target;
  if (!item._borrador) item._borrador = {};
  // badInput = fecha a medio escribir o imposible (ej. 31-02): se avisa recién al guardar
  item._borrador[campo] = { v: el ? el.value : String(ev || ''), malo: Boolean(el && el.validity && el.validity.badInput) };
  if (item._errFechas) delete item._errFechas[campo];
};
export const fechaPendiente = (item, campo) => Boolean(item._borrador && campo in item._borrador &&
  (item._borrador[campo].malo || item._borrador[campo].v !== vFecha(item[campo])));
export const errorFecha = (item, campo) => (item._errFechas && item._errFechas[campo]) || '';
export const claseFechaBorrador = (item, campo) => errorFecha(item, campo)
  ? 'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-300'
  : fechaPendiente(item, campo) ? 'border-amber-400 bg-amber-50 text-amber-800' : 'bg-white';
const CAMPOS_BORRADOR = ['fecha_programada', 'fecha_fin', 'fecha_inicio'];
const itemConBorrador = (item) => CAMPOS_BORRADOR.some(c => fechaPendiente(item, c));
/** Equipos del programa con fechas sin guardar. */
export const cambiosFechasPrograma = (programaId) =>
  dbProgramasItems.value.filter(i => String(i.programa_id) === String(programaId) && itemConBorrador(i));

export const guardandoFechas = ref(false);

/** Valida todas las fechas en borrador del programa. Devuelve [{ item, campo, msg }]. */
const validarBorradores = (items, esReparacion) => {
  const errores = [];
  const hoy = hoyISO();
  items.forEach(item => {
    const val = (c) => (item._borrador && c in item._borrador) ? item._borrador[c] : { v: vFecha(item[c]), malo: false };
    const campos = esReparacion ? ['fecha_inicio', 'fecha_fin'] : ['fecha_programada', 'fecha_fin'];
    const nombre = { fecha_programada: 'Fecha programada', fecha_fin: esReparacion ? 'Fecha fin' : 'Fecha realizada', fecha_inicio: 'Fecha inicio' };
    campos.forEach(c => {
      if (!fechaPendiente(item, c)) return;
      const { v, malo } = val(c);
      if (malo) return errores.push({ item, campo: c, msg: `${nombre[c]} incompleta o no existe` });
      if (!v) { if (esReparacion && c === 'fecha_inicio') errores.push({ item, campo: c, msg: 'Fecha inicio vacía' }); return; }
      const anio = String(v).match(/^\+?(\d+)-\d{2}-\d{2}$/);
      if (anio && anio[1].length !== 4) return errores.push({ item, campo: c, msg: `${nombre[c]}: año ${anio[1]} no válido` });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !vFecha(v)) return errores.push({ item, campo: c, msg: `${nombre[c]} no válida` });
      const y = Number(v.slice(0, 4));
      if (y < 2000 || y > 2100) return errores.push({ item, campo: c, msg: `${nombre[c]}: año ${y} fuera de rango (2000-2100)` });
      if (!esReparacion && c === 'fecha_fin' && v > hoy) errores.push({ item, campo: c, msg: 'Fecha realizada no puede ser futura' });
    });
    if (esReparacion) {
      const ini = val('fecha_inicio'), fin = val('fecha_fin');
      if (!ini.malo && !fin.malo && ini.v && fin.v && fin.v < ini.v && (fechaPendiente(item, 'fecha_inicio') || fechaPendiente(item, 'fecha_fin')))
        errores.push({ item, campo: 'fecha_fin', msg: 'Fecha fin anterior a la fecha inicio' });
    }
  });
  return errores;
};

export const guardarCambiosFechas = async (programaId) => {
  const prog = obtenerProgObj(programaId);
  const esReparacion = carpetaDe(prog || {}) === 'REPARACION';
  if (esReparacion ? !soloEditor() : !soloAdmin()) return;
  const lista = cambiosFechasPrograma(programaId);
  if (!lista.length) return;
  lista.forEach(it => { it._errFechas = {}; });
  const errores = validarBorradores(lista, esReparacion);
  if (errores.length) {
    errores.forEach(e => { e.item._errFechas[e.campo] = e.msg; });
    alert('No se guardó ningún cambio. Corrige estas fechas:\n\n' + errores.map(e => `• AFI ${e.item.afi}: ${e.msg}`).join('\n'));
    return;
  }
  guardandoFechas.value = true;
  const fallas = [];
  try {
    for (const it of lista) {
      const b = (c) => (it._borrador && c in it._borrador) ? (it._borrador[c].v || null) : (vFecha(it[c]) || null);
      try {
        if (esReparacion) {
          const ini = b('fecha_inicio'), fin = b('fecha_fin') || ini;
          await sb(supabaseClient.from(TABLA_PROGRAMAS_ITEMS).update({ fecha_inicio: ini, fecha_programada: ini, fecha_fin: fin }).eq('id', it.id));
          it.fecha_inicio = ini; it.fecha_programada = ini; it.fecha_fin = fin;
        } else {
          const prg = b('fecha_programada'), fin = b('fecha_fin');
          await sb(supabaseClient.from(TABLA_PROGRAMAS_ITEMS).update({ fecha_programada: prg, fecha_inicio: prg, fecha_fin: fin }).eq('id', it.id));
          it.fecha_programada = prg; it.fecha_inicio = prg; it.fecha_fin = fin;
        }
        delete it._borrador; delete it._errFechas;   // recién ahora la fila toma su lugar según la fecha
      } catch (err) { fallas.push(`AFI ${it.afi}: ${errMsg(err)}`); }
    }
  } finally { guardandoFechas.value = false; }
  if (fallas.length) alert('No se pudieron guardar algunas fechas:\n' + fallas.join('\n'));
};

export const descartarCambiosFechas = (programaId) => {
  dbProgramasItems.value.filter(i => String(i.programa_id) === String(programaId)).forEach(it => { delete it._borrador; delete it._errFechas; });
};

export const eliminarItemPrograma = async (itemId) => {
  if (!soloAdmin()) return;
  if (!confirm("¿Eliminar este equipo del programa?")) return;
  try {
    await sb(supabaseClient.from(TABLA_PROGRAMAS_ITEMS).delete().eq('id', itemId));
    dbProgramasItems.value = dbProgramasItems.value.filter(i => i.id !== itemId);
  } catch (err) {
    alert("Error al eliminar: " + errMsg(err));
  }
};

// ---------- Última mantención y ubicación actual de cada equipo ----------
/** MANTENCIÓN ≠ INTERVENCIÓN.
 *  Mantención = solo los registros del Historial con causa MANTENCION (incluye "MANTENCION INTERMEDIA").
 *  Intervención = todo lo demás (reparación, implementación, falla, inspección...). */
const sinTildes = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Mantención COMPLETA (no cuenta la INTERMEDIA, que es solo de filtros de aire). */
export const esMantencion = (i) => claseMantencion(i) === 'COMPLETA';

// ---------- Tipo de mantención de cada equipo en el programa (bd_programas_items.tipo) ----------
export const TIPOS_MANT_PROG = [
  { key: '250 HRS', label: '250 hrs' },
  { key: '500 HRS', label: '500 hrs' },
  { key: '1000 HRS', label: '1000 hrs' },
  { key: 'INTERMEDIA', label: 'Intermedia (filtros de aire)' }
];
/** '250 HRS' | '500 HRS' | '1000 HRS' | 'INTERMEDIA' | '' (ítems antiguos = "Mantención" sin tipo). */
export const tipoMantDeItem = (item) => {
  const t = sinTildes(item?.tipo);
  if (t.includes('INTERMEDIA')) return 'INTERMEDIA';
  const m = t.match(/(\d{3,4})/);
  return m ? `${m[1]} HRS` : '';
};
export const esItemIntermedia = (item) => tipoMantDeItem(item) === 'INTERMEDIA';
export const etiquetaTipoMant = (item) => { const k = tipoMantDeItem(item); return (TIPOS_MANT_PROG.find(t => t.key === k) || {}).label || 'Sin tipo'; };
export const claseTipoMant = (item) => {
  const k = tipoMantDeItem(item);
  return k === 'INTERMEDIA' ? 'bg-sky-100 text-sky-800' : k === '250 HRS' ? 'bg-emerald-100 text-emerald-800'
    : k === '500 HRS' ? 'bg-amber-100 text-amber-800' : k === '1000 HRS' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-500';
};
/** Cambia el tipo de mantención de un equipo del programa (Admin). */
export const cambiarTipoMantItem = async (item, nuevo) => {
  if (!soloAdmin()) return;
  const anterior = item.tipo;
  item.tipo = nuevo || 'Mantención';
  try { await sb(supabaseClient.from(TABLA_PROGRAMAS_ITEMS).update({ tipo: item.tipo }).eq('id', item.id)); }
  catch (err) { item.tipo = anterior; alert('No se pudo cambiar el tipo: ' + errMsg(err)); }
};

/** Última MANTENCIÓN (causa = Mantención) registrada en el Historial para un AFI (o null). No cuenta intervenciones. */
// ---------- Programas CERRADOS (vigencia terminada) ----------
/** Un programa queda CERRADO cuando su fecha de término ya pasó. */
export const programaCerrado = (prog) => {
  const fin = normalizarFecha(prog?.fecha_termino_programa);
  return Boolean(fin && fin < hoyISO());
};
/** Fecha de corte para "Última mantención": cerrado → su fecha de término (queda congelado); vigente → hoy (null). */
export const fechaCorteProg = (prog) => (programaCerrado(prog) ? normalizarFecha(prog.fecha_termino_programa) : null);

/** Última MANTENCIÓN de un AFI. hasta = fecha de corte (ISO): no cuenta mantenciones posteriores. */
export const ultimaMantencionAfi = (afi, hasta = null) => {
  let ult = null, tUlt = -1;
  dbIntervenciones.value.forEach(i => {
    if (!mismoAfi(i.afi, afi) || !esMantencion(i)) return;
    if (hasta && normalizarFecha(i.fecha) > hasta) return;
    const t = parseIsoDate(i.fecha);
    if (t > tUlt) { tUlt = t; ult = i; }
  });
  return ult;
};
/** Días desde la última mantención hasta hoy (o hasta la fecha de corte). */
export const diasDesdeUltimaMantencion = (afi, hasta = null) => {
  const u = ultimaMantencionAfi(afi, hasta);
  return u ? diasEntre(hasta || hoyISO(), u.fecha) : null;
};
/** Ubicación actual del equipo (Inventario; la actualizan los Movimientos). */
export const ubicacionActualAfi = (afi) => {
  const e = buscarEquipoPorAfi(afi);
  return e ? (String(e.ubicacion || '').trim() || '-') : '-';
};
export const empresaActualAfi = (afi) => {
  const e = buscarEquipoPorAfi(afi);
  return e ? empresaDe(e) : '';
};

// ---------- Exportar programa a Excel (con logo, todo centrado) ----------
export const exportandoPrograma = ref(false);
const FILL_GANTT = { prog: 'FFC7D2FE', atrasado: 'FFFECACA', hecho: 'FFA7F3D0', reprog: 'FFFDE68A' };
const MARCA_GANTT = { prog: '●', atrasado: '!', hecho: '✓', reprog: 'P' };

/** Colorea las celdas de días de un Gantt ya dibujado con hojaTabla. */
const pintarGantt = (ws, nFilas, colInicio, valorACodigo) => {
  for (let r = 7; r < 7 + nFilas; r++) {
    for (let c = colInicio; c <= ws.columnCount; c++) {
      const cell = ws.getCell(r, c);
      const cod = valorACodigo(cell.value);
      if (cod) { cell.fill = fill(FILL_GANTT[cod]); cell.font = { bold: true, size: 9 }; }
    }
  }
};

export const exportarProgramaGanttExcel = async (prog) => {
  if (!prog || !prog.id) return alert("Selecciona un programa primero.");
  exportandoPrograma.value = true;
  try {
    const { wb, logo } = await nuevoLibro();
    const det = obtenerDetalleEquipoPorAfi;
    const nombre = prog.nombre_programa || prog.mes || 'Programa';
    const vigencia = `Vigencia: ${formatDateForDisplay(prog.fecha_inicio_programa)} al ${formatDateForDisplay(prog.fecha_termino_programa)}`;
    const dias = generarDiasDelPrograma(prog);
    const colsDias = dias.map(d => ({ t: `${d.letraDia.toUpperCase()}\n${String(d.numDia).padStart(2, '0')}`, w: 4.2 }));
    const estiloEstado = (realizado) => (realizado ? { font: { color: { argb: COLOR.verdeTxt } } } : null);

    if (esProgramaMantencion(prog)) {
      const corte = fechaCorteProg(prog);
      const items = obtenerItemsPrograma(prog.id);
      if (!items.length) return alert("El programa no tiene equipos asignados.");
      // Hoja "Inicio" con dashboard (va primera)
      await hojaInicioMantencion(wb, logo, { prog, nombre, vigencia, items, det, ubicacion: ubicacionActualAfi, dias, corte, kitsBodega: (afi) => kitsEnBodegaAfi(afi).total });
      const filas = items.map((item, i) => {
        const u = ultimaMantencionAfi(item.afi, corte);
        return [
          i + 1, `AFI ${item.afi}`, det(item.afi, 'tipo'), `${det(item.afi, 'marca')} ${det(item.afi, 'modelo')}`, etiquetaTipoMant(item).toUpperCase(),
          ubicacionActualAfi(item.afi), empresaActualAfi(item.afi) || '-',
          u ? fechaExcel(normalizarFecha(u.fecha)) : 'NO HAY MANTENCIONES ANTERIORES', u ? (u.tipoMant || 'MANTENCION') : '-', u && u.horometro ? Number(u.horometro) : '-',
          fechaExcel(normalizarFecha(item.fecha_programada)) || '-', fechaExcel(normalizarFecha(item.fecha_fin)) || '-',
          item.horometro ? Number(item.horometro) : '-',
          filtrosRequeridosAfi(item.afi).total || '-', kitsEnBodegaAfi(item.afi).total, kitConsumidoItem(item) || '-',
          item.realizado ? 'REALIZADO' : 'PENDIENTE'
        ];
      });
      const realizados = items.filter(i => i.realizado).length;
      const ws = hojaTabla(wb, logo, {
        nombre: 'Mantención', titulo: `PROGRAMA DE MANTENCIÓN · ${nombre}`, subtitulo: `${vigencia}${corte ? ' (CERRADO)' : ''} · ${items.length} equipos · ${realizados} realizados (${Math.round(realizados / items.length * 100)}%)`,
        columnas: [
          { t: 'N°', w: 5 }, { t: 'EQUIPO AFI', w: 11, bold: true }, { t: 'TIPO EQUIPO', w: 18 }, { t: 'MARCA / MODELO', w: 22 }, { t: 'TIPO MANT.', w: 12, bold: true },
          { t: 'UBICACIÓN ACTUAL', w: 20, bold: true }, { t: 'EMPRESA', w: 18 },
          { t: corte ? 'ÚLTIMA MANTENCIÓN (AL CIERRE)' : 'ÚLTIMA MANTENCIÓN', w: 14, fmt: 'dd-mm-yyyy', bold: true }, { t: 'TIPO ÚLT. MANT.', w: 20 }, { t: 'HORÓMETRO ÚLT. MANT.', w: 12, fmt: '#,##0' },
          { t: 'FECHA PROGRAMADA', w: 13, fmt: 'dd-mm-yyyy' }, { t: 'FECHA REALIZADA', w: 13, fmt: 'dd-mm-yyyy' }, { t: 'HORÓMETRO REALIZADO', w: 12, fmt: '#,##0' },
          { t: 'FILTROS REQ.', w: 9 }, { t: 'KITS EN BODEGA', w: 9 }, { t: 'KIT DESCONTADO', w: 14 }, { t: 'ESTADO', w: 13, bold: true }
        ],
        filas
      });
      filas.forEach((f, i) => {
        const c = ws.getCell(7 + i, 17);
        c.fill = fill(f[16] === 'REALIZADO' ? COLOR.verde : COLOR.ambar);
        c.font = { bold: true, size: 9, color: { argb: f[16] === 'REALIZADO' ? COLOR.verdeTxt : COLOR.ambarTxt } };
      });
      bloqueFirmas(ws, FIRMAS_PROGRAMA);

      if (dias.length) {
        const filasG = items.map(item => [
          `AFI ${item.afi}`, det(item.afi, 'tipo'), ubicacionActualAfi(item.afi), item.realizado ? 'REALIZADO' : 'PENDIENTE',
          ...dias.map(d => MARCA_GANTT[celdaGanttMant(item, d.fechaStr)] || '')
        ]);
        const wsG = hojaTabla(wb, logo, {
          nombre: 'Carta Gantt', titulo: `CARTA GANTT · ${nombre}`, subtitulo: `${vigencia} · ● Programado   ! Atrasado   ✓ Realizado   P Reprogramado`,
          columnas: [{ t: 'AFI', w: 10, bold: true }, { t: 'TIPO EQUIPO', w: 18 }, { t: 'UBICACIÓN ACTUAL', w: 18 }, { t: 'ESTADO', w: 12, bold: true }, ...colsDias],
          filas: filasG, estiloFila: (f) => estiloEstado(f[3] === 'REALIZADO')
        });
        const inv = Object.fromEntries(Object.entries(MARCA_GANTT).map(([k, v]) => [v, k]));
        pintarGantt(wsG, filasG.length, 5, v => inv[v]);
        bloqueFirmas(wsG, FIRMAS_PROGRAMA);
      }
    } else {
      let hay = false;
      const todos = obtenerItemsPrograma(prog.id);
      const fueraRango = obtenerItemsFueraDeRangoPrograma(prog.id);
      // Hoja "Inicio" con dashboard (va primera, antes de las naves)
      if (todos.length) await hojaInicioReparacion(wb, logo, { prog, nombre, vigencia, items: todos, naves: NAVES, det, ubicacion: ubicacionActualAfi, dias, fueraRango });
      NAVES.forEach(nave => {
        const items = obtenerItemsProgramaPorNave(prog.id, nave);
        if (!items.length) return;
        hay = true;
        const filas = items.map(item => [
          det(item.afi, 'tipo'), `AFI ${item.afi}`, `${det(item.afi, 'marca')} ${det(item.afi, 'modelo')}`, ubicacionActualAfi(item.afi),
          item.condicion || 'Arriendo', fechaExcel(normalizarFecha(item.fecha_inicio)) || '-', fechaExcel(normalizarFecha(item.fecha_fin)) || '-',
          item.realizado ? 'REPARADO (ON)' : 'PENDIENTE (OFF)',
          ...dias.map(d => (esFechaEnRango(d.fechaStr, item.fecha_inicio, item.fecha_fin) ? '●' : ''))
        ]);
        const ws = hojaTabla(wb, logo, {
          nombre: nave, titulo: `PROGRAMA DE REPARACIÓN · ${nombre}`, subtitulo: `${nave} · ${vigencia}`,
          columnas: [
            { t: 'TIPO EQUIPO', w: 18 }, { t: 'AFI', w: 10, bold: true }, { t: 'MARCA / MODELO', w: 22 }, { t: 'UBICACIÓN ACTUAL', w: 18 },
            { t: 'CONDICIÓN', w: 11 }, { t: 'INICIO', w: 12, fmt: 'dd-mm-yyyy' }, { t: 'FIN', w: 12, fmt: 'dd-mm-yyyy' }, { t: 'ESTADO', w: 15, bold: true }, ...colsDias
          ],
          filas, estiloFila: (f) => estiloEstado(f[7] === 'REPARADO (ON)')
        });
        pintarGantt(ws, filas.length, 9, v => (v === '●' ? 'prog' : ''));
      });
      if (fueraRango.length) {
        hay = true;
        hojaTabla(wb, logo, {
          nombre: 'Fuera de rango', titulo: `PROGRAMA DE REPARACIÓN · ${nombre}`, subtitulo: `Equipos fuera de la vigencia · ${vigencia}`, apaisado: false,
          columnas: [{ t: 'AFI', w: 10, bold: true }, { t: 'TIPO EQUIPO', w: 18 }, { t: 'UBICACIÓN ACTUAL', w: 18 }, { t: 'NAVE', w: 10 }, { t: 'INICIO', w: 12, fmt: 'dd-mm-yyyy' }, { t: 'FIN', w: 12, fmt: 'dd-mm-yyyy' }, { t: 'OBSERVACIÓN', w: 30 }],
          filas: fueraRango.map(item => [`AFI ${item.afi}`, det(item.afi, 'tipo'), ubicacionActualAfi(item.afi), item.nave || 'NAVE 1', fechaExcel(normalizarFecha(item.fecha_inicio)) || '-', fechaExcel(normalizarFecha(item.fecha_fin)) || '-', 'Fuera de vigencia del programa'])
        });
      }
      if (!hay) return alert("El programa no tiene equipos asignados.");
    }
    await descargarLibro(wb, `Programa_${nombre}.xlsx`);
  } catch (err) {
    alert("Error al exportar el programa: " + errMsg(err));
  } finally { exportandoPrograma.value = false; }
};

// =====================================================================
// ENLACE PROGRAMAS ↔ HISTORIAL DE MANTENCIONES
// Una mantención del Historial con "Programa" = nombre del programa y el mismo AFI
// realiza un ítem de ese programa. Si el equipo aparece varias veces en el programa,
// las mantenciones se asignan en orden de fecha: la 1ª a la fecha programada más baja,
// la 2ª a la siguiente, etc.
// =====================================================================
const upP = (v) => String(v || '').trim().toUpperCase();
export const nombreDePrograma = (p) => upP(p?.nombre_programa || p?.mes);
const mismoEquipo = (a, b) => upP(limpiarAfi(a)) === upP(limpiarAfi(b));
const fechaItem = (i) => normalizarFecha(i.fecha_programada || i.fecha_inicio) || '9999-12-31';

/** Mapa itemId → mantención del Historial enlazada, para un programa. */
export const enlacesDePrograma = (programaId) => {
  const prog = obtenerProgObj(programaId);
  const mapa = new Map();
  if (!prog) return mapa;
  const nombre = nombreDePrograma(prog);
  const esMantProg = esProgramaMantencion(prog);
  // En programas de MANTENCIÓN solo cuentan registros que sean mantención (la causa dice MANTENCION)
  const mants = dbIntervenciones.value.filter(m => upP(m.programaCorrespondiente) === nombre && (!esMantProg || claseMantencion(m)));
  if (!mants.length) return mapa;
  const items = obtenerItemsPrograma(programaId);
  const afis = [...new Set(items.map(i => upP(limpiarAfi(i.afi))))];
  const porFecha = (a, b) => String(normalizarFecha(a.fecha)).localeCompare(String(normalizarFecha(b.fecha))) || (a.id - b.id);
  const enlazar = (its, ms) => {
    its.sort((a, b) => fechaItem(a).localeCompare(fechaItem(b)) || (a.id - b.id));
    ms.sort(porFecha);
    its.forEach((it, k) => { if (ms[k]) mapa.set(it.id, ms[k]); });
  };
  afis.forEach(afi => {
    const its = items.filter(i => mismoEquipo(i.afi, afi));
    const ms = mants.filter(m => mismoEquipo(m.afi, afi));
    if (!esMantProg) return enlazar(its, ms);
    // INTERMEDIA del programa ↔ "MANTENCION INTERMEDIA" del Historial · 250/500/1000 ↔ mantención completa
    enlazar(its.filter(esItemIntermedia), ms.filter(m => claseMantencion(m) === 'INTERMEDIA'));
    enlazar(its.filter(i => !esItemIntermedia(i)), ms.filter(m => claseMantencion(m) === 'COMPLETA'));
  });
  return mapa;
};
/** Mantención del Historial enlazada a un ítem (o undefined). */
export const mantencionDeItem = (item) => enlacesDePrograma(item.programa_id).get(item.id);

/** Programas que tienen al AFI asignado, con sus fechas aún pendientes (para el formulario de mantención). */
export const programasDelAfi = (afi) => {
  if (!afi) return [];
  return dbProgramasCalendarios.value.map(p => {
    const its = obtenerItemsPrograma(p.id).filter(i => mismoEquipo(i.afi, afi));
    if (!its.length) return null;
    const enl = enlacesDePrograma(p.id);
    const pendientes = its.filter(i => !enl.has(i.id) && !i.realizado).map(i => fechaItem(i));
    return { prog: p, nombre: p.nombre_programa || p.mes, pendientes };
  }).filter(Boolean).sort((a, b) => (b.pendientes.length > 0) - (a.pendientes.length > 0) || String(a.pendientes[0] || '').localeCompare(String(b.pendientes[0] || '')));
};

/**
 * Marca como REALIZADOS los ítems enlazados (fecha realizada y horómetro de la mantención).
 * En programas de MANTENCIÓN descuenta el KIT de bodega igual que el switch (si el descuento está activo y hay kit).
 * @param nombrePrograma  si se indica, solo ese programa; si no, el programa con id `programaId`.
 * @returns texto con avisos (vacío si todo bien)
 */
export const sincronizarProgramaConHistorial = async ({ nombrePrograma = '', programaId = null, afi = '' } = {}) => {
  const progs = programaId ? [obtenerProgObj(programaId)].filter(Boolean)
    : dbProgramasCalendarios.value.filter(p => nombreDePrograma(p) === upP(nombrePrograma));
  let marcados = 0, agregados = 0; const avisos = [], faltaEn = [];
  for (const prog of progs) {
    const esMant = esProgramaMantencion(prog);
    // REPARACIÓN: si el equipo no está en el programa (o tiene más registros que ítems), se agrega solo,
    // con la fecha del registro; luego se marca REALIZADO abajo. En MANTENCIÓN los equipos se planifican antes.
    if (!esMant) {
      try { agregados += await agregarFaltantesReparacion(prog, afi); }
      catch (err) { avisos.push(`No se pudo agregar el equipo al programa "${nombreDePrograma(prog)}": ${errMsg(err)}`); }
    }
    if (afi && !obtenerItemsPrograma(prog.id).some(i => mismoEquipo(i.afi, afi))) faltaEn.push(nombreDePrograma(prog));
    const enl = enlacesDePrograma(prog.id);
    for (const item of obtenerItemsPrograma(prog.id)) {
      const m = enl.get(item.id);
      if (!m || (afi && !mismoEquipo(item.afi, afi))) continue;
      const fechaReal = normalizarFecha(m.fecha);
      const horo = parseNum(m.horometro) || null;
      const yaEstaba = item.realizado;
      if (yaEstaba && normalizarFecha(item.fecha_fin) === fechaReal && (!horo || parseNum(item.horometro) === horo)) continue;
      const base = { realizado: true, fecha_fin: fechaReal || null };
      try {
        try { await sb(supabaseClient.from(TABLA_PROGRAMAS_ITEMS).update({ ...base, horometro: horo }).eq('id', item.id)); item.horometro = horo; }
        catch (err) { if (!/horometro/i.test(errMsg(err))) throw err; await sb(supabaseClient.from(TABLA_PROGRAMAS_ITEMS).update(base).eq('id', item.id)); }
        item.realizado = true; item.fecha_fin = base.fecha_fin;
        marcados++;
      } catch (err) { avisos.push(`AFI ${item.afi} (${formatDateForDisplay(item.fecha_programada)}): ${errMsg(err)}`); continue; }
      if (!yaEstaba && esMant && descuentaBodega(prog.id) && !esItemIntermedia(item) && !kitConsumidoItem(item)) {
        try {
          const kit = await consumirKitParaItem(item);
          if (!kit) avisos.push(`AFI ${item.afi}: realizado sin descontar KIT (no había en bodega).`);
        } catch (err) { avisos.push(`AFI ${item.afi}: no se pudo descontar el KIT (${errMsg(err)}).`); }
      }
    }
  }
  return { marcados, agregados, avisos, faltaEn };
};

/** Programa de REPARACIÓN: crea los ítems que faltan para los registros del Historial que lo nombran. */
const agregarFaltantesReparacion = async (prog, afi = '') => {
  const nombre = nombreDePrograma(prog);
  const regs = dbIntervenciones.value.filter(m => upP(m.programaCorrespondiente) === nombre && (!afi || mismoEquipo(m.afi, afi)));
  const porAfi = new Map();
  regs.forEach(m => { const k = upP(limpiarAfi(m.afi)); if (k) (porAfi.get(k) || porAfi.set(k, []).get(k)).push(m); });
  let n = 0;
  for (const [k, ms] of porAfi) {
    const items = obtenerItemsPrograma(prog.id).filter(i => mismoEquipo(i.afi, k));
    const faltan = ms.sort((a, b) => String(normalizarFecha(a.fecha)).localeCompare(String(normalizarFecha(b.fecha))) || (a.id - b.id)).slice(items.length);
    for (const m of faltan) {
      const fecha = normalizarFecha(m.fecha) || null;
      const payload = { programa_id: prog.id, afi: limpiarAfi(m.afi), tipo: 'Reparación', nave: null, condicion: 'Arriendo',
        fecha_programada: fecha, fecha_inicio: fecha, fecha_fin: fecha, realizado: false };
      const data = await sb(supabaseClient.from(TABLA_PROGRAMAS_ITEMS).insert([payload]).select());
      if (data && data[0]) dbProgramasItems.value.push(data[0]);
      n++;
    }
  }
  return n;
};

/** Botón del programa: sincroniza todo el programa con el Historial. */
export const sincronizandoPrograma = ref(false);
export const sincronizarProgramaSeleccionado = async (prog) => {
  if (!soloEditor() || !prog || !prog.id) return;
  sincronizandoPrograma.value = true;
  try {
    const { marcados, agregados, avisos } = await sincronizarProgramaConHistorial({ programaId: prog.id });
    alert(`${agregados ? agregados + ' equipo(s) agregados al programa desde el Historial.\n' : ''}${marcados ? marcados + ' equipo(s) marcados como REALIZADOS según el Historial.' : (agregados ? '' : 'Todo estaba al día con el Historial.')}` + (avisos.length ? '\n\nAvisos:\n' + avisos.join('\n') : ''));
  } finally {
    sincronizandoPrograma.value = false;
  }
};
