import { useState } from 'react'
import {
  MEDIADATEN,
  PARTNER_PAKETE,
  PARTNER_SPONSOREN,
  STUFE_LABEL,
  plaetzeText,
  preisText,
  standText,
  zahl,
  type PartnerPaket,
  type SponsorStufe,
} from '../data/partner'
import { CONTACT } from '../data/content'
import { Anfrage } from './Anfrage'

// ─────────────────────────────────────────────────────────────
// v16-S: Öffentliche Partner-Seite /partner — Sponsoren gewinnen.
// Reihenfolge = Verkaufsgespräch: Warum jetzt → Zahlen → wer schon dabei
// ist → was es gibt (Pakete) → wie es läuft → Anfrage in einer Minute.
// Alles statisch aus dem Build-Overlay; nur „Anfrage senden" geht ans Netz.
// ─────────────────────────────────────────────────────────────

export function PartnerApp() {
  const [interesse, setInteresse] = useState<string>('')

  const waehle = (p: PartnerPaket) => {
    setInteresse(p.id)
    document.getElementById('anfrage')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => document.getElementById('pt-firma')?.focus({ preventScroll: true }), 450)
  }

  return (
    <div className="pt">
      <header className="pt-top">
        <a className="pt-brand" href="/" aria-label="Zur Vereinsseite">
          <img src="/brand/wappen.png" alt="" width="34" height="34" />
          <span className="pt-brand__wort">
            SV<b>A</b>
          </span>
        </a>
        <span className="pt-top__tag">Partner</span>
        <a className="pt-btn pt-btn--sm" href="#anfrage">
          Anfragen
        </a>
      </header>

      <main>
        <Hero />
        <Zahlen />
        <PartnerWand />
        <Pakete onWaehle={waehle} />
        <Ablauf />
        <section id="anfrage" className="pt-sec pt-anfrage" aria-labelledby="h-anfrage">
          <p className="pt-kicker">Anfrage · 1 Minute</p>
          <h2 className="pt-h2" id="h-anfrage">
            Lass uns <em>reden</em>
          </h2>
          <p className="pt-lead pt-lead--sm">Kein Vertrag, keine Verpflichtung. Du sagst uns, was dich interessiert — wir melden uns persönlich.</p>
          <Anfrage interesse={interesse} onInteresse={setInteresse} />
        </section>
      </main>

      <footer className="pt-foot">
        <a href="/">Zur Vereinsseite</a>
        <a href="/live">Live-Ticker</a>
        <a href="/impressum">Impressum</a>
        <a href="/datenschutz">Datenschutz</a>
        <span>SV Agathenburg-Dollern · {CONTACT.email}</span>
      </footer>
    </div>
  )
}

// ── Hero ────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="pt-hero" aria-labelledby="h-hero">
      <p className="pt-kicker">Für Unternehmen aus der Region</p>
      <h1 className="pt-h1" id="h-hero">
        Werde Partner
        <br />
        des <em>SVA</em>
      </h1>
      <p className="pt-lead">
        Meister der 1. Kreisklasse 2026, jetzt in der Kreisliga Stade — und auf Instagram so sichtbar wie nie. Der Verein wächst. Wachs mit: am
        Platz, auf dem Trikot und in jeder Story.
      </p>
      <div className="pt-actions">
        <a className="pt-btn" href="#pakete">
          Pakete ansehen
        </a>
        <a className="pt-btn pt-btn--ghost" href="#anfrage">
          Anfrage senden
        </a>
      </div>
    </section>
  )
}

// ── Zahlen / Mediadaten ─────────────────────────────────────
function Zahlen() {
  const m = MEDIADATEN
  const kacheln: { wert: string; label: string; sub?: string }[] = []
  if (m.instagramFollower != null) kacheln.push({ wert: zahl(m.instagramFollower), label: 'Follower auf Instagram', sub: CONTACT.instagram })
  if (m.reichweiteMonat != null) kacheln.push({ wert: zahl(m.reichweiteMonat), label: 'Ø Reichweite pro Monat', sub: 'erreichte Konten auf Instagram' })
  if (m.zuschauerHeim != null) kacheln.push({ wert: zahl(m.zuschauerHeim), label: 'Ø Zuschauer pro Heimspiel', sub: 'am Waldsportplatz' })
  if (m.websiteBesucheMonat != null) kacheln.push({ wert: zahl(m.websiteBesucheMonat), label: 'Website-Besuche pro Monat' })
  if (m.heimspieleSaison != null) kacheln.push({ wert: zahl(m.heimspieleSaison), label: 'Heimspiele pro Saison', sub: 'Kreisliga Stade' })
  if (!kacheln.length) return null
  const kontakte = m.zuschauerHeim != null && m.heimspieleSaison != null ? m.zuschauerHeim * m.heimspieleSaison : null
  const stand = standText(m.stand)
  return (
    <section id="zahlen" className="pt-sec" aria-labelledby="h-zahlen">
      <p className="pt-kicker">Mediadaten</p>
      <h2 className="pt-h2" id="h-zahlen">
        Die <em>Zahlen</em>
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

// ── Partner-Wand ────────────────────────────────────────────
const STUFEN: SponsorStufe[] = ['hauptpartner', 'partner', 'unterstuetzer']

function PartnerWand() {
  const alle = PARTNER_SPONSOREN
  return (
    <section id="partner-wand" className="pt-sec" aria-labelledby="h-wand">
      <p className="pt-kicker">Wer schon dabei ist</p>
      <h2 className="pt-h2" id="h-wand">
        Die <em>Partner-Wand</em>
      </h2>
      {alle.length === 0 ? (
        <div className="pt-wand-leer">
          <p className="pt-wand-leer__titel">Hier ist noch Platz für deinen Namen.</p>
          <p>Die Partner-Wand der neuen Saison füllt sich gerade. Wer jetzt einsteigt, steht ganz vorn — am Platz, online und auf Instagram.</p>
          <a className="pt-btn" href="#anfrage">
            Erster Partner werden
          </a>
        </div>
      ) : (
        <>
          <p className="pt-lead pt-lead--sm">Danke an alle, die den SVA möglich machen.</p>
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
                        <span>Dein Logo?</span>
                      </a>
                    </li>
                  )}
                </ul>
              </div>
            )
          })}
        </>
      )}
    </section>
  )
}

function LogoKachel({ name, logoUrl, url, klein }: { name: string; logoUrl?: string; url?: string; klein?: boolean }) {
  const inhalt = logoUrl ? (
    <img src={logoUrl} alt={name} loading="lazy" decoding="async" />
  ) : (
    <span className="pt-logo__name">{name}</span>
  )
  const cls = `pt-logo${klein ? ' pt-logo--klein' : ''}${logoUrl ? '' : ' pt-logo--text'}`
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
        Die <em>Pakete</em>
      </h2>
      <ul className="pt-pakete">
        {PARTNER_PAKETE.map((p) => {
          const plaetze = plaetzeText(p)
          const knapp = p.frei != null && p.frei > 0 && p.frei <= 2
          const voll = p.frei != null && p.frei <= 0
          return (
            <li key={p.id} className={`pt-paket${p.hervorgehoben ? ' is-top' : ''}${voll ? ' is-voll' : ''}`}>
              {p.hervorgehoben && <span className="pt-paket__band">Beliebt</span>}
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
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
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
        So <em>einfach</em> geht’s
      </h2>
      <ol className="pt-ablauf">
        {schritte.map(([t, s], i) => (
          <li key={t}>
            <b>{i + 1}</b>
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
