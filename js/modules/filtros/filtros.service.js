// =====================================================================
// FILTROS · Lógica (catálogo, referencias cruzadas, comparativo de precios,
// filtros requeridos por modelo y registro automático desde Mantenciones)
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { dbFiltros, dbEquipos, currentTab, cargarDatosDesdeSupabase, soloAdmin, soloEditor } from '../../core/store.js';
import { parseNum, formatIsoDateForSupabase, formatDateForDisplay, hoyISO } from '../../core/utils.js';
import { TABLA_FILTROS, normTxt, claveModelo, toRow } from './filtros.mapper.js';

const { ref, computed } = Vue;

/** Tipos sugeridos (se pueden escribir otros; siempre se guardan en MAYÚSCULAS).
 *  Usar siempre el mismo nombre es lo que permite detectar las referencias cruzadas. */
export const TIPOS_FILTRO = [
  'ACEITE MOTOR', 'COMBUSTIBLE PRIMARIO', 'COMBUSTIBLE SECUNDARIO', 'SEPARADOR DE AGUA',
  'AIRE PRIMARIO', 'AIRE SECUNDARIO', 'HIDRAULICO', 'RETORNO HIDRAULICO', 'TRANSMISION',
  'CABINA', 'REFRIGERANTE', 'RESPIRADERO', 'ADBLUE'
];

const unicos = (arr) => Array.from(new Set(arr.filter(Boolean))).sort();

export const fmtPrecio = (n) => Number(n) > 0 ? '$' + Math.round(Number(n)).toLocaleString('es-CL') : '-';
export const fmtFecha = (f) => f ? formatDateForDisplay(f) : '-';

// ---------- Listas para selectores / autocompletar ----------
export const listaTiposFiltro = computed(() => unicos([...TIPOS_FILTRO, ...dbFiltros.value.map(f => f.tipo)]));
export const listaProveedoresFiltro = computed(() => unicos(dbFiltros.value.map(f => f.proveedor)));
export const listaMarcasFiltro = computed(() => unicos(dbFiltros.value.map(f => f.marca)));
export const listaMarcasEquipoFiltros = computed(() => unicos([...dbFiltros.value.map(f => f.equipoMarca), ...dbEquipos.value.map(e => normTxt(e.marca))]));
export const listaModelosEquipoFiltros = computed(() => {
  const m = filtroVista.value.equipoMarca;
  const deFiltros = dbFiltros.value.filter(f => m === 'ALL' || f.equipoMarca === m).map(f => f.equipoModelo);
  const deEquipos = dbEquipos.value.filter(e => m === 'ALL' || normTxt(e.marca) === m).map(e => normTxt(e.modelo));
  return unicos([...deFiltros, ...deEquipos]);
});

/** AFIs del inventario que tienen esa marca + modelo. */
export const equiposDelModelo = (marca, modelo) => {
  const k = claveModelo(marca, modelo);
  return dbEquipos.value.filter(e => claveModelo(e.marca, e.modelo) === k);
};

// ---------- Filtros de la pantalla ----------
const FILTRO_DEFAULT = () => ({ texto: '', equipoMarca: 'ALL', equipoModelo: 'ALL', tipo: 'ALL', proveedor: 'ALL' });
export const filtroVista = ref(FILTRO_DEFAULT());
export const limpiarFiltroVista = () => { filtroVista.value = FILTRO_DEFAULT(); };
export const vistaFiltros = ref('cruzada');   // 'cruzada' | 'precios'

export const filtrosFiltrados = computed(() => {
  const f = filtroVista.value;
  const q = normTxt(f.texto);
  return dbFiltros.value.filter(r => {
    if (f.equipoMarca !== 'ALL' && r.equipoMarca !== f.equipoMarca) return false;
    if (f.equipoModelo !== 'ALL' && r.equipoModelo !== f.equipoModelo) return false;
    if (f.tipo !== 'ALL' && r.tipo !== f.tipo) return false;
    if (f.proveedor !== 'ALL' && r.proveedor !== f.proveedor) return false;
    if (q && ![r.codigo, r.marca, r.proveedor, r.tipo, r.equipoMarca, r.equipoModelo].join(' ').includes(q)) return false;
    return true;
  });
});

export const kpisFiltros = computed(() => ({
  codigos: new Set(filtrosFiltrados.value.map(r => r.codigo)).size,
  modelos: new Set(filtrosFiltrados.value.map(r => claveModelo(r.equipoMarca, r.equipoModelo))).size,
  proveedores: new Set(filtrosFiltrados.value.map(r => r.proveedor).filter(Boolean)).size,
  cruzadas: gruposPorModelo.value.reduce((n, g) => n + g.tipos.filter(t => t.codigos > 1).length, 0)
}));

