import base44 from "@base44/vite-plugin"
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  logLevel: 'error',
  // CRITICAL: visualEditAgent MUST be false — it injects code that creates duplicate React instances
  // causing "Cannot read properties of null (reading 'useState')" errors.
  // If you re-enable it, the app will break immediately.
  plugins: [
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      visualEditAgent: false
    }),
  ],
  ssr: false,
  server: {
    middlewareMode: true,
    hmr: {
      protocol: 'wss',
      host: 'localhost',
      port: 5173,
    },
  },
  build: {
    rollupOptions: {
      preserveEntrySignatures: 'strict',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: [],
  },
});