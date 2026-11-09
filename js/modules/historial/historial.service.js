// =====================================================================
// HISTORIAL · Lógica (filtros, formulario de mantención, adjuntos, importación)
// =====================================================================
import { supabaseClient, sb, errMsg, subirArchivoStorage } from '../../core/supabase.js';
import { dbEquipos, dbIntervenciones, cargarDatosDesdeSupabase, buscarEquipoPorAfi, recalcularHorometros, soloAdmin, soloEditor } from '../../core/store.js';
import { parseNum, parseStr, formatExcelDate, formatIsoDateForSupabase, parseIsoDate, limpiarAfi, mismoAfi, hoyISO, calcularRestaHoras, getVal, parseFileAnyFormat, resetInputFile } from '../../core/utils.js';
import { TABLA_HISTORIAL, ACEITES, aceitesVacios, COL_FILTROS_ESCRITURA } from './historial.mapper.js';
import { TABLA_INVENTARIO } from '../inventario/inventario.mapper.js';
import { registrarFiltrosDesdeMantencion, requeridosPorModelo, autocompletarFiltro } from '../filtros/filtros.service.js';
import { sincronizarProgramaConHistorial } from '../programas/programas.service.js';
import { leerDocumento, resumenLectura, avisoVariasHojas } from '../../core/ocr-documentos.js';
import { leerNombre } from './carga-documentos.service.js';
import { ocsDeTexto } from '../oc/oc.mapper.js';

const { ref, computed } = Vue;

export const listaCausas = [
  "FALLA MECANICA", "FALLA ELECTRICA", "INSPECCION", "REPARACION", "ESTANDARIZACION",
  "DAÑO OPERACIÓN", "PUESTA EN MARCHA", "IMPLEMENTACION", "PRUEBAS MEDICIONES", "CHECK LIST",
  "FALLA CONDICION", "MANTENCION", "MANTENCION INTERMEDIA", "SERVICIO", "COMPRA",
  "RETIRO", "CONEXIÓN/DESCONEXION", "FALLA OPERACIONAL", "INSPECCION (ELECTRICA)"
];

// ---------- Filtros ----------
const FILTRO_INT_DEFAULT = () => ({ searchQuery: "", dateStart: "", dateEnd: "", afi: "ALL", programa: "ALL", tipoMant: "ALL", causa: "ALL", mecText: "" });
export const filterInt = ref(FILTRO_INT_DEFAULT());
export const sortHistorialOrder = ref("desc");
export const limpiarFiltrosHistorial = () => { filterInt.value = FILTRO_INT_DEFAULT(); };

const up = (v) => String(v || '').trim().toUpperCase();

export const filteredIntervenciones = computed(() => {
  const f = filterInt.value;
  const q = f.searchQuery.toLowerCase();
  const arr = dbIntervenciones.value.filter(i => {
    if (f.afi !== "ALL" && !mismoAfi(i.afi, f.afi)) return false;
    if (f.programa !== "ALL" && up(i.programaCorrespondiente) !== up(f.programa)) return false;
    // "PREVENTIVA" debe incluir "PREVENTIVA 250 HRS", "PREVENTIVA 500 HRS", etc. (antes exigía coincidencia exacta)
    if (f.tipoMant !== "ALL" && !up(i.tipoMant).includes(up(f.tipoMant))) return false;
    if (f.causa !== "ALL" && up(i.causa) !== up(f.causa)) return false;
    const fStr = formatExcelDate(i.fecha);
    if (f.dateStart && fStr !== '-' && fStr < f.dateStart) return false;
    if (f.dateEnd && fStr !== '-' && fStr > f.dateEnd) return false;
    if (q && ![i.afi, i.equipo, i.lugar, i.causa, i.tipoMant, i.descripcion, i.numeroOC, i.numeroOT].join(" ").toLowerCase().includes(q)) return false;
    return true;
  });
  return arr.sort((a, b) => sortHistorialOrder.value === 'desc' ? parseIsoDate(b.fecha) - parseIsoDate(a.fecha) : parseIsoDate(a.fecha) - parseIsoDate(b.fecha));
});

// ---------- Columnas nuevas del documento (ART, folio, causa de la falla) ----------
// Si todavía no se ejecutó sql/historial_documentos.sql, se guarda sin ellas y se avisa (no se pierde el registro).
const COLS_DOCUMENTO = (f) => ({ art: parseStr(f.usoArt), numero_folio: parseStr(f.numeroFolio), causa_falla: parseStr(f.causaFalla) });
let avisoSqlDocs = false;
const guardarConRespaldo = async (payload, op) => {
  try { await sb(op(payload)); }
  catch (err) {
    if (!/'(art|numero_folio|causa_falla)' column|column \S*(art|numero_folio|causa_falla)\b/i.test(errMsg(err))) throw err;
    const p = { ...payload }; delete p.art; delete p.numero_folio; delete p.causa_falla;
    await sb(op(p));
    if (!avisoSqlDocs) { avisoSqlDocs = true; alert('Guardado. OJO: falta ejecutar sql/historial_documentos.sql en Supabase para guardar ART, N° folio y causa de la falla.'); }
  }
};

