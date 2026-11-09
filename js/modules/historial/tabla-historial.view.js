// =====================================================================
// HISTORIAL · Tabla compacta reutilizable (módulo Historial y Perfil de Equipo)
// ---------------------------------------------------------------------
// Muestra pocas columnas (sin barra hacia el lado). Clic en la fila → se despliega
// todo el detalle debajo (programa, mecánicos, filtros, OC, OT, aceites, sistema detectado…).
// Props: registros (array), mostrar-afi (bool), por-pagina (número, default 100)
// =====================================================================
import { comunes } from '../../core/comunes.js';
import { editarMantencion, eliminarMantencion } from './historial.service.js';
import { detalleOCsMantencion, totalOCMantencion, fmtCLP, irAOC } from '../oc/oc.service.js';
import { categorizar, minutosTrabajo, fmtMin, piezaMotivoTexto } from '../../core/analisis-fallas.js';
import { claseMantencion } from '../../core/horometros.js';

const { ref, computed, watch } = Vue;

const template = /* html */ `
<div class="border rounded-lg overflow-hidden bg-white">
  <table class="w-full text-left text-[11px] table-fixed">
    <thead class="bg-slate-800 text-white uppercase text-[9px]">
      <tr>
        <th class="p-2 w-[86px]">Fecha</th>
        <th v-if="mostrarAfi" class="p-2 w-[90px]">AFI</th>
        <th class="p-2 w-[150px]">Causa / Tipo</th>
        <th class="p-2">Causa detallada</th>
        <th class="p-2 w-[120px] hidden md:table-cell">Sistema</th>
        <th class="p-2 w-[90px] text-center hidden sm:table-cell">Horas</th>
        <th class="p-2 w-[95px] text-right hidden sm:table-cell">Hor./Km</th>
        <th class="p-2 w-[60px] text-center">Doc.</th>
        <th class="p-2 w-[70px] text-center"></th>
      </tr>
    </thead>
    <tbody class="divide-y">
      <template v-for="i in visibles" :key="i.id">
        <tr @click="toggle(i.id)" :class="['cursor-pointer align-top', abierto === i.id ? 'bg-amber-50' : 'hover:bg-slate-50']">
          <td class="p-2 font-mono font-bold">{{ formatDateForDisplay(i.fecha) }}</td>
          <td v-if="mostrarAfi" class="p-2"><button @click.stop="verDetallePorAfiString(i.afi)" class="font-mono font-bold text-amber-700 bg-amber-50 px-1.5 rounded hover:underline">{{ i.afi }}</button>
            <span class="block text-[9px] text-slate-400 truncate">{{ i.equipo }}</span></td>
          <td class="p-2">
            <span :class="['font-bold block truncate', claseMantencion(i) === 'COMPLETA' ? 'text-emerald-700' : claseMantencion(i) === 'INTERMEDIA' ? 'text-sky-700' : 'text-slate-800']" :title="i.causa">{{ i.causa || '-' }}</span>
            <span class="text-[9px] text-blue-600 font-semibold block truncate">{{ i.tipoMant || '' }}{{ i.tipoHorasMant ? ' · ' + i.tipoHorasMant : '' }}</span>
          </td>
          <td class="p-2"><span class="line-clamp-2 break-words" :title="i.causaDetallada">{{ i.causaDetallada || i.descripcion || '-' }}</span></td>
          <td class="p-2 hidden md:table-cell"><span class="inline-flex items-center gap-1 font-semibold truncate max-w-full"><span class="w-2 h-2 rounded-full shrink-0" :style="{ background: cat(i).color }"></span><span class="truncate">{{ cat(i).label }}</span></span></td>
          <td class="p-2 text-center hidden sm:table-cell"><span v-if="min(i)" class="font-mono font-bold text-sky-800">{{ fmtMin(min(i)) }}</span><span v-else class="text-slate-300">-</span>
            <span v-if="i.horaInicio && i.horaInicio !== '-'" class="block text-[9px] text-slate-400 font-mono">{{ i.horaInicio }}–{{ i.horaTermino }}</span></td>
          <td class="p-2 text-right font-mono font-bold text-amber-900 hidden sm:table-cell">{{ i.horometro ? Number(i.horometro).toLocaleString('es-CL') + (esPatente(i.afi) ? ' km' : ' h') : '-' }}</td>
          <td class="p-2 text-center"><a v-if="i.linkDrive" @click.stop :href="i.linkDrive" target="_blank" rel="noopener" class="inline-flex items-center gap-1 bg-rose-100 hover:bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded font-bold text-[10px]" title="Abrir documento"><i class="fa-solid fa-file-pdf"></i> Ver</a><span v-else class="text-slate-300">—</span></td>
          <td class="p-2 text-center whitespace-nowrap">
            <button v-if="puedeEditar" @click.stop="editarMantencion(i)" class="text-amber-700 hover:text-amber-900 px-1" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
            <button v-if="isAdmin" @click.stop="eliminarMantencion(i.id)" class="text-rose-500 hover:text-rose-700 px-1" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
            <i :class="['fa-solid fa-chevron-down text-slate-400 transition-transform ml-0.5', abierto === i.id ? 'rotate-180' : '']"></i>
          </td>
        </tr>
        <tr v-if="abierto === i.id" class="bg-amber-50/50">
          <td :colspan="mostrarAfi ? 9 : 8" class="p-3">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
              <div v-for="d in detalle(i)" :key="d.l" :class="d.ancho ? 'col-span-2 md:col-span-4' : ''">
                <span class="block text-[9px] font-bold uppercase text-slate-500">{{ d.l }}</span>
                <span :class="['block break-words', d.cls || 'text-slate-800']">{{ d.v }}</span>
              </div>
              <div>
                <span class="block text-[9px] font-bold uppercase text-slate-500">N° OC</span>
                <template v-if="detalleOCsMantencion(i).length">
                  <button v-for="d in detalleOCsMantencion(i)" :key="d.numero" @click="irAOC(d.numero)" :class="['block font-mono font-bold underline', d.oc ? 'text-emerald-700' : 'text-amber-700']">{{ d.numero }} <span class="font-normal text-slate-500 no-underline">{{ d.oc ? fmtCLP(d.precio) : '(sin registrar)' }}</span></button>
                  <span class="block text-[10px] font-extrabold text-emerald-800">Total: {{ fmtCLP(totalOCMantencion(i)) }}</span>
                </template>
                <span v-else>-</span>
              </div>
              <div>
                <span class="block text-[9px] font-bold uppercase text-slate-500">N° OT</span>
                <button v-if="i.numeroOT && abrirOt" @click="abrirOt(i.numeroOT)" class="font-mono font-bold text-blue-700 underline">{{ i.numeroOT }}</button><span v-else>{{ i.numeroOT || '-' }}</span>
              </div>
            </div>
          </td>
        </tr>
      </template>
      <tr v-if="!registros.length"><td :colspan="mostrarAfi ? 9 : 8" class="p-6 text-center text-slate-400 font-bold">No se encontraron registros.</td></tr>
    </tbody>
  </table>
  <div v-if="registros.length > limite" class="p-2 text-center border-t bg-slate-50">
    <span class="text-slate-500 mr-2">Mostrando {{ limite }} de {{ registros.length }}</span>
    <button @click="limite += porPagina" class="text-blue-700 font-bold underline">Ver {{ Math.min(porPagina, registros.length - limite) }} más</button>
  </div>
</div>
`;

