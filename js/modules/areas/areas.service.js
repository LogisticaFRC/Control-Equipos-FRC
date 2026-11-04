// =====================================================================
// ÁREAS · Lógica: árbol Empresa → Área → Locación → Equipos (AFI)
// ---------------------------------------------------------------------
// - Las locaciones se guardan en bd_locaciones (ver sql/areas.sql).
// - Cada equipo guarda su locacion_id en BD_INVENTARIO y además, para que el
//   resto del sistema siga igual: ubicacion = "ÁREA / LOCACIÓN" y
//   empresa_arriendo = EMPRESA (Fuera de Servicio → siempre TALLER FRC).
// - Se usa desde: módulo Áreas, Perfil de Equipo y Registrar Movimiento.
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { dbLocaciones, dbEquipos, usuarioActivo, cargarDatosDesdeSupabase, soloAdmin, soloEditor, isAdmin } from '../../core/store.js';
import { compararAfi, hoyISO, formatIsoDateForSupabase, formatDateForDisplay } from '../../core/utils.js';
import { TABLA_LOCACIONES, TIPOS, normNombre, mapLocacion } from './areas.mapper.js';
import { TABLA_INVENTARIO, esFueraDeServicio, EMPRESA_TALLER } from '../inventario/inventario.mapper.js';
import { TABLA_MOVIMIENTOS } from '../movimientos/movimientos.mapper.js';
import { nuevoLibro, hojaTabla, descargarLibro } from '../../core/excel.js';

const { ref, computed, reactive } = Vue;

export { TIPOS };
export const NUEVA = '__NUEVA__';   // valor de los <select> para "➕ Crear nueva…"

export const ETIQUETA = { EMPRESA: 'Empresa', AREA: 'Área', LOCACION: 'Locación' };
export const ICONO = { EMPRESA: 'fa-building', AREA: 'fa-folder', LOCACION: 'fa-location-dot' };
export const HIJO_DE = { EMPRESA: 'AREA', AREA: 'LOCACION', LOCACION: null };

const AVISO_SQL = "Falta crear la estructura del módulo Áreas en la base de datos.\n\nEjecuta en Supabase → SQL Editor el archivo sql/areas.sql (una sola vez) y actualiza la página.";
const faltaSQL = (err) => /bd_locaciones|locacion_id|schema cache|does not exist/i.test(errMsg(err));

// ---------------------------------------------------------------------
// Consultas al árbol
// ---------------------------------------------------------------------
const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true });

export const nodo = (id) => (id == null || id === '' ? null : dbLocaciones.value.find(n => String(n.id) === String(id)) || null);
export const hijos = (padreId) => dbLocaciones.value.filter(n => String(n.padreId ?? '') === String(padreId ?? '') && (padreId != null || n.tipo === TIPOS.EMPRESA)).sort(porNombre);
export const empresas = computed(() => dbLocaciones.value.filter(n => n.tipo === TIPOS.EMPRESA).sort(porNombre));

/** { empresa, area, locacion } (nodos) de una locación. */
export const rutaDe = (locId) => {
  const loc = nodo(locId);
  if (!loc || loc.tipo !== TIPOS.LOCACION) return { empresa: null, area: null, locacion: null };
  const area = nodo(loc.padreId);
  const empresa = area ? nodo(area.padreId) : null;
  return { empresa, area, locacion: loc };
};
/** Texto que se guarda en BD_INVENTARIO.ubicacion y en el destino del movimiento: "ÁREA / LOCACIÓN". */
export const textoUbicacion = (locId) => {
  const r = rutaDe(locId);
  if (!r.locacion) return '';
  return [r.area?.nombre, r.locacion.nombre].filter(Boolean).join(' / ');
};
/** Ruta completa para mostrar: "EMPRESA › ÁREA › LOCACIÓN". */
export const rutaTexto = (locId) => {
  const r = rutaDe(locId);
  return [r.empresa?.nombre, r.area?.nombre, r.locacion?.nombre].filter(Boolean).join(' › ');
};

/** Equipos agrupados por locación (id → [equipos]). */
export const equiposPorLocacion = computed(() => {
  const m = new Map();
  dbEquipos.value.forEach(e => {
    if (e.locacionId == null || !nodo(e.locacionId)) return;
    const k = String(e.locacionId);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(e);
  });
  m.forEach(arr => arr.sort((a, b) => compararAfi(a.afi, b.afi)));
  return m;
});
export const equiposDeLocacion = (locId) => equiposPorLocacion.value.get(String(locId)) || [];
/** Equipos sin locación asignada (o con una locación que ya no existe). */
export const equiposSinLocacion = computed(() => dbEquipos.value.filter(e => e.locacionId == null || !nodo(e.locacionId)));

