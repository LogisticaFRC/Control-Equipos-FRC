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
  { key: 'ELECTRICO', label: 'Eléctrico / control', color: '#eab308', icon: 'fa-bolt',
    // incluye el MÓDULO / CONTROLADOR / PANEL (electrónica de control de cualquier equipo)
    kw: ['PANEL DE CONTROL', 'CONTROLADOR', 'MODULO', 'MODILO', 'DEEP SEA', 'DSE', 'COMAP', 'DISPLAY', 'PANTALLA', 'BATERIA', 'ALTERNADOR', 'CORTA CORRIENTE', 'CORTACORRIENTE', 'BOCINA', 'BALIZA', 'MOTOR DE PARTIDA', 'MOTOR PARTIDA', 'PARTIDA', 'ARRANQUE', 'ELECTRIC', 'CABLE', 'CABLEADO', 'FUSIBLE', 'RELE', 'CORTOCIRCUITO', 'CORTO CIRCUITO', 'SENSOR', 'CONTACTOR', 'BORNE', 'SOLENOIDE', 'TERMINAL', 'CARGADOR', 'CONEXION', 'ENCHUFE', 'SWITCH', 'LLAVE DE CONTACTO', 'TIERRA'] },
  { key: 'GENERACION', label: 'Generación (AVR, voltaje, breaker)', color: '#f97316', icon: 'fa-plug-circle-bolt',
    kw: ['AVR', 'REGULADOR DE VOLTAJE', 'VOLTAJE', 'FRECUENCIA', 'BREAKER', 'DISYUNTOR', 'EXCITATRIZ', 'ALIMENTADOR', 'COOPER', 'BOBINA', 'ESTATOR', 'ROTOR', 'BANCO DE PRUEBA', 'BANCO DE CARGA', 'BANCO', 'TRANSFERENCIA', 'ATS', 'KVA', 'AMPER'] },
  { key: 'MOTOR', label: 'Motor', color: '#dc2626', icon: 'fa-gear',
    kw: ['MOTOR', 'CULATA', 'INYECTOR', 'TURBO', 'EMPAQUETADURA', 'JUNTA', 'PISTON', 'VALVULA', 'COMPRESION', 'CIGUENAL', 'ARBOL DE LEVAS', 'HUMO', 'POTENCIA', 'CORREA', 'POLEA', 'TAPA DE VALVULA', 'CARTER', 'ESCAPE', 'SILENCIADOR', 'ADMISION', 'MULTIPLE', 'GOBERNADOR', 'RPM'] },
  { key: 'COMBUSTIBLE', label: 'Combustible', color: '#a16207', icon: 'fa-gas-pump',
    kw: ['COMBUSTIBLE', 'OCMBUSTIBLE', 'PETROLEO', 'DIESEL', 'DECANTADOR', 'BOMBA INYECTORA', 'ESTANQUE', 'TANQUE', 'SEPARADOR', 'PURGA', 'PURGAR', 'CEBAR', 'AIRE EN EL SISTEMA', 'BOMBA DE ALIMENTACION', 'FLOTADOR'] },
  { key: 'REFRIGERACION', label: 'Refrigeración', color: '#0ea5e9', icon: 'fa-temperature-arrow-down',
    kw: ['RADIADOR', 'READIADOR', 'REFRIGERANTE', 'REGRIGERANTE', 'REFIGERANTE', 'COOLAN', 'ENFRIADOR', 'TEMPERATURA', 'SOBRECALENT', 'RECALENT', 'VENTILADOR', 'TERMOSTATO', 'BOMBA DE AGUA', 'ASPA', 'ANTICONGELANTE', 'AGUA', 'ENFRIAMIENTO'] },
  { key: 'HIDRAULICO', label: 'Hidráulico', color: '#7c3aed', icon: 'fa-droplet',
    kw: ['HIDRAULIC', 'HIDDRAULIC', 'MANGUERA', 'MANGERA', 'MANIFOLD', 'CILINDRO', 'SELLO', 'RETEN', 'ORING', 'O RING', 'BOMBA HIDRAULICA', 'GATO', 'FLEXIBLE', 'ACOPLE', 'FUGA', 'FILTRACION', 'PERDIDA DE ACEITE'] },
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
  'MANTENCION SERVICIO INSTALACION INSTALAR COLOCA COLOCAR DEJA DEJAR QUEDA OPERATIVO PREVENTIVA PREVENTIVO PREDICTIVA PREDICTIVO CORRECTIVA CORRECTIVO ' +
  'HRS HORAS GENERAL VARIOS VARIAS INTERMEDIA').split(/\s+/));

/** Cuenta palabras clave que aparecen al INICIO de una palabra ("ELECTRIC" calza con "ELECTRICO");
 *  las de 3 letras o menos (AVR, LED, EJE…) deben ser la palabra completa. */
const contar = (txt, kw) => {
  let n = 0;
  kw.forEach(k => {
    const ok = k.endsWith('$') ? txt.includes(` ${k.slice(0, -1)} `) : (k.length <= 3 ? txt.includes(` ${k} `) : txt.includes(` ${k}`));
    if (ok) n += k.includes(' ') ? 2 : 1;
  });
  return n;
};

