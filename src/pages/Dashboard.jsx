import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'
import {
  formatMoney, formatDate, getSemaforoColor, calcRealSalary, calcTicketProfit,
  getWorkingDaysInMonth, getWorkingDaysElapsed, getWorkingDaysRemaining,
  currentMonthYear, monthName, todayISO
} from '../lib/utils'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import {
  TrendingUp, Car, DollarSign, AlertTriangle, Clock,
  CreditCard, Smartphone, Calendar, Award, Trophy, Gift, Plus, Trash2, Banknote,
  ChevronLeft, ChevronRight, X, TrendingDown, ClipboardList
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function ProgressBar({ percent, color }) {
  const bg = { verde: 'bg-green-500', amarillo: 'bg-yellow-500', rojo: 'bg-red-500' }
  const border = { verde: 'border-green-200 dark:border-green-900', amarillo: 'border-yellow-200 dark:border-yellow-900', rojo: 'border-red-200 dark:border-red-900' }
  return (
    <div className={`w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden border ${border[color]}`}>
      <div className={`h-full rounded-full transition-all duration-700 ${bg[color]}`} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{value}</span>
    </div>
  )
}

function BonusSection({ workers, bonuses, addBonus, deleteBonus, monthPrefix }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ worker_id: '', amount: '', reason: '' })
  const [busy, setBusy] = useState(false)
  const monthBonuses = bonuses.filter(b => b.date?.startsWith(monthPrefix))
  const activeWorkers = workers.filter(w => w.active)
  const totalBonuses = monthBonuses.reduce((s, b) => s + b.amount, 0)

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.worker_id || !form.amount) { toast.error('Selecciona trabajador y monto'); return }
    setBusy(true)
    try {
      await addBonus({ worker_id: form.worker_id, amount: parseFloat(form.amount), reason: form.reason, date: `${monthPrefix}-01` })
      toast.success('Bono registrado')
      setForm({ worker_id: '', amount: '', reason: '' })
      setOpen(false)
    } catch (err) { toast.error('Error: ' + err.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">Bonos del mes</p>
          {totalBonuses > 0 && (
            <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">
              {formatMoney(totalBonuses)}
            </span>
          )}
        </div>
        <button onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1 text-xs text-red-600 font-semibold px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Agregar
        </button>
      </div>
      {open && (
        <form onSubmit={handleAdd} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">Trabajador</label>
              <select className="input text-sm" value={form.worker_id} onChange={e => setForm(f => ({ ...f, worker_id: e.target.value }))} required>
                <option value="">Seleccionar...</option>
                {activeWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs">Monto (S/)</label>
              <input type="number" className="input text-sm" min="1" step="1" placeholder="50" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="label text-xs">Motivo (opcional)</label>
            <input type="text" className="input text-sm" placeholder="Ej: Mejor mes, puntualidad..." value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1 text-sm py-2" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" disabled={busy} className="btn-primary flex-1 text-sm py-2">{busy ? '...' : 'Guardar bono'}</button>
          </div>
        </form>
      )}
      {monthBonuses.length === 0 && !open && <p className="text-xs text-gray-400 text-center py-2">Sin bonos este mes</p>}
      {monthBonuses.map(b => {
        const w = workers.find(wk => wk.id === b.worker_id)
        return (
          <div key={b.id} className="flex items-center gap-3 py-1">
            <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 font-bold text-xs flex-none">
              {w?.name?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{w?.name || 'Trabajador'}</p>
              {b.reason && <p className="text-xs text-gray-400 truncate">{b.reason}</p>}
            </div>
            <span className="text-sm font-bold text-amber-600">+{formatMoney(b.amount)}</span>
            <button onClick={() => deleteBonus(b.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

const GASTO_CATS = [
  { value: 'insumos',      label: '🧴 Insumos' },
  { value: 'herramientas', label: '🔧 Herramientas' },
  { value: 'transporte',   label: '🚌 Transporte' },
  { value: 'comida',       label: '🍱 Comida' },
  { value: 'otro',         label: '📦 Otro' },
]

function GastoSheet({ onClose }) {
  const { addExpense, workers } = useApp()
  const [form, setForm] = useState({ date: todayISO(), amount: '', category: '', notes: '', worker_id: '' })
  const [busy, setBusy] = useState(false)
  async function handleSave() {
    if (!form.amount) { toast.error('Ingresa el monto'); return }
    setBusy(true)
    try {
      await addExpense({ ...form, amount: parseFloat(form.amount) })
      toast.success('Gasto registrado')
      onClose()
    } catch { toast.error('Error al guardar') }
    finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl p-5 space-y-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Registrar gasto</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        <input type="number" className="input" placeholder="Monto S/" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        <div className="grid grid-cols-3 gap-2">
          {GASTO_CATS.map(c => (
            <button key={c.value} type="button" onClick={() => setForm(f => ({ ...f, category: c.value }))}
              className={`py-2 px-2 rounded-xl border text-xs font-medium transition-all ${form.category === c.value ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
              {c.label}
            </button>
          ))}
        </div>
        <select className="input" value={form.worker_id} onChange={e => setForm(f => ({ ...f, worker_id: e.target.value }))}>
          <option value="">Trabajador (opcional)</option>
          {workers.filter(w => w.active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <input className="input" placeholder="Notas (opcional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        <button onClick={handleSave} disabled={busy}
          className="w-full py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all active:scale-95">
          {busy ? 'Guardando…' : 'Registrar gasto'}
        </button>
      </div>
    </div>
  )
}

function AdminFab() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showGasto, setShowGasto] = useState(false)
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30" onClick={() => setOpen(false)} />}
      <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 flex flex-col items-end gap-2">
        {open && (
          <>
            <button onClick={() => { setOpen(false); setShowGasto(true) }}
              className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition-all whitespace-nowrap animate-fade-in">
              <TrendingDown className="w-4 h-4 text-amber-500" /> Registrar gasto
            </button>
            <button onClick={() => { navigate('/registro'); setOpen(false) }}
              className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition-all whitespace-nowrap animate-fade-in">
              <ClipboardList className="w-4 h-4 text-red-600" /> Nuevo ticket
            </button>
          </>
        )}
        <button onClick={() => setOpen(v => !v)}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 ${open ? 'bg-gray-700' : 'bg-red-600 hover:bg-red-700'}`}>
          {open ? <X className="w-6 h-6 text-white" /> : <Plus className="w-6 h-6 text-white" />}
        </button>
      </div>
      {showGasto && <GastoSheet onClose={() => setShowGasto(false)} />}
    </>
  )
}

export default function Dashboard() {
  const { tickets, dailySummaries, workers, services, incidents, monthlyCosts, bonuses, addBonus, deleteBonus, loading, addExpense } = useApp()
  const { month: cm, year: cy } = currentMonthYear()
  const [selMonth, setSelMonth] = useState(cm)
  const [selYear,  setSelYear]  = useState(cy)
  const [selDay,   setSelDay]   = useState(null)
  const isCurrentMonth = selMonth === cm && selYear === cy

  const [pastTickets,    setPastTickets]    = useState([])
  const [pastSummaries,  setPastSummaries]  = useState([])

  useEffect(() => {
    if (isCurrentMonth || IS_DEMO) { setPastTickets([]); setPastSummaries([]); return }
    const p = `${selYear}-${String(selMonth).padStart(2,'0')}`
    Promise.all([
      supabase.from('tickets').select('*').gte('date', `${p}-01`).lte('date', `${p}-31`).neq('status', 'abierto'),
      supabase.from('daily_summary').select('*').gte('date', `${p}-01`).lte('date', `${p}-31`),
    ]).then(([t, s]) => { setPastTickets(t.data || []); setPastSummaries(s.data || []) })
  }, [selMonth, selYear, isCurrentMonth])
  const prefix = `${selYear}-${String(selMonth).padStart(2, '0')}`
  const lastDayOfMonth = new Date(selYear, selMonth, 0).getDate()

  function prevDay() {
    if (!selDay) return
    const d = new Date(selDay + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    const newDay = d.toISOString().slice(0, 10)
    if (newDay.startsWith(prefix)) setSelDay(newDay)
  }
  function nextDay() {
    if (!selDay) return
    const d = new Date(selDay + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    const newDay = d.toISOString().slice(0, 10)
    if (newDay.startsWith(prefix)) setSelDay(newDay)
  }

  const data = useMemo(() => {
    const dateFilter = (date) => selDay ? date === selDay : date?.startsWith(prefix)
    const sourceTickets    = isCurrentMonth ? tickets    : pastTickets
    const sourceSummaries  = isCurrentMonth ? dailySummaries : pastSummaries
    const periodTickets   = sourceTickets.filter(t => dateFilter(t.date) && t.status !== 'abierto')
    const periodSummaries = sourceSummaries.filter(d => dateFilter(d.date))

    const ticketIncome  = periodTickets.reduce((s, t) => s + (t.price_charged || 0), 0)
    const summaryIncome = periodSummaries.reduce((s, d) => s + (d.total_income || 0), 0)
    const totalIncome   = ticketIncome + summaryIncome

    const netProfit = periodTickets.reduce((s, t) => {
      const svc = services.find(sv => sv.id === t.service_id)
      return s + (svc ? calcTicketProfit(t.price_charged, svc.margin_percent) : t.price_charged * 0.65)
    }, 0)

    const rent        = monthlyCosts?.rent     || 0
    const supplies    = monthlyCosts?.supplies || 0
    const utilityGoal = monthlyCosts?.utility_goal || 2000
    const payrollTotal = workers.filter(w => w.active).reduce((s, w) => {
      const real = calcRealSalary(w.base_salary, w.weekly_hours)
      const disc = incidents.filter(i => i.worker_id === w.id && i.apply_discount && i.date?.startsWith(prefix))
        .reduce((d, i) => d + (i.discount_amount || 0), 0)
      return s + real - disc
    }, 0)
    const monthBonusAmt = bonuses.filter(b => b.date?.startsWith(prefix)).reduce((s, b) => s + b.amount, 0)
    const totalCosts  = rent + supplies + payrollTotal + monthBonusAmt
    const incomeGoal  = totalCosts + utilityGoal
    const progressPct = incomeGoal > 0 ? (totalIncome / incomeGoal) * 100 : 0
    const semaforo    = getSemaforoColor(progressPct)

    const workingDaysTotal    = getWorkingDaysInMonth(selYear, selMonth)
    const workingDaysElapsed  = isCurrentMonth ? getWorkingDaysElapsed(selYear, selMonth) : workingDaysTotal
    const workingDaysRemaining = isCurrentMonth ? getWorkingDaysRemaining(selYear, selMonth) : 0
    const avgDailyActual  = workingDaysElapsed  > 0 ? totalIncome / workingDaysElapsed  : 0
    const avgDailyNeeded  = workingDaysRemaining > 0 ? (incomeGoal - totalIncome) / workingDaysRemaining : 0
    const totalCars = periodTickets.length

    const efectivo      = periodTickets.filter(t => t.payment_method === 'efectivo').reduce((s, t) => s + t.price_charged, 0)
    const yape          = periodTickets.filter(t => t.payment_method === 'yape').reduce((s, t) => s + t.price_charged, 0)
    const transferencia = periodTickets.filter(t => t.payment_method === 'transferencia').reduce((s, t) => s + t.price_charged, 0)

    const byDate = {}
    periodTickets.forEach(t => { byDate[t.date] = (byDate[t.date] || 0) + t.price_charged })
    periodSummaries.forEach(d => { byDate[d.date] = (byDate[d.date] || 0) + d.total_income })
    const bestDay = Object.entries(byDate).sort((a, b) => b[1] - a[1])[0]
    const dailyData = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).slice(-10)
      .map(([date, amount]) => ({ date: formatDate(date), amount }))

    const projectedIncome = workingDaysTotal > 0 && workingDaysElapsed > 0 ? (totalIncome / workingDaysElapsed) * workingDaysTotal : 0
    const onTrack = projectedIncome >= incomeGoal

    // Ranking por trabajador
    const workerMap = {}
    periodTickets.forEach(t => {
      if (!t.worker_id) return
      if (!workerMap[t.worker_id]) workerMap[t.worker_id] = { income: 0, cars: 0 }
      workerMap[t.worker_id].income += t.price_charged
      workerMap[t.worker_id].cars   += 1
    })
    const workerRanking = Object.entries(workerMap)
      .map(([id, s]) => ({ worker: workers.find(w => w.id === id), ...s }))
      .filter(r => r.worker)
      .sort((a, b) => b.income - a.income)

    return {
      totalIncome, netProfit, totalCosts, payrollTotal, rent, supplies, utilityGoal,
      incomeGoal, progressPct, semaforo, totalCars, avgDailyActual, avgDailyNeeded,
      workingDaysElapsed, workingDaysRemaining, workingDaysTotal,
      bestDay, efectivo, yape, transferencia, onTrack, projectedIncome, dailyData,
      workerRanking, monthBonusAmt,
    }
  }, [tickets, dailySummaries, pastTickets, pastSummaries, workers, services, incidents, monthlyCosts, bonuses, prefix, selMonth, selYear, isCurrentMonth, selDay])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
    </div>
  )

  const semaforoClass = {
    verde:    'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/10',
    amarillo: 'border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-900/10',
    rojo:     'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10',
  }
  const semaforoText = {
    verde: 'text-green-700 dark:text-green-400',
    amarillo: 'text-yellow-700 dark:text-yellow-400',
    rojo: 'text-red-700 dark:text-red-400',
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">

      {/* Header + selector de mes/día */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Panel</h1>
            <p className="text-sm text-gray-500">
              {selDay ? (() => { const [y,m,d] = selDay.split('-'); return `${d} de ${monthName(+m)} ${y}` })() : `${monthName(selMonth)} ${selYear}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select className="input text-sm py-1.5 w-36"
              value={selMonth} onChange={e => { setSelMonth(+e.target.value); setSelDay(null) }}>
              {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select className="input text-sm py-1.5 w-24"
              value={selYear} onChange={e => { setSelYear(+e.target.value); setSelDay(null) }}>
              {[cy-1, cy, cy+1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {!selDay && (
              <Badge variant={data.semaforo}>
                {data.semaforo === 'verde' ? '✓ En meta' : data.semaforo === 'amarillo' ? '⚠ En progreso' : '✗ Por debajo'}
              </Badge>
            )}
          </div>
        </div>

        {/* Selector de día */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            <button onClick={prevDay} disabled={!selDay}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-700 disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
            <input type="date" className="bg-transparent text-sm font-medium text-gray-700 dark:text-gray-200 px-1 focus:outline-none w-36"
              value={selDay || ''}
              min={`${prefix}-01`}
              max={`${prefix}-${String(lastDayOfMonth).padStart(2,'0')}`}
              onChange={e => setSelDay(e.target.value || null)}
            />
            <button onClick={nextDay} disabled={!selDay}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-700 disabled:opacity-30 transition-colors">
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
          {selDay ? (
            <button onClick={() => setSelDay(null)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 px-3 py-2 rounded-xl transition-colors font-medium">
              <X className="w-3 h-3" /> Todo el mes
            </button>
          ) : (
            <p className="text-xs text-gray-400">Selecciona un día para filtrar</p>
          )}
          {selDay && <Badge variant="blue">Día específico</Badge>}
        </div>
      </div>

      {/* Alerta ritmo */}
      {!selDay && isCurrentMonth && !data.onTrack && data.workingDaysElapsed > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700 dark:text-red-400 text-sm">Ritmo insuficiente para alcanzar la meta</p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
              Proyección: {formatMoney(data.projectedIncome)} — meta: {formatMoney(data.incomeGoal)}
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={selDay ? 'Ingresos del día' : 'Ingresos del mes'}   value={formatMoney(data.totalIncome)}  sub={`${data.totalCars} vehículos`} icon={DollarSign} color="orange" />
        <StatCard label="Ganancia neta est." value={formatMoney(data.netProfit)}    sub={`${data.totalIncome > 0 ? ((data.netProfit/data.totalIncome)*100).toFixed(0) : 0}% del bruto`} icon={TrendingUp} color="green" />
        <StatCard label="Total gastos"       value={formatMoney(data.totalCosts)}   sub={`Planilla: ${formatMoney(data.payrollTotal)}`} icon={CreditCard} color="blue" />
        <StatCard label="Vehículos"          value={data.totalCars}                 sub={`Prom: ${formatMoney(data.totalCars ? data.totalIncome / data.totalCars : 0)}/carro`} icon={Car} color="purple" />
      </div>

      {/* Barra de progreso — solo vista mensual */}
      {!selDay && (
        <div className={`card border-2 ${semaforoClass[data.semaforo]}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Progreso hacia la meta mensual</p>
              <p className="text-xs text-gray-500 mt-0.5">Meta: {formatMoney(data.incomeGoal)}</p>
            </div>
            <p className={`text-2xl font-bold ${semaforoText[data.semaforo]}`}>{data.progressPct.toFixed(1)}%</p>
          </div>
          <ProgressBar percent={data.progressPct} color={data.semaforo} />
          <p className="text-xs text-gray-400 mt-2">Faltan {formatMoney(Math.max(0, data.incomeGoal - data.totalIncome))}</p>
        </div>
      )}

      {/* Estadísticas + mejor día */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-red-500" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Promedios</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><span className="text-xs text-gray-500">Promedio actual/día</span><span className="font-semibold text-sm text-gray-900 dark:text-white">{formatMoney(data.avgDailyActual)}</span></div>
            {isCurrentMonth && <div className="flex justify-between"><span className="text-xs text-gray-500">Necesario para cerrar</span><span className={`font-semibold text-sm ${data.avgDailyNeeded > data.avgDailyActual ? 'text-red-500' : 'text-green-500'}`}>{formatMoney(data.avgDailyNeeded)}</span></div>}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Días hábiles</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><span className="text-xs text-gray-500">Trabajados</span><span className="font-semibold text-sm text-gray-900 dark:text-white">{data.workingDaysElapsed} de {data.workingDaysTotal}</span></div>
            {isCurrentMonth && <div className="flex justify-between"><span className="text-xs text-gray-500">Restantes</span><span className="font-semibold text-sm text-red-500">{data.workingDaysRemaining} días</span></div>}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-yellow-500" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Mejor día</p>
          </div>
          {data.bestDay ? (
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatMoney(data.bestDay[1])}</p>
              <p className="text-xs text-gray-500 mt-0.5">{formatDate(data.bestDay[0])}</p>
            </div>
          ) : <p className="text-sm text-gray-400">Sin registros</p>}
        </div>
      </div>

      {/* Métodos de cobro */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card flex items-center gap-3">
          <div className="rounded-xl p-2.5 bg-green-50 dark:bg-green-900/20"><Banknote className="w-5 h-5 text-green-600" /></div>
          <div><p className="text-xs text-gray-500">Efectivo</p><p className="text-lg font-bold text-gray-900 dark:text-white">{formatMoney(data.efectivo)}</p></div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="rounded-xl p-2.5 bg-purple-50 dark:bg-purple-900/20"><Smartphone className="w-5 h-5 text-purple-600" /></div>
          <div><p className="text-xs text-gray-500">Yape</p><p className="text-lg font-bold text-gray-900 dark:text-white">{formatMoney(data.yape)}</p></div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="rounded-xl p-2.5 bg-blue-50 dark:bg-blue-900/20"><CreditCard className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-xs text-gray-500">Transferencia</p><p className="text-lg font-bold text-gray-900 dark:text-white">{formatMoney(data.transferencia)}</p></div>
        </div>
      </div>

      {/* Desglose gastos */}
      <div className="card">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Desglose de gastos</p>
        <Row label="🏠 Alquiler" value={formatMoney(data.rent)} />
        <Row label="🧴 Insumos"  value={formatMoney(data.supplies)} />
        <Row label="👷 Planilla" value={formatMoney(data.payrollTotal)} />
        {data.monthBonusAmt > 0 && <Row label="🎁 Bonos" value={formatMoney(data.monthBonusAmt)} />}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Total gastos</span>
          <span className="text-sm font-black text-red-600">{formatMoney(data.totalCosts)}</span>
        </div>
      </div>

      {/* Ranking trabajadores */}
      {data.workerRanking.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-bold text-gray-900 dark:text-white">Ranking de trabajadores</p>
          </div>
          <div className="space-y-3">
            {data.workerRanking.map((r, i) => (
              <div key={r.worker.id} className="flex items-center gap-3">
                <span className={`w-6 text-center text-sm font-black ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-700' : 'text-gray-400'}`}>{i + 1}</span>
                <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 font-bold text-xs flex-none">{r.worker.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{r.worker.name}</p>
                  <p className="text-xs text-gray-400">{r.cars} vehículos · prom {formatMoney(r.cars > 0 ? r.income / r.cars : 0)}</p>
                </div>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatMoney(r.income)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bonos */}
      <BonusSection workers={workers} bonuses={bonuses} addBonus={addBonus} deleteBonus={deleteBonus} monthPrefix={prefix} />

      {/* Gráfico diario */}
      {data.dailyData.length > 0 && (
        <div className="card">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Ingresos por día</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dailyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `S/${v}`}
                  tickCount={6} allowDecimals={false}
                  domain={[0, dataMax => Math.ceil(dataMax / 100) * 100]} />
                <Tooltip formatter={v => formatMoney(v)} />
                <Bar dataKey="amount" fill="#dc2626" radius={[4, 4, 0, 0]} name="Ingresos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <AdminFab />
    </div>
  )
}
