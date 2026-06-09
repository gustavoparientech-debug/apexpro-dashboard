import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from './context/ThemeContext'
import { AppProvider } from './context/AppContext'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Registro from './pages/Registro'
import Trabajadores from './pages/Trabajadores'
import Nomina from './pages/Nomina'
import Mix from './pages/Mix'
import Configuracion from './pages/Configuracion'
import Historial from './pages/Historial'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/registro" element={<Registro />} />
              <Route path="/trabajadores" element={<Trabajadores />} />
              <Route path="/nomina" element={<Nomina />} />
              <Route path="/mix" element={<Mix />} />
              <Route path="/configuracion" element={<Configuracion />} />
              <Route path="/historial" element={<Historial />} />
            </Routes>
          </Layout>
          <Toaster
            position="top-right"
            toastOptions={{
              className: 'dark:bg-gray-800 dark:text-white',
              duration: 3000,
            }}
          />
        </BrowserRouter>
      </AppProvider>
    </ThemeProvider>
  </React.StrictMode>
)
