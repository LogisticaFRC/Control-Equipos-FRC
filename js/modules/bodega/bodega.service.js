// =====================================================================
// BODEGA DE FILTROS · Lógica
//  - Inventario general de filtros sueltos (código, tipo, marca, cantidad)
//  - ARMAR KIT: se sacan filtros del inventario general y se juntan en un código de KIT
//    enlazado a una marca + modelo de equipo (mismo criterio que el módulo Filtros)
//  - Consumo de kits desde Programas → Mantención (al marcar "Realizado")
//  - Registro de movimientos (trazabilidad)
// =====================================================================
import { supabaseClient, sb, errMsg, fetchAllRows } from '../../core/supabase.js';
import { dbBodegaStock, dbKits, dbBodegaMov, dbFiltros, dbEquipos, usuarioActivo, buscarEquipoPorAfi, soloAdmin, soloEditor, currentTab } from '../../core/store.js';
import { parseNum, parseFileAnyFormat, getVal, resetInputFile } from '../../core/utils.js';
import { normTxt, normCodigo, normTipo, claveModelo } from '../filtros/filtros.mapper.js';
import { TABLA_FILTROS } from '../filtros/filtros.mapper.js';
import { buscarEnCatalogo, requeridosPorModelo, listaTiposFiltro } from '../filtros/filtros.service.js';
import { TABLA_STOCK, TABLA_KITS, TABLA_KITS_ITEMS, TABLA_BODEGA_MOV, mapStock, mapKit, mapKitItem, mapMovBodega } from './bodega.mapper.js';

const { ref, computed } = Vue;

const ahora = () => new Date().toISOString();
const unicos = (arr) => Array.from(new Set(arr.filter(Boolean))).sort();
const usuarioTxt = () => String(usuarioActivo.value?.nombre || usuarioActivo.value?.usuario || '');
const entero = (v) => Math.max(0, Math.round(parseNum(v)));

export const fmtCant = (n) => (Number(n) || 0).toLocaleString('es-CL');
export const fmtFechaHora = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// =====================================================================
// CARGA (solo las tablas de bodega, para no recargar toda la app)
// =====================================================================
export const recargarBodega = async () => {
  const [stk, kits, items, movs] = await Promise.all([
    fetchAllRows(TABLA_STOCK), fetchAllRows(TABLA_KITS), fetchAllRows(TABLA_KITS_ITEMS), fetchAllRows(TABLA_BODEGA_MOV)
  ]);
  dbBodegaStock.value = stk.map(mapStock);
  const its = items.map(mapKitItem);
  dbKits.value = kits.map(r => ({ ...mapKit(r), items: its.filter(i => String(i.kitId) === String(r.id)) }));
  dbBodegaMov.value = movs.map(mapMovBodega).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
};

// =====================================================================
// OPERACIONES BÁSICAS DE STOCK (con control de concurrencia)
// =====================================================================
/** Suma/resta `delta` a la columna cantidad de una fila. Nunca deja negativo. Reintenta si otro usuario cambió el valor. */
const ajustarCantidad = async (tabla, id, delta, nombre) => {
  for (let intento = 0; intento < 3; intento++) {
    const rows = await sb(supabaseClient.from(tabla).select('cantidad').eq('id', id));
    if (!rows || !rows.length) throw new Error(`${nombre}: no existe en bodega.`);
    const actual = Number(rows[0].cantidad) || 0;
    const nuevo = actual + delta;
    if (nuevo < 0) throw new Error(`${nombre}: stock insuficiente (hay ${actual}, se necesitan ${-delta}).`);
    const upd = await sb(supabaseClient.from(tabla).update({ cantidad: nuevo, updated_at: ahora() }).eq('id', id).eq('cantidad', actual).select('id'));
    if (upd && upd.length) return nuevo;
  }
  throw new Error(`${nombre}: el stock cambió mientras se guardaba. Intenta de nuevo.`);
};

/** Ajusta el stock de un filtro suelto (lo crea si entra y no existía). */
const ajustarStockFiltro = async (codigo, delta, info = {}) => {
  const rows = await sb(supabaseClient.from(TABLA_STOCK).select('id').eq('codigo', codigo));
  if (rows && rows.length) {
    const upd = { updated_at: ahora() };
    if (info.tipo) upd.tipo = info.tipo;
    if (info.marca) upd.marca = info.marca;
    if (info.tipo || info.marca) await sb(supabaseClient.from(TABLA_STOCK).update(upd).eq('id', rows[0].id));
    return ajustarCantidad(TABLA_STOCK, rows[0].id, delta, `Filtro ${codigo}`);
  }
  if (delta < 0) throw new Error(`Filtro ${codigo}: no existe en bodega.`);
  await sb(supabaseClient.from(TABLA_STOCK).insert([{ codigo, tipo: info.tipo || '', marca: info.marca || '', cantidad: delta }]));
  return delta;
};

