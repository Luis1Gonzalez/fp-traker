import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Registro() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [estadoToken, setEstadoToken] = useState('validando') // validando | valido | invalido
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cuentaCreada, setCuentaCreada] = useState(false)

  useEffect(() => {
    if (!token) {
      setEstadoToken('invalido')
      return
    }
    supabase.rpc('validar_invitacion', { p_token: token }).then(({ data, error }) => {
      setEstadoToken(!error && data === true ? 'valido' : 'invalido')
    })
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password !== password2) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const { error: fnError } = await supabase.functions.invoke('registro', {
      body: { token, email, password },
    })

    if (fnError) {
      let mensaje = 'No se pudo crear la cuenta.'
      try {
        const cuerpo = await fnError.context.json()
        if (cuerpo?.error) mensaje = cuerpo.error
      } catch {
        // Sin cuerpo legible (p. ej. error de red): se deja el mensaje genérico.
      }
      setError(mensaje)
      setLoading(false)
      return
    }

    setCuentaCreada(true)
    setLoading(false)
  }

  if (estadoToken === 'validando') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-graphite-900">
        <p className="text-white/50 font-mono text-sm">Validando invitación…</p>
      </div>
    )
  }

  if (estadoToken === 'invalido') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-graphite-900 px-4">
        <div className="card p-6 max-w-sm text-center">
          <p className="font-medium mb-2">Invitación no válida</p>
          <p className="text-sm text-graphite-600 mb-4">
            Este enlace ya fue usado, expiró o fue revocado. Pide uno nuevo a quien te invitó.
          </p>
          <Link to="/login" className="text-blueprint-600 text-sm underline">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  if (cuentaCreada) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-graphite-900 px-4">
        <div className="card p-6 max-w-sm text-center">
          <p className="font-medium mb-2">Cuenta creada ✅</p>
          <p className="text-sm text-graphite-600 mb-4">
            Tu cuenta ya está lista, ya puedes iniciar sesión.
          </p>
          <Link to="/login" className="btn-primary inline-block">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-graphite-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="font-display font-semibold text-2xl text-paper">FP Tracker</p>
          <p className="text-white/40 text-sm font-mono mt-1">Crear cuenta por invitación</p>
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
              minLength={6}
              className="input-field"
            />
            <input
              type="password"
              placeholder="Repite la contraseña"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
              minLength={6}
              className="input-field"
            />

            {error && <p className="text-danger text-sm">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
