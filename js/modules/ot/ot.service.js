// =====================================================================
// OT · Órdenes de Trabajo (formato FRC-RE-OPE-006)
// - El folio se escribe a mano (no se puede repetir); se sugiere el mayor + 1.
// - Al escribir el AFI se completan Equipo, Marca, Modelo y HRS ACTUAL desde el Inventario.
// - Una OT queda "Realizada" cuando en el Historial existe una mantención con ese N° de OT.
// - Exportar Excel: rellena la plantilla original (plantillas/FORMATO_OT.xlsx) → queda idéntica.
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { TABLAS } from '../../core/tablas.js';
import { usuarioActivo, currentTab, dbIntervenciones, buscarEquipoPorAfi, soloAdmin, soloEditor } from '../../core/store.js';
import { hoyISO, limpiarAfi } from '../../core/utils.js';
import { FORMATO_OT } from './ot.formato.js';
import { abrirFormularioNuevaMantencion, formMant } from '../historial/historial.service.js';

const { ref, computed } = Vue;

export const TABLA_OT = TABLAS.OT;
export const N_ACTIVIDADES = 20, N_INSUMOS = 10, N_PERSONAL = 4;
/** Filas de insumos del formato usadas para ACEITES (las demás son repuestos; se pueden agregar más filas que las 10 del papel). */
export const N_ACEITES = 4;
export const TIPOS_OT = ['PREVENTIVA', 'CORRECTIVA', 'PREDICTIVA'];
export const PAUTAS_OT = ['250', '500', '1000', '5000'];
const PLANTILLA_URL = 'plantillas/FORMATO_OT.xlsx';

const filas = (n, campos) => Array.from({ length: n }, () => Object.fromEntries(campos.map(c => [c, ''])));
const actVacia = () => filas(N_ACTIVIDADES, ['descripcion', 'ejecutante', 'f_inicio', 'f_term', 'h_inicio', 'h_term']);
const insVacio = () => filas(N_INSUMOS, ['aceites', 'repuestos', 'fecha', 'retira']);
const perVacio = () => filas(N_PERSONAL, ['nombre', 'cargo']);
/** Completa un arreglo guardado hasta n filas (por si en la BD vienen menos). */
const completar = (arr, vacio) => vacio.map((v, i) => ({ ...v, ...((Array.isArray(arr) && arr[i]) || {}) }));

export const otVacia = () => ({
  id: null, folio: null, fecha: hoyISO(), afi: '', equipo: '', marca: '', modelo: '', hrs_actual: '', hrs_prox: '',
  tipo_mantencion: '', pauta: '', actividades: actVacia(), insumos: insVacio(), personal: perVacio(),
  mecanico: '', supervisor: '', estado: 'ABIERTA'
});

export const mapOT = (r) => ({
  ...otVacia(), ...r,
  fecha: r.fecha || '', hrs_actual: r.hrs_actual ?? '', hrs_prox: r.hrs_prox ?? '',
  actividades: completar(r.actividades, actVacia()), insumos: [...completar(r.insumos, insVacio()), ...(Array.isArray(r.insumos) ? r.insumos.slice(N_INSUMOS) : [])],   /* filas extra = repuestos adicionales */ personal: completar(r.personal, perVacio())
});

// ---------- Estado ----------
export const dbOT = ref([]);
export const cargandoOT = ref(false);
export const otActual = ref(null);         // OT abierta en el editor (copia editable)
export const guardandoOT = ref(false);
export const filtroOT = ref({ texto: '', estado: '' });
/** Folio a abrir apenas se carguen las OT (ej. al hacer clic en el N° OT del Historial). */
export const folioPorAbrir = ref(null);

export const cargarOT = async () => {
  cargandoOT.value = true;
  try {
    const data = await sb(supabaseClient.from(TABLA_OT).select('*').order('folio', { ascending: false }));
    dbOT.value = data.map(mapOT);
    if (folioPorAbrir.value) {
      const ot = dbOT.value.find(o => Number(o.folio) === Number(folioPorAbrir.value));
      folioPorAbrir.value = null;
      if (ot) abrirOT(ot);
    }
  } catch (err) {
    alert('No se pudieron cargar las OT: ' + errMsg(err) + (/bd_ot/i.test(errMsg(err)) ? '\nEjecuta sql/ot.sql en Supabase.' : ''));
  } finally {
    cargandoOT.value = false;
  }
};

