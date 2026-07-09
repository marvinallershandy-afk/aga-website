/** @type {import('tailwindcss').Config} */
// v13-Admin: Tailwind NUR für den /admin-Bereich. `content` ist auf src/admin
// gescoped und `preflight` ist AUS → der öffentliche 3D-Onepager (globales CSS)
// wird garantiert nicht beeinflusst. shadcn-Tokens leben in src/admin/admin.css.
export default {
  content: ['./src/admin/**/*.{ts,tsx}'],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        sva: { red: '#E91D29', black: '#231F20', deep: '#0E0D0D', gold: '#E8C15A' },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
      fontFamily: {
        display: ['Anton', 'system-ui', 'sans-serif'],
        body: ['"Archivo Variable"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
