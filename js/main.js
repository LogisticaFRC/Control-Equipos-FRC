// =====================================================================
// MAIN · Punto de entrada: arma la app, el header/menú y registra los módulos
// =====================================================================
import { usuarioActivo, isAdmin, isSubadmin, puedeEditar, currentTab, config, cargarDatosDesdeSupabase } from './core/store.js';

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
import BodegaView from './modules/bodega/bodega.view.js';
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
import BajaEquipo from './modules/inventario/baja-equipo.view.js';

import { showPerfilEquipoModal } from './modules/inventario/perfil.service.js';
import { showModalNuevoEquipo } from './modules/inventario/inventario.service.js';
import { showFormMantencionModal, abrirFormularioNuevaMantencion } from './modules/historial/historial.service.js';
import { showModalMovimiento } from './modules/movimientos/movimientos.service.js';
import { showModalPrograma, showModalAsignarEquipo } from './modules/programas/programas.service.js';
import { logout, headerStyle, bodyStyle, logoSrc, onLogoError, cargarConfiguracionGuardada, cargarUsuariosDesdeSupabase } from './modules/configuracion/configuracion.service.js';

const { createApp, onMounted, onBeforeUnmount, watchEffect, ref, reactive, computed, watch } = Vue;

import EnConstruccionView from './modules/general/en-construccion.view.js';
// Menú lateral agrupado por áreas (Operaciones, Ventas, Seguridad, RRHH, General) → ver core/menu.js
import { AREAS, areaDeTab, moduloDeTab } from './core/menu.js';

