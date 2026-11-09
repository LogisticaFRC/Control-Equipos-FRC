// =====================================================================
// COSTOS DE MANTENCIÓN · valor estimado por equipo (250 / 500 / 1000 hrs) y proyección
// ---------------------------------------------------------------------
// Precio de cada mantención = filtros del MODELO (módulo Filtros: marca + modelo, la opción más barata
// de cada tipo × cantidad) que corresponden a ese tipo de mantención + un costo adicional fijo opcional
// (aceite, mano de obra, etc.).
// Qué filtros van en cada mantención se configura por GRUPO de filtro (aceite, combustible, aire…)
// y se guarda en bd_config (clave 'costos_mantencion'); ver sql/costos_mantencion.sql.
// Proyección: desde el horómetro aproximado de hoy, cuántas mantenciones caen en las próximas N horas
// de uso. El tipo de cada una sale del horómetro nominal (múltiplos de 250):
//   …1000, 2000 → 1000 hrs · …500, 1500 → 500 hrs · el resto → 250 hrs.
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { dbEquipos, soloAdmin } from '../../core/store.js';
import { hoyISO, sumarDiasISO, formatDateForDisplay } from '../../core/utils.js';
import { esVehiculo } from '../inventario/inventario.mapper.js';
import { requeridosPorModelo, fmtPrecio } from '../filtros/filtros.service.js';
import { claveModelo, normTxt } from '../filtros/filtros.mapper.js';
import { nuevoLibro, hojaTabla, hojaDashboard, descargarLibro, fechaExcel } from '../../core/excel.js';

const { ref, computed } = Vue;

export const TIPOS_MANT = ['250', '500', '1000'];
export const ETIQ_MANT = { 250: '250 hrs', 500: '500 hrs', 1000: '1000 hrs' };
/** Clases de color por tipo de mantención (compartidas con el Perfil). */
export const ESTILO_MANT = {
  barra: { 250: 'bg-emerald-500', 500: 'bg-sky-500', 1000: 'bg-violet-500' },
  texto: { 250: 'text-emerald-700', 500: 'text-sky-700', 1000: 'text-violet-700' },
  caja: { 250: 'bg-emerald-50 border-emerald-200 text-emerald-900', 500: 'bg-sky-50 border-sky-200 text-sky-900', 1000: 'bg-violet-50 border-violet-200 text-violet-900' },
  chip: { 250: 'bg-emerald-100 text-emerald-800', 500: 'bg-sky-100 text-sky-800', 1000: 'bg-violet-100 text-violet-800' }
};

// ---------------------------------------------------------------------
// Grupos de filtro (para decidir qué va en cada mantención)
// ---------------------------------------------------------------------
export const GRUPOS = [
  { k: 'ACEITE MOTOR', l: 'Aceite motor' },
  { k: 'COMBUSTIBLE', l: 'Combustible / separador / decantador' },
  { k: 'AIRE PRIMARIO', l: 'Aire primario (motor y compresor)' },
  { k: 'AIRE SECUNDARIO', l: 'Aire secundario (motor y compresor)' },
  { k: 'HIDRAULICO', l: 'Hidráulico' },
  { k: 'SEPARADOR ACEITE', l: 'Separador de aceite (compresor)' },
  { k: 'REFRIGERANTE', l: 'Refrigerante' },
  { k: 'TRANSMISION', l: 'Transmisión' },
  { k: 'CABINA', l: 'Cabina' },
  { k: 'OTROS', l: 'Otros' }
];
export const grupoDe = (tipo) => {
  const t = normTxt(tipo).normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/SEPARADOR (DE )?ACEITE/.test(t)) return 'SEPARADOR ACEITE';
  if (/HIDRAUL/.test(t)) return 'HIDRAULICO';
  if (/COMBUS|DECANT/.test(t)) return 'COMBUSTIBLE';
  if (/AIRE.*SEC/.test(t)) return 'AIRE SECUNDARIO';
  if (/AIRE/.test(t)) return 'AIRE PRIMARIO';
  if (/REFRIG/.test(t)) return 'REFRIGERANTE';
  if (/TRANSMI/.test(t)) return 'TRANSMISION';
  if (/CABINA/.test(t)) return 'CABINA';
  if (/ACEITE/.test(t)) return 'ACEITE MOTOR';
  return 'OTROS';
};

