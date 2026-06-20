import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import {
  formatMoney, formatDate, calcRealSalary, calcDailySalary, calcProratedSalary,
  calcAbsenceDiscount, calcLatenessDiscount, calcOvertimePay, getRatioColor, currentMonthYear, monthName, todayISO
} from '../lib/utils'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Badge from '../components/ui/Badge'
import { Plus, Edit2, UserX, UserCheck, AlertCircle, Clock, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const INCIDENT_ICONS = { falta: '🔴', permiso: '🟡', permiso_horas: '🟡', tardanza: '🟠', hora_extra: '🟢', no_marcacion: '🔵', multa: '🚫', adelanto: '💵' }
const INCIDENT_LABELS = { falta: 'Falta injustificada', permiso: 'Permiso justificado', permiso_horas: 'Permiso por horas', tardanza: 'Tardanza', hora_extra: 'Hora extra', no_marcacion: 'No marcó entrada/salida', multa: 'Multa', adelanto: 'Adelanto de sueldo' }

function WorkerForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    base_salary: initial?.base_salary || '',
    weekly_hours: initial?.weekly_hours || 48,
    hire_date: initial?.hire_date || '',
    role: initial?.role || 'worker',
  })

  const realSalary = form.base_salary && form.weekly_hours
    ? calcRealSalary(parseFloat(form.base_salary), parseFloat(form.weekly_hours)) : 0

  async function handleSubmit(e) {
    e.preventDefault()
    await onSave({
      ...form,
      base_salary: form.base_salary !== '' ? parseFloat(form.base_salary) : 0,
      weekly_hours: parseFloat(form.weekly_hours),
      hire_date: form.hire_date || null,
    })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Nombre completo</label>
        <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ej: Juan Pérez" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Salario base (S/)</label>
          <input type="number" className="input" min="0" step="50" value={form.base_salary} onChange={e => setForm(f => ({ ...f, base_salary: e.target.value }))} placeholder="0 si no aplica" />
        </div>
        <div>
          <label className="label">Horas/semana</label>
          <input type="number" className="input" min="1" max="48" value={form.weekly_hours} onChange={e => setForm(f => ({ ...f, weekly_hours: e.target.value }))} required />
        </div>
      </div>
      {realSalary > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-orange-100 dark:border-red-900/30 rounded-lg p-3">
          <p className="text-xs text-red-600 dark:text-red-400">
            Salario real mensual: <strong>{formatMoney(realSalary)}</strong>
            {' '}· Salario diario: <strong>{formatMoney(realSalary / 26)}</strong>
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Fecha de ingreso</label>
          <input type="date" className="input" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} />
        </div>
        <div>
          <label className="label">Rol</label>
          <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            <option value="worker">Trabajador</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary flex-1">{initial ? 'Guardar cambios' : 'Agregar trabajador'}</button>
      </div>
    </form>
  )
}

