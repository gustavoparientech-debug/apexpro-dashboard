import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ticket, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// Atajo del inicio del colaborador para vender tickets del sorteo.
// Solo aparece mientras la venta está abierta.
export default function AtajoSorteo() {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    let vivo = true
    Promise.all([
      supabase.from('raffle_config').select('titulo, estado, precio_ticket').eq('id', 1).maybeSingle(),
      supabase.from('raffle_board').select('number', { count: 'exact', head: true }).eq('status', 'disponible'),
    ]).then(([cfg, libres]) => {
      if (vivo && cfg.data) setInfo({ ...cfg.data, libres: libres.count })
    }).catch(() => {})
    return () => { vivo = false }
  }, [])

  if (!info || info.estado !== 'abierto') return null

  return (
    <Link to="/sorteo-panel"
      className="flex items-center gap-4 rounded-2xl p-4 bg-gradient-to-r from-red-700 to-red-500 text-white shadow-lg shadow-red-900/20 active:scale-[0.99] transition-transform">
      <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center flex-none">
        <Ticket className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-black text-lg leading-tight">Vender tickets</p>
        <p className="text-sm text-white/80 truncate">
          {info.titulo} · S/{Number(info.precio_ticket)}
          {info.libres != null && ` · quedan ${info.libres}`}
        </p>
      </div>
      <ChevronRight className="w-5 h-5 text-white/80 flex-none" />
    </Link>
  )
}
