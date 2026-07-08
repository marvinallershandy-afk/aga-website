import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  CalendarDays,
  Lightbulb,
  Image as ImageIcon,
  Handshake,
  BarChart3,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useAuth } from './auth/AuthProvider'
import { cn } from './lib/utils'
import { Button } from './components/ui/button'

interface NavItem {
  to: string
  label: string
  icon: typeof CalendarDays
  soon?: boolean
}

const NAV: NavItem[] = [
  { to: '/admin/redaktionsplan', label: 'Redaktionsplan', icon: CalendarDays },
  { to: '/admin/ideen', label: 'Ideen-Pool', icon: Lightbulb },
  { to: '/admin/matchday', label: 'Matchday-Grafiken', icon: ImageIcon },
  { to: '/admin/sponsoren', label: 'Sponsoren', icon: Handshake, soon: true },
  { to: '/admin/insights', label: 'Insights', icon: BarChart3, soon: true },
]

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.soon && (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                bald
              </span>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <img src="/brand/wappen.png" alt="SVA" className="h-8 w-auto" />
      <span className="font-display text-lg tracking-wide">
        SVA <span className="text-primary">Admin</span>
      </span>
    </div>
  )
}

export function AdminLayout() {
  const { user, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen">
      {/* Mobiler Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <Brand />
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen((v) => !v)} aria-label="Menü">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      {/* Mobiles Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <aside
            className="absolute left-0 top-0 flex h-full w-72 flex-col gap-4 border-r border-border bg-background p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Brand />
            <NavItems onNavigate={() => setMobileOpen(false)} />
            <div className="mt-auto border-t border-border pt-3">
              <p className="mb-2 truncate px-3 text-xs text-muted-foreground">{user?.email}</p>
              <Button variant="outline" className="w-full" onClick={() => signOut()}>
                <LogOut className="h-4 w-4" /> Abmelden
              </Button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex">
        {/* Desktop-Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r border-border bg-background p-4 md:flex">
          <Brand />
          <NavItems />
          <div className="mt-auto border-t border-border pt-3">
            <p className="mb-2 truncate px-3 text-xs text-muted-foreground">{user?.email}</p>
            <Button variant="outline" className="w-full" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" /> Abmelden
            </Button>
          </div>
        </aside>

        {/* Inhalt */}
        <main className="min-w-0 flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
