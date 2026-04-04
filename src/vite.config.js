import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import base44Plugin from '@base44/vite-plugin';

export default defineConfig({
  plugins: [react(), base44Plugin()],
  cacheDir: `node_modules/.vite_${Date.now()}`,
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});