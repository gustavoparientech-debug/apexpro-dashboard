import { format, parseISO, getDaysInMonth, getDay, startOfMonth, addDays } from 'date-fns'
import { es } from 'date-fns/locale'

export function formatMoney(amount) {
  if (amount == null) return 'S/ 0.00'
  return `S/ ${Number(amount).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
    return format(d, 'dd/MM/yyyy')
  } catch {
    return dateStr
  }
}

export function formatDateLong(dateStr) {
  if (!dateStr) return ''
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
    return format(d, "d 'de' MMMM yyyy", { locale: es })
  } catch {
    return dateStr
  }
}

export function todayISO() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function currentMonthYear() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

export function getWorkingDaysInMonth(year, month) {
  const total = getDaysInMonth(new Date(year, month - 1))
  let count = 0
  for (let d = 1; d <= total; d++) {
    const day = getDay(new Date(year, month - 1, d))
    if (day !== 0) count++ // excluye domingos (0=domingo)
  }
  return count
}

export function getWorkingDaysElapsed(year, month) {
  const today = new Date()
  const end = today.getMonth() + 1 === month && today.getFullYear() === year
    ? today.getDate()
    : getDaysInMonth(new Date(year, month - 1))
  let count = 0
  for (let d = 1; d <= end; d++) {
    const day = getDay(new Date(year, month - 1, d))
    if (day !== 0) count++
  }
  return count
}

export function getWorkingDaysInRange(dateFrom, dateTo) {
  const from = new Date(dateFrom + 'T00:00:00')
  const to   = new Date(dateTo   + 'T00:00:00')
  let count = 0
  const cur = new Date(from)
  while (cur <= to) {
    if (cur.getDay() !== 0) count++ // excluye domingos
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export function getWorkingDaysRemaining(year, month) {
  const total = getWorkingDaysInMonth(year, month)
  const elapsed = getWorkingDaysElapsed(year, month)
  return Math.max(0, total - elapsed)
}

// Calcula salario real mensual
export function calcRealSalary(baseSalary, weeklyHours) {
  return baseSalary * (weeklyHours / 48)
}

// Calcula salario diario
export function calcDailySalary(baseSalary, weeklyHours) {
  const realMonthly = calcRealSalary(baseSalary, weeklyHours)
  return realMonthly / 26
}

// Descuento por falta o permiso
export function calcAbsenceDiscount(baseSalary, weeklyHours) {
  return calcDailySalary(baseSalary, weeklyHours)
}

// Descuento por tardanza
export function calcLatenessDiscount(baseSalary, weeklyHours, hoursLate) {
  const dailySalary = calcDailySalary(baseSalary, weeklyHours)
  const dailyHours = weeklyHours / 6
  return (dailySalary / dailyHours) * hoursLate
}

// Ganancia neta de un ticket
export function calcTicketProfit(price, marginPercent) {
  return price * (marginPercent / 100)
}

// Semáforo de progreso
export function getSemaforoColor(percent) {
  if (percent >= 75) return 'verde'
  if (percent >= 40) return 'amarillo'
  return 'rojo'
}

// Semáforo de ratio rentabilidad
export function getRatioColor(ratio) {
  if (ratio >= 2) return 'verde'
  if (ratio >= 1) return 'amarillo'
  return 'rojo'
}

export function monthName(month) {
  const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return names[month - 1] || ''
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}
