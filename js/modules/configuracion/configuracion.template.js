// Plantilla HTML del componente 'configuracion' (extraída del index original)
export default /* html */ `
<section class="space-y-6">
  <!-- BOTÓN ESPECIAL EXPORTAR TODAS LAS TABLAS (SOLO ADMIN) -->
  <div v-if="isAdmin" class="bg-gradient-to-r from-emerald-800 to-slate-900 p-6 rounded-2xl shadow-xl text-white flex flex-wrap justify-between items-center gap-4">
    <div>
      <h3 class="text-base font-extrabold flex items-center gap-2"><i class="fa-solid fa-file-excel text-emerald-400 text-xl"></i> Exportar Base de Datos Completa</h3>
      <p class="text-xs text-slate-300 mt-1">Descarga todas las tablas del sistema en un solo archivo Excel con pestañas independientes para Inventario, Movimientos, Historial, Programas y Asignaciones.</p>
    </div>
    <button @click="exportarTodasLasTablasExcel" class="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold px-5 py-3 rounded-xl shadow-lg transition flex items-center gap-2 text-xs uppercase tracking-wider">
      <i class="fa-solid fa-download"></i> Descargar Todas las Tablas (Excel)
    </button>
  </div>

  <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
    <div class="flex items-center justify-between border-b pb-3">
      <div>
        <h3 class="text-base font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-users-gear text-amber-600"></i> Gestión de Usuarios</h3>
        <p class="text-xs text-slate-500">Crea nuevos usuarios guardados en Supabase.</p>
      </div>
      <span v-if="!isAdmin" class="text-xs bg-rose-100 text-rose-800 font-bold px-3 py-1 rounded">Requiere Sesión Admin</span>
    </div>

    <div v-if="isAdmin" class="bg-slate-50 p-4 rounded-xl border space-y-3 text-xs">
      <h4 class="font-bold text-slate-800 uppercase flex items-center gap-1.5"><i class="fa-solid fa-user-plus text-emerald-600"></i> Crear Nuevo Usuario</h4>
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div><label class="block font-bold mb-1">Usuario</label><input type="text" v-model="nuevoUsuario.usuario" class="w-full p-2 border rounded-lg bg-white"></div>
        <div><label class="block font-bold mb-1">Contraseña</label><input type="password" v-model="nuevoUsuario.clave" class="w-full p-2 border rounded-lg bg-white"></div>
        <div>
          <label class="block font-bold mb-1">Rol</label>
          <select v-model="nuevoUsuario.rol" class="w-full p-2 border rounded-lg bg-white font-bold">
            <option value="lectura">Solo Lectura</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <div class="flex items-end"><button @click="crearNuevoUsuario" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-2 rounded-lg shadow"><i class="fa-solid fa-plus-circle"></i> Guardar</button></div>
      </div>
    </div>

    <div class="overflow-x-auto border rounded-lg text-xs">
      <table class="w-full text-left border-collapse">
        <thead class="bg-slate-800 text-white uppercase text-[10px]">
          <tr><th class="p-2.5">USUARIO</th><th class="p-2.5">ROL</th><th v-if="isAdmin" class="p-2.5 text-center">ACCIONES</th></tr>
        </thead>
        <tbody class="divide-y bg-white">
          <tr v-for="u in dbUsuarios" :key="u.usuario" class="hover:bg-slate-50">
            <td class="p-2.5 font-bold text-slate-800">{{ u.usuario }}</td>
            <td class="p-2.5"><span :class="['px-2 py-0.5 rounded text-[10px] font-bold uppercase', u.rol === 'admin' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700']">{{ u.rol }}</span></td>
            <td v-if="isAdmin" class="p-2.5 text-center">
              <button v-if="u.usuario !== 'logistica'" @click="eliminarUsuario(u.usuario)" class="bg-rose-100 hover:bg-rose-200 text-rose-700 p-1 rounded font-bold"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
    <h3 class="text-base font-bold text-slate-800 flex items-center gap-2 border-b pb-3"><i class="fa-solid fa-palette text-violet-600"></i> Personalización & Importación</h3>
    <div v-if="isAdmin" class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border">
      <div><label class="block font-bold text-xs mb-1">Título</label><input type="text" v-model="config.title" class="w-full p-2 border rounded text-xs bg-white"></div>
      <div><label class="block font-bold text-xs mb-1">Subtítulo</label><input type="text" v-model="config.subtitle" class="w-full p-2 border rounded text-xs bg-white"></div>
      <div>
        <label class="block font-bold text-xs mb-1">Logo URL o Archivo</label>
        <input type="text" v-model="config.logo" class="w-full p-2 border rounded text-xs bg-white mb-2">
        <input type="file" @change="subirNuevaFotoLogo" accept="image/*" class="text-xs">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div><label class="block font-bold text-xs mb-1">Color Header</label><input type="color" v-model="config.customHeaderBg" class="w-full h-10 p-1 border rounded cursor-pointer"></div>
        <div><label class="block font-bold text-xs mb-1">Color Body</label><input type="color" v-model="config.customBodyBg" class="w-full h-10 p-1 border rounded cursor-pointer"></div>
      </div>
      <div class="md:col-span-2 flex justify-end">
        <button @click="guardarConfiguracionPersonalizada" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow"><i class="fa-solid fa-floppy-disk mr-1"></i> Guardar Cambios</button>
      </div>
    </div>

    <div class="border-t pt-4">
      <h4 class="font-bold text-xs text-slate-800 mb-3"><i class="fa-solid fa-file-import text-violet-600"></i> Importador de Bases de Datos</h4>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-slate-50 p-4 rounded-xl border space-y-3">
          <span class="font-bold text-xs">Inventario AFI</span>
          <label :class="['w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow', isAdmin ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-500']"><i class="fa-solid fa-file-excel"></i> Subir Excel<input type="file" :disabled="!isAdmin" @change="importarInventarioFile" accept=".xlsx, .xls, .csv" class="hidden"></label>
        </div>
        <div class="bg-slate-50 p-4 rounded-xl border space-y-3">
          <span class="font-bold text-xs">Movimientos</span>
          <label :class="['w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow', isAdmin ? 'bg-amber-600 text-white' : 'bg-slate-300 text-slate-500']"><i class="fa-solid fa-file-excel"></i> Subir Excel<input type="file" :disabled="!isAdmin" @change="importarMovimientosFile" accept=".xlsx, .xls, .csv" class="hidden"></label>
        </div>
        <div class="bg-slate-50 p-4 rounded-xl border space-y-3">
          <span class="font-bold text-xs">Historial (Mantenciones)</span>
          <label :class="['w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow', isAdmin ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-500']"><i class="fa-solid fa-file-excel"></i> Subir Excel<input type="file" :disabled="!isAdmin" @change="importarIntervencionesFile" accept=".xlsx, .xls, .csv" class="hidden"></label>
        </div>
      </div>
    </div>
  </div>
</section>
`;
