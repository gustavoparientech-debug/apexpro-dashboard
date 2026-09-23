// ─── Metas de servicios del mes ──────────────────────────────────────────────
// El avance se calcula sobre los tickets del mes. Un ticket aporta a una meta
// de dos formas: por el tipo de vehículo (los lavados) o porque alguno de sus
// adicionales coincide con las palabras clave del servicio (cerámicos, PPF,
// polarizados…). Lo que no queda registrado en un ticket —planchado, trabajos
// que hace el dueño— se lleva con un contador manual.

import { supabase } from './supabase'
import { calcRealSalary } from './utils'

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

// ─── Economía de cada meta ───────────────────────────────────────────────────
// Precio de lista, margen (lo que queda después del material y la mano de obra
// del servicio) y días de bahía que ocupa una unidad. Son los mismos números del
// plan mensual; el admin los edita en Metas → Configurar.
export const DEFAULT_ECON = {
  lavado_auto:     { price: 30,   margin: 22,    bayDays: 0.05 },
  lavado_exterior: { price: 20,   margin: 12,    bayDays: 0.03 },
  lavado_offroad:  { price: 70,   margin: 60,    bayDays: 0.25 },
  lavado_moto:     { price: 15,   margin: 12,    bayDays: 0.06 },
  pulido:          { price: 350,  margin: 325,   bayDays: 1 },
  abrillantado:    { price: 130,  margin: 90,    bayDays: 0.5 },
  desc_mecanica:   { price: 120,  margin: 90,    bayDays: 0.5 },
  cer_carpro_3:    { price: 1199, margin: 919,   bayDays: 3 },
  cer_carpro_2:    { price: 999,  margin: 739,   bayDays: 3 },
  cer_miyavi_1:    { price: 550,  margin: 370,   bayDays: 2 },
  cer_vonixx_3:    { price: 750,  margin: 490,   bayDays: 2 },
  pol_3m:          { price: 1150, margin: 540,   bayDays: 0.5 },
  pol_lexen_vp:    { price: 500,  margin: 230,   bayDays: 0.4 },
  pol_lexen_full:  { price: 700,  margin: 302.5, bayDays: 0.5 },
  ppf_zonas:       { price: 3500, margin: 1810,  bayDays: 2 },
  ppf_zonas_cer:   { price: 4200, margin: 2250,  bayDays: 2.5 },
  ppf_full:        { price: 6500, margin: 2750,  bayDays: 5 },
  pano_gustavo:    { price: 250,  margin: 170,   bayDays: 0.5 },
  pano_pintor:     { price: 250,  margin: 100,   bayDays: 0.5 },
}

// Bahías del taller: la capacidad del mes son los días hábiles por bahía.
export const DEFAULT_BAYS = 4

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

// Paños de planchado y pintura de un ticket. Abierto desde Registro guarda
// "3 paños · Standard · Auto"; desde una cotización, cada paño llega como
// adicional ("Capot + Planchado (Leve)", "Pintado de Techo") o agrupado
// ("Pintado de 4 paños").
export function panosDeTicket(row) {
  let n = 0
  if (String(row?.vehicle_type || '').startsWith('pre_planchado')) {
    const m = normalize(row.vehicle_subtype).match(/(\d+)\s*panos?/)
    n += m ? Number(m[1]) : 1
  }
  for (const name of row?.extras_names || []) {
    const x = normalize(name)
    const grupo = x.match(/^pintado de (\d+) panos?\b/)
    if (grupo) n += Number(grupo[1])
    else if (x.startsWith('pintado de ') || x.includes(' + planchado')) n += 1
  }
  return n
}

