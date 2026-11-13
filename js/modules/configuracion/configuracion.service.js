// =====================================================================
// CONFIG & USUARIOS · Lógica (login, usuarios, personalización, exportación total)
// =====================================================================
import { supabaseClient, emailDeUsuario } from '../../core/supabase.js';
import { TABLAS } from '../../core/tablas.js';
import { exportarTodoExcel } from '../../core/exportar-todo.js';
import {
  usuarioActivo, currentTab, config, CONFIG_DEFAULT, LOGO_DEFAULT, LOGO_VERSION, dbUsuarios,
  dbEquipos, dbMovimientos, dbIntervenciones, dbProgramasCalendarios, dbProgramasItems, soloAdminGeneral, permisosDe, nivelEnArea, NIVELES, modulosDe, nivelEnModulo, NIVELES_MODULO, MODULOS_SIEMPRE } from '../../core/store.js';
import { AREAS_PERMISOS, gruposDeArea } from '../../core/menu.js';
export { permisosDe, nivelEnArea, NIVELES, AREAS_PERMISOS, modulosDe, nivelEnModulo, NIVELES_MODULO, MODULOS_SIEMPRE, gruposDeArea };
import { placeholderImg } from '../../core/utils.js';
import { iniciarSesion, cerrarSesion, cargarPerfil, debeCambiarClave, COLUMNAS_USUARIO } from '../../core/sesion.js';

const { ref, computed } = Vue;

const CONFIG_STORAGE_KEY = 'afi_config_custom';

// ---------- Login (Supabase Auth: la contraseña se valida en el servidor) ----------
export const loginUser = ref("");
export const loginPass = ref("");
export const authError = ref(false);
export const authMensaje = ref("");
export const ingresando = ref(false);

export const login = async () => {
  if (ingresando.value) return;
  authError.value = false;
  authMensaje.value = "";
  ingresando.value = true;
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: emailDeUsuario(loginUser.value),
      password: loginPass.value
    });
    if (error) {
      authError.value = true;
      authMensaje.value = (error.status === 429 || /rate|many/i.test(error.message || ''))
        ? 'Demasiados intentos. Espera unos minutos y vuelve a intentar.'
        : 'Usuario o contraseña incorrectos';
      return;
    }
    const perfil = await cargarPerfil(data.user.id);
    if (!perfil) {
      await supabaseClient.auth.signOut().catch(() => {});
      authError.value = true;
      authMensaje.value = 'Tu cuenta no tiene perfil en el sistema. Contacta al Admin general.';
      return;
    }
    loginUser.value = "";
    loginPass.value = "";
    iniciarSesion(perfil);   // se mantiene al actualizar, se cierra tras 5 min sin actividad
  } catch (err) {
    authError.value = true;
    authMensaje.value = 'No se pudo conectar. Revisa tu conexión a internet.';
    console.error(err);
  } finally {
    ingresando.value = false;
  }
};

export const logout = () => cerrarSesion();

// ---------- Cambio de contraseña (propia) ----------
export const MIN_CLAVE = 10;
/** Devuelve el problema de la contraseña, o '' si cumple las reglas. */
export const problemaClave = (clave, usuario = '') => {
  const c = String(clave || '');
  if (c.length < MIN_CLAVE) return `Debe tener al menos ${MIN_CLAVE} caracteres.`;
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(c) || !/\d/.test(c)) return 'Debe incluir letras y números.';
  if (usuario && c.toLowerCase().includes(String(usuario).toLowerCase())) return 'No puede contener tu nombre de usuario.';
  return '';
};

export const mostrarCambioClave = ref(false);
export const formClave = ref({ nueva: '', repetir: '' });
export const errorClave = ref('');
export const guardandoClave = ref(false);

export const abrirCambioClave = () => { formClave.value = { nueva: '', repetir: '' }; errorClave.value = ''; mostrarCambioClave.value = true; };
export const cerrarCambioClave = () => { if (!debeCambiarClave.value) mostrarCambioClave.value = false; };

