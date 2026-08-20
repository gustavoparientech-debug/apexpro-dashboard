import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import jsPDF from 'jspdf'
import toast from 'react-hot-toast'
import {
  Stethoscope, Sparkles, FileText, Loader2, AlertTriangle, X, Wrench, ClipboardList,
} from 'lucide-react'

// ─── Informe de diagnóstico ──────────────────────────────────────────────────
// El técnico escribe lo que vio en palabras sueltas ("rayón capot, óxido en
// guardafango, pintura opaca") y la IA arma el informe: hallazgos por zona,
// trabajos recomendados, proceso y cuidados. Después se imprime con membrete
// para entregárselo al cliente o al técnico que hará el trabajo.

const SERVICIOS = [
  { id: 'planchado',  label: 'Planchado y pintura', emoji: '🔨' },
  { id: 'ppf',        label: 'PPF completo',        emoji: '🛡️' },
  { id: 'ceramico',   label: 'Cerámico',            emoji: '💎' },
  { id: 'detailing',  label: 'Detailing premium',   emoji: '✨' },
  { id: 'polarizado', label: 'Polarizado',          emoji: '🪟' },
  { id: 'general',    label: 'Revisión general',    emoji: '🔍' },
]

const EJEMPLOS = [
  'rayón profundo en capot, óxido en guardafango izquierdo, pintura opaca',
  'cliente quiere cerámico, pintura con marcas de lavado, faros opacos',
  'PPF full body, auto nuevo, dos rayones leves en parachoque',
]

const SEVERIDAD_COLOR = {
  Leve:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Moderado: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Severo:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}
const PRIORIDAD_COLOR = {
  Alta:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  Media: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Baja:  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
}

