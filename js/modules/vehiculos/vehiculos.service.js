// =====================================================================
// VEHÍCULOS · Lógica del módulo (Operaciones → Equipos → Vehículos)
// ---------------------------------------------------------------------
// · Vehículo = equipo de BD_INVENTARIO cuyo AFI es una PATENTE "XXXX-XX".
//   Se muestran aquí y NO en Inventario AFI. Su N° AFI interno se guarda en bd_vehiculos.numero_afi.
// · Kilometraje: mismo cálculo que el horómetro (core/horometros.js) pero en km:
//     uso km/día = (último km tomado − km última mantención) / días entre ambas
//     (si no se puede: penúltima vs última mantención; si no: últimas 2 lecturas; si no: 80 km/día)
//     km aprox. hoy = último km tomado + días transcurridos × uso
//     meta = km última mantención + frecuencia (ej. 10.000 km) → faltan, fecha estimada, estado.
// · Horómetro: el mismo del inventario (e.horometros), se actualiza en BD_INVENTARIO.
// · Documentos: 3 PRINCIPALES (Revisión Técnica, Permiso de Circulación, SOAP) + SECUNDARIOS.
//   Cada uno con emisión + duración → vencimiento, y aviso X días antes (por defecto 30).
//   Renovar = subir uno nuevo; los anteriores quedan como historial.
// · Los datos propios del módulo se cargan al abrirlo (como Control EPP).
// =====================================================================
import { supabaseClient, sb, errMsg, subirArchivoStorage, BUCKET_ARCHIVOS } from '../../core/supabase.js';
import { dbEquipos, usuarioActivo, soloAdmin, soloEditor, cargarDatosDesdeSupabase, currentTab } from '../../core/store.js';
import { hoyISO, diasEntre, sumarDiasISO, normalizarFecha, normalizarClave, parseNum, formatDateForDisplay, compararAfi, resetInputFile } from '../../core/utils.js';
import { esAlertaRoja, getPrediccionStatusBadge } from '../../core/horometros.js';
import { TABLA_INVENTARIO, esVehiculo, esPatente, normalizarPatente, empresaDe } from '../inventario/inventario.mapper.js';
import { abrirPerfilEquipo } from '../inventario/perfil.service.js';
import { nuevoLibro, hojaTabla, descargarLibro, fechaExcel, COLOR } from '../../core/excel.js';
import {
  TABLA_VEHICULOS, TABLA_VEH_KM, TABLA_VEH_DOCS, DOCS_PRINCIPALES, DOCS_SECUNDARIOS_SUGERIDOS, UNIDADES_DURACION, docPrincipal,
  FRECUENCIA_KM_DEFAULT, UMBRAL_KM_PROXIMO, USO_KM_DIA_DEFAULT, DIAS_AVISO_DEFAULT,
  mapVehiculo, mapLecturaKm, mapDocumento
} from './vehiculos.mapper.js';

const { ref, shallowRef, computed } = Vue;

export { DOCS_PRINCIPALES, DOCS_SECUNDARIOS_SUGERIDOS, UNIDADES_DURACION, UMBRAL_KM_PROXIMO, FRECUENCIA_KM_DEFAULT, DIAS_AVISO_DEFAULT, esPatente, normalizarPatente };

const up = (v) => String(v || '').trim().toUpperCase();
export const fmtNum = (n) => (n === null || n === undefined || n === '' || isNaN(n)) ? '-' : Math.round(Number(n)).toLocaleString('es-CL');
export const fmtKm = (n) => (n === null || n === undefined || n === '' || isNaN(n)) ? '-' : `${fmtNum(n)} km`;

// ---------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------
export const dbVehiculosConf = ref([]);
export const dbLecturasKm = ref([]);
export const dbDocsVehiculos = ref([]);
export const cargandoVeh = ref(false);
export const faltaSQLVeh = ref(false);   // las tablas no existen → ejecutar sql/vehiculos.sql

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
const esErrorTabla = (m) => /does not exist|relation|schema cache|not find/i.test(m);

export const cargarVehiculos = async () => {
  cargandoVeh.value = true;
  try {
    const [v, k, d] = await Promise.all([leerTodo(TABLA_VEHICULOS), leerTodo(TABLA_VEH_KM), leerTodo(TABLA_VEH_DOCS)]);
    dbVehiculosConf.value = v.map(mapVehiculo);
    dbLecturasKm.value = k.map(mapLecturaKm);
    dbDocsVehiculos.value = d.map(mapDocumento);
    faltaSQLVeh.value = false;
  } catch (err) {
    console.error('[Vehículos] Error cargando datos', err);
    const m = errMsg(err);
    if (esErrorTabla(m)) faltaSQLVeh.value = true;
    else alert('Error al cargar Vehículos: ' + m);
  } finally { cargandoVeh.value = false; }
};

/** Recarga inventario (horómetro, ubicación…) y datos del módulo. */
export const recargarTodo = async () => { await Promise.all([cargarDatosDesdeSupabase(), cargarVehiculos()]); };

