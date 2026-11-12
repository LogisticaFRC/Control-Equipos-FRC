// =====================================================================
// PROGRAMA REPARACIÓN MOTORES (externos) · Operaciones → Gestión
// ---------------------------------------------------------------------
// Equipos (por ahora COMPRESORES) cuyo motor se envía a reparar a un proveedor externo o taller.
// Cada fila: STATUS (PENDIENTE · PROCESO · TERMINADO) · AFI · proveedor · fecha en que se lleva / se llevó ·
// fecha término · trabajo o etapa (Evaluación, Reparación inyectores, Montaje motor ajustado…) · observación.
// "Nueva etapa": guarda la etapa actual en la bitácora (etapas jsonb) y abre la siguiente.
// Tabla bd_motores_externos (sql/motores_externos.sql). Se carga al abrir la pantalla.
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { TABLAS } from '../../core/tablas.js';
import { usuarioActivo, dbEquipos, soloEditor, soloAdmin } from '../../core/store.js';
import { hoyISO, normalizarFecha, formatDateForDisplay, diasEntre, mismoAfi, limpiarAfi } from '../../core/utils.js';
import { nuevoLibro, hojaTabla, hojaDashboard, descargarLibro, fechaExcel, bloqueFirmas, FIRMAS_PROGRAMA } from '../../core/excel.js';

const { ref, computed } = Vue;

export const TABLA_MOTORES = TABLAS.MOTORES_EXTERNOS;
/** Tipos de equipo que se pueden elegir (por ahora solo compresores). */
export const TIPOS_EQUIPO = ['COMPRESOR'];
export const ESTADOS = ['PENDIENTE', 'PROCESO', 'TERMINADO'];
export const ESTILO_ESTADO = {
  PENDIENTE: 'bg-amber-100 text-amber-800 border-amber-300',
  PROCESO: 'bg-sky-100 text-sky-800 border-sky-300',
  TERMINADO: 'bg-emerald-100 text-emerald-800 border-emerald-300'
};
export const PROVEEDORES_BASE = ['DIEGO TORRES', 'TALLER TNTE', 'TALLER FRC'];
export const TRABAJOS_BASE = ['Evaluación', 'Pendiente evaluación', 'Desmontaje motor', 'Reparación motor', 'Reparación inyectores',
  'Montaje motor ajustado', 'Montaje motor ajustado y pruebas', 'Pruebas', 'Limpieza estanques diésel', 'Retiro desde proveedor'];

// ---------- Datos ----------
export const dbMotores = ref([]);
export const cargandoMotores = ref(false);
export const faltaSQLMotores = ref(false);

const mapMotor = (r) => ({
  ...r,
  afi: String(r.afi || ''),
  proveedor: String(r.proveedor || ''),
  fecha_envio: r.fecha_envio ? String(r.fecha_envio).slice(0, 10) : '',
  fecha_termino: r.fecha_termino ? String(r.fecha_termino).slice(0, 10) : '',
  trabajo: String(r.trabajo || ''),
  estado: ESTADOS.includes(String(r.estado || '').toUpperCase()) ? String(r.estado).toUpperCase() : 'PENDIENTE',
  observacion: String(r.observacion || ''),
  etapas: Array.isArray(r.etapas) ? r.etapas : []
});

export const cargarMotores = async () => {
  cargandoMotores.value = true;
  try {
    const data = await sb(supabaseClient.from(TABLA_MOTORES).select('*').order('id'));
    dbMotores.value = data.map(mapMotor);
    faltaSQLMotores.value = false;
  } catch (err) {
    if (/bd_motores_externos|does not exist|schema cache/i.test(errMsg(err))) faltaSQLMotores.value = true;
    else alert('No se pudo cargar el programa de motores: ' + errMsg(err));
  } finally { cargandoMotores.value = false; }
};