// Configuración por defecto (editable en la página por el Admin)
const CONFIG_DEFECTO = () => ({
  grupos: {
    'ACEITE MOTOR': { 250: true, 500: true, 1000: true },
    'COMBUSTIBLE': { 250: true, 500: true, 1000: true },
    'AIRE PRIMARIO': { 250: true, 500: true, 1000: true },
    'AIRE SECUNDARIO': { 250: true, 500: true, 1000: true },
    'HIDRAULICO': { 250: false, 500: true, 1000: true },
    'SEPARADOR ACEITE': { 250: false, 500: false, 1000: true },
    'REFRIGERANTE': { 250: false, 500: false, 1000: true },
    'TRANSMISION': { 250: false, 500: false, 1000: true },
    'CABINA': { 250: false, 500: true, 1000: true },
    'OTROS': { 250: false, 500: false, 1000: true }
  },
  extra: { 250: 0, 500: 0, 1000: 0 },   // aceite, mano de obra, otros ($ por mantención)
  horas: 1000                           // horas de uso a proyectar por defecto
});

export const configCostos = ref(CONFIG_DEFECTO());
export const configCargada = ref(false);
export const faltaTablaConfig = ref(false);
const CLAVE = 'costos_mantencion';

export const cargarConfigCostos = async (forzar = false) => {
  if (configCargada.value && !forzar) return;
  try {
    const data = await sb(supabaseClient.from('bd_config').select('valor').eq('clave', CLAVE).limit(1));
    const v = data && data[0] && data[0].valor;
    if (v) {
      const d = CONFIG_DEFECTO();
      configCostos.value = { grupos: { ...d.grupos, ...(v.grupos || {}) }, extra: { ...d.extra, ...(v.extra || {}) }, horas: Number(v.horas) || d.horas };
    }
    faltaTablaConfig.value = false;
  } catch (err) {
    console.warn('[Costos] config', err);
    faltaTablaConfig.value = true;   // aún no se ejecuta sql/costos_mantencion.sql: se usan los valores por defecto
  }
  horasProyeccion.value = configCostos.value.horas;
  configCargada.value = true;
};

export const guardandoConfig = ref(false);
export const guardarConfigCostos = async () => {
  if (!soloAdmin()) return;
  guardandoConfig.value = true;
  try {
    const valor = JSON.parse(JSON.stringify(configCostos.value));
    valor.horas = Number(horasProyeccion.value) || valor.horas;
    await sb(supabaseClient.from('bd_config').upsert([{ clave: CLAVE, valor, updated_at: new Date().toISOString() }], { onConflict: 'clave' }));
    configCostos.value.horas = valor.horas;
    alert('Configuración guardada para todos los usuarios.');
  } catch (err) {
    alert('No se pudo guardar (¿ejecutaste sql/costos_mantencion.sql?): ' + errMsg(err));
  } finally { guardandoConfig.value = false; }
};
export const restaurarConfigCostos = () => { if (confirm('¿Volver a la configuración por defecto? (Luego presiona Guardar)')) configCostos.value = CONFIG_DEFECTO(); };

/** Horas de uso a proyectar (cada usuario puede cambiarlas; el Admin guarda el valor por defecto). */
export const horasProyeccion = ref(CONFIG_DEFECTO().horas);

// ---------------------------------------------------------------------
// Costo de cada tipo de mantención para un modelo
// ---------------------------------------------------------------------
export const incluye = (tipoFiltro, mt) => Boolean(configCostos.value.grupos[grupoDe(tipoFiltro)]?.[mt]);

