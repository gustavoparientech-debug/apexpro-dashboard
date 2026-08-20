// ─── Catálogo de Presupuesto, compartido con el ticket ───────────────────────
// Cerámico, PPF, Polarizado y Planchado se cotizan en Presupuesto; el ticket
// usa exactamente esos servicios y precios para no mantener dos listas. Lo que
// el admin edita en Presupuesto (nombre, precio, stock, servicios agregados)
// se ve en el ticket, porque acá se aplican los mismos overrides.

import { supabase } from './supabase'

export const CERAMICO_DATA = [
  { id: 'desc_quimica',     name: 'Descontaminación Química',   tag: 'Prep', timeMin: 120,  desc: 'Elimina impurezas invisibles adheridas a la pintura',           prices: { auto: 60,  suv: 70,  pickup: 80  } },
  { id: 'desc_mecanica',    name: 'Descontaminación Mecánica',  tag: 'Prep', timeMin: 180,  desc: 'Pintura completamente lisa al tacto, mejora brillo y acabado',  prices: { auto: 120, suv: 140, pickup: 160 } },
  { id: 'abrillantado',     name: 'Abrillantado Apex Pro',      tag: 'Prep', timeMin: 180,  desc: 'Aumenta brillo, reduce micro-rayones, elimina opacidad',        prices: { auto: 130, suv: 150, pickup: 170 } },
  { id: 'correccion',       name: 'Corrección Apex Pro',        tag: 'Prep', timeMin: 240,  desc: 'Elimina 90-95% de imperfecciones, acabado tipo espejo',         prices: { auto: 260, suv: 280, pickup: 300 } },
  { id: 'cer_miyavi_1a',    name: 'Cerámico Miyavi 1 Año',      tag: 'Paq',  timeMin: 480,  desc: 'Descontam. + pulido 3 pasos + cerámico + aspirado interior',    prices: { auto: 350, suv: 400, pickup: 450 } },
  { id: 'cer_miyavi_1b',    name: 'Cerámico Miyavi 1 Año Plus', tag: 'Paq',  timeMin: 480,  desc: 'Versión premium — pulido avanzado + cerámico 1 año',           prices: { auto: 400, suv: 450, pickup: 500 } },
  { id: 'cer_3a',           name: 'Cerámico 3 Años',            tag: 'Paq',  timeMin: 960,  desc: 'Paquete completo con cerámico de larga duración 3 años',       prices: { auto: 599, suv: 699, pickup: 799 } },
  { id: 'cer_2a_premium',   name: 'Cerámico 2 Años Premium',    tag: 'Paq',  timeMin: 960,  desc: 'Paquete premium con cerámico de 2 años',                       prices: { auto: 899, suv: 999, pickup: 1099} },
  { id: 'cer_carpro_3a',    name: 'Cerámico Carpro 3 Años',     tag: 'Paq',  timeMin: 960,  desc: 'Cerámico Carpro alta gama, 3 años de garantía del producto',   prices: { auto: 999, suv: 1099,pickup: 1199} },
]

export const PPF_DATA = [
  { id: 'ppf_full',     name: 'PPF Full Body',           timeMin: 1920, desc: 'Todo el vehículo. Lavado premium + descontam. + pulido 3 pasos + PPF autoregenerativo. Regalo: PPF en radio o faros. Tiempo: 4 días', prices: { auto: 4700, suv: 5400, pickup: 5900 } },
  { id: 'ppf_zonas',    name: 'PPF Zonas de Impacto',    timeMin: 960,  desc: 'Capot, parachoque delantero, guardabarros y faros. Regalo: PPF en manijas. Tiempo: 2 días',                                            prices: { auto: 2700, suv: 3100, pickup: 3400 } },
  { id: 'ppf_ceramico', name: 'PPF Zonas + Cerámico',    timeMin: 1440, desc: 'PPF en zonas de impacto + cerámico Carpro 2 años en las demás zonas. Tiempo: 3 días',                                                  prices: { auto: 3200, suv: 3700, pickup: 3900 } },
]

export const POLARIZADOS_DATA = [
  { id: 'appfilm_v',  brand: 'APPfilm Basic',          cobertura: 'Ventanas + Posterior', timeMin: 120, desc: 'Instalación profesional. Niveles: 5%, 20%, 35%, 50%, 70%',              price: 299  },
  { id: 'appfilm_f',  brand: 'APPfilm Basic',          cobertura: '+ Parabrisas',         timeMin: 150, desc: 'Instalación profesional. Niveles: 5%, 20%, 35%, 50%, 70%',              price: 350  },
  { id: 'lexen_v',    brand: 'Nanocerámico Lexen',     cobertura: 'Ventanas + Posterior', timeMin: 120, desc: 'Bloqueo UV, reducción de calor, garantía. Niveles: 5%–70%',            price: 440  },
  { id: 'lexen_f',    brand: 'Nanocerámico Lexen',     cobertura: '+ Parabrisas',         timeMin: 150, desc: 'Bloqueo UV, reducción de calor, garantía. Niveles: 5%–70%',            price: 640  },
  { id: 'protec_v',   brand: 'Nanocerámico Protec',    cobertura: 'Ventanas + Posterior', timeMin: 120, desc: 'UV, calor, garantía del producto premium. Niveles: 5%–70%',            price: 480  },
  { id: 'protec_f',   brand: 'Nanocerámico Protec',    cobertura: '+ Parabrisas',         timeMin: 150, desc: 'UV, calor, garantía del producto premium. Niveles: 5%–70%',            price: 680  },
  { id: '3m_v',       brand: '3M Coreano',             cobertura: 'Ventanas + Posterior', timeMin: 120, desc: 'Alta gama. Niveles: 5%–70%',                                           price: 700  },
  { id: '3m_f',       brand: '3M Coreano',             cobertura: '+ Parabrisas',         timeMin: 150, desc: 'Alta gama. Niveles: 5%–70%',                                           price: 900  },
  { id: '3m_usa_v',   brand: '3M Americano',           cobertura: 'Ventanas + Posterior', timeMin: 120, desc: 'Máxima calidad importado USA. Niveles: 5%–70%',                        price: 1400 },
]

