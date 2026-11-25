// =====================================================================
// CALCULADORA DE ARRIENDO · CAMIONES (2026-11-24) — módulo de PRUEBA, solo Admin general.
// Más adelante pasa al área Ventas. Calcula el costo y el precio sugerido de un arriendo de camión:
// combustible, peajes, chofer, pluma/rigger, desgaste por km, costo de posesión por día, faena,
// imprevistos, gastos generales, margen e IVA.
//  - Parámetros (precio diésel, tipos de camión, peajes, valores de chofer, %) → bd_config clave 'calc_arriendo'.
//  - Cotizaciones guardadas → tabla bd_cotizaciones_arriendo (sql/cotizaciones_arriendo.sql).
// Todos los valores por defecto son REFERENCIALES: ajustarlos con datos reales de FRC.
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { dbEquipos, dbLocaciones, dbFormatos, usuarioActivo, soloAdminGeneral } from '../../core/store.js';
import { esVehiculo } from '../inventario/inventario.mapper.js';
import { hoyISO } from '../../core/utils.js';

const { ref, reactive, computed } = Vue;

export const TABLA_COTIZACIONES = 'bd_cotizaciones_arriendo';
const CLAVE_PARAMS = 'calc_arriendo';
const quien = () => { const u = usuarioActivo.value; return (u && (u.nombre || u.usuario)) || ''; };
export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// ---------- Parámetros por defecto (referenciales) ----------
// ejes: '2' = camión de 2 ejes · '3' = camión de más de 2 ejes (categoría de peaje)
export const TIPOS_DEFAULT = () => ([
  { tipo: 'CAMIÓN PLUMA', ejes: '3', rend: 3.0, valor: 120000000, residual: 30, vidaAnios: 10, neumaticos: 10, precioNeumatico: 450000, vidaNeumaticoKm: 80000, mantKm: 120, seguroAnual: 2500000, permisosAnual: 900000, gpsMes: 25000, pluma: true, consumoPlumaLh: 6 },
  { tipo: 'CAMIÓN PLANO', ejes: '3', rend: 3.2, valor: 90000000, residual: 30, vidaAnios: 10, neumaticos: 10, precioNeumatico: 420000, vidaNeumaticoKm: 90000, mantKm: 100, seguroAnual: 2000000, permisosAnual: 800000, gpsMes: 25000, pluma: false, consumoPlumaLh: 0 },
  { tipo: 'CAMIÓN TOLVA', ejes: '3', rend: 2.6, valor: 110000000, residual: 30, vidaAnios: 10, neumaticos: 10, precioNeumatico: 450000, vidaNeumaticoKm: 70000, mantKm: 130, seguroAnual: 2300000, permisosAnual: 850000, gpsMes: 25000, pluma: false, consumoPlumaLh: 0 },
  { tipo: 'CAMIÓN ALJIBE', ejes: '3', rend: 3.0, valor: 100000000, residual: 30, vidaAnios: 10, neumaticos: 10, precioNeumatico: 420000, vidaNeumaticoKm: 90000, mantKm: 110, seguroAnual: 2200000, permisosAnual: 800000, gpsMes: 25000, pluma: false, consumoPlumaLh: 0 },
  { tipo: 'TRACTO + RAMPLA', ejes: '3', rend: 2.3, valor: 150000000, residual: 30, vidaAnios: 10, neumaticos: 18, precioNeumatico: 430000, vidaNeumaticoKm: 100000, mantKm: 140, seguroAnual: 3000000, permisosAnual: 1100000, gpsMes: 25000, pluma: false, consumoPlumaLh: 0 },
  { tipo: 'TRACTO + CAMA BAJA', ejes: '3', rend: 2.0, valor: 170000000, residual: 30, vidaAnios: 10, neumaticos: 22, precioNeumatico: 430000, vidaNeumaticoKm: 90000, mantKm: 160, seguroAnual: 3300000, permisosAnual: 1200000, gpsMes: 25000, pluma: false, consumoPlumaLh: 0 },
  { tipo: 'CAMIÓN 3/4 (2 EJES)', ejes: '2', rend: 5.0, valor: 45000000, residual: 30, vidaAnios: 10, neumaticos: 6, precioNeumatico: 250000, vidaNeumaticoKm: 70000, mantKm: 70, seguroAnual: 1200000, permisosAnual: 450000, gpsMes: 25000, pluma: false, consumoPlumaLh: 0 }
]);
// Peajes: tarifa por pasada (un sentido). auto = categoría 1 (referencia); c2 = camión 2 ejes; c3 = camión de más de 2 ejes.
// estimado: true → la tarifa de camión se calculó con un factor aproximado sobre la de auto: CONFIRMAR con la concesionaria.
// Catálogo de plazas de peaje TRONCALES (se detectan solas si la ruta pasa por ellas). Tarifas 2026 camión 2 ejes (c2) y
// más de 2 ejes (c3) publicadas por las concesionarias (recopiladas en chiletransportistas.com/peajes-camiones, nov-2026).
// Ubicación: punto sobre la carretera (aprox. ±2 km a lo largo de la vía; basta para saber si la ruta pasa por ahí).
const FUENTE_PEAJES = 'Tarifas 2026 concesionarias (chiletransportistas.com/peajes-camiones). Verificar cada enero.';
const pj = (id, nombre, ruta, lat, lng, auto, c2, c3, nota = '') => ({ id, buscar: '', lat, lng, nombre, ruta, auto, c2, c3, estimado: false, red: true, nota: nota || FUENTE_PEAJES, fuente: FUENTE_PEAJES });
export const PEAJES_DEFAULT = () => ([
  // Ruta 5 Sur (de norte a sur)
  pj('angostura', 'Angostura · troncal Ruta 5 Sur', 'Ruta 5 Sur km 54 · Santiago – Rancagua', -33.9076, -70.7311, 3800, 6900, 12200),
  pj('r5s_quinta', 'Quinta · troncal Ruta 5 Sur', 'Ruta 5 Sur km 162 · San Fernando – Curicó', -34.7996, -71.0496, 3800, 6900, 12200),
  pj('r5s_rioclaro', 'Río Claro · troncal Ruta 5 Sur', 'Ruta 5 Sur km 220 · Curicó – Talca', -35.2156, -71.4166, 3300, 5900, 10400),
  pj('r5s_retiro', 'Retiro · troncal Ruta 5 Sur', 'Ruta 5 Sur km 323 · Linares – Parral', -36.0312, -71.7517, 3300, 5900, 10400),
  pj('r5s_santaclara', 'Santa Clara · troncal Ruta 5 Sur', 'Ruta 5 Sur km 444 · Chillán – Los Ángeles', -36.9413, -72.3489, 3400, 6100, 10800),
  pj('r5s_lasmaicas', 'Las Maicas · troncal Ruta 5 Sur', 'Ruta 5 Sur km 550 · Los Ángeles – Collipulli', -37.8066, -72.3309, 3400, 6100, 10800),
  pj('r5s_pua', 'Púa · troncal Ruta 5 Sur', 'Ruta 5 Sur km 623 · Victoria – Temuco', -38.3703, -72.3872, 3600, 6400, 11400),
  pj('r5s_quepe', 'Quepe · troncal Ruta 5 Sur', 'Ruta 5 Sur km 693 · Temuco – Freire', -38.9158, -72.6241, 3600, 6400, 11400),
  pj('r5s_lanco', 'Lanco · troncal Ruta 5 Sur', 'Ruta 5 Sur · Temuco – Valdivia', -39.4333, -72.7547, 0, 6500, 11600),
  pj('r5s_launion', 'La Unión · troncal Ruta 5 Sur', 'Ruta 5 Sur · Río Bueno – La Unión', -40.2281, -72.9388, 0, 6500, 11600),
  pj('r5s_cuatrovientos', 'Cuatro Vientos · troncal Ruta 5 Sur', 'Ruta 5 Sur · Osorno – Puerto Montt', -41.0040, -73.1199, 0, 6500, 11600),
  // Ruta 5 Norte
  pj('r5n_lampa', 'Lampa · Ruta 5 Norte', 'Ruta 5 Norte · Santiago – Los Vilos', -33.2356, -70.7588, 0, 1600, 2900),
  pj('r5n_lasvegas', 'Las Vegas · troncal Ruta 5 Norte', 'Ruta 5 Norte · Llay-Llay', -32.8433, -70.9893, 0, 5300, 9400),
  pj('r5n_melon', 'Túnel El Melón · Ruta 5 Norte', 'Ruta 5 Norte · Nogales', -32.6819, -71.2108, 0, 5300, 9400),
  pj('r5n_pichidangui', 'Pichidangui · troncal Ruta 5 Norte', 'Ruta 5 Norte · Los Vilos', -32.1302, -71.5004, 0, 5300, 9400),
  // Ruta 68 (Santiago – Valparaíso), Ruta 57 (Los Andes), Ruta 78 (San Antonio)
  pj('r68_loprado', 'Lo Prado · troncal Ruta 68', 'Ruta 68 · Santiago – Valparaíso', -33.4568, -70.8994, 0, 4800, 8600, 'Tiene tarifa punta (más cara) fines de semana/feriados. ' + FUENTE_PEAJES),
  pj('r68_zapata', 'Zapata · troncal Ruta 68', 'Ruta 68 · Curacaví – Casablanca', -33.3549, -71.3341, 0, 4800, 8600, 'Tiene tarifa punta (más cara) fines de semana/feriados. ' + FUENTE_PEAJES),
  pj('r57_chacabuco', 'Chacabuco · troncal Ruta 57', 'Ruta 57 · Santiago – Los Andes', -33.0335, -70.6935, 0, 6000, 10600),
  pj('r78_puangue', 'Puangue · troncal Ruta 78', 'Ruta 78 · Santiago – San Antonio', -33.6510, -71.2639, 0, 2322, 4064, 'Tarifa normal; hay tarifa punta. ' + FUENTE_PEAJES),
  // Sin ubicación: se cobran a mano (pasarlos a MANUAL)
  { id: 'lateral', buscar: '', lat: null, lng: null, nombre: 'Lateral Ruta 5 Sur (salida/entrada)', ruta: 'Ej. enlaces Rancagua, San Fernando', auto: 900, c2: 1600, c3: 2900, estimado: true, nota: 'Camión 2 ejes 2026: $1.600 (Ruta del Maipo). +2 ejes estimado. Se cobra a mano.' },
  { id: 'vespucio', buscar: '', lat: null, lng: null, nombre: 'Pórtico Américo Vespucio – Ruta 78', ruta: 'Santiago (autopista urbana)', auto: 0, c2: 1436, c3: 2513, estimado: false, nota: 'Camión 2026: $1.436 / $2.513 normal (punta el doble). ' + FUENTE_PEAJES },
  { id: 'riomaipo', buscar: 'Peaje Río Maipo', lat: null, lng: null, nombre: 'Troncal Acceso Sur', ruta: 'Acceso Sur a Santiago', auto: 1400, c2: 2600, c3: 4600, estimado: true, nota: 'Camión 2 ejes 2026: $2.600 (Ruta del Maipo). +2 ejes estimado. Se cobra a mano.' }
]);
/** Agrega al catálogo guardado las plazas nuevas del catálogo FRC y completa ubicaciones/tarifas oficiales que falten. */
const mezclarPeajes = () => {
  const def = PEAJES_DEFAULT();
  def.forEach(d => {
    const s = params.peajes.find(p => p.id === d.id);
    if (!s) { params.peajes.push(d); return; }
    if (s.lat == null && d.lat != null) { s.lat = d.lat; s.lng = d.lng; }
    if (d.red) s.red = true;
    if (s.estimado && d.estimado === false) Object.assign(s, { auto: d.auto, c2: d.c2, c3: d.c3, estimado: false, nota: d.nota, fuente: d.fuente });
  });
  // Peajes que se agregaron antes desde OpenStreetMap sin tarifa y que ya están en el catálogo FRC → se quitan
  params.peajes = params.peajes.filter(p => !(String(p.id).startsWith('osm') && !num(p.c2) && !num(p.c3) && def.some(d => d.lat != null && p.lat != null && distKm([d.lng, d.lat], [p.lng, p.lat]) < 3)));
};
export const PARAMS_DEFAULT = () => ({
  precioDiesel: 1500,           // $/L referencial → actualizar (bencinaenlinea.cl)
  diasOperativosAnio: 250,      // para repartir depreciación, seguro y permisos por día
  costoDiaChofer: 65000,        // costo empresa por día (sueldo + leyes sociales)
  valorHoraExtra: 9000,
  viaticoDia: 15000,            // alimentación
  alojamientoNoche: 35000,
  bonoFaenaDia: 0,
  costoDiaRigger: 70000,
  imprevistosPct: 5,
  gastosGeneralesPct: 10,
  margenPct: 25,
  ivaPct: 19,
  validezDias: 15,
  // Condiciones que se imprimen en el PDF para el cliente (una por línea; editables en Parámetros)
  condicionesCliente: [
    'Valores en pesos chilenos. El precio neto no incluye IVA; el IVA se suma en el total.',
    'Distancias y tiempos según la ruta calculada entre el origen y el destino indicados. Cambios de ruta, destino, días o número de viajes se recotizan.',
    'Peajes según tarifas vigentes para el tipo de camión, en horario normal. Pórticos TAG urbanos y recargos en horario punta se cobran según corresponda.',
    'Tiempos de espera, días adicionales o trabajos no indicados en esta cotización se cobran aparte.',
    'Sujeto a disponibilidad del equipo al momento de la confirmación.'
  ].join('\n'),
  tipos: TIPOS_DEFAULT(),
  peajes: PEAJES_DEFAULT(),
  // Rendimiento por MODELO de camión, con su fuente (ficha técnica, medición FRC, etc.). Se usa en vez del rendimiento del tipo.
  modelos: [],
  actualizado: ''
});

