// =====================================================================
// CORE · Sesión (Supabase Auth) + cierre por inactividad + pantalla actual en la URL
// ---------------------------------------------------------------------
// - El login lo valida Supabase Auth en el servidor; la sesión es un token firmado
//   (no se puede inventar escribiendo en el navegador). Nunca se guarda la contraseña.
// - Al actualizar la página (F5) la sesión se mantiene y se vuelve a la misma pestaña.
// - Si pasan INACTIVIDAD_MS sin mover el mouse / teclear / tocar / hacer scroll, se cierra la sesión.
// - Si se cierra sesión en una pestaña del navegador, se cierra en todas.
// - El perfil (rol y permisos) se lee siempre desde la tabla `usuarios`.
// =====================================================================
import { usuarioActivo, currentTab } from './store.js';
import { TABS_VALIDAS, TAB_INICIO } from './menu.js';
import { supabaseClient } from './supabase.js';
import { TABLAS } from './tablas.js';

const { ref, watch } = Vue;

export const INACTIVIDAD_MS = 10 * 60 * 1000;         // 10 minutos
const AVISO_INACTIVIDAD = `Tu sesión se cerró por ${INACTIVIDAD_MS / 60000} minutos de inactividad.`;
const ACTIVIDAD_KEY = 'afi_actividad';                 // última actividad (ms) — compartida entre pestañas
const AVISO_KEY = 'afi_aviso';                         // mensaje para el login después de recargar
const GUARDAR_ACTIVIDAD_CADA_MS = 10 * 1000;
const REVISAR_CADA_MS = 15 * 1000;
const EVENTOS_ACTIVIDAD = ['mousemove', 'mousedown', 'keydown', 'wheel', 'scroll', 'touchstart'];

/** Columnas del perfil que se leen (la contraseña NO está en la tabla). */
export const COLUMNAS_USUARIO = 'usuario, nombre, rol, permisos, debe_cambiar_clave';

/** true mientras se intenta recuperar la sesión al abrir/actualizar (evita que "parpadee" el login). */
export const restaurandoSesion = ref(true);
/** Mensaje que se muestra en el login cuando la sesión se cerró sola. */
export const avisoSesion = ref('');
/** true → se muestra (obligatorio) el cuadro para cambiar la contraseña. */
export const debeCambiarClave = ref(false);

export const APP_VERSION = '2026-11-13 carpetas';   // se ve en el login: sirve para confirmar que el navegador cargó la versión nueva

// ---------- Pequeño almacenamiento tolerante a fallos ----------
const get = (st, k) => { try { return st.getItem(k); } catch (e) { return null; } };
const set = (st, k, v) => { try { st.setItem(k, v); } catch (e) { /* bloqueado */ } };
const del = (st, k) => { try { st.removeItem(k); } catch (e) { /* bloqueado */ } };

let actividadMem = 0;
const leerActividad = () => Math.max(Number(get(localStorage, ACTIVIDAD_KEY)) || 0, actividadMem);
const escribirActividad = (t) => { actividadMem = t; set(localStorage, ACTIVIDAD_KEY, String(t)); };

// Aviso que quedó guardado antes de recargar la página
avisoSesion.value = get(sessionStorage, AVISO_KEY) || '';
del(sessionStorage, AVISO_KEY);

