import { useState } from 'react'
import { NavLink, useLocation, Navigate, useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import {
  LayoutDashboard, ClipboardList, Users, Wallet, TrendingUp,
  Settings, History, Sun, Moon, Menu, X, ChevronRight, UserCog, LogOut,
  Plus, TrendingDown
} from 'lucide-react'
import { cn, todayISO } from '../../lib/utils'
import toast from 'react-hot-toast'

const GASTO_CATS = [
  { value: 'insumos',      label: '🧴 Insumos' },
  { value: 'herramientas', label: '🔧 Herramientas' },
  { value: 'transporte',   label: '🚌 Transporte' },
  { value: 'comida',       label: '🍱 Comida' },
  { value: 'otro',         label: '📦 Otro' },
]

function GastoSheet({ onClose }) {
  const { addExpense, workers } = useApp()
  const [form, setForm] = useState({ date: todayISO(), amount: '', category: '', notes: '', worker_id: '' })
  const [busy, setBusy] = useState(false)
  async function handleSave() {
    if (!form.amount) { toast.error('Ingresa el monto'); return }
    setBusy(true)
    try {
      await addExpense({ ...form, amount: parseFloat(form.amount) })
      toast.success('Gasto registrado')
      onClose()
    } catch { toast.error('Error al guardar') }
    finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl p-5 space-y-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Registrar gasto</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        <input type="number" className="input" placeholder="Monto S/" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        <div className="grid grid-cols-3 gap-2">
          {GASTO_CATS.map(c => (
            <button key={c.value} type="button" onClick={() => setForm(f => ({ ...f, category: c.value }))}
              className={`py-2 px-2 rounded-xl border text-xs font-medium transition-all ${form.category === c.value ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
              {c.label}
            </button>
          ))}
        </div>
        <select className="input" value={form.worker_id} onChange={e => setForm(f => ({ ...f, worker_id: e.target.value }))}>
          <option value="">Trabajador (opcional)</option>
          {workers.filter(w => w.active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <input className="input" placeholder="Notas (opcional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        <button onClick={handleSave} disabled={busy}
          className="w-full py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all active:scale-95">
          {busy ? 'Guardando…' : 'Registrar gasto'}
        </button>
      </div>
    </div>
  )
}

function GlobalFab({ canAdmin }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showGasto, setShowGasto] = useState(false)

  function handleNewTicket() {
    navigate('/registro', { state: { autoNew: true } })
    setOpen(false)
  }

  // Si solo es trabajador, el botón va directo a nuevo ticket sin menú
  if (!canAdmin) {
    return (
      <button onClick={handleNewTicket}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 shadow-xl flex items-center justify-center transition-all duration-200">
        <Plus className="w-6 h-6 text-white" />
      </button>
    )
  }

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30" onClick={() => setOpen(false)} />}
      <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 flex flex-col items-end gap-2">
        {open && (
          <>
            <button onClick={() => { setOpen(false); setShowGasto(true) }}
              className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition-all whitespace-nowrap">
              <TrendingDown className="w-4 h-4 text-amber-500" /> Registrar gasto
            </button>
            <button onClick={handleNewTicket}
              className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 transition-all whitespace-nowrap">
              <ClipboardList className="w-4 h-4 text-red-600" /> Nuevo ticket
            </button>
          </>
        )}
        <button onClick={() => setOpen(v => !v)}
          className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 ${open ? 'bg-gray-700' : 'bg-red-600 hover:bg-red-700'}`}>
          {open ? <X className="w-6 h-6 text-white" /> : <Plus className="w-6 h-6 text-white" />}
        </button>
      </div>
      {showGasto && <GastoSheet onClose={() => setShowGasto(false)} />}
    </>
  )
}

const ADMIN_NAV = [
  { to: '/',              label: 'Panel',     icon: LayoutDashboard },
  { to: '/registro',      label: 'Registro',  icon: ClipboardList },
  { to: '/trabajadores',  label: 'Equipo',    icon: Users },
  { to: '/nomina',        label: 'Nómina',    icon: Wallet },
  { to: '/mix',           label: 'Mix',       icon: TrendingUp },
  { to: '/configuracion', label: 'Config',    icon: Settings },
  { to: '/historial',     label: 'Historial', icon: History },
  { to: '/usuarios',      label: 'Usuarios',  icon: UserCog },
]

const WORKER_NAV = [
  { to: '/',         label: 'Inicio',   icon: LayoutDashboard },
  { to: '/registro', label: 'Registro', icon: ClipboardList },
]

function NavItem({ item, collapsed, onClick }) {
  const Icon = item.icon
  return (
    <NavLink to={item.to} onClick={onClick} end={item.to === '/'}
      className={({ isActive }) => cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium',
        isActive
          ? 'bg-red-600 text-white shadow-sm'
          : 'text-gray-300 hover:bg-white/10 hover:text-white'
      )}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  )
}

function UserChip({ profile, onSignOut, collapsed }) {
  const initials = (name) => (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-none" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold flex-none">
          {initials(profile?.display_name || profile?.email)}
        </div>
      )}
      {!collapsed && (
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold truncate">{profile?.display_name?.split(' ')[0] || profile?.email}</p>
          <p className="text-gray-500 text-[10px] capitalize">{profile?.role === 'admin' ? 'Administrador' : 'Trabajador'}</p>
        </div>
      )}
      {!collapsed && (
        <button onClick={onSignOut} title="Cerrar sesión"
          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white flex-none">
          <LogOut className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export default function Layout({ children }) {
  const { dark, toggle } = useTheme()
  const { profile, isAdmin, isWorker, isDemo, signOut, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed,   setCollapsed]   = useState(false)
  const location = useLocation()

  // Redirigir a login si no está autenticado
  if (!isDemo && !loading && !profile) {
    return <Navigate to="/login" replace />
  }

  const NAV = isAdmin ? ADMIN_NAV : WORKER_NAV
  const mobileNav = NAV.slice(0, 5)

  const currentPage = NAV.find(i => {
    if (i.to === '/') return location.pathname === '/'
    return location.pathname.startsWith(i.to)
  })

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      {/* Sidebar desktop */}
      <aside className={cn(
        'hidden lg:flex flex-col bg-[#1e1e1e] transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <img src="/logo.jpg" alt="Apex Pro" className="w-8 h-8 rounded-md object-cover" />
              <div className="leading-tight">
                <div className="text-white font-black text-sm tracking-wide">APEX-PRO</div>
                <div className="text-red-500 font-bold text-[9px] tracking-widest uppercase">Detailing</div>
              </div>
            </div>
          )}
          {collapsed && <img src="/logo.jpg" alt="Apex Pro" className="w-8 h-8 rounded-md object-cover mx-auto" />}
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

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(item => <NavItem key={item.to} item={item} collapsed={collapsed} />)}
        </nav>

        {/* Footer: modo claro + usuario */}
        <div className="p-3 border-t border-white/10 space-y-2">
          <button onClick={toggle}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-gray-400 hover:bg-white/10 hover:text-white transition-all">
            {dark ? <Sun className="w-5 h-5 flex-shrink-0" /> : <Moon className="w-5 h-5 flex-shrink-0" />}
            {!collapsed && <span>{dark ? 'Modo claro' : 'Modo oscuro'}</span>}
          </button>
          {profile && <UserChip profile={profile} onSignOut={signOut} collapsed={collapsed} />}
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 h-full bg-[#1e1e1e] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <img src="/logo.jpg" alt="Apex Pro" className="w-8 h-8 rounded-md object-cover" />
                <div className="leading-tight">
                  <div className="text-white font-black text-sm tracking-wide">APEX-PRO</div>
                  <div className="text-red-500 font-bold text-[9px] tracking-widest uppercase">Detailing</div>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV.map(item => <NavItem key={item.to} item={item} collapsed={false} onClick={() => setSidebarOpen(false)} />)}
            </nav>
            <div className="p-3 border-t border-white/10 space-y-2">
              <button onClick={toggle} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-gray-400 hover:bg-white/10 hover:text-white">
                {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                <span>{dark ? 'Modo claro' : 'Modo oscuro'}</span>
              </button>
              {profile && <UserChip profile={profile} onSignOut={signOut} collapsed={false} />}
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
          {profile && (
            <button onClick={signOut} className="p-1.5 rounded-lg hover:bg-white/10">
              <LogOut className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto pb-20 lg:pb-6">
          {children}
        </main>

        <GlobalFab canAdmin={isAdmin || isDemo} />

        {/* Bottom nav móvil */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#1e1e1e] border-t border-white/10 flex">
          {mobileNav.map(item => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}
                className={({ isActive }) => cn(
                  'flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors',
                  isActive ? 'text-red-500' : 'text-gray-500'
                )}>
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
