// ─────────────────────────────────────────────────────────────────────────────
// v23-L: Abgleich Soll (FuPa) ↔ Ist (bestehende Bot-Zeilen) + Pult-Duplikate.
// Reine Funktion, dependency-frei. Liefert Operationen für sva_fupa_ticker_anwenden.
//
// Regeln (Konzept 2.6):
//   · Bot fasst NUR quelle='fupa' an; Pult-Zeilen nie ändern/löschen.
//   · Gesperrte (von Hand bearbeitete) Bot-Zeilen nie ändern/löschen.
//   · Fehlt eine fupa_event_id im neuen Stream → löschen (außer gesperrt).
//   · Duplikat einer Pult-Zeile → die Bot-Zeile verstecken (versteckt + duplikat_von).
//   · Platzhalter-Tor aus Soft-Ticker-Stand, verschwindet beim echten Tor.
// ─────────────────────────────────────────────────────────────────────────────

const PFIFF = new Set(['anpfiff', 'halbzeit', 'wiederanpfiff', 'abpfiff'])
// Felder, die ein Update auslösen (text/text_quelle nur, wenn der Bot sie führt).
const PATCH_FELDER = ['typ', 'minute', 'nachspielzeit', 'roster_id', 'roster_id_2',
  'text', 'text_quelle', 'fupa_name', 'fupa_name_2', 'team', 'zeitpunkt', 'platzhalter']

/**
 * @param {object} p
 * @param {Array} p.soll  Soll-Zeilen (aus ereignisseAusStream + mitZeitpunkten), mit fupa_event_id
 * @param {Array} p.ist   bestehende quelle='fupa'-Zeilen des Spiels (inkl. id, gesperrt, versteckt, platzhalter)
 * @param {Array} p.pultZeilen  sichtbare quelle='pult'-Zeilen (id, typ, minute, roster_id, duplikat_von?)
 * @param {object|null} p.kopf  kopfAusMatch (für Platzhalter): {toreHeim,toreGast,minute}
 * @param {boolean} p.heimIstSva
 * @param {number} p.fupaMatchId
 * @returns {{einfuegen:Array, aendern:Array, loeschen:string[], verstecken:Array}}
 */
export function abgleichen({ soll = [], ist = [], pultZeilen = [], kopf = null, heimIstSva = true, fupaMatchId = 0 }) {
  const einfuegen = []
  const aendern = []
  const loeschen = []
  const verstecken = []

  const istByFid = new Map()
  for (const r of ist) if (r.fupa_event_id != null) istByFid.set(Number(r.fupa_event_id), r)
  const sollFids = new Set(soll.map((r) => Number(r.fupa_event_id)))

  // Pult-Zeilen, die schon ein Bot-Duplikat haben, nicht erneut belegen.
  const pultBelegt = new Set(ist.filter((r) => r.duplikat_von).map((r) => String(r.duplikat_von)))

  for (const s of soll) {
    const fid = Number(s.fupa_event_id)
    const vorhanden = istByFid.get(fid)
    if (!vorhanden) {
      const dup = pultZeilen.find((p) => !pultBelegt.has(String(p.id)) && istDuplikat(s, p))
      if (dup) {
        pultBelegt.add(String(dup.id))
        einfuegen.push({ ...s, versteckt: true, duplikat_von: dup.id })
      } else {
        einfuegen.push({ ...s })
      }
      continue
    }
    if (vorhanden.gesperrt) continue
    const patch = {}
    for (const f of PATCH_FELDER) {
      if (f === 'zeitpunkt') continue // Zeitpunkt nur bei Erstanlage; nicht ständig verschieben
      if (norm(s[f]) !== norm(vorhanden[f])) patch[f] = s[f] ?? null
    }
    if (Object.keys(patch).length) aendern.push({ id: vorhanden.id, patch })
  }

  // Löschen: Bot-Zeilen (echte FuPa-Events, positive ID), die FuPa nicht mehr liefert.
  for (const r of ist) {
    if (r.gesperrt) continue
    if (r.platzhalter) continue // Platzhalter unten gesondert
    if (r.fupa_event_id != null && Number(r.fupa_event_id) >= 0 && !sollFids.has(Number(r.fupa_event_id))) {
      loeschen.push(r.id)
    }
  }

  // Platzhalter-Tore aus dem Stand (nur mit Kopf-Daten).
  if (kopf) {
    platzhalter('tor', heimIstSva ? kopf.toreHeim : kopf.toreGast)
    platzhalter('gegentor', heimIstSva ? kopf.toreGast : kopf.toreHeim)
  }

  function platzhalter(typ, kopfTore) {
    if (!Number.isFinite(kopfTore)) return
    // echte (nicht-Platzhalter) sichtbare Tore dieses Typs = Soll + Ist + Pult
    const echt = einfuegen.filter((r) => r.typ === typ && !r.versteckt).length
      + ist.filter((r) => r.typ === typ && !r.platzhalter && !r.versteckt && !loeschen.includes(r.id)).length
      + pultZeilen.filter((p) => p.typ === typ).length
    const vorhandenePH = ist.filter((r) => r.platzhalter && r.typ === typ && !loeschen.includes(r.id))
    const ziel = Math.max(0, kopfTore - echt)  // so viele Platzhalter sollen bleiben
    if (vorhandenePH.length < ziel) {
      for (let n = vorhandenePH.length; n < ziel; n++) {
        einfuegen.push({
          fupa_event_id: -(fupaMatchId * 100 + (typ === 'tor' ? n + 1 : n + 51)),
          typ, minute: kopf.minute ?? null, nachspielzeit: null,
          team: typ === 'tor' ? 'sva' : 'gegner', platzhalter: true,
          text: null, text_quelle: 'vorlage', roster_id: null, roster_id_2: null,
          fupa_name: null, fupa_name_2: null,
        })
      }
    } else if (vorhandenePH.length > ziel) {
      for (const r of vorhandenePH.slice(0, vorhandenePH.length - ziel)) {
        if (!loeschen.includes(r.id)) loeschen.push(r.id)
      }
    }
  }

  return { einfuegen, aendern, loeschen, verstecken }
}

/** Duplikat einer Pult-Zeile? Gleicher Typ; Pfiffe ohne Minute; sonst |Δ Minute| ≤ 3 und Spieler passt. */
function istDuplikat(soll, pult) {
  if (soll.typ !== pult.typ) return false
  if (PFIFF.has(soll.typ)) return true
  const ms = soll.minute, mp = pult.minute
  if (ms != null && mp != null && Math.abs(ms - mp) > 3) return false
  const rs = soll.roster_id ?? null
  const rp = pult.roster_id ?? null
  if (rs && rp && rs !== rp) return false
  return true
}

const norm = (v) => (v === undefined || v === '' ? null : v)
