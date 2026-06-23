import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { formatMoney, calcRealSalary, currentMonthYear, getWorkingDaysInMonth } from '../lib/utils'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Badge from '../components/ui/Badge'
import { Plus, Edit2, ToggleLeft, ToggleRight, Save, Trash2, ChevronUp, ChevronDown, X } from 'lucide-react'
import toast from 'react-hot-toast'

const EMOJI_OPTIONS = ['🏍️','🚗','🚙','🚐','🚛','🚌','🚑','🚒','🚕','🚜','🛻','🚚']

const CATEGORY_LABELS = { basico: 'Básico', ceramico: 'Cerámico', polarizado: 'Polarizado', ppf: 'PPF' }
const CATEGORY_COLORS = { basico: 'gray', ceramico: 'blue', polarizado: 'purple', ppf: 'orange' }

function ServiceForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    category: initial?.category || 'basico',
    min_price: initial?.min_price || '',
    max_price: initial?.max_price || '',
    margin_percent: initial?.margin_percent || 85,
  })

  function handleCategoryChange(cat) {
    setForm(f => ({ ...f, category: cat, margin_percent: (cat === 'basico') ? 85 : 45 }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    await onSave({
      ...form,
      min_price: parseFloat(form.min_price),
      max_price: parseFloat(form.max_price),
      margin_percent: parseFloat(form.margin_percent),
    })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Nombre del servicio</label>
        <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ej: Cerámico Pro 2 años" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Categoría</label>
          <select className="input" value={form.category} onChange={e => handleCategoryChange(e.target.value)}>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Margen (%)</label>
          <input type="number" className="input" min="1" max="100" value={form.margin_percent} onChange={e => setForm(f => ({ ...f, margin_percent: e.target.value }))} required />
          <p className="text-xs text-gray-400 mt-1">Básico: 85% · Premium: 45%</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Precio mínimo (S/)</label>
          <input type="number" className="input" min="0" step="10" value={form.min_price} onChange={e => setForm(f => ({ ...f, min_price: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Precio máximo (S/)</label>
          <input type="number" className="input" min="0" step="10" value={form.max_price} onChange={e => setForm(f => ({ ...f, max_price: e.target.value }))} required />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary flex-1">{initial ? 'Guardar cambios' : 'Agregar servicio'}</button>
      </div>
    </form>
  )
}

function VehicleTypeRow({ vt, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ emoji: vt.emoji, label: vt.label, default_price: vt.default_price })

  async function handleSave() {
    await onSave(vt.id, { ...form, default_price: parseFloat(form.default_price) || 0 })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800">
        <select className="input py-1 w-14 text-center text-lg px-1" value={form.emoji}
          onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}>
          {EMOJI_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <input className="input py-1 flex-1 text-sm" placeholder="Nombre" value={form.label}
          onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 whitespace-nowrap">S/</span>
          <input type="number" min="0" step="1" className="input py-1 w-20 text-sm text-right"
            value={form.default_price}
            onChange={e => setForm(f => ({ ...f, default_price: e.target.value }))} />
        </div>
        <button onClick={handleSave} className="btn-primary py-1 px-3 text-sm">✓</button>
        <button onClick={() => setEditing(false)} className="btn-secondary py-1 px-3 text-sm">✕</button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
      <span className="text-2xl w-8 text-center">{vt.emoji}</span>
      <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{vt.label}</span>
      <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 min-w-[80px] justify-end">
        <span className="text-xs text-gray-400">S/</span>
        <span className="text-sm font-bold text-gray-900 dark:text-white">{vt.default_price}</span>
      </div>
      <button onClick={() => setEditing(true)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg">
        <Edit2 className="w-4 h-4 text-gray-400" />
      </button>
      <button onClick={() => onDelete(vt.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
        <Trash2 className="w-4 h-4 text-red-400" />
      </button>
    </div>
  )
}

export default function Configuracion() {
  const { services, vehicleTypes, monthlyCosts, workers, incidents, extrasCatalog,
          addService, updateService, saveMonthlyCosts, updateWorker,
          addVehicleType, updateVehicleType, deleteVehicleType,
          addExtra, updateExtra, deleteExtra } = useApp()
  const { month, year } = currentMonthYear()
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [toggleTarget, setToggleTarget] = useState(null)
  const [costItems, setCostItems] = useState([])
  const [costs, setCosts] = useState({
    utility_goal: monthlyCosts?.utility_goal || 2000,
  })

  useEffect(() => {
    if (!monthlyCosts) return
    const saved = monthlyCosts.cost_items
    if (saved && Array.isArray(saved) && saved.length > 0) {
      setCostItems(saved)
    } else {
      const items = []
      if (monthlyCosts.rent)     items.push({ name: 'Alquiler', amount: monthlyCosts.rent })
      if (monthlyCosts.supplies) items.push({ name: 'Insumos',  amount: monthlyCosts.supplies })
      if (items.length === 0)    items.push({ name: 'Alquiler', amount: 2700 }, { name: 'Insumos', amount: 800 })
      setCostItems(items)
    }
    setCosts(c => ({ ...c, utility_goal: monthlyCosts.utility_goal || 2000 }))
  }, [monthlyCosts])
  const [savingCosts, setSavingCosts] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')
  const [newVehicle, setNewVehicle] = useState({ emoji: '🚗', label: '', default_price: '' })
  const [showNewVehicle, setShowNewVehicle] = useState(false)
  const [deleteVehicleTarget, setDeleteVehicleTarget] = useState(null)
  const [newExtra, setNewExtra] = useState({ name: '', price: '' })
  const [showNewExtra, setShowNewExtra] = useState(false)
  const [editingExtra, setEditingExtra] = useState(null)

  // Metas por trabajador
  const [workerGoals, setWorkerGoals] = useState({})
  const [savingGoals, setSavingGoals] = useState(false)

  // Reparto porcentual
  const [repartoMonto, setRepartoMonto] = useState('')
  const [repartoPorc, setRepartoPorc] = useState({})
  const [savingReparto, setSavingReparto] = useState(false)

  // Anuncios
  const [anuncioMsg, setAnuncioMsg] = useState('')
  const [anuncioTarget, setAnuncioTarget] = useState('all')
  const [anuncioWorker, setAnuncioWorker] = useState('')
  const [sendingAnuncio, setSendingAnuncio] = useState(false)
  const [anuncioTone, setAnuncioTone] = useState('normal')
  const [aiPreview, setAiPreview] = useState('')
  const [generatingAi, setGeneratingAi] = useState(false)

  async function handleGenerateAI() {
    if (!anuncioMsg.trim()) { toast.error('Escribe un mensaje primero'); return }
    setGeneratingAi(true)
    setAiPreview('')
    try {
      const tonePrompts = {
        formal: 'Transforma este mensaje en un anuncio formal y profesional para un taller automotriz. Usa máximo 2 emojis relevantes al inicio. Sé directo y respetuoso.',
        normal: 'Transforma este mensaje en un anuncio amigable y claro para el equipo de un taller automotriz. Usa 3-4 emojis apropiados. Tono cercano pero profesional.',
        alegre: 'Transforma este mensaje en un anuncio motivador y alegre para el equipo de un taller automotriz. Usa bastantes emojis expresivos. Tono energético y positivo.',
      }
      const { data, error } = await supabase.functions.invoke('ai-anuncio', {
        body: { message: anuncioMsg.trim(), tone: anuncioTone, prompt: tonePrompts[anuncioTone] }
      })
      if (error) throw error
      setAiPreview(data.result)
    } catch {
      // Fallback local si no hay edge function
      const emojis = { formal: ['📋','📢'], normal: ['📢','👋','✅','🔧'], alegre: ['🎉','🚀','💪','⭐','🔥','👊'] }
      const prefixes = {
        formal: `Estimado equipo,\n\n`,
        normal: `Hola equipo 👋\n\n`,
        alegre: `¡Atención equipo! 🎉\n\n`,
      }
      const suffixes = {
        formal: `\n\nQuedamos atentos a cualquier consulta.\nGracias por su colaboración.`,
        normal: `\n\nCualquier duda, me avisan. ¡Gracias! ✅`,
        alegre: `\n\n¡Vamos con todo equipo! 💪🔥`,
      }
      const e = emojis[anuncioTone]
      setAiPreview(`${prefixes[anuncioTone]}${e[0]} ${anuncioMsg.trim()}${suffixes[anuncioTone]}`)
    }
    setGeneratingAi(false)
  }

  function handleUseAiPreview() {
    setAnuncioMsg(aiPreview)
    setAiPreview('')
  }

  function handleShareWhatsApp(text) {
    const encoded = encodeURIComponent(text)
    window.open(`https://wa.me/?text=${encoded}`, '_blank')
  }

  async function handleSendAnuncio() {
    if (!anuncioMsg.trim()) { toast.error('Escribe un mensaje'); return }
    setSendingAnuncio(true)
    try {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'anuncios').maybeSingle()
      const existing = data?.value || []
      const nuevo = {
        id: Date.now().toString(),
        message: anuncioMsg.trim(),
        target: anuncioTarget === 'all' ? 'all' : anuncioWorker,
        createdAt: new Date().toISOString(),
        read: [],
      }
      await supabase.from('app_settings').upsert(
        { key: 'anuncios', value: [nuevo, ...existing].slice(0, 50), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
      setAnuncioMsg('')
      toast.success('Anuncio enviado ✓')
    } catch { toast.error('Error al enviar') }
    setSendingAnuncio(false)
  }

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'reparto').maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          setRepartoMonto(data.value.monto ?? '')
          setRepartoPorc(data.value.porcentajes ?? {})
        }
      })
  }, [])

  async function handleSaveReparto() {
    const totalPorc = activeWorkers.reduce((s, w) => s + (parseFloat(repartoPorc[w.id]) || 0), 0)

    setSavingReparto(true)
    try {
      const monto = parseFloat(repartoMonto) || 0
      // Guardar reparto en app_settings
      await supabase.from('app_settings').upsert(
        { key: 'reparto', value: { monto, porcentajes: repartoPorc }, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
      // Aplicar reparto como meta diaria de cada trabajador
      const newGoals = {}
      await Promise.all(activeWorkers.map(w => {
        const porc = parseFloat(repartoPorc[w.id]) || 0
        const goal = monto > 0 && porc > 0 ? Math.round(monto * porc / 100) : 0
        newGoals[w.id] = goal ?? ''
        return updateWorker(w.id, { daily_goal: goal })
      }))
      setWorkerGoals(newGoals)
      toast.success('Reparto guardado y aplicado como meta diaria ✓')
    } catch { toast.error('Error al guardar') }
    setSavingReparto(false)
  }
  const activeWorkers = workers.filter(w => w.active)

  useEffect(() => {
    setWorkerGoals(prev => {
      const next = { ...prev }
      activeWorkers.forEach(w => {
        if (!(w.id in next)) next[w.id] = w.daily_goal ?? ''
      })
      return next
    })
  }, [workers])

  async function handleSaveGoals() {
    setSavingGoals(true)
    try {
      await Promise.all(
        activeWorkers.map(w => {
          const v = workerGoals[w.id]
          const goal = (v !== '' && v !== undefined && v !== null) ? parseFloat(v) : null
          return updateWorker(w.id, { daily_goal: goal })
        })
      )
      toast.success('Metas guardadas')
    } catch { toast.error('Error al guardar metas') }
    setSavingGoals(false)
  }

  async function handleAddExtra() {
    if (!newExtra.name.trim() || !newExtra.price) { toast.error('Nombre y precio requeridos'); return }
    try {
      await addExtra({ name: newExtra.name.trim(), price: parseFloat(newExtra.price), active: true, sort_order: (extrasCatalog?.length || 0) + 1 })
      setNewExtra({ name: '', price: '' }); setShowNewExtra(false)
      toast.success('Extra agregado')
    } catch { toast.error('Error al guardar') }
  }

  async function handleUpdateExtra(extra) {
    try { await updateExtra(extra.id, { name: extra.name, price: extra.price }); setEditingExtra(null); toast.success('Actualizado') }
    catch { toast.error('Error al guardar') }
  }

  async function handleDeleteExtra(id) {
    try { await deleteExtra(id); toast.success('Eliminado') }
    catch { toast.error('Error al eliminar') }
  }

  async function handleMoveExtra(index, dir) {
    const list = [...(extrasCatalog || [])].sort((a, b) => a.sort_order - b.sort_order)
    const swapIdx = index + dir
    if (swapIdx < 0 || swapIdx >= list.length) return
    // Reordenar el array y reasignar sort_order 1,2,3... para evitar duplicados
    const reordered = [...list]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(swapIdx, 0, moved)
    try {
      await Promise.all(
        reordered.map((item, i) => updateExtra(item.id, { sort_order: i + 1 }))
      )
    } catch { toast.error('Error al reordenar') }
  }

  // Recalcular meta en tiempo real
  const payrollTotal = useMemo(() => {
    return workers.filter(w => w.active).reduce((s, w) => {
      const realSalary = calcRealSalary(w.base_salary, w.weekly_hours)
      const discounts = incidents.filter(i => i.worker_id === w.id && i.apply_discount && !i.is_addition).reduce((d, i) => d + (i.discount_amount || 0), 0)
      const overtime  = incidents.filter(i => i.worker_id === w.id && i.apply_discount && i.is_addition).reduce((d, i) => d + (i.discount_amount || 0), 0)
      return s + realSalary - discounts + overtime
    }, 0)
  }, [workers, incidents])

  const fixedTotal = costItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const incomeGoal = fixedTotal + payrollTotal + (parseFloat(costs.utility_goal) || 0)
  const workingDaysTotal = getWorkingDaysInMonth(year, month)
  const metaDiariaRef = activeWorkers.length > 0 && workingDaysTotal > 0
    ? Math.round(incomeGoal / workingDaysTotal / activeWorkers.length)
    : 0

  const filteredServices = activeCategory === 'all' ? services : services.filter(s => s.category === activeCategory)

  async function handleSaveService(data) {
    try {
      if (editingService) {
        await updateService(editingService.id, data)
        toast.success('Servicio actualizado')
      } else {
        await addService(data)
        toast.success('Servicio agregado')
      }
      setEditingService(null)
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  async function handleToggleService(service) {
    try {
      await updateService(service.id, { active: !service.active })
      toast.success(service.active ? 'Servicio desactivado' : 'Servicio activado')
    } catch (err) {
      toast.error('Error')
    }
  }

  async function handleSaveCosts() {
    if (costItems.some(i => !i.name.trim())) { toast.error('Todos los ítems deben tener nombre'); return }
    setSavingCosts(true)
    try {
      const items = costItems.map(i => ({ name: i.name.trim(), amount: parseFloat(i.amount) || 0 }))
      await saveMonthlyCosts({
        month,
        year,
        rent: items.find(i => i.name === 'Alquiler')?.amount || 0,
        supplies: items.find(i => i.name === 'Insumos')?.amount || 0,
        utility_goal: parseFloat(costs.utility_goal),
        cost_items: items,
      })
      toast.success('Costos guardados')
    } catch (err) {
      toast.error('Error al guardar')
    } finally {
      setSavingCosts(false)
    }
  }

  async function handleAddVehicle() {
    if (!newVehicle.label) { toast.error('Escribe el nombre del tipo'); return }
    try {
      const value = newVehicle.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      await addVehicleType({ ...newVehicle, value, default_price: parseFloat(newVehicle.default_price) || 0, sort_order: (vehicleTypes?.length || 0) + 1 })
      setNewVehicle({ emoji: '🚗', label: '', default_price: '' })
      setShowNewVehicle(false)
      toast.success('Tipo agregado')
    } catch (err) { toast.error('Error: ' + err.message) }
  }

  async function handleUpdateVehicle(id, data) {
    try { await updateVehicleType(id, data); toast.success('Actualizado') }
    catch (err) { toast.error('Error: ' + err.message) }
  }

  async function handleMoveVehicle(idx, dir) {
    const sorted = [...(vehicleTypes || [])].sort((a, b) => a.sort_order - b.sort_order)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= sorted.length) return
    const a = sorted[idx], b = sorted[newIdx]
    await Promise.all([
      updateVehicleType(a.id, { sort_order: b.sort_order }),
      updateVehicleType(b.id, { sort_order: a.sort_order }),
    ])
  }

  async function handleDeleteVehicle(id) {
    try { await deleteVehicleType(id); toast.success('Eliminado') }
    catch (err) { toast.error('Error: ' + err.message) }
  }

  const categories = ['all', 'basico', 'ceramico', 'polarizado', 'ppf']

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configuración</h1>

      {/* Costos fijos */}
      <div className="card">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Costos fijos mensuales</p>

        <div className="space-y-2 mb-3">
          {costItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Nombre (ej: Luz)"
                className="input flex-1 min-w-0"
                value={item.name}
                onChange={e => setCostItems(list => list.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
              />
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-sm text-gray-400">S/</span>
                <input
                  type="number"
                  placeholder="0"
                  className="input w-28"
                  min="0"
                  step="50"
                  value={item.amount}
                  onChange={e => setCostItems(list => list.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x))}
                />
              </div>
              <button
                onClick={() => setCostItems(list => list.filter((_, i) => i !== idx))}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => setCostItems(list => [...list, { name: '', amount: '' }])}
          className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-700 mb-4 font-medium"
        >
          <Plus className="w-4 h-4" /> Agregar ítem
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div>
            <label className="label">Meta de utilidad (S/)</label>
            <input type="number" className="input" min="0" step="100" value={costs.utility_goal} onChange={e => setCosts(c => ({ ...c, utility_goal: e.target.value }))} />
          </div>
          <div className="flex flex-col justify-end pb-1">
            <p className="text-xs text-gray-400 mb-1">Total costos fijos</p>
            <p className="text-lg font-bold text-gray-800 dark:text-white">{formatMoney(fixedTotal)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-orange-100 dark:border-red-900/30 mb-4">
          <div className="text-sm">
            <span className="text-gray-500">Planilla real del mes: </span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">{formatMoney(payrollTotal)}</span>
          </div>
          <div className="text-sm text-right">
            <span className="text-gray-500">Meta de ingresos: </span>
            <span className="font-bold text-red-600 dark:text-red-400">{formatMoney(incomeGoal)}</span>
          </div>
        </div>

        <button className="btn-primary flex items-center gap-2" onClick={handleSaveCosts} disabled={savingCosts}>
          <Save className="w-4 h-4" />
          {savingCosts ? 'Guardando...' : 'Guardar costos'}
        </button>
      </div>

      {/* Metas + Reparto unificado */}
      <div className="card">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Metas y reparto por trabajador</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Ref. calculada: <span className="font-semibold text-gray-600 dark:text-gray-300">{formatMoney(metaDiariaRef)}/día</span> por trabajador
            </p>
          </div>
          {/* Monto reparto */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-gray-500">Monto reparto S/</span>
            <input type="number" min="0" step="10" placeholder="0"
              className="input w-28 text-right text-sm"
              value={repartoMonto}
              onChange={e => setRepartoMonto(e.target.value)} />
          </div>
        </div>

        {/* Cabeceras */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center py-2 border-b border-gray-100 dark:border-gray-800 mb-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Trabajador</span>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide text-right w-20">%</span>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide text-right w-24">Meta/día</span>
        </div>

        {activeWorkers.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No hay trabajadores activos</p>
        )}

        <div className="space-y-1">
          {activeWorkers.map(w => {
            const porc     = parseFloat(repartoPorc[w.id]) || 0
            const monto    = parseFloat(repartoMonto) || 0
            const asignado = monto > 0 && porc > 0 ? Math.round(monto * porc / 100) : null
            return (
              <div key={w.id} className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center py-2.5 border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-xs font-bold text-red-600 flex-shrink-0">
                    {w.name[0]}
                  </div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{w.name}</p>
                </div>
                {/* Porcentaje */}
                <div className="flex items-center gap-1.5 w-24 justify-end">
                  <input type="number" min="0" max="100" step="1" placeholder="0"
                    className="w-16 text-center text-sm font-semibold rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white py-2 px-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                    value={repartoPorc[w.id] ?? ''}
                    onChange={e => setRepartoPorc(p => ({ ...p, [w.id]: e.target.value }))} />
                  <span className="text-sm font-medium text-gray-400">%</span>
                </div>
                {/* Meta calculada */}
                <p className={`text-sm font-bold text-right w-24 ${asignado ? 'text-red-600 dark:text-red-400' : 'text-gray-300 dark:text-gray-600'}`}>
                  {asignado ? formatMoney(asignado) : '—'}
                </p>
              </div>
            )
          })}
        </div>

        {/* Totales */}
        {activeWorkers.length > 0 && (() => {
          const monto = parseFloat(repartoMonto) || 0
          const totalPorc = activeWorkers.reduce((s, w) => s + (parseFloat(repartoPorc[w.id]) || 0), 0)
          const totalMeta = activeWorkers.reduce((s, w) => {
            const porc = parseFloat(repartoPorc[w.id]) || 0
            return s + (monto > 0 && porc > 0 ? Math.round(monto * porc / 100) : 0)
          }, 0)
          const over = totalPorc > 100
          const ok   = Math.abs(totalPorc - 100) < 0.01
          return (
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center pt-3 mt-1 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total</p>
              <p className={`text-sm font-bold text-right w-20 ${over ? 'text-red-500' : ok ? 'text-emerald-600' : 'text-gray-500'}`}>
                {totalPorc}% {ok ? '✓' : over ? '⚠' : ''}
              </p>
              <p className="text-sm font-bold text-red-600 dark:text-red-400 text-right w-24">
                {totalMeta > 0 ? formatMoney(totalMeta) : '—'}
              </p>
            </div>
          )
        })()}

        <button className="btn-primary flex items-center gap-2 mt-4" onClick={handleSaveReparto} disabled={savingReparto}>
          <Save className="w-4 h-4" />
          {savingReparto ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {/* Anuncios */}
      <div className="card">
        <div className="mb-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Anuncios al equipo</p>
          <p className="text-xs text-gray-400 mt-0.5">Aparece como tarjeta flotante en el dashboard del trabajador</p>
        </div>

        {/* Destinatario */}
        <div className="flex gap-2 mb-3">
          <button onClick={() => setAnuncioTarget('all')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${anuncioTarget === 'all' ? 'bg-red-600 border-red-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'}`}>
            🌐 Todos
          </button>
          <button onClick={() => setAnuncioTarget('individual')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${anuncioTarget === 'individual' ? 'bg-red-600 border-red-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'}`}>
            👤 Individual
          </button>
        </div>

        {anuncioTarget === 'individual' && (
          <select className="input mb-3" value={anuncioWorker} onChange={e => setAnuncioWorker(e.target.value)}>
            <option value="">-- Seleccionar trabajador --</option>
            {activeWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}

        {/* Selector de tono IA */}
        <div className="flex gap-2 mb-3">
          {[
            { key: 'formal', label: '🎩 Formal', desc: 'Serio y profesional' },
            { key: 'normal', label: '💬 Normal', desc: 'Claro y amigable' },
            { key: 'alegre', label: '🎉 Alegre', desc: 'Energético y festivo' },
          ].map(t => (
            <button key={t.key} onClick={() => setAnuncioTone(t.key)}
              className={`flex-1 py-2 px-1 rounded-xl text-xs font-semibold border transition-all ${anuncioTone === t.key ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <textarea
          className="input resize-none mb-2"
          rows={3}
          placeholder="Escribe el anuncio o mensaje para el equipo..."
          value={anuncioMsg}
          onChange={e => { setAnuncioMsg(e.target.value); setAiPreview('') }}
        />

        {/* Botón generar IA */}
        <button onClick={handleGenerateAI} disabled={generatingAi || !anuncioMsg.trim()}
          className="w-full mb-3 py-2 rounded-xl text-sm font-semibold border-2 border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
          {generatingAi
            ? <><span className="animate-spin">⚙️</span> Generando mensaje...</>
            : <><span>✨</span> Mejorar con IA</>}
        </button>

        {/* Preview IA */}
        {aiPreview && (
          <div className="mb-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-indigo-200 dark:border-indigo-800">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">✨ Sugerencia IA</span>
              <button onClick={() => setAiPreview('')} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
            </div>
            <pre className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">{aiPreview}</pre>
            <div className="flex gap-2 px-3 pb-3">
              <button onClick={handleUseAiPreview}
                className="flex-1 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors">
                Usar este mensaje
              </button>
              <button onClick={() => handleShareWhatsApp(aiPreview)}
                className="flex-1 py-1.5 rounded-lg bg-green-500 text-white text-xs font-semibold hover:bg-green-600 transition-colors flex items-center justify-center gap-1">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.532 5.856L.054 23.25a.75.75 0 00.916.919l5.562-1.457A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.7 9.7 0 01-4.95-1.355l-.355-.211-3.684.966.984-3.595-.232-.371A9.718 9.718 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
                WhatsApp
              </button>
            </div>
          </div>
        )}

        {/* Botón enviar + WhatsApp directo */}
        <div className="flex gap-2">
          <button onClick={handleSendAnuncio} disabled={sendingAnuncio}
            className="flex-1 btn-primary flex items-center justify-center gap-2">
            <span>📣</span>
            {sendingAnuncio ? 'Enviando...' : 'Enviar anuncio'}
          </button>
          <button onClick={() => handleShareWhatsApp(anuncioMsg)} disabled={!anuncioMsg.trim()}
            title="Compartir en WhatsApp"
            className="px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white transition-colors flex items-center gap-1.5 text-sm font-semibold">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.532 5.856L.054 23.25a.75.75 0 00.916.919l5.562-1.457A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.7 9.7 0 01-4.95-1.355l-.355-.211-3.684.966.984-3.595-.232-.371A9.718 9.718 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
          </button>
        </div>
      </div>

      {/* Tipos de vehículo */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tipos de vehículo</p>
            <p className="text-xs text-gray-400 mt-0.5">Precios base al abrir un ticket</p>
          </div>
          <button className="btn-primary text-sm flex items-center gap-1" onClick={() => setShowNewVehicle(v => !v)}>
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>

        {showNewVehicle && (
          <div className="flex items-center gap-2 mb-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800">
            <select className="input py-1 w-14 text-center text-lg px-1" value={newVehicle.emoji}
              onChange={e => setNewVehicle(v => ({ ...v, emoji: e.target.value }))}>
              {EMOJI_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <input className="input py-1 flex-1 text-sm" placeholder="Nombre (ej: Van)"
              value={newVehicle.label} onChange={e => setNewVehicle(v => ({ ...v, label: e.target.value }))} />
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">S/</span>
              <input type="number" min="0" step="1" placeholder="0" className="input py-1 w-20 text-sm text-right"
                value={newVehicle.default_price} onChange={e => setNewVehicle(v => ({ ...v, default_price: e.target.value }))} />
            </div>
            <button onClick={handleAddVehicle} className="btn-primary py-1 px-4 text-sm">Guardar</button>
          </div>
        )}

        <div className="space-y-2">
          {[...(vehicleTypes || [])].sort((a, b) => a.sort_order - b.sort_order).map((vt, idx, arr) => (
            <div key={vt.id} className="flex items-center gap-1">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => handleMoveVehicle(idx, -1)} disabled={idx === 0}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-20 transition-colors">
                  <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button onClick={() => handleMoveVehicle(idx, 1)} disabled={idx === arr.length - 1}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-20 transition-colors">
                  <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <div className="flex-1">
                <VehicleTypeRow vt={vt} onSave={handleUpdateVehicle} onDelete={id => setDeleteVehicleTarget(id)} />
              </div>
            </div>
          ))}
          {(vehicleTypes || []).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Sin tipos. Agrega el primero.</p>
          )}
        </div>
      </div>

      {/* Catálogo de extras */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Extras del catálogo</p>
            <p className="text-xs text-gray-400 mt-0.5">Servicios adicionales al cerrar un ticket</p>
          </div>
          <button className="btn-primary text-sm flex items-center gap-1" onClick={() => setShowNewExtra(v => !v)}>
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>

        {showNewExtra && (
          <div className="flex items-center gap-2 mb-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800">
            <input className="input py-1.5 flex-1 text-sm" placeholder="Nombre (ej: Motor)"
              value={newExtra.name} onChange={e => setNewExtra(v => ({ ...v, name: e.target.value }))} />
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">S/</span>
              <input type="number" min="0" step="0.5" placeholder="0" className="input py-1.5 w-20 text-sm text-right"
                value={newExtra.price} onChange={e => setNewExtra(v => ({ ...v, price: e.target.value }))} />
            </div>
            <button onClick={handleAddExtra} className="btn-primary py-1.5 px-4 text-sm">Guardar</button>
          </div>
        )}

        <div className="space-y-2">
          {[...(extrasCatalog || [])].sort((a,b) => a.sort_order - b.sort_order).map((ex, idx, arr) => (
            <div key={ex.id} className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              {/* Flechas orden */}
              <div className="flex flex-col gap-0.5">
                <button onClick={() => handleMoveExtra(idx, -1)} disabled={idx === 0}
                  className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-20">
                  <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                </button>
                <button onClick={() => handleMoveExtra(idx, 1)} disabled={idx === arr.length - 1}
                  className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-20">
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
              {editingExtra?.id === ex.id ? (
                <>
                  <input className="input py-1 flex-1 text-sm" value={editingExtra.name}
                    onChange={e => setEditingExtra(v => ({ ...v, name: e.target.value }))} />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">S/</span>
                    <input type="number" min="0" step="0.5" className="input py-1 w-20 text-sm text-right"
                      value={editingExtra.price} onChange={e => setEditingExtra(v => ({ ...v, price: e.target.value }))} />
                  </div>
                  <button onClick={() => handleUpdateExtra(editingExtra)} className="btn-primary py-1 px-3 text-sm"><Save className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEditingExtra(null)} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"><Trash2 className="w-3.5 h-3.5 text-gray-400" /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">{ex.name}</span>
                  <span className="text-sm font-bold text-red-500">+S/{ex.price}</span>
                  <button onClick={() => setEditingExtra({ ...ex })} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                    <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  <button onClick={() => handleDeleteExtra(ex.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </>
              )}
            </div>
          ))}
          {(extrasCatalog || []).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Sin extras. Agrega el primero.</p>
          )}
        </div>
      </div>

      {/* Modals */}
      <Modal open={showServiceForm} onClose={() => { setShowServiceForm(false); setEditingService(null) }} title={editingService ? 'Editar servicio' : 'Nuevo servicio'}>
        <ServiceForm initial={editingService} onSave={handleSaveService} onClose={() => { setShowServiceForm(false); setEditingService(null) }} />
      </Modal>

      <ConfirmDialog
        open={!!deleteVehicleTarget}
        onClose={() => setDeleteVehicleTarget(null)}
        onConfirm={() => handleDeleteVehicle(deleteVehicleTarget)}
        title="¿Eliminar tipo de vehículo?"
        message="Los tickets registrados con este tipo no se verán afectados."
        confirmLabel="Eliminar"
        variant="danger"
      />

      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={() => handleToggleService(toggleTarget)}
        title={toggleTarget?.active ? '¿Desactivar servicio?' : '¿Activar servicio?'}
        message={toggleTarget?.active
          ? `"${toggleTarget?.name}" no aparecerá en nuevos tickets pero su historial se conserva.`
          : `"${toggleTarget?.name}" volverá a estar disponible en el registro de tickets.`}
        confirmLabel={toggleTarget?.active ? 'Desactivar' : 'Activar'}
        variant={toggleTarget?.active ? 'danger' : 'primary'}
      />
    </div>
  )
}
