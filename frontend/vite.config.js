import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/aiaice/',
  build: {
    outDir: '../src/main/webapp',
    emptyOutDir: false,
  },
  server: {
    port: 5173,
    proxy: {
      '/aiaice/api': {
        target: 'http://localhost:7001',
        changeOrigin: true,
      },
      '/aiaice/ws': {
        target: 'ws://localhost:7001',
        ws: true,
      },
    },
  },
});
