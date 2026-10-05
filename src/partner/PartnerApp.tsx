import { useEffect, useState } from 'react'
import {
  ANSPRECHPARTNER,
  BANDEN_PAKET,
  MEDIADATEN,
  PARTNER_PAKETE,
  PARTNER_SPONSOREN,
  REICHWEITE_FALLBACK,
  STUFE_LABEL,
  plaetzeText,
  preisText,
  standText,
  zahl,
  type PartnerPaket,
  type SponsorStufe,
} from '../data/partner'
import { CONTACT } from '../data/content'
import { NELE } from '../data/club'
import { GALERIEN, coverOf } from '../data/galerie'
import { ArrowRight, ArrowUpRight, Check } from 'lucide-react'
import { Anfrage } from './Anfrage'
import { Konfigurator } from './bande/Konfigurator'
import { PartnerTafel } from './bande/PartnerTafel'
import { entwurf, entwurfAktiv, useEntwurf } from './bande/entwurf'
import { InstagramZeile } from '../ui/InstagramZeile'

// ─────────────────────────────────────────────────────────────
// v16-S: Öffentliche Partner-Seite /partner — Sponsoren gewinnen.
// Reihenfolge = Verkaufsgespräch: Warum jetzt → Zahlen → wer schon dabei
// ist → was es gibt (Pakete) → wie es läuft → Anfrage in einer Minute.
// Alles statisch aus dem Build-Overlay; nur „Anfrage senden" geht ans Netz.
// ─────────────────────────────────────────────────────────────

// v18-P: Einstieg aus dem Panel/Rundgang mit Entwurf: /partner?entwurf=1#anfrage
function startMitEntwurf(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('entwurf') === '1' && entwurfAktiv(entwurf())
  } catch {
    return false
  }
}

export function PartnerApp() {
  const [mitEntwurf, setMitEntwurf] = useState(startMitEntwurf)
  const [interesse, setInteresse] = useState<string>(() => (mitEntwurf && BANDEN_PAKET ? BANDEN_PAKET.id : ''))
  const e = useEntwurf()

  // v19-S (Audit A §2.8): Sticky-Header ab 1 px Scroll komplett deckend —
  // sonst läuft Text als Geisterschrift hinter Logo/CTA durch.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 1)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  // Deep-Link (/partner#anfrage, #deine-bande): erst nach dem Rendern springen
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!/^[a-z-]+$/.test(id)) return
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' })
      if (id === 'anfrage') document.getElementById('pt-name')?.focus({ preventScroll: true })
    }, 60)
    return () => window.clearTimeout(t)
  }, [])

  const zurAnfrage = () => {
    document.getElementById('anfrage')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => document.getElementById('pt-firma')?.focus({ preventScroll: true }), 450)
  }
  const waehle = (p: PartnerPaket) => {
    setInteresse(p.id)
    zurAnfrage()
  }
  const mitDiesemEntwurf = () => {
    if (BANDEN_PAKET) setInteresse(BANDEN_PAKET.id)
    setMitEntwurf(true)
    zurAnfrage()
  }

  return (
    <div className="pt">
      <header className={`pt-top${scrolled ? ' is-scrolled' : ''}`}>
        <a className="pt-brand" href="/" aria-label="Zur Vereinsseite">
          <img src="/brand/aga-logo.png" alt="" width="30" height="35" />
          <span className="pt-brand__wort">SV Agathenburg-Dollern</span>
        </a>
        <span className="pt-top__tag">Partner</span>
        <a className="pt-btn pt-btn--sm" href="#anfrage">
          Anfragen
        </a>
      </header>

      <main>
        <Hero />
        <Konfigurator onAnfragen={mitDiesemEntwurf} />
        <Zahlen />
        <PartnerWand />
        <Pakete onWaehle={waehle} />
        <Ablauf />
        <section id="anfrage" className="pt-sec pt-anfrage" aria-labelledby="h-anfrage">
          <p className="pt-kicker">Anfrage · 1 Minute</p>
          <h2 className="pt-h2" id="h-anfrage">
            Lass uns reden
          </h2>
          <p className="pt-lead pt-lead--sm">Kein Vertrag, keine Verpflichtung. Du sagst uns, was dich interessiert — wir melden uns persönlich.</p>
          <Ansprechpartner />
          <Anfrage
            interesse={interesse}
            onInteresse={setInteresse}
            entwurf={mitEntwurf && entwurfAktiv(e) ? e : null}
            onOhneEntwurf={() => setMitEntwurf(false)}
          />
        </section>
      </main>

      <footer className="pt-foot">
        <a href="/">Zur Vereinsseite</a>
        <a href="/live">Live-Ticker</a>
        <a href="/album">Sammelalbum</a>
        <a href="/impressum">Impressum</a>
        <a href="/datenschutz">Datenschutz</a>
        <span>SV Agathenburg-Dollern · {CONTACT.email}</span>
        <InstagramZeile className="ig-zeile--fuss" />
      </footer>
    </div>
  )
}

