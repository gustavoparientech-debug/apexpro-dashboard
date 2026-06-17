import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Edit2, Check, X, ChevronDown, ChevronUp, FileText, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'

// ─── Configuración por defecto ────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  basePrices: { economy: 250, standard: 290, premium: 350 },
  panels: [
    { id: 'guardafango_del_izq', label: 'Guardafango Del. Izq.', mult: { auto: 1,   suv: 1.2, pickup: 1.3 } },
    { id: 'guardafango_del_der', label: 'Guardafango Del. Der.', mult: { auto: 1,   suv: 1.2, pickup: 1.3 } },
    { id: 'guardafango_tra_izq', label: 'Guardafango Tra. Izq.', mult: { auto: 1,   suv: 1.2, pickup: 1.3 } },
    { id: 'guardafango_tra_der', label: 'Guardafango Tra. Der.', mult: { auto: 1,   suv: 1.2, pickup: 1.3 } },
    { id: 'capot',               label: 'Capot',                 mult: { auto: 2.5, suv: 3,   pickup: 3.5 } },
    { id: 'techo',               label: 'Techo',                 mult: { auto: 2.5, suv: 3.5, pickup: 3   } },
    { id: 'maletero',            label: 'Maletero / Tapa caja',  mult: { auto: 2,   suv: 2.5, pickup: 2   } },
    { id: 'puerta_del_izq',      label: 'Puerta Del. Izq.',      mult: { auto: 1.5, suv: 1.8, pickup: 1.8 } },
    { id: 'puerta_del_der',      label: 'Puerta Del. Der.',      mult: { auto: 1.5, suv: 1.8, pickup: 1.8 } },
    { id: 'puerta_tra_izq',      label: 'Puerta Tra. Izq.',      mult: { auto: 1.5, suv: 1.8, pickup: 1.8 } },
    { id: 'puerta_tra_der',      label: 'Puerta Tra. Der.',      mult: { auto: 1.5, suv: 1.8, pickup: 1.8 } },
    { id: 'parachoque_del',      label: 'Parachoque Delantero',  mult: { auto: 1.5, suv: 1.8, pickup: 2   } },
    { id: 'parachoque_tra',      label: 'Parachoque Trasero',    mult: { auto: 1.5, suv: 1.8, pickup: 2   } },
    { id: 'aleta_tra_izq',       label: 'Aleta Trasera Izq.',    mult: { auto: 1,   suv: 1.3, pickup: 1.4 } },
    { id: 'aleta_tra_der',       label: 'Aleta Trasera Der.',    mult: { auto: 1,   suv: 1.3, pickup: 1.4 } },
    { id: 'estribo_izq',         label: 'Estribo Izq.',          mult: { auto: 0.5, suv: 0.7, pickup: 0.8 } },
    { id: 'estribo_der',         label: 'Estribo Der.',          mult: { auto: 0.5, suv: 0.7, pickup: 0.8 } },
  ],
}

const BRANDS = [
  { tier: 'economy',  label: 'Economy',  brands: ['Toyota', 'Hyundai', 'Kia', 'Nissan', 'Chevrolet', 'Renault', 'Suzuki', 'Dacia', 'Fiat'] },
  { tier: 'standard', label: 'Standard', brands: ['Honda', 'Mazda', 'Ford', 'Volkswagen', 'Subaru', 'Mitsubishi', 'Peugeot', 'Citroën', 'Seat'] },
  { tier: 'premium',  label: 'Premium',  brands: ['BMW', 'Mercedes-Benz', 'Audi', 'Lexus', 'Volvo', 'Porsche', 'Jeep', 'Land Rover', 'Infiniti', 'Cadillac'] },
]

const VEHICLE_TYPES = [
  { id: 'auto',   label: 'Auto',   emoji: '🚗' },
  { id: 'suv',    label: 'SUV',    emoji: '🚙' },
  { id: 'pickup', label: 'Pickup', emoji: '🛻' },
]

