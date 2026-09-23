// ─── Multa automática por tardanzas ──────────────────────────────────────────
// Desde septiembre 2026, en cada mes las dos primeras tardanzas no tienen
// multa; desde la tercera, cada tardanza genera una multa de S/ 10 (aparte
// del descuento por minutos que ya lleva la tardanza). Las multas que el admin
// cargó a mano por tardanzas cuentan como hechas y no se duplican.

import { supabase } from './supabase'
import { normalize } from './metas'

export const MULTA_TARDANZA      = 10
export const TARDANZAS_SIN_MULTA = 2
export const INICIO_MULTAS       = '2026-09'
export const MARCA_MULTA         = 'Multa automática por tardanza'

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

const esAuto = i => (i.observation || '').startsWith(MARCA_MULTA)

function fechaCorta(iso) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function descripcion(t, n) {
  const llego = (t.observation || '').match(/lleg[oó] (\d{1,2}:\d{2})/)?.[1]
  const min   = Math.round((Number(t.hours_late) || 0) * 60)
  const detalle = [fechaCorta(t.date), llego && `llegó ${llego}`, min > 0 && `${min} min tarde`].filter(Boolean).join(', ')
  return `${MARCA_MULTA} — ${n}ª tardanza del mes (${detalle}). S/ ${MULTA_TARDANZA} por cada tardanza desde la ${TARDANZAS_SIN_MULTA + 1}ª.`
}

// Qué multas crear y cuáles borrar para un trabajador en un mes. Recibe sus
// tardanzas y multas de ese mes; no toca la base.
export function planMultas(incidencias) {
  const porFecha = new Map()
  ;[...incidencias]
    .filter(i => i.type === 'tardanza')
    .sort((a, b) => (a.date + (a.created_at || '')).localeCompare(b.date + (b.created_at || '')))
    .forEach(t => { if (!porFecha.has(t.date)) porFecha.set(t.date, t) })
  const tardanzas = [...porFecha.values()]
  const conMulta  = tardanzas.slice(TARDANZAS_SIN_MULTA).map((t, k) => ({ t, n: TARDANZAS_SIN_MULTA + k + 1 }))

  const multas    = incidencias.filter(i => i.type === 'multa')
  const autos     = multas.filter(esAuto)
  // Multas a mano por tardanza: cubren primero la de su mismo día y el resto,
  // las más antiguas que falten.
  const manuales  = multas.filter(i => !esAuto(i) && normalize(i.observation).includes('tard'))

  const cubiertas = new Set()
  const libres = []
  for (const m of manuales) {
    const q = conMulta.find(x => x.t.date === m.date && !cubiertas.has(x.t.date))
    if (q) cubiertas.add(q.t.date)
    else libres.push(m)
  }
  for (const q of conMulta) {
    if (!libres.length) break
    if (cubiertas.has(q.t.date)) continue
    cubiertas.add(q.t.date)
    libres.shift()
  }

  const faltan = conMulta.filter(q => !cubiertas.has(q.t.date))
  const texto  = new Map(faltan.map(q => [q.t.date, descripcion(q.t, q.n)]))
  const quedan = new Set()
  const borrar = []
  // Si se borró una tardanza anterior, la multa que queda cambia de número.
  const actualizar = []
  for (const a of autos) {
    if (texto.has(a.date) && !quedan.has(a.date)) {
      quedan.add(a.date)
      if (a.observation !== texto.get(a.date)) actualizar.push({ id: a.id, observation: texto.get(a.date) })
    } else borrar.push(a.id)
  }
  const crear = faltan
    .filter(q => !quedan.has(q.t.date))
    .map(q => ({ date: q.t.date, observation: texto.get(q.t.date) }))
  return { crear, borrar, actualizar }
}

// Pone al día las multas del mes (de un trabajador o de todos). Se puede
// llamar las veces que sea: si ya está todo, no hace nada. Las llamadas van en
// fila para que dos revisiones a la vez no creen la misma multa dos veces.
let enFila = Promise.resolve()
export function reconciliarMultas(args) {
  const p = enFila.then(() => reconciliar(args))
  enFila = p.catch(() => {})
  return p
}

async function reconciliar({ prefix, workerId = null }) {
  if (IS_DEMO || !prefix || prefix < INICIO_MULTAS) return { creadas: 0, borradas: 0 }
  const [y, m] = prefix.split('-').map(Number)
  const fin = `${prefix}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
  let q = supabase.from('attendance_incidents')
    .select('id, worker_id, date, type, observation, hours_late, created_at')
    .gte('date', `${prefix}-01`).lte('date', fin)
    .in('type', ['tardanza', 'multa'])
  if (workerId) q = q.eq('worker_id', workerId)
  const { data, error } = await q
  if (error) throw error

  const porTrabajador = {}
  for (const i of data || []) (porTrabajador[i.worker_id] = porTrabajador[i.worker_id] || []).push(i)

  let creadas = 0, borradas = 0
  for (const [wid, lista] of Object.entries(porTrabajador)) {
    const { crear, borrar, actualizar } = planMultas(lista)
    for (const u of actualizar) {
      await supabase.from('attendance_incidents').update({ observation: u.observation }).eq('id', u.id)
    }
    for (const id of borrar) {
      const { error: e } = await supabase.from('attendance_incidents').delete().eq('id', id)
      if (!e) borradas++
    }
    if (crear.length) {
      const { error: e } = await supabase.from('attendance_incidents').insert(crear.map(c => ({
        worker_id: wid, date: c.date, type: 'multa',
        hours_late: 0, apply_discount: true, discount_amount: MULTA_TARDANZA,
        observation: c.observation,
      })))
      if (!e) creadas += crear.length
    }
  }
  return { creadas, borradas }
}
