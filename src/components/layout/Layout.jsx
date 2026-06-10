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

function LogoFull() {
  return (
    <div className="flex items-center gap-2">
      <img src="/logo.jpg" alt="Apex Pro Detailing" className="w-8 h-8 rounded-md object-cover" />
      <div className="leading-tight">
        <div className="text-white font-black text-sm tracking-wide">APEX-PRO</div>
        <div className="text-red-500 font-bold text-[9px] tracking-widest uppercase">Detailing</div>
      </div>
    </div>
  )
}

function LogoIcon() {
  return (
    <img src="/logo.jpg" alt="Apex Pro" className="w-8 h-8 rounded-md object-cover mx-auto" />
  )
}

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
          ? 'bg-red-600 text-white shadow-sm'
          : 'text-gray-300 hover:bg-white/10 hover:text-white'
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
        'hidden lg:flex flex-col transition-all duration-200',
        'bg-[#1e1e1e]',
        collapsed ? 'w-16' : 'w-56'
      )}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          {!collapsed && <LogoFull />}
          {collapsed && <LogoIcon />}
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} className="p-1 rounded hover:bg-white/10 ml-2">
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
        {collapsed && (
          <button onClick={() => setCollapsed(false)} className="flex justify-center py-2 hover:bg-white/10">
            <Menu className="w-4 h-4 text-gray-400" />
          </button>
        )}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <NavItem key={item.to} item={item} collapsed={collapsed} />
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button
            onClick={toggle}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium',
              'text-gray-400 hover:bg-white/10 hover:text-white'
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
          <aside className="relative w-64 h-full bg-[#1e1e1e] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <LogoFull />
              <button onClick={() => setSidebarOpen(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map(item => (
                <NavItem key={item.to} item={item} collapsed={false} onClick={() => setSidebarOpen(false)} />
              ))}
            </nav>
            <div className="p-3 border-t border-white/10">
              <button onClick={toggle} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium text-gray-400 hover:bg-white/10 hover:text-white">
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
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-[#1e1e1e] sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-white/10">
            <Menu className="w-5 h-5 text-gray-300" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <img src="/logo.jpg" alt="Apex Pro" className="w-7 h-7 rounded-md object-cover" />
            <div className="leading-tight">
              <div className="text-white font-black text-xs tracking-wide">APEX-PRO</div>
              <div className="text-red-500 font-bold text-[8px] tracking-widest uppercase">Detailing</div>
            </div>
          </div>
          <span className="text-xs text-gray-400">{currentPage?.label}</span>
          <button onClick={toggle} className="p-1.5 rounded-lg hover:bg-white/10">
            {dark ? <Sun className="w-5 h-5 text-gray-400" /> : <Moon className="w-5 h-5 text-gray-400" />}
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto pb-20 lg:pb-6">
          {children}
        </main>

        {/* Bottom nav móvil */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#1e1e1e] border-t border-white/10 flex">
          {NAV_ITEMS.slice(0, 5).map(item => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => cn(
                  'flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors',
                  isActive ? 'text-red-500' : 'text-gray-500'
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
