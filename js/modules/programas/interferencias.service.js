// =====================================================================
// PROGRAMAS REPARACIÓN · INTERFERENCIAS DIARIAS (2026-11-23)
// Razones / problemas de cada día que demoraron las reparaciones del programa.
// Tabla bd_programas_interferencias (sql/programa_interferencias.sql).
// Se ven en la pestaña "Interferencias" del programa y salen en la hoja "Interferencias" del Excel.
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { usuarioActivo, obtenerDetalleEquipoPorAfi } from '../../core/store.js';
import { TABLAS } from '../../core/tablas.js';
import { normalizarFecha, hoyISO } from '../../core/utils.js';
import { hojaTabla, fechaExcel, fill, COLOR } from '../../core/excel.js';

const { ref } = Vue;

export const TABLA_INTERFERENCIAS = TABLAS.PROGRAMAS_INTERFERENCIAS;

export const CATEGORIAS_INTERFERENCIA = [
  'FALTA DE REPUESTOS',
  'ESPERA DE APROBACIÓN / OC',
  'ESPERA DE PROVEEDOR EXTERNO',
  'FALTA DE PERSONAL',
  'FALTA DE HERRAMIENTAS / INSUMOS',
  'FALLA ADICIONAL ENCONTRADA',
  'PRIORIDAD DE OTRO TRABAJO / URGENCIA',
  'CORTE DE ENERGÍA / INSTALACIONES',
  'CLIMA / CONDICIONES',
  'OTRO'
];
const COLOR_CAT = {
  'FALTA DE REPUESTOS': 'bg-rose-100 text-rose-800 border-rose-200',
  'ESPERA DE APROBACIÓN / OC': 'bg-amber-100 text-amber-800 border-amber-200',
  'ESPERA DE PROVEEDOR EXTERNO': 'bg-orange-100 text-orange-800 border-orange-200',
  'FALTA DE PERSONAL': 'bg-violet-100 text-violet-800 border-violet-200',
  'FALTA DE HERRAMIENTAS / INSUMOS': 'bg-sky-100 text-sky-800 border-sky-200',
  'FALLA ADICIONAL ENCONTRADA': 'bg-red-100 text-red-800 border-red-200',
  'PRIORIDAD DE OTRO TRABAJO / URGENCIA': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'CORTE DE ENERGÍA / INSTALACIONES': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'CLIMA / CONDICIONES': 'bg-cyan-100 text-cyan-800 border-cyan-200'
};
export const colorCategoria = (c) => COLOR_CAT[c] || 'bg-slate-100 text-slate-700 border-slate-200';

const SQL_AVISO = 'Falta crear la tabla de interferencias en Supabase.\nEjecuta en el SQL Editor el archivo sql/programa_interferencias.sql (está en la carpeta del sistema).';
const esFaltaTabla = (err) => /bd_programas_interferencias|schema cache|does not exist|relation/i.test(errMsg(err));

/** Interferencias por programa: { [programa_id]: [...] } */
export const interferenciasPorPrograma = ref({});
export const cargandoInterferencias = ref(false);
export const faltaTablaInterferencias = ref(false);

const quien = () => { const u = usuarioActivo.value; return (u && (u.nombre || u.usuario)) || ''; };
const ordenar = (lista) => [...lista].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.created_at || '').localeCompare(String(a.created_at || '')));

/** Descarga desde Supabase las interferencias de un programa. */
export const traerInterferencias = async (programaId) => {
  if (!programaId) return [];
  const data = await sb(supabaseClient.from(TABLA_INTERFERENCIAS).select('*').eq('programa_id', String(programaId)).order('fecha', { ascending: false }));
  return ordenar((data || []).map(r => ({ ...r, fecha: normalizarFecha(r.fecha) })));
};

export const cargarInterferencias = async (programaId) => {
  if (!programaId) return;
  cargandoInterferencias.value = true;
  try {
    const lista = await traerInterferencias(programaId);
    interferenciasPorPrograma.value = { ...interferenciasPorPrograma.value, [String(programaId)]: lista };
    faltaTablaInterferencias.value = false;
  } catch (err) {
    if (esFaltaTabla(err)) faltaTablaInterferencias.value = true;
    else console.warn('Interferencias:', errMsg(err));
  } finally { cargandoInterferencias.value = false; }
};

export const interferenciasDe = (programaId) => interferenciasPorPrograma.value[String(programaId)] || [];

export const nuevaInterferencia = () => ({ fecha: hoyISO(), afi: '', categoria: '', descripcion: '', horas_perdidas: '' });

/** Guarda (nueva o editada). item = { id?, fecha, afi, nave, categoria, descripcion, horas_perdidas } */
export const guardarInterferencia = async (programaId, item) => {
  if (!item.fecha) throw new Error('Falta la fecha.');
  if (!item.categoria) throw new Error('Elige el tipo de interferencia.');
  if (!String(item.descripcion || '').trim()) throw new Error('Escribe qué pasó.');
  const h = String(item.horas_perdidas ?? '').replace(',', '.').trim();
  const fila = {
    programa_id: String(programaId), fecha: item.fecha, afi: item.afi || null, nave: item.nave || null,
    categoria: item.categoria, descripcion: String(item.descripcion).trim(),
    horas_perdidas: h === '' || isNaN(Number(h)) ? null : Number(h)
  };
  try {
    if (item.id) await sb(supabaseClient.from(TABLA_INTERFERENCIAS).update(fila).eq('id', item.id));
    else await sb(supabaseClient.from(TABLA_INTERFERENCIAS).insert([{ ...fila, usuario: quien() }]));
  } catch (err) {
    if (esFaltaTabla(err)) { faltaTablaInterferencias.value = true; throw new Error(SQL_AVISO); }
    throw err;
  }
  await cargarInterferencias(programaId);
};

