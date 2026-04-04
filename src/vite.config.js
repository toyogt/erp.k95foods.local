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
    dedupe: ['react', 'react-dom']
  },
  server: {
    hmr: {
      protocol: 'wss',
      host: 'preview-sandbox--69c237f5cfd7eab4cd2d386a.base44.app',
      port: 443
    }
  }
})