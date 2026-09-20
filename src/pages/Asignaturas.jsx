import { useState } from 'react'
import { Plus, Trash2, Pencil, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAsignaturas } from '../context/AsignaturasContext'
import { falla } from '../lib/notificar'
import { borrarFotos } from '../lib/fotos'

const COLORES = ['#2B4C6F', '#E8873A', '#4A7C59', '#B54747', '#6B5B95', '#3D6489', '#C2703D', '#5A7684']

export default function Asignaturas() {
  const { user } = useAuth()
  const { asignaturas, refetch } = useAsignaturas()
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null) // asignatura completa o null
  const [nombre, setNombre] = useState('')
  const [profesor, setProfesor] = useState('')
  const [color, setColor] = useState(COLORES[0])
  const [saving, setSaving] = useState(false)

  function abrirNueva() {
    setEditando(null)
    setNombre('')
    setProfesor('')
    setColor(COLORES[asignaturas.length % COLORES.length])
    setShowForm(true)
  }

  function abrirEditar(a) {
    setEditando(a)
    setNombre(a.nombre)
    setProfesor(a.profesor || '')
    setColor(a.color)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    setSaving(true)

    const resultado = editando
      ? await supabase
          .from('asignaturas')
          .update({ nombre: nombre.trim(), profesor: profesor.trim() || null, color })
          .eq('id', editando.id)
      : await supabase.from('asignaturas').insert({
          user_id: user.id,
          nombre: nombre.trim(),
          profesor: profesor.trim() || null,
          color,
        })

    setSaving(false)
    if (falla(resultado, 'No se pudo guardar la asignatura.')) return
    setShowForm(false)
    refetch()
  }

  async function handleDelete(id) {
    if (
      !confirm('¿Eliminar esta asignatura? Se perderán también sus tareas, apuntes y evaluaciones.')
    )
      return
    // Las tareas se borran en cascada; sus fotos hay que recogerlas antes.
    const { data: conFoto } = await supabase
      .from('tareas')
      .select('foto_path')
      .eq('asignatura_id', id)
      .not('foto_path', 'is', null)

    const resultado = await supabase.from('asignaturas').delete().eq('id', id)
    if (falla(resultado, 'No se pudo eliminar la asignatura.')) return
    await borrarFotos((conFoto || []).map((t) => t.foto_path))
    refetch()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Asignaturas</h1>
          <p className="text-graphite-600 text-sm">Módulos del ciclo. Todo lo demás cuelga de aquí.</p>
        </div>
        <button onClick={abrirNueva} className="btn-primary flex items-center gap-1.5">
          <Plus size={16} /> Nueva asignatura
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {asignaturas.map((a) => (
          <div key={a.id} className="card p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
              <div>
                <p className="font-medium text-sm">{a.nombre}</p>
                {a.profesor && <p className="text-xs text-graphite-600">{a.profesor}</p>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => abrirEditar(a)} className="btn-secondary p-2">
                <Pencil size={14} />
              </button>
              <button onClick={() => handleDelete(a.id)} className="btn-danger">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {asignaturas.length === 0 && (
          <p className="text-sm text-graphite-600">Todavía no has creado ninguna asignatura.</p>
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
            className="card p-6 w-full sm:max-w-sm grid gap-3 rounded-b-none sm:rounded-b-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display font-semibold text-lg">
                {editando ? 'Editar asignatura' : 'Nueva asignatura'}
              </h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-graphite-600">
                <X size={18} />
              </button>
            </div>

            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre de la asignatura"
              className="input-field"
              required
              autoFocus
            />
            <input
              value={profesor}
              onChange={(e) => setProfesor(e.target.value)}
              placeholder="Profesor (opcional)"
              className="input-field"
            />
            <div>
              <p className="text-xs text-graphite-600 mb-1.5">Color</p>
              <div className="flex gap-1.5 flex-wrap">
                {COLORES.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border-2 ${color === c ? 'border-graphite-900' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary mt-1">
              {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear asignatura'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
