import base44 from "@base44/vite-plugin"
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  logLevel: 'error',
  plugins: [
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      visualEditAgent: true
    }),
  ],
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
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});