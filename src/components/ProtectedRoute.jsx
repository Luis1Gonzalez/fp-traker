import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <p className="font-mono text-sm text-graphite-600">Cargando…</p>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return children
}
