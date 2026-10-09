import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, RefreshCw, Image as ImageIcon, Check, X, Download, Loader2, MessageCircle, Link2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { fetchOrders, approveOrder, rejectOrder, receiptUrl, fetchOrderStatus, fmtNum, fmtSoles, PUBLIC_SITE } from '../../lib/sorteo'
import { downloadTicketImages } from '../../lib/sorteoImagen'

const etapa = (o) =>
  o.status === 'approved' ? 'aprobado'
  : o.status === 'rejected' ? 'rechazado'
  : o.status === 'expired' ? 'expirado'
  : o.payment_submitted_at ? 'revision' : 'esperando'

const FILTROS = [
  ['revision',  'Por revisar'],
  ['esperando', 'Esperando pago'],
  ['aprobado',  'Aprobados'],
  ['rechazado', 'Rechazados'],
  ['expirado',  'Vencidos'],
  ['todos',     'Todos'],
]

const BADGE = {
  revision:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  esperando: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  aprobado:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rechazado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  expirado:  'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
}

export default function PanelPedidos({ config, admin }) {
  const [orders,  setOrders]  = useState(null)
  const [filtro,  setFiltro]  = useState(admin ? 'revision' : 'todos')
  const [q,       setQ]       = useState('')
  const [working, setWorking] = useState(null)

  const load = useCallback(() => {
    fetchOrders().then(setOrders).catch(e => { toast.error(e.message); setOrders(o => o || []) })
  }, [])

  // Cualquier cambio del tablero (reserva, pago, aprobación) recarga la lista.
  useEffect(() => {
    load()
    let t
    const ch = supabase.channel('raffle-panel-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raffle_board' }, () => {
        clearTimeout(t); t = setTimeout(load, 800)
      })
      .subscribe()
    return () => { clearTimeout(t); supabase.removeChannel(ch) }
  }, [load])

  const counts = useMemo(() => {
    const c = { todos: 0 }
    for (const o of orders || []) { const e = etapa(o); c[e] = (c[e] || 0) + 1; c.todos++ }
    return c
  }, [orders])

  const recaudado = useMemo(() => (orders || []).filter(o => o.status === 'approved').reduce((s, o) => s + Number(o.monto_total), 0), [orders])

  const items = useMemo(() => {
    const term = q.trim().toLowerCase()
    const num  = /^\d+$/.test(term) ? Number(term) : null
    return (orders || [])
      .filter(o => filtro === 'todos' || etapa(o) === filtro)
      .filter(o => !term
        || o.nombre_completo.toLowerCase().includes(term)
        || o.dni.toLowerCase().includes(term)
        || o.celular.includes(term)
        || o.raffle_tickets?.some(t => (t.ticket_code || '').toLowerCase().includes(term))
        || (num !== null && o.raffle_tickets?.some(t => t.number === num)))
  }, [orders, filtro, q])

  async function run(id, fn, ok) {
    setWorking(id)
    try { await fn(); toast.success(ok); load() }
    catch (e) { toast.error(e.message) }
    finally { setWorking(null) }
  }

  async function verComprobante(path) {
    const w = window.open('', '_blank')
    try { const url = await receiptUrl(path); if (w) w.location.href = url; else window.location.href = url }
    catch { w?.close(); toast.error('No se pudo abrir el comprobante') }
  }

  async function pdf(id) {
    try { await downloadTicketImages(await fetchOrderStatus(id), config.total_tickets) }
    catch { toast.error('No se pudieron generar los tickets') }
  }

  function rechazar(o) {
    const motivo = window.prompt(`Rechazar el pedido de ${o.nombre_completo}. Los números se liberan.\n\nMotivo (lo verá el cliente, opcional):`, 'No encontramos el pago')
    if (motivo === null) return
    run(o.id, () => rejectOrder(o.id, motivo), 'Pedido rechazado')
  }

  function aprobar(o) {
    if (!window.confirm(`¿Aprobar ${o.cantidad} ticket(s) de ${o.nombre_completo} por ${fmtSoles(o.monto_total)}?`)) return
    run(o.id, () => approveOrder(o.id), 'Pedido aprobado')
  }

  const total = config.total_tickets

  return (
    <div className="space-y-3">
      {admin && (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Por revisar" value={counts.revision || 0} accent="text-amber-600" />
          <Stat label="Aprobados"   value={counts.aprobado || 0} accent="text-green-600" />
          <Stat label="Recaudado"   value={fmtSoles(recaudado)} />
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input !pl-9" placeholder="Nombre, DNI, celular o número" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button onClick={load} className="btn-secondary !px-3" aria-label="Recargar"><RefreshCw className="w-4 h-4" /></button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTROS.map(([k, label]) => (
          <button key={k} onClick={() => setFiltro(k)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border ${filtro === k ? 'bg-red-600 border-red-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
            {label} {counts[k] ? <span className="opacity-70">({counts[k]})</span> : null}
          </button>
        ))}
      </div>

      {orders === null ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-red-600" /></div>
        : items.length === 0 ? <div className="card text-center text-sm text-gray-500 py-10">No hay pedidos aquí</div>
        : (
          <div className="space-y-2">
            {items.map(o => {
              const e    = etapa(o)
              const nums = (o.raffle_tickets || []).map(t => t.number).sort((a, b) => a - b)
              const busy = working === o.id
              return (
                <div key={o.id} className="card !p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white capitalize truncate">{o.nombre_completo.toLowerCase()}</p>
                      <p className="text-xs text-gray-500">
                        DNI {o.dni} · <a href={`https://wa.me/51${o.celular}`} target="_blank" rel="noreferrer" className="hover:underline">{o.celular}</a>
                        {o.email && <> · {o.email}</>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-gray-900 dark:text-white">{fmtSoles(o.monto_total)}</p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${BADGE[e]}`}>{FILTROS.find(f => f[0] === e)?.[1]}</span>
                    </div>
                  </div>

                  <p className="text-sm mt-2 font-mono text-gray-700 dark:text-gray-300 break-words">
                    {nums.length ? nums.map(n => fmtNum(n, total)).join(' · ') : <span className="text-gray-400 font-sans text-xs">Números liberados</span>}
                  </p>

                  <p className="text-[11px] text-gray-500 mt-1.5">
                    {new Date(o.created_at).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                    {o.medio_pago && <> · <span className="capitalize">{o.medio_pago}</span></>}
                    {o.n_operacion && <> · Op. {o.n_operacion}</>}
                    {' · '}{o.origen === 'panel' ? `Vendió ${o.vendedor || 'panel'}` : 'Web'}
                    {o.motivo_rechazo && <> · {o.motivo_rechazo}</>}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {admin && o.comprobante_url && (
                      <button onClick={() => verComprobante(o.comprobante_url)} className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" /> Comprobante</button>
                    )}
                    {admin && o.status === 'pending' && (
                      <>
                        <button disabled={busy} onClick={() => aprobar(o)} className="btn-primary !py-1.5 !px-3 text-xs flex items-center gap-1 !bg-green-600 hover:!bg-green-700">
                          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Aprobar
                        </button>
                        <button disabled={busy} onClick={() => rechazar(o)} className="btn-danger !py-1.5 !px-3 text-xs flex items-center gap-1"><X className="w-3.5 h-3.5" /> Rechazar</button>
                      </>
                    )}
                    {o.status === 'approved' && (
                      <button onClick={() => pdf(o.id)} className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Tickets JPG</button>
                    )}
                    <button onClick={() => navigator.clipboard.writeText(`${PUBLIC_SITE}/sorteo/estado/${o.id}`).then(() => toast.success('Enlace copiado'))}
                      className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Enlace</button>
                    <a href={`https://wa.me/51${o.celular}?text=${encodeURIComponent(`Hola, este es el estado de tu pedido del ${config.titulo}: ${PUBLIC_SITE}/sorteo/estado/${o.id}`)}`}
                      target="_blank" rel="noreferrer" className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
    </div>
  )
}

function Stat({ label, value, accent = 'text-gray-900 dark:text-white' }) {
  return (
    <div className="card !p-3 text-center">
      <p className={`text-xl font-black tabular-nums ${accent}`}>{value}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </div>
  )
}
