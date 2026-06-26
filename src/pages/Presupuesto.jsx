import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { Edit2, Check, X, ChevronDown, ChevronUp, FileText, MessageCircle, PlusCircle, Save, Clock, Trash2 } from 'lucide-react'
import { NewTicketForm } from './Registro'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'

// ─── Configuración por defecto ────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  basePrices: { economy: 250, standard: 290, premium: 350 },
  panels: [
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
    { id: 'aleta_tra_izq',       label: 'Aleta Trasera Izq.',    mult: { auto: 1,   suv: 1.3, pickup: 1.4 } },
    { id: 'aleta_tra_der',       label: 'Aleta Trasera Der.',    mult: { auto: 1,   suv: 1.3, pickup: 1.4 } },
    { id: 'estribo_izq',         label: 'Estribo Izq.',          mult: { auto: 0.5, suv: 0.7, pickup: 0.8 } },
    { id: 'estribo_der',         label: 'Estribo Der.',          mult: { auto: 0.5, suv: 0.7, pickup: 0.8 } },
  ],
}

const BRANDS = [
  { tier: 'economy',  label: 'Economy',  brands: ['Toyota', 'Hyundai', 'Kia', 'Nissan', 'Chevrolet', 'Renault', 'Suzuki', 'Dacia', 'Fiat'] },
  { tier: 'standard', label: 'Standard', brands: ['Honda', 'Mazda', 'Ford', 'Volkswagen', 'Subaru', 'Mitsubishi', 'Peugeot', 'Citroën', 'Seat'] },
  { tier: 'premium',  label: 'Premium',  brands: ['BMW', 'Mercedes-Benz', 'Audi', 'Lexus', 'Volvo', 'Porsche', 'Jeep', 'Land Rover', 'Infiniti', 'Cadillac'] },
]

const VEHICLE_TYPES = [
  { id: 'auto',   label: 'Auto',   emoji: '🚗' },
  { id: 'suv',    label: 'SUV',    emoji: '🚙' },
  { id: 'pickup', label: 'Pickup', emoji: '🛻' },
]

const DAMAGE_LEVELS = [
  { id: 'none',     label: 'Solo pintura', short: '—',        pct: 0,   color: 'border-gray-200 text-gray-500 dark:border-gray-600 dark:text-gray-400' },
  { id: 'leve',     label: 'Leve',         short: 'Leve',     pct: 0.3, color: 'border-yellow-400 text-yellow-700 dark:border-yellow-600 dark:text-yellow-400' },
  { id: 'moderado', label: 'Moderado',     short: 'Mod.',     pct: 0.6, color: 'border-orange-400 text-orange-700 dark:border-orange-500 dark:text-orange-400' },
  { id: 'severo',   label: 'Severo',       short: 'Severo',   pct: 1.0, color: 'border-red-500 text-red-700 dark:border-red-500 dark:text-red-400' },
]

const LS_KEY = 'apexpro_presupuesto_config'
const SB_KEY = 'presupuesto_config'

const CATEGORIES = [
  { id: 'planchado',   label: 'Planchado',   icon: '🔨', sub: '& Pintura' },
  { id: 'ceramico',    label: 'Cerám/PPF',   icon: '✨', sub: 'Tratamientos' },
  { id: 'polarizados', label: 'Polarizados', icon: '🌟', sub: 'Láminas' },
  { id: 'lavados',     label: 'Lavados',     icon: '🚿', sub: '& Detailing' },
  { id: 'servicios',   label: 'Servicios',   icon: '🧰', sub: 'Adicionales' },
]

const CAT_VEHICLES = {
  ceramico:    [{ id: 'auto', label: 'Auto / HB' }, { id: 'suv', label: 'SUV' }, { id: 'pickup', label: 'Pickup' }],
  ppf:         [{ id: 'auto', label: 'Auto / HB' }, { id: 'suv', label: 'SUV' }, { id: 'pickup', label: 'Pickup' }],
  polarizados: [],
  lavados:     [], // se genera dinámicamente desde vehicleTypes del sistema
  servicios:   [],
}

// Mapeo de ticket vehicle_type.value → clave de precio en LAVADOS_DATA
const VT_TO_LAVADOS_KEY = {
  moto:             'auto',
  auto_exterior:    'auto',
  auto:             'auto',
  camioneta_small:  'suv',
  camioneta_large:  'suv_xl',
  offroad:          'pickup',
  otro:             'pickup_xl',
}

// Qué servicios de lavado se muestran según el tipo de vehículo del ticket
// null = mostrar todos
const VT_LAVADOS_FILTER = {
  moto:            ['estandar'],
  auto_exterior:   ['estandar'],
  auto:            ['estandar', 'offroad', 'offroad_full', 'detailing', 'pro_detallado'],
  camioneta_small: ['estandar', 'offroad', 'offroad_full', 'detailing', 'pro_detallado'],
  camioneta_large: ['estandar', 'offroad', 'offroad_full', 'detailing', 'pro_detallado'],
  offroad:         ['offroad', 'offroad_full', 'detailing', 'pro_detallado'],
  otro:            null,
}

const SERVICIOS_DATA = [
  // ── Precio fijo (no varía por vehículo) ──────────────────────────────────
  { id: 'sv_techo_g1',     name: 'Lavado de Techo G1',              price: 80  },
  { id: 'sv_techo_g2',     name: 'Lavado de Techo G2',              price: 90  },
  { id: 'sv_techo_g3',     name: 'Lavado de Techo G3',              price: 100 },
  { id: 'sv_ret_asientos', name: 'Retirada de asientos',            price: 60  },
  { id: 'sv_asientos_1f',  name: 'Lavado de asientos 1 Fila',       price: 40  },
  { id: 'sv_asientos_2f',  name: 'Lavado de asientos 2 Filas',      price: 80  },
  { id: 'sv_asientos_3f',  name: 'Lavado de asientos 3 Filas',      price: 110 },
  { id: 'sv_ext_cam',      name: 'Lavado Exterior Camioneta',       price: 25  },
  { id: 'sv_chasis',       name: 'Lavado Chasis V-Mol',             price: 50  },
  { id: 'sv_alumax',       name: 'Alumax y Removex',                price: 30  },
  { id: 'sv_ret_llantas',  name: 'Retirado de llantas',             price: 80  },
  { id: 'sv_det_interior', name: 'Detallado interior',              price: 90  },
  { id: 'sv_elixir',       name: 'Elixir CarPro',                   price: 20  },
  { id: 'sv_encerado',     name: 'Encerado Bleend 3 meses',         price: 20  },
  { id: 'sv_cer_g3',       name: 'Tratamiento Cerámico G3',         price: 100 },
  { id: 'sv_gliss',        name: 'Aplicación de Gliss Car Pro',     price: 100 },
  { id: 'sv_lav_piso',     name: 'Lavado de Piso',                  price: 80  },
  { id: 'sv_ret_alfombra', name: 'Retirado de Alfombra',            price: 40  },
  { id: 'sv_motor_basico', name: 'Lavado de Motor (Básico)',        price: 20  },
  { id: 'sv_motor_det',    name: 'Lavado de Motor (Detallado)',     price: 40  },
  { id: 'sv_berniz',       name: 'Berniz de Motor',                 price: 15  },
  { id: 'sv_cera_vonixx',  name: 'Cera en pasta Vonixx',           price: 20  },
  // ── Precio según vehículo ─────────────────────────────────────────────────
  { id: 'sv_ext_basico',   name: 'Lavado Exterior (Básico)',        prices: { auto: 25, suv: 30, pickup: 35, xl: 40 } },
  { id: 'sv_offroad',      name: 'Lavado OffRoad',                  prices: { auto: 55, suv: 60, pickup: 65, xl: 70 } },
  { id: 'sv_pul1',         name: 'Pulido 1 Paso',                   prices: { auto: 130, suv: 150, pickup: 170, xl: 170 } },
  { id: 'sv_pul3',         name: 'Pulido 3 Pasos',                  prices: { auto: 260, suv: 280, pickup: 300, xl: 300 } },
  { id: 'sv_desc',         name: 'Descontaminación',                prices: { auto: 120, suv: 140, pickup: 160, xl: 160 } },
  { id: 'sv_cer_cp2',      name: 'Cerámico CarPro 2 Años',          prices: { auto: 799, suv: 899, pickup: 999, xl: 999 } },
  { id: 'sv_cer_ap3',      name: 'Cerámico AutoPremium 3 Años',     prices: { auto: 499, suv: 599, pickup: 699, xl: 699 } },
]

const LAVADOS_DATA = [
  { id: 'estandar',     name: 'Apex Estándar',       tag: 'Básico',         time: '50 min', desc: 'Lavado por fuera · Limpieza de neumáticos · Aspirado de salón · Aplicación de acondicionador interiores',                                                     prices: { auto: 25,  suv: 30,  suv_xl: 35,  pickup: 35,  pickup_xl: 40  } },
  { id: 'offroad',      name: 'Apex Off-Road',        tag: 'Medio',          time: '1h 30m', desc: 'Lavado de chasis · Lavado de neumáticos · Lavado por fuera · Limpieza de parabrisas · Aspirado de salón · Aplicación de acondicionador interiores',           prices: { auto: 55,  suv: 60,  suv_xl: 65,  pickup: 65,  pickup_xl: 65  } },
  { id: 'offroad_full', name: 'Apex Off-Road Full',   tag: 'Completo',       time: '3h',     desc: 'Lavado de chasis con AluMax y Removex · Retirado y limpieza de neumáticos con AluMax y Removex · Limpieza de motor · Lavado por fuera · Aspirado de salón · Limpieza y aplicación de acondicionador interiores', prices: { auto: 160, suv: 170, suv_xl: 180, pickup: 180, pickup_xl: 180 } },
  { id: 'detailing',    name: 'Apex Detailing',       tag: 'Premium',        time: '7h',     desc: 'Todos los servicios Off-Road · Limpieza de piso · Limpieza de techo · Limpieza de asientos · Cera o elixir',                                                  prices: { auto: 350, suv: 380, suv_xl: 420, pickup: 420, pickup_xl: 420 } },
  { id: 'pro_detallado',name: 'Apex Pro Detallado',   tag: 'Ultra Premium',  time: '2 días', desc: 'Todos los servicios Off-Road Full (AluMax y Removex) · Retirado de llantas, asientos y piso · Limpieza de piso · Limpieza de techo · Limpieza de asientos · Detallado interior · Cera, elixir o berniz', prices: { auto: 490, suv: 540, suv_xl: 615, pickup: 615, pickup_xl: 615 } },
]

const CERAMICO_DATA = [
  { id: 'desc_quimica',     name: 'Descontaminación Química',   tag: 'Prep', desc: 'Elimina impurezas invisibles adheridas a la pintura',           prices: { auto: 60,  suv: 70,  pickup: 80  } },
  { id: 'desc_mecanica',    name: 'Descontaminación Mecánica',  tag: 'Prep', desc: 'Pintura completamente lisa al tacto, mejora brillo y acabado',  prices: { auto: 120, suv: 140, pickup: 160 } },
  { id: 'abrillantado',     name: 'Abrillantado Apex Pro',      tag: 'Prep', desc: 'Aumenta brillo, reduce micro-rayones, elimina opacidad',        prices: { auto: 130, suv: 150, pickup: 170 } },
  { id: 'correccion',       name: 'Corrección Apex Pro',        tag: 'Prep', desc: 'Elimina 90-95% de imperfecciones, acabado tipo espejo',         prices: { auto: 260, suv: 280, pickup: 300 } },
  { id: 'cer_miyavi_1a',    name: 'Cerámico Miyavi 1 Año',      tag: 'Paq',  desc: 'Descontam. + pulido 3 pasos + cerámico + aspirado interior',    prices: { auto: 350, suv: 400, pickup: 450 } },
  { id: 'cer_miyavi_1b',    name: 'Cerámico Miyavi 1 Año Plus', tag: 'Paq',  desc: 'Versión premium — pulido avanzado + cerámico 1 año',           prices: { auto: 400, suv: 450, pickup: 500 } },
  { id: 'cer_3a',           name: 'Cerámico 3 Años',            tag: 'Paq',  desc: 'Paquete completo con cerámico de larga duración 3 años',       prices: { auto: 599, suv: 699, pickup: 799 } },
  { id: 'cer_2a_premium',   name: 'Cerámico 2 Años Premium',    tag: 'Paq',  desc: 'Paquete premium con cerámico de 2 años',                       prices: { auto: 899, suv: 999, pickup: 1099} },
  { id: 'cer_carpro_3a',    name: 'Cerámico Carpro 3 Años',     tag: 'Paq',  desc: 'Cerámico Carpro alta gama, 3 años de garantía del producto',   prices: { auto: 999, suv: 1099,pickup: 1199} },
]

