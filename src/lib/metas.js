// ─── Metas de servicios del mes ──────────────────────────────────────────────
// El avance se calcula sobre los tickets del mes. Un ticket aporta a una meta
// de dos formas: por el tipo de vehículo (los lavados) o porque alguno de sus
// adicionales coincide con las palabras clave del servicio (cerámicos, PPF,
// polarizados…). Lo que no queda registrado en un ticket —planchado, trabajos
// que hace el dueño— se lleva con un contador manual.

import { supabase } from './supabase'

export const METAS_KEY = 'metas_servicios'

export const GRUPOS = [
  { id: 'lavados',   label: 'Lavados',            emoji: '🚿' },
  { id: 'detailing', label: 'Detailing y premium', emoji: '💎' },
]

// Metas de referencia: se usan la primera vez, antes de que el admin las edite.
export const DEFAULT_ITEMS = [
  // ── Lavados (se cuentan por tipo de vehículo del ticket) ───────────────────
  { id: 'lavado_auto',      emoji: '🚙', label: 'Lavado auto completo',       goal: 130, group: 'lavados',   source: 'vehiculo', vehicles: ['auto'],                                     keywords: [] },
  { id: 'lavado_exterior',  emoji: '🚗', label: 'Lavado auto exterior',       goal: 20,  group: 'lavados',   source: 'vehiculo', vehicles: ['auto_exterior'],                            keywords: [] },
  { id: 'lavado_offroad',   emoji: '🛻', label: 'Lavado offroad / camioneta', goal: 10,  group: 'lavados',   source: 'vehiculo', vehicles: ['offroad', 'camioneta_small'], keywords: [] },
  { id: 'lavado_moto',      emoji: '🏍️', label: 'Lavado moto',                goal: 10,  group: 'lavados',   source: 'vehiculo', vehicles: ['moto'],                                     keywords: [] },
  // ── Detailing y premium (se cuentan por los adicionales del ticket) ────────
  { id: 'pulido',           emoji: '✨', label: 'Pulido',                     goal: 2,   group: 'detailing', source: 'palabras', vehicles: [], keywords: ['pulido'] },
  { id: 'abrillantado',     emoji: '💫', label: 'Abrillantado',               goal: 3,   group: 'detailing', source: 'palabras', vehicles: [], keywords: ['abrillantado'] },
  { id: 'desc_mecanica',    emoji: '🧪', label: 'Descontaminación mecánica',  goal: 0,   group: 'detailing', source: 'palabras', vehicles: [], keywords: ['descontaminacion mecanica'] },
  { id: 'cer_carpro_3',     emoji: '💎', label: 'Cerámico CarPro 3 años',     goal: 1,   group: 'detailing', source: 'palabras', vehicles: [], keywords: ['carpro 3', 'car pro 3'] },
  { id: 'cer_carpro_2',     emoji: '💎', label: 'Cerámico CarPro 2 años',     goal: 1,   group: 'detailing', source: 'palabras', vehicles: [], keywords: ['carpro 2', 'car pro 2'] },
  { id: 'cer_miyavi_1',     emoji: '💎', label: 'Cerámico Miyavi 1 año',      goal: 2,   group: 'detailing', source: 'palabras', vehicles: [], keywords: ['miyavi'] },
  { id: 'cer_vonixx_3',     emoji: '💎', label: 'Cerámico Vonixx 3 años',     goal: 2,   group: 'detailing', source: 'palabras', vehicles: [], keywords: ['vonix'] },
  { id: 'pol_3m',           emoji: '🕶️', label: 'Polarizado 3M completo',     goal: 2,   group: 'detailing', source: 'palabras', vehicles: [], keywords: ['3m completo', 'polarizado 3m'] },
  { id: 'pol_lexen_vp',     emoji: '🕶️', label: 'Polarizado Lexen vent+post', goal: 2,   group: 'detailing', source: 'palabras', vehicles: [], keywords: ['lexen vent', 'vent+post'] },
  { id: 'pol_lexen_full',   emoji: '🕶️', label: 'Polarizado Lexen completo',  goal: 1,   group: 'detailing', source: 'palabras', vehicles: [], keywords: ['lexen completo'] },
  { id: 'ppf_zonas',        emoji: '🛡️', label: 'PPF Zonas de impacto',       goal: 1,   group: 'detailing', source: 'palabras', vehicles: [], keywords: ['ppf zonas', 'zonas de impacto'] },
  { id: 'ppf_zonas_cer',    emoji: '🛡️', label: 'PPF Zonas + Cerámico',       goal: 0,   group: 'detailing', source: 'palabras', vehicles: [], keywords: ['zonas + ceramico', 'ppf + ceramico'] },
  { id: 'ppf_full',         emoji: '🛡️', label: 'PPF Full Body',              goal: 0,   group: 'detailing', source: 'palabras', vehicles: [], keywords: ['full body'] },
  { id: 'pano_gustavo',     emoji: '🎨', label: 'Paño pintura (lo hace Gustavo)', goal: 5, group: 'detailing', source: 'manual', vehicles: [], keywords: [] },
  { id: 'pano_pintor',      emoji: '🎨', label: 'Paño pintura (con pintor)',      goal: 5, group: 'detailing', source: 'manual', vehicles: [], keywords: [] },
]