const registrarMov = async ({ tipoMov, esKit = false, codigo, cantidad, detalle = '', ref: referencia = '' }) => {
  try {
    await sb(supabaseClient.from(TABLA_BODEGA_MOV).insert([{ tipo_mov: tipoMov, es_kit: esKit, codigo, cantidad, detalle, usuario: usuarioTxt(), ref: referencia }]));
  } catch (err) {
    console.warn('[Bodega] No se pudo registrar el movimiento:', errMsg(err));
  }
};

// =====================================================================
// CONSULTAS
// =====================================================================
export const stockDe = (codigo) => dbBodegaStock.value.find(s => s.codigo === normCodigo(codigo)) || null;
export const disponibleDe = (codigo) => stockDe(codigo)?.cantidad || 0;
export const dbBodegaStockVacio = computed(() => dbBodegaStock.value.length === 0);
export const dbKitPorId = (id) => dbKits.value.find(k => String(k.id) === String(id)) || null;

/** Modelos de equipo para los que sirve un código (según el módulo Filtros). */
export const sirveParaCodigo = (codigo) => buscarEnCatalogo(codigo)?.modelos || [];

export const kitsDelModelo = (marca, modelo) => {
  const k = claveModelo(marca, modelo);
  return dbKits.value.filter(kit => claveModelo(kit.equipoMarca, kit.equipoModelo) === k);
};

const pasaMarca = (m, marca) => !marca || marca === 'ALL' || m === normTxt(marca);
export const listaMarcasEquipoBodega = computed(() => unicos([
  ...dbEquipos.value.map(e => normTxt(e.marca)), ...dbFiltros.value.map(f => f.equipoMarca), ...dbKits.value.map(k => k.equipoMarca)
]));
export const listaModelosEquipoBodega = (marca) => unicos([
  ...dbEquipos.value.filter(e => pasaMarca(normTxt(e.marca), marca)).map(e => normTxt(e.modelo)),
  ...dbFiltros.value.filter(f => pasaMarca(f.equipoMarca, marca)).map(f => f.equipoModelo),
  ...dbKits.value.filter(k => pasaMarca(k.equipoMarca, marca)).map(k => k.equipoModelo)
]);

// ---------- Marca / modelo desde el INVENTARIO AFI (para ARMAR KIT) ----------
/** Marcas del Inventario AFI con cuántos equipos tiene cada una. */
export const marcasInventario = computed(() => {
  const m = new Map();
  dbEquipos.value.forEach(e => { const k = normTxt(e.marca); if (k) m.set(k, (m.get(k) || 0) + 1); });
  return Array.from(m.entries()).map(([marca, equipos]) => ({ marca, equipos })).sort((a, b) => a.marca.localeCompare(b.marca));
});
/** Modelos del Inventario AFI de esa marca, con sus AFI. */
export const modelosInventario = (marca) => {
  const m = new Map();
  dbEquipos.value.filter(e => normTxt(e.marca) === normTxt(marca)).forEach(e => {
    const k = normTxt(e.modelo); if (!k) return;
    if (!m.has(k)) m.set(k, { modelo: k, afis: [], tipo: e.tipo || '' });
    m.get(k).afis.push(e.afi);
  });
  return Array.from(m.values()).sort((a, b) => a.modelo.localeCompare(b.modelo));
};
/** Al elegir marca/modelo en ARMAR KIT: sugiere el código y carga los filtros del modelo (si el kit es nuevo y aún está vacío). */
export const alCambiarMarcaKit = () => {
  const f = formKit.value;
  const modelos = modelosInventario(f.equipoMarca);
  if (!modelos.some(x => x.modelo === f.equipoModelo)) f.equipoModelo = modelos.length === 1 ? modelos[0].modelo : '';
  if (f.equipoModelo) alCambiarModeloKit();
};
export const alCambiarModeloKit = () => {
  const f = formKit.value;
  if (f.modo !== 'nuevo' || !f.equipoModelo) return;
  f.codigo = sugerirCodigoKit(f.equipoMarca, f.equipoModelo);
  const vacio = !f.items.some(i => normCodigo(i.codigo));
  if (vacio && requeridosPorModelo(f.equipoMarca, f.equipoModelo).length) cargarFiltrosDelModeloEnKit();
};
export const listaCodigosConocidos = computed(() => unicos([...dbBodegaStock.value.map(s => s.codigo), ...dbFiltros.value.map(f => f.codigo)]));
export const listaCodigosEnStock = computed(() => dbBodegaStock.value.filter(s => s.cantidad > 0).map(s => s.codigo).sort());
export { listaTiposFiltro };

