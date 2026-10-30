// =====================================================================
// FILTROS · Lógica
//  - Lista de precios por proveedor (comparativo, importable desde Excel, editable)
//  - Aplicaciones: qué códigos usa cada marca/modelo de equipo (referencia cruzada + cantidad)
//  - Registro automático desde el formulario de Mantención
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { dbFiltros, dbFiltrosPrecios, dbEquipos, currentTab, cargarDatosDesdeSupabase, soloAdmin, soloEditor } from '../../core/store.js';
import { parseNum, formatIsoDateForSupabase, formatDateForDisplay, hoyISO, resetInputFile } from '../../core/utils.js';
import { TABLA_FILTROS, TABLA_FILTROS_PRECIOS, normTxt, normCodigo, normTipo, claveModelo } from './filtros.mapper.js';

const { ref, computed } = Vue;

/** Tipos sugeridos (además de los que ya existen en la lista de precios). Se guardan en MAYÚSCULAS. */
export const TIPOS_FILTRO = [
  'ACEITE MOTOR', 'AIRE PRIMARIO', 'AIRE SECUNDARIO', 'COMBUSTIBLE', 'COMBUSTIBLE ELEMENTO',
  'COMBUSTIBLE SEPARADOR', 'COMBUSTIBLE DECANTADOR', 'HIDRAULICO', 'TRANSMISION', 'REFRIGERANTE', 'CABINA'
];

const unicos = (arr) => Array.from(new Set(arr.filter(Boolean))).sort();
const ahora = () => new Date().toISOString();

export const fmtPrecio = (n) => Number(n) > 0 ? '$' + Math.round(Number(n)).toLocaleString('es-CL') : '-';
export const fmtFecha = (f) => f ? formatDateForDisplay(f) : '-';

// ---------- Listas para selectores / autocompletar ----------
export const listaTiposFiltro = computed(() => unicos([...TIPOS_FILTRO, ...dbFiltrosPrecios.value.map(f => f.tipo), ...dbFiltros.value.map(f => f.tipo)]));
export const listaProveedoresFiltro = computed(() => unicos(dbFiltrosPrecios.value.map(f => f.proveedor)));
export const listaMarcasFiltro = computed(() => unicos([...dbFiltrosPrecios.value.map(f => f.marca), ...dbFiltros.value.map(f => f.marca)]));
export const listaMarcasEquipoFiltros = computed(() => unicos([...dbFiltros.value.map(f => f.equipoMarca), ...dbEquipos.value.map(e => normTxt(e.marca))]));
export const listaModelosEquipoFiltros = computed(() => {
  const m = filtroVista.value.equipoMarca;
  return unicos([
    ...dbFiltros.value.filter(f => m === 'ALL' || f.equipoMarca === m).map(f => f.equipoModelo),
    ...dbEquipos.value.filter(e => m === 'ALL' || normTxt(e.marca) === m).map(e => normTxt(e.modelo))
  ]);
});
export const listaTodosModelosEquipo = computed(() => unicos([...dbFiltros.value.map(f => f.equipoModelo), ...dbEquipos.value.map(e => normTxt(e.modelo))]));

/** AFIs del inventario que tienen esa marca + modelo. */
export const equiposDelModelo = (marca, modelo) => {
  const k = claveModelo(marca, modelo);
  return dbEquipos.value.filter(e => claveModelo(e.marca, e.modelo) === k);
};

