// =====================================================================
// MAIN · Punto de entrada: arma la app, el header/menú y registra los módulos
// =====================================================================
import { usuarioActivo, isAdmin, isSubadmin, puedeEditar, currentTab, config, dbEquipos, dbMovimientos, dbIntervenciones, cargarDatosDesdeSupabase } from './core/store.js';

// Módulos (pantallas)
import DashboardView from './modules/dashboard/dashboard.view.js';
import InventarioView from './modules/inventario/inventario.view.js';
import ProgramasView from './modules/programas/programas.view.js';
import MovimientosView from './modules/movimientos/movimientos.view.js';
import HistorialView from './modules/historial/historial.view.js';
import AceitesView from './modules/aceites/aceites.view.js';
import ConfiguracionView from './modules/configuracion/configuracion.view.js';
import FormatosView from './modules/formatos/formatos.view.js';
import FiltrosView from './modules/filtros/filtros.view.js';
import DocumentosCarpeta from './modules/formatos/documentos-carpeta.view.js';
import LoginView from './modules/configuracion/login.view.js';
import { restaurandoSesion, restaurarSesion } from './core/sesion.js';

// Modales
import PerfilEquipo from './modules/inventario/perfil-equipo.view.js';
import ModalNuevoEquipo from './modules/inventario/modal-nuevo-equipo.view.js';
import FormMantencion from './modules/historial/form-mantencion.view.js';
import ModalMovimiento from './modules/movimientos/modal-movimiento.view.js';
import ModalPrograma from './modules/programas/modal-programa.view.js';
import ModalAsignarEquipo from './modules/programas/modal-asignar.view.js';

import { showPerfilEquipoModal } from './modules/inventario/perfil.service.js';
import { showModalNuevoEquipo } from './modules/inventario/inventario.service.js';
import { showFormMantencionModal, abrirFormularioNuevaMantencion } from './modules/historial/historial.service.js';
import { showModalMovimiento } from './modules/movimientos/movimientos.service.js';
import { showModalPrograma, showModalAsignarEquipo } from './modules/programas/programas.service.js';
import { logout, headerStyle, bodyStyle, logoSrc, onLogoError, cargarConfiguracionGuardada, cargarUsuariosDesdeSupabase } from './modules/configuracion/configuracion.service.js';

const { createApp, onMounted, watchEffect } = Vue;

// Menú principal: [clave, etiqueta, icono, clase cuando está activo]
const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'fa-chart-line' },
  { key: 'inventario', label: 'Inventario AFI', icon: 'fa-boxes-stacked', count: () => dbEquipos.value.length },
  { key: 'programas', label: 'Programas', icon: 'fa-calendar-check', activeClass: 'bg-rose-500 text-white shadow' },
  { key: 'movimientos', label: 'Movimientos', icon: 'fa-truck-ramp-box', count: () => dbMovimientos.value.length },
  { key: 'hojaVida', label: 'Historial', icon: 'fa-file-medical', count: () => dbIntervenciones.value.length },
  { key: 'aceites', label: 'Control Aceites', icon: 'fa-oil-can' },
  { key: 'filtros', label: 'Filtros', icon: 'fa-filter' },
  { key: 'formatos', label: 'Formatos', icon: 'fa-folder-tree' },
  { key: 'configuracion', label: 'Config & Usuarios', icon: 'fa-gear' }
];

