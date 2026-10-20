import { PauseCircle } from 'lucide-react'
import { setSorteoPausado } from '../../hooks/useSorteoPausado'
import toast from 'react-hot-toast'

// Lo que se ve en cualquier página del sorteo mientras está en pausa. El
// admin, dentro de la app, puede reactivarlo desde aquí.
export default function SorteoPausado({ dentroDeLaApp = false, puedeReactivar = false }) {

  async function reactivar() {
    try { await setSorteoPausado(false); toast.success('Sorteo reactivado') }
    catch (e) { toast.error(`No se pudo reactivar: ${e.message || e}`) }
  }

  return (
    <div className={dentroDeLaApp ? 'max-w-md mx-auto pt-10 px-4' : 'min-h-screen flex items-center justify-center bg-black px-6'}>
      <div className={`w-full max-w-md text-center rounded-3xl p-8 ${dentroDeLaApp ? 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800' : 'bg-[#141414] border border-white/10'}`}>
        <PauseCircle className={`w-12 h-12 mx-auto mb-4 ${dentroDeLaApp ? 'text-gray-400' : 'text-red-500'}`} />
        <h1 className={`text-xl font-black ${dentroDeLaApp ? 'text-gray-900 dark:text-white' : 'text-white'}`}>Sorteo en pausa</h1>
        <p className={`text-sm mt-2 ${dentroDeLaApp ? 'text-gray-500' : 'text-gray-400'}`}>
          {dentroDeLaApp
            ? 'El sorteo está oculto para todos. Los tickets, pedidos y la configuración se conservan tal cual.'
            : 'Por ahora el sorteo de Apex Pro Detailing no está disponible. Vuelve pronto.'}
        </p>
        {dentroDeLaApp && puedeReactivar && (
          <button onClick={reactivar}
            className="mt-6 w-full py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold">
            Reactivar sorteo
          </button>
        )}
      </div>
    </div>
  )
}