// ---------- Catálogo: una entrada por código (precios por proveedor + equipos donde se usa) ----------
export const catalogo = computed(() => {
  const map = new Map();
  const get = (codigo) => {
    if (!map.has(codigo)) map.set(codigo, { codigo, marca: '', tipo: '', precios: {}, aplicaciones: [] });
    return map.get(codigo);
  };
  dbFiltrosPrecios.value.forEach(p => {
    const c = get(p.codigo);
    if (!c.marca) c.marca = p.marca;
    if (!c.tipo) c.tipo = p.tipo;
    if (p.precio > 0) c.precios[p.proveedor] = { id: p.id, precio: p.precio, fechaPrecio: p.fechaPrecio };
  });
  dbFiltros.value.forEach(a => {
    const c = get(a.codigo);
    if (!c.marca) c.marca = a.marca;
    if (!c.tipo) c.tipo = a.tipo;
    c.aplicaciones.push(a);
  });
  map.forEach(c => {
    const provs = Object.keys(c.precios);
    const vals = provs.map(p => c.precios[p].precio);
    c.nPrecios = provs.length;
    c.min = vals.length ? Math.min(...vals) : 0;
    c.max = vals.length ? Math.max(...vals) : 0;
    c.mejorProveedor = vals.length ? provs.find(p => c.precios[p].precio === c.min) : '';
    c.ahorro = c.max - c.min;
    c.modelos = unicos(c.aplicaciones.map(a => `${a.equipoMarca} ${a.equipoModelo}`.trim()));
  });
  return map;
});
export const buscarEnCatalogo = (codigo) => catalogo.value.get(normCodigo(codigo)) || null;

// ---------- Filtros de la pantalla ----------
const FILTRO_DEFAULT = () => ({ texto: '', equipoMarca: 'ALL', equipoModelo: 'ALL', tipo: 'ALL', proveedor: 'ALL' });
export const filtroVista = ref(FILTRO_DEFAULT());
export const limpiarFiltroVista = () => { filtroVista.value = FILTRO_DEFAULT(); };
export const vistaFiltros = ref('precios');   // 'precios' | 'cruzada'

const pasaFiltroModelo = (apps) => {
  const f = filtroVista.value;
  if (f.equipoMarca === 'ALL' && f.equipoModelo === 'ALL') return true;
  return apps.some(a => (f.equipoMarca === 'ALL' || a.equipoMarca === f.equipoMarca) && (f.equipoModelo === 'ALL' || a.equipoModelo === f.equipoModelo));
};

/** Vista 1 · Comparativo de precios (igual a la planilla): código x proveedor. */
export const proveedoresColumnas = computed(() => unicos(dbFiltrosPrecios.value.map(p => p.proveedor)));

export const filasComparativo = computed(() => {
  const f = filtroVista.value;
  const q = normTxt(f.texto);
  return Array.from(catalogo.value.values()).filter(c => {
    if (f.tipo !== 'ALL' && c.tipo !== f.tipo) return false;
    if (f.proveedor !== 'ALL' && !c.precios[f.proveedor]) return false;
    if (!pasaFiltroModelo(c.aplicaciones)) return false;
    if (q && ![c.codigo, c.marca, c.tipo, ...c.modelos, ...Object.keys(c.precios)].join(' ').includes(q)) return false;
    return true;
  }).sort((a, b) => a.tipo.localeCompare(b.tipo) || a.marca.localeCompare(b.marca) || a.codigo.localeCompare(b.codigo));
});

/** Vista 2 · Referencia cruzada: Modelo de equipo -> Tipo -> códigos equivalentes (con su mejor precio). */
const opcionDeCodigo = (a) => {
  const c = catalogo.value.get(a.codigo);
  return {
    id: a.id, appId: a.id, codigo: a.codigo, marca: a.marca || c?.marca || '', tipo: a.tipo,
    proveedor: c?.mejorProveedor || '', precio: c?.min || 0, nPrecios: c?.nPrecios || 0,
    cantidad: a.cantidad, ultimoUso: a.ultimoUso, ultimoAfi: a.ultimoAfi
  };
};
const agruparPorTipo = (apps) => {
  const porTipo = {};
  apps.forEach(a => { (porTipo[a.tipo] = porTipo[a.tipo] || []).push(a); });
  return Object.keys(porTipo).sort().map(tipo => {
    const filas = porTipo[tipo].map(opcionDeCodigo).sort((x, y) => {
      if (x.precio > 0 && y.precio > 0) return x.precio - y.precio;
      if (x.precio > 0) return -1;
      if (y.precio > 0) return 1;
      return x.codigo.localeCompare(y.codigo);
    });
    const mejor = filas.find(r => r.precio > 0) || null;
    filas.forEach(r => { r.esMejor = !!mejor && r.precio === mejor.precio; r.difMejor = (mejor && r.precio > 0) ? r.precio - mejor.precio : null; });
    const cantidad = Math.max(...filas.map(r => r.cantidad || 1));
    return { tipo, filas, codigos: filas.length, cantidad, mejor, costo: mejor ? mejor.precio * cantidad : 0 };
  });
};

