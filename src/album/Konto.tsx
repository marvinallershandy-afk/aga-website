import { useEffect, useState } from 'react'
import { AlbumFehler, abmelden, kontoLoeschen, type Mein } from './api'
import { EINWILLIGUNG_KEY } from './Login'
import { ProfilForm } from './Profil'

// ─────────────────────────────────────────────────────────────
// v17-A: Konto — Profil/Einwilligungen ändern, Abmelden, „Konto löschen“
// (RPC album_konto_loeschen: Album-Daten weg, Check-ins nur noch anonym).
// ─────────────────────────────────────────────────────────────

interface Props {
  mein: Mein
  onSchliessen: () => void
  onGespeichert: () => void
  onAbgemeldet: () => void
  onGeloescht: () => void
}

export function KontoDialog({ mein, onSchliessen, onGespeichert, onAbgemeldet, onGeloescht }: Props) {
  const [loeschen, setLoeschen] = useState<'nein' | 'frage' | 'laeuft'>('nein')
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onSchliessen()
    window.addEventListener('keydown', esc)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', esc)
    }
  }, [onSchliessen])

  const weg = async () => {
    setLoeschen('laeuft')
    setFehler('')
    try {
      await kontoLoeschen()
      try {
        localStorage.removeItem(EINWILLIGUNG_KEY)
        localStorage.removeItem('sva-album-c')
        localStorage.removeItem('sva-album-c-t')
      } catch {
        /* privat-Modus */
      }
      onGeloescht()
    } catch (e) {
      setFehler(e instanceof AlbumFehler ? e.message : 'Das hat nicht geklappt.')
      setLoeschen('frage')
    }
  }

  return (
    <div className="al-detail" role="dialog" aria-modal="true" aria-labelledby="h-konto" onClick={onSchliessen}>
      <div className="al-detail__panel al-konto" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="al-x" onClick={onSchliessen} aria-label="Schließen">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
        </button>
        <p className="al-kicker">{mein.email}</p>
        <h2 className="al-h2" id="h-konto">
          Dein Konto
        </h2>
        <p className="al-klein">
          {mein.checkinsGesamt} Check-ins insgesamt · {mein.besitz.reduce((a, b) => a + b.anzahl, 0)} Sticker
        </p>
        <ProfilForm profil={mein.profil} kompakt onGespeichert={onGespeichert} />
        <div className="al-konto__unten">
          <button
            type="button"
            className="al-btn al-btn--ghost"
            onClick={async () => {
              await abmelden()
              onAbgemeldet()
            }}
          >
            Abmelden
          </button>
          {loeschen === 'nein' ? (
            <button type="button" className="al-btn al-btn--warn" onClick={() => setLoeschen('frage')}>
              Konto löschen
            </button>
          ) : (
            <div className="al-hinweis al-hinweis--fehler" role="alert">
              <p>
                <b>Wirklich löschen?</b> Sticker, Gutscheine und dein Profil sind dann endgültig weg. Deine Check-ins zählen nur noch anonym in
                der Zuschauerzahl.
              </p>
              {fehler && <p>{fehler}</p>}
              <div className="al-pin__btns">
                <button type="button" className="al-btn al-btn--ghost" onClick={() => setLoeschen('nein')}>
                  Abbrechen
                </button>
                <button type="button" className="al-btn al-btn--warn" onClick={() => void weg()} disabled={loeschen === 'laeuft'}>
                  {loeschen === 'laeuft' ? 'Wird gelöscht …' : 'Endgültig löschen'}
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="al-klein">
          Was wir speichern und warum: <a href="/datenschutz#album">Datenschutz, Abschnitt Sammelalbum</a>
        </p>
      </div>
    </div>
  )
}
