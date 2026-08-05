import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  Mail, MailOpen, RefreshCw, ArrowLeft, Send, Inbox, Users, CornerUpLeft, Check, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

// Las respuestas de Gmail arrastran el correo anterior citado con ">" y una
// línea de "El día X escribió:". Se separa para no repetir todo el hilo.
function partirCita(texto) {
  const lineas = (texto || '').split('\n')
  const corte = lineas.findIndex((l, i) =>
    /^\s*>/.test(l) ||
    (/^\s*El .+escribió:\s*$/i.test(l) && i > 0) ||
    /^\s*-{2,}\s*Mensaje original\s*-{2,}/i.test(l)
  )
  if (corte < 0) return { cuerpo: texto.trim(), cita: '' }
  return {
    cuerpo: lineas.slice(0, corte).join('\n').trim(),
    cita: lineas.slice(corte).join('\n').trim(),
  }
}

function fechaCorta(valor) {
  const d = new Date(valor)
  if (isNaN(d)) return ''
  const hoy = new Date()
  const mismoDia = d.toDateString() === hoy.toDateString()
  return mismoDia
    ? d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}

function fechaLarga(valor) {
  const d = new Date(valor)
  if (isNaN(d)) return ''
  return d.toLocaleString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function Correos() {
  const [tab, setTab] = useState('recibidos')

  return (
    <div className="space-y-4 pb-8">
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        <button onClick={() => setTab('recibidos')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-colors ${
            tab === 'recibidos' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500'
          }`}>
          <Inbox className="w-4 h-4" /> Recibidos
        </button>
        <button onClick={() => setTab('enviados')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-colors ${
            tab === 'enviados' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500'
          }`}>
          <Send className="w-4 h-4" /> Enviados
        </button>
      </div>

      {tab === 'recibidos' ? <Recibidos /> : <Enviados />}
    </div>
  )
}

// ─── Bandeja de entrada ──────────────────────────────────────────────────────
function Recibidos() {
  const [mensajes, setMensajes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [soloEquipo, setSoloEquipo] = useState(true)
  const [abierto, setAbierto] = useState(null)
  const [correosEquipo, setCorreosEquipo] = useState([])

  useEffect(() => {
    if (IS_DEMO) return
    supabase.from('profiles').select('email').then(({ data }) => {
      setCorreosEquipo((data || []).map(p => (p.email || '').toLowerCase()).filter(Boolean))
    })
  }, [])

  const cargar = useCallback(async () => {
    if (IS_DEMO) { setCargando(false); setError('El buzón no está disponible en modo demo.'); return }
    setCargando(true)
    try {
      const { data, error } = await supabase.functions.invoke('leer-correo', {
        body: { action: 'lista', limit: 50 },
      })
      if (error || data?.error) throw new Error(data?.error || error.message)
      setMensajes(data.mensajes || [])
      setError('')
    } catch (e) {
      setError(e.message)
    }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const delEquipo = useCallback(
    (m) => correosEquipo.includes((m.email || '').toLowerCase()),
    [correosEquipo],
  )

  const visibles = useMemo(
    () => (soloEquipo ? mensajes.filter(delEquipo) : mensajes),
    [mensajes, soloEquipo, delEquipo],
  )
  const sinLeer = visibles.filter(m => !m.leido).length

  // El estado local se adelanta al servidor para que la lista no parpadee.
  function actualizar(uid, cambios) {
    setMensajes(prev => prev.map(m => (m.uid === uid ? { ...m, ...cambios } : m)))
  }

  if (abierto) {
    return (
      <Detalle
        resumen={abierto}
        onVolver={() => setAbierto(null)}
        onLeido={() => actualizar(abierto.uid, { leido: true })}
        onRespondido={() => actualizar(abierto.uid, { leido: true, respondido: true })}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1 text-sm">
          <button onClick={() => setSoloEquipo(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium border transition-all ${
              soloEquipo ? 'bg-red-600 border-red-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-500'
            }`}>
            <Users className="w-3.5 h-3.5" /> Del equipo
          </button>
          <button onClick={() => setSoloEquipo(false)}
            className={`px-3 py-1.5 rounded-lg font-medium border transition-all ${
              !soloEquipo ? 'bg-red-600 border-red-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-500'
            }`}>
            Todos
          </button>
        </div>
        <button onClick={cargar} disabled={cargando} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      <p className="text-xs text-gray-400">
        Buzón de apexprodetailing0@gmail.com
        {sinLeer > 0 && ` · ${sinLeer} sin leer`}
      </p>

      {error && (
        <div className="card border-red-200 dark:border-red-900 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {cargando && !mensajes.length && (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!cargando && !visibles.length && !error && (
        <div className="card text-center py-10 text-sm text-gray-400">
          {soloEquipo
            ? 'No hay correos del equipo. Prueba con «Todos».'
            : 'El buzón está vacío.'}
        </div>
      )}

      <div className="space-y-2">
        {visibles.map(m => (
          <button key={m.uid} onClick={() => setAbierto(m)}
            className={`card w-full text-left flex items-start gap-3 hover:border-red-200 dark:hover:border-red-900 transition-colors ${
              m.leido ? '' : 'border-l-4 border-l-red-600'
            }`}>
            <div className="mt-0.5 flex-none text-gray-400">
              {m.leido ? <MailOpen className="w-4 h-4" /> : <Mail className="w-4 h-4 text-red-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={`flex-1 truncate text-sm ${m.leido ? 'text-gray-600 dark:text-gray-300' : 'font-semibold text-gray-900 dark:text-white'}`}>
                  {m.nombre || m.email}
                </p>
                <span className="text-[11px] text-gray-400 flex-none">{fechaCorta(m.fecha)}</span>
              </div>
              <p className={`truncate text-sm ${m.leido ? 'text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
                {m.asunto}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-gray-400 truncate">{m.email}</span>
                {m.respondido && (
                  <span className="text-[11px] text-green-600 dark:text-green-400 flex items-center gap-0.5 flex-none">
                    <CornerUpLeft className="w-3 h-3" /> respondido
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Un correo abierto, con su respuesta ─────────────────────────────────────
function Detalle({ resumen, onVolver, onLeido, onRespondido, volverLabel = 'Volver a la bandeja' }) {
  const [mensaje, setMensaje] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [verCita, setVerCita] = useState(false)
  const [respuesta, setRespuesta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [respondido, setRespondido] = useState(resumen.respondido)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('leer-correo', {
          body: { action: 'mensaje', uid: resumen.uid },
        })
        if (error || data?.error) throw new Error(data?.error || error.message)
        if (!vivo) return
        setMensaje(data.mensaje)
        if (!resumen.leido) {
          supabase.functions.invoke('leer-correo', { body: { action: 'marcar', uid: resumen.uid, leido: true } })
          onLeido()
        }
      } catch (e) {
        if (vivo) setError(e.message)
      }
      if (vivo) setCargando(false)
    })()
    return () => { vivo = false }
  }, [resumen.uid])

  const { cuerpo, cita } = useMemo(() => partirCita(mensaje?.texto || ''), [mensaje])

  async function responder() {
    if (!respuesta.trim()) { toast.error('Escribe la respuesta'); return }
    setEnviando(true)
    try {
      const asunto = /^re:/i.test(mensaje.asunto) ? mensaje.asunto : `Re: ${mensaje.asunto}`
      const { data, error } = await supabase.functions.invoke('enviar-correo', {
        body: {
          kind: 'respuesta',
          subject: asunto,
          body: respuesta.trim(),
          recipients: [{ name: mensaje.nombre, email: mensaje.email }],
          inReplyTo: mensaje.messageId,
        },
      })
      if (error || data?.error) throw new Error(data?.error || error.message)
      if (data.fallidos?.length) throw new Error(data.fallidos[0].error)

      await supabase.from('sent_emails').insert({
        kind: 'respuesta',
        subject: asunto,
        body: respuesta.trim(),
        recipients: [{ name: mensaje.nombre, email: mensaje.email }],
        status: 'enviado',
      })
      supabase.functions.invoke('leer-correo', {
        body: { action: 'marcar', uid: resumen.uid, respondido: true },
      })

      toast.success('Respuesta enviada ✓')
      setRespuesta('')
      setRespondido(true)
      onRespondido()
    } catch (e) {
      toast.error(`Error al responder: ${e.message}`)
    }
    setEnviando(false)
  }

  return (
    <div className="space-y-3">
      <button onClick={onVolver} className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600">
        <ArrowLeft className="w-4 h-4" /> {volverLabel}
      </button>

      {cargando && (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && <div className="card text-sm text-red-600 dark:text-red-400">{error}</div>}

      {mensaje && (
        <>
          <div className="card space-y-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">{mensaje.asunto}</h2>
              <p className="text-xs text-gray-500 mt-1">
                {mensaje.nombre ? `${mensaje.nombre} · ` : ''}{mensaje.email}
              </p>
              <p className="text-xs text-gray-400">{fechaLarga(mensaje.fecha)}</p>
            </div>

            <p className="text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200">
              {cuerpo || '(sin texto)'}
            </p>

            {cita && (
              <div>
                <button onClick={() => setVerCita(v => !v)}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  {verCita ? 'Ocultar mensaje anterior' : 'Ver mensaje anterior'}
                </button>
                {verCita && (
                  <p className="mt-2 pl-3 border-l-2 border-gray-200 dark:border-gray-700 text-xs whitespace-pre-wrap text-gray-500">
                    {cita}
                  </p>
                )}
              </div>
            )}

            {mensaje.truncado && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                El correo era muy largo y se muestra solo el comienzo.
              </p>
            )}
          </div>

          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <CornerUpLeft className="w-4 h-4 text-gray-400" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Responder a {mensaje.nombre || mensaje.email}
              </p>
              {respondido && (
                <span className="ml-auto text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> ya respondido
                </span>
              )}
            </div>
            <textarea className="input min-h-[120px] resize-y"
              placeholder="Escribe tu respuesta..."
              value={respuesta}
              onChange={e => setRespuesta(e.target.value)} />
            <button onClick={responder} disabled={enviando || !respuesta.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2">
              <Send className="w-4 h-4" />
              {enviando ? 'Enviando...' : 'Enviar respuesta'}
            </button>
            <p className="text-xs text-gray-400">
              Sale desde apexprodetailing0@gmail.com y queda enganchada al mismo hilo.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Constancia de lo enviado desde la app ───────────────────────────────────
function Enviados() {
  const [envios, setEnvios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState(null)

  useEffect(() => {
    if (IS_DEMO) { setCargando(false); return }
    supabase.from('sent_emails').select('*').order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setEnvios(data || []))
      .finally(() => setCargando(false))
  }, [])

  if (abierto) {
    return <HiloEnviado envio={abierto} onVolver={() => setAbierto(null)} />
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!envios.length) {
    return <div className="card text-center py-10 text-sm text-gray-400">Todavía no se ha enviado ningún correo.</div>
  }

  return (
    <div className="space-y-2">
      {envios.map(e => (
        <button key={e.id} onClick={() => setAbierto(e)}
          className="card w-full text-left space-y-1 hover:border-red-200 dark:hover:border-red-900 transition-colors">
          <div className="flex items-center gap-2">
            <p className="flex-1 truncate text-sm font-semibold text-gray-900 dark:text-white">{e.subject}</p>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-none" />
            <span className="text-[11px] text-gray-400 flex-none">{fechaCorta(e.created_at)}</span>
          </div>
          <p className="text-xs text-gray-500 truncate">
            {(e.recipients || []).map(r => r.name || r.email).join(', ')}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 capitalize">
              {e.kind}
            </span>
            {e.status !== 'enviado' && (
              <span className="text-[11px] text-red-600 dark:text-red-400">falló el envío</span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap line-clamp-3">{e.body}</p>
        </button>
      ))}
    </div>
  )
}

// ─── Hilo de un correo enviado: muestra el original + respuestas del inbox ──
function HiloEnviado({ envio, onVolver }) {
  const [respuestas, setRespuestas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [detalle, setDetalle] = useState(null)

  useEffect(() => {
    if (IS_DEMO) { setCargando(false); return }
    ;(async () => {
      try {
        const { data } = await supabase.functions.invoke('leer-correo', {
          body: { action: 'lista', limit: 100 },
        })
        const msgs = data?.mensajes || []
        const base = (envio.subject || '').replace(/^Re:\s*/i, '').trim().toLowerCase()
        const dests = (envio.recipients || []).map(r => (r.email || '').toLowerCase())

        setRespuestas(msgs.filter(m => {
          const asuntoMsg = (m.asunto || '').replace(/^Re:\s*/i, '').trim().toLowerCase()
          return asuntoMsg === base && dests.includes((m.email || '').toLowerCase())
        }))
      } catch { /* sin conexión al buzón */ }
      setCargando(false)
    })()
  }, [envio])

  if (detalle) {
    return (
      <Detalle
        resumen={detalle}
        onVolver={() => setDetalle(null)}
        onLeido={() => {}}
        onRespondido={() => {}}
        volverLabel="Volver al hilo"
      />
    )
  }

  return (
    <div className="space-y-3">
      <button onClick={onVolver} className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600">
        <ArrowLeft className="w-4 h-4" /> Volver a enviados
      </button>

      <div className="card space-y-2">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-red-500 flex-none" />
          <p className="text-xs font-medium text-gray-500">Enviado</p>
          <span className="text-[11px] text-gray-400 ml-auto">{fechaCorta(envio.created_at)}</span>
        </div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{envio.subject}</h2>
        <p className="text-xs text-gray-500">
          Para: {(envio.recipients || []).map(r => r.name || r.email).join(', ')}
        </p>
        <p className="text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200">{envio.body}</p>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <CornerUpLeft className="w-4 h-4 text-gray-400" />
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Respuestas {!cargando && `(${respuestas.length})`}
        </p>
      </div>

      {cargando && (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-[3px] border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!cargando && !respuestas.length && (
        <div className="card text-center py-6 text-sm text-gray-400">
          Ningún destinatario ha respondido todavía.
        </div>
      )}

      <div className="space-y-2">
        {respuestas.map(r => (
          <button key={r.uid} onClick={() => setDetalle(r)}
            className="card w-full text-left flex items-start gap-3 hover:border-green-200 dark:hover:border-green-900 transition-colors">
            <div className="mt-0.5 flex-none">
              <CornerUpLeft className="w-4 h-4 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">
                  {r.nombre || r.email}
                </p>
                <span className="text-[11px] text-gray-400 flex-none">{fechaCorta(r.fecha)}</span>
              </div>
              <p className="text-xs text-gray-500 truncate">{r.email}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
