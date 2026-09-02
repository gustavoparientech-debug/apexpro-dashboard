import { useMemo, useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'
import {
  formatMoney, formatDate, getSemaforoColor, calcRealSalary, calcTicketProfit,
  getWorkingDaysInMonth, getWorkingDaysElapsed, getWorkingDaysRemaining, getWorkingDaysInRange,
  currentMonthYear, monthName, salarioDelMes } from '../lib/utils'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import {
  TrendingUp, Car, DollarSign, AlertTriangle, Clock, Receipt,
  CreditCard, Smartphone, Calendar, Award, Trophy, Gift, Plus, Trash2, Banknote,
  ChevronLeft, ChevronRight, X, Pencil
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ComposedChart, Line, Legend, LabelList } from 'recharts'
import toast from 'react-hot-toast'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function ProgressBar({ percent, color }) {
  const bg = { verde: 'bg-green-500', amarillo: 'bg-yellow-500', rojo: 'bg-red-500' }
  const border = { verde: 'border-green-200 dark:border-green-900', amarillo: 'border-yellow-200 dark:border-yellow-900', rojo: 'border-red-200 dark:border-red-900' }
  return (
    <div className={`w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden border ${border[color]}`}>
      <div className={`h-full rounded-full transition-all duration-700 ${bg[color]}`} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{value}</span>
    </div>
  )
}

function BonusSection({ workers, bonuses, addBonus, deleteBonus, monthPrefix }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ worker_id: '', amount: '', reason: '' })
  const [busy, setBusy] = useState(false)
  const monthBonuses = bonuses.filter(b => b.date?.startsWith(monthPrefix))
  const activeWorkers = workers.filter(w => w.active)
  const totalBonuses = monthBonuses.reduce((s, b) => s + b.amount, 0)

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.worker_id || !form.amount) { toast.error('Selecciona trabajador y monto'); return }
    setBusy(true)
    try {
      await addBonus({ worker_id: form.worker_id, amount: parseFloat(form.amount), reason: form.reason, date: `${monthPrefix}-01` })
      toast.success('Bono registrado')
      setForm({ worker_id: '', amount: '', reason: '' })
      setOpen(false)
    } catch (err) { toast.error('Error: ' + err.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">Bonos del mes</p>
          {totalBonuses > 0 && (
            <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">
              {formatMoney(totalBonuses)}
            </span>
          )}
        </div>
        <button onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1 text-xs text-red-600 font-semibold px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Agregar
        </button>
      </div>
      {open && (
        <form onSubmit={handleAdd} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">Trabajador</label>
              <select className="input text-sm" value={form.worker_id} onChange={e => setForm(f => ({ ...f, worker_id: e.target.value }))} required>
                <option value="">Seleccionar...</option>
                {activeWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs">Monto (S/)</label>
              <input type="number" className="input text-sm" min="1" step="1" placeholder="50" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="label text-xs">Motivo (opcional)</label>
            <input type="text" className="input text-sm" placeholder="Ej: Mejor mes, puntualidad..." value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1 text-sm py-2" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" disabled={busy} className="btn-primary flex-1 text-sm py-2">{busy ? '...' : 'Guardar bono'}</button>
          </div>
        </form>
      )}
      {monthBonuses.length === 0 && !open && <p className="text-xs text-gray-400 text-center py-2">Sin bonos este mes</p>}
      {monthBonuses.map(b => {
        const w = workers.find(wk => wk.id === b.worker_id)
        return (
          <div key={b.id} className="flex items-center gap-3 py-1">
            <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 font-bold text-xs flex-none">
              {w?.name?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{w?.name || 'Trabajador'}</p>
              {b.reason && <p className="text-xs text-gray-400 truncate">{b.reason}</p>}
            </div>
            <span className="text-sm font-bold text-amber-600">+{formatMoney(b.amount)}</span>
            <button onClick={() => deleteBonus(b.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

const CAT_LABELS = { insumos: '🧴 Insumos', pintura: '🎨 Pintura', repuestos: '⚙️ Repuestos', herramientas: '🔧 Herramientas', transporte: '🚌 Transporte', comida: '🍱 Comida', adelanto: '💵 Adelanto', otro: '📦 Otro' }
const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Fecha ↓' },
  { value: 'date_asc',  label: 'Fecha ↑' },
  { value: 'amount_desc', label: 'Mayor monto' },
  { value: 'amount_asc',  label: 'Menor monto' },
]

// ─── Afluencia: qué días y a qué horas entra el trabajo ──────────────────────
// Con el promedio por día de semana y por hora se decide a qué hora conviene
// almorzar, cuándo hace falta más gente y hasta qué hora tiene sentido abrir.
// El domingo no se trabaja: si aparece un ticket es porque entró a destajo y
// ensucia el promedio, así que queda fuera de la estadística.
const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const RANGOS_AFLUENCIA = [
  { dias: 30,  label: '30 días' },
  { dias: 90,  label: '3 meses' },
  { dias: 180, label: '6 meses' },
]

// El taller abre 8:30 y cierra como maximo a las 18:00. Un ticket marcado a las
// 01:00 o a las 23:00 no es un auto que entro a esa hora: es una carga tardia o
// un registro que se olvido y se metio despues.
// Jornada util de un trabajador: 8:30 a 18:00 menos el almuerzo.
const HORAS_EFECTIVAS_TRABAJADOR = 8.5
// El equipo fijo es el de lavados: planchado, ceramicos, polarizados y pintura
// los cubren tecnicos que vienen solo esos dias, asi que su carga no debe pesar
// al dimensionar la plantilla permanente.
// `service_cat` empezo a guardarse en agosto de 2026. Para los tickets viejos
// que no lo traen se deduce: un lavado se hace el mismo dia y es barato. Contra
// los tickets que si tienen categoria, la regla acierta 25 de 26 lavados y deja
// fuera ceramico y polarizado.
const PRECIO_MAX_LAVADO = 150
function esLavado(t) {
  const cat = (t.service_cat || '').trim()
  if (cat) return cat === 'lavados'
  if (!t.opened_at) return false
  const fin = t.closed_at ? new Date(t.closed_at) : new Date()
  const mismoDia = new Date(t.opened_at).toDateString() === fin.toDateString()
  return mismoDia && (Number(t.price_charged) || 0) < PRECIO_MAX_LAVADO
}

// Un lavado lo hacen dos personas a la vez, no una: asi sale mas rapido. El
// reloj del ticket mide el rato que el auto estuvo ocupado, no el trabajo que
// costo, asi que cada hora de reloj son dos horas-persona. Sin esto la carga
// salia a la mitad. Tambien fija un piso: por debajo de dos personas no se
// puede atender aunque sobre tiempo.
const PERSONAS_POR_SERVICIO = 2

// Un ticket de un solo dia que cruza la noche no son 20 horas: se topa en una jornada.
const TOPE_HORAS_TICKET = 9
// Tope de dias que se le cuentan a un trabajo largo, para que un ticket que se
// quedo sin cerrar por olvido no infle el promedio para siempre.
const TOPE_DIAS_TRABAJO = 20

const HORA_APERTURA = 8
const HORA_CIERRE   = 17   // ultima franja; a las 18:00 ya se cerro

// Reparte los autos marcados fuera del horario entre las horas de trabajo,
// siguiendo la forma real del dia. Se reparten en vez de descartarlos porque el
// auto si entro: lo que no sirve es su hora. Se usa resto mayor para que la
// suma cuadre exactamente con el total y no se invente ni se pierda ningun auto.
function repartirFueraDeHorario(porHora) {
  const dentro = porHora.filter(h => h.hora >= HORA_APERTURA && h.hora <= HORA_CIERRE)
  const fuera  = porHora.filter(h => h.hora <  HORA_APERTURA || h.hora >  HORA_CIERRE)
  const autosFuera    = fuera.reduce((a, h) => a + h.autos, 0)
  const ingresosFuera = fuera.reduce((a, h) => a + h.ingresos, 0)
  if (!autosFuera && !ingresosFuera) return { dentro, autosFuera, ingresosFuera }

  const baseAutos = dentro.reduce((a, h) => a + h.autos, 0)
  // Sin ninguna hora valida no hay tendencia que seguir: se reparte parejo.
  const pesos = dentro.map(h => baseAutos > 0 ? h.autos / baseAutos : 1 / dentro.length)

  const repartir = (cantidad, entero) => {
    const crudos = pesos.map(w => w * cantidad)
    if (!entero) return crudos
    const base = crudos.map(Math.floor)
    let resto = Math.round(cantidad) - base.reduce((a, b) => a + b, 0)
    const orden = crudos
      .map((v, i) => ({ i, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac)
    for (let k = 0; k < orden.length && resto > 0; k++, resto--) base[orden[k].i] += 1
    return base
  }

  const addAutos    = repartir(autosFuera, true)
  const addIngresos = repartir(ingresosFuera, false)
  return {
    dentro: dentro.map((h, i) => ({
      ...h,
      autos: h.autos + addAutos[i],
      ingresos: h.ingresos + addIngresos[i],
      reasignados: addAutos[i],
    })),
    autosFuera,
    ingresosFuera,
  }
}

function AfluenciaPanel() {
  // La plantilla sale de los trabajadores activos, no de un numero fijo: si se
  // contrata o sale alguien la tarjeta se ajusta sola. El admin queda fuera:
  // lleva ceramicos, que es trabajo de tecnico aparte y no de equipo de taller.
  const { workers } = useApp()
  const plantilla = (workers || []).filter(w => w.active && w.role !== 'admin').length
  const [dias, setDias]   = useState(90)
  const [rows, setRows]   = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    const desde = new Date()
    desde.setDate(desde.getDate() - dias)
    supabase.from('tickets')
      .select('date, opened_at, closed_at, created_at, price_charged, status, service_cat')
      .gte('date', desde.toISOString().slice(0, 10))
      .then(({ data }) => { if (vivo) { setRows(data || []); setCargando(false) } })
    return () => { vivo = false }
  }, [dias])

  const analisis = useMemo(() => {
    const esDomingo = fecha => {
      const [y, m, d] = fecha.split('-').map(Number)
      return new Date(y, m - 1, d).getDay() === 0
    }
    const lista = (rows || []).filter(t => t.date && !esDomingo(t.date))
    if (!lista.length) return null

    // Por día de la semana: se divide entre cuántas veces cayó ese día en el
    // período, si no un mes con cinco sábados parece mejor que uno con cuatro.
    const porDia = DIAS_SEMANA.map(nombre => ({ dia: nombre, autos: 0, ingresos: 0, fechas: new Set() }))
    const domingos = (rows || []).filter(t => t.date && esDomingo(t.date)).length
    const porHora = Array.from({ length: 24 }, (_, h) => ({ hora: h, autos: 0, ingresos: 0 }))

    for (const t of lista) {
      const [y, m, d] = t.date.split('-').map(Number)
      const idx = (new Date(y, m - 1, d).getDay() + 6) % 7   // 0 = lunes
      porDia[idx].autos += 1
      porDia[idx].ingresos += Number(t.price_charged) || 0
      porDia[idx].fechas.add(t.date)

      const marca = t.opened_at || t.created_at
      if (marca) {
        const h = new Date(marca).getHours()
        if (!isNaN(h)) { porHora[h].autos += 1; porHora[h].ingresos += Number(t.price_charged) || 0 }
      }
    }

    // Cuántas veces ocurrió cada día laborable en el período (sin domingos).
    const vecesPorDia = Array(6).fill(0)
    const hoy = new Date()
    for (let i = 0; i < dias; i++) {
      const d = new Date(hoy); d.setDate(hoy.getDate() - i)
      if (d.getDay() === 0) continue
      vecesPorDia[(d.getDay() + 6) % 7] += 1
    }

    const dataDias = porDia.map((p, i) => ({
      dia: p.dia,
      corto: p.dia.slice(0, 3),
      autos: p.autos,
      ingresos: Math.round(p.ingresos),
      promedio: vecesPorDia[i] > 0 ? Math.round((p.autos / vecesPorDia[i]) * 10) / 10 : 0,
      promIngreso: vecesPorDia[i] > 0 ? Math.round(p.ingresos / vecesPorDia[i]) : 0,
    }))

    // Solo el horario de atencion: lo marcado fuera se reparte dentro siguiendo
    // la tendencia, para que el grafico refleje cuando entra el trabajo de
    // verdad y no cuando se registro el ticket.
    const { dentro, autosFuera, ingresosFuera } = repartirFueraDeHorario(porHora)
    const dataHoras = dentro.map(h => ({
      ...h,
      label: `${String(h.hora).padStart(2, '0')}:00`,
      ingresos: Math.round(h.ingresos),
    }))

    const conMarca = dataHoras.reduce((s, h) => s + h.autos, 0)
    const mejorDia  = [...dataDias].sort((a, b) => b.promedio - a.promedio)[0]
    const peorDia   = [...dataDias].filter(d => d.autos > 0).sort((a, b) => a.promedio - b.promedio)[0]
    const horaPico  = [...dataHoras].sort((a, b) => b.autos - a.autos)[0]

    // Ventana de almuerzo: las dos horas más flojas entre las 11 y las 16.
    const mediodia = dataHoras.filter(h => h.hora >= 11 && h.hora <= 15)
    let almuerzo = null
    for (let i = 0; i < mediodia.length - 1; i++) {
      const suma = mediodia[i].autos + mediodia[i + 1].autos
      if (!almuerzo || suma < almuerzo.suma) almuerzo = { desde: mediodia[i].hora, suma }
    }

    // Hasta qué hora llega el 90% de los autos: lo que pasa después no justifica
    // tener el taller abierto.
    let acumulado = 0
    let cierre = null
    for (const h of dataHoras) {
      acumulado += h.autos
      if (!cierre && conMarca > 0 && acumulado >= conMarca * 0.9) cierre = h.hora
    }

    // ── Carga de taller: cuanta gente pide el trabajo que entra ──────────────
    // Un lavado se mide por las horas que el auto esta en el taller. Un trabajo
    // de varios dias (una pintura general) no: topar su duracion en una jornada
    // convertia 20 dias de trabajo en 9 horas, justo en los trabajos que mas
    // gente ocupan. Esos se reparten como una persona dedicada cada dia habil
    // que duran, que es como se trabajan de verdad.
    const porFecha = new Map()
    const sumar = (fechaISO, horas) => {
      const [y, m, d] = fechaISO.split('-').map(Number)
      const dow = new Date(y, m - 1, d).getDay()
      if (dow === 0) return                       // domingo no se trabaja
      const acc = porFecha.get(fechaISO) || { horas: 0, autos: 0, idx: (dow + 6) % 7 }
      acc.horas += horas
      porFecha.set(fechaISO, acc)
    }
    const hoyISO = new Date().toISOString().slice(0, 10)
    const lavados = lista.filter(esLavado)
    const otrosServicios = lista.length - lavados.length
    for (const t of lavados) {
      if (!t.opened_at) continue
      // Un trabajo realmente abierto sigue ocupando el taller y cuenta hasta
      // hoy. Un ticket ya cerrado al que le falta la fecha de cierre es un dato
      // incompleto, no un trabajo de meses: se cuenta como de un dia. Sin esta
      // distincion seis tickets viejos sin cerrar sumaban seis personas fijas.
      // El auto se cuenta el dia que entro, aunque su trabajo se reparta.
      const [ay, am, ad] = t.date.split('-').map(Number)
      const acc0 = porFecha.get(t.date) || { horas: 0, autos: 0, idx: (new Date(ay, am - 1, ad).getDay() + 6) % 7 }
      porFecha.set(t.date, { ...acc0, autos: acc0.autos + 1 })

      const abierto = t.status !== 'cerrado'
      if (!t.closed_at && !abierto) { sumar(t.date, TOPE_HORAS_TICKET / 2); continue }
      const ini = new Date(t.opened_at)
      const fin = t.closed_at ? new Date(t.closed_at) : new Date()
      const horas = (fin - ini) / 3600000
      if (!(horas > 0)) continue

      const iniISO = ini.toISOString().slice(0, 10)
      const finISO = fin.toISOString().slice(0, 10)
      if (iniISO === finISO) {
        sumar(iniISO, Math.min(horas, TOPE_HORAS_TICKET))
        continue
      }
      // Varios dias: una persona dedicada por cada dia habil que dura, hasta un
      // tope para que un ticket olvidado sin cerrar no distorsione el promedio.
      let cursor = new Date(ini)
      let dias = 0
      while (cursor.toISOString().slice(0, 10) <= finISO && dias < TOPE_DIAS_TRABAJO) {
        const iso = cursor.toISOString().slice(0, 10)
        if (iso <= hoyISO) { sumar(iso, HORAS_EFECTIVAS_TRABAJADOR); dias += 1 }
        cursor.setDate(cursor.getDate() + 1)
      }
    }
    const jornadas = [...porFecha.values()]
    let carga = null
    if (jornadas.length) {
      // De horas de reloj a horas-persona: es lo que de verdad hay que cubrir.
      const horas = jornadas.map(j => j.horas * PERSONAS_POR_SERVICIO).sort((a, b) => a - b)
      const media = horas.reduce((a, b) => a + b, 0) / horas.length
      const p90 = horas[Math.min(horas.length - 1, Math.floor(horas.length * 0.9))]
      // El equipo nunca baja del par que exige atender un servicio.
      const equipo = h => Math.max(PERSONAS_POR_SERVICIO, Math.ceil(h / HORAS_EFECTIVAS_TRABAJADOR))
      // Por dia de la semana, que es lo que sirve para repartir a la gente.
      const porDiaSemana = DIAS_SEMANA.map((nombre, i) => {
        const dias = jornadas.filter(j => j.idx === i)
        const prom = dias.length
          ? (dias.reduce((a, j) => a + j.horas, 0) / dias.length) * PERSONAS_POR_SERVICIO
          : 0
        return {
          dia: nombre,
          corto: nombre.slice(0, 3),
          horas: Math.round(prom * 10) / 10,
          // Con decimal, no redondeado hacia arriba: 2.2 y 1.8 son casi lo
          // mismo, pero redondeados se leian como 3 contra 2 y parecia que un
          // dia necesitaba una persona entera mas que otro.
          personas: prom > 0 ? Math.round((prom / HORAS_EFECTIVAS_TRABAJADOR) * 10) / 10 : 0,
        }
      })
      carga = {
        horasProm: Math.round(media * 10) / 10,
        horasPico: Math.round(p90 * 10) / 10,
        autosProm: Math.round((jornadas.reduce((a, j) => a + j.autos, 0) / jornadas.length) * 10) / 10,
        personasProm: equipo(media),
        personasPico: equipo(p90),
        // Cuanto de la jornada del equipo se llena de verdad. Es lo que dice si
        // sobra tiempo para vender mas o si ya no cabe otro auto.
        ocupacionProm: Math.round((media / (equipo(p90) * HORAS_EFECTIVAS_TRABAJADOR)) * 100),
        ocupacionPico: Math.round((p90 / (equipo(p90) * HORAS_EFECTIVAS_TRABAJADOR)) * 100),
        porDiaSemana,
        jornadas: jornadas.length,
        otrosServicios,
      }
    }

    return { dataDias, dataHoras, mejorDia, peorDia, horaPico, almuerzo, cierre, total: lista.length, conMarca, domingos, autosFuera, ingresosFuera, carga }
  }, [rows, dias])

  return (
    <div className="card">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="text-base">📊</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white">Afluencia por día y hora</p>
          <p className="text-xs text-gray-400">Cuándo entra el trabajo, para organizar turnos y almuerzos · sin domingos</p>
        </div>
        <div className="flex gap-1">
          {RANGOS_AFLUENCIA.map(r => (
            <button key={r.dias} onClick={() => setDias(r.dias)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                dias === r.dias
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <p className="text-xs text-gray-400 text-center py-8">Cargando…</p>
      ) : !analisis ? (
        <p className="text-xs text-gray-400 text-center py-8">Sin servicios en este período</p>
      ) : (
        <div className="space-y-5 mt-3">
          {/* Días de la semana */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Promedio de autos por día</p>
              <p className="text-[11px] text-gray-400">
                {analisis.total} servicios
                {analisis.domingos > 0 && <span className="text-gray-300 dark:text-gray-600"> · {analisis.domingos} de domingo fuera</span>}
              </p>
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analisis.dataDias} margin={{ top: 16, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="corto" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 6 }}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', fontSize: 12 }}
                    labelFormatter={(_, p) => p?.[0]?.payload?.dia || ''}
                    formatter={(v, n, p) => n === 'promedio'
                      ? [`${v} autos/día · ${formatMoney(p.payload.promIngreso)}`, 'Promedio']
                      : [v, n]} />
                  <Bar dataKey="promedio" radius={[6, 6, 2, 2]} maxBarSize={44}>
                    <LabelList dataKey="promedio" position="top" offset={5}
                      style={{ fontSize: 10, fontWeight: 700, fill: '#6b7280' }} />
                    {analisis.dataDias.map(d => (
                      <Cell key={d.dia} fill={d.dia === analisis.mejorDia?.dia ? '#dc2626' : '#fca5a5'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Horas del día */}
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Autos que entran por hora</p>
              <p className="text-[11px] text-gray-400">{analisis.conMarca} con hora registrada</p>
            </div>
            {analisis.autosFuera > 0 && (
              <p className="text-[10px] text-gray-400 mb-1">
                Horario 8:30–18:00 · {analisis.autosFuera} auto{analisis.autosFuera === 1 ? '' : 's'} con
                marca fuera de horario (registro tardío) repartido{analisis.autosFuera === 1 ? '' : 's'} según la tendencia del día
              </p>
            )}
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analisis.dataHoras} margin={{ top: 16, right: 4, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 6 }}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', fontSize: 12 }}
                    formatter={(v, n, p) => [`${v} autos · ${formatMoney(p.payload.ingresos)}`, 'Entradas']} />
                  <Bar dataKey="autos" radius={[6, 6, 2, 2]} maxBarSize={30}>
                    <LabelList dataKey="autos" position="top" offset={5}
                      style={{ fontSize: 9, fontWeight: 700, fill: '#6b7280' }} />
                    {analisis.dataHoras.map(h => (
                      <Cell key={h.hora}
                        fill={h.hora === analisis.horaPico?.hora ? '#dc2626'
                          : (analisis.almuerzo && (h.hora === analisis.almuerzo.desde || h.hora === analisis.almuerzo.desde + 1)) ? '#93c5fd'
                          : '#fca5a5'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-1.5">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-600" /><span className="text-[11px] text-gray-400">Hora pico</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-300" /><span className="text-[11px] text-gray-400">Mejor rato para almorzar</span></div>
            </div>
          </div>

          {/* Qué hacer con esto */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Día más cargado</p>
              <p className="text-sm font-black text-gray-900 dark:text-white">{analisis.mejorDia?.dia || '—'}</p>
              <p className="text-[11px] text-gray-400">{analisis.mejorDia?.promedio} autos · {formatMoney(analisis.mejorDia?.promIngreso || 0)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Día más flojo</p>
              <p className="text-sm font-black text-gray-900 dark:text-white">{analisis.peorDia?.dia || '—'}</p>
              <p className="text-[11px] text-gray-400">{analisis.peorDia?.promedio} autos · {formatMoney(analisis.peorDia?.promIngreso || 0)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Hora pico</p>
              <p className="text-sm font-black text-gray-900 dark:text-white">
                {analisis.horaPico ? `${String(analisis.horaPico.hora).padStart(2, '0')}:00` : '—'}
              </p>
              <p className="text-[11px] text-gray-400">{analisis.horaPico?.autos || 0} autos entraron a esa hora</p>
            </div>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 px-3 py-2">
              <p className="text-[10px] text-blue-400 uppercase tracking-wide">Almuerzo sugerido</p>
              <p className="text-sm font-black text-blue-700 dark:text-blue-300">
                {analisis.almuerzo
                  ? `${String(analisis.almuerzo.desde).padStart(2, '0')}:00 – ${String(analisis.almuerzo.desde + 2).padStart(2, '0')}:00`
                  : '—'}
              </p>
              <p className="text-[11px] text-blue-400">Las dos horas más tranquilas del mediodía</p>
            </div>
          </div>

          {analisis.cierre != null && (
            <p className="text-[11px] text-gray-400 leading-relaxed">
              El 90% de los autos entra antes de las {String(analisis.cierre + 1).padStart(2, '0')}:00.
              Después de esa hora casi no llega trabajo nuevo: sirve para decidir hasta cuándo tener gente en el taller.
            </p>
          )}

          {/* Cuánta gente pide el trabajo que entra */}
          {analisis.carga && (
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Personal fijo de lavados</p>
                <p className="text-[11px] text-gray-400">
                  {analisis.carga.jornadas} días con trabajo
                  {analisis.carga.otrosServicios > 0 && ` · ${analisis.carga.otrosServicios} servicios de técnico aparte, fuera`}
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Día promedio</p>
                  <p className="text-sm font-black text-gray-900 dark:text-white">{analisis.carga.personasProm} {analisis.carga.personasProm === 1 ? 'persona' : 'personas'}</p>
                  <p className="text-[11px] text-gray-400">{analisis.carga.horasProm} h‑persona · {analisis.carga.autosProm} autos</p>
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                  <p className="text-[10px] text-amber-500 uppercase tracking-wide">Día cargado</p>
                  <p className="text-sm font-black text-amber-700 dark:text-amber-300">{analisis.carga.personasPico} {analisis.carga.personasPico === 1 ? 'persona' : 'personas'}</p>
                  <p className="text-[11px] text-amber-500">{analisis.carga.horasPico} h‑persona</p>
                </div>
                <div className={`rounded-xl px-3 py-2 ${
                  plantilla >= analisis.carga.personasPico
                    ? 'bg-emerald-50 dark:bg-emerald-900/20'
                    : 'bg-red-50 dark:bg-red-900/20'
                }`}>
                  <p className={`text-[10px] uppercase tracking-wide ${plantilla >= analisis.carga.personasPico ? 'text-emerald-500' : 'text-red-400'}`}>Tienes hoy</p>
                  <p className={`text-sm font-black ${plantilla >= analisis.carga.personasPico ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                    {plantilla} {plantilla === 1 ? 'persona' : 'personas'}
                  </p>
                  <p className={`text-[11px] ${plantilla >= analisis.carga.personasPico ? 'text-emerald-500' : 'text-red-400'}`}>
                    {plantilla >= analisis.carga.personasPico
                      ? 'Cubre hasta los días cargados'
                      : `Faltan ${analisis.carga.personasPico - plantilla} en día cargado`}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Ocupación</p>
                  <p className="text-sm font-black text-gray-900 dark:text-white">{analisis.carga.ocupacionProm}%</p>
                  <p className="text-[11px] text-gray-400">{analisis.carga.ocupacionPico}% en día cargado</p>
                </div>
              </div>

              {/* Por día de la semana: sirve para repartir a la gente */}
              <div className="flex gap-1.5 flex-wrap">
                {analisis.carga.porDiaSemana.map(d => (
                  <div key={d.dia} className="flex-1 min-w-[62px] rounded-lg bg-gray-50 dark:bg-gray-800/50 px-2 py-1.5 text-center">
                    <p className="text-[10px] text-gray-400 uppercase">{d.corto}</p>
                    <p className={`text-sm font-black ${
                      d.personas > plantilla ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                    }`}>{d.personas || '—'}</p>
                    <p className="text-[10px] text-gray-400">{d.horas} h</p>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-gray-400 leading-relaxed mt-2">
                Solo lavados: planchado, cerámicos, polarizados y pintura los cubren técnicos que vienen esos
                días, así que no deben pesar al dimensionar la plantilla fija. Cada servicio lo atienden
                {PERSONAS_POR_SERVICIO} personas para que salga más rápido, así que cada hora de reloj del ticket
                cuenta como {PERSONAS_POR_SERVICIO} horas‑persona, y el equipo nunca baja de {PERSONAS_POR_SERVICIO}
                aunque sobre tiempo. Las cifras por día son personas con decimal: 2.2 y 1.8 son casi lo mismo,
                aunque redondeados parezcan 3 y 2. Los tickets anteriores a agosto no guardaban categoría; para
                esos se toma como lavado el trabajo del mismo día por debajo de S/{PRECIO_MAX_LAVADO}.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ExpensesPanel({ expenses, workers }) {
  const { updateExpense, deleteExpense, addExpense, tickets } = useApp()
  const { isAdmin, isDemo } = useAuth()
  const canAdmin = isAdmin || isDemo
  const [expanded,     setExpanded]     = useState(false)
  const [filterCat,    setFilterCat]    = useState('')
  const [filterWorker, setFilterWorker] = useState('')
  const [filterFrom,   setFilterFrom]   = useState('')
  const [filterTo,     setFilterTo]     = useState('')
  const [sortBy,       setSortBy]       = useState('date_desc')
  const [editingExp,   setEditingExp]   = useState(null)
  const [showAdd,      setShowAdd]      = useState(false)
  const [addForm,      setAddForm]      = useState({ amount: '', category: 'insumos', worker_id: '', notes: '', date: new Date().toISOString().slice(0, 10), ticket_id: '' })
  // Servicios abiertos: un gasto se puede colgar del ticket que lo generó y así
  // entra en la ganancia de ese servicio, no solo en los gastos del día.
  const openTickets = useMemo(
    () => (tickets || []).filter(t => t.status === 'abierto')
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    [tickets]
  )
  const ticketLabel = t => `${t.plate || 'Sin placa'}${t.vehicle_subtype ? ` · ${t.vehicle_subtype}` : ''}`
  const ticketById = id => (tickets || []).find(t => t.id === id)
  const [saving,       setSaving]       = useState(false)

  async function handleAdd() {
    if (!addForm.amount || isNaN(addForm.amount)) { toast.error('Ingresa un monto válido'); return }
    setSaving(true)
    try {
      await addExpense({ ...addForm, amount: parseFloat(addForm.amount), worker_id: addForm.worker_id || null, ticket_id: addForm.ticket_id || null })
      setAddForm({ amount: '', category: 'insumos', worker_id: '', notes: '', date: new Date().toISOString().slice(0, 10), ticket_id: '' })
      setShowAdd(false)
      toast.success('Gasto registrado')
    } catch { toast.error('Error al registrar') } finally { setSaving(false) }
  }

  const filtered = useMemo(() => {
    let list = [...expenses]
    if (filterCat)    list = list.filter(e => e.category === filterCat)
    if (filterWorker) list = list.filter(e => e.worker_id === filterWorker)
    if (filterFrom)   list = list.filter(e => e.date >= filterFrom)
    if (filterTo)     list = list.filter(e => e.date <= filterTo)
    list.sort((a, b) => {
      if (sortBy === 'date_desc')   return b.date.localeCompare(a.date)
      if (sortBy === 'date_asc')    return a.date.localeCompare(b.date)
      if (sortBy === 'amount_desc') return b.amount - a.amount
      if (sortBy === 'amount_asc')  return a.amount - b.amount
      return 0
    })
    return list
  }, [expenses, filterCat, filterWorker, filterFrom, filterTo, sortBy])

  const total = filtered.reduce((s, e) => s + (e.amount || 0), 0)
  const activeWorkers = workers.filter(w => expenses.some(e => e.worker_id === w.id))

  return (
    <div className="card">
      {/* Header siempre visible */}
      <div className="flex items-center gap-2">
        <span className="text-base">💸</span>
        <p className="text-sm font-bold text-gray-900 dark:text-white flex-1">Gastos de personal</p>
        <span className="text-sm font-black text-amber-600">-{formatMoney(total)}</span>
        {canAdmin && (
          <button onClick={() => setShowAdd(v => !v)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 transition-colors">
            + Registrar gasto
          </button>
        )}
        <button onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          {expanded ? 'Ocultar' : 'Ver más'}
        </button>
      </div>

      {/* Resumen compacto cuando está cerrado */}
      {!expanded && (
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className="text-xs text-gray-400">{expenses.length} gasto{expenses.length !== 1 ? 's' : ''} este período</span>
          {[...new Set(expenses.map(e => e.category).filter(Boolean))].map(cat => {
            const catTotal = expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)
            if (!catTotal) return null
            return <span key={cat} className="text-xs text-gray-500">{CAT_LABELS[cat] || cat}: <span className="font-semibold text-amber-600">-{formatMoney(catTotal)}</span></span>
          })}
        </div>
      )}

      {/* Todo lo demás colapsable */}
      {expanded && (<>

      {/* Formulario rápido */}
      {showAdd && canAdmin && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-2 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Monto</p>
              <input type="number" className="input text-sm py-1.5" placeholder="0.00"
                value={addForm.amount} onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Categoría</p>
              <select className="input text-sm py-1.5" value={addForm.category}
                onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}>
                {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Trabajador</p>
              <select className="input text-sm py-1.5" value={addForm.worker_id}
                onChange={e => setAddForm(f => ({ ...f, worker_id: e.target.value }))}>
                <option value="">Sin asignar</option>
                {workers.filter(w => w.active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Fecha</p>
              <input type="date" className="input text-sm py-1.5" value={addForm.date}
                onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Servicio (opcional)</p>
            <select className="input text-sm py-1.5" value={addForm.ticket_id}
              onChange={e => setAddForm(f => ({ ...f, ticket_id: e.target.value }))}>
              <option value="">Sin servicio — gasto del día</option>
              {openTickets.map(t => <option key={t.id} value={t.id}>🔧 {ticketLabel(t)}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Descripción</p>
            <input type="text" className="input text-sm py-1.5" placeholder="Opcional"
              value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowAdd(false)}
              className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              Cancelar
            </button>
            <button onClick={handleAdd} disabled={saving}
              className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar gasto'}
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-3">
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent">
          <option value="">Todas las categorías</option>
          {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {activeWorkers.length > 0 && (
          <select value={filterWorker} onChange={e => setFilterWorker(e.target.value)}
            className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent">
            <option value="">Todos los trabajadores</option>
            {activeWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent">
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex items-center gap-1.5 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">Desde</span>
          <input type="date" className="text-xs bg-transparent text-gray-700 dark:text-gray-300 focus:outline-none"
            value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">Hasta</span>
          <input type="date" className="text-xs bg-transparent text-gray-700 dark:text-gray-300 focus:outline-none"
            value={filterTo} min={filterFrom} onChange={e => setFilterTo(e.target.value)} />
        </div>
        {(filterCat || filterWorker || filterFrom || filterTo) && (
          <button onClick={() => { setFilterCat(''); setFilterWorker(''); setFilterFrom(''); setFilterTo('') }}
            className="text-xs text-red-500 border border-red-200 dark:border-red-900 rounded-lg px-2 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-600 transition-colors">
            Limpiar
          </button>
        )}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">Sin gastos con estos filtros</p>
      ) : (
        <div className="space-y-0">
          {filtered.map(exp => {
            const worker = workers.find(w => w.id === exp.worker_id)
            const isEditing = editingExp?.id === exp.id

            if (isEditing && canAdmin) return (
              <div key={exp.id} className="py-2 border-b border-gray-100 dark:border-gray-800 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Monto</p>
                    <input type="number" className="input text-xs py-1" value={editingExp.amount}
                      onChange={e => setEditingExp(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Fecha</p>
                    <input type="date" className="input text-xs py-1" value={editingExp.date}
                      onChange={e => setEditingExp(f => ({ ...f, date: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Categoría</p>
                    <select className="input text-xs py-1" value={editingExp.category || ''}
                      onChange={e => setEditingExp(f => ({ ...f, category: e.target.value }))}>
                      {Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Trabajador</p>
                    <select className="input text-xs py-1" value={editingExp.worker_id || ''}
                      onChange={e => setEditingExp(f => ({ ...f, worker_id: e.target.value }))}>
                      <option value="">Sin asignar</option>
                      {workers.filter(w => w.active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
                <input className="input text-xs py-1" placeholder="Notas" value={editingExp.notes || ''}
                  onChange={e => setEditingExp(f => ({ ...f, notes: e.target.value }))} />
                {/* Servicio al que pertenece el gasto */}
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Servicio (opcional)</p>
                  <select className="input text-xs py-1" value={editingExp.ticket_id || ''}
                    onChange={e => setEditingExp(f => ({ ...f, ticket_id: e.target.value || null }))}>
                    <option value="">Sin servicio — gasto del día</option>
                    {openTickets.map(t => <option key={t.id} value={t.id}>🔧 {ticketLabel(t)}</option>)}
                    {/* Si ya estaba colgado de un servicio cerrado, no se pierde al editar. */}
                    {editingExp.ticket_id && !openTickets.some(t => t.id === editingExp.ticket_id) && (
                      <option value={editingExp.ticket_id}>
                        {ticketById(editingExp.ticket_id) ? `✓ ${ticketLabel(ticketById(editingExp.ticket_id))} (cerrado)` : 'Servicio actual'}
                      </option>
                    )}
                  </select>
                </div>

                {/* Estado de pago: un pendiente no descuenta hasta marcarse pagado. */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400 mr-0.5">Estado:</span>
                  {[{ v: true, l: 'Pagado' }, { v: false, l: 'Pendiente' }].map(({ v, l }) => (
                    <button key={String(v)} type="button"
                      onClick={() => setEditingExp(f => ({ ...f, paid: v }))}
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-colors ${
                        (editingExp.paid !== false) === v
                          ? (v ? 'bg-green-600 border-green-600 text-white' : 'bg-amber-500 border-amber-500 text-white')
                          : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-300 dark:border-gray-600'
                      }`}>{l}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => {
                    try {
                      await updateExpense(exp.id, { ...editingExp, amount: parseFloat(editingExp.amount), paid: editingExp.paid !== false, ticket_id: editingExp.ticket_id || null })
                      toast.success('Gasto actualizado')
                      setEditingExp(null)
                    } catch { toast.error('Error al actualizar') }
                  }} className="flex-1 py-1.5 bg-red-600 text-white text-xs font-bold rounded-xl">Guardar</button>
                  <button onClick={() => setEditingExp(null)} className="px-3 py-1.5 border border-gray-200 text-xs rounded-xl text-gray-600">Cancelar</button>
                </div>
              </div>
            )

            return (
              // Los pendientes se tinen por completo: una etiqueta sola se
              // pierde en una lista larga y no permite reconocerlos de un
              // vistazo. Al marcarlos pagados vuelven al estilo normal.
              <div key={exp.id} className={`flex items-center gap-2 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 ${
                exp.paid === false
                  ? 'bg-amber-50 dark:bg-amber-950/25 -mx-2 px-2 rounded-lg border-l-4 border-l-amber-400'
                  : ''
              }`}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{CAT_LABELS[exp.category] || exp.category || 'Gasto'}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {worker && <span className="text-xs text-gray-400">{worker.name}</span>}
                    {exp.method === 'efectivo' && <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded-md">💵 Efectivo</span>}
                    {exp.method === 'yape'     && <span className="text-xs font-medium text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded-md">💜 Yape</span>}
                    {/* Los gastos con ticket vienen de un servicio concreto:
                        conviene distinguirlos de los generales del taller. */}
                    {exp.ticket_id && (
                      <span className="text-xs font-medium text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded-md">
                        🎫 {ticketById(exp.ticket_id)?.plate || 'De un servicio'}
                      </span>
                    )}
                    {exp.paid === false && (
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-md">
                        ⏳ Pendiente de pago
                      </span>
                    )}
                    {exp.description && <span className="text-xs text-gray-400 italic truncate">· {exp.description}</span>}
                    {exp.notes && <span className="text-xs text-gray-400 italic truncate">· {exp.notes}</span>}
                    <span className="text-xs text-gray-300 dark:text-gray-600">{exp.date}</span>
                  </div>
                </div>
                <span className={`text-xs font-bold flex-shrink-0 ${
                  exp.paid === false ? 'text-amber-700 dark:text-amber-400' : 'text-amber-600'
                }`}>-{formatMoney(exp.amount)}</span>
                {canAdmin && (
                  <>
                    <button onClick={() => setEditingExp({ ...exp })}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex-shrink-0">
                      <Pencil className="w-3 h-3 text-gray-400" />
                    </button>
                    <button onClick={async () => { try { await deleteExpense(exp.id); toast.success('Eliminado') } catch { toast.error('Error') } }}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex-shrink-0">
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
        <span className="text-xs text-gray-400">{filtered.length} gasto{filtered.length !== 1 ? 's' : ''}</span>
        <span className="text-xs font-black text-amber-600">-{formatMoney(total)}</span>
      </div>

      </>)}
    </div>
  )
}

const RANK_SORTS = [
  { value: 'income',      label: 'Ingresos' },
  { value: 'cars',        label: 'Vehículos' },
  { value: 'avgCar',      label: 'Prom/carro' },
  { value: 'avgDay',      label: 'Prom/día' },
  { value: 'daysHitGoal', label: 'Metas' },
]

function RankingPanel({ ranking, workingDaysElapsed }) {
  const [sort, setSort] = useState('income')

  const sorted = useMemo(() => {
    const days = workingDaysElapsed || 1
    return [...ranking]
      .map(r => ({ ...r, avgCar: r.cars > 0 ? r.income / r.cars : 0, avgDay: r.income / days }))
      .sort((a, b) => b[sort] - a[sort])
  }, [ranking, sort, workingDaysElapsed])

  const valueLabel = r => {
    if (sort === 'cars')        return `${r.cars} veh.`
    if (sort === 'avgCar')      return formatMoney(r.avgCar)
    if (sort === 'avgDay')      return formatMoney(r.avgDay)
    if (sort === 'daysHitGoal') return r.dailyGoal > 0 ? `${r.daysHitGoal} día${r.daysHitGoal !== 1 ? 's' : ''}` : '—'
    return formatMoney(r.income)
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <p className="text-sm font-bold text-gray-900 dark:text-white">Ranking de trabajadores</p>
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap mb-4">
        {RANK_SORTS.map(s => (
          <button key={s.value} onClick={() => setSort(s.value)}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors ${sort === s.value ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {sorted.map((r, i) => (
          <div key={r.worker.id} className="flex items-center gap-3">
            <span className={`w-6 text-center text-sm font-black ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-700' : 'text-gray-400'}`}>{i + 1}</span>
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 font-bold text-xs flex-none">{r.worker.name[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{r.worker.name}</p>
              <p className="text-xs text-gray-400">{r.cars} veh. · prom {formatMoney(r.avgCar)}/carro · {formatMoney(r.avgDay)}/día</p>
              {r.dailyGoal > 0 && (
                <div className="mt-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-gray-400">
                      Meta {formatMoney(r.dailyGoal)}/día · <span className="font-semibold text-gray-600 dark:text-gray-300">{r.daysHitGoal} día{r.daysHitGoal !== 1 ? 's' : ''} cumplido{r.daysHitGoal !== 1 ? 's' : ''}</span>
                    </span>
                    <span className={`text-[10px] font-bold ml-2 ${r.goalPct >= 80 ? 'text-green-500' : r.goalPct >= 50 ? 'text-yellow-500' : 'text-red-400'}`}>
                      {r.goalPct}%
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className={`h-full rounded-full ${r.goalPct >= 80 ? 'bg-green-500' : r.goalPct >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(r.goalPct, 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-white shrink-0">{valueLabel(r)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { tickets, dailySummaries, expenses, workers, services, incidents, monthlyCosts, bonuses, addBonus, deleteBonus, loading, loadData, invalidateAllCache, vehicleTypes, fetchCasualPayments, fetchBusinessTrend, fetchWorkerMonthlyConfigs, fetchWorkerConfigsUpTo, fetchMonthlyCosts, fetchAdvances } = useApp()
  const { month: cm, year: cy } = currentMonthYear()
  const [selMonth, setSelMonth] = useState(cm)
  const [selYear,  setSelYear]  = useState(cy)
  const [rangeFrom, setRangeFrom] = useState(null)
  const [rangeTo,   setRangeTo]   = useState(null)
  const isCurrentMonth = selMonth === cm && selYear === cy
  const hasRange = rangeFrom && rangeTo

  const [avgTimeOrder, setAvgTimeOrder] = useState(() => {
    try { return JSON.parse(localStorage.getItem('apexpro_avgtime_order') || 'null') } catch { return null }
  })
  const [avgTimeHidden, setAvgTimeHidden] = useState(() => {
    try { return JSON.parse(localStorage.getItem('apexpro_avgtime_hidden') || '[]') } catch { return [] }
  })
  const [editingAvgTime, setEditingAvgTime] = useState(false)
  const [avgTimeFilter, setAvgTimeFilter] = useState('all')

  function saveAvgTimePrefs(order, hidden) {
    localStorage.setItem('apexpro_avgtime_order', JSON.stringify(order))
    localStorage.setItem('apexpro_avgtime_hidden', JSON.stringify(hidden))
  }

  const DEFAULT_PANEL_ORDER = ['kpis','adelantos','tendencia','afluencia','mix','clientes','tiempos','progreso','estadisticas','cobros','gastos','gastos_personal','ranking','bonos','grafico']
  const [panelOrder, setPanelOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('apexpro_panel_order') || 'null')
      if (!Array.isArray(saved) || !saved.length) return DEFAULT_PANEL_ORDER

      // El orden guardado se respeta, pero hay que reconciliarlo: descartar los
      // paneles que ya no existen y añadir los que se agregaron después de que
      // el usuario guardó su orden. Sin esto, quien alguna vez reordenó paneles
      // nunca llega a ver los nuevos.
      const vigentes  = saved.filter(id => DEFAULT_PANEL_ORDER.includes(id))
      const faltantes = DEFAULT_PANEL_ORDER.filter(id => !vigentes.includes(id))
      if (!faltantes.length) return vigentes

      const merged = [...vigentes]
      faltantes.forEach(id => {
        // Insertarlo justo detrás del panel que lo precede por defecto, para
        // que caiga cerca de donde fue diseñado y no siempre al final.
        const pos = DEFAULT_PANEL_ORDER.indexOf(id)
        let idx = merged.length
        for (let i = pos - 1; i >= 0; i--) {
          const at = merged.indexOf(DEFAULT_PANEL_ORDER[i])
          if (at !== -1) { idx = at + 1; break }
        }
        merged.splice(idx, 0, id)
      })
      return merged
    } catch { return DEFAULT_PANEL_ORDER }
  })
  const [editingLayout, setEditingLayout] = useState(false)

  function movePanelSection(id, dir) {
    setPanelOrder(prev => {
      const arr = [...prev]
      const i = arr.indexOf(id)
      const ni = i + dir
      if (ni < 0 || ni >= arr.length) return prev
      ;[arr[i], arr[ni]] = [arr[ni], arr[i]]
      localStorage.setItem('apexpro_panel_order', JSON.stringify(arr))
      return arr
    })
  }

  const [refreshing, setRefreshing] = useState(false)
  async function handleRefresh() {
    setRefreshing(true)
    invalidateAllCache()
    await loadData()
    setRefreshing(false)
  }

  const [pastTickets,    setPastTickets]    = useState([])
  const [pastSummaries,  setPastSummaries]  = useState([])
  const [pastExpenses,   setPastExpenses]   = useState([])

  useEffect(() => {
    if (isCurrentMonth || IS_DEMO) { setPastTickets([]); setPastSummaries([]); setPastExpenses([]); return }
    const p = `${selYear}-${String(selMonth).padStart(2,'0')}`
    const nextM = selMonth === 12 ? 1 : selMonth + 1
    const nextY = selMonth === 12 ? selYear + 1 : selYear
    const endP  = `${nextY}-${String(nextM).padStart(2,'0')}-01`
    Promise.all([
      supabase.from('tickets').select('*').gte('date', `${p}-01`).lt('date', endP).neq('status', 'abierto'),
      supabase.from('daily_summary').select('*').gte('date', `${p}-01`).lt('date', endP),
      supabase.from('worker_expenses').select('*').gte('date', `${p}-01`).lt('date', endP),
    ]).then(([t, s, e]) => { setPastTickets(t.data || []); setPastSummaries(s.data || []); setPastExpenses(e.data || []) })
  }, [selMonth, selYear, isCurrentMonth])
  const prefix = `${selYear}-${String(selMonth).padStart(2, '0')}`
  const lastDayOfMonth = new Date(selYear, selMonth, 0).getDate()

  // Adelantos del mes: viven en su propia tabla porque un servicio puede
  // recibir varios.
  const [advances, setAdvances] = useState([])
  useEffect(() => {
    fetchAdvances(selYear, selMonth).then(setAdvances)
  }, [selMonth, selYear])

  // Pagos a trabajadores eventuales del mes — cuentan como mano de obra.
  const [casualPayments, setCasualPayments] = useState([])
  useEffect(() => {
    fetchCasualPayments(selYear, selMonth).then(setCasualPayments)
  }, [selMonth, selYear])

  // Costos del mes seleccionado. `monthlyCosts` del contexto representa siempre
  // el mes en curso, así que al navegar a otro mes se mostrarían costos ajenos.
  const [selectedCosts, setSelectedCosts] = useState(null)
  useEffect(() => {
    if (isCurrentMonth) { setSelectedCosts(monthlyCosts); return }
    fetchMonthlyCosts(selYear, selMonth).then(mc =>
      setSelectedCosts(mc && mc.month === selMonth && mc.year === selYear ? mc : null))
  }, [selMonth, selYear, isCurrentMonth, monthlyCosts])

  // Sueldos congelados del mes: sin esto la planilla del dashboard usaría el
  // sueldo vigente y no cuadraría con la pestaña Nómina.
  const [workerMonthlyConfigs, setWorkerMonthlyConfigs] = useState([])
  const [workerConfigsHasta, setWorkerConfigsHasta] = useState([])
  useEffect(() => {
    fetchWorkerMonthlyConfigs(selYear, selMonth).then(setWorkerMonthlyConfigs)
    fetchWorkerConfigsUpTo(selYear, selMonth).then(setWorkerConfigsHasta)
  }, [selMonth, selYear])

  // ── Serie histórica para los gráficos de avance ──────────────────────────
  const [trend, setTrend] = useState([])
  useEffect(() => {
    fetchBusinessTrend(6, selYear, selMonth).then(setTrend)
  }, [selMonth, selYear])

  // Métricas de gestión derivadas de la serie histórica.
  const insights = useMemo(() => {
    if (!trend.length) return null
    // Costos = fijos + planilla + eventuales. Omitir la planilla infla la utilidad.
    const serie = trend.map(m => {
      const costos = m.costosFijos + m.planilla + m.eventuales
      return { ...m, costos, utilidad: m.ingresos - costos }
    })
    const actual = serie[serie.length - 1]
    const previo = serie[serie.length - 2]
    const variacion = previo && previo.ingresos > 0
      ? ((actual.ingresos - previo.ingresos) / previo.ingresos) * 100
      : null

    // Mix por tipo de vehículo: dónde está realmente el dinero.
    const porTipo = {}
    actual.tickets.forEach(t => {
      const k = t.vehicle_type || 'otro'
      if (!porTipo[k]) porTipo[k] = { tipo: k, ingresos: 0, carros: 0 }
      porTipo[k].ingresos += Number(t.price_charged || 0)
      porTipo[k].carros += 1
    })
    const mix = Object.values(porTipo)
      .map(x => ({ ...x, ticketProm: x.carros ? x.ingresos / x.carros : 0 }))
      .sort((a, b) => b.ingresos - a.ingresos)

    // Retención: placas del mes que ya habían venido en meses anteriores.
    const previas = new Set(serie.slice(0, -1).flatMap(m => m.placas))
    const recurrentes = actual.placas.filter(p => previas.has(p)).length
    const nuevos = actual.placas.length - recurrentes
    const pctRecurrencia = actual.placas.length
      ? (recurrentes / actual.placas.length) * 100 : 0

    return { serie, actual, previo, variacion, mix, recurrentes, nuevos, pctRecurrencia }
  }, [trend])

  const data = useMemo(() => {
    const dateFilter = (date) => {
      if (hasRange) return date >= rangeFrom && date <= rangeTo
      return date?.startsWith(prefix)
    }
    const sourceTickets    = isCurrentMonth ? tickets    : pastTickets
    const sourceSummaries  = isCurrentMonth ? dailySummaries : pastSummaries
    const sourceExpenses   = isCurrentMonth ? (expenses || []) : pastExpenses
    const periodTickets   = sourceTickets.filter(t => dateFilter(t.date) && t.status !== 'abierto')
    const periodSummaries = sourceSummaries.filter(d => dateFilter(d.date))
    const periodExpenses  = sourceExpenses.filter(e => dateFilter(e.date))

    // Promedios de tiempo por tipo+subcategoría+extras — solo desde 2026-06-23 en adelante
    const AVG_TIME_START = '2026-06-23'
    const avgTimeByType = {}
    periodTickets.forEach(t => {
      if (!t.opened_at || !t.closed_at || t.is_manual) return
      if (t.date < AVG_TIME_START) return
      const mins = Math.round((new Date(t.closed_at) - new Date(t.opened_at)) / 60000)
      if (mins < 1 || mins > 1440 * 7) return
      const extrasLabel = (t.extras?.length > 0)
        ? t.extras.map(e => e.name || e.label || e).sort().join(', ')
        : null
      const key = [t.vehicle_type, t.vehicle_subtype, extrasLabel].filter(Boolean).join('||')
      if (!avgTimeByType[key]) avgTimeByType[key] = { total: 0, count: 0, vehicle_type: t.vehicle_type, vehicle_subtype: t.vehicle_subtype || null, extras_label: extrasLabel }
      avgTimeByType[key].total += mins
      avgTimeByType[key].count += 1
    })

    const ticketIncome    = periodTickets.reduce((s, t) => s + (t.price_charged || 0), 0)
    const summaryIncome   = periodSummaries.reduce((s, d) => s + (d.total_income || 0), 0)

    // Adelantos de servicios aun abiertos. Un ticket abierto no suma a los
    // ingresos, pero su adelanto ya esta cobrado y debe verse en caja. Cuando
    // el ticket cierre, su precio total pasa a contar y el adelanto sale de
    // aqui: asi el dinero nunca se cuenta dos veces.
    const openTickets     = sourceTickets.filter(t => dateFilter(t.date) && t.status === 'abierto')
    const adelantoDe = (id) => advances
      .filter(a => a.ticket_id === id)
      .reduce((x, a) => x + Number(a.amount || 0), 0)
    const adelantosAbiertos = openTickets.reduce((s, t) => s + adelantoDe(t.id), 0)
    const ticketsConAdelanto = openTickets.filter(t => adelantoDe(t.id) > 0).length
    const ticketsAbiertos    = openTickets.length
    // El total de un ticket no es price_charged: hay que sumarle los extras y
    // restarle el descuento, igual que en la tarjeta del ticket. Con solo
    // price_charged un servicio cuyo importe vive en los extras daba saldo cero.
    const totalDeTicket = (t) => {
      const extrasTotal = (t.extras || []).reduce((a, e) => a + (e.price || 0), 0)
      const bruto = (t.price_charged || 0) + extrasTotal
      const desc  = Math.round((bruto * ((t.discount_pct || 0) / 100) + (t.discount_fixed || 0)) * 100) / 100
      return Math.max(0, bruto - desc)
    }
    const saldoPorCobrar  = openTickets.reduce(
      (s, t) => s + Math.max(0, totalDeTicket(t) - adelantoDe(t.id)), 0)
    // Los gastos pendientes estan comprometidos pero aun no salieron de caja:
    // no restan de la utilidad hasta marcarse como pagados.
    const gastosPagados   = periodExpenses.filter(e => e.paid !== false)
    const gastosPendientes = periodExpenses.filter(e => e.paid === false)
    const workerExpTotal  = gastosPagados.reduce((s, e) => s + (e.amount || 0), 0)
    const gastosPendTotal = gastosPendientes.reduce((s, e) => s + (e.amount || 0), 0)
    const totalIncome     = ticketIncome + summaryIncome + adelantosAbiertos

    const utilityGoal = selectedCosts?.utility_goal || 2000
    const costItemsData = selectedCosts?.cost_items
    const fixedItemsTotal = (costItemsData && Array.isArray(costItemsData) && costItemsData.length > 0)
      ? costItemsData.reduce((s, i) => s + (i.amount || 0), 0)
      : (selectedCosts?.rent || 0) + (selectedCosts?.supplies || 0)
    const payrollTotal = workers.filter(w => w.active).reduce((s, w) => {
      // Sueldo del mes seleccionado, no el vigente en `workers`.
      // Mismo criterio que Nomina: hereda del mes anterior si este no tiene fila.
      const { base_salary, weekly_hours } = salarioDelMes(w, workerConfigsHasta, selYear, selMonth)
      const real = calcRealSalary(base_salary, weekly_hours)
      // Descuentos reales (sin hora_extra que suma). Adelanto sí se resta porque ya aparece como expense
      const disc = incidents.filter(i => i.worker_id === w.id && i.apply_discount && !i.is_addition && i.date?.startsWith(prefix))
        .reduce((d, i) => d + (i.discount_amount || 0), 0)
      const overtime = incidents.filter(i => i.worker_id === w.id && i.apply_discount && i.is_addition && i.date?.startsWith(prefix))
        .reduce((d, i) => d + (i.discount_amount || 0), 0)
      return s + real - disc + overtime
    }, 0) + casualPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
    const monthBonusAmt = bonuses.filter(b => b.date?.startsWith(prefix)).reduce((s, b) => s + b.amount, 0)
    const rent = selectedCosts?.rent || 0
    const supplies = selectedCosts?.supplies || 0
    const totalCosts  = fixedItemsTotal + payrollTotal + monthBonusAmt + workerExpTotal

    const monthWorkingDaysTotal = getWorkingDaysInMonth(selYear, selMonth)
    const rangeWorkingDays = hasRange ? getWorkingDaysInRange(rangeFrom, rangeTo) : null

    // Días hábiles a mostrar: del rango filtrado si hay rango, si no del mes
    const workingDaysTotal    = hasRange ? rangeWorkingDays : monthWorkingDaysTotal
    const workingDaysElapsed  = hasRange ? rangeWorkingDays : (isCurrentMonth ? getWorkingDaysElapsed(selYear, selMonth) : monthWorkingDaysTotal)
    const workingDaysRemaining = hasRange ? 0 : (isCurrentMonth ? getWorkingDaysRemaining(selYear, selMonth) : 0)

    const fixedCosts = fixedItemsTotal + payrollTotal + monthBonusAmt
    // Costos fijos prorrateados a los días hábiles realmente filtrados (rango o transcurridos del mes)
    const proportionalFixed = hasRange
      ? (monthWorkingDaysTotal > 0 ? fixedCosts * (rangeWorkingDays / monthWorkingDaysTotal) : 0)
      : (isCurrentMonth && monthWorkingDaysTotal > 0 ? fixedCosts * (workingDaysElapsed / monthWorkingDaysTotal) : fixedCosts)
    const netProfit = totalIncome - proportionalFixed - workerExpTotal
    const incomeGoal  = hasRange
      ? proportionalFixed + utilityGoal * (monthWorkingDaysTotal > 0 ? rangeWorkingDays / monthWorkingDaysTotal : 0)
      : fixedItemsTotal + payrollTotal + monthBonusAmt + utilityGoal
    const progressPct = incomeGoal > 0 ? (totalIncome / incomeGoal) * 100 : 0
    const semaforo    = getSemaforoColor(progressPct)

    const avgDailyActual  = workingDaysElapsed  > 0 ? totalIncome / workingDaysElapsed  : 0
    const avgDailyNeeded  = hasRange
      ? (rangeWorkingDays > 0 ? incomeGoal / rangeWorkingDays : 0)
      : (monthWorkingDaysTotal > 0 ? incomeGoal / monthWorkingDaysTotal : 0)
    const totalCars = periodTickets.length
    // Ticket promedio: lo que deja cada vehículo atendido. Solo entra el dinero
    // de los tickets — los resúmenes diarios no traen vehículos y bajarían el
    // promedio con ingresos que no corresponden a ningún carro contado.
    const avgTicket = totalCars > 0 ? ticketIncome / totalCars : 0
    const autoTickets = periodTickets.filter(t => (t.vehicle_type || '').startsWith('auto'))
    const avgTicketAuto = autoTickets.length > 0
      ? autoTickets.reduce((s, t) => s + (t.price_charged || 0), 0) / autoTickets.length
      : 0
    // Segundo promedio, con los servicios que siguen abiertos: de esos se toma
    // lo que se va a cobrar al entregar (precio + adicionales − descuento), que
    // es lo único que hay hasta que cierren.
    const openIncomeEsperado = openTickets.reduce((s, t) => s + totalDeTicket(t), 0)
    const carsConAbiertos = totalCars + openTickets.length
    const avgTicketConAbiertos = carsConAbiertos > 0
      ? (ticketIncome + openIncomeEsperado) / carsConAbiertos
      : 0

    const efectivo      = periodTickets.filter(t => t.payment_method === 'efectivo').reduce((s, t) => s + t.price_charged, 0)
    const yape          = periodTickets.filter(t => t.payment_method === 'yape').reduce((s, t) => s + t.price_charged, 0)
    const transferencia = periodTickets.filter(t => t.payment_method === 'transferencia').reduce((s, t) => s + t.price_charged, 0)

    const byDate = {}
    periodTickets.forEach(t => { byDate[t.date] = (byDate[t.date] || 0) + t.price_charged })
    periodSummaries.forEach(d => { byDate[d.date] = (byDate[d.date] || 0) + d.total_income })
    const bestDay = Object.entries(byDate).sort((a, b) => b[1] - a[1])[0]
    const dailyData = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]))
      // El eje X usa dia/mes: la fecha completa obligaba a girar las etiquetas
      // y aun asi se cortaban en los extremos.
      .map(([date, amount]) => ({ date, label: formatDate(date), shortLabel: `${date.slice(8, 10)}/${date.slice(5, 7)}`, amount }))

    const projectedIncome = workingDaysTotal > 0 && workingDaysElapsed > 0 ? (totalIncome / workingDaysElapsed) * workingDaysTotal : 0
    const onTrack = projectedIncome >= incomeGoal

    // Ranking por trabajador
    const workerMap = {}
    periodTickets.forEach(t => {
      if (!t.worker_id) return
      if (!workerMap[t.worker_id]) workerMap[t.worker_id] = { income: 0, cars: 0, byDate: {} }
      workerMap[t.worker_id].income += t.price_charged
      workerMap[t.worker_id].cars   += 1
      workerMap[t.worker_id].byDate[t.date] = (workerMap[t.worker_id].byDate[t.date] || 0) + t.price_charged
    })
    const workerRanking = Object.entries(workerMap)
      .map(([id, s]) => {
        const worker = workers.find(w => w.id === id)
        if (!worker || !worker.active) return null
        const dailyGoal = worker.daily_goal ? Number(worker.daily_goal) : 0
        const daysHitGoal = dailyGoal > 0 ? Object.values(s.byDate).filter(v => v >= dailyGoal).length : 0
        const goalPct = (dailyGoal > 0 && workingDaysElapsed > 0) ? Math.round((daysHitGoal / workingDaysElapsed) * 100) : null
        return { worker, income: s.income, cars: s.cars, dailyGoal, daysHitGoal, goalPct }
      })
      .filter(Boolean)
      .sort((a, b) => b.income - a.income)

    const displayCosts = hasRange ? proportionalFixed + workerExpTotal : totalCosts
    const proportionRatio = hasRange && monthWorkingDaysTotal > 0 ? rangeWorkingDays / monthWorkingDaysTotal : 1
    return {
      totalIncome, netProfit, totalCosts, displayCosts, payrollTotal, rent, supplies, utilityGoal,
      incomeGoal, progressPct, semaforo, totalCars, avgTicket, avgTicketAuto, autoCars: autoTickets.length,
      avgTicketConAbiertos, carsConAbiertos,
      avgDailyActual, avgDailyNeeded,
      workingDaysElapsed, workingDaysRemaining, workingDaysTotal,
      bestDay, efectivo, yape, transferencia, onTrack, projectedIncome, dailyData,
      workerRanking, monthBonusAmt, workerExpTotal, periodExpenses, costItemsData,
      adelantosAbiertos, ticketsConAdelanto, ticketsAbiertos, saldoPorCobrar, gastosPendTotal,
      proportionalFixed, proportionRatio, avgTimeByType,
    }
  }, [tickets, dailySummaries, expenses, pastTickets, pastSummaries, pastExpenses, workers, services, incidents, selectedCosts, bonuses, casualPayments, advances, workerMonthlyConfigs, workerConfigsHasta, prefix, selMonth, selYear, isCurrentMonth, rangeFrom, rangeTo, hasRange])


  const semaforoClass = {
    verde:    'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/10',
    amarillo: 'border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-900/10',
    rojo:     'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10',
  }
  const semaforoText = {
    verde: 'text-green-700 dark:text-green-400',
    amarillo: 'text-yellow-700 dark:text-yellow-400',
    rojo: 'text-red-700 dark:text-red-400',
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">

      {/* Barra de carga sutil — visible pero no bloquea */}
      {loading && <div className="fixed top-0 left-0 right-0 h-0.5 z-50 bg-red-500 animate-pulse" />}

      {/* Header hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a1a1a] via-[#2d0a0a] to-[#1a1a1a] p-5 shadow-xl">
        {/* Círculos decorativos */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-red-700/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-red-900/30 blur-xl pointer-events-none" />

        {/* Fila superior: título + ingresos */}
        <div className="flex items-start justify-between mb-4 relative">
          <div className="flex-1 min-w-0 pr-3">
            <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-0.5">Panel principal</p>
            <h1 className="text-xl font-black text-white leading-tight truncate">
              {hasRange ? `${formatDate(rangeFrom)} – ${formatDate(rangeTo)}` : `${monthName(selMonth)} ${selYear}`}
            </h1>
            {!hasRange && (
              <p className="text-xs text-gray-400 mt-0.5">{data.workingDaysElapsed} días hábiles transcurridos</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-gray-400 mb-0.5">Ingresos</p>
            <p className="text-xl font-black text-white">{formatMoney(data.totalIncome)}</p>
            {!hasRange && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                data.semaforo === 'verde' ? 'bg-green-500/20 text-green-400' :
                data.semaforo === 'amarillo' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {data.semaforo === 'verde' ? '✓ En meta' : data.semaforo === 'amarillo' ? '⚠ En progreso' : '✗ Por debajo'}
              </span>
            )}
          </div>
        </div>

        {/* Fila controles: mes/año + actualizar */}
        <div className="flex items-center gap-2 relative mb-2">
          <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 flex-1">
            <select className="bg-transparent text-white text-sm font-semibold focus:outline-none cursor-pointer appearance-none flex-1"
              value={selMonth} onChange={e => { setSelMonth(+e.target.value); setRangeFrom(null); setRangeTo(null) }}>
              {MONTHS.map((m, i) => <option key={i+1} value={i+1} className="text-gray-900 bg-white">{m}</option>)}
            </select>
            <span className="text-white/30">|</span>
            <select className="bg-transparent text-white text-sm font-semibold focus:outline-none cursor-pointer appearance-none"
              value={selYear} onChange={e => { setSelYear(+e.target.value); setRangeFrom(null); setRangeTo(null) }}>
              {[cy-1, cy, cy+1].map(y => <option key={y} value={y} className="text-gray-900 bg-white">{y}</option>)}
            </select>
          </div>

          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white text-xs font-semibold whitespace-nowrap disabled:opacity-60 flex-none">
            <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        {/* Fila rango: Desde / Hasta en grid 2 cols + botón limpiar */}
        <div className="grid grid-cols-2 gap-2 relative mt-1">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2">
            <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1">Desde</p>
            <input type="date" className="bg-transparent text-white text-sm font-semibold focus:outline-none w-full"
              value={rangeFrom || ''} min={`${prefix}-01`} max={`${prefix}-${String(lastDayOfMonth).padStart(2,'0')}`}
              onChange={e => setRangeFrom(e.target.value || null)} />
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2">
            <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1">Hasta</p>
            <input type="date" className="bg-transparent text-white text-sm font-semibold focus:outline-none w-full"
              value={rangeTo || ''} min={rangeFrom || `${prefix}-01`} max={`${prefix}-${String(lastDayOfMonth).padStart(2,'0')}`}
              onChange={e => setRangeTo(e.target.value || null)} />
          </div>
        </div>
        {hasRange && (
          <button onClick={() => { setRangeFrom(null); setRangeTo(null) }}
            className="flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors font-medium mt-1 relative">
            <X className="w-3 h-3" /> Limpiar rango
          </button>
        )}
      </div>

      {/* Alerta ritmo */}
      {!hasRange && isCurrentMonth && data.workingDaysElapsed > 0 && data.incomeGoal > 0 && (() => {
        const pct       = Math.min(100, Math.round((data.totalIncome / data.incomeGoal) * 100))
        const projPct   = Math.min(100, Math.round((data.projectedIncome / data.incomeGoal) * 100))
        const gap       = data.incomeGoal - data.totalIncome
        const dailyNeed = data.workingDaysRemaining > 0 ? gap / data.workingDaysRemaining : 0
        const ok        = data.onTrack
        return (
        <div className={`rounded-2xl border overflow-hidden ${ok ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'}`}>
          {/* Header */}
          <div className={`px-4 pt-4 pb-2 flex items-center gap-2`}>
            <span className="text-lg">{ok ? '🟢' : '⚠️'}</span>
            <div className="flex-1">
              <p className={`text-sm font-bold ${ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                {ok ? 'En buen ritmo — vas a alcanzar la meta' : 'Ritmo insuficiente para alcanzar la meta'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{data.workingDaysRemaining} días hábiles restantes</p>
            </div>
            <div className={`text-xl font-black tabular-nums ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{pct}%</div>
          </div>

          {/* Barra de progreso doble */}
          <div className="px-4 pb-2">
            <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              {/* Proyección (fondo) */}
              <div className="absolute inset-y-0 left-0 rounded-full bg-gray-300 dark:bg-gray-600 transition-all duration-700" style={{ width: `${projPct}%` }} />
              {/* Real (frente) */}
              <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>S/ 0</span>
              <span className={`font-semibold ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>proyección {formatMoney(data.projectedIncome)}</span>
              <span>meta {formatMoney(data.incomeGoal)}</span>
            </div>
          </div>

          {/* Stats row */}
          <div className={`grid grid-cols-3 divide-x border-t ${ok ? 'border-emerald-100 dark:border-emerald-800/40 divide-emerald-100 dark:divide-emerald-800/40' : 'border-red-100 dark:border-red-800/40 divide-red-100 dark:divide-red-800/40'}`}>
            <div className="px-3 py-2.5 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Real hoy</p>
              <p className={`text-sm font-bold tabular-nums ${ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{formatMoney(data.totalIncome)}</p>
            </div>
            <div className="px-3 py-2.5 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Diario actual</p>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200 tabular-nums">{formatMoney(data.avgDailyActual)}</p>
            </div>
            <div className="px-3 py-2.5 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">{ok ? 'Diario necesario' : 'Necesitas/día'}</p>
              <p className={`text-sm font-bold tabular-nums ${dailyNeed > data.avgDailyActual ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{dailyNeed > 0 ? formatMoney(dailyNeed) : '—'}</p>
            </div>
          </div>
        </div>
        )
      })()}

      {/* Editar layout */}
      <div className="flex justify-end">
        <button onClick={() => setEditingLayout(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-colors flex items-center gap-1.5 ${editingLayout ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
          {editingLayout ? 'Listo' : 'Ordenar paneles'}
        </button>
      </div>

      {/* Secciones reordenables */}
      {panelOrder.map((sectionId, sIdx) => {
        const sectionContent = (() => {
          if (sectionId === 'kpis') return (
            <div key="kpis" className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard label={hasRange ? 'Ingresos del rango' : 'Ingresos del mes'}   value={formatMoney(data.totalIncome)}  sub={`${data.totalCars} vehículos`} icon={DollarSign} color="red" />
              <StatCard label="Ganancia neta est." value={formatMoney(data.netProfit)}    sub={hasRange ? `Costos prop. a ${data.workingDaysElapsed} días hábiles` : `Costos proporcionales al día ${data.workingDaysElapsed}`} icon={TrendingUp} color="green" />
              <StatCard label={hasRange ? 'Gastos del rango' : 'Total gastos'} value={formatMoney(data.displayCosts)} sub={hasRange ? `Fijos prop. + gastos` : `Planilla: ${formatMoney(data.payrollTotal)}`} icon={CreditCard} color="neutral" />
              <StatCard label="Vehículos"          value={data.totalCars}                 sub={`Prom: ${formatMoney(data.avgTicket)}/carro`} icon={Car} color="neutral" />
              <StatCard label="Ticket promedio"    value={formatMoney(data.avgTicket)}
                sub={`${data.totalCars} cerrados${data.autoCars > 0 ? ` · autos ${formatMoney(data.avgTicketAuto)}` : ''}`}
                icon={Receipt} color="neutral" />
              {/* El mismo promedio contando lo que dejarán los servicios en curso. */}
              <StatCard label="Ticket prom. con abiertos" value={formatMoney(data.avgTicketConAbiertos)}
                sub={data.ticketsAbiertos > 0
                  ? `Incluye ${data.ticketsAbiertos} en curso · ${data.carsConAbiertos} vehículos`
                  : 'Sin servicios abiertos'}
                icon={Clock} color="neutral" />
            </div>
          )
          // Adelantos de servicios en curso: dinero ya cobrado y lo que falta.
          if (sectionId === 'adelantos') return data.ticketsAbiertos > 0 ? (
            <div key="adelantos" className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Servicios en curso</p>
                  <p className="text-xs text-gray-400">
                    {data.ticketsAbiertos} abierto{data.ticketsAbiertos !== 1 ? 's' : ''}
                    {data.ticketsConAdelanto > 0 && ` · ${data.ticketsConAdelanto} con adelanto`}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-green-50 dark:bg-green-900/20 px-3 py-2.5">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Adelantos cobrados</p>
                  <p className="text-xl font-black text-green-600">{formatMoney(data.adelantosAbiertos)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">ya suma a los ingresos</p>
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Por cobrar al entregar</p>
                  <p className="text-xl font-black text-amber-600">{formatMoney(data.saldoPorCobrar)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">de todos los servicios abiertos</p>
                </div>
              </div>
            </div>
          ) : null

          // Evolución mensual: ingresos, costos y utilidad — el avance real del negocio
          if (sectionId === 'tendencia') return insights && insights.serie.some(m => m.ingresos > 0) ? (() => {
            // Solo el mes en curso lleva proyeccion: en uno pasado no queda
            // nada por cerrar. Los meses previos van a null para que la linea
            // punteada no los cruce.
            const hayProyeccion = isCurrentMonth && (data.saldoPorCobrar > 0 || data.gastosPendTotal > 0)
            return (
            <div key="tendencia" className="card overflow-hidden">
              <div className="flex items-start justify-between mb-1 gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Evolución del negocio</p>
                  <p className="text-xs text-gray-400">Últimos 6 meses · ingresos, costos y utilidad</p>
                </div>
                {insights.variacion !== null && (
                  <div className={`text-right shrink-0 px-2.5 py-1 rounded-lg ${
                    insights.variacion >= 0
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <p className={`text-base font-black leading-none ${
                      insights.variacion >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {insights.variacion >= 0 ? '▲' : '▼'} {Math.abs(insights.variacion).toFixed(0)}%
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">vs. mes anterior</p>
                  </div>
                )}
              </div>
              <div className="h-72 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={insights.serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 600 }} tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={v => `S/${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} axisLine={false} tickLine={false} width={52} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', fontSize: 12 }}
                      formatter={(v, n) => [formatMoney(v), n]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                    <Bar dataKey="ingresos" name="Ingresos" fill="#ef4444" radius={[5,5,0,0]} maxBarSize={38} />
                    <Bar dataKey="costos"   name="Costos"   fill="#d1d5db" radius={[5,5,0,0]} maxBarSize={38} />
                    <Line dataKey="utilidad" name="Utilidad" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3.5, fill: '#16a34a' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {insights.actual.utilidad < 0 && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">
                  ⚠ Hoy el mes va en pérdida de {formatMoney(Math.abs(insights.actual.utilidad))}
                </p>
              )}

              {/* Proyeccion al cerrar los servicios abiertos ─────────────────
                  Va aparte del grafico a proposito: meterla como series extra
                  lo dejaba con seis leyendas y no se entendia nada. Aqui se
                  compara en dos barras donde va hoy y donde quedaria. */}
              {hayProyeccion && (() => {
                const hoy = insights.actual.utilidad
                const proyectada = hoy + data.saldoPorCobrar - data.gastosPendTotal
                // Las barras se dibujan sobre la misma escala para que se puedan
                // comparar: el cero queda en la misma posicion en ambas.
                const tope = Math.max(Math.abs(hoy), Math.abs(proyectada), 1)
                const ancho = v => `${(Math.abs(v) / tope) * 100}%`
                return (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2.5">
                      Cómo cerraría el mes si entregas los {data.ticketsAbiertos} servicios abiertos
                    </p>

                    <div className="space-y-2.5">
                      {[
                        { etiqueta: 'Hoy', valor: hoy, tono: hoy >= 0 ? 'bg-green-400' : 'bg-red-400' },
                        { etiqueta: 'Al cerrarlos', valor: proyectada, tono: proyectada >= 0 ? 'bg-green-600' : 'bg-red-600' },
                      ].map(({ etiqueta, valor, tono }) => (
                        <div key={etiqueta}>
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-[11px] text-gray-500">{etiqueta}</span>
                            <span className={`text-sm font-black ${valor >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatMoney(valor)}
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <div className={`h-full rounded-full ${tono}`} style={{ width: ancho(valor) }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 space-y-0.5 text-[11px]">
                      {data.saldoPorCobrar > 0 && (
                        <div className="flex justify-between text-gray-500">
                          <span>Falta cobrar de esos servicios</span>
                          <span className="text-green-600 font-semibold">+{formatMoney(data.saldoPorCobrar)}</span>
                        </div>
                      )}
                      {data.gastosPendTotal > 0 && (
                        <div className="flex justify-between text-gray-500">
                          <span>Gastos que faltan pagar</span>
                          <span className="text-amber-600 font-semibold">−{formatMoney(data.gastosPendTotal)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
            )
          })() : null

          // Dónde está el dinero: ticket promedio por tipo de servicio
          // Afluencia: días y horas con más movimiento.
          if (sectionId === 'afluencia') return <AfluenciaPanel key="afluencia" />

          if (sectionId === 'mix') return insights && insights.mix.length > 0 ? (
            <div key="mix" className="card">
              <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">Rentabilidad por servicio</p>
              <p className="text-xs text-gray-400 mb-3">Ordenado por ingresos · el ticket promedio indica dónde conviene enfocar</p>
              <div className="space-y-2">
                {insights.mix.map(m => {
                  const pct = insights.actual.ingresos > 0 ? (m.ingresos / insights.actual.ingresos) * 100 : 0
                  return (
                    <div key={m.tipo}>
                      <div className="flex items-baseline justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">
                          {m.tipo.replace(/_/g, ' ')}
                          <span className="text-gray-400 font-normal ml-1.5">{m.carros} und.</span>
                        </span>
                        <span className="text-gray-500">
                          <span className="font-bold text-gray-800 dark:text-gray-200">{formatMoney(m.ingresos)}</span>
                          <span className="text-gray-400 ml-1.5">{formatMoney(m.ticketProm)}/und.</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500"
                          style={{ width: `${Math.max(pct, 1.5)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null

          // Retención: cuántos clientes vuelven
          if (sectionId === 'clientes') return insights && insights.actual.placas.length > 0 ? (
            <div key="clientes" className="card">
              <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">Clientes del mes</p>
              <p className="text-xs text-gray-400 mb-3">Recurrente = ya había venido en los meses anteriores</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{insights.actual.placas.length}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Vehículos únicos</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-blue-600">{insights.nuevos}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Nuevos</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-green-600">{insights.recurrentes}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Repiten</p>
                </div>
              </div>
              <div className="mt-3 h-2.5 rounded-full bg-blue-100 dark:bg-blue-900/30 overflow-hidden flex">
                <div className="h-full bg-green-500" style={{ width: `${insights.pctRecurrencia}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Tasa de recurrencia: <span className="font-bold text-gray-800 dark:text-gray-200">{insights.pctRecurrencia.toFixed(0)}%</span>
                {insights.pctRecurrencia < 30 && (
                  <span className="text-amber-600 dark:text-amber-400"> · la mayoría no vuelve, hay margen para fidelizar</span>
                )}
              </p>
            </div>
          ) : null

          if (sectionId === 'tiempos') return Object.keys(data.avgTimeByType).length > 0 ? (() => {
            const fmtMins = (mins) => {
              if (mins < 60) return `${mins} min`
              const h = Math.floor(mins / 60), m = mins % 60
              return m > 0 ? `${h}h ${m}m` : `${h}h`
            }
            const allEntries = Object.entries(data.avgTimeByType)
              .map(([type, { total, count, vehicle_type, vehicle_subtype, extras_label }]) => {
                const vt = (vehicleTypes || []).find(v => v.value === vehicle_type)
                return { type, avg: Math.round(total / count), count, hasLabel: !!vt, vt, vehicle_subtype, extras_label }
              })
              .sort((a, b) => (a.hasLabel === b.hasLabel ? 0 : a.hasLabel ? -1 : 1))
            const uniqueVehicleTypes = [...new Set(allEntries.map(e => e.vehicle_type).filter(Boolean))]
            const filteredEntries = avgTimeFilter === 'all' ? allEntries : allEntries.filter(e => e.vehicle_type === avgTimeFilter)
            const ordered = avgTimeOrder
              ? [...avgTimeOrder.map(t => filteredEntries.find(e => e.type === t)).filter(Boolean),
                 ...filteredEntries.filter(e => !avgTimeOrder.includes(e.type))]
              : [...filteredEntries].sort((a, b) => b.count - a.count)
            const visibleEntries = ordered.filter(e => !avgTimeHidden.includes(e.type) && e.count > 5)
            const maxAvg = Math.max(...ordered.map(e => e.avg))
            const moveEntry = (idx, dir) => {
              const newOrder = ordered.map(e => e.type)
              const ni = idx + dir
              if (ni < 0 || ni >= newOrder.length) return
              ;[newOrder[idx], newOrder[ni]] = [newOrder[ni], newOrder[idx]]
              setAvgTimeOrder(newOrder)
              saveAvgTimePrefs(newOrder, avgTimeHidden)
            }
            const toggleHidden = (type) => {
              const nh = avgTimeHidden.includes(type) ? avgTimeHidden.filter(t => t !== type) : [...avgTimeHidden, type]
              setAvgTimeHidden(nh)
              saveAvgTimePrefs(avgTimeOrder || ordered.map(e => e.type), nh)
            }
            return (
              <div key="tiempos" className="card">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">⏱</span>
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Tiempo promedio por servicio</p>
                  <button onClick={() => setEditingAvgTime(v => !v)}
                    className={`ml-auto text-xs px-2 py-1 rounded-lg font-semibold transition-colors ${editingAvgTime ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                    {editingAvgTime ? 'Listo' : '✏️ Editar'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button onClick={() => setAvgTimeFilter('all')}
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${avgTimeFilter === 'all' ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                    Todos
                  </button>
                  {uniqueVehicleTypes.map(vtype => {
                    const vtObj = (vehicleTypes || []).find(v => v.value === vtype)
                    return (
                      <button key={vtype} onClick={() => setAvgTimeFilter(vtype)}
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${avgTimeFilter === vtype ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                        {vtObj ? `${vtObj.emoji} ${vtObj.label}` : vtype}
                      </button>
                    )
                  })}
                </div>
                {editingAvgTime ? (
                  <div className="space-y-1.5">
                    {ordered.map(({ type, avg, count, vt, vehicle_subtype, extras_label }, idx) => {
                      const label = vt ? `${vt.emoji} ${vt.label}${vehicle_subtype ? ` · ${vehicle_subtype}` : ''}${extras_label ? ` + ${extras_label}` : ''}` : type
                      const hidden = avgTimeHidden.includes(type)
                      return (
                        <div key={type} className={`flex items-center gap-2 px-2 py-2 rounded-xl border transition-colors ${hidden ? 'opacity-40 border-gray-100 dark:border-gray-800' : 'border-gray-200 dark:border-gray-700'}`}>
                          <div className="flex flex-col gap-0.5">
                            <button onClick={() => moveEntry(idx, -1)} disabled={idx === 0} className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-20">
                              <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>
                            </button>
                            <button onClick={() => moveEntry(idx, 1)} disabled={idx === ordered.length - 1} className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-20">
                              <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                            </button>
                          </div>
                          <span className="flex-1 text-xs font-semibold text-gray-700 dark:text-gray-200">{label}</span>
                          <span className="text-xs text-gray-400">{count} serv. · {fmtMins(avg)}</span>
                          <button onClick={() => toggleHidden(type)}
                            className={`text-xs px-2 py-0.5 rounded-lg font-semibold transition-colors ${hidden ? 'bg-gray-200 dark:bg-gray-700 text-gray-500' : 'bg-green-100 dark:bg-green-900/30 text-green-600'}`}>
                            {hidden ? 'Oculto' : 'Visible'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {visibleEntries.map(({ type, avg, count, vt, vehicle_subtype, extras_label }) => {
                      const label = vt ? `${vt.emoji} ${vt.label}${vehicle_subtype ? ` · ${vehicle_subtype}` : ''}${extras_label ? ` + ${extras_label}` : ''}` : type
                      const pct = maxAvg > 0 ? Math.round((avg / maxAvg) * 100) : 0
                      return (
                        <div key={type}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">{count} serv.</span>
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{fmtMins(avg)}</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })() : null
          if (sectionId === 'progreso') return null
          if (sectionId === 'estadisticas') return (
            <div key="estadisticas" className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="card">
                <div className="flex items-center gap-2 mb-3"><Clock className="w-4 h-4 text-red-500" /><p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Promedios</p></div>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-xs text-gray-500">{hasRange ? 'Prom. ingresos/día' : 'Promedio actual/día'}</span><span className="font-semibold text-sm text-gray-900 dark:text-white">{formatMoney(data.avgDailyActual)}</span></div>
                  {hasRange && data.workingDaysElapsed > 0 && <div className="flex justify-between"><span className="text-xs text-gray-500">Prom. gastos/día</span><span className="font-semibold text-sm text-red-500">-{formatMoney(data.displayCosts / data.workingDaysElapsed)}</span></div>}
                  {!hasRange && isCurrentMonth && <div className="flex justify-between"><span className="text-xs text-gray-500">Necesario para cerrar</span><span className={`font-semibold text-sm ${data.avgDailyNeeded > data.avgDailyActual ? 'text-red-500' : 'text-green-500'}`}>{formatMoney(data.avgDailyNeeded)}</span></div>}
                </div>
              </div>
              <div className="card">
                <div className="flex items-center gap-2 mb-3"><Calendar className="w-4 h-4 text-blue-500" /><p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Días hábiles</p></div>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-xs text-gray-500">{hasRange ? 'Días hábiles en rango' : 'Trabajados'}</span><span className="font-semibold text-sm text-gray-900 dark:text-white">{hasRange ? data.workingDaysElapsed : `${data.workingDaysElapsed} de ${data.workingDaysTotal}`}</span></div>
                  {isCurrentMonth && <div className="flex justify-between"><span className="text-xs text-gray-500">Restantes</span><span className="font-semibold text-sm text-red-500">{data.workingDaysRemaining} días</span></div>}
                </div>
              </div>
              <div className="card">
                <div className="flex items-center gap-2 mb-3"><Award className="w-4 h-4 text-yellow-500" /><p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Mejor día</p></div>
                {data.bestDay ? <div><p className="text-xl font-bold text-gray-900 dark:text-white">{formatMoney(data.bestDay[1])}</p><p className="text-xs text-gray-500 mt-0.5">{formatDate(data.bestDay[0])}</p></div> : <p className="text-sm text-gray-400">Sin registros</p>}
              </div>
            </div>
          )
          if (sectionId === 'cobros') return (
            <div key="cobros" className="grid grid-cols-3 gap-3">
              <div className="card flex flex-col items-center text-center gap-2 py-3"><div className="rounded-xl p-2.5 bg-green-50 dark:bg-green-900/20"><Banknote className="w-5 h-5 text-green-600" /></div><p className="text-xs text-gray-500">Efectivo</p><p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{formatMoney(data.efectivo)}</p></div>
              <div className="card flex flex-col items-center text-center gap-2 py-3"><div className="rounded-xl p-2.5 bg-purple-50 dark:bg-purple-900/20"><Smartphone className="w-5 h-5 text-purple-600" /></div><p className="text-xs text-gray-500">Yape</p><p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{formatMoney(data.yape)}</p></div>
              <div className="card flex flex-col items-center text-center gap-2 py-3"><div className="rounded-xl p-2.5 bg-blue-50 dark:bg-blue-900/20"><CreditCard className="w-5 h-5 text-blue-600" /></div><p className="text-xs text-gray-500">Transfer.</p><p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{formatMoney(data.transferencia)}</p></div>
            </div>
          )
          if (sectionId === 'gastos') return (
            <div key="gastos" className="card">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Desglose de gastos{hasRange && <span className="ml-2 text-xs font-normal text-amber-500">proporcional al rango</span>}</p>
              {(data.costItemsData && data.costItemsData.length > 0)
                ? data.costItemsData.map((item, i) => <Row key={i} label={`📌 ${item.name}`} value={formatMoney(item.amount * data.proportionRatio)} />)
                : (<><Row label="🏠 Alquiler" value={formatMoney(data.rent * data.proportionRatio)} /><Row label="🧴 Insumos" value={formatMoney(data.supplies * data.proportionRatio)} /></>)
              }
              <Row label="👷 Planilla" value={formatMoney(data.payrollTotal * data.proportionRatio)} />
              {data.monthBonusAmt > 0 && <Row label="🎁 Bonos" value={formatMoney(data.monthBonusAmt * data.proportionRatio)} />}
              {data.workerExpTotal > 0 && <Row label="💸 Gastos personal" value={formatMoney(data.workerExpTotal)} />}
              {data.gastosPendTotal > 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 pt-1">
                  + {formatMoney(data.gastosPendTotal)} en gastos pendientes de pago, aún no descontados
                </p>
              )}
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Total gastos</span>
                <span className="text-sm font-black text-red-600">{formatMoney(data.displayCosts)}</span>
              </div>
            </div>
          )
          if (sectionId === 'gastos_personal') return data.periodExpenses?.length > 0 ? <ExpensesPanel key="gastos_personal" expenses={data.periodExpenses} workers={workers} /> : null
          if (sectionId === 'ranking') return data.workerRanking.length > 0 ? <RankingPanel key="ranking" ranking={data.workerRanking} workingDaysElapsed={data.workingDaysElapsed} /> : null
          if (sectionId === 'bonos') return <BonusSection key="bonos" workers={workers} bonuses={bonuses} addBonus={addBonus} deleteBonus={deleteBonus} monthPrefix={prefix} />
          if (sectionId === 'grafico') return data.dailyData.length > 0 ? (() => {
            const maxAmt = Math.max(...data.dailyData.map(d => d.amount))
            const todayStr = new Date().toISOString().slice(0, 10)
            return (
              <div key="grafico" className="card overflow-hidden">
                <div className="flex items-center justify-between mb-1"><p className="text-sm font-bold text-gray-900 dark:text-white">Ingresos por día</p><span className="text-xs text-gray-400">{data.dailyData.length} días</span></div>
                <p className="text-xs text-gray-400 mb-4">Mejor día: <span className="font-semibold text-gray-600 dark:text-gray-300">{data.bestDay ? `${formatDate(data.bestDay[0])} · ${formatMoney(data.bestDay[1])}` : '—'}</span></p>
                <div className="overflow-x-auto -mx-4 px-4">
                  <div style={{ minWidth: Math.max(data.dailyData.length * 46, 320) }} className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.dailyData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }} barCategoryGap="18%">
                        <defs>
                          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={1} /><stop offset="100%" stopColor="#b91c1c" stopOpacity={0.85} /></linearGradient>
                          <linearGradient id="barGradTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={1} /><stop offset="100%" stopColor="#dc2626" stopOpacity={0.9} /></linearGradient>
                          <linearGradient id="barGradToday" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={1} /><stop offset="100%" stopColor="#4f46e5" stopOpacity={0.85} /></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="shortLabel" tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }} tickLine={false} axisLine={false} interval={0} tickMargin={8} height={26} />
                        <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={v => `S/${v}`} tickCount={5} axisLine={false} tickLine={false} width={54} />
                        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 6 }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', fontSize: 12, padding: '8px 14px' }} formatter={(v) => [formatMoney(v), 'Ingresos']} labelFormatter={(_, p) => p?.[0]?.payload?.label || ''} labelStyle={{ fontWeight: 700, marginBottom: 2 }} />
                        <Bar dataKey="amount" radius={[6, 6, 2, 2]} maxBarSize={40}>
                          <LabelList dataKey="amount" position="top" offset={6}
                            style={{ fontSize: 10, fontWeight: 700, fill: '#6b7280' }}
                            formatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)} />
                          {data.dailyData.map((d) => {
                            const isTop = d.amount === maxAmt
                            const isToday = d.date === todayStr
                            return <Cell key={d.date} fill={isToday ? 'url(#barGradToday)' : isTop ? 'url(#barGradTop)' : 'url(#barGrad)'} />
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{background:'linear-gradient(#f97316,#dc2626)'}} /><span className="text-xs text-gray-400">Mejor día</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{background:'linear-gradient(#6366f1,#4f46e5)'}} /><span className="text-xs text-gray-400">Hoy</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{background:'linear-gradient(#ef4444,#b91c1c)'}} /><span className="text-xs text-gray-400">Días anteriores</span></div>
                </div>
              </div>
            )
          })() : null
          return null
        })()

        if (!sectionContent) return null

        const SECTION_LABELS = { kpis: 'KPIs', adelantos: 'Adelantos por cobrar', tendencia: 'Evolución mensual', afluencia: 'Afluencia por día y hora', mix: 'Rentabilidad por servicio', clientes: 'Clientes nuevos vs. recurrentes', tiempos: 'Tiempos promedio', progreso: 'Meta mensual', estadisticas: 'Estadísticas', cobros: 'Métodos de cobro', gastos: 'Desglose gastos', gastos_personal: 'Gastos personal', ranking: 'Ranking', bonos: 'Bonos', grafico: 'Gráfico diario' }

        return (
          <div key={sectionId} className="relative group">
            {editingLayout && (
              <div className="flex items-center gap-1 mb-1.5 px-1">
                <span className="text-xs font-semibold text-gray-400 flex-1">{SECTION_LABELS[sectionId] || sectionId}</span>
                <button onClick={() => movePanelSection(sectionId, -1)} disabled={sIdx === 0}
                  className="p-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 disabled:opacity-20 shadow-sm">
                  <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>
                </button>
                <button onClick={() => movePanelSection(sectionId, 1)} disabled={sIdx === panelOrder.length - 1}
                  className="p-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 disabled:opacity-20 shadow-sm">
                  <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </button>
              </div>
            )}
            {sectionContent}
          </div>
        )
      })}

    </div>
  )
}
