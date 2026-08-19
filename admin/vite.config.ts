import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const DEFAULT_API = 'https://backend-production-4cbe.up.railway.app';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_URL ?? DEFAULT_API;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // Tauri points its webview here in development. Fixed so the desktop
      // shell's config does not have to guess which port Vite settled on.
      port: 5183,
      strictPort: true,
      /**
       * Proxy the API in development so the browser sees one origin.
       *
       * The alternative is adding http://localhost:5183 to CORS_ORIGINS on the
       * deployed backend, which would mean a production API that answers to a
       * development origin forever — a permanent widening to solve a temporary
       * problem. Proxying keeps the allowlist honest, and costs one config
       * block that ships nowhere.
       */
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      // Tauri bundles this directory as the app's static assets.
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