// Cuántas veces aporta un ticket a una meta. Un mismo ticket puede llevar dos
// adicionales del mismo servicio, y ambos cuentan.
export function matchCount(item, row) {
  if (!item || !row) return 0
  if (row.status === 'abierto') return 0
  if (item.source === 'manual') return 0

  // Servicio del catálogo: se cuenta directo por el servicio del ticket, sin
  // adivinar con palabras. Si la meta fija variantes, solo cuentan esas.
  if (item.source === 'vehiculo' || item.source === 'servicio') {
    if (!(item.vehicles || []).includes(row.vehicle_type)) return 0
    const vars = item.variants || []
    if (vars.length && !vars.includes(row.vehicle_subtype)) return 0
    return 1
  }

  // Categoría entera del catálogo. Solo cuentan los tickets abiertos con el
  // catálogo nuevo: los anteriores no tienen categoría guardada.
  if (item.source === 'categoria') {
    return (item.categories || []).includes(row.service_cat) ? 1 : 0
  }

  if (item.source === 'panos') return panosDeTicket(row)

  // Servicio de Presupuesto: cuenta si es el servicio del ticket o si llegó
  // como adicional desde una cotización (con su nombre de Presupuesto).
  if (item.source === 'presupuesto') {
    let n = 0
    if ((item.vehicles || []).includes(row.vehicle_type)) {
      const vars = item.variants || []
      if (!vars.length || vars.includes(row.vehicle_subtype)) n += 1
    }
    // Nombre exacto, o con el tamaño que agrega Presupuesto ("Pulido 1 Paso —
    // SUV"): "Miyavi 1 Año Plus" no debe contar como "Miyavi 1 Año".
    const kws = (item.keywords || []).map(normalize).filter(Boolean)
    if (kws.length) {
      n += (row.extras_names || []).map(normalize)
        .filter(name => kws.some(k => name === k || name.startsWith(k + ' — ') || name.startsWith(k + ' (')))
        .length
    }
    return n
  }

  const kws = (item.keywords || []).map(normalize).filter(Boolean)
  if (!kws.length) return 0
  const hits = (row.extras_names || []).map(normalize)
    .filter(name => kws.some(k => name.includes(k))).length
  if (hits > 0) return hits
  const sub = normalize(row.vehicle_subtype)
  return sub && kws.some(k => sub.includes(k)) ? 1 : 0
}

function ultimaClave(map, prefix) {
  return Object.keys(map || {}).filter(k => k <= prefix).sort().pop() || null
}

// De dónde sale la configuración de un mes. Cada mes guarda su propia lista
// (`months`); uno sin guardar parte de una copia del último mes configurado,
// y editarlo no toca a los demás. Lo guardado antes de separar por mes (una
// lista global + números en `goals`) se sigue leyendo para los meses viejos.
export function origenMes(config, prefix) {
  const mes    = ultimaClave(config?.months, prefix)
  const legado = ultimaClave(config?.goals, prefix)
  if (mes && (!legado || mes >= legado)) {
    return { tipo: mes === prefix ? 'propio' : 'heredado', desde: mes, ...config.months[mes] }
  }
  if (legado) {
    return {
      tipo: legado === prefix ? 'propio' : 'heredado', desde: legado,
      items: config?.items, goals: config.goals[legado], bays: config?.bays,
    }
  }
  return { tipo: 'referencia', desde: null, items: config?.items, bays: config?.bays }
}

export function baysDelMes(config, prefix) {
  return Number(origenMes(config, prefix).bays ?? config?.bays ?? DEFAULT_BAYS)
}

// Config guardada + mes → lista de metas con su número y su ajuste manual.
// Con `servicios` (el catálogo vigente) el precio se toma en vivo de Presupuesto.
export function resolveItems(config, prefix, servicios = null) {
  const origen = origenMes(config, prefix)
  const items  = origen.items?.length ? origen.items : DEFAULT_ITEMS
  const goals  = origen.goals || {}
  // El ajuste manual es de ese mes y nunca se hereda.
  const manual = config?.manual?.[prefix] || {}
  return items.map(it => {
    // Las configuraciones guardadas antes de tener precios no traen estos campos:
    // se completan con la economía de referencia del servicio.
    const ref = DEFAULT_ECON[it.id] || {}
    const item = {
      ...it,
      goal:    Number(goals[it.id] ?? it.goal ?? 0),
      manual:  Number(manual[it.id] ?? 0),
      variants:   it.variants   || [],
      categories: it.categories || [],
      price:   Number(it.price   ?? ref.price   ?? 0),
      margin:  Number(it.margin  ?? ref.margin  ?? 0),
      bayDays: Number(it.bayDays ?? ref.bayDays ?? 0),
    }
    return servicios ? conPrecioCatalogo(item, servicios) : item
  })
}

// ─── Precio conectado al catálogo / Presupuesto ──────────────────────────────
// Metas de referencia que ya tienen su servicio en Presupuesto.
const DEFAULT_PRECIO_DE = {
  abrillantado:  'pre_abrillantado',
  desc_mecanica: 'pre_desc_mecanica',
  cer_carpro_3:  'pre_cer_carpro_3a',
  cer_miyavi_1:  'pre_cer_miyavi_1a',
  ppf_zonas:     'pre_ppf_zonas',
  ppf_zonas_cer: 'pre_ppf_ceramico',
  ppf_full:      'pre_ppf_full',
}

// `precioDe` vacío ('') significa precio escrito a mano.
export function servicioVinculado(item) {
  if (item.precioDe !== undefined) return item.precioDe || null
  if (DEFAULT_PRECIO_DE[item.id]) return DEFAULT_PRECIO_DE[item.id]
  if (item.source === 'vehiculo' && item.vehicles?.length === 1) return item.vehicles[0]
  return null
}

