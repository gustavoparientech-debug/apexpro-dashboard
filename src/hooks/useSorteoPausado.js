import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ─── Sorteo en pausa ─────────────────────────────────────────────────────────
// `raffle_config.pausado` apaga todo lo del sorteo para todos: páginas
// públicas, panel, menú y atajos. Al reactivarlo vuelve tal cual estaba
// (tickets, pedidos y configuración no se tocan).
//
// Un solo estado compartido: al cambiarlo desde el panel se actualiza el menú
// y el resto de la app sin recargar. Se recuerda en el teléfono para no
// mostrar el sorteo ni un instante al abrir si está en pausa.

const CLAVE = 'apex_sorteo_pausado'
let valor = (() => { try { return localStorage.getItem(CLAVE) === '1' } catch { return false } })()
let cargado = false
const oyentes = new Set()

function publicar(v) {
  valor = !!v
  cargado = true
  try { localStorage.setItem(CLAVE, valor ? '1' : '0') } catch { /* sin almacenamiento */ }
  oyentes.forEach(fn => fn(valor))
}

// Sin conexión se queda con lo último conocido, para no dejar la página
// cargando para siempre.
export async function refrescarSorteoPausado() {
  try {
    const { data, error } = await supabase.from('raffle_config').select('pausado').eq('id', 1).maybeSingle()
    publicar(error ? valor : !!data?.pausado)
  } catch { publicar(valor) }
  return valor
}

export async function setSorteoPausado(pausado) {
  const { error } = await supabase.from('raffle_config')
    .update({ pausado, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) throw error
  publicar(pausado)
}

// Devuelve { pausado, cargado }. `cargado` es false hasta la primera lectura
// de la base en esta sesión (mientras tanto vale lo recordado en el teléfono).
export function useSorteoPausado() {
  const [estado, setEstado] = useState({ pausado: valor, cargado })
  useEffect(() => {
    const fn = v => setEstado({ pausado: v, cargado: true })
    oyentes.add(fn)
    refrescarSorteoPausado().catch(() => {})
    const alVolver = () => { if (document.visibilityState === 'visible') refrescarSorteoPausado().catch(() => {}) }
    document.addEventListener('visibilitychange', alVolver)
    return () => { oyentes.delete(fn); document.removeEventListener('visibilitychange', alVolver) }
  }, [])
  return estado
}
