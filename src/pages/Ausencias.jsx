import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Trash2, Pencil, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAsignaturas } from '../context/AsignaturasContext'
import { falla, notificar } from '../lib/notificar'
import { errorFechaSinClase } from '../lib/horario'

const FORM_VACIO = { asignatura_id: '', fecha: '', justificada: false, motivo: '' }

export default function Ausencias() {
  const { user } = useAuth()
  const { asignaturas } = useAsignaturas()
  const [ausencias, setAusencias] = useState([])
  const [horario, setHorario] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  // Ref (no el estado) para que el bloqueo de doble guardado sea inmediato.
  const guardandoRef = useRef(false)

  useEffect(() => {
    supabase
      .from('horario')
      .select('asignatura_id, dia_semana')
      .then(({ data, error }) => {
        if (error) return console.error('No se pudo cargar el horario para validar la fecha', error)
        setHorario(data)
      })
  }, [])

  // La fecha debe caer en un día que le toque clase a esa asignatura. Si la
  // asignatura no tiene horario cargado, no hay con qué comprobar y se deja pasar.
  const fechaError = errorFechaSinClase(horario, form.asignatura_id, form.fecha)

  const fetchAusencias = useCallback(async () => {
    const { data, error } = await supabase
      .from('ausencias')
      .select('*')
      .order('fecha', { ascending: false })
    if (falla({ error }, 'No se pudieron cargar las ausencias.')) return
    setAusencias(data)
  }, [])

  useEffect(() => {
    fetchAusencias()
  }, [fetchAusencias])

  function abrirNueva() {
    setEditando(null)
    setForm(FORM_VACIO)
    setShowForm(true)
  }

  function abrirEditar(a) {
    setEditando(a)
    setForm({
      asignatura_id: a.asignatura_id,
      fecha: a.fecha,
      justificada: a.justificada,
      motivo: a.motivo || '',
    })
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (guardandoRef.current) return
    if (!form.asignatura_id || !form.fecha) return
    if (fechaError) {
      notificar(fechaError)
      return
    }
    guardandoRef.current = true
    setGuardando(true)

    const payload = {
      asignatura_id: form.asignatura_id,
      fecha: form.fecha,
      justificada: form.justificada,
      motivo: form.motivo.trim() || null,
    }

    const resultado = editando
      ? await supabase.from('ausencias').update(payload).eq('id', editando.id)
      : await supabase.from('ausencias').insert({ ...payload, user_id: user.id })

    guardandoRef.current = false
    setGuardando(false)
    if (falla(resultado, 'No se pudo guardar la ausencia.')) return

    setShowForm(false)
    fetchAusencias()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta ausencia?')) return
    const resultado = await supabase.from('ausencias').delete().eq('id', id)
    if (falla(resultado, 'No se pudo eliminar la ausencia.')) return
    fetchAusencias()
  }

  const resumen = asignaturas
    .map((a) => {
      const deEstaMateria = ausencias.filter((x) => x.asignatura_id === a.id)
      return {
        asignatura: a,
        total: deEstaMateria.length,
        justificadas: deEstaMateria.filter((x) => x.justificada).length,
      }
    })
    .filter((r) => r.total > 0)

  const grupos = asignaturas
    .map((a) => ({ asignatura: a, ausencias: ausencias.filter((x) => x.asignatura_id === a.id) }))
    .filter((g) => g.ausencias.length > 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Ausencias</h1>
          <p className="text-graphite-600 text-sm hidden sm:block">Qué clases has faltado, y si están justificadas.</p>
        </div>
        <button onClick={abrirNueva} className="btn-primary flex items-center gap-1.5 shrink-0">
          <Plus size={16} /> Nueva
        </button>
      </div>

      {resumen.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
          {resumen.map(({ asignatura, total, justificadas }) => (
            <div key={asignatura.id} className="card p-3 flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: asignatura.color }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{asignatura.nombre}</p>
                <p className="text-xs text-graphite-600/70 font-mono">
                  {total} {total === 1 ? 'ausencia' : 'ausencias'}
                  {justificadas > 0 && ` · ${justificadas} justificada${justificadas === 1 ? '' : 's'}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {grupos.length === 0 && (
        <p className="text-sm text-graphite-600">No tienes ninguna ausencia registrada. 🎉</p>
      )}

      <div className="space-y-6">
        {grupos.map(({ asignatura, ausencias: deEstaMateria }) => (
          <div key={asignatura.id}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: asignatura.color }} />
              <p className="text-sm font-medium">{asignatura.nombre}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {deEstaMateria.map((a) => (
                <div key={a.id} className="card p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium">
                      {format(parseISO(a.fecha), "d 'de' MMMM, yyyy", { locale: es })}
                    </p>
                    <span className={`tag shrink-0 ${a.justificada ? 'bg-ok/10 text-ok' : 'bg-danger/10 text-danger'}`}>
                      {a.justificada ? 'Justificada' : 'Sin justificar'}
                    </span>
                  </div>
                  {a.motivo && <p className="text-xs text-graphite-600 mb-2">{a.motivo}</p>}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => abrirEditar(a)}
                      className="btn-secondary flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 text-xs"
                    >
                      <Pencil size={13} /> Editar
                    </button>
                    <button onClick={() => eliminar(a.id)} className="btn-danger p-2">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

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
              <h2 className="font-display font-semibold text-lg">
                {editando ? 'Editar ausencia' : 'Nueva ausencia'}
              </h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-graphite-600">
                <X size={18} />
              </button>
            </div>

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
              <label className="text-xs text-graphite-600 mb-1 block">Fecha</label>
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
            </div>
            {fechaError && <p className="text-danger text-xs -mt-2">{fechaError}</p>}

            <label className="flex items-center gap-2 text-sm text-graphite-800 cursor-pointer">
              <input
                type="checkbox"
                checked={form.justificada}
                onChange={(e) => setForm({ ...form, justificada: e.target.checked })}
                className="w-4 h-4 accent-blueprint-600"
              />
              Justificada
            </label>

            <textarea
              value={form.motivo}
              onChange={(e) => setForm({ ...form, motivo: e.target.value })}
              placeholder="Motivo (opcional, ej: cita médica)"
              className="input-field"
              rows={2}
            />

            <button type="submit" disabled={guardando || !!fechaError} className="btn-primary mt-1">
              {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear ausencia'}
            </button>
            {editando && (
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  eliminar(editando.id)
                }}
                className="btn-danger flex items-center justify-center gap-1.5"
              >
                <Trash2 size={15} /> Eliminar ausencia
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
