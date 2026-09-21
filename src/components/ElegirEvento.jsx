import { X } from 'lucide-react'

// Modal para elegir uno entre varios eventos de un mismo día.
// items: [{ key, value, color, titulo, detalle }]; onElegir recibe el `value` elegido.
export default function ElegirEvento({ titulo, items, onElegir, onCerrar }) {
  return (
    <div
      className="fixed inset-0 bg-graphite-950/50 flex items-end sm:items-center justify-center sm:p-6 z-50"
      onClick={onCerrar}
    >
      <div
        className="card p-6 w-full sm:max-w-sm rounded-b-none sm:rounded-b-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-display font-semibold text-lg first-letter:uppercase">{titulo}</h2>
          <button onClick={onCerrar} className="text-graphite-600" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-graphite-600 mb-3">Elige cuál quieres abrir.</p>

        <div className="grid grid-cols-1 gap-2">
          {items.map((it) => (
            <button
              key={it.key}
              onClick={() => onElegir(it.value)}
              className="card p-3 text-left flex items-center gap-3 hover:border-blueprint-400 transition-colors"
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: it.color }} />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{it.titulo}</p>
                {it.detalle && <p className="text-xs text-graphite-600 truncate">{it.detalle}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
