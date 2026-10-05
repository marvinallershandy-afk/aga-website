// ─────────────────────────────────────────────────────────────
// v18-T „Vorführ-Spiel“: Erkennung des Vorführ-Links.
//   /live?vorfuehrung=1  → /live zeigt NUR das Vorführ-Spiel (web_live_demo)
//   /?vorfuehrung=1      → Spieltag-Leiste + Karte zeigen es
// Ohne den Parameter sieht niemand etwas davon. Der Wert wird EINMAL beim
// Laden festgehalten — das Karten-Routing räumt die Adresse später auf.
// Aufrufe mit dem Parameter werden nicht gezählt (statistik/zaehlen.ts).
// Kein React, kein SDK — genutzt von /live, Onepager und Zählung.
// ─────────────────────────────────────────────────────────────

export const VORFUEHRUNG_PARAM = 'vorfuehrung'

export function istVorfuehrungsAdresse(search: string): boolean {
  const v = new URLSearchParams(search).get(VORFUEHRUNG_PARAM)
  return v !== null && !/^(0|false|nein|aus)$/i.test(v.trim())
}

/** Beim Laden der Seite festgehalten (nicht reaktiv). */
export const VORFUEHRUNG: boolean = typeof window !== 'undefined' && istVorfuehrungsAdresse(window.location.search)

/** Öffentlicher Vorführ-Link (Admin: öffnen/kopieren/QR). */
export function vorfuehrungsLink(origin: string, ziel: 'live' | 'karte' = 'live'): string {
  return `${origin.replace(/\/+$/, '')}${ziel === 'live' ? '/live' : '/'}?${VORFUEHRUNG_PARAM}=1`
}
