import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Lock, Unlock, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { formatMoney } from '../lib/utils'

// ─── Cierre de caja ──────────────────────────────────────────────────────────
// Por día: cada Yape y transferencia se marca cuando se ve en la cuenta, el
// efectivo contado se compara con el esperado y se cierra la caja. Se guarda
// en app_settings con la clave `cierre_caja_AAAA-MM-DD` (una fila por día).
//
// Lo que entró el día:
// - adelantos recibidos ese día, con su método;
// - tickets cerrados ese día, menos lo que ya se había cobrado de adelanto
//   (ese dinero entró el día del adelanto, no hoy). Un mixto se parte en su
//   parte Yape y su parte efectivo.
// Efectivo esperado en caja = sencillo inicial + efectivo que entró − gastos
// pagados en efectivo (los gastos sin método se toman como efectivo).

const clave = fecha => `cierre_caja_${fecha}`
const DIGITAL = ['yape', 'transferencia']
const ICONO = { yape: '📱', transferencia: '🏦', efectivo: '💵' }
const NOMBRE = { yape: 'Yape', transferencia: 'Transferencia', efectivo: 'Efectivo' }
const hora = iso => iso ? new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''
const r2 = n => Math.round((Number(n) || 0) * 100) / 100

export async function fetchCierre(fecha) {
  const { data } = await supabase.from('app_settings').select('value').eq('key', clave(fecha)).maybeSingle()
  return data?.value || null
}

