// =====================================================================
// INDICADORES (KPI) · Lógica (2026-11-18)
//   Calcula los indicadores con los datos que el sistema ya tiene en memoria (inventario, historial,
//   movimientos, OT, taller, OC). Al abrir el módulo se bajan además, UNA vez, las tablas livianas que
//   faltan: historial de estados (sql/estado_historico.sql), estandarizaciones, check list de choferes,
//   pedidos de repuestos y taller. Nada se recalcula en el servidor.
// =====================================================================
import { supabaseClient, sb } from '../../core/supabase.js';
import { dbEquipos, dbIntervenciones, dbMovimientos, dbOC } from '../../core/store.js';
import { normalizarFecha, normalizarClave, hoyISO, mismoAfi } from '../../core/utils.js';
import { empresaDe, esVehiculo } from '../inventario/inventario.mapper.js';
import { claseMantencion } from '../../core/horometros.js';
import { esNoFalla } from '../../core/analisis-fallas.js';
import { dbOT } from '../ot/ot.service.js';
import { dbReparaciones, recargarTaller } from '../taller/taller.service.js';
import { pedidosTodos, cargarPedidos } from '../repuestos/pedida.service.js';
import { todosChecklist, cargarTodosChecklist, ITEMS_CHECK } from '../mecanicos/chofer.service.js';

const { ref, computed } = Vue;

// ---------- utilidades ----------
const f10 = (x) => normalizarFecha(x) || String(x || '').slice(0, 10);
const mesDe = (x) => f10(x).slice(0, 7);
const dias = (a, b) => (new Date(b) - new Date(a)) / 864e5;
const prom = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);
const pct = (a, b) => (b ? Math.round(a / b * 1000) / 10 : null);
const horas = (t) => { const s = String(t || '').trim(); if (!s) return 0; const m = s.match(/^(\d+):(\d{1,2})/); if (m) return Number(m[1]) + Number(m[2]) / 60; const n = Number(s.replace(',', '.')); return isFinite(n) ? n : 0; };
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const etiquetaMes = (m) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const inicioMes = (iso, atras) => { const d = new Date(iso + 'T12:00:00'); d.setMonth(d.getMonth() - atras, 1); return d.toISOString().slice(0, 10); };

// ---------- filtros ----------
export const filtro = ref({ desde: inicioMes(hoyISO(), 5), hasta: hoyISO(), empresa: '', tipo: '' });
export const dentro = (fecha) => { const d = f10(fecha); return d && d >= filtro.value.desde && d <= filtro.value.hasta; };
export const mesesPeriodo = computed(() => {
  const out = []; let m = filtro.value.desde.slice(0, 7); const fin = filtro.value.hasta.slice(0, 7);
  for (let i = 0; m <= fin && i < 36; i++) { out.push(m); const d = new Date(m + '-15'); d.setMonth(d.getMonth() + 1); m = d.toISOString().slice(0, 7); }
  return out;
});
export const tiposEquipo = computed(() => [...new Set(dbEquipos.value.filter(e => !esVehiculo(e)).map(e => String(e.tipo || '').trim().toUpperCase()).filter(Boolean))].sort());
export const empresas = computed(() => [...new Set(dbEquipos.value.map(e => empresaDe(e)).filter(Boolean))].sort());
/** Equipos (no vehículos) que cumplen el filtro de tipo y empresa. */
export const equiposF = computed(() => dbEquipos.value.filter(e => !esVehiculo(e)
  && (!filtro.value.tipo || String(e.tipo || '').trim().toUpperCase() === filtro.value.tipo)
  && (!filtro.value.empresa || empresaDe(e) === filtro.value.empresa)));
const afisF = computed(() => new Set(equiposF.value.map(e => String(e.afi).trim().toUpperCase())));
const enFiltro = (afi) => afisF.value.has(String(afi || '').trim().toUpperCase());

