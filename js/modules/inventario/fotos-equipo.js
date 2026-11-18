// =====================================================================
// FOTOS DE EQUIPOS EN STORAGE (2026-11-18) · AHORRO DE DATOS (egress de Supabase)
//   Antes la foto se guardaba en BD_INVENTARIO.foto como texto base64 a tamaño original del celular:
//   cada vez que alguien abría el sistema (o un mecánico guardaba un horómetro) se bajaban TODAS las fotos.
//   Ahora: la foto se achica (máx. 900 px, JPG) y se sube a Storage; en la tabla queda solo el enlace.
//   <optimizar-fotos>: botón para pasar las fotos antiguas (base64) a Storage. El original queda
//   respaldado en Storage (equipos/original/).
// =====================================================================
import { supabaseClient, sb, errMsg, BUCKET_ARCHIVOS } from '../../core/supabase.js';
import { dbEquipos } from '../../core/store.js';
import { limpiarAfi } from '../../core/utils.js';
import { TABLA_INVENTARIO } from './inventario.mapper.js';

const { ref, computed } = Vue;
const UN_ANO = '31536000';   // el navegador guarda la foto y no la vuelve a bajar

/** Achica una imagen (File, Blob o data URL) a máx. `lado` px y la devuelve como Blob JPG. */
export const comprimirImagen = (fuente, lado = 900, calidad = 0.8) => new Promise((ok, mal) => {
  const img = new Image();
  const url = typeof fuente === 'string' ? fuente : URL.createObjectURL(fuente);
  img.onload = () => {
    const k = Math.min(1, lado / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    c.toBlob(b => (b ? ok(b) : mal(new Error('No se pudo comprimir la imagen'))), 'image/jpeg', calidad);
    if (typeof fuente !== 'string') URL.revokeObjectURL(url);
  };
  img.onerror = () => mal(new Error('Imagen no válida'));
  img.src = url;
});
const subir = async (ruta, blob, tipo) => {
  await sb(supabaseClient.storage.from(BUCKET_ARCHIVOS).upload(ruta, blob, { cacheControl: UN_ANO, contentType: tipo, upsert: true }));
  return supabaseClient.storage.from(BUCKET_ARCHIVOS).getPublicUrl(ruta).data.publicUrl;
};
const nombre = (afi) => `${limpiarAfi(afi).replace(/[^A-Za-z0-9_-]/g, '_')}_${Date.now()}`;

/** Sube la foto de un equipo (achicada) y guarda solo el enlace en el inventario. Devuelve la URL. */
export const subirFotoEquipo = async (item, file) => {
  const blob = await comprimirImagen(file);
  const url = await subir(`equipos/${nombre(item.afi)}.jpg`, blob, 'image/jpeg');
  await sb(supabaseClient.from(TABLA_INVENTARIO).update({ foto: url }).eq('id', item.id));
  item.foto = url;
  return url;
};

// ---------- Pasar las fotos antiguas (base64) a Storage ----------
export const esFotoBase64 = (f) => /^data:image\//i.test(String(f || ''));
export const fotosPendientes = computed(() => dbEquipos.value.filter(e => esFotoBase64(e.foto)));
export const pesoPendienteMB = computed(() => fotosPendientes.value.reduce((s, e) => s + String(e.foto).length, 0) / 1024 / 1024);
export const optimizando = ref(false);
export const progresoFotos = ref('');
export const optimizarFotosEquipos = async () => {
  const lista = [...fotosPendientes.value];
  if (!lista.length) { alert('No hay fotos por optimizar.'); return; }
  if (!confirm(`Se pasarán ${lista.length} foto(s) (${pesoPendienteMB.value.toFixed(1)} MB) a Storage, achicadas. El original queda respaldado en Storage. ¿Continuar?`)) return;
  optimizando.value = true;
  let ok = 0; const errores = [];
  try {
    for (const [i, e] of lista.entries()) {
      progresoFotos.value = `${i + 1} de ${lista.length} · AFI ${e.afi}`;
      try {
        const n = nombre(e.afi);
        const original = await (await fetch(e.foto)).blob();
        await subir(`equipos/original/${n}.${(original.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`, original, original.type || 'image/jpeg');
        const url = await subir(`equipos/${n}.jpg`, await comprimirImagen(e.foto), 'image/jpeg');
        await sb(supabaseClient.from(TABLA_INVENTARIO).update({ foto: url }).eq('id', e.id));
        e.foto = url; ok++;
      } catch (err) { errores.push(`AFI ${e.afi}: ${errMsg(err)}`); }
    }
  } finally { optimizando.value = false; progresoFotos.value = ''; }
  alert(`Listo: ${ok} foto(s) optimizada(s).` + (errores.length ? `\n\nNo se pudieron pasar ${errores.length}:\n` + errores.slice(0, 8).join('\n') : ''));
};

export const OptimizarFotos = {
  name: 'OptimizarFotos',
  template: /* html */ `
<div class="bg-white p-5 rounded-xl shadow-sm border border-amber-200 flex flex-wrap items-center justify-between gap-4" data-fotos="optimizar">
  <div class="min-w-0">
    <h3 class="text-sm font-extrabold flex items-center gap-2 text-slate-800"><i class="fa-solid fa-gauge-high text-amber-500"></i> Ahorro de datos · fotos de equipos</h3>
    <p v-if="fotosPendientes.length" class="text-xs text-slate-600 mt-1">Hay <b>{{ fotosPendientes.length }} foto(s)</b> guardadas dentro de la base de datos ({{ pesoPendienteMB.toFixed(1) }} MB). Se bajan completas cada vez que alguien abre el sistema y gastan el límite de transferencia de Supabase. Al optimizarlas se achican y pasan a Storage.</p>
    <p v-else class="text-xs text-emerald-700 mt-1"><i class="fa-solid fa-circle-check mr-1"></i>Todas las fotos están optimizadas en Storage.</p>
  </div>
  <button v-if="fotosPendientes.length" @click="optimizarFotosEquipos" :disabled="optimizando" class="bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs uppercase flex items-center gap-2">
    <i :class="['fa-solid', optimizando ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles']"></i>{{ optimizando ? progresoFotos : 'Optimizar fotos' }}
  </button>
</div>`,
  setup() { return { fotosPendientes, pesoPendienteMB, optimizando, progresoFotos, optimizarFotosEquipos }; }
};