export function IncidentForm({ workers, onSave, onClose, initial }) {
  const activeWorkers = workers.filter(w => w.active)

  function splitHours(decimal) {
    const h = Math.floor(parseFloat(decimal) || 0)
    const m = Math.round(((parseFloat(decimal) || 0) - h) * 60)
    return { h: String(h), m: String(m) }
  }

  const initHours = initial?.hours_late ? splitHours(initial.hours_late) : { h: '', m: '0' }
  const [form, setForm] = useState({
    worker_id: initial?.worker_id || '',
    date: initial?.date || new Date().toISOString().slice(0, 10),
    type: initial?.type || 'falta',
    hours_h: initHours.h,
    hours_m: initHours.m,
    multa_amount: initial?.discount_amount && initial?.type === 'multa' ? String(initial.discount_amount) : '',
    no_marcacion_count: initial?.no_marcacion_count || 1,
    apply_discount: initial?.apply_discount !== false,
    observation: initial?.observation || '',
  })

  const worker = workers.find(w => w.id === form.worker_id)
  const isAddition = form.type === 'hora_extra'
  const hoursDecimal = (parseInt(form.hours_h) || 0) + (parseInt(form.hours_m) || 0) / 60

  const previewDiscount = useMemo(() => {
    if (!worker || !form.apply_discount) return 0
    if (form.type === 'tardanza' || form.type === 'permiso_horas') return calcLatenessDiscount(worker.base_salary, worker.weekly_hours, hoursDecimal)
    if (form.type === 'hora_extra') return calcOvertimePay(worker.base_salary, worker.weekly_hours, hoursDecimal)
    if (form.type === 'no_marcacion') return 5 * (parseInt(form.no_marcacion_count) || 1)
    if (form.type === 'multa') return parseFloat(form.multa_amount) || 0
    return calcAbsenceDiscount(worker.base_salary, worker.weekly_hours)
  }, [worker, form, hoursDecimal])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.worker_id) { toast.error('Selecciona un trabajador'); return }
    if (form.type === 'multa' && !form.observation.trim()) { toast.error('La multa requiere una nota explicativa'); return }
    await onSave({
      worker_id: form.worker_id,
      date: form.date,
      type: form.type,
      hours_late: hoursDecimal,
      no_marcacion_count: parseInt(form.no_marcacion_count) || 1,
      apply_discount: (form.type === 'multa' || form.type === 'adelanto') ? true : form.apply_discount,
      observation: form.observation,
      is_addition: isAddition,
      multa_amount: (form.type === 'multa' || form.type === 'adelanto') ? parseFloat(form.multa_amount) || 0 : undefined,
    })
    onClose()
  }

  const hasHours = form.type === 'tardanza' || form.type === 'permiso_horas' || form.type === 'hora_extra'
  const typeLabel = form.type === 'hora_extra' ? 'Horas extra' : form.type === 'permiso_horas' ? 'Horas de permiso' : 'Horas de tardanza'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Trabajador</label>
        <select className="input" value={form.worker_id} onChange={e => setForm(f => ({ ...f, worker_id: e.target.value }))} required>
          <option value="">Seleccionar...</option>
          {activeWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Fecha</label>
          <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Tipo</label>
          <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="falta">🔴 Falta injustificada</option>
            <option value="permiso">🟡 Permiso justificado (día completo)</option>
            <option value="permiso_horas">🟡 Permiso por horas</option>
            <option value="tardanza">🟠 Tardanza</option>
            <option value="hora_extra">🟢 Hora extra</option>
            <option value="no_marcacion">🔵 No marcó entrada/salida</option>
            <option value="multa">🚫 Multa</option>
            <option value="adelanto">💵 Adelanto de sueldo</option>
          </select>
        </div>
      </div>
      {hasHours && (
        <div>
          <label className="label">{typeLabel}</label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number" className="input text-center" min="0" max="23" step="1"
                value={form.hours_h}
                onChange={e => setForm(f => ({ ...f, hours_h: e.target.value }))}
                placeholder="0" required
              />
              <span className="text-sm text-gray-500 shrink-0">h</span>
            </div>
            <div className="flex items-center gap-1 flex-1">
              <select className="input text-center" value={form.hours_m} onChange={e => setForm(f => ({ ...f, hours_m: e.target.value }))}>
                <option value="0">00</option>
                <option value="15">15</option>
                <option value="30">30</option>
                <option value="45">45</option>
              </select>
              <span className="text-sm text-gray-500 shrink-0">min</span>
            </div>
          </div>
        </div>
      )}
      {form.type === 'no_marcacion' && (
        <div>
          <label className="label">¿Cuántas veces no marcó?</label>
          <input
            type="number" className="input" min="1" max="20" step="1"
            value={form.no_marcacion_count}
            onChange={e => setForm(f => ({ ...f, no_marcacion_count: e.target.value }))}
            required
          />
          <p className="text-xs text-gray-400 mt-1">
            S/ 5.00 por cada marcación no realizada · Total: <strong className="text-red-400">S/ {(5 * (parseInt(form.no_marcacion_count) || 1)).toFixed(2)}</strong>
          </p>
        </div>
      )}
      {(form.type === 'multa' || form.type === 'adelanto') && (
        <div>
          <label className="label">{form.type === 'adelanto' ? 'Monto del adelanto (S/)' : 'Monto de la multa (S/)'}</label>
          <input
            type="number" className="input" min="0" step="0.50"
            value={form.multa_amount}
            onChange={e => setForm(f => ({ ...f, multa_amount: e.target.value }))}
            placeholder="0.00" required
          />
        </div>
      )}
      {form.type !== 'multa' && form.type !== 'adelanto' && (
        <div className="flex items-center gap-2">
          <input type="checkbox" id="apply_discount" checked={form.apply_discount} onChange={e => setForm(f => ({ ...f, apply_discount: e.target.checked }))} />
          <label htmlFor="apply_discount" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">{isAddition ? 'Pagar en planilla' : 'Aplicar descuento'}</label>
        </div>
      )}
      {worker && (
        <div className={`rounded-lg p-3 text-xs ${!form.apply_discount && form.type !== 'multa' && form.type !== 'adelanto' ? 'bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700' : isAddition ? 'bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30' : 'bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30'}`}>
          <p className={!form.apply_discount && form.type !== 'multa' && form.type !== 'adelanto' ? 'text-gray-500' : isAddition ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
            {!form.apply_discount && form.type !== 'multa' && form.type !== 'adelanto'
              ? 'Sin efecto en planilla (solo registro)'
              : isAddition
                ? `Se suma a su pago: +${formatMoney(previewDiscount)}`
                : form.type === 'adelanto'
                  ? `Se descuenta del sueldo: -${formatMoney(previewDiscount)}`
                  : `Descuento: ${formatMoney(previewDiscount)}`}
          </p>
        </div>
      )}
      <div>
        <label className="label">
          {form.type === 'multa' ? <span>Motivo de la multa <span className="text-red-500">*</span></span> : 'Observación'}
        </label>
        <textarea
          className="input resize-none" rows={2}
          value={form.observation}
          onChange={e => setForm(f => ({ ...f, observation: e.target.value }))}
          placeholder={form.type === 'multa' ? 'Describe el motivo para que el trabajador lo entienda...' : 'Motivo o detalle...'}
          required={form.type === 'multa'}
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary flex-1">{initial ? 'Guardar' : 'Registrar incidencia'}</button>
      </div>
    </form>
  )
}