// ---------- datos extra (se bajan una vez al abrir el módulo) ----------
export const estadoHist = ref([]);          // bd_equipos_estado_hist
export const estandarizaciones = ref([]);   // bd_estandarizaciones (resumen)
export const faltaHist = ref(false);
export const cargandoKPI = ref(false);
let cargado = false;
export const cargarDatosKPI = async (forzar = false) => {
  if (cargado && !forzar) return;
  cargandoKPI.value = true;
  try {
    const tareas = [
      sb(supabaseClient.from('bd_equipos_estado_hist').select('afi,disponibilidad,empresa,desde').order('desde', { ascending: true }).limit(20000))
        .then(r => { estadoHist.value = r || []; faltaHist.value = false; }).catch(() => { estadoHist.value = []; faltaHist.value = true; }),
      sb(supabaseClient.from('bd_estandarizaciones').select('afi,fecha,cumplimiento,items').order('fecha', { ascending: false }).limit(5000))
        .then(r => { estandarizaciones.value = r || []; }).catch(() => { estandarizaciones.value = []; }),
      cargarTodosChecklist().catch(() => {}),
      cargarPedidos().catch(() => {})
    ];
    if (!dbReparaciones.value.length || !dbOT.value.length) tareas.push(recargarTaller().catch(() => {}));
    await Promise.all(tareas);
    cargado = true;
  } finally { cargandoKPI.value = false; }
};

// =====================================================================
// 1. FLOTA
// =====================================================================
export const ESTADOS_FLOTA = ['Operativo', 'Disponible', 'En Traslado', 'En Mantencion', 'Fuera de Servicio', 'Venta'];
export const flota = computed(() => {
  const eq = equiposF.value, n = eq.length;
  const cuenta = Object.fromEntries(ESTADOS_FLOTA.map(s => [s, 0]));
  eq.forEach(e => { cuenta[e.disponibilidad] = (cuenta[e.disponibilidad] || 0) + 1; });
  const conGps = eq.filter(e => e.gps && !/sin/i.test(e.gps)).length;
  const porTipo = {};
  eq.forEach(e => { const t = String(e.tipo || 'SIN TIPO').toUpperCase(); const o = porTipo[t] || (porTipo[t] = { tipo: t, total: 0, operativo: 0, disponible: 0 }); o.total++; if (e.disponibilidad === 'Operativo') o.operativo++; if (e.disponibilidad === 'Disponible') o.disponible++; });
  return {
    total: n, cuenta,
    disponibilidad: pct(cuenta.Operativo + cuenta.Disponible, n),
    utilizacion: pct(cuenta.Operativo, n),
    gps: pct(conGps, n),
    porTipo: Object.values(porTipo).map(o => ({ ...o, util: pct(o.operativo, o.total), disp: pct(o.operativo + o.disponible, o.total) })).sort((a, b) => b.total - a.total)
  };
});
/** Disponibilidad histórica por mes (promedio diario), con el historial de estados. */
export const dispHistorica = computed(() => {
  const h = estadoHist.value; if (!h.length) return { desde: null, meses: [] };
  const porAfi = new Map();
  h.forEach(r => { const k = String(r.afi).trim().toUpperCase(); if (!enFiltro(k)) return; (porAfi.get(k) || porAfi.set(k, []).get(k)).push({ t: new Date(r.desde).getTime(), ok: ['Operativo', 'Disponible'].includes(normalizarClave(r.disponibilidad)), op: normalizarClave(r.disponibilidad) === 'Operativo' }); });
  const inicio = h[0].desde.slice(0, 10), hoy = hoyISO();
  const meses = mesesPeriodo.value.map(m => {
    let suma = 0, sumaOp = 0, nDias = 0;
    for (let d = new Date(m + '-01T23:59:00'); d.toISOString().slice(0, 7) === m; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10); if (iso < inicio || iso > hoy) continue;
      const t = d.getTime(); let ok = 0, op = 0, tot = 0;
      porAfi.forEach(lista => { let e = null; for (const x of lista) { if (x.t <= t) e = x; else break; } if (e) { tot++; if (e.ok) ok++; if (e.op) op++; } });
      if (tot) { suma += ok / tot; sumaOp += op / tot; nDias++; }
    }
    return { mes: m, disp: nDias ? Math.round(suma / nDias * 1000) / 10 : null, util: nDias ? Math.round(sumaOp / nDias * 1000) / 10 : null, dias: nDias };
  });
  return { desde: inicio, meses };
});

