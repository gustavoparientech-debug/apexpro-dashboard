import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { formatMoney, todayISO } from '../lib/utils'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Plus, Camera, Search, X, Clock, CheckCircle, Trash2, PenLine, Zap, Save } from 'lucide-react'
import toast from 'react-hot-toast'

const PAYMENT_OPTIONS = [
  { value: 'efectivo',     label: '💵 Efectivo' },
  { value: 'yape',         label: '📱 Yape' },
  { value: 'transferencia',label: '🏦 Transferencia' },
]
const PAYMENT_LABELS = { efectivo: '💵 Efectivo', yape: '📱 Yape', transferencia: '🏦 Transferencia' }

// ─── Timer hook ───────────────────────────────────────────────────────────────
function useElapsedMs(openedAt) {
  const [ms, setMs] = useState(() => openedAt ? Date.now() - new Date(openedAt).getTime() : 0)
  useEffect(() => {
    if (!openedAt) return
    const id = setInterval(() => setMs(Date.now() - new Date(openedAt).getTime()), 1000)
    return () => clearInterval(id)
  }, [openedAt])
  return ms
}

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${String(m % 60).padStart(2, '0')}m`
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function TimerBadge({ openedAt }) {
  const ms = useElapsedMs(openedAt)
  return (
    <span className="flex items-center gap-1 text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
      <Clock className="w-3 h-3" />
      {formatElapsed(ms)}
    </span>
  )
}

// ─── Bottom Sheet ─────────────────────────────────────────────────────────────
function BottomSheet({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl flex flex-col max-h-[94vh]">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">{children}</div>
      </div>
    </div>
  )
}

// ─── Full screen modal ────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-t-3xl lg:rounded-2xl shadow-2xl flex flex-col w-full max-w-lg max-h-[90vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

// ─── Formulario nuevo ticket (simplificado) ───────────────────────────────────
function NewTicketForm({ onSave, onClose, workers, vehicleTypes, lockedWorkerId }) {
  const [form, setForm] = useState({
    date:          todayISO(),
    worker_id:     lockedWorkerId || '',
    price_charged: '',
    vehicle_type:  '',
    notes:         '',
    plate:         '',
    photo_url:     '',
  })
  const [photoPreview, setPhotoPreview] = useState('')
  const fileRef = useRef()

  const activeWorkers = workers.filter(w => w.active)
  const activeVehicles = (vehicleTypes || []).filter(v => v.active !== false)

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

  function handleVehicle(vt) {
    setForm(f => ({
      ...f,
      vehicle_type:  vt.value,
      price_charged: vt.default_price || f.price_charged,
    }))
  }

  const missing = []
  if (!form.plate || form.plate.length < 3) missing.push('placa válida')
  if (!form.worker_id) missing.push('lavador')

  async function handleSubmit() {
    if (missing.length) { toast.error('Falta: ' + missing.join(' · ')); return }
    await onSave({
      ...form,
      price_charged: parseFloat(form.price_charged) || 0,
      status:     'abierto',
      opened_at:  new Date().toISOString(),
      extras:     [],
    })
    onClose()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5 pt-2">

        {/* Foto placa */}
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Foto de placa</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          {photoPreview ? (
            <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <img src={photoPreview} alt="placa" className="w-full h-36 object-cover" />
              <button onClick={() => { setPhotoPreview(''); setForm(f => ({ ...f, photo_url: '' })) }}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current.click()}
              className="w-full h-28 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-red-400 hover:text-red-400 transition-colors">
              <Camera className="w-7 h-7" />
              <span className="text-xs">Tomar foto de placa</span>
            </button>
          )}
        </div>

        {/* Placa */}
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Placa</p>
          <div className="relative">
            <input className="input pr-10 uppercase tracking-widest font-mono text-lg"
              placeholder="AAA-123" value={form.plate}
              onChange={e => setForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))}
              maxLength={8} />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Tipo de vehículo */}
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Tipo de vehículo</p>
          <div className="grid grid-cols-2 gap-2">
            {activeVehicles.map(v => (
              <button key={v.value} type="button" onClick={() => handleVehicle(v)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  form.vehicle_type === v.value
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                <span className="flex items-center gap-2">
                  <span className="text-lg">{v.emoji}</span>
                  <span>{v.label}</span>
                </span>
                {v.default_price > 0 && (
                  <span className={`text-xs font-bold ${form.vehicle_type === v.value ? 'text-red-500' : 'text-gray-400'}`}>
                    S/{v.default_price}
                  </span>
                )}
              </button>
            ))}
          </div>
          {form.vehicle_type && (
            <p className="text-xs text-gray-400 mt-1.5">
              Precio sugerido: S/ {form.price_charged} (editable al cerrar)
            </p>
          )}
        </div>

        {/* Lavador */}
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Lavador</p>
          <div className="grid grid-cols-2 gap-2">
            {activeWorkers.map(w => {
              const isLocked = !!lockedWorkerId && w.id !== lockedWorkerId
              const isSelected = form.worker_id === w.id
              return (
                <button key={w.id} type="button"
                  onClick={() => !isLocked && setForm(f => ({ ...f, worker_id: w.id }))}
                  disabled={isLocked}
                  className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                    isSelected
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                      : isLocked
                        ? 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                  }`}>
                  {w.name}
                </button>
              )
            })}
          </div>
          {lockedWorkerId && (
            <p className="text-xs text-gray-400 mt-1.5">Solo puedes crear tickets a tu nombre</p>
          )}
        </div>

      </div>

      {/* Footer */}
      <div className="px-4 pt-3 pb-5 border-t border-gray-100 dark:border-gray-800">
        {missing.length > 0 && (
          <p className="text-xs text-gray-400 text-center mb-2">Falta: {missing.join(' · ')}</p>
        )}
        <button type="button" onClick={handleSubmit} disabled={missing.length > 0}
          className={`w-full py-3.5 rounded-2xl font-bold text-base transition-all ${
            missing.length === 0
              ? 'bg-red-600 hover:bg-red-700 text-white active:scale-95'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}>
          Abrir ticket
        </button>
      </div>
    </div>
  )
}

// ─── Detalle ticket abierto ───────────────────────────────────────────────────
function TicketDetail({ ticket, onClose, workers, vehicleTypes, extrasCatalog, onUpdate, onDelete }) {
  const worker  = workers.find(w => w.id === ticket.worker_id)
  const vehicle = (vehicleTypes || []).find(v => v.value === ticket.vehicle_type)
  const extras  = ticket.extras || []

  const [showAddExtra,  setShowAddExtra]  = useState(false)
  const [manualName,    setManualName]    = useState('')
  const [manualPrice,   setManualPrice]   = useState('')
  const [editPrice,     setEditPrice]     = useState(false)
  const [basePrice,     setBasePrice]     = useState(ticket.price_charged || vehicle?.default_price || 0)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [saving,        setSaving]        = useState(false)

  const extrasTotal = extras.reduce((s, e) => s + (e.price || 0), 0)
  const total = parseFloat(basePrice || 0) + extrasTotal

  async function addCatalogExtra(extra) {
    const newExtras = [...extras, { name: extra.name, price: extra.price }]
    await onUpdate(ticket.id, { extras: newExtras })
    setShowAddExtra(false)
    toast.success(`+ ${extra.name}`)
  }

  async function addManualExtra() {
    if (!manualName.trim() || !manualPrice) { toast.error('Ingresa nombre y precio'); return }
    const newExtras = [...extras, { name: manualName.trim(), price: parseFloat(manualPrice), manual: true }]
    await onUpdate(ticket.id, { extras: newExtras })
    setManualName(''); setManualPrice('')
    setShowAddExtra(false)
    toast.success('Extra agregado')
  }

  async function removeExtra(idx) {
    const newExtras = extras.filter((_, i) => i !== idx)
    await onUpdate(ticket.id, { extras: newExtras })
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onUpdate(ticket.id, {
        price_charged:  parseFloat(basePrice) || 0,
        extras,
      })
      toast.success('Ticket actualizado')
    } catch (e) { toast.error('Error al guardar') }
    finally { setSaving(false) }
  }

  async function handleClose() {
    await onUpdate(ticket.id, {
      status:        'cerrado',
      price_charged: total,
      extras,
    })
    toast.success('Ticket cerrado')
    onClose()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">

        {/* Header info del ticket */}
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/30 flex items-center gap-3">
          {ticket.photo_url && (
            <img src={ticket.photo_url} alt="placa" className="w-14 h-14 object-cover rounded-xl flex-none" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-lg text-gray-900 dark:text-white tracking-wider">
                {ticket.plate || '—'}
              </span>
              <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Abierto
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {vehicle?.emoji} {vehicle?.label || ticket.vehicle_type} · {worker?.name || '—'}
            </p>
            <TimerBadge openedAt={ticket.opened_at} />
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Total</p>
            <p className="text-xl font-black text-red-600">{formatMoney(total)}</p>
          </div>
        </div>

        {/* Precio base */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Precio base ({vehicle?.label || ticket.vehicle_type})</span>
            {editPrice ? (
              <div className="flex items-center gap-2">
                <input type="number" min="0" step="0.5"
                  className="input w-24 py-1 text-sm text-right"
                  value={basePrice}
                  onChange={e => setBasePrice(e.target.value)}
                  onBlur={() => setEditPrice(false)}
                  autoFocus />
              </div>
            ) : (
              <button onClick={() => setEditPrice(true)}
                className="flex items-center gap-1 text-sm font-bold text-gray-800 dark:text-gray-200 hover:text-red-600">
                {formatMoney(basePrice)}
                <PenLine className="w-3 h-3 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Extras */}
        {extras.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Extras</p>
            {extras.map((ex, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {ex.manual && <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 px-1 rounded mr-1">manual</span>}
                  {ex.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">+{formatMoney(ex.price)}</span>
                  <button onClick={() => removeExtra(i)}
                    className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                    <X className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
            <div className="pt-1 flex justify-between text-xs text-gray-500">
              <span>Subtotal extras</span>
              <span className="font-semibold">{formatMoney(extrasTotal)}</span>
            </div>
          </div>
        )}

        {/* Agregar extra */}
        {!showAddExtra ? (
          <div className="px-4 py-3">
            <button onClick={() => setShowAddExtra(true)}
              className="w-full py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-500 hover:border-red-400 hover:text-red-500 transition-colors flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Agregar extra
            </button>
          </div>
        ) : (
          <div className="px-4 py-3 space-y-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Agregar extra</p>
              <button onClick={() => setShowAddExtra(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>

            {/* Catálogo */}
            {extrasCatalog.filter(e => e.active !== false).length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {extrasCatalog.filter(e => e.active !== false).map(ex => (
                  <button key={ex.id} onClick={() => addCatalogExtra(ex)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{ex.name}</span>
                    <span className="text-xs font-bold text-red-500">+S/{ex.price}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Manual */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                <PenLine className="w-3 h-3" /> Servicio manual
              </div>
              <input className="input text-sm" placeholder="Nombre del servicio"
                value={manualName} onChange={e => setManualName(e.target.value)} />
              <div className="flex gap-2">
                <input type="number" min="0" step="0.5" className="input text-sm flex-1"
                  placeholder="Precio S/" value={manualPrice}
                  onChange={e => setManualPrice(e.target.value)} />
                <button onClick={addManualExtra}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 rounded-xl text-sm font-bold">
                  + Agregar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Método de pago */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Método de cobro</p>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_OPTIONS.map(p => (
              <button key={p.value} type="button"
                onClick={() => onUpdate(ticket.id, { payment_method: p.value })}
                className={`py-2 rounded-xl border text-xs font-medium transition-all ${
                  ticket.payment_method === p.value
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="px-4 pb-6 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500">Total a cobrar</span>
          <span className="text-2xl font-black text-red-600">{formatMoney(total)}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Actualizar'}
          </button>
          <button onClick={handleClose}
            className="flex-1 py-3 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
            <CheckCircle className="w-4 h-4" /> Cerrar ticket
          </button>
        </div>
        <button onClick={() => setDeleteConfirm(true)}
          className="w-full py-2 rounded-xl text-red-500 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center justify-center gap-1">
          <Trash2 className="w-4 h-4" /> Eliminar ticket
        </button>
      </div>

      <ConfirmDialog open={deleteConfirm} onClose={() => setDeleteConfirm(false)}
        onConfirm={() => { onDelete(ticket.id); onClose() }}
        title="¿Eliminar ticket?" message="Esta acción no se puede deshacer."
        confirmLabel="Eliminar" />
    </div>
  )
}

