import { Link } from 'react-router-dom'
import { Moon, Fingerprint } from 'lucide-react'

const hora = iso => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })

// Lo que ve un trabajador después de marcar su salida: su propio día y nada
// del taller.
export default function FueraDeTurno({ nombre, logs }) {
  const de = t => logs.find(l => l.type === t)?.logged_at
  const entrada = de('entrada'), salida = de('salida')
  const almIni = de('almuerzo_inicio'), almFin = de('almuerzo_fin')
  let minutos = entrada && salida ? (new Date(salida) - new Date(entrada)) / 60000 : null
  if (minutos != null && almIni && almFin) minutos -= (new Date(almFin) - new Date(almIni)) / 60000
  const trabajado = minutos != null && minutos > 0
    ? `${Math.floor(minutos / 60)} h ${String(Math.round(minutos % 60)).padStart(2, '0')} min`
    : null

  const fila = (label, valor) => valor && (
    <div className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-bold text-white tabular-nums">{valor}</span>
    </div>
  )

  return (
    <div className="max-w-md mx-auto pt-6 space-y-4">
      <div className="rounded-3xl bg-[#1e1e1e] p-6 text-center shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
          <Moon className="w-7 h-7 text-amber-300" />
        </div>
        <h1 className="text-2xl font-black text-white">Tu jornada terminó</h1>
        <p className="text-gray-400 text-sm mt-1">
          {salida ? `Marcaste tu salida a las ${hora(salida)}.` : 'Ya marcaste tu salida.'} ¡Gracias{nombre ? `, ${nombre}` : ''}! Nos vemos mañana.
        </p>

        <div className="mt-5 text-left rounded-2xl bg-white/5 px-4 py-1">
          {fila('Entrada', entrada && hora(entrada))}
          {fila('Almuerzo', almIni && `${hora(almIni)}${almFin ? ` – ${hora(almFin)}` : ''}`)}
          {fila('Salida', salida && hora(salida))}
          {fila('Trabajado hoy', trabajado)}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center leading-relaxed px-4">
        Por privacidad, fuera de tu turno no se muestra la información del taller.
        Vuelve a estar disponible mañana.
      </p>

      <Link to="/asistencia"
        className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-200">
        <Fingerprint className="w-4 h-4" /> Ver mi asistencia
      </Link>
    </div>
  )
}
