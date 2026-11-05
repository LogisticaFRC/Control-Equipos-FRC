// =====================================================================
// TALLER · Naves de reparación (Programas Reparación → Taller)
// ---------------------------------------------------------------------
// Pensado para el PC del taller: tarjetas grandes por NAVE con la foto del equipo,
// su OT y el % de avance (actividades de la OT terminadas). Los mecánicos marcan
// las actividades en el momento.
//
// Tabla bd_taller_reparaciones (sql/taller.sql) → una fila por equipo que entra a reparar:
//   · del programa de reparación (programa_id + programa_item_id)
//   · o "sin programa" (programa_id vacío) → lista "Equipos reparación sin programa"
//   estado: ESPERA (por ingresar) · EN_NAVE · FALTANTES (salió sin terminar) · LISTO (reparado)
// bd_ot.reparacion_id → OT enlazada a la reparación.
//
// Actividad TERMINADA = tiene fecha de término (f_term) en la OT (igual que en el formato en papel).
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { TABLAS } from '../../core/tablas.js';
import { usuarioActivo, dbProgramasCalendarios, dbProgramasItems, buscarEquipoPorAfi, soloEditor, soloAdmin } from '../../core/store.js';
import { hoyISO, limpiarAfi, mismoAfi, normalizarFecha, formatDateForDisplay, placeholderImg } from '../../core/utils.js';
import { NAVES, carpetaDe, obtenerItemsPrograma, obtenerProgObj } from '../programas/programas.service.js';
import { TABLA_INVENTARIO } from '../inventario/inventario.mapper.js';
import { dbOT, cargarOT, otVacia, mapOT, payloadOT, folioSugerido, N_ACTIVIDADES, TABLA_OT } from '../ot/ot.service.js';

const { ref, computed } = Vue;

export const TABLA_TALLER = TABLAS.TALLER;
export { NAVES };

export const ESTADO_REP = { ESPERA: 'ESPERA', EN_NAVE: 'EN_NAVE', FALTANTES: 'FALTANTES', LISTO: 'LISTO' };
export const ETIQUETA_ESTADO = {
  PENDIENTE: 'Por ingresar', ESPERA: 'En espera', EN_NAVE: 'En nave', FALTANTES: 'Con faltantes', LISTO: 'Listo / Reparado'
};
export const ESTILO_ESTADO = {
  PENDIENTE: 'bg-slate-100 text-slate-700 border-slate-300',
  ESPERA: 'bg-sky-100 text-sky-800 border-sky-300',
  EN_NAVE: 'bg-amber-100 text-amber-900 border-amber-300',
  FALTANTES: 'bg-rose-100 text-rose-800 border-rose-300',
  LISTO: 'bg-emerald-100 text-emerald-800 border-emerald-300'
};

const SQL_AVISO = 'Falta ejecutar sql/taller.sql en Supabase (SQL Editor → Run). Crea la tabla bd_taller_reparaciones y el enlace de las OT.';

// ---------- Estado ----------
export const dbReparaciones = ref([]);
export const cargandoTaller = ref(false);
export const faltaTablaTaller = ref(false);
export const ultimaActualizacion = ref(null);
/** Pestaña del módulo Programas Reparación: 'taller' | 'programas'. */
export const vistaReparacion = ref('taller');
/** Programa de reparación que se usa en el taller para recomendar equipos (vacío = el vigente). */
export const programaTallerId = ref('');

const mapRep = (r) => ({
  ...r,
  afi: String(r.afi || ''),
  nave: r.nave ? String(r.nave).toUpperCase() : null,
  estado: String(r.estado || ESTADO_REP.ESPERA).toUpperCase(),
  faltante: r.faltante || '',
  historial: Array.isArray(r.historial) ? r.historial : []
});

export const cargarReparaciones = async () => {
  try {
    const data = await sb(supabaseClient.from(TABLA_TALLER).select('*').order('id', { ascending: true }));
    dbReparaciones.value = data.map(mapRep);
    faltaTablaTaller.value = false;
  } catch (err) {
    if (/bd_taller_reparaciones|schema cache|does not exist/i.test(errMsg(err))) faltaTablaTaller.value = true;
    else console.warn('[Taller] No se pudo leer:', errMsg(err));
  }
};

/** Recarga reparaciones + OT (lo usa el refresco automático y el botón Actualizar). */
export const recargarTaller = async () => {
  cargandoTaller.value = true;
  try {
    await Promise.all([cargarReparaciones(), cargarOT(), cargarProblemas()]);
    ultimaActualizacion.value = new Date();
  } finally { cargandoTaller.value = false; }
};

// ---------- Programa de reparación del taller ----------
const ini = (p) => normalizarFecha(p.fecha_inicio_programa) || '';
const fin = (p) => normalizarFecha(p.fecha_termino_programa) || '';
export const programaVigente = (p) => { const h = hoyISO(); return ini(p) <= h && h <= fin(p); };

