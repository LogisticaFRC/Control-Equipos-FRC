// =====================================================================
// TALLER · PDF DE INTERVENCIONES HECHAS DE UN EQUIPO (2026-11-20)
// "PDF al momento": no se guarda ningún archivo. Junta los ítems TERMINADOS de las OT de la reparación
// (con su report: personal, fechas/horas, horómetro, ART, bloqueo, descripción y fotos) + los reports
// de la app del mismo AFI desde que entró al taller + (2026-11-26) las intervenciones del Historial unidas
// por programa o por N° de OT.
//   · Enlace permanente: https://<página>/?rep=<id reparación>  (Excel del programa, etc.)
// =====================================================================
import { supabaseClient, sb } from '../../core/supabase.js';
import { TABLAS } from '../../core/tablas.js';
import { logoDataURL } from '../../core/excel.js';
import { formatDateForDisplay } from '../../core/utils.js';
import { dbEquipos, dbProgramasCalendarios, dbIntervenciones, cargarDatosDesdeSupabase } from '../../core/store.js';
import { libsPDF, renderHTML } from '../mecanicos/mecanicos.service.js';
import * as T from './taller.service.js';

const V = '#1f4d3a';
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ANCHO = 794;
export const enlaceRep = (id) => `${location.origin}${location.pathname}?rep=${id}`;

const cabecera = (logo, rep, prog, otros) => `
<div style="width:${ANCHO}px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:24px 34px 8px;box-sizing:border-box;background:#fff">
  <div style="display:flex;align-items:center;gap:16px;border-bottom:3px solid ${V};padding-bottom:10px">
    ${logo ? `<img src="${logo}" style="height:54px">` : ''}
    <div style="flex:1"><div style="font-size:20px;font-weight:900;color:${V}">INFORME DE INTERVENCIONES · TALLER</div>
      <div style="font-size:12px;color:#475569">${esc(otros.desc)}</div></div>
    <div style="text-align:right"><div style="font-size:26px;font-weight:900;color:${V}">AFI ${esc(rep.afi)}</div>
      <div style="font-size:12px">Avance <b style="font-size:16px">${otros.pct}%</b> · ${otros.done}/${otros.total} ítems</div></div>
  </div>
  <table style="width:100%;font-size:11px;margin-top:8px;border-collapse:collapse"><tr>
    <td><b>Programa:</b> ${esc(prog || '-')}</td><td><b>Nave:</b> ${esc(rep.nave || '-')}</td>
    <td><b>Ingreso:</b> ${esc(rep.fecha_ingreso ? formatDateForDisplay(String(rep.fecha_ingreso).slice(0, 10)) : '-')}</td>
    <td><b>OT:</b> ${esc(otros.folios || '-')}</td><td style="text-align:right"><b>Emitido:</b> ${esc(formatDateForDisplay(new Date().toISOString().slice(0, 10)))}</td></tr></table>
</div>`;

const bloqueItem = (n, x) => {
  const a = x.a, r = a.reporte || {};
  const fotos = [...(r.art_fotos || []), r.bloqueo_foto].filter(Boolean);
  const fila = (k, v) => `<td style="padding:4px 6px;border:1px solid #cbd5e1;font-size:10.5px"><b style="color:${V}">${k}</b><br>${v}</td>`;
  return `
<div style="width:${ANCHO}px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:6px 34px;box-sizing:border-box;background:#fff">
  <div style="border:1.5px solid ${V};border-radius:6px;overflow:hidden">
    <div style="background:${V};color:#fff;padding:6px 10px;font-weight:700;font-size:12px;display:flex;justify-content:space-between">
      <span>${n}. ${esc(a.descripcion)}</span><span>OT N° ${esc(x.ot.folio)} · TERMINADO</span></div>
    <table style="width:100%;border-collapse:collapse"><tr>
      ${fila('Personal', esc((r.personal || []).join(', ') || a.ejecutante || '-'))}
      ${fila('Inicio', esc(`${formatDateForDisplay(r.fecha_inicio || a.f_inicio) || '-'} ${r.hora_inicio || a.h_inicio || ''}`))}
      ${fila('Término', esc(`${formatDateForDisplay(r.fecha_termino || a.f_term) || '-'} ${r.hora_termino || a.h_term || ''}`))}
      ${fila('Horómetro', esc(r.horometro || '-'))}
      ${fila('Uso ART', r.uso_art ? 'SÍ' : 'NO')}${fila('Bloqueo', r.bloqueo ? 'SÍ' : 'NO')}
    </tr></table>
    <div style="padding:6px 10px;font-size:11px;white-space:pre-line"><b style="color:${V}">Trabajo realizado:</b> ${esc(r.descripcion || a.detalle_mec || '-')}</div>
    ${fotos.length ? `<div style="display:flex;gap:6px;padding:0 10px 8px">${fotos.map(u => `<img src="${esc(u)}" crossorigin="anonymous" style="height:110px;max-width:170px;object-fit:cover;border:1px solid #cbd5e1;border-radius:4px">`).join('')}</div>` : ''}
    <div style="padding:0 10px 6px;font-size:9px;color:#94a3b8">Firmas: pendientes de implementación.</div>
  </div>
</div>`;
};

