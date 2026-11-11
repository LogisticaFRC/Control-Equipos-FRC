// =====================================================================
// MIS TAREAS · Pantalla del recordatorio personal (calendario + listas)
// =====================================================================
import template from './recordatorios.template.js';
import * as S from './recordatorios.service.js';
import { usuarioActivo } from '../../core/store.js';
import { sumarDiasISO } from '../../core/utils.js';

const { ref, reactive, computed, watch, onMounted } = Vue;

export default {
  name: 'RecordatoriosView',
  template,
  setup() {
    const vista = ref('hoy');
    const pestanas = [
      { k: 'hoy', l: 'Hoy', icon: 'fa-sun' },
      { k: 'semana', l: 'Semana', icon: 'fa-calendar-week' },
      { k: 'mes', l: 'Mes', icon: 'fa-calendar' },
      { k: 'lista', l: 'Todas mis tareas', icon: 'fa-list' },
      { k: 'avisos', l: 'Avisos', icon: 'fa-bell' }
    ];
    const mesRef = ref(S.primeroMes(S.hoyRef.value));
    const semanaRef = ref(S.lunesDe(S.hoyRef.value));
    const diaSel = ref(S.hoyRef.value);
    // En el calendario mensual las tareas diarias llenarían todos los días: se ocultan salvo que se pidan
    let verIni = false; try { verIni = localStorage.getItem('frc_rec_ver_rutina') === '1'; } catch (e) { /* */ }
    const verRutina = ref(verIni);
    watch(verRutina, (v) => { try { localStorage.setItem('frc_rec_ver_rutina', v ? '1' : '0'); } catch (e) { /* */ } });

    // ---------- Mes ----------
    const tituloMes = computed(() => { const d = S.fechaDe(mesRef.value); return `${S.MESES[d.getMonth()]} ${d.getFullYear()}`; });
    const celdasMes = computed(() => {
      S.dbTareas.value; S.mapaEstados.value;   // dependencias
      const ini = S.lunesDe(mesRef.value);
      const mes = mesRef.value.slice(0, 7);
      const out = [];
      for (let i = 0; i < 42; i++) {
        const f = sumarDiasISO(ini, i);
        if (i === 35 && f.slice(0, 7) !== mes) break;   // 5 semanas cuando alcanza
        out.push({ fecha: f, delMes: f.slice(0, 7) === mes, items: S.tareasDelDia(f).filter(o => verRutina.value || !S.esRutinaDiaria(o.t)) });
      }
      return out;
    });
    const tareasDiaSel = computed(() => { S.dbTareas.value; S.mapaEstados.value; return S.tareasDelDia(diaSel.value, true); });
    const irADia = (f) => { diaSel.value = f; mesRef.value = S.primeroMes(f); vista.value = 'mes'; };

    // ---------- Semana ----------
    const diasSemana = computed(() => {
      S.dbTareas.value; S.mapaEstados.value;
      return Array.from({ length: 7 }, (_, i) => { const f = sumarDiasISO(semanaRef.value, i); return { fecha: f, items: S.tareasDelDia(f) }; });
    });

    // ---------- Agregar rápido ----------
    const rapido = reactive({ titulo: '', hora: '', diaria: false });
    const agregarRapidoClick = async () => {
      if (!rapido.titulo.trim()) return;
      if (await S.agregarRapido(rapido.titulo, S.hoyRef.value, rapido.hora, rapido.diaria)) {
        rapido.titulo = ''; rapido.hora = ''; rapido.diaria = false;
      }
    };
    const pasarVencidasHoy = async () => {
      if (!confirm(`¿Pasar las ${S.vencidas.value.length} tareas vencidas a hoy?`)) return;
      for (const o of [...S.vencidas.value]) await S.moverTarea(o.t, S.hoyRef.value);
    };

    // ---------- Todas ----------
    const filtro = reactive({ texto: '', tipo: '', categoria: '', estado: 'activas' });
    const terminada = (t) => !S.esRepetitiva(t) && Boolean(S.estadoDe(t, t.fecha));
    const categoriasUsadas = computed(() => Array.from(new Set(S.dbTareas.value.map(t => t.categoria))).sort());
    const listaFiltrada = computed(() => {
      S.mapaEstados.value;
      const q = filtro.texto.trim().toLowerCase();
      return S.dbTareas.value.filter(t => {
        if (q && !(t.titulo + ' ' + t.detalle).toLowerCase().includes(q)) return false;
        if (filtro.tipo === 'unicas' && S.esRepetitiva(t)) return false;
        if (filtro.tipo === 'repetitivas' && !S.esRepetitiva(t)) return false;
        if (filtro.categoria && t.categoria !== filtro.categoria) return false;
        const fin = terminada(t) || (t.fecha_fin && t.fecha_fin < S.hoyRef.value);
        if (filtro.estado === 'activas' && (!t.activa || fin)) return false;
        if (filtro.estado === 'terminadas' && !fin) return false;
        if (filtro.estado === 'pausadas' && t.activa) return false;
        return true;
      }).sort((a, b) => {
        const pa = (a.activa && S.proximaFecha(a)) || '9999', pb = (b.activa && S.proximaFecha(b)) || '9999';
        return pa.localeCompare(pb) || (a.hora || '').localeCompare(b.hora || '') || a.titulo.localeCompare(b.titulo);
      });
    });
    const duplicar = (t) => ({
      titulo: t.titulo + ' (copia)', detalle: t.detalle, hora: t.hora, todoElDia: !t.hora, repeticion: t.repeticion, cada: t.cada,
      dias_semana: [...(t.dias_semana || [])], aviso_min: t.aviso_min, aviso_dias: t.aviso_dias, prioridad: t.prioridad,
      categoria: t.categoria, checklist: t.checklist.map(c => ({ t: c.t, ok: false }))
    });

    onMounted(() => { if (!S.tareasCargadas.value) S.cargarTareas(); });

    return {
      ...S, usuarioActivo, sumarDiasISO,
      // computeds del servicio expuestos como valores (sin .value en la plantilla)
      dbTareas: S.dbTareas, vencidas: S.vencidas, ocurrenciasHoy: S.ocurrenciasHoy, pendientesHoy: S.pendientesHoy, hechasHoy: S.hechasHoy,
      rutinaHoy: S.rutinaHoy, programadasHoy: S.programadasHoy, proximas7: S.proximas7, progresoHoy: S.progresoHoy,
      cumplimientoSemana: S.cumplimientoSemana, hoyRef: S.hoyRef, prefAvisos: S.prefAvisos, permisoNotif: S.permisoNotif,
      cargandoTareas: S.cargandoTareas, faltaSQLTareas: S.faltaSQLTareas,
      vista, pestanas, verRutina, mesRef, semanaRef, diaSel, tituloMes, celdasMes, tareasDiaSel, irADia, diasSemana,
      rapido, agregarRapidoClick, pasarVencidasHoy, filtro, terminada, categoriasUsadas, listaFiltrada, duplicar
    };
  }
};
