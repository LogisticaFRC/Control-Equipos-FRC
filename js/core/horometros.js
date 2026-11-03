// =====================================================================
// CORE · Cálculo predictivo de horómetros y próxima mantención
// (usado por Dashboard, Inventario y Perfil de Equipo)
// =====================================================================
import { normalizarFecha, normalizarClave, parseIsoDate, diasEntre, hoyISO, sumarDiasISO } from './utils.js';

const USO_POR_DEFECTO_HRS_DIA = 1.5;
const UMBRAL_PROXIMO_HRS = 50;
const UMBRAL_ANUAL_DIAS = 30;   // aviso "MANT. ANUAL PRÓXIMA" desde 30 días antes de cumplir el año

const sinTildes = (s) => String(s || '').trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Días entre dos fechas (valor absoluto, mínimo 1). */
const calcularDiasExactos = (f1, f2) => {
  const d = diasEntre(f1, f2);
  return d === null ? 1 : Math.max(1, Math.abs(d));
};

/** Agrupa intervenciones por AFI ordenadas por fecha ascendente. */
const agruparPorAfi = (intervenciones) => {
  const map = {};
  intervenciones.forEach(i => {
    if (!i.afi) return;
    const k = String(i.afi).trim().toUpperCase();
    (map[k] = map[k] || []).push(i);
  });
  for (const k in map) map[k].sort((a, b) => parseIsoDate(a.fecha) - parseIsoDate(b.fecha));
  return map;
};

/** Solo cuenta como mantención el registro que dice "MANTENCIÓN" (causa o tipo). */
const esMantencionReal = (i) => {
  const c = sinTildes(i.causa), t = sinTildes(i.tipoMant);
  return c.includes('MANTENCION') || c.includes('MANTENIMIENTO') || t.includes('MANTENCION');
};

/** Suma años a una fecha ISO (29-feb → 28-feb si el año destino no es bisiesto). */
const sumarAniosISO = (iso, anios) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  const ultimoDiaMes = new Date(y + anios, m, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  return `${y + anios}-${pad(m)}-${pad(Math.min(d, ultimoDiaMes))}`;
};

/** Alerta por tiempo: 1 año desde la última mantención (con aviso 30 días antes). */
const calcularMantencionAnual = (fechaUltimaMant, hoy) => {
  const base = normalizarFecha(fechaUltimaMant);
  if (!base || diasEntre(hoy, base) === null) {
    return { fechaVencAnual: '-', diasParaAnual: null, estadoAnual: 'SIN REGISTRO' };
  }
  const fechaVencAnual = sumarAniosISO(base, 1);
  const diasParaAnual = diasEntre(fechaVencAnual, hoy);   // negativo = ya pasó el año
  const estadoAnual = diasParaAnual <= 0 ? 'ANUAL VENCIDA' : diasParaAnual <= UMBRAL_ANUAL_DIAS ? 'ANUAL PRÓXIMA' : 'AL DÍA';
  return { fechaVencAnual, diasParaAnual, estadoAnual };
};

