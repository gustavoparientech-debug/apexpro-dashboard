import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import {
  formatMoney, calcRealSalary, getWorkingDaysRemaining, currentMonthYear, monthName
} from '../lib/utils'
import Badge from '../components/ui/Badge'
import { TrendingUp, Zap, Shield, Star } from 'lucide-react'

function MixCard({ title, icon: Icon, color, services, neededPerDay, estimatedProfit, netGap }) {
  const colors = {
    conservador: { bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-900', text: 'text-blue-600 dark:text-blue-400', icon: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30' },
    balanceado: { bg: 'bg-green-50 dark:bg-green-900/10', border: 'border-green-200 dark:border-green-900', text: 'text-green-600 dark:text-green-400', icon: 'text-green-500 bg-green-100 dark:bg-green-900/30' },
    agresivo: { bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-200 dark:border-red-900', text: 'text-red-600 dark:text-red-400', icon: 'text-red-500 bg-red-100 dark:bg-red-900/30' },
  }
  const c = colors[color]

  return (
    <div className={`rounded-xl border-2 p-4 space-y-4 ${c.bg} ${c.border}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${c.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className={`font-bold ${c.text}`}>{title}</p>
          <p className="text-xs text-gray-500">{neededPerDay.toFixed(1)} servicios/día necesarios</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-500">Ganancia est.</p>
          <p className={`font-bold ${c.text}`}>{formatMoney(estimatedProfit)}</p>
        </div>
      </div>

      <div className="space-y-2">
        {services.map((svc, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400 flex-1">{svc.name}</span>
            <Badge variant="gray">×{svc.qty}</Badge>
            <span className="text-gray-500 text-xs">{formatMoney(svc.profit)}</span>
          </div>
        ))}
      </div>

      <div className={`border-t ${c.border} pt-3 flex justify-between items-center`}>
        <span className="text-xs text-gray-500">Cubre el gap de</span>
        <span className={`font-bold ${c.text}`}>{formatMoney(netGap)}</span>
      </div>
    </div>
  )
}

export default function Mix() {
  const { tickets, dailySummaries, workers, services, incidents, monthlyCosts } = useApp()
  const { month, year } = currentMonthYear()

  const analysis = useMemo(() => {
    const rent = monthlyCosts?.rent || 2700
    const supplies = monthlyCosts?.supplies || 800
    const utilityGoal = monthlyCosts?.utility_goal || 2000

    const payrollTotal = workers.filter(w => w.active).reduce((s, w) => {
      const realSalary = calcRealSalary(w.base_salary, w.weekly_hours)
      const discounts = incidents.filter(i => i.worker_id === w.id && i.apply_discount).reduce((d, i) => d + (i.discount_amount || 0), 0)
      return s + realSalary - discounts
    }, 0)

    const incomeGoal = rent + supplies + payrollTotal + utilityGoal
    const currentIncome = tickets.reduce((s, t) => s + t.price_charged, 0) +
      dailySummaries.reduce((s, d) => s + d.total_income, 0)

    const gap = Math.max(0, incomeGoal - currentIncome)
    const daysRemaining = getWorkingDaysRemaining(year, month)

    // Servicios activos por categoría
    const basicSvcs = services.filter(s => s.active && s.category === 'basico')
    const midSvcs = services.filter(s => s.active && (s.category === 'basico'))
    const premiumSvcs = services.filter(s => s.active && (s.category === 'ceramico' || s.category === 'polarizado' || s.category === 'ppf'))

    // Promedios de precio y ganancia
    const avgBasicPrice = basicSvcs.length ? basicSvcs.reduce((s, sv) => s + (sv.min_price + sv.max_price) / 2, 0) / basicSvcs.length : 100
    const avgBasicProfit = avgBasicPrice * 0.85
    const avgPremiumPrice = premiumSvcs.length ? premiumSvcs.slice(0, 3).reduce((s, sv) => s + (sv.min_price + sv.max_price) / 2, 0) / Math.min(3, premiumSvcs.length) : 600
    const avgPremiumProfit = avgPremiumPrice * 0.45

    // Mix conservador: mayoría básicos
    const qtyPremiumCons = Math.max(1, Math.round(daysRemaining / 5))
    const profitPremiumCons = qtyPremiumCons * avgPremiumProfit
    const remainGapCons = Math.max(0, gap - profitPremiumCons)
    const qtyBasicCons = Math.ceil(remainGapCons / avgBasicProfit)
    const profitCons = profitPremiumCons + qtyBasicCons * avgBasicProfit
    const daysCons = daysRemaining > 0 ? (qtyBasicCons + qtyPremiumCons) / daysRemaining : 0

    // Mix balanceado: equilibrado
    const qtyPremiumBal = Math.max(2, Math.round(daysRemaining / 3))
    const profitPremiumBal = qtyPremiumBal * avgPremiumProfit
    const remainGapBal = Math.max(0, gap - profitPremiumBal)
    const qtyBasicBal = Math.ceil(remainGapBal / avgBasicProfit)
    const profitBal = profitPremiumBal + qtyBasicBal * avgBasicProfit
    const daysBal = daysRemaining > 0 ? (qtyBasicBal + qtyPremiumBal) / daysRemaining : 0

    // Mix agresivo: premium
    const qtyPremiumAgg = Math.ceil(gap / avgPremiumProfit)
    const profitAgg = qtyPremiumAgg * avgPremiumProfit
    const daysAgg = daysRemaining > 0 ? qtyPremiumAgg / daysRemaining : 0

    // Mejor trabajador para premium (más tickets premium)
    const premiumServiceIds = new Set(premiumSvcs.map(s => s.id))
    const premiumByWorker = {}
    tickets.forEach(t => {
      if (premiumServiceIds.has(t.service_id)) {
        premiumByWorker[t.worker_id] = (premiumByWorker[t.worker_id] || 0) + 1
      }
    })
    const bestPremiumWorkerId = Object.entries(premiumByWorker).sort((a, b) => b[1] - a[1])[0]?.[0]
    const bestPremiumWorker = workers.find(w => w.id === bestPremiumWorkerId)

    const premiumServiceSample = premiumSvcs.slice(0, 2)

    return {
      gap, currentIncome, incomeGoal, daysRemaining,
      bestPremiumWorker,
      conservador: {
        services: [
          ...basicSvcs.slice(0, 2).map(s => ({ name: s.name, qty: Math.ceil(qtyBasicCons / Math.max(1, basicSvcs.slice(0, 2).length)), profit: Math.ceil(qtyBasicCons / Math.max(1, basicSvcs.slice(0, 2).length)) * s.min_price * 0.85 })),
          ...premiumSvcs.slice(0, 1).map(s => ({ name: s.name, qty: qtyPremiumCons, profit: qtyPremiumCons * s.min_price * 0.45 })),
        ],
        estimatedProfit: profitCons,
        neededPerDay: daysCons,
        netGap: gap,
      },
      balanceado: {
        services: [
          ...basicSvcs.slice(0, 1).map(s => ({ name: s.name, qty: qtyBasicBal, profit: qtyBasicBal * s.min_price * 0.85 })),
          ...premiumSvcs.slice(0, 2).map(s => ({ name: s.name, qty: Math.ceil(qtyPremiumBal / 2), profit: Math.ceil(qtyPremiumBal / 2) * s.min_price * 0.45 })),
        ],
        estimatedProfit: profitBal,
        neededPerDay: daysBal,
        netGap: gap,
      },
      agresivo: {
        services: premiumSvcs.slice(0, 3).map(s => ({ name: s.name, qty: Math.ceil(qtyPremiumAgg / Math.max(1, Math.min(3, premiumSvcs.length))), profit: Math.ceil(qtyPremiumAgg / Math.max(1, Math.min(3, premiumSvcs.length))) * s.min_price * 0.45 })),
        estimatedProfit: profitAgg,
        neededPerDay: daysAgg,
        netGap: gap,
      },
    }
  }, [tickets, dailySummaries, workers, services, incidents, monthlyCosts, month, year])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Propuestas de Mix</h1>
        <p className="text-sm text-gray-500">{monthName(month)} {year} — Para cerrar la meta</p>
      </div>

      {/* Resumen del gap */}
      <div className="card border-2 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
            <Target className="w-6 h-6 text-red-500" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-red-700 dark:text-red-400">Brecha para alcanzar la meta</p>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">{formatMoney(analysis.gap)}</p>
            <p className="text-xs text-red-500 mt-1">{analysis.daysRemaining} días hábiles restantes para generar {formatMoney(analysis.gap)}</p>
          </div>
          {analysis.bestPremiumWorker && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Mejor en premium</p>
              <p className="font-semibold text-gray-800 dark:text-gray-200">{analysis.bestPremiumWorker.name}</p>
            </div>
          )}
        </div>
      </div>

      {analysis.gap <= 0 ? (
        <div className="card text-center py-8 border-2 border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/10">
          <p className="text-2xl mb-2">🎉</p>
          <p className="font-bold text-green-700 dark:text-green-400 text-lg">¡Meta alcanzada!</p>
          <p className="text-sm text-green-600 dark:text-green-500">Los ingresos del mes ya superan la meta</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <MixCard
            title="Mix Conservador"
            icon={Shield}
            color="conservador"
            {...analysis.conservador}
          />
          <MixCard
            title="Mix Balanceado"
            icon={TrendingUp}
            color="balanceado"
            {...analysis.balanceado}
          />
          <MixCard
            title="Mix Agresivo Premium"
            icon={Star}
            color="agresivo"
            {...analysis.agresivo}
          />
        </div>
      )}

      <div className="card text-xs text-gray-400 space-y-1">
        <p className="font-medium text-gray-500 dark:text-gray-400 text-sm mb-2">Notas de cálculo</p>
        <p>• Los cálculos usan los precios mínimos de cada servicio como estimación conservadora.</p>
        <p>• Margen básicos/mid-tier: 85% · Margen premium (cerámico, polarizado, PPF): 45%</p>
        <p>• La ganancia estimada es neta sobre el ingreso bruto generado.</p>
        <p>• Los servicios sugeridos son orientativos — ajusta según la demanda real.</p>
      </div>
    </div>
  )
}

function Target({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="10" strokeWidth="2"/>
      <circle cx="12" cy="12" r="6" strokeWidth="2"/>
      <circle cx="12" cy="12" r="2" strokeWidth="2"/>
    </svg>
  )
}