// ---------- Filtros de pantalla ----------
const FILTRO_DEFAULT = () => ({ texto: '', tipo: 'ALL', equipoMarca: 'ALL', equipoModelo: 'ALL', soloConStock: false });
export const filtroBodega = ref(FILTRO_DEFAULT());
export const limpiarFiltroBodega = () => { filtroBodega.value = FILTRO_DEFAULT(); };
export const vistaBodega = ref('stock');   // 'stock' | 'kits' | 'movimientos'

const pasaModelo = (modelosTxt) => {
  const f = filtroBodega.value;
  if (f.equipoMarca === 'ALL' && f.equipoModelo === 'ALL') return true;
  return modelosTxt.some(m => (f.equipoMarca === 'ALL' || m.marca === f.equipoMarca) && (f.equipoModelo === 'ALL' || m.modelo === f.equipoModelo));
};

/** Inventario general con "sirve para". */
export const filasStock = computed(() => {
  const f = filtroBodega.value;
  const q = normTxt(f.texto);
  return dbBodegaStock.value.map(s => {
    const apps = buscarEnCatalogo(s.codigo)?.aplicaciones || [];
    const enKits = dbKits.value.filter(k => k.items.some(i => i.codigo === s.codigo)).map(k => k.codigo);
    return { ...s, modelos: unicos(apps.map(a => `${a.equipoMarca} ${a.equipoModelo}`.trim())), apps, enKits };
  }).filter(s => {
    if (f.soloConStock && s.cantidad <= 0) return false;
    if (f.tipo !== 'ALL' && s.tipo !== f.tipo) return false;
    if (!pasaModelo(s.apps.map(a => ({ marca: a.equipoMarca, modelo: a.equipoModelo })))) return false;
    if (q && ![s.codigo, s.tipo, s.marca, ...s.modelos, ...s.enKits].join(' ').includes(q)) return false;
    return true;
  }).sort((a, b) => a.tipo.localeCompare(b.tipo) || a.codigo.localeCompare(b.codigo));
});

/** Kits con su composición enriquecida (stock disponible y cuántos más se pueden armar). */
export const filasKits = computed(() => {
  const f = filtroBodega.value;
  const q = normTxt(f.texto);
  return dbKits.value.map(k => {
    const items = k.items.map(i => ({ ...i, disponible: disponibleDe(i.codigo) }));
    const armables = items.length ? Math.min(...items.map(i => Math.floor(i.disponible / (i.cantidad || 1)))) : 0;
    const totalFiltros = items.reduce((n, i) => n + i.cantidad, 0);
    return { ...k, items, armables, totalFiltros, equipos: equiposDelModeloBodega(k.equipoMarca, k.equipoModelo) };
  }).filter(k => {
    if (f.tipo !== 'ALL' && !k.items.some(i => i.tipo === f.tipo)) return false;
    if (f.soloConStock && k.cantidad <= 0) return false;
    if (!pasaModelo([{ marca: k.equipoMarca, modelo: k.equipoModelo }])) return false;
    if (q && ![k.codigo, k.equipoMarca, k.equipoModelo, k.descripcion, ...k.items.map(i => i.codigo)].join(' ').includes(q)) return false;
    return true;
  }).sort((a, b) => a.equipoMarca.localeCompare(b.equipoMarca) || a.equipoModelo.localeCompare(b.equipoModelo) || a.codigo.localeCompare(b.codigo));
});

export const filasMovBodega = computed(() => {
  const q = normTxt(filtroBodega.value.texto);
  return dbBodegaMov.value.filter(m => !q || [m.codigo, m.tipoMov, m.detalle, normTxt(m.usuario)].join(' ').includes(q)).slice(0, 500);
});

export const kpisBodega = computed(() => ({
  codigos: dbBodegaStock.value.filter(s => s.cantidad > 0).length,
  unidades: dbBodegaStock.value.reduce((n, s) => n + s.cantidad, 0),
  kits: dbKits.value.reduce((n, k) => n + k.cantidad, 0),
  tiposKit: dbKits.value.length
}));

const equiposDelModeloBodega = (marca, modelo) => {
  const k = claveModelo(marca, modelo);
  return dbEquipos.value.filter(e => claveModelo(e.marca, e.modelo) === k);
};

// =====================================================================
// INGRESO / SALIDA / AJUSTE DE FILTROS SUELTOS
// =====================================================================
export const showModalStock = ref(false);
export const formStock = ref(null);

export const abrirMovStock = (modo, fila = null) => {
  if (modo === 'AJUSTE' ? !soloAdmin() : !soloEditor()) return;
  formStock.value = {
    modo, codigo: fila?.codigo || '', tipo: fila?.tipo || '', marca: fila?.marca || '',
    cantidad: modo === 'AJUSTE' ? (fila?.cantidad ?? 0) : '', detalle: '', bloqueado: !!fila
  };
  showModalStock.value = true;
};

