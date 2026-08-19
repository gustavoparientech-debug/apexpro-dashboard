import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  Search, Gift, KeyRound, Link2, MessageCircle, Pencil, Check, X as XIcon,
  Plus, Trash2, Loader2, Sparkles, Users,
} from 'lucide-react'
import {
  loadConfig, saveConfig, redeemTier, cardState, cycleSize, sortedNiveles,
  normPlate, formatPlate, DEFAULT_CONFIG, REDEEM_ERRORS,
} from '../lib/fidelidad'

// Panel de fidelización: la contraparte interna de /fidelidad.
// Aquí el dueño ve la tarjeta de cada placa, entrega los premios, reparte el
// PIN al cliente y configura niveles y promociones sin tocar código.

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

const FILTROS = ['Todos', 'Con premio', 'Activados', 'Sin activar']

export default function Clientes() {
  const [tab, setTab] = useState('clientes')

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Fidelización</h1>
        <p className="text-sm text-gray-500">Tarjeta de sellos por placa, premios y promociones</p>
      </div>

      <div className="flex gap-2">
        {[['clientes', 'Clientes'], ['programa', 'Programa']].map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === v ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'clientes' ? <ListaClientes /> : <ConfigPrograma />}
    </div>
  )
}

// ─── Clientes ───────────────────────────────────────────────────────────────

