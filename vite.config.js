import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
  },
  server: {
    host: true,
    port: 5173,
    // Native build outputs contain thousands of files and locked Electron DLLs.
    // They are not web sources and must not enter Vite's development watcher.
    watch: {
      ignored: ['**/release/**', '**/android/**'],
    },
  },
});
