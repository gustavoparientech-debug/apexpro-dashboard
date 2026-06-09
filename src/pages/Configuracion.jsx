import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { formatMoney, calcRealSalary, currentMonthYear } from '../lib/utils'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Badge from '../components/ui/Badge'
import { Plus, Edit2, ToggleLeft, ToggleRight, Save } from 'lucide-react'
import toast from 'react-hot-toast'

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

export default function Configuracion() {
  const { services, monthlyCosts, workers, incidents, addService, updateService, saveMonthlyCosts } = useApp()
  const { month, year } = currentMonthYear()
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [toggleTarget, setToggleTarget] = useState(null)
  const [costs, setCosts] = useState({
    rent: monthlyCosts?.rent || 2700,
    supplies: monthlyCosts?.supplies || 800,
    utility_goal: monthlyCosts?.utility_goal || 2000,
  })
  const [savingCosts, setSavingCosts] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')

  // Recalcular meta en tiempo real
  const payrollTotal = useMemo(() => {
    return workers.filter(w => w.active).reduce((s, w) => {
      const realSalary = calcRealSalary(w.base_salary, w.weekly_hours)
      const discounts = incidents.filter(i => i.worker_id === w.id && i.apply_discount).reduce((d, i) => d + (i.discount_amount || 0), 0)
      return s + realSalary - discounts
    }, 0)
  }, [workers, incidents])

  const incomeGoal = (parseFloat(costs.rent) || 0) + (parseFloat(costs.supplies) || 0) + payrollTotal + (parseFloat(costs.utility_goal) || 0)

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
    setSavingCosts(true)
    try {
      await saveMonthlyCosts({
        month,
        year,
        rent: parseFloat(costs.rent),
        supplies: parseFloat(costs.supplies),
        utility_goal: parseFloat(costs.utility_goal),
      })
      toast.success('Costos guardados')
    } catch (err) {
      toast.error('Error al guardar')
    } finally {
      setSavingCosts(false)
    }
  }

  const categories = ['all', 'basico', 'ceramico', 'polarizado', 'ppf']

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configuración</h1>

      {/* Costos fijos */}
      <div className="card">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Costos fijos mensuales</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="label">Alquiler (S/)</label>
            <input type="number" className="input" min="0" step="50" value={costs.rent} onChange={e => setCosts(c => ({ ...c, rent: e.target.value }))} />
          </div>
          <div>
            <label className="label">Insumos (S/)</label>
            <input type="number" className="input" min="0" step="50" value={costs.supplies} onChange={e => setCosts(c => ({ ...c, supplies: e.target.value }))} />
          </div>
          <div>
            <label className="label">Meta de utilidad (S/)</label>
            <input type="number" className="input" min="0" step="100" value={costs.utility_goal} onChange={e => setCosts(c => ({ ...c, utility_goal: e.target.value }))} />
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-900/30 mb-4">
          <div className="text-sm">
            <span className="text-gray-500">Planilla real del mes: </span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">{formatMoney(payrollTotal)}</span>
          </div>
          <div className="text-sm text-right">
            <span className="text-gray-500">Meta de ingresos: </span>
            <span className="font-bold text-orange-600 dark:text-orange-400">{formatMoney(incomeGoal)}</span>
          </div>
        </div>

        <button className="btn-primary flex items-center gap-2" onClick={handleSaveCosts} disabled={savingCosts}>
          <Save className="w-4 h-4" />
          {savingCosts ? 'Guardando...' : 'Guardar costos'}
        </button>
      </div>

      {/* Catálogo de servicios */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Catálogo de servicios</p>
          <button className="btn-primary text-sm flex items-center gap-1" onClick={() => { setEditingService(null); setShowServiceForm(true) }}>
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>

        {/* Filtros por categoría */}
        <div className="flex gap-2 flex-wrap mb-4">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeCategory === cat ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
            >
              {cat === 'all' ? 'Todos' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filteredServices.map(service => (
            <div key={service.id} className={`flex items-center gap-3 p-3 rounded-lg ${service.active ? 'bg-gray-50 dark:bg-gray-800/50' : 'bg-gray-100 dark:bg-gray-800 opacity-60'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{service.name}</p>
                  <Badge variant={CATEGORY_COLORS[service.category] || 'gray'}>{CATEGORY_LABELS[service.category]}</Badge>
                  {!service.active && <Badge variant="gray">Inactivo</Badge>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  S/{service.min_price} – S/{service.max_price} · Margen: {service.margin_percent}%
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { setEditingService(service); setShowServiceForm(true) }} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg">
                  <Edit2 className="w-4 h-4 text-gray-400" />
                </button>
                <button onClick={() => setToggleTarget(service)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg">
                  {service.active
                    ? <ToggleRight className="w-4 h-4 text-green-500" />
                    : <ToggleLeft className="w-4 h-4 text-gray-400" />
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      <Modal open={showServiceForm} onClose={() => { setShowServiceForm(false); setEditingService(null) }} title={editingService ? 'Editar servicio' : 'Nuevo servicio'}>
        <ServiceForm initial={editingService} onSave={handleSaveService} onClose={() => { setShowServiceForm(false); setEditingService(null) }} />
      </Modal>

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
