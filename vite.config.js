import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
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