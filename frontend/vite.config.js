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
      "/devices": {
        target: "http://localhost:5000",
        bypass: (req) => {
          if (req.headers.accept && req.headers.accept.includes("html")) {
            return "/index.html";
          }
        }
      },
      "/geo": "http://localhost:5000",
      "/api": "http://localhost:5000",
      "/captures": "http://localhost:5000",
      "/latest": "http://localhost:5000",
      "/forecast": {
        target: "http://localhost:5000",
        bypass: (req) => {
          console.log("[vite-proxy] /forecast accept:", req.headers.accept, "url:", req.url);
          if (req.headers.accept && req.headers.accept.includes("html")) {
            return "/index.html";
          }
        }
      },
      "/weather": "http://localhost:5000",
      "/alerts": {
        target: "http://localhost:5000",
        bypass: (req) => {
          if (req.headers.accept && req.headers.accept.includes("html")) {
            return "/index.html";
          }
        }
      },
      "/litter-severity": {
        target: "http://localhost:5000",
        bypass: (req) => {
          if (req.headers.accept && req.headers.accept.includes("html")) {
            return "/index.html";
          }
        }
      },
    },
  },
});
