import { useState, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { Edit2, Check, X, ChevronDown, ChevronUp, FileText, MessageCircle, Share2 } from 'lucide-react'
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

const LS_KEY = 'apexpro_presupuesto_config'

function loadConfig() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return DEFAULT_CONFIG
    const saved = JSON.parse(raw)
    return {
      basePrices: { ...DEFAULT_CONFIG.basePrices, ...saved.basePrices },
      panels: DEFAULT_CONFIG.panels.map(p => {
        const sp = saved.panels?.find(x => x.id === p.id)
        return sp ? { ...p, mult: { ...p.mult, ...sp.mult } } : p
      }),
    }
  } catch { return DEFAULT_CONFIG }
}

function saveConfig(cfg) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)) } catch {}
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
      className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-mono text-xs hover:underline">
      {value}<Edit2 className="w-2.5 h-2.5" />
    </button>
  )
  return (
    <div className="flex items-center gap-1">
      <input type="number" step="0.1" min="0.1" value={val} onChange={e => setVal(e.target.value)}
        className="w-14 text-xs border border-blue-400 rounded px-1 py-0.5 font-mono dark:bg-gray-800 dark:text-white"
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

  const [config, setConfig] = useState(loadConfig)
  const [vehicleType, setVehicleType] = useState('auto')
  const [selectedTier, setSelectedTier] = useState('economy')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selected, setSelected] = useState({})
  const [editingPrices, setEditingPrices] = useState(false)
  const [pricesDraft, setPricesDraft] = useState(config.basePrices)
  const [showBrands, setShowBrands] = useState(false)

  const basePrice = config.basePrices[selectedTier]

  function updateMult(panelId, vt, val) {
    const newPanels = config.panels.map(p =>
      p.id === panelId ? { ...p, mult: { ...p.mult, [vt]: val } } : p
    )
    const newCfg = { ...config, panels: newPanels }
    setConfig(newCfg)
    saveConfig(newCfg)
  }

  function saveBasePrices() {
    const e = parseFloat(pricesDraft.economy)
    const s = parseFloat(pricesDraft.standard)
    const pr = parseFloat(pricesDraft.premium)
    if ([e, s, pr].some(isNaN)) { toast.error('Valores inválidos'); return }
    if (e > s || s > pr) { toast.error('Economy ≤ Standard ≤ Premium'); return }
    const newCfg = { ...config, basePrices: { economy: e, standard: s, premium: pr } }
    setConfig(newCfg)
    saveConfig(newCfg)
    setEditingPrices(false)
    toast.success('Precios guardados')
  }

  function togglePanel(id) {
    setSelected(s => ({ ...s, [id]: !s[id] }))
  }

  function toggleAll() {
    const allSelected = config.panels.every(p => selected[p.id])
    const next = {}
    config.panels.forEach(p => { next[p.id] = !allSelected })
    setSelected(next)
  }

  const rows = useMemo(() => config.panels.map(p => {
    const mult = p.mult[vehicleType]
    const price = Math.round(basePrice * mult)
    return { ...p, mult, price }
  }), [config, vehicleType, basePrice])

  const total = useMemo(() =>
    rows.filter(r => selected[r.id]).reduce((s, r) => s + r.price, 0),
    [rows, selected]
  )

  const selectedCount = Object.values(selected).filter(Boolean).length

  const tierBrand = BRANDS.find(b => b.tier === selectedTier)

  const vtLabel = VEHICLE_TYPES.find(v => v.id === vehicleType)
  const tierLabel = BRANDS.find(b => b.tier === selectedTier)

  function generateWhatsApp() {
    if (selectedCount === 0) { toast.error('Selecciona al menos un paño'); return }
    const brandInfo = selectedBrand || tierLabel?.label
    const vtEmoji = vtLabel?.emoji || ''
    const vtName = vtLabel?.label || ''
    const selectedRows = rows.filter(r => selected[r.id])

    let msg = `🔧 *PRESUPUESTO - APEX PRO*\n`
    msg += `✨ _Planchado & Pintura Profesional_\n`
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`
    msg += `${vtEmoji} *Vehículo:* ${vtName}${brandInfo ? ` · ${brandInfo}` : ''}\n`
    msg += `💰 *Precio base:* ${formatMoney(basePrice)}/paño\n\n`
    msg += `📋 *Trabajos a realizar:*\n`
    selectedRows.forEach(r => {
      msg += `  🔹 ${r.label} — ${formatMoney(r.price)}\n`
    })
    msg += `\n━━━━━━━━━━━━━━━━━━━━\n`
    msg += `💵 *TOTAL: ${formatMoney(total)}*\n`
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`
    msg += `✅ Incluye mano de obra, materiales y garantía de trabajo.\n`
    msg += `📞 Para consultas y citas, contáctenos.\n\n`
    msg += `_Apex Pro — Calidad que se nota_ 🚗✨`

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  function generatePDF() {
    if (selectedCount === 0) { toast.error('Selecciona al menos un paño'); return }
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const W = 210
    const margin = 20
    let y = 0

    // Header background
    doc.setFillColor(30, 64, 175)
    doc.rect(0, 0, W, 42, 'F')

    // Title
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('APEX PRO', margin, 18)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text('Planchado & Pintura Profesional', margin, 27)
    doc.setFontSize(9)
    doc.text('PRESUPUESTO', W - margin, 18, { align: 'right' })
    const today = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    doc.text(`Fecha: ${today}`, W - margin, 25, { align: 'right' })
    y = 52

    // Vehicle info card
    doc.setFillColor(239, 246, 255)
    doc.roundedRect(margin, y, W - margin * 2, 22, 3, 3, 'F')
    doc.setTextColor(30, 64, 175)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    const vtName = vtLabel?.label || ''
    const brandInfo = selectedBrand || tierLabel?.label || ''
    doc.text(`Vehículo: ${vtName}${brandInfo ? `  ·  ${brandInfo}` : ''}`, margin + 5, y + 9)
    doc.setTextColor(100, 116, 139)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Precio base: ${formatMoney(basePrice)}/paño  ·  ${selectedCount} paño${selectedCount !== 1 ? 's' : ''} seleccionado${selectedCount !== 1 ? 's' : ''}`, margin + 5, y + 17)
    y += 30

    // Table header
    doc.setFillColor(30, 64, 175)
    doc.rect(margin, y, W - margin * 2, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.text('Paño / Trabajo', margin + 4, y + 5.5)
    doc.text('Multiplicador', W - margin - 45, y + 5.5, { align: 'center' })
    doc.text('Precio', W - margin - 4, y + 5.5, { align: 'right' })
    y += 8

    // Table rows
    const selectedRows = rows.filter(r => selected[r.id])
    selectedRows.forEach((r, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252)
        doc.rect(margin, y, W - margin * 2, 7.5, 'F')
      }
      doc.setTextColor(30, 41, 59)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(r.label, margin + 4, y + 5)
      doc.setTextColor(100, 116, 139)
      doc.text(`${r.mult}x`, W - margin - 45, y + 5, { align: 'center' })
      doc.setTextColor(30, 41, 59)
      doc.setFont('helvetica', 'bold')
      doc.text(formatMoney(r.price), W - margin - 4, y + 5, { align: 'right' })
      y += 7.5
    })

    // Total
    y += 4
    doc.setFillColor(30, 64, 175)
    doc.roundedRect(margin, y, W - margin * 2, 14, 3, 3, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL PRESUPUESTO', margin + 5, y + 9)
    doc.setFontSize(13)
    doc.text(formatMoney(total), W - margin - 5, y + 9, { align: 'right' })
    y += 22

    // Footer note
    doc.setFillColor(243, 244, 246)
    doc.roundedRect(margin, y, W - margin * 2, 18, 3, 3, 'F')
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('✓ Incluye mano de obra, materiales y garantía de trabajo.', margin + 5, y + 7)
    doc.text('Este presupuesto tiene validez de 15 días a partir de la fecha de emisión.', margin + 5, y + 13)

    // Footer strip
    doc.setFillColor(30, 64, 175)
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
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-5 text-white">
        <h1 className="text-xl font-black tracking-tight">Presupuesto</h1>
        <p className="text-blue-200 text-sm mt-0.5">Planchado & Pintura</p>
      </div>

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
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
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
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
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
                      ? 'bg-blue-600 text-white border-blue-600'
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
                    className="text-xs text-blue-600 flex items-center gap-1"><Edit2 className="w-3 h-3" />Editar</button>
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
                        className="w-full text-xs text-center border border-blue-400 rounded-lg px-1 py-1 font-mono dark:bg-gray-800 dark:text-white" />
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
            <p className="text-xs text-gray-500">Base: {formatMoney(basePrice)}/paño · {VEHICLE_TYPES.find(v => v.id === vehicleType)?.emoji} {VEHICLE_TYPES.find(v => v.id === vehicleType)?.label}{selectedBrand ? ` · ${selectedBrand}` : ''}</p>
          </div>
          <button onClick={toggleAll}
            className="text-xs text-blue-600 dark:text-blue-400 font-semibold px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            {config.panels.every(p => selected[p.id]) ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </button>
        </div>

        {/* Columnas header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
          <span>Paño</span>
          <span className="w-16 text-center">Multiplicador</span>
          <span className="w-20 text-right">Precio</span>
          <span className="w-8 text-center">✓</span>
        </div>

        {/* Filas */}
        <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
          {rows.map(row => (
            <div key={row.id}
              onClick={() => togglePanel(row.id)}
              className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-0 px-4 py-2.5 cursor-pointer transition-colors ${
                selected[row.id] ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
              }`}>
              <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">{row.label}</span>
              <div className="w-16 flex justify-center" onClick={e => canAdmin && e.stopPropagation()}>
                {canAdmin
                  ? <EditableCell value={row.mult} onSave={val => updateMult(row.id, vehicleType, val)} />
                  : <span className="font-mono text-xs text-gray-500">{row.mult}x</span>
                }
              </div>
              <span className="w-20 text-right text-sm font-bold text-gray-900 dark:text-white">
                {formatMoney(row.price)}
              </span>
              <div className="w-8 flex justify-center">
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  selected[row.id]
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {selected[row.id] && <Check className="w-3 h-3 text-white" />}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="border-t-2 border-blue-100 dark:border-blue-900/30 px-4 py-3 bg-blue-50 dark:bg-blue-900/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">{selectedCount} paño{selectedCount !== 1 ? 's' : ''} seleccionado{selectedCount !== 1 ? 's' : ''}</p>
              <p className="text-xs text-gray-400 mt-0.5">Precio base: {formatMoney(basePrice)}/paño{selectedBrand ? ` · ${selectedBrand}` : ''}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-0.5">Total presupuesto</p>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{formatMoney(total)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Botones de exportar */}
      {selectedCount > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={generateWhatsApp}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-green-500 hover:bg-green-600 active:scale-95 text-white font-bold text-sm transition-all shadow-lg shadow-green-200 dark:shadow-green-900/30">
            <MessageCircle className="w-5 h-5" />
            WhatsApp
          </button>
          <button
            onClick={generatePDF}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm transition-all shadow-lg shadow-blue-200 dark:shadow-blue-900/30">
            <FileText className="w-5 h-5" />
            PDF
          </button>
        </div>
      )}

      {/* Comparativa por tipo de vehículo */}
      <div className="card overflow-hidden p-0">
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
      </div>

      {/* Nota admin */}
      {canAdmin && (
        <div className="text-center text-xs text-gray-400 pb-2">
          <FileText className="w-3.5 h-3.5 inline mr-1" />
          Como admin puedes editar los multiplicadores tocando el número en cada celda.
        </div>
      )}
    </div>
  )
}
