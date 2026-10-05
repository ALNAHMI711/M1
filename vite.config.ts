import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'example',
  base: process.env.GITHUB_ACTIONS ? '/M1/' : '/',
  publicDir: 'public',
  build: {
    outDir: '../dist-example',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      'lightweight-charts-indicators': resolve(__dirname, 'src/index.ts'),
    },
  },
});
