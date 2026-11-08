import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    conditions: ["@metricyak/source", ...defaultClientConditions],
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
