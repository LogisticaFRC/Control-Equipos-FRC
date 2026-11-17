// =====================================================================
// REPUESTOS Y COMPRAS · PEDIDA DE REPUESTOS · Componente (2026-11-17) · ver pedida.service.js
// =====================================================================
import * as P from './pedida.service.js';
import { puedeEditar, isAdmin } from '../../core/store.js';
import { formatDateForDisplay } from '../../core/utils.js';
import { verDetallePorAfiString } from '../inventario/perfil.service.js';

const { onMounted } = Vue;

export default {
  name: 'PedidaRepuestosView',
  template: /* html */ `
<section class="space-y-4">
  <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-3">
    <div class="flex flex-wrap justify-between items-center gap-3">
      <div>
        <h2 class="text-sm font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-cart-flatbed text-orange-500"></i> PEDIDA DE REPUESTOS</h2>
        <p class="text-xs text-slate-500 mt-1">Lo que piden el <b>taller</b> (Programa de Reparación) y el personal de <b>CRTG</b> desde la app. Cambia el estado, la fecha aproximada de llegada y deja una nota: el que pidió lo ve en su celular.</p>
      </div>
      <button @click="P.cargarPedidos" :disabled="P.cargandoPedidos.value" class="px-3 py-2 rounded-lg border text-xs font-bold text-slate-600 hover:bg-slate-50"><i :class="['fa-solid mr-1', P.cargandoPedidos.value ? 'fa-spinner fa-spin' : 'fa-rotate']"></i>Actualizar</button>
    </div>
    <div v-if="P.faltaSqlPedidos.value" class="bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3 text-xs">Para los pedidos de CRTG falta ejecutar <b>sql/crtg.sql</b> en Supabase.</div>
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
      <button v-for="k in ['PENDIENTE', 'PEDIDO', 'RECIBIDO', 'RECHAZADO']" :key="k" @click="P.filtroPedidos.value.estado = k" :class="['rounded-lg p-2 border', P.ESTADOS_PEDIDO[k].c]">
        <p class="text-lg font-extrabold">{{ P.resumenPedidos.value[k] }}</p><p class="font-bold">{{ P.ESTADOS_PEDIDO[k].l }}</p></button>
      <button @click="P.filtroPedidos.value.estado = ''" class="rounded-lg p-2 border bg-slate-50"><p class="text-lg font-extrabold text-slate-800">{{ P.resumenPedidos.value.total }}</p><p class="font-bold text-slate-600">Total</p></button>
    </div>
    <div class="flex flex-wrap gap-2 text-xs">
      <select v-model="P.filtroPedidos.value.origen" class="p-2 border rounded-lg font-bold bg-white">
        <option value="">Taller y CRTG</option><option value="TALLER">Solo taller</option><option value="CRTG">Solo CRTG</option>
      </select>
      <select v-model="P.filtroPedidos.value.estado" class="p-2 border rounded-lg font-bold bg-white">
        <option value="ABIERTOS">Abiertos (pendiente / pedido)</option><option value="">Todos los estados</option>
        <option v-for="(v, k) in P.ESTADOS_PEDIDO" :key="k" :value="k">{{ v.l }}</option>
      </select>
      <input v-model="P.filtroPedidos.value.texto" placeholder="Buscar AFI, repuesto, quién pidió…" class="flex-1 min-w-[200px] p-2 border rounded-lg">
    </div>
  </div>

  <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
    <table class="w-full text-left text-xs">
      <thead class="bg-slate-800 text-white uppercase text-[10px]">
        <tr><th class="p-2.5">Origen</th><th class="p-2.5">Fecha</th><th class="p-2.5">AFI / equipo</th><th class="p-2.5">Repuesto / descripción</th><th class="p-2.5">Fotos</th><th class="p-2.5">Pidió</th><th class="p-2.5">Estado</th><th class="p-2.5">Llega aprox.</th><th class="p-2.5">Nota</th><th v-if="isAdmin" class="p-2.5"></th></tr>
      </thead>
      <tbody class="divide-y">
        <tr v-for="p in P.pedidosFiltrados.value" :key="p.key" class="align-top hover:bg-slate-50">
          <td class="p-2.5 whitespace-nowrap">
            <span v-if="p.origen === 'TALLER'" class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold"><i class="fa-solid fa-warehouse mr-1"></i>TALLER<span v-if="p.lugar"> · {{ p.lugar }}</span></span>
            <span v-else class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200 text-[10px] font-bold"><img src="icons/logo-crtg.png" class="h-3.5">{{ p.origen }}</span>
          </td>
          <td class="p-2.5 font-mono whitespace-nowrap">{{ formatDateForDisplay(p.fecha) }}</td>
          <td class="p-2.5"><button @click="verDetallePorAfiString(p.afi)" class="font-bold text-amber-700 hover:underline">{{ p.afi }}</button><span class="block text-slate-500">{{ p.equipo }}</span></td>
          <td class="p-2.5 max-w-[280px]"><b class="text-slate-800 whitespace-pre-line">{{ p.descripcion }}</b><span v-if="p.detalle" class="block text-slate-500">{{ p.detalle }}</span></td>
          <td class="p-2.5"><div class="flex gap-1"><a v-for="(u, i) in p.fotos" :key="i" :href="u" target="_blank" rel="noopener"><img :src="u" class="w-10 h-10 object-cover rounded border"></a></div></td>
          <td class="p-2.5">{{ p.solicitante }}</td>
          <td class="p-2.5">
            <select v-if="puedeEditar" :value="p.estado" @change="P.guardarPedido(p, { estado: $event.target.value })" :class="['p-1.5 border rounded font-bold text-[11px]', P.ESTADOS_PEDIDO[p.estado]?.c]">
              <option v-for="(v, k) in P.ESTADOS_PEDIDO" :key="k" :value="k">{{ v.l }}</option>
            </select>
            <span v-else :class="['px-2 py-0.5 rounded border text-[10px] font-bold', P.ESTADOS_PEDIDO[p.estado]?.c]">{{ P.ESTADOS_PEDIDO[p.estado]?.l }}</span>
          </td>
          <td class="p-2.5"><input type="date" :value="p.fecha_aprox" :disabled="!puedeEditar" @change="P.guardarPedido(p, { fecha_aprox: $event.target.value })" class="p-1.5 border rounded"></td>
          <td class="p-2.5"><input :value="p.nota" :disabled="!puedeEditar" @change="P.guardarPedido(p, { nota: $event.target.value })" placeholder="Ej: pedido a proveedor X" class="p-1.5 border rounded w-44"></td>
          <td v-if="isAdmin" class="p-2.5"><button v-if="p.origen !== 'TALLER'" @click="P.eliminarPedido(p)" class="text-slate-300 hover:text-rose-600" title="Eliminar"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
        <tr v-if="!P.pedidosFiltrados.value.length"><td colspan="10" class="p-8 text-center text-slate-400 font-bold">No hay pedidos con esos filtros.</td></tr>
      </tbody>
    </table>
  </div>
</section>`,
  setup() {
    onMounted(P.cargarPedidos);
    return { P, puedeEditar, isAdmin, formatDateForDisplay, verDetallePorAfiString };
  }
};
