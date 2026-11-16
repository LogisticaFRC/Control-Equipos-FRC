// =====================================================================
// TÓTEM DEL TALLER (2026-11-16)
// Usuario tipo "Tótem" (permisos.mec_modo = 'totem'): solo ve las NAVES del
// Programa de Reparación (cartas, ingreso, inspección, actividades), en
// pantalla completa. Para salir de pantalla completa o cerrar sesión pide la
// contraseña del tótem (Configuración → Usuarios · sql/totem.sql).
// Nota: el navegador SIEMPRE deja salir con Esc; en ese caso la pantalla queda
// tapada hasta volver a pantalla completa. Para un bloqueo total, abrir Chrome
// en modo quiosco (ver LEEME).
// =====================================================================
import { usuarioActivo, cargoDe, currentTab } from '../../core/store.js';
import { verificarClaveTotem, cargarInfoTotem, infoClaveTotem, faltaSqlTotem } from './totem.service.js';

const { ref, computed, onMounted, onBeforeUnmount } = Vue;

/** Al desbloquear con la contraseña, se vuelve a bloquear solo después de este tiempo. */
const DESBLOQUEO_MS = 5 * 60 * 1000;

const template = /* html */ `
<div class="min-h-screen bg-slate-100 select-none" @contextmenu.prevent>
  <!-- Barra superior -->
  <header class="bg-slate-900 text-white px-4 py-2 flex items-center justify-between gap-3 shadow">
    <div class="flex items-center gap-3 min-w-0">
      <img src="icons/logo-frc-neon.png" alt="" class="h-9 w-9 rounded-lg object-cover" onerror="this.style.display='none'">
      <div class="min-w-0 leading-tight">
        <p class="font-black tracking-tight">TÓTEM TALLER · FRC</p>
        <p class="text-[11px] text-slate-400 truncate">{{ cargo || 'Programa de reparación' }} · {{ usuario }}</p>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <span class="font-mono text-xl font-black text-amber-300">{{ hora }}</span>
      <span v-if="desbloqueado" class="text-[11px] font-bold bg-amber-500 text-slate-900 rounded-lg px-2 py-1">DESBLOQUEADO</span>
      <button @click="abrirClave" data-totem="candado" class="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-3 py-2 text-sm font-bold">
        <i :class="['fa-solid mr-1', desbloqueado ? 'fa-lock-open' : 'fa-lock']"></i>{{ desbloqueado ? 'Opciones' : 'Bloqueado' }}
      </button>
    </div>
  </header>

  <!-- Desbloqueado: aviso + volver a bloquear -->
  <div v-if="desbloqueado" class="bg-amber-100 border-b-2 border-amber-300 text-amber-900 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
    <span><i class="fa-solid fa-lock-open mr-1"></i> Tótem desbloqueado: se vuelve a bloquear solo en {{ minutosRestantes }} min.</span>
    <div class="flex gap-2">
      <button @click="bloquear" class="bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg"><i class="fa-solid fa-lock mr-1"></i>Bloquear ahora</button>
      <button @click="cerrarSesionTotem" class="bg-rose-600 text-white font-bold px-3 py-1.5 rounded-lg"><i class="fa-solid fa-right-from-bracket mr-1"></i>Cerrar sesión</button>
    </div>
  </div>

  <main class="p-3 md:p-4">
    <taller-view totem></taller-view>
  </main>

  <!-- Bloqueo: fuera de pantalla completa (al inicio o si salieron con Esc) -->
  <div v-if="!desbloqueado && !enPantallaCompleta" data-totem="bloqueo" @click="entrarPantallaCompleta"
    class="fixed inset-0 z-[300] bg-slate-950 text-white flex flex-col items-center justify-center gap-6 cursor-pointer p-6 text-center">
    <img src="icons/logo-frc-neon.png" alt="" class="h-28 w-28 rounded-3xl object-cover shadow-2xl" onerror="this.style.display='none'">
    <div>
      <p class="text-4xl md:text-5xl font-black tracking-tight">TÓTEM TALLER</p>
      <p class="text-slate-400 mt-2 text-lg">Programa de reparación · naves</p>
    </div>
    <div class="bg-amber-500 text-slate-900 font-black text-2xl md:text-3xl px-10 py-6 rounded-3xl shadow-2xl animate-pulse">
      <i class="fa-solid fa-hand-pointer mr-2"></i> Toca la pantalla para iniciar
    </div>
    <p v-if="sinSoporte" class="text-rose-300 text-sm max-w-md">Este navegador no permite pantalla completa. Usa Chrome en modo quiosco (ver LEEME).</p>
    <button @click.stop="abrirClave" class="absolute bottom-5 right-5 text-slate-500 hover:text-slate-300 text-sm font-bold"><i class="fa-solid fa-lock mr-1"></i>Administrar</button>
  </div>

  <!-- Contraseña / opciones -->
  <div v-if="modalClave" class="fixed inset-0 z-[400] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4" @click.self="cerrarModal">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
      <div class="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
        <h3 class="font-black"><i class="fa-solid fa-lock mr-2 text-amber-400"></i>{{ desbloqueado ? 'Opciones del tótem' : 'Contraseña del tótem' }}</h3>
        <button @click="cerrarModal" class="text-slate-400 hover:text-white text-xl" title="Cancelar"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div v-if="!desbloqueado" class="p-5 space-y-3">
        <p class="text-sm text-slate-600">Para salir de pantalla completa o cerrar sesión escribe la contraseña del tótem.</p>
        <input ref="inputClave" v-model="clave" type="password" autocomplete="off" @keyup.enter="validar" data-totem="clave"
          class="w-full p-3 border-2 rounded-xl text-lg font-bold tracking-widest focus:border-slate-900 outline-none" placeholder="••••••">
        <p v-if="error" class="text-sm font-bold text-rose-600">{{ error }}</p>
        <div class="flex gap-2">
          <button @click="cerrarModal" class="flex-1 py-3 rounded-xl border-2 font-bold text-slate-600">Cancelar</button>
          <button @click="validar" :disabled="validando" data-totem="validar" class="flex-1 py-3 rounded-xl bg-slate-900 text-white font-black disabled:opacity-60">
            <i :class="['fa-solid mr-1', validando ? 'fa-spinner fa-spin' : 'fa-unlock']"></i>Desbloquear
          </button>
        </div>
      </div>
      <div v-else class="p-5 space-y-2">
        <button @click="salirPantallaCompleta" data-totem="salir-pc" class="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-black"><i class="fa-solid fa-compress mr-1"></i>Salir de pantalla completa</button>
        <button @click="volverPantallaCompleta" class="w-full py-3 rounded-xl border-2 font-bold text-slate-700"><i class="fa-solid fa-expand mr-1"></i>Volver a pantalla completa</button>
        <button @click="bloquear" class="w-full py-3 rounded-xl bg-slate-900 text-white font-black"><i class="fa-solid fa-lock mr-1"></i>Bloquear tótem</button>
        <button @click="cerrarSesionTotem" data-totem="cerrar-sesion" class="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black"><i class="fa-solid fa-right-from-bracket mr-1"></i>Cerrar sesión</button>
      </div>
    </div>
  </div>
</div>`;

