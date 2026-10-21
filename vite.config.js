import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' lets the built site work on GitHub Pages (any repo name) and from a ZIP.
export default defineConfig({ plugins: [react()], base: './' })
