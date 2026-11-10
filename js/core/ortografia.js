// =====================================================================
// ORTOGRAFÍA · corrige errores de tipeo y tildes frecuentes en textos del Historial
// (sale del "Diccionario técnico de intervenciones FRC" → sección Abreviaciones y errores de tipeo).
// Solo cambia lo que se MUESTRA o se EXPORTA: lo guardado en la base de datos no se toca.
// Respeta MAYÚSCULAS / Mayúscula inicial / minúsculas de cada palabra.
// =====================================================================

// Errores de tipeo encontrados en el Historial → forma correcta
const TIPEO = {
  EXTIINTORES: 'EXTINTORES', ETINTOR: 'EXTINTOR', EXTINTORY: 'EXTINTOR Y', VISAGRA: 'BISAGRA', VISAGRAS: 'BISAGRAS',
  RALIZA: 'REALIZA', RALIZAN: 'REALIZAN', REGRIGERANTE: 'REFRIGERANTE', REFIGERANTE: 'REFRIGERANTE', COOLANR: 'COOLANT',
  MODILO: 'MÓDULO', DIESE: 'DIÉSEL', MANGERA: 'MANGUERA', MANGERAS: 'MANGUERAS', ILUMUNACION: 'ILUMINACIÓN', DARUNA: 'DAR UNA',
  TEMEPRATURA: 'TEMPERATURA', TEMPERATIRA: 'TEMPERATURA', IINSPECCION: 'INSPECCIÓN', INPSECCION: 'INSPECCIÓN', REVVISION: 'REVISIÓN',
  READIADOR: 'RADIADOR', HIDDRAULICO: 'HIDRÁULICO', HIDDRAULICA: 'HIDRÁULICA', OCMBUSTIBLE: 'COMBUSTIBLE', ARRAQUE: 'ARRANQUE',
  ACOCPLE: 'ACOPLE', DIRECCIION: 'DIRECCIÓN', CONEXIADO: 'CONEXIONADO', GEERADOR: 'GENERADOR', MANTECION: 'MANTENCIÓN',
  REPRACION: 'REPARACIÓN', BATERIAAS: 'BATERÍAS', BATERIAY: 'BATERÍA Y', FUSIBLEY: 'FUSIBLE Y', PROBELMAS: 'PROBLEMAS',
  CONDIICONES: 'CONDICIONES', LLANTASCON: 'LLANTAS CON', RELEES: 'RELÉS'
};

// Palabras técnicas frecuentes escritas sin tilde (solo las que no cambian de significado)
const TILDES = [
  'BATERÍA', 'BATERÍAS', 'HIDRÁULICO', 'HIDRÁULICA', 'HIDRÁULICOS', 'HIDRÁULICAS', 'MANTENCIÓN', 'REVISIÓN', 'INSPECCIÓN', 'REPARACIÓN',
  'OPERACIÓN', 'ATENCIÓN', 'DIRECCIÓN', 'CONEXIÓN', 'INSTALACIÓN', 'VERIFICACIÓN', 'ILUMINACIÓN', 'CALIBRACIÓN', 'LUBRICACIÓN',
  'ESTANDARIZACIÓN', 'IMPLEMENTACIÓN', 'DESCRIPCIÓN', 'COMBUSTIÓN', 'POSICIÓN', 'SOLUCIÓN', 'GENERACIÓN', 'DETENCIÓN', 'MEDICIÓN',
  'VÁLVULA', 'VÁLVULAS', 'MÓDULO', 'MÓDULOS', 'CAMIÓN', 'PETRÓLEO', 'NEUMÁTICO', 'NEUMÁTICOS', 'ELÉCTRICO', 'ELÉCTRICA',
  'ELÉCTRICOS', 'ELÉCTRICAS', 'ELECTRÓNICO', 'ELECTRÓNICA', 'MECÁNICO', 'MECÁNICA', 'MECÁNICOS', 'TÉCNICO', 'TÉCNICA', 'DIÉSEL',
  'CÁRTER', 'CIGÜEÑAL', 'MÁSTIL', 'PRESIÓN', 'MÁQUINA', 'TÉRMICO', 'AUTOMÁTICO', 'AUTOMÁTICA', 'DÍAS', 'TAMBIÉN', 'BOMBÍN',
  'ROTACIÓN', 'TENSIÓN', 'FUNCIÓN', 'LÍNEA', 'LÍNEAS', 'PLÁSTICO', 'GOMÍN', 'GOMINES'
];
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const DICC = { ...Object.fromEntries(TILDES.map(w => [sinTildes(w), w])), ...TIPEO };

const conMayusculas = (original, nueva) => {
  if (original === original.toUpperCase()) return nueva.toUpperCase();
  const minus = nueva.toLowerCase();
  return original[0] === original[0].toUpperCase() ? minus.charAt(0).toUpperCase() + minus.slice(1) : minus;
};

/** Texto corregido (para mostrar o exportar). */
export const corregirTexto = (texto) => {
  if (!texto || typeof texto !== 'string') return texto;
  let t = texto.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g, (w) => {
    const k = sinTildes(w);
    if (k.length < 3 || !DICC[k]) return w;
    // ya está bien escrita (con su tilde) → no se toca
    if (w.toUpperCase() === DICC[k]) return w;
    return conMayusculas(w, DICC[k]);
  });
  t = t.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').replace(/([,;:])(?=[^\s\d])/g, '$1 ').replace(/([a-záéíóúñ]{2})\.(?=[A-Za-zÁÉÍÓÚÑáéíóúñ]{2})/gi, '$1. ').trim();
  // Si está escrito en minúsculas, cada oración parte con mayúscula
  if (t !== t.toUpperCase()) t = t.replace(/(^|[.!?]\s+|\n\s*)([a-záéíóúñ])/g, (m, a, b) => a + b.toUpperCase());
  return t;
};
