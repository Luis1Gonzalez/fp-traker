import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY. Copia .env.example a .env y rellénalo con tus datos de Supabase.'
  )
}

// Una clave secreta en el navegador se salta todas las RLS y queda pública en el bundle.
function esClaveSecreta(clave) {
  if (clave.startsWith('sb_secret_')) return true
  try {
    const payload = clave.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload)).role === 'service_role'
  } catch {
    return false
  }
}

if (esClaveSecreta(supabaseKey)) {
  throw new Error(
    'VITE_SUPABASE_PUBLISHABLE_KEY es una clave SECRETA (service_role). Usa la clave publicable (sb_publishable_…) o la anon.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