/** Calcula el objeto `horometros` de un equipo a partir de su historial. */
export const calcularHorometrosEquipo = (eq, histFull) => {
  const hoy = hoyISO();
  const histConHorometro = histFull.filter(i => Number(i.horometro) > 0 && i.fecha && i.fecha !== '-');
  const histMant = histConHorometro.filter(esMantencionReal);

  const ultimaMant = histMant.length > 0 ? histMant[histMant.length - 1] : null;
  const hUltimaMant = ultimaMant ? Number(ultimaMant.horometro) : 0;
  const ultimaMantFecha = ultimaMant ? ultimaMant.fecha : '-';
  // Penúltima: la mantención anterior con horómetro MENOR y fecha ANTERIOR (ignora registros duplicados de la misma mantención)
  const penultimaMant = ultimaMant
    ? [...histMant].reverse().find(i => Number(i.horometro) < hUltimaMant && parseIsoDate(i.fecha) < parseIsoDate(ultimaMantFecha)) || null
    : null;
  const ultimoReg = histConHorometro.length > 0 ? histConHorometro[histConHorometro.length - 1] : (histFull.length > 0 ? histFull[histFull.length - 1] : null);

  // Último horómetro tomado: el manual si existe y es más nuevo; si no, el último registro del historial
  const hTomadoManual = Number(eq.horometroActual) || 0;
  const fechaManual = normalizarFecha(eq.fechaHorometroManual);
  const hReg = ultimoReg ? Number(ultimoReg.horometro) || 0 : 0;
  const usarManual = hTomadoManual > 0 && fechaManual && hTomadoManual >= hReg;
  let hUltimoTomado = usarManual ? hTomadoManual : hReg;
  let fechaUltimoHorometro = usarManual ? fechaManual : (ultimoReg ? ultimoReg.fecha : '-');
  // Nunca puede ser menor que la última mantención
  if (ultimaMant && hUltimoTomado < hUltimaMant) { hUltimoTomado = hUltimaMant; fechaUltimoHorometro = ultimaMantFecha; }

  // ---------- Tasa de uso (hrs/día) — misma lógica que el Excel ----------
  // 1) (Último horómetro tomado − Última mantención) / (fecha horómetro − fecha mantención)
  // 2) Si son iguales (recién mantenido, diferencia 0): (Última mant. − Penúltima mant.) / (fecha última − fecha penúltima)
  let rateHrsDia = 0, metodoCalculo = 'POR DEFECTO', calc = null;
  const dHTomado = hUltimoTomado - hUltimaMant;
  const dDiasTomado = diasEntre(fechaUltimoHorometro, ultimaMantFecha);
  if (ultimaMant && dHTomado > 0 && dDiasTomado > 0) {
    rateHrsDia = dHTomado / dDiasTomado;
    metodoCalculo = 'TOMADO vs ÚLT. MANT.';
    calc = { hDesde: hUltimaMant, fDesde: ultimaMantFecha, hHasta: hUltimoTomado, fHasta: fechaUltimoHorometro, horas: dHTomado, dias: dDiasTomado };
  } else if (ultimaMant && penultimaMant) {
    const dH = hUltimaMant - Number(penultimaMant.horometro);
    const dD = diasEntre(ultimaMantFecha, penultimaMant.fecha);
    if (dH > 0 && dD > 0) {
      rateHrsDia = dH / dD;
      metodoCalculo = 'PENÚLT. vs ÚLT. MANT.';
      calc = { hDesde: Number(penultimaMant.horometro), fDesde: penultimaMant.fecha, hHasta: hUltimaMant, fHasta: ultimaMantFecha, horas: dH, dias: dD };
    }
  }
  if (!(rateHrsDia > 0) && histConHorometro.length >= 2) {
    const penultimoReg = histConHorometro[histConHorometro.length - 2];
    const dH = Number(ultimoReg.horometro) - Number(penultimoReg.horometro);
    const dD = calcularDiasExactos(ultimoReg.fecha, penultimoReg.fecha);
    if (dH > 0) {
      rateHrsDia = dH / dD;
      metodoCalculo = 'ÚLTIMOS 2 REGISTROS';
      calc = { hDesde: Number(penultimoReg.horometro), fDesde: penultimoReg.fecha, hHasta: Number(ultimoReg.horometro), fHasta: ultimoReg.fecha, horas: dH, dias: dD };
    }
  }
  if (!(rateHrsDia > 0)) { rateHrsDia = USO_POR_DEFECTO_HRS_DIA; metodoCalculo = 'POR DEFECTO'; calc = null; }

  // Si no hay fecha válida del último horómetro, no se proyecta (antes daba NaN)
  const diasDesdeUltimo = Math.max(0, diasEntre(hoy, fechaUltimoHorometro) ?? 0);
  const estaFueraServicio = normalizarClave(eq.disponibilidad) === 'Fuera de Servicio';
  const hAprox = estaFueraServicio ? hUltimoTomado : Math.round((hUltimoTomado + diasDesdeUltimo * rateHrsDia) * 10) / 10;

  const frecuencia = Number(eq.frecuenciaMantencion) || 250;
  const hTarget = hUltimaMant + frecuencia;
  const faltan = hTarget - hAprox;

  const diasFaltantes = rateHrsDia > 0 ? Math.ceil(faltan / rateHrsDia) : 30;
  let fechaEstimada = '-';
  try { fechaEstimada = sumarDiasISO(hoy, diasFaltantes); } catch (e) {}

  // Mantención anual: se toma la mantención más reciente por FECHA (aunque no tenga horómetro registrado)
  const mantConFecha = histFull.filter(i => esMantencionReal(i) && normalizarFecha(i.fecha));
  const ultimaMantPorFecha = mantConFecha.length > 0 ? mantConFecha[mantConFecha.length - 1].fecha : '-';
  const baseAnual = parseIsoDate(ultimaMantPorFecha) > parseIsoDate(ultimaMantFecha) ? ultimaMantPorFecha : ultimaMantFecha;
  const anual = calcularMantencionAnual(baseAnual, hoy);

  const estadoTexto = faltan <= 0 ? "¡PASADO!" : faltan <= UMBRAL_PROXIMO_HRS ? "PRÓXIMO" : "AL DÍA";

  return {
    hTomado: hUltimoTomado, fechaUltimoHorometro, hUltimaMant, ultimaMantFecha,
    hAprox, hTarget, horasFaltantes: Math.round(faltan * 10) / 10,
    estadoTexto, rateHrsDia, fechaEstimada, metodoCalculo, calc,
    hPenultimaMant: penultimaMant ? Number(penultimaMant.horometro) : 0,
    penultimaMantFecha: penultimaMant ? penultimaMant.fecha : '-',
    fechaBaseAnual: baseAnual, ...anual
  };
};

