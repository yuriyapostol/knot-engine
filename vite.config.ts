import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: { entry: { index: 'src/index.ts', 'core/index': 'src/core/index.ts', '3d/index': 'src/3d/index.ts', 'mosaic/index': 'src/mosaic/index.ts' }, formats: ['es'], cssFileName: 'style', fileName: (_format, name) => `${name}.js` },
    rollupOptions: { external: ['vue', 'three', /^three\//] },
    cssCodeSplit: false
  }
})
