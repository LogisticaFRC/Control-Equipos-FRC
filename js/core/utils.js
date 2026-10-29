// =====================================================================
// CORE · Utilidades compartidas (fechas, números, textos, archivos)
// =====================================================================

// ---------- Estados de disponibilidad ----------
export const normalizarClave = (str) => {
  if (!str) return 'Disponible';
  const eLower = String(str).toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (eLower.includes('trabajando') || eLower.includes('operativo') || eLower === 'op') return 'Operativo';
  if (eLower.includes('disponible') || eLower.includes('standby')) return 'Disponible';
  if (eLower.includes('traslado') || eLower.includes('transito')) return 'En Traslado';
  if (eLower.includes('mantencion') || eLower.includes('mantenimiento')) return 'En Mantencion';
  if (eLower.includes('fuera') || eLower.includes('servicio')) return 'Fuera de Servicio';
  if (eLower.includes('venta')) return 'Venta';
  return 'Disponible';
};

// ---------- Fechas ----------
const pad2 = (n) => String(n).padStart(2, '0');

/** Fecha de HOY en hora local (YYYY-MM-DD). Antes se usaba toISOString() (UTC) y después de las 21:00 en Chile daba el día siguiente. */
export const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** Suma días a una fecha ISO y devuelve ISO (hora local). */
export const sumarDiasISO = (iso, dias) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + dias);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
};

export const normalizarFecha = (val) => {
  try {
    if (val === null || val === undefined || val === '') return null;
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return null;
      return `${val.getFullYear()}-${pad2(val.getMonth() + 1)}-${pad2(val.getDate())}`;
    }
    let strVal = String(val).trim();
    if (strVal === "" || strVal === "-" || strVal === "null") return null;
    // Número serial de Excel
    if (typeof val === 'number' || (!isNaN(val) && !strVal.includes('-') && !strVal.includes('/'))) {
      const num = Number(val);
      if (num > 20000 && num < 80000) {
        const dateObj = new Date(Math.round((num - 25569) * 86400 * 1000));
        return `${dateObj.getUTCFullYear()}-${pad2(dateObj.getUTCMonth() + 1)}-${pad2(dateObj.getUTCDate())}`;
      }
    }
    if (strVal.includes('T')) strVal = strVal.split('T')[0];
    if (strVal.includes(' ')) strVal = strVal.split(' ')[0];
    // DD-MM-YYYY o DD/MM/YYYY
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(strVal)) {
      const parts = strVal.split(/[-/]/);
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return strVal;
  } catch (e) { return null; }
};

export const esFechaISOValida = (iso) => typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso);

export const formatDateForDisplay = (val) => {
  const iso = normalizarFecha(val);
  if (!iso || iso === '-') return '-';
  const parts = iso.split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : iso;
};

export const formatExcelDate = (val) => normalizarFecha(val) || '-';
export const formatIsoDateForSupabase = (val) => normalizarFecha(val);

export const parseIsoDate = (val) => {
  const fmt = normalizarFecha(val);
  if (!fmt || fmt === '-') return 0;
  const t = new Date(`${fmt}T00:00:00`).getTime();
  return isNaN(t) ? 0 : t;
};

/** Diferencia en días (f1 - f2). Devuelve null si alguna fecha no es válida. */
export const diasEntre = (f1, f2) => {
  const iso1 = normalizarFecha(f1), iso2 = normalizarFecha(f2);
  if (!esFechaISOValida(iso1) || !esFechaISOValida(iso2)) return null;
  const [y1, m1, d1] = iso1.split('-').map(Number);
  const [y2, m2, d2] = iso2.split('-').map(Number);
  return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86400000);
};

export const esFechaEnRango = (fechaDia, fechaIni, fechaFin) => {
  if (!fechaIni || !fechaFin) return false;
  const fD = normalizarFecha(fechaDia), fI = normalizarFecha(fechaIni), fF = normalizarFecha(fechaFin);
  return fD >= fI && fD <= fF;
};