export const autocompletarStock = () => {
  const f = formStock.value;
  const cod = normCodigo(f.codigo);
  const s = stockDe(cod);
  const c = buscarEnCatalogo(cod);
  if (!f.tipo) f.tipo = s?.tipo || c?.tipo || '';
  if (!f.marca) f.marca = s?.marca || c?.marca || '';
  if (f.modo === 'AJUSTE' && s && (f.cantidad === '' || f.cantidad === null)) f.cantidad = s.cantidad;
};

export const guardarMovStock = async () => {
  const f = formStock.value;
  if (f.modo === 'AJUSTE' ? !soloAdmin() : !soloEditor()) return;
  const codigo = normCodigo(f.codigo);
  const tipo = normTipo(f.tipo);
  const marca = normTxt(f.marca);
  const cant = entero(f.cantidad);
  if (!codigo) return alert('Indica el código del filtro.');
  if (f.modo !== 'AJUSTE' && cant <= 0) return alert('La cantidad debe ser mayor a 0.');
  if (f.modo === 'INGRESO' && !tipo) return alert('Indica el tipo de filtro.');
  try {
    if (f.modo === 'INGRESO') {
      await ajustarStockFiltro(codigo, cant, { tipo, marca });
      await registrarMov({ tipoMov: 'INGRESO', codigo, cantidad: cant, detalle: f.detalle });
    } else if (f.modo === 'SALIDA') {
      await ajustarStockFiltro(codigo, -cant);
      await registrarMov({ tipoMov: 'SALIDA', codigo, cantidad: -cant, detalle: f.detalle });
    } else {
      const s = stockDe(codigo);
      const actual = s ? s.cantidad : 0;
      const delta = cant - actual;
      if (s && (tipo !== s.tipo || marca !== s.marca)) await sb(supabaseClient.from(TABLA_STOCK).update({ tipo, marca, updated_at: ahora() }).eq('id', s.id));
      if (delta !== 0) {
        await ajustarStockFiltro(codigo, delta, { tipo, marca });
        await registrarMov({ tipoMov: 'AJUSTE', codigo, cantidad: delta, detalle: f.detalle || `Conteo: ${actual} → ${cant}` });
      }
    }
  } catch (err) {
    await recargarBodega();
    return alert('No se pudo guardar: ' + errMsg(err));
  }
  await recargarBodega();
  showModalStock.value = false;
};

export const eliminarStock = async (fila) => {
  if (!soloAdmin()) return;
  if (fila.enKits.length) return alert(`No se puede eliminar: el código ${fila.codigo} es parte de los kits ${fila.enKits.join(', ')}.`);
  if (!confirm(`¿Eliminar el código ${fila.codigo} de la bodega?${fila.cantidad > 0 ? ` Tiene ${fila.cantidad} unidad(es) que se darán de baja.` : ''}`)) return;
  try {
    await sb(supabaseClient.from(TABLA_STOCK).delete().eq('id', fila.id));
    if (fila.cantidad > 0) await registrarMov({ tipoMov: 'SALIDA', codigo: fila.codigo, cantidad: -fila.cantidad, detalle: 'Código eliminado de la bodega' });
  } catch (err) { alert('Error al eliminar: ' + errMsg(err)); }
  await recargarBodega();
};

/** Importar stock desde Excel: CODIGO | TIPO | MARCA | CANTIDAD (se SUMA como ingreso). */
export const importandoStock = ref(false);
export const importarStockExcel = async (e) => {
  if (!soloAdmin()) return;
  const file = e.target.files[0]; if (!file) return;
  importandoStock.value = true;
  try {
    const rows = await parseFileAnyFormat(file);
    const porCodigo = new Map();
    rows.forEach(r => {
      const codigo = normCodigo(getVal(r, 'CODIGO', 'Código', 'COD'));
      const cant = entero(getVal(r, 'CANTIDAD', 'CANT', 'STOCK'));
      if (!codigo || cant <= 0) return;
      const prev = porCodigo.get(codigo) || { codigo, cant: 0, tipo: '', marca: '' };
      prev.cant += cant;
      prev.tipo = prev.tipo || normTipo(getVal(r, 'TIPO')) || buscarEnCatalogo(codigo)?.tipo || '';
      prev.marca = prev.marca || normTxt(getVal(r, 'MARCA')) || buscarEnCatalogo(codigo)?.marca || '';
      porCodigo.set(codigo, prev);
    });
    const filas = Array.from(porCodigo.values());
    if (!filas.length) throw new Error('El archivo no trae filas con CODIGO y CANTIDAD.');
    const total = filas.reduce((n, f) => n + f.cant, 0);
    if (!confirm(`Se ingresarán ${total} unidades de ${filas.length} códigos (se SUMAN a lo que ya hay en bodega). ¿Continuar?`)) return;
    const errores = [];
    for (const f of filas) {
      try {
        await ajustarStockFiltro(f.codigo, f.cant, { tipo: f.tipo, marca: f.marca });
        await registrarMov({ tipoMov: 'INGRESO', codigo: f.codigo, cantidad: f.cant, detalle: `Importado desde ${file.name}` });
      } catch (err) { errores.push(`${f.codigo}: ${errMsg(err)}`); }
    }
    await recargarBodega();
    alert(errores.length ? `Importación con errores:\n${errores.join('\n')}` : `¡Stock importado! ${total} unidades de ${filas.length} códigos.`);
  } catch (err) {
    alert('Error al importar: ' + errMsg(err));
  } finally {
    importandoStock.value = false;
    resetInputFile(e);
  }
};