// ── Hero ────────────────────────────────────────────────────
// v17-D: großes echtes Foto (Galerie der Vereinsfotografin) statt
// Streifen-Verlauf — Fotografie trägt.
const HERO = (() => {
  const g = GALERIEN[0]
  const b = g ? g.bilder.find((x) => /siegerfoto/.test(x.src)) ?? coverOf(g) : null
  return b
})()

function Hero() {
  return (
    <section className={`pt-hero${HERO ? ' has-foto' : ''}`} aria-labelledby="h-hero">
      {HERO && <img className="pt-hero__foto" src={HERO.src} srcSet={`${HERO.preview} 800w, ${HERO.src} 2000w`} sizes="(min-width: 1120px) 1120px, 100vw" alt={HERO.alt} fetchPriority="high" decoding="async" />}
      <div className="pt-hero__text">
        <p className="pt-kicker">Für Unternehmen aus der Region</p>
        <h1 className="pt-h1" id="h-hero">
          Werde Partner
          <br />
          des SVA
        </h1>
        <p className="pt-lead">
          Meister der 1. Kreisklasse 2026, jetzt in der Kreisliga Stade — und auf Instagram so sichtbar wie nie. Der Verein wächst. Wachs mit: am
          Platz, auf dem Trikot und in jeder Story.
        </p>
        <HeroZahl />
        <div className="pt-actions">
          <a className="pt-btn" href="#deine-bande">
            Deine Bande ausprobieren
          </a>
          <a className="pt-btn pt-btn--ghost" href="#pakete">
            Pakete ansehen
          </a>
        </div>
      </div>
      {HERO && <p className="pt-hero__credit">Foto: {NELE.name}</p>}
    </section>
  )
}

// v19-S: Einzeiler im Hero, solange die „Die Zahlen"-Sektion (< 3 Werte) ruht.
function HeroZahl() {
  const kacheln = mediaKacheln()
  if (kacheln.length >= 3) return null
  const k = kacheln[0]
  return (
    <p className="pt-hero__zahl">
      <b>{k.wert}</b> {k.label}
      {k.sub ? <> · {k.sub}</> : null}
    </p>
  )
}

// ── Zahlen / Mediadaten ─────────────────────────────────────
interface Kachel {
  wert: string
  label: string
  sub?: string
}
// v19-S: eine Quelle für die Kacheln (Hero-Einzeiler + „Die Zahlen"-Sektion).
function mediaKacheln(): Kachel[] {
  const m = MEDIADATEN
  const kacheln: Kachel[] = []
  if (m.instagramFollower != null) kacheln.push({ wert: zahl(m.instagramFollower), label: 'Follower auf Instagram', sub: CONTACT.instagram })
  // v18-P: ohne Admin-Wert die Vereinsangabe — ehrlich als Mindestwert „630+"
  else kacheln.push({ wert: `${zahl(REICHWEITE_FALLBACK.instagramFollower)}+`, label: 'Follower auf Instagram', sub: CONTACT.instagram })
  if (m.reichweiteMonat != null) kacheln.push({ wert: zahl(m.reichweiteMonat), label: 'Ø Reichweite pro Monat', sub: 'erreichte Konten auf Instagram' })
  if (m.zuschauerHeim != null) kacheln.push({ wert: zahl(m.zuschauerHeim), label: 'Ø Zuschauer pro Heimspiel', sub: 'am Waldsportplatz' })
  // v17-A: echte, digital gezählte Zuschauer (Check-ins im Sammelalbum)
  if (m.checkinsSchnitt != null && m.checkinsSpiele)
    kacheln.push({ wert: zahl(m.checkinsSchnitt), label: 'Ø digitale Check-ins pro Heimspiel', sub: `gezählt per Sammelalbum · ${m.checkinsSpiele} ${m.checkinsSpiele === 1 ? 'Spiel' : 'Spiele'}` })
  if (m.websiteBesucheMonat != null) kacheln.push({ wert: zahl(m.websiteBesucheMonat), label: 'Website-Besuche pro Monat' })
  if (m.heimspieleSaison != null) kacheln.push({ wert: zahl(m.heimspieleSaison), label: 'Heimspiele pro Saison', sub: 'Kreisliga Stade' })
  return kacheln
}

