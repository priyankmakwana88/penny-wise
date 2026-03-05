import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Penny Wise',
        short_name: 'PennyWise',
        description: 'Your household expense tracker.',
        theme_color: '#2563eb', // Matches your blue-600 header
        background_color: '#f9fafb', // Matches your gray-50 background
        display: 'standalone', // This hides the browser URL bar!
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})