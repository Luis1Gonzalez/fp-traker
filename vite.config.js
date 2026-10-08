import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt": nunca recarga sola la página (podría cortar algo a medio
      // escribir); App.jsx avisa y el usuario decide cuándo actualizar.
      registerType: 'prompt',
      // No se inyecta el registro automático: main.jsx lo hace a mano con
      // virtual:pwa-register/react, para poder mostrar el aviso de "hay una
      // versión nueva" con nuestro propio diseño en vez del genérico.
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'FP Tracker',
        short_name: 'FP Tracker',
        description: 'Tareas, apuntes, evaluaciones y horario del ciclo.',
        start_url: '/',
        display: 'standalone',
        background_color: '#1C2128',
        theme_color: '#1C2128',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // El "shell" de la app (JS/CSS/HTML) se precachea entero, así que
        // abrir la app sin conexión carga la interfaz igualmente.
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Lecturas a Supabase (tareas, apuntes, evaluaciones...): se
            // intenta siempre la red primero; si no hay conexión, se sirve
            // la última respuesta buena guardada. Los guardados (POST/PATCH/
            // DELETE) no entran aquí: sin red, fallan igual que siempre (no
            // tendría sentido "guardar" algo que no ha llegado al servidor).
            urlPattern: ({ url, request }) =>
              url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'datos-supabase',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
})
