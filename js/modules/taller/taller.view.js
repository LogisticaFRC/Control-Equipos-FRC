// =====================================================================
// TALLER · Componente (naves grandes con foto + avance, ingreso/salida, OT para mecánicos)
// =====================================================================
import template from './taller.template.js';
import { comunes } from '../../core/comunes.js';
import * as S from './taller.service.js';
import { folioSugerido, imprimirOT, irAOT, ESTILO_ESTADO_OT, estadoOT, N_ACTIVIDADES } from '../ot/ot.service.js';
import { cargarDatosDesdeSupabase } from '../../core/store.js';
import { formatDateForDisplay } from '../../core/utils.js';

const { ref, computed, onMounted, onBeforeUnmount } = Vue;

/** Cada cuánto se refresca la pantalla del taller (otros PC / celulares pueden estar actualizando). */
const REFRESCO_MS = 45 * 1000;

export default {
  name: 'TallerView',
  template,
  setup() {
    // ---------- Modales ----------
    const naveIngreso = ref(null);          // nave vacía donde se va a ingresar un equipo
    const afiNuevo = ref('');               // "Equipo nuevo (agregar a nave)"
    const repTrabajo = ref(null);           // reparación abierta en "Reparar" (OT + actividades)
    const otSel = ref(null);                // OT seleccionada dentro de "Reparar"
    const nuevaAct = ref({ descripcion: '', ejecutante: '' });
    const formOT = ref({ folio: '', tipo: 'CORRECTIVA', mecanico: '' });
    const repSalida = ref(null);            // reparación que se está sacando de la nave
    const formSalida = ref({ reparado: null, faltante: '', agregarAOT: true });
    const afiSinProg = ref('');             // agregar a "Equipos reparación sin programa"
    const naveDestino = ref({});            // rep.id → nave elegida en las listas laterales
    const ocupado = ref(false);
    const nuevoProblema = ref('');           // "Enviar nuevo problema para OT"
    const textoProblema = ref({});           // Admin: texto corregido antes de agregarlo a la OT
    const pantallaCompleta = ref(Boolean(document.fullscreenElement));

    const hayModal = computed(() => Boolean(naveIngreso.value || repTrabajo.value || repSalida.value));

    // ---------- Refresco automático (se pausa con un modal abierto) ----------
    let timer = null;
    onMounted(async () => {
      await S.recargarTaller();
      timer = setInterval(() => { if (!hayModal.value && !document.hidden) S.recargarTaller(); }, REFRESCO_MS);
      document.addEventListener('fullscreenchange', onFs);
    });
    onBeforeUnmount(() => { clearInterval(timer); document.removeEventListener('fullscreenchange', onFs); });
    const onFs = () => { pantallaCompleta.value = Boolean(document.fullscreenElement); };
    const alternarPantallaCompleta = () => {
      try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch (_) { /* no soportado */ }
    };
    const actualizarTodo = async () => { await cargarDatosDesdeSupabase(); await S.recargarTaller(); };
    const horaActualizacion = computed(() => S.ultimaActualizacion.value
      ? S.ultimaActualizacion.value.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '');

    // ---------- Ingresar a nave ----------
    const abrirIngreso = (nave) => { afiNuevo.value = ''; naveIngreso.value = nave; };
    const ingresar = async (origen) => {
      if (ocupado.value) return;
      ocupado.value = true;
      try { if (await S.ingresarANave(naveIngreso.value, origen)) naveIngreso.value = null; }
      finally { ocupado.value = false; }
    };
    /** Ingresar desde las listas laterales (sin programa / con faltantes). */
    const ingresarDesdeLista = async (rep) => {
      const nave = naveDestino.value[rep.id];
      if (!nave) return alert('Elige la nave.');
      ocupado.value = true;
      try { await S.ingresarANave(nave, { rep }); naveDestino.value[rep.id] = ''; }
      finally { ocupado.value = false; }
    };
    const agregarSinProg = async () => {
      if (await S.agregarSinPrograma(afiSinProg.value)) afiSinProg.value = '';
    };

    // ---------- Reparar (OT + actividades) ----------
    const abrirReparar = (rep) => {
      repTrabajo.value = rep;
      otSel.value = S.otPrincipal(rep);
      nuevaAct.value = { descripcion: '', ejecutante: '' };
      formOT.value = { folio: String(folioSugerido.value), tipo: 'CORRECTIVA', mecanico: '' };
    };
    const cerrarReparar = () => { repTrabajo.value = null; otSel.value = null; };
    const crearOT = async () => {
      ocupado.value = true;
      try {
        const ot = await S.crearOTParaRep(repTrabajo.value, formOT.value);
        if (ot) otSel.value = ot;
      } finally { ocupado.value = false; }
    };
    const enlazarOT = async (ot) => { await S.enlazarOTExistente(repTrabajo.value, ot); otSel.value = ot; };
    const agregarAct = async () => {
      if (!otSel.value) return;
      if (await S.agregarActividad(otSel.value, nuevaAct.value.descripcion, nuevaAct.value.ejecutante)) {
        nuevaAct.value = { descripcion: '', ejecutante: nuevaAct.value.ejecutante };
      }
    };
    const progresoOT = (ot) => {
      const acts = (ot?.actividades || []).filter(a => String(a.descripcion || '').trim());
      const done = acts.filter(S.actividadHecha).length;
      return { done, total: acts.length, pct: acts.length ? Math.round(done / acts.length * 100) : 0 };
    };
    const abrirFormatoOT = (ot) => { cerrarReparar(); irAOT(ot.folio); };
    const enviarProb = async () => {
      ocupado.value = true;
      try { if (await S.enviarProblema(repTrabajo.value, otSel.value, nuevoProblema.value)) nuevoProblema.value = ''; }
      finally { ocupado.value = false; }
    };
    const fechaHora = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };

    // ---------- Sacar por error / prueba (Admin) ----------
    const sacarError = async (rep) => {
      ocupado.value = true;
      try { if (await S.sacarPorError(rep)) { if (repTrabajo.value && repTrabajo.value.id === rep.id) cerrarReparar(); } }
      finally { ocupado.value = false; }
    };

    // ---------- Sacar de nave ----------
    const abrirSalida = (rep) => {
      repSalida.value = rep;
      formSalida.value = { reparado: null, faltante: rep.faltante || S.faltanteSugerido(rep), agregarAOT: true };
    };
    const confirmarSalida = async () => {
      ocupado.value = true;
      try {
        if (await S.sacarDeNave(repSalida.value, formSalida.value)) {
          if (repTrabajo.value && repTrabajo.value.id === repSalida.value.id) cerrarReparar();
          repSalida.value = null;
        }
      } finally { ocupado.value = false; }
    };

    return {
      ...comunes(), ...S,
      folioSugerido, imprimirOT, ESTILO_ESTADO_OT, estadoOT, N_ACTIVIDADES, formatDateForDisplay,
      naveIngreso, afiNuevo, repTrabajo, otSel, nuevaAct, formOT, repSalida, formSalida, afiSinProg, naveDestino, ocupado,
      pantallaCompleta, alternarPantallaCompleta, actualizarTodo, horaActualizacion,
      abrirIngreso, ingresar, ingresarDesdeLista, agregarSinProg,
      abrirReparar, cerrarReparar, crearOT, enlazarOT, agregarAct, progresoOT, abrirFormatoOT,
      nuevoProblema, textoProblema, enviarProb, fechaHora, sacarError,
      abrirSalida, confirmarSalida
    };
  }
};
