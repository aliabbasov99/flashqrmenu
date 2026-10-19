import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Lokal inkişaf: npm run dev:api (3001) ilə birlikdə işləyir
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
