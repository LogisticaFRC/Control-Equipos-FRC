// =====================================================================
// OC · Órdenes de Compra (registro histórico de OC)
// ---------------------------------------------------------------------
// Cada OC: N° OC (único), fecha, AFI, proveedor, descripción, precio y documento adjunto.
// ENLACE CON MANTENCIONES: una mantención del Historial puede tener VARIAS OC en su
// columna numero_oc ("123, 456"). La OC queda vinculada a la mantención cuyo numero_oc
// contiene su número (se compara sin "OC", "N°", espacios, etc.).
//   · Mantención → precio de cada OC + total de sus OC.
//   · Perfil de equipo → total gastado en OC del equipo.
// =====================================================================
import { supabaseClient, sb, errMsg, subirArchivoStorage } from '../../core/supabase.js';
import { dbOC, dbIntervenciones, dbEquipos, usuarioActivo, currentTab, cargarDatosDesdeSupabase, soloAdmin, soloEditor, buscarEquipoPorAfi } from '../../core/store.js';
import { parseNum, parseStr, limpiarAfi, mismoAfi, hoyISO, parseIsoDate, formatDateForDisplay, resetInputFile } from '../../core/utils.js';
import { TABLA_OC, claveOC, ocsDeTexto, textoDeOcs } from './oc.mapper.js';
import { TABLA_HISTORIAL } from '../historial/historial.mapper.js';
import { formMant, abrirFormularioNuevaMantencion, editarMantencion } from '../historial/historial.service.js';
import { showPerfilEquipoModal } from '../inventario/perfil.service.js';
import { nuevoLibro, hojaTabla, descargarLibro, fechaExcel, COLOR } from '../../core/excel.js';

const { ref, computed } = Vue;

export { claveOC, ocsDeTexto };

/** $1.234.567 (pesos chilenos, sin decimales). */
export const fmtCLP = (n) => '$' + Math.round(Number(n || 0)).toLocaleString('es-CL');

// ---------------------------------------------------------------------
// Índices (se recalculan solos cuando cambian los datos)
// ---------------------------------------------------------------------
/** clave N° OC → OC registrada. */
export const ocPorClave = computed(() => new Map(dbOC.value.map(o => [o.clave, o])));
/** clave N° OC → mantenciones del Historial que la usan. */
export const mantencionesPorOC = computed(() => {
  const m = new Map();
  dbIntervenciones.value.forEach(i => (i.ocLista || []).forEach(n => {
    const k = claveOC(n); if (!k) return;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(i);
  }));
  return m;
});

export const ocDe = (numero) => ocPorClave.value.get(claveOC(numero)) || null;
export const mantencionesDeOC = (oc) => (oc ? mantencionesPorOC.value.get(oc.clave || claveOC(oc.numero)) || [] : []);

/** OC de una mantención: [{ numero, oc (o null si no está registrada en el módulo OC), precio }]. */
export const detalleOCsMantencion = (m) => (m?.ocLista || ocsDeTexto(m?.numeroOC)).map(numero => {
  const oc = ocDe(numero);
  return { numero, oc, precio: oc ? oc.precio : 0 };
});
/** Total $ de todas las OC de una mantención. */
export const totalOCMantencion = (m) => detalleOCsMantencion(m).reduce((s, d) => s + d.precio, 0);

/** OC de un equipo: las registradas con su AFI + las vinculadas a mantenciones de ese AFI (sin repetir). */
export const ocsDelEquipo = (afi) => {
  if (!afi) return [];
  const map = new Map();
  dbOC.value.forEach(o => { if (mismoAfi(o.afi, afi)) map.set(o.id, o); });
  dbIntervenciones.value.forEach(i => {
    if (!mismoAfi(i.afi, afi)) return;
    (i.ocLista || []).forEach(n => { const o = ocDe(n); if (o) map.set(o.id, o); });
  });
  return [...map.values()].sort((a, b) => parseIsoDate(b.fecha) - parseIsoDate(a.fecha));
};
export const totalOCEquipo = (afi) => ocsDelEquipo(afi).reduce((s, o) => s + o.precio, 0);