// ---------- Relación con el Historial ----------
const numeroDe = (v) => { const m = String(v || '').match(/\d+/); return m ? Number(m[0]) : null; };
/** Mantenciones del Historial cuyo N° OT es el folio. */
export const mantencionesDeOT = (folio) => dbIntervenciones.value.filter(i => folio && numeroDe(i.numeroOT) === Number(folio));
/** 'REALIZADA' (registrada en Historial) · 'ANULADA' · 'PENDIENTE' */
export const estadoOT = (ot) => {
  if (!ot) return 'PENDIENTE';
  if (ot.estado === 'ANULADA') return 'ANULADA';
  return mantencionesDeOT(ot.folio).length ? 'REALIZADA' : 'PENDIENTE';
};
export const ESTILO_ESTADO_OT = {
  PENDIENTE: 'bg-amber-100 text-amber-800 border-amber-300',
  REALIZADA: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  ANULADA: 'bg-slate-200 text-slate-500 border-slate-300 line-through'
};

export const listaOT = computed(() => {
  const q = filtroOT.value.texto.trim().toLowerCase();
  return dbOT.value.filter(o => {
    if (filtroOT.value.estado && estadoOT(o) !== filtroOT.value.estado) return false;
    if (!q) return true;
    const txt = [o.folio, o.afi, o.equipo, o.marca, o.modelo, o.tipo_mantencion, o.mecanico,
      ...o.actividades.map(a => a.descripcion + ' ' + a.ejecutante)].join(' ').toLowerCase();
    return txt.includes(q);
  });
});
export const resumenOT = computed(() => {
  const r = { total: dbOT.value.length, PENDIENTE: 0, REALIZADA: 0, ANULADA: 0 };
  dbOT.value.forEach(o => { r[estadoOT(o)]++; });
  return r;
});

// ---------- Editor ----------
/** Folio sugerido: el mayor registrado + 1 (solo como ayuda; el folio se escribe a mano). */
export const folioSugerido = computed(() => (dbOT.value.reduce((m, o) => Math.max(m, Number(o.folio) || 0), 0) || 59) + 1);
export const nuevaOT = (afi = '') => {
  if (!soloEditor()) return;
  otActual.value = otVacia();
  if (afi) { otActual.value.afi = afi; autocompletarDesdeAfi(); }
};
export const abrirOT = (ot) => { otActual.value = JSON.parse(JSON.stringify(ot)); };
export const cerrarOT = () => { otActual.value = null; };

/** Lee / escribe un campo del formato: 'afi', 'act.3.descripcion', 'ins.0.retira', 'per.1.nombre'... */
export const valorCampo = (ot, k) => {
  if (!ot || !k) return '';
  const [g, i, c] = k.split('.');
  if (g === 'act') return ot.actividades[i][c];
  if (g === 'ins') return ot.insumos[i][c];
  if (g === 'per') return ot.personal[i][c];
  return ot[k] ?? '';
};
export const fijarCampo = (ot, k, v) => {
  const [g, i, c] = k.split('.');
  if (g === 'act') ot.actividades[i][c] = v;
  else if (g === 'ins') ot.insumos[i][c] = v;
  else if (g === 'per') ot.personal[i][c] = v;
  else ot[k] = v;
};
/** Tipo de dato del campo (para el editor). */
export const tipoCampo = (k) => {
  if (/\.(f_inicio|f_term|fecha)$/.test(k)) return 'date';
  if (/\.(h_inicio|h_term)$/.test(k)) return 'time';
  return 'text';
};

/** Al escribir el AFI: completa Equipo, Marca, Modelo y HRS ACTUAL desde el Inventario. */
const equipoPorAfi = (afi) => buscarEquipoPorAfi(String(afi || '').trim()) || buscarEquipoPorAfi(limpiarAfi(afi));
export const autocompletarDesdeAfi = () => {
  const ot = otActual.value;
  if (!ot) return;
  const eq = equipoPorAfi(ot.afi);
  if (!eq) return;
  ot.afi = eq.afi;
  ot.equipo = eq.tipo || ot.equipo;
  ot.marca = eq.marca || ot.marca;
  ot.modelo = eq.modelo || ot.modelo;
  if (eq.horometroActual) ot.hrs_actual = String(Math.round(eq.horometroActual * 10) / 10);
};
export const equipoDeOT = computed(() => otActual.value ? equipoPorAfi(otActual.value.afi) : null);

