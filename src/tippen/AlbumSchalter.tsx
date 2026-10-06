import { useEffect, useState } from 'react'
import { ladeAlbumStand, type AlbumStand, ALBUM_HREF } from './api'

// ─────────────────────────────────────────────────────────────
// v21-T: Umschalter „Album | Tipp-Liga“ im Kopf — gleicher Aufbau und
// gleiches Verhalten wie im Album-Kopf (src/album/AlbumApp.tsx „al-wechsel“):
// ein Segment, aktives Feld hell mit roter Unterkante; aktives Feld nochmal
// tippen = nach oben. Album-Feld zeigt den Fortschritt (z. B. 14/42) und
// einen roten Punkt mit der Zahl ungeöffneter Tütchen. Gleiches Konto.
// ─────────────────────────────────────────────────────────────

export function AlbumSchalter({ angemeldet }: { angemeldet: boolean }) {
  const [stand, setStand] = useState<AlbumStand | null>(null)
  useEffect(() => {
    if (!angemeldet) return
    let aktiv = true
    void ladeAlbumStand().then((s) => aktiv && setStand(s))
    return () => {
      aktiv = false
    }
  }, [angemeldet])
  return (
    <nav className="tp-wechsel" aria-label="Bereich">
      <a
        className="tp-wechsel__b"
        href={ALBUM_HREF}
        aria-label={stand ? `Sammelalbum: ${stand.belegt} von ${stand.gesamt} Karten${stand.tuetchen ? `, ${stand.tuetchen} ungeöffnete Tütchen` : ''}` : 'Sammelalbum'}
      >
        Album
        {angemeldet && stand && <small>{stand.belegt}/{stand.gesamt}</small>}
        {angemeldet && stand && stand.tuetchen > 0 && <b className="tp-wechsel__punkt">{stand.tuetchen}</b>}
      </a>
      <a
        className="tp-wechsel__b is-aktiv"
        href="/tippen"
        aria-current="page"
        onClick={(e) => {
          e.preventDefault()
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      >
        Tipp-Liga
      </a>
    </nav>
  )
}
