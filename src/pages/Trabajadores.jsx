import { useState, useMemo, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import {
  formatMoney, formatDate, calcRealSalary, calcDailySalary, calcProratedSalary,
  calcAbsenceDiscount, calcLatenessDiscount, calcOvertimePay, calcLeaveDiscount, calcHourlyRate, fmtHours, getRatioColor, currentMonthYear, monthName, todayISO
} from '../lib/utils'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Badge from '../components/ui/Badge'
import { Plus, Edit2, UserX, UserCheck, AlertCircle, Clock, Calendar, Download, FileSpreadsheet, Pencil, Check, X, Trash2, Users, Wallet, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const INCIDENT_ICONS = { falta: '🔴', permiso: '🟡', permiso_horas: '🟡', tardanza: '🟠', hora_extra: '🟢', no_marcacion: '🔵', multa: '🚫', adelanto: '💵' }
const INCIDENT_LABELS = { vacaciones: 'Vacaciones', falta: 'Falta injustificada', permiso: 'Permiso justificado', permiso_horas: 'Permiso por horas', tardanza: 'Tardanza', hora_extra: 'Hora extra', no_marcacion: 'No marcó entrada/salida', multa: 'Multa', adelanto: 'Adelanto de sueldo' }

function monthRangeStr(year, month) {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function WorkerForm({ initial, onSave, onClose, schedules = [] }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    base_salary: initial?.base_salary || '',
    weekly_hours: initial?.weekly_hours || 48,
    hire_date: initial?.hire_date || '',
    role: initial?.role || 'worker',
    schedule_id: initial?.schedule_id || '',
  })

  const realSalary = form.base_salary && form.weekly_hours
    ? calcRealSalary(parseFloat(form.base_salary), parseFloat(form.weekly_hours)) : 0

  async function handleSubmit(e) {
    e.preventDefault()
    await onSave({
      ...form,
      base_salary: form.base_salary !== '' ? parseFloat(form.base_salary) : 0,
      weekly_hours: parseFloat(form.weekly_hours),
      hire_date: form.hire_date || null,
      schedule_id: form.schedule_id || null,
    })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Nombre completo</label>
        <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ej: Juan Pérez" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Salario base (S/)</label>
          <input type="number" className="input" min="0" step="50" value={form.base_salary} onChange={e => setForm(f => ({ ...f, base_salary: e.target.value }))} placeholder="0 si no aplica" />
        </div>
        <div>
          <label className="label">Horas/semana</label>
          <input type="number" className="input" min="1" max="48" value={form.weekly_hours} onChange={e => setForm(f => ({ ...f, weekly_hours: e.target.value }))} required />
        </div>
      </div>
      {realSalary > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-orange-100 dark:border-red-900/30 rounded-lg p-3">
          <p className="text-xs text-red-600 dark:text-red-400">
            Salario real mensual: <strong>{formatMoney(realSalary)}</strong>
            {' '}· Salario diario: <strong>{formatMoney(realSalary / 26)}</strong>
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Fecha de ingreso</label>
          <input type="date" className="input" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} />
        </div>
        <div>
          <label className="label">Rol</label>
          <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            <option value="worker">Trabajador</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      {/* Horario */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
        <label className="label">Horario de trabajo</label>
        <select className="input" value={form.schedule_id} onChange={e => setForm(f => ({ ...f, schedule_id: e.target.value }))}>
          <option value="">Sin horario asignado</option>
          {schedules.map(s => (
            <option key={s.id} value={s.id}>{s.name}{s.is_default ? ' (predeterminado)' : ''} — {s.start_time?.slice(0,5)} a {s.end_time?.slice(0,5)}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary flex-1">{initial ? 'Guardar cambios' : 'Agregar trabajador'}</button>
      </div>
    </form>
  )
}

export function IncidentForm({ workers, onSave, onClose, initial, month, year, schedules = [] }) {
  // Incluir activos + cesados activos en el mes seleccionado
  const monthStart = (month != null && year != null) ? monthRangeStr(year, month) : null
  const activeWorkers = workers.filter(w => {
    if (w.active) return true
    if (!monthStart) return false
    return w.terminated_at && w.terminated_at >= monthStart
  })

  function splitHours(decimal) {
    const h = Math.floor(parseFloat(decimal) || 0)
    const m = Math.round(((parseFloat(decimal) || 0) - h) * 60)
    return { h: String(h), m: String(m) }
  }

  const initHours = initial?.hours_late ? splitHours(initial.hours_late) : { h: '', m: '0' }
  const [form, setForm] = useState({
    worker_id: initial?.worker_id || '',
    date: initial?.date || new Date().toISOString().slice(0, 10),
    end_date: initial?.end_date || '',
    type: initial?.type || 'falta',
    hours_h: initHours.h,
    hours_m: initHours.m,
    multa_amount: initial?.discount_amount && ['multa','adelanto','permiso'].includes(initial?.type) ? String(initial.discount_amount) : '',
    days: initial?.days ? String(initial.days) : '',
    vac_amount: initial?.type === 'vacaciones' && initial?.discount_amount ? String(initial.discount_amount) : '',
    no_marcacion_count: initial?.no_marcacion_count || 1,
    apply_discount: initial?.apply_discount !== false,
    observation: initial?.observation || '',
  })

  // Los horarios se cargan aquí y no se dependen del que invoca: este formulario
  // se abre desde tres pantallas distintas y solo una los pasaba, con lo que el
  // cálculo caía al reparto genérico de la semana entre 6 días.
  const [horarios, setHorarios] = useState(schedules)
  useEffect(() => {
    if (schedules.length) { setHorarios(schedules); return }
    supabase.from('work_schedules').select('*').then(({ data }) => setHorarios(data || []))
  }, [schedules])

  const worker = workers.find(w => w.id === form.worker_id)
  const isAddition = form.type === 'hora_extra' || form.type === 'vacaciones'
  // Ausencias de jornada completa: pueden abarcar varios días seguidos.
  const esRango = form.type === 'falta' || form.type === 'permiso'
  const horarioTrab = horarios.find(x => x.id === worker?.schedule_id)
  const tramoLibre = useMemo(() => {
    if (!worker || !esRango) return null
    return calcLeaveDiscount(worker.base_salary, worker.weekly_hours,
      form.date, form.end_date || form.date, horarioTrab?.weekday_hours)
  }, [worker, esRango, form.date, form.end_date, horarioTrab])
  const tarifaHora = worker ? calcHourlyRate(worker.base_salary, worker.weekly_hours) : 0
  const hoursDecimal = (parseInt(form.hours_h) || 0) + (parseInt(form.hours_m) || 0) / 60

  const previewDiscount = useMemo(() => {
    if (!worker || !form.apply_discount) return 0
    if (form.type === 'tardanza' || form.type === 'permiso_horas') return calcLatenessDiscount(worker.base_salary, worker.weekly_hours, hoursDecimal)
    if (form.type === 'hora_extra') return calcOvertimePay(worker.base_salary, worker.weekly_hours, hoursDecimal)
    if (form.type === 'no_marcacion') return 5 * (parseInt(form.no_marcacion_count) || 1)
    if (form.type === 'multa') return parseFloat(form.multa_amount) || 0
    // Falta y permiso se cobran por las horas de jornada de cada día del rango.
    if (esRango) return tramoLibre?.monto || 0
    // Vacaciones: se abona el importe legal (calculado fuera, sobre el promedio
    // de sueldos del año) y se descuentan los días no trabajados.
    if (form.type === 'vacaciones') return parseFloat(form.vac_amount) || 0
    return calcAbsenceDiscount(worker.base_salary, worker.weekly_hours)
  }, [worker, form, hoursDecimal])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.worker_id) { toast.error('Selecciona un trabajador'); return }
    if (form.type === 'multa' && !form.observation.trim()) { toast.error('La multa requiere una nota explicativa'); return }
    await onSave({
      worker_id: form.worker_id,
      date: form.date,
      type: form.type,
      hours_late: hoursDecimal,
      no_marcacion_count: parseInt(form.no_marcacion_count) || 1,
      end_date: esRango && form.end_date && form.end_date > form.date ? form.end_date : null,
      apply_discount: (form.type === 'multa' || form.type === 'adelanto') ? true : form.apply_discount,
      observation: form.observation,
      is_addition: isAddition,
      multa_amount: esRango ? (tramoLibre?.monto || 0)
        : (form.type === 'multa' || form.type === 'adelanto') ? parseFloat(form.multa_amount) || 0
        : form.type === 'vacaciones' ? parseFloat(form.vac_amount) || 0 : undefined,
      days: form.type === 'vacaciones' ? parseFloat(form.days) || 0 : undefined,
    })
    onClose()
  }

  const hasHours = form.type === 'tardanza' || form.type === 'permiso_horas' || form.type === 'hora_extra'
  const typeLabel = form.type === 'hora_extra' ? 'Horas extra' : form.type === 'permiso_horas' ? 'Horas de permiso' : 'Horas de tardanza'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Trabajador</label>
        <select className="input" value={form.worker_id} onChange={e => setForm(f => ({ ...f, worker_id: e.target.value }))} required>
          <option value="">Seleccionar...</option>
          {activeWorkers.map(w => <option key={w.id} value={w.id}>{w.name}{!w.active ? ' (cesado)' : ''}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">{esRango ? 'Desde' : 'Fecha'}</label>
          <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Tipo</label>
          <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="falta">🔴 Falta injustificada</option>
            <option value="permiso">🟡 Permiso justificado (día completo)</option>
            <option value="permiso_horas">🟡 Permiso por horas</option>
            <option value="tardanza">🟠 Tardanza</option>
            <option value="hora_extra">🟢 Hora extra</option>
            <option value="no_marcacion">🔵 No marcó entrada/salida</option>
            <option value="multa">🚫 Multa</option>
            <option value="adelanto">💵 Adelanto de sueldo</option>
          </select>
        </div>
      </div>
      {hasHours && (
        <div>
          <label className="label">{typeLabel}</label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number" className="input text-center" min="0" max="23" step="1"
                value={form.hours_h}
                onChange={e => setForm(f => ({ ...f, hours_h: e.target.value }))}
                placeholder="0" required
              />
              <span className="text-sm text-gray-500 shrink-0">h</span>
            </div>
            <div className="flex items-center gap-1 flex-1">
              <select className="input text-center" value={form.hours_m} onChange={e => setForm(f => ({ ...f, hours_m: e.target.value }))}>
                <option value="0">00</option>
                <option value="15">15</option>
                <option value="30">30</option>
                <option value="45">45</option>
              </select>
              <span className="text-sm text-gray-500 shrink-0">min</span>
            </div>
          </div>
        </div>
      )}
      {form.type === 'no_marcacion' && (
        <div>
          <label className="label">¿Cuántas veces no marcó?</label>
          <input
            type="number" className="input" min="1" max="20" step="1"
            value={form.no_marcacion_count}
            onChange={e => setForm(f => ({ ...f, no_marcacion_count: e.target.value }))}
            required
          />
          <p className="text-xs text-gray-400 mt-1">
            S/ 5.00 por cada marcación no realizada · Total: <strong className="text-red-400">S/ {(5 * (parseInt(form.no_marcacion_count) || 1)).toFixed(2)}</strong>
          </p>
        </div>
      )}
      {(form.type === 'multa' || form.type === 'adelanto') && (
        <div>
          <label className="label">
            {form.type === 'adelanto' ? 'Monto del adelanto (S/)' : form.type === 'permiso' ? 'Monto del descuento (S/)' : 'Monto de la multa (S/)'}
          </label>
          <input
            type="number" className="input" min="0" step="0.01"
            value={form.multa_amount}
            onChange={e => setForm(f => ({ ...f, multa_amount: e.target.value }))}
            placeholder="0.00" required
          />
        </div>
      )}
      {esRango && (
        <div className="space-y-2">
          <div>
            <label className="label">Hasta (dejar vacío si es un solo día)</label>
            <input type="date" className="input" value={form.end_date} min={form.date}
              onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
          </div>
          {tramoLibre && tramoLibre.dias.length > 0 && form.apply_discount && (
            <div className="rounded-lg p-3 text-xs bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
              <p className="text-[10px] text-gray-400 mb-1.5">
                Tarifa: {formatMoney(tarifaHora)} por hora
              </p>
              <div className="flex justify-between font-semibold text-gray-700 dark:text-gray-200 mb-1">
                <span>{tramoLibre.dias.length} día{tramoLibre.dias.length !== 1 ? 's' : ''} · {fmtHours(tramoLibre.horas)}</span>
                <span className="text-red-600 dark:text-red-400">−{formatMoney(tramoLibre.monto)}</span>
              </div>
              <div className="space-y-0.5 text-gray-500">
                {tramoLibre.dias.map(d => (
                  <div key={d.date} className="flex justify-between gap-2">
                    <span className="capitalize flex-1 truncate">
                      {new Date(`${d.date}T00:00:00`).toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'short' })}
                    </span>
                    <span className="shrink-0 w-16 text-right">{fmtHours(d.hours)}</span>
                    <span className="shrink-0 w-20 text-right text-red-500">
                      −{formatMoney(tarifaHora * d.hours)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 pt-1.5">
                Se cobran las horas de jornada de cada día; los días de descanso no cuentan.
              </p>
            </div>
          )}
        </div>
      )}
      {form.type === 'vacaciones' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Días de vacaciones</label>
              <input type="number" className="input" min="0" step="0.5" required
                value={form.days} placeholder="15"
                onChange={e => setForm(f => ({ ...f, days: e.target.value }))} />
            </div>
            <div>
              <label className="label">Monto a pagar (S/)</label>
              <input type="number" className="input" min="0" step="0.01" required
                value={form.vac_amount} placeholder="751.67"
                onChange={e => setForm(f => ({ ...f, vac_amount: e.target.value }))} />
            </div>
          </div>
          {worker && (() => {
            const dias = parseFloat(form.days) || 0
            const pago = parseFloat(form.vac_amount) || 0
            const diario = calcDailySalary(worker.base_salary, worker.weekly_hours)
            const noTrabajados = diario * dias
            return (
              <div className="rounded-lg p-3 text-xs bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 space-y-1">
                <div className="flex justify-between text-red-600 dark:text-red-400">
                  <span>{dias} día{dias !== 1 ? 's' : ''} no trabajados (S/{diario.toFixed(2)}/día)</span>
                  <span className="font-semibold">−{formatMoney(noTrabajados)}</span>
                </div>
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>Pago de vacaciones</span>
                  <span className="font-semibold">+{formatMoney(pago)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-blue-200 dark:border-blue-800 text-gray-700 dark:text-gray-200">
                  <span>Efecto neto en la nómina</span>
                  <span className="font-bold">{formatMoney(pago - noTrabajados)}</span>
                </div>
                <p className="text-[10px] text-gray-400 pt-0.5">
                  El monto se calcula fuera del sistema (promedio de sueldos del año) y se ingresa aquí.
                </p>
              </div>
            )
          })()}
        </div>
      )}
      {form.type !== 'multa' && form.type !== 'adelanto' && form.type !== 'vacaciones' && (
        <div className="flex items-center gap-2">
          <input type="checkbox" id="apply_discount" checked={form.apply_discount} onChange={e => setForm(f => ({ ...f, apply_discount: e.target.checked }))} />
          <label htmlFor="apply_discount" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">{isAddition ? 'Pagar en planilla' : 'Aplicar descuento'}</label>
        </div>
      )}
      {worker && (
        <div className={`rounded-lg p-3 text-xs ${!form.apply_discount && form.type !== 'multa' && form.type !== 'adelanto' ? 'bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700' : isAddition ? 'bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30' : 'bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30'}`}>
          <p className={!form.apply_discount && form.type !== 'multa' && form.type !== 'adelanto' ? 'text-gray-500' : isAddition ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
            {!form.apply_discount && form.type !== 'multa' && form.type !== 'adelanto'
              ? 'Sin efecto en planilla (solo registro)'
              : isAddition
                ? `Se suma a su pago: +${formatMoney(previewDiscount)}`
                : form.type === 'adelanto'
                  ? `Se descuenta del sueldo: -${formatMoney(previewDiscount)}`
                  : `Descuento: ${formatMoney(previewDiscount)}`}
          </p>
        </div>
      )}
      <div>
        <label className="label">
          {form.type === 'multa' ? <span>Motivo de la multa <span className="text-red-500">*</span></span> : 'Observación'}
        </label>
        <textarea
          className="input resize-none" rows={2}
          value={form.observation}
          onChange={e => setForm(f => ({ ...f, observation: e.target.value }))}
          placeholder={form.type === 'multa' ? 'Describe el motivo para que el trabajador lo entienda...' : 'Motivo o detalle...'}
          required={form.type === 'multa'}
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary flex-1">{initial ? 'Guardar' : 'Registrar incidencia'}</button>
      </div>
    </form>
  )
}

// Cuántos meses hacia adelante se puede navegar para programar sueldos y metas.
const MONTHS_AHEAD = 12

export default function Trabajadores() {
  const { workers, tickets, incidents, services, addWorker, updateWorker, addIncident, updateIncident, deleteIncident, addExpense,
          fetchWorkerMonthlyConfigs, saveWorkerMonthlyConfig,
          fetchCasualWorkers, addCasualWorker, fetchCasualPayments,
          addCasualPayment, deleteCasualPayment } = useApp()
  const { month: curMonth, year: curYear } = currentMonthYear()
  const [selMonth, setSelMonth] = useState(curMonth)
  const [selYear,  setSelYear]  = useState(curYear)
  const month = selMonth
  const year  = selYear
  const isCurrentMonth = selMonth === curMonth && selYear === curYear
  const isFutureMonth  = (selYear - curYear) * 12 + (selMonth - curMonth) > 0

  function prevMonthW() {
    if (selMonth === 1) { setSelMonth(12); setSelYear(y => y - 1) }
    else setSelMonth(m => m - 1)
  }
  function nextMonthW() {
    const nextM = selMonth === 12 ? 1 : selMonth + 1
    const nextY = selMonth === 12 ? selYear + 1 : selYear
    // Se permite avanzar hasta MONTHS_AHEAD meses para poder programar sueldos
    // y metas por adelantado; más allá de eso no hay nada que configurar.
    const monthsFromNow = (nextY - curYear) * 12 + (nextM - curMonth)
    if (monthsFromNow > MONTHS_AHEAD) return
    setSelMonth(nextM); setSelYear(nextY)
  }

  const [workerMonthlyConfigs, setWorkerMonthlyConfigs] = useState([])

  // ── Trabajadores eventuales (fuera de planilla) ──────────────────────────
  const [casualWorkers, setCasualWorkers]   = useState([])
  const [casualPayments, setCasualPayments] = useState([])
  const [casualForm, setCasualForm] = useState({ worker: '', nuevo: '', date: '', amount: '', concept: '' })
  const [savingCasual, setSavingCasual] = useState(false)

  useEffect(() => { fetchCasualWorkers().then(setCasualWorkers) }, [])
  // Los pagos son por mes: se recargan al cambiar de mes para que nunca se
  // arrastren los del mes anterior.
  useEffect(() => {
    fetchCasualPayments(selYear, selMonth).then(setCasualPayments)
  }, [selMonth, selYear])

  const totalCasual = casualPayments.reduce((s, p) => s + Number(p.amount || 0), 0)

  // ── Filtros del desglose de incidencias ──────────────────────────────────
  const [incFiltro, setIncFiltro] = useState({ worker: '', tipos: [], efecto: 'todos', texto: '' })
  const incFiltroActivo = !!incFiltro.worker || incFiltro.tipos.length > 0
    || incFiltro.efecto !== 'todos' || !!incFiltro.texto.trim()

  function limpiarFiltroInc() {
    setIncFiltro({ worker: '', tipos: [], efecto: 'todos', texto: '' })
  }

  function cumpleFiltro(i) {
    if (incFiltro.tipos.length && !incFiltro.tipos.includes(i.type)) return false
    if (incFiltro.efecto === 'descuento' && !(i.apply_discount && !i.is_addition)) return false
    if (incFiltro.efecto === 'suma'      && !(i.apply_discount && i.is_addition))  return false
    if (incFiltro.efecto === 'sin'       && i.apply_discount)                      return false
    const t = incFiltro.texto.trim().toLowerCase()
    if (t && !(`${i.observation || ''} ${INCIDENT_LABELS[i.type] || ''}`).toLowerCase().includes(t)) return false
    return true
  }


  async function handleAddCasualPayment() {
    const monto = parseFloat(casualForm.amount)
    if (!monto || monto <= 0) { toast.error('Indica el monto pagado'); return }
    const nombreNuevo = casualForm.nuevo.trim()
    if (!casualForm.worker && !nombreNuevo) { toast.error('Elige o escribe el nombre del eventual'); return }
    setSavingCasual(true)
    try {
      // Si escribió un nombre nuevo, se crea la persona para poder reutilizarla.
      let workerId = casualForm.worker
      if (nombreNuevo) {
        const creado = await addCasualWorker({ name: nombreNuevo })
        workerId = creado.id
        setCasualWorkers(ws => [...ws, creado].sort((a, b) => a.name.localeCompare(b.name)))
      }
      // Sin fecha explícita se usa el día 1 del mes que se está viendo, para que
      // el pago caiga en el mes correcto aunque se registre después.
      const fecha = casualForm.date || `${selYear}-${String(selMonth).padStart(2, '0')}-01`
      const pago = await addCasualPayment({
        casual_worker_id: workerId, date: fecha,
        amount: monto, concept: casualForm.concept,
      })
      // Solo se muestra si cae en el mes visible.
      if (pago.date >= `${selYear}-${String(selMonth).padStart(2, '0')}-01`) {
        setCasualPayments(ps => [...ps, pago].sort((a, b) => a.date.localeCompare(b.date)))
      }
      setCasualForm({ worker: '', nuevo: '', date: '', amount: '', concept: '' })
      toast.success('Pago registrado')
    } catch {
      toast.error('Error al registrar el pago')
    }
    setSavingCasual(false)
  }

  async function handleDeleteCasualPayment(id) {
    try {
      await deleteCasualPayment(id)
      setCasualPayments(ps => ps.filter(p => p.id !== id))
      toast.success('Pago eliminado')
    } catch { toast.error('Error al eliminar') }
  }
  const [pastMonthData, setPastMonthData] = useState(null) // { tickets, incidents } para meses anteriores

  useEffect(() => {
    fetchWorkerMonthlyConfigs(selYear, selMonth).then(setWorkerMonthlyConfigs)
  }, [selMonth, selYear])

  function loadPastMonth(sMonth, sYear, wks) {
    const prefix = `${sYear}-${String(sMonth).padStart(2, '0')}`
    const start = `${prefix}-01`
    const nextM = sMonth === 12 ? 1 : sMonth + 1
    const nextY = sMonth === 12 ? sYear + 1 : sYear
    const end   = `${nextY}-${String(nextM).padStart(2, '0')}-01`
    Promise.all([
      supabase.from('tickets').select('id,date,worker_id,price_charged,vehicle_type').gte('date', start).lt('date', end),
      supabase.from('attendance_incidents').select('*').gte('date', start).lt('date', end),
    ]).then(([{ data: t }, { data: i }]) => {
      const enriched = (i || []).map(inc => {
        const w = wks.find(x => x.id === inc.worker_id)
        if (!inc.apply_discount || !w) return { ...inc, discount_amount: inc.discount_amount || 0 }
        let discount = 0
        // Falta y permiso ya vienen calculados sobre el horario real del
        // trabajador (y pueden abarcar varios días): se respeta lo guardado.
        if (inc.type === 'falta' || inc.type === 'permiso')
          discount = inc.discount_amount ?? calcAbsenceDiscount(w.base_salary, w.weekly_hours)
        else if (inc.type === 'tardanza' || inc.type === 'permiso_horas') discount = calcLatenessDiscount(w.base_salary, w.weekly_hours, inc.hours_late || 0)
        else if (inc.type === 'hora_extra') discount = calcOvertimePay(w.base_salary, w.weekly_hours, inc.hours_late || 0)
        else if (inc.type === 'multa' || inc.type === 'adelanto') discount = inc.multa_amount || inc.discount_amount || 0
        else if (inc.type === 'no_marcacion') discount = 5 * (inc.no_marcacion_count || 1)
        return { ...inc, discount_amount: discount }
      })
      setPastMonthData({ tickets: t || [], incidents: enriched })
    })
  }

  useEffect(() => {
    if (isCurrentMonth) { setPastMonthData(null); return }
    loadPastMonth(selMonth, selYear, workers)
  }, [selMonth, selYear, isCurrentMonth, workers])

  // Hora real de entrada por trabajador y dia. En una tardanza lo primero que
  // se pregunta es a que hora llego, y eso solo esta en attendance_logs.
  const [arrivalByKey, setArrivalByKey] = useState({})
  useEffect(() => {
    const start = `${selYear}-${String(selMonth).padStart(2, '0')}-01`
    const nextM = selMonth === 12 ? 1 : selMonth + 1
    const nextY = selMonth === 12 ? selYear + 1 : selYear
    const end   = `${nextY}-${String(nextM).padStart(2, '0')}-01`
    supabase.from('attendance_logs').select('worker_id,date,logged_at')
      .eq('type', 'entrada').gte('date', start).lt('date', end)
      .then(({ data }) => {
        const map = {}
        for (const l of data || []) {
          const k = `${l.worker_id}|${l.date}`
          // Si marco varias veces, la primera es la que cuenta como llegada.
          if (!map[k] || new Date(l.logged_at) < new Date(map[k])) map[k] = l.logged_at
        }
        setArrivalByKey(map)
      })
  }, [selMonth, selYear])

  function arrivalTime(i) {
    const at = arrivalByKey[`${i.worker_id}|${i.date}`]
    return at ? new Date(at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : null
  }

  // Obtiene el salario efectivo de un trabajador para el mes seleccionado
  function getWorkerSalary(w) {
    const mc = workerMonthlyConfigs.find(c => c.worker_id === w.id)
    return { base_salary: mc?.base_salary ?? w.base_salary, weekly_hours: mc?.weekly_hours ?? w.weekly_hours }
  }

  // Usar datos del mes seleccionado (pasado o actual)
  const activeTickets   = isCurrentMonth ? tickets   : (pastMonthData?.tickets   || [])
  const activeIncidents = isCurrentMonth ? incidents : (pastMonthData?.incidents || [])

  const [activeTab, setActiveTab] = useState('equipo')
  const [pdfWorkerId, setPdfWorkerId] = useState('all') // 'all' | worker id

  const [schedules, setSchedules] = useState([])
  useEffect(() => {
    supabase.from('work_schedules').select('*').order('is_default', { ascending: false }).order('name')
      .then(({ data }) => setSchedules(data || []))
  }, [])

  // Equipo state
  const [showWorkerForm, setShowWorkerForm] = useState(false)
  const [showIncidentForm, setShowIncidentForm] = useState(false)
  const [editingWorker, setEditingWorker] = useState(null)
  const [editingIncident, setEditingIncident] = useState(null)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [terminationDate, setTerminationDate] = useState(todayISO())
  const [deleteIncidentTarget, setDeleteIncidentTarget] = useState(null)
  const [selectedWorker, setSelectedWorker] = useState(null)
  const [incFilter, setIncFilter] = useState({ worker: '', type: '', sort: 'date_desc' })
  const [incExpanded, setIncExpanded] = useState(false)

  // Nómina state
  const tableRef = useRef(null)
  const [editingNominaWorker, setEditingNominaWorker] = useState(null)
  const [editingNominaIncident, setEditingNominaIncident] = useState(null)
  const [incDraft, setIncDraft] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)

  function openEditIncident(inc) {
    setIncDraft({
      date: inc.date, type: inc.type, hours_late: inc.hours_late ?? 0,
      no_marcacion_count: inc.no_marcacion_count ?? 1,
      multa_amount: inc.multa_amount ?? inc.discount_amount ?? 0,
      observation: inc.observation ?? '', apply_discount: inc.apply_discount ?? true,
      is_addition: inc.is_addition ?? (inc.type === 'hora_extra'),
      worker_id: inc.worker_id,
    })
    setEditingNominaIncident(inc)
  }

  async function saveNominaIncident() {
    if (!isCurrentMonth) {
      setPastMonthData(prev => prev ? {
        ...prev,
        incidents: prev.incidents.map(i => i.id === editingNominaIncident.id ? { ...i, ...incDraft } : i)
      } : prev)
    }
    try {
      await updateIncident(editingNominaIncident.id, incDraft)
      toast.success('Incidencia actualizada')
      setEditingNominaIncident(null)
      if (!isCurrentMonth) loadPastMonth(selMonth, selYear, workers)
    } catch {
      toast.error('Error al guardar')
      if (!isCurrentMonth) loadPastMonth(selMonth, selYear, workers)
    }
  }

  async function handleSaveNominaWorker() {
    try {
      const base_salary  = parseFloat(editingNominaWorker.base_salary)
      const weekly_hours = parseFloat(editingNominaWorker.weekly_hours)
      // Si es mes actual y no hay config mensual previa, actualiza el trabajador globalmente
      // Si hay config mensual o es mes pasado, guarda solo en worker_monthly_config
      await saveWorkerMonthlyConfig({ worker_id: editingNominaWorker.id, year: selYear, month: selMonth, base_salary, weekly_hours })
      if (isCurrentMonth) await updateWorker(editingNominaWorker.id, { base_salary, weekly_hours })
      setWorkerMonthlyConfigs(prev => {
        const filtered = prev.filter(c => c.worker_id !== editingNominaWorker.id)
        return [...filtered, { worker_id: editingNominaWorker.id, year: selYear, month: selMonth, base_salary, weekly_hours }]
      })
      toast.success(`Salario de ${monthName(selMonth)} ${selYear} actualizado`)
      setEditingNominaWorker(null)
    } catch { toast.error('Error al guardar') }
  }

  async function doDeleteIncident(id) {
    if (!isCurrentMonth) {
      setPastMonthData(prev => prev ? { ...prev, incidents: prev.incidents.filter(i => i.id !== id) } : prev)
    }
    try {
      await deleteIncident(id)
      toast.success('Incidencia eliminada')
      setConfirmDelete(null)
      if (!isCurrentMonth) loadPastMonth(selMonth, selYear, workers)
    } catch {
      toast.error('Error al eliminar')
      if (!isCurrentMonth) loadPastMonth(selMonth, selYear, workers)
    }
  }

  const monthStart = monthRangeStr(year, month)

  function leftThisMonth(w) {
    return !w.active && w.terminated_at && w.terminated_at >= monthStart
  }

  const workerStats = useMemo(() => {
    return workers
      .filter(w => w.active || leftThisMonth(w))
      .map(w => {
        const { base_salary, weekly_hours } = getWorkerSalary(w)
        const realSalary = leftThisMonth(w)
          ? calcProratedSalary(base_salary, weekly_hours, year, month, w.terminated_at, w.hire_date)
          : calcRealSalary(base_salary, weekly_hours)
        const workerTickets = activeTickets.filter(t => t.worker_id === w.id)
        const income = workerTickets.reduce((s, t) => s + t.price_charged, 0)
        const cars = workerTickets.length
        const workerIncidents = activeIncidents.filter(i => i.worker_id === w.id)
        const totalDiscounts = workerIncidents.filter(i => i.apply_discount && !i.is_addition).reduce((s, i) => s + (i.discount_amount || 0), 0)
        const totalOvertime  = workerIncidents.filter(i => i.apply_discount && i.is_addition).reduce((s, i) => s + (i.discount_amount || 0), 0)
        // Vacaciones: los días no trabajados se descuentan del sueldo. El pago
        // de la vacación ya entra por totalOvertime (is_addition).
        const diasVac = workerIncidents.filter(i => i.type === 'vacaciones').reduce((s, i) => s + (i.days || 0), 0)
        const descVac = diasVac * calcDailySalary(base_salary, weekly_hours)
        const finalPay = realSalary - totalDiscounts - descVac + totalOvertime
        const ratio = realSalary > 0 ? income / realSalary : 0
        const daysInMonth = new Date(year, month, 0).getDate()
        const avgDaily = income / daysInMonth
        const avgPerCar = cars > 0 ? income / cars : 0

        // base_salary/weekly_hours después del spread: el sueldo mostrado debe ser
        // el del mes seleccionado, no el vigente en la tabla `workers`.
        return { ...w, base_salary, weekly_hours, realSalary, income, cars, workerIncidents, totalDiscounts, totalOvertime, finalPay, ratio, avgDaily, avgPerCar }
      })
  }, [workers, activeTickets, activeIncidents, month, year, workerMonthlyConfigs])

  const chartData = workerStats.filter(w => w.active).map(w => ({ name: w.name, income: w.income, salario: w.realSalary }))

  async function handleSaveWorker(data) {
    try {
      if (editingWorker) {
        await updateWorker(editingWorker.id, data)
        toast.success('Trabajador actualizado')
        setEditingWorker(null)
      } else {
        const newWorker = await addWorker(data)
        toast.success('Trabajador agregado')
        setEditingWorker(null)
        setShowWorkerForm(false)
        // Ofrecer agregar incidencia al nuevo trabajador
        if (newWorker?.id) {
          setEditingIncident({ worker_id: newWorker.id })
          setShowIncidentForm(true)
        }
      }
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  async function handleToggleActive(worker) {
    try {
      if (worker.active) {
        await updateWorker(worker.id, { active: false, terminated_at: terminationDate })
        toast.success('Trabajador dado de baja')
      } else {
        await updateWorker(worker.id, { active: true, terminated_at: null })
        toast.success('Trabajador reactivado')
      }
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  async function handleSaveIncident(data) {
    try {
      if (editingIncident) {
        await updateIncident(editingIncident.id, data)
        toast.success('Incidencia actualizada')
      } else {
        await addIncident(data)
        if (data.type === 'adelanto') {
          const worker = workers.find(w => w.id === data.worker_id)
          await addExpense({
            date: data.date,
            category: 'adelanto',
            description: `Adelanto — ${worker?.name || ''}${data.observation ? ': ' + data.observation : ''}`,
            amount: parseFloat(data.multa_amount) || 0,
            worker_id: data.worker_id,
          })
        }
        toast.success('Incidencia registrada')
      }
      setEditingIncident(null)
      if (!isCurrentMonth) loadPastMonth(selMonth, selYear, workers)
    } catch (err) {
      toast.error('Error: ' + err.message)
    }
  }

  async function handleDeleteIncident(id) {
    // Optimistic: remove immediately from local view
    if (!isCurrentMonth) {
      setPastMonthData(prev => prev ? { ...prev, incidents: prev.incidents.filter(i => i.id !== id) } : prev)
    }
    try {
      await deleteIncident(id)
      toast.success('Incidencia eliminada')
      if (!isCurrentMonth) loadPastMonth(selMonth, selYear, workers)
    } catch (err) {
      toast.error('Error al eliminar')
      if (!isCurrentMonth) loadPastMonth(selMonth, selYear, workers) // revert
    }
  }

  const ratioColor = { verde: 'verde', amarillo: 'amarillo', rojo: 'rojo' }

  // Nómina data
  const payrollData = useMemo(() => {
    return workers
      .filter(w => w.active || leftThisMonth(w))
      .map(w => {
        // Sueldo del mes seleccionado, no el vigente en la tabla `workers`: si no,
        // la nómina de un mes cerrado cambiaría al ajustar un salario.
        const { base_salary, weekly_hours } = getWorkerSalary(w)
        const realSalary = leftThisMonth(w)
          ? calcProratedSalary(base_salary, weekly_hours, year, month, w.terminated_at, w.hire_date)
          : calcRealSalary(base_salary, weekly_hours)
        const workerIncidents = activeIncidents.filter(i => i.worker_id === w.id)
        const totalDiscounts = workerIncidents.filter(i => i.apply_discount && !i.is_addition).reduce((s, i) => s + (i.discount_amount || 0), 0)
        const totalOvertime  = workerIncidents.filter(i => i.apply_discount && i.is_addition).reduce((s, i) => s + (i.discount_amount || 0), 0)
        // Vacaciones: los días no trabajados se descuentan del sueldo. El pago
        // de la vacación ya entra por totalOvertime (is_addition).
        const diasVac = workerIncidents.filter(i => i.type === 'vacaciones').reduce((s, i) => s + (i.days || 0), 0)
        const descVac = diasVac * calcDailySalary(base_salary, weekly_hours)
        const finalPay = realSalary - totalDiscounts - descVac + totalOvertime
        // base_salary/weekly_hours van después del spread para que la fila y el
        // editor muestren el sueldo del mes y no el global.
        return { ...w, base_salary, weekly_hours, realSalary, workerIncidents, totalDiscounts, totalOvertime, finalPay }
      })
  }, [workers, activeIncidents, month, year, workerMonthlyConfigs])

  // Filas ya filtradas, por trabajador, más los totales de lo que quedó a la
  // vista: sin ese resumen el filtro sirve para buscar pero no para decidir.
  const incidenciasFiltradas = useMemo(() => {
    const grupos = payrollData
      .filter(w => !incFiltro.worker || w.id === incFiltro.worker)
      .map(w => ({ ...w, filtradas: w.workerIncidents.filter(cumpleFiltro) }))
      .filter(w => w.filtradas.length > 0)
    const todas = grupos.flatMap(g => g.filtradas)
    return {
      grupos,
      cantidad: todas.length,
      descuentos: todas.filter(i => i.apply_discount && !i.is_addition).reduce((s, i) => s + (i.discount_amount || 0), 0),
      sumas:      todas.filter(i => i.apply_discount &&  i.is_addition).reduce((s, i) => s + (i.discount_amount || 0), 0),
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payrollData, incFiltro])

  // Solo se ofrecen los tipos que existen este mes, para no llenar de opciones vacías.
  const tiposPresentes = useMemo(() => {
    const set = new Set(payrollData.flatMap(w => w.workerIncidents.map(i => i.type)))
    return Object.keys(INCIDENT_LABELS).filter(t => set.has(t))
  }, [payrollData])

  const totalPayroll   = payrollData.reduce((s, w) => s + w.finalPay, 0)
  const totalNominaDisc = payrollData.reduce((s, w) => s + w.totalDiscounts, 0)
  const totalNominaOvt  = payrollData.reduce((s, w) => s + w.totalOvertime, 0)
  const totalBase      = payrollData.reduce((s, w) => s + w.realSalary, 0)

  function exportExcel() {
    import('xlsx').then(XLSX => {
      const rows = payrollData.map(w => ({
        'Nombre': w.name, 'Horas/Semana': w.weekly_hours, 'Salario Base': w.base_salary,
        'Salario Real Mensual': w.realSalary.toFixed(2), 'Descuentos': w.totalDiscounts.toFixed(2),
        'Hora Extra': w.totalOvertime.toFixed(2), 'Pago Final': w.finalPay.toFixed(2),
      }))
      rows.push({ 'Nombre': 'TOTAL', 'Horas/Semana': '', 'Salario Base': '',
        'Salario Real Mensual': totalBase.toFixed(2), 'Descuentos': totalNominaDisc.toFixed(2),
        'Hora Extra': totalNominaOvt.toFixed(2), 'Pago Final': totalPayroll.toFixed(2) })
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Nómina')
      XLSX.writeFile(wb, `nomina-apexpro-${year}-${String(month).padStart(2,'0')}.xlsx`)
      toast.success('Excel exportado')
    }).catch(() => toast.error('Error al exportar'))
  }

  function exportPDF() {
    // Carga logo con proporción real
    const loadLogo = () => new Promise(resolve => {
      fetch('/logo-cuadrado-claro.jpg').then(r => r.blob()).then(blob => {
        const reader = new FileReader()
        reader.onload = e => {
          const img = new Image()
          img.onload = () => resolve({ data: e.target.result, w: img.naturalWidth, h: img.naturalHeight })
          img.onerror = () => resolve(null)
          img.src = e.target.result
        }
        reader.readAsDataURL(blob)
      }).catch(() => resolve(null))
    })

    Promise.all([import('jspdf'), loadLogo()]).then(([{ jsPDF }, logoData]) => {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const PW = 210
      const mL = 14, mR = 14
      const W = PW - mL - mR
      const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
      const lastDay = new Date(year, month, 0).getDate()
      const periodoFrom = `01/${String(month).padStart(2,'0')}/${year}`
      const periodoTo   = `${lastDay}/${String(month).padStart(2,'0')}/${year}`

      const drawBoleta = (w, isFirst) => {
        if (!isFirst) doc.addPage()
        let y = 12

        // ── Logo (proporción real, altura fija 16mm) ──────
        if (logoData) {
          const logoH = 24
          const logoW = logoH * (logoData.w / logoData.h)
          doc.addImage(logoData.data, 'JPEG', mL, y, logoW, logoH)
        }

        // ── Título centrado ───────────────────────────────
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.text('BOLETA DE PAGO', PW / 2, y + 7, { align: 'center' })
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(`Del   ${periodoFrom}   Al   ${periodoTo}`, PW / 2, y + 13, { align: 'center' })
        y += 22

        // ── Empresa ───────────────────────────────────────
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
        doc.text('APEX PRO DETAILING', mL, y)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
        doc.text('Dirección: Calle Idelfonzo Lopez N 700 Zamacola, Arequipa', mL, y + 5)
        doc.text('RUC: 20614041669', mL, y + 9.5)
        y += 16

        doc.setDrawColor(0); doc.setLineWidth(0.4)
        doc.line(mL, y, PW - mR, y)
        y += 5

        // ── Datos del trabajador ──────────────────────────
        const col2 = mL + W / 2
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal')

        // Conteos de incidencias (unificados)
        const faltas  = w.workerIncidents.filter(i => ['falta','permiso_justificado','permiso'].includes(i.type)).length
        const tardanz = w.workerIncidents.filter(i => ['tardanza','permiso_horas'].includes(i.type)).length
        // Las horas extra solo se pagan si la incidencia tiene apply_discount.
        // Anunciar el total registrado junto al importe de las pagadas hacía que
        // la boleta declarara muchas más horas de las que realmente se abonan.
        const horasExtra = (pagadas) => w.workerIncidents
          .filter(i => i.type === 'hora_extra' && !!i.apply_discount === pagadas)
          .reduce((s, i) => s + (i.hours_late || 0), 0)
        const hrsExt      = horasExtra(true)   // se pagan
        const hrsExtNoPag = horasExtra(false)  // registradas, sin pago

        const infoRows = [
          [`CÓDIGO:  ${String(w.id).slice(0,8).toUpperCase()}`,   `NOMBRE:  ${w.name.toUpperCase().trim()}`],
          [`HABER BÁSICO:  S/ ${Number(w.base_salary||0).toFixed(2)}`, `CARGO:  Técnico`],
          [`FALTAS:  ${faltas}`,                                   `TARDANZAS:  ${tardanz}`],
          [`HRS. EXTRA PAGADAS:  ${hrsExt.toFixed(1)}`,           `PERÍODO:  ${MONTHS_ES[month-1]} ${year}`],
          ...(hrsExtNoPag > 0
            ? [[`HRS. EXTRA NO PAGADAS:  ${hrsExtNoPag.toFixed(1)}`, '']]
            : []),
        ]
        infoRows.forEach(([left, right]) => {
          doc.text(left, mL, y); doc.text(right, col2, y); y += 5
        })

        y += 3
        doc.line(mL, y, PW - mR, y)
        y += 6

        // ── Tablas REMUNERACIONES | DESCUENTOS ────────────
        const cW = (W - 4) / 2
        const cDx = mL + cW + 4

        doc.setFillColor(220, 220, 220)
        doc.rect(mL, y - 4, cW, 6, 'F')
        doc.rect(cDx, y - 4, cW, 6, 'F')
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
        doc.text('REMUNERACIONES', mL + cW / 2, y, { align: 'center' })
        doc.text('DESCUENTOS', cDx + cW / 2, y, { align: 'center' })
        y += 6

        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)

        // Remuneraciones: haber base + salario real + horas extra
        const remRows = [['Haber básico', w.base_salary], ['Salario real (mes)', w.realSalary]]
        if (w.totalOvertime > 0) remRows.push([`Hrs. extra (${hrsExt.toFixed(1)}h)`, w.totalOvertime])

        // Descuentos: agrupados en categorías simplificadas
        const discMap = {}
        w.workerIncidents.forEach(i => {
          if (!i.apply_discount || i.is_addition) return
          const amt = i.discount_amount || 0
          let lbl
          if (['falta','permiso_justificado','permiso'].includes(i.type)) lbl = 'Falta'
          else if (['tardanza','permiso_horas'].includes(i.type))  lbl = 'Tardanza'
          else if (i.type === 'multa')        lbl = 'Multa'
          else if (i.type === 'adelanto')     lbl = 'Adelanto'
          else if (i.type === 'no_marcacion') lbl = 'No marcación'
          else lbl = i.type
          discMap[lbl] = (discMap[lbl] || 0) + amt
        })
        const discRows = Object.entries(discMap)

        const rowH = 5.5
        const maxRows = Math.max(remRows.length, discRows.length, 1)

        remRows.forEach(([lbl, val], idx) => {
          doc.text(lbl, mL + 2, y + idx * rowH)
          doc.text(`S/ ${Number(val).toFixed(2)}`, mL + cW - 2, y + idx * rowH, { align: 'right' })
        })
        if (discRows.length === 0) {
          doc.setTextColor(160, 160, 160)
          doc.text('Sin descuentos', cDx + cW / 2, y, { align: 'center' })
          doc.setTextColor(0, 0, 0)
        } else {
          discRows.forEach(([lbl, val], idx) => {
            doc.text(lbl, cDx + 2, y + idx * rowH)
            doc.text(`-S/ ${Number(val).toFixed(2)}`, cDx + cW - 2, y + idx * rowH, { align: 'right' })
          })
        }
        y += maxRows * rowH + 4

        // ── Línea totales ─────────────────────────────────
        doc.setLineWidth(0.5)
        doc.line(mL, y, PW - mR, y); y += 5

        doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
        const totalRem = w.realSalary + w.totalOvertime
        doc.text('TOTAL REMUNERACIÓN', mL + 2, y)
        doc.text(`S/ ${totalRem.toFixed(2)}`, mL + cW - 2, y, { align: 'right' })
        doc.text('TOTAL DESCUENTOS', cDx + 2, y)
        doc.text(`S/ ${w.totalDiscounts.toFixed(2)}`, cDx + cW - 2, y, { align: 'right' })

        y += 4; doc.line(mL, y, PW - mR, y); y += 8

        // ── Neto a pagar ──────────────────────────────────
        doc.setFillColor(245, 245, 245)
        doc.rect(mL, y - 5, W, 9, 'F')
        doc.setFontSize(10); doc.setFont('helvetica', 'bold')
        doc.text('NETO A PAGAR:', mL + 4, y + 1)
        doc.setFontSize(12)
        doc.text(`S/ ${w.finalPay.toFixed(2)}`, PW - mR - 4, y + 1, { align: 'right' })

        y += 20
        // ── Fecha y firma ─────────────────────────────────
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
        doc.text(`Arequipa, ${lastDay} de ${MONTHS_ES[month-1]} de ${year}`, mL, y)

        y += 20
        doc.line(PW / 2 - 30, y, PW / 2 + 30, y)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
        doc.text('EMPLEADOR', PW / 2, y + 4, { align: 'center' })
      }

      const toExport = pdfWorkerId === 'all' ? payrollData : payrollData.filter(w => w.id === pdfWorkerId)
      toExport.forEach((w, i) => drawBoleta(w, i === 0))
      doc.save(`boletas-apexpro-${year}-${String(month).padStart(2,'0')}.pdf`)
      toast.success('Boletas exportadas')
    }).catch(e => { console.error(e); toast.error('Error al exportar') })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Equipo & Nómina</h1>
          <div className="flex items-center gap-1 mt-0.5">
            <button onClick={prevMonthW} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronLeft className="w-3.5 h-3.5 text-gray-400" /></button>
            <span className="text-sm text-gray-500 capitalize">{monthName(month)} {year}</span>
            <button onClick={nextMonthW} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronRight className="w-3.5 h-3.5 text-gray-400" /></button>
            {!isCurrentMonth && (
              <span className="text-[10px] font-semibold text-amber-500 ml-1">
                {isFutureMonth ? 'programando mes futuro' : 'mes anterior'}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {activeTab === 'equipo' ? (<>
            <button className="btn-secondary text-sm flex items-center gap-1" onClick={() => { setEditingIncident(null); setShowIncidentForm(true) }}>
              <AlertCircle className="w-4 h-4" /> Incidencia
            </button>
            <button className="btn-primary text-sm flex items-center gap-1" onClick={() => { setEditingWorker(null); setShowWorkerForm(true) }}>
              <Plus className="w-4 h-4" /> Trabajador
            </button>
          </>) : (<>
            <select
              value={pdfWorkerId}
              onChange={e => setPdfWorkerId(e.target.value)}
              className="text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">
              <option value="all">Todos los trabajadores</option>
              {payrollData.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <button className="btn-secondary text-sm flex items-center gap-1" onClick={exportPDF}>
              <Download className="w-4 h-4" /> PDF
            </button>
            <button className="btn-secondary text-sm flex items-center gap-1" onClick={exportExcel}>
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </button>
          </>)}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {[{ id: 'equipo', label: 'Equipo', Icon: Users }, { id: 'nomina', label: 'Nómina', Icon: Wallet }].map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'equipo' && (<>

      {/* Tabla comparativa */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-100 dark:border-gray-800">
              <th className="text-left py-2 pr-4">Trabajador</th>
              <th className="text-right py-2 px-2">Ingresos</th>
              <th className="text-right py-2 px-2">Carros</th>
              <th className="text-right py-2 px-2">Prom/día</th>
              <th className="text-right py-2 px-2">Salario real</th>
              <th className="text-right py-2 px-2">Descuentos</th>
              <th className="text-right py-2 px-2">Extra</th>
              <th className="text-right py-2 px-2">Pago final</th>
              <th className="text-center py-2 px-2">Ratio</th>
              <th className="text-center py-2 px-2">Incidencias</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {workerStats.map(w => {
              const rc = getRatioColor(w.ratio)
              return (
                <tr key={w.id} className={`${!w.active ? 'opacity-50' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/50`}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 font-bold text-xs">
                        {w.name[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{w.name}</p>
                        <p className="text-xs text-gray-400">
                          {w.weekly_hours}h/sem
                          {leftThisMonth(w) && <span className="text-amber-500"> · Se retiró el {formatDate(w.terminated_at)}</span>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-2 font-semibold text-gray-900 dark:text-white">{formatMoney(w.income)}</td>
                  <td className="text-right px-2 text-gray-600 dark:text-gray-400">{w.cars}</td>
                  <td className="text-right px-2 text-gray-600 dark:text-gray-400">{formatMoney(w.avgDaily)}</td>
                  <td className="text-right px-2 text-gray-600 dark:text-gray-400">{formatMoney(w.realSalary)}</td>
                  <td className="text-right px-2 text-red-500">{w.totalDiscounts > 0 ? `-${formatMoney(w.totalDiscounts)}` : '—'}</td>
                  <td className="text-right px-2 text-green-600">{w.totalOvertime > 0 ? `+${formatMoney(w.totalOvertime)}` : '—'}</td>
                  <td className="text-right px-2 font-semibold text-gray-900 dark:text-white">{formatMoney(w.finalPay)}</td>
                  <td className="text-center px-2">
                    <Badge variant={ratioColor[rc]}>{w.ratio.toFixed(1)}x</Badge>
                  </td>
                  <td className="text-center px-2">
                    {w.workerIncidents.length === 0 ? (
                      <span className="text-xs text-gray-300">—</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">
                        {w.workerIncidents.length}
                      </span>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditingWorker(w); setShowWorkerForm(true) }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                        <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                      <button onClick={() => { setTerminationDate(todayISO()); setDeactivateTarget(w) }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                        {w.active ? <UserX className="w-3.5 h-3.5 text-gray-400" /> : <UserCheck className="w-3.5 h-3.5 text-green-500" />}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Gráfico comparativo */}
      {chartData.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-bold text-gray-900 dark:text-white">Ingresos generados vs salario real</p>
          </div>
          <p className="text-xs text-gray-400 mb-4">Comparación por trabajador activo este mes</p>
          <div className="overflow-x-auto -mx-4 px-4">
            <div style={{ minWidth: Math.max(chartData.length * 100, 320) }} className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }} barCategoryGap="30%" barGap={4}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
                      <stop offset="100%" stopColor="#ea580c" stopOpacity={0.9} />
                    </linearGradient>
                    <linearGradient id="salarioGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.75} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => v >= 1000 ? `S/${(v/1000).toFixed(1)}k` : `S/${v}`} axisLine={false} tickLine={false} width={52} />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 6 }}
                    contentStyle={{ borderRadius: 14, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', fontSize: 12, padding: '10px 16px' }}
                    formatter={(v, name) => [formatMoney(v), name]}
                    labelStyle={{ fontWeight: 700, marginBottom: 4, color: '#111827' }}
                  />
                  <Legend
                    iconType="circle" iconSize={8}
                    formatter={v => <span style={{ fontSize: 11, color: '#6b7280' }}>{v}</span>}
                    wrapperStyle={{ paddingTop: 12 }}
                  />
                  <Bar dataKey="income" fill="url(#incomeGrad)" radius={[6, 6, 2, 2]} maxBarSize={36} name="Ingresos generados" />
                  <Bar dataKey="salario" fill="url(#salarioGrad)" radius={[6, 6, 2, 2]} maxBarSize={36} name="Salario real" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Lista de incidencias del mes */}
      {activeIncidents.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-0">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-1">
              Incidencias del mes
              <span className="ml-2 text-xs font-normal text-gray-400">{activeIncidents.length} total</span>
            </p>
            {incExpanded && (incFilter.worker || incFilter.type || incFilter.sort !== 'date_desc') && (
              <button onClick={() => setIncFilter({ worker: '', type: '', sort: 'date_desc' })}
                className="text-xs text-red-500 hover:underline">Limpiar</button>
            )}
            <button onClick={() => setIncExpanded(v => !v)}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${incExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              {incExpanded ? 'Ocultar' : 'Ver más'}
            </button>
          </div>

          {/* Resumen compacto cuando está cerrado */}
          {!incExpanded && (
            <div className="flex flex-wrap gap-2 mt-2">
              {['falta','tardanza','adelanto','multa','hora_extra','vacaciones','permiso','permiso_horas','no_marcacion'].map(type => {
                const count = activeIncidents.filter(i => i.type === type).length
                if (!count) return null
                return (
                  <span key={type} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                    {INCIDENT_ICONS[type]} {INCIDENT_LABELS[type].split(' ')[0]}: <span className="font-semibold">{count}</span>
                  </span>
                )
              })}
            </div>
          )}

          {incExpanded && (<>
          {/* Filtros */}
          <div className="flex flex-wrap gap-2 mt-3 mb-4">
            <select value={incFilter.worker} onChange={e => setIncFilter(f => ({ ...f, worker: e.target.value }))}
              className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-red-500">
              <option value="">Todos los trabajadores</option>
              {workers.filter(w => activeIncidents.some(i => i.worker_id === w.id)).map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>

            <select value={incFilter.type} onChange={e => setIncFilter(f => ({ ...f, type: e.target.value }))}
              className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-red-500">
              <option value="">Todos los tipos</option>
              {[...new Set(activeIncidents.map(i => i.type))].map(t => (
                <option key={t} value={t}>{INCIDENT_LABELS[t]}</option>
              ))}
            </select>

            <select value={incFilter.sort} onChange={e => setIncFilter(f => ({ ...f, sort: e.target.value }))}
              className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-red-500">
              <option value="date_desc">Más reciente primero</option>
              <option value="date_asc">Más antiguo primero</option>
              <option value="worker">Por trabajador</option>
              <option value="amount_desc">Mayor monto primero</option>
              <option value="amount_asc">Menor monto primero</option>
            </select>
          </div>

          <div className="space-y-2 pb-20 lg:pb-0">
            {[...incidents]
              .filter(i => (!incFilter.worker || i.worker_id === incFilter.worker) && (!incFilter.type || i.type === incFilter.type))
              .sort((a, b) => {
                if (incFilter.sort === 'date_asc')    return a.date.localeCompare(b.date)
                if (incFilter.sort === 'date_desc')   return b.date.localeCompare(a.date)
                if (incFilter.sort === 'worker')      return (workers.find(w => w.id === a.worker_id)?.name || '').localeCompare(workers.find(w => w.id === b.worker_id)?.name || '')
                if (incFilter.sort === 'amount_desc') return (b.discount_amount || 0) - (a.discount_amount || 0)
                if (incFilter.sort === 'amount_asc')  return (a.discount_amount || 0) - (b.discount_amount || 0)
                return 0
              })
              .map(incident => {
              const worker = workers.find(w => w.id === incident.worker_id)
              return (
                <div key={incident.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <span className="text-lg">{INCIDENT_ICONS[incident.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{worker?.name} — {INCIDENT_LABELS[incident.type]}</p>
                    <p className="text-xs text-gray-500">{formatDate(incident.date)}{incident.end_date ? ` al ${formatDate(incident.end_date)}` : ''}{incident.hours_late ? ` · ${Math.floor(incident.hours_late)}h ${Math.round((incident.hours_late % 1) * 60)}min` : ''}</p>
                    {incident.observation && <p className="text-xs text-gray-400 italic mt-0.5">{incident.observation}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {incident.apply_discount
                      ? <span className={`text-xs font-semibold ${incident.is_addition ? 'text-green-600' : 'text-red-500'}`}>{incident.is_addition ? '+' : '-'}{formatMoney(incident.discount_amount)}</span>
                      : <Badge variant="gray">Sin efecto</Badge>
                    }
                    <button onClick={() => { setEditingIncident(incident); setShowIncidentForm(true) }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                      <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button onClick={() => setDeleteIncidentTarget(incident.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                      <Clock className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          </>)}
        </div>
      )}

      </>)}

      {activeTab === 'nomina' && (
        <div className="space-y-6">
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center">
              <p className="text-xs text-gray-500 mb-1">Planilla base</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{formatMoney(totalBase)}</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-gray-500 mb-1">Total descuentos</p>
              <p className="text-xl font-bold text-red-500">-{formatMoney(totalNominaDisc)}</p>
            </div>
            <div className="card text-center border-2 border-red-200 dark:border-red-900">
              <p className="text-xs text-red-600 dark:text-red-400 mb-1 font-medium">Total a pagar</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatMoney(totalPayroll + totalCasual)}</p>
              {totalCasual > 0 && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  incluye {formatMoney(totalCasual)} de eventuales
                </p>
              )}
            </div>
          </div>

          {/* Tabla nómina */}
          <div className="card overflow-x-auto" ref={tableRef}>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Detalle por trabajador</p>
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-2 pr-4">Nombre</th>
                  <th className="text-right py-2 px-2">Salario real</th>
                  <th className="text-right py-2 px-2">Descuentos</th>
                  <th className="text-right py-2 px-2">Hora extra</th>
                  <th className="text-right py-2 px-2">Pago final</th>
                  <th className="text-center py-2 px-2">Incidencias</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {payrollData.map(w => {
                  const isEditing = editingNominaWorker?.id === w.id
                  return (
                    <tr key={w.id}>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-gray-900 dark:text-white">{w.name}</p>
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-400">S/</span>
                              <input type="number" value={editingNominaWorker.base_salary}
                                onChange={e => setEditingNominaWorker(f => ({ ...f, base_salary: e.target.value }))}
                                className="w-20 text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-1.5 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                            </div>
                            <div className="flex items-center gap-1">
                              <input type="number" value={editingNominaWorker.weekly_hours}
                                onChange={e => setEditingNominaWorker(f => ({ ...f, weekly_hours: e.target.value }))}
                                className="w-12 text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-1.5 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                              <span className="text-xs text-gray-400">h/sem</span>
                            </div>
                            <button onClick={handleSaveNominaWorker} className="p-1 bg-green-100 hover:bg-green-200 rounded-lg">
                              <Check className="w-3.5 h-3.5 text-green-600" />
                            </button>
                            <button onClick={() => setEditingNominaWorker(null)} className="p-1 bg-gray-100 hover:bg-gray-200 rounded-lg">
                              <X className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs text-gray-400">
                              Base: {formatMoney(w.base_salary)} · {w.weekly_hours}h/sem
                              {leftThisMonth(w) && <span className="text-amber-500"> · Se retiró el {formatDate(w.terminated_at)}</span>}
                            </p>
                            <button onClick={() => setEditingNominaWorker({ id: w.id, base_salary: w.base_salary, weekly_hours: w.weekly_hours })}
                              className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                              <Pencil className="w-3 h-3 text-gray-400" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="text-right px-2 text-gray-700 dark:text-gray-300">{formatMoney(w.realSalary)}</td>
                      <td className="text-right px-2 text-red-500">{w.totalDiscounts > 0 ? `-${formatMoney(w.totalDiscounts)}` : '—'}</td>
                      <td className="text-right px-2 text-green-600">{w.totalOvertime > 0 ? `+${formatMoney(w.totalOvertime)}` : '—'}</td>
                      <td className="text-right px-2 font-bold text-gray-900 dark:text-white">{formatMoney(w.finalPay)}</td>
                      <td className="text-center px-2 text-xs text-gray-500">{w.workerIncidents.length}</td>
                    </tr>
                  )
                })}
                <tr className="border-t-2 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10">
                  <td className="py-3 pr-4 font-bold text-red-700 dark:text-red-400">TOTAL PLANILLA</td>
                  <td className="text-right px-2 font-bold text-red-700 dark:text-red-400">{formatMoney(totalBase)}</td>
                  <td className="text-right px-2 font-bold text-red-500">-{formatMoney(totalNominaDisc)}</td>
                  <td className="text-right px-2 font-bold text-green-600">+{formatMoney(totalNominaOvt)}</td>
                  <td className="text-right px-2 font-bold text-red-600 dark:text-red-400 text-base">{formatMoney(totalPayroll)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── Trabajadores eventuales ─────────────────────────────────── */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Trabajadores eventuales</p>
                <p className="text-[11px] text-gray-400">Pagos por día o trabajo puntual, fuera de planilla</p>
              </div>
              {totalCasual > 0 && (
                <p className="text-base font-bold text-red-600 dark:text-red-400">{formatMoney(totalCasual)}</p>
              )}
            </div>

            {casualPayments.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {casualPayments.map(p => (
                  <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200">{p.casual_workers?.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(p.date + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                        {p.concept ? ` · ${p.concept}` : ''}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{formatMoney(p.amount)}</p>
                    <button onClick={() => handleDeleteCasualPayment(p.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors" title="Eliminar pago">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Alta de pago */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <select value={casualForm.worker}
                onChange={e => setCasualForm(f => ({ ...f, worker: e.target.value, nuevo: '' }))}
                className="input text-sm py-1.5 col-span-2 sm:col-span-1">
                <option value="">— Persona —</option>
                {casualWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <input className="input text-sm py-1.5 col-span-2 sm:col-span-1" placeholder="o nombre nuevo"
                value={casualForm.nuevo}
                onChange={e => setCasualForm(f => ({ ...f, nuevo: e.target.value, worker: '' }))} />
              <input type="date" className="input text-sm py-1.5" value={casualForm.date}
                onChange={e => setCasualForm(f => ({ ...f, date: e.target.value }))} />
              <input type="number" min="0" className="input text-sm py-1.5" placeholder="S/ monto"
                value={casualForm.amount}
                onChange={e => setCasualForm(f => ({ ...f, amount: e.target.value }))} />
              <input className="input text-sm py-1.5 col-span-2 sm:col-span-1" placeholder="Concepto (opcional)"
                value={casualForm.concept}
                onChange={e => setCasualForm(f => ({ ...f, concept: e.target.value }))} />
            </div>
            <button onClick={handleAddCasualPayment} disabled={savingCasual}
              className="btn-primary text-sm py-2 mt-2 w-full sm:w-auto sm:px-6">
              {savingCasual ? 'Guardando...' : '+ Registrar pago'}
            </button>
          </div>

          {/* Desglose incidencias */}
          {activeIncidents.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-3 gap-2">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Desglose de descuentos por incidencia</p>
                {incFiltroActivo && (
                  <button onClick={limpiarFiltroInc}
                    className="text-xs text-red-500 hover:text-red-600 shrink-0">Limpiar filtros</button>
                )}
              </div>

              {/* Filtros */}
              <div className="space-y-2 mb-3 pb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="flex flex-wrap gap-2">
                  <select value={incFiltro.worker}
                    onChange={e => setIncFiltro(f => ({ ...f, worker: e.target.value }))}
                    className="input text-xs py-1.5 w-auto min-w-[150px]">
                    <option value="">Todos los trabajadores</option>
                    {payrollData.filter(w => w.workerIncidents.length > 0)
                      .map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                  <input value={incFiltro.texto}
                    onChange={e => setIncFiltro(f => ({ ...f, texto: e.target.value }))}
                    placeholder="Buscar en la observación..."
                    className="input text-xs py-1.5 flex-1 min-w-[160px]" />
                </div>

                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-gray-400 mr-0.5">Efecto:</span>
                  {[
                    { v: 'todos',     label: 'Todos' },
                    { v: 'descuento', label: 'Descuentan' },
                    { v: 'suma',      label: 'Suman' },
                    { v: 'sin',       label: 'Sin efecto' },
                  ].map(({ v, label }) => (
                    <button key={v} onClick={() => setIncFiltro(f => ({ ...f, efecto: v }))}
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-colors ${
                        incFiltro.efecto === v
                          ? 'bg-gray-800 border-gray-800 text-white dark:bg-gray-200 dark:border-gray-200 dark:text-gray-900'
                          : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}>{label}</button>
                  ))}
                </div>

                {tiposPresentes.length > 1 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-gray-400 mr-0.5">Tipo:</span>
                    {tiposPresentes.map(t => {
                      const on = incFiltro.tipos.includes(t)
                      return (
                        <button key={t} onClick={() => setIncFiltro(f => ({
                          ...f, tipos: on ? f.tipos.filter(x => x !== t) : [...f.tipos, t],
                        }))}
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-colors ${
                            on
                              ? 'bg-red-500 border-red-500 text-white'
                              : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-300 dark:border-gray-600 hover:border-red-400'
                          }`}>{INCIDENT_LABELS[t]}</button>
                      )
                    })}
                  </div>
                )}

                {/* Totales de lo que quedó filtrado */}
                <div className="flex items-center gap-3 flex-wrap text-[11px] pt-0.5">
                  <span className="text-gray-500">
                    {incidenciasFiltradas.cantidad} incidencia{incidenciasFiltradas.cantidad !== 1 ? 's' : ''}
                  </span>
                  {incidenciasFiltradas.descuentos > 0 && (
                    <span className="text-red-500 font-semibold">−{formatMoney(incidenciasFiltradas.descuentos)}</span>
                  )}
                  {incidenciasFiltradas.sumas > 0 && (
                    <span className="text-green-600 font-semibold">+{formatMoney(incidenciasFiltradas.sumas)}</span>
                  )}
                  {(incidenciasFiltradas.descuentos > 0 || incidenciasFiltradas.sumas > 0) && (
                    <span className="text-gray-600 dark:text-gray-300">
                      neto <span className="font-bold">{formatMoney(incidenciasFiltradas.sumas - incidenciasFiltradas.descuentos)}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-4 pb-20 lg:pb-0">
                {incidenciasFiltradas.grupos.length === 0 && (
                  <p className="text-xs text-gray-400 py-3 text-center">Ninguna incidencia coincide con el filtro.</p>
                )}
                {incidenciasFiltradas.grupos.map(w => (
                  <div key={w.id}>
                    <div className="flex items-baseline gap-2 mb-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{w.name}</p>
                      <span className="text-[10px] text-gray-400">{w.filtradas.length}</span>
                    </div>
                    <div className="space-y-1 pl-3">
                      {[...w.filtradas].sort((a, b) => b.date.localeCompare(a.date)).map(i => (
                        <div key={i.id} className="flex items-center gap-2 text-xs group py-0.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => openEditIncident(i)} className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => setConfirmDelete(i)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-gray-500 shrink-0">
                            {formatDate(i.date)}{i.end_date ? ` al ${formatDate(i.end_date)}` : ''}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400 shrink-0">{INCIDENT_LABELS[i.type]}</span>
                          {(i.type === 'tardanza' || i.type === 'permiso_horas' || i.type === 'hora_extra') && i.hours_late > 0 && (
                            <span className="text-gray-400 shrink-0">{Math.floor(i.hours_late)}h {Math.round((i.hours_late % 1) * 60)}min</span>
                          )}
                          {i.type === 'tardanza' && arrivalTime(i) && (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold shrink-0">llegó {arrivalTime(i)}</span>
                          )}
                          {i.type === 'no_marcacion' && (
                            <span className="text-gray-400 shrink-0">{i.no_marcacion_count || 1} vez{(i.no_marcacion_count || 1) > 1 ? 'es' : ''} · S/ 5 c/u</span>
                          )}
                          {i.apply_discount
                            ? i.is_addition
                              ? <Badge variant="verde">+{formatMoney(i.discount_amount)}</Badge>
                              : <Badge variant="rojo">-{formatMoney(i.discount_amount)}</Badge>
                            : <Badge variant="gray">Sin descuento</Badge>
                          }
                          {i.observation && <span className="text-gray-400 italic truncate max-w-[200px]">{i.observation}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modal editar incidencia */}
          {editingNominaIncident && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4"
              onClick={() => setEditingNominaIncident(null)}>
              <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-3"
                onClick={e => e.stopPropagation()}>
                <p className="font-bold text-gray-900 dark:text-white">Editar incidencia</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Fecha</label>
                    <input type="date" className="input w-full text-sm" value={incDraft.date}
                      onChange={e => setIncDraft(d => ({ ...d, date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
                    <select className="input w-full text-sm" value={incDraft.type}
                      onChange={e => setIncDraft(d => ({ ...d, type: e.target.value }))}>
                      {Object.entries(INCIDENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>
                {(incDraft.type === 'tardanza' || incDraft.type === 'permiso_horas' || incDraft.type === 'hora_extra') && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Horas</label>
                    <input type="number" step="0.5" min="0" className="input w-full text-sm" value={incDraft.hours_late}
                      onChange={e => setIncDraft(d => ({ ...d, hours_late: parseFloat(e.target.value) || 0 }))} />
                  </div>
                )}
                {incDraft.type === 'no_marcacion' && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Cantidad de veces</label>
                    <input type="number" min="1" className="input w-full text-sm" value={incDraft.no_marcacion_count}
                      onChange={e => setIncDraft(d => ({ ...d, no_marcacion_count: parseInt(e.target.value) || 1 }))} />
                  </div>
                )}
                {(incDraft.type === 'multa' || incDraft.type === 'adelanto') && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Monto (S/)</label>
                    <input type="number" min="0" step="0.01" className="input w-full text-sm" value={incDraft.multa_amount}
                      onChange={e => setIncDraft(d => ({ ...d, multa_amount: parseFloat(e.target.value) || 0 }))} />
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Observación</label>
                  <input type="text" className="input w-full text-sm" placeholder="Opcional..."
                    value={incDraft.observation} onChange={e => setIncDraft(d => ({ ...d, observation: e.target.value }))} />
                </div>
                {incDraft.type !== 'multa' && incDraft.type !== 'adelanto' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-red-600"
                      checked={incDraft.apply_discount ?? true}
                      onChange={e => setIncDraft(d => ({ ...d, apply_discount: e.target.checked }))} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {incDraft.type === 'hora_extra' ? '✅ Autorizar — pagar en planilla' : 'Aplicar descuento'}
                    </span>
                  </label>
                )}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button onClick={() => setEditingNominaIncident(null)} className="btn-secondary py-2.5 text-sm rounded-xl">Cancelar</button>
                  <button onClick={saveNominaIncident} className="btn-primary py-2.5 text-sm rounded-xl">Guardar</button>
                </div>
              </div>
            </div>
          )}

          {/* Modal confirmar eliminar */}
          {confirmDelete && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4"
              onClick={() => setConfirmDelete(null)}>
              <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-5 shadow-2xl"
                onClick={e => e.stopPropagation()}>
                <p className="font-bold text-gray-900 dark:text-white mb-1">¿Eliminar incidencia?</p>
                <p className="text-sm text-gray-500 mb-4">
                  {INCIDENT_LABELS[confirmDelete.type]} del {formatDate(confirmDelete.date)}
                  {confirmDelete.end_date ? ` al ${formatDate(confirmDelete.end_date)}` : ''} — {formatMoney(confirmDelete.discount_amount)}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setConfirmDelete(null)} className="btn-secondary py-2.5 text-sm rounded-xl">Cancelar</button>
                  <button onClick={() => doDeleteIncident(confirmDelete.id)}
                    className="py-2.5 text-sm rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors">
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals equipo */}
      <Modal open={showWorkerForm} onClose={() => { setShowWorkerForm(false); setEditingWorker(null) }} title={editingWorker ? 'Editar trabajador' : 'Nuevo trabajador'} size="md">
        <WorkerForm initial={editingWorker} onSave={handleSaveWorker} onClose={() => { setShowWorkerForm(false); setEditingWorker(null) }} schedules={schedules} />
      </Modal>

      <Modal open={showIncidentForm} onClose={() => { setShowIncidentForm(false); setEditingIncident(null) }} title={editingIncident ? 'Editar incidencia' : 'Registrar incidencia'}>
        <IncidentForm workers={workers} schedules={schedules} onSave={handleSaveIncident} onClose={() => { setShowIncidentForm(false); setEditingIncident(null) }} initial={editingIncident} month={month} year={year} />
      </Modal>

      {deactivateTarget?.active ? (
        <Modal open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} title="¿Dar de baja?" size="sm">
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            {deactivateTarget?.name} quedará inactivo. Su pago de este mes se calculará solo por los días que trabajó.
          </p>
          <div className="mb-6">
            <label className="label">Fecha de salida</label>
            <input type="date" className="input" value={terminationDate} onChange={e => setTerminationDate(e.target.value)} max={todayISO()} />
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-secondary" onClick={() => setDeactivateTarget(null)}>Cancelar</button>
            <button className="btn-danger" onClick={() => { handleToggleActive(deactivateTarget); setDeactivateTarget(null) }}>Dar de baja</button>
          </div>
        </Modal>
      ) : (
        <ConfirmDialog
          open={!!deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onConfirm={() => handleToggleActive(deactivateTarget)}
          title="¿Reactivar trabajador?"
          message={`${deactivateTarget?.name} volverá a aparecer en los registros.`}
          confirmLabel="Reactivar"
          variant="primary"
        />
      )}

      <ConfirmDialog
        open={!!deleteIncidentTarget}
        onClose={() => setDeleteIncidentTarget(null)}
        onConfirm={() => handleDeleteIncident(deleteIncidentTarget)}
        title="¿Eliminar incidencia?"
        message="Se eliminará el registro y el descuento asociado."
        confirmLabel="Eliminar"
      />
    </div>
  )
}
