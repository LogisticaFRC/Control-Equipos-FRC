// =====================================================================
// MINUTAS · Componente (carpetas Año → Mes, tabla de tareas, dashboard)
// =====================================================================
import template from './minutas.template.js';
import { isAdmin, isSubadmin, puedeEditar } from '../../core/store.js';
import * as S from './minutas.service.js';
import { exportarMinutaExcel, exportarTodasExcel, exportando, cfgEstados, cfgPersonal, cfgEvolucion, evolucionDe } from './minutas.export.js';

const { onMounted, onBeforeUnmount, watch, nextTick } = Vue;

export default {
  name: 'MinutasView',
  template,
  setup() {
    let charts = {};
    const destruir = () => { Object.values(charts).forEach(c => c && c.destroy()); charts = {}; };
    const pantalla = (cfg) => ({ ...cfg, options: { ...cfg.options, responsive: true, maintainAspectRatio: false } });

    const renderCharts = () => nextTick(() => {
      destruir();
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

    watch([S.vistaMinuta, S.minutaSelId, () => S.dbMinutasItems.value.map(i => i.estado + i.personal + i.fecha_estimada).join('|')], renderCharts);

    onMounted(async () => {
      try { await S.cargarMinutas(); } catch (e) { console.error(e); }
      renderCharts();
    });
    onBeforeUnmount(destruir);

    return { ...S, isAdmin, isSubadmin, puedeEditar, exportarMinutaExcel, exportarTodasExcel, exportando };
  }
};
