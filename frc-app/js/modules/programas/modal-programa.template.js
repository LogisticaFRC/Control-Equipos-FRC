// Plantilla HTML del componente 'modal-programa' (extraída del index original)
export default /* html */ `
<div v-if="showModalPrograma" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-xl border w-full max-w-lg overflow-hidden flex flex-col">
    <div :class="['px-6 py-4 flex justify-between items-center text-white', formProgMes.carpeta === 'REPARACION' ? 'bg-amber-500 text-slate-950' : 'bg-indigo-600']">
      <h3 class="font-bold uppercase tracking-wide flex items-center gap-2">
        <i :class="['fa-solid', formProgMes.carpeta === 'REPARACION' ? 'fa-wrench' : 'fa-oil-can']"></i>
        Crear Programa de {{ formProgMes.carpeta }}
      </h3>
      <button @click="showModalPrograma=false" class="hover:opacity-80"><i class="fa-solid fa-xmark text-lg"></i></button>
    </div>
    <div class="p-6 space-y-4 text-xs bg-slate-50">
      <div>
        <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Nombre del Programa</label>
        <input type="text" v-model="formProgMes.nombre_programa" class="w-full p-2.5 border rounded-lg bg-white uppercase font-bold text-slate-800" placeholder="Ej: MANTENCION AGOSTO 2026">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Fecha Inicio Programa</label>
          <input type="date" v-model="formProgMes.fecha_inicio_programa" class="w-full p-2.5 border rounded-lg bg-white font-mono font-bold">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Fecha Término Programa</label>
          <input type="date" v-model="formProgMes.fecha_termino_programa" class="w-full p-2.5 border rounded-lg bg-white font-mono font-bold">
        </div>
      </div>
    </div>
    <div class="px-6 py-4 bg-white border-t flex justify-end gap-2">
      <button @click="showModalPrograma=false" class="px-4 py-2 rounded-lg font-bold bg-slate-200 text-slate-800 text-xs">Cancelar</button>
      <button @click="guardarNuevoProgramaMes" :disabled="!formProgMes.nombre_programa.trim() || !formProgMes.fecha_inicio_programa || !formProgMes.fecha_termino_programa" :class="['px-5 py-2 rounded-lg font-bold disabled:opacity-50 shadow-md text-xs', formProgMes.carpeta === 'REPARACION' ? 'bg-amber-500 hover:bg-amber-600 text-slate-950' : 'bg-indigo-600 hover:bg-indigo-700 text-white']">
        Guardar Programa
      </button>
    </div>
  </div>
</div>
`;