export const exportarStock = (exportarCSV) => exportarCSV(filasStock.value.map(s => ({
  CODIGO: s.codigo, TIPO: s.tipo, MARCA: s.marca, CANTIDAD: s.cantidad, SIRVE_PARA: s.modelos.join(' / '), EN_KITS: s.enKits.join(' / ')
})), 'Bodega_Filtros');

// =====================================================================
// ARMAR KIT
// =====================================================================
export const showModalKit = ref(false);
export const formKit = ref(null);

const itemVacio = () => ({ codigo: '', tipo: '', marca: '', cantidad: 1 });

/** Sugiere un código de kit libre: KIT-<MODELO>-01, -02... */
export const sugerirCodigoKit = (marca, modelo) => {
  const base = 'KIT-' + (normTxt(modelo) || normTxt(marca) || 'EQUIPO').replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  let n = 1;
  while (dbKits.value.some(k => k.codigo === `${base}-${String(n).padStart(2, '0')}`)) n++;
  return `${base}-${String(n).padStart(2, '0')}`;
};

/** modo: 'nuevo' (crear y armar) · 'armar' (armar más unidades de un kit existente) · 'editar' (datos del kit) */
export const abrirKit = (modo = 'nuevo', kit = null) => {
  if (modo === 'editar' ? !soloAdmin() : !soloEditor()) return;
  formKit.value = {
    modo, kitId: kit?.id || null, original: kit?.codigo || '', cantidadActual: kit?.cantidad || 0,
    codigo: kit?.codigo || '', equipoMarca: kit?.equipoMarca || '', equipoModelo: kit?.equipoModelo || '',
    descripcion: kit?.descripcion || '', nKits: modo === 'editar' ? 0 : 1, enlazarFiltros: true,
    items: kit ? kit.items.map(i => ({ codigo: i.codigo, tipo: i.tipo, marca: i.marca, cantidad: i.cantidad })) : [itemVacio()]
  };
  showModalKit.value = true;
};

/** Desde Programas: abre "Armar KIT" con la marca/modelo del equipo y sus filtros ya cargados. */
export const abrirArmarKitParaAfi = (afi) => {
  const eq = buscarEquipoPorAfi(afi);
  if (!eq) return alert('Equipo no encontrado en el inventario.');
  currentTab.value = 'bodega';
  vistaBodega.value = 'kits';
  abrirKit('nuevo');
  formKit.value.equipoMarca = normTxt(eq.marca);
  formKit.value.equipoModelo = normTxt(eq.modelo);
  formKit.value.codigo = sugerirCodigoKit(eq.marca, eq.modelo);
  cargarFiltrosDelModeloEnKit();
};

export const composicionEditable = computed(() => {
  const f = formKit.value;
  if (!f) return false;
  return f.modo === 'nuevo' || (f.modo === 'editar' && f.cantidadActual === 0);
});

export const agregarItemKit = () => formKit.value.items.push(itemVacio());
export const quitarItemKit = (i) => formKit.value.items.splice(i, 1);
export const autocompletarItemKit = (it) => {
  const cod = normCodigo(it.codigo);
  const s = stockDe(cod);
  const c = buscarEnCatalogo(cod);
  it.tipo = s?.tipo || c?.tipo || it.tipo;
  it.marca = s?.marca || c?.marca || it.marca;
};

/** Llena la composición con lo que usa el modelo según el módulo Filtros.
 *  Por cada tipo elige, entre los códigos equivalentes, el que tiene stock suficiente (si no, el de más stock / mejor precio). */
export const cargarFiltrosDelModeloEnKit = () => {
  const f = formKit.value;
  const tipos = requeridosPorModelo(f.equipoMarca, f.equipoModelo);
  if (!tipos.length) return alert('El módulo Filtros no tiene filtros enlazados para esa marca / modelo. Agrégalos a mano o enlázalos en Filtros.');
  f.items = tipos.map(t => {
    const opciones = t.filas.map(r => ({ ...r, disp: disponibleDe(r.codigo) }));
    const elegido = opciones.find(o => o.disp >= t.cantidad) || [...opciones].sort((a, b) => b.disp - a.disp)[0];
    return { codigo: elegido.codigo, tipo: t.tipo, marca: elegido.marca || '', cantidad: t.cantidad || 1, alternativas: opciones.map(o => o.codigo) };
  });
  if (!f.codigo) f.codigo = sugerirCodigoKit(f.equipoMarca, f.equipoModelo);
};