// ---------------------------------------------------------------------
// PIEZA (qué componente falló) y MOTIVO (por qué falló)
// kw: se buscan al inicio de una palabra; con "$" al final = palabra exacta.
// generico: true → se descarta si se detecta otra pieza más específica del mismo grupo.
// ---------------------------------------------------------------------
export const PIEZAS = [
  // Eléctrico
  { key: 'BATERIA', label: 'Batería', grupo: 'ELECTRICO', kw: ['BATERIA'] },
  { key: 'MOTOR_PARTIDA', label: 'Motor de partida', grupo: 'ELECTRICO', kw: ['MOTOR DE PARTIDA', 'MOTOR PARTIDA', 'MOTOR DE ARRANQUE', 'MOTOR DE ARRAQUE', 'ARRANCADOR'] },
  { key: 'CORTA_CORRIENTE', label: 'Corta corriente', grupo: 'ELECTRICO', kw: ['CORTA CORRIENTE', 'CORTACORRIENTE'] },
  { key: 'BOCINA', label: 'Bocina / alarma de retroceso / baliza', grupo: 'ELECTRICO', kw: ['BOCINA', 'ALARMA DE RETROCESO', 'ALARMA RETROCESO', 'BALIZA'] },
  { key: 'ALTERNADOR', label: 'Alternador', grupo: 'ELECTRICO', kw: ['ALTERNADOR'] },
  { key: 'CABLEADO', label: 'Cableado / conexiones', grupo: 'ELECTRICO', kw: ['CABLE', 'CABLEADO', 'CONEXIONADO', 'CONEXIADO', 'CONEXION', 'TERMINAL', 'BORNE', 'ENCHUFE', 'MASA$', 'ATERRIZAJE'] },
  { key: 'FUSIBLE_RELE', label: 'Fusible / relé', grupo: 'ELECTRICO', kw: ['FUSIBLE', 'RELE$', 'RELES$', 'RELAY'] },
  { key: 'SENSOR', label: 'Sensor', grupo: 'ELECTRICO', kw: ['SENSOR', 'BULBO', 'SENSORES'] },
  { key: 'SOLENOIDE', label: 'Solenoide', grupo: 'ELECTRICO', kw: ['SOLENOIDE'] },
  { key: 'LLAVE_CONTACTO', label: 'Llave de contacto / switch', grupo: 'ELECTRICO', kw: ['LLAVE DE CONTACTO', 'CHAPA DE CONTACTO', 'SWITCH', 'INTERRUPTOR'] },
  // Generación / panel
  { key: 'AVR', label: 'AVR / regulador de voltaje', grupo: 'GENERACION', kw: ['AVR$', 'REGULADOR DE VOLTAJE', 'REGULADOR'] },
  { key: 'CONTROLADOR', label: 'Controlador / módulo', grupo: 'ELECTRICO', kw: ['CONTROLADOR', 'MODULO', 'MODILO', 'DEEP SEA', 'DSE$', 'COMAP', 'PANEL DE CONTROL', 'PANTALLA', 'DISPLAY'] },
  { key: 'ALIMENTADORES', label: 'Alimentadores / barra Cooper', grupo: 'GENERACION', kw: ['ALIMENTADOR', 'BARRA COOPER', 'COOPER'] },
  { key: 'BREAKER', label: 'Breaker / disyuntor', grupo: 'GENERACION', kw: ['BREAKER', 'DISYUNTOR', 'TERMOMAGNETIC'] },
  { key: 'TRANSFERENCIA', label: 'Transferencia (ATS)', grupo: 'GENERACION', kw: ['TRANSFERENCIA', 'ATS$'] },
  { key: 'EXCITATRIZ', label: 'Excitatriz / bobinado', grupo: 'GENERACION', kw: ['EXCITATRIZ', 'BOBINA', 'BOBINADO', 'ESTATOR', 'ROTOR', 'DIODO', 'PUENTE RECTIFICADOR'] },
  // Motor
  { key: 'CORREA', label: 'Correa', grupo: 'MOTOR', kw: ['CORREA'] },
  { key: 'POLEA_TENSOR', label: 'Polea / tensor', grupo: 'MOTOR', kw: ['POLEA', 'TENSOR'] },
  { key: 'INYECTOR', label: 'Inyector', grupo: 'MOTOR', kw: ['INYECTOR'] },
  { key: 'TURBO', label: 'Turbo', grupo: 'MOTOR', kw: ['TURBO'] },
  { key: 'CULATA', label: 'Culata / empaquetadura', grupo: 'MOTOR', kw: ['CULATA', 'EMPAQUETADURA', 'JUNTA'] },
  { key: 'RETEN_CIGUENAL', label: 'Retén de cigüeñal / cárter', grupo: 'MOTOR', kw: ['CIGUENAL', 'CARTER'] },
  { key: 'ESCAPE', label: 'Escape / silenciador', grupo: 'MOTOR', kw: ['ESCAPE', 'SILENCIADOR', 'MULTIPLE'] },
  { key: 'BOMBA_ACEITE', label: 'Bomba de aceite', grupo: 'MOTOR', kw: ['BOMBA DE ACEITE'] },
  // Combustible
  { key: 'BOMBA_INYECTORA', label: 'Bomba inyectora', grupo: 'COMBUSTIBLE', kw: ['BOMBA INYECTORA', 'BOMBA DE INYECCION'] },
  { key: 'BOMBA_COMB', label: 'Bomba de combustible', grupo: 'COMBUSTIBLE', kw: ['BOMBA DE COMBUSTIBLE', 'BOMBA COMBUSTIBLE', 'BOMBA DE ALIMENTACION', 'BOMBA DE TRASPASO', 'BOMBA DE CEBADO'] },
  { key: 'ESTANQUE', label: 'Estanque / tanque', grupo: 'COMBUSTIBLE', kw: ['ESTANQUE', 'TANQUE', 'FLOTADOR'] },
  { key: 'SEPARADOR', label: 'Separador de agua', grupo: 'COMBUSTIBLE', kw: ['SEPARADOR'] },
  // Refrigeración
  { key: 'RADIADOR', label: 'Radiador', grupo: 'REFRIGERACION', kw: ['RADIADOR', 'READIADOR'] },
  { key: 'ENFRIADOR', label: 'Enfriador de aceite', grupo: 'REFRIGERACION', kw: ['ENFRIADOR'] },
  { key: 'BOMBA_AGUA', label: 'Bomba de agua', grupo: 'REFRIGERACION', kw: ['BOMBA DE AGUA', 'BOMBA AGUA'] },
  { key: 'TERMOSTATO', label: 'Termostato', grupo: 'REFRIGERACION', kw: ['TERMOSTATO'] },
  { key: 'VENTILADOR', label: 'Ventilador / aspa', grupo: 'REFRIGERACION', kw: ['VENTILADOR', 'ASPA'] },
  // Hidráulico
  { key: 'MANGUERA', label: 'Manguera / flexible', grupo: 'HIDRAULICO', kw: ['MANGUERA', 'MANGERA', 'FLEXIBLE'] },
  { key: 'MANIFOLD', label: 'Manifold / válvulas', grupo: 'HIDRAULICO', kw: ['MANIFOLD', 'VALVULA'] },
  { key: 'CILINDRO', label: 'Cilindro / gato', grupo: 'HIDRAULICO', kw: ['CILINDRO', 'GATO'] },
  { key: 'SELLO', label: 'Sello / retén / o-ring', grupo: 'HIDRAULICO', kw: ['SELLO', 'RETEN', 'ORING', 'O RING'] },
  { key: 'BOMBA_HIDR', label: 'Bomba hidráulica', grupo: 'HIDRAULICO', kw: ['BOMBA HIDRAULICA'] },
  { key: 'ACOPLE', label: 'Acople (macho / hembra)', grupo: 'HIDRAULICO', kw: ['ACOPLE', 'ACOCPLE'] },
  // Filtros
  { key: 'FILTRO_AIRE', label: 'Filtro de aire', grupo: 'LUBRICACION', kw: ['FILTRO DE AIRE', 'FILTRO AIRE', 'FILTROS DE AIRE', 'FILTROS AIRE'] },
  { key: 'FILTRO_COMB', label: 'Filtro de combustible / decantador', grupo: 'LUBRICACION', kw: ['FILTRO DE COMBUSTIBLE', 'FILTRO COMBUSTIBLE', 'FILTRO DE PETROLEO', 'FILTRO PETROLEO', 'DECANTADOR'] },
  { key: 'FILTRO_ACEITE', label: 'Filtro de aceite', grupo: 'LUBRICACION', kw: ['FILTRO DE ACEITE', 'FILTRO ACEITE'] },
  { key: 'FILTRO', label: 'Filtro (otro)', grupo: 'LUBRICACION', kw: ['FILTRO'], generico: true },
  // Rodado
  { key: 'NEUMATICO', label: 'Neumático / rueda', grupo: 'TREN', kw: ['NEUMATICO', 'RUEDA', 'LLANTA', 'PINCHAZO', 'CAMARA'] },
  { key: 'RODAMIENTO', label: 'Rodamiento / eje / maza', grupo: 'TREN', kw: ['RODAMIENTO', 'EJE$', 'MAZA'] },
  { key: 'ESTABILIZADOR', label: 'Patas estabilizadoras', grupo: 'TREN', kw: ['ESTABILIZADOR', 'PATA ESTABILIZ', 'PATAS ESTABILIZ'] },
  { key: 'PASADOR', label: 'Pasadores / pernos', grupo: 'TREN', kw: ['PASADOR', 'PERNO'] },
  { key: 'FRENO', label: 'Frenos', grupo: 'TREN', kw: ['FRENO', 'PASTILLA', 'BALATA'] },
  // Estructura
  { key: 'PUERTA', label: 'Puerta / chapa / bisagra', grupo: 'ESTRUCTURA', kw: ['PUERTA', 'CHAPA$', 'BISAGRA', 'VISAGRA', 'CERRADURA', 'CANDADO'] },
  { key: 'PARABRISAS', label: 'Parabrisas / limpiaparabrisas', grupo: 'ESTRUCTURA', kw: ['PARABRISAS', 'LIMPIAPARABRISAS', 'VIDRIO'] },
  { key: 'LANZA', label: 'Lanza / enganche', grupo: 'ESTRUCTURA', kw: ['LANZA', 'ENGANCHE', 'TIRO$'] },
  { key: 'CARCASA', label: 'Carcasa / gabinete', grupo: 'ESTRUCTURA', kw: ['CARCASA', 'GABINETE', 'CANOPY', 'CABINA'] },
  // Iluminación / torre
  { key: 'AMPOLLETA', label: 'Ampolleta / foco / luminaria', grupo: 'ILUMINACION', kw: ['AMPOLLETA', 'FOCO', 'LUMINARIA', 'LAMPARA', 'REFLECTOR', 'LED$', 'HALURO'] },
  { key: 'BALASTRO', label: 'Balastro', grupo: 'ILUMINACION', kw: ['BALASTRO'] },
  { key: 'MASTIL', label: 'Mástil / piola / trinquete', grupo: 'ILUMINACION', kw: ['MASTIL', 'WINCHE', 'HUINCHE', 'CABLE DE ACERO', 'PIOLA', 'TRINQUETE'] }
];

