import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { falla } from '../lib/notificar'

const AsignaturasContext = createContext(null)

export function AsignaturasProvider({ children }) {
  const { user } = useAuth()
  const [asignaturas, setAsignaturas] = useState([])
  const [loading, setLoading] = useState(true)

  // Depende del id y no del objeto user: supabase-js emite una sesión nueva al
  // refrescar el token o al volver a la pestaña, y eso relanzaba la consulta.
  const userId = user?.id

  const fetchAsignaturas = useCallback(async () => {
    if (!userId) {
      setAsignaturas([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('asignaturas')
      .select('*')
      .order('nombre', { ascending: true })
    if (!falla({ error }, 'No se pudieron cargar las asignaturas.')) setAsignaturas(data)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchAsignaturas()
  }, [fetchAsignaturas])

  const getAsignatura = (id) => asignaturas.find((a) => a.id === id)

  return (
    <AsignaturasContext.Provider
      value={{ asignaturas, loading, refetch: fetchAsignaturas, getAsignatura }}
    >
      {children}
    </AsignaturasContext.Provider>
  )
}

export function useAsignaturas() {
  const ctx = useContext(AsignaturasContext)
  if (!ctx) throw new Error('useAsignaturas debe usarse dentro de <AsignaturasProvider>')
  return ctx
}
