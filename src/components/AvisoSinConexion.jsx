import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

// Franja fija arriba cuando el teléfono pierde la conexión. Los datos que se
// ven en ese momento son los últimos que se cargaron con éxito (quedaron
// guardados en la caché del "service worker"); guardar cosas nuevas sigue
// sin funcionar hasta que vuelva la conexión, como es lógico.
export default function AvisoSinConexion() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const marcarOnline = () => setOnline(true)
    const marcarOffline = () => setOnline(false)
    window.addEventListener('online', marcarOnline)
    window.addEventListener('offline', marcarOffline)
    return () => {
      window.removeEventListener('online', marcarOnline)
      window.removeEventListener('offline', marcarOffline)
    }
  }, [])

  if (online) return null

  return (
    <div className="fixed top-0 inset-x-0 z-[90] bg-signal-600 text-white text-xs font-medium flex items-center justify-center gap-1.5 py-1.5 pt-[calc(0.375rem+env(safe-area-inset-top,0px))]">
      <WifiOff size={13} /> Sin conexión · viendo lo último guardado
    </div>
  )
}
