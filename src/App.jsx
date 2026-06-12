import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function ProtectedRoute({ children }) {
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        {/* Redirect all legacy subroutes to unified control center */}
        <Route path="campuses" element={<Navigate to="/" replace />} />
        <Route path="campuses/:campusId" element={<Navigate to="/" replace />} />
        <Route path="floors/:floorId" element={<Navigate to="/" replace />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
