import { supabase } from './supabase'

// Fidelización por placa: la tarjeta de sellos de papel, en virtual.
// El cliente entra a /fidelidad con su placa + PIN y ve solo sellos y premios.
// Los sellos salen de los tickets cerrados de esa placa (nada que sellar a mano).

export const FIDELIDAD_KEY = 'fidelidad'

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

export const DEFAULT_CONFIG = {
  activo: true,
  titulo: 'Tarjeta Apex Pro',
  niveles: [
    { sellos: 4, pct: 20, label: '20% de descuento' },
    { sellos: 8, pct: 40, label: '40% de descuento' },
  ],
  promos: [],
}

export function normPlate(plate) {
  return String(plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

// Formato peruano: 3 letras/números + guion + el resto (ABC-123).
export function formatPlate(plate) {
  const n = normPlate(plate)
  if (n.length < 6) return n
  return `${n.slice(0, 3)}-${n.slice(3)}`
}

// El ciclo de la tarjeta es el nivel más alto: al canjearlo, vuelve a cero.
export function cycleSize(config) {
  const niveles = config?.niveles || []
  return Math.max(1, ...niveles.map(n => Number(n.sellos) || 0))
}

export function sortedNiveles(config) {
  return [...(config?.niveles || [])].sort((a, b) => a.sellos - b.sellos)
}

// ─── Config (admin) ─────────────────────────────────────────────────────────

export async function loadConfig() {
  if (IS_DEMO) return DEFAULT_CONFIG
  const { data } = await supabase.from('app_settings').select('value').eq('key', FIDELIDAD_KEY).maybeSingle()
  return { ...DEFAULT_CONFIG, ...(data?.value || {}) }
}

export async function saveConfig(config) {
  if (IS_DEMO) return
  const { error } = await supabase.from('app_settings').upsert(
    { key: FIDELIDAD_KEY, value: config, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
  if (error) throw error
}

// ─── Tarjeta del cliente (página pública) ───────────────────────────────────
// Todo pasa por funciones security definer: el visitante nunca lee las tablas,
// así que no puede ver precios, gastos ni las placas de los demás.

export async function fetchCard(plate, pin) {
  if (IS_DEMO) return demoCard(plate, pin)
  const { data, error } = await supabase.rpc('loyalty_card', { p_plate: plate, p_pin: pin || null })
  if (error) throw error
  return data
}

export async function activateCard({ plate, pin, name, phone }) {
  if (IS_DEMO) return demoCard(plate, pin)
  const { data, error } = await supabase.rpc('loyalty_activate', {
    p_plate: plate, p_pin: pin, p_name: name || null, p_phone: phone || null,
  })
  if (error) throw error
  return data
}

export async function fetchPublicConfig() {
  if (IS_DEMO) return DEFAULT_CONFIG
  const { data, error } = await supabase.rpc('loyalty_public_config')
  if (error) throw error
  return { ...DEFAULT_CONFIG, ...(data || {}) }
}

// ─── Tarjeta vista desde el taller ──────────────────────────────────────────
// Adentro del ticket el que mira ya inició sesión, así que no se pide PIN.
// `loyalty_cards_staff` trae varias placas de una sola vez para las tarjetas
// de la lista del día.

export async function fetchStaffCard(plate) {
  if (IS_DEMO) return null
  const { data, error } = await supabase.rpc('loyalty_card_staff', { p_plate: plate })
  if (error) throw error
  return data?.status === 'ok' ? data : null
}

export async function fetchStaffCards(plates) {
  const limpias = [...new Set((plates || []).map(normPlate).filter(p => p.length >= 4))]
  if (IS_DEMO || limpias.length === 0) return {}
  const { data, error } = await supabase.rpc('loyalty_cards_staff', { p_plates: limpias })
  if (error) throw error
  return data || {}
}

// Sin base de datos (demo) las visitas se cuentan con los tickets que ya tiene
// el contexto: los sellos son los servicios cerrados de esa placa.
export function cardsFromTickets(tickets, config = DEFAULT_CONFIG) {
  const ciclo = cycleSize(config)
  const mapa = {}
  for (const t of tickets || []) {
    if ((t.status || 'cerrado') === 'abierto') continue
    const norm = normPlate(t.plate)
    if (norm.length < 4) continue
    if (!mapa[norm]) mapa[norm] = { plate_norm: norm, nombre: '', activa: false, sellos: 0, ciclo, visitas_totales: 0, canjeados: [] }
    mapa[norm].sellos += 1
    mapa[norm].visitas_totales += 1
  }
  return mapa
}

// ─── Canje (personal) ───────────────────────────────────────────────────────

// El canje del taller crea la ficha del cliente si no existe: quien nunca
// activó su tarjeta en el celular igual tiene derecho al bono.
export async function redeemTier(plate, tier, note) {
  if (IS_DEMO) return { status: 'ok' }
  const { data, error } = await supabase.rpc('loyalty_redeem_staff', {
    p_plate: plate, p_tier: tier, p_note: note || null,
  })
  if (error) throw error
  return data
}

// Deshacer un bono cobrado por error: borra el canje y, si ese canje había
// reiniciado la tarjeta, devuelve el ciclo.
export async function undoTier(plate, tier) {
  if (IS_DEMO) return { status: 'ok' }
  const { data, error } = await supabase.rpc('loyalty_undo_staff', { p_plate: plate, p_tier: tier })
  if (error) throw error
  return data
}

export const REDEEM_ERRORS = {
  no_autorizado:        'Inicia sesión para canjear',
  no_encontrada:        'Esa placa todavía no tiene servicios cerrados',
  placa_invalida:       'La placa del ticket no es válida',
  nivel_invalido:       'Ese premio ya no existe en la configuración',
  sellos_insuficientes: 'Todavía no llega a ese premio',
  ya_canjeado:          'Ese premio ya fue canjeado en esta tarjeta',
  no_canjeado:          'Ese bono no figura como cobrado',
}

// ─── Estado derivado de la tarjeta ──────────────────────────────────────────
// Con los sellos y los canjes ya hechos, calcula qué premio está disponible
// y cuánto falta para el siguiente. Lo usan la página pública y la de admin.

export function cardState(card, config) {
  const cfg      = config || card?.config || DEFAULT_CONFIG
  const niveles  = sortedNiveles(cfg)
  const ciclo    = cycleSize(cfg)
  const sellos   = Math.max(0, Number(card?.sellos) || 0)
  const canjeados = (card?.canjeados || []).map(Number)

  const tiers = niveles.map(n => ({
    ...n,
    sellos:     Number(n.sellos),
    canjeado:   canjeados.includes(Number(n.sellos)),
    disponible: sellos >= Number(n.sellos) && !canjeados.includes(Number(n.sellos)),
  }))

  const disponibles = tiers.filter(t => t.disponible)
  const siguiente   = tiers.find(t => sellos < t.sellos) || null

  return {
    ciclo,
    sellos,
    enTarjeta: Math.min(sellos, ciclo),
    extra:     Math.max(0, sellos - ciclo),
    tiers,
    disponibles,
    siguiente,
    faltan: siguiente ? siguiente.sellos - sellos : 0,
  }
}

// ─── Demo ───────────────────────────────────────────────────────────────────

function demoCard(plate, pin) {
  if (!pin) return { status: 'sin_pin', plate: formatPlate(plate), nombre: '' }
  return {
    status: 'ok',
    plate: formatPlate(plate),
    nombre: 'Cliente demo',
    sellos: 5,
    ciclo: 8,
    visitas_totales: 5,
    ultima_visita: new Date().toISOString().slice(0, 10),
    canjeados: [4],
    config: DEFAULT_CONFIG,
  }
}
