import { useEffect, useState, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode, X, Ban } from 'lucide-react'
import { format, formatDistanceToNow, isPast } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { falla } from '../lib/notificar'

export default function Invitar() {
  const { user } = useAuth()
  const [invitaciones, setInvitaciones] = useState([])
  const [activa, setActiva] = useState(null)
  const [generando, setGenerando] = useState(false)
  const [ciclos, setCiclos] = useState([])
  const [cicloSel, setCicloSel] = useState('') // '' = sin horario precargado

  const fetchCiclos = useCallback(async () => {
    const { data, error } = await supabase.from('ciclos').select('id, nombre').order('nombre')
    if (falla({ error }, 'No se pudo cargar la lista de ciclos.')) return
    setCiclos(data)
  }, [])

  const fetchInvitaciones = useCallback(async () => {
    const { data, error } = await supabase
      .from('invitaciones')
      .select('*')
      .order('created_at', { ascending: false })
    if (falla({ error }, 'No se pudo cargar el historial de invitaciones.')) return
    setInvitaciones(data)
  }, [])

  useEffect(() => {
    fetchInvitaciones()
    fetchCiclos()
  }, [fetchInvitaciones, fetchCiclos])

  const nombreCiclo = (id) => ciclos.find((c) => c.id === id)?.nombre || id

  function estadoDe(inv) {
    if (inv.revocado_at) return { label: 'Revocada', color: 'text-graphite-600 bg-graphite-700/10' }
    if (inv.usado_at) return { label: 'Usada', color: 'text-ok bg-ok/10' }
    if (isPast(new Date(inv.expira_at))) return { label: 'Expirada', color: 'text-graphite-600 bg-graphite-700/10' }
    return { label: 'Activa', color: 'text-signal-600 bg-signal-100' }
  }

  async function generarInvitacion() {
    setGenerando(true)
    const resultado = await supabase
      .from('invitaciones')
      .insert({ creado_por: user.id, ciclo_id: cicloSel || null })
      .select()
      .single()
    if (!falla(resultado, 'No se pudo generar la invitación.')) {
      setActiva(resultado.data)
      fetchInvitaciones()
    }
    setGenerando(false)
  }

  async function revocar(id) {
    const resultado = await supabase
      .from('invitaciones')
      .update({ revocado_at: new Date().toISOString() })
      .eq('id', id)
    if (falla(resultado, 'No se pudo revocar la invitación.')) return
    if (activa?.id === id) setActiva(null)
    fetchInvitaciones()
  }

  const link = activa ? `${window.location.origin}/registro?token=${activa.token}` : ''

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Invitar</h1>
          <p className="text-graphite-600 text-sm">
            Genera un código QR de un solo uso para que alguien se registre.
          </p>
        </div>
        <button onClick={generarInvitacion} disabled={generando} className="btn-primary flex items-center gap-1.5 shrink-0">
          <QrCode size={16} /> Generar QR
        </button>
      </div>

      <div className="mb-6 max-w-xs">
        <label htmlFor="ciclo" className="block text-xs text-graphite-600 mb-1.5">
          Horario que recibirá el nuevo usuario
        </label>
        <select
          id="ciclo"
          value={cicloSel}
          onChange={(e) => setCicloSel(e.target.value)}
          className="input-field"
        >
          <option value="">Ninguno (cuenta vacía)</option>
          {ciclos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      {activa && !activa.revocado_at && (
        <div className="card p-6 mb-6 flex flex-col items-center gap-3 max-w-xs">
          <QRCodeSVG value={link} size={200} />
          <p className="text-xs text-graphite-600 font-mono break-all text-center">{link}</p>
          {activa.ciclo_id && (
            <p className="text-xs text-graphite-600">Cargará el horario de {nombreCiclo(activa.ciclo_id)}</p>
          )}
          <p className="text-xs text-signal-600">
            Expira {formatDistanceToNow(new Date(activa.expira_at), { locale: es, addSuffix: true })}
          </p>
          <div className="flex gap-2 w-full">
            <button
              onClick={() => setActiva(null)}
              className="btn-secondary flex-1 flex items-center justify-center gap-1.5"
            >
              <X size={15} /> Cerrar
            </button>
            <button
              onClick={() => revocar(activa.id)}
              className="btn-danger flex-1 flex items-center justify-center gap-1.5"
            >
              <Ban size={15} /> Revocar
            </button>
          </div>
        </div>
      )}

      <p className="font-medium text-sm mb-2">Historial de invitaciones</p>
      <div className="grid grid-cols-1 gap-2">
        {invitaciones.map((inv) => {
          const est = estadoDe(inv)
          const activable = est.label === 'Activa'
          return (
            <div key={inv.id} className="card p-3 flex items-center justify-between">
              <div>
                <span className={`tag ${est.color}`}>{est.label}</span>
                {inv.ciclo_id && (
                  <span className="tag ml-1.5 text-graphite-600 bg-graphite-700/10">{nombreCiclo(inv.ciclo_id)}</span>
                )}
                <p className="text-xs text-graphite-600/70 font-mono mt-1">
                  Creada {format(new Date(inv.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                </p>
              </div>
              {activable && (
                <button onClick={() => revocar(inv.id)} className="btn-danger text-xs py-1.5 px-2.5">
                  Revocar
                </button>
              )}
            </div>
          )
        })}
        {invitaciones.length === 0 && (
          <p className="text-sm text-graphite-600">Todavía no has generado ninguna invitación.</p>
        )}
      </div>
    </div>
  )
}
