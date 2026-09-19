// Avisos globales (toasts). Cualquier módulo puede llamar a notificar();
// <Toaster /> se suscribe y los pinta.
const oyentes = new Set()
let siguienteId = 1

export function notificar(mensaje, tipo = 'error') {
  const aviso = { id: siguienteId++, mensaje, tipo }
  oyentes.forEach((fn) => fn(aviso))
}

export function suscribir(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

// Uso: if (falla(await supabase.from('x').insert(...), 'No se pudo guardar.')) return
// Devuelve true (y avisa al usuario) si la respuesta de Supabase trae error.
export function falla(respuesta, mensaje) {
  if (!respuesta?.error) return false
  console.error(mensaje, respuesta.error)
  notificar(mensaje)
  return true
}
