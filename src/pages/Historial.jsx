import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { formatMoney, formatDate } from '../lib/utils'
import { Search, ClipboardList, Users, Download, ChevronDown, ChevronUp, Pencil, Trash2, Check, X as XIcon, Phone, User } from 'lucide-react'
import toast from 'react-hot-toast'

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

const PAYMENT_ICONS = { efectivo: '💵', yape: '📱', transferencia: '🏦' }

export default function Historial() {
  const [tab, setTab] = useState('historial')

  return (
    <div className="space-y-4 pb-8">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        <button onClick={() => setTab('historial')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-colors ${
            tab === 'historial' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500'
          }`}>
          <ClipboardList className="w-4 h-4" /> Historial
        </button>
        <button onClick={() => setTab('clientes')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-colors ${
            tab === 'clientes' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500'
          }`}>
          <Users className="w-4 h-4" /> Clientes
        </button>
      </div>

      {tab === 'historial' ? <TicketHistory /> : <ClientList />}
    </div>
  )
}

// ─── Historial de tickets ────────────────────────────────────────────────────
function TicketHistory() {
  const { tickets, expenses, workers, vehicleTypes } = useApp()
  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

  const [dateFrom, setDateFrom] = useState(weekAgo)
  const [dateTo,   setDateTo]   = useState(today)
  const [search,   setSearch]   = useState('')
  const [pastTickets,   setPastTickets]   = useState([])
  const [pastExpenses,  setPastExpenses]  = useState([])
  const [loading, setLoading] = useState(false)

  // Cargar datos del rango desde Supabase
  useEffect(() => {
    if (IS_DEMO || !dateFrom || !dateTo) return
    setLoading(true)
    Promise.all([
      supabase.from('tickets').select('*').gte('date', dateFrom).lte('date', dateTo).neq('status', 'abierto').order('created_at', { ascending: false }),
      supabase.from('worker_expenses').select('*').gte('date', dateFrom).lte('date', dateTo).order('date', { ascending: false }),
    ]).then(([t, e]) => {
      setPastTickets(t.data || [])
      setPastExpenses(e.data || [])
    }).finally(() => setLoading(false))
  }, [dateFrom, dateTo])

  const allTickets  = useMemo(() => {
    const base = IS_DEMO ? tickets.filter(t => t.status !== 'abierto') : pastTickets
    if (!search.trim()) return base
    const q = search.toLowerCase()
    return base.filter(t =>
      t.plate?.toLowerCase().includes(q) ||
      workers.find(w => w.id === t.worker_id)?.name?.toLowerCase().includes(q) ||
      t.vehicle_type?.toLowerCase().includes(q) ||
      (vehicleTypes || []).find(v => v.value === t.vehicle_type)?.label?.toLowerCase().includes(q)
    )
  }, [pastTickets, tickets, search, workers])

  const allExpenses = useMemo(() => {
    const base = IS_DEMO ? expenses || [] : pastExpenses
    if (!search.trim()) return base
    const q = search.toLowerCase()
    return base.filter(e =>
      e.description?.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q) ||
      workers.find(w => w.id === e.worker_id)?.name?.toLowerCase().includes(q)
    )
  }, [pastExpenses, expenses, search, workers])

  const totalIncome   = allTickets.reduce((s, t) => s + (t.price_charged || 0), 0)
  const totalExpTotal = allExpenses.reduce((s, e) => s + (e.amount || 0), 0)

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este ticket?')) return
    try {
      await supabase.from('tickets').delete().eq('id', id)
      setPastTickets(prev => prev.filter(t => t.id !== id))
      toast.success('Ticket eliminado')
    } catch { toast.error('Error al eliminar') }
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="label text-xs">Desde</label>
          <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="flex-1">
          <label className="label text-xs">Hasta</label>
          <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Buscar placa, lavador, descripción..." className="input pl-9"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading && <p className="text-center text-sm text-gray-400 animate-pulse py-4">Cargando...</p>}

      {/* Resumen */}
      {!loading && (allTickets.length > 0 || allExpenses.length > 0) && (
        <div className="rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-900/20">
            <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">{allTickets.length} tickets</span>
            <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{formatMoney(totalIncome)}</span>
          </div>
          {allExpenses.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 bg-red-50 dark:bg-red-900/20">
              <span className="text-sm text-red-600 dark:text-red-400 font-medium">{allExpenses.length} gastos</span>
              <span className="text-sm font-bold text-red-600 dark:text-red-400">−{formatMoney(totalExpTotal)}</span>
            </div>
          )}
        </div>
      )}

      {/* Lista de tickets */}
      {!loading && allTickets.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">TICKETS ({allTickets.length})</p>
          <div className="space-y-2">
            {allTickets.map(t => {
              const worker = workers.find(w => w.id === t.worker_id)
              return (
                <div key={t.id} className="card flex items-center gap-3 border-l-4 border-green-400">
                  {t.photo_url && (
                    <img src={t.photo_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white">{t.plate || '—'}</p>
                    <p className="text-xs text-gray-500">{formatDate(t.date)} · {(vehicleTypes || []).find(v => v.value === t.vehicle_type)?.label || t.vehicle_type || '—'} · {worker?.name || '—'}</p>
                    {t.notes && <p className="text-xs text-gray-400 italic mt-0.5">{t.notes}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-green-600 dark:text-green-400">{formatMoney(t.price_charged)}</p>
                    <p className="text-xs text-gray-400">{PAYMENT_ICONS[t.payment_method]} {t.payment_method}</p>
                  </div>
                  {!IS_DEMO && (
                    <button onClick={() => handleDelete(t.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lista de gastos */}
      {!loading && allExpenses.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">GASTOS ({allExpenses.length})</p>
          <div className="space-y-2">
            {allExpenses.map(e => {
              const worker = workers.find(w => w.id === e.worker_id)
              return (
                <div key={e.id} className="card flex items-center gap-3 border-l-4 border-red-400">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white">{e.description || e.notes || e.category || '—'}</p>
                    <p className="text-xs text-gray-500">{formatDate(e.date)}{worker ? ` · ${worker.name}` : ''}</p>
                  </div>
                  <p className="font-bold text-red-500 flex-shrink-0">−{formatMoney(e.amount)}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && allTickets.length === 0 && allExpenses.length === 0 && (
        <div className="card text-center py-10 text-gray-400">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin registros en este período</p>
        </div>
      )}
    </div>
  )
}

// ─── Lista de Clientes (por placa) ──────────────────────────────────────────
const CLIENT_FILTERS = ['Todos', 'Con contacto', 'Sin contacto', 'Frecuentes', 'Inactivos']
const FREE_WASH_EVERY = 10 // cada 10 lavados = 1 gratis

function ClientList() {
  const { tickets, workers, vehicleTypes } = useApp()
  const [search,     setSearch]     = useState('')
  const [filter,     setFilter]     = useState('Todos')
  const [expanded,   setExpanded]   = useState(null)
  const [allTickets, setAllTickets] = useState([])
  const [loading,    setLoading]    = useState(false)
  const [clientMeta, setClientMeta] = useState({}) // { plate: { name, phone, free_washes_redeemed } }
  const [editing,    setEditing]    = useState(null) // plate being edited
  const [editForm,   setEditForm]   = useState({ name: '', phone: '' })

  useEffect(() => {
    if (IS_DEMO) { setAllTickets(tickets.filter(t => t.status !== 'abierto')); return }
    setLoading(true)
    Promise.all([
      supabase.from('tickets').select('*').neq('status', 'abierto').order('date', { ascending: false }),
      supabase.from('vehicle_clients').select('*'),
    ]).then(([t, vc]) => {
      setAllTickets(t.data || [])
      const meta = {}
      ;(vc.data || []).forEach(r => { meta[r.plate] = r })
      setClientMeta(meta)
    }).finally(() => setLoading(false))
  }, [tickets])

  const clients = useMemo(() => {
    const map = {}
    allTickets.forEach(t => {
      const key = t.plate || 'SIN PLACA'
      if (!map[key]) map[key] = { plate: key, tickets: [], totalSpent: 0, lastDate: '' }
      map[key].tickets.push(t)
      map[key].totalSpent += (t.price_charged || 0)
      if (!map[key].lastDate || t.date > map[key].lastDate) map[key].lastDate = t.date
    })
    return Object.values(map).sort((a, b) => b.lastDate.localeCompare(a.lastDate))
  }, [allTickets])

  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const filtered = useMemo(() => {
    let list = clients
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c => {
        const meta = clientMeta[c.plate]
        return c.plate.toLowerCase().includes(q) ||
          meta?.name?.toLowerCase().includes(q) ||
          meta?.phone?.includes(q)
      })
    }
    if (filter === 'Con contacto')  list = list.filter(c => clientMeta[c.plate]?.name || clientMeta[c.plate]?.phone)
    if (filter === 'Sin contacto')  list = list.filter(c => !clientMeta[c.plate]?.name && !clientMeta[c.plate]?.phone)
    if (filter === 'Frecuentes')    list = list.filter(c => c.tickets.length >= 3)
    if (filter === 'Inactivos')     list = list.filter(c => c.lastDate < thirtyDaysAgo)
    return list
  }, [clients, search, filter, thirtyDaysAgo, clientMeta])

  function lastVisitLabel(date) {
    if (!date) return '—'
    if (date === today) return 'hoy'
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    if (date === yesterday) return 'ayer'
    return formatDate(date)
  }

  async function saveClientMeta(plate) {
    const payload = { plate, name: editForm.name, phone: editForm.phone }
    if (!IS_DEMO) {
      const { error } = await supabase.from('vehicle_clients').upsert(payload, { onConflict: 'plate' })
      if (error) { toast.error('Error al guardar'); return }
    }
    setClientMeta(prev => ({ ...prev, [plate]: { ...(prev[plate] || {}), ...payload } }))
    setEditing(null)
    toast.success('Guardado')
  }

  async function redeemFreeWash(plate, currentRedeemed) {
    const newCount = currentRedeemed + 1
    if (!IS_DEMO) {
      await supabase.from('vehicle_clients').upsert({ plate, free_washes_redeemed: newCount }, { onConflict: 'plate' })
    }
    setClientMeta(prev => ({ ...prev, [plate]: { ...(prev[plate] || { plate }), free_washes_redeemed: newCount } }))
    toast.success('Lavado gratis canjeado')
  }

  async function exportExcel() {
    try {
      const XLSX = await import('xlsx')
      const rows = [
        ['Placa', 'Nombre', 'Teléfono', 'Visitas', 'Total gastado (S/)', 'Última visita'],
        ...filtered.map(c => {
          const m = clientMeta[c.plate] || {}
          return [c.plate, m.name || '—', m.phone || '—', c.tickets.length, c.totalSpent.toFixed(2), c.lastDate]
        })
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Clientes')
      XLSX.writeFile(wb, 'clientes-apexpro.xlsx')
      toast.success('Excel exportado')
    } catch { toast.error('Error al exportar') }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Buscar placa, nombre o teléfono..." className="input pl-9"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <button onClick={exportExcel}
        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors">
        <Download className="w-4 h-4" /> Exportar Excel ({filtered.length})
      </button>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {CLIENT_FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}>
            {f}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-blue-600 dark:text-blue-400 font-medium">{filtered.length} placas</span>
        <span className="text-gray-400">de {clients.length} totales</span>
      </div>

      {loading && <p className="text-center text-sm text-gray-400 animate-pulse py-4">Cargando...</p>}

      <div className="space-y-2">
        {filtered.map(c => {
          const isOpen  = expanded === c.plate
          const meta    = clientMeta[c.plate] || {}
          const isEdit  = editing === c.plate
          const accumulated = c.tickets.length
          const earned      = Math.floor(accumulated / FREE_WASH_EVERY)
          const redeemed    = meta.free_washes_redeemed || 0
          const available   = Math.max(0, earned - redeemed)

          return (
            <div key={c.plate} className="card overflow-hidden p-0">
              {/* Header */}
              <button className="w-full flex items-center justify-between px-4 py-3"
                onClick={() => setExpanded(isOpen ? null : c.plate)}>
                <div className="text-left">
                  <p className="font-bold text-gray-900 dark:text-white">{c.plate}</p>
                  {meta.name && <p className="text-xs text-gray-500">{meta.name}{meta.phone ? ` · ${meta.phone}` : ''}</p>}
                  <p className="text-xs text-gray-400">{c.tickets.length} visita{c.tickets.length !== 1 ? 's' : ''} · última: {lastVisitLabel(c.lastDate)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>

              {/* Detalle expandido */}
              {isOpen && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-4 pb-4 space-y-4">

                  {/* Editar nombre y teléfono */}
                  {isEdit ? (
                    <div className="flex gap-2 pt-3">
                      <div className="flex-1 relative">
                        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input className="input pl-8 text-sm" placeholder="Nombre" value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                      </div>
                      <div className="flex-1 relative">
                        <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input className="input pl-8 text-sm" placeholder="Teléfono" value={editForm.phone}
                          onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                      </div>
                      <button onClick={() => saveClientMeta(c.plate)} className="p-2 bg-green-100 hover:bg-green-200 rounded-lg">
                        <Check className="w-4 h-4 text-green-600" />
                      </button>
                      <button onClick={() => setEditing(null)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg">
                        <XIcon className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditing(c.plate); setEditForm({ name: meta.name || '', phone: meta.phone || '' }) }}
                      className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-sm text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                      <Pencil className="w-3.5 h-3.5" /> Editar nombre y teléfono
                    </button>
                  )}

                  {/* Tarjeta de fidelidad */}
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Tarjeta de fidelidad:</span>{' '}
                    {accumulated} lavados acumulados · {earned} ganado{earned !== 1 ? 's' : ''} · {redeemed} canjeado{redeemed !== 1 ? 's' : ''}
                    {available > 0 && (
                      <button onClick={() => redeemFreeWash(c.plate, redeemed)}
                        className="ml-2 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full hover:bg-green-200 transition-colors">
                        🎁 Canjear ({available} disponible{available !== 1 ? 's' : ''})
                      </button>
                    )}
                  </div>

                  {/* Últimas visitas */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Últimas visitas</p>
                    <div className="space-y-1">
                      {c.tickets.map(t => {
                        const worker = workers.find(w => w.id === t.worker_id)
                        return (
                          <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
                            <div>
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.date}</p>
                              <p className="text-xs text-gray-400">{(vehicleTypes || []).find(v => v.value === t.vehicle_type)?.label || t.vehicle_type || '—'} · {worker?.name || '—'}</p>
                            </div>
                            <p className="font-semibold text-green-600 dark:text-green-400">{formatMoney(t.price_charged)}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="card text-center py-10 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay clientes que coincidan</p>
        </div>
      )}
    </div>
  )
}
