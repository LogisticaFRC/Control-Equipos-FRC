// =====================================================================
// CORE · Conexión a Supabase y helpers de acceso a datos
// =====================================================================
const SUPABASE_URL = "https://dxpfaweuiijumvfrykvl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4cGZhd2V1aWlqdW12ZnJ5a3ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1ODE5NDcsImV4cCI6MjEwODE1Nzk0N30.du61QLSaevcDVDd0GmlM2xTYmE_c4envzjmneocnHgc";

export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

export const BUCKET_ARCHIVOS = 'archivos_frc';

/**
 * Ejecuta una consulta de Supabase y LANZA el error si lo hay.
 * (supabase-js nunca lanza excepciones: devuelve { data, error }.
 *  Sin esto, los try/catch no detectan fallas y se muestra "éxito" aunque no se haya guardado.)
 */
export async function sb(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export const errMsg = (err) => (err && err.message) || (typeof err === 'string' ? err : JSON.stringify(err));

/** Descarga todas las filas de una tabla paginando de 1000 en 1000. */
export async function fetchAllRows(tableName) {
  let allRows = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabaseClient
      .from(tableName).select('*')
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) {
      console.warn(`[Supabase] No se pudo leer ${tableName}:`, error.message || error);
      break;
    }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  return allRows;
}

/** Sube un archivo al bucket y devuelve su URL pública. */
export async function subirArchivoStorage(fileName, file) {
  await sb(supabaseClient.storage.from(BUCKET_ARCHIVOS).upload(fileName, file));
  const { data } = supabaseClient.storage.from(BUCKET_ARCHIVOS).getPublicUrl(fileName);
  return data.publicUrl;
}
