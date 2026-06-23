import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const AuthContext = createContext(null)

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

const DEMO_USER = { id: 'demo', email: 'demo@apexpro.pe' }
const DEMO_PROFILE = { id: 'demo', role: 'admin', email: 'demo@apexpro.pe', display_name: 'Admin Demo', avatar_url: null, worker_id: null }

// ── Caché de perfil en localStorage (5 min TTL) ──────────────────────────────
const PROFILE_CACHE_KEY = 'apexpro_profile_v1'
const PROFILE_CACHE_TTL = 5 * 60 * 1000

function getCachedProfile(userId) {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const { data, ts, id } = JSON.parse(raw)
    if (id !== userId || Date.now() - ts > PROFILE_CACHE_TTL) return null
    return data
  } catch { return null }
}

function setCachedProfile(userId, data) {
  try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ data, ts: Date.now(), id: userId })) } catch {}
}

function clearProfileCache() {
  try { localStorage.removeItem(PROFILE_CACHE_KEY) } catch {}
}

// ── Sesión única por dispositivo ─────────────────────────────────────────────
const SESSION_TOKEN_KEY = 'apexpro_session_token'

function getLocalSessionToken() {
  try { return localStorage.getItem(SESSION_TOKEN_KEY) } catch { return null }
}

function setLocalSessionToken(token) {
  try { localStorage.setItem(SESSION_TOKEN_KEY, token) } catch {}
}

export function AuthProvider({ children }) {
  const [user,           setUser]           = useState(IS_DEMO ? DEMO_USER : null)
  const [profile,        setProfile]        = useState(IS_DEMO ? DEMO_PROFILE : null)
  const [loading,        setLoading]        = useState(!IS_DEMO)
  const [profileLoading, setProfileLoading] = useState(false)
  const [deactivated,    setDeactivated]    = useState(false)

  const fetchProfile = useCallback(async (authUser, { background = false } = {}) => {
    if (!authUser) { setProfile(null); setDeactivated(false); setProfileLoading(false); clearProfileCache(); return }

    // Mostrar caché inmediatamente (si existe) mientras se verifica en background
    if (!background) {
      const cached = getCachedProfile(authUser.id)
      if (cached) {
        setProfile(cached)
        setDeactivated(false)
        setProfileLoading(false)
        // Verificar en background sin bloquear la UI
        fetchProfile(authUser, { background: true })
        return
      }
    }

    if (!background) setProfileLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle()

      if (error) { console.warn('profile fetch error:', error.message); if (!background) { setProfile(null); setDeactivated(false) }; setProfileLoading(false); return }

      if (!data) {
        setProfile(null); setDeactivated(false); clearProfileCache()
      } else if (data.active === false) {
        setProfile(null); setDeactivated(true); clearProfileCache()
      } else {
        setDeactivated(false)
        const updates = {}
        if (!data.email && authUser.email) updates.email = authUser.email
        if (!data.display_name) updates.display_name = authUser.user_metadata?.full_name || authUser.email
        if (!data.avatar_url && authUser.user_metadata?.avatar_url) updates.avatar_url = authUser.user_metadata.avatar_url
        if (Object.keys(updates).length > 0) {
          await supabase.from('profiles').update(updates).eq('id', authUser.id)
          const merged = { ...data, ...updates }
          setProfile(merged)
          setCachedProfile(authUser.id, merged)
        } else {
          setProfile(data)
          setCachedProfile(authUser.id, data)
        }
      }
    } catch (e) {
      console.error('fetchProfile error:', e)
      if (!background) { setProfile(null); setDeactivated(false) }
    } finally {
      setProfileLoading(false)
    }
  }, [])

  // Reclama este dispositivo como la sesión activa (lo escribe en el perfil en la BD)
  const claimSession = useCallback(async (userId, token) => {
    try { await supabase.from('profiles').update({ session_token: token }).eq('id', userId) } catch {}
  }, [])

  useEffect(() => {
    if (IS_DEMO) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        setUser(session?.user ?? null)
        fetchProfile(session?.user ?? null).finally(() => setLoading(false))
        // Si este dispositivo nunca reclamó una sesión (instalación previa al feature), la reclama ahora.
        if (session?.user && !getLocalSessionToken()) {
          const token = (crypto.randomUUID ? crypto.randomUUID() : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)))
          setLocalSessionToken(token)
          claimSession(session.user.id, token)
        }
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setUser(session?.user ?? null)
        fetchProfile(session?.user ?? null)
      }
      if (event === 'SIGNED_IN' && session?.user) {
        // Inicio de sesión real (no un refresh) — este dispositivo pasa a ser la única sesión activa.
        const token = (crypto.randomUUID ? crypto.randomUUID() : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)))
        setLocalSessionToken(token)
        claimSession(session.user.id, token)
      }
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        clearProfileCache()
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile, claimSession])

  // Escucha en tiempo real si otro dispositivo reclama la sesión y cierra esta automáticamente.
  useEffect(() => {
    if (IS_DEMO || !user?.id) return
    const channel = supabase
      .channel(`session-guard-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, ({ new: row }) => {
        const localToken = getLocalSessionToken()
        if (row.session_token && localToken && row.session_token !== localToken) {
          toast.error('Tu sesión se cerró porque iniciaste sesión en otro dispositivo')
          supabase.auth.signOut()
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user?.id])

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
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
    // No se crea perfil automáticamente — el admin lo aprueba desde Usuarios
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
      user, profile, loading, profileLoading, deactivated,
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
