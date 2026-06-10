import { useMemo, useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { formatMoney, todayISO } from '../lib/utils'
import { Target, Clock, CheckCircle, Car, AlertCircle } from 'lucide-react'

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
  const linked = !!profile?.worker_id

  // Si está vinculado, filtrar por su worker_id; si no, mostrar todos los del día
  const myTicketsHoy = useMemo(() =>
    tickets.filter(t => {
      const isToday  = t.date === today
      const isClosed = t.status === 'cerrado' || !t.status
      if (!linked) return isToday && isClosed
      return t.worker_id === profile.worker_id && isToday && isClosed
    }), [tickets, profile, today, linked])

  const myOpen = useMemo(() =>
    tickets.filter(t => {
      if (!linked) return t.status === 'abierto'
      return t.worker_id === profile.worker_id && t.status === 'abierto'
    }), [tickets, profile, linked])

  const totalHoy  = useMemo(() => myTicketsHoy.reduce((s, t) => s + t.price_charged, 0), [myTicketsHoy])
  const metaDiaria = monthlyCosts ? Math.round((monthlyCosts.utility_goal || 2000) / 26) : 80
  const progreso   = Math.min(100, Math.round((totalHoy / metaDiaria) * 100))

  const hora   = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const nombre = profile?.display_name?.split(' ')[0] || worker?.name || 'equipo'

  // Fecha formateada con mayúscula
  const fechaHoy = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).replace(/^\w/, c => c.toUpperCase())

  return (
    <div className="space-y-5 max-w-lg mx-auto">

      {/* Saludo + fecha prominente */}
      <div className="card bg-[#1e1e1e] dark:bg-[#1e1e1e] border-0">
        <p className="text-gray-400 text-sm mb-1">{saludo} 👋</p>
        <h1 className="text-white font-black text-2xl">{nombre}</h1>
        <div className="mt-2 flex items-center gap-2">
          <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg tracking-wide uppercase">
            HOY
          </span>
          <span className="text-gray-300 text-sm font-medium">{fechaHoy}</span>
        </div>
      </div>

      {/* Aviso si no está vinculado a trabajador */}
      {!linked && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-none mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Tu cuenta no está vinculada a un trabajador. Pide al administrador que te vincule en <strong>Usuarios</strong> para ver solo tus tickets.
          </p>
        </div>
      )}

      {/* Meta del día */}
      <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-5 text-white shadow-lg shadow-red-200 dark:shadow-red-900/30">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 opacity-80" />
            <span className="text-sm font-medium opacity-80">
              {linked ? `Meta de ${worker?.name || nombre}` : 'Meta del equipo hoy'}
            </span>
          </div>
          <span className="text-xs opacity-60 bg-white/10 px-2 py-0.5 rounded-full">{today}</span>
        </div>
        <div className="flex items-end justify-between mb-3 mt-2">
          <p className="text-4xl font-black">{formatMoney(totalHoy)}</p>
          <p className="text-sm opacity-70 mb-1">meta {formatMoney(metaDiaria)}</p>
        </div>
        <div className="bg-white/20 rounded-full h-3">
          <div
            className="bg-white rounded-full h-3 transition-all duration-700"
            style={{ width: `${progreso}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <p className="text-xs opacity-70">{myTicketsHoy.length} ticket{myTicketsHoy.length !== 1 ? 's' : ''} cerrado{myTicketsHoy.length !== 1 ? 's' : ''}</p>
          <p className="text-xs opacity-70 font-bold">{progreso}%</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center py-4">
          <p className="text-4xl font-black text-gray-900 dark:text-white">{myTicketsHoy.length}</p>
          <p className="text-xs text-gray-500 mt-1.5">Cerrados hoy</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-4xl font-black text-amber-500">{myOpen.length}</p>
          <p className="text-xs text-gray-500 mt-1.5">En proceso</p>
        </div>
      </div>

      {/* Tickets abiertos */}
      {myOpen.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">En proceso ahora</p>
          <div className="space-y-2">
            {myOpen.map(t => <OpenTicketRow key={t.id} ticket={t} vehicleTypes={vehicleTypes} />)}
          </div>
        </div>
      )}

      {/* Tickets cerrados hoy */}
      {myTicketsHoy.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Completados hoy</p>
          <div className="space-y-2">
            {myTicketsHoy.map(t => {
              const v = (vehicleTypes || []).find(vt => vt.value === t.vehicle_type)
              const w = workers.find(w => w.id === t.worker_id)
              return (
                <div key={t.id} className="card flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-none" />
                  {t.photo_url && <img src={t.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-none" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-mono font-bold text-sm text-gray-900 dark:text-white">{t.plate || 'Sin placa'}</p>
                    <p className="text-xs text-gray-500">
                      {v?.emoji} {v?.label || t.vehicle_type}
                      {!linked && w && <span className="ml-1 text-gray-400">· {w.name}</span>}
                    </p>
                  </div>
                  <p className="font-bold text-red-600">{formatMoney(t.price_charged)}</p>
                </div>
              )
            })}
            <div className="flex justify-end">
              <div className="bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl">
                <span className="text-sm text-red-600 font-medium">Total: </span>
                <span className="text-lg font-black text-red-600">{formatMoney(totalHoy)}</span>
              </div>
            </div>
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
