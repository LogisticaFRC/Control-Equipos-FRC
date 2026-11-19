// =====================================================================
// CORE · MODO SIN INTERNET de la app de técnicos (celular / tablet) · 2026-11-19
// ---------------------------------------------------------------------
// Solo se activa en los equipos donde entró un TÉCNICO (taller, terreno, chofer, CRTG, tótem).
//   1) LECTURAS: cada consulta a Supabase se guarda en el teléfono (IndexedDB). Sin señal se muestra
//      lo último que se vio (equipos, OT, programa…).
//   2) ENVÍOS: si no hay señal, lo que se guarda (fotos, hallazgos, actividades, horómetro, pedidos,
//      programa CRTG…) queda en una COLA en el teléfono y se sube SOLO, en orden, al volver internet.
//      Los reports grandes (intervención / OT Terreno / reparación y check list del chofer) se guardan
//      como "trabajo" completo y se envían enteros al volver la señal (con su PDF y su N° real).
//   3) Ids provisorios: un registro creado sin señal recibe un id negativo; al subirlo se cambia por el
//      id real en todo lo que quedó en la cola después de él.
// La sesión debe haberse iniciado antes con internet (el login siempre necesita señal).
// =====================================================================
const { ref, computed } = Vue;

const DB_NOMBRE = 'frc_offline';
const FLAG = 'frc_offline_dispositivo';      // '1' = este equipo es de un técnico
const PERFIL_KEY = 'frc_offline_perfil';     // { uid, perfil } para abrir sin señal
const UID_KEY = 'frc_offline_uid';
const AUTH_KEY = 'frc_auth';                 // storageKey de supabase.js

// ---------- Estado visible ----------
export const pendientes = ref(0);
export const listaPendientes = ref([]);      // [{ id, etiqueta, creado, error }]
export const sincronizando = ref(false);
export const enLinea = ref(navigator.onLine !== false);
export const conError = computed(() => listaPendientes.value.filter(i => i.error).length);

let sinRedHasta = 0;
export const sinSenal = () => navigator.onLine === false || Date.now() < sinRedHasta;
const marcarRed = (ok) => {
  if (ok) { sinRedHasta = 0; enLinea.value = navigator.onLine !== false; }
  else { sinRedHasta = Date.now() + 30000; enLinea.value = false; }
};
export const esErrorRed = (err) => {
  if (!err) return false;
  if (err instanceof TypeError) return true;
  const m = String(err.message || err.details || err || '');
  return /Failed to fetch|NetworkError|Load failed|network ?error|ERR_INTERNET|ERR_NETWORK|conexi[oó]n/i.test(m);
};
const errTxt = (err) => (err && (err.message || err.details)) || String(err || 'error');

const leerLS = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const escribirLS = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) { /* lleno o bloqueado */ } };
export const dispositivoOffline = () => leerLS(FLAG) === '1';

/** Sesión de Supabase guardada en el teléfono (aunque el token esté vencido). */
export const sesionGuardada = () => {
  try { const s = JSON.parse(leerLS(AUTH_KEY) || 'null'); return (s && (s.currentSession || s)) || null; } catch (_) { return null; }
};
/** Perfil guardado (para abrir la app sin señal). */
export const perfilGuardado = (uid) => {
  try { const p = JSON.parse(leerLS(PERFIL_KEY) || 'null'); return p && p.uid === uid ? p.perfil : null; } catch (_) { return null; }
};

