// =====================================================================
// ANÁLISIS DE FALLAS · Estado y filtros del módulo (Operaciones → Mantenimiento)
// El cálculo está en core/analisis-fallas.js (también lo usa el Perfil de Equipo).
// =====================================================================
import { dbIntervenciones, dbEquipos, currentTab } from '../../core/store.js';
import { normalizarFecha, sumarDiasISO, hoyISO, mismoAfi } from '../../core/utils.js';
import { analizarFallas, categoriaPorKey, CATEGORIAS_FALLA, CATEGORIA_OTROS, fmtMin, htmlHallazgo, claseNivel, categorizar, PIEZAS, MOTIVOS, MOTIVO_NO_INDICADO, piezaPorKey, motivoPorKey, detectarPiezas, detectarMotivo } from '../../core/analisis-fallas.js';
import { nuevoLibro, hojaTabla, descargarLibro, fechaExcel } from '../../core/excel.js';
import { errMsg } from '../../core/supabase.js';

const { ref, computed, watch } = Vue;

export { fmtMin, htmlHallazgo, claseNivel, categoriaPorKey, piezaPorKey, motivoPorKey };
export const PIEZAS_LISTA = [...PIEZAS].sort((a, b) => a.label.localeCompare(b.label));
export const MOTIVOS_LISTA = [...MOTIVOS, MOTIVO_NO_INDICADO];
export const CATEGORIAS = [...CATEGORIAS_FALLA, CATEGORIA_OTROS];

const FILTRO_DEFAULT = () => ({ periodo: '365', desde: '', hasta: '', tipo: 'ALL', afi: '', categoria: 'ALL', pieza: 'ALL', motivo: 'ALL', incluirMant: false });
export const filtroFallas = ref(FILTRO_DEFAULT());
export const limpiarFiltroFallas = () => { filtroFallas.value = FILTRO_DEFAULT(); busquedaFallas.value = ''; busquedaAplicada.value = ''; };

// ---------- BUSCADOR (2026-11-25) ----------
// Busca en causa, causa detallada, descripción, equipo, tipo, sistema, pieza y motivo detectados.
// Todas las palabras escritas deben aparecer (sin importar tildes ni mayúsculas). Filtra TODO el análisis.
export const busquedaFallas = ref('');      // lo que se escribe
export const busquedaAplicada = ref('');    // lo que se aplica (con pausa de 300 ms para no recalcular en cada tecla)
let tBusca = null;
watch(busquedaFallas, (v) => { clearTimeout(tBusca); tBusca = setTimeout(() => { busquedaAplicada.value = String(v || '').trim(); }, 300); });
export const normTxt = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const palabrasBusqueda = computed(() => normTxt(busquedaAplicada.value).split(/\s+/).filter(Boolean));
const textoBuscable = (i, tipo) => normTxt([i.afi, i.causa, i.causaDetallada, i.descripcion, i.equipo, tipo, categorizar(i).label,
  ...detectarPiezas(i).map(k => piezaPorKey(k)?.label), motivoPorKey(detectarMotivo(i))?.label].join(' '));
