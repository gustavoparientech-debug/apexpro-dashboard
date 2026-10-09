import { useEffect, useRef, useState } from 'react'
import { Clock, Copy, Check, ImagePlus, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { Card, Campo, ErrorBox, Boton } from './ui'
import { fmtNum, fmtSoles, fmtPhone, uploadReceipt, submitPayment, MAX_RECEIPT_BYTES } from '../../lib/sorteo'

function useCountdown(until) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(until).getTime() - Date.now()))
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, new Date(until).getTime() - Date.now())), 1000)
    return () => clearInterval(t)
  }, [until])
  return left
}

// Paso 2 de la compra: temporizador, datos de Yape/Plin y subida del comprobante.
export default function PaymentStep({ order, config, onDone, onExpired }) {
  const left    = useCountdown(order.reserved_until)
  const mm      = String(Math.floor(left / 60000)).padStart(2, '0')
  const ss      = String(Math.floor((left % 60000) / 1000)).padStart(2, '0')
  const urgente = left < 3 * 60 * 1000

  const [medio,   setMedio]   = useState('yape')
  const [nOp,     setNOp]     = useState('')
  const [file,    setFile]    = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState('')
  const [copied,  setCopied]  = useState(false)
  const inputRef = useRef(null)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  function pick(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('El comprobante debe ser una imagen (captura de pantalla).'); return }
    if (f.size > MAX_RECEIPT_BYTES)  { setError('La imagen pesa más de 5 MB.'); return }
    setError('')
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(config.numero_pago); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  async function enviar(e) {
    e.preventDefault()
    if (!file) { setError('Sube la captura de tu pago.'); return }
    setBusy(true); setError('')
    try {
      const path = await uploadReceipt(order.order_id, file)
      await submitPayment({ orderId: order.order_id, medio, nOperacion: nOp, path })
      toast.success('¡Comprobante enviado!')
      onDone()
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  if (left === 0) {
    return (
      <Card className="text-center">
        <Clock className="w-8 h-8 text-amber-500 mx-auto" />
        <p className="font-bold mt-3">Tu reserva venció</p>
        <p className="text-sm text-gray-400 mt-1">Si ya pagaste, escríbenos al WhatsApp {fmtPhone(config.whatsapp)} con tu captura.</p>
        <Boton className="mt-4" onClick={onExpired}>Elegir números de nuevo</Boton>
      </Card>
    )
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <div className={`rounded-2xl p-4 text-center border ${urgente ? 'bg-red-950/50 border-red-800/60' : 'bg-[#1b1b1b] border-white/10'}`}>
        <p className="text-xs text-gray-400 flex items-center justify-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Tus números están reservados por</p>
        <p className={`text-4xl font-black tabular-nums mt-1 ${urgente ? 'text-red-400' : ''}`} aria-live="polite">{mm}:{ss}</p>
      </div>

      <Card>
        <p className="text-xs text-gray-400">Tus números</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {order.numbers.map(n => (
            <span key={n} className="px-2 py-1 rounded-md bg-green-600/20 text-green-300 text-sm font-bold tabular-nums">{fmtNum(n, config.total_tickets)}</span>
          ))}
        </div>
        <div className="flex items-baseline justify-between mt-4 pt-3 border-t border-white/10">
          <span className="text-sm text-gray-400">{order.cantidad} ticket{order.cantidad !== 1 ? 's' : ''}</span>
          <span className="text-2xl font-black">{fmtSoles(order.monto_total)}</span>
        </div>
      </Card>

      <Card>
        <p className="font-semibold">Paga por Yape o Plin</p>
        <div className="flex items-center justify-between gap-3 mt-3 bg-[#232323] rounded-xl px-4 py-3">
          <div>
            <p className="text-2xl font-black tracking-wider tabular-nums">{fmtPhone(config.numero_pago)}</p>
            {config.titular_pago && <p className="text-xs text-gray-400">A nombre de {config.titular_pago}</p>}
          </div>
          <button type="button" onClick={copiar} className="shrink-0 p-2.5 rounded-lg border border-white/10 hover:bg-white/5" aria-label="Copiar número">
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Monto exacto: <span className="text-white font-semibold">{fmtSoles(order.monto_total)}</span></p>

        <div className="grid grid-cols-2 gap-2 mt-4" role="radiogroup" aria-label="Medio de pago">
          {['yape', 'plin'].map(m => (
            <button key={m} type="button" role="radio" aria-checked={medio === m} onClick={() => setMedio(m)}
              className={`py-2.5 rounded-xl border font-semibold capitalize transition-colors ${medio === m ? 'border-red-500 bg-red-600/15 text-white' : 'border-white/10 text-gray-400'}`}>
              {m}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <Campo label="N.° de operación (opcional)">
            <input className="input-dark" value={nOp} maxLength={40} inputMode="numeric"
              onChange={e => setNOp(e.target.value)} placeholder="Aparece en tu constancia" />
          </Campo>
        </div>

        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} />
        <button type="button" onClick={() => inputRef.current?.click()}
          className="mt-3 w-full border-2 border-dashed border-white/15 hover:border-red-600/60 rounded-xl p-4 text-center transition-colors">
          {preview
            ? <img src={preview} alt="Captura del pago" className="max-h-64 mx-auto rounded-lg" />
            : <span className="flex flex-col items-center gap-1.5 text-gray-400 text-sm">
                <ImagePlus className="w-7 h-7" /> Subir captura del pago
                <span className="text-[11px] text-gray-500">Imagen de hasta 5 MB</span>
              </span>}
        </button>
        {preview && <p className="text-[11px] text-gray-500 text-center mt-1">Toca la imagen para cambiarla</p>}
      </Card>

      <ErrorBox>{error}</ErrorBox>
      <Boton type="submit" busy={busy} disabled={!file}><Upload className="w-4 h-4" /> Enviar comprobante</Boton>
    </form>
  )
}
