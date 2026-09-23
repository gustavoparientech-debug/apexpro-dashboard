import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { precioBase } from '../../lib/catalogoPresupuesto'
import { costoTotal, saveCostos, DEFAULT_ECON, DEFAULT_PRECIO_DE } from '../../lib/metas'
import { formatMoney } from '../../lib/utils'
import { Save, Search } from 'lucide-react'
import toast from 'react-hot-toast'

const CAMPOS = [
  { key: 'material', label: 'Material' },
  { key: 'manoObra', label: 'Mano obra' },
  { key: 'otros',    label: 'Otros' },
]

// Costo total de la planilla de referencia (precio − margen), para los
// servicios que ya estaban en el plan mensual en Excel.
const COSTO_REF = Object.fromEntries(
  Object.entries(DEFAULT_PRECIO_DE)
    .filter(([id]) => DEFAULT_ECON[id])
    .map(([id, precioDe]) => [precioDe, DEFAULT_ECON[id].price - DEFAULT_ECON[id].margin])
)

function colorPct(pct) {
  if (pct == null) return 'text-gray-300 dark:text-gray-600'
  if (pct >= 50) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 25) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export default function MargenesServicios() {
  const { metasCatalogo, setCostosServicios, isDemo } = useApp()
  const grupos = metasCatalogo?.grupos || []
  const guardados = metasCatalogo?.costos

  const [draft, setDraft]   = useState(() => guardados || {})
  const [dirty, setDirty]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [busca, setBusca]   = useState('')

  // Lo guardado desde otro dispositivo entra solo si no hay cambios a medias.
  useEffect(() => { if (!dirty) setDraft(guardados || {}) }, [guardados])

  function set(id, campo, valor) {
    setDraft(d => ({ ...d, [id]: { ...(d[id] || {}), [campo]: valor === '' ? '' : Number(valor) } }))
    setDirty(true)
  }

  async function guardar() {
    setSaving(true)
    try {
      // Filas vacías fuera: sin costo, la meta sigue con su margen escrito a mano.
      const limpio = Object.fromEntries(Object.entries(draft).filter(([, e]) => costoTotal(e) != null))
      if (!isDemo) await saveCostos(limpio)
      setCostosServicios(limpio)
      setDraft(limpio)
      setDirty(false)
      toast.success('Márgenes guardados ✓')
    } catch (err) {
      toast.error('Error al guardar: ' + (err.message || ''))
    } finally { setSaving(false) }
  }

  const q = busca.trim().toLowerCase()
  const visibles = useMemo(() => grupos
    .map(g => ({ ...g, opciones: g.opciones.filter(o => !q || o.label.toLowerCase().includes(q)) }))
    .filter(g => g.opciones.length), [grupos, q])

  const conCosto = grupos.flatMap(g => g.opciones).filter(o => costoTotal(draft[o.id]) != null).length
  const total    = grupos.reduce((s, g) => s + g.opciones.length, 0)

  const inputCls = 'w-full text-right text-sm tabular-nums bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-red-500'

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Márgenes por servicio</p>
            <p className="text-xs text-gray-400 mt-0.5">
              El precio viene de Presupuesto. Escribe el costo de una unidad y el margen se calcula solo.
              Las metas de ese servicio usan este margen.
            </p>
          </div>
          <button className="btn-primary flex items-center gap-1.5 text-sm py-2 px-3 flex-none" onClick={guardar} disabled={saving || !dirty}>
            <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar servicio…"
              className="flex-1 bg-transparent text-sm outline-none text-gray-800 dark:text-gray-100" />
          </div>
          <span className="text-[11px] text-gray-400 whitespace-nowrap">{conCosto} de {total} con costo</span>
        </div>
        {dirty && <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">● Cambios sin guardar</p>}
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800">
        {visibles.map(g => (
          <div key={g.id}>
            <div className="flex items-center justify-between bg-gray-900 dark:bg-black px-4 py-1.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white">{g.emoji} {g.label}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Margen</p>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {g.opciones.map(o => {
                const e      = draft[o.id] || {}
                const precio = precioBase(o)
                const costo  = costoTotal(e)
                const margen = costo == null ? null : precio - costo
                const pct    = costo == null || precio <= 0 ? null : Math.round((margen / precio) * 100)
                const ref    = costo == null ? COSTO_REF[o.precioDe] : null
                return (
                  <div key={o.id} className="px-4 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 leading-tight">{o.label}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                          Precio {formatMoney(precio)}{o.source === 'panos' ? ' por paño' : ''}
                          {costo != null && <> · costo {formatMoney(costo)}</>}
                          {ref != null && <> · Excel: costo {formatMoney(ref)}</>}
                        </p>
                      </div>
                      <div className="text-right flex-none">
                        <p className={`text-sm font-black tabular-nums leading-tight ${margen != null && margen < 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                          {margen == null ? '—' : formatMoney(margen)}
                        </p>
                        <p className={`text-[11px] font-black tabular-nums ${colorPct(pct)}`}>{pct == null ? 'sin costo' : `${pct}%`}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {CAMPOS.map(c => (
                        <label key={c.key} className="block">
                          <span className="block text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">{c.label}</span>
                          <input type="number" min="0" step="1" inputMode="decimal" className={inputCls}
                            value={e[c.key] ?? ''} placeholder="0"
                            onChange={ev => set(o.id, c.key, ev.target.value)} />
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {!visibles.length && <p className="text-xs text-gray-400 text-center py-6">No hay servicios con ese nombre</p>}
      </div>

      <p className="px-4 py-3 text-[11px] text-gray-400 leading-relaxed">
        <strong>Costo</strong> = material + mano de obra + otros, por unidad. <strong>Margen</strong> = precio − costo.
        El precio es el de Auto (o la cobertura, en polarizados); si en Presupuesto sube el precio, el margen sube igual.
        Un servicio sin costo sigue con el margen escrito a mano en Configurar.
      </p>
    </div>
  )
}
