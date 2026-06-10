import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

// En modo demo, simular usuario admin
const DEMO_USER = { id: 'demo', email: 'demo@apexpro.pe' }
const DEMO_PROFILE = { id: 'demo', role: 'admin', email: 'demo@apexpro.pe', display_name: 'Admin Demo', avatar_url: null, worker_id: null }

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(IS_DEMO ? DEMO_USER : null)
  const [profile, setProfile] = useState(IS_DEMO ? DEMO_PROFILE : null)
  const [loading, setLoading] = useState(!IS_DEMO)

  const fetchProfile = useCallback(async (authUser) => {
    if (!authUser) { setProfile(null); return }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle()

      if (error) { console.warn('profile fetch error:', error.message); setProfile({ id: authUser.id, role: 'worker', email: authUser.email, display_name: authUser.email, avatar_url: null, worker_id: null }); return }

      if (!data) {
        // Crear perfil si no existe
        const newProfile = {
          id:           authUser.id,
          role:         'worker',
          email:        authUser.email,
          display_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email,
          avatar_url:   authUser.user_metadata?.avatar_url || null,
          worker_id:    null,
        }
        const { data: created } = await supabase.from('profiles').insert(newProfile).select().maybeSingle()
        setProfile(created || newProfile)
      } else {
        // Actualizar email/avatar si cambió (por Google)
        const updates = {}
        if (!data.email && authUser.email) updates.email = authUser.email
        if (!data.display_name) updates.display_name = authUser.user_metadata?.full_name || authUser.email
        if (!data.avatar_url && authUser.user_metadata?.avatar_url) updates.avatar_url = authUser.user_metadata.avatar_url
        if (Object.keys(updates).length > 0) {
          await supabase.from('profiles').update(updates).eq('id', authUser.id)
          setProfile({ ...data, ...updates })
        } else {
          setProfile(data)
        }
      }
    } catch (e) {
      console.error('fetchProfile error:', e)
      setProfile({ id: authUser.id, role: 'worker', email: authUser.email, display_name: authUser.email, avatar_url: null, worker_id: null })
    }
  }, [])

  useEffect(() => {
    if (IS_DEMO) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      fetchProfile(session?.user ?? null).finally(() => setLoading(false))
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      fetchProfile(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) throw error
  }

  const signInWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signUpWithEmail = async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: displayName } },
    })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const refreshProfile = () => fetchProfile(user)

  const isAdmin  = profile?.role === 'admin'
  const isWorker = profile?.role === 'worker'

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      isAdmin, isWorker, isDemo: IS_DEMO,
      signInWithGoogle, signInWithEmail, signUpWithEmail,
      signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