export const eliminarInterferencia = async (programaId, id) => {
  await sb(supabaseClient.from(TABLA_INTERFERENCIAS).delete().eq('id', id));
  await cargarInterferencias(programaId);
};

/** Resumen por categoría: [{ categoria, n, horas }] ordenado de más a menos. */
export const resumenInterferencias = (lista) => {
  const m = {};
  lista.forEach(i => {
    const k = i.categoria || 'OTRO';
    m[k] = m[k] || { categoria: k, n: 0, horas: 0 };
    m[k].n++; m[k].horas += Number(i.horas_perdidas) || 0;
  });
  return Object.values(m).sort((a, b) => b.n - a.n || b.horas - a.horas);
};

const DIAS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const diaSemana = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return y ? DIAS[new Date(y, m - 1, d).getDay()] : ''; };

// ---------- Excel: hoja "Interferencias" (detalle + resumen por tipo) ----------
export const hojaInterferencias = async (wb, logo, { prog, nombre, vigencia }) => {
  let lista = [];
  try { lista = await traerInterferencias(prog.id); } catch (_) { return; }   // sin tabla: no se agrega la hoja
  if (!lista.length) return;
  lista = [...lista].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const det = obtenerDetalleEquipoPorAfi;
  const totalHoras = lista.reduce((s, i) => s + (Number(i.horas_perdidas) || 0), 0);
  const dias = new Set(lista.map(i => i.fecha)).size;
  const filas = lista.map((i, n) => [
    n + 1, fechaExcel(i.fecha) || '-', diaSemana(i.fecha),
    i.afi ? `AFI ${i.afi}` : 'GENERAL', i.afi ? (det(i.afi, 'tipo') || '-') : '-', i.nave || '-',
    i.categoria, i.descripcion, i.horas_perdidas != null && i.horas_perdidas !== '' ? Number(i.horas_perdidas) : '-', i.usuario || '-'
  ]);
  const ws = hojaTabla(wb, logo, {
    nombre: 'Interferencias', titulo: `INTERFERENCIAS DIARIAS · ${nombre}`,
    subtitulo: `${vigencia} · ${lista.length} interferencias en ${dias} día(s)${totalHoras ? ` · ${totalHoras} h perdidas` : ''}`,
    columnas: [
      { t: 'N°', w: 5 }, { t: 'FECHA', w: 12, fmt: 'dd-mm-yyyy', bold: true }, { t: 'DÍA', w: 6 },
      { t: 'EQUIPO', w: 12, bold: true }, { t: 'TIPO EQUIPO', w: 18 }, { t: 'NAVE', w: 9 },
      { t: 'TIPO DE INTERFERENCIA', w: 24, bold: true }, { t: 'DESCRIPCIÓN (QUÉ PASÓ)', w: 60, al: 'left' },
      { t: 'HORAS PERDIDAS', w: 10 }, { t: 'REGISTRADO POR', w: 18 }
    ],
    filas,
    totales: ['', '', '', '', '', '', 'TOTAL', `${lista.length} interferencias`, totalHoras || '-', '']
  });
  // Descripción con salto de línea y alto de fila según el largo del texto
  filas.forEach((f, i) => {
    const r = 7 + i;
    const c = ws.getCell(r, 8); c.alignment = { ...(c.alignment || {}), wrapText: true, vertical: 'middle', horizontal: 'left' };
    const lineas = String(f[7]).split('\n').reduce((s, l) => s + Math.max(1, Math.ceil(l.length / 70)), 0);
    ws.getRow(r).height = Math.max(18, lineas * 13 + 4);
  });

  // Resumen por tipo de interferencia (debajo de la tabla)
  const res = resumenInterferencias(lista);
  let r = 7 + filas.length + 2;
  const cab = ['TIPO DE INTERFERENCIA', 'CANTIDAD', '% DEL TOTAL', 'HORAS PERDIDAS'];
  const cols = [7, 8, 9, 10];
  ws.mergeCells(r, 5, r, 10);
  const t = ws.getCell(r, 5); t.value = 'RESUMEN POR TIPO DE INTERFERENCIA'; t.font = { bold: true, size: 11, color: { argb: COLOR.indigo } }; t.alignment = { horizontal: 'center' };
  r++;
  const borde = { top: { style: 'thin', color: { argb: 'FFCBD5E1' } }, left: { style: 'thin', color: { argb: 'FFCBD5E1' } }, bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  cab.forEach((v, j) => { const c = ws.getCell(r, cols[j]); c.value = v; c.font = { bold: true, size: 9, color: { argb: COLOR.blanco } }; c.fill = fill(COLOR.indigo); c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; c.border = borde; });
  ws.getRow(r).height = 22;
  res.forEach(x => {
    r++;
    [x.categoria, x.n, x.n / lista.length, x.horas || '-'].forEach((v, j) => {
      const c = ws.getCell(r, cols[j]); c.value = v; c.border = borde; c.font = { size: 9, bold: j === 0 };
      c.alignment = { horizontal: j === 0 ? 'left' : 'center', vertical: 'middle' };
      if (j === 2) c.numFmt = '0%';
    });
  });
};