function monthRangeStr(year, month) {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

export default function Trabajadores() {
  const { workers, tickets, incidents, services, addWorker, updateWorker, addIncident, updateIncident, deleteIncident, addExpense } = useApp()
  const { month, year } = currentMonthYear()
  const [showWorkerForm, setShowWorkerForm] = useState(false)
  const [showIncidentForm, setShowIncidentForm] = useState(false)
  const [editingWorker, setEditingWorker] = useState(null)
  const [editingIncident, setEditingIncident] = useState(null)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [terminationDate, setTerminationDate] = useState(todayISO())
  const [deleteIncidentTarget, setDeleteIncidentTarget] = useState(null)
  const [selectedWorker, setSelectedWorker] = useState(null)
  const [incFilter, setIncFilter] = useState({ worker: '', type: '', sort: 'date_desc' })

  const monthStart = monthRangeStr(year, month)

  function leftThisMonth(w) {
    return !w.active && w.terminated_at && w.terminated_at >= monthStart
  }

  const workerStats = useMemo(() => {
    return workers
      .filter(w => w.active || leftThisMonth(w))
      .map(w => {
        const realSalary = leftThisMonth(w)
          ? calcProratedSalary(w.base_salary, w.weekly_hours, year, month, w.terminated_at, w.hire_date)
          : calcRealSalary(w.base_salary, w.weekly_hours)
        const workerTickets = tickets.filter(t => t.worker_id === w.id)
        const income = workerTickets.reduce((s, t) => s + t.price_charged, 0)
        const cars = workerTickets.length
        const workerIncidents = incidents.filter(i => i.worker_id === w.id)
        const totalDiscounts = workerIncidents.filter(i => i.apply_discount && !i.is_addition).reduce((s, i) => s + (i.discount_amount || 0), 0)
        const totalOvertime  = workerIncidents.filter(i => i.apply_discount && i.is_addition).reduce((s, i) => s + (i.discount_amount || 0), 0)
        const finalPay = realSalary - totalDiscounts + totalOvertime
        const ratio = realSalary > 0 ? income / realSalary : 0
        const daysInMonth = new Date(year, month, 0).getDate()
        const avgDaily = income / daysInMonth
        const avgPerCar = cars > 0 ? income / cars : 0

        return { ...w, realSalary, income, cars, workerIncidents, totalDiscounts, totalOvertime, finalPay, ratio, avgDaily, avgPerCar }
      })
  }, [workers, tickets, incidents, month, year])

  const chartData = workerStats.filter(w => w.active).map(w => ({ name: w.name, income: w.income, salario: w.realSalary }))

  async function handleSaveWorker(data) {
    try {
      if (editingWorker) {
        await updateWorker(editingWorker.id, data)
        toast.success('Trabajador actualizado')
      } else {
        await addWorker(data)
        toast.success('Trabajador agregado')
      }
      setEditingWorker(null)
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  async function handleToggleActive(worker) {
    try {
      if (worker.active) {
        await updateWorker(worker.id, { active: false, terminated_at: terminationDate })
        toast.success('Trabajador dado de baja')
      } else {
        await updateWorker(worker.id, { active: true, terminated_at: null })
        toast.success('Trabajador reactivado')
      }
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  async function handleSaveIncident(data) {
    try {
      if (editingIncident) {
        await updateIncident(editingIncident.id, data)
        toast.success('Incidencia actualizada')
      } else {
        await addIncident(data)
        if (data.type === 'adelanto') {
          const worker = workers.find(w => w.id === data.worker_id)
          await addExpense({
            date: data.date,
            category: 'adelanto',
            description: `Adelanto — ${worker?.name || ''}${data.observation ? ': ' + data.observation : ''}`,
            amount: parseFloat(data.multa_amount) || 0,
            worker_id: data.worker_id,
          })
        }
        toast.success('Incidencia registrada')
      }
      setEditingIncident(null)
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  async function handleDeleteIncident(id) {
    try {
      await deleteIncident(id)
      toast.success('Incidencia eliminada')
    } catch (err) {
      toast.error('Error al eliminar')
    }
  }

  const ratioColor = { verde: 'verde', amarillo: 'amarillo', rojo: 'rojo' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Equipo</h1>
          <p className="text-sm text-gray-500">{monthName(month)} {year}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm flex items-center gap-1" onClick={() => { setEditingIncident(null); setShowIncidentForm(true) }}>
            <AlertCircle className="w-4 h-4" /> Incidencia
          </button>
          <button className="btn-primary text-sm flex items-center gap-1" onClick={() => { setEditingWorker(null); setShowWorkerForm(true) }}>
            <Plus className="w-4 h-4" /> Trabajador
          </button>
        </div>
      </div>

      {/* Tabla comparativa */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-100 dark:border-gray-800">
              <th className="text-left py-2 pr-4">Trabajador</th>
              <th className="text-right py-2 px-2">Ingresos</th>
              <th className="text-right py-2 px-2">Carros</th>
              <th className="text-right py-2 px-2">Prom/día</th>
              <th className="text-right py-2 px-2">Salario real</th>
              <th className="text-right py-2 px-2">Descuentos</th>
              <th className="text-right py-2 px-2">Extra</th>
              <th className="text-right py-2 px-2">Pago final</th>
              <th className="text-center py-2 px-2">Ratio</th>
              <th className="text-center py-2 px-2">Incidencias</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {workerStats.map(w => {
              const rc = getRatioColor(w.ratio)
              return (
                <tr key={w.id} className={`${!w.active ? 'opacity-50' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/50`}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 font-bold text-xs">
                        {w.name[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{w.name}</p>
                        <p className="text-xs text-gray-400">
                          {w.weekly_hours}h/sem
                          {leftThisMonth(w) && <span className="text-amber-500"> · Se retiró el {formatDate(w.terminated_at)}</span>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-2 font-semibold text-gray-900 dark:text-white">{formatMoney(w.income)}</td>
                  <td className="text-right px-2 text-gray-600 dark:text-gray-400">{w.cars}</td>
                  <td className="text-right px-2 text-gray-600 dark:text-gray-400">{formatMoney(w.avgDaily)}</td>
                  <td className="text-right px-2 text-gray-600 dark:text-gray-400">{formatMoney(w.realSalary)}</td>
                  <td className="text-right px-2 text-red-500">{w.totalDiscounts > 0 ? `-${formatMoney(w.totalDiscounts)}` : '—'}</td>
                  <td className="text-right px-2 text-green-600">{w.totalOvertime > 0 ? `+${formatMoney(w.totalOvertime)}` : '—'}</td>
                  <td className="text-right px-2 font-semibold text-gray-900 dark:text-white">{formatMoney(w.finalPay)}</td>
                  <td className="text-center px-2">
                    <Badge variant={ratioColor[rc]}>{w.ratio.toFixed(1)}x</Badge>
                  </td>
                  <td className="text-center px-2">
                    <span className="text-sm">
                      {w.workerIncidents.map(i => INCIDENT_ICONS[i.type]).join(' ') || '—'}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditingWorker(w); setShowWorkerForm(true) }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                        <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                      <button onClick={() => { setTerminationDate(todayISO()); setDeactivateTarget(w) }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                        {w.active ? <UserX className="w-3.5 h-3.5 text-gray-400" /> : <UserCheck className="w-3.5 h-3.5 text-green-500" />}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Gráfico comparativo */}
      {chartData.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-bold text-gray-900 dark:text-white">Ingresos generados vs salario real</p>
          </div>
          <p className="text-xs text-gray-400 mb-4">Comparación por trabajador activo este mes</p>
          <div className="overflow-x-auto -mx-4 px-4">
            <div style={{ minWidth: Math.max(chartData.length * 100, 320) }} className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }} barCategoryGap="30%" barGap={4}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
                      <stop offset="100%" stopColor="#ea580c" stopOpacity={0.9} />
                    </linearGradient>
                    <linearGradient id="salarioGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.75} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => v >= 1000 ? `S/${(v/1000).toFixed(1)}k` : `S/${v}`} axisLine={false} tickLine={false} width={52} />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 6 }}
                    contentStyle={{ borderRadius: 14, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', fontSize: 12, padding: '10px 16px' }}
                    formatter={(v, name) => [formatMoney(v), name]}
                    labelStyle={{ fontWeight: 700, marginBottom: 4, color: '#111827' }}
                  />
                  <Legend
                    iconType="circle" iconSize={8}
                    formatter={v => <span style={{ fontSize: 11, color: '#6b7280' }}>{v}</span>}
                    wrapperStyle={{ paddingTop: 12 }}
                  />
                  <Bar dataKey="income" fill="url(#incomeGrad)" radius={[6, 6, 2, 2]} maxBarSize={36} name="Ingresos generados" />
                  <Bar dataKey="salario" fill="url(#salarioGrad)" radius={[6, 6, 2, 2]} maxBarSize={36} name="Salario real" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Lista de incidencias del mes */}
      {incidents.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Incidencias del mes
              <span className="ml-2 text-xs font-normal text-gray-400">{incidents.length} total</span>
            </p>
            {(incFilter.worker || incFilter.type || incFilter.sort !== 'date_desc') && (
              <button onClick={() => setIncFilter({ worker: '', type: '', sort: 'date_desc' })}
                className="text-xs text-red-500 hover:underline">Limpiar filtros</button>
            )}
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2 mb-4">
            <select value={incFilter.worker} onChange={e => setIncFilter(f => ({ ...f, worker: e.target.value }))}
              className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-red-500">
              <option value="">Todos los trabajadores</option>
              {workers.filter(w => incidents.some(i => i.worker_id === w.id)).map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>

            <select value={incFilter.type} onChange={e => setIncFilter(f => ({ ...f, type: e.target.value }))}
              className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-red-500">
              <option value="">Todos los tipos</option>
              {[...new Set(incidents.map(i => i.type))].map(t => (
                <option key={t} value={t}>{INCIDENT_LABELS[t]}</option>
              ))}
            </select>

            <select value={incFilter.sort} onChange={e => setIncFilter(f => ({ ...f, sort: e.target.value }))}
              className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-red-500">
              <option value="date_desc">Más reciente primero</option>
              <option value="date_asc">Más antiguo primero</option>
              <option value="worker">Por trabajador</option>
              <option value="amount_desc">Mayor monto primero</option>
              <option value="amount_asc">Menor monto primero</option>
            </select>
          </div>

          <div className="space-y-2">
            {[...incidents]
              .filter(i => (!incFilter.worker || i.worker_id === incFilter.worker) && (!incFilter.type || i.type === incFilter.type))
              .sort((a, b) => {
                if (incFilter.sort === 'date_asc')    return a.date.localeCompare(b.date)
                if (incFilter.sort === 'date_desc')   return b.date.localeCompare(a.date)
                if (incFilter.sort === 'worker')      return (workers.find(w => w.id === a.worker_id)?.name || '').localeCompare(workers.find(w => w.id === b.worker_id)?.name || '')
                if (incFilter.sort === 'amount_desc') return (b.discount_amount || 0) - (a.discount_amount || 0)
                if (incFilter.sort === 'amount_asc')  return (a.discount_amount || 0) - (b.discount_amount || 0)
                return 0
              })
              .map(incident => {
              const worker = workers.find(w => w.id === incident.worker_id)
              return (
                <div key={incident.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <span className="text-lg">{INCIDENT_ICONS[incident.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{worker?.name} — {INCIDENT_LABELS[incident.type]}</p>
                    <p className="text-xs text-gray-500">{formatDate(incident.date)}{incident.hours_late ? ` · ${Math.floor(incident.hours_late)}h ${Math.round((incident.hours_late % 1) * 60)}min` : ''}</p>
                    {incident.observation && <p className="text-xs text-gray-400 italic mt-0.5">{incident.observation}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {incident.apply_discount
                      ? <span className={`text-xs font-semibold ${incident.is_addition ? 'text-green-600' : 'text-red-500'}`}>{incident.is_addition ? '+' : '-'}{formatMoney(incident.discount_amount)}</span>
                      : <Badge variant="gray">Sin efecto</Badge>
                    }
                    <button onClick={() => { setEditingIncident(incident); setShowIncidentForm(true) }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                      <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button onClick={() => setDeleteIncidentTarget(incident.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                      <Clock className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal open={showWorkerForm} onClose={() => { setShowWorkerForm(false); setEditingWorker(null) }} title={editingWorker ? 'Editar trabajador' : 'Nuevo trabajador'}>
        <WorkerForm initial={editingWorker} onSave={handleSaveWorker} onClose={() => { setShowWorkerForm(false); setEditingWorker(null) }} />
      </Modal>

      <Modal open={showIncidentForm} onClose={() => { setShowIncidentForm(false); setEditingIncident(null) }} title={editingIncident ? 'Editar incidencia' : 'Registrar incidencia'}>
        <IncidentForm workers={workers} onSave={handleSaveIncident} onClose={() => { setShowIncidentForm(false); setEditingIncident(null) }} initial={editingIncident} />
      </Modal>

      {deactivateTarget?.active ? (
        <Modal open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} title="¿Dar de baja?" size="sm">
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            {deactivateTarget?.name} quedará inactivo. Su pago de este mes se calculará solo por los días que trabajó.
          </p>
          <div className="mb-6">
            <label className="label">Fecha de salida</label>
            <input type="date" className="input" value={terminationDate} onChange={e => setTerminationDate(e.target.value)} max={todayISO()} />
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-secondary" onClick={() => setDeactivateTarget(null)}>Cancelar</button>
            <button className="btn-danger" onClick={() => { handleToggleActive(deactivateTarget); setDeactivateTarget(null) }}>Dar de baja</button>
          </div>
        </Modal>
      ) : (
        <ConfirmDialog
          open={!!deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onConfirm={() => handleToggleActive(deactivateTarget)}
          title="¿Reactivar trabajador?"
          message={`${deactivateTarget?.name} volverá a aparecer en los registros.`}
          confirmLabel="Reactivar"
          variant="primary"
        />
      )}

      <ConfirmDialog
        open={!!deleteIncidentTarget}
        onClose={() => setDeleteIncidentTarget(null)}
        onConfirm={() => handleDeleteIncident(deleteIncidentTarget)}
        title="¿Eliminar incidencia?"
        message="Se eliminará el registro y el descuento asociado."
        confirmLabel="Eliminar"
      />
    </div>
  )
}