/** AFI efectivo de una OC (el suyo o el de la mantención vinculada). */
export const afiDeOC = (oc) => oc.afi || (mantencionesDeOC(oc)[0]?.afi ?? '');

// ---------------------------------------------------------------------
// Lista + filtros
// ---------------------------------------------------------------------
const FILTRO_DEFAULT = () => ({ texto: '', afi: '', desde: '', hasta: '', vinculo: '' });
export const filtroOC = ref(FILTRO_DEFAULT());
export const limpiarFiltroOC = () => { filtroOC.value = FILTRO_DEFAULT(); };

export const listaOC = computed(() => {
  const f = filtroOC.value;
  const q = f.texto.trim().toLowerCase();
  const qClave = claveOC(f.texto);
  return dbOC.value.filter(o => {
    const afi = afiDeOC(o);
    const vinc = mantencionesDeOC(o).length > 0;
    if (f.afi && !mismoAfi(afi, limpiarAfi(f.afi))) return false;
    if (f.desde && o.fecha !== '-' && o.fecha < f.desde) return false;
    if (f.hasta && o.fecha !== '-' && o.fecha > f.hasta) return false;
    if (f.vinculo === 'SI' && !vinc) return false;
    if (f.vinculo === 'NO' && vinc) return false;
    if (q) {
      const eq = buscarEquipoPorAfi(afi);
      const txt = [o.numero, afi, o.proveedor, o.descripcion, eq?.tipo, eq?.marca, eq?.modelo].join(' ').toLowerCase();
      if (!txt.includes(q) && !(qClave && o.clave.includes(qClave))) return false;
    }
    return true;
  }).sort((a, b) => parseIsoDate(b.fecha) - parseIsoDate(a.fecha) || String(b.numero).localeCompare(String(a.numero), undefined, { numeric: true }));
});

export const resumenOC = computed(() => {
  const l = listaOC.value;
  const vinc = l.filter(o => mantencionesDeOC(o).length > 0);
  return {
    total: l.length,
    monto: l.reduce((s, o) => s + o.precio, 0),
    vinculadas: vinc.length,
    montoVinculadas: vinc.reduce((s, o) => s + o.precio, 0),
    sinVincular: l.length - vinc.length,
    conDocumento: l.filter(o => o.link).length
  };
});

/** N° de OC escritos en mantenciones que NO están registrados en el módulo OC. */
export const ocsSinRegistrar = computed(() => {
  const out = [];
  mantencionesPorOC.value.forEach((ms, k) => {
    if (ocPorClave.value.has(k)) return;
    const numero = (ms[0].ocLista || []).find(n => claveOC(n) === k) || k;
    out.push({ numero, mantenciones: ms });
  });
  return out.sort((a, b) => String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true }));
});

// ---------------------------------------------------------------------
// Formulario (crear / editar)
// ---------------------------------------------------------------------
const OC_VACIA = (pref = {}) => ({ id: null, numero: '', fecha: hoyISO(), afi: '', proveedor: '', descripcion: '', precio: '', link: '', archivoNombre: '', mantencionId: '', ...pref });
export const ocForm = ref(null);
let mantencionInicialId = '';
let numeroInicial = '';
export const guardandoOC = ref(false);
export const subiendoOC = ref(false);

export const nuevaOC = (pref = {}) => {
  ocForm.value = OC_VACIA(pref);
  mantencionInicialId = ''; numeroInicial = '';
};
export const editarOC = (oc) => {
  const mant = mantencionesDeOC(oc)[0];
  ocForm.value = { ...OC_VACIA(), ...JSON.parse(JSON.stringify(oc)), fecha: oc.fecha === '-' ? '' : oc.fecha, afi: oc.afi || mant?.afi || '', mantencionId: mant ? String(mant.id) : '' };
  mantencionInicialId = ocForm.value.mantencionId;
  numeroInicial = oc.numero;
};
export const cerrarOC = () => { ocForm.value = null; };

export const equipoOCForm = computed(() => (ocForm.value ? buscarEquipoPorAfi(limpiarAfi(ocForm.value.afi)) : null));

