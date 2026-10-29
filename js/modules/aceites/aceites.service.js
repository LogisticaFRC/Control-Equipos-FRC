// =====================================================================
// CONTROL DE ACEITES · Lógica (filtros, totales de litros y costos)
// Lee los consumos registrados en el Historial de mantenciones.
// =====================================================================
import { dbIntervenciones } from '../../core/store.js';
import { formatExcelDate, parseIsoDate, mismoAfi } from '../../core/utils.js';
import { ACEITES } from '../historial/historial.mapper.js';

const { ref, computed } = Vue;

export const filterOil = ref({ dateStart: "", dateEnd: "", afi: "ALL", tipoAceite: "ALL" });
export const sortAceitesOrder = ref("desc");

const tieneConsumo = (i) => i.aceites && i.aceites !== "Sin consumo";

/** Tipos de aceite que aparecen en el historial (para el selector). */
export const listaTiposAceitesDisponibles = computed(() => {
  const setAceites = new Set();
  dbIntervenciones.value.forEach(i => {
    if (tieneConsumo(i)) i.aceites.split('; ').forEach(a => setAceites.add(a.split(':')[0].trim()));
  });
  return Array.from(setAceites).sort();
});

export const filteredAceitesRecords = computed(() => {
  const f = filterOil.value;
  const tipoSel = ACEITES.find(a => a.label === f.tipoAceite);
  const arr = dbIntervenciones.value.filter(i => {
    if (!tieneConsumo(i)) return false;
    if (f.afi !== "ALL" && !mismoAfi(i.afi, f.afi)) return false;
    const fStr = formatExcelDate(i.fecha);
    if (f.dateStart && fStr < f.dateStart) return false;
    if (f.dateEnd && fStr > f.dateEnd) return false;
    if (f.tipoAceite !== "ALL") {
      // Filtra por la columna real del aceite (no por texto)
      if (tipoSel) { if (!(Number(i[tipoSel.key]) > 0)) return false; }
      else if (!i.aceites.toUpperCase().includes(f.tipoAceite.toUpperCase())) return false;
    }
    return true;
  });
  return arr.sort((a, b) => sortAceitesOrder.value === 'desc' ? parseIsoDate(b.fecha) - parseIsoDate(a.fecha) : parseIsoDate(a.fecha) - parseIsoDate(b.fecha));
});

/** Suma de litros. Si hay un tipo seleccionado, suma solo ese tipo. */
export const sumaTotalLitrosAceites = computed(() => {
  const tipoSel = ACEITES.find(a => a.label === filterOil.value.tipoAceite);
  return filteredAceitesRecords.value.reduce((total, i) => {
    if (tipoSel) return total + (Number(i[tipoSel.key]) || 0);
    return total + ACEITES.reduce((s, a) => s + (Number(i[a.key]) || 0), 0);
  }, 0);
});

export const costoTotalAceitesFiltrados = computed(() => filteredAceitesRecords.value.reduce((acc, curr) => acc + Number(curr.costo || 0), 0));