// 2026-11-26: intervenciones registradas a mano en el Historial (Registrar mantención / intervención mecánica)
// unidas a esta reparación: por el programa (mismo AFI) o por el N° de OT del taller.
const bloqueHistorial = (n, m) => {
  const fila = (k, v) => `<td style="padding:4px 6px;border:1px solid #cbd5e1;font-size:10.5px"><b style="color:${V}">${k}</b><br>${v}</td>`;
  const mecs = [m.mec1, m.mec2, m.mec3, m.mec4].filter(x => String(x || '').trim()).join(', ');
  const siNo = (v) => (/^(s[ií]|true|1|x|✓)/i.test(String(v || '').trim()) ? 'SÍ' : String(v || '').trim() ? esc(v) : '-');
  return `
<div style="width:${ANCHO}px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:6px 34px;box-sizing:border-box;background:#fff">
  <div style="border:1.5px solid #1d4ed8;border-radius:6px;overflow:hidden">
    <div style="background:#1d4ed8;color:#fff;padding:6px 10px;font-weight:700;font-size:12px;display:flex;justify-content:space-between">
      <span>${n}. ${esc(m.causaDetallada || m.causa || 'Intervención')}</span>
      <span>${m.numeroFolio ? 'Folio ' + esc(m.numeroFolio) + ' · ' : ''}${m.numeroOT ? 'OT N° ' + esc(m.numeroOT) + ' · ' : ''}${m.reparacionTerminada ? 'REPARACIÓN TERMINADA' : 'HISTORIAL'}</span></div>
    <table style="width:100%;border-collapse:collapse"><tr>
      ${fila('Personal', esc(mecs || '-'))}
      ${fila('Fecha', esc(formatDateForDisplay(String(m.fecha || '').slice(0, 10)) || '-'))}
      ${fila('Horario', esc([m.horaInicio, m.horaTermino].filter(Boolean).join(' – ') || '-') + (m.horaTotal ? ' (' + esc(m.horaTotal) + ')' : ''))}
      ${fila('Horómetro', esc(m.horometro || '-'))}
      ${fila('Uso ART', siNo(m.usoArt))}${fila('Bloqueo', siNo(m.bloqueo))}
    </tr></table>
    <div style="padding:6px 10px;font-size:11px;white-space:pre-line"><b style="color:#1d4ed8">Trabajo realizado:</b> ${esc(m.descripcion || '-')}</div>
    ${m.aceites && m.aceites !== 'Sin consumo' ? `<div style="padding:0 10px 4px;font-size:10.5px"><b>Aceites:</b> ${esc(m.aceites)}</div>` : ''}
    ${m.filtrosTexto ? `<div style="padding:0 10px 4px;font-size:10.5px"><b>Filtros:</b> ${esc(m.filtrosTexto)}</div>` : ''}
    <div style="padding:0 10px 6px;font-size:9px;color:#64748b">Registrado en el Historial${m.tipoMant ? ' · ' + esc(m.tipoMant) : ''}${m.linkDrive ? ' · hoja escaneada adjunta en el sistema' : ''}</div>
  </div>
</div>`;
};

const tablaApp = (regs) => !regs.length ? '' : `
<div style="width:${ANCHO}px;font-family:Arial,Helvetica,sans-serif;padding:8px 34px;box-sizing:border-box;background:#fff">
  <div style="font-weight:900;color:${V};font-size:13px;margin-bottom:4px">Reports de la app en el periodo</div>
  <table style="width:100%;border-collapse:collapse;font-size:10.5px">
    <tr style="background:${V};color:#fff"><th style="padding:4px;text-align:left">Fecha</th><th style="text-align:left">Tipo</th><th style="text-align:left">Detalle</th><th style="text-align:left">Estado</th><th style="text-align:left">N°</th></tr>
    ${regs.map(r => `<tr style="border-bottom:1px solid #e2e8f0"><td style="padding:4px">${esc(formatDateForDisplay(r.fecha))}</td><td>${esc(r.modo === 'INSPECCION' ? 'OT Terreno' : r.tipo === 'ELECTRICA' ? 'Eléctrica' : 'Mecánica')}</td><td>${esc(r.causa_intervencion || r.falla_texto || r.descripcion || '')}</td><td>${esc(r.estado === 'EN_HISTORIAL' ? 'Firmado' : r.estado === 'PENDIENTE_FIRMA' ? 'Falta firma' : r.estado === 'LEVANTAMIENTO' ? 'Registrada' : r.estado)}</td><td>APP-${r.id}</td></tr>`).join('')}
  </table>
</div>`;