const ordenarPorPrecio = (a, b) => {
  if (a.precio > 0 && b.precio > 0) return a.precio - b.precio;
  if (a.precio > 0) return -1;
  if (b.precio > 0) return 1;
  return a.codigo.localeCompare(b.codigo);
};

/** Agrupa filas por TIPO para un conjunto de filas de un mismo modelo. */
const agruparPorTipo = (filas) => {
  const porTipo = {};
  filas.forEach(r => { (porTipo[r.tipo] = porTipo[r.tipo] || []).push(r); });
  return Object.keys(porTipo).sort().map(tipo => {
    const arr = porTipo[tipo].slice().sort(ordenarPorPrecio);
    const conPrecio = arr.filter(r => r.precio > 0);
    const mejor = conPrecio.length ? conPrecio[0] : null;
    return {
      tipo,
      filas: arr.map(r => ({ ...r, esMejor: !!mejor && r.precio === mejor.precio, difMejor: (mejor && r.precio > 0) ? r.precio - mejor.precio : null })),
      codigos: new Set(arr.map(r => r.codigo)).size,
      cantidad: Math.max(...arr.map(r => r.cantidad || 1)),
      mejor
    };
  });
};

/** Vista 1 · Referencia cruzada: Modelo de equipo -> Tipo -> códigos equivalentes. */
export const gruposPorModelo = computed(() => {
  const porModelo = {};
  filtrosFiltrados.value.forEach(r => {
    const k = claveModelo(r.equipoMarca, r.equipoModelo);
    (porModelo[k] = porModelo[k] || { key: k, marca: r.equipoMarca, modelo: r.equipoModelo, filas: [] }).filas.push(r);
  });
  return Object.values(porModelo)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(g => ({ ...g, equipos: equiposDelModelo(g.marca, g.modelo), tipos: agruparPorTipo(g.filas) }));
});

/** Vista 2 · Comparativo de precios: Código (filas) x Proveedor (columnas). */
export const comparativoPrecios = computed(() => {
  const proveedores = unicos(filtrosFiltrados.value.map(r => r.proveedor || 'SIN PROVEEDOR'));
  const porCodigo = {};
  filtrosFiltrados.value.forEach(r => {
    const c = (porCodigo[r.codigo] = porCodigo[r.codigo] || { codigo: r.codigo, marcas: new Set(), tipos: new Set(), modelos: new Set(), precios: {} });
    c.marcas.add(r.marca); c.tipos.add(r.tipo); c.modelos.add(`${r.equipoMarca} ${r.equipoModelo}`.trim());
    const p = r.proveedor || 'SIN PROVEEDOR';
    if (r.precio > 0 && (!c.precios[p] || r.precio < c.precios[p])) c.precios[p] = r.precio;
  });
  const filas = Object.values(porCodigo).map(c => {
    const vals = Object.values(c.precios);
    const min = vals.length ? Math.min(...vals) : 0;
    const max = vals.length ? Math.max(...vals) : 0;
    return {
      codigo: c.codigo,
      marca: unicos([...c.marcas]).join(' / ') || '-',
      tipo: unicos([...c.tipos]).join(' / '),
      modelos: unicos([...c.modelos]),
      precios: c.precios,
      min, max,
      mejorProveedor: vals.length ? Object.keys(c.precios).find(p => c.precios[p] === min) : '',
      ahorro: max - min
    };
  }).sort((a, b) => a.tipo.localeCompare(b.tipo) || a.codigo.localeCompare(b.codigo));
  return { proveedores, filas };
});

// ---------- Filtros requeridos por modelo (Perfil de Equipo / formulario de mantención) ----------
/** Lo que el modelo usa "sí o sí": por tipo, cantidad y códigos que sirven (más barato primero). */
export const requeridosPorModelo = (marca, modelo) => {
  const k = claveModelo(marca, modelo);
  if (k === '|') return [];
  return agruparPorTipo(dbFiltros.value.filter(r => claveModelo(r.equipoMarca, r.equipoModelo) === k))
    .map(t => ({ ...t, costo: t.mejor ? t.mejor.precio * t.cantidad : 0 }));
};

