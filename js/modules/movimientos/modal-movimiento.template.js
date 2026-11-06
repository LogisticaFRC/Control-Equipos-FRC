// Plantilla HTML del componente 'modal-movimiento' (extraída del index original)
export default /* html */ `
<div v-if="showModalMovimiento" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-xl border w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
    <div class="bg-amber-500 px-6 py-4 flex justify-between items-center text-slate-950">
      <h3 class="font-extrabold uppercase tracking-wide flex items-center gap-2"><i :class="['fa-solid', formMov.id ? 'fa-pen-to-square' : 'fa-truck-ramp-box']"></i> {{ formMov.id ? 'Editar Movimiento' : 'Registrar Nuevo Movimiento' }}</h3>
      <button @click="showModalMovimiento = false" class="text-slate-950/80 hover:text-slate-950"><i class="fa-solid fa-xmark text-lg"></i></button>
    </div>
    <div class="p-6 space-y-4 text-xs bg-slate-50 overflow-y-auto">
      <div>
        <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Equipo (AFI)</label>
        <select v-model="formMov.afi" @change="alCambiarAfiMov" class="w-full p-2.5 border rounded-lg bg-white font-bold text-amber-900">
          <option value="">-- Seleccionar Equipo --</option>
          <option v-for="e in dbEquipos" :key="e.id" :value="e.afi">AFI {{ e.afi }} - {{ e.tipo }} {{ e.marca }} {{ e.modelo }}</option>
        </select>
        <!-- Datos del equipo elegido -->
        <div v-if="equipoMov" class="mt-2 grid grid-cols-3 gap-2">
          <div class="bg-white border rounded-lg p-2"><p class="text-[9px] font-bold text-slate-500 uppercase">Tipo equipo</p><p class="font-extrabold text-slate-800">{{ equipoMov.tipo || '-' }}</p></div>
          <div class="bg-white border rounded-lg p-2"><p class="text-[9px] font-bold text-slate-500 uppercase">Marca</p><p class="font-extrabold text-slate-800">{{ equipoMov.marca || '-' }}</p></div>
          <div class="bg-white border rounded-lg p-2"><p class="text-[9px] font-bold text-slate-500 uppercase">Modelo</p><p class="font-extrabold text-slate-800">{{ equipoMov.modelo || '-' }}</p></div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Fecha</label>
          <input type="date" v-model="formMov.fecha" class="w-full p-2.5 border rounded-lg bg-white font-mono font-bold">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Tipo de Movimiento</label>
          <input type="text" v-model="formMov.tipo" placeholder="Ej: Traslado de obra" class="w-full p-2.5 border rounded-lg bg-white">
        </div>
      </div>
      <!-- ORIGEN: se toma solo de la locación actual del equipo -->
      <div class="p-3 rounded-lg border bg-white">
        <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]"><i class="fa-solid fa-location-crosshairs text-slate-500"></i> Origen (dónde está hoy)</label>
        <input type="text" v-model="formMov.origen" placeholder="Ubicación anterior..." class="w-full p-2 border rounded-lg bg-slate-50 font-semibold text-slate-700">
        <p v-if="origenRuta" class="text-[10px] text-slate-500 mt-0.5"><i class="fa-solid fa-sitemap"></i> {{ origenRuta }}</p>
      </div>
      <!-- DESTINO: Empresa → Área → Sector → Locación (o crear nueva) -->
      <div class="p-3 rounded-lg border-2 border-emerald-200 bg-emerald-50/40 space-y-1">
        <label class="block font-extrabold text-emerald-800 uppercase text-[11px]"><i class="fa-solid fa-flag-checkered"></i> Destino</label>
        <div v-if="formMov.id" class="mb-1">
          <label class="block font-bold text-slate-600 text-[10px] uppercase">Destino guardado</label>
          <input type="text" v-model="formMov.destino" class="w-full p-2 border rounded-lg bg-white font-semibold">
          <p class="text-[10px] text-slate-500 mt-0.5">Para cambiarlo por una locación del módulo Áreas, elígela abajo (si dejas las listas vacías se guarda el texto de arriba).</p>
        </div>
        <selector-locacion :sel="formMov.sel" compacto></selector-locacion>
        <p class="text-[10px] text-slate-500">¿No existe? Elige <b>➕ Crear nueva…</b> en la lista que corresponda (empresa, área, sector o locación) y escribe el nombre: se crea al guardar el movimiento y queda en el módulo Áreas.</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Nuevo Estado / Disponibilidad</label>
          <select v-model="formMov.estado" class="w-full p-2.5 border rounded-lg bg-white font-bold text-blue-800">
            <option value="Operativo">Trabajando / Operativo</option>
            <option value="Disponible">Disponible</option>
            <option value="En Traslado">En Traslado</option>
            <option value="En Mantencion">En Mantención</option>
            <option value="Fuera de Servicio">Fuera de Servicio</option>
            <option value="Venta">En Venta</option>
            <option v-if="formMov.estado && !['Operativo','Disponible','En Traslado','En Mantencion','Fuera de Servicio','Venta'].includes(formMov.estado)" :value="formMov.estado">{{ formMov.estado }}</option>
          </select>
        </div>
      </div>
      <label v-if="formMov.id" :class="['flex items-start gap-2 p-3 rounded-lg border cursor-pointer', formMov.esUltimo ? 'bg-sky-50 border-sky-200' : 'bg-slate-100 border-slate-200 opacity-70']">
        <input type="checkbox" v-model="formMov.actualizarEquipo" :disabled="!formMov.esUltimo" class="mt-0.5">
        <span><b>Actualizar también el equipo</b> (ubicación, estado y empresa) con estos datos.
          <span class="block text-[10px] text-slate-500">{{ formMov.esUltimo ? 'Es el último movimiento de este equipo.' : 'Solo disponible en el último movimiento del equipo (este es uno anterior: se corrige solo el registro).' }}</span></span>
      </label>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Camión Encargado</label>
          <input type="text" v-model="formMov.camion" placeholder="Patente camión..." class="w-full p-2.5 border rounded-lg bg-white">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1 uppercase text-[11px]">Conductor</label>
          <input type="text" v-model="formMov.conductor" placeholder="Nombre conductor..." class="w-full p-2.5 border rounded-lg bg-white">
        </div>
      </div>
    </div>
    <div class="px-6 py-4 bg-white border-t flex justify-end gap-2">
      <button @click="showModalMovimiento = false" class="px-4 py-2 rounded-lg font-bold bg-slate-200 text-slate-800 text-xs">Cancelar</button>
      <button @click="guardarNuevoMovimiento" :disabled="!formMov.afi || !formMov.fecha" class="px-5 py-2 rounded-lg font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 shadow-md text-xs">{{ formMov.id ? 'Guardar cambios' : 'Guardar Movimiento' }}</button>
    </div>
  </div>
</div>
`;
