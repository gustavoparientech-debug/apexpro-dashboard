import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import {
  GRUPOS, DEFAULT_ITEMS, DEFAULT_BAYS, METAS_KEY, monthPrefix, resolveItems, computeProgress,
  computeEconomics, fetchMetasConfig, saveMetasConfig, fetchMetasRows, rowsFromTickets,
  origenMes, baysDelMes, conPrecioCatalogo, conCostoTabla, servicioVinculado,
} from '../../lib/metas'
import { monthName, todayISO, formatMoney, getWorkingDaysInMonth } from '../../lib/utils'
import { CATEGORIAS, porCategoria } from '../../lib/servicios'
import { Plus, Save, Trash2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal, ExternalLink, RotateCcw, Calculator, Link2, X, Check, Search } from 'lucide-react'
import toast from 'react-hot-toast'

const FUENTES = [
  { value: 'vehiculo',  label: 'Por servicio del catálogo', hint: 'Cuenta los tickets del mes cuyo servicio sea uno de los marcados. Es el conteo directo: no depende de cómo se escriba nada.' },
  { value: 'categoria', label: 'Por categoría del catálogo', hint: 'Cuenta todos los tickets de esa categoría. Solo aplica a los tickets abiertos con el catálogo nuevo — los anteriores no tienen categoría guardada.' },
  { value: 'palabras',  label: 'Por palabras del adicional', hint: 'Cuenta los adicionales del ticket que contengan alguna de estas palabras. Sin tildes ni mayúsculas.' },
  { value: 'presupuesto', label: 'Por servicio de Presupuesto', hint: 'Cuenta los tickets que tienen este servicio de Presupuesto, ya sea elegido como servicio del ticket o pasado como adicional desde una cotización.' },
  { value: 'panos',     label: 'Por paños de planchado', hint: 'Cuenta cada paño pintado o planchado: los del planchado abierto en Registro y los que llegan desde una cotización. La meta es en paños.' },
  { value: 'manual',    label: 'Solo manual', hint: 'No se cuenta solo: el avance se escribe a mano en la columna “Manual”.' },
]

