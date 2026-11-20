// =====================================================================
// CONTROL DE ACEITES · Lógica (filtros, totales de litros y costos)
// Lee los consumos registrados en el Historial de mantenciones.
// =====================================================================
import { dbIntervenciones } from '../../core/store.js';
import { formatExcelDate, parseIsoDate, mismoAfi } from '../../core/utils.js';
import { ACEITES } from '../historial/historial.mapper.js';
import { dbOT, cargarOT, mantencionesDeOT } from '../ot/ot.service.js';   // 2026-11-20: aceites de las OT de taller

const { ref, computed } = Vue;

export const filterOil = ref({ dateStart: "", dateEnd: "", afi: "ALL", tipoAceite: "ALL" });
export const sortAceitesOrder = ref("desc");

const tieneConsumo = (i) => i.aceites && i.aceites !== "Sin consumo";
/** 2026-11-20: aceites registrados en las OT de taller (aceite elegido de la lista + litros) como consumos.
 *  Si la OT ya tiene un registro en el Historial con aceites, no se cuenta de nuevo (evita sumar doble). */
export const registrosAceitesOT = computed(() => dbOT.value
  .filter(o => o.estado !== 'ANULADA' && o.reparacion_id != null)
  .filter(o => !mantencionesDeOT(o.folio).some(m => m.aceites && m.aceites !== 'Sin consumo'))
  .map(o => {
    const reg = { id: 'OT-' + o.id, afi: o.afi, equipo: o.equipo || '', lugar: 'TALLER', causa: 'OT TALLER N° ' + o.folio, tipoMant: 'Aceites de la OT', costo: 0, fecha: o.fecha, deOT: true };
    const det = [];
    (o.insumos || []).forEach(x => {
      const lts = Number(String(x.litros || '').replace(',', '.')) || 0;
      if (!lts || !x.aceite_key) return;
      const a = ACEITES.find(k => k.key === x.aceite_key);
      if (a) reg[a.key] = (Number(reg[a.key]) || 0) + lts;
      det.push(`${a ? a.label : String(x.aceite_otro || 'OTRO').toUpperCase()}: ${lts}L`);
      if (x.fecha && (!reg.fecha || x.fecha > reg.fecha)) reg.fecha = x.fecha;
    });
    reg.aceites = det.length ? det.join('; ') : 'Sin consumo';
    return reg;
  })
  .filter(r => r.aceites !== 'Sin consumo'));
/** Historial + OT de taller. */
const fuenteAceites = computed(() => [...dbIntervenciones.value, ...registrosAceitesOT.value]);
/** Carga las OT para sumar sus aceites (la llama la vista al abrir). */
export const cargarAceitesOT = () => { if (!dbOT.value.length) cargarOT().catch(() => {}); };


/** Tipos de aceite que aparecen en el historial (para el selector). */
export const listaTiposAceitesDisponibles = computed(() => {
  const setAceites = new Set();
  fuenteAceites.value.forEach(i => {
    if (tieneConsumo(i)) i.aceites.split('; ').forEach(a => setAceites.add(a.split(':')[0].trim()));
  });
  return Array.from(setAceites).sort();
});

export const filteredAceitesRecords = computed(() => {
  const f = filterOil.value;
  const tipoSel = ACEITES.find(a => a.label === f.tipoAceite);
  const arr = fuenteAceites.value.filter(i => {
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
