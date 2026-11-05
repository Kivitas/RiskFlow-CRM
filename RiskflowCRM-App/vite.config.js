import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  logLevel: 'error',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
          if (/[\\/]node_modules[\\/]recharts[\\/]/.test(id)) return 'vendor-charts';
          if (/[\\/]node_modules[\\/](jspdf|jspdf-autotable)[\\/]/.test(id)) return 'vendor-pdf';
          if (/[\\/]node_modules[\\/]@radix-ui[\\/]/.test(id)) return 'vendor-radix';
          if (/[\\/]node_modules[\\/]framer-motion[\\/]/.test(id)) return 'vendor-motion';
          return undefined;
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
