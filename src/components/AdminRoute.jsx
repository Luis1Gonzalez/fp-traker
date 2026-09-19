import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Solo para rutas dentro de <ProtectedRoute>. La seguridad real está en las RLS;
// esto solo evita mostrar una pantalla que no va a funcionar.
export default function AdminRoute({ children }) {
  const { esAdmin } = useAuth()

  if (esAdmin === null) return null
  if (!esAdmin) return <Navigate to="/" replace />

  return children
}