/** Ir al módulo Filtros mostrando solo ese modelo (para corregir datos). */
export const irAFiltrosDelModelo = (marca, modelo) => {
  filtroVista.value = { ...FILTRO_DEFAULT(), equipoMarca: normTxt(marca) || 'ALL', equipoModelo: normTxt(modelo) || 'ALL' };
  vistaFiltros.value = 'cruzada';
  currentTab.value = 'filtros';
};

// ---------- Alta / edición manual (módulo Filtros) ----------
const FORM_DEFAULT = () => ({ id: null, equipoMarca: '', equipoModelo: '', tipo: '', marca: '', codigo: '', proveedor: '', precio: '', cantidad: 1 });
export const showModalFiltro = ref(false);
export const formFiltro = ref(FORM_DEFAULT());

export const nuevoFiltro = (base = {}) => {
  if (!soloEditor()) return;
  formFiltro.value = { ...FORM_DEFAULT(), ...base };
  showModalFiltro.value = true;
};
export const editarFiltro = (row) => {
  if (!soloEditor()) return;
  formFiltro.value = { ...FORM_DEFAULT(), ...row, precio: row.precio || '' };
  showModalFiltro.value = true;
};

const mismaClave = (a, b) =>
  claveModelo(a.equipoMarca, a.equipoModelo) === claveModelo(b.equipoMarca, b.equipoModelo) &&
  normTxt(a.tipo) === normTxt(b.tipo) && normTxt(a.codigo) === normTxt(b.codigo) && normTxt(a.proveedor) === normTxt(b.proveedor);

export const guardarFiltro = async () => {
  if (!soloEditor()) return;
  const f = formFiltro.value;
  const row = toRow({ ...f, precio: parseNum(f.precio), cantidad: Math.max(1, parseNum(f.cantidad) || 1) });
  if (!row.codigo) return alert('El código del filtro es obligatorio.');
  if (!row.tipo) return alert('Indica el tipo de filtro (ej: ACEITE MOTOR).');
  if (!row.equipo_marca && !row.equipo_modelo) return alert('Indica la Marca y/o Modelo del equipo al que aplica.');
  if (dbFiltros.value.some(r => r.id !== f.id && mismaClave(r, f))) return alert('Ya existe ese filtro con el mismo código y proveedor para ese modelo y tipo.');

  const original = f.id ? dbFiltros.value.find(r => r.id === f.id) : null;
  if (row.precio > 0 && (!original || original.precio !== row.precio)) row.fecha_precio = hoyISO();
  row.updated_at = new Date().toISOString();

  try {
    if (f.id) await sb(supabaseClient.from(TABLA_FILTROS).update(row).eq('id', f.id));
    else await sb(supabaseClient.from(TABLA_FILTROS).insert([row]));

    // Mantener coherencia en las demás filas:
    //  · el precio es del código + proveedor (vale para todos los modelos)
    if (row.precio > 0 && (!original || original.precio !== row.precio)) {
      let q = supabaseClient.from(TABLA_FILTROS).update({ precio: row.precio, fecha_precio: row.fecha_precio }).eq('codigo', row.codigo).eq('proveedor', row.proveedor);
      if (f.id) q = q.neq('id', f.id);
      await sb(q);
    }
    //  · la cantidad es del modelo + tipo (vale para todos sus códigos equivalentes)
    let q2 = supabaseClient.from(TABLA_FILTROS).update({ cantidad: row.cantidad }).eq('equipo_marca', row.equipo_marca).eq('equipo_modelo', row.equipo_modelo).eq('tipo', row.tipo);
    if (f.id) q2 = q2.neq('id', f.id);
    await sb(q2);
    //  · la marca del filtro es del código
    if (row.marca) await sb(supabaseClient.from(TABLA_FILTROS).update({ marca: row.marca }).eq('codigo', row.codigo).neq('marca', row.marca));
  } catch (err) {
    return alert('Error al guardar el filtro: ' + errMsg(err));
  }
  await cargarDatosDesdeSupabase();
  showModalFiltro.value = false;
};

export const eliminarFiltro = async (row) => {
  if (!soloAdmin()) return;
  if (!confirm(`¿Eliminar el filtro ${row.codigo} (${row.proveedor || 'sin proveedor'}) del modelo ${row.equipoMarca} ${row.equipoModelo}?`)) return;
  try {
    await sb(supabaseClient.from(TABLA_FILTROS).delete().eq('id', row.id));
    dbFiltros.value = dbFiltros.value.filter(r => r.id !== row.id);
  } catch (err) {
    alert('Error al eliminar: ' + errMsg(err));
  }
};