/** Mantenciones del AFI elegido (para vincular la OC). */
export const mantencionesParaVincular = computed(() => {
  const afi = ocForm.value ? limpiarAfi(ocForm.value.afi) : '';
  if (!afi) return [];
  return dbIntervenciones.value.filter(i => mismoAfi(i.afi, afi)).sort((a, b) => parseIsoDate(b.fecha) - parseIsoDate(a.fecha));
});
export const etiquetaMantencion = (i) => [
  formatDateForDisplay(i.fecha), i.tipoMant || i.causa || 'Mantención',
  i.numeroOT ? `OT ${i.numeroOT}` : '', i.ocLista?.length ? `OC: ${i.ocLista.join(', ')}` : ''
].filter(Boolean).join(' · ');

export const subirDocumentoOC = async (e) => {
  const file = e.target.files[0];
  if (!file || !ocForm.value) return;
  subiendoOC.value = true;
  try {
    const n = claveOC(ocForm.value.numero) || 'SN';
    const limpio = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_');
    const fileName = `oc/${Date.now()}_OC${n.replace(/[^A-Za-z0-9-]/g, '')}_${limpio}`;
    ocForm.value.link = await subirArchivoStorage(fileName, file);
    ocForm.value.archivoNombre = file.name;
  } catch (err) {
    alert('Error al subir el documento: ' + errMsg(err));
  } finally { subiendoOC.value = false; resetInputFile(e); }
};
export const quitarDocumentoOC = () => { if (ocForm.value) { ocForm.value.link = ''; ocForm.value.archivoNombre = ''; } };

/** Agrega / reemplaza / quita un N° OC dentro del numero_oc de una mantención. */
//  cache: Map id → lista ya modificada (para encadenar varios cambios sobre la misma mantención)
const actualizarOcsDeMantencion = async (mantId, { quitar = '', agregar = '' }, cache = new Map()) => {
  const m = dbIntervenciones.value.find(i => String(i.id) === String(mantId));
  if (!m) return;
  const actual = cache.get(String(m.id)) || m.ocLista || [];
  let lista = actual.filter(n => !quitar || claveOC(n) !== claveOC(quitar));
  if (agregar && !lista.some(n => claveOC(n) === claveOC(agregar))) lista.push(agregar);
  const texto = textoDeOcs(lista);
  if (texto === textoDeOcs(actual)) return;
  await sb(supabaseClient.from(TABLA_HISTORIAL).update({ numero_oc: texto }).eq('id', m.id));
  cache.set(String(m.id), lista);
};

