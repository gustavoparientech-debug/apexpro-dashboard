import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { Shield, User, Link, Trash2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '../components/ui/ConfirmDialog'

const ROLE_LABELS = { admin: 'Administrador', worker: 'Trabajador' }
const ROLE_COLORS = {
  admin:  'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  worker: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
}

export default function AdminUsuarios() {
  const { workers } = useApp()
  const { profile: myProfile, refreshProfile } = useAuth()

  const [profiles, setProfiles] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const activeWorkers = workers.filter(w => w.active)

  async function loadProfiles() {
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').order('role')
    if (error) { toast.error('Error al cargar usuarios'); console.error(error) }
    else setProfiles(data || [])
    setLoading(false)
  }

  useEffect(() => { loadProfiles() }, [])

  async function handleRoleChange(profileId, newRole) {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', profileId)
    if (error) { toast.error('Error al cambiar rol'); return }
    setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, role: newRole } : p))
    if (profileId === myProfile?.id) refreshProfile()
    toast.success(`Rol cambiado a ${ROLE_LABELS[newRole]}`)
  }

  async function handleWorkerLink(profileId, workerId) {
    const val = workerId || null
    const { error } = await supabase.from('profiles').update({ worker_id: val }).eq('id', profileId)
    if (error) { toast.error('Error al vincular trabajador'); return }
    setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, worker_id: val } : p))
    toast.success(val ? 'Trabajador vinculado' : 'Vínculo removido')
  }

  async function handleDelete(profileId) {
    const { error } = await supabase.from('profiles').delete().eq('id', profileId)
    if (error) { toast.error('Error al eliminar'); return }
    setProfiles(prev => prev.filter(p => p.id !== profileId))
    toast.success('Usuario eliminado del sistema')
  }

  const initials = (name) => (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usuarios</h1>
        <button onClick={loadProfiles}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-red-500" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Gestión de acceso</p>
        </div>
        <p className="text-xs text-gray-500">
          Los usuarios se registran solos. Aquí asignas su rol y lo vinculas a un perfil de trabajador.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="card text-center py-10">
          <User className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Sin usuarios registrados todavía</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map(p => {
            const linkedWorker = workers.find(w => w.id === p.worker_id)
            const isMe = p.id === myProfile?.id
            return (
              <div key={p.id} className={`card space-y-3 ${isMe ? 'ring-2 ring-red-200 dark:ring-red-900/50' : ''}`}>
                {/* Header usuario */}
                <div className="flex items-start gap-3">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-none" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-400 flex-none">
                      {initials(p.display_name || p.email)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                        {p.display_name || p.email || 'Sin nombre'}
                      </p>
                      {isMe && <span className="text-xs text-gray-400">(tú)</span>}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[p.role] || ROLE_COLORS.worker}`}>
                        {ROLE_LABELS[p.role] || p.role}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{p.email}</p>
                    {linkedWorker && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                        Vinculado a: {linkedWorker.name}
                      </p>
                    )}
                  </div>
                  {!isMe && (
                    <button onClick={() => setDeleteTarget(p.id)}
                      className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex-none">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  )}
                </div>

                {/* Cambiar rol */}
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500 w-14 flex-none">Rol:</p>
                  <div className="flex gap-1.5">
                    {['worker', 'admin'].map(role => (
                      <button key={role} onClick={() => handleRoleChange(p.id, role)}
                        disabled={isMe && role === 'worker'}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          p.role === role
                            ? role === 'admin'
                              ? 'bg-red-600 text-white'
                              : 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}>
                        {ROLE_LABELS[role]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vincular trabajador */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs text-gray-500 w-14 flex-none">
                    <Link className="w-3 h-3" /> Perfil:
                  </div>
                  <select
                    value={p.worker_id || ''}
                    onChange={e => handleWorkerLink(p.id, e.target.value)}
                    className="flex-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-red-500">
                    <option value="">— Sin vincular —</option>
                    {activeWorkers.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget)}
        title="¿Eliminar acceso?"
        message="El usuario no podrá entrar al sistema. Sus registros no se borran."
        confirmLabel="Eliminar"
      />
    </div>
  )
}
