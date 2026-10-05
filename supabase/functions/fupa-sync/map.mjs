// ─────────────────────────────────────────────────────────────────────────────
// v19-B: FuPa-Abgleich — reine Abbildung FuPa-API → sm_spiele / sm_tabelle.
//
// Bewusst dependency-freies, plattformneutrales ESM-Modul: wird sowohl von der
// Deno-Edge-Function (index.ts) als auch vom Node-Unit-Test
// (supabase/tests/fupa_map.test.mjs) importiert. KEINE Deno-/Node-APIs hier.
//
// Quelle (öffentliche FuPa-API, Marvin hat die Übernahme ausdrücklich erlaubt):
//   GET https://api.fupa.net/v1/teams/<slug>/matches?flavor=current&limit=60
//   GET https://api.fupa.net/v1/teams/<slug>/matches?flavor=past&limit=60
//   GET https://api.fupa.net/v1/standings?competition=<comp>&season=<season>&type=total
//
// Die Abbildung folgt exakt dem bisherigen manuellen Import (SpielEditor):
//   · Testspiele ('Testspiele' / category 'testmatch') werden ausgelassen.
//   · Idempotenz über notizen = 'fupa:<id>' (Update statt Delete, damit die
//     sm_spiele.id stabil bleibt — sva_ticker/sva_lineup/Album-Codes hängen per
//     FK daran).
//   · Gegnername mit Teamstufe: level 2 → „… II", level 3 → „… III".
//   · ort = 'Waldsportplatz Agathenburg' bei Heimspiel.
//   · spieltag_nr = round.number NUR bei Liga.
//   · tore nur bei section 'POST'; status 'beendet' bei POST mit Toren, sonst 'geplant'.
// ─────────────────────────────────────────────────────────────────────────────

export const HEIMSPIELORT = 'Waldsportplatz Agathenburg'

/** Teamstufen-Suffix wie im manuellen Import: 1 → „", 2 → „ II", 3 → „ III". */
export function stufenSuffix(level) {
  if (level === 2) return ' II'
  if (level === 3) return ' III'
  return ''
}

/**
 * Konfiguration aus sva_settings.fupa_url ableiten.
 * fupa_url = https://www.fupa.net/team/sv-agathenburg-dollern-m1-2026-27
 *   → teamSlug   = 'sv-agathenburg-dollern-m1-2026-27'
 *   → clubSlug   = 'sv-agathenburg-dollern'   (Suffix „-m<n>-<saison>" entfernt)
 *   → seasonSlug = '2026-27'                   (für den standings-Aufruf)
 *   → saison     = '2026/27'                   (Ziel-Saison in sm_tabelle)
 * @param {string} fupaUrl
 * @returns {{teamSlug:string, clubSlug:string, seasonSlug:string|null, saison:string|null}|null}
 */
export function configAusFupaUrl(fupaUrl) {
  if (typeof fupaUrl !== 'string') return null
  const m = fupaUrl.trim().match(/fupa\.net\/team\/([a-z0-9-]+)/i)
  if (!m) return null
  const teamSlug = m[1]
  const saisonM = teamSlug.match(/(\d{4})-(\d{2})$/)
  const seasonSlug = saisonM ? `${saisonM[1]}-${saisonM[2]}` : null
  const saison = saisonM ? `${saisonM[1]}/${saisonM[2]}` : null
  // Vereins-Slug = Team-Slug ohne „-m<n>-<jahr>-<jahr>" (Altersklasse + Saison)
  const clubSlug = teamSlug.replace(/-m\d+-\d{4}-\d{2}$/i, '')
  return { teamSlug, clubSlug, seasonSlug, saison }
}

/** Ist dieses FuPa-Team unsere Mannschaft? (Slug exakt oder gleicher Verein) */
export function istSva(team, cfg) {
  if (!team || !cfg) return false
  if (typeof team.slug === 'string' && team.slug === cfg.teamSlug) return true
  if (typeof team.clubSlug === 'string' && team.clubSlug === cfg.clubSlug) return true
  return false
}

/** Ein Testspiel (wird nie übernommen). */
export function istTestspiel(match) {
  if (!match) return true
  if (match.category === 'testmatch') return true
  const name = match.round && match.round.competitionSeason && match.round.competitionSeason.name
  return name === 'Testspiele'
}

const istGanzzahl = (v) => Number.isInteger(v)

/**
 * Ein FuPa-Match → sm_spiele-Zeile (oder null, wenn kein SVA-Spiel / Testspiel).
 * Gibt zusätzlich fupa_id zurück (für die Idempotenz-Logik im Aufrufer).
 * @returns {null | {fupa_id:string, gegner:string, heim:boolean, anstoss:string, ort:string|null, wettbewerb:string|null, spieltag_nr:number|null, tore_sva:number|null, tore_gegner:number|null, status:'geplant'|'beendet', notizen:string}}
 */