export const alternarTipo = (t) => { const ot = otActual.value; ot.tipo_mantencion = ot.tipo_mantencion === t ? '' : t; };
export const alternarPauta = (p) => { const ot = otActual.value; ot.pauta = ot.pauta === p ? '' : p; };

export const payloadOT = (ot) => ({
  folio: Number(ot.folio),
  fecha: ot.fecha || hoyISO(), afi: (equipoPorAfi(ot.afi) || {}).afi || limpiarAfi(ot.afi), equipo: ot.equipo, marca: ot.marca, modelo: ot.modelo,
  hrs_actual: String(ot.hrs_actual ?? ''), hrs_prox: String(ot.hrs_prox ?? ''),
  tipo_mantencion: ot.tipo_mantencion, pauta: ot.pauta,
  actividades: ot.actividades, insumos: ot.insumos, personal: ot.personal,
  mecanico: ot.mecanico, supervisor: ot.supervisor, estado: ot.estado || 'ABIERTA',
  // Enlace al Taller de reparación: solo se envía si la OT lo tiene (así funciona aunque falte ejecutar sql/taller.sql)
  ...(('reparacion_id' in ot) ? { reparacion_id: ot.reparacion_id ?? null } : {}),
  // Firmas dibujadas del mecánico / supervisor (columna de sql/taller_firmas_problemas.sql): solo si la OT las tiene
  ...(('firmas' in ot) ? { firmas: ot.firmas || {} } : {}),
  updated_at: new Date().toISOString()
});

export const guardarOT = async () => {
  if (!soloEditor()) return false;
  const ot = otActual.value;
  const folio = Number(String(ot.folio ?? '').replace(/\D/g, ''));
  if (!folio) { alert('Ingresa el N° de FOLIO de la OT (arriba a la derecha de la hoja).'); return false; }
  ot.folio = folio;
  const repetida = dbOT.value.find(o => Number(o.folio) === folio && o.id !== ot.id);
  if (repetida) { alert(`Ya existe la OT N° ${folio} (AFI ${repetida.afi}). Usa otro folio.`); return false; }
  if (!ot.afi.trim()) { alert('Ingresa el AFI del equipo.'); return false; }
  guardandoOT.value = true;
  try {
    if (ot.id) {
      await sb(supabaseClient.from(TABLA_OT).update(payloadOT(ot)).eq('id', ot.id));
    } else {
      const u = usuarioActivo.value;
      const [fila] = await sb(supabaseClient.from(TABLA_OT).insert([{ ...payloadOT(ot), creado_por: (u && (u.nombre || u.usuario)) || '' }]).select());
      ot.id = fila.id;
    }
    const guardada = mapOT(JSON.parse(JSON.stringify(ot)));
    const i = dbOT.value.findIndex(o => o.id === ot.id);
    if (i >= 0) dbOT.value.splice(i, 1, guardada); else dbOT.value.unshift(guardada);
    return true;
  } catch (err) {
    alert(/duplicate|unique/i.test(errMsg(err)) ? `Ya existe otra OT con el folio ${ot.folio}.`
      : (/reparacion_id/i.test(errMsg(err)) ? 'Falta ejecutar sql/taller.sql en Supabase (columna reparacion_id de bd_ot).' : 'Error al guardar la OT: ' + errMsg(err)));
    return false;
  } finally {
    guardandoOT.value = false;
  }
};

export const anularOT = async (ot) => {
  if (!soloAdmin()) return;
  const anular = ot.estado !== 'ANULADA';
  if (!confirm(anular ? `¿Anular la OT N° ${ot.folio}? (el folio no se reutiliza)` : `¿Reactivar la OT N° ${ot.folio}?`)) return;
  try {
    await sb(supabaseClient.from(TABLA_OT).update({ estado: anular ? 'ANULADA' : 'ABIERTA' }).eq('id', ot.id));
    ot.estado = anular ? 'ANULADA' : 'ABIERTA';
    const o = dbOT.value.find(x => x.id === ot.id); if (o) o.estado = ot.estado;
  } catch (err) { alert('Error: ' + errMsg(err)); }
};