/** Validación de stock para armar n kits con la composición del formulario. */
export const faltantesKit = computed(() => {
  const f = formKit.value;
  if (!f || f.modo === 'editar') return [];
  const n = entero(f.nKits);
  const req = new Map();
  f.items.forEach(i => {
    const c = normCodigo(i.codigo);
    if (c) req.set(c, (req.get(c) || 0) + entero(i.cantidad) * n);
  });
  return Array.from(req.entries()).map(([codigo, necesita]) => ({ codigo, necesita, hay: disponibleDe(codigo) })).filter(x => x.necesita > x.hay);
});

/** Enlaza en el módulo Filtros (bd_filtros) los códigos del kit que aún no estaban asociados al modelo. */
const enlazarComposicionAlModelo = async (marca, modelo, items) => {
  for (const it of items) {
    if (!it.tipo) continue;
    const delModelo = dbFiltros.value.filter(a => a.equipoMarca === marca && a.equipoModelo === modelo && a.tipo === it.tipo);
    if (delModelo.some(a => a.codigo === it.codigo)) continue;
    await sb(supabaseClient.from(TABLA_FILTROS).insert([{
      equipo_marca: marca, equipo_modelo: modelo, tipo: it.tipo, codigo: it.codigo, marca: it.marca || '',
      cantidad: delModelo.length ? delModelo[0].cantidad : it.cantidad
    }]));
  }
};

export const guardandoKit = ref(false);

export const guardarKit = async () => {
  const f = formKit.value;
  if (f.modo === 'editar' ? !soloAdmin() : !soloEditor()) return;
  const codigo = normCodigo(f.codigo);
  const equipoMarca = normTxt(f.equipoMarca);
  const equipoModelo = normTxt(f.equipoModelo);
  const n = entero(f.nKits);
  if (!codigo) return alert('Indica el código del KIT.');
  if (!equipoMarca && !equipoModelo) return alert('Indica la marca y/o el modelo de equipo para el que sirve el KIT.');
  if (dbKits.value.some(k => k.codigo === codigo && k.id !== f.kitId)) return alert(`Ya existe un kit con el código ${codigo}.`);
  if (stockDe(codigo)) return alert(`${codigo} ya es un código de filtro en bodega. Usa otro código para el KIT.`);

  // Composición limpia (une códigos repetidos)
  const comp = new Map();
  f.items.forEach(i => {
    const c = normCodigo(i.codigo);
    if (!c) return;
    const prev = comp.get(c);
    const tipo = normTipo(i.tipo) || stockDe(c)?.tipo || buscarEnCatalogo(c)?.tipo || '';
    const marca = normTxt(i.marca) || stockDe(c)?.marca || '';
    comp.set(c, { codigo: c, tipo: prev?.tipo || tipo, marca: prev?.marca || marca, cantidad: (prev?.cantidad || 0) + Math.max(1, entero(i.cantidad)) });
  });
  const items = Array.from(comp.values());
  if (!items.length) return alert('El kit debe tener al menos un filtro.');
  if (f.modo !== 'editar') {
    if (n <= 0) return alert('Indica cuántos kits vas a armar (mínimo 1).');
    if (faltantesKit.value.length) return alert('No hay stock suficiente:\n' + faltantesKit.value.map(x => `${x.codigo}: se necesitan ${x.necesita}, hay ${x.hay}`).join('\n'));
  }

  guardandoKit.value = true;
  let kitId = f.kitId;
  const descontados = [];   // para revertir si algo falla a medias
  try {
    // 1) Datos del kit + composición
    const datos = { codigo, equipo_marca: equipoMarca, equipo_modelo: equipoModelo, descripcion: String(f.descripcion || '').trim(), updated_at: ahora() };
    if (!kitId) {
      const data = await sb(supabaseClient.from(TABLA_KITS).insert([{ ...datos, cantidad: 0 }]).select());
      kitId = data[0].id;
    } else {
      await sb(supabaseClient.from(TABLA_KITS).update(datos).eq('id', kitId));
    }
    if (composicionEditable.value) {
      await sb(supabaseClient.from(TABLA_KITS_ITEMS).delete().eq('kit_id', kitId));
      await sb(supabaseClient.from(TABLA_KITS_ITEMS).insert(items.map(i => ({ kit_id: kitId, codigo: i.codigo, tipo: i.tipo, marca: i.marca, cantidad: i.cantidad }))));
    }
    if (f.enlazarFiltros && composicionEditable.value) {
      try { await enlazarComposicionAlModelo(equipoMarca, equipoModelo, items); }
      catch (err) { console.warn('[Bodega] No se pudieron enlazar los filtros al modelo:', errMsg(err)); }
    }

    // 2) Armar: sacar filtros del inventario general y sumar kits
    if (f.modo !== 'editar' && n > 0) {
      const compArmado = f.modo === 'armar' ? dbKits.value.find(k => k.id === kitId).items : items;
      for (const it of compArmado) {
        const q = it.cantidad * n;
        await ajustarStockFiltro(it.codigo, -q);
        descontados.push({ codigo: it.codigo, q });
      }
      await ajustarCantidad(TABLA_KITS, kitId, n, `Kit ${codigo}`);
      for (const d of descontados) await registrarMov({ tipoMov: 'ARMADO KIT', codigo: d.codigo, cantidad: -d.q, detalle: `Usado para armar ${n} × ${codigo}` });
      await registrarMov({ tipoMov: 'ARMADO KIT', esKit: true, codigo, cantidad: n, detalle: `${equipoMarca} ${equipoModelo}`.trim() });
    }
  } catch (err) {
    // Revertir lo que alcanzó a descontarse
    for (const d of descontados) { try { await ajustarStockFiltro(d.codigo, d.q); } catch (_) { /* se informa abajo */ } }
    if (f.modo === 'nuevo' && kitId && !f.kitId) { try { await sb(supabaseClient.from(TABLA_KITS).delete().eq('id', kitId)); } catch (_) {} }
    await recargarBodega();
    guardandoKit.value = false;
    return alert('No se pudo armar/guardar el kit: ' + errMsg(err));
  }
  await recargarBodega();
  guardandoKit.value = false;
  showModalKit.value = false;
  if (f.modo !== 'editar') alert(`¡Listo! Se armaron ${n} kit(s) ${codigo}. Los filtros se descontaron del inventario general.`);
};

