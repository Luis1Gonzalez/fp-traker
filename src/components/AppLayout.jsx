import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  QrCode,
  LogOut,
  BookMarked,
  ListChecks,
  NotebookPen,
  GraduationCap,
  MoreHorizontal,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { AsignaturasProvider } from '../context/AsignaturasContext'

const linksPrincipales = [
  { to: '/', label: 'Panel', icon: LayoutDashboard, end: true },
  { to: '/tareas', label: 'Tareas', icon: ListChecks },
  { to: '/apuntes', label: 'Apuntes', icon: NotebookPen },
  { to: '/evaluaciones', label: 'Evals', icon: GraduationCap },
]

const linksSecundariosBase = [
  { to: '/asignaturas', label: 'Materias', icon: BookMarked },
  { to: '/invitar', label: 'Invitar', icon: QrCode, soloAdmin: true },
]

export default function AppLayout() {
  const { signOut, user, esAdmin } = useAuth()
  const [mostrarMas, setMostrarMas] = useState(false)
  const linksSecundarios = linksSecundariosBase.filter((l) => !l.soloAdmin || esAdmin)

  return (
    <AsignaturasProvider>
      <div className="flex min-h-screen">
        {/* Sidebar — solo desktop, con todo */}
        <aside className="hidden md:flex w-60 shrink-0 bg-graphite-900 text-paper flex-col h-screen sticky top-0">
          <div className="px-5 py-5 border-b border-white/10">
            <p className="font-display font-semibold text-lg leading-tight">FP Tracker</p>
            <p className="text-xs text-white/40 font-mono mt-0.5">FME304</p>
          </div>

          <nav className="flex-1 py-4 px-3 space-y-1">
            {[...linksPrincipales, ...linksSecundarios].map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive ? 'bg-blueprint-500 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon size={17} /> {label === 'Evals' ? 'Evaluaciones' : label}
              </NavLink>
            ))}
          </nav>

          <div className="px-3 py-4 border-t border-white/10">
            <p className="px-3 text-xs text-white/40 truncate mb-2">{user?.email}</p>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            >
              <LogOut size={16} /> Salir
            </button>
          </div>
        </aside>

        {/* Header — solo móvil */}
        <header className="md:hidden fixed top-0 inset-x-0 z-30 bg-graphite-900 text-paper flex items-center justify-between px-4 h-14 pt-[env(safe-area-inset-top,0px)]">
          <p className="font-display font-semibold text-base">FP Tracker</p>
        </header>

        <main className="flex-1 min-w-0 p-4 pt-[calc(3.5rem+env(safe-area-inset-top,0px)+1rem)] pb-24 md:p-8 md:pt-8 md:pb-8 max-w-5xl w-full">
          <Outlet />
        </main>

        {/* Barra inferior — solo móvil */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-graphite-900 border-t border-white/10 flex justify-around items-stretch pb-[env(safe-area-inset-bottom,0px)]">
          {linksPrincipales.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium ${
                  isActive ? 'text-signal-400' : 'text-white/60'
                }`
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
          <button
            onClick={() => setMostrarMas(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium text-white/60"
          >
            <MoreHorizontal size={20} />
            Más
          </button>
        </nav>

        {/* Panel "Más" — solo móvil */}
        {mostrarMas && (
          <div
            className="md:hidden fixed inset-0 bg-graphite-950/50 z-40 flex items-end"
            onClick={() => setMostrarMas(false)}
          >
            <div
              className="bg-white w-full rounded-t-lg p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium text-sm">Más</p>
                <button onClick={() => setMostrarMas(false)} className="text-graphite-600">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-1">
                {linksSecundarios.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMostrarMas(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-graphite-800 hover:bg-graphite-700/5"
                  >
                    <Icon size={18} /> {label}
                  </NavLink>
                ))}
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-danger hover:bg-danger/5"
                >
                  <LogOut size={18} /> Salir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AsignaturasProvider>
  )
}
