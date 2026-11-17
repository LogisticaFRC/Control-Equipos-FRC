// =====================================================================
// TERRENO CRTG (app del celular) · 2026-11-17 · ver sql/crtg.sql
//   · Equipos: solo los que están en CRTG (mecanicos.service.js → esEquipoCrtg)
//   · Cambiar ubicación del equipo (queda como movimiento) · RPC frc_crtg_ubicacion
//   · Programa de mantención CRTG (programa de mantención cuyo nombre/carpeta dice CRTG):
//     el técnico marca Realizado / No realizado (apoyo para Operaciones) · RPC frc_crtg_programa
//   · Pedir repuestos: equipo, fecha, descripción y hasta 5 fotos → bd_pedidos_repuestos
// =====================================================================
import { supabaseClient, sb, errMsg, subirArchivoStorage } from '../../core/supabase.js';
import { usuarioActivo, dbProgramasCalendarios, dbProgramasItems, buscarEquipoPorAfi, cargarDatosDesdeSupabase } from '../../core/store.js';
import { hoyISO, mismoAfi, limpiarAfi } from '../../core/utils.js';
import { carpetaDe } from '../programas/programas.service.js';
import { textoUbicacion } from '../areas/areas.service.js';

const { ref, computed } = Vue;
const SQL_CRTG = 'Falta ejecutar sql/crtg.sql en Supabase (SQL Editor → Run).';
const faltaSql = (e) => /frc_crtg|bd_pedidos_repuestos|crtg_estado|schema cache|does not exist|function/i.test(errMsg(e));
export const LOGO_CRTG = 'icons/logo-crtg.png';

// ---------- Programa de mantención CRTG ----------
const textoProg = (p) => [p.nombre_programa, p.mes, p.subcarpeta, p.carpeta].join(' ');
/** Programas de mantención de CRTG (nombre / subcarpeta con "CRTG"), el vigente primero. */
export const programasCrtg = computed(() => {
  const h = hoyISO();
  return dbProgramasCalendarios.value
    .filter(p => carpetaDe(p) === 'MANTENCION' && /CRTG/i.test(textoProg(p)))
    .map(p => ({ ...p, vigente: String(p.fecha_inicio_programa || '') <= h && h <= String(p.fecha_termino_programa || '9999') }))
    .sort((a, b) => (b.vigente - a.vigente) || String(b.fecha_termino_programa || '').localeCompare(String(a.fecha_termino_programa || '')));
});
export const progCrtgSel = ref(null);
export const programaCrtg = computed(() => programasCrtg.value.find(p => p.id === progCrtgSel.value) || programasCrtg.value[0] || null);
/** Ítems del programa CRTG (resumido): pendientes primero, por fecha. */
export const itemsCrtg = computed(() => {
  const p = programaCrtg.value; if (!p) return [];
  return dbProgramasItems.value.filter(i => String(i.programa_id) === String(p.id))
    .sort((a, b) => (Boolean(a.realizado || a.crtg_estado === 'REALIZADO') - Boolean(b.realizado || b.crtg_estado === 'REALIZADO'))
      || String(a.fecha_programada || '').localeCompare(String(b.fecha_programada || '')));
});
export const resumenCrtg = computed(() => {
  const l = itemsCrtg.value;
  const ok = l.filter(i => i.realizado || i.crtg_estado === 'REALIZADO').length;
  return { total: l.length, ok, no: l.filter(i => !i.realizado && i.crtg_estado === 'NO_REALIZADO').length, pend: l.length - ok, pct: l.length ? Math.round(ok / l.length * 100) : 0 };
});
/** Marca (o desmarca con null) lo que hizo el técnico CRTG. */
export const reportarItemCrtg = async (item, estado, obs = '') => {
  try {
    const { error } = await supabaseClient.rpc('frc_crtg_programa', { p_item: item.id, p_estado: estado, p_obs: obs || '' });
    if (error) throw error;
    Object.assign(item, { crtg_estado: estado, crtg_obs: obs || null, crtg_por: estado ? String(usuarioActivo.value?.nombre || usuarioActivo.value?.usuario || '').toUpperCase() : null, crtg_fecha: estado ? new Date().toISOString() : null });
    return true;
  } catch (err) { alert(faltaSql(err) ? SQL_CRTG : 'No se pudo guardar: ' + errMsg(err)); return false; }
};

