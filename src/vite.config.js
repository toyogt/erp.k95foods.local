import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import base44Plugin from '@base44/vite-plugin';
import path from 'path';

export default defineConfig({
  plugins: [base44Plugin(), react()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
});