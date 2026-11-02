import { defineConfig } from 'vite';

export default defineConfig({
  // .ts first so a stray tsc-emitted .js can never shadow its source in dev
  resolve: {
    extensions: ['.ts', '.mjs', '.js', '.json']
  },
  server: {
    port: 3000,
    host: true
  },
  build: {
    target: 'esnext'
  }
});
