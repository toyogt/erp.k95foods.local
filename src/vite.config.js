import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { base44Plugin } from '@base44/vite-plugin'

export default defineConfig({
  plugins: [react(), base44Plugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Force single React instance - eliminates duplicate React errors
    dedupe: ['react', 'react-dom', 'react-router-dom'],
    // Prevent multiple node_modules resolution
    preferBuiltins: false,
  },
  server: {
    // HMR configuration for preview environment
    hmr: {
      protocol: 'wss',
      host: 'preview-sandbox--69c237f5cfd7eab4cd2d386a.base44.app',
      port: 443,
    },
  },
  // Optimize dependencies to prevent duplicate installations
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: ['@base44/sdk'],
  },
})