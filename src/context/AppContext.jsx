import { createContext, useContext, useReducer, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import {
  DEMO_WORKERS, DEMO_SERVICES, DEMO_TICKETS, DEMO_INCIDENTS, DEMO_MONTHLY_COSTS
} from '../lib/demoData'
import { calcRealSalary, calcLatenessDiscount, calcAbsenceDiscount, calcOvertimePay, currentMonthYear } from '../lib/utils'

const NO_MARCACION_COST = 5

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

// ─── Caché de datos estáticos (workers, services, vehicle_types, extras) ──────
const STATIC_CACHE_KEY  = 'apexpro_static_v1'
const DYNAMIC_CACHE_KEY = 'apexpro_dynamic_v1'
const STATIC_CACHE_TTL  = 30 * 60 * 1000 //  30 min
const DYNAMIC_CACHE_TTL =  5 * 60 * 1000 //   5 min

function getStaticCache() {
  try {
    const raw = localStorage.getItem(STATIC_CACHE_KEY)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > STATIC_CACHE_TTL) return null
    return data
  } catch { return null }
}

function setStaticCache(data) {
  try { localStorage.setItem(STATIC_CACHE_KEY, JSON.stringify({ data, ts: Date.now() })) } catch {}
}

function getDynamicCache(prefix) {
  try {
    const raw = localStorage.getItem(DYNAMIC_CACHE_KEY)
    if (!raw) return null
    const { data, ts, key } = JSON.parse(raw)
    if (key !== prefix || Date.now() - ts > DYNAMIC_CACHE_TTL) return null
    return data
  } catch { return null }
}

function setDynamicCache(prefix, data) {
  try { localStorage.setItem(DYNAMIC_CACHE_KEY, JSON.stringify({ data, ts: Date.now(), key: prefix })) } catch {}
}
function invalidateDynamicCache() {
  try { localStorage.removeItem(DYNAMIC_CACHE_KEY) } catch {}
}
function invalidateAllCache() {
  try { localStorage.removeItem(DYNAMIC_CACHE_KEY); localStorage.removeItem(STATIC_CACHE_KEY) } catch {}
}

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
    // Actualiza solo datos dinámicos sin mostrar spinner
    case 'SET_DYNAMIC':       return { ...state, tickets: action.payload.tickets, dailySummaries: action.payload.dailySummaries, incidents: action.payload.incidents, monthlyCosts: action.payload.monthlyCosts, expenses: action.payload.expenses }
    case 'SET_LOADING':       return { ...state, loading: action.payload }
    case 'SET_ERROR':         return { ...state, error: action.payload, loading: false }
    case 'ADD_WORKER':        return { ...state, workers: [...state.workers, action.payload] }
    case 'UPDATE_WORKER':     return { ...state, workers: state.workers.map(w => w.id === action.payload.id ? action.payload : w) }
    case 'ADD_SERVICE':       return { ...state, services: [...state.services, action.payload] }
    case 'UPDATE_SERVICE':    return { ...state, services: state.services.map(s => s.id === action.payload.id ? action.payload : s) }
    case 'ADD_TICKET':        return state.tickets.find(t => t.id === action.payload.id) ? state : { ...state, tickets: [action.payload, ...state.tickets] }
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
    case 'ADD_EXPENSE':    return state.expenses.find(e => e.id === action.payload.id) ? state : { ...state, expenses: [action.payload, ...state.expenses] }
    case 'UPDATE_EXPENSE': return { ...state, expenses: state.expenses.map(e => e.id === action.payload.id ? action.payload : e) }
    case 'DELETE_EXPENSE': return { ...state, expenses: state.expenses.filter(e => e.id !== action.payload) }
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
    if (incident.type === 'tardanza' || incident.type === 'permiso_horas') {
      discount = calcLatenessDiscount(worker.base_salary, worker.weekly_hours, incident.hours_late || 0)
    } else if (incident.type === 'hora_extra') {
      discount = calcOvertimePay(worker.base_salary, worker.weekly_hours, incident.hours_late || 0)
    } else if (incident.type === 'no_marcacion') {
      discount = NO_MARCACION_COST * (incident.no_marcacion_count || 1)
    } else if (incident.type === 'multa' || incident.type === 'adelanto') {
      discount = incident.discount_amount || 0
    } else {
      discount = calcAbsenceDiscount(worker.base_salary, worker.weekly_hours)
    }
  }
  return { ...incident, discount_amount: discount }
}

