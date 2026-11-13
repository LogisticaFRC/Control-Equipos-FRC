// =====================================================================
// MECÁNICOS · Hojas con el FORMATO OFICIAL (HTML → PDF / imprimir)
//   hojaIntervencion(r, logo)  → INTERVENCIÓN MECÁNICA (FRC-RE-OPE-017) o ELÉCTRICA (IE-FRC)   · A4 vertical
//   hojaBloqueo(r, logo)       → REGISTRO DE BLOQUEO (FRC-RE-OP-015)                           · A4 horizontal
// Todo con estilos en línea (sirve para html2canvas y para imprimir).
// =====================================================================
export const ANCHO_VERTICAL = 794;     // A4 a 96 dpi
export const ANCHO_HORIZONTAL = 1123;

const V = '#0f7a3d';          // verde FRC del formato
const VO = '#1f4d3a';         // verde oscuro (registro de bloqueo)
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fecha = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : esc(iso); };
const caja = (v, w = 'auto', extra = '') => `<span style="display:inline-block;min-width:${w};border:1px solid #333;padding:1px 6px 5px;line-height:15px;min-height:20px;font-weight:700;color:#0f172a;${extra}">${esc(v) || '&nbsp;'}</span>`;
const check = (on) => `<span style="display:inline-block;width:20px;height:16px;border:1px solid #333;text-align:center;line-height:15px;font-weight:900;font-size:12px;color:#0f172a">${on ? 'X' : '&nbsp;'}</span>`;
const firmaImg = (src, h = 34) => (src ? `<img src="${src}" style="height:${h}px;max-width:100%;object-fit:contain">` : '');
const lineasTexto = (texto, n, h = 19) => {
  const t = esc(texto || '');
  return `<div style="position:relative;border:1px solid #333;border-top:0;min-height:${n * h}px;background:repeating-linear-gradient(to bottom,transparent 0,transparent ${h - 1}px,#999 ${h - 1}px,#999 ${h}px)">
    <div style="padding:1px 8px;line-height:${h}px;white-space:pre-wrap;font-size:11.5px;color:#0f172a">${t}</div></div>`;
};
/** Banda de sección (formato mecánico 2026-11-13): número + título en verde. */
const banda = (n, t) => `<div style="display:flex;align-items:center;gap:8px;background:${V};color:#fff;border:1.5px solid #333;padding:2px 10px 6px;font-weight:800;font-size:11px;letter-spacing:.5px">${n ? `<span style="display:inline-block;background:#fff;color:${V};border-radius:9px;width:17px;height:17px;text-align:center;line-height:15px;font-size:10px;font-weight:900">${n}</span>` : ''}${t}</div>`;
const titulo = (t, color = V) => `<div style="border:1.5px solid #333;text-align:center;font-weight:700;font-style:italic;color:${color};font-size:11.5px;padding:1px 2px 6px;line-height:14px">${t}</div>`;

/** Encabezado con logo, título y cuadro código / fecha / versión. */
const encabezado = (logo, nombre, codigo, fechaDoc, version) => `
  <table style="width:100%;border-collapse:collapse;margin-bottom:6px"><tr>
    <td style="width:150px">${logo ? `<img src="${logo}" style="height:46px">` : '<b style="font-size:22px;color:' + VO + '">FRC</b>'}</td>
    <td style="text-align:center;font-size:20px;color:${V};letter-spacing:.5px">${nombre}</td>
    <td style="width:170px"><table style="border-collapse:collapse;font-size:9.5px;width:100%;color:${V};font-weight:700">
      <tr><td style="border:1px solid #333;padding:2px 4px">CÓDIGO:</td><td style="border:1px solid #333;padding:2px 4px;text-align:center">${codigo}</td></tr>
      <tr><td style="border:1px solid #333;padding:2px 4px">FECHA:</td><td style="border:1px solid #333;padding:2px 4px;text-align:center">${fechaDoc}</td></tr>
      <tr><td style="border:1px solid #333;padding:2px 4px">VERSIÓN:</td><td style="border:1px solid #333;padding:2px 4px;text-align:center">${version}</td></tr>
    </table></td></tr></table>`;

export const CAUSAS_ELECTRICA = ['FALLA OPERACIONAL', 'PUESTA EN MARCHA', 'CONEXIÓN/DESCONEXIÓN DE EQUIPO', 'INSPECCIÓN', 'PRUEBAS MEDICIONES'];
export const CAUSAS_FALLA_MEC = ['ACCIDENTE', 'FALLA OPERACIONAL', 'CONDICION DE LA OPERACION', 'FALLA MECANICA'];

