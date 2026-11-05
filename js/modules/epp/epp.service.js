// =====================================================================
// EPP · Control Entrega de Elementos de Protección Personal (área Seguridad)
// ---------------------------------------------------------------------
// · Perfil de cada trabajador: nombre, RUT, cargo, tallas y qué EPP requiere (bd_trabajadores).
// · Entregar EPP: se eligen los elementos, la fecha, talla y cantidad → una fila por elemento
//   en bd_epp_entregas (historial). La última entrega de cada elemento se ve en el perfil.
// · Los datos de este módulo se cargan al abrirlo (no en la carga general del sistema).
// · bd_trabajadores queda lista para que RRHH sea después la base total de trabajadores.
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { usuarioActivo, soloAdmin, soloEditor } from '../../core/store.js';
import { hoyISO, diasEntre, formatDateForDisplay } from '../../core/utils.js';
import { nuevoLibro, hojaTabla, descargarLibro, fechaExcel, COLOR } from '../../core/excel.js';
import {
  TABLA_TRABAJADORES, TABLA_EPP_ENTREGAS, ELEMENTOS_EPP, ELEMENTOS_CON_TALLA, elementoEPP,
  TALLAS_ROPA, TALLAS_CALZADO, MOTIVOS_ENTREGA, mapTrabajador, mapEntrega, trabajadorAFila
} from './epp.mapper.js';

const { ref, computed } = Vue;

export { ELEMENTOS_EPP, ELEMENTOS_CON_TALLA, elementoEPP, TALLAS_ROPA, TALLAS_CALZADO, MOTIVOS_ENTREGA };

// ---------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------
export const dbTrabajadores = ref([]);
export const dbEntregasEPP = ref([]);
export const cargandoEPP = ref(false);
export const faltaSQLEPP = ref(false);   // las tablas no existen → falta ejecutar sql/epp.sql

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

export const cargarEPP = async () => {
  cargandoEPP.value = true;
  try {
    const [t, e] = await Promise.all([leerTodo(TABLA_TRABAJADORES), leerTodo(TABLA_EPP_ENTREGAS)]);
    dbTrabajadores.value = t.map(mapTrabajador).sort((a, b) => a.nombre.localeCompare(b.nombre));
    dbEntregasEPP.value = e.map(mapEntrega).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || b.id - a.id);
    faltaSQLEPP.value = false;
  } catch (err) {
    console.error('[EPP] Error cargando datos', err);
    const m = errMsg(err);
    if (/does not exist|relation|schema cache|not find/i.test(m)) faltaSQLEPP.value = true;
    else alert('Error al cargar Control EPP: ' + m);
  } finally { cargandoEPP.value = false; }
};

// ---------------------------------------------------------------------
// Índices y ayudas
// ---------------------------------------------------------------------
/** trabajador_id → entregas (más reciente primero). */
export const entregasPorTrabajador = computed(() => {
  const m = new Map();
  dbEntregasEPP.value.forEach(e => {
    const k = String(e.trabajadorId);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(e);
  });
  return m;
});
export const entregasDe = (t) => (t ? entregasPorTrabajador.value.get(String(t.id)) || [] : []);
export const trabajadorDe = (id) => dbTrabajadores.value.find(t => String(t.id) === String(id)) || null;

/** Última entrega de un elemento a un trabajador (o null). */
export const ultimaEntrega = (t, key) => entregasDe(t).find(e => e.elemento === key) || null;
export const ultimaEntregaGeneral = (t) => entregasDe(t)[0] || null;

export const diasDesde = (iso) => diasEntre(hoyISO(), iso);
export const textoDias = (iso) => {
  const n = diasDesde(iso);
  if (n === null) return '';
  if (n <= 0) return 'hoy';
  if (n === 1) return 'hace 1 día';
  if (n < 60) return `hace ${n} días`;
  const meses = Math.floor(n / 30);
  return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
};

/** Elementos que requiere un trabajador. */
export const requeridos = (t) => (t ? ELEMENTOS_EPP.filter(e => t.requiere[e.key]) : []);
/** Requeridos que nunca se le han entregado. */
export const pendientes = (t) => requeridos(t).filter(e => !ultimaEntrega(t, e.key));
/** Perfil incompleto: le falta cargo, no requiere nada, o requiere un elemento con talla sin talla registrada. */
export const perfilIncompleto = (t) => !t.cargo || !requeridos(t).length || requeridos(t).some(e => e.talla && !t.tallas[e.key]);

