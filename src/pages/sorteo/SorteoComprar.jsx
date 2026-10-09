import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Shuffle, Trash2, X, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { Shell, Card, ErrorBox, Boton, Spinner, Leyenda, Terminos } from '../../components/sorteo/ui'
import TicketGrid from '../../components/sorteo/TicketGrid'
import BuyerFields, { EMPTY_BUYER, validateBuyer } from '../../components/sorteo/BuyerFields'
import PaymentStep from '../../components/sorteo/PaymentStep'
import { useRaffleBoard } from '../../hooks/useRaffleBoard'
import {
  fetchConfig, reserveTickets, fetchOrderStatus, boardStatus,
  fmtNum, fmtSoles, DEFAULT_CONFIG,
} from '../../lib/sorteo'

// Si el cliente recarga la página durante los 15 minutos, recupera su reserva.
const ACTIVE_KEY = 'apexpro_sorteo_reserva'
const loadActive  = () => { try { return JSON.parse(localStorage.getItem(ACTIVE_KEY)) } catch { return null } }
const saveActive  = (o) => { try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(o)) } catch {} }
const clearActive = () => { try { localStorage.removeItem(ACTIVE_KEY) } catch {} }

export default function SorteoComprar() {
  const navigate = useNavigate()
  const { rows, stats, loading, tick } = useRaffleBoard()
  const [config,   setConfig]   = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [buyer,    setBuyer]    = useState(EMPTY_BUYER)
  const [acepta,   setAcepta]   = useState(false)
  const [terms,    setTerms]    = useState(false)
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState('')
  const [order,    setOrder]    = useState(null)

  useEffect(() => { fetchConfig().then(setConfig).catch(() => setConfig(DEFAULT_CONFIG)) }, [])

  useEffect(() => {
    const saved = loadActive()
    if (!saved?.order_id) return
    fetchOrderStatus(saved.order_id).then(st => {
      if (st?.etapa === 'esperando_pago') setOrder(saved)
      else { clearActive(); if (st) navigate(`/sorteo/estado/${saved.order_id}`, { replace: true }) }
    }).catch(() => {})
  }, [navigate])

  // Si alguien toma uno de mis números antes de confirmar, lo saco y aviso.
  useEffect(() => {
    if (order || busy) return  // mientras reservo, mis propios números cambian de estado
    const now = Date.now()
    const perdidos = [...selected].filter(n => boardStatus(rows.get(n), now) !== 'disponible')
    if (!perdidos.length) return
    setSelected(prev => { const s = new Set(prev); perdidos.forEach(n => s.delete(n)); return s })
    toast(`El ${perdidos.map(n => fmtNum(n)).join(', ')} acaba de ser tomado`, { icon: '⚠️' })
  }, [rows]) // eslint-disable-line react-hooks/exhaustive-deps

  const cfg   = config || DEFAULT_CONFIG
  const max   = cfg.max_por_pedido
  const total = stats.total || cfg.total_tickets
  const monto = selected.size * Number(cfg.precio_ticket)
  const lista = useMemo(() => [...selected].sort((a, b) => a - b), [selected])

  function toggle(n) {
    setError('')
    setSelected(prev => {
      const s = new Set(prev)
      if (s.has(n)) s.delete(n)
      else if (s.size >= max) { toast.error(`Máximo ${max} tickets por pedido`); return prev }
      else s.add(n)
      return s
    })
  }

  function alAzar() {
    const now = Date.now()
    const libres = []
    for (let n = 1; n <= total; n++) if (!selected.has(n) && boardStatus(rows.get(n), now) === 'disponible') libres.push(n)
    if (!libres.length || selected.size >= max) return
    const pick = libres[Math.floor(Math.random() * libres.length)]
    setSelected(prev => new Set(prev).add(pick))
    toast.success(`¡Salió el ${fmtNum(pick, total)}!`)
  }

  async function confirmar(e) {
    e.preventDefault()
    if (!selected.size) { setError('Elige al menos un número.'); return }
    const v = validateBuyer(buyer)
    if (v) { setError(v); return }
    if (!acepta) { setError('Debes aceptar los términos y condiciones.'); return }
    setBusy(true); setError('')
    try {
      const res = await reserveTickets({ numbers: lista, ...buyer, acepta })
      saveActive(res)
      setOrder(res)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  const back = (
    <Link to="/sorteo" className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
      <ArrowLeft className="w-4 h-4" /> Volver
    </Link>
  )

  if (!config || loading) return <Shell back={back}><Spinner /></Shell>

  if (order) {
    return (
      <Shell back={back}>
        <h1 className="text-xl font-bold mb-4">Completa tu pago</h1>
        <PaymentStep order={order} config={cfg}
          onDone={() => { clearActive(); navigate(`/sorteo/estado/${order.order_id}`) }}
          onExpired={() => { clearActive(); setOrder(null); setSelected(new Set()) }} />
      </Shell>
    )
  }

  if (cfg.estado !== 'abierto') {
    return <Shell back={back}><Card className="text-center text-gray-300">La venta de tickets está cerrada.</Card></Shell>
  }

  return (
    <Shell wide back={back}>
      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-6 lg:items-start">
        <section>
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <h1 className="text-xl font-bold">Elige tus números</h1>
              <p className="text-sm text-gray-400">{stats.disponibles} disponibles · {fmtSoles(cfg.precio_ticket)} cada uno</p>
            </div>
            <button type="button" onClick={alAzar} disabled={selected.size >= max}
              className="shrink-0 flex items-center gap-1.5 text-sm font-semibold bg-white/10 hover:bg-white/15 disabled:opacity-40 px-3 py-2 rounded-xl transition-colors">
              <Shuffle className="w-4 h-4" /> Al azar
            </button>
          </div>
          <div className="mb-3"><Leyenda withSelected /></div>
          <TicketGrid rows={rows} total={total} selected={selected} onToggle={toggle} tick={tick} />
        </section>

        <form onSubmit={confirmar} className="mt-6 lg:mt-0 space-y-3 lg:sticky lg:top-4">
          <Card>
            <div className="flex items-center justify-between">
              <p className="font-semibold">Tu pedido</p>
              {selected.size > 0 && (
                <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Vaciar
                </button>
              )}
            </div>
            {lista.length ? (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {lista.map(n => (
                  <button key={n} type="button" onClick={() => toggle(n)} aria-label={`Quitar ${fmtNum(n, total)}`}
                    className="flex items-center gap-1 pl-2 pr-1.5 py-1 rounded-md bg-green-600/20 text-green-300 text-sm font-bold tabular-nums hover:bg-green-600/30">
                    {fmtNum(n, total)} <X className="w-3 h-3 opacity-60" />
                  </button>
                ))}
              </div>
            ) : <p className="text-sm text-gray-500 mt-2">Toca los números de la grilla.</p>}
            <div className="flex items-baseline justify-between mt-4 pt-3 border-t border-white/10">
              <span className="text-sm text-gray-400">{selected.size} de {max} máx. × {fmtSoles(cfg.precio_ticket)}</span>
              <span className="text-2xl font-black">{fmtSoles(monto)}</span>
            </div>
          </Card>

          <Card>
            <p className="font-semibold mb-3">Tus datos</p>
            <BuyerFields value={buyer} onChange={setBuyer} />
            <label className="flex items-start gap-2.5 mt-4 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} className="mt-0.5 w-4 h-4 accent-red-600" required />
              <span>Acepto los <button type="button" onClick={() => setTerms(true)} className="underline text-white">términos y condiciones</button> del sorteo.</span>
            </label>
          </Card>

          <ErrorBox>{error}</ErrorBox>
          <Boton type="submit" busy={busy} disabled={!selected.size}>
            Reservar {selected.size || ''} ticket{selected.size !== 1 ? 's' : ''} · {fmtSoles(monto)}
          </Boton>
          <p className="text-[11px] text-gray-500 text-center">Tendrás {cfg.minutos_reserva} minutos para pagar y subir tu comprobante.</p>
        </form>
      </div>

      {terms && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={() => setTerms(false)}>
          <div className="bg-[#1b1b1b] border border-white/10 rounded-2xl p-5 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Términos y condiciones">
            <p className="font-bold flex items-center gap-2"><FileText className="w-4 h-4 text-red-500" /> Términos y condiciones</p>
            <div className="mt-4"><Terminos texto={cfg.terminos} /></div>
            <Boton className="mt-5" onClick={() => { setAcepta(true); setTerms(false) }}>Acepto</Boton>
          </div>
        </div>
      )}
    </Shell>
  )
}