async function refreshInBackground({ m, y, prefix, startDate, endDate, staticCached, supabase, dispatch, enrichIncident }) {
  try {
    const [ticketsRes, summaries, incidents, costs, expensesRes] = await Promise.all([
      supabase.from('tickets').select('id,date,plate,status,vehicle_type,vehicle_subtype,worker_id,service_id,price_charged,payment_method,extras,notes,opened_at,closed_at,mixto_yape,mixto_efectivo,client_name,client_phone,hidden_from_workers,discount_pct,discount_fixed,created_at').gte('date', startDate).lte('date', endDate).order('created_at', { ascending: false }),
      supabase.from('daily_summary').select('*').gte('date', startDate).lte('date', endDate),
      supabase.from('attendance_incidents').select('*').gte('date', startDate).lte('date', endDate),
      supabase.from('monthly_costs').select('*').eq('month', m).eq('year', y).maybeSingle(),
      supabase.from('worker_expenses').select('*').gte('date', startDate).lte('date', endDate).order('date', { ascending: false }),
    ])

    const ticketsData   = ticketsRes.data || []
    const summariesData = summaries.data || []
    const incidentsRaw  = incidents.data || []
    const costsData     = costs.data || { month: m, year: y, rent: 2700, supplies: 800, utility_goal: 2000 }
    const expensesData  = expensesRes.error ? [] : (expensesRes.data || [])

    setDynamicCache(prefix, { tickets: ticketsData, dailySummaries: summariesData, incidents: incidentsRaw, monthlyCosts: costsData, expenses: expensesData })

    const incidentsEnriched = incidentsRaw.map(i => enrichIncident(i, staticCached.workers))
    dispatch({ type: 'SET_DYNAMIC', payload: {
      tickets: ticketsData, dailySummaries: summariesData, incidents: incidentsEnriched,
      monthlyCosts: costsData, expenses: expensesData,
    }})

    migrateBase64Photos(ticketsData, supabase)
  } catch (err) {
    console.warn('background refresh error:', err)
  }
}

