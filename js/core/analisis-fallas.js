// =====================================================================
// CORE · Análisis de fallas ("qué es lo que más falla")
// ---------------------------------------------------------------------
// Lee los registros del Historial (causa + causa detallada + descripción + horas de trabajo)
// y los clasifica por SISTEMA (eléctrico, motor, hidráulico, refrigeración…) con palabras clave.
// Con eso arma: ranking de sistemas, problemas que más se repiten, equipos con más fallas,
// tiempo de trabajo, días entre fallas (MTBF), fallas repetidas en < 30 días y "hallazgos"
// escritos en palabras (reglas, sin servicios externos).
// Se usa en el módulo "Análisis de Fallas" y en el Perfil de Equipo.
// Para mejorar la clasificación: agregar palabras en CATEGORIAS_FALLA.
// =====================================================================
import { normalizarFecha, diasEntre, hoyISO } from './utils.js';
import { claseMantencion } from './horometros.js';

export const sinTildes = (s) => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Sistemas (categorías). kw = palabras o frases (sin tildes, mayúsculas). El orden desempata. */
export const CATEGORIAS_FALLA = [
  { key: 'ELECTRICO', label: 'Eléctrico', color: '#eab308', icon: 'fa-bolt',
    kw: ['BATERIA', 'ALTERNADOR', 'MOTOR DE PARTIDA', 'MOTOR PARTIDA', 'PARTIDA', 'ARRANQUE', 'ELECTRIC', 'CABLE', 'CABLEADO', 'FUSIBLE', 'RELE', 'CORTOCIRCUITO', 'CORTO CIRCUITO', 'SENSOR', 'CONTACTOR', 'BORNE', 'SOLENOIDE', 'TERMINAL', 'CARGADOR', 'CONEXION', 'ENCHUFE', 'SWITCH', 'LLAVE DE CONTACTO', 'TIERRA'] },
  { key: 'GENERACION', label: 'Generación / Panel de control', color: '#f97316', icon: 'fa-plug-circle-bolt',
    kw: ['AVR', 'REGULADOR DE VOLTAJE', 'VOLTAJE', 'FRECUENCIA', 'BREAKER', 'DISYUNTOR', 'PANEL DE CONTROL', 'CONTROLADOR', 'MODULO', 'DEEP SEA', 'DSE', 'COMAP', 'EXCITATRIZ', 'BOBINA', 'ESTATOR', 'ROTOR', 'BANCO DE PRUEBA', 'BANCO DE CARGA', 'BANCO', 'TRANSFERENCIA', 'ATS', 'KVA', 'AMPER'] },
  { key: 'MOTOR', label: 'Motor', color: '#dc2626', icon: 'fa-gear',
    kw: ['MOTOR', 'CULATA', 'INYECTOR', 'TURBO', 'EMPAQUETADURA', 'JUNTA', 'PISTON', 'VALVULA', 'COMPRESION', 'CIGUENAL', 'ARBOL DE LEVAS', 'HUMO', 'POTENCIA', 'CORREA', 'POLEA', 'TAPA DE VALVULA', 'CARTER', 'ESCAPE', 'SILENCIADOR', 'ADMISION', 'MULTIPLE', 'GOBERNADOR', 'RPM'] },
  { key: 'COMBUSTIBLE', label: 'Combustible', color: '#a16207', icon: 'fa-gas-pump',
    kw: ['COMBUSTIBLE', 'PETROLEO', 'DIESEL', 'BOMBA INYECTORA', 'ESTANQUE', 'TANQUE', 'SEPARADOR', 'PURGA', 'PURGAR', 'CEBAR', 'AIRE EN EL SISTEMA', 'BOMBA DE ALIMENTACION', 'FLOTADOR', 'NIVEL DE COMBUSTIBLE'] },
  { key: 'REFRIGERACION', label: 'Refrigeración', color: '#0ea5e9', icon: 'fa-temperature-arrow-down',
    kw: ['RADIADOR', 'REFRIGERANTE', 'TEMPERATURA', 'SOBRECALENT', 'RECALENT', 'VENTILADOR', 'TERMOSTATO', 'BOMBA DE AGUA', 'ASPA', 'ANTICONGELANTE', 'AGUA', 'ENFRIAMIENTO'] },
  { key: 'HIDRAULICO', label: 'Hidráulico', color: '#7c3aed', icon: 'fa-droplet',
    kw: ['HIDRAULIC', 'MANGUERA', 'CILINDRO', 'SELLO', 'RETEN', 'ORING', 'O RING', 'BOMBA HIDRAULICA', 'GATO', 'FLEXIBLE', 'ACOPLE', 'FUGA', 'FILTRACION', 'PERDIDA DE ACEITE'] },
  { key: 'LUBRICACION', label: 'Lubricación / Filtros', color: '#16a34a', icon: 'fa-oil-can',
    kw: ['ACEITE', 'LUBRIC', 'ENGRASE', 'ENGRASAR', 'GRASA', 'FILTRO', 'FILTROS'] },
  { key: 'TREN', label: 'Transmisión / Rodado', color: '#475569', icon: 'fa-gears',
    kw: ['TRANSMISION', 'CAJA', 'EMBRAGUE', 'CARDAN', 'DIFERENCIAL', 'EJE', 'RODAMIENTO', 'CORONA', 'MANDO FINAL', 'NEUMATICO', 'RUEDA', 'LLANTA', 'PINCHAZO', 'CAMARA', 'FRENO', 'PASTILLA', 'BALATA', 'DIRECCION', 'SUSPENSION', 'AMORTIGUADOR'] },
  { key: 'ESTRUCTURA', label: 'Estructura / Carrocería', color: '#78716c', icon: 'fa-screwdriver-wrench',
    kw: ['SOLDADURA', 'SOLDAR', 'CHASIS', 'LANZA', 'ENGANCHE', 'TIRO', 'ESTRUCTURA', 'CARROCERIA', 'PLUMA', 'MASTIL', 'PUERTA', 'CHAPA', 'BISAGRA', 'PINTURA', 'CABINA', 'VIDRIO', 'ARMADO', 'DESARMADO', 'CARCASA', 'TAPA', 'PERNO', 'GABINETE', 'CANOPY', 'SKID', 'BASE'] },
  { key: 'ILUMINACION', label: 'Iluminación', color: '#facc15', icon: 'fa-lightbulb',
    kw: ['FOCO', 'AMPOLLETA', 'LUMINARIA', 'LED', 'REFLECTOR', 'LAMPARA', 'BALASTRO', 'ILUMINACION', 'HALURO'] },
  { key: 'SERVICIO', label: 'Servicio / Inspección / Limpieza', color: '#94a3b8', icon: 'fa-broom',
    kw: ['LIMPIEZA', 'LAVADO', 'ASEO', 'BANDEJA', 'REVISION', 'INSPECCION', 'PRUEBA', 'MEDICION', 'CHEQUEO', 'CONTROL', 'VISITA', 'ESTANDAR'] }
];
export const CATEGORIA_OTROS = { key: 'OTROS', label: 'Otros / sin clasificar', color: '#cbd5e1', icon: 'fa-circle-question' };
export const categoriaPorKey = (k) => CATEGORIAS_FALLA.find(c => c.key === k) || CATEGORIA_OTROS;

