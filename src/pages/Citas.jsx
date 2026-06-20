import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import {
  CalendarDays, Clock, Wrench, User, Plus, X, Trash2,
  ChevronRight, Car, Sparkles, AlertCircle, Edit3, Check, CheckCircle2, XCircle, Circle
} from 'lucide-react'

const SERVICIOS = [
  { id: 'lavado_estandar',  label: 'Lavado Estándar',     emoji: '🚿', color: 'blue' },
  { id: 'lavado_offroad',   label: 'Lavado Off-Road',     emoji: '🚙', color: 'orange' },
  { id: 'lavado_detailing', label: 'Detailing Completo',  emoji: '✨', color: 'purple' },
  { id: 'ceramico',         label: 'Recubrimiento Cerámico', emoji: '💎', color: 'cyan' },
  { id: 'ppf',              label: 'PPF',                 emoji: '🛡️', color: 'gray' },
  { id: 'polarizado',       label: 'Polarizado',          emoji: '🕶️', color: 'indigo' },
  { id: 'planchado',        label: 'Planchado y Pintura', emoji: '🎨', color: 'red' },
  { id: 'otro',             label: 'Otro',                emoji: '🔧', color: 'green' },
]

const COLOR_MAP = {
  blue:   { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-600 dark:text-blue-400',   border: 'border-blue-200 dark:border-blue-800',   dot: 'bg-blue-500' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800', dot: 'bg-orange-500' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800', dot: 'bg-purple-500' },
  cyan:   { bg: 'bg-cyan-100 dark:bg-cyan-900/30',   text: 'text-cyan-600 dark:text-cyan-400',   border: 'border-cyan-200 dark:border-cyan-800',   dot: 'bg-cyan-500' },
  gray:   { bg: 'bg-gray-100 dark:bg-gray-800',      text: 'text-gray-600 dark:text-gray-300',   border: 'border-gray-200 dark:border-gray-700',   dot: 'bg-gray-500' },
  indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800', dot: 'bg-indigo-500' },
  red:    { bg: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-600 dark:text-red-400',     border: 'border-red-200 dark:border-red-800',     dot: 'bg-red-500' },
  green:  { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800', dot: 'bg-green-500' },
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date(); today.setHours(0,0,0,0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const target = new Date(y, m - 1, d)

  if (target.getTime() === today.getTime()) return 'Hoy'
  if (target.getTime() === tomorrow.getTime()) return 'Mañana'

  return date.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function isPast(dateStr, timeStr) {
  const now = new Date()
  const [y, m, d] = dateStr.split('-').map(Number)
  const [h, min] = (timeStr || '23:59').split(':').map(Number)
  return new Date(y, m - 1, d, h, min) < now
}

function CitaSheet({ cita, onClose, onSave }) {
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(cita || {
    date: todayISO(), time: '', service: '', client: '', notes: '',
    adelanto: '', adelantoMetodo: ''
  })

  const TIME_SLOTS = []
  for (let h = 7; h <= 21; h++) {
    TIME_SLOTS.push(`${String(h).padStart(2,'0')}:00`)
    if (h < 21) TIME_SLOTS.push(`${String(h).padStart(2,'0')}:30`)
  }

  function formatSlot(t) {
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`
  }

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function handleClose() { setClosing(true); setTimeout(onClose, 200) }

  async function handleSave() {
    if (!form.date || !form.time || !form.service) {
      toast.error('Completa fecha, hora y servicio'); return
    }
    setBusy(true)
    try {
      await onSave(form)
      handleClose()
    } catch { toast.error('Error al guardar') }
    finally { setBusy(false) }
  }

  const show = mounted && !closing

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose} />
      <div className={`relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl p-5 space-y-4 pb-8 transition-transform duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] ${show ? 'translate-y-0' : 'translate-y-full'}`}>

        <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto -mt-1 mb-2" />

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {cita?.id ? 'Editar cita' : 'Nueva cita'}
          </h2>
          <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Fecha y hora */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Fecha</label>
            <input type="date" className="input" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Hora</label>
            <input type="time" step="1800" className="input" value={form.time}
              onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
          </div>
        </div>

        {/* Servicio */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">Servicio</label>
          <div className="grid grid-cols-2 gap-2">
            {SERVICIOS.map(s => (
              <button key={s.id} type="button"
                onClick={() => setForm(f => ({ ...f, service: s.id }))}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  form.service === s.id
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                }`}>
                <span>{s.emoji}</span> <span className="truncate">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Descripción si elige "Otro" */}
        {form.service === 'otro' && (
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">¿Qué servicio?</label>
            <input className="input" placeholder="Describe el servicio..."
              value={form.serviceDesc || ''} onChange={e => setForm(f => ({ ...f, serviceDesc: e.target.value }))} autoFocus />
          </div>
        )}

        {/* Cliente */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Cliente / Placa</label>
          <input className="input" placeholder="Ej: Carlos Ruiz · ABC-123"
            value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} />
        </div>

        {/* Notas */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">Notas (opcional)</label>
          <textarea className="input resize-none" rows={2} placeholder="Instrucciones especiales..."
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>

        {/* Adelanto */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">Adelanto (opcional)</label>
          <div className="flex gap-2">
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-sm text-gray-500">S/</span>
              <input type="number" min="0" step="1" placeholder="0.00" className="input flex-1"
                value={form.adelanto || ''} onChange={e => setForm(f => ({ ...f, adelanto: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              {['Efectivo', 'Yape'].map(m => (
                <button key={m} type="button"
                  onClick={() => setForm(f => ({ ...f, adelantoMetodo: f.adelantoMetodo === m ? '' : m }))}
                  className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    form.adelantoMetodo === m
                      ? m === 'Yape'
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                  {m === 'Yape' ? '💜 Yape' : '💵 Efectivo'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={handleSave} disabled={busy}
          className="w-full py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-bold transition-all">
          {busy ? 'Guardando…' : cita?.id ? 'Guardar cambios' : 'Agregar cita'}
        </button>
      </div>
    </div>
  )
}

function CitaCard({ cita, canAdmin, onEdit, onDelete, onStatus }) {
  const svc = SERVICIOS.find(s => s.id === cita.service) || SERVICIOS[SERVICIOS.length - 1]
  const c = COLOR_MAP[svc.color]
  const past = isPast(cita.date, cita.time)
  const isToday = cita.date === todayISO()
  const status = cita.status || 'pending' // 'pending' | 'arrived' | 'no_show'

  const statusCfg = {
    pending:  { label: 'Pendiente', icon: Circle,        cls: 'text-gray-400' },
    arrived:  { label: 'Llegó',     icon: CheckCircle2,  cls: 'text-emerald-500' },
    no_show:  { label: 'No llegó',  icon: XCircle,       cls: 'text-red-500' },
  }
  const sc = statusCfg[status]

  // Borde especial según estado
  const cardBorder = status === 'arrived'
    ? 'border-emerald-400 dark:border-emerald-600'
    : status === 'no_show'
    ? 'border-red-400 dark:border-red-700'
    : past ? 'border-gray-200 dark:border-gray-700' : c.border

  const cardBg = status === 'arrived'
    ? 'bg-emerald-50 dark:bg-emerald-900/10'
    : status === 'no_show'
    ? 'bg-red-50 dark:bg-red-900/10'
    : past ? 'bg-gray-50 dark:bg-gray-800/40' : 'bg-white dark:bg-gray-800'

  return (
    <div className={`relative rounded-2xl border p-4 transition-all ${cardBg} ${cardBorder} shadow-sm`}>
      {isToday && status === 'pending' && (
        <span className="absolute -top-2 left-4 text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
          Hoy
        </span>
      )}
      {status === 'arrived' && (
        <span className="absolute -top-2 left-4 text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
          ✓ Llegó
        </span>
      )}
      {status === 'no_show' && (
        <span className="absolute -top-2 left-4 text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
          ✗ No llegó
        </span>
      )}

      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center text-xl flex-shrink-0`}>
          {svc.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${c.text}`}>{cita.service === 'otro' && cita.serviceDesc ? cita.serviceDesc : svc.label}</p>
          {cita.client && (
            <p className="text-sm text-gray-700 dark:text-gray-300 font-medium truncate mt-0.5">{cita.client}</p>
          )}
          {cita.notes && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{cita.notes}</p>
          )}
          {cita.adelanto > 0 && (
            <p className="text-xs font-semibold mt-1">
              <span className={cita.adelantoMetodo === 'Yape' ? 'text-purple-500' : 'text-emerald-600'}>
                {cita.adelantoMetodo === 'Yape' ? '💜' : '💵'} Adelanto S/ {parseFloat(cita.adelanto).toFixed(2)}
              </span>
            </p>
          )}
        </div>

        {/* Acciones admin */}
        {canAdmin && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => onEdit(cita)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(cita.id)}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Hora + marcadores */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5">
          <Clock className={`w-3.5 h-3.5 ${sc.cls}`} />
          <span className={`text-sm font-bold ${sc.cls}`}>{formatTime(cita.time)}</span>
        </div>

        {/* Botones de estado */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onStatus(cita.id, status === 'arrived' ? 'pending' : 'arrived')}
            title="Marcar como llegó"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
              status === 'arrived'
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'border-gray-200 dark:border-gray-600 text-gray-400 hover:border-emerald-400 hover:text-emerald-500'
            }`}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Llegó</span>
          </button>
          <button
            onClick={() => onStatus(cita.id, status === 'no_show' ? 'pending' : 'no_show')}
            title="Marcar como no llegó"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
              status === 'no_show'
                ? 'bg-red-500 border-red-500 text-white'
                : 'border-gray-200 dark:border-gray-600 text-gray-400 hover:border-red-400 hover:text-red-500'
            }`}>
            <XCircle className="w-3.5 h-3.5" />
            <span>No llegó</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Citas() {
  const { isAdmin, isDemo } = useAuth()
  const canAdmin = isAdmin || isDemo

  const [citas, setCitas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('proximas') // 'proximas' | 'pasadas' | 'hoy'

  useEffect(() => { fetchCitas() }, [])

  async function fetchCitas() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'citas')
        .maybeSingle()
      if (!error && data?.value) setCitas(data.value)
    } catch {}
    setLoading(false)
  }

  async function saveCitas(next) {
    setCitas(next)
    await supabase.from('app_settings').upsert(
      { key: 'citas', value: next, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  }

  async function handleSave(form) {
    let next
    if (form.id) {
      next = citas.map(c => c.id === form.id ? form : c)
      toast.success('Cita actualizada')
    } else {
      const newCita = { ...form, id: `cita_${Date.now()}` }
      next = [...citas, newCita].sort((a, b) =>
        `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
      )
      toast.success('Cita agregada')
    }
    await saveCitas(next)
    setEditing(null)
  }

  async function handleDelete(id) {
    const next = citas.filter(c => c.id !== id)
    await saveCitas(next)
    toast.success('Cita eliminada')
  }

  async function handleStatus(id, newStatus) {
    const next = citas.map(c => c.id === id ? { ...c, status: newStatus } : c)
    await saveCitas(next)
    if (newStatus === 'arrived') toast.success('Marcado: llegó ✓')
    else if (newStatus === 'no_show') toast.error('Marcado: no llegó ✗')
    else toast('Pendiente', { icon: '⏳' })
  }

  const today = todayISO()

  const filtered = useMemo(() => {
    const sorted = [...citas].sort((a, b) =>
      `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
    )
    if (filter === 'hoy') return sorted.filter(c => c.date === today)
    if (filter === 'pasadas') return sorted.filter(c => isPast(c.date, c.time)).reverse()
    return sorted.filter(c => !isPast(c.date, c.time))
  }, [citas, filter, today])

  // Agrupar por fecha
  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach(c => {
      if (!map[c.date]) map[c.date] = []
      map[c.date].push(c)
    })
    return Object.entries(map).sort(([a], [b]) =>
      filter === 'pasadas' ? b.localeCompare(a) : a.localeCompare(b)
    )
  }, [filtered, filter])

  const proxCount = useMemo(() => citas.filter(c => !isPast(c.date, c.time)).length, [citas])
  const todayCount = useMemo(() => citas.filter(c => c.date === today).length, [citas, today])

  return (
    <div className="space-y-5 max-w-lg mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Citas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {proxCount > 0 ? `${proxCount} próxima${proxCount !== 1 ? 's' : ''}` : 'Sin citas próximas'}
          </p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-sm font-bold px-4 py-2.5 rounded-2xl shadow-md shadow-red-200 dark:shadow-red-900/30 transition-all">
          <Plus className="w-4 h-4" /> Nueva cita
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-3">
          <p className="text-2xl font-black text-gray-900 dark:text-white">{todayCount}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">Hoy</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-black text-red-600">{proxCount}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">Próximas</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-black text-gray-400">{citas.filter(c => isPast(c.date, c.time)).length}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">Pasadas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {[
          { id: 'proximas', label: 'Próximas' },
          { id: 'hoy',      label: 'Hoy' },
          { id: 'pasadas',  label: 'Pasadas' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              filter === f.id
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="card flex flex-col items-center py-14 text-center">
          <CalendarDays className="w-12 h-12 text-gray-200 dark:text-gray-700 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            {filter === 'hoy' ? 'No hay citas para hoy' : filter === 'pasadas' ? 'No hay citas pasadas' : 'No hay citas próximas'}
          </p>
          {filter !== 'pasadas' && (
            <button onClick={() => { setEditing(null); setShowForm(true) }}
              className="mt-4 text-sm text-red-600 font-semibold hover:underline">
              + Agregar cita
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, items]) => (
            <div key={date}>
              {/* Separador de fecha */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${date === today ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  <span className={`text-sm font-bold capitalize ${
                    date === today ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'
                  }`}>{formatDate(date)}</span>
                </div>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs text-gray-400">{items.length} cita{items.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-3">
                {items.map(cita => (
                  <CitaCard key={cita.id} cita={cita} canAdmin={canAdmin}
                    onEdit={c => { setEditing(c); setShowForm(true) }}
                    onDelete={handleDelete}
                    onStatus={handleStatus} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sheet de crear/editar */}
      {showForm && (
        <CitaSheet
          cita={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