// ---------- Formulario de mantención ----------
const FORM_MANT_DEFAULT = (afiInicial = "") => ({
  id: null, afi: afiInicial || (dbEquipos.value.length > 0 ? dbEquipos.value[0].afi : ""),
  fecha: hoyISO(), lugar: "", causa: "MANTENCION", tipoMant: "PREVENTIVA 250 HRS", tipoHorasMant: "250 hrs", horometro: "",
  programaCorrespondiente: "", horaInicio: "", horaTermino: "", linkDrive: "",
  mec1: "", mec2: "", mec3: "", mec4: "", causaDetallada: "", descripcion: "", interferencia: "", empresaArriendo: "", costo: 0, numeroOC: "", numeroOT: "",
  usoArt: "", bloqueo: "", horaFalla: "", numeroFolio: "", causaFalla: "",
  filtrosLista: [],
  ...aceitesVacios()
});

export const showFormMantencionModal = ref(false);
export const isEditingMantencion = ref(false);
export const formMant = ref(FORM_MANT_DEFAULT());

export const abrirFormularioNuevaMantencion = (afiInicial = "") => {
  isEditingMantencion.value = false;
  formMant.value = FORM_MANT_DEFAULT(typeof afiInicial === 'string' ? afiInicial : "");
  lecturaForm.value = { estado: '', resumen: '', cambios: [], avisos: [] };
  showFormMantencionModal.value = true;
};

export const editarMantencion = (item) => {
  isEditingMantencion.value = true;
  formMant.value = JSON.parse(JSON.stringify(item));
  if (!formMant.value.filtrosLista) formMant.value.filtrosLista = [];
  lecturaForm.value = { estado: '', resumen: '', cambios: [], avisos: [] };
  showFormMantencionModal.value = true;
};

export const agregarFilaFiltro = () => { formMant.value.filtrosLista.push({ tipo: "", marca: "", codigo: "", proveedor: "", precio: "", cantidad: 1 }); };
export const eliminarFilaFiltro = (index) => { formMant.value.filtrosLista.splice(index, 1); };

// ---------- Filtros del modelo (vienen del módulo FILTROS) ----------
/** Equipo seleccionado en el formulario (para saber su marca / modelo). */
export const equipoFormMant = computed(() => buscarEquipoPorAfi(formMant.value.afi) || null);

/** Filtros que usa "sí o sí" el modelo del equipo seleccionado (según el módulo Filtros). */
export const filtrosRequeridosFormMant = computed(() => {
  const eq = equipoFormMant.value;
  return eq ? requeridosPorModelo(eq.marca, eq.modelo) : [];
});

/** Agrega al registro los filtros que usa el modelo (opción más barata de cada tipo, con su cantidad). */
export const cargarFiltrosDelModelo = () => {
  const reqs = filtrosRequeridosFormMant.value;
  if (!reqs.length) return alert("Este modelo aún no tiene filtros registrados en el módulo Filtros.");
  const lista = formMant.value.filtrosLista;
  const tiposYa = new Set(lista.map(f => String(f.tipo || '').trim().toUpperCase()));
  reqs.forEach(t => {
    if (tiposYa.has(t.tipo)) return;
    const op = t.mejor || t.filas[0];
    lista.push({ tipo: t.tipo, marca: op.marca, codigo: op.codigo, proveedor: op.proveedor, precio: op.precio || "", cantidad: t.cantidad });
  });
};

/** Al escribir un código conocido, completa marca / tipo / precio. */
export const autocompletarFilaFiltro = (f, campo = 'codigo') => autocompletarFiltro(f, equipoFormMant.value, campo);

/** "PREVENTIVA 500 HRS" -> "500 hrs". Antes este campo quedaba siempre en "250 hrs". */
const derivarTipoHoras = (tipoMant, actual) => {
  const m = String(tipoMant || '').match(/(\d+)\s*HRS/i);
  return m ? `${m[1]} hrs` : (isEditingMantencion.value ? parseStr(actual) : "");
};

// ---------- Adjuntar documento (y leerlo) ----------
export const leerAlAdjuntar = ref(true);
export const CAUSAS_FALLA_HOJA = ['FALLA MECANICA', 'FALLA OPERACIONAL', 'ACCIDENTE', 'CONDICION DE LA OPERACION'];
export const lecturaForm = ref({ estado: '', resumen: '', cambios: [], avisos: [] });