// ---------------------------------------------------------------------
// Fechas y textos
// ---------------------------------------------------------------------
const pad2 = (n) => String(n).padStart(2, '0');
/** Suma meses a una fecha ISO (31-ene + 1 mes → 28/29-feb). */
export const sumarMesesISO = (iso, meses) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  const total = (y * 12 + (m - 1)) + Number(meses);
  const ny = Math.floor(total / 12), nm = total % 12;
  const ultimo = new Date(ny, nm + 1, 0).getDate();
  return `${ny}-${pad2(nm + 1)}-${pad2(Math.min(d, ultimo))}`;
};
/** Vencimiento = emisión + duración (en días, meses o años). */
export const calcularVencimiento = (emision, duracion, unidad) => {
  const iso = normalizarFecha(emision);
  const n = Number(duracion);
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso) || !(n > 0)) return '';
  if (unidad === 'DIAS') return sumarDiasISO(iso, Math.round(n));
  if (unidad === 'ANIOS') return sumarMesesISO(iso, Math.round(n * 12));
  return sumarMesesISO(iso, Math.round(n));
};
export const textoDuracion = (doc) => {
  if (!doc || !(Number(doc.duracion) > 0)) return 'Sin duración';
  const n = Number(doc.duracion);
  const u = doc.unidad === 'DIAS' ? (n === 1 ? 'día' : 'días') : doc.unidad === 'ANIOS' ? (n === 1 ? 'año' : 'años') : (n === 1 ? 'mes' : 'meses');
  return `${n} ${u}`;
};
/** "Vencido hace 5 días" · "Vence HOY" · "Quedan 12 días" · "Quedan 95 días (≈ 3 meses)". */
export const textoRestante = (dias) => {
  if (dias === null || dias === undefined) return 'Sin vencimiento';
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`;
  if (dias === 0) return 'Vence HOY';
  const base = `Quedan ${dias} día${dias === 1 ? '' : 's'}`;
  return dias >= 60 ? `${base} (≈ ${Math.floor(dias / 30)} meses)` : base;
};

// ---------------------------------------------------------------------
// Estado de documentos
// ---------------------------------------------------------------------
const ESTADOS_DOC = {
  FALTA: { label: 'SIN CARGAR', badge: 'bg-slate-200 text-slate-600', card: 'bg-slate-50 border-slate-300 border-dashed', orden: 2 },
  VENCIDO: { label: 'VENCIDO', badge: 'bg-rose-600 text-white animate-pulse', card: 'bg-rose-50 border-rose-300', orden: 0 },
  POR_VENCER: { label: 'POR VENCER', badge: 'bg-amber-500 text-white', card: 'bg-amber-50 border-amber-300', orden: 1 },
  VIGENTE: { label: 'VIGENTE', badge: 'bg-emerald-600 text-white', card: 'bg-emerald-50 border-emerald-200', orden: 3 },
  SIN_VENC: { label: 'SIN VENCIMIENTO', badge: 'bg-sky-100 text-sky-800', card: 'bg-white border-slate-200', orden: 4 }
};
export const estadoDoc = (doc) => {
  if (!doc) return { key: 'FALTA', dias: null, texto: 'No hay documento cargado', ...ESTADOS_DOC.FALTA };
  if (!doc.fechaVencimiento) return { key: 'SIN_VENC', dias: null, texto: 'Sin fecha de vencimiento', ...ESTADOS_DOC.SIN_VENC };
  const dias = diasEntre(doc.fechaVencimiento, hoyISO());
  const key = dias < 0 ? 'VENCIDO' : dias <= (Number(doc.diasAviso) || DIAS_AVISO_DEFAULT) ? 'POR_VENCER' : 'VIGENTE';
  return { key, dias, texto: textoRestante(dias), ...ESTADOS_DOC[key] };
};
/** Más nuevo primero (por vencimiento, emisión y luego id). */
const ordenDocs = (a, b) => String(b.fechaVencimiento || b.fechaEmision || '').localeCompare(String(a.fechaVencimiento || a.fechaEmision || '')) || (b.id - a.id);

// ---------------------------------------------------------------------
// Kilometraje (mismo cálculo que el horómetro, en km)
// ---------------------------------------------------------------------
export const calcularKm = (eq, conf, lecturas) => {
  const hoy = hoyISO();
  const arr = lecturas.filter(l => l.km > 0 && l.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.km - b.km);
  const mants = arr.filter(l => l.tipo === 'MANTENCION');
  const ult = mants.length ? mants[mants.length - 1] : null;
  const kmUlt = ult ? ult.km : 0, fUlt = ult ? ult.fecha : '';
  const pen = ult ? [...mants].reverse().find(l => l.km < kmUlt && l.fecha < fUlt) || null : null;
  const ultimo = arr.length ? arr[arr.length - 1] : null;
  let kmTomado = ultimo ? ultimo.km : 0, fTomado = ultimo ? ultimo.fecha : '';
  if (ult && kmTomado < kmUlt) { kmTomado = kmUlt; fTomado = fUlt; }

  let rate = 0, metodo = 'POR DEFECTO', calc = null;
  const dKm = kmTomado - kmUlt, dD = ult ? diasEntre(fTomado, fUlt) : null;
  if (ult && dKm > 0 && dD > 0) {
    rate = dKm / dD; metodo = 'TOMADO vs ÚLT. MANT.';
    calc = { desde: kmUlt, fDesde: fUlt, hasta: kmTomado, fHasta: fTomado, km: dKm, dias: dD };
  } else if (ult && pen) {
    const k = kmUlt - pen.km, d = diasEntre(fUlt, pen.fecha);
    if (k > 0 && d > 0) { rate = k / d; metodo = 'PENÚLT. vs ÚLT. MANT.'; calc = { desde: pen.km, fDesde: pen.fecha, hasta: kmUlt, fHasta: fUlt, km: k, dias: d }; }
  }
  if (!(rate > 0) && arr.length >= 2) {
    const a = arr[arr.length - 2], b = arr[arr.length - 1];
    const k = b.km - a.km, d = Math.max(1, Math.abs(diasEntre(b.fecha, a.fecha) || 1));
    if (k > 0) { rate = k / d; metodo = 'ÚLTIMAS 2 LECTURAS'; calc = { desde: a.km, fDesde: a.fecha, hasta: b.km, fHasta: b.fecha, km: k, dias: d }; }
  }
  if (!(rate > 0)) { rate = USO_KM_DIA_DEFAULT; metodo = 'POR DEFECTO'; calc = null; }

  const diasDesde = fTomado ? Math.max(0, diasEntre(hoy, fTomado) ?? 0) : 0;
  const fuera = normalizarClave(eq?.disponibilidad) === 'Fuera de Servicio';
  const kmAprox = !ultimo ? 0 : fuera ? kmTomado : Math.round(kmTomado + diasDesde * rate);
  const frecuencia = Number(conf?.frecuenciaKm) || FRECUENCIA_KM_DEFAULT;
  const kmMeta = ult ? kmUlt + frecuencia : null;
  const faltan = kmMeta !== null ? kmMeta - kmAprox : null;
  let fechaEstimada = '';
  if (faltan !== null && rate > 0) { try { fechaEstimada = sumarDiasISO(hoy, Math.ceil(faltan / rate)); } catch (e) {} }
  const estado = !arr.length ? 'SIN LECTURAS' : !ult ? 'SIN MANT.' : faltan <= 0 ? '¡PASADO!' : faltan <= UMBRAL_KM_PROXIMO ? 'PRÓXIMO' : 'AL DÍA';

  return {
    kmTomado, fTomado, kmUlt, fUlt, kmPen: pen ? pen.km : null, fPen: pen ? pen.fecha : '',
    rate, metodo, calc, kmAprox, frecuencia, kmMeta, faltan, fechaEstimada, estado, nLecturas: arr.length
  };
};
export const kmBadge = (k) => !k || k.estado === 'SIN LECTURAS' || k.estado === 'SIN MANT.' ? 'bg-slate-400 text-white'
  : k.estado === '¡PASADO!' ? 'bg-rose-600 text-white animate-pulse' : k.estado === 'PRÓXIMO' ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white';
export const kmCard = (k) => k?.estado === '¡PASADO!' ? 'bg-rose-50 border-rose-300' : k?.estado === 'PRÓXIMO' ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200';
export const horoBadge = getPrediccionStatusBadge;

// ---------------------------------------------------------------------
// Lista de vehículos (inventario + datos propios)
// ---------------------------------------------------------------------
const agrupar = (arr) => {
  const m = new Map();
  arr.forEach(x => { if (!m.has(x.patente)) m.set(x.patente, []); m.get(x.patente).push(x); });
  return m;
};
const confPorPatente = computed(() => new Map(dbVehiculosConf.value.map(v => [v.patente, v])));
const lecturasPorPatente = computed(() => agrupar(dbLecturasKm.value));
const docsPorPatente = computed(() => agrupar(dbDocsVehiculos.value));

const confDefault = (patente) => ({ id: null, patente, numeroAfi: '', frecuenciaKm: FRECUENCIA_KM_DEFAULT, diasAviso: DIAS_AVISO_DEFAULT, observacion: '' });

export const vehiculos = computed(() => dbEquipos.value.filter(esVehiculo).map(eq => {
  const patente = up(eq.afi);
  const conf = confPorPatente.value.get(patente) || confDefault(patente);
  const lecturas = lecturasPorPatente.value.get(patente) || [];
  const docs = docsPorPatente.value.get(patente) || [];
  const principales = DOCS_PRINCIPALES.map(def => {
    const hist = docs.filter(d => d.categoria === 'PRINCIPAL' && d.clave === def.key).sort(ordenDocs);
    return { def, doc: hist[0] || null, hist, est: estadoDoc(hist[0] || null) };
  });
  const grupos = new Map();
  docs.filter(d => d.categoria === 'SECUNDARIO').forEach(d => {
    const k = up(d.nombre) || '(SIN NOMBRE)';
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(d);
  });
  const secundarios = Array.from(grupos.values()).map(hist => {
    hist.sort(ordenDocs);
    return { nombre: hist[0].nombre, doc: hist[0], hist, est: estadoDoc(hist[0]) };
  }).sort((a, b) => a.est.orden - b.est.orden || a.nombre.localeCompare(b.nombre));
  const km = calcularKm(eq, conf, lecturas);
  const todos = [...principales, ...secundarios];
  const nVencidos = todos.filter(x => x.est.key === 'VENCIDO').length;
  const nPorVencer = todos.filter(x => x.est.key === 'POR_VENCER').length;
  const nFaltan = principales.filter(x => x.est.key === 'FALTA').length;
  const horoRojo = esAlertaRoja(eq.horometros), horoAmbar = !horoRojo && eq.horometros?.estadoTexto === 'PRÓXIMO';
  const kmRojo = km.estado === '¡PASADO!', kmAmbar = km.estado === 'PRÓXIMO';
  const nivel = (nVencidos || kmRojo || horoRojo) ? 'ROJO' : (nPorVencer || kmAmbar || horoAmbar) ? 'AMBAR' : nFaltan ? 'GRIS' : 'OK';
  return { eq, patente, conf, lecturas, principales, secundarios, km, nVencidos, nPorVencer, nFaltan, horoRojo, horoAmbar, kmRojo, kmAmbar, nivel };
}));
export const vehiculoDe = (patente) => vehiculos.value.find(v => v.patente === up(patente)) || null;
export const nVehiculos = computed(() => dbEquipos.value.filter(esVehiculo).length);

export const nivelBorde = (n) => n === 'ROJO' ? 'border-rose-400 ring-1 ring-rose-200' : n === 'AMBAR' ? 'border-amber-400 ring-1 ring-amber-100' : 'border-slate-200';

// ---------------------------------------------------------------------
// Resumen, avisos y filtros
// ---------------------------------------------------------------------
export const resumenVeh = computed(() => {
  const r = { total: 0, vencidos: 0, porVencer: 0, faltan: 0, km: 0, horo: 0, vehAlerta: 0 };
  vehiculos.value.forEach(v => {
    r.total++; r.vencidos += v.nVencidos; r.porVencer += v.nPorVencer; r.faltan += v.nFaltan;
    if (v.kmRojo || v.kmAmbar) r.km++;
    if (v.horoRojo || v.horoAmbar) r.horo++;
    if (v.nivel === 'ROJO' || v.nivel === 'AMBAR') r.vehAlerta++;
  });
  return r;
});

/** Lista de avisos (documentos vencidos / por vencer, km y horómetro). Más urgentes primero. */
export const avisosVeh = computed(() => {
  const out = [];
  vehiculos.value.forEach(v => {
    [...v.principales.map(p => ({ ...p, nombre: p.def.label })), ...v.secundarios].forEach(x => {
      if (x.est.key === 'VENCIDO' || x.est.key === 'POR_VENCER') {
        out.push({ v, tipo: 'DOC', rojo: x.est.key === 'VENCIDO', orden: x.est.dias, titulo: x.nombre, detalle: `${x.est.texto} · vence ${formatDateForDisplay(x.doc.fechaVencimiento)}`, tab: 'documentos' });
      }
    });
    if (v.kmRojo || v.kmAmbar) {
      out.push({ v, tipo: 'KM', rojo: v.kmRojo, orden: v.kmRojo ? -1 : 9, titulo: 'Mantención por kilometraje', detalle: `${v.km.faltan <= 0 ? 'Pasada por ' + fmtKm(Math.abs(v.km.faltan)) : 'Faltan ' + fmtKm(v.km.faltan)} · meta ${fmtKm(v.km.kmMeta)}`, tab: 'km' });
    }
    if (v.horoRojo || v.horoAmbar) {
      const h = v.eq.horometros || {};
      out.push({ v, tipo: 'HORO', rojo: v.horoRojo, orden: v.horoRojo ? -1 : 9, titulo: 'Mantención por horómetro', detalle: `${h.horasFaltantes < 0 ? 'Pasada por ' + Math.abs(h.horasFaltantes) + ' h' : 'Faltan ' + h.horasFaltantes + ' h'} · meta ${h.hTarget || 0} h`, tab: 'km' });
    }
  });
  return out.sort((a, b) => (b.rojo - a.rojo) || ((a.orden ?? 0) - (b.orden ?? 0)));
});

const FILTRO_DEFAULT = () => ({ texto: '', alerta: 'TODOS', estado: 'ALL', orden: 'asc' });
export const filtroVeh = ref(FILTRO_DEFAULT());
export const limpiarFiltroVeh = () => { filtroVeh.value = FILTRO_DEFAULT(); };

export const listaVehiculos = computed(() => {
  const f = filtroVeh.value, t = f.texto.trim().toLowerCase();
  return vehiculos.value.filter(v => {
    if (t && ![v.patente, v.conf.numeroAfi, v.eq.tipo, v.eq.marca, v.eq.modelo, v.eq.ubicacion, empresaDe(v.eq)].join(' ').toLowerCase().includes(t)) return false;
    if (f.estado !== 'ALL' && normalizarClave(v.eq.disponibilidad) !== normalizarClave(f.estado)) return false;
    if (f.alerta === 'ALERTAS' && !(v.nivel === 'ROJO' || v.nivel === 'AMBAR')) return false;
    if (f.alerta === 'VENCIDOS' && !v.nVencidos) return false;
    if (f.alerta === 'POR_VENCER' && !v.nPorVencer) return false;
    if (f.alerta === 'FALTAN' && !v.nFaltan) return false;
    if (f.alerta === 'KM' && !(v.kmRojo || v.kmAmbar)) return false;
    if (f.alerta === 'HORO' && !(v.horoRojo || v.horoAmbar)) return false;
    return true;
  }).sort((a, b) => f.orden === 'alerta'
    ? ({ ROJO: 0, AMBAR: 1, GRIS: 2, OK: 3 }[a.nivel] - { ROJO: 0, AMBAR: 1, GRIS: 2, OK: 3 }[b.nivel]) || a.patente.localeCompare(b.patente)
    : (f.orden === 'desc' ? -1 : 1) * a.patente.localeCompare(b.patente));
});

/** Desde Inventario AFI: ir al módulo Vehículos. */
export const irAVehiculos = () => { currentTab.value = 'vehiculos'; };

// ---------------------------------------------------------------------
// Perfil del vehículo
// ---------------------------------------------------------------------
export const vehAbierto = ref('');          // patente del perfil abierto
export const tabPerfilVeh = ref('resumen'); // resumen | km | documentos
export const formConf = ref({});
export const formKm = ref({});
export const formHoro = ref({});
export const vehPerfil = computed(() => vehAbierto.value ? vehiculoDe(vehAbierto.value) : null);

export const abrirPerfilVehiculo = (v, tab = 'resumen') => {
  vehAbierto.value = v.patente;
  tabPerfilVeh.value = tab;
  formConf.value = { numeroAfi: v.conf.numeroAfi, frecuenciaKm: v.conf.frecuenciaKm, diasAviso: v.conf.diasAviso, observacion: v.conf.observacion };
  formKm.value = { fecha: hoyISO(), km: '', tipo: 'LECTURA', observacion: '' };
  formHoro.value = { h: v.eq.horometroActual || '', fecha: normalizarFecha(v.eq.fechaHorometroManual) || '' };
};
export const cerrarPerfilVehiculo = () => { vehAbierto.value = ''; };
/** Abre el Perfil de Equipo general (historial de mantenciones, ubicación, programas…). */
export const abrirPerfilEquipoDeVeh = (v) => abrirPerfilEquipo(v.eq);

export const guardandoVeh = ref(false);
const usuario = () => usuarioActivo.value?.nombre || '';
const avisoSQL = () => alert('Faltan las tablas del módulo Vehículos. Ejecuta sql/vehiculos.sql en Supabase → SQL Editor y vuelve a intentar.');

export const guardarConfVehiculo = async () => {
  if (!soloEditor()) return;
  const v = vehPerfil.value; if (!v) return;
  const f = formConf.value;
  const payload = {
    patente: v.patente,
    numero_afi: String(f.numeroAfi || '').trim() || null,
    frecuencia_km: Math.round(parseNum(f.frecuenciaKm)) || FRECUENCIA_KM_DEFAULT,
    dias_aviso: Math.round(parseNum(f.diasAviso)) || DIAS_AVISO_DEFAULT,
    observacion: String(f.observacion || '').trim() || null,
    updated_at: new Date().toISOString()
  };
  guardandoVeh.value = true;
  try {
    await sb(supabaseClient.from(TABLA_VEHICULOS).upsert([payload], { onConflict: 'patente' }));
    await cargarVehiculos();
    alert('¡Datos del vehículo guardados!');
  } catch (err) {
    if (esErrorTabla(errMsg(err))) return avisoSQL();
    alert('Error al guardar: ' + errMsg(err));
  } finally { guardandoVeh.value = false; }
};

export const registrarKm = async () => {
  if (!soloEditor()) return;
  const v = vehPerfil.value; if (!v) return;
  const f = formKm.value;
  const km = Math.round(parseNum(f.km));
  if (!(km > 0)) return alert('Ingresa el kilometraje (mayor a 0).');
  if (!f.fecha) return alert('Ingresa la fecha de la lectura.');
  if (f.fecha > hoyISO()) return alert('La fecha no puede ser futura.');
  const previo = v.lecturas.filter(l => l.fecha <= f.fecha).reduce((m, l) => Math.max(m, l.km), 0);
  if (previo > km && !confirm(`El kilometraje ingresado (${fmtKm(km)}) es MENOR que una lectura anterior (${fmtKm(previo)}). ¿Guardar de todas formas?`)) return;
  guardandoVeh.value = true;
  try {
    await sb(supabaseClient.from(TABLA_VEH_KM).insert([{
      patente: v.patente, fecha: f.fecha, km, tipo: f.tipo === 'MANTENCION' ? 'MANTENCION' : 'LECTURA',
      observacion: String(f.observacion || '').trim() || null, creado_por: usuario()
    }]));
    await cargarVehiculos();
    formKm.value = { fecha: hoyISO(), km: '', tipo: 'LECTURA', observacion: '' };
  } catch (err) {
    if (esErrorTabla(errMsg(err))) return avisoSQL();
    alert('Error al registrar kilometraje: ' + errMsg(err));
  } finally { guardandoVeh.value = false; }
};

export const eliminarLecturaKm = async (l) => {
  if (!soloAdmin()) return;
  if (!confirm(`¿Eliminar la lectura de ${fmtKm(l.km)} del ${formatDateForDisplay(l.fecha)}?`)) return;
  try {
    await sb(supabaseClient.from(TABLA_VEH_KM).delete().eq('id', l.id));
    await cargarVehiculos();
  } catch (err) { alert('Error al eliminar: ' + errMsg(err)); }
};

/** Horómetro manual (el mismo campo del Perfil de Equipo en BD_INVENTARIO). */
export const actualizarHorometroVeh = async () => {
  if (!soloEditor()) return;
  const v = vehPerfil.value; if (!v) return;
  const h = parseNum(formHoro.value.h);
  if (!(h > 0)) return alert('Ingresa el horómetro (mayor a 0).');
  if (!formHoro.value.fecha) return alert('Ingresa la fecha del horómetro.');
  if (formHoro.value.fecha > hoyISO()) return alert('La fecha no puede ser futura.');
  guardandoVeh.value = true;
  try {
    await sb(supabaseClient.from(TABLA_INVENTARIO).update({ horometroactual: h, fecha_horometro_manual: formHoro.value.fecha }).eq('id', v.eq.id));
    await cargarDatosDesdeSupabase();
  } catch (err) {
    alert('Error al actualizar horómetro: ' + errMsg(err));
  } finally { guardandoVeh.value = false; }
};

// ---------------------------------------------------------------------
// Documentos (subir / renovar / editar / eliminar)
// ---------------------------------------------------------------------
export const showDocForm = ref(false);
export const formDoc = ref({});
export const archivoDoc = shallowRef(null);
export const docsHistAbierto = ref('');   // clave/nombre del documento con historial desplegado

export const abrirNuevoDoc = (v, categoria, clave = '', nombre = '') => {
  if (!soloEditor()) return;
  const def = docPrincipal(clave);
  formDoc.value = {
    id: null, patente: v.patente, categoria, clave: def ? def.key : '',
    nombre: def ? def.label : nombre, numero: '', fechaEmision: hoyISO(),
    duracion: def ? def.duracionMeses : 12, unidad: 'MESES', fechaVencimiento: '', vencManual: false,
    diasAviso: v.conf.diasAviso || DIAS_AVISO_DEFAULT, link: '', observacion: ''
  };
  recalcularVencDoc();
  archivoDoc.value = null;
  showDocForm.value = true;
};
export const abrirEditarDoc = (doc) => {
  if (!soloEditor()) return;
  formDoc.value = { ...doc, vencManual: doc.fechaVencimiento !== calcularVencimiento(doc.fechaEmision, doc.duracion, doc.unidad) };
  archivoDoc.value = null;
  showDocForm.value = true;
};
/** Recalcula el vencimiento (emisión + duración) salvo que el usuario lo haya escrito a mano. */
export const recalcularVencDoc = () => {
  const f = formDoc.value;
  if (f.vencManual) return;
  f.fechaVencimiento = calcularVencimiento(f.fechaEmision, f.duracion, f.unidad);
};
export const vencimientoManual = () => { formDoc.value.vencManual = true; };
export const usarVencimientoCalculado = () => { formDoc.value.vencManual = false; recalcularVencDoc(); };
export const elegirArchivoDoc = (e) => { archivoDoc.value = e.target.files[0] || null; };

const limpiarNombreArchivo = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_');
const rutaDeLink = (link) => {
  const marca = `/object/public/${BUCKET_ARCHIVOS}/`;
  const i = String(link || '').indexOf(marca);
  return i < 0 ? '' : decodeURIComponent(String(link).slice(i + marca.length).split('?')[0]);
};
const borrarArchivo = async (link) => {
  const ruta = rutaDeLink(link);
  if (!ruta) return;
  try { await supabaseClient.storage.from(BUCKET_ARCHIVOS).remove([ruta]); } catch (e) { console.warn('[Vehículos] No se pudo borrar el archivo', e); }
};

export const guardarDoc = async () => {
  if (!soloEditor()) return;
  const f = formDoc.value;
  if (f.categoria === 'SECUNDARIO' && !String(f.nombre || '').trim()) return alert('Escribe el nombre del documento.');
  if (!f.fechaEmision && !f.fechaVencimiento) return alert('Ingresa al menos la fecha de emisión o la de vencimiento.');
  if (f.fechaEmision && f.fechaVencimiento && f.fechaVencimiento < f.fechaEmision) return alert('El vencimiento no puede ser anterior a la emisión.');
  guardandoVeh.value = true;
  try {
    let link = String(f.link || '').trim(), nombreArchivo = f.nombreArchivo || '';
    const file = archivoDoc.value;
    if (file) {
      const anterior = link;
      link = await subirArchivoStorage(`vehiculos/${limpiarNombreArchivo(f.patente)}/${Date.now()}_${limpiarNombreArchivo(file.name)}`, file);
      nombreArchivo = file.name;
      if (f.id && anterior && anterior !== link) await borrarArchivo(anterior);
    }
    const payload = {
      patente: f.patente,
      categoria: f.categoria,
      clave: f.categoria === 'PRINCIPAL' ? f.clave : null,
      nombre: String(f.nombre || '').trim(),
      numero: String(f.numero || '').trim() || null,
      fecha_emision: f.fechaEmision || null,
      duracion: Number(f.duracion) > 0 ? Number(f.duracion) : null,
      unidad: f.unidad || 'MESES',
      fecha_vencimiento: f.fechaVencimiento || null,
      dias_aviso: Math.round(parseNum(f.diasAviso)) || DIAS_AVISO_DEFAULT,
      link: link || null,
      nombre_archivo: nombreArchivo || null,
      observacion: String(f.observacion || '').trim() || null
    };
    if (f.id) await sb(supabaseClient.from(TABLA_VEH_DOCS).update({ ...payload, updated_at: new Date().toISOString() }).eq('id', f.id));
    else await sb(supabaseClient.from(TABLA_VEH_DOCS).insert([{ ...payload, creado_por: usuario() }]));
    await cargarVehiculos();
    showDocForm.value = false;
  } catch (err) {
    if (esErrorTabla(errMsg(err))) return avisoSQL();
    alert('Error al guardar el documento: ' + errMsg(err));
  } finally { guardandoVeh.value = false; }
};

export const eliminarDoc = async (doc) => {
  if (!soloAdmin()) return;
  if (!confirm(`¿Eliminar "${doc.nombre}" (vence ${formatDateForDisplay(doc.fechaVencimiento)})? También se borra su archivo.`)) return;
  try {
    await sb(supabaseClient.from(TABLA_VEH_DOCS).delete().eq('id', doc.id));
    await borrarArchivo(doc.link);
    await cargarVehiculos();
  } catch (err) { alert('Error al eliminar: ' + errMsg(err)); }
};

// ---------------------------------------------------------------------
// Nuevo vehículo (se crea en BD_INVENTARIO con AFI = patente)
// ---------------------------------------------------------------------
export const showNuevoVeh = ref(false);
export const formNuevoVeh = ref({});
export const abrirNuevoVehiculo = () => {
  if (!soloEditor()) return;
  formNuevoVeh.value = { patente: '', numeroAfi: '', tipo: 'CAMIONETA', marca: '', modelo: '', ubicacion: '', disponibilidad: 'Operativo', km: '', fechaKm: hoyISO(), horometro: '', frecuenciaKm: FRECUENCIA_KM_DEFAULT, frecuenciaHoras: 250 };
  showNuevoVeh.value = true;
};
export const formatearPatenteNueva = () => { formNuevoVeh.value.patente = normalizarPatente(formNuevoVeh.value.patente); };

export const guardarNuevoVehiculo = async () => {
  if (!soloEditor()) return;
  const f = formNuevoVeh.value;
  const patente = normalizarPatente(f.patente);
  if (!esPatente(patente)) return alert('La patente debe tener el formato XXXX-XX (ej. RTZK-45).');
  if (!String(f.tipo || '').trim()) return alert('Ingresa el tipo de vehículo.');
  if (dbEquipos.value.some(e => up(e.afi) === patente)) return alert(`La patente ${patente} ya existe en el sistema.`);
  guardandoVeh.value = true;
  try {
    const h = parseNum(f.horometro);
    await sb(supabaseClient.from(TABLA_INVENTARIO).insert([{
      afi: patente, tipo: String(f.tipo).trim().toUpperCase(), marca: String(f.marca || '').trim(), modelo: String(f.modelo || '').trim(),
      ubicacion: String(f.ubicacion || '').trim(), disponibilidad: normalizarClave(f.disponibilidad),
      horometroactual: h, ...(h > 0 ? { fecha_horometro_manual: f.fechaKm || hoyISO() } : {}),
      frecuencia_mantencion: Math.round(parseNum(f.frecuenciaHoras)) || 250, gps: 'Sin GPS'
    }]));
    try {
      await sb(supabaseClient.from(TABLA_VEHICULOS).upsert([{
        patente, numero_afi: String(f.numeroAfi || '').trim() || null,
        frecuencia_km: Math.round(parseNum(f.frecuenciaKm)) || FRECUENCIA_KM_DEFAULT, dias_aviso: DIAS_AVISO_DEFAULT
      }], { onConflict: 'patente' }));
      const km = Math.round(parseNum(f.km));
      if (km > 0) await sb(supabaseClient.from(TABLA_VEH_KM).insert([{ patente, fecha: f.fechaKm || hoyISO(), km, tipo: 'LECTURA', observacion: 'Kilometraje inicial', creado_por: usuario() }]));
    } catch (err) {
      alert(`El vehículo ${patente} quedó creado en el inventario, pero no se guardó su N° AFI / kilometraje: ` + errMsg(err) + (esErrorTabla(errMsg(err)) ? '\n\nEjecuta sql/vehiculos.sql en Supabase.' : ''));
    }
    await recargarTodo();
    showNuevoVeh.value = false;
  } catch (err) {
    alert('Error al crear el vehículo: ' + errMsg(err));
  } finally { guardandoVeh.value = false; }
};

// ---------------------------------------------------------------------
// Exportar Excel
// ---------------------------------------------------------------------
export const exportandoVeh = ref(false);
const colorEstado = (key) => key === 'VENCIDO' ? { fill: COLOR.rojo, font: { color: { argb: COLOR.rojoTxt }, bold: true } }
  : key === 'POR_VENCER' ? { fill: COLOR.ambar, font: { color: { argb: COLOR.ambarTxt }, bold: true } } : null;

export const exportarVehiculosExcel = async () => {
  exportandoVeh.value = true;
  try {
    const { wb, logo } = await nuevoLibro();
    const lista = [...vehiculos.value].sort((a, b) => compararAfi(a.patente, b.patente));
    const docCol = (v, key) => { const p = v.principales.find(x => x.def.key === key); return p.doc ? fechaExcel(p.doc.fechaVencimiento) : 'SIN CARGAR'; };
    hojaTabla(wb, logo, {
      nombre: 'Vehículos', titulo: 'VEHÍCULOS', subtitulo: `${lista.length} vehículos · kilometraje, horómetro y documentos`,
      columnas: [
        { t: 'PATENTE', w: 12, bold: true }, { t: 'N° AFI', w: 9 }, { t: 'TIPO', w: 16 }, { t: 'MARCA / MODELO', w: 22 }, { t: 'ESTADO', w: 14 }, { t: 'UBICACIÓN', w: 22, al: 'left' },
        { t: 'KM TOMADO', w: 11, fmt: '#,##0' }, { t: 'FECHA KM', w: 11, fmt: 'dd-mm-yyyy' }, { t: 'KM APROX HOY', w: 12, fmt: '#,##0' }, { t: 'META KM', w: 11, fmt: '#,##0' }, { t: 'FALTAN KM', w: 11, fmt: '#,##0' }, { t: 'ESTADO KM', w: 12 },
        { t: 'HORÓMETRO APROX', w: 12 }, { t: 'META H', w: 9 }, { t: 'ESTADO HORÓMETRO', w: 12 },
        { t: 'VENCE REV. TÉCNICA', w: 13, fmt: 'dd-mm-yyyy' }, { t: 'VENCE PERMISO CIRC.', w: 13, fmt: 'dd-mm-yyyy' }, { t: 'VENCE SOAP', w: 12, fmt: 'dd-mm-yyyy' },
        { t: 'DOCS VENCIDOS', w: 10 }, { t: 'DOCS POR VENCER', w: 10 }
      ],
      filas: lista.map(v => [
        v.patente, v.conf.numeroAfi, v.eq.tipo, `${v.eq.marca} ${v.eq.modelo}`.trim(), v.eq.disponibilidad, v.eq.ubicacion,
        v.km.kmTomado || '', fechaExcel(v.km.fTomado), v.km.kmAprox || '', v.km.kmMeta ?? '', v.km.faltan ?? '', v.km.estado,
        v.eq.horometros?.hAprox ?? '', v.eq.horometros?.hTarget ?? '', v.eq.horometros?.estadoTexto ?? '',
        docCol(v, 'REVISION_TECNICA'), docCol(v, 'PERMISO_CIRCULACION'), docCol(v, 'SOAP'), v.nVencidos, v.nPorVencer
      ]),
      estiloFila: (f, i) => { const v = lista[i]; return v.nivel === 'ROJO' ? { fill: COLOR.rojo } : v.nivel === 'AMBAR' ? { fill: COLOR.ambar } : null; }
    });
    const docs = [];
    lista.forEach(v => {
      v.principales.forEach(p => docs.push({ v, cat: 'PRINCIPAL', nombre: p.def.label, doc: p.doc, est: p.est }));
      v.secundarios.forEach(s => docs.push({ v, cat: 'SECUNDARIO', nombre: s.nombre, doc: s.doc, est: s.est }));
    });
    hojaTabla(wb, logo, {
      nombre: 'Documentos', titulo: 'DOCUMENTOS DE VEHÍCULOS', subtitulo: 'Documento vigente de cada tipo (el más reciente)',
      columnas: [
        { t: 'PATENTE', w: 12, bold: true }, { t: 'N° AFI', w: 9 }, { t: 'CATEGORÍA', w: 12 }, { t: 'DOCUMENTO', w: 28, al: 'left' }, { t: 'N° / FOLIO', w: 14 },
        { t: 'EMISIÓN', w: 12, fmt: 'dd-mm-yyyy' }, { t: 'DURACIÓN', w: 11 }, { t: 'VENCIMIENTO', w: 12, fmt: 'dd-mm-yyyy' }, { t: 'DÍAS RESTANTES', w: 11 },
        { t: 'AVISO (DÍAS ANTES)', w: 11 }, { t: 'ESTADO', w: 14 }, { t: 'ARCHIVO', w: 40, al: 'left' }
      ],
      filas: docs.map(x => [
        x.v.patente, x.v.conf.numeroAfi, x.cat, x.nombre, x.doc?.numero || '', fechaExcel(x.doc?.fechaEmision), x.doc ? textoDuracion(x.doc) : '',
        fechaExcel(x.doc?.fechaVencimiento), x.est.dias ?? '', x.doc?.diasAviso ?? '', x.est.label, x.doc?.link || ''
      ]),
      estiloFila: (f, i) => colorEstado(docs[i].est.key)
    });
    hojaTabla(wb, logo, {
      nombre: 'Avisos', titulo: 'AVISOS DE VEHÍCULOS', subtitulo: 'Documentos vencidos / por vencer y mantenciones por km u horómetro',
      columnas: [{ t: 'PATENTE', w: 12, bold: true }, { t: 'N° AFI', w: 9 }, { t: 'TIPO AVISO', w: 14 }, { t: 'ASUNTO', w: 30, al: 'left' }, { t: 'DETALLE', w: 50, al: 'left' }, { t: 'NIVEL', w: 10 }],
      filas: avisosVeh.value.map(a => [a.v.patente, a.v.conf.numeroAfi, a.tipo === 'DOC' ? 'DOCUMENTO' : a.tipo === 'KM' ? 'KILOMETRAJE' : 'HORÓMETRO', a.titulo, a.detalle, a.rojo ? 'URGENTE' : 'PRÓXIMO']),
      estiloFila: (f) => f[5] === 'URGENTE' ? colorEstado('VENCIDO') : colorEstado('POR_VENCER'),
      apaisado: false
    });
    await descargarLibro(wb, `Vehiculos_${hoyISO()}.xlsx`);
  } catch (err) {
    alert('Error al exportar: ' + errMsg(err));
  } finally { exportandoVeh.value = false; }
};
