// =====================================================================
// HISTORIAL · Conversión fila Supabase (BD_HISTORIAL) -> objeto de la app
// =====================================================================
import { formatExcelDate } from '../../core/utils.js';

import { TABLAS } from '../../core/tablas.js';
export const TABLA_HISTORIAL = TABLAS.HISTORIAL;

// Filtros utilizados: se guardan como JSON en la columna `kit_bodega`.
// (El original los leía desde `filtros_json`, columna que NO existe en la BD,
//  por eso nunca reaparecían al recargar.)
export const COL_FILTROS_LECTURA = 'kit_bodega';
export const COL_FILTROS_ESCRITURA = 'kit_bodega';

/**
 * Catálogo de aceites e insumos.
 *  key = campo en el formulario / objeto de la app
 *  col = columna real en BD_HISTORIAL
 * (La columna real del refrigerante es `aceite_refrigerante_5050`; el resumen original la
 *  buscaba como `aceite_refrigerante_50`, por eso nunca aparecía en Control Aceites.)
 */
export const ACEITES = [
  { key: 'aceite_15w40_ci4', col: 'aceite_15w40_ci4' },
  { key: 'aceite_15w40_ck4', col: 'aceite_15w40_ck4' },
  { key: 'aceite_refrigerante_50', col: 'aceite_refrigerante_5050' },
  { key: 'aceite_80w90', col: 'aceite_80w90' },
  { key: 'aceite_dacnis_68', col: 'aceite_dacnis_68' },
  { key: 'aceite_dacnis_46', col: 'aceite_dacnis_46' },
  { key: 'paroil_m_extreme', col: 'paroil_m_extreme' },
  { key: 'paroil_s_extreme', col: 'paroil_s_extreme' },
  { key: 'aceite_5w30', col: 'aceite_5w30' },
  { key: 'liquido_freno_dot4', col: 'liquido_freno_dot4' },
  { key: 'tractofluid_10w30', col: 'tractofluid_10w30' },
  { key: 'sae_30', col: 'sae_30' },
  { key: 'hydra46', col: 'hydra46' },
  { key: 'hydra_68', col: 'hydra_68' },
  { key: 'adblue', col: 'adblue' },
  { key: 'aceite_75w90', col: 'aceite_75w90' },
  { key: 'aceite_10w40', col: 'aceite_10w40' },
  { key: 'multiproposito', col: 'multiproposito' },
  { key: 'desegransante', col: 'desegransante' },
  { key: 'acido_muriatico', col: 'acido_muriatico' }
].map(a => ({ ...a, label: a.key.replace('aceite_', '').replace(/_/g, ' ').toUpperCase() }));

/** Objeto con todos los aceites vacíos (para el formulario). */
export const aceitesVacios = () => Object.fromEntries(ACEITES.map(a => [a.key, ""]));

const parseFiltros = (raw) => {
  try {
    if (!raw) return [];
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
};

export const mapIntervencion = (item) => {
  const filtrosLista = parseFiltros(item[COL_FILTROS_LECTURA]);
  const filtrosTexto = filtrosLista.map(f => {
    const extra = [f.proveedor, Number(f.precio) > 0 ? '$' + Math.round(Number(f.precio)).toLocaleString('es-CL') : ''].filter(Boolean).join(' ');
    return `${f.tipo || 'Filtro'} (${f.marca || '-'}: ${f.codigo || '-'} x${f.cantidad || 1}${extra ? ' · ' + extra : ''})`;
  }).join('; ');

  const aceitesObj = {};
  const aceitesConsumidos = [];
  ACEITES.forEach(a => {
    const v = item[a.col];
    aceitesObj[a.key] = v || 0;
    if (v && Number(v) > 0) aceitesConsumidos.push(`${a.label}: ${v}L`);
  });

  return {
    id: item.id,
    afi: String(item.afi || '').trim(),
    fecha: formatExcelDate(item.fecha || item.created_at),
    programaCorrespondiente: String(item.uso_de_art || ''),
    equipo: String(item.equipo || ''),
    lugar: String(item.lugar || ''),
    causa: String(item.causa || ''),
    tipoMant: String(item.tipo_mantencion || ''),
    tipoHorasMant: String(item.tipo_horas_mantencion || ''),
    horometro: Number(item.horometro || 0),
    mec1: String(item.mecanico_1 || ''), mec2: String(item.mecanico_2 || ''),
    mec3: String(item.mecanico_3 || ''), mec4: String(item.mecanico_4 || ''),
    horaInicio: String(item.hora_inicio || ''),
    horaTermino: String(item.hora_termino || ''),
    horaTotal: String(item.hora_total || ''),
    causaDetallada: String(item.causa_intervencion || ''),
    descripcion: String(item.descripcion || '').trim(),
    interferencia: String(item.interferencia || ''),
    empresaArriendo: String(item.empresa || ''),
    costo: Number(item.costo || 0),
    numeroOC: String(item.numero_oc || ''),
    numeroOT: String(item.numero_ot || ''),
    linkDrive: String(item.link || ''),
    filtrosLista,
    filtrosTexto,
    ...aceitesObj,
    aceites: aceitesConsumidos.length > 0 ? aceitesConsumidos.join("; ") : "Sin consumo"
  };
};