export const eliminarOT = async (ot) => {
  if (!soloAdmin()) return;
  if (!confirm(`¿Eliminar definitivamente la OT N° ${ot.folio}?\nSi solo quieres dejarla sin efecto, usa "Anular".`)) return;
  try {
    await sb(supabaseClient.from(TABLA_OT).delete().eq('id', ot.id));
    dbOT.value = dbOT.value.filter(o => o.id !== ot.id);
    if (otActual.value && otActual.value.id === ot.id) otActual.value = null;
  } catch (err) { alert('Error al eliminar: ' + errMsg(err)); }
};

// ---------- Pasar al Historial ----------
const TIPO_HISTORIAL = (ot) => {
  if (ot.tipo_mantencion === 'PREVENTIVA') return ['250', '500', '1000'].includes(ot.pauta) ? `PREVENTIVA ${ot.pauta} HRS` : 'PREVENTIVA';
  return ot.tipo_mantencion || '';
};
/** Abre el formulario de mantención ya rellenado con los datos de la OT (N° OT = folio). */
export const registrarEnHistorial = async (ot) => {
  if (!soloEditor()) return;
  if (!ot.id) { if (!(await guardarOT())) return; ot = otActual.value; }
  const acts = ot.actividades.filter(a => a.descripcion.trim());
  const nombres = [...new Set([...ot.personal.map(p => p.nombre), ...acts.map(a => a.ejecutante)].map(s => String(s || '').trim()).filter(Boolean))];
  abrirFormularioNuevaMantencion(ot.afi);
  const f = formMant.value;
  f.numeroOT = String(ot.folio);
  f.fecha = acts.map(a => a.f_term).filter(Boolean).sort().pop() || hoyISO();
  f.horometro = ot.hrs_actual || '';
  f.tipoMant = TIPO_HISTORIAL(ot) || f.tipoMant;
  if (ot.tipo_mantencion === 'CORRECTIVA') f.causa = 'REPARACION';
  f.descripcion = acts.map(a => a.descripcion.trim()).join('\n');
  f.horaInicio = (acts.find(a => a.h_inicio) || {}).h_inicio || '';
  f.horaTermino = ([...acts].reverse().find(a => a.h_term) || {}).h_term || '';
  [f.mec1, f.mec2, f.mec3, f.mec4] = [nombres[0] || '', nombres[1] || '', nombres[2] || '', nombres[3] || ''];
};

// ---------- Texto que va en cada celda (impresión / Excel) ----------
const fmtFecha = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : String(iso || ''); };
/** Texto final de una celda con campo (k) del formato. */
export const textoCelda = (ot, k) => {
  if (k.startsWith('tipo:')) return ot.tipo_mantencion === k.slice(5) ? 'X' : '';
  if (k.startsWith('pauta:')) return ot.pauta === k.slice(6) ? 'X' : '';
  if (k === 'folio') return ot.folio ? String(ot.folio) : '';
  const v = valorCampo(ot, k);
  return tipoCampo(k) === 'date' ? fmtFecha(v) : String(v ?? '');
};

// ---------- Exportar a Excel (plantilla original, sin perder formato) ----------
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const COLS = (() => { const o = {}; for (let i = 1; i <= 52; i++) { let n = i, s = ''; while (n) { s = String.fromCharCode(65 + (n - 1) % 26) + s; n = Math.floor((n - 1) / 26); } o[i] = s; } return o; })();

