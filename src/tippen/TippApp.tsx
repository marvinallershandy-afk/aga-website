import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { CalendarClock, ListOrdered, UserRound, Users } from 'lucide-react'
import { aktuelleSitzung, ladeLage, supabase, TippFehler, type KaderSpieler, type Lage } from './api'
import { entwurfLesen } from './model'
import { SpieltagTab } from './SpieltagTab'
import { RanglisteTab } from './RanglisteTab'
import { LigenTab } from './LigenTab'
import { ProfilTab } from './ProfilTab'
import { LoginSheet } from './LoginSheet'
import { InstagramZeile } from '../ui/InstagramZeile'
import { Praesentiert } from './Praesentiert'

// ─────────────────────────────────────────────────────────────
// v20-T „SVA Tipp-Liga“ (/tippen). Mobil zuerst, Kickbase-Gefühl im
// SVA-Designsystem: vier Bereiche (Spieltag · Rangliste · Ligen · Profil),
// untere Tab-Leiste am Handy, oben am Desktop.
// Ohne Login sieht man alles Öffentliche und kann den Tipp schon ausfüllen
// (Entwurf auf dem Gerät) — erst „Tipp abgeben“ fragt einmalig nach der
// E-Mail. Danach wird der Entwurf automatisch abgeschickt (20-Sekunden-Regel).
// ─────────────────────────────────────────────────────────────

export type Tab = 'spieltag' | 'rangliste' | 'ligen' | 'profil'
const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'spieltag', label: 'Spieltag', icon: CalendarClock },
  { id: 'rangliste', label: 'Rangliste', icon: ListOrdered },
  { id: 'ligen', label: 'Ligen', icon: Users },
  { id: 'profil', label: 'Profil', icon: UserRound },
]

function startTab(): Tab {
  try {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t && TABS.some((x) => x.id === t)) return t as Tab
    if (new URLSearchParams(window.location.search).get('liga')) return 'ligen'
  } catch {
    /* egal */
  }
  return 'spieltag'
}