// Ventana para elegir qué servicios de Presupuesto se vuelven metas.
function SelectorServicios({ grupos, presentes, onAgregar, onClose }) {
  const [elegidos, setElegidos] = useState(() => new Set())
  const [busca, setBusca] = useState('')
  const q = busca.trim().toLowerCase()

  function alternar(id) {
    setElegidos(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const visibles = grupos
    .map(g => ({ ...g, opciones: g.opciones.filter(o => !q || o.label.toLowerCase().includes(q)) }))
    .filter(g => g.opciones.length)

  function agregar() {
    const todas = grupos.flatMap(g => g.opciones)
    onAgregar(todas.filter(o => elegidos.has(o.id)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <p className="font-bold text-gray-900 dark:text-white">Traer servicios de Presupuesto</p>
            <p className="text-xs text-gray-400">Marca los que quieres como meta de este mes</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar servicio…"
              className="flex-1 bg-transparent text-sm outline-none text-gray-800 dark:text-gray-100" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3">
          {visibles.map(g => (
            <div key={g.id}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{g.emoji} {g.label}</p>
              <div className="space-y-1">
                {g.opciones.map(o => {
                  const ya  = presentes.has(o.id)
                  const sel = elegidos.has(o.id)
                  const pv  = o.precio?.variants?.find(v => !o.variants?.length || o.variants.includes(v.label)) || o.precio?.variants?.[0]
                  const precio = Number(pv?.price ?? o.precio?.default_price) || 0
                  return (
                    <button key={o.id} disabled={ya} onClick={() => alternar(o.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-colors ${
                        ya ? 'opacity-50 border-gray-100 dark:border-gray-800'
                          : sel ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}>
                      <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-none ${
                        sel ? 'bg-red-600 border-red-600' : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {sel && <Check className="w-3.5 h-3.5 text-white" />}
                      </span>
                      <span className="text-base">{o.emoji}</span>
                      <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{o.label}</span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {ya ? 'Ya está' : precio > 0 ? `${formatMoney(precio)}${o.source === 'panos' ? '/paño' : ''}` : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {!visibles.length && <p className="text-xs text-gray-400 text-center py-6">No hay servicios con ese nombre</p>}
        </div>
        <div className="px-4 pb-5 pt-2 border-t border-gray-100 dark:border-gray-800">
          <button onClick={agregar} disabled={!elegidos.size}
            className="btn-primary w-full py-3 rounded-xl font-bold disabled:opacity-50">
            {elegidos.size ? `Agregar ${elegidos.size} servicio${elegidos.size === 1 ? '' : 's'}` : 'Elige al menos un servicio'}
          </button>
        </div>
      </div>
    </div>
  )
}

function nuevoId() {
  return 'meta_' + Date.now().toString(36)
}

export default function MetasConfig({ year, month, costoFijo = 0, onChangeMonth, sinEnlace = false }) {
  const { serviciosTicket: vehicleTypes, tickets, isDemo, metasCatalogo } = useApp()
  // Precios vigentes de Presupuesto y del catálogo, buscados por servicio.
  const catalogo = metasCatalogo?.catalogo || vehicleTypes
  const gruposPresupuesto = metasCatalogo?.grupos || []
  const [selector, setSelector] = useState(false)
  const prefix = monthPrefix(year, month)

  const [config, setConfig]   = useState(null)
  const [items, setItems]     = useState([])
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [abierto, setAbierto] = useState(null) // id del ítem con opciones avanzadas abiertas
  const [bays, setBays]       = useState(DEFAULT_BAYS)
  // Cambios sin guardar: mientras haya, no se pisa lo que el admin escribe
  // aunque otra pantalla guarde metas.
  const [dirty, setDirty]     = useState(false)
  const dirtyRef = useRef(false)
  useEffect(() => { dirtyRef.current = dirty }, [dirty])

  const cargarAvance = useCallback(async () => {
    if (isDemo) { setRows(rowsFromTickets(tickets, prefix)); return }
    try { setRows(await fetchMetasRows(prefix)) }
    catch { setRows(rowsFromTickets(tickets, prefix)) }
  }, [prefix, isDemo, tickets])

  const aplicarConfig = useCallback(cfg => {
    setConfig(cfg)
    setItems(resolveItems(cfg, prefix))
    setBays(baysDelMes(cfg, prefix))
    setDirty(false)
  }, [prefix])

  useEffect(() => {
    let vivo = true
    setLoading(true)
    fetchMetasConfig()
      .then(cfg => { if (vivo) aplicarConfig(cfg) })
      .finally(() => { if (vivo) setLoading(false) })
    return () => { vivo = false }
  }, [aplicarConfig])

  // Metas guardadas desde otra pestaña u otro dispositivo se
  // reflejan acá sin recargar, salvo que haya cambios sin guardar.
  useEffect(() => {
    if (isDemo) return
    const ch = supabase
      .channel(`metas-config-${prefix}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: `key=eq.${METAS_KEY}` },
        () => { if (!dirtyRef.current) fetchMetasConfig().then(aplicarConfig) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [prefix, isDemo, aplicarConfig])

  // El avance sí se refresca cuando entran tickets nuevos.
  useEffect(() => { cargarAvance() }, [prefix, tickets.length])

  // Precio vigente de Presupuesto / catálogo: cambia solo cuando allá se edita.
  const vivos = useMemo(
    () => items.map(i => conCostoTabla(conPrecioCatalogo(i, catalogo), metasCatalogo || {})),
    [items, catalogo, metasCatalogo]
  )
  const progreso = useMemo(() => computeProgress(vivos, rows, todayISO()), [vivos, rows])
  const origen = useMemo(() => origenMes(config, prefix), [config, prefix])

  function editar(fn) {
    setItems(fn)
    setDirty(true)
  }
  function update(id, patch) {
    editar(list => list.map(i => i.id === id ? { ...i, ...patch } : i))
  }
  function mover(idx, dir) {
    const destino = idx + dir
    if (destino < 0 || destino >= items.length) return
    editar(list => {
      const copia = [...list]
      const [x] = copia.splice(idx, 1)
      copia.splice(destino, 0, x)
      return copia
    })
  }
  function agregar() {
    editar(list => [...list, {
      id: nuevoId(), emoji: '🎯', label: '', goal: 0, manual: 0,
      group: 'detailing', source: 'manual', vehicles: [], keywords: [], categories: [], variants: [],
      price: 0, margin: 0, bayDays: 0,
    }])
  }
  function eliminar(id) {
    editar(list => list.filter(i => i.id !== id))
    if (abierto === id) setAbierto(null)
  }
  function cambiarMes(delta) {
    if (dirty && !window.confirm('Hay cambios sin guardar en las metas de este mes. ¿Salir sin guardar?')) return
    let m = month + delta, y = year
    if (m < 1) { m = 12; y -= 1 }
    if (m > 12) { m = 1; y += 1 }
    onChangeMonth(y, m)
  }
  // Solo los servicios que el admin marca: cada uno sabe cómo contarse en los
  // tickets y de qué servicio de Presupuesto toma el precio.
  const presentes = useMemo(() => {
    const ids = new Set(items.map(i => i.id))
    if (items.some(i => i.source === 'panos')) ids.add('pres_pano')
    return ids
  }, [items])

  function agregarElegidos(opciones) {
    const nuevos = opciones.map(o => ({
      id: o.id, emoji: o.emoji || '🎯', label: o.label,
      goal: 0, manual: 0, group: o.group || 'detailing', source: o.source,
      vehicles: o.vehicles || [], variants: o.variants || [], keywords: o.keywords || [], categories: [],
      precioDe: o.precioDe, price: 0, margin: 0, bayDays: 0,
    }))
    editar(list => [...list, ...nuevos])
    setSelector(false)
    toast(`${nuevos.length} servicio${nuevos.length === 1 ? '' : 's'} agregado${nuevos.length === 1 ? '' : 's'} — pon las metas y guarda`, { icon: '📋' })
  }

  function restaurar() {
    editar(() => DEFAULT_ITEMS.map(i => ({ ...i, manual: 0 })))
    toast('Lista de referencia cargada — recuerda guardar', { icon: '↩️' })
  }

  async function guardar() {
    if (items.some(i => !i.label.trim())) { toast.error('Todos los servicios necesitan nombre'); return }
    setSaving(true)
    try {
      // Se guarda con el precio vigente de Presupuesto; el costo viaja aparte
      // para que el margen siga al precio cuando allá cambie.
      const definiciones = vivos.map(({ id, emoji, label, group, source, vehicles, keywords, categories, variants, goal, price, margin, costo, bayDays, precioDe }) => ({
        id, emoji, label: label.trim(), group, source,
        vehicles: vehicles || [], keywords: keywords || [],
        categories: categories || [], variants: variants || [],
        goal: Number(goal) || 0,
        price: Number(price) || 0, margin: Number(margin) || 0, bayDays: Number(bayDays) || 0,
        ...(costo != null ? { costo: Number(costo) } : {}),
        ...(precioDe !== undefined ? { precioDe } : {}),
      }))
      const manualMes = Object.fromEntries(items.map(i => [i.id, Number(i.manual) || 0]))
      // Solo se escribe este mes: los demás quedan como estaban.
      const nuevo = {
        ...(config || {}),
        months: { ...(config?.months || {}), [prefix]: { bays: Number(bays) || 0, items: definiciones } },
        manual: { ...(config?.manual || {}), [prefix]: manualMes },
      }
      await saveMetasConfig(nuevo)
      setConfig(nuevo)
      setDirty(false)
      toast.success(`Metas de ${monthName(month)} ${year} guardadas ✓`)
    } catch (err) {
      toast.error('Error al guardar: ' + (err.message || ''))
    } finally { setSaving(false) }
  }

  // Deja el mes como estaba antes de configurarlo: vuelve a heredar del anterior.
  async function quitarConfigMes() {
    if (!window.confirm(`¿Quitar la configuración propia de ${monthName(month)} ${year}? Volverá a copiar la del mes anterior.`)) return
    setSaving(true)
    try {
      const months = { ...(config?.months || {}) }
      delete months[prefix]
      const goals = { ...(config?.goals || {}) }
      delete goals[prefix]
      const nuevo = { ...(config || {}), months, goals }
      await saveMetasConfig(nuevo)
      aplicarConfig(nuevo)
      toast.success('Listo, el mes vuelve a heredar')
    } catch (err) {
      toast.error('Error: ' + (err.message || ''))
    } finally { setSaving(false) }
  }

  const totalMeta  = items.reduce((s, i) => s + (Number(i.goal) || 0), 0)
  const totalHecho = progreso.reduce((s, i) => s + Math.min(i.done, i.goal), 0)
  const diasHabiles = getWorkingDaysInMonth(year, month)
  const econ = computeEconomics(progreso, { costoFijo, diasHabiles, bays })
  // El avance se mide en dinero: cien lavados no equivalen a un PPF.
  const totalPct   = econ.ingresoMeta > 0
    ? econ.pct
    : (totalMeta > 0 ? Math.round((totalHecho / totalMeta) * 100) : 0)
  const activos    = (vehicleTypes || []).filter(v => v.active !== false)
  // Servicios de los que una meta puede tomar el precio, sin repetir.
  const opcionesPrecio = gruposPresupuesto.map(g => {
    const vistos = new Set()
    const opciones = []
    for (const o of g.opciones) {
      if (!o.precioDe || vistos.has(o.precioDe)) continue
      vistos.add(o.precioDe)
      opciones.push({ value: o.precioDe, label: o.precio?.label || o.label })
    }
    return { id: g.id, label: g.label, emoji: g.emoji, opciones }
  }).filter(g => g.opciones.length)

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Metas de servicios — {monthName(month)} {year}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Los trabajadores ven estos números y su avance en la pestaña <strong>Avance</strong> de Metas.
          </p>
        </div>
        {!sinEnlace && (
          <Link to="/metas" className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline">
            Ver página <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {onChangeMonth && (
        <div className="flex items-center gap-2 mt-3">
          <button onClick={() => cambiarMes(-1)} className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700" title="Mes anterior">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <p className="flex-1 text-center text-sm font-bold text-gray-800 dark:text-gray-100 capitalize">
            {monthName(month)} {year}
          </p>
          <button onClick={() => cambiarMes(1)} className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700" title="Mes siguiente">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-gray-400 py-6 text-center">Cargando metas…</p>
      ) : (
        <>
          {/* De dónde salen las metas de este mes */}
          <div className={`mt-3 px-3 py-2 rounded-xl text-xs leading-snug flex items-start justify-between gap-2 ${
            origen.tipo === 'propio'
              ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-300'
          }`}>
            <span>
              {origen.tipo === 'propio' && <>Este mes tiene su <strong>configuración propia</strong>. Cambiarla no afecta a otros meses.</>}
              {origen.tipo === 'heredado' && (() => {
                const [y, m] = origen.desde.split('-').map(Number)
                return <>Copia de <strong>{monthName(m)} {y}</strong>. Al guardar queda como configuración propia de {monthName(month)}, sin tocar {monthName(m)}.</>
              })()}
              {origen.tipo === 'referencia' && <>Lista de referencia. Al guardar queda como configuración propia de {monthName(month)}.</>}
            </span>
            {origen.tipo === 'propio' && (
              <button onClick={quitarConfigMes} disabled={saving} className="text-[11px] font-semibold underline whitespace-nowrap">
                Volver a heredar
              </button>
            )}
          </div>
          {dirty && (
            <p className="mt-2 text-[11px] font-semibold text-amber-600 dark:text-amber-400">● Cambios sin guardar</p>
          )}
          {/* Resumen */}
          <div className="flex items-center justify-between gap-3 p-3 my-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
            <div className="text-sm">
              <span className="text-gray-500">Avance del mes: </span>
              <span className="font-bold text-gray-800 dark:text-gray-100">{formatMoney(econ.ingresoLogrado)} de {formatMoney(econ.ingresoMeta)}</span>
              <span className="text-gray-400 text-xs"> · {totalHecho} de {totalMeta} servicios</span>
            </div>
            <span className="text-lg font-black text-red-600 dark:text-red-400">{totalPct}%</span>
          </div>

          {/* ¿Cuánto genera este plan? Se recalcula al tipear, sin guardar. */}
          <div className="p-3 mb-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-4 h-4 text-gray-400" />
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 flex-1">Si se cumple el plan</p>
              <label className="flex items-center gap-1.5 text-[11px] text-gray-500">
                Bahías
                <input type="number" min="0" step="1" value={bays}
                  onChange={e => { setBays(e.target.value === '' ? 0 : Number(e.target.value)); setDirty(true) }}
                  className="w-14 text-center text-xs font-bold bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 py-1 focus:outline-none focus:ring-2 focus:ring-red-500" />
              </label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-white dark:bg-gray-900 rounded-xl px-3 py-2">
                <p className="text-[10px] text-gray-400">Ingreso proyectado</p>
                <p className="text-sm font-black text-gray-800 dark:text-gray-100 tabular-nums">{formatMoney(econ.ingresoMeta)}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl px-3 py-2">
                <p className="text-[10px] text-gray-400">Margen proyectado</p>
                <p className="text-sm font-black text-gray-800 dark:text-gray-100 tabular-nums">{formatMoney(econ.margenMeta)}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl px-3 py-2">
                <p className="text-[10px] text-gray-400">Costo fijo del mes</p>
                <p className="text-sm font-black text-gray-800 dark:text-gray-100 tabular-nums">{formatMoney(econ.costoFijo)}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl px-3 py-2">
                <p className="text-[10px] text-gray-400">Utilidad proyectada</p>
                <p className={`text-sm font-black tabular-nums ${econ.utilidadMeta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatMoney(econ.utilidadMeta)}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-2 leading-snug">
              Días de bahía necesarios: <strong>{econ.diasMeta.toFixed(1)}</strong> de {econ.capacidad.toFixed(0)} disponibles
              ({diasHabiles} días hábiles × {bays} bahías) — <strong>{Math.round(econ.capacidadPct)}%</strong> de capacidad.
              {econ.capacidadPct > 100 && ' El plan no entra en el taller.'}
            </p>
            <p className="text-[11px] text-gray-400 mt-1 leading-snug">
              Generado hasta hoy: <strong>{formatMoney(econ.ingresoReal)}</strong> · margen {formatMoney(econ.margenReal)}
            </p>
          </div>

          {/* Cabecera de columnas */}
          <div className="grid grid-cols-[1fr_60px_58px_58px] gap-2 px-1 pb-1.5 border-b border-gray-100 dark:border-gray-800">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Servicio</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide text-center">Meta</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide text-center">Manual</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide text-center">Avance</span>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item, idx) => {
              const p = progreso.find(x => x.id === item.id) || { done: 0, auto: 0, pct: 0 }
              const v = vivos[idx] || item
              const expandido = abierto === item.id
              return (
                <div key={item.id} className="py-2">
                  <div className="grid grid-cols-[1fr_60px_58px_58px] gap-2 items-center">
                    {/* Emoji + nombre */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <input
                        className="w-9 text-center text-base bg-transparent rounded-lg py-1 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                        value={item.emoji || ''} maxLength={4}
                        onChange={e => update(item.id, { emoji: e.target.value })}
                        title="Emoji"
                      />
                      <input
                        className="flex-1 min-w-0 text-sm font-medium text-gray-800 dark:text-gray-100 bg-transparent rounded-lg px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                        value={item.label} placeholder="Nombre del servicio"
                        onChange={e => update(item.id, { label: e.target.value })}
                      />
                    </div>
                    {/* Meta del mes */}
                    <input
                      type="number" min="0" step="1"
                      className="w-full text-center text-sm font-bold bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500"
                      value={item.goal}
                      onChange={e => update(item.id, { goal: e.target.value === '' ? 0 : Number(e.target.value) })}
                    />
                    {/* Ajuste manual */}
                    <input
                      type="number" min="0" step="1"
                      className={`w-full text-center text-sm font-bold rounded-lg border py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500 ${
                        item.source === 'manual'
                          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      }`}
                      value={item.manual || 0}
                      onChange={e => update(item.id, { manual: e.target.value === '' ? 0 : Number(e.target.value) })}
                      title="Trabajos que no salen de los tickets"
                    />
                    {/* Avance calculado */}
                    <div className="text-center">
                      <p className="text-sm font-black text-gray-800 dark:text-gray-100 leading-none tabular-nums">{p.done}</p>
                      <p className="text-[10px] text-gray-400">{p.pct}%</p>
                    </div>
                  </div>

                  {/* Lo que aporta esta meta al plan */}
                  <p className="text-[11px] text-gray-400 pl-1 mt-0.5">
                    {item.goal > 0 && (Number(v.price) || Number(v.margin))
                      ? <>Genera <strong className="text-gray-600 dark:text-gray-300">{formatMoney((Number(item.goal) || 0) * (Number(v.price) || 0))}</strong>
                          {' '}· margen {formatMoney((Number(item.goal) || 0) * (Number(v.margin) || 0))}</>
                      : Number(v.price) > 0
                        ? 'Pon una meta para que sume al plan'
                        : 'Sin precio cargado — no suma al plan'}
                    {v.vinculo && (
                      <span className="inline-flex items-center gap-1 ml-1.5 text-sky-600 dark:text-sky-400" title="El precio se actualiza solo cuando cambia en Presupuesto o el catálogo">
                        <Link2 className="w-3 h-3" /> {formatMoney(v.price)}{item.source === 'panos' ? '/paño' : ''} de {v.vinculo.label}{v.vinculo.variante ? ` · ${v.vinculo.variante}` : ''}
                      </span>
                    )}
                  </p>

                  {/* Acciones de la fila */}
                  <div className="flex items-center gap-1 mt-1 pl-1">
                    <button onClick={() => setAbierto(expandido ? null : item.id)}
                      className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors ${
                        expandido ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                      }`}>
                      <SlidersHorizontal className="w-3 h-3" />
                      {FUENTES.find(f => f.value === item.source)?.label || 'Cómo se cuenta'}
                    </button>
                    <div className="flex-1" />
                    <button onClick={() => mover(idx, -1)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" title="Subir">
                      <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button onClick={() => mover(idx, 1)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" title="Bajar">
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button onClick={() => eliminar(item.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20" title="Eliminar">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>

                  {/* Opciones avanzadas */}
                  {expandido && (
                    <div className="mt-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="label text-xs">Grupo</label>
                          <select className="input text-sm py-1.5" value={item.group || 'detailing'}
                            onChange={e => update(item.id, { group: e.target.value })}>
                            {GRUPOS.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label text-xs">Cómo se cuenta</label>
                          <select className="input text-sm py-1.5" value={item.source}
                            onChange={e => update(item.id, { source: e.target.value })}>
                            {FUENTES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </select>
                        </div>
                      </div>

                      <p className="text-[11px] text-gray-400 leading-snug">
                        {FUENTES.find(f => f.value === item.source)?.hint}
                      </p>

                      {/* Precio conectado a Presupuesto / catálogo */}
                      <div>
                        <label className="label text-xs">Precio tomado de</label>
                        <select className="input text-sm py-1.5"
                          value={servicioVinculado(item) || ''}
                          onChange={e => {
                            const val = e.target.value
                            // Al desconectar se queda con el último precio vigente.
                            if (!val) update(item.id, { precioDe: '', price: v.price, margin: v.margin, costo: undefined })
                            else update(item.id, { precioDe: val })
                          }}>
                          <option value="">Escrito a mano</option>
                          {opcionesPrecio.map(grupo => (
                            <optgroup key={grupo.id} label={`${grupo.emoji} ${grupo.label}`}>
                              {grupo.opciones.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </optgroup>
                          ))}
                          {servicioVinculado(item) && !opcionesPrecio.some(g => g.opciones.some(o => o.value === servicioVinculado(item))) && (
                            <option value={servicioVinculado(item)}>{v.vinculo?.label || 'Servicio anterior'}</option>
                          )}
                        </select>
                        {servicioVinculado(item) && !v.vinculo && (
                          <p className="text-[11px] text-amber-600 mt-1">Ese servicio ya no está en el catálogo — se usa el último precio guardado.</p>
                        )}
                      </div>

                      {/* Economía del servicio: lo que hace que el plan tenga monto */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="label text-xs">Precio unitario</label>
                          <input type="number" min="0" step="1"
                            className={`input text-sm py-1.5 ${v.vinculo ? 'opacity-70 cursor-not-allowed' : ''}`}
                            value={v.price ?? 0}
                            readOnly={!!v.vinculo}
                            title={v.vinculo ? 'Viene de Presupuesto: se cambia allá' : undefined}
                            onChange={e => update(item.id, { price: e.target.value === '' ? 0 : Number(e.target.value) })} />
                        </div>
                        <div>
                          <label className="label text-xs">Margen unitario</label>
                          <input type="number" min="0" step="1"
                            className={`input text-sm py-1.5 ${v.costoTabla ? 'opacity-70 cursor-not-allowed' : ''}`}
                            value={v.margin ?? 0}
                            readOnly={!!v.costoTabla}
                            title={v.costoTabla ? 'Sale de la pestaña Márgenes: se cambia allá' : undefined}
                            onChange={e => {
                              const m = e.target.value === '' ? 0 : Number(e.target.value)
                              // Con precio conectado se guarda el costo, así el
                              // margen acompaña los cambios de precio.
                              update(item.id, v.vinculo ? { margin: m, costo: v.price - m } : { margin: m })
                            }} />
                        </div>
                        <div>
                          <label className="label text-xs">Días de bahía</label>
                          <input type="number" min="0" step="0.05" className="input text-sm py-1.5"
                            value={item.bayDays ?? 0}
                            onChange={e => update(item.id, { bayDays: e.target.value === '' ? 0 : Number(e.target.value) })} />
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-400 leading-snug">
                        El <strong>margen</strong> es lo que queda del precio después del material y la mano de obra.
                        Los <strong>días de bahía</strong> dicen cuánto ocupa el taller una unidad (0.05 = un rato; 3 = tres días).
                        {v.costoTabla && <> El margen de este servicio sale de la pestaña <strong>Márgenes</strong> (costo {formatMoney(v.costo)}).</>}
                      </p>

                      {item.source === 'vehiculo' && (
                        <div className="space-y-2">
                          {porCategoria(activos).map(grupo => (
                            <div key={grupo.value}>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                                {grupo.emoji} {grupo.label}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {grupo.servicios.map(v => {
                                  const sel = (item.vehicles || []).includes(v.value)
                                  return (
                                    <button key={v.id || v.value}
                                      onClick={() => update(item.id, {
                                        vehicles: sel
                                          ? item.vehicles.filter(x => x !== v.value)
                                          : [...(item.vehicles || []), v.value],
                                      })}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                                        sel
                                          ? 'bg-red-600 border-red-600 text-white'
                                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                                      }`}>
                                      {v.emoji} {v.label}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                          <p className="text-[11px] text-gray-400">
                            La meta suma todas las variantes del servicio (Auto, SUV, Pick-Up…).
                          </p>
                        </div>
                      )}

                      {item.source === 'categoria' && (
                        <div className="flex flex-wrap gap-1.5">
                          {CATEGORIAS.map(c => {
                            const sel = (item.categories || []).includes(c.value)
                            return (
                              <button key={c.value}
                                onClick={() => update(item.id, {
                                  categories: sel
                                    ? item.categories.filter(x => x !== c.value)
                                    : [...(item.categories || []), c.value],
                                })}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                                  sel
                                    ? 'bg-red-600 border-red-600 text-white'
                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                                }`}>
                                {c.emoji} {c.label}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {(item.source === 'palabras' || item.source === 'presupuesto') && (
                        <div>
                          <label className="label text-xs">
                            {item.source === 'presupuesto' ? 'Nombre con el que llega como adicional' : 'Palabras clave (separadas por coma)'}
                          </label>
                          <input className="input text-sm py-1.5"
                            value={(item.keywords || []).join(', ')}
                            placeholder="ej: carpro 2, car pro 2"
                            onChange={e => update(item.id, {
                              keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean),
                            })} />
                          <p className="text-[11px] text-gray-400 mt-1">
                            Detectados automáticamente este mes: <strong>{p.auto}</strong>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            <button onClick={() => setSelector(true)}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-red-200 dark:border-red-800 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <Plus className="w-4 h-4" /> Traer servicios de Presupuesto
            </button>
            <button onClick={agregar}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-400 hover:text-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
              <Plus className="w-4 h-4" /> Meta suelta
            </button>
          </div>

          <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
            <strong>Meta</strong> es lo que hay que hacer este mes. <strong>Manual</strong> suma trabajos que no
            quedan registrados en un ticket (planchado, trabajos con el pintor). <strong>Avance</strong> es lo que
            ya lleva el equipo. Cada mes se guarda por separado: un mes nuevo arranca como copia del último
            configurado y lo que cambies ahí no toca a los demás. Los precios con 🔗 vienen de Presupuesto y se
            actualizan solos cuando los cambias allá.
          </p>

          <div className="flex items-center gap-3 mt-4">
            <button className="btn-primary flex items-center gap-2" onClick={guardar} disabled={saving}>
              <Save className="w-4 h-4" />
              {saving ? 'Guardando…' : 'Guardar metas'}
            </button>
            <button onClick={restaurar}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <RotateCcw className="w-3.5 h-3.5" /> Cargar lista de referencia
            </button>
          </div>
        </>
      )}

      {selector && (
        <SelectorServicios grupos={gruposPresupuesto} presentes={presentes}
          onAgregar={agregarElegidos} onClose={() => setSelector(false)} />
      )}
    </div>
  )
}
