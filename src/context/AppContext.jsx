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

const initialState = {
  workers: [],
  services: [],
  tickets: [],
  dailySummaries: [],
  incidents: [],
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
    case 'SET_MONTHLY_COSTS': return { ...state, monthlyCosts: action.payload }
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

      let workers, services, allTickets, allSummaries, allIncidents, monthlyCosts

      if (saved) {
        // Usar datos guardados
        workers       = saved.workers       || DEMO_WORKERS
        services      = saved.services      || DEMO_SERVICES
        allTickets    = saved.tickets       || DEMO_TICKETS
        allSummaries  = saved.dailySummaries|| []
        allIncidents  = saved.incidents     || DEMO_INCIDENTS
        monthlyCosts  = saved.monthlyCosts  || DEMO_MONTHLY_COSTS
      } else {
        // Primera vez: usar datos demo originales
        workers       = DEMO_WORKERS
        services      = DEMO_SERVICES
        allTickets    = DEMO_TICKETS
        allSummaries  = []
        allIncidents  = DEMO_INCIDENTS
        monthlyCosts  = DEMO_MONTHLY_COSTS
      }

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
      const endDate   = `${y}-${String(m).padStart(2, '0')}-31`

      const [workers, services, tickets, summaries, incidents, costs] = await Promise.all([
        supabase.from('workers').select('*').order('name'),
        supabase.from('services').select('*').order('category, name'),
        supabase.from('tickets').select('*').gte('date', startDate).lte('date', endDate).order('date', { ascending: false }),
        supabase.from('daily_summary').select('*').gte('date', startDate).lte('date', endDate),
        supabase.from('attendance_incidents').select('*').gte('date', startDate).lte('date', endDate),
        supabase.from('monthly_costs').select('*').eq('month', m).eq('year', y).single(),
      ])

      const workersData      = workers.data || []
      const incidentsEnriched = (incidents.data || []).map(i => enrichIncident(i, workersData))

      initialLoadDone.current = true
      dispatch({ type: 'SET_ALL', payload: {
        workers:        workersData,
        services:       services.data || [],
        tickets:        tickets.data || [],
        dailySummaries: summaries.data || [],
        incidents:      incidentsEnriched,
        monthlyCosts:   costs.data || { month: m, year: y, rent: 2700, supplies: 800, utility_goal: 2000 },
      }})
    } catch (err) {
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
    const { data: t, error } = await supabase.from('tickets').insert(data).select().single()
    if (error) throw error
    dispatch({ type: 'ADD_TICKET', payload: t })
    return t
  }

  const updateTicket = async (id, data) => {
    if (IS_DEMO) {
      const updated = { ...state.tickets.find(t => t.id === id), ...data }
      dispatch({ type: 'UPDATE_TICKET', payload: updated })
      return updated
    }
    const { data: t, error } = await supabase.from('tickets').update(data).eq('id', id).select().single()
    if (error) throw error
    dispatch({ type: 'UPDATE_TICKET', payload: t })
    return t
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
