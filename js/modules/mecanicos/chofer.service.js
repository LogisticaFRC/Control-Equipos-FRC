// =====================================================================
// CHOFER · Check list / Report Camión Pluma (FRC-RE-OPE-018) · 2026-11-17
// ---------------------------------------------------------------------
// El chofer (usuarios.permisos.mec_modo = 'chofer') llena desde el celular:
//   · Datos del camión (patente, marca, modelo, fecha, vencimientos revisión técnica / permiso)
//   · Camión: hrs y km inicio / término / próx. mantención · Pluma: hrs inicio / término / próx. mant.
//   · Check list (Bueno / Malo / N/A) de cada ítem del formato
//   · REPORT: hasta 5 actividades (traslado, equipo, AFI, desde, hasta, horas)
//   · Observaciones
// Al enviar (RPC frc_chofer_guardar · sql/chofer.sql):
//   · se guarda en bd_checklist_chofer
//   · cada actividad con AFI queda como MOVIMIENTO (BD_MOVIMIENTOS) con el camión y el chofer
//   · el km de término actualiza el kilometraje del camión (si es mayor)
// El documento se genera rellenando la plantilla original plantillas/CHECKLIST_CAMION_PLUMA.xlsx
// (queda igual al formato).
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { usuarioActivo, dbEquipos, buscarEquipoPorAfi, cargarDatosDesdeSupabase } from '../../core/store.js';
import { hoyISO, formatDateForDisplay, mismoAfi } from '../../core/utils.js';
import { esVehiculo } from '../inventario/inventario.mapper.js';

const { ref, computed } = Vue;

export const TABLA_CHECKLIST = 'bd_checklist_chofer';
const PLANTILLA_URL = 'plantillas/CHECKLIST_CAMION_PLUMA.xlsx';
const SQL_CHOFER = 'Falta ejecutar sql/chofer.sql en Supabase (SQL Editor → Run).';

// ---------- Ítems del check list (fila de la plantilla) ----------
// lado 'I' = columnas F (Bueno) · G (Malo) · J (N/A) · lado 'D' = R (Bueno) · S (Malo) · U (N/A)
const I = (fila, texto, grupo) => ({ k: 'i' + fila, fila, texto, grupo, lado: 'I' });
const D = (fila, texto, grupo) => ({ k: 'd' + fila, fila, texto, grupo, lado: 'D' });
export const ITEMS_CHECK = [
  I(18, 'Nivel aceite motor', 'MOTOR'), I(19, 'Nivel de refrigerante', 'MOTOR'), I(20, 'Estado de batería', 'MOTOR'),
  I(21, 'Nivel de combustible', 'MOTOR'), I(22, 'Nivel de AdBlue', 'MOTOR'),
  I(23, 'Escaleras y pasamanos', 'CABINA'), I(24, 'Alarma de retroceso', 'CABINA'), I(25, 'Bocina', 'CABINA'),
  I(26, 'Cinturones de seguridad', 'CABINA'), I(27, 'Freno de servicio', 'CABINA'), I(28, 'Freno de parqueo', 'CABINA'),
  I(29, 'Freno telma', 'CABINA'), I(30, 'Freno retardador', 'CABINA'), I(31, 'Parabrisas frontal', 'CABINA'),
  I(32, 'Parabrisas trasero', 'CABINA'), I(33, 'Parabrisas lateral', 'CABINA'), I(34, 'Espejos retrovisores laterales', 'CABINA'),
  I(35, 'Espejo retrovisor cabina', 'CABINA'), I(36, 'Limpiaparabrisas', 'CABINA'), I(37, 'Asiento de conductor', 'CABINA'),
  I(38, 'Asiento acompañante', 'CABINA'), I(39, 'GPS', 'CABINA'), I(40, 'Triángulo, botiquín', 'CABINA'),
  I(41, 'Gata, barra, llaves', 'CABINA'),
  I(42, 'Estado de las llantas', 'NEUMÁTICOS'), I(43, 'Seguros indicadores check point', 'NEUMÁTICOS'), I(44, 'Revisión de neumáticos', 'NEUMÁTICOS'),
  D(18, 'Luces altas y bajas', 'LUCES'), D(19, 'Luces de retroceso', 'LUCES'), D(20, 'Luces de emergencia', 'LUCES'),
  D(21, 'Luces de freno', 'LUCES'), D(22, 'Luces intermitentes delanteras y traseras', 'LUCES'), D(23, 'Luces de estacionamiento', 'LUCES'),
  D(24, 'Baliza', 'LUCES'),
  D(25, 'Revisión de fugas hidráulicas', 'CAMIÓN'), D(26, 'Almohadillas', 'CAMIÓN'), D(27, 'Cuñas', 'CAMIÓN'),
  D(28, 'Toma fuerza', 'CAMIÓN'), D(29, 'Tanque de combustible', 'CAMIÓN'), D(30, 'Funcionamiento del motor', 'CAMIÓN'),
  D(31, 'Extintor de incendio 10 kilos PQS', 'CAMIÓN'), D(32, 'Pértiga', 'CAMIÓN'), D(33, 'N° identificación', 'CAMIÓN'),
  D(34, 'Cinta reflectante', 'CAMIÓN'), D(35, 'Estado de flexibles hidráulicos', 'CAMIÓN'),
  D(36, 'Estado de pluma y seguros', 'PLUMA'), D(37, 'Control de mando a distancia (consola)', 'PLUMA'), D(38, 'Controles manuales', 'PLUMA'),
  D(39, 'Gancho de pluma', 'PLUMA'), D(40, 'Señaléticas', 'PLUMA'), D(41, 'Verificar niveles aceite hidráulico', 'PLUMA'),
  D(42, 'Semáforo', 'PLUMA'), D(43, 'Horómetro pluma', 'PLUMA'), D(44, 'Revisión de parada de emergencia', 'PLUMA'),
  D(45, 'Estabilizadores', 'PLUMA')
];
export const GRUPOS_CHECK = [...new Set(ITEMS_CHECK.map(i => i.grupo))];
export const OPCIONES_CHECK = [
  { v: 'B', l: 'Bueno', c: 'bg-emerald-600 text-white border-emerald-600' },
  { v: 'M', l: 'Malo', c: 'bg-rose-600 text-white border-rose-600' },
  { v: 'NA', l: 'N/A', c: 'bg-slate-500 text-white border-slate-500' }
];
export const TIPOS_TRASLADO = ['ENTREGA', 'RETIRO', 'TRASLADO', 'OTRO'];
export const N_ACTIVIDADES_CHOFER = 5;