/** Escribe un valor en una celda del XML de la hoja conservando su estilo (s="..."). */
const escribirCelda = (xml, ref, valor) => {
  const re = new RegExp(`<c r="${ref}"([^>]*?)(/>|>[\\s\\S]*?</c>)`);
  const m = xml.match(re);
  if (!m) return xml;   // todas las celdas del formato existen en la plantilla
  const estilo = (m[1].match(/\ss="\d+"/) || [''])[0];
  const v = String(valor ?? '');
  let nueva;
  if (v === '') nueva = `<c r="${ref}"${estilo}/>`;
  else if (/^-?\d+(\.\d+)?$/.test(v) && !/^-?0\d/.test(v) && v.length < 15) nueva = `<c r="${ref}"${estilo}><v>${v}</v></c>`;
  else nueva = `<c r="${ref}"${estilo} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  return xml.replace(re, nueva);
};

export const exportandoOT = ref(false);
export const exportarOTExcel = async (ot) => {
  if (!window.JSZip) return alert('No se pudo cargar el generador de Excel (revisa la conexión a internet).');
  exportandoOT.value = true;
  try {
    const resp = await fetch(PLANTILLA_URL, { cache: 'no-cache' });
    if (!resp.ok) throw new Error('No se encontró la plantilla ' + PLANTILLA_URL);
    const zip = await JSZip.loadAsync(await resp.arrayBuffer());
    const ruta = 'xl/worksheets/sheet1.xml';
    let xml = await zip.file(ruta).async('string');
    FORMATO_OT.celdas.filter(c => c.k).forEach(c => { xml = escribirCelda(xml, COLS[c.c] + c.r, textoCelda(ot, c.k)); });
    zip.file(ruta, xml);
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `OT_${String(ot.folio || 'BORRADOR').padStart(3, '0')}_${limpiarAfi(ot.afi) || 'SIN_AFI'}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (err) {
    alert('Error al exportar: ' + errMsg(err));
  } finally {
    exportandoOT.value = false;
  }
};

// ---------- Imprimir (réplica HTML del formato) ----------
const BORDE = (n) => n ? `${n}px solid #000` : 'none';
export const estiloCelda = (c, escala = 1) => {
  const s = {
    borderTop: BORDE(c.b && c.b[0]), borderRight: BORDE(c.b && c.b[1]), borderBottom: BORDE(c.b && c.b[2]), borderLeft: BORDE(c.b && c.b[3]),
    fontSize: ((c.fs || 10) * 4 / 3 * escala).toFixed(1) + 'px',
    fontWeight: c.fb ? '700' : '400',
    fontFamily: c.ff === 'r' ? "Rockwell, 'Rockwell Nova', Georgia, serif" : 'Arial, Helvetica, sans-serif',
    textAlign: c.al === 'c' ? 'center' : (c.al === 'r' ? 'right' : 'left'),
    verticalAlign: c.va === 't' ? 'top' : (c.va === 'm' ? 'middle' : 'bottom')
  };
  if (c.wr) { s.whiteSpace = 'normal'; s.lineHeight = '1'; }
  return s;
};
const css = (o) => Object.entries(o).map(([k, v]) => k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()) + ':' + v).join(';');
const htmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- Firmas dibujadas sobre la hoja ----------
/** Posición (px, tamaño real) de un rango de celdas del formato: fila r, columna c (desde 1). */
export const rectCelda = (r, c, rs = 1, cs = 1) => {
  const F = FORMATO_OT, suma = (arr, a, b) => arr.slice(a, b).reduce((x, y) => x + y, 0);
  return { left: suma(F.cols, 0, c - 1), top: suma(F.rows, 0, r - 1), width: suma(F.cols, c - 1, c - 1 + cs), height: suma(F.rows, r - 1, r - 1 + rs) };
};
/** Firmas de la OT con su lugar en la hoja: mecánico (B65), supervisor (W65) y "Firma" del personal asignado (U57..U60). */
export const firmasEnHoja = (ot) => {
  if (!ot) return [];
  const out = [];
  const f = ot.firmas || {};
  if (f.mecanico) out.push({ k: 'mecanico', src: f.mecanico, ...rectCelda(65, 2, 2, 15) });
  if (f.supervisor) out.push({ k: 'supervisor', src: f.supervisor, ...rectCelda(65, 23, 2, 18) });
  (ot.personal || []).forEach((p, i) => { if (p && p.firma) out.push({ k: 'per' + i, src: p.firma, ...rectCelda(57 + i, 21, 1, 7) }); });
  return out;
};

