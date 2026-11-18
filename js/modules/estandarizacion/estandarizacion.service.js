// =====================================================================
// ESTANDARIZACIÓN DE EQUIPOS (2026-11-18)
//   · Los mecánicos (taller, terreno, CRTG, tótem) hacen la "Inspección general estandarización":
//     un check list por ítem (cantidad + Bueno / Malo / N/A), observaciones y firma.
//   · Queda guardada en bd_estandarizaciones (sql/estandarizacion.sql) y se ve en el
//     Perfil del equipo → pestaña "Estandarización", con la figura 3D y la última revisión.
//   · Plantilla EGT-FRC (Estándar de Generadores & Torres de Iluminación, rev. 01).
//     Para otros tipos se usa la misma base hasta que se cargue su estándar propio.
// =====================================================================
import { supabaseClient, sb, errMsg, subirArchivoStorage } from '../../core/supabase.js';
import { usuarioActivo } from '../../core/store.js';
import { hoyISO, limpiarAfi, mismoAfi } from '../../core/utils.js';

const { ref } = Vue;
const kAfi = (a) => limpiarAfi(a).toUpperCase();
export const TABLA_EST = 'bd_estandarizaciones';
export const SQL_EST = 'Falta ejecutar sql/estandarizacion.sql en Supabase (SQL Editor → Run).';

// k = clave fija del ítem (la usa la figura 3D) · cant = cantidad que pide el estándar
const ITEMS_EGT = [
  { k: 'afi', t: 'Número de identificación del equipo (AFI)', cant: 1 },
  { k: 'rotulo_frc', t: 'Rótulos empresa (FRC)', cant: 2 },
  { k: 'rotulo_cap', t: 'Rótulo de capacidades del equipo', cant: 1 },
  { k: 'rotulo_uso', t: 'Rótulo paso a paso del uso de equipo', cant: 1 },
  { k: 'bloqueo', t: 'Punto de bloqueo (E.C.F 01)', cant: 1 },
  { k: 'parada', t: 'Parada de emergencia (E.C.F 01)', cant: 2 },
  { k: 'sen_bloqueo', t: 'Señalética punto de bloqueo', cant: 1 },
  { k: 'sen_bateria', t: 'Señalética de batería', cant: 1 },
  { k: 'sen_atrap', t: 'Señalética punto de atrapamiento', cant: 1 },
  { k: 'sen_energias', t: 'Señalética de energías presentes', cant: 1 },
  { k: 'sen_comb', t: 'Señalético combustible', cant: 1 },
  { k: 'extintor', t: 'Extintor portátil 10 kg', cant: 1 },
  { k: 'baliza', t: 'Baliza (color ámbar)', cant: 1 },
  { k: 'barra_cooper', t: 'Barra Cooper', cant: 1 },
  { k: 'bandeja', t: 'Bandeja antiderrame c/ tapón drenaje', cant: 1 },
  { k: 'huincha', t: 'Huincha reflectante perimetral (amarilla)', cant: 1 },
  { k: 'guardas', t: 'Guardas y protecciones partes móviles (E.C.F 08)', cant: 1 },
  { k: 'bateria', t: 'Batería (espuma protección bornes)', cant: 2 },
  { k: 'rotulo_mant', t: 'Rótulo de mantención', cant: 1 },
  { k: 'termoseal', t: 'Protección termoseal línea de escape', cant: 1 },
  { k: 'hoja_comb', t: 'Hoja de seguridad combustible', cant: 1 },
  { k: 'gps', t: 'Dispositivo GPS (correctamente instalado)', cant: 1 },
  { k: 'gps_func', t: 'Comprobar funcionamiento del dispositivo GPS', cant: 1 }
];
export const PLANTILLAS = {
  'EGT-FRC': { codigo: 'EGT-FRC', titulo: 'Estándar de Generadores & Torres de Iluminación', revision: '01', fecha: '02-12-2025', items: ITEMS_EGT }
};
/** Plantilla del equipo según su tipo (por ahora todos usan EGT-FRC; aquí se agregan las de compresores, bombas, etc.). */
export const plantillaDe = (_eq) => PLANTILLAS['EGT-FRC'];
/** ¿El tipo tiene un estándar propio cargado? (generadores y torres sí) */
export const tieneEstandarPropio = (eq) => /GENERADOR|TORRE/i.test(String(eq?.tipo || ''));

export const ESTADOS = { BUENO: { t: 'Bueno', c: 'bg-emerald-500 text-white border-emerald-600' }, MALO: { t: 'Malo', c: 'bg-rose-500 text-white border-rose-600' }, NA: { t: 'N/A', c: 'bg-slate-500 text-white border-slate-600' } };

/** Cumplimiento: ítems Bueno / ítems evaluados (sin N/A), en %. */
export const cumplimiento = (items) => {
  const ev = (items || []).filter(i => i.estado === 'BUENO' || i.estado === 'MALO');
  return ev.length ? Math.round(ev.filter(i => i.estado === 'BUENO').length / ev.length * 100) : 0;
};
export const colorPct = (p) => (p >= 90 ? 'text-emerald-600' : p >= 70 ? 'text-amber-600' : 'text-rose-600');