const actVacia = () => ({ traslado: '', equipo: '', afi: '', cu: '', desde: '', hasta: '', h_ini: '', h_fin: '' });
export const checklistVacio = () => ({
  patente: '', marca: '', modelo: '', fecha: hoyISO(), venc_revision: '', venc_permiso: '',
  cam_hrs_ini: '', cam_hrs_fin: '', cam_hrs_prox: '', km_ini: '', km_fin: '', km_prox: '',
  pluma_hrs_ini: '', pluma_hrs_fin: '', pluma_hrs_prox: '',
  checklist: {}, actividades: Array.from({ length: N_ACTIVIDADES_CHOFER }, actVacia), observaciones: ''
});

// ---------- Camiones (vehículos del inventario = patente) ----------
export const camiones = computed(() => dbEquipos.value.filter(esVehiculo)
  .sort((a, b) => String(a.afi).localeCompare(String(b.afi))));
export const alElegirCamion = (f) => {
  const c = camiones.value.find(x => mismoAfi(x.afi, f.patente));
  if (!c) return;
  f.marca = c.marca || f.marca; f.modelo = c.modelo || f.modelo;
  if (!f.km_ini && Number(c.horometroActual) > 0) f.km_ini = String(Math.round(c.horometroActual));
};
/** Al escribir el AFI de una actividad: completa el equipo desde el inventario. */
export const alCambiarAfiAct = (a) => {
  const e = buscarEquipoPorAfi(a.afi);
  if (e && !a.equipo) a.equipo = [e.tipo, e.marca].filter(Boolean).join(' ');
  if (e && !a.desde && e.ubicacion) a.desde = e.ubicacion;
};

// ---------- Borrador (si se corta la señal no se pierde) ----------
const BORRADOR = () => 'frc_checklist_chofer_' + (usuarioActivo.value?.usuario || '');
export const formCheck = ref(null);
export const pasoCheck = ref(1);
export const PASOS_CHECK = ['Camión', 'Check list', 'Report', 'Enviar'];
export const nuevoChecklist = () => {
  let b = null; try { b = JSON.parse(localStorage.getItem(BORRADOR()) || 'null'); } catch (_) { b = null; }
  formCheck.value = (b && confirm('Tienes un check list sin enviar. ¿Seguir con ese borrador?')) ? { ...checklistVacio(), ...b } : checklistVacio();
  pasoCheck.value = 1;
};
export const guardarBorradorCheck = () => { try { if (formCheck.value) localStorage.setItem(BORRADOR(), JSON.stringify(formCheck.value)); } catch (_) { /* lleno */ } };
export const cerrarChecklist = () => { guardarBorradorCheck(); formCheck.value = null; };
export const marcarTodoBueno = (grupo) => { ITEMS_CHECK.filter(i => i.grupo === grupo).forEach(i => { formCheck.value.checklist[i.k] = 'B'; }); };
export const faltantesCheck = computed(() => formCheck.value ? ITEMS_CHECK.filter(i => !formCheck.value.checklist[i.k]) : []);
export const malosCheck = computed(() => formCheck.value ? ITEMS_CHECK.filter(i => formCheck.value.checklist[i.k] === 'M') : []);
export const actividadesLlenas = (f) => (f?.actividades || []).filter(a => String(a.afi || a.equipo || a.desde || a.hasta || '').trim());