const template = /* html */ `
  <div v-if="restaurandoSesion" class="min-h-screen flex items-center justify-center bg-slate-900 w-full flex-grow text-slate-300 text-sm font-semibold">
    <i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando...
  </div>
  <login-view v-else-if="!usuarioActivo"></login-view>

  <template v-else>
    <header :style="headerStyle" class="text-white shadow-lg sticky top-0 z-40 transition-colors duration-300">
      <div class="max-w-[1400px] mx-auto px-4 py-3 flex flex-wrap justify-between items-center gap-4">
        <div class="flex items-center gap-3">
          <div class="bg-white p-1 rounded-lg w-12 h-12 flex items-center justify-center overflow-hidden border border-slate-700 shadow-sm">
            <img :src="logoSrc" @error="onLogoError" referrerpolicy="no-referrer" alt="Logo" class="max-h-full max-w-full object-contain">
          </div>
          <div>
            <h1 class="font-bold text-lg leading-tight">{{ config.title }}</h1>
            <p class="text-xs text-slate-300 opacity-90">{{ config.subtitle }}</p>
          </div>
        </div>

        <nav class="flex items-center gap-1.5 overflow-x-auto py-1">
          <button v-for="t in tabs" :key="t.key" @click="switchTab(t.key)"
            :class="['px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap', currentTab === t.key ? (t.activeClass || 'bg-white/20 text-white shadow') : 'hover:bg-white/10 text-slate-200']">
            <i :class="['fa-solid', t.icon]"></i> {{ t.label }}<template v-if="t.count"> ({{ t.count() }})</template>
          </button>
        </nav>

        <div class="flex items-center gap-3">
          <button v-if="puedeEditar" @click="abrirFormularioNuevaMantencion()" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 shadow-md">
            <i class="fa-solid fa-plus-circle text-sm"></i> Agregar Mantención
          </button>
          <div class="text-right text-xs">
            <span v-if="isAdmin" class="inline-block px-2.5 py-1 rounded-full bg-emerald-500 text-slate-950 font-bold shadow-sm whitespace-nowrap"><i class="fa-solid fa-user-shield mr-1"></i> {{ usuarioActivo.nombre }} (Admin)</span>
            <span v-else-if="isSubadmin" class="inline-block px-2.5 py-1 rounded-full bg-sky-500 text-slate-950 font-bold shadow-sm whitespace-nowrap"><i class="fa-solid fa-user-gear mr-1"></i> {{ usuarioActivo.nombre }} (Subadmin)</span>
            <span v-else class="inline-block px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700 whitespace-nowrap"><i class="fa-solid fa-eye mr-1"></i> {{ usuarioActivo.nombre }} (Lectura)</span>
          </div>
          <button @click="logout" class="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 shadow"><i class="fa-solid fa-right-from-bracket"></i> Salir</button>
        </div>
      </div>
    </header>

    <main class="max-w-[1400px] mx-auto px-4 py-6 flex-grow w-full">
      <dashboard-view v-if="currentTab === 'dashboard'"></dashboard-view>
      <inventario-view v-if="currentTab === 'inventario'"></inventario-view>
      <programas-view v-if="currentTab === 'programas'"></programas-view>
      <movimientos-view v-if="currentTab === 'movimientos'"></movimientos-view>
      <historial-view v-if="currentTab === 'hojaVida'"></historial-view>
      <aceites-view v-if="currentTab === 'aceites'"></aceites-view>
      <filtros-view v-if="currentTab === 'filtros'"></filtros-view>
      <formatos-view v-if="currentTab === 'formatos'"></formatos-view>
      <configuracion-view v-if="currentTab === 'configuracion'"></configuracion-view>
    </main>

    <!-- Modales (el orden define cuál queda encima) -->
    <perfil-equipo v-if="showPerfilEquipoModal"></perfil-equipo>
    <modal-nuevo-equipo v-if="showModalNuevoEquipo"></modal-nuevo-equipo>
    <form-mantencion v-if="showFormMantencionModal"></form-mantencion>
    <modal-movimiento v-if="showModalMovimiento"></modal-movimiento>
    <modal-programa v-if="showModalPrograma"></modal-programa>
    <modal-asignar-equipo v-if="showModalAsignarEquipo"></modal-asignar-equipo>
  </template>
`;

const app = createApp({
  template,
  setup() {
    // <title> y color de fondo del <body> están fuera de #app, se sincronizan aquí
    // (en el original usaban {{ }} y :style fuera de Vue, por lo que nunca funcionaban)
    watchEffect(() => {
      document.title = config.value.title || 'Control AFI';
      document.body.style.backgroundColor = bodyStyle.value.backgroundColor;
    });

    const switchTab = (tab) => { currentTab.value = tab; };

    onMounted(async () => {
      cargarConfiguracionGuardada();
      await cargarUsuariosDesdeSupabase();
      restaurarSesion();   // si se actualizó la página con sesión vigente, se mantiene y vuelve a la misma pestaña
      await cargarDatosDesdeSupabase();
    });

    return {
      usuarioActivo, restaurandoSesion, isAdmin, isSubadmin, puedeEditar, currentTab, config, tabs: TABS, switchTab, logout, headerStyle, logoSrc, onLogoError, abrirFormularioNuevaMantencion,
      showPerfilEquipoModal, showModalNuevoEquipo, showFormMantencionModal, showModalMovimiento, showModalPrograma, showModalAsignarEquipo
    };
  }
});

app.component('LoginView', LoginView);
app.component('DashboardView', DashboardView);
app.component('InventarioView', InventarioView);
app.component('ProgramasView', ProgramasView);
app.component('MovimientosView', MovimientosView);
app.component('HistorialView', HistorialView);
app.component('AceitesView', AceitesView);
app.component('ConfiguracionView', ConfiguracionView);
app.component('FormatosView', FormatosView);
app.component('FiltrosView', FiltrosView);
app.component('DocumentosCarpeta', DocumentosCarpeta);   // carpeta de documentos reutilizable (Formatos y Ficha Técnica)
app.component('PerfilEquipo', PerfilEquipo);
app.component('ModalNuevoEquipo', ModalNuevoEquipo);
app.component('FormMantencion', FormMantencion);
app.component('ModalMovimiento', ModalMovimiento);
app.component('ModalPrograma', ModalPrograma);
app.component('ModalAsignarEquipo', ModalAsignarEquipo);

app.mount('#app');
