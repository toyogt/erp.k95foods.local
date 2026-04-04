import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import base44Plugin from '@base44/vite-plugin';
const __dirname = new URL('.', import.meta.url).pathname;

const reactPath = new URL('./node_modules/react', import.meta.url).pathname;
const reactDomPath = new URL('./node_modules/react-dom', import.meta.url).pathname;
const reactJsxPath = new URL('./node_modules/react/jsx-runtime', import.meta.url).pathname;

export default defineConfig({
  plugins: [react(), base44Plugin()],
  cacheDir: 'node_modules/.vite3',
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      'react': reactPath,
      'react-dom': reactDomPath,
      'react/jsx-runtime': reactJsxPath,
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  optimizeDeps: {
    noDiscovery: true,
    include: [],
    exclude: ['@base44/sdk', '@base44/vite-plugin', 'react', 'react-dom', 'react/jsx-runtime'],
    esbuildOptions: {
      alias: {
        'react': reactPath,
        'react-dom': reactDomPath,
        'react/jsx-runtime': reactJsxPath,
      },
    },
  },
});