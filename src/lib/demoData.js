// Datos demo para preview sin Supabase configurado
import { todayISO } from './utils'

export const DEMO_WORKERS = [
  { id: 'w1', name: 'Gustavo', base_salary: 2000, weekly_hours: 48, active: true, hire_date: '2023-01-01' },
  { id: 'w2', name: 'Elías', base_salary: 1850, weekly_hours: 48, active: true, hire_date: '2023-01-01' },
  { id: 'w3', name: 'Josué', base_salary: 1650, weekly_hours: 33, active: true, hire_date: '2023-03-01' },
  { id: 'w4', name: 'Isaac', base_salary: 1430, weekly_hours: 48, active: true, hire_date: '2023-02-01' },
  { id: 'w5', name: 'Gabriela', base_salary: 1400, weekly_hours: 33, active: true, hire_date: '2023-04-01' },
]

export const DEMO_SERVICES = [
  // Básicos / Mid-tier (85%)
  { id: 's1', name: 'Descontaminación química', category: 'basico', min_price: 60, max_price: 80, margin_percent: 85, active: true },
  { id: 's2', name: 'Descontaminación mecánica', category: 'basico', min_price: 120, max_price: 160, margin_percent: 85, active: true },
  { id: 's3', name: 'Abrillantado Apex Pro', category: 'basico', min_price: 130, max_price: 170, margin_percent: 85, active: true },
  { id: 's4', name: 'Corrección de pintura', category: 'basico', min_price: 260, max_price: 300, margin_percent: 85, active: true },
  // Cerámicos (45%)
  { id: 's5', name: 'Cerámico Miyavi 1 año', category: 'ceramico', min_price: 350, max_price: 450, margin_percent: 45, active: true },
  { id: 's6', name: 'Cerámico Meguiars 1 año', category: 'ceramico', min_price: 400, max_price: 500, margin_percent: 45, active: true },
  { id: 's7', name: 'Cerámico AutoPremium 3 años', category: 'ceramico', min_price: 599, max_price: 799, margin_percent: 45, active: true },
  { id: 's8', name: 'Cerámico CarPro 2 años', category: 'ceramico', min_price: 899, max_price: 1099, margin_percent: 45, active: true },
  { id: 's9', name: 'Cerámico CarPro 3 años', category: 'ceramico', min_price: 999, max_price: 1199, margin_percent: 45, active: true },
  // Polarizados (45%)
  { id: 's10', name: 'APPfilm Basic', category: 'polarizado', min_price: 299, max_price: 350, margin_percent: 45, active: true },
  { id: 's11', name: 'Nanocerámica Lexen', category: 'polarizado', min_price: 440, max_price: 640, margin_percent: 45, active: true },
  { id: 's12', name: 'Nanocerámica Protec', category: 'polarizado', min_price: 480, max_price: 680, margin_percent: 45, active: true },
  { id: 's13', name: 'Nanocerámica 3M Coreano', category: 'polarizado', min_price: 700, max_price: 900, margin_percent: 45, active: true },
  { id: 's14', name: '3M Original certificado', category: 'polarizado', min_price: 1400, max_price: 1400, margin_percent: 45, active: true },
  // PPF (45%)
  { id: 's15', name: 'PPF Zonas de impacto (auto)', category: 'ppf', min_price: 2700, max_price: 2700, margin_percent: 45, active: true },
  { id: 's16', name: 'PPF Zonas de impacto (SUV)', category: 'ppf', min_price: 3100, max_price: 3100, margin_percent: 45, active: true },
  { id: 's17', name: 'PPF Zonas de impacto (camioneta 3 filas)', category: 'ppf', min_price: 3400, max_price: 3400, margin_percent: 45, active: true },
  { id: 's18', name: 'PPF Zonas + Cerámico (auto)', category: 'ppf', min_price: 3200, max_price: 3200, margin_percent: 45, active: true },
  { id: 's19', name: 'PPF Full Body (auto)', category: 'ppf', min_price: 4700, max_price: 4700, margin_percent: 45, active: true },
  { id: 's20', name: 'PPF Full Body (SUV)', category: 'ppf', min_price: 5400, max_price: 5400, margin_percent: 45, active: true },
  { id: 's21', name: 'PPF Full Body (camioneta)', category: 'ppf', min_price: 5900, max_price: 5900, margin_percent: 45, active: true },
]

const today = todayISO()
const [y, m] = today.split('-')

export const DEMO_TICKETS = [
  { id: 't1', date: `${y}-${m}-02`, worker_id: 'w1', service_id: 's3', price_charged: 150, vehicle_type: 'auto', payment_method: 'efectivo', notes: '' },
  { id: 't2', date: `${y}-${m}-02`, worker_id: 'w2', service_id: 's1', price_charged: 70, vehicle_type: 'suv', payment_method: 'yape', notes: '' },
  { id: 't3', date: `${y}-${m}-03`, worker_id: 'w1', service_id: 's5', price_charged: 400, vehicle_type: 'auto', payment_method: 'efectivo', notes: '' },
  { id: 't4', date: `${y}-${m}-03`, worker_id: 'w3', service_id: 's2', price_charged: 140, vehicle_type: 'camioneta', payment_method: 'yape', notes: '' },
  { id: 't5', date: `${y}-${m}-04`, worker_id: 'w4', service_id: 's4', price_charged: 280, vehicle_type: 'auto', payment_method: 'efectivo', notes: '' },
  { id: 't6', date: `${y}-${m}-05`, worker_id: 'w2', service_id: 's7', price_charged: 699, vehicle_type: 'suv', payment_method: 'yape', notes: '' },
  { id: 't7', date: `${y}-${m}-06`, worker_id: 'w1', service_id: 's10', price_charged: 320, vehicle_type: 'auto', payment_method: 'efectivo', notes: '' },
  { id: 't8', date: `${y}-${m}-07`, worker_id: 'w5', service_id: 's1', price_charged: 65, vehicle_type: 'auto', payment_method: 'yape', notes: '' },
  { id: 't9', date: `${y}-${m}-09`, worker_id: 'w1', service_id: 's8', price_charged: 950, vehicle_type: 'auto', payment_method: 'efectivo', notes: '' },
  { id: 't10', date: `${y}-${m}-10`, worker_id: 'w3', service_id: 's3', price_charged: 160, vehicle_type: 'pickup', payment_method: 'yape', notes: '' },
]

export const DEMO_INCIDENTS = [
  { id: 'i1', worker_id: 'w3', date: `${y}-${m}-04`, type: 'tardanza', hours_late: 1.5, discount_amount: 0, apply_discount: true, observation: 'Tráfico' },
  { id: 'i2', worker_id: 'w5', date: `${y}-${m}-06`, type: 'permiso', hours_late: 0, discount_amount: 0, apply_discount: false, observation: 'Cita médica' },
  { id: 'i3', worker_id: 'w4', date: `${y}-${m}-10`, type: 'falta', hours_late: 0, discount_amount: 0, apply_discount: true, observation: '' },
]

export const DEMO_MONTHLY_COSTS = {
  month: parseInt(m),
  year: parseInt(y),
  rent: 2700,
  supplies: 800,
  utility_goal: 2000,
}
