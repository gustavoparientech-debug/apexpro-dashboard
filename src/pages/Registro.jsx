import { useState, useMemo, useRef, useEffect, useCallback } from 'react'

// Devuelve URL con thumbnail pequeño para miniaturas — reduce egress significativamente
function thumbUrl(url, size = 80) {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url
  try {
    const u = new URL(url)
    u.searchParams.set('width', size)
    u.searchParams.set('height', size)
    u.searchParams.set('resize', 'cover')
    return u.toString()
  } catch { return url }
}
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatMoney, todayISO, compressImage } from '../lib/utils'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Plus, Camera, Search, X, Clock, CheckCircle, Trash2, PenLine, Zap, Save, ChevronLeft, ChevronRight, Eye, EyeOff, AlertCircle, TrendingDown } from 'lucide-react'
import { IncidentForm } from './Trabajadores'
import toast from 'react-hot-toast'

const PAYMENT_OPTIONS = [
  { value: 'efectivo',     label: '💵 Efectivo' },
  { value: 'yape',         label: '📱 Yape' },
  { value: 'transferencia',label: '🏦 Transferencia' },
  { value: 'mixto',        label: '💵+📱 Mixto' },
]
const PAYMENT_LABELS = { efectivo: '💵 Efectivo', yape: '📱 Yape', transferencia: '🏦 Transferencia', mixto: '💵+📱 Mixto' }

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
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ${h % 24}h ${String(m % 60).padStart(2, '0')}m`
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
function useModalVisibility(open, exitMs = 160) {
  const [visible, setVisible] = useState(open)
  const [animateIn, setAnimateIn] = useState(false)

  useEffect(() => {
    if (open) {
      setVisible(true)
      const id = requestAnimationFrame(() => setAnimateIn(true))
      return () => cancelAnimationFrame(id)
    } else {
      setAnimateIn(false)
      const id = setTimeout(() => setVisible(false), exitMs)
      return () => clearTimeout(id)
    }
  }, [open, exitMs])

  return { visible, animateIn }
}

function BottomSheet({ open, onClose, title, children }) {
  const { visible, animateIn } = useModalVisibility(open)
  if (!visible) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-160 ease-out ${animateIn ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        className={`relative bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl flex flex-col max-h-[94vh] transition-transform duration-250 ease-[cubic-bezier(0.32,0.72,0,1)] ${animateIn ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-transform active:scale-[0.92]">
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
  const { visible, animateIn } = useModalVisibility(open)
  if (!visible) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-160 ease-out ${animateIn ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        className={`relative bg-white dark:bg-gray-900 rounded-t-3xl lg:rounded-2xl shadow-2xl flex flex-col w-full max-w-lg max-h-[90vh] transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${animateIn ? 'translate-y-0 lg:scale-100 opacity-100' : 'translate-y-full lg:translate-y-0 lg:scale-95 opacity-0'}`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-transform active:scale-[0.92]">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

// ─── Formulario nuevo ticket (simplificado) ───────────────────────────────────
function NewTicketForm({ onSave, onClose, workers, vehicleTypes, lockedWorkerId, canAdmin, defaultDate, allTickets }) {
  const [form, setForm] = useState({
    date:           defaultDate || todayISO(),
    worker_id:      lockedWorkerId || '',
    price_charged:  '',
    vehicle_type:   '',
    vehicle_subtype: '',
    notes:          '',
    plate:          '',
    photo_url:      '',
    client_name:    '',
    client_phone:   '',
  })
  const [photoPreview, setPhotoPreview] = useState('')
  const fileRef = useRef()

  // Auto-rellenar datos del cliente si la placa ya tiene historial
  function handlePlateChange(val) {
    const plate = val.toUpperCase()
    setForm(f => {
      if (plate.length >= 3) {
        const prev = (allTickets || []).find(t => t.plate === plate && (t.client_name || t.client_phone))
        if (prev) return { ...f, plate, client_name: prev.client_name || f.client_name, client_phone: prev.client_phone || f.client_phone }
      }
      return { ...f, plate }
    })
  }

  const activeWorkers = workers.filter(w => w.active)
  const activeVehicles = (vehicleTypes || []).filter(v => v.active !== false)

  async function handlePhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoPreview(URL.createObjectURL(file))
    try {
      const compressed = await compressImage(file)
      const path = `placas/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
      const { error } = await supabase.storage.from('payment-photos').upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })
      if (error) { toast.error('Error al subir foto'); return }
      const { data } = supabase.storage.from('payment-photos').getPublicUrl(path)
      setForm(f => ({ ...f, photo_url: data.publicUrl }))
    } catch {
      toast.error('Error al procesar la foto')
    }
  }

  const [vehicleVariantPicker, setVehicleVariantPicker] = useState(null) // vt object

  function handleVehicle(vt) {
    if (vt.variants?.length > 0) {
      setVehicleVariantPicker(vt)
    } else {
      setForm(f => ({ ...f, vehicle_type: vt.value, price_charged: vt.default_price || f.price_charged, vehicle_subtype: '' }))
      setVehicleVariantPicker(null)
    }
  }

  function handleVehicleVariant(vt, variant) {
    setForm(f => ({ ...f, vehicle_type: vt.value, price_charged: variant.price, vehicle_subtype: variant.label }))
    setVehicleVariantPicker(null)
  }

  const missing = []
  if (!form.plate || form.plate.length < 3) missing.push('placa válida')
  if (!form.worker_id) missing.push('técnico')

  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (missing.length) { toast.error('Falta: ' + missing.join(' · ')); return }
    if (submitting) return
    setSubmitting(true)
    try {
      await onSave({
        ...form,
        price_charged:  parseFloat(form.price_charged) || 0,
        payment_method: form.payment_method || 'yape',
        status:         'abierto',
        opened_at:      new Date().toISOString(),
        extras:         [],
      })
      onClose()
    } finally { setSubmitting(false) }
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
              onChange={e => handlePlateChange(e.target.value)}
              maxLength={8} />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Datos del cliente (opcional) */}
        {form.plate.length >= 3 && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos del cliente (opcional)</p>
            <input className="input text-sm" placeholder="Nombre"
              value={form.client_name}
              onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} />
            <input className="input text-sm" placeholder="Teléfono (9 dígitos)" type="tel" maxLength={9}
              value={form.client_phone}
              onChange={e => setForm(f => ({ ...f, client_phone: e.target.value.replace(/\D/g, '') }))} />
          </div>
        )}

        {/* Tipo de vehículo */}
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Tipo de vehículo</p>
          <div className="grid grid-cols-2 gap-2">
            {activeVehicles.map(v => {
              const isSelected = form.vehicle_type === v.value
              const isPicking = vehicleVariantPicker?.value === v.value
              const hasVariants = v.variants?.length > 0
              return (
                <button key={v.value} type="button" onClick={() => handleVehicle(v)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    isSelected
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                      : isPicking
                        ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                  }`}>
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{v.emoji}</span>
                    <span className="text-left leading-tight">
                      {v.label}
                      {hasVariants && <span className="block text-[10px] font-normal text-indigo-400 leading-none mt-0.5">▾ elegir tipo</span>}
                    </span>
                  </span>
                  {!hasVariants && v.default_price > 0 && (
                    <span className={`text-xs font-bold shrink-0 ${isSelected ? 'text-red-500' : 'text-gray-400'}`}>
                      S/{v.default_price}
                    </span>
                  )}
                  {hasVariants && (
                    <span className="text-[10px] font-semibold text-indigo-400 shrink-0">{v.variants.length} tipos</span>
                  )}
                </button>
              )
            })}
          </div>
          {vehicleVariantPicker && (
            <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setVehicleVariantPicker(null)}>
              <div className="absolute inset-0 bg-black/40" />
              <div className="relative bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl p-5 pb-8" onClick={e => e.stopPropagation()}>
                <div className="flex justify-center mb-3">
                  <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                </div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-4">
                  {vehicleVariantPicker.emoji} {vehicleVariantPicker.label} — elige subcategoría
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {vehicleVariantPicker.variants.map((v, i) => (
                    <button key={i} type="button"
                      onClick={() => handleVehicleVariant(vehicleVariantPicker, v)}
                      className="flex items-center justify-between px-4 py-3 rounded-2xl border-2 border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:border-indigo-500 hover:bg-indigo-100 active:scale-95 transition-all">
                      <span>{v.label}</span>
                      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">S/{v.price}</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setVehicleVariantPicker(null)} className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {form.vehicle_type && !vehicleVariantPicker && (
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
        <button type="button" onClick={handleSubmit} disabled={missing.length > 0 || submitting}
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
  const { fetchTicketPhotos } = useApp()

  // Cargar fotos lazy al abrir el ticket (no vienen en la consulta inicial)
  useEffect(() => {
    if (!ticket.photo_url && !ticket.payment_photo) {
      fetchTicketPhotos(ticket.id)
    }
  }, [ticket.id])

  const [showAddExtra,  setShowAddExtra]  = useState(false)
  const [manualName,    setManualName]    = useState('')
  const [manualPrice,   setManualPrice]   = useState('')
  const [variantPicker, setVariantPicker] = useState(null) // extra con variantes pendiente de selección
  const [editPrice,     setEditPrice]     = useState(false)
  const [discountPct,   setDiscountPct]   = useState(ticket.discount_pct || 0)
  const [discountFixed, setDiscountFixed] = useState(ticket.discount_fixed || 0)
  const [showDiscount,  setShowDiscount]  = useState(!!(ticket.discount_pct || ticket.discount_fixed))
  const [basePrice,     setBasePrice]     = useState(ticket.price_charged || vehicle?.default_price || 0)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [notes,         setNotes]         = useState(ticket.notes || '')
  const [paymentPhoto,  setPaymentPhoto]  = useState(ticket.payment_photo || '')
  const [mixtoYape,     setMixtoYape]     = useState(ticket.mixto_yape || '')
  const [mixtoEfectivo, setMixtoEfectivo] = useState(ticket.mixto_efectivo || '')
  const paymentPhotoRef = useRef()

  const extrasTotal = extras.reduce((s, e) => s + (e.price || 0), 0)
  const totalBruto = parseFloat(basePrice || 0) + extrasTotal
  const discountAmt = Math.round((totalBruto * (discountPct / 100) + parseFloat(discountFixed || 0)) * 100) / 100
  const totalFinal = Math.max(0, totalBruto - discountAmt)
  const effectivePayment = ticket.payment_method || 'yape'
  const isTransferencia = effectivePayment === 'transferencia'
  const isMixto = effectivePayment === 'mixto'
  const TRANSFER_FEE = 0.04
  const total = isTransferencia ? Math.round(totalFinal * (1 - TRANSFER_FEE) * 100) / 100 : totalFinal
  const mixtoSum = (parseFloat(mixtoYape) || 0) + (parseFloat(mixtoEfectivo) || 0)
  const mixtoOk = !isMixto || Math.abs(mixtoSum - total) < 0.01

  async function addCatalogExtra(extra) {
    if (extra.variants?.length) { setVariantPicker(extra); return }
    const newExtras = [...extras, { name: extra.name, price: extra.price }]
    await onUpdate(ticket.id, { extras: newExtras })
    setShowAddExtra(false)
    toast.success(`+ ${extra.name}`)
  }

  async function addVariantExtra(extra, variant) {
    const newExtras = [...extras, { name: `${extra.name} (${variant.label})`, price: variant.price }]
    await onUpdate(ticket.id, { extras: newExtras })
    setVariantPicker(null)
    setShowAddExtra(false)
    toast.success(`+ ${extra.name} ${variant.label}`)
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
        price_charged: totalFinal,
        extras,
        notes,
        discount_pct: discountPct || 0,
        discount_fixed: parseFloat(discountFixed) || 0,
        ...(paymentPhoto && { payment_photo: paymentPhoto }),
        ...(isMixto && { mixto_yape: parseFloat(mixtoYape) || 0, mixto_efectivo: parseFloat(mixtoEfectivo) || 0 }),
      })
      toast.success('Ticket actualizado')
      onClose()
    } catch (e) { toast.error('Error al guardar') }
    finally { setSaving(false) }
  }

  async function handleClose() {
    if (isMixto && !mixtoOk) {
      toast.error(`La suma debe ser ${formatMoney(total)} (falta ${formatMoney(total - mixtoSum)})`)
      return
    }
    await onUpdate(ticket.id, {
      status:         'cerrado',
      price_charged:  total,
      extras,
      notes,
      discount_pct:   discountPct || 0,
      discount_fixed: parseFloat(discountFixed) || 0,
      payment_method: effectivePayment,
      closed_at:      new Date().toISOString(),
      ...(paymentPhoto && { payment_photo: paymentPhoto }),
      ...(isMixto && { mixto_yape: parseFloat(mixtoYape) || 0, mixto_efectivo: parseFloat(mixtoEfectivo) || 0 }),
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
            <img src={thumbUrl(ticket.photo_url)} alt="placa" className="w-14 h-14 object-cover rounded-xl flex-none" loading="lazy" />
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
              {vehicle?.emoji} {vehicle?.label || ticket.vehicle_type}{ticket.vehicle_subtype ? ` · ${ticket.vehicle_subtype}` : ''} · {worker?.name || '—'}
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
            <span className="text-sm text-gray-600 dark:text-gray-400">Precio base ({vehicle?.label || ticket.vehicle_type}{ticket.vehicle_subtype ? ` · ${ticket.vehicle_subtype}` : ''})</span>
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
                  {ex.manual && <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1 rounded mr-1">manual</span>}
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

            {/* Picker de variantes */}
            {variantPicker && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{variantPicker.name} — elige nivel</p>
                  <button onClick={() => setVariantPicker(null)}><X className="w-3.5 h-3.5 text-gray-400" /></button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {variantPicker.variants.map((v, i) => (
                    <button key={i} onClick={() => addVariantExtra(variantPicker, v)}
                      className="flex flex-col items-center py-2.5 px-2 rounded-xl border-2 border-indigo-200 dark:border-indigo-700 hover:border-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 transition-all">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{v.label}</span>
                      <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-0.5">S/{v.price}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Catálogo */}
            {!variantPicker && extrasCatalog.filter(e => e.active !== false).length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {extrasCatalog.filter(e => e.active !== false).map(ex => (
                  <button key={ex.id} onClick={() => addCatalogExtra(ex)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{ex.name}</span>
                    <span className="text-xs font-bold text-red-500">
                      {ex.variants?.length ? `${ex.variants.length} niveles` : `+S/${ex.price}`}
                    </span>
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

        {/* Descuento */}
        <div className="px-4 pb-1">
          {!showDiscount ? (
            <button onClick={() => setShowDiscount(true)}
              className="w-full py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-500 hover:border-amber-400 hover:text-amber-600 transition-colors flex items-center justify-center gap-2">
              <span className="text-base leading-none">%</span> Agregar descuento
            </button>
          ) : (
            <div className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">Descuento</p>
                <button onClick={() => { setShowDiscount(false); setDiscountPct(0); setDiscountFixed(0) }}>
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Porcentaje</p>
                <div className="flex flex-wrap gap-2">
                  {[5,10,15,20,25,30].map(p => (
                    <button key={p} type="button" onClick={() => setDiscountPct(discountPct === p ? 0 : p)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${discountPct === p ? 'border-red-500 bg-red-500 text-white' : 'border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-100'}`}>
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Descuento fijo (S/)</p>
                <input type="number" min="0" step="0.5" placeholder="0.00" value={discountFixed}
                  onChange={e => setDiscountFixed(e.target.value)}
                  className="input text-sm w-full" />
              </div>
              {discountAmt > 0 && (
                <div className="flex justify-between text-xs font-semibold pt-1 border-t border-red-200 dark:border-red-700">
                  <span className="text-gray-500">Descuento aplicado</span>
                  <span className="text-red-600">-{formatMoney(discountAmt)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Método de pago */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Método de cobro</p>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_OPTIONS.map(p => (
              <button key={p.value} type="button"
                onClick={() => onUpdate(ticket.id, { payment_method: p.value })}
                className={`py-2 rounded-xl border text-xs font-medium transition-all ${
                  effectivePayment === p.value
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Foto comprobante Yape o Mixto */}
          <input ref={paymentPhotoRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={async e => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const compressed = await compressImage(file)
                const path = `yape/${ticket.id}_${Date.now()}.jpg`
                const { error } = await supabase.storage.from('payment-photos').upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })
                if (error) { toast.error('Error al subir foto'); return }
                const { data } = supabase.storage.from('payment-photos').getPublicUrl(path)
                setPaymentPhoto(data.publicUrl)
              } catch { toast.error('Error al procesar la foto') }
            }} />

          {(ticket.payment_method === 'yape' || isMixto) && (
            <div className="mt-3 space-y-3">
              {isMixto && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Desglose del pago</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-purple-500 font-medium mb-1 block">📱 Yape S/</label>
                      <input type="number" className="input text-sm" min="0" step="0.50"
                        value={mixtoYape} placeholder="0"
                        onChange={e => {
                          setMixtoYape(e.target.value)
                          const yape = parseFloat(e.target.value) || 0
                          const resto = Math.max(0, total - yape)
                          setMixtoEfectivo(resto > 0 ? String(Math.round(resto * 100) / 100) : '')
                        }} />
                    </div>
                    <div>
                      <label className="text-xs text-green-600 font-medium mb-1 block">💵 Efectivo S/</label>
                      <input type="number" className="input text-sm" min="0" step="0.50"
                        value={mixtoEfectivo} placeholder="0"
                        onChange={e => setMixtoEfectivo(e.target.value)} />
                    </div>
                  </div>
                  {!mixtoOk && mixtoSum > 0 && (
                    <p className="text-xs text-orange-500 mt-1">
                      Suma: {formatMoney(mixtoSum)} — faltan {formatMoney(total - mixtoSum)}
                    </p>
                  )}
                  {mixtoOk && mixtoSum > 0 && (
                    <p className="text-xs text-green-600 mt-1">✓ Suma correcta</p>
                  )}
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Comprobante Yape</p>
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
        {isTransferencia && (
          <div className="flex items-center justify-between text-xs text-gray-400 -mb-1">
            <span>Subtotal</span>
            <span>{formatMoney(totalBruto)}</span>
          </div>
        )}
        {isTransferencia && (
          <div className="flex items-center justify-between text-xs text-orange-500 -mb-1">
            <span>Comisión transferencia (4%)</span>
            <span>-{formatMoney(Math.round(totalBruto * TRANSFER_FEE * 100) / 100)}</span>
          </div>
        )}
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
        {onDelete && (
          <button onClick={() => setDeleteConfirm(true)}
            className="w-full py-2 rounded-xl text-red-500 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center justify-center gap-1">
            <Trash2 className="w-4 h-4" /> Eliminar ticket
          </button>
        )}
      </div>

      <ConfirmDialog open={deleteConfirm} onClose={() => setDeleteConfirm(false)}
        onConfirm={() => { onDelete(ticket.id); onClose() }}
        title="¿Eliminar ticket?" message="Esta acción no se puede deshacer."
        confirmLabel="Eliminar" />
    </div>
  )
}

// ─── Tarjeta ticket abierto ───────────────────────────────────────────────────
function ActiveTicketCard({ ticket, workers, vehicleTypes, onClick, onToggleHide }) {
  const worker  = workers.find(w => w.id === ticket.worker_id)
  const vehicle = (vehicleTypes || []).find(v => v.value === ticket.vehicle_type)
  const extras  = ticket.extras || []
  const extrasTotal = extras.reduce((s, e) => s + (e.price || 0), 0)
  const total = (ticket.price_charged || 0) + extrasTotal

  return (
    <div className={`card flex items-start gap-3 border-l-4 ${ticket.hidden_from_workers ? 'border-l-gray-400 opacity-60' : 'border-l-amber-400'}`}>
      <button onClick={onClick} className="flex items-start gap-3 flex-1 text-left min-w-0">
        {ticket.photo_url ? (
          <img src={thumbUrl(ticket.photo_url)} alt="placa" className="w-14 h-14 object-cover rounded-xl flex-none" loading="lazy" />
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
            {ticket.hidden_from_workers && (
              <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full">Oculto</span>
            )}
          </div>
          <p className="text-xs text-gray-500">{vehicle?.label || ticket.vehicle_type}{ticket.vehicle_subtype ? ` · ${ticket.vehicle_subtype}` : ''} · {worker?.name || '—'}</p>
          {extras.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{extras.length} extra{extras.length > 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="text-right flex-none">
          <TimerBadge openedAt={ticket.opened_at} />
          <p className="text-sm font-bold text-red-600 mt-0.5">{formatMoney(total)}</p>
        </div>
      </button>
      {onToggleHide && (
        <button onClick={() => onToggleHide(ticket)}
          title={ticket.hidden_from_workers ? 'Mostrar a trabajadores' : 'Ocultar a trabajadores'}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg mt-1 flex-none">
          {ticket.hidden_from_workers
            ? <EyeOff className="w-4 h-4 text-gray-400" />
            : <Eye className="w-4 h-4 text-gray-400" />
          }
        </button>
      )}
    </div>
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
  const d = Math.floor(h / 24)
  if (d > 0) return m > 0 ? `${d}d ${h % 24}h ${m}min` : `${d}d ${h % 24}h`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

// ─── Tarjeta ticket cerrado ───────────────────────────────────────────────────
function ClosedTicketCard({ ticket, workers, vehicleTypes, onDelete, onEdit, onSummary, onToggleHide }) {
  const worker  = workers.find(w => w.id === ticket.worker_id)
  const vehicle = (vehicleTypes || []).find(v => v.value === ticket.vehicle_type)
  const extras  = ticket.extras || []
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const closedAt  = ticket.closed_at  ? new Date(ticket.closed_at)  : (ticket.created_at ? new Date(ticket.created_at) : null)
  const timeStr   = closedAt ? closedAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : ''
  const duration  = serviceDuration(ticket)

  return (
    <>
      <div className={`card flex items-start gap-3 border-l-4 cursor-pointer active:scale-[0.99] transition-all ${ticket.hidden_from_workers ? 'border-l-gray-400 opacity-60' : 'border-l-green-400'}`}
        onClick={() => onSummary?.(ticket)}>
        {ticket.photo_url ? (
          <img src={thumbUrl(ticket.photo_url)} alt="placa" className="w-12 h-12 object-cover rounded-xl flex-none" loading="lazy" />
        ) : (
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex-none flex items-center justify-center text-xl">
            {vehicle?.emoji || '🚗'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="font-mono font-bold text-gray-900 dark:text-white text-sm">{ticket.plate || 'Sin placa'}</span>
            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full">Cerrado</span>
            {ticket.hidden_from_workers && (
              <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full">Oculto</span>
            )}
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
          <p className="text-xs text-gray-500">{vehicle?.label || ticket.vehicle_type}{ticket.vehicle_subtype ? ` · ${ticket.vehicle_subtype}` : ''} · {worker?.name || '—'}</p>
        </div>
        <div className="flex items-start gap-1.5 flex-none">
          <div className="text-right mr-1">
            {timeStr && <p className="text-xs text-gray-400">{timeStr}</p>}
            {duration && <p className="text-xs font-semibold text-blue-500 dark:text-blue-400">⏱ {duration}</p>}
            <p className="font-bold text-red-600 text-sm">{formatMoney(ticket.price_charged)}</p>
            <p className="text-xs font-medium">
              {ticket.payment_method === 'yape'
                ? <span className="text-purple-500">📱 Yape</span>
                : ticket.payment_method === 'mixto'
                ? <span className="text-gray-600">💵+📱 Mixto</span>
                : ticket.payment_method === 'efectivo'
                ? <span className="text-green-600">💵 Efectivo</span>
                : ticket.payment_method === 'transferencia'
                ? <span className="text-blue-500">🏦 Transfer</span>
                : <span className="text-gray-400">{ticket.payment_method || '—'}</span>
              }
            </p>
          </div>
          {onToggleHide && (
            <button onClick={e => { e.stopPropagation(); onToggleHide(ticket) }}
              title={ticket.hidden_from_workers ? 'Mostrar a trabajadores' : 'Ocultar a trabajadores'}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg mt-0.5">
              {ticket.hidden_from_workers
                ? <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                : <Eye className="w-3.5 h-3.5 text-gray-400" />
              }
            </button>
          )}
          {onEdit && (
            <button onClick={e => { e.stopPropagation(); onEdit(ticket) }}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg mt-0.5">
              <PenLine className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
          {onDelete && (
            <button onClick={e => { e.stopPropagation(); setDeleteConfirm(true) }}
              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg mt-0.5">
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          )}
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
  const [closing, setClosing] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimateIn(true))
    return () => cancelAnimationFrame(id)
  }, [])
  function handleClose() {
    setClosing(true)
    setTimeout(onClose, 160)
  }
  const show = animateIn && !closing
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
    const paymentLabel = ticket.payment_method === 'yape' ? 'Yape' : ticket.payment_method === 'transferencia' ? 'Transferencia' : 'Efectivo'
    const sep = '--------------------'
    const lines = [
      `*✨ APEX PRO DETAILING ✨*`,
      sep,
      `🚘 *Placa:* ${ticket.plate || 'Sin placa'}`,
      `🚙 *Vehículo:* ${vehicle?.label || ticket.vehicle_type}`,
      `👷 *Técnico:* ${worker?.name || '—'}`,
      ``,
      `🧾 *Detalle del servicio:*`,
      basePrice > 0 ? `  • Lavado: ${formatMoney(basePrice)}` : null,
      ...extras.map(e => `  • ${e.name}: ${formatMoney(e.price || 0)}`),
      sep,
      `💰 *Total: ${formatMoney(ticket.price_charged)}*`,
      `💳 Pago: ${paymentLabel}`,
      `📅 Fecha: ${closedDate}`,
      sep,
      `🙌 *¡Gracias por preferirnos!*`,
      `📍 Apex Pro Detailing`,
    ].filter(v => v !== null).join('\n')
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(lines)}`
    if (navigator.share && /android|iphone|ipad|ipod/i.test(navigator.userAgent)) {
      navigator.share({ text: lines }).catch(() => window.open(url, '_blank'))
    } else {
      window.open(url, '_blank')
    }
  }

  async function downloadPDF() {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ format: [80, 200], unit: 'mm' })
    const lm = 8, rm = 72, mid = 40
    let y = 8

    // Logo
    try {
      const img = new Image()
      img.src = '/logo.jpg'
      await new Promise(resolve => { img.onload = resolve; img.onerror = resolve })
      if (img.complete && img.naturalWidth > 0) {
        doc.addImage(img, 'JPEG', mid - 8, y, 16, 16, undefined, 'FAST')
        y += 19
      }
    } catch {}

    // Header
    doc.setFontSize(13).setFont(undefined, 'bold')
    doc.text('Apex Pro Detailing', mid, y, { align: 'center' }); y += 5
    doc.setFontSize(7).setFont(undefined, 'normal')
    doc.setTextColor(120, 120, 120)
    doc.text('DETAILING PROFESIONAL', mid, y, { align: 'center' }); y += 4
    doc.setTextColor(0, 0, 0)
    doc.text(closedDate, mid, y, { align: 'center' }); y += 5
    doc.setLineWidth(0.5).setDrawColor(200, 200, 200).line(lm, y, rm, y); y += 5

    // Placa + vehículo
    doc.setFontSize(14).setFont(undefined, 'bold').setTextColor(0, 0, 0)
    doc.text(ticket.plate || 'Sin placa', mid, y, { align: 'center' }); y += 5
    doc.setFontSize(8).setFont(undefined, 'normal').setTextColor(80, 80, 80)
    doc.text(`${vehicle?.label || ticket.vehicle_type}  |  Tecnico: ${worker?.name || '—'}`, mid, y, { align: 'center' }); y += 6
    doc.setDrawColor(200, 200, 200).line(lm, y, rm, y); y += 5

    // Detalle servicios
    doc.setFontSize(8).setFont(undefined, 'bold').setTextColor(0, 0, 0)
    doc.text('SERVICIO', lm, y)
    doc.text('PRECIO', rm, y, { align: 'right' }); y += 4
    doc.setFont(undefined, 'normal').setTextColor(40, 40, 40)
    if (basePrice > 0) {
      doc.text('Lavado', lm, y)
      doc.text(formatMoney(basePrice), rm, y, { align: 'right' }); y += 5
    }
    extras.forEach(e => {
      const name = e.name || 'Extra'
      const wrapped = doc.splitTextToSize(name, 45)
      doc.text(wrapped, lm, y)
      doc.text(formatMoney(e.price || 0), rm, y, { align: 'right' })
      y += wrapped.length * 4.5
    })
    y += 1
    doc.setLineWidth(0.5).setDrawColor(180, 180, 180).line(lm, y, rm, y); y += 4

    // Total
    doc.setFontSize(11).setFont(undefined, 'bold').setTextColor(0, 0, 0)
    doc.text('TOTAL', lm, y)
    doc.text(formatMoney(ticket.price_charged), rm, y, { align: 'right' }); y += 6

    // Pago
    const paymentText = { efectivo: 'Efectivo', yape: 'Yape', transferencia: 'Transferencia' }
    doc.setFontSize(8).setFont(undefined, 'normal').setTextColor(80, 80, 80)
    doc.text(`Metodo de pago: ${paymentText[ticket.payment_method] || ticket.payment_method || '—'}`, lm, y); y += 5

    doc.setLineWidth(0.5).setDrawColor(200, 200, 200).line(lm, y, rm, y); y += 5

    // Footer
    doc.setFontSize(8).setFont(undefined, 'bold').setTextColor(0, 0, 0)
    doc.text('Gracias por preferirnos!', mid, y, { align: 'center' }); y += 4
    doc.setFontSize(7).setFont(undefined, 'normal').setTextColor(150, 150, 150)
    doc.text('Apex Pro Detailing', mid, y, { align: 'center' })

    doc.save(`ticket_${ticket.plate || 'apex'}_${ticket.date || ''}.pdf`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-160 ease-out ${show ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      <div className={`relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] ${show ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
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
            <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-transform active:scale-[0.92]">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Foto vehículo */}
        {ticket.photo_url && (
          <img src={thumbUrl(ticket.photo_url, 600)} alt="vehículo" className="w-full h-40 object-cover" loading="lazy" />
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

          {/* Foto comprobante Yape */}
          {ticket.payment_photo && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Comprobante Yape</p>
              <a href={ticket.payment_photo} target="_blank" rel="noopener noreferrer">
                <img src={ticket.payment_photo} alt="comprobante yape" className="w-full rounded-xl object-cover max-h-48 border border-purple-200 dark:border-purple-800" />
              </a>
            </div>
          )}

          {/* Nota del trabajador */}
          {ticket.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">📝 Nota</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ticket.notes}</p>
            </div>
          )}

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
    payment_method: ticket.payment_method || 'yape',
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
    tickets, dailySummaries, workers, vehicleTypes, extrasCatalog, expenses,
    addTicket, updateTicket, deleteTicket, addDailySummary, deleteDailySummary, updateExpense, deleteExpense, addIncident, loadData,
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
  useEffect(() => {
    if (location.state?.autoNew) {
      setShowNewForm(true)
      window.history.replaceState({}, '')
    }
  }, [location.state])
  const [showQuickForm,    setShowQuickForm]    = useState(false)
  const [showFabMenu,      setShowFabMenu]      = useState(false)
  const [showIncidentForm, setShowIncidentForm] = useState(false)
  const [activeTicket, setActiveTicket]    = useState(null)
  const [editingTicket, setEditingTicket]  = useState(null)
  const [summaryTicket, setSummaryTicket]  = useState(null)
  const [editingExpense, setEditingExpense] = useState(null)

  const canAdmin = isAdmin || isDemo

  // Filtro por rango de fechas (solo admin)
  const [showRange, setShowRange] = useState(false)
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo,   setRangeTo]   = useState('')
  const hasRange = canAdmin && showRange && rangeFrom && rangeTo

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

  // Tickets abiertos: solo mostrar cuando se ve el día de hoy o posterior (nunca en días pasados)
  const openTickets = useMemo(
    () => selectedDate < todayISO() ? [] :
      [...tickets.filter(t => t.status === 'abierto' && (!t.hidden_from_workers || canAdmin))]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    [tickets, selectedDate, canAdmin]
  )

  // Tickets cerrados del día seleccionado (o rango) — más reciente primero
  const closedToday = useMemo(
    () => {
      const filtered = tickets.filter(t => {
        if (t.status !== 'cerrado' && t.status) return false
        if (!t.hidden_from_workers || canAdmin) {
          if (hasRange) return t.date >= rangeFrom && t.date <= rangeTo
          return t.date === selectedDate
        }
        return false
      })
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
    [tickets, selectedDate, hasRange, rangeFrom, rangeTo, canAdmin]
  )

  const daySummaries = useMemo(() => hasRange
    ? dailySummaries.filter(d => d.date >= rangeFrom && d.date <= rangeTo)
    : dailySummaries.filter(d => d.date === selectedDate),
  [dailySummaries, selectedDate, hasRange, rangeFrom, rangeTo])

  const expensesToday = useMemo(() => {
    const all = (expenses || []).filter(e => hasRange ? (e.date >= rangeFrom && e.date <= rangeTo) : e.date === selectedDate)
    if (!canAdmin) return all.filter(e => !e.hidden_from_workers)
    return all
  }, [expenses, selectedDate, canAdmin, profile, hasRange, rangeFrom, rangeTo])

  const expensesTodayTotal = useMemo(
    () => expensesToday.reduce((s, e) => s + (e.amount || 0), 0),
    [expensesToday]
  )

  const dayGross = useMemo(() => {
    if (closedToday.length > 0) {
      return closedToday.reduce((s, t) => s + (t.price_charged || 0), 0)
    }
    return daySummaries.reduce((s, d) => s + (d.total_income || 0), 0)
  }, [closedToday, daySummaries])

  const dayTotal = useMemo(() => dayGross - expensesTodayTotal, [dayGross, expensesTodayTotal])

  // Caja por método de pago
  const cajaStats = useMemo(() => {
    const map = {}
    closedToday.forEach(t => {
      const pm = t.payment_method || 'efectivo'
      if (pm === 'mixto') {
        // Distribuir el pago mixto entre yape y efectivo
        map['yape']     = (map['yape']     || 0) + (t.mixto_yape     || 0)
        map['efectivo'] = (map['efectivo'] || 0) + (t.mixto_efectivo || 0)
      } else {
        map[pm] = (map[pm] || 0) + (t.price_charged || 0)
      }
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
      // Sincronizar datos del cliente con vehicle_clients si se proporcionaron
      if (data.plate && (data.client_name || data.client_phone)) {
        await supabase.from('vehicle_clients').upsert(
          { plate: data.plate, name: data.client_name || null, phone: data.client_phone || null },
          { onConflict: 'plate', ignoreDuplicates: false }
        )
      }
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

  async function handleToggleHideTicket(ticket) {
    const newVal = !ticket.hidden_from_workers
    try {
      await updateTicket(ticket.id, { hidden_from_workers: newVal })
      toast.success(newVal ? 'Ticket oculto para trabajadores' : 'Ticket visible para trabajadores')
    } catch { toast.error('Error al actualizar') }
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
      <div className="relative rounded-2xl overflow-hidden bg-gray-900 dark:bg-gray-950">
        <img src="/hero-bg.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-center" onError={e => e.target.style.display='none'} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/80" />
        <div className="relative z-10 px-4 pt-4 pb-5 flex flex-col gap-3">

          {/* Fila 1: título + mes/año + Rápido */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-black text-white tracking-tight leading-none">Apex Pro Detailing</h1>
              {canAdmin ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <select className="bg-transparent text-gray-400 text-xs font-medium focus:outline-none cursor-pointer"
                    value={selMonth} onChange={e => handleMonthChange(+e.target.value, selYear)}>
                    {MONTHS.map((m, i) => <option key={i+1} value={i+1} className="bg-gray-800">{m}</option>)}
                  </select>
                  <select className="bg-transparent text-gray-400 text-xs font-medium focus:outline-none cursor-pointer"
                    value={selYear} onChange={e => handleMonthChange(selMonth, +e.target.value)}>
                    {[cy-1, cy, cy+1].map(y => <option key={y} value={y} className="bg-gray-800">{y}</option>)}
                  </select>
                </div>
              ) : (
                <p className="text-gray-400 text-xs mt-0.5">{MONTHS[selMonth-1]} {selYear}</p>
              )}
            </div>
            <button onClick={() => setShowQuickForm(true)}
              className="flex items-center gap-1 text-xs text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1.5 rounded-lg transition-colors flex-none">
              <Zap className="w-3 h-3" /> Rápido
            </button>
          </div>

          {/* Resumen del día — visible para todos */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none mb-1">
                {canAdmin ? (hasRange ? 'Total rango' : fechaLabel.split(',')[0]) : new Date().toLocaleDateString('es-PE', { weekday: 'long' }).toUpperCase()}
                {canAdmin && !hasRange && selectedDate !== today && <span className="ml-1.5 text-amber-400">· Lectura</span>}
              </p>
              <p className={`text-3xl font-black leading-none tracking-tight ${dayTotal >= 0 ? 'text-white' : 'text-red-400'}`}>
                {hideTotal && canAdmin ? '•••••' : formatMoney(dayTotal)}
              </p>
              {expensesTodayTotal > 0 && (
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-white/40 uppercase tracking-widest">Ingresos</span>
                    <span className="text-xs font-bold text-white/70">{hideTotal && canAdmin ? '•••' : formatMoney(dayGross)}</span>
                  </div>
                  <div className="w-px h-3 bg-white/20" />
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-white/40 uppercase tracking-widest">Gastos</span>
                    <span className="text-xs font-bold text-amber-400">-{hideTotal && canAdmin ? '•••' : formatMoney(expensesTodayTotal)}</span>
                  </div>
                </div>
              )}
              {expensesTodayTotal === 0 && dayGross > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest">Ingresos</span>
                  <span className="text-xs font-bold text-white/70">{hideTotal && canAdmin ? '•••' : formatMoney(dayGross)}</span>
                </div>
              )}
            </div>
            {canAdmin && (
              <button onClick={() => setHideTotal(v => !v)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors mt-1">
                <Eye className="w-4 h-4 text-gray-300" />
              </button>
            )}
          </div>

          {/* Fila nav día + botón rango */}
          {canAdmin && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => {
                  const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() - 1)
                  const nd = d.toISOString().slice(0, 10)
                  if (nd.startsWith(`${selYear}-${String(selMonth).padStart(2,'0')}`)) setSelectedDate(nd)
                }}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex-none">
                <ChevronLeft className="w-3.5 h-3.5 text-white" />
              </button>
              <input type="date"
                className="bg-white/10 text-white text-xs font-semibold focus:outline-none text-center rounded-lg px-2 py-1.5 cursor-pointer flex-1 min-w-0"
                value={selectedDate}
                min={`${selYear}-${String(selMonth).padStart(2,'0')}-01`}
                max={`${selYear}-${String(selMonth).padStart(2,'0')}-${new Date(selYear, selMonth, 0).getDate()}`}
                onChange={e => e.target.value && setSelectedDate(e.target.value)}
              />
              <button onClick={() => {
                  const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() + 1)
                  const nd = d.toISOString().slice(0, 10)
                  if (nd.startsWith(`${selYear}-${String(selMonth).padStart(2,'0')}`)) setSelectedDate(nd)
                }}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex-none">
                <ChevronRight className="w-3.5 h-3.5 text-white" />
              </button>
              {selectedDate !== today && (
                <button onClick={() => setSelectedDate(today)}
                  className="text-xs text-gray-300 bg-white/10 hover:bg-white/20 px-2 py-1.5 rounded-lg transition-colors font-semibold whitespace-nowrap flex-none">
                  Hoy
                </button>
              )}
              <button onClick={() => { setShowRange(v => !v); setRangeFrom(''); setRangeTo('') }}
                className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-all font-semibold flex-none ${showRange ? 'bg-red-500/90 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}>
                <Search className="w-3 h-3" />
                {showRange ? '✕' : 'Rango'}
              </button>
            </div>
          )}

          {/* Rango expandido */}
          {canAdmin && showRange && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-2">
                <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1">Desde</p>
                <input type="date" className="bg-transparent text-white text-sm font-semibold focus:outline-none w-full"
                  value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} />
              </div>
              <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-2">
                <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1">Hasta</p>
                <input type="date" className="bg-transparent text-white text-sm font-semibold focus:outline-none w-full"
                  value={rangeTo} min={rangeFrom} onChange={e => setRangeTo(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Botón nuevo ticket / FAB con menú para admin */}
      {canAdmin ? (
        <div className="relative">
          {showFabMenu && (
            <>
              <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setShowFabMenu(false)} />
              <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2">
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                  <div className="flex justify-center pt-2.5 pb-1">
                    <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  </div>
                  <button onClick={() => { setShowFabMenu(false); setShowIncidentForm(true) }}
                    className="w-full flex items-center gap-3 px-4 py-4 hover:bg-amber-50 dark:hover:bg-amber-900/20 active:bg-amber-100 transition-colors border-b border-gray-100 dark:border-gray-800">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">Nueva incidencia</p>
                      <p className="text-xs text-gray-400">Reportar un problema</p>
                    </div>
                  </button>
                  <button onClick={() => { setShowFabMenu(false); window.dispatchEvent(new Event('open-gasto')) }}
                    className="w-full flex items-center gap-3 px-4 py-4 hover:bg-green-50 dark:hover:bg-green-900/20 active:bg-green-100 transition-colors border-b border-gray-100 dark:border-gray-800">
                    <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                      <TrendingDown className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">Registrar gasto</p>
                      <p className="text-xs text-gray-400">Anotar un egreso del día</p>
                    </div>
                  </button>
                  <button onClick={() => { setShowFabMenu(false); setShowNewForm(true) }}
                    className="w-full flex items-center gap-3 px-4 py-4 hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                      <Plus className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">Nuevo ticket</p>
                      <p className="text-xs text-gray-400">Registrar un vehículo</p>
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}
          <button onClick={() => setShowFabMenu(v => !v)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-base shadow-lg shadow-red-200 dark:shadow-red-900/30 active:scale-95 transition-all">
            <Plus className={`w-5 h-5 transition-transform duration-200 ${showFabMenu ? 'rotate-45' : ''}`} />
            {showFabMenu ? 'Cerrar' : 'Nuevo'}
          </button>
        </div>
      ) : (
        <button onClick={() => setShowNewForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-base shadow-lg shadow-red-200 dark:shadow-red-900/30 active:scale-95 transition-all">
          <Plus className="w-5 h-5" /> Nuevo ticket
        </button>
      )}

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
                mixto:         { label: 'Mixto',         icon: '💵', color: 'text-gray-600',   bar: 'bg-gray-400',   ring: 'bg-gray-100 dark:bg-gray-800' },
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
                onClick={() => setActiveTicket(t.id)}
                onToggleHide={canAdmin ? handleToggleHideTicket : null} />
            ))}
          </div>
        )}
      </div>

      {/* CERRADOS DEL DÍA */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            {hasRange ? `Cerrados ${rangeFrom.split('-').reverse().join('/')} – ${rangeTo.split('-').reverse().join('/')}` : selectedDate === today ? 'Cerrados hoy' : `Cerrados el ${selectedDate.split('-').reverse().join('/')}`}
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
                onDelete={canAdmin ? handleDeleteTicket : null}
                onEdit={canAdmin ? (tk) => setEditingTicket(tk) : null}
                onSummary={(tk) => setSummaryTicket(tk)}
                onToggleHide={canAdmin ? handleToggleHideTicket : null} />
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
                <span className="text-sm text-red-600 font-medium">Ingresos: </span>
                <span className="text-lg font-black text-red-600">{formatMoney(dayGross)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GASTOS DEL DÍA */}
      {expensesToday.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              Gastos del día
            </h2>
            <span className="bg-amber-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {expensesToday.length}
            </span>
          </div>
          <div className="space-y-2">
            {expensesToday.map(exp => {
              const worker = workers.find(w => w.id === exp.worker_id)
              const catLabels = { insumos: '🧴 Insumos', herramientas: '🔧 Herramientas', transporte: '🚌 Transporte', comida: '🍱 Comida', otro: '📦 Otro' }
              const isEditing = editingExpense?.id === exp.id

              if (isEditing && canAdmin) return (
                <div key={exp.id} className="card space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Monto</p>
                      <input type="number" className="input text-sm" value={editingExpense.amount}
                        onChange={e => setEditingExpense(f => ({ ...f, amount: e.target.value }))} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Trabajador</p>
                      <select className="input text-sm" value={editingExpense.worker_id || ''}
                        onChange={e => setEditingExpense(f => ({ ...f, worker_id: e.target.value }))}>
                        <option value="">Sin asignar</option>
                        {workers.filter(w => w.active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {Object.entries({ insumos: '🧴', herramientas: '🔧', transporte: '🚌', comida: '🍱', otro: '📦' }).map(([v, emoji]) => (
                      <button key={v} type="button" onClick={() => setEditingExpense(f => ({ ...f, category: v }))}
                        className={`py-1.5 px-2 rounded-xl border text-xs font-medium transition-all ${editingExpense.category === v ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-200 text-gray-600'}`}>
                        {emoji} {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>
                  <input className="input text-sm" placeholder="Notas" value={editingExpense.notes || ''}
                    onChange={e => setEditingExpense(f => ({ ...f, notes: e.target.value }))} />
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      try {
                        await updateExpense(exp.id, { ...editingExpense, amount: parseFloat(editingExpense.amount) })
                        toast.success('Gasto actualizado')
                        setEditingExpense(null)
                      } catch { toast.error('Error al actualizar') }
                    }} className="flex-1 py-2 bg-red-600 text-white text-sm font-bold rounded-xl">Guardar</button>
                    <button onClick={() => setEditingExpense(null)} className="px-4 py-2 border border-gray-200 text-sm rounded-xl text-gray-600">Cancelar</button>
                  </div>
                </div>
              )

              return (
                <div key={exp.id} className="card flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">💸</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {catLabels[exp.category] || exp.category || 'Gasto'}
                    </p>
                    {exp.notes && <p className="text-xs text-gray-400 truncate">{exp.notes}</p>}
                    {worker && <p className="text-xs text-gray-400">{worker.name}</p>}
                  </div>
                  <span className={`text-sm font-bold ${exp.hidden_from_workers ? 'text-gray-400' : 'text-amber-600'}`}>-{formatMoney(exp.amount)}</span>
                  {canAdmin && (
                    <>
                      <button title={exp.hidden_from_workers ? 'Mostrar a trabajadores' : 'Ocultar a trabajadores'}
                        onClick={async () => { try { await updateExpense(exp.id, { hidden_from_workers: !exp.hidden_from_workers }) } catch { toast.error('Error') } }}
                        className={`p-1.5 rounded-lg transition-colors ${exp.hidden_from_workers ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                        <Eye className={`w-3.5 h-3.5 ${exp.hidden_from_workers ? 'text-gray-300' : 'text-gray-400'}`} />
                      </button>
                      <button onClick={() => setEditingExpense({ ...exp })}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                        <PenLine className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                      <button onClick={async () => { try { await deleteExpense(exp.id); toast.success('Gasto eliminado') } catch { toast.error('Error al eliminar') } }}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </>
                  )}
                </div>
              )
            })}
            <div className="flex justify-between items-center pt-1 px-1">
              <span className="text-xs text-gray-400">Total gastos</span>
              <span className="text-sm font-bold text-amber-600">-{formatMoney(expensesTodayTotal)}</span>
            </div>
            <div className="flex justify-end">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl px-4 py-2">
                <span className="text-sm text-green-700 dark:text-green-400 font-medium">Neto del día: </span>
                <span className="text-lg font-black text-green-700 dark:text-green-400">{formatMoney(dayTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

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
          allTickets={tickets}
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
            onDelete={canAdmin ? handleDeleteTicket : null}
          />
        )}
      </Modal>

      {/* Bottom Sheet — Ingreso rápido */}
      <BottomSheet open={showQuickForm} onClose={() => setShowQuickForm(false)} title="Ingreso rápido">
        <QuickSummaryForm onSave={handleSaveSummary} onClose={() => setShowQuickForm(false)} />
      </BottomSheet>

      {/* Modal — Nueva incidencia (admin) */}
      <Modal open={showIncidentForm} onClose={() => setShowIncidentForm(false)} title="Registrar incidencia">
        <IncidentForm
          workers={workers}
          onClose={() => setShowIncidentForm(false)}
          onSave={async (data) => {
            await addIncident(data)
            setShowIncidentForm(false)
          }}
        />
      </Modal>

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