// ---------- Registros por equipo (se cargan al abrir el perfil o la ficha) ----------
export const porAfi = ref({});           // { AFI: [registros, el más reciente primero] }
export const faltaTabla = ref(false);
export const cargarEstandarizaciones = async (afi) => {
  const k = kAfi(afi);
  try {
    const rows = await sb(supabaseClient.from(TABLA_EST).select('*').eq('afi', k).order('created_at', { ascending: false }));
    porAfi.value = { ...porAfi.value, [k]: (rows || []).sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || String(b.created_at || '').localeCompare(String(a.created_at || ''))) };
    faltaTabla.value = false;
  } catch (err) {
    if (/bd_estandarizaciones|schema cache|does not exist/i.test(errMsg(err))) faltaTabla.value = true;
    porAfi.value = { ...porAfi.value, [k]: [] };
  }
  return porAfi.value[k];
};
export const registrosDe = (afi) => porAfi.value[kAfi(afi)] || [];
export const ultimaDe = (afi) => registrosDe(afi)[0] || null;

// ---------- Formulario ----------
export const formEst = ref(null);       // formulario abierto (o null)
export const guardandoEst = ref(false);
const quien = () => { const u = usuarioActivo.value; return (u && (u.nombre || u.usuario)) || ''; };
export const abrirEstandarizacion = (eq) => {
  const p = plantillaDe(eq);
  const ult = ultimaDe(eq.afi);
  formEst.value = {
    afi: kAfi(eq.afi), equipo: [eq.tipo, eq.marca, eq.modelo].filter(Boolean).join(' '), tipo: eq.tipo || '',
    fecha: hoyISO(), plantilla: p.codigo, horometro: '',
    items: p.items.map(i => ({ k: i.k, t: i.t, cant: i.cant, encontrada: i.cant, estado: '', obs: '' })),
    observaciones: '', responsables: [{ nombre: quien(), firma: '' }],
    anterior: ult ? ult.fecha : null
  };
};
export const cerrarEstandarizacion = () => { formEst.value = null; };
export const marcarTodoBueno = (f) => f.items.forEach(i => { if (!i.estado) i.estado = 'BUENO'; });

const dataUrlABlob = async (d) => (await fetch(d)).blob();
export const guardarEstandarizacion = async () => {
  const f = formEst.value;
  if (!f) return false;
  const sinMarcar = f.items.filter(i => !i.estado);
  if (sinMarcar.length) { alert(`Faltan ${sinMarcar.length} ítem(s) por marcar (Bueno, Malo o N/A). El primero: ${sinMarcar[0].t}.`); return false; }
  const malosSinObs = f.items.filter(i => i.estado === 'MALO' && !String(i.obs || '').trim());
  if (malosSinObs.length && !confirm(`Hay ${malosSinObs.length} ítem(s) MALO sin comentario. ¿Enviar igual?`)) return false;
  const resp = f.responsables.filter(r => String(r.nombre || '').trim());
  if (!resp.length) { alert('Escribe el nombre del trabajador responsable.'); return false; }
  if (!resp[0].firma) { alert('Falta la firma del responsable.'); return false; }
  guardandoEst.value = true;
  try {
    const responsables = [];
    for (const [n, r] of resp.entries()) {
      let firma_url = null;
      if (r.firma) {
        try { firma_url = await subirArchivoStorage(`estandarizacion/${f.afi}_${f.fecha}_${Date.now()}_${n + 1}.png`, await dataUrlABlob(r.firma)); }
        catch (_) { firma_url = r.firma; }   // sin storage: queda la imagen dentro del registro
      }
      responsables.push({ nombre: String(r.nombre).trim().toUpperCase(), firma_url });
    }
    const fila = {
      afi: f.afi, equipo: f.equipo || null, fecha: f.fecha, plantilla: f.plantilla,
      horometro: f.horometro === '' ? null : Number(f.horometro) || null,
      items: f.items.map(({ k, t, cant, encontrada, estado, obs }) => ({ k, t, cant, encontrada: encontrada === '' ? null : Number(encontrada), estado, obs: String(obs || '').trim() || null })),
      observaciones: String(f.observaciones || '').trim() || null,
      responsables, cumplimiento: cumplimiento(f.items), usuario: quien()
    };
    const [nueva] = await sb(supabaseClient.from(TABLA_EST).insert([fila]).select());
    porAfi.value = { ...porAfi.value, [f.afi]: [nueva || { ...fila, created_at: new Date().toISOString() }, ...registrosDe(f.afi)] };
    formEst.value = null;
    return true;
  } catch (err) {
    const m = errMsg(err);
    alert(/bd_estandarizaciones|schema cache|does not exist|column/i.test(m) ? SQL_EST + '\n\nDetalle: ' + m : 'No se pudo guardar la estandarización: ' + m);
    return false;
  } finally { guardandoEst.value = false; }
};
export const eliminarEstandarizacion = async (r) => {
  if (!confirm(`¿Eliminar la estandarización del AFI ${r.afi} del ${r.fecha}?`)) return false;
  try {
    await sb(supabaseClient.from(TABLA_EST).delete().eq('id', r.id));
    porAfi.value = { ...porAfi.value, [kAfi(r.afi)]: registrosDe(r.afi).filter(x => x.id !== r.id) };
    return true;
  } catch (err) { alert('No se pudo eliminar: ' + errMsg(err)); return false; }
};
export { mismoAfi };
