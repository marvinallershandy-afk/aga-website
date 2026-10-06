import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { animate, motion, MotionConfig } from 'framer-motion'
import { CalendarClock, ListOrdered, UserRound, Users } from 'lucide-react'
import { aktuelleSitzung, IST_VORFUEHRUNG, ladeLage, supabase, TippFehler, type KaderSpieler, type Lage } from './api'
import { einfuehrungGesehen, einfuehrungMerken, entwurfLesen, haptik, kuerzel, nachname, reduzierteBewegung } from './model'
import { hochrechnen } from './punkte'
import { useLiveTicker } from './liveTicker'
import { laufendeMinute, minuteLabel } from '../live/model'
import { playerMedia } from '../data/playerMedia'
import { TorJubel } from '../ui/tor/TorJubel'
import { LiveLeiste } from '../ui/tor/LiveLeiste'
import { useTorErkennung } from '../ui/tor/useTor'
import { tippStandSchreiben } from './tippStand'
import { SpieltagTab } from './SpieltagTab'
import { RanglisteTab } from './RanglisteTab'
import { LigenTab } from './LigenTab'
import { ProfilTab } from './ProfilTab'
import { LoginSheet } from './LoginSheet'
import { InstagramZeile } from '../ui/InstagramZeile'
import { Praesentiert } from './Praesentiert'
import { AlbumSchalter } from './AlbumSchalter'
import { NaechsterSchritt, type Ziel } from './NaechsterSchritt'
import { Einfuehrung } from './Einfuehrung'
import { EASE, FEDER } from './bewegung'

const Steuerleiste = lazy(() => import('./vorfuehrung/Steuerleiste'))

// ─────────────────────────────────────────────────────────────
// v20-T „SVA Tipp-Liga“ (/tippen), v21: Navigation, Vorführung, Führung.
// Vier Bereiche (Spieltag · Rangliste · Ligen · Profil) — unten am Handy,
// oben am Desktop.
//
// v21 Navigation (Bugfix + „fühlt sich an wie eine App“):
//  · Früher hing der Bereichswechsel an AnimatePresence mode="wait": der neue
//    Bereich wurde erst gezeigt, wenn der alte fertig ausgeblendet war — blieb
//    dieses „Fertig“ aus, öffnete kein Tab mehr. Jetzt: sofort umschalten,
//    Einblenden gerichtet (rechts/links) per imperativer Animation.
//  · Bereiche bleiben erhalten (einmal besucht = bleibt im Speicher, nur
//    ausgeblendet): Eingaben, gewählte Wertung, Scroll-Position je Bereich.
//  · Deep-Links #rangliste, #ligen, #profil (alt: ?tab=…), Browser-Zurück
//    springt zum vorherigen Bereich. Knöpfe sind echte Links.
//  · Am Handy: seitlich wischen wechselt den Bereich (nicht auf Leisten,
//    Bonus-Karten, Steuerleiste).
//  · „Nächster Schritt“-Zeile + 3-Schritt-Einführung beim ersten Besuch.
// v21 Vorführung (?vorfuehrung=1): Daten aus src/tippen/vorfuehrung/*.
// ─────────────────────────────────────────────────────────────

export type Tab = 'spieltag' | 'rangliste' | 'ligen' | 'profil'
const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'spieltag', label: 'Spieltag', icon: CalendarClock },
  { id: 'rangliste', label: 'Rangliste', icon: ListOrdered },
  { id: 'ligen', label: 'Ligen', icon: Users },
  { id: 'profil', label: 'Profil', icon: UserRound },
]
const istTab = (x: string | null | undefined): x is Tab => !!x && TABS.some((t) => t.id === x)
const index = (t: Tab) => TABS.findIndex((x) => x.id === t)