/** Pone una firma en la OT abierta en el editor (se guarda con "Guardar"). */
export const fijarFirmaEditor = (ot, clave, url) => {
  if (clave.startsWith('per.')) ot.personal[Number(clave.slice(4))].firma = url || '';
  else ot.firmas = { ...(ot.firmas || {}), [clave]: url || '' };
};

/** HTML de la hoja completa con los datos de la OT. */
export const htmlHojaOT = (ot) => {
  const F = FORMATO_OT;
  const porFila = {};
  F.celdas.forEach(c => { (porFila[c.r] = porFila[c.r] || []).push(c); });
  const filasHtml = F.rows.map((h, i) => {
    const r = i + 1;
    const tds = (porFila[r] || []).map(c => {
      const txt = c.k ? textoCelda(ot, c.k) : (c.t || '');
      const extra = c.k && (c.k.startsWith('tipo:') || c.k.startsWith('pauta:')) ? ';text-align:center;font-weight:700' : '';
      return `<td${c.rs ? ` rowspan="${c.rs}"` : ''}${c.cs ? ` colspan="${c.cs}"` : ''} style="${css(estiloCelda(c))}${extra}">${htmlEsc(txt)}</td>`;
    }).join('');
    return `<tr style="height:${h}px">${tds}</tr>`;
  }).join('');
  const L = F.logo, ancho = F.cols.reduce((a, b) => a + b, 0);
  return `<div class="hoja" style="position:relative;width:${ancho}px">
    <img src="${L.src}" style="position:absolute;left:${L.left}px;top:${L.top}px;width:${L.width}px;height:${L.height}px">
    ${firmasEnHoja(ot).map(x => `<img src="${x.src}" style="position:absolute;left:${x.left}px;top:${x.top}px;width:${x.width}px;height:${x.height}px;object-fit:contain">`).join('')}
    <table style="width:${ancho}px"><colgroup>${F.cols.map(w => `<col style="width:${w}px">`).join('')}</colgroup><tbody>${filasHtml}</tbody></table></div>`;
};

/** Repuestos que no caben en las 10 filas del formato → hoja anexa al imprimir. */
export const repuestosExtra = (ot) => (ot?.insumos || []).slice(N_INSUMOS).filter(x => x && (String(x.repuestos || '').trim() || String(x.aceites || '').trim()));
const htmlAnexoRepuestos = (ot) => {
  const extra = repuestosExtra(ot);
  if (!extra.length) return '';
  const td = 'border:1px solid #000;padding:4px 6px;font:12px Arial';
  const filas = extra.map((x, i) => `<tr><td style="${td};text-align:center">${N_INSUMOS + i + 1}</td><td style="${td}">${htmlEsc(x.repuestos || x.aceites || '')}</td><td style="${td};text-align:center">${htmlEsc(fmtFecha(x.fecha))}</td><td style="${td}">${htmlEsc(x.retira || '')}</td></tr>`).join('');
  return `<div style="page-break-before:always;font-family:Arial;padding-top:10px">
    <h3 style="margin:0 0 8px">OT N° ${htmlEsc(ot.folio || '')} · AFI ${htmlEsc(ot.afi || '')} — Repuestos utilizados (continuación)</h3>
    <table style="border-collapse:collapse;width:100%"><thead><tr><th style="${td}">Itm</th><th style="${td}">Repuesto</th><th style="${td}">Fecha</th><th style="${td}">Retira</th></tr></thead><tbody>${filas}</tbody></table></div>`;
};

/** Hoja carta (8,5 × 11 in a 96 px/in) con márgenes chicos → la OT se escala para ocupar toda la hoja. */
const CARTA = { w: 8.5 * 96, h: 11 * 96, margen: 0.25 * 96 };
const zoomImpresion = () => {
  const ancho = FORMATO_OT.cols.reduce((a, b) => a + b, 0);
  const alto = FORMATO_OT.rows.reduce((a, b) => a + b, 0);
  const z = Math.min((CARTA.w - 2 * CARTA.margen) / ancho, (CARTA.h - 2 * CARTA.margen) / alto) * 0.985;
  return Math.round(z * 1000) / 1000;
};

