import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useTheme } from '../context/ThemeContext'
import { Sun, Moon, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const { user, profile, loading, deactivated, signInWithGoogle, signInWithEmail, signUpWithEmail, isDemo } = useAuth()
  const { dark, toggle } = useTheme()

  const [tab,         setTab]         = useState('login') // 'login' | 'signup'
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [busy,        setBusy]        = useState(false)

  if (isDemo || (user && profile)) return <Navigate to="/" replace />
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#1e1e1e]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
    </div>
  )
  if (deactivated) return (
    <div className="min-h-screen flex items-center justify-center bg-[#1e1e1e] px-4">
      <div className="bg-gray-900 rounded-2xl p-8 max-w-sm w-full text-center space-y-4">
        <div className="text-4xl">🚫</div>
        <h2 className="text-white font-bold text-lg">Cuenta desactivada</h2>
        <p className="text-gray-400 text-sm">Tu cuenta fue desactivada. Contacta al administrador.</p>
        <button className="text-sm text-red-400 hover:text-red-300 underline" onClick={async () => { await supabase.auth.signOut(); window.location.reload() }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )

  if (user && !profile) {
    // Registrar solicitud de acceso para que el admin la vea
    supabase.from('pending_requests').upsert({
      id: user.id,
      email: user.email,
      display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
    }, { onConflict: 'id' }).then(() => {})

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1e1e1e] px-4">
        <div className="bg-gray-900 rounded-2xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="text-4xl">⏳</div>
          <h2 className="text-white font-bold text-lg">Acceso pendiente</h2>
          <p className="text-gray-400 text-sm">Tu cuenta está registrada pero aún no tiene acceso. Contacta al administrador para que te active.</p>
          <p className="text-xs text-gray-600">{user.email}</p>
          <button className="text-sm text-red-400 hover:text-red-300 underline" onClick={async () => { await supabase.auth.signOut(); window.location.reload() }}>
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  async function handleGoogle() {
    setBusy(true)
    try { await signInWithGoogle() }
    catch (e) { toast.error('Error con Google: ' + e.message); setBusy(false) }
  }

  async function handleEmail(e) {
    e.preventDefault()
    setBusy(true)
    try {
      if (tab === 'login') {
        await signInWithEmail(email, password)
        toast.success('¡Bienvenido!')
      } else {
        await signUpWithEmail(email, password, displayName)
        toast.success('Cuenta creada. Un administrador te asignará acceso.')
      }
    } catch (err) {
      const msg = err.message?.includes('Invalid login') ? 'Correo o contraseña incorrectos'
        : err.message?.includes('already registered') ? 'Este correo ya está registrado'
        : err.message
      toast.error(msg)
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#1e1e1e]">
      {/* Theme toggle */}
      <div className="flex justify-end p-4">
        <button onClick={toggle} className="p-2 rounded-lg text-gray-400 hover:bg-white/10">
          {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-sm">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <img src="/logo.jpg" alt="Apex Pro" className="w-20 h-20 rounded-2xl object-cover shadow-lg mb-4" />
            <h1 className="text-white font-black text-2xl tracking-wide">APEX-PRO</h1>
            <p className="text-red-500 font-bold text-xs tracking-widest uppercase">Detailing</p>
            <p className="text-gray-500 text-sm mt-1">Panel de gestión</p>
          </div>

          {/* Card */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6">

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-6">
              {['login', 'signup'].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    tab === t
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                  {t === 'login' ? 'Iniciar sesión' : 'Registrarse'}
                </button>
              ))}
            </div>

            <form onSubmit={handleEmail} className="space-y-3">
              {tab === 'signup' && (
                <div>
                  <label className="label">Nombre completo</label>
                  <input className="input" type="text" placeholder="Tu nombre"
                    value={displayName} onChange={e => setDisplayName(e.target.value)} required />
                </div>
              )}
              <div>
                <label className="label">Correo electrónico</label>
                <input className="input" type="email" placeholder="correo@ejemplo.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="label">Contraseña</label>
                <div className="relative">
                  <input className="input pr-10" type={showPass ? 'text' : 'password'}
                    placeholder={tab === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'}
                    value={password} onChange={e => setPassword(e.target.value)}
                    minLength={6} required />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={busy}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all disabled:opacity-60 mt-1">
                {busy ? 'Cargando…' : tab === 'login' ? 'Entrar' : 'Crear cuenta'}
              </button>
            </form>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs text-gray-400">o</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            </div>

            <button onClick={handleGoogle} disabled={busy}
              className="w-full flex items-center justify-center gap-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-60 text-sm font-medium text-gray-700 dark:text-gray-300">
              <svg className="w-5 h-5" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.6-8 19.6-20 0-1.3-.1-2.7-.3-4h.3z"/>
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.4-5l-6.2-5.2C29.4 35.6 26.8 36.5 24 36.5c-5.2 0-9.7-3.5-11.3-8.3l-6.5 5C9.5 39.8 16.3 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.4-2.4 4.4-4.5 5.8l6.2 5.2C40.9 35.6 44 30.3 44 24c0-1.3-.1-2.7-.4-4z"/>
              </svg>
              Continuar con Google
            </button>

            {tab === 'signup' && (
              <p className="text-xs text-gray-400 text-center mt-4">
                Después de registrarte, un administrador te asignará el acceso correspondiente.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
