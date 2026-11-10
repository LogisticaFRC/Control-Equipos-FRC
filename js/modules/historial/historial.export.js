// =====================================================================
// HISTORIAL · Exportación a Excel con formato (logo, centrado, detallado)
//   · exportarHistorialEquipoExcel(equipo, registros) → Hoja de vida de UN equipo (Perfil → Historial)
//   · exportarHistorialGeneralExcel(registros)        → Historial general filtrado (módulo Historial)
// Hojas: Resumen (KPI + gráficos + tablas) · Historial (detalle completo) · Filtros y aceites.
// Usa core/excel.js (mismo estilo que el resto de exportaciones del sistema).
// =====================================================================
import { nuevoLibro, hojaTabla, hojaDashboard, descargarLibro, fechaExcel, COLOR } from '../../core/excel.js';
import { buscarEquipoPorAfi } from '../../core/store.js';
import { hoyISO, formatDateForDisplay, getMecanicosText, normalizarFecha } from '../../core/utils.js';
import { categorizar, minutosTrabajo, piezaMotivoTexto, esNoFalla } from '../../core/analisis-fallas.js';
import { claseMantencion } from '../../core/horometros.js';
import { totalOCMantencion, totalOCEquipo, ocsDelEquipo } from '../oc/oc.service.js';
import { errMsg } from '../../core/supabase.js';
import { corregirTexto as ok } from '../../core/ortografia.js';   // tipeo y tildes (diccionario técnico)

const { ref } = Vue;
export const exportandoHistorial = ref(false);

const PESOS = '"$"#,##0';
const horas = (r) => { const m = minutosTrabajo(r); return m ? Math.round(m / 6) / 10 : ''; };
const esPat = (afi) => /^[A-Z]{4}-?\d{2}$/i.test(String(afi || '').trim());
/** Falla real: no es mantención/preventivo ni un servicio/inspección. */
const esFalla = (r) => !esNoFalla(r) && categorizar(r).key !== 'SERVICIO';
const tipoReg = (r) => claseMantencion(r) === 'COMPLETA' ? 'MANTENCIÓN' : claseMantencion(r) === 'INTERMEDIA' ? 'MANT. INTERMEDIA' : esFalla(r) ? 'FALLA / REPARACIÓN' : 'SERVICIO / OTRO';
const costoReg = (r) => Number(r.costo || 0) || totalOCMantencion(r) || 0;
const ordenar = (lista) => [...lista].sort((a, b) => String(normalizarFecha(b.fecha)).localeCompare(String(normalizarFecha(a.fecha))));

/** Ajusta el alto de cada fila según el texto más largo (Excel no lo hace solo con wrapText en celdas largas). */
const ajustarAltos = (ws, columnas, filaIni, n) => {
  for (let k = 0; k < n; k++) {
    const row = ws.getRow(filaIni + k);
    let lineas = 1;
    columnas.forEach((c, j) => {
      const v = row.getCell(j + 1).value;
      const t = v && typeof v === 'object' ? (v.text || v.result || '') : v;
      if (typeof t !== 'string' || !t) return;
      const porLinea = Math.max(6, Math.floor((c.w || 14) * 1.15));
      lineas = Math.max(lineas, t.split('\n').reduce((s, p) => s + Math.max(1, Math.ceil(p.length / porLinea)), 0));
    });
    row.height = Math.min(160, Math.max(18, lineas * 12 + 6));
  }
};
/** Links "Ver" del documento en azul subrayado. */
const estilizarLinks = (ws, col, filaIni, n) => {
  for (let k = 0; k < n; k++) {
    const c = ws.getCell(filaIni + k, col);
    if (c.value && c.value.hyperlink) c.font = { size: 9, color: { argb: 'FF1D4ED8' }, underline: true, bold: true };
  }
};