export default {
  name: 'TablaHistorial',
  props: {
    registros: { type: Array, default: () => [] },
    mostrarAfi: { type: Boolean, default: false },
    porPagina: { type: Number, default: 100 },
    abrirOt: { type: Function, default: null }   // abre la OT (desde el módulo Historial)
  },
  template,
  setup(props) {
    const abierto = ref(null);
    const limite = ref(props.porPagina);
    watch(() => props.registros, () => { limite.value = props.porPagina; });
    const visibles = computed(() => props.registros.slice(0, limite.value));
    const toggle = (id) => { abierto.value = abierto.value === id ? null : id; };
    const cacheCat = new WeakMap();
    const cat = (i) => { if (!cacheCat.has(i)) cacheCat.set(i, categorizar(i)); return cacheCat.get(i); };
    const min = (i) => minutosTrabajo(i);
    const c = comunes();
    const detalle = (i) => [
      { l: 'Programa', v: i.programaCorrespondiente || '-', cls: 'text-indigo-700 font-bold' },
      { l: 'Equipo / Lugar', v: [i.equipo, i.lugar].filter(Boolean).join(' · ') || '-' },
      { l: 'Empresa', v: i.empresaArriendo || '-' },
      { l: 'Mecánicos', v: c.getMecanicosText(i) },
      { l: 'Hora inicio / término', v: `${i.horaInicio || '-'} → ${i.horaTermino || '-'}`, cls: 'font-mono text-sky-800' },
      { l: 'Total horas', v: i.horaTotal || '-', cls: 'font-mono font-bold' },
      { l: 'Costo', v: '$' + Number(i.costo || 0).toLocaleString('es-CL'), cls: 'font-bold text-emerald-700' },
      { l: 'Interferencia', v: i.interferencia || '-' },
      { l: 'N° folio hoja', v: i.numeroFolio || '-', cls: 'font-mono font-bold' },
      { l: 'ART / Bloqueo', v: `ART: ${i.usoArt || '-'} · Bloqueo: ${i.bloqueo || '-'}` },
      { l: 'Hora falla / causa falla', v: [i.horaFalla, i.causaFalla].filter(Boolean).join(' · ') || '-' },
      { l: 'Sistema detectado', v: cat(i).label + (cat(i).otras.length ? ' (también: ' + cat(i).otras.map(k => k.toLowerCase()).join(', ') + ')' : '') },
      { l: 'Pieza · motivo detectado', v: piezaMotivoTexto(i), cls: 'text-rose-800 font-semibold' },
      { l: 'Aceites', v: i.aceites || '-', cls: 'text-amber-800 font-semibold' },
      { l: 'Causa detallada', v: i.causaDetallada || '-', ancho: true },
      { l: 'Descripción', v: i.descripcion || '-', ancho: true },
      { l: 'Filtros utilizados', v: i.filtrosTexto || 'Sin filtros', ancho: true, cls: 'text-emerald-800 font-semibold' }
    ];
    return { ...c, abierto, limite, visibles, toggle, cat, min, fmtMin, detalle, claseMantencion,
      editarMantencion, eliminarMantencion, detalleOCsMantencion, totalOCMantencion, fmtCLP, irAOC };
  }
};
