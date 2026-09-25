import { parseISO, getDay } from 'date-fns'

// 1=lunes … 5=viernes; null si no hay fecha o cae en fin de semana.
export function diaSemanaDe(fechaISO) {
  if (!fechaISO) return null
  const dia = getDay(parseISO(fechaISO)) // 0=domingo … 6=sábado
  return dia >= 1 && dia <= 5 ? dia : null
}

const NOMBRE_DIA = { 1: 'lunes', 2: 'martes', 3: 'miércoles', 4: 'jueves', 5: 'viernes' }

// Días (1=lunes…5=viernes, ordenados) en que hay clase de esa asignatura según
// el horario. [] si la asignatura no tiene ninguna clase programada.
export function diasConClase(horario, asignaturaId) {
  return [...new Set(horario.filter((h) => h.asignatura_id === asignaturaId).map((h) => h.dia_semana))].sort(
    (a, b) => a - b,
  )
}

// Motivo por el que esa fecha no vale para esa asignatura, o null si vale (o
// si esa asignatura no tiene horario cargado: sin datos, no se puede negar).
export function errorFechaSinClase(horario, asignaturaId, fechaISO) {
  if (!asignaturaId || !fechaISO) return null

  const dias = diasConClase(horario, asignaturaId)
  if (dias.length === 0) return null

  const dia = diaSemanaDe(fechaISO)
  if (dia && dias.includes(dia)) return null

  return `Ese día no tienes clase de esta asignatura. Días con clase: ${dias.map((d) => NOMBRE_DIA[d]).join(', ')}.`
}