export const guardarNuevaClave = async () => {
  const f = formClave.value;
  const yo = usuarioActivo.value && usuarioActivo.value.usuario;
  errorClave.value = problemaClave(f.nueva, yo) || (f.nueva !== f.repetir ? 'Las contraseñas no coinciden.' : '');
  if (errorClave.value) return;
  guardandoClave.value = true;
  try {
    const { error } = await supabaseClient.auth.updateUser({ password: f.nueva });
    if (error) {
      errorClave.value = /different|same/i.test(error.message || '') ? 'La nueva contraseña debe ser distinta de la actual.' : ('No se pudo cambiar: ' + error.message);
      return;
    }
    await supabaseClient.rpc('frc_clave_cambiada');
    debeCambiarClave.value = false;
    if (usuarioActivo.value) usuarioActivo.value = { ...usuarioActivo.value, debe_cambiar_clave: false };
    mostrarCambioClave.value = false;
    alert('Contraseña actualizada.');
  } finally {
    guardandoClave.value = false;
  }
};

// ---------- Usuarios (solo el ADMIN GENERAL los gestiona) ----------
// tipo 'general' → rol 'admin' (todo).  tipo 'areas' → rol 'lectura' + permisos por área (columna jsonb `permisos`).
/** Usuario principal: no se puede eliminar ni bajar de Admin general. */
export const USUARIO_PRINCIPAL = 'logistica';
const usuarioVacio = () => ({ usuario: "", clave: "", tipo: "areas", perfilId: "", permisos: Object.fromEntries(AREAS_PERMISOS.map(a => [a.key, "lectura"])) });
export const nuevoUsuario = ref(usuarioVacio());

/** Deja solo las áreas con nivel distinto de 'lectura'. */
const limpiarPermisos = (p) => Object.fromEntries(Object.entries(p || {}).filter(([, n]) => n && n !== 'lectura'));
const avisarError = (accion, error) => {
  const msg = error.message || JSON.stringify(error);
  if (/failed to fetch|load failed|networkerror/i.test(msg)) return alert(`Error al ${accion}: no hubo conexión con la base de datos (se intentó 3 veces).\nRevisa internet, actualiza la página (F5) y vuelve a intentar. Si sigue, prueba sin extensiones (ventana de incógnito).`);
  if (/permisos/i.test(msg)) return alert(`Error al ${accion}: falta la columna "permisos" en la tabla usuarios.\nEjecuta el archivo sql/permisos_areas.sql en Supabase (SQL Editor).`);
  alert(`Error al ${accion}: ${msg}`);
};
const esMismoUsuario = (a, b) => a && b && String(a).toLowerCase() === String(b).toLowerCase();

export const cargarUsuariosDesdeSupabase = async () => {
  try {
    const { data, error } = await supabaseClient.from(TABLAS.USUARIOS).select(COLUMNAS_USUARIO).order('usuario');
    if (error) throw error;
    dbUsuarios.value = data || [];
  } catch (err) {
    console.warn('No se pudieron leer los usuarios:', err);
  }
  // Si cambiaron los permisos del usuario conectado, se aplican al tiro
  if (usuarioActivo.value) {
    const yo = dbUsuarios.value.find(u => esMismoUsuario(u.usuario, usuarioActivo.value.usuario));
    if (yo) usuarioActivo.value = yo;
  }
};