// =====================================================================
// 2. MANTENCIÓN
// =====================================================================
export const intervF = computed(() => dbIntervenciones.value.filter(i => enFiltro(i.afi) && dentro(i.fecha)));
export const mantencion = computed(() => {
  const lista = intervF.value;
  const prev = lista.filter(i => claseMantencion(i) || /PREVENTIV|PREDICTIV/i.test(`${i.tipoMant} ${i.causa}`)).length;
  const TIPOS = ['250 HRS', '500 HRS', '1000 HRS', 'INTERMEDIA'];
  const porMes = mesesPeriodo.value.map(m => {
    const o = { mes: m }; TIPOS.forEach(t => { o[t] = 0; }); o.correctivas = 0;
    lista.filter(i => mesDe(i.fecha) === m).forEach(i => {
      const c = claseMantencion(i);
      if (c === 'INTERMEDIA') o.INTERMEDIA++;
      else if (c) { const t = TIPOS.find(x => String(i.tipoHorasMant || '').toUpperCase().includes(x.split(' ')[0])) || '250 HRS'; o[t]++; }
      else if (!esNoFalla(i)) o.correctivas++;
    });
    return o;
  });
  const hh = {};
  lista.forEach(i => { const h = horas(i.horaTotal); if (!h) return; [i.mec1, i.mec2, i.mec3, i.mec4].filter(Boolean).forEach(m => { const k = String(m).trim().toUpperCase(); hh[k] = (hh[k] || 0) + h; }); });
  const totalHH = Object.values(hh).reduce((s, x) => s + x, 0);
  return { total: lista.length, preventivas: prev, pctPrev: pct(prev, lista.length), porMes, TIPOS,
    hh: Object.entries(hh).map(([mecanico, h]) => ({ mecanico, horas: Math.round(h * 10) / 10 })).sort((a, b) => b.horas - a.horas), totalHH: Math.round(totalHH) };
});

// =====================================================================
// 3. CONFIABILIDAD (MTBF / MTTR)
// =====================================================================
export const confiabilidad = computed(() => {
  const fallas = dbIntervenciones.value.filter(i => enFiltro(i.afi) && !esNoFalla(i));
  const porAfi = new Map();
  fallas.forEach(i => { const k = String(i.afi).trim().toUpperCase(); (porAfi.get(k) || porAfi.set(k, []).get(k)).push(i); });
  const filas = [];
  porAfi.forEach((lista, afi) => {
    const conH = lista.filter(i => i.horometro > 0).sort((a, b) => a.horometro - b.horometro);
    const enPer = lista.filter(i => dentro(i.fecha)).length;
    const difs = [];
    for (let j = 1; j < conH.length; j++) { const d = conH[j].horometro - conH[j - 1].horometro; if (d > 0 && d < 20000) difs.push(d); }
    const e = dbEquipos.value.find(x => mismoAfi(x.afi, afi));
    filas.push({ afi, tipo: e?.tipo || lista[0].equipo || '', fallas: lista.length, fallasPeriodo: enPer, mtbf: difs.length ? Math.round(prom(difs)) : null });
  });
  const conMtbf = filas.filter(f => f.mtbf != null);
  const correctivas = intervF.value.filter(i => !esNoFalla(i)).map(i => horas(i.horaTotal)).filter(h => h > 0 && h < 200);
  const reps = dbReparaciones.value.filter(r => enFiltro(r.afi) && r.fecha_ingreso && r.fecha_salida && dentro(r.fecha_salida)).map(r => dias(r.fecha_ingreso, r.fecha_salida)).filter(d => d >= 0);
  return {
    mtbf: conMtbf.length ? Math.round(prom(conMtbf.map(f => f.mtbf))) : null,
    mttrHoras: correctivas.length ? Math.round(prom(correctivas) * 10) / 10 : null,
    mttrDias: reps.length ? Math.round(prom(reps) * 10) / 10 : null,
    fallasPeriodo: intervF.value.filter(i => !esNoFalla(i)).length,
    peores: conMtbf.sort((a, b) => a.mtbf - b.mtbf).slice(0, 10)
  };
});

