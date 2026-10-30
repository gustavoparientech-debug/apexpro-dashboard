// ─── Feriados ────────────────────────────────────────────────────────────────
// Un feriado no se paga con el sueldo: a todos se les descuenta ese día (las
// horas de su horario) y quien viene a trabajar cobra comisión, el 50% de lo
// que cobraron sus tickets ese día. Quien no viene queda solo con el descuento.
//
// La comisión se le paga ese mismo día, en mano: es un GASTO del día (categoría
// "comision" en worker_expenses), no una suma en su planilla. El descuento del
// día sí es una incidencia de planilla.
//
// Los feriados se marcan en Equipo y se guardan en `app_settings` (clave
// `feriados`). Las incidencias se crean solas y se ponen al día cada vez que se
// abre Equipo o Nómina: si se cierra otro ticket, la comisión sube; si se quita
// el feriado, se borran.
//
// Ese día no corren tardanzas, salidas anticipadas, horas extra ni almuerzo
// extendido automáticos: se paga por lo que se produce, no por horario.

import { supabase } from './supabase'
import { calcHourlyRate, hoursForDate } from './utils'

export const FERIADOS_KEY       = 'feriados'
export const COMISION_FERIADO   = 0.5
export const TIPO_FERIADO       = 'feriado'
export const TIPO_COMISION      = 'comision_feriado'   // ya no se usa: la comisión es un gasto
export const CATEGORIA_COMISION = 'comision'
const MARCA_GASTO = 'Comisión de feriado'
export const MARCA_FERIADO      = 'Feriado'

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

// Feriados nacionales de Perú de fecha fija, para marcarlos con un toque.
// Jueves y Viernes Santo cambian cada año y se agregan a mano.
export const FERIADOS_PERU = [
  ['01-01', 'Año Nuevo'],
  ['05-01', 'Día del Trabajo'],
  ['06-07', 'Batalla de Arica y Día de la Bandera'],
  ['06-29', 'San Pedro y San Pablo'],
  ['07-23', 'Día de la Fuerza Aérea'],
  ['07-28', 'Fiestas Patrias'],
  ['07-29', 'Fiestas Patrias'],
  ['08-06', 'Batalla de Junín'],
  ['08-30', 'Santa Rosa de Lima'],
  ['10-08', 'Combate de Angamos'],
  ['11-01', 'Todos los Santos'],
  ['12-08', 'Inmaculada Concepción'],
  ['12-09', 'Batalla de Ayacucho'],
  ['12-25', 'Navidad'],
]

// Incidencias automáticas que no corren en feriado (ver arriba).
const esAutoDeHorario = i =>
  (['tardanza', 'permiso_horas', 'hora_extra'].includes(i.type) && /autom[aá]tica/i.test(i.observation || '')) ||
  (i.type === 'permiso_horas' && (i.observation || '').startsWith('Almuerzo extendido'))

// ── Lectura y guardado ──────────────────────────────────────────────────────
let cache = null
export async function fetchFeriados() {
  if (IS_DEMO) return []
  const { data } = await supabase.from('app_settings').select('value').eq('key', FERIADOS_KEY).maybeSingle()
  const dias = Array.isArray(data?.value?.dias) ? data.value.dias : []
  cache = { at: Date.now(), dias }
  return dias
}

