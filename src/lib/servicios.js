// ─── Catálogo de servicios del ticket ────────────────────────────────────────
// Tres niveles: categoría → servicio → variante con su precio.
//   Categoría: Lavados, Detailing, Cerámico…  (las de la lista de precios)
//   Servicio:  Lavado Estándar, Off-Road FULL, Apex Detailing…
//   Variante:  Auto, SUV, Pick-Up, XL — cada una con su precio.
//
// El servicio vive en `vehicle_types` (el nombre de la tabla quedó de cuando
// el ticket preguntaba por el tipo de vehículo) y la variante en sus
// `variants`. Lo único nuevo es la categoría.

export const CATEGORIAS = [
  { value: 'lavados',    label: 'Lavados',               emoji: '🚿' },
  { value: 'detailing',  label: 'Detailing',             emoji: '✨' },
  { value: 'pintura',    label: 'Corrección de pintura', emoji: '🔧' },
  { value: 'ceramico',   label: 'Cerámico',              emoji: '💎' },
  { value: 'polarizado', label: 'Polarizado',            emoji: '🪟' },
  { value: 'ppf',        label: 'PPF',                   emoji: '🛡️' },
  { value: 'planchado',  label: 'Planchado y pintura',   emoji: '🔨' },
  { value: 'otros',      label: 'Otros',                 emoji: '📦' },
]

export const CATEGORIA_DEFAULT = 'lavados'

export function catInfo(value) {
  return CATEGORIAS.find(c => c.value === value) || CATEGORIAS[CATEGORIAS.length - 1]
}

export function catLabel(value) {
  return catInfo(value).label
}

// Servicios activos agrupados por categoría, en el orden de CATEGORIAS y
// respetando el orden que el admin les dio adentro de cada una. Las categorías
// sin servicios no aparecen.
export function porCategoria(vehicleTypes, { soloActivos = true } = {}) {
  const lista = (vehicleTypes || [])
    .filter(v => (soloActivos ? v.active !== false : true))
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
  return CATEGORIAS
    .map(cat => ({ ...cat, servicios: lista.filter(v => (v.category || 'otros') === cat.value) }))
    .filter(g => g.servicios.length > 0)
}

// Precio de un servicio: el de la variante elegida, o el precio base si el
// servicio no tiene variantes.
export function precioServicio(servicio, variantLabel) {
  if (!servicio) return 0
  const v = (servicio.variants || []).find(x => x.label === variantLabel)
  if (v) return Number(v.price) || 0
  return Number(servicio.default_price) || 0
}
