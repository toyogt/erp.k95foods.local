import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  logLevel: 'error',

  plugins: [
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ],

  resolve: {
    dedupe: ['react', 'react-dom'], // ✅ FIX: prevents multiple React instances
  },

  server: {
    hmr: {
      protocol: 'wss',
      host: 'preview-sandbox--69c237f5cfd7eab4cd2d386a.base44.app',
    }
    // OR if still issues → use:
    // hmr: false
  }
})