export const MOTIVOS = [
  { key: 'ROTURA', label: 'Rotura / corte', kw: ['ROTA$', 'ROTO$', 'ROTAS$', 'ROTOS$', 'ROTURA', 'RUPTURA', 'FATIGA DE MATERIAL', 'ROMP', 'CORTE DE', 'CORTA$', 'QUEBRAD', 'CORTAD', 'TRIZAD', 'FISUR', 'PARTIDA EN', 'REVENTAD', 'DANAD', 'MALA$', 'MALO$', 'DEFECTUOS'] },
  { key: 'DESGASTE', label: 'Desgaste / mal estado', kw: ['MAL ESTADO', 'DESGAST', 'GASTAD', 'CRISTALIZ', 'AGRIETAD', 'RESECA', 'VIDA UTIL', 'FATIGA'] },
  { key: 'FUGA', label: 'Fuga / pérdida', kw: ['FUGA', 'FILTRA$', 'FILTRACION', 'GOTEA', 'GOTEO', 'PIERDE', 'PERDIDA DE', 'DERRAM', 'BOTA ACEITE', 'BOTA AGUA'] },
  { key: 'SUELTO', label: 'Suelto / mal tensado', kw: ['SUELT', 'FLOJ', 'DESAJUST', 'DESTENSAD', 'TENSAR', 'TENSADO', 'REAPRIET', 'DESCONECTAD', 'SALIDA DE'] },
  { key: 'QUEMADO', label: 'Quemado / cortocircuito', kw: ['QUEMAD', 'FUNDID', 'CORTOCIRC', 'CORTO CIRC', 'CHISPORROT', 'SOBRECARGA'] },
  { key: 'DESCARGA', label: 'Descargado / sin carga', kw: ['DESCARGAD', 'SIN CARGA', 'NO CARGA', 'BAJO VOLTAJE', 'SULFAT', 'AGOTAD'] },
  { key: 'OBSTRUCCION', label: 'Tapado / saturado / sucio', kw: ['SATURAD', 'SATURACION', 'TAPAD', 'OBSTRU', 'SUCI', 'BARRO', 'POLVO', 'CONTAMIN', 'AGUA EN', 'BARRA$', 'CARBON'] },
  { key: 'TEMPERATURA', label: 'Sobrecalentamiento', kw: ['SOBRECALENT', 'RECALENT', 'ALTA TEMPERATURA', 'TEMPERATURA ALTA', 'EXCESO DE TEMPERATURA'] },
  { key: 'GOLPE', label: 'Golpe / mal uso / accidente', kw: ['GOLPE', 'CHOQUE', 'IMPACTO', 'ACCIDENT', 'MAL USO', 'MALA OPERACION', 'VANDAL', 'TERCEROS'] },
  { key: 'ROBO', label: 'Robo', kw: ['ROBO$', 'ROBAD', 'HURTO', 'SUSTRA'] },
  { key: 'FALTA_MANT', label: 'Falta de nivel / mantención', kw: ['FALTA DE MANTENC', 'SIN MANTENC', 'FALTA DE ACEITE', 'FALTA DE AGUA', 'FALTA DE REFRIGERANTE', 'BAJO NIVEL', 'NIVEL BAJO', 'SIN ACEITE', 'SIN AGUA', 'SIN REFRIGERANTE', 'SIN COMBUSTIBLE', 'FALTA DE COMBUSTIBLE', 'RELLENA', 'RELLENO', 'COMPLETA NIVEL', 'SE AGREGA ACEITE', 'SE AGREGA REFRIGERANTE'] },
  { key: 'AJUSTE', label: 'Desconfiguración / lectura errónea', kw: ['DESCONFIGUR', 'CONFIGURA', 'PROGRAMA', 'CALIBRA', 'AJUSTE', 'PARAMETR', 'LECTURAS ERRONEA', 'LECTURA ERRONEA', 'ERRONEA', 'MARCA MAL', 'NO MARCA', 'LECTURA INCORRECTA'] }
];
export const MOTIVO_NO_INDICADO = { key: 'SIN_MOTIVO', label: 'Motivo no indicado' };