/** Rellena el formulario SOLO en campos vacíos con lo que se pudo leer del documento. */
const aplicarLecturaAlForm = (r, file) => {
  const f = formMant.value, cambios = [], avisos = [];
  const nuevo = !isEditingMantencion.value;
  if (nuevo) {
    const n = leerNombre(file);
    if (n.afis[0] && n.afis[0] !== f.afi) { f.afi = n.afis[0]; cambios.push('AFI ' + n.afis[0] + ' (del nombre)'); }
    if (n.fechas[0] && n.fechas[0] !== f.fecha) { f.fecha = n.fechas[0]; cambios.push('fecha (del nombre)'); }
  }
  if (r.folio && !f.numeroFolio) { f.numeroFolio = r.folio; cambios.push('N° folio ' + r.folio); }
  if (r.art && !f.usoArt) { f.usoArt = 'SI'; cambios.push('Uso de ART = SI'); }
  (r.ocs || []).forEach(oc => {
    if (oc.numero && !ocsDeTexto(f.numeroOC).includes(oc.numero)) { f.numeroOC = [f.numeroOC, oc.numero].filter(Boolean).join(', '); cambios.push('OC ' + oc.numero); }
  });
  const varias = avisoVariasHojas(r); if (varias) avisos.push(varias);
  if (r.tipo === 'INTERVENCION') {
    if (nuevo && f.causa === 'MANTENCION' && f.tipoMant === 'PREVENTIVA 250 HRS') {
      f.causa = ''; f.tipoMant = ''; f.tipoHorasMant = ''; cambios.push('es INTERVENCIÓN → elige la causa');
    } else if (/MANTENCION/.test(up(f.causa))) avisos.push('La hoja es una INTERVENCIÓN, pero la causa dice MANTENCIÓN. Revísalo.');
  }
  if (r.tipo === 'PAUTA' && f.causa && !/MANTENCION/.test(up(f.causa)) && !/CORRECTIVA/.test(up(f.tipoMant)))
    avisos.push('La hoja es una PAUTA de mantención (si se usó para una intervención, deja la causa como está).');
  if (r.equipoPauta) { const eq = buscarEquipoPorAfi(f.afi); if (eq && !up(eq.tipo).includes(r.equipoPauta.split(' ')[0])) avisos.push(`La pauta es de ${r.equipoPauta} y el AFI ${f.afi} es ${eq.tipo}.`); }
  return { cambios, avisos };
};

export const subirArchivoHistorial = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  lecturaForm.value = { estado: '', resumen: '', cambios: [], avisos: [] };
  // Se lee en paralelo mientras se sube
  const lectura = leerAlAdjuntar.value
    ? leerDocumento(file, (m) => { lecturaForm.value.estado = m; })
        .then(r => { const a = aplicarLecturaAlForm(r, file); lecturaForm.value = { estado: '', resumen: resumenLectura(r), ...a }; })
        .catch(err => { console.warn('[Lectura]', err); lecturaForm.value = { estado: '', resumen: 'No se pudo leer: ' + errMsg(err), cambios: [], avisos: [] }; })
    : Promise.resolve();
  try {
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    formMant.value.linkDrive = await subirArchivoStorage(fileName, file);
  } catch (err) {
    alert("Error al subir el archivo: " + errMsg(err));
  } finally { resetInputFile(e); }
  await lectura;
};