export function monthPrefix(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

// Minúsculas y sin tildes: los adicionales se escriben a mano y llegan como
// "Tratamiento cerámico vonix 3 años" o "Ceramico", nunca igual dos veces.
export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Cuántas veces aporta un ticket a una meta. Un mismo ticket puede llevar dos
// adicionales del mismo servicio, y ambos cuentan.
export function matchCount(item, row) {
  if (!item || !row) return 0
  if (row.status === 'abierto') return 0
  if (item.source === 'manual') return 0

  if (item.source === 'vehiculo') {
    return (item.vehicles || []).includes(row.vehicle_type) ? 1 : 0
  }

  const kws = (item.keywords || []).map(normalize).filter(Boolean)
  if (!kws.length) return 0
  const hits = (row.extras_names || []).map(normalize)
    .filter(name => kws.some(k => name.includes(k))).length
  if (hits > 0) return hits
  const sub = normalize(row.vehicle_subtype)
  return sub && kws.some(k => sub.includes(k)) ? 1 : 0
}

// Los números de un mes se heredan del último mes configurado: al empezar
// septiembre las metas siguen siendo las de agosto hasta que el admin las edite.
function inherited(map, prefix) {
  if (!map) return {}
  if (map[prefix]) return map[prefix]
  const previo = Object.keys(map).filter(k => k < prefix).sort().pop()
  return previo ? map[previo] : {}
}

// Config guardada + mes → lista de metas con su número y su ajuste manual.
export function resolveItems(config, prefix) {
  const items  = config?.items?.length ? config.items : DEFAULT_ITEMS
  const goals  = inherited(config?.goals, prefix)
  const manual = config?.manual?.[prefix] || {}
  return items.map(it => ({
    ...it,
    goal:   Number(goals[it.id] ?? it.goal ?? 0),
    manual: Number(manual[it.id] ?? 0),
  }))
}

// Avance de cada meta: lo que sale de los tickets + el ajuste manual.
export function computeProgress(items, rows, todayIso) {
  return items.map(item => {
    let auto = 0
    let hoy  = 0
    for (const row of rows || []) {
      const n = matchCount(item, row)
      if (!n) continue
      auto += n
      if (row.fecha === todayIso) hoy += n
    }
    const done = auto + (item.manual || 0)
    const goal = item.goal || 0
    const pct  = goal > 0 ? Math.round((done / goal) * 100) : (done > 0 ? 100 : 0)
    return { ...item, auto, hoy, done, pct, faltan: Math.max(0, goal - done) }
  })
}

// Semáforo contra el ritmo esperado: a mitad de mes se espera la mitad de la
// meta. Sin esto una meta al 40% el día 28 se vería igual de bien que el día 3.
export function estadoMeta(pct, expectedPct) {
  if (pct >= 100) return 'logrado'
  if (pct >= expectedPct * 0.9) return 'ritmo'
  if (pct >= expectedPct * 0.6) return 'cerca'
  return 'atrasado'
}

// ─── Persistencia ────────────────────────────────────────────────────────────
const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

// Sin red la promesa de supabase puede quedarse colgada y la página se queda en
// el spinner para siempre. Mejor rendirse y mostrar las metas de referencia.
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

export async function fetchMetasConfig() {
  if (IS_DEMO) return null
  try {
    const { data, error } = await withTimeout(
      supabase.from('app_settings').select('value').eq('key', METAS_KEY).maybeSingle()
    )
    if (error) return null
    return data?.value || null
  } catch {
    return null
  }
}

export async function saveMetasConfig(config) {
  const { error } = await supabase.from('app_settings').upsert(
    { key: METAS_KEY, value: config, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
  if (error) throw error
}

// Los tickets de otros trabajadores no son visibles por RLS, así que el avance
// del equipo llega por una función que solo devuelve tipo de vehículo y nombres
// de adicionales — sin precios, placas ni cliente.
export async function fetchMetasRows(prefix) {
  if (IS_DEMO) throw new Error('demo')
  const { data, error } = await withTimeout(
    supabase.rpc('metas_tickets_mes', { p_prefix: prefix })
  )
  if (error) throw error
  return data || []
}

// Fallback para demo (o si la función aún no está desplegada): se arma la misma
// forma de fila a partir de los tickets que ya tiene el contexto.
export function rowsFromTickets(tickets, prefix) {
  return (tickets || [])
    .filter(t => t.date?.startsWith(prefix))
    .map(t => ({
      fecha: t.date,
      vehicle_type: t.vehicle_type || '',
      vehicle_subtype: t.vehicle_subtype || '',
      extras_names: (t.extras || []).map(e => e?.name).filter(Boolean),
      status: t.status || 'cerrado',
    }))
}
