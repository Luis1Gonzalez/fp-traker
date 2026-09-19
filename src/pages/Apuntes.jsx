import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Pencil, X, Check, CalendarClock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAsignaturas } from '../context/AsignaturasContext'
import { AsignaturaBadge } from '../components/Badges'
import { falla } from '../lib/notificar'

const FORM_VACIO = {
  titulo: '',
  contenido: '',
  asignatura_id: '',
  calendarizado: false,
  fecha: '',
  hora: '',
}

const COLORES_CALENDARIO = ['#2B4C6F', '#E8873A', '#4A7C59', '#B54747', '#6B5B95', '#3D6489', '#C2703D']
const colorRandom = () => COLORES_CALENDARIO[Math.floor(Math.random() * COLORES_CALENDARIO.length)]

export default function Apuntes() {
  const { user } = useAuth()
  const { asignaturas, getAsignatura } = useAsignaturas()
  const [apuntes, setApuntes] = useState([])
  const [tab, setTab] = useState('utiles') // utiles | inutiles
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [verApunte, setVerApunte] = useState(null)

  const fetchApuntes = useCallback(async () => {
    const { data, error } = await supabase
      .from('apuntes')
      .select('*')
      .order('fecha', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (falla({ error }, 'No se pudieron cargar los apuntes.')) return
    setApuntes(data)
  }, [])

  useEffect(() => {
    fetchApuntes()
  }, [fetchApuntes])

  function abrirNuevo() {
    setEditando(null)
    setForm(FORM_VACIO)
    setShowForm(true)
  }

  function abrirEditar(a) {
    setEditando(a)
    setForm({
      titulo: a.titulo,
      contenido: a.contenido || '',
      asignatura_id: a.asignatura_id || '',
      calendarizado: a.calendarizado,
      fecha: a.fecha || '',
      hora: a.hora || '',
    })
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.titulo.trim()) return
    if (form.calendarizado && !form.fecha) return

    const payload = {
      titulo: form.titulo.trim(),
      contenido: form.contenido.trim() || null,
      asignatura_id: form.asignatura_id || null,
      calendarizado: form.calendarizado,
      fecha: form.calendarizado ? form.fecha : null,
      hora: form.calendarizado && form.hora ? form.hora : null,
      color_calendario: form.calendarizado
        ? editando?.color_calendario || colorRandom()
        : null,
    }

    const resultado = editando
      ? await supabase.from('apuntes').update(payload).eq('id', editando.id)
      : await supabase.from('apuntes').insert({ ...payload, user_id: user.id, estado: 'util' })
    if (falla(resultado, 'No se pudo guardar el apunte.')) return

    setShowForm(false)
    fetchApuntes()
  }

  async function marcarInutil(id) {
    const resultado = await supabase.from('apuntes').update({ estado: 'inutil' }).eq('id', id)
    if (falla(resultado, 'No se pudo marcar el apunte como inútil.')) return
    fetchApuntes()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este apunte? No se puede deshacer.')) return
    const resultado = await supabase.from('apuntes').delete().eq('id', id)
    if (falla(resultado, 'No se pudo eliminar el apunte.')) return
    setVerApunte(null)
    fetchApuntes()
  }

  const utiles = apuntes.filter((a) => a.estado === 'util')
  const inutiles = apuntes.filter((a) => a.estado === 'inutil')
  const visibles = tab === 'utiles' ? utiles : inutiles

  const grupos = [
    ...asignaturas.map((a) => ({
      key: a.id,
      nombre: a.nombre,
      color: a.color,
      apuntes: visibles.filter((x) => x.asignatura_id === a.id),
    })),
    {
      key: 'sin-materia',
      nombre: 'Sin materia',
      color: '#4A5568',
      apuntes: visibles.filter((x) => !x.asignatura_id),
    },
  ]
    .filter((g) => g.apuntes.length > 0)
    .sort((a, b) => {
      const fA = a.apuntes[0]?.fecha
      const fB = b.apuntes[0]?.fecha
      if (!fA && !fB) return 0
      if (!fA) return 1
      if (!fB) return -1
      return fA.localeCompare(fB) // 'YYYY-MM-DD' ordena bien como texto
    })

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Apuntes</h1>
          <p className="text-graphite-600 text-sm hidden sm:block">
            Notas y recordatorios importantes, sean o no de una materia.
          </p>
        </div>
        <button onClick={abrirNuevo} className="btn-primary flex items-center gap-1.5 shrink-0">
          <Plus size={16} /> Nuevo
        </button>
      </div>

      <div className="flex gap-1 mb-6 bg-graphite-700/5 p-1 rounded-md w-fit">
        <button
          onClick={() => setTab('utiles')}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            tab === 'utiles' ? 'bg-white shadow-sm' : 'text-graphite-600'
          }`}
        >
          Activos ({utiles.length})
        </button>
        <button
          onClick={() => setTab('inutiles')}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            tab === 'inutiles' ? 'bg-white shadow-sm' : 'text-graphite-600'
          }`}
        >
          Listos ({inutiles.length})
        </button>
      </div>

      {grupos.length === 0 && (
        <p className="text-sm text-graphite-600">
          {tab === 'utiles' ? 'No tienes apuntes activos todavía.' : 'No hay apuntes marcados como listos.'}
        </p>
      )}

      <div className="space-y-6">
        {grupos.map((g) => (
          <div key={g.key}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
              <p className="text-sm font-medium">{g.nombre}</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {g.apuntes.map((a) => (
                <div
                  key={a.id}
                  onClick={() => setVerApunte(a)}
                  className="card p-4 cursor-pointer hover:border-blueprint-400 transition-colors"
                >
                  <p className="font-medium text-sm mb-1.5">{a.titulo}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-graphite-600/70 font-mono">
                    <span>Creado: {format(parseISO(a.created_at), 'd MMM', { locale: es })}</span>
                    {a.calendarizado && a.fecha && (
                      <span className="flex items-center gap-1" style={{ color: a.color_calendario }}>
                        <CalendarClock size={12} />
                        {format(parseISO(a.fecha), 'd MMM', { locale: es })}
                        {a.hora && ` · ${a.hora.slice(0, 5)}`}
                      </span>
                    )}
                  </div>

                  {tab === 'utiles' && (
                    <div className="flex items-center gap-1 mt-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => marcarInutil(a.id)}
                        className="btn-secondary flex items-center gap-1 py-1.5 px-2.5 text-xs flex-1 justify-center"
                      >
                        <Check size={13} /> Marcar listo
                      </button>
                      <button onClick={() => abrirEditar(a)} className="btn-secondary p-2">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => eliminar(a.id)} className="btn-danger">
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
              <h2 className="font-display font-semibold text-lg">{editando ? 'Editar apunte' : 'Nuevo apunte'}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-graphite-600">
                <X size={18} />
              </button>
            </div>

            <input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Título (ej: Reunión con Javi)"
              className="input-field"
              required
              autoFocus
            />
            <textarea
              value={form.contenido}
              onChange={(e) => setForm({ ...form, contenido: e.target.value })}
              placeholder="Escribe la nota…"
              className="input-field"
              rows={4}
            />
            <select
              value={form.asignatura_id}
              onChange={(e) => setForm({ ...form, asignatura_id: e.target.value })}
              className="input-field"
            >
              <option value="">Sin materia</option>
              {asignaturas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-sm text-graphite-800 cursor-pointer">
              <input
                type="checkbox"
                checked={form.calendarizado}
                onChange={(e) => setForm({ ...form, calendarizado: e.target.checked })}
                className="w-4 h-4 accent-blueprint-600"
              />
              Calendarizar (avisar en una fecha)
            </label>

            {form.calendarizado && (
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    if (e.clientX > rect.right - 30) return
                    try {
                      e.currentTarget.showPicker?.()
                    } catch {}
                  }}
                  className="input-field cursor-pointer"
                  required
                />
                <input
                  type="time"
                  value={form.hora}
                  onChange={(e) => setForm({ ...form, hora: e.target.value })}
                  className="input-field"
                />
              </div>
            )}

            <button type="submit" className="btn-primary mt-1">
              {editando ? 'Guardar cambios' : 'Crear apunte'}
            </button>
          </form>
        </div>
      )}

      {/* Modal ver */}
      {verApunte && (
        <div
          className="fixed inset-0 bg-graphite-950/50 flex items-end sm:items-center justify-center sm:p-6 z-50"
          onClick={() => setVerApunte(null)}
        >
          <div
            className="card p-6 w-full sm:max-w-md rounded-b-none sm:rounded-b-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                {verApunte.asignatura_id && (
                  <AsignaturaBadge
                    nombre={getAsignatura(verApunte.asignatura_id)?.nombre}
                    color={getAsignatura(verApunte.asignatura_id)?.color}
                  />
                )}
                <h2 className="font-display font-semibold text-lg mt-2">{verApunte.titulo}</h2>
              </div>
              <button onClick={() => setVerApunte(null)} className="text-graphite-600">
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-graphite-600 font-mono mb-3 space-y-0.5">
              <p>Creado: {format(parseISO(verApunte.created_at), "d 'de' MMMM, yyyy", { locale: es })}</p>
              {verApunte.calendarizado && verApunte.fecha && (
                <p style={{ color: verApunte.color_calendario }}>
                  Calendarizado: {format(parseISO(verApunte.fecha), "d 'de' MMMM, yyyy", { locale: es })}
                  {verApunte.hora && ` a las ${verApunte.hora.slice(0, 5)}`}
                </p>
              )}
            </div>

            {verApunte.contenido && (
              <p className="text-sm text-graphite-800 whitespace-pre-wrap">{verApunte.contenido}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
