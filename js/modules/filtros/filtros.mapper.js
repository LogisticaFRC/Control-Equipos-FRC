// =====================================================================
// FILTROS · Conversión fila Supabase (bd_filtros) -> objeto de la app
//
// Cada fila = "este filtro (tipo / marca / código), comprado a este proveedor a este precio,
// sirve para equipos de esta MARCA + MODELO".
//  · Referencia cruzada: filas con la misma marca+modelo de equipo y el mismo tipo
//    pero distinto código  -> códigos equivalentes para ese equipo.
//  · Comparativo de precios: mismo código con distintos proveedores.
//  · cantidad: cuántas unidades de ese TIPO lleva el modelo (se muestra en Perfil de Equipo).
// =====================================================================
import { TABLAS } from '../../core/tablas.js';
export const TABLA_FILTROS = TABLAS.FILTROS;

/** Texto normalizado (mayúsculas, sin espacios dobles) para comparar y guardar. */
export const normTxt = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

/** Clave del modelo de equipo (marca + modelo). */
export const claveModelo = (marca, modelo) => `${normTxt(marca)}|${normTxt(modelo)}`;

export const mapFiltro = (r) => ({
  id: r.id,
  equipoMarca: normTxt(r.equipo_marca),
  equipoModelo: normTxt(r.equipo_modelo),
  tipo: normTxt(r.tipo),
  marca: normTxt(r.marca),
  codigo: normTxt(r.codigo),
  proveedor: normTxt(r.proveedor),
  precio: Number(r.precio || 0),
  fechaPrecio: r.fecha_precio || '',
  cantidad: Number(r.cantidad) || 1,
  ultimoAfi: String(r.ultimo_afi || ''),
  ultimoUso: r.ultimo_uso || ''
});

/** Objeto de la app -> columnas de bd_filtros. */
export const toRow = (f) => ({
  equipo_marca: normTxt(f.equipoMarca),
  equipo_modelo: normTxt(f.equipoModelo),
  tipo: normTxt(f.tipo),
  marca: normTxt(f.marca),
  codigo: normTxt(f.codigo),
  proveedor: normTxt(f.proveedor),
  precio: Number(f.precio) || 0,
  cantidad: Number(f.cantidad) || 1
});
