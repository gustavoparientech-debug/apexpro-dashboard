import React, { lazy, Suspense, Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error, info) { console.error('App crash:', error, info) }
  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', padding:'2rem', fontFamily:'sans-serif', background:'#fff' }}>
        <div style={{ maxWidth:'400px', textAlign:'center' }}>
          <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>⚠️</div>
          <h2 style={{ fontSize:'1.2rem', fontWeight:'bold', marginBottom:'0.5rem', color:'#dc2626' }}>Ocurrió un error</h2>
          <p style={{ color:'#666', fontSize:'0.9rem', marginBottom:'1.5rem' }}>{this.state.error?.message || 'Error desconocido'}</p>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }} style={{ background:'#dc2626', color:'#fff', border:'none', borderRadius:'8px', padding:'0.75rem 2rem', fontSize:'1rem', cursor:'pointer' }}>
            Recargar
          </button>
        </div>
      </div>
    )
  }
}
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from './context/ThemeContext'
import { AppProvider } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import './index.css'

// Cuando un nuevo Service Worker toma control (tras un despliegue nuevo), recargar
// la página para evitar que la app quede referenciando archivos JS viejos que ya no existen.
if ('serviceWorker' in navigator) {
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })

  // Si la versión del SW cacheado no coincide con la versión actual del build,
  // desregistrar todos los SWs y limpiar caches para forzar la versión nueva.
  const SW_VERSION = '2026-06-23-v2'
  const swVerKey = 'apexpro_sw_version'
  if (localStorage.getItem(swVerKey) !== SW_VERSION) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister())
    })
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k)))
    }
    localStorage.setItem(swVerKey, SW_VERSION)
    // Solo recargar si había una versión vieja (no en primera visita)
    if (localStorage.getItem(swVerKey + '_prev')) {
      window.location.reload()
    }
    localStorage.setItem(swVerKey + '_prev', '1')
  }
}

// Si un chunk JS de una versión vieja ya no existe (tras un despliegue), recargar
// una sola vez en vez de dejar la app colgada en el spinner de carga.
window.addEventListener('unhandledrejection', (event) => {
  const msg = String(event.reason?.message || '')
  if (/Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(msg)) {
    const key = 'apexpro_chunk_reload'
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1')
      window.location.reload()
    }
  }
})

// Páginas críticas — carga inmediata
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DashboardTrabajador from './pages/DashboardTrabajador'
import Registro from './pages/Registro'
import AuthCallback from './pages/AuthCallback'

// Páginas secundarias — lazy load (solo se descargan cuando el usuario navega ahí)
const Trabajadores  = lazy(() => import('./pages/Trabajadores'))
const Nomina        = lazy(() => import('./pages/Nomina'))
const Mix           = lazy(() => import('./pages/Mix'))
const Configuracion = lazy(() => import('./pages/Configuracion'))
const Historial     = lazy(() => import('./pages/Historial'))
const Reportes      = lazy(() => import('./pages/Reportes'))
const AdminUsuarios = lazy(() => import('./pages/AdminUsuarios'))
const Presupuesto   = lazy(() => import('./pages/Presupuesto'))
const Citas         = lazy(() => import('./pages/Citas'))

function HomeRoute() {
  const { isAdmin, isDemo } = useAuth()
  return (isAdmin || isDemo) ? <Dashboard /> : <DashboardTrabajador />
}

function AdminOnly({ children }) {
  const { isAdmin, isDemo } = useAuth()
  if (!isAdmin && !isDemo) return <Navigate to="/" replace />
  return children
}

const PageFallback = (
  <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
  </div>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/*" element={
                <Layout>
                  <Suspense fallback={PageFallback}>
                    <Routes>
                      <Route path="/"              element={<HomeRoute />} />
                      <Route path="/registro"      element={<Registro />} />
                      <Route path="/trabajadores"  element={<AdminOnly><Trabajadores /></AdminOnly>} />
                      <Route path="/nomina"        element={<Navigate to="/trabajadores" replace />} />
                      <Route path="/mix"           element={<AdminOnly><Mix /></AdminOnly>} />
                      <Route path="/configuracion" element={<AdminOnly><Configuracion /></AdminOnly>} />
                      <Route path="/historial"     element={<AdminOnly><Historial /></AdminOnly>} />
                      <Route path="/reportes"      element={<AdminOnly><Reportes /></AdminOnly>} />
                      <Route path="/usuarios"      element={<AdminOnly><AdminUsuarios /></AdminOnly>} />
                      <Route path="/presupuesto"   element={<Presupuesto />} />
                      <Route path="/citas"         element={<Citas />} />
                    </Routes>
                  </Suspense>
                </Layout>
              } />
            </Routes>
            <Toaster position="top-right" toastOptions={{ className: 'dark:bg-gray-800 dark:text-white', duration: 3000 }} />
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
