import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from './context/ThemeContext'
import { AppProvider } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DashboardTrabajador from './pages/DashboardTrabajador'
import Registro from './pages/Registro'
import Trabajadores from './pages/Trabajadores'
import Nomina from './pages/Nomina'
import Mix from './pages/Mix'
import Configuracion from './pages/Configuracion'
import Historial from './pages/Historial'
import Reportes from './pages/Reportes'
import AdminUsuarios from './pages/AdminUsuarios'
import './index.css'

function HomeRoute() {
  const { isAdmin, isDemo } = useAuth()
  return (isAdmin || isDemo) ? <Dashboard /> : <DashboardTrabajador />
}

function AdminOnly({ children }) {
  const { isAdmin, isDemo } = useAuth()
  if (!isAdmin && !isDemo) return <Navigate to="/" replace />
  return children
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/*" element={
                <Layout>
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