// ---------------------------------------------------------------------
// Columnas del detalle
// ---------------------------------------------------------------------
const columnasDetalle = (conEquipo) => [
  { t: 'FECHA', w: 11, fmt: 'dd-mm-yyyy', bold: true, v: r => fechaExcel(normalizarFecha(r.fecha)) },
  ...(conEquipo ? [
    { t: 'AFI', w: 8, bold: true, v: r => r.afi },
    { t: 'EQUIPO', w: 15, v: r => { const e = buscarEquipoPorAfi(r.afi); return [e?.tipo || r.equipo, [e?.marca, e?.modelo].filter(Boolean).join(' ')].filter(Boolean).join('\n') || '-'; } }
  ] : []),
  { t: 'TIPO / CAUSA', w: 17, v: r => [tipoReg(r), [r.causa, r.tipoMant].filter(Boolean).join(' · ')].filter(Boolean).join('\n') },
  { t: 'SISTEMA · PIEZA · MOTIVO', w: 21, v: r => esFalla(r) ? `${categorizar(r).label}\n${piezaMotivoTexto(r)}` : '-' },
  { t: 'CAUSA DETALLADA', w: 30, al: 'left', v: r => ok(r.causaDetallada) || '-' },
  { t: 'DESCRIPCIÓN DEL TRABAJO', w: 46, al: 'left', v: r => ok(r.descripcion) || '-' },
  { t: 'HORÓMETRO / KM', w: 10, fmt: '#,##0', v: r => Number(r.horometro) > 0 ? Number(r.horometro) : '-' },
  { t: 'HORARIO', w: 11, v: r => r.horaInicio && r.horaInicio !== '-' ? `${r.horaInicio} – ${r.horaTermino || '?'}` : '-' },
  { t: 'HORAS', w: 7, fmt: '0.0', v: r => horas(r) },
  { t: 'MECÁNICOS', w: 18, v: r => getMecanicosText(r).split(', ').join('\n') },
  { t: 'LUGAR', w: 12, v: r => ok(r.lugar) || '-' },
  { t: 'OT / OC', w: 12, v: r => [r.numeroOT ? 'OT ' + r.numeroOT : '', r.numeroOC ? 'OC ' + r.numeroOC : ''].filter(Boolean).join('\n') || '-' },
  { t: 'COSTO', w: 11, fmt: PESOS, v: r => costoReg(r) || '' },
  { t: 'DOC.', w: 6, v: r => r.linkDrive ? { text: 'Ver', hyperlink: r.linkDrive } : '-' }
];

const hojaDetalle = (wb, logo, lista, { titulo, subtitulo, conEquipo }) => {
  const cols = columnasDetalle(conEquipo);
  const filas = lista.map(r => cols.map(c => c.v(r)));
  const iH = cols.findIndex(c => c.t === 'HORAS'), iC = cols.findIndex(c => c.t === 'COSTO');
  const totales = cols.map((c, i) => i === 0 ? 'TOTAL' : i === 1 ? `${lista.length} registro(s)` : i === iH ? lista.reduce((s, r) => s + (Number(horas(r)) || 0), 0) : i === iC ? lista.reduce((s, r) => s + costoReg(r), 0) : '');
  const ws = hojaTabla(wb, logo, {
    nombre: 'Historial', titulo, subtitulo, columnas: cols, filas, totales,
    estiloFila: (v, i) => {
      const t = tipoReg(lista[i]);
      return t === 'MANTENCIÓN' ? { fill: 'FFECFDF5' } : t === 'MANT. INTERMEDIA' ? { fill: 'FFEFF6FF' } : null;
    }
  });
  ajustarAltos(ws, cols, 7, filas.length);
  estilizarLinks(ws, cols.length, 7, filas.length);
  ws.headerFooter = { oddFooter: `&L&8FAST RENTAL CHILE · ${titulo.replace(/&/g, '&&')}&R&8Página &P de &N` };
  ws.pageSetup.printTitlesRow = '6:6';
  return ws;
};