export const crearNuevoUsuario = async () => {
  if (!soloAdminGeneral()) return;
  const u = nuevoUsuario.value;
  if (!u.usuario.trim() || !u.clave) return alert("Completa usuario y contraseña inicial.");
  const problema = problemaClave(u.clave, u.usuario.trim());
  if (problema) return alert("Contraseña inicial: " + problema);
  const general = u.tipo === 'general';
  // Mecánico: solo la app móvil · Supervisor de mecánicos: área Mecánicos = admin + sus niveles por área
  const permisos = general ? {}
    : u.tipo === 'mecanico' ? { mecanicos: 'subadmin' }
    : u.tipo === 'supervisor_mec' ? { ...limpiarPermisos(u.permisos), mecanicos: 'admin' }
    : (u.perfilId ? permisosDesdeModulos(perfilPorId(u.perfilId)?.modulos || {}, perfilPorId(u.perfilId)) : limpiarPermisos(u.permisos));
  const { error } = await supabaseClient.rpc('frc_admin_crear_usuario', {
    p_usuario: u.usuario.trim(), p_clave: u.clave, p_rol: general ? 'admin' : 'lectura', p_permisos: permisos
  });
  if (error) return avisarError('crear usuario', error);
  await cargarUsuariosDesdeSupabase();
  nuevoUsuario.value = usuarioVacio();
  alert("¡Guardado! Entrégale la contraseña inicial al usuario: el sistema le pedirá cambiarla al entrar.");
};

/** Cambia el nivel de un usuario en un área (se guarda al tiro). */
export const cambiarPermisoArea = async (u, areaKey, nivel) => {
  if (!soloAdminGeneral()) return;
  if (modulosDe(u)) { alert('Este usuario tiene acceso POR MÓDULO: cambia sus permisos con el botón "Módulos".'); return cargarUsuariosDesdeSupabase(); }
  const permisos = limpiarPermisos({ ...permisosDe(u), [areaKey]: nivel });
  const { error } = await supabaseClient.from(TABLAS.USUARIOS).update({ permisos, rol: 'lectura' }).eq('usuario', u.usuario);
  if (error) avisarError('guardar permisos', error);
  await cargarUsuariosDesdeSupabase();
};

/** Sube a Admin general o lo pasa a "permisos por área". */
export const cambiarTipoUsuario = async (u, tipo) => {
  if (!soloAdminGeneral()) return;
  if (tipo !== 'general' && (u.usuario === USUARIO_PRINCIPAL || esMismoUsuario(u.usuario, usuarioActivo.value && usuarioActivo.value.usuario))) {
    alert("No puedes quitarle el perfil Admin general a este usuario.");
    return cargarUsuariosDesdeSupabase();
  }
  if (tipo === 'general' && !confirm(`¿Dar a ${u.usuario} acceso de Admin general (todo el sistema, incluidos usuarios)?`)) return cargarUsuariosDesdeSupabase();
  const cambios = { rol: tipo === 'general' ? 'admin' : 'lectura' };
  const { error } = await supabaseClient.from(TABLAS.USUARIOS).update(cambios).eq('usuario', u.usuario);
  if (error) avisarError('cambiar el tipo de usuario', error);
  await cargarUsuariosDesdeSupabase();
};

/** Colores y nombres de los niveles (para la tabla de usuarios). */
export const claseNivel = (n) => n === 'admin' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : (n === 'subadmin' ? 'bg-sky-50 text-sky-800 border-sky-300' : 'bg-white text-slate-500');
export const etiquetaNivel = (n) => (NIVELES.find(x => x.key === n) || NIVELES[0]).label;

export const eliminarUsuario = async (username) => {
  if (!soloAdminGeneral()) return;
  if (username === USUARIO_PRINCIPAL) return alert("El usuario principal no se puede eliminar.");
  if (esMismoUsuario(username, usuarioActivo.value && usuarioActivo.value.usuario)) return alert("No puedes eliminar tu propio usuario.");
  if (!confirm(`¿Eliminar al usuario ${username}?`)) return;
  const { error } = await supabaseClient.rpc('frc_admin_eliminar_usuario', { p_usuario: username });
  if (error) return alert("Error al eliminar usuario: " + (error.message || JSON.stringify(error)));
  await cargarUsuariosDesdeSupabase();
};