export const params = reactive(PARAMS_DEFAULT());
export const faltaConfig = ref(false);
export const guardandoParams = ref(false);

export const cargarParams = async () => {
  try {
    const data = await sb(supabaseClient.from('bd_config').select('valor').eq('clave', CLAVE_PARAMS).limit(1));
    const v = data && data[0] && data[0].valor;
    const obj = typeof v === 'string' ? JSON.parse(v) : v;
    if (obj && typeof obj === 'object') Object.assign(params, PARAMS_DEFAULT(), obj);
    mezclarPeajes();
    faltaConfig.value = false;
  } catch (e) { faltaConfig.value = true; }
};
export const guardarParams = async () => {
  if (!soloAdminGeneral()) return;
  guardandoParams.value = true;
  try {
    params.actualizado = hoyISO();
    const valor = JSON.parse(JSON.stringify(params));
    await sb(supabaseClient.from('bd_config').upsert([{ clave: CLAVE_PARAMS, valor, updated_at: new Date().toISOString() }], { onConflict: 'clave' }));
    alert('Parámetros guardados.');
  } catch (err) { alert('No se pudieron guardar los parámetros: ' + errMsg(err)); }
  finally { guardandoParams.value = false; }
};
export const restaurarParams = () => { if (confirm('¿Volver a los valores referenciales por defecto? (no se guarda hasta que presiones "Guardar parámetros")')) Object.assign(params, PARAMS_DEFAULT()); };
export const agregarPeaje = () => params.peajes.push({ id: 'p' + Date.now(), buscar: '', lat: null, lng: null, nombre: '', ruta: '', auto: 0, c2: 0, c3: 0, estimado: false, nota: '' });
export const TIPOS_FUENTE = ['Ficha técnica fabricante', 'Medido FRC (km / litros cargados)', 'Prueba / revista especializada', 'Estimado'];
export const agregarModelo = (pre = {}) => params.modelos.push({ marca: '', modelo: '', rend: 0, tipoFuente: TIPOS_FUENTE[0], fuente: '', nota: '', fecha: hoyISO(), ...pre });
export const quitarModelo = (i) => params.modelos.splice(i, 1);
export const quitarPeaje = (i) => params.peajes.splice(i, 1);
export const agregarTipo = () => params.tipos.push({ ...TIPOS_DEFAULT()[1], tipo: 'NUEVO TIPO' });
export const quitarTipo = (i) => { if (params.tipos.length > 1) params.tipos.splice(i, 1); };

// ---------- Camiones de la flota (Vehículos) ----------
const sinTilde = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
export const esCamionFlota = (e) => { const t = sinTilde(e?.tipo); return esVehiculo(e) && ((/CAMION/.test(t) && !/CAMIONETA/.test(t)) || /RAMPLA/.test(t) || /CAMA\s*BAJA/.test(t) || /TRACTO/.test(t)); };
export const camionesFlota = computed(() => dbEquipos.value.filter(esCamionFlota).sort((a, b) => String(a.tipo).localeCompare(String(b.tipo))));
/** Tipo de la calculadora que mejor calza con el tipo escrito en Vehículos. */
export const tipoSugerido = (tipoFlota) => {
  const t = sinTilde(tipoFlota);
  const busca = (re) => params.tipos.find(x => re.test(sinTilde(x.tipo)));
  if (/PLUMA/.test(t)) return busca(/PLUMA/);
  if (/CAMA\s*BAJA/.test(t)) return busca(/CAMA\s*BAJA/);
  if (/RAMPLA|TRACTO/.test(t)) return busca(/RAMPLA/);
  if (/TOLVA/.test(t)) return busca(/TOLVA/);
  if (/ALJIBE/.test(t)) return busca(/ALJIBE/);
  if (/PLANO/.test(t)) return busca(/PLANO/);
  return null;
};

