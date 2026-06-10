import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  formatMoney, calcRealSalary, getWorkingDaysRemaining,
  getWorkingDaysElapsed, getWorkingDaysInMonth, currentMonthYear, monthName
} from '../lib/utils'
import {
  Droplets, Truck, Sparkles, Star, Shield, TrendingUp,
  ChevronDown, ChevronUp, Car, Layers
} from 'lucide-react'

// ─── Datos reales del negocio ────────────────────────────────────────────────
// Volumen típico mensual y precios reales
const TYPICAL = {
  autos:        { qty: 25, price: 70,   label: 'Lavado auto',       icon: Car,       color: 'blue'   },
  suvs:         { qty: 30, price: 95,   label: 'Lavado SUV',        icon: Car,       color: 'blue'   },
  offroads:     { qty: 35, price: 55,   label: 'Offroad / Pickup',  icon: Truck,     color: 'orange' },
  detallados:   { qty: 5,  price: 350,  label: 'Detallado',         icon: Sparkles,  color: 'purple' },
  ceramicos:    { qty: 2,  price: 600,  label: 'Cerámico',          icon: Shield,    color: 'red'    },
  abrillantados:{ qty: 4,  price: 130,  label: 'Abrillantado',      icon: Star,      color: 'yellow' },
  polarizados:  { qty: 1,  price: 450,  label: 'Polarizado',        icon: Layers,    color: 'gray'   },
}

// Precio típico PPF (si hay en catálogo se usa ese)
const PPF_DEFAULT_PRICE = 1500