// ---------- IndexedDB ----------
let dbP = null;
const abrirDB = () => dbP || (dbP = new Promise((ok, mal) => {
  const r = indexedDB.open(DB_NOMBRE, 1);
  r.onupgradeneeded = () => {
    const d = r.result;
    if (!d.objectStoreNames.contains('cola')) d.createObjectStore('cola', { keyPath: 'id', autoIncrement: true });
    if (!d.objectStoreNames.contains('lecturas')) d.createObjectStore('lecturas');
    if (!d.objectStoreNames.contains('ids')) d.createObjectStore('ids');
  };
  r.onsuccess = () => ok(r.result);
  r.onerror = () => { dbP = null; mal(r.error); };
}));
const tx = async (store, modo, fn) => {
  const d = await abrirDB();
  return new Promise((ok, mal) => {
    const t = d.transaction(store, modo); let res;
    const r = fn(t.objectStore(store));
    if (r) r.onsuccess = () => { res = r.result; };
    t.oncomplete = () => ok(res); t.onerror = () => mal(t.error); t.onabort = () => mal(t.error);
  });
};
const idbGet = (st, k) => tx(st, 'readonly', s => s.get(k));
const idbPut = (st, v, k) => tx(st, 'readwrite', s => (k === undefined ? s.put(v) : s.put(v, k)));
const idbDel = (st, k) => tx(st, 'readwrite', s => s.delete(k));
const idbAll = (st) => tx(st, 'readonly', s => s.getAll());
const idbClear = (st) => tx(st, 'readwrite', s => s.clear());
const idbEntradas = async (st) => {
  const d = await abrirDB();
  return new Promise((ok, mal) => {
    const out = []; const t = d.transaction(st, 'readonly');
    const c = t.objectStore(st).openCursor();
    c.onsuccess = () => { const cur = c.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } };
    t.oncomplete = () => ok(out); t.onerror = () => mal(t.error);
  });
};

// ---------- Activación por usuario ----------
/** Llamar al cargar el perfil: activa el modo sin internet solo para técnicos. */
export const activarDispositivo = async (perfil, esTecnico) => {
  const uid = sesionGuardada()?.user?.id || '';
  if (esTecnico) { escribirLS(FLAG, '1'); escribirLS(PERFIL_KEY, JSON.stringify({ uid, perfil })); }
  else { escribirLS(FLAG, null); escribirLS(PERFIL_KEY, null); }
  const antes = leerLS(UID_KEY);
  if (antes && antes !== uid) { try { await idbClear('lecturas'); } catch (_) { /* */ } }   // otro usuario: no ver datos ajenos
  escribirLS(UID_KEY, uid);
  if (esTecnico) {
    iniciarOffline();
    // deja en caché lo que se usa sin señal (comprimir fotos)
    if (!sinSenal()) import('../modules/inventario/fotos-equipo.js').catch(() => {});
  }
};

// ---------- Nombres para la lista de pendientes ----------
const NOMBRES = {
  bd_mec_intervenciones: 'Report de intervención', bd_pedidos_repuestos: 'Pedido de repuestos', bd_estandarizaciones: 'Inspección de estandarización',
  bd_taller_problemas: 'Hallazgo / falla', bd_taller_reparaciones: 'Equipo en taller', bd_ot: 'OT', bd_checklist_chofer: 'Check list chofer',
  frc_mec_horometro: 'Horómetro', frc_crtg_programa: 'Programa CRTG', frc_crtg_ubicacion: 'Ubicación del equipo', frc_mec_actividad: 'Actividad de la OT',
  frc_mec_actividad_detalle: 'Detalle de actividad', frc_falla_reparada: 'Falla reparada', frc_levantamiento_fs: 'Equipo fuera de servicio',
  frc_hallazgo_editar: 'Hallazgo editado', frc_chofer_guardar: 'Check list chofer'
};
const etiquetaDe = (url, method) => {
  try {
    const p = new URL(url).pathname;
    if (p.includes('/storage/v1/object')) return 'Foto / archivo';
    const m = p.match(/\/rest\/v1\/(?:rpc\/)?([^/?]+)/); const k = m ? m[1] : '';
    const base = NOMBRES[k] || k.replace(/^(bd_|frc_)/, '').replace(/_/g, ' ');
    return base + (p.includes('/rpc/') ? '' : method === 'POST' ? ' (nuevo)' : method === 'DELETE' ? ' (borrar)' : ' (cambio)');
  } catch (_) { return 'Envío'; }
};

