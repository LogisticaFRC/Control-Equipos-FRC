// =====================================================================
// EXPORTAR TODO (Configuración) · Respaldo COMPLETO de la base en un Excel con formato
//   · Hoja "Resumen": KPI + índice de hojas (registros y columnas de cada tabla)
//   · Historial con el mismo formato del módulo Historial (detalle + datos completos + filtros)
//   · Una hoja por CADA tabla de Supabase con TODAS sus columnas (logo, títulos centrados, filtros)
// Se leen las tablas directo de Supabase (de a 1000 filas) para no depender de lo cargado en pantalla.
// =====================================================================
import { supabaseClient } from './supabase.js';
import { TABLAS } from './tablas.js';
import { nuevoLibro, hojaTabla, hojaDashboard, descargarLibro, fechaExcel } from './excel.js';
import { dbIntervenciones } from './store.js';
import { hoyISO } from './utils.js';
import { hojaDetalle, hojaCompleta, hojaFiltros } from '../modules/historial/historial.export.js';

const { ref } = Vue;
export const exportandoTodo = ref(false);
export const progresoTodo = ref('');

/** Nombre legible de cada tabla (y orden en el libro). */
const NOMBRES = {
  INVENTARIO: 'Inventario de equipos', MOVIMIENTOS: 'Movimientos', HISTORIAL: 'Historial (base)', USUARIOS: 'Usuarios',
  PROGRAMAS: 'Programas', PROGRAMAS_ITEMS: 'Programas - asignaciones', PROGRAMAS_CARPETAS: 'Programas - carpetas',
  EQUIPOS_ELIMINADOS: 'Equipos eliminados', MODELOS_FICHA: 'Modelos ficha técnica', FORMATOS: 'Formatos y documentos',
  FILTROS: 'Filtros por modelo', FILTROS_PRECIOS: 'Filtros - precios', BODEGA_STOCK: 'Bodega - stock', BODEGA_KITS: 'Bodega - kits',
  BODEGA_KITS_ITEMS: 'Bodega - items de kits', BODEGA_MOV: 'Bodega - movimientos', MINUTAS: 'Minutas', MINUTAS_ITEMS: 'Minutas - tareas',
  OT: 'Órdenes de trabajo (OT)', OC: 'Órdenes de compra (OC)', LOCACIONES: 'Áreas y locaciones', TALLER_PROBLEMAS: 'Taller - problemas',
  TALLER: 'Taller - reparaciones', TRABAJADORES: 'Trabajadores', EPP_ENTREGAS: 'EPP - entregas', VEHICULOS: 'Vehículos',
  VEHICULOS_KM: 'Vehículos - kilometraje', VEHICULOS_DOCS: 'Vehículos - documentos', RECORDATORIOS: 'Mis tareas',
  RECORDATORIOS_ESTADO: 'Mis tareas - estados', MOTORES_EXTERNOS: 'Motores externos', MEC_INTERVENCIONES: 'Mecánicos - intervenciones'
};
/** Columnas que no se exportan (técnicas o sensibles). */
const OMITIR = new Set(['auth_id', 'clave', 'password', 'contrasena', 'token']);

