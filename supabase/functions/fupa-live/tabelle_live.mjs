// ─────────────────────────────────────────────────────────────────────────────
// v23-L: Live-Tabelle aus den Spielständen rechnen (reine Funktion, getestet).
// Sicherung: nur zeigen, wenn die Rechnung VOR dem Spieltag mit der FuPa-Tabelle
// übereinstimmt (stimmtMitFupa) — lieber keine als eine falsche Tabelle.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Array} spiele  Liga-Spiele der Saison. Form je Spiel:
 *   { home:{slug,name}, away:{slug,name}, toreHeim, toreGast, section ('PRE'|'LIVE'|'POST'), kickoff }
 * @param {object} opt { abzug?: {slug: punkte}, svaSlug?: string, datum?: string (Spieltag-Datum) }
 * @returns {Array} [{platz, team, slug, sp, s, u, n, tore, gegen, diff, pkt, live, trend}]
 */
export function tabelleBerechnen(spiele, { abzug = {}, svaSlug = null, datum = null } = {}) {
  const jetzt = rechne(spiele, { abzug, zaehleLive: true })
  // Trend: Platzierung zu Spieltag-Beginn (nur POST-Spiele VOR datum)
  let vorSpieltag = null
  if (datum) {
    const vor = spiele.filter((s) => s.section === 'POST' && s.kickoff && new Date(s.kickoff) < new Date(datum))
    vorSpieltag = indexPlatz(rechne(vor, { abzug, zaehleLive: false }))
  }
  // laufende Teams markieren
  const liveSlugs = new Set()
  for (const s of spiele) {
    if (s.section === 'LIVE') { liveSlugs.add(s.home?.slug); liveSlugs.add(s.away?.slug) }
  }
  return jetzt.map((r) => ({
    ...r,
    live: liveSlugs.has(r.slug),
    self: svaSlug != null && r.slug === svaSlug,
    trend: vorSpieltag && vorSpieltag.has(r.slug) ? vorSpieltag.get(r.slug) - r.platz : 0,
  }))
}

function rechne(spiele, { abzug, zaehleLive }) {
  const t = new Map() // slug → row
  const hol = (team) => {
    const slug = team?.slug ?? team?.name ?? '?'
    if (!t.has(slug)) t.set(slug, { slug, team: team?.name ?? slug, sp: 0, s: 0, u: 0, n: 0, tore: 0, gegen: 0, pkt: 0 })
    return t.get(slug)
  }
  for (const sp of spiele) {
    const zaehlt = sp.section === 'POST' || (zaehleLive && sp.section === 'LIVE')
    if (!zaehlt) continue
    if (!Number.isFinite(sp.toreHeim) || !Number.isFinite(sp.toreGast)) continue
    const h = hol(sp.home)
    const a = hol(sp.away)
    h.sp++; a.sp++
    h.tore += sp.toreHeim; h.gegen += sp.toreGast
    a.tore += sp.toreGast; a.gegen += sp.toreHeim
    if (sp.toreHeim > sp.toreGast) { h.s++; a.n++; h.pkt += 3 }
    else if (sp.toreHeim < sp.toreGast) { a.s++; h.n++; a.pkt += 3 }
    else { h.u++; a.u++; h.pkt++; a.pkt++ }
  }
  const rows = [...t.values()].map((r) => ({ ...r, pkt: r.pkt - (abzug[r.slug] ?? 0), diff: r.tore - r.gegen }))
  rows.sort((x, y) => y.pkt - x.pkt || y.diff - x.diff || y.tore - x.tore || cmpName(x.team, y.team))
  return rows.map((r, i) => ({ platz: i + 1, team: r.team, slug: r.slug, sp: r.sp, s: r.s, u: r.u, n: r.n, tore: r.tore, gegen: r.gegen, diff: r.diff, pkt: r.pkt }))
}

function indexPlatz(rows) {
  const m = new Map()
  for (const r of rows) m.set(r.slug, r.platz)
  return m
}

function cmpName(a, b) { return String(a).localeCompare(String(b), 'de') }

/**
 * Stimmt die berechnete Tabelle (VOR dem Spieltag) mit der FuPa-Tabelle überein?
 * Vergleicht Platz, Punkte und Tore je Team (über slug bzw. Name).
 * @param {Array} berechnet  Ausgabe von tabelleBerechnen (vor dem Spieltag)
 * @param {Array} fupaStandings  [{rank, points, ownGoals, againstGoals, team:{slug,name}}]
 * @returns {boolean}
 */
export function stimmtMitFupa(berechnet, fupaStandings) {
  if (!Array.isArray(berechnet) || !Array.isArray(fupaStandings) || !fupaStandings.length) return false
  const fupa = new Map()
  for (const r of fupaStandings) {
    const slug = r.team?.slug ?? r.team?.name
    if (slug) fupa.set(slug, { rank: r.rank, points: r.points, tore: r.ownGoals, gegen: r.againstGoals })
  }
  if (fupa.size !== berechnet.length) return false
  for (const r of berechnet) {
    const f = fupa.get(r.slug) ?? fupa.get(r.team)
    if (!f) return false
    if (f.rank !== r.platz || f.points !== r.pkt || f.tore !== r.tore || f.gegen !== r.gegen) return false
  }
  return true
}