export const gruposPorModelo = computed(() => {
  const f = filtroVista.value;
  const q = normTxt(f.texto);
  const apps = dbFiltros.value.filter(a => {
    if (f.equipoMarca !== 'ALL' && a.equipoMarca !== f.equipoMarca) return false;
    if (f.equipoModelo !== 'ALL' && a.equipoModelo !== f.equipoModelo) return false;
    if (f.tipo !== 'ALL' && a.tipo !== f.tipo) return false;
    if (f.proveedor !== 'ALL' && !catalogo.value.get(a.codigo)?.precios[f.proveedor]) return false;
    if (q && ![a.codigo, a.marca, a.tipo, a.equipoMarca, a.equipoModelo].join(' ').includes(q)) return false;
    return true;
  });
  const porModelo = {};
  apps.forEach(a => {
    const k = claveModelo(a.equipoMarca, a.equipoModelo);
    (porModelo[k] = porModelo[k] || { key: k, marca: a.equipoMarca, modelo: a.equipoModelo, apps: [] }).apps.push(a);
  });
  return Object.values(porModelo).sort((a, b) => a.key.localeCompare(b.key))
    .map(g => ({ ...g, equipos: equiposDelModelo(g.marca, g.modelo), tipos: agruparPorTipo(g.apps) }));
});

export const kpisFiltros = computed(() => ({
  codigos: catalogo.value.size,
  proveedores: proveedoresColumnas.value.length,
  modelos: new Set(dbFiltros.value.map(a => claveModelo(a.equipoMarca, a.equipoModelo))).size,
  cruzadas: gruposPorModelo.value.reduce((n, g) => n + g.tipos.filter(t => t.codigos > 1).length, 0)
}));

// ---------- Filtros que usa un modelo (Perfil de Equipo / formulario de mantención) ----------
export const requeridosPorModelo = (marca, modelo) => {
  const k = claveModelo(marca, modelo);
  if (k === '|') return [];
  return agruparPorTipo(dbFiltros.value.filter(a => claveModelo(a.equipoMarca, a.equipoModelo) === k));
};

/** Ir al módulo Filtros mostrando solo ese modelo (para corregir datos). */
export const irAFiltrosDelModelo = (marca, modelo) => {
  filtroVista.value = { ...FILTRO_DEFAULT(), equipoMarca: normTxt(marca) || 'ALL', equipoModelo: normTxt(modelo) || 'ALL' };
  vistaFiltros.value = 'cruzada';
  currentTab.value = 'filtros';
};

// =====================================================================
// EDITAR / AGREGAR UN CÓDIGO (precios por proveedor + equipos donde se usa)
// =====================================================================
export const showModalCodigo = ref(false);
export const formCodigo = ref(null);

const formDesdeCatalogo = (c) => {
  const precios = {};
  proveedoresColumnas.value.forEach(p => { precios[p] = ''; });
  if (c) Object.keys(c.precios).forEach(p => { precios[p] = c.precios[p].precio; });
  return {
    original: c ? c.codigo : null,
    codigo: c ? c.codigo : '', marca: c ? c.marca : '', tipo: c ? c.tipo : '',
    precios, nuevoProveedor: '',
    aplicaciones: c ? c.aplicaciones.map(a => ({ id: a.id, equipoMarca: a.equipoMarca, equipoModelo: a.equipoModelo, tipo: a.tipo, cantidad: a.cantidad })) : []
  };
};

