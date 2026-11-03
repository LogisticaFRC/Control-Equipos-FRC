// =====================================================================
// MINUTAS · Componente (carpetas Año → Mes, tabla de tareas, dashboard)
// =====================================================================
import template from './minutas.template.js';
import { isAdmin, isSubadmin, puedeEditar } from '../../core/store.js';
import * as S from './minutas.service.js';
import { exportarMinutaExcel, exportarTodasExcel, exportarGeneralExcel, exportando, cfgEstados, cfgPersonal, cfgEvolucion, cfgRealizadasMes, evolucionDe } from './minutas.export.js';
import * as G from './minutas.general.js';

const { onMounted, onBeforeUnmount, watch, nextTick } = Vue;

export default {
  name: 'MinutasView',
  template,
  setup() {
    let charts = {};
    const destruir = () => { Object.values(charts).forEach(c => c && c.destroy()); charts = {}; };
    const pantalla = (cfg) => ({ ...cfg, options: { ...cfg.options, responsive: true, maintainAspectRatio: false } });

    // Dashboard GENERAL (todas las minutas)
    const dibujarGeneral = () => {
      try {
        const k = G.kpiGeneral.value;
        const c = (id) => document.getElementById(id);
        if (c('chartGenEstados')) charts.gEstados = new Chart(c('chartGenEstados'), pantalla(cfgEstados(k)));
        if (c('chartGenEvolucion')) charts.gEvo = new Chart(c('chartGenEvolucion'), pantalla(cfgEvolucion(evolucionDe(S.dbMinutas.value.slice(-20)))));
        if (c('chartGenSeccion')) charts.gSec = new Chart(c('chartGenSeccion'), pantalla(cfgPersonal(G.generalPorSeccion.value)));
        if (c('chartGenPersonal')) charts.gPer = new Chart(c('chartGenPersonal'), pantalla(cfgPersonal(G.generalPorPersonal.value)));
        if (c('chartGenMes')) charts.gMes = new Chart(c('chartGenMes'), pantalla(cfgRealizadasMes(G.realizadasPorMes.value)));
      } catch (e) { console.error('[Minutas] Error dibujando el Dashboard General', e); }
    };

    const renderCharts = () => nextTick(() => {
      destruir();
      if (S.vistaMinuta.value === 'general') return dibujarGeneral();
      if (S.vistaMinuta.value !== 'dashboard' || !S.minutaSel.value) return;
      try {
        const c1 = document.getElementById('chartMinutaEstados');
        if (c1) charts.estados = new Chart(c1, pantalla(cfgEstados(S.resumenSel.value)));
        const c2 = document.getElementById('chartMinutaPersonal');
        if (c2) charts.personal = new Chart(c2, pantalla(cfgPersonal(S.resumenPorPersonal.value)));
        const c3 = document.getElementById('chartMinutaEvolucion');
        const m = S.minutaSel.value;
        const hasta = S.dbMinutas.value.filter(x => String(x.fecha) < String(m.fecha) || (x.fecha === m.fecha && x.id <= m.id)).slice(-20);
        if (c3) charts.evolucion = new Chart(c3, pantalla(cfgEvolucion(evolucionDe(hasta))));
      } catch (e) { console.error('[Minutas] Error dibujando gráficos', e); }
    });

    watch(() => [G.filtroGeneral.value.periodo, G.filtroGeneral.value.seccion, G.filtroGeneral.value.personal, S.dbMinutas.value.length], renderCharts);
    watch([S.vistaMinuta, S.minutaSelId, () => S.dbMinutasItems.value.map(i => i.estado + i.personal + i.fecha_estimada).join('|')], renderCharts);

    onMounted(async () => {
      try { await S.cargarMinutas(); } catch (e) { console.error(e); }
      renderCharts();
    });
    onBeforeUnmount(destruir);

    return { ...S, ...G, isAdmin, isSubadmin, puedeEditar, exportarMinutaExcel, exportarTodasExcel, exportarGeneralExcel, exportando };
  }
};
