// =====================================================================
// VEHÍCULOS · Constantes y conversión de filas Supabase → objetos de la app
// ---------------------------------------------------------------------
// Un VEHÍCULO es un registro de BD_INVENTARIO cuyo AFI es una PATENTE "XXXX-XX"
// (ver esVehiculo en inventario/inventario.mapper.js). Sus datos propios van en:
//   bd_vehiculos             → N° AFI interno, frecuencia de mantención en km, aviso por defecto
//   bd_vehiculos_km          → lecturas de kilometraje (LECTURA o MANTENCION)
//   bd_vehiculos_documentos  → documentos principales (RT, Permiso, SOAP) y secundarios, con vencimiento
// =====================================================================
import { TABLAS } from '../../core/tablas.js';

export const TABLA_VEHICULOS = TABLAS.VEHICULOS;
export const TABLA_VEH_KM = TABLAS.VEHICULOS_KM;
export const TABLA_VEH_DOCS = TABLAS.VEHICULOS_DOCS;

/** Frecuencia de mantención por defecto (km) y aviso "PRÓXIMO" (km antes de la meta). */
export const FRECUENCIA_KM_DEFAULT = 10000;
export const UMBRAL_KM_PROXIMO = 1000;
/** Uso por defecto cuando no hay lecturas suficientes para calcularlo (km/día). */
export const USO_KM_DIA_DEFAULT = 80;
/** Días antes del vencimiento en que un documento empieza a avisar. */
export const DIAS_AVISO_DEFAULT = 30;

/** Documentos principales del perfil (duración por defecto en meses; se puede cambiar en cada documento). */
export const DOCS_PRINCIPALES = [
  { key: 'REVISION_TECNICA', label: 'Revisión Técnica', corto: 'RT', icon: 'fa-clipboard-check', duracionMeses: 12 },
  { key: 'PERMISO_CIRCULACION', label: 'Permiso de Circulación', corto: 'PC', icon: 'fa-id-card', duracionMeses: 12 },
  { key: 'SOAP', label: 'SOAP', corto: 'SOAP', icon: 'fa-shield-halved', duracionMeses: 12 }
];
export const docPrincipal = (key) => DOCS_PRINCIPALES.find(d => d.key === key) || null;

/** Documentos secundarios sugeridos (se puede escribir cualquier otro nombre). */
export const DOCS_SECUNDARIOS_SUGERIDOS = [
  'Padrón / Certificado de inscripción', 'Revisión de gases', 'Seguro particular', 'Certificado GPS',
  'Certificado de extintor', 'Acreditación faena', 'Certificación de grúa / pluma', 'Tacógrafo', 'Factura de compra'
];

export const UNIDADES_DURACION = [
  { key: 'DIAS', label: 'días' },
  { key: 'MESES', label: 'meses' },
  { key: 'ANIOS', label: 'años' }
];

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const fecha = (v) => (v ? String(v).slice(0, 10) : '');
const up = (v) => String(v || '').trim().toUpperCase();

export const mapVehiculo = (r) => ({
  id: r.id,
  patente: up(r.patente),
  numeroAfi: String(r.numero_afi || '').trim(),
  frecuenciaKm: Number(r.frecuencia_km) || FRECUENCIA_KM_DEFAULT,
  diasAviso: Number(r.dias_aviso) || DIAS_AVISO_DEFAULT,
  observacion: String(r.observacion || '')
});

export const mapLecturaKm = (r) => ({
  id: r.id,
  patente: up(r.patente),
  fecha: fecha(r.fecha),
  km: Number(r.km) || 0,
  tipo: up(r.tipo) === 'MANTENCION' ? 'MANTENCION' : 'LECTURA',
  observacion: String(r.observacion || ''),
  creadoPor: String(r.creado_por || ''),
  createdAt: r.created_at || ''
});

export const mapDocumento = (r) => ({
  id: r.id,
  patente: up(r.patente),
  categoria: up(r.categoria) === 'PRINCIPAL' ? 'PRINCIPAL' : 'SECUNDARIO',
  clave: r.clave ? up(r.clave) : '',
  nombre: String(r.nombre || ''),
  numero: String(r.numero || ''),
  fechaEmision: fecha(r.fecha_emision),
  duracion: num(r.duracion),
  unidad: ['DIAS', 'MESES', 'ANIOS'].includes(up(r.unidad)) ? up(r.unidad) : 'MESES',
  fechaVencimiento: fecha(r.fecha_vencimiento),
  diasAviso: Number(r.dias_aviso) || DIAS_AVISO_DEFAULT,
  link: String(r.link || ''),
  nombreArchivo: String(r.nombre_archivo || ''),
  observacion: String(r.observacion || ''),
  creadoPor: String(r.creado_por || ''),
  createdAt: r.created_at || ''
});