const PALABRAS_VACIAS = new Set(('DE LA EL LOS LAS Y EN CON POR PARA SE A AL DEL UN UNA UNOS UNAS QUE SIN MAS ES SU SUS LO LE O U NO SI YA SE REALIZA REALIZO REALIZAR SE HACE ' +
  'HACER EQUIPO EQUIPOS GENERADOR TORRE AFI CAMBIO CAMBIAR CAMBIA SE REVISA REVISAR TRABAJO TRABAJOS FALLA FALLAS PROBLEMA ESTA ESTABA ENTRE DESDE HASTA ' +
  'NUEVO NUEVA NUEVOS TODO TODOS BIEN MAL PARTE PARTES LADO TAMBIEN ANTES DESPUES SEGUN CADA OTRO OTRA TERMINO TERMINA INICIO REPARACION REPARAR ' +
  'MANTENCION SERVICIO INSTALACION INSTALAR COLOCA COLOCAR DEJA DEJAR QUEDA OPERATIVO').split(/\s+/));

/** Cuenta palabras clave que aparecen al INICIO de una palabra ("ELECTRIC" calza con "ELECTRICO");
 *  las de 3 letras o menos (AVR, LED, EJE…) deben ser la palabra completa. */
const contar = (txt, kw) => {
  let n = 0;
  kw.forEach(k => {
    const ok = k.length <= 3 ? txt.includes(` ${k} `) : txt.includes(` ${k}`);
    if (ok) n += k.includes(' ') ? 2 : 1;
  });
  return n;
};