export const programasReparacion = computed(() => dbProgramasCalendarios.value
  .filter(p => carpetaDe(p) === 'REPARACION')
  .sort((a, b) => ini(b).localeCompare(ini(a))));

export const programaTaller = computed(() =>
  obtenerProgObj(programaTallerId.value) || programasReparacion.value.find(programaVigente) || programasReparacion.value[0] || null);

export const nombreProg = (p) => (p ? (p.nombre_programa || p.mes || 'Programa') : '');
export const nombreProgId = (id) => nombreProg(obtenerProgObj(id));

// ---------- Consultas ----------
export const repEnNave = (nave) => dbReparaciones.value.find(r => r.estado === ESTADO_REP.EN_NAVE && r.nave === nave) || null;
export const repDeItem = (item) => dbReparaciones.value.find(r => r.programa_item_id != null && String(r.programa_item_id) === String(item.id)) || null;
export const repActivaAfi = (afi) => dbReparaciones.value.find(r => mismoAfi(r.afi, afi) && r.estado !== ESTADO_REP.LISTO) || null;
export const repPorId = (id) => dbReparaciones.value.find(r => String(r.id) === String(id)) || null;
export const itemDeRep = (rep) => (rep && rep.programa_item_id != null ? dbProgramasItems.value.find(i => String(i.id) === String(rep.programa_item_id)) : null) || null;
export const navesLibres = computed(() => NAVES.filter(n => !repEnNave(n)));
export const naveDeAfi = (afi) => (dbReparaciones.value.find(r => r.estado === ESTADO_REP.EN_NAVE && mismoAfi(r.afi, afi)) || {}).nave || null;

/** Equipo del inventario, foto y datos para mostrar. */
export const equipoDe = (afi) => buscarEquipoPorAfi(afi) || buscarEquipoPorAfi(limpiarAfi(afi)) || null;
export const fotoDe = (afi) => { const e = equipoDe(afi) || {}; return e.foto || placeholderImg(String(e.tipo || 'SIN FOTO').slice(0, 22), 600, 360); };
export const descEquipo = (afi) => { const e = equipoDe(afi); return e ? [e.tipo, e.marca, e.modelo].filter(Boolean).join(' · ') : 'No está en el inventario'; };

// ---------- OT y avance ----------
export const actividadHecha = (a) => Boolean(String(a?.f_term || '').trim());
export const otsDeRep = (rep) => (rep ? dbOT.value
  .filter(o => o.reparacion_id != null && String(o.reparacion_id) === String(rep.id) && o.estado !== 'ANULADA')
  .sort((a, b) => Number(b.folio) - Number(a.folio)) : []);
/** OT principal (la más reciente) de una reparación. */
export const otPrincipal = (rep) => otsDeRep(rep)[0] || null;
/** Actividades con descripción de todas las OT de la reparación: [{ ot, i, a }]. */
export const actividadesRep = (rep) => otsDeRep(rep).flatMap(ot => ot.actividades.map((a, i) => ({ ot, i, a })).filter(x => String(x.a.descripcion || '').trim()));
export const pendientesRep = (rep) => actividadesRep(rep).filter(x => !actividadHecha(x.a));