export const imprimirOT = (ot) => {
  const w = window.open('', '_blank');
  if (!w) return alert('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>OT ${ot.folio || ''} - ${htmlEsc(ot.afi || '')}</title>
<style>
  @page { size: letter portrait; margin: 0.25in; }
  html, body { margin: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .hoja { zoom: ${zoomImpresion()}; margin: 0 auto; }
  table { border-collapse: collapse; table-layout: fixed; }
  td { padding: 0 1px; overflow: hidden; white-space: nowrap; line-height: 1.05; box-sizing: border-box; }
  @media screen { body { padding: 20px; background: #e2e8f0; } .hoja { background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.2); zoom: 1; } }
</style></head><body>${htmlHojaOT(ot)}
${htmlAnexoRepuestos(ot)}
<script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };<\/script></body></html>`);
  w.document.close();
};

// ---------- Navegación desde otros módulos ----------
/** Abre el módulo OT en el folio indicado (ej. clic en el N° OT del Historial). */
export const irAOT = (numero) => {
  const n = numeroDe(numero);
  if (!n) return;
  folioPorAbrir.value = n;
  otActual.value = null;
  if (currentTab.value === 'ot') cargarOT(); else currentTab.value = 'ot';
};

// ---------- Importar OT desde Excel (mismo formato FRC-RE-OPE-006) ----------
const pad2 = (n) => String(n).padStart(2, '0');
/** Fecha de una celda (número de Excel o texto dd-mm-aaaa / dd/mm/aa) → aaaa-mm-dd. */
const fechaDeCelda = (cel) => {
  if (!cel || cel.v === undefined || cel.v === '') return '';
  if (typeof cel.v === 'number' && window.XLSX) {
    const d = XLSX.SSF.parse_date_code(cel.v);
    if (d && d.y) return `${d.y}-${pad2(d.m)}-${pad2(d.d)}`;
  }
  const t = String(cel.w || cel.v).trim();
  let m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${pad2(m[2])}-${pad2(m[1])}`; }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : t;
};
/** Hora de una celda (fracción de día de Excel o texto 8:30 / 08:30 hrs) → HH:MM. */
const horaDeCelda = (cel) => {
  if (!cel || cel.v === undefined || cel.v === '') return '';
  if (typeof cel.v === 'number') {
    const min = Math.round((cel.v % 1) * 24 * 60);
    return `${pad2(Math.floor(min / 60) % 24)}:${pad2(min % 60)}`;
  }
  const m = String(cel.w || cel.v).match(/(\d{1,2})[:.](\d{2})/);
  return m ? `${pad2(m[1])}:${m[2]}` : String(cel.v).trim();
};
const textoDeCelda = (cel) => (cel && cel.v !== undefined && cel.v !== null) ? String(cel.w ?? cel.v).trim() : '';

/** Lee una hoja con el formato de OT. Devuelve la OT o null si la hoja no es el formato. */
export const leerOTdesdeHoja = (ws, nombreArchivo = '') => {
  const txt = (ref) => textoDeCelda(ws[ref]);
  const titulo = (txt('K1') + ' ' + txt('AL2')).toUpperCase();
  if (!titulo.includes('ORDEN DE TRABAJO') && !titulo.includes('FRC-RE-OPE-006')) return null;
  const ot = otVacia();
  ot.estado = 'ABIERTA';
  FORMATO_OT.celdas.filter(c => c.k).forEach(c => {
    const ref = COLS[c.c] + c.r, cel = ws[ref], k = c.k;
    if (k === 'folio') { const n = numeroDe(txt(ref)); ot.folio = n; return; }
    if (k.startsWith('tipo:')) { if (txt(ref)) ot.tipo_mantencion = k.slice(5); return; }
    if (k.startsWith('pauta:')) { if (txt(ref)) ot.pauta = k.slice(6); return; }
    const tipo = tipoCampo(k);
    fijarCampo(ot, k, tipo === 'date' ? fechaDeCelda(cel) : (tipo === 'time' ? horaDeCelda(cel) : textoDeCelda(cel)));
  });
  if (!ot.folio) ot.folio = numeroDe(String(nombreArchivo).replace(/\.xls[xm]?$/i, ''));   // ej. "OT 45.xlsx"
  // Datos del equipo que falten → desde el Inventario
  const eq = equipoPorAfi(ot.afi);
  if (eq) {
    ot.afi = eq.afi;
    ot.equipo = ot.equipo || eq.tipo; ot.marca = ot.marca || eq.marca; ot.modelo = ot.modelo || eq.modelo;
  }
  ot.afi = ot.afi ? limpiarAfi(ot.afi) : '';
  // Fecha de la OT = primera fecha de inicio de las actividades (si no hay, hoy)
  ot.fecha = ot.actividades.map(a => a.f_inicio).filter(f => /^\d{4}-\d{2}-\d{2}$/.test(f)).sort()[0] || hoyISO();
  return ot;
};

export const importandoOT = ref(false);
/** Importa uno o varios Excel de OT (una OT por hoja). Solo Admin. */
export const importarOTExcel = async (event) => {
  const input = event.target;
  const archivos = [...(input.files || [])];
  input.value = '';
  if (!archivos.length || !soloAdmin()) return;
  if (!window.XLSX) return alert('No se pudo cargar el lector de Excel (revisa la conexión a internet).');
  importandoOT.value = true;
  const leidas = [], errores = [];
  try {
    for (const f of archivos) {
      try {
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
        let alguna = false;
        wb.SheetNames.forEach(nombre => {
          const ot = leerOTdesdeHoja(wb.Sheets[nombre], wb.SheetNames.length > 1 ? '' : f.name);
          if (!ot) return;
          alguna = true;
          if (!ot.folio) errores.push(`${f.name}${wb.SheetNames.length > 1 ? ' / ' + nombre : ''}: sin N° de folio (celda FOLIO vacía).`);
          else if (!ot.afi) errores.push(`${f.name}: OT ${ot.folio} sin ID EQUIPO (AFI).`);
          else leidas.push(ot);
        });
        if (!alguna) errores.push(`${f.name}: no tiene el formato de Orden de Trabajo.`);
      } catch (e) { errores.push(`${f.name}: no se pudo leer (${errMsg(e)}).`); }
    }
    // Folios repetidos dentro de lo importado
    const unicas = [...new Map(leidas.map(o => [o.folio, o])).values()];
    if (unicas.length < leidas.length) errores.push(`Se repetían folios en los archivos: se usó el último de cada uno.`);
    if (!unicas.length) return alert('No se importó ninguna OT.\n\n' + errores.join('\n'));

    const existentes = unicas.filter(o => dbOT.value.some(x => Number(x.folio) === Number(o.folio)));
    let reemplazar = false;
    if (existentes.length) {
      reemplazar = confirm(`Ya existen ${existentes.length} OT con estos folios: ${existentes.map(o => o.folio).join(', ')}.\n\n` +
        `Aceptar = reemplazarlas con el Excel · Cancelar = dejarlas como están (solo se importan las nuevas).`);
    }
    let nuevas = 0, actualizadas = 0;
    const u = usuarioActivo.value, quien = (u && (u.nombre || u.usuario)) || '';
    for (const ot of unicas) {
      const previa = dbOT.value.find(x => Number(x.folio) === Number(ot.folio));
      try {
        if (previa) {
          if (!reemplazar) continue;
          await sb(supabaseClient.from(TABLA_OT).update({ ...payloadOT(ot), estado: previa.estado }).eq('id', previa.id));
          actualizadas++;
        } else {
          await sb(supabaseClient.from(TABLA_OT).insert([{ ...payloadOT(ot), folio: ot.folio, creado_por: quien + ' (importada)' }]));
          nuevas++;
        }
      } catch (e) { errores.push(`OT ${ot.folio}: ${errMsg(e)}`); }
    }
    await cargarOT();
    alert(`Importación terminada: ${nuevas} OT nuevas, ${actualizadas} reemplazadas.` + (errores.length ? '\n\nAvisos:\n' + errores.join('\n') : ''));
  } finally {
    importandoOT.value = false;
  }
};

// ---------- Documentos vinculados por N° de folio ----------
/** Mantenciones del Historial con ese N° OT, con su documento adjunto (link) si tiene. */
export const documentosDeOT = (folio) => mantencionesDeOT(folio).map(m => ({
  id: m.id, mantencion: m, fecha: m.fecha, tipo: m.tipoMant, causa: m.causa, afi: m.afi,
  descripcion: m.descripcion, link: m.linkDrive
}));