/** { tipos, tieneFiltros, por: { '250': { items, filtros, extra, total, sinPrecio } , … } } */
export const costoModelo = (marca, modelo) => {
  const tipos = requeridosPorModelo(marca, modelo).map(t => ({ ...t, grupo: grupoDe(t.tipo) }));
  const por = {};
  TIPOS_MANT.forEach(mt => {
    const items = tipos.filter(t => incluye(t.tipo, mt));
    const filtros = items.reduce((s, t) => s + (t.costo || 0), 0);
    const extra = Number(configCostos.value.extra[mt]) || 0;
    por[mt] = { items, filtros, extra, total: filtros + extra, sinPrecio: items.filter(t => !t.mejor).map(t => t.tipo) };
  });
  return { tipos, tieneFiltros: tipos.length > 0, por };
};

// ---------------------------------------------------------------------
// Proyección de un equipo
// ---------------------------------------------------------------------
export const tipoServicio = (hNominal) => {
  const h = Math.round(hNominal);
  if (h > 0 && h % 1000 === 0) return '1000';
  if (h > 0 && h % 500 === 0) return '500';
  return '250';
};

/** Mantenciones que caen en las próximas `horas` de uso. */
export const proyeccionEquipo = (eq, horas, costo = null) => {
  const h = eq?.horometros;
  const c = costo || costoModelo(eq?.marca, eq?.modelo);
  const res = { servicios: [], cuenta: { 250: 0, 500: 0, 1000: 0 }, total: 0, desde: 0, hasta: 0, rate: 0, frecuencia: 0, vencida: false };
  if (!h) return res;
  const f = Number(eq.frecuenciaMantencion) || 250;
  const desde = Number(h.hAprox) || 0, hasta = desde + (Number(horas) || 0);
  const rate = Number(h.rateHrsDia) || 0;
  Object.assign(res, { desde, hasta, rate, frecuencia: f });
  let x = Number(h.hTarget) || (desde + f);
  const hoy = hoyISO();
  for (let n = 0; x <= hasta && n < 300; n++, x += f) {
    const nominal = Math.round(x / 250) * 250;
    const mt = tipoServicio(nominal);
    const dias = rate > 0 ? Math.ceil((x - desde) / rate) : null;
    const vencida = x <= desde;
    if (vencida) res.vencida = true;
    let fecha = '';
    try { fecha = vencida ? hoy : (dias !== null ? sumarDiasISO(hoy, dias) : ''); } catch (_) {}
    const costoS = c.por[mt].total;
    res.servicios.push({ n: n + 1, h: Math.round(x), nominal, tipo: mt, fecha, vencida, costo: costoS, sinPrecio: c.por[mt].sinPrecio });
    res.cuenta[mt]++;
    res.total += costoS;
  }
  return res;
};

// ---------------------------------------------------------------------
// Toda la flota (sin vehículos)
// ---------------------------------------------------------------------
export const filtroCostos = ref({ texto: '', tipo: '', soloConFiltros: false });

export const equiposCostos = computed(() => dbEquipos.value.filter(e => !esVehiculo(e)));

