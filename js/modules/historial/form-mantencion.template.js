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
  <div class="flex flex-wrap items-center justify-between gap-2">
    <label class="block font-bold text-slate-700">Adjuntar Documento / PDF / Factura</label>
    <label class="flex items-center gap-1.5 font-semibold text-indigo-800" title="Lee lo impreso de la hoja: tipo de hoja, N° de folio, si trae ART u OC. La letra a mano se completa a mano."><input type="checkbox" v-model="leerAlAdjuntar"> <i class="fa-solid fa-wand-magic-sparkles"></i> Leer el documento al adjuntar</label>
  </div>
  <input type="file" @change="subirArchivoHistorial" accept=".pdf,image/*" class="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100">
  <p v-if="formMant.linkDrive" class="text-[10px] text-emerald-700 font-bold">
    <i class="fa-solid fa-check"></i> Archivo ya adjunto y vinculado correctamente.
    <a :href="formMant.linkDrive" target="_blank" rel="noopener" class="underline ml-1">Ver</a>
  </p>
  <p v-if="lecturaForm.estado" class="text-[11px] text-indigo-700 font-bold"><i class="fa-solid fa-spinner fa-spin"></i> {{ lecturaForm.estado }}</p>
  <div v-else-if="lecturaForm.resumen" class="bg-indigo-50 border border-indigo-200 rounded-lg p-2 text-[11px] space-y-0.5">
    <p class="font-bold text-indigo-900"><i class="fa-solid fa-wand-magic-sparkles"></i> Leído: {{ lecturaForm.resumen }}</p>
    <p v-if="lecturaForm.cambios.length" class="text-indigo-800">Se completó: {{ lecturaForm.cambios.join(' · ') }}</p>
    <p v-else class="text-slate-500">No había campos vacíos que completar con lo leído.</p>
    <p v-for="(a, k) in lecturaForm.avisos" :key="k" class="text-amber-800 font-semibold"><i class="fa-solid fa-triangle-exclamation"></i> {{ a }}</p>
    <p class="text-slate-500">Lo escrito a mano (horómetro, horas, mecánicos, descripción) complétalo tú.</p>
  </div>
