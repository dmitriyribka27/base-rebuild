import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset paths also work under /base-rebuild/ on GitHub Pages.
  base: './',
  build: { outDir: 'docs' },
  server: { allowedHosts: ['terminal.local'] },
})
