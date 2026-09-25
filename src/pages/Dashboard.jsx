import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ListChecks, GraduationCap, NotebookPen } from 'lucide-react'
import { differenceInCalendarDays, format, parseISO, isPast } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { falla } from '../lib/notificar'
import { useAsignaturas } from '../context/AsignaturasContext'
import CalendarioGeneral from '../components/CalendarioGeneral'
import HorarioClases from '../components/HorarioClases'

const DIAS_AVISO = 3

const COLOR = {
  evaluacion: '#E8873A',
  tarea: '#2B4C6F',
  apunte: '#94A3B8',
}
const ETIQUETA = { evaluacion: 'Evaluación', tarea: 'Tarea', apunte: 'Apunte' }

export default function Dashboard() {
  const { getAsignatura } = useAsignaturas()
  const [tab, setTab] = useState('resumen') // resumen | calendario | horario
  const [stats, setStats] = useState({ tareasPendientes: 0, evaluacionesPendientes: 0, apuntesActivos: 0 })
  const [proximos, setProximos] = useState([])
  const [avisos, setAvisos] = useState([])

  const cargar = useCallback(async () => {
    const [tareasRes, evalRes, apuntesRes] = await Promise.all([
      supabase.from('tareas').select('id, titulo, fecha_entrega, asignatura_id, estado'),
      supabase.from('evaluaciones').select('id, titulo, fecha, asignatura_id'),
      supabase.from('apuntes').select('id, titulo, fecha, calendarizado, estado, asignatura_id'),
    ])

    if ([tareasRes, evalRes, apuntesRes].some((r) => falla(r, 'No se pudo cargar el resumen.'))) return

    const tareas = tareasRes.data || []
    const evaluaciones = evalRes.data || []
    const apuntes = apuntesRes.data || []

    const tareasPendientes = tareas.filter((t) => t.estado === 'pendiente')
    // Sin hora: pendiente si es hoy o futuro (pasa a evaluada al día siguiente).
    const evaluacionesPendientes = evaluaciones.filter((e) => e.fecha >= format(new Date(), 'yyyy-MM-dd'))
    const apuntesActivos = apuntes.filter((a) => a.estado === 'util')

    setStats({
      tareasPendientes: tareasPendientes.length,
      evaluacionesPendientes: evaluacionesPendientes.length,
      apuntesActivos: apuntesActivos.length,
    })

    // Todo lo que tiene fecha futura, combinado y ordenado
    const conFecha = [
      ...tareasPendientes
        .filter((t) => t.fecha_entrega)
        .map((t) => ({ ...t, tipo: 'tarea', fecha: t.fecha_entrega })),
      ...evaluacionesPendientes.map((e) => ({ ...e, tipo: 'evaluacion' })),
      ...apuntesActivos
        .filter((a) => a.calendarizado && a.fecha)
        .map((a) => ({ ...a, tipo: 'apunte' })),
    ]
      .filter((x) => !isPast(parseISO(x.fecha)) || format(new Date(), 'yyyy-MM-dd') === x.fecha)
      .sort((a, b) => a.fecha.localeCompare(b.fecha)) // 'YYYY-MM-DD' ordena bien como texto

    setProximos(conFecha.slice(0, 6))
    setAvisos(conFecha.filter((x) => differenceInCalendarDays(parseISO(x.fecha), new Date()) <= DIAS_AVISO))
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Panel</h1>
      <p className="text-graphite-600 text-sm mb-4">Resumen general del ciclo.</p>

      <div className="flex gap-1 mb-6 bg-graphite-700/5 p-1 rounded-md w-fit">
        <button
          onClick={() => setTab('resumen')}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            tab === 'resumen' ? 'bg-white shadow-sm' : 'text-graphite-600'
          }`}
        >
          Resumen
        </button>
        <button
          onClick={() => setTab('calendario')}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            tab === 'calendario' ? 'bg-white shadow-sm' : 'text-graphite-600'
          }`}
        >
          Calendario
        </button>
        <button
          onClick={() => setTab('horario')}
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            tab === 'horario' ? 'bg-white shadow-sm' : 'text-graphite-600'
          }`}
        >
          Horario
        </button>
      </div>

      {tab === 'calendario' ? (
        <CalendarioGeneral />
      ) : tab === 'horario' ? (
        <HorarioClases />
      ) : (
        <>
          {avisos.length > 0 && (
        <div className="card border-signal-500/30 bg-signal-100/60 p-4 mb-6">
          <div className="flex items-center gap-2 mb-2 text-signal-600">
            <AlertTriangle size={16} />
            <p className="font-medium text-sm">Se acerca la fecha</p>
          </div>
          <ul className="space-y-1.5">
            {avisos.map((item) => {
              const asignatura = getAsignatura(item.asignatura_id)
              const dias = differenceInCalendarDays(parseISO(item.fecha), new Date())
              const cuando = dias <= 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `En ${dias} días`
              return (
                <li key={`${item.tipo}-${item.id}`} className="text-sm flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs w-16 shrink-0" style={{ color: COLOR[item.tipo] }}>
                    {cuando}
                  </span>
                  <span className="text-graphite-900">{item.titulo}</span>
                  {asignatura && <span className="text-graphite-600 text-xs">— {asignatura.nombre}</span>}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Link to="/tareas" className="card p-4 hover:border-blueprint-400 transition-colors">
          <ListChecks size={16} className="text-blueprint-500 mb-2" />
          <p className="text-xs text-graphite-600 mb-1">Tareas pendientes</p>
          <p className="text-2xl font-display font-semibold text-blueprint-500">{stats.tareasPendientes}</p>
        </Link>
        <Link to="/evaluaciones" className="card p-4 hover:border-signal-400 transition-colors">
          <GraduationCap size={16} className="text-signal-500 mb-2" />
          <p className="text-xs text-graphite-600 mb-1">Evaluaciones por venir</p>
          <p className="text-2xl font-display font-semibold text-signal-500">{stats.evaluacionesPendientes}</p>
        </Link>
        <Link to="/apuntes" className="card p-4 hover:border-graphite-600/40 transition-colors">
          <NotebookPen size={16} className="text-graphite-600 mb-2" />
          <p className="text-xs text-graphite-600 mb-1">Apuntes activos</p>
          <p className="text-2xl font-display font-semibold text-graphite-800">{stats.apuntesActivos}</p>
        </Link>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="font-medium text-sm">Próximo en el calendario</p>
        <button onClick={() => setTab('calendario')} className="text-xs text-blueprint-600 hover:underline">
          Ver calendario
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {proximos.map((item) => {
          const asignatura = getAsignatura(item.asignatura_id)
          return (
            <div key={`${item.tipo}-${item.id}`} className="card p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLOR[item.tipo] }} />
                <p className="text-sm font-medium truncate">{item.titulo}</p>
                {asignatura && (
                  <span className="text-xs text-graphite-600 shrink-0 hidden sm:inline">— {asignatura.nombre}</span>
                )}
              </div>
              <span className="text-xs text-graphite-600/70 font-mono shrink-0">
                {format(parseISO(item.fecha), 'd MMM', { locale: es })}
              </span>
            </div>
          )
        })}
        {proximos.length === 0 && <p className="text-sm text-graphite-600">No tienes nada próximo. 🎉</p>}
      </div>
        </>
      )}
    </div>
  )
}
