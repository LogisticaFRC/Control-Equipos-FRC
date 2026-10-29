// Plantilla HTML del componente 'modal-nuevo-equipo' (extraída del index original)
export default /* html */ `
<div v-if="showModalNuevoEquipo" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-2xl border w-full max-w-lg overflow-hidden flex flex-col">
    <div class="bg-amber-500 px-6 py-4 flex justify-between items-center text-slate-950">
      <h3 class="font-extrabold uppercase tracking-wide flex items-center gap-2"><i class="fa-solid fa-truck-monster"></i> Agregar Nuevo Equipo AFI</h3>
      <button @click="showModalNuevoEquipo = false" class="text-slate-950/80 hover:text-slate-950"><i class="fa-solid fa-xmark text-lg"></i></button>
    </div>
    <div class="p-6 space-y-4 text-xs bg-slate-50">
      <div>
        <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Número AFI *</label>
        <input type="text" v-model="formNuevoEquipo.afi" placeholder="Ej: 510" class="w-full p-2.5 border rounded-lg bg-white font-bold text-amber-900">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Tipo de Equipo *</label>
          <input type="text" v-model="formNuevoEquipo.tipo" placeholder="Ej: Generador" class="w-full p-2.5 border rounded-lg bg-white">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Marca</label>
          <input type="text" v-model="formNuevoEquipo.marca" placeholder="Ej: Atlas Copco" class="w-full p-2.5 border rounded-lg bg-white">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Modelo</label>
          <input type="text" v-model="formNuevoEquipo.modelo" placeholder="Ej: QAS 100" class="w-full p-2.5 border rounded-lg bg-white">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Ubicación</label>
          <input type="text" v-model="formNuevoEquipo.ubicacion" placeholder="Ej: Bodega / Obra" class="w-full p-2.5 border rounded-lg bg-white">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Disponibilidad</label>
          <select v-model="formNuevoEquipo.disponibilidad" class="w-full p-2.5 border rounded-lg bg-white font-bold text-blue-800">
            <option value="Operativo">Trabajando / Operativo</option>
            <option value="Disponible">Disponible</option>
            <option value="En Traslado">En Traslado</option>
            <option value="En Mantencion">En Mantención</option>
            <option value="Fuera de Servicio">Fuera de Servicio</option>
            <option value="Venta">En Venta</option>
          </select>
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Frecuencia Mantención (h)</label>
          <input type="number" v-model="formNuevoEquipo.frecuenciaMantencion" class="w-full p-2.5 border rounded-lg bg-white font-mono font-bold">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Horómetro Inicial</label>
          <input type="number" step="any" v-model="formNuevoEquipo.horometroActual" placeholder="0" class="w-full p-2.5 border rounded-lg bg-white font-mono font-bold">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">GPS</label>
          <select v-model="formNuevoEquipo.gps" class="w-full p-2.5 border rounded-lg bg-white font-bold">
            <option value="Sin GPS">Sin GPS</option>
            <option value="Instalado">Instalado</option>
          </select>
        </div>
      </div>
    </div>
    <div class="px-6 py-4 bg-white border-t flex justify-end gap-2">
      <button @click="showModalNuevoEquipo = false" class="px-4 py-2 rounded-lg font-bold bg-slate-200 text-slate-800 text-xs">Cancelar</button>
      <button @click="guardarNuevoEquipo" :disabled="!formNuevoEquipo.afi || !formNuevoEquipo.tipo" class="px-5 py-2 rounded-lg font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 shadow-md text-xs">Guardar Equipo</button>
    </div>
  </div>
</div>
`;
