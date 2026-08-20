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

// Paneles y multiplicadores: el precio de un panel es la base de la gama por el
// multiplicador del panel según el vehículo. Es el mismo cálculo de Presupuesto.
export const PLANCHADO_PANELES = [
  { id: 'guardafango_del_izq', label: 'Guardafango Del. Izq.', mult: { auto: 1,   suv: 1.2, pickup: 1.3 } },
  { id: 'guardafango_del_der', label: 'Guardafango Del. Der.', mult: { auto: 1,   suv: 1.2, pickup: 1.3 } },
  { id: 'guardafango_tra_izq', label: 'Guardafango Tra. Izq.', mult: { auto: 1,   suv: 1.2, pickup: 1.3 } },
  { id: 'guardafango_tra_der', label: 'Guardafango Tra. Der.', mult: { auto: 1,   suv: 1.2, pickup: 1.3 } },
  { id: 'capot',               label: 'Capot',                 mult: { auto: 2.5, suv: 3,   pickup: 3.5 } },
  { id: 'techo',               label: 'Techo',                 mult: { auto: 2.5, suv: 3.5, pickup: 3   } },
  { id: 'maletero',            label: 'Maletero / Tapa caja',  mult: { auto: 2,   suv: 2.5, pickup: 2   } },
  { id: 'puerta_del_izq',      label: 'Puerta Del. Izq.',      mult: { auto: 1.5, suv: 1.8, pickup: 1.8 } },
  { id: 'puerta_del_der',      label: 'Puerta Del. Der.',      mult: { auto: 1.5, suv: 1.8, pickup: 1.8 } },
  { id: 'puerta_tra_izq',      label: 'Puerta Tra. Izq.',      mult: { auto: 1.5, suv: 1.8, pickup: 1.8 } },
  { id: 'puerta_tra_der',      label: 'Puerta Tra. Der.',      mult: { auto: 1.5, suv: 1.8, pickup: 1.8 } },
  { id: 'parachoque_del',      label: 'Parachoque Delantero',  mult: { auto: 1.5, suv: 1.8, pickup: 2   } },
  { id: 'parachoque_tra',      label: 'Parachoque Trasero',    mult: { auto: 1.5, suv: 1.8, pickup: 2   } },
  { id: 'aleta_tra_izq',       label: 'Aleta Izquierda',       mult: { auto: 1,   suv: 1.3, pickup: 1.4 } },
  { id: 'aleta_tra_der',       label: 'Aleta Derecha',         mult: { auto: 1,   suv: 1.3, pickup: 1.4 } },
  { id: 'estribo_izq',         label: 'Estribo Izq.',          mult: { auto: 0.5, suv: 0.7, pickup: 0.8 } },
  { id: 'estribo_der',         label: 'Estribo Der.',          mult: { auto: 0.5, suv: 0.7, pickup: 0.8 } },
]

export const PLANCHADO_GAMAS = [
  { value: 'economy',  label: 'Economy',  hint: 'Toyota, Hyundai, Kia, Nissan…' },
  { value: 'standard', label: 'Standard', hint: 'Honda, Mazda, Ford, VW…' },
  { value: 'premium',  label: 'Premium',  hint: 'BMW, Mercedes, Audi, Lexus…' },
]

export const PLANCHADO_VEHICULOS = [
  { value: 'auto',   label: 'Auto' },
  { value: 'suv',    label: 'SUV' },
  { value: 'pickup', label: 'Pickup' },
]

// Config de planchado ya mezclada con lo que el admin guardó en Presupuesto.
export function planchadoConfig(config) {
  const basePrices = { ...PLANCHADO_BASE, ...(config?.basePrices || {}) }
  const panels = PLANCHADO_PANELES.map(p => {
    const sp = (config?.panels || []).find(x => x.id === p.id)
    return sp ? { ...p, mult: { ...p.mult, ...sp.mult } } : p
  })
  return { basePrices, panels }
}

export function precioPanel(panel, gama, vehiculo, basePrices) {
  const base = Number(basePrices?.[gama]) || 0
  const mult = Number(panel?.mult?.[vehiculo]) || 0
  return Math.round(base * mult * 100) / 100
}

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

  // Polarizado: la marca es el servicio y sus coberturas son las variantes, que
  // es como se elige en el mostrador: primero la lámina, después qué se polariza.
  const porMarca = {}
  for (const s of conMeta(POLARIZADOS_DATA, 'polarizados')) {
    const marca = s.brand || 'Sin marca'
    if (!porMarca[marca]) porMarca[marca] = []
    porMarca[marca].push({
      label: s.cobertura || s.name || 'Completo',
      price: precioCon(precios, s.id, null, s.price ?? 0),
    })
  }
  for (const [marca, coberturas] of Object.entries(porMarca)) {
    salida.push(comoServicio({
      id: `pol_${marca.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      label: marca, category: 'polarizado',
      variants: coberturas, sort: orden++,
    }))
  }

  // Planchado y pintura: una entrada por gama, con el precio del panel base.
  // Planchado: no tiene variantes fijas — se eligen paneles, gama y vehículo en
  // una ventana igual a la de Presupuesto, que arma el precio.
  salida.push({
    ...comoServicio({ id: 'planchado_panel', label: 'Planchado y pintura', category: 'planchado', price: 0, sort: orden++ }),
    planchado: true,
  })

  return salida
}
