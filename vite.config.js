import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Base path for GitHub Pages when repository is served from a subpath
  // Update to your repo name if different (note trailing slash)
  base: '/Portfolio/',
  server: {
    port: 5173
  }
})