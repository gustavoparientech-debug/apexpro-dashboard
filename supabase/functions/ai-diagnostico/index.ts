import Anthropic from 'npm:@anthropic-ai/sdk@0.27.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Informe de diagnóstico del taller. Recibe los datos del vehículo y unas
// palabras clave de lo que vio el técnico ("rayón capot, óxido guardafango
// izquierdo, pintura opaca") y devuelve el informe ya redactado, en secciones,
// para imprimirlo y entregárselo al cliente o al técnico.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { servicio, palabras, vehiculo, observaciones } = await req.json()

    if (!palabras || !String(palabras).trim()) {
      return new Response(JSON.stringify({ error: 'Faltan las palabras clave' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

    const systemPrompt = `Eres el jefe de taller de Apex Pro Detailing (Arequipa, Perú), especialista en planchado y pintura, PPF, recubrimientos cerámicos y detailing.

Redactas informes de diagnóstico a partir de las notas cortas del técnico. El informe se imprime y se entrega al cliente o al técnico que hará el trabajo, así que debe ser claro, honesto y sin exagerar.

Reglas:
- Escribe en español de Perú, en tono profesional y directo. Nada de marketing.
- Solo afirma lo que se desprende de las notas. Si algo no se puede saber sin revisar el vehículo, dilo como "a confirmar en taller".
- Los trabajos recomendados deben ser propios del taller (planchado, pintura, pulido, descontaminación, cerámico, PPF, polarizado, detailing). No inventes precios ni plazos exactos si no te los dan.
- Responde SOLO con un objeto JSON válido, sin texto alrededor y sin bloques de código.

Formato exacto del JSON:
{
  "resumen": "2-3 frases sobre el estado general del vehículo",
  "estado_general": "Bueno | Regular | Malo",
  "hallazgos": [{ "zona": "", "detalle": "", "severidad": "Leve | Moderado | Severo" }],
  "trabajos": [{ "nombre": "", "detalle": "", "prioridad": "Alta | Media | Baja" }],
  "proceso": ["paso 1", "paso 2"],
  "materiales": ["material 1"],
  "tiempo_estimado": "ej: 3 a 4 días hábiles",
  "cuidados": ["indicación de cuidado posterior"],
  "nota_tecnico": "advertencias o detalles para quien ejecuta el trabajo"
}`

    const userPrompt = [
      `Servicio solicitado: ${servicio || 'no especificado'}`,
      vehiculo ? `Vehículo: ${vehiculo}` : null,
      `Notas del técnico: ${palabras}`,
      observaciones ? `Observaciones adicionales: ${observaciones}` : null,
    ].filter(Boolean).join('\n')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const texto = response.content[0].type === 'text' ? response.content[0].text : ''
    // El modelo puede envolver el JSON en ```json … ```: se recorta antes de parsear.
    const limpio = texto.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

    let informe
    try {
      informe = JSON.parse(limpio)
    } catch {
      return new Response(JSON.stringify({ error: 'La respuesta no vino en el formato esperado', raw: texto }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ informe }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    // Los errores de la API se traducen: al taller no le sirve un stack trace.
    const crudo = String(err?.message || err)
    const amable =
      /credit balance/i.test(crudo)   ? 'La cuenta de IA se quedó sin saldo. Recarga créditos en Anthropic para volver a generar informes.'
      : /api key|authentication/i.test(crudo) ? 'La clave de la IA no es válida. Revisa ANTHROPIC_API_KEY en Supabase.'
      : /rate limit/i.test(crudo)     ? 'La IA está saturada en este momento. Intenta de nuevo en un minuto.'
      : crudo
    return new Response(JSON.stringify({ error: amable }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