async function guardarCierre(fecha, value) {
  const { error } = await supabase.from('app_settings').upsert(
    { key: clave(fecha), value, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
  if (error) throw error
}

// Movimientos del día a partir de los tickets cerrados, los adelantos y los gastos.
export function movimientosDelDia({ cerrados, adelantosDelDia, adelantosDeCerrados, gastos, tickets }) {
  const placa = id => (tickets || []).find(t => t.id === id)?.plate || 'Adelanto'
  const items = []
  for (const a of adelantosDelDia) {
    items.push({ key: `ad:${a.id}`, tipo: 'Adelanto', placa: placa(a.ticket_id), metodo: a.method || 'efectivo', monto: r2(a.amount), hora: a.created_at })
  }
  for (const t of cerrados) {
    const adelanto = adelantosDeCerrados.filter(a => a.ticket_id === t.id).reduce((s, a) => s + Number(a.amount || 0), 0)
    const cobrado = Number(t.price_charged) || 0
    const resto = Math.max(0, cobrado - adelanto)
    if (resto <= 0) continue
    const pm = t.payment_method || 'efectivo'
    if (pm === 'mixto') {
      const y = Number(t.mixto_yape) || 0, e = Number(t.mixto_efectivo) || 0
      const f = (y + e) > 0 ? resto / (y + e) : 0
      if (y > 0) items.push({ key: `tk:${t.id}:yape`, tipo: 'Mixto', placa: t.plate, metodo: 'yape', monto: r2(y * f), hora: t.closed_at })
      if (e > 0) items.push({ key: `tk:${t.id}:ef`, tipo: 'Mixto', placa: t.plate, metodo: 'efectivo', monto: r2(e * f), hora: t.closed_at })
    } else {
      items.push({ key: `tk:${t.id}`, tipo: adelanto > 0 ? 'Saldo' : 'Ticket', placa: t.plate, metodo: pm, monto: r2(resto), hora: t.closed_at })
    }
  }
  items.sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')))
  const gastosEfectivo = (gastos || []).filter(g => g.paid !== false && !DIGITAL.includes(g.method))
  const totales = {}
  for (const i of items) totales[i.metodo] = r2((totales[i.metodo] || 0) + i.monto)
  return {
    items,
    digitales: items.filter(i => DIGITAL.includes(i.metodo)),
    efectivoIngreso: r2(items.filter(i => i.metodo === 'efectivo').reduce((s, i) => s + i.monto, 0)),
    gastosEfectivo,
    gastoEfectivoTotal: r2(gastosEfectivo.reduce((s, g) => s + Number(g.amount || 0), 0)),
    totales,
  }
}

// Carga adelantos y arma los movimientos del día. Lo usan la ventana y el
// aviso de Registro.
export function useCajaDelDia({ fecha, cerrados, gastos, tickets, activo }) {
  const [adelantos, setAdelantos] = useState({ delDia: [], deCerrados: [] })
  const [cierre, setCierre] = useState(null)
  const [cargado, setCargado] = useState(false)
  const ids = cerrados.map(t => t.id).join(',')

  async function recargar() {
    if (!activo || !fecha) return
    const idsArr = ids ? ids.split(',') : []
    try {
      const [delDia, deCerrados, c] = await Promise.all([
        supabase.from('ticket_advances').select('*').eq('date', fecha),
        idsArr.length ? supabase.from('ticket_advances').select('*').in('ticket_id', idsArr) : Promise.resolve({ data: [] }),
        fetchCierre(fecha),
      ])
      setAdelantos({ delDia: delDia.data || [], deCerrados: deCerrados.data || [] })
      setCierre(c)
    } catch { /* sin conexión: se muestra con lo que hay */ }
    setCargado(true)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { recargar() }, [fecha, ids, activo])

  const mov = useMemo(() => movimientosDelDia({
    cerrados, adelantosDelDia: adelantos.delDia, adelantosDeCerrados: adelantos.deCerrados, gastos, tickets,
  }), [cerrados, adelantos, gastos, tickets])

  return { mov, cierre, setCierre, cargado, recargar }
}

export default function CierreCaja({ fecha, caja, quien, onClose }) {
  const { mov, cierre, setCierre } = caja
  const base = cierre || { verificados: {}, estado: 'abierta', fondo: 0 }
  const cerrada = base.estado === 'cerrada'
  const [fondo, setFondo] = useState(String(base.fondo ?? 0))
  const [contado, setContado] = useState(base.efectivo_contado != null ? String(base.efectivo_contado) : '')
  const [notas, setNotas] = useState(base.notas || '')
  const [guardando, setGuardando] = useState(false)

  const verificados = base.verificados || {}
  const revisados = mov.digitales.filter(d => verificados[d.key]).length
  const esperado = r2((Number(fondo) || 0) + mov.efectivoIngreso - mov.gastoEfectivoTotal)
  const diferencia = contado === '' ? null : r2(Number(contado) - esperado)

  async function guardar(cambios, aviso) {
    const nuevo = { ...base, ...cambios }
    setGuardando(true)
    try {
      await guardarCierre(fecha, nuevo)
      setCierre(nuevo)
      if (aviso) toast.success(aviso)
    } catch (e) { toast.error(`No se pudo guardar: ${e.message || e}`) }
    setGuardando(false)
  }

  function toggle(item) {
    if (cerrada) return
    const v = { ...verificados }
    if (v[item.key]) delete v[item.key]
    else v[item.key] = { por: quien, at: new Date().toISOString() }
    guardar({ verificados: v })
  }

  async function cerrar() {
    if (contado === '') { toast.error('Escribe el efectivo que contaste'); return }
    const faltan = mov.digitales.length - revisados
    if (faltan > 0 && !window.confirm(`Hay ${faltan} pago${faltan === 1 ? '' : 's'} digital${faltan === 1 ? '' : 'es'} sin revisar. ¿Cerrar igual?`)) return
    await guardar({
      estado: 'cerrada', fondo: Number(fondo) || 0,
      efectivo_contado: r2(contado), efectivo_esperado: esperado, diferencia,
      totales: mov.totales, gastos_efectivo: mov.gastoEfectivoTotal,
      notas: notas.trim() || null, cerrado_por: quien, cerrado_at: new Date().toISOString(),
    }, 'Caja cerrada')
  }

  const fechaTxt = new Date(`${fecha}T00:00:00`).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-3 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex justify-center mb-3"><div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" /></div>
          <div className="flex items-center gap-2">
            <p className="text-base font-black text-gray-900 dark:text-white flex-1">🧾 Cierre de caja</p>
            <button onClick={onClose} className="p-1"><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          <p className="text-xs text-gray-400 capitalize">{fechaTxt}</p>
          {cerrada && (
            <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-2.5 py-1.5">
              ✓ Cerrada {hora(base.cerrado_at)}{base.cerrado_por ? ` por ${base.cerrado_por}` : ''}
            </p>
          )}
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {/* 1. Yape y transferencias */}
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">1 · Yape y transferencias</p>
              <p className={`text-xs font-bold ${revisados === mov.digitales.length ? 'text-emerald-600' : 'text-amber-600'}`}>
                {revisados}/{mov.digitales.length} revisados
              </p>
            </div>
            {mov.digitales.length === 0 ? (
              <p className="text-sm text-gray-400">Sin pagos digitales este día.</p>
            ) : (
              <div className="space-y-1.5">
                {mov.digitales.map(d => {
                  const ok = !!verificados[d.key]
                  return (
                    <button key={d.key} onClick={() => toggle(d)} disabled={cerrada || guardando}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                        ok ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/15 dark:border-emerald-800' : 'border-gray-200 dark:border-gray-700'
                      }`}>
                      <span className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-none ${ok ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 dark:border-gray-600'}`}>
                        {ok && <Check className="w-4 h-4 text-white" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100">
                          {ICONO[d.metodo]} {d.placa} <span className="text-xs font-normal text-gray-400">· {d.tipo} · {hora(d.hora)}</span>
                        </span>
                        {ok && <span className="block text-[11px] text-emerald-600">Visto en la cuenta{verificados[d.key].por ? ` · ${verificados[d.key].por}` : ''}</span>}
                      </span>
                      <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">{formatMoney(d.monto)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {/* 2. Efectivo */}
          <section>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">2 · Efectivo</p>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Sencillo inicial</span>
                <input type="number" min="0" step="0.5" value={fondo} disabled={cerrada}
                  onChange={e => setFondo(e.target.value)} onBlur={() => !cerrada && guardar({ fondo: Number(fondo) || 0 })}
                  className="input w-24 py-1 text-sm text-right" />
              </div>
              <div className="flex justify-between"><span className="text-gray-500">+ Cobrado en efectivo</span><span className="font-semibold tabular-nums">{formatMoney(mov.efectivoIngreso)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">− Gastos pagados en efectivo</span><span className="font-semibold text-orange-600 tabular-nums">−{formatMoney(mov.gastoEfectivoTotal)}</span></div>
              {mov.gastosEfectivo.length > 0 && (
                <p className="text-[11px] text-gray-400 leading-snug">
                  {mov.gastosEfectivo.map(g => `${g.description || g.category} ${formatMoney(g.amount)}`).join(' · ')}
                </p>
              )}
              <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-1.5">
                <span className="font-semibold text-gray-700 dark:text-gray-200">Debería haber</span>
                <span className="font-black text-gray-900 dark:text-white tabular-nums">{formatMoney(esperado)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700 dark:text-gray-200">Contaste</span>
                <input type="number" min="0" step="0.1" placeholder="0.00" value={contado} disabled={cerrada}
                  onChange={e => setContado(e.target.value)}
                  className="input w-28 py-1 text-sm text-right font-bold" />
              </div>
              {diferencia != null && (
                <div className={`flex justify-between rounded-lg px-2 py-1.5 font-bold ${
                  Math.abs(diferencia) < 0.5 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                  : diferencia > 0 ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400'
                  : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                  <span>{Math.abs(diferencia) < 0.5 ? 'Cuadra' : diferencia > 0 ? 'Sobra' : 'Falta'}</span>
                  <span className="tabular-nums">{Math.abs(diferencia) < 0.5 ? '✓' : formatMoney(Math.abs(diferencia))}</span>
                </div>
              )}
            </div>
          </section>

          {/* Totales del día */}
          <section className="text-xs text-gray-500 space-y-0.5">
            {Object.entries(mov.totales).map(([m, v]) => (
              <div key={m} className="flex justify-between"><span>{ICONO[m] || '💳'} {NOMBRE[m] || m}</span><span className="font-semibold tabular-nums">{formatMoney(v)}</span></div>
            ))}
          </section>

          <textarea className="input text-sm" rows={2} placeholder="Notas (opcional)" value={notas} disabled={cerrada}
            onChange={e => setNotas(e.target.value)} />
        </div>

        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800">
          {cerrada ? (
            <button onClick={() => guardar({ estado: 'abierta', cerrado_at: null, cerrado_por: null }, 'Caja reabierta')} disabled={guardando}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300">
              <Unlock className="w-4 h-4" /> Reabrir caja
            </button>
          ) : (
            <button onClick={cerrar} disabled={guardando}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold disabled:opacity-50">
              <Lock className="w-4 h-4" /> Cerrar caja
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
