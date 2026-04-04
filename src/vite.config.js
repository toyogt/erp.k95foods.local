import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import base44Plugin from '@base44/vite-plugin';

const reactPath = path.resolve(__dirname, 'node_modules/react');
const reactDomPath = path.resolve(__dirname, 'node_modules/react-dom');
const reactJsxPath = path.resolve(__dirname, 'node_modules/react/jsx-runtime');

export default defineConfig({
  plugins: [react(), base44Plugin()],
  cacheDir: 'node_modules/.vite2',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react': reactPath,
      'react-dom': reactDomPath,
      'react/jsx-runtime': reactJsxPath,
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
    exclude: ['@base44/sdk', '@base44/vite-plugin'],
    esbuildOptions: {
      alias: {
        'react': reactPath,
        'react-dom': reactDomPath,
        'react/jsx-runtime': reactJsxPath,
      },
    },
  },
});