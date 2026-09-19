export function AsignaturaBadge({ nombre, color }) {
  return (
    <span
      className="tag border"
      style={{ backgroundColor: `${color}18`, color, borderColor: `${color}40` }}
    >
      {nombre}
    </span>
  )
}
