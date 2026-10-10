import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  define: {
    __M1_API_BASE__: JSON.stringify(process.env.M1_API_BASE ?? ''),
  },
  root: 'example',
  base: process.env.GITHUB_ACTIONS ? '/M1/' : '/',
  publicDir: 'public',
  build: {
    outDir: '../dist-example',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      'lightweight-charts-indicators': resolve(import.meta.dirname, 'src/index.ts'),
    },
  },
  server: {
    proxy: {
      '/v1': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
      '/ready': 'http://127.0.0.1:8000',
    },
  },
});
