// Logo de la marca. Hay dos versiones porque el logotipo lleva texto: sobre
// fondo claro el texto va oscuro y sobre fondo oscuro va blanco. Se alternan
// por CSS con la clase `dark` del documento, sin JavaScript, para que no haya
// parpadeo al cargar.
//
// Archivos esperados en /public:
//   logo-claro.png   → para fondos claros (texto oscuro)
//   logo-oscuro.png  → para fondos oscuros (texto blanco)
export default function Logo({ className = '', alt = 'Apex Pro Detailing' }) {
  return (
    <>
      <img src="/logo-claro.png"  alt={alt} className={`${className} block dark:hidden`} />
      <img src="/logo-oscuro.png" alt={alt} className={`${className} hidden dark:block`} />
    </>
  )
}

// Variante para superficies que siempre son oscuras (barra lateral, login),
// independientemente del tema elegido.
export function LogoOscuro({ className = '', alt = 'Apex Pro Detailing' }) {
  return <img src="/logo-oscuro.png" alt={alt} className={className} />
}
