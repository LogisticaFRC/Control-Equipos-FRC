// =====================================================================
// INVENTARIO AFI · Modal "Perfil de Equipo y Dashboard Individual"
// =====================================================================
import template from './perfil-equipo.template.js';
import { comunes } from '../../core/comunes.js';
import { datosVersion } from '../../core/store.js';
import * as P from './perfil.service.js';
import { getHistorialMovimientosAFI } from '../movimientos/movimientos.service.js';
import { editarMantencion, eliminarMantencion } from '../historial/historial.service.js';

const { onMounted, onBeforeUnmount, watch, nextTick } = Vue;

export default {
  name: 'PerfilEquipo',
  template,
  setup() {
    let chartCausas = null, chartTipos = null;
    const destruir = () => { chartCausas?.destroy(); chartTipos?.destroy(); chartCausas = chartTipos = null; };

    const renderPerfilCharts = () => nextTick(() => {
      if (!P.showPerfilEquipoModal.value || !P.perfilEquipo.value.afi) return;
      destruir();
      const arr = P.getHistorialIntervencionesFiltradoAFI(P.perfilEquipo.value.afi);
      try {
        const ctx1 = document.getElementById('chartPerfilCausas');
        if (ctx1) {
          const cMap = {};
          arr.forEach(i => { const c = String(i.causa || 'S/C').trim().toUpperCase(); cMap[c] = (cMap[c] || 0) + 1; });
          const labels = Object.keys(cMap), vals = Object.values(cMap);
          chartCausas = new Chart(ctx1, {
            type: 'bar',
            data: { labels: labels.length ? labels : ['Sin datos'], datasets: [{ data: vals.length ? vals : [0], backgroundColor: '#f59e0b' }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
          });
        }
        const ctx2 = document.getElementById('chartPerfilTipos');
        if (ctx2) {
          const t = { PREVENTIVA: 0, PREDICTIVA: 0, CORRECTIVA: 0, OTRAS: 0 };
          arr.forEach(i => {
            const v = String(i.tipoMant || '').toUpperCase();
            if (v.includes('PREVENT')) t.PREVENTIVA++; else if (v.includes('PREDICT')) t.PREDICTIVA++; else if (v.includes('CORRECT')) t.CORRECTIVA++; else t.OTRAS++;
          });
          chartTipos = new Chart(ctx2, {
            type: 'doughnut',
            data: { labels: ['Preventiva', 'Predictiva', 'Correctiva', 'Otras'], datasets: [{ data: [t.PREVENTIVA, t.PREDICTIVA, t.CORRECTIVA, t.OTRAS], backgroundColor: ['#2563eb', '#8b5cf6', '#dc2626', '#64748b'] }] },
            options: { responsive: true, maintainAspectRatio: false }
          });
        }
      } catch (e) { console.error('Error gráficos perfil:', e); }
    });

    onMounted(renderPerfilCharts);
    // Antes los gráficos solo cambiaban al presionar "Limpiar"; ahora siguen a los filtros.
    watch([P.perfilFiltroFechaInicio, P.perfilFiltroFechaFin, P.perfilFiltroCausa, datosVersion], renderPerfilCharts);
    onBeforeUnmount(destruir);

    const resetFiltrosPerfil = () => P.resetFiltrosPerfil();

    return {
      ...comunes(), ...P, resetFiltrosPerfil, renderPerfilCharts,
      getHistorialMovimientosAFI, editarMantencion, eliminarMantencion
    };
  }
};
