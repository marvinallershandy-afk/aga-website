// ─────────────────────────────────────────────────────────────────────────────
// v23-L: FuPa-Live → sva_ticker — reine Abbildung (keine KI, keine Reportertexte
// außer mit Freigabe). Dependency-frei, von Deno (index.ts) UND Node (Tests)
// importierbar. KEINE Deno-/Node-APIs.
//
// Fakten → eigene Satzvorlagen: der Bot schreibt text=null, text_quelle='vorlage'
// (das UI baut den Satz). Reportertexte nur, wenn der Autor freigegeben ist
// (textAutorErlaubt) → text 1:1, text_quelle='reporter'.
// ─────────────────────────────────────────────────────────────────────────────

/** Spielkopf (GET /v1/matches/<id>) → kompakte Felder für sm_spiele.fupa_*. */
export function kopfAusMatch(match, cfg) {
  const heimIstSva = istSvaSlug(match?.homeTeam?.slug, match?.homeTeam?.clubSlug, cfg)
  const live = match?.live && typeof match.live === 'object' ? match.live : null
  const flags = Array.isArray(match?.flags) ? match.flags : []
  let tickerTyp = match?.tickerType ?? null
  if (!tickerTyp) tickerTyp = flags.includes('softticker') ? 'soft' : flags.includes('ticker') ? 'live' : null
  return {
    section: match?.section ?? null,                 // PRE|LIVE|POST
    toreHeim: intOrNull(match?.homeGoal),
    toreGast: intOrNull(match?.awayGoal),
    minute: live ? clamp(intOrNull(live.minute), 0, 130) : null,
    nachspielzeit: live ? (intOrNull(live.additionalMinute) || null) : null,
    tickerTyp,                                        // 'live'|'soft'|null
    streamTs: intOrNull(match?.streamUpdatedAt),
    autorId: intOrNull(match?.tickerAuthor?.id),
    autorName: typeof match?.tickerAuthor?.firstName === 'string' ? match.tickerAuthor.firstName : null,
    heimIstSva,
  }
}

/** Ein FuPa-Teamslug ist unsere Mannschaft? */
export function istSvaSlug(slug, clubSlug, cfg) {
  if (!cfg) return false
  if (typeof slug === 'string' && slug === cfg.teamSlug) return true
  if (typeof clubSlug === 'string' && clubSlug === cfg.clubSlug) return true
  return false
}

const intOrNull = (v) => (Number.isFinite(v) ? Math.trunc(v) : null)
const clamp = (v, lo, hi) => (v == null ? null : Math.max(lo, Math.min(hi, v)))

const WHISTLE = {
  whistle_regular_start_first_halftime: 'anpfiff',
  whistle_regular_stop_first_halftime: 'halbzeit',
  whistle_regular_start_second_halftime: 'wiederanpfiff',
  whistle_regular_stop_second_halftime: 'abpfiff',
}

// Zusatztext aus dem Tor-Untertyp (für die UI-Vorlage).
const GOAL_ZUSATZ = {
  goal_headed: 'Kopfball',
  goal_freekick: 'Freistoß',
  goal_free_kick: 'Freistoß',
  goal_distance_shoot: 'Fernschuss',
}

/**
 * Stream (GET /v2/matches/<id>/stream) → Soll-Zeilen für sva_ticker.
 * ctx = { heimIstSva, svaTeamSlug, rosterByFupaId: Map<number,uuid>,
 *         textAutorErlaubt: boolean, anstoss: Date, anpfiffAt: Date|null, fupaMatchId: number }
 * @returns {Array<object>} Soll-Zeilen (quelle='fupa')
 */
export function ereignisseAusStream(stream, ctx) {
  const roster = ctx.rosterByFupaId instanceof Map ? ctx.rosterByFupaId : new Map()
  const events = (Array.isArray(stream) ? stream : [])
    .filter((e) => e && e.type === 'matchevent' && e.entity)
    .map((e) => e.entity)
  // chronologisch (aufsteigend) für die Stand-/Eigentor-Prüfung
  events.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0) || cmpId(a.id, b.id))

  const out = []
  let prevHome = 0
  let prevAway = 0
  for (const en of events) {
    const row = mapEvent(en, ctx, roster, { prevHome, prevAway })
    if (en.type === 'goal' && Number.isFinite(en.homeGoal) && Number.isFinite(en.awayGoal)) {
      prevHome = en.homeGoal
      prevAway = en.awayGoal
    }
    if (row) out.push(row)
  }
  return out
}