/** Desarmar: devuelve los filtros al inventario general. */
export const desarmarKit = async (kit, cantidad = null) => {
  if (!soloAdmin()) return false;
  if (kit.cantidad <= 0) { alert('No hay kits armados para desarmar.'); return false; }
  let n = cantidad;
  if (n === null) {
    const r = prompt(`¿Cuántos kits ${kit.codigo} desarmar? (hay ${kit.cantidad})`, String(kit.cantidad));
    if (r === null) return false;
    n = entero(r);
  }
  if (n <= 0 || n > kit.cantidad) { alert('Cantidad no válida.'); return false; }
  try {
    await ajustarCantidad(TABLA_KITS, kit.id, -n, `Kit ${kit.codigo}`);
    for (const it of kit.items) {
      await ajustarStockFiltro(it.codigo, it.cantidad * n, { tipo: it.tipo, marca: it.marca });
      await registrarMov({ tipoMov: 'DESARME KIT', codigo: it.codigo, cantidad: it.cantidad * n, detalle: `Devuelto al desarmar ${n} × ${kit.codigo}` });
    }
    await registrarMov({ tipoMov: 'DESARME KIT', esKit: true, codigo: kit.codigo, cantidad: -n });
  } catch (err) {
    alert('Error al desarmar: ' + errMsg(err));
    await recargarBodega();
    return false;
  }
  await recargarBodega();
  return true;
};

export const eliminarKit = async (kit) => {
  if (!soloAdmin()) return;
  const msg = kit.cantidad > 0
    ? `El kit ${kit.codigo} tiene ${kit.cantidad} unidad(es) armadas. Se DESARMARÁN (los filtros vuelven al inventario general) y luego se eliminará. ¿Continuar?`
    : `¿Eliminar el kit ${kit.codigo}?`;
  if (!confirm(msg)) return;
  if (kit.cantidad > 0 && !(await desarmarKit(kit, kit.cantidad))) return;
  try { await sb(supabaseClient.from(TABLA_KITS).delete().eq('id', kit.id)); }
  catch (err) { alert('Error al eliminar: ' + errMsg(err)); }
  await recargarBodega();
  showModalKit.value = false;
};

export const exportarKits = (exportarCSV) => exportarCSV(filasKits.value.flatMap(k => k.items.map(i => ({
  KIT: k.codigo, EQUIPO_MARCA: k.equipoMarca, EQUIPO_MODELO: k.equipoModelo, KITS_EN_BODEGA: k.cantidad,
  FILTRO: i.codigo, TIPO: i.tipo, MARCA: i.marca, CANT_POR_KIT: i.cantidad
}))), 'Kits_Filtros');