export const flotaCostos = computed(() => {
  const horas = Number(horasProyeccion.value) || 0;
  const _ = configCostos.value;   // dependencia: recalcula al cambiar la configuración
  const cache = new Map();
  const costoDe = (e) => {
    const k = claveModelo(e.marca, e.modelo);
    if (!cache.has(k)) cache.set(k, costoModelo(e.marca, e.modelo));
    return cache.get(k);
  };
  const f = filtroCostos.value, q = normTxt(f.texto);
  const equipos = equiposCostos.value
    .filter(e => !f.tipo || normTxt(e.tipo) === f.tipo)
    .filter(e => !q || normTxt(`${e.afi} ${e.tipo} ${e.marca} ${e.modelo}`).includes(q))
    .map(e => {
      const c = costoDe(e);
      return { e, afi: e.afi, tipo: normTxt(e.tipo), marca: normTxt(e.marca), modelo: normTxt(e.modelo), costo: c, proy: proyeccionEquipo(e, horas, c) };
    })
    .filter(x => !f.soloConFiltros || x.costo.tieneFiltros);

  // Por modelo
  const porModelo = new Map();
  equipos.forEach(x => {
    const k = claveModelo(x.marca, x.modelo);
    if (!porModelo.has(k)) porModelo.set(k, { key: k, marca: x.marca, modelo: x.modelo, tipos: new Set(), costo: x.costo, equipos: [], cuenta: { 250: 0, 500: 0, 1000: 0 }, total: 0 });
    const m = porModelo.get(k);
    m.tipos.add(x.tipo); m.equipos.push(x);
    TIPOS_MANT.forEach(mt => { m.cuenta[mt] += x.proy.cuenta[mt]; });
    m.total += x.proy.total;
  });
  const modelos = [...porModelo.values()].map(m => ({ ...m, tipoTxt: [...m.tipos].filter(Boolean).join(' / ') }))
    .sort((a, b) => b.total - a.total || a.tipoTxt.localeCompare(b.tipoTxt) || a.modelo.localeCompare(b.modelo));

  const cuenta = { 250: 0, 500: 0, 1000: 0 };
  equipos.forEach(x => TIPOS_MANT.forEach(mt => { cuenta[mt] += x.proy.cuenta[mt]; }));
  const total = equipos.reduce((s, x) => s + x.proy.total, 0);
  const sinFiltros = modelos.filter(m => !m.costo.tieneFiltros);
  const conFaltantes = modelos.filter(m => m.costo.tieneFiltros && TIPOS_MANT.some(mt => m.costo.por[mt].sinPrecio.length));
  return {
    horas, equipos: equipos.sort((a, b) => b.proy.total - a.proy.total || String(a.afi).localeCompare(String(b.afi), undefined, { numeric: true })),
    modelos, cuenta, total, nMant: cuenta[250] + cuenta[500] + cuenta[1000],
    sinFiltros, conFaltantes, vencidas: equipos.filter(x => x.proy.vencida).length
  };
});
export const tiposEquipoCostos = computed(() => [...new Set(equiposCostos.value.map(e => normTxt(e.tipo)).filter(Boolean))].sort());

// ---------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------
const PESOS = '"$"#,##0';
const filasFiltrosModelo = (m) => m.costo.tipos.map(t => [
  m.tipoTxt || '', m.marca || '-', m.modelo || '-', t.tipo, GRUPOS.find(g => g.k === t.grupo)?.l || t.grupo,
  t.mejor ? t.mejor.codigo : 'SIN PRECIO', t.mejor ? (t.mejor.proveedor || '') : '', t.mejor ? t.mejor.precio : '', t.cantidad, t.costo || '',
  incluye(t.tipo, '250') ? 'SÍ' : '', incluye(t.tipo, '500') ? 'SÍ' : '', incluye(t.tipo, '1000') ? 'SÍ' : '',
  t.filas.map(r => r.codigo).join(' / ')
]);

