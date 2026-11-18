// =====================================================================
// MECÁNICOS · App móvil + panel de firmas (sql/mecanicos.sql)
// ---------------------------------------------------------------------
// Usuarios (usuarios.permisos.mecanicos):
//   'subadmin' → MECÁNICO: entra directo a la app móvil (equipos, horómetro, intervenciones)
//   'admin'    → SUPERVISOR: ve el área MECÁNICOS del menú (panel), revisa y firma
//   El área MECÁNICOS del menú solo la ve el Admin general y los supervisores.
// Flujo de una intervención:
//   1) El mecánico la llena en el celular (mecánica o eléctrica, + registro de bloqueo opcional) y firma.
//   2) Firma del supervisor:
//        · en terreno: el supervisor del CLIENTE firma ahí mismo en el celular, o
//        · en taller: queda PENDIENTE y el supervisor FRC firma en su PC / celular (panel MECÁNICOS).
//   3) Con las dos firmas pasa SOLA al Historial del equipo, con la hoja en PDF igual al formato oficial.
// =====================================================================
import { supabaseClient, sb, errMsg, subirArchivoStorage } from '../../core/supabase.js';
import { TABLAS } from '../../core/tablas.js';
import { usuarioActivo, dbEquipos, dbIntervenciones, dbUsuarios, nivelEnArea, esAdminGeneral, cargarDatosDesdeSupabase, permisosDe, cargoDe, modoTecnicoDe, recalcularHorometros } from '../../core/store.js';
import { hoyISO, limpiarAfi, mismoAfi, normalizarFecha, calcularRestaHoras } from '../../core/utils.js';
import { esVehiculo, empresaDe, EMPRESA_TALLER } from '../inventario/inventario.mapper.js';
import { logoDataURL } from '../../core/excel.js';
import { listaCausas } from '../historial/historial.service.js';
import { ACEITES } from '../historial/historial.mapper.js';
import { naveDeAfi } from '../taller/taller.service.js';   // TALLER: solo equipos en nave (2026-11-17)
import { crearFallasDeInspeccion, marcarFallaReparada, fallaPorId, textoFalla, asegurarFallas, SQL_FALLAS, dbProblemasRef } from './fallas-equipo.js';   // 2026-11-18
import { hojaIntervencion, hojaBloqueo, bloqueoVacio, ANCHO_VERTICAL, ANCHO_HORIZONTAL, TIPOS_EQUIPO_BLOQUEO } from './hojas.js';

const { ref, computed } = Vue;
export const TABLA_MEC = TABLAS.MEC_INTERVENCIONES;

// ---------- Quién es quién ----------
const nivelMec = (u = usuarioActivo.value) => (u ? (u.rol === 'admin' ? 'admin' : (permisosDe(u).mecanicos || 'lectura')) : 'lectura');
/** Mecánico "puro": entra directo a la app móvil. */
export const esModoMecanico = computed(() => {
  const u = usuarioActivo.value;
  return Boolean(u && u.rol !== 'admin' && nivelMec(u) === 'subadmin' && modoTecnicoDe(u) !== 'totem');
});
/** Supervisor (o Admin general): ve el panel MECÁNICOS y firma. */
export const esSupervisorMec = computed(() => Boolean(usuarioActivo.value && (esAdminGeneral.value || nivelMec() === 'admin')));
/** Puede llenar intervenciones / cambiar horómetro desde la app. */
export const puedeUsarApp = computed(() => {
  const u = usuarioActivo.value; if (!u) return false;
  return u.rol === 'admin' || ['subadmin', 'admin'].includes(nivelMec(u)) || ['subadmin', 'admin'].includes(nivelEnArea('operaciones', u));
});
/** Vista previa de la app dentro del sistema (panel → "Ver app como mecánico"). */
export const vistaAppForzada = ref(false);

// ---------- TALLER / TERRENO (2026-11-16) ----------
// Técnicos (permisos.mecanicos = 'subadmin') tienen un modo: permisos.mec_modo = 'taller' | 'terreno' (sin modo = terreno).
//   TERRENO: Equipos · Mis documentos · Mis tareas
//   TALLER:  Equipos · Taller (naves del programa de reparación) · Mantención · Mis documentos · Mis tareas
//            y el horómetro solo se actualiza en equipos que están dentro de una nave.
/** Modo elegido en la vista previa del panel (Admin / supervisor). */
export const modoPreview = ref('taller');
export const modoApp = computed(() => {
  if (vistaAppForzada.value || !esModoMecanico.value) return modoPreview.value;
  return modoTecnicoDe(usuarioActivo.value) || 'terreno';
});
export const esTaller = computed(() => modoApp.value === 'taller');
/** CHOFER (2026-11-17): ve equipos (solo consulta) y registra el check list / report del camión (movimientos). */
export const esChofer = computed(() => modoApp.value === 'chofer');
/** TERRENO CRTG (2026-11-17): solo equipos que están en CRTG + programa de mantención CRTG + pedir repuestos. */
export const esCrtg = computed(() => modoApp.value === 'crtg');
export const esEquipoCrtg = (e) => /CRTG/i.test(empresaDe(e) || '') || /CRTG/i.test(String(e?.ubicacion || ''));
/** Cargo del usuario conectado (se muestra arriba). */
export const cargoActual = computed(() => cargoDe(usuarioActivo.value));
/** AFI elegido para la mantención (desde una carta del taller o la lista). */
export const mantAfi = ref('');

// ---------- Equipos ----------
export const busquedaEq = ref('');
const up = (s) => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const equiposApp = computed(() => {
  const q = up(busquedaEq.value).replace(/\s+/g, ' ');
  return dbEquipos.value
    .filter(e => !esVehiculo(e) && String(e.disponibilidad || '').toUpperCase() !== 'VENTA')
    .filter(e => !esCrtg.value || esEquipoCrtg(e))   // CRTG: solo sus equipos
    .filter(e => !q || up([e.afi, e.tipo, e.marca, e.modelo, e.ubicacion, empresaDe(e)].join(' ')).includes(q))
    .sort((a, b) => ((empresaDe(b) === EMPRESA_TALLER) - (empresaDe(a) === EMPRESA_TALLER))
      || String(a.afi).localeCompare(String(b.afi), undefined, { numeric: true }));
});
export const equipoSel = ref(null);
/** Pantalla de la app: 'inicio' (menú en tarjetas) | 'equipos' | 'taller' | 'registros' | 'tareas'. */
export const tabApp = ref('inicio');   // 'inicio' = menú en tarjetas
export const abrirEquipo = (e) => { equipoSel.value = e; horoForm.value = { valor: '', fecha: hoyISO() }; };
export const cerrarEquipo = () => { equipoSel.value = null; };
export const enTaller = (e) => empresaDe(e) === EMPRESA_TALLER;

