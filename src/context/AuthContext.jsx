import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

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

  // null = comprobando. La tabla admins solo deja ver la propia fila (RLS).
  const [esAdmin, setEsAdmin] = useState(null)
  const userId = session?.user?.id

  useEffect(() => {
    if (!userId) {
      setEsAdmin(false)
      return
    }
    let activo = true
    setEsAdmin(null)
    supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (activo) setEsAdmin(!error && !!data)
      })
    return () => {
      activo = false
    }
  }, [userId])

  const signInWithPassword =(email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signOut = () => supabase.auth.signOut()

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
