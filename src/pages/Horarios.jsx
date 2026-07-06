import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { Plus, Pencil, Trash2, Clock, Check, X, Users } from 'lucide-react'
import Modal from '../components/ui/Modal'
import toast from 'react-hot-toast'

function ScheduleForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    start_time: initial?.start_time || '08:00',
    end_time: initial?.end_time || '17:00',
    tolerance_min: initial?.tolerance_min ?? 5,
    is_default: initial?.is_default || false,
  })

  async function handleSubmit(e) {
    e.preventDefault()
    await onSave({ ...form, tolerance_min: parseInt(form.tolerance_min) || 5 })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Nombre del horario</label>
        <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ej: Horario de 8 horas" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Hora de entrada</label>
          <input type="time" className="input" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Hora de salida</label>
          <input type="time" className="input" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} required />
        </div>
      </div>
      <div>
        <label className="label">Tolerancia (minutos)</label>
        <input type="number" className="input" min="0" max="60" value={form.tolerance_min} onChange={e => setForm(f => ({ ...f, tolerance_min: e.target.value }))} />
        <p className="text-xs text-gray-400 mt-1">Minutos de gracia antes de marcar tardanza</p>
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" className="w-4 h-4 accent-red-600" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} />
        <span className="text-sm text-gray-700 dark:text-gray-300">Horario predeterminado</span>
      </label>
      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary flex-1">{initial ? 'Guardar cambios' : 'Crear horario'}</button>
      </div>
    </form>
  )
}

