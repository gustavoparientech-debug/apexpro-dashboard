import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { formatMoney, formatDate, todayISO } from '../lib/utils'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Badge from '../components/ui/Badge'
import { Plus, Edit2, Trash2, Car, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

const VEHICLE_LABELS = { auto: 'Auto', suv: 'SUV', camioneta: 'Camioneta', pickup: 'Pick-up' }
const PAYMENT_LABELS = { efectivo: 'Efectivo', yape: 'Yape' }
const CATEGORY_COLORS = { basico: 'gray', ceramico: 'blue', polarizado: 'purple', ppf: 'orange' }
const CATEGORY_LABELS = { basico: 'Básico', ceramico: 'Cerámico', polarizado: 'Polarizado', ppf: 'PPF' }

function TicketForm({ initial, onSave, onClose, workers, services }) {
  const [form, setForm] = useState({
    date: initial?.date || todayISO(),
    worker_id: initial?.worker_id || '',
    service_id: initial?.service_id || '',
    price_charged: initial?.price_charged || '',
    vehicle_type: initial?.vehicle_type || 'auto',
    payment_method: initial?.payment_method || 'efectivo',
    notes: initial?.notes || '',
  })

  const selectedService = services.find(s => s.id === form.service_id)

  function handleServiceChange(id) {
    const svc = services.find(s => s.id === id)
    setForm(f => ({ ...f, service_id: id, price_charged: svc ? svc.min_price : f.price_charged }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.worker_id || !form.service_id || !form.price_charged) {
      toast.error('Completa todos los campos requeridos')
      return
    }
    await onSave({ ...form, price_charged: parseFloat(form.price_charged) })
    onClose()
  }

  const activeWorkers = workers.filter(w => w.active)
  const activeServices = services.filter(s => s.active)
  const grouped = activeServices.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Fecha</label>
          <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Trabajador</label>
          <select className="input" value={form.worker_id} onChange={e => setForm(f => ({ ...f, worker_id: e.target.value }))} required>
            <option value="">Seleccionar...</option>
            {activeWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Servicio</label>
        <select className="input" value={form.service_id} onChange={e => handleServiceChange(e.target.value)} required>
          <option value="">Seleccionar servicio...</option>
          {Object.entries(grouped).map(([cat, svcs]) => (
            <optgroup key={cat} label={`— ${CATEGORY_LABELS[cat] || cat} —`}>
              {svcs.map(s => (
                <option key={s.id} value={s.id}>{s.name} (S/{s.min_price}–{s.max_price})</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Precio cobrado (S/)</label>
          <input
            type="number" className="input" min="0" step="0.50"
            value={form.price_charged}
            onChange={e => setForm(f => ({ ...f, price_charged: e.target.value }))}
            placeholder={selectedService ? `Min: ${selectedService.min_price}` : '0.00'}
            required
          />
          {selectedService && (
            <p className="text-xs text-gray-400 mt-1">Rango: S/{selectedService.min_price} – S/{selectedService.max_price}</p>
          )}
        </div>
        <div>
          <label className="label">Tipo de vehículo</label>
          <select className="input" value={form.vehicle_type} onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}>
            {Object.entries(VEHICLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Método de cobro</label>
        <div className="flex gap-3">
          {Object.entries(PAYMENT_LABELS).map(([v, l]) => (
            <label key={v} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="payment" value={v} checked={form.payment_method === v} onChange={() => setForm(f => ({ ...f, payment_method: v }))} />
              <span className="text-sm text-gray-700 dark:text-gray-300">{l}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Notas (opcional)</label>
        <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observaciones..." />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary flex-1">{initial ? 'Guardar cambios' : 'Registrar ticket'}</button>
      </div>
    </form>
  )
}

function QuickSummaryForm({ onSave, onClose }) {
  const [form, setForm] = useState({ date: todayISO(), total_income: '', notes: '' })

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.total_income) { toast.error('Ingresa el total del día'); return }
    await onSave({ ...form, total_income: parseFloat(form.total_income) })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Fecha</label>
        <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
      </div>
      <div>
        <label className="label">Total del día (S/)</label>
        <input type="number" className="input" min="0" step="0.50" value={form.total_income} onChange={e => setForm(f => ({ ...f, total_income: e.target.value }))} placeholder="0.00" required />
      </div>
      <div>
        <label className="label">Notas (opcional)</label>
        <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Descripción rápida..." />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary flex-1">Registrar</button>
      </div>
    </form>
  )
}

export default function Registro() {
  const { tickets, dailySummaries, workers, services, addTicket, updateTicket, deleteTicket, addDailySummary, deleteDailySummary } = useApp()
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [showQuickForm, setShowQuickForm] = useState(false)
  const [editingTicket, setEditingTicket] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const dayTickets = useMemo(() =>
    tickets.filter(t => t.date === selectedDate), [tickets, selectedDate])

  const daySummaries = useMemo(() =>
    dailySummaries.filter(d => d.date === selectedDate), [dailySummaries, selectedDate])

  const dayTotal = useMemo(() =>
    dayTickets.reduce((s, t) => s + t.price_charged, 0) +
    daySummaries.reduce((s, d) => s + d.total_income, 0),
    [dayTickets, daySummaries])

  async function handleSaveTicket(data) {
    try {
      if (editingTicket) {
        await updateTicket(editingTicket.id, data)
        toast.success('Ticket actualizado')
      } else {
        await addTicket(data)
        toast.success('Ticket registrado')
      }
      setEditingTicket(null)
    } catch (err) {
      toast.error('Error al guardar: ' + err.message)
    }
  }

  async function handleDeleteTicket(id) {
    try {
      await deleteTicket(id)
      toast.success('Ticket eliminado')
    } catch (err) {
      toast.error('Error al eliminar')
    }
  }

  async function handleSaveSummary(data) {
    try {
      await addDailySummary(data)
      toast.success('Ingreso registrado')
    } catch (err) {
      toast.error('Error al guardar')
    }
  }

  async function handleDeleteSummary(id) {
    try {
      await deleteDailySummary(id)
      toast.success('Eliminado')
    } catch (err) {
      toast.error('Error al eliminar')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Registro Diario</h1>
      </div>

      {/* Selector de fecha */}
      <div className="card flex items-center gap-4">
        <div className="flex-1">
          <label className="label">Fecha</label>
          <input type="date" className="input" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
        </div>
        <div className="text-right pt-5">
          <p className="text-xs text-gray-500">Total del día</p>
          <p className="text-xl font-bold text-orange-500">{formatMoney(dayTotal)}</p>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex gap-3">
        <button className="btn-primary flex items-center gap-2 flex-1" onClick={() => { setEditingTicket(null); setShowTicketForm(true) }}>
          <Plus className="w-4 h-4" />
          Ticket detallado
        </button>
        <button className="btn-secondary flex items-center gap-2 flex-1" onClick={() => setShowQuickForm(true)}>
          <Zap className="w-4 h-4" />
          Ingreso rápido
        </button>
      </div>

      {/* Lista de tickets del día */}
      {dayTickets.length === 0 && daySummaries.length === 0 ? (
        <div className="card text-center py-10">
          <Car className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400">No hay registros para esta fecha</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dayTickets.map(ticket => {
            const worker = workers.find(w => w.id === ticket.worker_id)
            const service = services.find(s => s.id === ticket.service_id)
            return (
              <div key={ticket.id} className="card flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-900 dark:text-white text-sm">{service?.name || 'Servicio'}</span>
                    <Badge variant={CATEGORY_COLORS[service?.category] || 'gray'}>
                      {CATEGORY_LABELS[service?.category] || service?.category}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                    <span>{worker?.name || '—'}</span>
                    <span>·</span>
                    <span>{VEHICLE_LABELS[ticket.vehicle_type]}</span>
                    <span>·</span>
                    <span>{PAYMENT_LABELS[ticket.payment_method]}</span>
                  </div>
                  {ticket.notes && <p className="text-xs text-gray-400 mt-1 italic">{ticket.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-orange-500">{formatMoney(ticket.price_charged)}</span>
                  <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" onClick={() => { setEditingTicket(ticket); setShowTicketForm(true) }}>
                    <Edit2 className="w-4 h-4 text-gray-400" />
                  </button>
                  <button className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" onClick={() => setDeleteTarget({ type: 'ticket', id: ticket.id })}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            )
          })}

          {daySummaries.map(summary => (
            <div key={summary.id} className="card flex items-start gap-3 border-dashed border-gray-200 dark:border-gray-700">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">Ingreso rápido del día</span>
                  <Badge variant="gray">Sin detalle</Badge>
                </div>
                {summary.notes && <p className="text-xs text-gray-400 italic">{summary.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-orange-500">{formatMoney(summary.total_income)}</span>
                <button className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" onClick={() => setDeleteTarget({ type: 'summary', id: summary.id })}>
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          ))}

          {/* Total del día */}
          <div className="flex justify-end pt-2">
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl px-4 py-2 border border-orange-100 dark:border-orange-900/30">
              <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">Total del día: </span>
              <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatMoney(dayTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal
        open={showTicketForm}
        onClose={() => { setShowTicketForm(false); setEditingTicket(null) }}
        title={editingTicket ? 'Editar ticket' : 'Nuevo ticket'}
      >
        <TicketForm
          initial={editingTicket}
          onSave={handleSaveTicket}
          onClose={() => { setShowTicketForm(false); setEditingTicket(null) }}
          workers={workers}
          services={services}
        />
      </Modal>

      <Modal open={showQuickForm} onClose={() => setShowQuickForm(false)} title="Ingreso rápido del día">
        <QuickSummaryForm onSave={handleSaveSummary} onClose={() => setShowQuickForm(false)} />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget?.type === 'ticket') handleDeleteTicket(deleteTarget.id)
          else if (deleteTarget?.type === 'summary') handleDeleteSummary(deleteTarget.id)
        }}
        title="¿Eliminar registro?"
        message="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
      />
    </div>
  )
}
