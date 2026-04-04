import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import base44Plugin from '@base44/vite-plugin';

// Force single React instance — cache bust v2
export default defineConfig({
  plugins: [base44Plugin(), react()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
    force: true,
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
});