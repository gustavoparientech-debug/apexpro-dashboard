import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { formatMoney, formatDate, calcRealSalary, monthName, currentMonthYear, getWorkingDaysInMonth, getWorkingDaysElapsed, getWorkingDaysInRange } from '../lib/utils'
import { Download, Share2, Calendar, TrendingUp, DollarSign, CreditCard, Car, Clock, Award } from 'lucide-react'
import StatCard from '../components/ui/StatCard'
import toast from 'react-hot-toast'

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

const MONTH_OPTIONS = (() => {
  const { month: cm, year: cy } = currentMonthYear()
  const opts = []
  for (let i = 0; i < 12; i++) {
    let m = cm - i, y = cy
    if (m <= 0) { m += 12; y -= 1 }
    opts.push({ m, y, label: `${monthName(m)} ${y}` })
  }
  return opts
})()

export default function Historial() {
  const { tickets, dailySummaries, workers, incidents, monthlyCosts, expenses } = useApp()
  const { month: cm, year: cy } = currentMonthYear()

  const [mode, setMode] = useState('mes') // 'mes' | 'rango'
  const [selM, setSelM] = useState(cm)
  const [selY, setSelY] = useState(cy)
  const todayStr = new Date().toISOString().slice(0, 10)
  const monthStartStr = `${cy}-${String(cm).padStart(2,'0')}-01`
  const [dateFrom, setDateFrom] = useState(monthStartStr)
  const [dateTo,   setDateTo]   = useState(todayStr)

  const [pastData, setPastData] = useState({ tickets: [], summaries: [], expenses: [] })
  const [loading, setLoading] = useState(false)

  const isCurrentMonth = selM === cm && selY === cy
  const prefix = `${selY}-${String(selM).padStart(2,'0')}`

  // Cargar datos pasados de Supabase
  useEffect(() => {
    if (IS_DEMO) return
    if (mode === 'mes' && isCurrentMonth) { setPastData({ tickets: [], summaries: [], expenses: [] }); return }

    setLoading(true)
    let startDate, endDate
    if (mode === 'mes') {
      const lastDay = new Date(selY, selM, 0).getDate()
      startDate = `${selY}-${String(selM).padStart(2,'0')}-01`
      endDate   = `${selY}-${String(selM).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
    } else {
      if (!dateFrom || !dateTo) { setLoading(false); return }
      startDate = dateFrom; endDate = dateTo
    }

    Promise.all([
      supabase.from('tickets').select('*').gte('date', startDate).lte('date', endDate).neq('status', 'abierto'),
      supabase.from('daily_summary').select('*').gte('date', startDate).lte('date', endDate),
      supabase.from('worker_expenses').select('*').gte('date', startDate).lte('date', endDate),
    ]).then(([t, s, e]) => {
      setPastData({ tickets: t.data || [], summaries: s.data || [], expenses: e.data || [] })
    }).finally(() => setLoading(false))
  }, [mode, selM, selY, isCurrentMonth, dateFrom, dateTo])

  const reportData = useMemo(() => {
    let periodTickets, periodSummaries, periodExpenses

    if (mode === 'mes') {
      if (isCurrentMonth) {
        periodTickets   = tickets.filter(t => t.date?.startsWith(prefix) && t.status !== 'abierto')
        periodSummaries = dailySummaries.filter(d => d.date?.startsWith(prefix))
        periodExpenses  = (expenses || []).filter(e => e.date?.startsWith(prefix))
      } else {
        periodTickets   = pastData.tickets
        periodSummaries = pastData.summaries
        periodExpenses  = pastData.expenses
      }
    } else {
      if (!dateFrom || !dateTo) return null
      periodTickets   = pastData.tickets
      periodSummaries = pastData.summaries
      periodExpenses  = pastData.expenses
    }

    const ticketIncome   = periodTickets.reduce((s, t) => s + (t.price_charged || 0), 0)
    const summaryIncome  = periodSummaries.reduce((s, d) => s + (d.total_income || 0), 0)
    const grossIncome    = ticketIncome + summaryIncome
    const totalExpenses  = periodExpenses.reduce((s, e) => s + (e.amount || 0), 0)

    const costItemsData = monthlyCosts?.cost_items
    const fixedCosts = (costItemsData && Array.isArray(costItemsData) && costItemsData.length > 0)
      ? costItemsData.reduce((s, i) => s + (i.amount || 0), 0)
      : (monthlyCosts?.rent || 0) + (monthlyCosts?.supplies || 0)
    const payrollTotal = workers.filter(w => w.active).reduce((s, w) => {
      const real = calcRealSalary(w.base_salary, w.weekly_hours)
      const disc = incidents.filter(i => i.worker_id === w.id && i.apply_discount)
        .reduce((d, i) => d + (i.discount_amount || 0), 0)
      return s + real - disc
    }, 0)
    // Prorratear costos usando días laborables igual que el Panel
    const workingDaysTotal   = getWorkingDaysInMonth(selY, selM)
    const workingDaysElapsed = isCurrentMonth ? getWorkingDaysElapsed(selY, selM) : workingDaysTotal
    let costRatio = 1
    if (workingDaysTotal > 0) {
      if (mode === 'mes') {
        costRatio = isCurrentMonth ? workingDaysElapsed / workingDaysTotal : 1
      } else if (mode === 'rango' && dateFrom && dateTo) {
        const rangeDays = getWorkingDaysInRange(dateFrom, dateTo)
        costRatio = Math.min(rangeDays / workingDaysTotal, 1)
      }
    }
    const proportionalFixed = (fixedCosts + payrollTotal) * costRatio
    const fixedCostsProp    = fixedCosts   * costRatio
    const payrollTotalProp  = payrollTotal * costRatio
    const totalCosts        = proportionalFixed + totalExpenses
    const totalCostsFull    = fixedCosts + payrollTotal + totalExpenses
    const netProfit  = grossIncome - totalCosts

    const efectivo      = periodTickets.filter(t => t.payment_method === 'efectivo').reduce((s, t) => s + t.price_charged, 0)
    const yape          = periodTickets.filter(t => t.payment_method === 'yape').reduce((s, t) => s + t.price_charged, 0)
    const transferencia = periodTickets.filter(t => t.payment_method === 'transferencia').reduce((s, t) => s + t.price_charged, 0)

    const dateSet = new Set([
      ...periodTickets.map(t => t.date),
      ...periodSummaries.map(d => d.date),
    ])
    const daysWorked = dateSet.size

    const avgDivisor = mode === 'mes' ? workingDaysElapsed : daysWorked
    const avgDaily   = avgDivisor > 0 ? grossIncome / avgDivisor : 0
    const avgCarsDay = daysWorked > 0 ? periodTickets.length / daysWorked : 0

    const byDate = {}
    periodTickets.forEach(t => { byDate[t.date] = (byDate[t.date] || 0) + t.price_charged })
    periodSummaries.forEach(d => { byDate[d.date] = (byDate[d.date] || 0) + d.total_income })
    const bestDayEntry = Object.entries(byDate).sort((a, b) => b[1] - a[1])[0]

    const byWorker = {}
    periodTickets.forEach(t => {
      if (!t.worker_id) return
      if (!byWorker[t.worker_id]) byWorker[t.worker_id] = { income: 0, cars: 0 }
      byWorker[t.worker_id].income += t.price_charged
      byWorker[t.worker_id].cars   += 1
    })
    const workerRanking = Object.entries(byWorker)
      .map(([id, s]) => ({ worker: workers.find(w => w.id === id), ...s }))
      .filter(r => r.worker)
      .sort((a, b) => b.income - a.income)

    return {
      grossIncome, netProfit, totalCosts, totalCostsFull, totalExpenses, fixedCosts, payrollTotal, fixedCostsProp, payrollTotalProp, costItemsData,
      efectivo, yape, transferencia,
      cars: periodTickets.length, daysWorked, avgDaily, avgCarsDay,
      bestDay: bestDayEntry ? { date: bestDayEntry[0], amount: bestDayEntry[1] } : null,
      workerRanking, periodTickets, periodSummaries, periodExpenses,
    }
  }, [mode, isCurrentMonth, prefix, dateFrom, dateTo, tickets, dailySummaries, expenses, pastData, workers, incidents, monthlyCosts])

  const periodLabel = useMemo(() => {
    if (mode === 'mes') return `${monthName(selM)} ${selY}`
    if (dateFrom && dateTo) return `${formatDate(dateFrom)} – ${formatDate(dateTo)}`
    return ''
  }, [mode, selM, selY, dateFrom, dateTo])

  function buildWhatsAppText() {
    if (!reportData) return ''
    const d = reportData
    const workerLines = d.workerRanking.map((r, i) =>
      `• ${r.worker.name}: ${r.cars} carros · S/ ${r.income.toFixed(2)}`
    ).join('\n')

    return `📊 *Reporte mensual — ${periodLabel}*

🚗 Carros lavados: ${d.cars}
📅 Días trabajados: ${d.daysWorked}
📈 Promedio por día: S/ ${d.avgDaily.toFixed(2)}

💰 Ingresos brutos: S/ ${d.grossIncome.toFixed(2)}
   💵 Efectivo: S/ ${d.efectivo.toFixed(2)}
   📱 Yape: S/ ${d.yape.toFixed(2)}
💸 Gastos: S/ ${d.totalExpenses.toFixed(2)}
✅ Ganancia neta: S/ ${d.netProfit.toFixed(2)}
${d.bestDay ? `\n🏆 Mejor día: ${formatDate(d.bestDay.date)} (S/ ${d.bestDay.amount.toFixed(2)})` : ''}

👷 *Por lavador:*
${workerLines}`
  }

  function shareWhatsApp() {
    const text = buildWhatsAppText()
    if (!text) { toast.error('Sin datos para compartir'); return }
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  async function exportExcel() {
    if (!reportData) { toast.error('Sin datos'); return }
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      const d = reportData

      // Hoja Resumen
      const resumen = [
        [`REPORTE APEX PRO — ${periodLabel.toUpperCase()}`],
        [],
        ['RESUMEN GENERAL'],
        ['Ingresos brutos',    d.grossIncome],
        ['Ganancia neta',      d.netProfit],
        ['Total gastos',       d.totalCosts],
        ['  Costos fijos',     d.fixedCosts],
        ['  Planilla',         d.payrollTotal],
        ['  Gastos personal',  d.totalExpenses],
        [],
        ['DETALLE DE INGRESOS'],
        ['Efectivo',           d.efectivo],
        ['Yape',               d.yape],
        ['Transferencia',      d.transferencia],
        [],
        ['ESTADÍSTICAS'],
        ['Carros lavados',     d.cars],
        ['Días trabajados',    d.daysWorked],
        ['Promedio diario',    parseFloat(d.avgDaily.toFixed(2))],
        ['Promedio carros/día',parseFloat(d.avgCarsDay.toFixed(2))],
        ...(d.bestDay ? [['Mejor día', formatDate(d.bestDay.date)], ['Monto mejor día', d.bestDay.amount]] : []),
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), 'Resumen')

      // Hoja Por lavador
      const workerRows = [
        ['#', 'Nombre', 'Carros', 'Total (S/)', 'Promedio (S/)'],
        ...d.workerRanking.map((r, i) => [
          i + 1, r.worker.name, r.cars,
          parseFloat(r.income.toFixed(2)),
          parseFloat((r.income / (r.cars || 1)).toFixed(2)),
        ])
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(workerRows), 'Por lavador')

      // Hoja Tickets
      if (d.periodTickets.length > 0) {
        const ticketRows = [
          ['Fecha', 'Trabajador', 'Vehículo', 'Servicio', 'Monto', 'Método pago'],
          ...d.periodTickets.map(t => [
            t.date,
            workers.find(w => w.id === t.worker_id)?.name || '—',
            t.vehicle_label || '—',
            t.service_name || '—',
            t.price_charged,
            t.payment_method || '—',
          ])
        ]
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ticketRows), 'Tickets')
      }

      // Hoja Gastos
      if (d.periodExpenses.length > 0) {
        const expRows = [
          ['Fecha', 'Descripción', 'Categoría', 'Trabajador', 'Monto'],
          ...d.periodExpenses.map(e => [
            e.date,
            e.description || e.notes || '—',
            e.category || '—',
            workers.find(w => w.id === e.worker_id)?.name || '—',
            e.amount,
          ])
        ]
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expRows), 'Gastos')
      }

      const filename = mode === 'mes'
        ? `reporte_${selY}-${String(selM).padStart(2,'0')}.xlsx`
        : `reporte_${dateFrom}_${dateTo}.xlsx`
      XLSX.writeFile(wb, filename)
      toast.success('Excel exportado')
    } catch (err) {
      console.error(err)
      toast.error('Error al exportar')
    }
  }

  const hasData = reportData && (reportData.grossIncome > 0 || reportData.cars > 0)

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reportes</h1>
          {periodLabel && <p className="text-sm text-gray-500">{periodLabel}</p>}
        </div>
        {hasData && (
          <div className="flex gap-2">
            <button onClick={exportExcel}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors">
              <Download className="w-4 h-4" /> Excel
            </button>
            <button onClick={shareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-[#25d366] hover:bg-[#1da851] text-white rounded-xl transition-colors">
              <Share2 className="w-4 h-4" /> WhatsApp
            </button>
          </div>
        )}
      </div>

      {/* Selector modo */}
      <div className="card p-1 flex rounded-xl bg-gray-100 dark:bg-gray-800">
        {['mes', 'rango'].map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === m ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500'
            }`}>
            {m === 'mes' ? 'Por mes' : 'Rango de fechas'}
          </button>
        ))}
      </div>

      {/* Filtros */}
      {mode === 'mes' ? (
        <select
          className="input"
          value={`${selY}-${selM}`}
          onChange={e => { const [y, m] = e.target.value.split('-'); setSelY(+y); setSelM(+m) }}>
          {MONTH_OPTIONS.map(o => (
            <option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`}>{o.label}</option>
          ))}
        </select>
      ) : (
        <div className="flex gap-3 items-center">
          <div className="flex-1">
            <label className="label text-xs">Desde</label>
            <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="label text-xs">Hasta</label>
            <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-8 text-gray-400 text-sm animate-pulse">Cargando datos...</div>
      )}

      {!loading && !hasData && (mode === 'rango' ? (!dateFrom || !dateTo) : true) && (
        <div className="card text-center py-10 text-gray-400">
          <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{mode === 'rango' && (!dateFrom || !dateTo) ? 'Selecciona el rango de fechas' : 'Sin datos para este período'}</p>
        </div>
      )}

      {!loading && hasData && reportData && (() => {
        const d = reportData
        return (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Ingresos del período" value={formatMoney(d.grossIncome)}  sub={`${d.cars} vehículos`} icon={DollarSign} color="orange" />
              <StatCard label="Ganancia neta"        value={formatMoney(d.netProfit)}    sub={`Costos proporcionales`} icon={TrendingUp} color="green" />
              <StatCard label="Total gastos"         value={formatMoney(d.totalCosts)}   sub={`Planilla: ${formatMoney(d.payrollTotal)}`} icon={CreditCard} color="blue" />
              <StatCard label="Vehículos"            value={d.cars}                       sub={d.cars > 0 ? `Prom: ${formatMoney(d.grossIncome / d.cars)}/carro` : '—'} icon={Car} color="purple" />
            </div>

            {/* Desglose ingresos */}
            <div className="card">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Desglose</p>
              <div className="space-y-2 text-sm">
                <Row label="🚗 Tickets"          value={formatMoney(d.grossIncome - d.periodSummaries.reduce((s,x)=>s+(x.total_income||0),0))} />
                <Row label="🗓 Ventas sueltas"   value={formatMoney(d.periodSummaries.reduce((s,x)=>s+(x.total_income||0),0))} />
                <div className="border-t border-gray-100 dark:border-gray-800 pt-2 mt-1" />
                {d.efectivo > 0     && <Row label="💵 Cobrado en efectivo"  value={formatMoney(d.efectivo)} />}
                {d.yape > 0         && <Row label="📱 Cobrado por Yape"     value={formatMoney(d.yape)} />}
                {d.transferencia > 0 && <Row label="🏦 Transferencia"       value={formatMoney(d.transferencia)} />}
              </div>
            </div>

            {/* Mejor día */}
            {d.bestDay && (
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <Award className="w-4 h-4 text-yellow-500" />
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Mejor día</p>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatMoney(d.bestDay.amount)}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDate(d.bestDay.date)}</p>
              </div>
            )}

            {/* Costos del período */}
            {d.totalCosts > 0 && (
              <div className="card">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Desglose de costos</p>
                <div className="space-y-2 text-sm">
                  {d.fixedCostsProp > 0   && <Row label="🏠 Costos fijos"    value={formatMoney(d.fixedCostsProp)} />}
                  {d.payrollTotalProp > 0 && <Row label="👷 Planilla"        value={formatMoney(d.payrollTotalProp)} />}
                  {d.totalExpenses > 0    && <Row label="💸 Gastos personal" value={formatMoney(d.totalExpenses)} />}
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-2 mt-1 flex justify-between font-semibold text-sm">
                    <span className="text-gray-700 dark:text-gray-300">Total</span>
                    <span className="text-red-600 dark:text-red-400">{formatMoney(d.totalCosts)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Por lavador */}
            {d.workerRanking.length > 0 && (
              <div className="card">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Por lavador</p>
                <div className="space-y-3">
                  {d.workerRanking.map((r, i) => (
                    <div key={r.worker.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500">{i+1}</span>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">{r.worker.name}</p>
                          <p className="text-xs text-gray-400">{r.cars} carro{r.cars !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-red-600 dark:text-red-400">{formatMoney(r.income)}</p>
                        <p className="text-xs text-gray-400">Prom: {formatMoney(r.income / (r.cars || 1))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botones de exportar abajo también */}
            <div className="flex gap-3">
              <button onClick={exportExcel}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors">
                <Download className="w-4 h-4" /> Exportar Excel (.xlsx)
              </button>
              <button onClick={shareWhatsApp}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold bg-[#25d366] hover:bg-[#1da851] text-white rounded-xl transition-colors">
                <Share2 className="w-4 h-4" /> Compartir WhatsApp
              </button>
            </div>
          </>
        )
      })()}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-semibold text-gray-900 dark:text-white">{value}</span>
    </div>
  )
}