// =====================================================================
// 4. TALLER Y OT
// =====================================================================
export const taller = computed(() => {
  const salidas = [];
  dbReparaciones.value.filter(r => enFiltro(r.afi)).forEach(r => (r.historial || []).forEach((ev, i, arr) => {
    if (ev.tipo !== 'SALIDA' || !dentro(ev.fecha)) return;
    const ing = [...arr.slice(0, i)].reverse().find(x => x.tipo === 'INGRESO');
    salidas.push({ afi: r.afi, fecha: f10(ev.fecha), reparado: ev.reparado !== false, faltante: ev.faltante || '', dias: ing ? Math.round(dias(ing.fecha, ev.fecha) * 10) / 10 : null });
  }));
  const conDias = salidas.filter(s => s.dias != null);
  const ots = dbOT.value.filter(o => (!o.afi || enFiltro(o.afi) || !afisF.value.size) && dentro(o.fecha));
  const est = (o) => (o.estado === 'ANULADA' ? 'ANULADA' : o.estado === 'CERRADA' ? 'CERRADA' : 'ABIERTA');
  const porMes = mesesPeriodo.value.map(m => { const l = ots.filter(o => mesDe(o.fecha) === m); return { mes: m, ABIERTA: l.filter(o => est(o) === 'ABIERTA').length, CERRADA: l.filter(o => est(o) === 'CERRADA').length, ANULADA: l.filter(o => est(o) === 'ANULADA').length }; });
  return {
    salidas: salidas.sort((a, b) => b.fecha.localeCompare(a.fecha)), nSalidas: salidas.length,
    diasProm: conDias.length ? Math.round(prom(conDias.map(s => s.dias)) * 10) / 10 : null,
    pctFaltantes: pct(salidas.filter(s => !s.reparado).length, salidas.length),
    ots: ots.length, porMes
  };
});

// =====================================================================
// 5. REPUESTOS Y COSTOS
// =====================================================================
export const repuestos = computed(() => {
  const lista = pedidosTodos.value.filter(p => enFiltro(p.afi));
  const recibidos = lista.filter(p => p.estado === 'RECIBIDO').map(p => {
    const fin = p.origen === 'TALLER' ? (p.raw.nota_at || p.raw.procesado_at) : p.raw.updated_at;
    return fin ? dias(p.fecha, fin) : null;
  }).filter(d => d != null && d >= 0);
  const abiertos = lista.filter(p => ['PENDIENTE', 'PEDIDO'].includes(p.estado));
  const hoy = hoyISO();
  const tramos = [{ t: '0–7 días', n: 0 }, { t: '8–15 días', n: 0 }, { t: '16–30 días', n: 0 }, { t: 'Más de 30', n: 0 }];
  abiertos.forEach(p => { const d = dias(p.fecha, hoy); tramos[d <= 7 ? 0 : d <= 15 ? 1 : d <= 30 ? 2 : 3].n++; });
  // costo por hora: OC del período / horas trabajadas en el período (lecturas de horómetro del historial)
  const costos = equiposF.value.map(e => {
    const oc = dbOC.value.filter(o => mismoAfi(o.afi, e.afi) && dentro(o.fecha)).reduce((s, o) => s + o.precio, 0);
    const hs = dbIntervenciones.value.filter(i => mismoAfi(i.afi, e.afi) && dentro(i.fecha) && i.horometro > 0).map(i => i.horometro);
    const horasTrab = hs.length > 1 ? Math.max(...hs) - Math.min(...hs) : 0;
    return { afi: e.afi, tipo: e.tipo, oc, horas: Math.round(horasTrab), porHora: horasTrab > 0 && oc > 0 ? Math.round(oc / horasTrab) : null };
  }).filter(c => c.oc > 0).sort((a, b) => b.oc - a.oc);
  return { abiertos: abiertos.length, esperaProm: recibidos.length ? Math.round(prom(recibidos) * 10) / 10 : null, nRecibidos: recibidos.length, tramos,
    costos: costos.slice(0, 12), costoTotal: costos.reduce((s, c) => s + c.oc, 0) };
});

