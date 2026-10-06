import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { motion, MotionConfig } from 'framer-motion'
import { CalendarClock, ListOrdered, UserRound, Users } from 'lucide-react'
import { aktuelleSitzung, IST_VORFUEHRUNG, ladeLage, supabase, TippFehler, type KaderSpieler, type Lage } from './api'
import { entwurfLesen, haptik } from './model'
import { SpieltagTab } from './SpieltagTab'
import { RanglisteTab } from './RanglisteTab'
import { LigenTab } from './LigenTab'
import { ProfilTab } from './ProfilTab'
import { LoginSheet } from './LoginSheet'
import { InstagramZeile } from '../ui/InstagramZeile'
import { Praesentiert } from './Praesentiert'
import { AlbumSchalter } from './AlbumSchalter'

const Steuerleiste = lazy(() => import('./vorfuehrung/Steuerleiste'))

// ─────────────────────────────────────────────────────────────
// v20-T „SVA Tipp-Liga“ (/tippen), v21: Navigation neu, Vorführung.
// Vier Bereiche (Spieltag · Rangliste · Ligen · Profil) — unten am Handy,
// oben am Desktop. Ohne Login sieht man alles Öffentliche und kann den Tipp
// schon ausfüllen; erst „Tipp abgeben“ fragt einmalig nach der E-Mail.
//
// v21 Navigation: Der Bereichswechsel hängt NICHT mehr an einer Ausblende-
// Animation (früher AnimatePresence mode="wait": der neue Bereich wurde erst
// gezeigt, wenn der alte fertig ausgeblendet war — blieb das „Fertig“ aus,
// öffnete kein Tab mehr). Jetzt: sofort umschalten, nur Einblenden animiert.
// Die Knöpfe sind echte Links (?tab=…) — selbst ohne JS-Klick kommt man an.
//
// v21 Vorführung (?vorfuehrung=1): dieselben Ansichten, Daten aus der
// Simulation im Browser (src/tippen/vorfuehrung/*), nie aus der DB.
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
    const q = new URLSearchParams(window.location.search)
    const t = q.get('tab')
    if (t && TABS.some((x) => x.id === t)) return t as Tab
    if (q.get('liga')) return 'ligen'
  } catch {
    /* egal */
  }
  return 'spieltag'
}

function tabHref(t: Tab): string {
  try {
    const u = new URL(window.location.href)
    if (t === 'spieltag') u.searchParams.delete('tab')
    else u.searchParams.set('tab', t)
    return u.pathname + u.search
  } catch {
    return t === 'spieltag' ? '/tippen' : `/tippen?tab=${t}`
  }
}

/** Sitzung der Vorführung (nur im Speicher, kein Token). */
const VORFUEHR_SITZUNG = { user: { id: 'vorfuehrung', email: 'vorfuehrung@sva.example' } } as unknown as Session

