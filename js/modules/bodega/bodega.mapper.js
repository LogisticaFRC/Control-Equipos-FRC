// =====================================================================
// BODEGA DE FILTROS · Conversión de filas Supabase -> objetos de la app
//  · bd_filtros_stock        → filtros sueltos en bodega (inventario general)
//  · bd_filtros_kits         → kits armados (para una marca + modelo de equipo)
//  · bd_filtros_kits_items   → composición de UN kit
//  · bd_filtros_movimientos  → historial de entradas / salidas
// =====================================================================
import { TABLAS } from '../../core/tablas.js';
import { normTxt, normCodigo, normTipo } from '../filtros/filtros.mapper.js';

export const TABLA_STOCK = TABLAS.BODEGA_STOCK;
export const TABLA_KITS = TABLAS.BODEGA_KITS;
export const TABLA_KITS_ITEMS = TABLAS.BODEGA_KITS_ITEMS;
export const TABLA_BODEGA_MOV = TABLAS.BODEGA_MOV;

export const mapStock = (r) => ({
  id: r.id,
  codigo: normCodigo(r.codigo),
  tipo: normTipo(r.tipo),
  marca: normTxt(r.marca),
  cantidad: Number(r.cantidad) || 0,
  updatedAt: r.updated_at || ''
});

export const mapKit = (r) => ({
  id: r.id,
  codigo: normCodigo(r.codigo),
  equipoMarca: normTxt(r.equipo_marca),
  equipoModelo: normTxt(r.equipo_modelo),
  descripcion: String(r.descripcion || ''),
  cantidad: Number(r.cantidad) || 0,
  updatedAt: r.updated_at || ''
});

export const mapKitItem = (r) => ({
  id: r.id,
  kitId: r.kit_id,
  codigo: normCodigo(r.codigo),
  tipo: normTipo(r.tipo),
  marca: normTxt(r.marca),
  cantidad: Number(r.cantidad) || 1
});

export const mapMovBodega = (r) => ({
  id: r.id,
  fecha: r.fecha || '',
  tipoMov: normTxt(r.tipo_mov),
  esKit: !!r.es_kit,
  codigo: normCodigo(r.codigo),
  cantidad: Number(r.cantidad) || 0,
  detalle: String(r.detalle || ''),
  usuario: String(r.usuario || ''),
  ref: String(r.ref || '')
});