// Los tres tamaños con los que Presupuesto cotiza cerámico y PPF.
const TAMANIOS = [
  { key: 'auto',   label: 'Auto / HB' },
  { key: 'suv',    label: 'SUV' },
  { key: 'pickup', label: 'Pickup' },
]

// Planchado se cotiza por panel y por gama de la marca; en el ticket entra como
// un servicio con el precio del panel base de cada gama. El monto final se
// ajusta al cerrar, con el detalle en la cotización.
const PLANCHADO_BASE = { economy: 250, standard: 290, premium: 350 }

const EMOJI_CAT = {
  ceramico:   '💎',
  ppf:        '🛡️',
  polarizado: '🪟',
  planchado:  '🔨',
}

// Overrides que el admin guarda desde Presupuesto.
export async function fetchCatalogoOverrides() {
  const [meta, precios, config] = await Promise.all([
    supabase.from('app_settings').select('value').eq('key', 'cat_meta').maybeSingle(),
    supabase.from('app_settings').select('value').eq('key', 'cat_prices').maybeSingle(),
    supabase.from('app_settings').select('value').eq('key', 'presupuesto_config').maybeSingle(),
  ])
  return {
    meta:    meta.data?.value    || { overrides: {}, added: [], deleted: [], order: {} },
    precios: precios.data?.value || {},
    config:  config.data?.value  || null,
  }
}

function precioCon(overrides, id, key, fallback) {
  const ov = overrides[id]
  if (ov !== undefined) {
    if (typeof ov === 'object') return Number(ov[key] ?? fallback) || 0
    return Number(ov) || 0
  }
  return Number(fallback) || 0
}

// Un servicio del ticket con la misma forma que los de `vehicle_types`, para
// que el selector y las metas los traten igual.
function comoServicio({ id, label, category, variants, price, sort }) {
  return {
    id: `pre_${id}`,
    value: `pre_${id}`,
    label,
    emoji: EMOJI_CAT[category] || '🧰',
    category,
    default_price: price ?? (variants?.[0]?.price ?? 0),
    variants: variants && variants.length ? variants : null,
    active: true,
    origen: 'presupuesto',
    sort_order: 1000 + sort,
  }
}

// Servicios de Presupuesto listos para el ticket: cerámico, PPF, polarizado y
// planchado, con los precios y nombres vigentes.
export function serviciosDePresupuesto({ meta, precios, config }) {
  const borrados   = new Set(meta?.deleted || [])
  const overrides  = meta?.overrides || {}
  const agregados  = meta?.added || []
  const salida = []
  let orden = 0

  const conMeta = (lista, cat) => lista
    .filter(s => !borrados.has(s.id))
    .map(s => ({ ...s, ...(overrides[s.id] || {}) }))
    .filter(s => s.inStock !== false)
    .concat(agregados.filter(a => a.category === cat).map(a => ({ ...a, ...(overrides[a.id] || {}) })))

  // Cerámico y PPF: precio por tamaño de vehículo.
  for (const [cat, lista] of [['ceramico', CERAMICO_DATA], ['ppf', PPF_DATA]]) {
    for (const s of conMeta(lista, cat)) {
      const variants = TAMANIOS
        .map(t => ({ label: t.label, price: precioCon(precios, s.id, t.key, s.prices?.[t.key] ?? s.price ?? 0) }))
        .filter(v => v.price > 0)
      salida.push(comoServicio({ id: s.id, label: s.name, category: cat, variants, sort: orden++ }))
    }
  }

  // Polarizado: el nombre es marca + cobertura y el precio es único.
  for (const s of conMeta(POLARIZADOS_DATA, 'polarizados')) {
    const label = s.brand ? `${s.brand} — ${s.cobertura || s.name || ''}`.trim() : (s.name || s.cobertura || 'Polarizado')
    salida.push(comoServicio({
      id: s.id, label, category: 'polarizado',
      price: precioCon(precios, s.id, null, s.price ?? 0),
      sort: orden++,
    }))
  }

  // Planchado y pintura: una entrada por gama, con el precio del panel base.
  const base = { ...PLANCHADO_BASE, ...(config?.basePrices || {}) }
  salida.push(comoServicio({
    id: 'planchado_panel',
    label: 'Planchado y pintura (por panel)',
    category: 'planchado',
    variants: [
      { label: 'Economy',  price: Number(base.economy)  || 0 },
      { label: 'Standard', price: Number(base.standard) || 0 },
      { label: 'Premium',  price: Number(base.premium)  || 0 },
    ],
    sort: orden++,
  }))

  return salida
}
