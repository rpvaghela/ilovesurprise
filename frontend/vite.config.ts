import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    modulePreload: {
      resolveDependencies: (_filename, deps, context) =>
        context.hostType === 'html'
          ? deps.filter((dependency) => !dependency.includes('geo-data-pkg-'))
          : deps,
    },
    rolldownOptions: {
      output: {
        // Split large vendor libraries into their own long-cached chunks.
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'vendor-motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/ },
            { name: 'vendor-query', test: /node_modules[\\/]@tanstack[\\/]/ },
            { name: 'vendor-icons', test: /node_modules[\\/]lucide-react[\\/]/ },
            { name: 'geo-data-pkg', test: /node_modules[\\/]country-state-city[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/](?!country-state-city[\\/])/ },
            // Large static catalog data changes independently of app code.
            { name: 'catalog-data', test: /src[\\/]data[\\/]/ },
            { name: 'app-services', test: /src[\\/]services[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
})