// =====================================================================
// 6. LOGÍSTICA Y CHOFERES
// =====================================================================
export const logistica = computed(() => {
  const movs = dbMovimientos.value.filter(m => dentro(m.fecha) && (!filtro.value.empresa || String(m.empresa_arriendo || '').trim().toUpperCase() === filtro.value.empresa) && (!filtro.value.tipo || enFiltro(m.afi) || String(m.afi).toUpperCase() === 'OTRO'));
  const tipoMov = (m) => { const t = String(m.tipo || '').toUpperCase(); return /ENTREGA/.test(t) ? 'ENTREGA' : /RETIRO/.test(t) ? 'RETIRO' : 'TRASLADO'; };
  const porMes = mesesPeriodo.value.map(mm => { const l = movs.filter(m => mesDe(m.fecha) === mm); return { mes: mm, ENTREGA: l.filter(m => tipoMov(m) === 'ENTREGA').length, RETIRO: l.filter(m => tipoMov(m) === 'RETIRO').length, TRASLADO: l.filter(m => tipoMov(m) === 'TRASLADO').length }; });
  const porCliente = {};
  movs.forEach(m => { const k = String(m.empresa_arriendo || 'SIN EMPRESA').trim().toUpperCase(); porCliente[k] = (porCliente[k] || 0) + 1; });
  const cls = todosChecklist.value.filter(c => dentro(c.fecha));
  const choferes = {}, camiones = {};
  cls.forEach(c => {
    const ch = String(c.chofer || c.nombre || c.usuario || '—').toUpperCase(), cam = String(c.patente || '—').toUpperCase();
    const tras = (c.actividades || []).length, km = Number(c.km_fin) > Number(c.km_ini) && Number(c.km_ini) > 0 ? Number(c.km_fin) - Number(c.km_ini) : 0;
    (choferes[ch] = choferes[ch] || { nombre: ch, checklists: 0, traslados: 0 }); choferes[ch].checklists++; choferes[ch].traslados += tras;
    (camiones[cam] = camiones[cam] || { patente: cam, checklists: 0, traslados: 0, km: 0 }); camiones[cam].checklists++; camiones[cam].traslados += tras; camiones[cam].km += km;
  });
  const conMalo = cls.filter(c => Object.values(c.checklist || {}).includes('M')).length;
  const malos = {};
  cls.forEach(c => Object.entries(c.checklist || {}).forEach(([k, v]) => { if (v === 'M') malos[k] = (malos[k] || 0) + 1; }));
  const nombreItem = (k) => (ITEMS_CHECK.find(i => i.k === k) || {}).texto || k;
  return {
    movimientos: movs.length, porMes,
    porCliente: Object.entries(porCliente).map(([cliente, n]) => ({ cliente, n })).sort((a, b) => b.n - a.n).slice(0, 10),
    checklists: cls.length, pctConMalo: pct(conMalo, cls.length),
    choferes: Object.values(choferes).sort((a, b) => b.traslados - a.traslados),
    camiones: Object.values(camiones).sort((a, b) => b.km - a.km),
    kmTotal: Object.values(camiones).reduce((s, c) => s + c.km, 0),
    itemsMalos: Object.entries(malos).map(([k, n]) => ({ item: nombreItem(k), n })).sort((a, b) => b.n - a.n).slice(0, 8)
  };
});

// =====================================================================
// 7. ESTANDARIZACIÓN
// =====================================================================
export const DIAS_ESTANDAR = 90;
export const estandar = computed(() => {
  const ultima = new Map();
  estandarizaciones.value.forEach(r => { const k = String(r.afi).trim().toUpperCase(); const u = ultima.get(k); if (!u || String(r.fecha) > String(u.fecha)) ultima.set(k, r); });
  const eq = equiposF.value.map(e => ({ e, u: ultima.get(String(e.afi).trim().toUpperCase()) || null }));
  const con = eq.filter(x => x.u);
  const hoy = hoyISO();
  const viejas = con.filter(x => dias(x.u.fecha, hoy) > DIAS_ESTANDAR);
  const malos = {};
  con.forEach(x => (x.u.items || []).forEach(i => { if (i.estado === 'MALO') malos[i.t] = (malos[i.t] || 0) + 1; }));
  return {
    promedio: con.length ? Math.round(prom(con.map(x => Number(x.u.cumplimiento) || 0))) : null,
    con: con.length, sin: eq.length - con.length, viejas: viejas.length,
    pendientes: [...eq.filter(x => !x.u).map(x => ({ afi: x.e.afi, tipo: x.e.tipo, ultima: null })), ...viejas.map(x => ({ afi: x.e.afi, tipo: x.e.tipo, ultima: x.u.fecha }))].slice(0, 15),
    itemsMalos: Object.entries(malos).map(([item, n]) => ({ item, n })).sort((a, b) => b.n - a.n).slice(0, 8)
  };
});

