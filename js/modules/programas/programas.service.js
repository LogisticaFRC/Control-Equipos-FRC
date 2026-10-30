// =====================================================================
// PROGRAMAS · Lógica (programas de Reparación / Mantención, Gantt, asignaciones)
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { dbProgramasCalendarios, dbProgramasItems, cargarDatosDesdeSupabase, obtenerDetalleEquipoPorAfi, soloAdmin, soloEditor } from '../../core/store.js';
import { normalizarFecha, formatDateForDisplay, parseNum, limpiarAfi, esFechaEnRango, hoyISO } from '../../core/utils.js';

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

// ---------- Crear / eliminar programa ----------
export const showModalPrograma = ref(false);
export const formProgMes = ref({ carpeta: 'REPARACION', nombre_programa: '', fecha_inicio_programa: '', fecha_termino_programa: '' });

export const abrirModalCrearPrograma = (tipoCarpeta) => {
  formProgMes.value = { carpeta: tipoCarpeta, nombre_programa: '', fecha_inicio_programa: '2026-08-01', fecha_termino_programa: '2026-09-30' };
  showModalPrograma.value = true;
};

export const guardarNuevoProgramaMes = async () => {
  if (!soloAdmin()) return;
  const { carpeta: cp, fecha_inicio_programa: f_ini, fecha_termino_programa: f_fin } = formProgMes.value;
  const nom = formProgMes.value.nombre_programa.trim().toUpperCase();
  if (!nom || !f_ini || !f_fin) return;
  if (f_fin < f_ini) return alert("La fecha de término no puede ser anterior a la de inicio.");
  const payload = { tipo: cp, carpeta: cp, nombre_programa: nom, mes: nom, fecha_inicio_programa: f_ini, fecha_termino_programa: f_fin };
  try {
    const data = await sb(supabaseClient.from(TABLA_PROGRAMAS).insert([payload]).select());
    await cargarDatosDesdeSupabase();
    showModalPrograma.value = false;
    if (data && data[0]) seleccionarProgramaObj(data[0]);
    alert(`¡Programa "${nom}" guardado permanentemente en ${cp}!`);
  } catch (err) {
    alert("Error de Supabase al guardar programa: " + errMsg(err));
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
export const insertarItemPrograma = async ({ programa_id, afi, tipo, nave, condicion, fechaInicio, fechaFin }) => {
  const prog = obtenerProgObj(programa_id);
  const esMant = esProgramaMantencion(prog);
  const payload = {
    programa_id,
    afi: limpiarAfi(afi),
    tipo: esMant ? 'Mantención' : tipo,
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
export const formAsignar = ref({ programa_id: '', afi: '', tipo: 'Reparación', nave: 'NAVE 1', condicion: 'Arriendo', fecha_programada: '', fecha_fin: '' });

export const abrirModalAsignarEquipo = () => {
  const selProg = obtenerProgObj(progSelect.value.id) || dbProgramasCalendarios.value[0];
  formAsignar.value = {
    programa_id: selProg ? selProg.id : '',
    afi: '',
    tipo: esProgramaMantencion(selProg) ? 'Mantención' : 'Reparación',
    nave: 'NAVE 1',
    condicion: 'Arriendo',
    fecha_programada: selProg ? selProg.fecha_inicio_programa : hoyISO(),
    fecha_fin: selProg ? selProg.fecha_termino_programa : hoyISO()
  };
  showModalAsignarEquipo.value = true;
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
  try {
    const prog = await insertarItemPrograma({
      programa_id: f.programa_id, afi: f.afi, tipo: f.tipo, nave: f.nave, condicion: f.condicion,
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
export const cambiarEstadoRealizadoItem = async (item) => {
  if (!soloEditor()) return;
  try {
    await sb(supabaseClient.from(TABLA_PROGRAMAS_ITEMS).update({ realizado: item.realizado }).eq('id', item.id));
  } catch (err) {
    item.realizado = !item.realizado; // revierte el switch
    alert("No se pudo actualizar el estado: " + errMsg(err));
  }
};

let avisoHorometroMostrado = false;
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

// ---------- Exportar Gantt a Excel ----------
export const exportarProgramaGanttExcel = (prog) => {
  if (!prog || !prog.id) return alert("Selecciona un programa primero.");
  if (!window.XLSX) return alert("Librería SheetJS no disponible.");
  const wb = XLSX.utils.book_new();
  const det = obtenerDetalleEquipoPorAfi;

  if (esProgramaMantencion(prog)) {
    const rows = obtenerItemsPrograma(prog.id).map(item => ({
      "EQUIPO AFI": `AFI ${item.afi}`,
      "TIPO EQUIPO": det(item.afi, 'tipo'),
      "MARCA / MODELO": `${det(item.afi, 'marca')} ${det(item.afi, 'modelo')}`,
      "FECHA PROGRAMADA (FIJA)": formatDateForDisplay(item.fecha_programada),
      "FECHA REALIZADA": formatDateForDisplay(item.fecha_fin),
      "HORÓMETRO REALIZADO": item.horometro ? `${item.horometro} hrs` : '-',
      "ESTADO": item.realizado ? 'REALIZADO' : 'PENDIENTE'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Mantencion");
  } else {
    const diasArr = generarDiasDelPrograma(prog);
    NAVES.forEach(nave => {
      const items = obtenerItemsProgramaPorNave(prog.id, nave);
      if (items.length === 0) return;
      const rows = items.map(item => {
        const rowObj = {
          "TIPO EQUIPO": det(item.afi, 'tipo'),
          "AFI": `AFI ${item.afi}`,
          "MARCA": det(item.afi, 'marca'),
          "MODELO": det(item.afi, 'modelo'),
          "CONDICIÓN": item.condicion || 'Arriendo',
          "INICIO": formatDateForDisplay(item.fecha_inicio),
          "FIN": formatDateForDisplay(item.fecha_fin),
          "ESTADO": item.realizado ? 'REPARADO (ON)' : 'PENDIENTE (OFF)'
        };
        diasArr.forEach(d => { rowObj[d.fechaStr] = esFechaEnRango(d.fechaStr, item.fecha_inicio, item.fecha_fin) ? "●" : ""; });
        return rowObj;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), nave.replace(' ', '_'));
    });

    const fueraRango = obtenerItemsFueraDeRangoPrograma(prog.id);
    if (fueraRango.length > 0) {
      const rowsFuera = fueraRango.map(item => ({
        "AFI": `AFI ${item.afi}`,
        "TIPO EQUIPO": det(item.afi, 'tipo'),
        "NAVE": item.nave || 'NAVE 1',
        "INICIO": formatDateForDisplay(item.fecha_inicio),
        "FIN": formatDateForDisplay(item.fecha_fin),
        "OBSERVACIÓN": "Fuera de vigencia del programa"
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsFuera), "Fuera_De_Rango");
    }
  }
  if (!wb.SheetNames.length) return alert("El programa no tiene equipos asignados.");
  XLSX.writeFile(wb, `Programa_${prog.nombre_programa || prog.mes}.xlsx`);
};