// =====================================================================
// INTEGRACIÓN CON PROGRAMAS → MANTENCIÓN
// =====================================================================
/** Filtros que necesita el equipo (según módulo Filtros): total de unidades y detalle por tipo. */
export const filtrosRequeridosAfi = (afi) => {
  const eq = buscarEquipoPorAfi(afi);
  if (!eq) return { total: 0, tipos: [], detalle: '' };
  const tipos = requeridosPorModelo(eq.marca, eq.modelo);
  const total = tipos.reduce((n, t) => n + (t.cantidad || 1), 0);
  const detalle = tipos.map(t => {
    const disp = t.filas.reduce((n, r) => n + disponibleDe(r.codigo), 0);
    return `${t.tipo} ×${t.cantidad} (${t.filas.map(r => r.codigo).join(' / ')}) · bodega: ${disp}`;
  }).join('\n');
  return { total, tipos, detalle };
};

/** Kits en bodega para el modelo del equipo. `principal` = el kit que se descontará al marcar Realizado. */
export const kitsEnBodegaAfi = (afi) => {
  const eq = buscarEquipoPorAfi(afi);
  if (!eq) return { kits: [], total: 0, principal: null };
  const kits = kitsDelModelo(eq.marca, eq.modelo);
  const total = kits.reduce((n, k) => n + k.cantidad, 0);
  const principal = [...kits].filter(k => k.cantidad > 0).sort((a, b) => b.cantidad - a.cantidad)[0] || null;
  return { kits, total, principal };
};

/** ¿Alcanzan los filtros sueltos de bodega para armar un kit de este equipo? */
export const sePuedeArmarAfi = (afi) => {
  const { tipos } = filtrosRequeridosAfi(afi);
  if (!tipos.length) return false;
  return tipos.every(t => t.filas.some(r => disponibleDe(r.codigo) >= (t.cantidad || 1)));
};

const refItem = (item) => `PROG_ITEM:${item.id}`;

/** Kit actualmente descontado para un ítem de programa (null si no hay). */
export const kitConsumidoItem = (item) => {
  const movs = dbBodegaMov.value.filter(m => m.esKit && m.ref === refItem(item));
  const neto = movs.reduce((n, m) => n + m.cantidad, 0);
  if (neto >= 0) return null;
  const ultimo = movs.filter(m => m.tipoMov === 'CONSUMO KIT').sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0];
  return ultimo ? ultimo.codigo : null;
};

/** Descuenta 1 kit del modelo del equipo. Devuelve el código del kit o null si no había. */
export const consumirKitParaItem = async (item) => {
  if (kitConsumidoItem(item)) return kitConsumidoItem(item);   // ya descontado
  const { principal } = kitsEnBodegaAfi(item.afi);
  if (!principal) return null;
  await ajustarCantidad(TABLA_KITS, principal.id, -1, `Kit ${principal.codigo}`);
  await registrarMov({ tipoMov: 'CONSUMO KIT', esKit: true, codigo: principal.codigo, cantidad: -1, detalle: `Mantención AFI ${item.afi}`, ref: refItem(item) });
  await recargarBodega();
  return principal.codigo;
};

/** Al volver a "Pendiente": devuelve a bodega el kit que se había descontado. */
export const devolverKitDeItem = async (item) => {
  const codigo = kitConsumidoItem(item);
  if (!codigo) return null;
  const kit = dbKits.value.find(k => k.codigo === codigo);
  if (!kit) throw new Error(`El kit ${codigo} ya no existe; no se pudo devolver.`);
  await ajustarCantidad(TABLA_KITS, kit.id, 1, `Kit ${codigo}`);
  await registrarMov({ tipoMov: 'DEVOLUCION KIT', esKit: true, codigo, cantidad: 1, detalle: `Mantención AFI ${item.afi} vuelta a pendiente`, ref: refItem(item) });
  await recargarBodega();
  return codigo;
};

/** Resumen por modelo para un programa de mantención: equipos pendientes vs kits en bodega. */
export const resumenKitsPrograma = (items) => {
  const porModelo = new Map();
  items.filter(i => !i.realizado).forEach(i => {
    const eq = buscarEquipoPorAfi(i.afi);
    const marca = normTxt(eq?.marca), modelo = normTxt(eq?.modelo);
    const k = claveModelo(marca, modelo);
    if (!porModelo.has(k)) {
      const kits = kitsDelModelo(marca, modelo);
      porModelo.set(k, { key: k, marca, modelo, pendientes: 0, kitsBodega: kits.reduce((n, x) => n + x.cantidad, 0), codigos: kits.map(x => x.codigo), filtrosPorEquipo: eq ? filtrosRequeridosAfi(i.afi).total : 0 });
    }
    porModelo.get(k).pendientes++;
  });
  return Array.from(porModelo.values()).map(r => ({ ...r, faltan: Math.max(0, r.pendientes - r.kitsBodega) }))
    .sort((a, b) => b.faltan - a.faltan || a.key.localeCompare(b.key));
};
