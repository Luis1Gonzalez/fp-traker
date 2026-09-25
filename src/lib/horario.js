import { parseISO, getDay } from 'date-fns'

// 1=lunes … 5=viernes; null si no hay fecha o cae en fin de semana.
export function diaSemanaDe(fechaISO) {
  if (!fechaISO) return null
  const dia = getDay(parseISO(fechaISO)) // 0=domingo … 6=sábado
  return dia >= 1 && dia <= 5 ? dia : null
}

// Hora de inicio ('HH:MM') de la primera clase de esa asignatura ese día de la
// semana, según el horario, o null si ese día no hay clase de esa asignatura.
export function horaSugerida(horario, asignaturaId, fechaISO) {
  const dia = diaSemanaDe(fechaISO)
  if (!dia || !asignaturaId) return null

  const clases = horario
    .filter((h) => h.asignatura_id === asignaturaId && h.dia_semana === dia)
    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))

  return clases[0]?.hora_inicio.slice(0, 5) ?? null
}