// ---------- Equipos ----------
const up = (s) => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const equiposElegibles = computed(() => dbEquipos.value.filter(e => TIPOS_EQUIPO.some(t => up(e.tipo).includes(t))));
export const equipoDe = (afi) => dbEquipos.value.find(e => mismoAfi(e.afi, afi)) || null;
export const descEquipo = (afi) => { const e = equipoDe(afi); return e ? [e.tipo, e.marca, e.modelo].filter(Boolean).join(' · ') : 'No está en el inventario'; };

// ---------- Fechas / alertas ----------
/** Fecha en que empezó todo el proceso (primera etapa). */
export const inicioProceso = (m) => (m.etapas.find(e => e.desde) || {}).desde || m.fecha_envio || '';
/** Días desde que empezó el proceso (hasta hoy, o hasta el término si está TERMINADO). */
export const diasFuera = (m) => {
  const ini = inicioProceso(m);
  if (!ini || ini > hoyISO()) return null;
  const hasta = m.estado === 'TERMINADO' && m.fecha_termino ? m.fecha_termino : hoyISO();
  return diasEntre(hasta, ini);
};
/** Historial completo del equipo: etapas anteriores + la actual (más antigua primero). */
export const historialMotor = (m) => [...m.etapas.map((e, i) => ({ ...e, _i: i })), { desde: m.fecha_envio, fecha: m.fecha_termino, trabajo: m.trabajo, estado: m.estado, proveedor: m.proveedor, nota: m.observacion, actual: true }];
/** Días para la fecha de término (negativo = atrasado). null si no hay fecha o ya terminó. */
export const diasParaTermino = (m) => (m.estado === 'TERMINADO' || !m.fecha_termino ? null : diasEntre(m.fecha_termino, hoyISO()));
export const atrasado = (m) => { const d = diasParaTermino(m); return d !== null && d < 0; };
export const textoTermino = (m) => {
  const d = diasParaTermino(m);
  if (d === null) return '';
  if (d < 0) return `Atrasado ${-d} día${d === -1 ? '' : 's'}`;
  if (d === 0) return 'Termina hoy';
  return `Faltan ${d} día${d === 1 ? '' : 's'}`;
};

// ---------- Filtros y resumen ----------
export const filtroMotores = ref({ texto: '', estado: '', proveedor: '' });
const ORDEN_ESTADO = { PROCESO: 0, PENDIENTE: 1, TERMINADO: 2 };
export const listaMotores = computed(() => {
  const f = filtroMotores.value; const q = f.texto.trim().toLowerCase();
  return dbMotores.value.filter(m => {
    if (f.estado === 'ATRASADO' ? !atrasado(m) : (f.estado && m.estado !== f.estado)) return false;
    if (f.proveedor && up(m.proveedor) !== up(f.proveedor)) return false;
    if (!q) return true;
    return [m.afi, m.proveedor, m.trabajo, m.observacion, descEquipo(m.afi)].join(' ').toLowerCase().includes(q);
  }).sort((a, b) => (ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado])
    || (atrasado(b) - atrasado(a))
    || String(a.fecha_termino || '9999').localeCompare(String(b.fecha_termino || '9999'))
    || String(a.afi).localeCompare(String(b.afi), undefined, { numeric: true }));
});
export const resumenMotores = computed(() => {
  const r = { total: dbMotores.value.length, PENDIENTE: 0, PROCESO: 0, TERMINADO: 0, ATRASADO: 0 };
  dbMotores.value.forEach(m => { r[m.estado]++; if (atrasado(m)) r.ATRASADO++; });
  return r;
});
export const proveedoresUsados = computed(() => Array.from(new Set([...PROVEEDORES_BASE, ...dbMotores.value.map(m => up(m.proveedor)).filter(Boolean)])).sort());
export const trabajosUsados = computed(() => Array.from(new Set([...TRABAJOS_BASE, ...dbMotores.value.map(m => m.trabajo).filter(Boolean)])));

