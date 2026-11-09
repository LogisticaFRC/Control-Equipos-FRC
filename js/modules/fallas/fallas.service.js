// =====================================================================
// ANÁLISIS DE FALLAS · Estado y filtros del módulo (Operaciones → Mantenimiento)
// El cálculo está en core/analisis-fallas.js (también lo usa el Perfil de Equipo).
// =====================================================================
import { dbIntervenciones, dbEquipos, currentTab } from '../../core/store.js';
import { normalizarFecha, sumarDiasISO, hoyISO, mismoAfi } from '../../core/utils.js';
import { analizarFallas, categoriaPorKey, CATEGORIAS_FALLA, CATEGORIA_OTROS, fmtMin, htmlHallazgo, claseNivel, categorizar } from '../../core/analisis-fallas.js';
import { nuevoLibro, hojaTabla, descargarLibro, fechaExcel } from '../../core/excel.js';
import { errMsg } from '../../core/supabase.js';

const { ref, computed } = Vue;

export { fmtMin, htmlHallazgo, claseNivel, categoriaPorKey };
export const CATEGORIAS = [...CATEGORIAS_FALLA, CATEGORIA_OTROS];

const FILTRO_DEFAULT = () => ({ periodo: '365', desde: '', hasta: '', tipo: 'ALL', afi: '', categoria: 'ALL', incluirMant: false });
export const filtroFallas = ref(FILTRO_DEFAULT());
export const limpiarFiltroFallas = () => { filtroFallas.value = FILTRO_DEFAULT(); };

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
    return true;
  });
});

export const analisisFallas = computed(() => analizarFallas(registrosFiltrados.value, dbEquipos.value, { incluirMantenciones: filtroFallas.value.incluirMant }));

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
    hojaTabla(wb, logo, { nombre: 'Problemas', titulo: 'ANÁLISIS DE FALLAS · PROBLEMAS REPETIDOS', subtitulo: sub, apaisado: false,
      columnas: [{ t: 'PROBLEMA', w: 44, al: 'left', bold: true }, { t: 'VECES', w: 10 }, { t: 'EQUIPOS', w: 40, al: 'left' }],
      filas: a.problemas.map(p => [p.problema, p.n, p.equipos.map(x => 'AFI ' + x).join(', ')]) });
    hojaTabla(wb, logo, { nombre: 'Detalle', titulo: 'ANÁLISIS DE FALLAS · DETALLE', subtitulo: sub,
      columnas: [{ t: 'FECHA', w: 12, fmt: 'dd-mm-yyyy' }, { t: 'AFI', w: 9, bold: true }, { t: 'TIPO EQUIPO', w: 16 }, { t: 'SISTEMA', w: 22 }, { t: 'CAUSA', w: 18 },
        { t: 'CAUSA DETALLADA', w: 40, al: 'left' }, { t: 'DESCRIPCIÓN', w: 40, al: 'left' }, { t: 'HORAS', w: 9 }],
      filas: a.lista.slice().reverse().map(x => [fechaExcel(x.fecha), x.afi, x.tipoEquipo, x.cat.label, x.r.causa, x.r.causaDetallada, x.r.descripcion, x.min ? Math.round(x.min / 6) / 10 : ''] ) });
    await descargarLibro(wb, `Analisis_Fallas_${hoyISO()}.xlsx`);
  } catch (err) { alert('Error al exportar: ' + errMsg(err)); }
  finally { exportandoFallas.value = false; }
};