function Zahlen() {
  const m = MEDIADATEN
  const kacheln = mediaKacheln()
  // v19-S (Audit A §2.8 / §3.5): eine einzige Kennzahl ist kein Mediadaten-Block.
  // Eigene Sektion erst ab 3 echten Zahlen — sonst steht der Wert als Zeile im Hero.
  if (kacheln.length < 3) return null
  const kontakte = m.zuschauerHeim != null && m.heimspieleSaison != null ? m.zuschauerHeim * m.heimspieleSaison : null
  const stand = standText(m.stand ?? (m.instagramFollower == null ? REICHWEITE_FALLBACK.stand : undefined))
  return (
    <section id="zahlen" className="pt-sec" aria-labelledby="h-zahlen">
      <p className="pt-kicker">Mediadaten</p>
      <h2 className="pt-h2" id="h-zahlen">
        Die Zahlen
      </h2>
      <ul className="pt-zahlen">
        {kacheln.map((k) => (
          <li key={k.label} className="pt-zahl">
            <b>{k.wert}</b>
            <span>{k.label}</span>
            {k.sub && <small>{k.sub}</small>}
          </li>
        ))}
      </ul>
      {kontakte != null && kontakte > 0 && (
        <p className="pt-zahlen__summe">
          Rund <b>{zahl(kontakte)}</b> Zuschauer-Kontakte direkt am Platz pro Saison — dazu jede Story und jedes Spielfoto.
        </p>
      )}
      {stand && <p className="pt-stand">Stand: {stand} · Instagram-Insights und eigene Zählung</p>}
    </section>
  )
}

// ── Ansprechpartner (v19-S, Audit B §2.4) ───────────────────
// Firmeninhaber kaufen von Menschen. Nur sichtbar, wenn im Admin gepflegt.
function Ansprechpartner() {
  const a = ANSPRECHPARTNER
  if (!a) return null
  const initialen = a.name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div className="pt-kontakt">
      {a.fotoUrl ? (
        <img className="pt-kontakt__foto" src={a.fotoUrl} alt={a.name} width={72} height={72} loading="lazy" />
      ) : (
        <span className="pt-kontakt__foto pt-kontakt__foto--leer" aria-hidden="true">
          {initialen}
        </span>
      )}
      <div className="pt-kontakt__txt">
        <p className="pt-kontakt__label">Dein Ansprechpartner</p>
        <b className="pt-kontakt__name">{a.name}</b>
        {a.rolle && <span className="pt-kontakt__rolle">{a.rolle}</span>}
        <p className="pt-kontakt__sub">Antwort meist am selben Tag.</p>
        {a.telefon && (
          <a className="pt-kontakt__tel" href={`tel:${a.telefon.replace(/[^+\d]/g, '')}`}>
            {a.telefon}
          </a>
        )}
      </div>
    </div>
  )
}

// ── Partner-Wand ────────────────────────────────────────────
const STUFEN: SponsorStufe[] = ['hauptpartner', 'partner', 'unterstuetzer']

function PartnerWand() {
  const alle = PARTNER_SPONSOREN
  // v17-D: Nele steht als Medienpartnerin fest auf der Wand — bis sie im
  // Admin als Sponsor eingetragen ist (Vorschlag: docs/PARTNER.md), danach
  // nicht doppelt.
  const neleImAdmin = alle.some((s) => /nele/i.test(s.name))
  return (
    <section id="partner-wand" className="pt-sec" aria-labelledby="h-wand">
      <p className="pt-kicker">Wer schon dabei ist</p>
      <h2 className="pt-h2" id="h-wand">
        Die Partner-Wand
      </h2>
      <p className="pt-lead pt-lead--sm">
        {alle.length ? 'Danke an alle, die den SVA möglich machen.' : 'Die Partner-Wand der neuen Saison füllt sich gerade — wer jetzt einsteigt, steht ganz vorn.'}
      </p>
      {!neleImAdmin && (
        <div className="pt-stufe pt-stufe--medien">
          <h3 className="pt-h3">{NELE.rolle}</h3>
          <a className="pt-nele" href={NELE.instagramUrl} target="_blank" rel="noreferrer">
            <img src={NELE.logo} alt="" width="96" height="77" />
            <span>
              <b>{NELE.name}</b>
              <small>Alle Spieltagsfotos · {NELE.instagram}</small>
            </span>
            <ArrowUpRight size={18} strokeWidth={1.5} aria-hidden="true" />
          </a>
        </div>
      )}
      {STUFEN.map((stufe) => {
        const liste = alle.filter((s) => s.stufe === stufe)
        if (!liste.length && stufe !== 'partner') return null
        return (
          <div key={stufe} className={`pt-stufe pt-stufe--${stufe}`}>
            <h3 className="pt-h3">{STUFE_LABEL[stufe]}</h3>
            <ul className="pt-logos">
              {liste.map((s) => (
                <li key={s.name}>
                  <LogoKachel name={s.name} logoUrl={s.logoUrl} url={s.url} klein={stufe === 'unterstuetzer'} />
                </li>
              ))}
              {stufe === 'partner' && (
                <li>
                  <a className="pt-logo pt-logo--frei" href="#anfrage">
                    <span>Dein Logo</span>
                    <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
                  </a>
                </li>
              )}
            </ul>
          </div>
        )
      })}
    </section>
  )
}