/** Avance de una reparación: { pct, done, total, sinOT }. */
export const progresoRep = (rep) => {
  if (!rep) return { pct: 0, done: 0, total: 0, sinOT: true };
  const acts = actividadesRep(rep);
  const done = acts.filter(x => actividadHecha(x.a)).length;
  const total = acts.length;
  if (rep.estado === ESTADO_REP.LISTO) return { pct: 100, done, total, sinOT: !otsDeRep(rep).length };
  return { pct: total ? Math.round(done / total * 100) : 0, done, total, sinOT: !otsDeRep(rep).length };
};
export const colorAvance = (pct) => (pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-sky-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-300');
export const textoAvance = (pct) => (pct >= 100 ? 'text-emerald-600' : pct >= 50 ? 'text-sky-600' : pct > 0 ? 'text-amber-600' : 'text-slate-400');

/** Días (o horas) desde que entró a la nave. */
export const tiempoEnNave = (rep) => {
  if (!rep || !rep.fecha_ingreso) return '';
  const ms = Date.now() - new Date(rep.fecha_ingreso).getTime();
  if (isNaN(ms) || ms < 0) return '';
  const min = Math.floor(ms / 60000);
  if (min < 60) return min < 2 ? 'Recién ingresado' : `${min} min en nave`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h en nave`;
  const d = Math.floor(h / 24);
  return `${d} día${d === 1 ? '' : 's'} en nave`;
};

// ---------- Programa: estado de cada equipo y recomendados ----------
/** Estado de un ítem del programa en el taller: PENDIENTE · ESPERA · EN_NAVE · FALTANTES · LISTO */
export const estadoItemTaller = (item) => {
  const rep = repDeItem(item);
  if (rep && rep.estado === ESTADO_REP.EN_NAVE) return 'EN_NAVE';
  if (item.realizado || (rep && rep.estado === ESTADO_REP.LISTO)) return 'LISTO';
  if (rep && rep.estado === ESTADO_REP.FALTANTES) return 'FALTANTES';
  if (rep && rep.estado === ESTADO_REP.ESPERA) return 'ESPERA';
  return 'PENDIENTE';
};
const fechaIni = (i) => normalizarFecha(i.fecha_inicio || i.fecha_programada) || '9999-12-31';
const naveItem = (i) => String(i.nave || 'NAVE 1').toUpperCase();
export const naveProgramada = naveItem;
/** Le toca: su fecha de inicio ya llegó. */
export const leToca = (item) => fechaIni(item) <= hoyISO();

/** Equipos del programa que se pueden ingresar (no listos, no en nave), recomendados primero para la nave indicada. */
export const candidatosPrograma = (nave = null) => {
  const prog = programaTaller.value;
  if (!prog) return [];
  return obtenerItemsPrograma(prog.id)
    .filter(i => ['PENDIENTE', 'ESPERA', 'FALTANTES'].includes(estadoItemTaller(i)) && !naveDeAfi(i.afi))
    .map(i => ({ item: i, estado: estadoItemTaller(i), recomendado: Boolean(nave) && naveItem(i) === nave && leToca(i), mismaNave: Boolean(nave) && naveItem(i) === nave, toca: leToca(i) }))
    .sort((a, b) => (b.recomendado - a.recomendado) || (b.mismaNave - a.mismaNave) || (b.toca - a.toca) || fechaIni(a.item).localeCompare(fechaIni(b.item)));
};
/** Primer recomendado para una nave vacía (se muestra en la tarjeta). */
export const recomendadoParaNave = (nave) => candidatosPrograma(nave).find(c => c.recomendado) || null;

/** Resumen del programa del taller por columnas. */
export const resumenPrograma = computed(() => {
  const out = { PENDIENTE: [], EN_NAVE: [], FALTANTES: [], LISTO: [] };
  const prog = programaTaller.value;
  if (!prog) return out;
  obtenerItemsPrograma(prog.id).forEach(i => {
    const e = estadoItemTaller(i);
    (out[e === 'ESPERA' ? 'PENDIENTE' : e] || out.PENDIENTE).push(i);
  });
  out.PENDIENTE.sort((a, b) => (leToca(b) - leToca(a)) || fechaIni(a).localeCompare(fechaIni(b)));
  return out;
});
export const totalPrograma = computed(() => { const r = resumenPrograma.value; return r.PENDIENTE.length + r.EN_NAVE.length + r.FALTANTES.length + r.LISTO.length; });
export const pctPrograma = computed(() => (totalPrograma.value ? Math.round(resumenPrograma.value.LISTO.length / totalPrograma.value * 100) : 0));

/** "Equipos reparación sin programa" (todavía no listos). */
export const repsSinPrograma = computed(() => dbReparaciones.value.filter(r => r.programa_id == null && r.estado !== ESTADO_REP.LISTO));
/** Equipos que salieron de nave sin terminar (de cualquier programa o sin programa). */
export const repsConFaltantes = computed(() => dbReparaciones.value.filter(r => r.estado === ESTADO_REP.FALTANTES));
/** Reparados en los últimos 30 días (taller completo). */
export const repsListosRecientes = computed(() => {
  const limite = Date.now() - 30 * 86400000;
  return dbReparaciones.value.filter(r => r.estado === ESTADO_REP.LISTO && r.fecha_salida && new Date(r.fecha_salida).getTime() >= limite)
    .sort((a, b) => String(b.fecha_salida).localeCompare(String(a.fecha_salida)));
});
/** Otras reparaciones en espera que no están en el programa del taller (para el modal de ingreso). */
export const repsEnEsperaFueraDelPrograma = computed(() => {
  const progId = programaTaller.value ? String(programaTaller.value.id) : null;
  return dbReparaciones.value.filter(r => [ESTADO_REP.ESPERA, ESTADO_REP.FALTANTES].includes(r.estado) && String(r.programa_id ?? '') !== progId);
});
/** OT enlazadas al taller. */
export const otsTaller = computed(() => dbOT.value.filter(o => o.reparacion_id != null && o.estado !== 'ANULADA'));
export const ubicacionRep = (rep) => {
  if (!rep) return '-';
  if (rep.estado === ESTADO_REP.EN_NAVE) return rep.nave;
  return ETIQUETA_ESTADO[rep.estado] || rep.estado;
};

// ---------- Guardar ----------
const quien = () => { const u = usuarioActivo.value; return (u && (u.nombre || u.usuario)) || ''; };
const evento = (rep, ev) => [...(rep.historial || []), { fecha: new Date().toISOString(), quien: quien(), ...ev }];
const ahoraHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

const avisoError = (err, accion) => {
  const m = errMsg(err);
  if (/bd_taller_reparaciones|schema cache|does not exist|reparacion_id/i.test(m)) { faltaTablaTaller.value = true; alert(SQL_AVISO); }
  else if (/duplicate|unique|bd_taller_rep_nave_unica/i.test(m)) alert('Esa nave ya fue ocupada desde otro equipo/PC. Se actualizó la vista.');
  else alert(`No se pudo ${accion}: ` + m);
};

const insertarRep = async (payload) => {
  const [fila] = await sb(supabaseClient.from(TABLA_TALLER).insert([{ ...payload, creado_por: quien() }]).select());
  const r = mapRep(fila);
  dbReparaciones.value.push(r);
  return r;
};
const actualizarRep = async (rep, cambios) => {
  await sb(supabaseClient.from(TABLA_TALLER).update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', rep.id));
  Object.assign(rep, mapRep({ ...rep, ...cambios }));
};
/** Cambia la disponibilidad del equipo en el Inventario (no detiene la acción si falla). */
const fijarDisponibilidad = async (afi, valor) => {
  const eq = equipoDe(afi);
  if (!eq) return;
  try {
    await sb(supabaseClient.from(TABLA_INVENTARIO).update({ disponibilidad: valor }).eq('id', eq.id));
    eq.disponibilidad = valor;
  } catch (err) { console.warn('[Taller] No se pudo cambiar la disponibilidad:', errMsg(err)); }
};

/** Reparación para un ítem del programa (la crea si no existe). */
export const asegurarRepDeItem = async (item) => {
  const existente = repDeItem(item);
  if (existente) return existente;
  return insertarRep({ afi: limpiarAfi(item.afi), programa_id: item.programa_id, programa_item_id: item.id, estado: ESTADO_REP.ESPERA });
};

/** Agrega un AFI a "Equipos reparación sin programa" (sin nave). Devuelve la reparación. */
export const agregarSinPrograma = async (afiTexto) => {
  if (!soloEditor()) return null;
  const eq = equipoDe(String(afiTexto || '').trim());
  if (!eq) { alert(`El AFI "${afiTexto}" no está en el Inventario.`); return null; }
  const activa = repActivaAfi(eq.afi);
  if (activa) {
    alert(`El AFI ${eq.afi} ya está en el taller (${ubicacionRep(activa)}${activa.programa_id ? ' · programa ' + nombreProgId(activa.programa_id) : ' · sin programa'}).`);
    return activa;
  }
  try { return await insertarRep({ afi: eq.afi, programa_id: null, programa_item_id: null, estado: ESTADO_REP.ESPERA }); }
  catch (err) { avisoError(err, 'agregar el equipo'); return null; }
};

/**
 * Ingresa un equipo a una nave. origen = { item } (programa) · { rep } (en espera / faltantes) · { afi } (equipo nuevo, sin programa).
 */
export const ingresarANave = async (nave, origen) => {
  if (!soloEditor()) return false;
  await cargarReparaciones();   // por si otro PC ocupó la nave
  if (repEnNave(nave)) { alert(`La ${nave} ya está ocupada.`); return false; }
  try {
    // tras recargar, se usa el registro nuevo (no la copia anterior)
    let rep = origen.rep ? repPorId(origen.rep.id) : null;
    if (origen.item) rep = await asegurarRepDeItem(origen.item);
    if (origen.afi) {
      const eq = equipoDe(String(origen.afi).trim());
      if (!eq) { alert(`El AFI "${origen.afi}" no está en el Inventario.`); return false; }
      rep = repActivaAfi(eq.afi) || await insertarRep({ afi: eq.afi, programa_id: null, programa_item_id: null, estado: ESTADO_REP.ESPERA });
    }
    if (!rep) return false;
    if (rep.estado === ESTADO_REP.EN_NAVE) { alert(`El AFI ${rep.afi} ya está en la ${rep.nave}.`); return false; }
    const eqAntes = equipoDe(rep.afi);
    await actualizarRep(rep, {
      nave, estado: ESTADO_REP.EN_NAVE, fecha_ingreso: new Date().toISOString(), fecha_salida: null,
      // se guarda cómo estaba antes, para poder deshacer con "Sacar por error / prueba"
      historial: evento(rep, { tipo: 'INGRESO', nave, estado_anterior: rep.estado, fecha_salida_anterior: rep.fecha_salida || null, disp_anterior: eqAntes ? (eqAntes.disponibilidad || '') : '' })
    });
    await fijarDisponibilidad(rep.afi, 'En Mantencion');
    return true;
  } catch (err) {
    avisoError(err, 'ingresar el equipo');
    await cargarReparaciones();
    return false;
  }
};

/**
 * Saca un equipo de la nave.
 *  reparado = true  → LISTO: queda DISPONIBLE en el Inventario y REPARADO en el programa.
 *  reparado = false → FALTANTES: se guarda lo que le falta (y opcionalmente se agrega como actividades pendientes en la OT).
 */
export const sacarDeNave = async (rep, { reparado, faltante = '', agregarAOT = true }) => {
  if (!soloEditor()) return false;
  const nave = rep.nave;
  try {
    if (reparado) {
      await actualizarRep(rep, {
        nave: null, estado: ESTADO_REP.LISTO, fecha_salida: new Date().toISOString(), faltante: null,
        historial: evento(rep, { tipo: 'SALIDA', nave, reparado: true })
      });
      const item = itemDeRep(rep);
      if (item && !item.realizado) {
        try { await sb(supabaseClient.from(TABLAS.PROGRAMAS_ITEMS).update({ realizado: true }).eq('id', item.id)); item.realizado = true; }
        catch (err) { alert('El equipo salió, pero no se pudo marcar REPARADO en el programa: ' + errMsg(err)); }
      }
      await fijarDisponibilidad(rep.afi, 'Disponible');
    } else {
      const txt = String(faltante || '').trim();
      if (!txt) { alert('Escribe qué le falta al equipo.'); return false; }
      await actualizarRep(rep, {
        nave: null, estado: ESTADO_REP.FALTANTES, fecha_salida: new Date().toISOString(), faltante: txt,
        historial: evento(rep, { tipo: 'SALIDA', nave, reparado: false, faltante: txt })
      });
      if (agregarAOT) await agregarFaltantesAOT(rep, txt);
    }
    return true;
  } catch (err) { avisoError(err, 'sacar el equipo'); return false; }
};

/**
 * SACAR POR ERROR / PRUEBA (solo Admin): deshace el último ingreso a la nave.
 * No marca reparado ni faltantes: el equipo vuelve a como estaba antes de entrar (estado y disponibilidad del Inventario).
 * Si la reparación se había creado solo para ese ingreso (sin OT, sin problemas, sin otros movimientos), se borra.
 */
export const sacarPorError = async (rep) => {
  if (!soloAdmin()) return false;
  if (!confirm(`¿Sacar el AFI ${rep.afi} de la ${rep.nave} POR ERROR / PRUEBA?\n\nNo se marca reparado ni con faltantes: vuelve a como estaba antes de entrar.`)) return false;
  const ingreso = [...(rep.historial || [])].reverse().find(e => e.tipo === 'INGRESO') || {};
  const nave = rep.nave;
  try {
    const sinNadaMas = !otsDeRep(rep).length && !problemasDeRep(rep).length && (rep.historial || []).length <= 1;
    if (sinNadaMas) {
      await sb(supabaseClient.from(TABLA_TALLER).delete().eq('id', rep.id));
      dbReparaciones.value = dbReparaciones.value.filter(r => r.id !== rep.id);
    } else {
      await actualizarRep(rep, {
        nave: null, estado: ingreso.estado_anterior && ingreso.estado_anterior !== ESTADO_REP.EN_NAVE ? ingreso.estado_anterior : ESTADO_REP.ESPERA,
        fecha_ingreso: null, fecha_salida: ingreso.fecha_salida_anterior || null,
        historial: evento(rep, { tipo: 'SALIDA_ERROR', nave })
      });
    }
    if (ingreso.disp_anterior) await fijarDisponibilidad(rep.afi, ingreso.disp_anterior);
    return true;
  } catch (err) { avisoError(err, 'sacar el equipo'); return false; }
};

/** Quita una reparación del taller (solo Admin). Las OT quedan, pero sin enlace. */
export const quitarReparacion = async (rep) => {
  if (!soloAdmin()) return;
  if (rep.estado === ESTADO_REP.EN_NAVE) return alert('Primero saca el equipo de la nave.');
  if (!confirm(`¿Quitar el AFI ${rep.afi} de la lista del taller?\nSus OT no se borran (solo pierden el enlace).`)) return;
  try {
    const ots = otsDeRep(rep);
    if (ots.length) await sb(supabaseClient.from(TABLA_OT).update({ reparacion_id: null }).eq('reparacion_id', rep.id));
    ots.forEach(o => { o.reparacion_id = null; });
    await sb(supabaseClient.from(TABLA_TALLER).delete().eq('id', rep.id));
    dbReparaciones.value = dbReparaciones.value.filter(r => r.id !== rep.id);
  } catch (err) { avisoError(err, 'quitar el equipo'); }
};

// ---------- OT desde el taller ----------
const guardarActividades = async (ot) => {
  await sb(supabaseClient.from(TABLA_OT).update({ actividades: ot.actividades, updated_at: new Date().toISOString() }).eq('id', ot.id));
};
/** Crea una OT enlazada a la reparación (folio manual, tipo CORRECTIVA). */
export const crearOTParaRep = async (rep, { folio, tipo = 'CORRECTIVA', mecanico = '' } = {}) => {
  if (!soloAdmin()) return null;   // el mecánico no crea OT: la une con una ya creada
  const n = Number(String(folio ?? '').replace(/\D/g, ''));
  if (!n) { alert('Escribe el N° de FOLIO de la OT.'); return null; }
  const repetida = dbOT.value.find(o => Number(o.folio) === n);
  if (repetida) { alert(`Ya existe la OT N° ${n} (AFI ${repetida.afi}). Usa otro folio.`); return null; }
  const ot = otVacia();
  const eq = equipoDe(rep.afi);
  Object.assign(ot, {
    folio: n, fecha: hoyISO(), afi: rep.afi, tipo_mantencion: tipo, mecanico, reparacion_id: rep.id,
    equipo: eq ? eq.tipo : '', marca: eq ? eq.marca : '', modelo: eq ? eq.modelo : '',
    hrs_actual: eq && eq.horometroActual ? String(Math.round(eq.horometroActual * 10) / 10) : ''
  });
  // Lo que le faltaba (si volvió a la nave) entra como actividades
  lineas(rep.faltante).slice(0, N_ACTIVIDADES).forEach((t, i) => { ot.actividades[i].descripcion = t; ot.actividades[i].f_inicio = hoyISO(); });
  try {
    const [fila] = await sb(supabaseClient.from(TABLA_OT).insert([{ ...payloadOT(ot), creado_por: quien() + ' (taller)' }]).select());
    const nueva = mapOT(fila);
    dbOT.value.unshift(nueva);
    return nueva;
  } catch (err) {
    if (/duplicate|unique/i.test(errMsg(err))) alert(`Ya existe otra OT con el folio ${n}.`);
    else avisoError(err, 'crear la OT');
    return null;
  }
};
/** Enlaza una OT existente (del mismo AFI) a la reparación. */
export const enlazarOTExistente = async (rep, ot) => {
  if (!soloEditor()) return;
  try {
    await sb(supabaseClient.from(TABLA_OT).update({ reparacion_id: rep.id }).eq('id', ot.id));
    ot.reparacion_id = rep.id;
  } catch (err) { avisoError(err, 'enlazar la OT'); }
};
/** OT del AFI que todavía no están enlazadas al taller (para enlazarlas desde la nave). */
export const otsLibresDelAfi = (afi) => dbOT.value.filter(o => mismoAfi(o.afi, afi) && o.reparacion_id == null && o.estado !== 'ANULADA');

/** Marca / desmarca una actividad como terminada (fecha y hora de término = ahora). */
export const alternarActividad = async (ot, i) => {
  if (!soloEditor()) return;
  const a = ot.actividades[i];
  const antes = { ...a };
  if (actividadHecha(a)) { a.f_term = ''; a.h_term = ''; }
  else { a.f_term = hoyISO(); a.h_term = ahoraHHMM(); if (!a.f_inicio) a.f_inicio = hoyISO(); }
  try { await guardarActividades(ot); }
  catch (err) { Object.assign(a, antes); alert('No se pudo guardar la actividad: ' + errMsg(err)); }
};
/** Agrega una actividad en la primera fila libre de la OT. */
export const agregarActividad = async (ot, descripcion, ejecutante = '') => {
  if (!soloAdmin()) return false;   // el mecánico envía "nuevo problema" y el Admin lo agrega
  const t = String(descripcion || '').trim();
  if (!t) return false;
  const i = ot.actividades.findIndex(a => !String(a.descripcion || '').trim());
  if (i < 0) { alert(`La OT N° ${ot.folio} ya tiene las ${N_ACTIVIDADES} actividades del formato. Crea otra OT para seguir.`); return false; }
  Object.assign(ot.actividades[i], { descripcion: t, ejecutante: String(ejecutante || '').trim(), f_inicio: hoyISO(), h_inicio: ahoraHHMM(), f_term: '', h_term: '' });
  try { await guardarActividades(ot); return true; }
  catch (err) { Object.assign(ot.actividades[i], { descripcion: '', ejecutante: '', f_inicio: '', h_inicio: '' }); alert('No se pudo agregar: ' + errMsg(err)); return false; }
};
/** Quita una actividad (las de abajo suben una fila). */
export const quitarActividad = async (ot, i) => {
  if (!soloAdmin()) return;
  if (!confirm(`¿Quitar la actividad "${ot.actividades[i].descripcion}"?`)) return;
  const copia = JSON.parse(JSON.stringify(ot.actividades));
  const vacia = Object.fromEntries(Object.keys(ot.actividades[i]).map(k => [k, '']));
  ot.actividades.splice(i, 1);
  ot.actividades.push(vacia);
  try { await guardarActividades(ot); }
  catch (err) { ot.actividades.splice(0, ot.actividades.length, ...copia); alert('No se pudo quitar: ' + errMsg(err)); }
};
/** Guarda el ejecutante escrito en una actividad. */
export const guardarEjecutante = async (ot) => {
  if (!soloEditor()) return;
  try { await guardarActividades(ot); } catch (err) { alert('No se pudo guardar: ' + errMsg(err)); }
};

// ---------- Lo que completa el mecánico en la OT ----------
/** Último guardado de la OT en el taller (para mostrar "Guardado ✓"). */
export const guardadoOT = ref({ id: null, hora: '', error: '' });
const SQL_FIRMAS = 'Falta ejecutar sql/taller_firmas_problemas.sql en Supabase (columna firmas de bd_ot y tabla de problemas).';
/**
 * Guarda columnas de la OT: grupo = 'actividades' | 'insumos' | 'personal' | 'pauta' | 'mecanico' | 'supervisor' | 'firmas'.
 * (Se guarda al cambiar cada dato: no hay botón "Guardar").
 */
export const guardarOTTaller = async (ot, ...grupos) => {
  if (!soloEditor()) return false;
  const cambios = Object.fromEntries(grupos.map(g => [g, ot[g] ?? null]));
  try {
    await sb(supabaseClient.from(TABLA_OT).update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', ot.id));
    guardadoOT.value = { id: ot.id, hora: ahoraHHMM(), error: '' };
    return true;
  } catch (err) {
    const m = errMsg(err);
    guardadoOT.value = { id: ot.id, hora: '', error: m };
    alert(/firmas/i.test(m) ? SQL_FIRMAS : 'No se pudo guardar la OT: ' + m);
    return false;
  }
};
/** Firma (imagen) de la OT. clave = 'mecanico' | 'supervisor' | 'per.0'..'per.3'. */
export const firmaDe = (ot, clave) => {
  if (!ot) return '';
  if (clave.startsWith('per.')) return (ot.personal[Number(clave.slice(4))] || {}).firma || '';
  return (ot.firmas && ot.firmas[clave]) || '';
};
export const fijarFirma = async (ot, clave, dataUrl) => {
  if (clave.startsWith('per.')) {
    ot.personal[Number(clave.slice(4))].firma = dataUrl || '';
    return guardarOTTaller(ot, 'personal');
  }
  ot.firmas = { ...(ot.firmas || {}), [clave]: dataUrl || '' };
  return guardarOTTaller(ot, 'firmas');
};
export const alternarPautaOT = (ot, p) => { ot.pauta = ot.pauta === p ? '' : p; return guardarOTTaller(ot, 'pauta'); };

// ---------- "Enviar nuevo problema para OT" (mecánico → Admin) ----------
export const TABLA_PROBLEMAS = TABLAS.TALLER_PROBLEMAS;
export const dbProblemas = ref([]);
export const faltaTablaProblemas = ref(false);
export const cargarProblemas = async () => {
  try {
    const data = await sb(supabaseClient.from(TABLA_PROBLEMAS).select('*').order('id', { ascending: true }));
    dbProblemas.value = data;
    faltaTablaProblemas.value = false;
  } catch (err) {
    if (/bd_taller_problemas|schema cache|does not exist/i.test(errMsg(err))) faltaTablaProblemas.value = true;
    else console.warn('[Taller] No se pudieron leer los problemas:', errMsg(err));
  }
};
export const problemasDeRep = (rep) => (rep ? dbProblemas.value.filter(p => String(p.reparacion_id) === String(rep.id)) : []);
export const problemasPendientesRep = (rep) => problemasDeRep(rep).filter(p => p.estado === 'PENDIENTE');
/** Problemas que el Admin aún no procesa (todo el taller). */
export const problemasPendientes = computed(() => dbProblemas.value.filter(p => p.estado === 'PENDIENTE'));

export const enviarProblema = async (rep, ot, texto) => {
  if (!soloEditor()) return false;
  const t = String(texto || '').trim();
  if (!t) return false;
  try {
    const [fila] = await sb(supabaseClient.from(TABLA_PROBLEMAS).insert([{
      reparacion_id: rep.id, ot_id: ot ? ot.id : null, afi: rep.afi, nave: rep.nave || null, descripcion: t, reportado_por: quien(), estado: 'PENDIENTE'
    }]).select());
    dbProblemas.value.push(fila);
    return true;
  } catch (err) {
    alert(/bd_taller_problemas|schema cache|does not exist/i.test(errMsg(err)) ? SQL_FIRMAS : 'No se pudo enviar: ' + errMsg(err));
    return false;
  }
};
/** Admin: agrega el problema como actividad de la OT (texto editable). */
export const agregarProblemaAOT = async (prob, ot, texto) => {
  if (!soloAdmin()) return false;
  if (!ot) { alert('La reparación no tiene OT. Primero une o crea la OT.'); return false; }
  if (!(await agregarActividad(ot, texto || prob.descripcion, ''))) return false;
  return marcarProblema(prob, 'AGREGADO', `Agregado a la OT ${ot.folio}`, ot.id);
};
export const rechazarProblema = async (prob) => {
  if (!soloAdmin()) return false;
  const motivo = prompt('Motivo (opcional, lo verá el mecánico):', '');
  if (motivo === null) return false;
  return marcarProblema(prob, 'RECHAZADO', motivo);
};
const marcarProblema = async (prob, estado, respuesta, otId = null) => {
  const cambios = { estado, respuesta: respuesta || null, procesado_por: quien(), procesado_at: new Date().toISOString(), ...(otId ? { ot_id: otId } : {}) };
  try { await sb(supabaseClient.from(TABLA_PROBLEMAS).update(cambios).eq('id', prob.id)); Object.assign(prob, cambios); return true; }
  catch (err) { alert('No se pudo actualizar: ' + errMsg(err)); return false; }
};

const lineas = (txt) => String(txt || '').split(/\r?\n/).map(s => s.replace(/^[\s•\-*·]+/, '').trim()).filter(Boolean);
/** Agrega lo que falta como actividades pendientes en la OT principal (las que no estén ya). */
const agregarFaltantesAOT = async (rep, txt) => {
  const ot = otPrincipal(rep);
  if (!ot) return;
  const yaEstan = new Set(ot.actividades.filter(a => !actividadHecha(a)).map(a => String(a.descripcion || '').trim().toUpperCase()));
  let cambio = false;
  for (const t of lineas(txt)) {
    if (yaEstan.has(t.toUpperCase())) continue;
    const i = ot.actividades.findIndex(a => !String(a.descripcion || '').trim());
    if (i < 0) break;
    Object.assign(ot.actividades[i], { descripcion: t, f_inicio: hoyISO(), f_term: '', h_term: '' });
    cambio = true;
  }
  if (cambio) { try { await guardarActividades(ot); } catch (err) { alert('Se guardó lo que falta, pero no se pudo agregar a la OT: ' + errMsg(err)); } }
};
/** Texto sugerido para "¿qué le falta?" = actividades pendientes de la OT. */
export const faltanteSugerido = (rep) => pendientesRep(rep).map(x => '- ' + x.a.descripcion.trim()).join('\n');

// ---------- Enlace desde el módulo OT ----------
/**
 * Opciones para enlazar una OT a una reparación según su AFI:
 *  ítems de programas de REPARACIÓN con ese AFI · reparaciones sin programa · agregar a "sin programa".
 */
export const opcionesEnlaceOT = (afi) => {
  if (!afi) return [];
  const out = [];
  dbProgramasCalendarios.value.filter(p => carpetaDe(p) === 'REPARACION')
    .sort((a, b) => (programaVigente(b) - programaVigente(a)) || ini(b).localeCompare(ini(a)))
    .forEach(p => obtenerItemsPrograma(p.id).filter(i => mismoAfi(limpiarAfi(i.afi), limpiarAfi(afi))).forEach(i => {
      const rep = repDeItem(i);
      out.push({
        valor: 'item:' + i.id,
        etiqueta: `Programa ${nombreProg(p)} · ${naveItem(i)} plan. · ${formatDateForDisplay(i.fecha_inicio)} al ${formatDateForDisplay(i.fecha_fin)}${rep ? ' · ' + ubicacionRep(rep) : ''}${i.realizado ? ' · ✓ reparado' : ''}`,
        repId: rep ? rep.id : null
      });
    }));
  dbReparaciones.value.filter(r => r.programa_id == null && mismoAfi(r.afi, limpiarAfi(afi)))
    .forEach(r => out.push({ valor: 'rep:' + r.id, etiqueta: `Equipos reparación sin programa · ${ubicacionRep(r)}`, repId: r.id }));
  if (!out.some(o => o.valor.startsWith('rep:') && repPorId(o.repId)?.estado !== ESTADO_REP.LISTO)) {
    out.push({ valor: 'nueva', etiqueta: '+ Agregar a "Equipos reparación sin programa"', repId: null });
  }
  return out;
};
/** Valor del selector para la OT abierta. */
export const valorEnlaceOT = (ot) => {
  if (!ot || ot.reparacion_id == null) return '';
  const rep = repPorId(ot.reparacion_id);
  if (!rep) return '';
  return rep.programa_item_id != null ? 'item:' + rep.programa_item_id : 'rep:' + rep.id;
};
/** Aplica la opción elegida a la OT (crea la reparación si hace falta). Si la OT ya está guardada, guarda el enlace al tiro. */
export const enlazarOT = async (ot, valor) => {
  if (!soloEditor()) return;
  try {
    let rep = null;
    if (valor.startsWith('item:')) {
      const item = dbProgramasItems.value.find(i => String(i.id) === valor.slice(5));
      if (item) rep = await asegurarRepDeItem(item);
    } else if (valor.startsWith('rep:')) rep = repPorId(valor.slice(4));
    else if (valor === 'nueva') {
      if (!ot.afi) return alert('Primero escribe el AFI de la OT.');
      rep = await agregarSinPrograma(ot.afi);
      if (!rep) return;
    }
    const nuevoId = rep ? rep.id : null;
    if (ot.id) {
      await sb(supabaseClient.from(TABLA_OT).update({ reparacion_id: nuevoId }).eq('id', ot.id));
      const enLista = dbOT.value.find(o => o.id === ot.id); if (enLista) enLista.reparacion_id = nuevoId;
    }
    ot.reparacion_id = nuevoId;
  } catch (err) { avisoError(err, 'enlazar la OT'); }
};
/** Texto corto del enlace de una OT (lista de OT). */
export const etiquetaTallerOT = (ot) => {
  if (!ot || ot.reparacion_id == null) return '';
  const rep = repPorId(ot.reparacion_id);
  if (!rep) return 'Taller';
  return `${rep.programa_id != null ? nombreProgId(rep.programa_id) : 'Sin programa'} · ${ubicacionRep(rep)}`;
};
