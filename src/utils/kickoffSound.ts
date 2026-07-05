// Sound-Trigger für den Anstoß (Stadion-Swell) — Asset: die ersten
// 7 s aus Marvins „Anpfiff" (Fade-in/out geschnitten, Herkunft im
// Abschlussbericht). Läuft über den AudioManager-FX-Kanal und
// respektiert die Ton-Einwilligung automatisch.
import { AudioManager } from '../audio/AudioManager'

let fired = false

export function triggerKickoffSwell() {
  if (fired) return
  fired = true
  AudioManager.playSwell()
}
