import { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  Trash2,
  Pencil,
  MessageSquareText,
  Check,
  X,
  TriangleAlert,
  Camera,
  ImageOff,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAsignaturas } from '../context/AsignaturasContext'
import { AsignaturaBadge } from '../components/Badges'
import { falla, notificar } from '../lib/notificar'
import {
  BUCKET,
  borrarFotos,
  extensionDe,
  limpiarTareasTerminadas,
  validarFoto,
} from '../lib/fotos'
import { errorFechaSinClase } from '../lib/horario'

const FORM_VACIO = { titulo: '', descripcion: '', asignatura_id: '', fecha_entrega: '' }

function FotoTarea({ path, className, onClick }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let activo = true
    if (!path) return
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (activo && data) setUrl(data.signedUrl)
      })
    return () => {
      activo = false
    }
  }, [path])

  if (!path || !url) return null
  return <img src={url} onClick={onClick} className={className} alt="Foto de la tarea" />
}

export default function Tareas() {
  const { user } = useAuth()
  const { asignaturas, getAsignatura } = useAsignaturas()
  const [tareas, setTareas] = useState([])
  const [tab, setTab] = useState('pendientes')
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [fotoFile, setFotoFile] = useState(null)
  const [fotoActualPath, setFotoActualPath] = useState(null) // foto ya guardada al editar
  const [quitarFoto, setQuitarFoto] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [verTarea, setVerTarea] = useState(null)
  const [comentarioDraft, setComentarioDraft] = useState('')
  const [horario, setHorario] = useState([])

  useEffect(() => {
    supabase
      .from('horario')
      .select('asignatura_id, dia_semana')
      .then(({ data, error }) => {
        if (error) return console.error('No se pudo cargar el horario para validar la fecha', error)
        setHorario(data)
      })
  }, [])

  // Solo avisa si esa asignatura tiene horario cargado y ese día no le toca.
  // Si no hay horario para esa asignatura, no hay con qué comprobar y se deja pasar.
  const fechaError = errorFechaSinClase(horario, form.asignatura_id, form.fecha_entrega)

  const fetchTareas = useCallback(async () => {
    const { data, error } = await supabase
      .from('tareas')
      .select('*')
      .order('fecha_entrega', { ascending: true, nullsFirst: false })
    if (falla({ error }, 'No se pudieron cargar las tareas.')) return
    setTareas(data)
  }, [])

  useEffect(() => {
    limpiarTareasTerminadas().finally(fetchTareas)
  }, [fetchTareas])

  function abrirNueva() {
    setEditando(null)
    setForm(FORM_VACIO)
    setFotoFile(null)
    setFotoActualPath(null)
    setQuitarFoto(false)
    setShowForm(true)
  }

  function abrirEditar(t) {
    setEditando(t)
    setForm({
      titulo: t.titulo,
      descripcion: t.descripcion || '',
      asignatura_id: t.asignatura_id,
      fecha_entrega: t.fecha_entrega || '',
    })
    setFotoFile(null)
    setFotoActualPath(t.foto_path)
    setQuitarFoto(false)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.titulo.trim() || !form.asignatura_id) return
    if (fechaError) {
      notificar(fechaError)
      return
    }
    setSubiendo(true)

    const fotoAnterior = editando?.foto_path || null
    let foto_path = quitarFoto ? null : fotoAnterior
    let fotoSubida = null

    if (fotoFile) {
      const path = `${user.id}/${crypto.randomUUID()}.${extensionDe(fotoFile)}`
      const subida = await supabase.storage.from(BUCKET).upload(path, fotoFile)
      if (falla(subida, 'No se pudo subir la foto. La tarea no se guardó.')) {
        setSubiendo(false)
        return
      }
      foto_path = path
      fotoSubida = path
    }

    const payload = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      asignatura_id: form.asignatura_id,
      fecha_entrega: form.fecha_entrega || null,
      foto_path,
    }

    const resultado = editando
      ? await supabase.from('tareas').update(payload).eq('id', editando.id)
      : await supabase.from('tareas').insert({ ...payload, user_id: user.id, estado: 'pendiente' })

    if (falla(resultado, 'No se pudo guardar la tarea.')) {
      await borrarFotos([fotoSubida]) // la foto recién subida quedaría huérfana
      setSubiendo(false)
      return
    }

    if (foto_path !== fotoAnterior) await borrarFotos([fotoAnterior])

    setSubiendo(false)
    setShowForm(false)
    fetchTareas()
  }

  async function terminar(id) {
    const resultado = await supabase
      .from('tareas')
      .update({ estado: 'terminada', terminada_at: new Date().toISOString() })
      .eq('id', id)
    if (falla(resultado, 'No se pudo terminar la tarea.')) return
    fetchTareas()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta tarea? No se puede deshacer.')) return
    const fotoPath = tareas.find((t) => t.id === id)?.foto_path
    const resultado = await supabase.from('tareas').delete().eq('id', id)
    if (falla(resultado, 'No se pudo eliminar la tarea.')) return
    await borrarFotos([fotoPath])
    setVerTarea(null)
    fetchTareas()
  }

  function abrirVer(t) {
    setVerTarea(t)
    setComentarioDraft(t.comentario || '')
  }

  async function guardarComentario() {
    const resultado = await supabase
      .from('tareas')
      .update({ comentario: comentarioDraft.trim() || null })
      .eq('id', verTarea.id)
    if (falla(resultado, 'No se pudo guardar el comentario.')) return
    setVerTarea(null)
    fetchTareas()
  }

  const pendientes = tareas.filter((t) => t.estado === 'pendiente')
  const terminadas = tareas.filter((t) => t.estado === 'terminada')
  const visibles = tab === 'pendientes' ? pendientes : terminadas

  const porMateria = asignaturas
    .map((a) => ({ asignatura: a, tareas: visibles.filter((t) => t.asignatura_id === a.id) }))
    .filter((grupo) => grupo.tareas.length > 0)
    .sort((a, b) => {
      const fechaA = a.tareas[0]?.fecha_entrega
      const fechaB = b.tareas[0]?.fecha_entrega
      if (!fechaA && !fechaB) return 0
      if (!fechaA) return 1
      if (!fechaB) return -1
      return fechaA.localeCompare(fechaB) // 'YYYY-MM-DD' ordena bien como texto
    })

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Tareas</h1>
          <p className="text-graphite-600 text-sm hidden sm:block">Lo que te van mandando en clase.</p>
        </div>
        <button onClick={abrirNueva} className="btn-primary flex items-center gap-1.5 shrink-0">
          <Plus size={16} /> Nueva
        </button>
      </div>

      <div className="flex gap-1 mb-6 bg-graphite-700/5 p-1 rounded-md w-fit">
        <button
          onClick={() => setTab('pendientes')}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            tab === 'pendientes' ? 'bg-white shadow-sm' : 'text-graphite-600'
          }`}
        >
          Pendientes ({pendientes.length})
        </button>
        <button
          onClick={() => setTab('terminadas')}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            tab === 'terminadas' ? 'bg-white shadow-sm' : 'text-graphite-600'
          }`}
        >
          Terminadas ({terminadas.length})
        </button>
      </div>

      {porMateria.length === 0 && (
        <p className="text-sm text-graphite-600">
          {tab === 'pendientes' ? 'No tienes tareas pendientes. 🎉' : 'Todavía no hay tareas terminadas.'}
        </p>
      )}

      <div className="space-y-6">
        {porMateria.map(({ asignatura, tareas: tareasDeMateria }) => (
          <div key={asignatura.id}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: asignatura.color }} />
              <p className="text-sm font-medium">{asignatura.nombre}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tareasDeMateria.map((t) => (
                <div
                  key={t.id}
                  onClick={() => abrirVer(t)}
                  className="card p-4 cursor-pointer hover:border-blueprint-400 transition-colors"
                >
                  <div className="flex gap-3">
                    {t.foto_path && (
                      <FotoTarea path={t.foto_path} className="w-14 h-14 rounded-md object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="font-medium text-sm">{t.titulo}</p>
                        {t.comentario && <TriangleAlert size={15} className="text-signal-500 shrink-0" />}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 text-xs text-graphite-600/70 font-mono">
                        <span>Creada: {format(parseISO(t.created_at), 'd MMM', { locale: es })}</span>
                        {t.fecha_entrega && (
                          <span>Entrega: {format(parseISO(t.fecha_entrega), 'd MMM', { locale: es })}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {tab === 'pendientes' && (
                    <div className="flex items-center gap-1 mt-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => terminar(t.id)}
                        className="btn-secondary flex items-center gap-1 py-1.5 px-2.5 text-xs flex-1 justify-center"
                      >
                        <Check size={13} /> Terminar
                      </button>
                      <button onClick={() => abrirEditar(t)} className="btn-secondary p-2">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => abrirVer(t)} className="btn-secondary p-2">
                        <MessageSquareText size={14} />
                      </button>
                      <button onClick={() => eliminar(t.id)} className="btn-danger p-2">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal crear/editar */}
      {showForm && (
        <div
          className="fixed inset-0 bg-graphite-950/50 flex items-end sm:items-center justify-center sm:p-6 z-50"
          onClick={() => setShowForm(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="card p-6 w-full sm:max-w-md grid gap-3 rounded-b-none sm:rounded-b-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display font-semibold text-lg">{editando ? 'Editar tarea' : 'Nueva tarea'}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-graphite-600">
                <X size={18} />
              </button>
            </div>

            <input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Título de la tarea"
              className="input-field"
              required
              autoFocus
            />
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Descripción (opcional)"
              className="input-field"
              rows={3}
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={form.asignatura_id}
                onChange={(e) => setForm({ ...form, asignatura_id: e.target.value })}
                className="input-field"
                required
              >
                <option value="">Asignatura…</option>
                {asignaturas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
              <div>
                <label className="text-xs text-graphite-600 mb-1 block">Entrega (opcional)</label>
                <input
                  type="date"
                  value={form.fecha_entrega}
                  onChange={(e) => setForm({ ...form, fecha_entrega: e.target.value })}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const enZonaDelIconoNativo = e.clientX > rect.right - 30
                    if (enZonaDelIconoNativo) return // el navegador ya lo abre solo ahí
                    try {
                      e.currentTarget.showPicker?.()
                    } catch {
                      // Algunos navegadores bloquean showPicker en ciertos contextos.
                    }
                  }}
                  className="input-field cursor-pointer"
                />
              </div>
            </div>
            {fechaError && <p className="text-danger text-xs -mt-2">{fechaError}</p>}

            {/* Foto */}
            <div>
              <p className="text-xs text-graphite-600 mb-1.5">Foto (opcional)</p>

              {fotoActualPath && !quitarFoto && !fotoFile && (
                <div className="flex items-center gap-2 mb-2">
                  <FotoTarea path={fotoActualPath} className="w-16 h-16 rounded-md object-cover" />
                  <button
                    type="button"
                    onClick={() => setQuitarFoto(true)}
                    className="btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1"
                  >
                    <ImageOff size={13} /> Quitar
                  </button>
                </div>
              )}

              {fotoFile && (
                <p className="text-xs text-ok mb-2">Nueva foto lista: {fotoFile.name}</p>
              )}

              <label className="btn-secondary flex items-center justify-center gap-2 cursor-pointer text-sm">
                <Camera size={16} />
                {fotoActualPath || fotoFile ? 'Cambiar foto' : 'Adjuntar foto'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const archivo = e.target.files?.[0] || null
                    e.target.value = '' // permite volver a elegir el mismo archivo
                    if (!archivo) return
                    const problema = validarFoto(archivo)
                    if (problema) {
                      notificar(problema)
                      return
                    }
                    setFotoFile(archivo)
                    setQuitarFoto(false)
                  }}
                />
              </label>
            </div>

            <button type="submit" disabled={subiendo || !!fechaError} className="btn-primary mt-1">
              {subiendo ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear tarea'}
            </button>
          </form>
        </div>
      )}

      {/* Modal ver detalle + comentario */}
      {verTarea && (
        <div
          className="fixed inset-0 bg-graphite-950/50 flex items-end sm:items-center justify-center sm:p-6 z-50"
          onClick={() => setVerTarea(null)}
        >
          <div
            className="card p-6 w-full sm:max-w-md rounded-b-none sm:rounded-b-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <AsignaturaBadge
                  nombre={getAsignatura(verTarea.asignatura_id)?.nombre}
                  color={getAsignatura(verTarea.asignatura_id)?.color}
                />
                <h2 className="font-display font-semibold text-lg mt-2">{verTarea.titulo}</h2>
              </div>
              <button onClick={() => setVerTarea(null)} className="text-graphite-600">
                <X size={18} />
              </button>
            </div>

            {verTarea.foto_path && (
              <FotoTarea path={verTarea.foto_path} className="w-full rounded-md object-cover mb-3 max-h-64" />
            )}

            <div className="text-xs text-graphite-600 font-mono mb-3 space-y-0.5">
              <p>Creada: {format(parseISO(verTarea.created_at), "d 'de' MMMM, yyyy", { locale: es })}</p>
              {verTarea.fecha_entrega && (
                <p>Entrega: {format(parseISO(verTarea.fecha_entrega), "d 'de' MMMM, yyyy", { locale: es })}</p>
              )}
            </div>

            {verTarea.descripcion && (
              <p className="text-sm text-graphite-800 mb-4 whitespace-pre-wrap">{verTarea.descripcion}</p>
            )}

            <div>
              <p className="text-xs text-graphite-600 mb-1.5 flex items-center gap-1">
                <MessageSquareText size={13} /> Comentario
              </p>
              {verTarea.estado === 'pendiente' ? (
                <>
                  <textarea
                    value={comentarioDraft}
                    onChange={(e) => setComentarioDraft(e.target.value)}
                    placeholder="Deja una nota importante sobre esta tarea…"
                    className="input-field"
                    rows={3}
                  />
                  <button onClick={guardarComentario} className="btn-primary mt-2 w-full">
                    Guardar comentario
                  </button>
                </>
              ) : (
                <p className="text-sm text-graphite-700">{verTarea.comentario || 'Sin comentario.'}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