const hojaFiltros = (wb, logo, lista, { titulo, subtitulo, conEquipo }) => {
  const filas = [];
  lista.filter(r => (r.filtrosLista || []).length || (r.aceites && r.aceites !== 'Sin consumo')).forEach(r => {
    const fl = r.filtrosLista && r.filtrosLista.length ? r.filtrosLista : [null];
    fl.forEach((f, k) => filas.push([
      fechaExcel(normalizarFecha(r.fecha)), ...(conEquipo ? [r.afi] : []), r.tipoMant || r.causa || '-',
      f ? f.tipo || '-' : '-', f ? f.marca || '-' : '-', f ? f.codigo || '-' : '-', f ? Number(f.cantidad) || 1 : '',
      f && Number(f.precio) > 0 ? Number(f.precio) : '', k === 0 && r.aceites && r.aceites !== 'Sin consumo' ? r.aceites : ''
    ]));
  });
  if (!filas.length) return null;
  const ws = hojaTabla(wb, logo, {
    nombre: 'Filtros y aceites', titulo, subtitulo, apaisado: false,
    columnas: [{ t: 'FECHA', w: 11, fmt: 'dd-mm-yyyy', bold: true }, ...(conEquipo ? [{ t: 'AFI', w: 9, bold: true }] : []), { t: 'MANTENCIÓN / CAUSA', w: 20 },
      { t: 'TIPO FILTRO', w: 20 }, { t: 'MARCA', w: 13 }, { t: 'CÓDIGO', w: 15 }, { t: 'CANT.', w: 7 }, { t: 'PRECIO', w: 11, fmt: PESOS }, { t: 'ACEITES', w: 30, al: 'left' }],
    filas
  });
  return ws;
};

