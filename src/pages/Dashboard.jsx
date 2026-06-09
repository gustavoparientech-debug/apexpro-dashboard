import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import {
  formatMoney, formatDate, getSemaforoColor, calcRealSalary, calcTicketProfit,
  getWorkingDaysInMonth, getWorkingDaysElapsed, getWorkingDaysRemaining,
  currentMonthYear, monthName
} from '../lib/utils'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import {
  TrendingUp, Car, DollarSign, AlertTriangle, CheckCircle, Clock,
  CreditCard, Smartphone, Calendar, Target, Users, Award
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line
} from 'recharts'

function ProgressBar({ percent, color }) {
  const bg = { verde: 'bg-green-500', amarillo: 'bg-yellow-500', rojo: 'bg-red-500' }
  const border = { verde: 'border-green-200 dark:border-green-900', amarillo: 'border-yellow-200 dark:border-yellow-900', rojo: 'border-red-200 dark:border-red-900' }
  return (
    <div className={`w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden border ${border[color]}`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ${bg[color]}`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  )
}

export default function Dashboard() {
  const { tickets, dailySummaries, workers, services, incidents, monthlyCosts, loading } = useApp()
  const { month, year } = currentMonthYear()

  const data = useMemo(() => {
    const workingDaysTotal = getWorkingDaysInMonth(year, month)
    const workingDaysElapsed = getWorkingDaysElapsed(year, month)
    const workingDaysRemaining = getWorkingDaysRemaining(year, month)

    // Ingresos de tickets
    const ticketIncome = tickets.reduce((s, t) => s + (t.price_charged || 0), 0)
    // Ingresos de registros rápidos
    const summaryIncome = dailySummaries.reduce((s, d) => s + (d.total_income || 0), 0)
    const totalIncome = ticketIncome + summaryIncome

    // Ganancia neta (por tickets con margen)
    const netProfit = tickets.reduce((s, t) => {
      const svc = services.find(sv => sv.id === t.service_id)
      if (!svc) return s + t.price_charged * 0.65 // estimado si no hay servicio
      return s + calcTicketProfit(t.price_charged, svc.margin_percent)
    }, 0)

    // Costos fijos
    const rent = monthlyCosts?.rent || 2700
    const supplies = monthlyCosts?.supplies || 800
    const utilityGoal = monthlyCosts?.utility_goal || 2000

    // Planilla real (con descuentos)
    const payrollTotal = workers
      .filter(w => w.active)
      .reduce((s, w) => {
        const realSalary = calcRealSalary(w.base_salary, w.weekly_hours)
        const workerDiscounts = incidents
          .filter(i => i.worker_id === w.id && i.apply_discount)
          .reduce((d, i) => d + (i.discount_amount || 0), 0)
        return s + realSalary - workerDiscounts
      }, 0)

    const totalCosts = rent + supplies + payrollTotal
    const incomeGoal = totalCosts + utilityGoal
    const progressPct = incomeGoal > 0 ? (totalIncome / incomeGoal) * 100 : 0
    const semaforo = getSemaforoColor(progressPct)

    // Promedio diario
    const avgDailyActual = workingDaysElapsed > 0 ? totalIncome / workingDaysElapsed : 0
    const avgDailyNeeded = workingDaysRemaining > 0
      ? (incomeGoal - totalIncome) / workingDaysRemaining
      : 0

    // Vehículos
    const totalCars = tickets.length

    // Mejor día
    const byDate = {}
    tickets.forEach(t => {
      byDate[t.date] = (byDate[t.date] || 0) + t.price_charged
    })
    dailySummaries.forEach(d => {
      byDate[d.date] = (byDate[d.date] || 0) + d.total_income
    })
    const bestDay = Object.entries(byDate).sort((a, b) => b[1] - a[1])[0]

    // Por método de cobro
    const efectivo = tickets.filter(t => t.payment_method === 'efectivo').reduce((s, t) => s + t.price_charged, 0)
    const yape = tickets.filter(t => t.payment_method === 'yape').reduce((s, t) => s + t.price_charged, 0)

    // Alerta de ritmo
    const projectedIncome = workingDaysTotal > 0 ? (totalIncome / workingDaysElapsed) * workingDaysTotal : 0
    const onTrack = projectedIncome >= incomeGoal

    // Ingresos por día (últimos 10 días con actividad)
    const dailyData = Object.entries(byDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-10)
      .map(([date, amount]) => ({ date: formatDate(date), amount }))

    return {
      totalIncome, netProfit, totalCosts, payrollTotal,
      rent, supplies, utilityGoal, incomeGoal,
      progressPct, semaforo, totalCars,
      avgDailyActual, avgDailyNeeded,
      workingDaysElapsed, workingDaysRemaining, workingDaysTotal,
      bestDay, efectivo, yape, onTrack, projectedIncome, dailyData
    }
  }, [tickets, dailySummaries, workers, services, incidents, monthlyCosts, month, year])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    )
  }

  const semaforoClass = {
    verde: 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/10',
    amarillo: 'border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-900/10',
    rojo: 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10',
  }
  const semaforoText = {
    verde: 'text-green-700 dark:text-green-400',
    amarillo: 'text-yellow-700 dark:text-yellow-400',
    rojo: 'text-red-700 dark:text-red-400',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Panel Principal</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{monthName(month)} {year}</p>
        </div>
        <Badge variant={data.semaforo}>
          {data.semaforo === 'verde' ? '✓ En meta' : data.semaforo === 'amarillo' ? '⚠ En progreso' : '✗ Por debajo'}
        </Badge>
      </div>

      {/* Alerta de ritmo */}
      {!data.onTrack && data.workingDaysElapsed > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700 dark:text-red-400 text-sm">Ritmo insuficiente para alcanzar la meta</p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
              Al ritmo actual se proyectan {formatMoney(data.projectedIncome)} — meta: {formatMoney(data.incomeGoal)}
            </p>
          </div>
        </div>
      )}

      {/* Stats principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Ingresos del mes"
          value={formatMoney(data.totalIncome)}
          sub={`${data.totalCars} vehículos atendidos`}
          icon={DollarSign}
          color="orange"
        />
        <StatCard
          label="Ganancia neta est."
          value={formatMoney(data.netProfit)}
          sub={`${data.totalIncome > 0 ? ((data.netProfit / data.totalIncome) * 100).toFixed(0) : 0}% del ingreso bruto`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          label="Total gastos fijos"
          value={formatMoney(data.totalCosts)}
          sub={`Planilla: ${formatMoney(data.payrollTotal)}`}
          icon={CreditCard}
          color="blue"
        />
        <StatCard
          label="Vehículos"
          value={data.totalCars}
          sub={`Promedio: ${formatMoney(data.totalCars ? data.totalIncome / data.totalCars : 0)}/carro`}
          icon={Car}
          color="purple"
        />
      </div>

      {/* Barra de progreso hacia la meta */}
      <div className={`card border-2 ${semaforoClass[data.semaforo]}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Progreso hacia la meta mensual</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Meta: {formatMoney(data.incomeGoal)}</p>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${semaforoText[data.semaforo]}`}>{data.progressPct.toFixed(1)}%</p>
            <p className="text-xs text-gray-500">{formatMoney(data.totalIncome)} / {formatMoney(data.incomeGoal)}</p>
          </div>
        </div>
        <ProgressBar percent={data.progressPct} color={data.semaforo} />
        <div className="flex items-center gap-2 mt-2">
          <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
          <p className="text-xs text-gray-400">Faltan {formatMoney(Math.max(0, data.incomeGoal - data.totalIncome))}</p>
        </div>
      </div>

      {/* Promedios y días */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-orange-500" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Promedios diarios</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Promedio actual/día</span>
              <span className="font-semibold text-gray-900 dark:text-white text-sm">{formatMoney(data.avgDailyActual)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Necesario para cerrar</span>
              <span className={`font-semibold text-sm ${data.avgDailyNeeded > data.avgDailyActual ? 'text-red-500' : 'text-green-500'}`}>
                {formatMoney(data.avgDailyNeeded)}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Días hábiles</p>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Trabajados</span>
              <span className="font-semibold text-gray-900 dark:text-white text-sm">{data.workingDaysElapsed} de {data.workingDaysTotal}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Restantes</span>
              <span className="font-semibold text-orange-500 text-sm">{data.workingDaysRemaining} días</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-yellow-500" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Mejor día del mes</p>
          </div>
          {data.bestDay ? (
            <div className="space-y-1">
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatMoney(data.bestDay[1])}</p>
              <p className="text-xs text-gray-500">{formatDate(data.bestDay[0])}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin registros aún</p>
          )}
        </div>
      </div>

      {/* Métodos de cobro */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card flex items-center gap-4">
          <div className="rounded-xl p-3 bg-green-50 dark:bg-green-900/20">
            <DollarSign className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Efectivo</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatMoney(data.efectivo)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="rounded-xl p-3 bg-purple-50 dark:bg-purple-900/20">
            <Smartphone className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Yape</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{formatMoney(data.yape)}</p>
          </div>
        </div>
      </div>

      {/* Composición de costos */}
      <div className="card">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Composición de gastos fijos</p>
        <div className="space-y-3">
          {[
            { label: 'Planilla (real)', value: data.payrollTotal, color: 'bg-orange-400' },
            { label: 'Alquiler', value: data.rent, color: 'bg-blue-400' },
            { label: 'Insumos', value: data.supplies, color: 'bg-green-400' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${item.color}`} />
              <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">{item.label}</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatMoney(item.value)}</span>
              <span className="text-xs text-gray-400 w-12 text-right">
                {data.totalCosts > 0 ? ((item.value / data.totalCosts) * 100).toFixed(0) : 0}%
              </span>
            </div>
          ))}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total + meta utilidad</span>
            <span className="text-sm font-bold text-orange-500">{formatMoney(data.incomeGoal)}</span>
          </div>
        </div>
      </div>

      {/* Gráfico de ingresos diarios */}
      {data.dailyData.length > 0 && (
        <div className="card">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Ingresos por día</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dailyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `S/${(v/1000).toFixed(1)}k`} />
                <Tooltip formatter={v => formatMoney(v)} labelFormatter={l => `Fecha: ${l}`} />
                <Bar dataKey="amount" fill="#f97316" radius={[4, 4, 0, 0]} name="Ingresos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
