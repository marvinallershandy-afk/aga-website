import { useId, useRef, useState } from 'react'
import { ImageUp, X } from 'lucide-react'
import { logoAusDatei, type Grund } from './logo'
import { setzeEntwurf, useEntwurf } from './entwurf'
import './bande.css'

// ─────────────────────────────────────────────────────────────
// v18-P: Eingabe des Banden-Entwurfs — Firmenname, optional Zeile 2 und
// Logo, Untergrund. Das Logo wird NUR im Browser gelesen (FileReader/
// Canvas), getrimmt und in der Sitzung gehalten. Kein Upload.
// ─────────────────────────────────────────────────────────────

const GRUENDE: { v: Grund | 'auto'; label: string }[] = [
  { v: 'auto', label: 'Auto' },
  { v: 'hell', label: 'Hell' },
  { v: 'dunkel', label: 'Dunkel' },
  { v: 'rot', label: 'Rot' },
]

export function EntwurfFelder({ kompakt, ohneGrund, onEingabe }: { kompakt?: boolean; ohneGrund?: boolean; onEingabe?: () => void }) {
  const e = useEntwurf()
  const id = useId()
  const datei = useRef<HTMLInputElement>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(false)

  const waehleDatei = async (f: File | undefined) => {
    if (!f) return
    setFehler(null)
    setLaedt(true)
    try {
      const { logo, dataUrl } = await logoAusDatei(f)
      setzeEntwurf({ logo, logoDataUrl: dataUrl, logoDatei: f.name })
      onEingabe?.()
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Das Logo ließ sich nicht lesen.')
    } finally {
      setLaedt(false)
      if (datei.current) datei.current.value = ''
    }
  }

  return (
    <div className={`bk-felder${kompakt ? ' bk-felder--kompakt' : ''}`}>
      <div className="bk-feld">
        <label htmlFor={`${id}-name`}>Firmenname</label>
        <input
          id={`${id}-name`}
          className="bk-input"
          data-bande-name
          type="text"
          maxLength={40}
          autoComplete="organization"
          placeholder="z. B. Bäckerei Muster"
          value={e.name}
          onFocus={onEingabe}
          onChange={(ev) => {
            setzeEntwurf({ name: ev.target.value })
            onEingabe?.()
          }}
        />
      </div>
      {!kompakt && (
        <div className="bk-feld">
          <label htmlFor={`${id}-z2`}>
            Zweite Zeile <small>optional</small>
          </label>
          <input
            id={`${id}-z2`}
            className="bk-input"
            type="text"
            maxLength={48}
            placeholder="z. B. Seit 1962 · in Agathenburg"
            value={e.zeile2}
            onChange={(ev) => setzeEntwurf({ zeile2: ev.target.value })}
          />
        </div>
      )}
      <div className="bk-feld">
        <span className="bk-feld__label" id={`${id}-logo`}>
          Logo <small>optional · PNG, JPG oder WebP</small>
        </span>
        <div className="bk-datei">
          <input
            ref={datei}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            data-bande-logo
            className="bk-datei__input"
            id={`${id}-datei`}
            aria-labelledby={`${id}-logo`}
            onChange={(ev) => void waehleDatei(ev.target.files?.[0])}
          />
          <label htmlFor={`${id}-datei`} className="bk-knopf bk-knopf--linie">
            <ImageUp size={16} strokeWidth={1.5} aria-hidden="true" />
            {laedt ? 'Wird gelesen …' : e.logoDataUrl ? 'Anderes Logo' : 'Logo wählen'}
          </label>
          {e.logoDataUrl && (
            <span className="bk-datei__name">
              <span>{e.logoDatei ?? 'Logo'}</span>
              <button type="button" className="bk-x" onClick={() => setzeEntwurf({ logoDataUrl: null, logoDatei: null })} aria-label="Logo entfernen">
                <X size={14} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </span>
          )}
        </div>
        {fehler && (
          <p className="bk-fehler" role="alert">
            {fehler}
          </p>
        )}
      </div>
      {!ohneGrund && (
        <fieldset className="bk-feld bk-grund">
          <legend>Untergrund</legend>
          <div className="bk-seg" role="radiogroup">
            {GRUENDE.map((g) => (
              <label key={g.v} className="bk-seg__opt">
                <input type="radio" name={`${id}-grund`} value={g.v} checked={e.grund === g.v} onChange={() => setzeEntwurf({ grund: g.v })} />
                <span>{g.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <p className="bk-hinweis">Dein Logo bleibt auf deinem Gerät — hochgeladen wird nichts.</p>
    </div>
  )
}
