import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Compass } from 'lucide-react'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const fn = mode === 'signin' ? signIn : signUp
    try {
      const { error: authErr } = await fn(email, password)
      if (authErr) {
        setError(authErr.message)
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err.message || 'An error occurred during authentication.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
          <Compass size={44} style={{ color: '#6366f1' }} />
        </div>
        <h1>Campus Navigator</h1>
        <p className="muted">Admin Dashboard Access</p>
        
        <input 
          type="email" 
          placeholder="Email Address" 
          value={email}
          onChange={(e) => setEmail(e.target.value)} 
          required 
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
        />
        
        {error && <div className="error">{error}</div>}
        
        <button type="submit" disabled={busy} className="primary" style={{ justifyContent: 'center', marginTop: '4px' }}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        
        <button 
          type="button" 
          className="link" 
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
          }}
          style={{ justifyContent: 'center', marginTop: '4px' }}
        >
          {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
