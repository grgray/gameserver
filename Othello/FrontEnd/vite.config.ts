import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies API calls to the FastAPI backend so the two run on
// one origin during development and no CORS configuration is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/games': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
