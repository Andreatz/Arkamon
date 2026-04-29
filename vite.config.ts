import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Cambia base se pubblichi su GitHub Pages sotto /Arkamon-Beta/.
// Il workflow .github/workflows/deploy.yml setta GITHUB_PAGES=true al build.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === 'true' ? '/Arkamon-Beta/' : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@data': path.resolve(__dirname, './src/data'),
      '@engine': path.resolve(__dirname, './src/engine'),
      '@store': path.resolve(__dirname, './src/store'),
      '@components': path.resolve(__dirname, './src/components'),
      '@scenes': path.resolve(__dirname, './src/scenes'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['framer-motion'],
          zustand: ['zustand'],
        },
      },
    },
  },
})
