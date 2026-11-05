// =====================================================================
// PROGRAMAS · Componente (carpeta Reparación o Mantención, tablas por nave, Gantt)
// Se usa en dos submódulos del menú:
//   <programas-view tipo="MANTENCION">  → Programas Mantención
//   <programas-view tipo="REPARACION">  → Programas Reparación (pestaña "Programas y Gantt", junto al Taller)
// =====================================================================
import template from './programas.template.js';
import { comunes } from '../../core/comunes.js';
import * as S from './programas.service.js';
import { filtrosRequeridosAfi, kitsEnBodegaAfi, sePuedeArmarAfi, kitConsumidoItem, resumenKitsPrograma, abrirArmarKitParaAfi } from '../bodega/bodega.service.js';
import { dbProgramasItems } from '../../core/store.js';
import { hoyISO, normalizarFecha } from '../../core/utils.js';
import { estadoItemTaller, repDeItem, progresoRep, ETIQUETA_ESTADO, ESTILO_ESTADO, cargarReparaciones } from '../taller/taller.service.js';

const { computed, onMounted, watch } = Vue;

const CARPETAS = {
  REPARACION: { key: 'REPARACION', label: 'REPARACIÓN', icono: 'text-amber-600', iconoTipo: 'fa-wrench', cab: 'bg-amber-50 border-amber-200 hover:bg-amber-100', linea: 'border-amber-200', sub: 'bg-amber-50/60 border-amber-200 text-amber-900' },
  MANTENCION: { key: 'MANTENCION', label: 'MANTENCIÓN', icono: 'text-indigo-600', iconoTipo: 'fa-oil-can', cab: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100', linea: 'border-indigo-200', sub: 'bg-indigo-50/60 border-indigo-200 text-indigo-900' }
};

export default {
  name: 'ProgramasView',
  props: { tipo: { type: String, default: 'MANTENCION' } },
  template,
  setup(props) {
    const tipo = computed(() => String(props.tipo || 'MANTENCION').toUpperCase());
    const carpetasVisibles = computed(() => [CARPETAS[tipo.value]]);
    /** El programa seleccionado es de este submódulo. */
    const progDelTipo = computed(() => Boolean(S.progSelect.value.id) && String(S.progSelect.value.carpeta || '').toUpperCase() === tipo.value);

    /** Al entrar: si el programa seleccionado es del otro tipo, se elige el vigente (o el más reciente) de este tipo. */
    const elegirPorDefecto = () => {
      if (progDelTipo.value) return;
      const hoy = hoyISO();
      const progs = S.obtenerProgramasDeCarpeta(tipo.value);
      const vigente = progs.find(p => normalizarFecha(p.fecha_inicio_programa) <= hoy && hoy <= normalizarFecha(p.fecha_termino_programa));
      const reciente = [...progs].sort((a, b) => String(normalizarFecha(b.fecha_inicio_programa)).localeCompare(String(normalizarFecha(a.fecha_inicio_programa))))[0];
      const p = vigente || reciente;
      if (p) S.seleccionarProgramaObj(p);
    };
    onMounted(() => { S.cargarCarpetasProgramas(); elegirPorDefecto(); if (tipo.value === 'REPARACION') cargarReparaciones(); });
    /** Texto de la columna TALLER (programas de reparación). */
    const tallerDeItem = (item) => { const e = estadoItemTaller(item); const r = repDeItem(item); return e === 'EN_NAVE' ? `${r.nave} · ${progresoRep(r).pct}%` : ETIQUETA_ESTADO[e]; };
    watch(() => S.obtenerProgramasDeCarpeta(tipo.value).length, elegirPorDefecto);

    /** Cumplimiento de todos los programas de este tipo. */
    const cumplimientoTipo = computed(() => {
      const ids = new Set(S.obtenerProgramasDeCarpeta(tipo.value).map(p => String(p.id)));
      const items = dbProgramasItems.value.filter(i => ids.has(String(i.programa_id)));
      return items.length ? Math.round(items.filter(i => i.realizado).length / items.length * 100) : 0;
    });

    return {
      ...comunes(), ...S, tipoProg: tipo, carpetasVisibles, progDelTipo, cumplimientoTipo, estadoItemTaller, tallerDeItem, ESTILO_ESTADO,
      abrirModalAsignarEquipo: () => S.abrirModalAsignarEquipo(tipo.value),
      filtrosRequeridosAfi, kitsEnBodegaAfi, sePuedeArmarAfi, kitConsumidoItem, resumenKitsPrograma, abrirArmarKitParaAfi
    };
  }
};