export function TippApp() {
  const [session, setSession] = useState<Session | null | undefined>(IST_VORFUEHRUNG ? VORFUEHR_SITZUNG : undefined)
  const [lage, setLage] = useState<Lage | null>(null)
  const [fehler, setFehler] = useState('')
  const [tab, setTabState] = useState<Tab>(startTab)
  const [login, setLogin] = useState<null | 'tipp' | 'allgemein' | 'liga'>(null)
  const [now, setNow] = useState(() => Date.now())
  const [runde, setRunde] = useState(0) // Vorführung: Phasenwechsel → Ansichten neu
  const versatz = useRef(0) // Server-Uhr minus Geräte-Uhr

  const setTab = useCallback((t: Tab) => {
    setTabState(t)
    haptik(6)
    try {
      window.history.replaceState(null, '', tabHref(t) + window.location.hash)
    } catch {
      /* egal */
    }
    window.scrollTo({ top: 0 })
  }, [])

  const anwenden = useCallback((l: Lage) => {
    versatz.current = new Date(l.serverNow).getTime() - Date.now()
    setLage(l)
    setNow(Date.now() + versatz.current)
    setFehler('')
  }, [])

  const neuLaden = useCallback(async () => {
    try {
      const l = await ladeLage()
      anwenden(l)
      return l
    } catch (e) {
      setFehler(e instanceof TippFehler ? e.message : 'Die Tipp-Liga ist gerade nicht erreichbar.')
      return null
    }
  }, [anwenden])

  // Sitzung (gemeinsam mit /album) — nicht in der Vorführung
  useEffect(() => {
    if (IST_VORFUEHRUNG) return
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
      .then((l) => aktiv && anwenden(l))
      .catch((e) => aktiv && setFehler(e instanceof TippFehler ? e.message : 'Die Tipp-Liga ist gerade nicht erreichbar.'))
    return () => {
      aktiv = false
    }
  }, [session, uid, anwenden])

  // Vorführung: jede Änderung der Simulation → Lage neu (sofort, lokal)
  useEffect(() => {
    if (!IST_VORFUEHRUNG) return
    let ab = () => {}
    let aktiv = true
    void import('./vorfuehrung/store').then(({ simAbo, simLesen }) => {
      if (!aktiv) return
      let letzteRunde = simLesen().runde
      ab = simAbo(() => {
        const r = simLesen().runde
        if (r !== letzteRunde) {
          letzteRunde = r
          setRunde(r)
        }
        void neuLaden()
      })
    })
    return () => {
      aktiv = false
      ab()
    }
  }, [neuLaden])

  // Uhr (Countdown) — 1×/s, nur sichtbar
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setNow(Date.now() + versatz.current)
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  // Während ein Spiel läuft (gesperrt, nicht gewertet): Stand alle 60 s
  const laeuft = !IST_VORFUEHRUNG && lage?.gesperrt && (lage.gesperrt.status === 'live' || lage.gesperrt.status === 'halbzeit')
  useEffect(() => {
    if (!laeuft) return
    const id = window.setInterval(() => document.visibilityState === 'visible' && void neuLaden(), 60_000)
    return () => window.clearInterval(id)
  }, [laeuft, neuLaden])

  // Tippschluss erreicht → einmal neu laden (Formular wird „gesperrt“)
  const schluss = lage?.offen?.schluss
  useEffect(() => {
    if (!schluss || IST_VORFUEHRUNG) return
    const ms = new Date(schluss).getTime() - (Date.now() + versatz.current)
    if (ms <= 0 || ms > 2 ** 31 - 1) return
    const t = window.setTimeout(() => void neuLaden(), ms + 1500)
    return () => window.clearTimeout(t)
  }, [schluss, neuLaden])

  // Zurück vom Login-Link mit Entwurf → Login-Sheet direkt im Schritt „Profil“
  const [autoAus, setAutoAus] = useState(false)
  const autoLogin = !IST_VORFUEHRUNG && !autoAus && !!session && !!lage && !lage.ich?.teilnehmer && !!entwurfLesen()?.absenden
  const loginGrund = login ?? (autoLogin ? 'tipp' : null)

  const kader = useMemo(() => {
    const m = new Map<string, KaderSpieler>()
    for (const k of lage?.kader ?? []) m.set(k.id, k)
    return m
  }, [lage])

  const istTeilnehmer = !!lage?.ich?.teilnehmer
  const anmelden = (grund: 'tipp' | 'allgemein' | 'liga' = 'allgemein') => setLogin(grund)
  const initial = lage?.ich?.profil?.vorname?.[0]

  const nav = (unten: boolean) =>
    TABS.map((t) => {
      const Icon = t.icon
      return (
        <a
          key={t.id}
          href={tabHref(t.id)}
          aria-current={tab === t.id ? 'page' : undefined}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return
            e.preventDefault()
            setTab(t.id)
          }}
        >
          {unten && <Icon size={22} strokeWidth={1.5} aria-hidden="true" />}
          <span>{t.label}</span>
          {tab === t.id && <motion.i className="tp-tabs__mark" layoutId={unten ? 'tp-tab-unten' : 'tp-tab-oben'} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} />}
        </a>
      )
    })

  return (
    <MotionConfig reducedMotion="user">
      <div className={`tp${IST_VORFUEHRUNG ? ' tp--vorfuehrung' : ''}`}>
        <header className="tp-top">
          <a className="tp-brand" href="/" aria-label="Zur Vereinsseite">
            <img src="/brand/aga-logo.png" alt="" width="28" height="33" />
          </a>
          <AlbumSchalter angemeldet={!!session} />
          <nav className="tp-tabs tp-tabs--oben" aria-label="Bereiche">
            {nav(false)}
          </nav>
          {session ? (
            <a
              className="tp-avatar"
              href={tabHref('profil')}
              onClick={(e) => {
                e.preventDefault()
                setTab('profil')
              }}
              aria-label="Dein Profil"
            >
              {initial ? <span>{initial}</span> : <UserRound size={18} strokeWidth={1.5} aria-hidden="true" />}
            </a>
          ) : (
            <button type="button" className="tp-btn tp-btn--line tp-btn--sm tp-top__login" onClick={() => anmelden()}>
              Anmelden
            </button>
          )}
        </header>
        {IST_VORFUEHRUNG && (
          <Suspense fallback={<div className="tp-steuer tp-steuer--platz" />}>
            <Steuerleiste />
          </Suspense>
        )}
        {lage?.einstellungen.partner && <Praesentiert partner={lage.einstellungen.partner} />}

        <main className="tp-main" id="inhalt">
          {fehler && !lage && (
            <div className="tp-leer">
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
            // Kein AnimatePresence/„wait“: der Bereich wechselt sofort, nur das Einblenden ist animiert.
            <motion.div
              key={`${tab}-${runde}`}
              className="tp-bereich"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
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
              {tab === 'profil' && <ProfilTab lage={lage} session={session ?? null} onAnmelden={() => anmelden()} onNeu={neuLaden} onTab={setTab} />}
            </motion.div>
          )}
        </main>

        <footer className="tp-fuss">
          <span className="tp-fuss__links">
            <a href="/">Vereinsseite</a> · <a href="/live">Live-Ticker</a> · <a href="/album">Sammelalbum</a> ·{' '}
            <a href="/teilnahmebedingungen">Teilnahmebedingungen</a> · <a href="/datenschutz#tippliga">Datenschutz</a> ·{' '}
            <a href="/impressum">Impressum</a>
          </span>
          <InstagramZeile className="ig-zeile--fuss" text="Jeden Freitag: „Jetzt tippen“ in der Story · @svagathenburg" />
          <span className="tp-fuss__credit">Fotos: picture by Nele</span>
        </footer>

        <nav className="tp-tabs tp-tabs--unten" aria-label="Bereiche">
          {nav(true)}
        </nav>

        {!IST_VORFUEHRUNG && (
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
        )}
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
