// =====================================================================
// DASHBOARD · Componente (KPIs, alertas de mantención y gráficos generales)
// =====================================================================
import template from './dashboard.template.js';
import { comunes } from '../../core/comunes.js';
import { dbEquipos, dbIntervenciones, currentTab, datosVersion } from '../../core/store.js';
import { esEquipoCritico } from '../../core/horometros.js';
import { countEstado, filtrarPorEstado } from '../inventario/inventario.service.js';

const { computed, onMounted, onBeforeUnmount, watch, nextTick } = Vue;

export default {
  name: 'DashboardView',
  template,
  setup() {
    // Instancias de Chart.js (fuera de la reactividad de Vue a propósito)
    let charts = {};
    const destruir = () => { Object.values(charts).forEach(c => c && c.destroy()); charts = {}; };

    const equiposCriticosDashboard = computed(() => dbEquipos.value.filter(esEquipoCritico));

    const resumenKPIs = computed(() => [
      { Metrica: "Total Flota", Valor: dbEquipos.value.length },
      { Metrica: "Trabajando / Operativo", Valor: countEstado('Operativo') },
      { Metrica: "Disponible", Valor: countEstado('Disponible') },
      { Metrica: "En Traslado", Valor: countEstado('En Traslado') },
      { Metrica: "En Mantención", Valor: countEstado('En Mantencion') },
      { Metrica: "Fuera de Servicio", Valor: countEstado('Fuera de Servicio') },
      { Metrica: "En Venta", Valor: countEstado('Venta') },
      { Metrica: "Equipos críticos (pasados/próximos)", Valor: equiposCriticosDashboard.value.length }
    ]);

    const filtrarYIrAInventario = (estado) => { filtrarPorEstado(estado); currentTab.value = 'inventario'; };

    const renderCharts = () => nextTick(() => {
      destruir();
      try {
        const ctx1 = document.getElementById('chartEstado');
        if (ctx1) charts.estado = new Chart(ctx1, {
          type: 'doughnut',
          data: {
            labels: ['Trabajando', 'Disponibles', 'En Traslado', 'En Mantención', 'Fuera de Servicio', 'Venta'],
            datasets: [{
              data: [countEstado('Operativo'), countEstado('Disponible'), countEstado('En Traslado'), countEstado('En Mantencion'), countEstado('Fuera de Servicio'), countEstado('Venta')],
              backgroundColor: ['#10b981', '#0284c7', '#f59e0b', '#f43f5e', '#64748b', '#a855f7']
            }]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });

        const ctx2 = document.getElementById('chartTiposMant');
        if (ctx2) {
          const cuenta = (txt) => dbIntervenciones.value.filter(i => String(i.tipoMant).toUpperCase().includes(txt)).length;
          charts.tipos = new Chart(ctx2, {
            type: 'bar',
            data: { labels: ['Preventiva', 'Predictiva', 'Correctiva'], datasets: [{ data: [cuenta('PREVENT'), cuenta('PREDICT'), cuenta('CORRECT')], backgroundColor: ['#2563eb', '#8b5cf6', '#dc2626'] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
          });
        }

        const ctx3 = document.getElementById('chartCausas');
        if (ctx3) {
          const causasMap = {};
          dbIntervenciones.value.forEach(i => {
            if (i.causa && i.causa !== '-') { const c = String(i.causa).trim().toUpperCase(); causasMap[c] = (causasMap[c] || 0) + 1; }
          });
          const top = Object.entries(causasMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
          charts.causas = new Chart(ctx3, {
            type: 'bar',
            data: { labels: top.map(x => x[0]), datasets: [{ data: top.map(x => x[1]), backgroundColor: '#f59e0b' }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
          });
        }
      } catch (error) {
        console.error("Error al renderizar los gráficos:", error);
      }
    });

    onMounted(renderCharts);
    watch(datosVersion, renderCharts);   // se redibuja solo cuando cambian los datos
    onBeforeUnmount(destruir);

    return { ...comunes(), countEstado, equiposCriticosDashboard, resumenKPIs, filtrarYIrAInventario, renderCharts };
  }
};