/** El Admin general asigna una contraseña temporal (el usuario deberá cambiarla al entrar). */
export const restablecerClave = async (u) => {
  if (!soloAdminGeneral()) return;
  const clave = prompt(`Nueva contraseña temporal para ${u.usuario} (mínimo ${MIN_CLAVE} caracteres, letras y números):`);
  if (clave === null) return;
  const problema = problemaClave(clave, u.usuario);
  if (problema) return alert(problema);
  const { error } = await supabaseClient.rpc('frc_admin_cambiar_clave', { p_usuario: u.usuario, p_clave: clave });
  if (error) return alert("Error al restablecer la contraseña: " + (error.message || JSON.stringify(error)));
  await cargarUsuariosDesdeSupabase();
  alert(`Listo. Se cerraron las sesiones de ${u.usuario}; al entrar con la clave temporal deberá crear una nueva.`);
};

// ---------- Personalización (se guarda en este navegador) ----------
export const headerStyle = computed(() => ({ backgroundColor: config.value.customHeaderBg || '#0f172a' }));
export const bodyStyle = computed(() => ({ backgroundColor: config.value.customBodyBg || '#f1f5f9' }));
export const primaryBtnStyle = computed(() => ({ backgroundColor: config.value.customPrimaryBg || '#f59e0b', color: config.value.customPrimaryText || '#0f172a' }));
/** Logo a mostrar: el configurado o el oficial por defecto. */
export const logoSrc = computed(() => config.value.logo || LOGO_DEFAULT);
/** Si la imagen del logo no carga, se muestra un logo generado localmente. */
export const onLogoError = (e) => {
  const fallback = placeholderImg('FRC', 150, 150);
  if (e && e.target && e.target.src !== fallback) e.target.src = fallback;
};

export const cargarConfiguracionGuardada = () => {
  try {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!saved) return;
    const cfg = { ...CONFIG_DEFAULT, ...JSON.parse(saved) };
    // Logo antiguo, vacío o enlace a página (no imagen directa) → se reemplaza por el oficial
    const logo = String(cfg.logo || '');
    const esPaginaNoImagen = /^https?:\/\/(www\.)?imgur\.com\//i.test(logo);
    if ((cfg.logoVersion || 0) < LOGO_VERSION || !logo || logo.includes('via.placeholder.com') || esPaginaNoImagen) {
      cfg.logo = LOGO_DEFAULT;
      cfg.logoVersion = LOGO_VERSION;
      try { localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg)); } catch (e) { /* sin almacenamiento */ }
    }
    config.value = cfg;
  } catch (e) { console.warn('Configuración guardada inválida, se usan valores por defecto.'); }
};

export const guardarConfiguracionPersonalizada = () => {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config.value));
    alert("¡Configuración guardada con éxito!");
  } catch (e) {
    alert("No se pudo guardar la configuración (¿el logo es demasiado pesado?).");
  }
};

export const subirNuevaFotoLogo = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => { config.value.logo = evt.target.result; guardarConfiguracionPersonalizada(); };
  reader.readAsDataURL(file);
};

// ---------- Exportar toda la base (Excel con formato: logo, centrado, todas las tablas y columnas) ----------
export { exportandoTodo, progresoTodo } from '../../core/exportar-todo.js';
export const exportarTodasLasTablasExcel = () => exportarTodoExcel();

// =====================================================================
// ACCESO POR MÓDULO Y PERFILES
// ---------------------------------------------------------------------
// · Cada usuario (no Admin general) puede tener permisos._modulos = { modulo: nivel }.
//   Niveles: oculto (no ve) · lectura (ver) · subadmin (ver, subir y modificar) · admin (todo, incluye eliminar).
// · El nivel de cada ÁREA se guarda igual (= el mayor de sus módulos) porque la base de datos (RLS)
//   revisa los permisos por área. Ocultar un módulo lo saca del menú y no se puede abrir.
// · Inicio y Mis Tareas siempre se ven (no se pueden quitar).
// · Perfiles: plantillas con nombre (ej. "Bodega", "Mecánico") guardadas en bd_config clave 'perfiles_acceso'.
//   Al asignar un perfil se copian sus módulos al usuario; si después se edita el perfil, se puede
//   actualizar a todos los usuarios que lo tienen.
// =====================================================================
const ORDEN_NIVEL = { oculto: 0, lectura: 1, subadmin: 2, admin: 3 };
/** "Failed to fetch" = se cortó la conexión con Supabase: se reintenta 2 veces antes de avisar. */
const esErrorRed = (e) => /failed to fetch|network|load failed|fetch/i.test((e && (e.message || e.details)) || '');
const conReintento = async (fn, intentos = 3) => {
  let r;
  for (let i = 0; i < intentos; i++) {
    try { r = await fn(); } catch (err) { r = { error: err }; }
    if (!r.error || !esErrorRed(r.error)) return r;
    await new Promise(res => setTimeout(res, 1200 * (i + 1)));
  }
  return r;
};
const CLAVE_PERFILES = 'perfiles_acceso';

