// =====================================================================
// CONFIG & USUARIOS · Lógica (login, usuarios, personalización, exportación total)
// =====================================================================
import { supabaseClient } from '../../core/supabase.js';
import { TABLAS } from '../../core/tablas.js';
import {
  usuarioActivo, currentTab, config, CONFIG_DEFAULT, LOGO_DEFAULT, LOGO_VERSION, dbUsuarios,
  dbEquipos, dbMovimientos, dbIntervenciones, dbProgramasCalendarios, dbProgramasItems, soloAdmin } from '../../core/store.js';
import { placeholderImg } from '../../core/utils.js';

const { ref, computed } = Vue;

const CONFIG_STORAGE_KEY = 'afi_config_custom';

// ---------- Login ----------
// NOTA: se mantiene el mismo mecanismo de login del original (a pedido).
export const loginUser = ref("");
export const loginPass = ref("");
export const authError = ref(false);

export const login = () => {
  const userEncontrado = dbUsuarios.value.find(u => String(u.usuario).toLowerCase() === loginUser.value.trim().toLowerCase() && u.clave === loginPass.value.trim());
  if (userEncontrado) {
    usuarioActivo.value = userEncontrado;
    authError.value = false;
    loginUser.value = "";
    loginPass.value = "";
    currentTab.value = 'dashboard';
  } else {
    authError.value = true;
  }
};

export const logout = () => { usuarioActivo.value = null; };

// ---------- Usuarios ----------
const USUARIO_RESPALDO = [{ usuario: "logistica", clave: "frc", rol: "admin", nombre: "Logística FRC" }];
export const nuevoUsuario = ref({ usuario: "", clave: "", rol: "lectura" });

export const cargarUsuariosDesdeSupabase = async () => {
  try {
    const { data } = await supabaseClient.from(TABLAS.USUARIOS).select('*');
    dbUsuarios.value = (data && data.length > 0) ? data : USUARIO_RESPALDO;
  } catch (err) {
    dbUsuarios.value = USUARIO_RESPALDO;
  }
};

export const crearNuevoUsuario = async () => {
  if (!soloAdmin()) return;
  const u = nuevoUsuario.value;
  if (!u.usuario || !u.clave) return alert("Completa usuario y clave.");
  const { error } = await supabaseClient.from(TABLAS.USUARIOS).insert([{ usuario: u.usuario.trim(), clave: u.clave.trim(), rol: u.rol, nombre: u.usuario.trim() }]);
  if (error) return alert("Error al crear usuario: " + (error.message || JSON.stringify(error)));
  await cargarUsuariosDesdeSupabase();
  nuevoUsuario.value = { usuario: "", clave: "", rol: "lectura" };
  alert("¡Guardado!");
};

export const eliminarUsuario = async (username) => {
  if (!soloAdmin()) return;
  if (!confirm(`¿Eliminar al usuario ${username}?`)) return;
  const { error } = await supabaseClient.from(TABLAS.USUARIOS).delete().eq('usuario', username);
  if (error) return alert("Error al eliminar usuario: " + (error.message || JSON.stringify(error)));
  await cargarUsuariosDesdeSupabase();
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

// ---------- Exportar toda la base ----------
export const exportarTodasLasTablasExcel = () => {
  if (!window.XLSX) return alert("Librería SheetJS no disponible.");
  const wb = XLSX.utils.book_new();
  const add = (rows, name) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);

  add(dbEquipos.value.map(e => ({ AFI: e.afi, Tipo: e.tipo, Marca: e.marca, Modelo: e.modelo, Ubicacion: e.ubicacion, Disponibilidad: e.disponibilidad, Horometro: e.horometroActual, GPS: e.gps })), "Inventario");
  add(dbMovimientos.value.map(m => ({ Fecha: m.fecha, AFI: m.afi, Tipo: m.tipo, Origen: m.origen, Destino: m.destino, Empresa: m.empresa_arriendo, Estado: m.estado, Camion: m.camion, Conductor: m.conductor })), "Movimientos");
  add(dbIntervenciones.value.map(i => ({ AFI: i.afi, Fecha: i.fecha, Programa: i.programaCorrespondiente, Equipo: i.equipo, Lugar: i.lugar, Causa: i.causa, TipoMant: i.tipoMant, Horometro: i.horometro, Costo: i.costo, OC: i.numeroOC, OT: i.numeroOT })), "Historial Mantenciones");
  add(dbProgramasCalendarios.value.map(p => ({ ID: p.id, Tipo: p.tipo || p.carpeta, Nombre: p.nombre_programa || p.mes, FechaInicio: p.fecha_inicio_programa, FechaTermino: p.fecha_termino_programa })), "Programas");
  add(dbProgramasItems.value.map(it => ({ ProgramaID: it.programa_id, AFI: it.afi, TipoTrabajo: it.tipo, Nave: it.nave || 'N/A', Condicion: it.condicion, FechaProgramada: it.fecha_programada, Realizado: it.realizado ? 'Sí' : 'No' })), "Asignaciones Programas");

  XLSX.writeFile(wb, "Base_De_Datos_Completa_FRC.xlsx");
};