/** Sugerencias para el buscador: piezas, motivos y sistemas. */
export const sugerenciasBusqueda = computed(() => [...PIEZAS_LISTA.map(p => p.label), ...MOTIVOS.map(m => m.label), ...CATEGORIAS.map(c => c.label)]);
/** Resalta las palabras buscadas (HTML seguro). */
export const resaltar = (texto) => {
  const esc = String(texto || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ps = palabrasBusqueda.value; if (!ps.length) return esc;
  const n = normTxt(esc); const marcas = new Array(esc.length).fill(false);
  ps.forEach(p => { let k = n.indexOf(p); while (k >= 0 && p) { for (let j = k; j < k + p.length; j++) marcas[j] = true; k = n.indexOf(p, k + p.length); } });
  let out = '', dentro = false;
  for (let j = 0; j < esc.length; j++) { if (marcas[j] && !dentro) { out += '<mark class="bg-yellow-200 rounded px-0.5">'; dentro = true; } if (!marcas[j] && dentro) { out += '</mark>'; dentro = false; } out += esc[j]; }
  return dentro ? out + '</mark>' : out;
};

export const tiposEquipo = computed(() => Array.from(new Set(dbEquipos.value.map(e => String(e.tipo || '').trim().toUpperCase()).filter(Boolean))).sort());

/** Rango de fechas según el período elegido. */
export const rangoFallas = computed(() => {
  const f = filtroFallas.value;
  if (f.periodo === 'CUSTOM') return { desde: f.desde || '', hasta: f.hasta || '' };
  if (f.periodo === 'ALL') return { desde: '', hasta: '' };
  return { desde: sumarDiasISO(hoyISO(), -Number(f.periodo)), hasta: '' };
});

const registrosFiltrados = computed(() => {
  const f = filtroFallas.value, r = rangoFallas.value;
  const tipoDe = new Map(dbEquipos.value.map(e => [String(e.afi).trim().toUpperCase(), String(e.tipo || '').trim().toUpperCase()]));
  return dbIntervenciones.value.filter(i => {
    const fe = normalizarFecha(i.fecha);
    if (!fe) return false;
    if (r.desde && fe < r.desde) return false;
    if (r.hasta && fe > r.hasta) return false;
    if (f.afi && !mismoAfi(i.afi, f.afi.trim())) return false;
    if (f.tipo !== 'ALL' && tipoDe.get(String(i.afi).trim().toUpperCase()) !== f.tipo) return false;
    if (f.categoria !== 'ALL' && categorizar(i).key !== f.categoria) return false;
    if (f.pieza !== 'ALL' && !detectarPiezas(i).includes(f.pieza)) return false;
    if (f.motivo !== 'ALL' && detectarMotivo(i) !== f.motivo) return false;
    if (palabrasBusqueda.value.length) { const t = textoBuscable(i, tipoDe.get(String(i.afi).trim().toUpperCase())); if (!palabrasBusqueda.value.every(p => t.includes(p))) return false; }
    return true;
  });
});

export const analisisFallas = computed(() => analizarFallas(registrosFiltrados.value, dbEquipos.value, { incluirMantenciones: filtroFallas.value.incluirMant }));

/** Resultado del buscador agrupado por equipo: [{ afi, tipo, marca, modelo, n, ultima, regs }] (más fallas primero). */
export const resultadosBusqueda = computed(() => {
  if (!palabrasBusqueda.value.length) return null;
  const eqPorAfi = new Map(dbEquipos.value.map(e => [String(e.afi).trim().toUpperCase(), e]));
  const grupos = new Map();
  analisisFallas.value.lista.forEach(x => {
    const k = String(x.afi).trim().toUpperCase();
    if (!grupos.has(k)) { const e = eqPorAfi.get(k) || {}; grupos.set(k, { afi: x.afi, tipo: x.tipoEquipo, marca: e.marca || '', modelo: e.modelo || '', n: 0, ultima: '', regs: [] }); }
    const g = grupos.get(k); g.n++; g.regs.push(x); if (x.fecha > g.ultima) g.ultima = x.fecha;
  });
  const equipos = [...grupos.values()].map(g => ({ ...g, regs: g.regs.slice().reverse() })).sort((a, b) => b.n - a.n || b.ultima.localeCompare(a.ultima));
  return { total: analisisFallas.value.lista.length, equipos };
});
export const busqAbierto = ref('');   // AFI desplegado en los resultados

/** Detalle desplegado de un equipo del ranking. */
export const afiDetalle = ref('');
export const verRegistrosDe = (afi) => { afiDetalle.value = afiDetalle.value === afi ? '' : afi; };
export const registrosDeAfi = (afi) => analisisFallas.value.lista.filter(x => x.afi === afi).slice().reverse();

/** Ir al Historial con el AFI filtrado. */
export const irAlHistorial = async (afi) => {
  const { filterInt } = await import('../historial/historial.service.js');
  if (filterInt?.value) filterInt.value.afi = afi;
  currentTab.value = 'hojaVida';
};

export const exportandoFallas = ref(false);
export const exportarFallasExcel = async () => {
  const a = analisisFallas.value;
  if (!a.total) return alert('No hay datos para exportar.');
  exportandoFallas.value = true;
  try {
    const { wb, logo } = await nuevoLibro();
    const sub = `${a.total} intervenciones · ${a.equiposAfectados} equipos${filtroFallas.value.incluirMant ? ' (incluye mantenciones)' : ' (sin mantenciones)'}`;
    hojaTabla(wb, logo, { nombre: 'Sistemas', titulo: 'ANÁLISIS DE FALLAS · POR SISTEMA', subtitulo: sub, apaisado: false,
      columnas: [{ t: 'SISTEMA', w: 30, al: 'left', bold: true }, { t: 'INTERVENCIONES', w: 14 }, { t: '%', w: 8, fmt: '0%' }, { t: 'HORAS DE TRABAJO', w: 16 }],
      filas: a.categorias.map(c => [c.label, c.n, c.pct / 100, Math.round(c.min / 6) / 10]) });
    hojaTabla(wb, logo, { nombre: 'Equipos', titulo: 'ANÁLISIS DE FALLAS · EQUIPOS', subtitulo: sub,
      columnas: [{ t: 'AFI', w: 10, bold: true }, { t: 'TIPO', w: 18 }, { t: 'MARCA / MODELO', w: 22 }, { t: 'INTERVENCIONES', w: 12 }, { t: 'SISTEMA MÁS COMÚN', w: 24 }, { t: '%', w: 7, fmt: '0%' },
        { t: 'PROBLEMA MÁS REPETIDO', w: 34, al: 'left' }, { t: 'REPETIDAS < 30 DÍAS', w: 12 }, { t: 'DÍAS ENTRE FALLAS', w: 12 }, { t: 'HORAS TRABAJO', w: 12 }, { t: 'ÚLTIMA', w: 12, fmt: 'dd-mm-yyyy' }],
      filas: a.equiposRank.map(e => [e.afi, e.tipo, `${e.marca} ${e.modelo}`.trim(), e.n, e.catTop?.label || '', e.catTop ? e.catTop.pct / 100 : '', e.probTop ? `${e.probTop.problema} (${e.probTop.n})` : '',
        e.repetidas, e.mtbf ?? '', Math.round(e.min / 6) / 10, fechaExcel(e.ultima)]) });
    hojaTabla(wb, logo, { nombre: 'Piezas', titulo: 'ANÁLISIS DE FALLAS · PIEZAS Y MOTIVOS', subtitulo: sub,
      columnas: [{ t: 'PIEZA', w: 28, al: 'left', bold: true }, { t: 'SISTEMA', w: 22 }, { t: 'VECES', w: 9 }, { t: 'MOTIVO MÁS COMÚN', w: 26 }, { t: 'TODOS LOS MOTIVOS', w: 50, al: 'left' }, { t: 'EQUIPOS', w: 40, al: 'left' }],
      filas: a.piezas.map(p => [p.label, p.cat.label, p.n, p.motivoTop ? p.motivoTop.label : '', p.motivos.map(m => `${m.label} (${m.n})`).join(', '), p.equipos.map(x => 'AFI ' + x).join(', ')]) });
    hojaTabla(wb, logo, { nombre: 'Problemas', titulo: 'ANÁLISIS DE FALLAS · PROBLEMAS REPETIDOS', subtitulo: sub, apaisado: false,
      columnas: [{ t: 'PROBLEMA', w: 44, al: 'left', bold: true }, { t: 'VECES', w: 10 }, { t: 'EQUIPOS', w: 40, al: 'left' }],
      filas: a.problemas.map(p => [p.problema, p.n, p.equipos.map(x => 'AFI ' + x).join(', ')]) });
    hojaTabla(wb, logo, { nombre: 'Detalle', titulo: 'ANÁLISIS DE FALLAS · DETALLE', subtitulo: sub,
      columnas: [{ t: 'FECHA', w: 12, fmt: 'dd-mm-yyyy' }, { t: 'AFI', w: 9, bold: true }, { t: 'TIPO EQUIPO', w: 16 }, { t: 'SISTEMA', w: 22 }, { t: 'CAUSA', w: 18 },
        { t: 'PIEZA', w: 22 }, { t: 'MOTIVO', w: 22 }, { t: 'CAUSA DETALLADA', w: 40, al: 'left' }, { t: 'DESCRIPCIÓN', w: 40, al: 'left' }, { t: 'HORAS', w: 9 }],
      filas: a.lista.slice().reverse().map(x => [fechaExcel(x.fecha), x.afi, x.tipoEquipo, x.cat.label, x.r.causa, x.piezas.map(k => piezaPorKey(k)?.label).join(', '), motivoPorKey(x.motivo).label, x.r.causaDetallada, x.r.descripcion, x.min ? Math.round(x.min / 6) / 10 : ''] ) });
    await descargarLibro(wb, `Analisis_Fallas_${hoyISO()}.xlsx`);
  } catch (err) { alert('Error al exportar: ' + errMsg(err)); }
  finally { exportandoFallas.value = false; }
};
