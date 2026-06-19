import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

// Check if credentials are set up or left as defaults
const isSupabaseConfigured = 
  import.meta.env.VITE_SUPABASE_URL && 
  !import.meta.env.VITE_SUPABASE_URL.includes('YOUR_PROJECT') &&
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  !import.meta.env.VITE_SUPABASE_ANON_KEY.includes('your-anon-key')

export const isMockMode = !isSupabaseConfigured

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // If not configured, set mock admin session immediately
    if (isMockMode) {
      setSession({
        user: { email: 'dev-admin@campusnavigator.local', id: 'dev-user-uuid' },
        access_token: 'mock-token'
      })
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        if (isMockMode) {
          // Automatically default to mock session for easier debugging
          setSession({
            user: { email: 'dev-admin@campusnavigator.local', id: 'dev-user-uuid' },
            access_token: 'mock-token'
          })
        } else {
          setSession(null)
        }
      } else {
        setSession(data.session)
      }
      setLoading(false)
    }).catch(err => {
      console.warn('Failed to connect to Supabase, falling back to offline mode:', err)
      if (isMockMode) {
        setSession({
          user: { email: 'dev-admin@campusnavigator.local', id: 'dev-user-uuid' },
          access_token: 'mock-token'
        })
      } else {
        setSession(null)
      }
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && isMockMode) {
        setSession({
          user: { email: 'dev-admin@campusnavigator.local', id: 'dev-user-uuid' },
          access_token: 'mock-token'
        })
      } else {
        setSession(session)
      }
      setLoading(false)
    })

    return () => {
      if (sub?.subscription) {
        sub.subscription.unsubscribe()
      }
    }
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signIn: async (email, password) => {
      if (isMockMode) {
        const mockSession = { user: { email, id: 'dev-user-uuid' }, access_token: 'mock-token' }
        setSession(mockSession)
        return { data: { session: mockSession }, error: null }
      }
      return supabase.auth.signInWithPassword({ email, password })
    },
    signUp: async (email, password) => {
      if (isMockMode) {
        const mockSession = { user: { email, id: 'dev-user-uuid' }, access_token: 'mock-token' }
        setSession(mockSession)
        return { data: { session: mockSession }, error: null }
      }
      return supabase.auth.signUp({ email, password })
    },
    signOut: async () => {
      if (isMockMode) {
        setSession(null)
        return { error: null }
      }
      const res = await supabase.auth.signOut()
      setSession(null)
      return res
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
export { isSupabaseConfigured }