// ---------- Horómetro ----------
export const horoForm = ref({ valor: '', fecha: hoyISO() });
export const guardandoHoro = ref(false);
export const guardarHorometro = async (e) => {
  const v = Number(String(horoForm.value.valor).replace(/\./g, '').replace(',', '.'));
  if (!(v > 0)) return alert('Escribe el horómetro (solo números).');
  const actual = Number(e.horometros?.hTomado) || 0;
  if (actual && v < actual && !confirm(`El horómetro ${v.toLocaleString('es-CL')} es MENOR que el último (${actual.toLocaleString('es-CL')}). ¿Guardar igual?`)) return;
  if (actual && v - actual > 2000 && !confirm(`Subió ${(v - actual).toLocaleString('es-CL')} h desde el último. ¿Está bien escrito?`)) return;
  guardandoHoro.value = true;
  try {
    await sb(supabaseClient.rpc('frc_mec_horometro', { p_afi: String(e.afi), p_horometro: v, p_fecha: horoForm.value.fecha || hoyISO() }));
    // ahorro de datos: se actualiza el equipo en memoria (antes se bajaba todo el inventario con fotos)
    const eqMem = dbEquipos.value.find(x => mismoAfi(x.afi, e.afi));
    if (eqMem) { eqMem.horometroActual = v; eqMem.fechaHorometroManual = horoForm.value.fecha || hoyISO(); recalcularHorometros(); }
    equipoSel.value = eqMem || null;
    horoForm.value = { valor: '', fecha: hoyISO() };
    avisoApp('Horómetro actualizado ✔');
  } catch (err) {
    alert(/frc_mec_horometro|function/i.test(errMsg(err)) ? 'Falta ejecutar sql/mecanicos.sql en Supabase.' : 'No se pudo guardar: ' + errMsg(err));
  } finally { guardandoHoro.value = false; }
};

/** Último reporte de cada equipo (para la ficha). */
export const ultimosRegistros = (afi, n = 4) => dbIntervenciones.value
  .filter(i => mismoAfi(i.afi, afi))
  .sort((a, b) => String(normalizarFecha(b.fecha)).localeCompare(String(normalizarFecha(a.fecha))))
  .slice(0, n);

// ---------- Aviso corto en pantalla ----------
export const toastApp = ref('');
let toastT = null;
export const avisoApp = (t) => { toastApp.value = t; clearTimeout(toastT); toastT = setTimeout(() => { toastApp.value = ''; }, 3000); };

// ---------- Intervenciones ----------
export const dbMec = ref([]);
export const cargandoMec = ref(false);
export const faltaSQLMec = ref(false);
export const cargarMec = async () => {
  cargandoMec.value = true;
  try {
    const data = await sb(supabaseClient.from(TABLA_MEC).select('*').order('id', { ascending: false }).limit(500));
    dbMec.value = data;
    faltaSQLMec.value = false;
  } catch (err) {
    if (/bd_mec_intervenciones|does not exist|schema cache/i.test(errMsg(err))) faltaSQLMec.value = true;
    else console.warn('[Mecánicos]', errMsg(err));
  } finally { cargandoMec.value = false; }
};
// ---------- Carpetas por cuenta (2026-11-13) ----------
// Cada intervención queda en la carpeta de quien la creó Y de los compañeros agregados con su cuenta
// (mecanicos[].usuario). Todos ven el PDF aunque falte la firma; pasa a "Realizados" con la firma del supervisor.
const yo = () => String(usuarioActivo.value?.usuario || '').toLowerCase();
export const participa = (r, u = yo()) => Boolean(u) && (String(r.creado_por || '').toLowerCase() === u || (r.mecanicos || []).some(m => String(m.usuario || '').toLowerCase() === u));
export const misRegistros = computed(() => dbMec.value.filter(r => participa(r)));
export const esRealizado = (r) => r.estado === 'EN_HISTORIAL' || r.estado === 'LEVANTAMIENTO';   // el levantamiento no lleva firmas
export const misSinFirma = computed(() => misRegistros.value.filter(r => !esRealizado(r)));
export const misRealizados = computed(() => misRegistros.value.filter(esRealizado));
export const carpetaApp = ref('SIN_FIRMA');   // 'SIN_FIRMA' | 'REALIZADOS'
/** Cuentas para agregar como compañero: primero los mecánicos. */
export const cuentasUsuarios = computed(() => dbUsuarios.value
  .map(u => ({ usuario: u.usuario, nombre: u.nombre || u.usuario, mec: ['subadmin', 'admin'].includes(permisosDe(u).mecanicos) }))
  .sort((a, b) => (b.mec - a.mec) || a.nombre.localeCompare(b.nombre)));
export const nombreDeCuenta = (usuario) => (cuentasUsuarios.value.find(c => c.usuario === usuario) || {}).nombre || '';
/** Panel: carpetas por cuenta (todas las que aparecen en algún documento). */
export const carpetasPanel = computed(() => {
  const m = new Map();
  dbMec.value.forEach(r => {
    const cuentas = new Set([String(r.creado_por || '').toLowerCase(), ...(r.mecanicos || []).map(x => String(x.usuario || '').toLowerCase())].filter(Boolean));
    cuentas.forEach(u => {
      const c = m.get(u) || m.set(u, { usuario: u, nombre: nombreDeCuenta(u) || u, sinFirma: 0, realizados: 0 }).get(u);
      if (esRealizado(r)) c.realizados++; else c.sinFirma++;
    });
  });
  return [...m.values()].sort((a, b) => b.sinFirma - a.sinFirma || a.nombre.localeCompare(b.nombre));
});
export const carpetaPanel = ref('');   // usuario elegido en el panel ('' = todas)
export const ESTADOS_MEC = {
  LEVANTAMIENTO: { t: 'Levantamiento creado', c: 'bg-amber-100 text-amber-800 border-amber-300', i: 'fa-list-ol' },
  PENDIENTE_FIRMA: { t: 'Falta firma supervisor', c: 'bg-amber-100 text-amber-800 border-amber-300', i: 'fa-hourglass-half' },
  FIRMADA: { t: 'Firmada (pasando al Historial)', c: 'bg-sky-100 text-sky-800 border-sky-300', i: 'fa-signature' },
  EN_HISTORIAL: { t: 'En el Historial', c: 'bg-emerald-100 text-emerald-800 border-emerald-300', i: 'fa-circle-check' },
  RECHAZADA: { t: 'Rechazada · corregir', c: 'bg-rose-100 text-rose-800 border-rose-300', i: 'fa-rotate-left' }
};

