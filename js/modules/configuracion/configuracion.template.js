// Plantilla HTML del componente 'configuracion' (extraída del index original)
export default /* html */ `
<section class="space-y-6">
  <!-- BOTÓN ESPECIAL EXPORTAR TODAS LAS TABLAS (SOLO ADMIN GENERAL) -->
  <div v-if="esAdminGeneral" class="bg-gradient-to-r from-emerald-800 to-slate-900 p-6 rounded-2xl shadow-xl text-white flex flex-wrap justify-between items-center gap-4">
    <div>
      <h3 class="text-base font-extrabold flex items-center gap-2"><i class="fa-solid fa-file-excel text-emerald-400 text-xl"></i> Exportar Base de Datos Completa</h3>
      <p class="text-xs text-slate-300 mt-1">Descarga todas las tablas del sistema en un solo archivo Excel con pestañas independientes para Inventario, Movimientos, Historial, Programas y Asignaciones.</p>
    </div>
    <button @click="exportarTodasLasTablasExcel" class="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold px-5 py-3 rounded-xl shadow-lg transition flex items-center gap-2 text-xs uppercase tracking-wider">
      <i class="fa-solid fa-download"></i> Descargar Todas las Tablas (Excel)
    </button>
  </div>

  <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
      <div>
        <h3 class="text-base font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-users-gear text-amber-600"></i> Gestión de Usuarios y Permisos por Área</h3>
        <p class="text-xs text-slate-500">El <b>Admin general</b> tiene acceso total y es el único que gestiona usuarios. Los demás tienen un nivel por área: <b>Admin del área</b> (agregar, modificar y eliminar todo en esa área), <b>Subadmin</b> o <b>Solo lectura</b>. Con el botón <b>Módulos</b> (o un <b>perfil</b>) se elige exactamente qué submódulos ve cada usuario y qué puede hacer en cada uno. <b>Inicio y Mis Tareas</b> siempre se ven.</p>
      </div>
      <span v-if="!esAdminGeneral" class="text-xs bg-rose-100 text-rose-800 font-bold px-3 py-1 rounded">Requiere Admin general</span>
    </div>

    <!-- Crear usuario -->
    <div v-if="esAdminGeneral" class="bg-slate-50 p-4 rounded-xl border space-y-3 text-xs">
      <h4 class="font-bold text-slate-800 uppercase flex items-center gap-1.5"><i class="fa-solid fa-user-plus text-emerald-600"></i> Crear Nuevo Usuario</h4>
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div><label class="block font-bold mb-1">Usuario</label><input type="text" v-model="nuevoUsuario.usuario" class="w-full p-2 border rounded-lg bg-white"></div>
        <div><label class="block font-bold mb-1">Contraseña inicial</label><input type="password" v-model="nuevoUsuario.clave" autocomplete="new-password" class="w-full p-2 border rounded-lg bg-white"><p class="text-[10px] text-slate-500 mt-1">Mín. 10 caracteres, letras y números. Se le pedirá cambiarla al entrar.</p></div>
        <div>
          <label class="block font-bold mb-1">Tipo</label>
          <select v-model="nuevoUsuario.tipo" class="w-full p-2 border rounded-lg bg-white font-bold">
            <option value="areas">Permisos por área</option>
            <option value="general">Admin general (todo)</option>
          </select>
        </div>
        <div v-if="nuevoUsuario.tipo === 'areas'" class="sm:col-span-4">
          <label class="block font-bold mb-1">Perfil de acceso (opcional)</label>
          <select v-model="nuevoUsuario.perfilId" class="w-full sm:w-80 p-2 border rounded-lg bg-white font-bold">
            <option value="">Sin perfil · niveles por área (ve todos los módulos)</option>
            <option v-for="p in perfilesAcceso" :key="p.id" :value="p.id">{{ p.nombre }} ({{ contarModulos(p.modulos) }} módulos)</option>
          </select>
        </div>
        <div class="flex items-end"><button @click="crearNuevoUsuario" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-2 rounded-lg shadow"><i class="fa-solid fa-plus-circle"></i> Guardar</button></div>
      </div>
      <div v-if="nuevoUsuario.tipo === 'areas' && !nuevoUsuario.perfilId" class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
        <div v-for="a in AREAS_PERMISOS" :key="a.key" class="bg-white border rounded-lg p-2">
          <label class="block font-bold mb-1 text-[11px] text-slate-700"><i :class="['fa-solid mr-1 text-slate-500', a.icon]"></i>{{ a.label }}</label>
          <select v-model="nuevoUsuario.permisos[a.key]" class="w-full p-1.5 border rounded bg-white text-[11px]">
            <option v-for="n in NIVELES" :key="n.key" :value="n.key">{{ n.label }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Lista de usuarios y sus permisos -->
    <div class="overflow-x-auto border rounded-lg text-xs">
      <table class="w-full text-left border-collapse">
        <thead class="bg-slate-800 text-white uppercase text-[10px]">
          <tr>
            <th class="p-2.5">Usuario</th>
            <th class="p-2.5">Tipo</th>
            <th class="p-2.5 whitespace-nowrap"><i class="fa-solid fa-table-cells mr-1"></i>Acceso a módulos</th>
            <th v-for="a in AREAS_PERMISOS" :key="a.key" class="p-2.5 whitespace-nowrap"><i :class="['fa-solid mr-1', a.icon]"></i>{{ a.label }}</th>
            <th v-if="esAdminGeneral" class="p-2.5 text-center">Clave</th>
            <th v-if="esAdminGeneral" class="p-2.5 text-center">Eliminar</th>
          </tr>
        </thead>
        <tbody class="divide-y bg-white">
          <tr v-for="u in dbUsuarios" :key="u.usuario" class="hover:bg-slate-50">
            <td class="p-2.5 font-bold text-slate-800 whitespace-nowrap">{{ u.usuario }}<span v-if="u.usuario === USUARIO_PRINCIPAL" class="ml-1 text-[9px] text-amber-600 font-bold">PRINCIPAL</span></td>
            <td class="p-2.5">
              <select v-if="esAdminGeneral" :value="u.rol === 'admin' ? 'general' : 'areas'" @change="cambiarTipoUsuario(u, $event.target.value)"
                :class="['p-1.5 border rounded font-bold text-[11px]', u.rol === 'admin' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-white']">
                <option value="general">Admin general</option>
                <option value="areas">Por área</option>
              </select>
              <span v-else :class="['px-2 py-0.5 rounded text-[10px] font-bold uppercase', u.rol === 'admin' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700']">{{ u.rol === 'admin' ? 'Admin general' : 'Por área' }}</span>
            </td>
            <td class="p-2.5 whitespace-nowrap">
              <span v-if="u.rol === 'admin'" class="text-emerald-700 font-bold text-[11px]"><i class="fa-solid fa-check"></i> Todo</span>
              <template v-else>
                <span :class="['block text-[10px] font-bold', modulosDe(u) ? 'text-violet-700' : 'text-slate-500']">{{ resumenAcceso(u) }}</span>
                <button v-if="esAdminGeneral" @click="abrirAccesoUsuario(u)" class="mt-1 bg-violet-100 hover:bg-violet-200 text-violet-800 px-2 py-0.5 rounded font-bold text-[10px]"><i class="fa-solid fa-sliders mr-1"></i>Módulos</button>
              </template>
            </td>
            <td v-for="a in AREAS_PERMISOS" :key="a.key" class="p-2.5">
              <span v-if="u.rol === 'admin'" class="text-emerald-700 font-bold text-[11px]"><i class="fa-solid fa-check"></i> Total</span>
              <span v-else-if="modulosDe(u)" :class="['px-2 py-0.5 rounded text-[10px] font-bold border', claseNivel(nivelEnArea(a.key, u))]" title="Usuario con acceso por módulo: se cambia con el botón Módulos">{{ etiquetaNivel(nivelEnArea(a.key, u)) }} <i class="fa-solid fa-lock text-[8px] ml-0.5 opacity-60"></i></span>
              <select v-else-if="esAdminGeneral" :value="nivelEnArea(a.key, u)" @change="cambiarPermisoArea(u, a.key, $event.target.value)"
                :class="['p-1.5 border rounded text-[11px] font-semibold', claseNivel(nivelEnArea(a.key, u))]">
                <option v-for="n in NIVELES" :key="n.key" :value="n.key">{{ n.label }}</option>
              </select>
              <span v-else :class="['px-2 py-0.5 rounded text-[10px] font-bold', claseNivel(nivelEnArea(a.key, u))]">{{ etiquetaNivel(nivelEnArea(a.key, u)) }}</span>
            </td>
            <td v-if="esAdminGeneral" class="p-2.5 text-center whitespace-nowrap">
              <button @click="restablecerClave(u)" title="Asignar contraseña temporal" class="bg-amber-100 hover:bg-amber-200 text-amber-800 p-1 rounded font-bold"><i class="fa-solid fa-key"></i></button>
              <span v-if="u.debe_cambiar_clave" title="Aún no cambia su contraseña inicial" class="ml-1 text-[9px] font-bold text-amber-700">PENDIENTE</span>
            </td>
            <td v-if="esAdminGeneral" class="p-2.5 text-center">
              <button v-if="u.usuario !== USUARIO_PRINCIPAL" @click="eliminarUsuario(u.usuario)" class="bg-rose-100 hover:bg-rose-200 text-rose-700 p-1 rounded font-bold"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="esAdminGeneral" class="text-[11px] text-slate-500"><i class="fa-solid fa-circle-info mr-1"></i>Los cambios de permisos se guardan apenas eliges una opción. El usuario los ve aplicados al volver a iniciar sesión o actualizar la página.</p>
  </div>

  <!-- PERFILES DE ACCESO -->
  <div v-if="esAdminGeneral" class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
      <div>
        <h3 class="text-base font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-id-badge text-violet-600"></i> Perfiles de acceso</h3>
        <p class="text-xs text-slate-500">Plantillas de qué submódulos se ven y qué se puede hacer en cada uno (ej. "Bodega", "Mecánico", "Seguridad"). Se asignan al crear un usuario o con el botón <b>Módulos</b>.</p>
      </div>
      <button @click="abrirNuevoPerfil" class="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow"><i class="fa-solid fa-plus mr-1"></i> Nuevo perfil</button>
    </div>
    <div v-if="faltaTablaConfig" class="bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3 text-xs"><i class="fa-solid fa-database mr-1"></i> Para guardar perfiles falta la tabla <b>bd_config</b>: ejecuta <b>sql/costos_mantencion.sql</b> en Supabase. (El acceso por módulo de cada usuario funciona igual sin perfiles.)</div>
    <div v-if="!perfilesAcceso.length && !faltaTablaConfig" class="text-xs text-slate-400 italic">Aún no hay perfiles. Crea uno con "Nuevo perfil".</div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div v-for="p in perfilesAcceso" :key="p.id" class="border rounded-xl p-3 bg-slate-50 flex flex-col gap-2">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="font-extrabold text-slate-800 text-sm"><i class="fa-solid fa-id-badge text-violet-500 mr-1"></i>{{ p.nombre }}</div>
            <div v-if="p.descripcion" class="text-[11px] text-slate-500">{{ p.descripcion }}</div>
          </div>
          <span class="text-[10px] font-bold bg-violet-100 text-violet-800 rounded-full px-2 py-0.5 whitespace-nowrap">{{ contarModulos(p.modulos) }} / {{ TOTAL_MODULOS }} módulos</span>
        </div>
        <div class="flex flex-wrap gap-1">
          <span v-for="(n, k) in p.modulos" :key="k" :class="['text-[9px] font-bold px-1.5 py-0.5 rounded border', claseNivelModulo(n)]">{{ etiquetaModulo(k) }} · {{ cortoNivelModulo(n) }}</span>
        </div>
        <div class="text-[10px] text-slate-500"><i class="fa-solid fa-users mr-1"></i>{{ usuariosConPerfil(p).length ? usuariosConPerfil(p).join(', ') : 'Sin usuarios' }}</div>
        <div class="flex gap-2 mt-auto">
          <button @click="abrirEditarPerfil(p)" class="flex-1 bg-white border hover:bg-slate-100 text-slate-700 font-bold text-[11px] py-1.5 rounded-lg"><i class="fa-solid fa-pen mr-1"></i>Editar</button>
          <button @click="eliminarPerfilAcceso(p)" class="bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold text-[11px] px-3 py-1.5 rounded-lg"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </div>
  </div>

  <!-- VENTANA: módulos de un usuario / de un perfil -->
  <div v-if="editorAcceso" class="fixed inset-0 z-[60] bg-slate-950/60 flex items-center justify-center p-3" @click.self="cerrarEditorAcceso">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden text-xs">
      <div class="flex items-center justify-between px-5 py-3.5 border-b bg-slate-50">
        <div>
          <h3 class="font-extrabold text-slate-800 text-base"><i class="fa-solid fa-sliders text-violet-600 mr-2"></i>{{ editorAcceso.modo === 'perfil' ? (editorAcceso.perfil.id ? 'Editar perfil' : 'Nuevo perfil') : 'Acceso de ' + editorAcceso.usuario.usuario }}</h3>
          <p class="text-[11px] text-slate-500">{{ visiblesEnEditor() }} de {{ TOTAL_MODULOS }} módulos visibles · Inicio y Mis Tareas siempre visibles</p>
        </div>
        <button @click="cerrarEditorAcceso" class="w-9 h-9 rounded-lg hover:bg-slate-200 text-slate-500"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        <div v-if="editorAcceso.modo === 'perfil'" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="block"><span class="font-bold">Nombre del perfil</span><input v-model="editorAcceso.perfil.nombre" placeholder="Ej: Bodega" class="mt-1 w-full p-2 border rounded-lg font-bold"></label>
          <label class="block"><span class="font-bold">Descripción (opcional)</span><input v-model="editorAcceso.perfil.descripcion" placeholder="Ej: Encargado de bodega de filtros" class="mt-1 w-full p-2 border rounded-lg"></label>
        </div>
        <div v-else class="flex flex-wrap items-end gap-3 bg-violet-50 border border-violet-200 rounded-xl p-3">
          <label class="block"><span class="font-bold text-violet-900">Aplicar un perfil</span>
            <select :value="editorAcceso.perfilId" @change="aplicarPerfilEnEditor($event.target.value)" class="mt-1 block w-64 p-2 border rounded-lg bg-white font-bold">
              <option value="">— Personalizado —</option>
              <option v-for="p in perfilesAcceso" :key="p.id" :value="p.id">{{ p.nombre }}</option>
            </select>
          </label>
          <label class="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer pb-2">
            <input type="checkbox" v-model="editorAcceso.porArea" class="accent-violet-600"> Sin restricción por módulo (como antes: ve todo y manda el nivel por área)
          </label>
        </div>

        <div :class="['space-y-3', editorAcceso.modo === 'usuario' && editorAcceso.porArea ? 'opacity-40 pointer-events-none' : '']">
          <div class="flex flex-wrap items-center gap-2 text-[11px]">
            <span class="font-bold text-slate-600">Todos los módulos:</span>
            <button v-for="n in NIVELES_MODULO" :key="n.key" @click="nivelParaArea(null, n.key)" :class="['px-2 py-1 rounded border font-bold', claseNivelModulo(n.key)]">{{ n.label }}</button>
          </div>
          <div v-for="a in AREAS_MODULOS" :key="a.key" class="border rounded-xl overflow-hidden">
            <div class="flex flex-wrap items-center justify-between gap-2 bg-slate-800 text-white px-3 py-2">
              <span class="font-extrabold uppercase tracking-wide"><i :class="['fa-solid mr-1.5', a.icon, a.color]"></i>{{ a.label }}</span>
              <div class="flex gap-1">
                <button v-for="n in NIVELES_MODULO" :key="n.key" @click="nivelParaArea(a.key, n.key)" class="px-2 py-0.5 rounded bg-white/10 hover:bg-white/25 text-[10px] font-bold">{{ n.corto }}</button>
              </div>
            </div>
            <template v-for="g in gruposDeArea(a)" :key="g.key || 'sin'">
              <div v-if="g.key" class="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase text-slate-400"><i :class="['fa-solid mr-1', g.icon]"></i>{{ g.label }}</div>
              <div v-for="m in g.modulos" :key="m.key" class="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-t border-slate-100 hover:bg-slate-50">
                <span :class="['font-semibold', (editorAcceso.mapa[m.key] || 'oculto') === 'oculto' ? 'text-slate-400 line-through' : 'text-slate-800']"><i :class="['fa-solid w-4 mr-1 text-slate-400', m.icon]"></i>{{ m.label }}</span>
                <div class="flex rounded-lg border overflow-hidden">
                  <button v-for="n in NIVELES_MODULO" :key="n.key" @click="cambiarNivelModulo(m.key, n.key)"
                    :class="['px-2.5 py-1 text-[10px] font-bold border-l first:border-l-0 transition', (editorAcceso.mapa[m.key] || 'oculto') === n.key ? botonNivelActivo(n.key) : 'bg-white text-slate-500 hover:bg-slate-100']">{{ n.corto }}</button>
                </div>
              </div>
            </template>
          </div>
          <p class="text-[10px] text-slate-500"><i class="fa-solid fa-circle-info mr-1"></i><b>Ver</b> = solo mirar · <b>Modificar</b> = ver, agregar / subir (documentos, Excel) y editar · <b>Todo</b> = además eliminar. Lo que no se marca queda oculto del menú.</p>
        </div>
      </div>
      <div class="flex justify-end gap-2 px-5 py-3 border-t bg-slate-50">
        <button @click="cerrarEditorAcceso" class="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200">Cancelar</button>
        <button @click="guardarEditorAcceso" :disabled="guardandoAcceso" class="px-5 py-2 rounded-lg font-bold bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60"><i :class="['fa-solid mr-1', guardandoAcceso ? 'fa-spinner fa-spin' : 'fa-floppy-disk']"></i>Guardar</button>
      </div>
    </div>
  </div>

  <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
    <h3 class="text-base font-bold text-slate-800 flex items-center gap-2 border-b pb-3"><i class="fa-solid fa-palette text-violet-600"></i> Personalización & Importación</h3>
    <div v-if="esAdminGeneral" class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border">
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
          <label :class="['w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow', esAdminGeneral ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-500']"><i class="fa-solid fa-file-excel"></i> Subir Excel<input type="file" :disabled="!esAdminGeneral" @change="importarInventarioFile" accept=".xlsx, .xls, .csv" class="hidden"></label>
        </div>
        <div class="bg-slate-50 p-4 rounded-xl border space-y-3">
          <span class="font-bold text-xs">Movimientos</span>
          <label :class="['w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow', esAdminGeneral ? 'bg-amber-600 text-white' : 'bg-slate-300 text-slate-500']"><i class="fa-solid fa-file-excel"></i> Subir Excel<input type="file" :disabled="!esAdminGeneral" @change="importarMovimientosFile" accept=".xlsx, .xls, .csv" class="hidden"></label>
        </div>
        <div class="bg-slate-50 p-4 rounded-xl border space-y-3">
          <span class="font-bold text-xs">Historial (Mantenciones)</span>
          <label :class="['w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow', esAdminGeneral ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-500']"><i class="fa-solid fa-file-excel"></i> Subir Excel<input type="file" :disabled="!esAdminGeneral" @change="importarIntervencionesFile" accept=".xlsx, .xls, .csv" class="hidden"></label>
        </div>
      </div>
    </div>
  </div>
</section>
`;
