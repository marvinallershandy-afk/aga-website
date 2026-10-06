// v20-K: Rückseiten-Werte, wenn die Quelle keine eigenen liefert.
// Nur sachliche Angaben — nie Bewertungen.
import { POSITION_NAME, type KartenDaten, type KartenWert } from './typen'

export function standardWerteText(d: KartenDaten): KartenWert[] {
  const w: KartenWert[] = []
  if (d.art === 'spieler') {
    if (d.position) w.push({ label: 'Position', wert: POSITION_NAME[d.position] })
    if (d.nummer != null) w.push({ label: 'Rückennummer', wert: String(d.nummer) })
    if (d.kapitaen) w.push({ label: 'Rolle', wert: 'Kapitän' })
  } else if (d.art === 'trainer') {
    w.push({ label: 'Rolle', wert: d.rolle ?? 'Trainerstab' })
  } else if (d.art === 'partner') {
    if (d.partnerSeit) w.push({ label: 'Partner seit', wert: String(d.partnerSeit) })
  } else {
    if (d.serie) w.push({ label: 'Serie', wert: d.serie })
    if (d.untertitel) w.push({ label: 'Moment', wert: d.untertitel })
  }
  if (d.praesentiertVon) w.push({ label: 'Präsentiert von', wert: d.praesentiertVon.name })
  return w
}
