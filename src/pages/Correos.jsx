import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { RefreshCw, ArrowLeft, Send, Users, ChevronDown, PenSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import ComposeForm from '../components/correos/ComposeForm'

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

function stripRe(s) {
  return (s || '').replace(/^(Re|Fwd|RV|RE|FW|Fw|Rv):\s*/gi, '').trim()
}

function fechaCorta(valor) {
  const d = new Date(valor)
  if (isNaN(d)) return ''
  const hoy = new Date()
  return d.toDateString() === hoy.toDateString()
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

const COLORES = ['#e53e3e', '#dd6b20', '#38a169', '#3182ce', '#805ad5', '#d53f8c', '#319795']
function colorAvatar(nombre) {
  return COLORES[[...(nombre || '?')].reduce((h, c) => h + c.charCodeAt(0), 0) % COLORES.length]
}
function iniciales(nombre) {
  return (nombre || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function buildThreads(envios, inbox) {
  const map = new Map()

  for (const e of envios) {
    const key = stripRe(e.subject).toLowerCase()
    if (!map.has(key)) map.set(key, { subject: stripRe(e.subject), msgs: [] })
    map.get(key).msgs.push({
      dir: 'out', body: e.body, recipients: e.recipients || [],
      date: new Date(e.created_at), id: `s${e.id}`, kind: e.kind,
    })
  }

  for (const m of inbox) {
    const key = stripRe(m.asunto).toLowerCase()
    if (!map.has(key)) map.set(key, { subject: stripRe(m.asunto), msgs: [] })
    map.get(key).msgs.push({
      dir: 'in', from: { nombre: m.nombre, email: m.email },
      date: new Date(m.fecha), uid: m.uid, leido: m.leido,
      id: `r${m.uid}`, messageId: m.messageId,
    })
  }

  const threads = []
  for (const [key, t] of map) {
    t.msgs.sort((a, b) => a.date - b.date)
    t.key = key
    t.lastDate = t.msgs[t.msgs.length - 1].date

    const names = new Set()
    t.msgs.forEach(m => {
      if (m.dir === 'out') {
        names.add('Tú')
        m.recipients.forEach(r => names.add(r.name || r.email))
      } else {
        names.add(m.from.nombre || m.from.email)
      }
    })
    t.participants = [...names]
    t.unread = t.msgs.filter(m => m.dir === 'in' && !m.leido).length
    t.hasSent = t.msgs.some(m => m.dir === 'out')

    const last = t.msgs[t.msgs.length - 1]
    t.snippet = last.dir === 'out' ? (last.body || '').slice(0, 80) : ''
    t.lastSender = last.dir === 'out' ? 'Tú' : (last.from.nombre || last.from.email)

    threads.push(t)
  }
  threads.sort((a, b) => b.lastDate - a.lastDate)
  return threads
}

// ─── Componente principal ───────────────────────────────────────────────────

export default function Correos() {
  const [envios, setEnvios] = useState([])
  const [inbox, setInbox] = useState([])
  const [correosEquipo, setCorreosEquipo] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [soloEquipo, setSoloEquipo] = useState(true)
  const [abierto, setAbierto] = useState(null)
  const [componer, setComponer] = useState(false)

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
      const [envR, inR] = await Promise.all([
        supabase.from('sent_emails').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.functions.invoke('leer-correo', { body: { action: 'lista', limit: 100 } }),
      ])
      setEnvios(envR.data || [])
      if (inR.data?.error) throw new Error(inR.data.error)
      setInbox(inR.data?.mensajes || [])
      setError('')
    } catch (e) { setError(e.message) }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const allThreads = useMemo(() => buildThreads(envios, inbox), [envios, inbox])

  const visibleThreads = useMemo(() => {
    if (!soloEquipo) return allThreads
    return allThreads.filter(t =>
      t.hasSent || t.msgs.some(m => m.dir === 'in' && correosEquipo.includes(m.from.email.toLowerCase()))
    )
  }, [allThreads, soloEquipo, correosEquipo])

  if (abierto) {
    return <VistaHilo thread={abierto} onVolver={() => { setAbierto(null); cargar() }} />
  }

  const sinLeer = visibleThreads.reduce((n, t) => n + t.unread, 0)

  return (
    <div className="space-y-3 pb-8">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1 text-sm">
          <button onClick={() => setSoloEquipo(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium border transition-all ${
              soloEquipo ? 'bg-red-600 border-red-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-500'
            }`}>
            <Users className="w-3.5 h-3.5" /> Equipo
          </button>
          <button onClick={() => setSoloEquipo(false)}
            className={`px-3 py-1.5 rounded-lg font-medium border transition-all ${
              !soloEquipo ? 'bg-red-600 border-red-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-500'
            }`}>
            Todos
          </button>
        </div>
        <button onClick={() => setComponer(c => !c)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
            componer ? 'bg-red-600 border-red-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:text-red-600'
          }`}>
          <PenSquare className="w-3.5 h-3.5" /> Nuevo
        </button>
        <button onClick={cargar} disabled={cargando}
          className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-red-600 transition-colors">
          <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {componer && <ComposeForm onSent={() => { setComponer(false); cargar() }} onClose={() => setComponer(false)} />}

      <p className="text-xs text-gray-400">
        apexprodetailing0@gmail.com{sinLeer > 0 && ` · ${sinLeer} sin leer`}
      </p>

      {error && (
        <div className="card border-red-200 dark:border-red-900 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      {cargando && !allThreads.length && (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!cargando && !visibleThreads.length && !error && (
        <div className="card text-center py-10 text-sm text-gray-400">
          {soloEquipo ? 'No hay conversaciones con el equipo.' : 'El buzón está vacío.'}
        </div>
      )}

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {visibleThreads.map(t => {
          const otro = t.participants.find(p => p !== 'Tú') || 'Tú'
          return (
            <button key={t.key} onClick={() => setAbierto(t)}
              className={`w-full text-left flex items-center gap-3 px-2 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                t.unread ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
              }`}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-none"
                style={{ background: colorAvatar(otro) }}>
                {iniciales(otro)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`flex-1 truncate text-sm ${t.unread ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                    {t.participants.filter(p => p !== 'Tú').join(', ') || 'Tú'}
                    {t.msgs.length > 1 && <span className="text-gray-400 font-normal"> ({t.msgs.length})</span>}
                  </p>
                  <span className={`text-[11px] flex-none ${t.unread ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                    {fechaCorta(t.lastDate)}
                  </span>
                </div>
                <p className={`truncate text-sm ${t.unread ? 'font-semibold text-gray-800 dark:text-gray-200' : 'text-gray-500'}`}>
                  {t.subject}
                </p>
                <p className="truncate text-xs text-gray-400 mt-0.5">
                  {t.lastSender}: {t.snippet || t.subject}
                </p>
              </div>
              {t.unread > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center flex-none">
                  {t.unread}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Vista de hilo (tipo Gmail) ─────────────────────────────────────────────

function VistaHilo({ thread, onVolver }) {
  const [bodies, setBodies] = useState({})
  const [cargando, setCargando] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [respuesta, setRespuesta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensajesLocales, setMensajesLocales] = useState(thread.msgs)

  useEffect(() => {
    const uids = thread.msgs.filter(m => m.dir === 'in').map(m => m.uid)
    if (!uids.length) { setCargando(false); return }

    const lastId = thread.msgs[thread.msgs.length - 1].id
    setExpanded({ [lastId]: true })

    ;(async () => {
      const map = {}
      await Promise.all(uids.map(async uid => {
        try {
          const { data } = await supabase.functions.invoke('leer-correo', {
            body: { action: 'mensaje', uid },
          })
          if (data?.mensaje) map[uid] = data.mensaje.texto
        } catch { /* skip */ }
      }))
      setBodies(map)
      setCargando(false)

      for (const m of thread.msgs) {
        if (m.dir === 'in' && !m.leido) {
          supabase.functions.invoke('leer-correo', { body: { action: 'marcar', uid: m.uid, leido: true } })
        }
      }
    })()
  }, [thread])

  useEffect(() => {
    if (!cargando) {
      const lastId = mensajesLocales[mensajesLocales.length - 1]?.id
      if (lastId) setExpanded(prev => ({ ...prev, [lastId]: true }))
    }
  }, [cargando, mensajesLocales])

  const lastReceived = [...mensajesLocales].reverse().find(m => m.dir === 'in')
  const replyTarget = lastReceived?.from
    || (mensajesLocales[0]?.dir === 'out' ? mensajesLocales[0].recipients[0] : null)

  async function enviar() {
    if (!respuesta.trim() || !replyTarget) return
    setEnviando(true)
    try {
      const asunto = `Re: ${thread.subject}`
      const { data, error } = await supabase.functions.invoke('enviar-correo', {
        body: {
          kind: 'respuesta', subject: asunto, body: respuesta.trim(),
          recipients: [{ name: replyTarget.nombre || replyTarget.name, email: replyTarget.email }],
          inReplyTo: lastReceived?.messageId || '',
        },
      })
      if (error || data?.error) throw new Error(data?.error || error.message)

      await supabase.from('sent_emails').insert({
        kind: 'respuesta', subject: asunto, body: respuesta.trim(),
        recipients: [{ name: replyTarget.nombre || replyTarget.name, email: replyTarget.email }],
        status: 'enviado',
      })
      if (lastReceived?.uid) {
        supabase.functions.invoke('leer-correo', {
          body: { action: 'marcar', uid: lastReceived.uid, respondido: true },
        })
      }

      const nuevo = {
        dir: 'out', body: respuesta.trim(),
        recipients: [{ name: replyTarget.nombre || replyTarget.name, email: replyTarget.email }],
        date: new Date(), id: `s-new-${Date.now()}`, kind: 'respuesta',
      }
      setMensajesLocales(prev => [...prev, nuevo])
      setExpanded(prev => ({ ...prev, [nuevo.id]: true }))
      toast.success('Respuesta enviada')
      setRespuesta('')
    } catch (e) { toast.error(`Error: ${e.message}`) }
    setEnviando(false)
  }

  return (
    <div className="space-y-4 pb-8">
      <button onClick={onVolver} className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600">
        <ArrowLeft className="w-4 h-4" /> Correos
      </button>

      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">{thread.subject}</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {mensajesLocales.length} mensaje{mensajesLocales.length !== 1 ? 's' : ''}
          {' · '}{thread.participants.join(', ')}
        </p>
      </div>

      <div className="space-y-2">
        {mensajesLocales.map(m => {
          const isOpen = expanded[m.id]
          if (m.dir === 'out') {
            return (
              <MsgEnviado key={m.id} msg={m} open={isOpen}
                onToggle={() => setExpanded(p => ({ ...p, [m.id]: !p[m.id] }))} />
            )
          }
          return (
            <MsgRecibido key={m.id} msg={m} open={isOpen}
              texto={bodies[m.uid]} loading={cargando && !bodies[m.uid]}
              onToggle={() => setExpanded(p => ({ ...p, [m.id]: !p[m.id] }))} />
          )
        })}
      </div>

      {replyTarget && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500">
            Responder a {replyTarget.nombre || replyTarget.name || replyTarget.email}
          </div>
          <textarea
            className="w-full px-4 py-3 text-sm bg-transparent resize-y min-h-[80px] focus:outline-none text-gray-800 dark:text-gray-200"
            placeholder="Escribe tu respuesta..."
            value={respuesta}
            onChange={e => setRespuesta(e.target.value)}
          />
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-gray-800">
            <p className="text-[11px] text-gray-400">desde apexprodetailing0@gmail.com</p>
            <button onClick={enviar} disabled={enviando || !respuesta.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              <Send className="w-3.5 h-3.5" />
              {enviando ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Burbuja de mensaje enviado ─────────────────────────────────────────────

function MsgEnviado({ msg, open, onToggle }) {
  return (
    <div className={`rounded-2xl border transition-all ${
      open
        ? 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20'
        : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer'
    }`}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={onToggle}>
        <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-[10px] font-bold flex-none">
          Tú
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Tú</span>
          {!open && <span className="text-xs text-gray-400 ml-2 truncate">{(msg.body || '').slice(0, 60)}...</span>}
        </div>
        <span className="text-[11px] text-gray-400 flex-none">{fechaCorta(msg.date)}</span>
        {!open && <ChevronDown className="w-3.5 h-3.5 text-gray-300 flex-none" />}
      </div>
      {open && (
        <div className="px-4 pb-4 pl-[3.75rem]">
          <p className="text-xs text-gray-400 mb-2">
            Para: {msg.recipients.map(r => r.name || r.email).join(', ')}
          </p>
          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{msg.body}</p>
        </div>
      )}
    </div>
  )
}

// ─── Burbuja de mensaje recibido ────────────────────────────────────────────

function MsgRecibido({ msg, open, texto, loading, onToggle }) {
  const { cuerpo, cita } = useMemo(() => partirCita(texto || ''), [texto])
  const [verCita, setVerCita] = useState(false)
  const nombre = msg.from.nombre || msg.from.email

  return (
    <div className={`rounded-2xl border transition-all ${
      open
        ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm'
        : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer'
    }`}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={onToggle}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-none"
          style={{ background: colorAvatar(nombre) }}>
          {iniciales(nombre)}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{nombre}</span>
          {!open && texto && <span className="text-xs text-gray-400 ml-2 truncate">{cuerpo.slice(0, 60)}...</span>}
        </div>
        <span className="text-[11px] text-gray-400 flex-none">{fechaCorta(msg.date)}</span>
        {!open && <ChevronDown className="w-3.5 h-3.5 text-gray-300 flex-none" />}
      </div>
      {open && (
        <div className="px-4 pb-4 pl-[3.75rem]">
          <p className="text-xs text-gray-400 mb-2">{msg.from.email}</p>
          {loading ? (
            <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
              <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              Cargando mensaje...
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {cuerpo || '(sin texto)'}
              </p>
              {cita && (
                <div className="mt-3">
                  <button onClick={() => setVerCita(v => !v)}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    {verCita ? '▾ Ocultar citado' : '▸ Mostrar citado'}
                  </button>
                  {verCita && (
                    <p className="mt-1.5 pl-3 border-l-2 border-gray-200 dark:border-gray-700 text-xs whitespace-pre-wrap text-gray-400">
                      {cita}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