/** Locaciones dentro de un nodo (él mismo si es locación). */
export const locacionesBajo = (id) => {
  const n = nodo(id); if (!n) return [];
  if (n.tipo === TIPOS.LOCACION) return [n];
  return hijos(n.id).flatMap(h => locacionesBajo(h.id));
};
export const equiposBajo = (id) => locacionesBajo(id).flatMap(l => equiposDeLocacion(l.id)).sort((a, b) => compararAfi(a.afi, b.afi));
export const conteoEquipos = (id) => locacionesBajo(id).reduce((s, l) => s + equiposDeLocacion(l.id).length, 0);

// ---------------------------------------------------------------------
// Selección en cascada (componente <selector-locacion>)
//   sel = { empresaId, areaId, locacionId, nuevaEmpresa, nuevaArea, nuevaLocacion }
//   empresaId / areaId / locacionId pueden valer NUEVA → se escribe el nombre.
// ---------------------------------------------------------------------
export const selDesdeLocacion = (locId) => {
  const r = rutaDe(locId);
  return reactive({
    empresaId: r.empresa?.id ?? '', areaId: r.area?.id ?? '', locacionId: r.locacion?.id ?? '',
    nuevaEmpresa: '', nuevaArea: '', nuevaLocacion: ''
  });
};
/** Nombre elegido o escrito en cada nivel. */
export const nombresSel = (s) => ({
  empresa: s.empresaId === NUEVA ? normNombre(s.nuevaEmpresa) : (nodo(s.empresaId)?.nombre || ''),
  area: s.areaId === NUEVA ? normNombre(s.nuevaArea) : (nodo(s.areaId)?.nombre || ''),
  locacion: s.locacionId === NUEVA ? normNombre(s.nuevaLocacion) : (nodo(s.locacionId)?.nombre || '')
});
/** La selección llega hasta una locación (existente o nueva con nombre). */
export const selCompleta = (s) => { const n = nombresSel(s); return Boolean(s && n.empresa && n.area && n.locacion); };
/** La selección no tiene nada elegido. */
export const selVacia = (s) => !s || (!s.empresaId && !s.areaId && !s.locacionId);
/** Algo de la selección se va a crear. */
export const selCreaAlgo = (s) => s && [s.empresaId, s.areaId, s.locacionId].includes(NUEVA);

/** Crea (si no existe) un nodo y devuelve su id. Si ya hay uno con ese nombre en la misma carpeta, devuelve ese. */
export const crearNodo = async (tipo, nombre, padreId = null, descripcion = '') => {
  const nom = normNombre(nombre);
  if (!nom) throw new Error(`Falta el nombre de la ${ETIQUETA[tipo].toLowerCase()}.`);
  const existe = dbLocaciones.value.find(n => n.tipo === tipo && String(n.padreId ?? '') === String(padreId ?? '') && n.nombre === nom);
  if (existe) return existe.id;
  try {
    const data = await sb(supabaseClient.from(TABLA_LOCACIONES)
      .insert([{ tipo, nombre: nom, padre_id: padreId, descripcion: descripcion || null, creado_por: usuarioActivo.value?.nombre || null }])
      .select());
    const fila = mapLocacion(data[0]);
    dbLocaciones.value = [...dbLocaciones.value, fila];   // queda disponible al tiro (sin recargar todo)
    return fila.id;
  } catch (err) {
    if (faltaSQL(err)) throw new Error(AVISO_SQL);
    throw err;
  }
};

/** Crea lo que falte de la selección (empresa → área → locación) y devuelve el id de la locación. */
export const resolverSeleccion = async (s) => {
  if (!selCompleta(s)) throw new Error('Completa Empresa, Área y Locación.');
  let empresaId = s.empresaId, areaId = s.areaId, locId = s.locacionId;
  if (empresaId === NUEVA) { empresaId = await crearNodo(TIPOS.EMPRESA, s.nuevaEmpresa, null); s.empresaId = empresaId; s.nuevaEmpresa = ''; }
  if (areaId === NUEVA) { areaId = await crearNodo(TIPOS.AREA, s.nuevaArea, empresaId); s.areaId = areaId; s.nuevaArea = ''; }
  if (locId === NUEVA) { locId = await crearNodo(TIPOS.LOCACION, s.nuevaLocacion, areaId); s.locacionId = locId; s.nuevaLocacion = ''; }
  return locId;
};

