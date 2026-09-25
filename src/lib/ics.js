// Genera un archivo .ics (formato estándar de calendario) para que el
// usuario lo añada a su Calendario nativo (iPhone/Android/escritorio), con
// una alarma que sí suena, porque pasa a ser un evento real de su calendario.
//
// Limitación de Apple, no nuestra: no hay ninguna forma de que una web (esto
// no es una app de la App Store) cree eventos en el Calendario del iPhone en
// segundo plano. El usuario tiene que tocar "Añadir al calendario" y
// confirmar en la ficha nativa que abre iOS.

// Hora local a la que suena el aviso, ya que las tareas/apuntes/evaluaciones
// solo tienen fecha (sin hora). Cámbiala aquí si quieres otro momento del día.
const HORA_AVISO = '08:00'
const DURACION_MIN = 30

const pad = (n) => String(n).padStart(2, '0')

// Escapado de texto según RFC 5545 (formato iCalendar).
function escaparTexto(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function marcaTiempoUTC() {
  const d = new Date()
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

// Sin Z ni TZID: es una "hora flotante" (RFC 5545), que cada calendario
// interpreta en su propia zona horaria local. Evita tener que convertir a UTC.
function formatoFlotante(d) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
}

// fechaISO: 'YYYY-MM-DD'. Construye el texto del archivo .ics: un evento de
// 30 min a las HORA_AVISO de ese día, con una alarma que suena justo entonces.
export function crearICS({ titulo, fechaISO, detalle }) {
  const [anio, mes, dia] = fechaISO.split('-').map(Number)
  const [h, m] = HORA_AVISO.split(':').map(Number)
  const inicio = new Date(anio, mes - 1, dia, h, m, 0)
  const fin = new Date(inicio.getTime() + DURACION_MIN * 60 * 1000)

  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FP Tracker//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@fp-traker`,
    `DTSTAMP:${marcaTiempoUTC()}`,
    `DTSTART:${formatoFlotante(inicio)}`,
    `DTEND:${formatoFlotante(fin)}`,
    `SUMMARY:${escaparTexto(titulo)}`,
    ...(detalle ? [`DESCRIPTION:${escaparTexto(detalle)}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Recordatorio',
    'TRIGGER:PT0S',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lineas.join('\r\n') + '\r\n'
}

// Dispara la descarga/apertura del evento. Sin el atributo `download`: en
// iOS Safari, navegar directo a un blob text/calendar abre la ficha nativa
// "Añadir evento" de Calendario; con `download`, iOS a veces lo guarda como
// archivo en Archivos en vez de ofrecer añadirlo al calendario.
export function descargarICS({ titulo, fechaISO, detalle }) {
  const contenido = crearICS({ titulo, fechaISO, detalle })
  const blob = new Blob([contenido], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