const PPF_DATA = [
  { id: 'ppf_full',     name: 'PPF Full Body',           desc: 'Todo el vehículo. Lavado premium + descontam. + pulido 3 pasos + PPF autoregenerativo. Regalo: PPF en radio o faros. Tiempo: 4 días', prices: { auto: 4700, suv: 5400, pickup: 5900 } },
  { id: 'ppf_zonas',    name: 'PPF Zonas de Impacto',    desc: 'Capot, parachoque delantero, guardabarros y faros. Regalo: PPF en manijas. Tiempo: 2 días',                                            prices: { auto: 2700, suv: 3100, pickup: 3400 } },
  { id: 'ppf_ceramico', name: 'PPF Zonas + Cerámico',    desc: 'PPF en zonas de impacto + cerámico Carpro 2 años en las demás zonas. Tiempo: 3 días',                                                  prices: { auto: 3200, suv: 3700, pickup: 3900 } },
]

const POLARIZADOS_DATA = [
  { id: 'appfilm_v',  brand: 'APPfilm Basic',          cobertura: 'Ventanas + Posterior', desc: 'Instalación profesional. Niveles: 5%, 20%, 35%, 50%, 70%',              price: 299  },
  { id: 'appfilm_f',  brand: 'APPfilm Basic',          cobertura: '+ Parabrisas',         desc: 'Instalación profesional. Niveles: 5%, 20%, 35%, 50%, 70%',              price: 350  },
  { id: 'lexen_v',    brand: 'Nanocerámico Lexen',     cobertura: 'Ventanas + Posterior', desc: 'Bloqueo UV, reducción de calor, garantía. Niveles: 5%–70%',            price: 440  },
  { id: 'lexen_f',    brand: 'Nanocerámico Lexen',     cobertura: '+ Parabrisas',         desc: 'Bloqueo UV, reducción de calor, garantía. Niveles: 5%–70%',            price: 640  },
  { id: 'protec_v',   brand: 'Nanocerámico Protec',    cobertura: 'Ventanas + Posterior', desc: 'UV, calor, garantía del producto premium. Niveles: 5%–70%',            price: 480  },
  { id: 'protec_f',   brand: 'Nanocerámico Protec',    cobertura: '+ Parabrisas',         desc: 'UV, calor, garantía del producto premium. Niveles: 5%–70%',            price: 680  },
  { id: '3m_v',       brand: '3M Coreano',             cobertura: 'Ventanas + Posterior', desc: 'Alta gama. Niveles: 5%–70%',                                           price: 700  },
  { id: '3m_f',       brand: '3M Coreano',             cobertura: '+ Parabrisas',         desc: 'Alta gama. Niveles: 5%–70%',                                           price: 900  },
  { id: '3m_usa_v',   brand: '3M Americano',           cobertura: 'Ventanas + Posterior', desc: 'Máxima calidad importado USA. Niveles: 5%–70%',                        price: 1400 },
]

function mergeConfig(saved) {
  if (!saved) return DEFAULT_CONFIG
  return {
    basePrices: { ...DEFAULT_CONFIG.basePrices, ...saved.basePrices },
    panels: DEFAULT_CONFIG.panels.map(p => {
      const sp = saved.panels?.find(x => x.id === p.id)
      return sp ? { ...p, mult: { ...p.mult, ...sp.mult } } : p
    }),
  }
}

function formatMoney(n) {
  return `S/ ${Number(n).toFixed(2)}`
}

// ─── Editar celda inline ──────────────────────────────────────────────────────
function EditableCell({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(value))

  function handleSave() {
    const n = parseFloat(val)
    if (isNaN(n) || n <= 0) { toast.error('Valor inválido'); return }
    onSave(n)
    setEditing(false)
  }

  if (!editing) return (
    <button onClick={() => { setVal(String(value)); setEditing(true) }}
      className="flex items-center gap-1 text-red-500 dark:text-red-400 font-mono text-xs hover:underline">
      {value}<Edit2 className="w-2.5 h-2.5" />
    </button>
  )
  return (
    <div className="flex items-center gap-1">
      <input type="number" step="0.1" min="0.1" value={val} onChange={e => setVal(e.target.value)}
        className="w-14 text-xs border border-red-400 rounded px-1 py-0.5 font-mono dark:bg-gray-800 dark:text-white"
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
        autoFocus />
      <button onClick={handleSave} className="text-green-600"><Check className="w-3.5 h-3.5" /></button>
      <button onClick={() => setEditing(false)} className="text-red-500"><X className="w-3.5 h-3.5" /></button>
    </div>
  )
}

