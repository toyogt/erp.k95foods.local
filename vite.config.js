import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  logLevel: 'error',

  // Run @vitejs/plugin-react before base44 so JSX/runtime handling is consistent
  plugins: [
    react(),
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
  ],

  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js'),
    },
    dedupe: ['react', 'react-dom'],
  },

  // Pre-bundling React into multiple esbuild chunks breaks the dispatcher (null useState).
  // Serve React from node_modules as a single logical module graph instead.
  optimizeDeps: {
    exclude: ['react', 'react-dom'],
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/')
          if (normalized.includes('/node_modules/react/') || normalized.endsWith('/node_modules/react')) {
            return 'react-core'
          }
          if (normalized.includes('/node_modules/react-dom/') || normalized.endsWith('/node_modules/react-dom')) {
            return 'react-core'
          }
        },
      },
    },
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