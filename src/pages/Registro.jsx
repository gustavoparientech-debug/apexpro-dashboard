import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { formatMoney, todayISO } from '../lib/utils'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Plus, Camera, Search, X, Clock, CheckCircle, Trash2, PenLine, Zap, Save, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
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
function NewTicketForm({ onSave, onClose, workers, vehicleTypes, lockedWorkerId, canAdmin, defaultDate }) {
  const [form, setForm] = useState({
    date:          defaultDate || todayISO(),
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
  if (!form.worker_id) missing.push('técnico')

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

        {/* Fecha (solo admin) */}
        {canAdmin && (
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Fecha del ticket</p>
            <input type="date" className="input" value={form.date}
              max={todayISO()}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            {form.date !== todayISO() && (
              <p className="text-xs text-amber-500 mt-1">⚠ Registrando en fecha pasada: {form.date.split('-').reverse().join('/')}</p>
            )}
          </div>
        )}

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

        {/* Técnico */}
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Técnico</p>
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
  const [notes,         setNotes]         = useState(ticket.notes || '')
  const [paymentPhoto,  setPaymentPhoto]  = useState(ticket.payment_photo || '')
  const paymentPhotoRef = useRef()

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
        price_charged: parseFloat(basePrice) || 0,
        extras,
        notes,
        ...(paymentPhoto && { payment_photo: paymentPhoto }),
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
      notes,
      closed_at:     new Date().toISOString(),
      ...(paymentPhoto && { payment_photo: paymentPhoto }),
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

          {/* Foto comprobante Yape */}
          {ticket.payment_method === 'yape' && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Comprobante Yape</p>
              <input ref={paymentPhotoRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = ev => setPaymentPhoto(ev.target.result)
                  reader.readAsDataURL(file)
                }} />
              {paymentPhoto ? (
                <div className="relative rounded-xl overflow-hidden border border-purple-200 dark:border-purple-800">
                  <img src={paymentPhoto} alt="comprobante" className="w-full h-32 object-cover" />
                  <button onClick={() => setPaymentPhoto('')}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => paymentPhotoRef.current.click()}
                  className="w-full h-20 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-xl flex items-center justify-center gap-2 text-purple-400 hover:border-purple-500 hover:text-purple-500 transition-colors text-sm font-medium">
                  <Camera className="w-5 h-5" /> Foto del Yape
                </button>
              )}
            </div>
          )}
        </div>

        {/* Notas del servicio */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notas</p>
          <textarea
            className="input resize-none text-sm"
            rows={2}
            placeholder="Ej: cliente solicita cera extra, rayón en puerta trasera…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            maxLength={200}
          />
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

// ─── Duración de servicio ─────────────────────────────────────────────────────
function serviceDuration(ticket) {
  const start = ticket.opened_at ? new Date(ticket.opened_at) : null
  const end   = ticket.closed_at ? new Date(ticket.closed_at) : null
  if (!start || !end || end <= start) return null
  const totalSecs = Math.round((end - start) / 1000)
  if (totalSecs < 5) return null
  if (totalSecs < 60) return `${totalSecs}s`
  const mins = Math.floor(totalSecs / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

// ─── Tarjeta ticket cerrado ───────────────────────────────────────────────────
function ClosedTicketCard({ ticket, workers, vehicleTypes, onDelete, onEdit, onSummary }) {
  const worker  = workers.find(w => w.id === ticket.worker_id)
  const vehicle = (vehicleTypes || []).find(v => v.value === ticket.vehicle_type)
  const extras  = ticket.extras || []
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const closedAt  = ticket.closed_at  ? new Date(ticket.closed_at)  : (ticket.created_at ? new Date(ticket.created_at) : null)
  const timeStr   = closedAt ? closedAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : ''
  const duration  = serviceDuration(ticket)

  return (
    <>
      <div className="card flex items-start gap-3 border-l-4 border-l-green-400 cursor-pointer active:scale-[0.99] transition-all"
        onClick={() => onSummary?.(ticket)}>
        {ticket.photo_url ? (
          <img src={ticket.photo_url} alt="placa" className="w-12 h-12 object-cover rounded-xl flex-none" />
        ) : (
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex-none flex items-center justify-center text-xl">
            {vehicle?.emoji || '🚗'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="font-mono font-bold text-gray-900 dark:text-white text-sm">{ticket.plate || 'Sin placa'}</span>
            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full">Cerrado</span>
            {extras.length > 0 && (
              <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-full">
                +{extras.length} adicional{extras.length > 1 ? 'es' : ''}
              </span>
            )}
            {ticket.notes && (
              <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                📝 Nota
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">{vehicle?.label || ticket.vehicle_type} · {worker?.name || '—'}</p>
        </div>
        <div className="flex items-start gap-1.5 flex-none">
          <div className="text-right mr-1">
            {timeStr && <p className="text-xs text-gray-400">{timeStr}</p>}
            {duration && <p className="text-xs font-semibold text-blue-500 dark:text-blue-400">⏱ {duration}</p>}
            <p className="font-bold text-red-600 text-sm">{formatMoney(ticket.price_charged)}</p>
            <p className="text-xs font-medium">
              {ticket.payment_method === 'yape'
                ? <span className="text-purple-500">📱 Yape</span>
                : ticket.payment_method === 'efectivo'
                ? <span className="text-green-600">💵 Efectivo</span>
                : ticket.payment_method === 'transferencia'
                ? <span className="text-blue-500">🏦 Transfer</span>
                : <span className="text-gray-400">{ticket.payment_method || '—'}</span>
              }
            </p>
          </div>
          {onSummary && (
            <button onClick={e => { e.stopPropagation(); onSummary(ticket) }}
              className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg mt-0.5">
              <Eye className="w-3.5 h-3.5 text-green-500" />
            </button>
          )}
          {onEdit && (
            <button onClick={e => { e.stopPropagation(); onEdit(ticket) }}
              className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg mt-0.5">
              <PenLine className="w-3.5 h-3.5 text-blue-400" />
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); setDeleteConfirm(true) }}
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg mt-0.5">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>
      <ConfirmDialog open={deleteConfirm} onClose={() => setDeleteConfirm(false)}
        onConfirm={() => onDelete(ticket.id)}
        title="¿Eliminar registro?" message="Esta acción no se puede deshacer."
        confirmLabel="Eliminar" />
    </>
  )
}

// ─── Modal resumen ticket cerrado ────────────────────────────────────────────
function TicketSummaryModal({ ticket, workers, vehicleTypes, onClose }) {
  const worker  = workers.find(w => w.id === ticket.worker_id)
  const vehicle = (vehicleTypes || []).find(v => v.value === ticket.vehicle_type)
  const extras  = ticket.extras || []
  const extrasTotal = extras.reduce((s, e) => s + (e.price || 0), 0)
  const basePrice   = Math.max(0, (ticket.price_charged || 0) - extrasTotal)
  const duration    = serviceDuration(ticket)
  const closedDate  = ticket.closed_at
    ? new Date(ticket.closed_at).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : ticket.date

  function shareWhatsApp() {
    const lines = [
      `🚗 *Apex Pro Detailing*`,
      `Placa: *${ticket.plate || 'Sin placa'}*`,
      `Vehículo: ${vehicle?.label || ticket.vehicle_type}`,
      `Técnico: ${worker?.name || '—'}`,
      ``,
      `📋 *Detalle:*`,
      basePrice > 0 ? `Lavado: ${formatMoney(basePrice)}` : null,
      ...extras.map(e => `${e.name}: ${formatMoney(e.price || 0)}`),
      ``,
      `💰 *Total: ${formatMoney(ticket.price_charged)}*`,
      `Pago: ${PAYMENT_LABELS[ticket.payment_method] || ticket.payment_method || '—'}`,
      duration ? `⏱ Duración: ${duration}` : null,
      ``,
      `¡Gracias por preferirnos! 🙌`,
    ].filter(v => v !== null).join('\n')
    window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, '_blank')
  }

  async function downloadPDF() {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ format: [80, 160], unit: 'mm' })
    const lm = 8, rm = 72, mid = 40
    let y = 10

    // Header
    doc.setFontSize(14).setFont(undefined, 'bold')
    doc.text('Apex Pro Detailing', mid, y, { align: 'center' }); y += 6
    doc.setFontSize(8).setFont(undefined, 'normal')
    doc.text(closedDate, mid, y, { align: 'center' }); y += 5
    doc.setLineWidth(0.3).line(lm, y, rm, y); y += 4

    // Placa + vehículo
    doc.setFontSize(11).setFont(undefined, 'bold')
    doc.text(ticket.plate || 'Sin placa', mid, y, { align: 'center' }); y += 5
    doc.setFontSize(8).setFont(undefined, 'normal')
    doc.text(`${vehicle?.label || ticket.vehicle_type} · ${worker?.name || '—'}`, mid, y, { align: 'center' }); y += 5
    doc.line(lm, y, rm, y); y += 4

    // Detalle servicios
    doc.setFontSize(8)
    if (basePrice > 0) {
      doc.text('Lavado', lm, y)
      doc.text(formatMoney(basePrice), rm, y, { align: 'right' }); y += 5
    }
    extras.forEach(e => {
      doc.text(e.name || 'Extra', lm, y)
      doc.text(formatMoney(e.price || 0), rm, y, { align: 'right' }); y += 5
    })
    doc.line(lm, y, rm, y); y += 4

    // Total
    doc.setFontSize(10).setFont(undefined, 'bold')
    doc.text('TOTAL', lm, y)
    doc.text(formatMoney(ticket.price_charged), rm, y, { align: 'right' }); y += 5
    doc.setFontSize(8).setFont(undefined, 'normal')
    doc.text(`Pago: ${PAYMENT_LABELS[ticket.payment_method] || ticket.payment_method || '—'}`, lm, y); y += 5
    if (duration) { doc.text(`Duración: ${duration}`, lm, y); y += 5 }

    doc.line(lm, y, rm, y); y += 4
    doc.setFontSize(7).text('¡Gracias por preferirnos!', mid, y, { align: 'center' })

    doc.save(`ticket_${ticket.plate || 'apex'}.pdf`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <span className="font-mono font-black text-xl text-gray-900 dark:text-white">{ticket.plate || 'Sin placa'}</span>
          <div className="flex items-center gap-2">
            <button onClick={shareWhatsApp}
              className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.106.546 4.083 1.502 5.808L0 24l6.342-1.486A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.003-1.366l-.36-.213-3.767.883.921-3.669-.234-.377A9.818 9.818 0 112.182 12 9.818 9.818 0 0112 21.818z"/></svg>
              WhatsApp
            </button>
            <button onClick={downloadPDF}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Foto */}
        {ticket.photo_url && (
          <img src={ticket.photo_url} alt="vehículo" className="w-full h-40 object-cover" />
        )}

        {/* Info */}
        <div className="px-5 py-4 space-y-0">
          <p className="text-sm text-gray-500 mb-4">{worker?.name || '—'} · {vehicle?.label || ticket.vehicle_type}</p>

          {/* Detalle servicios */}
          <div className="space-y-2 text-sm">
            {basePrice > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Lavado</span>
                <span className="text-gray-900 dark:text-white">{formatMoney(basePrice)}</span>
              </div>
            )}
            {extras.map((e, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">{e.name}</span>
                <span className="text-gray-900 dark:text-white">{formatMoney(e.price || 0)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-800 font-bold">
              <span className="text-gray-900 dark:text-white">Total</span>
              <span className="text-red-600 text-base">{formatMoney(ticket.price_charged)}</span>
            </div>
          </div>

          {/* Meta */}
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Pago</span>
              <span className="font-medium text-gray-900 dark:text-white">{PAYMENT_LABELS[ticket.payment_method] || ticket.payment_method || '—'}</span>
            </div>
            {duration && (
              <div className="flex justify-between">
                <span className="text-gray-500">Duración</span>
                <span className="font-semibold text-blue-500">⏱ {duration}</span>
              </div>
            )}
            {closedDate && (
              <div className="flex justify-between">
                <span className="text-gray-500">Cerrado</span>
                <span className="text-gray-700 dark:text-gray-300 text-xs">{closedDate}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal edición ticket cerrado (admin) ────────────────────────────────────
function EditClosedTicket({ ticket, workers, vehicleTypes, onSave, onClose }) {
  const activeWorkers  = workers.filter(w => w.active)
  const activeVehicles = (vehicleTypes || []).filter(v => v.active !== false)
  const [form, setForm] = useState({
    plate:          ticket.plate || '',
    vehicle_type:   ticket.vehicle_type || '',
    worker_id:      ticket.worker_id || '',
    price_charged:  ticket.price_charged || '',
    payment_method: ticket.payment_method || '',
    date:           ticket.date || todayISO(),
    notes:          ticket.notes || '',
  })
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await onSave(ticket.id, { ...form, price_charged: parseFloat(form.price_charged) || 0 })
      toast.success('Ticket actualizado')
      onClose()
    } catch (err) { toast.error('Error: ' + err.message) }
    finally { setBusy(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 pb-6 pt-2 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Placa</label>
          <input className="input font-mono uppercase tracking-widest" value={form.plate}
            onChange={e => setForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))} maxLength={8} />
        </div>
        <div>
          <label className="label">Fecha</label>
          <input type="date" className="input" value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
      </div>

      <div>
        <label className="label">Tipo de vehículo</label>
        <div className="grid grid-cols-2 gap-2">
          {activeVehicles.map(v => (
            <button key={v.value} type="button" onClick={() => setForm(f => ({ ...f, vehicle_type: v.value, price_charged: f.price_charged || v.default_price }))}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                form.vehicle_type === v.value
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600'
                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
              }`}>
              <span>{v.emoji}</span><span className="flex-1 text-left">{v.label}</span>
              <span className="text-xs text-gray-400">S/{v.default_price}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Técnico</label>
        <div className="grid grid-cols-2 gap-2">
          {activeWorkers.map(w => (
            <button key={w.id} type="button" onClick={() => setForm(f => ({ ...f, worker_id: w.id }))}
              className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                form.worker_id === w.id
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600'
                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
              }`}>{w.name}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Precio cobrado (S/)</label>
          <input type="number" className="input text-lg font-bold" min="0" step="0.5"
            value={form.price_charged} onChange={e => setForm(f => ({ ...f, price_charged: e.target.value }))} />
        </div>
        <div>
          <label className="label">Método de pago</label>
          <div className="flex flex-col gap-1.5">
            {PAYMENT_OPTIONS.map(p => (
              <button key={p.value} type="button" onClick={() => setForm(f => ({ ...f, payment_method: p.value }))}
                className={`py-1.5 px-3 rounded-xl border text-sm font-medium transition-all ${
                  form.payment_method === p.value
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                }`}>{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="label">Notas</label>
        <textarea className="input resize-none" rows={2} value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opcional..." />
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
        <button type="submit" disabled={busy} className="btn-primary flex-1">
          {busy ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </form>
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

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Registro() {
  const {
    tickets, dailySummaries, workers, vehicleTypes, extrasCatalog,
    addTicket, updateTicket, deleteTicket, addDailySummary, deleteDailySummary, loadData,
  } = useApp()
  const { profile, isAdmin, isDemo } = useAuth()

  const { month: cm, year: cy } = useMemo(() => {
    const n = new Date()
    return { month: n.getMonth() + 1, year: n.getFullYear() }
  }, [])

  const location = useLocation()
  const today = todayISO()
  const [selMonth, setSelMonth] = useState(cm)
  const [selYear,  setSelYear]  = useState(cy)
  const [selectedDate, setSelectedDate]   = useState(today)
  const [showNewForm,  setShowNewForm]     = useState(!!location.state?.autoNew)
  const [showQuickForm, setShowQuickForm]  = useState(false)
  const [activeTicket, setActiveTicket]    = useState(null)
  const [editingTicket, setEditingTicket]  = useState(null)
  const [summaryTicket, setSummaryTicket]  = useState(null)

  const canAdmin = isAdmin || isDemo

  // Recargar cuando cambia mes/año (solo admin)
  function handleMonthChange(m, y) {
    setSelMonth(m)
    setSelYear(y)
    // Ajustar día seleccionado al primero del mes si está fuera de rango
    const prefix = `${y}-${String(m).padStart(2, '0')}`
    if (!selectedDate.startsWith(prefix)) {
      setSelectedDate(`${prefix}-01`)
    }
    loadData(m, y)
  }

  // Tickets abiertos (sin filtro de fecha)
  const openTickets = useMemo(
    () => tickets.filter(t => t.status === 'abierto'),
    [tickets]
  )

  // Tickets cerrados del día seleccionado — más reciente primero
  const closedToday = useMemo(
    () => {
      const filtered = tickets.filter(t => (t.status === 'cerrado' || !t.status) && t.date === selectedDate)
      // Si tienen closed_at (columna agregada en DB), ordenar por ese campo
      const hasClosed = filtered.some(t => t.closed_at)
      if (hasClosed) {
        return [...filtered].sort((a, b) => {
          const ta = a.closed_at ? new Date(a.closed_at).getTime() : 0
          const tb = b.closed_at ? new Date(b.closed_at).getTime() : 0
          return tb - ta
        })
      }
      // Sin closed_at: invertir el orden actual (tickets array viene created_at DESC,
      // el más reciente ya está primero — no hace falta re-ordenar)
      return filtered
    },
    [tickets, selectedDate]
  )

  const daySummaries = useMemo(() => dailySummaries.filter(d => d.date === selectedDate), [dailySummaries, selectedDate])

  const dayTotal = useMemo(() =>
    closedToday.reduce((s, t) => s + t.price_charged, 0) +
    daySummaries.reduce((s, d) => s + d.total_income, 0),
    [closedToday, daySummaries]
  )

  // Caja por método de pago
  const cajaStats = useMemo(() => {
    const map = {}
    closedToday.forEach(t => {
      const pm = t.payment_method || 'efectivo'
      map[pm] = (map[pm] || 0) + (t.price_charged || 0)
    })
    const total = Object.values(map).reduce((s, v) => s + v, 0)
    return Object.entries(map).map(([method, amount]) => ({ method, amount, pct: total > 0 ? Math.round(amount / total * 100) : 0 }))
      .sort((a, b) => b.amount - a.amount)
  }, [closedToday])

  // Resumen por trabajador (tickets cerrados del día)
  const workerDayStats = useMemo(() => {
    const map = {}
    closedToday.forEach(t => {
      if (!t.worker_id) return
      if (!map[t.worker_id]) map[t.worker_id] = { total: 0, extras: 0, byVehicle: {} }
      map[t.worker_id].total += 1
      map[t.worker_id].extras += (t.extras?.length || 0)
      const vt = t.vehicle_type || 'otro'
      map[t.worker_id].byVehicle[vt] = (map[t.worker_id].byVehicle[vt] || 0) + 1
    })
    return Object.entries(map)
      .map(([wid, s]) => ({ worker: workers.find(w => w.id === wid), ...s }))
      .filter(r => r.worker)
      .sort((a, b) => b.total - a.total)
  }, [closedToday, workers])

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

  const fechaLabel = (() => {
    const d = new Date(selectedDate + 'T00:00:00')
    const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
    return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`
  })()

  const [hideTotal, setHideTotal] = useState(false)

  return (
    <div className="space-y-4 max-w-2xl mx-auto">

      {/* Hero header */}
      <div className="relative rounded-3xl overflow-hidden bg-gray-900 dark:bg-gray-950 min-h-[180px]">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800/80 to-gray-900/95" />
        <div className="relative z-10 p-5 flex flex-col gap-3">
          {/* Top row */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Apex Pro Detailing</h1>
              {/* Selector fecha compacto */}
              {canAdmin ? (
                <div className="flex items-center gap-1 mt-1">
                  <select className="bg-transparent text-gray-300 text-xs font-medium focus:outline-none cursor-pointer"
                    value={selMonth} onChange={e => handleMonthChange(+e.target.value, selYear)}>
                    {MONTHS.map((m, i) => <option key={i+1} value={i+1} className="bg-gray-800">{m}</option>)}
                  </select>
                  <select className="bg-transparent text-gray-300 text-xs font-medium focus:outline-none cursor-pointer"
                    value={selYear} onChange={e => handleMonthChange(selMonth, +e.target.value)}>
                    {[cy-1, cy, cy+1].map(y => <option key={y} value={y} className="bg-gray-800">{y}</option>)}
                  </select>
                </div>
              ) : (
                <p className="text-gray-400 text-xs mt-1">{MONTHS[selMonth-1]} {selYear}</p>
              )}
            </div>
            <button onClick={() => setShowQuickForm(true)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition-colors">
              <Zap className="w-3.5 h-3.5" /> Rápido
            </button>
          </div>

          {/* Navegación por día */}
          {canAdmin && (
            <div className="flex items-center gap-2">
              <button onClick={() => {
                  const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() - 1)
                  const nd = d.toISOString().slice(0, 10)
                  const prefix = `${selYear}-${String(selMonth).padStart(2,'0')}`
                  if (nd.startsWith(prefix)) setSelectedDate(nd)
                }}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
              <input type="date"
                className="bg-white/10 text-white text-sm font-medium flex-1 focus:outline-none text-center rounded-xl px-3 py-1.5 cursor-pointer"
                value={selectedDate}
                min={`${selYear}-${String(selMonth).padStart(2,'0')}-01`}
                max={`${selYear}-${String(selMonth).padStart(2,'0')}-${new Date(selYear, selMonth, 0).getDate()}`}
                onChange={e => e.target.value && setSelectedDate(e.target.value)}
              />
              <button onClick={() => {
                  const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() + 1)
                  const nd = d.toISOString().slice(0, 10)
                  const prefix = `${selYear}-${String(selMonth).padStart(2,'0')}`
                  if (nd.startsWith(prefix)) setSelectedDate(nd)
                }}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
              {selectedDate !== today && (
                <button onClick={() => setSelectedDate(today)}
                  className="text-xs text-gray-300 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition-colors font-medium whitespace-nowrap">
                  Hoy
                </button>
              )}
            </div>
          )}

          {/* Tarjeta total del día */}
          <div className="bg-black/40 backdrop-blur-sm rounded-2xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Total del día</p>
              <p className="text-3xl font-black text-white leading-none">
                {hideTotal ? '••••••' : formatMoney(dayTotal)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {fechaLabel}
                {selectedDate !== today && <span className="ml-2 text-amber-400 font-medium">· Solo lectura</span>}
              </p>
            </div>
            <button onClick={() => setHideTotal(v => !v)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
              <Eye className="w-4 h-4 text-gray-300" />
            </button>
          </div>
        </div>
      </div>

      {/* Botón nuevo ticket */}
      <button onClick={() => setShowNewForm(true)}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-base shadow-lg shadow-red-200 dark:shadow-red-900/30 active:scale-95 transition-all">
        <Plus className="w-5 h-5" /> Nuevo ticket
      </button>

      {/* CAJA EN TIEMPO REAL */}
      {cajaStats.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Caja en tiempo real</h2>
            <span className="text-xs text-gray-400">disponible ahora</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {cajaStats.map(({ method, amount, pct }) => {
              const cfg = {
                efectivo:      { label: 'Efectivo',      icon: '💵', color: 'text-green-600',  bar: 'bg-green-500',  ring: 'bg-green-100 dark:bg-green-900/30' },
                yape:          { label: 'Yape',          icon: '📱', color: 'text-purple-600', bar: 'bg-purple-500', ring: 'bg-purple-100 dark:bg-purple-900/30' },
                transferencia: { label: 'Transferencia', icon: '🏦', color: 'text-blue-600',   bar: 'bg-blue-500',   ring: 'bg-blue-100 dark:bg-blue-900/30' },
              }[method] || { label: method, icon: '💳', color: 'text-gray-600', bar: 'bg-gray-400', ring: 'bg-gray-100' }
              return (
                <div key={method} className="card py-3 px-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-xl ${cfg.ring} flex items-center justify-center text-base`}>{cfg.icon}</div>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{cfg.label}</span>
                  </div>
                  <p className="text-xl font-black text-gray-900 dark:text-white">{formatMoney(amount)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{pct}%</p>
                  <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full ${cfg.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* POR COLABORADOR */}
      {workerDayStats.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
            Por colaborador
          </h2>
          <div className="flex flex-wrap gap-2">
            {workerDayStats.map(({ worker, total, extras, byVehicle }) => (
              <div key={worker.id} className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2">
                <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 font-bold text-xs flex-none">
                  {worker.name[0]}
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{worker.name}</span>
                <span className="text-lg font-black text-gray-900 dark:text-white leading-none">{total}</span>
                <span className="text-xs text-gray-400 flex gap-1">
                  {Object.entries(byVehicle).map(([vt, cnt]) => {
                    const vObj = (vehicleTypes || []).find(v => v.value === vt)
                    return <span key={vt}>{vObj?.emoji || '🚗'}×{cnt}</span>
                  })}
                </span>
                {extras > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                    +{extras}e
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* CERRADOS DEL DÍA */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            {selectedDate === today ? 'Cerrados hoy' : `Cerrados el ${selectedDate.split('-').reverse().join('/')}`}
          </h2>
        </div>

        {closedToday.length === 0 && daySummaries.length === 0 ? (
          <div className="card text-center py-8 border-dashed">
            <p className="text-sm text-gray-400">No hay registros cerrados este día</p>
          </div>
        ) : (
          <div className="space-y-2">
            {closedToday.map(t => (
              <ClosedTicketCard key={t.id} ticket={t} workers={workers} vehicleTypes={vehicleTypes}
                onDelete={handleDeleteTicket}
                onEdit={canAdmin ? (tk) => setEditingTicket(tk) : null}
                onSummary={(tk) => setSummaryTicket(tk)} />
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
          canAdmin={canAdmin}
          defaultDate={selectedDate}
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

      {/* Modal — Resumen ticket */}
      {summaryTicket && (
        <TicketSummaryModal
          ticket={summaryTicket}
          workers={workers}
          vehicleTypes={vehicleTypes}
          onClose={() => setSummaryTicket(null)}
        />
      )}

      {/* Modal — Editar ticket cerrado (admin) */}
      <Modal open={!!editingTicket} onClose={() => setEditingTicket(null)}
        title={`Editar ticket ${editingTicket?.plate || ''}`}>
        {editingTicket && (
          <EditClosedTicket
            ticket={editingTicket}
            workers={workers}
            vehicleTypes={vehicleTypes}
            onSave={handleUpdateTicket}
            onClose={() => setEditingTicket(null)}
          />
        )}
      </Modal>
    </div>
  )
}
