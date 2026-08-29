import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: "jsx",
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        ".js": "jsx",
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/predict": "http://localhost:5000",
      "/health": "http://localhost:5000",
      "/auth": "http://localhost:5000",
      "/devices": "http://localhost:5000",
      "/geo": "http://localhost:5000",
      "/api": "http://localhost:5000",
      "/captures": "http://localhost:5000",
      "/latest": "http://localhost:5000",
      "/forecast": "http://localhost:5000",
      "/weather": "http://localhost:5000",
      "/alerts": "http://localhost:5000",
      "/litter-severity": "http://localhost:5000",
      "/dashboard": "http://localhost:5000",
      "/uploads": "http://localhost:5000",
    },
  },
});