// ---------- Números y textos ----------
export const parseNum = (val) => {
  if (val === null || val === undefined) return 0;
  const s = String(val).trim();
  if (s === "" || s === "-") return 0;
  const n = Number(s.replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

export const parseStr = (val) => (val === null || val === undefined) ? "" : String(val).trim();

/** Normaliza un AFI: quita prefijo "AFI " y sufijo " - Tipo". */
export const limpiarAfi = (val) => {
  let afi = String(val || '').trim();
  if (afi.toUpperCase().startsWith('AFI')) afi = afi.replace(/^AFI\s*/i, '').trim();
  if (afi.includes(' - ')) afi = afi.split(' - ')[0].trim();
  return afi;
};

export const mismoAfi = (a, b) => String(a ?? '').trim().toUpperCase() === String(b ?? '').trim().toUpperCase();

/** Ordena por número de AFI (asc/desc). */
export const compararAfi = (a, b, orden = 'asc') => {
  const numA = parseInt(String(a).replace(/\D/g, '')) || 0;
  const numB = parseInt(String(b).replace(/\D/g, '')) || 0;
  const r = numA !== numB ? numA - numB : String(a).localeCompare(String(b), undefined, { numeric: true });
  return orden === 'desc' ? -r : r;
};

export const calcularRestaHoras = (inicio, termino) => {
  if (!inicio || !termino || inicio === '-' || termino === '-') return '-';
  const parseTime = (tStr) => {
    const parts = String(tStr).trim().split(':');
    return parts.length >= 2 ? (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0) : 0;
  };
  const diffMins = parseTime(termino) - parseTime(inicio);
  const finalMins = diffMins < 0 ? diffMins + 1440 : diffMins;
  return `${Math.floor(finalMins / 60)}h ${finalMins % 60}m`;
};

export const getMecanicosText = (item) => {
  const list = [item.mec1, item.mec2, item.mec3, item.mec4].filter(m => m && String(m).trim() !== "" && String(m).trim() !== "-");
  return list.length > 0 ? list.join(", ") : "-";
};

/** Imagen de reemplazo local (via.placeholder.com ya no existe). */
export const placeholderImg = (texto = 'FRC', w = 300, h = 180) => {
  const t = String(texto).replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#0f172a"/><text x="50%" y="50%" fill="#ffffff" font-family="Arial,sans-serif" font-size="${Math.round(h / 6)}" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${t}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
};

// ---------- Exportar / Importar ----------
/** Exporta a CSV (separador ;). Los objetos anidados se aplanan un nivel (ej: horometros.hAprox). */
export const exportarCSV = (dataArray, filename = 'Export') => {
  if (!dataArray || !dataArray.length) return alert("Sin datos.");
  const aplanar = (row) => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [k2, v2] of Object.entries(v)) out[`${k}.${k2}`] = v2;
      } else if (Array.isArray(v)) {
        out[k] = v.length ? JSON.stringify(v) : '';
      } else out[k] = v;
    }
    return out;
  };
  const rows = dataArray.map(aplanar);
  const headers = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const csvRows = [headers.join(';')];
  for (const row of rows) {
    csvRows.push(headers.map(h => `"${('' + (row[h] ?? '')).replace(/"/g, '""')}"`).join(';'));
  }
  const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};

const normalizeKey = (str) => String(str || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

/** Busca un valor en una fila de Excel tolerando mayúsculas, tildes y espacios en el encabezado. */
export const getVal = (row, ...keys) => {
  if (!row) return "";
  const rowKeys = Object.keys(row);
  for (const k of keys) {
    const tk = normalizeKey(k);
    const fk = rowKeys.find(rk => normalizeKey(rk) === tk);
    if (fk && row[fk] !== undefined && row[fk] !== null && String(row[fk]).trim() !== "") return row[fk];
  }
  return "";
};

/** Indica si alguna fila del Excel trae una columna (aunque esté vacía en esa fila). */
export const tieneColumna = (rows, ...keys) => {
  const tks = keys.map(normalizeKey);
  return rows.some(r => Object.keys(r).some(rk => tks.includes(normalizeKey(rk))));
};

export const parseFileAnyFormat = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      resolve(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "", raw: false }));
    } catch (e) { reject(new Error("No se pudo leer el archivo Excel.")); }
  };
  reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
  reader.readAsArrayBuffer(file);
});

/** Limpia el <input type="file"> para poder volver a subir el mismo archivo. */
export const resetInputFile = (e) => { try { e.target.value = ''; } catch (_) {} };
