// Regenera los iconos de la aplicacion a partir del logo cuadrado.
//
// Cuando cambia la marca hay que reemplazar los archivos fuente en /public y
// volver a ejecutar esto, porque los iconos son recortes derivados: si solo se
// cambia el logo, los iconos del celular y de la pestaña siguen siendo viejos.
//
//   npm run logos
//
// Fuentes que se reemplazan a mano en /public:
//   logo-oscuro.png          apaisado, texto blanco   → barra lateral, login
//   logo-claro.png           apaisado, texto oscuro   → fondos claros
//   logo-cuadrado-oscuro.jpg cuadrado, fondo oscuro   → iconos (este archivo)
//   logo-cuadrado-claro.jpg  cuadrado, fondo claro    → PDF y boletas

import sharp from 'sharp'
import { existsSync } from 'node:fs'

const ORIGEN = 'public/logo-cuadrado-oscuro.jpg'

// El icono se ve sobre el fondo del sistema (pantalla de inicio, pestaña del
// navegador), no sobre la app: por eso se usa la variante de fondo oscuro.
const SALIDAS = [
  ['public/icon-512.png', 512],
  ['public/icon-192.png', 192],
  ['public/apple-touch-icon.png', 180],
  ['public/favicon.png', 64],
]

if (!existsSync(ORIGEN)) {
  console.error(`✗ Falta ${ORIGEN}`)
  console.error('  Coloca ahi el logo cuadrado y vuelve a ejecutar.')
  process.exit(1)
}

const { width, height } = await sharp(ORIGEN).metadata()
if (width !== height) {
  console.warn(`⚠ ${ORIGEN} es ${width}x${height}, no cuadrado: se recortara al centro.`)
}
if (width < 512) {
  console.warn(`⚠ ${ORIGEN} mide ${width}px; conviene 512 o mas para que no se vea borroso.`)
}

for (const [destino, lado] of SALIDAS) {
  await sharp(ORIGEN).resize(lado, lado, { fit: 'cover' }).png().toFile(destino)
  console.log(`✓ ${destino.padEnd(30)} ${lado}x${lado}`)
}

console.log('\nListo. Revisa como se ven y haz commit de /public.')
console.log('En el celular el icono viejo queda cacheado: hay que reinstalar la app.')
