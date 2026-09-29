import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bell, Megaphone, ClipboardList, RefreshCw, Unlink } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { falla, notificar } from '../lib/notificar'

// No es secreto: identifica a la app ante Google, igual que la URL de tu web.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLASSROOM_CLIENT_ID

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
  'openid',
  'email',
].join(' ')

function redirectUriActual() {
  return `${window.location.origin}/classroom`
}

function iniciarConexion() {
  if (!CLIENT_ID) {
    notificar('Falta configurar la conexión con Google Classroom.')
    return
  }
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('redirect_uri', redirectUriActual())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  window.location.href = url.toString()
}

export default function Classroom() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [estado, setEstado] = useState(null) // { conectado, google_email, ultima_sincronizacion }
  const [items, setItems] = useState([])
  const [conectando, setConectando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)

  const cargarEstado = useCallback(async () => {
    const { data, error } = await supabase.rpc('classroom_estado').single()
    if (falla({ error }, 'No se pudo comprobar la conexión con Classroom.')) return
    setEstado(data)
  }, [])

  const cargarItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('classroom_items')
      .select('*')
      .order('publicado_at', { ascending: false })
    if (falla({ error }, 'No se pudieron cargar las novedades de Classroom.')) return
    setItems(data)
  }, [])

  const sincronizar = useCallback(async () => {
    setSincronizando(true)
    const { data, error } = await supabase.functions.invoke('classroom-sync')
    setSincronizando(false)
    if (error) {
      let mensaje = 'No se pudo sincronizar con Classroom.'
      try {
        const cuerpo = await error.context.json()
        if (cuerpo?.error) mensaje = cuerpo.error
      } catch {
        // sin cuerpo legible: se deja el mensaje genérico
      }
      notificar(mensaje)
      cargarEstado() // por si la conexión caducó, para que se vea "Desconectado"
      return
    }
    notificar(data.nuevos > 0 ? `${data.nuevos} novedades nuevas.` : 'Ya estaba todo al día.', 'ok')
    cargarEstado()
    cargarItems()
  }, [cargarEstado, cargarItems])

  // Vuelta de Google con ?code=...: cambia el código por la conexión guardada.
  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) return
    setConectando(true)
    supabase.functions
      .invoke('classroom-conectar', { body: { code, redirect_uri: redirectUriActual() } })
      .then(({ error }) => {
        setSearchParams({}, { replace: true }) // limpia el ?code= de la URL
        setConectando(false)
        if (error) {
          notificar('No se pudo conectar con Google Classroom.')
          return
        }
        notificar('Cuenta de Google conectada.', 'ok')
        cargarEstado()
        sincronizar()
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    cargarEstado()
  }, [cargarEstado])

  useEffect(() => {
    if (estado?.conectado) cargarItems()
  }, [estado?.conectado, cargarItems])

  async function desconectar() {
    if (!confirm('¿Desconectar Google Classroom? Se borrarán las novedades importadas.')) return
    const { error } = await supabase.functions.invoke('classroom-desconectar')
    if (error) {
      notificar('No se pudo desconectar.')
      return
    }
    setItems([])
    cargarEstado()
  }

  async function marcarLeido(item) {
    if (item.leido) return
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, leido: true } : i)))
    const resultado = await supabase.from('classroom_items').update({ leido: true }).eq('id', item.id)
    falla(resultado, 'No se pudo marcar como leído.')
  }

  const sinLeer = items.filter((i) => !i.leido).length

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold">Classroom</h1>
      </div>
      <p className="text-graphite-600 text-sm mb-4 hidden sm:block">
        Tareas y anuncios importados de Google Classroom, aparte de tus propias Tareas y Apuntes.
      </p>

      {estado === null || conectando ? (
        <p className="text-sm text-graphite-600">{conectando ? 'Conectando con Google…' : 'Cargando…'}</p>
      ) : !estado.conectado ? (
        <div className="card p-6 max-w-sm">
          <Bell size={22} className="text-blueprint-500 mb-2" />
          <p className="font-medium text-sm mb-1">Sin conectar</p>
          <p className="text-xs text-graphite-600 mb-4">
            Conecta tu cuenta de Google para ver aquí las tareas y anuncios de tus cursos de Classroom.
          </p>
          <button onClick={iniciarConexion} className="btn-primary w-full">
            Conectar con Google Classroom
          </button>
        </div>
      ) : (
        <div>
          <div className="card p-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-graphite-600">
              <p className="font-medium text-graphite-900">{estado.google_email || 'Cuenta conectada'}</p>
              <p>
                {estado.ultima_sincronizacion
                  ? `Última vez: ${format(parseISO(estado.ultima_sincronizacion), "d MMM, HH:mm", { locale: es })}`
                  : 'Todavía no se ha sincronizado.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={sincronizar}
                disabled={sincronizando}
                className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-2.5"
              >
                <RefreshCw size={13} className={sincronizando ? 'animate-spin' : ''} />
                {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
              </button>
              <button onClick={desconectar} className="btn-danger p-1.5" title="Desconectar">
                <Unlink size={14} />
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-graphite-600">
              Todavía no hay nada. Pulsa "Sincronizar ahora" para traer tus tareas y anuncios.
            </p>
          ) : (
            <>
              {sinLeer > 0 && <p className="text-xs text-graphite-600 mb-2">{sinLeer} sin leer</p>}
              <div className="grid grid-cols-1 gap-2">
                {items.map((item) => {
                  const Icono = item.tipo === 'tarea' ? ClipboardList : Megaphone
                  return (
                    <div
                      key={item.id}
                      onClick={() => marcarLeido(item)}
                      className={`card p-3 flex gap-3 cursor-pointer transition-colors ${
                        item.leido ? '' : 'border-blueprint-400 bg-blueprint-100/30'
                      }`}
                    >
                      <Icono size={16} className="text-blueprint-500 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="tag bg-graphite-700/10 text-graphite-600">{item.curso_nombre}</span>
                          {!item.leido && <span className="w-2 h-2 rounded-full bg-signal-500 shrink-0" />}
                        </div>
                        <p className="text-sm font-medium">{item.titulo}</p>
                        <p className="text-xs text-graphite-600/70 font-mono mt-0.5">
                          {item.tipo === 'tarea' ? 'Tarea' : 'Anuncio'}
                          {item.fecha_entrega &&
                            ` · Entrega: ${format(parseISO(item.fecha_entrega), 'd MMM', { locale: es })}`}
                          {' · '}
                          {format(parseISO(item.publicado_at), 'd MMM, HH:mm', { locale: es })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