/** Áreas con sus módulos configurables (sin Inicio ni Mis Tareas, que siempre se ven). */
export const AREAS_MODULOS = AREAS_PERMISOS
  .map(a => ({ ...a, modulos: a.modulos.filter(m => !MODULOS_SIEMPRE.includes(m.key)) }))
  .filter(a => a.modulos.length);
const TODOS_MODULOS = AREAS_MODULOS.flatMap(a => a.modulos.map(m => ({ ...m, area: a.key })));

/** Arma `permisos` desde un mapa de módulos: niveles por área (máximo de sus módulos) + _modulos (+ _perfil). */
export const permisosDesdeModulos = (mapa, perfil = null) => {
  const out = {};
  const limpio = {};
  TODOS_MODULOS.forEach(m => {
    const n = mapa[m.key] || 'oculto';
    if (n !== 'oculto') limpio[m.key] = n;
    if (ORDEN_NIVEL[n] > ORDEN_NIVEL[out[m.area] || 'lectura']) out[m.area] = n;
  });
  Object.keys(out).forEach(k => { if (out[k] === 'lectura') delete out[k]; });
  out._modulos = limpio;
  if (perfil) out._perfil = { id: perfil.id, nombre: perfil.nombre };
  return out;
};

/** Mapa de módulos actual de un usuario (si no tiene, se arma desde sus niveles por área: ve todo). */
export const mapaModulosUsuario = (u) => {
  const m = modulosDe(u);
  if (m) return { ...m };
  return Object.fromEntries(TODOS_MODULOS.map(x => [x.key, nivelEnArea(x.area, u)]));
};
export const perfilDeUsuario = (u) => { const p = permisosDe(u); return p && p._perfil ? p._perfil : null; };
export const resumenAcceso = (u) => {
  if (u.rol === 'admin') return 'Todo';
  const m = modulosDe(u);
  if (!m) return 'Por área (ve todo)';
  const n = TODOS_MODULOS.filter(x => (m[x.key] || 'oculto') !== 'oculto').length;
  const pf = perfilDeUsuario(u);
  return (pf ? `Perfil ${pf.nombre} · ` : 'Personalizado · ') + `${n} de ${TODOS_MODULOS.length} módulos`;
};

// ---------- Perfiles guardados ----------
export const perfilesAcceso = ref([]);
export const faltaTablaConfig = ref(false);
export const perfilPorId = (id) => perfilesAcceso.value.find(p => String(p.id) === String(id));
export const cargarPerfilesAcceso = async () => {
  try {
    const { data, error } = await supabaseClient.from('bd_config').select('valor').eq('clave', CLAVE_PERFILES).limit(1);
    if (error) throw error;
    perfilesAcceso.value = (data && data[0] && Array.isArray(data[0].valor?.perfiles)) ? data[0].valor.perfiles : [];
    faltaTablaConfig.value = false;
  } catch (err) {
    if (/bd_config|does not exist|schema cache|relation/i.test(err.message || '')) faltaTablaConfig.value = true;
    else console.warn('No se pudieron leer los perfiles:', err);
  }
};
const guardarPerfilesAcceso = async (lista) => {
  const { error } = await conReintento(() => supabaseClient.from('bd_config').upsert([{ clave: CLAVE_PERFILES, valor: { perfiles: lista }, updated_at: new Date().toISOString() }], { onConflict: 'clave' }));
  if (error) {
    if (/bd_config|does not exist|schema cache|relation/i.test(error.message || '')) { faltaTablaConfig.value = true; alert('Falta la tabla bd_config: ejecuta sql/costos_mantencion.sql en Supabase (crea esa tabla) y vuelve a intentar.'); }
    else alert('No se pudo guardar el perfil: ' + error.message);
    return false;
  }
  perfilesAcceso.value = lista;
  return true;
};

