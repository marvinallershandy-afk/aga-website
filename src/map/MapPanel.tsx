import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { CONTACT, whatsappUrl, whatsappReady } from '../data/content'
import { PLACE_BY_ID, type PlaceId } from './places'
import { closePlace, openPlace } from './nav'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { TrainingMedia } from './TrainingMedia'
import { GALERIEN } from '../data/galerie'
// v17-D: Galerie erst laden, wenn das Fans-Panel aufgeht (eigene CSS — nicht
// auf dem kritischen Pfad der Startseite)
const GalerieView = lazy(() => import('../galerie/GalerieView').then((m) => ({ default: m.GalerieView })))
import { PLACE_LEAD } from './panelText'
import { useMatchStatus } from './matchStatus'
import { FussballWidget } from '../ui/FussballWidget'
import { TacticsBoard } from '../ui/TacticsBoard'
import { PlayerGallery } from '../ui/PlayerGallery'
import { FanGallery } from '../ui/FanGallery'
import { FanChantToggle } from '../ui/FanChantToggle'
import { MusicSectionPlayer } from '../ui/MusicSection'
import { AlbumTeaser } from '../ui/AlbumTeaser'
import { SponsorPitch } from '../ui/SponsorsStrip'
import { PlatzFinden } from '../ui/PlatzFinden'
import { WaIcon, IgIcon, MailIcon } from '../ui/Icons'
// v18-A: Kalender-Abo + Probetraining-Assistent (src/alltag/)
import { KalenderKnopf } from '../alltag/Kalender'
import { ProbetrainingKnopf } from '../alltag/Probetraining'
import { AlltagFuss } from '../alltag/Fuss'

// ─────────────────────────────────────────────────────────────
// v16-K: Orts-Panel der Karte. Desktop: Karte/Drawer rechts, mobil:
// Bottom-Sheet (64 % Höhe, nach unten wischen schließt). Inhalt = die
// bestehenden Bausteine des Onepagers (Cockpit, Taktik-Board, Fotos,
// Album, Banden-Pitch, Platz-Finden) statt neuer Kopien.
// Zurück zur Karte: Esc · Wischen · Knopf · Browser-Zurück.
// ─────────────────────────────────────────────────────────────

