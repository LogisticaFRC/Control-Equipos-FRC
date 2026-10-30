// =====================================================================
// CORE · Sesión persistente + cierre por inactividad + pantalla actual en la URL
// ---------------------------------------------------------------------
// - Al actualizar la página (F5) la sesión se mantiene y se vuelve a la misma pestaña.
// - Si pasan INACTIVIDAD_MS sin mover el mouse / teclear / tocar / hacer scroll, se cierra la sesión.
// - Mientras haya actividad, la sesión sigue abierta.
// - Si se cierra sesión en una pestaña del navegador, se cierra en todas.
// - Solo se guarda el NOMBRE de usuario (nunca la contraseña). El rol se vuelve a leer desde Supabase.
// =====================================================================
import { usuarioActivo, currentTab, dbUsuarios } from './store.js';

const { ref, watch } = Vue;

export const INACTIVIDAD_MS = 5 * 60 * 1000;          // 5 minutos
const SESION_KEY = 'afi_sesion';                       // { usuario, ultimaActividad }
const GUARDAR_ACTIVIDAD_CADA_MS = 10 * 1000;           // no escribir en cada movimiento del mouse
const REVISAR_CADA_MS = 15 * 1000;
const EVENTOS_ACTIVIDAD = ['mousemove', 'mousedown', 'keydown', 'wheel', 'scroll', 'touchstart'];
const TABS_VALIDAS = ['dashboard', 'inventario', 'programas', 'movimientos', 'hojaVida', 'aceites', 'filtros', 'formatos', 'configuracion'];

/** true mientras se intenta recuperar la sesión al abrir/actualizar (evita que "parpadee" el login). */
export const restaurandoSesion = ref(true);
/** Mensaje que se muestra en el login cuando la sesión se cerró sola. */
export const avisoSesion = ref('');

// ---------- Almacenamiento seguro ----------
// Se guarda en localStorage y, como respaldo, en sessionStorage y en memoria.
// Así, si el navegador bloquea uno de ellos (modo privado, página incrustada, etc.),
// la sesión no se cae sola y, en lo posible, se mantiene al actualizar.
export const APP_VERSION = '2026-10-30 b';
let enMemoria = null;
const leerDe = (st) => { try { return JSON.parse(st.getItem(SESION_KEY) || 'null'); } catch (e) { return null; } };
const leer = () => {
  const candidatos = [leerDe(window.localStorage), leerDe(window.sessionStorage), enMemoria].filter(s => s && s.usuario);
  if (!candidatos.length) return null;
  return candidatos.sort((a, b) => (b.ultimaActividad || 0) - (a.ultimaActividad || 0))[0];
};
const escribir = (v) => {
  enMemoria = v;
  const txt = JSON.stringify(v);
  try { localStorage.setItem(SESION_KEY, txt); } catch (e) { /* bloqueado */ }
  try { sessionStorage.setItem(SESION_KEY, txt); } catch (e) { /* bloqueado */ }
};
const borrar = () => {
  enMemoria = null;
  try { localStorage.removeItem(SESION_KEY); } catch (e) { /* bloqueado */ }
  try { sessionStorage.removeItem(SESION_KEY); } catch (e) { /* bloqueado */ }
};

// ---------- Pestaña actual en la URL (#inventario, #programas...) ----------
const tabDesdeUrl = () => {
  const t = decodeURIComponent((location.hash || '').replace(/^#\/?/, ''));
  return TABS_VALIDAS.includes(t) ? t : null;
};

watch(currentTab, (t) => {
  if (!usuarioActivo.value) return;
  if (tabDesdeUrl() !== t) history.replaceState(null, '', '#' + t);
});

// Permite usar los botones Atrás/Adelante del navegador o pegar un enlace con #pestaña
window.addEventListener('hashchange', () => {
  const t = tabDesdeUrl();
  if (t && usuarioActivo.value && t !== currentTab.value) currentTab.value = t;
});

// ---------- Actividad ----------
let ultimaGuardada = 0;
const registrarActividad = () => {
  if (!usuarioActivo.value) return;
  const ahora = Date.now();
  if (ahora - ultimaGuardada < GUARDAR_ACTIVIDAD_CADA_MS) return;
  ultimaGuardada = ahora;
  const s = leer();
  if (s && s.usuario) escribir({ ...s, ultimaActividad: ahora });
};

const revisarInactividad = () => {
  if (!usuarioActivo.value) return;
  const s = leer();
  // Sesión borrada desde otra pestaña, o inactiva por más de 5 min (considerando todas las pestañas)
  if (!s || !s.usuario) return cerrarSesion('');
  if (Date.now() - (s.ultimaActividad || 0) >= INACTIVIDAD_MS) {
    cerrarSesion('Tu sesión se cerró por 5 minutos de inactividad.');
  }
};

EVENTOS_ACTIVIDAD.forEach(ev => window.addEventListener(ev, registrarActividad, { passive: true, capture: true }));
setInterval(revisarInactividad, REVISAR_CADA_MS);
// Al volver a la pestaña (o despertar el PC) se revisa de inmediato
document.addEventListener('visibilitychange', () => { if (!document.hidden) revisarInactividad(); });
// Cierre de sesión hecho en otra pestaña
window.addEventListener('storage', (e) => { if (e.key === SESION_KEY && !e.newValue && usuarioActivo.value) cerrarSesion(''); });

// ---------- API ----------
/** Llamar al iniciar sesión correctamente. */
export const iniciarSesion = (user) => {
  usuarioActivo.value = user;
  avisoSesion.value = '';
  ultimaGuardada = Date.now();
  escribir({ usuario: user.usuario, ultimaActividad: ultimaGuardada });
  currentTab.value = tabDesdeUrl() || 'dashboard';
  history.replaceState(null, '', '#' + currentTab.value);
};

/** Cierra la sesión (botón Salir o inactividad). */
export const cerrarSesion = (mensaje = '') => {
  borrar();
  usuarioActivo.value = null;
  avisoSesion.value = mensaje;
};

/** Al abrir/actualizar la página: recupera la sesión si sigue vigente. Llamar DESPUÉS de cargar los usuarios. */
export const restaurarSesion = () => {
  try {
    const s = leer();
    if (!s || !s.usuario) return;
    if (Date.now() - (s.ultimaActividad || 0) >= INACTIVIDAD_MS) {
      borrar();
      avisoSesion.value = 'Tu sesión se cerró por 5 minutos de inactividad.';
      return;
    }
    const user = dbUsuarios.value.find(u => String(u.usuario).toLowerCase() === String(s.usuario).toLowerCase());
    if (!user) { borrar(); return; }   // usuario eliminado
    usuarioActivo.value = user;
    ultimaGuardada = Date.now();
    escribir({ usuario: user.usuario, ultimaActividad: ultimaGuardada });
    currentTab.value = tabDesdeUrl() || 'dashboard';
  } finally {
    restaurandoSesion.value = false;
  }
};
