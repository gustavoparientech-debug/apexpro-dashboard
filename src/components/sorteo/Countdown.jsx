import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'

// Cuenta regresiva en vivo hasta la fecha del sorteo (raffle_config.fecha_sorteo).
export default function Countdown({ fecha }) {
  const target = fecha ? new Date(fecha).getTime() : null
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!target) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [target])

  if (!target) return null

  const left = target - now
  if (left <= 0) {
    return (
      <div className="text-center bg-red-600/15 border border-red-700/40 rounded-2xl py-4 mb-3">
        <p className="font-black text-lg">🎉 ¡Llegó el día del sorteo!</p>
        <p className="text-sm text-gray-400 mt-0.5">Síguelo en vivo por @apex.pro.aqp</p>
      </div>
    )
  }

  const s = Math.floor(left / 1000)
  const partes = [
    [Math.floor(s / 86400), 'días'],
    [Math.floor((s % 86400) / 3600), 'horas'],
    [Math.floor((s % 3600) / 60), 'min'],
    [s % 60, 'seg'],
  ]

  return (
    <div className="mb-3" role="timer" aria-label="Tiempo que falta para el sorteo">
      <p className="text-xs uppercase tracking-[0.2em] text-gray-400 text-center flex items-center justify-center gap-1.5 mb-2">
        <Timer className="w-3.5 h-3.5 text-red-500" /> Faltan para el sorteo
      </p>
      <div className="grid grid-cols-4 gap-2">
        {partes.map(([v, label]) => (
          <div key={label} className="bg-[#1b1b1b] border border-white/10 rounded-2xl py-3 text-center">
            <p className="text-3xl sm:text-4xl font-black tabular-nums leading-none">{String(v).padStart(2, '0')}</p>
            <p className="text-[11px] uppercase tracking-wider text-gray-500 mt-1.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