export const guardarOC = async () => {
  if (!soloEditor()) return false;
  const f = ocForm.value;
  if (!f) return false;
  const numero = parseStr(f.numero).replace(/^\s*(O\.?\s*C\.?)\s*[-:#]?\s*/i, '').trim();
  if (!numero) { alert('Escribe el N° de OC.'); return false; }
  const clave = claveOC(numero);
  const repetida = dbOC.value.find(o => o.clave === clave && o.id !== f.id);
  if (repetida) { alert(`La OC N° ${repetida.numero} ya está registrada.`); return false; }
  let afi = limpiarAfi(f.afi);
  const mant = f.mantencionId ? dbIntervenciones.value.find(i => String(i.id) === String(f.mantencionId)) : null;
  if (!afi && mant) afi = mant.afi;

  const payload = {
    numero_oc: numero,
    fecha: f.fecha || null,
    afi,
    proveedor: parseStr(f.proveedor).toUpperCase(),
    descripcion: parseStr(f.descripcion),
    precio: parseNum(f.precio),
    link: parseStr(f.link),
    archivo_nombre: parseStr(f.archivoNombre)
  };
  guardandoOC.value = true;
  try {
    if (f.id) await sb(supabaseClient.from(TABLA_OC).update(payload).eq('id', f.id));
    else await sb(supabaseClient.from(TABLA_OC).insert([{ ...payload, creado_por: usuarioActivo.value?.nombre || '' }]));

    // Enlace con la mantención (BD_HISTORIAL.numero_oc admite varias OC)
    let aviso = '';
    const cache = new Map();
    try {
      const cambioNumero = numeroInicial && claveOC(numeroInicial) !== clave;
      // Si cambió el N°, se corrige en todas las mantenciones que tenían el N° anterior
      if (cambioNumero) {
        for (const m of mantencionesPorOC.value.get(claveOC(numeroInicial)) || []) {
          if (String(m.id) === String(mantencionInicialId) && String(f.mantencionId) !== String(mantencionInicialId)) continue;
          await actualizarOcsDeMantencion(m.id, { quitar: numeroInicial, agregar: numero }, cache);
        }
      }
      // Se cambió / quitó la mantención vinculada
      if (mantencionInicialId && String(f.mantencionId) !== String(mantencionInicialId)) {
        await actualizarOcsDeMantencion(mantencionInicialId, { quitar: numeroInicial || numero }, cache);
      }
      if (f.mantencionId) await actualizarOcsDeMantencion(f.mantencionId, { agregar: numero }, cache);
    } catch (err) {
      aviso = '\n(Atención: la OC se guardó, pero no se pudo actualizar la mantención: ' + errMsg(err) + ')';
    }
    await cargarDatosDesdeSupabase();
    ocForm.value = null;
    alert(`OC N° ${numero} guardada.` + aviso);
    return true;
  } catch (err) {
    alert('Error al guardar la OC: ' + errMsg(err) + (String(errMsg(err)).includes('bd_oc') ? '\n¿Ejecutaste sql/oc.sql en Supabase?' : ''));
    return false;
  } finally { guardandoOC.value = false; }
};

export const eliminarOC = async (oc) => {
  if (!soloAdmin()) return;
  const ms = mantencionesDeOC(oc);
  if (!confirm(`¿Eliminar la OC N° ${oc.numero}?` + (ms.length ? `\n\nEstá vinculada a ${ms.length} mantención(es); el N° quedará escrito en ellas pero sin precio.` : ''))) return;
  try {
    await sb(supabaseClient.from(TABLA_OC).delete().eq('id', oc.id));
    dbOC.value = dbOC.value.filter(o => o.id !== oc.id);
    if (ocForm.value?.id === oc.id) ocForm.value = null;
  } catch (err) { alert('Error al eliminar: ' + errMsg(err)); }
};

// ---------------------------------------------------------------------
// Navegación entre módulos
// ---------------------------------------------------------------------
/** Abre el módulo OC en una OC (desde Historial, Perfil, formulario de mantención...). */
export const irAOC = (numero) => {
  showPerfilEquipoModal.value = false;
  currentTab.value = 'oc';
  const oc = ocDe(numero);
  filtroOC.value = { ...FILTRO_DEFAULT(), texto: oc ? oc.numero : String(numero || '') };
  if (oc) editarOC(oc);
  else nuevaOC({ numero: String(numero || '') });
};

/** Registrar una mantención nueva que ya trae esta OC. */
export const nuevaMantencionConOC = (oc) => {
  abrirFormularioNuevaMantencion(afiDeOC(oc) || '');
  formMant.value.numeroOC = oc.numero;
};
export const abrirMantencion = (m) => editarMantencion(m);

// ---------------------------------------------------------------------
// Varias OC en el formulario de mantención
// ---------------------------------------------------------------------
export const ocNuevaFormMant = ref('');
export const ocsFormMant = computed(() => detalleOCsMantencion({ ocLista: ocsDeTexto(formMant.value.numeroOC) }));
export const totalOcsFormMant = computed(() => ocsFormMant.value.reduce((s, d) => s + d.precio, 0));
export const agregarOCFormMant = () => {
  const nuevos = ocsDeTexto(ocNuevaFormMant.value);
  if (!nuevos.length) return;
  formMant.value.numeroOC = textoDeOcs(ocsDeTexto([formMant.value.numeroOC, ...nuevos].join(',')));
  ocNuevaFormMant.value = '';
};
export const quitarOCFormMant = (numero) => {
  formMant.value.numeroOC = textoDeOcs(ocsDeTexto(formMant.value.numeroOC).filter(n => claveOC(n) !== claveOC(numero)));
};
/** OC registradas del AFI del formulario que aún no están en la mantención (sugerencias). */
export const ocsSugeridasFormMant = computed(() => {
  const afi = formMant.value.afi;
  const ya = new Set(ocsDeTexto(formMant.value.numeroOC).map(claveOC));
  return dbOC.value.filter(o => mismoAfi(o.afi, afi) && !ya.has(o.clave) && !mantencionesDeOC(o).length);
});

// ---------------------------------------------------------------------
// Exportar Excel (con logo, centrado)
// ---------------------------------------------------------------------
export const exportandoOC = ref(false);
export const exportarOCExcel = async () => {
  const lista = listaOC.value;
  if (!lista.length) return alert('No hay OC para exportar con estos filtros.');
  exportandoOC.value = true;
  try {
    const { wb, logo } = await nuevoLibro();
    const columnas = [
      { t: 'N° OC', w: 12, bold: true }, { t: 'FECHA', w: 12, fmt: 'dd-mm-yyyy' }, { t: 'AFI', w: 9, bold: true },
      { t: 'EQUIPO', w: 22 }, { t: 'PROVEEDOR', w: 22 }, { t: 'DESCRIPCIÓN', w: 40, al: 'left' },
      { t: 'PRECIO', w: 14, fmt: '"$"#,##0' }, { t: 'MANTENCIÓN VINCULADA', w: 30 }, { t: 'DOCUMENTO', w: 14 }
    ];
    const filas = lista.map(o => {
      const afi = afiDeOC(o); const eq = buscarEquipoPorAfi(afi);
      const ms = mantencionesDeOC(o);
      return [
        o.numero, fechaExcel(o.fecha), afi, eq ? `${eq.tipo} ${eq.marca} ${eq.modelo}`.trim() : '', o.proveedor, o.descripcion, o.precio,
        ms.map(m => `${formatDateForDisplay(m.fecha)} ${m.tipoMant || ''}`.trim()).join('\n') || 'SIN VINCULAR',
        o.link ? { text: 'Ver documento', hyperlink: o.link } : '-'
      ];
    });
    const f = filtroOC.value;
    const sub = ['REGISTRO HISTÓRICO DE ÓRDENES DE COMPRA', f.afi ? `AFI ${f.afi}` : '', f.desde || f.hasta ? `${formatDateForDisplay(f.desde) || '...'} al ${formatDateForDisplay(f.hasta) || '...'}` : ''].filter(Boolean).join(' · ');
    const ws = hojaTabla(wb, logo, {
      nombre: 'OC', titulo: 'ÓRDENES DE COMPRA (OC)', subtitulo: sub, columnas, filas,
      estiloFila: (v) => (v[7] === 'SIN VINCULAR' ? { font: { color: { argb: COLOR.ambarTxt } } } : null),
      totales: ['TOTAL', '', '', '', `${lista.length} OC`, '', resumenOC.value.monto, '', '']
    });
    lista.forEach((o, i) => { if (o.link) ws.getCell(7 + i, 9).font = { size: 9, color: { argb: 'FF1D4ED8' }, underline: true }; });

    // Hoja 2: total por equipo
    const porAfi = new Map();
    lista.forEach(o => { const a = afiDeOC(o) || 'SIN AFI'; const r = porAfi.get(a) || { n: 0, monto: 0 }; r.n++; r.monto += o.precio; porAfi.set(a, r); });
    const filasAfi = [...porAfi.entries()].sort((a, b) => b[1].monto - a[1].monto).map(([a, r]) => {
      const eq = buscarEquipoPorAfi(a);
      return [a, eq?.tipo || '', `${eq?.marca || ''} ${eq?.modelo || ''}`.trim(), r.n, r.monto];
    });
    hojaTabla(wb, logo, {
      nombre: 'Total por equipo', titulo: 'GASTO EN OC POR EQUIPO', subtitulo: sub, apaisado: false,
      columnas: [{ t: 'AFI', w: 10, bold: true }, { t: 'TIPO EQUIPO', w: 24 }, { t: 'MARCA / MODELO', w: 28 }, { t: 'N° OC', w: 10 }, { t: 'TOTAL', w: 16, fmt: '"$"#,##0' }],
      filas: filasAfi, totales: ['TOTAL', '', '', lista.length, resumenOC.value.monto]
    });
    await descargarLibro(wb, `OC_${hoyISO()}.xlsx`);
  } catch (err) {
    alert('Error al exportar: ' + errMsg(err));
  } finally { exportandoOC.value = false; }
};

export { dbEquipos };
