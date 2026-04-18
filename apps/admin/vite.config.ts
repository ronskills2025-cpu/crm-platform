import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(__dirname, '../..');

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  css: {
    postcss: ROOT,
  },
  resolve: {
    alias: {
      '@modules': path.resolve(ROOT, 'modules'),
      '@packages': path.resolve(ROOT, 'packages'),
    },
  },
  server: {
    port: 5174,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:4000',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.VITE_WS_URL || 'ws://localhost:4000',
        ws: true,
      },
    },
  },
});
