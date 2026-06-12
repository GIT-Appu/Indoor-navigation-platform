import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Compass, LayoutDashboard, LogOut } from 'lucide-react'

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (err) {
      console.error('Error signing out:', err)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Compass size={22} style={{ color: '#6366f1' }} />
          <span>Campus Navigator</span>
        </div>
        <nav>
          <NavLink to="/" end>
            <LayoutDashboard size={18} />
            Map Studio
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <span className="user-email">{user?.email}</span>
          <button onClick={handleSignOut} style={{ width: '100%', justifyContent: 'center' }}>
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
