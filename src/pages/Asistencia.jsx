import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { calcLatenessDiscount, calcOvertimePay } from '../lib/utils'
import {
  Camera, MapPin, Clock, LogIn, Coffee, LogOut, CheckCircle,
  Loader2, ChevronDown, AlertTriangle, Pencil, Trash2, ShieldAlert, BarChart2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

// ── Geovalla ──────────────────────────────────────────────────────────────────
const WORKPLACE_LAT  = -16.3550567
const WORKPLACE_LON  = -71.5607376
const GEOFENCE_M     = 500  // 500m para tolerar imprecisión GPS (~2-3 manzanas)

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
  const { workers } = useApp()

  const [selectedWorkerId, setSelectedWorkerId] = useState(profile?.worker_id || '')
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [schedules, setSchedules] = useState([])
  const [saving, setSaving]   = useState(false)
  const [now, setNow]         = useState(new Date())

  // Admin panel
  const [adminDate, setAdminDate]       = useState(new Date().toLocaleDateString('en-CA'))
  const [adminWorker, setAdminWorker]   = useState('')
  const [adminLogs, setAdminLogs]       = useState([])
  const [editingLog, setEditingLog]     = useState(null)
  const [editTime, setEditTime]         = useState('')
  const [viewPhoto, setViewPhoto]       = useState(null)
  const [adminLoading, setAdminLoading] = useState(false)
  const [addingEntry, setAddingEntry]   = useState(null) // { type } — formulario inline para nuevo registro

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
  const today  = new Date().toLocaleDateString('en-CA')

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
      const vw = videoRef.current.videoWidth  || 640
      const vh = videoRef.current.videoHeight || 480
      // Escalar manteniendo relación de aspecto con máx 640px de ancho
      const scale = Math.min(1, 640 / Math.max(vw, vh))
      canvasRef.current.width  = Math.round(vw * scale)
      canvasRef.current.height = Math.round(vh * scale)
      canvasRef.current.getContext('2d').drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
      setPhoto(canvasRef.current.toDataURL('image/jpeg', 0.70))
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
      { timeout: 30000, maximumAge: 30000, enableHighAccuracy: true }
    )
  }

  function closeCamera() { stopCamera(); setCamOpen(false); setPendingType(null); setPhoto(null); setGeoStatus('idle') }

  async function autoCreateIncident(type, hoursLate, dateStr, workerId) {
    const worker = workers.find(w => w.id === workerId)
    const discount = worker ? calcLatenessDiscount(worker.base_salary, worker.weekly_hours, hoursLate) : 0
    const { error } = await supabase.from('attendance_incidents').insert({
      worker_id: workerId, date: dateStr, type,
      hours_late: hoursLate, apply_discount: true, discount_amount: discount,
      observation: type === 'tardanza'
        ? `Tardanza automática — ${Math.round(hoursLate * 60)} min tarde`
        : `Salida anticipada automática — ${Math.round(hoursLate * 60)} min faltantes`,
    })
    if (error) toast.error(`Error incidencia auto: ${error.message}`)
  }

  async function autoCreateOvertime(hoursExtra, dateStr, workerId) {
    const worker = workers.find(w => w.id === workerId)
    const pay = worker ? calcOvertimePay(worker.base_salary, worker.weekly_hours, hoursExtra) : 0
    const { error } = await supabase.from('attendance_incidents').insert({
      worker_id: workerId, date: dateStr, type: 'hora_extra',
      hours_late: hoursExtra, apply_discount: false, discount_amount: pay, is_addition: true,
      observation: `Hora extra automática — ${Math.round(hoursExtra * 60)} min extra (pendiente aprobación)`,
    })
    if (error) toast.error(`Error hora extra auto: ${error.message}`)
  }

  async function confirmLog() {
    if (geoStatus === 'outside') { toast.error('Estás fuera del área del taller'); return }
    if (geoStatus === 'denied') { toast.error('Activa el GPS para poder marcar'); return }
    if (geoStatus === 'settings') { toast.error('Permite el acceso a ubicación en Ajustes para poder marcar'); return }
    setSaving(true)
    try {
      const loggedAt = new Date()
      await supabase.from('attendance_logs').insert({
        worker_id: selectedWorkerId, type: pendingType, date: today,
        logged_at: loggedAt.toISOString(),
        latitude: location?.lat ?? null, longitude: location?.lon ?? null,
        photo_b64: photo || null,
      })

      // Fetch fresco del worker para evitar caché stale
      const { data: freshWorker } = await supabase.from('workers').select('*').eq('id', selectedWorkerId).single()
      let sched = null
      if (freshWorker?.schedule_id) {
        const { data: freshSched } = await supabase.from('work_schedules').select('*').eq('id', freshWorker.schedule_id).single()
        sched = freshSched
      } else if (freshWorker?.schedule_start) {
        sched = { start_time: freshWorker.schedule_start, end_time: freshWorker.schedule_end, tolerance_min: freshWorker.schedule_tolerance_min ?? 0 }
      }

      // Convierte "HH:MM:SS" a minutos del día (sin depender de timezone)
      function timeToMin(t) {
        const [h, m] = (t || '').split(':').map(Number)
        return h * 60 + (m || 0)
      }
      // Minutos locales actuales del dispositivo
      const nowMin = loggedAt.getHours() * 60 + loggedAt.getMinutes()
      const tolerance = sched?.tolerance_min ?? 0

      // Auto-incidencia por tardanza (máx 4h para evitar falsos en pruebas fuera de horario)
      if (sched?.start_time && pendingType === 'entrada') {
        const schedMin = timeToMin(sched.start_time)
        const diffMin = nowMin - schedMin
        if (diffMin > tolerance && diffMin <= 240) {
          const hoursLate = Math.round(diffMin) / 60
          await autoCreateIncident('tardanza', hoursLate, today, selectedWorkerId)
          toast(`Tardanza registrada: ${Math.round(diffMin)} min`, { icon: '⚠️' })
        }
      }

      // Auto-incidencia por salida anticipada (máx 4h para evitar falsos en pruebas fuera de horario)
      if (sched?.end_time && pendingType === 'salida') {
        const schedMin = timeToMin(sched.end_time)
        const earlyMin = schedMin - nowMin
        const lateMin  = nowMin - schedMin
        if (earlyMin > tolerance && earlyMin <= 240) {
          const hoursEarly = Math.round(earlyMin) / 60
          await autoCreateIncident('permiso_horas', hoursEarly, today, selectedWorkerId)
          toast(`Salida anticipada: ${Math.round(earlyMin)} min antes`, { icon: '⚠️' })
        } else if (lateMin > tolerance) {
          const hoursExtra = Math.round(lateMin) / 60
          await autoCreateOvertime(hoursExtra, today, selectedWorkerId)
          toast(`Hora extra pendiente: ${Math.round(lateMin)} min`, { icon: '🟢' })
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
    setEditingLog(null); loadAdminLogs(); loadLogs()

    // Recalcular incidencia automática si es entrada o salida
    if (editingLog.type === 'entrada' || editingLog.type === 'salida') {
      const incType = editingLog.type === 'entrada' ? 'tardanza' : 'permiso_horas'
      // Buscar y eliminar solo la incidencia automática previa (por id para evitar borrar otras)
      const { data: prevAuto } = await supabase.from('attendance_incidents')
        .select('id, observation')
        .eq('worker_id', editingLog.worker_id)
        .eq('date', adminDate)
        .eq('type', incType)
      for (const row of (prevAuto || [])) {
        if (row.observation?.includes('automática') || row.observation?.includes('automatica')) {
          await supabase.from('attendance_incidents').delete().eq('id', row.id)
        }
      }

      // Fetch horario del trabajador
      const { data: fw } = await supabase.from('workers').select('*').eq('id', editingLog.worker_id).single()
      let sched = null
      if (fw?.schedule_id) {
        const { data: fs } = await supabase.from('work_schedules').select('*').eq('id', fw.schedule_id).single()
        sched = fs
      } else if (fw?.schedule_start) {
        sched = { start_time: fw.schedule_start, end_time: fw.schedule_end, tolerance_min: fw.schedule_tolerance_min ?? 0 }
      }
      if (!sched) return

      function timeToMin(t) {
        const [hh, mm] = (t || '').split(':').map(Number)
        return hh * 60 + (mm || 0)
      }
      const editedMin = h * 60 + m
      const tolerance = sched.tolerance_min ?? 0

      if (editingLog.type === 'entrada' && sched.start_time) {
        const diffMin = editedMin - timeToMin(sched.start_time)
        if (diffMin > tolerance && diffMin <= 240) {
          await autoCreateIncident('tardanza', Math.round(diffMin) / 60, adminDate, editingLog.worker_id)
          toast(`Tardanza recalculada: ${Math.round(diffMin)} min`, { icon: '⚠️' })
        }
      }
      if (editingLog.type === 'salida' && sched.end_time) {
        const schedEndMin = timeToMin(sched.end_time)
        const earlyMin = schedEndMin - editedMin
        const lateMin  = editedMin - schedEndMin
        if (earlyMin > tolerance && earlyMin <= 240) {
          await autoCreateIncident('permiso_horas', Math.round(earlyMin) / 60, adminDate, editingLog.worker_id)
          toast(`Salida anticipada recalculada: ${Math.round(earlyMin)} min`, { icon: '⚠️' })
        } else if (lateMin > tolerance) {
          // Borrar hora_extra automática previa antes de crear la nueva
          const { data: prevOT } = await supabase.from('attendance_incidents')
            .select('id, observation').eq('worker_id', editingLog.worker_id)
            .eq('date', adminDate).eq('type', 'hora_extra')
          for (const row of (prevOT || [])) {
            if (row.observation?.includes('automática') || row.observation?.includes('automatica')) {
              await supabase.from('attendance_incidents').delete().eq('id', row.id)
            }
          }
          await autoCreateOvertime(Math.round(lateMin) / 60, adminDate, editingLog.worker_id)
          toast(`Hora extra recalculada: ${Math.round(lateMin)} min`, { icon: '🟢' })
        }
      }
    }
  }
  async function deleteAdminLog(id) {
    await supabase.from('attendance_logs').delete().eq('id', id)
    toast.success('Registro eliminado')
    loadAdminLogs()
    loadLogs()
  }

  const ACTION = {
    entrada:         { label: 'Registrar Entrada',  icon: LogIn,  color: 'bg-green-500 hover:bg-green-600' },
    almuerzo_inicio: { label: 'Iniciar Almuerzo',   icon: Coffee, color: 'bg-orange-500 hover:bg-orange-600' },
    almuerzo_fin:    { label: 'Terminar Almuerzo',  icon: Coffee, color: 'bg-blue-500 hover:bg-blue-600' },
    salida:          { label: 'Registrar Salida',   icon: LogOut, color: 'bg-red-500 hover:bg-red-600' },
  }

  const isAuthorized = geoStatus === 'ok'
  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null
  const lastLogTime = lastLog ? new Date(lastLog.logged_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true }) : null

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-8">

      {/* ── Header: reloj + fecha + info cards ───────────────────────── */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-3xl font-black tabular-nums text-gray-900 dark:text-white">
              {now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
            <p className="text-xs text-gray-400 capitalize mt-0.5">
              {now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          {(isAdmin || isDemo) && (
            <button onClick={() => navigate('/asistencia/reporte')}
              className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <BarChart2 className="w-5 h-5 text-red-500" />
            </button>
          )}
        </div>
        {/* Último registro */}
        {lastLog && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
            <Clock className="w-4 h-4 text-gray-400 shrink-0" />
            Último registro: <strong>{TYPE_LABEL[lastLog.type]}</strong> a las {lastLogTime}
          </div>
        )}
        {/* Ubicación */}
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${isAuthorized ? 'bg-gray-50 dark:bg-gray-800' : 'bg-red-50 dark:bg-red-900/20'}`}>
          <MapPin className={`w-4 h-4 shrink-0 ${isAuthorized ? 'text-green-500' : 'text-red-500'}`} />
          <div>
            {!isAuthorized && <p className="text-xs font-bold uppercase tracking-wide text-red-600">Localización no autorizada</p>}
            <p className={`text-sm font-medium ${isAuthorized ? 'text-gray-700 dark:text-gray-200' : 'text-red-600'}`}>Apex Pro Detailing AQP</p>
          </div>
        </div>
      </div>

      {/* ── MAIN SECTION ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Worker selector (admin) */}
        {(isAdmin || isDemo) ? (
          <div className="relative">
            <select value={selectedWorkerId} onChange={e => setSelectedWorkerId(e.target.value)} className="input appearance-none pr-8 w-full">
              <option value="">Seleccionar trabajador...</option>
              {workers.filter(w => w.active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        ) : !worker && (
          <p className="text-sm text-gray-400 text-center">Cuenta no vinculada a un trabajador.</p>
        )}

        {/* Action button */}
        {selectedWorkerId && !loading && !hasSalida && nextType && (() => {
          const a = ACTION[nextType]; const Icon = a.icon
          return (
            <div className="space-y-2">
              <button onClick={() => openAction(nextType)}
                className={`w-full py-4 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-3 shadow-md transition-all ${a.color}`}>
                <Icon className="w-6 h-6" />{a.label}
              </button>
              {hasEntrada && !hasAlmuerzo && (
                <button onClick={() => openAction('salida')}
                  className="w-full py-3 rounded-2xl border-2 border-red-400 text-red-500 font-semibold text-base flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all">
                  <LogOut className="w-5 h-5" /> Salida sin almuerzo
                </button>
              )}
            </div>
          )
        })()}

        {selectedWorkerId && hasSalida && (
          <div className="flex items-center justify-center gap-3 py-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">Jornada completada</p>
              {trabajado && <p className="text-sm text-gray-400">Tiempo: <strong>{trabajado}</strong></p>}
            </div>
          </div>
        )}
        {loading && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>}

      {/* Status & Timeline */}
      {selectedWorkerId && !loading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className={`font-semibold ${hasSalida ? 'text-gray-400' : hasAlmuerzo && !hasAlmuerzoFin ? 'text-orange-500' : hasEntrada ? 'text-green-500' : 'text-gray-400'}`}>
              {hasSalida ? 'Jornada completa' : hasAlmuerzoFin ? 'Trabajando' : hasAlmuerzo ? 'En almuerzo' : hasEntrada ? 'Trabajando' : 'Sin fichar hoy'}
            </p>
            {trabajado && <span className="text-xs text-gray-500">Tiempo: <strong>{trabajado}</strong></span>}
          </div>
          {logs.length > 0 ? (
            <div className="space-y-2 border-t border-gray-100 dark:border-gray-700 pt-3">
              {logs.map(log => {
                const typePillColor = {
                  entrada: 'border-green-500 text-green-600 bg-green-50 dark:bg-green-900/10',
                  almuerzo_inicio: 'border-orange-400 text-orange-500 bg-orange-50 dark:bg-orange-900/10',
                  almuerzo_fin: 'border-blue-400 text-blue-500 bg-blue-50 dark:bg-blue-900/10',
                  salida: 'border-red-400 text-red-500 bg-red-50 dark:bg-red-900/10',
                }[log.type] || 'border-gray-300 text-gray-500'
                const typeIcon = { entrada: '→', almuerzo_inicio: '☕', almuerzo_fin: '↩', salida: '←' }[log.type] || '•'
                const timeStr = new Date(log.logged_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })
                return (
                  <div key={log.id} className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2.5">
                    <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 font-bold text-sm shrink-0 overflow-hidden">
                      {log.photo_b64
                        ? <img src={log.photo_b64} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => setViewPhoto(log.photo_b64)} />
                        : (worker?.name?.[0] ?? '?')}
                    </div>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">{timeStr}</span>
                    <span className={`text-xs font-semibold border rounded-full px-2 py-0.5 whitespace-nowrap ${typePillColor}`}>
                      {typeIcon} {TYPE_LABEL[log.type]}
                    </span>
                    <div className="flex items-center gap-1.5 ml-auto text-gray-300 dark:text-gray-600">
                      {log.latitude && <MapPin className="w-3.5 h-3.5 text-blue-400" />}
                      {log.photo_b64 && <button onClick={() => setViewPhoto(log.photo_b64)}><Camera className="w-3.5 h-3.5 text-purple-400" /></button>}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : <p className="text-sm text-gray-400 text-center py-2">Sin registros hoy</p>}
        </div>
      )}

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
              ? <div className="space-y-2">
                  <p className="text-sm text-gray-400 text-center py-2">Sin registros ese día</p>
                  {!addingEntry && (
                    <div className="flex gap-2 flex-wrap">
                      {ALL_TYPES.map(t => (
                        <button key={t} onClick={() => {
                          const defaultH = { entrada: '09:00:00', almuerzo_inicio: '13:00:00', almuerzo_fin: '14:00:00', salida: '18:00:00' }
                          setAddingEntry({ type: t, time: defaultH[t] || '09:00:00' })
                        }}
                          className="text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-lg">
                          + {TYPE_LABEL[t]}
                        </button>
                      ))}
                    </div>
                  )}
                  {addingEntry && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-600 dark:text-gray-400 shrink-0">
                        Añadir <strong>{TYPE_LABEL[addingEntry.type]}</strong>:
                      </span>
                      <input type="time" step="1" value={addingEntry.time}
                        onChange={e => setAddingEntry(a => ({ ...a, time: e.target.value }))}
                        className="input text-sm py-1" style={{ minWidth: 0, flex: 1 }} />
                      <button onClick={async () => {
                          const [h, m, s] = addingEntry.time.split(':').map(Number)
                          const dt = new Date(`${adminDate}T00:00:00`)
                          dt.setHours(h, m, s || 0, 0)
                          await supabase.from('attendance_logs').insert({
                            worker_id: adminWorker, type: addingEntry.type, date: adminDate,
                            logged_at: dt.toISOString(),
                          })
                          toast.success(`${TYPE_LABEL[addingEntry.type]} añadida`)
                          setAddingEntry(null); loadAdminLogs(); loadLogs()
                        }}
                        className="btn-primary text-xs py-1.5 px-3 shrink-0">Guardar</button>
                      <button onClick={() => setAddingEntry(null)} className="btn-secondary text-xs py-1.5 px-3 shrink-0">Cancelar</button>
                    </div>
                  )}
                </div>
              : <div className="space-y-2">
                  {adminLogs.map(log => {
                    const worker = workers.find(w => w.id === log.worker_id)
                    const typePillColor = {
                      entrada: 'border-green-500 text-green-600 bg-green-50 dark:bg-green-900/10',
                      almuerzo_inicio: 'border-orange-400 text-orange-500 bg-orange-50 dark:bg-orange-900/10',
                      almuerzo_fin: 'border-blue-400 text-blue-500 bg-blue-50 dark:bg-blue-900/10',
                      salida: 'border-red-400 text-red-500 bg-red-50 dark:bg-red-900/10',
                    }[log.type] || 'border-gray-300 text-gray-500'
                    const typeIcon = { entrada: '→', almuerzo_inicio: '☕', almuerzo_fin: '↩', salida: '←' }[log.type] || '•'
                    const t = new Date(log.logged_at)
                    const timeStr = t.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })
                    return (
                      <div key={log.id} className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2.5 hover:shadow-sm transition-shadow">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 font-bold text-sm shrink-0 overflow-hidden">
                          {log.photo_b64
                            ? <img src={log.photo_b64} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => setViewPhoto(log.photo_b64)} />
                            : (worker?.name?.[0] ?? '?')}
                        </div>
                        {/* Time */}
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">{timeStr}</span>
                        {/* Type badge */}
                        <span className={`text-xs font-semibold border rounded-full px-2 py-0.5 whitespace-nowrap ${typePillColor}`}>
                          {typeIcon} {TYPE_LABEL[log.type]}
                        </span>
                        {/* Icons */}
                        <div className="flex items-center gap-1.5 text-gray-300 dark:text-gray-600">
                          {log.latitude && <MapPin className="w-3.5 h-3.5 text-blue-400" />}
                          {log.photo_b64 && <button onClick={() => setViewPhoto(log.photo_b64)}><Camera className="w-3.5 h-3.5 text-purple-400" /></button>}
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1 ml-auto">
                          <button onClick={() => { setEditingLog(log); setEditTime(new Date(log.logged_at).toTimeString().slice(0,8)) }}
                            className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-500 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteAdminLog(log.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    )
                  })}
                  {/* Add missing entry */}
                  {adminLogs.length < 4 && !addingEntry && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {ALL_TYPES.filter(t => !adminLogs.some(l => l.type === t)).map(t => (
                        <button key={t} onClick={() => {
                          const defaultH = { entrada: '09:00:00', almuerzo_inicio: '13:00:00', almuerzo_fin: '14:00:00', salida: '18:00:00' }
                          setAddingEntry({ type: t, time: defaultH[t] || '09:00:00' })
                          setEditingLog(null)
                        }}
                          className="text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-lg">
                          + {TYPE_LABEL[t]}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Inline form for new entry */}
                  {addingEntry && (
                    <div className="mt-2 border-t border-gray-200 dark:border-gray-700 pt-3 flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-600 dark:text-gray-400 shrink-0">
                        Añadir <strong>{TYPE_LABEL[addingEntry.type]}</strong>:
                      </span>
                      <input type="time" step="1" value={addingEntry.time}
                        onChange={e => setAddingEntry(a => ({ ...a, time: e.target.value }))}
                        className="input text-sm py-1" style={{ minWidth: 0, flex: 1 }} />
                      <button onClick={async () => {
                          const [h, m, s] = addingEntry.time.split(':').map(Number)
                          const dt = new Date(`${adminDate}T00:00:00`)
                          dt.setHours(h, m, s || 0, 0)
                          await supabase.from('attendance_logs').insert({
                            worker_id: adminWorker, type: addingEntry.type, date: adminDate,
                            logged_at: dt.toISOString(),
                          })
                          toast.success(`${TYPE_LABEL[addingEntry.type]} añadida`)
                          setAddingEntry(null); loadAdminLogs(); loadLogs()
                        }}
                        className="btn-primary text-xs py-1.5 px-3 shrink-0">Guardar</button>
                      <button onClick={() => setAddingEntry(null)} className="btn-secondary text-xs py-1.5 px-3 shrink-0">Cancelar</button>
                    </div>
                  )}
                </div>
          )}
          {/* Edit time modal */}
          {editingLog && (
            <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3 flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Editar hora de <strong>{TYPE_LABEL[editingLog.type]}</strong>:</span>
              <input type="time" step="1" value={editTime} onChange={e => setEditTime(e.target.value)} className="input text-sm py-1" style={{ minWidth: 0, flex: 1 }} />
              <button onClick={saveEditLog} className="btn-primary text-xs py-1.5 px-3">Guardar</button>
              <button onClick={() => setEditingLog(null)} className="btn-secondary text-xs py-1.5 px-3">Cancelar</button>
            </div>
          )}
        </div>
      )}

      </div>{/* end main section */}

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
                disabled={saving || !photo || geoStatus === 'outside' || geoStatus === 'loading' || geoStatus === 'denied' || geoStatus === 'settings'}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox foto */}
      {viewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setViewPhoto(null)}>
          <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <img src={viewPhoto} alt="foto verificación" className="w-full rounded-2xl object-contain max-h-[80vh]" />
            <button onClick={() => setViewPhoto(null)}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold">×</button>
          </div>
        </div>
      )}
    </div>
  )
}