// ---------- Formulario ----------
export const formMotor = ref(null);   // { modo: 'nuevo' | 'editar' | 'etapa', ... }
const vacio = () => ({ id: null, afi: '', proveedor: '', fecha_envio: hoyISO(), fecha_termino: '', trabajo: 'Evaluación', estado: 'PROCESO', observacion: '', etapas: [] });
export const abrirNuevoMotor = () => { if (!soloEditor()) return; formMotor.value = { modo: 'nuevo', ...vacio() }; };
export const abrirEditarMotor = (m) => { formMotor.value = { modo: 'editar', ...JSON.parse(JSON.stringify(m)) }; };
/** Nueva etapa: la actual pasa a la bitácora; se abre el formulario con la etapa siguiente. */
export const abrirNuevaEtapa = (m) => {
  if (!soloEditor()) return;
  // la etapa nueva parte donde terminó la actual (ej. 9→13 evaluación; 13→20 reparación)
  const desde = m.fecha_termino && m.fecha_termino <= hoyISO() ? m.fecha_termino : hoyISO();
  formMotor.value = { modo: 'etapa', ...JSON.parse(JSON.stringify(m)), trabajo: '', fecha_envio: desde, fecha_termino: '', estado: 'PROCESO', observacion: '', _anterior: m, _cierreAnterior: m.fecha_termino || desde };
};
export const cerrarFormMotor = () => { formMotor.value = null; };
export const guardandoMotor = ref(false);

const fila = (f) => ({
  afi: limpiarAfi(f.afi),
  proveedor: up(f.proveedor) || null,
  fecha_envio: normalizarFecha(f.fecha_envio) || null,
  fecha_termino: normalizarFecha(f.fecha_termino) || null,
  trabajo: String(f.trabajo || '').trim() || null,
  estado: ESTADOS.includes(f.estado) ? f.estado : 'PENDIENTE',
  observacion: String(f.observacion || '').trim() || null,
  updated_at: new Date().toISOString()
});
const evento = (m) => ({ fecha: m.fecha_termino || hoyISO(), desde: m.fecha_envio || '', trabajo: m.trabajo, estado: m.estado, proveedor: m.proveedor, nota: m.observacion || '', usuario: usuarioActivo.value?.usuario || '', registrado: new Date().toISOString() });

export const guardarMotor = async () => {
  if (!soloEditor()) return;
  const f = formMotor.value;
  if (!String(f.afi || '').trim()) return alert('Elige el AFI del equipo.');
  if (!String(f.proveedor || '').trim()) return alert('Escribe el proveedor o taller al que se lleva.');
  const p = fila(f);
  if (p.fecha_envio && p.fecha_termino && p.fecha_termino < p.fecha_envio) return alert('La fecha de término no puede ser anterior a la fecha en que se lleva.');
  if (f.modo === 'nuevo' && dbMotores.value.some(m => mismoAfi(m.afi, p.afi) && m.estado !== 'TERMINADO')
      && !confirm(`El AFI ${p.afi} ya está en el programa sin terminar. ¿Agregarlo otra vez?`)) return;
  guardandoMotor.value = true;
  try {
    if (f.modo === 'nuevo') {
      await sb(supabaseClient.from(TABLA_MOTORES).insert([{ ...p, etapas: [], creado_por: usuarioActivo.value?.usuario || null }]));
    } else if (f.modo === 'etapa') {
      // la etapa anterior queda cerrada en la bitácora con su fecha de término
      const anterior = { ...f._anterior, fecha_termino: normalizarFecha(f._cierreAnterior) || f._anterior.fecha_termino };
      const etapas = [...(f._anterior.etapas || []), { ...evento(anterior), estado: 'TERMINADO' }];   // etapa pasada = terminada
      await sb(supabaseClient.from(TABLA_MOTORES).update({ ...p, etapas }).eq('id', f.id));
    } else {
      await sb(supabaseClient.from(TABLA_MOTORES).update(p).eq('id', f.id));
    }
    formMotor.value = null;
    await cargarMotores();
  } catch (err) { alert('No se pudo guardar: ' + errMsg(err)); }
  finally { guardandoMotor.value = false; }
};

