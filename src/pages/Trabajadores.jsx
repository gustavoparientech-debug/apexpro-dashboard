import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import {
  formatMoney, formatDate, calcRealSalary, calcDailySalary,
  calcAbsenceDiscount, calcLatenessDiscount, getRatioColor, currentMonthYear, monthName
} from '../lib/utils'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Badge from '../components/ui/Badge'
import { Plus, Edit2, UserX, UserCheck, AlertCircle, Clock, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const INCIDENT_ICONS = { falta: '🔴', permiso: '🟡', tardanza: '🟠', no_marcacion: '🔵' }
const INCIDENT_LABELS = { falta: 'Falta injustificada', permiso: 'Permiso justificado', tardanza: 'Tardanza', no_marcacion: 'No marcó entrada/salida' }

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

function IncidentForm({ workers, onSave, onClose, initial }) {
  const activeWorkers = workers.filter(w => w.active)
  const [form, setForm] = useState({
    worker_id: initial?.worker_id || '',
    date: initial?.date || new Date().toISOString().slice(0, 10),
    type: initial?.type || 'falta',
    hours_late: initial?.hours_late || '',
    no_marcacion_count: initial?.no_marcacion_count || 1,
    apply_discount: initial?.apply_discount !== false,
    observation: initial?.observation || '',
  })

  const worker = workers.find(w => w.id === form.worker_id)
  const previewDiscount = useMemo(() => {
    if (!worker || !form.apply_discount) return 0
    if (form.type === 'tardanza') return calcLatenessDiscount(worker.base_salary, worker.weekly_hours, parseFloat(form.hours_late) || 0)
    if (form.type === 'no_marcacion') return 5 * (parseInt(form.no_marcacion_count) || 1)
    return calcAbsenceDiscount(worker.base_salary, worker.weekly_hours)
  }, [worker, form])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.worker_id) { toast.error('Selecciona un trabajador'); return }
    await onSave({
      ...form,
      hours_late: parseFloat(form.hours_late) || 0,
      no_marcacion_count: parseInt(form.no_marcacion_count) || 1,
    })
    onClose()
  }

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
            <option value="falta">Falta injustificada</option>
            <option value="permiso">Permiso justificado</option>
            <option value="tardanza">Tardanza</option>
            <option value="no_marcacion">No marcó entrada/salida</option>
          </select>
        </div>
      </div>
      {form.type === 'tardanza' && (
        <div>
          <label className="label">Horas de tardanza</label>
          <input type="number" className="input" min="0.25" step="0.25" max="8" value={form.hours_late} onChange={e => setForm(f => ({ ...f, hours_late: e.target.value }))} placeholder="1.5" required />
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
      <div className="flex items-center gap-2">
        <input type="checkbox" id="apply_discount" checked={form.apply_discount} onChange={e => setForm(f => ({ ...f, apply_discount: e.target.checked }))} />
        <label htmlFor="apply_discount" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">Aplicar descuento</label>
      </div>
      {worker && (
        <div className={`rounded-lg p-3 text-xs ${form.apply_discount ? 'bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30' : 'bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700'}`}>
          <p className={form.apply_discount ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}>
            {form.apply_discount ? `Descuento: ${formatMoney(previewDiscount)}` : 'Sin descuento (solo registro)'}
          </p>
        </div>
      )}
      <div>
        <label className="label">Observación</label>
        <textarea className="input resize-none" rows={2} value={form.observation} onChange={e => setForm(f => ({ ...f, observation: e.target.value }))} placeholder="Motivo o detalle..." />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary flex-1">{initial ? 'Guardar' : 'Registrar incidencia'}</button>
      </div>
    </form>
  )
}

