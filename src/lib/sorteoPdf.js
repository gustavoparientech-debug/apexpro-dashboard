import { fmtNum, fmtFecha } from './sorteo'

// PDF con los tickets aprobados de un pedido: 8 tickets por hoja A4.

function loadLogo() {
  return new Promise(resolve => {
    fetch('/logo-cuadrado-claro.jpg').then(r => r.ok ? r.blob() : null).then(blob => {
      if (!blob) return resolve(null)
      const reader = new FileReader()
      reader.onload = e => resolve(e.target.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    }).catch(() => resolve(null))
  })
}

export async function downloadTicketsPdf(order, total = 600) {
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), loadLogo()])
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const W = 90, H = 62, GX = 10, GY = 8, X0 = 10, Y0 = 12
  const fecha = fmtFecha(order.fecha_sorteo) || 'Fecha por anunciar'

  order.tickets.forEach((t, i) => {
    const pos = i % 8
    if (i > 0 && pos === 0) doc.addPage()
    const x = X0 + (pos % 2) * (W + GX)
    const y = Y0 + Math.floor(pos / 2) * (H + GY)

    doc.setDrawColor(30, 30, 30)
    doc.setLineWidth(0.4)
    doc.roundedRect(x, y, W, H, 3, 3)
    doc.setFillColor(204, 20, 20)
    doc.roundedRect(x, y, W, 14, 3, 3, 'F')
    doc.rect(x, y + 8, W, 6, 'F')

    if (logo) doc.addImage(logo, 'JPEG', x + 3, y + 2, 10, 10)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    doc.text(order.titulo || 'Sorteo Apex Pro', x + (logo ? 16 : 5), y + 6.5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    doc.text('Apex Pro Detailing · Arequipa', x + (logo ? 16 : 5), y + 11)

    doc.setTextColor(20, 20, 20)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    doc.text('TICKET N.°', x + 5, y + 21)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(30)
    doc.text(fmtNum(t.number, total), x + 5, y + 33)

    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    doc.text('CÓDIGO DE VERIFICACIÓN', x + W - 5, y + 21, { align: 'right' })
    doc.setFont('courier', 'bold'); doc.setFontSize(11)
    doc.text(t.code || '—', x + W - 5, y + 27, { align: 'right' })

    doc.setDrawColor(200, 200, 200)
    doc.setLineDashPattern([1, 1], 0)
    doc.line(x + 5, y + 38, x + W - 5, y + 38)
    doc.setLineDashPattern([], 0)

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    doc.text(`Participante: ${order.nombre}`, x + 5, y + 44, { maxWidth: W - 10 })
    doc.text(`DNI: ${order.dni}`, x + 5, y + 49)
    doc.text(`Sorteo: ${fecha}`, x + 5, y + 54, { maxWidth: W - 10 })
    doc.setFontSize(6); doc.setTextColor(120, 120, 120)
    doc.text('Ticket válido solo con su código. WhatsApp 959 240 309 · @apex.pro.aqp', x + 5, y + 59)
  })

  const nums = order.tickets.map(t => fmtNum(t.number, total)).join('-')
  doc.save(`tickets-apex-${nums.length > 40 ? order.id.slice(0, 8) : nums}.pdf`)
}
