import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// Borra la caché offline de datos de Supabase (la crea el service worker al
// navegar; ver vite.config.js). Si falla (navegador sin esta API, etc.), no
// pasa nada grave: solo quedaría una caché vieja que se irá sobrescribiendo.
async function borrarCacheSinConexion() {
  try {
    await caches?.delete('datos-supabase')
  } catch {
    // no crítico
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch((error) => console.error('No se pudo recuperar la sesión', error))
      .finally(() => setLoading(false)) // sin esto, un fallo dejaba "Cargando…" para siempre

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // La tabla admins solo deja ver la propia fila (RLS). Se guarda a qué usuario
  // corresponde el resultado, para no arrastrar el de otra sesión anterior.
  const userId = session?.user?.id
  const [admin, setAdmin] = useState({ id: null, valor: false })

  useEffect(() => {
    if (!userId) return
    let activo = true
    supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (activo) setAdmin({ id: userId, valor: !error && !!data })
      })
    return () => {
      activo = false
    }
  }, [userId])

  // null = todavía comprobando (sesión cargando, o consulta de admin en curso).
  // Solo es false cuando ya se sabe que no hay sesión o que no es admin.
  const esAdmin = loading ? null : !userId ? false : admin.id === userId ? admin.valor : null

  const signInWithPassword = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signOut = async () => {
    await supabase.auth.signOut()
    await borrarCacheSinConexion() // en un móvil compartido, que no quede visible lo del usuario anterior
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, esAdmin, signInWithPassword, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
