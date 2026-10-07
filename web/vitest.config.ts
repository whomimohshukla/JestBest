import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts on purpose: that file wires the dev proxy
// and the React Compiler babel plugin, neither of which a unit test needs, and
// its `defineConfig` comes from the build-only rolldown entry point.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The app aliases this module so `toast.success` renders as a centred
      // dialog; tests need the same resolution or component imports break.
      'react-hot-toast': fileURLToPath(new URL('./src/lib/toast.ts', import.meta.url)),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // The API is exercised by the backend suite; tests here never hit the network.
    clearMocks: true,
  },
})
