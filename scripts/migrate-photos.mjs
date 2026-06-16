// Migra fotos base64 guardadas directamente en tickets.photo_url / tickets.payment_photo
// (de antes de pasar a Supabase Storage) hacia Storage, dejando solo la URL en la fila.
// Esto es lo que hace pesada la consulta principal del dashboard (select * por rango de fechas).
//
// Uso:
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxxxx node scripts/migrate-photos.mjs
//
// La service_role key se obtiene en Supabase: Project Settings → API → service_role (secret).
// NUNCA subas esa key a git ni la pongas en el frontend.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY como variables de entorno.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const BUCKET = 'payment-photos'
const BATCH_SIZE = 25

function base64ToBuffer(dataUrl) {
  const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl)
  if (!match) return null
  return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') }
}

async function migrateColumn(column, folder) {
  let migrated = 0
  let failed = 0

  while (true) {
    const { data: rows, error } = await supabase
      .from('tickets')
      .select(`id, ${column}`)
      .like(column, 'data:%')
      .limit(BATCH_SIZE)

    if (error) { console.error(`Error leyendo tickets (${column}):`, error.message); break }
    if (!rows || rows.length === 0) break

    for (const row of rows) {
      const parsed = base64ToBuffer(row[column])
      if (!parsed) {
        // No es un base64 válido, lo limpiamos para que no quede en bucle infinito
        await supabase.from('tickets').update({ [column]: null }).eq('id', row.id)
        failed++
        continue
      }

      const ext = parsed.contentType.split('/')[1] || 'jpg'
      const path = `${folder}/migrado_${row.id}_${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, parsed.buffer, { upsert: true, contentType: parsed.contentType })

      if (uploadError) {
        console.error(`Error subiendo ticket ${row.id} (${column}):`, uploadError.message)
        failed++
        continue
      }

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)

      const { error: updateError } = await supabase
        .from('tickets')
        .update({ [column]: pub.publicUrl })
        .eq('id', row.id)

      if (updateError) {
        console.error(`Error actualizando ticket ${row.id} (${column}):`, updateError.message)
        failed++
        continue
      }

      migrated++
      console.log(`✓ ticket ${row.id} (${column}) migrado`)
    }
  }

  return { migrated, failed }
}

const placas = await migrateColumn('photo_url', 'placas')
const yape = await migrateColumn('payment_photo', 'yape')

console.log('\n--- Resumen ---')
console.log(`Placas:  ${placas.migrated} migradas, ${placas.failed} fallidas`)
console.log(`Yape:    ${yape.migrated} migradas, ${yape.failed} fallidas`)
