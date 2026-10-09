import { useMemo, useState } from 'react'
import { boardStatus, fmtNum } from '../../lib/sorteo'
import { STATUS_STYLE } from './ui'

const BLOQUE = 100

// Grilla de números por bloques de 100 (en celular 600 casillas juntas son
// demasiado scroll). `tick` solo sirve para recalcular reservas vencidas.
export default function TicketGrid({ rows, total, selected, onToggle, tick }) {
  const bloques = useMemo(() => {
    const out = []
    for (let start = 1; start <= total; start += BLOQUE) out.push([start, Math.min(start + BLOQUE - 1, total)])
    return out
  }, [total])
  const [bloque, setBloque] = useState(0)
  const [desde, hasta] = bloques[Math.min(bloque, bloques.length - 1)] || [1, 0]

  const libresPorBloque = useMemo(() => {
    const now = Date.now()
    return bloques.map(([a, b]) => {
      let n = 0
      for (let i = a; i <= b; i++) if (boardStatus(rows.get(i), now) === 'disponible') n++
      return n
    })
  }, [rows, bloques, tick])

  const elegidosPorBloque = bloques.map(([a, b]) => [...selected].filter(n => n >= a && n <= b).length)
  const now = Date.now()

  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none" role="tablist">
        {bloques.map(([a, b], i) => (
          <button key={a} role="tab" aria-selected={i === bloque} onClick={() => setBloque(i)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              i === bloque ? 'bg-red-600 border-red-500 text-white' : 'border-white/10 text-gray-400 hover:text-white'}`}>
            {fmtNum(a, total)}–{fmtNum(b, total)}
            <span className="block text-[10px] font-normal opacity-80">
              {libresPorBloque[i]} libres{elegidosPorBloque[i] ? ` · ${elegidosPorBloque[i]} tuyos` : ''}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-10 gap-1 sm:gap-1.5 mt-2">
        {Array.from({ length: hasta - desde + 1 }, (_, i) => {
          const n      = desde + i
          const estado = boardStatus(rows.get(n), now)
          const mio    = selected.has(n)
          const libre  = estado === 'disponible'
          const style  = mio ? STATUS_STYLE.elegido : STATUS_STYLE[estado]
          return (
            <button key={n} type="button"
              disabled={!libre && !mio}
              onClick={() => onToggle(n)}
              aria-pressed={mio}
              aria-label={`Número ${fmtNum(n, total)}: ${mio ? 'elegido' : style.label}`}
              className={`aspect-square rounded-md border text-[11px] sm:text-sm tabular-nums transition-colors ${style.cell}`}>
              {fmtNum(n, total)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