/** Arma el PDF de las intervenciones hechas de una reparación (equipo en taller). */
export const generarPDFReparacion = async (repId) => {
  if (!T.repPorId(repId)) await T.recargarTaller();
  // abierto desde un enlace (Excel / pestaña nueva): el inventario puede no haber terminado de cargar
  const faltan = [!dbEquipos.value.length && 'inventario', !dbProgramasCalendarios.value.length && 'programas', !dbIntervenciones.value.length && 'historial'].filter(Boolean);
  if (faltan.length) { try { await cargarDatosDesdeSupabase(faltan); } catch (_) { /* */ } }
  const rep = T.repPorId(repId);
  if (!rep) throw new Error('No se encontró el equipo en el taller (reparación ' + repId + ').');
  const hechas = T.actividadesRep(rep).filter(x => T.actividadHecha(x.a));
  const pr = T.progresoRep(rep);
  const it = T.itemDeRep(rep); const prog = it ? T.nombreProgId(it.programa_id) : '';
  // Historial unido: reportes del programa (mismo AFI) + registros con el N° de una OT de esta reparación
  // + (sin programa) registros del programa "… SIN PROGRAMA" desde que entró al taller
  let hist = [];
  try {
    const P = await import('../programas/programas.service.js');
    const O = await import('../ot/ot.service.js');
    const desdeH = String(rep.fecha_ingreso || '').slice(0, 10);
    const mapa = new Map();
    if (it) P.reportesDeItem(it).forEach(m => mapa.set(m.id, m));
    T.otsDeRep(rep).forEach(o => O.mantencionesDeOT(o.folio).filter(m => String(m.afi).toUpperCase().replace(/^AFI\s*/, '') === String(rep.afi).toUpperCase()).forEach(m => mapa.set(m.id, m)));
    if (!it) dbIntervenciones.value.filter(m => /SIN\s*PROGRAMA/i.test(m.programaCorrespondiente || '') && String(m.afi).toUpperCase() === String(rep.afi).toUpperCase() && (!desdeH || String(m.fecha || '').slice(0, 10) >= desdeH)).forEach(m => mapa.set(m.id, m));
    hist = [...mapa.values()].sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')) || (a.id - b.id));
  } catch (_) { /* sin historial */ }
  let app = [];
  try {
    const desde = String(rep.fecha_ingreso || '').slice(0, 10);
    let q = supabaseClient.from(TABLAS.MEC_INTERVENCIONES).select('id, fecha, tipo, modo, estado, causa_intervencion, falla_texto, descripcion, afi').order('fecha');
    q = q.eq('afi', rep.afi); if (desde) q = q.gte('fecha', desde);
    app = await sb(q);
  } catch (_) { /* sin reports de la app */ }
  const logo = (await logoDataURL())?.url || '';
  const { html2canvas, jsPDF } = await libsPDF();
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297, MARGEN = 8;
  let y = 0, primera = true;
  const poner = async (html) => {
    if (!html) return;
    const c = await renderHTML(html, ANCHO, html2canvas);
    const h = c.height * W / c.width;
    if (!primera && y + h > H - MARGEN) { pdf.addPage(); y = MARGEN; }
    pdf.addImage(c.toDataURL('image/jpeg', 0.85), 'JPEG', 0, y, W, h);
    y += h; primera = false;
  };
  // descripción del equipo: inventario; si no está, lo que dice la OT (equipo, marca, modelo)
  const ot0 = T.otsDeRep(rep)[0] || {};
  const desc = T.equipoDe(rep.afi) ? T.descEquipo(rep.afi) : ([ot0.equipo, ot0.marca, ot0.modelo].filter(Boolean).join(' · ') || 'Equipo sin datos en el inventario');
  await poner(cabecera(logo, rep, prog, { ...pr, desc, folios: T.otsDeRep(rep).map(o => o.folio).join(', ') }));
  if (!hechas.length && !hist.length) await poner(`<div style="width:${ANCHO}px;padding:20px 34px;font-family:Arial;font-size:13px;color:#64748b;background:#fff">Todavía no hay ítems terminados en la OT ni intervenciones registradas en el Historial.</div>`);
  if (hechas.length) await poner(`<div style="width:${ANCHO}px;padding:8px 34px 0;font-family:Arial;font-size:13px;font-weight:900;color:${V};background:#fff">Ítems de la OT terminados (${hechas.length})</div>`);
  for (let k = 0; k < hechas.length; k++) await poner(bloqueItem(k + 1, hechas[k]));
  if (hist.length) await poner(`<div style="width:${ANCHO}px;padding:10px 34px 0;font-family:Arial;font-size:13px;font-weight:900;color:#1d4ed8;background:#fff">Intervenciones registradas en el Historial (${hist.length})</div>`);
  for (let k = 0; k < hist.length; k++) await poner(bloqueHistorial(k + 1, hist[k]));
  await poner(tablaApp(app));
  return { blob: pdf.output('blob'), nombre: `Intervenciones AFI ${rep.afi} ${new Date().toISOString().slice(0, 10)}.pdf` };
};

/** Arma y abre (PC) o descarga (celular) el PDF. */
export const abrirPDFReparacion = async (repId, ventana = null) => {
  try {
    const { blob, nombre } = await generarPDFReparacion(repId);
    const url = URL.createObjectURL(new File([blob], nombre, { type: 'application/pdf' }));
    const movil = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    if (!movil && ventana) { ventana.location.href = url; return; }
    if (!movil && window.open(url, '_blank')) return;
    const a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  } catch (err) { if (ventana) ventana.close(); alert('No se pudo armar el PDF: ' + (err?.message || err)); }
};
