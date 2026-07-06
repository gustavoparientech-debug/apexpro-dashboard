import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import {
  Camera, MapPin, Clock, LogIn, Coffee, LogOut, CheckCircle,
  Loader2, ChevronDown, AlertTriangle, Pencil, Trash2, ShieldAlert, BarChart2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

// ── Geovalla ──────────────────────────────────────────────────────────────────
const WORKPLACE_LAT  = -16.3596   // Zamacola, Arequipa — ajusta si es necesario
const WORKPLACE_LON  = -71.5706
const GEOFENCE_M     = 999999     // TODO: cambiar a 300 cuando se configure la ubicación real del taller

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TYPE_LABEL = { entrada: 'Entrada', almuerzo_inicio: 'Inicio almuerzo', almuerzo_fin: 'Fin almuerzo', salida: 'Salida' }
const TYPE_COLOR = { entrada: 'text-green-600', almuerzo_inicio: 'text-orange-500', almuerzo_fin: 'text-blue-500', salida: 'text-red-500' }
const TYPE_BG    = { entrada: 'bg-green-500',  almuerzo_inicio: 'bg-orange-500',  almuerzo_fin: 'bg-blue-500',  salida: 'bg-red-500' }
const ALL_TYPES  = ['entrada', 'almuerzo_inicio', 'almuerzo_fin', 'salida']

// Calcula ms trabajados: (almuerzo_inicio - entrada) + (salida - almuerzo_fin)
// Si no hay almuerzo: entrada → salida/now. Durante almuerzo: solo primer tramo.
export function calcWorkMs(entradaLog, almuerzoIniLog, almuerzoFinLog, salidaLog, now = new Date()) {
  if (!entradaLog) return 0
  const start = new Date(entradaLog.logged_at)
  const end   = salidaLog ? new Date(salidaLog.logged_at) : now
  if (!almuerzoIniLog) return Math.max(0, end - start)
  const lunchStart = new Date(almuerzoIniLog.logged_at)
  const part1 = Math.max(0, lunchStart - start)
  if (!almuerzoFinLog) return part1
  const lunchEnd = new Date(almuerzoFinLog.logged_at)
  const part2 = Math.max(0, end - lunchEnd)
  return part1 + part2
}

function fmtTime(ts) { return new Date(ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
function fmtDuration(ms) {
  if (ms <= 0) return '0m'
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function Asistencia() {
  const { profile, isAdmin, isDemo } = useAuth()
  const navigate = useNavigate()
  const { workers, addIncident } = useApp()

  const [selectedWorkerId, setSelectedWorkerId] = useState(profile?.worker_id || '')
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [schedules, setSchedules] = useState([])
  const [saving, setSaving]   = useState(false)
  const [now, setNow]         = useState(new Date())

  // Admin panel
  const [adminDate, setAdminDate]       = useState(new Date().toISOString().slice(0, 10))
  const [adminWorker, setAdminWorker]   = useState('')
  const [adminLogs, setAdminLogs]       = useState([])
  const [editingLog, setEditingLog]     = useState(null)
  const [editTime, setEditTime]         = useState('')
  const [adminLoading, setAdminLoading] = useState(false)

  // Camera
  const [camOpen, setCamOpen]     = useState(false)
  const [pendingType, setPendingType] = useState(null)
  const [photo, setPhoto]         = useState(null)
  const [location, setLocation]   = useState(null)
  const [geoStatus, setGeoStatus] = useState('idle') // idle | loading | ok | outside | denied | settings
  const [countdown, setCountdown] = useState(null) // 3,2,1,null
  const cachedLocRef   = useRef(null)
  const countdownRef   = useRef(null)
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef   = useRef(null)

  const worker = workers.find(w => w.id === selectedWorkerId)
  const today  = new Date().toISOString().slice(0, 10)

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  useEffect(() => {
    supabase.from('work_schedules').select('*').then(({ data }) => setSchedules(data || []))
  }, [])
  useEffect(() => { if (!isAdmin && !isDemo && profile?.worker_id) setSelectedWorkerId(profile.worker_id) }, [profile, isAdmin, isDemo])

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

  // Pedir permisos de GPS y cámara al cargar la página (para que el navegador los recuerde)
  useEffect(() => {
    // Solicitar GPS proactivamente — el navegador mostrará el diálogo la primera vez
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => { cachedLocRef.current = pos },
        () => {}, // silencioso si ya fue denegado
        { timeout: 30000, maximumAge: 60000 }
      )
    }
  }, [])

  // Admin: load logs for any worker+date
  const loadAdminLogs = useCallback(async () => {
    if (!adminWorker) { setAdminLogs([]); return }
    setAdminLoading(true)
    const { data } = await supabase.from('attendance_logs')
      .select('*').eq('worker_id', adminWorker).eq('date', adminDate)
      .order('logged_at', { ascending: true })
    setAdminLogs(data || [])
    setAdminLoading(false)
  }, [adminWorker, adminDate])

  useEffect(() => { if (isAdmin || isDemo) loadAdminLogs() }, [loadAdminLogs, isAdmin, isDemo])

  // Derive status
  const hasEntrada     = logs.some(l => l.type === 'entrada')
  const hasAlmuerzo    = logs.some(l => l.type === 'almuerzo_inicio')
  const hasAlmuerzoFin = logs.some(l => l.type === 'almuerzo_fin')
  const hasSalida      = logs.some(l => l.type === 'salida')

  const nextType = hasSalida ? null
    : !hasEntrada ? 'entrada'
    : hasAlmuerzo && !hasAlmuerzoFin ? 'almuerzo_fin'
    : !hasAlmuerzo ? 'almuerzo_inicio'
    : 'salida'

  const entradaLog      = logs.find(l => l.type === 'entrada')
  const almuerzoIniLog  = logs.find(l => l.type === 'almuerzo_inicio')
  const almuerzoFinLog  = logs.find(l => l.type === 'almuerzo_fin')
  const salidaLog       = logs.find(l => l.type === 'salida')
  const trabajadoMs     = calcWorkMs(entradaLog, almuerzoIniLog, almuerzoFinLog, salidaLog, now)
  const trabajado       = entradaLog ? fmtDuration(trabajadoMs) : null

  // ── Camera & Geo ──────────────────────────────────────────────────────────
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
      // Auto-captura después de 3 segundos
      startCountdown()
    } catch { /* fallback a input file — sin countdown */ }
  }

  function startCountdown() {
    clearInterval(countdownRef.current)
    setCountdown(3)
    let c = 3
    countdownRef.current = setInterval(() => {
      c -= 1
      if (c <= 0) {
        clearInterval(countdownRef.current)
        setCountdown(null)
        capturePhotoNow()
      } else {
        setCountdown(c)
      }
    }, 1000)
  }

  function stopCamera() {
    clearInterval(countdownRef.current)
    setCountdown(null)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  function capturePhotoNow() {
    if (videoRef.current && canvasRef.current) {
      canvasRef.current.width = 320; canvasRef.current.height = 240
      canvasRef.current.getContext('2d').drawImage(videoRef.current, 0, 0, 320, 240)
      setPhoto(canvasRef.current.toDataURL('image/jpeg', 0.65))
      stopCamera()
    }
  }
  // mantener capturePhoto como alias para el botón manual
  const capturePhoto = capturePhotoNow
  function handleFileCapture(e) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setPhoto(ev.target.result)
    reader.readAsDataURL(file)
  }

  async function openAction(type) {
    if (!selectedWorkerId) { toast.error('Selecciona un trabajador'); return }
    setPendingType(type); setPhoto(null); setGeoStatus('loading')
    setCamOpen(true)
    setTimeout(startCamera, 300)

    // Usar ubicación cacheada si es reciente (< 90 seg)
    const cached = cachedLocRef.current
    if (cached && (Date.now() - cached.timestamp) < 90000) {
      const dist = haversineM(cached.coords.latitude, cached.coords.longitude, WORKPLACE_LAT, WORKPLACE_LON)
      setLocation({ lat: cached.coords.latitude, lon: cached.coords.longitude, dist: Math.round(dist) })
      setGeoStatus(dist <= GEOFENCE_M ? 'ok' : 'outside')
      return
    }

    // Solicitar GPS directamente — Chrome pedirá permiso si no fue dado antes
    navigator.geolocation?.getCurrentPosition(
      pos => {
        cachedLocRef.current = pos
        const dist = haversineM(pos.coords.latitude, pos.coords.longitude, WORKPLACE_LAT, WORKPLACE_LON)
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, dist: Math.round(dist) })
        setGeoStatus(dist <= GEOFENCE_M ? 'ok' : 'outside')
      },
      err => {
        // code 1 = bloqueado en ajustes del navegador/OS
        // code 2 = GPS apagado o señal no disponible
        // code 3 = timeout
        setGeoStatus(err.code === 1 ? 'settings' : 'denied')
      },
      { timeout: 30000, maximumAge: 60000, enableHighAccuracy: false }
    )
  }

  function closeCamera() { stopCamera(); setCamOpen(false); setPendingType(null); setPhoto(null); setGeoStatus('idle') }

  async function autoCreateIncident(type, hoursLate, dateStr, workerId) {
    try {
      await addIncident({
        worker_id: workerId,
        date: dateStr,
        type,
        hours_late: hoursLate,
        apply_discount: true,
        observation: type === 'tardanza'
          ? `Tardanza automática — ${Math.round(hoursLate * 60)} min tarde`
          : `Salida anticipada automática — ${Math.round(hoursLate * 60)} min faltantes`,
      })
    } catch (err) {
      console.error('autoCreateIncident error:', err)
    }
  }

  async function confirmLog() {
    if (geoStatus === 'outside') { toast.error('Estás fuera del área del taller'); return }
    // 'denied' y 'settings' se permiten — no se guardará coordenadas pero la foto verifica la presencia
    setSaving(true)
    try {
      const loggedAt = new Date()
      await supabase.from('attendance_logs').insert({
        worker_id: selectedWorkerId, type: pendingType, date: today,
        logged_at: loggedAt.toISOString(),
        latitude: location?.lat ?? null, longitude: location?.lon ?? null,
        photo_b64: photo || null,
      })

      // Obtener horario del trabajador (por schedule_id o campos directos)
      const worker = workers.find(w => w.id === selectedWorkerId)
      const sched = worker?.schedule_id
        ? schedules.find(s => s.id === worker.schedule_id)
        : (worker?.schedule_start ? { start_time: worker.schedule_start, end_time: worker.schedule_end, tolerance_min: worker.schedule_tolerance_min ?? 5 } : null)

      // Auto-incidencia por tardanza
      if (sched?.start_time && pendingType === 'entrada') {
        const [sh, sm] = sched.start_time.split(':').map(Number)
        const scheduled = new Date(loggedAt)
        scheduled.setHours(sh, sm, 0, 0)
        const toleranceMs = (sched.tolerance_min ?? 5) * 60000
        const diffMs = loggedAt - scheduled
        if (diffMs > toleranceMs) {
          const hoursLate = Math.round(diffMs / 60000) / 60
          await autoCreateIncident('tardanza', hoursLate, today, selectedWorkerId)
          toast(`Tardanza registrada: ${Math.round(diffMs / 60000)} min`, { icon: '⚠️' })
        }
      }

      // Auto-incidencia por salida anticipada
      if (sched?.end_time && pendingType === 'salida') {
        const [eh, em] = sched.end_time.split(':').map(Number)
        const scheduled = new Date(loggedAt)
        scheduled.setHours(eh, em, 0, 0)
        const toleranceMs = (sched.tolerance_min ?? 5) * 60000
        const diffMs = scheduled - loggedAt
        if (diffMs > toleranceMs) {
          const hoursEarly = Math.round(diffMs / 60000) / 60
          await autoCreateIncident('permiso_horas', hoursEarly, today, selectedWorkerId)
          toast(`Salida anticipada: ${Math.round(diffMs / 60000)} min antes`, { icon: '⚠️' })
        }
      }

      toast.success(`${TYPE_LABEL[pendingType]} registrada`)
      closeCamera(); await loadLogs()
    } catch (err) { toast.error('Error: ' + err.message) }
    finally { setSaving(false) }
  }

  // ── Admin edit ────────────────────────────────────────────────────────────
  async function saveEditLog() {
    if (!editingLog || !editTime) return
    const [h, m, s] = editTime.split(':').map(Number)
    const base = new Date(editingLog.logged_at)
    base.setHours(h, m, s || 0, 0)
    const { error } = await supabase.from('attendance_logs').update({ logged_at: base.toISOString() }).eq('id', editingLog.id)
    if (error) { toast.error(error.message); return }
    toast.success('Hora actualizada')
    setEditingLog(null); loadAdminLogs()
    if (adminWorker === selectedWorkerId && adminDate === today) loadLogs()
  }
  async function deleteAdminLog(id) {
    await supabase.from('attendance_logs').delete().eq('id', id)
    toast.success('Registro eliminado')
    loadAdminLogs()
    if (adminWorker === selectedWorkerId && adminDate === today) loadLogs()
  }

  const ACTION = {
    entrada:         { label: 'Registrar Entrada',  icon: LogIn,  color: 'bg-green-500 hover:bg-green-600' },
    almuerzo_inicio: { label: 'Iniciar Almuerzo',   icon: Coffee, color: 'bg-orange-500 hover:bg-orange-600' },
    almuerzo_fin:    { label: 'Terminar Almuerzo',  icon: Coffee, color: 'bg-blue-500 hover:bg-blue-600' },
    salida:          { label: 'Registrar Salida',   icon: LogOut, color: 'bg-red-500 hover:bg-red-600' },
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      {/* Reporte shortcut for admin */}
      {(isAdmin || isDemo) && (
        <button onClick={() => navigate('/asistencia/reporte')}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <BarChart2 className="w-4 h-4 text-red-500" />
          Ver reporte de horas
        </button>
      )}

      {/* Clock */}
      <div className="card text-center py-6">
        <p className="text-6xl font-black text-gray-900 dark:text-white tracking-tight leading-none" style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
          {now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </p>
        <p className="text-sm text-gray-500 mt-2 capitalize">{now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Worker selector (admin only) */}
      {(isAdmin || isDemo) ? (
        <div className="card">
          <label className="label">Trabajador</label>
          <div className="relative">
            <select value={selectedWorkerId} onChange={e => setSelectedWorkerId(e.target.value)} className="input appearance-none pr-8">
              <option value="">Seleccionar...</option>
              {workers.filter(w => w.active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      ) : worker ? (
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 font-bold">{worker.name[0]}</div>
          <div><p className="font-semibold text-gray-900 dark:text-white">{worker.name}</p><p className="text-xs text-gray-500">Técnico</p></div>
        </div>
      ) : (
        <div className="card text-center text-sm text-gray-400">Cuenta no vinculada a un trabajador.</div>
      )}

      {/* Status & Timeline */}
      {selectedWorkerId && !loading && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className={`font-semibold ${hasSalida ? 'text-gray-400' : hasAlmuerzo && !hasAlmuerzoFin ? 'text-orange-500' : hasEntrada ? 'text-green-500' : 'text-gray-400'}`}>
              {hasSalida ? 'Jornada completa' : hasAlmuerzoFin ? 'Trabajando' : hasAlmuerzo ? 'En almuerzo' : hasEntrada ? 'Trabajando' : 'Sin fichar hoy'}
            </p>
            {trabajado && <span className="text-xs text-gray-500">Tiempo: <strong>{trabajado}</strong></span>}
          </div>
          {logs.length > 0 ? (
            <div className="space-y-2 border-t border-gray-100 dark:border-gray-700 pt-3">
              {logs.map(log => (
                <div key={log.id} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${TYPE_BG[log.type]}`} />
                  <span className={`text-sm font-medium ${TYPE_COLOR[log.type]}`}>{TYPE_LABEL[log.type]}</span>
                  <span className="text-xs text-gray-400 ml-auto flex items-center gap-1">
                    <Clock className="w-3 h-3" />{fmtTime(log.logged_at)}
                    {log.latitude && <MapPin className="w-3 h-3 ml-1 text-blue-400" />}
                    {log.photo_b64 && <Camera className="w-3 h-3 ml-1 text-purple-400" />}
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400 text-center py-2">Sin registros hoy</p>}
        </div>
      )}

      {/* Action button */}
      {selectedWorkerId && !loading && !hasSalida && nextType && (() => {
        const a = ACTION[nextType]; const Icon = a.icon
        return (
          <button onClick={() => openAction(nextType)}
            className={`w-full py-4 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-3 shadow-lg transition-all ${a.color}`}>
            <Icon className="w-6 h-6" />{a.label}
          </button>
        )
      })()}

      {selectedWorkerId && hasSalida && (
        <div className="card text-center py-6">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="font-semibold text-gray-700 dark:text-gray-300">Jornada completada</p>
          {trabajado && <p className="text-sm text-gray-400 mt-1">Tiempo: <strong>{trabajado}</strong></p>}
        </div>
      )}
      {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}

      {/* ── Admin edit panel ──────────────────────────────────────────── */}
      {(isAdmin || isDemo) && (
        <div className="card border-2 border-amber-200 dark:border-amber-800/40">
          <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Panel de administrador — Editar registros
          </p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="label text-xs">Trabajador</label>
              <select value={adminWorker} onChange={e => setAdminWorker(e.target.value)} className="input text-sm">
                <option value="">Seleccionar...</option>
                {workers.filter(w => w.active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs">Fecha</label>
              <input type="date" value={adminDate} onChange={e => setAdminDate(e.target.value)} className="input text-sm" />
            </div>
          </div>
          {adminLoading && <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>}
          {!adminLoading && adminWorker && (
            adminLogs.length === 0
              ? <p className="text-sm text-gray-400 text-center py-2">Sin registros ese día</p>
              : <div className="space-y-2">
                  {adminLogs.map(log => (
                    <div key={log.id} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${TYPE_BG[log.type]}`} />
                      <span className={`text-sm font-medium ${TYPE_COLOR[log.type]}`}>{TYPE_LABEL[log.type]}</span>
                      <span className="text-xs text-gray-400 ml-auto">{fmtTime(log.logged_at)}</span>
                      <button onClick={() => { setEditingLog(log); setEditTime(new Date(log.logged_at).toTimeString().slice(0,8)) }}
                        className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteAdminLog(log.id)}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  {/* Add missing entry */}
                  {adminLogs.length < 4 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {ALL_TYPES.filter(t => !adminLogs.some(l => l.type === t)).map(t => (
                        <button key={t} onClick={async () => {
                          const wid = adminWorker
                          await supabase.from('attendance_logs').insert({ worker_id: wid, type: t, date: adminDate })
                          toast.success(`${TYPE_LABEL[t]} añadida`); loadAdminLogs()
                          if (wid === selectedWorkerId && adminDate === today) loadLogs()
                        }}
                          className="text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-lg">
                          + {TYPE_LABEL[t]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
          )}
          {/* Edit time modal */}
          {editingLog && (
            <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3 flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Editar hora de <strong>{TYPE_LABEL[editingLog.type]}</strong>:</span>
              <input type="time" step="1" value={editTime} onChange={e => setEditTime(e.target.value)} className="input text-sm py-1 w-32" />
              <button onClick={saveEditLog} className="btn-primary text-xs py-1.5 px-3">Guardar</button>
              <button onClick={() => setEditingLog(null)} className="btn-secondary text-xs py-1.5 px-3">Cancelar</button>
            </div>
          )}
        </div>
      )}

      {/* ── Camera Modal ─────────────────────────────────────────────── */}
      {camOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <p className="font-bold text-gray-900 dark:text-white text-lg">Confirmar {TYPE_LABEL[pendingType]}</p>
              <p className="text-sm text-gray-500">{now.toLocaleTimeString('es-PE')}</p>
            </div>
            <div className="p-4 space-y-3">
              {/* Geo status */}
              {geoStatus === 'loading' && (
                <div className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-800 text-gray-400 px-3 py-2 rounded-lg">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verificando ubicación...
                </div>
              )}
              {geoStatus === 'ok' && (
                <div className="flex items-center gap-2 text-xs bg-green-50 dark:bg-green-900/20 text-green-600 px-3 py-2 rounded-lg">
                  <MapPin className="w-3.5 h-3.5" /> Ubicación verificada · {location?.dist}m del taller ✓
                </div>
              )}
              {geoStatus === 'outside' && (
                <div className="flex items-center gap-2 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 px-3 py-2 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5" /> Fuera del área · {location?.dist}m del taller (máx {GEOFENCE_M}m)
                </div>
              )}
              {geoStatus === 'denied' && (
                <div className="flex items-center gap-2 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 px-3 py-2 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5" /> No se pudo obtener la ubicación. Activa el GPS del teléfono.
                </div>
              )}
              {geoStatus === 'settings' && (
                <div className="flex flex-col gap-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 px-3 py-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Permiso de ubicación bloqueado. Ve a <strong>Ajustes → Permisos → Ubicación</strong> y actívalo para esta app.</span>
                  </div>
                </div>
              )}

              {/* Camera */}
              {!photo ? (
                <div className="relative bg-black rounded-xl overflow-hidden" style={{ height: 210 }}>
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                  {/* Countdown */}
                  {countdown !== null && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white font-bold drop-shadow-lg" style={{ fontSize: 80, lineHeight: 1 }}>{countdown}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-end pb-3 gap-2">
                    <button onClick={() => { clearInterval(countdownRef.current); setCountdown(null); capturePhoto() }}
                      className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center">
                      <Camera className="w-7 h-7 text-gray-800" />
                    </button>
                    <button onClick={() => fileRef.current?.click()} className="text-xs text-white bg-black/40 px-3 py-1 rounded-full">Usar galería</button>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden" style={{ height: 210 }}>
                  <img src={photo} alt="foto" className="w-full h-full object-cover" />
                  <button onClick={() => { setPhoto(null); setTimeout(startCamera, 200) }}
                    className="absolute top-2 right-2 text-xs bg-black/60 text-white px-2 py-1 rounded-full">Repetir</button>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileCapture} />
            </div>

            <div className="flex gap-3 px-4 pb-4">
              <button onClick={closeCamera} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300">Cancelar</button>
              <button onClick={confirmLog}
                disabled={saving || !photo || geoStatus === 'outside' || geoStatus === 'loading'}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
