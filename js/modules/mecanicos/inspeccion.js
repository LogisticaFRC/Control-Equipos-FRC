// =====================================================================
// APP TÉCNICOS · INSPECCIÓN (SOLO VISUAL) · 2026-11-27
// Breve: Datos → Inspección (descripción, ¿algo por realizar que no sea falla? + lista, tiempo) → Firmas.
// Sin ART ni bloqueo (solo se mira el equipo). Se guarda en bd_mec_intervenciones con tipo = 'INSPECCION';
// los ítems por realizar van en la columna fallas (jsonb) como [{ n, descripcion, categoria, foto }].
// =====================================================================
export const CATEGORIAS_HALLAZGO = ['ESTÉTICO', 'LIMPIEZA / ASEO', 'PINTURA', 'SEÑALÉTICA / ROTULACIÓN', 'ORDEN', 'OTRO'];
export const hallazgoVacio = () => ({ descripcion: '', categoria: '', foto: '' });

const V = '#0f7a3d', VO = '#1f4d3a';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fecha = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : esc(iso); };
const firmaImg = (src, h = 30) => (src ? `<img src="${src}" style="height:${h}px;max-width:100%;object-fit:contain">` : '');
const td = 'border:1px solid #333;padding:1px 5px 4px;font-size:10px';
const th = `border:1px solid #333;padding:1px 5px 4px;font-size:10px;background:${V};color:#fff;font-weight:800`;
const durTxt = (min) => (min == null ? '' : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ' ' + (min % 60) + ' min' : ''}`);

/** Hoja PDF de la inspección (formato FRC). */
export const hojaInspeccion = (r, logo = '', ancho = 794) => {
  const sup = r.supervisor || {};
  const mecs = [...(r.mecanicos || [])]; while (mecs.length < 2) mecs.push({ nombre: '', firma: '' });
  const hall = (r.fallas || []).filter(h => String(h.descripcion || '').trim());
  const dato = (l, v) => `<td style="${td};background:#ecfdf5;font-weight:800;color:${V};white-space:nowrap">${l}</td><td style="${td};font-weight:700">${esc(v) || '&nbsp;'}</td>`;
  return `
<div style="width:${ancho}px;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:22px 30px;box-sizing:border-box">
 <div style="border:2px solid #333;padding:12px 16px">
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px"><tr>
    <td style="width:140px">${logo ? `<img src="${logo}" style="height:44px">` : `<b style="font-size:22px;color:${VO}">FRC</b>`}</td>
    <td style="text-align:center;font-size:18px;color:${V};font-weight:700">INSPECCIÓN DE EQUIPO<div style="font-size:11px;color:#475569;font-weight:700">(solo visual)</div></td>
    <td style="width:150px;text-align:right;font-size:9px;color:#475569">${r.id ? 'Registro N° ' + esc(r.id) : ''}</td></tr></table>
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
    <tr>${dato('AFI', r.afi)}${dato('EQUIPO', r.equipo)}${dato('FECHA', fecha(r.fecha))}</tr>
    <tr>${dato('EMPRESA', r.usuario_arriendo)}${dato('LUGAR', r.lugar)}${dato('TURNO', r.turno)}</tr>
    <tr>${dato('HORÓMETRO', r.horometro ? Number(r.horometro).toLocaleString('es-CL') : '')}${dato('HORARIO', [r.hora_inicio, r.hora_termino].filter(Boolean).join(' a '))}${dato('DURACIÓN', durTxt(r.duracion_min))}</tr>
  </table>
  <div style="${th}">DESCRIPCIÓN DE LA INSPECCIÓN</div>
  <div style="border:1px solid #333;border-top:0;min-height:60px;padding:4px 6px 8px;font-size:11px;white-space:pre-wrap">${esc((r.pauta && r.pauta.descripcion) || r.descripcion_insp || '')}</div>
  <table style="width:100%;border-collapse:collapse;margin-top:8px">
    <tr><td colspan="3" style="${th}">PUNTOS POR REALIZAR (NO SON FALLAS)</td></tr>
    <tr><td style="${td};font-weight:800;width:26px;text-align:center">N°</td><td style="${td};font-weight:800">DESCRIPCIÓN</td><td style="${td};font-weight:800;width:170px">TIPO</td></tr>
    ${hall.length ? hall.map((h, i) => `<tr><td style="${td};text-align:center">${i + 1}</td><td style="${td}">${esc(h.descripcion)}${h.foto ? ' <span style="color:#64748b">(foto adjunta)</span>' : ''}</td><td style="${td}">${esc(h.categoria)}</td></tr>`).join('')
      : `<tr><td colspan="3" style="${td};text-align:center;color:#475569">Sin puntos por realizar: equipo en buen estado visual.</td></tr>`}
  </table>
  <table style="width:100%;border-collapse:collapse;margin-top:10px"><tr><td style="${th}">INSPECCIONADO POR</td><td style="${th};width:170px;text-align:center">FIRMA</td></tr>
    ${mecs.map(m => `<tr><td style="${td};height:30px;font-weight:700">${esc(m.nombre)}</td><td style="${td};text-align:center">${firmaImg(m.firma, 28)}</td></tr>`).join('')}</table>
  <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:10px"><tr><td style="width:55%"></td>
    <td style="text-align:center;vertical-align:bottom"><div style="height:40px">${firmaImg(sup.firma, 38)}</div>
      <div style="border-top:1px solid #333;padding-top:2px;font-weight:700">${esc(sup.nombre)}${sup.empresa ? ' · ' + esc(sup.empresa) : ''}</div>
      <div style="font-style:italic;color:${V}">Nombre y firma supervisor${sup.tipo === 'CLIENTE' ? ' (cliente)' : ''}</div></td></tr></table>
  <div style="text-align:right;font-size:8px;color:#94a3b8;margin-top:6px">Inspección visual · llenado en la app de técnicos${r.created_at ? ' · ' + fecha(String(r.created_at).slice(0, 10)) : ''}</div>
 </div>
</div>`;
};

/** Texto para el Historial / columna descripción. */
export const resumenInspeccion = (f) => {
  const hall = (f.hallazgos || f.fallas || []).filter(h => String(h.descripcion || '').trim());
  return [
    'INSPECCIÓN VISUAL: ' + String(f.descripcion_insp || '').trim(),
    hall.length ? `Puntos por realizar (${hall.length}):` : 'Sin puntos por realizar.',
    ...hall.map((h, i) => `${i + 1}. ${h.categoria ? '[' + h.categoria + '] ' : ''}${String(h.descripcion).trim()}`)
  ].join('\n');
};
