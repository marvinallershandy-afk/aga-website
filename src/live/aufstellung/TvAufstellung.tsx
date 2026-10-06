import { useMemo } from 'react'
import './tv.css'
import type { LiveData } from '../model'
import { ausLiveDaten, plattenSchrift, proj, type AufstellungGrafik, type GrafikSlot, type GrafikSpieler } from './daten'

// ─────────────────────────────────────────────────────────────
// v17-G: Aufstellung im TV-Stil (Sky/DAZN-Optik) für /live — ersetzt die
// 3D-Aufstellung. Ruhig, edel, Rot-Schwarz-Weiß, Anton/Archivo:
//   · Kopf: Wappen, „Aufstellung“, Paarung, Formation
//   · Spielfeld in leichter Perspektive, Startelf als Freisteller-Brustbilder
//     (Kopf ragt aus dem Kreis), Nummer + Nachname, Kapitänsbinde, Karten,
//     Tore (Ball + Minute), Eingewechselte (▲ Minute, „für …“)
//   · Bank (Ausgewechselte mit ▼ Minute), Trainer, „präsentiert von“
// Immer 11 Positionen (fehlende Daten → „N. N.“), siehe daten.ts.
// Kein three.js, keine Videos: Brustbilder sind normale WebP (lazy).
// ─────────────────────────────────────────────────────────────

export function TvAufstellung({ data }: { data: LiveData }) {
  const g = useMemo(() => ausLiveDaten(data), [data])
  if (!g) {
    return (
      <div className="lv-card lv-card--pad lv-leer">
        <p>Die Aufstellung folgt — meist etwa eine Stunde vor Anpfiff.</p>
      </div>
    )
  }
  return <TvGrafik g={g} geplant={data.match?.status === 'geplant'} status={data.match?.status} />
}