function EditableTextCell({ label, value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  function handleSave() { if (val.trim()) { onSave(val.trim()); setEditing(false) } }
  if (!editing) return (
    <button onClick={() => { setVal(value); setEditing(true) }}
      className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors text-left">
      <Edit2 className="w-2.5 h-2.5 flex-shrink-0" /><span className="truncate max-w-[180px]">{label}</span>
    </button>
  )
  return (
    <div className="flex items-center gap-1">
      <input value={val} onChange={e => setVal(e.target.value)}
        className="flex-1 text-xs border border-blue-400 rounded px-1.5 py-0.5 dark:bg-gray-800 dark:text-white"
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
        autoFocus />
      <button onClick={handleSave} className="text-green-600 flex-shrink-0"><Check className="w-3 h-3" /></button>
      <button onClick={() => setEditing(false)} className="text-red-500 flex-shrink-0"><X className="w-3 h-3" /></button>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Presupuesto() {
  const { isAdmin, isDemo } = useAuth()
  const canAdmin = isAdmin || isDemo
  const { addTicket, workers = [], vehicleTypes = [] } = useApp()

  const [config, setConfig] = useState(() => mergeConfig(null))
  const [loading, setLoading] = useState(true)
  const [logoB64, setLogoB64] = useState(null)

  useEffect(() => {
    fetch('/logo.jpg')
      .then(r => r.blob())
      .then(blob => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob) }))
      .then(b64 => setLogoB64(b64))
      .catch(() => {})
  }, [])
  // ── categoría activa ──────────────────────────────────────────────────────
  const [category, setCategory] = useState('planchado')

  // ── planchado & pintura ──────────────────────────────────────────────────
  const [vehicleType, setVehicleType] = useState('auto')
  const [selectedTier, setSelectedTier] = useState('economy')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selected, setSelected] = useState({})
  const [damage, setDamage] = useState({})
  const [editingPrices, setEditingPrices] = useState(false)
  const [pricesDraft, setPricesDraft] = useState(config.basePrices)
  const [showBrands, setShowBrands] = useState(false)

  // ── otras categorías ─────────────────────────────────────────────────────
  const [catVehicle, setCatVehicle] = useState('auto')
  const [lavSubtype, setLavSubtype] = useState(null)
  const [lavItems, setLavItems] = useState([]) // lavados seleccionados directamente
  const [serviciosVehicle, setServiciosVehicle] = useState('auto')
  const [serviciosSelected, setServiciosSelected] = useState({})
  const [catSelected, setCatSelected] = useState({})
  const [catDiscountPct, setCatDiscountPct] = useState(0)
  const [catPriceOverrides, setCatPriceOverrides] = useState({})
  // catMeta: { overrides: { [id]: { name?, desc? } }, added: [{ id, category, name, desc, price?, prices? }], deleted: [id] }
  const [catMeta, setCatMeta] = useState({ overrides: {}, added: [], deleted: [] })
  const [addingService, setAddingService] = useState(null) // { category } cuando está abierto el form
  const [addForm, setAddForm] = useState({ name: '', desc: '', price: '' })

  // Cargar config desde Supabase
  useEffect(() => {
    async function load() {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) setConfig(mergeConfig(JSON.parse(raw)))

      const [{ data, error }, { data: catData2 }, { data: catMetaData }, { data: sqData }] = await Promise.all([
        supabase.from('app_settings').select('value').eq('key', SB_KEY).maybeSingle(),
        supabase.from('app_settings').select('value').eq('key', 'cat_prices').maybeSingle(),
        supabase.from('app_settings').select('value').eq('key', 'cat_meta').maybeSingle(),
        supabase.from('app_settings').select('value').eq('key', 'saved_quotes').maybeSingle(),
      ])

      if (error) toast.error(`Error al cargar: ${error.message}`)
      else if (data?.value) {
        const merged = mergeConfig(data.value)
        setConfig(merged)
        localStorage.setItem(LS_KEY, JSON.stringify(data.value))
      }
      if (catData2?.value) setCatPriceOverrides(catData2.value)
      if (catMetaData?.value) setCatMeta(m => ({ overrides: {}, added: [], deleted: [], ...m, ...catMetaData.value }))
      if (sqData?.value) {
        const now = Date.now()
        setSavedQuotes((sqData.value || []).filter(q => q.expires_at > now))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function saveCatPriceOverride(id, vehicleKey, newPrice) {
    const next = {
      ...catPriceOverrides,
      [id]: vehicleKey
        ? { ...(typeof catPriceOverrides[id] === 'object' ? catPriceOverrides[id] : {}), [vehicleKey]: newPrice }
        : newPrice,
    }
    setCatPriceOverrides(next)
    const { error } = await supabase.from('app_settings').upsert(
      { key: 'cat_prices', value: next, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    if (error) toast.error(`Error al guardar: ${error.message}`)
    else toast.success('Precio actualizado ✓')
  }

  async function saveCatMeta(next) {
    setCatMeta(next)
    const { error } = await supabase.from('app_settings').upsert(
      { key: 'cat_meta', value: next, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    if (error) toast.error(`Error al guardar: ${error.message}`)
    else toast.success('Guardado ✓')
  }

  function updateServiceField(id, field, value) {
    const next = { ...catMeta, overrides: { ...catMeta.overrides, [id]: { ...catMeta.overrides[id], [field]: value } } }
    saveCatMeta(next)
  }

  async function persistSavedQuotes(list) {
    setSavedQuotes(list)
    await supabase.from('app_settings').upsert(
      { key: 'saved_quotes', value: list, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  }

  function buildCurrentSnapshot(allSel, grandTot, discPct) {
    return {
      id: Date.now(),
      nombre: saveQuoteForm.nombre.trim(),
      placa: saveQuoteForm.placa.trim().toUpperCase(),
      worker_id: saveQuoteForm.worker_id || null,
      items: allSel.map(i => ({ label: i.label, price: i.price })),
      grand_total: grandTot,
      discount_pct: discPct,
      selected, catSelected, serviciosSelected,
      catVehicle, serviciosVehicle,
      manualItems, lavItems,
      catDiscountPct,
      created_at: Date.now(),
      expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }
  }

  async function saveQuote(allSel, grandTot, discPct) {
    if (!saveQuoteForm.nombre && !saveQuoteForm.placa) {
      toast.error('Ingresa nombre o placa del cliente')
      return
    }
    const quote = buildCurrentSnapshot(allSel, grandTot, discPct)
    const next = [...savedQuotes, quote]
    await persistSavedQuotes(next)
    setSaveQuoteModal(false)
    setSaveQuoteForm({ nombre: '', placa: '', worker_id: '' })
    toast.success('Cotización guardada por 7 días ✓')
  }

  async function deleteQuote(id) {
    const next = savedQuotes.filter(q => q.id !== id)
    await persistSavedQuotes(next)
    toast.success('Cotización eliminada')
  }

  function loadQuote(q) {
    setSelected(q.selected || {})
    setCatSelected(q.catSelected || {})
    setServiciosSelected(q.serviciosSelected || {})
    setCatVehicle(q.catVehicle || 'auto')
    setServiciosVehicle(q.serviciosVehicle || 'auto')
    setManualItems(q.manualItems || [])
    setLavItems(q.lavItems || [])
    setCatDiscountPct(q.catDiscountPct || 0)
    toast.success(`Cotización "${q.nombre || q.placa}" cargada ✓`)
  }

  function openSubcatConfig(s) {
    const items = s.subcats?.length
      ? s.subcats.map(x => ({ ...x }))
      : s.prices
        ? Object.entries(s.prices).map(([k]) => ({ key: k, label: SV_VK_LABELS[k] || k, price: getEffectivePrice(s, k) }))
        : [{ key: 'op1', label: '', price: '' }, { key: 'op2', label: '', price: '' }]
    setSubcatDraft({ group: s.subcatGroup || '', items })
    setSubcatConfigId(s.id)
  }

  function saveSubcatConfig(s) {
    const items = subcatDraft.items.filter(i => i.label.trim())
      .map((i, idx) => ({ key: i.key || `op${idx + 1}`, label: i.label.trim(), price: parseFloat(i.price) || 0 }))
    if (items.length === 0) { removeAllSubcats(s); return }
    const overrides = {
      ...catMeta.overrides,
      [s.id]: { ...catMeta.overrides[s.id], subcats: items, subcatGroup: subcatDraft.group, prices: null, price: null }
    }
    saveCatMeta({ ...catMeta, overrides })
    setSubcatConfigId(null)
  }

  function removeAllSubcats(s) {
    const overrides = { ...catMeta.overrides, [s.id]: { ...catMeta.overrides[s.id], subcats: null, prices: null, price: getEffectivePrice(s, 'auto') || getEffectivePrice(s, null) || 0 } }
    saveCatMeta({ ...catMeta, overrides })
    const { [s.id]: _r, ...rest } = catPriceOverrides
    setCatPriceOverrides(rest)
    supabase.from('app_settings').upsert({ key: 'cat_prices', value: rest, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    setSubcatConfigId(null)
  }

  function quickFillVehicle(s) {
    const flat = s.price ?? 0
    setSubcatDraft({ group: 'Tipo de vehículo', items: [
      { key: 'auto', label: 'Auto', price: flat },
      { key: 'suv', label: 'SUV', price: flat },
      { key: 'pickup', label: 'Pickup', price: flat },
      { key: 'xl', label: 'XL', price: flat },
    ]})
  }

  function deleteService(id) {
    const next = { ...catMeta, deleted: [...catMeta.deleted.filter(x => x !== id), id], added: catMeta.added.filter(a => a.id !== id) }
    saveCatMeta(next)
    setCatSelected(s => { const c = { ...s }; delete c[id]; return c })
  }

  function addNewService(cat) {
    const id = `custom_${Date.now()}`
    const vehicles = CAT_VEHICLES[cat] || []
    const prices = vehicles.length > 0 ? Object.fromEntries(vehicles.map(v => [v.id, parseFloat(addForm.price) || 0])) : undefined
    const price = vehicles.length === 0 ? parseFloat(addForm.price) || 0 : undefined
    const newSvc = { id, category: cat, name: addForm.name, desc: addForm.desc, ...(prices ? { prices } : { price }) }
    const next = { ...catMeta, added: [...catMeta.added, newSvc] }
    saveCatMeta(next)
    setAddingService(null)
    setAddForm({ name: '', desc: '', price: '' })
  }

  async function persistConfig(cfg) {
    setConfig(cfg)
    localStorage.setItem(LS_KEY, JSON.stringify(cfg))
    const { error } = await supabase.from('app_settings').upsert(
      { key: SB_KEY, value: cfg, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    if (error) {
      toast.error(`Error al guardar: ${error.message}`)
    } else {
      toast.success('Guardado en la nube ✓')
    }
  }

  const basePrice = config.basePrices[selectedTier]

  function updateMult(panelId, vt, val) {
    const newPanels = config.panels.map(p =>
      p.id === panelId ? { ...p, mult: { ...p.mult, [vt]: val } } : p
    )
    persistConfig({ ...config, panels: newPanels })
  }

  function saveBasePrices() {
    const e = parseFloat(pricesDraft.economy)
    const s = parseFloat(pricesDraft.standard)
    const pr = parseFloat(pricesDraft.premium)
    if ([e, s, pr].some(isNaN)) { toast.error('Valores inválidos'); return }
    if (e > s || s > pr) { toast.error('Economy ≤ Standard ≤ Premium'); return }
    persistConfig({ ...config, basePrices: { economy: e, standard: s, premium: pr } })
    setEditingPrices(false)
    toast.success('Precios guardados')
  }

  function togglePanel(id) {
    setSelected(s => ({ ...s, [id]: !s[id] }))
    setDamage(d => ({ ...d, [id]: d[id] || 'none' }))
  }

  function toggleAll() {
    const allSelected = config.panels.every(p => selected[p.id])
    const next = {}
    const dmg = {}
    config.panels.forEach(p => {
      next[p.id] = !allSelected
      if (!allSelected) dmg[p.id] = damage[p.id] || 'none'
    })
    setSelected(next)
    if (!allSelected) setDamage(d => ({ ...d, ...dmg }))
  }

  function setDamageLevel(id, level) {
    setDamage(d => ({ ...d, [id]: level }))
  }

  const rows = useMemo(() => config.panels.map(p => {
    const mult = p.mult[vehicleType]
    const paintPrice = Math.round(basePrice * mult)
    const dmgLevel = DAMAGE_LEVELS.find(d => d.id === (damage[p.id] || 'none'))
    const planchadoPrice = dmgLevel ? Math.round(paintPrice * dmgLevel.pct) : 0
    const price = paintPrice + planchadoPrice
    return { ...p, mult, paintPrice, planchadoPrice, price, damageId: damage[p.id] || 'none' }
  }), [config, vehicleType, basePrice, damage])

  const total = useMemo(() =>
    rows.filter(r => selected[r.id]).reduce((s, r) => s + r.price, 0),
    [rows, selected]
  )

  const selectedCount = Object.values(selected).filter(Boolean).length
  const tierBrand = BRANDS.find(b => b.tier === selectedTier)
  const vtLabel = VEHICLE_TYPES.find(v => v.id === vehicleType)

  // Descuento proporcional: 0% con 1 paño, sube linealmente hasta 25% con todos los paños
  const totalPanels = config.panels.length
  const autoDiscountPct = selectedCount >= 2 ? Math.max(3, Math.round((selectedCount / totalPanels) * 25)) : 0
  const [manualDiscountPct, setManualDiscountPct] = useState(null) // null = usar automático
  const discountPct = manualDiscountPct !== null ? manualDiscountPct : autoDiscountPct
  const discountAmt = Math.round(total * discountPct / 100)
  const totalFinal = total - discountAmt

  function applyMeta(services, cat) {
    const base = services
      .filter(s => !catMeta.deleted.includes(s.id))
      .map(s => ({ ...s, ...(catMeta.overrides[s.id] || {}) }))
    const extras = catMeta.added.filter(a => a.category === cat)
    const all = [...base, ...extras]
    const order = catMeta.order?.[cat]
    if (!order?.length) return all
    const orderMap = Object.fromEntries(order.map((id, i) => [id, i]))
    return [...all].sort((a, b) => (orderMap[a.id] ?? 9999) - (orderMap[b.id] ?? 9999))
  }

  function moveService(id, dir) {
    const cat = 'servicios'
    const data = applyMeta(SERVICIOS_DATA, cat)
    const ids = data.map(s => s.id)
    const idx = ids.indexOf(id)
    if (idx < 0) return
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= ids.length) return
    const next = [...ids]
    ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
    saveCatMeta({ ...catMeta, order: { ...catMeta.order, [cat]: next } })
  }

  // ── Filas para otras categorías ──────────────────────────────────────────
  const catData = useMemo(() => {
    if (category === 'ceramico')    return [
      ...applyMeta(CERAMICO_DATA, 'ceramico'),
      { id: '__ppf_divider__', _divider: true, label: 'PPF' },
      ...applyMeta(PPF_DATA, 'ppf'),
    ]
    if (category === 'polarizados') return applyMeta(POLARIZADOS_DATA, 'polarizados')
    if (category === 'lavados')     return applyMeta(LAVADOS_DATA, 'lavados')
    if (category === 'servicios')   return applyMeta(SERVICIOS_DATA, 'servicios')
    return []
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, catMeta])

  // Todas las filas seleccionadas en TODAS las categorías (no solo la activa)
  const ALL_CAT_DATA = useMemo(() => [
    ...applyMeta(CERAMICO_DATA, 'ceramico'),
    ...applyMeta(PPF_DATA, 'ppf'),
    ...applyMeta(POLARIZADOS_DATA, 'polarizados'),
    ...applyMeta(LAVADOS_DATA, 'lavados'),
    ...applyMeta(SERVICIOS_DATA, 'servicios'),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [catMeta])

  // Precio de variante → clave de precio en LAVADOS_DATA
  const VARIANT_PRICE_TO_LAV_KEY = { 15: 'auto', 25: 'auto', 30: 'suv', 35: 'suv_xl', 40: 'pickup_xl' }

  function getEffectivePrice(s, vehicleKey) {
    // Para lavados, el vehicleKey es el value del ticket → mapeamos a la clave de LAVADOS_DATA
    const lavadosIds = new Set(LAVADOS_DATA.map(x => x.id))
    const lavKey = lavSubtype?.lavKey ?? VT_TO_LAVADOS_KEY[vehicleKey] ?? vehicleKey
    const resolvedKey = lavadosIds.has(s.id) ? lavKey : vehicleKey
    const ov = catPriceOverrides[s.id]
    if (ov !== undefined) {
      if (typeof ov === 'object') return ov[resolvedKey] ?? s.prices?.[resolvedKey] ?? 0
      return ov
    }
    return s.price ?? (s.prices?.[resolvedKey] ?? 0)
  }

  const catRows = useMemo(() =>
    ALL_CAT_DATA
      .filter(s => catSelected[s.id])
      .map(s => {
        const vKey = s.id.startsWith('sv_') ? serviciosVehicle : catVehicle
        return {
          id: s.id,
          label: s.brand ? `${s.brand} — ${s.cobertura}` : s.name,
          price: getEffectivePrice(s, vKey),
          desc: s.desc,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ALL_CAT_DATA, catSelected, catVehicle, serviciosVehicle, catPriceOverrides, lavSubtype]
  )
  const catTotal = catRows.reduce((s, r) => s + r.price, 0)
  const catDiscountAmt = Math.round(catTotal * catDiscountPct / 100)
  const catTotalFinal = catTotal - catDiscountAmt

  const SV_VK_LABELS = { auto: 'Auto', suv: 'SUV', pickup: 'Pickup', xl: 'XL' }
  const [subcatConfigId, setSubcatConfigId] = useState(null)
  const [subcatDraft, setSubcatDraft] = useState({ group: '', items: [] })

  const serviciosRows = useMemo(() => {
    return Object.keys(serviciosSelected).filter(k => serviciosSelected[k]).map(key => {
      for (const svc of ALL_CAT_DATA) {
        if (!key.startsWith(svc.id + '_')) continue
        const subKey = key.slice(svc.id.length + 1)
        if (svc.subcats?.length) {
          const sc = svc.subcats.find(x => x.key === subKey)
          if (sc) return { id: key, label: `${svc.name} — ${sc.label}`, price: sc.price }
        }
        if (svc.prices && SV_VK_LABELS[subKey]) {
          return { id: key, label: `${svc.name} — ${SV_VK_LABELS[subKey]}`, price: getEffectivePrice(svc, subKey) }
        }
      }
      const svc = ALL_CAT_DATA.find(s => s.id === key)
      if (svc) return { id: key, label: svc.name, price: getEffectivePrice(svc, null) }
      return null
    }).filter(Boolean)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviciosSelected, ALL_CAT_DATA, catPriceOverrides])
  const serviciosTotal = serviciosRows.reduce((s, r) => s + r.price, 0)

  // Filas actuales de la categoría visible (para el catData useMemo que ya existe)
  const catRows_current = useMemo(() =>
    catData.filter(s => catSelected[s.id]).length,
    [catData, catSelected]
  )

  const [manualItems, setManualItems] = useState([])
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualDraft, setManualDraft] = useState({ titulo: '', descripcion: '', monto: '' })

  function addManualItem() {
    if (!manualDraft.titulo || !manualDraft.monto) { toast.error('Título y monto requeridos'); return }
    setManualItems(items => [...items, { id: Date.now(), ...manualDraft, monto: parseFloat(manualDraft.monto) || 0 }])
    setManualDraft({ titulo: '', descripcion: '', monto: '' })
    setShowManualForm(false)
  }

  const [exportModal, setExportModal] = useState(false)
  const [exportTarget, setExportTarget] = useState(null)
  const [ticketModal, setTicketModal] = useState(false)
  const [savedQuotes, setSavedQuotes] = useState([])
  const [saveQuoteModal, setSaveQuoteModal] = useState(false)
  const [saveQuoteForm, setSaveQuoteForm] = useState({ nombre: '', placa: '', worker_id: '' })
  const DEFAULT_CONDICIONES = 'Forma de pago: 50% de adelanto y 50% contra entrega. Vigencia: 15 dias calendario. Tiempo de entrega: maximo 3 dias habiles tras recibir el vehiculo. Precios incluyen IGV.'
  const [exportForm, setExportForm] = useState({ nombre: '', celular: '', ruc: '', marca: '', modelo: '', placa: '', anio: '', color: '', observaciones: '', condiciones: DEFAULT_CONDICIONES })
  const [cotizacionNum, setCotizacionNum] = useState(150)

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'cotizacion_counter').maybeSingle()
      .then(({ data }) => { if (data?.value?.num) setCotizacionNum(data.value.num) })
  }, [])

  async function getNextCotizacionNum() {
    const next = cotizacionNum + 1
    setCotizacionNum(next)
    await supabase.from('app_settings').upsert(
      { key: 'cotizacion_counter', value: { num: next }, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    return next
  }

  const manualTotal = manualItems.reduce((s, i) => s + i.monto, 0)
  const totalItemsSelected = selectedCount + catRows.length + serviciosRows.length + manualItems.length + lavItems.length

  function openExportModal(target) {
    if (totalItemsSelected === 0) { toast.error('Selecciona al menos un servicio'); return }
    setExportForm(f => ({ ...f, marca: selectedBrand || '' }))
    setExportTarget(target)
    setExportModal(true)
  }

  async function doExport() {
    setExportModal(false)
    if (exportTarget === 'whatsapp') buildWhatsApp()
    else {
      const num = await getNextCotizacionNum()
      buildPDF(num)
    }
  }


  function buildWhatsApp() {
    const { nombre, celular, marca, modelo, placa, anio, color, observaciones, condiciones } = exportForm
    const today = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const catVehicleLabel = CAT_VEHICLES[category]?.find(v => v.id === catVehicle)?.label || ''

    // Construir lista unificada de servicios
    const planchadoRows = rows.filter(r => selected[r.id])
    const allRows = [
      ...planchadoRows.map(r => ({
        label: r.damageId !== 'none'
          ? `${r.label} + Planchado (${DAMAGE_LEVELS.find(d => d.id === r.damageId)?.label})`
          : `Pintado de ${r.label}`,
        price: r.price,
      })),
      ...catRows.map(r => ({ label: r.label, price: r.price })),
      ...lavItems.map(r => ({ label: r.label, price: r.price })),
      ...manualItems.map(r => ({ label: r.titulo + (r.descripcion ? ` — ${r.descripcion}` : ''), price: r.monto })),
    ]
    const lavTotalWA = lavItems.reduce((s, i) => s + i.price, 0)
    const activeTotal = totalFinal + catTotalFinal + serviciosTotal + manualTotal + lavTotalWA

    const SEP = '--------------------'
    let msg = `*APEX PRO DETAILING* 🚗✨\n`
    msg += `📋 *COTIZACION*\n`
    msg += `📅 Fecha: ${today}\n`
    msg += `${SEP}\n`
    if (nombre) msg += `👤 *Cliente:* ${nombre}\n`
    if (celular) msg += `📞 *Celular:* ${celular}\n`
    const vehLine = [catVehicleLabel || vtLabel?.label, marca, modelo].filter(Boolean).join(' ')
    if (vehLine || placa || anio) {
      msg += `\n`
      if (vehLine)  msg += `🚗 *Vehiculo:* ${vehLine}\n`
      if (placa)    msg += `🔑 *Placa:* ${placa.toUpperCase()}\n`
      if (anio)     msg += `📅 *Año:* ${anio}${color ? `  Color: ${color}` : ''}\n`
    }
    msg += `\n✨ *SERVICIOS:*\n`
    msg += `${SEP}\n`
    allRows.forEach((r, idx) => {
      msg += `*${idx + 1}.* ${r.label}\n`
      msg += `   💰 ${formatMoney(r.price)}\n`
    })
    msg += `${SEP}\n`
    if (planchadoRows.length > 0 && discountPct > 0) {
      msg += `Subtotal: ${formatMoney(total)}\n`
      msg += `🎁 Descuento (${discountPct}%): -${formatMoney(discountAmt)}\n`
    }
    if (catTotalFinal < catTotal) {
      msg += `Subtotal servicios: ${formatMoney(catTotal)}\n`
      msg += `🎁 Descuento (${catDiscountPct}%): -${formatMoney(catDiscountAmt)}\n`
    }
    msg += `💵 *TOTAL: ${formatMoney(activeTotal)}*\n`
    msg += `${SEP}\n\n`
    if (observaciones) msg += `📝 *Nota:* ${observaciones}\n\n`
    if (condiciones) msg += `${condiciones}\n\n`
    else {
      msg += `✅ 50% adelanto / 50% contra entrega\n`
      msg += `⏳ Vigencia: 15 dias\n`
      msg += `💰 Precios incluyen IGV\n\n`
    }
    msg += `📍 Calle Idelfonzo Lopez N 700 Zamacola, Arequipa\n`
    msg += `📞 959240309`

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function buildPDF(numCotizacion) {
    const { nombre, celular, ruc, marca, modelo, placa, anio, color, observaciones, condiciones } = exportForm
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const W = 210
    const mL = 14, mR = 14
    const cW = W - mL - mR
    const today = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    let y = 0

    // ── Header blanco — formato Excel ────────────────────────────
    // Fondo blanco (default)

    // Logo izquierda — el logo ya incluye APEX-PRO y DETAILING
    if (logoB64) {
      doc.addImage(logoB64, 'PNG', mL, 2, 52, 52)
    } else {
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('APEX-PRO', mL, 18)
      doc.setTextColor(185, 28, 28)
      doc.setFontSize(9)
      doc.text('DETAILING', mL, 25)
    }

    // Dirección (a la derecha del logo)
    doc.setTextColor(40, 40, 40)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text('Calle Idelfonzo Lopez N 700 Zamacola', mL, 57)
    doc.text('Arequipa - Arequipa - Cerro Colorado', mL, 61)
    doc.text('Tel: 959240309', mL, 65)
    doc.text('Apexprodetailing0@gmail.com', mL, 69)

    // "COTIZACIÓN" centrado
    // "COTIZACIÓN" centrado
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('COTIZACIÓN', W / 2, 28, { align: 'center' })

    // Tabla N° / Fecha (derecha)
    const tX = W - mR - 55, tY = 38, tW = 55, rH = 9
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.4)
    doc.rect(tX, tY, tW, rH)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('N°', tX + 4, tY + 6)
    doc.setFont('helvetica', 'bold')
    doc.text(String(numCotizacion), tX + tW - 4, tY + 6, { align: 'right' })
    doc.rect(tX, tY + rH, tW, rH)
    doc.setFont('helvetica', 'normal')
    doc.text('Fecha:', tX + 4, tY + rH + 6)
    doc.text(today, tX + tW - 4, tY + rH + 6, { align: 'right' })

    // Línea separadora header
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.5)
    doc.line(mL, 74, W - mR, 74)

    y = 80

    // ── Datos Cliente ────────────────────────────────────────────
    const sectionHeader = (label, yPos) => {
      doc.setFillColor(189, 189, 189)
      doc.rect(mL, yPos, cW, 6.5, 'F')
      doc.setDrawColor(150, 150, 150)
      doc.setLineWidth(0.3)
      doc.rect(mL, yPos, cW, 6.5, 'S')
      doc.setTextColor(20, 20, 20)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.text(label, mL + 3, yPos + 4.5)
      return yPos + 6.5
    }

    const field = (label, value, x, yPos, w) => {
      doc.setTextColor(120, 120, 120)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(label, x, yPos)
      doc.setTextColor(20, 20, 20)
      doc.setFontSize(8.5)
      doc.setFont('helvetica', value ? 'bold' : 'normal')
      doc.text(value || '—', x, yPos + 5)
      doc.setDrawColor(220, 220, 220)
      doc.setLineWidth(0.3)
      doc.line(x, yPos + 6.5, x + w, yPos + 6.5)
    }

    y = sectionHeader('DATOS DEL CLIENTE', y)
    y += 4
    field('Nombre / Razon Social', nombre, mL, y, cW * 0.65)
    field('Celular', celular, mL + cW * 0.68, y, cW * 0.17)
    field('RUC / DNI', ruc, mL + cW * 0.88, y, cW * 0.12)
    y += 16

    y = sectionHeader('DATOS DEL VEHÍCULO', y)
    y += 4
    const vtName = vtLabel?.label || ''
    field('Marca', marca, mL, y, cW * 0.22)
    field('Modelo', modelo, mL + cW * 0.25, y, cW * 0.22)
    field('Placa', placa?.toUpperCase() || '', mL + cW * 0.50, y, cW * 0.17)
    field('Año', anio, mL + cW * 0.70, y, cW * 0.12)
    field('Color', color, mL + cW * 0.85, y, cW * 0.15)
    y += 16

    // ── Tabla de ítems ───────────────────────────────────────────
    y = sectionHeader('DESCRIPCIÓN DE SERVICIOS', y)

    // Cabecera tabla
    doc.setFillColor(220, 220, 220)
    doc.rect(mL, y, cW, 6, 'F')
    doc.setTextColor(40, 40, 40)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.text('N°', mL + 2, y + 4.2)
    doc.text('DESCRIPCIÓN DEL SERVICIO', mL + 12, y + 4.2)
    doc.text('TOTAL', W - mR - 2, y + 4.2, { align: 'right' })
    y += 6

    const planchadoRowsPDF = rows.filter(r => selected[r.id])
    const pdfRows = [
      ...planchadoRowsPDF.map(r => ({
        ...r,
        label: r.damageId !== 'none'
          ? `${r.label} + Planchado (${DAMAGE_LEVELS.find(d => d.id === r.damageId)?.label})`
          : `Pintado de ${r.label}`,
        _isPlanchado: true,
      })),
      ...catRows,
      ...lavItems.map(r => ({ id: r.id, label: r.label, price: r.price })),
      ...manualItems.map(r => ({ id: r.id, label: r.titulo + (r.descripcion ? ` — ${r.descripcion}` : ''), price: r.monto })),
    ]
    const lavTotalPDF = lavItems.reduce((s, i) => s + i.price, 0)
    const pdfTotal = totalFinal + catTotalFinal + serviciosTotal + manualTotal + lavTotalPDF
    const isPlanchado = false // rows already labeled above

    pdfRows.forEach((r, i) => {
      const hasDmg = isPlanchado && r.damageId !== 'none'
      const dmg = hasDmg ? DAMAGE_LEVELS.find(d => d.id === r.damageId) : null
      const rowH = hasDmg ? 11 : 7.5
      if (i % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(mL, y, cW, rowH, 'F') }
      doc.setDrawColor(235, 235, 235)
      doc.setLineWidth(0.2)
      doc.line(mL, y + rowH, mL + cW, y + rowH)
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      doc.text(`${i + 1}`, mL + 3, y + 5, { align: 'center' })
      const label = isPlanchado ? (hasDmg ? `${r.label} + Planchado` : `Pintado de ${r.label}`) : r.label
      doc.setTextColor(20, 20, 20)
      doc.setFontSize(8.5)
      const labelLines = doc.splitTextToSize(label, cW - 30)
      doc.text(labelLines, mL + 12, y + 5)
      if (hasDmg) {
        doc.setFontSize(7)
        doc.setTextColor(160, 80, 0)
        doc.text(`Daño ${dmg?.label} — planchado: ${formatMoney(r.planchadoPrice)} / pintura: ${formatMoney(r.paintPrice)}`, mL + 12, y + 9)
      }
      doc.setTextColor(20, 20, 20)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.text(formatMoney(r.price), W - mR - 2, y + 5, { align: 'right' })
      y += rowH
    })

    // Filas vacías hasta completar al menos 10 ítems
    const emptyRows = Math.max(0, 10 - pdfRows.length)
    for (let i = 0; i < emptyRows; i++) {
      const ii = pdfRows.length + i
      if (ii % 2 === 0) { doc.setFillColor(250, 250, 250); doc.rect(mL, y, cW, 7.5, 'F') }
      doc.setDrawColor(235, 235, 235)
      doc.line(mL, y + 7.5, mL + cW, y + 7.5)
      doc.setTextColor(180, 180, 180)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      doc.text(`${ii + 1}`, mL + 3, y + 5, { align: 'center' })
      y += 7.5
    }
    y += 2

    // Subtotal / descuento / total
    const numCol = W - mR - 35
    if (planchadoRowsPDF.length > 0 && discountPct > 0) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text('Subtotal Planchado & Pintura:', numCol, y + 5, { align: 'right' })
      doc.text(formatMoney(total), W - mR - 2, y + 5, { align: 'right' })
      y += 7
      doc.setFillColor(255, 240, 240)
      doc.rect(mL, y, cW, 7, 'F')
      doc.setTextColor(185, 28, 28)
      doc.setFont('helvetica', 'bold')
      doc.text(`Descuento Planchado & Pintura (${discountPct}%):`, numCol, y + 5, { align: 'right' })
      doc.text(`-${formatMoney(discountAmt)}`, W - mR - 2, y + 5, { align: 'right' })
      y += 9
    }
    // Descuento de servicios adicionales (no planchado)
    if (catRows.length > 0 && catDiscountPct > 0) {
      // Detectar qué categorías hay en catRows
      const ceramicoIds = new Set(CERAMICO_DATA.map(x => x.id))
      const ppfIds = new Set(PPF_DATA.map(x => x.id))
      const polIds = new Set(POLARIZADOS_DATA.map(x => x.id))
      const lavIds = new Set(LAVADOS_DATA.map(x => x.id))
      const catNames = []
      if (catRows.some(r => ceramicoIds.has(r.id))) catNames.push('Ceramico')
      if (catRows.some(r => ppfIds.has(r.id))) catNames.push('PPF')
      if (catRows.some(r => polIds.has(r.id))) catNames.push('Polarizados')
      if (catRows.some(r => lavIds.has(r.id))) catNames.push('Lavados')
      const catLabel = catNames.join(' / ')
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text(`Subtotal ${catLabel}:`, numCol, y + 5, { align: 'right' })
      doc.text(formatMoney(catTotal), W - mR - 2, y + 5, { align: 'right' })
      y += 7
      doc.setFillColor(255, 240, 240)
      doc.rect(mL, y, cW, 7, 'F')
      doc.setTextColor(185, 28, 28)
      doc.setFont('helvetica', 'bold')
      doc.text(`Descuento ${catLabel} (${catDiscountPct}%):`, numCol, y + 5, { align: 'right' })
      doc.text(`-${formatMoney(catDiscountAmt)}`, W - mR - 2, y + 5, { align: 'right' })
      y += 9
    }
    doc.setFillColor(189, 189, 189)
    doc.rect(mL, y, cW, 9, 'F')
    doc.setDrawColor(150, 150, 150)
    doc.setLineWidth(0.3)
    doc.rect(mL, y, cW, 9, 'S')
    doc.setTextColor(20, 20, 20)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL:', numCol, y + 6.3, { align: 'right' })
    doc.text(formatMoney(pdfTotal), W - mR - 2, y + 6.3, { align: 'right' })
    y += 13

    // Observaciones
    if (observaciones) {
      doc.setFillColor(245, 245, 245)
      doc.rect(mL, y, cW, 10, 'F')
      doc.setTextColor(80, 80, 80)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.text('Observaciones:', mL + 2, y + 5)
      doc.setFont('helvetica', 'normal')
      doc.text(observaciones, mL + 28, y + 5)
      y += 13
    }

    // Condiciones
    if (condiciones) {
      const condLines = doc.splitTextToSize(condiciones, cW - 4)
      const condH = Math.max(10, condLines.length * 4.5 + 4)
      doc.setFillColor(245, 245, 245)
      doc.rect(mL, y, cW, condH, 'F')
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'italic')
      doc.text(condLines, mL + 2, y + 4.5)
      y += condH + 4
    }

    // Firmas
    const col1 = mL, col2 = mL + cW / 2 + 5
    const sigW = cW / 2 - 10
    doc.setDrawColor(160, 160, 160)
    doc.setLineWidth(0.4)
    doc.line(col1, y + 14, col1 + sigW, y + 14)
    doc.line(col2, y + 14, col2 + sigW, y + 14)
    doc.setTextColor(80, 80, 80)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.text('Gustavo Pariente', col1, y + 18)
    doc.setFont('helvetica', 'normal')
    doc.text('Firma Asesor', col1, y + 22)
    doc.text('Firma Cliente', col2, y + 18)

    // Footer
    doc.setFillColor(189, 189, 189)
    doc.rect(0, 290, W, 7, 'F')
    doc.setTextColor(40, 40, 40)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('Apex Pro Detailing  |  Calle Idelfonzo Lopez N° 700 Zamacola  |  959 240 309  |  Apexprodetailing0@gmail.com', W / 2, 294.5, { align: 'center' })

    doc.save(`cotizacion-apexpro-${today.replace(/\//g, '-')}.pdf`)
    toast.success('PDF descargado')
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-8">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-red-600 via-red-700 to-gray-900 p-5 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px)' }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-6 bg-white rounded-full opacity-80" />
            <h1 className="text-xl font-black tracking-tight">PRESUPUESTO</h1>
          </div>
          <p className="text-red-200 text-sm">
            {CATEGORIES.find(c => c.id === category)?.label} {CATEGORIES.find(c => c.id === category)?.sub} · Apex Pro
          </p>
        </div>
      </div>

      {/* Tabs de categoría */}
      <div className="grid grid-cols-5 gap-2">
        {CATEGORIES.map(cat => {
          const isActive = category === cat.id
          const ceramicoPpfIds = new Set([...CERAMICO_DATA, ...PPF_DATA].map(s => s.id))
          const hasSelected = cat.id === 'planchado'
            ? selectedCount > 0
            : catRows.some(r => {
                if (cat.id === 'ceramico') return ceramicoPpfIds.has(r.id)
                const src = cat.id === 'polarizados' ? POLARIZADOS_DATA : cat.id === 'lavados' ? LAVADOS_DATA : SERVICIOS_DATA
                return src.some(s => s.id === r.id)
              })
          return (
            <button key={cat.id} onClick={() => setCategory(cat.id)}
              className={`relative flex flex-col items-center justify-center gap-1 py-3 rounded-2xl text-xs font-bold transition-all active:scale-95 ${
                isActive
                  ? 'bg-red-600 text-white shadow-lg shadow-red-300 dark:shadow-red-900/40'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
              }`}>
              {hasSelected && (
                <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${isActive ? 'bg-white' : 'bg-red-500'}`} />
              )}
              <span className="text-xl leading-none">{cat.icon}</span>
              <span className="text-[10px] leading-tight text-center">{cat.label}</span>
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-4 text-xs text-gray-400 gap-2">
          <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
          Cargando configuración...
        </div>
      )}

      {/* ── UI otras categorías ─────────────────────────────────── */}
      {category !== 'planchado' && (() => {
        const isLav = category === 'lavados'
        const vehicles = isLav
          ? vehicleTypes.filter(v => v.active !== false).map(v => ({ id: v.value, label: `${v.emoji || ''} ${v.label}`.trim() }))
          : (CAT_VEHICLES[category] || [])
        const isPol = category === 'polarizados'
        const isSv = category === 'servicios'
        const activeVehicle = isSv ? serviciosVehicle : catVehicle
        const setActiveVehicle = isSv ? setServiciosVehicle : setCatVehicle
        const allowedIds = isLav ? VT_LAVADOS_FILTER[activeVehicle] : null
        const data = (isLav && allowedIds) ? catData.filter(s => !s._divider && allowedIds.includes(s.id)) : catData

        return (
          <div className="space-y-3">
            {/* Selector de vehículo */}
            {vehicles.length > 0 && (
              <div className="card">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tipo de vehículo</p>
                <div className="flex gap-2 flex-wrap">
                  {vehicles.map(v => {
                    const vtObj = vehicleTypes.find(vt => vt.value === v.id)
                    const hasVariants = isLav && vtObj?.variants?.length > 0
                    const isActiveVT = activeVehicle === v.id
                    // Si no tiene variantes, está "en carrito" si existe en lavItems
                    const lavKey = `lav_${v.id}`
                    const inCart = !hasVariants && lavItems.some(i => i.id === lavKey)
                    return (
                      <button key={v.id} onClick={() => {
                        setActiveVehicle(v.id)
                        setLavSubtype(null)
                        if (isLav && !hasVariants) {
                          // toggle directo en lavItems
                          if (inCart) {
                            setLavItems(items => items.filter(i => i.id !== lavKey))
                          } else {
                            setLavItems(items => [...items, {
                              id: lavKey,
                              label: v.label.trim(),
                              price: vtObj?.default_price || 0,
                              vtValue: v.id,
                            }])
                          }
                        }
                      }}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                          inCart
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                            : isActiveVT
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                              : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                        }`}>
                        {v.label}
                        {!hasVariants && vtObj?.default_price ? ` · S/${vtObj.default_price}` : ''}
                      </button>
                    )
                  })}
                </div>
                {isLav && (() => {
                  const vtObj = vehicleTypes.find(v => v.value === activeVehicle)
                  if (!vtObj?.variants?.length) return null
                  return (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Subtipo</p>
                      <div className="flex flex-wrap gap-1.5">
                        {vtObj.variants.map((variant, i) => {
                          const vKey = `lav_${activeVehicle}_${variant.label}`
                          const inCartV = lavItems.some(it => it.id === vKey)
                          return (
                            <button key={i} onClick={() => {
                              if (inCartV) {
                                setLavItems(items => items.filter(it => it.id !== vKey))
                              } else {
                                setLavItems(items => [...items, {
                                  id: vKey,
                                  label: `${vtObj.label} — ${variant.label}`,
                                  price: variant.price,
                                  vtValue: activeVehicle,
                                }])
                              }
                            }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                inCartV
                                  ? 'border-green-500 bg-green-500 text-white'
                                  : 'border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                              }`}>
                              {variant.label} · S/{variant.price}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Servicios — oculto para lavados (se agregan desde los chips de VT) */}
            {!isLav && <div className="card space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Servicios disponibles</p>
                {(Object.values(isSv ? serviciosSelected : catSelected).some(Boolean)) && (
                  <button onClick={() => isSv ? setServiciosSelected({}) : setCatSelected({})}
                    className="text-xs text-red-500">Limpiar</button>
                )}
              </div>

              {isPol ? (
                // Polarizados: agrupados por marca
                Object.entries(
                  POLARIZADOS_DATA.reduce((acc, s) => {
                    if (!acc[s.brand]) acc[s.brand] = []
                    acc[s.brand].push(s)
                    return acc
                  }, {})
                ).map(([brand, items]) => (
                  <div key={brand} className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 dark:bg-gray-800 px-3 py-1.5">
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{brand}</p>
                    </div>
                    {items.map(s => (
                      <button key={s.id} onClick={() => setCatSelected(p => ({ ...p, [s.id]: !p[s.id] }))}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 border-t border-gray-100 dark:border-gray-700 text-left transition-all ${
                          catSelected[s.id] ? 'bg-red-50 dark:bg-red-900/10' : 'bg-white dark:bg-gray-900'
                        }`}>
                        <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                          catSelected[s.id] ? 'bg-red-600 border-red-600' : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {catSelected[s.id] && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{s.cobertura}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{s.desc}</p>
                        </div>
                        <div className="flex-shrink-0 flex flex-col items-end gap-0.5" onClick={e => e.stopPropagation()}>
                          <p className="text-sm font-bold text-red-600 dark:text-red-400">{formatMoney(getEffectivePrice(s, activeVehicle))}</p>
                          {canAdmin && (
                            <EditableCell value={getEffectivePrice(s, activeVehicle)}
                              onSave={v => saveCatPriceOverride(s.id, null, v)} />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ))
              ) : (
                data.map(s => {
                  if (s._divider) return (
                    <div key={s.id} className="flex items-center gap-2 py-1">
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{s.label}</span>
                      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    </div>
                  )
                  const hasVehiclePrices = !!s.prices && isSv
                  const hasCustomSubcats = isSv && !!s.subcats?.length
                  const hasSubcats = hasVehiclePrices || hasCustomSubcats
                  const price = hasSubcats ? null : getEffectivePrice(s, activeVehicle)
                  const vKey = s.prices && !isSv ? activeVehicle : null
                  const anyChipSel = hasSubcats && (
                    hasCustomSubcats
                      ? s.subcats.some(sc => serviciosSelected[`${s.id}_${sc.key}`])
                      : Object.keys(s.prices).some(vk => serviciosSelected[`${s.id}_${vk}`])
                  )
                  const isSelected = isSv ? (hasSubcats ? anyChipSel : serviciosSelected[s.id]) : catSelected[s.id]
                  const chips = hasCustomSubcats
                    ? s.subcats.map(sc => ({ key: sc.key, label: sc.label, price: sc.price }))
                    : hasVehiclePrices
                      ? Object.entries(s.prices).map(([vk]) => ({ key: vk, label: SV_VK_LABELS[vk] || vk, price: getEffectivePrice(s, vk) }))
                      : null
                  const isConfiguring = subcatConfigId === s.id
                  return (
                    <div key={s.id} className={`rounded-xl border transition-all ${
                      isSelected
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    }`}>
                      {hasSubcats ? (
                        <div className="p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-1">{s.name}</p>
                            {s.subcatGroup && <span className="text-[10px] text-indigo-500 font-semibold">{s.subcatGroup}</span>}
                            {s.desc && <p className="text-xs text-gray-400 truncate">{s.desc}</p>}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {chips.map(chip => {
                              const chipKey = `${s.id}_${chip.key}`
                              const chipSel = !!serviciosSelected[chipKey]
                              return (
                                <button key={chip.key} onClick={() => setServiciosSelected(p => ({ ...p, [chipKey]: !p[chipKey] }))}
                                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                                    chipSel
                                      ? 'bg-indigo-600 border-indigo-600 text-white'
                                      : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:border-indigo-400'
                                  }`}>
                                  {chip.label} · S/{chip.price}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => isSv
                          ? setServiciosSelected(p => ({ ...p, [s.id]: !p[s.id] }))
                          : setCatSelected(p => ({ ...p, [s.id]: !p[s.id] }))}
                          className="w-full flex items-center gap-3 p-3 text-left">
                          <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                            isSelected ? 'bg-red-600 border-red-600' : 'border-gray-300 dark:border-gray-600'
                          }`}>
                            {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{s.name}</p>
                              {s.tag && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                  s.tag === 'Paq' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : s.tag === 'Prep' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                  : s.tag === 'Premium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                }`}>{s.tag}</span>
                              )}
                              {s.time && <span className="text-[10px] text-gray-400">⏱ {s.time}</span>}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{s.desc}</p>
                          </div>
                          <div className="flex-shrink-0 flex flex-col items-end gap-0.5" onClick={e => e.stopPropagation()}>
                            <p className="text-sm font-bold text-red-600 dark:text-red-400">{formatMoney(price)}</p>
                            {canAdmin && (
                              <EditableCell value={price} onSave={v => saveCatPriceOverride(s.id, vKey, v)} />
                            )}
                          </div>
                        </button>
                      )}
                      {canAdmin && (
                        <div className="border-t border-gray-100 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                          {isConfiguring ? (
                            /* ── Inline subcat config ── */
                            <div className="p-3 space-y-2 bg-indigo-50 dark:bg-indigo-900/10">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex-1">Configurar subcategorías</p>
                                <button onClick={() => quickFillVehicle(s)} className="text-[10px] px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 border border-indigo-200 text-indigo-600 font-semibold">Por vehículo</button>
                              </div>
                              <input placeholder="Nombre del grupo (ej: Nivel de suciedad)"
                                value={subcatDraft.group}
                                onChange={e => setSubcatDraft(d => ({ ...d, group: e.target.value }))}
                                className="w-full text-xs border border-indigo-200 dark:border-indigo-700 rounded-lg px-2.5 py-1.5 dark:bg-gray-800 dark:text-white" />
                              {subcatDraft.items.map((item, idx) => (
                                <div key={idx} className="flex gap-1.5 items-center">
                                  <input placeholder="Etiqueta (ej: Bajo)" value={item.label}
                                    onChange={e => setSubcatDraft(d => { const items = [...d.items]; items[idx] = { ...items[idx], label: e.target.value }; return { ...d, items } })}
                                    className="flex-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 dark:bg-gray-800 dark:text-white" />
                                  <input placeholder="S/" type="number" value={item.price}
                                    onChange={e => setSubcatDraft(d => { const items = [...d.items]; items[idx] = { ...items[idx], price: e.target.value }; return { ...d, items } })}
                                    className="w-20 text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 dark:bg-gray-800 dark:text-white" />
                                  <button onClick={() => setSubcatDraft(d => ({ ...d, items: d.items.filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                                </div>
                              ))}
                              <button onClick={() => setSubcatDraft(d => ({ ...d, items: [...d.items, { key: `op${Date.now()}`, label: '', price: '' }] }))}
                                className="text-xs text-indigo-600 font-semibold">+ Agregar opción</button>
                              <div className="flex gap-2 pt-1">
                                <button onClick={() => saveSubcatConfig(s)} className="flex-1 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold">Guardar</button>
                                {hasSubcats && <button onClick={() => removeAllSubcats(s)} className="px-3 py-1.5 rounded-xl border border-red-300 text-red-500 text-xs font-semibold">Quitar</button>}
                                <button onClick={() => setSubcatConfigId(null)} className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-500 text-xs">Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-3 px-3 pb-2 pt-1.5">
                              <div className="flex-1 space-y-1">
                                <EditableTextCell label="Nombre" value={s.name} onSave={v => updateServiceField(s.id, 'name', v)} />
                                <EditableTextCell label="Descripción" value={s.desc} onSave={v => updateServiceField(s.id, 'desc', v)} />
                                <EditableTextCell label="Tiempo (ej: 50 min)" value={s.time} onSave={v => updateServiceField(s.id, 'time', v || null)} />
                                {isSv && (
                                  <button onClick={() => openSubcatConfig(s)}
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                                      hasSubcats
                                        ? 'border-indigo-300 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                                        : 'border-gray-200 text-gray-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                                    }`}>
                                    {hasSubcats ? `✎ Editar subcategorías${s.subcatGroup ? ` (${s.subcatGroup})` : ''}` : '+ Agregar subcategorías'}
                                  </button>
                                )}
                              </div>
                              {isSv && (
                                <div className="flex flex-col gap-0.5">
                                  <button onClick={() => moveService(s.id, -1)} className="p-0.5 text-gray-300 hover:text-indigo-500 transition-colors" title="Mover arriba">
                                    <ChevronUp className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => moveService(s.id, 1)} className="p-0.5 text-gray-300 hover:text-indigo-500 transition-colors" title="Mover abajo">
                                    <ChevronDown className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                              <button onClick={() => { if (confirm(`¿Eliminar "${s.name}"?`)) deleteService(s.id) }}
                                className="self-start mt-0.5 text-red-400 hover:text-red-600 transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}

              {/* Agregar nuevo servicio (solo admin) */}
              {canAdmin && (
                addingService === category ? (
                  <div className="border-2 border-dashed border-red-300 dark:border-red-700 rounded-xl p-3 space-y-2" onClick={e => e.stopPropagation()}>
                    <p className="text-xs font-bold text-red-600">Nuevo servicio</p>
                    <input placeholder="Nombre del servicio" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-800 dark:text-white" />
                    <input placeholder="Descripción breve" value={addForm.desc} onChange={e => setAddForm(f => ({ ...f, desc: e.target.value }))}
                      className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-800 dark:text-white" />
                    <input placeholder="Precio (S/)" type="number" value={addForm.price} onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))}
                      className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-800 dark:text-white" />
                    <div className="flex gap-2">
                      <button onClick={() => { if (!addForm.name || !addForm.price) { toast.error('Nombre y precio requeridos'); return } addNewService(category) }}
                        className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-bold">Agregar</button>
                      <button onClick={() => { setAddingService(null); setAddForm({ name: '', desc: '', price: '' }) }}
                        className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-500">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setAddingService(category); setAddForm({ name: '', desc: '', price: '' }) }}
                    className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 text-sm hover:border-red-300 hover:text-red-500 transition-colors flex items-center justify-center gap-1.5">
                    <span className="text-lg leading-none">+</span> Agregar servicio
                  </button>
                )
              )}
            </div>}

            {/* Descuento para servicios no-planchado */}
            {(catRows.length > 0 || lavItems.length > 0) && (
              <div className="card">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Descuento</p>
                <div className="flex gap-2">
                  {[0, 5, 10, 15, 20, 25, 30].map(pct => (
                    <button key={pct} onClick={() => setCatDiscountPct(pct)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        catDiscountPct === pct
                          ? 'border-red-500 bg-red-600 text-white'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                      }`}>
                      {pct === 0 ? 'Sin desc.' : `${pct}%`}
                    </button>
                  ))}
                </div>
                {catDiscountPct > 0 && (() => {
                  const bruto = catTotal + serviciosTotal + manualTotal + lavItems.reduce((s, i) => s + i.price, 0)
                  const disc = Math.round(bruto * catDiscountPct / 100)
                  return (
                    <>
                      <div className="flex justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                        <span className="text-gray-500">Subtotal</span><span>{formatMoney(bruto)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-green-600 font-semibold">
                        <span>Descuento {catDiscountPct}%</span><span>-{formatMoney(disc)}</span>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}

            {/* Ítem personalizado */}
            <div className="card">
              {showManualForm ? (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">✏️ Ítem personalizado</p>
                  <input className="input text-sm py-1.5 w-full" placeholder="Título (ej: Tratamiento especial)"
                    value={manualDraft.titulo} onChange={e => setManualDraft(d => ({ ...d, titulo: e.target.value }))} />
                  <input className="input text-sm py-1.5 w-full" placeholder="Descripción (opcional)"
                    value={manualDraft.descripcion} onChange={e => setManualDraft(d => ({ ...d, descripcion: e.target.value }))} />
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1 flex-1">
                      <span className="text-xs text-gray-500">S/</span>
                      <input type="number" className="input text-sm py-1.5 flex-1" placeholder="0.00"
                        value={manualDraft.monto} onChange={e => setManualDraft(d => ({ ...d, monto: e.target.value }))} />
                    </div>
                    <button onClick={addManualItem} className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold">Agregar</button>
                    <button onClick={() => { setShowManualForm(false); setManualDraft({ titulo: '', descripcion: '', monto: '' }) }}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 text-sm">✕</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowManualForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-blue-300 dark:border-blue-700 text-blue-500 text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                  ✏️ Agregar ítem personalizado
                </button>
              )}
              {manualItems.length > 0 && (
                <div className="mt-2 space-y-1.5 pt-2 border-t border-gray-100 dark:border-gray-800">
                  {manualItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2">
                      <button onClick={() => setManualItems(items => items.filter(i => i.id !== item.id))}
                        className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200">
                        <X className="w-3 h-3" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{item.titulo}</p>
                        {item.descripcion && <p className="text-[10px] text-gray-400 truncate">{item.descripcion}</p>}
                      </div>
                      <p className="text-xs font-bold text-blue-600">{formatMoney(item.monto)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )
      })()}

      {/* ── Planchado & Pintura UI (existente) ─────────────────── */}
      {category === 'planchado' && (<><div className="card space-y-4">
        {/* Tipo vehículo */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tipo de vehículo</p>
          <div className="grid grid-cols-3 gap-2">
            {VEHICLE_TYPES.map(vt => (
              <button key={vt.id} onClick={() => setVehicleType(vt.id)}
                className={`py-2.5 rounded-xl border text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${
                  vehicleType === vt.id
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                <span>{vt.emoji}</span> {vt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tier de marca */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Categoría de marca</p>
          <div className="grid grid-cols-3 gap-2">
            {BRANDS.map(b => (
              <button key={b.tier} onClick={() => { setSelectedTier(b.tier); setSelectedBrand('') }}
                className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                  selectedTier === b.tier
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                {b.label}
                <div className="text-[10px] font-normal mt-0.5 opacity-70">{formatMoney(config.basePrices[b.tier])}/paño</div>
              </button>
            ))}
          </div>
        </div>

        {/* Selector de marca específica */}
        <div>
          <button onClick={() => setShowBrands(v => !v)}
            className="w-full flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 py-1">
            <span className="font-medium">{selectedBrand || `Marca — ${tierBrand?.label}`}</span>
            {showBrands ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showBrands && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {BRANDS.map(b => b.brands.map(brand => (
                <button key={brand}
                  onClick={() => {
                    setSelectedBrand(brand)
                    setSelectedTier(b.tier)
                    setShowBrands(false)
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    selectedBrand === brand
                      ? 'bg-red-600 text-white border-red-600'
                      : b.tier === 'premium'
                        ? 'border-amber-300 text-amber-700 dark:text-amber-400 dark:border-amber-700'
                        : b.tier === 'standard'
                          ? 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300'
                          : 'border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400'
                  }`}>
                  {brand}
                </button>
              )))}
            </div>
          )}
        </div>

        {/* Precio base editable (admin) */}
        {canAdmin && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Precio base por paño</p>
              {!editingPrices
                ? <button onClick={() => { setPricesDraft({ ...config.basePrices }); setEditingPrices(true) }}
                    className="text-xs text-red-600 flex items-center gap-1"><Edit2 className="w-3 h-3" />Editar</button>
                : <div className="flex gap-2">
                    <button onClick={saveBasePrices} className="text-xs text-green-600 font-semibold">Guardar</button>
                    <button onClick={() => setEditingPrices(false)} className="text-xs text-gray-400">Cancelar</button>
                  </div>
              }
            </div>
            <div className="grid grid-cols-3 gap-2">
              {BRANDS.map(b => (
                <div key={b.tier} className="text-center">
                  <p className="text-[10px] text-gray-400 mb-1">{b.label}</p>
                  {editingPrices
                    ? <input type="number" min="100" max="1000" step="10"
                        value={pricesDraft[b.tier]}
                        onChange={e => setPricesDraft(d => ({ ...d, [b.tier]: e.target.value }))}
                        className="w-full text-xs text-center border border-red-400 rounded-lg px-1 py-1 font-mono dark:bg-gray-800 dark:text-white" />
                    : <p className="text-sm font-bold text-gray-900 dark:text-white">{formatMoney(config.basePrices[b.tier])}</p>
                  }
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabla de paños */}
      <div className="card overflow-hidden p-0">
        {/* Header tabla */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <p className="font-bold text-gray-900 dark:text-white text-sm">Paños del vehículo</p>
            <p className="text-xs text-gray-500">Base: {formatMoney(basePrice)}/paño · {vtLabel?.emoji} {vtLabel?.label}{selectedBrand ? ` · ${selectedBrand}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedCount > 0 && (
              <button onClick={() => { setSelected({}); setDamage({}) }}
                className="text-xs text-gray-400 dark:text-gray-500 font-semibold px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                Limpiar
              </button>
            )}
            <button onClick={toggleAll}
              className="text-xs text-red-600 dark:text-red-400 font-semibold px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20">
              {config.panels.every(p => selected[p.id]) ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
          </div>
        </div>

        {/* Columnas header */}
        <div className={`grid gap-0 text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 ${canAdmin ? 'grid-cols-[1fr_auto_auto_auto]' : 'grid-cols-[1fr_auto_auto]'}`}>
          <span>Paño</span>
          {canAdmin && <span className="w-16 text-center">Mult.</span>}
          <span className="w-20 text-right">Precio</span>
          <span className="w-8 text-center">✓</span>
        </div>

        {/* Filas */}
        <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
          {rows.map(row => (
            <div key={row.id} className={`transition-colors ${selected[row.id] ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
              {/* Fila principal */}
              <div
                onClick={() => togglePanel(row.id)}
                className={`grid items-center gap-0 px-4 py-2.5 cursor-pointer ${canAdmin ? 'grid-cols-[1fr_auto_auto_auto]' : 'grid-cols-[1fr_auto_auto]'} ${
                  !selected[row.id] ? 'hover:bg-gray-50 dark:hover:bg-gray-800/30' : ''
                }`}>
                <div>
                  <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">{row.label}</span>
                  {selected[row.id] && row.planchadoPrice > 0 && (
                    <p className="text-[10px] text-orange-600 dark:text-orange-400 leading-tight">
                      +{formatMoney(row.planchadoPrice)} planchado
                    </p>
                  )}
                </div>
                {canAdmin && (
                  <div className="w-16 flex justify-center" onClick={e => e.stopPropagation()}>
                    <EditableCell value={row.mult} onSave={val => updateMult(row.id, vehicleType, val)} />
                  </div>
                )}
                <span className="w-20 text-right text-sm font-bold text-gray-900 dark:text-white">
                  {formatMoney(row.price)}
                </span>
                <div className="w-8 flex justify-center">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    selected[row.id] ? 'bg-red-600 border-red-600' : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {selected[row.id] && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              </div>

              {/* Selector de daño — solo si está seleccionado */}
              {selected[row.id] && (
                <div className="flex items-center gap-1.5 px-4 pb-2.5" onClick={e => e.stopPropagation()}>
                  <span className="text-[10px] text-gray-400 mr-0.5">Planchado:</span>
                  {DAMAGE_LEVELS.map(lvl => (
                    <button key={lvl.id}
                      onClick={() => setDamageLevel(row.id, lvl.id)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                        row.damageId === lvl.id
                          ? lvl.id === 'none'
                            ? 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                            : lvl.id === 'leve'
                              ? 'bg-yellow-100 border-yellow-400 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : lvl.id === 'moderado'
                                ? 'bg-orange-100 border-orange-400 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                : 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                      }`}>
                      {lvl.short}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Descuento manual */}
        {selectedCount > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Descuento</p>
              {manualDiscountPct !== null && (
                <button onClick={() => setManualDiscountPct(null)}
                  className="text-[10px] text-gray-400 hover:text-red-500 underline">
                  Auto ({autoDiscountPct}%)
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {[0, 5, 10, 15, 20, 25, 30].map(pct => (
                <button key={pct} onClick={() => setManualDiscountPct(pct === discountPct && manualDiscountPct === pct ? null : pct)}
                  className={`flex-1 min-w-[46px] py-2 rounded-xl text-xs font-bold border transition-all ${
                    discountPct === pct
                      ? 'border-red-500 bg-red-600 text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-300'
                  }`}>
                  {pct === 0 ? 'Sin desc.' : `${pct}%`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Total */}
        <div className="border-t-2 border-red-100 dark:border-red-900/30 px-4 py-3 bg-red-50 dark:bg-red-900/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">{selectedCount} paño{selectedCount !== 1 ? 's' : ''} seleccionado{selectedCount !== 1 ? 's' : ''}</p>
              {discountPct > 0 && (
                <p className="text-xs text-green-600 font-semibold mt-0.5">🎁 Descuento {discountPct}% {manualDiscountPct !== null ? 'manual' : 'automático'}</p>
              )}
            </div>
            <div className="text-right">
              {discountPct > 0 && (
                <p className="text-xs text-gray-400 line-through">{formatMoney(total)}</p>
              )}
              <p className="text-2xl font-black text-red-600 dark:text-red-400">{formatMoney(totalFinal)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Botones de exportar (planchado) */}
      </>)}

      {/* ── Barra fija de acciones (siempre visible) ── */}
      {totalItemsSelected === 0 && (
        <div className="sticky bottom-4 z-20 mx-1">
          <div className="card shadow-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 py-3">
            <p className="text-xs text-gray-400">Selecciona servicios para continuar</p>
            <div className="flex gap-1.5">
              <button disabled className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-400 font-bold text-sm cursor-not-allowed">
                <MessageCircle className="w-4 h-4" /><span>WA</span>
              </button>
              <button disabled className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-400 font-bold text-sm cursor-not-allowed">
                <FileText className="w-4 h-4" /><span>PDF</span>
              </button>
              <button disabled className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-400 font-bold text-sm cursor-not-allowed">
                <PlusCircle className="w-4 h-4" /><span>Ticket</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Barra de exportación unificada (todas las categorías) ── */}
      {totalItemsSelected > 0 && (() => {
        const planchadoSel = rows.filter(r => selected[r.id])
        const allSelected = [
          ...planchadoSel.map(r => ({
            key: `p_${r.id}`,
            label: r.damageId !== 'none'
              ? `${r.label} + Planchado (${DAMAGE_LEVELS.find(d => d.id === r.damageId)?.label})`
              : `Pintado — ${r.label}`,
            price: r.price,
            onRemove: () => setSelected(s => ({ ...s, [r.id]: false })),
          })),
          ...catRows.map(r => ({
            key: `c_${r.id}`,
            label: r.label,
            price: r.price,
            onRemove: () => setCatSelected(s => ({ ...s, [r.id]: false })),
          })),
          ...serviciosRows.map(r => ({
            key: `sv_${r.id}`,
            label: r.label,
            price: r.price,
            onRemove: () => setServiciosSelected(s => ({ ...s, [r.id]: false })),
          })),
          ...lavItems.map(r => ({
            key: r.id,
            label: r.label,
            price: r.price,
            onRemove: () => setLavItems(items => items.filter(i => i.id !== r.id)),
          })),
          ...manualItems.map(r => ({
            key: `m_${r.id}`,
            label: r.titulo,
            sub: r.descripcion,
            price: r.monto,
            manual: true,
            onRemove: () => setManualItems(items => items.filter(i => i.id !== r.id)),
          })),
        ]
        const lavTotal = lavItems.reduce((s, i) => s + i.price, 0)
        const subtotalBruto = total + catTotal + serviciosTotal + manualTotal + lavTotal
        const activePct = manualDiscountPct != null ? manualDiscountPct : catDiscountPct
        const grandDiscount = Math.round(subtotalBruto * activePct / 100)
        const grandTotal = activePct > 0
          ? subtotalBruto - grandDiscount
          : totalFinal + catTotalFinal + serviciosTotal + manualTotal + lavTotal
        return (
          <div className="sticky bottom-4 z-20">
            <div className="card shadow-xl border border-red-100 dark:border-red-900/30 overflow-hidden">
              {/* Detalle items */}
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {allSelected.map(item => (
                  <div key={item.key} className="flex items-center gap-2 py-2">
                    <button onClick={item.onRemove}
                      className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 dark:text-gray-300 leading-tight">{item.label}</p>
                      {item.sub && <p className="text-[10px] text-gray-400 truncate">{item.sub}</p>}
                    </div>
                    {item.manual && <span className="text-[9px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">MANUAL</span>}
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200 flex-shrink-0">{formatMoney(item.price)}</p>
                  </div>
                ))}
              </div>

              {/* Formulario ítem manual */}
              {showManualForm ? (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800 space-y-2">
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-400">Ítem personalizado</p>
                  <input className="input text-sm py-1.5 w-full" placeholder="Título (ej: PPF capot especial)"
                    value={manualDraft.titulo} onChange={e => setManualDraft(d => ({ ...d, titulo: e.target.value }))} />
                  <input className="input text-sm py-1.5 w-full" placeholder="Descripción (opcional)"
                    value={manualDraft.descripcion} onChange={e => setManualDraft(d => ({ ...d, descripcion: e.target.value }))} />
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1 flex-1">
                      <span className="text-xs text-gray-500">S/</span>
                      <input type="number" className="input text-sm py-1.5 flex-1" placeholder="0.00"
                        value={manualDraft.monto} onChange={e => setManualDraft(d => ({ ...d, monto: e.target.value }))} />
                    </div>
                    <button onClick={addManualItem} className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold">+ Agregar</button>
                    <button onClick={() => setShowManualForm(false)} className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 text-sm hover:bg-gray-100 dark:hover:bg-gray-800">✕</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowManualForm(true)}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-blue-300 dark:border-blue-700 text-blue-500 text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                  + Agregar ítem personalizado
                </button>
              )}

              {/* Footer con total y botones */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 mt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-400">{totalItemsSelected} servicio{totalItemsSelected !== 1 ? 's' : ''}</p>
                    <p className="text-lg font-black text-red-600 dark:text-red-400">{formatMoney(grandTotal)}</p>
                  </div>
                  <button
                    onClick={() => { setSelected({}); setCatSelected({}); setServiciosSelected({}); setManualItems([]); setLavItems([]) }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-500 hover:border-red-300 text-xs transition-all">
                    <X className="w-3 h-3" />Limpiar
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <button onClick={() => openExportModal('whatsapp')}
                    className="flex items-center justify-center gap-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 active:scale-95 text-white font-bold text-sm transition-all">
                    <MessageCircle className="w-4 h-4" />WA
                  </button>
                  <button onClick={() => openExportModal('pdf')}
                    className="flex items-center justify-center gap-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-sm transition-all">
                    <FileText className="w-4 h-4" />PDF
                  </button>
                  <button onClick={() => {
                    const lavadosIds = new Set(LAVADOS_DATA.map(x => x.id))
                    const hasLavado = catRows.some(r => lavadosIds.has(r.id))
                    setTicketModal({
                      allSelected, grandTotal,
                      discountPct: catDiscountPct || discountPct || 0,
                      vehicle_type: hasLavado ? catVehicle : undefined,
                    })
                  }}
                    className="flex items-center justify-center gap-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-sm transition-all">
                    <PlusCircle className="w-4 h-4" />Ticket
                  </button>
                  <button onClick={() => setSaveQuoteModal({ allSelected, grandTotal, discountPct: catDiscountPct || discountPct || 0 })}
                    className="flex items-center justify-center gap-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-sm transition-all">
                    <Save className="w-4 h-4" />Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Cotizaciones guardadas ─────────────────────────────────────────── */}
      {savedQuotes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1">
            Cotizaciones guardadas ({savedQuotes.length})
          </p>
          {savedQuotes.map(q => {
            const daysLeft = Math.ceil((q.expires_at - Date.now()) / (1000 * 60 * 60 * 24))
            return (
              <div key={q.id} className="card border border-amber-100 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">
                      {q.nombre || q.placa || 'Sin nombre'}
                      {q.nombre && q.placa && <span className="ml-1.5 text-xs font-normal text-gray-400">{q.placa}</span>}
                    </p>
                    {q.worker_id && (() => {
                      const w = workers.find(x => x.id === q.worker_id)
                      return w ? <p className="text-xs text-indigo-500 font-semibold">👤 {w.name}</p> : null
                    })()}
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      Vence en {daysLeft} día{daysLeft !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-black text-red-600">{formatMoney(q.grand_total)}</p>
                    <button onClick={() => deleteQuote(q.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 space-y-0.5">
                  {q.items.slice(0, 3).map((it, i) => (
                    <p key={i} className="truncate">· {it.label}</p>
                  ))}
                  {q.items.length > 3 && <p className="text-gray-400">+ {q.items.length - 3} más</p>}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <button onClick={() => loadQuote(q)}
                    className="flex items-center justify-center gap-1 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-xs transition-all hover:bg-gray-200 active:scale-95">
                    Cargar
                  </button>
                  <button onClick={() => { loadQuote(q); setTimeout(() => openExportModal('whatsapp'), 100) }}
                    className="flex items-center justify-center gap-1 py-2 rounded-xl bg-green-500 hover:bg-green-600 active:scale-95 text-white font-bold text-xs transition-all">
                    <MessageCircle className="w-3.5 h-3.5" />WA
                  </button>
                  <button onClick={() => { loadQuote(q); setTimeout(() => openExportModal('pdf'), 100) }}
                    className="flex items-center justify-center gap-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs transition-all">
                    <FileText className="w-3.5 h-3.5" />PDF
                  </button>
                  <button onClick={() => {
                    const discPct = q.discount_pct || 0
                    setTicketModal({ allSelected: q.items, grandTotal: q.grand_total, discountPct: discPct })
                  }}
                    className="flex items-center justify-center gap-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs transition-all">
                    <PlusCircle className="w-3.5 h-3.5" />Ticket
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: guardar cotización */}
      {saveQuoteModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-3 pb-6"
          onClick={() => setSaveQuoteModal(false)}>
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-base text-gray-900 dark:text-white">Guardar cotización</p>
              <button onClick={() => setSaveQuoteModal(false)} className="p-1.5 rounded-full text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-xl">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              Esta cotización estará disponible por 7 días y luego se eliminará automáticamente.
            </p>
            <div className="space-y-2">
              <input className="input w-full" placeholder="Nombre del cliente"
                value={saveQuoteForm.nombre}
                onChange={e => setSaveQuoteForm(f => ({ ...f, nombre: e.target.value }))} />
              <input className="input w-full uppercase" placeholder="Placa (opcional)"
                maxLength={8}
                value={saveQuoteForm.placa}
                onChange={e => setSaveQuoteForm(f => ({ ...f, placa: e.target.value.toUpperCase() }))} />
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Técnico asignado (opcional)</p>
                <div className="flex flex-wrap gap-2">
                  {workers.filter(w => w.active !== false).map(w => (
                    <button key={w.id} type="button"
                      onClick={() => setSaveQuoteForm(f => ({ ...f, worker_id: f.worker_id === w.id ? '' : w.id }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        saveQuoteForm.worker_id === w.id
                          ? 'border-amber-500 bg-amber-500 text-white'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                      {w.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-3 py-2.5">
              {saveQuoteModal.allSelected?.slice(0, 4).map((it, i) => (
                <p key={i} className="truncate">· {it.label} — {formatMoney(it.price)}</p>
              ))}
              {saveQuoteModal.allSelected?.length > 4 && <p className="text-gray-400">+ {saveQuoteModal.allSelected.length - 4} más</p>}
              {saveQuoteModal.discountPct > 0 && (() => {
                const bruto = saveQuoteModal.allSelected?.reduce((s, i) => s + i.price, 0) || 0
                const disc = Math.round(bruto * saveQuoteModal.discountPct / 100)
                return (
                  <>
                    <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700 mt-1">
                      <span>Subtotal</span><span>{formatMoney(bruto)}</span>
                    </div>
                    <div className="flex justify-between text-green-600 font-semibold">
                      <span>Descuento {saveQuoteModal.discountPct}%</span><span>-{formatMoney(disc)}</span>
                    </div>
                  </>
                )
              })()}
              <p className="font-bold text-gray-700 dark:text-gray-300 pt-1 border-t border-gray-200 dark:border-gray-700 mt-1">
                Total: {formatMoney(saveQuoteModal.grandTotal)}
              </p>
            </div>
            <button
              onClick={() => saveQuote(saveQuoteModal.allSelected, saveQuoteModal.grandTotal, saveQuoteModal.discountPct)}
              className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-all active:scale-95">
              <Save className="w-4 h-4 inline mr-1.5" />Guardar cotización
            </button>
          </div>
        </div>
      )}

      {/* Modal: datos del cliente y vehículo */}
      {exportModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-3 pb-3"
          onClick={() => setExportModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-red-600 px-5 py-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-white text-base">Datos de la cotización</p>
                <p className="text-red-200 text-xs">Opcional — déjalo vacío si no aplica</p>
              </div>
              <button onClick={() => setExportModal(false)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {/* Cliente */}
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Cliente</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-0.5 block">Nombre / Razón social</label>
                  <input className="input w-full text-sm" placeholder="Ej: Juan Pérez"
                    value={exportForm.nombre} onChange={e => setExportForm(f => ({ ...f, nombre: e.target.value }))} autoFocus />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Celular</label>
                  <input className="input w-full text-sm" placeholder="999 999 999"
                    value={exportForm.celular} onChange={e => setExportForm(f => ({ ...f, celular: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">RUC / DNI</label>
                  <input className="input w-full text-sm" placeholder="20..."
                    value={exportForm.ruc} onChange={e => setExportForm(f => ({ ...f, ruc: e.target.value }))} />
                </div>
              </div>

              {/* Vehículo */}
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide pt-1">Vehículo</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Marca</label>
                  <input className="input w-full text-sm" placeholder="Toyota, BMW..."
                    value={exportForm.marca} onChange={e => setExportForm(f => ({ ...f, marca: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Modelo</label>
                  <input className="input w-full text-sm" placeholder="Corolla, X5..."
                    value={exportForm.modelo} onChange={e => setExportForm(f => ({ ...f, modelo: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Placa</label>
                  <input className="input w-full text-sm uppercase" placeholder="ABC-123"
                    value={exportForm.placa} onChange={e => setExportForm(f => ({ ...f, placa: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Año</label>
                  <input className="input w-full text-sm" placeholder="2020"
                    value={exportForm.anio} onChange={e => setExportForm(f => ({ ...f, anio: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-0.5 block">Color</label>
                  <input className="input w-full text-sm" placeholder="Blanco perla, Gris..."
                    value={exportForm.color} onChange={e => setExportForm(f => ({ ...f, color: e.target.value }))} />
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">Observaciones</label>
                <input className="input w-full text-sm" placeholder="Notas adicionales..."
                  value={exportForm.observaciones} onChange={e => setExportForm(f => ({ ...f, observaciones: e.target.value }))} />
              </div>

              {/* Condiciones */}
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">Condiciones de pago y entrega</label>
                <textarea rows={3} className="input w-full text-sm resize-none"
                  value={exportForm.condiciones} onChange={e => setExportForm(f => ({ ...f, condiciones: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 px-4 pb-4 pt-2">
              <button onClick={() => setExportModal(false)} className="btn-secondary py-3 text-sm rounded-xl">Cancelar</button>
              <button onClick={doExport} className="btn-primary py-3 text-sm rounded-xl font-bold">
                {exportTarget === 'whatsapp' ? '📲 Enviar WhatsApp' : '📄 Descargar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: crear ticket desde presupuesto — usa el formulario original */}
      {ticketModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
          <NewTicketForm
            onClose={() => setTicketModal(false)}
            onSave={async (data) => {
              await addTicket(data)
              toast.success('Ticket creado ✓')
              setTicketModal(false)
            }}
            workers={workers}
            vehicleTypes={vehicleTypes}
            canAdmin={canAdmin}
            defaultExtras={ticketModal.allSelected?.map(i => ({ name: i.label, price: i.price }))}
            defaultDiscountPct={ticketModal.discountPct || 0}
            defaultVehicleType={ticketModal.vehicle_type}
          />
        </div>
      )}

      {/* Comparativa y nota admin — solo en planchado */}
      {category === 'planchado' && canAdmin && <div className="card overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="font-bold text-gray-900 dark:text-white text-sm">Comparativa por vehículo</p>
          <p className="text-xs text-gray-500">Precio total si se seleccionan todos los paños</p>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
          {VEHICLE_TYPES.map(vt => {
            const vtTotal = config.panels.reduce((s, p) => s + Math.round(basePrice * p.mult[vt.id]), 0)
            return (
              <div key={vt.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-700 dark:text-gray-300">{vt.emoji} {vt.label}</span>
                <span className="font-bold text-gray-900 dark:text-white">{formatMoney(vtTotal)}</span>
              </div>
            )
          })}
        </div>
      </div>}

      {category === 'planchado' && canAdmin && (
        <div className="text-center text-xs text-gray-400 pb-2">
          <FileText className="w-3.5 h-3.5 inline mr-1" />
          Como admin puedes editar los multiplicadores tocando el número en cada celda.
        </div>
      )}
    </div>
  )
}
