import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Pencil, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAsignaturas } from '../context/AsignaturasContext'
import { falla } from '../lib/notificar'

const DIAS = [
  { valor: 1, label: 'Lunes', corto: 'Lun' },
  { valor: 2, label: 'Martes', corto: 'Mar' },
  { valor: 3, label: 'Miércoles', corto: 'Mié' },
  { valor: 4, label: 'Jueves', corto: 'Jue' },
  { valor: 5, label: 'Viernes', corto: 'Vie' },
]

const FORM_VACIO = { asignatura_id: '', dia_semana: 1, hora_inicio: '', hora_fin: '', aula: '' }

function diaSemanaHoy() {
  const d = new Date().getDay() // 0=domingo … 6=sábado
  return d >= 1 && d <= 5 ? d : 1 // si es finde, mostramos lunes por defecto
}

function horaAhora() {
  return new Date().toTimeString().slice(0, 5)
}

export default function HorarioClases() {
  const { user } = useAuth()
  const { asignaturas, getAsignatura } = useAsignaturas()
  const [horario, setHorario] = useState([])
  const [diaSeleccionado, setDiaSeleccionado] = useState(diaSemanaHoy())
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)

  const fetchHorario = useCallback(async () => {
    const { data, error } = await supabase
      .from('horario')
      .select('*')
      .order('dia_semana', { ascending: true })
      .order('hora_inicio', { ascending: true })
    if (falla({ error }, 'No se pudo cargar el horario.')) return
    setHorario(data)
  }, [])

  useEffect(() => {
    fetchHorario()
  }, [fetchHorario])

  function abrirNueva() {
    setEditando(null)
    setForm({ ...FORM_VACIO, dia_semana: diaSeleccionado })
    setShowForm(true)
  }

  function abrirEditar(h) {
    setEditando(h)
    setForm({
      asignatura_id: h.asignatura_id,
      dia_semana: h.dia_semana,
      hora_inicio: h.hora_inicio,
      hora_fin: h.hora_fin,
      aula: h.aula || '',
    })
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.asignatura_id || !form.hora_inicio || !form.hora_fin) return

    const payload = {
      asignatura_id: form.asignatura_id,
      dia_semana: Number(form.dia_semana),
      hora_inicio: form.hora_inicio,
      hora_fin: form.hora_fin,
      aula: form.aula.trim() || null,
    }

    const resultado = editando
      ? await supabase.from('horario').update(payload).eq('id', editando.id)
      : await supabase.from('horario').insert({ ...payload, user_id: user.id })
    if (falla(resultado, 'No se pudo guardar la clase.')) return

    setShowForm(false)
    fetchHorario()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta clase del horario?')) return
    const resultado = await supabase.from('horario').delete().eq('id', id)
    if (falla(resultado, 'No se pudo eliminar la clase.')) return
    fetchHorario()
  }

  const clasesDelDia = horario.filter((h) => h.dia_semana === diaSeleccionado)
  const esHoy = diaSeleccionado === diaSemanaHoy()
  const ahora = horaAhora()

  function estadoClase(h) {
    if (!esHoy) return 'otro-dia'
    if (ahora >= h.hora_inicio && ahora < h.hora_fin) return 'actual'
    if (ahora < h.hora_inicio) return 'por-venir'
    return 'pasada'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-graphite-600 text-sm hidden sm:block">
          Tu horario semanal de clases, con la que toca ahora resaltada.
        </p>
        <button onClick={abrirNueva} className="btn-primary flex items-center gap-1.5 shrink-0 ml-auto">
          <Plus size={16} /> Añadir clase
        </button>
      </div>

      <div className="flex gap-1 mb-6 bg-graphite-700/5 p-1 rounded-md w-fit overflow-x-auto">
        {DIAS.map((d) => (
          <button
            key={d.valor}
            onClick={() => setDiaSeleccionado(d.valor)}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors whitespace-nowrap ${
              diaSeleccionado === d.valor ? 'bg-white shadow-sm' : 'text-graphite-600'
            }`}
          >
            {d.corto}
            {d.valor === diaSemanaHoy() && <span className="ml-1 text-signal-500">•</span>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {clasesDelDia.map((h) => {
          const asignatura = getAsignatura(h.asignatura_id)
          const estado = estadoClase(h)
          return (
            <div
              key={h.id}
              className={`card p-4 flex items-center justify-between gap-3 ${
                estado === 'actual' ? 'border-blueprint-500 bg-blueprint-100/40' : ''
              } ${estado === 'pasada' ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: asignatura?.color || '#2B4C6F' }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{asignatura?.nombre}</p>
                    {estado === 'actual' && (
                      <span className="tag bg-blueprint-500 text-white">Ahora</span>
                    )}
                  </div>
                  <p className="text-xs text-graphite-600 mt-0.5">
                    {h.hora_inicio.slice(0, 5)}–{h.hora_fin.slice(0, 5)}
                    {asignatura?.profesor && ` · ${asignatura.profesor}`}
                    {h.aula && ` · Aula ${h.aula}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => abrirEditar(h)} className="btn-secondary p-1.5">
                  <Pencil size={13} />
                </button>
                <button onClick={() => eliminar(h.id)} className="btn-danger">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
        })}
        {clasesDelDia.length === 0 && (
          <p className="text-sm text-graphite-600">No tienes clases cargadas para este día.</p>
        )}
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
              <h2 className="font-display font-semibold text-lg">{editando ? 'Editar clase' : 'Nueva clase'}</h2>
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

            <select
              value={form.dia_semana}
              onChange={(e) => setForm({ ...form, dia_semana: e.target.value })}
              className="input-field"
            >
              {DIAS.map((d) => (
                <option key={d.valor} value={d.valor}>
                  {d.label}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-graphite-600 mb-1 block">Hora inicio</label>
                <input
                  type="time"
                  value={form.hora_inicio}
                  onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-graphite-600 mb-1 block">Hora fin</label>
                <input
                  type="time"
                  value={form.hora_fin}
                  onChange={(e) => setForm({ ...form, hora_fin: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
            </div>

            <input
              value={form.aula}
              onChange={(e) => setForm({ ...form, aula: e.target.value })}
              placeholder="Aula (opcional)"
              className="input-field"
            />

            <button type="submit" className="btn-primary mt-1">
              {editando ? 'Guardar cambios' : 'Añadir clase'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