export function TvGrafik({ g, geplant = false, status }: { g: AufstellungGrafik; geplant?: boolean; status?: string }) {
  const paarung = g.kopf.gegner ? (g.kopf.heim ? `SVA – ${g.kopf.gegner}` : `${g.kopf.gegner} – SVA`) : 'SV Agathenburg-Dollern'
  // v25 Befund 6: Label an den Spielstatus koppeln (TV-Grafik-Anspruch).
  //   geplant → „Voraussichtliche Elf“ · ab Anpfiff → „Startelf“ ·
  //   nach Wechseln → „Aufstellung · n Wechsel“.
  const wechsel = g.bank.filter((b) => b.raus != null).length
  const laeuft = status != null && status !== 'geplant'
  const kicker = !laeuft ? (g.vorlaeufig ? 'Voraussichtliche Elf' : g.kopf.titel) : wechsel > 0 ? `Aufstellung · ${wechsel} Wechsel` : 'Startelf'
  return (
    <figure className="tv" aria-label={`${kicker} ${g.formation}`}>
      <header className="tv-kopf">
        <img className="tv-kopf__wappen" src="/brand/wappen.png" alt="" width="44" height="44" />
        <div className="tv-kopf__txt">
          <span className="tv-kopf__kicker">{kicker}</span>
          <b className="tv-kopf__titel">
            <span>{paarung}</span>
            {g.kopf.stand && <em>{g.kopf.stand}</em>}
          </b>
          {g.kopf.zeile && <small className="tv-kopf__zeile">{g.kopf.zeile}</small>}
        </div>
        <span className="tv-kopf__formation" aria-label={`Formation ${g.formation}`}>
          {g.formation}
        </span>
      </header>
      {g.vorlaeufig && geplant && <p className="tv-hinweis">Zuletzt gespeicherte Elf — noch nicht für dieses Spiel bestätigt.</p>}

      <div className="tv-feld">
        <Spielfeld />
        <ol className="tv-elf" aria-label="Startelf">
          {g.slots.map((s, i) => (
            <SlotFigur key={i} s={s} />
          ))}
        </ol>
      </div>

      {g.bank.length > 0 && (
        <section className="tv-zeile" aria-label="Bank">
          <h3 className="tv-label">Bank</h3>
          <ul className="tv-bank">
            {g.bank.map(({ spieler: p, raus }) => (
              <li key={p.id} className={raus ? 'is-raus' : undefined}>
                <MiniBild p={p} />
                <span className="tv-bank__txt">
                  {p.number != null && <b>{p.number}</b>}
                  <span>{p.nachname}</span>
                  {raus && (
                    <em className="tv-raus" aria-label={`ausgewechselt ${raus}`}>
                      ▼ {raus}
                    </em>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {g.trainer.length > 0 && (
        <section className="tv-zeile tv-zeile--trainer" aria-label="Trainer">
          <h3 className="tv-label">Trainer</h3>
          <p className="tv-trainer">
            {g.trainer.map((t, i) => (
              <span key={i}>
                <b>{t.name}</b>
                {t.rolle !== 'Trainer' && <small> {t.rolle}</small>}
              </span>
            ))}
          </p>
        </section>
      )}
      {g.partner && (
        <footer className="tv-partner">
          <span>präsentiert von</span>
          {g.partner.logoUrl ? <img src={g.partner.logoUrl} alt={g.partner.name} height="26" loading="lazy" /> : <b>{g.partner.name}</b>}
        </footer>
      )}
      {g.luecken > 0 && <p className="tv-hinweis tv-hinweis--klein">N. N. = Spieler nicht im Kader gefunden.</p>}
    </figure>
  )
}

function SlotFigur({ s }: { s: GrafikSlot }) {
  const p = s.spieler
  const fs = plattenSchrift(p?.nachname ?? 'N. N.', p?.number != null)
  const label = p
    ? `${p.name}${p.number != null ? `, Nummer ${p.number}` : ''}${p.kapitaen ? ', Kapitän' : ''}${s.rein ? `, eingewechselt ${s.rein}${s.fuer ? ` für ${s.fuer}` : ''}` : ''}${s.tore.length ? `, Tor ${s.tore.join(', ')}` : ''}${s.karte ? `, ${s.karte === 'rot' ? 'Rote' : 'Gelbe'} Karte` : ''}`
    : 'Position nicht besetzt'
  return (
    <li
      className={`tv-sp${p?.kapitaen ? ' is-c' : ''}${s.rein ? ' is-rein' : ''}${p ? '' : ' is-nn'}`}
      data-role={s.role}
      style={{ left: `${s.x}%`, top: `${s.y}%`, zIndex: Math.round(s.y), ['--k' as string]: s.k.toFixed(3) }}
      aria-label={label}
    >
      <span className="tv-bust" aria-hidden="true">
        <span className="tv-bust__bg" />
        {p?.bild ? (
          <span className={p.freisteller ? 'tv-bust__clip' : 'tv-bust__clip tv-bust__clip--foto'}>
            <img src={p.bild} alt="" loading="lazy" decoding="async" draggable={false} />
          </span>
        ) : (
          <span className="tv-bust__leer">{p?.number ?? '?'}</span>
        )}
        {p?.kapitaen && <i className="tv-c">C</i>}
        {s.karte && <i className={`tv-karte tv-karte--${s.karte}`} />}
      </span>
      <span className="tv-plate" aria-hidden="true" style={{ fontSize: `calc(var(--d) * ${fs.toFixed(3)})` }}>
        {p?.number != null && <b>{p.number}</b>}
        <span>{p?.nachname ?? 'N. N.'}</span>
      </span>
      {(s.tore.length > 0 || s.rein) && (
        <span className="tv-marken" aria-hidden="true">
          {s.tore.length > 0 && (
            <span className="tv-tor">
              <Ball /> {s.tore.join(' ')}
            </span>
          )}
          {s.rein && <span className="tv-rein">▲ {s.rein}</span>}
        </span>
      )}
    </li>
  )
}

function MiniBild({ p }: { p: GrafikSpieler }) {
  return (
    <span className="tv-mini" aria-hidden="true">
      {p.bild ? <img className={p.freisteller ? undefined : 'is-foto'} src={p.bild} alt="" loading="lazy" decoding="async" /> : <i>{p.number ?? ''}</i>}
    </span>
  )
}

export function Ball() {
  return (
    <svg className="tv-ball" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="#fff" stroke="#111" strokeWidth="1.2" />
      <path d="M12 7.2l3.6 2.6-1.4 4.2H9.8L8.4 9.8z" fill="#111" />
      <path d="M12 1.6v5.6M15.6 9.8l5-1.6M14.2 14l3 4.4M9.8 14l-3 4.4M8.4 9.8l-5-1.6" stroke="#111" strokeWidth="1.1" fill="none" />
    </svg>
  )
}

// ── Spielfeld (SVG in Box-Prozent, Linien mit fester Strichstärke) ──
const L = 105
const W2 = 34
const pt = (xm: number, ym: number) => proj(xm / W2, ym / L)
const poly = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
const rect = (x0: number, x1: number, y0: number, y1: number) => poly([pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)])
function arc(cxm: number, cym: number, r: number, a0: number, a1: number, n = 32) {
  const out: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push(pt(cxm + Math.cos(a) * r, cym + Math.sin(a) * r))
  }
  return poly(out)
}

export function Spielfeld() {
  const stripes = Array.from({ length: 12 }, (_, i) => rect(-W2, W2, (i * L) / 12, ((i + 1) * L) / 12))
  const arcA = Math.asin((16.5 - 11) / 9.15)
  return (
    <svg className="tv-pitch" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="tv-gras" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#101611" />
          <stop offset="1" stopColor="#18241a" />
        </linearGradient>
        <radialGradient id="tv-licht" cx="0.5" cy="0.55" r="0.7">
          <stop offset="0" stopColor="rgba(255,255,255,0.07)" />
          <stop offset="1" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <polygon points={rect(-W2 - 4, W2 + 4, -5, L + 4)} fill="url(#tv-gras)" />
      {stripes.map((p, i) => (i % 2 ? <polygon key={i} points={p} fill="rgba(255,255,255,0.022)" /> : null))}
      <polygon points={rect(-W2 - 4, W2 + 4, -5, L + 4)} fill="url(#tv-licht)" />
      <g fill="none" stroke="rgba(255,255,255,0.26)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinejoin="round">
        <polygon points={rect(-W2, W2, 0, L)} vectorEffect="non-scaling-stroke" />
        <polyline points={poly([pt(-W2, L / 2), pt(W2, L / 2)])} vectorEffect="non-scaling-stroke" />
        <polygon points={arc(0, L / 2, 9.15, 0, Math.PI * 2, 56)} vectorEffect="non-scaling-stroke" />
        <polygon points={rect(-20.16, 20.16, 0, 16.5)} vectorEffect="non-scaling-stroke" />
        <polygon points={rect(-9.16, 9.16, 0, 5.5)} vectorEffect="non-scaling-stroke" />
        <polyline points={arc(0, 11, 9.15, arcA, Math.PI - arcA)} vectorEffect="non-scaling-stroke" />
        <polygon points={rect(-20.16, 20.16, L - 16.5, L)} vectorEffect="non-scaling-stroke" />
        <polygon points={rect(-9.16, 9.16, L - 5.5, L)} vectorEffect="non-scaling-stroke" />
        <polyline points={arc(0, L - 11, 9.15, Math.PI + arcA, Math.PI * 2 - arcA)} vectorEffect="non-scaling-stroke" />
      </g>
      {/* roter Akzent an der eigenen Torlinie */}
      <polyline points={poly([pt(-W2, 0), pt(W2, 0)])} fill="none" stroke="rgba(233,29,41,0.75)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

