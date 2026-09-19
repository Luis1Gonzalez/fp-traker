import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { session, signInWithPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signInWithPassword(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-graphite-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="font-display font-semibold text-2xl text-paper">FP Tracker</p>
          <p className="text-white/40 text-sm font-mono mt-1">FME304 · Corona de Aragón</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              placeholder="Correo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-field"
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-field"
            />

            {error && <p className="text-danger text-sm">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Un momento…' : 'Entrar'}
            </button>
          </form>

          <p className="text-xs text-graphite-600/70 text-center mt-4">
            El registro es solo por invitación. Si te enviaron un enlace o un QR, úsalo directamente.
          </p>
        </div>
      </div>
    </div>
  )
}