/** SÍNTOMAS = señales de alerta (lo que se ve cuando el equipo falla). */
export const SINTOMAS = [
  { key: 'FUERA_SERVICIO', label: 'Quedó fuera de servicio', kw: ['FUERA DE SERVICIO', 'DETENIDO', 'DETENCION', 'INOPERATIVO', 'INOPERABLE', 'EQUIPO PARADO', 'SE DETIENE EL EQUIPO'] },
  { key: 'NO_PARTE', label: 'No parte / no arranca', kw: ['NO PARTE', 'NO ARRANCA', 'NO ENCIENDE', 'NO DA ARRANQUE', 'NO PRENDE', 'NO HACE CONTACTO'] },
  { key: 'SE_APAGA', label: 'Se apaga / se detiene', kw: ['SE APAGA', 'SE DETIENE', 'SE CORTA', 'SE PARA', 'SE DESCONECTA'] },
  { key: 'NO_GENERA', label: 'No genera / sin energía', kw: ['NO GENERA', 'SIN VOLTAJE', 'SIN ENERGIA', 'NO ENTREGA', 'SIN SALIDA', 'NO DA CORRIENTE', 'SIN TENSION'] },
  { key: 'ALARMA', label: 'Alarma / código de falla', kw: ['ALARMA', 'CODIGO DE FALLA', 'CODIGO', 'TESTIGO', 'SHUTDOWN', 'WARNING'] },
  { key: 'RUIDO', label: 'Ruido / vibración', kw: ['RUIDO', 'GOLPETEO', 'VIBRA', 'CASCABELEO', 'CHIRRIDO'] },
  { key: 'HUMO', label: 'Humo / olor a quemado', kw: ['HUMO', 'OLOR A QUEMADO', 'HUMEA'] },
  { key: 'POTENCIA', label: 'Pierde potencia / no acelera', kw: ['PIERDE POTENCIA', 'PERDIDA DE POTENCIA', 'NO ACELERA', 'NO SUBE', 'BAJA DE REVOLUCIONES', 'INESTABLE', 'OSCILA'] },
  { key: 'TEMPERATURA', label: 'Alta temperatura', kw: ['SOBRECALENT', 'RECALENT', 'ALTA TEMPERATURA', 'TEMPERATURA ALTA', 'ALTA TEMEPRATURA', 'ALTA TEMPERATIRA'] },
  { key: 'PRESION', label: 'Baja presión', kw: ['BAJA PRESION', 'PRESION DE ACEITE', 'SIN PRESION'] }
];
/** Señales de alerta de un registro (keys de SINTOMAS). */
export const detectarSintomas = (r) => {
  const t = ` ${sinTildes(r.causa)} ${sinTildes(r.causaDetallada)} ${sinTildes(r.descripcion)} `.replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ');
  return SINTOMAS.filter(x => x.kw.some(k => t.includes(` ${k}`))).map(x => x.key);
};
export const sintomaPorKey = (k) => SINTOMAS.find(x => x.key === k) || null;
export const piezaPorKey = (k) => PIEZAS.find(p => p.key === k) || null;
export const motivoPorKey = (k) => MOTIVOS.find(m => m.key === k) || MOTIVO_NO_INDICADO;

