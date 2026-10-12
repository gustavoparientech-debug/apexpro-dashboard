import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchFeriados, saveFeriados, FERIADOS_PERU, COMISION_FERIADO } from '../../lib/feriados'
import { monthName } from '../../lib/utils'

const fechaCorta = iso => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Feriados del mes: se marcan aquí y el resto (descuento del día y comisión
// de quien vino) lo hace `reconciliarFeriados` al guardar.
export default function FeriadosCard({ year, month, onCambio }) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const [todos, setTodos] = useState([])
  const [nuevo, setNuevo] = useState({ date: '', nombre: '' })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { fetchFeriados().then(setTodos).catch(() => {}) }, [prefix])

  const delMes = useMemo(() => todos.filter(f => f.date.startsWith(prefix)), [todos, prefix])
  // Los nacionales de este mes que todavía no están marcados.
  const sugeridos = useMemo(() => FERIADOS_PERU
    .filter(([md]) => md.startsWith(String(month).padStart(2, '0')))
    .map(([md, nombre]) => ({ date: `${year}-${md}`, nombre }))
    .filter(s => !todos.some(f => f.date === s.date)), [todos, year, month])

  async function guardar(lista, aviso) {
    setGuardando(true)
    try {
      const guardados = await saveFeriados(lista)
      setTodos(guardados)
      toast.success(aviso)
      await onCambio?.()
    } catch (e) {
      toast.error(`No se pudo guardar: ${e.message || e}`)
    }
    setGuardando(false)
  }

  function agregar(f) {
    if (!f.date) { toast.error('Elige la fecha'); return }
    if (new Date(`${f.date}T00:00:00`).getDay() === 0) { toast.error('Es domingo: ese día no se trabaja'); return }
    guardar([...todos, f], `Feriado marcado: ${fechaCorta(f.date)}`)
    setNuevo({ date: '', nombre: '' })
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-1">
        <CalendarDays className="w-4 h-4 text-red-500" />
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-1">
          Feriados de {monthName(month)}
        </p>
      </div>
      <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
        En feriado el día no se paga con sueldo: a todos se les descuenta. Quien viene a trabajar cobra
        el <b>{COMISION_FERIADO * 100}% de sus tickets</b> de ese día. Ese día no corren tardanzas, horas extra
        ni almuerzo extendido. Se calcula solo y se actualiza al cerrar más tickets.
      </p>

      {delMes.length > 0 ? (
        <div className="space-y-1.5 mb-3">
          {delMes.map(f => (
            <div key={f.date} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/10">
              <span className="text-xs font-bold text-red-600 dark:text-red-400 capitalize w-24 flex-none">{fechaCorta(f.date)}</span>
              <span className="text-sm text-gray-700 dark:text-gray-200 flex-1 truncate">{f.nombre}</span>
              <button disabled={guardando} onClick={() => guardar(todos.filter(x => x.date !== f.date), 'Feriado quitado')}
                className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-40" title="Quitar feriado">
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 mb-3">Sin feriados marcados este mes.</p>
      )}

      {sugeridos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {sugeridos.map(s => (
            <button key={s.date} disabled={guardando} onClick={() => agregar(s)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-dashed border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40">
              <Plus className="w-3 h-3" /> {fechaCorta(s.date)} · {s.nombre}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input type="date" className="input py-1.5 text-sm w-40" value={nuevo.date}
          min={`${prefix}-01`} max={`${prefix}-31`}
          onChange={e => setNuevo(n => ({ ...n, date: e.target.value }))} />
        <input className="input py-1.5 text-sm flex-1 min-w-[140px]" placeholder="Nombre (ej. Jueves Santo)"
          value={nuevo.nombre} onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))} />
        <button disabled={guardando} onClick={() => agregar(nuevo)} className="btn-primary text-sm py-1.5 px-4 disabled:opacity-50">
          Marcar
        </button>
      </div>
    </div>
  )
}
