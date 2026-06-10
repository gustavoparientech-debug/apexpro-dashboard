import { useState, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { formatMoney, formatDate, todayISO } from '../lib/utils'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Badge from '../components/ui/Badge'
import { Plus, Edit2, Trash2, Car, Zap, Camera, Search, X, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

const PAYMENT_OPTIONS = [
  { value: 'efectivo', label: '💵 Efectivo' },
  { value: 'yape',     label: '📱 Yape' },
  { value: 'transferencia', label: '🏦 Transferencia' },
]

const CATEGORY_LABELS = { basico: 'Básico', ceramico: 'Cerámico', polarizado: 'Polarizado', ppf: 'PPF' }
const CATEGORY_COLORS = {
  basico:     'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
  ceramico:   'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  polarizado: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  ppf:        'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
}
const BADGE_COLORS = { basico: 'gray', ceramico: 'blue', polarizado: 'purple', ppf: 'orange' }

// ─── Ticket Form (nuevo diseño visual) ───────────────────────────────────────
function TicketForm({ initial, onSave, onClose, workers, services, vehicleTypes }) {
  const [form, setForm] = useState({
    date:           initial?.date           || todayISO(),
    worker_id:      initial?.worker_id      || '',
    service_id:     initial?.service_id     || '',
    price_charged:  initial?.price_charged  || '',
    vehicle_type:   initial?.vehicle_type   || '',
    payment_method: initial?.payment_method || 'efectivo',
    notes:          initial?.notes          || '',
    plate:          initial?.plate          || '',
    photo_url:      initial?.photo_url      || '',
  })
  const [photoPreview, setPhotoPreview] = useState(initial?.photo_url || '')
  const [expandedCat, setExpandedCat] = useState(null)
  const fileRef = useRef()

  const activeWorkers  = workers.filter(w => w.active)
  const activeServices = services.filter(s => s.active)
  const grouped = activeServices.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})

  const selectedService = services.find(s => s.id === form.service_id)
  const selectedWorker  = workers.find(w => w.id === form.worker_id)
  const selectedVehicle = (vehicleTypes || []).find(v => v.value === form.vehicle_type)

  function handlePhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setPhotoPreview(ev.target.result)
      setForm(f => ({ ...f, photo_url: ev.target.result }))
    }
    reader.readAsDataURL(file)
  }

  function handleVehicleSelect(vt) {
    setForm(f => ({
      ...f,
      vehicle_type: vt.value,
      // auto-fill price only if no service selected yet
      price_charged: f.service_id ? f.price_charged : (vt.default_price || f.price_charged),
    }))
  }

  function handleServiceSelect(svc) {
    setForm(f => ({ ...f, service_id: svc.id, price_charged: svc.min_price }))
    setExpandedCat(null)
  }

  // Validaciones
  const missing = []
  if (!form.plate) missing.push('placa')
  if (!form.vehicle_type) missing.push('tipo de vehículo')
  if (!form.worker_id) missing.push('lavador')
  if (!form.service_id) missing.push('servicio')

  async function handleSubmit() {
    if (missing.length > 0) { toast.error('Completa: ' + missing.join(' · ')); return }
    await onSave({ ...form, price_charged: parseFloat(form.price_charged) || 0 })
    onClose()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scroll area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">

        {/* Fecha */}
        <div>
          <label className="label">Fecha</label>
          <input type="date" className="input" value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>

        {/* Foto de placa */}
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Foto de placa</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={handlePhoto} />
          {photoPreview ? (
            <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <img src={photoPreview} alt="placa" className="w-full h-40 object-cover" />
              <button onClick={() => { setPhotoPreview(''); setForm(f => ({ ...f, photo_url: '' })) }}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current.click()}
              className="w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-orange-400 hover:text-orange-400 transition-colors">
              <Camera className="w-8 h-8" />
              <span className="text-sm">Tomar foto de placa</span>
            </button>
          )}
        </div>

        {/* Placa */}
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Placa</p>
          <div className="relative">
            <input
              className="input pr-10 uppercase tracking-widest font-mono text-lg"
              placeholder="AAA-123"
              value={form.plate}
              onChange={e => setForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))}
              maxLength={8}
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Tipo de vehículo */}
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Tipo de vehículo</p>
          <div className="grid grid-cols-2 gap-2">
            {(vehicleTypes || []).map(v => (
              <button key={v.value} type="button"
                onClick={() => handleVehicleSelect(v)}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-sm font-medium transition-all ${
                  form.vehicle_type === v.value
                    ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                }`}>
                <span className="text-xl">{v.emoji}</span>
                <div className="flex-1 text-left">
                  <span className="block">{v.label}</span>
                  {v.default_price > 0 && <span className="text-xs opacity-60">S/ {v.default_price}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Servicio */}
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Servicio</p>
          <div className="space-y-2">
            {Object.entries(grouped).map(([cat, svcs]) => (
              <div key={cat} className={`rounded-2xl border overflow-hidden ${CATEGORY_COLORS[cat]} border-transparent`}>
                <button type="button"
                  onClick={() => setExpandedCat(expandedCat === cat ? null : cat)}
                  className="w-full flex items-center justify-between px-4 py-3">
                  <span className="font-semibold text-sm">{CATEGORY_LABELS[cat] || cat}</span>
                  {expandedCat === cat ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {expandedCat === cat && (
                  <div className="px-2 pb-2 space-y-1">
                    {svcs.map(svc => (
                      <button key={svc.id} type="button"
                        onClick={() => handleServiceSelect(svc)}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all ${
                          form.service_id === svc.id
                            ? 'bg-orange-500 text-white font-medium'
                            : 'bg-white/60 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-700'
                        }`}>
                        <span className="block font-medium">{svc.name}</span>
                        <span className="text-xs opacity-70">S/ {svc.min_price} – {svc.max_price}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {selectedService && (
            <div className="mt-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">✓ {selectedService.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500">Precio:</span>
                <input
                  type="number" min="0" step="0.5"
                  className="input py-1 text-sm flex-1"
                  value={form.price_charged}
                  onChange={e => setForm(f => ({ ...f, price_charged: e.target.value }))}
                  placeholder={`Min: ${selectedService.min_price}`}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Rango: S/{selectedService.min_price} – S/{selectedService.max_price}</p>
            </div>
          )}
        </div>

        {/* Lavador */}
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Lavador</p>
          <div className="grid grid-cols-2 gap-2">
            {activeWorkers.map(w => (
              <button key={w.id} type="button"
                onClick={() => setForm(f => ({ ...f, worker_id: w.id }))}
                className={`py-3 px-4 rounded-2xl border text-sm font-medium transition-all ${
                  form.worker_id === w.id
                    ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                }`}>
                {w.name}
              </button>
            ))}
          </div>
        </div>

        {/* Método de pago */}
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Método de cobro</p>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_OPTIONS.map(p => (
              <button key={p.value} type="button"
                onClick={() => setForm(f => ({ ...f, payment_method: p.value }))}
                className={`py-3 rounded-2xl border text-sm font-medium transition-all ${
                  form.payment_method === p.value
                    ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notas */}
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Notas (opcional)</p>
          <textarea className="input resize-none" rows={2}
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Observaciones del vehículo..." />
        </div>
      </div>

      {/* Footer fijo */}
      <div className="px-4 pt-3 pb-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        {missing.length > 0 && (
          <p className="text-xs text-gray-400 text-center mb-2">Falta: {missing.join(' · ')}</p>
        )}
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-none px-4" onClick={onClose}>Cancelar</button>
          <button type="button" onClick={handleSubmit}
            disabled={missing.length > 0}
            className={`flex-1 py-3 rounded-2xl font-bold text-white text-base transition-all ${
              missing.length === 0
                ? 'bg-orange-500 hover:bg-orange-600 active:scale-95'
                : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
            }`}>
            {initial ? 'Guardar cambios' : 'Abrir ticket'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Quick Summary Form ───────────────────────────────────────────────────────
function QuickSummaryForm({ onSave, onClose }) {
  const [form, setForm] = useState({ date: todayISO(), total_income: '', notes: '' })

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.total_income) { toast.error('Ingresa el total del día'); return }
    await onSave({ ...form, total_income: parseFloat(form.total_income) })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4">
      <div>
        <label className="label">Fecha</label>
        <input type="date" className="input" value={form.date}
          onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
      </div>
      <div>
        <label className="label">Total del día (S/)</label>
        <input type="number" className="input" min="0" step="0.50"
          value={form.total_income}
          onChange={e => setForm(f => ({ ...f, total_income: e.target.value }))}
          placeholder="0.00" required />
      </div>
      <div>
        <label className="label">Notas (opcional)</label>
        <textarea className="input resize-none" rows={2} value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Descripción rápida..." />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary flex-1">Registrar</button>
      </div>
    </form>
  )
}

// ─── Bottom Sheet Modal ───────────────────────────────────────────────────────
function BottomSheet({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 mb-1">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
const PAYMENT_LABELS = { efectivo: '💵 Efectivo', yape: '📱 Yape', transferencia: '🏦 Transferencia' }

export default function Registro() {
  const { tickets, dailySummaries, workers, services, vehicleTypes, addTicket, updateTicket, deleteTicket, addDailySummary, deleteDailySummary } = useApp()
  const vehicleLabels = useMemo(() => Object.fromEntries((vehicleTypes || []).map(v => [v.value, `${v.emoji} ${v.label}`])), [vehicleTypes])
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [showQuickForm, setShowQuickForm]   = useState(false)
  const [editingTicket, setEditingTicket]   = useState(null)
  const [deleteTarget, setDeleteTarget]     = useState(null)

  const dayTickets   = useMemo(() => tickets.filter(t => t.date === selectedDate),       [tickets, selectedDate])
  const daySummaries = useMemo(() => dailySummaries.filter(d => d.date === selectedDate), [dailySummaries, selectedDate])
  const dayTotal     = useMemo(() =>
    dayTickets.reduce((s, t) => s + t.price_charged, 0) +
    daySummaries.reduce((s, d) => s + d.total_income, 0),
    [dayTickets, daySummaries])

  async function handleSaveTicket(data) {
    try {
      if (editingTicket) { await updateTicket(editingTicket.id, data); toast.success('Ticket actualizado') }
      else               { await addTicket(data);                      toast.success('¡Ticket registrado!') }
      setEditingTicket(null)
    } catch (err) { toast.error('Error: ' + err.message) }
  }

  async function handleDeleteTicket(id) {
    try { await deleteTicket(id); toast.success('Eliminado') }
    catch { toast.error('Error al eliminar') }
  }

  async function handleSaveSummary(data) {
    try { await addDailySummary(data); toast.success('Ingreso registrado') }
    catch { toast.error('Error al guardar') }
  }

  async function handleDeleteSummary(id) {
    try { await deleteDailySummary(id); toast.success('Eliminado') }
    catch { toast.error('Error al eliminar') }
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Registro Diario</h1>
      </div>

      {/* Selector de fecha + total */}
      <div className="card flex items-center gap-4">
        <div className="flex-1">
          <label className="label">Fecha</label>
          <input type="date" className="input" value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)} />
        </div>
        <div className="text-right pt-5">
          <p className="text-xs text-gray-500">Total del día</p>
          <p className="text-xl font-bold text-orange-500">{formatMoney(dayTotal)}</p>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex gap-3">
        <button className="btn-primary flex items-center gap-2 flex-1"
          onClick={() => { setEditingTicket(null); setShowTicketForm(true) }}>
          <Plus className="w-4 h-4" /> Nuevo ticket
        </button>
        <button className="btn-secondary flex items-center gap-2 flex-1"
          onClick={() => setShowQuickForm(true)}>
          <Zap className="w-4 h-4" /> Ingreso rápido
        </button>
      </div>

      {/* Lista de tickets */}
      {dayTickets.length === 0 && daySummaries.length === 0 ? (
        <div className="card text-center py-10">
          <Car className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400">No hay registros para esta fecha</p>
          <p className="text-sm text-gray-400 mt-1">Toca "Nuevo ticket" para empezar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dayTickets.map(ticket => {
            const worker  = workers.find(w => w.id === ticket.worker_id)
            const service = services.find(s => s.id === ticket.service_id)
            return (
              <div key={ticket.id} className="card flex items-start gap-3">
                {/* Foto de placa miniatura */}
                {ticket.photo_url && (
                  <img src={ticket.photo_url} alt="placa"
                    className="w-14 h-14 object-cover rounded-xl flex-none" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {ticket.plate && (
                      <span className="font-mono font-bold text-sm bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-lg">
                        {ticket.plate}
                      </span>
                    )}
                    <Badge variant={BADGE_COLORS[service?.category] || 'gray'}>
                      {CATEGORY_LABELS[service?.category] || service?.category}
                    </Badge>
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{service?.name || 'Servicio'}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap mt-0.5">
                    <span>{worker?.name || '—'}</span>
                    <span>·</span>
                    <span>{vehicleLabels[ticket.vehicle_type] || ticket.vehicle_type}</span>
                    <span>·</span>
                    <span>{PAYMENT_LABELS[ticket.payment_method] || ticket.payment_method}</span>
                  </div>
                  {ticket.notes && <p className="text-xs text-gray-400 mt-1 italic">{ticket.notes}</p>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-bold text-orange-500 text-base">{formatMoney(ticket.price_charged)}</span>
                  <div className="flex gap-1">
                    <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                      onClick={() => { setEditingTicket(ticket); setShowTicketForm(true) }}>
                      <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      onClick={() => setDeleteTarget({ type: 'ticket', id: ticket.id })}>
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {daySummaries.map(summary => (
            <div key={summary.id} className="card flex items-start gap-3 border-dashed">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">Ingreso rápido</span>
                  <Badge variant="gray">Sin detalle</Badge>
                </div>
                {summary.notes && <p className="text-xs text-gray-400 italic">{summary.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-orange-500">{formatMoney(summary.total_income)}</span>
                <button className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  onClick={() => setDeleteTarget({ type: 'summary', id: summary.id })}>
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </div>
          ))}

          <div className="flex justify-end pt-1">
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl px-4 py-2 border border-orange-100 dark:border-orange-900/30">
              <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">Total del día: </span>
              <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatMoney(dayTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet — Nuevo Ticket */}
      <BottomSheet
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
          vehicleTypes={vehicleTypes}
        />
      </BottomSheet>

      {/* Bottom Sheet — Ingreso rápido */}
      <BottomSheet open={showQuickForm} onClose={() => setShowQuickForm(false)} title="Ingreso rápido del día">
        <QuickSummaryForm onSave={handleSaveSummary} onClose={() => setShowQuickForm(false)} />
      </BottomSheet>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget?.type === 'ticket')  handleDeleteTicket(deleteTarget.id)
          else if (deleteTarget?.type === 'summary') handleDeleteSummary(deleteTarget.id)
        }}
        title="¿Eliminar registro?"
        message="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
      />
    </div>
  )
}