/** ¿El texto (con espacios al inicio/fin) tiene la palabra clave? "$" al final = palabra exacta. */
const tiene = (txt, k) => k.endsWith('$') ? txt.includes(` ${k.slice(0, -1)} `) : (k.length <= 3 ? txt.includes(` ${k} `) : txt.includes(` ${k}`));
const limpio = (s) => ` ${s} `.replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ');
/**
 * Descripción SIN las revisiones y pruebas de rutina: "se revisa temperatura, nivel de combustible",
 * "se realizan pruebas quedando presión 10 bar"… Esas frases dicen qué se controló, no qué falló,
 * así que no deben contar para el sistema, la pieza ni el motivo.
 */
const RE_RUTINA = /^(Y\s+)?(SE\s+)?(REVIS|VERIFIC|CHEQUE|INSPECCION|CONTROLA|MIDE|MIDIO|MIDEN|MEDICION|REALIZA(N)?\s+PRUEBA|PRUEBA|QUEDANDO|QUEDA\s+OPERATIV|QUEDA\s+FUNCIONANDO|ENTREGA|LIMPIEZA\s+DE\s+AREA|ORDEN\s+Y\s+ASEO)/;
const RE_FALLA = /\b(BAJO|FALTA|SIN|VACIO|PERDIDA|FUGA|ROT|DANAD|MAL|FALLA|NO\s+(PARTE|FUNCIONA|ENCIENDE|GENERA|CARGA))/;
export const descripcionSinRutina = (desc) => sinTildes(desc)
  .split(/[.;,\n]|\s+Y\s+SE\s+|\s+LUEGO\s+/)
  .map(x => x.trim())
  .filter(x => x && !(RE_RUTINA.test(x) && !RE_FALLA.test(x)) && !(/^NIVEL(ES)?\s+DE/.test(x) && !RE_FALLA.test(x)))
  .join('. ');

/** Texto para pieza/motivo: causa detallada + descripción sin rutina (sin la causa general). */
const textoDetalle = (r) => limpio(`${sinTildes(r.causaDetallada)} ${descripcionSinRutina(r.descripcion)}`);

