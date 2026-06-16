import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from './context/ThemeContext'
import { AppProvider } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import './index.css'

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
                      <Route path="/nomina"        element={<AdminOnly><Nomina /></AdminOnly>} />
                      <Route path="/mix"           element={<AdminOnly><Mix /></AdminOnly>} />
                      <Route path="/configuracion" element={<AdminOnly><Configuracion /></AdminOnly>} />
                      <Route path="/historial"     element={<AdminOnly><Historial /></AdminOnly>} />
                      <Route path="/reportes"      element={<AdminOnly><Reportes /></AdminOnly>} />
                      <Route path="/usuarios"      element={<AdminOnly><AdminUsuarios /></AdminOnly>} />
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
  </React.StrictMode>
)
