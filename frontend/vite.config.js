import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BACKEND = "http://localhost:5000";

/** SPA routes that share a prefix with an API — send HTML to index.html. */
const apiWithSpaBypass = {
  target: BACKEND,
  bypass: (req) => {
    if (req.headers.accept && req.headers.accept.includes("html")) {
      return "/index.html";
    }
  },
};

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
      "/predict": BACKEND,
      "/health": BACKEND,
      "/auth": BACKEND,
      "/devices": apiWithSpaBypass,
      "/geo": BACKEND,
      "/api": BACKEND,
      "/captures": BACKEND,
      "/latest": BACKEND,
      "/forecast": apiWithSpaBypass,
      "/weather": BACKEND,
      "/alerts": apiWithSpaBypass,
      "/litter-severity": apiWithSpaBypass,
      "/littering-action": BACKEND,
      "/dashboard": apiWithSpaBypass,
      "/collection": BACKEND,
      "/uploads": BACKEND,
    },
  },
});