/** Piezas mencionadas en un registro (keys). */
export const detectarPiezas = (r) => {
  const t = textoDetalle(r);
  let ps = PIEZAS.filter(p => p.kw.some(k => tiene(t, k)));
  // "Motor de partida" no es "Motor"; los genéricos se quitan si hay uno específico del mismo grupo
  ps = ps.filter(p => !p.generico || !ps.some(o => o !== p && o.grupo === p.grupo && !o.generico));
  return ps.map(p => p.key);
};
/** Motivo principal (por qué falló). */
export const detectarMotivo = (r) => {
  const t = textoDetalle(r) + ' ' + sinTildes(r.causa) + ' ';
  return (MOTIVOS.find(m => m.kw.some(k => tiene(t, k))) || MOTIVO_NO_INDICADO).key;
};
/** Texto corto "Correa · rotura / corte" para mostrar en tablas. */
export const piezaMotivoTexto = (r) => {
  const ps = detectarPiezas(r).map(k => piezaPorKey(k)?.label).filter(Boolean);
  const m = detectarMotivo(r);
  return (ps.length ? ps.join(', ') : 'Pieza no indicada') + ' · ' + (m === 'SIN_MOTIVO' ? 'motivo no indicado' : motivoPorKey(m).label.toLowerCase());
};

/** Texto que se analiza de un registro (todo junto, para "MOTOR DE PARTIDA" y similares). */
const textoDe = (r) => limpio(`${sinTildes(r.causa)} ${sinTildes(r.causaDetallada)} ${descripcionSinRutina(r.descripcion)}`);

/** Sistema principal de un registro: { key, label, color, puntaje, otras:[keys] }. */
/** Registro que NO es una falla: mantención (completa o intermedia) o trabajo PREVENTIVO / PREDICTIVO. */
// Causas administrativas / de rutina que no son fallas (estandarización, implementación, check list…)
const CAUSAS_NO_FALLA = /^(ESTANDARIZACION|IMPLEMENTACION|CHECK ?LIST|ACTIVIDAD|PUESTA EN MARCHA)/;
export const esNoFalla = (r) => Boolean(claseMantencion(r)) || /PREVENTIV|PREDICTIV/.test(sinTildes(`${r.tipoMant} ${r.causa} ${r.causaDetallada}`))
  || CAUSAS_NO_FALLA.test(sinTildes(r.causa).trim());

export const categorizar = (r) => {
  // La CAUSA DETALLADA (qué falló) pesa x3; la descripción (qué se hizo, sin revisiones de rutina) x1
  const t = textoDe(r);
  const tCausa = limpio(sinTildes(r.causa)), tDet = limpio(sinTildes(r.causaDetallada)), tDesc = limpio(descripcionSinRutina(r.descripcion));
  const puntos = CATEGORIAS_FALLA.map(c => ({ c, n: contar(tCausa, c.kw) + 3 * contar(tDet, c.kw) + contar(tDesc, c.kw) })).filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n);
  // "MOTOR DE PARTIDA" es eléctrico: no sumar a MOTOR
  if (t.includes('MOTOR DE PARTIDA') || t.includes('MOTOR PARTIDA')) {
    const m = puntos.find(x => x.c.key === 'MOTOR'); if (m) m.n -= 6;
    puntos.sort((a, b) => b.n - a.n);
  }
  const top = puntos.filter(x => x.n > 0);
  if (!top.length) return { ...CATEGORIA_OTROS, puntaje: 0, otras: [] };
  return { ...top[0].c, puntaje: top[0].n, otras: top.slice(1, 3).map(x => x.c.key) };
};

/** Minutos de trabajo: "3:45", "3h 45m", "3.5", o inicio/término. null si no hay datos. */
export const minutosTrabajo = (r) => {
  const t = String(r.horaTotal || '').trim();
  const MAX = 16 * 60;   // más de 16 h en un registro = dato mal ingresado → no se cuenta
  const ok = (v) => (v > 0 && v <= MAX ? v : null);
  if (/HRS|HORAS/i.test(t) && !/:/.test(t)) return null;   // "250 HRS" es el tipo de mantención, no horas trabajadas
  let m = t.match(/^(\d{1,2})\s*[:hH]\s*(\d{1,2})?/);
  if (m) { const v = ok(Number(m[1]) * 60 + Number(m[2] || 0)); if (v) return v; }
  if (/^\d+([.,]\d+)?$/.test(t) && Number(t.replace(',', '.')) > 0) { const v = ok(Math.round(Number(t.replace(',', '.')) * 60)); if (v) return v; }
  const hm = (s) => { const x = String(s || '').match(/(\d{1,2}):(\d{2})/); return x ? Number(x[1]) * 60 + Number(x[2]) : null; };
  const a = hm(r.horaInicio), b = hm(r.horaTermino);
  if (a === null || b === null) return null;
  const d = b - a < 0 ? b - a + 1440 : b - a;
  return ok(d);
};
export const fmtMin = (min) => {
  if (!min) return '0 h';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
};

/** "Problema" normalizado para agrupar textos parecidos (primeras 6 palabras útiles de la causa detallada). */
/** Palabras de ACTIVIDAD (inspección, revisión, prueba…): describen lo que se hizo, no el problema. */
const ES_ACTIVIDAD = /^I*(INSPECC|REVISI|REVISA|CHEQUE|PRUEBA|MEDICI|CONTROL|VISITA|ATENCION|OPERADOR|PUESTA|MARCHA|LIMPIEZA|LAVADO|ASEO|APOYO|TRASLADO|ENTREGA|RETIRO|INSTALA)/;
/**
 * "Problema" para agrupar registros parecidos. Si se detecta pieza → "pieza · motivo" (ej. "Correa · rotura / corte");
 * si no, las primeras palabras útiles de la causa detallada. Inspecciones, revisiones, pruebas, limpiezas, etc. NO son problemas → ''.
 */