/** Texto que se analiza de un registro (la causa detallada pesa doble). */
const textoDe = (r) => {
  const det = sinTildes(r.causaDetallada);
  return ` ${sinTildes(r.causa)} ${det} ${det} ${sinTildes(r.descripcion)} `.replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ');
};

/** Sistema principal de un registro: { key, label, color, puntaje, otras:[keys] }. */
export const categorizar = (r) => {
  const t = textoDe(r);
  const puntos = CATEGORIAS_FALLA.map(c => ({ c, n: contar(t, c.kw) })).filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n);
  // "MOTOR DE PARTIDA" es eléctrico: no sumar a MOTOR
  if (t.includes('MOTOR DE PARTIDA') || t.includes('MOTOR PARTIDA')) {
    const m = puntos.find(x => x.c.key === 'MOTOR'); if (m) m.n -= 2;
    puntos.sort((a, b) => b.n - a.n);
  }
  const top = puntos.filter(x => x.n > 0);
  if (!top.length) return { ...CATEGORIA_OTROS, puntaje: 0, otras: [] };
  return { ...top[0].c, puntaje: top[0].n, otras: top.slice(1, 3).map(x => x.c.key) };
};

/** Minutos de trabajo: "3:45", "3h 45m", "3.5", o inicio/término. null si no hay datos. */
export const minutosTrabajo = (r) => {
  const t = String(r.horaTotal || '').trim();
  let m = t.match(/^(\d{1,3})\s*[:hH]\s*(\d{1,2})?/);
  if (m) { const v = Number(m[1]) * 60 + Number(m[2] || 0); if (v > 0) return v; }
  if (/^\d+([.,]\d+)?$/.test(t) && Number(t.replace(',', '.')) > 0) return Math.round(Number(t.replace(',', '.')) * 60);
  const hm = (s) => { const x = String(s || '').match(/(\d{1,2}):(\d{2})/); return x ? Number(x[1]) * 60 + Number(x[2]) : null; };
  const a = hm(r.horaInicio), b = hm(r.horaTermino);
  if (a === null || b === null) return null;
  const d = b - a < 0 ? b - a + 1440 : b - a;
  return d > 0 ? d : null;
};
export const fmtMin = (min) => {
  if (!min) return '0 h';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
};

/** "Problema" normalizado para agrupar textos parecidos (primeras 6 palabras útiles de la causa detallada). */
export const problemaDe = (r) => {
  const base = sinTildes(r.causaDetallada || r.descripcion || r.causa).replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !PALABRAS_VACIAS.has(w) && !/^\d+$/.test(w));
  return base.slice(0, 6).join(' ');
};
/** Palabras clave de un texto (para la nube de palabras). */
const palabrasDe = (r) => sinTildes(`${r.causaDetallada} ${r.descripcion}`).replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/)
  .filter(w => w.length > 3 && !PALABRAS_VACIAS.has(w) && !/^\d+$/.test(w));

const incr = (m, k, v = 1) => m.set(k, (m.get(k) || 0) + v);
const top = (m, n = 10) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, n);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const mesDe = (iso) => String(iso || '').slice(0, 7);

/**
 * Análisis completo.
 * @param regs     registros del Historial (ya filtrados por fecha/equipo si corresponde)
 * @param equipos  inventario (para tipo de equipo)
 * @param opciones { incluirMantenciones: false } → por defecto solo cuenta lo que NO es mantención
 */