// ---------- Registro automático desde el formulario de Mantención ----------
/**
 * Guarda/actualiza en bd_filtros los filtros usados en una mantención.
 * - Si el filtro ya existe para ese modelo+tipo+código+proveedor: actualiza último uso y precio
 *   (el precio solo si la mantención no es más antigua que el precio guardado).
 * - Si es nuevo: lo crea. Si ya había otro código para ese modelo+tipo, queda como REFERENCIA CRUZADA
 *   y hereda la cantidad requerida que ya tenía ese tipo.
 * Devuelve un texto de aviso ('' si todo bien).
 */
export const registrarFiltrosDesdeMantencion = async (equipo, filtros, fechaISO, afi) => {
  const validos = (filtros || []).filter(f => f && normTxt(f.codigo));
  if (!validos.length) return '';
  if (!equipo || (!normTxt(equipo.marca) && !normTxt(equipo.modelo))) {
    return '\n(Atención: el equipo no tiene Marca/Modelo en el inventario; los filtros quedaron solo en el historial y no en el módulo Filtros.)';
  }
  const fecha = formatIsoDateForSupabase(fechaISO) || hoyISO();
  const errores = [];
  const vistos = new Set();

  for (const f of validos) {
    const item = {
      equipoMarca: equipo.marca, equipoModelo: equipo.modelo,
      tipo: normTxt(f.tipo) || 'SIN TIPO', marca: f.marca, codigo: f.codigo, proveedor: f.proveedor,
      precio: parseNum(f.precio), cantidad: Math.max(1, parseNum(f.cantidad) || 1)
    };
    const row = toRow(item);
    const clave = [row.equipo_marca, row.equipo_modelo, row.tipo, row.codigo, row.proveedor].join('|');
    if (vistos.has(clave)) continue;
    vistos.add(clave);

    const existente = dbFiltros.value.find(r => mismaClave(r, item));
    const grupo = dbFiltros.value.find(r => claveModelo(r.equipoMarca, r.equipoModelo) === claveModelo(item.equipoMarca, item.equipoModelo) && r.tipo === row.tipo);
    const precioVigente = row.precio > 0 && (!existente || !existente.fechaPrecio || fecha >= existente.fechaPrecio);

    try {
      if (existente) {
        const patch = { ultimo_uso: fecha, ultimo_afi: String(afi || ''), updated_at: new Date().toISOString() };
        if (!existente.marca && row.marca) patch.marca = row.marca;
        if (precioVigente) { patch.precio = row.precio; patch.fecha_precio = fecha; }
        await sb(supabaseClient.from(TABLA_FILTROS).update(patch).eq('id', existente.id));
      } else {
        await sb(supabaseClient.from(TABLA_FILTROS).insert([{
          ...row,
          cantidad: grupo ? grupo.cantidad : row.cantidad,
          precio: row.precio,
          fecha_precio: row.precio > 0 ? fecha : null,
          ultimo_uso: fecha, ultimo_afi: String(afi || '')
        }]));
      }
      // El mismo código con el mismo proveedor en otros modelos toma el precio más reciente
      if (precioVigente) {
        await sb(supabaseClient.from(TABLA_FILTROS).update({ precio: row.precio, fecha_precio: fecha })
          .eq('codigo', row.codigo).eq('proveedor', row.proveedor)
          .or(`fecha_precio.is.null,fecha_precio.lte.${fecha}`));
      }
    } catch (err) {
      errores.push(`${row.codigo}: ${errMsg(err)}`);
    }
  }
  return errores.length ? '\n(Atención: algunos filtros no se guardaron en el módulo Filtros: ' + errores.join(' | ') + ')' : '';
};

/** Completa marca / tipo / precio al escribir un código que ya está en el catálogo. */
export const autocompletarFiltro = (f, equipo) => {
  const cod = normTxt(f.codigo);
  if (!cod) return;
  const filas = dbFiltros.value.filter(r => r.codigo === cod);
  if (!filas.length) return;
  const delModelo = equipo ? filas.find(r => claveModelo(r.equipoMarca, r.equipoModelo) === claveModelo(equipo.marca, equipo.modelo)) : null;
  const ref0 = delModelo || filas[0];
  if (!f.marca) f.marca = ref0.marca;
  if (!f.tipo) f.tipo = ref0.tipo;
  if (f.proveedor && !(parseNum(f.precio) > 0)) {
    const conProv = filas.find(r => r.proveedor === normTxt(f.proveedor) && r.precio > 0);
    if (conProv) f.precio = conProv.precio;
  }
};