</div>
            <!-- INFORMES PRINCIPALES -->
            <div class="bg-slate-50 p-4 rounded-xl border space-y-3">
              <h4 class="font-bold text-slate-800 uppercase">Informes Principales</h4>
              <div class="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-3">
                <div><label class="block font-bold mb-1">AFI *</label><select v-model="formMant.afi" class="w-full p-2 border rounded-lg bg-white font-bold"><option value="">-- AFI --</option><option v-for="e in dbEquipos" :key="e.id" :value="e.afi">AFI {{ e.afi }} - {{ e.tipo }}</option></select></div>
                <div><label class="block font-bold mb-1">Fecha *</label><input type="date" v-model="formMant.fecha" class="w-full p-2 border rounded-lg bg-white"></div>
                <div><label class="block font-bold mb-1">Lugar</label><input type="text" v-model="formMant.lugar" class="w-full p-2 border rounded-lg bg-white" placeholder="Opcional"></div>
                <div><label class="block font-bold mb-1">{{ esPatente(formMant.afi) ? 'Kilometraje (km)' : 'Horómetro' }}</label><input type="number" step="any" v-model="formMant.horometro" class="w-full p-2 border rounded-lg bg-white font-mono font-bold" placeholder="0"></div>
                <div>
                  <label class="block font-bold mb-1 text-indigo-700">Programa (Opcional)</label>
                  <select v-model="formMant.programaCorrespondiente" class="w-full p-2 border border-indigo-300 rounded-lg bg-indigo-50 font-bold text-indigo-900">
                    <option value="">-- Sin Programa --</option>
                    <optgroup v-if="programasDelAfi(formMant.afi).length" :label="'Programas con el AFI ' + formMant.afi">
                      <option v-for="x in programasDelAfi(formMant.afi)" :key="'a' + x.prog.id" :value="x.nombre">[{{ x.prog.carpeta || x.prog.tipo }}] {{ x.nombre }}{{ x.pendientes.length ? ' · pendiente ' + formatDateForDisplay(x.pendientes[0]) : ' · ya realizado' }}</option>
                    </optgroup>
                    <optgroup label="Otros programas">
                      <option v-for="p in dbProgramasCalendarios.filter(p => !programasDelAfi(formMant.afi).some(x => x.prog.id === p.id))" :key="p.id" :value="p.nombre_programa || p.mes">[{{ p.carpeta || p.tipo }}] {{ p.nombre_programa || p.mes }}</option>
                    </optgroup>
                  </select>
                  <p v-if="formMant.programaCorrespondiente" class="text-[10px] text-indigo-700 mt-0.5"><i class="fa-solid fa-link"></i> Al guardar se marca REALIZADO en el programa (fecha programada más baja pendiente).</p>
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

            <!-- DATOS DE LA HOJA (ART, BLOQUEO, FOLIO, CAUSA DE LA FALLA) -->
            <div class="bg-slate-50 p-4 rounded-xl border space-y-3">
              <h4 class="font-bold text-slate-800 uppercase">Datos de la hoja</h4>
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                <div><label class="block font-bold mb-1">N° folio</label><input type="text" v-model="formMant.numeroFolio" placeholder="Ej. 000214" class="w-full p-2 border rounded-lg bg-white font-mono font-bold"></div>
                <div><label class="block font-bold mb-1">Uso de ART</label><select v-model="formMant.usoArt" class="w-full p-2 border rounded-lg bg-white font-bold"><option value="">—</option><option value="SI">SÍ</option><option value="NO">NO</option></select></div>
                <div><label class="block font-bold mb-1">Bloqueo de equipo</label><select v-model="formMant.bloqueo" class="w-full p-2 border rounded-lg bg-white font-bold"><option value="">—</option><option value="SI">SÍ</option><option value="NO">NO</option></select></div>
                <div><label class="block font-bold mb-1">Hora falla</label><input type="time" v-model="formMant.horaFalla" class="w-full p-2 border rounded-lg bg-white font-mono font-bold text-rose-700"></div>
                <div><label class="block font-bold mb-1">Causa de la falla</label><select v-model="formMant.causaFalla" class="w-full p-2 border rounded-lg bg-white font-bold"><option value="">—</option><option v-for="c in CAUSAS_FALLA_HOJA" :key="c" :value="c">{{ c }}</option></select></div>
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
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div><label class="block font-bold mb-1">Empresa / Arriendo</label><input type="text" v-model="formMant.empresaArriendo" placeholder="Empresa..." class="w-full p-2 border rounded-lg bg-white"></div>
                <div><label class="block font-bold mb-1">Costo ($)</label><input type="number" v-model="formMant.costo" placeholder="0" class="w-full p-2 border rounded-lg bg-white font-mono"></div>
                <div><label class="block font-bold mb-1">N° OT</label><input type="text" v-model="formMant.numeroOT" placeholder="OT..." class="w-full p-2 border rounded-lg bg-white font-mono"></div>
              </div>

              <!-- ÓRDENES DE COMPRA (una mantención puede tener varias OC → módulo OC) -->
              <div class="bg-white border border-emerald-300 rounded-xl p-3 space-y-2 mt-2">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <h5 class="font-bold text-emerald-900 uppercase flex items-center gap-1.5"><i class="fa-solid fa-file-invoice-dollar"></i> Órdenes de Compra (OC) de esta mantención</h5>
                  <span class="font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg">Total OC: {{ fmtCLP(totalOcsFormMant) }}</span>
                </div>
                <div class="flex flex-wrap gap-2 items-center">
                  <input v-model="ocNuevaFormMant" list="dl-fm-oc" @keydown.enter.prevent="agregarOCFormMant" type="text" placeholder="N° OC (puedes poner varias: 123, 456)" class="p-2 border rounded-lg font-mono w-72">
                  <datalist id="dl-fm-oc"><option v-for="o in dbOC" :key="o.id" :value="o.numero">{{ o.afi ? 'AFI ' + o.afi + ' · ' : '' }}{{ fmtCLP(o.precio) }} {{ o.proveedor }}</option></datalist>
                  <button type="button" @click="agregarOCFormMant" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-bold"><i class="fa-solid fa-plus"></i> Agregar OC</button>
                  <template v-if="ocsSugeridasFormMant.length">
                    <span class="text-[10px] text-slate-500 ml-1">OC del AFI sin vincular:</span>
                    <button v-for="o in ocsSugeridasFormMant" :key="o.id" type="button" @click="ocNuevaFormMant = o.numero; agregarOCFormMant()" class="text-[10px] font-bold px-2 py-1 rounded border border-dashed border-emerald-400 text-emerald-800 hover:bg-emerald-50">+ OC {{ o.numero }} ({{ fmtCLP(o.precio) }})</button>
                  </template>
                </div>
                <table v-if="ocsFormMant.length" class="w-full text-left">
                  <thead class="text-[10px] uppercase text-slate-500"><tr><th class="py-1">N° OC</th><th class="py-1">Proveedor</th><th class="py-1">Descripción</th><th class="py-1 text-right">Precio</th><th class="py-1 text-center">Doc.</th><th></th></tr></thead>
                  <tbody class="divide-y">
                    <tr v-for="d in ocsFormMant" :key="d.numero">
                      <td class="py-1.5 font-mono font-extrabold text-emerald-700">{{ d.numero }}</td>
                      <td class="py-1.5">{{ d.oc ? (d.oc.proveedor || '-') : '' }}<span v-if="!d.oc" class="text-amber-700 font-bold"><i class="fa-solid fa-triangle-exclamation"></i> No registrada en el módulo OC (precio $0)</span></td>
                      <td class="py-1.5 max-w-[260px] truncate">{{ d.oc?.descripcion || '' }}</td>
                      <td class="py-1.5 text-right font-mono font-bold">{{ fmtCLP(d.precio) }}</td>
                      <td class="py-1.5 text-center"><a v-if="d.oc?.link" :href="d.oc.link" target="_blank" rel="noopener" class="text-blue-700"><i class="fa-solid fa-paperclip"></i></a></td>
                      <td class="py-1.5 text-right"><button type="button" @click="quitarOCFormMant(d.numero)" class="text-rose-500 hover:text-rose-700 px-1" title="Quitar OC"><i class="fa-solid fa-xmark"></i></button></td>
                    </tr>
                  </tbody>
                  <tfoot><tr class="font-extrabold"><td colspan="3" class="pt-1.5 text-right uppercase text-[10px]">Total OC</td><td class="pt-1.5 text-right font-mono text-emerald-800">{{ fmtCLP(totalOcsFormMant) }}</td><td colspan="2"></td></tr></tfoot>
                </table>
                <p v-else class="text-slate-400 italic">Sin OC. Escribe el N° de la OC (registrada en el módulo OC) y presiona Agregar.</p>
              </div>
            </div>

            <!-- REGISTRO DE FILTROS (se guarda también en el módulo FILTROS por marca/modelo del equipo) -->
            <div class="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 space-y-3">
              <div class="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h4 class="font-bold text-emerald-900 uppercase flex items-center gap-1.5"><i class="fa-solid fa-filter"></i> Registro de Filtros Utilizados</h4>
                  <p v-if="equipoFormMant" class="text-[10px] text-emerald-800 mt-0.5">Equipo: <b>{{ equipoFormMant.marca || 'SIN MARCA' }} · {{ equipoFormMant.modelo || 'SIN MODELO' }}</b> — los filtros quedan asociados a esta marca y modelo.</p>
                </div>
                <div class="flex gap-2">
                  <button v-if="filtrosRequeridosFormMant.length" @click="cargarFiltrosDelModelo" type="button" class="bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-400 px-3 py-1 rounded text-[11px] font-bold shadow-sm"><i class="fa-solid fa-wand-magic-sparkles"></i> Cargar filtros del modelo</button>
                  <button @click="agregarFilaFiltro" type="button" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-[11px] font-bold shadow"><i class="fa-solid fa-plus"></i> Añadir Filtro</button>
                </div>
              </div>
              <div v-if="filtrosRequeridosFormMant.length" class="text-[10px] bg-white/70 border border-emerald-200 rounded-lg px-3 py-2 text-emerald-900">
                <b class="mr-2">Este modelo usa:</b>
                <span v-for="t in filtrosRequeridosFormMant" :key="t.tipo" class="inline-block mr-3">{{ t.cantidad }}× {{ t.tipo }}<span class="text-slate-500 ml-1">({{ t.filas.map(r => r.codigo).filter((c, i, a) => a.indexOf(c) === i).join(' / ') }})</span></span>
              </div>
              <div v-if="formMant.filtrosLista.length === 0" class="text-xs text-slate-500 italic text-center py-2">No se han agregado filtros en este registro. Haz clic en "+ Añadir Filtro".</div>
              <div v-for="(f, index) in formMant.filtrosLista" :key="index" class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 items-end bg-white p-2.5 rounded-lg border">
                <div>
                  <label class="block text-[10px] font-bold text-slate-600">Tipo de Filtro</label>
                  <input type="text" list="dl-mant-tipos" v-model="f.tipo" placeholder="Ej: ACEITE MOTOR" class="w-full p-1.5 border rounded text-xs uppercase">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-600">Marca</label>
                  <input type="text" list="dl-mant-marcas" v-model="f.marca" placeholder="Ej: Donaldson / Baldwin" class="w-full p-1.5 border rounded text-xs uppercase">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-600">Código</label>
                  <input type="text" v-model="f.codigo" @change="autocompletarFilaFiltro(f)" placeholder="Ej: P550388" class="w-full p-1.5 border rounded text-xs font-mono font-bold uppercase">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-600">Proveedor</label>
                  <input type="text" list="dl-mant-prov" v-model="f.proveedor" @change="autocompletarFilaFiltro(f, 'proveedor')" placeholder="Ej: SIKAR" class="w-full p-1.5 border rounded text-xs uppercase">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-600">Precio unitario ($)</label>
                  <input type="number" min="0" v-model="f.precio" placeholder="0" class="w-full p-1.5 border rounded text-xs font-mono font-bold">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-600">Cantidad</label>
                  <input type="number" min="1" v-model="f.cantidad" placeholder="1" class="w-full p-1.5 border rounded text-xs font-mono font-bold">
                </div>
                <div class="flex justify-end">
                  <button @click="eliminarFilaFiltro(index)" type="button" class="bg-rose-100 hover:bg-rose-200 text-rose-700 px-2.5 py-1.5 rounded font-bold text-xs"><i class="fa-solid fa-trash"></i></button>
                </div>
              </div>
              <datalist id="dl-mant-tipos"><option v-for="t in listaTiposFiltro" :key="t" :value="t"></option></datalist>
              <datalist id="dl-mant-marcas"><option v-for="m in listaMarcasFiltro" :key="m" :value="m"></option></datalist>
              <datalist id="dl-mant-prov"><option v-for="p in listaProveedoresFiltro" :key="p" :value="p"></option></datalist>
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
