import { Gift, Trophy } from 'lucide-react'
import type { Preis } from './api'
import { Kapitel } from './teile'
import './preise.css'

// ─────────────────────────────────────────────────────────────
// v22-T: „Das kannst du gewinnen“ — Preis-Treppe in der Rangliste
// (Saison Platz 1–5, Monatssieger). Pflege im Admin (Tipp-Liga →
// Kabine & Regeln → Preise). Leer = unsichtbar. Nüchterne Texte,
// Altersgrenze mit U18-Alternative, Hinweis auf die Teilnahmebedingungen.
// ─────────────────────────────────────────────────────────────

function Partner({ p }: { p: NonNullable<Preis['partner']> }) {
  const inhalt = (
    <>
      <span>präsentiert von</span>
      {p.logoUrl ? <img src={p.logoUrl} alt={p.name} height="18" loading="lazy" /> : <b>{p.name}</b>}
    </>
  )
  return p.url ? (
    <a className="tp-preis__partner" href={p.url} target="_blank" rel="sponsored noopener">
      {inhalt}
    </a>
  ) : (
    <span className="tp-preis__partner">{inhalt}</span>
  )
}

function Zeile({ p }: { p: Preis }) {
  return (
    <li className={`tp-preis is-p${p.platz}`}>
      <span className="tp-preis__platz" aria-label={`Platz ${p.platz}`}>
        {p.platz === 1 ? <Trophy size={16} strokeWidth={1.75} aria-hidden="true" /> : null}
        {p.platz}
      </span>
      <span className="tp-preis__text">
        <b>{p.titel}</b>
        {p.beschreibung && <small>{p.beschreibung}</small>}
        {p.abAlter && (
          <small className="tp-preis__alter">
            ab {p.abAlter} · unter {p.abAlter}: {p.alternative ?? 'Softdrink-Variante'}
          </small>
        )}
        {p.partner && <Partner p={p.partner} />}
      </span>
    </li>
  )
}

export function PreisTreppe({ preise, fokus }: { preise?: Preis[]; fokus: 'saison' | 'monat' }) {
  const saison = (preise ?? []).filter((p) => p.wertung === 'saison').sort((a, b) => a.platz - b.platz)
  const monat = (preise ?? []).filter((p) => p.wertung === 'monat').sort((a, b) => a.platz - b.platz)
  if (!saison.length && !monat.length) return null
  const bloecke = fokus === 'monat' ? (['monat', 'saison'] as const) : (['saison', 'monat'] as const)
  return (
    <section className="tp-abschnitt tp-preise" aria-labelledby="tp-h-preise">
      <Kapitel id="tp-h-preise" titel="Das kannst du gewinnen" meta="kostenlos mitspielen" />
      {bloecke.map((b) => {
        const liste = b === 'saison' ? saison : monat
        if (!liste.length) return null
        return (
          <div key={b} className={`tp-preise__block${b === fokus ? ' is-fokus' : ''}`}>
            <p className="tp-preise__titel">
              <Gift size={14} strokeWidth={1.75} aria-hidden="true" /> {b === 'saison' ? 'Saisonwertung' : liste.length === 1 ? 'Monatssieger' : 'Monatswertung'}
            </p>
            <ol className="tp-preise__treppe">
              {liste.map((p) => (
                <Zeile key={`${p.wertung}-${p.platz}`} p={p} />
              ))}
            </ol>
          </div>
        )
      })}
      <p className="tp-fussnote">
        Spieler-Konten (Kabine) sind von Preisen ausgeschlossen. Es gelten die <a href="/teilnahmebedingungen">Teilnahmebedingungen</a>.
      </p>
    </section>
  )
}
