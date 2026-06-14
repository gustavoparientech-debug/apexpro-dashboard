import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  DEMO_WORKERS, DEMO_SERVICES, DEMO_TICKETS, DEMO_INCIDENTS, DEMO_MONTHLY_COSTS
} from '../lib/demoData'
import { calcRealSalary, calcLatenessDiscount, calcAbsenceDiscount, currentMonthYear } from '../lib/utils'

const NO_MARCACION_COST = 5

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

// ─── localStorage helpers ─────────────────────────────────────────────────────
const LS_KEY = 'apexpro_data_v2'

function saveToLS(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('localStorage lleno, no se pudo guardar')
  }
}

function loadFromLS() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// ─── Context & Reducer ────────────────────────────────────────────────────────
const AppContext = createContext(null)

const DEMO_EXTRAS_CATALOG = [
  { id: 'e1', name: 'Motor',              price: 20, sort_order: 1, active: true },
  { id: 'e2', name: 'Chasis',             price: 15, sort_order: 2, active: true },
  { id: 'e3', name: 'Alumax',             price: 10, sort_order: 3, active: true },
  { id: 'e4', name: 'Removex',            price: 10, sort_order: 4, active: true },
  { id: 'e5', name: 'Silicona',           price:  5, sort_order: 5, active: true },
  { id: 'e6', name: 'Retirado de llantas',price: 10, sort_order: 6, active: true },
]

const DEMO_VEHICLE_TYPES = [
  { id: 'v1', emoji: '🏍️', label: 'Moto',              value: 'moto',           default_price: 15, sort_order: 1, active: true },
  { id: 'v2', emoji: '🚗', label: 'Auto por fuera',    value: 'auto_exterior',  default_price: 15, sort_order: 2, active: true },
  { id: 'v3', emoji: '🚙', label: 'Auto',              value: 'auto',           default_price: 25, sort_order: 3, active: true },
  { id: 'v4', emoji: '🚐', label: 'Camioneta pequeña', value: 'camioneta_small',default_price: 30, sort_order: 4, active: true },
  { id: 'v5', emoji: '🚛', label: 'Camioneta grande',  value: 'camioneta_large',default_price: 35, sort_order: 5, active: true },
  { id: 'v6', emoji: '🚙', label: 'OffRoad Camioneta', value: 'offroad',        default_price: 35, sort_order: 6, active: true },
  { id: 'v7', emoji: '🚌', label: 'Otro',              value: 'otro',           default_price: 45, sort_order: 7, active: true },
]

