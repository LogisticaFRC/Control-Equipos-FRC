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
import { supabaseClient, sb, errMsg, subirArchivoStorage } from '../../core/supabase.js';
import { usuarioActivo, dbEquipos, buscarEquipoPorAfi, cargarDatosDesdeSupabase } from '../../core/store.js';
import { hoyISO, formatDateForDisplay, mismoAfi } from '../../core/utils.js';
import { esVehiculo } from '../inventario/inventario.mapper.js';
import { abrirPdfChecklist, generarPdfBlob, guardarPdf } from './chofer.pdf.js';   // PDF guardado en Supabase y abierto al enviar
import * as OFF from '../../core/offline.js';   // SIN INTERNET (2026-11-19)
import { avisoApp, FIRMA_EN_EL_MOMENTO } from './mecanicos.service.js';
export { FIRMA_EN_EL_MOMENTO };   // 2026-11-27: el supervisor firma en el momento (false = vuelve "Firma después")
import { dbLocaciones } from '../../core/store.js';
import { TIPOS, textoUbicacion, rutaDe } from '../areas/areas.service.js';

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
/** Formatos de report de chofer. Se agregan más (ej. camioneta) cuando lleguen sus plantillas. */
export const FORMATOS_CHOFER = [
  { key: 'CAMION_PLUMA', titulo: 'Camión pluma', codigo: 'FRC-RE-OPE-018', icon: 'fa-truck-ramp-box', activo: true, plantilla: 'plantillas/CHECKLIST_CAMION_PLUMA.xlsx' },
  { key: 'CAMIONETA', titulo: 'Camioneta', codigo: 'Formato pendiente', icon: 'fa-truck-pickup', activo: false }
];
export const formatoDe = (r) => FORMATOS_CHOFER.find(x => x.key === (r?.formato || 'CAMION_PLUMA')) || FORMATOS_CHOFER[0];
export const N_ACTIVIDADES_CHOFER = 5;

let uidN = 0;
export const actVacia = () => ({ uid: Date.now() + '_' + (++uidN), traslado: 'TRASLADO', subarrendado: false, equipo: '', afi: '', cu: '', desde: '', hasta: '', h_ini: '', h_fin: '', fotos: [] });
export const checklistVacio = (formato = 'CAMION_PLUMA') => ({
  formato, firma: '',
  sup_modo: FIRMA_EN_EL_MOMENTO ? 'AHORA' : 'DESPUES', sup_nombre: '', sup_firma: '',   // supervisor: firma ahora (en el celular) o después (Personal Técnico → Choferes)
  patente: '', marca: '', modelo: '', fecha: hoyISO(), venc_revision: '', venc_permiso: '',
  cam_hrs_ini: '', cam_hrs_fin: '', cam_hrs_prox: '', km_ini: '', km_fin: '', km_prox: '',
  pluma_hrs_ini: '', pluma_hrs_fin: '', pluma_prox_fecha: '',   // Pluma: próxima mantención = FECHA
  checklist: {}, actividades: [], observaciones: ''
});

// ---------- Camiones (vehículos del inventario = patente) ----------
export const camiones = computed(() => dbEquipos.value.filter(esVehiculo)
  .sort((a, b) => String(a.afi).localeCompare(String(b.afi))));
