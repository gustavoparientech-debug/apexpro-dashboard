// ─── Descuento automático por almuerzo extendido ─────────────────────────────
// Desde septiembre 2026 el almuerzo es de 1 hora. Si entre "Inicio almuerzo" y
// "Fin almuerzo" pasa más de una hora, se descuenta todo el tiempo de más,
// igual que una tardanza, sin tolerancia (se cuentan minutos completos: 60 min
// y 40 s no descuenta). Se guarda como permiso por horas con su descripción.

import { supabase } from './supabase'
import { calcLatenessDiscount } from './utils'

export const ALMUERZO_MIN       = 60
export const ALMUERZO_TOLERANCIA = 0
export const INICIO_ALMUERZOS   = '2026-09'
// Sin la palabra "automática": el recálculo de la salida borra los permisos
// por horas automáticos del día y no debe llevarse este descuento.
export const MARCA_ALMUERZO     = 'Almuerzo extendido'

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

const esAuto = i => i.type === 'permiso_horas' && (i.observation || '').startsWith(MARCA_ALMUERZO)

const hora = iso => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })

// Minutos de almuerzo de un día: del primer inicio al último fin posterior.
export function minutosAlmuerzo(logsDelDia) {
  const inicios = logsDelDia.filter(l => l.type === 'almuerzo_inicio').map(l => l.logged_at).sort()
  if (!inicios.length) return null
  const ini = inicios[0]
  const fines = logsDelDia.filter(l => l.type === 'almuerzo_fin' && l.logged_at > ini).map(l => l.logged_at).sort()
  if (!fines.length) return null
  const fin = fines[fines.length - 1]
  return { ini, fin, minutos: Math.floor((new Date(fin) - new Date(ini)) / 60000) }
}

// Qué descuentos crear, corregir o borrar para un trabajador: recibe sus
// marcaciones y sus incidencias del período; no toca la base.
export function planAlmuerzos(logs, incidencias, worker) {
  const porFecha = {}
  for (const l of logs) (porFecha[l.date] = porFecha[l.date] || []).push(l)

  const deseados = new Map()
  for (const [date, lista] of Object.entries(porFecha)) {
    const a = minutosAlmuerzo(lista)
    if (!a || a.minutos <= ALMUERZO_MIN + ALMUERZO_TOLERANCIA) continue
    const exceso = a.minutos - ALMUERZO_MIN
    const horas  = Math.round((exceso / 60) * 10000) / 10000
    deseados.set(date, {
      date,
      hours_late: horas,
      discount_amount: worker ? Math.round(calcLatenessDiscount(worker.base_salary, worker.weekly_hours, horas) * 100) / 100 : 0,
      observation: `${MARCA_ALMUERZO} — ${a.minutos} min de almuerzo (${hora(a.ini)} a ${hora(a.fin)}), ` +
        `${exceso} min más de la hora permitida. Se descuenta el tiempo no trabajado.`,
    })
  }

  const crear = [], actualizar = [], borrar = []
  const vistos = new Set()
  for (const inc of incidencias.filter(esAuto)) {
    const d = deseados.get(inc.date)
    if (!d || vistos.has(inc.date)) { borrar.push(inc.id); continue }
    vistos.add(inc.date)
    if (inc.observation !== d.observation || Number(inc.hours_late) !== d.hours_late) {
      actualizar.push({ id: inc.id, ...d })
    }
  }
  for (const d of deseados.values()) if (!vistos.has(d.date)) crear.push(d)
  return { crear, actualizar, borrar }
}

// Pone al día los descuentos por almuerzo del mes (de un trabajador o de
// todos). Se puede llamar las veces que sea; las llamadas van en fila.
let enFila = Promise.resolve()
export function reconciliarAlmuerzos(args) {
  const p = enFila.then(() => reconciliar(args))
  enFila = p.catch(() => {})
  return p
}

async function reconciliar({ prefix, workerId = null, workers = [] }) {
  if (IS_DEMO || !prefix || prefix < INICIO_ALMUERZOS) return { creadas: 0, borradas: 0 }
  const [y, m] = prefix.split('-').map(Number)
  const desde = `${prefix}-01`
  const hasta = `${prefix}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`

  let ql = supabase.from('attendance_logs').select('worker_id, date, type, logged_at')
    .gte('date', desde).lte('date', hasta).in('type', ['almuerzo_inicio', 'almuerzo_fin'])
  let qi = supabase.from('attendance_incidents').select('id, worker_id, date, type, observation, hours_late')
    .gte('date', desde).lte('date', hasta).eq('type', 'permiso_horas')
  if (workerId) { ql = ql.eq('worker_id', workerId); qi = qi.eq('worker_id', workerId) }
  const [{ data: logs, error: e1 }, { data: incs, error: e2 }] = await Promise.all([ql, qi])
  if (e1) throw e1
  if (e2) throw e2

  const ids = new Set([...(logs || []).map(l => l.worker_id), ...(incs || []).filter(esAuto).map(i => i.worker_id)])
  let creadas = 0, borradas = 0
  for (const wid of ids) {
    const worker = workers.find(w => w.id === wid)
    const { crear, actualizar, borrar } = planAlmuerzos(
      (logs || []).filter(l => l.worker_id === wid),
      (incs || []).filter(i => i.worker_id === wid),
      worker,
    )
    for (const u of actualizar) {
      const { id, ...campos } = u
      await supabase.from('attendance_incidents').update(campos).eq('id', id)
    }
    for (const id of borrar) {
      const { error } = await supabase.from('attendance_incidents').delete().eq('id', id)
      if (!error) borradas++
    }
    if (crear.length) {
      const { error } = await supabase.from('attendance_incidents').insert(crear.map(c => ({
        worker_id: wid, type: 'permiso_horas', apply_discount: true, ...c,
      })))
      if (!error) creadas += crear.length
    }
  }
  return { creadas, borradas }
}
