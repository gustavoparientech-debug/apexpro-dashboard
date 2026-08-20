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