export default function Horarios() {
  const { workers, updateWorker } = useApp()
  const [schedules, setSchedules]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [editing, setEditing]         = useState(null)
  const [selected, setSelected]       = useState(null) // schedule being viewed
  const [confirmDel, setConfirmDel]   = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('work_schedules').select('*').order('is_default', { ascending: false }).order('name')
    setSchedules(data || [])
    if (!selected && data?.length) setSelected(data[0])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(data) {
    if (editing) {
      const { error } = await supabase.from('work_schedules').update(data).eq('id', editing.id)
      if (error) { toast.error(error.message); return }
      toast.success('Horario actualizado')
    } else {
      const { error } = await supabase.from('work_schedules').insert(data)
      if (error) { toast.error(error.message); return }
      toast.success('Horario creado')
    }
    setEditing(null)
    await load()
  }

  async function handleDelete(s) {
    // Desasignar trabajadores primero
    const assigned = workers.filter(w => w.schedule_id === s.id)
    for (const w of assigned) await updateWorker(w.id, { schedule_id: null })
    const { error } = await supabase.from('work_schedules').delete().eq('id', s.id)
    if (error) { toast.error(error.message); return }
    toast.success('Horario eliminado')
    setConfirmDel(null)
    if (selected?.id === s.id) setSelected(null)
    await load()
  }

  async function toggleWorkerSchedule(worker, scheduleId) {
    const newId = worker.schedule_id === scheduleId ? null : scheduleId
    await updateWorker(worker.id, { schedule_id: newId })
    toast.success(newId ? 'Trabajador asignado' : 'Trabajador desasignado')
  }

  function fmtTime(t) {
    if (!t) return '-'
    const [h, m] = t.split(':').map(Number)
    const suffix = h >= 12 ? 'pm' : 'am'
    const hh = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${hh}:${String(m).padStart(2,'0')} ${suffix}`
  }

  const activeWorkers = workers.filter(w => w.active)
  const selSchedule = selected ? schedules.find(s => s.id === selected.id) || selected : null
  const assignedWorkers = selSchedule ? activeWorkers.filter(w => w.schedule_id === selSchedule.id) : []

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-red-500" /> Horarios de trabajo
          </h2>
          <p className="text-sm text-gray-500">Define turnos y asigna trabajadores</p>
        </div>
        <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => { setEditing(null); setShowForm(true) }}>
          <Plus className="w-4 h-4" /> Nuevo horario
        </button>
      </div>

      <div className="flex gap-4 flex-col md:flex-row">
        {/* Lista de horarios */}
        <div className="w-full md:w-72 space-y-2 shrink-0">
          {loading && <p className="text-sm text-gray-400 text-center py-4">Cargando...</p>}
          {!loading && schedules.length === 0 && (
            <div className="card text-center py-8 text-gray-400 text-sm">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Sin horarios
            </div>
          )}
          {schedules.map(s => {
            const count = activeWorkers.filter(w => w.schedule_id === s.id).length
            const isActive = selSchedule?.id === s.id
            return (
              <button key={s.id} onClick={() => setSelected(s)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${isActive
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-red-300'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`font-semibold text-sm truncate ${isActive ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{s.name}</p>
                    {s.is_default && <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Predeterminado</span>}
                    <p className="text-xs text-gray-500 mt-0.5">{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</p>
                  </div>
                  {count > 0 && (
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full shrink-0">{count}</span>
                  )}
                </div>
                {count === 0 && <p className="text-xs text-gray-400 mt-1 italic">Sin personas asignadas</p>}
                {count > 0 && (
                  <div className="flex -space-x-1 mt-2">
                    {activeWorkers.filter(w => w.schedule_id === s.id).slice(0, 5).map(w => (
                      <div key={w.id} className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 border-2 border-white dark:border-gray-900 flex items-center justify-center text-red-600 font-bold text-[10px]">{w.name[0]}</div>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Detalle del horario seleccionado */}
        {selSchedule && (
          <div className="flex-1 space-y-4">
            <div className="card">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base">{selSchedule.name}</h3>
                  {selSchedule.is_default && <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 px-2 py-0.5 rounded-full font-semibold">PREDETERMINADO</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(selSchedule); setShowForm(true) }} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setConfirmDel(selSchedule)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Entrada</p>
                  <p className="font-bold text-gray-900 dark:text-white">{fmtTime(selSchedule.start_time)}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Salida</p>
                  <p className="font-bold text-gray-900 dark:text-white">{fmtTime(selSchedule.end_time)}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">Tolerancia</p>
                  <p className="font-bold text-gray-900 dark:text-white">{selSchedule.tolerance_min} min</p>
                </div>
              </div>
            </div>

            {/* Asignación de personas */}
            <div className="card">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-red-500" /> Personas asignadas
              </h4>
              <div className="space-y-2">
                {activeWorkers.map(w => {
                  const assigned = w.schedule_id === selSchedule.id
                  return (
                    <div key={w.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${assigned ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10' : 'border-gray-100 dark:border-gray-800'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 font-bold text-xs">{w.name[0]}</div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{w.name}</p>
                          {w.schedule_id && w.schedule_id !== selSchedule.id && (
                            <p className="text-xs text-gray-400">Tiene otro horario asignado</p>
                          )}
                        </div>
                      </div>
                      <button onClick={() => toggleWorkerSchedule(w, selSchedule.id)}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${assigned
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                        {assigned ? <><X className="w-3 h-3" /> Desasignar</> : <><Check className="w-3 h-3" /> Asignar</>}
                      </button>
                    </div>
                  )
                })}
                {activeWorkers.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No hay trabajadores activos</p>}
              </div>
            </div>
          </div>
        )}

        {!selSchedule && !loading && (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Selecciona un horario para ver el detalle
          </div>
        )}
      </div>

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null) }} title={editing ? 'Editar horario' : 'Nuevo horario'} size="sm">
        <ScheduleForm initial={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null) }} />
      </Modal>

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmDel(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">¿Eliminar horario?</h3>
            <p className="text-sm text-gray-500 mb-4">Se desasignarán todos los trabajadores de <strong>{confirmDel.name}</strong>.</p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button className="btn-primary flex-1 bg-red-600 hover:bg-red-700" onClick={() => handleDelete(confirmDel)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
