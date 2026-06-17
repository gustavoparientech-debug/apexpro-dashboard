import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-3 safe-bottom">
      <div className="bg-red-600 rounded-2xl shadow-2xl p-4 flex items-center gap-3 max-w-lg mx-auto">
        <div className="flex-1">
          <p className="text-white font-bold text-base leading-tight">🆕 Nueva versión disponible</p>
          <p className="text-red-100 text-sm mt-0.5">Toca el botón para ver los últimos cambios</p>
        </div>
        <button
          onClick={() => updateServiceWorker(true)}
          className="bg-white text-red-600 font-black text-sm px-4 py-2.5 rounded-xl shrink-0 active:scale-95 transition-transform shadow">
          Actualizar
        </button>
      </div>
    </div>
  )
}
