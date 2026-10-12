// ─── Ritmo del día ───────────────────────────────────────────────────────────
// Si lo que entró hasta ahora alcanza para cumplir la meta del mes. La meta de
// hoy no es fija: es lo que falta del mes repartido entre los días hábiles que
// quedan, hoy incluido. Así un día flojo sube la meta de los siguientes y uno
// bueno la baja, igual que el ritmo del Panel.
//
// Lo esperado "a esta hora" sigue la estadística del gráfico "Autos que entran
// por hora" del Panel, del mismo día de la semana y pesada por lo que cobra
// cada auto: si los lunes a las 11:00 ya entró la mitad del dinero del día,
// a las 11:00 de un lunes se espera la mitad de la meta. Y con lo que suele
// entrar después de esta hora se estima el cierre: a las 15:00 quedan pocos
// autos por llegar y un faltante grande ya es difícil de cubrir.

import { costoFijoMes } from './metas'
import { getWorkingDaysInMonth } from './utils'

// Horario de atención: lo marcado fuera es registro tardío y se lleva al borde.
const HORA_APERTURA = 8
const HORA_CIERRE   = 17
const APERTURA = 8.5
const CIERRE   = 18
// Con menos tickets de ese día de la semana se usa la curva de todos los días;
// con menos aún, un reparto parejo en el horario.
const MIN_TICKETS_DIA   = 25
const MIN_TICKETS_TOTAL = 30
// Debajo de esto el día va atrasado; entre esto y 100, un poco abajo.
export const UMBRAL_ATRASO = 80

const horaDecimal = d => d.getHours() + d.getMinutes() / 60
const diaDe = fecha => {
  const [y, m, d] = fecha.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

function fraccionLineal(h) {
  if (h <= APERTURA) return 0
  if (h >= CIERRE) return 1
  return (h - APERTURA) / (CIERRE - APERTURA)
}

function acumular(porHora) {
  const total = porHora.reduce((a, v) => a + v, 0)
  if (total <= 0) return null
  const acum = [0]
  for (let h = 0; h < 24; h++) acum.push(acum[h] + porHora[h] / total)
  return acum
}

// Estadística de las últimas semanas, por día de la semana (0 = domingo):
// curva acumulada de lo que entra por hora (por la hora de llegada del auto y
// pesada por su precio) y cuánto entra en un día típico.
export function estadisticaLlegadas(tickets, dias) {
  const porHora = Array.from({ length: 7 }, () => Array(24).fill(0))
  const general = Array(24).fill(0)
  const nDia = Array(7).fill(0)
  const montoDia = Array(7).fill(0)
  const fechasDia = Array.from({ length: 7 }, () => new Set())
  let n = 0
  for (const t of tickets || []) {
    if (!t.date) continue
    const monto = Number(t.price_charged) || 0
    if (monto <= 0) continue
    const dow = diaDe(t.date)
    if (dow === 0) continue
    montoDia[dow] += monto
    fechasDia[dow].add(t.date)
    const llegada = t.opened_at || t.created_at
    if (!llegada) continue
    const h = Math.min(HORA_CIERRE, Math.max(HORA_APERTURA, new Date(llegada).getHours()))
    porHora[dow][h] += monto
    general[h] += monto
    nDia[dow] += 1
    n += 1
  }
  const curvaGeneral = n >= MIN_TICKETS_TOTAL ? acumular(general) : null
  // Un día típico se divide entre las veces que cayó ese día en el período, no
  // entre los días con ventas: un lunes sin clientes también cuenta.
  const veces = Array(7).fill(0)
  if (dias > 0) {
    const hoy = new Date()
    for (let k = 1; k <= dias; k++) {
      const d = new Date(hoy); d.setDate(d.getDate() - k)
      veces[d.getDay()] += 1
    }
  }
  return Array.from({ length: 7 }, (_, dow) => ({
    curva: nDia[dow] >= MIN_TICKETS_DIA ? acumular(porHora[dow]) : curvaGeneral,
    diaTipico: (veces[dow] || fechasDia[dow].size) > 0
      ? montoDia[dow] / (veces[dow] || fechasDia[dow].size)
      : 0,
  }))
}

// Parte del dinero del día que ya suele haber entrado a la hora `ahora`.
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

// `hoy`: lo que entró hoy, cobrado o en tickets abiertos (los autos que ya
// llegaron), que es lo que mide la curva de llegadas.
export function ritmoDelDia({ metaMes, ingresoAntes, hoy, estadistica, ahora = new Date() }) {
  if (!(metaMes > 0) || ahora.getDay() === 0) return null
  const quedan = diasHabilesDesdeHoy(ahora)
  const diasMes = getWorkingDaysInMonth(ahora.getFullYear(), ahora.getMonth() + 1)
  const falta = Math.max(0, metaMes - (ingresoAntes || 0))
  const metaHoy = quedan > 0 ? falta / quedan : 0
  const est = estadistica?.[ahora.getDay()] || {}
  const fraccion = Math.min(1, Math.max(0, fraccionDelDia(est.curva, ahora)))
  const esperado = metaHoy * fraccion
  // Cierre estimado: lo que ya entró más lo que suele entrar este día de la
  // semana desde esta hora hasta el cierre.
  const porLlegar = (est.diaTipico || 0) * (1 - fraccion)
  const cierre = hoy + porLlegar
  const pct = esperado > 0 ? Math.round((hoy / esperado) * 100) : null
  const estado = metaHoy === 0 || hoy >= metaHoy ? 'cumplido'
    : pct == null ? 'temprano'
    : pct >= 100 ? 'ritmo'
    : pct >= UMBRAL_ATRASO ? 'cerca'
    : 'atrasado'
  return {
    hoy: Math.round(hoy),
    metaHoy: Math.round(metaHoy),
    metaPareja: diasMes > 0 ? Math.round(metaMes / diasMes) : 0,
    esperado: Math.round(esperado),
    fraccion,
    pctDia: metaHoy > 0 ? Math.min(100, Math.round((hoy / metaHoy) * 100)) : 100,
    pct, estado,
    falta: Math.max(0, Math.round(metaHoy - hoy)),
    diaTipico: Math.round(est.diaTipico || 0),
    porLlegar: Math.round(porLlegar),
    cierre: Math.round(cierre),
    // Avisa solo cuando ya pasó buena parte del día y lo que suele llegar no
    // alcanza: antes es pronto para darlo por perdido.
    dificil: estado !== 'cumplido' && fraccion >= 0.4 && cierre < metaHoy,
  }
}
