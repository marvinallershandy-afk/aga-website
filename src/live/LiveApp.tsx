import { useEffect, useMemo, useState } from 'react'
import { useLive, useNow } from './useLive'
import {
  anfahrtUrl,
  laufendeMinute,
  minuteLabel,
  paarung,
  spielstandVerlauf,
  SVA_NAME,
  TYP_LABEL,
  type LiveData,
  type LiveEvent,
  type LiveMatch,
  type LivePartner,
  type LivePlayer,
} from './model'
import { liveKonfiguriert } from './api'
import { TvAufstellung } from './aufstellung/TvAufstellung'
import { LiveTabelle } from './LiveTabelle'
import { Icon } from './icons'
// v18-A: gemeinsame Kalender-Komponente (Spiel + Abo)
import { KalenderKnopf } from '../alltag/Kalender'

// ─────────────────────────────────────────────────────────────
// v15-L: Öffentliche Live-Seite /live — der Spieltag lebt hier, nicht im
// 3D-Onepager. Ruhig, schnell (kein three.js, kein Supabase-SDK), mobil
// zuerst. Daten: web_live() per fetch.
//   Polling: 15 s bei live/halbzeit, 60 s kurz vor/nach Anpfiff (damit
//   der Wechsel auf LIVE nicht 5 min hängt), sonst 5 min. Versteckter Tab
//   pausiert (useLive).
// ─────────────────────────────────────────────────────────────

const VEREIN_ADRESSE = 'Waldsportplatz Agathenburg, Zur Mehrzweckhalle, 21684 Agathenburg'

function intervall(d: LiveData | null): number {
  const m = d?.match
  if (!m) return 5 * 60_000
  if (m.status === 'live' || m.status === 'halbzeit') return 15_000
  const k = new Date(m.kickoff).getTime()
  const now = Date.now()
  if (m.status === 'geplant' && now > k - 20 * 60_000 && now < k + 3 * 3600_000) return 60_000
  return 5 * 60_000
}

type Tab = 'ticker' | 'aufstellung' | 'tabelle'

