import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/', { replace: true })
      } else {
        // Try once more after a short delay (hash tokens may need a moment)
        setTimeout(async () => {
          const { data: { session: s2 } } = await supabase.auth.getSession()
          navigate(s2 ? '/' : '/login', { replace: true })
        }, 1000)
      }
    })
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1e1e1e]">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500" />
        <p className="text-gray-400 text-sm">Iniciando sesión…</p>
      </div>
    </div>
  )
}