function mapEvent(en, ctx, roster, stand) {
  const typ = en.type
  const slug = en.team && typeof en.team.slug === 'string' ? en.team.slug : null
  const istSva = slug != null && slug === ctx.svaTeamSlug
  const minute = clamp(intOrNull(en.minute), 0, 130)
  const nachspielzeit = intOrNull(en.additionalMinute) || null
  const base = {
    fupa_event_id: intOrNull(en.id),
    minute,
    nachspielzeit,
    text: null,
    text_quelle: 'vorlage',
    roster_id: null,
    roster_id_2: null,
    fupa_name: null,
    fupa_name_2: null,
    team: null,
    platzhalter: false,
  }
  // Reportertext nur mit Freigabe (sonst baut das UI den Satz aus der Vorlage).
  const reporterText = () => {
    if (ctx.textAutorErlaubt && typeof en.text === 'string' && en.text.trim()) {
      base.text = en.text.trim().slice(0, 500)
      base.text_quelle = 'reporter'
    }
  }

  const p1 = en.primaryRole && en.primaryRole.player ? en.primaryRole.player : null
  const p2 = en.secondaryRole && en.secondaryRole.player ? en.secondaryRole.player : null
  const nameVon = (p) => (p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : null)
  const rosterVon = (p) => (p && roster.has(Number(p.id)) ? roster.get(Number(p.id)) : null)

  switch (typ) {
    case 'goal': {
      // Stand-Sprung: wessen Wert ist gestiegen? (robust gegen falsches team / Eigentor)
      const curHome = Number.isFinite(en.homeGoal) ? en.homeGoal : null
      const curAway = Number.isFinite(en.awayGoal) ? en.awayGoal : null
      let svaScored
      if (curHome != null && curAway != null) {
        const svaUp = ctx.heimIstSva ? curHome > stand.prevHome : curAway > stand.prevAway
        const gegnerUp = ctx.heimIstSva ? curAway > stand.prevAway : curHome > stand.prevHome
        svaScored = svaUp ? true : gegnerUp ? false : istSva
      } else {
        svaScored = istSva
      }
      const eigentor = en.subtype === 'goal_own_goal'
      const zusatz = en.subtype && en.subtype.startsWith('penalty') ? 'Elfmeter'
        : eigentor ? 'Eigentor' : GOAL_ZUSATZ[en.subtype] ?? null
      reporterText()
      if (svaScored) {
        base.team = 'sva'
        base.typ = 'tor'
        if (!eigentor) {
          base.roster_id = rosterVon(p1)
          base.roster_id_2 = rosterVon(p2)
          if (!base.roster_id) base.fupa_name = nameVon(p1)
          if (!base.roster_id_2 && p2) base.fupa_name_2 = nameVon(p2)
        }
      } else {
        base.team = 'gegner'
        base.typ = 'gegentor'
        if (!eigentor) base.fupa_name = nameVon(p1)
      }
      if (base.text_quelle === 'vorlage' && zusatz) base.zusatz = zusatz
      return base
    }
    case 'card': {
      const map = { card_yellow: 'gelb', card_yellow_red: 'gelbrot', card_red: 'rot' }
      base.typ = map[en.subtype] ?? 'gelb'
      base.team = istSva ? 'sva' : 'gegner'
      reporterText()
      if (istSva) {
        base.roster_id = rosterVon(p1)
        if (!base.roster_id) base.fupa_name = nameVon(p1)
      } else {
        base.fupa_name = nameVon(p1)
      }
      return base
    }
    case 'substitute': {
      reporterText()
      if (istSva) {
        base.typ = 'wechsel'
        base.team = 'sva'
        base.roster_id = rosterVon(p1)        // kommt rein
        base.roster_id_2 = rosterVon(p2)      // geht raus
        if (!base.roster_id) base.fupa_name = nameVon(p1)
        if (!base.roster_id_2 && p2) base.fupa_name_2 = nameVon(p2)
      } else {
        base.typ = 'wechsel_gegner'
        base.team = 'gegner'
        base.fupa_name = nameVon(p1)
        base.fupa_name_2 = nameVon(p2)
      }
      return base
    }
    case 'penaltyfail': {
      base.typ = 'elfmeter_verschossen'
      base.team = istSva ? 'sva' : 'gegner'
      reporterText()
      if (istSva) {
        base.roster_id = rosterVon(p1)
        if (!base.roster_id) base.fupa_name = nameVon(p1)
      } else base.fupa_name = nameVon(p1)
      return base
    }
    case 'whistle': {
      const w = WHISTLE[en.subtype]
      if (w) { base.typ = w; return base }
      // Verlängerung/Elfmeterschießen u. a.: als Kommentar mit FuPa-Text
      base.typ = 'kommentar'
      base.text = typeof en.text === 'string' ? en.text.trim().slice(0, 500) : null
      base.text_quelle = 'vorlage'
      return base
    }
    case 'text': {
      if (!ctx.textAutorErlaubt) return null
      base.typ = 'kommentar'
      base.text = typeof en.text === 'string' ? en.text.trim().slice(0, 500) : null
      base.text_quelle = 'reporter'
      return base
    }
    default:
      // timepenalty, lineupentered, lineupscompleted, news, liveticker-eingetragen … weglassen
      return null
  }
}

