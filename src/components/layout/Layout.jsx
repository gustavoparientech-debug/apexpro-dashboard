import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import {
  LayoutDashboard, ClipboardList, Users, Wallet, TrendingUp,
  Settings, History, Sun, Moon, Menu, X, ChevronRight
} from 'lucide-react'
import { cn } from '../../lib/utils'

const NAV_ITEMS = [
  { to: '/', label: 'Panel', icon: LayoutDashboard },
  { to: '/registro', label: 'Registro', icon: ClipboardList },
  { to: '/trabajadores', label: 'Equipo', icon: Users },
  { to: '/nomina', label: 'Nómina', icon: Wallet },
  { to: '/mix', label: 'Mix', icon: TrendingUp },
  { to: '/configuracion', label: 'Config', icon: Settings },
  { to: '/historial', label: 'Historial', icon: History },
]

function NavItem({ item, collapsed, onClick }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      end={item.to === '/'}
      className={({ isActive }) => cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium group',
        isActive
          ? 'bg-orange-500 text-white shadow-sm shadow-orange-200 dark:shadow-orange-900/30'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  )
}

export default function Layout({ children }) {
  const { dark, toggle } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  const currentPage = NAV_ITEMS.find(i => {
    if (i.to === '/') return location.pathname === '/'
    return location.pathname.startsWith(i.to)
  })

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      {/* Sidebar desktop */}
      <aside className={cn(
        'hidden lg:flex flex-col border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-sm">A</div>
              <span className="font-bold text-gray-900 dark:text-white">Apex Pro</span>
            </div>
          )}
          {collapsed && <div className="mx-auto w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-sm">A</div>}
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
        {collapsed && (
          <button onClick={() => setCollapsed(false)} className="flex justify-center py-2 hover:bg-gray-100 dark:hover:bg-gray-800">
            <Menu className="w-4 h-4 text-gray-400" />
          </button>
        )}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <NavItem key={item.to} item={item} collapsed={collapsed} />
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={toggle}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium',
              'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            {dark ? <Sun className="w-5 h-5 flex-shrink-0" /> : <Moon className="w-5 h-5 flex-shrink-0" />}
            {!collapsed && <span>{dark ? 'Modo claro' : 'Modo oscuro'}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 h-full bg-white dark:bg-gray-900 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-sm">A</div>
                <span className="font-bold text-gray-900 dark:text-white">Apex Pro</span>
              </div>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map(item => (
                <NavItem key={item.to} item={item} collapsed={false} onClick={() => setSidebarOpen(false)} />
              ))}
            </nav>
            <div className="p-3 border-t border-gray-100 dark:border-gray-800">
              <button onClick={toggle} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                <span>{dark ? 'Modo claro' : 'Modo oscuro'}</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header móvil */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center text-white font-bold text-xs">A</div>
            <span className="font-bold text-gray-900 dark:text-white">Apex Pro</span>
          </div>
          <span className="text-sm text-gray-500">{currentPage?.label}</span>
          <button onClick={toggle} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            {dark ? <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" /> : <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />}
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto pb-20 lg:pb-6">
          {children}
        </main>

        {/* Bottom nav móvil */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex">
          {NAV_ITEMS.slice(0, 5).map(item => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => cn(
                  'flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors',
                  isActive ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