export async function saveFeriados(dias) {
  const limpio = [...new Map((dias || []).map(d => [d.date, { date: d.date, nombre: (d.nombre || '').trim() || 'Feriado' }])).values()]
    .sort((a, b) => a.date.localeCompare(b.date))
  const { error } = await supabase.from('app_settings').upsert(
    { key: FERIADOS_KEY, value: { dias: limpio }, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
  if (error) throw error
  cache = { at: Date.now(), dias: limpio }
  return limpio
}

// Para Asistencia, que pregunta en cada marcación: se guarda un minuto.
export async function esFeriado(fecha) {
  if (IS_DEMO) return false
  if (!cache || Date.now() - cache.at > 60000) {
    try { await fetchFeriados() } catch { return false }
  }
  return cache.dias.some(d => d.date === fecha)
}

// ── Cálculo ────────────────────────────────────────────────────────────────
const dinero = n => `S/ ${(Math.round(n * 100) / 100).toFixed(2)}`

// Qué incidencias crear, corregir o borrar. Recibe todo ya leído; no toca la base.
export function planFeriados({ feriados, workers, horarios, entradas, tickets, incidencias, gastosActuales = [], hasta }) {
  const deseadas = []
  const gastos = []
  const horarioDe = Object.fromEntries((horarios || []).map(h => [h.id, h.weekday_hours || null]))
  for (const f of feriados) {
    if (f.date > hasta) continue
    for (const w of workers) {
      if (w.role === 'admin') continue
      if (w.hire_date && w.hire_date > f.date) continue
      if (w.terminated_at && w.terminated_at.slice(0, 10) < f.date) continue
      if (!w.active && !w.terminated_at) continue
      const horas = hoursForDate(f.date, horarioDe[w.schedule_id], w.weekly_hours)
      const suyos = tickets.filter(t => t.worker_id === w.id && t.date === f.date && t.status === 'cerrado')
      const cobrado = suyos.reduce((a, t) => a + (Number(t.price_charged) || 0), 0)
      const vino = entradas.some(e => e.worker_id === w.id && e.date === f.date) || suyos.length > 0
      if (horas > 0) {
        const monto = Math.round(calcHourlyRate(w.base_salary, w.weekly_hours) * horas * 100) / 100
        deseadas.push({
          worker_id: w.id, date: f.date, type: TIPO_FERIADO, is_addition: false,
          hours_late: horas, discount_amount: monto,
          observation: `${MARCA_FERIADO} — ${f.nombre}: el día no se paga con sueldo (${horas} h). ` +
            (vino ? `Vino a trabajar: su comisión del ${COMISION_FERIADO * 100}% se le paga ese día (va en gastos).` : 'No vino.'),
        })
      }
      if (vino && cobrado > 0) {
        gastos.push({
          worker_id: w.id, date: f.date, category: CATEGORIA_COMISION, paid: true,
          hidden_from_workers: true,
          amount: Math.round(cobrado * COMISION_FERIADO * 100) / 100,
          description: `${MARCA_GASTO} — ${f.nombre}: ${COMISION_FERIADO * 100}% de ` +
            `${suyos.length} ticket${suyos.length === 1 ? '' : 's'} (${dinero(cobrado)})`,
        })
      }
    }
  }

  const clave = i => `${i.worker_id}|${i.date}|${i.type}`
  const porClave = new Map(deseadas.map(d => [clave(d), d]))
  const fechas = new Set(feriados.map(f => f.date))
  const crear = [], actualizar = [], borrar = []
  const vistas = new Set()
  for (const i of incidencias) {
    // Comisiones guardadas como incidencia (versión anterior): pasan a gasto.
    if (i.type === TIPO_COMISION) { borrar.push(i.id); continue }
    if (i.type === TIPO_FERIADO) {
      const d = porClave.get(clave(i))
      if (!d || vistas.has(clave(i))) { borrar.push(i.id); continue }
      vistas.add(clave(i))
      if (Number(i.discount_amount) !== d.discount_amount || i.observation !== d.observation || Number(i.hours_late) !== d.hours_late) {
        actualizar.push({ id: i.id, discount_amount: d.discount_amount, observation: d.observation, hours_late: d.hours_late, apply_discount: true, is_addition: d.is_addition })
      }
    } else if (fechas.has(i.date) && esAutoDeHorario(i)) {
      borrar.push(i.id)
    }
  }
  for (const d of deseadas) if (!vistas.has(clave(d))) crear.push(d)

  // Gastos de comisión: uno por trabajador y feriado.
  const claveG = g => `${g.worker_id}|${g.date}`
  const gPorClave = new Map(gastos.map(g => [claveG(g), g]))
  const gVistos = new Set()
  const gastosCrear = [], gastosActualizar = [], gastosBorrar = []
  for (const g of gastosActuales) {
    const d = gPorClave.get(claveG(g))
    if (!d || gVistos.has(claveG(g))) { gastosBorrar.push(g.id); continue }
    gVistos.add(claveG(g))
    if (Number(g.amount) !== d.amount || g.description !== d.description) {
      gastosActualizar.push({ id: g.id, amount: d.amount, description: d.description })
    }
  }
  for (const g of gastos) if (!gVistos.has(claveG(g))) gastosCrear.push(g)
  return { crear, actualizar, borrar, gastosCrear, gastosActualizar, gastosBorrar }
}

// Pone al día las incidencias de feriado del mes. Va en fila, como las multas.
let enFila = Promise.resolve()
export function reconciliarFeriados(args) {
  const p = enFila.then(() => reconciliar(args))
  enFila = p.catch(() => {})
  return p
}

async function reconciliar({ prefix, workers = [] }) {
  const vacio = { creadas: 0, borradas: 0, cambios: 0 }
  if (IS_DEMO || !prefix) return vacio
  const [y, m] = prefix.split('-').map(Number)
  const desde = `${prefix}-01`
  const hastaMes = `${prefix}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
  const hoy = new Date()
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`

  const feriados = (await fetchFeriados()).filter(f => f.date >= desde && f.date <= hastaMes)
  const { data: incs, error } = await supabase.from('attendance_incidents')
    .select('id, worker_id, date, type, observation, hours_late, discount_amount')
    .gte('date', desde).lte('date', hastaMes)
    .in('type', [TIPO_FERIADO, TIPO_COMISION, 'tardanza', 'permiso_horas', 'hora_extra'])
  if (error) throw error
  const { data: gastosActuales } = await supabase.from('worker_expenses')
    .select('id, worker_id, date, amount, description')
    .gte('date', desde).lte('date', hastaMes)
    .eq('category', CATEGORIA_COMISION).like('description', `${MARCA_GASTO}%`)
  if (!feriados.length && !(gastosActuales || []).length &&
      !(incs || []).some(i => i.type === TIPO_FERIADO || i.type === TIPO_COMISION)) return vacio

  const fechas = feriados.map(f => f.date)
  const [{ data: entradas }, { data: tickets }, { data: horarios }, { data: todos }] = await Promise.all([
    fechas.length
      ? supabase.from('attendance_logs').select('worker_id, date').eq('type', 'entrada').in('date', fechas)
      : Promise.resolve({ data: [] }),
    fechas.length
      ? supabase.from('tickets').select('worker_id, date, status, price_charged').in('date', fechas)
      : Promise.resolve({ data: [] }),
    supabase.from('work_schedules').select('id, weekday_hours'),
    workers.length ? Promise.resolve({ data: workers }) : supabase.from('workers').select('*'),
  ])

  const { crear, actualizar, borrar, gastosCrear, gastosActualizar, gastosBorrar } = planFeriados({
    feriados, workers: todos || [], horarios: horarios || [],
    entradas: entradas || [], tickets: tickets || [], incidencias: incs || [],
    gastosActuales: gastosActuales || [], hasta: hoyISO,
  })
  for (const u of gastosActualizar) {
    const { id, ...campos } = u
    await supabase.from('worker_expenses').update(campos).eq('id', id)
  }
  for (const id of gastosBorrar) await supabase.from('worker_expenses').delete().eq('id', id)
  if (gastosCrear.length) await supabase.from('worker_expenses').insert(gastosCrear)
  const cambiosGastos = gastosCrear.length + gastosActualizar.length + gastosBorrar.length
  for (const u of actualizar) {
    const { id, ...campos } = u
    await supabase.from('attendance_incidents').update(campos).eq('id', id)
  }
  let borradas = 0
  for (const id of borrar) {
    const { error: e } = await supabase.from('attendance_incidents').delete().eq('id', id)
    if (!e) borradas++
  }
  let creadas = 0
  if (crear.length) {
    const { error: e } = await supabase.from('attendance_incidents').insert(
      crear.map(c => ({ ...c, apply_discount: true })))
    if (!e) creadas = crear.length
  }
  return { creadas, borradas, cambios: creadas + borradas + actualizar.length + cambiosGastos }
}
