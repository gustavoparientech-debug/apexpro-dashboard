import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, Clock, XCircle, Hourglass, Download, Ticket, Link2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Shell, Card, Boton, Spinner } from '../../components/sorteo/ui'
import { fetchOrderStatus, fetchConfig, fmtNum, fmtSoles, fmtFecha, fmtPhone, DEFAULT_CONFIG } from '../../lib/sorteo'
import { downloadTicketImages } from '../../lib/sorteoImagen'

const ETAPAS = {
  esperando_pago: { icon: Clock,        color: 'text-amber-400', titulo: 'Esperando tu pago',       texto: 'Tus números están reservados. Sube tu comprobante antes de que venza la reserva.' },
  en_revision:    { icon: Hourglass,    color: 'text-amber-400', titulo: 'Pago en revisión',        texto: 'Recibimos tu comprobante. Te avisaremos cuando lo verifiquemos; esta página se actualiza sola.' },
  aprobado:       { icon: CheckCircle2, color: 'text-green-400', titulo: '¡Pago aprobado!',         texto: 'Ya estás participando. Descarga tus tickets y guárdalos.' },
  rechazado:      { icon: XCircle,      color: 'text-red-400',   titulo: 'Pago rechazado',          texto: 'No pudimos verificar tu pago y los números se liberaron.' },
  expirado:       { icon: XCircle,      color: 'text-gray-400',  titulo: 'Reserva vencida',         texto: 'No recibimos el comprobante a tiempo y los números se liberaron.' },
}

export default function SorteoEstado() {
  const { orderId } = useParams()
  const [order,  setOrder]  = useState(undefined)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [busy,   setBusy]   = useState(false)

  const load = useCallback(() => {
    if (!/^[0-9a-f-]{36}$/i.test(orderId || '')) { setOrder(null); return }
    fetchOrderStatus(orderId).then(setOrder).catch(() => setOrder(o => o ?? null))
  }, [orderId])

  useEffect(() => { load(); fetchConfig().then(setConfig).catch(() => {}) }, [load])

  // Mientras está pendiente, consultar cada 20 s.
  useEffect(() => {
    if (!order || !['esperando_pago', 'en_revision'].includes(order.etapa)) return
    const t = setInterval(load, 20_000)
    return () => clearInterval(t)
  }, [order, load])

  async function descargar() {
    setBusy(true)
    try { await downloadTicketImages(order, config.total_tickets) }
    catch { toast.error('No se pudieron generar los tickets') }
    finally { setBusy(false) }
  }

  async function copiarEnlace() {
    try { await navigator.clipboard.writeText(window.location.href); toast.success('Enlace copiado') } catch {}
  }

  if (order === undefined) return <Shell><Spinner /></Shell>
  if (order === null) {
    return (
      <Shell>
        <Card className="text-center">
          <p className="font-bold">No encontramos ese pedido</p>
          <p className="text-sm text-gray-400 mt-1">Revisa el enlace o escríbenos al WhatsApp {fmtPhone(config.whatsapp)}.</p>
          <Link to="/sorteo" className="inline-block mt-4 text-sm text-red-400 underline">Ir al sorteo</Link>
        </Card>
      </Shell>
    )
  }

  const e    = ETAPAS[order.etapa] || ETAPAS.en_revision
  const Icon = e.icon
  const total = config.total_tickets

  return (
    <Shell>
      <Card className="text-center">
        <Icon className={`w-12 h-12 mx-auto ${e.color}`} />
        <h1 className="text-xl font-bold mt-3">{e.titulo}</h1>
        <p className="text-sm text-gray-400 mt-1.5">{e.texto}</p>
        {order.etapa === 'rechazado' && order.motivo_rechazo && (
          <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2 mt-3">{order.motivo_rechazo}</p>
        )}
        {order.etapa === 'esperando_pago' && (
          <Link to="/sorteo/comprar" className="inline-block mt-4 text-sm text-red-400 underline">Ir a subir mi comprobante</Link>
        )}
      </Card>

      <Card className="mt-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Participante</span>
          <span className="font-semibold text-right capitalize">{order.nombre.toLowerCase()}</span>
        </div>
        {order.dni && (
          <div className="flex justify-between text-sm mt-1.5">
            <span className="text-gray-400">DNI</span><span className="tabular-nums">{order.dni}</span>
          </div>
        )}
        <div className="flex justify-between text-sm mt-1.5">
          <span className="text-gray-400">Total</span>
          <span className="font-semibold">{fmtSoles(order.monto_total)} · {order.cantidad} ticket{order.cantidad !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex justify-between text-sm mt-1.5">
          <span className="text-gray-400">Sorteo</span>
          <span className="text-right first-letter:uppercase">{fmtFecha(order.fecha_sorteo) || 'Por anunciar'}</span>
        </div>
      </Card>

      {order.tickets.length > 0 && (
        <Card className="mt-3">
          <p className="text-xs text-gray-400 flex items-center gap-1.5"><Ticket className="w-3.5 h-3.5" /> Tus números</p>
          <div className="mt-3 space-y-1.5">
            {order.tickets.map(t => (
              <div key={t.number} className="flex items-center justify-between bg-[#232323] rounded-lg px-3 py-2">
                <span className="text-lg font-black tabular-nums">{fmtNum(t.number, total)}</span>
                <span className="font-mono text-sm text-gray-300">{t.code || 'Código al aprobar'}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {order.etapa === 'aprobado' && (
        <Boton className="mt-4" busy={busy} onClick={descargar}><Download className="w-4 h-4" /> Descargar mis tickets (imagen)</Boton>
      )}
      {['esperando_pago', 'en_revision'].includes(order.etapa) && (
        <Boton variant="secondary" className="mt-4" onClick={copiarEnlace}><Link2 className="w-4 h-4" /> Copiar enlace de esta página</Boton>
      )}
      {['rechazado', 'expirado'].includes(order.etapa) && (
        <Link to="/sorteo/comprar" className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center">
          Elegir números de nuevo
        </Link>
      )}
      <p className="text-[11px] text-gray-500 text-center mt-4">
        Guarda este enlace para volver a ver tu pedido. ¿Dudas? WhatsApp {fmtPhone(config.whatsapp)}
      </p>
    </Shell>
  )
}