/** INTERVENCIÓN MECÁNICA / ELÉCTRICA con el formato oficial. */
export const hojaIntervencion = (r, logo) => {
  const elec = r.tipo === 'ELECTRICA';
  const mecs = [...(r.mecanicos || [])];
  while (mecs.length < 3) mecs.push({ nombre: '', firma: '' });
  const resp = (r.mecanicos || [])[0] || {};
  const sup = r.supervisor || {};
  const lubs = [...(r.lubricantes || [])]; while (lubs.length < 4) lubs.push({ tipo: '', cantidad: '' });
  const lbl = (t) => `<b style="color:${V};font-size:10.5px">${t}</b>`;
  return `
<div style="width:${ANCHO_VERTICAL}px;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:26px 34px;box-sizing:border-box">
 <div style="border:2px solid #333;padding:14px 18px">
  ${encabezado(logo, elec ? 'INTERVENCIÓN ELÉCTRICA' : 'INTERVENCION MECANICA', elec ? 'IE-FRC' : 'FRC-RE-OPE-017', elec ? '20-01-2026' : '07-01-2026', elec ? '01' : '0')}
  <div style="font-weight:700;font-style:italic;color:${V};text-decoration:underline;font-size:11px;margin:4px 0 10px">SERVICIO TECNICO</div>
  <div style="display:flex;gap:10px;align-items:center;font-size:10.5px;margin-bottom:9px;flex-wrap:wrap">
    ${lbl('FECHA:')} ${caja(fecha(r.fecha), '80px')} ${lbl('EQUIPO:')} ${caja(r.equipo, '170px')} ${lbl('AFI:')} ${caja(r.afi, '48px')} ${lbl('HOROMETRO:')} ${caja(r.horometro ? Number(r.horometro).toLocaleString('es-CL') : '', '70px')}
  </div>
  <div style="display:flex;gap:10px;align-items:center;font-size:10.5px;margin-bottom:9px">
    ${lbl('TURNO:')} ${caja(r.turno, '50px')} ${lbl('LUGAR INTERVENCION:')} ${caja(r.lugar, '330px')}
  </div>
  <div style="display:flex;gap:10px;align-items:center;font-size:10.5px;margin-bottom:12px;justify-content:center">
    ${lbl('HORA FALLA:')} ${caja(r.hora_falla, '58px')} ${lbl('HORA INICIO:')} ${caja(r.hora_inicio, '58px')} ${lbl('HORA TERMINO:')} ${caja(r.hora_termino, '58px')}
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:10px"><tr>
    <td style="width:180px;vertical-align:top;padding-top:16px">
      <div style="margin-bottom:12px">${lbl('USO DE ART:')} ${check(r.uso_art)} <span style="font-size:9px">${!r.afi ? 'SI / NO' : r.uso_art ? 'SI' : 'NO'}</span></div>
      <div>${lbl('BLOQUEO DE EQUIPO:')} ${check(r.bloqueo)} <span style="font-size:9px">${!r.afi ? 'SI / NO' : r.bloqueo ? 'SI' : 'NO'}</span></div>
    </td>
    <td style="vertical-align:top">
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="text-align:center;font-weight:700;font-style:italic;color:${V};font-size:10px">${elec ? 'NOMBRE(S) ELECTRICISTA(S)' : 'NOMBRE MECANICO RESPONSABLE(S)'}</td><td style="width:110px;text-align:center;font-weight:700;font-style:italic;color:${V};font-size:10px">FIRMA</td></tr>
        ${mecs.map(m => `<tr><td style="border-bottom:1px solid #333;height:26px;padding:0 6px;font-weight:700">${esc(m.nombre)}</td><td style="border-bottom:1px solid #333;text-align:center">${firmaImg(m.firma, 24)}</td></tr>`).join('')}
      </table>
    </td></tr></table>
  ${elec ? `
  <!-- ELÉCTRICA (2026-11-13): mismo orden que la mecánica -->
  ${banda('1', 'CAUSA DE LA INTERVENCIÓN')}
  <div style="border:1.5px solid #333;border-top:0;padding:8px 6px;display:flex;justify-content:space-around;font-size:9.5px;font-weight:700;text-align:center">
    ${CAUSAS_ELECTRICA.map(c => `<div style="width:19%">${check(String(r.causa_intervencion || '').toUpperCase() === c)}<div style="margin-top:3px">${c}</div></div>`).join('')}
  </div>
  <div style="height:9px"></div>
  ${banda('2', 'DESCRIPCIÓN DE LO REALIZADO')}
  ${lineasTexto(r.descripcion, 9, 20)}
  <div style="height:9px"></div>
  ${banda('3', 'CAUSA DE LA FALLA')}
  <div style="border:1.5px solid #333;border-top:0;padding:6px 12px 9px;min-height:26px;font-size:12px;font-weight:800;color:#0f172a">${esc(r.causa_falla) || '&nbsp;'}</div>
  <div style="height:9px"></div>
  ${banda('', 'INTERFERENCIA')}
  ${lineasTexto(r.interferencia, 2, 22)}
  <table style="width:100%;border-collapse:collapse;font-size:9.5px;margin-top:10px">
    ${[['Usuario arriendo', r.usuario_arriendo], ['Operador (si es falla operacional)', r.operador], ['N° vale de consumo (repuestos)', r.vale_consumo]].map(([l, v]) => `<tr><td style="font-weight:700;color:${V};padding:3px 6px 6px;border-bottom:1px solid #9ca3af;width:30%">${l}</td><td style="font-weight:800;padding:3px 6px 6px;border-bottom:1px solid #9ca3af">${esc(v) || '&nbsp;'}</td></tr>`).join('')}
  </table>` : `
  <!-- MECÁNICA (2026-11-13): 1) causa de la intervención · 2) descripción · 3) causa de la falla (razón) -->
  ${banda('1', 'CAUSA DE LA INTERVENCIÓN')}
  <div style="border:1.5px solid #333;border-top:0;padding:8px 12px 10px;display:flex;align-items:center;gap:10px;min-height:30px">
    ${r.causa_falla ? `<span style="display:inline-block;background:#ecfdf5;border:1.5px solid ${V};border-radius:16px;padding:2px 14px 6px;font-weight:900;color:${V};font-size:13px;letter-spacing:.3px">${esc(r.causa_falla)}</span>` : (r.afi ? '<span style="color:#94a3b8;font-size:10px">—</span>' : '&nbsp;')}
  </div>
  <div style="height:9px"></div>
  ${banda('2', 'DESCRIPCIÓN DE LO REALIZADO')}
  ${lineasTexto(r.descripcion, 8, 20)}
  <div style="height:9px"></div>
  ${banda('3', 'CAUSA DE LA FALLA')}
  <div style="border:1.5px solid #333;border-top:0;padding:6px 12px 9px;min-height:26px;font-size:12px;font-weight:800;color:#0f172a">${esc(r.causa_intervencion) || '&nbsp;'}</div>
  <div style="height:9px"></div>
  ${banda('', 'INTERFERENCIA')}
  ${lineasTexto(r.interferencia, 1, 22)}
  <table style="width:100%;border-collapse:collapse;margin-top:10px"><tr>
    <td style="width:48%;vertical-align:top"><table style="width:100%;border-collapse:collapse;font-size:10px">
      <tr><td style="background:${V};color:#fff;font-weight:800;padding:2px 6px 5px;border:1px solid #333">LUBRICANTE UTILIZADO</td><td style="background:${V};color:#fff;font-weight:800;padding:2px 6px 5px;border:1px solid #333;text-align:center;width:34%">CANTIDAD</td></tr>
      ${lubs.slice(0, Math.max(3, lubs.length)).map(l => `<tr><td style="border:1px solid #9ca3af;height:18px;padding:0 6px 3px;font-weight:700">${esc(l.tipo)}</td><td style="border:1px solid #9ca3af;padding:0 4px 3px;font-weight:700;text-align:center">${esc(l.cantidad)}${l.cantidad && /^[\d.,]+$/.test(String(l.cantidad).trim()) ? ' L' : ''}</td></tr>`).join('')}
    </table></td>
    <td style="width:4%"></td>
    <td style="vertical-align:top"><table style="width:100%;border-collapse:collapse;font-size:9.5px">
      ${[['Usuario arriendo', r.usuario_arriendo], ['Operador (si es falla operacional)', r.operador], ['N° vale de consumo (repuestos)', r.vale_consumo]].map(([l, v]) => `<tr><td style="font-weight:700;color:${V};padding:3px 6px 6px;border-bottom:1px solid #9ca3af;width:52%">${l}</td><td style="font-weight:800;padding:3px 6px 6px;border-bottom:1px solid #9ca3af">${esc(v) || '&nbsp;'}</td></tr>`).join('')}
    </table></td></tr></table>`}
  <table style="width:100%;border-collapse:collapse;margin-top:${elec ? 26 : 16}px;font-size:10px"><tr>
    <td style="width:44%;text-align:center;vertical-align:bottom">
      <div style="height:42px">${firmaImg(resp.firma, 40)}</div>
      <div style="border-top:1px solid #333;padding-top:2px;font-weight:700">${esc(resp.nombre)}</div>
      <div style="font-style:italic;color:${V}">${elec ? 'Nombre y firma encargado' : 'Nombre y firma mecanico responsable'}</div></td>
    <td></td>
    <td style="width:44%;text-align:center;vertical-align:bottom">
      <div style="height:42px">${firmaImg(sup.firma, 40)}</div>
      <div style="border-top:1px solid #333;padding-top:2px;font-weight:700">${esc(sup.nombre)}${sup.empresa ? ' · ' + esc(sup.empresa) : ''}</div>
      <div style="font-style:italic;color:${V}">Nombre y firma supervisor${sup.tipo === 'CLIENTE' ? ' (cliente)' : ''}</div></td>
  </tr></table>
  ${r.id ? `<div style="text-align:right;font-size:8px;color:#94a3b8;margin-top:8px">Registro N° ${esc(r.id)} · llenado en la app de mecánicos${r.created_at ? ' · ' + fecha(String(r.created_at).slice(0, 10)) : ''}</div>` : ''}
 </div>
</div>`;
};