export const nuevoCodigo = () => { if (!soloEditor()) return; formCodigo.value = formDesdeCatalogo(null); showModalCodigo.value = true; };
export const editarCodigo = (codigoOEntrada) => {
  if (!soloEditor()) return;
  const c = typeof codigoOEntrada === 'string' ? buscarEnCatalogo(codigoOEntrada) : codigoOEntrada;
  formCodigo.value = formDesdeCatalogo(c);
  showModalCodigo.value = true;
};
export const agregarProveedorForm = () => {
  const p = normTxt(formCodigo.value.nuevoProveedor);
  if (!p) return;
  if (!(p in formCodigo.value.precios)) formCodigo.value.precios[p] = '';
  formCodigo.value.nuevoProveedor = '';
};
export const agregarAplicacionForm = () => {
  formCodigo.value.aplicaciones.push({ id: null, equipoMarca: '', equipoModelo: '', tipo: formCodigo.value.tipo, cantidad: 1 });
};
export const quitarAplicacionForm = (i) => { formCodigo.value.aplicaciones.splice(i, 1); };

export const guardarCodigo = async () => {
  if (!soloEditor()) return;
  const f = formCodigo.value;
  const codigo = normCodigo(f.codigo);
  const marca = normTxt(f.marca);
  const tipo = normTipo(f.tipo);
  if (!codigo) return alert('El código es obligatorio.');
  if (!tipo) return alert('Indica el tipo de filtro.');
  if (codigo !== f.original && catalogo.value.has(codigo)) return alert(`El código ${codigo} ya existe. Edítalo desde su fila.`);

  const apps = f.aplicaciones.map(a => ({
    id: a.id, equipo_marca: normTxt(a.equipoMarca), equipo_modelo: normTxt(a.equipoModelo),
    tipo: normTipo(a.tipo) || tipo, cantidad: Math.max(1, parseNum(a.cantidad) || 1)
  }));
  if (apps.some(a => !a.equipo_marca && !a.equipo_modelo)) return alert('Cada equipo debe tener Marca y/o Modelo.');
  const claves = apps.map(a => `${a.equipo_marca}|${a.equipo_modelo}|${a.tipo}`);
  if (new Set(claves).size !== claves.length) return alert('Hay un mismo modelo y tipo repetido en la lista de equipos.');

  const original = f.original ? buscarEnCatalogo(f.original) : null;
  const filasPrecioOrig = f.original ? dbFiltrosPrecios.value.filter(p => p.codigo === f.original) : [];

  try {
    // 1) Precios por proveedor (vacío = se borra ese precio)
    for (const [provRaw, valor] of Object.entries(f.precios)) {
      const proveedor = normTxt(provRaw);
      const precio = parseNum(valor);
      const fila = filasPrecioOrig.find(p => p.proveedor === proveedor);
      if (precio > 0) {
        const cambioPrecio = !fila || fila.precio !== precio;
        const row = { codigo, marca, tipo, proveedor, precio, updated_at: ahora(), ...(cambioPrecio ? { fecha_precio: hoyISO() } : {}) };
        if (fila) await sb(supabaseClient.from(TABLA_FILTROS_PRECIOS).update(row).eq('id', fila.id));
        else await sb(supabaseClient.from(TABLA_FILTROS_PRECIOS).insert([row]));
      } else if (fila) {
        await sb(supabaseClient.from(TABLA_FILTROS_PRECIOS).delete().eq('id', fila.id));
      }
    }
    if (f.original && f.original !== codigo) await sb(supabaseClient.from(TABLA_FILTROS_PRECIOS).update({ codigo }).eq('codigo', f.original));

    // 2) Equipos donde se usa (aplicaciones)
    const idsForm = new Set(apps.filter(a => a.id).map(a => a.id));
    for (const a of (original?.aplicaciones || [])) {
      if (!idsForm.has(a.id)) await sb(supabaseClient.from(TABLA_FILTROS).delete().eq('id', a.id));
    }
    for (const a of apps) {
      const row = { equipo_marca: a.equipo_marca, equipo_modelo: a.equipo_modelo, tipo: a.tipo, codigo, marca, cantidad: a.cantidad, updated_at: ahora() };
      if (a.id) await sb(supabaseClient.from(TABLA_FILTROS).update(row).eq('id', a.id));
      else await sb(supabaseClient.from(TABLA_FILTROS).insert([row]));
      // La cantidad es del modelo + tipo: se aplica también a sus códigos equivalentes
      await sb(supabaseClient.from(TABLA_FILTROS).update({ cantidad: a.cantidad })
        .eq('equipo_marca', a.equipo_marca).eq('equipo_modelo', a.equipo_modelo).eq('tipo', a.tipo).neq('codigo', codigo));
    }
  } catch (err) {
    await cargarDatosDesdeSupabase();
    return alert('Error al guardar el filtro: ' + errMsg(err));
  }
  await cargarDatosDesdeSupabase();
  showModalCodigo.value = false;
};

