import { useState, useMemo, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import { Send, X, Image, Clipboard } from 'lucide-react'
import toast from 'react-hot-toast'

const MAX_FILE_SIZE = 4 * 1024 * 1024
const MAX_FILES = 5

export default function ComposeForm({ onSent, onClose }) {
  const { workers } = useApp()
  const activeWorkers = workers.filter(w => w.active)

  const [msg, setMsg] = useState('')
  const [target, setTarget] = useState('all')
  const [selectedWorker, setSelectedWorker] = useState('')
  const [tipo, setTipo] = useState('memorandum')
  const [asunto, setAsunto] = useState('')
  const [perfiles, setPerfiles] = useState([])
  const [sending, setSending] = useState(false)
  const [tone, setTone] = useState('normal')
  const [aiPreview, setAiPreview] = useState('')
  const [generatingAi, setGeneratingAi] = useState(false)
  const [adjuntos, setAdjuntos] = useState([])
  const fileInputRef = useRef(null)

  useEffect(() => {
    supabase.from('profiles').select('worker_id, email').then(({ data }) => setPerfiles(data || []))
  }, [])

  const destinatarios = useMemo(() => {
    const conCorreo = (w) => {
      const p = perfiles.find(x => x.worker_id === w.id)
      return p?.email ? { id: w.id, name: w.name, email: p.email } : null
    }
    const lista = target === 'all'
      ? activeWorkers.map(conCorreo)
      : [activeWorkers.find(w => w.id === selectedWorker)].filter(Boolean).map(conCorreo)
    return lista.filter(Boolean)
  }, [target, selectedWorker, activeWorkers, perfiles])

  const sinCorreo = useMemo(() => {
    if (target !== 'all') return []
    return activeWorkers.filter(w => !perfiles.find(x => x.worker_id === w.id)?.email)
  }, [target, activeWorkers, perfiles])

  async function handleGenerateAI() {
    if (!msg.trim()) { toast.error('Escribe un mensaje primero'); return }
    setGeneratingAi(true); setAiPreview('')
    try {
      const tonePrompts = {
        formal: 'Transforma este mensaje en un anuncio formal y profesional para un taller automotriz. Usa máximo 2 emojis relevantes al inicio. Sé directo y respetuoso.',
        normal: 'Transforma este mensaje en un anuncio amigable y claro para el equipo de un taller automotriz. Usa 3-4 emojis apropiados. Tono cercano pero profesional.',
        alegre: 'Transforma este mensaje en un anuncio motivador y alegre para el equipo de un taller automotriz. Usa bastantes emojis expresivos. Tono energético y positivo.',
      }
      const { data, error } = await supabase.functions.invoke('ai-anuncio', {
        body: { message: msg.trim(), tone, prompt: tonePrompts[tone] }
      })
      if (error) throw error
      setAiPreview(data.result)
    } catch {
      const prefixes = { formal: 'Estimado equipo,\n\n', normal: 'Hola equipo 👋\n\n', alegre: '¡Atención equipo! 🎉\n\n' }
      const suffixes = { formal: '\n\nQuedamos atentos a cualquier consulta.\nGracias por su colaboración.', normal: '\n\nCualquier duda, me avisan. ¡Gracias! ✅', alegre: '\n\n¡Vamos con todo equipo! 💪🔥' }
      setAiPreview(`${prefixes[tone]}${msg.trim()}${suffixes[tone]}`)
    }
    setGeneratingAi(false)
  }

  function handleFiles(e) {
    const files = Array.from(e.target.files || [])
    if (adjuntos.length + files.length > MAX_FILES) {
      toast.error(`Máximo ${MAX_FILES} archivos`); return
    }
    for (const f of files) addImageFile(f)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function addImageFile(f) {
    if (f.size > MAX_FILE_SIZE) { toast.error(`${f.name} excede 4 MB`); return }
    if (!f.type.startsWith('image/')) { toast.error(`${f.name} no es una imagen`); return }
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      setAdjuntos(prev => {
        if (prev.length >= MAX_FILES) return prev
        return [...prev, { name: f.name, type: f.type, base64, preview: reader.result }]
      })
    }
    reader.readAsDataURL(f)
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const f = item.getAsFile()
        if (!f) continue
        const named = new File([f], `captura-${Date.now()}.png`, { type: f.type })
        addImageFile(named)
      }
    }
  }

  async function handlePasteBtn() {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const imgType = item.types.find(t => t.startsWith('image/'))
        if (imgType) {
          const blob = await item.getType(imgType)
          const f = new File([blob], `captura-${Date.now()}.png`, { type: imgType })
          addImageFile(f)
          return
        }
      }
      toast.error('No hay imagen en el portapapeles')
    } catch {
      toast.error('No se pudo acceder al portapapeles')
    }
  }

  async function handleSend() {
    if (!asunto.trim()) { toast.error('Escribe el asunto'); return }
    if (!msg.trim()) { toast.error('Escribe el mensaje'); return }
    if (!destinatarios.length) { toast.error('Ningún destinatario tiene correo registrado'); return }
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('enviar-correo', {
        body: { kind: tipo, subject: asunto.trim(), body: msg.trim(),
          recipients: destinatarios.map(d => ({ name: d.name, email: d.email })),
          attachments: adjuntos.map(a => ({ name: a.name, type: a.type, base64: a.base64 })) },
      })
      if (error || data?.error) throw new Error(data?.error || error.message)

      const fallidos = data?.fallidos || []
      await supabase.from('sent_emails').insert({
        kind: tipo, subject: asunto.trim(), body: msg.trim(),
        recipients: destinatarios.map(d => ({ name: d.name, email: d.email })),
        status: fallidos.length ? 'error' : 'enviado',
        error: fallidos.length ? JSON.stringify(fallidos) : null,
      })

      if (fallidos.length) {
        toast.error(`Enviados ${data.enviados.length} de ${data.total}. Fallaron: ${fallidos.map(f => f.email).join(', ')}`)
      } else {
        toast.success(`Correo enviado a ${data.enviados.length} destinatario${data.enviados.length !== 1 ? 's' : ''} ✓`)
        setMsg(''); setAsunto(''); setAiPreview(''); setAdjuntos([])
        onSent?.()
      }
    } catch (e) { toast.error(`Error al enviar: ${e.message}`) }
    setSending(false)
  }

  function shareWhatsApp(text) {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="card border-2 border-red-200 dark:border-red-900/50">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nuevo correo al equipo</p>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        <button onClick={() => setTarget('all')}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${target === 'all' ? 'bg-red-600 border-red-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
          🌐 Todos
        </button>
        <button onClick={() => setTarget('individual')}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${target === 'individual' ? 'bg-red-600 border-red-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
          👤 Individual
        </button>
      </div>

      {target === 'individual' && (
        <select className="input mb-3" value={selectedWorker} onChange={e => setSelectedWorker(e.target.value)}>
          <option value="">-- Seleccionar trabajador --</option>
          {activeWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {[
          { v: 'memorandum', label: '📋 Memorándum' },
          { v: 'permiso', label: '📝 Permiso' },
          { v: 'aviso', label: '📢 Aviso' },
          { v: 'felicitacion', label: '🏅 Reconocimiento' },
        ].map(({ v, label }) => (
          <button key={v} onClick={() => setTipo(v)}
            className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
              tipo === v ? 'bg-red-600 border-red-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-red-300'
            }`}>{label}</button>
        ))}
      </div>

      <input className="input mb-3" placeholder="Asunto del correo"
        value={asunto} onChange={e => setAsunto(e.target.value)} />

      <div className="mb-3 text-xs">
        {destinatarios.length > 0 ? (
          <p className="text-gray-500">
            Se enviará a <span className="font-semibold text-gray-700 dark:text-gray-300">
              {destinatarios.map(d => d.name).join(', ')}
            </span>
          </p>
        ) : (
          <p className="text-amber-600 dark:text-amber-400">Ningún destinatario tiene correo registrado.</p>
        )}
        {sinCorreo.length > 0 && (
          <p className="text-amber-600 dark:text-amber-400 mt-0.5">
            Sin correo, no recibirán: {sinCorreo.map(w => w.name).join(', ')}
          </p>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        {[
          { key: 'formal', label: '🎩 Formal' },
          { key: 'normal', label: '💬 Normal' },
          { key: 'alegre', label: '🎉 Alegre' },
        ].map(t => (
          <button key={t.key} onClick={() => setTone(t.key)}
            className={`flex-1 py-2 px-1 rounded-xl text-xs font-semibold border transition-all ${tone === t.key ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-indigo-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <textarea className="input resize-none mb-2" rows={3}
        placeholder="Escribe el anuncio o mensaje para el equipo..."
        value={msg} onChange={e => { setMsg(e.target.value); setAiPreview('') }}
        onPaste={handlePaste} />

      <input ref={fileInputRef} type="file" accept="image/*" multiple
        className="hidden" onChange={handleFiles} />

      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => fileInputRef.current?.click()}
          disabled={adjuntos.length >= MAX_FILES}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-all">
          <Image className="w-3.5 h-3.5" />
          Adjuntar imagen
        </button>
        <button onClick={handlePasteBtn}
          disabled={adjuntos.length >= MAX_FILES}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 transition-all">
          <Clipboard className="w-3.5 h-3.5" />
          Pegar
        </button>
        {adjuntos.length > 0 && (
          <span className="text-xs text-gray-400">{adjuntos.length}/{MAX_FILES}</span>
        )}
      </div>

      {adjuntos.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {adjuntos.map((a, i) => (
            <div key={i} className="relative group">
              <img src={a.preview} alt={a.name}
                className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
              <button onClick={() => setAdjuntos(prev => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="w-3 h-3" />
              </button>
              <p className="text-[10px] text-gray-400 truncate w-16 mt-0.5">{a.name}</p>
            </div>
          ))}
        </div>
      )}

      <button onClick={handleGenerateAI} disabled={generatingAi || !msg.trim()}
        className="w-full mb-3 py-2 rounded-xl text-sm font-semibold border-2 border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
        {generatingAi ? <><span className="animate-spin">⚙️</span> Generando...</> : <><span>✨</span> Mejorar con IA</>}
      </button>

      {aiPreview && (
        <div className="mb-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-indigo-200 dark:border-indigo-800">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">✨ Sugerencia IA</span>
            <button onClick={() => setAiPreview('')} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
          </div>
          <pre className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">{aiPreview}</pre>
          <div className="flex gap-2 px-3 pb-3">
            <button onClick={() => { setMsg(aiPreview); setAiPreview('') }}
              className="flex-1 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
              Usar este mensaje
            </button>
            <button onClick={() => shareWhatsApp(aiPreview)}
              className="flex-1 py-1.5 rounded-lg bg-green-500 text-white text-xs font-semibold hover:bg-green-600 flex items-center justify-center gap-1">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.532 5.856L.054 23.25a.75.75 0 00.916.919l5.562-1.457A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.7 9.7 0 01-4.95-1.355l-.355-.211-3.684.966.984-3.595-.232-.371A9.718 9.718 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
              WhatsApp
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={handleSend} disabled={sending}
          className="flex-1 btn-primary flex items-center justify-center gap-2">
          <Send className="w-4 h-4" />
          {sending ? 'Enviando...' : `Enviar correo${destinatarios.length ? ` (${destinatarios.length})` : ''}`}
        </button>
        <button onClick={() => shareWhatsApp(msg)} disabled={!msg.trim()}
          title="Compartir en WhatsApp"
          className="px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white transition-colors flex items-center gap-1.5 text-sm font-semibold">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.532 5.856L.054 23.25a.75.75 0 00.916.919l5.562-1.457A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.7 9.7 0 01-4.95-1.355l-.355-.211-3.684.966.984-3.595-.232-.371A9.718 9.718 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
        </button>
      </div>
    </div>
  )
}
