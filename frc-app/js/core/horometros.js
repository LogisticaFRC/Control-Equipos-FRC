// =====================================================================
// CORE · Cálculo predictivo de horómetros y próxima mantención
// (usado por Dashboard, Inventario y Perfil de Equipo)
// =====================================================================
import { normalizarFecha, normalizarClave, parseIsoDate, diasEntre, hoyISO, sumarDiasISO } from './utils.js';

const USO_POR_DEFECTO_HRS_DIA = 1.5;
const UMBRAL_PROXIMO_HRS = 50;

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

const esMantencionReal = (i) => {
  const c = sinTildes(i.causa), t = sinTildes(i.tipoMant);
  return c.includes('MANTENCION') || c.includes('MANTENIMIENTO') || t.includes('MANTENCION') || t.includes('PREVENTIVA');
};

/** Calcula el objeto `horometros` de un equipo a partir de su historial. */
export const calcularHorometrosEquipo = (eq, histFull) => {
  const hoy = hoyISO();
  const histConHorometro = histFull.filter(i => Number(i.horometro) > 0 && i.fecha && i.fecha !== '-');
  const histMant = histConHorometro.filter(esMantencionReal);

  const ultimaMant = histMant.length > 0 ? histMant[histMant.length - 1] : null;
  const penultimaMant = histMant.length >= 2 ? histMant[histMant.length - 2] : null;
  const ultimoReg = histConHorometro.length > 0 ? histConHorometro[histConHorometro.length - 1] : (histFull.length > 0 ? histFull[histFull.length - 1] : null);

  const hTomadoManual = Number(eq.horometroActual) || 0;
  const hUltimoTomado = hTomadoManual > 0 ? hTomadoManual : (ultimoReg ? Number(ultimoReg.horometro) || 0 : 0);
  const fechaUltimoHorometro = hTomadoManual > 0 && eq.fechaHorometroManual ? normalizarFecha(eq.fechaHorometroManual) : (ultimoReg ? ultimoReg.fecha : '-');

  const hUltimaMant = ultimaMant ? Number(ultimaMant.horometro) : 0;
  const ultimaMantFecha = ultimaMant ? ultimaMant.fecha : '-';

  // Tasa de uso (hrs/día)
  let rateHrsDia = 0;
  if (ultimaMant && hUltimoTomado > Number(ultimaMant.horometro)) {
    rateHrsDia = (hUltimoTomado - Number(ultimaMant.horometro)) / calcularDiasExactos(fechaUltimoHorometro, ultimaMantFecha);
  } else if (ultimaMant && penultimaMant && hUltimoTomado === Number(ultimaMant.horometro)) {
    rateHrsDia = (hUltimoTomado - Number(penultimaMant.horometro)) / calcularDiasExactos(fechaUltimoHorometro, penultimaMant.fecha);
  } else if (histConHorometro.length >= 2) {
    const penultimoReg = histConHorometro[histConHorometro.length - 2];
    const dH = Number(ultimoReg.horometro) - Number(penultimoReg.horometro);
    if (dH > 0) rateHrsDia = dH / calcularDiasExactos(ultimoReg.fecha, penultimoReg.fecha);
  }
  if (!(rateHrsDia > 0)) rateHrsDia = USO_POR_DEFECTO_HRS_DIA;

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

  const estadoTexto = faltan <= 0 ? "¡PASADO!" : faltan <= UMBRAL_PROXIMO_HRS ? "PRÓXIMO" : "AL DÍA";

  return {
    hTomado: hUltimoTomado, fechaUltimoHorometro, hUltimaMant, ultimaMantFecha,
    hAprox, hTarget, horasFaltantes: Math.round(faltan * 10) / 10,
    estadoTexto, rateHrsDia, fechaEstimada
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
export const getHorometroCardBgClass = (h) => h?.horasFaltantes <= 0 ? 'bg-rose-50 border-rose-300' : h?.horasFaltantes <= UMBRAL_PROXIMO_HRS ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200';
export const getPrediccionStatusBadge = (h) => h?.horasFaltantes <= 0 ? 'bg-rose-600 text-white animate-pulse' : h?.horasFaltantes <= UMBRAL_PROXIMO_HRS ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white';
export const esEquipoCritico = (eq) => Boolean(eq.horometros) && eq.horometros.horasFaltantes <= UMBRAL_PROXIMO_HRS;
