import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { formatMoney, calcRealSalary, monthName, currentMonthYear } from '../lib/utils'
import Badge from '../components/ui/Badge'
import { Calendar } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

export default function Historial() {
  const { tickets, dailySummaries, workers, incidents, monthlyCosts } = useApp()
  const { month, year } = currentMonthYear()
  const [selectedMonth, setSelectedMonth] = useState(null)
  // summaries de meses pasados cargadas directamente desde Supabase
  const [pastSummaries, setPastSummaries] = useState([])
  const [pastTickets,   setPastTickets]   = useState([])
  const [loadingPast,   setLoadingPast]   = useState(false)

  // Calcular rango de meses pasados (los 5 anteriores al actual)
  const pastMonths = useMemo(() => {
    const months = []
    for (let i = 5; i >= 1; i--) {
      let m = month - i, y = year
      if (m <= 0) { m += 12; y -= 1 }
      months.push({ m, y })
    }
    return months
  }, [month, year])

  // Cargar datos de meses pasados desde Supabase
  useEffect(() => {
    if (IS_DEMO || !pastMonths.length) return
    setLoadingPast(true)
    const earliest = pastMonths[0]
    const latest   = pastMonths[pastMonths.length - 1]
    const startDate = `${earliest.y}-${String(earliest.m).padStart(2,'0')}-01`
    const endDate   = `${latest.y}-${String(latest.m).padStart(2,'0')}-31`

    Promise.all([
      supabase.from('daily_summary').select('*').gte('date', startDate).lte('date', endDate),
      supabase.from('tickets').select('*').gte('date', startDate).lte('date', endDate).eq('status', 'cerrado'),
    ]).then(([summRes, tickRes]) => {
      setPastSummaries(summRes.data || [])
      setPastTickets(tickRes.data || [])
    }).finally(() => setLoadingPast(false))
  }, [pastMonths])

  const historial = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      let m = month - i, y = year
      if (m <= 0) { m += 12; y -= 1 }
      const prefix = `${y}-${String(m).padStart(2, '0')}`
      const isCurrent = m === month && y === year

      // Para mes actual: usar datos del contexto global
      // Para meses pasados: usar datos cargados directamente de Supabase
      const mt = isCurrent
        ? tickets.filter(t => t.date?.startsWith(prefix) && t.status !== 'abierto')
        : pastTickets.filter(t => t.date?.startsWith(prefix))
      const ms = isCurrent
        ? dailySummaries.filter(d => d.date?.startsWith(prefix))
        : pastSummaries.filter(d => d.date?.startsWith(prefix))

      const hasRealData = mt.length > 0 || ms.length > 0

      let income = 0, cars = 0, payroll = 0
      if (isCurrent || hasRealData) {
        income  = mt.reduce((s, t) => s + (t.price_charged || 0), 0) + ms.reduce((s, d) => s + (d.total_income || 0), 0)
        cars    = mt.length
        payroll = workers.filter(w => w.active).reduce((s, w) => {
          const real = calcRealSalary(w.base_salary, w.weekly_hours)
          const disc = incidents.filter(inc => inc.worker_id === w.id && inc.apply_discount)
            .reduce((d, inc) => d + (inc.discount_amount || 0), 0)
          return s + real - disc
        }, 0)
      }

      const rent      = monthlyCosts?.rent || 2700
      const supplies  = monthlyCosts?.supplies || 800
      const utilGoal  = monthlyCosts?.utility_goal || 2000
      const costs     = rent + supplies + payroll
      const goal      = costs + utilGoal
      const netProfit = income - costs

      let bestWorker = null
      if (hasRealData) {
        const byWorker = {}
        mt.forEach(t => { byWorker[t.worker_id] = (byWorker[t.worker_id] || 0) + (t.price_charged || 0) })
        const bestId = Object.entries(byWorker).sort((a, b) => b[1] - a[1])[0]?.[0]
        bestWorker = workers.find(w => w.id === bestId)
      }

      months.push({ month: m, year: y, income, cars, payroll, costs, goal, netProfit,
        goalMet: income >= goal, bestWorker, hasRealData: isCurrent || hasRealData })
    }
    return months
  }, [tickets, dailySummaries, pastTickets, pastSummaries, workers, incidents, monthlyCosts, month, year])

  const chartData = historial.filter(h => h.hasRealData).map(h => ({
    name: monthName(h.month).slice(0, 3),
    ingresos: h.income,
    meta: h.goal,
    metMeta: h.income >= h.goal,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Historial</h1>
        {loadingPast && <span className="text-xs text-gray-400 animate-pulse">Cargando meses anteriores…</span>}
      </div>

      {chartData.length >= 2 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ingresos por mes</p>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Ingresos</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-gray-400 inline-block rounded" style={{borderTop:'2px dashed #9ca3af',height:0}} /> Meta</span>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `S/${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} domain={[0, 'dataMax + 500']} />
                <Tooltip
                  formatter={(v, name) => [formatMoney(v), name === 'ingresos' ? 'Ingresos' : 'Meta']}
                  contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
                />
                <ReferenceLine
                  y={chartData[chartData.length - 1]?.meta}
                  stroke="#94a3b8" strokeDasharray="6 4" strokeWidth={1.5}
                  label={{ value: `Meta S/${Math.round((chartData[chartData.length-1]?.meta||0)/1000)}k`, position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }}
                />
                <Bar dataKey="ingresos" radius={[6, 6, 0, 0]} name="ingresos">
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.metMeta ? '#22c55e' : '#dc2626'} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">Verde = meta alcanzada · Rojo = meta no alcanzada</p>
        </div>
      )}

      <div className="space-y-3">
        {[...historial].reverse().map((h, i) => {
          const originalIndex = historial.length - 1 - i
          return (
            <button key={`${h.year}-${h.month}`}
              onClick={() => h.hasRealData && setSelectedMonth(selectedMonth === originalIndex ? null : originalIndex)}
              className={`w-full card text-left transition-all ${
                !h.hasRealData ? 'opacity-40 cursor-default'
                : selectedMonth === originalIndex ? 'ring-2 ring-red-600'
                : 'hover:border-red-200 dark:hover:border-red-800'
              }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{monthName(h.month)} {h.year}</p>
                    {h.hasRealData
                      ? <p className="text-xs text-gray-500">{h.cars} vehículos · {formatMoney(h.income)}</p>
                      : <p className="text-xs text-gray-400 italic">Sin datos registrados</p>
                    }
                  </div>
                </div>
                {h.hasRealData && (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${h.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                        {h.netProfit >= 0 ? '+' : ''}{formatMoney(h.netProfit)}
                      </p>
                      <p className="text-xs text-gray-400">utilidad</p>
                    </div>
                    <Badge variant={h.goalMet ? 'verde' : 'rojo'}>{h.goalMet ? '✓ Meta' : '✗ Meta'}</Badge>
                  </div>
                )}
              </div>
              {h.hasRealData && selectedMonth === originalIndex && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 sm:grid-cols-4 gap-4"
                  onClick={e => e.stopPropagation()}>
                  <div><p className="text-xs text-gray-500">Ingresos brutos</p><p className="font-bold text-gray-900 dark:text-white">{formatMoney(h.income)}</p></div>
                  <div><p className="text-xs text-gray-500">Gastos totales</p><p className="font-bold text-gray-900 dark:text-white">{formatMoney(h.costs)}</p></div>
                  <div><p className="text-xs text-gray-500">Planilla</p><p className="font-bold text-gray-900 dark:text-white">{formatMoney(h.payroll)}</p></div>
                  <div><p className="text-xs text-gray-500">Vehículos</p><p className="font-bold text-gray-900 dark:text-white">{h.cars}</p></div>
                  {h.bestWorker && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Mejor trabajador</p>
                      <p className="font-bold text-red-500">{h.bestWorker.name}</p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500">Meta de ingresos</p>
                    <p className="font-bold text-gray-900 dark:text-white">{formatMoney(h.goal)}</p>
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
