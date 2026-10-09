import { useState } from 'react'
import { Plus, Trash2, Save, Loader2, Copy, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { updateConfig, resetRaffle } from '../../lib/sorteo'

// Arequipa no cambia de horario: siempre UTC-5.
const toLocalInput = (iso) => iso ? new Date(new Date(iso).getTime() - 5 * 3600e3).toISOString().slice(0, 16) : ''
const fromLocalInput = (v) => v ? new Date(`${v}:00-05:00`).toISOString() : null

export default function PanelConfig({ config, onSaved }) {
  const [f, setF] = useState(() => ({
    ...config,
    fecha_local: toLocalInput(config.fecha_sorteo),
    premios: (Array.isArray(config.premios) ? config.premios : []).map(p => ({ ...p })),
  }))
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setF(prev => ({ ...prev, [k]: e.target.value }))
  const setPremio = (i, k, v) => setF(prev => ({ ...prev, premios: prev.premios.map((p, j) => j === i ? { ...p, [k]: v } : p) }))

  async function guardar(e) {
    e.preventDefault()
    const premios = f.premios
      .filter(p => String(p.nombre || '').trim())
      .map(p => ({
        nombre: p.nombre.trim(),
        cantidad: Math.max(1, parseInt(p.cantidad, 10) || 1),
        valor: p.valor === '' || p.valor == null ? null : Number(p.valor),
        ...(p.descripcion?.trim() ? { descripcion: p.descripcion.trim() } : {}),
      }))
    setBusy(true)
    try {
      const saved = await updateConfig({
        titulo: f.titulo.trim() || 'Sorteo Apex Pro',
        precio_ticket: Number(f.precio_ticket),
        total_tickets: parseInt(f.total_tickets, 10),
        max_por_pedido: parseInt(f.max_por_pedido, 10),
        minutos_reserva: parseInt(f.minutos_reserva, 10),
        fecha_sorteo: fromLocalInput(f.fecha_local),
        premios,
        numero_pago: f.numero_pago.replace(/\D/g, ''),
        titular_pago: f.titular_pago?.trim() || null,
        whatsapp: f.whatsapp.replace(/\D/g, ''),
        instagram: f.instagram.trim(),
        terminos: f.terminos?.trim() || null,
        estado: f.estado,
      })
      onSaved(saved)
      toast.success('Configuración guardada')
    } catch (err) {
      toast.error(err.message)
    } finally { setBusy(false) }
  }

  const links = [['Página del sorteo', '/sorteo'], ['Comprar', '/sorteo/comprar'], ['Lista de participantes', '/sorteo/lista']]

  return (
    <form onSubmit={guardar} className="space-y-4 max-w-3xl">
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">Venta {f.estado === 'abierto' ? 'abierta' : 'cerrada'}</p>
            <p className="text-xs text-gray-500">Cerrada: nadie puede reservar ni vender números.</p>
          </div>
          <button type="button" onClick={() => setF(p => ({ ...p, estado: p.estado === 'abierto' ? 'cerrado' : 'abierto' }))}
            className={`relative w-12 h-7 rounded-full transition-colors ${f.estado === 'abierto' ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-700'}`}
            role="switch" aria-checked={f.estado === 'abierto'} aria-label="Venta abierta">
            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${f.estado === 'abierto' ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {links.map(([label, path]) => (
            <button key={path} type="button" className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1"
              onClick={() => navigator.clipboard.writeText(window.location.origin + path).then(() => toast.success('Enlace copiado'))}>
              <Copy className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card grid sm:grid-cols-2 gap-3">
        <Field label="Título"><input className="input" value={f.titulo} onChange={set('titulo')} maxLength={80} /></Field>
        <Field label="Fecha y hora del sorteo"><input className="input" type="datetime-local" value={f.fecha_local} onChange={set('fecha_local')} /></Field>
        <Field label="Precio por ticket (S/)"><input className="input" type="number" min="1" step="0.5" value={f.precio_ticket} onChange={set('precio_ticket')} required /></Field>
        <Field label="Total de tickets" hint="Solo se pueden quitar números libres."><input className="input" type="number" min="1" max="9999" value={f.total_tickets} onChange={set('total_tickets')} required /></Field>
        <Field label="Máximo por pedido"><input className="input" type="number" min="1" max="100" value={f.max_por_pedido} onChange={set('max_por_pedido')} required /></Field>
        <Field label="Minutos de reserva"><input className="input" type="number" min="5" max="120" value={f.minutos_reserva} onChange={set('minutos_reserva')} required /></Field>
        <Field label="Número Yape / Plin"><input className="input" inputMode="tel" value={f.numero_pago} onChange={set('numero_pago')} required /></Field>
        <Field label="Titular del Yape (opcional)"><input className="input" value={f.titular_pago || ''} onChange={set('titular_pago')} placeholder="Ej. Gustavo P." /></Field>
        <Field label="WhatsApp de contacto"><input className="input" inputMode="tel" value={f.whatsapp} onChange={set('whatsapp')} /></Field>
        <Field label="Instagram"><input className="input" value={f.instagram} onChange={set('instagram')} /></Field>
      </div>

      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-900 dark:text-white">Premios</p>
          <button type="button" onClick={() => setF(p => ({ ...p, premios: [...p.premios, { nombre: '', cantidad: 1, valor: '' }] }))}
            className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Agregar</button>
        </div>
        {f.premios.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_64px_96px_36px] gap-2 items-center">
            <input className="input" placeholder="Premio" value={p.nombre} onChange={e => setPremio(i, 'nombre', e.target.value)} aria-label="Nombre del premio" />
            <input className="input" type="number" min="1" value={p.cantidad} onChange={e => setPremio(i, 'cantidad', e.target.value)} aria-label="Cantidad" title="Cantidad" />
            <input className="input" type="number" min="0" step="1" placeholder="Valor S/" value={p.valor ?? ''} onChange={e => setPremio(i, 'valor', e.target.value)} aria-label="Valor en soles" />
            <button type="button" onClick={() => setF(prev => ({ ...prev, premios: prev.premios.filter((_, j) => j !== i) }))}
              className="p-2 text-gray-400 hover:text-red-600" aria-label="Quitar premio"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        <p className="text-[11px] text-gray-500">Nombre · cantidad · valor en soles (se muestra en la página si lo llenas).</p>
      </div>

      <div className="card">
        <Field label="Términos y condiciones">
          <textarea className="input min-h-[140px]" value={f.terminos || ''} onChange={set('terminos')} />
        </Field>
      </div>

      <button type="submit" disabled={busy} className="btn-primary flex items-center gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar configuración
      </button>

      <Reiniciar />
    </form>
  )
}

// Para dejar el sorteo en cero después de hacer pruebas.
function Reiniciar() {
  const [busy, setBusy] = useState(false)

  async function reiniciar() {
    const txt = window.prompt(
      'Esto BORRA todos los pedidos, ventas y comprobantes, y deja los números libres. No se puede deshacer.\n\nEscribe REINICIAR para confirmar:'
    )
    if (txt === null) return
    if (txt.trim().toUpperCase() !== 'REINICIAR') { toast.error('No se reinició: escribe REINICIAR'); return }
    setBusy(true)
    try {
      const n = await resetRaffle()
      toast.success(`Sorteo reiniciado (${n} pedido${n !== 1 ? 's' : ''} borrado${n !== 1 ? 's' : ''})`)
    } catch (err) {
      toast.error(err.message)
    } finally { setBusy(false) }
  }

  return (
    <div className="card border-red-200 dark:border-red-900/50 mt-6">
      <p className="font-semibold text-red-600 dark:text-red-400">Reiniciar sorteo</p>
      <p className="text-xs text-gray-500 mt-1">
        Borra todos los pedidos, ventas y comprobantes y deja todos los números disponibles. Úsalo para limpiar las pruebas antes de lanzar el sorteo.
        La configuración y los premios no se tocan.
      </p>
      <button type="button" onClick={reiniciar} disabled={busy} className="btn-danger mt-3 flex items-center gap-2 text-sm">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Reiniciar sorteo
      </button>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-gray-500 mt-1 block">{hint}</span>}
    </label>
  )
}