export function mapMatch(match, cfg) {
  if (!match || typeof match.id === 'undefined' || !match.kickoff) return null
  if (istTestspiel(match)) return null
  const homeIsSva = istSva(match.homeTeam, cfg)
  const awayIsSva = istSva(match.awayTeam, cfg)
  if (!homeIsSva && !awayIsSva) return null
  const heim = homeIsSva
  const gegnerTeam = heim ? match.awayTeam : match.homeTeam
  if (!gegnerTeam || !gegnerTeam.name || !gegnerTeam.name.full) return null

  const gegner = gegnerTeam.name.full + stufenSuffix(gegnerTeam.level)

  const istLiga = match.category === 'league' && match.round && match.round.type === 'league'
  const spieltag_nr = istLiga && istGanzzahl(match.round.number) ? match.round.number : null

  const comp = match.round && match.round.competitionSeason
  const wettbewerb = comp && typeof comp.name === 'string' ? comp.name : null

  const beendet = match.section === 'POST' && istGanzzahl(match.homeGoal) && istGanzzahl(match.awayGoal)
  let tore_sva = null
  let tore_gegner = null
  if (beendet) {
    tore_sva = heim ? match.homeGoal : match.awayGoal
    tore_gegner = heim ? match.awayGoal : match.homeGoal
  }

  return {
    fupa_id: String(match.id),
    gegner,
    heim,
    anstoss: match.kickoff,
    ort: heim ? HEIMSPIELORT : null,
    wettbewerb,
    spieltag_nr,
    tore_sva,
    tore_gegner,
    status: beendet ? 'beendet' : 'geplant',
    notizen: `fupa:${match.id}`,
  }
}

/**
 * Alle Matches (current + past zusammengeführt) → sm_spiele-Zeilen.
 * Doppelte fupa_id (ein Spiel kann in current UND past auftauchen) werden
 * zusammengefasst — die „vollständigere" Zeile (mit Ergebnis) gewinnt.
 */
export function mapMatches(listen, cfg) {
  const roh = []
  for (const liste of listen) {
    for (const m of Array.isArray(liste) ? liste : []) {
      const row = mapMatch(m, cfg)
      if (row) roh.push(row)
    }
  }
  const byId = new Map()
  for (const row of roh) {
    const vorher = byId.get(row.fupa_id)
    if (!vorher) byId.set(row.fupa_id, row)
    else if (row.status === 'beendet' && vorher.status !== 'beendet') byId.set(row.fupa_id, row)
  }
  return [...byId.values()]
}

/**
 * FuPa-standings-Antwort → sm_tabelle-Zeilen für die Ziel-Saison.
 * diff ist in sm_tabelle eine generierte Spalte → wird NICHT gesetzt.
 * @returns {Array<{saison:string|null, platz:number, team:string, spiele:number, siege:number, unentschieden:number, niederlagen:number, tore:number, gegentore:number, punkte:number, self:boolean}>}
 */
export function mapStandings(standings, cfg) {
  const rows = standings && Array.isArray(standings.standings) ? standings.standings : []
  const out = []
  for (const r of rows) {
    if (!r || !istGanzzahl(r.rank) || !r.team || !r.team.name || !r.team.name.full) continue
    out.push({
      saison: cfg ? cfg.saison : null,
      platz: r.rank,
      team: r.team.name.full + stufenSuffix(r.team.level),
      spiele: istGanzzahl(r.matches) ? r.matches : 0,
      siege: istGanzzahl(r.wins) ? r.wins : 0,
      unentschieden: istGanzzahl(r.draws) ? r.draws : 0,
      niederlagen: istGanzzahl(r.defeats) ? r.defeats : 0,
      tore: istGanzzahl(r.ownGoals) ? r.ownGoals : 0,
      gegentore: istGanzzahl(r.againstGoals) ? r.againstGoals : 0,
      punkte: istGanzzahl(r.points) ? r.points : 0,
      self: istSva(r.team, cfg),
    })
  }
  return out
}

/**
 * Liga-Wettbewerbs-Slug aus den Matches ermitteln (für den standings-Aufruf).
 * Nimmt den ersten Liga-Eintrag (category 'league').
 */
export function ligaCompetitionSlug(listen) {
  for (const liste of listen) {
    for (const m of Array.isArray(liste) ? liste : []) {
      if (m && m.category === 'league' && m.round && m.round.competitionSeason && typeof m.round.competitionSeason.slug === 'string') {
        return m.round.competitionSeason.slug
      }
    }
  }
  return null
}