export const exportandoCostos = ref(false);
/** equipoUnico: si viene, exporta solo ese equipo (desde el Perfil). */
export const exportarCostosExcel = async (equipoUnico = null) => {
  exportandoCostos.value = true;
  try {
    const horas = Number(horasProyeccion.value) || 0;
    let modelos, equipos, cuenta, total;
    if (equipoUnico) {
      const c = costoModelo(equipoUnico.marca, equipoUnico.modelo);
      const x = { e: equipoUnico, afi: equipoUnico.afi, tipo: normTxt(equipoUnico.tipo), marca: normTxt(equipoUnico.marca), modelo: normTxt(equipoUnico.modelo), costo: c, proy: proyeccionEquipo(equipoUnico, horas, c) };
      equipos = [x]; cuenta = x.proy.cuenta; total = x.proy.total;
      modelos = [{ marca: x.marca, modelo: x.modelo, tipoTxt: x.tipo, costo: c, equipos: [x], cuenta, total }];
    } else {
      const fl = flotaCostos.value; modelos = fl.modelos; equipos = fl.equipos; cuenta = fl.cuenta; total = fl.total;
    }
    const { wb, logo } = await nuevoLibro();
    const sub = `${equipoUnico ? 'AFI ' + equipoUnico.afi + ' · ' : ''}Proyección de ${horas.toLocaleString('es-CL')} horas de uso · ${equipos.length} equipo(s)`;
    const nMant = cuenta[250] + cuenta[500] + cuenta[1000];
    await hojaDashboard(wb, logo, { nombre: 'Resumen', titulo: 'COSTOS DE MANTENCIÓN', subtitulo: sub, kpis: [
      { t: 'Costo proyectado', v: total, fmt: PESOS, sub: `${horas.toLocaleString('es-CL')} h de uso`, color: 'indigo' },
      { t: 'Mantenciones', v: nMant, sub: 'en el período', color: 'gris' },
      { t: '250 hrs', v: cuenta[250], color: 'verde' }, { t: '500 hrs', v: cuenta[500], color: 'indigo' }, { t: '1000 hrs', v: cuenta[1000], color: 'rojo' },
      { t: 'Equipos', v: equipos.length, sub: `${modelos.length} modelo(s)`, color: 'ambar' }
    ] });
    hojaTabla(wb, logo, { nombre: 'Por modelo', titulo: 'COSTO DE MANTENCIÓN POR MODELO', subtitulo: sub,
      columnas: [{ t: 'TIPO EQUIPO', w: 18 }, { t: 'MARCA', w: 14 }, { t: 'MODELO', w: 14, bold: true }, { t: 'AFI', w: 30, al: 'left' }, { t: 'N° EQUIPOS', w: 9 },
        { t: 'COSTO 250 HRS', w: 13, fmt: PESOS }, { t: 'COSTO 500 HRS', w: 13, fmt: PESOS }, { t: 'COSTO 1000 HRS', w: 13, fmt: PESOS },
        { t: 'MANT. 250', w: 9 }, { t: 'MANT. 500', w: 9 }, { t: 'MANT. 1000', w: 9 }, { t: 'COSTO PROYECTADO', w: 15, fmt: PESOS }, { t: 'OBSERVACIÓN', w: 30, al: 'left' }],
      filas: modelos.map(m => [m.tipoTxt, m.marca || '-', m.modelo || '-', m.equipos.map(x => x.afi).join(', '), m.equipos.length,
        m.costo.por[250].total, m.costo.por[500].total, m.costo.por[1000].total, m.cuenta[250], m.cuenta[500], m.cuenta[1000], m.total,
        !m.costo.tieneFiltros ? 'Sin filtros cargados en módulo Filtros' : TIPOS_MANT.some(mt => m.costo.por[mt].sinPrecio.length) ? 'Faltan precios: ' + [...new Set(TIPOS_MANT.flatMap(mt => m.costo.por[mt].sinPrecio))].join(', ') : '']),
      estiloFila: (v) => !v[12] ? null : { fill: 'FFFEF3C7' },
      totales: ['TOTAL', '', '', '', modelos.reduce((s, m) => s + m.equipos.length, 0), '', '', '', cuenta[250], cuenta[500], cuenta[1000], total, ''] });
    hojaTabla(wb, logo, { nombre: 'Por equipo', titulo: 'COSTO DE MANTENCIÓN POR EQUIPO', subtitulo: sub,
      columnas: [{ t: 'AFI', w: 9, bold: true }, { t: 'TIPO', w: 16 }, { t: 'MARCA', w: 13 }, { t: 'MODELO', w: 13 }, { t: 'HORÓMETRO APROX.', w: 12, fmt: '#,##0' }, { t: 'USO H/DÍA', w: 9, fmt: '0.0' },
        { t: 'PRÓXIMA MANT. (H)', w: 12, fmt: '#,##0' }, { t: 'FECHA ESTIMADA', w: 12, fmt: 'dd-mm-yyyy' }, { t: 'MANT. 250', w: 9 }, { t: 'MANT. 500', w: 9 }, { t: 'MANT. 1000', w: 9 }, { t: 'COSTO PROYECTADO', w: 15, fmt: PESOS }],
      filas: equipos.map(x => [x.afi, x.tipo, x.marca, x.modelo, Math.round(x.proy.desde), x.proy.rate, x.proy.servicios[0]?.h || '', x.proy.servicios[0]?.fecha ? fechaExcel(x.proy.servicios[0].fecha) : '',
        x.proy.cuenta[250], x.proy.cuenta[500], x.proy.cuenta[1000], x.proy.total]),
      totales: ['TOTAL', '', '', '', '', '', '', '', cuenta[250], cuenta[500], cuenta[1000], total] });
    hojaTabla(wb, logo, { nombre: 'Proyección', titulo: 'MANTENCIONES PROYECTADAS', subtitulo: sub,
      columnas: [{ t: 'AFI', w: 9, bold: true }, { t: 'TIPO', w: 16 }, { t: 'MODELO', w: 16 }, { t: 'N°', w: 6 }, { t: 'HORÓMETRO', w: 12, fmt: '#,##0' }, { t: 'MANTENCIÓN', w: 12 }, { t: 'FECHA ESTIMADA', w: 13, fmt: 'dd-mm-yyyy' }, { t: 'COSTO', w: 13, fmt: PESOS }, { t: 'OBSERVACIÓN', w: 30, al: 'left' }],
      filas: equipos.flatMap(x => x.proy.servicios.map(s => [x.afi, x.tipo, `${x.marca} ${x.modelo}`.trim(), s.n, s.h, ETIQ_MANT[s.tipo], s.fecha ? fechaExcel(s.fecha) : '', s.costo,
        [s.vencida ? 'VENCIDA (se debe hacer ya)' : '', s.sinPrecio.length ? 'Sin precio: ' + s.sinPrecio.join(', ') : ''].filter(Boolean).join(' · ')])),
      estiloFila: (v) => /VENCIDA/.test(v[8]) ? { fill: 'FFFEE2E2' } : null });
    hojaTabla(wb, logo, { nombre: 'Filtros por modelo', titulo: 'FILTROS DE CADA MODELO Y EN QUÉ MANTENCIÓN VAN', subtitulo: 'Opción más barata de cada tipo (módulo Filtros)',
      columnas: [{ t: 'TIPO EQUIPO', w: 16 }, { t: 'MARCA', w: 12 }, { t: 'MODELO', w: 12, bold: true }, { t: 'TIPO FILTRO', w: 22, al: 'left' }, { t: 'GRUPO', w: 24, al: 'left' }, { t: 'CÓDIGO', w: 13 }, { t: 'PROVEEDOR', w: 13 },
        { t: 'PRECIO', w: 11, fmt: PESOS }, { t: 'CANT.', w: 7 }, { t: 'COSTO', w: 11, fmt: PESOS }, { t: '250', w: 6 }, { t: '500', w: 6 }, { t: '1000', w: 6 }, { t: 'CÓDIGOS EQUIVALENTES', w: 34, al: 'left' }],
      filas: modelos.flatMap(filasFiltrosModelo) });
    const sinF = modelos.filter(m => !m.costo.tieneFiltros);
    if (sinF.length) hojaTabla(wb, logo, { nombre: 'Sin filtros', titulo: 'MODELOS SIN FILTROS CARGADOS', subtitulo: 'Cargar en módulo Filtros (columna "SIRVE PARA" de la planilla) para calcular su costo', apaisado: false,
      columnas: [{ t: 'TIPO EQUIPO', w: 20 }, { t: 'MARCA', w: 16 }, { t: 'MODELO', w: 16, bold: true }, { t: 'AFI', w: 40, al: 'left' }],
      filas: sinF.map(m => [m.tipoTxt, m.marca || '-', m.modelo || '-', m.equipos.map(x => x.afi).join(', ')]) });
    await descargarLibro(wb, `Costos_Mantencion_${equipoUnico ? 'AFI_' + equipoUnico.afi + '_' : ''}${hoyISO()}.xlsx`);
  } catch (err) { alert('Error al exportar: ' + errMsg(err)); }
  finally { exportandoCostos.value = false; }
};

export { fmtPrecio, formatDateForDisplay };