/** Columnas de BD_INVENTARIO que cambian al dejar un equipo en una locación. */
export const payloadLocacionEquipo = (equipo, locId) => {
  const r = rutaDe(locId);
  return {
    locacion_id: r.locacion ? r.locacion.id : null,
    ubicacion: r.locacion ? textoUbicacion(locId) : (equipo?.ubicacion || ''),
    empresa_arriendo: esFueraDeServicio(equipo) ? EMPRESA_TALLER : (r.empresa?.nombre || equipo?.empresaArriendo || null)
  };
};

// ---------------------------------------------------------------------
// Pantalla del módulo
// ---------------------------------------------------------------------
/** Carpeta abierta: null = todas las empresas · 'SIN' = equipos sin locación · id = empresa / área / locación. */
export const nodoAbierto = ref(null);
export const busquedaAreas = ref('');
export const expandidos = reactive({});   // árbol lateral

export const abrirNodo = (id) => {
  nodoAbierto.value = id;
  // Expande el camino en el árbol
  let n = nodo(id);
  while (n) { expandidos[n.id] = true; n = nodo(n.padreId); }
};
export const nodoActual = computed(() => (nodoAbierto.value === 'SIN' ? null : nodo(nodoAbierto.value)));
/** Migas de pan del nodo abierto. */
export const migas = computed(() => {
  const out = [];
  let n = nodoActual.value;
  while (n) { out.unshift(n); n = nodo(n.padreId); }
  return out;
});
/** Si el nodo abierto se eliminó, volver a la raíz. */
export const validarNodoAbierto = () => {
  if (nodoAbierto.value && nodoAbierto.value !== 'SIN' && !nodo(nodoAbierto.value)) nodoAbierto.value = null;
};

/** Hijos que se muestran como carpetas en el panel derecho. */
export const carpetasVisibles = computed(() => {
  if (nodoAbierto.value === 'SIN') return [];
  if (!nodoActual.value) return empresas.value;
  return hijos(nodoActual.value.id);
});

/** Resumen general. */
export const resumenAreas = computed(() => ({
  empresas: empresas.value.length,
  areas: dbLocaciones.value.filter(n => n.tipo === TIPOS.AREA).length,
  locaciones: dbLocaciones.value.filter(n => n.tipo === TIPOS.LOCACION).length,
  conLocacion: dbEquipos.value.length - equiposSinLocacion.value.length,
  sinLocacion: equiposSinLocacion.value.length
}));

/** Búsqueda global: AFI / equipo / nombre de empresa, área o locación. */
export const resultadosBusqueda = computed(() => {
  const q = busquedaAreas.value.trim().toUpperCase();
  if (!q) return null;
  const nodos = dbLocaciones.value.filter(n => n.nombre.includes(q)).sort(porNombre).slice(0, 40);
  const equipos = dbEquipos.value.filter(e => [e.afi, e.tipo, e.marca, e.modelo].join(' ').toUpperCase().includes(q)).slice(0, 60);
  return { nodos, equipos };
});

// ---------- Crear / renombrar / eliminar carpetas ----------
export const formNodo = ref(null);   // { modo: 'crear'|'editar', tipo, padreId, id, nombre, descripcion, geo }

