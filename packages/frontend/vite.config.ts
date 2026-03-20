import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@frontend": resolve(__dirname, "./src"),
      "@shared": resolve(__dirname, "../shared/src"),
    },
  },
  server: {
    port: 5170,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/.well-known": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