export function TippApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [lage, setLage] = useState<Lage | null>(null)
  const [fehler, setFehler] = useState('')
  const [tab, setTabState] = useState<Tab>(startTab)
  const [login, setLogin] = useState<null | 'tipp' | 'allgemein' | 'liga'>(null)
  const [now, setNow] = useState(() => Date.now())
  const versatz = useRef(0) // Server-Uhr minus Geräte-Uhr

  const setTab = useCallback((t: Tab) => {
    setTabState(t)
    try {
      const u = new URL(window.location.href)
      if (t === 'spieltag') u.searchParams.delete('tab')
      else u.searchParams.set('tab', t)
      window.history.replaceState(null, '', u.pathname + u.search + u.hash)
    } catch {
      /* egal */
    }
    window.scrollTo({ top: 0 })
  }, [])

  const neuLaden = useCallback(async () => {
    try {
      const l = await ladeLage()
      versatz.current = new Date(l.serverNow).getTime() - Date.now()
      setLage(l)
      setFehler('')
      return l
    } catch (e) {
      setFehler(e instanceof TippFehler ? e.message : 'Die Tipp-Liga ist gerade nicht erreichbar.')
      return null
    }
  }, [])

  // Sitzung (gemeinsam mit /album)
  useEffect(() => {
    let aktiv = true
    void aktuelleSitzung().then((s) => aktiv && setSession(s))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => {
      aktiv = false
      data.subscription.unsubscribe()
    }
  }, [])

  // Lage laden (nach Sitzungswechsel neu, damit die eigenen Tipps dabei sind)
  const uid = session?.user?.id ?? null
  useEffect(() => {
    if (session === undefined) return
    let aktiv = true
    ladeLage()
      .then((l) => {
        if (!aktiv) return
        versatz.current = new Date(l.serverNow).getTime() - Date.now()
        setLage(l)
        setFehler('')
      })
      .catch((e) => aktiv && setFehler(e instanceof TippFehler ? e.message : 'Die Tipp-Liga ist gerade nicht erreichbar.'))
    return () => {
      aktiv = false
    }
  }, [session, uid])

  // Uhr (Countdown) — 1×/s, nur sichtbar
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setNow(Date.now() + versatz.current)
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  // Während ein Spiel läuft (gesperrt, nicht gewertet): Stand alle 60 s
  const laeuft = lage?.gesperrt && (lage.gesperrt.status === 'live' || lage.gesperrt.status === 'halbzeit')
  useEffect(() => {
    if (!laeuft) return
    const id = window.setInterval(() => document.visibilityState === 'visible' && void neuLaden(), 60_000)
    return () => window.clearInterval(id)
  }, [laeuft, neuLaden])

  // Tippschluss erreicht → einmal neu laden (Formular wird „gesperrt“)
  const schluss = lage?.offen?.schluss
  useEffect(() => {
    if (!schluss) return
    const ms = new Date(schluss).getTime() - (Date.now() + versatz.current)
    if (ms <= 0 || ms > 2 ** 31 - 1) return
    const t = window.setTimeout(() => void neuLaden(), ms + 1500)
    return () => window.clearTimeout(t)
  }, [schluss, neuLaden])

  // Zurück vom Login-Link mit Entwurf → Login-Sheet direkt im Schritt „Profil“
  const [autoAus, setAutoAus] = useState(false)
  const autoLogin = !autoAus && !!session && !!lage && !lage.ich?.teilnehmer && !!entwurfLesen()?.absenden
  const loginGrund = login ?? (autoLogin ? 'tipp' : null)

  const kader = useMemo(() => {
    const m = new Map<string, KaderSpieler>()
    for (const k of lage?.kader ?? []) m.set(k.id, k)
    return m
  }, [lage])

  const istTeilnehmer = !!lage?.ich?.teilnehmer
  const anmelden = (grund: 'tipp' | 'allgemein' | 'liga' = 'allgemein') => setLogin(grund)
  const initial = lage?.ich?.profil?.vorname?.[0]

  return (
    <MotionConfig reducedMotion="user">
      <div className="tp">
        <header className="tp-top">
          <a className="tp-brand" href="/" aria-label="Zur Vereinsseite">
            <img src="/brand/aga-logo.png" alt="" width="28" height="33" />
          </a>
          <div className="tp-brand__wort" aria-label="SVA Tipp-Liga">
            <b>Tipp-Liga</b>
            <small>SV Agathenburg-Dollern</small>
          </div>
          <nav className="tp-tabs tp-tabs--oben" aria-label="Bereiche">
            {TABS.map((t) => (
              <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          {session ? (
            <button type="button" className="tp-avatar" onClick={() => setTab('profil')} aria-label="Dein Profil">
              {initial ? <span>{initial}</span> : <UserRound size={18} strokeWidth={1.5} aria-hidden="true" />}
            </button>
          ) : (
            <button type="button" className="tp-btn tp-btn--line tp-btn--sm" onClick={() => anmelden()}>
              Anmelden
            </button>
          )}
        </header>
        {lage?.einstellungen.partner && <Praesentiert partner={lage.einstellungen.partner} />}

        <main className="tp-main" id="inhalt">
          {fehler && !lage && (
            <div className="tp-panel tp-leer">
              <p className="tp-hinweis tp-hinweis--fehler" role="alert">
                {fehler}
              </p>
              <button type="button" className="tp-btn" onClick={() => void neuLaden()}>
                Noch einmal versuchen
              </button>
            </div>
          )}
          {!lage && !fehler && <Skelett />}
          {lage && (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                {tab === 'spieltag' && (
                  <SpieltagTab
                    lage={lage}
                    kader={kader}
                    now={now}
                    angemeldet={!!session}
                    teilnehmer={istTeilnehmer}
                    onAnmelden={anmelden}
                    onNeu={neuLaden}
                    onTab={setTab}
                  />
                )}
                {tab === 'rangliste' && <RanglisteTab lage={lage} angemeldet={!!session} onAnmelden={() => anmelden()} />}
                {tab === 'ligen' && (
                  <LigenTab lage={lage} kader={kader} angemeldet={!!session} teilnehmer={istTeilnehmer} onAnmelden={() => anmelden('liga')} onNeu={neuLaden} />
                )}
                {tab === 'profil' && (
                  <ProfilTab lage={lage} session={session ?? null} onAnmelden={() => anmelden()} onNeu={neuLaden} onTab={setTab} />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </main>

        <footer className="tp-fuss">
          <span className="tp-fuss__links">
            <a href="/">Vereinsseite</a> · <a href="/live">Live-Ticker</a> · <a href="/album">Sammelalbum</a> ·{' '}
            <a href="/teilnahmebedingungen">Teilnahmebedingungen</a> · <a href="/datenschutz#tippliga">Datenschutz</a> ·{' '}
            <a href="/impressum">Impressum</a>
          </span>
          <InstagramZeile className="ig-zeile--fuss" text="Jeden Freitag: „Jetzt tippen“ in der Story · @svagathenburg" />
        </footer>

        <nav className="tp-tabs tp-tabs--unten" aria-label="Bereiche">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
                <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                <span>{t.label}</span>
              </button>
            )
          })}
        </nav>

        <LoginSheet
          offen={!!loginGrund}
          grund={loginGrund ?? 'allgemein'}
          session={session ?? null}
          lage={lage}
          onZu={() => {
            setLogin(null)
            setAutoAus(true)
          }}
          onFertig={async () => {
            setLogin(null)
            await neuLaden()
          }}
        />
      </div>
    </MotionConfig>
  )
}

function Skelett() {
  return (
    <div className="tp-skelett" aria-busy="true" aria-label="Lädt">
      <div className="tp-skelett__hero" />
      <div className="tp-skelett__zeile" />
      <div className="tp-skelett__zeile tp-skelett__zeile--kurz" />
    </div>
  )
}