export const abrirCrearNodo = (tipo, padreId = null) => {
  if (!soloEditor()) return;
  formNodo.value = { modo: 'crear', tipo, padreId, id: null, nombre: '', descripcion: '', geo: '' };
};
export const abrirEditarNodo = (n) => {
  if (!soloEditor()) return;
  formNodo.value = { modo: 'editar', tipo: n.tipo, padreId: n.padreId, id: n.id, nombre: n.nombre, descripcion: n.descripcion, geo: textoGeo(n) };
};
/** Coordenadas leídas de lo escrito en el formulario (para mostrarlas antes de guardar). */
export const geoFormNodo = computed(() => (formNodo.value ? parseGeo(formNodo.value.geo) : null));
export const guardandoNodo = ref(false);
export const guardarNodo = async () => {
  const f = formNodo.value; if (!f) return;
  const nom = normNombre(f.nombre);
  if (!nom) return alert('Escribe el nombre.');
  const dup = dbLocaciones.value.find(n => n.tipo === f.tipo && String(n.padreId ?? '') === String(f.padreId ?? '') && n.nombre === nom && String(n.id) !== String(f.id));
  if (dup) return alert(`Ya existe ${ETIQUETA[f.tipo].toLowerCase()} "${nom}" en esta carpeta.`);
  // Georreferencia: link de Google Maps o coordenadas
  const geoTxt = String(f.geo || '').trim();
  const geo = parseGeo(geoTxt);
  const esLink = /^https?:\/\//i.test(geoTxt);
  if (geoTxt && !geo && !esLink) return alert('No se reconoce la georreferencia.\n\nPega un link de Google Maps o las coordenadas, por ejemplo:\n-33.4489, -70.6693');
  if (geoTxt && !geo && esLink && !confirm('De este link no se pueden leer las coordenadas (los links cortos "maps.app.goo.gl" no las traen).\n\nSe guardará el link, pero el punto NO aparecerá en el mapa.\nPara que aparezca: en Google Maps haz clic derecho sobre el lugar → copia las coordenadas (ej. -33.4489, -70.6693) y pégalas aquí.\n\n¿Guardar solo el link?')) return;
  const geoPayload = { lat: geo ? geo.lat : null, lng: geo ? geo.lng : null, maps_url: esLink ? geoTxt : null };
  guardandoNodo.value = true;
  try {
    if (f.modo === 'crear') {
      const id = await crearNodo(f.tipo, nom, f.padreId, f.descripcion);
      if (geoTxt) await guardarGeo(id, geoPayload);
      formNodo.value = null;
      abrirNodo(id);
    } else {
      await sb(supabaseClient.from(TABLA_LOCACIONES).update({ nombre: nom, descripcion: f.descripcion || null }).eq('id', f.id));
      await guardarGeo(f.id, geoPayload);
      // Al renombrar, el texto de ubicación de sus equipos se actualiza
      const afectados = equiposBajo(f.id);
      const viejo = dbLocaciones.value.find(n => String(n.id) === String(f.id));
      if (viejo) { viejo.nombre = nom; viejo.descripcion = f.descripcion || ''; }
      await actualizarTextosEquipos(afectados);
      formNodo.value = null;
      await cargarDatosDesdeSupabase();
    }
  } catch (err) {
    alert('Error al guardar: ' + (faltaSQL(err) ? AVISO_SQL : errMsg(err)));
  } finally { guardandoNodo.value = false; }
};

/** Guarda lat / lng / maps_url de un nodo. */
const guardarGeo = async (id, g) => {
  try {
    await sb(supabaseClient.from(TABLA_LOCACIONES).update(g).eq('id', id));
  } catch (err) {
    if (/\blat\b|\blng\b|maps_url/i.test(errMsg(err))) throw new Error(AVISO_GEO_SQL);
    throw err;
  }
  const n = dbLocaciones.value.find(x => String(x.id) === String(id));
  if (n) { n.lat = g.lat; n.lng = g.lng; n.mapsUrl = g.maps_url || ''; }
};

// ---------------------------------------------------------------------
// Georreferencia (Google Maps)
// ---------------------------------------------------------------------
const AVISO_GEO_SQL = "Falta agregar la georreferencia en la base de datos.\n\nEjecuta en Supabase → SQL Editor el archivo sql/areas_georef.sql (una sola vez) y actualiza la página.";
const coordOk = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
const dmsADec = (g, m, sgs, hemi) => {
  const v = Number(g) + (Number(m) || 0) / 60 + (Number(sgs) || 0) / 3600;
  return /[SWO]/i.test(hemi) ? -v : v;
};
/**
 * Lee coordenadas desde: link largo de Google Maps (…/@-33.4,-70.6,15z · …!3d-33.4!4d-70.6 · ?q=-33.4,-70.6),
 * coordenadas decimales ("-33.4489, -70.6693") o en grados (33°26'56"S 70°40'09"W).
 * Devuelve { lat, lng } o null.
 */