// Precio vigente del servicio vinculado. El costo (material + mano de obra) se
// mantiene, así que si Presupuesto sube el precio el margen sube igual.
export function conPrecioCatalogo(item, servicios) {
  const ref = servicioVinculado(item)
  const s = ref ? (servicios || []).find(x => x.value === ref) : null
  if (!s) return { ...item, vinculo: null }
  const vars = s.variants || []
  const variante = (item.variants?.length && vars.find(v => item.variants.includes(v.label))) || vars[0]
  const vivo = Number(variante?.price ?? s.default_price) || 0
  if (vivo <= 0) return { ...item, vinculo: null }
  const costo = item.costo != null
    ? Number(item.costo)
    : (item.margin > 0 ? item.price - item.margin : null)
  return {
    ...item,
    price: vivo,
    costo,
    margin: costo == null ? 0 : Math.max(0, vivo - costo),
    vinculo: { label: s.label, emoji: s.emoji, variante: variante?.label || null, origen: s.origen || 'catalogo' },
  }
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

// ─── Dinero: qué genera el plan del mes ──────────────────────────────────────
// Mismo cálculo del plan mensual en Excel: cada meta aporta su precio y su
// margen, y ocupa días de bahía. `done` da lo que ya se generó; `goal`, lo que
// se generaría si el mes cierra completo.
export function computeEconomics(items, { costoFijo = 0, diasHabiles = 0, bays = DEFAULT_BAYS } = {}) {
  const porItem = (items || []).map(it => {
    const goal    = Number(it.goal) || 0
    const done    = Number(it.done) || 0
    const price   = Number(it.price) || 0
    const margin  = Number(it.margin) || 0
    const bayDays = Number(it.bayDays) || 0
    return {
      id: it.id, label: it.label, emoji: it.emoji, group: it.group,
      goal, done, price, margin, bayDays,
      ingresoMeta: goal * price,
      margenMeta:  goal * margin,
      ingresoReal: done * price,
      margenReal:  done * margin,
      // Tope en la meta: 300 lavados de más no tapan un cerámico que no se hizo.
      ingresoLogrado: Math.min(done, goal || done) * price,
      margenLogrado:  Math.min(done, goal || done) * margin,
      diasMeta:    goal * bayDays,
      diasReal:    done * bayDays,
    }
  })
  const sum = k => porItem.reduce((s, i) => s + i[k], 0)
  const ingresoMeta = sum('ingresoMeta')
  const margenMeta  = sum('margenMeta')
  const ingresoReal = sum('ingresoReal')
  const margenReal  = sum('margenReal')
  const ingresoLogrado = sum('ingresoLogrado')
  const margenLogrado  = sum('margenLogrado')
  const diasMeta    = sum('diasMeta')
  const diasReal    = sum('diasReal')
  const capacidad   = (Number(diasHabiles) || 0) * (Number(bays) || 0)

  return {
    porItem: porItem.map(i => ({
      ...i,
      pctMargen: margenMeta > 0 ? (i.margenMeta / margenMeta) * 100 : 0,
    })),
    ingresoMeta, margenMeta, ingresoReal, margenReal,
    ingresoLogrado, margenLogrado,
    // El avance del mes se mide en dinero, no en cantidad de servicios: cien
    // lavados no equivalen a un PPF.
    pct: ingresoMeta > 0 ? Math.round((ingresoLogrado / ingresoMeta) * 100) : 0,
    diasMeta, diasReal, capacidad,
    capacidadPct: capacidad > 0 ? (diasMeta / capacidad) * 100 : 0,
    costoFijo,
    utilidadMeta: margenMeta - costoFijo,
    utilidadReal: margenReal - costoFijo,
    cierra: margenMeta >= costoFijo && (capacidad === 0 || diasMeta <= capacidad),
  }
}

// Costo fijo del mes con el que se compara el margen del plan: los ítems fijos
// de Configuración más la planilla vigente. No incluye eventuales ni los gastos
// del día a día — esos se ven en el Dashboard.
export function costoFijoMes(monthlyCosts, workers) {
  const items = monthlyCosts?.cost_items
  const fijos = Array.isArray(items) && items.length > 0
    ? items.reduce((s, i) => s + (Number(i.amount) || 0), 0)
    : (Number(monthlyCosts?.rent) || 0) + (Number(monthlyCosts?.supplies) || 0)
  const planilla = (workers || [])
    .filter(w => w.active)
    .reduce((s, w) => s + calcRealSalary(w.base_salary, w.weekly_hours), 0)
  return fijos + planilla
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
      service_cat: t.service_cat || '',
      extras_names: (t.extras || []).map(e => e?.name).filter(Boolean),
      status: t.status || 'cerrado',
    }))
}