export const eliminarCodigo = async (c) => {
  if (!soloAdmin()) return;
  const usos = c.aplicaciones.length ? ` y se quitará de ${c.aplicaciones.length} modelo(s) de equipo` : '';
  if (!confirm(`¿Eliminar el filtro ${c.codigo}? Se borrarán sus ${c.nPrecios} precio(s)${usos}.`)) return;
  try {
    await sb(supabaseClient.from(TABLA_FILTROS_PRECIOS).delete().eq('codigo', c.codigo));
    await sb(supabaseClient.from(TABLA_FILTROS).delete().eq('codigo', c.codigo));
  } catch (err) {
    alert('Error al eliminar: ' + errMsg(err));
  }
  await cargarDatosDesdeSupabase();
  showModalCodigo.value = false;
};

/** Quitar un código de un modelo (desde la vista de referencia cruzada). Sus precios se mantienen. */
export const quitarAplicacion = async (fila, modeloTxt) => {
  if (!soloAdmin()) return;
  if (!confirm(`¿Quitar el filtro ${fila.codigo} del modelo ${modeloTxt}? (Sus precios se mantienen)`)) return;
  try { await sb(supabaseClient.from(TABLA_FILTROS).delete().eq('id', fila.appId)); }
  catch (err) { alert('Error: ' + errMsg(err)); }
  await cargarDatosDesdeSupabase();
};

// =====================================================================
// IMPORTAR LA PLANILLA DE PRECIOS (formato "PRECIO FILTROS": CODIGO | MARCA | TIPO | proveedor1 | proveedor2 | ...)
// =====================================================================
export const importandoPrecios = ref(false);
const sinTildes = (v) => normTxt(v).normalize('NFD').replace(/[̀-ͯ]/g, '');

const leerExcelMatriz = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
      for (const name of wb.SheetNames) {
        const m = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
        const h = m.findIndex((r, i) => i < 15 && (r || []).some(c => sinTildes(c) === 'CODIGO'));
        if (h >= 0) return resolve({ matriz: m, header: h });
      }
      reject(new Error('No se encontró una fila de encabezado con la columna CODIGO.'));
    } catch (e) { reject(new Error('No se pudo leer el archivo Excel.')); }
  };
  reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
  reader.readAsArrayBuffer(file);
});

