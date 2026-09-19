import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { suscribir } from '../lib/notificar'

const DURACION_MS = 5000

export default function Toaster() {
  const [avisos, setAvisos] = useState([])

  useEffect(() => {
    return suscribir((aviso) => {
      setAvisos((prev) => [...prev, aviso])
      setTimeout(() => setAvisos((prev) => prev.filter((a) => a.id !== aviso.id)), DURACION_MS)
    })
  }, [])

  if (avisos.length === 0) return null

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-80 z-[100] grid gap-2">
      {avisos.map((a) => (
        <div
          key={a.id}
          role="alert"
          className={`flex items-start gap-2 rounded-md px-3 py-2.5 text-sm text-white shadow-lg ${
            a.tipo === 'error' ? 'bg-danger' : 'bg-ok'
          }`}
        >
          <p className="flex-1">{a.mensaje}</p>
          <button
            onClick={() => setAvisos((prev) => prev.filter((x) => x.id !== a.id))}
            className="shrink-0 opacity-80 hover:opacity-100"
            aria-label="Cerrar aviso"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  )
}
