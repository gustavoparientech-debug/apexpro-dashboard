import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { todayISO } from '../lib/utils'

// ─── Fuera de turno ──────────────────────────────────────────────────────────
// Cuando un trabajador marca su salida, por privacidad deja de ver lo que pasa
// en el taller el resto del día: Gabriela sale a las 2 y no tiene por qué ver
// los tickets ni la caja de la tarde. Al día siguiente vuelve todo.
//
// Asistencia avisa con el evento `asistencia:marcada` apenas se marca; además
// se revisa al volver a la app y cada minuto (un admin puede borrar una
// salida marcada por error, o puede cambiar el día).

export const EVENTO_MARCA = 'asistencia:marcada'
const CLAVE = id => `apex_salida_${id}`

function leerGuardado(workerId) {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE(workerId)) || 'null')
    return g?.date === todayISO() ? g : null
  } catch { return null }
}

export function useFueraDeTurno({ workerId, activo }) {
  // Lo último conocido, para no mostrar el taller ni un instante al abrir.
  const [estado, setEstado] = useState(() => (activo && workerId ? leerGuardado(workerId) : null))

  const revisar = useCallback(async () => {
    if (!activo || !workerId) { setEstado(null); return }
    const hoy = todayISO()
    const { data, error } = await supabase.from('attendance_logs')
      .select('type, logged_at').eq('worker_id', workerId).eq('date', hoy)
      .order('logged_at', { ascending: true })
    if (error) return   // sin red se queda con lo último conocido
    const logs = data || []
    const salida = logs.find(l => l.type === 'salida')
    const nuevo = salida ? { date: hoy, logs } : null
    try {
      if (nuevo) localStorage.setItem(CLAVE(workerId), JSON.stringify(nuevo))
      else localStorage.removeItem(CLAVE(workerId))
    } catch { /* sin almacenamiento solo se pierde el arranque inmediato */ }
    setEstado(nuevo)
  }, [activo, workerId])

  useEffect(() => {
    revisar()
    if (!activo || !workerId) return
    const alVolver = () => { if (document.visibilityState === 'visible') revisar() }
    window.addEventListener(EVENTO_MARCA, revisar)
    window.addEventListener('focus', revisar)
    document.addEventListener('visibilitychange', alVolver)
    const id = setInterval(revisar, 60000)
    return () => {
      window.removeEventListener(EVENTO_MARCA, revisar)
      window.removeEventListener('focus', revisar)
      document.removeEventListener('visibilitychange', alVolver)
      clearInterval(id)
    }
  }, [revisar, activo, workerId])

  return estado   // null = en turno; { date, logs } = ya marcó su salida hoy
}
