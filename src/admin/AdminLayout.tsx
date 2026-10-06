import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  LayoutGrid,
  CalendarDays,
  ListOrdered,
  Handshake,
  Link2,
  Archive,
  LogOut,
  Menu,
  X,
  MoreHorizontal,
  Radio,
  KeyRound,
  UserRound,
  BookOpen,
  Camera,
  BarChart3,
  Trophy,
  MonitorPlay,
} from 'lucide-react'
import { useAuth } from './auth/AuthProvider'
import { cn } from './lib/utils'
import { Button } from './components/ui/button'
import { PublishButton } from './components/PublishButton'
import { KontoDialog } from './components/KontoDialog'

// ─────────────────────────────────────────────────────────────
// v14-C „Vereins-Pflege": Der Admin pflegt die WEBSITE. Hauptnavigation nur
// noch mit den sieben Pflege-Bereichen. Die Social-Media-Module bleiben
// erreichbar (Routen unverändert), stehen aber nur noch hinter dem dezenten
// „Archiv: Social Media"-Link ganz unten.
// Mobil (Trainer am Spielfeldrand): untere Tab-Leiste mit den vier häufigsten
// Bereichen + „Mehr" (Drawer mit allem).
// v15-L: + „Live" (Ticker) und „Team & Zugänge"; der Team-Zugang sieht nur
// Übersicht, Live, Aufstellung und Spiele.
// ─────────────────────────────────────────────────────────────

interface NavItem {
  to: string
  label: string
  icon: typeof Users
  /** true → NavLink matcht nur exakt (nötig für die Index-Route "/"). */
  end?: boolean
  /** v15-L: auch für den Team-Zugang sichtbar */
  team?: boolean
}

// Pfade RELATIV zum BrowserRouter-basename="/admin" — kein führendes /admin.
const NAV: NavItem[] = [
  { to: '/', label: 'Übersicht', icon: LayoutDashboard, end: true, team: true },
  { to: '/live', label: 'Live', icon: Radio, team: true },
  { to: '/aufstellung', label: 'Aufstellung', icon: LayoutGrid, team: true },
  { to: '/spiele', label: 'Spiele', icon: CalendarDays, team: true },
  // v20-T: Tipp-Liga (Spielbericht nach Abpfiff, Bonusfragen, Story-Grafiken)
  { to: '/tippliga', label: 'Tipp-Liga', icon: Trophy, team: true },
  // v25-D: Vollbild-QR fürs iPad am Eingang (rotierender Check-in-Code)
  { to: '/checkin-anzeige', label: 'Check-in (iPad)', icon: MonitorPlay, team: true },
  { to: '/kader', label: 'Kader', icon: Users },
  { to: '/tabelle', label: 'Tabelle', icon: ListOrdered },
  // v16-S: Bereich „Partner“ (Sponsoren, Pakete, Zahlen, Anfragen) — Pfad bleibt
  { to: '/sponsoren', label: 'Partner', icon: Handshake },
  // v17-A: Sammelalbum (Stickerheft auf /album, QR-Check-in)
  { to: '/album', label: 'Album', icon: BookOpen },
  // v17-D: Galerien der Vereinsfotografin (Karte → Fans, /galerie)
  { to: '/galerien', label: 'Galerien', icon: Camera },
  // v18-A: anonyme Besuchszählung (Quellen, Ziele)
  { to: '/statistik', label: 'Statistik', icon: BarChart3 },
  { to: '/verein', label: 'Verein & Links', icon: Link2 },
  { to: '/team', label: 'Team & Zugänge', icon: KeyRound },
]
// v15-L: Team sieht nur die Spieltags-Bereiche (Rechte erzwingt die DB-RLS).
function useNav(): NavItem[] {
  const { rolle } = useAuth()
  return rolle === 'team' ? NAV.filter((n) => n.team) : NAV
}
// Mobile Tab-Leiste: am Spieltag zählt Live → Übersicht · Live · Aufstellung · Spiele · Mehr
const MOBILE_TABS = NAV.filter((n) => n.team).slice(0, 4)