const COLOR = {
  blue:   { bg: 'bg-blue-50 dark:bg-blue-900/20',    text: 'text-blue-600 dark:text-blue-400',    bar: 'bg-blue-500',   chip: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'   },
  orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', bar: 'bg-orange-500', chip: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', bar: 'bg-purple-500', chip: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
  yellow: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400', bar: 'bg-yellow-400', chip: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
  red:    { bg: 'bg-red-50 dark:bg-red-900/20',      text: 'text-red-600 dark:text-red-400',      bar: 'bg-red-500',    chip: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'       },
  gray:   { bg: 'bg-gray-50 dark:bg-gray-800',       text: 'text-gray-600 dark:text-gray-400',    bar: 'bg-gray-400',   chip: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'       },
}

// ─── Barra de progreso de un servicio ────────────────────────────────────────
function SvcRow({ label, icon: Icon, color, actual, typical, income, isWash }) {
  const C = COLOR[color] || COLOR.gray
  const pct = Math.min(100, (actual / Math.max(typical, 1)) * 100)
  const done = actual >= typical
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-none ${C.bg}`}>
        <Icon className={`w-4 h-4 ${C.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
          <span className="text-xs text-gray-500 flex-none ml-2">{formatMoney(income)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
            <div className={`h-full rounded-full transition-all ${C.bar}`} style={{ width: `${pct}%` }} />
          </div>
          <span className={`text-xs font-bold flex-none w-14 text-right ${done ? 'text-green-600 dark:text-green-400' : C.text}`}>
            {actual}/{typical}{done ? ' ✓' : ''}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Tarjeta de propuesta ─────────────────────────────────────────────────────
function ProposalCard({ title, subtitle, badge, icon: Icon, colorKey, items, totalIncome, svcPerDay, daysLeft, gap }) {
  const CARD = {
    blue:  { border: 'border-blue-200 dark:border-blue-800',  bg: 'bg-blue-50 dark:bg-blue-900/10',  text: 'text-blue-600 dark:text-blue-400',  icon: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30'  },
    green: { border: 'border-green-200 dark:border-green-800', bg: 'bg-green-50 dark:bg-green-900/10', text: 'text-green-600 dark:text-green-400', icon: 'text-green-500 bg-green-100 dark:bg-green-900/30' },
    red:   { border: 'border-red-200 dark:border-red-800',    bg: 'bg-red-50 dark:bg-red-900/10',    text: 'text-red-600 dark:text-red-400',    icon: 'text-red-500 bg-red-100 dark:bg-red-900/30'    },
  }
  const C = CARD[colorKey]

  return (
    <div className={`rounded-2xl border-2 p-4 space-y-3 ${C.bg} ${C.border}`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl ${C.icon} flex-none mt-0.5`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-bold ${C.text}`}>{title}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-snug">{subtitle}</p>
          {badge && (
            <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${C.icon}`}>
              {badge}
            </span>
          )}
        </div>
        <div className="text-right flex-none">
          <p className="text-[10px] text-gray-400">Genera</p>
          <p className={`font-black text-base ${C.text}`}>{formatMoney(totalIncome)}</p>
        </div>
      </div>

      {/* Lista de servicios extra */}
      <div className="bg-white/70 dark:bg-gray-900/50 rounded-xl p-3 space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="flex-1 text-gray-700 dark:text-gray-300 leading-tight">{item.label}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-none ${C.icon}`}>×{item.qty}</span>
            <span className="text-xs text-gray-500 w-20 text-right flex-none">{formatMoney(item.income)}</span>
          </div>
        ))}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/70 dark:bg-gray-900/50 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-gray-500">Svc extra/día</p>
          <p className={`text-xl font-black ${C.text}`}>{svcPerDay <= 0 ? '—' : svcPerDay.toFixed(1)}</p>
        </div>
        <div className="bg-white/70 dark:bg-gray-900/50 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-gray-500">Días disponibles</p>
          <p className={`text-xl font-black ${C.text}`}>{daysLeft}</p>
        </div>
      </div>

      <div className={`border-t ${C.border} pt-2.5 flex justify-between items-center`}>
        <span className="text-xs text-gray-500">Cubre la brecha de</span>
        <span className={`font-bold ${C.text}`}>{formatMoney(gap)}</span>
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function Mix() {
  const { tickets, dailySummaries, workers, services, incidents, monthlyCosts, bonuses } = useApp()
  const { month, year } = currentMonthYear()
  const [showPrices, setShowPrices] = useState(false)
  const prefix = `${year}-${String(month).padStart(2, '0')}`

  const data = useMemo(() => {
    // ── Meta y costos ───────────────────────────────────────────────────────
    const rent        = monthlyCosts?.rent     || 0
    const supplies    = monthlyCosts?.supplies || 0
    const utilityGoal = monthlyCosts?.utility_goal || 2000
    const payroll = workers.filter(w => w.active).reduce((s, w) => {
      const real = calcRealSalary(w.base_salary, w.weekly_hours)
      const disc = incidents.filter(i => i.worker_id === w.id && i.apply_discount && i.date?.startsWith(prefix))
        .reduce((d, i) => d + (i.discount_amount || 0), 0)
      return s + real - disc
    }, 0)
    const monthBonus = bonuses.filter(b => b.date?.startsWith(prefix)).reduce((s, b) => s + b.amount, 0)
    const incomeGoal = rent + supplies + payroll + monthBonus + utilityGoal

    // ── Ingresos actuales ───────────────────────────────────────────────────
    const mTickets   = tickets.filter(t => t.date?.startsWith(prefix) && t.status !== 'abierto')
    const mSummaries = dailySummaries.filter(d => d.date?.startsWith(prefix))
    const currentIncome = mTickets.reduce((s, t) => s + (t.price_charged || 0), 0)
                        + mSummaries.reduce((s, d) => s + (d.total_income || 0), 0)
    const gap = Math.max(0, incomeGoal - currentIncome)

    // ── Días ────────────────────────────────────────────────────────────────
    const daysTotal   = getWorkingDaysInMonth(year, month)
    const daysElapsed = getWorkingDaysElapsed(year, month)
    const daysLeft    = getWorkingDaysRemaining(year, month)

    // ── Precios reales (usa catálogo si hay, si no usa defaults) ─────────────
    const catPrice = (cat) => {
      const svcs = services.filter(s => s.active && s.category === cat)
      if (!svcs.length) return null
      return svcs.reduce((s, sv) => s + ((sv.min_price || 0) + (sv.max_price || sv.min_price || 0)) / 2, 0) / svcs.length
    }
    const P = {
      basico:       catPrice('basico')       || TYPICAL.autos.price,
      offroad:      catPrice('offroad')      || TYPICAL.offroads.price,
      detallado:    catPrice('detallado')    || TYPICAL.detallados.price,
      ceramico:     catPrice('ceramico')     || TYPICAL.ceramicos.price,
      abrillantado: catPrice('abrillantado') || TYPICAL.abrillantados.price,
      polarizado:   catPrice('polarizado')   || TYPICAL.polarizados.price,
      ppf:          catPrice('ppf')          || PPF_DEFAULT_PRICE,
    }
    const ppfName  = services.find(s => s.active && s.category === 'ppf')?.name || 'PPF'
    const cerName  = services.find(s => s.active && s.category === 'ceramico')?.name || 'Cerámico'
    const detName  = services.find(s => s.active && s.category === 'detallado')?.name || 'Detallado'
    const abriName = services.find(s => s.active && s.category === 'abrillantado')?.name || 'Abrillantado'
    const polName  = services.find(s => s.active && s.category === 'polarizado')?.name || 'Polarizado'

    // ── Conteo real del mes por categoría ──────────────────────────────────
    const cnt = {}
    const inc = {}
    mTickets.forEach(t => {
      const svc = services.find(s => s.id === t.service_id)
      const cat = svc?.category || 'basico'
      cnt[cat] = (cnt[cat] || 0) + 1
      inc[cat] = (inc[cat] || 0) + (t.price_charged || 0)
    })

    // Estimación de lavados por tipo (auto/suv/offroad) basado en proporciones típicas
    const totalWashes     = (cnt['basico'] || 0) + (cnt['offroad'] || 0)
    const washRatio       = TYPICAL.autos.qty + TYPICAL.suvs.qty + TYPICAL.offroads.qty  // 90
    const actualAutos     = Math.round(totalWashes * (TYPICAL.autos.qty  / washRatio))
    const actualSuvs      = Math.round(totalWashes * (TYPICAL.suvs.qty   / washRatio))
    const actualOffroads  = totalWashes - actualAutos - actualSuvs

    // Ingresos por tipo de lavado
    const incWashes = (inc['basico'] || 0) + (inc['offroad'] || 0)
    const washIncAuto = actualAutos    * TYPICAL.autos.price
    const washIncSuv  = actualSuvs     * TYPICAL.suvs.price
    const washIncOff  = actualOffroads * TYPICAL.offroads.price

    // Ingreso típico mensual completo
    const typicalMonthly =
      (TYPICAL.autos.qty     * TYPICAL.autos.price) +
      (TYPICAL.suvs.qty      * TYPICAL.suvs.price)  +
      (TYPICAL.offroads.qty  * TYPICAL.offroads.price) +
      (TYPICAL.detallados.qty    * P.detallado)    +
      (TYPICAL.ceramicos.qty     * P.ceramico)     +
      (TYPICAL.abrillantados.qty * P.abrillantado) +
      (TYPICAL.polarizados.qty   * P.polarizado)

    // ── Propuesta 1: Volumen ─────────────────────────────────────────────────
    // Solo lavados extra (70% offroads, 30% autos/suv mix) para cubrir brecha
    const extraOff1  = gap > 0 ? Math.ceil(gap * 0.60 / TYPICAL.offroads.price) : 0
    const extraAuto1 = gap > 0 ? Math.ceil((gap - extraOff1 * TYPICAL.offroads.price) * 0.55 / TYPICAL.autos.price) : 0
    const extraSuv1  = gap > 0 ? Math.ceil((gap - extraOff1 * TYPICAL.offroads.price - extraAuto1 * TYPICAL.autos.price) / TYPICAL.suvs.price) : 0
    const incVol1    = extraOff1 * TYPICAL.offroads.price + extraAuto1 * TYPICAL.autos.price + extraSuv1 * TYPICAL.suvs.price
    const totalExtra1 = extraOff1 + extraAuto1 + extraSuv1
    const svcDay1     = daysLeft > 0 ? totalExtra1 / daysLeft : 0

    // ── Propuesta 2: Mixto ──────────────────────────────────────────────────
    // Primero completa servicios premium pendientes del mes típico, luego washes
    const pendDet  = Math.max(0, TYPICAL.detallados.qty    - (cnt['detallado']    || 0))
    const pendAbri = Math.max(0, TYPICAL.abrillantados.qty - (cnt['abrillantado'] || 0))
    const pendPol  = Math.max(0, TYPICAL.polarizados.qty   - (cnt['polarizado']   || 0))
    const incFijo2 = pendDet * P.detallado + pendAbri * P.abrillantado + pendPol * P.polarizado
    const resto2   = Math.max(0, gap - incFijo2)
    const extraOff2  = resto2 > 0 ? Math.ceil(resto2 * 0.5 / TYPICAL.offroads.price) : 0
    const extraAuto2 = resto2 > 0 ? Math.ceil((resto2 - extraOff2 * TYPICAL.offroads.price) / TYPICAL.autos.price) : 0
    const incVol2    = extraOff2 * TYPICAL.offroads.price + extraAuto2 * TYPICAL.autos.price
    const inc2Total  = incFijo2 + incVol2
    const totalExtra2 = pendDet + pendAbri + pendPol + extraOff2 + extraAuto2
    const svcDay2     = daysLeft > 0 ? totalExtra2 / daysLeft : 0

    // ── Propuesta 3: Pro Premium (PPF + cerámicos) ────────────────────────
    const ppf3    = 1
    const cer3    = Math.max(0, TYPICAL.ceramicos.qty - (cnt['ceramico'] || 0)) + 1
    const incPrem = ppf3 * P.ppf + cer3 * P.ceramico
    const resto3  = Math.max(0, gap - incPrem)
    const det3    = resto3 > 0 ? Math.ceil(resto3 / P.detallado) : 0
    const inc3Total = incPrem + det3 * P.detallado
    const totalExtra3 = ppf3 + cer3 + det3
    const svcDay3     = daysLeft > 0 ? totalExtra3 / daysLeft : 0

    return {
      incomeGoal, currentIncome, gap, daysTotal, daysElapsed, daysLeft,
      cnt, inc,
      actualAutos, actualSuvs, actualOffroads,
      washIncAuto, washIncSuv, washIncOff, incWashes,
      typicalMonthly, P, ppfName, cerName, detName, abriName, polName,
      pendDet, pendAbri, pendPol,
      proposals: {
        volumen: {
          items: [
            extraOff1  > 0 && { label: 'Offroad / Pickup', qty: extraOff1,  income: extraOff1  * TYPICAL.offroads.price },
            extraSuv1  > 0 && { label: 'Lavado SUV',        qty: extraSuv1,  income: extraSuv1  * TYPICAL.suvs.price    },
            extraAuto1 > 0 && { label: 'Lavado auto',       qty: extraAuto1, income: extraAuto1 * TYPICAL.autos.price   },
          ].filter(Boolean),
          totalIncome: incVol1, svcPerDay: svcDay1, daysLeft, gap,
        },
        mixto: {
          items: [
            pendDet  > 0 && { label: detName,  qty: pendDet,    income: pendDet  * P.detallado    },
            pendAbri > 0 && { label: abriName,  qty: pendAbri,   income: pendAbri * P.abrillantado },
            pendPol  > 0 && { label: polName,   qty: pendPol,    income: pendPol  * P.polarizado   },
            extraOff2  > 0 && { label: 'Offroad / Pickup', qty: extraOff2,  income: extraOff2  * TYPICAL.offroads.price },
            extraAuto2 > 0 && { label: 'Lavado auto/SUV',  qty: extraAuto2, income: extraAuto2 * TYPICAL.autos.price   },
          ].filter(Boolean),
          totalIncome: inc2Total, svcPerDay: svcDay2, daysLeft, gap,
        },
        premium: {
          items: [
            ppf3 > 0 && { label: ppfName,  qty: ppf3, income: ppf3  * P.ppf      },
            cer3 > 0 && { label: cerName,  qty: cer3, income: cer3  * P.ceramico },
            det3 > 0 && { label: detName,  qty: det3, income: det3  * P.detallado },
          ].filter(Boolean),
          totalIncome: inc3Total, svcPerDay: svcDay3, daysLeft, gap,
        },
      },
    }
  }, [tickets, dailySummaries, workers, services, incidents, monthlyCosts, bonuses, prefix, month, year])

  const metAlcanzada = data.gap <= 0

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mix del mes</h1>
        <p className="text-sm text-gray-500">{monthName(month)} {year} · Composición y estrategia</p>
      </div>

      {/* Brecha / Meta alcanzada */}
      {metAlcanzada ? (
        <div className="card border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 text-center py-8">
          <p className="text-3xl mb-2">🎉</p>
          <p className="font-bold text-green-700 dark:text-green-400 text-lg">¡Meta del mes alcanzada!</p>
          <p className="text-sm text-green-600 dark:text-green-500 mt-1">
            {formatMoney(data.currentIncome)} generados · meta {formatMoney(data.incomeGoal)}
          </p>
        </div>
      ) : (
        <div className="card border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl flex-none">
              <TargetIcon className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-red-700 dark:text-red-400 text-sm">Brecha para alcanzar la meta</p>
              <p className="text-3xl font-black text-red-600 dark:text-red-400">{formatMoney(data.gap)}</p>
              <p className="text-xs text-red-500 mt-0.5">
                {data.daysLeft} días hábiles restantes · necesitas {formatMoney(data.gap / Math.max(1, data.daysLeft))}/día en extra
              </p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-500">Acumulado</p>
              <p className="font-bold text-gray-800 dark:text-gray-200">{formatMoney(data.currentIncome)}</p>
              <p className="text-xs text-gray-400">de {formatMoney(data.incomeGoal)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Composición del mes ────────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-red-500" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">Composición del mes</p>
          <span className="text-xs text-gray-400 ml-auto">{data.daysElapsed}/{data.daysTotal} días trabajados</span>
        </div>

        {/* Lavados — bloque separado con 3 tipos */}
        <div className="mb-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Lavados</span>
            </div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {data.actualAutos + data.actualSuvs + data.actualOffroads} este mes · {formatMoney(data.incWashes)}
            </span>
          </div>
          {[
            { label: 'Autos',             qty: data.actualAutos,    typical: TYPICAL.autos.qty,    income: data.washIncAuto, color: 'blue' },
            { label: 'SUVs',              qty: data.actualSuvs,     typical: TYPICAL.suvs.qty,     income: data.washIncSuv,  color: 'blue' },
            { label: 'Offroad / Pickup',  qty: data.actualOffroads, typical: TYPICAL.offroads.qty, income: data.washIncOff,  color: 'orange' },
          ].map(({ label, qty, typical, income, color }) => {
            const C = COLOR[color]
            const pct = Math.min(100, (qty / typical) * 100)
            return (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-28 flex-none">{label}</span>
                <div className="flex-1 bg-blue-100 dark:bg-blue-900/30 rounded-full h-1.5">
                  <div className={`h-full rounded-full ${C.bar}`} style={{ width: `${pct}%` }} />
                </div>
                <span className={`text-xs font-bold flex-none w-12 text-right ${qty >= typical ? 'text-green-600 dark:text-green-400' : C.text}`}>
                  {qty}/{typical}
                </span>
              </div>
            )
          })}
        </div>

        {/* Servicios premium con objetivo */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {[
            { key: 'detallado',    label: data.detName,  icon: Sparkles, color: 'purple', typical: TYPICAL.detallados.qty,     actual: data.cnt['detallado']    || 0, income: data.inc['detallado']    || 0 },
            { key: 'ceramico',     label: data.cerName,  icon: Shield,   color: 'red',    typical: TYPICAL.ceramicos.qty,      actual: data.cnt['ceramico']     || 0, income: data.inc['ceramico']     || 0 },
            { key: 'abrillantado', label: data.abriName, icon: Star,     color: 'yellow', typical: TYPICAL.abrillantados.qty,  actual: data.cnt['abrillantado'] || 0, income: data.inc['abrillantado'] || 0 },
            { key: 'polarizado',   label: data.polName,  icon: Layers,   color: 'gray',   typical: TYPICAL.polarizados.qty,    actual: data.cnt['polarizado']   || 0, income: data.inc['polarizado']   || 0 },
          ].map(row => (
            <SvcRow key={row.key} {...row} />
          ))}
        </div>

        {/* Total */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <div>
            <span className="text-sm text-gray-500">Total generado</span>
            <span className="text-xs text-gray-400 ml-2">· típico mensual {formatMoney(data.typicalMonthly)}</span>
          </div>
          <span className="text-base font-black text-gray-900 dark:text-white">{formatMoney(data.currentIncome)}</span>
        </div>
      </div>

      {/* ── Propuestas para cerrar la brecha ─────────────────────────────────── */}
      {!metAlcanzada && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Servicios extra para cerrar la brecha</p>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          </div>
          <p className="text-xs text-gray-400 -mt-3 text-center">
            Basado en lo que ya tienes este mes. Solo se muestran los servicios adicionales necesarios.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ProposalCard
              title="Volumen"
              subtitle="Cerrar con más lavados. El más fácil de ejecutar día a día."
              badge="Más fácil"
              icon={Droplets}
              colorKey="blue"
              {...data.proposals.volumen}
            />
            <ProposalCard
              title="Mixto"
              subtitle="Completa los servicios premium pendientes del mes y ajusta con lavados."
              badge="Recomendado"
              icon={Sparkles}
              colorKey="green"
              {...data.proposals.mixto}
            />
            <ProposalCard
              title="Pro Premium"
              subtitle="Un PPF + cerámicos estratégicos. Menos servicios, mayor ticket."
              badge="Mayor ingreso x servicio"
              icon={Shield}
              colorKey="red"
              {...data.proposals.premium}
            />
          </div>
        </>
      )}

      {/* ── Precios de referencia ─────────────────────────────────────────────── */}
      <div className="card">
        <button onClick={() => setShowPrices(v => !v)}
          className="w-full flex items-center justify-between text-sm font-semibold text-gray-600 dark:text-gray-400">
          <span>Precios y objetivos de referencia</span>
          {showPrices ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showPrices && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                { label: 'Auto (lavado)',   price: TYPICAL.autos.price,        typ: `${TYPICAL.autos.qty}/mes`,        color: 'blue'   },
                { label: 'SUV (lavado)',    price: TYPICAL.suvs.price,         typ: `${TYPICAL.suvs.qty}/mes`,         color: 'blue'   },
                { label: 'Offroad/Pickup', price: TYPICAL.offroads.price,     typ: `${TYPICAL.offroads.qty}/mes`,     color: 'orange' },
                { label: 'Detallado',       price: data.P.detallado,           typ: `${TYPICAL.detallados.qty}/mes`,   color: 'purple' },
                { label: 'Abrillantado',    price: data.P.abrillantado,        typ: `${TYPICAL.abrillantados.qty}/mes`,color: 'yellow' },
                { label: 'Cerámico',        price: data.P.ceramico,            typ: `${TYPICAL.ceramicos.qty}/mes`,    color: 'red'    },
                { label: 'Polarizado',      price: data.P.polarizado,          typ: `${TYPICAL.polarizados.qty}/mes`,  color: 'gray'   },
                { label: 'PPF',             price: data.P.ppf,                 typ: 'puntual',                         color: 'gray'   },
              ].map(({ label, price, typ, color }) => {
                const C = COLOR[color]
                return (
                  <div key={label} className={`rounded-xl p-2.5 ${C.bg}`}>
                    <p className="text-gray-500">{label}</p>
                    <p className={`font-black text-base ${C.text}`}>{formatMoney(price)}</p>
                    <p className="text-gray-400">objetivo: {typ}</p>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-gray-400">
              * Los precios de detallado, cerámico, abrillantado, polarizado y PPF se toman del catálogo de servicios cuando están disponibles.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function TargetIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  )
}
