import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  formatMoney, calcRealSalary, getWorkingDaysRemaining,
  getWorkingDaysElapsed, getWorkingDaysInMonth, currentMonthYear, monthName
} from '../lib/utils'
import {
  Droplets, Truck, Sparkles, Star, Shield, TrendingUp,
  ChevronDown, ChevronUp, Info
} from 'lucide-react'

// Categorías y su contexto realista
const CAT_META = {
  basico:      { label: 'Lavado básico',   icon: Droplets,  color: 'blue',   typical: null },   // daily volume
  offroad:     { label: 'Offroad / 4x4',   icon: Truck,     color: 'orange', typical: null },
  detallado:   { label: 'Detallado',        icon: Sparkles,  color: 'purple', typical: 5 },
  abrillantado:{ label: 'Abrillantado',     icon: Star,      color: 'yellow', typical: 5 },
  ceramico:    { label: 'Cerámico',         icon: Shield,    color: 'red',    typical: 2 },
  polarizado:  { label: 'Polarizado',       icon: Shield,    color: 'gray',   typical: null },
  ppf:         { label: 'PPF',              icon: Shield,    color: 'gray',   typical: null },
}

const COLOR_CLASSES = {
  blue:   { bg: 'bg-blue-50 dark:bg-blue-900/20',   text: 'text-blue-600 dark:text-blue-400',   bar: 'bg-blue-500',   badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', bar: 'bg-orange-500', badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', bar: 'bg-purple-500', badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
  yellow: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400', bar: 'bg-yellow-400', badge: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
  red:    { bg: 'bg-red-50 dark:bg-red-900/20',     text: 'text-red-600 dark:text-red-400',     bar: 'bg-red-500',    badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
  gray:   { bg: 'bg-gray-50 dark:bg-gray-800',      text: 'text-gray-600 dark:text-gray-400',   bar: 'bg-gray-400',   badge: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400' },
}

function ServiceBar({ name, color, actual, typical, income }) {
  const c = COLOR_CLASSES[color] || COLOR_CLASSES.gray
  const pct = typical ? Math.min(100, (actual / typical) * 100) : 0
  const Icon = CAT_META[color]?.icon || Shield

  return (
    <div className="flex items-center gap-3 py-2">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-none ${c.bg}`}>
        <Icon className={`w-4 h-4 ${c.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{name}</span>
          <span className="text-xs text-gray-500 flex-none ml-2">{formatMoney(income)}</span>
        </div>
        {typical ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
              <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-xs font-bold flex-none ${actual >= typical ? 'text-green-600 dark:text-green-400' : c.text}`}>
              {actual}/{typical}
            </span>
          </div>
        ) : (
          <p className="text-xs text-gray-400">{actual} unidades este mes</p>
        )}
      </div>
    </div>
  )
}

function ProposalCard({ title, subtitle, icon: Icon, colorKey, items, totalIncome, carsPerDay, daysNeeded, gap, badge }) {
  const cardColors = {
    blue:  { border: 'border-blue-200 dark:border-blue-800',  bg: 'bg-blue-50 dark:bg-blue-900/10',  text: 'text-blue-600 dark:text-blue-400',  icon: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30' },
    green: { border: 'border-green-200 dark:border-green-800', bg: 'bg-green-50 dark:bg-green-900/10', text: 'text-green-600 dark:text-green-400', icon: 'text-green-500 bg-green-100 dark:bg-green-900/30' },
    red:   { border: 'border-red-200 dark:border-red-800',    bg: 'bg-red-50 dark:bg-red-900/10',    text: 'text-red-600 dark:text-red-400',    icon: 'text-red-500 bg-red-100 dark:bg-red-900/30' },
  }
  const c = cardColors[colorKey]

  return (
    <div className={`rounded-2xl border-2 p-4 space-y-4 ${c.bg} ${c.border}`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl ${c.icon} flex-none`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`font-bold ${c.text}`}>{title}</p>
            {badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.icon}`}>{badge}</span>}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="text-right flex-none">
          <p className="text-xs text-gray-500">Genera</p>
          <p className={`font-bold text-base ${c.text}`}>{formatMoney(totalIncome)}</p>
        </div>
      </div>

      {/* Servicios */}
      <div className="space-y-2 bg-white/60 dark:bg-gray-900/40 rounded-xl p-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="flex-1 text-gray-700 dark:text-gray-300">{item.name}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.icon}`}>×{item.qty}</span>
            <span className="text-xs text-gray-500 w-20 text-right">{formatMoney(item.income)}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/60 dark:bg-gray-900/40 rounded-xl p-2.5 text-center">
          <p className="text-xs text-gray-500">Servicios/día</p>
          <p className={`text-lg font-black ${c.text}`}>{carsPerDay.toFixed(1)}</p>
        </div>
        <div className="bg-white/60 dark:bg-gray-900/40 rounded-xl p-2.5 text-center">
          <p className="text-xs text-gray-500">Días necesarios</p>
          <p className={`text-lg font-black ${c.text}`}>{Math.ceil(daysNeeded)}</p>
        </div>
      </div>

      <div className={`border-t ${c.border} pt-3 flex justify-between items-center`}>
        <span className="text-xs text-gray-500">Cubre la brecha de</span>
        <span className={`font-bold ${c.text}`}>{formatMoney(gap)}</span>
      </div>
    </div>
  )
}

export default function Mix() {
  const { tickets, dailySummaries, workers, services, incidents, monthlyCosts, bonuses } = useApp()
  const { month, year } = currentMonthYear()
  const [showNotes, setShowNotes] = useState(false)
  const prefix = `${year}-${String(month).padStart(2, '0')}`

  const analysis = useMemo(() => {
    // ─── Costos / meta ──────────────────────────────────────────────────────────
    const rent        = monthlyCosts?.rent     || 0
    const supplies    = monthlyCosts?.supplies || 0
    const utilityGoal = monthlyCosts?.utility_goal || 2000
    const payrollTotal = workers.filter(w => w.active).reduce((s, w) => {
      const real = calcRealSalary(w.base_salary, w.weekly_hours)
      const disc = incidents.filter(i => i.worker_id === w.id && i.apply_discount && i.date?.startsWith(prefix))
        .reduce((d, i) => d + (i.discount_amount || 0), 0)
      return s + real - disc
    }, 0)
    const monthBonusAmt = bonuses.filter(b => b.date?.startsWith(prefix)).reduce((s, b) => s + b.amount, 0)
    const incomeGoal   = rent + supplies + payrollTotal + monthBonusAmt + utilityGoal

    // ─── Ingresos actuales del mes ───────────────────────────────────────────────
    const monthTickets    = tickets.filter(t => t.date?.startsWith(prefix) && t.status !== 'abierto')
    const monthSummaries  = dailySummaries.filter(d => d.date?.startsWith(prefix))
    const currentIncome   = monthTickets.reduce((s, t) => s + (t.price_charged || 0), 0)
                          + monthSummaries.reduce((s, d) => s + (d.total_income || 0), 0)
    const gap = Math.max(0, incomeGoal - currentIncome)

    // ─── Días ────────────────────────────────────────────────────────────────────
    const daysTotal    = getWorkingDaysInMonth(year, month)
    const daysElapsed  = getWorkingDaysElapsed(year, month)
    const daysLeft     = getWorkingDaysRemaining(year, month)

    // ─── Composición actual por categoría ────────────────────────────────────────
    const byCat = {}
    const incByCat = {}
    monthTickets.forEach(t => {
      const svc = services.find(s => s.id === t.service_id)
      const cat = svc?.category || 'basico'
      byCat[cat]   = (byCat[cat] || 0) + 1
      incByCat[cat] = (incByCat[cat] || 0) + (t.price_charged || 0)
    })

    // ─── Precios promedio por categoría (de servicios activos) ──────────────────
    const avgPrice = {}
    const activeBycat = {}
    services.filter(s => s.active).forEach(s => {
      const mid = ((s.min_price || 0) + (s.max_price || s.min_price || 0)) / 2 || s.min_price || 0
      if (!activeBycat[s.category]) activeBycat[s.category] = { sum: 0, count: 0 }
      activeBycat[s.category].sum   += mid
      activeBycat[s.category].count += 1
    })
    Object.keys(activeBycat).forEach(cat => {
      avgPrice[cat] = activeBycat[cat].sum / activeBycat[cat].count
    })

    // Fallbacks si no hay servicios cargados
    const pBasico       = avgPrice['basico']       || 45
    const pOffroad      = avgPrice['offroad']      || 65
    const pDetallado    = avgPrice['detallado']    || 200
    const pAbrillantado = avgPrice['abrillantado'] || 120
    const pCeramico     = avgPrice['ceramico']     || 900

    // ─── Composición típica mensual (referencia realista) ───────────────────────
    // Lavados básicos: el volumen diario normal. Si hay datos los usamos; si no estimamos.
    const avgBasicosDia = daysElapsed > 0
      ? (byCat['basico'] || 0) / daysElapsed
      : 8 // fallback 8/día
    const typicalBasicos     = Math.round(avgBasicosDia * daysTotal)
    const typicalOffroads    = Math.round((byCat['offroad'] || 0) > 0
      ? ((byCat['offroad'] || 0) / Math.max(daysElapsed, 1)) * daysTotal
      : typicalBasicos * 0.15) // 15% del volumen básico
    const typicalDetallados  = 5
    const typicalAbrillantados = 5
    const typicalCeramicos   = 2

    // Nombre de servicio representativo por categoría
    const svcName = (cat) => services.find(s => s.active && s.category === cat)?.name || CAT_META[cat]?.label || cat

    // ─── Propuesta 1: Volumen ────────────────────────────────────────────────────
    // Cerrar la brecha con más lavados básicos + offroads
    // Meta: cuántos lavados extra se necesitan
    const extraBasicosVol = gap > 0 ? Math.ceil(gap * 0.7 / pBasico) : 0
    const extraOffroadsVol = gap > 0 ? Math.ceil(gap * 0.3 / pOffroad) : 0
    const incomeVol = extraBasicosVol * pBasico + extraOffroadsVol * pOffroad
    const diasVol   = daysLeft > 0 ? (extraBasicosVol + extraOffroadsVol) / daysLeft : 0

    // ─── Propuesta 2: Mixto (el más realista) ────────────────────────────────────
    // Lavados base + empujar detallados y abrillantados pendientes del mes
    const detPendientes  = Math.max(0, typicalDetallados  - (byCat['detallado']    || 0))
    const abrilPendientes = Math.max(0, typicalAbrillantados - (byCat['abrillantado'] || 0))
    const incMixtoFijo   = detPendientes * pDetallado + abrilPendientes * pAbrillantado
    const gapMixtoRest   = Math.max(0, gap - incMixtoFijo)
    const extraBasicosMix = gapMixtoRest > 0 ? Math.ceil(gapMixtoRest / pBasico) : 0
    const incomeMixto    = incMixtoFijo + extraBasicosMix * pBasico
    const diasMixto      = daysLeft > 0
      ? (detPendientes + abrilPendientes + extraBasicosMix) / daysLeft : 0

    // ─── Propuesta 3: Premium ────────────────────────────────────────────────────
    // Empujar cerámicos + abrillantados premium para cerrar rápido
    const cerPendientes  = Math.max(0, typicalCeramicos - (byCat['ceramico'] || 0))
    // Si ya están los típicos, agregamos uno extra
    const cerTarget      = Math.max(cerPendientes + 1, Math.ceil(gap / pCeramico))
    const incCeramicos   = cerTarget * pCeramico
    const gapPremRest    = Math.max(0, gap - incCeramicos)
    const extraAbrilPrem = gapPremRest > 0 ? Math.ceil(gapPremRest / pAbrillantado) : 0
    const gapPrem2Rest   = Math.max(0, gapPremRest - extraAbrilPrem * pAbrillantado)
    const extraDetPrem   = gapPrem2Rest > 0 ? Math.ceil(gapPrem2Rest / pDetallado) : 0
    const incomePrem     = incCeramicos + extraAbrilPrem * pAbrillantado + extraDetPrem * pDetallado
    const diasPrem       = daysLeft > 0 ? (cerTarget + extraAbrilPrem + extraDetPrem) / daysLeft : 0

    return {
      incomeGoal, currentIncome, gap, daysLeft, daysElapsed, daysTotal,
      byCat, incByCat,
      typicalBasicos, typicalOffroads, typicalDetallados, typicalAbrillantados, typicalCeramicos,
      avgBasicosDia,
      svcName,
      pBasico, pOffroad, pDetallado, pAbrillantado, pCeramico,
      volumen: {
        items: [
          { name: svcName('basico'),  qty: extraBasicosVol,  income: extraBasicosVol  * pBasico  },
          { name: svcName('offroad'), qty: extraOffroadsVol, income: extraOffroadsVol * pOffroad },
        ].filter(i => i.qty > 0),
        totalIncome: incomeVol, carsPerDay: diasVol, daysNeeded: daysLeft > 0 ? (extraBasicosVol + extraOffroadsVol) : 0, gap,
      },
      mixto: {
        items: [
          detPendientes  > 0 && { name: svcName('detallado'),    qty: detPendientes,    income: detPendientes    * pDetallado    },
          abrilPendientes > 0 && { name: svcName('abrillantado'), qty: abrilPendientes,  income: abrilPendientes  * pAbrillantado },
          extraBasicosMix > 0 && { name: svcName('basico'),       qty: extraBasicosMix,  income: extraBasicosMix  * pBasico       },
        ].filter(Boolean),
        totalIncome: incomeMixto, carsPerDay: diasMixto, daysNeeded: daysLeft > 0 ? (detPendientes + abrilPendientes + extraBasicosMix) : 0, gap,
      },
      premium: {
        items: [
          cerTarget      > 0 && { name: svcName('ceramico'),     qty: cerTarget,        income: cerTarget        * pCeramico     },
          extraAbrilPrem > 0 && { name: svcName('abrillantado'), qty: extraAbrilPrem,   income: extraAbrilPrem   * pAbrillantado },
          extraDetPrem   > 0 && { name: svcName('detallado'),    qty: extraDetPrem,     income: extraDetPrem     * pDetallado    },
        ].filter(Boolean),
        totalIncome: incomePrem, carsPerDay: diasPrem, daysNeeded: daysLeft > 0 ? (cerTarget + extraAbrilPrem + extraDetPrem) : 0, gap,
      },
    }
  }, [tickets, dailySummaries, workers, services, incidents, monthlyCosts, bonuses, prefix, month, year])

  const metAlcanzada = analysis.gap <= 0

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mix del mes</h1>
        <p className="text-sm text-gray-500">{monthName(month)} {year} · Composición y estrategia</p>
      </div>

      {/* Brecha o meta alcanzada */}
      {metAlcanzada ? (
        <div className="card border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 text-center py-8">
          <p className="text-3xl mb-2">🎉</p>
          <p className="font-bold text-green-700 dark:text-green-400 text-lg">¡Meta del mes alcanzada!</p>
          <p className="text-sm text-green-600 dark:text-green-500 mt-1">
            Ingresos actuales {formatMoney(analysis.currentIncome)} · Meta {formatMoney(analysis.incomeGoal)}
          </p>
        </div>
      ) : (
        <div className="card border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl flex-none">
              <TargetIcon className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-red-700 dark:text-red-400 text-sm">Brecha para alcanzar la meta</p>
              <p className="text-3xl font-black text-red-600 dark:text-red-400">{formatMoney(analysis.gap)}</p>
              <p className="text-xs text-red-500 mt-0.5">
                {analysis.daysLeft} días hábiles restantes · {formatMoney(analysis.gap / Math.max(1, analysis.daysLeft))}/día necesario
              </p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-500">Acumulado</p>
              <p className="font-bold text-gray-800 dark:text-gray-200">{formatMoney(analysis.currentIncome)}</p>
              <p className="text-xs text-gray-400">de {formatMoney(analysis.incomeGoal)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Composición actual del mes */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-red-500" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">Composición del mes</p>
          <span className="text-xs text-gray-400 ml-auto">{analysis.daysElapsed} días trabajados de {analysis.daysTotal}</span>
        </div>

        {/* Lavados básicos — barra de ritmo diario */}
        <div className="mb-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Lavados básicos</span>
            </div>
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{analysis.byCat['basico'] || 0} este mes</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-blue-100 dark:bg-blue-900/30 rounded-full h-2">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, ((analysis.byCat['basico'] || 0) / Math.max(1, analysis.typicalBasicos)) * 100)}%` }} />
            </div>
            <span className="text-xs text-blue-600 font-medium flex-none">
              ~{analysis.avgBasicosDia.toFixed(1)}/día · meta {analysis.typicalBasicos}
            </span>
          </div>
        </div>

        {/* Servicios con objetivo mensual */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {[
            { cat: 'offroad',       label: 'Offroad / 4x4',  color: 'orange', typical: analysis.typicalOffroads },
            { cat: 'detallado',     label: 'Detallado',       color: 'purple', typical: analysis.typicalDetallados },
            { cat: 'abrillantado',  label: 'Abrillantado',    color: 'yellow', typical: analysis.typicalAbrillantados },
            { cat: 'ceramico',      label: 'Cerámico',        color: 'red',    typical: analysis.typicalCeramicos },
          ].map(({ cat, label, color, typical }) => {
            const actual = analysis.byCat[cat] || 0
            const income = analysis.incByCat[cat] || 0
            const svcName = analysis.svcName(cat)
            const C = COLOR_CLASSES[color]
            const Icon = CAT_META[cat]?.icon || Shield
            const pct = Math.min(100, (actual / typical) * 100)
            const done = actual >= typical
            return (
              <div key={cat} className="flex items-center gap-3 py-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-none ${C.bg}`}>
                  <Icon className={`w-4 h-4 ${C.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{svcName !== label ? svcName : label}</span>
                    <span className="text-xs text-gray-500 flex-none ml-2">{formatMoney(income)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                      <div className={`h-full rounded-full ${C.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`text-xs font-bold flex-none ${done ? 'text-green-600 dark:text-green-400' : C.text}`}>
                      {actual}/{typical} {done ? '✓' : ''}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Total */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <span className="text-sm text-gray-500">Total generado este mes</span>
          <span className="text-base font-black text-gray-900 dark:text-white">{formatMoney(analysis.currentIncome)}</span>
        </div>
      </div>

      {/* Propuestas para cerrar la brecha */}
      {!metAlcanzada && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Cómo cerrar la brecha</p>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ProposalCard
              title="Volumen"
              subtitle="Máximo de lavados básicos y offroads"
              icon={Droplets}
              colorKey="blue"
              badge="Más fácil"
              {...analysis.volumen}
            />
            <ProposalCard
              title="Mixto"
              subtitle="Completar detallados + abrillantados del mes"
              icon={Sparkles}
              colorKey="green"
              badge="Recomendado"
              {...analysis.mixto}
            />
            <ProposalCard
              title="Premium"
              subtitle="Cerámicos + abrillantados de alto valor"
              icon={Star}
              colorKey="red"
              badge="Mayor ingreso"
              {...analysis.premium}
            />
          </div>
        </>
      )}

      {/* Referencia de precios promedio */}
      <div className="card">
        <button onClick={() => setShowNotes(v => !v)}
          className="w-full flex items-center justify-between text-sm font-semibold text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            Referencia de precios usados
          </div>
          {showNotes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showNotes && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            {[
              { label: 'Lavado básico',   price: analysis.pBasico },
              { label: 'Offroad / 4x4',   price: analysis.pOffroad },
              { label: 'Detallado',        price: analysis.pDetallado },
              { label: 'Abrillantado',     price: analysis.pAbrillantado },
              { label: 'Cerámico',         price: analysis.pCeramico },
            ].map(({ label, price }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-gray-500">{label}</p>
                <p className="font-bold text-gray-900 dark:text-white mt-0.5">{formatMoney(price)}</p>
                <p className="text-gray-400 mt-0.5">precio promedio</p>
              </div>
            ))}
          </div>
        )}
        {showNotes && (
          <div className="mt-3 text-xs text-gray-400 space-y-1">
            <p>• Precios calculados como promedio entre mínimo y máximo de cada categoría en tu catálogo de servicios.</p>
            <p>• Objetivos típicos del mes: {analysis.typicalDetallados} detallados · {analysis.typicalAbrillantados} abrillantados · {analysis.typicalCeramicos} cerámicos.</p>
            <p>• El volumen de lavados básicos se proyecta desde el ritmo actual del mes.</p>
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
