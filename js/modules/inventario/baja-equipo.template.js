// Modales: "Eliminar equipo" (con motivo) y "Registro de equipos eliminados"
export default /* html */ `
<!-- MODAL ELIMINAR EQUIPO -->
<div v-if="showModalBaja && formBaja" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 text-xs">
  <div class="bg-white rounded-2xl shadow-2xl border w-full max-w-lg overflow-hidden">
    <div class="px-6 py-4 bg-rose-700 text-white flex items-center justify-between">
      <h3 class="text-sm font-bold"><i class="fa-solid fa-trash mr-1.5"></i> Eliminar equipo AFI {{ formBaja.equipo.afi }}</h3>
      <button @click="showModalBaja = false" class="text-white/80 hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
    </div>
    <div class="p-6 space-y-4">
      <div class="bg-slate-50 border rounded-lg p-3 text-slate-700">
        <p class="font-bold text-slate-900">{{ formBaja.equipo.tipo }} · {{ formBaja.equipo.marca }} {{ formBaja.equipo.modelo }}</p>
        <p>Ubicación: {{ formBaja.equipo.ubicacion || '-' }} · Estado: {{ formBaja.equipo.disponibilidad || '-' }}</p>
      </div>
      <div>
        <label class="block font-bold text-slate-700 mb-1">Motivo de la eliminación *</label>
        <select v-model="formBaja.motivo" class="w-full p-2 border rounded-lg bg-white font-bold">
          <option value="" disabled>-- Selecciona el motivo --</option>
          <option v-for="m in MOTIVOS_BAJA" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>
      <div>
        <label class="block font-bold text-slate-700 mb-1">Explica por qué se elimina *</label>
        <textarea v-model="formBaja.detalle" rows="3" placeholder="Ej: Vendido a Constructora XX, factura 1234, entregado el 05-11-2026." class="w-full p-2 border rounded-lg"></textarea>
        <p v-if="formBaja.detalle.trim().length < 5" class="text-[10px] text-slate-400">Escribe al menos una frase.</p>
      </div>
      <div>
        <label class="block font-bold text-rose-700 mb-1">Para confirmar escribe el AFI: <span class="font-mono">{{ formBaja.equipo.afi }}</span></label>
        <input type="text" v-model="formBaja.confirmaAfi" class="w-full p-2 border-2 border-rose-300 rounded-lg font-mono font-bold">
      </div>
      <p class="text-[10px] text-slate-500 bg-amber-50 border border-amber-200 rounded p-2"><i class="fa-solid fa-circle-info text-amber-600"></i> El historial de mantenciones y movimientos del equipo NO se borra. Queda un registro con el motivo, la fecha y quién lo eliminó (Inventario AFI → Equipos eliminados), desde donde se puede restaurar.</p>
    </div>
    <div class="px-6 py-3 border-t bg-slate-100 flex justify-end gap-2">
      <button @click="showModalBaja = false" class="bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold px-4 py-2 rounded-lg">Cancelar</button>
      <button @click="confirmarBajaEquipo" :disabled="!puedeConfirmarBaja || eliminandoEquipo" class="bg-rose-600 hover:bg-rose-700 text-white font-bold px-5 py-2 rounded-lg shadow disabled:opacity-40">
        <i :class="['fa-solid', eliminandoEquipo ? 'fa-spinner fa-spin' : 'fa-trash']"></i> Eliminar equipo
      </button>
    </div>
  </div>
</div>

<!-- MODAL REGISTRO DE EQUIPOS ELIMINADOS -->
<div v-if="showModalEliminados" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-xs">
  <div class="bg-white rounded-2xl shadow-2xl border w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
    <div class="px-6 py-4 bg-slate-800 text-white flex items-center justify-between">
      <h3 class="text-sm font-bold"><i class="fa-solid fa-box-archive mr-1.5 text-rose-300"></i> Registro de equipos eliminados ({{ dbEliminados.length }})</h3>
      <button @click="showModalEliminados = false" class="text-slate-300 hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
    </div>
    <div class="p-4 border-b flex flex-wrap gap-2 items-center justify-between">
      <input type="text" v-model="buscarEliminados" placeholder="Buscar AFI, motivo, usuario..." class="p-2 border rounded-lg w-72">
      <button @click="exportarEliminados(exportarCSV)" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-lg"><i class="fa-solid fa-file-excel"></i> Exportar</button>
    </div>
    <div class="overflow-auto flex-grow">
      <table class="w-full text-left">
        <thead class="bg-slate-100 text-slate-600 uppercase text-[9px] sticky top-0">
          <tr><th class="p-2">Fecha</th><th class="p-2">AFI</th><th class="p-2">Equipo</th><th class="p-2">Motivo</th><th class="p-2">Detalle</th><th class="p-2">Eliminado por</th><th class="p-2">Estado</th></tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="r in eliminadosFiltrados" :key="r.id" :class="r.restaurado_at ? 'bg-emerald-50/50' : 'hover:bg-slate-50'">
            <td class="p-2 font-mono whitespace-nowrap">{{ fmtFechaHoraBaja(r.fecha) }}</td>
            <td class="p-2 font-mono font-bold text-amber-700 whitespace-nowrap">AFI {{ r.afi }}</td>
            <td class="p-2">{{ r.tipo }}<span class="block text-slate-500">{{ r.marca }} {{ r.modelo }}</span></td>
            <td class="p-2"><span class="font-bold text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded whitespace-nowrap">{{ r.motivo }}</span></td>
            <td class="p-2 text-slate-700 max-w-md">{{ r.detalle }}</td>
            <td class="p-2 whitespace-nowrap">{{ r.usuario || '-' }}</td>
            <td class="p-2 whitespace-nowrap">
              <span v-if="r.restaurado_at" class="text-[10px] font-bold text-emerald-700"><i class="fa-solid fa-rotate-left"></i> Restaurado {{ fmtFechaHoraBaja(r.restaurado_at) }}<span class="block font-normal text-slate-500">por {{ r.restaurado_por || '-' }}</span></span>
              <button v-else-if="isAdmin" @click="restaurarEquipo(r)" class="bg-sky-100 hover:bg-sky-200 text-sky-800 font-bold px-2 py-1 rounded"><i class="fa-solid fa-rotate-left"></i> Restaurar</button>
              <span v-else class="text-slate-400">Eliminado</span>
            </td>
          </tr>
          <tr v-if="!eliminadosFiltrados.length"><td colspan="7" class="p-8 text-center text-slate-400 font-bold">No hay equipos eliminados.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
`;