/** Recalcula `horometros` para toda la flota (muta cada equipo). */
export const actualizarHorometrosDesdeHistorial = (equipos, intervenciones) => {
  const porAfi = agruparPorAfi(intervenciones);
  equipos.forEach(eq => {
    eq.horometros = calcularHorometrosEquipo(eq, porAfi[String(eq.afi).trim().toUpperCase()] || []);
  });
};

// ---------- Clases visuales según estado del horómetro ----------
export const getHorometroCardBgClass = (h) => esAlertaRoja(h) ? 'bg-rose-50 border-rose-300' : (h?.horasFaltantes <= UMBRAL_PROXIMO_HRS || tieneAlertaAnual(h)) ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200';
export const getPrediccionStatusBadge = (h) => h?.horasFaltantes <= 0 ? 'bg-rose-600 text-white animate-pulse' : h?.horasFaltantes <= UMBRAL_PROXIMO_HRS ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white';

// ---------- Mantención anual (por fecha) ----------
export const esAnualVencida = (h) => h?.diasParaAnual !== null && h?.diasParaAnual !== undefined && h.diasParaAnual <= 0;
export const esAnualProxima = (h) => h?.diasParaAnual !== null && h?.diasParaAnual !== undefined && h.diasParaAnual > 0 && h.diasParaAnual <= UMBRAL_ANUAL_DIAS;
export const tieneAlertaAnual = (h) => esAnualVencida(h) || esAnualProxima(h);
export const getAnualStatusBadge = (h) => esAnualVencida(h) ? 'bg-rose-600 text-white animate-pulse' : esAnualProxima(h) ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white';
/** Texto corto: "Vencida hace 15 días" / "Faltan 20 días" / "Faltan 120 días". */
export const getAnualTextoDias = (h) => {
  if (h?.diasParaAnual === null || h?.diasParaAnual === undefined) return 'Sin mantención registrada';
  const d = h.diasParaAnual;
  return d < 0 ? `Vencida hace ${Math.abs(d)} día${Math.abs(d) === 1 ? '' : 's'}` : d === 0 ? 'Vence hoy' : `Faltan ${d} día${d === 1 ? '' : 's'}`;
};
/** Rojo si está pasado por horas o vencida la anual; ámbar si es solo "próximo". */
export const esAlertaRoja = (h) => h?.horasFaltantes <= 0 || esAnualVencida(h);

export const esEquipoCritico = (eq) => Boolean(eq.horometros) && (eq.horometros.horasFaltantes <= UMBRAL_PROXIMO_HRS || tieneAlertaAnual(eq.horometros));
