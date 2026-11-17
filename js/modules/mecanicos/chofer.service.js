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
const num = (v) => { const n = Number(String(v ?? '').replace(/\./g, '').replace(',', '.')); return isFinite(n) && n > 0 ? n : null; };
export const enviarChecklist = async () => {
  const f = formCheck.value;
  if (!f) return false;
  if (!String(f.patente || '').trim()) { pasoCheck.value = 1; alert('Elige la patente del camión.'); return false; }
  if (!f.fecha) { pasoCheck.value = 1; alert('Falta la fecha.'); return false; }
  if (num(f.km_ini) && num(f.km_fin) && num(f.km_fin) < num(f.km_ini)) { pasoCheck.value = 1; alert('El km de término es menor que el de inicio.'); return false; }
  if (!f.firma) { pasoCheck.value = 4; alert('Falta tu firma (paso 4).'); return false; }
  if (vencidosDe(f).length && !confirm(`ATENCIÓN: documento vencido a la fecha del check list → ${vencidosDe(f).join(' y ')}.\nQueda marcado como VENCIDO en el documento.\n¿Enviar igual?`)) { pasoCheck.value = 1; return false; }
  if (faltantesCheck.value.length && !confirm(`Faltan ${faltantesCheck.value.length} ítem(s) del check list sin marcar. ¿Enviar igual?`)) { pasoCheck.value = 2; return false; }
  const u = usuarioActivo.value || {};
  enviandoCheck.value = true;
  try { await subirFotosPend(f); }
  catch (err) { enviandoCheck.value = false; guardarBorradorCheck(); alert('No se pudieron subir las fotos: ' + errMsg(err) + '\nRevisa la señal e intenta de nuevo.'); return false; }
  guardarBorradorCheck();
  const datos = JSON.parse(JSON.stringify(f));
  datos.patente = String(f.patente).trim().toUpperCase();
  datos.chofer = u.nombre || u.usuario || '';
  datos.actividades = actividadesLlenas(f).map(a => {
    const e = buscarEquipoPorAfi(a.afi);
    const loc = locDeTexto(a.hasta);
    return { ...a, afi: String(a.afi || '').trim().toUpperCase(), tipo_equipo: a.subarrendado ? '' : (e ? e.tipo : ''),
      hasta: loc ? loc.texto : String(a.hasta || '').trim().toUpperCase(), locacion_id: loc ? loc.id : null, empresa: loc ? loc.empresa : '',
      lugar_nuevo: !loc && !valoresDestino.value.has(a.hasta) && Boolean(String(a.hasta || '').trim()) };
  });
  try {
    const { data, error } = await supabaseClient.rpc('frc_chofer_guardar', { p_datos: datos });
    if (error) throw error;
    try { localStorage.removeItem(BORRADOR()); } catch (_) { /* */ }
    formCheck.value = null;
    await Promise.all([cargarMisChecklist(), cargarDatosDesdeSupabase(['movimientos', 'inventario']).catch(() => {})]);
    const reg = misChecklist.value.find(r => String(r.id) === String(data)) || { id: data, ...datos, datos };
    const nMov = datos.actividades.filter(a => a.afi).length;
    if (confirm('¡Check list enviado!' + (nMov ? ` Se registraron ${nMov} traslado(s) en Movimientos y se actualizó la ubicación de los equipos.` : '') + '\n¿Descargar el documento (Excel FRC-RE-OPE-018)?')) await descargarChecklistExcel(reg);
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
/** Crea la celda si la fila existe vacía (la plantilla no trae B63). */
const asegurarCelda = (xml, ref) => {
  if (new RegExp(`<c r="${ref}"[\\s/>]`).test(xml)) return xml;
  const fila = ref.replace(/^[A-Z]+/, '');
  const re = new RegExp(`<row r="${fila}"([^>]*?)(/>|>\\s*</row>)`);
  return xml.replace(re, `<row r="${fila}"$1><c r="${ref}"/></row>`);
};
/** Pone la firma (PNG) como imagen en la hoja, sobre "Nombre y firma chofer" (filas 59-62, columnas B-F). */
const agregarFirmaExcel = async (zip, dataUrl) => {
  const relsRuta = 'xl/drawings/_rels/drawing1.xml.rels', drawRuta = 'xl/drawings/drawing1.xml';
  if (!zip.file(relsRuta) || !zip.file(drawRuta)) return;
  zip.file('xl/media/firma_chofer.png', dataUrl.split(',')[1], { base64: true });
  let rels = await zip.file(relsRuta).async('string');
  rels = rels.replace('</Relationships>', '<Relationship Id="rIdFirma" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="/xl/media/firma_chofer.png"/></Relationships>');
  zip.file(relsRuta, rels);
  let d = await zip.file(drawRuta).async('string');
  const pic = '<twoCellAnchor editAs="oneCell"><from><col>1</col><colOff>0</colOff><row>58</row><rowOff>0</rowOff></from><to><col>6</col><colOff>0</colOff><row>62</row><rowOff>0</rowOff></to>'
    + '<pic><nvPicPr><cNvPr id="90" name="Firma chofer"/><cNvPicPr><a:picLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></cNvPicPr></nvPicPr>'
    + '<blipFill><a:blip xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdFirma"/><a:stretch xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:fillRect/></a:stretch></blipFill>'
    + '<spPr><a:prstGeom xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" prst="rect"><a:avLst/></a:prstGeom></spPr></pic><clientData/></twoCellAnchor>';
  zip.file(drawRuta, d.replace('</wsDr>', pic + '</wsDr>'));
};
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
    A10: fF(r.venc_revision) + (estadoVenc(r.venc_revision, r.fecha)?.vencido ? ' VENCIDA' : ''),
    A13: fF(r.venc_permiso) + (estadoVenc(r.venc_permiso, r.fecha)?.vencido ? ' VENCIDO' : ''),
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
    Object.assign(c, { ['C' + f]: a.traslado, ['D' + f]: (a.equipo || a.tipo_equipo || '') + (a.subarrendado ? ' (SUBARR.)' : ''), ['F' + f]: a.afi, ['G' + f]: a.cu, ['I' + f]: a.desde, ['N' + f]: a.hasta, ['P' + f]: a.h_ini, ['R' + f]: a.h_fin });
  });
  c.B63 = 'Nombre y firma chofer: ' + String(r.chofer || r.usuario || '').toUpperCase();
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
    xml = asegurarCelda(xml, 'B63');
    Object.entries(celdasChecklist(r)).forEach(([ref, v]) => { xml = escribirCelda(xml, ref, v ?? ''); });
    zip.file(ruta, xml);
    if (String(r.firma || '').startsWith('data:image/png;base64,')) await agregarFirmaExcel(zip, r.firma);
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `CHECKLIST_CAMION_${String(r.patente || '').replace(/[^A-Z0-9-]/gi, '')}_${fF(r.fecha)}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (err) { alert('No se pudo generar el documento: ' + (err.message || err)); }
};
