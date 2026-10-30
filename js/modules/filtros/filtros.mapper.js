// =====================================================================
// FILTROS · Conversión de filas Supabase -> objetos de la app
//
// Dos tablas:
//  · bd_filtros_precios  → LISTA DE PRECIOS (comparativo): un código de filtro con su precio en cada proveedor.
//                          Una fila por código + proveedor. Es la planilla "PRECIO FILTROS".
//  · bd_filtros          → APLICACIONES: qué código usa cada MARCA + MODELO de equipo, de qué tipo y cuántos.
//                          Mismo modelo + mismo tipo + distinto código = REFERENCIA CRUZADA.
//                          `cantidad` = unidades de ese tipo que lleva el modelo (Perfil de Equipo).
// =====================================================================
import { TABLAS } from '../../core/tablas.js';
export const TABLA_FILTROS = TABLAS.FILTROS;               // aplicaciones por modelo
export const TABLA_FILTROS_PRECIOS = TABLAS.FILTROS_PRECIOS; // lista de precios por proveedor

/** Texto normalizado (mayúsculas, sin espacios dobles) para comparar y guardar. */
export const normTxt = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

/** Código de filtro: los numéricos largos del Excel (ej. 1092471700) se guardan como texto. */
export const normCodigo = (v) => {
  if (typeof v === 'number') return Number.isInteger(v) ? v.toFixed(0) : String(v);
  return normTxt(v);
};

/** Corrige tipos mal escritos / equivalentes para que la referencia cruzada calce. */
const ALIAS_TIPO = {
  'COMBUSITBLE': 'COMBUSTIBLE',
  'SEPARADOR COMBUSTIBLE': 'COMBUSTIBLE SEPARADOR'
};
export const normTipo = (v) => { const t = normTxt(v); return ALIAS_TIPO[t] || t; };

/** Clave del modelo de equipo (marca + modelo). */
export const claveModelo = (marca, modelo) => `${normTxt(marca)}|${normTxt(modelo)}`;

export const mapAplicacion = (r) => ({
  id: r.id,
  equipoMarca: normTxt(r.equipo_marca),
  equipoModelo: normTxt(r.equipo_modelo),
  tipo: normTipo(r.tipo),
  marca: normTxt(r.marca),
  codigo: normCodigo(r.codigo),
  cantidad: Number(r.cantidad) || 1,
  ultimoAfi: String(r.ultimo_afi || ''),
  ultimoUso: r.ultimo_uso || ''
});

export const mapPrecio = (r) => ({
  id: r.id,
  codigo: normCodigo(r.codigo),
  marca: normTxt(r.marca),
  tipo: normTipo(r.tipo),
  proveedor: normTxt(r.proveedor),
  precio: Number(r.precio || 0),
  fechaPrecio: r.fecha_precio || ''
});