export const docsCargados = ref(false);
export const alElegirCamion = async (f) => {
  docsCargados.value = false;
  const c = camiones.value.find(x => mismoAfi(x.afi, f.patente));
  if (!c) { f.venc_revision = ''; f.venc_permiso = ''; return; }
  f.marca = c.marca || f.marca; f.modelo = c.modelo || f.modelo;
  if (!f.km_ini && Number(c.horometroActual) > 0) f.km_ini = String(Math.round(c.horometroActual));
  // Vencimientos del camión (módulo Vehículos → documentos): si están cargados, se completan solos
  try {
    const data = await sb(supabaseClient.from('bd_vehiculos_documentos').select('clave, fecha_vencimiento')
      .eq('patente', String(c.afi).toUpperCase()).in('clave', ['REVISION_TECNICA', 'PERMISO_CIRCULACION']));
    const ultimo = (k) => (data || []).filter(d => String(d.clave).toUpperCase() === k && d.fecha_vencimiento)
      .map(d => String(d.fecha_vencimiento).slice(0, 10)).sort().pop() || '';
    f.venc_revision = ultimo('REVISION_TECNICA');
    f.venc_permiso = ultimo('PERMISO_CIRCULACION');
  } catch (_) { f.venc_revision = ''; f.venc_permiso = ''; }   // sin información: no se muestra
  docsCargados.value = true;
};
/** Estado de un vencimiento respecto a la fecha del check list: null (sin dato) | { vencido, texto, clase } */
export const estadoVenc = (venc, ref = hoyISO()) => {
  if (!venc) return null;
  const dias = Math.round((new Date(venc + 'T00:00:00') - new Date((ref || hoyISO()) + 'T00:00:00')) / 86400000);
  if (dias < 0) return { vencido: true, texto: `VENCIDO hace ${-dias} día${dias === -1 ? '' : 's'}`, clase: 'bg-rose-600 text-white' };
  if (dias === 0) return { vencido: false, texto: 'Vence HOY', clase: 'bg-amber-500 text-slate-900' };
  if (dias <= 30) return { vencido: false, texto: `Vence en ${dias} día${dias === 1 ? '' : 's'}`, clase: 'bg-amber-100 text-amber-900' };
  return { vencido: false, texto: 'Vigente', clase: 'bg-emerald-100 text-emerald-800' };
};
export const vencidosDe = (r) => [['Revisión técnica', r.venc_revision], ['Permiso de circulación', r.venc_permiso]]
  .filter(([, v]) => estadoVenc(v, r.fecha)?.vencido).map(([n]) => n);
/** Al escribir el AFI de una actividad: completa el equipo desde el inventario. */
export const alCambiarAfiAct = (a) => {
  const e = buscarEquipoPorAfi(a.afi);
  if (e && !a.equipo) a.equipo = [e.tipo, e.marca].filter(Boolean).join(' ');
  if (e && !a.desde && e.ubicacion) a.desde = e.ubicacion;
};

// ---------- Destino: locaciones del módulo Áreas (así el equipo queda en la misma ubicación que usa Movimientos) ----------
/** [{ id, texto: 'ÁREA / SECTOR / LOCACIÓN', empresa }] */
export const destinosLoc = computed(() => dbLocaciones.value.filter(n => n.tipo === TIPOS.LOCACION)
  .map(n => { const r = rutaDe(n.id); return { id: n.id, texto: textoUbicacion(n.id), nombre: n.nombre, area: r.area?.nombre || '', sector: r.sector?.nombre || '', empresa: r.empresa?.nombre || '' }; })
  .filter(x => x.texto)
  .sort((a, b) => a.empresa.localeCompare(b.empresa) || a.area.localeCompare(b.area) || a.nombre.localeCompare(b.nombre)));
/** Lista desplegable "Hasta": grupos por empresa · área (orden por área y locación); cada opción con la ruta completa terminada en la locación. */
export const gruposDestino = computed(() => {
  const mapa = new Map();
  destinosLoc.value.forEach(d => {
    const g = [d.empresa, d.area].filter(Boolean).join(' · ') || 'SIN ÁREA';
    if (!mapa.has(g)) mapa.set(g, []);
    mapa.get(g).push({ value: d.texto, label: d.texto });
  });
  return [...mapa.entries()].map(([label, opciones]) => ({ label, opciones }));
});
/** Valores de la lista: lo que no esté aquí es un "Otro lugar" (genera alerta en Áreas y Locaciones). */
export const valoresDestino = computed(() => new Set(gruposDestino.value.flatMap(g => g.opciones.map(o => o.value))));
const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
/** Locación que calza con lo elegido en "Hasta" (texto exacto de la lista). */
export const locDeTexto = (t) => destinosLoc.value.find(x => norm(x.texto) === norm(t)) || null;

