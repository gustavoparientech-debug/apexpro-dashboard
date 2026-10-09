import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { boardStatus } from '../lib/sorteo'

// Tablero público del sorteo en tiempo real (tabla raffle_board, sin datos
// personales). Devuelve un Map number → fila y los contadores ya calculados.
export function useRaffleBoard() {
  const [rows,    setRows]    = useState(() => new Map())
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  // Fuerza recalcular reservas vencidas aunque no llegue ningún evento.
  const [tick,    setTick]    = useState(0)

  useEffect(() => {
    let alive = true

    async function load() {
      const { data, error } = await supabase
        .from('raffle_board')
        .select('number, status, nombre, celular, reserved_until')
        .order('number')
        .limit(10000)
      if (!alive) return
      if (error) { setError(error); setLoading(false); return }
      setRows(new Map(data.map(r => [r.number, r])))
      setError(null)
      setLoading(false)
    }

    const channel = supabase
      .channel('raffle-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raffle_board' }, (payload) => {
        setRows(prev => {
          const next = new Map(prev)
          if (payload.eventType === 'DELETE') next.delete(payload.old.number)
          else next.set(payload.new.number, payload.new)
          return next
        })
      })
      .subscribe((status) => {
        // Al (re)conectar se recarga todo por si se perdieron eventos.
        if (status === 'SUBSCRIBED') load()
      })

    load()
    const timer = setInterval(() => setTick(t => t + 1), 30_000)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [])

  const stats = useMemo(() => {
    const now = Date.now()
    let disponibles = 0, reservados = 0, vendidos = 0
    for (const r of rows.values()) {
      const s = boardStatus(r, now)
      if (s === 'vendido') vendidos++
      else if (s === 'reservado') reservados++
      else disponibles++
    }
    return { disponibles, reservados, vendidos, total: rows.size }
  }, [rows, tick])

  return { rows, stats, loading, error, tick }
}