// ---------- Ids provisorios ----------
let cont = 0;
export const nuevoTempId = () => String(-(Date.now() * 100 + (cont++ % 100)));
/** Id provisorio → id real (lo registra quien crea el registro al subirlo; lo usan los envíos siguientes). */
let mapaActual = null;
export const registrarId = async (tmp, real) => {
  if (tmp == null || real == null) return;
  await idbPut('ids', real, String(tmp));
  if (mapaActual) mapaActual.set(String(tmp), real);
};
/** Cambia en un objeto los ids provisorios que ya tienen id real. */
export const resolverIds = async (obj) => {
  const mapa = new Map(await idbEntradas('ids'));
  if (mapaActual) for (const [k, v] of mapaActual) mapa.set(k, v);
  if (!mapa.size) return obj;
  return JSON.parse(aplicarMapa(JSON.stringify(obj), mapa));
};
/** Datos de los trabajos guardados (aún no subidos) de un tipo. */
export const trabajosPendientes = async (nombre) => {
  try { return (await idbAll('cola')).filter(i => i.tipo === 'trabajo' && i.nombre === nombre).sort((a, b) => a.id - b.id).map(i => i.datos); }
  catch (_) { return []; }
};
/** ¿Es un id creado sin señal (aún no subido)? */
export const esIdProvisorio = (id) => /^-\d{14,}$/.test(String(id ?? ''));

// ---------- Cola ----------
export const refrescarConteo = async () => {
  try {
    const l = await idbAll('cola');
    pendientes.value = l.length;
    listaPendientes.value = l.sort((a, b) => a.id - b.id).map(i => ({ id: i.id, etiqueta: i.etiqueta, creado: i.creado, error: i.error || '' }));
  } catch (_) { /* sin IndexedDB */ }
};
let timerSync = null;
const programarSync = (ms = 2000) => { clearTimeout(timerSync); timerSync = setTimeout(() => { if (!sinSenal()) sincronizar(); }, ms); };

const sintetica = (it) => {
  const u = new URL(it.url);
  const single = /vnd\.pgrst\.object/.test(it.headers.accept || '');
  const json = (body, status) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'x-frc-offline': '1' } });
  if (u.pathname.includes('/storage/v1/object/')) {
    const key = decodeURIComponent(u.pathname.split('/storage/v1/object/')[1] || '');
    return json({ Key: key, Id: 'offline', path: key.split('/').slice(1).join('/') }, 200);
  }
  if (u.pathname.includes('/rest/v1/rpc/')) return json(null, 200);
  if (/return=representation/.test(it.headers.prefer || '')) {
    let filas = [];
    try { const j = JSON.parse(it.body?.v || 'null'); filas = Array.isArray(j) ? j : j ? [j] : []; } catch (_) { filas = []; }
    const idF = (u.searchParams.get('id') || '').replace(/^eq\./, '');
    const ahora = new Date().toISOString();
    filas = filas.map((f, i) => (it.method === 'POST'
      ? { created_at: ahora, ...f, id: f.id ?? Number(it.tempIds[i]) }
      : { ...f, ...(idF ? { id: isNaN(Number(idF)) ? idF : Number(idF) } : {}) }));
    return json(single ? (filas[0] || null) : filas, it.method === 'POST' ? 201 : 200);
  }
  return new Response(null, { status: 204, headers: { 'x-frc-offline': '1' } });
};

const encolar = async (url, method, init) => {
  const headers = {};
  new Headers(init.headers || {}).forEach((v, k) => { if (!['authorization', 'content-length'].includes(k)) headers[k] = v; });
  const b = init.body; let body = null;
  if (b == null) body = null;
  else if (typeof b === 'string') body = { k: 'texto', v: b };
  else if (typeof FormData !== 'undefined' && b instanceof FormData) {
    const l = []; for (const [n, v] of b.entries()) l.push(typeof v === 'string' ? [n, v] : [n, v, v.name || 'archivo']);
    body = { k: 'form', v: l };
  } else if (b instanceof Blob) body = { k: 'blob', v: b };
  else if (b instanceof ArrayBuffer || ArrayBuffer.isView(b)) body = { k: 'blob', v: new Blob([b]) };
  else body = { k: 'texto', v: String(b) };
  let tempIds = [];
  if (method === 'POST' && url.includes('/rest/v1/') && !url.includes('/rpc/') && /return=representation/.test(headers.prefer || '') && body?.k === 'texto') {
    let n = 1; try { const j = JSON.parse(body.v); n = Array.isArray(j) ? j.length : 1; } catch (_) { n = 1; }
    tempIds = Array.from({ length: n }, nuevoTempId);
  }
  const it = { tipo: 'http', url, method, headers, body, tempIds, etiqueta: etiquetaDe(url, method), creado: Date.now() };
  await idbPut('cola', it);
  await refrescarConteo();
  programarSync();
  return sintetica(it);
};

