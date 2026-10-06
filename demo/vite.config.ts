import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: process.env.BASE_PATH || '/',
  plugins: [vue()],
  resolve: { alias: { 'knot-engine': fileURLToPath(new URL('../src/index.ts', import.meta.url)) } },
  build: { outDir: '../demo-dist', emptyOutDir: true }
})
