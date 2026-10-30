import { fileURLToPath, URL } from 'node:url'
import { mergeConfig } from 'vite'
import { defineConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Tests import the site demo before the package's dist entry exists.
export default mergeConfig(viteConfig, defineConfig({
  resolve: {
    alias: {
      'knot-engine': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
}))