// ---------- Fotos de los equipos (se suben al enviar) ----------
// Archivos elegidos por actividad (no van al borrador: solo se guardan las URL ya subidas).
export const fotosPend = ref({});   // uid de la actividad → [{ file, url (vista previa) }]
const comprimir = (file, max = 1600, calidad = 0.8) => new Promise((ok) => {
  if (!/^image\//.test(file.type)) return ok(file);
  const img = new Image(); const u = URL.createObjectURL(file);
  img.onload = () => {
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    c.toBlob(b => { URL.revokeObjectURL(u); ok(b || file); }, 'image/jpeg', calidad);
  };
  img.onerror = () => { URL.revokeObjectURL(u); ok(file); };
  img.src = u;
});
export const agregarFotos = (k, e) => {
  const files = [...(e.target.files || [])]; e.target.value = '';
  const l = fotosPend.value[k] || [];
  files.forEach(file => l.push({ file, url: URL.createObjectURL(file) }));
  fotosPend.value = { ...fotosPend.value, [k]: l.slice(0, 6) };
};
export const quitarFotoPend = (k, i) => { const l = [...(fotosPend.value[k] || [])]; l.splice(i, 1); fotosPend.value = { ...fotosPend.value, [k]: l }; };
export const quitarFotoSubida = (a, i) => { a.fotos.splice(i, 1); };
const subirFotosPend = async (f) => {
  for (const [k, lista] of Object.entries(fotosPend.value)) {
    const a = f.actividades.find(x => x.uid === k); if (!a || !lista.length) continue;
    a.fotos = a.fotos || [];
    while (lista.length) {
      const blob = await comprimir(lista[0].file);
      const nombre = `choferes/${String(f.patente || 'CAMION').replace(/[^A-Z0-9-]/gi, '')}_${f.fecha}_${String(a.afi || 'EQ').replace(/[^A-Z0-9-]/gi, '')}_${Date.now()}_${a.fotos.length + 1}.jpg`;
      a.fotos.push(await subirArchivoStorage(nombre, blob));
      lista.shift();   // si se corta la señal, lo ya subido no se vuelve a subir
    }
  }
  fotosPend.value = {};
};

// ---------- Borrador (si se corta la señal no se pierde) ----------
const BORRADOR = () => 'frc_checklist_chofer_' + (usuarioActivo.value?.usuario || '');
export const formCheck = ref(null);
export const pasoCheck = ref(1);
export const PASOS_CHECK = ['Camión', 'Check list', 'Traslados', 'Firma y enviar'];
export const nuevoChecklist = (formato = 'CAMION_PLUMA') => {
  let b = null; try { b = JSON.parse(localStorage.getItem(BORRADOR()) || 'null'); } catch (_) { b = null; }
  formCheck.value = (b && confirm('Tienes un check list sin enviar. ¿Seguir con ese borrador?')) ? { ...checklistVacio(formato), ...b } : checklistVacio(formato);
  // borradores antiguos (5 filas fijas): se dejan solo las actividades con datos
  formCheck.value.actividades = actividadesLlenas(formCheck.value).map(a => ({ ...actVacia(), ...a, fotos: Array.isArray(a.fotos) ? a.fotos : [] }));
  fotosPend.value = {};
  pasoCheck.value = 1;
};
export const guardarBorradorCheck = () => { try { if (formCheck.value) localStorage.setItem(BORRADOR(), JSON.stringify(formCheck.value)); } catch (_) { /* lleno */ } };
export const cerrarChecklist = () => { guardarBorradorCheck(); formCheck.value = null; };
export const marcarTodoBueno = (grupo) => { ITEMS_CHECK.filter(i => i.grupo === grupo).forEach(i => { formCheck.value.checklist[i.k] = 'B'; }); };
export const faltantesCheck = computed(() => formCheck.value ? ITEMS_CHECK.filter(i => !formCheck.value.checklist[i.k]) : []);
export const malosCheck = computed(() => formCheck.value ? ITEMS_CHECK.filter(i => formCheck.value.checklist[i.k] === 'M') : []);
export const actividadesLlenas = (f) => (f?.actividades || []).filter(a => String(a.afi || a.equipo || a.desde || a.hasta || '').trim());
/** Guarda una actividad editada en la hoja (nueva o existente). */
export const guardarActividad = (a) => {
  const l = formCheck.value.actividades;
  const i = l.findIndex(x => x.uid === a.uid);
  if (i >= 0) l.splice(i, 1, a); else if (l.length < N_ACTIVIDADES_CHOFER) l.push(a);
};
export const quitarActividad = (a) => {
  const l = formCheck.value.actividades; const i = l.findIndex(x => x.uid === a.uid);
  if (i >= 0) l.splice(i, 1);
  const p = { ...fotosPend.value }; delete p[a.uid]; fotosPend.value = p;
};

// ---------- Guardar ----------
export const enviandoCheck = ref(false);
const armarDatosCheck = (f, u) => {
  const datos = JSON.parse(JSON.stringify(f));
  datos.patente = String(f.patente).trim().toUpperCase();
  datos.chofer = u.nombre || u.usuario || '';
  datos.actividades = actividadesLlenas(datos).map(a => {   // de la copia (sin objetos reactivos: se puede guardar en el equipo)
    const e = buscarEquipoPorAfi(a.afi);
    const loc = locDeTexto(a.hasta);
    return { ...a, afi: String(a.afi || '').trim().toUpperCase(), tipo_equipo: a.subarrendado ? '' : (e ? e.tipo : ''),
      hasta: loc ? loc.texto : String(a.hasta || '').trim().toUpperCase(), locacion_id: loc ? loc.id : null, empresa: loc ? loc.empresa : '',
      lugar_nuevo: !loc && !valoresDestino.value.has(a.hasta) && Boolean(String(a.hasta || '').trim()) };
  });
  return datos;
};
/** SIN INTERNET (2026-11-19): el check list (con sus fotos) queda guardado en el equipo y se envía solo al volver la señal. */
const guardarChecklistSinSenal = async (f, confirmar = true) => {
  if (confirmar && vencidosDe(f).length && !confirm(`ATENCIÓN: documento vencido a la fecha del check list → ${vencidosDe(f).join(' y ')}.\n¿Enviar igual?`)) { pasoCheck.value = 1; return false; }
  if (confirmar && faltantesCheck.value.length && !confirm(`Faltan ${faltantesCheck.value.length} ítem(s) del check list sin marcar. ¿Enviar igual?`)) { pasoCheck.value = 2; return false; }
  enviandoCheck.value = true;
  try {
    const fotos = {};
    for (const [k, lista] of Object.entries(fotosPend.value)) {
      if (!lista.length) continue;
      fotos[k] = [];
      for (const x of lista) fotos[k].push(await comprimir(x.file));
    }
    const datos = armarDatosCheck(f, usuarioActivo.value || {});
    await OFF.guardarTrabajo('checklist_chofer', { datos, fotos }, `Check list ${datos.patente} · ${formatDateForDisplay(datos.fecha)}`);
    try { localStorage.removeItem(BORRADOR()); } catch (_) { /* */ }
    formCheck.value = null; fotosPend.value = {};
    avisoApp('Sin señal: el check list quedó guardado en el equipo y se enviará solo al volver internet (el PDF queda en Mis documentos).');
    return true;
  } catch (err) { alert('No se pudo guardar en el equipo: ' + errMsg(err)); return false; }
  finally { enviandoCheck.value = false; }
};
// Check list guardado sin señal → fotos, registro y PDF al volver internet
OFF.registrarTrabajo('checklist_chofer', async (job, progreso) => {
  const { datos, fotos = {} } = job;
  for (const [k, blobs] of Object.entries(fotos)) {
    const a = datos.actividades.find(x => x.uid === k); if (!a) { delete fotos[k]; continue; }
    a.fotos = a.fotos || [];
    while (blobs.length) {
      const nombre = `choferes/${String(datos.patente || 'CAMION').replace(/[^A-Z0-9-]/gi, '')}_${datos.fecha}_${String(a.afi || 'EQ').replace(/[^A-Z0-9-]/gi, '')}_${Date.now()}_${a.fotos.length + 1}.jpg`;
      a.fotos.push(await subirArchivoStorage(nombre, blobs[0]));
      blobs.shift(); await progreso(job);   // lo ya subido no se vuelve a subir
    }
    delete fotos[k];
  }
  if (!job.id) {
    const { data, error } = await supabaseClient.rpc('frc_chofer_guardar', { p_datos: datos });
    if (error) throw error;
    job.id = data; await progreso(job);
  }
  try {
    const reg = { id: job.id, ...datos, datos };
    await guardarPdf(reg, await generarPdfBlob(reg));
  } catch (err) { console.warn('[Chofer] Check list enviado; el PDF se generará al abrirlo:', errMsg(err)); }
  cargarMisChecklist().catch(() => {});
  cargarDatosDesdeSupabase(['movimientos', 'inventario']).catch(() => {});
});
const num = (v) => { const n = Number(String(v ?? '').replace(/\./g, '').replace(',', '.')); return isFinite(n) && n > 0 ? n : null; };
export const enviarChecklist = async () => {
  const f = formCheck.value;
  if (!f) return false;
  if (!String(f.patente || '').trim()) { pasoCheck.value = 1; alert('Elige la patente del camión.'); return false; }
  if (!f.fecha) { pasoCheck.value = 1; alert('Falta la fecha.'); return false; }
  if (num(f.km_ini) && num(f.km_fin) && num(f.km_fin) < num(f.km_ini)) { pasoCheck.value = 1; alert('El km de término es menor que el de inicio.'); return false; }
  if (!f.firma) { pasoCheck.value = 4; alert('Falta tu firma (paso 4).'); return false; }
  if (FIRMA_EN_EL_MOMENTO) f.sup_modo = 'AHORA';
  if (f.sup_modo === 'AHORA' && (!String(f.sup_nombre || '').trim() || !f.sup_firma)) { pasoCheck.value = 4; alert('Falta el nombre y la firma del supervisor (o elige "Firma después").'); return false; }
  if (f.sup_modo !== 'AHORA') { f.sup_nombre = ''; f.sup_firma = ''; }
  if (OFF.dispositivoOffline() && OFF.sinSenal()) return guardarChecklistSinSenal(f);
  // Pestaña para mostrar el PDF al terminar (se abre ahora, si no el navegador la bloquea)
  let ventanaPdf = null; try { ventanaPdf = window.open('', '_blank'); } catch (_) { ventanaPdf = null; }
  const cerrarVentana = () => { try { ventanaPdf && ventanaPdf.close(); } catch (_) { /* */ } };
  if (vencidosDe(f).length && !confirm(`ATENCIÓN: documento vencido a la fecha del check list → ${vencidosDe(f).join(' y ')}.\n¿Enviar igual?`)) { pasoCheck.value = 1; return false; }
  if (faltantesCheck.value.length && !confirm(`Faltan ${faltantesCheck.value.length} ítem(s) del check list sin marcar. ¿Enviar igual?`)) { pasoCheck.value = 2; return false; }
  const u = usuarioActivo.value || {};
  enviandoCheck.value = true;
  const offline = OFF.dispositivoOffline();
  try { await OFF.enDirecto(() => subirFotosPend(f)); }
  catch (err) {
    cerrarVentana(); enviandoCheck.value = false;
    if (offline && OFF.esErrorRed(err)) return guardarChecklistSinSenal(f, false);   // se cortó la señal: queda guardado
    guardarBorradorCheck(); alert('No se pudieron subir las fotos: ' + errMsg(err) + '\nRevisa la señal e intenta de nuevo.'); return false; }
  guardarBorradorCheck();
  const datos = armarDatosCheck(f, u);
  try {
    const { data, error } = await OFF.enDirecto(() => supabaseClient.rpc('frc_chofer_guardar', { p_datos: datos }));
    if (error) throw error;
    try { localStorage.removeItem(BORRADOR()); } catch (_) { /* */ }
    formCheck.value = null;
    await Promise.all([cargarMisChecklist(), cargarDatosDesdeSupabase(['movimientos', 'inventario']).catch(() => {})]);
    const reg = misChecklist.value.find(r => String(r.id) === String(data)) || { id: data, ...datos, datos };
    const nMov = datos.actividades.filter(a => a.afi).length;
    avisoApp('Check list enviado ✔' + (nMov ? ` · ${nMov} traslado(s) en Movimientos` : ''));
    await abrirPdfChecklist(reg, ventanaPdf);   // PDF: se guarda en Supabase y se abre para verlo
    return true;
  } catch (err) {
    cerrarVentana();
    if (offline && OFF.esErrorRed(err) && formCheck.value) { enviandoCheck.value = false; return guardarChecklistSinSenal(f, false); }
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
/** Movimientos → PDF del check list del chofer que registró ese traslado. */
export const checklistDeMovimiento = async (m) => {
  try {
    let q = supabaseClient.from(TABLA_CHECKLIST).select('*');
    q = m.checklistId ? q.eq('id', m.checklistId) : q.eq('patente', String(m.camion || '').toUpperCase()).eq('fecha', normalizarISO(m.fecha));
    const data = await sb(q);
    const regs = (data || []).map(mapReg);
    return regs.find(r => (r.actividades || []).some(a => mismoAfi(a.afi, m.afi))) || regs[0] || null;
  } catch (_) { return null; }
};
const normalizarISO = (f) => { const s = String(f || ''); const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : s.slice(0, 10); };
/** ¿El movimiento viene de un check list de chofer? */
export const esMovDeChofer = (m) => Boolean(m && (m.checklistId || /CHOFER/i.test(m.tipo || '')));

/** Pendiente de firma del supervisor. */
export const pendienteSupervisor = (r) => !r.sup_firma;
/** Supervisor firma después (Personal Técnico → Choferes) · RPC frc_chofer_firmar_supervisor. */
export const firmarSupervisor = async (r, nombre, firma) => {
  if (!String(nombre || '').trim() || !firma) { alert('Escribe el nombre y firma.'); return false; }
  try {
    const { error } = await supabaseClient.rpc('frc_chofer_firmar_supervisor', { p_id: r.id, p_nombre: String(nombre).trim().toUpperCase(), p_firma: firma });
    if (error) throw error;
    await cargarTodosChecklist();
    return true;
  } catch (err) { alert(/frc_chofer_firmar_supervisor|function|schema cache/i.test(errMsg(err)) ? SQL_CHOFER : 'No se pudo firmar: ' + errMsg(err)); return false; }
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
/** Crea la celda si la fila existe vacía (la plantilla no trae B63). */
const colNum = (ref) => ref.replace(/\d+/g, '').split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const asegurarCelda = (xml, ref) => {
  if (new RegExp(`<c r="${ref}"[\\s/>]`).test(xml)) return xml;
  const fila = ref.replace(/^[A-Z]+/, '');
  const m = xml.match(new RegExp(`<row r="${fila}"([^>]*?)(/>|>([\\s\\S]*?)</row>)`));
  if (!m) return xml;
  const celdas = m[3] || '';
  const nueva = `<c r="${ref}"/>`;
  // insertar en orden de columna
  let pos = celdas.length;
  const re = /<c r="([A-Z]+)\d+"/g; let x;
  while ((x = re.exec(celdas))) { if (colNum(x[1]) > colNum(ref)) { pos = x.index; break; } }
  const cont = celdas.slice(0, pos) + nueva + celdas.slice(pos);
  return xml.replace(m[0], `<row r="${fila}"${m[1]}>${cont}</row>`);
};
/** Pone una firma (PNG) como imagen en la hoja (filas 59-62). col1/col2 = columnas (0 = A). */
const agregarFirmaExcel = async (zip, dataUrl, clave, col1, col2) => {
  const relsRuta = 'xl/drawings/_rels/drawing1.xml.rels', drawRuta = 'xl/drawings/drawing1.xml';
  if (!zip.file(relsRuta) || !zip.file(drawRuta)) return;
  zip.file(`xl/media/firma_${clave}.png`, dataUrl.split(',')[1], { base64: true });
  let rels = await zip.file(relsRuta).async('string');
  rels = rels.replace('</Relationships>', `<Relationship Id="rIdFirma_${clave}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="/xl/media/firma_${clave}.png"/></Relationships>`);
  zip.file(relsRuta, rels);
  const d = await zip.file(drawRuta).async('string');
  const id = clave === 'chofer' ? 90 : 91;
  const pic = `<twoCellAnchor editAs="oneCell"><from><col>${col1}</col><colOff>0</colOff><row>58</row><rowOff>0</rowOff></from><to><col>${col2}</col><colOff>0</colOff><row>62</row><rowOff>0</rowOff></to>`
    + `<pic><nvPicPr><cNvPr id="${id}" name="Firma ${clave}"/><cNvPicPr><a:picLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></cNvPicPr></nvPicPr>`
    + `<blipFill><a:blip xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdFirma_${clave}"/><a:stretch xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:fillRect/></a:stretch></blipFill>`
    + '<spPr><a:prstGeom xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" prst="rect"><a:avLst/></a:prstGeom></spPr></pic><clientData/></twoCellAnchor>';
  zip.file(drawRuta, d.replace('</wsDr>', pic + '</wsDr>'));
};
/** Corta las observaciones en hasta 4 líneas del formato. */
const lineasObs = (t, ancho = 64) => {
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
    A10: fF(r.venc_revision), A13: fF(r.venc_permiso),   // en el documento solo la fecha (lo de vencido se ve en el sistema)
    F9: r.cam_hrs_ini, F11: r.cam_hrs_fin, F13: r.cam_hrs_prox,
    M9: r.km_ini, M11: r.km_fin, M13: r.km_prox,
    P9: r.pluma_hrs_ini, P11: r.pluma_hrs_fin, P13: r.pluma_prox_fecha ? fF(r.pluma_prox_fecha) : (r.pluma_hrs_prox || '')
  };
  ITEMS_CHECK.forEach(i => {
    const v = (r.checklist || {})[i.k];
    const cols = i.lado === 'I' ? { B: 'F', M: 'G', NA: 'J' } : { B: 'R', M: 'S', NA: 'U' };
    Object.entries(cols).forEach(([op, col]) => { c[col + i.fila] = v === op ? 'X' : ''; });
  });
  (r.actividades || []).slice(0, N_ACTIVIDADES_CHOFER).forEach((a, k) => {
    const f = 48 + k;
    // En la hoja va el nombre del lugar (última parte de la ruta: … / PLG → PLG), como se usa en terreno
    const corto = (t) => String(t || '').split(' / ').pop().trim();
    Object.assign(c, { ['C' + f]: a.traslado, ['D' + f]: (a.equipo || a.tipo_equipo || '') + (a.subarrendado ? ' (SUBARR.)' : ''), ['F' + f]: a.afi, ['G' + f]: a.cu, ['I' + f]: corto(a.desde), ['N' + f]: corto(a.hasta), ['P' + f]: a.h_ini, ['R' + f]: a.h_fin });
  });
  c.B63 = 'Firma chofer'; c.B64 = String(r.chofer || r.usuario || '').toUpperCase();
  c.P63 = 'Firma supervisor'; c.P64 = r.sup_firma ? String(r.sup_nombre || '').toUpperCase() : '(pendiente)';
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
    ['B63', 'P63', 'B64', 'P64'].forEach(ref => { xml = asegurarCelda(xml, ref); });
    Object.entries(celdasChecklist(r)).forEach(([ref, v]) => { xml = escribirCelda(xml, ref, v ?? ''); });
    zip.file(ruta, xml);
    if (String(r.firma || '').startsWith('data:image/png;base64,')) await agregarFirmaExcel(zip, r.firma, 'chofer', 1, 6);
    if (String(r.sup_firma || '').startsWith('data:image/png;base64,')) await agregarFirmaExcel(zip, r.sup_firma, 'supervisor', 15, 21);
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `CHECKLIST_CAMION_${String(r.patente || '').replace(/[^A-Z0-9-]/gi, '')}_${fF(r.fecha)}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (err) { alert('No se pudo generar el documento: ' + (err.message || err)); }
};
