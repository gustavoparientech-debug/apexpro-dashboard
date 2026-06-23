import Anthropic from 'npm:@anthropic-ai/sdk@0.27.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { message, tone, prompt } = await req.json()

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

    const systemPrompt = `Eres un asistente para un taller de lavado y detailing automotriz llamado Apex Pro.
Tu tarea es transformar mensajes cortos del dueño en anuncios bien redactados para el equipo de trabajo.
Responde SOLO con el mensaje transformado, sin explicaciones, sin comillas, sin encabezados.
El mensaje debe estar listo para copiar y enviar por WhatsApp.`

    const userPrompt = `${prompt}

Mensaje original: "${message}"

Transforma este mensaje manteniendo la información clave pero haciéndolo más completo y apropiado para el tono indicado.`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const result = response.content[0].type === 'text' ? response.content[0].text : ''

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
