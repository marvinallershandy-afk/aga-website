import { realpathSync } from 'node:fs'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // node_modules dieses Worktrees ist ein Symlink ins Haupt-Repo
      // (~/code/sva-fussball, pnpm). Vite prüft die Allow-List gegen den
      // REALEN Pfad — ohne ihn blockt der Dev-Server die @fontsource-
      // Dateien mit 403 und zeigt Fallback-Fonts statt Anton/Archivo.
      allow: [searchForWorkspaceRoot(process.cwd()), realpathSync('node_modules')],
    },
  },
})