// ---------- Formulario (app) ----------
const BORRADOR = () => 'frc_mec_borrador_' + String(usuarioActivo.value?.usuario || '').toLowerCase();
const horaAhora = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export { horaAhora };
/** Ítem del levantamiento de fallas (2026-11-18): falla + repuesto (código, serie motor) + hasta 2 fotos. */
export const itemFallaVacio = () => ({ descripcion: '', sistema: '', necesita_repuesto: false, repuesto: '', cantidad: '', codigo_repuesto: '', serie_motor: '', fotos: [] });
export const nuevaIntervencion = (tipo, e) => ({
  id: null, tipo, afi: String(e.afi), equipo: [e.tipo, e.marca, e.modelo].filter(Boolean).join(' '),
  fecha: hoyISO(), horometro: e.horometros?.hTomado ? String(e.horometros.hTomado) : '', turno: new Date().getHours() >= 20 || new Date().getHours() < 8 ? 'NOCHE' : 'DÍA',
  lugar: enTaller(e) ? 'TALLER FRC' : (e.ubicacion || empresaDe(e) || ''), hora_falla: '', hora_inicio: horaAhora(), hora_termino: '',
  uso_art: false, bloqueo: false,
  mecanicos: [{ nombre: usuarioActivo.value?.nombre || usuarioActivo.value?.usuario || '', usuario: usuarioActivo.value?.usuario || '', firma: '' }],
  causa_intervencion: '', descripcion: '', interferencia: '', causa_falla: '',
  // 2026-11-18: modo INSPECCION (observación + fallas enumeradas) | REPARACION (una falla abierta) · cada envío = un report
  modo: '', fallas: [itemFallaVacio()], falla_id: null, falla_texto: '', levantamiento_id: null,
  art_fotos: [], bloqueo_foto: '', modoFijo: false, fecha_termino: hoyISO(), terminado: false, fecha_falla: hoyISO(),   // ART (2 hojas) y bloqueo (1 hoja) en fotos: el papel se llena físico
  lubricantes: [], usuario_arriendo: enTaller(e) ? '' : (empresaDe(e) || ''), operador: '', vale_consumo: '',
  registro_bloqueo: null,
  supervisor: { modo: 'DESPUES', nombre: '', empresa: '', tipo: 'CLIENTE', firma: '' }
});
export const formInt = ref(null);       // intervención en edición (app)
export const pasoInt = ref(1);
export const abrirIntervencion = (tipo, e, falla = null) => {
  // TALLER: intervenciones solo en equipos que están en una nave · CHOFER: nunca (2026-11-17)
  if (esChofer.value) { alert('El perfil Chofer no hace intervenciones: registra el check list / report del camión.'); return; }
  if (esTaller.value && !naveDeAfi(e.afi)) { alert(`El AFI ${e.afi} no está en una nave. En taller primero se ingresa el equipo a una nave.`); return; }
  let b = null; try { b = JSON.parse(localStorage.getItem(BORRADOR()) || 'null'); } catch (x) { b = null; }
  if (b && b.afi === String(e.afi) && b.tipo === tipo && confirm('Tienes un borrador sin enviar de este equipo. ¿Seguir con ese borrador?')) formInt.value = b;
  else formInt.value = nuevaIntervencion(tipo, e);
  if (falla) { elegirFalla(formInt.value, falla); formInt.value.modoFijo = true; }
  pasoInt.value = 1;
  asegurarFallas();
};
/** Paso "Trabajo": elige INSPECCIÓN o REPARACIÓN. */
export const elegirModo = (f, modo) => {
  f.modo = modo;
  if (modo === 'INSPECCION') {
    if (f.tipo === 'ELECTRICA') { f.causa_intervencion = 'INSPECCIÓN'; } else { f.causa_falla = 'INSPECCION'; }
    if (!(f.fallas || []).length) f.fallas = [itemFallaVacio()];
  } else if (f.tipo === 'ELECTRICA' ? f.causa_intervencion === 'INSPECCIÓN' : f.causa_falla === 'INSPECCION') {
    if (f.tipo === 'ELECTRICA') f.causa_intervencion = ''; else f.causa_falla = '';
  }
};
/** Reparación de una falla abierta: deja el título con el texto de la falla (se puede cambiar). */
export const elegirFalla = (f, h) => {
  elegirModo(f, 'REPARACION');
  f.falla_id = h ? h.id : null;
  f.falla_texto = h ? textoFalla(h) : '';
  // enlace con el levantamiento de fallas que la creó (y su hora de falla)
  f.levantamiento_id = h && h.intervencion_id ? h.intervencion_id : null;
  const lev = f.levantamiento_id ? dbMec.value.find(x => String(x.id) === String(f.levantamiento_id)) : null;
  f.hora_falla = lev ? (lev.hora_falla || '') : (h ? '' : f.hora_falla);
  f.fecha_falla = lev ? (lev.fecha_falla || lev.fecha || '') : (h ? '' : f.fecha_falla);
  const titulo = h ? String(h.descripcion || '').trim() : '';
  if (f.tipo === 'ELECTRICA') f.causa_falla = titulo; else f.causa_intervencion = titulo;
};
/** Minutos entre inicio y término (acepta días distintos). null si falta algo o queda negativo. */
export const duracionMin = (f) => {
  const fi = normalizarFecha(f.fecha), ft = normalizarFecha(f.fecha_termino || f.fecha);
  if (!fi || !ft || !/^\d{1,2}:\d{2}/.test(f.hora_inicio || '') || !/^\d{1,2}:\d{2}/.test(f.hora_termino || '')) return null;
  const t = (d, h) => { const [y, m, dd] = d.split('-').map(Number); const [hh, mm] = h.split(':').map(Number); return Date.UTC(y, m - 1, dd, hh, mm) / 60000; };
  const n = t(ft, f.hora_termino) - t(fi, f.hora_inicio);
  return n >= 0 ? n : null;
};
export const textoDuracion = (min) => (min == null ? '—' : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ' ' + (min % 60) + ' min' : ''}`);
/** Menú del equipo → "Levantamiento de fallas" (2026-11-18). */
export const abrirLevantamiento = (e) => {
  abrirIntervencion('MECANICA', e);
  const f = formInt.value;
  if (!f) return;
  if (f.modo == null || (f.modo && f.modo !== 'INSPECCION')) return;   // borrador antiguo o de otra cosa
  elegirModo(f, 'INSPECCION'); f.modoFijo = true;
};
/** ART (hoja 0 y 1) y BLOQUEO: foto del papel físico → se achica y se sube. */
export const subiendoFoto = ref('');
export const subirFotoDoc = async (f, cual, i, file) => {
  if (!file) return;
  subiendoFoto.value = cual + i;
  try {
    const { comprimirImagen } = await import('../inventario/fotos-equipo.js');
    const blob = await comprimirImagen(file, 1600, 0.82);
    const nombre = `intervenciones_app/fotos/${limpiarAfi(f.afi).replace(/[^\w-]/g, '')}_${cual}_${Date.now()}_${i + 1}.jpg`;
    const url = await subirArchivoStorage(nombre, new File([blob], nombre.split('/').pop(), { type: 'image/jpeg' }));
    if (cual === 'ART') { const a = [...(f.art_fotos || [])]; a[i] = url; f.art_fotos = a; }
    else if (typeof cual === 'string' && cual.startsWith('FALLA')) { const it = f.fallas[Number(cual.slice(5))]; if (it) { const a = [...(it.fotos || [])]; a[i] = url; it.fotos = a; } }
    else f.bloqueo_foto = url;
  } catch (err) { alert('No se pudo subir la foto: ' + errMsg(err)); }
  finally { subiendoFoto.value = ''; }
};
export const editarRegistro = (r) => {
  formInt.value = { ...JSON.parse(JSON.stringify(r)), horometro: r.horometro ? String(r.horometro) : '', supervisor: { modo: 'DESPUES', nombre: '', empresa: '', tipo: 'CLIENTE', firma: '' } };
  if (formInt.value.modo) {   // formato 2026-11-18
    if (!formInt.value.fecha_termino) formInt.value.fecha_termino = formInt.value.fecha;
    if (!(formInt.value.fallas || []).length) formInt.value.fallas = [itemFallaVacio()];
  }
  pasoInt.value = 1;
};
export const guardarBorrador = () => { try { if (formInt.value && !formInt.value.id) localStorage.setItem(BORRADOR(), JSON.stringify(formInt.value)); } catch (e) { /* lleno */ } };
export const cerrarIntervencion = () => { guardarBorrador(); formInt.value = null; };
export const activarBloqueo = (f) => {
  if (!f.registro_bloqueo) {
    const b = bloqueoVacio();
    const eq = dbEquipos.value.find(x => mismoAfi(x.afi, f.afi)) || {};
    b.solicitante = f.mecanicos[0]?.nombre || ''; b.encargado = f.mecanicos[0]?.nombre || '';
    b.area = f.lugar; b.fecha = f.fecha; b.hora_inicio = f.hora_inicio; b.equipo = `AFI ${f.afi} · ${f.equipo}`;
    b.actividad = f.causa_intervencion;
    b.tipo_equipo = TIPOS_EQUIPO_BLOQUEO.find(t => up(eq.tipo).includes(up(t).split(' ')[0])) || 'Otro';
    if (b.tipo_equipo === 'Otro') b.otro = eq.tipo || '';
    b.personal[0].nombre = f.mecanicos[0]?.nombre || '';
    b.personal[0].h_inicio = f.hora_inicio;
    b.verificacion.nombre = f.mecanicos[0]?.nombre || '';
    f.registro_bloqueo = b;
  }
};

/** Qué falta para poder enviar (lista de textos). */
export const faltantes = (f) => {
  const x = [];
  if (!f.fecha) x.push('Fecha');
  if (f.modo === 'INSPECCION') {   // 2026-11-18: el levantamiento solo lleva datos, observación y fallas (se crea en el paso 2)
    if (!String(f.descripcion || '').trim()) x.push('Observación del equipo');
    if (!(f.fallas || []).some(i => String(i.descripcion || '').trim())) x.push('Al menos una falla');
    (f.fallas || []).forEach((i, k) => { if (String(i.descripcion || '').trim() && i.necesita_repuesto && !String(i.repuesto || '').trim()) x.push(`Falla ${k + 1}: qué repuesto`); });
    return x;
  }
  if (!f.hora_inicio) x.push('Hora inicio');
  if (!f.hora_termino) x.push('Hora término');
  if (f.modo != null) {   // formato nuevo (2026-11-18) · registros antiguos (modo null) siguen como antes
    if (!f.modo) x.push('Elegir: Levantamiento de fallas o Reparación');
    if (f.hora_inicio && f.hora_termino && duracionMin(f) == null) x.push('El término no puede ser antes del inicio');
    if (f.modo === 'INSPECCION') {
      if (!String(f.descripcion || '').trim()) x.push('Observación del equipo');
      (f.fallas || []).forEach((i, k) => { if (String(i.descripcion || '').trim() && i.necesita_repuesto && !String(i.repuesto || '').trim()) x.push(`Falla ${k + 1}: qué repuesto`); });
      if ((f.lubricantes || []).some(l => l.key && !(Number(String(l.cantidad).replace(',', '.')) > 0))) x.push('Litros de cada lubricante');
      if (!f.mecanicos.some(m => String(m.nombre).trim())) x.push('Nombre del mecánico');
      if (!f.mecanicos[0]?.firma) x.push('Firma del mecánico responsable');
      if (f.supervisor?.modo === 'AHORA' && (!String(f.supervisor.nombre || '').trim() || !f.supervisor.firma)) x.push('Nombre y firma del supervisor');
      if (!f.terminado) x.push('Marcar ✓ terminado');
      return x;
    }
    if (f.modo === 'REPARACION' && !f.terminado) x.push('Marcar ✓ terminado');
    if (f.uso_art && (f.art_fotos || []).filter(Boolean).length < 2) x.push('Fotos de las 2 hojas del ART');
    if (f.bloqueo && !f.bloqueo_foto) x.push('Foto del registro de bloqueo');
  }
  if (f.tipo === 'MECANICA' && !f.causa_falla) x.push('Causa de la intervención');
  if (!String(f.causa_intervencion || '').trim()) x.push(f.tipo === 'MECANICA' ? 'Causa detallada (título)' : 'Causa de la intervención');
  if ((f.lubricantes || []).some(l => l.key && !(Number(String(l.cantidad).replace(',', '.')) > 0))) x.push('Litros de cada lubricante');
  if (!String(f.descripcion || '').trim()) x.push('Descripción de lo realizado');
  if (!f.mecanicos.some(m => String(m.nombre).trim())) x.push('Nombre del mecánico');
  if (!f.mecanicos[0]?.firma) x.push('Firma del mecánico responsable');
  if (f.modo == null && f.bloqueo && !f.registro_bloqueo) x.push('Registro de bloqueo');
  if (f.supervisor?.modo === 'AHORA' && (!String(f.supervisor.nombre || '').trim() || !f.supervisor.firma)) x.push('Nombre y firma del supervisor');
  return x;
};

const filaDB = (f) => ({
  tipo: f.tipo, afi: limpiarAfi(f.afi), equipo: f.equipo || null, fecha: normalizarFecha(f.fecha) || hoyISO(),
  horometro: Number(String(f.horometro).replace(/\./g, '').replace(',', '.')) || null,
  turno: f.turno || null, lugar: String(f.lugar || '').trim() || null,
  hora_falla: f.hora_falla || null, hora_inicio: f.hora_inicio || null, hora_termino: f.hora_termino || null,
  uso_art: Boolean(f.uso_art), bloqueo: Boolean(f.bloqueo),
  mecanicos: (f.mecanicos || []).filter(m => String(m.nombre || '').trim()),
  causa_intervencion: String(f.causa_intervencion || '').trim() || null, descripcion: String(f.descripcion || '').trim() || null,
  interferencia: String(f.interferencia || '').trim() || null, causa_falla: String(f.causa_falla || '').trim() || null,   // MECÁNICA: causa de la lista · ELÉCTRICA: razón de la falla
  lubricantes: (f.lubricantes || []).filter(l => l.key || String(l.tipo || '').trim()),
  usuario_arriendo: String(f.usuario_arriendo || '').trim() || null, operador: String(f.operador || '').trim() || null,
  vale_consumo: String(f.vale_consumo || '').trim() || null,
  registro_bloqueo: f.bloqueo && f.modo == null ? f.registro_bloqueo : null,   // 2026-11-18: formato nuevo = foto del papel
  ...(f.modo ? {   // 2026-11-18 (sql/intervencion_fallas.sql)
    modo: f.modo, fecha_termino: normalizarFecha(f.fecha_termino) || null, terminado: Boolean(f.terminado), duracion_min: duracionMin(f),
    fallas: f.modo === 'INSPECCION' ? (f.fallas || []).filter(i => String(i.descripcion || '').trim()).map((i, k) => ({
      n: k + 1, id: i.id || null, descripcion: String(i.descripcion).trim(), sistema: i.sistema || '',
      necesita_repuesto: Boolean(i.necesita_repuesto), repuesto: i.necesita_repuesto ? String(i.repuesto || '').trim() : '', cantidad: i.necesita_repuesto ? String(i.cantidad || '').trim() : '',
      codigo_repuesto: i.necesita_repuesto ? String(i.codigo_repuesto || '').trim() : '', serie_motor: String(i.serie_motor || '').trim(), fotos: (i.fotos || []).filter(Boolean)
    })) : [],
    falla_id: f.modo === 'REPARACION' ? (f.falla_id || null) : null, falla_texto: f.modo === 'REPARACION' ? (f.falla_texto || null) : null,
    levantamiento_id: f.modo === 'REPARACION' ? (f.levantamiento_id || null) : null,
    fecha_falla: normalizarFecha(f.fecha_falla) || null,
    art_fotos: f.uso_art ? (f.art_fotos || []).filter(Boolean) : [], bloqueo_foto: f.bloqueo ? (f.bloqueo_foto || null) : null
  } : {}),
  updated_at: new Date().toISOString()
});

export const enviando = ref(false);
/** Envía desde la app. Si el supervisor firmó ahí mismo, pasa directo al Historial. */
export const enviarIntervencion = async () => {
  const f = formInt.value;
  const falta = faltantes(f);
  if (falta.length) return alert('Falta completar:\n• ' + falta.join('\n• '));
  enviando.value = true;
  try {
    const fila = filaDB(f);
    const esLev = f.modo === 'INSPECCION';   // el levantamiento se CREA sin firmas (las llevan las reparaciones)
    const conFirma = !esLev && f.supervisor?.modo === 'AHORA';
    if (esLev) { fila.hora_inicio = null; fila.hora_termino = null; fila.fecha_termino = null; fila.duracion_min = null; fila.lubricantes = []; fila.uso_art = false; fila.bloqueo = false; fila.art_fotos = []; fila.bloqueo_foto = null; fila.terminado = true; }
    fila.supervisor = conFirma ? { nombre: f.supervisor.nombre.trim(), empresa: String(f.supervisor.empresa || '').trim(), tipo: f.supervisor.tipo || 'CLIENTE', firma: f.supervisor.firma, fecha: new Date().toISOString() } : null;
    fila.estado = esLev ? 'LEVANTAMIENTO' : conFirma ? 'FIRMADA' : 'PENDIENTE_FIRMA';
    fila.motivo_rechazo = null;
    let reg;
    if (f.id) reg = (await sb(supabaseClient.from(TABLA_MEC).update(fila).eq('id', f.id).select()))[0];
    else reg = (await sb(supabaseClient.from(TABLA_MEC).insert([{ ...fila, creado_por: usuarioActivo.value?.usuario || null }]).select()))[0];
    // Fallas del equipo (2026-11-18): la inspección las deja abiertas · la reparación cierra la elegida
    let avisoFallas = '';
    if (reg && f.modo === 'INSPECCION' && fila.fallas.length) {
      try {
        const conId = await crearFallasDeInspeccion(reg, fila.fallas);
        await sb(supabaseClient.from(TABLA_MEC).update({ fallas: conId }).eq('id', reg.id));
        reg.fallas = conId;
        avisoFallas = ` ${conId.length} falla(s) quedaron abiertas en el equipo.`;
        // el equipo queda FUERA DE SERVICIO hasta reparar todas las fallas del levantamiento
        try { const d = await sb(supabaseClient.rpc('frc_levantamiento_fs', { p_id: reg.id })); if (d) { reg.disp_anterior = reg.disp_anterior || 'SI'; dispLocal(reg.afi, d); avisoFallas += ' El equipo quedó FUERA DE SERVICIO.'; } }
        catch (err) { console.warn('[Mecánicos] No se pudo dejar fuera de servicio:', errMsg(err)); }
      } catch (err) { alert((/intervencion_id|tipo_intervencion|reparacion_id|null value|column|schema cache/i.test(errMsg(err)) ? SQL_FALLAS + '\n\n' : '') + 'El report se envió, pero las fallas no quedaron en el equipo: ' + errMsg(err)); }
    }
    if (reg && f.modo === 'REPARACION' && f.falla_id && fallaPorId(f.falla_id)?.estado !== 'REPARADO') {
      try {
        const d = await marcarFallaReparada(f.falla_id, reg); avisoFallas = ' La falla quedó reparada en el equipo.';
        if (d) { dispLocal(reg.afi, d); avisoFallas += ` Levantamiento completo: el equipo volvió a "${d}".`; }
      }
      catch (err) { alert((/frc_falla_reparada|function|schema cache/i.test(errMsg(err)) ? SQL_FALLAS + '\n\n' : '') + 'El report se envió, pero la falla no se marcó reparada: ' + errMsg(err)); }
    }
    try { localStorage.removeItem(BORRADOR()); } catch (e) { /* */ }
    formInt.value = null;
    if (esLev) {   // vuelve al equipo: ahí aparece la carpeta del levantamiento con sus fallas y el botón Reparar
      if (reg && !dbMec.value.some(x => x.id === reg.id)) dbMec.value = [reg, ...dbMec.value];
      tabApp.value = 'equipos';
      avisoApp(`Levantamiento N° ${reg?.id || ''} creado ✔` + avisoFallas + ' Repáralas desde su carpeta.');
      await cargarMec();
      return;
    }
    equipoSel.value = null; tabApp.value = 'registros';   // vuelve a "Mis documentos"
    carpetaApp.value = fila.estado === 'FIRMADA' ? 'REALIZADOS' : 'SIN_FIRMA';

    if (conFirma && reg) {
      const ok = await pasarAHistorial(reg);
      avisoApp((ok ? '¡Enviada y guardada en el Historial! ✔' : 'Enviada. Quedó firmada; se pasará al Historial desde el panel.') + avisoFallas);
    } else {
      avisoApp('¡Enviada! Queda pendiente la firma del supervisor.' + avisoFallas);
    }
    await cargarMec();
  } catch (err) {
    const m = errMsg(err);
    alert(/'(modo|fallas|falla_id|falla_texto|fecha_termino|terminado|duracion_min|levantamiento_id|art_fotos|bloqueo_foto|codigo_repuesto|serie_motor|fecha_falla|disp_anterior)'/i.test(m) ? SQL_FALLAS : /bd_mec_intervenciones|schema cache|does not exist/i.test(m) ? 'Falta ejecutar sql/mecanicos.sql en Supabase.' : 'No se pudo enviar: ' + m);
  } finally { enviando.value = false; }
};

// ---------- PDF con el formato oficial ----------
const cargarScript = (url, global) => (window[global] ? Promise.resolve(window[global]) : new Promise((ok, mal) => {
  const s = document.createElement('script'); s.src = url; s.onload = () => ok(window[global]); s.onerror = () => mal(new Error('No se pudo cargar ' + url)); document.head.appendChild(s);
}));
const libsPDF = async () => {
  await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas');
  await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf');
  return { html2canvas: window.html2canvas, jsPDF: window.jspdf.jsPDF };
};
const renderHTML = async (html, ancho, html2canvas) => {
  const box = document.createElement('div');
  box.style.cssText = `position:fixed;left:-${ancho + 200}px;top:0;width:${ancho}px;background:#fff;z-index:-1`;
  box.innerHTML = html;
  document.body.appendChild(box);
  await Promise.all([...box.querySelectorAll('img')].map(i => (i.complete ? null : new Promise(r => { i.onload = i.onerror = r; }))));
  try { return await html2canvas(box.firstElementChild, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false }); }
  finally { box.remove(); }
};
const imagenDataURL = (url) => new Promise((ok, mal) => {
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); ok({ url: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height }); };
  img.onerror = () => mal(new Error('No se pudo leer la foto'));
  img.src = url;
});
/** Genera el PDF (hoja de intervención + registro de bloqueo si corresponde). Devuelve un Blob. */
export const generarPDF = async (r) => {
  const { html2canvas, jsPDF } = await libsPDF();
  const logo = (await logoDataURL())?.url || '';
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const c1 = await renderHTML(hojaIntervencion(r, logo), ANCHO_VERTICAL, html2canvas);
  const w1 = 210, h1 = Math.min(297, c1.height * w1 / c1.width);
  pdf.addImage(c1.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w1, h1);
  if (r.bloqueo && r.registro_bloqueo) {
    const c2 = await renderHTML(hojaBloqueo(r, logo), ANCHO_HORIZONTAL, html2canvas);
    pdf.addPage('a4', 'landscape');
    const w2 = 297, h2 = Math.min(210, c2.height * w2 / c2.width);
    pdf.addImage(c2.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w2, h2);
  }
  // Fotos de los papeles (2026-11-18): ART (2 hojas) y registro de bloqueo, una por página
  const fotos = [...(r.modo === 'INSPECCION' ? (r.fallas || []).flatMap(i => (i.fotos || []).map((u, k) => [u, `Falla ${i.n} · foto ${k + 1} · ${String(i.descripcion || '').slice(0, 60)}`])) : []), ...(r.uso_art ? (r.art_fotos || []).map((u, i) => [u, `ART · hoja ${i + 1}`]) : []), ...(r.bloqueo && r.bloqueo_foto ? [[r.bloqueo_foto, 'Registro de bloqueo FRC-RE-OP-015']] : [])].filter(x => x[0]);
  for (const [url, titulo] of fotos) {
    try {
      const img = await imagenDataURL(url);
      pdf.addPage('a4', 'portrait');
      pdf.setFontSize(11); pdf.text(`${titulo} · AFI ${r.afi} · report N° ${r.id || ''}`, 10, 10);
      const k = Math.min(190 / img.w, 272 / img.h);
      pdf.addImage(img.url, 'JPEG', (210 - img.w * k) / 2, 15, img.w * k, img.h * k);
    } catch (e) { console.warn('[Mecánicos] Foto no agregada al PDF', e); }
  }
  return pdf.output('blob');
};
export const descargarPDF = async (r) => {
  try {
    const blob = await generarPDF(r);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${r.modo === 'INSPECCION' ? 'Levantamiento de fallas ' + (r.tipo === 'ELECTRICA' ? 'electrico' : 'mecanico') : 'Intervencion ' + (r.tipo === 'ELECTRICA' ? 'electrica' : 'mecanica')} AFI ${r.afi} ${r.fecha || ''}.pdf`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch (err) { alert('No se pudo generar el PDF: ' + errMsg(err)); }
};

// ---------- Paso al Historial ----------
const CAUSA_HIST_MEC = { 'FALLA MECANICA': 'FALLA MECANICA', 'FALLA OPERACIONAL': 'FALLA OPERACIONAL', ACCIDENTE: 'DAÑO OPERACIÓN', 'CONDICION DE LA OPERACION': 'FALLA CONDICION' };
const CAUSA_HIST_ELEC = { 'FALLA OPERACIONAL': 'FALLA ELECTRICA', 'PUESTA EN MARCHA': 'PUESTA EN MARCHA', 'CONEXIÓN/DESCONEXIÓN DE EQUIPO': 'CONEXIÓN/DESCONEXION', 'INSPECCIÓN': 'INSPECCION (ELECTRICA)', 'PRUEBAS MEDICIONES': 'PRUEBAS MEDICIONES' };
// MECÁNICA (2026-11-13): causa_falla guarda la CAUSA elegida de la lista del Historial (REPARACION, IMPLEMENTACION…)
// y causa_intervencion la RAZÓN de la causa (título corto). Registros antiguos: ACCIDENTE/… → equivalente.
const causaHistorial = (r) => (r.tipo === 'ELECTRICA' ? (CAUSA_HIST_ELEC[String(r.causa_intervencion || '').toUpperCase()] || 'FALLA ELECTRICA') : (CAUSA_HIST_MEC[r.causa_falla] && !listaCausas.includes(r.causa_falla) ? CAUSA_HIST_MEC[r.causa_falla] : (r.causa_falla || 'REPARACION')));

/** Crea el registro del Historial con la hoja en PDF. Devuelve true si quedó EN_HISTORIAL. */
export const pasarAHistorial = async (r) => {
  if (r.estado === 'EN_HISTORIAL') return true;
  try {
    // 1) PDF con el formato y se sube al almacenamiento
    let url = r.documento_url || '';
    if (!url) {
      const blob = await generarPDF(r);
      const nombre = `intervenciones_app/${String(r.afi).replace(/[^\w-]/g, '')}_${r.fecha || hoyISO()}_${r.tipo}_${r.id}.pdf`;
      url = await subirArchivoStorage(nombre, new File([blob], nombre.split('/').pop(), { type: 'application/pdf' }));
    }
    // 2) Registro en el Historial
    const mecs = (r.mecanicos || []).map(m => m.nombre);
    // Lubricantes de la lista → columnas de aceites del Historial (litros); otros → al texto
    const aceites = {};
    (r.lubricantes || []).forEach(l => { const a = ACEITES.find(x => x.key === l.key); const v = Number(String(l.cantidad || '').replace(',', '.')) || 0; if (a && v) aceites[a.col] = (aceites[a.col] || 0) + v; });
    const extras = [
      ...(r.lubricantes || []).filter(l => !ACEITES.some(x => x.key === l.key) && l.tipo).map(l => `Lubricante: ${l.tipo}${l.cantidad ? ' (' + l.cantidad + ')' : ''}`),
      r.operador ? `Operador: ${r.operador}` : '', r.vale_consumo ? `Vale de consumo N° ${r.vale_consumo}` : ''
    ].filter(Boolean);
    const payload = {
      afi: limpiarAfi(r.afi), fecha: r.fecha, equipo: (dbEquipos.value.find(e => mismoAfi(e.afi, r.afi)) || {}).tipo || r.equipo || '',
      lugar: r.lugar || '', tipo_documento: 'INTERVENCION', causa: causaHistorial(r),
      tipo_mantencion: r.tipo === 'ELECTRICA' ? 'INTERVENCION ELECTRICA' : 'INTERVENCION MECANICA',
      horometro: Number(r.horometro) || null,
      mecanico_1: mecs[0] || '', mecanico_2: mecs[1] || '', mecanico_3: mecs[2] || '', mecanico_4: mecs[3] || '',
      bloqueo_de_equipo: r.bloqueo ? 'SI' : 'NO', hora_falla: r.hora_falla || '', hora_inicio: r.hora_inicio || '', hora_termino: r.hora_termino || '',
      hora_total: r.duracion_min != null ? String(Math.round(r.duracion_min / 6) / 10) : String(calcularRestaHoras(r.hora_inicio, r.hora_termino) || ''),
      causa_intervencion: r.modo === 'INSPECCION' ? `LEVANTAMIENTO DE FALLAS (${(r.fallas || []).length})` : (r.tipo === 'ELECTRICA' ? (r.causa_falla || r.causa_intervencion) : r.causa_intervencion) || '', descripcion: [r.modo === 'INSPECCION' ? 'OBSERVACIÓN: ' + (r.descripcion || '') : (r.descripcion || ''),
        ...(r.modo === 'INSPECCION' ? (r.fallas || []).map(i => `Falla ${i.n}: ${i.sistema ? i.sistema + ' · ' : ''}${i.descripcion}`) : []),
        r.modo === 'REPARACION' && r.falla_texto ? 'Falla reparada: ' + r.falla_texto + (r.levantamiento_id ? ` (levantamiento de fallas N° ${r.levantamiento_id})` : '') : '',
        r.fecha_termino && r.fecha_termino !== r.fecha ? `Término: ${r.fecha_termino} ${r.hora_termino || ''}` : '', ...extras].filter(Boolean).join('\n'),
      interferencia: r.interferencia || '', empresa: r.usuario_arriendo || '', link: url,
      art: r.uso_art ? 'SI' : 'NO', numero_folio: `APP-${r.id}`,
      causa_falla: r.tipo === 'MECANICA' && ['ACCIDENTE', 'FALLA OPERACIONAL', 'CONDICION DE LA OPERACION', 'FALLA MECANICA'].includes(r.causa_falla) ? r.causa_falla : '',
      ...aceites
    };
    let data;
    try { data = await sb(supabaseClient.from(TABLAS.HISTORIAL).insert([payload]).select('id')); }
    catch (err) {
      if (!/'(art|numero_folio|causa_falla)'|column/i.test(errMsg(err))) throw err;
      const p = { ...payload }; delete p.art; delete p.numero_folio; delete p.causa_falla;
      data = await sb(supabaseClient.from(TABLAS.HISTORIAL).insert([p]).select('id'));
    }
    await sb(supabaseClient.from(TABLA_MEC).update({ estado: 'EN_HISTORIAL', historial_id: data?.[0]?.id || null, documento_url: url, updated_at: new Date().toISOString() }).eq('id', r.id));
    Object.assign(r, { estado: 'EN_HISTORIAL', historial_id: data?.[0]?.id || null, documento_url: url });
    cargarDatosDesdeSupabase(['historial']);
    return true;
  } catch (err) {
    console.warn('[Mecánicos] No pasó al Historial:', err);
    alert('La intervención quedó firmada, pero no se pudo pasar al Historial: ' + errMsg(err) + '\nSe puede reintentar desde el panel MECÁNICOS.');
    return false;
  }
};

// ---------- Panel del supervisor ----------
export const filtroPanel = ref('PENDIENTE_FIRMA');
export const listaPanel = computed(() => dbMec.value.filter(r => (!filtroPanel.value || r.estado === filtroPanel.value) && (!carpetaPanel.value || participa(r, carpetaPanel.value))));
export const conteoPanel = computed(() => {
  const c = { PENDIENTE_FIRMA: 0, FIRMADA: 0, EN_HISTORIAL: 0, RECHAZADA: 0 };
  dbMec.value.forEach(r => { c[r.estado] = (c[r.estado] || 0) + 1; });
  return c;
});
export const regPanel = ref(null);      // intervención abierta en el panel (copia editable)
export const firmaPanel = ref({ nombre: '', empresa: 'FAST RENTAL CHILE', tipo: 'FRC', firma: '' });
export const abrirRegPanel = (r) => {
  regPanel.value = JSON.parse(JSON.stringify(r));
  firmaPanel.value = { nombre: usuarioActivo.value?.nombre || '', empresa: 'FAST RENTAL CHILE', tipo: 'FRC', firma: '' };
};
export const procesando = ref(false);
export const firmarYPasar = async () => {
  const r = regPanel.value; const fp = firmaPanel.value;
  if (!esSupervisorMec.value) return alert('Solo el supervisor o el Admin puede firmar.');
  if (!String(fp.nombre).trim() || !fp.firma) return alert('Escribe tu nombre y firma.');
  procesando.value = true;
  try {
    const cambios = {
      ...filaDB({ ...r, horometro: String(r.horometro || '') }),
      supervisor: { nombre: fp.nombre.trim(), empresa: fp.empresa, tipo: fp.tipo, firma: fp.firma, fecha: new Date().toISOString(), usuario: usuarioActivo.value?.usuario },
      estado: 'FIRMADA'
    };
    await sb(supabaseClient.from(TABLA_MEC).update(cambios).eq('id', r.id));
    Object.assign(r, cambios);
    if (await pasarAHistorial(r)) { regPanel.value = null; alert('Firmada y guardada en el Historial ✔'); }
    await cargarMec();
  } catch (err) { alert('No se pudo firmar: ' + errMsg(err)); }
  finally { procesando.value = false; }
};
export const reintentarHistorial = async (r) => { procesando.value = true; try { if (await pasarAHistorial(r)) await cargarMec(); } finally { procesando.value = false; } };
export const rechazarReg = async (r) => {
  const motivo = prompt('¿Qué debe corregir el mecánico?');
  if (motivo === null) return;
  try {
    await sb(supabaseClient.from(TABLA_MEC).update({ estado: 'RECHAZADA', motivo_rechazo: motivo, updated_at: new Date().toISOString() }).eq('id', r.id));
    regPanel.value = null; await cargarMec();
  } catch (err) { alert('Error: ' + errMsg(err)); }
};
export const eliminarReg = async (r) => {
  if (!esSupervisorMec.value) return;
  if (r.modo === 'INSPECCION') return borrarLevantamiento(r);
  if (!confirm(`¿Eliminar la intervención N° ${r.id} (AFI ${r.afi})? No borra el registro del Historial si ya pasó.`)) return;
  try { await sb(supabaseClient.from(TABLA_MEC).delete().eq('id', r.id)); regPanel.value = null; await cargarMec(); }
  catch (err) { alert('Error: ' + errMsg(err)); }
};
/** HTML de la hoja para verla en pantalla. */
/** Formato oficial EN BLANCO (sin datos) para Formatos › Nuevos documentos creados. tipo: MECANICA | ELECTRICA | BLOQUEO */
export const descargarFormatoVacio = async (tipo) => {
  try {
    const { html2canvas, jsPDF } = await libsPDF();
    const logo = (await logoDataURL())?.url || '';
    const r = { tipo: tipo === 'ELECTRICA' ? 'ELECTRICA' : 'MECANICA', mecanicos: [], lubricantes: [], registro_bloqueo: bloqueoVacio() };
    const horizontal = tipo === 'BLOQUEO';
    const pdf = new jsPDF({ orientation: horizontal ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    const c = await renderHTML(horizontal ? hojaBloqueo(r, logo) : hojaIntervencion(r, logo), horizontal ? ANCHO_HORIZONTAL : ANCHO_VERTICAL, html2canvas);
    const W = horizontal ? 297 : 210, Hmax = horizontal ? 210 : 297;
    pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, W, Math.min(Hmax, c.height * W / c.width));
    const nombre = { MECANICA: 'INTERVENCION MECANICA FRC-RE-OPE-017', ELECTRICA: 'INTERVENCION ELECTRICA IE-FRC', BLOQUEO: 'REGISTRO DE BLOQUEO FRC-RE-OP-015' }[tipo];
    const a = document.createElement('a'); a.href = URL.createObjectURL(pdf.output('blob')); a.download = nombre + ' (en blanco).pdf'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch (err) { alert('No se pudo generar el formato: ' + errMsg(err)); }
};

export const htmlHoja = (r, logo = '') => hojaIntervencion(r, logo);
export const htmlBloqueo = (r, logo = '') => hojaBloqueo(r, logo);

/** TIEMPOS DE TRABAJO (2026-11-18): Excel con cada report (inspección / reparación), inicio, término y cuánto demoró. */
export const exportarTiempos = () => {
  if (!window.XLSX) return alert('No se cargó la librería Excel. Actualiza la página.');
  const filas = dbMec.value.slice().sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || ''))).map(r => {
    const min = r.duracion_min != null ? r.duracion_min : duracionMin({ ...r, fecha_termino: r.fecha_termino || r.fecha });
    return {
      'N° report': r.id, Tipo: r.tipo === 'ELECTRICA' ? 'Eléctrica' : 'Mecánica',
      Trabajo: r.modo === 'INSPECCION' ? 'Levantamiento de fallas' : r.modo === 'REPARACION' ? 'Reparación' : 'Intervención (formato antiguo)',
      AFI: r.afi, Equipo: r.equipo || '', Lugar: r.lugar || '',
      'Falla / título': r.modo === 'INSPECCION' ? `${(r.fallas || []).length} falla(s) encontradas` : (r.tipo === 'ELECTRICA' ? r.causa_falla : r.causa_intervencion) || '',
      'Fallas encontradas': r.modo === 'INSPECCION' ? (r.fallas || []).map(i => `${i.n}. ${i.descripcion}`).join(' | ') : '',
      'Fecha inicio': r.fecha || '', 'Hora inicio': r.hora_inicio || '', 'Fecha término': r.fecha_termino || r.fecha || '', 'Hora término': r.hora_termino || '',
      'Duración (min)': min ?? '', 'Duración (h)': min != null ? Math.round(min / 6) / 10 : '',
      Mecánicos: (r.mecanicos || []).map(m => m.nombre).filter(Boolean).join(', '), Terminado: r.terminado ? 'Sí' : '', Estado: (ESTADOS_MEC[r.estado] || {}).t || r.estado || ''
    };
  });
  const ws = window.XLSX.utils.json_to_sheet(filas);
  ws['!cols'] = Object.keys(filas[0] || { a: 1 }).map(k => ({ wch: Math.max(10, Math.min(45, k.length + 4)) }));
  const wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, 'Tiempos de trabajo');
  window.XLSX.writeFile(wb, `Tiempos de trabajo mecanicos ${hoyISO()}.xlsx`);
};

// ---------- ENLACE LEVANTAMIENTO ↔ REPARACIONES (2026-11-18) ----------
/** Report de levantamiento de una reparación (o null). */
export const levantamientoDe = (r) => {
  if (!r || r.modo !== 'REPARACION') return null;
  const id = r.levantamiento_id || (fallaPorId(r.falla_id) || {}).intervencion_id;
  return id ? dbMec.value.find(x => String(x.id) === String(id)) || { id, noCargado: true } : null;
};
/** Fallas de un levantamiento con su estado actual y los reports de reparación que las cerraron. */
export const fallasDeLevantamiento = (r) => (r && r.modo === 'INSPECCION' ? (r.fallas || []).map(i => {
  const h = i.id ? fallaPorId(i.id) : null;
  const reps = dbMec.value.filter(x => x.modo === 'REPARACION' && i.id && String(x.falla_id) === String(i.id)).sort((a, b) => a.id - b.id);
  const estado = h ? h.estado : (reps.length ? 'REPARADO' : 'PENDIENTE');
  return { ...i, estado, reparaciones: reps, reparado_por: h?.reparado_por || '', reparado_at: h?.reparado_at || '' };
}) : []);
/** "2/3" reparadas de un levantamiento. */
export const avanceLevantamiento = (r) => { const l = fallasDeLevantamiento(r); return { total: l.length, listas: l.filter(x => x.estado === 'REPARADO').length }; };

// ---------- DISPONIBILIDAD Y BORRADO DE LEVANTAMIENTOS (2026-11-18) ----------
/** Cambia la disponibilidad del equipo en memoria (la base ya la cambió la función del servidor). */
export const dispLocal = (afi, disp) => { const e = dbEquipos.value.find(x => mismoAfi(x.afi, afi)); if (e && disp) e.disponibilidad = disp; if (equipoSel.value && mismoAfi(equipoSel.value.afi, afi) && disp) equipoSel.value.disponibilidad = disp; };
/** Admin: borra un levantamiento sin reparaciones (y sus fallas); devuelve la disponibilidad si lo había dejado fuera de servicio. */
export const borrarLevantamiento = async (r) => {
  if (!esSupervisorMec.value) return alert('Solo un Admin puede borrar un levantamiento.');
  if (!confirm(`¿Borrar el levantamiento de fallas N° ${r.id} (AFI ${r.afi}) y sus ${(r.fallas || []).length} falla(s)?\nTambién se quitan de Repuestos pedidos.`)) return false;
  try {
    const d = await sb(supabaseClient.rpc('frc_levantamiento_borrar', { p_id: r.id }));
    dbMec.value = dbMec.value.filter(x => x.id !== r.id);
    dbProblemasRef().value = dbProblemasRef().value.filter(h => String(h.intervencion_id) !== String(r.id));
    if (d) dispLocal(r.afi, d);
    if (regPanel.value && regPanel.value.id === r.id) regPanel.value = null;
    avisoApp(`Levantamiento N° ${r.id} borrado.` + (d ? ` El equipo volvió a "${d}".` : ''));
    return true;
  } catch (err) {
    const m = errMsg(err);
    alert(/frc_levantamiento_borrar|function|schema cache/i.test(m) ? SQL_FALLAS : 'No se pudo borrar: ' + m);
    return false;
  }
};

