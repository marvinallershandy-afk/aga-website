import { useEffect, useState } from 'react'
import { ladeAlbumStand, type AlbumStand } from './api'

// ─────────────────────────────────────────────────────────────
// v21-T: Umschalter „Tipp-Liga | Album“ im Kopf — das Album ist immer
// einen Tipp entfernt. Album-Seite zeigt den Fortschritt (z. B. 14/42) und
// einen roten Punkt mit der Zahl ungeöffneter Tütchen. Gleiches Konto.
// (Den Rückweg im Album-Kopf baut das Album-Paket.)
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
    <nav className="tp-schalter2" aria-label="Tipp-Liga oder Sammelalbum">
      <span className="tp-schalter2__an" aria-current="page">
        Tipp-Liga
      </span>
      <a className="tp-schalter2__album" href="/album" aria-label={stand ? `Sammelalbum: ${stand.belegt} von ${stand.gesamt} Karten${stand.tuetchen ? `, ${stand.tuetchen} ungeöffnete Tütchen` : ''}` : 'Sammelalbum'}>
        Album
        {angemeldet && stand && (
          <small>
            {stand.belegt}/{stand.gesamt}
          </small>
        )}
        {angemeldet && stand && stand.tuetchen > 0 && <b className="tp-schalter2__punkt">{stand.tuetchen}</b>}
      </a>
    </nav>
  )
}