export const etiquetaTallas = (t) => {
  const s = [];
  if (t.tallas.calzado) s.push(`Calzado ${t.tallas.calzado}`);
  const ropa = ['buzo', 'pantalon', 'polera', 'parka', 'primera_capa'].map(k => t.tallas[k]).filter(Boolean);
  const unicas = [...new Set(ropa)];
  if (unicas.length === 1) s.push(`Ropa ${unicas[0]}`);
  else if (unicas.length) s.push(`Ropa ${unicas.join('/')}`);
  return s.join(' · ') || 'Sin tallas';
};
export const iniciales = (nombre) => String(nombre || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('');

// ---------------------------------------------------------------------
// Pantalla principal: pestañas, filtros y resumen
// ---------------------------------------------------------------------
export const tabEPP = ref('trabajadores');   // 'trabajadores' | 'historial' | 'planilla'

const FILTRO_T = () => ({ texto: '', cargo: '', estado: 'ACTIVOS' });
export const filtroTrab = ref(FILTRO_T());
export const limpiarFiltroTrab = () => { filtroTrab.value = FILTRO_T(); };

export const cargosLista = computed(() => [...new Set(dbTrabajadores.value.map(t => t.cargo).filter(Boolean))].sort());

export const listaTrabajadores = computed(() => {
  const f = filtroTrab.value;
  const q = f.texto.trim().toLowerCase();
  return dbTrabajadores.value.filter(t => {
    if (f.estado === 'ACTIVOS' && !t.activo) return false;
    if (f.estado === 'INACTIVOS' && t.activo) return false;
    if (f.estado === 'PENDIENTES' && (!t.activo || !pendientes(t).length)) return false;
    if (f.cargo && t.cargo !== f.cargo) return false;
    if (q && ![t.nombre, t.rut, t.cargo].join(' ').toLowerCase().includes(q)) return false;
    return true;
  });
});

export const resumenEPP = computed(() => {
  const activos = dbTrabajadores.value.filter(t => t.activo);
  const mes = hoyISO().slice(0, 7);
  const delMes = dbEntregasEPP.value.filter(e => String(e.fecha).startsWith(mes));
  return {
    activos: activos.length,
    inactivos: dbTrabajadores.value.length - activos.length,
    entregasMes: delMes.reduce((s, e) => s + e.cantidad, 0),
    trabajadoresMes: new Set(delMes.map(e => String(e.trabajadorId))).size,
    totalEntregas: dbEntregasEPP.value.reduce((s, e) => s + e.cantidad, 0),
    conPendientes: activos.filter(t => pendientes(t).length).length,
    incompletos: activos.filter(perfilIncompleto).length
  };
});

// Historial general
const FILTRO_H = () => ({ texto: '', elemento: '', desde: '', hasta: '', motivo: '' });
export const filtroHist = ref(FILTRO_H());
export const limpiarFiltroHist = () => { filtroHist.value = FILTRO_H(); };
export const listaHistorial = computed(() => {
  const f = filtroHist.value;
  const q = f.texto.trim().toLowerCase();
  return dbEntregasEPP.value.filter(e => {
    if (f.elemento && e.elemento !== f.elemento) return false;
    if (f.motivo && e.motivo !== f.motivo) return false;
    if (f.desde && e.fecha < f.desde) return false;
    if (f.hasta && e.fecha > f.hasta) return false;
    if (q) {
      const t = trabajadorDe(e.trabajadorId);
      if (![t?.nombre, t?.cargo, t?.rut, elementoEPP(e.elemento).label, e.observaciones, e.entregadoPor].join(' ').toLowerCase().includes(q)) return false;
    }
    return true;
  });
});

// ---------------------------------------------------------------------
// Perfil del trabajador
// ---------------------------------------------------------------------
export const perfilId = ref(null);
export const perfilTrabajador = computed(() => trabajadorDe(perfilId.value));
export const abrirPerfil = (t) => { perfilId.value = t.id; trabajadorForm.value = null; };
export const cerrarPerfil = () => { perfilId.value = null; trabajadorForm.value = null; };

// ---------------------------------------------------------------------
// Crear / editar trabajador
// ---------------------------------------------------------------------
const REQ_DEFAULT = () => Object.fromEntries(ELEMENTOS_EPP.map(e => [e.key, !['guante_soldador', 'fonos_auditivos'].includes(e.key)]));
const TRAB_VACIO = () => ({
  id: null, nombre: '', rut: '', cargo: '', activo: true, observaciones: '',
  tallas: Object.fromEntries(ELEMENTOS_CON_TALLA.map(e => [e.key, ''])),
  requiere: REQ_DEFAULT()
});
export const trabajadorForm = ref(null);
export const guardandoTrab = ref(false);

export const nuevoTrabajador = () => {
  if (!soloEditor()) return;
  perfilId.value = null;
  trabajadorForm.value = TRAB_VACIO();
};
export const editarTrabajador = (t) => {
  if (!soloEditor()) return;
  trabajadorForm.value = JSON.parse(JSON.stringify({ ...TRAB_VACIO(), ...t }));
};
export const cancelarTrabajador = () => { trabajadorForm.value = null; };

/** Copia la talla de la polera al resto de la ropa (atajo, la mayoría usa la misma). */
export const copiarTallaRopa = () => {
  const f = trabajadorForm.value; if (!f) return;
  const base = f.tallas.polera || f.tallas.buzo || f.tallas.pantalon;
  if (!base) return;
  ['buzo', 'pantalon', 'polera', 'parka', 'primera_capa'].forEach(k => { if (f.requiere[k] && !f.tallas[k]) f.tallas[k] = base; });
};
export const marcarTodosReq = (valor) => {
  const f = trabajadorForm.value; if (!f) return;
  ELEMENTOS_EPP.forEach(e => { f.requiere[e.key] = valor; });
};

export const guardarTrabajador = async () => {
  if (!soloEditor()) return;
  const f = trabajadorForm.value;
  if (!f) return;
  const nombre = String(f.nombre || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!nombre) { alert('Escribe el nombre del trabajador.'); return; }
  const repetido = dbTrabajadores.value.find(t => t.nombre === nombre && t.id !== f.id);
  if (repetido) { alert(`Ya existe un trabajador llamado ${nombre}.`); return; }
  const limpiaRut = (r) => String(r || '').replace(/[^0-9kK]/g, '').toUpperCase();
  if (f.rut && dbTrabajadores.value.some(t => t.id !== f.id && t.rut && limpiaRut(t.rut) === limpiaRut(f.rut))) {
    alert('Ya existe un trabajador con ese RUT.'); return;
  }
  guardandoTrab.value = true;
  try {
    const fila = trabajadorAFila({ ...f, nombre });
    let id = f.id;
    if (id) {
      await sb(supabaseClient.from(TABLA_TRABAJADORES).update(fila).eq('id', id));
    } else {
      const data = await sb(supabaseClient.from(TABLA_TRABAJADORES).insert({ ...fila, creado_por: usuarioActivo.value?.nombre || '' }).select('id').single());
      id = data.id;
    }
    await cargarEPP();
    trabajadorForm.value = null;
    perfilId.value = id;
  } catch (err) {
    alert('Error al guardar el trabajador: ' + errMsg(err));
  } finally { guardandoTrab.value = false; }
};

export const eliminarTrabajador = async (t) => {
  if (!soloAdmin()) return;
  const n = entregasDe(t).length;
  if (!confirm(`¿Eliminar a ${t.nombre}${n ? ` y sus ${n} entregas registradas` : ''}?\n\nSi solo dejó la empresa, es mejor marcarlo como INACTIVO para conservar su historial.`)) return;
  try {
    await sb(supabaseClient.from(TABLA_TRABAJADORES).delete().eq('id', t.id));
    cerrarPerfil();
    await cargarEPP();
  } catch (err) { alert('Error al eliminar: ' + errMsg(err)); }
};

// ---------------------------------------------------------------------
// Entregar EPP
// ---------------------------------------------------------------------
export const entregaForm = ref(null);
export const guardandoEntrega = ref(false);

/** Abre el formulario de entrega. soloKey → deja marcado solo ese elemento. */
export const abrirEntrega = (t, soloKey = '') => {
  if (!soloEditor()) return;
  entregaForm.value = {
    trabajadorId: t.id,
    fecha: hoyISO(),
    motivo: 'REPOSICION',
    observaciones: '',
    verTodos: Boolean(soloKey && !t.requiere[soloKey]) || !requeridos(t).length,
    actualizarTallas: true,
    items: ELEMENTOS_EPP.map(e => ({
      key: e.key,
      sel: soloKey ? e.key === soloKey : false,
      talla: e.talla ? (t.tallas[e.key] || '') : '',
      cantidad: 1
    }))
  };
  if (!entregasDe(t).length) entregaForm.value.motivo = 'NUEVO';
};
export const cerrarEntrega = () => { entregaForm.value = null; };
export const trabajadorEntrega = computed(() => (entregaForm.value ? trabajadorDe(entregaForm.value.trabajadorId) : null));

/** Ítems visibles en el formulario: los que requiere el trabajador (o todos si se pide). */
export const itemsEntregaVisibles = computed(() => {
  const f = entregaForm.value, t = trabajadorEntrega.value;
  if (!f || !t) return [];
  return f.items.filter(i => f.verTodos || t.requiere[i.key] || i.sel);
});
export const seleccionadosEntrega = computed(() => (entregaForm.value ? entregaForm.value.items.filter(i => i.sel) : []));
export const marcarTodosEntrega = (valor) => { itemsEntregaVisibles.value.forEach(i => { i.sel = valor; }); };

export const guardarEntrega = async () => {
  if (!soloEditor()) return;
  const f = entregaForm.value, t = trabajadorEntrega.value;
  if (!f || !t) return;
  const sel = f.items.filter(i => i.sel);
  if (!sel.length) { alert('Marca al menos un elemento entregado.'); return; }
  if (!f.fecha) { alert('Indica la fecha de entrega.'); return; }
  if (f.fecha > hoyISO() && !confirm('La fecha de entrega es posterior a hoy. ¿Guardar igual?')) return;
  const malos = sel.filter(i => !(Number(i.cantidad) > 0));
  if (malos.length) { alert('La cantidad debe ser 1 o más.'); return; }

  guardandoEntrega.value = true;
  try {
    const quien = usuarioActivo.value?.nombre || '';
    const filas = sel.map(i => ({
      trabajador_id: t.id,
      fecha: f.fecha,
      elemento: i.key,
      talla: String(i.talla || '').trim().toUpperCase(),
      cantidad: Math.round(Number(i.cantidad)),
      motivo: f.motivo,
      observaciones: String(f.observaciones || '').trim(),
      entregado_por: quien
    }));
    await sb(supabaseClient.from(TABLA_EPP_ENTREGAS).insert(filas));

    // Si se entregó con otra talla (o no tenía talla registrada), se actualiza el perfil
    if (f.actualizarTallas) {
      const cambios = {};
      sel.forEach(i => {
        const el = elementoEPP(i.key);
        const nueva = String(i.talla || '').trim().toUpperCase();
        if (el.talla && nueva && nueva !== t.tallas[i.key]) cambios['talla_' + i.key] = nueva;
      });
      const req = { ...t.requiere };
      let reqCambio = false;
      sel.forEach(i => { if (!req[i.key]) { req[i.key] = true; reqCambio = true; } });
      if (reqCambio) cambios.epp_requiere = req;
      if (Object.keys(cambios).length) await sb(supabaseClient.from(TABLA_TRABAJADORES).update(cambios).eq('id', t.id));
    }
    entregaForm.value = null;
    await cargarEPP();
  } catch (err) {
    alert('Error al registrar la entrega: ' + errMsg(err));
  } finally { guardandoEntrega.value = false; }
};

export const eliminarEntrega = async (e) => {
  if (!soloAdmin()) return;
  const t = trabajadorDe(e.trabajadorId);
  if (!confirm(`¿Eliminar la entrega de ${elementoEPP(e.elemento).label} del ${formatDateForDisplay(e.fecha)}${t ? ' a ' + t.nombre : ''}?`)) return;
  try {
    await sb(supabaseClient.from(TABLA_EPP_ENTREGAS).delete().eq('id', e.id));
    await cargarEPP();
  } catch (err) { alert('Error al eliminar: ' + errMsg(err)); }
};

// ---------------------------------------------------------------------
// Exportar a Excel (con formato FRC)
// ---------------------------------------------------------------------
export const exportandoEPP = ref(false);
const siNo = (v) => (v ? 'SI' : 'NO');
const motivoLabel = (k) => (MOTIVOS_ENTREGA.find(m => m.key === k)?.label || k || '');

/** Todo el módulo: Planilla EPP + Control entrega (última fecha por elemento) + Historial. */
export const exportarEPPExcel = async () => {
  exportandoEPP.value = true;
  try {
    const { wb, logo } = await nuevoLibro();
    const trabs = listaTrabajadores.value;

    hojaTabla(wb, logo, {
      nombre: 'Planilla EPP', titulo: 'Elementos de Protección Personal', subtitulo: 'Planilla de tallas y EPP requerido por trabajador',
      columnas: [
        { t: 'N°', w: 5 }, { t: 'NOMBRE', w: 26, al: 'left', bold: true }, { t: 'RUT', w: 13 }, { t: 'CARGO', w: 18 },
        ...ELEMENTOS_EPP.map(e => ({ t: e.talla ? `N° ${e.corto.toUpperCase()}` : e.corto.toUpperCase(), w: 10 })),
        { t: 'ESTADO', w: 10 }
      ],
      filas: trabs.map((t, i) => [
        i + 1, t.nombre, t.rut, t.cargo,
        ...ELEMENTOS_EPP.map(e => (e.talla ? (t.requiere[e.key] ? (t.tallas[e.key] || 'S/T') : 'N/A') : siNo(t.requiere[e.key]))),
        t.activo ? 'ACTIVO' : 'INACTIVO'
      ])
    });

    hojaTabla(wb, logo, {
      nombre: 'Control entrega', titulo: 'Control Entrega EPP', subtitulo: 'Última fecha de entrega de cada elemento',
      columnas: [
        { t: 'N°', w: 5 }, { t: 'NOMBRE', w: 26, al: 'left', bold: true }, { t: 'CARGO', w: 18 },
        ...ELEMENTOS_EPP.map(e => ({ t: e.corto.toUpperCase(), w: 11, fmt: 'dd-mm-yyyy' })),
        { t: 'PENDIENTES', w: 26, al: 'left' }
      ],
      filas: trabs.map((t, i) => [
        i + 1, t.nombre, t.cargo,
        ...ELEMENTOS_EPP.map(e => { const u = ultimaEntrega(t, e.key); return u ? fechaExcel(u.fecha) : (t.requiere[e.key] ? '—' : 'N/A'); }),
        pendientes(t).map(e => e.corto).join(', ')
      ])
    });

    const ids = new Set(trabs.map(t => String(t.id)));
    const hist = dbEntregasEPP.value.filter(e => ids.has(String(e.trabajadorId)));
    hojaTabla(wb, logo, {
      nombre: 'Historial entregas', titulo: 'Historial de entregas EPP', subtitulo: `${hist.length} registros`,
      columnas: [
        { t: 'FECHA', w: 12, fmt: 'dd-mm-yyyy' }, { t: 'TRABAJADOR', w: 26, al: 'left', bold: true }, { t: 'CARGO', w: 18 },
        { t: 'ELEMENTO', w: 22 }, { t: 'TALLA', w: 8 }, { t: 'CANT.', w: 7 }, { t: 'MOTIVO', w: 20 },
        { t: 'OBSERVACIONES', w: 30, al: 'left' }, { t: 'ENTREGADO POR', w: 18 }
      ],
      filas: hist.map(e => {
        const t = trabajadorDe(e.trabajadorId);
        return [fechaExcel(e.fecha), t?.nombre || '', t?.cargo || '', elementoEPP(e.elemento).label, e.talla, e.cantidad, motivoLabel(e.motivo), e.observaciones, e.entregadoPor];
      })
    });

    await descargarLibro(wb, `Control_Entrega_EPP_${hoyISO()}.xlsx`);
  } catch (err) {
    alert('No se pudo exportar: ' + errMsg(err));
  } finally { exportandoEPP.value = false; }
};

/** Ficha de UN trabajador: historial con columna de firma (para imprimir y respaldar la entrega). */
export const exportarFichaTrabajador = async (t) => {
  exportandoEPP.value = true;
  try {
    const { wb, logo } = await nuevoLibro();
    const tallas = ELEMENTOS_CON_TALLA.filter(e => t.requiere[e.key] && t.tallas[e.key]).map(e => `${e.corto} ${t.tallas[e.key]}`).join(' · ');
    hojaTabla(wb, logo, {
      nombre: 'Ficha EPP', titulo: 'Registro de entrega de EPP',
      subtitulo: `${t.nombre}${t.rut ? ' · RUT ' + t.rut : ''} · ${t.cargo || 'Sin cargo'}${tallas ? ' · ' + tallas : ''}`,
      columnas: [
        { t: 'FECHA', w: 12, fmt: 'dd-mm-yyyy' }, { t: 'ELEMENTO', w: 24 }, { t: 'TALLA', w: 8 }, { t: 'CANT.', w: 7 },
        { t: 'MOTIVO', w: 20 }, { t: 'OBSERVACIONES', w: 28, al: 'left' }, { t: 'ENTREGADO POR', w: 18 }, { t: 'FIRMA TRABAJADOR', w: 22 }
      ],
      filas: entregasDe(t).map(e => [fechaExcel(e.fecha), elementoEPP(e.elemento).label, e.talla, e.cantidad, motivoLabel(e.motivo), e.observaciones, e.entregadoPor, '']),
      apaisado: true
    });
    await descargarLibro(wb, `EPP_${t.nombre.replace(/\s+/g, '_')}_${hoyISO()}.xlsx`);
  } catch (err) {
    alert('No se pudo exportar: ' + errMsg(err));
  } finally { exportandoEPP.value = false; }
};

export { motivoLabel, COLOR };