// ---------------------------------------------------------------------
// Gráficos y tablas del resumen
// ---------------------------------------------------------------------
const contar = (lista, fn) => { const m = new Map(); lista.forEach(x => { const k = fn(x); if (k) m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
const grafBarras = (pares, color, horizontal = true) => ({
  type: 'bar',
  data: { labels: pares.map(p => p[0]), datasets: [{ data: pares.map(p => p[1]), backgroundColor: color, borderRadius: 4 }] },
  options: { indexAxis: horizontal ? 'y' : 'x', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { beginAtZero: true, ticks: { precision: 0 } } } }
});
const porMes = (lista) => {
  const m = new Map();
  lista.forEach(r => { const f = String(normalizarFecha(r.fecha) || ''); if (f) { const k = f.slice(0, 7); m.set(k, (m.get(k) || 0) + 1); } });
  const meses = [...m.keys()].sort().slice(-18);
  const N = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return meses.map(k => [`${N[Number(k.slice(5)) - 1]} ${k.slice(2, 4)}`, m.get(k)]);
};
const kpisDe = (lista, extra = []) => {
  const mant = lista.filter(r => claseMantencion(r) === 'COMPLETA').length;
  const fallas = lista.filter(esFalla).length;
  const hrs = lista.reduce((s, r) => s + (Number(horas(r)) || 0), 0);
  const costo = lista.reduce((s, r) => s + costoReg(r), 0);
  return [
    { t: 'Registros', v: lista.length, color: 'indigo' },
    { t: 'Mantenciones', v: mant, color: 'verde' },
    { t: 'Fallas / reparaciones', v: fallas, color: 'rojo' },
    { t: 'Horas de trabajo', v: Math.round(hrs * 10) / 10, fmt: '0.0', color: 'gris' },
    { t: 'Costo registrado', v: costo, fmt: PESOS, color: 'ambar' },
    ...extra
  ];
};
const subtituloFiltros = (lista) => {
  const fs = lista.map(r => normalizarFecha(r.fecha)).filter(Boolean).sort();
  return fs.length ? `${lista.length} registro(s) · del ${formatDateForDisplay(fs[0])} al ${formatDateForDisplay(fs[fs.length - 1])}` : `${lista.length} registro(s)`;
};

// ---------------------------------------------------------------------
// HOJA DE VIDA DE UN EQUIPO
// ---------------------------------------------------------------------
export const exportarHistorialEquipoExcel = async (equipo, registros, filtroTxt = '') => {
  const lista = ordenar(registros || []);
  if (!equipo || !equipo.afi) return alert('No hay equipo seleccionado.');
  if (!lista.length) return alert('Este equipo no tiene registros en el Historial (con los filtros actuales).');
  exportandoHistorial.value = true;
  try {
    const { wb, logo } = await nuevoLibro();
    const desc = [equipo.tipo, equipo.marca, equipo.modelo].filter(Boolean).join(' · ');
    const titulo = `HOJA DE VIDA · AFI ${equipo.afi}`;
    const sub = `${desc}  ·  ${subtituloFiltros(lista)}${filtroTxt ? '  ·  ' + filtroTxt : ''}`;
    const u = esPat(equipo.afi) ? 'km' : 'h';
    const h = equipo.horometros || {};
    const fallas = lista.filter(esFalla);
    await hojaDashboard(wb, logo, {
      nombre: 'Resumen', titulo, subtitulo: sub,
      kpis: kpisDe(lista, [{ t: 'Total OC del equipo', v: totalOCEquipo(equipo.afi), fmt: PESOS, sub: `${ocsDelEquipo(equipo.afi).length} OC`, color: 'indigo' }]),
      graficos: [
        ...(fallas.length ? [{ titulo: 'Fallas por sistema', cfg: grafBarras(contar(fallas, r => categorizar(r).label).slice(0, 8), '#dc2626') }] : []),
        { titulo: 'Registros por mes', cfg: grafBarras(porMes(lista), '#4f46e5', false) }
      ],
      tablas: [
        { titulo: 'FICHA DEL EQUIPO', columnas: [{ t: 'AFI' }, { t: 'TIPO' }, { t: 'MARCA / MODELO' }, { t: 'ESTADO' }, { t: `${u === 'km' ? 'KM' : 'HORÓMETRO'} APROX.`, fmt: '#,##0' }, { t: 'PRÓXIMA MANT.' }],
          filas: [[equipo.afi, equipo.tipo || '-', [equipo.marca, equipo.modelo].filter(Boolean).join(' ') || '-', equipo.disponibilidad || '-',
            Number(h.hAprox) || '-', h.hTarget ? `${Number(h.hTarget).toLocaleString('es-CL')} ${u}${h.fechaEstimada && h.fechaEstimada !== '-' ? ' · ' + formatDateForDisplay(h.fechaEstimada) : ''}` : '-']] },
        { titulo: 'REGISTROS POR CAUSA', columnas: [{ t: 'CAUSA' }, { t: 'REGISTROS' }, { t: '%', fmt: '0%' }],
          filas: contar(lista, r => String(r.causa || 'SIN CAUSA').trim().toUpperCase()).map(([k, n]) => [k, n, n / lista.length]),
          total: ['TOTAL', lista.length, 1] },
        ...(fallas.length ? [{ titulo: 'PIEZAS QUE MÁS FALLAN', columnas: [{ t: 'PIEZA · MOTIVO' }, { t: 'VECES' }],
          filas: contar(fallas, r => piezaMotivoTexto(r)).filter(([k]) => !/^Pieza no indicada · motivo no indicado$/.test(k)).slice(0, 10) }] : [])
      ]
    });
    hojaDetalle(wb, logo, lista, { titulo, subtitulo: sub, conEquipo: false });
    hojaFiltros(wb, logo, lista, { titulo: `${titulo} · FILTROS Y ACEITES`, subtitulo: desc, conEquipo: false });
    await descargarLibro(wb, `Hoja_de_vida_AFI_${String(equipo.afi).replace(/[^\w-]/g, '')}_${hoyISO()}.xlsx`);
  } catch (err) { alert('No se pudo exportar: ' + errMsg(err)); }
  finally { exportandoHistorial.value = false; }
};

// ---------------------------------------------------------------------
// HISTORIAL GENERAL (lo filtrado en el módulo Historial)
// ---------------------------------------------------------------------
export const exportarHistorialGeneralExcel = async (registros, filtroTxt = '') => {
  const lista = ordenar(registros || []);
  if (!lista.length) return alert('No hay registros para exportar con los filtros actuales.');
  exportandoHistorial.value = true;
  try {
    const { wb, logo } = await nuevoLibro();
    const titulo = 'HISTORIAL DE MANTENCIONES E INTERVENCIONES';
    const sub = `${subtituloFiltros(lista)}${filtroTxt ? '  ·  ' + filtroTxt : ''}`;
    const fallas = lista.filter(esFalla);
    // Por equipo
    const porEq = new Map();
    lista.forEach(r => {
      const k = String(r.afi || '').trim().toUpperCase(); if (!k) return;
      const x = porEq.get(k) || { afi: r.afi, n: 0, mant: 0, fallas: 0, horas: 0, costo: 0, ultima: '' };
      x.n++; if (claseMantencion(r) === 'COMPLETA') x.mant++; if (esFalla(r)) x.fallas++;
      x.horas += Number(horas(r)) || 0; x.costo += costoReg(r);
      const f = normalizarFecha(r.fecha); if (f && f > x.ultima) x.ultima = f;
      porEq.set(k, x);
    });
    const equipos = [...porEq.values()].sort((a, b) => b.n - a.n);
    await hojaDashboard(wb, logo, {
      nombre: 'Resumen', titulo, subtitulo: sub,
      kpis: kpisDe(lista, [{ t: 'Equipos', v: equipos.length, color: 'indigo' }]),
      graficos: [
        { titulo: 'Registros por causa', cfg: grafBarras(contar(lista, r => String(r.causa || 'SIN CAUSA').trim().toUpperCase()).slice(0, 10), '#4f46e5') },
        { titulo: 'Registros por mes', cfg: grafBarras(porMes(lista), '#0f766e', false) },
        ...(fallas.length ? [{ titulo: 'Fallas por sistema', cfg: grafBarras(contar(fallas, r => categorizar(r).label).slice(0, 8), '#dc2626') }] : [])
      ],
      tablas: [
        { titulo: 'EQUIPOS CON MÁS REGISTROS', columnas: [{ t: 'AFI' }, { t: 'EQUIPO' }, { t: 'REGISTROS' }, { t: 'MANTENCIONES' }, { t: 'FALLAS' }, { t: 'COSTO', fmt: PESOS }],
          filas: equipos.slice(0, 20).map(x => { const e = buscarEquipoPorAfi(x.afi); return [x.afi, [e?.tipo, e?.modelo].filter(Boolean).join(' ') || '-', x.n, x.mant, x.fallas, x.costo]; }) }
      ]
    });
    hojaDetalle(wb, logo, lista, { titulo, subtitulo: sub, conEquipo: true });
    hojaTabla(wb, logo, {
      nombre: 'Por equipo', titulo: 'HISTORIAL · RESUMEN POR EQUIPO', subtitulo: sub,
      columnas: [{ t: 'AFI', w: 9, bold: true }, { t: 'TIPO', w: 18 }, { t: 'MARCA', w: 14 }, { t: 'MODELO', w: 14 }, { t: 'REGISTROS', w: 10 }, { t: 'MANTENCIONES', w: 12 },
        { t: 'FALLAS', w: 9 }, { t: 'HORAS TRABAJO', w: 11, fmt: '0.0' }, { t: 'COSTO', w: 13, fmt: PESOS }, { t: 'ÚLTIMO REGISTRO', w: 13, fmt: 'dd-mm-yyyy' }],
      filas: equipos.map(x => { const e = buscarEquipoPorAfi(x.afi); return [x.afi, e?.tipo || '-', e?.marca || '-', e?.modelo || '-', x.n, x.mant, x.fallas, Math.round(x.horas * 10) / 10, x.costo, fechaExcel(x.ultima)]; }),
      totales: ['TOTAL', `${equipos.length} equipos`, '', '', lista.length, equipos.reduce((s, x) => s + x.mant, 0), equipos.reduce((s, x) => s + x.fallas, 0),
        Math.round(equipos.reduce((s, x) => s + x.horas, 0) * 10) / 10, equipos.reduce((s, x) => s + x.costo, 0), '']
    });
    hojaFiltros(wb, logo, lista, { titulo: 'HISTORIAL · FILTROS Y ACEITES', subtitulo: sub, conEquipo: true });
    await descargarLibro(wb, `Historial_${hoyISO()}.xlsx`);
  } catch (err) { alert('No se pudo exportar: ' + errMsg(err)); }
  finally { exportandoHistorial.value = false; }
};

export { COLOR };
