import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { LogoOscuro } from '../ui/Logo'

// Piezas compartidas de las páginas públicas del sorteo. Siempre en oscuro,
// igual que /fidelidad: es la cara de la marca hacia el cliente.

export function Shell({ children, wide = false, back }) {
  return (
    <div className="min-h-screen bg-[#111] text-white">
      <header className="border-b border-white/5">
        <div className={`mx-auto px-4 h-16 flex items-center justify-between ${wide ? 'max-w-5xl' : 'max-w-xl'}`}>
          <Link to="/sorteo" aria-label="Sorteo Apex Pro"><LogoOscuro className="h-9" /></Link>
          {back}
        </div>
      </header>
      <main className={`mx-auto px-4 py-6 ${wide ? 'max-w-5xl' : 'max-w-xl'}`}>{children}</main>
      <footer className="text-center text-[11px] text-gray-600 py-8 px-4">
        Apex Pro Detailing · Arequipa ·{' '}
        <a href="https://wa.me/51959240309" className="hover:text-gray-400">WhatsApp 959 240 309</a> ·{' '}
        <a href="https://instagram.com/apex.pro.aqp" className="hover:text-gray-400">@apex.pro.aqp</a>
      </footer>
      <style>{`
        .input-dark {
          width: 100%; background: #232323; border: 1px solid rgba(255,255,255,.12);
          border-radius: .6rem; padding: .6rem .75rem; font-size: 1rem; color: #fff; outline: none;
        }
        .input-dark:focus { border-color: #dc2626; box-shadow: 0 0 0 2px rgba(220,38,38,.25); }
        .input-dark::placeholder { color: #6b7280; }
      `}</style>
    </div>
  )
}

export function Card({ className = '', children }) {
  return <div className={`bg-[#1b1b1b] border border-white/10 rounded-2xl p-5 ${className}`}>{children}</div>
}

export function Campo({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-400 mb-1 block">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-gray-500 mt-1 block">{hint}</span>}
    </label>
  )
}

export function ErrorBox({ children }) {
  if (!children) return null
  return <p role="alert" className="text-sm text-red-300 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">{children}</p>
}

export function Boton({ busy, children, className = '', variant = 'primary', ...props }) {
  const styles = variant === 'primary'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'border border-white/15 text-gray-200 hover:bg-white/5'
  return (
    <button disabled={busy || props.disabled} {...props}
      className={`w-full font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${styles} ${className}`}>
      {busy && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-7 h-7 animate-spin text-red-500" />
    </div>
  )
}

// Colores por estado, compartidos por grilla, lista y leyenda.
export const STATUS_STYLE = {
  disponible: { label: 'Disponible', cell: 'bg-[#232323] text-gray-200 hover:bg-[#2e2e2e] border-white/10', dot: 'bg-gray-400', text: 'text-gray-300' },
  reservado:  { label: 'Reservado',  cell: 'bg-amber-900/40 text-amber-300/80 border-amber-700/30 cursor-not-allowed', dot: 'bg-amber-500', text: 'text-amber-400' },
  vendido:    { label: 'Vendido',    cell: 'bg-red-950/60 text-red-400/60 border-red-900/30 cursor-not-allowed line-through', dot: 'bg-red-600', text: 'text-red-400' },
  elegido:    { label: 'Tu elección', cell: 'bg-green-600 text-white border-green-400 font-bold', dot: 'bg-green-500', text: 'text-green-400' },
}

export function Leyenda({ withSelected = false }) {
  const keys = ['disponible', 'reservado', 'vendido', ...(withSelected ? ['elegido'] : [])]
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
      {keys.map(k => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${STATUS_STYLE[k].dot}`} /> {STATUS_STYLE[k].label}
        </span>
      ))}
    </div>
  )
}
