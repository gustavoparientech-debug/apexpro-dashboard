import { useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { formatMoney, formatDate, calcRealSalary, currentMonthYear, monthName } from '../lib/utils'
import Badge from '../components/ui/Badge'
import { Download, FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'

const INCIDENT_LABELS = { falta: 'Falta injustificada', permiso: 'Permiso justificado', tardanza: 'Tardanza', no_marcacion: 'No marcó entrada/salida' }

export default function Nomina() {
  const { workers, incidents } = useApp()
  const { month, year } = currentMonthYear()
  const tableRef = useRef(null)

  const payrollData = useMemo(() => {
    return workers
      .filter(w => w.active)
      .map(w => {
        const realSalary = calcRealSalary(w.base_salary, w.weekly_hours)
        const workerIncidents = incidents.filter(i => i.worker_id === w.id)
        const totalDiscounts = workerIncidents
          .filter(i => i.apply_discount)
          .reduce((s, i) => s + (i.discount_amount || 0), 0)
        const finalPay = realSalary - totalDiscounts
        return { ...w, realSalary, workerIncidents, totalDiscounts, finalPay }
      })
  }, [workers, incidents])

  const totalPayroll = payrollData.reduce((s, w) => s + w.finalPay, 0)
  const totalDiscounts = payrollData.reduce((s, w) => s + w.totalDiscounts, 0)
  const totalBase = payrollData.reduce((s, w) => s + w.realSalary, 0)

  function exportExcel() {
    try {
      import('xlsx').then(XLSX => {
        const rows = payrollData.map(w => ({
          'Nombre': w.name,
          'Horas/Semana': w.weekly_hours,
          'Salario Base': w.base_salary,
          'Salario Real Mensual': w.realSalary.toFixed(2),
          'Descuentos': w.totalDiscounts.toFixed(2),
          'Pago Final': w.finalPay.toFixed(2),
        }))
        rows.push({
          'Nombre': 'TOTAL',
          'Horas/Semana': '',
          'Salario Base': '',
          'Salario Real Mensual': totalBase.toFixed(2),
          'Descuentos': totalDiscounts.toFixed(2),
          'Pago Final': totalPayroll.toFixed(2),
        })
        const ws = XLSX.utils.json_to_sheet(rows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Nómina')
        XLSX.writeFile(wb, `nomina-apexpro-${year}-${String(month).padStart(2,'0')}.xlsx`)
        toast.success('Excel exportado')
      })
    } catch (err) {
      toast.error('Error al exportar')
    }
  }

  function exportPDF() {
    try {
      import('jspdf').then(({ jsPDF }) => {
        const doc = new jsPDF()
        doc.setFontSize(16)
        doc.text(`Nómina Apex Pro — ${monthName(month)} ${year}`, 14, 20)
        doc.setFontSize(10)
        let y = 35
        payrollData.forEach(w => {
          doc.text(`${w.name}: S/${w.realSalary.toFixed(2)} - S/${w.totalDiscounts.toFixed(2)} = S/${w.finalPay.toFixed(2)}`, 14, y)
          y += 8
        })
        y += 4
        doc.setFontSize(12)
        doc.text(`TOTAL PLANILLA: S/${totalPayroll.toFixed(2)}`, 14, y)
        doc.save(`nomina-apexpro-${year}-${String(month).padStart(2,'0')}.pdf`)
        toast.success('PDF exportado')
      })
    } catch (err) {
      toast.error('Error al exportar')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nómina</h1>
          <p className="text-sm text-gray-500">{monthName(month)} {year}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm flex items-center gap-1" onClick={exportPDF}>
            <Download className="w-4 h-4" /> PDF
          </button>
          <button className="btn-secondary text-sm flex items-center gap-1" onClick={exportExcel}>
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* Resumen total */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">Planilla base</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{formatMoney(totalBase)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">Total descuentos</p>
          <p className="text-xl font-bold text-red-500">-{formatMoney(totalDiscounts)}</p>
        </div>
        <div className="card text-center border-2 border-red-200 dark:border-red-900">
          <p className="text-xs text-red-600 dark:text-red-400 mb-1 font-medium">Total a pagar</p>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatMoney(totalPayroll)}</p>
        </div>
      </div>

      {/* Tabla de nómina */}
      <div className="card overflow-x-auto" ref={tableRef}>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Detalle por trabajador</p>
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-100 dark:border-gray-800">
              <th className="text-left py-2 pr-4">Nombre</th>
              <th className="text-right py-2 px-2">Salario real</th>
              <th className="text-right py-2 px-2">Descuentos</th>
              <th className="text-right py-2 px-2">Pago final</th>
              <th className="text-center py-2 px-2">Incidencias</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {payrollData.map(w => (
              <tr key={w.id}>
                <td className="py-3 pr-4">
                  <p className="font-medium text-gray-900 dark:text-white">{w.name}</p>
                  <p className="text-xs text-gray-400">Base: {formatMoney(w.base_salary)} · {w.weekly_hours}h/sem</p>
                </td>
                <td className="text-right px-2 text-gray-700 dark:text-gray-300">{formatMoney(w.realSalary)}</td>
                <td className="text-right px-2 text-red-500">{w.totalDiscounts > 0 ? `-${formatMoney(w.totalDiscounts)}` : '—'}</td>
                <td className="text-right px-2 font-bold text-gray-900 dark:text-white">{formatMoney(w.finalPay)}</td>
                <td className="text-center px-2 text-xs text-gray-500">{w.workerIncidents.length}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10">
              <td className="py-3 pr-4 font-bold text-red-700 dark:text-red-400">TOTAL PLANILLA</td>
              <td className="text-right px-2 font-bold text-red-700 dark:text-red-400">{formatMoney(totalBase)}</td>
              <td className="text-right px-2 font-bold text-red-500">-{formatMoney(totalDiscounts)}</td>
              <td className="text-right px-2 font-bold text-red-600 dark:text-red-400 text-base">{formatMoney(totalPayroll)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Desglose de incidencias */}
      {incidents.length > 0 && (
        <div className="card">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Desglose de descuentos por incidencia</p>
          <div className="space-y-4">
            {payrollData.filter(w => w.workerIncidents.length > 0).map(w => (
              <div key={w.id}>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">{w.name}</p>
                <div className="space-y-1 pl-3">
                  {w.workerIncidents.map(i => (
                    <div key={i.id} className="flex items-center gap-3 text-xs">
                      <span className="text-gray-500">{formatDate(i.date)}</span>
                      <span className="text-gray-600 dark:text-gray-400">{INCIDENT_LABELS[i.type]}</span>
                      {i.type === 'tardanza' && <span className="text-gray-400">{i.hours_late}h</span>}
                      {i.type === 'no_marcacion' && <span className="text-gray-400">{i.no_marcacion_count || 1} vez{(i.no_marcacion_count || 1) > 1 ? 'es' : ''} · S/ 5 c/u</span>}
                      {i.apply_discount
                        ? <Badge variant="rojo">-{formatMoney(i.discount_amount)}</Badge>
                        : <Badge variant="gray">Sin descuento</Badge>
                      }
                      {i.observation && <span className="text-gray-400 italic">{i.observation}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
