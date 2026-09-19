import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Registro from './pages/Registro'
import Dashboard from './pages/Dashboard'
import Invitar from './pages/Invitar'
import Asignaturas from './pages/Asignaturas'
import Tareas from './pages/Tareas'
import Apuntes from './pages/Apuntes'
import Evaluaciones from './pages/Evaluaciones'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/invitar" element={<Invitar />} />
        <Route path="/asignaturas" element={<Asignaturas />} />
        <Route path="/tareas" element={<Tareas />} />
        <Route path="/apuntes" element={<Apuntes />} />
        <Route path="/evaluaciones" element={<Evaluaciones />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
