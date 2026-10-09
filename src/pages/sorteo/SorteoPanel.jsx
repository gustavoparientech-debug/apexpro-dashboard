import { useEffect, useState } from 'react'
import { Ticket, ClipboardList, Settings, ExternalLink } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { fetchConfig, DEFAULT_CONFIG } from '../../lib/sorteo'
import PanelVender from '../../components/sorteo/PanelVender'
import PanelPedidos from '../../components/sorteo/PanelPedidos'
import PanelConfig from '../../components/sorteo/PanelConfig'

// Panel interno del sorteo. Trabajadores: vender y ver sus ventas.
// Administradores: además aprueban pedidos y editan la configuración.
export default function SorteoPanel() {
  const { isAdmin, isDemo } = useAuth()
  const admin = isAdmin || isDemo
  const [tab,    setTab]    = useState('vender')
  const [config, setConfig] = useState(DEFAULT_CONFIG)

  useEffect(() => { fetchConfig().then(setConfig).catch(() => {}) }, [])

  const tabs = [
    ['vender',  'Vender',                  Ticket],
    ['pedidos', admin ? 'Pedidos' : 'Mis ventas', ClipboardList],
    ...(admin ? [['config', 'Configuración', Settings]] : []),
  ]

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{config.titulo}</h1>
          <p className="text-sm text-gray-500">
            {config.estado === 'abierto' ? 'Venta abierta' : 'Venta cerrada'} · S/{Number(config.precio_ticket)} por ticket
          </p>
        </div>
        <a href="/sorteo" target="_blank" rel="noreferrer" className="btn-secondary text-sm flex items-center gap-1.5 shrink-0">
          <ExternalLink className="w-4 h-4" /> Página pública
        </a>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit max-w-full overflow-x-auto">
        {tabs.map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === k ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'vender'  && <PanelVender config={config} admin={admin} />}
      {tab === 'pedidos' && <PanelPedidos config={config} admin={admin} />}
      {tab === 'config'  && admin && <PanelConfig config={config} onSaved={setConfig} />}
    </div>
  )
}
