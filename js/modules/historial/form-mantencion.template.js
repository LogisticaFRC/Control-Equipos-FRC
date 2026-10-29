// Plantilla HTML del componente 'form-mantencion' (extraída del index original)
export default /* html */ `
      <div v-if="showFormMantencionModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl border w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
          <div class="px-6 py-4 border-b flex items-center justify-between bg-slate-800 text-white">
            <h3 class="text-sm font-bold flex items-center gap-2"><i class="fa-solid fa-wrench text-amber-400"></i> {{ isEditingMantencion ? 'Editar Mantención' : 'Registrar Nueva Mantención' }}</h3>
            <button @click="showFormMantencionModal = false" class="text-slate-300 hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
          </div>
          <div class="p-6 overflow-y-auto space-y-5 text-xs flex-grow">
            <!-- ADJUNTO DE DOCUMENTO -->
<div class="bg-slate-50 p-4 rounded-xl border space-y-2">
  <label class="block font-bold mb-1 text-slate-700">Adjuntar Documento / PDF / Factura</label>
  <input type="file" @change="subirArchivoHistorial" accept=".pdf,image/*" class="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100">
  <p v-if="formMant.linkDrive" class="text-[10px] text-emerald-700 font-bold">
    <i class="fa-solid fa-check"></i> Archivo ya adjunto y vinculado correctamente.
  </p>
</div>
            <!-- INFORMES PRINCIPALES -->
            <div class="bg-slate-50 p-4 rounded-xl border space-y-3">
              <h4 class="font-bold text-slate-800 uppercase">Informes Principales</h4>
              <div class="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-3">
                <div><label class="block font-bold mb-1">AFI *</label><select v-model="formMant.afi" class="w-full p-2 border rounded-lg bg-white font-bold"><option value="">-- AFI --</option><option v-for="e in dbEquipos" :key="e.id" :value="e.afi">AFI {{ e.afi }} - {{ e.tipo }}</option></select></div>
                <div><label class="block font-bold mb-1">Fecha *</label><input type="date" v-model="formMant.fecha" class="w-full p-2 border rounded-lg bg-white"></div>
                <div><label class="block font-bold mb-1">Lugar</label><input type="text" v-model="formMant.lugar" class="w-full p-2 border rounded-lg bg-white" placeholder="Opcional"></div>
                <div><label class="block font-bold mb-1">Horómetro</label><input type="number" step="any" v-model="formMant.horometro" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div>
                  <label class="block font-bold mb-1 text-indigo-700">Programa (Opcional)</label>
                  <select v-model="formMant.programaCorrespondiente" class="w-full p-2 border border-indigo-300 rounded-lg bg-indigo-50 font-bold text-indigo-900">
                    <option value="">-- Sin Programa --</option>
                    <option v-for="p in dbProgramasCalendarios" :key="p.id" :value="p.nombre_programa || p.mes">[{{ p.carpeta || p.tipo }}] {{ p.nombre_programa || p.mes }}</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- CLASIFICACIÓN Y HORAS -->
            <div class="bg-slate-50 p-4 rounded-xl border space-y-3">
              <h4 class="font-bold text-slate-800 uppercase">Clasificación & Horarios de Trabajo</h4>
              <div class="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <div class="md:col-span-2"><label class="block font-bold mb-1">Causa</label><select v-model="formMant.causa" class="w-full p-2 border rounded-lg bg-white font-bold"><option value="">-- Seleccionar --</option><option v-for="c in listaCausas" :key="c" :value="c">{{ c }}</option></select></div>
                <div>
                  <label class="block font-bold mb-1">Tipo / Horas</label>
                  <select v-model="formMant.tipoMant" class="w-full p-2 border rounded-lg bg-white font-bold text-amber-900">
                    <option value="">-- Seleccionar --</option>
                    <option value="PREVENTIVA 250 HRS">PREVENTIVA 250 hrs</option>
                    <option value="PREVENTIVA 500 HRS">PREVENTIVA 500 hrs</option>
                    <option value="PREVENTIVA 1000 HRS">PREVENTIVA 1000 hrs</option>
                    <option value="MANTENCION INTERMEDIA">Mantención Intermedia</option>
                    <option value="PREVENTIVA">Preventiva (General)</option>
                    <option value="PREDICTIVA">Predictiva</option>
                    <option value="CORRECTIVA">Correctiva</option>
                  </select>
                </div>
                <div><label class="block font-bold mb-1">Hora Inicio</label><input type="time" v-model="formMant.horaInicio" class="w-full p-2 border rounded-lg bg-white font-mono font-bold text-sky-700"></div>
                <div><label class="block font-bold mb-1">Hora Término</label><input type="time" v-model="formMant.horaTermino" class="w-full p-2 border rounded-lg bg-white font-mono font-bold text-sky-700"></div>
                <div>
                  <label class="block font-bold mb-1 text-amber-800">Total Calculado</label>
                  <div class="w-full p-2 border rounded-lg bg-amber-50 font-mono font-bold text-amber-900 text-center">{{ calcularRestaHoras(formMant.horaInicio, formMant.horaTermino) }}</div>
                </div>
              </div>
            </div>

            <!-- MECÁNICOS Y DESCRIPCIÓN -->
            <div class="bg-slate-50 p-4 rounded-xl border space-y-3">
              <h4 class="font-bold text-slate-800 uppercase">Personal Técnico & Descripción</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div><label class="block font-bold mb-1">Mecánico 1</label><input type="text" v-model="formMant.mec1" placeholder="Nombre..." class="w-full p-2 border rounded-lg bg-white"></div>
                <div><label class="block font-bold mb-1">Mecánico 2</label><input type="text" v-model="formMant.mec2" placeholder="Nombre..." class="w-full p-2 border rounded-lg bg-white"></div>
                <div><label class="block font-bold mb-1">Mecánico 3</label><input type="text" v-model="formMant.mec3" placeholder="Nombre..." class="w-full p-2 border rounded-lg bg-white"></div>
                <div><label class="block font-bold mb-1">Mecánico 4</label><input type="text" v-model="formMant.mec4" placeholder="Nombre..." class="w-full p-2 border rounded-lg bg-white"></div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div><label class="block font-bold mb-1">Causa Detallada</label><input type="text" v-model="formMant.causaDetallada" placeholder="Detalle causa..." class="w-full p-2 border rounded-lg bg-white"></div>
                <div><label class="block font-bold mb-1">Descripción del Trabajo</label><input type="text" v-model="formMant.descripcion" placeholder="Descripción..." class="w-full p-2 border rounded-lg bg-white"></div>
                <div><label class="block font-bold mb-1">Interferencia</label><input type="text" v-model="formMant.interferencia" placeholder="Interferencia..." class="w-full p-2 border rounded-lg bg-white"></div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                <div><label class="block font-bold mb-1">Empresa / Arriendo</label><input type="text" v-model="formMant.empresaArriendo" placeholder="Empresa..." class="w-full p-2 border rounded-lg bg-white"></div>
                <div><label class="block font-bold mb-1">Costo ($)</label><input type="number" v-model="formMant.costo" placeholder="0" class="w-full p-2 border rounded-lg bg-white font-mono"></div>
                <div><label class="block font-bold mb-1">N° OC</label><input type="text" v-model="formMant.numeroOC" placeholder="OC..." class="w-full p-2 border rounded-lg bg-white font-mono"></div>
                <div><label class="block font-bold mb-1">N° OT</label><input type="text" v-model="formMant.numeroOT" placeholder="OT..." class="w-full p-2 border rounded-lg bg-white font-mono"></div>
              </div>
            </div>

            <!-- REGISTRO DE FILTROS -->
            <div class="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 space-y-3">
              <div class="flex justify-between items-center">
                <h4 class="font-bold text-emerald-900 uppercase flex items-center gap-1.5"><i class="fa-solid fa-filter"></i> Registro de Filtros Utilizados</h4>
                <button @click="agregarFilaFiltro" type="button" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-[11px] font-bold shadow"><i class="fa-solid fa-plus"></i> Añadir Filtro</button>
              </div>
              <div v-if="formMant.filtrosLista.length === 0" class="text-xs text-slate-500 italic text-center py-2">No se han agregado filtros en este registro. Haz clic en "+ Añadir Filtro".</div>
              <div v-for="(f, index) in formMant.filtrosLista" :key="index" class="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center bg-white p-2.5 rounded-lg border">
                <div>
                  <label class="block text-[10px] font-bold text-slate-600">Tipo de Filtro</label>
                  <input type="text" v-model="f.tipo" placeholder="Ej: Aceite / Aire" class="w-full p-1.5 border rounded text-xs">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-600">Marca</label>
                  <input type="text" v-model="f.marca" placeholder="Ej: Donaldson / Baldwin" class="w-full p-1.5 border rounded text-xs">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-600">Código</label>
                  <input type="text" v-model="f.codigo" placeholder="Ej: P550388" class="w-full p-1.5 border rounded text-xs font-mono font-bold">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-600">Cantidad</label>
                  <input type="number" v-model="f.cantidad" placeholder="1" class="w-full p-1.5 border rounded text-xs font-mono font-bold">
                </div>
                <div class="flex justify-end pt-4">
                  <button @click="eliminarFilaFiltro(index)" type="button" class="bg-rose-100 hover:bg-rose-200 text-rose-700 px-2.5 py-1.5 rounded font-bold text-xs"><i class="fa-solid fa-trash"></i></button>
                </div>
              </div>
            </div>

            <!-- CONSUMO DE ACEITES E INSUMOS -->
            <div class="bg-amber-50/70 p-4 rounded-xl border border-amber-200 space-y-3">
              <h4 class="font-bold text-amber-900 uppercase flex items-center gap-1.5"><i class="fa-solid fa-oil-can"></i> Consumo de Aceites e Insumos (Litros) - Opcional</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">15W40 CI-4</label><input type="number" step="any" v-model="formMant.aceite_15w40_ci4" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">15W40 CK-4</label><input type="number" step="any" v-model="formMant.aceite_15w40_ck4" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">Refrigerante 50/50</label><input type="number" step="any" v-model="formMant.aceite_refrigerante_50" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">Aceite 80W90</label><input type="number" step="any" v-model="formMant.aceite_80w90" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">Dacnis 68</label><input type="number" step="any" v-model="formMant.aceite_dacnis_68" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">Dacnis 46</label><input type="number" step="any" v-model="formMant.aceite_dacnis_46" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">Paroil M Extreme</label><input type="number" step="any" v-model="formMant.paroil_m_extreme" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">Paroil S Extreme</label><input type="number" step="any" v-model="formMant.paroil_s_extreme" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">Aceite 5W30</label><input type="number" step="any" v-model="formMant.aceite_5w30" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">Líquido Freno DOT-4</label><input type="number" step="any" v-model="formMant.liquido_freno_dot4" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">Tractofluid (10W30)</label><input type="number" step="any" v-model="formMant.tractofluid_10w30" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">SAE 30</label><input type="number" step="any" v-model="formMant.sae_30" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">Hydra 46</label><input type="number" step="any" v-model="formMant.hydra46" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">Hydra 68</label><input type="number" step="any" v-model="formMant.hydra_68" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">Adblue</label><input type="number" step="any" v-model="formMant.adblue" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">Aceite 75W90</label><input type="number" step="any" v-model="formMant.aceite_75w90" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">Aceite 10W40</label><input type="number" step="any" v-model="formMant.aceite_10w40" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">Multipurpose</label><input type="number" step="any" v-model="formMant.multiproposito" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">Desengrasante</label><input type="number" step="any" v-model="formMant.desegransante" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div><label class="block font-bold mb-1 text-[11px] text-amber-900">Ácido Muriático</label><input type="number" step="any" v-model="formMant.acido_muriatico" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
              </div>
            </div>
          </div>
          <div class="px-6 py-3 border-t bg-slate-100 flex justify-end gap-2">
            <button @click="showFormMantencionModal = false" class="bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold px-4 py-2 rounded-lg">Cancelar</button>
            <button @click="guardarMantencionForm" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-lg shadow"><i class="fa-solid fa-floppy-disk"></i> Guardar</button>
          </div>
        </div>
      </div>
`;