const DAMAGE_LEVELS = [
  { id: 'none',     label: 'Solo pintura', short: '—',        pct: 0,   color: 'border-gray-200 text-gray-500 dark:border-gray-600 dark:text-gray-400' },
  { id: 'leve',     label: 'Leve',         short: 'Leve',     pct: 0.3, color: 'border-yellow-400 text-yellow-700 dark:border-yellow-600 dark:text-yellow-400' },
  { id: 'moderado', label: 'Moderado',     short: 'Mod.',     pct: 0.6, color: 'border-orange-400 text-orange-700 dark:border-orange-500 dark:text-orange-400' },
  { id: 'severo',   label: 'Severo',       short: 'Severo',   pct: 1.0, color: 'border-red-500 text-red-700 dark:border-red-500 dark:text-red-400' },
]

const LS_KEY = 'apexpro_presupuesto_config'
const SB_KEY = 'presupuesto_config'

function mergeConfig(saved) {
  if (!saved) return DEFAULT_CONFIG
  return {
    basePrices: { ...DEFAULT_CONFIG.basePrices, ...saved.basePrices },
    panels: DEFAULT_CONFIG.panels.map(p => {
      const sp = saved.panels?.find(x => x.id === p.id)
      return sp ? { ...p, mult: { ...p.mult, ...sp.mult } } : p
    }),
  }
}

function formatMoney(n) {
  return `S/ ${Number(n).toFixed(2)}`
}