/** Cambio rápido de STATUS desde la tabla (al pasar a TERMINADO, si no tiene fecha de término queda hoy). */
export const cambiarEstadoMotor = async (m, estado) => {
  if (!soloEditor()) return;
  const cambios = { estado, updated_at: new Date().toISOString() };
  if (estado === 'TERMINADO' && !m.fecha_termino) cambios.fecha_termino = hoyISO();
  if (estado === 'PROCESO' && !m.fecha_envio) cambios.fecha_envio = hoyISO();
  try {
    await sb(supabaseClient.from(TABLA_MOTORES).update(cambios).eq('id', m.id));
    Object.assign(m, cambios);
  } catch (err) { alert('No se pudo cambiar el status: ' + errMsg(err)); }
};

/** Borra UNA etapa del historial (no el equipo ni las demás etapas). */
export const eliminarEtapa = async (m, i) => {
  if (!soloAdmin()) return;
  const e = m.etapas[i]; if (!e) return;
  if (!confirm(`¿Borrar del historial del AFI ${m.afi} la etapa "${e.trabajo || '—'}" (${formatDateForDisplay(e.desde) || '¿?'} → ${formatDateForDisplay(e.fecha) || '¿?'})?\nEl resto del historial y la etapa actual no cambian.`)) return;
  const etapas = m.etapas.filter((_, k) => k !== i);
  try {
    await sb(supabaseClient.from(TABLA_MOTORES).update({ etapas, updated_at: new Date().toISOString() }).eq('id', m.id));
    m.etapas = etapas;
  } catch (err) { alert('No se pudo borrar la etapa: ' + errMsg(err)); }
};
/** Borra la etapa ACTUAL (ej. se agregó por error): el equipo vuelve a la etapa anterior del historial. */
export const borrarEtapaActual = async (m) => {
  if (!soloAdmin()) return;
  if (!m.etapas.length) return alert('Es la única etapa del equipo: para quitarlo del programa usa el botón eliminar (basurero).');
  const prev = m.etapas[m.etapas.length - 1];
  if (!confirm(`¿Borrar la etapa actual "${m.trabajo || '—'}" del AFI ${m.afi}?\nEl equipo vuelve a la etapa anterior: "${prev.trabajo || '—'}" (${formatDateForDisplay(prev.desde) || '¿?'} → ${formatDateForDisplay(prev.fecha) || '¿?'}).`)) return;
  const cambios = {
    proveedor: prev.proveedor || m.proveedor || null, fecha_envio: normalizarFecha(prev.desde) || null, fecha_termino: normalizarFecha(prev.fecha) || null,
    trabajo: prev.trabajo || null, observacion: prev.nota || null, estado: m.estado === 'TERMINADO' ? 'TERMINADO' : 'PROCESO',
    etapas: m.etapas.slice(0, -1), updated_at: new Date().toISOString()
  };
  try {
    await sb(supabaseClient.from(TABLA_MOTORES).update(cambios).eq('id', m.id));
    Object.assign(m, mapMotor({ ...m, ...cambios }));
  } catch (err) { alert('No se pudo borrar la etapa: ' + errMsg(err)); }
};

export const eliminarMotor = async (m) => {
  if (!soloAdmin()) return;
  if (!confirm(`¿Eliminar el AFI ${m.afi} del programa de motores?`)) return;
  try {
    await sb(supabaseClient.from(TABLA_MOTORES).delete().eq('id', m.id));
    dbMotores.value = dbMotores.value.filter(x => x.id !== m.id);
  } catch (err) { alert('No se pudo eliminar: ' + errMsg(err)); }
};