// ---------- Guardar ----------
export const enviandoCheck = ref(false);
const num = (v) => { const n = Number(String(v ?? '').replace(/\./g, '').replace(',', '.')); return isFinite(n) && n > 0 ? n : null; };
export const enviarChecklist = async () => {
  const f = formCheck.value;
  if (!f) return false;
  if (!String(f.patente || '').trim()) { pasoCheck.value = 1; alert('Elige la patente del camión.'); return false; }
  if (!f.fecha) { pasoCheck.value = 1; alert('Falta la fecha.'); return false; }
  if (num(f.km_ini) && num(f.km_fin) && num(f.km_fin) < num(f.km_ini)) { pasoCheck.value = 1; alert('El km de término es menor que el de inicio.'); return false; }
  if (faltantesCheck.value.length && !confirm(`Faltan ${faltantesCheck.value.length} ítem(s) del check list sin marcar. ¿Enviar igual?`)) { pasoCheck.value = 2; return false; }
  const u = usuarioActivo.value || {};
  const datos = JSON.parse(JSON.stringify(f));
  datos.patente = String(f.patente).trim().toUpperCase();
  datos.chofer = u.nombre || u.usuario || '';
  datos.actividades = actividadesLlenas(f).map(a => {
    const e = buscarEquipoPorAfi(a.afi);
    return { ...a, afi: String(a.afi || '').trim().toUpperCase(), tipo_equipo: e ? e.tipo : '' };
  });
  enviandoCheck.value = true;
  try {
    const { data, error } = await supabaseClient.rpc('frc_chofer_guardar', { p_datos: datos });
    if (error) throw error;
    try { localStorage.removeItem(BORRADOR()); } catch (_) { /* */ }
    formCheck.value = null;
    await Promise.all([cargarMisChecklist(), cargarDatosDesdeSupabase(['movimientos', 'inventario']).catch(() => {})]);
    const reg = misChecklist.value.find(r => String(r.id) === String(data)) || { id: data, ...datos, datos };
    if (confirm('¡Check list enviado!' + (datos.actividades.filter(a => a.afi).length ? ` Se registraron ${datos.actividades.filter(a => a.afi).length} traslado(s) en Movimientos.` : '') + '\n¿Descargar el documento (Excel FRC-RE-OPE-018)?')) await descargarChecklistExcel(reg);
    return true;
  } catch (err) {
    alert(/frc_chofer_guardar|bd_checklist_chofer|function|schema cache/i.test(errMsg(err)) ? SQL_CHOFER : 'No se pudo enviar: ' + errMsg(err));
    return false;
  } finally { enviandoCheck.value = false; }
};

// ---------- Listados ----------
const mapReg = (r) => ({ ...r, ...(r.datos || {}), id: r.id, created_at: r.created_at, usuario: r.usuario });
export const misChecklist = ref([]);
export const cargarMisChecklist = async () => {
  const u = usuarioActivo.value; if (!u) return;
  try {
    const data = await sb(supabaseClient.from(TABLA_CHECKLIST).select('*').eq('usuario', u.usuario).order('id', { ascending: false }).limit(60));
    misChecklist.value = (data || []).map(mapReg);
  } catch (_) { misChecklist.value = []; }
};
/** Todos (Operaciones): Movimientos → "Check list de choferes". */
export const todosChecklist = ref([]);
export const faltaSqlChofer = ref(false);
export const cargarTodosChecklist = async () => {
  try {
    const data = await sb(supabaseClient.from(TABLA_CHECKLIST).select('*').order('id', { ascending: false }).limit(200));
    todosChecklist.value = (data || []).map(mapReg); faltaSqlChofer.value = false;
  } catch (err) { todosChecklist.value = []; faltaSqlChofer.value = /bd_checklist_chofer|does not exist|schema cache/i.test(errMsg(err)); }
};
export const eliminarChecklist = async (r) => {
  if (!confirm(`¿Eliminar el check list del ${formatDateForDisplay(r.fecha)} (${r.patente})?\nLos movimientos que generó NO se borran (elimínalos en Movimientos si corresponde).`)) return;
  try { await sb(supabaseClient.from(TABLA_CHECKLIST).delete().eq('id', r.id)); await cargarTodosChecklist(); }
  catch (err) { alert('No se pudo eliminar: ' + errMsg(err)); }
};

