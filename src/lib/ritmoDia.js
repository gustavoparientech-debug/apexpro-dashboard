// ─── Ritmo del día ───────────────────────────────────────────────────────────
// Si lo que entró hasta ahora alcanza para cumplir la meta del mes. La meta de
// hoy no es fija: es lo que falta del mes repartido entre los días hábiles que
// quedan, hoy incluido. Así un día flojo sube la meta de los siguientes y uno
// bueno la baja, igual que el ritmo del Panel.
//
// A media mañana no se puede pedir el total del día: el dinero entra cuando se
// cierran los tickets, y eso pasa más por la tarde. Lo esperado "a esta hora"
// sigue la curva real de cobros de las últimas semanas.

import { costoFijoMes } from './metas'
import { getWorkingDaysInMonth } from './utils'

// Sin historia suficiente se reparte parejo en el horario de atención.
const APERTURA = 8.5
const CIERRE   = 18
const MIN_TICKETS_CURVA = 30
// Debajo de esto el día va atrasado; entre esto y 100, un poco abajo.
export const UMBRAL_ATRASO = 80

const horaDecimal = d => d.getHours() + d.getMinutes() / 60

function fraccionLineal(h) {
  if (h <= APERTURA) return 0
  if (h >= CIERRE) return 1
  return (h - APERTURA) / (CIERRE - APERTURA)
}

// Qué parte del dinero del día ya suele haber entrado a cada hora, según la
// hora de cierre de los tickets cobrados. Devuelve 25 puntos acumulados
// (0:00 … 24:00) o null si hay pocos datos.
export function curvaCobros(tickets) {
  const porHora = Array(24).fill(0)
  let total = 0, n = 0
  for (const t of tickets || []) {
    if (!t.closed_at) continue
    const monto = Number(t.price_charged) || 0
    if (monto <= 0) continue
    const d = new Date(t.closed_at)
    if (d.getDay() === 0) continue
    porHora[d.getHours()] += monto
    total += monto
    n += 1
  }
  if (n < MIN_TICKETS_CURVA || total <= 0) return null
  const acum = [0]
  for (let h = 0; h < 24; h++) acum.push(acum[h] + porHora[h] / total)
  return acum
}

// Parte del día que ya debería estar cobrada a la hora `ahora`.
export function fraccionDelDia(curva, ahora = new Date()) {
  const h = horaDecimal(ahora)
  if (!curva) return fraccionLineal(h)
  const base = Math.floor(h)
  if (base >= 24) return 1
  return curva[base] + (curva[base + 1] - curva[base]) * (h - base)
}

// Días hábiles (sin domingo) desde hoy hasta fin de mes, hoy incluido.
function diasHabilesDesdeHoy(ahora) {
  const y = ahora.getFullYear(), m = ahora.getMonth()
  const fin = new Date(y, m + 1, 0).getDate()
  let n = 0
  for (let d = ahora.getDate(); d <= fin; d++) if (new Date(y, m, d).getDay() !== 0) n++
  return n
}

// Meta del mes: lo mismo que el Panel, costo fijo del mes (ítems y planilla)
// más la utilidad que se busca.
export function metaDelMes(monthlyCosts, workers) {
  const utilidad = Number(monthlyCosts?.utility_goal) || 2000
  return costoFijoMes(monthlyCosts, workers) + utilidad
}

export function ritmoDelDia({ metaMes, ingresoAntes, hoy, curva, ahora = new Date() }) {
  if (!(metaMes > 0) || ahora.getDay() === 0) return null
  const quedan = diasHabilesDesdeHoy(ahora)
  const diasMes = getWorkingDaysInMonth(ahora.getFullYear(), ahora.getMonth() + 1)
  const falta = Math.max(0, metaMes - (ingresoAntes || 0))
  const metaHoy = quedan > 0 ? falta / quedan : 0
  const fraccion = Math.min(1, Math.max(0, fraccionDelDia(curva, ahora)))
  const esperado = metaHoy * fraccion
  // Antes de abrir no hay ritmo que medir: se compara contra la meta entera.
  const pct = esperado > 0 ? Math.round((hoy / esperado) * 100) : null
  const estado = metaHoy === 0 ? 'cumplido'
    : hoy >= metaHoy ? 'cumplido'
    : pct == null ? 'temprano'
    : pct >= 100 ? 'ritmo'
    : pct >= UMBRAL_ATRASO ? 'cerca'
    : 'atrasado'
  return {
    metaHoy: Math.round(metaHoy),
    metaPareja: diasMes > 0 ? Math.round(metaMes / diasMes) : 0,
    esperado: Math.round(esperado),
    fraccion,
    pctDia: metaHoy > 0 ? Math.min(100, Math.round((hoy / metaHoy) * 100)) : 100,
    pct, estado,
    falta: Math.max(0, Math.round(metaHoy - hoy)),
  }
}