/** Trabajos completos (reports grandes): nombre → async (datos, progreso) */
const trabajos = {};
export const registrarTrabajo = (nombre, fn) => { trabajos[nombre] = fn; };
/** Guarda un trabajo para enviarlo al volver la señal. */
export const guardarTrabajo = async (nombre, datos, etiqueta) => {
  await idbPut('cola', { tipo: 'trabajo', nombre, datos, etiqueta: etiqueta || nombre, creado: Date.now() });
  await refrescarConteo();
  programarSync();
};
/** Mientras corre fn, los envíos NO se encolan (si se corta la señal, falla con error). */
let directo = 0;
export const enDirecto = async (fn) => { directo++; try { return await fn(); } finally { directo--; } };

// ---------- fetch de Supabase ----------
let fetchBase = (...a) => fetch(...a);
const desdeCache = async (url) => {
  try {
    const c = await idbGet('lecturas', url); if (!c) return null;
    const h = { 'content-type': c.h?.['content-type'] || 'application/json', 'x-frc-cache': '1' };
    if (c.h?.['content-range']) h['content-range'] = c.h['content-range'];
    return new Response(c.t, { status: 200, headers: h });
  } catch (_) { return null; }
};
const leer = async (input, init, url, method) => {
  const cachear = method === 'GET' && url.includes('/rest/v1/') && (dispositivoOffline() || /\/rest\/v1\/usuarios\?/.test(url));
  if (cachear && sinSenal()) { const c = await desdeCache(url); if (c) return c; }
  try {
    const r = await fetchBase(input, init);
    marcarRed(true);
    if (cachear && r.ok) {
      const ct = r.headers.get('content-type') || 'application/json', cr = r.headers.get('content-range') || '';
      r.clone().text().then(t => idbPut('lecturas', { t, h: { 'content-type': ct, 'content-range': cr }, f: Date.now() }, url)).catch(() => {});
    }
    return r;
  } catch (err) {
    if (esErrorRed(err)) { marcarRed(false); if (cachear) { const c = await desdeCache(url); if (c) return c; } }
    throw err;
  }
};
/** fetch para createClient({ global: { fetch } }). */
export const crearFetch = (base) => {
  if (base) fetchBase = base;
  return async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.includes('/rest/v1/') && !url.includes('/storage/v1/object')) return fetchBase(input, init);
    const method = String(init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD') return leer(input, init, url, method);
    if (!dispositivoOffline() || directo > 0) {
      try { const r = await fetchBase(input, init); marcarRed(true); return r; }
      catch (err) { if (esErrorRed(err)) marcarRed(false); throw err; }
    }
    // técnico: sin señal (o con envíos pendientes antes, para respetar el orden) → a la cola
    if (sinSenal() || pendientes.value - conError.value > 0) return encolar(url, method, init);
    try { const r = await fetchBase(input, init); marcarRed(true); return r; }
    catch (err) { if (esErrorRed(err)) { marcarRed(false); return encolar(url, method, init); } throw err; }
  };
};

// ---------- Sincronización ----------
let getSessionReal = null;
/** supabase.js entrega el getSession real (el que renueva el token). */
export const configurarSesion = (fn) => { getSessionReal = fn; };