// ---------- Ubicación del equipo ----------
export const cambiarUbicacionCrtg = async (e, texto, loc) => {
  const t = String(texto || '').trim();
  if (!t) { alert('Elige o escribe la ubicación.'); return false; }
  try {
    const { error } = await supabaseClient.rpc('frc_crtg_ubicacion', {
      p_afi: String(e.afi), p_texto: loc ? textoUbicacion(loc.id) : t.toUpperCase(),
      p_locacion_id: loc ? String(loc.id) : null, p_empresa: 'CRTG'   // sigue siendo equipo de CRTG
    });
    if (error) throw error;
    await cargarDatosDesdeSupabase(['inventario', 'movimientos']).catch(() => {});
    return true;
  } catch (err) { alert(faltaSql(err) ? SQL_CRTG : 'No se pudo cambiar la ubicación: ' + errMsg(err)); return false; }
};

// ---------- Pedir repuestos ----------
export const MAX_FOTOS_PEDIDO = 5;
const comprimir = (file, max = 1600, calidad = 0.8) => new Promise((ok) => {
  if (!/^image\//.test(file.type)) return ok(file);
  const img = new Image(); const u = URL.createObjectURL(file);
  img.onload = () => {
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    c.toBlob(b => { URL.revokeObjectURL(u); ok(b || file); }, 'image/jpeg', calidad);
  };
  img.onerror = () => { URL.revokeObjectURL(u); ok(file); };
  img.src = u;
});
export const pedidoVacio = (afi = '') => ({ afi, fecha: hoyISO(), descripcion: '', fotos: [] });   // fotos: [{ file, url }]
export const enviandoPedido = ref(false);
export const enviarPedido = async (f, origen = 'CRTG') => {
  const e = buscarEquipoPorAfi(f.afi);
  if (!String(f.afi || '').trim()) { alert('Elige el equipo.'); return false; }
  if (!String(f.descripcion || '').trim()) { alert('Describe qué repuesto necesitas.'); return false; }
  if ((f.fotos || []).length > MAX_FOTOS_PEDIDO) { alert(`Máximo ${MAX_FOTOS_PEDIDO} fotos.`); return false; }
  enviandoPedido.value = true;
  try {
    const urls = [];
    for (let k = 0; k < f.fotos.length; k++) {
      const blob = await comprimir(f.fotos[k].file);
      urls.push(await subirArchivoStorage(`repuestos/${limpiarAfi(f.afi)}_${f.fecha}_${Date.now()}_${k + 1}.jpg`, blob));
    }
    const u = usuarioActivo.value || {};
    await sb(supabaseClient.from('bd_pedidos_repuestos').insert([{
      origen, afi: String(f.afi).trim().toUpperCase(), equipo: e ? [e.tipo, e.marca, e.modelo].filter(Boolean).join(' ') : null,
      fecha: f.fecha || hoyISO(), descripcion: String(f.descripcion).trim(), fotos: urls,
      solicitante: String(u.nombre || u.usuario || '').toUpperCase(), usuario: u.usuario || null
    }]));
    await cargarMisPedidos();
    return true;
  } catch (err) { alert(faltaSql(err) ? SQL_CRTG : 'No se pudo enviar el pedido: ' + errMsg(err)); return false; }
  finally { enviandoPedido.value = false; }
};
export const misPedidos = ref([]);
export const cargarMisPedidos = async () => {
  const u = usuarioActivo.value; if (!u) return;
  try { misPedidos.value = await sb(supabaseClient.from('bd_pedidos_repuestos').select('*').eq('usuario', u.usuario).order('id', { ascending: false }).limit(50)) || []; }
  catch (_) { misPedidos.value = []; }
};
export const ESTADOS_PEDIDO = {
  PENDIENTE: { l: 'Pendiente', c: 'bg-amber-100 text-amber-800 border-amber-300' },
  PEDIDO: { l: 'Pedido', c: 'bg-sky-100 text-sky-800 border-sky-300' },
  RECIBIDO: { l: 'Recibido', c: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  RECHAZADO: { l: 'Rechazado', c: 'bg-rose-100 text-rose-800 border-rose-300' }
};
export { mismoAfi };