// ---------- Ventana "Módulos" (usuario o perfil) ----------
// editorAcceso = { modo: 'usuario' | 'perfil', usuario?, perfil?: { id, nombre }, mapa: { modulo: nivel }, perfilId }
export const editorAcceso = ref(null);
export const abrirAccesoUsuario = (u) => {
  if (!soloAdminGeneral()) return;
  const pf = perfilDeUsuario(u);
  editorAcceso.value = { modo: 'usuario', usuario: u, mapa: mapaModulosUsuario(u), perfilId: pf ? pf.id : '', porArea: !modulosDe(u) };
};
export const abrirNuevoPerfil = () => {
  if (!soloAdminGeneral()) return;
  editorAcceso.value = { modo: 'perfil', perfil: { id: null, nombre: '', descripcion: '' }, mapa: Object.fromEntries(TODOS_MODULOS.map(m => [m.key, 'oculto'])) };
};
export const abrirEditarPerfil = (p) => {
  if (!soloAdminGeneral()) return;
  editorAcceso.value = { modo: 'perfil', perfil: { ...p }, mapa: { ...Object.fromEntries(TODOS_MODULOS.map(m => [m.key, 'oculto'])), ...(p.modulos || {}) } };
};
export const cerrarEditorAcceso = () => { editorAcceso.value = null; };
/** Pone el mismo nivel a todos los módulos de un área (o a todos si areaKey es null). */
export const nivelParaArea = (areaKey, nivel) => {
  const e = editorAcceso.value; if (!e) return;
  TODOS_MODULOS.filter(m => !areaKey || m.area === areaKey).forEach(m => { e.mapa[m.key] = nivel; });
  e.perfilId = ''; e.porArea = false;
};
export const cambiarNivelModulo = (key, nivel) => { const e = editorAcceso.value; e.mapa[key] = nivel; e.perfilId = ''; e.porArea = false; };
export const aplicarPerfilEnEditor = (id) => {
  const e = editorAcceso.value; const p = perfilPorId(id);
  e.perfilId = id; e.porArea = false;
  if (p) e.mapa = { ...Object.fromEntries(TODOS_MODULOS.map(m => [m.key, 'oculto'])), ...(p.modulos || {}) };
};
export const visiblesEnEditor = () => { const e = editorAcceso.value; return e ? TODOS_MODULOS.filter(m => (e.mapa[m.key] || 'oculto') !== 'oculto').length : 0; };
export const TOTAL_MODULOS = TODOS_MODULOS.length;
export const guardandoAcceso = ref(false);

