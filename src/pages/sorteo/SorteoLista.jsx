import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Ticket } from 'lucide-react'
import { Shell, Card, Spinner, STATUS_STYLE } from '../../components/sorteo/ui'
import { useRaffleBoard } from '../../hooks/useRaffleBoard'
import { boardStatus, fmtNum } from '../../lib/sorteo'

const FILTROS = [
  ['todos', 'Todos'], ['vendido', 'Vendidos'], ['reservado', 'Reservados'], ['disponible', 'Disponibles'],
]

// Lista pública en tiempo real: solo número, nombre y celular ocultos y estado.
export default function SorteoLista() {
  const { rows, stats, loading, tick } = useRaffleBoard()
  const [q,      setQ]      = useState('')
  const [filtro, setFiltro] = useState('todos')

  const items = useMemo(() => {
    const now    = Date.now()
    const numero = q.replace(/\D/g, '')
    return [...rows.values()]
      .map(r => ({ ...r, estado: boardStatus(r, now) }))
      .filter(r => filtro === 'todos' || r.estado === filtro)
      .filter(r => !numero || String(r.number).includes(String(Number(numero))))
      .sort((a, b) => a.number - b.number)
  }, [rows, q, filtro, tick])

  const total = stats.total

  return (
    <Shell back={
      <Link to="/sorteo/comprar" className="text-sm font-semibold bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
        <Ticket className="w-4 h-4" /> Comprar
      </Link>
    }>
      <h1 className="text-xl font-bold">Lista de participantes</h1>
      <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> En vivo
      </p>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {[['vendido', stats.vendidos], ['reservado', stats.reservados], ['disponible', stats.disponibles]].map(([k, n]) => (
          <Card key={k} className="!p-3 text-center">
            <p className={`text-2xl font-black tabular-nums ${STATUS_STYLE[k].text}`}>{n}</p>
            <p className="text-[11px] text-gray-500">{STATUS_STYLE[k].label}s</p>
          </Card>
        ))}
      </div>

      <div className="relative mt-4">
        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input className="input-dark !pl-9" inputMode="numeric" placeholder="Buscar número…"
          value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar por número" />
      </div>

      <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
        {FILTROS.map(([k, label]) => (
          <button key={k} onClick={() => setFiltro(k)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border ${filtro === k ? 'bg-white text-black border-white' : 'border-white/10 text-gray-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="mt-3 bg-[#1b1b1b] border border-white/10 rounded-2xl divide-y divide-white/5 overflow-hidden">
          {items.length === 0 && <p className="text-sm text-gray-500 text-center py-8">Sin resultados</p>}
          {items.map(r => (
            <div key={r.number} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-12 font-black tabular-nums">{fmtNum(r.number, total)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{r.estado === 'disponible' ? <span className="text-gray-600">—</span> : r.nombre}</p>
                {r.estado !== 'disponible' && <p className="text-[11px] text-gray-500 tabular-nums">{r.celular}</p>}
              </div>
              <span className={`text-xs font-semibold flex items-center gap-1.5 ${STATUS_STYLE[r.estado].text}`}>
                <span className={`w-2 h-2 rounded-full ${STATUS_STYLE[r.estado].dot}`} /> {STATUS_STYLE[r.estado].label}
              </span>
            </div>
          ))}
        </div>
      )}
    </Shell>
  )
}