// v18-P: jeder Partner als seine Bandentafel — getrimmt, nach Fläche normiert,
// Untergrund nach Kontrast (vorher: Logo sprengte die weiße Kachel)
function LogoKachel({ name, logoUrl, url, klein }: { name: string; logoUrl?: string; url?: string; klein?: boolean }) {
  const inhalt = <PartnerTafel name={name} logoUrl={logoUrl} breite={klein ? 360 : 640} />
  const cls = `pt-logo${klein ? ' pt-logo--klein' : ''}`
  return url ? (
    <a className={cls} href={url} target="_blank" rel="sponsored noopener" title={name}>
      {inhalt}
    </a>
  ) : (
    <span className={cls} title={name}>
      {inhalt}
    </span>
  )
}

// ── Pakete ──────────────────────────────────────────────────
function Pakete({ onWaehle }: { onWaehle: (p: PartnerPaket) => void }) {
  if (!PARTNER_PAKETE.length) return null
  return (
    <section id="pakete" className="pt-sec" aria-labelledby="h-pakete">
      <p className="pt-kicker">Sichtbarkeit · am Platz, online, auf Instagram</p>
      <h2 className="pt-h2" id="h-pakete">
        Die Pakete
      </h2>
      <ul className="pt-pakete">
        {PARTNER_PAKETE.map((p) => {
          const plaetze = plaetzeText(p)
          const knapp = p.frei != null && p.frei > 0 && p.frei <= 2
          const voll = p.frei != null && p.frei <= 0
          return (
            <li key={p.id} className={`pt-paket${p.hervorgehoben ? ' is-top' : ''}${voll ? ' is-voll' : ''}`}>
              {p.hervorgehoben && <span className="pt-paket__band">Am meisten gefragt</span>}
              <h3 className="pt-paket__name">{p.name}</h3>
              {p.beschreibung && <p className="pt-paket__text">{p.beschreibung}</p>}
              <p className="pt-paket__preis">{preisText(p)}</p>
              {plaetze && <p className={`pt-paket__plaetze${knapp ? ' is-knapp' : ''}${voll ? ' is-voll' : ''}`}>{plaetze}</p>}
              {p.leistungen.length > 0 && (
                <ul className="pt-paket__liste">
                  {p.leistungen.map((l) => (
                    <li key={l}>
                      <Haken /> {l}
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className={`pt-btn pt-paket__cta${p.hervorgehoben ? '' : ' pt-btn--ghost'}`} onClick={() => onWaehle(p)}>
                {voll ? 'Auf die Warteliste' : 'Dieses Paket anfragen'}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="pt-stand">Pakete lassen sich kombinieren — sprich uns an, wir finden das Passende für dein Budget.</p>
    </section>
  )
}

function Haken() {
  return <Check size={16} strokeWidth={1.5} aria-hidden="true" />
}

// ── Ablauf ──────────────────────────────────────────────────
function Ablauf() {
  const schritte = [
    ['Anfrage schicken', 'Paket wählen oder einfach „Noch unsicher". Dauert eine Minute.'],
    ['Wir melden uns', 'Persönlich, per Telefon oder E-Mail. Wir stimmen Fläche, Logo und Start ab.'],
    ['Du bist sichtbar', 'Beim nächsten Heimspiel am Platz, auf der Website und auf Instagram.'],
  ]
  return (
    <section className="pt-sec" aria-labelledby="h-ablauf">
      <h2 className="pt-h2 pt-h2--klein" id="h-ablauf">
        So läuft’s
      </h2>
      <ol className="pt-ablauf">
        {schritte.map(([t, s], i) => (
          <li key={t}>
            <b>{String(i + 1).padStart(2, '0')}</b>
            <span>
              <strong>{t}</strong>
              {s}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