const aplicarMapa = (s, mapa) => { let x = String(s); for (const [t, r] of mapa) if (x.includes(t)) x = x.split(t).join(String(r)); return x; };
const enviarHttp = async (it, token, mapa) => {
  const url = aplicarMapa(it.url, mapa);
  const headers = { ...it.headers, authorization: 'Bearer ' + token };
  let body = null;
  if (it.body?.k === 'texto') body = aplicarMapa(it.body.v, mapa);
  else if (it.body?.k === 'blob') body = it.body.v;
  else if (it.body?.k === 'form') { body = new FormData(); it.body.v.forEach(([n, v, fn]) => (fn ? body.append(n, v, fn) : body.append(n, aplicarMapa(v, mapa)))); delete headers['content-type']; }
  const r = await fetchBase(url, { method: it.method, headers, body });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    if (url.includes('/storage/v1/object') && (r.status === 409 || /already exists|Duplicate/i.test(t))) return;   // ya estaba subido
    throw new Error(`${r.status} ${t.slice(0, 300)}`);
  }
  if (it.tempIds?.length) {
    const j = await r.json().catch(() => null);
    const l = Array.isArray(j) ? j : j ? [j] : [];
    for (let i = 0; i < it.tempIds.length; i++) if (l[i] && l[i].id != null) { mapa.set(it.tempIds[i], l[i].id); await idbPut('ids', l[i].id, it.tempIds[i]); }
  }
};
const ejecutarTrabajo = async (it) => {
  const fn = trabajos[it.nombre];
  if (!fn) throw new Error('Abre la app de técnicos para enviarlo');
  const progreso = async (datos) => { it.datos = datos; await idbPut('cola', it); };
  await enDirecto(() => fn(it.datos, progreso));
};

let corriendo = null;
/** Sube todo lo pendiente, en orden. Se llama sola (al volver la señal, cada 30 s y al abrir la app). */
export const sincronizar = () => corriendo || (corriendo = (async () => {
  let ok = 0;
  try {
    const items = (await idbAll('cola')).filter(i => !i.error).sort((a, b) => a.id - b.id);
    if (!items.length) return;
    if (navigator.onLine === false) return;
    let token = null;
    try { const { data } = await (getSessionReal ? getSessionReal() : Promise.resolve({ data: null })); token = data?.session?.access_token || null; } catch (_) { token = null; }
    if (!token) return;   // sin sesión válida aún (o sin red para renovarla): se reintenta después
    sincronizando.value = true;
    const mapa = new Map(await idbEntradas('ids'));
    mapaActual = mapa;
    for (const it of items) {
      try {
        if (it.tipo === 'http') await enviarHttp(it, token, mapa);
        else await ejecutarTrabajo(it);
        await idbDel('cola', it.id); ok++;
        marcarRed(true);
      } catch (err) {
        if (esErrorRed(err)) { marcarRed(false); break; }   // se cortó otra vez: sigue después
        it.error = errTxt(err).slice(0, 400); it.intentos = (it.intentos || 0) + 1;
        await idbPut('cola', it);
      }
      await refrescarConteo();
    }
    if (!(await idbAll('cola')).length) await idbClear('ids');
  } catch (err) {
    console.warn('[Sin internet] No se pudo sincronizar:', err);
  } finally {
    sincronizando.value = false; corriendo = null; mapaActual = null;
    await refrescarConteo();
    if (ok) window.dispatchEvent(new CustomEvent('frc-sync', { detail: { ok } }));
  }
})());

/** Vuelve a intentar los que quedaron con error. */
export const reintentarErrores = async () => {
  for (const it of await idbAll('cola')) if (it.error) { delete it.error; await idbPut('cola', it); }
  await refrescarConteo(); return sincronizar();
};
/** Descarta un envío pendiente (no se sube). */
export const descartarPendiente = async (id) => { await idbDel('cola', id); await refrescarConteo(); };

