import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { formatMoney, calcRealSalary, monthName, currentMonthYear } from '../lib/utils'
import { Trophy, TrendingUp, Car, Wallet, ChevronDown, Plus, Trash2, Gift, Calendar, CreditCard, Smartphone, Banknote } from 'lucide-react'
import toast from 'react-hot-toast'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function StatCard({ label, value, sub, color = 'blue', icon: Icon }) {
  const colors = {
    blue:   'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
    green:  'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
    red:    'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
    amber:  'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
  }
  return (
    <div className={`rounded-2xl p-4 ${colors[color]}`}>
      {Icon && <Icon className="w-4 h-4 mb-2 opacity-70" />}
      <p className="text-xs opacity-70 mb-0.5">{label}</p>
      <p className="text-2xl font-black">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

function Row({ label, value, sub }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{value}</span>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

function BonusSection({ workers, bonuses, addBonus, deleteBonus, monthPrefix }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ worker_id: '', amount: '', reason: '' })
  const [busy, setBusy] = useState(false)

  const monthBonuses = bonuses.filter(b => b.date?.startsWith(monthPrefix))
  const activeWorkers = workers.filter(w => w.active)

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.worker_id || !form.amount) { toast.error('Selecciona trabajador y monto'); return }
    setBusy(true)
    try {
      await addBonus({
        worker_id: form.worker_id,
        amount: parseFloat(form.amount),
        reason: form.reason,
        date: `${monthPrefix}-01`,
      })
      toast.success('Bono registrado')
      setForm({ worker_id: '', amount: '', reason: '' })
      setOpen(false)
    } catch (err) { toast.error('Error: ' + err.message) }
    finally { setBusy(false) }
  }

  const totalBonuses = monthBonuses.reduce((s, b) => s + b.amount, 0)

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">Bonos del mes</p>
          {monthBonuses.length > 0 && (
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

      {monthBonuses.length === 0 && !open && (
        <p className="text-xs text-gray-400 text-center py-2">Sin bonos este mes</p>
      )}

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

export default function Historial() {
  const { tickets, dailySummaries, workers, incidents, monthlyCosts, bonuses, addBonus, deleteBonus } = useApp()
  const { month: cm, year: cy } = currentMonthYear()

  const [selMonth, setSelMonth] = useState(cm)
  const [selYear,  setSelYear]  = useState(cy)

  const prefix = `${selYear}-${String(selMonth).padStart(2, '0')}`

  const periodTickets     = useMemo(() => tickets.filter(t => t.date?.startsWith(prefix) && t.status !== 'abierto'), [tickets, prefix])
  const periodSummaries   = useMemo(() => dailySummaries.filter(d => d.date?.startsWith(prefix)), [dailySummaries, prefix])

  // Ingresos
  const ticketIncome   = useMemo(() => periodTickets.reduce((s, t) => s + t.price_charged, 0), [periodTickets])
  const summaryIncome  = useMemo(() => periodSummaries.reduce((s, d) => s + d.total_income, 0), [periodSummaries])
  const totalIncome    = ticketIncome + summaryIncome

  // Métodos de pago
  const efectivo      = useMemo(() => periodTickets.filter(t => t.payment_method === 'efectivo').reduce((s, t) => s + t.price_charged, 0), [periodTickets])
  const yape          = useMemo(() => periodTickets.filter(t => t.payment_method === 'yape').reduce((s, t) => s + t.price_charged, 0), [periodTickets])
  const transferencia = useMemo(() => periodTickets.filter(t => t.payment_method === 'transferencia').reduce((s, t) => s + t.price_charged, 0), [periodTickets])
  const sinMetodo     = totalIncome - efectivo - yape - transferencia

  // Gastos
  const rent     = monthlyCosts?.rent     || 0
  const supplies = monthlyCosts?.supplies || 0
  const payroll  = useMemo(() => workers.filter(w => w.active).reduce((s, w) => {
    const real = calcRealSalary(w.base_salary, w.weekly_hours)
    const disc = incidents.filter(i => i.worker_id === w.id && i.apply_discount && i.date?.startsWith(prefix))
      .reduce((d, i) => d + (i.discount_amount || 0), 0)
    return s + real - disc
  }, 0), [workers, incidents, prefix])
  const monthBonuses   = useMemo(() => bonuses.filter(b => b.date?.startsWith(prefix)), [bonuses, prefix])
  const totalBonusAmt  = monthBonuses.reduce((s, b) => s + b.amount, 0)
  const totalCosts     = rent + supplies + payroll + totalBonusAmt
  const netProfit      = totalIncome - totalCosts

  // Estadísticas
  const workingDays = useMemo(() => {
    const days = new Set(periodTickets.map(t => t.date).filter(Boolean))
    periodSummaries.forEach(d => days.add(d.date))
    return days.size
  }, [periodTickets, periodSummaries])

  const avgDaily    = workingDays > 0 ? totalIncome / workingDays : 0
  const avgPerDay   = workingDays > 0 ? periodTickets.length / workingDays : 0

  const bestDay = useMemo(() => {
    const byDay = {}
    periodTickets.forEach(t => { byDay[t.date] = (byDay[t.date] || 0) + t.price_charged })
    periodSummaries.forEach(d => { byDay[d.date] = (byDay[d.date] || 0) + d.total_income })
    const entries = Object.entries(byDay)
    if (!entries.length) return null
    const [date, amount] = entries.sort((a, b) => b[1] - a[1])[0]
    const d = new Date(date + 'T12:00:00')
    return { label: `${d.getDate()} ${monthName(d.getMonth() + 1).slice(0, 3)}.`, amount }
  }, [periodTickets, periodSummaries])

  // Ranking por lavador
  const workerRanking = useMemo(() => {
    const map = {}
    periodTickets.forEach(t => {
      if (!t.worker_id) return
      if (!map[t.worker_id]) map[t.worker_id] = { income: 0, cars: 0 }
      map[t.worker_id].income += t.price_charged
      map[t.worker_id].cars   += 1
    })
    return Object.entries(map)
      .map(([id, stats]) => ({ worker: workers.find(w => w.id === id), ...stats }))
      .filter(r => r.worker)
      .sort((a, b) => b.income - a.income)
  }, [periodTickets, workers])

  // Años disponibles
  const years = [cy - 1, cy, cy + 1]

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reportes</h1>
      </div>

      {/* Selector mes/año */}
      <div className="card flex items-center gap-3">
        <Calendar className="w-4 h-4 text-gray-400 flex-none" />
        <select className="flex-1 bg-transparent text-sm font-semibold text-gray-900 dark:text-white focus:outline-none"
          value={selMonth} onChange={e => setSelMonth(+e.target.value)}>
          {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select className="bg-transparent text-sm font-semibold text-gray-900 dark:text-white focus:outline-none"
          value={selYear} onChange={e => setSelYear(+e.target.value)}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Ingresos brutos" value={formatMoney(totalIncome)} color="blue" icon={TrendingUp} />
        <StatCard label="Ganancia neta"   value={formatMoney(netProfit)}   color={netProfit >= 0 ? 'green' : 'red'} icon={Wallet}
          sub={netProfit >= 0 ? `+${((netProfit/Math.max(totalIncome,1))*100).toFixed(0)}% margen` : 'pérdida'} />
        <StatCard label="Total gastos"   value={formatMoney(totalCosts)}  color="red"    icon={Wallet} />
        <StatCard label="Carros lavados" value={periodTickets.length}      color="purple" icon={Car}
          sub={workingDays > 0 ? `${avgPerDay.toFixed(1)} por día` : undefined} />
      </div>

      {/* Desglose ingresos */}
      <div className="card">
        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Desglose de ingresos</p>
        <Row label="🎫 Tickets" value={formatMoney(ticketIncome)} />
        <Row label="🛍 Ventas sueltas" value={formatMoney(summaryIncome)} />
        {efectivo > 0    && <Row label={<span className="flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5 text-green-500"/>Efectivo</span>} value={formatMoney(efectivo)} />}
        {yape > 0        && <Row label={<span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5 text-purple-500"/>Yape</span>} value={formatMoney(yape)} />}
        {transferencia > 0 && <Row label={<span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-blue-500"/>Transferencia</span>} value={formatMoney(transferencia)} />}
        {sinMetodo > 0   && <Row label="Sin método registrado" value={formatMoney(sinMetodo)} />}
      </div>

      {/* Desglose gastos */}
      <div className="card">
        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Desglose de gastos</p>
        <Row label="🏠 Alquiler"  value={formatMoney(rent)} />
        <Row label="🧴 Insumos"   value={formatMoney(supplies)} />
        <Row label="👷 Planilla"  value={formatMoney(payroll)} />
        {totalBonusAmt > 0 && <Row label="🎁 Bonos" value={formatMoney(totalBonusAmt)} />}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Total</span>
          <span className="text-sm font-black text-red-600">{formatMoney(totalCosts)}</span>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="card">
        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Estadísticas</p>
        <Row label="📅 Días trabajados"    value={workingDays} />
        <Row label="📈 Promedio diario"    value={formatMoney(avgDaily)} />
        <Row label="🚗 Promedio carros/día" value={avgPerDay.toFixed(1)} />
        {bestDay && <Row label="🏆 Mejor día" value={`${bestDay.label} · ${formatMoney(bestDay.amount)}`} />}
      </div>

      {/* Ranking por lavador */}
      {workerRanking.length > 0 && (
        <div className="card">
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Por lavador</p>
          <div className="space-y-3">
            {workerRanking.map((r, i) => (
              <div key={r.worker.id} className="flex items-center gap-3">
                <span className={`w-6 text-center text-sm font-black ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-700' : 'text-gray-400'}`}>{i + 1}</span>
                <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 font-bold text-xs flex-none">
                  {r.worker.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{r.worker.name}</p>
                  <p className="text-xs text-gray-400">{r.cars} carros</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatMoney(r.income)}</p>
                  <p className="text-xs text-gray-400">Prom: {formatMoney(r.cars > 0 ? r.income / r.cars : 0)}</p>
                </div>
              </div>
            ))}
          </div>
          {workerRanking[0] && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <p className="text-xs text-gray-500">
                Mejor lavador: <strong className="text-amber-600">{workerRanking[0].worker.name}</strong> con {formatMoney(workerRanking[0].income)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Bonos */}
      <BonusSection
        workers={workers}
        bonuses={bonuses}
        addBonus={addBonus}
        deleteBonus={deleteBonus}
        monthPrefix={prefix}
      />
    </div>
  )
}
