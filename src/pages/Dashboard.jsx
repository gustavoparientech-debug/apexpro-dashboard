import { useMemo, useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'
import {
  formatMoney, formatDate, getSemaforoColor, calcRealSalary, calcTicketProfit,
  getWorkingDaysInMonth, getWorkingDaysElapsed, getWorkingDaysRemaining, getWorkingDaysInRange,
  currentMonthYear, monthName
} from '../lib/utils'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import {
  TrendingUp, Car, DollarSign, AlertTriangle, Clock,
  CreditCard, Smartphone, Calendar, Award, Trophy, Gift, Plus, Trash2, Banknote,
  ChevronLeft, ChevronRight, X, Pencil
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

const CAT_LABELS = { insumos: '🧴 Insumos', herramientas: '🔧 Herramientas', transporte: '🚌 Transporte', comida: '🍱 Comida', adelanto: '💵 Adelanto', otro: '📦 Otro' }
const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Fecha ↓' },
  { value: 'date_asc',  label: 'Fecha ↑' },
  { value: 'amount_desc', label: 'Mayor monto' },
  { value: 'amount_asc',  label: 'Menor monto' },
]

function ExpensesPanel({ expenses, workers }) {
  const { updateExpense, deleteExpense, addExpense } = useApp()
  const { isAdmin, isDemo } = useAuth()
  const canAdmin = isAdmin || isDemo
  const [filterCat,    setFilterCat]    = useState('')
  const [filterWorker, setFilterWorker] = useState('')
  const [filterFrom,   setFilterFrom]   = useState('')
  const [filterTo,     setFilterTo]     = useState('')
  const [sortBy,       setSortBy]       = useState('date_desc')
  const [editingExp,   setEditingExp]   = useState(null)
  const [showAdd,      setShowAdd]      = useState(false)
  const [addForm,      setAddForm]      = useState({ amount: '', category: 'insumos', worker_id: '', notes: '', date: new Date().toISOString().slice(0, 10) })
  const [saving,       setSaving]       = useState(false)

  async function handleAdd() {
    if (!addForm.amount || isNaN(addForm.amount)) { toast.error('Ingresa un monto válido'); return }
    setSaving(true)
    try {
      await addExpense({ ...addForm, amount: parseFloat(addForm.amount), worker_id: addForm.worker_id || null })
      setAddForm({ amount: '', category: 'insumos', worker_id: '', notes: '', date: new Date().toISOString().slice(0, 10) })
      setShowAdd(false)
      toast.success('Gasto registrado')
    } catch { toast.error('Error al registrar') } finally { setSaving(false) }
  }

  const filtered = useMemo(() => {
    let list = [...expenses]
    if (filterCat)    list = list.filter(e => e.category === filterCat)
    if (filterWorker) list = list.filter(e => e.worker_id === filterWorker)
    if (filterFrom)   list = list.filter(e => e.date >= filterFrom)
    if (filterTo)     list = list.filter(e => e.date <= filterTo)
    list.sort((a, b) => {
      if (sortBy === 'date_desc')   return b.date.localeCompare(a.date)
      if (sortBy === 'date_asc')    return a.date.localeCompare(b.date)
      if (sortBy === 'amount_desc') return b.amount - a.amount
      if (sortBy === 'amount_asc')  return a.amount - b.amount
      return 0
    })
    return list
  }, [expenses, filterCat, filterWorker, filterFrom, filterTo, sortBy])

  const total = filtered.reduce((s, e) => s + (e.amount || 0), 0)
  const activeWorkers = workers.filter(w => expenses.some(e => e.worker_id === w.id))

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">💸</span>
        <p className="text-sm font-bold text-gray-900 dark:text-white flex-1">Gastos de personal</p>
        <span className="text-sm font-black text-amber-600">-{formatMoney(total)}</span>
        {canAdmin && (
          <button onClick={() => setShowAdd(v => !v)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 transition-colors">
            + Registrar gasto
          </button>
        )}
      </div>

      {/* Formulario rápido */}
      {showAdd && canAdmin && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-2 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Monto</p>
              <input type="number" className="input text-sm py-1.5" placeholder="0.00"
                value={addForm.amount} onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Categoría</p>
              <select className="input text-sm py-1.5" value={addForm.category}
                onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}>
                {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Trabajador</p>
              <select className="input text-sm py-1.5" value={addForm.worker_id}
                onChange={e => setAddForm(f => ({ ...f, worker_id: e.target.value }))}>
                <option value="">Sin asignar</option>
                {workers.filter(w => w.active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Fecha</p>
              <input type="date" className="input text-sm py-1.5" value={addForm.date}
                onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Descripción</p>
            <input type="text" className="input text-sm py-1.5" placeholder="Opcional"
              value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowAdd(false)}
              className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              Cancelar
            </button>
            <button onClick={handleAdd} disabled={saving}
              className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar gasto'}
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-3">
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent">
          <option value="">Todas las categorías</option>
          {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {activeWorkers.length > 0 && (
          <select value={filterWorker} onChange={e => setFilterWorker(e.target.value)}
            className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent">
            <option value="">Todos los trabajadores</option>
            {activeWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent">
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex items-center gap-1.5 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">Desde</span>
          <input type="date" className="text-xs bg-transparent text-gray-700 dark:text-gray-300 focus:outline-none"
            value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">Hasta</span>
          <input type="date" className="text-xs bg-transparent text-gray-700 dark:text-gray-300 focus:outline-none"
            value={filterTo} min={filterFrom} onChange={e => setFilterTo(e.target.value)} />
        </div>
        {(filterCat || filterWorker || filterFrom || filterTo) && (
          <button onClick={() => { setFilterCat(''); setFilterWorker(''); setFilterFrom(''); setFilterTo('') }}
            className="text-xs text-red-500 border border-red-200 dark:border-red-900 rounded-lg px-2 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-600 transition-colors">
            Limpiar
          </button>
        )}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">Sin gastos con estos filtros</p>
      ) : (
        <div className="space-y-0">
          {filtered.map(exp => {
            const worker = workers.find(w => w.id === exp.worker_id)
            const isEditing = editingExp?.id === exp.id

            if (isEditing && canAdmin) return (
              <div key={exp.id} className="py-2 border-b border-gray-100 dark:border-gray-800 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Monto</p>
                    <input type="number" className="input text-xs py-1" value={editingExp.amount}
                      onChange={e => setEditingExp(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Fecha</p>
                    <input type="date" className="input text-xs py-1" value={editingExp.date}
                      onChange={e => setEditingExp(f => ({ ...f, date: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Categoría</p>
                    <select className="input text-xs py-1" value={editingExp.category || ''}
                      onChange={e => setEditingExp(f => ({ ...f, category: e.target.value }))}>
                      {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Trabajador</p>
                    <select className="input text-xs py-1" value={editingExp.worker_id || ''}
                      onChange={e => setEditingExp(f => ({ ...f, worker_id: e.target.value }))}>
                      <option value="">Sin asignar</option>
                      {workers.filter(w => w.active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
                <input className="input text-xs py-1" placeholder="Notas" value={editingExp.notes || ''}
                  onChange={e => setEditingExp(f => ({ ...f, notes: e.target.value }))} />
                <div className="flex gap-2">
                  <button onClick={async () => {
                    try {
                      await updateExpense(exp.id, { ...editingExp, amount: parseFloat(editingExp.amount) })
                      toast.success('Gasto actualizado')
                      setEditingExp(null)
                    } catch { toast.error('Error al actualizar') }
                  }} className="flex-1 py-1.5 bg-red-600 text-white text-xs font-bold rounded-xl">Guardar</button>
                  <button onClick={() => setEditingExp(null)} className="px-3 py-1.5 border border-gray-200 text-xs rounded-xl text-gray-600">Cancelar</button>
                </div>
              </div>
            )

            return (
              <div key={exp.id} className="flex items-center gap-2 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{CAT_LABELS[exp.category] || exp.category || 'Gasto'}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {worker && <span className="text-xs text-gray-400">{worker.name}</span>}
                    {exp.method === 'efectivo' && <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded-md">💵 Efectivo</span>}
                    {exp.method === 'yape'     && <span className="text-xs font-medium text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded-md">💜 Yape</span>}
                    {exp.notes && <span className="text-xs text-gray-400 italic truncate">· {exp.notes}</span>}
                    <span className="text-xs text-gray-300 dark:text-gray-600">{exp.date}</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-600 flex-shrink-0">-{formatMoney(exp.amount)}</span>
                {canAdmin && (
                  <>
                    <button onClick={() => setEditingExp({ ...exp })}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex-shrink-0">
                      <Pencil className="w-3 h-3 text-gray-400" />
                    </button>
                    <button onClick={async () => { try { await deleteExpense(exp.id); toast.success('Eliminado') } catch { toast.error('Error') } }}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex-shrink-0">
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
        <span className="text-xs text-gray-400">{filtered.length} gasto{filtered.length !== 1 ? 's' : ''}</span>
        <span className="text-xs font-black text-amber-600">-{formatMoney(total)}</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { tickets, dailySummaries, expenses, workers, services, incidents, monthlyCosts, bonuses, addBonus, deleteBonus, loading } = useApp()
  const { month: cm, year: cy } = currentMonthYear()
  const [selMonth, setSelMonth] = useState(cm)
  const [selYear,  setSelYear]  = useState(cy)
  const [rangeFrom, setRangeFrom] = useState(null)
  const [rangeTo,   setRangeTo]   = useState(null)
  const isCurrentMonth = selMonth === cm && selYear === cy
  const hasRange = rangeFrom && rangeTo

  const [pastTickets,    setPastTickets]    = useState([])
  const [pastSummaries,  setPastSummaries]  = useState([])
  const [pastExpenses,   setPastExpenses]   = useState([])

  useEffect(() => {
    if (isCurrentMonth || IS_DEMO) { setPastTickets([]); setPastSummaries([]); setPastExpenses([]); return }
    const p = `${selYear}-${String(selMonth).padStart(2,'0')}`
    Promise.all([
      supabase.from('tickets').select('*').gte('date', `${p}-01`).lte('date', `${p}-31`).neq('status', 'abierto'),
      supabase.from('daily_summary').select('*').gte('date', `${p}-01`).lte('date', `${p}-31`),
      supabase.from('worker_expenses').select('*').gte('date', `${p}-01`).lte('date', `${p}-31`),
    ]).then(([t, s, e]) => { setPastTickets(t.data || []); setPastSummaries(s.data || []); setPastExpenses(e.data || []) })
  }, [selMonth, selYear, isCurrentMonth])
  const prefix = `${selYear}-${String(selMonth).padStart(2, '0')}`
  const lastDayOfMonth = new Date(selYear, selMonth, 0).getDate()

  const data = useMemo(() => {
    const dateFilter = (date) => {
      if (hasRange) return date >= rangeFrom && date <= rangeTo
      return date?.startsWith(prefix)
    }
    const sourceTickets    = isCurrentMonth ? tickets    : pastTickets
    const sourceSummaries  = isCurrentMonth ? dailySummaries : pastSummaries
    const sourceExpenses   = isCurrentMonth ? (expenses || []) : pastExpenses
    const periodTickets   = sourceTickets.filter(t => dateFilter(t.date) && t.status !== 'abierto')
    const periodSummaries = sourceSummaries.filter(d => dateFilter(d.date))
    const periodExpenses  = sourceExpenses.filter(e => dateFilter(e.date))

    const ticketIncome    = periodTickets.reduce((s, t) => s + (t.price_charged || 0), 0)
    const summaryIncome   = periodSummaries.reduce((s, d) => s + (d.total_income || 0), 0)
    const workerExpTotal  = periodExpenses.reduce((s, e) => s + (e.amount || 0), 0)
    const totalIncome     = ticketIncome + summaryIncome

    const utilityGoal = monthlyCosts?.utility_goal || 2000
    const costItemsData = monthlyCosts?.cost_items
    const fixedItemsTotal = (costItemsData && Array.isArray(costItemsData) && costItemsData.length > 0)
      ? costItemsData.reduce((s, i) => s + (i.amount || 0), 0)
      : (monthlyCosts?.rent || 0) + (monthlyCosts?.supplies || 0)
    const payrollTotal = workers.filter(w => w.active).reduce((s, w) => {
      const real = calcRealSalary(w.base_salary, w.weekly_hours)
      // Descuentos reales (sin hora_extra que suma). Adelanto sí se resta porque ya aparece como expense
      const disc = incidents.filter(i => i.worker_id === w.id && i.apply_discount && !i.is_addition && i.date?.startsWith(prefix))
        .reduce((d, i) => d + (i.discount_amount || 0), 0)
      const overtime = incidents.filter(i => i.worker_id === w.id && i.apply_discount && i.is_addition && i.date?.startsWith(prefix))
        .reduce((d, i) => d + (i.discount_amount || 0), 0)
      return s + real - disc + overtime
    }, 0)
    const monthBonusAmt = bonuses.filter(b => b.date?.startsWith(prefix)).reduce((s, b) => s + b.amount, 0)
    const rent = monthlyCosts?.rent || 0
    const supplies = monthlyCosts?.supplies || 0
    const totalCosts  = fixedItemsTotal + payrollTotal + monthBonusAmt + workerExpTotal

    const monthWorkingDaysTotal = getWorkingDaysInMonth(selYear, selMonth)
    const rangeWorkingDays = hasRange ? getWorkingDaysInRange(rangeFrom, rangeTo) : null

    // Días hábiles a mostrar: del rango filtrado si hay rango, si no del mes
    const workingDaysTotal    = hasRange ? rangeWorkingDays : monthWorkingDaysTotal
    const workingDaysElapsed  = hasRange ? rangeWorkingDays : (isCurrentMonth ? getWorkingDaysElapsed(selYear, selMonth) : monthWorkingDaysTotal)
    const workingDaysRemaining = hasRange ? 0 : (isCurrentMonth ? getWorkingDaysRemaining(selYear, selMonth) : 0)

    const fixedCosts = fixedItemsTotal + payrollTotal + monthBonusAmt
    // Costos fijos prorrateados a los días hábiles realmente filtrados (rango o transcurridos del mes)
    const proportionalFixed = hasRange
      ? (monthWorkingDaysTotal > 0 ? fixedCosts * (rangeWorkingDays / monthWorkingDaysTotal) : 0)
      : (isCurrentMonth && monthWorkingDaysTotal > 0 ? fixedCosts * (workingDaysElapsed / monthWorkingDaysTotal) : fixedCosts)
    const netProfit = totalIncome - proportionalFixed - workerExpTotal
    const incomeGoal  = hasRange
      ? proportionalFixed + utilityGoal * (monthWorkingDaysTotal > 0 ? rangeWorkingDays / monthWorkingDaysTotal : 0)
      : fixedItemsTotal + payrollTotal + monthBonusAmt + utilityGoal
    const progressPct = incomeGoal > 0 ? (totalIncome / incomeGoal) * 100 : 0
    const semaforo    = getSemaforoColor(progressPct)

    const avgDailyActual  = workingDaysElapsed  > 0 ? totalIncome / workingDaysElapsed  : 0
    const avgDailyNeeded  = hasRange
      ? (rangeWorkingDays > 0 ? incomeGoal / rangeWorkingDays : 0)
      : (monthWorkingDaysTotal > 0 ? incomeGoal / monthWorkingDaysTotal : 0)
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

    const displayCosts = hasRange ? proportionalFixed + workerExpTotal : totalCosts
    const proportionRatio = hasRange && monthWorkingDaysTotal > 0 ? rangeWorkingDays / monthWorkingDaysTotal : 1
    return {
      totalIncome, netProfit, totalCosts, displayCosts, payrollTotal, rent, supplies, utilityGoal,
      incomeGoal, progressPct, semaforo, totalCars, avgDailyActual, avgDailyNeeded,
      workingDaysElapsed, workingDaysRemaining, workingDaysTotal,
      bestDay, efectivo, yape, transferencia, onTrack, projectedIncome, dailyData,
      workerRanking, monthBonusAmt, workerExpTotal, periodExpenses, costItemsData,
      proportionalFixed, proportionRatio,
    }
  }, [tickets, dailySummaries, expenses, pastTickets, pastSummaries, pastExpenses, workers, services, incidents, monthlyCosts, bonuses, prefix, selMonth, selYear, isCurrentMonth, rangeFrom, rangeTo, hasRange])


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

      {/* Barra de carga sutil — visible pero no bloquea */}
      {loading && <div className="fixed top-0 left-0 right-0 h-0.5 z-50 bg-red-500 animate-pulse" />}

      {/* Header + selector de mes/día */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Panel</h1>
            <p className="text-sm text-gray-500">
              {hasRange ? `${formatDate(rangeFrom)} – ${formatDate(rangeTo)}` : `${monthName(selMonth)} ${selYear}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select className="input text-sm py-1.5 w-36"
              value={selMonth} onChange={e => { setSelMonth(+e.target.value); setRangeFrom(null); setRangeTo(null) }}>
              {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select className="input text-sm py-1.5 w-24"
              value={selYear} onChange={e => { setSelYear(+e.target.value); setRangeFrom(null); setRangeTo(null) }}>
              {[cy-1, cy, cy+1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {!hasRange && (
              <Badge variant={data.semaforo}>
                {data.semaforo === 'verde' ? '✓ En meta' : data.semaforo === 'amarillo' ? '⚠ En progreso' : '✗ Por debajo'}
              </Badge>
            )}
          </div>
        </div>

        {/* Filtro de rango de fechas */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-1.5">
            <span className="text-xs text-gray-400 shrink-0">Desde</span>
            <input type="date" className="bg-transparent text-sm font-medium text-gray-700 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 w-32"
              value={rangeFrom || ''}
              min={`${prefix}-01`}
              max={`${prefix}-${String(lastDayOfMonth).padStart(2,'0')}`}
              onChange={e => setRangeFrom(e.target.value || null)}
            />
            <span className="text-xs text-gray-400 shrink-0">Hasta</span>
            <input type="date" className="bg-transparent text-sm font-medium text-gray-700 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 w-32"
              value={rangeTo || ''}
              min={rangeFrom || `${prefix}-01`}
              max={`${prefix}-${String(lastDayOfMonth).padStart(2,'0')}`}
              onChange={e => setRangeTo(e.target.value || null)}
            />
          </div>
          {hasRange && (
            <button onClick={() => { setRangeFrom(null); setRangeTo(null) }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 px-3 py-2 rounded-xl transition-colors font-medium">
              <X className="w-3 h-3" /> Todo el mes
            </button>
          )}
        </div>
      </div>

      {/* Alerta ritmo */}
      {!hasRange && isCurrentMonth && !data.onTrack && data.workingDaysElapsed > 0 && (
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
        <StatCard label={hasRange ? 'Ingresos del rango' : 'Ingresos del mes'}   value={formatMoney(data.totalIncome)}  sub={`${data.totalCars} vehículos`} icon={DollarSign} color="red" />
        <StatCard label="Ganancia neta est." value={formatMoney(data.netProfit)}    sub={hasRange ? `Costos prop. a ${data.workingDaysElapsed} días hábiles` : `Costos proporcionales al día ${data.workingDaysElapsed}`} icon={TrendingUp} color="green" />
        <StatCard label={hasRange ? 'Gastos del rango' : 'Total gastos'} value={formatMoney(data.displayCosts)} sub={hasRange ? `Fijos prop. + gastos` : `Planilla: ${formatMoney(data.payrollTotal)}`} icon={CreditCard} color="neutral" />
        <StatCard label="Vehículos"          value={data.totalCars}                 sub={`Prom: ${formatMoney(data.totalCars ? data.totalIncome / data.totalCars : 0)}/carro`} icon={Car} color="neutral" />
      </div>

      {/* Barra de progreso — solo vista mensual */}
      {!hasRange && (
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
            {(isCurrentMonth || hasRange) && <div className="flex justify-between"><span className="text-xs text-gray-500">Necesario para cerrar</span><span className={`font-semibold text-sm ${data.avgDailyNeeded > data.avgDailyActual ? 'text-red-500' : 'text-green-500'}`}>{formatMoney(data.avgDailyNeeded)}</span></div>}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Días hábiles</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><span className="text-xs text-gray-500">{hasRange ? 'Días hábiles en rango' : 'Trabajados'}</span><span className="font-semibold text-sm text-gray-900 dark:text-white">{hasRange ? data.workingDaysElapsed : `${data.workingDaysElapsed} de ${data.workingDaysTotal}`}</span></div>
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
        <div className="card flex flex-col items-center text-center gap-2 py-3">
          <div className="rounded-xl p-2.5 bg-green-50 dark:bg-green-900/20"><Banknote className="w-5 h-5 text-green-600" /></div>
          <p className="text-xs text-gray-500">Efectivo</p>
          <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{formatMoney(data.efectivo)}</p>
        </div>
        <div className="card flex flex-col items-center text-center gap-2 py-3">
          <div className="rounded-xl p-2.5 bg-purple-50 dark:bg-purple-900/20"><Smartphone className="w-5 h-5 text-purple-600" /></div>
          <p className="text-xs text-gray-500">Yape</p>
          <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{formatMoney(data.yape)}</p>
        </div>
        <div className="card flex flex-col items-center text-center gap-2 py-3">
          <div className="rounded-xl p-2.5 bg-blue-50 dark:bg-blue-900/20"><CreditCard className="w-5 h-5 text-blue-600" /></div>
          <p className="text-xs text-gray-500">Transfer.</p>
          <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{formatMoney(data.transferencia)}</p>
        </div>
      </div>

      {/* Desglose gastos */}
      <div className="card">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
          Desglose de gastos{hasRange && <span className="ml-2 text-xs font-normal text-amber-500">proporcional al rango</span>}
        </p>
        {(data.costItemsData && data.costItemsData.length > 0)
          ? data.costItemsData.map((item, i) => <Row key={i} label={`📌 ${item.name}`} value={formatMoney(item.amount * data.proportionRatio)} />)
          : (<><Row label="🏠 Alquiler" value={formatMoney(data.rent * data.proportionRatio)} /><Row label="🧴 Insumos" value={formatMoney(data.supplies * data.proportionRatio)} /></>)
        }
        <Row label="👷 Planilla" value={formatMoney(data.payrollTotal * data.proportionRatio)} />
        {data.monthBonusAmt > 0 && <Row label="🎁 Bonos" value={formatMoney(data.monthBonusAmt * data.proportionRatio)} />}
        {data.workerExpTotal > 0 && <Row label="💸 Gastos personal" value={formatMoney(data.workerExpTotal)} />}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Total gastos</span>
          <span className="text-sm font-black text-red-600">{formatMoney(data.displayCosts)}</span>
        </div>
      </div>

      {/* Gastos de personal */}
      {data.periodExpenses?.length > 0 && <ExpensesPanel expenses={data.periodExpenses} workers={workers} />}

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
                <p className="text-sm font-bold text-gray-900 dark:text-white">{formatMoney(r.income)}</p>
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
    </div>
  )
}
