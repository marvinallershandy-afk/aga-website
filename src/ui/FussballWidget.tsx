import { useEffect, useRef } from 'react'
import { CLUB } from '../data/club'

// fussball.de-Vereins-Widget, gestylt gerahmt. Solange die echte
// Team-ID Platzhalter ist, zeigen wir eine saubere Skelett-Tabelle,
// damit die Sektion gewollt wirkt statt leer/kaputt.
//
// So bindet Marvin das echte Widget ein:
//   1. Auf fussball.de → Verein → "Widget erstellen" die Tabelle wählen
//   2. Die generierte Team-Permanent-ID in src/data/club.ts eintragen
//   3. REAL_EMBED unten aktivieren (Script-Injection ist vorbereitet)

const IS_PLACEHOLDER = CLUB.fussballDeTeamId.startsWith('011MIABCDE')

const MOCK_TABLE = [
  { pos: 1, team: 'TuS Beispielstadt', sp: 18, pkt: 44 },
  { pos: 2, team: 'SV Musterdorf', sp: 18, pkt: 40 },
  { pos: 3, team: 'SV Agathenburg-Dollern', sp: 18, pkt: 37, self: true },
  { pos: 4, team: 'FC Nachbarort', sp: 18, pkt: 33 },
  { pos: 5, team: 'SG Beispieltal', sp: 18, pkt: 29 },
]

export function FussballWidget() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (IS_PLACEHOLDER || !hostRef.current) return
    // Echtes Widget: fussball.de-Script injizieren
    const s = document.createElement('script')
    s.src = `https://www.fussball.de/widget2/${CLUB.fussballDeTeamId}`
    s.async = true
    hostRef.current.appendChild(s)
  }, [])

  return (
    <div className="widget-frame">
      <div className="widget-frame__bar">
        <span className="widget-frame__dot" />
        Tabelle · Kreisliga · fussball.de
      </div>
      <div className="widget-frame__body" ref={hostRef}>
        {IS_PLACEHOLDER && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.66rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>#</th>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Team</th>
                <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>Sp</th>
                <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem' }}>Pkt</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_TABLE.map((r) => (
                <tr
                  key={r.pos}
                  style={{
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    background: r.self ? 'rgba(233,29,41,0.14)' : 'transparent',
                    color: r.self ? '#fff' : 'rgba(255,255,255,0.85)',
                    fontWeight: r.self ? 700 : 400,
                  }}
                >
                  <td style={{ padding: '0.55rem 0.5rem', color: r.self ? 'var(--gold)' : 'inherit' }}>{r.pos}</td>
                  <td style={{ padding: '0.55rem 0.5rem' }}>{r.team}</td>
                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'center' }}>{r.sp}</td>
                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'center' }}>{r.pkt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {IS_PLACEHOLDER && (
        <p className="widget-note">
          Platzhalter-Tabelle. Sobald die fussball.de-Vereins-ID eingetragen ist,
          erscheint hier die echte Live-Tabelle.
        </p>
      )}
    </div>
  )
}
