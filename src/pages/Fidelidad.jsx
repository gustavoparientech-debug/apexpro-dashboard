import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LogoOscuro } from '../components/ui/Logo'
import { Loader2, Lock, Gift, Check, Sparkles, ArrowLeft } from 'lucide-react'
import {
  fetchCard, activateCard, fetchPublicConfig,
  cardState, formatPlate, normPlate, DEFAULT_CONFIG,
} from '../lib/fidelidad'

// Página pública de fidelización (sin login). El cliente entra con su placa y
// un PIN de 4 dígitos y ve su tarjeta de sellos. Siempre en oscuro: es la cara
// de la marca hacia el cliente, no una pantalla más del panel interno.
//
// Solo muestra sellos, premios y promos. Precios, historial de gastos y datos
// de otras placas nunca salen de aquí (ver funciones loyalty_* en Supabase).

const LAST_PLATE_KEY = 'apexpro_fidelidad_placa'

export default function Fidelidad() {
  const [params]  = useSearchParams()
  const [plate,   setPlate]   = useState(() => formatPlate(params.get('placa') || localStorage.getItem(LAST_PLATE_KEY) || ''))
  const [pin,     setPin]     = useState('')
  const [card,    setCard]    = useState(null)
  const [config,  setConfig]  = useState(DEFAULT_CONFIG)
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState('')
  const [step,    setStep]    = useState('login') // 'login' | 'activar' | 'tarjeta'
  const [nombre,  setNombre]  = useState('')
  const [tel,     setTel]     = useState('')
  const [pin2,    setPin2]    = useState('')

  useEffect(() => { fetchPublicConfig().then(setConfig).catch(() => {}) }, [])

  async function consultar(e) {
    e?.preventDefault()
    setError('')
    if (normPlate(plate).length < 4) { setError('Escribe tu placa completa'); return }
    if (!/^\d{4}$/.test(pin))        { setError('El PIN son 4 dígitos');      return }
    setBusy(true)
    try {
      const res = await fetchCard(plate, pin)
      handleResult(res)
    } catch {
      setError('No pudimos conectar. Revisa tu internet e intenta de nuevo.')
    } finally { setBusy(false) }
  }

  // Primera vez: la placa ya tiene visitas pero nadie creó el PIN todavía.
  async function activar(e) {
    e?.preventDefault()
    setError('')
    if (!/^\d{4}$/.test(pin))  { setError('El PIN son 4 dígitos');    return }
    if (pin !== pin2)          { setError('Los PIN no coinciden');    return }
    setBusy(true)
    try {
      handleResult(await activateCard({ plate, pin, name: nombre, phone: tel }))
    } catch {
      setError('No pudimos activar la tarjeta. Intenta de nuevo.')
    } finally { setBusy(false) }
  }

  function handleResult(res) {
    if (res?.status === 'ok') {
      localStorage.setItem(LAST_PLATE_KEY, res.plate || plate)
      setCard(res); setStep('tarjeta'); setPin(''); setPin2('')
      return
    }
    if (res?.status === 'sin_pin') {
      setPlate(res.plate || plate); setNombre(res.nombre || '')
      setStep('activar'); setPin(''); setPin2('')
      setError('')
      return
    }
    setError({
      pin_incorrecto: 'PIN incorrecto. Si lo olvidaste, pídelo en el local.',
      no_encontrada:  'Esa placa todavía no tiene visitas registradas.',
      placa_invalida: 'Escribe tu placa completa.',
      ya_activada:    'Esa tarjeta ya tiene PIN. Ingresa con él.',
      pin_invalido:   'El PIN son 4 dígitos.',
    }[res?.status] || 'No pudimos mostrar tu tarjeta.')
  }

  function salir() {
    setCard(null); setPin(''); setPin2(''); setError(''); setStep('login')
  }

  return (
    <div className="min-h-screen bg-[#111] text-white flex flex-col items-center px-4 py-8">
      <LogoOscuro className="h-12 mb-6" />

      <div className="w-full max-w-sm">
        {step === 'tarjeta' && card
          ? <Tarjeta card={card} config={config} onSalir={salir} />
          : (
            <div className="bg-[#1b1b1b] border border-white/10 rounded-2xl p-6 shadow-xl">
              <h1 className="text-lg font-bold text-center">
                {step === 'activar' ? 'Activa tu tarjeta' : (config.titulo || 'Tarjeta de fidelidad')}
              </h1>
              <p className="text-center text-sm text-gray-400 mt-1 mb-5">
                {step === 'activar'
                  ? 'Crea un PIN de 4 dígitos para consultar tus sellos cuando quieras.'
                  : 'Consulta tus sellos y descuentos con tu placa.'}
              </p>

              {step === 'activar' ? (
                <form onSubmit={activar} className="space-y-3">
                  <Campo label="Placa">
                    <div className="input-dark font-bold tracking-widest text-center">{formatPlate(plate)}</div>
                  </Campo>
                  <Campo label="Tu nombre (opcional)">
                    <input className="input-dark" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Cómo te llamamos" />
                  </Campo>
                  <Campo label="Celular (opcional)">
                    <input className="input-dark" inputMode="tel" value={tel} onChange={e => setTel(e.target.value)} placeholder="Para avisarte de promos" />
                  </Campo>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="PIN"><PinInput value={pin} onChange={setPin} /></Campo>
                    <Campo label="Repite el PIN"><PinInput value={pin2} onChange={setPin2} /></Campo>
                  </div>
                  {error && <Error>{error}</Error>}
                  <Boton busy={busy}>Activar mi tarjeta</Boton>
                  <button type="button" onClick={salir} className="w-full text-xs text-gray-500 hover:text-gray-300 flex items-center justify-center gap-1">
                    <ArrowLeft className="w-3 h-3" /> Volver
                  </button>
                </form>
              ) : (
                <form onSubmit={consultar} className="space-y-3">
                  <Campo label="Placa">
                    <input
                      className="input-dark uppercase tracking-widest font-bold text-center"
                      value={plate} onChange={e => setPlate(e.target.value.toUpperCase())}
                      placeholder="ABC-123" autoComplete="off" />
                  </Campo>
                  <Campo label="PIN de 4 dígitos"><PinInput value={pin} onChange={setPin} /></Campo>
                  {error && <Error>{error}</Error>}
                  <Boton busy={busy}>Ver mi tarjeta</Boton>
                  <p className="text-[11px] text-gray-500 text-center leading-relaxed pt-1">
                    ¿Primera vez? Ingresa tu placa y un PIN nuevo: si ya nos visitaste, te llevamos a activarla.
                  </p>
                </form>
              )}
            </div>
          )}

        <Promos promos={config.promos} />
      </div>

      <p className="text-[11px] text-gray-600 mt-8 text-center">Apex Pro Detailing</p>

      <style>{`
        .input-dark {
          width: 100%; background: #232323; border: 1px solid rgba(255,255,255,.12);
          border-radius: .6rem; padding: .6rem .75rem; font-size: .95rem; color: #fff; outline: none;
        }
        .input-dark:focus { border-color: #dc2626; box-shadow: 0 0 0 2px rgba(220,38,38,.25); }
        .input-dark::placeholder { color: #6b7280; }
      `}</style>
    </div>
  )
}