const leerTabla = async (tabla) => {
  const out = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabaseClient.from(tabla).select('*').range(desde, desde + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
};

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ES_FECHA_HORA = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const fechaHoraTxt = (s) => { const d = new Date(s); return isNaN(d) ? s : d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const limpiarObj = (v) => JSON.stringify(v, (k, x) => (typeof x === 'string' && x.startsWith('data:') ? '[imagen]' : x));
/** Texto legible de un jsonb (listas de objetos → una línea por elemento). */
const textoJSON = (v) => {
  if (Array.isArray(v)) return v.map(x => (x && typeof x === 'object')
    ? Object.entries(x).filter(([, y]) => y !== '' && y != null).map(([k, y]) => `${k}: ${typeof y === 'string' && y.startsWith('data:') ? '[firma]' : typeof y === 'object' ? limpiarObj(y) : y}`).join(' · ')
    : String(x)).join('\n');
  return Object.entries(v).filter(([, y]) => y !== '' && y != null).map(([k, y]) => `${k}: ${typeof y === 'string' && y.startsWith('data:') ? '[imagen]' : typeof y === 'object' ? limpiarObj(y) : y}`).join('\n');
};
const titulo = (k) => String(k).replace(/_/g, ' ').toUpperCase();

/** Convierte las filas de una tabla en columnas/filas con formato para hojaTabla. */
const prepararTabla = (rows) => {
  const claves = [];
  rows.forEach(r => Object.keys(r).forEach(k => { if (!OMITIR.has(k) && !claves.includes(k)) claves.push(k); }));
  // id primero, después afi / fecha, el resto en su orden
  const prio = ['id', 'afi', 'fecha'];
  claves.sort((a, b) => (prio.includes(a) ? prio.indexOf(a) : 99) - (prio.includes(b) ? prio.indexOf(b) : 99));
  const columnas = claves.map(k => {
    const vals = rows.map(r => r[k]).filter(v => v !== null && v !== undefined && v !== '');
    const esF = vals.length && vals.every(v => typeof v === 'string' && ES_FECHA.test(v));
    const esNum = vals.length && vals.every(v => typeof v === 'number');
    const largo = Math.max(titulo(k).length * 0.9, ...vals.slice(0, 300).map(v => Math.min(60, String(typeof v === 'object' ? textoJSON(v) : v).split('\n')[0].length)));
    return { k, t: titulo(k), w: Math.max(8, Math.min(45, Math.round(largo + 2))), fmt: esF ? 'dd-mm-yyyy' : esNum && /costo|precio|monto|valor|total/i.test(k) ? '"$"#,##0' : undefined, al: largo > 30 ? 'left' : undefined, esF, bold: k === 'afi' || k === 'id' };
  });
  const filas = rows.map(r => columnas.map(c => {
    const v = r[c.k];
    if (v === null || v === undefined || v === '') return '';
    if (c.esF) return fechaExcel(v);
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    if (typeof v === 'object') return textoJSON(v).slice(0, 30000);
    if (typeof v === 'string') {
      if (v.startsWith('data:')) return '[imagen]';
      if (/^https?:\/\//i.test(v.trim()) && !/\s/.test(v.trim())) return { text: 'Abrir', hyperlink: v.trim() };
      if (ES_FECHA_HORA.test(v)) return fechaHoraTxt(v);
      return v.slice(0, 30000);
    }
    return v;
  }));
  return { columnas, filas };
};

/** Alto de fila según el texto más largo y links en azul. */
const pulirHoja = (ws, columnas, n) => {
  for (let i = 0; i < n; i++) {
    const row = ws.getRow(7 + i); let lineas = 1;
    columnas.forEach((c, j) => {
      const cell = row.getCell(j + 1), v = cell.value;
      if (v && v.hyperlink) { cell.font = { size: 9, color: { argb: 'FF1D4ED8' }, underline: true, bold: true }; return; }
      if (typeof v !== 'string' || !v) return;
      const porLinea = Math.max(6, Math.floor((c.w || 14) * 1.15));
      lineas = Math.max(lineas, v.split('\n').reduce((s, p) => s + Math.max(1, Math.ceil(p.length / porLinea)), 0));
    });
    row.height = Math.min(160, Math.max(18, lineas * 12 + 6));
  }
};

export const exportarTodoExcel = async () => {
  if (exportandoTodo.value) return;
  exportandoTodo.value = true;
  try {
    const { wb, logo } = await nuevoLibro();
    const resultados = [];
    const claves = Object.keys(NOMBRES).filter(k => TABLAS[k]).concat(Object.keys(TABLAS).filter(k => !NOMBRES[k]));
    for (const k of claves) {
      progresoTodo.value = `Leyendo ${NOMBRES[k] || TABLAS[k]}…`;
      try { resultados.push({ k, tabla: TABLAS[k], nombre: NOMBRES[k] || TABLAS[k], rows: await leerTabla(TABLAS[k]) }); }
      catch (err) { resultados.push({ k, tabla: TABLAS[k], nombre: NOMBRES[k] || TABLAS[k], rows: [], error: err.message || 'sin acceso' }); }
    }
    progresoTodo.value = 'Armando el Excel…';
    const n = (k) => (resultados.find(r => r.k === k)?.rows.length) || 0;
    const sub = `Respaldo completo de la base de datos · ${resultados.filter(r => r.rows.length).length} tablas con datos`;
    await hojaDashboard(wb, logo, {
      nombre: 'Resumen', titulo: 'EXPORTACIÓN COMPLETA DEL SISTEMA', subtitulo: sub,
      kpis: [
        { t: 'Equipos', v: n('INVENTARIO'), color: 'indigo' }, { t: 'Registros historial', v: n('HISTORIAL'), color: 'verde' },
        { t: 'Movimientos', v: n('MOVIMIENTOS'), color: 'gris' }, { t: 'OT', v: n('OT'), color: 'ambar' },
        { t: 'OC', v: n('OC'), color: 'rojo' }, { t: 'Usuarios', v: n('USUARIOS'), color: 'indigo' },
        { t: 'Programas', v: n('PROGRAMAS'), color: 'verde' }, { t: 'Intervenciones app', v: n('MEC_INTERVENCIONES'), color: 'gris' },
        { t: 'Vehículos', v: n('VEHICULOS'), color: 'ambar' }, { t: 'Trabajadores', v: n('TRABAJADORES'), color: 'indigo' },
        { t: 'Documentos', v: n('FORMATOS'), color: 'verde' }, { t: 'Total registros', v: resultados.reduce((s, r) => s + r.rows.length, 0), color: 'rojo' }
      ],
      tablas: [{
        titulo: 'CONTENIDO DEL ARCHIVO', columnas: [{ t: 'HOJA' }, { t: 'TABLA EN LA BASE' }, { t: 'REGISTROS' }, { t: 'ESTADO' }],
        filas: [
          ['Historial (formato)', 'BD_HISTORIAL', dbIntervenciones.value.length, 'Detalle + datos completos + filtros'],
          ...resultados.map(r => [r.nombre, r.tabla, r.rows.length, r.error ? 'Sin acceso / no existe' : r.rows.length ? 'Incluida (todas las columnas)' : 'Vacía'])
        ],
        total: ['TOTAL', '', resultados.reduce((s, r) => s + r.rows.length, 0), '']
      }]
    });
    // Historial con el mismo formato del módulo Historial
    const hist = [...dbIntervenciones.value].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    if (hist.length) {
      const t = 'HISTORIAL DE MANTENCIONES E INTERVENCIONES', s = `${hist.length} registro(s) · todos los equipos`;
      hojaDetalle(wb, logo, hist, { titulo: t, subtitulo: s, conEquipo: true });
      hojaCompleta(wb, logo, hist, { titulo: t, subtitulo: s });
      hojaFiltros(wb, logo, hist, { titulo: 'HISTORIAL · FILTROS Y ACEITES', subtitulo: s, conEquipo: true });
    }
    // Una hoja por tabla, con TODAS las columnas
    for (const r of resultados) {
      if (!r.rows.length) continue;
      progresoTodo.value = `Hoja ${r.nombre}…`;
      const { columnas, filas } = prepararTabla(r.rows);
      const ws = hojaTabla(wb, logo, { nombre: r.nombre, titulo: r.nombre.toUpperCase(), subtitulo: `Tabla ${r.tabla} · ${r.rows.length} registro(s) · ${columnas.length} columnas`, columnas, filas });
      pulirHoja(ws, columnas, filas.length);
      ws.headerFooter = { oddFooter: `&L&8FAST RENTAL CHILE · ${r.nombre.replace(/&/g, '&&')}&R&8Página &P de &N` };
      ws.pageSetup.printTitlesRow = '6:6';
    }
    progresoTodo.value = 'Descargando…';
    await descargarLibro(wb, `FRC_Exportacion_completa_${hoyISO()}.xlsx`);
  } catch (err) { alert('No se pudo exportar: ' + (err.message || err)); }
  finally { exportandoTodo.value = false; progresoTodo.value = ''; }
};