function ListaClientes() {
  const { isAdmin } = useAuth()
  const [config,  setConfig]  = useState(DEFAULT_CONFIG)
  const [rows,    setRows]    = useState([])   // { plate, plate_norm, name, phone, pin, stamps_used, cycle_index, visitas, ultima }
  const [canjes,  setCanjes]  = useState([])   // loyalty_redemptions
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [filtro,  setFiltro]  = useState('Todos')
  const [abierto, setAbierto] = useState(null)

  async function cargar() {
    setLoading(true)
    try {
      const cfg = await loadConfig()
      setConfig(cfg)
      if (IS_DEMO) { setRows([]); setCanjes([]); return }

      const [t, vc, lr] = await Promise.all([
        supabase.from('tickets').select('plate, date, status').neq('status', 'abierto'),
        supabase.from('vehicle_clients').select('*'),
        supabase.from('loyalty_redemptions').select('*').order('redeemed_at', { ascending: false }),
      ])

      // Las visitas salen de los tickets; la ficha del cliente (nombre, PIN,
      // sellos ya consumidos) vive en vehicle_clients. Se cruzan por placa
      // normalizada porque en los tickets la placa se escribe de varias formas.
      const visitas = {}
      ;(t.data || []).forEach(x => {
        const k = normPlate(x.plate)
        if (k.length < 4) return
        if (!visitas[k]) visitas[k] = { plate: x.plate, visitas: 0, ultima: '' }
        visitas[k].visitas++
        if (x.date > visitas[k].ultima) visitas[k].ultima = x.date
      })

      const fichas = {}
      ;(vc.data || []).forEach(c => { fichas[c.plate_norm || normPlate(c.plate)] = c })

      const merged = Object.entries(visitas).map(([k, v]) => {
        const f = fichas[k] || {}
        return {
          plate_norm: k,
          plate:      f.plate || v.plate,
          name:       f.name  || '',
          phone:      f.phone || '',
          pin:        f.pin   || '',
          stamps_used: f.stamps_used || 0,
          cycle_index: f.cycle_index || 0,
          visitas:     v.visitas,
          ultima:      v.ultima,
        }
      })
      // Fichas sin ninguna visita registrada (creadas a mano) también entran.
      Object.entries(fichas).forEach(([k, f]) => {
        if (visitas[k]) return
        merged.push({
          plate_norm: k, plate: f.plate, name: f.name || '', phone: f.phone || '', pin: f.pin || '',
          stamps_used: f.stamps_used || 0, cycle_index: f.cycle_index || 0, visitas: 0, ultima: '',
        })
      })

      merged.sort((a, b) => (b.ultima || '').localeCompare(a.ultima || ''))
      setRows(merged)
      setCanjes(lr.data || [])
    } catch (e) {
      toast.error('No se pudo cargar la lista de clientes')
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const conEstado = useMemo(() => rows.map(r => {
    const canjeados = canjes
      .filter(c => c.plate_norm === r.plate_norm && c.cycle_index === r.cycle_index)
      .map(c => c.tier_stamps)
    const st = cardState({ sellos: Math.max(0, r.visitas - r.stamps_used), canjeados }, config)
    return { ...r, st }
  }), [rows, canjes, config])

  const filtrados = useMemo(() => {
    let list = conEstado
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(r =>
      r.plate_norm.includes(normPlate(q)) ||
      r.name?.toLowerCase().includes(q) ||
      r.phone?.includes(q))
    if (filtro === 'Con premio')   list = list.filter(r => r.st.disponibles.length > 0)
    if (filtro === 'Activados')    list = list.filter(r => r.pin)
    if (filtro === 'Sin activar')  list = list.filter(r => !r.pin)
    return list
  }, [conEstado, search, filtro])

  const conPremio = conEstado.filter(r => r.st.disponibles.length > 0).length

  if (IS_DEMO) return (
    <div className="card text-center py-10 text-gray-400">
      <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
      <p className="text-sm">La fidelización necesita conexión a Supabase (no disponible en modo demo)</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-xs text-gray-500">Clientes con tarjeta</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{conEstado.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Con premio listo</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{conPremio}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar placa, nombre o teléfono..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FILTROS.map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filtro === f ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-sm text-gray-400 animate-pulse py-6">Cargando...</p>}

      <div className="space-y-2">
        {filtrados.map(r => (
          <FichaCliente key={r.plate_norm} r={r} isAdmin={isAdmin}
            abierto={abierto === r.plate_norm}
            onToggle={() => setAbierto(abierto === r.plate_norm ? null : r.plate_norm)}
            onCambio={cargar} />
        ))}
      </div>

      {!loading && filtrados.length === 0 && (
        <div className="card text-center py-10 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay clientes que coincidan</p>
        </div>
      )}
    </div>
  )
}

function FichaCliente({ r, isAdmin, abierto, onToggle, onCambio }) {
  const [edit,   setEdit]   = useState(false)
  const [form,   setForm]   = useState({ name: r.name, phone: r.phone })
  const [busy,   setBusy]   = useState(false)
  const st = r.st

  const link = `${window.location.origin}/fidelidad?placa=${encodeURIComponent(formatPlate(r.plate))}`

  async function guardar() {
    setBusy(true)
    const { error } = await supabase.from('vehicle_clients').upsert(
      { plate: r.plate, name: form.name || null, phone: form.phone || null, updated_at: new Date().toISOString() },
      { onConflict: 'plate' })
    setBusy(false)
    if (error) { toast.error('No se pudo guardar'); return }
    setEdit(false); toast.success('Guardado'); onCambio()
  }

  // El PIN lo puede crear el cliente desde la página pública, pero el local
  // necesita poder generarlo o resetearlo cuando el cliente lo olvida.
  async function generarPin() {
    const nuevo = String(Math.floor(1000 + Math.random() * 9000))
    setBusy(true)
    const { error } = await supabase.from('vehicle_clients').upsert(
      { plate: r.plate, pin: nuevo, updated_at: new Date().toISOString() }, { onConflict: 'plate' })
    setBusy(false)
    if (error) { toast.error('No se pudo generar el PIN'); return }
    toast.success(`PIN ${nuevo}`); onCambio()
  }

  async function canjear(tier) {
    setBusy(true)
    try {
      const res = await redeemTier(r.plate, tier)
      if (res?.status !== 'ok') { toast.error(REDEEM_ERRORS[res?.status] || 'No se pudo canjear'); return }
      toast.success('Premio entregado')
      onCambio()
    } catch { toast.error('No se pudo canjear') }
    finally { setBusy(false) }
  }

  function copiarLink() {
    navigator.clipboard.writeText(link).then(
      () => toast.success('Link copiado'),
      () => toast.error('No se pudo copiar'))
  }

  function whatsapp() {
    const texto = [
      `Hola${r.name ? ` ${r.name}` : ''}! Tu tarjeta Apex Pro de la placa ${formatPlate(r.plate)}:`,
      link,
      r.pin ? `PIN: ${r.pin}` : 'Al entrar crea tu PIN de 4 dígitos.',
      `Llevas ${st.enTarjeta} de ${st.ciclo} sellos.`,
    ].join('\n')
    const tel = (r.phone || '').replace(/\D/g, '')
    window.open(`https://wa.me/${tel ? (tel.length === 9 ? '51' + tel : tel) : ''}?text=${encodeURIComponent(texto)}`, '_blank')
  }

  return (
    <div className="card p-0 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div>
          <p className="font-bold text-gray-900 dark:text-white">{formatPlate(r.plate)}</p>
          <p className="text-xs text-gray-500">
            {r.name || 'Sin nombre'}
            {r.pin ? '' : ' · sin activar'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {st.disponibles.length > 0 && (
            <span className="text-[11px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
              🎁 {st.disponibles.map(t => `${t.pct}%`).join(' + ')}
            </span>
          )}
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{st.enTarjeta}/{st.ciclo}</span>
        </div>
      </button>

      {abierto && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-4 space-y-4">
          {/* Sellos */}
          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: st.ciclo }, (_, i) => {
              const n = i + 1
              const lleno = n <= st.enTarjeta
              const premio = st.tiers.find(t => t.sellos === n)
              return (
                <div key={n} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                  lleno ? 'bg-red-600 border-red-500 text-white'
                        : premio ? 'border-yellow-500/60 text-yellow-600 border-dashed'
                                 : 'border-gray-200 dark:border-gray-700 text-gray-400 border-dashed'
                }`}>
                  {lleno && premio ? <Gift className="w-3.5 h-3.5" /> : n}
                </div>
              )
            })}
          </div>

          <p className="text-xs text-gray-500">
            {r.visitas} visita{r.visitas !== 1 ? 's' : ''} en total
            {st.extra > 0 && ` · ${st.extra} para la próxima tarjeta`}
            {r.ultima && ` · última ${new Date(r.ultima + 'T12:00:00').toLocaleDateString('es-PE')}`}
          </p>

          {/* Canje */}
          {st.disponibles.length > 0 && isAdmin && (
            <div className="space-y-2">
              {st.disponibles.map(t => (
                <button key={t.sellos} disabled={busy} onClick={() => canjear(t.sellos)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-xl transition-colors">
                  <Gift className="w-4 h-4" /> Entregar {t.label || `${t.pct}% de descuento`}
                </button>
              ))}
            </div>
          )}

          {/* Datos */}
          {edit ? (
            <div className="flex gap-2">
              <input className="input text-sm" placeholder="Nombre" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <input className="input text-sm" placeholder="Teléfono" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              <button onClick={guardar} disabled={busy} className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                {busy ? <Loader2 className="w-4 h-4 animate-spin text-green-600" /> : <Check className="w-4 h-4 text-green-600" />}
              </button>
              <button onClick={() => setEdit(false)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <XIcon className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setEdit(true); setForm({ name: r.name, phone: r.phone }) }}
                className="btn-secondary text-sm flex items-center justify-center gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Datos
              </button>
              <button onClick={generarPin} disabled={busy}
                className="btn-secondary text-sm flex items-center justify-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" /> {r.pin ? `PIN ${r.pin}` : 'Generar PIN'}
              </button>
              <button onClick={copiarLink} className="btn-secondary text-sm flex items-center justify-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" /> Copiar link
              </button>
              <button onClick={whatsapp}
                className="text-sm flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 font-medium transition-colors">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Configuración del programa ─────────────────────────────────────────────

function ConfigPrograma() {
  const [cfg,     setCfg]     = useState(null)
  const [busy,    setBusy]    = useState(false)

  useEffect(() => { loadConfig().then(setCfg) }, [])

  if (!cfg) return <p className="text-center text-sm text-gray-400 animate-pulse py-6">Cargando...</p>

  const niveles = sortedNiveles(cfg)

  function setNivel(i, patch) {
    const next = [...niveles]
    next[i] = { ...next[i], ...patch }
    setCfg(c => ({ ...c, niveles: next }))
  }

  async function guardar() {
    const limpios = sortedNiveles({
      niveles: (cfg.niveles || [])
        .map(n => ({ sellos: Number(n.sellos) || 0, pct: Number(n.pct) || 0, label: n.label || `${Number(n.pct) || 0}% de descuento` }))
        .filter(n => n.sellos > 0),
    })
    if (!limpios.length) { toast.error('Deja al menos un nivel de premio'); return }
    setBusy(true)
    try {
      await saveConfig({ ...cfg, niveles: limpios })
      setCfg(c => ({ ...c, niveles: limpios }))
      toast.success('Programa actualizado')
    } catch { toast.error('No se pudo guardar') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <label className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Programa activo</span>
          <input type="checkbox" className="w-5 h-5 accent-red-600"
            checked={cfg.activo !== false}
            onChange={e => setCfg(c => ({ ...c, activo: e.target.checked }))} />
        </label>
        <div>
          <label className="label">Título en la página del cliente</label>
          <input className="input" value={cfg.titulo || ''} placeholder="Tarjeta Apex Pro"
            onChange={e => setCfg(c => ({ ...c, titulo: e.target.value }))} />
        </div>
        <p className="text-xs text-gray-500">
          La tarjeta se completa a los <span className="font-semibold">{cycleSize(cfg)} sellos</span> y
          se reinicia cuando entregas ese último premio.
        </p>
      </div>

      {/* Niveles */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Gift className="w-4 h-4 text-red-600" /> Premios por sello
          </h2>
          <button onClick={() => setCfg(c => ({ ...c, niveles: [...(c.niveles || []), { sellos: cycleSize(c) + 4, pct: 50, label: '' }] }))}
            className="text-xs flex items-center gap-1 text-red-600 font-medium">
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        </div>

        {niveles.map((n, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="w-20">
              <label className="text-[11px] text-gray-500 block mb-0.5">Sello</label>
              <input className="input text-sm" type="number" min="1" value={n.sellos}
                onChange={e => setNivel(i, { sellos: Number(e.target.value) })} />
            </div>
            <div className="w-20">
              <label className="text-[11px] text-gray-500 block mb-0.5">%</label>
              <input className="input text-sm" type="number" min="0" max="100" value={n.pct}
                onChange={e => setNivel(i, { pct: Number(e.target.value), label: `${Number(e.target.value)}% de descuento` })} />
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-gray-500 block mb-0.5">Cómo lo ve el cliente</label>
              <input className="input text-sm" value={n.label || ''} placeholder={`${n.pct}% de descuento`}
                onChange={e => setNivel(i, { label: e.target.value })} />
            </div>
            <button onClick={() => setCfg(c => ({ ...c, niveles: niveles.filter((_, j) => j !== i) }))}
              className="p-2 mb-0.5 text-gray-400 hover:text-red-600">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Promociones */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-red-600" /> Promociones
          </h2>
          <button onClick={() => setCfg(c => ({ ...c, promos: [...(c.promos || []), { id: crypto.randomUUID(), titulo: '', texto: '', vence: '', activa: true }] }))}
            className="text-xs flex items-center gap-1 text-red-600 font-medium">
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        </div>

        {(cfg.promos || []).length === 0 && (
          <p className="text-xs text-gray-400">Sin promociones. Las que agregues aparecen en la página del cliente.</p>
        )}

        {(cfg.promos || []).map((p, i) => {
          const setPromo = patch => setCfg(c => ({ ...c, promos: c.promos.map((x, j) => j === i ? { ...x, ...patch } : x) }))
          return (
            <div key={p.id || i} className="border border-gray-100 dark:border-gray-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input className="input text-sm" placeholder="Título (ej. Martes de cerámico)"
                  value={p.titulo} onChange={e => setPromo({ titulo: e.target.value })} />
                <button onClick={() => setCfg(c => ({ ...c, promos: c.promos.filter((_, j) => j !== i) }))}
                  className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
              <textarea className="input text-sm" rows={2} placeholder="Detalle de la promoción"
                value={p.texto} onChange={e => setPromo({ texto: e.target.value })} />
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-[11px] text-gray-500 block mb-0.5">Vence (opcional)</label>
                  <input type="date" className="input text-sm" value={p.vence || ''}
                    onChange={e => setPromo({ vence: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 pt-4">
                  <input type="checkbox" className="w-4 h-4 accent-red-600"
                    checked={p.activa !== false} onChange={e => setPromo({ activa: e.target.checked })} />
                  Visible
                </label>
              </div>
            </div>
          )
        })}
      </div>

      <button onClick={guardar} disabled={busy}
        className="w-full btn-primary flex items-center justify-center gap-2 py-3">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Guardar programa
      </button>

      <div className="card">
        <p className="text-xs text-gray-500 leading-relaxed">
          Link para los clientes: <span className="font-mono text-gray-700 dark:text-gray-300">{window.location.origin}/fidelidad</span>
          <br />Cada cliente entra con su placa y un PIN de 4 dígitos. Los sellos se cuentan solos con cada ticket cerrado.
        </p>
      </div>
    </div>
  )
}