function mapsDir(dest: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`
}

function WaButton({ text, label }: { text: string; label: string }) {
  return (
    <a
      className={whatsappReady ? 'btn btn--wa' : 'btn btn--primary'}
      href={whatsappUrl(text)}
      target={whatsappReady ? '_blank' : undefined}
      rel={whatsappReady ? 'noreferrer' : undefined}
    >
      {whatsappReady ? <WaIcon size={18} /> : <MailIcon size={18} />}
      {whatsappReady ? label : `${label} (E-Mail)`}
    </a>
  )
}

function SpieltagBody() {
  const ms = useMatchStatus()
  return (
    <>
      <a className={`kp-live${ms.state === 'live' ? ' is-live' : ''}`} href="/live">
        <span className="kp-live__dot" aria-hidden="true" />
        <span>
          <b>{ms.state === 'live' ? ms.line : 'Live-Ticker & Spieltag'}</b>
          <small>{ms.state === 'live' ? 'Jetzt mitfiebern' : ms.long}</small>
        </span>
        <ArrowRight size={20} strokeWidth={1.5} aria-hidden="true" />
      </a>
      <KalenderKnopf variante="zeile" adresse={CONTACT.address} />
      <FussballWidget />
    </>
  )
}

function TrainingBody() {
  const ort = CONTACT.trainingOrt
  return (
    <>
      <dl className="kp-facts">
        <div>
          <dt>Wann</dt>
          <dd>{CONTACT.training}</dd>
        </div>
        {ort && (
          <div>
            <dt>Wo</dt>
            <dd>
              {ort}
              <small>Achtung: Trainiert wird an der B73, nicht am Waldsportplatz.</small>
            </dd>
          </div>
        )}
      </dl>
      <div className="kp-actions">
        <ProbetrainingKnopf className="btn btn--primary" icon={false} />
        {ort && (
          <a className="btn btn--ghost" href={mapsDir(ort)} target="_blank" rel="noreferrer">
            Route zum Trainingsplatz
          </a>
        )}
      </div>
      <p className="kp-note">
        Auch für Wiedereinsteiger: Wer seit Jahren nicht gespielt hat, ist bei uns genau richtig. Bring Schuhe und
        Lust mit, den Rest klären wir am Platz.
      </p>
      <div className="kp-card">
        <b>Unter 18?</b>
        <p>Für Jugendliche gibt’s eigene Teams und Trainer. Schreib uns kurz, wir verbinden dich mit der Jugend.</p>
        <ProbetrainingKnopf className="btn btn--ghost btn--sm" label="Jugend kontaktieren" mannschaft="jugend" icon={false} />
      </div>
    </>
  )
}

function MannschaftBody() {
  const [gallery, setGallery] = useState(false)
  return (
    <>
      <TacticsBoard fluid />
      <div className="kp-actions">
        <button className="btn btn--primary" onClick={() => setGallery(true)}>
          Alle Spieler
        </button>
        <button className="btn btn--ghost" onClick={() => openPlace('training')}>
          Selber kicken?
          <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <PlayerGallery open={gallery} onClose={() => setGallery(false)} />
    </>
  )
}

function FansBody() {
  const g = GALERIEN[0]
  return (
    <>
      {/* v17-D: „Spieltag in Bildern“ — die neueste Galerie der Vereinsfotografin */}
      {g && (
        <Suspense fallback={<div className="kp-media" aria-hidden="true" />}>
          <GalerieView galerie={g} variant="panel" moreHref="/galerie" />
        </Suspense>
      )}
      <FanGallery />
      <FanChantToggle />
      {/* v18-P: Zugang zum Sammelalbum (QR-Check-in bei Heimspielen) */}
      <AlbumTeaser />
      <div className="kp-actions">
        <button className="btn btn--primary" onClick={() => openPlace('spieltag')}>
          Nächstes Spiel ansehen
        </button>
      </div>
    </>
  )
}

function PartnerBody() {
  // v18-P: Logos erscheinen jetzt als Bandentafeln in „Schon dabei"
  // (SponsorPitch) — vorher weiße Silhouetten ohne Farbe.
  return (
    <>
      <SponsorPitch />
      <a className="kp-cta" href="/partner">
        <span>
          <b>Partner werden</b>
          <small>Pakete, Reichweite, Bande, Trikot & Story</small>
        </span>
        <ArrowRight size={20} strokeWidth={1.5} aria-hidden="true" />
      </a>
    </>
  )
}

function AnfahrtBody() {
  return (
    <>
      <PlatzFinden />
      <dl className="kp-facts">
        <div>
          <dt>Spielort</dt>
          <dd>{CONTACT.address}</dd>
        </div>
        {CONTACT.trainingOrt && (
          <div>
            <dt>Training</dt>
            <dd>
              {CONTACT.training}
              <small>{CONTACT.trainingOrt}</small>
            </dd>
          </div>
        )}
        <div>
          <dt>E-Mail</dt>
          <dd>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          </dd>
        </div>
      </dl>
      <div className="kp-actions">
        <WaButton text="Hallo SV Agathenburg-Dollern! Ich habe eine Frage." label="WhatsApp schreiben" />
        <a className="btn btn--ig" href={CONTACT.instagramUrl} target="_blank" rel="noreferrer">
          <IgIcon size={18} />
          {CONTACT.instagram}
        </a>
      </div>
      <AlltagFuss />
      <p className="kp-legal">
        <a href="/impressum.html">Impressum</a> · <a href="/datenschutz.html">Datenschutz</a>
      </p>
    </>
  )
}

function Body({ id }: { id: PlaceId }) {
  switch (id) {
    case 'spieltag':
      return <SpieltagBody />
    case 'training':
      return <TrainingBody />
    case 'mannschaft':
      return <MannschaftBody />
    case 'fans':
      return <FansBody />
    case 'musik':
      // v18-P: am Vereinsheim gibt's das Freibier — Album-Zugang dazu
      return (
        <>
          <MusicSectionPlayer />
          <AlbumTeaser />
        </>
      )
    case 'partner':
      return <PartnerBody />
    case 'anfahrt':
      return <AnfahrtBody />
  }
}

export function MapPanel() {
  const place = useStore((s) => s.place)
  const mode = useStore((s) => s.mode)
  const open = mode === 'map' && !!place
  // Inhalt bleibt während der Schließ-Animation (und danach, unsichtbar) stehen
  const [shown, setShown] = useState<PlaceId | null>(place)
  if (place && place !== shown) setShown(place)
  const panelRef = useRef<HTMLElement>(null)
  const headRef = useRef<HTMLHeadingElement>(null)
  const drag = useRef<{ y0: number; t0: number; dy: number } | null>(null)

  // Fokus ins Panel (Tastatur/Screenreader), Scroll an den Anfang
  useEffect(() => {
    if (!open) return
    const body = panelRef.current?.querySelector('.kpanel__body')
    if (body) body.scrollTop = 0
    const t = window.setTimeout(() => headRef.current?.focus({ preventScroll: true }), 60)
    return () => window.clearTimeout(t)
  }, [open, place])

  // Esc → zurück zur Karte (außer ein Modal/Lightbox/Galerie liegt oben)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const s = useStore.getState()
      if (s.selectedPlayer || s.fanPhoto != null || document.querySelector('.pgal, .glb-lb')) return
      closePlace()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const p = shown ? PLACE_BY_ID[shown] : null

  // Bottom-Sheet: am Griff/Kopf nach unten wischen schließt
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    drag.current = { y0: e.clientY, t0: performance.now(), dy: 0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    const el = panelRef.current
    if (!d || !el) return
    d.dy = Math.max(0, e.clientY - d.y0)
    el.style.transition = 'none'
    el.style.transform = `translateY(${d.dy}px)`
  }
  const onPointerUp = () => {
    const d = drag.current
    const el = panelRef.current
    drag.current = null
    if (!d || !el) return
    el.style.transition = ''
    el.style.transform = ''
    const v = d.dy / Math.max(1, performance.now() - d.t0)
    if (d.dy > 90 || (d.dy > 24 && v > 0.6)) closePlace()
  }

  return (
    <aside
      ref={panelRef}
      className="kpanel"
      data-open={open || undefined}
      aria-hidden={!open}
      aria-labelledby={p ? `kpanel-title-${p.id}` : undefined}
      inert={!open}
    >
      {p && (
        <>
          <div
            className="kpanel__head"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <span className="kpanel__grip" aria-hidden="true" />
            <div className="kpanel__titles">
              <span className="kpanel__kicker">{p.kicker}</span>
              <h2 id={`kpanel-title-${p.id}`} ref={headRef} tabIndex={-1} className="kpanel__title">
                {p.title}
              </h2>
            </div>
            <button className="kpanel__close" onClick={() => closePlace()} aria-label="Zurück zur Karte">
              <X size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
          <div className="kpanel__body">
            {p.id === 'training' && <TrainingMedia active={open} />}
            <p className="kpanel__lead">{PLACE_LEAD[p.id]}</p>
            <Body id={p.id} />
            <button className="kpanel__back" onClick={() => closePlace()}>
              <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
              Zurück zur Karte
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
