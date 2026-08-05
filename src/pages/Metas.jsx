import { useEffect, useMemo, useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import {
  currentMonthYear, monthName, todayISO,
  getWorkingDaysInMonth, getWorkingDaysElapsed, getWorkingDaysRemaining,
} from '../lib/utils'
import {
  GRUPOS, monthPrefix, resolveItems, computeProgress, estadoMeta,
  fetchMetasConfig, fetchMetasRows, rowsFromTickets, METAS_KEY,
} from '../lib/metas'
import { Target, RefreshCw, CalendarDays, Flame, TrendingUp } from 'lucide-react'

// Semáforo contra el ritmo del mes, no contra el 100%: al día 5 nadie va al 80%.
const ESTADO = {
  logrado:  { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', chip: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', ring: 'stroke-emerald-500', label: 'Lograda 🎉' },
  ritmo:    { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', chip: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', ring: 'stroke-emerald-500', label: 'En ritmo' },
  cerca:    { bar: 'bg-amber-400',   text: 'text-amber-600 dark:text-amber-400',     chip: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',       ring: 'stroke-amber-400',   label: 'Casi en ritmo' },
  atrasado: { bar: 'bg-red-500',     text: 'text-red-600 dark:text-red-400',         chip: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',               ring: 'stroke-red-500',     label: 'Atrasada' },
  sinmeta:  { bar: 'bg-gray-300',    text: 'text-gray-400',                          chip: 'bg-gray-100 dark:bg-gray-800 text-gray-500',                                 ring: 'stroke-gray-400',    label: 'Sin meta' },
}

function Ring({ pct, size = 116, stroke = 11, className = 'stroke-white' }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90 flex-none">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-white/15" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
        className={className}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - Math.min(100, Math.max(0, pct)) / 100)}
        style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.23,1,0.32,1)' }}
      />
    </svg>
  )
}

function MetaRow({ item, expectedPct, diasRestantes }) {
  const sinMeta = !item.goal
  const estado  = sinMeta ? 'sinmeta' : estadoMeta(item.pct, expectedPct)
  const C = ESTADO[estado]
  const porDia = item.faltan > 0
    ? (diasRestantes > 0 ? item.faltan / diasRestantes : item.faltan)
    : 0

  return (
    <div className="px-3.5 py-3 first:pt-3.5 last:pb-3.5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-lg flex-none">
          {item.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">{item.label}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {sinMeta
              ? `${item.done} realizado${item.done === 1 ? '' : 's'} · sin meta este mes`
              : item.faltan === 0
              ? '¡Meta cumplida!'
              : porDia >= 1
              ? `Faltan ${item.faltan} · ${Math.ceil(porDia)} por día`
              : `Faltan ${item.faltan} · quedan ${diasRestantes} días`}
            {item.hoy > 0 && <span className="text-emerald-500 font-bold"> · +{item.hoy} hoy</span>}
          </p>
        </div>
        <div className="text-right flex-none">
          <p className="text-lg font-black text-gray-900 dark:text-white leading-none tabular-nums">
            {item.done}
            <span className="text-sm text-gray-400 font-bold">/{item.goal || '—'}</span>
          </p>
          <p className={`text-[11px] font-bold mt-0.5 ${C.text}`}>{sinMeta ? '—' : `${item.pct}%`}</p>
        </div>
      </div>

      {/* Barra con marca del ritmo esperado */}
      <div className="relative mt-2 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${C.bar}`}
          style={{ width: `${Math.min(100, item.pct)}%`, transition: 'width 800ms cubic-bezier(0.23,1,0.32,1)' }}
        />
        {!sinMeta && expectedPct > 2 && expectedPct < 99 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gray-400/70 dark:bg-gray-500"
            style={{ left: `${expectedPct}%` }}
            title="Ritmo esperado para hoy"
          />
        )}
      </div>
    </div>
  )
}

function GrupoCard({ grupo, items, expectedPct, diasRestantes }) {
  if (!items.length) return null
  const meta = items.reduce((s, i) => s + i.goal, 0)
  const hecho = items.reduce((s, i) => s + Math.min(i.done, i.goal || i.done), 0)
  const pct = meta > 0 ? Math.round((hecho / meta) * 100) : 0

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
        <span className="text-base">{grupo.emoji}</span>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 flex-1">{grupo.label}</p>
        <span className="text-xs font-black text-gray-700 dark:text-gray-200 tabular-nums">{hecho}/{meta}</span>
        <span className="text-[11px] font-bold text-gray-400">{pct}%</span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {items.map(item => (
          <MetaRow key={item.id} item={item} expectedPct={expectedPct} diasRestantes={diasRestantes} />
        ))}
      </div>
    </div>
  )
}