const template = /* html */ `
  <div v-if="restaurandoSesion" class="min-h-screen flex items-center justify-center bg-slate-900 w-full flex-grow text-slate-300 text-sm font-semibold">
    <i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando...
  </div>
  <login-view v-else-if="!usuarioActivo"></login-view>

  <template v-else>
    <header :style="headerStyle" class="text-white shadow-lg sticky top-0 z-40 transition-colors duration-300">
      <div class="max-w-[1400px] mx-auto px-4 py-3 flex flex-wrap justify-between items-center gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <!-- Botón menú (hamburguesa) -->
          <button @click="menuAbierto = true" title="Menú" aria-label="Abrir menú"
            class="w-10 h-10 shrink-0 rounded-lg hover:bg-white/10 flex items-center justify-center transition border border-white/10">
            <i class="fa-solid fa-bars text-lg"></i>
          </button>
          <div class="bg-white p-1 rounded-lg w-12 h-12 shrink-0 flex items-center justify-center overflow-hidden border border-slate-700 shadow-sm">
            <img :src="logoSrc" @error="onLogoError" referrerpolicy="no-referrer" alt="Logo" class="max-h-full max-w-full object-contain">
          </div>
          <div class="min-w-0">
            <h1 class="font-bold text-lg leading-tight truncate">{{ config.title }}</h1>
            <p class="text-xs text-slate-300 opacity-90 truncate">
              <span :class="['font-bold', areaActual.color]"><i :class="['fa-solid mr-1', areaActual.icon]"></i>{{ areaActual.label }}</span>
              <i class="fa-solid fa-chevron-right text-[9px] mx-1.5 opacity-60"></i>{{ moduloActual.label }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <button v-if="puedeEditar && enOperaciones" @click="abrirFormularioNuevaMantencion()" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 shadow-md">
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

    <!-- Menú lateral (se abre con el botón hamburguesa) -->
    <transition enter-active-class="transition-opacity duration-200" leave-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-to-class="opacity-0">
      <div v-if="menuAbierto" @click="menuAbierto = false" class="fixed inset-0 bg-slate-950/50 z-50"></div>
    </transition>
    <aside :class="['fixed top-0 left-0 h-full w-72 max-w-[85vw] bg-slate-900 text-slate-200 z-50 flex flex-col transition-transform duration-300', menuAbierto ? 'translate-x-0 shadow-2xl' : '-translate-x-full']"
      :aria-hidden="!menuAbierto">
      <div class="flex items-center justify-between px-4 py-4 border-b border-slate-800">
        <span class="font-extrabold text-white tracking-wide text-sm"><i class="fa-solid fa-bars mr-2 text-slate-400"></i>Menú</span>
        <button @click="menuAbierto = false" aria-label="Cerrar menú" class="w-8 h-8 rounded-md hover:bg-white/10 flex items-center justify-center"><i class="fa-solid fa-xmark text-lg"></i></button>
      </div>
      <nav class="flex-1 overflow-y-auto py-2">
        <div v-for="a in areas" :key="a.key" class="px-2">
          <button @click="areasAbiertas[a.key] = !areasAbiertas[a.key]"
            class="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-white/5 text-xs font-extrabold uppercase tracking-wider">
            <span class="flex items-center gap-2.5"><i :class="['fa-solid w-4 text-center', a.icon, a.color]"></i>{{ a.label }}</span>
            <i :class="['fa-solid fa-chevron-down text-[10px] text-slate-500 transition-transform', areasAbiertas[a.key] ? 'rotate-180' : '']"></i>
          </button>
          <div v-show="areasAbiertas[a.key]" class="pb-2">
            <button v-for="m in a.modulos" :key="m.key" @click="switchTab(m.key)"
              :class="['w-full flex items-center gap-2.5 pl-9 pr-3 py-2 rounded-md text-sm transition text-left', currentTab === m.key ? 'bg-white/15 text-white font-bold' : 'text-slate-300 hover:bg-white/5 hover:text-white']">
              <i :class="['fa-solid w-4 text-center text-xs', m.icon]"></i>
              <span class="flex-1">{{ m.label }}</span>
              <span v-if="m.count" class="text-[10px] font-bold bg-slate-800 text-slate-400 rounded-full px-2 py-0.5">{{ m.count() }}</span>
              <span v-if="m.placeholder" class="text-[9px] font-bold uppercase text-amber-400/80">Pronto</span>
            </button>
          </div>
        </div>
      </nav>
      <div class="px-4 py-3 border-t border-slate-800 text-[11px] text-slate-500 truncate"><i class="fa-solid fa-user mr-1"></i>{{ usuarioActivo.nombre }}</div>
    </aside>

    <main class="max-w-[1400px] mx-auto px-4 py-6 flex-grow w-full">
      <dashboard-view v-if="currentTab === 'dashboard'"></dashboard-view>
      <inventario-view v-if="currentTab === 'inventario'"></inventario-view>
      <programas-view v-if="currentTab === 'programas'"></programas-view>
      <movimientos-view v-if="currentTab === 'movimientos'"></movimientos-view>
      <historial-view v-if="currentTab === 'hojaVida'"></historial-view>
      <aceites-view v-if="currentTab === 'aceites'"></aceites-view>
      <filtros-view v-if="currentTab === 'filtros'"></filtros-view>
      <bodega-view v-if="currentTab === 'bodega'"></bodega-view>
      <formatos-view v-if="currentTab === 'formatos'"></formatos-view>
      <configuracion-view v-if="currentTab === 'configuracion'"></configuracion-view>
      <en-construccion-view v-if="moduloActual.placeholder"></en-construccion-view>
    </main>

    <!-- Modales (el orden define cuál queda encima) -->
    <perfil-equipo v-if="showPerfilEquipoModal"></perfil-equipo>
    <modal-nuevo-equipo v-if="showModalNuevoEquipo"></modal-nuevo-equipo>
    <form-mantencion v-if="showFormMantencionModal"></form-mantencion>
    <modal-movimiento v-if="showModalMovimiento"></modal-movimiento>
    <modal-programa v-if="showModalPrograma"></modal-programa>
    <modal-asignar-equipo v-if="showModalAsignarEquipo"></modal-asignar-equipo>
    <baja-equipo></baja-equipo>
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

    // ---- Menú lateral ----
    const menuAbierto = ref(false);
    const areaActual = computed(() => areaDeTab(currentTab.value));
    const moduloActual = computed(() => moduloDeTab(currentTab.value));
    const enOperaciones = computed(() => areaActual.value.key === 'operaciones');   // "Agregar Mantención" solo aquí
    // Grupos desplegados: se abre el del área actual
    const areasAbiertas = reactive(Object.fromEntries(AREAS.map(a => [a.key, false])));
    watch(areaActual, (a) => { areasAbiertas[a.key] = true; }, { immediate: true });

    const switchTab = (tab) => { currentTab.value = tab; menuAbierto.value = false; };

    const onKey = (e) => { if (e.key === 'Escape') menuAbierto.value = false; };
    window.addEventListener('keydown', onKey);
    onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

    onMounted(async () => {
      cargarConfiguracionGuardada();
      await cargarUsuariosDesdeSupabase();
      restaurarSesion();   // si se actualizó la página con sesión vigente, se mantiene y vuelve a la misma pestaña
      await cargarDatosDesdeSupabase();
    });

    return {
      usuarioActivo, restaurandoSesion, isAdmin, isSubadmin, puedeEditar, currentTab, config, areas: AREAS, switchTab,
      menuAbierto, areaActual, moduloActual, enOperaciones, areasAbiertas, logout, headerStyle, logoSrc, onLogoError, abrirFormularioNuevaMantencion,
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
app.component('BodegaView', BodegaView);
app.component('EnConstruccionView', EnConstruccionView);   // Ventas / Seguridad / RRHH (pendientes)
app.component('DocumentosCarpeta', DocumentosCarpeta);   // carpeta de documentos reutilizable (Formatos y Ficha Técnica)
app.component('PerfilEquipo', PerfilEquipo);
app.component('ModalNuevoEquipo', ModalNuevoEquipo);
app.component('FormMantencion', FormMantencion);
app.component('ModalMovimiento', ModalMovimiento);
app.component('ModalPrograma', ModalPrograma);
app.component('ModalAsignarEquipo', ModalAsignarEquipo);
app.component('BajaEquipo', BajaEquipo);

app.mount('#app');