// ─── Editar celda inline ──────────────────────────────────────────────────────
function EditableCell({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(value))

  function handleSave() {
    const n = parseFloat(val)
    if (isNaN(n) || n <= 0) { toast.error('Valor inválido'); return }
    onSave(n)
    setEditing(false)
  }

  if (!editing) return (
    <button onClick={() => { setVal(String(value)); setEditing(true) }}
      className="flex items-center gap-1 text-red-500 dark:text-red-400 font-mono text-xs hover:underline">
      {value}<Edit2 className="w-2.5 h-2.5" />
    </button>
  )
  return (
    <div className="flex items-center gap-1">
      <input type="number" step="0.1" min="0.1" value={val} onChange={e => setVal(e.target.value)}
        className="w-14 text-xs border border-red-400 rounded px-1 py-0.5 font-mono dark:bg-gray-800 dark:text-white"
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
        autoFocus />
      <button onClick={handleSave} className="text-green-600"><Check className="w-3.5 h-3.5" /></button>
      <button onClick={() => setEditing(false)} className="text-red-500"><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Presupuesto() {
  const { isAdmin, isDemo } = useAuth()
  const canAdmin = isAdmin || isDemo

  const [config, setConfig] = useState(() => mergeConfig(null))
  const [loading, setLoading] = useState(true)
  const [vehicleType, setVehicleType] = useState('auto')
  const [selectedTier, setSelectedTier] = useState('economy')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selected, setSelected] = useState({})
  const [damage, setDamage] = useState({}) // panelId -> 'none'|'leve'|'moderado'|'severo'
  const [editingPrices, setEditingPrices] = useState(false)
  const [pricesDraft, setPricesDraft] = useState(config.basePrices)
  const [showBrands, setShowBrands] = useState(false)

  // Cargar config desde Supabase
  useEffect(() => {
    async function load() {
      // Mostrar localStorage mientras carga Supabase
      const raw = localStorage.getItem(LS_KEY)
      if (raw) setConfig(mergeConfig(JSON.parse(raw)))

      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', SB_KEY)
        .maybeSingle()

      if (error) {
        toast.error(`Error al cargar: ${error.message}`)
      } else if (data?.value) {
        const merged = mergeConfig(data.value)
        setConfig(merged)
        localStorage.setItem(LS_KEY, JSON.stringify(data.value))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function persistConfig(cfg) {
    setConfig(cfg)
    localStorage.setItem(LS_KEY, JSON.stringify(cfg))
    const { error } = await supabase.from('app_settings').upsert(
      { key: SB_KEY, value: cfg, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    if (error) {
      toast.error(`Error al guardar: ${error.message}`)
    } else {
      toast.success('Guardado en la nube ✓')
    }
  }

  const basePrice = config.basePrices[selectedTier]

  function updateMult(panelId, vt, val) {
    const newPanels = config.panels.map(p =>
      p.id === panelId ? { ...p, mult: { ...p.mult, [vt]: val } } : p
    )
    persistConfig({ ...config, panels: newPanels })
  }

  function saveBasePrices() {
    const e = parseFloat(pricesDraft.economy)
    const s = parseFloat(pricesDraft.standard)
    const pr = parseFloat(pricesDraft.premium)
    if ([e, s, pr].some(isNaN)) { toast.error('Valores inválidos'); return }
    if (e > s || s > pr) { toast.error('Economy ≤ Standard ≤ Premium'); return }
    persistConfig({ ...config, basePrices: { economy: e, standard: s, premium: pr } })
    setEditingPrices(false)
    toast.success('Precios guardados')
  }

  function togglePanel(id) {
    setSelected(s => ({ ...s, [id]: !s[id] }))
    setDamage(d => ({ ...d, [id]: d[id] || 'none' }))
  }

  function toggleAll() {
    const allSelected = config.panels.every(p => selected[p.id])
    const next = {}
    const dmg = {}
    config.panels.forEach(p => {
      next[p.id] = !allSelected
      if (!allSelected) dmg[p.id] = damage[p.id] || 'none'
    })
    setSelected(next)
    if (!allSelected) setDamage(d => ({ ...d, ...dmg }))
  }

  function setDamageLevel(id, level) {
    setDamage(d => ({ ...d, [id]: level }))
  }

  const rows = useMemo(() => config.panels.map(p => {
    const mult = p.mult[vehicleType]
    const paintPrice = Math.round(basePrice * mult)
    const dmgLevel = DAMAGE_LEVELS.find(d => d.id === (damage[p.id] || 'none'))
    const planchadoPrice = dmgLevel ? Math.round(paintPrice * dmgLevel.pct) : 0
    const price = paintPrice + planchadoPrice
    return { ...p, mult, paintPrice, planchadoPrice, price, damageId: damage[p.id] || 'none' }
  }), [config, vehicleType, basePrice, damage])

  const total = useMemo(() =>
    rows.filter(r => selected[r.id]).reduce((s, r) => s + r.price, 0),
    [rows, selected]
  )

  const selectedCount = Object.values(selected).filter(Boolean).length
  const tierBrand = BRANDS.find(b => b.tier === selectedTier)
  const vtLabel = VEHICLE_TYPES.find(v => v.id === vehicleType)

  // Descuento progresivo: 2 paños=5%, +1% por paño adicional, máx 20%
  const discountPct = selectedCount >= 2 ? Math.min(20, 3 + selectedCount) : 0
  const discountAmt = Math.round(total * discountPct / 100)
  const totalFinal = total - discountAmt

  const [exportBrandModal, setExportBrandModal] = useState(false)
  const [exportBrandInput, setExportBrandInput] = useState('')
  const [exportTarget, setExportTarget] = useState(null) // 'whatsapp' | 'pdf'

  function openExportModal(target) {
    if (selectedCount === 0) { toast.error('Selecciona al menos un paño'); return }
    setExportBrandInput(selectedBrand || '')
    setExportTarget(target)
    setExportBrandModal(true)
  }

  function doExport() {
    const brand = exportBrandInput.trim() || 'Otro'
    setExportBrandModal(false)
    if (exportTarget === 'whatsapp') buildWhatsApp(brand)
    else buildPDF(brand)
  }

  function buildWhatsApp(brand) {
    const vtEmoji = vtLabel?.emoji || ''
    const vtName = vtLabel?.label || ''
    const selectedRows = rows.filter(r => selected[r.id])
    const hasDamage = selectedRows.some(r => r.damageId !== 'none')

    let msg = `🔧 *PRESUPUESTO - APEX PRO*\n`
    msg += `✨ _Planchado & Pintura Profesional_\n`
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`
    msg += `${vtEmoji} *Vehículo:* ${vtName} · ${brand}\n\n`
    msg += `📋 *Trabajos a realizar:*\n`
    selectedRows.forEach(r => {
      const dmg = DAMAGE_LEVELS.find(d => d.id === r.damageId)
      const dmgTag = r.damageId !== 'none' ? ` _(+ planchado ${dmg?.label})_` : ''
      msg += `  🔹 ${r.label}${dmgTag} — ${formatMoney(r.price)}\n`
    })
    if (hasDamage) {
      const totalPintura = selectedRows.reduce((s, r) => s + r.paintPrice, 0)
      const totalPlanchado = selectedRows.reduce((s, r) => s + r.planchadoPrice, 0)
      msg += `\n🎨 Pintura: ${formatMoney(totalPintura)}\n`
      msg += `🔨 Planchado: ${formatMoney(totalPlanchado)}\n`
    }
    msg += `\n━━━━━━━━━━━━━━━━━━━━\n`
    msg += `💲 Subtotal: ${formatMoney(total)}\n`
    if (discountPct > 0) {
      msg += `🎁 Descuento (${discountPct}%): -${formatMoney(discountAmt)}\n`
      msg += `━━━━━━━━━━━━━━━━━━━━\n`
      msg += `💵 *TOTAL: ${formatMoney(totalFinal)}*\n`
    } else {
      msg += `💵 *TOTAL: ${formatMoney(total)}*\n`
    }
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`
    msg += `✅ Incluye mano de obra, materiales y garantía de trabajo.\n`
    msg += `📞 Para consultas y citas, contáctenos.\n\n`
    msg += `_Apex Pro — Calidad que se nota_ 🚗✨`

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function buildPDF(brand) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const W = 210
    const margin = 20
    let y = 0

    doc.setFillColor(185, 28, 28)
    doc.rect(0, 0, W, 42, 'F')
    doc.setFillColor(127, 0, 0)
    doc.rect(0, 36, W, 6, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('APEX PRO', margin, 18)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Planchado & Pintura Profesional', margin, 27)
    doc.setFontSize(9)
    doc.text('PRESUPUESTO', W - margin, 18, { align: 'right' })
    const today = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    doc.text(`Fecha: ${today}`, W - margin, 25, { align: 'right' })
    y = 52

    // Info vehículo
    doc.setFillColor(255, 245, 245)
    doc.roundedRect(margin, y, W - margin * 2, 16, 3, 3, 'F')
    doc.setDrawColor(185, 28, 28)
    doc.setLineWidth(0.5)
    doc.roundedRect(margin, y, W - margin * 2, 16, 3, 3, 'S')
    doc.setTextColor(185, 28, 28)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`${vtLabel?.label || ''} · ${brand}`, margin + 5, y + 10)
    y += 24

    // Tabla header — solo Paño y Precio
    doc.setFillColor(185, 28, 28)
    doc.rect(margin, y, W - margin * 2, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.text('Paño / Trabajo', margin + 4, y + 5.5)
    doc.text('Precio', W - margin - 4, y + 5.5, { align: 'right' })
    y += 8

    const selectedRows = rows.filter(r => selected[r.id])
    selectedRows.forEach((r, i) => {
      const hasDmg = r.damageId !== 'none'
      const rowH = hasDmg ? 12 : 7.5
      if (i % 2 === 0) {
        doc.setFillColor(254, 242, 242)
        doc.rect(margin, y, W - margin * 2, rowH, 'F')
      }
      doc.setTextColor(30, 41, 59)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(r.label, margin + 4, y + 5)
      if (hasDmg) {
        const dmg = DAMAGE_LEVELS.find(d => d.id === r.damageId)
        doc.setFontSize(7.5)
        doc.setTextColor(180, 80, 0)
        doc.text(`+ planchado ${dmg?.label} (+${formatMoney(r.planchadoPrice)})`, margin + 4, y + 9.5)
      }
      doc.setTextColor(30, 41, 59)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(formatMoney(r.price), W - margin - 4, y + (hasDmg ? 7 : 5), { align: 'right' })
      y += rowH
    })

    // Resumen pintura / planchado si aplica
    const totalPlanchado = selectedRows.reduce((s, r) => s + r.planchadoPrice, 0)
    if (totalPlanchado > 0) {
      y += 2
      const totalPintura = selectedRows.reduce((s, r) => s + r.paintPrice, 0)
      doc.setFillColor(249, 250, 251)
      doc.rect(margin, y, W - margin * 2, 7.5, 'F')
      doc.setTextColor(80, 80, 80)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.text('Pintura', margin + 4, y + 5)
      doc.text(formatMoney(totalPintura), W - margin - 4, y + 5, { align: 'right' })
      y += 7.5
      doc.setFillColor(255, 237, 213)
      doc.rect(margin, y, W - margin * 2, 7.5, 'F')
      doc.setTextColor(154, 52, 18)
      doc.text('Planchado', margin + 4, y + 5)
      doc.text(formatMoney(totalPlanchado), W - margin - 4, y + 5, { align: 'right' })
      y += 7.5
    }

    y += 4

    // Subtotal + descuento
    if (discountPct > 0) {
      doc.setFillColor(249, 250, 251)
      doc.rect(margin, y, W - margin * 2, 7.5, 'F')
      doc.setTextColor(100, 116, 139)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text('Subtotal', margin + 4, y + 5)
      doc.text(formatMoney(total), W - margin - 4, y + 5, { align: 'right' })
      y += 7.5

      doc.setFillColor(254, 242, 242)
      doc.rect(margin, y, W - margin * 2, 7.5, 'F')
      doc.setTextColor(185, 28, 28)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(`Descuento (${discountPct}%)`, margin + 4, y + 5)
      doc.text(`-${formatMoney(discountAmt)}`, W - margin - 4, y + 5, { align: 'right' })
      y += 11
    }

    // Total final
    doc.setFillColor(185, 28, 28)
    doc.roundedRect(margin, y, W - margin * 2, 14, 3, 3, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL', margin + 5, y + 9)
    doc.setFontSize(13)
    doc.text(formatMoney(totalFinal), W - margin - 5, y + 9, { align: 'right' })
    y += 22

    doc.setFillColor(243, 244, 246)
    doc.roundedRect(margin, y, W - margin * 2, 18, 3, 3, 'F')
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('Incluye mano de obra, materiales y garantia de trabajo.', margin + 5, y + 7)
    doc.text('Este presupuesto tiene validez de 15 dias a partir de la fecha de emision.', margin + 5, y + 13)

    doc.setFillColor(185, 28, 28)
    doc.rect(0, 287, W, 10, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Apex Pro — Calidad que se nota', W / 2, 293, { align: 'center' })

    doc.save(`presupuesto-apexpro-${today.replace(/\//g, '-')}.pdf`)
    toast.success('PDF descargado')
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-8">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-red-600 via-red-700 to-gray-900 p-5 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px)' }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-6 bg-white rounded-full opacity-80" />
            <h1 className="text-xl font-black tracking-tight">PRESUPUESTO</h1>
          </div>
          <p className="text-red-200 text-sm">Planchado & Pintura · Apex Pro</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-4 text-xs text-gray-400 gap-2">
          <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
          Cargando configuración...
        </div>
      )}

      {/* Controles: Tipo vehículo + Marca */}
      <div className="card space-y-4">
        {/* Tipo vehículo */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tipo de vehículo</p>
          <div className="grid grid-cols-3 gap-2">
            {VEHICLE_TYPES.map(vt => (
              <button key={vt.id} onClick={() => setVehicleType(vt.id)}
                className={`py-2.5 rounded-xl border text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
                  vehicleType === vt.id
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                <span>{vt.emoji}</span> {vt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tier de marca */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Categoría de marca</p>
          <div className="grid grid-cols-3 gap-2">
            {BRANDS.map(b => (
              <button key={b.tier} onClick={() => { setSelectedTier(b.tier); setSelectedBrand('') }}
                className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                  selectedTier === b.tier
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                {b.label}
                <div className="text-[10px] font-normal mt-0.5 opacity-70">{formatMoney(config.basePrices[b.tier])}/paño</div>
              </button>
            ))}
          </div>
        </div>

        {/* Selector de marca específica */}
        <div>
          <button onClick={() => setShowBrands(v => !v)}
            className="w-full flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 py-1">
            <span className="font-medium">{selectedBrand || `Marca — ${tierBrand?.label}`}</span>
            {showBrands ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showBrands && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {BRANDS.map(b => b.brands.map(brand => (
                <button key={brand}
                  onClick={() => {
                    setSelectedBrand(brand)
                    setSelectedTier(b.tier)
                    setShowBrands(false)
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    selectedBrand === brand
                      ? 'bg-red-600 text-white border-red-600'
                      : b.tier === 'premium'
                        ? 'border-amber-300 text-amber-700 dark:text-amber-400 dark:border-amber-700'
                        : b.tier === 'standard'
                          ? 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300'
                          : 'border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400'
                  }`}>
                  {brand}
                </button>
              )))}
            </div>
          )}
        </div>

        {/* Precio base editable (admin) */}
        {canAdmin && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Precio base por paño</p>
              {!editingPrices
                ? <button onClick={() => { setPricesDraft({ ...config.basePrices }); setEditingPrices(true) }}
                    className="text-xs text-red-600 flex items-center gap-1"><Edit2 className="w-3 h-3" />Editar</button>
                : <div className="flex gap-2">
                    <button onClick={saveBasePrices} className="text-xs text-green-600 font-semibold">Guardar</button>
                    <button onClick={() => setEditingPrices(false)} className="text-xs text-gray-400">Cancelar</button>
                  </div>
              }
            </div>
            <div className="grid grid-cols-3 gap-2">
              {BRANDS.map(b => (
                <div key={b.tier} className="text-center">
                  <p className="text-[10px] text-gray-400 mb-1">{b.label}</p>
                  {editingPrices
                    ? <input type="number" min="100" max="1000" step="10"
                        value={pricesDraft[b.tier]}
                        onChange={e => setPricesDraft(d => ({ ...d, [b.tier]: e.target.value }))}
                        className="w-full text-xs text-center border border-red-400 rounded-lg px-1 py-1 font-mono dark:bg-gray-800 dark:text-white" />
                    : <p className="text-sm font-bold text-gray-900 dark:text-white">{formatMoney(config.basePrices[b.tier])}</p>
                  }
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabla de paños */}
      <div className="card overflow-hidden p-0">
        {/* Header tabla */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <p className="font-bold text-gray-900 dark:text-white text-sm">Paños del vehículo</p>
            <p className="text-xs text-gray-500">Base: {formatMoney(basePrice)}/paño · {vtLabel?.emoji} {vtLabel?.label}{selectedBrand ? ` · ${selectedBrand}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedCount > 0 && (
              <button onClick={() => { setSelected({}); setDamage({}) }}
                className="text-xs text-gray-400 dark:text-gray-500 font-semibold px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                Limpiar
              </button>
            )}
            <button onClick={toggleAll}
              className="text-xs text-red-600 dark:text-red-400 font-semibold px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20">
              {config.panels.every(p => selected[p.id]) ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
          </div>
        </div>

        {/* Columnas header */}
        <div className={`grid gap-0 text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 ${canAdmin ? 'grid-cols-[1fr_auto_auto_auto]' : 'grid-cols-[1fr_auto_auto]'}`}>
          <span>Paño</span>
          {canAdmin && <span className="w-16 text-center">Mult.</span>}
          <span className="w-20 text-right">Precio</span>
          <span className="w-8 text-center">✓</span>
        </div>

        {/* Filas */}
        <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
          {rows.map(row => (
            <div key={row.id} className={`transition-colors ${selected[row.id] ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
              {/* Fila principal */}
              <div
                onClick={() => togglePanel(row.id)}
                className={`grid items-center gap-0 px-4 py-2.5 cursor-pointer ${canAdmin ? 'grid-cols-[1fr_auto_auto_auto]' : 'grid-cols-[1fr_auto_auto]'} ${
                  !selected[row.id] ? 'hover:bg-gray-50 dark:hover:bg-gray-800/30' : ''
                }`}>
                <div>
                  <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">{row.label}</span>
                  {selected[row.id] && row.planchadoPrice > 0 && (
                    <p className="text-[10px] text-orange-600 dark:text-orange-400 leading-tight">
                      +{formatMoney(row.planchadoPrice)} planchado
                    </p>
                  )}
                </div>
                {canAdmin && (
                  <div className="w-16 flex justify-center" onClick={e => e.stopPropagation()}>
                    <EditableCell value={row.mult} onSave={val => updateMult(row.id, vehicleType, val)} />
                  </div>
                )}
                <span className="w-20 text-right text-sm font-bold text-gray-900 dark:text-white">
                  {formatMoney(row.price)}
                </span>
                <div className="w-8 flex justify-center">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    selected[row.id] ? 'bg-red-600 border-red-600' : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {selected[row.id] && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              </div>

              {/* Selector de daño — solo si está seleccionado */}
              {selected[row.id] && (
                <div className="flex items-center gap-1.5 px-4 pb-2.5" onClick={e => e.stopPropagation()}>
                  <span className="text-[10px] text-gray-400 mr-0.5">Planchado:</span>
                  {DAMAGE_LEVELS.map(lvl => (
                    <button key={lvl.id}
                      onClick={() => setDamageLevel(row.id, lvl.id)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                        row.damageId === lvl.id
                          ? lvl.id === 'none'
                            ? 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                            : lvl.id === 'leve'
                              ? 'bg-yellow-100 border-yellow-400 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : lvl.id === 'moderado'
                                ? 'bg-orange-100 border-orange-400 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                : 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                      }`}>
                      {lvl.short}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="border-t-2 border-red-100 dark:border-red-900/30 px-4 py-3 bg-red-50 dark:bg-red-900/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">{selectedCount} paño{selectedCount !== 1 ? 's' : ''} seleccionado{selectedCount !== 1 ? 's' : ''}</p>
              {discountPct > 0 && (
                <p className="text-xs text-green-600 font-semibold mt-0.5">🎁 Descuento {discountPct}% aplicado</p>
              )}
            </div>
            <div className="text-right">
              {discountPct > 0 && (
                <p className="text-xs text-gray-400 line-through">{formatMoney(total)}</p>
              )}
              <p className="text-2xl font-black text-red-600 dark:text-red-400">{formatMoney(totalFinal)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Botones de exportar */}
      {selectedCount > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => openExportModal('whatsapp')}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-green-500 hover:bg-green-600 active:scale-95 text-white font-bold text-sm transition-all shadow-lg shadow-green-200 dark:shadow-green-900/30">
            <MessageCircle className="w-5 h-5" />
            WhatsApp
          </button>
          <button
            onClick={() => openExportModal('pdf')}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-sm transition-all shadow-lg shadow-red-200 dark:shadow-red-900/30">
            <FileText className="w-5 h-5" />
            PDF
          </button>
        </div>
      )}

      {/* Modal: pedir marca */}
      {exportBrandModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6"
          onClick={() => setExportBrandModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-5 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <p className="font-bold text-gray-900 dark:text-white mb-1">¿Marca del vehículo?</p>
            <p className="text-xs text-gray-500 mb-3">Déjalo vacío si no aplica (aparecerá como "Otro")</p>
            <input
              type="text"
              placeholder="Ej: Toyota, BMW, Otro..."
              value={exportBrandInput}
              onChange={e => setExportBrandInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doExport()}
              autoFocus
              className="input w-full mb-4"
            />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setExportBrandModal(false)}
                className="btn-secondary py-2.5 text-sm rounded-xl">Cancelar</button>
              <button onClick={doExport}
                className="btn-primary py-2.5 text-sm rounded-xl">
                {exportTarget === 'whatsapp' ? '📲 Enviar' : '📄 Descargar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comparativa por tipo de vehículo — solo admin */}
      {canAdmin && <div className="card overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="font-bold text-gray-900 dark:text-white text-sm">Comparativa por vehículo</p>
          <p className="text-xs text-gray-500">Precio total si se seleccionan todos los paños</p>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
          {VEHICLE_TYPES.map(vt => {
            const vtTotal = config.panels.reduce((s, p) => s + Math.round(basePrice * p.mult[vt.id]), 0)
            return (
              <div key={vt.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-700 dark:text-gray-300">{vt.emoji} {vt.label}</span>
                <span className="font-bold text-gray-900 dark:text-white">{formatMoney(vtTotal)}</span>
              </div>
            )
          })}
        </div>
      </div>}

      {canAdmin && (
        <div className="text-center text-xs text-gray-400 pb-2">
          <FileText className="w-3.5 h-3.5 inline mr-1" />
          Como admin puedes editar los multiplicadores tocando el número en cada celda.
        </div>
      )}
    </div>
  )
}