export const analizarFallas = (regs, equipos = [], { incluirMantenciones = false } = {}) => {
  const eqPorAfi = new Map(equipos.map(e => [String(e.afi).trim().toUpperCase(), e]));
  const lista = regs
    .filter(r => normalizarFecha(r.fecha) && (incluirMantenciones || !claseMantencion(r)))
    .map(r => {
      const cat = categorizar(r);
      const eq = eqPorAfi.get(String(r.afi).trim().toUpperCase());
      return { r, afi: String(r.afi).trim(), fecha: normalizarFecha(r.fecha), cat, min: minutosTrabajo(r),
        problema: problemaDe(r), tipoEquipo: String(eq?.tipo || r.equipo || 'SIN TIPO').trim().toUpperCase() || 'SIN TIPO', costo: Number(r.costo) || 0 };
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const total = lista.length;
  const porCat = new Map(), minPorCat = new Map(), porProblema = new Map(), equiposPorProblema = new Map(), palabras = new Map(), porMes = new Map();
  const porAfi = new Map(), porTipo = new Map(), equiposPorTipo = new Map();
  let minTotal = 0, conHoras = 0, costoTotal = 0;

  lista.forEach(x => {
    incr(porCat, x.cat.key);
    if (x.min) { incr(minPorCat, x.cat.key, x.min); minTotal += x.min; conHoras++; }
    costoTotal += x.costo;
    if (x.problema) {
      incr(porProblema, x.problema);
      if (!equiposPorProblema.has(x.problema)) equiposPorProblema.set(x.problema, new Set());
      equiposPorProblema.get(x.problema).add(x.afi);
    }
    palabrasDe(x.r).forEach(w => incr(palabras, w));
    const mes = mesDe(x.fecha);
    if (!porMes.has(mes)) porMes.set(mes, new Map());
    incr(porMes.get(mes), x.cat.key);
    if (!porAfi.has(x.afi)) porAfi.set(x.afi, []);
    porAfi.get(x.afi).push(x);
    incr(porTipo, x.tipoEquipo);
    if (!equiposPorTipo.has(x.tipoEquipo)) equiposPorTipo.set(x.tipoEquipo, new Set());
    equiposPorTipo.get(x.tipoEquipo).add(x.afi);
  });

  const categorias = CATEGORIAS_FALLA.concat([CATEGORIA_OTROS])
    .map(c => ({ ...c, n: porCat.get(c.key) || 0, pct: pct(porCat.get(c.key) || 0, total), min: minPorCat.get(c.key) || 0 }))
    .filter(c => c.n > 0).sort((a, b) => b.n - a.n);

  const problemas = top(porProblema, 15).filter(([, n]) => n > 1)
    .map(([p, n]) => ({ problema: p, n, equipos: Array.from(equiposPorProblema.get(p) || []) }));

  const equiposRank = Array.from(porAfi.entries()).map(([afi, xs]) => resumenEquipo(afi, xs, eqPorAfi.get(afi.toUpperCase())))
    .sort((a, b) => b.n - a.n || b.min - a.min);

  // Tipo de equipo: fallas por equipo y sistema más común
  const tipos = Array.from(porTipo.entries()).map(([tipo, n]) => {
    const xs = lista.filter(x => x.tipoEquipo === tipo);
    const c = new Map(); xs.forEach(x => incr(c, x.cat.key));
    const [k] = top(c, 1)[0] || [];
    const nEq = equiposPorTipo.get(tipo).size;
    return { tipo, n, equipos: nEq, porEquipo: Math.round((n / nEq) * 10) / 10, catTop: categoriaPorKey(k), catTopPct: pct(c.get(k) || 0, n) };
  }).sort((a, b) => b.n - a.n);

  const meses = Array.from(porMes.keys()).sort();
  const hallazgos = hallazgosGenerales({ total, categorias, problemas, equiposRank, tipos, lista, minTotal });

  return {
    total, equiposAfectados: porAfi.size, minTotal, minPromedio: conHoras ? Math.round(minTotal / conHoras) : 0, conHoras, costoTotal,
    repetidas: equiposRank.reduce((s, e) => s + e.repetidas, 0),
    categorias, problemas, equiposRank, tipos, palabras: top(palabras, 30), meses, porMes, hallazgos, lista
  };
};

/** Resumen de un equipo a partir de sus registros ya clasificados. */
export const resumenEquipo = (afi, xs, eq = null) => {
  const c = new Map(), p = new Map(); let min = 0, costo = 0;
  xs.forEach(x => { incr(c, x.cat.key); if (x.problema) incr(p, x.problema); min += x.min || 0; costo += x.costo; });
  const cats = top(c, 5).map(([k, n]) => ({ ...categoriaPorKey(k), n, pct: pct(n, xs.length) }));
  const probs = top(p, 5).map(([k, n]) => ({ problema: k, n }));
  // Repetidas: mismo sistema en menos de 30 días
  let repetidas = 0; const ultimaPorCat = new Map(); const ejemplosRep = [];
  xs.forEach(x => {
    const ant = ultimaPorCat.get(x.cat.key);
    if (ant && x.cat.key !== 'SERVICIO' && x.cat.key !== 'OTROS') {
      const d = diasEntre(x.fecha, ant.fecha);
      if (d !== null && d <= 30) { repetidas++; ejemplosRep.push({ cat: x.cat, dias: d, fecha: x.fecha }); }
    }
    ultimaPorCat.set(x.cat.key, x);
  });
  const primera = xs[0]?.fecha || '', ultima = xs[xs.length - 1]?.fecha || '';
  const mtbf = xs.length > 1 ? Math.round(diasEntre(ultima, primera) / (xs.length - 1)) : null;
  return {
    afi, tipo: String(eq?.tipo || xs[0]?.tipoEquipo || ''), marca: eq?.marca || '', modelo: eq?.modelo || '',
    n: xs.length, min, costo, cats, catTop: cats[0] || null, probs, probTop: probs[0] || null,
    repetidas, ejemplosRep, primera, ultima, mtbf, diasDesdeUltima: ultima ? diasEntre(hoyISO(), ultima) : null
  };
};

// ---------------------------------------------------------------------
// Hallazgos en palabras
// ---------------------------------------------------------------------
const hallazgosGenerales = ({ total, categorias, problemas, equiposRank, tipos, lista, minTotal }) => {
  const h = [];
  if (!total) return [{ nivel: 'info', texto: 'No hay intervenciones en el período/filtro elegido.' }];
  const fallasReales = categorias.filter(c => c.key !== 'SERVICIO' && c.key !== 'OTROS');
  if (fallasReales[0]) h.push({ nivel: 'alto', icon: fallasReales[0].icon, texto: `Lo que más falla es el sistema **${fallasReales[0].label}**: ${fallasReales[0].n} de ${total} intervenciones (${fallasReales[0].pct}%).` + (fallasReales[1] ? ` Le sigue **${fallasReales[1].label}** (${fallasReales[1].pct}%).` : '') });
  const masHoras = [...categorias].sort((a, b) => b.min - a.min)[0];
  if (masHoras && masHoras.min && minTotal) h.push({ nivel: 'medio', icon: 'fa-clock', texto: `El sistema que más horas de taller consume es **${masHoras.label}**: ${fmtMin(masHoras.min)} (${pct(masHoras.min, minTotal)}% del tiempo registrado).` });
  if (problemas[0]) h.push({ nivel: 'alto', icon: 'fa-repeat', texto: `El problema que más se repite es "**${problemas[0].problema.toLowerCase()}**": ${problemas[0].n} veces en ${problemas[0].equipos.length} equipo(s).` });
  if (equiposRank[0] && equiposRank[0].n >= 3) {
    const e = equiposRank[0];
    h.push({ nivel: 'alto', icon: 'fa-triangle-exclamation', texto: `El equipo con más fallas es **AFI ${e.afi}** (${e.tipo}): ${e.n} intervenciones` + (e.catTop ? `, sobre todo ${e.catTop.label.toLowerCase()} (${e.catTop.pct}%)` : '') + '.' });
  }
  const conRep = equiposRank.filter(e => e.repetidas > 0);
  if (conRep.length) h.push({ nivel: 'alto', icon: 'fa-rotate-left', texto: `**${conRep.length} equipo(s)** volvieron a fallar en el mismo sistema en menos de 30 días (${conRep.slice(0, 5).map(e => 'AFI ' + e.afi).join(', ')}${conRep.length > 5 ? '…' : ''}). Puede que la causa raíz no se esté resolviendo.` });
  const tipoPeor = tipos.filter(t => t.equipos >= 2).sort((a, b) => b.porEquipo - a.porEquipo)[0];
  if (tipoPeor) h.push({ nivel: 'medio', icon: 'fa-layer-group', texto: `Por tipo de equipo, **${tipoPeor.tipo}** es el que más falla por unidad: ${tipoPeor.porEquipo} intervenciones por equipo (lo más común: ${tipoPeor.catTop.label.toLowerCase()}).` });
  // Tendencia: últimos 90 días vs 90 anteriores
  const hoy = hoyISO();
  const u90 = lista.filter(x => { const d = diasEntre(hoy, x.fecha); return d !== null && d >= 0 && d < 90; }).length;
  const p90 = lista.filter(x => { const d = diasEntre(hoy, x.fecha); return d !== null && d >= 90 && d < 180; }).length;
  if (u90 + p90 >= 5 && p90) {
    const v = Math.round(((u90 - p90) / p90) * 100);
    if (Math.abs(v) >= 15) h.push({ nivel: v > 0 ? 'alto' : 'ok', icon: v > 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down', texto: `En los últimos 90 días hubo **${u90}** intervenciones vs ${p90} en los 90 anteriores (${v > 0 ? '+' : ''}${v}%).` });
  }
  const otros = categorias.find(c => c.key === 'OTROS');
  if (otros && otros.pct >= 20) h.push({ nivel: 'info', icon: 'fa-circle-info', texto: `${otros.pct}% de los registros no se pudo clasificar: conviene escribir la **causa detallada** con el sistema y la pieza (ej. "cambio de batería", "fuga manguera hidráulica").` });
  return h;
};

/** Hallazgos de un equipo (Perfil), comparando con el promedio de su tipo. */
export const hallazgosEquipo = (res, analisisGeneral = null) => {
  const h = [];
  if (!res || !res.n) return [{ nivel: 'ok', icon: 'fa-circle-check', texto: 'Este equipo no tiene fallas registradas (fuera de mantenciones) en el período.' }];
  if (res.catTop) h.push({ nivel: 'alto', icon: res.catTop.icon, texto: `Lo que más le falla es **${res.catTop.label}**: ${res.catTop.n} de ${res.n} intervenciones (${res.catTop.pct}%).` });
  if (res.probTop && res.probTop.n > 1) h.push({ nivel: 'alto', icon: 'fa-repeat', texto: `Problema repetido: "**${res.probTop.problema.toLowerCase()}**" (${res.probTop.n} veces).` });
  if (res.repetidas) {
    const e = res.ejemplosRep[res.ejemplosRep.length - 1];
    h.push({ nivel: 'alto', icon: 'fa-rotate-left', texto: `Volvió a fallar **${res.repetidas} ${res.repetidas === 1 ? 'vez' : 'veces'}** en el mismo sistema en menos de 30 días (la última: ${e.cat.label.toLowerCase()} a los ${e.dias} días). Revisar causa raíz.` });
  }
  if (res.mtbf !== null) h.push({ nivel: res.mtbf < 30 ? 'alto' : res.mtbf < 90 ? 'medio' : 'ok', icon: 'fa-calendar-days', texto: `Falla en promedio cada **${res.mtbf} días**` + (res.diasDesdeUltima !== null ? ` · la última fue hace ${res.diasDesdeUltima} días.` : '.') });
  if (res.min) h.push({ nivel: 'info', icon: 'fa-clock', texto: `Lleva **${fmtMin(res.min)}** de trabajo de taller en fallas.` });
  if (analisisGeneral) {
    const t = analisisGeneral.tipos.find(x => x.tipo === String(res.tipo).trim().toUpperCase());
    if (t && t.equipos >= 2 && t.porEquipo > 0) {
      const veces = Math.round((res.n / t.porEquipo) * 10) / 10;
      if (veces >= 1.5) h.push({ nivel: 'alto', icon: 'fa-scale-unbalanced', texto: `Falla **${veces} veces más** que el promedio de los ${t.tipo} (${t.porEquipo} por equipo).` });
      else if (veces <= 0.6) h.push({ nivel: 'ok', icon: 'fa-thumbs-up', texto: `Falla menos que el promedio de los ${t.tipo} (${t.porEquipo} por equipo).` });
    }
  }
  return h;
};

/** "**texto**" → <b>texto</b> (los hallazgos se muestran con v-html; se escapa el resto). */
export const htmlHallazgo = (t) => String(t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
export const claseNivel = (n) => n === 'alto' ? 'bg-rose-50 border-rose-200 text-rose-900' : n === 'medio' ? 'bg-amber-50 border-amber-200 text-amber-900'
  : n === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700';