export const importarPreciosExcel = async (e) => {
  if (!soloAdmin()) return;
  const file = e.target.files[0]; if (!file) return;
  importandoPrecios.value = true;
  try {
    const { matriz, header } = await leerExcelMatriz(file);
    const enc = (matriz[header] || []).map(sinTildes);
    const iCod = enc.indexOf('CODIGO'), iMarca = enc.indexOf('MARCA'), iTipo = enc.indexOf('TIPO');
    const colsProv = enc.map((h, i) => ({ h: normTxt(matriz[header][i]), i }))
      .filter(c => c.h && ![iCod, iMarca, iTipo].includes(c.i) && !/^COLUMNA\s*\d*$/.test(c.h));
    if (!colsProv.length) throw new Error('No se encontraron columnas de proveedores después de CODIGO / MARCA / TIPO.');

    const porClave = new Map();
    const codigos = new Set();
    const hoy = hoyISO();
    matriz.slice(header + 1).forEach(r => {
      const codigo = normCodigo(r?.[iCod]);
      if (!codigo) return;
      codigos.add(codigo);
      colsProv.forEach(({ h, i }) => {
        const precio = parseNum(r[i]);
        if (precio > 0) porClave.set(`${codigo}|${h}`, {
          codigo, marca: iMarca >= 0 ? normTxt(r[iMarca]) : '', tipo: iTipo >= 0 ? normTipo(r[iTipo]) : '',
          proveedor: h, precio, fecha_precio: hoy, updated_at: ahora()
        });
      });
    });
    const filas = Array.from(porClave.values());
    if (!filas.length) throw new Error('El archivo no trae precios.');
    if (!confirm(`Se cargarán ${filas.length} precios de ${codigos.size} códigos y ${colsProv.length} proveedores:\n${colsProv.map(c => c.h).join(', ')}\n\nLos precios que ya existan para el mismo código y proveedor se reemplazan. ¿Continuar?`)) return;

    for (let k = 0; k < filas.length; k += 500) {
      await sb(supabaseClient.from(TABLA_FILTROS_PRECIOS).upsert(filas.slice(k, k + 500), { onConflict: 'codigo,proveedor' }));
    }
    await cargarDatosDesdeSupabase();
    alert(`¡Lista de precios importada! ${filas.length} precios de ${codigos.size} códigos.`);
  } catch (err) {
    alert('Error al importar la lista de precios: ' + errMsg(err));
  } finally {
    importandoPrecios.value = false;
    resetInputFile(e);
  }
};

/** Exportar el comparativo tal como se ve (mismo formato que la planilla). */
export const exportarComparativo = (exportarCSV) => {
  const provs = proveedoresColumnas.value;
  exportarCSV(filasComparativo.value.map(c => ({
    CODIGO: c.codigo, MARCA: c.marca, TIPO: c.tipo,
    ...Object.fromEntries(provs.map(p => [p, c.precios[p]?.precio || ''])),
    MEJOR_PROVEEDOR: c.mejorProveedor, MEJOR_PRECIO: c.min || '', APLICA_A: c.modelos.join(' / ')
  })), 'Comparativo_Filtros');
};

// =====================================================================
// REGISTRO AUTOMÁTICO DESDE EL FORMULARIO DE MANTENCIÓN
// =====================================================================
/**
 * Por cada filtro usado en la mantención:
 *  1) Lo enlaza con la MARCA + MODELO del equipo (bd_filtros). Si ese tipo ya tenía otro código para
 *     el modelo, queda como REFERENCIA CRUZADA y hereda la cantidad que ya tenía ese tipo.
 *  2) Si trae proveedor y precio, actualiza la lista de precios (bd_filtros_precios)
 *     — salvo que la mantención sea más antigua que el precio guardado.
 * Devuelve un texto de aviso ('' si todo bien).
 */
