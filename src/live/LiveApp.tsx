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
import { Konferenz } from './Konferenz'
import { zeileTexte, quelleFuss, reporterCredit } from './saetze'
import { useReaktionen, type ReaktionenNabe } from './useReaktionen'
import { ReaktionenLeiste, MitjubelnSheet, JubelFlug } from './Reaktionen'
import { REAKTION_TYPEN } from './model'
import { Icon } from './icons'
// v18-A: gemeinsame Kalender-Komponente (Spiel + Abo)
import { KalenderKnopf } from '../alltag/Kalender'
import { ArrowRight, QrCode, Trophy } from 'lucide-react'
import { ALBUM_LINK, TIPP_LINK } from '../data/club'
// v18-T: Vorführ-Spiel nur über /live?vorfuehrung=1
import { VORFUEHRUNG } from './vorfuehrung'
// v26-B: Fan-Barometer (anon, keine PII) im Live-Ticker
import { Barometer } from '../album/Barometer'
import { ladeBarometer, type Barometer as BarometerDaten } from '../album/api'
import { mitVorfuehrLive } from './vorfuehrungLive'
import { VorfuehrungsHinweis } from './VorfuehrungsHinweis'
import { InstagramZeile } from '../ui/InstagramZeile'
import { CONTACT } from '../data/content'
// v22-T: gemeinsame TOR!-Einblendung + Live-Leiste (wie /tippen)
import { playerMedia } from '../data/playerMedia'
import { TorMelder, type TorDaten } from '../ui/tor/TorJubel'
import { LiveLeiste } from '../ui/tor/LiveLeiste'
import { teamKurz, vorladen } from '../ui/tor/useTor'

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
  const live = useLive(intervall, liveKonfiguriert, VORFUEHRUNG)
  const now = useNow(1000) + live.offset
  const [tab, setTab] = useState<Tab>('ticker')
  const [toast, setToast] = useState<string | null>(null)
  const d = useMemo(() => (VORFUEHRUNG && live.data ? mitVorfuehrLive(live.data) : live.data), [live.data])
  const m = d?.match ?? null
  const players = useMemo(() => new Map((d?.players ?? []).map((p) => [p.id, p])), [d?.players])
  // v23-U: Mitjubeln (Reaktionen) — reines fetch, kein Supabase-SDK.
  const nabe = useReaktionen(d, VORFUEHRUNG)

  // v22-T: Tor fällt → große Einblendung über allem; Live-Leiste, sobald der
  // Kopf mit dem Spielstand aus dem Bild gescrollt ist
  const laeuft = !!m && (m.status === 'live' || m.status === 'halbzeit')
  const torBauen = async (sva: boolean): Promise<TorDaten | null> => {
    if (!m || !d) return null
    const e = d.events.filter((x) => x.type === (sva ? 'tor' : 'gegentor')).sort((a, b) => a.at.localeCompare(b.at)).pop()
    const sp = e?.player ? players.get(e.player) : undefined
    const vor = e?.player2 ? players.get(e.player2) : undefined
    const md = sp ? playerMedia(sp.id, sp) : null
    const p = paarung(m)
    if (sva) await vorladen(md?.figure ?? md?.bild)
    return {
      key: `${m.id}-${m.goalsFor}-${m.goalsAgainst}`,
      art: sva ? 'tor' : 'gegentor',
      name: sp?.name,
      nummer: sp?.number ?? undefined,
      vorlage: vor ? vor.name.split(' ').slice(-1)[0] : undefined,
      minute: e ? minuteLabel(e.minute, e.extra).replace("'", '′') : undefined,
      heim: teamKurz(p.heim),
      gast: teamKurz(p.gast),
      toreHeim: p.toreHeim,
      toreGast: p.toreGast,
      heimTrifft: sva === p.svaHeim,
      figur: md?.figure ?? md?.bild ?? null,
      video: md?.jubel ?? md?.loop ?? null,
      gegner: m.opponent,
    }
  }
  const [kopfWeg, setKopfWeg] = useState(false)
  useEffect(() => {
    if (!laeuft) return
    const el = document.querySelector('.lv-hero')
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([x]) => setKopfWeg(!x.isIntersecting), { rootMargin: '-40px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [laeuft, m?.id])

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
    const url = `${window.location.origin}/live${VORFUEHRUNG ? '?vorfuehrung=1' : ''}`
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
    <div className={`lv${laeuft ? ' lv--live' : ''}`}>
      <header className="lv-top">
        <a className="lv-brand" href="/" aria-label="Zur Vereinsseite">
          <img src="/brand/wappen.png" alt="" width="34" height="34" />
          <span className="lv-brand__wort">
            SV<b>A</b>
          </span>
        </a>
        <span className="lv-top__tag">Spieltag</span>
        {/* v21-UX (Befund 14): sichtbarer Rückweg in die Produktfamilie */}
        <a className="lv-top__pill" href="/tippen">Tipp-Liga</a>
        <button type="button" className="lv-iconbtn" onClick={() => void teilen()} aria-label="Live-Ticker teilen">
          <Icon name="teilen" />
        </button>
      </header>

      {VORFUEHRUNG && <VorfuehrungsHinweis />}
      {d?.partner && <Praesentiert p={d.partner} />}

      {!liveKonfiguriert ? (
        <Leer titel="Live-Ticker nicht eingerichtet" text="Die Live-Daten sind auf dieser Seite noch nicht verbunden." />
      ) : live.loading && !d ? (
        <HeroSkeleton />
      ) : live.error && !d ? (
        // v19-S (Audit C): Netzwerk-/5xx-Fehler ohne je geladene Daten ist
        // KEIN „kein Spiel“, sondern eine Störung — ehrlich anzeigen + weiter
        // versuchen (Backoff in useLive). Vorführ-Modus bleibt unberührt.
        <Unerreichbar zeit={live.letzteAktualisierung ?? live.letzterVersuch} onRetry={live.refresh} />
      ) : !m ? (
        <>
          <Leer
            titel={VORFUEHRUNG ? 'Gerade keine Vorführung' : 'Gerade kein Spiel'}
            text={VORFUEHRUNG ? 'Im Admin unter „Vorführ-Spiel“ starten — dann erscheint es hier.' : 'Sobald das nächste Spiel eingetragen ist, findest du hier Countdown, Aufstellung und Liveticker.'}
          >
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
          <Hero m={m} now={now} players={players} adresse={d?.settings.address || VEREIN_ADRESSE} prev={d?.previous ?? null} tipp={d?.tipp ?? null} onTeilen={() => void teilen()} />
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
              <Ticker data={d!} players={players} nabe={nabe} />
              {d!.conference && <Konferenz daten={d!.conference} />}
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
              <LiveTabelle settings={d!.settings} konferenz={d!.conference} />
              {d!.previous && <Zuletzt prev={d!.previous} />}
            </section>
          </main>
          {m.status === 'beendet' && <AbpfiffStory />}
        </>
      )}

      <div style={{ marginTop: 'var(--s-5)' }}>
        <KalenderKnopf variante="zeile" adresse={d?.settings.address || VEREIN_ADRESSE} />
      </div>
      <footer className="lv-foot">
        <a href="/">Zur Vereinsseite</a>
        <a href="/probetraining">Mitspielen</a>
        <a href="/album">Sammelalbum</a>
        <a href="/tippen">Tipp-Liga</a>
        <a href="/impressum">Impressum</a>
        <a href="/datenschutz">Datenschutz</a>
        {/* v25 Befund 5: eine zustandsabhängige Quellenzeile (gleiche Quelle wie
            der Ticker-Fuß) — kein Widerspruch „FuPa“ oben / „Eigener“ unten. */}
        <span>{quelleFuss(m?.source, m?.fupaUrl, VORFUEHRUNG).text}</span>
        <InstagramZeile className="ig-zeile--fuss" text="Tore, Interviews, MOTM auch in der Story: @svagathenburg" />
      </footer>
      {m && laeuft && (
        <LiveLeiste
          sichtbar={kopfWeg}
          label="Nach oben zum Spielstand"
          onTippen={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          daten={{
            status: m.status === 'halbzeit' ? 'halbzeit' : 'live',
            minute: laufendeMinute(m.status, m.anpfiffAt, m.wiederanpfiffAt, now)?.label.replace("'", '′'),
            heim: teamKurz(paarung(m).heim),
            gast: teamKurz(paarung(m).gast),
            toreHeim: paarung(m).toreHeim,
            toreGast: paarung(m).toreGast,
          }}
        />
      )}
      <TorMelder spielKey={laeuft && m ? m.id : null} toreSva={m?.goalsFor} toreGegner={m?.goalsAgainst} bauen={torBauen} />
      {m && laeuft && nabe.aktiv && <JubelFlug ausloeser={m.goalsFor} />}
      <MitjubelnSheet offen={nabe.loginOffen} onClose={nabe.schliesseLogin} />
      {nabe.fehler && (
        <div className="lv-toast" role="status">
          {nabe.fehler}
        </div>
      )}
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
function Hero({ m, now, players, adresse, prev, tipp, onTeilen }: { m: LiveMatch; now: number; players: Map<string, LivePlayer>; adresse: string; prev: LiveData['previous']; tipp: LiveData['tipp']; onTeilen: () => void }) {
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
        {m.status === 'geplant' && !m.demo && (
          <KalenderKnopf className="lv-btn lv-btn--ghost" adresse={adresse} spiel={{ id: m.id, gegner: m.opponent, heim: m.home, anstoss: m.kickoff, ort: m.home ? adresse : m.venue, wettbewerb: m.competition }} />
        )}
      </div>

      {/* v20-T: Tipp-Liga — vor Anpfiff „Jetzt tippen“, danach „Auflösung“ (nie im Vorführ-Modus) */}
      {!m.demo && <TippEinstieg status={m.status} tipp={tipp} />}

      {/* v18-P: Heimspiel → am Eingang einchecken (Sammelalbum, QR am Tor) */}
      {m.home && m.status !== 'beendet' && <AlbumCheckin laeuft={m.status === 'live' || m.status === 'halbzeit'} />}
    </section>
  )
}

function TippEinstieg({ status, tipp }: { status: LiveMatch['status']; tipp: LiveData['tipp'] }) {
  const titel = status === 'geplant' ? TIPP_LINK.titel : status === 'beendet' ? TIPP_LINK.aufloesung : 'Tipp-Liga läuft'
  // v23-U: live die echte Kurzkennzahl zeigen (tipp_live_kurz): Tipps + Tendenz.
  let text: string
  if (status === 'geplant') text = TIPP_LINK.nutzen
  else if (status === 'beendet') text = 'Punkte, Spieltagssieger und Fans vs. Kabine — sobald der Spielbericht drin ist.'
  else if (tipp && tipp.tipps > 0) {
    const teile = [`${tipp.tipps} ${tipp.tipps === 1 ? 'Tipp' : 'Tipps'}`]
    if (tipp.sieg != null) teile.push(`${tipp.sieg} % tippten Sieg`)
    text = `${teile.join(' · ')} → Deine Punkte live`
  } else text = TIPP_LINK.live
  return (
    <a className="lv-album" href={`${TIPP_LINK.href}?utm_source=intern`}>
      <Trophy size={24} strokeWidth={1.5} aria-hidden="true" />
      <span>
        <b>{titel}</b>
        <small>{text}</small>
      </span>
      <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
    </a>
  )
}

function AlbumCheckin({ laeuft }: { laeuft: boolean }) {
  const [baro, setBaro] = useState<BarometerDaten | null>(null)
  useEffect(() => {
    if (VORFUEHRUNG) {
      setBaro({ spielId: 'vf', gegner: 'TuS Harsefeld', anstoss: new Date().toISOString(), ziel: 40, stand: 28, erreicht: false })
      return
    }
    let aktiv = true
    const laden = () => ladeBarometer().then((b) => aktiv && setBaro(b)).catch(() => {})
    laden()
    const t = setInterval(laden, 45000)
    return () => {
      aktiv = false
      clearInterval(t)
    }
  }, [])
  return (
    <div className="lv-album-block">
      <a className="lv-album" href={ALBUM_LINK.href}>
        <QrCode size={24} strokeWidth={1.5} aria-hidden="true" />
        <span>
          <b>{laeuft ? 'Am Platz? Noch schnell einchecken' : 'Am Eingang einchecken'}</b>
          {/* v25 Befund 3: Belohnungstext zentral aus club.ts (ALBUM_LINK.belohnung) —
              „Getränk nach Wahl“ statt veraltetem „Freibier“ (Jugendschutz). */}
          <small>QR-Code am Eingang scannen, Sticker-Tütchen öffnen — {ALBUM_LINK.belohnung}.</small>
        </span>
        <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
      </a>
      {baro && <Barometer b={baro} />}
    </div>
  )
}

// v19-S: nach Abpfiff zurück nach Instagram lenken (Audit B §2.3)
function AbpfiffStory() {
  return (
    <section className="lv-story">
      <p className="lv-story__kicker">Nach dem Spiel</p>
      <b className="lv-story__titel">Spieler des Spiels läuft in unserer Story.</b>
      <p className="lv-story__text">Wie fandest du’s? Abstimmen, MOTM wählen und alle Highlights gibt’s auf Instagram.</p>
      <InstagramZeile text={`Zur Story: ${CONTACT.instagram}`} />
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
      <span className={sva ? 'lv-crest' : 'lv-crest lv-crest--tafel'}>{sva ? <img src="/brand/wappen.png" alt="" /> : <i>{ini}</i>}</span>
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
function Ticker({ data, players, nabe }: { data: LiveData; players: Map<string, LivePlayer>; nabe: ReaktionenNabe }) {
  const stand = useMemo(() => spielstandVerlauf(data.events), [data.events])
  const m = data.match!
  const spielerName = (slug?: string | null) => (slug ? players.get(slug)?.name ?? null : null)
  const fuss = quelleFuss(m.source, m.fupaUrl, VORFUEHRUNG)
  if (!data.events.length) {
    return (
      <div className="lv-card lv-card--pad lv-leer">
        <Icon name="pfeife" />
        <p>{m.status === 'beendet' ? 'Zu diesem Spiel gibt es keinen Ticker.' : 'Der Ticker startet mit dem Anpfiff. Seite einfach offen lassen — sie aktualisiert sich selbst.'}</p>
      </div>
    )
  }
  return (
    <>
      <ol className="lv-ticker">
        {data.events.map((e) => (
          <TickerZeile
            key={e.id}
            e={e}
            players={players}
            spielerName={spielerName}
            stand={stand.get(e.id) ?? null}
            home={m.home}
            opponent={m.opponent}
            fupaAutor={m.fupaAutor}
            nabe={nabe}
          />
        ))}
      </ol>
      <p className="lv-ticker__quelle">
        {fuss.url ? (
          <a href={fuss.url} target="_blank" rel="noopener">
            {fuss.text}
          </a>
        ) : (
          fuss.text
        )}
      </p>
    </>
  )
}

const EV_ICON: Record<string, Parameters<typeof Icon>[0]['name']> = {
  gegentor: 'ball',
  gelb: 'gelb',
  gelbrot: 'gelbrot',
  rot: 'rot',
  wechsel: 'wechsel',
  wechsel_gegner: 'wechsel',
  elfmeter: 'elfmeter',
  elfmeter_verschossen: 'elfmeter',
  kommentar: 'kommentar',
}

function TickerZeile({
  e,
  players,
  spielerName,
  stand,
  home,
  opponent,
  fupaAutor,
  nabe,
}: {
  e: LiveEvent
  players: Map<string, LivePlayer>
  spielerName: (slug?: string | null) => string | null
  stand: [number, number] | null
  home: boolean
  opponent: string
  fupaAutor?: string
  nabe: ReaktionenNabe
}) {
  const min = minuteLabel(e.minute, e.extra)
  const standText = stand ? (home ? `${stand[0]}:${stand[1]}` : `${stand[1]}:${stand[0]}`) : ''
  const t = zeileTexte(e, { opponent, stand: standText, spielerName })
  const credit = reporterCredit(e, fupaAutor, VORFUEHRUNG)
  const reaktBar = nabe.aktiv && REAKTION_TYPEN.includes(e.type) ? <ReaktionenLeiste id={e.id} nabe={nabe} /> : null

  if (e.type === 'anpfiff' || e.type === 'halbzeit' || e.type === 'wiederanpfiff' || e.type === 'abpfiff') {
    return (
      <li className="lv-ev lv-ev--status">
        <span className="lv-ev__linie" aria-hidden="true" />
        <span className="lv-ev__statuslabel">
          <Icon name="pfeife" /> {TYP_LABEL[e.type]}
          {min && e.type !== 'anpfiff' ? ` · ${min}` : ''}
        </span>
        <span className="lv-ev__linie" aria-hidden="true" />
        {t.text && <p className="lv-ev__statustext">{t.text}</p>}
        {credit && <p className="lv-ev__credit">{credit}</p>}
        {reaktBar}
      </li>
    )
  }

  if (e.type === 'tor') {
    const p1 = e.player ? players.get(e.player) : undefined
    const bild = e.placeholder ? null : (p1?.cutoutUrl ?? p1?.photoUrl ?? null)
    return (
      <li className={`lv-ev lv-ev--tor${e.source === 'fupa' ? ' lv-ev--fupa' : ''}`}>
        <span className="lv-ev__min">{min}</span>
        <div className="lv-tor">
          <span className="lv-tor__face">{bild ? <img src={bild} alt="" loading="lazy" /> : <i>{p1?.number ?? '⚽'}</i>}</span>
          <div className="lv-tor__txt">
            <span className="lv-tor__kicker">
              <Icon name="ball" /> {t.torKicker} {standText && <b>{standText}</b>}
            </span>
            <b className="lv-tor__name">{t.torName}</b>
            {t.zusatz && <span className="lv-ev__zusatz">{t.zusatz}</span>}
            {t.sub && <span className="lv-ev__sub">{t.sub}</span>}
            {t.text && <p className="lv-ev__text">{t.text}</p>}
            {credit && <p className="lv-ev__credit">{credit}</p>}
            {reaktBar}
          </div>
        </div>
      </li>
    )
  }

  const titelText = e.type === 'gegentor' && standText ? `${t.titel} · ${standText}` : t.titel
  return (
    <li className={`lv-ev lv-ev--${e.type}${t.gegner ? ' lv-ev--gegner' : ''}${e.source === 'fupa' ? ' lv-ev--fupa' : ''}`}>
      <span className="lv-ev__min">{min}</span>
      <span className="lv-ev__icon">
        <Icon name={EV_ICON[e.type] ?? 'kommentar'} />
      </span>
      <div className="lv-ev__body">
        {titelText && <b className="lv-ev__titel">{titelText}</b>}
        {t.sub && <span className="lv-ev__sub">{t.sub}</span>}
        {t.zusatz && <span className="lv-ev__zusatz">{t.zusatz}</span>}
        {t.text && <p className="lv-ev__text">{t.text}</p>}
        {credit && <p className="lv-ev__credit">{credit}</p>}
        {reaktBar}
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

// v19-S (Audit C): Störungs-Zustand — Liveticker gerade nicht erreichbar.
function Unerreichbar({ zeit, onRetry }: { zeit: number | null; onRetry: () => void }) {
  const stand = zeit ? new Date(zeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null
  return (
    <section className="lv-hero lv-hero--leer" role="status">
      <span className="lv-netz lv-netz--gross">
        <Icon name="offline" />
      </span>
      <h1 className="lv-leer__titel">Liveticker gerade nicht erreichbar</h1>
      <p className="lv-meta">
        {stand ? <>Stand von {stand} Uhr — </> : null}Wir versuchen es weiter. Die Seite lädt sich von selbst neu, sobald die Verbindung wieder steht.
      </p>
      <div className="lv-actions">
        <button type="button" className="lv-btn" onClick={onRetry}>
          <Icon name="offline" /> Jetzt neu laden
        </button>
        <a className="lv-btn lv-btn--ghost" href="/">
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