// ---------------------------------------------------------------------
// REGISTRO DE BLOQUEO (FRC-RE-OP-015)
// ---------------------------------------------------------------------
export const TIPOS_EQUIPO_BLOQUEO = ['Generador', 'Minicargador', 'Compresor', 'Manipulador telescópico', 'Camión pluma', 'Torre de iluminación', 'Excavadora', 'Camión de servicio'];
export const ENERGIAS = ['Eléctrica', 'Mecánica', 'Hidráulica', 'Neumática', 'Cinética', 'Gravitacional / Potencial', 'Térmica', 'Combustible / Química', 'Residual / Almacenada'];
export const DOCUMENTOS_BLOQUEO = ['Analisis de Riesgo de Tarea (ART)', 'Procedimiento', 'Instructivo'];
export const REGLAS_ORO = ['Preparar (Detener equipo)', 'Aislar (Corte de Energía)', 'Bloquear (Instalar Bloqueo)', 'Probar (Verificar Energía Cero)', 'Autorizar (Instalar Bloqueo)', 'Segregar (Delimitar el Área)'];

export const bloqueoVacio = () => ({
  solicitante: '', encargado: '', area: '', fecha: '', hora_inicio: '', equipo: '', actividad: '', tipo_equipo: '', otro: '',
  energias: ENERGIAS.map(() => ''),                       // 'P' presente · 'NA' no aplica
  documentos: DOCUMENTOS_BLOQUEO.map(() => ({ codigo: '', r: '' })),   // r: 'SI' | 'NO' | 'NA'
  reglas: REGLAS_ORO.map(() => ({ r: '', obs: '' })),
  verificacion: { nombre: '', rut: '', candado: '', hora: '', firma: '' },
  personal: [{ nombre: '', rut: '', candado: '', h_inicio: '', h_retiro: '', firma: '' }]
});

