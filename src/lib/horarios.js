// ─── Horario vigente de un trabajador ────────────────────────────────────────
// Un trabajador puede cambiar de turno: Elías entraba 8:15 y desde tal día
// entra 8:30. Sin historial, recalcular un día viejo lo medía contra el horario
// nuevo y la tardanza de hace un mes cambiaba sola. `worker_schedule_history`
// guarda desde qué día rige cada horario y acá se resuelve el de una fecha.

import { supabase } from './supabase'

// Horario que regía para ese trabajador en esa fecha. Devuelve la fila de
// `work_schedules` (o el horario suelto guardado en el trabajador, que es lo
// que se usaba antes de que existieran los horarios con nombre).
export async function scheduleForDate(workerId, dateStr) {
  const { data: worker } = await supabase.from('workers').select('*').eq('id', workerId).single()
  if (!worker) return null

  const { data: historial } = await supabase
    .from('worker_schedule_history')
    .select('schedule_id, start_date')
    .eq('worker_id', workerId)
    .lte('start_date', dateStr)
    .order('start_date', { ascending: false })
    .limit(1)

  // Sin historial para esa fecha se usa el horario actual: es lo que pasaba
  // antes y es lo correcto para un trabajador que nunca cambió de turno.
  const vigente = historial?.[0]
  const scheduleId = vigente ? vigente.schedule_id : worker.schedule_id

  if (scheduleId) {
    const { data } = await supabase.from('work_schedules').select('*').eq('id', scheduleId).single()
    if (data) return data
  }
  if (worker.schedule_start) {
    return {
      start_time: worker.schedule_start,
      end_time: worker.schedule_end,
      tolerance_min: worker.schedule_tolerance_min ?? 0,
    }
  }
  return null
}

// Asigna (o quita) el horario de un trabajador a partir de una fecha. El
// trabajador guarda el horario actual —lo que se ve en la pantalla— y el
// historial guarda desde cuándo rige, que es lo que usan los cálculos.
export async function assignSchedule(workerId, scheduleId, fromDate) {
  const { error } = await supabase.from('worker_schedule_history').upsert(
    { worker_id: workerId, schedule_id: scheduleId, start_date: fromDate },
    { onConflict: 'worker_id,start_date' }
  )
  if (error) throw error
}

// Cambios de horario de un trabajador, del más reciente al más viejo.
export async function fetchScheduleHistory(workerId) {
  const { data } = await supabase
    .from('worker_schedule_history')
    .select('id, schedule_id, start_date')
    .eq('worker_id', workerId)
    .order('start_date', { ascending: false })
  return data || []
}

// ─── Fin de la jornada de un día ─────────────────────────────────────────────
// No todos los horarios llevan almuerzo: el de Gabriela es 9:00 a 14:00 de
// corrido (5 h) y el sábado hace 7 h. Antes se restaba siempre 1 hora de
// almuerzo a la hora de salida si no lo marcaba, y su jornada "terminaba" a
// las 13:00: una salida a las 12:04 contaba 56 min de menos en vez de 1 h 56,
// y cada día salía una hora extra falsa.
//
// Se toma la hora de entrada más las horas que le tocan ese día
// (`weekday_hours`), más el almuerzo que trae el horario:
// - si entre entrada y salida del horario hay más tiempo que las horas del
//   día, esa diferencia es el almuerzo (8:15–17:15 con 8 h = 1 h);
// - si el día es más largo que el horario (el sábado de 7 h con un horario
//   de 5 h), lleva 1 h de almuerzo solo si pasa de 6 h.
// Devuelve minutos del día: `fin` con almuerzo tomado y `almuerzo`, que se
// descuenta del fin cuando no almorzó.
const aMin = t => { const [h, m] = String(t || '').split(':').map(Number); return (h || 0) * 60 + (m || 0) }

export function finDeJornada(sched, dateStr) {
  if (!sched?.start_time || !sched?.end_time) return null
  const ini = aMin(sched.start_time)
  const span = aMin(sched.end_time) - ini
  const dow = new Date(`${dateStr}T00:00:00`).getDay()
  const h = sched.weekday_hours?.[dow] ?? sched.weekday_hours?.[String(dow)]
  // Horario sin horas por día: el de siempre, con 1 h de almuerzo adentro.
  if (h === undefined || h === null) return { fin: ini + span, almuerzo: 60 }
  const trabajo = Number(h) * 60
  const almuerzo = span > trabajo
    ? Math.min(60, span - trabajo)
    : (trabajo > 6 * 60 ? 60 : 0)
  return { fin: ini + trabajo + almuerzo, almuerzo }
}