export const guardarMantencionForm = async () => {
  if (!soloEditor()) return;
  const f = formMant.value;
  if (!f.afi || !f.fecha) return alert("Por favor selecciona al menos el AFI y la Fecha.");

  const afiLimpio = limpiarAfi(f.afi);
  const equipoObj = buscarEquipoPorAfi(afiLimpio);
  const filtrosValidos = (f.filtrosLista || [])
    .filter(x => x && (x.tipo || x.marca || x.codigo))
    .map(x => ({
      tipo: parseStr(x.tipo).toUpperCase(), marca: parseStr(x.marca).toUpperCase(), codigo: parseStr(x.codigo).toUpperCase(),
      proveedor: parseStr(x.proveedor).toUpperCase(), precio: parseNum(x.precio), cantidad: parseNum(x.cantidad) || 1
    }));

  const payload = {
    afi: afiLimpio,
    fecha: formatIsoDateForSupabase(f.fecha),
    equipo: parseStr(equipoObj?.tipo),
    lugar: parseStr(f.lugar),
    tipo_documento: "MANTENCION",
    tipo_horas_mantencion: derivarTipoHoras(f.tipoMant, f.tipoHorasMant),
    horometro: parseNum(f.horometro),
    mecanico_1: parseStr(f.mec1), mecanico_2: parseStr(f.mec2), mecanico_3: parseStr(f.mec3), mecanico_4: parseStr(f.mec4),
    uso_de_art: parseStr(f.programaCorrespondiente),
    bloqueo_de_equipo: parseStr(f.bloqueo),
    hora_falla: parseStr(f.horaFalla),
    hora_inicio: parseStr(f.horaInicio),
    hora_termino: parseStr(f.horaTermino),
    hora_total: parseStr(calcularRestaHoras(f.horaInicio, f.horaTermino)),
    causa_intervencion: parseStr(f.causaDetallada),
    descripcion: parseStr(f.descripcion),
    interferencia: parseStr(f.interferencia),
    empresa: parseStr(f.empresaArriendo),
    link: parseStr(f.linkDrive),
    [COL_FILTROS_ESCRITURA]: filtrosValidos.length > 0 ? JSON.stringify(filtrosValidos) : "",
    costo: parseNum(f.costo),
    numero_oc: parseStr(f.numeroOC),
    numero_ot: parseStr(f.numeroOT),
    causa: parseStr(f.causa),
    tipo_mantencion: parseStr(f.tipoMant),
    ...COLS_DOCUMENTO(f)
  };
  ACEITES.forEach(a => { payload[a.col] = parseNum(f[a.key]); });

  // 1) Guardar el registro del historial
  try {
    if (isEditingMantencion.value && f.id) {
      await guardarConRespaldo(payload, (p) => supabaseClient.from(TABLA_HISTORIAL).update(p).eq('id', f.id));
    } else {
      await guardarConRespaldo(payload, (p) => supabaseClient.from(TABLA_HISTORIAL).insert([p]));
    }
  } catch (err) {
    console.error("Error detallado Supabase:", err);
    return alert("Error al guardar en Supabase: " + errMsg(err));
  }

  // 2) Registrar los filtros en el módulo FILTROS (catálogo por marca/modelo, precios y referencias cruzadas)
  let aviso = await registrarFiltrosDesdeMantencion(equipoObj, filtrosValidos, payload.fecha, afiLimpio);

  // 3) (2026-11-06) Ya NO se copia el horómetro de la mantención al "Último horómetro tomado (manual)"
  //    del equipo: ese dato solo lo cambia el usuario desde el Perfil (botón Actualizar horómetro).
  //    El cálculo de horómetros igual considera el historial (core/horometros.js).

  await cargarDatosDesdeSupabase();

  // 4) Enlace con el Programa declarado: marca REALIZADO el ítem del equipo
  //    (si el equipo está varias veces en el programa: la 1ª mantención → fecha más baja, la 2ª → la siguiente…)
  if (payload.uso_de_art) {
    try {
      const { marcados, avisos } = await sincronizarProgramaConHistorial({ nombrePrograma: payload.uso_de_art, afi: afiLimpio });
      if (marcados) aviso += `\n✔ Programa "${payload.uso_de_art}": AFI ${afiLimpio} marcado como REALIZADO.`;
      if (avisos.length) aviso += '\n' + avisos.join('\n');
    } catch (err) {
      aviso += "\n(Atención: no se pudo actualizar el programa: " + errMsg(err) + ")";
    }
  }

  showFormMantencionModal.value = false;
  alert("¡Mantención guardada con éxito!" + aviso);
};

export const eliminarMantencion = async (id) => {
  if (!soloAdmin()) return;
  if (!confirm("¿Eliminar registro?")) return;
  try {
    await sb(supabaseClient.from(TABLA_HISTORIAL).delete().eq('id', id));
    dbIntervenciones.value = dbIntervenciones.value.filter(i => i.id !== id);
    recalcularHorometros();
  } catch (err) {
    alert("Error al eliminar: " + errMsg(err));
  }
};

// ---------- Importación desde Excel ----------
export const importarIntervencionesFile = async (e) => {
  if (!soloAdmin()) return;
  const file = e.target.files[0]; if (!file) return;
  try {
    const rows = await parseFileAnyFormat(file);
    const payloads = rows.map(item => ({
      afi: limpiarAfi(getVal(item, "afi")),
      fecha: formatIsoDateForSupabase(getVal(item, "fecha")),
      equipo: parseStr(getVal(item, "equipo")),
      lugar: parseStr(getVal(item, "lugar")),
      causa: parseStr(getVal(item, "causa")),
      tipo_mantencion: parseStr(getVal(item, "tipo mantencion")),
      horometro: parseNum(getVal(item, "horometro")),
      costo: parseNum(getVal(item, "costo")),
      numero_oc: parseStr(getVal(item, "oc")),
      numero_ot: parseStr(getVal(item, "ot"))
    })).filter(i => i.afi);
    if (!payloads.length) return alert("El archivo no tiene filas con AFI.");
    await sb(supabaseClient.from(TABLA_HISTORIAL).insert(payloads));
    await cargarDatosDesdeSupabase();
    alert(`¡Importados ${payloads.length} registros de historial!`);
  } catch (err) {
    alert("Error al importar historial: " + errMsg(err));
  } finally { resetInputFile(e); }
};
