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
          {/* Con solo "Recargar" la pantalla quedaba trabada en el error: si la
              página que falla es la que se recarga, vuelve a fallar. */}
          <div style={{ display:'flex', gap:'0.75rem', justifyContent:'center', flexWrap:'wrap' }}>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }} style={{ background:'#dc2626', color:'#fff', border:'none', borderRadius:'8px', padding:'0.75rem 2rem', fontSize:'1rem', cursor:'pointer' }}>
              Recargar
            </button>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/' }} style={{ background:'#fff', color:'#374151', border:'1px solid #d1d5db', borderRadius:'8px', padding:'0.75rem 2rem', fontSize:'1rem', cursor:'pointer' }}>
              Ir al inicio
            </button>
          </div>
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
// El SW se registra con `registerType: 'autoUpdate'` (ver vite.config.js), así que toma
// control solo y este listener basta para que el usuario reciba la versión nueva.
if ('serviceWorker' in navigator) {
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })
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
// Página pública de fidelización: la abren los clientes desde su celular, así
// que no pasa por Layout ni por sesión.
const Fidelidad = lazy(() => import('./pages/Fidelidad'))
// Sorteo Apex Pro: páginas públicas (sin sesión) y panel interno.
const SorteoLanding = lazy(() => import('./pages/sorteo/SorteoLanding'))
const SorteoComprar = lazy(() => import('./pages/sorteo/SorteoComprar'))
const SorteoEstado  = lazy(() => import('./pages/sorteo/SorteoEstado'))
const SorteoLista   = lazy(() => import('./pages/sorteo/SorteoLista'))
const SorteoPanel   = lazy(() => import('./pages/sorteo/SorteoPanel'))

// Páginas secundarias — lazy load (solo se descargan cuando el usuario navega ahí)
const Trabajadores  = lazy(() => import('./pages/Trabajadores'))
const Nomina        = lazy(() => import('./pages/Nomina'))
const Mix           = lazy(() => import('./pages/Mix'))
const Metas         = lazy(() => import('./pages/Metas'))
const Configuracion = lazy(() => import('./pages/Configuracion'))
const Historial     = lazy(() => import('./pages/Historial'))
const Reportes      = lazy(() => import('./pages/Reportes'))
const AdminUsuarios = lazy(() => import('./pages/AdminUsuarios'))
const Presupuesto   = lazy(() => import('./pages/Presupuesto'))
const Citas         = lazy(() => import('./pages/Citas'))
const Asistencia         = lazy(() => import('./pages/Asistencia'))
const AsistenciaReporte  = lazy(() => import('./pages/AsistenciaReporte'))
const Horarios           = lazy(() => import('./pages/Horarios'))
const Facturas           = lazy(() => import('./pages/Facturas'))
const Clientes           = lazy(() => import('./pages/Clientes'))

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

// apexproaqp.com es el dominio público del sorteo: ahí solo existen sus
// páginas. Ni login ni panel, y no se cargan sesión ni datos del negocio.
// (sorteo.localhost sirve para probarlo en local.)
const IS_SORTEO_HOST = /(^|\.)apexproaqp\.com$|^sorteo\.localhost$/i.test(window.location.hostname)

function SorteoSite() {
  return (
    <BrowserRouter>
      <Suspense fallback={PageFallback}>
        <Routes>
          <Route path="/sorteo"                 element={<SorteoLanding />} />
          <Route path="/sorteo/comprar"         element={<SorteoComprar />} />
          <Route path="/sorteo/estado/:orderId" element={<SorteoEstado />} />
          <Route path="/sorteo/lista"           element={<SorteoLista />} />
          <Route path="*"                       element={<Navigate to="/sorteo" replace />} />
        </Routes>
      </Suspense>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(IS_SORTEO_HOST ? (
  <React.StrictMode>
    <ErrorBoundary><SorteoSite /></ErrorBoundary>
  </React.StrictMode>
) : (
  <React.StrictMode>
    <ErrorBoundary>
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/fidelidad" element={<Suspense fallback={PageFallback}><Fidelidad /></Suspense>} />
              <Route path="/sorteo"                  element={<Suspense fallback={PageFallback}><SorteoLanding /></Suspense>} />
              <Route path="/sorteo/comprar"          element={<Suspense fallback={PageFallback}><SorteoComprar /></Suspense>} />
              <Route path="/sorteo/estado/:orderId"  element={<Suspense fallback={PageFallback}><SorteoEstado /></Suspense>} />
              <Route path="/sorteo/lista"            element={<Suspense fallback={PageFallback}><SorteoLista /></Suspense>} />
              <Route path="/*" element={
                <Layout>
                  <Suspense fallback={PageFallback}>
                    <Routes>
                      <Route path="/"              element={<HomeRoute />} />
                      <Route path="/registro"      element={<Registro />} />
                      <Route path="/trabajadores"  element={<AdminOnly><Trabajadores /></AdminOnly>} />
                      <Route path="/nomina"        element={<Navigate to="/trabajadores" replace />} />
                      <Route path="/mix"           element={<AdminOnly><Mix /></AdminOnly>} />
                      <Route path="/metas"         element={<Metas />} />
                      <Route path="/configuracion" element={<AdminOnly><Configuracion /></AdminOnly>} />
                      <Route path="/historial"     element={<AdminOnly><Historial /></AdminOnly>} />
                      <Route path="/reportes"      element={<AdminOnly><Reportes /></AdminOnly>} />
                      <Route path="/usuarios"      element={<AdminOnly><AdminUsuarios /></AdminOnly>} />
                      <Route path="/presupuesto"   element={<Presupuesto />} />
                      <Route path="/citas"         element={<Citas />} />
                      <Route path="/asistencia"    element={<Asistencia />} />
                      <Route path="/asistencia/reporte" element={<AdminOnly><AsistenciaReporte /></AdminOnly>} />
                      <Route path="/horarios"          element={<AdminOnly><Horarios /></AdminOnly>} />
                      <Route path="/facturas"          element={<AdminOnly><Facturas /></AdminOnly>} />
                      <Route path="/clientes"          element={<AdminOnly><Clientes /></AdminOnly>} />
                      <Route path="/sorteo-panel"      element={<SorteoPanel />} />
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
))