async function migrateBase64Photos(tickets, supabase) {
  const toMigrate = tickets.filter(t => t.photo_url?.startsWith('data:') || t.payment_photo?.startsWith('data:'))
  for (const ticket of toMigrate) {
    const updates = {}
    for (const field of ['photo_url', 'payment_photo']) {
      const val = ticket[field]
      if (!val?.startsWith('data:')) continue
      try {
        const res = await fetch(val)
        const blob = await res.blob()
        const path = `tickets/${ticket.id}/${field}-${Date.now()}.jpg`
        const { error } = await supabase.storage.from('payment-photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
        if (!error) {
          const { data } = supabase.storage.from('payment-photos').getPublicUrl(path)
          updates[field] = data.publicUrl
        }
      } catch { /* continuar con el siguiente */ }
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from('tickets').update(updates).eq('id', ticket.id)
    }
  }
}

function calcIncidentDiscount(data, worker) {
  if (!data.apply_discount || !worker) return 0
  if (data.type === 'tardanza' || data.type === 'permiso_horas') return calcLatenessDiscount(worker.base_salary, worker.weekly_hours, data.hours_late || 0)
  if (data.type === 'hora_extra') return calcOvertimePay(worker.base_salary, worker.weekly_hours, data.hours_late || 0)
  if (data.type === 'no_marcacion') return NO_MARCACION_COST * (data.no_marcacion_count || 1)
  if (data.type === 'multa' || data.type === 'adelanto') return parseFloat(data.multa_amount) || data.discount_amount || 0
  return calcAbsenceDiscount(worker.base_salary, worker.weekly_hours)
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const initialLoadDone = useRef(false)
  const loadInFlight    = useRef(false)

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
    if (loadInFlight.current) return
    loadInFlight.current = true
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
      loadInFlight.current    = false
      dispatch({ type: 'SET_ALL', payload: {
        workers, services, vehicleTypes, extrasCatalog,
        tickets, dailySummaries: summaries, incidents: enriched, monthlyCosts: activeCosts,
      }})
      return
    }

    // ── Supabase ──────────────────────────────────────────────────────────────
    try {
      const { month: cm, year: cy } = currentMonthYear()
      const m = month || cm
      const y = year || cy
      const prefix    = `${y}-${String(m).padStart(2, '0')}`
      const startDate = `${prefix}-01`
      const lastDay   = new Date(y, m, 0).getDate()
      const endDate   = `${prefix}-${String(lastDay).padStart(2, '0')}`

      const staticCached  = getStaticCache()
      const dynamicCached = getDynamicCache(prefix)

      // ── FASE 1: mostrar caché al instante (sin spinner) ───────────────────
      if (staticCached && dynamicCached) {
        const incidentsEnriched = dynamicCached.incidents.map(i => enrichIncident(i, staticCached.workers))
        dispatch({ type: 'SET_ALL', payload: {
          workers:        staticCached.workers,
          services:       staticCached.services,
          vehicleTypes:   staticCached.vehicleTypes,
          extrasCatalog:  staticCached.extrasCatalog,
          tickets:        dynamicCached.tickets,
          dailySummaries: dynamicCached.dailySummaries,
          incidents:      incidentsEnriched,
          monthlyCosts:   dynamicCached.monthlyCosts,
          expenses:       dynamicCached.expenses,
        }})
        initialLoadDone.current = true
        loadInFlight.current = false
        // ── FASE 2: refrescar en fondo silenciosamente ─────────────────────
        refreshInBackground({ m, y, prefix, startDate, endDate, staticCached, supabase, dispatch, enrichIncident })
        return
      }

      // ── Sin caché: fetch normal con spinner ───────────────────────────────
      const [ticketsRes, summaries, incidents, costs, expensesRes, ...staticResults] = await Promise.all([
        supabase.from('tickets').select('id,date,plate,status,vehicle_type,vehicle_subtype,worker_id,service_id,price_charged,payment_method,extras,notes,opened_at,closed_at,mixto_yape,mixto_efectivo,client_name,client_phone,hidden_from_workers,discount_pct,discount_fixed,created_at').gte('date', startDate).lte('date', endDate).order('created_at', { ascending: false }),
        supabase.from('daily_summary').select('*').gte('date', startDate).lte('date', endDate),
        supabase.from('attendance_incidents').select('*').gte('date', startDate).lte('date', endDate),
        supabase.from('monthly_costs').select('*').eq('month', m).eq('year', y).maybeSingle(),
        supabase.from('worker_expenses').select('*').gte('date', startDate).lte('date', endDate).order('date', { ascending: false }),
        ...(!staticCached ? [
          supabase.from('workers').select('*').order('name'),
          supabase.from('services').select('*').order('category, name'),
          supabase.from('vehicle_types').select('*').eq('active', true).order('sort_order'),
          supabase.from('extras_catalog').select('*').eq('active', true).order('sort_order'),
        ] : []),
      ])

      let workersData, servicesData, vehicleTypesData, extrasCatalogData
      if (staticCached) {
        workersData = staticCached.workers; servicesData = staticCached.services
        vehicleTypesData = staticCached.vehicleTypes; extrasCatalogData = staticCached.extrasCatalog
      } else {
        const [wR, sR, vtR, exR] = staticResults
        workersData       = wR?.data || []
        servicesData      = sR?.data || []
        vehicleTypesData  = vtR?.data?.length ? vtR.data : DEMO_VEHICLE_TYPES
        extrasCatalogData = exR?.data?.length ? exR.data : DEMO_EXTRAS_CATALOG
        setStaticCache({ workers: workersData, services: servicesData, vehicleTypes: vehicleTypesData, extrasCatalog: extrasCatalogData })
      }

      if (ticketsRes.error) console.warn('tickets query error:', ticketsRes.error.message)
      if (summaries.error) console.warn('summaries query error:', summaries.error.message)
      const ticketsData   = ticketsRes.error ? [] : (ticketsRes.data || [])
      const summariesData = summaries.error ? [] : (summaries.data || [])
      const incidentsRaw  = incidents.error ? [] : (incidents.data || [])
      const costsData     = costs.data || { month: m, year: y, rent: 2700, supplies: 800, utility_goal: 2000 }
      const expensesData  = expensesRes.error ? [] : (expensesRes.data || [])

      setDynamicCache(prefix, { tickets: ticketsData, dailySummaries: summariesData, incidents: incidentsRaw, monthlyCosts: costsData, expenses: expensesData })

      const incidentsEnriched = incidentsRaw.map(i => enrichIncident(i, workersData))

      dispatch({ type: 'SET_ALL', payload: {
        workers: workersData, services: servicesData, vehicleTypes: vehicleTypesData, extrasCatalog: extrasCatalogData,
        tickets: ticketsData, dailySummaries: summariesData, incidents: incidentsEnriched,
        monthlyCosts: costsData, expenses: expensesData,
      }})

      initialLoadDone.current = true
      migrateBase64Photos(ticketsData, supabase)
    } catch (err) {
      console.error('loadData error:', err)
      // No lanzar SET_ERROR que deja la app en blanco — mostrar con datos vacíos
      dispatch({ type: 'SET_ALL', payload: {
        workers: [], services: [], vehicleTypes: DEMO_VEHICLE_TYPES, extrasCatalog: DEMO_EXTRAS_CATALOG,
        tickets: [], dailySummaries: [], incidents: [], monthlyCosts: null, expenses: [],
      }})
    } finally {
      loadInFlight.current = false
    }
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        loadData()
      }
    })
    return () => subscription.unsubscribe()
  }, [loadData])

  // ── Realtime: sincronizar tickets entre dispositivos ────────────────────────
  useEffect(() => {
    if (IS_DEMO) return
    const channel = supabase
      .channel('tickets-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tickets' }, ({ new: t }) => {
        dispatch({ type: 'ADD_TICKET', payload: t })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets' }, ({ new: t }) => {
        dispatch({ type: 'UPDATE_TICKET', payload: t })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tickets' }, ({ old: t }) => {
        dispatch({ type: 'DELETE_TICKET', payload: t.id })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  // ── Realtime: sincronizar gastos entre dispositivos ─────────────────────────
  useEffect(() => {
    if (IS_DEMO) return
    const channel = supabase
      .channel('expenses-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'worker_expenses' }, ({ new: e }) => {
        dispatch({ type: 'ADD_EXPENSE', payload: e })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'worker_expenses' }, ({ new: e }) => {
        dispatch({ type: 'UPDATE_EXPENSE', payload: e })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'worker_expenses' }, ({ old: e }) => {
        dispatch({ type: 'DELETE_EXPENSE', payload: e.id })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])


  // ─── CRUD Workers ───────────────────────────────────────────────────────────
  const addWorker = async (data) => {
    if (IS_DEMO) {
      const w = { ...data, id: `w${Date.now()}`, active: true }
      dispatch({ type: 'ADD_WORKER', payload: w })
      return w
    }
    const { data: w, error } = await supabase.from('workers').insert(data).select().single()
    if (error) throw error
    localStorage.removeItem(STATIC_CACHE_KEY)
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
    localStorage.removeItem(STATIC_CACHE_KEY)
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
  function playCloseSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      // Click satisfactorio: transiente corto + tono cálido que decae
      const click = ctx.createOscillator()
      const clickGain = ctx.createGain()
      click.connect(clickGain)
      clickGain.connect(ctx.destination)
      click.type = 'sine'
      click.frequency.setValueAtTime(900, ctx.currentTime)
      click.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.06)
      clickGain.gain.setValueAtTime(0.25, ctx.currentTime)
      clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
      click.start(ctx.currentTime)
      click.stop(ctx.currentTime + 0.08)

      // Campana suave que inspira
      const bell = ctx.createOscillator()
      const bellGain = ctx.createGain()
      bell.connect(bellGain)
      bellGain.connect(ctx.destination)
      bell.type = 'sine'
      bell.frequency.value = 880 // A5
      bellGain.gain.setValueAtTime(0, ctx.currentTime + 0.05)
      bellGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.1)
      bellGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7)
      bell.start(ctx.currentTime + 0.05)
      bell.stop(ctx.currentTime + 0.7)

      // Armónico que da brillo
      const shine = ctx.createOscillator()
      const shineGain = ctx.createGain()
      shine.connect(shineGain)
      shineGain.connect(ctx.destination)
      shine.type = 'sine'
      shine.frequency.value = 1320 // E6
      shineGain.gain.setValueAtTime(0, ctx.currentTime + 0.07)
      shineGain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.12)
      shineGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      shine.start(ctx.currentTime + 0.07)
      shine.stop(ctx.currentTime + 0.5)

      setTimeout(() => ctx.close(), 1000)
    } catch {}
  }

  function playTicketSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        const t = ctx.currentTime + i * 0.12
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.18, t + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
        osc.start(t)
        osc.stop(t + 0.22)
      })
      setTimeout(() => ctx.close(), 1500)
    } catch {}
  }

  const addTicket = async (data) => {
    if (IS_DEMO) {
      const t = { ...data, id: `t${Date.now()}` }
      dispatch({ type: 'ADD_TICKET', payload: t })
      playTicketSound()
      return t
    }
    const { data: t, error } = await supabase.from('tickets').insert(data).select().single()
    if (error) throw error
    invalidateDynamicCache()
    dispatch({ type: 'ADD_TICKET', payload: t })
    playTicketSound()
    return t
  }

  const updateTicket = async (id, data) => {
    if (data.status === 'cerrado') playCloseSound()
    if (IS_DEMO) {
      const updated = { ...state.tickets.find(t => t.id === id), ...data }
      dispatch({ type: 'UPDATE_TICKET', payload: updated })
      return updated
    }
    const { data: t, error } = await supabase.from('tickets').update(data).eq('id', id).select().single()
    if (error) throw error
    invalidateDynamicCache()
    dispatch({ type: 'UPDATE_TICKET', payload: t })
    return t
  }

  const deleteTicket = async (id) => {
    if (IS_DEMO) { dispatch({ type: 'DELETE_TICKET', payload: id }); return }
    const { error } = await supabase.from('tickets').delete().eq('id', id)
    if (error) throw error
    invalidateDynamicCache()
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
    invalidateDynamicCache()
    dispatch({ type: 'ADD_SUMMARY', payload: s })
    return s
  }

  const deleteDailySummary = async (id) => {
    if (IS_DEMO) { dispatch({ type: 'DELETE_SUMMARY', payload: id }); return }
    const { error } = await supabase.from('daily_summary').delete().eq('id', id)
    if (error) throw error
    invalidateDynamicCache()
    dispatch({ type: 'DELETE_SUMMARY', payload: id })
  }

  // ─── CRUD Incidents ─────────────────────────────────────────────────────────
  const addIncident = async (data) => {
    const worker = state.workers.find(w => w.id === data.worker_id)
    const discount = calcIncidentDiscount(data, worker)
    // eslint-disable-next-line no-unused-vars
    const { multa_amount, ...dbData } = data
    const enriched = { ...dbData, discount_amount: discount }
    if (IS_DEMO) {
      const i = { ...enriched, id: `i${Date.now()}` }
      dispatch({ type: 'ADD_INCIDENT', payload: i })
      return i
    }
    const { data: i, error } = await supabase.from('attendance_incidents').insert(enriched).select().single()
    if (error) throw error
    invalidateDynamicCache()
    dispatch({ type: 'ADD_INCIDENT', payload: { ...i, discount_amount: discount } })
    return i
  }

  const updateIncident = async (id, data) => {
    const worker = state.workers.find(w => w.id === data.worker_id)
    const discount = calcIncidentDiscount(data, worker)
    // eslint-disable-next-line no-unused-vars
    const { multa_amount, ...dbData } = data
    const enriched = { ...dbData, discount_amount: discount }
    if (IS_DEMO) {
      const updated = { ...state.incidents.find(i => i.id === id), ...enriched }
      dispatch({ type: 'UPDATE_INCIDENT', payload: updated })
      return updated
    }
    const { data: i, error } = await supabase.from('attendance_incidents').update(enriched).eq('id', id).select().single()
    if (error) throw error
    invalidateDynamicCache()
    dispatch({ type: 'UPDATE_INCIDENT', payload: { ...i, discount_amount: discount } })
    return i
  }

  const deleteIncident = async (id) => {
    if (IS_DEMO) { dispatch({ type: 'DELETE_INCIDENT', payload: id }); return }
    const { error } = await supabase.from('attendance_incidents').delete().eq('id', id)
    if (error) throw error
    invalidateDynamicCache()
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

  // ─── Monthly Costs (fetch for arbitrary month) ─────────────────────────────
  const fetchMonthlyCosts = async (year, month) => {
    if (IS_DEMO) return null
    const { data } = await supabase.from('monthly_costs').select('*').eq('month', month).eq('year', year).maybeSingle()
    return data
  }

  // ─── Worker Monthly Config ──────────────────────────────────────────────────
  const fetchWorkerMonthlyConfigs = async (year, month) => {
    if (IS_DEMO) return []
    const { data } = await supabase.from('worker_monthly_config').select('*').eq('year', year).eq('month', month)
    return data || []
  }

  const saveWorkerMonthlyConfig = async ({ worker_id, year, month, base_salary, weekly_hours, daily_goal }) => {
    if (IS_DEMO) return
    const payload = { worker_id, year, month, base_salary, weekly_hours, daily_goal, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('worker_monthly_config').upsert(payload, { onConflict: 'worker_id,year,month' })
    if (error) throw error
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
    const payload = { ...data, worker_id: data.worker_id || null }
    const { data: e, error } = await supabase.from('worker_expenses').insert(payload).select().single()
    if (error) { console.error('addExpense error:', error); throw error }
    invalidateDynamicCache()
    dispatch({ type: 'ADD_EXPENSE', payload: e })
    return e
  }

  const updateExpense = async (id, data) => {
    if (IS_DEMO) {
      const updated = { ...state.expenses.find(e => e.id === id), ...data }
      dispatch({ type: 'SET_EXPENSES', payload: state.expenses.map(e => e.id === id ? updated : e) })
      return updated
    }
    const payload = { ...data, worker_id: data.worker_id || null }
    const { data: e, error } = await supabase.from('worker_expenses').update(payload).eq('id', id).select().single()
    if (error) { console.error('updateExpense error:', error); throw error }
    invalidateDynamicCache()
    dispatch({ type: 'SET_EXPENSES', payload: state.expenses.map(ex => ex.id === id ? e : ex) })
    return e
  }

  const deleteExpense = async (id) => {
    if (IS_DEMO) { dispatch({ type: 'SET_EXPENSES', payload: state.expenses.filter(e => e.id !== id) }); return }
    const { error } = await supabase.from('worker_expenses').delete().eq('id', id)
    if (error) throw error
    invalidateDynamicCache()
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

  // ─── Cargar fotos de un ticket (lazy, para no descargar en bulk) ────────────
  const fetchTicketPhotos = async (ticketId) => {
    if (IS_DEMO) return null
    const { data } = await supabase.from('tickets').select('photo_url, payment_photo').eq('id', ticketId).single()
    if (data) {
      dispatch({ type: 'UPDATE_TICKET', payload: { ...state.tickets.find(t => t.id === ticketId), ...data } })
    }
    return data
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
      invalidateAllCache,
      fetchTicketPhotos,
      addWorker, updateWorker,
      addService, updateService,
      addTicket, updateTicket, deleteTicket,
      addDailySummary, deleteDailySummary,
      addIncident, updateIncident, deleteIncident,
      addVehicleType, updateVehicleType, deleteVehicleType,
      addExtra, updateExtra, deleteExtra,
      addExpense, updateExpense, deleteExpense,
      addBonus, deleteBonus,
      saveMonthlyCosts,
      fetchMonthlyCosts, saveWorkerMonthlyConfig, fetchWorkerMonthlyConfigs,
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
