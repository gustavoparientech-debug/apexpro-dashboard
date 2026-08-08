import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-v2.png', 'apple-touch-icon-v2.png', 'logo-claro.png', 'logo-oscuro.png', 'logo-cuadrado-claro.jpg'],
      manifest: {
        name: 'Apex Pro Detailing',
        short_name: 'Apex Pro',
        description: 'Dashboard de gestión Apex Pro Detailing',
        theme_color: '#dc2626',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icon-192-v2.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-192-v2.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512-v2.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512-v2.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cacheId: 'apexpro-v2',
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
})