/**
 * Synthetischer Zeitpunkt (für Reihenfolge + Status-Ableitung). Reine Funktion.
 * @param {object} row Soll-Zeile (typ, minute, nachspielzeit, fupa_event_id)
 * @param {{anstoss: Date, anpfiffAt: Date|null}} ctx
 * @returns {string} ISO-Zeitpunkt
 */
export function zeitpunktFuer(row, ctx) {
  const basis = (ctx.anpfiffAt ?? ctx.anstoss ?? new Date()).getTime()
  const ns = row.nachspielzeit ?? 0
  let offsetMin
  switch (row.typ) {
    case 'anpfiff': offsetMin = 0; break
    case 'halbzeit': offsetMin = 45 + ns; break
    case 'wiederanpfiff': offsetMin = 60; break
    case 'abpfiff': offsetMin = 105 + ns; break
    default: {
      const m = row.minute ?? 0
      offsetMin = m + ns * 0.01 + (m > 45 ? 15 : 0)
    }
  }
  // Millisekunden-Versatz nach FuPa-ID (aufsteigend = älter = früher), < 1 s
  const idMs = row.fupa_event_id != null ? Math.abs(Number(row.fupa_event_id)) % 1000 : 0
  return new Date(basis + offsetMin * 60000 + idMs).toISOString()
}

/** Zeitpunkt für alle Soll-Zeilen setzen (mutiert nicht; gibt neue Liste). */
export function mitZeitpunkten(rows, ctx) {
  return rows.map((r) => ({ ...r, zeitpunkt: zeitpunktFuer(r, ctx) }))
}

/** FuPa-Aufstellung (GET /lineup) → sva_fupa_aufstellung.spieler (nur SVA, ohne birthday/image). */
export function aufstellungAusLineup(lineup, heimIstSva) {
  const seite = heimIstSva ? lineup?.homeTeam : lineup?.awayTeam
  const arr = seite && Array.isArray(seite.lineup) ? seite.lineup : []
  return arr
    .filter((x) => x && x.coach !== true && x.player)
    .map((x) => {
      const p = x.player ?? {}
      const st = x.statistics ?? {}
      return {
        fupaId: intOrNull(p.id),
        vorname: p.firstName ?? null,
        nachname: p.lastName ?? null,
        nummer: intOrNull(x.jerseyNumber),
        start: x.starting === true,
        kapitaen: x.captain === true,
        minuten: intOrNull(st.minutes),
        tore: intOrNull(st.goals),
        vorlagen: intOrNull(st.assists),
        gelb: (intOrNull(st.yellowCard) || 0) > 0,
        gelbrot: (intOrNull(st.yellowRedCard) || 0) > 0,
        rot: (intOrNull(st.redCard) || 0) > 0,
      }
    })
}

function cmpId(a, b) {
  const x = a == null ? 0 : Number(a)
  const y = b == null ? 0 : Number(b)
  return x - y
}