// ─── Tarjeta de sellos ──────────────────────────────────────────────────────

function Tarjeta({ card, config, onSalir }) {
  const st = cardState(card, card.config || config)

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-b from-[#241010] to-[#1b1b1b] border border-red-900/40 rounded-2xl p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-black tracking-widest">{formatPlate(card.plate)}</p>
            {card.nombre && <p className="text-sm text-gray-400">{card.nombre}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-red-500">{st.enTarjeta}<span className="text-gray-500 text-lg">/{st.ciclo}</span></p>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider">sellos</p>
          </div>
        </div>

        <Sellos st={st} />

        <p className="text-sm text-center mt-5">
          {st.siguiente
            ? <>Te falta{st.faltan !== 1 ? 'n' : ''} <span className="font-bold text-white">{st.faltan} lavado{st.faltan !== 1 ? 's' : ''}</span> para tu {st.siguiente.label || `${st.siguiente.pct}% de descuento`}</>
            : <span className="text-gray-400">¡Tarjeta completa! Canjea tu premio en el local.</span>}
        </p>
        {st.extra > 0 && (
          <p className="text-[11px] text-gray-500 text-center mt-1">
            +{st.extra} lavado{st.extra !== 1 ? 's' : ''} ya cuentan para tu próxima tarjeta
          </p>
        )}
      </div>

      {st.disponibles.length > 0 && (
        <div className="bg-green-950/40 border border-green-800/50 rounded-2xl p-5 text-center">
          <Gift className="w-7 h-7 mx-auto text-green-400 mb-2" />
          <p className="font-bold text-green-300">
            {st.disponibles.map(t => t.label || `${t.pct}% de descuento`).join(' + ')}
          </p>
          <p className="text-xs text-green-500/90 mt-1">Muestra esta pantalla en caja para canjearlo</p>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500 px-1">
        <span>{card.visitas_totales} visita{card.visitas_totales !== 1 ? 's' : ''} en total</span>
        {card.ultima_visita && <span>Última: {new Date(card.ultima_visita + 'T12:00:00').toLocaleDateString('es-PE')}</span>}
      </div>

      <button onClick={onSalir} className="w-full py-2.5 text-sm text-gray-400 hover:text-white border border-white/10 rounded-xl transition-colors">
        Consultar otra placa
      </button>
    </div>
  )
}

function Sellos({ st }) {
  const premios = new Map(st.tiers.map(t => [t.sellos, t]))
  return (
    <div className="grid grid-cols-4 gap-2.5 mt-5">
      {Array.from({ length: st.ciclo }, (_, i) => {
        const n      = i + 1
        const lleno  = n <= st.enTarjeta
        const premio = premios.get(n)
        return (
          <div key={n} className="flex flex-col items-center gap-1">
            <div className={[
              'w-full aspect-square rounded-full flex items-center justify-center border-2 transition-colors',
              lleno   ? 'bg-red-600 border-red-500 text-white'
                      : 'border-dashed border-white/15 text-gray-600',
              premio && !lleno ? 'border-yellow-600/50' : '',
            ].join(' ')}>
              {lleno
                ? (premio ? <Gift className="w-5 h-5" /> : <Check className="w-5 h-5" />)
                : <span className="text-sm font-bold">{n}</span>}
            </div>
            {premio && (
              <span className={`text-[10px] font-semibold ${premio.canjeado ? 'text-gray-600 line-through' : lleno ? 'text-green-400' : 'text-yellow-600/80'}`}>
                {premio.pct}%
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Promos({ promos }) {
  if (!promos?.length) return null
  return (
    <div className="mt-4 space-y-2">
      <p className="text-[11px] uppercase tracking-wider text-gray-500 flex items-center gap-1.5 px-1">
        <Sparkles className="w-3 h-3" /> Promociones
      </p>
      {promos.map((p, i) => (
        <div key={p.id || i} className="bg-[#1b1b1b] border border-white/10 rounded-xl p-4">
          <p className="font-semibold text-sm">{p.titulo}</p>
          {p.texto && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{p.texto}</p>}
          {p.vence && <p className="text-[11px] text-gray-600 mt-1.5">Hasta el {new Date(p.vence + 'T12:00:00').toLocaleDateString('es-PE')}</p>}
        </div>
      ))}
    </div>
  )
}

// ─── Piezas de formulario ───────────────────────────────────────────────────

function Campo({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-400 mb-1 block">{label}</span>
      {children}
    </label>
  )
}

function PinInput({ value, onChange }) {
  return (
    <input
      className="input-dark tracking-[0.4em] text-center font-bold"
      inputMode="numeric" maxLength={4} placeholder="••••" autoComplete="off"
      value={value} onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))} />
  )
}

function Error({ children }) {
  return <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2">{children}</p>
}

function Boton({ busy, children }) {
  return (
    <button type="submit" disabled={busy}
      className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
      {children}
    </button>
  )
}
