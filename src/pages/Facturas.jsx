import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, invokeFunction } from '../lib/supabase'
import { todayISO, formatMoney } from '../lib/utils'
import { Plus, FileText, Send, Search, X, Trash2, Download, Eye, Copy, ChevronDown, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

const UNIDADES = [
  { value: 'NIU', label: 'Unidad' },
  { value: 'ZZ',  label: 'Servicio' },
  { value: 'HUR', label: 'Hora' },
  { value: 'DAY', label: 'Día' },
]

const CONDICIONES_PAGO = ['CONTADO', 'CREDITO 7 DIAS', 'CREDITO 15 DIAS', 'CREDITO 30 DIAS']

const IGV_RATE = 0.18

function numberToWords(n) {
  const unidades = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE']
  const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE']
  const decenas = ['', '', 'VEINTI', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

  if (n === 0) return 'CERO'
  if (n === 100) return 'CIEN'

  let result = ''
  if (n >= 1000) {
    const miles = Math.floor(n / 1000)
    result += miles === 1 ? 'MIL ' : numberToWords(miles) + ' MIL '
    n %= 1000
  }
  if (n >= 100) { result += centenas[Math.floor(n / 100)] + ' '; n %= 100 }
  if (n >= 10 && n <= 15) { result += especiales[n - 10]; return result.trim() }
  if (n === 20) { result += 'VEINTE'; return result.trim() }
  if (n >= 16 && n <= 19) { result += 'DIECI' + unidades[n - 10]; return result.trim() }
  if (n >= 21 && n <= 29) { result += 'VEINTI' + unidades[n - 20]; return result.trim() }
  if (n >= 30) {
    result += decenas[Math.floor(n / 10)]
    if (n % 10 !== 0) result += ' Y ' + unidades[n % 10]
    return result.trim()
  }
  result += unidades[n]
  return result.trim()
}

function amountToWords(amount) {
  const entero = Math.floor(amount)
  const centavos = Math.round((amount - entero) * 100)
  return `${numberToWords(entero)} CON ${String(centavos).padStart(2, '0')}/100 SOLES.`
}

function emptyItem() {
  return { codigo: '', descripcion: '', cantidad: 1, unidad: 'NIU', precio_unitario: '', descuento: 0 }
}

// ─── PDF Generation ──────────────────────────────────────────────────────────
function generateInvoicePDF(inv, logoB64) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, mL = 10, mR = 10

  // ── Header: Empresa ──
  const headerH = 42
  doc.setDrawColor(0); doc.setLineWidth(0.5)
  doc.rect(mL, 8, 95, headerH)

  if (logoB64) {
    doc.addImage(logoB64, 'JPEG', mL + 2, 10, 28, 28)
  }
  const tLeft = logoB64 ? mL + 32 : mL + 4
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0)
  doc.text('APEX PRO DETAILING E.I.R.L.', tLeft, 17)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(80)
  doc.text('CAL.ALFONSO LOPEZ NRO. 700 URB. ZAMACOLA', tLeft, 22)
  doc.text('Arequipa - Arequipa - Cerro Colorado', tLeft, 26)
  doc.text('906 451 763', tLeft, 30)

  // ── Header: RUC / Factura ──
  const rucX = W - mR - 65, rucW = 65
  doc.setFillColor(30, 30, 30)
  doc.rect(rucX, 8, rucW, 12, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255)
  doc.text(`RUC: 20614041669`, rucX + rucW / 2, 16, { align: 'center' })

  doc.setTextColor(0); doc.setFontSize(10)
  doc.text('FACTURA ELECTRÓNICA', rucX + rucW / 2, 28, { align: 'center' })
  doc.setFontSize(14)
  doc.text(`${inv.serie}-${String(inv.correlativo).padStart(3, '0')}`, rucX + rucW / 2, 36, { align: 'center' })
  doc.setDrawColor(0); doc.rect(rucX, 8, rucW, headerH)

  // ── Datos del cliente ──
  const cY = 56
  doc.setFillColor(245, 245, 245)
  doc.rect(mL, cY, W - mL - mR, 32, 'F')
  doc.setDrawColor(0); doc.rect(mL, cY, W - mL - mR, 32)

  doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(180, 0, 0)
  const col1 = mL + 3, col1v = mL + 30, col2 = 120, col2v = 158

  doc.text('FECHA', col1, cY + 5)
  doc.text('RUC', col1, cY + 10)
  doc.text('RAZON SOCIAL', col1, cY + 15)
  doc.text('DIRECCIÓN', col1, cY + 20)
  doc.text('UBIGEO', col1, cY + 25)

  doc.setTextColor(0); doc.setFont('helvetica', 'normal')
  const fecha = new Date(inv.fecha + 'T12:00:00')
  doc.text(fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }), col1v, cY + 5)
  doc.text(inv.client_ruc, col1v, cY + 10)

  if (inv.placa) {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(180, 0, 0)
    doc.text('PLACA VEHÍCULO', col1v + 30, cY + 10)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(0)
    doc.text(inv.placa, col1v + 65, cY + 10)
  }

  doc.text(inv.client_razon_social, col1v, cY + 15)
  doc.text(inv.client_direccion || '', col1v, cY + 20)
  doc.text(inv.client_ubigeo || '', col1v, cY + 25)

  doc.setFont('helvetica', 'bold'); doc.setTextColor(180, 0, 0)
  doc.text('CONDICIÓN PAGO', col2, cY + 5)
  doc.text('MONEDA', col2, cY + 10)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(0)
  doc.text(inv.condicion_pago, col2v, cY + 5)
  doc.text(inv.moneda === 'PEN' ? 'PEN - SOLES' : inv.moneda, col2v, cY + 10)

  // ── Tabla de items ──
  const tY = cY + 38
  const cols = [mL, mL + 12, mL + 32, mL + 85, mL + 100, mL + 115, mL + 132, mL + 152, mL + 170, W - mR]
  const headers = ['#', 'Código', 'Descripción', 'Cant', 'UM', 'V.Unit', 'Importe', '-Ds/+Cr', 'Subtotal']

  doc.setFillColor(245, 245, 245)
  doc.rect(mL, tY, W - mL - mR, 7, 'F')
  doc.setDrawColor(0); doc.rect(mL, tY, W - mL - mR, 7)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(0)
  headers.forEach((h, i) => {
    const x = i === 0 ? cols[0] + 3 : (cols[i] + cols[i + 1]) / 2
    doc.text(h, x, tY + 5, { align: i === 0 ? 'left' : 'center' })
  })

  let y = tY + 7
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  const items = inv.items || []
  items.forEach((item, idx) => {
    const importe = item.cantidad * item.precio_unitario
    const subtotal = importe - (item.descuento || 0)
    doc.rect(mL, y, W - mL - mR, 6)
    doc.text(String(idx + 1), cols[0] + 3, y + 4)
    doc.text(item.codigo || '', (cols[1] + cols[2]) / 2, y + 4, { align: 'center' })
    doc.text(item.descripcion || '', cols[2] + 2, y + 4)
    doc.text(String(item.cantidad), (cols[3] + cols[4]) / 2, y + 4, { align: 'center' })
    doc.text(item.unidad || 'NIU', (cols[4] + cols[5]) / 2, y + 4, { align: 'center' })
    doc.text(item.precio_unitario.toFixed(3), cols[6] - 2, y + 4, { align: 'right' })
    doc.text(importe.toFixed(3), cols[7] - 2, y + 4, { align: 'right' })
    doc.text((item.descuento || 0).toFixed(2), cols[8] - 2, y + 4, { align: 'right' })
    doc.text(subtotal.toFixed(2), cols[9] - 2, y + 4, { align: 'right' })
    y += 6
  })

  // Total en letras
  y += 2
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7)
  doc.text(`Son: ${inv.total_letras}`, mL + 3, y + 4)

  // Totales
  const totX = 130, totW = W - mR - totX
  const tots = [
    ['Importe Bruto S/', inv.subtotal.toFixed(2)],
    ['Operaciones Gravadas S/', inv.subtotal.toFixed(2)],
    [`IGV ${(IGV_RATE * 100).toFixed(0)}% S/`, inv.igv.toFixed(2)],
    ['IMPORTE TOTAL S/', inv.total.toFixed(2)],
  ]
  tots.forEach((t, i) => {
    const ty = y + i * 6
    doc.setFont('helvetica', i === 3 ? 'bold' : 'normal')
    doc.text(t[0], totX + totW - 22, ty + 4, { align: 'right' })
    doc.text(t[1], W - mR - 2, ty + 4, { align: 'right' })
    if (i === 3) {
      doc.setDrawColor(0); doc.setLineWidth(0.3)
      doc.rect(totX, ty, totW, 6)
    }
  })

  // Footer
  const fY = Math.max(y + 30, 250)
  doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(120)
  doc.text('Representación impresa del comprobante electrónico.', W / 2, fY, { align: 'center' })

  // ── Marca de borrador ──
  // Mientras no exista integración con el PSE (Facturalá), este PDF NO es un
  // comprobante válido: no se envía a SUNAT, no tiene XML firmado ni CDR.
  // La marca evita que se entregue a un cliente por error.
  if (!inv.cdr_hash) {
    doc.setTextColor(220, 38, 38)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(38)
    doc.saveGraphicsState()
    if (doc.setGState) doc.setGState(new doc.GState({ opacity: 0.16 }))
    doc.text('BORRADOR', W / 2, 150, { align: 'center', angle: 32 })
    doc.text('SIN VALIDEZ FISCAL', W / 2, 172, { align: 'center', angle: 32 })
    doc.restoreGraphicsState()

    doc.setTextColor(220, 38, 38); doc.setFontSize(7)
    doc.text('DOCUMENTO NO VÁLIDO COMO COMPROBANTE DE PAGO — no declarado ante SUNAT',
      W / 2, fY + 4, { align: 'center' })
  }

  return doc
}


