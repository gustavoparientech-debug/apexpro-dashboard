// ─── Citas ───────────────────────────────────────────────────────────────────
// Las citas viven en app_settings (key 'citas') como una lista. Acá está lo
// compartido entre la página de Citas y Presupuesto, que agenda directo desde
// una cotización sin volver a escribir los datos del cliente.

import { supabase } from './supabase'

export const CITAS_KEY = 'citas'

export const SERVICIOS_CITA = [
  { id: 'lavado_estandar',  label: 'Lavado Estándar',        emoji: '🚿', color: 'blue' },
  { id: 'lavado_offroad',   label: 'Lavado Off-Road',        emoji: '🚙', color: 'orange' },
  { id: 'lavado_detailing', label: 'Detailing Completo',     emoji: '✨', color: 'purple' },
  { id: 'ceramico',         label: 'Recubrimiento Cerámico', emoji: '💎', color: 'cyan' },
  { id: 'ppf',              label: 'PPF',                    emoji: '🛡️', color: 'gray' },
  { id: 'polarizado',       label: 'Polarizado',             emoji: '🕶️', color: 'indigo' },
  { id: 'planchado',        label: 'Planchado y Pintura',    emoji: '🎨', color: 'red' },
  { id: 'otro',             label: 'Otro',                   emoji: '🔧', color: 'green' },
]

// Categoría de Presupuesto → servicio de la cita.
const POR_CATEGORIA = {
  planchado:   'planchado',
  ceramico:    'ceramico',
  ppf:         'ppf',
  polarizados: 'polarizado',
  lavados:     'lavado_estandar',
  servicios:   'otro',
}

export function servicioDeCategoria(categoria) {
  return POR_CATEGORIA[categoria] || 'otro'
}

export async function fetchCitas() {
  const { data, error } = await supabase
    .from('app_settings').select('value').eq('key', CITAS_KEY).maybeSingle()
  if (error) return []
  return Array.isArray(data?.value) ? data.value : []
}

export async function saveCitas(lista) {
  const { error } = await supabase.from('app_settings').upsert(
    { key: CITAS_KEY, value: lista, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
  if (error) throw error
}

// Agrega una cita a la lista existente, ordenada por fecha y hora.
export async function addCita(cita) {
  const actuales = await fetchCitas()
  const nueva = { ...cita, id: `cita_${Date.now()}` }
  const lista = [...actuales, nueva].sort((a, b) =>
    `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
  )
  await saveCitas(lista)
  return nueva
}

// Horarios de atención, cada media hora.
export function franjasHorarias() {
  const slots = []
  for (let h = 7; h <= 21; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 21) slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}
