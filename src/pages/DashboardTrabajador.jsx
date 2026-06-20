import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatMoney, todayISO, getWorkingDaysInMonth, currentMonthYear, calcRealSalary } from '../lib/utils'
import { Target, Clock, CheckCircle, Car, AlertCircle, Plus, X, ClipboardList, TrendingDown, Pencil, Check } from 'lucide-react'
import toast from 'react-hot-toast'

const GASTO_CATS = [
  { value: 'insumos',    label: '🧴 Insumos' },
  { value: 'herramientas', label: '🔧 Herramientas' },
  { value: 'transporte', label: '🚌 Transporte' },
  { value: 'comida',     label: '🍱 Comida' },
  { value: 'otro',       label: '📦 Otro' },
]

function GastoSheet({ onClose, workerId, workerName }) {
  const { addExpense } = useApp()
  const [form, setForm] = useState({
    date: todayISO(),
    amount: '',
    category: 'insumos',
    description: '',
    worker_id: workerId || null,
  })
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Ingresa el monto'); return }
    setBusy(true)
    try {
      await addExpense({ ...form, amount: parseFloat(form.amount) })
      toast.success('Gasto registrado')
      onClose()
    } catch (err) { toast.error('Error: ' + err.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Registrar gasto</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-4 pb-8 pt-1 space-y-4">
          {/* Categorías */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Categoría</p>
            <div className="grid grid-cols-3 gap-2">
              {GASTO_CATS.map(c => (
                <button key={c.value} type="button"
                  onClick={() => setForm(f => ({ ...f, category: c.value }))}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold text-center transition-all border ${
                    form.category === c.value
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                  }`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Monto */}
          <div>
            <label className="label">Monto (S/)</label>
            <input type="number" className="input text-lg font-bold" min="0.10" step="0.10"
              placeholder="0.00" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              autoFocus required />
          </div>

          {/* Descripción */}
          <div>
            <label className="label">Descripción (opcional)</label>
            <input type="text" className="input" placeholder="Ej: Shampoo para autos"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <button type="submit" disabled={busy}
            className="w-full py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm disabled:opacity-60">
            {busy ? 'Guardando…' : 'Registrar gasto'}
          </button>
        </form>
      </div>
    </div>
  )
}

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

function FabMenu({ workerId, workerName }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showGasto, setShowGasto] = useState(false)
  return (
    <>
      <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 flex flex-col items-end gap-2">
        {open && (
          <>
            <button
              onClick={() => { setOpen(false); setShowGasto(true) }}
              className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all whitespace-nowrap">
              <TrendingDown className="w-4 h-4 text-amber-500" />
              Registrar gasto
            </button>
            <button
              onClick={() => { navigate('/registro', { state: { autoNew: true } }); setOpen(false) }}
              className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all whitespace-nowrap">
              <ClipboardList className="w-4 h-4 text-red-600" />
              Nuevo ticket
            </button>
          </>
        )}
        <button
          onClick={() => setOpen(v => !v)}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 ${
            open ? 'bg-gray-700' : 'bg-red-600 hover:bg-red-700'
          }`}>
          {open ? <X className="w-6 h-6 text-white" /> : <Plus className="w-6 h-6 text-white" />}
        </button>
      </div>
      {showGasto && <GastoSheet onClose={() => setShowGasto(false)} workerId={workerId} workerName={workerName} />}
    </>
  )
}

export default function DashboardTrabajador() {
  const { tickets, workers, vehicleTypes, monthlyCosts, loadData } = useApp()
  const { profile, refreshProfile } = useAuth()

  const [editingGreeting, setEditingGreeting] = useState(false)
  const [greetingDraft,   setGreetingDraft]   = useState('')
  const [savingGreeting,  setSavingGreeting]  = useState(false)
  const [refreshing,      setRefreshing]      = useState(false)

  async function handleRefresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
    toast.success('Datos actualizados')
  }

  // Recargar datos al entrar al dashboard para ver cambios de otros
  useEffect(() => { loadData() }, [])

  const worker = useMemo(
    () => workers.find(w => w.id === profile?.worker_id),
    [workers, profile]
  )

  const today = todayISO()
  const linked = !!profile?.worker_id

  // Si está vinculado, filtrar por su worker_id; si no, mostrar todos los del día
  const myTicketsHoy = useMemo(() =>
    tickets.filter(t => {
      if (t.hidden_from_workers) return false
      const isToday  = t.date === today
      const isClosed = t.status === 'cerrado' || !t.status
      if (!linked) return isToday && isClosed
      return t.worker_id === profile.worker_id && isToday && isClosed
    }), [tickets, profile, today, linked])

  const myOpen = useMemo(() =>
    tickets.filter(t => {
      if (t.hidden_from_workers) return false
      if (!linked) return t.status === 'abierto'
      return t.worker_id === profile.worker_id && t.status === 'abierto'
    }), [tickets, profile, linked])

  const totalHoy  = useMemo(() => myTicketsHoy.reduce((s, t) => s + t.price_charged, 0), [myTicketsHoy])
  const { month, year } = currentMonthYear()
  const workingDaysTotal = getWorkingDaysInMonth(year, month)
  const activeWorkers = workers.filter(w => w.active)
  const numWorkers = activeWorkers.length || 1
  const fixedItemsTotal = (monthlyCosts?.cost_items?.length > 0)
    ? monthlyCosts.cost_items.reduce((s, i) => s + (i.amount || 0), 0)
    : (monthlyCosts?.rent || 0) + (monthlyCosts?.supplies || 0)
  const payrollTotal = activeWorkers.reduce((s, w) => s + calcRealSalary(w.base_salary || 0, w.weekly_hours || 48), 0)
  const incomeGoal = fixedItemsTotal + payrollTotal + (monthlyCosts?.utility_goal || 2000)
  const metaDiariaRef = workingDaysTotal > 0 ? Math.round(incomeGoal / workingDaysTotal / numWorkers) : 80
  const metaDiaria = (worker?.daily_goal != null) ? worker.daily_goal : metaDiariaRef
  const progreso   = Math.min(100, Math.round((totalHoy / metaDiaria) * 100))

  const hora   = new Date().getHours()
  const saludoDefault = hora < 12 ? 'Buenos días 👋' : hora < 19 ? 'Buenas tardes 👋' : 'Buenas noches 🌙'
  const saludo = profile?.greeting || saludoDefault
  const nombre = profile?.display_name?.split(' ')[0] || worker?.name || 'equipo'

  async function saveGreeting() {
    if (!greetingDraft.trim()) return
    setSavingGreeting(true)
    const { error } = await supabase.from('profiles').update({ greeting: greetingDraft.trim() }).eq('id', profile.id)
    if (error) { toast.error('Error al guardar'); setSavingGreeting(false); return }
    await refreshProfile()
    setEditingGreeting(false)
    setSavingGreeting(false)
    toast.success('Mensaje actualizado')
  }

  // Fecha formateada con mayúscula
  const fechaHoy = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).replace(/^\w/, c => c.toUpperCase())

  return (
    <div className="space-y-5 max-w-lg mx-auto">

      {/* Saludo + fecha prominente */}
      <div className="card bg-[#1e1e1e] dark:bg-[#1e1e1e] border-0">
        {editingGreeting ? (
          <div className="flex items-center gap-2 mb-2">
            <input
              className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:border-red-500"
              value={greetingDraft}
              onChange={e => setGreetingDraft(e.target.value)}
              placeholder="Ej: ¡A romperla hoy! 💪"
              maxLength={60}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') saveGreeting(); if (e.key === 'Escape') setEditingGreeting(false) }}
            />
            <button onClick={saveGreeting} disabled={savingGreeting} className="p-2 bg-red-600 hover:bg-red-700 rounded-lg text-white">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => setEditingGreeting(false)} className="p-2 text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-1">
            <p className="text-gray-400 text-sm">{saludo}</p>
            <button
              onClick={() => { setGreetingDraft(profile?.greeting || ''); setEditingGreeting(true) }}
              className="p-1 text-gray-600 hover:text-gray-400 transition-colors"
              title="Editar mensaje"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex items-start justify-between">
          <h1 className="text-white font-black text-2xl">{nombre}</h1>
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white text-xs font-semibold">
            <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
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
          <p className="text-gray-400 text-xs mt-1">Toca el botón rojo para abrir uno</p>
        </div>
      )}

      <FabMenu workerId={profile?.worker_id} workerName={nombre} />
    </div>
  )
}
