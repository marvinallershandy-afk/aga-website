// v19-K (Audit B §2.8): EINE Quelle für die Site-Domain.
//
// Der Livegang-Domain-Tausch passiert an GENAU dieser Stelle (bzw. per ENV
// SITE_ORIGIN im Netlify-Build) — scripts/fetch-content.mjs und
// scripts/prerender.mjs lesen beide von hier. prerender.mjs ersetzt im
// gebauten dist/ die Default-Domain durch SITE_ORIGIN (HTML-Köpfe,
// sitemap.xml, robots.txt), sodass ein einziger Wert reicht.
//
// Default = aktuelle Netlify-Adresse (wie in index.html/sitemap/robots).

export const DEFAULT_ORIGIN = 'https://sva-agathenburg-dollern.netlify.app'
export const SITE_ORIGIN = (process.env.SITE_ORIGIN || DEFAULT_ORIGIN).replace(/\/+$/, '')

// Vereins-/Platz-Stammdaten für strukturierte Daten (Fakten, bereits in
// index.html JSON-LD). Werden NICHT erfunden.
const CLUB_NAME = 'SV Agathenburg-Dollern'
const VENUE = {
  '@type': 'Place',
  name: 'Waldsportplatz Agathenburg',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Zur Mehrzweckhalle',
    postalCode: '21684',
    addressLocality: 'Agathenburg',
    addressCountry: 'DE',
  },
}

/**
 * SportsEvent-JSON-LD für kommende HEIMspiele (Audit B §2.8.3).
 * @param {{opponent:string, kickoff:string}[]} homeMatches  nur Heimspiele, mit ISO-Anstoß
 * @returns {object[]} SportsEvent-Objekte (leer, wenn keine Daten → nichts erfinden)
 */
export function buildSportsEvents(homeMatches) {
  const origin = SITE_ORIGIN
  return (Array.isArray(homeMatches) ? homeMatches : [])
    .filter((m) => m && typeof m.opponent === 'string' && m.opponent.trim() && typeof m.kickoff === 'string' && m.kickoff)
    .slice(0, 5)
    .map((m) => ({
      '@type': 'SportsEvent',
      name: `${CLUB_NAME} – ${m.opponent.trim()}`,
      sport: 'Fußball',
      startDate: m.kickoff,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      homeTeam: { '@type': 'SportsTeam', name: CLUB_NAME },
      awayTeam: { '@type': 'SportsTeam', name: m.opponent.trim() },
      location: VENUE,
      url: `${origin}/live`,
      organizer: { '@type': 'SportsOrganization', name: CLUB_NAME, url: `${origin}/` },
    }))
}

/** Fertiges <script>-Tag mit dem @graph der Events (oder '' wenn leer). */
export function sportsEventsScript(events) {
  if (!Array.isArray(events) || !events.length) return ''
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': events })
  return `<script type="application/ld+json">${json}</script>`
}
