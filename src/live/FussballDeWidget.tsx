import { useEffect, useId, useState } from 'react'
import type { LiveSettings } from './model'
import { Icon } from './icons'

// ─────────────────────────────────────────────────────────────
// v15-L: Offizielles fussball.de-Widget — Datenschutz zuerst.
// Es wird ERST nach Klick geladen (2-Klick-Lösung). Wir binden NICHT das
// fussball.de-Skript ein, sondern direkt das Widget-iFrame, das dieses Skript
// auch erzeugen würde (www.fussball.de/widget2/-/schluessel/<ID>/target/<div>/
// caller/<host>). Höhe kommt per postMessage („setHeight“) von fussball.de.
// So läuft kein fremdes JavaScript in unserer Seite.
// Ohne gepflegte Widget-ID: Links zu fussball.de bzw. FuPa.
// ─────────────────────────────────────────────────────────────

type Art = 'tabelle' | 'spielplan'

export function FussballDeWidget({ settings }: { settings: LiveSettings }) {
  const [aktiv, setAktiv] = useState<Art | null>(null)
  const teamUrl = settings.fussballDeTeamId ? `https://www.fussball.de/mannschaft/-/team-id/${settings.fussballDeTeamId}#!/` : 'https://www.fussball.de/'
  const hat = { tabelle: settings.widgetTabelle, spielplan: settings.widgetSpielplan }

  if (!hat.tabelle && !hat.spielplan) {
    return (
      <div className="lv-card lv-card--pad lv-fde">
        <p>Die aktuelle Tabelle findest du bei fussball.de{settings.fupaUrl ? ' und FuPa' : ''}.</p>
        <div className="lv-actions">
          <a className="lv-btn" href={teamUrl} target="_blank" rel="noreferrer">
            <Icon name="tabelle" /> fussball.de
          </a>
          {settings.fupaUrl && (
            <a className="lv-btn lv-btn--ghost" href={settings.fupaUrl} target="_blank" rel="noreferrer">
              FuPa
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="lv-card lv-card--pad lv-fde">
      {aktiv && hat[aktiv] ? (
        <>
          {hat.tabelle && hat.spielplan && (
            <div className="lv-seg" role="group" aria-label="fussball.de-Ansicht">
              <button type="button" aria-pressed={aktiv === 'tabelle'} onClick={() => setAktiv('tabelle')}>Tabelle</button>
              <button type="button" aria-pressed={aktiv === 'spielplan'} onClick={() => setAktiv('spielplan')}>Spielplan</button>
            </div>
          )}
          <WidgetFrame key={aktiv} widgetId={hat[aktiv]!} titel={aktiv === 'tabelle' ? 'Tabelle von fussball.de' : 'Spielplan von fussball.de'} />
          <p className="lv-klein">Quelle: fussball.de (DFB GmbH &amp; Co. KG)</p>
        </>
      ) : (
        <>
          <p>
            Die aktuelle Tabelle kommt direkt von <b>fussball.de</b>. Erst wenn du auf den Knopf tippst, wird sie von dort geladen — dabei
            werden Daten wie deine IP-Adresse an die DFB GmbH &amp; Co. KG übertragen.{' '}
            <a href="/datenschutz#fussball-de">Mehr im Datenschutz</a>.
          </p>
          <div className="lv-actions">
            {hat.tabelle && (
              <button type="button" className="lv-btn" onClick={() => setAktiv('tabelle')}>
                <Icon name="tabelle" /> Aktuelle Tabelle von fussball.de laden
              </button>
            )}
            {hat.spielplan && (
              <button type="button" className="lv-btn lv-btn--ghost" onClick={() => setAktiv('spielplan')}>
                Spielplan laden
              </button>
            )}
          </div>
          <p className="lv-klein">
            Oder direkt auf{' '}
            <a href={teamUrl} target="_blank" rel="noreferrer">
              fussball.de
            </a>
            {settings.fupaUrl && (
              <>
                {' '}/{' '}
                <a href={settings.fupaUrl} target="_blank" rel="noreferrer">
                  FuPa
                </a>
              </>
            )}
            .
          </p>
        </>
      )}
    </div>
  )
}

function WidgetFrame({ widgetId, titel }: { widgetId: string; titel: string }) {
  const raw = useId()
  const target = `fubade${raw.replace(/[^a-zA-Z0-9]/g, '')}`
  const [hoehe, setHoehe] = useState(640)
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (!/^https:\/\/(www\.)?fussball\.de$/.test(ev.origin)) return
      const d = ev.data as { type?: string; container?: string; value?: number | string } | null
      if (d && d.type === 'setHeight' && d.container === target) {
        const h = Number(d.value)
        if (Number.isFinite(h) && h > 100 && h < 6000) setHoehe(h)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [target])
  const src = `https://www.fussball.de/widget2/-/schluessel/${encodeURIComponent(widgetId)}/target/${target}/caller/${encodeURIComponent(window.location.hostname)}`
  return (
    <div id={target} className="lv-fde__frame">
      <iframe src={src} title={titel} width="100%" height={hoehe} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" style={{ border: 0 }} />
    </div>
  )
}
