// =====================================================================
// CORE · Conexión a Supabase y helpers de acceso a datos
// =====================================================================
const SUPABASE_URL = "https://dxpfaweuiijumvfrykvl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4cGZhd2V1aWlqdW12ZnJ5a3ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1ODE5NDcsImV4cCI6MjEwODE1Nzk0N30.du61QLSaevcDVDd0GmlM2xTYmE_c4envzjmneocnHgc";

// La llave "anon" es pública por diseño: la seguridad real la dan Supabase Auth (login)
// y las reglas RLS de la base de datos (ver sql/seguridad_paso1_auth_rls.sql).
export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'frc_auth' }
});

/** Dominio de los correos internos de Supabase Auth (no se envían correos a estas direcciones). */
export const DOMINIO_USUARIOS = 'usuarios.frchile.cl';

/**
 * Correo interno de un usuario. DEBE coincidir con public.frc_email() del SQL.
 * Ej: "Juan Pérez" → "juan_perez@usuarios.frchile.cl"
 */
export const emailDeUsuario = (usuario) => {
  const de = 'áéíóúàèìòùäëïöüñç', a = 'aeiouaeiouaeiounc';
  const base = String(usuario || '').trim().toLowerCase()
    .split('').map(c => { const i = de.indexOf(c); return i >= 0 ? a[i] : c; }).join('')
    .replace(/[^a-z0-9._-]/g, '_');
  return `${base}@${DOMINIO_USUARIOS}`;
};

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
