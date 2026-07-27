import { resolve } from 'path'

import { defineConfig } from 'vite'

export default defineConfig(async () => {
  const react = (await import('@vitejs/plugin-react')).default
  return {
    root: resolve(__dirname),
    plugins: [react()],
    server: { host: 'localhost', port: 4444, strictPort: true },
    build: { outDir: resolve(__dirname, '../../dist/renderer'), emptyOutDir: true },
  }
})