import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// The shell deploys to GitHub Pages at https://<user>.github.io/builder-shell/,
// so assets must be served under that base path in production.
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/builder-shell/' : '/',
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
