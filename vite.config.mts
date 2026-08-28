import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      },
      {
        entry: 'src/preload/index.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      },
      {
        entry: 'src/preload/compact.ts',
        vite: {
          build: {
            outDir: 'dist-electron/preload-compact',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    ])
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src/renderer'),
      '@main': path.resolve(import.meta.dirname, 'src/main'),
      '@preload': path.resolve(import.meta.dirname, 'src/preload'),
      '@shared': path.resolve(import.meta.dirname, 'src/shared'),
      '@store': path.resolve(import.meta.dirname, 'src/store'),
      '@lib': path.resolve(import.meta.dirname, 'src/lib')
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        compact: path.resolve(import.meta.dirname, 'compact.html')
      }
    }
  },
  base: './'
})
