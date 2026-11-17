// =====================================================================
// CORE · INSTALAR LA APP + AVISO DE VERSIÓN NUEVA (2026-11-16)
// ---------------------------------------------------------------------
// <instalar-app>  → botón "Instalar app" (Android / PC con Chrome o Edge), instrucciones para iPhone,
//                   y enlace "Descargar APK" si existe el archivo descargas/FRC-Control.apk en el repo.
// <aviso-version> → si se hizo Push de una versión nueva mientras la app está abierta,
//                   muestra "Hay una versión nueva · Actualizar" (compara APP_VERSION de js/core/sesion.js).
// =====================================================================
import { APP_VERSION } from './sesion.js';

const { ref, computed, onMounted, onBeforeUnmount } = Vue;

// ---------- Instalar ----------
let eventoInstalar = null;
export const puedeInstalar = ref(false);
export const instalada = ref(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); eventoInstalar = e; puedeInstalar.value = true; });
window.addEventListener('appinstalled', () => { instalada.value = true; puedeInstalar.value = false; eventoInstalar = null; });
const ua = navigator.userAgent || '';
export const esIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const esAndroid = /Android/i.test(ua);

export const instalarApp = async () => {
  if (!eventoInstalar) return false;
  eventoInstalar.prompt();
  const r = await eventoInstalar.userChoice.catch(() => null);
  eventoInstalar = null; puedeInstalar.value = false;
  return r && r.outcome === 'accepted';
};

/** ¿Hay APK publicado en el repo (descargas/FRC-Control.apk)? */
export const URL_APK = 'descargas/FRC-Control.apk';
export const hayApk = ref(false);
fetch(URL_APK, { method: 'HEAD', cache: 'no-cache' }).then(r => { hayApk.value = r.ok; }).catch(() => {});

export const InstalarApp = {
  name: 'InstalarApp',
  template: /* html */ `
  <div v-if="!instalada" class="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-left text-xs text-emerald-900 space-y-2">
    <div class="font-extrabold flex items-center gap-2"><i class="fa-solid fa-mobile-screen-button"></i> App FRC Control en tu celular</div>
    <button v-if="puedeInstalar" type="button" @click="instalarApp" class="w-full py-2.5 rounded-xl bg-[#1f4d3a] text-white font-extrabold text-sm"><i class="fa-solid fa-download mr-1"></i> Instalar app</button>
    <p v-else-if="esIOS">En iPhone: toca <b>Compartir</b> <i class="fa-solid fa-arrow-up-from-bracket"></i> y luego <b>Agregar a inicio</b>.</p>
    <p v-else>En Chrome: menú <b>⋮</b> → <b>Instalar app</b> (o "Agregar a pantalla de inicio").</p>
    <a v-if="hayApk && !esIOS" :href="URL_APK" download class="block text-center py-2 rounded-xl border border-emerald-300 bg-white font-bold"><i class="fa-brands fa-android mr-1"></i> Descargar APK (Android)</a>
  </div>`,
  setup() { return { instalada, puedeInstalar, instalarApp, esIOS, hayApk, URL_APK }; }
};

// ---------- Versión nueva ----------
export const versionNueva = ref('');
const revisarVersion = async () => {
  try {
    const t = await (await fetch('js/core/sesion.js?v=' + Date.now(), { cache: 'no-store' })).text();
    const m = t.match(/APP_VERSION\s*=\s*'([^']+)'/);
    if (m && m[1] !== APP_VERSION) versionNueva.value = m[1];
  } catch (_) { /* sin internet: se revisa después */ }
};
/** Archivos propios ya cargados (js / css / html): se descargan de nuevo saltándose el caché antes de recargar. */
const archivosPropios = () => {
  const urls = new Set(['./', 'index.html', 'js/main.js', 'js/core/sesion.js']);
  (performance.getEntriesByType('resource') || []).forEach(e => {
    try { const u = new URL(e.name); if (u.origin === location.origin && /\.(js|css|html|json)$/i.test(u.pathname)) urls.add(u.pathname + u.search); } catch (_) { /* */ }
  });
  return [...urls];
};
export const actualizando = ref(false);
export const avisoActualizar = ref('');
/** Actualizar: (1) borra el caché de la app, (2) baja de nuevo cada archivo sin usar el caché del navegador,
 *  (3) confirma que el servidor ya entrega la versión nueva y (4) recarga. Si GitHub aún no termina de publicar,
 *  avisa y reintenta solo (antes, "Actualizar" a veces recargaba la versión vieja guardada). */
export const actualizarAhora = async () => {
  if (actualizando.value) return;
  actualizando.value = true; avisoActualizar.value = '';
  try {
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
    const t = await (await fetch('js/core/sesion.js', { cache: 'reload' })).text();
    const m = t.match(/APP_VERSION\s*=\s*'([^']+)'/);
    if (m && m[1] === APP_VERSION) {
      avisoActualizar.value = 'La versión nueva todavía se está publicando. Reintento en 30 s…';
      setTimeout(() => { actualizando.value = false; actualizarAhora(); }, 30000);
      return;
    }
    await Promise.all(archivosPropios().map(u => fetch(u, { cache: 'reload' }).catch(() => null)));
    try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) await reg.update(); } catch (_) { /* */ }
  } catch (_) { /* sin internet: se recarga igual */ }
  window.location.reload();
};

export const AvisoVersion = {
  name: 'AvisoVersion',
  template: /* html */ `
  <div v-if="versionNueva" class="fixed bottom-20 inset-x-3 mx-auto w-fit z-[90] bg-slate-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 text-sm">
    <i class="fa-solid fa-rotate text-amber-400"></i>
    <span class="font-semibold">Hay una versión nueva del sistema</span>
    <span v-if="avisoActualizar" class="text-xs text-amber-200">{{ avisoActualizar }}</span>
    <button @click="actualizarAhora" :disabled="actualizando" class="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-extrabold disabled:opacity-70"><i v-if="actualizando" class="fa-solid fa-spinner fa-spin mr-1"></i>{{ actualizando ? 'Actualizando…' : 'Actualizar' }}</button>
  </div>`,
  setup() {
    let t = null;
    const alVolver = () => { if (!document.hidden) revisarVersion(); };
    onMounted(() => { revisarVersion(); t = setInterval(revisarVersion, 10 * 60 * 1000); document.addEventListener('visibilitychange', alVolver); });
    onBeforeUnmount(() => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver); });
    return { versionNueva, actualizarAhora, actualizando, avisoActualizar };
  }
};
