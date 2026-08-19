import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import {
  GRUPOS, DEFAULT_ITEMS, DEFAULT_BAYS, monthPrefix, resolveItems, computeProgress,
  computeEconomics, fetchMetasConfig, saveMetasConfig, fetchMetasRows, rowsFromTickets,
} from '../../lib/metas'
import { monthName, todayISO, formatMoney, getWorkingDaysInMonth } from '../../lib/utils'
import { Plus, Save, Trash2, ChevronUp, ChevronDown, SlidersHorizontal, ExternalLink, RotateCcw, Calculator } from 'lucide-react'
import toast from 'react-hot-toast'

const FUENTES = [
  { value: 'vehiculo', label: 'Por tipo de vehículo', hint: 'Cuenta los tickets del mes cuyo vehículo sea uno de los marcados.' },
  { value: 'palabras', label: 'Por palabras del adicional', hint: 'Cuenta los adicionales del ticket que contengan alguna de estas palabras. Sin tildes ni mayúsculas.' },
  { value: 'manual',   label: 'Solo manual', hint: 'No se cuenta solo: el avance se escribe a mano en la columna “Manual”.' },
]

function nuevoId() {
  return 'meta_' + Date.now().toString(36)
}

export default function MetasConfig({ year, month, costoFijo = 0 }) {
  const { vehicleTypes, tickets, isDemo } = useApp()
  const prefix = monthPrefix(year, month)

  const [config, setConfig]   = useState(null)
  const [items, setItems]     = useState([])
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [abierto, setAbierto] = useState(null) // id del ítem con opciones avanzadas abiertas
  const [bays, setBays]       = useState(DEFAULT_BAYS)

  const cargarAvance = useCallback(async () => {
    if (isDemo) { setRows(rowsFromTickets(tickets, prefix)); return }
    try { setRows(await fetchMetasRows(prefix)) }
    catch { setRows(rowsFromTickets(tickets, prefix)) }
  }, [prefix, isDemo, tickets])

  // La config se recarga solo al cambiar de mes: recargarla por otro motivo
  // borraría lo que el admin esté editando sin haber guardado.
  useEffect(() => {
    let vivo = true
    setLoading(true)
    fetchMetasConfig()
      .then(cfg => {
        if (!vivo) return
        setConfig(cfg)
        setItems(resolveItems(cfg, prefix))
        setBays(Number(cfg?.bays ?? DEFAULT_BAYS))
      })
      .finally(() => { if (vivo) setLoading(false) })
    return () => { vivo = false }
  }, [prefix])

  // El avance sí se refresca cuando entran tickets nuevos.
  useEffect(() => { cargarAvance() }, [prefix, tickets.length])

  const progreso = useMemo(() => computeProgress(items, rows, todayISO()), [items, rows])

  function update(id, patch) {
    setItems(list => list.map(i => i.id === id ? { ...i, ...patch } : i))
  }
  function mover(idx, dir) {
    const destino = idx + dir
    if (destino < 0 || destino >= items.length) return
    setItems(list => {
      const copia = [...list]
      const [x] = copia.splice(idx, 1)
      copia.splice(destino, 0, x)
      return copia
    })
  }
  function agregar() {
    setItems(list => [...list, {
      id: nuevoId(), emoji: '🎯', label: '', goal: 0, manual: 0,
      group: 'detailing', source: 'manual', vehicles: [], keywords: [],
      price: 0, margin: 0, bayDays: 0,
    }])
  }
  function eliminar(id) {
    setItems(list => list.filter(i => i.id !== id))
    if (abierto === id) setAbierto(null)
  }
  function restaurar() {
    setItems(DEFAULT_ITEMS.map(i => ({ ...i, manual: 0 })))
    toast('Lista de referencia cargada — recuerda guardar', { icon: '↩️' })
  }

  async function guardar() {
    if (items.some(i => !i.label.trim())) { toast.error('Todos los servicios necesitan nombre'); return }
    setSaving(true)
    try {
      const definiciones = items.map(({ id, emoji, label, group, source, vehicles, keywords, goal, price, margin, bayDays }) => ({
        id, emoji, label: label.trim(), group, source,
        vehicles: vehicles || [], keywords: keywords || [],
        goal: Number(goal) || 0, // sirve de respaldo si el mes no tiene número propio
        // La economía no cambia mes a mes: viaja con la definición del servicio.
        price: Number(price) || 0, margin: Number(margin) || 0, bayDays: Number(bayDays) || 0,
      }))
      const goalsMes  = Object.fromEntries(items.map(i => [i.id, Number(i.goal) || 0]))
      const manualMes = Object.fromEntries(items.map(i => [i.id, Number(i.manual) || 0]))
      const nuevo = {
        ...(config || {}),
        bays:   Number(bays) || 0,
        items:  definiciones,
        goals:  { ...(config?.goals  || {}), [prefix]: goalsMes },
        manual: { ...(config?.manual || {}), [prefix]: manualMes },
      }
      await saveMetasConfig(nuevo)
      setConfig(nuevo)
      toast.success(`Metas de ${monthName(month)} ${year} guardadas ✓`)
    } catch (err) {
      toast.error('Error al guardar: ' + (err.message || ''))
    } finally { setSaving(false) }
  }

  const totalMeta  = items.reduce((s, i) => s + (Number(i.goal) || 0), 0)
  const totalHecho = progreso.reduce((s, i) => s + Math.min(i.done, i.goal), 0)
  const totalPct   = totalMeta > 0 ? Math.round((totalHecho / totalMeta) * 100) : 0
  const diasHabiles = getWorkingDaysInMonth(year, month)
  const econ = computeEconomics(progreso, { costoFijo, diasHabiles, bays })
  const activos    = (vehicleTypes || []).filter(v => v.active !== false)

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Metas de servicios — {monthName(month)} {year}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Los trabajadores ven estos números y su avance en la página <strong>Metas</strong>.
          </p>
        </div>
        <Link to="/metas" className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline">
          Ver página <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400 py-6 text-center">Cargando metas…</p>
      ) : (
        <>
          {/* Resumen */}
          <div className="flex items-center justify-between gap-3 p-3 my-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
            <div className="text-sm">
              <span className="text-gray-500">Avance del mes: </span>
              <span className="font-bold text-gray-800 dark:text-gray-100">{totalHecho} de {totalMeta}</span>
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
                  onChange={e => setBays(e.target.value === '' ? 0 : Number(e.target.value))}
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
                    {item.goal > 0 && (Number(item.price) || Number(item.margin))
                      ? <>Genera <strong className="text-gray-600 dark:text-gray-300">{formatMoney((Number(item.goal) || 0) * (Number(item.price) || 0))}</strong>
                          {' '}· margen {formatMoney((Number(item.goal) || 0) * (Number(item.margin) || 0))}</>
                      : 'Sin precio cargado — no suma al plan'}
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

                      {/* Economía del servicio: lo que hace que el plan tenga monto */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="label text-xs">Precio unitario</label>
                          <input type="number" min="0" step="1" className="input text-sm py-1.5"
                            value={item.price ?? 0}
                            onChange={e => update(item.id, { price: e.target.value === '' ? 0 : Number(e.target.value) })} />
                        </div>
                        <div>
                          <label className="label text-xs">Margen unitario</label>
                          <input type="number" min="0" step="1" className="input text-sm py-1.5"
                            value={item.margin ?? 0}
                            onChange={e => update(item.id, { margin: e.target.value === '' ? 0 : Number(e.target.value) })} />
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
                      </p>

                      {item.source === 'vehiculo' && (
                        <div className="flex flex-wrap gap-1.5">
                          {activos.map(v => {
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
                      )}

                      {item.source === 'palabras' && (
                        <div>
                          <label className="label text-xs">Palabras clave (separadas por coma)</label>
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

          <button onClick={agregar}
            className="w-full flex items-center justify-center gap-2 py-2.5 mt-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-400 hover:text-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
            <Plus className="w-4 h-4" /> Agregar servicio
          </button>

          <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
            <strong>Meta</strong> es lo que hay que hacer este mes. <strong>Manual</strong> suma trabajos que no
            quedan registrados en un ticket (planchado, trabajos con el pintor). <strong>Avance</strong> es lo que
            ya lleva el equipo. Los meses siguientes heredan estos números hasta que los cambies.
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
    </div>
  )
}
