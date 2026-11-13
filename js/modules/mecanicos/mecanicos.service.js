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
import { usuarioActivo, dbEquipos, dbIntervenciones, dbUsuarios, nivelEnArea, esAdminGeneral, cargarDatosDesdeSupabase, permisosDe } from '../../core/store.js';
import { hoyISO, limpiarAfi, mismoAfi, normalizarFecha, calcularRestaHoras } from '../../core/utils.js';
import { esVehiculo, empresaDe, EMPRESA_TALLER } from '../inventario/inventario.mapper.js';
import { logoDataURL } from '../../core/excel.js';
import { listaCausas } from '../historial/historial.service.js';
import { ACEITES } from '../historial/historial.mapper.js';
import { hojaIntervencion, hojaBloqueo, bloqueoVacio, ANCHO_VERTICAL, ANCHO_HORIZONTAL, TIPOS_EQUIPO_BLOQUEO } from './hojas.js';

const { ref, computed } = Vue;
export const TABLA_MEC = TABLAS.MEC_INTERVENCIONES;

// ---------- Quién es quién ----------
const nivelMec = (u = usuarioActivo.value) => (u ? (u.rol === 'admin' ? 'admin' : (permisosDe(u).mecanicos || 'lectura')) : 'lectura');
/** Mecánico "puro": entra directo a la app móvil. */
export const esModoMecanico = computed(() => {
  const u = usuarioActivo.value;
  return Boolean(u && u.rol !== 'admin' && nivelMec(u) === 'subadmin');
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

// ---------- Equipos ----------
export const busquedaEq = ref('');
const up = (s) => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const equiposApp = computed(() => {
  const q = up(busquedaEq.value).replace(/\s+/g, ' ');
  return dbEquipos.value
    .filter(e => !esVehiculo(e) && String(e.disponibilidad || '').toUpperCase() !== 'VENTA')
    .filter(e => !q || up([e.afi, e.tipo, e.marca, e.modelo, e.ubicacion, empresaDe(e)].join(' ')).includes(q))
    .sort((a, b) => ((empresaDe(b) === EMPRESA_TALLER) - (empresaDe(a) === EMPRESA_TALLER))
      || String(a.afi).localeCompare(String(b.afi), undefined, { numeric: true }));
});
export const equipoSel = ref(null);
/** Pestaña de la app: 'equipos' | 'registros' | 'tareas'. */
export const tabApp = ref('equipos');
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
    await cargarDatosDesdeSupabase(['inventario']);
    equipoSel.value = dbEquipos.value.find(x => mismoAfi(x.afi, e.afi)) || null;
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
export const esRealizado = (r) => r.estado === 'EN_HISTORIAL';
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
  PENDIENTE_FIRMA: { t: 'Falta firma supervisor', c: 'bg-amber-100 text-amber-800 border-amber-300', i: 'fa-hourglass-half' },
  FIRMADA: { t: 'Firmada (pasando al Historial)', c: 'bg-sky-100 text-sky-800 border-sky-300', i: 'fa-signature' },
  EN_HISTORIAL: { t: 'En el Historial', c: 'bg-emerald-100 text-emerald-800 border-emerald-300', i: 'fa-circle-check' },
  RECHAZADA: { t: 'Rechazada · corregir', c: 'bg-rose-100 text-rose-800 border-rose-300', i: 'fa-rotate-left' }
};

// ---------- Formulario (app) ----------
const BORRADOR = () => 'frc_mec_borrador_' + String(usuarioActivo.value?.usuario || '').toLowerCase();
const horaAhora = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export { horaAhora };
export const nuevaIntervencion = (tipo, e) => ({
  id: null, tipo, afi: String(e.afi), equipo: [e.tipo, e.marca, e.modelo].filter(Boolean).join(' '),
  fecha: hoyISO(), horometro: e.horometros?.hTomado ? String(e.horometros.hTomado) : '', turno: new Date().getHours() >= 20 || new Date().getHours() < 8 ? 'NOCHE' : 'DÍA',
  lugar: enTaller(e) ? 'TALLER FRC' : (e.ubicacion || empresaDe(e) || ''), hora_falla: '', hora_inicio: horaAhora(), hora_termino: '',
  uso_art: false, bloqueo: false,
  mecanicos: [{ nombre: usuarioActivo.value?.nombre || usuarioActivo.value?.usuario || '', usuario: usuarioActivo.value?.usuario || '', firma: '' }],
  causa_intervencion: '', descripcion: '', interferencia: '', causa_falla: '',
  lubricantes: [], usuario_arriendo: enTaller(e) ? '' : (empresaDe(e) || ''), operador: '', vale_consumo: '',
  registro_bloqueo: null,
  supervisor: { modo: 'DESPUES', nombre: '', empresa: '', tipo: 'CLIENTE', firma: '' }
});
export const formInt = ref(null);       // intervención en edición (app)
export const pasoInt = ref(1);
export const abrirIntervencion = (tipo, e) => {
  let b = null; try { b = JSON.parse(localStorage.getItem(BORRADOR()) || 'null'); } catch (x) { b = null; }
  if (b && b.afi === String(e.afi) && b.tipo === tipo && confirm('Tienes un borrador sin enviar de este equipo. ¿Seguir con ese borrador?')) formInt.value = b;
  else formInt.value = nuevaIntervencion(tipo, e);
  pasoInt.value = 1;
};
export const editarRegistro = (r) => {
  formInt.value = { ...JSON.parse(JSON.stringify(r)), horometro: r.horometro ? String(r.horometro) : '', supervisor: { modo: 'DESPUES', nombre: '', empresa: '', tipo: 'CLIENTE', firma: '' } };
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
  if (!f.hora_inicio) x.push('Hora inicio');
  if (!f.hora_termino) x.push('Hora término');
  if (f.tipo === 'MECANICA' && !f.causa_falla) x.push('Causa de la intervención');
  if (!String(f.causa_intervencion || '').trim()) x.push(f.tipo === 'MECANICA' ? 'Causa detallada (título)' : 'Causa de la intervención');
  if ((f.lubricantes || []).some(l => l.key && !(Number(String(l.cantidad).replace(',', '.')) > 0))) x.push('Litros de cada lubricante');
  if (!String(f.descripcion || '').trim()) x.push('Descripción de lo realizado');
  if (!f.mecanicos.some(m => String(m.nombre).trim())) x.push('Nombre del mecánico');
  if (!f.mecanicos[0]?.firma) x.push('Firma del mecánico responsable');
  if (f.bloqueo && !f.registro_bloqueo) x.push('Registro de bloqueo');
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
  registro_bloqueo: f.bloqueo ? f.registro_bloqueo : null,
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
    const conFirma = f.supervisor?.modo === 'AHORA';
    fila.supervisor = conFirma ? { nombre: f.supervisor.nombre.trim(), empresa: String(f.supervisor.empresa || '').trim(), tipo: f.supervisor.tipo || 'CLIENTE', firma: f.supervisor.firma, fecha: new Date().toISOString() } : null;
    fila.estado = conFirma ? 'FIRMADA' : 'PENDIENTE_FIRMA';
    fila.motivo_rechazo = null;
    let reg;
    if (f.id) reg = (await sb(supabaseClient.from(TABLA_MEC).update(fila).eq('id', f.id).select()))[0];
    else reg = (await sb(supabaseClient.from(TABLA_MEC).insert([{ ...fila, creado_por: usuarioActivo.value?.usuario || null }]).select()))[0];
    try { localStorage.removeItem(BORRADOR()); } catch (e) { /* */ }
    formInt.value = null; equipoSel.value = null; tabApp.value = 'registros';   // vuelve a "Mis documentos"
    carpetaApp.value = fila.estado === 'FIRMADA' ? 'REALIZADOS' : 'SIN_FIRMA';

    if (conFirma && reg) {
      const ok = await pasarAHistorial(reg);
      avisoApp(ok ? '¡Enviada y guardada en el Historial! ✔' : 'Enviada. Quedó firmada; se pasará al Historial desde el panel.');
    } else {
      avisoApp('¡Enviada! Queda pendiente la firma del supervisor.');
    }
    await cargarMec();
  } catch (err) {
    alert(/bd_mec_intervenciones|schema cache|does not exist/i.test(errMsg(err)) ? 'Falta ejecutar sql/mecanicos.sql en Supabase.' : 'No se pudo enviar: ' + errMsg(err));
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
  return pdf.output('blob');
};
export const descargarPDF = async (r) => {
  try {
    const blob = await generarPDF(r);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `Intervencion ${r.tipo === 'ELECTRICA' ? 'electrica' : 'mecanica'} AFI ${r.afi} ${r.fecha || ''}.pdf`; a.click();
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
      hora_total: String(calcularRestaHoras(r.hora_inicio, r.hora_termino) || ''),
      causa_intervencion: (r.tipo === 'ELECTRICA' ? (r.causa_falla || r.causa_intervencion) : r.causa_intervencion) || '', descripcion: [r.descripcion || '', ...extras].filter(Boolean).join('\n'),
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
