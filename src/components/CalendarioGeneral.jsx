import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
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
import { falla } from '../lib/notificar'
import { useAsignaturas } from '../context/AsignaturasContext'
import ElegirEvento from './ElegirEvento'

const COLOR = {
  evaluacion: '#E8873A', // naranja
  tarea: '#2B4C6F', // azul
  apunte: '#94A3B8', // plateado
}

const ETIQUETA = { evaluacion: 'Evaluación', tarea: 'Tarea', apunte: 'Apunte' }

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

export default function Calendario() {
  const { getAsignatura } = useAsignaturas()
  const [mesActual, setMesActual] = useState(new Date())
  const [eventos, setEventos] = useState([])
  const [verEvento, setVerEvento] = useState(null)
  const [elegirDia, setElegirDia] = useState(null) // { dia, evs } cuando hay que elegir

  const fetchTodo = useCallback(async () => {
    const [evalRes, tareasRes, apuntesRes] = await Promise.all([
      supabase.from('evaluaciones').select('id, titulo, evaluado, fecha, hora, asignatura_id'),
      supabase.from('tareas').select('id, titulo, fecha_entrega, asignatura_id').not('fecha_entrega', 'is', null),
      supabase
        .from('apuntes')
        .select('id, titulo, fecha, hora, asignatura_id')
        .eq('calendarizado', true)
        .not('fecha', 'is', null),
    ])

    if ([evalRes, tareasRes, apuntesRes].some((r) => falla(r, 'No se pudo cargar el calendario.'))) return

    const combinados = [
      ...(evalRes.data || []).map((e) => ({ ...e, tipo: 'evaluacion' })),
      ...(tareasRes.data || []).map((t) => ({ ...t, tipo: 'tarea', fecha: t.fecha_entrega })),
      ...(apuntesRes.data || []).map((a) => ({ ...a, tipo: 'apunte' })),
    ]
    setEventos(combinados)
  }, [])

  useEffect(() => {
    fetchTodo()
  }, [fetchTodo])

  const semanas = semanasLunVie(mesActual)
  const eventosDelDia = (dia) => eventos.filter((ev) => isSameDay(parseISO(ev.fecha), dia))

  // Un evento en el día: se abre directo. Varios: se elige primero.
  function abrirDia(dia, evs) {
    if (evs.length === 1) setVerEvento(evs[0])
    else if (evs.length > 1) setElegirDia({ dia, evs })
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 text-xs">
        {Object.entries(ETIQUETA).map(([tipo, label]) => (
          <span key={tipo} className="flex items-center gap-1.5 text-graphite-600">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLOR[tipo] }} />
            {label}s
          </span>
        ))}
      </div>

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
              const evs = eventosDelDia(dia)
              const fueraDeMes = !isSameMonth(dia, mesActual)
              const esHoy = isSameDay(dia, new Date())
              return (
                <div
                  key={dia.toISOString()}
                  onClick={() => abrirDia(dia, evs)}
                  className={`flex-1 min-w-0 min-h-[96px] rounded-md border p-1.5 bg-white ${
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
                    {evs.map((ev) => (
                      <div
                        key={`${ev.tipo}-${ev.id}`}
                        className="text-[10px] leading-tight rounded px-1 py-0.5 truncate"
                        style={{ backgroundColor: `${COLOR[ev.tipo]}22`, color: COLOR[ev.tipo] }}
                        title={ev.titulo}
                      >
                        {ev.hora?.slice(0, 5) ? `${ev.hora.slice(0, 5)} · ` : ''}
                        {ev.titulo}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {elegirDia && (
        <ElegirEvento
          titulo={format(elegirDia.dia, "EEEE d 'de' MMMM", { locale: es })}
          items={[...elegirDia.evs]
            .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''))
            .map((ev) => ({
              key: `${ev.tipo}-${ev.id}`,
              value: ev,
              color: COLOR[ev.tipo],
              titulo: ev.titulo,
              detalle: [ETIQUETA[ev.tipo], ev.hora?.slice(0, 5), getAsignatura(ev.asignatura_id)?.nombre]
                .filter(Boolean)
                .join(' · '),
            }))}
          onCerrar={() => setElegirDia(null)}
          onElegir={(ev) => {
            setElegirDia(null)
            setVerEvento(ev)
          }}
        />
      )}

      {verEvento && (
        <div
          className="fixed inset-0 bg-graphite-950/50 flex items-end sm:items-center justify-center sm:p-6 z-50"
          onClick={() => setVerEvento(null)}
        >
          <div
            className="card p-6 w-full sm:max-w-sm rounded-b-none sm:rounded-b-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-2">
              <span
                className="tag"
                style={{ backgroundColor: `${COLOR[verEvento.tipo]}18`, color: COLOR[verEvento.tipo] }}
              >
                {ETIQUETA[verEvento.tipo]}
              </span>
              <button onClick={() => setVerEvento(null)} className="text-graphite-600">
                <X size={18} />
              </button>
            </div>
            <h2 className="font-display font-semibold text-lg mb-1">{verEvento.titulo}</h2>
            {getAsignatura(verEvento.asignatura_id) && (
              <p className="text-sm text-graphite-600 mb-1">{getAsignatura(verEvento.asignatura_id).nombre}</p>
            )}
            <p className="text-xs text-graphite-600 font-mono">
              {format(parseISO(verEvento.fecha), "d 'de' MMMM, yyyy", { locale: es })}
              {verEvento.hora && ` · ${verEvento.hora.slice(0, 5)}`}
            </p>
            <p className="text-xs text-graphite-600/70 mt-3">
              Para editarlo, ve a la sección de {ETIQUETA[verEvento.tipo]}s.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