// ---------- Documento: rellena la plantilla original ----------
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escribirCelda = (xml, ref, valor) => {
  const re = new RegExp(`<c r="${ref}"([^>]*?)(/>|>[\\s\\S]*?</c>)`);
  const m = xml.match(re);
  if (!m) return xml;
  const estilo = (m[1].match(/\ss="\d+"/) || [''])[0];
  const v = String(valor ?? '');
  const nueva = v === '' ? `<c r="${ref}"${estilo}/>`
    : (/^-?\d+(\.\d+)?$/.test(v) && !/^-?0\d/.test(v) && v.length < 15) ? `<c r="${ref}"${estilo}><v>${v}</v></c>`
    : `<c r="${ref}"${estilo} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  return xml.replace(re, nueva);
};
const fF = (d) => (d ? formatDateForDisplay(d) : '');
/** Corta las observaciones en hasta 4 líneas del formato. */
const lineasObs = (t, ancho = 95) => {
  const out = [];
  String(t || '').split('\n').forEach(par => {
    let resto = par.trim();
    while (resto.length > ancho) { let k = resto.lastIndexOf(' ', ancho); if (k < 20) k = ancho; out.push(resto.slice(0, k)); resto = resto.slice(k).trim(); }
    if (resto) out.push(resto);
  });
  if (out.length > 4) { out[3] = out.slice(3).join(' '); out.length = 4; }
  return out;
};
/** Celdas a escribir: { 'C5': 'LYXV-16', ... } */
export const celdasChecklist = (r) => {
  const c = {
    C5: r.patente, G5: r.marca, O5: r.modelo, Q5: fF(r.fecha),
    A10: fF(r.venc_revision), A13: fF(r.venc_permiso),
    F9: r.cam_hrs_ini, F11: r.cam_hrs_fin, F13: r.cam_hrs_prox,
    M9: r.km_ini, M11: r.km_fin, M13: r.km_prox,
    P9: r.pluma_hrs_ini, P11: r.pluma_hrs_fin, P13: r.pluma_hrs_prox
  };
  ITEMS_CHECK.forEach(i => {
    const v = (r.checklist || {})[i.k];
    const cols = i.lado === 'I' ? { B: 'F', M: 'G', NA: 'J' } : { B: 'R', M: 'S', NA: 'U' };
    Object.entries(cols).forEach(([op, col]) => { c[col + i.fila] = v === op ? 'X' : ''; });
  });
  (r.actividades || []).slice(0, N_ACTIVIDADES_CHOFER).forEach((a, k) => {
    const f = 48 + k;
    Object.assign(c, { ['C' + f]: a.traslado, ['D' + f]: a.equipo || a.tipo_equipo || '', ['F' + f]: a.afi, ['G' + f]: a.cu, ['I' + f]: a.desde, ['N' + f]: a.hasta, ['P' + f]: a.h_ini, ['R' + f]: a.h_fin });
  });
  const obs = lineasObs(r.observaciones);
  [55, 56, 57, 58].forEach((f, k) => { c['B' + f] = obs[k] !== undefined ? obs[k] : '_'.repeat(95); });
  return c;
};
export const descargarChecklistExcel = async (r) => {
  if (!window.JSZip) return alert('No se pudo cargar el generador de Excel (revisa la conexión a internet).');
  try {
    const resp = await fetch(PLANTILLA_URL, { cache: 'no-cache' });
    if (!resp.ok) throw new Error('No se encontró la plantilla ' + PLANTILLA_URL);
    const zip = await JSZip.loadAsync(await resp.arrayBuffer());
    const ruta = 'xl/worksheets/sheet1.xml';
    let xml = await zip.file(ruta).async('string');
    Object.entries(celdasChecklist(r)).forEach(([ref, v]) => { xml = escribirCelda(xml, ref, v ?? ''); });
    zip.file(ruta, xml);
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `CHECKLIST_CAMION_${String(r.patente || '').replace(/[^A-Z0-9-]/gi, '')}_${fF(r.fecha)}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (err) { alert('No se pudo generar el documento: ' + (err.message || err)); }
};