export const problemaDe = (r) => {
  const piezas = detectarPiezas(r), m = detectarMotivo(r), sint = detectarSintomas(r);
  const motivo = m !== 'SIN_MOTIVO' ? motivoPorKey(m).label.toLowerCase() : '';
  if (piezas.length) return (piezaPorKey(piezas[0])?.label || piezas[0]) + (motivo ? ' · ' + motivo : sint.length ? ' · ' + sintomaPorKey(sint[0]).label.toLowerCase() : '');
  // Sin pieza: el motivo o la señal de alerta (si no hay ninguna → no es un "problema": inspección, revisión, etc.)
  if (motivo) return motivo.charAt(0).toUpperCase() + motivo.slice(1);
  if (sint.length) return sintomaPorKey(sint[0]).label;
  return '';
};
/** Palabras clave de un texto (para la nube de palabras). */
const palabrasDe = (r) => sinTildes(`${r.causaDetallada} ${r.descripcion}`).replace(/[^A-Z0-9 ]+/g, ' ').split(/\s+/)
  .filter(w => w.length > 3 && !PALABRAS_VACIAS.has(w) && !/^\d+$/.test(w) && !ES_ACTIVIDAD.test(w));

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
    .filter(r => normalizarFecha(r.fecha) && (incluirMantenciones || !esNoFalla(r)))
    .map(r => {
      const cat = categorizar(r);
      const eq = eqPorAfi.get(String(r.afi).trim().toUpperCase());
      return { r, afi: String(r.afi).trim(), fecha: normalizarFecha(r.fecha), cat, min: minutosTrabajo(r),
        problema: problemaDe(r), piezas: detectarPiezas(r), motivo: detectarMotivo(r), tipoEquipo: String(eq?.tipo || r.equipo || 'SIN TIPO').trim().toUpperCase() || 'SIN TIPO', costo: Number(r.costo) || 0 };
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const total = lista.length;
  const porPieza = new Map(), porMotivo = new Map();
  const porCat = new Map(), minPorCat = new Map(), porProblema = new Map(), equiposPorProblema = new Map(), palabras = new Map(), porMes = new Map();
  const porAfi = new Map(), porTipo = new Map(), equiposPorTipo = new Map();
  let minTotal = 0, conHoras = 0, costoTotal = 0;

  lista.forEach(x => {
    incr(porCat, x.cat.key);
    if (x.min) { incr(minPorCat, x.cat.key, x.min); minTotal += x.min; conHoras++; }
    costoTotal += x.costo;
    if (x.problema && x.cat.key !== 'SERVICIO') {
      incr(porProblema, x.problema);
      if (!equiposPorProblema.has(x.problema)) equiposPorProblema.set(x.problema, new Set());
      equiposPorProblema.get(x.problema).add(x.afi);
    }
    detectarSintomas(x.r).forEach(k => incr(palabras, sintomaPorKey(k).label));
    if (x.motivo !== 'SIN_MOTIVO') incr(palabras, motivoPorKey(x.motivo).label);
    const mes = mesDe(x.fecha);
    if (!porMes.has(mes)) porMes.set(mes, new Map());
    incr(porMes.get(mes), x.cat.key);
    if (!porAfi.has(x.afi)) porAfi.set(x.afi, []);
    porAfi.get(x.afi).push(x);
    incr(porTipo, x.tipoEquipo);
    incr(porMotivo, x.motivo);
    x.piezas.forEach(k => {
      if (!porPieza.has(k)) porPieza.set(k, { n: 0, motivos: new Map(), equipos: new Set(), min: 0 });
      const pz = porPieza.get(k); pz.n++; incr(pz.motivos, x.motivo); pz.equipos.add(x.afi); pz.min += x.min || 0;
    });
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
  const piezas = Array.from(porPieza.entries()).map(([k, v]) => {
    const def = piezaPorKey(k);
    const motivos = top(v.motivos, 6).map(([mk, n]) => ({ ...motivoPorKey(mk), n }));
    const motivoTop = motivos.find(m => m.key !== 'SIN_MOTIVO') || null;
    return { key: k, label: def.label, grupo: def.grupo, cat: categoriaPorKey(def.grupo), n: v.n, motivos, motivoTop, equipos: Array.from(v.equipos), min: v.min };
  }).sort((a, b) => b.n - a.n);
  const motivos = top(porMotivo, 20).map(([k, n]) => ({ ...motivoPorKey(k), n, pct: pct(n, total) }));
  const conPieza = lista.filter(x => x.piezas.length).length, conMotivo = lista.filter(x => x.motivo !== 'SIN_MOTIVO').length;
  const hallazgos = hallazgosGenerales({ total, categorias, problemas, equiposRank, tipos, lista, minTotal, piezas, motivos, conPieza, conMotivo });

  return {
    total, equiposAfectados: porAfi.size, minTotal, minPromedio: conHoras ? Math.round(minTotal / conHoras) : 0, conHoras, costoTotal,
    repetidas: equiposRank.reduce((s, e) => s + e.repetidas, 0),
    categorias, problemas, equiposRank, tipos, palabras: top(palabras, 30), meses, porMes, hallazgos, lista,
    piezas, motivos, conPieza, conMotivo
  };
};

/** Resumen de un equipo a partir de sus registros ya clasificados. */
export const resumenEquipo = (afi, xs, eq = null) => {
  const c = new Map(), p = new Map(), pz = new Map(), mo = new Map(); let min = 0, costo = 0;
  xs.forEach(x => {
    incr(c, x.cat.key); if (x.problema && x.cat.key !== 'SERVICIO') incr(p, x.problema); min += x.min || 0; costo += x.costo;
    (x.piezas || []).forEach(k => { if (!pz.has(k)) pz.set(k, new Map()); incr(pz.get(k), x.motivo); });
    incr(mo, x.motivo);
  });
  const piezas = Array.from(pz.entries()).map(([k, m]) => {
    const n = Array.from(m.values()).reduce((s, v) => s + v, 0);
    const motivos = top(m, 4).map(([mk, v]) => ({ ...motivoPorKey(mk), n: v }));
    return { key: k, label: piezaPorKey(k)?.label || k, n, motivos, motivoTop: motivos.find(x => x.key !== 'SIN_MOTIVO') || null };
  }).sort((a, b) => b.n - a.n);
  const motivosEq = top(mo, 6).map(([k, n]) => ({ ...motivoPorKey(k), n }));
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
    n: xs.length, min, costo, cats, catTop: cats[0] || null, probs, probTop: probs[0] || null, piezas, piezaTop: piezas[0] || null, motivos: motivosEq,
    repetidas, ejemplosRep, primera, ultima, mtbf, diasDesdeUltima: ultima ? diasEntre(hoyISO(), ultima) : null
  };
};

// ---------------------------------------------------------------------
// Hallazgos en palabras
// ---------------------------------------------------------------------
const hallazgosGenerales = ({ total, categorias, problemas, equiposRank, tipos, lista, minTotal, piezas = [], motivos = [], conPieza = 0, conMotivo = 0 }) => {
  const h = [];
  if (!total) return [{ nivel: 'info', texto: 'No hay intervenciones en el período/filtro elegido.' }];
  const fallasReales = categorias.filter(c => c.key !== 'SERVICIO' && c.key !== 'OTROS');
  if (fallasReales[0]) h.push({ nivel: 'alto', icon: fallasReales[0].icon, texto: `Lo que más falla es el sistema **${fallasReales[0].label}**: ${fallasReales[0].n} de ${total} intervenciones (${fallasReales[0].pct}%).` + (fallasReales[1] ? ` Le sigue **${fallasReales[1].label}** (${fallasReales[1].pct}%).` : '') });
  const masHoras = [...categorias].sort((a, b) => b.min - a.min)[0];
  if (masHoras && masHoras.min && minTotal) h.push({ nivel: 'medio', icon: 'fa-clock', texto: `El sistema que más horas de taller consume es **${masHoras.label}**: ${fmtMin(masHoras.min)} (${pct(masHoras.min, minTotal)}% del tiempo registrado).` });
  if (piezas[0]) {
    const p = piezas[0];
    h.push({ nivel: 'alto', icon: 'fa-gear', texto: `La pieza que más falla es **${p.label}**: ${p.n} veces en ${p.equipos.length} equipo(s)` + (p.motivoTop ? `; el motivo más común es **${p.motivoTop.label.toLowerCase()}** (${p.motivoTop.n}).` : '.') + (piezas[1] ? ` Le siguen ${piezas.slice(1, 3).map(x => x.label.toLowerCase() + ' (' + x.n + ')').join(' y ')}.` : '') });
  }
  const fueraServ = lista.filter(x => detectarSintomas(x.r).includes('FUERA_SERVICIO'));
  if (fueraServ.length) h.push({ nivel: 'alto', icon: 'fa-power-off', texto: `**${fueraServ.length} falla(s)** dejaron el equipo **fuera de servicio** (${Array.from(new Set(fueraServ.map(x => 'AFI ' + x.afi))).slice(0, 6).join(', ')}).` });
  const motivoTop = motivos.find(m => m.key !== 'SIN_MOTIVO');
  if (motivoTop) h.push({ nivel: 'medio', icon: 'fa-circle-question', texto: `El motivo de falla más común es **${motivoTop.label.toLowerCase()}** (${motivoTop.n} de ${total}).` + (conMotivo < total * 0.6 ? ` Ojo: en ${total - conMotivo} registros no se indica el motivo.` : '') });
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
  if (res.piezaTop) h.push({ nivel: res.piezaTop.n > 1 ? 'alto' : 'medio', icon: 'fa-gear', texto: `Pieza que más le falla: **${res.piezaTop.label}** (${res.piezaTop.n} ${res.piezaTop.n === 1 ? 'vez' : 'veces'})` + (res.piezaTop.motivoTop ? `, sobre todo por **${res.piezaTop.motivoTop.label.toLowerCase()}**.` : '.') });
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