// Routen des Social-Media-Archivs (für die Hervorhebung des Archiv-Links).
const ARCHIV_PFADE = ['/archiv', '/social', '/redaktionsplan', '/ideen', '/produktion', '/matchday', '/insights', '/automationen', '/sponsoren-crm']

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const nav = useNav()
  return (
    <nav className="flex flex-col gap-1" aria-label="Hauptnavigation">
      {nav.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="flex-1">{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

function ArchivLink({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation()
  const active = ARCHIV_PFADE.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  return (
    <NavLink
      to="/archiv"
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors',
        active ? 'bg-accent text-foreground' : 'text-muted-foreground/80 hover:text-foreground',
      )}
    >
      <Archive className="h-3.5 w-3.5" /> Archiv: Social Media
    </NavLink>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <img src="/brand/wappen.png" alt="SVA" className="h-8 w-auto" />
      <span className="font-display text-lg leading-none tracking-wide">
        SVA <span className="text-primary">Vereins-Pflege</span>
      </span>
    </div>
  )
}

// v15-P: „Konto" (Passwort festlegen/ändern) neben Abmelden.
function UserBox({ onKonto }: { onKonto: () => void }) {
  const { user, signOut, rolle } = useAuth()
  return (
    <div className="border-t border-border pt-3">
      <p className="mb-2 truncate px-3 text-xs text-muted-foreground">
        {user?.email ?? 'Vorschau'}
        {rolle === 'team' && <span className="ml-1.5 rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase">Team</span>}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="w-full" onClick={onKonto}>
          <UserRound className="h-4 w-4" /> Konto
        </Button>
        <Button variant="outline" className="w-full" onClick={() => signOut()}>
          <LogOut className="h-4 w-4" /> Abmelden
        </Button>
      </div>
    </div>
  )
}

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [kontoOpen, setKontoOpen] = useState(false)
  const location = useLocation()
  const { rolle } = useAuth()
  const istAdmin = rolle !== 'team'

  return (
    <div className="min-h-screen">
      {/* Mobiler Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setKontoOpen(true)} aria-label="Konto">
            <UserRound className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen((v) => !v)} aria-label="Menü">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>
      <KontoDialog open={kontoOpen} onClose={() => setKontoOpen(false)} />

      {/* Mobiles Drawer (alles inkl. Veröffentlichen + Archiv) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <aside
            className="absolute right-0 top-0 flex h-full w-[min(20rem,88vw)] flex-col gap-4 overflow-y-auto border-l border-border bg-background p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <Brand />
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Menü schließen">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <NavItems onNavigate={() => setMobileOpen(false)} />
            {istAdmin && <PublishButton size="compact" />}
            <div className="mt-auto space-y-2">
              {istAdmin && <ArchivLink onNavigate={() => setMobileOpen(false)} />}
              <UserBox
                onKonto={() => {
                  setMobileOpen(false)
                  setKontoOpen(true)
                }}
              />
            </div>
          </aside>
        </div>
      )}

      <div className="flex">
        {/* Desktop-Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-5 overflow-y-auto border-r border-border bg-background p-4 md:flex">
          <Brand />
          <NavItems />
          {istAdmin && <PublishButton size="compact" />}
          <div className="mt-auto space-y-2">
            {istAdmin && <ArchivLink />}
            <UserBox onKonto={() => setKontoOpen(true)} />
          </div>
        </aside>

        {/* Inhalt — unten Platz für die mobile Tab-Leiste */}
        <main className="min-w-0 flex-1 p-4 pb-28 md:p-8 md:pb-8">
          {/* key erzwingt Remount pro Route → dezentes Fade-up beim Wechsel */}
          <div key={location.pathname} className="sm-page-in mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Tab-Leiste: große Ziele, Daumen-Reichweite */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Schnellnavigation"
      >
        {MOBILE_TABS.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              <Icon className="h-6 w-6" />
              {item.label}
            </NavLink>
          )
        })}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
        >
          <MoreHorizontal className="h-6 w-6" />
          Mehr
        </button>
      </nav>
    </div>
  )
}
