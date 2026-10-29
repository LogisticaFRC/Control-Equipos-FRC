// =====================================================================
// FORMATOS & FICHAS TÉCNICAS · ⚠️ MÓDULO EN CONSTRUCCIÓN
// Código trasladado TAL CUAL desde el archivo original (sin depurar, sin UI todavía).
// Solo se cambiaron los imports para que funcione separado del archivo principal.
// =====================================================================
import { supabaseClient } from '../../core/supabase.js';
import { dbModelosFichas, dbFormatos, cargarDatosDesdeSupabase } from '../../core/store.js';

const { ref } = Vue;

export { dbModelosFichas, dbFormatos };

export const showModalNuevoFormato = ref(false);
export const formNuevoFormato = ref({ carpeta: 'CHECKLISTS', nombre: '', link: '' });
export const openFoldersFormatos = ref({ CHECKLISTS: true, PROCEDIMIENTOS: true, MANUALES: true, PERMISOS: true });

export const toggleFolderFormatos = (folderKey) => { openFoldersFormatos.value[folderKey] = !openFoldersFormatos.value[folderKey]; };

// SUBIR FICHA TÉCNICA POR MODELO
export const subirFichaTecnicaModelo = async (e, modeloObj) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const fileName = `ficha_${modeloObj.modelo.replace(/\s+/g, '_')}_${Date.now()}_${file.name}`;
    const { data, error } = await supabaseClient.storage.from('archivos_frc').upload(fileName, file);
    if (error) throw error;
    const { data: urlData } = supabaseClient.storage.from('archivos_frc').getPublicUrl(fileName);

    // Guardar en tabla BD_MODELOS_FICHA
    await supabaseClient.from('BD_MODELOS_FICHA').upsert({
      marca: modeloObj.marca,
      modelo: modeloObj.modelo,
      link_ficha: urlData.publicUrl
    }, { onConflict: 'modelo' });

    await cargarDatosDesdeSupabase();
    alert("¡Ficha técnica del modelo subida con éxito!");
  } catch(err) {
    alert("Error al subir ficha técnica: " + (err.message || JSON.stringify(err)));
  }
};

// SUBIR ARCHIVO NUEVO A FORMATOS
export const subirArchivoFormato = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const fileName = `formato_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const { data, error } = await supabaseClient.storage.from('archivos_frc').upload(fileName, file);
    if (error) throw error;
    const { data: urlData } = supabaseClient.storage.from('archivos_frc').getPublicUrl(fileName);
    formNuevoFormato.value.link = urlData.publicUrl;
    if(!formNuevoFormato.value.nombre) formNuevoFormato.value.nombre = file.name;
    alert("¡Archivo cargado correctamente!");
  } catch(err) {
    alert("Error al subir archivo: " + (err.message || JSON.stringify(err)));
  }
};

export const guardarNuevoFormatoDB = async () => {
  if(!formNuevoFormato.value.nombre || !formNuevoFormato.value.link) return alert("Completa el nombre y sube el archivo.");
  try {
    await supabaseClient.from('BD_FORMATOS').insert([{
      carpeta: formNuevoFormato.value.carpeta,
      nombre: formNuevoFormato.value.nombre,
      link: formNuevoFormato.value.link
    }]);
    await cargarDatosDesdeSupabase();
    showModalNuevoFormato.value = false;
    formNuevoFormato.value = { carpeta: 'CHECKLISTS', nombre: '', link: '' };
    alert("¡Formato guardado con éxito!");
  } catch(err) {
    alert("Error al guardar formato: " + (err.message || JSON.stringify(err)));
  }
};

export const eliminarFormatoDB = async (id) => {
  if(confirm("¿Eliminar este formato?")) {
    try {
      await supabaseClient.from('BD_FORMATOS').delete().eq('id', id);
      await cargarDatosDesdeSupabase();
    } catch(e) {}
  }
};

export const obtenerFichaModelo = (modeloStr) => {
  if(!modeloStr) return null;
  const found = dbModelosFichas.value.find(m => String(m.modelo).trim().toUpperCase() === String(modeloStr).trim().toUpperCase());
  return found ? found.link_ficha : null;
};
