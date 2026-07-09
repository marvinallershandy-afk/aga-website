// Tailwind + Autoprefixer. Tailwind transformiert nur CSS-Dateien mit
// @tailwind-Direktiven (src/admin/admin.css) — die Onepager-CSS bleibt unberührt.
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}
