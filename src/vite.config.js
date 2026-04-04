import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
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
    react({
      jsxRuntime: 'automatic',
    }),
  ],
  server: {
    allowedHosts: 'ta-01knbq228hc493whhndegs9r4x-5173-0dgromorx38ebrbkgm9mmu95s.w.modal.host',
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
});