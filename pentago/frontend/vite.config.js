import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// The dev server proxies REST calls and the game WebSocket to the FastAPI
// backend, so both run on one origin in development and no CORS is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/games": {
        target: "http://localhost:8000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    css: false,
  },
});
