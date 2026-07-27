import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 4444
  },
  build: {
    outDir: 'dist/renderer',
    rollupOptions: {
      output: {
        globals: {
          React: 'React'
        }
      }
    }
  }
})