// ─── Tarjeta ticket abierto ───────────────────────────────────────────────────
function ActiveTicketCard({ ticket, workers, vehicleTypes, onClick }) {
  const worker  = workers.find(w => w.id === ticket.worker_id)
  const vehicle = (vehicleTypes || []).find(v => v.value === ticket.vehicle_type)
  const extras  = ticket.extras || []
  const extrasTotal = extras.reduce((s, e) => s + (e.price || 0), 0)
  const total = (ticket.price_charged || 0) + extrasTotal

  return (
    <button onClick={onClick}
      className="w-full card flex items-start gap-3 text-left hover:shadow-md transition-shadow border-l-4 border-l-amber-400">
      {ticket.photo_url ? (
        <img src={ticket.photo_url} alt="placa" className="w-14 h-14 object-cover rounded-xl flex-none" />
      ) : (
        <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-xl flex-none flex items-center justify-center text-2xl">
          {vehicle?.emoji || '🚗'}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono font-black text-gray-900 dark:text-white">
            {ticket.plate || 'Sin placa'}
          </span>
          <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
            Abierto
          </span>
        </div>
        <p className="text-xs text-gray-500">{vehicle?.label || ticket.vehicle_type} · {worker?.name || '—'}</p>
        {extras.length > 0 && (
          <p className="text-xs text-gray-400 mt-0.5">{extras.length} extra{extras.length > 1 ? 's' : ''}</p>
        )}
      </div>
      <div className="text-right flex-none">
        <TimerBadge openedAt={ticket.opened_at} />
        <p className="text-sm font-bold text-red-600 mt-0.5">{formatMoney(total)}</p>
      </div>
    </button>
  )
}

// ─── Tarjeta ticket cerrado ───────────────────────────────────────────────────
function ClosedTicketCard({ ticket, workers, vehicleTypes, onDelete }) {
  const worker  = workers.find(w => w.id === ticket.worker_id)
  const vehicle = (vehicleTypes || []).find(v => v.value === ticket.vehicle_type)
  const extras  = ticket.extras || []
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const createdAt = ticket.created_at ? new Date(ticket.created_at) : null
  const timeStr   = createdAt ? createdAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div className="card flex items-start gap-3 border-l-4 border-l-green-400">
      {ticket.photo_url ? (
        <img src={ticket.photo_url} alt="placa" className="w-12 h-12 object-cover rounded-xl flex-none" />
      ) : (
        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex-none flex items-center justify-center text-xl">
          {vehicle?.emoji || '🚗'}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono font-bold text-gray-900 dark:text-white text-sm">{ticket.plate || 'Sin placa'}</span>
          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full">Cerrado</span>
        </div>
        <p className="text-xs text-gray-500">{vehicle?.label || ticket.vehicle_type} · {worker?.name || '—'}</p>
        {extras.length > 0 && (
          <p className="text-xs text-gray-400">{extras.map(e => e.name).join(', ')}</p>
        )}
      </div>
      <div className="flex items-start gap-2 flex-none">
        <div className="text-right">
          {timeStr && <p className="text-xs text-gray-400">{timeStr}</p>}
          <p className="font-bold text-red-600 text-sm">{formatMoney(ticket.price_charged)}</p>
          <p className="text-xs text-gray-400">{PAYMENT_LABELS[ticket.payment_method]?.split(' ')[1] || ticket.payment_method}</p>
        </div>
        <button onClick={() => setDeleteConfirm(true)}
          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg mt-0.5">
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
        </button>
      </div>
      <ConfirmDialog open={deleteConfirm} onClose={() => setDeleteConfirm(false)}
        onConfirm={() => onDelete(ticket.id)}
        title="¿Eliminar registro?" message="Esta acción no se puede deshacer."
        confirmLabel="Eliminar" />
    </div>
  )
}

// ─── Quick Summary Form ───────────────────────────────────────────────────────
function QuickSummaryForm({ onSave, onClose }) {
  const [form, setForm] = useState({ date: todayISO(), total_income: '', notes: '' })
  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.total_income) { toast.error('Ingresa el total'); return }
    await onSave({ ...form, total_income: parseFloat(form.total_income) })
    onClose()
  }
  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4 pt-2">
      <div>
        <label className="label">Fecha</label>
        <input type="date" className="input" value={form.date}
          onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
      </div>
      <div>
        <label className="label">Total del día (S/)</label>
        <input type="number" className="input" min="0" step="0.50" value={form.total_income}
          onChange={e => setForm(f => ({ ...f, total_income: e.target.value }))}
          placeholder="0.00" required />
      </div>
      <div>
        <label className="label">Notas (opcional)</label>
        <textarea className="input resize-none" rows={2} value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary flex-1">Registrar</button>
      </div>
    </form>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Registro() {
  const {
    tickets, dailySummaries, workers, vehicleTypes, extrasCatalog,
    addTicket, updateTicket, deleteTicket, addDailySummary, deleteDailySummary,
  } = useApp()
  const { profile, isAdmin, isDemo } = useAuth()

  const location = useLocation()
  const [selectedDate, setSelectedDate]   = useState(todayISO())
  const [showNewForm,  setShowNewForm]     = useState(!!location.state?.autoNew)
  const [showQuickForm, setShowQuickForm]  = useState(false)
  const [activeTicket, setActiveTicket]    = useState(null)

  // Tickets abiertos (sin filtro de fecha)
  const openTickets = useMemo(
    () => tickets.filter(t => t.status === 'abierto'),
    [tickets]
  )

  // Tickets cerrados del día seleccionado
  const closedToday = useMemo(
    () => tickets.filter(t => (t.status === 'cerrado' || !t.status) && t.date === selectedDate),
    [tickets, selectedDate]
  )

  const daySummaries = useMemo(() => dailySummaries.filter(d => d.date === selectedDate), [dailySummaries, selectedDate])

  const dayTotal = useMemo(() =>
    closedToday.reduce((s, t) => s + t.price_charged, 0) +
    daySummaries.reduce((s, d) => s + d.total_income, 0),
    [closedToday, daySummaries]
  )

  async function handleSaveTicket(data) {
    try {
      await addTicket(data)
      toast.success('Ticket abierto')
    } catch (err) { toast.error('Error: ' + err.message) }
  }

  async function handleUpdateTicket(id, data) {
    try { await updateTicket(id, data) }
    catch (err) { toast.error('Error: ' + err.message) }
  }

  async function handleDeleteTicket(id) {
    try { await deleteTicket(id); toast.success('Eliminado') }
    catch { toast.error('Error al eliminar') }
  }

  async function handleSaveSummary(data) {
    try { await addDailySummary(data); toast.success('Registrado') }
    catch { toast.error('Error al guardar') }
  }

  // Si el ticket activo se actualiza (cerrado), cerramos el modal
  const activeTicketData = useMemo(
    () => activeTicket ? tickets.find(t => t.id === activeTicket) : null,
    [activeTicket, tickets]
  )
  useEffect(() => {
    if (activeTicket && activeTicketData && activeTicketData.status !== 'abierto') {
      setActiveTicket(null)
    }
  }, [activeTicket, activeTicketData])

  return (
    <div className="space-y-4 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Registro</h1>
        <button onClick={() => setShowQuickForm(true)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-3 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <Zap className="w-4 h-4" /> Ingreso rápido
        </button>
      </div>

      {/* FAB Nuevo ticket */}
      <button onClick={() => setShowNewForm(true)}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-base shadow-lg shadow-red-200 dark:shadow-red-900/30 active:scale-95 transition-all">
        <Plus className="w-5 h-5" /> Nuevo ticket
      </button>

      {/* TICKETS ACTIVOS */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            Tickets activos
          </h2>
          {openTickets.length > 0 && (
            <span className="bg-amber-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {openTickets.length}
            </span>
          )}
        </div>
        {openTickets.length === 0 ? (
          <div className="card text-center py-6 border-dashed">
            <p className="text-sm text-gray-400">Sin tickets activos</p>
          </div>
        ) : (
          <div className="space-y-2">
            {openTickets.map(t => (
              <ActiveTicketCard key={t.id} ticket={t} workers={workers} vehicleTypes={vehicleTypes}
                onClick={() => setActiveTicket(t.id)} />
            ))}
          </div>
        )}
      </div>

      {/* CERRADOS HOY */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            Cerrados hoy
          </h2>
          <input type="date" className="text-xs border-0 bg-transparent text-gray-400 cursor-pointer"
            value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
        </div>

        {closedToday.length === 0 && daySummaries.length === 0 ? (
          <div className="card text-center py-8 border-dashed">
            <p className="text-sm text-gray-400">No hay registros cerrados este día</p>
          </div>
        ) : (
          <div className="space-y-2">
            {closedToday.map(t => (
              <ClosedTicketCard key={t.id} ticket={t} workers={workers} vehicleTypes={vehicleTypes}
                onDelete={handleDeleteTicket} />
            ))}
            {daySummaries.map(s => (
              <div key={s.id} className="card flex items-center gap-3 border-dashed">
                <div className="flex-1">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ingreso rápido</span>
                  {s.notes && <p className="text-xs text-gray-400 italic">{s.notes}</p>}
                </div>
                <span className="font-bold text-red-500">{formatMoney(s.total_income)}</span>
                <button onClick={() => deleteDailySummary(s.id)}
                  className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            ))}
            <div className="flex justify-end pt-1">
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-2">
                <span className="text-sm text-red-600 font-medium">Total: </span>
                <span className="text-lg font-black text-red-600">{formatMoney(dayTotal)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sheet — Nuevo Ticket */}
      <BottomSheet open={showNewForm} onClose={() => setShowNewForm(false)} title="Nuevo ticket">
        <NewTicketForm
          onSave={handleSaveTicket}
          onClose={() => setShowNewForm(false)}
          workers={workers}
          vehicleTypes={vehicleTypes}
          lockedWorkerId={(isAdmin || isDemo) ? null : profile?.worker_id}
        />
      </BottomSheet>

      {/* Modal — Detalle ticket abierto */}
      <Modal
        open={!!activeTicketData && activeTicketData.status === 'abierto'}
        onClose={() => setActiveTicket(null)}
        title={`Ticket ${activeTicketData?.plate || ''}`}
      >
        {activeTicketData && (
          <TicketDetail
            ticket={activeTicketData}
            onClose={() => setActiveTicket(null)}
            workers={workers}
            vehicleTypes={vehicleTypes}
            extrasCatalog={extrasCatalog || []}
            onUpdate={handleUpdateTicket}
            onDelete={handleDeleteTicket}
          />
        )}
      </Modal>

      {/* Bottom Sheet — Ingreso rápido */}
      <BottomSheet open={showQuickForm} onClose={() => setShowQuickForm(false)} title="Ingreso rápido">
        <QuickSummaryForm onSave={handleSaveSummary} onClose={() => setShowQuickForm(false)} />
      </BottomSheet>
    </div>
  )
}