export default function Trabajadores() {
  const { workers, tickets, incidents, services, addWorker, updateWorker, addIncident, updateIncident, deleteIncident } = useApp()
  const { month, year } = currentMonthYear()
  const [showWorkerForm, setShowWorkerForm] = useState(false)
  const [showIncidentForm, setShowIncidentForm] = useState(false)
  const [editingWorker, setEditingWorker] = useState(null)
  const [editingIncident, setEditingIncident] = useState(null)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [deleteIncidentTarget, setDeleteIncidentTarget] = useState(null)
  const [selectedWorker, setSelectedWorker] = useState(null)

  const workerStats = useMemo(() => {
    return workers.map(w => {
      const realSalary = calcRealSalary(w.base_salary, w.weekly_hours)
      const workerTickets = tickets.filter(t => t.worker_id === w.id)
      const income = workerTickets.reduce((s, t) => s + t.price_charged, 0)
      const cars = workerTickets.length
      const workerIncidents = incidents.filter(i => i.worker_id === w.id)
      const totalDiscounts = workerIncidents.filter(i => i.apply_discount).reduce((s, i) => s + (i.discount_amount || 0), 0)
      const finalPay = realSalary - totalDiscounts
      const ratio = realSalary > 0 ? income / realSalary : 0
      const daysInMonth = new Date(year, month, 0).getDate()
      const avgDaily = income / daysInMonth
      const avgPerCar = cars > 0 ? income / cars : 0

      return { ...w, realSalary, income, cars, workerIncidents, totalDiscounts, finalPay, ratio, avgDaily, avgPerCar }
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
      await updateWorker(worker.id, { active: !worker.active })
      toast.success(worker.active ? 'Trabajador dado de baja' : 'Trabajador reactivado')
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
                        <p className="text-xs text-gray-400">{w.weekly_hours}h/sem</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-2 font-semibold text-gray-900 dark:text-white">{formatMoney(w.income)}</td>
                  <td className="text-right px-2 text-gray-600 dark:text-gray-400">{w.cars}</td>
                  <td className="text-right px-2 text-gray-600 dark:text-gray-400">{formatMoney(w.avgDaily)}</td>
                  <td className="text-right px-2 text-gray-600 dark:text-gray-400">{formatMoney(w.realSalary)}</td>
                  <td className="text-right px-2 text-red-500">{w.totalDiscounts > 0 ? `-${formatMoney(w.totalDiscounts)}` : '—'}</td>
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
                      <button onClick={() => setDeactivateTarget(w)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
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
        <div className="card">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Ingresos generados vs salario real</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `S/${(v/1000).toFixed(1)}k`} />
                <Tooltip formatter={v => formatMoney(v)} />
                <Bar dataKey="income" fill="#f97316" radius={[3, 3, 0, 0]} name="Ingresos generados" />
                <Bar dataKey="salario" fill="#94a3b8" radius={[3, 3, 0, 0]} name="Salario real" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Lista de incidencias del mes */}
      {incidents.length > 0 && (
        <div className="card">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Incidencias del mes</p>
          <div className="space-y-2">
            {incidents.map(incident => {
              const worker = workers.find(w => w.id === incident.worker_id)
              return (
                <div key={incident.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <span className="text-lg">{INCIDENT_ICONS[incident.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{worker?.name} — {INCIDENT_LABELS[incident.type]}</p>
                    <p className="text-xs text-gray-500">{formatDate(incident.date)}{incident.hours_late ? ` · ${incident.hours_late}h tarde` : ''}</p>
                    {incident.observation && <p className="text-xs text-gray-400 italic mt-0.5">{incident.observation}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {incident.apply_discount
                      ? <span className="text-xs font-semibold text-red-500">-{formatMoney(incident.discount_amount)}</span>
                      : <Badge variant="gray">Sin desc.</Badge>
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

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => handleToggleActive(deactivateTarget)}
        title={deactivateTarget?.active ? '¿Dar de baja?' : '¿Reactivar trabajador?'}
        message={deactivateTarget?.active
          ? `${deactivateTarget?.name} quedará inactivo pero su historial se conserva.`
          : `${deactivateTarget?.name} volverá a aparecer en los registros.`}
        confirmLabel={deactivateTarget?.active ? 'Dar de baja' : 'Reactivar'}
        variant={deactivateTarget?.active ? 'danger' : 'primary'}
      />

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
