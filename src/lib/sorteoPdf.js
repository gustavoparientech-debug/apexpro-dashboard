import { fmtNum, fmtFecha } from './sorteo'

// PDF con los tickets aprobados de un pedido: un ticket por página.

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

  // Un ticket por página y la página del tamaño del ticket (con margen), para
  // que en el celular se vea completo y centrado. El diseño está en una
  // retícula de 90×62 que se escala con S.
  const S = 1.6, M = 6
  const W = 90 * S, H = 62 * S
  const k = (v) => v * S
  const doc = new jsPDF({ unit: 'mm', format: [W + 2 * M, H + 2 * M], orientation: 'landscape' })
  const fecha = fmtFecha(order.fecha_sorteo) || 'Fecha por anunciar'

  order.tickets.forEach((t, i) => {
    if (i > 0) doc.addPage([W + 2 * M, H + 2 * M], 'landscape')
    const x = M, y = M

    doc.setDrawColor(30, 30, 30)
    doc.setLineWidth(0.5)
    doc.roundedRect(x, y, W, H, k(3), k(3))
    doc.setFillColor(204, 20, 20)
    doc.roundedRect(x, y, W, k(14), k(3), k(3), 'F')
    doc.rect(x, y + k(8), W, k(6), 'F')

    if (logo) doc.addImage(logo, 'JPEG', x + k(3), y + k(2), k(10), k(10))
    const tx = x + k(logo ? 16 : 5)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(k(11))
    doc.text(order.titulo || 'Sorteo Apex Pro', tx, y + k(6.5))
    doc.setFont('helvetica', 'normal'); doc.setFontSize(k(7))
    doc.text('Apex Pro Detailing · Arequipa', tx, y + k(11))

    doc.setTextColor(20, 20, 20)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(k(7))
    doc.text('TICKET N.°', x + k(5), y + k(21))
    doc.setFont('helvetica', 'bold'); doc.setFontSize(k(30))
    doc.text(fmtNum(t.number, total), x + k(5), y + k(33))

    doc.setFont('helvetica', 'normal'); doc.setFontSize(k(7))
    doc.text('CÓDIGO DE VERIFICACIÓN', x + W - k(5), y + k(21), { align: 'right' })
    doc.setFont('courier', 'bold'); doc.setFontSize(k(11))
    doc.text(t.code || '—', x + W - k(5), y + k(27), { align: 'right' })

    doc.setDrawColor(200, 200, 200)
    doc.setLineDashPattern([k(1), k(1)], 0)
    doc.line(x + k(5), y + k(38), x + W - k(5), y + k(38))
    doc.setLineDashPattern([], 0)

    doc.setFont('helvetica', 'normal'); doc.setFontSize(k(8))
    doc.text(`Participante: ${order.nombre}`, x + k(5), y + k(44), { maxWidth: W - k(10) })
    doc.text(`DNI: ${order.dni}`, x + k(5), y + k(49))
    doc.text(`Sorteo: ${fecha}`, x + k(5), y + k(54), { maxWidth: W - k(10) })
    doc.setFontSize(k(6)); doc.setTextColor(120, 120, 120)
    doc.text('Ticket válido solo con su código. WhatsApp 959 240 309 · @apex.pro.aqp', x + k(5), y + k(59))
  })

  const nums = order.tickets.map(t => fmtNum(t.number, total)).join('-')
  doc.save(`tickets-apex-${nums.length > 40 ? order.id.slice(0, 8) : nums}.pdf`)
}
