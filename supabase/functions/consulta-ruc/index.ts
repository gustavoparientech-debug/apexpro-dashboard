const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { ruc } = await req.json()

    if (!/^\d{11}$/.test(ruc ?? '')) {
      return json({ error: 'El RUC debe tener 11 dígitos' }, 400)
    }

    // El token vive solo aquí, nunca en el frontend.
    const token = Deno.env.get('RUC_API_TOKEN')
    if (!token) {
      return json({ error: 'Falta configurar RUC_API_TOKEN en Supabase' }, 503)
    }

    const res = await fetch('https://api.json.pe/api/ruc', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ruc }),
    })

    if (!res.ok) {
      // 404 = RUC inexistente; el resto es problema del proveedor o del token.
      if (res.status === 404) return json({ error: 'No se encontró ese RUC' }, 404)
      return json({ error: `El servicio de consulta respondió ${res.status}` }, 502)
    }

    const payload = await res.json()
    if (!payload?.success || !payload?.data) {
      return json({ error: payload?.message || 'No se encontró ese RUC' }, 404)
    }

    const d = payload.data

    // Se normaliza al shape que espera la app, para poder cambiar de proveedor
    // sin tocar el frontend.
    return json({
      ruc: d.ruc,
      razonSocial: d.nombre_o_razon_social ?? '',
      direccion: d.direccion_completa || d.direccion || '',
      ubigeo: [d.departamento, d.provincia, d.distrito].filter(Boolean).join(' - '),
      estado: d.estado ?? '',
      condicion: d.condicion ?? '',
    })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
