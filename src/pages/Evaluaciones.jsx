import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Trash2, Pencil, X, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
  parseISO,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAsignaturas } from '../context/AsignaturasContext'
import { falla } from '../lib/notificar'
import { horaSugerida } from '../lib/horario'
import ElegirEvento from '../components/ElegirEvento'

const FORM_VACIO = { titulo: '', evaluado: '', asignatura_id: '', fecha: '', hora: '' }

function notaClases(nota) {
  if (nota === null || nota === undefined || nota === '') return 'bg-graphite-700/10 text-graphite-600'
  return Number(nota) >= 5 ? 'bg-ok/10 text-ok' : 'bg-danger/10 text-danger'
}

function fechaHora(ev) {
  return parseISO(`${ev.fecha}T${ev.hora || '00:00'}`)
}

function esPendiente(ev) {
  return fechaHora(ev) > new Date()
}

function semanasLunVie(mesActual) {
  const inicioMes = startOfMonth(mesActual)
  const finMes = endOfMonth(mesActual)
  let cursor = startOfWeek(inicioMes, { weekStartsOn: 1 })
  const semanas = []
  while (cursor <= finMes) {
    semanas.push([0, 1, 2, 3, 4].map((i) => addDays(cursor, i)))
    cursor = addDays(cursor, 7)
  }
  return semanas
}