function tabAusAdresse(): Tab {
  try {
    const h = window.location.hash.replace(/^#/, '')
    if (istTab(h)) return h
    const q = new URLSearchParams(window.location.search)
    const t = q.get('tab')
    if (istTab(t)) return t
    if (q.get('liga')) return 'ligen'
  } catch {
    /* egal */
  }
  return 'spieltag'
}

function tabHref(t: Tab): string {
  try {
    const u = new URL(window.location.href)
    u.searchParams.delete('tab')
    u.hash = t === 'spieltag' ? '' : t
    return u.pathname + u.search + u.hash
  } catch {
    return t === 'spieltag' ? '/tippen' : `/tippen#${t}`
  }
}

/** Wisch-Gesten nicht auf eigenen Wisch-/Scroll-Flächen auswerten. */
const KEIN_WISCH = '.tp-leiste, .tp-deck, .tp-frage, .tp-elfreihe, .tp-steuer, .tp-segment, input, textarea, [data-kein-wisch]'

/** Sitzung der Vorführung (nur im Speicher, kein Token). */
const VORFUEHR_SITZUNG = { user: { id: 'vorfuehrung', email: 'vorfuehrung@sva.example' } } as unknown as Session

export function TippApp() {
  const [session, setSession] = useState<Session | null | undefined>(IST_VORFUEHRUNG ? VORFUEHR_SITZUNG : undefined)
  const [lage, setLage] = useState<Lage | null>(null)
  const [fehler, setFehler] = useState('')
  const [tab, setTabState] = useState<Tab>(tabAusAdresse)
  const [besucht, setBesucht] = useState<Set<Tab>>(() => new Set([tabAusAdresse()]))
  const [login, setLogin] = useState<null | 'tipp' | 'allgemein' | 'liga'>(null)
  const [now, setNow] = useState(() => Date.now())
  const [runde, setRunde] = useState(0) // Vorführung: Phasenwechsel → Ansichten neu
  const [einf, setEinf] = useState(false)
  const versatz = useRef(0) // Server-Uhr minus Geräte-Uhr
  const richtung = useRef(0)
  const scrollMerk = useRef<Partial<Record<Tab, number>>>({})
  const bereiche = useRef<Partial<Record<Tab, HTMLElement | null>>>({})
  const tabRef = useRef(tab)
  useEffect(() => {
    tabRef.current = tab
  }, [tab])

  const wechseln = useCallback((t: Tab, verlauf: boolean) => {
    const alt = tabRef.current
    if (t === alt) {
      // nochmal tippen = nach oben
      window.scrollTo({ top: 0, behavior: reduzierteBewegung() ? 'auto' : 'smooth' })
      return
    }
    scrollMerk.current[alt] = window.scrollY
    richtung.current = Math.sign(index(t) - index(alt))
    setBesucht((b) => (b.has(t) ? b : new Set(b).add(t)))
    setTabState(t)
    haptik(6)
    if (verlauf) {
      try {
        window.history.pushState({ tab: t }, '', tabHref(t))
      } catch {
        /* egal */
      }
    }
  }, [])
  const setTab = useCallback((t: Tab) => wechseln(t, true), [wechseln])

  // Browser-Zurück/Vor + Hash-Links
  useEffect(() => {
    const f = () => wechseln(tabAusAdresse(), false)
    window.addEventListener('popstate', f)
    window.addEventListener('hashchange', f)
    return () => {
      window.removeEventListener('popstate', f)
      window.removeEventListener('hashchange', f)
    }
  }, [wechseln])

  // Nach dem Wechsel: Scroll-Position des Bereichs + gerichtetes Einblenden
  const erster = useRef(true)
  useLayoutEffect(() => {
    if (erster.current) {
      erster.current = false
      return
    }
    window.scrollTo(0, scrollMerk.current[tab] ?? 0)
    const el = bereiche.current[tab]
    if (!el || reduzierteBewegung()) return
    const a = animate(el, { opacity: [0, 1], x: [richtung.current * 28, 0] }, { duration: 0.34, ease: EASE })
    return () => a.stop()
  }, [tab])

  const anwenden = useCallback((l: Lage) => {
    versatz.current = new Date(l.serverNow).getTime() - Date.now()
    setLage(l)
    setNow(Date.now() + versatz.current)
    setFehler('')
    // v21-UX (Befund 1): kompakten Stand für die Startseiten-Kachel ablegen
    // (die Karte liest ihn ohne Supabase-Bundle). Nicht in der Vorführung.
    if (!IST_VORFUEHRUNG) {
      tippStandSchreiben({
        offenAnstoss: l.offen?.anstoss,
        getippt: !!l.offen?.meinTipp,
        letztePunkte: l.gewertet?.meinePunkte?.gesamt,
        letzteAnstoss: l.gewertet?.anstoss,
        at: Date.now(),
      })
    }
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

  // Erster Besuch: Einführung (einmal, sobald die Seite steht)
  const hatLage = !!lage
  useEffect(() => {
    if (!hatLage || einfuehrungGesehen()) return
    const t = window.setTimeout(() => setEinf(true), 500)
    return () => window.clearTimeout(t)
  }, [hatLage])
  // „So funktioniert’s“ von überall (Profil, Fuß, Hilfe-Knopf)
  useEffect(() => {
    const f = () => setEinf(true)
    window.addEventListener('tp-einfuehrung', f)
    return () => window.removeEventListener('tp-einfuehrung', f)
  }, [])

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
          scrollMerk.current = {}
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

  // Während ein Spiel läuft (gesperrt, nicht gewertet): Stand alle 30 s
  // (Minute + Tore kommen zusätzlich alle 20 s aus dem Live-Ticker, s. unten)
  const laeuft = !IST_VORFUEHRUNG && lage?.gesperrt && (lage.gesperrt.status === 'live' || lage.gesperrt.status === 'halbzeit')
  useEffect(() => {
    if (!laeuft) return
    const id = window.setInterval(() => document.visibilityState === 'visible' && void neuLaden(), 30_000)
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

  // ── v22-T: Live — Leiste (immer sichtbar) + TOR!-Einblendung über allem ──
  const sp = lage?.gesperrt
  const spLaeuft = !!sp && (sp.status === 'live' || sp.status === 'halbzeit')
  const ticker = useLiveTicker(spLaeuft && !IST_VORFUEHRUNG)
  const tm = ticker?.match && ticker.match.id === sp?.id ? ticker.match : null
  const toreSva = tm ? tm.goalsFor : sp?.toreSva
  const toreGeg = tm ? tm.goalsAgainst : sp?.toreGegner
  const liveMinute = sp?.live
    ? `${sp.live.minute}${sp.live.nachspielzeit ? `+${sp.live.nachspielzeit}` : ''}′`
    : tm
      ? laufendeMinute(tm.status, tm.anpfiffAt, tm.wiederanpfiffAt, now)?.label.replace("'", '′')
      : undefined
  const livePunkte = useMemo(() => {
    if (!sp || !spLaeuft) return undefined
    if (sp.live?.ich) return sp.live.ich.gesamt
    if (!sp.meinTipp) return undefined
    return hochrechnen({ spiel: sp, tipp: sp.meinTipp, stand: [toreSva ?? 0, toreGeg ?? 0], ereignisse: [], minute: 0, ende: false, startelf: [], position: (id) => kader.get(id)?.position ?? 'MIT' }).gesamt
  }, [sp, spLaeuft, toreSva, toreGeg, kader])
  const [tor, torZu] = useTorErkennung(spLaeuft && sp ? sp.id : null, toreSva, toreGeg, (sva) => {
    if (!sp) return null
    const e = [...(sp.live?.ereignisse ?? [])].reverse().find((x) => x.typ === (sva ? 'tor' : 'gegentor'))
    const t = !e && ticker ? [...ticker.events].filter((x) => x.type === (sva ? 'tor' : 'gegentor')).sort((x, y) => x.at.localeCompare(y.at)).pop() : undefined
    const sid = e?.spieler ?? t?.player
    const vid = e?.spieler2 ?? t?.player2
    const k = sid ? kader.get(sid) : undefined
    const m = sid ? playerMedia(sid, { cutoutUrl: k?.cutoutUrl, photoUrl: k?.fotoUrl }) : null
    const a = toreSva ?? 0
    const b = toreGeg ?? 0
    return {
      key: `${sp.id}-${a}-${b}`,
      art: sva ? 'tor' : 'gegentor',
      name: k?.name,
      nummer: k?.nummer,
      vorlage: vid ? nachname(kader.get(vid)?.name ?? '') || undefined : undefined,
      minute: e ? `${e.minute}′` : t ? minuteLabel(t.minute, t.extra).replace("'", '′') : liveMinute,
      heim: sp.heim ? 'SVA' : kuerzel(sp.gegner),
      gast: sp.heim ? kuerzel(sp.gegner) : 'SVA',
      toreHeim: sp.heim ? a : b,
      toreGast: sp.heim ? b : a,
      heimTrifft: sva === sp.heim,
      figur: m?.figure ?? m?.bild ?? null,
      video: m?.jubel ?? m?.loop ?? null,
      gegner: sp.gegner,
    }
  })

  // Einführung: ein echter Spieler auf der Karte, die ins Album fliegt
  const einfFigur = useMemo(() => {
    const k = (lage?.kader ?? []).find((x) => x.cutoutUrl && x.kapitaen) ?? (lage?.kader ?? []).find((x) => x.cutoutUrl)
    return k ? (playerMedia(k.id, { cutoutUrl: k.cutoutUrl, photoUrl: k.fotoUrl }).figure ?? undefined) : undefined
  }, [lage?.kader])

  const istTeilnehmer = !!lage?.ich?.teilnehmer
  const anmelden = (grund: 'tipp' | 'allgemein' | 'liga' = 'allgemein') => setLogin(grund)
  const initial = lage?.ich?.profil?.vorname?.[0]

  // „Nächster Schritt“ → hinspringen
  const zumZiel = (z: Ziel) => {
    if (z === 'einfuehrung') return setEinf(true)
    if (z === 'anmelden') return anmelden()
    if (z === 'rangliste') return setTab('rangliste')
    const sel = z === 'tippschein' ? '#tp-tippschein' : z === 'live' ? '.tp-live, .tp-gesperrt' : '.tp-aufl'
    if (tabRef.current !== 'spieltag') {
      scrollMerk.current.spieltag = 0
      setTab('spieltag')
    }
    window.setTimeout(() => {
      const el = document.querySelector(sel)
      el?.scrollIntoView({ behavior: reduzierteBewegung() ? 'auto' : 'smooth', block: 'start' })
    }, 60)
  }

  // Wischen zwischen Bereichen (Handy)
  const wisch = useRef<{ x: number; y: number; t: number; an: boolean; aus: boolean } | null>(null)
  const wischEl = () => bereiche.current[tabRef.current]
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1 || window.innerWidth >= 1024) return
    const aus = !!(e.target as HTMLElement).closest?.(KEIN_WISCH)
    wisch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), an: false, aus }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const w = wisch.current
    if (!w || w.aus) return
    const dx = e.touches[0].clientX - w.x
    const dy = e.touches[0].clientY - w.y
    if (!w.an && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.5) w.an = true
    if (!w.an && Math.abs(dy) > 14) {
      w.aus = true
      return
    }
    const el = wischEl()
    if (w.an && el) {
      const i = index(tabRef.current)
      const rand = (dx > 0 && i === 0) || (dx < 0 && i === TABS.length - 1)
      el.style.transform = `translate3d(${dx * (rand ? 0.12 : 0.32)}px,0,0)`
      el.style.opacity = String(1 - Math.min(0.35, Math.abs(dx) / 900))
    }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const w = wisch.current
    wisch.current = null
    if (!w || w.aus || !w.an) return
    const dx = (e.changedTouches[0]?.clientX ?? w.x) - w.x
    const schnell = Math.abs(dx) / Math.max(1, Date.now() - w.t) > 0.5
    const i = index(tabRef.current)
    const ziel = (Math.abs(dx) > 80 || (schnell && Math.abs(dx) > 40)) ? TABS[i + (dx < 0 ? 1 : -1)]?.id : undefined
    const el = wischEl()
    if (ziel) {
      if (el) {
        el.style.transform = ''
        el.style.opacity = ''
      }
      setTab(ziel)
    } else if (el) {
      void animate(el, { transform: 'translate3d(0px,0,0)', opacity: 1 }, { duration: 0.3, ease: EASE }).then(() => {
        el.style.transform = ''
        el.style.opacity = ''
      })
    }
  }

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
          {tab === t.id && <motion.i className="tp-tabs__mark" layoutId={unten ? 'tp-tab-unten' : 'tp-tab-oben'} transition={FEDER} />}
        </a>
      )
    })

  const inhalt = (t: Tab) => {
    if (!lage) return null
    switch (t) {
      case 'spieltag':
        return <SpieltagTab lage={lage} kader={kader} now={now} angemeldet={!!session} teilnehmer={istTeilnehmer} onAnmelden={anmelden} onNeu={neuLaden} onTab={setTab} />
      case 'rangliste':
        return <RanglisteTab lage={lage} angemeldet={!!session} onAnmelden={() => anmelden()} />
      case 'ligen':
        return <LigenTab lage={lage} kader={kader} angemeldet={!!session} teilnehmer={istTeilnehmer} onAnmelden={() => anmelden('liga')} onNeu={neuLaden} />
      case 'profil':
        return <ProfilTab lage={lage} session={session ?? null} onAnmelden={() => anmelden()} onNeu={neuLaden} onTab={setTab} />
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className={`tp${IST_VORFUEHRUNG ? ' tp--vorfuehrung' : ''}${spLaeuft ? ' tp--live' : ''}`}>
        <header className="tp-top">
          <a className="tp-brand" href="/" aria-label="Zur Vereinsseite">
            <img src="/brand/aga-logo.png" alt="" width="28" height="33" />
            <span className="tp-brand__wort">SV Agathenburg-Dollern</span>
          </a>
          <AlbumSchalter angemeldet={!!session} />
          <nav className="tp-tabs tp-tabs--oben" aria-label="Bereiche">
            {nav(false)}
          </nav>
          <span className="tp-top__luft" />
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
        {lage && <NaechsterSchritt lage={lage} now={now} angemeldet={!!session} onZiel={zumZiel} />}

        <main className="tp-main" id="inhalt" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
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
          {lage &&
            TABS.filter((t) => besucht.has(t.id) || t.id === tab).map((t) => (
              <section
                key={`${t.id}-${runde}`}
                ref={(el) => {
                  bereiche.current[t.id] = el
                }}
                className="tp-bereich"
                data-bereich={t.id}
                hidden={tab !== t.id}
                aria-label={t.label}
              >
                <Bereich aktiv={tab === t.id}>{inhalt(t.id)}</Bereich>
              </section>
            ))}
        </main>

        <footer className="tp-fuss">
          <span className="tp-fuss__links">
            <button type="button" className="tp-fuss__hilfe" onClick={() => setEinf(true)}>
              So funktioniert’s
            </button>{' '}
            · <a href="/">Vereinsseite</a> · <a href="/live">Live-Ticker</a> · <a href="/album">Sammelalbum</a> · <a href="/teilnahmebedingungen">Teilnahmebedingungen</a> ·{' '}
            <a href="/datenschutz#tippliga">Datenschutz</a> · <a href="/impressum">Impressum</a>
          </span>
          <InstagramZeile className="ig-zeile--fuss" text="Jeden Freitag: „Jetzt tippen“ in der Story · @svagathenburg" />
          <span className="tp-fuss__credit">Fotos: picture by Nele</span>
        </footer>

        <nav className="tp-tabs tp-tabs--unten" aria-label="Bereiche">
          {nav(true)}
        </nav>

        {sp && spLaeuft && (
          <LiveLeiste
            daten={{
              status: sp.status === 'halbzeit' ? 'halbzeit' : 'live',
              minute: liveMinute,
              heim: sp.heim ? 'SVA' : kuerzel(sp.gegner),
              gast: sp.heim ? kuerzel(sp.gegner) : 'SVA',
              toreHeim: sp.heim ? (toreSva ?? 0) : (toreGeg ?? 0),
              toreGast: sp.heim ? (toreGeg ?? 0) : (toreSva ?? 0),
              punkte: livePunkte,
            }}
            onTippen={() => zumZiel('live')}
          />
        )}
        <TorJubel daten={tor} onZu={torZu} />

        <Einfuehrung
          offen={einf}
          preise={lage?.preise}
          figur={einfFigur}
          onZu={() => {
            setEinf(false)
            einfuehrungMerken()
          }}
        />

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

/** Ausgeblendete Bereiche nicht bei jeder Datenänderung neu zeichnen (Live: jede Minute) —
 *  sie holen den aktuellen Stand nach, sobald sie wieder sichtbar werden. */
const Bereich = memo(
  function Bereich({ children }: { aktiv: boolean; children: React.ReactNode }) {
    return <>{children}</>
  },
  (vorher, nachher) => !vorher.aktiv && !nachher.aktiv,
)

function Skelett() {
  return (
    <div className="tp-skelett" aria-busy="true" aria-label="Lädt">
      <div className="tp-skelett__hero" />
      <div className="tp-skelett__zeile" />
      <div className="tp-skelett__zeile tp-skelett__zeile--kurz" />
    </div>
  )
}