// ---------- Cotización en pantalla ----------
export const MODALIDADES = [
  { k: 'flete', l: 'Flete / traslado', d: 'Se cobra por viaje (ida o ida y vuelta).' },
  { k: 'dias', l: 'Arriendo por días', d: 'El camión queda en faena por días.' },
  { k: 'mes', l: 'Arriendo mensual', d: 'Por meses (30 días cada uno).' }
];
// man.x = true → el usuario escribió el valor a mano (se usa form.x). false → valor AUTOMÁTICO (web / parámetros / regla).
const MAN_VACIO = () => ({ kmIda: false, dias: false, rend: false, diesel: false, diasViatico: false, noches: false });
export const formVacio = () => ({
  id: null, nombre: '', cliente: '', fecha: hoyISO(), afi: '', tipo: 'CAMIÓN PLUMA', modalidad: 'flete',
  origen: '', destino: '', regionOrigen: '', regionDestino: '', kmIda: 0, idaVuelta: true, viajes: 1,
  dias: 1, meses: 1, kmFaenaDia: 0, horasPlumaDia: 0,
  rend: 0, precioDiesel: 0,
  conChofer: true, conRigger: false, horasExtra: 0, diasViatico: 0, noches: 0,
  man: MAN_VACIO(),
  peajes: {},                 // { idPeaje: pasadas escritas a mano }
  peajeMan: {},               // { idPeaje: true } → pasadas manuales
  ruta: null,                 // { km, horas, origen:{lat,lng,nombre}, destino:{...}, fuente, fecha }
  tagUrbano: 0, permisosEspeciales: 0, escolta: 0, lavado: 0, estacionamiento: 0,
  acreditacion: 0, examenes: 0, induccion: 0, epp: 0, otrosFaena: 0,
  otros: 0, notaOtros: '',
  usarPctParams: true, imprevistosPct: 5, gastosGeneralesPct: 10, margenPct: 25,
  observaciones: ''
});
export const form = reactive(formVacio());
export const nuevaCotizacion = () => { Object.assign(form, formVacio()); rutaGeom.value = []; rutaEstado.value = ''; };

export const tipoSel = computed(() => params.tipos.find(t => t.tipo === form.tipo) || params.tipos[0]);
export const camionSel = computed(() => (form.afi ? dbEquipos.value.find(e => e.afi === form.afi) : null) || null);
/** Modelo registrado (rendimiento + fuente) que calza con la marca/modelo del camión elegido. */
export const modeloSel = computed(() => {
  const e = camionSel.value; if (!e) return null;
  const mm = sinTilde(`${e.marca || ''} ${e.modelo || ''}`);
  return (params.modelos || []).find(m => m.modelo && mm.includes(sinTilde(m.modelo)) && (!m.marca || mm.includes(sinTilde(m.marca)))) || null;
});
/** Fichas técnicas cargadas en el perfil del camión (Inventario/Vehículos → Filtros y ficha). */
export const fichasCamion = computed(() => {
  const e = camionSel.value; if (!e) return [];
  return dbFormatos.value.filter(d => String(d.carpeta || '').startsWith('EQUIPO:' + e.id) && d.nombre !== '__CARPETA__');
});