// ─── Main Component ──────────────────────────────────────────────────────────
export default function Facturas() {
  const { profile } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState(null)
  const [logoB64, setLogoB64] = useState(null)

  useEffect(() => {
    fetch('/logo-cuadrado-claro.jpg')
      .then(r => r.ok ? r.blob() : Promise.reject())
      .then(blob => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob) }))
      .then(b64 => setLogoB64(b64))
      .catch(() => {})
  }, [])

  const loadInvoices = useCallback(async () => {
    if (IS_DEMO) { setLoading(false); return }
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    setInvoices(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadInvoices() }, [loadInvoices])

  const filtered = useMemo(() => {
    if (!search.trim()) return invoices
    const q = search.toLowerCase()
    return invoices.filter(i =>
      i.client_razon_social?.toLowerCase().includes(q) ||
      i.client_ruc?.includes(q) ||
      `${i.serie}-${i.correlativo}`.includes(q) ||
      i.placa?.toLowerCase().includes(q)
    )
  }, [invoices, search])

  const stats = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7)
    const delMes = invoices.filter(i => i.fecha?.startsWith(mes) && i.estado !== 'anulada')
    return { count: delMes.length, total: delMes.reduce((s, i) => s + Number(i.total), 0) }
  }, [invoices])

  function handleDownloadPDF(inv) {
    const doc = generateInvoicePDF(inv, logoB64)
    doc.save(`Factura-${inv.serie}-${String(inv.correlativo).padStart(3, '0')}.pdf`)
  }

  function handleShareWhatsApp(inv) {
    const num = `${inv.serie}-${String(inv.correlativo).padStart(3, '0')}`
    const text = `Hola, le enviamos su Factura Electrónica ${num} por un total de ${formatMoney(inv.total)}.\n\nAPEX PRO DETAILING E.I.R.L.\nRUC: 20614041669`
    window.open(`https://wa.me/${inv.client_phone ? inv.client_phone.replace(/\D/g, '') : ''}?text=${encodeURIComponent(text)}`, '_blank')
  }

  async function handleSendEmail(inv) {
    if (!inv.client_email) { toast.error('El cliente no tiene email registrado'); return }
    const num = `${inv.serie}-${String(inv.correlativo).padStart(3, '0')}`
    try {
      const doc = generateInvoicePDF(inv, logoB64)
      const pdfBase64 = doc.output('datauristring').split(',')[1]

      await invokeFunction('enviar-correo', {
        kind: 'factura',
        subject: `Factura Electrónica ${num} - APEX PRO DETAILING`,
        body: `Estimado/a ${inv.client_razon_social},\n\nAdjunto encontrará su Factura Electrónica ${num} por un total de ${formatMoney(inv.total)}.\n\nGracias por su preferencia.\n\nAPEX PRO DETAILING E.I.R.L.\nRUC: 20614041669`,
        recipients: [{ name: inv.client_razon_social, email: inv.client_email }],
        attachments: [{ filename: `Factura-${num}.pdf`, content: pdfBase64, type: 'application/pdf' }],
      })

      await supabase.from('invoices').update({ estado: 'enviada', updated_at: new Date().toISOString() }).eq('id', inv.id)
      toast.success(`Factura enviada a ${inv.client_email}`)
      loadInvoices()
    } catch (e) { toast.error(`Error al enviar: ${e.message}`) }
  }

  async function handleAnular(inv) {
    if (!confirm(`¿Anular la factura ${inv.serie}-${inv.correlativo}?`)) return
    await supabase.from('invoices').update({ estado: 'anulada', updated_at: new Date().toISOString() }).eq('id', inv.id)
    toast.success('Factura anulada')
    loadInvoices()
  }

  if (showForm) {
    return <InvoiceForm
      onClose={() => setShowForm(false)}
      onSaved={() => { setShowForm(false); loadInvoices() }}
      logoB64={logoB64}
      userId={profile?.id}
    />
  }

  if (viewing) {
    return <InvoiceDetail
      inv={viewing}
      onBack={() => setViewing(null)}
      onDownload={handleDownloadPDF}
      onWhatsApp={handleShareWhatsApp}
      onEmail={handleSendEmail}
      onAnular={handleAnular}
    />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Facturación</h1>
          <p className="text-sm text-gray-500">Este mes: {stats.count} facturas · {formatMoney(stats.total)}</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nueva factura
        </button>
      </div>

      <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 flex gap-3">
        <span className="text-lg leading-none">⚠️</span>
        <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          <p className="font-bold mb-0.5">Modo borrador — sin conexión a SUNAT</p>
          <p>
            Estos documentos <strong>no son comprobantes válidos</strong>: no se envían a SUNAT,
            no tienen XML firmado ni CDR. Sirven para preparar el detalle y cobrar, pero la factura
            real todavía debe emitirse desde Facturalá. El PDF sale marcado como borrador.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-10" placeholder="Buscar por RUC, razón social, serie o placa..."
          value={search} onChange={e => setSearch(e.target.value)} />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{search ? 'Sin resultados' : 'Aún no hay facturas'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(inv => (
            <InvoiceRow key={inv.id} inv={inv}
              onView={() => setViewing(inv)}
              onDownload={() => handleDownloadPDF(inv)}
              onWhatsApp={() => handleShareWhatsApp(inv)}
              onEmail={() => handleSendEmail(inv)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Invoice Row ─────────────────────────────────────────────────────────────
function InvoiceRow({ inv, onView, onDownload, onWhatsApp, onEmail }) {
  const num = `${inv.serie}-${String(inv.correlativo).padStart(3, '0')}`
  const estadoColor = {
    emitida: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    enviada: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    anulada: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }

  return (
    <div className="card flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow" onClick={onView}>
      <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-none">
        <FileText className="w-5 h-5 text-red-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm text-gray-900 dark:text-white">{num}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${estadoColor[inv.estado]}`}>
            {inv.estado}
          </span>
        </div>
        <p className="text-xs text-gray-500 truncate">{inv.client_razon_social}</p>
        <p className="text-[11px] text-gray-400">RUC {inv.client_ruc} · {new Date(inv.fecha + 'T12:00:00').toLocaleDateString('es-PE')}{inv.placa ? ` · ${inv.placa}` : ''}</p>
      </div>
      <div className="text-right flex-none">
        <p className="font-bold text-sm text-gray-900 dark:text-white">{formatMoney(inv.total)}</p>
        <div className="flex gap-1 mt-1" onClick={e => e.stopPropagation()}>
          <button onClick={onDownload} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" title="Descargar PDF">
            <Download className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button onClick={onWhatsApp} className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20" title="Enviar por WhatsApp">
            <MessageCircle className="w-3.5 h-3.5 text-green-500" />
          </button>
          <button onClick={onEmail} className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Enviar por email">
            <Send className="w-3.5 h-3.5 text-blue-500" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Invoice Detail ──────────────────────────────────────────────────────────
function InvoiceDetail({ inv, onBack, onDownload, onWhatsApp, onEmail, onAnular }) {
  const num = `${inv.serie}-${String(inv.correlativo).padStart(3, '0')}`
  const items = inv.items || []

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <ChevronDown className="w-4 h-4 rotate-90" /> Volver a facturas
      </button>

      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Factura {num}</h2>
            <p className="text-sm text-gray-500">{new Date(inv.fecha + 'T12:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
            inv.estado === 'emitida' ? 'bg-blue-100 text-blue-700' :
            inv.estado === 'enviada' ? 'bg-green-100 text-green-700' :
            'bg-red-100 text-red-700'
          }`}>{inv.estado}</span>
        </div>

        {/* Client info */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div><span className="text-gray-500">RUC:</span> <span className="font-semibold text-gray-900 dark:text-white">{inv.client_ruc}</span></div>
          <div><span className="text-gray-500">Razón Social:</span> <span className="font-semibold text-gray-900 dark:text-white">{inv.client_razon_social}</span></div>
          {inv.client_direccion && <div className="sm:col-span-2"><span className="text-gray-500">Dirección:</span> {inv.client_direccion}</div>}
          {inv.placa && <div><span className="text-gray-500">Placa:</span> <span className="font-semibold">{inv.placa}</span></div>}
          <div><span className="text-gray-500">Condición:</span> {inv.condicion_pago}</div>
          <div><span className="text-gray-500">Moneda:</span> {inv.moneda === 'PEN' ? 'Soles' : inv.moneda}</div>
        </div>

        {/* Items table */}
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Código</th>
                <th className="px-2 py-2 text-left">Descripción</th>
                <th className="px-2 py-2 text-center">Cant</th>
                <th className="px-2 py-2 text-right">P.U.</th>
                <th className="px-2 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-2 py-2">{i + 1}</td>
                  <td className="px-2 py-2 font-mono text-xs">{it.codigo}</td>
                  <td className="px-2 py-2">{it.descripcion}</td>
                  <td className="px-2 py-2 text-center">{it.cantidad}</td>
                  <td className="px-2 py-2 text-right">{Number(it.precio_unitario).toFixed(2)}</td>
                  <td className="px-2 py-2 text-right font-semibold">{(it.cantidad * it.precio_unitario - (it.descuento || 0)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatMoney(inv.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">IGV (18%)</span><span>{formatMoney(inv.igv)}</span></div>
            <div className="flex justify-between font-bold text-base border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
              <span>Total</span><span>{formatMoney(inv.total)}</span>
            </div>
          </div>
        </div>
        {inv.total_letras && (
          <p className="text-xs text-gray-500 mt-2 italic">Son: {inv.total_letras}</p>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button onClick={() => onDownload(inv)} className="btn-secondary flex items-center justify-center gap-2 text-sm">
          <Download className="w-4 h-4" /> PDF
        </button>
        <button onClick={() => onWhatsApp(inv)} className="flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors">
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </button>
        <button onClick={() => onEmail(inv)} className="btn-primary flex items-center justify-center gap-2 text-sm">
          <Send className="w-4 h-4" /> Email
        </button>
        {inv.estado !== 'anulada' && (
          <button onClick={() => onAnular(inv)} className="flex items-center justify-center gap-2 text-sm py-2.5 rounded-xl border-2 border-red-200 dark:border-red-900 text-red-600 font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <Trash2 className="w-4 h-4" /> Anular
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Invoice Form ────────────────────────────────────────────────────────────
function InvoiceForm({ onClose, onSaved, logoB64, userId }) {
  const [serie, setSerie] = useState('F001')
  const [correlativo, setCorrelativo] = useState('')
  const [fecha, setFecha] = useState(todayISO())
  const [condicion, setCondicion] = useState('CONTADO')
  const [placa, setPlaca] = useState('')
  const [notas, setNotas] = useState('')

  const [ruc, setRuc] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [direccion, setDireccion] = useState('')
  const [ubigeo, setUbigeo] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [lookingUp, setLookingUp] = useState(false)

  const [items, setItems] = useState([emptyItem()])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (IS_DEMO) { setCorrelativo(1); return }
    supabase.from('invoices')
      .select('correlativo')
      .eq('serie', serie)
      .order('correlativo', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setCorrelativo((data?.[0]?.correlativo || 0) + 1)
      })
  }, [serie])

  async function handleLookupRuc() {
    if (ruc.length !== 11) { toast.error('El RUC debe tener 11 dígitos'); return }
    setLookingUp(true)
    try {
      const data = await invokeFunction('consulta-ruc', { ruc })
      setRazonSocial(data.razonSocial || '')
      setDireccion(data.direccion || '')
      setUbigeo(data.ubigeo || '')
      toast.success(data.estado === 'ACTIVO' ? 'Datos encontrados' : `Datos encontrados — estado: ${data.estado}`)
    } catch (e) {
      toast.error(e.message || 'No se pudo consultar el RUC')
    }
    setLookingUp(false)
  }

  function addItem() { setItems(prev => [...prev, emptyItem()]) }

  function removeItem(idx) {
    if (items.length <= 1) return
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  const totals = useMemo(() => {
    let subtotal = 0
    items.forEach(it => {
      const precio = parseFloat(it.precio_unitario) || 0
      const cant = parseFloat(it.cantidad) || 0
      const desc = parseFloat(it.descuento) || 0
      subtotal += cant * precio - desc
    })
    const igv = +(subtotal * IGV_RATE).toFixed(2)
    const total = +(subtotal + igv).toFixed(2)
    subtotal = +subtotal.toFixed(2)
    return { subtotal, igv, total }
  }, [items])

  async function handleSave() {
    if (!ruc || ruc.length !== 11) { toast.error('Ingresa un RUC válido de 11 dígitos'); return }
    if (!razonSocial.trim()) { toast.error('Ingresa la razón social'); return }
    if (!items.some(it => it.descripcion.trim() && parseFloat(it.precio_unitario) > 0)) {
      toast.error('Agrega al menos un item con descripción y precio'); return
    }

    setSaving(true)
    try {
      const cleanItems = items
        .filter(it => it.descripcion.trim())
        .map(it => ({
          codigo: it.codigo || '',
          descripcion: it.descripcion,
          cantidad: parseFloat(it.cantidad) || 1,
          unidad: it.unidad,
          precio_unitario: parseFloat(it.precio_unitario) || 0,
          descuento: parseFloat(it.descuento) || 0,
        }))

      const payload = {
        serie,
        correlativo: Number(correlativo),
        fecha,
        client_ruc: ruc,
        client_razon_social: razonSocial.trim(),
        client_direccion: direccion.trim(),
        client_ubigeo: ubigeo.trim(),
        client_email: clientEmail.trim(),
        client_phone: clientPhone.trim(),
        placa: placa.trim().toUpperCase(),
        condicion_pago: condicion,
        moneda: 'PEN',
        items: cleanItems,
        subtotal: totals.subtotal,
        igv: totals.igv,
        total: totals.total,
        total_letras: amountToWords(totals.total),
        notas: notas.trim(),
        created_by: userId,
      }

      if (IS_DEMO) {
        const doc = generateInvoicePDF({ ...payload, id: 'demo' }, logoB64)
        doc.save(`Factura-${serie}-${String(correlativo).padStart(3, '0')}.pdf`)
        toast.success('PDF generado (modo demo)')
        onSaved()
        return
      }

      const { error } = await supabase.from('invoices').insert(payload)
      if (error) throw error
      toast.success(`Factura ${serie}-${correlativo} creada`)
      onSaved()
    } catch (e) {
      toast.error(`Error: ${e.message}`)
    }
    setSaving(false)
  }

  function handlePreviewPDF() {
    const inv = {
      serie, correlativo: Number(correlativo), fecha,
      client_ruc: ruc, client_razon_social: razonSocial, client_direccion: direccion,
      client_ubigeo: ubigeo, placa: placa.toUpperCase(), condicion_pago: condicion,
      moneda: 'PEN', items: items.filter(it => it.descripcion.trim()).map(it => ({
        ...it, cantidad: parseFloat(it.cantidad) || 1, precio_unitario: parseFloat(it.precio_unitario) || 0, descuento: parseFloat(it.descuento) || 0,
      })),
      subtotal: totals.subtotal, igv: totals.igv, total: totals.total,
      total_letras: amountToWords(totals.total),
    }
    const doc = generateInvoicePDF(inv, logoB64)
    window.open(doc.output('bloburl'), '_blank')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Nueva Factura</h1>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Serie / Correlativo / Fecha */}
      <div className="card">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Datos generales</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Serie</label>
            <input className="input" value={serie} onChange={e => setSerie(e.target.value.toUpperCase())} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Correlativo</label>
            <input className="input" type="number" value={correlativo} onChange={e => setCorrelativo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Fecha</label>
            <input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Condición de pago</label>
            <select className="input" value={condicion} onChange={e => setCondicion(e.target.value)}>
              {CONDICIONES_PAGO.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Cliente */}
      <div className="card">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Datos del cliente</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">RUC</label>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="20100284937" maxLength={11}
                value={ruc} onChange={e => setRuc(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleLookupRuc() } }} />
              <button onClick={handleLookupRuc} disabled={lookingUp || ruc.length !== 11}
                title="Buscar datos en SUNAT"
                className="px-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-colors flex-none flex items-center">
                {lookingUp
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Search className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Razón Social</label>
            <input className="input" placeholder="EMPRESA S.A.C." value={razonSocial} onChange={e => setRazonSocial(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Dirección</label>
            <input className="input" placeholder="Av. Ejemplo 123" value={direccion} onChange={e => setDireccion(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Ubigeo</label>
            <input className="input" placeholder="Lima - Lima - Miraflores" value={ubigeo} onChange={e => setUbigeo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Placa del vehículo</label>
            <input className="input uppercase" placeholder="ABC-123" value={placa} onChange={e => setPlaca(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Email del cliente</label>
            <input className="input" type="email" placeholder="cliente@empresa.com" value={clientEmail} onChange={e => setClientEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Teléfono (WhatsApp)</label>
            <input className="input" placeholder="51999999999" value={clientPhone} onChange={e => setClientPhone(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Detalles / Items</p>
          <button onClick={addItem} className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700">
            <Plus className="w-3.5 h-3.5" /> Agregar item
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
              <div className="col-span-4 sm:col-span-2">
                <label className="text-[10px] text-gray-500 block">Código</label>
                <input className="input py-1.5 text-sm" placeholder="COD001"
                  value={item.codigo} onChange={e => updateItem(idx, 'codigo', e.target.value)} />
              </div>
              <div className="col-span-8 sm:col-span-4">
                <label className="text-[10px] text-gray-500 block">Descripción</label>
                <input className="input py-1.5 text-sm" placeholder="LAVADO DE AUTO"
                  value={item.descripcion} onChange={e => updateItem(idx, 'descripcion', e.target.value)} />
              </div>
              <div className="col-span-3 sm:col-span-1">
                <label className="text-[10px] text-gray-500 block">Cant</label>
                <input className="input py-1.5 text-sm text-center" type="number" min="1" step="1"
                  value={item.cantidad} onChange={e => updateItem(idx, 'cantidad', e.target.value)} />
              </div>
              <div className="col-span-3 sm:col-span-1">
                <label className="text-[10px] text-gray-500 block">Und</label>
                <select className="input py-1.5 text-sm" value={item.unidad} onChange={e => updateItem(idx, 'unidad', e.target.value)}>
                  {UNIDADES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <div className="col-span-3 sm:col-span-2">
                <label className="text-[10px] text-gray-500 block">Precio Unit.</label>
                <input className="input py-1.5 text-sm text-right" type="number" min="0" step="0.01" placeholder="0.00"
                  value={item.precio_unitario} onChange={e => updateItem(idx, 'precio_unitario', e.target.value)} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] text-gray-500 block">Desc.</label>
                <input className="input py-1.5 text-sm text-right" type="number" min="0" step="0.01" placeholder="0"
                  value={item.descuento} onChange={e => updateItem(idx, 'descuento', e.target.value)} />
              </div>
              <div className="col-span-1 flex items-end justify-center pb-1">
                {items.length > 1 && (
                  <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="flex justify-end mt-4">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Op. Gravadas</span><span className="font-semibold text-gray-900 dark:text-white">{formatMoney(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>IGV (18%)</span><span className="font-semibold text-gray-900 dark:text-white">{formatMoney(totals.igv)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-gray-200 dark:border-gray-700 pt-2 mt-1 text-gray-900 dark:text-white">
              <span>TOTAL</span><span>{formatMoney(totals.total)}</span>
            </div>
            <p className="text-[10px] text-gray-400 italic">{amountToWords(totals.total)}</p>
          </div>
        </div>
      </div>

      {/* Notas */}
      <div className="card">
        <label className="text-xs text-gray-500 mb-1 block">Observaciones (opcional)</label>
        <textarea className="input resize-none" rows={2} placeholder="Notas internas..."
          value={notas} onChange={e => setNotas(e.target.value)} />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={handlePreviewPDF} className="btn-secondary flex items-center gap-2 flex-1">
          <Eye className="w-4 h-4" /> Vista previa PDF
        </button>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 flex-1">
          <FileText className="w-4 h-4" /> {saving ? 'Guardando...' : 'Emitir factura'}
        </button>
      </div>
    </div>
  )
}
