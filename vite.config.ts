import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // v15-L: zweite HTML-Seite für /live (eigene OG-Meta, schlankes Bundle).
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        live: fileURLToPath(new URL('./live.html', import.meta.url)),
        // v16-S: Partner-Seite /partner (eigene OG-Meta, kein three.js)
        partner: fileURLToPath(new URL('./partner.html', import.meta.url)),
      },
    },
  },
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