const initialState = {
  workers: [],
  services: [],
  vehicleTypes: [],
  extrasCatalog: [],
  tickets: [],
  dailySummaries: [],
  incidents: [],
  expenses: [],
  bonuses: [],
  monthlyCosts: null,
  loading: true,
  error: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ALL':           return { ...state, ...action.payload, loading: false }
    case 'SET_LOADING':       return { ...state, loading: action.payload }
    case 'SET_ERROR':         return { ...state, error: action.payload, loading: false }
    case 'ADD_WORKER':        return { ...state, workers: [...state.workers, action.payload] }
    case 'UPDATE_WORKER':     return { ...state, workers: state.workers.map(w => w.id === action.payload.id ? action.payload : w) }
    case 'ADD_SERVICE':       return { ...state, services: [...state.services, action.payload] }
    case 'UPDATE_SERVICE':    return { ...state, services: state.services.map(s => s.id === action.payload.id ? action.payload : s) }
    case 'ADD_TICKET':        return { ...state, tickets: [...state.tickets, action.payload] }
    case 'UPDATE_TICKET':     return { ...state, tickets: state.tickets.map(t => t.id === action.payload.id ? action.payload : t) }
    case 'DELETE_TICKET':     return { ...state, tickets: state.tickets.filter(t => t.id !== action.payload) }
    case 'ADD_SUMMARY':       return { ...state, dailySummaries: [...state.dailySummaries, action.payload] }
    case 'DELETE_SUMMARY':    return { ...state, dailySummaries: state.dailySummaries.filter(s => s.id !== action.payload) }
    case 'ADD_INCIDENT':      return { ...state, incidents: [...state.incidents, action.payload] }
    case 'UPDATE_INCIDENT':   return { ...state, incidents: state.incidents.map(i => i.id === action.payload.id ? action.payload : i) }
    case 'DELETE_INCIDENT':   return { ...state, incidents: state.incidents.filter(i => i.id !== action.payload) }
    case 'SET_MONTHLY_COSTS':   return { ...state, monthlyCosts: action.payload }
    case 'SET_VEHICLE_TYPES':   return { ...state, vehicleTypes: action.payload }
    case 'ADD_VEHICLE_TYPE':    return { ...state, vehicleTypes: [...state.vehicleTypes, action.payload] }
    case 'UPDATE_VEHICLE_TYPE': return { ...state, vehicleTypes: state.vehicleTypes.map(v => v.id === action.payload.id ? action.payload : v) }
    case 'DELETE_VEHICLE_TYPE': return { ...state, vehicleTypes: state.vehicleTypes.filter(v => v.id !== action.payload) }
    case 'SET_EXTRAS_CATALOG':   return { ...state, extrasCatalog: action.payload }
    case 'ADD_EXTRA':            return { ...state, extrasCatalog: [...state.extrasCatalog, action.payload] }
    case 'UPDATE_EXTRA':         return { ...state, extrasCatalog: state.extrasCatalog.map(e => e.id === action.payload.id ? action.payload : e) }
    case 'DELETE_EXTRA':         return { ...state, extrasCatalog: state.extrasCatalog.filter(e => e.id !== action.payload) }
    case 'ADD_EXPENSE':    return { ...state, expenses: [...state.expenses, action.payload] }
    case 'SET_EXPENSES':   return { ...state, expenses: action.payload }
    case 'ADD_BONUS':      return { ...state, bonuses: [...state.bonuses, action.payload] }
    case 'DELETE_BONUS':   return { ...state, bonuses: state.bonuses.filter(b => b.id !== action.payload) }
    case 'SET_BONUSES':    return { ...state, bonuses: action.payload }
    default: return state
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function enrichIncident(incident, workers) {
  const worker = workers.find(w => w.id === incident.worker_id)
  if (!worker) return incident
  let discount = 0
  if (incident.apply_discount) {
    if (incident.type === 'tardanza') {
      discount = calcLatenessDiscount(worker.base_salary, worker.weekly_hours, incident.hours_late || 0)
    } else if (incident.type === 'no_marcacion') {
      discount = NO_MARCACION_COST * (incident.no_marcacion_count || 1)
    } else {
      discount = calcAbsenceDiscount(worker.base_salary, worker.weekly_hours)
    }
  }
  return { ...incident, discount_amount: discount }
}

function calcIncidentDiscount(data, worker) {
  if (!data.apply_discount || !worker) return 0
  if (data.type === 'tardanza') return calcLatenessDiscount(worker.base_salary, worker.weekly_hours, data.hours_late || 0)
  if (data.type === 'no_marcacion') return NO_MARCACION_COST * (data.no_marcacion_count || 1)
  return calcAbsenceDiscount(worker.base_salary, worker.weekly_hours)
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  // Evita guardar en LS durante la carga inicial
  const initialLoadDone = useRef(false)

  // ── Guardar en localStorage cada vez que cambia el estado (solo demo) ──────
  // Usamos una ref para acumular TODOS los tickets/incidencias de todos los meses
  const allDataRef = useRef({ tickets: [], dailySummaries: [], incidents: [] })

  useEffect(() => {
    if (!IS_DEMO || !initialLoadDone.current) return
    if (state.loading) return

    // Mergear tickets/summaries/incidents del mes actual con los de otros meses
    const saved = loadFromLS()
    const prevTickets    = (saved?.tickets       || []).filter(t => !state.tickets.find(x => x.id === t.id) && !state.tickets.some(x => x.date?.slice(0,7) === t.date?.slice(0,7) && false))
    const prevSummaries  = (saved?.dailySummaries || []).filter(d => !state.dailySummaries.find(x => x.id === d.id))
    const prevIncidents  = (saved?.incidents      || []).filter(i => !state.incidents.find(x => x.id === i.id))

    // Detectar mes activo de los tickets actuales
    const activePrefix = state.tickets[0]?.date?.slice(0,7) || state.incidents[0]?.date?.slice(0,7)

    // Filtrar datos previos que NO son del mes activo
    const otherMonthTickets   = activePrefix ? (saved?.tickets       || []).filter(t => !t.date?.startsWith(activePrefix)) : (saved?.tickets       || [])
    const otherMonthSummaries = activePrefix ? (saved?.dailySummaries|| []).filter(d => !d.date?.startsWith(activePrefix)) : (saved?.dailySummaries|| [])
    const otherMonthIncidents = activePrefix ? (saved?.incidents      || []).filter(i => !i.date?.startsWith(activePrefix)) : (saved?.incidents      || [])

    saveToLS({
      workers:        state.workers,
      services:       state.services,
      tickets:        [...otherMonthTickets,   ...state.tickets],
      dailySummaries: [...otherMonthSummaries, ...state.dailySummaries],
      incidents:      [...otherMonthIncidents, ...state.incidents],
      monthlyCosts:   state.monthlyCosts,
    })
  }, [state])

  // ── Carga de datos ──────────────────────────────────────────────────────────
  const loadData = useCallback(async (month, year) => {
    dispatch({ type: 'SET_LOADING', payload: true })

    if (IS_DEMO) {
      const { month: cm, year: cy } = currentMonthYear()
      const m = month || cm
      const y = year || cy

      // Intentar cargar desde localStorage primero
      const saved = loadFromLS()

      let workers, services, vehicleTypes, allTickets, allSummaries, allIncidents, monthlyCosts

      if (saved) {
        workers       = saved.workers        || DEMO_WORKERS
        services      = saved.services       || DEMO_SERVICES
        vehicleTypes  = saved.vehicleTypes   || DEMO_VEHICLE_TYPES
        allTickets    = saved.tickets        || DEMO_TICKETS
        allSummaries  = saved.dailySummaries || []
        allIncidents  = saved.incidents      || DEMO_INCIDENTS
        monthlyCosts  = saved.monthlyCosts   || DEMO_MONTHLY_COSTS
      } else {
        workers       = DEMO_WORKERS
        services      = DEMO_SERVICES
        vehicleTypes  = DEMO_VEHICLE_TYPES
        allTickets    = DEMO_TICKETS
        allSummaries  = []
        allIncidents  = DEMO_INCIDENTS
        monthlyCosts  = DEMO_MONTHLY_COSTS
      }
      const extrasCatalog = saved?.extrasCatalog || DEMO_EXTRAS_CATALOG

      // Filtrar por mes/año activo
      const prefix = `${y}-${String(m).padStart(2, '0')}`
      const tickets   = allTickets.filter(t => t.date?.startsWith(prefix))
      const summaries = allSummaries.filter(d => d.date?.startsWith(prefix))
      const incidents = allIncidents.filter(i => i.date?.startsWith(prefix))
      const enriched  = incidents.map(i => enrichIncident(i, workers))

      // Ajustar costos al mes actual si no coincide
      const activeCosts = (monthlyCosts?.month === m && monthlyCosts?.year === y)
        ? monthlyCosts
        : { month: m, year: y, rent: monthlyCosts?.rent || 2700, supplies: monthlyCosts?.supplies || 800, utility_goal: monthlyCosts?.utility_goal || 2000 }

      initialLoadDone.current = true
      dispatch({ type: 'SET_ALL', payload: {
        workers,
        services,
        vehicleTypes,
        extrasCatalog,
        tickets,
        dailySummaries: summaries,
        incidents: enriched,
        monthlyCosts: activeCosts,
      }})
      return
    }

    // ── Supabase ──────────────────────────────────────────────────────────────
    try {
      const { month: cm, year: cy } = currentMonthYear()
      const m = month || cm
      const y = year || cy
      const startDate = `${y}-${String(m).padStart(2, '0')}-01`
      const lastDay   = new Date(y, m, 0).getDate()
      const endDate   = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      const [workers, services, vehicleTypesRes, extrasRes, allTicketsRes, openTicketsRes, summaries, incidents, costs, expensesRes] = await Promise.all([
        supabase.from('workers').select('*').order('name'),
        supabase.from('services').select('*').order('category, name'),
        supabase.from('vehicle_types').select('*').eq('active', true).order('sort_order'),
        supabase.from('extras_catalog').select('*').eq('active', true).order('sort_order'),
        supabase.from('tickets').select('*').gte('date', startDate).lte('date', endDate).order('created_at', { ascending: false }),
        supabase.from('tickets').select('*').eq('status', 'abierto'),
        supabase.from('daily_summary').select('*').gte('date', startDate).lte('date', endDate),
        supabase.from('attendance_incidents').select('*').gte('date', startDate).lte('date', endDate),
        supabase.from('monthly_costs').select('*').eq('month', m).eq('year', y).maybeSingle(),
        supabase.from('worker_expenses').select('*').gte('date', startDate).lte('date', endDate).order('date', { ascending: false }),
      ])

      if (workers.error) console.warn('workers error:', workers.error.message)
      if (services.error) console.warn('services error:', services.error.message)

      const workersData       = workers.data || []
      const incidentsEnriched = (incidents.data || []).map(i => enrichIncident(i, workersData))
      // Combina tickets del mes + abiertos fuera del rango de fecha (si la columna existe)
      const monthTickets  = allTicketsRes.data || []
      const openOutOfRange = (openTicketsRes.data || []).filter(t => !monthTickets.find(x => x.id === t.id))
      const allTickets    = [...openOutOfRange, ...monthTickets]

      initialLoadDone.current = true
      dispatch({ type: 'SET_ALL', payload: {
        workers:        workersData,
        services:       services.data || [],
        vehicleTypes:   vehicleTypesRes.data?.length ? vehicleTypesRes.data : DEMO_VEHICLE_TYPES,
        extrasCatalog:  extrasRes.data?.length ? extrasRes.data : DEMO_EXTRAS_CATALOG,
        tickets:        allTickets,
        dailySummaries: summaries.data || [],
        incidents:      incidentsEnriched,
        monthlyCosts:   costs.data || { month: m, year: y, rent: 2700, supplies: 800, utility_goal: 2000 },
        expenses:       expensesRes.error ? (console.error('expenses fetch error:', expensesRes.error), []) : (expensesRes.data || []),
      }})
    } catch (err) {
      console.error('loadData error:', err)
      dispatch({ type: 'SET_ERROR', payload: err.message })
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ─── CRUD Workers ───────────────────────────────────────────────────────────
  const addWorker = async (data) => {
    if (IS_DEMO) {
      const w = { ...data, id: `w${Date.now()}`, active: true }
      dispatch({ type: 'ADD_WORKER', payload: w })
      return w
    }
    const { data: w, error } = await supabase.from('workers').insert(data).select().single()
    if (error) throw error
    dispatch({ type: 'ADD_WORKER', payload: w })
    return w
  }

  const updateWorker = async (id, data) => {
    if (IS_DEMO) {
      const updated = { ...state.workers.find(w => w.id === id), ...data }
      dispatch({ type: 'UPDATE_WORKER', payload: updated })
      return updated
    }
    const { data: w, error } = await supabase.from('workers').update(data).eq('id', id).select().single()
    if (error) throw error
    dispatch({ type: 'UPDATE_WORKER', payload: w })
    return w
  }

  // ─── CRUD Services ──────────────────────────────────────────────────────────
  const addService = async (data) => {
    if (IS_DEMO) {
      const s = { ...data, id: `s${Date.now()}`, active: true }
      dispatch({ type: 'ADD_SERVICE', payload: s })
      return s
    }
    const { data: s, error } = await supabase.from('services').insert(data).select().single()
    if (error) throw error
    dispatch({ type: 'ADD_SERVICE', payload: s })
    return s
  }

  const updateService = async (id, data) => {
    if (IS_DEMO) {
      const updated = { ...state.services.find(s => s.id === id), ...data }
      dispatch({ type: 'UPDATE_SERVICE', payload: updated })
      return updated
    }
    const { data: s, error } = await supabase.from('services').update(data).eq('id', id).select().single()
    if (error) throw error
    dispatch({ type: 'UPDATE_SERVICE', payload: s })
    return s
  }

  // ─── CRUD Tickets ───────────────────────────────────────────────────────────
  const addTicket = async (data) => {
    if (IS_DEMO) {
      const t = { ...data, id: `t${Date.now()}` }
      dispatch({ type: 'ADD_TICKET', payload: t })
      return t
    }
    // Intentar con nuevas columnas; si no existen (SQL pendiente), usar columnas básicas
    const { data: t, error } = await supabase.from('tickets').insert(data).select().single()
    if (!error) {
      dispatch({ type: 'ADD_TICKET', payload: t })
      return t
    }
    // Fallback: insertar sin las columnas nuevas
    const { status, opened_at, extras, ...basicData } = data
    const { data: t2, error: err2 } = await supabase.from('tickets').insert(basicData).select().single()
    if (err2) throw err2
    const withDefaults = { ...t2, status: status || 'abierto', opened_at: opened_at || new Date().toISOString(), extras: extras || [] }
    dispatch({ type: 'ADD_TICKET', payload: withDefaults })
    return withDefaults
  }

  const updateTicket = async (id, data) => {
    if (IS_DEMO) {
      const updated = { ...state.tickets.find(t => t.id === id), ...data }
      dispatch({ type: 'UPDATE_TICKET', payload: updated })
      return updated
    }
    // Separar campos que pueden no existir en DB aún
    const { extras, opened_at, closed_at, status, ...basicData } = data
    const newCols = {
      ...(extras     !== undefined && { extras }),
      ...(opened_at  !== undefined && { opened_at }),
      ...(closed_at  !== undefined && { closed_at }),
      ...(status     !== undefined && { status }),
    }

    // Intentar update completo primero
    const { data: t, error } = await supabase.from('tickets').update(data).eq('id', id).select().single()
    if (!error) {
      dispatch({ type: 'UPDATE_TICKET', payload: t })
      return t
    }

    // Fallback: actualizar solo campos básicos en DB, mantener nuevos en estado local
    const current = state.tickets.find(t => t.id === id) || {}
    if (Object.keys(basicData).length > 0) {
      const { data: t2, error: err2 } = await supabase.from('tickets').update(basicData).eq('id', id).select().single()
      if (err2) throw err2
      const merged = { ...t2, ...newCols }
      dispatch({ type: 'UPDATE_TICKET', payload: merged })
      return merged
    }
    // Si solo hay campos nuevos (extras, status, etc.) sin columna en DB: actualizar solo en estado local
    const localOnly = { ...current, ...newCols }
    dispatch({ type: 'UPDATE_TICKET', payload: localOnly })
    return localOnly
  }

  const deleteTicket = async (id) => {
    if (IS_DEMO) { dispatch({ type: 'DELETE_TICKET', payload: id }); return }
    const { error } = await supabase.from('tickets').delete().eq('id', id)
    if (error) throw error
    dispatch({ type: 'DELETE_TICKET', payload: id })
  }

  // ─── CRUD Daily Summary ─────────────────────────────────────────────────────
  const addDailySummary = async (data) => {
    if (IS_DEMO) {
      const s = { ...data, id: `ds${Date.now()}` }
      dispatch({ type: 'ADD_SUMMARY', payload: s })
      return s
    }
    const { data: s, error } = await supabase.from('daily_summary').insert(data).select().single()
    if (error) throw error
    dispatch({ type: 'ADD_SUMMARY', payload: s })
    return s
  }

  const deleteDailySummary = async (id) => {
    if (IS_DEMO) { dispatch({ type: 'DELETE_SUMMARY', payload: id }); return }
    const { error } = await supabase.from('daily_summary').delete().eq('id', id)
    if (error) throw error
    dispatch({ type: 'DELETE_SUMMARY', payload: id })
  }

  // ─── CRUD Incidents ─────────────────────────────────────────────────────────
  const addIncident = async (data) => {
    const worker = state.workers.find(w => w.id === data.worker_id)
    const discount = calcIncidentDiscount(data, worker)
    const enriched = { ...data, discount_amount: discount }
    if (IS_DEMO) {
      const i = { ...enriched, id: `i${Date.now()}` }
      dispatch({ type: 'ADD_INCIDENT', payload: i })
      return i
    }
    const { data: i, error } = await supabase.from('attendance_incidents').insert(enriched).select().single()
    if (error) throw error
    dispatch({ type: 'ADD_INCIDENT', payload: { ...i, discount_amount: discount } })
    return i
  }

  const updateIncident = async (id, data) => {
    const worker = state.workers.find(w => w.id === data.worker_id)
    const discount = calcIncidentDiscount(data, worker)
    const enriched = { ...data, discount_amount: discount }
    if (IS_DEMO) {
      const updated = { ...state.incidents.find(i => i.id === id), ...enriched }
      dispatch({ type: 'UPDATE_INCIDENT', payload: updated })
      return updated
    }
    const { data: i, error } = await supabase.from('attendance_incidents').update(enriched).eq('id', id).select().single()
    if (error) throw error
    dispatch({ type: 'UPDATE_INCIDENT', payload: { ...i, discount_amount: discount } })
    return i
  }

  const deleteIncident = async (id) => {
    if (IS_DEMO) { dispatch({ type: 'DELETE_INCIDENT', payload: id }); return }
    const { error } = await supabase.from('attendance_incidents').delete().eq('id', id)
    if (error) throw error
    dispatch({ type: 'DELETE_INCIDENT', payload: id })
  }

  // ─── CRUD Vehicle Types ─────────────────────────────────────────────────────
  const addVehicleType = async (data) => {
    if (IS_DEMO) {
      const v = { ...data, id: `vt${Date.now()}`, active: true }
      dispatch({ type: 'ADD_VEHICLE_TYPE', payload: v })
      return v
    }
    const { data: v, error } = await supabase.from('vehicle_types').insert(data).select().single()
    if (error) throw error
    dispatch({ type: 'ADD_VEHICLE_TYPE', payload: v })
    return v
  }

  const updateVehicleType = async (id, data) => {
    if (IS_DEMO) {
      const updated = { ...state.vehicleTypes.find(v => v.id === id), ...data }
      dispatch({ type: 'UPDATE_VEHICLE_TYPE', payload: updated })
      return updated
    }
    const { data: v, error } = await supabase.from('vehicle_types').update(data).eq('id', id).select().single()
    if (error) throw error
    dispatch({ type: 'UPDATE_VEHICLE_TYPE', payload: v })
    return v
  }

  const deleteVehicleType = async (id) => {
    if (IS_DEMO) { dispatch({ type: 'DELETE_VEHICLE_TYPE', payload: id }); return }
    const { error } = await supabase.from('vehicle_types').delete().eq('id', id)
    if (error) throw error
    dispatch({ type: 'DELETE_VEHICLE_TYPE', payload: id })
  }

  // ─── CRUD Extras Catalog ───────────────────────────────────────────────────
  const addExtra = async (data) => {
    if (IS_DEMO) {
      const e = { ...data, id: `ex${Date.now()}`, active: true }
      dispatch({ type: 'ADD_EXTRA', payload: e })
      return e
    }
    const { data: e, error } = await supabase.from('extras_catalog').insert({ ...data, price: parseFloat(data.price) }).select().single()
    if (error) { console.error('addExtra error:', error); throw error }
    dispatch({ type: 'ADD_EXTRA', payload: e })
    return e
  }

  const updateExtra = async (id, data) => {
    if (IS_DEMO) {
      const updated = { ...state.extrasCatalog.find(e => e.id === id), ...data }
      dispatch({ type: 'UPDATE_EXTRA', payload: updated })
      return updated
    }
    const payload = { ...data }
    if (data.price !== undefined) payload.price = parseFloat(data.price)
    const { data: e, error } = await supabase.from('extras_catalog').update(payload).eq('id', id).select().single()
    if (error) { console.error('updateExtra error:', error); throw error }
    dispatch({ type: 'UPDATE_EXTRA', payload: e })
    return e
  }

  const deleteExtra = async (id) => {
    if (IS_DEMO) { dispatch({ type: 'DELETE_EXTRA', payload: id }); return }
    const { error } = await supabase.from('extras_catalog').delete().eq('id', id)
    if (error) throw error
    dispatch({ type: 'DELETE_EXTRA', payload: id })
  }

  // ─── Monthly Costs ──────────────────────────────────────────────────────────
  const saveMonthlyCosts = async (data) => {
    if (IS_DEMO) {
      dispatch({ type: 'SET_MONTHLY_COSTS', payload: data })
      return data
    }
    const { data: existing } = await supabase.from('monthly_costs').select('id').eq('month', data.month).eq('year', data.year).single()
    let result
    if (existing) {
      const { data: r, error } = await supabase.from('monthly_costs').update(data).eq('id', existing.id).select().single()
      if (error) throw error
      result = r
    } else {
      const { data: r, error } = await supabase.from('monthly_costs').insert(data).select().single()
      if (error) throw error
      result = r
    }
    dispatch({ type: 'SET_MONTHLY_COSTS', payload: result })
    return result
  }

  // ─── CRUD Expenses ──────────────────────────────────────────────────────────
  const addExpense = async (data) => {
    if (IS_DEMO) {
      const e = { ...data, id: `e${Date.now()}` }
      dispatch({ type: 'ADD_EXPENSE', payload: e })
      return e
    }
    const { data: e, error } = await supabase.from('worker_expenses').insert(data).select().single()
    if (error) { console.error('addExpense error:', error); throw error }
    dispatch({ type: 'ADD_EXPENSE', payload: e })
    return e
  }

  const deleteExpense = async (id) => {
    if (IS_DEMO) { dispatch({ type: 'SET_EXPENSES', payload: state.expenses.filter(e => e.id !== id) }); return }
    const { error } = await supabase.from('worker_expenses').delete().eq('id', id)
    if (error) throw error
    dispatch({ type: 'SET_EXPENSES', payload: state.expenses.filter(e => e.id !== id) })
  }

  // ─── CRUD Bonuses ───────────────────────────────────────────────────────────
  const addBonus = async (data) => {
    if (IS_DEMO) {
      const b = { ...data, id: `b${Date.now()}` }
      dispatch({ type: 'ADD_BONUS', payload: b })
      return b
    }
    try {
      const { data: b, error } = await supabase.from('worker_bonuses').insert(data).select().single()
      if (error) throw error
      dispatch({ type: 'ADD_BONUS', payload: b })
      return b
    } catch {
      const b = { ...data, id: `b${Date.now()}` }
      dispatch({ type: 'ADD_BONUS', payload: b })
      return b
    }
  }
  const deleteBonus = async (id) => {
    dispatch({ type: 'DELETE_BONUS', payload: id })
    if (!IS_DEMO) {
      try { await supabase.from('worker_bonuses').delete().eq('id', id) } catch {}
    }
  }

  // ─── Utilidad: borrar todos los datos guardados (reset) ─────────────────────
  const resetDemoData = () => {
    localStorage.removeItem(LS_KEY)
    initialLoadDone.current = false
    loadData()
  }

  return (
    <AppContext.Provider value={{
      ...state,
      isDemo: IS_DEMO,
      loadData,
      addWorker, updateWorker,
      addService, updateService,
      addTicket, updateTicket, deleteTicket,
      addDailySummary, deleteDailySummary,
      addIncident, updateIncident, deleteIncident,
      addVehicleType, updateVehicleType, deleteVehicleType,
      addExtra, updateExtra, deleteExtra,
      addExpense, deleteExpense,
      addBonus, deleteBonus,
      saveMonthlyCosts,
      resetDemoData,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
