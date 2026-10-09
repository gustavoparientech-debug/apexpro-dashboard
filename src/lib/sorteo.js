import { supabase } from './supabase'

// Sorteo Apex Pro: acceso a datos. El navegador nunca lee pedidos ni tickets
// directamente (salvo el admin); todo pasa por las RPC de supabase/sorteo_rpc.sql.

// Dominio público del sorteo: los enlaces que se comparten con clientes
// apuntan aquí, nunca a la dirección del panel.
export const PUBLIC_SITE = 'https://apexproaqp.com'

export const RECEIPTS_BUCKET = 'raffle-receipts'
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024

export const DEFAULT_CONFIG = {
  titulo: 'Sorteo Apex Pro',
  precio_ticket: 15,
  total_tickets: 600,
  max_por_pedido: 20,
  minutos_reserva: 15,
  fecha_sorteo: null,
  premios: [],
  numero_pago: '959240309',
  titular_pago: null,
  whatsapp: '959240309',
  instagram: '@apex.pro.aqp',
  terminos: '',
  estado: 'abierto',
}

export const fmtNum   = (n, total = 600) => String(n).padStart(String(total).length, '0')
export const fmtSoles = (v) => `S/${Number(v || 0).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
export const fmtPhone = (p) => String(p || '').replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')

export function fmtFecha(iso, withTime = true) {
  if (!iso) return null
  return new Date(iso).toLocaleString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
    timeZone: 'America/Lima',
  })
}

export async function fetchConfig() {
  const { data, error } = await supabase.from('raffle_config').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  return { ...DEFAULT_CONFIG, ...(data || {}) }
}

export async function updateConfig(patch) {
  const { data, error } = await supabase.from('raffle_config').update(patch).eq('id', 1).select().single()
  if (error) throw new Error(errorMessage(error))
  return data
}

// Estado efectivo de un número del tablero: una reserva vencida ya cuenta como
// libre aunque el cron todavía no la haya limpiado.
export function boardStatus(t, now = Date.now()) {
  if (!t) return 'disponible'
  if (t.status === 'reservado' && t.reserved_until && new Date(t.reserved_until).getTime() < now) return 'disponible'
  return t.status
}

export async function reserveTickets({ numbers, nombre, dni, celular, email, acepta }) {
  const { data, error } = await supabase.rpc('reserve_tickets', {
    p_numbers: numbers, p_nombre: nombre, p_dni: dni, p_celular: celular,
    p_email: email || null, p_acepta_terminos: acepta,
  })
  if (error) throw new Error(errorMessage(error))
  return data
}

export async function uploadReceipt(folder, file) {
  if (!file.type.startsWith('image/')) throw new Error('El comprobante debe ser una imagen.')
  if (file.size > MAX_RECEIPT_BYTES)  throw new Error('La imagen pesa más de 5 MB.')
  const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg'
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(/row-level|security|unauthorized/i.test(error.message)
    ? 'Tu reserva ya venció. Vuelve a elegir tus números.'
    : 'No se pudo subir la imagen. Intenta de nuevo.')
  return path
}

export async function submitPayment({ orderId, medio, nOperacion, path }) {
  const { error } = await supabase.rpc('submit_payment', {
    p_order: orderId, p_medio: medio, p_n_operacion: nOperacion || null, p_path: path,
  })
  if (error) throw new Error(errorMessage(error))
}

export async function fetchOrderStatus(orderId) {
  const { data, error } = await supabase.rpc('get_order_status', { p_order: orderId })
  if (error) throw new Error(errorMessage(error))
  return data
}

// ─── Panel ──────────────────────────────────────────────────────────────────

export async function staffSell({ numbers, nombre, dni, celular, email, medio, nOperacion }) {
  const { data, error } = await supabase.rpc('staff_sell_tickets', {
    p_numbers: numbers, p_nombre: nombre, p_dni: dni, p_celular: celular,
    p_email: email || null, p_medio: medio, p_n_operacion: nOperacion || null,
  })
  if (error) throw new Error(errorMessage(error))
  return data
}

export async function staffAttachReceipt(orderId, path) {
  const { error } = await supabase.rpc('staff_attach_receipt', { p_order: orderId, p_path: path })
  if (error) throw new Error(errorMessage(error))
}

export async function fetchOrders() {
  const { data, error } = await supabase
    .from('raffle_orders')
    .select('*, raffle_tickets(number, ticket_code, status)')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw error
  return data || []
}

export async function approveOrder(id) {
  const { data, error } = await supabase.rpc('approve_order', { p_order: id })
  if (error) throw new Error(errorMessage(error))
  return data
}

export async function rejectOrder(id, motivo) {
  const { data, error } = await supabase.rpc('reject_order', { p_order: id, p_motivo: motivo || null })
  if (error) throw new Error(errorMessage(error))
  return data
}

// Borra todos los pedidos, libera los números y elimina los comprobantes.
export async function resetRaffle() {
  const { data, error } = await supabase.rpc('raffle_reset', { p_confirm: 'REINICIAR' })
  if (error) throw new Error(errorMessage(error))

  const bucket = supabase.storage.from(RECEIPTS_BUCKET)
  const paths = []
  async function walk(prefix) {
    const { data: items } = await bucket.list(prefix, { limit: 1000 })
    for (const it of items || []) {
      const full = prefix ? `${prefix}/${it.name}` : it.name
      if (it.id) paths.push(full)   // archivo
      else await walk(full)         // carpeta
    }
  }
  await walk('')
  for (let i = 0; i < paths.length; i += 100) await bucket.remove(paths.slice(i, i + 100))
  return data
}

export async function receiptUrl(path) {
  const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUrl(path, 600)
  if (error) throw error
  return data.signedUrl
}

// ─── Errores de las RPC → texto para el cliente ─────────────────────────────

export function errorMessage(error) {
  const msg = String(error?.message || error || '')
  const [code, extra] = msg.split(':')
  switch (code.trim()) {
    case 'NO_DISPONIBLES': {
      const nums = (extra || '').split(',').filter(Boolean).map(n => fmtNum(n))
      return nums.length === 1
        ? `El número ${nums[0]} acaba de ser tomado por otra persona. Elige otro.`
        : `Los números ${nums.join(', ')} acaban de ser tomados. Elige otros.`
    }
    case 'MAXIMO':             return `Máximo ${extra} tickets por pedido.`
    case 'SIN_NUMEROS':        return 'Elige al menos un número.'
    case 'SORTEO_CERRADO':     return 'La venta de tickets está cerrada.'
    case 'TERMINOS':           return 'Debes aceptar los términos y condiciones.'
    case 'NOMBRE':             return 'Escribe tu nombre y apellido.'
    case 'DNI':                return 'Revisa tu DNI (8 dígitos) o carnet de extranjería.'
    case 'CELULAR':            return 'El celular debe tener 9 dígitos y empezar con 9.'
    case 'EMAIL':              return 'Revisa tu correo electrónico.'
    case 'RESERVA_VENCIDA':    return 'Tu reserva venció y los números se liberaron. Vuelve a elegirlos.'
    case 'PEDIDO_NO_PENDIENTE':return 'Este pedido ya fue procesado.'
    case 'PEDIDO_NO_EXISTE':   return 'No encontramos ese pedido.'
    case 'MEDIO_PAGO':         return 'Elige el medio de pago.'
    case 'COMPROBANTE':        return 'Sube la captura del pago.'
    case 'TICKETS_LIBERADOS':  return 'Los números de este pedido ya se liberaron; no se puede aprobar.'
    case 'TOTAL_MENOR_QUE_VENDIDOS': return 'No puedes bajar el total: hay números vendidos o reservados por encima.'
    case 'NO_AUTORIZADO':      return 'No tienes permiso para esta acción.'
    default:                   return /fetch|network/i.test(msg) ? 'Sin conexión. Revisa tu internet.' : (msg || 'Ocurrió un error.')
  }
}
