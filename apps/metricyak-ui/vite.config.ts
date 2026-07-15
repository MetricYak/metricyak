import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3001,
    proxy: {
      '/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split large, rarely-changing vendors into their own cacheable chunks
        // so an app-code change doesn't bust them, and the browser can fetch
        // them in parallel with the entry.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/motion/')) return 'motion';
          if (id.includes('/radix-ui/')) return 'radix';
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router') ||
            id.includes('/scheduler/')
          ) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
});