export default function Metas() {
  const { tickets, isDemo } = useApp()
  const { month, year } = currentMonthYear()
  const prefix = monthPrefix(year, month)
  const today  = todayISO()

  const [config, setConfig]   = useState(null)
  const [rows, setRows]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const cargar = useCallback(async () => {
    const cfg = await fetchMetasConfig()
    setConfig(cfg)
    if (isDemo) { setRows(rowsFromTickets(tickets, prefix)); return }
    try {
      setRows(await fetchMetasRows(prefix))
    } catch {
      // Si la función aún no está desplegada, se usa lo que el contexto tenga.
      setRows(rowsFromTickets(tickets, prefix))
    }
  }, [prefix, isDemo, tickets])

  // `tickets.length` entra en las dependencias porque el contexto todavía puede
  // estar cargando en el primer render, y porque un ticket nuevo debe reflejarse
  // en el avance sin recargar la página.
  useEffect(() => {
    let vivo = true
    cargar().finally(() => { if (vivo) setLoading(false) })
    return () => { vivo = false }
  }, [prefix, tickets.length])

  // El admin puede cambiar las metas desde Configuración mientras el trabajador
  // tiene la página abierta.
  useEffect(() => {
    const ch = supabase
      .channel('metas-config')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: `key=eq.${METAS_KEY}` },
        () => { fetchMetasConfig().then(setConfig) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // Al volver a la app (o cada 2 min con la pestaña visible) se refresca el
  // avance: los tickets de los compañeros no llegan por realtime al trabajador.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') cargar() }
    document.addEventListener('visibilitychange', onVisible)
    const id = setInterval(onVisible, 120000)
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(id) }
  }, [cargar])

  async function handleRefresh() {
    setRefreshing(true)
    await cargar()
    setRefreshing(false)
  }

  const diasTotal     = getWorkingDaysInMonth(year, month)
  const diasElapsed   = getWorkingDaysElapsed(year, month)
  const diasRestantes = getWorkingDaysRemaining(year, month)
  const expectedPct   = diasTotal > 0 ? Math.round((diasElapsed / diasTotal) * 100) : 0

  const progreso = useMemo(
    () => computeProgress(resolveItems(config, prefix), rows || [], today),
    [config, rows, prefix, today]
  )

  const total = useMemo(() => {
    const meta  = progreso.reduce((s, i) => s + i.goal, 0)
    // El avance global cuenta cada meta hasta su tope: 300 lavados no compensan
    // un cerámico que no se hizo.
    const hecho = progreso.reduce((s, i) => s + Math.min(i.done, i.goal), 0)
    const hoy   = progreso.reduce((s, i) => s + i.hoy, 0)
    const pct   = meta > 0 ? Math.round((hecho / meta) * 100) : 0
    return { meta, hecho, hoy, pct, faltan: Math.max(0, meta - hecho) }
  }, [progreso])

  const estadoGlobal = ESTADO[total.meta ? estadoMeta(total.pct, expectedPct) : 'sinmeta']
  const ritmoDia = total.faltan > 0 && diasRestantes > 0 ? total.faltan / diasRestantes : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-4">

      {/* Resumen del mes */}
      <div className="rounded-2xl bg-[#1e1e1e] p-5 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-1.5 text-gray-400">
              <Target className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold uppercase tracking-widest">Metas del mes</span>
            </div>
            <h1 className="text-white font-black text-2xl capitalize mt-0.5">{monthName(month)} {year}</h1>
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white text-xs font-semibold">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        <div className="flex items-center gap-5">
          <div className="relative flex-none">
            <Ring pct={total.pct} className={estadoGlobal.ring} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-white text-3xl font-black leading-none">{total.pct}%</span>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">avance</span>
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="bg-white/10 rounded-xl px-3 py-2.5">
              <p className="text-white text-xl font-black leading-none tabular-nums">
                {total.hecho}<span className="text-gray-400 text-sm font-bold"> / {total.meta}</span>
              </p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-1">Servicios de la meta</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/10 rounded-xl px-3 py-2">
                <p className="text-white text-base font-black leading-none">{total.faltan}</p>
                <p className="text-[10px] text-gray-400 mt-1">Faltan</p>
              </div>
              <div className="bg-white/10 rounded-xl px-3 py-2">
                <p className="text-white text-base font-black leading-none">{diasRestantes}</p>
                <p className="text-[10px] text-gray-400 mt-1">Días hábiles</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${estadoGlobal.chip}`}>
            {estadoGlobal.label}
          </span>
          <span className="text-[11px] text-gray-400">
            Ritmo esperado para hoy: <span className="text-gray-200 font-semibold">{expectedPct}%</span>
          </span>
        </div>
      </div>

      {/* Tres números del día */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="card text-center py-3.5 px-2">
          <Flame className="w-4 h-4 text-red-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">{total.hoy}</p>
          <p className="text-[10px] text-gray-500 mt-1.5 leading-tight">Servicios hoy</p>
        </div>
        <div className="card text-center py-3.5 px-2">
          <TrendingUp className="w-4 h-4 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">
            {ritmoDia > 0 ? Math.ceil(ritmoDia) : 0}
          </p>
          <p className="text-[10px] text-gray-500 mt-1.5 leading-tight">Meta diaria</p>
        </div>
        <div className="card text-center py-3.5 px-2">
          <CalendarDays className="w-4 h-4 text-gray-400 mx-auto mb-1" />
          <p className="text-2xl font-black text-gray-900 dark:text-white leading-none">{diasElapsed}<span className="text-sm text-gray-400">/{diasTotal}</span></p>
          <p className="text-[10px] text-gray-500 mt-1.5 leading-tight">Días del mes</p>
        </div>
      </div>

      {/* Metas por grupo */}
      {GRUPOS.map(g => (
        <GrupoCard key={g.id} grupo={g}
          items={progreso.filter(i => (i.group || 'detailing') === g.id)}
          expectedPct={expectedPct} diasRestantes={diasRestantes} />
      ))}

      {/* Leyenda */}
      <div className="card py-3">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Cómo leer los colores</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {['ritmo', 'cerca', 'atrasado'].map(k => (
            <div key={k} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${ESTADO[k].bar}`} />
              <span className="text-[11px] text-gray-500">{ESTADO[k].label}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
          La línea gris dentro de cada barra marca dónde deberíamos ir hoy ({expectedPct}% del mes).
          Si la barra pasa la línea, vamos adelantados.
        </p>
      </div>
    </div>
  )
}
