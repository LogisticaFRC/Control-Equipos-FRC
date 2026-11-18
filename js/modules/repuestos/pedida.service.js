// =====================================================================
// REPUESTOS Y COMPRAS · PEDIDA DE REPUESTOS (2026-11-17) · ver sql/crtg.sql
// Junta en una lista lo que se pide:
//   · TALLER: hallazgos / inspecciones del Programa de Reparación con "necesita repuesto"
//     (bd_taller_problemas: repuesto, cantidad, foto, fecha_aprox_repuesto, nota_admin, repuesto_estado)
//   · CRTG (y otros): pedidos hechos desde la app (bd_pedidos_repuestos: equipo, fecha, descripción, hasta 5 fotos)
// Operaciones cambia el estado (Pendiente → Pedido → Recibido / Rechazado), la fecha aprox. de llegada y una nota.
// =====================================================================
import { supabaseClient, sb, errMsg } from '../../core/supabase.js';
import { buscarEquipoPorAfi, soloEditor, usuarioActivo } from '../../core/store.js';
import { dbProblemas, cargarProblemas } from '../taller/taller.service.js';
import { pedidosPendientes } from '../../core/avisos-taller.js';
import { ESTADOS_PEDIDO } from '../mecanicos/crtg.service.js';

const { ref, computed } = Vue;
export { ESTADOS_PEDIDO };
export const dbPedidos = ref([]);
export const faltaSqlPedidos = ref(false);
export const cargandoPedidos = ref(false);

export const cargarPedidos = async () => {
  cargandoPedidos.value = true;
  try {
    const [p] = await Promise.all([
      sb(supabaseClient.from('bd_pedidos_repuestos').select('*').order('id', { ascending: false })).catch(err => { faltaSqlPedidos.value = /bd_pedidos_repuestos|does not exist|schema cache/i.test(errMsg(err)); return []; }),
      cargarProblemas()
    ]);
    dbPedidos.value = p || [];
    if (p && p.length >= 0 && !faltaSqlPedidos.value) faltaSqlPedidos.value = false;
  } finally { cargandoPedidos.value = false; actualizarAviso(); }
};

const descEquipo = (afi, guardado) => { const e = buscarEquipoPorAfi(afi); return e ? [e.tipo, e.marca, e.modelo].filter(Boolean).join(' ') : (guardado || ''); };
/** Lista unificada (más nuevos primero). */
export const pedidosTodos = computed(() => {
  const taller = dbProblemas.value.filter(h => h.necesita_repuesto && h.estado !== 'RECHAZADO').map(h => ({
    key: 'T' + h.id, origen: 'TALLER', id: h.id, afi: h.afi, equipo: descEquipo(h.afi), fecha: String(h.created_at || '').slice(0, 10),
    descripcion: [h.repuesto, h.cantidad ? '(' + h.cantidad + ')' : '', h.codigo_repuesto ? '· Cód. ' + h.codigo_repuesto : '', h.serie_motor ? '· Serie motor ' + h.serie_motor : ''].filter(Boolean).join(' '), detalle: h.descripcion,
    fotos: Array.isArray(h.fotos) && h.fotos.length ? h.fotos : h.foto_url ? [h.foto_url] : [], solicitante: h.reportado_por || '',
    lugar: h.nave || (h.intervencion_id ? 'OT de Fallas · report N° ' + h.intervencion_id : ''),
    estado: h.repuesto_estado || 'PENDIENTE', fecha_aprox: h.fecha_aprox_repuesto || '', nota: h.nota_admin || '', raw: h
  }));
  const otros = dbPedidos.value.map(p => ({
    key: 'P' + p.id, origen: p.origen || 'CRTG', id: p.id, afi: p.afi, equipo: descEquipo(p.afi, p.equipo), fecha: p.fecha,
    descripcion: p.descripcion, detalle: '', fotos: Array.isArray(p.fotos) ? p.fotos : [], solicitante: p.solicitante || p.usuario || '', lugar: '',
    estado: p.estado || 'PENDIENTE', fecha_aprox: p.fecha_aprox || '', nota: p.nota || '', raw: p
  }));
  return [...taller, ...otros].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
});
const actualizarAviso = () => { pedidosPendientes.value = pedidosTodos.value.filter(p => p.estado === 'PENDIENTE').length; };

// ---------- Filtros ----------
export const filtroPedidos = ref({ origen: '', estado: 'ABIERTOS', texto: '' });
export const pedidosFiltrados = computed(() => {
  const f = filtroPedidos.value, q = String(f.texto || '').trim().toUpperCase();
  return pedidosTodos.value.filter(p =>
    (!f.origen || p.origen === f.origen) &&
    (!f.estado || (f.estado === 'ABIERTOS' ? ['PENDIENTE', 'PEDIDO'].includes(p.estado) : p.estado === f.estado)) &&
    (!q || [p.afi, p.equipo, p.descripcion, p.detalle, p.solicitante, p.nota].join(' ').toUpperCase().includes(q)));
});
export const resumenPedidos = computed(() => {
  const l = pedidosTodos.value; const c = (e) => l.filter(p => p.estado === e).length;
  return { total: l.length, PENDIENTE: c('PENDIENTE'), PEDIDO: c('PEDIDO'), RECIBIDO: c('RECIBIDO'), RECHAZADO: c('RECHAZADO') };
});

// ---------- Guardar cambios (estado / fecha aprox. / nota) ----------
export const guardarPedido = async (p, cambios) => {
  if (!soloEditor()) return false;
  const quien = String(usuarioActivo.value?.nombre || usuarioActivo.value?.usuario || '').toUpperCase();
  try {
    if (p.origen === 'TALLER') {
      const c = {};
      if ('estado' in cambios) c.repuesto_estado = cambios.estado;
      if ('fecha_aprox' in cambios) c.fecha_aprox_repuesto = cambios.fecha_aprox || null;
      if ('nota' in cambios) c.nota_admin = String(cambios.nota || '').trim() || null;
      await sb(supabaseClient.from('bd_taller_problemas').update(c).eq('id', p.id));
      Object.assign(p.raw, c);
    } else {
      const c = { ...cambios, actualizado_por: quien, updated_at: new Date().toISOString() };
      if ('fecha_aprox' in c) c.fecha_aprox = c.fecha_aprox || null;
      await sb(supabaseClient.from('bd_pedidos_repuestos').update(c).eq('id', p.id));
      Object.assign(p.raw, c);
    }
    Object.assign(p, cambios);
    dbProblemas.value = [...dbProblemas.value]; dbPedidos.value = [...dbPedidos.value];
    actualizarAviso();
    return true;
  } catch (err) {
    alert(/repuesto_estado|bd_pedidos_repuestos|schema cache|column/i.test(errMsg(err)) ? 'Falta ejecutar sql/crtg.sql en Supabase.' : 'No se pudo guardar: ' + errMsg(err));
    return false;
  }
};
export const eliminarPedido = async (p) => {
  if (p.origen === 'TALLER') return alert('Los repuestos del taller se gestionan en Programas Reparación (REPARAR).');
  if (!confirm(`¿Eliminar el pedido del AFI ${p.afi}?`)) return;
  try { await sb(supabaseClient.from('bd_pedidos_repuestos').delete().eq('id', p.id)); await cargarPedidos(); }
  catch (err) { alert('No se pudo eliminar: ' + errMsg(err)); }
};
