import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },

  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],

    clearMocks: true,
    restoreMocks: true,

    // Use one thread to avoid worker startup timeouts.
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,

    testTimeout: 15000,
  },
});
