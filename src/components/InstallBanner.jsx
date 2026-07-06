import { useState, useEffect } from 'react'
import { X, Download, Share } from 'lucide-react'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showIOS, setShowIOS] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isInStandaloneMode()) return // ya instalada
    if (sessionStorage.getItem('install-dismissed')) return
    if (isIOS()) {
      setTimeout(() => setShowIOS(true), 2000)
      return
    }
    const handler = e => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    sessionStorage.setItem('install-dismissed', '1')
    setDeferredPrompt(null)
    setShowIOS(false)
    setDismissed(true)
  }

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') dismiss()
    else setDeferredPrompt(null)
  }

  if (dismissed) return null

  // Android / Chrome: banner con botón instalar
  if (deferredPrompt) return (
    <div className="fixed bottom-16 lg:bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-gray-900 dark:bg-gray-800 rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 border border-white/10">
        <img src="/icon-192.png" alt="" className="w-10 h-10 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold leading-tight">Instalar Apex Pro</p>
          <p className="text-gray-400 text-xs">Acceso rápido desde tu pantalla de inicio</p>
        </div>
        <button onClick={install}
          className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shrink-0">
          <Download className="w-3.5 h-3.5" /> Instalar
        </button>
        <button onClick={dismiss} className="text-gray-500 hover:text-gray-300 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )

  // iOS: instrucciones para "Añadir a pantalla de inicio"
  if (showIOS) return (
    <div className="fixed bottom-16 lg:bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-gray-900 dark:bg-gray-800 rounded-2xl shadow-2xl px-4 py-3 border border-white/10">
        <div className="flex items-start gap-3">
          <img src="/icon-192.png" alt="" className="w-10 h-10 rounded-xl shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-bold">Instalar Apex Pro</p>
            <p className="text-gray-400 text-xs mt-0.5 leading-snug">
              Toca <Share className="w-3 h-3 inline mx-0.5 text-blue-400" /> (compartir) y luego
              <strong className="text-white"> "Añadir a pantalla de inicio"</strong>
            </p>
          </div>
          <button onClick={dismiss} className="text-gray-500 hover:text-gray-300 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return null
}