// ---------- Ruta automática (OpenStreetMap: Nominatim + OSRM) ----------
export const rutaEstado = ref('');      // '' | 'calculando' | 'ok' | 'error'
export const rutaError = ref('');
export const rutaGeom = ref([]);        // [[lng,lat], ...] de la última ruta calculada (para detectar peajes)
/** Lugares con coordenadas del módulo Áreas (empresa/área/sector/locación). */
export const lugaresConCoord = computed(() => dbLocaciones.value.filter(n => n.lat != null && n.lng != null).map(n => {
  const partes = []; let x = n, guard = 0;
  while (x && guard++ < 5) { partes.unshift(x.nombre); x = x.padreId != null ? dbLocaciones.value.find(y => String(y.id) === String(x.padreId)) : null; }
  return { nombre: partes.join(' › '), lat: n.lat, lng: n.lng };
}).sort((a, b) => a.nombre.localeCompare(b.nombre)));
// Ciudades, comunas y faenas por REGIÓN (norte → sur) con su coordenada aproximada (centro). Así origen/destino no dependen del buscador.
export const REGIONES = [
  { region: 'Arica y Parinacota', ciudades: { 'Arica': [-18.4783, -70.3126], 'Putre': [-18.1975, -69.5597], 'Codpa': [-18.83, -69.74] } },
  { region: 'Tarapacá', ciudades: { 'Iquique': [-20.2141, -70.1524], 'Alto Hospicio': [-20.2706, -70.1015], 'Pozo Almonte': [-20.2597, -69.7862], 'Pica': [-20.4897, -69.3297], 'Huara': [-19.9958, -69.7708], 'Mina Collahuasi': [-20.97, -68.7], 'Mina Cerro Colorado': [-20.04, -69.27] } },
  { region: 'Antofagasta', ciudades: { 'Antofagasta': [-23.6509, -70.3975], 'Calama': [-22.456, -68.9293], 'Mejillones': [-23.1, -70.45], 'Tocopilla': [-22.092, -70.1979], 'Taltal': [-25.4053, -70.4836], 'María Elena': [-22.3453, -69.6667], 'Sierra Gorda': [-22.8944, -69.3197], 'San Pedro de Atacama': [-22.9087, -68.1997], 'Baquedano': [-23.3333, -69.85], 'Mina Chuquicamata': [-22.31, -68.9], 'Mina Escondida': [-24.27, -69.07], 'Mina Spence': [-22.8, -69.27], 'Mina Centinela': [-23.02, -69.07], 'Mina Radomiro Tomic': [-22.2, -68.9], 'Mina Gabriela Mistral': [-23.43, -69.18] } },
  { region: 'Atacama', ciudades: { 'Copiapó': [-27.3668, -70.3323], 'Caldera': [-27.0667, -70.8167], 'Tierra Amarilla': [-27.4833, -70.2667], 'Vallenar': [-28.5708, -70.7581], 'Chañaral': [-26.3479, -70.6224], 'Diego de Almagro': [-26.3697, -70.0497], 'El Salvador': [-26.2464, -69.6227], 'Huasco': [-28.4667, -71.2167], 'Freirina': [-28.5, -71.0833], 'Alto del Carmen': [-28.7556, -70.4897], 'Mina Candelaria': [-27.51, -70.29], 'Mina Caserones': [-28.13, -69.6] } },
  { region: 'Coquimbo', ciudades: { 'La Serena': [-29.9027, -71.2519], 'Coquimbo': [-29.9533, -71.3436], 'Ovalle': [-30.6015, -71.199], 'Vicuña': [-30.0319, -70.7081], 'Andacollo': [-30.2333, -71.0833], 'Illapel': [-31.6308, -71.1653], 'Salamanca': [-31.7797, -70.9636], 'Los Vilos': [-31.9113, -71.5097], 'Combarbalá': [-31.1786, -71.0003], 'Monte Patria': [-30.6939, -70.9556], 'Punitaqui': [-30.8333, -71.2667], 'Canela': [-31.3992, -71.4567], 'Mina Los Pelambres': [-31.72, -70.49] } },
  { region: 'Valparaíso', ciudades: { 'Valparaíso': [-33.0472, -71.6127], 'Viña del Mar': [-33.0245, -71.5518], 'Concón': [-32.9231, -71.5197], 'Quilpué': [-33.0478, -71.4422], 'Villa Alemana': [-33.0422, -71.3733], 'Limache': [-32.9847, -71.2756], 'Olmué': [-33.0, -71.1833], 'Quillota': [-32.8794, -71.2467], 'La Calera': [-32.787, -71.1886], 'La Cruz': [-32.8264, -71.2289], 'Nogales': [-32.7333, -71.2], 'Hijuelas': [-32.8, -71.1667], 'Quintero': [-32.7792, -71.53], 'Puchuncaví': [-32.7258, -71.4128], 'Ventanas': [-32.7444, -71.4844], 'Zapallar': [-32.5528, -71.4581], 'Papudo': [-32.5069, -71.4486], 'La Ligua': [-32.45, -71.2333], 'Cabildo': [-32.4269, -71.0667], 'Petorca': [-32.25, -70.9333], 'Los Andes': [-32.8337, -70.5986], 'San Esteban': [-32.8, -70.5833], 'Calle Larga': [-32.85, -70.6333], 'Rinconada': [-32.8333, -70.7], 'San Felipe': [-32.7507, -70.7251], 'Llaillay': [-32.84, -70.9567], 'Catemu': [-32.7833, -70.9667], 'Putaendo': [-32.6275, -70.7167], 'Santa María': [-32.75, -70.65], 'Panquehue': [-32.8, -70.8333], 'Casablanca': [-33.3197, -71.4078], 'San Antonio': [-33.5933, -71.6127], 'Cartagena': [-33.5539, -71.6067], 'El Quisco': [-33.3997, -71.6964], 'Algarrobo': [-33.3639, -71.6708], 'El Tabo': [-33.4544, -71.6667], 'Santo Domingo': [-33.6333, -71.65], 'Llolleo': [-33.6167, -71.6], 'Mina Andina (Saladillo)': [-32.93, -70.3] } },
  { region: 'Metropolitana', ciudades: { 'Santiago': [-33.4489, -70.6693], 'Providencia': [-33.4314, -70.6093], 'Las Condes': [-33.408, -70.567], 'Vitacura': [-33.387, -70.573], 'Lo Barnechea': [-33.35, -70.5167], 'Ñuñoa': [-33.4569, -70.597], 'La Florida': [-33.523, -70.598], 'Peñalolén': [-33.486, -70.546], 'Macul': [-33.491, -70.599], 'San Joaquín': [-33.496, -70.628], 'San Miguel': [-33.497, -70.651], 'La Cisterna': [-33.53, -70.664], 'El Bosque': [-33.562, -70.676], 'La Pintana': [-33.584, -70.634], 'La Granja': [-33.537, -70.623], 'San Ramón': [-33.537, -70.644], 'Lo Espejo': [-33.52, -70.689], 'Pedro Aguirre Cerda': [-33.49, -70.678], 'Estación Central': [-33.459, -70.698], 'Cerrillos': [-33.495, -70.716], 'Maipú': [-33.51, -70.757], 'Pudahuel': [-33.44, -70.76], 'Lo Prado': [-33.444, -70.725], 'Cerro Navia': [-33.425, -70.735], 'Quinta Normal': [-33.429, -70.697], 'Renca': [-33.405, -70.728], 'Quilicura': [-33.36, -70.73], 'Conchalí': [-33.383, -70.675], 'Huechuraba': [-33.367, -70.633], 'Independencia': [-33.413, -70.664], 'Recoleta': [-33.407, -70.642], 'Puente Alto': [-33.6117, -70.5758], 'Pirque': [-33.6333, -70.55], 'San José de Maipo': [-33.6417, -70.3519], 'San Bernardo': [-33.5927, -70.6995], 'Calera de Tango': [-33.63, -70.77], 'Buin': [-33.7322, -70.7428], 'Paine': [-33.8075, -70.7417], 'Lampa': [-33.2856, -70.877], 'Colina': [-33.2, -70.675], 'Chicureo': [-33.2833, -70.65], 'Til Til': [-33.0833, -70.9333], 'Talagante': [-33.6639, -70.9272], 'Peñaflor': [-33.6066, -70.8766], 'Padre Hurtado': [-33.5767, -70.8], 'El Monte': [-33.6833, -71.0167], 'Isla de Maipo': [-33.75, -70.9], 'Melipilla': [-33.6856, -71.2158], 'Curacaví': [-33.4039, -71.1333], 'María Pinto': [-33.5167, -71.1333], 'Alhué': [-34.0333, -71.1], 'San Pedro (Melipilla)': [-33.8833, -71.4667], 'Mina Los Bronces': [-33.15, -70.28] } },
  { region: "O'Higgins", ciudades: { 'Rancagua': [-34.1708, -70.7444], 'Machalí': [-34.1808, -70.6497], 'Coya': [-34.2, -70.5333], 'Mina El Teniente (Colón)': [-34.08, -70.38], 'Graneros': [-34.0647, -70.7272], 'Codegua': [-34.0367, -70.6672], 'Mostazal': [-33.9767, -70.7039], 'Doñihue': [-34.2267, -70.9647], 'Coltauco': [-34.2833, -71.0833], 'Olivar': [-34.2167, -70.8167], 'Requínoa': [-34.2875, -70.8156], 'Rengo': [-34.4064, -70.8581], 'Malloa': [-34.45, -70.95], 'Quinta de Tilcoco': [-34.35, -70.9667], 'San Vicente': [-34.4386, -71.0778], 'Peumo': [-34.3956, -71.1706], 'Pichidegua': [-34.3583, -71.2833], 'Las Cabras': [-34.2944, -71.3089], 'San Fernando': [-34.5853, -70.9868], 'Chimbarongo': [-34.7128, -71.0433], 'Nancagua': [-34.6667, -71.2167], 'Placilla': [-34.6167, -71.1167], 'Santa Cruz': [-34.6386, -71.3653], 'Chépica': [-34.7333, -71.2833], 'Lolol': [-34.7667, -71.65], 'Peralillo': [-34.4833, -71.4833], 'Marchigüe': [-34.4, -71.6167], 'Litueche': [-34.1167, -71.7333], 'Pichilemu': [-34.3872, -72.0033] } },
  { region: 'Maule', ciudades: { 'Talca': [-35.4264, -71.6554], 'Curicó': [-34.9828, -71.2394], 'Teno': [-34.8708, -71.1625], 'Romeral': [-34.9667, -71.1333], 'Molina': [-35.1144, -71.2825], 'Sagrada Familia': [-35.0, -71.3833], 'Hualañé': [-34.9764, -71.8064], 'Licantén': [-34.9833, -72.0], 'Rauco': [-34.9333, -71.3167], 'San Clemente': [-35.5333, -71.4833], 'Pelarco': [-35.3667, -71.45], 'Maule': [-35.5333, -71.7], 'San Rafael': [-35.3167, -71.5167], 'San Javier': [-35.5953, -71.7292], 'Villa Alegre': [-35.6833, -71.75], 'Yerbas Buenas': [-35.75, -71.5833], 'Constitución': [-35.3333, -72.4167], 'Linares': [-35.8467, -71.5931], 'Longaví': [-35.9667, -71.6833], 'Retiro': [-36.05, -71.7667], 'Parral': [-36.1431, -71.8258], 'Cauquenes': [-35.9675, -72.3225], 'Chanco': [-35.7333, -72.5333] } },
  { region: 'Ñuble', ciudades: { 'Chillán': [-36.6066, -72.1034], 'Chillán Viejo': [-36.6236, -72.1317], 'San Carlos': [-36.4247, -71.9581], 'Bulnes': [-36.7422, -72.2986], 'Yungay': [-37.1214, -72.0186], 'Quillón': [-36.7378, -72.4697], 'Coihueco': [-36.6167, -71.8333], 'San Nicolás': [-36.5, -72.2167], 'Quirihue': [-36.2833, -72.5333], 'Coelemu': [-36.4878, -72.7025] } },
  { region: 'Biobío', ciudades: { 'Concepción': [-36.827, -73.0503], 'Talcahuano': [-36.7249, -73.1168], 'Hualpén': [-36.7833, -73.0833], 'San Pedro de la Paz': [-36.8406, -73.1072], 'Chiguayante': [-36.9167, -73.0333], 'Penco': [-36.7333, -72.9833], 'Tomé': [-36.6167, -72.95], 'Coronel': [-37.0303, -73.1416], 'Lota': [-37.0897, -73.1561], 'Hualqui': [-36.9667, -72.9333], 'Arauco': [-37.2464, -73.3175], 'Curanilahue': [-37.4764, -73.345], 'Lebu': [-37.6083, -73.65], 'Cañete': [-37.8011, -73.3964], 'Los Ángeles': [-37.4697, -72.3537], 'Cabrero': [-37.0333, -72.4], 'Nacimiento': [-37.5, -72.6667], 'Mulchén': [-37.7189, -72.2403], 'Santa Bárbara': [-37.6667, -72.0167], 'Laja': [-37.2833, -72.7167], 'Yumbel': [-37.1, -72.5667] } },
  { region: 'La Araucanía', ciudades: { 'Temuco': [-38.7359, -72.5904], 'Padre Las Casas': [-38.7667, -72.6], 'Lautaro': [-38.5308, -72.4336], 'Victoria': [-38.2333, -72.3333], 'Collipulli': [-37.9547, -72.4364], 'Angol': [-37.7958, -72.7164], 'Traiguén': [-38.25, -72.6667], 'Curacautín': [-38.4333, -71.8833], 'Nueva Imperial': [-38.7442, -72.9508], 'Carahue': [-38.7111, -73.1647], 'Freire': [-38.9536, -72.6222], 'Pitrufquén': [-38.9833, -72.6333], 'Gorbea': [-39.1, -72.6833], 'Loncoche': [-39.3667, -72.6333], 'Villarrica': [-39.2856, -72.2279], 'Pucón': [-39.2722, -71.9778] } },
  { region: 'Los Ríos', ciudades: { 'Valdivia': [-39.8142, -73.2459], 'Lanco': [-39.4522, -72.7747], 'Mariquina (San José)': [-39.54, -72.96], 'Panguipulli': [-39.6436, -72.3369], 'Los Lagos': [-39.85, -72.8333], 'Paillaco': [-40.0667, -72.8667], 'Corral': [-39.8875, -73.4317], 'La Unión': [-40.2939, -73.0828], 'Río Bueno': [-40.3333, -72.9667], 'Futrono': [-40.1333, -72.4] } },
  { region: 'Los Lagos', ciudades: { 'Puerto Montt': [-41.4693, -72.9424], 'Puerto Varas': [-41.3195, -72.9854], 'Llanquihue': [-41.25, -73.0167], 'Frutillar': [-41.1167, -73.05], 'Los Muermos': [-41.4, -73.4667], 'Calbuco': [-41.7667, -73.1333], 'Maullín': [-41.6167, -73.6], 'Osorno': [-40.5739, -73.1336], 'Purranque': [-40.9167, -73.1667], 'Río Negro': [-40.7833, -73.2333], 'Puerto Octay': [-40.9667, -72.8833], 'Pargua': [-41.7833, -73.4333], 'Ancud': [-41.8697, -73.8203], 'Castro': [-42.48, -73.7622], 'Quellón': [-43.1167, -73.6167], 'Chaitén': [-42.9167, -72.7167] } },
  { region: 'Aysén', ciudades: { 'Coyhaique': [-45.5752, -72.0662], 'Puerto Aysén': [-45.4, -72.6833], 'Chile Chico': [-46.5333, -71.7333], 'Cochrane': [-47.25, -72.5667] } },
  { region: 'Magallanes', ciudades: { 'Punta Arenas': [-53.1638, -70.9171], 'Puerto Natales': [-51.7236, -72.4875], 'Porvenir': [-53.2958, -70.3683], 'Puerto Williams': [-54.9333, -67.6167] } }
];
export const CIUDADES = REGIONES.flatMap(r => Object.keys(r.ciudades));
/** Lugares de una región ('' = todas) para la lista desplegable. */
export const ciudadesDe = (region) => Object.keys(region ? (REGIONES.find(r => r.region === region) || { ciudades: {} }).ciudades : COORD_CIUDADES);
/** Región de un lugar de la lista (para mostrarla). */
export const regionDe = (nombre) => (REGIONES.find(r => Object.keys(r.ciudades).some(k => normTxtCalc(k) === normTxtCalc(nombre))) || {}).region || '';
export const COORD_CIUDADES = Object.assign({}, ...REGIONES.map(r => r.ciudades));
/** Coordenadas desde texto: "lat,lng", link de Google Maps (@lat,lng o !3dlat!4dlng) o lugar de Áreas. */
const coordDeTexto = (t) => {
  const s = String(t || '');
  const lug = lugaresConCoord.value.find(l => l.nombre === s.trim());
  if (lug) return { lat: lug.lat, lng: lug.lng, nombre: lug.nombre, fuente: 'Áreas FRC' };
  const ciu = Object.keys(COORD_CIUDADES).find(k => normTxtCalc(k) === normTxtCalc(s.trim()));
  if (ciu) return { lat: COORD_CIUDADES[ciu][0], lng: COORD_CIUDADES[ciu][1], nombre: ciu + ', ' + regionDe(ciu) + ', Chile', fuente: 'Ciudades FRC (centro de la ciudad)' };
  let m = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) || s.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) || s.match(/^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
  if (m) return { lat: Number(m[1]), lng: Number(m[2]), nombre: s.trim(), fuente: 'coordenadas' };
  return null;
};
const geocodificar = async (texto) => {
  const c = coordDeTexto(texto); if (c) return c;
  // 1) OpenStreetMap (Nominatim)  2) si no responde, Photon (komoot), también con datos de OpenStreetMap
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cl&accept-language=es&q=' + encodeURIComponent(texto), { headers: { Accept: 'application/json' } });
    if (r.ok) { const j = await r.json(); if (j.length) return { lat: Number(j[0].lat), lng: Number(j[0].lon), nombre: j[0].display_name, fuente: 'OpenStreetMap' }; }
  } catch (e) { /* bloqueado o sin respuesta: se prueba Photon */ }
  let j = null;
  try { const r = await fetch('https://photon.komoot.io/api/?limit=5&lang=es&q=' + encodeURIComponent(texto + ', Chile')); if (r.ok) j = await r.json(); }
  catch (e) { throw new Error('los buscadores de lugares no responden. Elige una ciudad de la lista, pega un link de Google Maps o escribe "lat,lng".'); }
  const f = ((j && j.features) || []).find(x => x.properties && x.properties.countrycode === 'CL');
  if (!f) throw new Error(`no se encontró "${texto}". Elige una ciudad de la lista, pega un link de Google Maps o usa un lugar de Áreas con coordenadas.`);
  const pr = f.properties;
  return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], nombre: [pr.name, pr.city, pr.state].filter(Boolean).join(', '), fuente: 'OpenStreetMap (Photon)' };
};
export const calcularRuta = async () => {
  if (!String(form.origen).trim() || !String(form.destino).trim()) { rutaError.value = 'Escribe origen y destino.'; rutaEstado.value = 'error'; return; }
  rutaEstado.value = 'calculando'; rutaError.value = '';
  try {
    const o = await geocodificar(form.origen);
    if (!coordDeTexto(form.origen) && !coordDeTexto(form.destino)) await new Promise(res => setTimeout(res, 1100));   // Nominatim: máximo 1 consulta por segundo
    const d = await geocodificar(form.destino);
    const url = `https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('el servicio de rutas no responde (' + r.status + '). Intenta de nuevo en un minuto');
    const j = await r.json();
    if (j.code !== 'Ok' || !j.routes || !j.routes.length) throw new Error('no se encontró una ruta por camino entre esos puntos.');
    const ruta = j.routes[0];
    rutaGeom.value = ruta.geometry.coordinates;
    form.ruta = { km: Math.round(ruta.distance / 100) / 10, horas: Math.round(ruta.duration / 360) / 10, origen: o, destino: d, fuente: 'OpenStreetMap (OSRM)', fecha: hoyISO(),
      linea: simplificar(ruta.geometry.coordinates, 600), peajes: detectarPeajes(ruta.geometry.coordinates), peajesOSM: [], porticos: 0 };
    rutaEstado.value = 'ok';
    peajesEstado.value = '';   // los troncales salen del catálogo FRC; OpenStreetMap es opcional (botón)
  } catch (err) { rutaEstado.value = 'error'; const m = String(err.message || err); rutaError.value = 'No se pudo calcular la ruta: ' + (/failed to fetch|networkerror|load failed/i.test(m) ? 'sin respuesta del servicio de rutas (revisa internet o intenta en un minuto)' : m); }
};

// ---------- Peajes sobre la ruta, desde OpenStreetMap (Overpass) ----------
// Busca plazas de peaje (barrier=toll_booth) y pórticos TAG (highway=toll_gantry) a menos de 120 m de la ruta.
// Cada plaza se asocia a un peaje del catálogo por nombre o cercanía; si no existe, se agrega al catálogo
// "sin tarifa" para completarla en Parámetros. Los pórticos solo se cuentan y se muestran (TAG va aparte).
export const peajesEstado = ref('');   // '' | 'buscando' | 'ok' | 'catalogo' (OpenStreetMap no respondió: solo catálogo)
export const verTodosPeajes = ref(false);
const simplificar = (coords, max) => { if (coords.length <= max) return coords.map(c => [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5]); const paso = Math.ceil(coords.length / max); const out = coords.filter((_, i) => i % paso === 0); out.push(coords[coords.length - 1]); return out.map(c => [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5]); };
/** Distancia en metros de un punto [lng,lat] a la línea de la ruta (segmento por segmento). */
const distARutaM = (pt, coords) => {
  const k = Math.cos(pt[1] * Math.PI / 180) * 111320, kl = 110540; let min = Infinity;
  for (let i = 1; i < coords.length; i++) {
    const ax = (coords[i - 1][0] - pt[0]) * k, ay = (coords[i - 1][1] - pt[1]) * kl, bx = (coords[i][0] - pt[0]) * k, by = (coords[i][1] - pt[1]) * kl;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; let t = l2 ? -(ax * dx + ay * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
    const x = ax + t * dx, y = ay + t * dy; const d = Math.sqrt(x * x + y * y); if (d < min) min = d;
  }
  return min;
};
const llaveNombre = (t) => normTxtCalc(t).replace(/\b(peaje|plaza|de|del|la|el|troncal|lateral|ruta|5|sur|norte|tag|portico|pórtico)\b/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const normTxtCalc = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Servidores Overpass (si uno está ocupado se prueba el siguiente)
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const consultarOverpass = async (q) => {
  let ultimoError = null;
  for (const url of OVERPASS) {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 35000);
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { ultimoError = e; } finally { clearTimeout(t); }
  }
  throw ultimoError || new Error('sin respuesta');
};
export const buscarPeajesEnRuta = async (coordsIn) => {
  let coords = coordsIn && coordsIn.length ? coordsIn : (rutaGeom.value.length ? rutaGeom.value : (form.ruta && form.ruta.linea) || []);
  // Con la ruta completa la caseta queda sobre la línea (≤ 35 m); así no se cuentan peajes laterales de salidas que no se usan.
  const completa = coords.length > 600, umbral = completa ? 35 : 120;
  if (!coords.length) return;
  peajesEstado.value = 'buscando';
  try {
    // Consulta por rectángulo (liviana) y luego se filtra lo que queda a ≤ 150 m de la ruta
    let S = 90, W = 180, N = -90, E = -180;
    coords.forEach(c => { if (c[1] < S) S = c[1]; if (c[1] > N) N = c[1]; if (c[0] < W) W = c[0]; if (c[0] > E) E = c[0]; });
    const pad = 0.03, bb = `${(S - pad).toFixed(4)},${(W - pad).toFixed(4)},${(N + pad).toFixed(4)},${(E + pad).toFixed(4)}`;
    const q = `[out:json][timeout:60];(node["barrier"="toll_booth"](${bb});way["barrier"="toll_booth"](${bb});node["highway"="toll_gantry"](${bb}););out center tags;`;
    const j = await consultarOverpass(q);
    if (coords.length > 20000) coords = simplificar(coords, 20000);
    const pts = (j.elements || []).map(e => ({ id: e.id, lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon, nombre: (e.tags && (e.tags.name || e.tags['name:es'] || e.tags.operator)) || '', portico: e.tags?.highway === 'toll_gantry' }))
      .filter(x => x.lat != null && distARutaM([x.lng, x.lat], coords) <= umbral);
    // Agrupar las casetas de una misma plaza (ambos sentidos, varias vías) a menos de 1,5 km
    const plazas = [];
    pts.filter(x => !x.portico).forEach(x => { const g = plazas.find(p => distKm([p.lng, p.lat], [x.lng, x.lat]) < 1.5); if (g) { if (!g.nombre && x.nombre) g.nombre = x.nombre; } else plazas.push({ ...x }); });
    const porticos = []; pts.filter(x => x.portico).forEach(x => { if (!porticos.some(p => distKm([p.lng, p.lat], [x.lng, x.lat]) < 0.3)) porticos.push(x); });
    // Asociar cada plaza a un peaje del catálogo (por cercanía a sus coordenadas o por nombre); si no existe, crearlo sin tarifa
    plazas.forEach(pl => {
      let cat = params.peajes.find(p => p.lat != null && p.lng != null && distKm([p.lng, p.lat], [pl.lng, pl.lat]) < (p.red ? 5 : 2));
      const kn = llaveNombre(pl.nombre);
      if (!cat && kn) cat = params.peajes.find(p => { const kc = llaveNombre(p.nombre + ' ' + (p.buscar || '')); return kc && (kc.includes(kn) || kn.split(' ').some(w => w.length > 3 && kc.includes(w))); });
      if (!cat) {
        cat = { id: 'osm' + pl.id, buscar: '', lat: Math.round(pl.lat * 1e5) / 1e5, lng: Math.round(pl.lng * 1e5) / 1e5, nombre: pl.nombre ? 'Peaje ' + pl.nombre : 'Peaje sin nombre (OSM ' + pl.id + ')', ruta: 'Detectado en la ruta', auto: 0, c2: 0, c3: 0, estimado: true, nota: 'Detectado en OpenStreetMap: completar la tarifa de camión y guardar parámetros.', nuevo: true };
        params.peajes.push(cat);
      } else if (cat.lat == null) { cat.lat = Math.round(pl.lat * 1e5) / 1e5; cat.lng = Math.round(pl.lng * 1e5) / 1e5; }
      pl.idCatalogo = cat.id;
    });
    if (form.ruta) {
      form.ruta.peajesOSM = [...plazas.map(p => ({ nombre: p.nombre, lat: p.lat, lng: p.lng, idCatalogo: p.idCatalogo, tipo: 'plaza' })), ...porticos.map(p => ({ nombre: p.nombre, lat: p.lat, lng: p.lng, tipo: 'portico' }))];
      form.ruta.porticos = porticos.length;
      form.ruta.peajes = [...new Set([...(form.ruta.peajes || []), ...plazas.map(p => p.idCatalogo)])];
    }
    peajesEstado.value = 'ok';
  } catch (err) { peajesEstado.value = 'catalogo'; console.warn('[Calculadora] peajes OSM (se usa solo el catálogo FRC):', err); }
};
/** Peajes del catálogo que aparecieron en la ruta pero no tienen tarifa de camión. */
export const peajesSinTarifa = computed(() => {
  const ids = form.ruta?.peajes || []; const ejes = (params.tipos.find(t => t.tipo === form.tipo) || {}).ejes;
  return params.peajes.filter(p => ids.includes(p.id) && !num(ejes === '2' ? p.c2 : p.c3));
});
export const linkGoogleMaps = computed(() => {
  const r = form.ruta;
  const p = (x, t) => (x ? `${x.lat},${x.lng}` : encodeURIComponent(t || ''));
  if (!form.origen && !form.destino) return '';
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${p(r && r.origen, form.origen)}&destination=${p(r && r.destino, form.destino)}`;
});
// Distancia (km) de un punto a la ruta: se revisan los vértices de la línea (suficiente para un radio de ~1,5 km).
const distKm = (a, b) => { const R = 6371, toR = Math.PI / 180; const dLat = (b[1] - a[1]) * toR, dLng = (b[0] - a[0]) * toR; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
/** Peajes del catálogo por los que pasa la ruta: plazas troncales a ≤ 500 m de la línea (otros peajes con ubicación: ≤ 150 m). */
const detectarPeajes = (coords) => params.peajes.filter(p => {
  if (p.lat == null || p.lng == null || !coords.length) return false;
  const pt = [Number(p.lng), Number(p.lat)];
  if (!coords.some(c => distKm(c, pt) < 8)) return false;   // descarte rápido
  return distARutaM(pt, coords) <= (p.red ? 500 : 150);
}).map(p => p.id);
/** Vuelve a revisar los peajes del catálogo sobre la ruta actual (ej. después de agregar o ubicar un peaje). */
export const redetectarPeajes = () => {
  const coords = rutaGeom.value.length ? rutaGeom.value : (form.ruta && form.ruta.linea) || [];
  if (form.ruta && coords.length) form.ruta.peajes = [...new Set([...detectarPeajes(coords), ...((form.ruta.peajesOSM || []).map(p => p.idCatalogo).filter(Boolean))])];
};
/** Busca en el mapa la ubicación de un peaje (por su texto "buscar" o su nombre) y la guarda en Parámetros. */
export const ubicarPeaje = async (p) => {
  try { const c = await geocodificar(p.buscar || p.nombre); p.lat = Math.round(c.lat * 1e5) / 1e5; p.lng = Math.round(c.lng * 1e5) / 1e5; alert(`Ubicado: ${c.nombre}\n(${p.lat}, ${p.lng}). Revisa que sea el peaje correcto y guarda los parámetros.`); }
  catch (err) { alert('No se pudo ubicar: ' + (err.message || err) + '\nPuedes pegar la latitud y longitud a mano (clic derecho en Google Maps sobre el peaje).'); }
};

// ---------- Valores AUTOMÁTICOS y efectivos ----------
export const diasServicioBase = computed(() => form.modalidad === 'mes' ? Math.max(0, num(form.meses)) * 30 : Math.max(0, num(form.dias)));
export const auto = computed(() => {
  const t = tipoSel.value || {}, r = form.ruta, m = modeloSel.value;
  const kmIda = r ? r.km : null;
  const horasManejo = r ? Math.max(0, num(form.viajes)) * r.horas * (form.idaVuelta ? 2 : 1) * 1.25 : null;   // camión ~25% más lento que auto
  const dias = form.modalidad === 'flete' && horasManejo != null ? Math.max(1, Math.ceil(horasManejo / 9)) : null;   // jornada de 9 h de manejo
  return {
    kmIda, fKmIda: r ? `Ruta ${r.fuente} · ${fmtN(r.km, 1)} km · ${fmtN(r.horas, 1)} h en auto` : 'Calcula la ruta (botón) para obtener los km',
    dias, fDias: dias != null ? `${fmtN(horasManejo, 1)} h de manejo en camión ÷ 9 h por jornada` : 'Solo en flete y con ruta calculada',
    rend: m && num(m.rend) > 0 ? num(m.rend) : num(t.rend),
    fRend: m && num(m.rend) > 0 ? `${m.tipoFuente || 'Fuente'}: ${m.marca} ${m.modelo}` : `Referencial del tipo "${t.tipo}" (no hay ficha del modelo)`,
    linkRend: m && m.fuente ? m.fuente : '',
    diesel: num(params.precioDiesel), fDiesel: `Parámetros${params.actualizado ? ' (guardados el ' + params.actualizado + ')' : ''}`,
    peajesDetectados: r && r.peajes ? r.peajes : []
  };
});
const ef = (k, a) => (form.man[k] ? num(form[k]) : num(a));
export const efectivo = computed(() => {
  const a = auto.value;
  const kmIda = ef('kmIda', a.kmIda);
  const dias = form.modalidad === 'flete' ? ef('dias', a.dias != null ? a.dias : form.dias) : diasServicioBase.value;
  const rend = ef('rend', a.rend);
  const diesel = ef('diesel', a.diesel);
  const diasViatico = ef('diasViatico', form.conChofer ? dias : 0);
  const noches = ef('noches', form.conChofer && kmIda > 200 ? Math.max(0, dias - 1) : 0);
  return { kmIda, dias, rend, diesel, diasViatico, noches };
});
/** Pasar un campo a MANUAL (copia el valor automático para editarlo) o volver a AUTOMÁTICO. */
export const ponerAuto = (k, esAuto) => {
  if (!esAuto) { const v = efectivo.value[k] ?? 0; form[k] = Math.round(num(v) * 10) / 10; form.man[k] = true; }
  else form.man[k] = false;
};
export const pasadasSugeridas = computed(() => Math.max(0, num(form.viajes)) * (form.idaVuelta ? 2 : 1));
export const peajeAuto = (id) => auto.value.peajesDetectados.includes(id) ? pasadasSugeridas.value : 0;
export const pasadasDe = (id) => (form.peajeMan[id] ? num(form.peajes[id]) : peajeAuto(id));
export const ponerPeajeAuto = (id, esAuto) => { if (!esAuto) { form.peajes[id] = pasadasDe(id) || pasadasSugeridas.value; form.peajeMan[id] = true; } else form.peajeMan[id] = false; };
const tarifaPeaje = (p, ejes) => num(ejes === '2' ? p.c2 : p.c3);

/** Cálculo completo. Devuelve líneas por grupo + totales. */
export const resultado = computed(() => {
  const t = tipoSel.value || {};
  const E = efectivo.value;
  const dias = E.dias;
  const kmViajes = Math.max(0, num(form.viajes)) * E.kmIda * (form.idaVuelta ? 2 : 1);
  const kmFaena = dias * Math.max(0, num(form.kmFaenaDia));
  const km = kmViajes + kmFaena;
  const precio = E.diesel;
  const litrosRuta = E.rend > 0 ? km / E.rend : 0;
  const horasPluma = t.pluma ? dias * Math.max(0, num(form.horasPlumaDia)) : 0;
  const litrosPluma = horasPluma * num(t.consumoPlumaLh);
  const lineas = [];
  const add = (grupo, concepto, detalle, monto) => { monto = Math.round(num(monto)); if (monto) lineas.push({ grupo, concepto, detalle, monto }); };

  add('Combustible', 'Diésel en ruta', `${fmtN(km)} km ÷ ${fmtN(E.rend, 1)} km/L = ${fmtN(litrosRuta, 0)} L × $${fmtN(precio)}`, litrosRuta * precio);
  add('Combustible', 'Diésel operación pluma', `${fmtN(horasPluma, 1)} h × ${fmtN(t.consumoPlumaLh, 1)} L/h = ${fmtN(litrosPluma, 0)} L`, litrosPluma * precio);
  params.peajes.forEach(p => {
    const pas = pasadasDe(p.id); if (!pas) return;
    const tar = tarifaPeaje(p, t.ejes);
    add('Peajes', p.nombre || 'Peaje', `${pas} pasada(s) × $${fmtN(tar)} (${t.ejes === '2' ? '2 ejes' : '+2 ejes'})${p.estimado ? ' · tarifa estimada' : ''}`, pas * tar);
  });
  add('Peajes', 'TAG autopistas urbanas', 'monto estimado', form.tagUrbano);
  if (form.conChofer) {
    add('Chofer y personal', 'Chofer', `${fmtN(dias)} día(s) × $${fmtN(params.costoDiaChofer)}`, dias * num(params.costoDiaChofer));
    add('Chofer y personal', 'Horas extra', `${fmtN(form.horasExtra)} h × $${fmtN(params.valorHoraExtra)}`, num(form.horasExtra) * num(params.valorHoraExtra));
    add('Chofer y personal', 'Viático alimentación', `${fmtN(E.diasViatico)} día(s) × $${fmtN(params.viaticoDia)}`, E.diasViatico * num(params.viaticoDia));
    add('Chofer y personal', 'Alojamiento', `${fmtN(E.noches)} noche(s) × $${fmtN(params.alojamientoNoche)}`, E.noches * num(params.alojamientoNoche));
    add('Chofer y personal', 'Bono faena', `${fmtN(dias)} día(s) × $${fmtN(params.bonoFaenaDia)}`, dias * num(params.bonoFaenaDia));
  }
  if (form.conRigger) add('Chofer y personal', 'Rigger', `${fmtN(dias)} día(s) × $${fmtN(params.costoDiaRigger)}`, dias * num(params.costoDiaRigger));
  const neumKm = num(t.vidaNeumaticoKm) > 0 ? (num(t.neumaticos) * num(t.precioNeumatico)) / num(t.vidaNeumaticoKm) : 0;
  add('Uso del camión', 'Neumáticos', `${fmtN(km)} km × $${fmtN(neumKm, 1)}/km`, km * neumKm);
  add('Uso del camión', 'Mantención y lubricantes', `${fmtN(km)} km × $${fmtN(t.mantKm)}/km`, km * num(t.mantKm));
  const diasAnio = Math.max(1, num(params.diasOperativosAnio));
  const deprDia = num(t.vidaAnios) > 0 ? (num(t.valor) * (1 - num(t.residual) / 100)) / num(t.vidaAnios) / diasAnio : 0;
  const fijoDia = (num(t.seguroAnual) + num(t.permisosAnual)) / diasAnio + (num(t.gpsMes) * 12) / diasAnio;
  add('Uso del camión', 'Depreciación', `${fmtN(dias)} día(s) × $${fmtN(deprDia)}`, dias * deprDia);
  add('Uso del camión', 'Seguro, permisos, revisión y GPS', `${fmtN(dias)} día(s) × $${fmtN(fijoDia)}`, dias * fijoDia);
  add('Faena y acreditación', 'Acreditación', '', form.acreditacion);
  add('Faena y acreditación', 'Exámenes ocupacionales', '', form.examenes);
  add('Faena y acreditación', 'Inducción', '', form.induccion);
  add('Faena y acreditación', 'EPP', '', form.epp);
  add('Faena y acreditación', 'Otros de faena', '', form.otrosFaena);
  add('Otros', 'Permisos especiales (sobredimensión)', '', form.permisosEspeciales);
  add('Otros', 'Escolta / señalero', '', form.escolta);
  add('Otros', 'Lavado', '', form.lavado);
  add('Otros', 'Estacionamiento', '', form.estacionamiento);
  add('Otros', form.notaOtros || 'Otros', '', form.otros);

  const directo = lineas.reduce((s, l) => s + l.monto, 0);
  const pct = form.usarPctParams ? params : form;
  const imprevistos = Math.round(directo * num(pct.imprevistosPct) / 100);
  const costoTotal = directo + imprevistos;
  const gg = Math.round(costoTotal * num(pct.gastosGeneralesPct) / 100);
  const costoConGG = costoTotal + gg;
  const margen = Math.round(costoConGG * num(pct.margenPct) / 100);
  const neto = costoConGG + margen;
  const iva = Math.round(neto * num(params.ivaPct) / 100);
  const total = neto + iva;
  const grupos = {};
  lineas.forEach(l => { grupos[l.grupo] = (grupos[l.grupo] || 0) + l.monto; });
  const viajes = Math.max(0, num(form.viajes));
  return {
    lineas, grupos: Object.entries(grupos).map(([g, m]) => ({ g, m, pct: directo ? m / directo * 100 : 0 })).sort((a, b) => b.m - a.m),
    km, kmViajes, kmFaena, litros: litrosRuta + litrosPluma, dias, directo, imprevistos, costoTotal, gg, margen, neto, iva, total,
    porDia: dias ? Math.round(neto / dias) : null, porKm: km ? Math.round(neto / km) : null, porViaje: viajes ? Math.round(neto / viajes) : null,
    pcts: { imprevistos: num(pct.imprevistosPct), gg: num(pct.gastosGeneralesPct), margen: num(pct.margenPct), iva: num(params.ivaPct) }
  };
});

/** Tabla de supuestos: cada variable, su valor, si es automática o manual y de dónde sale (para revisar). */
export const supuestos = computed(() => {
  const a = auto.value, E = efectivo.value, M = form.man, r = form.ruta;
  const fila = (variable, valor, esAuto, fuente, link = '') => ({ variable, valor, origen: esAuto ? 'AUTOMÁTICO' : 'MANUAL', fuente: esAuto ? fuente : 'Escrito a mano en la cotización', link });
  return [
    fila('Km de ida por viaje', fmtN(E.kmIda, 1) + ' km', !M.kmIda, a.fKmIda, linkGoogleMaps.value),
    fila('Días de servicio', fmtN(E.dias), form.modalidad === 'flete' ? !M.dias : false, a.fDias),
    fila('Rendimiento', fmtN(E.rend, 1) + ' km/L', !M.rend, a.fRend, a.linkRend),
    fila('Precio diésel', '$' + fmtN(E.diesel) + '/L', !M.diesel, a.fDiesel),
    fila('Días con viático', fmtN(E.diasViatico), !M.diasViatico, 'Regla: un viático por día de servicio con chofer'),
    fila('Noches de alojamiento', fmtN(E.noches), !M.noches, 'Regla: si la ida supera 200 km, noches = días − 1'),
    ...params.peajes.filter(p => pasadasDe(p.id)).map(p => fila('Peaje ' + p.nombre, pasadasDe(p.id) + ' pasada(s)', !form.peajeMan[p.id], 'La ruta calculada pasa por la plaza (catálogo de peajes FRC)' + (p.estimado ? ' · tarifa estimada: ' + (p.nota || '') : ''))),
    ...(r ? [fila('Origen', r.origen?.nombre || form.origen, true, r.origen?.fuente || ''), fila('Destino', r.destino?.nombre || form.destino, true, r.destino?.fuente || '')] : [])
  ];
});

export const fmtN = (v, dec = 0) => Number(num(v)).toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const fmt$ = (v) => (v === null || v === undefined ? '—' : '$' + fmtN(Math.round(num(v))));

// ---------- Cotizaciones guardadas ----------
export const cotizaciones = ref([]);
export const faltaTabla = ref(false);
export const cargandoCot = ref(false);
export const cargarCotizaciones = async () => {
  cargandoCot.value = true;
  try {
    cotizaciones.value = (await sb(supabaseClient.from(TABLA_COTIZACIONES).select('*').order('created_at', { ascending: false }).limit(500))) || [];
    faltaTabla.value = false;
  } catch (e) { faltaTabla.value = true; cotizaciones.value = []; }
  finally { cargandoCot.value = false; }
};
export const guardarCotizacion = async () => {
  if (!soloAdminGeneral()) return;
  if (!String(form.nombre || '').trim()) return alert('Ponle un nombre a la cotización (ej. "Traslado generador a Colón Alto").');
  const r = resultado.value;
  const fila = {
    tipo_calculo: 'CAMION', nombre: form.nombre.trim(), cliente: (form.cliente || '').trim() || null, fecha: form.fecha || hoyISO(),
    afi: form.afi || null, tipo_vehiculo: form.tipo, modalidad: form.modalidad,
    datos: JSON.parse(JSON.stringify(form)), parametros: JSON.parse(JSON.stringify({ efectivo: efectivo.value, supuestos: supuestos.value, tipo: tipoSel.value, modelo: modeloSel.value })),
    costo_total: r.costoTotal, neto: r.neto, total: r.total, usuario: quien()
  };
  try {
    if (form.id) await sb(supabaseClient.from(TABLA_COTIZACIONES).update(fila).eq('id', form.id));
    else { const res = await sb(supabaseClient.from(TABLA_COTIZACIONES).insert([fila]).select('id')); if (res && res[0]) form.id = res[0].id; }
    await cargarCotizaciones();
    alert('Cotización guardada.');
  } catch (err) { alert('No se pudo guardar (¿ejecutaste sql/cotizaciones_arriendo.sql?): ' + errMsg(err)); }
};
// Cotizaciones antiguas (sin "man"): sus valores se tratan como MANUALES para no cambiar el resultado.
const datosDe = (c) => { const d = JSON.parse(JSON.stringify(c.datos || {})); if (!d.man) d.man = { kmIda: true, dias: true, rend: false, diesel: false, diasViatico: true, noches: true }; if (!d.peajeMan) { d.peajeMan = {}; Object.keys(d.peajes || {}).forEach(k => { d.peajeMan[k] = true; }); } return d; };
export const abrirCotizacion = (c) => { Object.assign(form, formVacio(), datosDe(c), { id: c.id }); rutaGeom.value = []; rutaEstado.value = form.ruta ? 'ok' : ''; window.scrollTo({ top: 0, behavior: 'smooth' }); };
export const duplicarCotizacion = (c) => { Object.assign(form, formVacio(), datosDe(c), { id: null, nombre: (c.nombre || '') + ' (copia)', fecha: hoyISO() }); rutaGeom.value = []; rutaEstado.value = form.ruta ? 'ok' : ''; window.scrollTo({ top: 0, behavior: 'smooth' }); };
export const eliminarCotizacion = async (c) => {
  if (!soloAdminGeneral()) return;
  if (!confirm(`¿Eliminar la cotización "${c.nombre}"?`)) return;
  try { await sb(supabaseClient.from(TABLA_COTIZACIONES).delete().eq('id', c.id)); if (form.id === c.id) form.id = null; await cargarCotizaciones(); }
  catch (err) { alert('No se pudo eliminar: ' + errMsg(err)); }
};

// ---------- Exportar a Excel (con formato FRC) ----------
export const exportando = ref(false);
export const exportarCotizacionExcel = async () => {
  if (!soloAdminGeneral()) return;
  exportando.value = true;
  try {
    const { nuevoLibro, hojaTabla, descargarLibro } = await import('../../core/excel.js');
    const { wb, logo } = await nuevoLibro();
    const r = resultado.value;
    const mod = (MODALIDADES.find(m => m.k === form.modalidad) || {}).l || form.modalidad;
    const sub = [form.nombre || 'Cotización', form.cliente, form.tipo, mod, form.origen && form.destino ? `${form.origen} → ${form.destino}` : ''].filter(Boolean).join(' · ');
    const filas = r.lineas.map(l => [l.grupo, l.concepto, l.detalle, l.monto]);
    const tot = (c, m) => ['', c, '', m];
    filas.push(tot('COSTO DIRECTO', r.directo));
    filas.push(tot(`Imprevistos (${r.pcts.imprevistos}%)`, r.imprevistos));
    filas.push(tot(`Gastos generales (${r.pcts.gg}%)`, r.gg));
    filas.push(tot(`Margen (${r.pcts.margen}%)`, r.margen));
    filas.push(tot('PRECIO NETO', r.neto));
    filas.push(tot(`IVA (${r.pcts.iva}%)`, r.iva));
    const ws = hojaTabla(wb, logo, {
      nombre: 'Cotización', titulo: 'CALCULADORA DE ARRIENDO · CAMIÓN', subtitulo: sub,
      columnas: [{ t: 'Ítem', w: 22, al: 'left' }, { t: 'Concepto', w: 34, al: 'left' }, { t: 'Detalle del cálculo', w: 58, al: 'left' }, { t: 'Monto ($)', w: 16, fmt: '#,##0', al: 'right' }],
      filas, totales: ['', 'TOTAL CON IVA', `${fmtN(r.km)} km · ${fmtN(r.dias)} día(s) · ${fmtN(r.litros)} L diésel`, r.total],
      estiloFila: (v) => (v[0] === '' ? { font: { bold: true } , fill: 'FFE8F5EC' } : null), apaisado: false
    });
    ws.autoFilter = undefined;
    hojaTabla(wb, logo, {
      nombre: 'Supuestos y fuentes', titulo: 'SUPUESTOS Y FUENTES DEL CÁLCULO', subtitulo: sub,
      columnas: [{ t: 'Variable', w: 30, al: 'left' }, { t: 'Valor', w: 22, al: 'left' }, { t: 'Origen', w: 14 }, { t: 'Fuente / regla', w: 60, al: 'left' }, { t: 'Link', w: 40, al: 'left' }],
      filas: supuestos.value.map(x => [x.variable, x.valor, x.origen, x.fuente, x.link || '']), apaisado: true
    });
    const t = tipoSel.value || {}, ej2 = t.ejes === '2';
    const pj = params.peajes.filter(p => pasadasDe(p.id));
    hojaTabla(wb, logo, {
      nombre: 'Peajes', titulo: 'PEAJES EN LA RUTA · ' + (ej2 ? 'CAMIÓN 2 EJES' : 'CAMIÓN MÁS DE 2 EJES'), subtitulo: sub,
      columnas: [{ t: 'Plaza de peaje', w: 36, al: 'left' }, { t: 'Ruta', w: 40, al: 'left' }, { t: 'Tarifa ($)', w: 13, fmt: '#,##0', al: 'right' }, { t: 'Pasadas', w: 10 }, { t: 'Subtotal ($)', w: 15, fmt: '#,##0', al: 'right' }, { t: 'Origen', w: 13 }, { t: 'Fuente de la tarifa', w: 60, al: 'left' }],
      filas: pj.map(p => { const tar = num(ej2 ? p.c2 : p.c3), pas = pasadasDe(p.id); return [p.nombre, p.ruta, tar, pas, tar * pas, form.peajeMan[p.id] ? 'MANUAL' : 'AUTOMÁTICO', (p.estimado ? 'ESTIMADO · ' : '') + (p.nota || '')]; }),
      totales: ['TOTAL PEAJES', '', '', '', pj.reduce((s, p) => s + num(ej2 ? p.c2 : p.c3) * pasadasDe(p.id), 0), '', ''], apaisado: true
    });
    const fecha = (form.fecha || hoyISO()).replace(/-/g, '');
    await descargarLibro(wb, `Cotizacion_Camion_${(form.nombre || 'FRC').replace(/[^A-Za-z0-9]+/g, '_')}_${fecha}.xlsx`);
  } catch (err) { alert('No se pudo exportar: ' + errMsg(err)); }
  finally { exportando.value = false; }
};