export default {
  name: 'TotemView',
  props: { salir: { type: Function, required: true } },
  template,
  setup(props) {
    // Los permisos de botones dependen del módulo actual: el tótem siempre está en Programa de Reparación
    // (si quedara en 'inicio' tendría permisos de Admin en la pantalla).
    currentTab.value = 'progReparacion';
    const usuario = computed(() => (usuarioActivo.value && usuarioActivo.value.usuario) || '');
    const cargo = computed(() => cargoDe(usuarioActivo.value));

    // ---------- Reloj ----------
    const ahora = ref(Date.now());
    const hora = computed(() => new Date(ahora.value).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }));

    // ---------- Pantalla completa ----------
    const enPantallaCompleta = ref(Boolean(document.fullscreenElement));
    const sinSoporte = !document.documentElement.requestFullscreen;
    const onFs = () => { enPantallaCompleta.value = Boolean(document.fullscreenElement); };
    const entrarPantallaCompleta = async () => {
      try { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch (_) { /* sin soporte o sin gesto */ }
      // Chrome/Edge: con el teclado "tomado" Esc ya no sale al tocarlo; hay que MANTENERLO 2 s (Keyboard Lock API)
      try { if (navigator.keyboard && navigator.keyboard.lock) await navigator.keyboard.lock(); } catch (_) { /* no soportado */ }
      onFs();
      pedirPantallaEncendida();
    };
    // Que la pantalla no se apague (si el navegador lo permite)
    let wakeLock = null;
    const pedirPantallaEncendida = async () => {
      try { if (navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (_) { /* opcional */ }
    };

    // ---------- Bloqueo con contraseña ----------
    const desbloqueado = ref(false);
    const hastaDesbloqueo = ref(0);
    const minutosRestantes = computed(() => Math.max(1, Math.ceil((hastaDesbloqueo.value - ahora.value) / 60000)));
    const modalClave = ref(false);
    const clave = ref('');
    const error = ref('');
    const validando = ref(false);
    const inputClave = ref(null);

    const abrirClave = () => {
      clave.value = ''; error.value = ''; modalClave.value = true;
      if (!desbloqueado.value) cargarInfoTotem();
      setTimeout(() => { try { inputClave.value && inputClave.value.focus(); } catch (_) { /* */ } }, 50);
    };
    const cerrarModal = () => { modalClave.value = false; clave.value = ''; error.value = ''; };
    const validar = async () => {
      if (validando.value) return;
      if (!clave.value) { error.value = 'Escribe la contraseña.'; return; }
      validando.value = true;
      try {
        const r = await verificarClaveTotem(clave.value);
        if (r === true) { desbloqueado.value = true; hastaDesbloqueo.value = Date.now() + DESBLOQUEO_MS; clave.value = ''; error.value = ''; }
        else if (r === 'sin-sql' || faltaSqlTotem.value) error.value = 'Falta ejecutar sql/totem.sql en Supabase.';
        else if (infoClaveTotem.value && infoClaveTotem.value.definida === false) error.value = 'Aún no hay contraseña: el Admin general debe crearla en Configuración → Usuarios.';
        else error.value = 'Contraseña incorrecta.';
      } finally { validando.value = false; }
    };
    const bloquear = () => {
      desbloqueado.value = false; modalClave.value = false;
      if (!document.fullscreenElement) entrarPantallaCompleta();
    };
    const salirPantallaCompleta = async () => {
      modalClave.value = false;
      try { navigator.keyboard && navigator.keyboard.unlock && navigator.keyboard.unlock(); } catch (_) { /* */ }
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (_) { /* */ }
    };
    const volverPantallaCompleta = () => { modalClave.value = false; entrarPantallaCompleta(); };
    const cerrarSesionTotem = async () => {
      if (!desbloqueado.value) return;
      if (!confirm('¿Cerrar la sesión del tótem?')) return;
      quitarBloqueos();
      try { navigator.keyboard && navigator.keyboard.unlock && navigator.keyboard.unlock(); } catch (_) { /* */ }
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (_) { /* */ }
      props.salir();
    };

    // ---------- Teclas / salir de la página ----------
    const TECLAS_BLOQUEADAS = ['F5', 'F11', 'F12', 'F1', 'F3'];
    const onKey = (e) => {
      if (desbloqueado.value) return;
      const k = e.key || '';
      const ctrl = e.ctrlKey || e.metaKey;
      if (TECLAS_BLOQUEADAS.includes(k) || (ctrl && /^[rpsoultnjw]$/i.test(k)) || (e.altKey && /^(arrowleft|arrowright|home)$/i.test(k))) {
        e.preventDefault(); e.stopPropagation();
      }
    };
    const onBeforeUnload = (e) => { if (!desbloqueado.value) { e.preventDefault(); e.returnValue = ''; } };
    const onVisible = () => { if (!document.hidden) pedirPantallaEncendida(); };

    let reloj = null;
    const quitarBloqueos = () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
    onMounted(() => {
      document.addEventListener('fullscreenchange', onFs);
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('keydown', onKey, true);
      window.addEventListener('beforeunload', onBeforeUnload);
      reloj = setInterval(() => {
        ahora.value = Date.now();
        if (desbloqueado.value && ahora.value >= hastaDesbloqueo.value) bloquear();
      }, 5000);
      cargarInfoTotem();
    });
    onBeforeUnmount(() => {
      clearInterval(reloj);
      quitarBloqueos();
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('visibilitychange', onVisible);
      try { wakeLock && wakeLock.release(); } catch (_) { /* */ }
    });

    return {
      usuario, cargo, hora, enPantallaCompleta, sinSoporte, entrarPantallaCompleta,
      desbloqueado, minutosRestantes, modalClave, clave, error, validando, inputClave,
      abrirClave, cerrarModal, validar, bloquear, salirPantallaCompleta, volverPantallaCompleta, cerrarSesionTotem
    };
  }
};
