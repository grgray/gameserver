import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The dev server proxies API calls to the Go backend so the two run on one
// origin during development and no CORS configuration is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/games': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
  },
});