export const guardarEditorAcceso = async () => {
  if (!soloAdminGeneral()) return;
  const e = editorAcceso.value; if (!e) return;
  guardandoAcceso.value = true;
  try {
    if (e.modo === 'perfil') {
      const nombre = String(e.perfil.nombre || '').trim();
      if (!nombre) return alert('Escribe el nombre del perfil.');
      if (perfilesAcceso.value.some(p => p.nombre.toLowerCase() === nombre.toLowerCase() && String(p.id) !== String(e.perfil.id))) return alert('Ya existe un perfil con ese nombre.');
      const limpio = Object.fromEntries(Object.entries(e.mapa).filter(([, n]) => n && n !== 'oculto'));
      const perfil = { id: e.perfil.id || Date.now(), nombre, descripcion: String(e.perfil.descripcion || '').trim(), modulos: limpio };
      const lista = e.perfil.id ? perfilesAcceso.value.map(p => (String(p.id) === String(perfil.id) ? perfil : p)) : [...perfilesAcceso.value, perfil];
      if (!(await guardarPerfilesAcceso(lista))) return;
      // Usuarios que tienen este perfil → se actualizan
      const conPerfil = dbUsuarios.value.filter(u => u.rol !== 'admin' && String(perfilDeUsuario(u)?.id) === String(perfil.id));
      if (conPerfil.length && confirm(`¿Aplicar los cambios también a los ${conPerfil.length} usuario(s) con el perfil "${nombre}"?\n${conPerfil.map(u => u.usuario).join(', ')}`)) {
        for (const u of conPerfil) {
          const { error } = await conReintento(() => supabaseClient.from(TABLAS.USUARIOS).update({ permisos: permisosDesdeModulos(perfil.modulos, perfil), rol: 'lectura' }).eq('usuario', u.usuario));
          if (error) avisarError('actualizar ' + u.usuario, error);
        }
        await cargarUsuariosDesdeSupabase();
      }
    } else {
      const u = e.usuario;
      let permisos;
      if (e.porArea) {
        // volver al sistema antiguo: solo niveles por área (ve todo)
        permisos = Object.fromEntries(Object.entries(permisosDe(u)).filter(([k]) => !k.startsWith('_')));
      } else {
        const perfil = e.perfilId ? perfilPorId(e.perfilId) : null;
        permisos = permisosDesdeModulos(e.mapa, perfil);
      }
      const { error } = await conReintento(() => supabaseClient.from(TABLAS.USUARIOS).update({ permisos, rol: 'lectura' }).eq('usuario', u.usuario));
      if (error) return avisarError('guardar el acceso', error);
      await cargarUsuariosDesdeSupabase();
    }
    editorAcceso.value = null;
  } finally { guardandoAcceso.value = false; }
};

export const eliminarPerfilAcceso = async (p) => {
  if (!soloAdminGeneral()) return;
  const n = dbUsuarios.value.filter(u => String(perfilDeUsuario(u)?.id) === String(p.id)).length;
  if (!confirm(`¿Eliminar el perfil "${p.nombre}"?` + (n ? `\n${n} usuario(s) lo tienen: conservan sus módulos actuales (quedan como personalizados).` : ''))) return;
  await guardarPerfilesAcceso(perfilesAcceso.value.filter(x => String(x.id) !== String(p.id)));
};
export const usuariosConPerfil = (p) => dbUsuarios.value.filter(u => u.rol !== 'admin' && String(perfilDeUsuario(u)?.id) === String(p.id)).map(u => u.usuario);
export const contarModulos = (mapa) => Object.values(mapa || {}).filter(n => n && n !== 'oculto').length;

// ---------- Estilos / nombres para la ventana de módulos ----------
const ETIQUETA_MOD = Object.fromEntries(AREAS_MODULOS.flatMap(a => a.modulos.map(m => [m.key, m.label])));
export const etiquetaModulo = (k) => ETIQUETA_MOD[k] || k;
export const cortoNivelModulo = (n) => (NIVELES_MODULO.find(x => x.key === n) || NIVELES_MODULO[0]).corto;
export const claseNivelModulo = (n) => ({
  oculto: 'bg-slate-100 text-slate-500 border-slate-300', lectura: 'bg-white text-slate-700 border-slate-300',
  subadmin: 'bg-sky-50 text-sky-800 border-sky-300', admin: 'bg-emerald-50 text-emerald-800 border-emerald-300'
}[n] || '');
export const botonNivelActivo = (n) => ({ oculto: 'bg-slate-500 text-white', lectura: 'bg-slate-800 text-white', subadmin: 'bg-sky-600 text-white', admin: 'bg-emerald-600 text-white' }[n]);
