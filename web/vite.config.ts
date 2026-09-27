import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

// The proxy target must be the API *origin*, not the full API base path.
// VITE_API_URL is documented as e.g. http://localhost:4000/api/v1, so strip the
// suffix to avoid rewriting /api/v1/x into /api/v1/api/v1/x.
const toProxyOrigin = (apiUrl: string): string => apiUrl.replace(/\/api\/v1\/?$/, '')

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite only exposes .env values to client code via import.meta.env, so the
  // config file must load them explicitly.
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL || 'http://localhost:4000/api/v1'

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: toProxyOrigin(apiUrl),
          changeOrigin: true,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
    },
  }
})