import { useMemo, useRef, useState } from 'react'
import { Shuffle, Trash2, ImagePlus, Check, Download, MessageCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import TicketGrid from './TicketGrid'
import { Leyenda } from './ui'
import BuyerFields, { EMPTY_BUYER, validateBuyer } from './BuyerFields'
import { useRaffleBoard } from '../../hooks/useRaffleBoard'
import { staffSell, staffAttachReceipt, uploadReceipt, boardStatus, fmtNum, fmtSoles, MAX_RECEIPT_BYTES, PUBLIC_SITE } from '../../lib/sorteo'
import { downloadTicketsPdf } from '../../lib/sorteoPdf'

const MEDIOS = [['efectivo', 'Efectivo'], ['yape', 'Yape'], ['plin', 'Plin'], ['transferencia', 'Transferencia']]

// Venta en el local. La del admin queda aprobada al instante; la de un
// trabajador queda "en revisión" hasta que el admin la apruebe en Pedidos.
export default function PanelVender({ config, admin }) {
  const { rows, stats, loading, tick } = useRaffleBoard()
  const [selected, setSelected] = useState(() => new Set())
  const [buyer,    setBuyer]    = useState(EMPTY_BUYER)
  const [medio,    setMedio]    = useState('efectivo')
  const [nOp,      setNOp]      = useState('')
  const [file,     setFile]     = useState(null)
  const [busy,     setBusy]     = useState(false)
  const [venta,    setVenta]    = useState(null)
  const fileRef = useRef(null)

  const total = stats.total || config.total_tickets
  const max   = config.max_por_pedido
  const lista = useMemo(() => [...selected].sort((a, b) => a - b), [selected])

  function toggle(n) {
    setSelected(prev => {
      const s = new Set(prev)
      if (s.has(n)) s.delete(n)
      else if (s.size >= max) { toast.error(`Máximo ${max} por pedido`); return prev }
      else s.add(n)
      return s
    })
  }

  function alAzar() {
    const now = Date.now()
    const libres = []
    for (let n = 1; n <= total; n++) if (!selected.has(n) && boardStatus(rows.get(n), now) === 'disponible') libres.push(n)
    if (libres.length && selected.size < max) setSelected(prev => new Set(prev).add(libres[Math.floor(Math.random() * libres.length)]))
  }

  function pick(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/') || f.size > MAX_RECEIPT_BYTES) { toast.error('Imagen de hasta 5 MB'); return }
    setFile(f)
  }

  async function vender(e) {
    e.preventDefault()
    if (!selected.size) { toast.error('Elige al menos un número'); return }
    const v = validateBuyer(buyer)
    if (v) { toast.error(v); return }
    setBusy(true)
    try {
      const res = await staffSell({ numbers: lista, ...buyer, medio, nOperacion: nOp })
      if (file) {
        try { await staffAttachReceipt(res.id, await uploadReceipt(`panel/${res.id}`, file)) }
        catch { toast.error('La venta se guardó, pero no se pudo subir la foto') }
      }
      toast.success(res.etapa === 'aprobado' ? 'Venta registrada y aprobada' : 'Venta registrada, pendiente de aprobación')
      setVenta({ ...res, celular: buyer.celular.replace(/\D/g, '') })
      setSelected(new Set()); setBuyer(EMPTY_BUYER); setNOp(''); setFile(null); setMedio('efectivo')
    } catch (err) {
      toast.error(err.message)
    } finally { setBusy(false) }
  }

  if (venta) return <VentaHecha venta={venta} total={total} onNueva={() => setVenta(null)} />

  if (config.estado !== 'abierto') {
    return <div className="card text-sm text-gray-500">La venta está cerrada. {admin && 'Ábrela en Configuración.'}</div>
  }

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
      <div className="card !p-3 !bg-[#111] !border-gray-800">
        <div className="flex items-center justify-between gap-2 mb-2 text-white">
          <p className="text-sm"><span className="font-bold">{stats.disponibles}</span> <span className="text-gray-400">disponibles</span></p>
          <button type="button" onClick={alAzar} className="text-sm flex items-center gap-1.5 bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-lg">
            <Shuffle className="w-4 h-4" /> Al azar
          </button>
        </div>
        <div className="mb-2"><Leyenda withSelected /></div>
        {loading
          ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-red-500" /></div>
          : <TicketGrid rows={rows} total={total} selected={selected} onToggle={toggle} tick={tick} />}
      </div>

      <form onSubmit={vender} className="card space-y-4 lg:sticky lg:top-4">
        <div>
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900 dark:text-white">Números</p>
            {selected.size > 0 && (
              <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-gray-500 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Vaciar</button>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1 break-words">{lista.length ? lista.map(n => fmtNum(n, total)).join(', ') : 'Toca los números de la grilla'}</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">{fmtSoles(selected.size * Number(config.precio_ticket))}</p>
        </div>

        <BuyerFields value={buyer} onChange={setBuyer} inputClass="input" />

        <div>
          <span className="label">Medio de pago</span>
          <div className="grid grid-cols-2 gap-1.5">
            {MEDIOS.map(([k, label]) => (
              <button key={k} type="button" onClick={() => setMedio(k)}
                className={`py-2 rounded-lg text-sm font-medium border ${medio === k ? 'border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {medio !== 'efectivo' && (
          <div className="space-y-2">
            <input className="input" placeholder="N.° de operación (opcional)" value={nOp} maxLength={40} onChange={e => setNOp(e.target.value)} />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary w-full text-sm flex items-center justify-center gap-1.5">
              {file ? <><Check className="w-4 h-4 text-green-600" /> {file.name.slice(0, 24)}</> : <><ImagePlus className="w-4 h-4" /> Foto del comprobante (opcional)</>}
            </button>
          </div>
        )}

        <button type="submit" disabled={busy || !selected.size} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Registrar venta
        </button>
        {!admin && <p className="text-[11px] text-gray-500 text-center">El administrador aprobará la venta y se generarán los códigos.</p>}
      </form>
    </div>
  )
}

function VentaHecha({ venta, total, onNueva }) {
  const aprobado = venta.etapa === 'aprobado'
  const url = `${PUBLIC_SITE}/sorteo/estado/${venta.id}`
  const nums = venta.tickets.map(t => fmtNum(t.number, total)).join(', ')
  const msg = `¡Hola! Gracias por participar en el ${venta.titulo}. Tus números: ${nums}. Mira el estado de tu pedido y descarga tus tickets aquí: ${url}`

  return (
    <div className="card max-w-md space-y-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${aprobado ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'}`}>
          <Check className="w-5 h-5" />
        </div>
        <div>
          <p className="font-bold text-gray-900 dark:text-white">{aprobado ? 'Venta aprobada' : 'Venta pendiente de aprobación'}</p>
          <p className="text-sm text-gray-500 capitalize">{venta.nombre.toLowerCase()} · {fmtSoles(venta.monto_total)}</p>
        </div>
      </div>
      <div className="space-y-1">
        {venta.tickets.map(t => (
          <div key={t.number} className="flex justify-between text-sm bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-1.5">
            <span className="font-bold tabular-nums">{fmtNum(t.number, total)}</span>
            <span className="font-mono text-gray-500">{t.code || 'código al aprobar'}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a href={`https://wa.me/51${venta.celular}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"
          className="btn-secondary text-sm flex items-center justify-center gap-1.5"><MessageCircle className="w-4 h-4" /> WhatsApp</a>
        <button disabled={!aprobado} onClick={() => downloadTicketsPdf(venta, total)}
          className="btn-secondary text-sm flex items-center justify-center gap-1.5 disabled:opacity-40"><Download className="w-4 h-4" /> PDF</button>
      </div>
      <button onClick={onNueva} className="btn-primary w-full">Nueva venta</button>
    </div>
  )
}
