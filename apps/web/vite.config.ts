import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  plugins: [tanstackStart(), react(), tailwindcss()],
  server: {
    // Each worktree serves the web on its own port; see `scripts/worktree/setup.sh`.
    port: Number(loadEnv(mode, __dirname, '').WEB_PORT || 3000),
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