// ---------- Pestaña actual en la URL (#inventario, #programas...) ----------
const tabDesdeUrl = () => {
  let t = decodeURIComponent((location.hash || '').replace(/^#\/?/, ''));
  if (t === 'programas') t = 'progMantencion';   // enlace antiguo (antes Programas era un solo módulo)
  return TABS_VALIDAS.includes(t) ? t : null;
};

watch(currentTab, (t) => {
  if (!usuarioActivo.value) return;
  if (tabDesdeUrl() !== t) history.replaceState(null, '', '#' + t);
});

window.addEventListener('hashchange', () => {
  const t = tabDesdeUrl();
  if (t && usuarioActivo.value && t !== currentTab.value) currentTab.value = t;
});

// ---------- Perfil ----------
/** Lee el perfil (tabla usuarios) del usuario conectado en Supabase Auth. */
export const cargarPerfil = async (authId) => {
  const { data, error } = await supabaseClient.from(TABLAS.USUARIOS).select(COLUMNAS_USUARIO).eq('auth_id', authId).maybeSingle();
  if (error) throw error;
  return data;
};

// ---------- Actividad ----------
let ultimaGuardada = 0;
const registrarActividad = () => {
  if (!usuarioActivo.value) return;
  const ahora = Date.now();
  if (ahora - ultimaGuardada < GUARDAR_ACTIVIDAD_CADA_MS) return;
  ultimaGuardada = ahora;
  escribirActividad(ahora);
};

const revisarInactividad = () => {
  if (!usuarioActivo.value) return;
  if (Date.now() - leerActividad() >= INACTIVIDAD_MS) {
    cerrarSesion(AVISO_INACTIVIDAD);
  }
};

EVENTOS_ACTIVIDAD.forEach(ev => window.addEventListener(ev, registrarActividad, { passive: true, capture: true }));
setInterval(revisarInactividad, REVISAR_CADA_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden) revisarInactividad(); });

// Sesión cerrada en otra pestaña, o token vencido / revocado (ej. el Admin restableció la clave)
let cerrando = false;
supabaseClient.auth.onAuthStateChange((evento) => {
  if (evento === 'SIGNED_OUT' && usuarioActivo.value && !cerrando) {
    cerrarSesion('Tu sesión terminó. Vuelve a iniciar sesión.');
  }
});

// ---------- API ----------
/** Llamar al iniciar sesión correctamente (con el perfil ya leído). */
export const iniciarSesion = (perfil) => {
  usuarioActivo.value = perfil;
  debeCambiarClave.value = Boolean(perfil.debe_cambiar_clave);
  avisoSesion.value = '';
  ultimaGuardada = Date.now();
  escribirActividad(ultimaGuardada);
  try { sessionStorage.removeItem('frc_rec_resumen_visto'); } catch (e) { /* */ }   // Mis Tareas: mostrar el resumen al entrar
  currentTab.value = TAB_INICIO;   // al iniciar sesión siempre se parte en la Bienvenida
  history.replaceState(null, '', '#' + currentTab.value);
};

/**
 * Cierra la sesión (botón Salir, inactividad o sesión revocada).
 * Recarga la página para borrar de la memoria todos los datos cargados.
 */
export const cerrarSesion = async (mensaje = '') => {
  if (cerrando) return;
  cerrando = true;
  del(localStorage, ACTIVIDAD_KEY);
  if (mensaje) set(sessionStorage, AVISO_KEY, mensaje);
  try { await supabaseClient.auth.signOut(); } catch (e) { /* sin conexión: igual se borra la sesión local */ }
  usuarioActivo.value = null;
  history.replaceState(null, '', location.pathname + location.search);
  location.reload();
};

/** Al abrir/actualizar la página: recupera la sesión de Supabase si sigue vigente. */
export const restaurarSesion = async () => {
  try {
    const { data } = await supabaseClient.auth.getSession();
    const session = data && data.session;
    if (!session) return;
    if (Date.now() - leerActividad() >= INACTIVIDAD_MS) {
      await supabaseClient.auth.signOut().catch(() => {});
      del(localStorage, ACTIVIDAD_KEY);
      avisoSesion.value = AVISO_INACTIVIDAD;
      return;
    }
    const perfil = await cargarPerfil(session.user.id);
    if (!perfil) { await supabaseClient.auth.signOut().catch(() => {}); return; }   // usuario eliminado
    usuarioActivo.value = perfil;
    debeCambiarClave.value = Boolean(perfil.debe_cambiar_clave);
    ultimaGuardada = Date.now();
    escribirActividad(ultimaGuardada);
    currentTab.value = tabDesdeUrl() || TAB_INICIO;   // F5: se queda en la pantalla donde estaba
  } catch (e) {
    console.warn('No se pudo restaurar la sesión:', e);
  } finally {
    restaurandoSesion.value = false;
  }
};
