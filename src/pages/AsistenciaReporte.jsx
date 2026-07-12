import { useState, useEffect, useCallback, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { calcWorkMs } from './Asistencia'
import { calcHourlyRate } from '../lib/utils'
import { ChevronLeft, ChevronRight, Download, Clock, Calendar } from 'lucide-react'

const DAY_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmtHm(ms) {
  if (!ms || ms <= 0) return '-'
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
function fmtHmDecimal(ms) {
  if (!ms || ms <= 0) return 0
  return Math.round(ms / 3600000 * 10) / 10
}

// Semana: lunes → domingo
function getWeekDates(refDate) {
  const d = new Date(refDate)
  const day = d.getDay() // 0=dom
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    return dd.toISOString().slice(0, 10)
  })
}

export default function AsistenciaReporte() {
  const { workers } = useApp()
  const [weekRef, setWeekRef]   = useState(new Date())
  const [logs, setLogs]         = useState([])
  const [loading, setLoading]   = useState(false)
  const [expanded, setExpanded] = useState({}) // workerId → bool
  const [popover, setPopover]   = useState(null) // { workerId, date, rect }
  const tableRef = useRef(null)

  const weekDates = getWeekDates(weekRef)
  const weekStart = weekDates[0]
  const weekEnd   = weekDates[6]

  const loadLogs = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('attendance_logs')
      .select('*').gte('date', weekStart).lte('date', weekEnd)
      .order('logged_at', { ascending: true })
    setLogs(data || [])
    setLoading(false)
  }, [weekStart, weekEnd])

  useEffect(() => { loadLogs() }, [loadLogs])

  function prevWeek() { const d = new Date(weekRef); d.setDate(d.getDate() - 7); setWeekRef(d) }
  function nextWeek() { const d = new Date(weekRef); d.setDate(d.getDate() + 7); setWeekRef(d) }

  // Calcula ms trabajados de un worker en una fecha específica
  function getDayMs(workerId, date) {
    const dayLogs = logs.filter(l => l.worker_id === workerId && l.date === date)
    const e  = dayLogs.find(l => l.type === 'entrada')
    const ai = dayLogs.find(l => l.type === 'almuerzo_inicio')
    const af = dayLogs.find(l => l.type === 'almuerzo_fin')
    const s  = dayLogs.find(l => l.type === 'salida')
    // Solo contar si hay salida; si es hoy y está en curso, calcular hasta ahora
    const today = new Date().toLocaleDateString('en-CA')
    if (!e) return 0
    if (!s && date !== today) return 0  // día pasado sin salida → no contar
    if (!s && date === today) return calcWorkMs(e, ai, af, null, new Date())
    return calcWorkMs(e, ai, af, s)
  }

  function getDayLogs(workerId, date) {
    return logs.filter(l => l.worker_id === workerId && l.date === date)
      .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
  }

  const activeWorkers = workers.filter(w => w.active)

  // Totales por worker
  const workerTotals = activeWorkers.map(w => {
    const hourlyRate = calcHourlyRate(w.base_salary, w.weekly_hours) || 0
    const days = weekDates.map(d => ({ date: d, ms: getDayMs(w.id, d) }))
    const totalMs = days.reduce((s, d) => s + d.ms, 0)
    const totalCost = (totalMs / 3600000) * hourlyRate
    return { ...w, days, totalMs, totalCost, hourlyRate }
  })

  // Formato del período
  const d0 = new Date(weekStart + 'T12:00:00')
  const d1 = new Date(weekEnd   + 'T12:00:00')
  const periodLabel = `${d0.getDate()} ${MONTHS_ES[d0.getMonth()].slice(0,3)} – ${d1.getDate()} ${MONTHS_ES[d1.getMonth()].slice(0,3)} ${d1.getFullYear()}`

  // Popover data
  const popData = popover ? (() => {
    const dayLogs = getDayLogs(popover.workerId, popover.date)
    const e  = dayLogs.find(l => l.type === 'entrada')
    const ai = dayLogs.find(l => l.type === 'almuerzo_inicio')
    const af = dayLogs.find(l => l.type === 'almuerzo_fin')
    const s  = dayLogs.find(l => l.type === 'salida')
    const fmt = t => new Date(t).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    return { e, ai, af, s, fmt, ms: getDayMs(popover.workerId, popover.date) }
  })() : null

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4" onClick={() => setPopover(null)}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-red-500" /> Reporte de horas
          </h2>
          <p className="text-sm text-gray-500">Horas trabajadas por semana</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
            <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[160px] text-center">{periodLabel}</span>
          <button onClick={nextWeek} className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
            <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 w-36">Trabajador</th>
              {weekDates.map((date, i) => {
                const d = new Date(date + 'T12:00:00')
                const isToday = date === new Date().toISOString().slice(0, 10)
                return (
                  <th key={date} className={`px-1 py-3 text-center font-semibold w-20 ${isToday ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                    <div className="text-xs">{DAY_SHORT[d.getDay()]}</div>
                    <div className={`text-sm ${isToday ? 'font-bold' : ''}`}>{d.getDate()}</div>
                  </th>
                )
              })}
              <th className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-300">Total</th>
              <th className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-300">Costo</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">Cargando...</td></tr>
            )}
            {!loading && workerTotals.map(w => (
              <>
                <tr key={w.id} className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30"
                    onClick={() => setExpanded(e => ({ ...e, [w.id]: !e[w.id] }))}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 font-bold text-xs shrink-0">{w.name[0]}</div>
                      <span className="font-medium text-gray-900 dark:text-white text-xs leading-tight">{w.name}</span>
                    </div>
                  </td>
                  {w.days.map(({ date, ms }) => (
                    <td key={date} className="px-1 py-3 text-center relative">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          if (ms <= 0) return
                          const rect = e.currentTarget.getBoundingClientRect()
                          setPopover(p => (p?.workerId === w.id && p?.date === date) ? null : { workerId: w.id, date, rect })
                        }}
                        className={`text-xs font-medium px-1 py-0.5 rounded transition-colors whitespace-nowrap ${ms > 0 ? 'text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 cursor-pointer' : 'text-gray-300 dark:text-gray-600 cursor-default'}`}>
                        {ms > 0 ? fmtHm(ms) : '—'}
                      </button>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold text-sm ${w.totalMs > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-gray-600'}`}>
                      {fmtHm(w.totalMs)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold text-sm ${w.totalCost > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-300 dark:text-gray-600'}`}>
                      {w.totalCost > 0 ? `S/ ${w.totalCost.toFixed(2)}` : '—'}
                    </span>
                  </td>
                </tr>
                {/* Detalle expandido */}
                {expanded[w.id] && weekDates.map(date => {
                  const dayLogs = getDayLogs(w.id, date)
                  if (dayLogs.length === 0) return null
                  const d = new Date(date + 'T12:00:00')
                  return (
                    <tr key={`detail-${w.id}-${date}`} className="bg-gray-50 dark:bg-gray-800/20">
                      <td colSpan={9} className="px-6 py-2">
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="text-xs font-semibold text-gray-500">{DAY_SHORT[d.getDay()]} {d.getDate()}</span>
                          {dayLogs.map(log => (
                            <span key={log.id} className="text-xs text-gray-600 dark:text-gray-400">
                              <span className={{
                                entrada: 'text-green-600', almuerzo_inicio: 'text-orange-500',
                                almuerzo_fin: 'text-blue-500', salida: 'text-red-500'
                              }[log.type] || ''}>
                                {{'entrada':'Entrada','almuerzo_inicio':'Almuerzo ↓','almuerzo_fin':'Almuerzo ↑','salida':'Salida'}[log.type]}
                              </span>
                              {' '}{new Date(log.logged_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}
                            </span>
                          ))}
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 ml-auto">
                            {fmtHm(getDayMs(w.id, date))}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </>
            ))}
          </tbody>
          {/* Footer totals */}
          {!loading && (
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
                <td className="px-4 py-3 font-bold text-xs text-gray-600 dark:text-gray-400">TOTAL</td>
                {weekDates.map(date => {
                  const dayTotal = activeWorkers.reduce((s, w) => s + getDayMs(w.id, date), 0)
                  const dayCost  = workerTotals.reduce((s, w) => {
                    const ms = w.days.find(d => d.date === date)?.ms || 0
                    return s + (ms / 3600000) * w.hourlyRate
                  }, 0)
                  return (
                    <td key={date} className="px-1 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-400">
                      {dayTotal > 0 ? (
                        <>
                          <div className="whitespace-nowrap">{fmtHm(dayTotal)}</div>
                          <div className="text-green-600 dark:text-green-400 whitespace-nowrap mt-0.5">S/{dayCost.toFixed(0)}</div>
                        </>
                      ) : '—'}
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-center font-bold text-red-600">
                  {fmtHm(workerTotals.reduce((s, w) => s + w.totalMs, 0))}
                </td>
                <td className="px-4 py-3 text-center font-bold text-green-600 dark:text-green-400">
                  S/ {workerTotals.reduce((s, w) => s + w.totalCost, 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Popover flotante */}
      {popover && popData && (() => {
        const { e, ai, af, s, fmt, ms } = popData
        const top  = popover.rect.bottom + window.scrollY + 8
        const left = Math.min(popover.rect.left + window.scrollX - 20, window.innerWidth - 230)
        return (
          <div
            onClick={ev => ev.stopPropagation()}
            style={{ position: 'fixed', top: popover.rect.bottom + 8, left: Math.max(8, Math.min(popover.rect.left - 20, window.innerWidth - 230)), zIndex: 50 }}
            className="bg-gray-800 dark:bg-gray-900 text-white rounded-2xl shadow-2xl p-4 w-52 text-xs space-y-2">
            {e  && <div className="flex justify-between"><span className="text-gray-400">Llegada</span><span className="font-semibold text-green-400">{fmt(e.logged_at)}</span></div>}
            {ai && <div className="flex justify-between"><span className="text-gray-400">Almuerzo ↓</span><span className="font-semibold text-orange-400">{fmt(ai.logged_at)}</span></div>}
            {af && <div className="flex justify-between"><span className="text-gray-400">Almuerzo ↑</span><span className="font-semibold text-blue-400">{fmt(af.logged_at)}</span></div>}
            {s  && <div className="flex justify-between"><span className="text-gray-400">Salida</span><span className="font-semibold text-red-400">{fmt(s.logged_at)}</span></div>}
            <div className="border-t border-white/10 pt-2 flex justify-between">
              <span className="text-gray-400">Total</span>
              <span className="font-bold text-white">{fmtHm(ms)}</span>
            </div>
          </div>
        )
      })()}

      {/* Resumen tarjetas */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {workerTotals.filter(w => w.totalMs > 0).map(w => (
            <div key={w.id} className="card py-3 px-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 font-bold text-xs">{w.name[0]}</div>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{w.name}</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{fmtHm(w.totalMs)}</p>
              <p className="text-xs text-gray-400">{fmtHmDecimal(w.totalMs)}h · {w.days.filter(d => d.ms > 0).length} días</p>
              {w.totalCost > 0 && <p className="text-sm font-semibold text-green-600 dark:text-green-400 mt-1">S/ {w.totalCost.toFixed(2)}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
