import { supabase } from './supabase'

export const BUCKET = 'tarea-fotos'
export const MAX_FOTO_BYTES = 10 * 1024 * 1024 // debe coincidir con step9-storage-y-limpieza.sql

const EXT_POR_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

// Devuelve un mensaje de error, o null si la foto es válida.
export function validarFoto(file) {
  if (!EXT_POR_MIME[file.type]) return 'Formato no admitido. Usa JPG, PNG, WebP o HEIC.'
  if (file.size > MAX_FOTO_BYTES) return 'La foto pesa más de 10 MB.'
  return null
}

export const extensionDe = (file) => EXT_POR_MIME[file.type] ?? 'jpg'

// Borra archivos de Storage. Un fallo aquí no debe romper la operación principal:
// solo queda un archivo huérfano, así que se registra en consola y ya.
export async function borrarFotos(paths) {
  const validos = paths.filter(Boolean)
  if (validos.length === 0) return
  const { error } = await supabase.storage.from(BUCKET).remove(validos)
  if (error) console.error('No se pudieron borrar fotos de Storage', validos, error)
}

// Borra las tareas terminadas hace más de 15 días junto con sus fotos.
// Se hace desde la app (no con pg_cron) porque borrar filas por SQL deja los
// archivos huérfanos en Storage. Las RLS limitan esto a las tareas del propio usuario.
export async function limpiarTareasTerminadas() {
  const limite = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('tareas')
    .select('id, foto_path')
    .eq('estado', 'terminada')
    .lt('terminada_at', limite)
  if (error || !data?.length) return

  const { error: errorBorrado } = await supabase
    .from('tareas')
    .delete()
    .in('id', data.map((t) => t.id))
  if (!errorBorrado) await borrarFotos(data.map((t) => t.foto_path))
}
