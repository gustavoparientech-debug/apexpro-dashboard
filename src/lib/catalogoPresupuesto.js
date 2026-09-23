// ─── Catálogo de Presupuesto, compartido con el ticket ───────────────────────
// Cerámico, PPF, Polarizado y Planchado se cotizan en Presupuesto; el ticket
// usa exactamente esos servicios y precios para no mantener dos listas. Lo que
// el admin edita en Presupuesto (nombre, precio, stock, servicios agregados)
// se ve en el ticket, porque acá se aplican los mismos overrides.

import { supabase } from './supabase'

export const CERAMICO_DATA = [
  { id: 'desc_quimica',     name: 'Descontaminación Química',   tag: 'Prep', timeMin: 120,  desc: 'Elimina impurezas invisibles adheridas a la pintura',           prices: { auto: 60,  suv: 70,  pickup: 80  } , grupo: 'Pulidos y Descontaminaciones' },
  { id: 'desc_mecanica',    name: 'Descontaminación Mecánica',  tag: 'Prep', timeMin: 180,  desc: 'Pintura completamente lisa al tacto, mejora brillo y acabado',  prices: { auto: 120, suv: 140, pickup: 160 } , grupo: 'Pulidos y Descontaminaciones' },
  { id: 'abrillantado',     name: 'Abrillantado Apex Pro',      tag: 'Prep', timeMin: 180,  desc: 'Aumenta brillo, reduce micro-rayones, elimina opacidad',        prices: { auto: 130, suv: 150, pickup: 170 } , grupo: 'Pulidos y Descontaminaciones' },
  { id: 'correccion',       name: 'Corrección Apex Pro',        tag: 'Prep', timeMin: 240,  desc: 'Elimina 90-95% de imperfecciones, acabado tipo espejo',         prices: { auto: 260, suv: 280, pickup: 300 } , grupo: 'Pulidos y Descontaminaciones' },
  { id: 'cer_miyavi_1a',    name: 'Cerámico Miyavi 1 Año',      tag: 'Paq',  timeMin: 480,  desc: 'Descontam. + pulido 3 pasos + cerámico + aspirado interior',    prices: { auto: 350, suv: 400, pickup: 450 } , grupo: 'Cerámicos' },
  { id: 'cer_miyavi_1b',    name: 'Cerámico Miyavi 1 Año Plus', tag: 'Paq',  timeMin: 480,  desc: 'Versión premium — pulido avanzado + cerámico 1 año',           prices: { auto: 400, suv: 450, pickup: 500 } , grupo: 'Cerámicos' },
  { id: 'cer_3a',           name: 'Cerámico 3 Años',            tag: 'Paq',  timeMin: 960,  desc: 'Paquete completo con cerámico de larga duración 3 años',       prices: { auto: 599, suv: 699, pickup: 799 } , grupo: 'Cerámicos' },
  { id: 'cer_2a_premium',   name: 'Cerámico 2 Años Premium',    tag: 'Paq',  timeMin: 960,  desc: 'Paquete premium con cerámico de 2 años',                       prices: { auto: 899, suv: 999, pickup: 1099} , grupo: 'Cerámicos' },
  { id: 'cer_carpro_3a',    name: 'Cerámico Carpro 3 Años',     tag: 'Paq',  timeMin: 960,  desc: 'Cerámico Carpro alta gama, 3 años de garantía del producto',   prices: { auto: 999, suv: 1099,pickup: 1199} , grupo: 'Cerámicos' },
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

// Pestaña Servicios de Presupuesto: adicionales sueltos, con precio fijo o por
// tamaño de vehículo.
export const SERVICIOS_DATA = [
  // ── Precio fijo (no varía por vehículo) ──────────────────────────────────
  { id: 'sv_techo_g1',     name: 'Lavado de Techo G1',              timeMin: 60,  price: 80  , grupo: 'Lavados' },
  { id: 'sv_techo_g2',     name: 'Lavado de Techo G2',              timeMin: 60,  price: 90  , grupo: 'Lavados' },
  { id: 'sv_techo_g3',     name: 'Lavado de Techo G3',              timeMin: 60,  price: 100 , grupo: 'Lavados' },
  { id: 'sv_ret_asientos', name: 'Retirada de asientos',            timeMin: 30,  price: 60  , grupo: 'Detallado y desmontaje' },
  { id: 'sv_asientos_1f',  name: 'Lavado de asientos 1 Fila',       timeMin: 60,  price: 40  , grupo: 'Lavados' },
  { id: 'sv_asientos_2f',  name: 'Lavado de asientos 2 Filas',      timeMin: 90,  price: 80  , grupo: 'Lavados' },
  { id: 'sv_asientos_3f',  name: 'Lavado de asientos 3 Filas',      timeMin: 120, price: 110 , grupo: 'Lavados' },
  { id: 'sv_ext_cam',      name: 'Lavado Exterior Camioneta',       timeMin: 30,  price: 25  , grupo: 'Lavados' },
  { id: 'sv_chasis',       name: 'Lavado Chasis V-Mol',             timeMin: 30,  price: 50  , grupo: 'Lavados' },
  { id: 'sv_alumax',       name: 'Alumax y Removex',                timeMin: 30,  price: 30  , grupo: 'Detallado y desmontaje' },
  { id: 'sv_ret_llantas',  name: 'Retirado de llantas',             timeMin: 45,  price: 80  , grupo: 'Detallado y desmontaje' },
  { id: 'sv_det_interior', name: 'Detallado interior',              timeMin: 120, price: 90  , grupo: 'Detallado y desmontaje' },
  { id: 'sv_elixir',       name: 'Elixir CarPro',                   timeMin: 15,  price: 20  , grupo: 'Protección y brillo' },
  { id: 'sv_encerado',     name: 'Encerado Bleend 3 meses',         timeMin: 15,  price: 20  , grupo: 'Protección y brillo' },
  { id: 'sv_cer_g3',       name: 'Tratamiento Cerámico G3',         timeMin: 120, price: 100 , grupo: 'Cerámicos' },
  { id: 'sv_gliss',        name: 'Aplicación de Gliss Car Pro',     timeMin: 60,  price: 100 , grupo: 'Protección y brillo' },
  { id: 'sv_lav_piso',     name: 'Lavado de Piso',                  timeMin: 60,  price: 80  , grupo: 'Lavados' },
  { id: 'sv_ret_alfombra', name: 'Retirado de Alfombra',            timeMin: 30,  price: 40  , grupo: 'Detallado y desmontaje' },
  { id: 'sv_motor_basico', name: 'Lavado de Motor (Básico)',        timeMin: 20,  price: 20  , grupo: 'Lavados' },
  { id: 'sv_motor_det',    name: 'Lavado de Motor (Detallado)',     timeMin: 40,  price: 40  , grupo: 'Lavados' },
  { id: 'sv_berniz',       name: 'Berniz de Motor',                 timeMin: 15,  price: 15  , grupo: 'Detallado y desmontaje' },
  { id: 'sv_cera_vonixx',  name: 'Cera en pasta Vonixx',           timeMin: 15,  price: 20  , grupo: 'Protección y brillo' },
  // ── Precio según vehículo ─────────────────────────────────────────────────
  { id: 'sv_ext_basico',   name: 'Lavado Exterior (Básico)',        timeMin: 30,  prices: { auto: 25, suv: 30, pickup: 35, xl: 40 } , grupo: 'Lavados' },
  { id: 'sv_offroad',      name: 'Lavado OffRoad',                  timeMin: 45,  prices: { auto: 55, suv: 60, pickup: 65, xl: 70 } , grupo: 'Lavados' },
  { id: 'sv_pul1',         name: 'Pulido 1 Paso',                   timeMin: 120, prices: { auto: 130, suv: 150, pickup: 170, xl: 170 } , grupo: 'Pulidos y Descontaminaciones' },
  { id: 'sv_pul3',         name: 'Pulido 3 Pasos',                  timeMin: 240, prices: { auto: 260, suv: 280, pickup: 300, xl: 300 } , grupo: 'Pulidos y Descontaminaciones' },
  { id: 'sv_desc',         name: 'Descontaminación',                timeMin: 90,  prices: { auto: 120, suv: 140, pickup: 160, xl: 160 } , grupo: 'Pulidos y Descontaminaciones' },
  { id: 'sv_cer_cp2',      name: 'Cerámico CarPro 2 Años',          timeMin: 480, prices: { auto: 799, suv: 899, pickup: 999, xl: 999 } , grupo: 'Cerámicos' },
  { id: 'sv_cer_ap3',      name: 'Cerámico AutoPremium 3 Años',     timeMin: 480, prices: { auto: 499, suv: 599, pickup: 699, xl: 699 } , grupo: 'Cerámicos' },
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

// ─── Servicios de Presupuesto para las metas ─────────────────────────────────
// Lo que se puede elegir como meta, agrupado como en Presupuesto. Cada opción
// dice cómo se cuenta en los tickets y de qué servicio toma el precio, así la
// meta sigue a Presupuesto cuando allá cambia un precio o un nombre.
const SV_TAMANIOS = [['auto', 'Auto'], ['suv', 'SUV'], ['pickup', 'Pickup'], ['xl', 'XL']]

const slugMarca = marca => marca.toLowerCase().replace(/[^a-z0-9]+/g, '_')

export function opcionesMetas({ meta, precios, config } = {}, vehicleTypes = []) {
  const borrados  = new Set(meta?.deleted || [])
  const overrides = meta?.overrides || {}
  const agregados = meta?.added || []
  const pr = precios || {}
  const lista = (data, cat) => data
    .filter(s => !borrados.has(s.id))
    .map(s => ({ ...s, ...(overrides[s.id] || {}) }))
    .concat(agregados.filter(a => a.category === cat).map(a => ({ ...a, ...(overrides[a.id] || {}) })))

  const opcion = (o) => ({ variants: [], keywords: [], categories: [], ...o, precioDe: o.precio?.value ?? o.vehicles?.[0] ?? '' })
  const grupos = []

  // Planchado: la meta se cuenta en paños y cada paño vale la base de la gama.
  const { basePrices } = planchadoConfig(config)
  grupos.push({
    id: 'planchado', label: 'Planchado y pintura', emoji: '🔨',
    opciones: [opcion({
      id: 'pres_pano', label: 'Paños de planchado y pintura', emoji: '🎨', group: 'detailing', source: 'panos', vehicles: [],
      precio: {
        value: 'pre_pano', label: 'Paño de planchado y pintura', emoji: '🎨', origen: 'presupuesto',
        variants: PLANCHADO_GAMAS.map(g => ({ label: g.label, price: Number(basePrices[g.value]) || 0 })),
      },
    })],
  })

  for (const [cat, data, label, emoji] of [
    ['ceramico', CERAMICO_DATA, 'Cerámicos, pulidos y descontaminaciones', '💎'],
    ['ppf', PPF_DATA, 'PPF', '🛡️'],
  ]) {
    grupos.push({
      id: cat, label, emoji,
      opciones: lista(data, cat).map(s => {
        const value = `pre_${s.id}`
        const variants = TAMANIOS
          .map(t => ({ label: t.label, price: precioCon(pr, s.id, t.key, s.prices?.[t.key] ?? s.price ?? 0) }))
          .filter(v => v.price > 0)
        return opcion({
          id: `pres_${s.id}`, label: s.name, emoji, group: 'detailing', source: 'presupuesto',
          vehicles: [value], keywords: [s.name],
          precio: { value, label: s.name, emoji, origen: 'presupuesto', variants },
        })
      }),
    })
  }

  // Polarizado: en el ticket la marca es el servicio y la cobertura, la variante.
  const pol = lista(POLARIZADOS_DATA, 'polarizados')
  const coberturas = {}
  for (const s of pol) {
    const marca = s.brand || 'Sin marca'
    if (!coberturas[marca]) coberturas[marca] = []
    coberturas[marca].push({ label: s.cobertura || s.name || 'Completo', price: precioCon(pr, s.id, null, s.price ?? 0) })
  }
  grupos.push({
    id: 'polarizados', label: 'Polarizados', emoji: '🕶️',
    opciones: pol.map(s => {
      const marca = s.brand || 'Sin marca'
      const cob = s.cobertura || s.name || 'Completo'
      const value = `pre_pol_${slugMarca(marca)}`
      return opcion({
        id: `pres_${s.id}`, label: `${marca} — ${cob}`, emoji: '🕶️', group: 'detailing', source: 'presupuesto',
        vehicles: [value], variants: [cob], keywords: [`${marca} — ${cob}`],
        precio: { value, label: marca, emoji: '🕶️', origen: 'presupuesto', variants: coberturas[marca] },
      })
    }),
  })

  grupos.push({
    id: 'servicios', label: 'Servicios adicionales', emoji: '🧰',
    opciones: lista(SERVICIOS_DATA, 'servicios').map(s => {
      const value = `pre_${s.id}`
      const variants = s.prices
        ? SV_TAMANIOS.map(([k, l]) => ({ label: l, price: precioCon(pr, s.id, k, s.prices[k] ?? 0) })).filter(v => v.price > 0)
        : null
      return opcion({
        id: `pres_${s.id}`, label: s.name, emoji: '🧰',
        group: /lavado/i.test(s.grupo || s.name || '') ? 'lavados' : 'detailing',
        source: 'presupuesto', vehicles: [value], keywords: [s.name],
        precio: {
          value, label: s.name, emoji: '🧰', origen: 'presupuesto', variants,
          default_price: variants ? undefined : precioCon(pr, s.id, null, s.price ?? 0),
        },
      })
    }),
  })

  // Lavados: el ticket los registra con los servicios del catálogo propio, y
  // el precio es el del ticket (el primer tamaño, o el precio fijo).
  grupos.push({
    id: 'catalogo', label: 'Lavados (precio del ticket)', emoji: '🚿',
    opciones: (vehicleTypes || [])
      .filter(v => v.active !== false && v.origen !== 'presupuesto')
      .map(v => opcion({
        id: `svc_${v.value}`, label: v.label, emoji: v.emoji || '🚗',
        group: v.category === 'lavados' ? 'lavados' : 'detailing',
        source: 'vehiculo', vehicles: [v.value],
        precio: {
          value: v.value, label: v.label, emoji: v.emoji || '🚗',
          variants: v.variants?.length ? v.variants : null,
          default_price: v.default_price,
        },
      })),
  })

  // Precios que una meta puede seguir, buscados por `value`.
  const vistos = new Set()
  const catalogo = []
  for (const g of grupos) {
    for (const o of g.opciones) {
      if (o.precio && !vistos.has(o.precio.value)) { vistos.add(o.precio.value); catalogo.push(o.precio) }
    }
  }
  for (const v of vehicleTypes || []) {
    if (!vistos.has(v.value)) { vistos.add(v.value); catalogo.push(v) }
  }
  // Para encontrar la fila de costos de una meta por el servicio del que toma
  // el precio (y la cobertura, en polarizados).
  const ids = new Set()
  const porPrecio = {}
  for (const g of grupos) {
    for (const o of g.opciones) {
      ids.add(o.id)
      const k = `${o.precioDe}|${o.source === 'presupuesto' && o.variants?.[0] ? o.variants[0] : ''}`
      if (!porPrecio[k]) porPrecio[k] = o.id
    }
  }
  return { grupos, catalogo, claves: { ids, porPrecio } }
}

// Precio por unidad que muestra una opción: su cobertura en polarizados, el
// tamaño Auto (o el primero) en el resto.
export function precioBase(o) {
  const vars = o.precio?.variants || []
  const v = vars.find(x => o.variants?.length && o.variants.includes(x.label)) || vars[0]
  return Number(v?.price ?? o.precio?.default_price ?? o.default_price) || 0
}

// Niveles de planchado por paño, igual que en Presupuesto: el planchado se
// cobra como un porcentaje del pintado del mismo paño.
export const PLANCHADO_NIVELES = [
  { id: 'none',     label: 'Solo pintura', short: '—',      pct: 0   },
  { id: 'leve',     label: 'Leve',         short: 'Leve',   pct: 0.4 },
  { id: 'moderado', label: 'Moderado',     short: 'Mod.',   pct: 0.8 },
  { id: 'severo',   label: 'Severo',       short: 'Severo', pct: 1.2 },
]

// Descuento automático por cantidad de paños: 0% con uno, sube hasta 15% con
// el vehículo completo. Mismo cálculo que la cotización.
export const PLANCHADO_DESC_MAX_PCT = 15

export function descuentoPlanchado(elegidos, totalPanales) {
  if (elegidos < 2 || !totalPanales) return 0
  return Math.max(3, Math.round((elegidos / totalPanales) * PLANCHADO_DESC_MAX_PCT))
}
