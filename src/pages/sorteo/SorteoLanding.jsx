import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Ticket, CalendarDays, ListOrdered, ShieldCheck, FileText, ChevronDown } from 'lucide-react'
import { Shell, Card, Spinner, Terminos } from '../../components/sorteo/ui'
import { useRaffleBoard } from '../../hooks/useRaffleBoard'
import { fetchConfig, fmtFecha, fmtSoles, DEFAULT_CONFIG } from '../../lib/sorteo'

export default function SorteoLanding() {
  const [config, setConfig] = useState(null)
  const { stats, loading } = useRaffleBoard()

  useEffect(() => { fetchConfig().then(setConfig).catch(() => setConfig(DEFAULT_CONFIG)) }, [])

  if (!config) return <Shell><Spinner /></Shell>

  const abierto  = config.estado === 'abierto'
  const total    = stats.total || config.total_tickets
  const vendidos = stats.vendidos
  const pct      = total ? Math.round((vendidos / total) * 100) : 0
  const premios  = Array.isArray(config.premios) ? config.premios : []

  return (
    <Shell>
      <section className="text-center pt-2 pb-6">
        <p className="text-xs uppercase tracking-[0.25em] text-red-500 font-semibold">Apex Pro Detailing</p>
        <h1 className="text-3xl sm:text-4xl font-black mt-2">{config.titulo}</h1>
        <p className="text-gray-400 mt-3">
          {premios.reduce((s, p) => s + (Number(p.cantidad) || 1), 0)} premios para tu auto.
          Cada ticket cuesta <span className="text-white font-bold">{fmtSoles(config.precio_ticket)}</span>.
        </p>
      </section>

      <Card className="text-center">
        {loading ? <div className="h-16" /> : (
          <>
            <p className="text-5xl font-black tabular-nums">{stats.disponibles}</p>
            <p className="text-sm text-gray-400 mt-1">tickets disponibles de {total}</p>
            <div className="h-2 bg-white/10 rounded-full mt-4 overflow-hidden" aria-hidden>
              <div className="h-full bg-red-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5">{vendidos} vendidos</p>
          </>
        )}
        {abierto ? (
          <Link to="/sorteo/comprar"
            className="mt-5 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
            <Ticket className="w-5 h-5" /> Comprar tickets
          </Link>
        ) : (
          <p className="mt-5 text-sm text-amber-400 bg-amber-950/30 border border-amber-900/40 rounded-xl py-3">
            La venta de tickets está cerrada.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <Card className="!p-4">
          <CalendarDays className="w-5 h-5 text-red-500" />
          <p className="text-[11px] uppercase tracking-wider text-gray-500 mt-2">Fecha del sorteo</p>
          <p className="text-sm font-semibold mt-0.5 first-letter:uppercase">{fmtFecha(config.fecha_sorteo) || 'Por anunciar'}</p>
        </Card>
        <Card className="!p-4">
          <Ticket className="w-5 h-5 text-red-500" />
          <p className="text-[11px] uppercase tracking-wider text-gray-500 mt-2">Precio</p>
          <p className="text-sm font-semibold mt-0.5">{fmtSoles(config.precio_ticket)} por ticket</p>
          <p className="text-[11px] text-gray-500">Hasta {config.max_por_pedido} por pedido</p>
        </Card>
      </div>

      <h2 className="flex items-center gap-2 text-lg font-bold mt-8 mb-3">
        <Trophy className="w-5 h-5 text-red-500" /> Premios
      </h2>
      <div className="space-y-2">
        {premios.map((p, i) => (
          <Card key={i} className="!p-4 flex items-center gap-4">
            <span className="w-10 h-10 shrink-0 rounded-full bg-red-600/15 text-red-400 font-black flex items-center justify-center">
              {Number(p.cantidad) > 1 ? `×${p.cantidad}` : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.nombre}</p>
              {p.descripcion && <p className="text-xs text-gray-400 mt-0.5">{p.descripcion}</p>}
            </div>
            {Number(p.valor) > 0 && (
              <div className="text-right shrink-0">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Valor{Number(p.cantidad) > 1 ? ' c/u' : ''}</p>
                <p className="font-bold text-sm">{fmtSoles(p.valor)}</p>
              </div>
            )}
          </Card>
        ))}
      </div>

      <h2 className="flex items-center gap-2 text-lg font-bold mt-8 mb-3">
        <ShieldCheck className="w-5 h-5 text-red-500" /> Cómo participar
      </h2>
      <Card>
        <ol className="space-y-2.5 text-sm text-gray-300 list-decimal list-inside">
          <li>Elige tus números en la grilla (o deja que la suerte elija).</li>
          <li>Tus números quedan reservados {config.minutos_reserva} minutos.</li>
          <li>Paga por Yape o Plin al <span className="text-white font-semibold">{config.numero_pago}</span> y sube la captura.</li>
          <li>Cuando verifiquemos el pago, descargas tus tickets en PDF.</li>
        </ol>
      </Card>

      <h2 id="terminos" className="flex items-center gap-2 text-lg font-bold mt-8 mb-3">
        <FileText className="w-5 h-5 text-red-500" /> Términos y condiciones
      </h2>
      <TerminosCard texto={config.terminos} />

      <Link to="/sorteo/lista"
        className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl py-3 transition-colors">
        <ListOrdered className="w-4 h-4" /> Ver la lista de participantes
      </Link>
    </Shell>
  )
}

// Se muestran las primeras secciones; el resto se despliega con un botón.
function TerminosCard({ texto }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <Card className="relative">
      <div className={abierto ? '' : 'max-h-64 overflow-hidden'}>
        <Terminos texto={texto} />
      </div>
      {!abierto && <div className="absolute inset-x-0 bottom-14 h-20 bg-gradient-to-t from-[#1b1b1b] to-transparent pointer-events-none rounded-b-2xl" />}
      <button onClick={() => setAbierto(a => !a)} aria-expanded={abierto}
        className="mt-3 w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-300 hover:text-white border border-white/10 rounded-xl py-2.5 transition-colors">
        {abierto ? 'Ver menos' : 'Leer términos completos'}
        <ChevronDown className={`w-4 h-4 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
    </Card>
  )
}