export const parseGeo = (txt) => {
  let s = String(txt || '').trim();
  try { s = decodeURIComponent(s); } catch (_) { /* texto con % suelto */ }
  s = s.replace(/\+/g, ' ');
  if (!s) return null;
  const num = '(-?\\d{1,3}(?:\\.\\d+)?)';
  const pruebas = [
    new RegExp(`!3d${num}!4d${num}`),                                   // punto exacto del lugar
    new RegExp(`[?&](?:q|query|ll|destination|daddr|center)=(?:loc:)?\\s*${num}\\s*,\\s*${num}`),
    new RegExp(`@${num},${num}`),                                       // centro del mapa
    new RegExp(`^${num}\\s*[,;\\s]\\s*${num}$`)                       // "-33.4489, -70.6693"
  ];
  for (const re of pruebas) {
    const m = s.match(re);
    if (m && coordOk(Number(m[1]), Number(m[2]))) return { lat: Number(m[1]), lng: Number(m[2]) };
  }
  // Grados, minutos, segundos: 33°26'56.0"S 70°40'09.5"W
  const dms = s.match(/(\d{1,3})°\s*(\d{1,2})?['′]?\s*(\d{1,2}(?:[.,]\d+)?)?["″]?\s*([NS])[\s,]+(\d{1,3})°\s*(\d{1,2})?['′]?\s*(\d{1,2}(?:[.,]\d+)?)?["″]?\s*([EWO])/i);
  if (dms) {
    const lat = dmsADec(dms[1], dms[2], String(dms[3] || 0).replace(',', '.'), dms[4]);
    const lng = dmsADec(dms[5], dms[6], String(dms[7] || 0).replace(',', '.'), dms[8]);
    if (coordOk(lat, lng)) return { lat, lng };
  }
  return null;
};
const tieneCoords = (n) => n && n.lat != null && n.lng != null && coordOk(n.lat, n.lng);
/** Texto para el campo del formulario: el link guardado o "lat, lng". */
export const textoGeo = (n) => (!n ? '' : n.mapsUrl || (tieneCoords(n) ? `${n.lat}, ${n.lng}` : ''));
/** Coordenadas de un nodo; si no tiene, las hereda del área o de la empresa (heredado = true). */
export const coordsDe = (id) => {
  let n = nodo(id), heredado = false;
  while (n) {
    if (tieneCoords(n)) return { lat: n.lat, lng: n.lng, heredado, de: n };
    n = nodo(n.padreId); heredado = true;
  }
  return null;
};
/** Tiene georreferencia propia (coordenadas o link). */
export const tieneGeo = (n) => Boolean(n && (tieneCoords(n) || n.mapsUrl));
/** Link para abrir en Google Maps (el pegado por el usuario o uno armado con las coordenadas). */
export const googleMapsUrl = (id) => {
  const n = nodo(id);
  if (n?.mapsUrl) return n.mapsUrl;
  const c = coordsDe(id);
  return c ? `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}` : '';
};
/** Mapa de Google embebido (sin API key) para un punto. */
export const googleEmbedUrl = (id, zoom = 15) => {
  const c = coordsDe(id);
  return c ? `https://maps.google.com/maps?q=${c.lat},${c.lng}&z=${zoom}&output=embed` : '';
};
/** Buscar el nombre del lugar en Google Maps (ayuda para encontrar las coordenadas). */
export const buscarEnGoogleMaps = (texto) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto || '')}`;
export const fmtCoord = (c) => (c ? `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}` : '');

// ---------- Vista MAPA (todos los equipos) ----------
export const vistaMapa = ref(false);
/** Locaciones a mostrar en el mapa (las de la carpeta abierta o todas) con sus equipos y coordenadas. */
export const puntosMapa = computed(() => {
  const raiz = nodoAbierto.value === 'SIN' ? null : nodoActual.value;
  const locs = raiz ? locacionesBajo(raiz.id) : dbLocaciones.value.filter(n => n.tipo === TIPOS.LOCACION);
  const con = [], sin = [];
  locs.forEach(l => {
    const c = coordsDe(l.id);
    const r = rutaDe(l.id);
    const item = { loc: l, ruta: r, equipos: equiposDeLocacion(l.id), coords: c };
    (c ? con : sin).push(item);
  });
  return { con, sin, nEquipos: con.reduce((s, p) => s + p.equipos.length, 0), nSin: sin.reduce((s, p) => s + p.equipos.length, 0) };
});
/** Color fijo por empresa (para los pines y la leyenda). */
const PALETA = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#be123c'];
export const colorEmpresa = (empresaId) => {
  const i = empresas.value.findIndex(e => String(e.id) === String(empresaId));
  return i < 0 ? '#475569' : PALETA[i % PALETA.length];
};

/** Carga Leaflet (mapa libre, sin API key) solo cuando se abre el mapa. */
let _leaflet = null;
export const URL_LEAFLET = { css: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css', js: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js' };
export const cargarLeaflet = () => {
  if (window.L && window.L.map) return Promise.resolve(window.L);
  if (_leaflet) return _leaflet;
  _leaflet = new Promise((res, rej) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = URL_LEAFLET.css; document.head.appendChild(css);
    const js = document.createElement('script'); js.src = URL_LEAFLET.js;
    js.onload = () => res(window.L);
    js.onerror = () => { _leaflet = null; rej(new Error('No se pudo cargar el mapa (revisa la conexión a internet).')); };
    document.head.appendChild(js);
  });
  return _leaflet;
};

/** Reescribe ubicacion / empresa_arriendo de equipos según su locación (después de renombrar). */
const actualizarTextosEquipos = async (equipos) => {
  for (const e of equipos) {
    const p = payloadLocacionEquipo(e, e.locacionId);
    await sb(supabaseClient.from(TABLA_INVENTARIO).update({ ubicacion: p.ubicacion, empresa_arriendo: p.empresa_arriendo }).eq('id', e.id));
  }
};

export const eliminarNodo = async (n) => {
  if (!soloAdmin()) return;
  const sub = hijos(n.id).length, eqs = conteoEquipos(n.id);
  if (sub) return alert(`No se puede eliminar: ${ETIQUETA[n.tipo].toLowerCase()} "${n.nombre}" tiene ${sub} carpeta(s) dentro. Elimínalas o muévelas primero.`);
  if (eqs && !confirm(`"${n.nombre}" tiene ${eqs} equipo(s). Si la eliminas, esos equipos quedarán "Sin locación" (su ubicación en texto se mantiene). ¿Continuar?`)) return;
  if (!eqs && !confirm(`¿Eliminar ${ETIQUETA[n.tipo].toLowerCase()} "${n.nombre}"?`)) return;
  try {
    if (eqs) await sb(supabaseClient.from(TABLA_INVENTARIO).update({ locacion_id: null }).eq('locacion_id', n.id));
    await sb(supabaseClient.from(TABLA_LOCACIONES).delete().eq('id', n.id));
    if (String(nodoAbierto.value) === String(n.id)) nodoAbierto.value = n.padreId ?? null;
    await cargarDatosDesdeSupabase();
  } catch (err) { alert('Error al eliminar: ' + errMsg(err)); }
};

/** Mover un área a otra empresa, o una locación a otra área. */
export const formMover = ref(null);   // { nodo, destinoId }
export const abrirMoverNodo = (n) => {
  if (!soloEditor()) return;
  formMover.value = { nodo: n, destinoId: n.padreId };
};
export const destinosMover = computed(() => {
  const f = formMover.value; if (!f) return [];
  const tipoPadre = f.nodo.tipo === TIPOS.AREA ? TIPOS.EMPRESA : TIPOS.AREA;
  return dbLocaciones.value.filter(n => n.tipo === tipoPadre)
    .map(n => ({ id: n.id, texto: tipoPadre === TIPOS.AREA ? `${nodo(n.padreId)?.nombre || '?'} › ${n.nombre}` : n.nombre }))
    .sort((a, b) => a.texto.localeCompare(b.texto, 'es'));
});
export const guardarMover = async () => {
  const f = formMover.value; if (!f || !f.destinoId) return;
  if (String(f.destinoId) === String(f.nodo.padreId)) { formMover.value = null; return; }
  const dup = dbLocaciones.value.find(n => n.tipo === f.nodo.tipo && String(n.padreId) === String(f.destinoId) && n.nombre === f.nodo.nombre);
  if (dup) return alert(`En el destino ya existe "${f.nodo.nombre}".`);
  try {
    await sb(supabaseClient.from(TABLA_LOCACIONES).update({ padre_id: f.destinoId }).eq('id', f.nodo.id));
    const n = dbLocaciones.value.find(x => String(x.id) === String(f.nodo.id));
    if (n) n.padreId = f.destinoId;
    await actualizarTextosEquipos(equiposBajo(f.nodo.id));
    formMover.value = null;
    await cargarDatosDesdeSupabase();
    abrirNodo(f.nodo.id);
  } catch (err) { alert('Error al mover: ' + errMsg(err)); }
};

// ---------- Asignar equipos (AFI) a una locación ----------
export const formAsignar = ref(null);   // { locacionId, buscar, ids: {}, soloSin, registrarMov, fecha, tipo }

export const abrirAsignar = (locId) => {
  if (!soloEditor()) return;
  formAsignar.value = { locacionId: locId, buscar: '', ids: {}, soloSin: false, registrarMov: false, fecha: hoyISO(), tipo: 'Cambio de locación' };
};
export const candidatosAsignar = computed(() => {
  const f = formAsignar.value; if (!f) return [];
  const q = f.buscar.trim().toUpperCase();
  return dbEquipos.value.filter(e => {
    if (String(e.locacionId) === String(f.locacionId)) return false;
    if (f.soloSin && e.locacionId != null && nodo(e.locacionId)) return false;
    return !q || [e.afi, e.tipo, e.marca, e.modelo, e.ubicacion, rutaTexto(e.locacionId)].join(' ').toUpperCase().includes(q);
  });
});
export const nSeleccionados = computed(() => Object.values(formAsignar.value?.ids || {}).filter(Boolean).length);
export const marcarTodosAsignar = (v) => { candidatosAsignar.value.forEach(e => { formAsignar.value.ids[e.id] = v; }); };

export const asignando = ref(false);
/** Deja uno o varios equipos en una locación (actualización manual). Opcional: registra el movimiento. */
export const asignarEquipos = async (equipos, locId, { registrarMov = false, fecha = hoyISO(), tipo = 'Cambio de locación' } = {}) => {
  let errores = [], avisoMov = '';
  for (const e of equipos) {
    const antes = e.ubicacion || rutaTexto(e.locacionId);
    const empresaAntes = e.empresaArriendo;
    const p = payloadLocacionEquipo(e, locId);
    try {
      await sb(supabaseClient.from(TABLA_INVENTARIO).update(p).eq('id', e.id));
    } catch (err) {
      if (faltaSQL(err)) throw new Error(AVISO_SQL);
      errores.push(`AFI ${e.afi}: ${errMsg(err)}`); continue;
    }
    if (registrarMov) {
      const mov = {
        afi: e.afi, fecha: formatIsoDateForSupabase(fecha), tipo,
        ubicacion_anterior: antes || null, ubicacion_actual: p.ubicacion,
        empresa_arriendo: p.empresa_arriendo || empresaAntes || null, estado: e.disponibilidad, locacion_id: p.locacion_id
      };
      try { await sb(supabaseClient.from(TABLA_MOVIMIENTOS).insert([mov])); }
      catch (err) {
        try { delete mov.locacion_id; await sb(supabaseClient.from(TABLA_MOVIMIENTOS).insert([mov])); }
        catch (err2) { avisoMov = '\n(No se pudo registrar el movimiento: ' + errMsg(err2) + ')'; }
      }
    }
  }
  return { errores, avisoMov };
};

export const confirmarAsignar = async () => {
  const f = formAsignar.value; if (!f) return;
  const lista = dbEquipos.value.filter(e => f.ids[e.id]);
  if (!lista.length) return alert('Selecciona al menos un equipo.');
  const yaEnOtra = lista.filter(e => e.locacionId != null && nodo(e.locacionId));
  if (yaEnOtra.length && !confirm(`${yaEnOtra.length} equipo(s) ya están en otra locación y se cambiarán a "${rutaTexto(f.locacionId)}":\n\n` +
    yaEnOtra.slice(0, 15).map(e => `AFI ${e.afi} (hoy en ${rutaTexto(e.locacionId)})`).join('\n') + (yaEnOtra.length > 15 ? '\n…' : '') + '\n\n¿Continuar?')) return;
  asignando.value = true;
  try {
    const { errores, avisoMov } = await asignarEquipos(lista, f.locacionId, { registrarMov: f.registrarMov && isAdmin.value, fecha: f.fecha, tipo: f.tipo });
    formAsignar.value = null;
    await cargarDatosDesdeSupabase();
    alert(errores.length ? `Asignados con errores:\n${errores.join('\n')}` : `¡${lista.length} equipo(s) asignados a ${rutaTexto(f.locacionId)}!` + avisoMov);
  } catch (err) {
    alert('Error al asignar: ' + errMsg(err));
  } finally { asignando.value = false; }
};

/** Sacar un equipo de su locación (queda "Sin locación"). */
export const quitarDeLocacion = async (e) => {
  if (!soloEditor()) return;
  if (!confirm(`¿Quitar el AFI ${e.afi} de "${rutaTexto(e.locacionId)}"? Quedará "Sin locación".`)) return;
  try {
    await sb(supabaseClient.from(TABLA_INVENTARIO).update({ locacion_id: null }).eq('id', e.id));
    await cargarDatosDesdeSupabase();
  } catch (err) { alert('Error: ' + errMsg(err)); }
};

/** Asignación rápida de un equipo "Sin locación" con el selector en cascada. */
export const formRapido = ref(null);   // { equipo, sel }
export const abrirAsignacionRapida = (e) => {
  if (!soloEditor()) return;
  formRapido.value = { equipo: e, sel: selDesdeLocacion(e.locacionId) };
};
export const guardarAsignacionRapida = async () => {
  const f = formRapido.value; if (!f) return;
  if (!selCompleta(f.sel)) return alert('Completa Empresa, Área y Locación (o crea una nueva).');
  asignando.value = true;
  try {
    const locId = await resolverSeleccion(f.sel);
    const { errores } = await asignarEquipos([f.equipo], locId);
    if (errores.length) throw new Error(errores.join('\n'));
    formRapido.value = null;
    await cargarDatosDesdeSupabase();
  } catch (err) { alert('Error: ' + errMsg(err)); }
  finally { asignando.value = false; }
};

// ---------- Exportar ----------
export const exportandoAreas = ref(false);
export const exportarAreasExcel = async () => {
  exportandoAreas.value = true;
  try {
    const raiz = nodoAbierto.value === 'SIN' ? null : nodoActual.value;
    const locs = raiz ? locacionesBajo(raiz.id) : dbLocaciones.value.filter(n => n.tipo === TIPOS.LOCACION);
    const filas = [];
    locs.map(l => ({ l, r: rutaDe(l.id) }))
      .sort((a, b) => rutaTexto(a.l.id).localeCompare(rutaTexto(b.l.id), 'es', { numeric: true }))
      .forEach(({ l, r }) => {
        const eqs = equiposDeLocacion(l.id);
        const c = coordsDe(l.id);
        const gm = c ? { text: fmtCoord(c) + (c.heredado ? ' (aprox.)' : ''), hyperlink: googleMapsUrl(l.id) } : '';
        if (!eqs.length) filas.push([r.empresa?.nombre || '', r.area?.nombre || '', l.nombre, gm, '—', 'Sin equipos', '', '', '']);
        eqs.forEach(e => filas.push([r.empresa?.nombre || '', r.area?.nombre || '', l.nombre, gm, e.afi, e.tipo, `${e.marca} ${e.modelo}`.trim(), e.disponibilidad, Math.round(e.horometroActual || 0)]));
      });
    if (!raiz) equiposSinLocacion.value.forEach(e => filas.push(['SIN LOCACIÓN', '', e.ubicacion || '', '', e.afi, e.tipo, `${e.marca} ${e.modelo}`.trim(), e.disponibilidad, Math.round(e.horometroActual || 0)]));
    if (!filas.length) return alert('No hay datos para exportar.');
    const { wb, logo } = await nuevoLibro();
    hojaTabla(wb, logo, {
      nombre: 'Áreas', titulo: 'EQUIPOS POR EMPRESA, ÁREA Y LOCACIÓN',
      subtitulo: (raiz ? migas.value.map(n => n.nombre).join(' › ') : 'Todas las empresas') + ` · ${formatDateForDisplay(hoyISO())}`,
      columnas: [{ t: 'EMPRESA', w: 22, bold: true }, { t: 'ÁREA', w: 22 }, { t: 'LOCACIÓN', w: 26, bold: true }, { t: 'GOOGLE MAPS', w: 24 }, { t: 'AFI', w: 9, bold: true },
        { t: 'TIPO EQUIPO', w: 24 }, { t: 'MARCA / MODELO', w: 26 }, { t: 'ESTADO', w: 16 }, { t: 'HORÓMETRO', w: 12, fmt: '#,##0' }],
      filas
    });
    await descargarLibro(wb, `Areas_Locaciones_${hoyISO()}.xlsx`);
  } catch (err) {
    alert('Error al exportar: ' + errMsg(err));
  } finally { exportandoAreas.value = false; }
};

export { dbLocaciones, AVISO_SQL, AVISO_GEO_SQL };
