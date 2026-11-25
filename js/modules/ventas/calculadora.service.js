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
export const PEAJES_DEFAULT = () => ([
  { id: 'angostura', buscar: 'Plaza de Peaje Angostura, Paine', lat: null, lng: null, nombre: 'Angostura · troncal Ruta 5 Sur', ruta: 'Santiago – Rancagua (Ruta del Maipo)', auto: 3800, c2: 6840, c3: 12160, estimado: true, nota: 'Auto 2026: $3.800 (MOP). Camión = auto × 1,8 / × 3,2 (estimado).' },
  { id: 'lateral', buscar: '', lat: null, lng: null, nombre: 'Lateral Ruta 5 Sur (salida/entrada)', ruta: 'Ej. enlaces Rancagua, San Fernando', auto: 900, c2: 1620, c3: 2880, estimado: true, nota: 'Auto 2026: $900. Camión estimado.' },
  { id: 'vespucio', buscar: '', lat: null, lng: null, nombre: 'Pórtico Américo Vespucio – Ruta 78', ruta: 'Santiago (autopista urbana)', auto: 0, c2: 1436, c3: 2585, estimado: true, nota: 'Camión 2 ejes 2026: $1.436 normal / $2.872 punta. >2 ejes estimado.' },
  { id: 'riomaipo', buscar: 'Peaje Río Maipo', lat: null, lng: null, nombre: 'Río Maipo · troncal', ruta: 'Acceso Sur a Santiago', auto: 1320, c2: 2380, c3: 4220, estimado: true, nota: 'Valor auto 2025. Verificar tarifa 2026 y si aplica a la ruta.' }
]);
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
  origen: '', destino: '', kmIda: 0, idaVuelta: true, viajes: 1,
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
export const CIUDADES = ['Santiago', 'Rancagua', 'Machalí', 'Coya', 'San Fernando', 'Talca', 'Curicó', 'Graneros', 'Codegua', 'Mostazal', 'San Bernardo', 'Buin', 'Paine', 'Melipilla', 'Valparaíso', 'San Antonio', 'Los Andes', 'Calama', 'Antofagasta', 'Copiapó', 'La Serena', 'Concepción'];
/** Coordenadas desde texto: "lat,lng", link de Google Maps (@lat,lng o !3dlat!4dlng) o lugar de Áreas. */
const coordDeTexto = (t) => {
  const s = String(t || '');
  const lug = lugaresConCoord.value.find(l => l.nombre === s.trim());
  if (lug) return { lat: lug.lat, lng: lug.lng, nombre: lug.nombre, fuente: 'Áreas FRC' };
  let m = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) || s.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) || s.match(/^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
  if (m) return { lat: Number(m[1]), lng: Number(m[2]), nombre: s.trim(), fuente: 'coordenadas' };
  return null;
};
const geocodificar = async (texto) => {
  const c = coordDeTexto(texto); if (c) return c;
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cl&accept-language=es&q=' + encodeURIComponent(texto);
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('buscador de lugares no responde (' + r.status + ')');
  const j = await r.json();
  if (!j.length) throw new Error(`no se encontró "${texto}". Escribe la ciudad o comuna, pega un link de Google Maps o usa un lugar de Áreas con coordenadas.`);
  return { lat: Number(j[0].lat), lng: Number(j[0].lon), nombre: j[0].display_name, fuente: 'OpenStreetMap' };
};
export const calcularRuta = async () => {
  if (!String(form.origen).trim() || !String(form.destino).trim()) { rutaError.value = 'Escribe origen y destino.'; rutaEstado.value = 'error'; return; }
  rutaEstado.value = 'calculando'; rutaError.value = '';
  try {
    const o = await geocodificar(form.origen);
    await new Promise(res => setTimeout(res, 1100));   // Nominatim: máximo 1 consulta por segundo
    const d = await geocodificar(form.destino);
    const url = `https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('el servicio de rutas no responde (' + r.status + ')');
    const j = await r.json();
    if (j.code !== 'Ok' || !j.routes || !j.routes.length) throw new Error('no se encontró una ruta por camino entre esos puntos.');
    const ruta = j.routes[0];
    rutaGeom.value = ruta.geometry.coordinates;
    form.ruta = { km: Math.round(ruta.distance / 100) / 10, horas: Math.round(ruta.duration / 360) / 10, origen: o, destino: d, fuente: 'OpenStreetMap (OSRM)', fecha: hoyISO(), peajes: detectarPeajes(ruta.geometry.coordinates) };
    rutaEstado.value = 'ok';
  } catch (err) { rutaEstado.value = 'error'; rutaError.value = 'No se pudo calcular la ruta: ' + (err.message || err); }
};
export const linkGoogleMaps = computed(() => {
  const r = form.ruta;
  const p = (x, t) => (x ? `${x.lat},${x.lng}` : encodeURIComponent(t || ''));
  if (!form.origen && !form.destino) return '';
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${p(r && r.origen, form.origen)}&destination=${p(r && r.destino, form.destino)}`;
});
// Distancia (km) de un punto a la ruta: se revisan los vértices de la línea (suficiente para un radio de ~1,5 km).
const distKm = (a, b) => { const R = 6371, toR = Math.PI / 180; const dLat = (b[1] - a[1]) * toR, dLng = (b[0] - a[0]) * toR; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const detectarPeajes = (coords) => params.peajes.filter(p => p.lat != null && p.lng != null && coords.some(c => distKm(c, [p.lng, p.lat]) < 1.5)).map(p => p.id);
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
    ...params.peajes.filter(p => pasadasDe(p.id)).map(p => fila('Peaje ' + p.nombre, pasadasDe(p.id) + ' pasada(s)', !form.peajeMan[p.id], 'Detectado en la ruta (a menos de 1,5 km del peaje)' + (p.estimado ? ' · tarifa estimada: ' + (p.nota || '') : ''))),
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
    const fecha = (form.fecha || hoyISO()).replace(/-/g, '');
    await descargarLibro(wb, `Cotizacion_Camion_${(form.nombre || 'FRC').replace(/[^A-Za-z0-9]+/g, '_')}_${fecha}.xlsx`);
  } catch (err) { alert('No se pudo exportar: ' + errMsg(err)); }
  finally { exportando.value = false; }
};
