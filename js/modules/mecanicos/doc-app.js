// =====================================================================
// PDF AL MOMENTO (2026-11-20)
// Los reports de la app ya NO se guardan como archivo: el PDF se arma cada vez que se pide
// con los datos de bd_mec_intervenciones (firmas incluidas) y no queda nada en el almacenamiento.
//   · Enlace permanente: https://<página>/?doc=APP-<id>  (Historial, Excel, correos)
//     → al abrirlo (con sesión iniciada) se arma el PDF y se muestra / descarga.
//   · Los documentos ESCANEADOS siguen guardándose como PDF (no hay datos para rearmarlos).
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { TABLAS } from '../../core/tablas.js';
import { generarPDF } from './mecanicos.service.js';

const CLAVE = 'frc_doc_pedido';
/** Enlace permanente del report de la app (va en BD_HISTORIAL.link y en el Excel). */
export const enlaceDocApp = (id) => `${location.origin}${location.pathname}?doc=APP-${id}`;
/** ¿Es un enlace "PDF al momento"? → id del report o null. */
export const idDocApp = (link) => { const m = String(link || '').match(/[?&]doc=APP-(\d+)/); return m ? Number(m[1]) : null; };

export const generandoDoc = Vue.ref(false);
/** Arma el PDF del report y lo abre (PC) o lo descarga (celular). */
export const abrirDocApp = async (id, ventana = null) => {
  generandoDoc.value = true;
  try {
    const r = (await sb(supabaseClient.from(TABLAS.MEC_INTERVENCIONES).select('*').eq('id', id).limit(1)))[0];
    if (!r) throw new Error(`No existe el report APP-${id} (pudo ser eliminado).`);
    const blob = await generarPDF(r);
    const nombre = `${r.modo === 'INSPECCION' ? 'OT Terreno' : 'Intervencion ' + (r.tipo === 'ELECTRICA' ? 'electrica' : 'mecanica')} AFI ${r.afi} ${r.fecha || ''}${r.estado === 'EN_HISTORIAL' || r.estado === 'FIRMADA' ? '' : ' (SIN FIRMA)'}.pdf`;
    const url = URL.createObjectURL(new File([blob], nombre, { type: 'application/pdf' }));
    const movil = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    if (!movil && ventana) { ventana.location.href = url; return; }
    if (!movil) { const w = window.open(url, '_blank'); if (w) return; }
    const a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    if (ventana) ventana.close();
    alert('No se pudo armar el PDF: ' + errMsg(err));
  } finally { generandoDoc.value = false; }
};
/** Clic en "Ver" del Historial: si es report de la app, se arma al momento; si no, abre el archivo guardado. */
export const abrirDocumento = (link) => {
  const id = idDocApp(link);
  if (!id) { window.open(link, '_blank', 'noopener'); return; }
  const movil = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const w = movil ? null : window.open('', '_blank');   // se abre ya (si no, el navegador la bloquea) y se llena al terminar
  if (w) w.document.write('<p style="font-family:Arial;padding:30px">Armando el PDF…</p>');
  abrirDocApp(id, w);
};
/** Al entrar con ?doc=APP-<id> (desde Excel o un correo): se recuerda hasta iniciar sesión y se abre. */
export const recordarDocPedido = () => {
  const m = location.search.match(/[?&]doc=APP-(\d+)/);
  const r = location.search.match(/[?&]rep=(\d+)/);   // 2026-11-20: intervenciones hechas de un equipo del taller
  if (!m && !r) return;
  try { sessionStorage.setItem(CLAVE, m ? m[1] : 'rep:' + r[1]); } catch (_) { /* */ }
  history.replaceState(null, '', location.pathname + location.hash);
};
export const abrirDocPedido = async () => {
  let id = null;
  try { id = sessionStorage.getItem(CLAVE); sessionStorage.removeItem(CLAVE); } catch (_) { /* */ }
  if (!id) return;
  if (String(id).startsWith('rep:')) {
    generandoDoc.value = true;
    try { const P = await import('../taller/pdf-reparacion.js'); await P.abrirPDFReparacion(Number(id.slice(4))); }
    finally { generandoDoc.value = false; }
    return;
  }
  await abrirDocApp(Number(id));
};