export function LiveApp() {
  const live = useLive(intervall, liveKonfiguriert)
  const now = useNow(1000) + live.offset
  const [tab, setTab] = useState<Tab>('ticker')
  const [toast, setToast] = useState<string | null>(null)
  const d = live.data
  const m = d?.match ?? null
  const players = useMemo(() => new Map((d?.players ?? []).map((p) => [p.id, p])), [d?.players])

  // Tab-Titel mit Spielstand (hilft beim Zurückwechseln in den Tab)
  useEffect(() => {
    if (!m) {
      document.title = 'Spieltag · SV Agathenburg-Dollern'
      return
    }
    const p = paarung(m)
    const kurz = (n: string) => (n === SVA_NAME ? 'SVA' : n)
    document.title =
      m.status === 'geplant'
        ? `${kurz(p.heim)} – ${kurz(p.gast)} · Spieltag`
        : `${m.status === 'beendet' ? 'Endstand' : 'LIVE'} ${p.toreHeim}:${p.toreGast} · ${kurz(p.heim)} – ${kurz(p.gast)}`
  }, [m])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(t)
  }, [toast])

  const teilen = async () => {
    const url = `${window.location.origin}/live`
    const text = m ? teilenText(m) : 'Spieltag beim SV Agathenburg-Dollern'
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
    try {
      if (nav.share) {
        await nav.share({ title: 'SVA Live-Ticker', text, url })
        return
      }
      await navigator.clipboard.writeText(`${text} ${url}`)
      setToast('Link kopiert')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setToast('Teilen nicht möglich')
    }
  }

  return (
    <div className="lv">
      <header className="lv-top">
        <a className="lv-brand" href="/" aria-label="Zur Vereinsseite">
          <img src="/brand/wappen.png" alt="" width="34" height="34" />
          <span className="lv-brand__wort">
            SV<b>A</b>
          </span>
        </a>
        <span className="lv-top__tag">Spieltag</span>
        <button type="button" className="lv-iconbtn" onClick={() => void teilen()} aria-label="Live-Ticker teilen">
          <Icon name="teilen" />
        </button>
      </header>

      {d?.partner && <Praesentiert p={d.partner} />}

      {!liveKonfiguriert ? (
        <Leer titel="Live-Ticker nicht eingerichtet" text="Die Live-Daten sind auf dieser Seite noch nicht verbunden." />
      ) : live.loading && !d ? (
        <HeroSkeleton />
      ) : !m ? (
        <>
          <Leer titel="Gerade kein Spiel" text="Sobald das nächste Spiel eingetragen ist, findest du hier Countdown, Aufstellung und Liveticker.">
            {d?.previous && <Zuletzt prev={d.previous} />}
          </Leer>
          {d && (
            <section className="lv-card lv-card--pad">
              <h2 className="lv-h2">Tabelle</h2>
              <LiveTabelle settings={d.settings} />
            </section>
          )}
        </>
      ) : (
        <>
          <Hero m={m} now={now} players={players} adresse={d?.settings.address || VEREIN_ADRESSE} prev={d?.previous ?? null} onTeilen={() => void teilen()} />
          {live.error && (
            <p className="lv-netz" role="status">
              <Icon name="offline" /> Verbindung wackelt — zeige Stand von{' '}
              {live.letzteAktualisierung ? new Date(live.letzteAktualisierung).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—'}
              <button type="button" onClick={live.refresh}>Neu laden</button>
            </p>
          )}

          <nav className="lv-tabs" aria-label="Bereiche">
            {(['ticker', 'aufstellung', 'tabelle'] as Tab[]).map((t) => (
              <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>
                {t === 'ticker' ? 'Ticker' : t === 'aufstellung' ? 'Aufstellung' : 'Tabelle'}
              </button>
            ))}
          </nav>

          <main className="lv-grid" data-tab={tab}>
            <section className="lv-col lv-col--ticker" aria-labelledby="h-ticker">
              <h2 className="lv-h2" id="h-ticker">
                Liveticker
              </h2>
              <Ticker data={d!} players={players} />
            </section>
            <section className="lv-col lv-col--aufstellung" aria-labelledby="h-auf">
              <h2 className="lv-h2" id="h-auf">
                Aufstellung
              </h2>
              <TvAufstellung data={d!} />
            </section>
            <section className="lv-col lv-col--tabelle" aria-labelledby="h-tab">
              <h2 className="lv-h2" id="h-tab">
                Tabelle
              </h2>
              <LiveTabelle settings={d!.settings} />
              {d!.previous && <Zuletzt prev={d!.previous} />}
            </section>
          </main>
        </>
      )}

      <div style={{ marginTop: 'var(--s-5)' }}>
        <KalenderKnopf variante="zeile" adresse={d?.settings.address || VEREIN_ADRESSE} />
      </div>
      <footer className="lv-foot">
        <a href="/">Zur Vereinsseite</a>
        <a href="/probetraining">Mitspielen</a>
        <a href="/impressum">Impressum</a>
        <a href="/datenschutz">Datenschutz</a>
        <span>Eigener Liveticker des Vereins · ohne Gewähr</span>
      </footer>
      {toast && (
        <div className="lv-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

// v16-S: dezente Zeile „Live-Ticker präsentiert von“ unter dem Kopf
function Praesentiert({ p }: { p: LivePartner }) {
  const inhalt = (
    <>
      <span className="lv-partner__label">Live-Ticker präsentiert von</span>
      {p.logoUrl ? <img className="lv-partner__logo" src={p.logoUrl} alt={p.name} height="28" /> : <b className="lv-partner__name">{p.name}</b>}
    </>
  )
  return p.url ? (
    <a className="lv-partner" href={p.url} target="_blank" rel="sponsored noopener">
      {inhalt}
    </a>
  ) : (
    <p className="lv-partner">{inhalt}</p>
  )
}

function teilenText(m: LiveMatch): string {
  const p = paarung(m)
  if (m.status === 'geplant') return `${p.heim} – ${p.gast}: Countdown, Aufstellung und Liveticker`
  return `${m.status === 'beendet' ? 'Endstand' : 'LIVE'}: ${p.heim} ${p.toreHeim}:${p.toreGast} ${p.gast}`
}

// ── Kopf ────────────────────────────────────────────────────
function Hero({ m, now, players, adresse, prev, onTeilen }: { m: LiveMatch; now: number; players: Map<string, LivePlayer>; adresse: string; prev: LiveData['previous']; onTeilen: () => void }) {
  const p = paarung(m)
  const kickoff = new Date(m.kickoff)
  const lm = laufendeMinute(m.status, m.anpfiffAt, m.wiederanpfiffAt, now)
  const ort = m.home ? adresse : m.venue || m.opponent
  const datum = kickoff.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' })
  const zeit = kickoff.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
  const kopf = [m.competition, m.matchday ? `${m.matchday}. Spieltag` : null].filter(Boolean).join(' · ')
  const motm = m.motm ? players.get(m.motm) : null
  const vorbei = m.status === 'geplant' && kickoff.getTime() < now

  return (
    <section className="lv-hero" data-status={m.status}>
      {kopf && <p className="lv-kicker">{kopf}</p>}
      <div className="lv-teams">
        <Team name={p.heim} sva={p.svaHeim} />
        <div className="lv-score" aria-live="polite" aria-atomic="true">
          {m.status === 'geplant' ? (
            <span className="lv-score__zeit">{zeit}</span>
          ) : (
            <>
              <span>{p.toreHeim}</span>
              <span className="lv-score__dp">:</span>
              <span>{p.toreGast}</span>
            </>
          )}
        </div>
        <Team name={p.gast} sva={!p.svaHeim} />
      </div>

      <div className="lv-status">
        {m.status === 'live' && (
          <span className="lv-pill lv-pill--live">
            <i className="lv-puls" aria-hidden="true" /> LIVE {lm?.label ?? ''}
          </span>
        )}
        {m.status === 'halbzeit' && <span className="lv-pill lv-pill--hz">Halbzeit</span>}
        {m.status === 'beendet' && <span className="lv-pill">Endstand</span>}
        {m.status === 'geplant' && !vorbei && <Countdown ziel={kickoff.getTime()} now={now} />}
        {vorbei && <span className="lv-pill">Anpfiff {zeit} Uhr · Ticker startet gleich</span>}
      </div>

      <p className="lv-meta">
        {datum} · {zeit} Uhr · {m.home ? 'Heimspiel' : 'Auswärts'}
        {ort ? <> · {ort.split(',')[0]}</> : null}
      </p>

      {m.status === 'geplant' && prev && <Zuletzt prev={prev} />}

      {motm && (
        <div className="lv-motm">
          <span className="lv-motm__face">
            {motm.cutoutUrl || motm.photoUrl ? <img src={motm.cutoutUrl ?? motm.photoUrl ?? ''} alt="" /> : <i>{motm.number ?? '★'}</i>}
          </span>
          <span>
            <small>Spieler des Spiels</small>
            <b>{motm.name}</b>
          </span>
        </div>
      )}

      <div className="lv-actions">
        <a className="lv-btn" href={anfahrtUrl(ort || VEREIN_ADRESSE)} target="_blank" rel="noreferrer">
          <Icon name="route" /> Anfahrt
        </a>
        <button type="button" className="lv-btn lv-btn--ghost" onClick={onTeilen}>
          <Icon name="teilen" /> Teilen
        </button>
        {m.status === 'geplant' && (
          <KalenderKnopf className="lv-btn lv-btn--ghost" adresse={adresse} spiel={{ id: m.id, gegner: m.opponent, heim: m.home, anstoss: m.kickoff, ort: m.home ? adresse : m.venue, wettbewerb: m.competition }} />
        )}
      </div>
    </section>
  )
}

function Team({ name, sva }: { name: string; sva: boolean }) {
  const ini = name
    .split(/[\s/-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div className={sva ? 'lv-team lv-team--sva' : 'lv-team'}>
      <span className="lv-crest">{sva ? <img src="/brand/wappen.png" alt="" /> : <i>{ini}</i>}</span>
      <span className="lv-team__name">
        {sva ? (
          <>
            SV Agathenburg-<wbr />Dollern
          </>
        ) : (
          name
        )}
      </span>
    </div>
  )
}

function Countdown({ ziel, now }: { ziel: number; now: number }) {
  const diff = Math.max(0, ziel - now)
  const t = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const min = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <span className="lv-countdown" aria-label={`Anpfiff in ${t} Tagen, ${h} Stunden, ${min} Minuten`}>
      <small>Anpfiff in</small>
      {t > 0 && (
        <>
          <b>{t}</b>
          <em>{t === 1 ? 'Tag' : 'Tage'}</em>
        </>
      )}
      <b>
        {pad(h)}:{pad(min)}
      </b>
      <b className="lv-countdown__s">{pad(s)}</b>
    </span>
  )
}

function Zuletzt({ prev }: { prev: NonNullable<LiveData['previous']> }) {
  const p = paarung(prev)
  const d = new Date(prev.kickoff).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' })
  const art = prev.goalsFor > prev.goalsAgainst ? 'S' : prev.goalsFor === prev.goalsAgainst ? 'U' : 'N'
  return (
    <p className="lv-zuletzt">
      <span className={`lv-form lv-form--${art}`}>{art}</span>
      Zuletzt ({d}): {p.heim === SVA_NAME ? 'SVA' : p.heim} {p.toreHeim}:{p.toreGast} {p.gast === SVA_NAME ? 'SVA' : p.gast}
    </p>
  )
}

// ── Ticker ──────────────────────────────────────────────────
function Ticker({ data, players }: { data: LiveData; players: Map<string, LivePlayer> }) {
  const stand = useMemo(() => spielstandVerlauf(data.events), [data.events])
  const m = data.match!
  if (!data.events.length) {
    return (
      <div className="lv-card lv-card--pad lv-leer">
        <Icon name="pfeife" />
        <p>{m.status === 'beendet' ? 'Zu diesem Spiel gibt es keinen Ticker.' : 'Der Ticker startet mit dem Anpfiff. Seite einfach offen lassen — sie aktualisiert sich selbst.'}</p>
      </div>
    )
  }
  return (
    <ol className="lv-ticker">
      {data.events.map((e) => (
        <TickerZeile key={e.id} e={e} players={players} stand={stand.get(e.id) ?? null} home={m.home} opponent={m.opponent} />
      ))}
    </ol>
  )
}

function name(players: Map<string, LivePlayer>, id?: string) {
  if (!id) return null
  return players.get(id) ?? null
}

function TickerZeile({ e, players, stand, home, opponent }: { e: LiveEvent; players: Map<string, LivePlayer>; stand: [number, number] | null; home: boolean; opponent: string }) {
  const p1 = name(players, e.player)
  const p2 = name(players, e.player2)
  const min = minuteLabel(e.minute, e.extra)
  const standText = stand ? (home ? `${stand[0]}:${stand[1]}` : `${stand[1]}:${stand[0]}`) : ''

  if (e.type === 'anpfiff' || e.type === 'halbzeit' || e.type === 'wiederanpfiff' || e.type === 'abpfiff') {
    return (
      <li className="lv-ev lv-ev--status">
        <span className="lv-ev__linie" aria-hidden="true" />
        <span className="lv-ev__statuslabel">
          <Icon name="pfeife" /> {TYP_LABEL[e.type]}
          {min && e.type !== 'anpfiff' ? ` · ${min}` : ''}
        </span>
        <span className="lv-ev__linie" aria-hidden="true" />
        {e.text && <p className="lv-ev__statustext">{e.text}</p>}
      </li>
    )
  }

  if (e.type === 'tor') {
    const bild = p1?.cutoutUrl ?? p1?.photoUrl ?? null
    return (
      <li className="lv-ev lv-ev--tor">
        <span className="lv-ev__min">{min}</span>
        <div className="lv-tor">
          <span className="lv-tor__face">{bild ? <img src={bild} alt="" loading="lazy" /> : <i>{p1?.number ?? '⚽'}</i>}</span>
          <div className="lv-tor__txt">
            <span className="lv-tor__kicker">
              <Icon name="ball" /> TOR für den SVA! <b>{standText}</b>
            </span>
            <b className="lv-tor__name">{p1 ? p1.name : 'Tor SVA'}</b>
            {p2 && <span className="lv-ev__sub">Vorlage: {p2.name}</span>}
            {e.text && <p className="lv-ev__text">{e.text}</p>}
          </div>
        </div>
      </li>
    )
  }

  const icon: Record<string, Parameters<typeof Icon>[0]['name']> = {
    gegentor: 'ball',
    gelb: 'gelb',
    gelbrot: 'gelbrot',
    rot: 'rot',
    wechsel: 'wechsel',
    elfmeter: 'elfmeter',
    kommentar: 'kommentar',
  }
  let titel: string
  let sub: string | null = null
  if (e.type === 'gegentor') {
    titel = `Gegentor ${standText}`
    sub = opponent
  } else if (e.type === 'wechsel') {
    titel = 'Wechsel'
    sub = [p1 && `↑ ${p1.name}`, p2 && `↓ ${p2.name}`].filter(Boolean).join('   ') || null
  } else if (e.type === 'kommentar') {
    titel = ''
  } else {
    titel = TYP_LABEL[e.type]
    sub = p1 ? p1.name : e.type === 'elfmeter' ? null : 'Gegner'
  }
  return (
    <li className={`lv-ev lv-ev--${e.type}`}>
      <span className="lv-ev__min">{min}</span>
      <span className="lv-ev__icon">
        <Icon name={icon[e.type] ?? 'kommentar'} />
      </span>
      <div className="lv-ev__body">
        {titel && <b className="lv-ev__titel">{titel}</b>}
        {sub && <span className="lv-ev__sub">{sub}</span>}
        {e.text && <p className="lv-ev__text">{e.text}</p>}
      </div>
    </li>
  )
}

// ── Leer-/Ladezustände ──────────────────────────────────────
function Leer({ titel, text, children }: { titel: string; text: string; children?: React.ReactNode }) {
  return (
    <section className="lv-hero lv-hero--leer">
      <h1 className="lv-leer__titel">{titel}</h1>
      <p className="lv-meta">{text}</p>
      {children}
      <div className="lv-actions">
        <a className="lv-btn" href="/">
          Zur Vereinsseite
        </a>
      </div>
    </section>
  )
}

function HeroSkeleton() {
  return (
    <section className="lv-hero" aria-busy="true" aria-label="Lädt">
      <div className="lv-skel lv-skel--s" />
      <div className="lv-skel lv-skel--l" />
      <div className="lv-skel lv-skel--m" />
    </section>
  )
}
