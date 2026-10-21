import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      // Paths follow Vite's `base`: start_url and scope default to it, and the relative URLs below
      // resolve against it, so one config serves "/" on its own or "/app/" behind the landing page.
      manifest: {
        name: 'Ampere — EV charging, shared',
        short_name: 'Ampere',
        description:
          'Find reachable, compatible EV chargers and book community chargers in Pune. Demo build: payments and charging are simulated.',
        theme_color: '#f1f1ef',
        background_color: '#f1f1ef',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['travel', 'navigation', 'utilities'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Find a charger', url: 'discover' },
          { name: 'Jury console', url: 'jury' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        // Map tiles are deliberately not cached: provider terms forbid bulk/offline tile storage.
      },
    }),
  ],
})