export default function Evaluaciones() {
  const { user } = useAuth()
  const { asignaturas, getAsignatura } = useAsignaturas()
  const [evaluaciones, setEvaluaciones] = useState([])
  const [tab, setTab] = useState('calendario') // calendario | evaluadas
  const [mesActual, setMesActual] = useState(new Date())
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [elegirDia, setElegirDia] = useState(null) // { dia, evs } cuando hay que elegir
  const [horario, setHorario] = useState([])
  const ultimaSugerenciaRef = useRef(null) // para no pisar una hora que el usuario ya tocó a mano

  useEffect(() => {
    supabase
      .from('horario')
      .select('asignatura_id, dia_semana, hora_inicio')
      .then(({ data, error }) => {
        if (error) return console.error('No se pudo cargar el horario para sugerir la hora', error)
        setHorario(data)
      })
  }, [])

  // Si hay materia y fecha, sugiere la hora de esa clase ese día. Solo si el
  // usuario no ha escrito ya una hora distinta a mano.
  useEffect(() => {
    const sugerida = horaSugerida(horario, form.asignatura_id, form.fecha)
    if (sugerida && (form.hora === '' || form.hora === ultimaSugerenciaRef.current)) {
      setForm((f) => ({ ...f, hora: sugerida }))
    }
    ultimaSugerenciaRef.current = sugerida
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.asignatura_id, form.fecha, horario])

  const fetchEvaluaciones = useCallback(async () => {
    const { data, error } = await supabase.from('evaluaciones').select('*').order('fecha', { ascending: true })
    if (falla({ error }, 'No se pudieron cargar las evaluaciones.')) return
    setEvaluaciones(data)
  }, [])

  useEffect(() => {
    fetchEvaluaciones()
  }, [fetchEvaluaciones])

  function abrirNueva() {
    setEditando(null)
    setForm(FORM_VACIO)
    ultimaSugerenciaRef.current = null
    setShowForm(true)
  }

  // Una evaluación en el día: se abre directa. Varias: se elige primero.
  function abrirDia(dia, evs) {
    if (evs.length === 1) abrirEditar(evs[0])
    else if (evs.length > 1) setElegirDia({ dia, evs })
  }

  function abrirEditar(ev) {
    setEditando(ev)
    ultimaSugerenciaRef.current = null
    setForm({
      titulo: ev.titulo,
      evaluado: ev.evaluado || '',
      asignatura_id: ev.asignatura_id,
      fecha: ev.fecha,
      hora: ev.hora || '',
    })
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.titulo.trim() || !form.asignatura_id || !form.fecha || !form.hora) return

    const payload = {
      titulo: form.titulo.trim(),
      evaluado: form.evaluado.trim() || null,
      asignatura_id: form.asignatura_id,
      fecha: form.fecha,
      hora: form.hora,
    }

    const resultado = editando
      ? await supabase.from('evaluaciones').update(payload).eq('id', editando.id)
      : await supabase.from('evaluaciones').insert({ ...payload, user_id: user.id })
    if (falla(resultado, 'No se pudo guardar la evaluación.')) return

    setShowForm(false)
    fetchEvaluaciones()
  }

  async function actualizarNota(id, valor) {
    const nota = valor === '' ? null : Number(valor)
    const resultado = await supabase.from('evaluaciones').update({ nota }).eq('id', id)
    if (falla(resultado, 'No se pudo guardar la nota.')) {
      fetchEvaluaciones() // restaura el valor real en el campo
      return
    }
    fetchEvaluaciones()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta evaluación?')) return
    const resultado = await supabase.from('evaluaciones').delete().eq('id', id)
    if (falla(resultado, 'No se pudo eliminar la evaluación.')) return
    setShowForm(false) // cierra el modal si se borró desde ahí
    fetchEvaluaciones()
  }

  const pendientes = evaluaciones.filter(esPendiente)
  const evaluadas = evaluaciones.filter((ev) => !esPendiente(ev)).sort((a, b) => fechaHora(b) - fechaHora(a))

  const semanas = semanasLunVie(mesActual)
  const evaluacionesDelDia = (dia) => pendientes.filter((ev) => isSameDay(parseISO(ev.fecha), dia))

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Evaluaciones</h1>
          <p className="text-graphite-600 text-sm hidden sm:block">Exámenes, prácticas y proyectos.</p>
        </div>
        <button onClick={() => abrirNueva()} className="btn-primary flex items-center gap-1.5 shrink-0">
          <Plus size={16} /> Nueva
        </button>
      </div>

      <div className="flex gap-1 mb-6 bg-graphite-700/5 p-1 rounded-md w-fit">
        <button
          onClick={() => setTab('calendario')}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            tab === 'calendario' ? 'bg-white shadow-sm' : 'text-graphite-600'
          }`}
        >
          Calendario ({pendientes.length})
        </button>
        <button
          onClick={() => setTab('evaluadas')}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            tab === 'evaluadas' ? 'bg-white shadow-sm' : 'text-graphite-600'
          }`}
        >
          Evaluadas ({evaluadas.length})
        </button>
      </div>

      {tab === 'calendario' ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setMesActual((m) => subMonths(m, 1))} className="btn-secondary p-2">
              <ChevronLeft size={16} />
            </button>
            <p className="font-medium text-sm capitalize">{format(mesActual, 'MMMM yyyy', { locale: es })}</p>
            <button onClick={() => setMesActual((m) => addMonths(m, 1))} className="btn-secondary p-2">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex gap-1.5 mb-1.5 text-center">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map((d) => (
              <div key={d} className="flex-1 text-xs font-mono text-graphite-600/70 py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            {semanas.map((semana, i) => (
              <div key={i} className="flex gap-1.5">
                {semana.map((dia) => {
                  const evs = evaluacionesDelDia(dia)
                  const fueraDeMes = !isSameMonth(dia, mesActual)
                  const esHoy = isSameDay(dia, new Date())
                  return (
                    <div
                      key={dia.toISOString()}
                      onClick={() => abrirDia(dia, evs)}
                      className={`flex-1 min-w-0 min-h-[92px] rounded-md border p-1.5 bg-white ${
                        evs.length > 0 ? 'cursor-pointer hover:border-blueprint-400 transition-colors' : ''
                      } ${fueraDeMes ? 'opacity-35' : ''}`}
                    >
                      <span
                        className={`text-xs font-mono inline-flex items-center justify-center w-5 h-5 rounded-full ${
                          esHoy ? 'bg-blueprint-600 text-white' : 'text-graphite-600'
                        }`}
                      >
                        {format(dia, 'd')}
                      </span>
                      <div className="flex flex-col gap-1 mt-1">
                        {evs.map((ev) => {
                          const asignatura = getAsignatura(ev.asignatura_id)
                          return (
                            <div
                              key={ev.id}
                              className="text-[10px] leading-tight rounded px-1 py-0.5 truncate"
                              style={{
                                backgroundColor: `${asignatura?.color || '#2B4C6F'}18`,
                                color: asignatura?.color || '#2B4C6F',
                              }}
                              title={ev.titulo}
                            >
                              {ev.hora?.slice(0, 5) ? `${ev.hora.slice(0, 5)} · ` : ''}
                              {ev.titulo}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-xs text-graphite-600 border-b border-graphite-700/10">
                <th className="py-2 pr-3 font-medium">Materia</th>
                <th className="py-2 pr-3 font-medium">Evaluado</th>
                <th className="py-2 pr-3 font-medium">Fecha</th>
                <th className="py-2 pr-3 font-medium">Hora</th>
                <th className="py-2 pr-3 font-medium">Nota</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {evaluadas.map((ev) => {
                const asignatura = getAsignatura(ev.asignatura_id)
                return (
                  <tr key={ev.id} className="border-b border-graphite-700/5">
                    <td className="py-2 pr-3">
                      <span className="tag" style={{ backgroundColor: `${asignatura?.color}18`, color: asignatura?.color }}>
                        {asignatura?.nombre}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{ev.evaluado || ev.titulo}</td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {format(parseISO(ev.fecha), 'd MMM yyyy', { locale: es })}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{ev.hora?.slice(0, 5) || '—'}</td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        defaultValue={ev.nota ?? ''}
                        onBlur={(e) => actualizarNota(ev.id, e.target.value)}
                        placeholder="—"
                        className={`w-16 text-center rounded-md px-2 py-1 text-sm font-medium ${notaClases(ev.nota)}`}
                      />
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => abrirEditar(ev)} className="btn-secondary p-1.5">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => eliminar(ev.id)} className="btn-danger p-1.5">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {evaluadas.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-graphite-600 text-sm">
                    Todavía no hay evaluaciones pasadas. Se mueven aquí solas en cuanto pasa su fecha y hora.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {elegirDia && (
        <ElegirEvento
          titulo={format(elegirDia.dia, "EEEE d 'de' MMMM", { locale: es })}
          items={[...elegirDia.evs]
            .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''))
            .map((ev) => {
              const asignatura = getAsignatura(ev.asignatura_id)
              return {
                key: ev.id,
                value: ev,
                color: asignatura?.color || '#2B4C6F',
                titulo: ev.titulo,
                detalle: [ev.hora?.slice(0, 5), asignatura?.nombre].filter(Boolean).join(' · '),
              }
            })}
          onCerrar={() => setElegirDia(null)}
          onElegir={(ev) => {
            setElegirDia(null)
            abrirEditar(ev)
          }}
        />
      )}

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
                {editando ? 'Editar evaluación' : 'Nueva evaluación'}
              </h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-graphite-600">
                <X size={18} />
              </button>
            </div>

            <input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Título (ej: Examen parcial 1)"
              className="input-field"
              required
              autoFocus
            />
            <input
              value={form.evaluado}
              onChange={(e) => setForm({ ...form, evaluado: e.target.value })}
              placeholder="Qué se evaluó (ej: Unidad 3 — Torneado)"
              className="input-field"
            />
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
            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <label className="text-xs text-graphite-600 mb-1 block">Hora</label>
                <input
                  type="time"
                  value={form.hora}
                  onChange={(e) => setForm({ ...form, hora: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn-primary mt-1">
              {editando ? 'Guardar cambios' : 'Crear evaluación'}
            </button>
            {editando && (
              <button
                type="button"
                onClick={() => eliminar(editando.id)}
                className="btn-danger flex items-center justify-center gap-1.5"
              >
                <Trash2 size={15} /> Eliminar evaluación
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
