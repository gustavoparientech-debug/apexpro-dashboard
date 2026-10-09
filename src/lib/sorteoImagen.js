import { fmtNum, fmtFecha } from './sorteo'

// Tickets aprobados como imágenes JPG (una por ticket), fáciles de mandar por
// WhatsApp. Mismo diseño que tenía el PDF: retícula de 90×62 escalada a píxeles.

const K = 16                       // px por unidad → 1440×992 px
const PAD = 6                      // margen alrededor del ticket (unidades)
const W = 90, H = 62

function loadLogo() {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = '/logo-cuadrado-claro.jpg'
  })
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawTicket(order, t, total, logo) {
  const canvas = document.createElement('canvas')
  canvas.width = (W + PAD * 2) * K
  canvas.height = (H + PAD * 2) * K
  const ctx = canvas.getContext('2d')
  const u = (v) => v * K
  const x = u(PAD), y = u(PAD)
  const font = (weight, size, family = 'Helvetica, Arial, sans-serif') => `${weight} ${u(size)}px ${family}`
  const fecha = fmtFecha(order.fecha_sorteo) || 'Fecha por anunciar'

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Tarjeta y franja roja
  ctx.save()
  roundRect(ctx, x, y, u(W), u(H), u(3))
  ctx.clip()
  ctx.fillStyle = '#cc1414'
  ctx.fillRect(x, y, u(W), u(14))
  ctx.restore()
  roundRect(ctx, x, y, u(W), u(H), u(3))
  ctx.lineWidth = u(0.4)
  ctx.strokeStyle = '#1e1e1e'
  ctx.stroke()

  if (logo) ctx.drawImage(logo, x + u(3), y + u(2), u(10), u(10))
  const tx = x + u(logo ? 16 : 5)
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'alphabetic'
  ctx.font = font('bold', 5.2)
  ctx.fillText(order.titulo || 'Sorteo Apex Pro', tx, y + u(7))
  ctx.font = font('normal', 3.2)
  ctx.fillText('Apex Pro Detailing · Arequipa', tx, y + u(11.2))

  // Número y código
  ctx.fillStyle = '#141414'
  ctx.font = font('normal', 3.2)
  ctx.fillText('TICKET N.°', x + u(5), y + u(21))
  ctx.font = font('bold', 14)
  ctx.fillText(fmtNum(t.number, total), x + u(5), y + u(34))

  ctx.textAlign = 'right'
  ctx.font = font('normal', 3.2)
  ctx.fillText('CÓDIGO DE VERIFICACIÓN', x + u(W - 5), y + u(21))
  ctx.font = font('bold', 5.2, '"Courier New", Courier, monospace')
  ctx.fillText(t.code || '—', x + u(W - 5), y + u(27.5))
  ctx.textAlign = 'left'

  ctx.setLineDash([u(1), u(1)])
  ctx.strokeStyle = '#c8c8c8'
  ctx.lineWidth = u(0.3)
  ctx.beginPath(); ctx.moveTo(x + u(5), y + u(38)); ctx.lineTo(x + u(W - 5), y + u(38)); ctx.stroke()
  ctx.setLineDash([])

  // Datos del participante
  ctx.font = font('normal', 3.6)
  ctx.fillText(`Participante: ${order.nombre}`, x + u(5), y + u(44), u(W - 10))
  if (order.dni) {
    ctx.fillText(`DNI: ${order.dni}`, x + u(5), y + u(49))
    ctx.fillText(`Sorteo: ${fecha}`, x + u(5), y + u(54), u(W - 10))
  } else {
    ctx.fillText(`Sorteo: ${fecha}`, x + u(5), y + u(50), u(W - 10))
  }
  ctx.fillStyle = '#787878'
  ctx.font = font('normal', 2.7)
  ctx.fillText('Ticket válido solo con su código. WhatsApp 959 240 309 · @apex.pro.aqp', x + u(5), y + u(59), u(W - 10))

  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92))
}

// En el celular abre el menú de compartir (WhatsApp, guardar en galería…);
// en la computadora descarga un JPG por ticket.
export async function downloadTicketImages(order, total = 600) {
  const logo  = await loadLogo()
  const files = []
  for (const t of order.tickets) {
    const blob = await drawTicket(order, t, total, logo)
    files.push(new File([blob], `ticket-apex-${fmtNum(t.number, total)}.jpg`, { type: 'image/jpeg' }))
  }

  const esCelular = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  if (esCelular && navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, title: order.titulo || 'Sorteo Apex Pro' })
      return
    } catch (err) {
      if (err?.name === 'AbortError') return   // el usuario cerró el menú
    }
  }

  for (const f of files) {
    const url = URL.createObjectURL(f)
    const a = document.createElement('a')
    a.href = url
    a.download = f.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    await new Promise(r => setTimeout(r, 300))  // los navegadores bloquean descargas seguidas sin pausa
  }
}
