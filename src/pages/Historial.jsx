import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { formatMoney, calcRealSalary, monthName, currentMonthYear } from '../lib/utils'
import Badge from '../components/ui/Badge'
import { Calendar } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Historial() {
  const { tickets, dailySummaries, workers, incidents, monthlyCosts } = useApp()
  const { month, year } = currentMonthYear()
  const [selectedMonth, setSelectedMonth] = useState(null)

  const historial = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      let m = month - i, y = year
      if (m <= 0) { m += 12; y -= 1 }
      const prefix = `${y}-${String(m).padStart(2, '0')}`
      const isCurrent = m === month && y === year

      const mt = tickets.filter(t => t.date?.startsWith(prefix) && t.status !== 'abierto')
      const ms = dailySummaries.filter(d => d.date?.startsWith(prefix))
      const hasRealData = mt.length > 0 || ms.length > 0

      let income, cars, payroll
      if (isCurrent || hasRealData) {
        income = mt.reduce((s, t) => s + t.price_charged, 0) + ms.reduce((s, d) => s + d.total_income, 0)
        cars = mt.length
        payroll = workers.filter(w => w.active).reduce((s, w) => {
          const real = calcRealSalary(w.base_salary, w.weekly_hours)
          const disc = incidents.filter(i => i.worker_id === w.id && i.apply_discount).reduce((d, i) => d + (i.discount_amount || 0), 0)
          return s + real - disc
        }, 0)
      } else {
        income = 0
        cars = 0
        payroll = 0
      }

      const rent = monthlyCosts?.rent || 2700
      const supplies = monthlyCosts?.supplies || 800
      const utilGoal = monthlyCosts?.utility_goal || 2000
      const costs = rent + supplies + payroll
      const goal = costs + utilGoal
      const netProfit = income - costs

      // Mejor trabajador (mes actual)
      let bestWorker = null
      if (isCurrent) {
        const byWorker = {}
        tickets.filter(t => t.date?.startsWith(prefix)).forEach(t => { byWorker[t.worker_id] = (byWorker[t.worker_id] || 0) + t.price_charged })
        const bestId = Object.entries(byWorker).sort((a, b) => b[1] - a[1])[0]?.[0]
        bestWorker = workers.find(w => w.id === bestId)
      }

      months.push({ month: m, year: y, income, cars, payroll, costs, goal, netProfit, goalMet: income >= goal, bestWorker, hasRealData: isCurrent || hasRealData })
    }
    return months
  }, [tickets, dailySummaries, workers, incidents, monthlyCosts, month, year])

  // Solo graficar meses con datos reales
  const chartData = historial.filter(h => h.hasRealData).map(h => ({
    name: `${monthName(h.month).slice(0, 3)} ${h.year}`,
    ingresos: h.income, meta: h.goal, ganancia: h.netProfit,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Historial</h1>

      <div className="card">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Tendencia mensual (últimos 6 meses)</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `S/${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => formatMoney(v)} />
              <Line type="monotone" dataKey="ingresos" stroke="#dc2626" strokeWidth={2} dot={{ r: 4 }} name="Ingresos" />
              <Line type="monotone" dataKey="meta"     stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Meta" />
              <Line type="monotone" dataKey="ganancia" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Ganancia neta" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-3">
        {[...historial].reverse().map((h, i) => {
          const originalIndex = historial.length - 1 - i
          return (
            <button key={`${h.year}-${h.month}`} onClick={() => h.hasRealData && setSelectedMonth(selectedMonth === originalIndex ? null : originalIndex)}
              className={`w-full card text-left transition-all ${!h.hasRealData ? 'opacity-40 cursor-default' : selectedMonth === originalIndex ? 'ring-2 ring-red-600' : 'hover:border-red-200 dark:hover:border-red-800'}`}>
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
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 sm:grid-cols-4 gap-4" onClick={e => e.stopPropagation()}>
                  <div><p className="text-xs text-gray-500">Ingresos brutos</p><p className="font-bold text-gray-900 dark:text-white">{formatMoney(h.income)}</p></div>
                  <div><p className="text-xs text-gray-500">Gastos totales</p><p className="font-bold text-gray-900 dark:text-white">{formatMoney(h.costs)}</p></div>
                  <div><p className="text-xs text-gray-500">Planilla</p><p className="font-bold text-gray-900 dark:text-white">{formatMoney(h.payroll)}</p></div>
                  <div><p className="text-xs text-gray-500">Vehículos</p><p className="font-bold text-gray-900 dark:text-white">{h.cars}</p></div>
                  {h.bestWorker && <div className="col-span-2"><p className="text-xs text-gray-500">Mejor trabajador</p><p className="font-bold text-red-500">{h.bestWorker.name}</p></div>}
                  <div className="col-span-2"><p className="text-xs text-gray-500">Meta de ingresos</p><p className="font-bold text-gray-900 dark:text-white">{formatMoney(h.goal)}</p></div>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
