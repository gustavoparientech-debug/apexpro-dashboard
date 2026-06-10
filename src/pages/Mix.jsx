import { useMemo, useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import {
  formatMoney, calcRealSalary, getWorkingDaysRemaining,
  getWorkingDaysElapsed, getWorkingDaysInMonth, currentMonthYear, monthName
} from '../lib/utils'
import {
  Droplets, Truck, Sparkles, Star, Shield, TrendingUp,
  Car, Layers, Settings, Plus, Trash2, X, Check, PenLine
} from 'lucide-react'

// ─── Defaults del negocio ────────────────────────────────────────────────────
const DEFAULTS = [
  { id: 'autos',         label: 'Lavado auto',       qty: 25, price: 70,   color: 'blue',   catKey: 'basico',        isWash: true },
  { id: 'suvs',          label: 'Lavado SUV',         qty: 30, price: 95,   color: 'blue',   catKey: 'basico',        isWash: true },
  { id: 'offroads',      label: 'Offroad / Pickup',   qty: 35, price: 55,   color: 'orange', catKey: 'offroad',       isWash: true },
  { id: 'detallados',    label: 'Detallado',           qty: 5,  price: 350,  color: 'purple', catKey: 'detallado',     isWash: false },
  { id: 'ceramicos',     label: 'Cerámico',            qty: 2,  price: 600,  color: 'red',    catKey: 'ceramico',      isWash: false },
  { id: 'abrillantados', label: 'Abrillantado',        qty: 4,  price: 130,  color: 'yellow', catKey: 'abrillantado',  isWash: false },
  { id: 'polarizados',   label: 'Polarizado',          qty: 1,  price: 450,  color: 'gray',   catKey: 'polarizado',    isWash: false },
  { id: 'ppf',           label: 'PPF',                 qty: 0,  price: 1500, color: 'gray',   catKey: 'ppf',           isWash: false },
]

const COLORS_AVAILABLE = ['blue','orange','purple','yellow','red','gray','green','pink']

const COLOR = {
  blue:   { bg: 'bg-blue-50 dark:bg-blue-900/20',    text: 'text-blue-600 dark:text-blue-400',    bar: 'bg-blue-500',    chip: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'   },
  orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', bar: 'bg-orange-500',  chip: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', bar: 'bg-purple-500',  chip: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
  yellow: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400', bar: 'bg-yellow-400',  chip: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
  red:    { bg: 'bg-red-50 dark:bg-red-900/20',      text: 'text-red-600 dark:text-red-400',      bar: 'bg-red-500',     chip: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'       },
  gray:   { bg: 'bg-gray-50 dark:bg-gray-800',       text: 'text-gray-600 dark:text-gray-400',    bar: 'bg-gray-400',    chip: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'       },
  green:  { bg: 'bg-green-50 dark:bg-green-900/20',  text: 'text-green-600 dark:text-green-400',  bar: 'bg-green-500',   chip: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  pink:   { bg: 'bg-pink-50 dark:bg-pink-900/20',    text: 'text-pink-600 dark:text-pink-400',    bar: 'bg-pink-500',    chip: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300'    },
}

// ─── Persistencia en localStorage ────────────────────────────────────────────
function loadItems() {
  try {
    const raw = localStorage.getItem('mix_items_v2')
    if (raw) return JSON.parse(raw)
  } catch {}
  return DEFAULTS.map(d => ({ ...d }))
}
function saveItems(items) {
  try { localStorage.setItem('mix_items_v2', JSON.stringify(items)) } catch {}
}

// ─── Fila de servicio en composición ─────────────────────────────────────────
function SvcRow({ label, color, actual, typical, income }) {
  const C = COLOR[color] || COLOR.gray
  const pct = Math.min(100, (actual / Math.max(typical, 1)) * 100)
  const done = actual >= typical
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
          <span className="text-xs text-gray-500 flex-none ml-2">{formatMoney(income)}</span>
        </div>
        {typical > 0 ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
              <div className={`h-full rounded-full transition-all ${C.bar}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-xs font-bold flex-none w-14 text-right ${done ? 'text-green-600 dark:text-green-400' : C.text}`}>
              {actual}/{typical}{done ? ' ✓' : ''}
            </span>
          </div>
        ) : (
          <p className="text-xs text-gray-400">{actual} realizados este mes</p>
        )}
      </div>
    </div>
  )
}

// ─── Tarjeta de propuesta ─────────────────────────────────────────────────────
function ProposalCard({ title, subtitle, badge, icon: Icon, colorKey, items, totalIncome, svcPerDay, daysLeft, gap }) {
  const CARD = {
    blue:  { border: 'border-blue-200 dark:border-blue-800',  bg: 'bg-blue-50 dark:bg-blue-900/10',  text: 'text-blue-600 dark:text-blue-400',  icon: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30'  },
    green: { border: 'border-green-200 dark:border-green-800', bg: 'bg-green-50 dark:bg-green-900/10', text: 'text-green-600 dark:text-green-400', icon: 'text-green-500 bg-green-100 dark:bg-green-900/30' },
    red:   { border: 'border-red-200 dark:border-red-800',    bg: 'bg-red-50 dark:bg-red-900/10',    text: 'text-red-600 dark:text-red-400',    icon: 'text-red-500 bg-red-100 dark:bg-red-900/30'    },
  }
  const C = CARD[colorKey]
  return (
    <div className={`rounded-2xl border-2 p-4 space-y-3 ${C.bg} ${C.border}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl ${C.icon} flex-none mt-0.5`}><Icon className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">
          <p className={`font-bold ${C.text}`}>{title}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-snug">{subtitle}</p>
          {badge && <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${C.icon}`}>{badge}</span>}
        </div>
        <div className="text-right flex-none">
          <p className="text-[10px] text-gray-400">Genera</p>
          <p className={`font-black text-base ${C.text}`}>{formatMoney(totalIncome)}</p>
        </div>
      </div>
      <div className="bg-white/70 dark:bg-gray-900/50 rounded-xl p-3 space-y-2">
        {items.length === 0
          ? <p className="text-xs text-gray-400 text-center py-1">Sin servicios adicionales necesarios</p>
          : items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="flex-1 text-gray-700 dark:text-gray-300 leading-tight">{item.label}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-none ${C.icon}`}>×{item.qty}</span>
              <span className="text-xs text-gray-500 w-20 text-right flex-none">{formatMoney(item.income)}</span>
            </div>
          ))
        }
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/70 dark:bg-gray-900/50 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-gray-500">Svc extra/día</p>
          <p className={`text-xl font-black ${C.text}`}>{svcPerDay <= 0 ? '—' : svcPerDay.toFixed(1)}</p>
        </div>
        <div className="bg-white/70 dark:bg-gray-900/50 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-gray-500">Días disponibles</p>
          <p className={`text-xl font-black ${C.text}`}>{daysLeft}</p>
        </div>
      </div>
      <div className={`border-t ${C.border} pt-2.5 flex justify-between items-center`}>
        <span className="text-xs text-gray-500">Cubre la brecha de</span>
        <span className={`font-bold ${C.text}`}>{formatMoney(gap)}</span>
      </div>
    </div>
  )
}

// ─── Modal de configuración ───────────────────────────────────────────────────
function ConfigModal({ items, onSave, onClose }) {
  const [draft, setDraft] = useState(items.map(i => ({ ...i })))
  const [newItem, setNewItem] = useState({ label: '', qty: '', price: '', color: 'green' })
  const [addingNew, setAddingNew] = useState(false)

  function update(id, field, val) {
    setDraft(d => d.map(i => i.id === id ? { ...i, [field]: field === 'qty' || field === 'price' ? (val === '' ? '' : Number(val)) : val } : i))
  }
  function removeItem(id) {
    setDraft(d => d.filter(i => i.id !== id))
  }
  function addItem() {
    if (!newItem.label || !newItem.price) return
    const id = 'custom_' + Date.now()
    setDraft(d => [...d, {
      id, label: newItem.label,
      qty: Number(newItem.qty) || 0,
      price: Number(newItem.price) || 0,
      color: newItem.color,
      catKey: null, isWash: false, custom: true,
    }])
    setNewItem({ label: '', qty: '', price: '', color: 'green' })
    setAddingNew(false)
  }

  const C_PICKER = {
    blue: 'bg-blue-500', orange: 'bg-orange-500', purple: 'bg-purple-500',
    yellow: 'bg-yellow-400', red: 'bg-red-500', gray: 'bg-gray-400',
    green: 'bg-green-500', pink: 'bg-pink-500',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-t-3xl lg:rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="font-bold text-gray-900 dark:text-white">Configurar Mix</p>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-xs text-gray-400 mb-3">Edita la cantidad mensual típica y el precio promedio de cada servicio.</p>

          {/* Header columnas */}
          <div className="grid grid-cols-[1fr_72px_80px_32px] gap-2 px-1 mb-1">
            <span className="text-xs text-gray-400 font-medium">Servicio</span>
            <span className="text-xs text-gray-400 font-medium text-center">Qty/mes</span>
            <span className="text-xs text-gray-400 font-medium text-center">Precio S/</span>
            <span />
          </div>

          {draft.map(item => {
            const C = COLOR[item.color] || COLOR.gray
            return (
              <div key={item.id} className={`grid grid-cols-[1fr_72px_80px_32px] gap-2 items-center p-2 rounded-xl ${C.bg}`}>
                {/* Nombre */}
                <div className="flex items-center gap-2 min-w-0">
                  {/* Color dot */}
                  <select
                    value={item.color}
                    onChange={e => update(item.id, 'color', e.target.value)}
                    className="w-6 h-6 rounded-full border-0 cursor-pointer p-0 appearance-none text-[0px] flex-none"
                    style={{ background: C_PICKER[item.color] || '#9ca3af' }}
                    title="Color"
                  >
                    {COLORS_AVAILABLE.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{item.label}</span>
                </div>
                {/* Qty */}
                <input
                  type="number" min="0" step="1"
                  value={item.qty}
                  onChange={e => update(item.id, 'qty', e.target.value)}
                  className="w-full text-center text-sm font-bold bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                {/* Price */}
                <input
                  type="number" min="0" step="1"
                  value={item.price}
                  onChange={e => update(item.id, 'price', e.target.value)}
                  className="w-full text-center text-sm font-bold bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                {/* Delete (solo custom o si quiere borrar) */}
                <button onClick={() => removeItem(item.id)}
                  className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            )
          })}

          {/* Agregar ítem */}
          {addingNew ? (
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-500">Nuevo ítem</p>
              <input
                type="text" placeholder="Nombre del servicio"
                value={newItem.label}
                onChange={e => setNewItem(n => ({ ...n, label: e.target.value }))}
                className="w-full input text-sm"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label text-xs">Qty/mes objetivo</label>
                  <input type="number" min="0" step="1" placeholder="0"
                    value={newItem.qty}
                    onChange={e => setNewItem(n => ({ ...n, qty: e.target.value }))}
                    className="input text-sm" />
                </div>
                <div>
                  <label className="label text-xs">Precio S/</label>
                  <input type="number" min="0" step="1" placeholder="0"
                    value={newItem.price}
                    onChange={e => setNewItem(n => ({ ...n, price: e.target.value }))}
                    className="input text-sm" />
                </div>
              </div>
              <div>
                <label className="label text-xs">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS_AVAILABLE.map(c => (
                    <button key={c} onClick={() => setNewItem(n => ({ ...n, color: c }))}
                      className={`w-6 h-6 rounded-full transition-all ${C_PICKER[c]} ${newItem.color === c ? 'ring-2 ring-offset-2 ring-gray-400' : 'opacity-60 hover:opacity-100'}`} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setAddingNew(false)} className="btn-secondary flex-1 text-sm py-2">Cancelar</button>
                <button onClick={addItem} disabled={!newItem.label || !newItem.price}
                  className="btn-primary flex-1 text-sm py-2 disabled:opacity-40">
                  <Check className="w-4 h-4 inline mr-1" />Agregar
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingNew(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-400 hover:text-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
              <Plus className="w-4 h-4" /> Agregar ítem al mix
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={() => { onSave(draft); onClose() }} className="btn-primary flex-1">
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Mix() {
  const { tickets, dailySummaries, workers, services, incidents, monthlyCosts, bonuses } = useApp()
  const { month, year } = currentMonthYear()
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const [showConfig, setShowConfig] = useState(false)
  const [items, setItems] = useState(loadItems)

  const saveAndSet = useCallback((newItems) => {
    setItems(newItems)
    saveItems(newItems)
  }, [])

  const data = useMemo(() => {
    // ── Meta y costos ───────────────────────────────────────────────────────
    const rent        = monthlyCosts?.rent     || 0
    const supplies    = monthlyCosts?.supplies || 0
    const utilityGoal = monthlyCosts?.utility_goal || 2000
    const payroll = workers.filter(w => w.active).reduce((s, w) => {
      const real = calcRealSalary(w.base_salary, w.weekly_hours)
      const disc = incidents.filter(i => i.worker_id === w.id && i.apply_discount && i.date?.startsWith(prefix))
        .reduce((d, i) => d + (i.discount_amount || 0), 0)
      return s + real - disc
    }, 0)
    const monthBonus = bonuses.filter(b => b.date?.startsWith(prefix)).reduce((s, b) => s + b.amount, 0)
    const incomeGoal = rent + supplies + payroll + monthBonus + utilityGoal

    // ── Ingresos actuales ───────────────────────────────────────────────────
    const mTickets   = tickets.filter(t => t.date?.startsWith(prefix) && t.status !== 'abierto')
    const mSummaries = dailySummaries.filter(d => d.date?.startsWith(prefix))
    const currentIncome = mTickets.reduce((s, t) => s + (t.price_charged || 0), 0)
                        + mSummaries.reduce((s, d) => s + (d.total_income || 0), 0)
    const gap = Math.max(0, incomeGoal - currentIncome)

    // ── Días ────────────────────────────────────────────────────────────────
    const daysTotal   = getWorkingDaysInMonth(year, month)
    const daysElapsed = getWorkingDaysElapsed(year, month)
    const daysLeft    = getWorkingDaysRemaining(year, month)

    // ── Conteo real del mes por catKey ───────────────────────────────────────
    const cntByCat = {}
    const incByCat = {}
    mTickets.forEach(t => {
      const svc = services.find(s => s.id === t.service_id)
      const cat = svc?.category || 'basico'
      cntByCat[cat] = (cntByCat[cat] || 0) + 1
      incByCat[cat] = (incByCat[cat] || 0) + (t.price_charged || 0)
    })

    // ── Composición del mes por ítem configurado ─────────────────────────────
    // Para lavados (wash): distribuir en proporción a los totales configurados
    const washItems   = items.filter(i => i.isWash)
    const nonWashItems = items.filter(i => !i.isWash)
    const totalWashes  = (cntByCat['basico'] || 0) + (cntByCat['offroad'] || 0)
    const totalWashQty = washItems.reduce((s, i) => s + (i.qty || 0), 0)

    const composition = items.map(item => {
      let actual, income
      if (item.isWash) {
        const ratio = totalWashQty > 0 ? (item.qty / totalWashQty) : 0
        actual = Math.round(totalWashes * ratio)
        income = actual * item.price
      } else {
        actual = cntByCat[item.catKey] || 0
        income = incByCat[item.catKey] || actual * item.price
      }
      return { ...item, actual, income }
    })

    const typicalMonthly = items.reduce((s, i) => s + i.qty * i.price, 0)

    // ── Propuestas ────────────────────────────────────────────────────────────
    // Ordena por precio desc para usarlos en propuestas
    const nonWash = composition.filter(i => !i.isWash && i.qty > 0)
    const sorted  = [...nonWash].sort((a, b) => b.price - a.price)
    const wash    = composition.filter(i => i.isWash)

    // -- Propuesta 1: Solo volumen de lavados --
    const washPriceAvg  = washItems.reduce((s, i) => s + i.price * i.qty, 0) / Math.max(1, totalWashQty)
    const extraWash1    = gap > 0 ? Math.ceil(gap / washPriceAvg) : 0
    // Distribuir extra en proporciones iguales a las configuradas
    const vol1Items = washItems.map(wi => {
      const ratio = totalWashQty > 0 ? wi.qty / totalWashQty : 1 / washItems.length
      const qty   = gap > 0 ? Math.ceil(extraWash1 * ratio) : 0
      return qty > 0 ? { label: wi.label, qty, income: qty * wi.price } : null
    }).filter(Boolean)
    const inc1    = vol1Items.reduce((s, i) => s + i.income, 0)
    const svcD1   = daysLeft > 0 ? vol1Items.reduce((s, i) => s + i.qty, 0) / daysLeft : 0

    // -- Propuesta 2: Mixto (pendientes premium + washes) --
    const mix2Items = []
    let rem2 = gap
    nonWash.filter(i => !i.catKey || i.catKey !== 'ppf').forEach(item => {
      const pend = Math.max(0, item.qty - item.actual)
      if (pend > 0 && rem2 > 0) {
        mix2Items.push({ label: item.label, qty: pend, income: pend * item.price })
        rem2 -= pend * item.price
      }
    })
    if (rem2 > 0 && wash.length > 0) {
      const extraW = Math.ceil(rem2 / Math.max(1, washPriceAvg))
      if (extraW > 0) mix2Items.push({ label: 'Lavados (mix)', qty: extraW, income: extraW * washPriceAvg })
    }
    const inc2  = Math.min(gap + gap * 0.05, mix2Items.reduce((s, i) => s + i.income, 0))
    const svcD2 = daysLeft > 0 ? mix2Items.reduce((s, i) => s + i.qty, 0) / daysLeft : 0

    // -- Propuesta 3: Pro Premium (PPF + más caros) --
    const prem3Items = []
    let rem3 = gap
    // Primero PPF si está configurado
    const ppfItem = items.find(i => i.catKey === 'ppf' && i.price > 0)
    if (ppfItem && rem3 > 0) {
      prem3Items.push({ label: ppfItem.label, qty: 1, income: ppfItem.price })
      rem3 -= ppfItem.price
    }
    // Luego los más caros del resto
    sorted.filter(i => i.catKey !== 'ppf').forEach(item => {
      if (rem3 <= 0) return
      const qty = Math.ceil(rem3 / item.price)
      if (qty > 0) { prem3Items.push({ label: item.label, qty, income: qty * item.price }); rem3 -= qty * item.price }
    })
    const inc3  = prem3Items.reduce((s, i) => s + i.income, 0)
    const svcD3 = daysLeft > 0 ? prem3Items.reduce((s, i) => s + i.qty, 0) / daysLeft : 0

    return {
      incomeGoal, currentIncome, gap, daysTotal, daysElapsed, daysLeft,
      composition, washItems, nonWashItems, totalWashes, typicalMonthly,
      proposals: {
        volumen: { items: vol1Items, totalIncome: inc1, svcPerDay: svcD1, daysLeft, gap },
        mixto:   { items: mix2Items, totalIncome: inc2, svcPerDay: svcD2, daysLeft, gap },
        premium: { items: prem3Items, totalIncome: inc3, svcPerDay: svcD3, daysLeft, gap },
      },
    }
  }, [tickets, dailySummaries, workers, services, incidents, monthlyCosts, bonuses, prefix, month, year, items])

  const metAlcanzada = data.gap <= 0

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mix del mes</h1>
          <p className="text-sm text-gray-500">{monthName(month)} {year} · Composición y estrategia</p>
        </div>
        <button onClick={() => setShowConfig(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors">
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Configurar Mix</span>
        </button>
      </div>

      {/* Brecha / Meta */}
      {metAlcanzada ? (
        <div className="card border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 text-center py-8">
          <p className="text-3xl mb-2">🎉</p>
          <p className="font-bold text-green-700 dark:text-green-400 text-lg">¡Meta del mes alcanzada!</p>
          <p className="text-sm text-green-600 dark:text-green-500 mt-1">
            {formatMoney(data.currentIncome)} generados · meta {formatMoney(data.incomeGoal)}
          </p>
        </div>
      ) : (
        <div className="card border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl flex-none">
              <TargetIcon className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-red-700 dark:text-red-400 text-sm">Brecha para alcanzar la meta</p>
              <p className="text-3xl font-black text-red-600 dark:text-red-400">{formatMoney(data.gap)}</p>
              <p className="text-xs text-red-500 mt-0.5">
                {data.daysLeft} días hábiles restantes · necesitas {formatMoney(data.gap / Math.max(1, data.daysLeft))}/día en extra
              </p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-500">Acumulado</p>
              <p className="font-bold text-gray-800 dark:text-gray-200">{formatMoney(data.currentIncome)}</p>
              <p className="text-xs text-gray-400">de {formatMoney(data.incomeGoal)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Composición del mes */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-red-500" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">Composición del mes</p>
          <span className="text-xs text-gray-400 ml-auto">{data.daysElapsed}/{data.daysTotal} días trabajados</span>
        </div>

        {/* Lavados — bloque con sub-barras por tipo */}
        {data.washItems.length > 0 && (
          <div className="mb-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Lavados</span>
              </div>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                {data.totalWashes} este mes
              </span>
            </div>
            {data.composition.filter(i => i.isWash).map(item => {
              const C = COLOR[item.color] || COLOR.blue
              const pct = Math.min(100, (item.actual / Math.max(item.qty, 1)) * 100)
              return (
                <div key={item.id} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-32 flex-none truncate">{item.label}</span>
                  <div className="flex-1 bg-blue-100 dark:bg-blue-900/30 rounded-full h-1.5">
                    <div className={`h-full rounded-full ${C.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`text-xs font-bold flex-none w-14 text-right ${item.actual >= item.qty ? 'text-green-600 dark:text-green-400' : C.text}`}>
                    {item.actual}/{item.qty}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Servicios premium */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {data.composition.filter(i => !i.isWash).map(item => (
            <SvcRow key={item.id}
              label={item.label} color={item.color}
              actual={item.actual} typical={item.qty} income={item.income} />
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <div>
            <span className="text-sm text-gray-500">Total generado</span>
            <span className="text-xs text-gray-400 ml-2">· típico {formatMoney(data.typicalMonthly)}</span>
          </div>
          <span className="text-base font-black text-gray-900 dark:text-white">{formatMoney(data.currentIncome)}</span>
        </div>
      </div>

      {/* Propuestas */}
      {!metAlcanzada && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Servicios extra para cerrar la brecha</p>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          </div>
          <p className="text-xs text-gray-400 -mt-3 text-center">Solo se muestran los servicios adicionales necesarios sobre lo ya generado.</p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ProposalCard title="Volumen" subtitle="Cerrar solo con lavados. El más fácil de ejecutar."
              badge="Más fácil" icon={Droplets} colorKey="blue" {...data.proposals.volumen} />
            <ProposalCard title="Mixto" subtitle="Completa los servicios premium pendientes y ajusta con lavados."
              badge="Recomendado" icon={Sparkles} colorKey="green" {...data.proposals.mixto} />
            <ProposalCard title="Pro Premium" subtitle="PPF + cerámicos. Menos servicios, mayor ticket por unidad."
              badge="Mayor ingreso x servicio" icon={Shield} colorKey="red" {...data.proposals.premium} />
          </div>
        </>
      )}

      {/* Modal de configuración */}
      {showConfig && (
        <ConfigModal
          items={items}
          onSave={saveAndSet}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  )
}

function TargetIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  )
}
