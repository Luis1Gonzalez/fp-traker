import { useRegisterSW } from 'virtual:pwa-register/react'

// Aviso de "hay una versión nueva" (service worker nuevo esperando) y de
// "ya está lista para funcionar sin conexión" (primera instalación). No
// recarga nada sola: solo avisa, y el usuario decide cuándo.
export default function ActualizarPWA() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Comprueba cada hora si hay una versión nueva publicada.
      if (!registration) return
      setInterval(() => registration.update(), 60 * 60 * 1000)
    },
  })

  if (!needRefresh && !offlineReady) return null

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-80 z-[100]">
      <div className="card p-3 shadow-lg flex items-center justify-between gap-3">
        <p className="text-xs text-graphite-800 flex-1">
          {needRefresh
            ? 'Hay una versión nueva de la app.'
            : 'Lista para funcionar sin conexión.'}
        </p>
        {needRefresh ? (
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => updateServiceWorker(true)} className="btn-primary text-xs py-1.5 px-2.5">
              Actualizar
            </button>
            <button
              onClick={() => setNeedRefresh(false)}
              className="btn-secondary text-xs py-1.5 px-2.5"
            >
              Luego
            </button>
          </div>
        ) : (
          <button onClick={() => setOfflineReady(false)} className="text-graphite-600 text-xs shrink-0">
            Vale
          </button>
        )}
      </div>
    </div>
  )
}