export default function Diagnostico() {
  const { tickets } = useApp()
  const [form, setForm] = useState({
    servicio: 'planchado', placa: '', marca: '', modelo: '', anio: '', color: '',
    cliente: '', palabras: '', observaciones: '',
  })
  const [informe, setInforme]   = useState(null)
  const [cargando, setCargando] = useState(false)
  const [errorIA, setErrorIA]   = useState(null)
  const [logoB64, setLogoB64]   = useState(null)

  // El logo del membrete se carga una vez y se guarda en base64 para el PDF.
  useEffect(() => {
    fetch('/logo-cuadrado-claro.jpg')
      .then(r => r.blob())
      .then(b => {
        const reader = new FileReader()
        reader.onloadend = () => setLogoB64(reader.result)
        reader.readAsDataURL(b)
      })
      .catch(() => {})
  }, [])

  // Al escribir una placa que ya pasó por el taller se completan sus datos.
  function autocompletarPlaca(placa) {
    const limpia = placa.toUpperCase().replace(/[^A-Z0-9]/g, '')
    setForm(f => ({ ...f, placa: placa.toUpperCase() }))
    if (limpia.length < 6) return
    const t = (tickets || []).find(x => (x.plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '') === limpia)
    if (t?.client_name) setForm(f => ({ ...f, cliente: f.cliente || t.client_name }))
  }

  const vehiculoTexto = [form.marca, form.modelo, form.anio, form.color].filter(Boolean).join(' ')
  const servicioLabel = SERVICIOS.find(s => s.id === form.servicio)?.label || form.servicio

  async function generar() {
    if (!form.palabras.trim()) { toast.error('Escribe qué viste en el vehículo'); return }
    setCargando(true)
    setInforme(null)
    setErrorIA(null)
    try {
      const { data, error } = await supabase.functions.invoke('ai-diagnostico', {
        body: {
          servicio: servicioLabel,
          palabras: form.palabras,
          vehiculo: [form.placa, vehiculoTexto].filter(Boolean).join(' · '),
          observaciones: form.observaciones,
        },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setInforme(data.informe)
      toast.success('Informe generado ✓')
    } catch (err) {
      // El mensaje del servidor dice qué pasó (sin saldo, clave inválida…): se
      // muestra en pantalla, no solo en un toast que se va.
      let msg = err?.message || 'No se pudo generar el informe'
      try {
        const cuerpo = await err?.context?.json?.()
        if (cuerpo?.error) msg = cuerpo.error
      } catch { /* el error no traía cuerpo */ }
      setErrorIA(msg)
      toast.error('No se pudo generar el informe')
    } finally { setCargando(false) }
  }

  // Sin IA disponible, el informe se arma con lo escrito: cada palabra clave
  // pasa a ser un hallazgo y el taller completa el resto a mano antes de
  // imprimir. Así la página sigue sirviendo aunque la IA no responda.
  function borradorSinIA() {
    const partes = form.palabras.split(/[,;\n]+/).map(p => p.trim()).filter(Boolean)
    setInforme({
      resumen: `Revisión para ${servicioLabel.toLowerCase()}. ${form.palabras}`.trim(),
      estado_general: 'Regular',
      hallazgos: partes.map(p => ({ zona: p, detalle: 'A confirmar en taller', severidad: 'Moderado' })),
      trabajos: [],
      proceso: [],
      materiales: [],
      tiempo_estimado: '',
      cuidados: [],
      nota_tecnico: 'Informe armado sin IA a partir de las notas: completar antes de entregarlo.',
    })
    setErrorIA(null)
    toast('Borrador armado con tus notas', { icon: '📝' })
  }

  // ── PDF con membrete ──────────────────────────────────────────────────────
  function descargarPDF() {
    if (!informe) return
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const W = 210, H = 297, mL = 14, mR = 14
    const cW = W - mL - mR
    const hoy = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    let y = 0

    const nuevaPaginaSiHaceFalta = (alto = 10) => {
      if (y + alto > H - 20) { doc.addPage(); y = 20 }
    }

    // Membrete
    if (logoB64) {
      doc.addImage(logoB64, 'JPEG', mL, 2, 46, 46)
    } else {
      doc.setTextColor(0, 0, 0); doc.setFontSize(14); doc.setFont('helvetica', 'bold')
      doc.text('APEX-PRO', mL, 18)
      doc.setTextColor(185, 28, 28); doc.setFontSize(9)
      doc.text('DETAILING', mL, 25)
    }
    doc.setTextColor(40, 40, 40); doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    doc.text('Calle Idelfonzo Lopez N 700 Zamacola', mL, 51)
    doc.text('Arequipa - Cerro Colorado', mL, 55)
    doc.text('Tel: 959240309  ·  Apexprodetailing0@gmail.com', mL, 59)

    doc.setTextColor(0, 0, 0); doc.setFontSize(17); doc.setFont('helvetica', 'bold')
    doc.text('INFORME DE DIAGNÓSTICO', W / 2, 26, { align: 'center' })
    doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    doc.setTextColor(90, 90, 90)
    doc.text(servicioLabel, W / 2, 32, { align: 'center' })

    // Recuadro fecha
    const tX = W - mR - 52, tY = 40, tW = 52, rH = 8
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.4)
    doc.rect(tX, tY, tW, rH)
    doc.setTextColor(0, 0, 0); doc.setFontSize(8)
    doc.text('Fecha:', tX + 4, tY + 5.5)
    doc.setFont('helvetica', 'bold')
    doc.text(hoy, tX + tW - 4, tY + 5.5, { align: 'right' })
    doc.setFont('helvetica', 'normal')

    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.5)
    doc.line(mL, 63, W - mR, 63)
    y = 70

    const tituloSeccion = (texto) => {
      nuevaPaginaSiHaceFalta(14)
      doc.setFillColor(30, 30, 30)
      doc.rect(mL, y, cW, 6.5, 'F')
      doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
      doc.text(texto.toUpperCase(), mL + 3, y + 4.6)
      doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal')
      y += 10
    }

    const parrafo = (texto, size = 9) => {
      doc.setFontSize(size)
      const lineas = doc.splitTextToSize(String(texto || ''), cW)
      lineas.forEach(l => {
        nuevaPaginaSiHaceFalta(6)
        doc.text(l, mL, y)
        y += size * 0.5 + 0.8
      })
      y += 2
    }

    // Datos del vehículo
    tituloSeccion('Datos del vehículo')
    doc.setFontSize(9)
    const datos = [
      ['Placa', form.placa || '—'],
      ['Vehículo', vehiculoTexto || '—'],
      ['Cliente', form.cliente || '—'],
      ['Servicio evaluado', servicioLabel],
      ['Estado general', informe.estado_general || '—'],
    ]
    datos.forEach(([k, v]) => {
      nuevaPaginaSiHaceFalta(7)
      doc.setFont('helvetica', 'bold'); doc.text(`${k}:`, mL, y)
      doc.setFont('helvetica', 'normal'); doc.text(String(v), mL + 38, y)
      y += 5.5
    })
    y += 3

    tituloSeccion('Resumen del diagnóstico')
    parrafo(informe.resumen)

    if (informe.hallazgos?.length) {
      tituloSeccion('Hallazgos')
      informe.hallazgos.forEach(h => {
        nuevaPaginaSiHaceFalta(10)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
        doc.text(`• ${h.zona || 'Zona'}`, mL, y)
        doc.setFont('helvetica', 'normal')
        doc.text(`[${h.severidad || '—'}]`, W - mR, y, { align: 'right' })
        y += 4.5
        doc.setFontSize(8.5)
        doc.splitTextToSize(String(h.detalle || ''), cW - 6).forEach(l => {
          nuevaPaginaSiHaceFalta(5)
          doc.text(l, mL + 4, y); y += 4
        })
        y += 1.5
      })
      y += 2
    }

    if (informe.trabajos?.length) {
      tituloSeccion('Trabajos recomendados')
      informe.trabajos.forEach((t, i) => {
        nuevaPaginaSiHaceFalta(10)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
        doc.text(`${i + 1}. ${t.nombre || ''}`, mL, y)
        doc.setFont('helvetica', 'normal')
        doc.text(`Prioridad ${t.prioridad || '—'}`, W - mR, y, { align: 'right' })
        y += 4.5
        doc.setFontSize(8.5)
        doc.splitTextToSize(String(t.detalle || ''), cW - 6).forEach(l => {
          nuevaPaginaSiHaceFalta(5)
          doc.text(l, mL + 4, y); y += 4
        })
        y += 1.5
      })
      y += 2
    }

    const lista = (titulo, items) => {
      if (!items?.length) return
      tituloSeccion(titulo)
      doc.setFontSize(8.5)
      items.forEach(it => {
        doc.splitTextToSize(`• ${it}`, cW).forEach(l => {
          nuevaPaginaSiHaceFalta(5)
          doc.text(l, mL, y); y += 4.2
        })
      })
      y += 3
    }

    lista('Proceso de trabajo', informe.proceso)
    lista('Materiales previstos', informe.materiales)

    if (informe.tiempo_estimado) {
      tituloSeccion('Tiempo estimado')
      parrafo(informe.tiempo_estimado)
    }

    lista('Cuidados posteriores', informe.cuidados)

    if (informe.nota_tecnico) {
      tituloSeccion('Nota para el técnico')
      parrafo(informe.nota_tecnico, 8.5)
    }

    // Firmas
    nuevaPaginaSiHaceFalta(30)
    y += 8
    doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.3)
    doc.line(mL, y, mL + 60, y)
    doc.line(W - mR - 60, y, W - mR, y)
    doc.setFontSize(7.5); doc.setTextColor(90, 90, 90)
    doc.text('Responsable del taller', mL, y + 4)
    doc.text('Conformidad del cliente', W - mR - 60, y + 4)

    // Pie
    doc.setFontSize(6.5); doc.setTextColor(150, 150, 150)
    doc.text('Informe técnico referencial. El alcance final se confirma con el vehículo en taller.', W / 2, H - 10, { align: 'center' })

    doc.save(`diagnostico-${(form.placa || 'vehiculo').replace(/[^A-Za-z0-9]/g, '')}-${hoy.replace(/\//g, '-')}.pdf`)
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-red-500" /> Diagnóstico del vehículo
        </h2>
        <p className="text-sm text-gray-500">
          Escribe lo que viste en palabras sueltas y se arma el informe para imprimir
        </p>
      </div>

      {/* Datos y palabras clave */}
      <div className="card space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">Servicio</p>
          <div className="flex flex-wrap gap-1.5">
            {SERVICIOS.map(s => (
              <button key={s.id} type="button" onClick={() => setForm(f => ({ ...f, servicio: s.id }))}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                  form.servicio === s.id
                    ? 'border-red-500 bg-red-600 text-white'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                }`}>
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <input className="input uppercase font-mono" placeholder="Placa" maxLength={8}
            value={form.placa} onChange={e => autocompletarPlaca(e.target.value)} />
          <input className="input" placeholder="Cliente"
            value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} />
          <input className="input" placeholder="Marca"
            value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} />
          <input className="input" placeholder="Modelo"
            value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} />
          <input className="input" placeholder="Año"
            value={form.anio} onChange={e => setForm(f => ({ ...f, anio: e.target.value }))} />
          <input className="input" placeholder="Color"
            value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">
            Qué viste en el vehículo
          </p>
          <textarea className="input w-full resize-none" rows={3}
            placeholder="rayón profundo en capot, óxido en guardafango izquierdo, pintura opaca…"
            value={form.palabras}
            onChange={e => setForm(f => ({ ...f, palabras: e.target.value }))} />
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {EJEMPLOS.map((ej, i) => (
              <button key={i} type="button" onClick={() => setForm(f => ({ ...f, palabras: ej }))}
                className="text-[11px] px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                {ej.slice(0, 38)}…
              </button>
            ))}
          </div>
        </div>

        <input className="input w-full" placeholder="Observaciones del cliente (opcional)"
          value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />

        <button onClick={generar} disabled={cargando}
          className="w-full py-3 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {cargando ? <><Loader2 className="w-4 h-4 animate-spin" /> Analizando…</> : <><Sparkles className="w-4 h-4" /> Generar informe</>}
        </button>
      </div>

      {errorIA && (
        <div className="card border border-red-200 dark:border-red-800 bg-red-50/70 dark:bg-red-900/15">
          <p className="text-sm font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> No se pudo generar con IA
          </p>
          <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-1 leading-snug">{errorIA}</p>
          <button onClick={borradorSinIA}
            className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 text-red-600">
            Armar borrador con mis notas
          </button>
        </div>
      )}

      {/* Informe */}
      {informe && (
        <div className="card space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Informe de diagnóstico</p>
              <p className="text-xs text-gray-400">
                {[form.placa, vehiculoTexto].filter(Boolean).join(' · ') || 'Sin datos del vehículo'} · {servicioLabel}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-none">
              <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                informe.estado_general === 'Bueno' ? SEVERIDAD_COLOR.Leve
                : informe.estado_general === 'Malo' ? SEVERIDAD_COLOR.Severo
                : SEVERIDAD_COLOR.Moderado
              }`}>
                {informe.estado_general || '—'}
              </span>
              <button onClick={() => setInforme(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{informe.resumen}</p>

          {informe.hallazgos?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Hallazgos
              </p>
              <div className="space-y-1.5">
                {informe.hallazgos.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{h.zona}</p>
                      <p className="text-xs text-gray-500 leading-snug">{h.detalle}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-none ${SEVERIDAD_COLOR[h.severidad] || SEVERIDAD_COLOR.Moderado}`}>
                      {h.severidad}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {informe.trabajos?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" /> Trabajos recomendados
              </p>
              <div className="space-y-1.5">
                {informe.trabajos.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                    <span className="w-5 h-5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 text-[11px] font-black flex items-center justify-center flex-none">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t.nombre}</p>
                      <p className="text-xs text-gray-500 leading-snug">{t.detalle}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-none ${PRIORIDAD_COLOR[t.prioridad] || PRIORIDAD_COLOR.Media}`}>
                      {t.prioridad}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {informe.proceso?.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">Proceso</p>
                <ol className="space-y-1 list-decimal list-inside">
                  {informe.proceso.map((p, i) => (
                    <li key={i} className="text-xs text-gray-600 dark:text-gray-300 leading-snug">{p}</li>
                  ))}
                </ol>
              </div>
            )}
            {informe.materiales?.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">Materiales</p>
                <ul className="space-y-1">
                  {informe.materiales.map((m, i) => (
                    <li key={i} className="text-xs text-gray-600 dark:text-gray-300 leading-snug">· {m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {informe.tiempo_estimado && (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
              <span className="text-xs text-gray-500">Tiempo estimado: </span>
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{informe.tiempo_estimado}</span>
            </div>
          )}

          {informe.cuidados?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">Cuidados posteriores</p>
              <ul className="space-y-1">
                {informe.cuidados.map((c, i) => (
                  <li key={i} className="text-xs text-gray-600 dark:text-gray-300 leading-snug">· {c}</li>
                ))}
              </ul>
            </div>
          )}

          {informe.nota_tecnico && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/15 px-3 py-2">
              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 mb-0.5">
                <ClipboardList className="w-3.5 h-3.5" /> Nota para el técnico
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-200 leading-snug">{informe.nota_tecnico}</p>
            </div>
          )}

          <button onClick={descargarPDF}
            className="w-full py-3 rounded-2xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
            <FileText className="w-4 h-4" /> Descargar PDF con membrete
          </button>
          <p className="text-[11px] text-gray-400 text-center -mt-2">
            El informe lo redacta una IA con lo que escribiste: revísalo antes de entregarlo.
          </p>
        </div>
      )}
    </div>
  )
}