// ---------- Exportar a Excel ----------
export const exportarKPIExcel = () => {
  const wb = XLSX.utils.book_new();
  const hoja = (nombre, filas) => { if (filas.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), nombre.slice(0, 31)); };
  const f = flota.value, m = mantencion.value, c = confiabilidad.value, t = taller.value, r = repuestos.value, l = logistica.value, e = estandar.value;
  hoja('Resumen', [
    ['Período', `${filtro.value.desde} a ${filtro.value.hasta}`], ['Empresa', filtro.value.empresa || 'Todas'], ['Tipo de equipo', filtro.value.tipo || 'Todos'],
    ['Equipos', f.total], ['Disponibilidad física (%)', f.disponibilidad], ['Utilización (%)', f.utilizacion], ['Equipos con GPS (%)', f.gps],
    ['Intervenciones del período', m.total], ['Preventivo (%)', m.pctPrev], ['Horas-hombre', m.totalHH],
    ['MTBF (horas)', c.mtbf], ['MTTR (horas por correctiva)', c.mttrHoras], ['Días promedio en taller', t.diasProm], ['Salidas con faltantes (%)', t.pctFaltantes],
    ['Repuestos abiertos', r.abiertos], ['Espera promedio repuestos (días)', r.esperaProm], ['Gasto OC del período', r.costoTotal],
    ['Movimientos', l.movimientos], ['Km camiones (check list)', l.kmTotal], ['Check list con ítems Malos (%)', l.pctConMalo],
    ['Estandarización promedio (%)', e.promedio], ['Equipos sin estandarizar', e.sin], [`Estandarización con más de ${DIAS_ESTANDAR} días`, e.viejas]
  ].map(([KPI, Valor]) => ({ KPI, Valor: Valor ?? '—' })));
  hoja('Flota por tipo', f.porTipo.map(x => ({ Tipo: x.tipo, Equipos: x.total, Operativos: x.operativo, Disponibles: x.disponible, 'Disponibilidad %': x.disp, 'Utilización %': x.util })));
  hoja('Disponibilidad histórica', dispHistorica.value.meses.map(x => ({ Mes: x.mes, 'Disponibilidad %': x.disp ?? '—', 'Utilización %': x.util ?? '—', 'Días medidos': x.dias })));
  hoja('Mantenciones por mes', m.porMes.map(x => ({ Mes: x.mes, '250 HRS': x['250 HRS'], '500 HRS': x['500 HRS'], '1000 HRS': x['1000 HRS'], Intermedia: x.INTERMEDIA, Correctivas: x.correctivas })));
  hoja('Horas-hombre', m.hh.map(x => ({ Mecánico: x.mecanico, Horas: x.horas })));
  hoja('MTBF por equipo', c.peores.map(x => ({ AFI: x.afi, Tipo: x.tipo, Fallas: x.fallas, 'MTBF (h)': x.mtbf })));
  hoja('Salidas del taller', t.salidas.map(x => ({ AFI: x.afi, Fecha: x.fecha, Días: x.dias, Resultado: x.reparado ? 'Reparado' : 'Con faltantes', Faltante: x.faltante })));
  hoja('OT por mes', t.porMes.map(x => ({ Mes: x.mes, Abiertas: x.ABIERTA, Cerradas: x.CERRADA, Anuladas: x.ANULADA })));
  hoja('Costo por equipo', r.costos.map(x => ({ AFI: x.afi, Tipo: x.tipo, 'Gasto OC': x.oc, 'Horas trabajadas': x.horas, 'Costo por hora': x.porHora ?? '—' })));
  hoja('Movimientos por mes', l.porMes.map(x => ({ Mes: x.mes, Entregas: x.ENTREGA, Retiros: x.RETIRO, Traslados: x.TRASLADO })));
  hoja('Camiones', l.camiones.map(x => ({ Patente: x.patente, 'Check list': x.checklists, Traslados: x.traslados, Km: x.km })));
  hoja('Choferes', l.choferes.map(x => ({ Chofer: x.nombre, 'Check list': x.checklists, Traslados: x.traslados })));
  hoja('Estandarización pendiente', e.pendientes.map(x => ({ AFI: x.afi, Tipo: x.tipo, 'Última revisión': x.ultima || 'Nunca' })));
  XLSX.writeFile(wb, `KPI_FRC_${filtro.value.desde}_${filtro.value.hasta}.xlsx`);
};
