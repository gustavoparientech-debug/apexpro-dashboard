import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Variables de Supabase no configuradas. Usando modo demo.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  { auth: { flowType: 'implicit', detectSessionInUrl: true } }
)

// supabase-js descarta el cuerpo de la respuesta cuando una edge function
// devuelve 4xx/5xx: solo queda "Edge Function returned a non-2xx status code".
// El mensaje real viene en error.context, que es el Response original.
export async function invokeFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let detalle = ''
    try { detalle = (await error.context?.json())?.error } catch {}
    throw new Error(detalle || error.message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}
