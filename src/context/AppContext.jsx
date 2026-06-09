import { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  DEMO_WORKERS, DEMO_SERVICES, DEMO_TICKETS, DEMO_INCIDENTS, DEMO_MONTHLY_COSTS
} from '../lib/demoData'
import { calcRealSalary, calcLatenessDiscount, calcAbsenceDiscount, currentMonthYear } from '../lib/utils'

const NO_MARCACION_COST = 5 // S/ por cada marcación no realizada

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

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
    case 'SET_ALL': return { ...state, ...action.payload, loading: false }
    case 'SET_LOADING': return { ...state, loading: action.payload }
    case 'SET_ERROR': return { ...state, error: action.payload, loading: false }
    case 'ADD_WORKER': return { ...state, workers: [...state.workers, action.payload] }
    case 'UPDATE_WORKER': return { ...state, workers: state.workers.map(w => w.id === action.payload.id ? action.payload : w) }
    case 'ADD_SERVICE': return { ...state, services: [...state.services, action.payload] }
    case 'UPDATE_SERVICE': return { ...state, services: state.services.map(s => s.id === action.payload.id ? action.payload : s) }
    case 'ADD_TICKET': return { ...state, tickets: [...state.tickets, action.payload] }
    case 'UPDATE_TICKET': return { ...state, tickets: state.tickets.map(t => t.id === action.payload.id ? action.payload : t) }
    case 'DELETE_TICKET': return { ...state, tickets: state.tickets.filter(t => t.id !== action.payload) }
    case 'ADD_SUMMARY': return { ...state, dailySummaries: [...state.dailySummaries, action.payload] }
    case 'DELETE_SUMMARY': return { ...state, dailySummaries: state.dailySummaries.filter(s => s.id !== action.payload) }
    case 'ADD_INCIDENT': return { ...state, incidents: [...state.incidents, action.payload] }
    case 'UPDATE_INCIDENT': return { ...state, incidents: state.incidents.map(i => i.id === action.payload.id ? action.payload : i) }
    case 'DELETE_INCIDENT': return { ...state, incidents: state.incidents.filter(i => i.id !== action.payload) }
    case 'SET_MONTHLY_COSTS': return { ...state, monthlyCosts: action.payload }
    default: return state
  }
}

// Calcula el descuento real de una incidencia dado el trabajador
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

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const loadData = useCallback(async (month, year) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    if (IS_DEMO) {
      const { month: cm, year: cy } = currentMonthYear()
      const m = month || cm
      const y = year || cy
      const monthStr = String(m).padStart(2, '0')
      const prefix = `${y}-${monthStr}`
      const filteredTickets = DEMO_TICKETS.filter(t => t.date.startsWith(prefix))
      const filteredIncidents = DEMO_INCIDENTS.filter(i => i.date.startsWith(prefix))
      const enriched = filteredIncidents.map(i => enrichIncident(i, DEMO_WORKERS))
      dispatch({ type: 'SET_ALL', payload: {
        workers: DEMO_WORKERS,
        services: DEMO_SERVICES,
        tickets: filteredTickets,
        dailySummaries: [],
        incidents: enriched,
        monthlyCosts: DEMO_MONTHLY_COSTS,
      }})
      return
    }

    try {
      const { month: cm, year: cy } = currentMonthYear()
      const m = month || cm
      const y = year || cy
      const startDate = `${y}-${String(m).padStart(2, '0')}-01`
      const endDate = `${y}-${String(m).padStart(2, '0')}-31`

      const [workers, services, tickets, summaries, incidents, costs] = await Promise.all([
        supabase.from('workers').select('*').order('name'),
        supabase.from('services').select('*').order('category, name'),
        supabase.from('tickets').select('*').gte('date', startDate).lte('date', endDate).order('date', { ascending: false }),
        supabase.from('daily_summary').select('*').gte('date', startDate).lte('date', endDate),
        supabase.from('attendance_incidents').select('*').gte('date', startDate).lte('date', endDate),
        supabase.from('monthly_costs').select('*').eq('month', m).eq('year', y).single(),
      ])

      const workersData = workers.data || []
      const incidentsEnriched = (incidents.data || []).map(i => enrichIncident(i, workersData))

      dispatch({ type: 'SET_ALL', payload: {
        workers: workersData,
        services: services.data || [],
        tickets: tickets.data || [],
        dailySummaries: summaries.data || [],
        incidents: incidentsEnriched,
        monthlyCosts: costs.data || { month: m, year: y, rent: 2700, supplies: 800, utility_goal: 2000 },
      }})
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err.message })
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // CRUD helpers
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

  const addIncident = async (data) => {
    const worker = state.workers.find(w => w.id === data.worker_id)
    let discount = 0
    if (data.apply_discount && worker) {
      if (data.type === 'tardanza') {
        discount = calcLatenessDiscount(worker.base_salary, worker.weekly_hours, data.hours_late || 0)
      } else if (data.type === 'no_marcacion') {
        discount = NO_MARCACION_COST * (data.no_marcacion_count || 1)
      } else {
        discount = calcAbsenceDiscount(worker.base_salary, worker.weekly_hours)
      }
    }
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
    let discount = 0
    if (data.apply_discount && worker) {
      if (data.type === 'tardanza') {
        discount = calcLatenessDiscount(worker.base_salary, worker.weekly_hours, data.hours_late || 0)
      } else if (data.type === 'no_marcacion') {
        discount = NO_MARCACION_COST * (data.no_marcacion_count || 1)
      } else {
        discount = calcAbsenceDiscount(worker.base_salary, worker.weekly_hours)
      }
    }
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

  const saveMonthlyCosts = async (data) => {
    if (IS_DEMO) { dispatch({ type: 'SET_MONTHLY_COSTS', payload: data }); return data }
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