let iniciado = false;
export const iniciarOffline = () => {
  if (iniciado) return; iniciado = true;
  // pedir al navegador que NO borre los datos guardados (reportes sin enviar) aunque falte espacio
  try { navigator.storage?.persist?.().catch(() => {}); } catch (_) { /* navegador antiguo */ }
  window.addEventListener('online', () => { marcarRed(true); programarSync(1500); });
  window.addEventListener('offline', () => { enLinea.value = false; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && pendientes.value) programarSync(500); });
  setInterval(() => { enLinea.value = !sinSenal(); if (pendientes.value && !sinSenal()) sincronizar(); }, 30000);
  refrescarConteo().then(() => programarSync(3000));
};
if (dispositivoOffline()) iniciarOffline();

// ---------------------------------------------------------------------
// <estado-envios>: barra en la app de técnicos (sin señal / pendientes / errores)
// ---------------------------------------------------------------------
export const EstadoEnvios = {
  name: 'EstadoEnvios',
  template: /* html */ `
<div v-if="pendientes || !enLinea" class="px-3 pt-2" data-offline="barra">
  <div :class="['rounded-2xl px-3 py-2.5 text-sm shadow-sm border', conError ? 'bg-rose-50 border-rose-200 text-rose-900' : pendientes ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-slate-800 border-slate-800 text-white']">
    <div class="flex items-center gap-2">
      <i :class="['fa-solid text-lg', sincronizando ? 'fa-rotate fa-spin' : !enLinea ? 'fa-wifi' : 'fa-cloud-arrow-up']" :style="!enLinea && !sincronizando ? 'opacity:.55' : ''"></i>
      <div class="flex-1 min-w-0 leading-tight">
        <b v-if="!enLinea" class="block">Sin internet</b>
        <span v-if="pendientes" class="block text-xs">{{ sincronizando ? 'Enviando lo guardado…' : pendientes + ' envío' + (pendientes === 1 ? '' : 's') + ' guardado' + (pendientes === 1 ? '' : 's') + ' en el equipo' + (enLinea ? '' : ' · se enviará' + (pendientes === 1 ? '' : 'n') + ' solo' + (pendientes === 1 ? '' : 's') + ' al volver la señal') }}</span>
        <span v-else class="block text-xs" style="opacity:.85">Puedes seguir trabajando: lo que envíes queda guardado y se sube solo.</span>
      </div>
      <button v-if="pendientes" @click="abierto = !abierto" class="px-2.5 py-1.5 rounded-lg bg-white/70 border border-current/20 text-xs font-bold" data-offline="ver">{{ abierto ? 'Ocultar' : 'Ver' }}</button>
      <button v-if="pendientes && enLinea && !sincronizando" @click="enviarAhora" class="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold" data-offline="enviar">Enviar</button>
    </div>
    <div v-if="abierto && pendientes" class="mt-2 space-y-1 max-h-60 overflow-y-auto">
      <div v-for="p in lista" :key="p.id" class="bg-white rounded-xl px-2.5 py-1.5 text-xs text-slate-700 flex items-start gap-2">
        <i :class="['fa-solid mt-0.5', p.error ? 'fa-circle-exclamation text-rose-600' : 'fa-clock text-amber-500']"></i>
        <div class="flex-1 min-w-0"><b>{{ p.etiqueta }}</b> · {{ hora(p.creado) }}<p v-if="p.error" class="text-rose-700 break-words">No se pudo enviar: {{ p.error }}</p></div>
        <button v-if="p.error" @click="descartar(p)" class="text-rose-600 font-bold shrink-0">Descartar</button>
      </div>
      <button v-if="conError" @click="reintentar" class="w-full py-2 rounded-xl bg-rose-600 text-white text-xs font-bold">Reintentar los que fallaron</button>
    </div>
  </div>
</div>`,
  setup() {
    const abierto = ref(false);
    const hora = (t) => { const d = new Date(t); return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }); };
    const enviarAhora = () => { marcarRed(true); sincronizar(); };
    const descartar = (p) => { if (confirm(`¿Descartar "${p.etiqueta}"? No se enviará.`)) descartarPendiente(p.id); };
    const reintentar = () => reintentarErrores();
    return { pendientes, enLinea, sincronizando, conError, lista: listaPendientes, abierto, hora, enviarAhora, descartar, reintentar };
  }
};
