// =====================================================================
// EPP · Catálogo de elementos + conversión filas Supabase → objetos de la app
// (archivo "hoja": no importa nada del store para evitar dependencias circulares)
// =====================================================================
import { TABLAS } from '../../core/tablas.js';
import { formatExcelDate } from '../../core/utils.js';

export const TABLA_TRABAJADORES = TABLAS.TRABAJADORES;
export const TABLA_EPP_ENTREGAS = TABLAS.EPP_ENTREGAS;

/**
 * Elementos de protección personal (mismo orden que la planilla Excel).
 *   talla: true → el trabajador tiene una talla guardada (columna talla_<key> en bd_trabajadores)
 *   tipo: 'num' (calzado) | 'ropa' (S..XXXL) → sugerencias del campo talla
 * Para agregar un elemento nuevo basta sumarlo aquí (si tiene talla, agregar también la columna en sql/epp.sql).
 */
export const ELEMENTOS_EPP = [
  { key: 'calzado', label: 'Calzado de seguridad', corto: 'Calzado', icon: 'fa-shoe-prints', talla: true, tipo: 'num' },
  { key: 'buzo', label: 'Buzo', corto: 'Buzo', icon: 'fa-user-astronaut', talla: true, tipo: 'ropa' },
  { key: 'pantalon', label: 'Pantalón', corto: 'Pantalón', icon: 'fa-person', talla: true, tipo: 'ropa' },
  { key: 'polera', label: 'Polera', corto: 'Polera', icon: 'fa-shirt', talla: true, tipo: 'ropa' },
  { key: 'parka', label: 'Parka', corto: 'Parka', icon: 'fa-vest', talla: true, tipo: 'ropa' },
  { key: 'primera_capa', label: 'Primera capa', corto: '1ª capa', icon: 'fa-layer-group', talla: true, tipo: 'ropa' },
  { key: 'guantes_cabritilla', label: 'Guantes cabritilla', corto: 'G. cabritilla', icon: 'fa-hand', talla: false },
  { key: 'guantes_multiflex', label: 'Guantes multiflex', corto: 'G. multiflex', icon: 'fa-hand', talla: false },
  { key: 'guante_soldador', label: 'Guante soldador', corto: 'G. soldador', icon: 'fa-hand-back-fist', talla: false },
  { key: 'lente_claro', label: 'Lente claro', corto: 'Lente claro', icon: 'fa-glasses', talla: false },
  { key: 'lente_oscuro', label: 'Lente oscuro', corto: 'Lente oscuro', icon: 'fa-glasses', talla: false },
  { key: 'respirador', label: 'Respirador', corto: 'Respirador', icon: 'fa-head-side-mask', talla: true, tipo: 'ropa' },
  { key: 'fonos_auditivos', label: 'Fonos auditivos', corto: 'Fonos', icon: 'fa-headphones', talla: false },
  { key: 'tapon_auditivo', label: 'Tapón auditivo', corto: 'Tapón', icon: 'fa-ear-deaf', talla: false }
];
export const ELEMENTOS_CON_TALLA = ELEMENTOS_EPP.filter(e => e.talla);
export const elementoEPP = (key) => ELEMENTOS_EPP.find(e => e.key === key) || { key, label: key, corto: key, icon: 'fa-box', talla: false };

export const TALLAS_ROPA = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
export const TALLAS_CALZADO = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47'];

export const MOTIVOS_ENTREGA = [
  { key: 'NUEVO', label: 'Entrega inicial / nuevo' },
  { key: 'REPOSICION', label: 'Reposición (vida útil)' },
  { key: 'DETERIORO', label: 'Deterioro / daño' },
  { key: 'PERDIDA', label: 'Pérdida' },
  { key: 'HISTORICO', label: 'Histórico (planilla)' }
];

const txt = (v) => String(v ?? '').trim();

export const mapTrabajador = (r) => {
  let req = r.epp_requiere;
  if (typeof req === 'string') { try { req = JSON.parse(req); } catch (e) { req = {}; } }
  const tallas = {};
  ELEMENTOS_CON_TALLA.forEach(e => { tallas[e.key] = txt(r['talla_' + e.key]).toUpperCase(); });
  return {
    id: r.id,
    nombre: txt(r.nombre).toUpperCase(),
    rut: txt(r.rut),
    cargo: txt(r.cargo).toUpperCase(),
    activo: r.activo !== false,
    tallas,
    requiere: Object.fromEntries(ELEMENTOS_EPP.map(e => [e.key, Boolean(req && req[e.key])])),
    observaciones: txt(r.observaciones),
    creadoPor: txt(r.creado_por)
  };
};

export const mapEntrega = (r) => ({
  id: r.id,
  trabajadorId: r.trabajador_id,
  fecha: formatExcelDate(r.fecha || r.created_at),
  elemento: txt(r.elemento),
  talla: txt(r.talla).toUpperCase(),
  cantidad: Number(r.cantidad || 1),
  motivo: txt(r.motivo).toUpperCase(),
  observaciones: txt(r.observaciones),
  entregadoPor: txt(r.entregado_por),
  creado: r.created_at || ''
});

/** Objeto de la app → fila de bd_trabajadores. */
export const trabajadorAFila = (t) => {
  const fila = {
    nombre: txt(t.nombre).toUpperCase(),
    rut: txt(t.rut).toUpperCase() || null,
    cargo: txt(t.cargo).toUpperCase(),
    activo: t.activo !== false,
    epp_requiere: Object.fromEntries(ELEMENTOS_EPP.map(e => [e.key, Boolean(t.requiere && t.requiere[e.key])])),
    observaciones: txt(t.observaciones)
  };
  ELEMENTOS_CON_TALLA.forEach(e => { fila['talla_' + e.key] = txt(t.tallas && t.tallas[e.key]).toUpperCase(); });
  return fila;
};
