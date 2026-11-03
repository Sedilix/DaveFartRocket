import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  resolve: {
    extensions: ['.ts', '.mjs', '.js', '.json']
  },
  server: {
    port: 3000,
    host: true
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) {
            return 'three-vendor';
          }
          if (id.includes('@dimforge/rapier3d-compat')) {
            return 'rapier-vendor';
          }
          if (id.includes('zustand')) {
            return 'state-vendor';
          }
        }
      }
    }
  }
});
