// Sound-Trigger für den Anstoß (Stadion-Swell).
// Vorbereitet, aber default AUS und ohne Asset:
//   TODO (Marvin): CC0/lizenzfreies Stadion-Swell-Sample nach
//   public/audio/kickoff-swell.mp3 legen und ENABLED aktivieren.
// Autoplay-Regeln: Browser erlauben Audio erst nach User-Geste —
// der Trigger feuert nur, wenn zuvor eine Interaktion stattfand
// (Scroll zählt als Geste in Chrome/Safari nach erstem Touch/Klick).

const ENABLED = false
const ASSET = '/audio/kickoff-swell.mp3'

let audio: HTMLAudioElement | null = null
let fired = false

export function triggerKickoffSwell() {
  if (!ENABLED || fired) return
  fired = true
  try {
    audio ??= new Audio(ASSET)
    audio.volume = 0.5
    void audio.play().catch(() => {
      /* Autoplay blockiert → still bleiben */
    })
  } catch {
    /* kein Audio verfügbar */
  }
}
