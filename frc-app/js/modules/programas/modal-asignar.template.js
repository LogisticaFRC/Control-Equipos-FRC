// Plantilla HTML del componente 'modal-asignar' (extraída del index original)
export default /* html */ `
<div v-if="showModalAsignarEquipo" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-xl border w-full max-w-lg overflow-hidden flex flex-col">
    <div class="bg-rose-600 px-6 py-4 flex justify-between items-center text-white">
      <h3 class="font-bold uppercase tracking-wide flex items-center gap-2"><i class="fa-solid fa-truck-monster"></i> Asignar Equipo al Programa</h3>
      <button @click="showModalAsignarEquipo=false" class="text-white/80 hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
    </div>
    <div class="p-6 space-y-4 text-xs bg-slate-50">
      <div>
        <label class="block font-bold text-slate-700 mb-1">Seleccionar Programa</label>
        <select v-model="formAsignar.programa_id" @change="actualizarTipoSegunProgramaSeleccionado" class="w-full p-2.5 border rounded-lg bg-white font-bold">
          <option value="">-- Elige Programa --</option>
          <option v-for="p in dbProgramasCalendarios" :key="p.id" :value="p.id">[{{ p.carpeta || p.tipo }}] {{ p.nombre_programa || p.mes }} ({{ formatDateForDisplay(p.fecha_inicio_programa) }} al {{ formatDateForDisplay(p.fecha_termino_programa) }})</option>
        </select>
      </div>
      <div>
        <label class="block font-bold text-slate-700 mb-1">Equipo (AFI)</label>
        <select v-model="formAsignar.afi" class="w-full p-2.5 border rounded-lg bg-white font-bold text-amber-900">
          <option value="">-- Seleccionar Equipo --</option>
          <option v-for="e in dbEquipos" :key="e.id" :value="e.afi">AFI {{ e.afi }} - {{ e.tipo }} ({{ e.marca }})</option>
        </select>
      </div>

      <!-- CAMPOS DINÁMICOS SEGÚN SI ES REPARACIÓN O MANTENCIÓN -->
      <template v-if="formAsignar.tipo === 'Reparación'">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Nave</label>
            <select v-model="formAsignar.nave" class="w-full p-2.5 border rounded-lg bg-white font-bold text-amber-900">
              <option value="NAVE 1">Nave 1</option>
              <option value="NAVE 2">Nave 2</option>
              <option value="NAVE 3">Nave 3</option>
              <option value="NAVE 4">Nave 4</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Condición</label>
            <select v-model="formAsignar.condicion" class="w-full p-2.5 border rounded-lg bg-white font-semibold text-blue-700">
              <option value="Arriendo">Arriendo</option><option value="Venta">Venta</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Fecha Inicio (Rango)</label>
            <input type="date" v-model="formAsignar.fecha_programada" class="w-full p-2.5 border rounded-lg bg-white font-mono font-bold">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Fecha Fin (Rango)</label>
            <input type="date" v-model="formAsignar.fecha_fin" class="w-full p-2.5 border rounded-lg bg-white font-mono font-bold">
          </div>
        </div>
      </template>

      <template v-else>
        <div>
          <label class="block font-bold text-slate-700 mb-1 text-indigo-900">Fecha Programada (Día Fijo)</label>
          <input type="date" v-model="formAsignar.fecha_programada" class="w-full p-2.5 border border-indigo-300 rounded-lg bg-indigo-50 font-mono font-bold">
        </div>
      </template>

    </div>
    <div class="px-6 py-4 bg-white border-t flex justify-end gap-2">
      <button @click="showModalAsignarEquipo=false" class="px-4 py-2 rounded-lg font-bold bg-slate-200 text-slate-800 text-xs">Cancelar</button>
      <button @click="guardarAsignacionEquipo" :disabled="!formAsignar.programa_id || !formAsignar.afi || !formAsignar.fecha_programada" class="px-5 py-2 rounded-lg font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white shadow-md text-xs">Guardar en Calendario</button>
    </div>
  </div>
</div>
`;