export const registrarFiltrosDesdeMantencion = async (equipo, filtros, fechaISO, afi) => {
  const validos = (filtros || []).filter(f => f && normCodigo(f.codigo));
  if (!validos.length) return '';
  const fecha = formatIsoDateForSupabase(fechaISO) || hoyISO();
  const tieneModelo = equipo && (normTxt(equipo.marca) || normTxt(equipo.modelo));
  const errores = [];
  const vistos = new Set();

  for (const f of validos) {
    const codigo = normCodigo(f.codigo);
    const cat = catalogo.value.get(codigo);
    const tipo = normTipo(f.tipo) || cat?.tipo || 'SIN TIPO';
    const marca = normTxt(f.marca) || cat?.marca || '';
    const proveedor = normTxt(f.proveedor);
    const precio = parseNum(f.precio);
    try {
      // 1) Enlace con el modelo del equipo
      if (tieneModelo) {
        const em = normTxt(equipo.marca), mo = normTxt(equipo.modelo);
        const clave = `${em}|${mo}|${tipo}|${codigo}`;
        if (!vistos.has(clave)) {
          vistos.add(clave);
          const delModelo = dbFiltros.value.filter(a => a.equipoMarca === em && a.equipoModelo === mo && a.tipo === tipo);
          const existente = delModelo.find(a => a.codigo === codigo);
          if (existente) {
            await sb(supabaseClient.from(TABLA_FILTROS).update({ ultimo_uso: fecha, ultimo_afi: String(afi || ''), updated_at: ahora(), ...(!existente.marca && marca ? { marca } : {}) }).eq('id', existente.id));
          } else {
            await sb(supabaseClient.from(TABLA_FILTROS).insert([{
              equipo_marca: em, equipo_modelo: mo, tipo, codigo, marca,
              cantidad: delModelo.length ? delModelo[0].cantidad : Math.max(1, parseNum(f.cantidad) || 1),
              ultimo_uso: fecha, ultimo_afi: String(afi || '')
            }]));
          }
        }
      }
      // 2) Lista de precios
      if (proveedor && precio > 0) {
        const fila = dbFiltrosPrecios.value.find(p => p.codigo === codigo && p.proveedor === proveedor);
        if (!fila) {
          await sb(supabaseClient.from(TABLA_FILTROS_PRECIOS).insert([{ codigo, marca, tipo, proveedor, precio, fecha_precio: fecha }]));
        } else if (!fila.fechaPrecio || fecha >= fila.fechaPrecio) {
          await sb(supabaseClient.from(TABLA_FILTROS_PRECIOS).update({ precio, fecha_precio: fecha, updated_at: ahora() }).eq('id', fila.id));
        }
      }
    } catch (err) {
      errores.push(`${codigo}: ${errMsg(err)}`);
    }
  }
  let aviso = '';
  if (!tieneModelo) aviso += '\n(Atención: el equipo no tiene Marca/Modelo en el inventario; los filtros no se pudieron enlazar a un modelo.)';
  if (errores.length) aviso += '\n(Atención: algunos filtros no se guardaron en el módulo Filtros: ' + errores.join(' | ') + ')';
  return aviso;
};

/** Al escribir un código conocido completa marca / tipo, y proveedor + precio (el más barato si no hay proveedor). */
export const autocompletarFiltro = (f, equipo, campo = 'codigo') => {
  const c = buscarEnCatalogo(f.codigo);
  if (!c) return;
  if (!f.marca) f.marca = c.marca;
  if (!f.tipo) {
    const app = equipo ? c.aplicaciones.find(a => claveModelo(a.equipoMarca, a.equipoModelo) === claveModelo(equipo.marca, equipo.modelo)) : null;
    f.tipo = app ? app.tipo : c.tipo;
  }
  const prov = normTxt(f.proveedor);
  if (prov) {
    if (c.precios[prov] && (campo === 'proveedor' || !(parseNum(f.precio) > 0))) f.precio = c.precios[prov].precio;
  } else if (c.mejorProveedor) {
    f.proveedor = c.mejorProveedor;
    if (!(parseNum(f.precio) > 0)) f.precio = c.min;
  }
};
