// ─────────────────────────────────────────────────────────────
// v17-G: „Aufstellung als Story“ aus dem Admin-Stand (auch ungespeichert:
// was im Editor steht, kommt aufs Bild). Gleiches Design wie /live
// (src/live/aufstellung/story.ts).
// ─────────────────────────────────────────────────────────────
import { baueAufstellung } from '../../live/aufstellung/daten'
import { teileAufstellungStory } from '../../live/aufstellung/story'
import type { LivePlayer, LiveStaff } from '../../live/model'
import type { RosterRow, SpielRow } from './db'
import { positionCode } from './pflege'
import { fetchLivePartner } from './partner'

function alsLivePlayer(r: RosterRow): LivePlayer {
  return {
    id: r.slug, // playerMedia/Greenscreen-Registry sind nach slug geschlüsselt
    name: r.name,
    number: r.nummer,
    position: positionCode(r.position),
    photoUrl: r.foto_url,
    cutoutUrl: r.freisteller_url,
    isCaptain: r.kapitaen || undefined,
  }
}

export async function aufstellungAlsStory(e: {
  formation: string
  /** Roster-ids in Slot-Reihenfolge */
  slots: (string | null)[]
  bank: string[]
  roster: RosterRow[]
  spiel: Pick<SpielRow, 'gegner' | 'heim' | 'anstoss' | 'wettbewerb' | 'spieltag_nr'> | null
}): Promise<'geteilt' | 'geladen'> {
  const players = new Map(e.roster.map((r) => [r.id, alsLivePlayer(r)]))
  const staff: LiveStaff[] = e.roster
    .filter((r) => r.aktiv && (r.rolle ?? 'spieler') !== 'spieler')
    .sort((a, b) => a.sortierung - b.sortierung)
    .map((r) => ({ id: r.slug, name: r.name, role: r.rolle, photoUrl: r.foto_url, cutoutUrl: r.freisteller_url }))
  const partner = await fetchLivePartner()
  const g = baueAufstellung({
    formation: e.formation,
    startelf: e.slots,
    bank: e.bank,
    players,
    events: [],
    staff,
    partner,
    match: e.spiel
      ? { opponent: e.spiel.gegner, home: e.spiel.heim, kickoff: e.spiel.anstoss, competition: e.spiel.wettbewerb ?? undefined, matchday: e.spiel.spieltag_nr ?? undefined }
      : null,
    forMatch: true,
  })
  return teileAufstellungStory(g)
}
