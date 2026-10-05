import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { CONTACT, whatsappUrl, whatsappReady } from '../data/content'
import { useStore } from '../store/useStore'
import { PARTNER_SPONSOREN } from '../data/partner'
import { BANDE_SLOTS, BANDE_SPONSOREN, FREIER_SLOT, fokusZuSlot, slotZuFokus } from '../data/bandeLayout'
import { EntwurfFelder } from '../partner/bande/EntwurfFelder'
import { PartnerTafel } from '../partner/bande/PartnerTafel'
import { entwurfAktiv, useEntwurf } from '../partner/bande/entwurf'
import '../partner/bande/bande.css'

// ─────────────────────────────────────────────────────────────
// Sponsoren-Station (Partner-Panel der Karte + Rundgang).
// v18-P: „Diese Bande sucht dich" als Konfigurator: Firmenname + optional
// Logo → erscheint sofort auf der freien 3D-Tafel, die Kamera fährt hin.
// Danach: „So sieht's am Spieltag aus" (Foto, /partner) oder direkt mit dem
// Entwurf anfragen. Partner erscheinen als ihre Bandentafel (gleiche
// Zeichnung wie in 3D).
// ─────────────────────────────────────────────────────────────

const reveal = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
}

const MAIL_SUBJECT = 'Sponsoring / Bande beim SV Agathenburg-Dollern'
const DIREKT_TEXT = 'Hallo SV Agathenburg-Dollern! Ich interessiere mich für eine Bande / ein Sponsoring. Erzählt mir mehr?'

/** Banden-Navigation: fährt die Kamera von Tafel zu Tafel (Lesereihenfolge). */
function BandeNav() {
  const focus = useStore((s) => s.sponsorFocus)
  const setFocus = useStore((s) => s.setSponsorFocus)
  const e = useEntwurf()
  const slot = fokusZuSlot(focus)
  const geh = (d: number) => setFocus(slotZuFokus((slot + d + BANDE_SLOTS) % BANDE_SLOTS))
  const sponsor = BANDE_SPONSOREN[slot]
  // v19-K (Audit A §2.2.1): Bei freien Tafeln NICHT den Claim der 3D-Tafel
  // (LEER_CLAIMS) wiederholen — der stand sonst als DOM-Label exakt über dem
  // identischen Text der 3D-Bande („Doppeltext", wirkte wie Rendering-Fehler).
  // Freie Tafel = neutrales Label, die Freigabe steht in der Sub-Zeile.
  const titel = sponsor
    ? sponsor.name
    : slot === FREIER_SLOT && entwurfAktiv(e)
      ? e.name.trim() || 'Dein Entwurf'
      : 'Freie Bande'
  return (
    <div className="bk-nav">
      <button type="button" className="bk-nav__pfeil" onClick={() => geh(-1)} aria-label="Tafel links">
        <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <div className="bk-nav__mitte" aria-live="polite">
        <span className="bk-nav__titel">{titel}</span>
        <span className="bk-nav__sub">
          Tafel {slot + 1} von {BANDE_SLOTS} · {sponsor ? 'Partner' : slot === FREIER_SLOT && entwurfAktiv(e) ? <b>dein Entwurf</b> : 'noch frei'}
        </span>
      </div>
      <button type="button" className="bk-nav__pfeil" onClick={() => geh(1)} aria-label="Tafel rechts">
        <ChevronRight size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  )
}

export function SponsorPitch({ variante = 'panel' }: { variante?: 'panel' | 'rundgang' }) {
  const setFocus = useStore((s) => s.setSponsorFocus)
  const e = useEntwurf()
  const aktiv = entwurfAktiv(e)
  // Eingabe → Kamera auf die freie Tafel, auf der der Entwurf hängt
  const zurFreienTafel = () => {
    const f = slotZuFokus(FREIER_SLOT)
    if (useStore.getState().sponsorFocus !== f) setFocus(f)
  }
  return (
    <motion.div className={`bk-pitch bk-pitch--${variante}`} {...reveal}>
      <BandeNav />
      <div className="bk-box">
        <div className="bk-box__kopf">
          <p className="bk-kicker">Diese Bande sucht dich</p>
          <h3 className="bk-titel">Wie sähe deine Bande aus?</h3>
        </div>
        <EntwurfFelder kompakt ohneGrund={variante === 'rundgang'} onEingabe={zurFreienTafel} />
        <div className="bk-actions">
          {aktiv && (
            <a className="bk-knopf bk-knopf--rot" href="/partner?entwurf=1#anfrage">
              Mit diesem Entwurf anfragen
            </a>
          )}
          <a className={`bk-knopf ${aktiv ? 'bk-knopf--linie' : 'bk-knopf--rot'}`} href="/partner#deine-bande">
            So sieht’s am Spieltag aus
          </a>
        </div>
      </div>
      <p className="bk-direkt">
        Lieber direkt?{' '}
        <a href={whatsappReady ? whatsappUrl(DIREKT_TEXT) : `mailto:${CONTACT.email}?subject=${encodeURIComponent(MAIL_SUBJECT)}`} target={whatsappReady ? '_blank' : undefined} rel={whatsappReady ? 'noreferrer' : undefined}>
          {whatsappReady ? 'WhatsApp' : CONTACT.email}
        </a>{' '}
        · <a href="/partner">Alle Pakete &amp; Zahlen</a>
      </p>
      <PartnerLeiste />
    </motion.div>
  )
}

/** „Schon dabei" — jeder Partner als seine Bandentafel. */
function PartnerLeiste() {
  const liste = PARTNER_SPONSOREN.slice(0, 6)
  if (!liste.length) return null
  return (
    <div className="bk-leiste">
      <span className="bk-leiste__label">Schon dabei</span>
      <ul className="bk-leiste__tafeln">
        {liste.map((s) => (
          <li key={s.name}>
            {s.url ? (
              <a href={s.url} target="_blank" rel="sponsored noopener" title={s.name}>
                <PartnerTafel name={s.name} logoUrl={s.logoUrl} breite={480} />
              </a>
            ) : (
              <PartnerTafel name={s.name} logoUrl={s.logoUrl} breite={480} />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
