import { useMemo, useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { formatMoney, todayISO } from '../lib/utils'
import { Target, Clock, CheckCircle, Car } from 'lucide-react'

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${String(m % 60).padStart(2, '0')}m`
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function OpenTicketRow({ ticket, vehicleTypes }) {
  const v = (vehicleTypes || []).find(vt => vt.value === ticket.vehicle_type)
  const [ms, setMs] = useState(() => ticket.opened_at ? Date.now() - new Date(ticket.opened_at).getTime() : 0)
  useEffect(() => {
    if (!ticket.opened_at) return
    const id = setInterval(() => setMs(Date.now() - new Date(ticket.opened_at).getTime()), 1000)
    return () => clearInterval(id)
  }, [ticket.opened_at])
  return (
    <div className="card flex items-center gap-3 border-l-4 border-l-amber-400">
      <div className="text-2xl">{v?.emoji || '🚗'}</div>
      <div className="flex-1">
        <p className="font-mono font-bold text-gray-900 dark:text-white">{ticket.plate || 'Sin placa'}</p>
        <p className="text-xs text-gray-500">{v?.label || ticket.vehicle_type}</p>
      </div>
      <div className="flex items-center gap-1 text-xs font-mono font-bold text-amber-600">
        <Clock className="w-3 h-3" />{formatElapsed(ms)}
      </div>
    </div>
  )
}

export default function DashboardTrabajador() {
  const { tickets, workers, vehicleTypes, monthlyCosts } = useApp()
  const { profile } = useAuth()

  const worker = useMemo(
    () => workers.find(w => w.id === profile?.worker_id),
    [workers, profile]
  )

  const today = todayISO()

  // Tickets del trabajador de hoy
  const myTicketsHoy = useMemo(() =>
    tickets.filter(t =>
      t.worker_id === profile?.worker_id &&
      t.date === today &&
      (t.status === 'cerrado' || !t.status)
    ), [tickets, profile, today])

  // Tickets abiertos del trabajador
  const myOpen = useMemo(() =>
    tickets.filter(t => t.worker_id === profile?.worker_id && t.status === 'abierto'),
    [tickets, profile])

  const totalHoy = useMemo(() => myTicketsHoy.reduce((s, t) => s + t.price_charged, 0), [myTicketsHoy])

  // Meta diaria aproximada (meta mensual / 26 días hábiles)
  const metaDiaria = monthlyCosts ? Math.round((monthlyCosts.utility_goal || 2000) / 26) : 80
  const progreso   = Math.min(100, Math.round((totalHoy / metaDiaria) * 100))

  const hora  = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const nombre = profile?.display_name?.split(' ')[0] || worker?.name || 'equipo'

  return (
    <div className="space-y-5 max-w-lg mx-auto">

      {/* Saludo */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{saludo}, {nombre} 👋</h1>
        <p className="text-sm text-gray-500 mt-0.5">{new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {/* Meta del día */}
      <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-5 text-white shadow-lg shadow-red-200 dark:shadow-red-900/30">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-4 h-4 opacity-80" />
          <span className="text-sm font-medium opacity-80">Meta del día</span>
        </div>
        <div className="flex items-end justify-between mb-3">
          <p className="text-3xl font-black">{formatMoney(totalHoy)}</p>
          <p className="text-sm opacity-70">de {formatMoney(metaDiaria)}</p>
        </div>
        <div className="bg-white/20 rounded-full h-2.5">
          <div
            className="bg-white rounded-full h-2.5 transition-all duration-700"
            style={{ width: `${progreso}%` }}
          />
        </div>
        <p className="text-xs opacity-70 mt-1.5 text-right">{progreso}% completado</p>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center">
          <p className="text-3xl font-black text-gray-900 dark:text-white">{myTicketsHoy.length}</p>
          <p className="text-xs text-gray-500 mt-1">Tickets cerrados hoy</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-black text-amber-500">{myOpen.length}</p>
          <p className="text-xs text-gray-500 mt-1">En proceso ahora</p>
        </div>
      </div>

      {/* Tickets abiertos */}
      {myOpen.length > 0 && (
        <div>
          <p className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">En proceso</p>
          <div className="space-y-2">
            {myOpen.map(t => (
              <OpenTicketRow key={t.id} ticket={t} vehicleTypes={vehicleTypes} />
            ))}
          </div>
        </div>
      )}

      {/* Últimos tickets cerrados */}
      {myTicketsHoy.length > 0 && (
        <div>
          <p className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Completados hoy</p>
          <div className="space-y-2">
            {myTicketsHoy.slice(0, 5).map(t => {
              const v = (vehicleTypes || []).find(vt => vt.value === t.vehicle_type)
              return (
                <div key={t.id} className="card flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-none" />
                  <div className="flex-1">
                    <p className="font-mono font-bold text-sm text-gray-900 dark:text-white">{t.plate || 'Sin placa'}</p>
                    <p className="text-xs text-gray-500">{v?.label || t.vehicle_type}</p>
                  </div>
                  <p className="font-bold text-red-600 text-sm">{formatMoney(t.price_charged)}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {myTicketsHoy.length === 0 && myOpen.length === 0 && (
        <div className="card text-center py-10">
          <Car className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Sin tickets por ahora</p>
          <p className="text-gray-400 text-xs mt-1">Ve a Registro para abrir el primero</p>
        </div>
      )}
    </div>
  )
}
