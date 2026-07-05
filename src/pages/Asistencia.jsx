import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { Camera, MapPin, Clock, LogIn, Coffee, LogOut, CheckCircle, Loader2, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

const TYPE_LABEL = {
  entrada: 'Entrada', almuerzo_inicio: 'Inicio almuerzo',
  almuerzo_fin: 'Fin almuerzo', salida: 'Salida',
}
const TYPE_COLOR = {
  entrada: 'text-green-600', almuerzo_inicio: 'text-orange-500',
  almuerzo_fin: 'text-blue-500', salida: 'text-red-500',
}
const TYPE_BG = {
  entrada: 'bg-green-500', almuerzo_inicio: 'bg-orange-500',
  almuerzo_fin: 'bg-blue-500', salida: 'bg-red-500',
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function fmtDuration(ms) {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function Asistencia() {
  const { profile, isAdmin, isDemo } = useAuth()
  const { workers } = useApp()

  const [selectedWorkerId, setSelectedWorkerId] = useState(profile?.worker_id || '')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(new Date())

  // Camera state
  const [camOpen, setCamOpen] = useState(false)
  const [pendingType, setPendingType] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [location, setLocation] = useState(null)
  const [locError, setLocError] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)

  const worker = workers.find(w => w.id === selectedWorkerId)
  const today = new Date().toISOString().slice(0, 10)

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Auto-select worker for non-admin
  useEffect(() => {
    if (!isAdmin && !isDemo && profile?.worker_id) setSelectedWorkerId(profile.worker_id)
  }, [profile, isAdmin, isDemo])

  const loadLogs = useCallback(async () => {
    if (!selectedWorkerId) { setLogs([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('attendance_logs')
      .select('*').eq('worker_id', selectedWorkerId).eq('date', today)
      .order('logged_at', { ascending: true })
    setLogs(data || [])
    setLoading(false)
  }, [selectedWorkerId, today])

  useEffect(() => { loadLogs() }, [loadLogs])

  // Derive status
  const hasEntrada      = logs.some(l => l.type === 'entrada')
  const hasAlmuerzo     = logs.some(l => l.type === 'almuerzo_inicio')
  const hasAlmuerzoFin  = logs.some(l => l.type === 'almuerzo_fin')
  const hasSalida       = logs.some(l => l.type === 'salida')

  const nextType = hasSalida ? null
    : !hasEntrada ? 'entrada'
    : hasAlmuerzo && !hasAlmuerzoFin ? 'almuerzo_fin'
    : !hasAlmuerzo ? 'almuerzo_inicio'
    : 'salida'

  const statusLabel = hasSalida ? 'Jornada completada'
    : hasAlmuerzoFin ? 'Trabajando (post almuerzo)'
    : hasAlmuerzo ? 'En almuerzo'
    : hasEntrada ? 'Trabajando'
    : 'Sin fichar hoy'

  const statusColor = hasSalida ? 'text-gray-400'
    : hasAlmuerzo && !hasAlmuerzoFin ? 'text-orange-500'
    : hasEntrada ? 'text-green-500'
    : 'text-gray-400'

  // Working duration
  const entradaLog = logs.find(l => l.type === 'entrada')
  const salidaLog  = logs.find(l => l.type === 'salida')
  const trabajado  = entradaLog
    ? fmtDuration((salidaLog ? new Date(salidaLog.logged_at) : now) - new Date(entradaLog.logged_at))
    : null

  // ── Camera ────────────────────────────────────────────────────────────
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
    } catch {
      // fallback to file input
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  function capturePhoto() {
    if (videoRef.current && canvasRef.current) {
      const v = videoRef.current
      canvasRef.current.width  = 320
      canvasRef.current.height = 240
      canvasRef.current.getContext('2d').drawImage(v, 0, 0, 320, 240)
      const b64 = canvasRef.current.toDataURL('image/jpeg', 0.65)
      setPhoto(b64)
      stopCamera()
    }
  }

  function handleFileCapture(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setPhoto(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function openAction(type) {
    if (!selectedWorkerId) { toast.error('Selecciona un trabajador'); return }
    setPendingType(type)
    setPhoto(null)
    setLocation(null)
    setLocError(false)
    setCamOpen(true)
    // Geolocation
    navigator.geolocation?.getCurrentPosition(
      pos => setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      ()  => setLocError(true),
      { timeout: 8000 }
    )
    // Start camera after short delay
    setTimeout(startCamera, 300)
  }

  function closeCamera() {
    stopCamera()
    setCamOpen(false)
    setPendingType(null)
    setPhoto(null)
  }

  async function confirmLog() {
    setSaving(true)
    try {
      const payload = {
        worker_id: selectedWorkerId,
        type: pendingType,
        date: today,
        logged_at: new Date().toISOString(),
        latitude: location?.lat ?? null,
        longitude: location?.lon ?? null,
        photo_b64: photo || null,
      }
      const { error } = await supabase.from('attendance_logs').insert(payload)
      if (error) throw error
      toast.success(`${TYPE_LABEL[pendingType]} registrada`)
      closeCamera()
      await loadLogs()
    } catch (err) {
      toast.error('Error al guardar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Action button config ──────────────────────────────────────────────
  const ACTION = {
    entrada:        { label: 'Registrar Entrada',   icon: LogIn,   color: 'bg-green-500 hover:bg-green-600' },
    almuerzo_inicio:{ label: 'Iniciar Almuerzo',    icon: Coffee,  color: 'bg-orange-500 hover:bg-orange-600' },
    almuerzo_fin:   { label: 'Terminar Almuerzo',   icon: Coffee,  color: 'bg-blue-500 hover:bg-blue-600' },
    salida:         { label: 'Registrar Salida',    icon: LogOut,  color: 'bg-red-500 hover:bg-red-600' },
  }

  const canTakeAction = !hasSalida && !!nextType

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {/* Header clock */}
      <div className="card text-center py-6">
        <p className="text-4xl font-bold font-mono text-gray-900 dark:text-white tracking-widest">
          {now.toLocaleTimeString('es-PE')}
        </p>
        <p className="text-sm text-gray-500 mt-1 capitalize">
          {now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Worker selector */}
      {(isAdmin || isDemo) ? (
        <div className="card">
          <label className="label">Trabajador</label>
          <div className="relative">
            <select value={selectedWorkerId} onChange={e => setSelectedWorkerId(e.target.value)}
              className="input appearance-none pr-8">
              <option value="">Seleccionar trabajador...</option>
              {workers.filter(w => w.active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      ) : worker ? (
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 font-bold">
            {worker.name[0]}
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{worker.name}</p>
            <p className="text-xs text-gray-500">Cargo: Técnico</p>
          </div>
        </div>
      ) : (
        <div className="card text-center text-sm text-gray-400">Tu cuenta no está vinculada a un trabajador.</div>
      )}

      {/* Status */}
      {selectedWorkerId && !loading && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className={`font-semibold ${statusColor}`}>{statusLabel}</p>
            {trabajado && <span className="text-xs text-gray-500">Tiempo: <strong>{trabajado}</strong></span>}
          </div>

          {/* Timeline */}
          {logs.length > 0 && (
            <div className="space-y-2 mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
              {logs.map(log => (
                <div key={log.id} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${TYPE_BG[log.type]}`} />
                  <span className={`text-sm font-medium ${TYPE_COLOR[log.type]}`}>{TYPE_LABEL[log.type]}</span>
                  <span className="text-xs text-gray-400 ml-auto flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {fmtTime(log.logged_at)}
                    {log.latitude && <MapPin className="w-3 h-3 ml-1 text-blue-400" />}
                    {log.photo_b64 && <Camera className="w-3 h-3 ml-1 text-purple-400" />}
                  </span>
                </div>
              ))}
            </div>
          )}

          {logs.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-2">Sin registros hoy</p>
          )}
        </div>
      )}

      {/* Action button */}
      {selectedWorkerId && !loading && canTakeAction && (() => {
        const a = ACTION[nextType]
        const Icon = a.icon
        return (
          <button onClick={() => openAction(nextType)}
            className={`w-full py-4 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-3 shadow-lg transition-all ${a.color}`}>
            <Icon className="w-6 h-6" /> {a.label}
          </button>
        )
      })()}

      {selectedWorkerId && hasSalida && (
        <div className="card text-center py-6">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="font-semibold text-gray-700 dark:text-gray-300">Jornada completada</p>
          <p className="text-sm text-gray-400 mt-1">Tiempo trabajado: <strong>{trabajado}</strong></p>
        </div>
      )}

      {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}

      {/* ── Camera Modal ─────────────────────────────────────────────── */}
      {camOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <p className="font-bold text-gray-900 dark:text-white text-lg">
                Confirmar {TYPE_LABEL[pendingType]}
              </p>
              <p className="text-sm text-gray-500">{now.toLocaleTimeString('es-PE')}</p>
            </div>

            <div className="p-4 space-y-3">
              {/* Photo area */}
              {!photo ? (
                <div className="relative bg-black rounded-xl overflow-hidden" style={{ height: 220 }}>
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                  <div className="absolute inset-0 flex flex-col items-center justify-end pb-4 gap-2">
                    <button onClick={capturePhoto}
                      className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center">
                      <Camera className="w-7 h-7 text-gray-800" />
                    </button>
                    <button onClick={() => fileRef.current?.click()}
                      className="text-xs text-white bg-black/40 px-3 py-1 rounded-full">
                      Usar galería
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden" style={{ height: 220 }}>
                  <img src={photo} alt="foto" className="w-full h-full object-cover" />
                  <button onClick={() => { setPhoto(null); startCamera() }}
                    className="absolute top-2 right-2 text-xs bg-black/60 text-white px-2 py-1 rounded-full">
                    Repetir
                  </button>
                </div>
              )}

              <canvas ref={canvasRef} className="hidden" />
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileCapture} />

              {/* Location */}
              <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                location ? 'bg-green-50 dark:bg-green-900/20 text-green-600'
                : locError ? 'bg-red-50 dark:bg-red-900/20 text-red-500'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-400'}`}>
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {location ? `GPS: ${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}`
                  : locError ? 'Sin acceso a ubicación'
                  : 'Obteniendo ubicación...'}
              </div>
            </div>

            <div className="flex gap-3 px-4 pb-4">
              <button onClick={closeCamera}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300">
                Cancelar
              </button>
              <button onClick={confirmLog} disabled={saving || !photo}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
