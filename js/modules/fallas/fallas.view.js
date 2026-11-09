// =====================================================================
// ANÁLISIS DE FALLAS · Componente (gráficos con Chart.js)
// =====================================================================
import template from './fallas.template.js';
import { comunes } from '../../core/comunes.js';
import * as S from './fallas.service.js';
import { tieneConocimiento } from '../../core/conocimiento-fallas.js';

const { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } = Vue;

const nombreMes = (ym) => { const [y, m] = ym.split('-'); return `${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][Number(m) - 1]} ${y.slice(2)}`; };

export default {
  name: 'FallasView',
  template,
  setup() {
    const a = S.analisisFallas;
    const sistemaTop = computed(() => a.value.categorias.find(c => c.key !== 'SERVICIO' && c.key !== 'OTROS') || a.value.categorias[0] || null);
    const limiteRank = ref(30);
    const piezaAbierta = ref(null);
    const cvCategorias = ref(null), cvMeses = ref(null);
    let chCat = null, chMes = null;

    const dibujar = () => nextTick(() => {
      chCat?.destroy(); chMes?.destroy(); chCat = chMes = null;
      const d = a.value;
      if (cvCategorias.value) {
        chCat = new Chart(cvCategorias.value, {
          type: 'bar',
          data: { labels: d.categorias.map(c => c.label), datasets: [{ data: d.categorias.map(c => c.n), backgroundColor: d.categorias.map(c => c.color), borderRadius: 4 }] },
          options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => { const c = d.categorias[ctx.dataIndex]; return ` ${c.n} (${c.pct}%) · ${S.fmtMin(c.min)}`; } } } },
            scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
            onClick: (_, els) => { if (els[0]) S.filtroFallas.value.categoria = d.categorias[els[0].index].key; } }
        });
      }
      if (cvMeses.value) {
        const top5 = d.categorias.slice(0, 5);
        chMes = new Chart(cvMeses.value, {
          type: 'line',
          data: { labels: d.meses.map(nombreMes), datasets: top5.map(c => ({ label: c.label, data: d.meses.map(m => d.porMes.get(m)?.get(c.key) || 0), borderColor: c.color, backgroundColor: c.color, tension: 0.3, pointRadius: 3 })) },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
        });
      }
    });
    onMounted(dibujar);
    watch(a, dibujar);
    onBeforeUnmount(() => { chCat?.destroy(); chMes?.destroy(); });

    return { ...comunes(), piezaAbierta, tieneConocimiento, ...S, a, sistemaTop, limiteRank, cvCategorias, cvMeses };
  }
};
