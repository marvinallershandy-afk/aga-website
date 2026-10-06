// ─────────────────────────────────────────────────────────────────────────────
// v26: Drehbuch der Check-in-Anzeige-VORFÜHRUNG (/admin/checkin-anzeige?vorfuehrung=1).
//
// Komplett lokal simuliert — nichts in die DB, nichts ins Netz außer Bildern/
// Assets. Spieler kommen aus dem echten Kader (useRoster); Torschützen werden
// zur Laufzeit gewählt (bevorzugt Angriff, dann Kapitän), siehe CheckinAnzeige.
//
// Realistisch wie eine TV-Zusammenfassung (nicht die durchrasende Uhr):
//   0–12 s   „vor Anpfiff“ (Anstoßzeit groß, Fan-Zähler zählt simuliert hoch) —
//            so sieht die Anzeige am Eingang am häufigsten aus.
//   12 s     weicher Übergang „Live“ direkt in die 60. Minute, 0:0. Die Minute
//            steht danach ruhig und springt nur zwischen Ereignissen (Ziffern-Roll).
//   61′      TOR SVA (volle TOR!-Einblendung + Torschützen-Szene).
//   74′      Gegentor (nur Stand-Flip, dezent).
//   86′      zweites SVA-Tor (anderer Spieler).
//   90+3′    ABPFIFF als eigener Moment (Endstand 2:1, Sieg-Glanz, Danke-Zeile).
//   danach   Schleife von vorn. Halbzeit wird in der Vorführung nicht gezeigt.
//
// ALLES hier ist bewusst in EINER Datei konfigurierbar (Zeiten, Minuten, Stand).
// ─────────────────────────────────────────────────────────────────────────────

export interface DrehEreignis {
  /** Sekunden ab Vorführ-Start (Schleife) */
  bei: number
  /** Spielminute (0 = vor Anpfiff) */
  minute: number
  /** Nachspielzeit (+x) */
  nachspiel?: number
  /** Tore SVA zu diesem Zeitpunkt */
  sva: number
  /** Tore Gegner zu diesem Zeitpunkt */
  geg: number
  status: 'geplant' | 'live' | 'beendet'
  /** löst eine Einblendung aus, weil sich der Stand hier geändert hat */
  tor?: 'sva' | 'gegner'
  /** Index des Torschützen in der (zur Laufzeit gewählten) Schützenliste */
  schuetze?: number
  /** besonderer Schlusspfiff-Moment */
  abpfiff?: boolean
}

export interface Drehbuch {
  /** Gesamtlänge der Schleife in Sekunden */
  loopSek: number
  /** Fan-Zähler zählt über die Schleife von … auf … (mit kleinen Pulsen) */
  startFans: number
  endFans: number
  /** groß angezeigte Anstoßzeit vor Anpfiff */
  anstossText: string
  /** Gegnername, falls kein echtes Heimspiel in useSpiele steckt */
  gegnerFallback: string
  ereignisse: DrehEreignis[]
}

export const VORF_DREHBUCH: Drehbuch = {
  loopSek: 92,
  startFans: 18,
  endFans: 63,
  anstossText: '15:00',
  gegnerFallback: 'TuS Fischbek',
  ereignisse: [
    { bei: 0, minute: 0, sva: 0, geg: 0, status: 'geplant' },
    { bei: 12, minute: 60, sva: 0, geg: 0, status: 'live' }, // weicher Übergang in die 60.
    { bei: 18, minute: 60, sva: 0, geg: 0, status: 'live' }, // ruhig
    { bei: 24, minute: 61, sva: 1, geg: 0, status: 'live', tor: 'sva', schuetze: 0 }, // TOR SVA
    { bei: 34, minute: 68, sva: 1, geg: 0, status: 'live' }, // Zeitraffer-Roll
    { bei: 44, minute: 74, sva: 1, geg: 1, status: 'live', tor: 'gegner' }, // Gegentor
    { bei: 54, minute: 80, sva: 1, geg: 1, status: 'live' },
    { bei: 64, minute: 86, sva: 2, geg: 1, status: 'live', tor: 'sva', schuetze: 1 }, // 2. SVA-Tor
    { bei: 74, minute: 90, sva: 2, geg: 1, status: 'live' },
    { bei: 80, minute: 90, nachspiel: 3, sva: 2, geg: 1, status: 'beendet', abpfiff: true }, // Abpfiff
    // 80–92 s: Endstand halten, danach Schleife (Wrap auf „vor Anpfiff“)
  ],
}

export interface VorfuehrStand {
  /** aktueller Dreh-Waypoint */
  cur: DrehEreignis
  /** Sekunden im aktuellen Schleifen-Durchlauf */
  sek: number
  /** simulierter Fan-Zähler */
  fans: number
  /** bislang eingetretene Tor-/Gegentor-Ereignisse (chronologisch) */
  tore: DrehEreignis[]
  /** Nummer der aktuellen Schleife (für dedup-freies Wiederauslösen) */
  durchlauf: number
}

/** Reiner Simulations-Schritt: Stand zum Zeitpunkt (ms seit Vorführ-Start). */
export function vorfuehrStand(elapsedMs: number, d: Drehbuch = VORF_DREHBUCH): VorfuehrStand {
  const loop = d.loopSek * 1000
  const durchlauf = Math.floor(Math.max(0, elapsedMs) / loop)
  const t = ((elapsedMs % loop) + loop) % loop
  const sek = t / 1000
  let idx = 0
  for (let i = 0; i < d.ereignisse.length; i++) if (sek >= d.ereignisse[i].bei) idx = i
  const cur = d.ereignisse[idx]
  // Fans zählen über fast die ganze Schleife hoch (ganzzahlig → natürliche Pulse)
  const p = Math.min(1, sek / (d.loopSek - 6))
  const fans = Math.round(d.startFans + (d.endFans - d.startFans) * p)
  const tore = d.ereignisse.slice(0, idx + 1).filter((e) => e.tor)
  return { cur, sek, fans, tore, durchlauf }
}