export const hojaBloqueo = (r, logo) => {
  const b = r.registro_bloqueo || bloqueoVacio();
  const th = `background:${VO};color:#fff;font-weight:700;font-size:10px;padding:3px;border:1px solid ${VO}`;
  const td = 'border:1px solid #9ca3af;padding:2px 5px;font-size:10px;height:20px';
  const ok = (v) => (v ? '✓' : '');
  const sec = (n, t, cols = 6) => `<tr><td style="${th};width:18px;background:#22c55e;border-color:#22c55e">${n}</td><td colspan="${cols}" style="${th};text-align:center">${t}</td></tr>`;
  const per = [...(b.personal || [])]; while (per.length < 5) per.push({});
  const campo = (lbl, v) => `<tr><td style="font-size:10px;font-weight:700;text-align:right;padding:3px 6px;white-space:nowrap">${lbl}</td><td style="border-bottom:1px solid #333;font-size:10.5px;font-weight:700;padding:3px 6px">${esc(v)}</td></tr>`;
  return `
<div style="width:${ANCHO_HORIZONTAL}px;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:22px 28px;box-sizing:border-box">
  <table style="width:100%;border-collapse:collapse"><tr>
    <td style="width:170px">${logo ? `<img src="${logo}" style="height:42px">` : ''}</td>
    <td style="text-align:center;font-size:28px;font-weight:900;color:${VO}">REGISTRO DE BLOQUEO</td>
    <td style="width:150px"><table style="border-collapse:collapse;font-size:9.5px;font-weight:700;width:100%">
      <tr><td colspan="2" style="border:1px solid #22c55e;text-align:center;padding:2px">FRC-RE-OP-015</td></tr>
      <tr><td style="border:1px solid #22c55e;text-align:center;padding:2px">9/3/2026</td><td style="border:1px solid #22c55e;text-align:center">REV:0</td></tr></table></td>
  </tr></table>
  <div style="text-align:center;font-size:8.5px;font-weight:700;color:${VO};margin:2px 0 8px">APLICABLE A: GENERADORES - MINICARGADORES - COMPRESORES - MANIPULADOR TELESCÓPICO - CAMIONES PLUMA - TORRE DE ILUMINACIÓN - EXCAVADORA - CAMIÓN DE SERVICIO - OTROS EQUIPOS</div>
  <table style="width:100%;border-collapse:collapse"><tr>
   <td style="width:49%;vertical-align:top">
    <table style="width:100%;border-collapse:collapse">${sec(1, 'IDENTIFICACIÓN DEL TRABAJO', 1)}</table>
    <table style="width:100%;border-collapse:collapse;margin-top:3px">
      ${campo('1. Solicitante del bloqueo:', b.solicitante)}${campo('2. Encargado / Responsable:', b.encargado)}${campo('3. Área / Faena:', b.area)}
      ${campo('4. Fecha / Hora inicio:', `${fecha(b.fecha)}   ${b.hora_inicio ? '· ' + b.hora_inicio : ''}`)}${campo('5. Equipo / Código / Patente:', b.equipo)}${campo('6. Actividad / Motivo del bloqueo:', b.actividad)}
    </table>
    <div style="font-size:10px;font-weight:700;margin:6px 0 3px">7. Tipo de equipo:</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">${TIPOS_EQUIPO_BLOQUEO.map((t, i) => `<span style="border:1.5px solid #22c55e;border-radius:5px;padding:3px 6px;font-size:9px;font-weight:700;${b.tipo_equipo === t ? 'background:#dcfce7' : ''}">${b.tipo_equipo === t ? '☒' : '☐'} ${i + 1}. ${t}</span>`).join('')}
      <span style="font-size:9px;font-weight:700;padding:3px 6px">${b.tipo_equipo === 'Otro' ? '☒' : '☐'} 9. Otro: ${esc(b.otro)}</span></div>
    <table style="width:100%;border-collapse:collapse;margin-top:8px">${sec(3, 'DOCUMENTACIÓN Y PLANIFICACIÓN', 5)}
      <tr><td style="${td};font-weight:700">Nº</td><td style="${td};font-weight:700;text-align:center">DOCUMENTO</td><td style="${td};font-weight:700">CÓDIGO PROCEDIMIENTO / INSTRUCTIVO</td><td style="${td};font-weight:700;text-align:center">SÍ</td><td style="${td};font-weight:700;text-align:center">NO</td><td style="${td};font-weight:700;text-align:center">N/A</td></tr>
      ${DOCUMENTOS_BLOQUEO.map((d, i) => { const x = (b.documentos || [])[i] || {}; return `<tr><td style="${td}">${i + 1}</td><td style="${td};text-align:center">${d}</td><td style="${td}">${esc(x.codigo)}</td><td style="${td};text-align:center">${ok(x.r === 'SI')}</td><td style="${td};text-align:center">${ok(x.r === 'NO')}</td><td style="${td};text-align:center">${ok(x.r === 'NA')}</td></tr>`; }).join('')}
    </table>
    <table style="width:100%;border-collapse:collapse;margin-top:8px">${sec(4, 'LAS 6 REGLAS DE ORO', 5)}
      <tr><td style="${td};font-weight:700">Nº</td><td style="${td};font-weight:700;text-align:center">REGLA</td><td style="${td};font-weight:700;text-align:center">SÍ</td><td style="${td};font-weight:700;text-align:center">NO</td><td style="${td};font-weight:700;text-align:center">N/A</td><td style="${td};font-weight:700;text-align:center">OBSERVACIONES</td></tr>
      ${REGLAS_ORO.map((g, i) => { const x = (b.reglas || [])[i] || {}; return `<tr><td style="${td}">${i + 1}</td><td style="${td}">${g}</td><td style="${td};text-align:center">${ok(x.r === 'SI')}</td><td style="${td};text-align:center">${ok(x.r === 'NO')}</td><td style="${td};text-align:center">${ok(x.r === 'NA')}</td><td style="${td}">${esc(x.obs)}</td></tr>`; }).join('')}
    </table>
   </td>
   <td style="width:2%"></td>
   <td style="vertical-align:top">
    <table style="width:100%;border-collapse:collapse">${sec(2, 'ENERGÍAS A CONTROLAR', 3)}
      <tr><td style="${td};font-weight:700">Nº</td><td style="${td};font-weight:700;text-align:center">ENERGÍA</td><td style="${td};font-weight:700;text-align:center">PRESENTE (✓)</td><td style="${td};font-weight:700;text-align:center">NO APLICA (✓)</td></tr>
      ${ENERGIAS.map((e, i) => `<tr><td style="${td}">${i + 1}</td><td style="${td}">${e}</td><td style="${td};text-align:center;font-weight:900">${ok((b.energias || [])[i] === 'P')}</td><td style="${td};text-align:center;font-weight:900">${ok((b.energias || [])[i] === 'NA')}</td></tr>`).join('')}
    </table>
    <table style="width:100%;border-collapse:collapse;margin-top:8px">${sec(5, 'VERIFICACIÓN DE ENERGÍA CERO', 4)}
      <tr><td colspan="5" style="font-size:10px;font-weight:700;padding:3px">1. Responsable de la verificación:</td></tr>
      <tr><td style="${td};font-weight:700;text-align:center">NOMBRE COMPLETO</td><td style="${td};font-weight:700;text-align:center">RUT</td><td style="${td};font-weight:700;text-align:center">Nº CANDADO/LLAVE</td><td style="${td};font-weight:700;text-align:center">HORA</td><td style="${td};font-weight:700;text-align:center">FIRMA</td></tr>
      <tr><td style="${td};height:30px">${esc(b.verificacion?.nombre)}</td><td style="${td}">${esc(b.verificacion?.rut)}</td><td style="${td}">${esc(b.verificacion?.candado)}</td><td style="${td}">${esc(b.verificacion?.hora)}</td><td style="${td};text-align:center">${firmaImg(b.verificacion?.firma, 26)}</td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;margin-top:8px">${sec(6, 'BLOQUEO PERSONAL', 6)}
      <tr><td style="${td};font-weight:700">Nº</td><td style="${td};font-weight:700;text-align:center">NOMBRE COMPLETO</td><td style="${td};font-weight:700;text-align:center">RUT</td><td style="${td};font-weight:700;text-align:center">Nº CANDADO</td><td style="${td};font-weight:700;text-align:center">H. INICIO</td><td style="${td};font-weight:700;text-align:center">H. RETIRO</td><td style="${td};font-weight:700;text-align:center">FIRMA</td></tr>
      ${per.slice(0, Math.max(5, per.length)).map((p, i) => `<tr><td style="${td}">${i + 1}</td><td style="${td}">${esc(p.nombre)}</td><td style="${td}">${esc(p.rut)}</td><td style="${td}">${esc(p.candado)}</td><td style="${td}">${esc(p.h_inicio)}</td><td style="${td}">${esc(p.h_retiro)}</td><td style="${td};text-align:center">${firmaImg(p.firma, 18)}</td></tr>`).join('')}
    </table>
   </td></tr></table>
  <div style="margin-top:10px;background:${VO};color:#fff;border-radius:4px;padding:12px;text-align:center;font-weight:900;font-size:15px;letter-spacing:.3px">
    NO INICIAR LA INTERVENCIÓN SIN <span style="color:#4ade80">AISLAR, BLOQUEAR, LIBERAR Y VERIFICAR</span><br>LA AUSENCIA DE TODAS LAS ENERGÍAS PELIGROSAS.</div>
  <div style="text-align:right;font-size:8px;color:#94a3b8;margin-top:4px">Anexo de la intervención N° ${esc(r.id || '')} · AFI ${esc(r.afi)}</div>
</div>`;
};