// ---------- Excel (Resumen con gráficos · Programa · Por proveedor · Etapas) ----------
export const exportandoMotores = ref(false);
export const exportarMotoresExcel = async () => {
  exportandoMotores.value = true;
  try {
    const { wb, logo } = await nuevoLibro();
    const filas = listaMotores.value;
    const r = { total: filas.length, PENDIENTE: 0, PROCESO: 0, TERMINADO: 0, ATRASADO: 0 };
    filas.forEach(m => { r[m.estado]++; if (atrasado(m)) r.ATRASADO++; });
    const fuera = filas.filter(m => m.estado !== 'TERMINADO').map(diasFuera).filter(d => d !== null);
    const prom = fuera.length ? Math.round(fuera.reduce((a, b) => a + b, 0) / fuera.length) : 0;
    const sub = `Compresores · al ${formatDateForDisplay(hoyISO())}` + (filtroMotores.value.estado || filtroMotores.value.proveedor || filtroMotores.value.texto ? ' · (filtrado)' : '');
    // por proveedor
    const provs = {};
    filas.forEach(m => {
      const k = m.proveedor || 'SIN PROVEEDOR';
      const x = provs[k] || (provs[k] = { prov: k, total: 0, PENDIENTE: 0, PROCESO: 0, TERMINADO: 0, ATRASADO: 0, afis: [] });
      x.total++; x[m.estado]++; if (atrasado(m)) x.ATRASADO++; x.afis.push(m.afi);
    });
    const listaProv = Object.values(provs).sort((a, b) => b.total - a.total);
    const COL = { PENDIENTE: '#f59e0b', PROCESO: '#0ea5e9', TERMINADO: '#10b981' };

    await hojaDashboard(wb, logo, {
      nombre: 'Resumen', titulo: 'PROGRAMA REPARACIÓN MOTORES', subtitulo: sub,
      kpis: [
        { t: 'Equipos', v: r.total, sub: 'en el programa', color: 'indigo' },
        { t: 'Proceso', v: r.PROCESO, sub: 'en reparación', color: 'indigo' },
        { t: 'Pendientes', v: r.PENDIENTE, sub: 'por enviar / evaluar', color: 'ambar' },
        { t: 'Terminados', v: r.TERMINADO, color: 'verde' },
        { t: 'Atrasados', v: r.ATRASADO, sub: 'pasada la fecha término', color: r.ATRASADO ? 'rojo' : 'gris' },
        { t: 'Días fuera (prom.)', v: prom, sub: 'equipos no terminados', color: 'gris' }
      ],
      graficos: [
        { titulo: 'Equipos por status', cfg: { type: 'doughnut', data: { labels: ESTADOS, datasets: [{ data: ESTADOS.map(e => r[e]), backgroundColor: ESTADOS.map(e => COL[e]) }] }, options: { plugins: { legend: { position: 'bottom' } } } } },
        { titulo: 'Equipos por proveedor / taller', cfg: { type: 'bar', data: { labels: listaProv.map(x => x.prov), datasets: ESTADOS.map(e => ({ label: e, data: listaProv.map(x => x[e]), backgroundColor: COL[e] })) }, options: { plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } } } }
      ],
      tablas: [
        { titulo: 'Atrasados / próximos a terminar', columnas: [{ t: 'AFI', w: 8 }, { t: 'PROVEEDOR', w: 18 }, { t: 'TRABAJO', w: 30 }, { t: 'TÉRMINO', w: 12 }, { t: 'SITUACIÓN', w: 18 }],
          filas: filas.filter(m => diasParaTermino(m) !== null && diasParaTermino(m) <= 7).sort((a, b) => diasParaTermino(a) - diasParaTermino(b))
            .map(m => [m.afi, m.proveedor, m.trabajo, formatDateForDisplay(m.fecha_termino), textoTermino(m)]) }
      ]
    });

    const color = { PENDIENTE: 'FFFEF3C7', PROCESO: 'FFE0F2FE', TERMINADO: 'FFDCFCE7' };
    const ws = hojaTabla(wb, logo, {
      nombre: 'Programa', titulo: 'Programa Reparación Motores', subtitulo: `${sub} · ${filas.length} equipo(s)`,
      columnas: [
        { t: 'N°', w: 5 }, { t: 'STATUS', w: 12, bold: true }, { t: 'AFI', w: 8, bold: true }, { t: 'EQUIPO', w: 28, al: 'left' },
        { t: 'PROVEEDOR / TALLER', w: 18 }, { t: 'INICIO PROCESO', w: 12, fmt: 'dd-mm-yyyy' }, { t: 'TÉRMINO ETAPA ACTUAL', w: 13, fmt: 'dd-mm-yyyy' },
        { t: 'ETAPA ACTUAL', w: 34, al: 'left' }, { t: 'SITUACIÓN', w: 16 }, { t: 'DÍAS EN PROCESO', w: 10 }, { t: 'N° ETAPAS', w: 8 }, { t: 'OBSERVACIÓN', w: 38, al: 'left' }
      ],
      filas: filas.map((m, i) => [i + 1, m.estado, m.afi, descEquipo(m.afi), m.proveedor, fechaExcel(inicioProceso(m)), fechaExcel(m.fecha_termino),
        m.trabajo, textoTermino(m) || (m.estado === 'TERMINADO' ? 'Terminado' : 'Sin fecha'), diasFuera(m) ?? '', m.etapas.length + 1, m.observacion]),
      estiloFila: (vals, i) => ({ fill: color[vals[1]], font: /Atrasado/.test(vals[8]) ? { bold: true, color: { argb: 'FFB91C1C' } } : undefined })
    });
    bloqueFirmas(ws, FIRMAS_PROGRAMA);

    hojaTabla(wb, logo, {
      nombre: 'Por proveedor', titulo: 'Equipos por proveedor / taller', subtitulo: sub,
      columnas: [{ t: 'PROVEEDOR / TALLER', w: 22, bold: true, al: 'left' }, { t: 'TOTAL', w: 8 }, { t: 'PROCESO', w: 9 }, { t: 'PENDIENTE', w: 10 }, { t: 'TERMINADO', w: 11 }, { t: 'ATRASADOS', w: 10 }, { t: 'AFI', w: 40, al: 'left' }],
      filas: listaProv.map(x => [x.prov, x.total, x.PROCESO, x.PENDIENTE, x.TERMINADO, x.ATRASADO, x.afis.join(', ')]),
      totales: ['TOTAL', r.total, r.PROCESO, r.PENDIENTE, r.TERMINADO, r.ATRASADO, ''],
      estiloFila: (v) => (v[5] ? { fill: 'FFFEE2E2' } : null)
    });

    const etapas = filas.flatMap(m => [...m.etapas.map((e, k) => ({ m, e, n: k + 1 })), { m, n: m.etapas.length + 1, e: { desde: m.fecha_envio, fecha: m.fecha_termino, trabajo: m.trabajo, estado: m.estado, proveedor: m.proveedor, nota: m.observacion, actual: true } }]);
    hojaTabla(wb, logo, {
      nombre: 'Etapas', titulo: 'Bitácora de etapas por motor', subtitulo: 'Cada etapa del proceso (la marcada con ▶ es la actual)',
      columnas: [{ t: 'AFI', w: 8, bold: true }, { t: 'N° ETAPA', w: 8 }, { t: 'PROVEEDOR', w: 18 }, { t: 'DESDE', w: 12, fmt: 'dd-mm-yyyy' }, { t: 'HASTA', w: 12, fmt: 'dd-mm-yyyy' },
        { t: 'TRABAJO / ETAPA', w: 38, al: 'left' }, { t: 'STATUS', w: 12 }, { t: 'NOTA', w: 40, al: 'left' }],
      filas: etapas.map(({ m, e, n }) => [m.afi, n, e.proveedor, fechaExcel(e.desde), fechaExcel(e.fecha), (e.actual ? '▶ ' : '') + (e.trabajo || ''), e.estado, e.nota]),
      estiloFila: (v) => (String(v[5]).startsWith('▶') ? { fill: color[v[6]] || 'FFE0F2FE', font: { bold: true } } : null)
    });
    await descargarLibro(wb, `Programa reparacion motores ${hoyISO()}.xlsx`);
  } catch (err) { alert('No se pudo exportar: ' + errMsg(err)); }
  finally { exportandoMotores.value = false; }
};
